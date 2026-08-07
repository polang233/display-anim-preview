import {
  applyCompiledDisplaySnapshot,
  cloneCompiledDisplay,
  type CompiledDisplay,
} from "./display-snapshot";
import { tr } from "./i18n";
import { resolveJavaBlockCodec } from "./java-block-codec";

/**
 * Bakes skeletal animation into flat Java block models. Transform accumulation mirrors
 * Blockbench's bake action, and Group.resolve() performs hierarchy flattening. Every frame runs
 * inside an Undo transaction that is cancelled immediately so project data and history survive.
 * The `animations` aspect is mandatory because keyframes belong to group animators.
 */

/** A cube coordinate outside Minecraft's model limits. */
export interface OutOfBoundsHit {
  frame: number;
  elementIndex: number;
  elementName: string;
  axis: "x" | "y" | "z";
  field: "from" | "to";
  value: number;
}

export interface BakedFrame {
  frame: number;
  /** Compiled Java model JSON produced by Blockbench's codec. */
  json: string;
}

export interface BakeResult {
  frames: BakedFrame[];
  outOfBounds: OutOfBoundsHit[];
}

function snapshotCompiledDisplay(): CompiledDisplay | undefined {
  try {
    const compiled = JSON.parse(
      resolveJavaBlockCodec().compile({ prevent_dialog: true })
    ) as { display?: CompiledDisplay };
    return cloneCompiledDisplay(compiled.display);
  } catch (err) {
    console.warn("Unable to snapshot current display settings before baking", err);
    return undefined;
  }
}

/** Minecraft's Java model coordinate limits, verified from the built-in java_block format. */
const COORDINATE_MIN = -16;
const COORDINATE_MAX = 32;

const AXIS_NAMES: Array<"x" | "y" | "z"> = ["x", "y", "z"];

/**
 * Accumulates animation offsets at the current timeline position into static node data.
 */
function applyAnimatedOffsets(node: OutlinerNodeLike): void {
  const offsetRotation: [number, number, number] = [0, 0, 0];
  const offsetPosition: [number, number, number] = [0, 0, 0];

  for (const animation of Animator.animations) {
    if (!animation.playing) continue;
    const animator = animation.getBoneAnimator(node);
    if (!animator) continue;
    // This format supports group-driven skeletal animation only.
    if (!(node instanceof Group)) continue;

    const multiplier = animation.blend_weight
      ? Math.max(Animator.MolangParser.parse(animation.blend_weight), 0)
      : 1;

    if (animator.channels.rotation) {
      const rotation = animator.interpolate("rotation");
      if (rotation instanceof Array) {
        offsetRotation.V3_add(rotation.map((v) => v * multiplier));
      }
    }
    if (animator.channels.position) {
      const position = animator.interpolate("position");
      if (position instanceof Array) {
        offsetPosition.V3_add(position.map((v) => v * multiplier));
      }
    }
  }

  if (node.getTypeBehavior("rotatable") && node.rotation) {
    node.rotation[0] += offsetRotation[0];
    node.rotation[1] += offsetRotation[1];
    node.rotation[2] += offsetRotation[2];
  }

  applyPositionOffset(node, offsetPosition);
}

/** Translates every coordinate in a node subtree. */
function applyPositionOffset(node: OutlinerNodeLike, offset: [number, number, number]): void {
  if (node instanceof Group) {
    node.origin?.V3_add(offset);
    for (const child of node.children) {
      applyPositionOffset(child, offset);
    }
    return;
  }
  node.from?.V3_add(offset);
  node.to?.V3_add(offset);
  if (node.origin && node.origin !== node.from) {
    node.origin.V3_add(offset);
  }
}

/**
 * Resolves top-level groups repeatedly until the complete hierarchy is flat.
 */
function flattenHierarchy(): void {
  for (let round = 0; round < 100; round++) {
    const topLevel = Group.all.filter((group) => !(group.parent instanceof Group));
    if (!topLevel.length) return;
    for (const group of topLevel) {
      group.resolve(false);
    }
  }
  console.warn("Bone hierarchy did not fully flatten within the iteration cap");
}

function belongsToRoot(node: OutlinerNodeLike, rootGroupUuid: string): boolean {
  let current: OutlinerNodeLike | "root" | null = node;
  while (current && current !== "root") {
    if (current.uuid === rootGroupUuid) return true;
    current = current.parent;
  }
  return false;
}

/**
 * Temporarily excludes elements outside the selected top-level groups; Undo restores flags.
 */
function restrictExportToRoot(rootGroupUuid?: string): void {
  if (!rootGroupUuid) return;
  for (const element of Outliner.elements) {
    if (!belongsToRoot(element, rootGroupUuid)) {
      element.export = false;
    }
  }
}

