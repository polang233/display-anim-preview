# Java Display Animator

**Preview item animations per display context, then export a Minecraft Java resource pack and datapack.** A Blockbench Desktop plugin.

[简体中文](README.zh-CN.md)

<p align="center">
  <img src="assets/icon.png" alt="Java Display Animator" width="96">
</p>

![Version](https://img.shields.io/github/v/release/rieyi/display-anim-preview?label=Version&color=2ea44f)
![Blockbench](https://img.shields.io/badge/Blockbench-5.1.5%2B-3b82f6)
![Minecraft](https://img.shields.io/badge/Minecraft_Java-26.2-62b47a)
![Node](https://img.shields.io/badge/Node-20%2B_build_only-e76f00)

## Download · 下载

[![GitHub Releases](https://img.shields.io/badge/GitHub-Releases-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/rieyi/display-anim-preview/releases)
[![Blockbench Plugins](https://img.shields.io/badge/Blockbench-Plugins-3b82f6?style=for-the-badge&logo=blockbench&logoColor=white)](https://blockbench.net/plugins)

Install from [upstream Releases](https://github.com/rieyi/display-anim-preview/releases). The [Blockbench Plugins](https://blockbench.net/plugins) listing is still under review.

Releases ship **Universal** (follows Blockbench language) and **Simplified Chinese** (always zh-CN). Same plugin ID — install only one.

## Overview · 简介

Make frame-baked Minecraft Java item animations in Blockbench: preview in Edit / Paint / Animate / Display, pick which display contexts animate, then export the resource pack and datapack together.

Works on an open `java_block_sequence` project from another plugin for preview and export. It uses Blockbench’s Java model compiler only; it does not take over that project format or restore the old model-sequence ZIP exporter.

## Demos · 演示

### Blockbench preview · 编辑器预览

![Blockbench display-context animation preview](media/blockbench-preview.jpg)

https://github.com/user-attachments/assets/536b887c-1df0-4747-b160-68a98db1f6b1

### In-game · 游戏内效果

![In-game Minecraft result](media/minecraft-result.jpg)

https://github.com/user-attachments/assets/97ebae97-5083-4db9-8c3b-b30410d11f3a

## Features · 特性

- Shares play / pause / loop / time with Blockbench’s official timeline
- Per-context animation switches (GUI, first person, third person, ground, head, item frame, and more)
- Disabled contexts stay on frame 0; enabled ones follow exported `custom_model_data` frames
- Project rate 1–20 FPS for preview, bake, bounds checks, and in-game playback
- Pre-export checks for bounds, texture resolution, missing textures, and particle textures
- Multi-animation export with generated keys and one default animation
- Fixed `jsb` namespace, short commands, plus `play` / `frame` macros
- Independent playback state on each unstackable generated item

## Requirements · 环境

- Blockbench Desktop 5.1.5+
- Minecraft Java 26.2 for the generated packs
- Node.js 20+ only when building from source

## Install · 安装

1. Download Universal or Simplified Chinese ZIP from [Releases](https://github.com/rieyi/display-anim-preview/releases)
2. Extract it (do not load the ZIP as a plugin)
3. Blockbench → **File → Plugins → Load Plugin from File**
4. Pick `display_anim_preview.js`
5. Confirm **Java Display Animator** is installed

## Quick start · 快速上手

1. **File → New → Java Display Animation**
2. Build the item and animate groups in **Animate**
3. In **Display**, set transforms and toggle which contexts animate
4. Command Palette → **Export Resource Pack and Datapack**
5. Enable the packs in Minecraft 26.2 and test with the generated `jsb:…` commands

Full guide: [doc/USAGE.md](doc/USAGE.md) · [中文](doc/USAGE.zh-CN.md)  
Troubleshooting: [doc/TROUBLESHOOTING.md](doc/TROUBLESHOOTING.md) · [中文](doc/TROUBLESHOOTING.zh-CN.md)

## Build · 构建

```bash
npm ci
npm test
npm run typecheck
npm run build:release
npm run build:official
```

## Contributing · 贡献

Fork + PR only. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Copyright · 版权

Copyright © 2026 rieyi. See [COPYRIGHT.md](COPYRIGHT.md). Publicly viewable; not an open-source license.
