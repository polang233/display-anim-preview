# Java Display Animator

Source repository for the Blockbench **Java Display Animator** plugin.

The plugin previews frame-baked Minecraft Java item animations per display context and exports a
complete resource pack and animation-driving datapack.

## Requirements

- Blockbench Desktop 5.1.5 or newer
- Node.js 20 or newer for development
- Minecraft Java 26.2 for exported-pack testing

## Build and test

```bash
npm ci
npm test
npm run typecheck
npm run build
```

The build writes `dist/display_anim_preview.js` and copies `assets/icon.png` to `dist/icon.png`.

## Install a local build

In Blockbench, open **File → Plugins → Load Plugin from File** and select:

```text
dist/display_anim_preview.js
```

## Language support

English is the base language required by the official Blockbench plugin repository. Simplified
Chinese is registered through `Language.addTranslations("zh", ...)` and selected automatically by
Blockbench.

## Copyright and permissions

Copyright © 2026 rieyi. All rights reserved.

This repository intentionally does not include an open-source license. Public visibility permits
inspection of the source but does not grant permission to copy, modify, redistribute, relicense,
sell, or publish derivative versions of the source or plugin.

Users may install and use the unmodified official plugin and retain all rights to models, textures,
resource packs, and datapacks they create with it.
