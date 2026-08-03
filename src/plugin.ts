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
import { isChineseOnlyBuild, registerTranslations, tr } from "./i18n";
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

const ABOUT_EN = `Java Display Animator creates frame-baked Minecraft Java item animations directly in Blockbench.

## Features

- Preview one animation across GUI, first-person, third-person, ground, head, item-frame, embedded, and shelf display contexts.
- Enable or disable animation independently for each display context.
- Use Blockbench's official timeline for synchronized playback and scrubbing.
- Bake at Minecraft's 20 FPS game rate and deduplicate identical model frames.
- Export a complete resource pack and animation-driving datapack.
- Check model bounds, texture resolution, missing texture references, and particle textures before export.

## Quick Start

1. Create or open a **Java Display Animation** project.
2. Build and animate the model in Blockbench's Animation mode.
3. Configure item transforms in Display mode.
4. Open **Display Animation Preview** and choose which display contexts animate.
5. Run **Export Resource Pack and Datapack**.

Requires Blockbench Desktop 5.1.5 or newer. Generated packs target Minecraft Java 26.2.

[Source and full documentation](https://github.com/rieyi/display-anim-preview) | [Report an issue](https://github.com/rieyi/display-anim-preview/issues)`;

const ABOUT_ZH = `Java 逐帧显示动画可以直接在 Blockbench 中制作 Minecraft Java 版物品逐帧烘焙动画。

## 主要功能

- 在 GUI、第一人称、第三人称、地面、头部、展示框、内嵌和展示架等显示位置中预览同一个动画。
- 为每个显示位置独立开启或关闭动画。
- 使用 Blockbench 官方时间轴同步播放和拖动预览。
- 按 Minecraft 每秒 20 游戏刻烘焙，并对相同模型帧去重。
- 导出完整资源包和动画驱动数据包。
- 导出前检查模型范围、纹理分辨率、缺失的纹理引用和粒子纹理。

## 快速开始

1. 新建或打开“**Java 逐帧显示动画**”工程。
2. 在 Blockbench 动画模式中制作模型和动画。
3. 在显示调整模式中配置物品变换。
4. 打开“**显示位置动画预览**”，选择需要播放动画的显示位置。
5. 运行“**导出资源包和数据包**”。

需要 Blockbench 桌面版 5.1.5 或更高版本。生成的资源包和数据包面向 Minecraft Java 26.2。

[源码与完整文档](https://github.com/rieyi/display-anim-preview) | [报告问题](https://github.com/rieyi/display-anim-preview/issues)`;

/** Uses the export baking path so the bounds report matches exported models. */
function checkAnimationBounds(): void {
  const animation = Animation.selected ?? Animation.all[0];
  if (!animation) {
    Blockbench.showQuickMessage(tr("dap.bounds.no_animation"), 2000);
    return;
  }

  const fps = animation.snapping || 20;
  const frameCount = frameCountFor(animation.length, fps);
  const { frames, outOfBounds } = bakeFrames(frameCount, fps);
  const description = describeOutOfBounds(outOfBounds);

  if (!description) {
    Blockbench.showMessageBox({
      title: tr("dap.bounds.passed_title"),
      message: tr("dap.bounds.passed_message", { frames: frames.length, fps }),
      icon: "check_circle",
    });
    return;
  }

  Blockbench.showMessageBox({
    title: tr("dap.export.bounds_title"),
    message: description,
    icon: "warning",
  });
}

Plugin.register("display_anim_preview", {
  title: isChineseOnlyBuild() ? "Java 逐帧显示动画" : "Java Display Animator",
  author: "rieyi",
  description: isChineseOnlyBuild()
    ? "按显示位置预览 Minecraft Java 逐帧烘焙物品动画，并导出完整资源包和动画驱动数据包。"
    : "Preview frame-baked Minecraft Java item animations per display context and export complete " +
      "resource packs and animation-driving datapacks.",
  about: isChineseOnlyBuild() ? ABOUT_ZH : ABOUT_EN,
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
