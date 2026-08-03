#!/usr/bin/env node
// Generates the vanilla item selector data from the exact Minecraft server
// registry this project targets, optionally adding Chinese labels from the
// official client zh_cn.json language file.
//
// Usage:
//   node scripts/generate-vanilla-items.mjs <registries.json> [zh_cn.json]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(__dirname, "..", "src", "vanilla-items.ts");
const registryPath = process.argv[2];
const languagePath = process.argv[3];

if (!registryPath || !fs.existsSync(registryPath)) {
  console.error("Usage: node scripts/generate-vanilla-items.mjs <registries.json> [zh_cn.json]");
  process.exit(1);
}

const registries = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const itemRegistry = registries["minecraft:item"];
if (!itemRegistry?.entries) {
  console.error("registries.json does not contain the minecraft:item registry");
  process.exit(1);
}

const language = languagePath && fs.existsSync(languagePath)
  ? JSON.parse(fs.readFileSync(languagePath, "utf8"))
  : {};
const ids = Object.keys(itemRegistry.entries)
  .map((id) => id.replace(/^minecraft:/, ""))
  .sort();
const options = {};
let translated = 0;

for (const id of ids) {
  const fullId = `minecraft:${id}`;
  const chinese = language[`item.minecraft.${id}`] ?? language[`block.minecraft.${id}`];
  options[fullId] = chinese ? `${fullId} (${chinese})` : `${fullId} (no Chinese translation)`;
  if (chinese) translated++;
}

const version = process.env.MC_VERSION || "26.2";
const content = `/**
 * Vanilla item ids and display labels for the export dialog.
 *
 * GENERATED FILE — regenerate with:
 *   node scripts/generate-vanilla-items.mjs <registries.json> [zh_cn.json]
 *
 * Registry version: Minecraft ${version}
 * Items: ${ids.length}; Chinese labels: ${translated}
 */

export const VANILLA_ITEMS_VERSION = "${version}";

export const VANILLA_ITEM_IDS: string[] = ${JSON.stringify(ids, null, 2)};

export const VANILLA_ITEM_OPTIONS: Record<string, string> = ${JSON.stringify(options, null, 2)};
`;

fs.writeFileSync(outputPath, content, "utf8");
console.log(`Generated ${path.relative(process.cwd(), outputPath)}`);
console.log(`  Items: ${ids.length}`);
console.log(`  Chinese labels: ${translated}`);
