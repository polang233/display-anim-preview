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

const OUTPUT_MODE_KEYS = {
  both_default: "dap.export.mode.both_default",
  both_separate: "dap.export.mode.both_separate",
  resource_only: "dap.export.mode.resource_only",
  datapack_only: "dap.export.mode.datapack_only",
} as const;

type OutputMode = keyof typeof OUTPUT_MODE_KEYS;

function outputModes(): Record<OutputMode, string> {
  return Object.fromEntries(
    Object.entries(OUTPUT_MODE_KEYS).map(([id, key]) => [id, tr(key)])
  ) as Record<OutputMode, string>;
}

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
  return tr("dap.export.texture_mismatch", {
    project_width: Project.texture_width,
    project_height: Project.texture_height,
    textures: list,
  });
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
      buttons: [tr("dap.export.cancel_export"), tr("dap.export.export_anyway")],
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
      tr("dap.export.pick_shared", { pack: packName })
    );
    if (!root) return null;
    return [
      {
        label: tr("dap.export.resource_pack"),
        scopeRoot: root,
        targetRoot: `${root}/resource-packs/${packName}`,
        kind: "resource",
      },
      {
        label: tr("dap.export.datapack"),
        scopeRoot: root,
        targetRoot: `${root}/datapacks/${packName}`,
        kind: "datapack",
      },
    ];
  }

  if (mode === "both_separate") {
    const resourceParent = pickParent(
      "display_anim_export_resource_parent",
      tr("dap.export.pick_resource", { pack: packName })
    );
    if (!resourceParent) return null;
    const datapackParent = pickParent(
      "display_anim_export_datapack_parent",
      tr("dap.export.pick_datapack", { pack: packName })
    );
    if (!datapackParent) return null;
    return [
      {
        label: tr("dap.export.resource_pack"),
        scopeRoot: resourceParent,
        targetRoot: `${resourceParent}/${packName}`,
        kind: "resource",
      },
      {
        label: tr("dap.export.datapack"),
        scopeRoot: datapackParent,
        targetRoot: `${datapackParent}/${packName}`,
        kind: "datapack",
      },
    ];
  }

  if (mode === "resource_only") {
    const parent = pickParent(
      "display_anim_export_resource_parent",
      tr("dap.export.pick_resource", { pack: packName })
    );
    return parent
      ? [{ label: tr("dap.export.resource_pack"), scopeRoot: parent, targetRoot: `${parent}/${packName}`, kind: "resource" }]
      : null;
  }

  const parent = pickParent(
    "display_anim_export_datapack_parent",
    tr("dap.export.pick_datapack", { pack: packName })
  );
  return parent
    ? [{ label: tr("dap.export.datapack"), scopeRoot: parent, targetRoot: `${parent}/${packName}`, kind: "datapack" }]
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
      tr("dap.export.baking", { frames: exportedFrameCount, fps }),
      2000
    );
    const result = bakeFrames(exportedFrameCount, fps);
    frames = result.frames;
    outOfBounds = result.outOfBounds;

    if (!frames.length) {
      Blockbench.showMessageBox({
        title: tr("dap.export.failed"),
        message: tr("dap.export.no_frames"),
        icon: "error",
      });
      return;
    }

    if (sourceFps !== GAME_FPS) {
      warnings.push({
        title: tr("dap.export.resampled_title"),
        message: tr("dap.export.resampled_message", {
          source_fps: sourceFps,
          game_fps: GAME_FPS,
          frames: frameCount,
        }),
      });
    }
    const textureSizeWarning = describeTextureSizeMismatch();
    if (textureSizeWarning) {
      warnings.push({ title: tr("dap.export.texture_mismatch_title"), message: textureSizeWarning });
    }
    const boundsWarning = describeOutOfBounds(outOfBounds);
    if (boundsWarning) {
      warnings.push({ title: tr("dap.export.bounds_title"), message: boundsWarning });
    }
  }

  const proceed = (): void => {
    const resourceOptions: PackOptions = {
      packName,
      namespace: assetNamespace,
      itemModel,
      description: tr("dap.export.resource_description", {
        name: displayName,
        frames: exportedFrameCount,
        fps,
      }),
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
      description: tr("dap.export.datapack_description", {
        name: displayName,
        frames: exportedFrameCount,
      }),
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
            ? `\n\n${tr("dap.export.optimization", {
                sampled: packReport.sampledFrames,
                unique: packReport.uniqueModels,
                duplicates: packReport.duplicateFrames,
                before: formatBytes(packReport.modelBytesBefore),
                after: formatBytes(packReport.modelBytesAfter),
              })}` +
              (packReport.omittedUntexturedFaces
                ? `\n${tr("dap.export.omitted", {
                    faces: packReport.omittedUntexturedFaces,
                    elements: packReport.omittedEmptyElements,
                  })}`
                : "")
            : "";
          const commands = includesDatapack(mode)
            ? `\n\n${tr("dap.export.commands")}\n/function ${dataNamespace}:give\n/function ${dataNamespace}:play_loop`
            : "";
          Blockbench.showMessageBox({
            title: tr("dap.export.complete"),
            message: `${tr("dap.export.locations", { count, locations })}${optimization}${commands}`,
            icon: "check_circle",
          });
        } catch (err) {
          console.error("Export failed", err);
          Blockbench.showMessageBox({
            title: tr("dap.export.failed"),
            message: tr("dap.export.write_error", {
              error: (err as Error).message ?? String(err),
            }),
            icon: "error",
          });
        }
      };

      if (!existing.length) {
        write();
        return;
      }
      const summary = existing
        .map(
          ({ destination, count }) =>
            `${destination.targetRoot}/ (${tr("dap.export.file_count", { count: count ?? 0 })})`
        )
        .join("\n");
      Blockbench.showMessageBox(
        {
          title: tr("dap.export.target_exists"),
          message: tr("dap.export.target_exists_message", { summary }),
          icon: "warning",
          buttons: [tr("dap.export.cancel"), tr("dap.export.overwrite")],
          confirm: 1,
          cancel: 0,
        },
        (button) => {
          if (button === 1) write();
        }
      );
    } catch (err) {
      Blockbench.showMessageBox({
        title: tr("dap.export.prepare_failed"),
        message: (err as Error).message ?? String(err),
        icon: "error",
      });
    }
  };

  confirmWarnings(warnings, proceed);
}

export function openExportDialog(): void {
  if (exportInProgress) {
    Blockbench.showQuickMessage(tr("dap.export.busy"), 2000);
    return;
  }
  const animation = Animation.selected ?? Animation.all[0];
  if (!animation) {
    Blockbench.showMessageBox({
      title: tr("dap.export.no_animation_title"),
      message: tr("dap.export.no_animation_message"),
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
      ? tr("dap.export.fps_exact", { frames: gameFrameCount })
      : tr("dap.export.fps_resample", {
          source_fps: fps,
          source_frames: frameCount,
          game_fps: GAME_FPS,
          game_frames: gameFrameCount,
        });
  const helpText = tr("dap.export.folder_help");

  new Dialog<FormResult>(DIALOG_ID, {
    title: tr("dap.export.title"),
    form: {
      info: { type: "info", text: subtleInfo(fpsText), full_width: true },
      help: { type: "info", text: subtleInfo(helpText), full_width: true },
      output_mode: {
        label: tr("dap.export.output"),
        type: "select",
        value: "both_default",
        options: outputModes(),
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
