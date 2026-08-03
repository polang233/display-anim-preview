type Replacements = Record<string, string | number>;

const EN: Record<string, string> = {
  "dap.format.name": "Java Display Animation",
  "dap.format.description": "Create frame-baked keyframe animation projects for Minecraft Java Edition",
  "dap.property.name": "Display Context Animation",
  "dap.property.description": "Choose whether each item display context plays the frame animation",
  "dap.panel.name": "Display Animation Preview",
  "dap.panel.slot": "Display Context",
  "dap.panel.animate": "Animate Current Display Context",
  "dap.panel.animate_hint": "Enabled contexts follow custom_model_data frames; disabled contexts stay on frame 0.",
  "dap.panel.play": "Play / Pause",
  "dap.panel.play_disabled": "Animation is disabled for this display context.",
  "dap.panel.loop": "Loop Playback",
  "dap.panel.low_fps": "Low FPS",
  "dap.panel.low_fps_hint": "Preview at the animation snapping rate to simulate non-interpolated in-game playback",
  "dap.action.open": "Open Display Animation Preview",
  "dap.action.open_desc": "Preview animation by display context with independent playback controls",
  "dap.action.bounds": "Check Animation Model Bounds",
  "dap.action.bounds_desc": "List baked frames outside Minecraft's -16 to 32 model limits",
  "dap.action.export": "Export Resource Pack and Datapack",
  "dap.action.export_desc": "Bake the animation and generate a complete resource pack and animation-driving datapack",
  "dap.export.title": "Export Resource Pack and Datapack",
  "dap.export.output": "Export Contents",
  "dap.export.pack_name": "Pack Name",
  "dap.export.asset_namespace": "Asset Namespace",
  "dap.export.item_model": "Item Model Name",
  "dap.export.base_item": "Mapped Item",
  "dap.export.display_name": "Item Display Name",
  "dap.export.data_namespace": "Datapack Namespace",
  "dap.export.frame_objective": "Frame Scoreboard",
  "dap.export.mode_objective": "Mode Scoreboard",
  "dap.export.playing_tag": "Playback Tag",
  "dap.slot.thirdperson_righthand": "Third Person - Right Hand",
  "dap.slot.thirdperson_lefthand": "Third Person - Left Hand",
  "dap.slot.firstperson_righthand": "First Person - Right Hand",
  "dap.slot.firstperson_lefthand": "First Person - Left Hand",
  "dap.slot.head": "Head",
  "dap.slot.gui": "GUI / Inventory",
  "dap.slot.ground": "Ground",
  "dap.slot.fixed": "Item Frame",
  "dap.slot.embedded": "Embedded",
  "dap.slot.on_shelf": "On Shelf",
};

const ZH: Record<string, string> = {
  "dap.format.name": "Java 逐帧显示动画",
  "dap.format.description": "为 Minecraft Java 版创建逐帧几何烘焙关键帧动画工程",
  "dap.property.name": "显示位置动画",
  "dap.property.description": "分别决定每个物品显示位置是否播放逐帧动画",
  "dap.panel.name": "显示位置动画预览",
  "dap.panel.slot": "显示位置",
  "dap.panel.animate": "当前显示位置播放动画",
  "dap.panel.animate_hint": "启用后随 custom_model_data 播放逐帧动画，关闭时固定使用第 0 帧。",
  "dap.panel.play": "播放 / 暂停",
  "dap.panel.play_disabled": "当前显示位置已关闭动画。",
  "dap.panel.loop": "循环播放",
  "dap.panel.low_fps": "低帧",
  "dap.panel.low_fps_hint": "按动画吸附帧率逐帧预览，模拟游戏内无插值播放",
  "dap.action.open": "打开显示位置动画预览",
  "dap.action.open_desc": "按显示位置预览动画并提供独立播放控件",
  "dap.action.bounds": "检查动画模型范围",
  "dap.action.bounds_desc": "列出烘焙后超出 Minecraft -16 到 32 模型限制的帧",
  "dap.action.export": "导出资源包和数据包",
  "dap.action.export_desc": "烘焙动画并生成完整资源包和动画驱动数据包",
  "dap.export.title": "导出资源包和数据包",
  "dap.export.output": "导出内容",
  "dap.export.pack_name": "包名",
  "dap.export.asset_namespace": "资源命名空间",
  "dap.export.item_model": "物品模型名",
  "dap.export.base_item": "映射物品",
  "dap.export.display_name": "物品显示名",
  "dap.export.data_namespace": "数据包命名空间",
  "dap.export.frame_objective": "帧记分板",
  "dap.export.mode_objective": "模式记分板",
  "dap.export.playing_tag": "播放标记",
  "dap.slot.thirdperson_righthand": "第三人称-右手",
  "dap.slot.thirdperson_lefthand": "第三人称-左手",
  "dap.slot.firstperson_righthand": "第一人称-右手",
  "dap.slot.firstperson_lefthand": "第一人称-左手",
  "dap.slot.head": "头部",
  "dap.slot.gui": "GUI/背包图标",
  "dap.slot.ground": "地面",
  "dap.slot.fixed": "展示框",
  "dap.slot.embedded": "内嵌",
  "dap.slot.on_shelf": "展示架",
};

export function registerTranslations(): void {
  Language.addTranslations("en", EN);
  Language.addTranslations("zh", ZH);
}

export function tr(key: string, replacements: Replacements = {}): string {
  let text = tl(key);
  if (text === key) text = EN[key] ?? key;
  for (const [name, value] of Object.entries(replacements)) {
    text = text.split(`{${name}}`).join(String(value));
  }
  return text;
}
