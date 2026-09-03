import {
  applyCompiledDisplaySnapshot,
  cloneCompiledDisplay,
  type CompiledDisplay,
} from "./display-snapshot";
import { tr } from "./i18n";
import { resolveJavaBlockCodec } from "./java-block-codec";
import { assertBoundsTaskActive, type BoundsTaskControl, yieldBoundsTask } from "./bounds-task";

/**
 * 把骨骼动画烘焙为扁平 Java 方块模型。变换累加与 Blockbench 烘焙动作一致，并由
 * Group.resolve() 展平层级。每帧都在随即取消的 Undo 事务中执行，以保护工程数据和历史。
 * `animations` 快照不可省略，因为关键帧属于 Group 动画器。
 */

/** 超出 Minecraft 模型限制的方块坐标。 */
export interface OutOfBoundsHit {
  frame: number;
  elementIndex: number;
  elementName: string;
  axis: "x" | "y" | "z";
  field: "from" | "to";
  value: number;
  /** 尽可能映射回层级展平前的大纲元素。 */
  sourceElementUuid?: string;
  /** 从近到远的源父 Group，用于查找产生影响的关键帧。 */
  sourceGroupUuids?: string[];
}

export interface BakedFrame {
  frame: number;
  /** Blockbench codec 生成的 Java 模型 JSON。 */
  json: string;
}

export interface BakeResult {
  frames: BakedFrame[];
  outOfBounds: OutOfBoundsHit[];
}

export interface BakedAnimationSequence extends BakeResult {
  sourceUuid: string;
  sourceName: string;
  key: string;
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

/** 从内置 java_block 格式核实的 Minecraft Java 模型坐标限制。 */
const COORDINATE_MIN = -16;
const COORDINATE_MAX = 32;

const AXIS_NAMES: Array<"x" | "y" | "z"> = ["x", "y", "z"];

/** 把当前时间轴位置的动画偏移累加到静态节点数据。 */
function applyAnimatedOffsets(node: OutlinerNodeLike, animation: Animation): void {
  const offsetRotation: [number, number, number] = [0, 0, 0];
  const offsetPosition: [number, number, number] = [0, 0, 0];

  const animator = animation.getBoneAnimator(node);
  if (!animator || !(node instanceof Group)) return;

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

  if (node.getTypeBehavior("rotatable") && node.rotation) {
    node.rotation[0] += offsetRotation[0];
    node.rotation[1] += offsetRotation[1];
    node.rotation[2] += offsetRotation[2];
  }

  applyPositionOffset(node, offsetPosition);
}

/** 平移节点子树中的全部坐标。 */
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

/** 反复解析顶层 Group，直到整个层级完全展平。 */
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

/** 临时排除所选顶层 Group 之外的元素；相关标记由 Undo 恢复。 */
function restrictExportToRoot(rootGroupUuid?: string): void {
  if (!rootGroupUuid) return;
  for (const element of Outliner.elements) {
    if (!belongsToRoot(element, rootGroupUuid)) {
      element.export = false;
    }
  }
}

/** 扫描编译帧中超出 Minecraft 限制的坐标。 */
function collectOutOfBounds(
  frame: number,
  json: string,
  sources: Array<{ elementUuid: string; groupUuids: string[] }>
): OutOfBoundsHit[] {
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
          sourceElementUuid: sources[elementIndex]?.elementUuid,
          sourceGroupUuids: sources[elementIndex]?.groupUuids,
        });
      });
    }
  });
  return hits;
}

/** 用作回滚完整性防线的关键帧总数。 */
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

function modelStructureSignature(): string {
  const elements = Outliner.elements.map((element) => element.uuid).sort();
  const groups = Group.all.map((group) => group.uuid).sort();
  return `${elements.join(",")}|${groups.join(",")}`;
}

function safelyCancelBakeEdit(token: unknown): void {
  if (Undo.current_save !== token) {
    throw new Error("Blockbench changed the active edit while restoring a baked frame.");
  }
  const previewDescriptor = Object.getOwnPropertyDescriptor(Animator, "preview");
  if (!previewDescriptor?.configurable) {
    throw new Error("Blockbench does not allow a safe animation-preview restore in this version.");
  }
  try {
    Object.defineProperty(Animator, "preview", {
      configurable: true,
      value: () => {},
    });
    Undo.cancelEdit(true);
  } finally {
    Object.defineProperty(Animator, "preview", previewDescriptor);
  }
  if (Undo.current_save) {
    throw new Error("Blockbench did not finish restoring the baked frame.");
  }
}

/**
 * 按指定 FPS 烘焙 `frameCount` 帧，并在结束后恢复时间轴、选择、播放、模型数据和 Undo 历史。
 */
