/** Export dialog and orchestration for resource-pack and datapack generation. */

import { bakeFrames, frameCountFor, type BakedFrame } from "./bake";
import { describeOutOfBounds } from "./bounds-report";
import {
  buildResourcePack,
  type PackOptions,
  type PackBuildReport,
} from "./resource-pack";
import { buildDatapack, type DatapackOptions } from "./datapack";
import { writePacks, inspectExisting, type WriteTarget } from "./file-writer";
import { VANILLA_ITEM_IDS } from "./vanilla-items";
import { configuredDisplayAnimations } from "./display-animation-settings";
import { tr } from "./i18n";

const DIALOG_ID = "display_anim_preview_export";

const OUTPUT_MODES = {
  both_default: "Resource Pack + Datapack (Shared Root)",
  both_separate: "Resource Pack + Datapack (Separate Parents)",
  resource_only: "Resource Pack Only",
  datapack_only: "Datapack Only",
};

type OutputMode = keyof typeof OUTPUT_MODES;

interface FormResult {
  pack_name: string;
  asset_namespace: string;
  item_model: string;
  base_item: string;
  display_name: string;
  data_namespace: string;
  frame_objective: string;
  mode_objective: string;
  playing_tag: string;
  output_mode: OutputMode;
}

interface Destination {
  label: string;
  scopeRoot: string;
  targetRoot: string;
  kind: "resource" | "datapack";
}

let exportInProgress = false;
const GAME_FPS = 20;
const VANILLA_ITEM_OPTIONS = Object.fromEntries(
  VANILLA_ITEM_IDS.map((id) => [`minecraft:${id}`, `minecraft:${id}`])
);

function sanitizeId(value: string, fallback: string): string {
  const safe = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return safe || fallback;
}

function sanitizeObjective(value: string, fallback: string): string {
  return sanitizeId(value, fallback).slice(0, 16);
}

function normalizeItemId(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "minecraft:potion";
  return trimmed.includes(":") ? trimmed : `minecraft:${trimmed}`;
}

function includesResource(mode: OutputMode): boolean {
  return mode !== "datapack_only";
}

function includesDatapack(mode: OutputMode): boolean {
  return mode !== "resource_only";
}

function subtleInfo(text: string): string {
  return `<span style="color:var(--color-subtle_text);font-size:11px;font-weight:400;line-height:1.45;display:block">${text}</span>`;
}

function describeTextureSizeMismatch(): string | null {
  if (!Project) return null;
  const mismatched = Texture.all.filter(
    (texture) =>
      texture.width !== Project.texture_width || texture.height !== Project.texture_height
  );
  if (!mismatched.length) return null;

  const list = mismatched
    .map((texture) => `  ${texture.name}: ${texture.width}×${texture.height}`)
    .join("\n");
  return (
    `Project UV resolution is ${Project.texture_width}×${Project.texture_height}, but these textures use different dimensions:\n\n` +
    `${list}\n\nExported UVs may be offset. Update File → Project Settings before exporting.`
  );
}

function confirmWarnings(
  warnings: Array<{ title: string; message: string }>,
  onProceed: () => void
): void {
  const [current, ...rest] = warnings;
  if (!current) {
    onProceed();
    return;
  }
  Blockbench.showMessageBox(
    {
      title: current.title,
      message: current.message,
      icon: "warning",
      buttons: ["Cancel Export", "Export Anyway"],
      confirm: 1,
      cancel: 0,
    },
    (button) => {
      if (button === 1) confirmWarnings(rest, onProceed);
    }
  );
}

function pickParent(resourceId: string, title: string): string | null {
  return (
    Blockbench.pickDirectory({
      resource_id: resourceId,
      title,
    }) ?? null
  );
}

/** On macOS, Open selects the existing parent; the plugin creates `<packName>/` below it. */
function chooseDestinations(mode: OutputMode, packName: string): Destination[] | null {
  if (mode === "both_default") {
    const root = pickParent(
      "display_anim_export",
      `Select export root (creates resource-packs/${packName}/ and datapacks/${packName}/)`
    );
    if (!root) return null;
    return [
      {
        label: "Resource Pack",
        scopeRoot: root,
        targetRoot: `${root}/resource-packs/${packName}`,
        kind: "resource",
      },
      {
        label: "Datapack",
        scopeRoot: root,
        targetRoot: `${root}/datapacks/${packName}`,
        kind: "datapack",
      },
    ];
  }

  if (mode === "both_separate") {
    const resourceParent = pickParent(
      "display_anim_export_resource_parent",
      `Select resource-pack parent folder (creates ${packName}/)`
    );
    if (!resourceParent) return null;
    const datapackParent = pickParent(
      "display_anim_export_datapack_parent",
      `Select datapack parent folder (creates ${packName}/)`
    );
    if (!datapackParent) return null;
    return [
      {
        label: "Resource Pack",
        scopeRoot: resourceParent,
        targetRoot: `${resourceParent}/${packName}`,
        kind: "resource",
      },
      {
        label: "Datapack",
        scopeRoot: datapackParent,
        targetRoot: `${datapackParent}/${packName}`,
        kind: "datapack",
      },
    ];
  }

  if (mode === "resource_only") {
    const parent = pickParent(
      "display_anim_export_resource_parent",
      `Select resource-pack parent folder (creates ${packName}/)`
    );
    return parent
      ? [{ label: "Resource Pack", scopeRoot: parent, targetRoot: `${parent}/${packName}`, kind: "resource" }]
      : null;
  }

  const parent = pickParent(
    "display_anim_export_datapack_parent",
    `Select datapack parent folder (creates ${packName}/)`
  );
  return parent
    ? [{ label: "Datapack", scopeRoot: parent, targetRoot: `${parent}/${packName}`, kind: "datapack" }]
    : null;
}

