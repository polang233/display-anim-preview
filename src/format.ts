/** Registers the plugin's independent model format without modifying the Java block codec. */

import { tr } from "./i18n";

export const FORMAT_ID = "display_animation_sequence";

/** The non-centered grid keeps Blockbench display transforms aligned with Java item models. */
export const FORMAT_COORDINATE_OPTIONS = {
  centered_grid: false,
} as const;

let ownedFormat: ModelFormatInstance | null = null;

function createFormat(id: string): ModelFormatInstance {
  const javaBlockCodec = Formats.java_block?.codec ?? Codecs.java_block;

  return new ModelFormat(id, {
    id,
    name: tr("dap.format.name"),
    icon: "icon-format_block",
    category: "minecraft",
    target: "Minecraft: Java Edition",
    description: tr("dap.format.description"),
    show_in_start_screen: true,
    box_uv: false,
    optional_box_uv: true,
    single_texture: false,
    bone_rig: true,
    ...FORMAT_COORDINATE_OPTIONS,
    rotate_cubes: true,
    integer_size: false,
    animation_mode: true,
    display_mode: true,
    codec: javaBlockCodec,
  });
}

export function registerModelFormat(): void {
  if (!Formats[FORMAT_ID]) {
    ownedFormat = createFormat(FORMAT_ID);
    console.log(`Registered custom format "${FORMAT_ID}".`);
  }
}

export function unregisterModelFormat(): void {
  if (ownedFormat && Formats[FORMAT_ID] === ownedFormat) {
    ownedFormat.delete();
    console.log(`Unregistered custom format "${FORMAT_ID}".`);
  }
  ownedFormat = null;
}