function* bakeFrameSteps(
  animation: Animation,
  frameCount: number,
  fps: number,
  rootGroupUuid?: string,
  collectBounds = true
): Generator<{ frame: number; total: number }, BakeResult, void> {
  if (Undo.current_save) {
    throw new Error(tr("dap.bake.active_edit"));
  }
  const frames: BakedFrame[] = [];
  const outOfBounds: OutOfBoundsHit[] = [];

  const originalTime = Timeline.time;
  const sourceAnimationUuid = animation.uuid;
  const originalAnimationUuid = Animation.selected?.uuid;
  const playingStates = Animation.all.map((animation) => ({
    uuid: animation.uuid,
    playing: animation.playing,
  }));
  const originalSaved = Project?.saved;
  const keyframesBefore = countKeyframes();
  const structureBefore = modelStructureSignature();
  const originalModeId = Modes.selected.id;
  const displaySnapshot = snapshotCompiledDisplay();
  const sourceGroups = new Map<string, string[]>();
  if (collectBounds) {
    for (const element of Outliner.elements) {
      const groupUuids: string[] = [];
      let parent = element.parent;
      while (parent && parent !== "root") {
        if (parent instanceof Group) groupUuids.push(parent.uuid);
        parent = parent.parent;
      }
      sourceGroups.set(element.uuid, groupUuids);
    }
  }

  try {
    // Interpolation returns no vectors outside animation mode, so baking must switch explicitly.
    Modes.options.animate?.select();
    for (const state of playingStates) {
      const current = Animation.all.find((item) => item.uuid === state.uuid);
      if (current) current.playing = false;
    }
    const initialTarget = Animation.all.find((item) => item.uuid === sourceAnimationUuid);
    if (!initialTarget) throw new Error(`Animation ${sourceAnimationUuid} is no longer available.`);
    initialTarget.select();
    initialTarget.playing = true;

    for (let frame = 0; frame < frameCount; frame++) {
      const targetAnimation = Animation.all.find((item) => item.uuid === sourceAnimationUuid);
      if (!targetAnimation) throw new Error(`Animation ${sourceAnimationUuid} disappeared during baking.`);
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
          applyAnimatedOffsets(node, targetAnimation);
        }
        flattenHierarchy();

        const compiledSources = collectBounds
          ? Outliner.elements
              .filter((element) => element.export !== false)
              .map((element) => ({
                elementUuid: element.uuid,
                groupUuids: sourceGroups.get(element.uuid) ?? [],
              }))
          : [];

        const json = applyCompiledDisplaySnapshot(
          resolveJavaBlockCodec().compile({ prevent_dialog: true }),
          displaySnapshot
        );
        frames.push({ frame, json });
        if (collectBounds) {
          outOfBounds.push(...collectOutOfBounds(frame, json, compiledSources));
        }
      } finally {
        safelyCancelBakeEdit(token);
        if (modelStructureSignature() !== structureBefore) {
          throw new Error("Blockbench did not restore the model hierarchy after checking a frame.");
        }
      }
      yield { frame: frame + 1, total: frameCount };
    }
  } finally {
    for (const item of Animation.all) item.selected = false;
    const originalAnimation = originalAnimationUuid
      ? Animation.all.find((item) => item.uuid === originalAnimationUuid) ?? null
      : null;
    Animation.selected = originalAnimation;
    if (originalAnimation) originalAnimation.selected = true;
    for (const state of playingStates) {
      const current = Animation.all.find((item) => item.uuid === state.uuid);
      if (current) current.playing = state.playing;
    }
    Modes.options[originalModeId]?.select();
    Timeline.setTime(originalTime);
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
    if (modelStructureSignature() !== structureBefore) {
      console.error("Bake rollback incomplete: model hierarchy changed during baking");
    }
  }

  return { frames, outOfBounds };
}

export function bakeFrames(
  animation: Animation,
  frameCount: number,
  fps: number,
  rootGroupUuid?: string
): BakeResult {
  const generator = bakeFrameSteps(animation, frameCount, fps, rootGroupUuid);
  while (true) {
    const step = generator.next();
    if (step.done) return step.value;
  }
}

/** 供可取消隔离范围检测使用的异步逐帧烘焙。 */
export async function bakeFramesAsync(
  animation: Animation,
  frameCount: number,
  fps: number,
  control: BoundsTaskControl,
  onFrame?: (frame: number, total: number) => void,
  rootGroupUuid?: string,
  collectBounds = true
): Promise<BakeResult> {
  const generator = bakeFrameSteps(animation, frameCount, fps, rootGroupUuid, collectBounds);
  let completed = false;
  try {
    while (true) {
      assertBoundsTaskActive(control);
      const step = generator.next();
      if (step.done) {
        completed = true;
        return step.value;
      }
      onFrame?.(step.value.frame, step.value.total);
      await yieldBoundsTask();
    }
  } finally {
    if (!completed) generator.return({ frames: [], outOfBounds: [] });
  }
}

export function bakeAnimationSequence(
  animation: Animation,
  key: string,
  frameCount: number,
  fps: number
): BakedAnimationSequence {
  const result = bakeFrames(animation, frameCount, fps);
  return {
    sourceUuid: animation.uuid,
    sourceName: animation.name,
    key,
    ...result,
  };
}

/** 根据时长和 FPS 计算包含首尾端点的帧数。 */
export function frameCountFor(length: number, fps: number): number {
  return Math.floor(length * fps) + 1;
}
