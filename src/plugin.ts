import { openControlPanel, disposeControlPanel } from "./control-panel";
import { enterDisplaySlot, currentSlot } from "./slot-controller";
import { bakeFrames, frameCountFor } from "./bake";
import { describeOutOfBounds } from "./bounds-report";
import { openExportDialog } from "./export-dialog";
import {
  registerModelFormat,
  unregisterModelFormat,
  FORMAT_ID,
} from "./format";
import { registerTranslations, tr } from "./i18n";
import { initializePlaybackSync, disposePlaybackSync } from "./playback";
import {
  registerDisplayAnimationProperty,
  unregisterDisplayAnimationProperty,
} from "./display-animation-settings";

const OPEN_ACTION_ID = "display_anim_preview_open_action";
const CHECK_BOUNDS_ACTION_ID = "display_anim_preview_check_bounds";
const EXPORT_ACTION_ID = "display_anim_preview_export_packs";

let openAction: Action | null = null;
let checkBoundsAction: Action | null = null;
let exportAction: Action | null = null;

/** Uses the export baking path so the bounds report matches exported models. */
function checkAnimationBounds(): void {
  const animation = Animation.selected ?? Animation.all[0];
  if (!animation) {
    Blockbench.showQuickMessage("No animation is available to check", 2000);
    return;
  }

  const fps = animation.snapping || 20;
  const frameCount = frameCountFor(animation.length, fps);
  const { frames, outOfBounds } = bakeFrames(frameCount, fps);
  const description = describeOutOfBounds(outOfBounds);

  if (!description) {
    Blockbench.showMessageBox({
      title: "Model Bounds Check Passed",
      message: `Checked ${frames.length} frames at ${fps} FPS. All coordinates are within -16 to 32.`,
      icon: "check_circle",
    });
    return;
  }

  Blockbench.showMessageBox({
    title: "Some Frames Exceed Model Bounds",
    message: description,
    icon: "warning",
  });
}

Plugin.register("display_anim_preview", {
  title: "Java Display Animator",
  author: "rieyi",
  description:
    "Preview frame-baked Minecraft Java item animations per display context and export complete " +
    "resource packs and animation-driving datapacks.",
  icon: "icon.png",
  tags: ["Minecraft: Java Edition", "Animation", "Exporter"],
  version: "1.0.0",
  min_version: "5.1.5",
  variant: "desktop",
  creation_date: "2026-08-03",
  has_changelog: true,
  repository: "https://github.com/rieyi/display-anim-preview",
  bug_tracker: "https://github.com/rieyi/display-anim-preview/issues",
  await_loading: true,
  contributes: {
    formats: [FORMAT_ID],
  },
  onload() {
    registerTranslations();
    registerDisplayAnimationProperty();
    registerModelFormat();
    initializePlaybackSync();

    openAction = new Action(OPEN_ACTION_ID, {
      name: tr("dap.action.open"),
      description: tr("dap.action.open_desc"),
      icon: "movie",
      category: "animation",
      click() {
        openControlPanel();
        enterDisplaySlot(currentSlot());
      },
    });
    checkBoundsAction = new Action(CHECK_BOUNDS_ACTION_ID, {
      name: tr("dap.action.bounds"),
      description: tr("dap.action.bounds_desc"),
      icon: "settings_overscan",
      category: "animation",
      click: checkAnimationBounds,
    });
    exportAction = new Action(EXPORT_ACTION_ID, {
      name: tr("dap.action.export"),
      description: tr("dap.action.export_desc"),
      icon: "inventory_2",
      category: "animation",
      click: openExportDialog,
    });
    for (const action of [openAction, checkBoundsAction, exportAction]) {
      for (const path of ["filter", "tools"]) {
        try {
          MenuBar.addAction(action, path);
        } catch (err) {
          console.warn(`Menu path "${path}" not available, skipping`, err);
        }
      }
    }
  },
  onunload() {
    disposeControlPanel();
    disposePlaybackSync();
    openAction?.delete();
    openAction = null;
    checkBoundsAction?.delete();
    checkBoundsAction = null;
    exportAction?.delete();
    exportAction = null;
    unregisterModelFormat();
    unregisterDisplayAnimationProperty();
  },
});