/** Scans a compiled frame for coordinates outside Minecraft limits. */
function collectOutOfBounds(frame: number, json: string): OutOfBoundsHit[] {
  const hits: OutOfBoundsHit[] = [];
  let parsed: { elements?: Array<{ name?: string; from: number[]; to: number[] }> };
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    console.error(`Frame ${frame}: compiled model is not valid JSON`, err);
    return hits;
  }

  const elements = parsed.elements ?? [];
  elements.forEach((element, elementIndex) => {
    const fields: Array<["from" | "to", number[]]> = [
      ["from", element.from],
      ["to", element.to],
    ];
    for (const [field, values] of fields) {
      if (!(values instanceof Array)) continue;
      values.forEach((value, axis) => {
        if (value >= COORDINATE_MIN && value <= COORDINATE_MAX) return;
        hits.push({
          frame,
          elementIndex,
          elementName: element.name ?? `element ${elementIndex}`,
          axis: AXIS_NAMES[axis] ?? "x",
          field,
          value,
        });
      });
    }
  });
  return hits;
}

/** Total keyframe count used as a rollback integrity guard. */
function countKeyframes(): number {
  let total = 0;
  for (const animation of Animation.all) {
    const animators = animation.animators ?? {};
    for (const key of Object.keys(animators)) {
      total += animators[key]?.keyframes?.length ?? 0;
    }
  }
  return total;
}

/**
 * Bakes `frameCount` frames at the requested FPS and restores timeline, selection, playback,
 * model data, and undo history afterward.
 */
export function bakeFrames(
  frameCount: number,
  fps: number,
  rootGroupUuid?: string
): BakeResult {
  const frames: BakedFrame[] = [];
  const outOfBounds: OutOfBoundsHit[] = [];

  const originalTime = Timeline.time;
  const originalAnimation = Animation.selected;
  const playingStates = Animation.all.map((animation) => ({
    animation,
    playing: animation.playing,
  }));
  const originalSaved = Project?.saved;
  const keyframesBefore = countKeyframes();
  const originalModeId = Modes.selected.id;
  const displaySnapshot = snapshotCompiledDisplay();

  try {
    // Interpolation returns no vectors outside animation mode, so baking must switch explicitly.
    Modes.options.animate?.select();
    originalAnimation?.select();

    for (let frame = 0; frame < frameCount; frame++) {
      Timeline.setTime(frame / fps);
      Animator.preview();

      const token = Undo.initEdit({
        elements: Outliner.elements.slice(),
        groups: Group.all.slice(),
        outliner: true,
        // Required: Group.resolve() deletes groups whose animators own the keyframes.
        animations: Animation.all.slice(),
      });

      try {
        restrictExportToRoot(rootGroupUuid);
        const animatableElements = Outliner.elements.filter(
          (element) => element.constructor.animator
        );
        for (const node of [...Group.all, ...animatableElements]) {
          applyAnimatedOffsets(node);
        }
        flattenHierarchy();

        const json = applyCompiledDisplaySnapshot(
          resolveJavaBlockCodec().compile({ prevent_dialog: true }),
          displaySnapshot
        );
        frames.push({ frame, json });
        outOfBounds.push(...collectOutOfBounds(frame, json));
      } finally {
        // Cancel only the transaction opened by this function.
        if (Undo.current_save === token) {
          Undo.cancelEdit(true);
        }
      }
    }
  } finally {
    Timeline.setTime(originalTime);
    for (const state of playingStates) {
      state.animation.playing = state.playing;
    }
    originalAnimation?.select();
    Modes.options[originalModeId]?.select();
    Animator.preview();
    if (Project && originalSaved !== undefined) {
      Project.saved = originalSaved;
    }

    // Group counts alone cannot prove rollback integrity; keyframes must be checked directly.
    const keyframesAfter = countKeyframes();
    if (keyframesAfter !== keyframesBefore) {
      const lost = keyframesBefore - keyframesAfter;
      console.error(
        `Bake rollback incomplete: ${keyframesBefore} keyframes before, ${keyframesAfter} after (lost ${lost})`
      );
      Blockbench.showMessageBox({
        title: tr("dap.rollback.title"),
        message: tr("dap.rollback.message", {
          before: keyframesBefore,
          after: keyframesAfter,
          lost,
        }),
        icon: "error",
      });
    }
  }

  return { frames, outOfBounds };
}

/** Calculates frame count for a duration and FPS, including both endpoints. */
export function frameCountFor(length: number, fps: number): number {
  return Math.floor(length * fps) + 1;
}