function writeDestinations(destinations: Destination[], targets: WriteTarget[]): number {
  const grouped = new Map<string, WriteTarget[]>();
  destinations.forEach((destination, index) => {
    const list = grouped.get(destination.scopeRoot) ?? [];
    list.push(targets[index]);
    grouped.set(destination.scopeRoot, list);
  });

  let count = 0;
  for (const [scopeRoot, scopedTargets] of grouped) {
    count += writePacks(scopeRoot, scopedTargets);
  }
  return count;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function runExport(form: FormResult, animation: Animation): void {
  const mode = form.output_mode || "both_default";
  const sourceFps = animation.snapping || GAME_FPS;
  const fps = GAME_FPS;
  const frameCount = frameCountFor(animation.length, fps);
  const packName = sanitizeId(form.pack_name, "display_animation");
  const assetNamespace = sanitizeId(form.asset_namespace, "kaleidoscope_lab");
  const itemModel = sanitizeId(form.item_model, "item");
  const dataNamespace = sanitizeId(form.data_namespace, packName);
  const displayName = form.display_name.trim() || animation.name;

  const destinations = chooseDestinations(mode, packName);
  if (!destinations) return;

  let frames: BakedFrame[] = [];
  let displayContexts: PackOptions["displayContexts"];
  let exportedFrameCount = frameCount;
  let outOfBounds = [] as ReturnType<typeof bakeFrames>["outOfBounds"];
  const warnings: Array<{ title: string; message: string }> = [];

  if (includesResource(mode)) {
    displayContexts = configuredDisplayAnimations().map(
      ({ context, animated }) => ({
        context: context.id,
        animated,
      })
    );
    exportedFrameCount = displayContexts.some((route) => route.animated)
      ? frameCount
      : 1;
    Blockbench.showQuickMessage(
      `Baking ${exportedFrameCount} frames at ${fps} FPS…`,
      2000
    );
    const result = bakeFrames(exportedFrameCount, fps);
    frames = result.frames;
    outOfBounds = result.outOfBounds;

    if (!frames.length) {
      Blockbench.showMessageBox({
        title: "Export Failed",
        message: "No frames were baked. Make sure the animation contains keyframes.",
        icon: "error",
      });
      return;
    }

    if (sourceFps !== GAME_FPS) {
      warnings.push({
        title: "Resampled to the Game Frame Rate",
        message:
          `The animation snapping rate is ${sourceFps} FPS, while Minecraft displays at most ${GAME_FPS} frames per second.` +
          `\n\nThis export will use ${frameCount} frames at ${GAME_FPS} FPS to preserve its duration.`,
      });
    }
    const textureSizeWarning = describeTextureSizeMismatch();
    if (textureSizeWarning) {
      warnings.push({ title: "Texture Resolution Mismatch", message: textureSizeWarning });
    }
    const boundsWarning = describeOutOfBounds(outOfBounds);
    if (boundsWarning) {
      warnings.push({ title: "Some Frames Exceed Model Bounds", message: boundsWarning });
    }
  }

  const proceed = (): void => {
    const resourceOptions: PackOptions = {
      packName,
      namespace: assetNamespace,
      itemModel,
      description: `${displayName} (${exportedFrameCount} frames @ ${fps} FPS)`,
      displayContexts,
    };
    const datapackOptions: DatapackOptions = {
      packName,
      dataNamespace,
      assetNamespace,
      itemModel,
      baseItem: normalizeItemId(form.base_item),
      itemDisplayName: displayName,
      frameObjective: sanitizeObjective(form.frame_objective, "dap_frame"),
      modeObjective: sanitizeObjective(form.mode_objective, "dap_mode"),
      playingTag: sanitizeId(form.playing_tag, "dap_playing"),
      frameCount: exportedFrameCount,
      description: `Frame animation driver for ${displayName} (${exportedFrameCount} frames)`,
    };

    try {
      let packReport: PackBuildReport | null = null;
      const resourceBuild = includesResource(mode)
        ? buildResourcePack(frames, resourceOptions)
        : null;
      if (resourceBuild) packReport = resourceBuild.report;

      const targets: WriteTarget[] = destinations.map((destination) => ({
        root: destination.targetRoot,
        files:
          destination.kind === "resource"
            ? resourceBuild!.files
            : buildDatapack(datapackOptions),
      }));

      const existing = destinations
        .map((destination) => ({
          destination,
          count: inspectExisting(destination.scopeRoot, destination.targetRoot),
        }))
        .filter((entry) => entry.count !== null);

      const write = (): void => {
        try {
          const count = writeDestinations(destinations, targets);
          const locations = destinations
            .map((destination) => `${destination.label}：${destination.targetRoot}/`)
            .join("\n");
          const optimization = packReport
            ? `\n\nSpace optimization: sampled ${packReport.sampledFrames} frames, wrote ${packReport.uniqueModels} unique models, ` +
              `and deduplicated ${packReport.duplicateFrames} frames.\nModel JSON: ` +
              `${formatBytes(packReport.modelBytesBefore)} → ${formatBytes(packReport.modelBytesAfter)}。` +
              (packReport.omittedUntexturedFaces
                ? `\nOmitted ${packReport.omittedUntexturedFaces} untextured faces and removed ` +
                  `${packReport.omittedEmptyElements} elements without visible faces.`
                : "")
            : "";
          const commands = includesDatapack(mode)
            ? `\n\nIn-game commands:\n/function ${dataNamespace}:give\n/function ${dataNamespace}:play_loop`
            : "";
          Blockbench.showMessageBox({
            title: "Export Complete",
            message: `Verified and wrote ${count} files.\n\n${locations}${optimization}${commands}`,
            icon: "check_circle",
          });
        } catch (err) {
          console.error("Export failed", err);
          Blockbench.showMessageBox({
            title: "Export Failed",
            message: `An error occurred while writing files:\n${(err as Error).message ?? String(err)}`,
            icon: "error",
          });
        }
      };

      if (!existing.length) {
        write();
        return;
      }
      const summary = existing
        .map(({ destination, count }) => `${destination.targetRoot}/ (${count} files)`)
        .join("\n");
      Blockbench.showMessageBox(
        {
          title: "Target Pack Already Exists",
          message: `Continuing overwrites matching files but does not delete other files:\n\n${summary}`,
          icon: "warning",
          buttons: ["Cancel", "Overwrite and Export"],
          confirm: 1,
          cancel: 0,
        },
        (button) => {
          if (button === 1) write();
        }
      );
    } catch (err) {
      Blockbench.showMessageBox({
        title: "Export Preparation Failed",
        message: (err as Error).message ?? String(err),
        icon: "error",
      });
    }
  };

  confirmWarnings(warnings, proceed);
}

export function openExportDialog(): void {
  if (exportInProgress) {
    Blockbench.showQuickMessage("The previous export is still running", 2000);
    return;
  }
  const animation = Animation.selected ?? Animation.all[0];
  if (!animation) {
    Blockbench.showMessageBox({
      title: "No Animation to Export",
      message: "Create an animation with keyframes before exporting.",
      icon: "error",
    });
    return;
  }

  const fps = animation.snapping || GAME_FPS;
  const frameCount = frameCountFor(animation.length, fps);
  const gameFrameCount = frameCountFor(animation.length, GAME_FPS);
  const defaultPackName = sanitizeId(animation.name, "display_animation");
  const defaultItemModel = sanitizeId(Project?.name ?? "", defaultPackName);
  const fpsText =
    fps === GAME_FPS
      ? `Exports ${gameFrameCount} frames at 20 FPS, one frame per game tick.`
      : `The current snapping rate is ${fps} FPS (${frameCount} source samples). Export resamples to ` +
        `${GAME_FPS} FPS (${gameFrameCount} frames) while preserving duration.`;
  const helpText =
    "On macOS, Open selects a parent folder; the plugin then creates <pack name>/ inside it.<br>" +
    "The default mode creates resource-packs/<pack name>/ and datapacks/<pack name>/.";

  new Dialog<FormResult>(DIALOG_ID, {
    title: tr("dap.export.title"),
    form: {
      info: { type: "info", text: subtleInfo(fpsText), full_width: true },
      help: { type: "info", text: subtleInfo(helpText), full_width: true },
      output_mode: {
        label: tr("dap.export.output"),
        type: "select",
        value: "both_default",
        options: OUTPUT_MODES,
      },
      pack_name: { label: tr("dap.export.pack_name"), type: "text", value: defaultPackName },
      asset_namespace: { label: tr("dap.export.asset_namespace"), type: "text", value: "kaleidoscope_lab" },
      item_model: { label: tr("dap.export.item_model"), type: "text", value: defaultItemModel },
      base_item: {
        label: tr("dap.export.base_item"),
        type: "select",
        value: "minecraft:potion",
        options: VANILLA_ITEM_OPTIONS,
      },
      display_name: { label: tr("dap.export.display_name"), type: "text", value: animation.name },
      data_namespace: { label: tr("dap.export.data_namespace"), type: "text", value: defaultPackName },
      frame_objective: { label: tr("dap.export.frame_objective"), type: "text", value: "dap_frame" },
      mode_objective: { label: tr("dap.export.mode_objective"), type: "text", value: "dap_mode" },
      playing_tag: { label: tr("dap.export.playing_tag"), type: "text", value: "dap_playing" },
    },
    onConfirm(result) {
      exportInProgress = true;
      try {
        runExport(result, animation);
      } finally {
        exportInProgress = false;
      }
    },
  }).show();
}
