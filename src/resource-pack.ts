/** Builds a complete Minecraft Java resource pack from baked frame models. */

import type { BakedFrame } from "./bake";

const RESOURCE_PACK_FORMAT: [number, number] = [88, 0];

export interface PackOptions {
  packName: string;
  namespace: string;
  itemModel: string;
  description: string;
  displayContexts?: PackDisplayContext[];
}

export interface PackDisplayContext {
  context: string;
  animated: boolean;
}

export interface PackBuildReport {
  sampledFrames: number;
  uniqueModels: number;
  duplicateFrames: number;
  modelBytesBefore: number;
  modelBytesAfter: number;
  omittedUntexturedFaces: number;
  omittedEmptyElements: number;
}

export interface PackBuildResult {
  files: PackFile[];
  report: PackBuildReport;
}

export interface PackFile {
  path: string;
  /** Text content, or a PNG data URL when `isImage` is true. */
  content: string;
  isImage?: boolean;
}

interface ExportTexture {
  id: string;
  name: string;
  link: string;
  dataUrl: string;
}

function sanitizeTextureName(name: string, fallbackIndex: number): string {
  const safe = name
    .replace(/\.png$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return safe || `texture_${fallbackIndex}`;
}

/** Generates a unique file stem so project textures cannot overwrite each other. */
function collectTextures(): ExportTexture[] {
  const used = new Set<string>();
  return Texture.all.map((texture, index) => {
    const base = sanitizeTextureName(texture.name, index);
    let name = base;
    let suffix = 2;
    while (used.has(name)) {
      name = `${base}_${suffix++}`;
    }
    used.add(name);
    return {
      id: String(texture.id),
      name,
      link: texture.javaTextureLink(),
      dataUrl: texture.getDataURL(),
    };
  });
}

/**
 * Rewrites texture references by matching both compiled keys and values. Matching values is
 * required for aliases such as `particle`, whose key is not itself a texture ID.
 */
function rewriteTextureRefs(
  json: string,
  options: PackOptions,
  textures: ExportTexture[]
): string {
  const model = JSON.parse(json) as { textures?: Record<string, string> };
  if (!model.textures) return JSON.stringify(model);

  for (const key of Object.keys(model.textures)) {
    const value = model.textures[key];
    if (value.startsWith("#")) continue;
    const valueStem = value.split("/").pop()?.replace(/\.png$/i, "");
    const texture = textures.find(
      (candidate) =>
        candidate.id === key ||
        candidate.link === value ||
        candidate.name === key ||
        candidate.name === valueStem
    );
    if (texture) {
      model.textures[key] = `${options.namespace}:item/${options.itemModel}/${texture.name}`;
    }
  }
  if (!model.textures.particle) {
    const firstTextureKey = Object.keys(model.textures).find(
      (key) => key !== "particle" && !model.textures![key].startsWith("#")
    );
    if (firstTextureKey) model.textures.particle = `#${firstTextureKey}`;
  }
  return JSON.stringify(model);
}

function animatedModel(modelPaths: string[]): unknown {
  const uniquePaths = [...new Set(modelPaths)];
  if (uniquePaths.length === 1) {
    return { type: "minecraft:model", model: uniquePaths[0] };
  }
  const entries = modelPaths.map((model, frame) => ({
    threshold: frame,
    model: { type: "minecraft:model", model },
  }));
  return {
    type: "minecraft:range_dispatch",
    property: "minecraft:custom_model_data",
    index: 0,
    fallback: { type: "minecraft:model", model: modelPaths[0] },
    entries,
  };
}

function buildItemDefinition(
  options: PackOptions,
  modelPaths: string[]
): string {
  if (!modelPaths.length) throw new Error("No models are available for the item definition");

  let model: unknown = animatedModel(modelPaths);
  if (options.displayContexts?.length) {
    const cases = options.displayContexts.map((route) => ({
      when: route.context,
      model: route.animated
        ? animatedModel(modelPaths)
        : { type: "minecraft:model", model: modelPaths[0] },
    }));
    model = {
      type: "minecraft:select",
      property: "minecraft:display_context",
      cases,
      fallback: { type: "minecraft:model", model: modelPaths[0] },
    };
  }

  return `${JSON.stringify(
    {
      model,
      // Verified in 26.2: this field prevents equip bobbing on each custom_model_data update.
      swap_animation_scale: 0,
    },
    null,
    2
  )}\n`;
}

function buildPackMcmeta(options: PackOptions): string {
  return `${JSON.stringify(
    {
      pack: {
        description: options.description,
        min_format: RESOURCE_PACK_FORMAT,
        max_format: RESOURCE_PACK_FORMAT,
      },
    },
    null,
    2
  )}\n`;
}

/**
 * Removes untextured faces and elements. Remaining missing or external texture references fail
 * the export because Blockbench's `#missing` sentinel renders as a missing-texture placeholder.
 */
function sanitizeTextureRefs(
  frameJson: string,
  options: PackOptions,
  textureNames: Set<string>
): { json: string; omittedFaces: number; omittedElements: number } {
  const model = JSON.parse(frameJson) as {
    textures?: Record<string, string>;
    elements?: Array<{
      name?: string;
      faces?: Record<string, { texture?: string }>;
    }>;
  };
  const prefix = `${options.namespace}:item/${options.itemModel}/`;
  const textures = model.textures ?? {};
  let omittedFaces = 0;
  let omittedElements = 0;

  const validateResolvedTexture = (value: string, label: string): void => {
    if (!value.startsWith(prefix)) {
      throw new Error(
        `Texture "${label}" still references external atlas "${value}". ` +
          "Minecraft 26.2 item models cannot mix item and block atlases."
      );
    }
    const stem = value.slice(prefix.length);
    if (!textureNames.has(stem)) {
      throw new Error(`Model references a texture that was not generated: ${value}`);
    }
  };

  const resolveTexture = (reference: string): string | null => {
    let value = reference;
    const visited = new Set<string>();
    while (value.startsWith("#")) {
      const key = value.slice(1);
      if (!key || key === "missing" || visited.has(key) || !textures[key]) {
        return null;
      }
      visited.add(key);
      value = textures[key];
    }
    return value;
  };

  for (const [key, rawValue] of Object.entries(textures)) {
    const value = resolveTexture(rawValue);
    if (!value) continue;
    validateResolvedTexture(value, `#${key}`);
  }

  for (const element of model.elements ?? []) {
    for (const [faceName, face] of Object.entries(element.faces ?? {})) {
      const value = face.texture ? resolveTexture(face.texture) : null;
      if (!value) {
        delete element.faces?.[faceName];
        omittedFaces++;
      } else {
        validateResolvedTexture(value, face.texture ?? faceName);
      }
    }
  }

  if (model.elements) {
    model.elements = model.elements.filter((element) => {
      if (Object.keys(element.faces ?? {}).length) return true;
      omittedElements++;
      return false;
    });
  }

  return {
    json: JSON.stringify(model),
    omittedFaces,
    omittedElements,
  };
}

export function buildResourcePack(
  frames: BakedFrame[],
  options: PackOptions
): PackBuildResult {
  const files: PackFile[] = [];
  const assetRoot = `assets/${options.namespace}`;
  const textures = collectTextures();
  const textureNames = new Set(textures.map((texture) => texture.name));
  const modelPaths: string[] = [];
  const uniqueModels = new Map<string, string>();
  let sampledFrames = 0;
  let modelBytesBefore = 0;
  let modelBytesAfter = 0;
  let omittedUntexturedFaces = 0;
  let omittedEmptyElements = 0;

  files.push({ path: "pack.mcmeta", content: buildPackMcmeta(options) });

  for (const frame of frames) {
    const rewritten = rewriteTextureRefs(frame.json, options, textures);
    const sanitized = sanitizeTextureRefs(rewritten, options, textureNames);
    omittedUntexturedFaces += sanitized.omittedFaces;
    omittedEmptyElements += sanitized.omittedElements;
    sampledFrames++;
    modelBytesBefore += sanitized.json.length;

    let modelPath = uniqueModels.get(sanitized.json);
    if (!modelPath) {
      const uniqueIndex = uniqueModels.size;
      modelPath = `${options.namespace}:item/${options.itemModel}/generated/model_${uniqueIndex}`;
      uniqueModels.set(sanitized.json, modelPath);
      modelBytesAfter += sanitized.json.length;
      files.push({
        path: `${assetRoot}/models/item/${options.itemModel}/generated/model_${uniqueIndex}.json`,
        content: `${sanitized.json}\n`,
      });
    }
    modelPaths.push(modelPath);
  }

  files.push({
    path: `${assetRoot}/items/${options.itemModel}.json`,
    content: buildItemDefinition(options, modelPaths),
  });

  for (const texture of textures) {
    files.push({
      path: `${assetRoot}/textures/item/${options.itemModel}/${texture.name}.png`,
      content: texture.dataUrl,
      isImage: true,
    });
  }

  return {
    files,
    report: {
      sampledFrames,
      uniqueModels: uniqueModels.size,
      duplicateFrames: sampledFrames - uniqueModels.size,
      modelBytesBefore,
      modelBytesAfter,
      omittedUntexturedFaces,
      omittedEmptyElements,
    },
  };
}
