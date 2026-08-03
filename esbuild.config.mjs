import { build, context } from "esbuild";
import { copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

/**
 * Bundle the plugin into a single JS file loadable via Blockbench
 * "Load Plugin from File". The output file name (without extension) must
 * exactly match the plugin id passed to Plugin.register() in src/plugin.ts,
 * or Blockbench refuses to load it.
 */
const outfileArgument = process.argv.find((argument) => argument.startsWith("--outfile="));
const outfile = outfileArgument?.slice("--outfile=".length) || "dist/display_anim_preview.js";

const options = {
  entryPoints: ["src/plugin.ts"],
  bundle: true,
  outfile,
  format: "iife",
  target: "es2020",
  platform: "browser",
  legalComments: "none",
};

const watch = process.argv.includes("--watch");

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("watching...");
} else {
  await build(options);
  const iconSource = resolve("assets/icon.png");
  const iconTarget = resolve(dirname(outfile), "icon.png");
  if (iconSource !== iconTarget) {
    await copyFile(iconSource, iconTarget);
  }
  console.log(`built ${outfile}`);
}
