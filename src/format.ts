/** Registers the plugin's independent model format without modifying the Java block codec. */

import { tr } from "./i18n";
import { resolveJavaBlockCodec } from "./java-block-codec";

export const FORMAT_ID = "display_animation_sequence";

/** The non-centered grid keeps Blockbench display transforms aligned with Java item models. */
export const FORMAT_COORDINATE_OPTIONS = {
  centered_grid: false,
} as const;

/**
 * Keep the editing and conversion capabilities of Blockbench's Java item format.
 * JDA adds a bone rig and animation mode on top, but must not change how Java
 * faces, textures, UVs or preview materials are interpreted.
 */
export const JAVA_MODEL_COMPATIBILITY_OPTIONS = {
  render_sides: "front",
  model_identifier: false,
  parent_model_id: true,
  vertex_color_ambient_occlusion: true,
  uv_rotation: true,
  java_cube_shading_properties: true,
  java_face_properties: true,
  cullfaces: true,
  animated_textures: true,
  select_texture_for_particles: true,
  texture_mcmeta: true,
  texture_folder: true,
  animation_controllers: true,
  animation_files: true,
} as const;

let ownedFormat: ModelFormatInstance | null = null;

function rebindOpenProjects(format: ModelFormatInstance): void {
  if (typeof ModelProject === "undefined" || !Array.isArray(ModelProject.all)) return;

  let reboundCurrentProject = false;
  for (const project of ModelProject.all) {
    if (project.format?.id !== FORMAT_ID || project.format === format) continue;
    project.format = format;
    reboundCurrentProject ||= Project === (project as unknown);
  }

  if (reboundCurrentProject) {
    format.select?.();
    Canvas.updateAll();
  }
}

function createFormat(id: string): ModelFormatInstance {
  const javaBlockCodec = resolveJavaBlockCodec();

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
    ...JAVA_MODEL_COMPATIBILITY_OPTIONS,
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
    rebindOpenProjects(ownedFormat);
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
