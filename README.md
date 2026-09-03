# Java Display Animator

[简体中文](https://github.com/rieyi/display-anim-preview/blob/main/README.zh-CN.md)

Java Display Animator is a Blockbench Desktop plugin for creating and exporting frame-baked
Minecraft Java item animations. Preview the animation directly in Blockbench, choose whether it
plays in GUI, first-person, third-person, ground, and other display contexts, then export the
required resource pack and datapack in one operation.

If a `java_block_sequence` project created by another plugin is already open, this plugin can still
preview its animation and export Minecraft resource and data packs. It only uses an available Java
model compiler retained by Blockbench; it does not take ownership of, modify, or replace the other
plugin's project format, and it does not restore the removed legacy model-sequence ZIP exporter.

> This document describes the **1.1.0 release candidate** prepared for review. The 1.1.0 download
> links below will become available after the reviewed files are uploaded to GitHub Releases.

## Demos

### Blockbench display-context animation preview

https://github.com/user-attachments/assets/536b887c-1df0-4747-b160-68a98db1f6b1

If the player is unavailable, [open the Blockbench demo directly](https://github.com/user-attachments/assets/536b887c-1df0-4747-b160-68a98db1f6b1).

### In-game Minecraft result

https://github.com/user-attachments/assets/97ebae97-5083-4db9-8c3b-b30410d11f3a

If the player is unavailable, [open the Minecraft demo directly](https://github.com/user-attachments/assets/97ebae97-5083-4db9-8c3b-b30410d11f3a).

## Features

- Uses Blockbench's official timeline so the plugin panel and Animation mode share play, pause,
  looping, and time state.
- Previews animation in Edit, Paint, Animate, and Display modes.
- Stores an independent animation switch for first person, third person, GUI, ground, head, item
  frame, embedded, and shelf display contexts.
- Keeps disabled display contexts on frame 0 while enabled contexts follow exported
  `custom_model_data` frames.
- Supports a project animation rate from 1 to 20 FPS for preview, baking, bounds checks, and in-game playback, and deduplicates byte-identical model frames.
- Checks model bounds, project/texture resolution mismatches, missing texture references, and
  particle textures before export.
- Generates Minecraft 26.2 `display_context` and `custom_model_data` item-model routing.
- Selects multiple animations for export, previews the Minecraft key generated from each animation
  name, and designates one selected animation as the default.
- Uses `custom_model_data.strings[0]` for the animation key and
  `custom_model_data.floats[0]` for that animation's local frame.
- Uses the fixed `jsb` namespace and generates short per-animation commands plus dynamic `play` and
  `frame` macro APIs.
- Creates new packs or safely inserts a manifest-managed project module into existing unpacked packs.
- Stores playback state independently on each unstackable generated item, so identical model items do not share progress.

## Requirements

- Blockbench Desktop 5.1.5 or newer
- Minecraft Java 26.2 for the generated packs
- Node.js 20 or newer only when building from source

## Download choices

GitHub Releases provides two packages. They contain the same animation and export features and use
the same plugin ID, so install only one at a time.

| Package | Language behavior |
|---|---|
| [Download Universal](https://github.com/rieyi/display-anim-preview/releases/download/v1.1.0/java-display-animator-v1.1.0-universal.zip) | English base interface; follows Blockbench and automatically uses Simplified Chinese when Blockbench is Chinese |
| [Download Simplified Chinese](https://github.com/rieyi/display-anim-preview/releases/download/v1.1.0/java-display-animator-v1.1.0-zh-CN.zip) | Always uses Simplified Chinese, regardless of the Blockbench interface language |

The official Blockbench plugin repository receives the Universal build.
Use [SHA256SUMS.txt](https://github.com/rieyi/display-anim-preview/releases/download/v1.1.0/SHA256SUMS.txt)
to verify downloaded files.

## Installation

### From GitHub Releases

1. Use the links above to download the Universal or Simplified Chinese ZIP.
2. Extract the ZIP. Do not try to load the ZIP itself.
3. In Blockbench, open **File → Plugins**.
4. Choose **Load Plugin from File** and select `display_anim_preview.js` from the extracted folder.
5. Confirm that **Java Display Animator 1.1.0** appears in the installed plugin list.

Installing the other language package replaces the current package because both builds intentionally
use the `display_anim_preview` plugin ID.

### From the official Blockbench store

After the plugin is accepted, search for **Java Display Animator** in **File → Plugins → Available**
and select **Install**. The store listing and About page use English as required by the official
repository; the functional interface follows Blockbench's language.

## Complete usage tutorial

### 1. Create or open a project

1. Select **File → New → Java Display Animation**.
2. Create the item geometry, groups, and textures.
3. Create one or more group animations in Blockbench's **Animate** mode. The preview panel continues
   to play the currently selected single animation; choose the animations to export in the separate
   export list.
4. Set a project animation rate from 1 to 20 FPS. It controls preview, export sampling, bounds checks, and in-game playback.

The format uses Minecraft's non-centered item-model grid. Do not convert the project to a centered
format before export, because that changes the coordinate basis used by Display transforms.

### 2. Configure Minecraft display transforms

1. Switch to Blockbench's **Display** mode.
2. Adjust rotation, translation, and scale for GUI, first person, third person, ground, head, item
   frame, and any other available display contexts.
3. Save the project before a large export.

The exporter snapshots Blockbench's current compiled `display` settings at export start and applies
the same snapshot to every baked frame. The in-game position should therefore match the current
Display-mode preview rather than an older per-frame transform.

### 3. Choose which display contexts animate

1. Open the Command Palette with `Ctrl+P` on Windows/Linux or `Cmd+P` on macOS.
2. Run **Open Display Animation Preview**.
3. Select a display context in the panel.
4. In Display mode, enable or disable **Animate Current Display Context**.
5. Repeat for every context you need.

A common setup is:

| Display context | Suggested setting |
|---|---|
| GUI / inventory | Off |
| Third-person hands | Off |
| First-person hands | On |
| Ground, head, item frame | Off unless animation is intended there |

Each switch is saved independently in the `.bbmodel`. Turning animation off pauses that context,
returns it to frame 0, and disables its preview play button. The animation switch is intentionally
shown only in Display mode.

### 4. Preview playback

- Use Play/Pause in the plugin panel or Blockbench's official animation controls; both control the
  same timeline.
- Use Loop to change the official loop state.
- Use Low FPS to quantize the preview to the animation snapping rate and approximate non-interpolated
  in-game playback.
- Scrub the panel timeline to inspect individual poses.

### 5. Check model bounds

Run **Check Animation Model Bounds** from the Command Palette, then choose Quick Math Check or Exact
Isolated Check. Quick mode avoids Undo and is intended for fast authoring feedback. Exact mode clones
the project into a disposable in-memory project and validates final Java models, whose coordinates must
remain between `-16` and `32`. Both modes show cancellable progress and reuse unchanged per-animation
results during the current Blockbench session.
The multi-animation export report identifies every out-of-range frame with the animation's original
name, generated key, and local frame. Inspect it in Minecraft with
`frame/<key> {frame:<frame>}` before reducing the affected motion in Blockbench.

### 6. Export the resource pack and datapack

1. Run **Export Resource Pack and Datapack** from the Command Palette.
2. On the first page, select the animations to export from the persistent checklist. Each row shows
   the original name, generated key, duration, source FPS, and 20 FPS output-frame count. **Select
   All** and **Select None** are also available. For example, `TPS Reload` becomes `tps_reload`.
3. Select at least one animation. An empty key, `.` or `..`, or a key collision after sanitization
   prevents export until the conflicting animations are renamed.
4. On the second page, select the default animation from the checked animations. Static display
   contexts and invalid animation keys use frame 0 of this animation.
5. Choose an output mode:
   - Resource Pack + Datapack under one shared root;
   - Resource Pack + Datapack under separate parent folders;
   - Resource Pack only;
   - Datapack only.
6. Choose **Create New Pack** or **Insert into Existing Pack**, then review the pack name, project
   name, mapped item, display name, scoreboards, and playback tag. Both packs use the fixed `jsb` namespace.
7. Create mode selects a parent and creates the named pack folder. Insert mode selects an existing
   unpacked pack containing a valid `pack.mcmeta`, which is preserved.
8. The animation page can enable or disable **Run exact bounds check before export**. Resource models
   are isolated in a disposable project either way; disabling it suppresses range warnings and status.
9. If frame-rate, texture-resolution, or enabled model-bounds issues exist, the plugin combines every
   warning into one dialog. Files are generated only after **Export Anyway** is selected. Cancelling
   or closing the dialog writes nothing and displays an explicit cancellation message.

Open **Java Display Animator Project Settings** to edit general, animation, pack-file, datapack, and
developer-API pages while authoring. The first project state initially selects only Blockbench's
current animation. Changes are written immediately to the `.bbmodel` `display_anim_export_settings`
v6 property and mark the project as unsaved, but never save or overwrite it automatically. Resource
pack and datapack folders are remembered independently; an empty field asks during export.
A datapack-only export must be paired with a resource pack generated from the same animation-key and
frame-count mapping.

Every item created by `give` is unstackable and stores its animation, frame, mode, maximum frame, and
phase in its own `minecraft:custom_data.jsb`. Identical model items therefore keep independent state.
A one-shot `play` item resets after leaving the main hand; a `loop` item keeps its progress and resumes
when that same item is held again. `stop` resets only the currently held item.

The default shared-root layout is:

```text
selected-root/
├── resource-packs/<pack-name>/
└── datapacks/<pack-name>/
```

An animated display context first selects an animation key with
`custom_model_data.strings[0]`, then selects that animation's local frame with
`custom_model_data.floats[0]`. Static contexts directly use frame 0 of the default animation, and an
invalid key falls back to the default track. If every display context has animation disabled, the
exporter warns that the other selected animations will not be visible and writes only frame 0 of
the default animation. Model JSON is deduplicated globally across all animations while each
animation retains its own local frame sequence and statistics.

Resource files use `assets/jsb/items/<project>.json`,
`assets/jsb/models/<project>/<animation>/<slot>/<frame>.json`, `_generated` unique models, and
`assets/jsb/textures/<project>/...`. Only animated contexts create abbreviated slot folders; their
frame files are lightweight parent references. The resource-pack root uses `assets.jsbmeta`, while
the datapack root uses `data.jsbmeta`. These independent centralized manifests track project-owned
resource and driver files, allowing either format to evolve separately. Reinsertion updates only
manifest-owned project files, merges load/tick tags, blocks unmanaged collisions, and rolls back a
failed transaction.

Files have been written and verified only when the **Export Complete** dialog appears. It reports
animation keys and per-animation frame statistics, unique model files, deduplicated frames, model
JSON size, omitted untextured faces, output locations, and copyable in-game commands.

### 7. Install and test in Minecraft

1. Place the generated resource-pack directory in the Minecraft `resourcepacks` folder or the test
   server's configured resource-pack location.
2. Place the generated datapack directory in `<world>/datapacks/`.
3. Open **Options → Resource Packs**, move the newly copied pack to the selected side, and choose
   **Done**. Copying a directory into `resourcepacks` or pressing `F3+T` does not enable a pack that
   has not been selected.
4. Once the pack is enabled, use `F3+T` after re-exporting. Reload the datapack or reopen the world.
5. Replace `<project>` with the exported project name and use the short entries for normal testing:

```mcfunction
/function jsb:<project>/give
/function jsb:<project>/play/reload
/function jsb:<project>/loop/fire
/function jsb:<project>/frame/reload {frame:12}
/function jsb:<project>/stop
```

For dynamic map functions, use the macro API:

```mcfunction
/function jsb:<project>/play {animation:"reload",mode:"once"}
/function jsb:<project>/play {animation:"fire",mode:"loop"}
/function jsb:<project>/frame {animation:"reload",frame:12}
```

Replace `reload` and `fire` with keys shown in the Export Complete dialog. `mode` accepts only
`once` or `loop`. `give` and `stop` restore frame 0 of the default animation. `once` also restores
the default after showing its last frame for one game tick. `frame` stops automatic playback and
clamps the requested frame to the selected animation's valid range. Version 1.1.0 no longer generates
`play_loop`, `play_once`, `next`, `prev`, or `reset`.

Check GUI, first person, third person, ground, head, and item-frame views. Only display contexts whose
animation switch is enabled should change frames. Also test switching, looping, one-shot reset, and
manual frame selection with at least two animations of different lengths.

## Troubleshooting

### Purple-and-black missing texture

- First confirm that the exported pack is enabled under **Options → Resource Packs**. `F3+T` reloads
  enabled packs but does not enable a newly copied pack.
- Confirm every visible cube face has a project texture.
- A UV-resolution mismatch usually causes shifted, stretched, or cropped texture regions rather
  than a purple-and-black placeholder. Still confirm that Project Settings match the intended UV
  workflow.
- Re-export and reload resources with `F3+T`; leaving and re-entering a world does not necessarily
  reload the active resource pack.
- Inspect the client game directory's `logs/latest.log`, not the server log. Resource failures are
  commonly logged once during world entry or `F3+T`; search for `Missing texture`,
  `Unable to load model`, `Failed to load`, `item_model`, and `atlas`.
- The `Reloading ResourceManager` list should include the exported pack. A list containing only
  `vanilla` and mods means that the pack is not enabled.

### In-game position differs from Display mode

- Reopen Display mode and confirm the transform currently shown by Blockbench.
- Export again after the final transform change.
- Do not reuse generated models from an older export or convert the project to a centered-grid format.

### Animation does not play in one view

- Select that display context in Display mode and enable **Animate Current Display Context**.
- Confirm the datapack is loaded and run
  `play {animation:"<exported-key>",mode:"loop"}` while holding the generated item in the main hand.
- Confirm the key exactly matches the Export Complete dialog. An invalid key passed to `play`
  reports an error and rejects the new request. Only a missing or invalid `strings[0]` value in item
  data uses the resource-model fallback to the default animation track.
- Confirm the item uses the generated `minecraft:item_model` component.

## 1.1.0 validation status

The 1.1.0 release code has been consolidated and passed automated validation. Parts of the Blockbench
runtime flow and Minecraft datapack parsing were verified during development. A complete smoke test of
the final build, an online-player test covering multiple items/FPS/visuals, and final acceptance remain
pending. Nothing is pushed or uploaded before review.

## Build from source

```bash
npm ci
npm test
npm run typecheck
npm run build:release
npm run build:official
```

Outputs:

```text
dist/display_anim_preview.js        Universal build
dist/display_anim_preview.zh-CN.js  Simplified Chinese build source artifact
dist/display_anim_preview.official.js  Official repository build (About is supplied by about.md)
```

The Chinese Release ZIP renames its internal file to `display_anim_preview.js`, because Blockbench
requires the loaded filename to match the plugin ID.
The official repository copies `display_anim_preview.official.js` as `display_anim_preview.js`.

## Contributing

Contributions are accepted through a controlled Fork and Pull Request workflow. Read the
[contribution guidelines](CONTRIBUTING.md) before starting substantial work or submitting a Pull
Request.

## Copyright

Copyright © 2026 rieyi. All rights reserved. See
[COPYRIGHT.md](https://github.com/rieyi/display-anim-preview/blob/main/COPYRIGHT.md).

This repository is publicly viewable but intentionally does not grant an open-source license.
