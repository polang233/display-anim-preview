# Java Display Animator 1.0.0

[简体中文说明](#java-逐帧显示动画-100)

First public release of Java Display Animator for Blockbench Desktop 5.1.5+ and Minecraft Java
26.2.

## Downloads

- `java-display-animator-v1.0.0-universal.zip`: follows the Blockbench interface language; includes
  English and Simplified Chinese.
- `java-display-animator-v1.0.0-zh-CN.zip`: always uses Simplified Chinese.

Install only one package. Extract the ZIP, then load `display_anim_preview.js` through
**Blockbench → File → Plugins → Load Plugin from File**.

## Highlights

- Official Timeline playback synchronization across Blockbench modes.
- Independent animation switches for every supported item display context.
- 20 FPS frame baking and identical-frame deduplication.
- Resource-pack `display_context` routing and animation-driving datapack generation.
- Model-bounds, UV-resolution, texture-reference, and particle-texture checks.
- Standalone model format with no dependency on Java Block Sequencer.
- Complete English and Simplified Chinese controls, prompts, warnings, export reports, and generated
  datapack messages.

See the repository README for the complete installation, export, Minecraft testing, and
troubleshooting tutorial.

---

# Java 逐帧显示动画 1.0.0

Java 逐帧显示动画首次公开发布，适用于 Blockbench 桌面版 5.1.5+ 和 Minecraft Java 26.2。

## 下载选择

- `java-display-animator-v1.0.0-universal.zip`：通用语言版，跟随 Blockbench 界面语言，包含英文和
  简体中文。
- `java-display-animator-v1.0.0-zh-CN.zip`：固定简体中文版。

只需安装其中一个。解压 ZIP 后，在“**Blockbench → 文件 → 插件 → 从文件加载插件**”中选择
`display_anim_preview.js`。

## 主要内容

- 在 Blockbench 各模式中同步官方时间轴播放状态。
- 每个物品显示位置分别保存动画开关。
- 按 20 FPS 烘焙，并自动去除完全相同的重复帧模型。
- 生成资源包 `display_context` 路由和动画驱动数据包。
- 检查模型范围、UV 分辨率、纹理引用和粒子纹理。
- 插件格式可独立运行，不依赖 Java Block Sequencer。
- 控件、提示、警告、导出报告和生成数据包消息均已完整适配英文与简体中文。

完整安装、导出、Minecraft 测试和故障排查教程请查看仓库 README。
