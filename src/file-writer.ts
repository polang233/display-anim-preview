/** Writes generated packs through Blockbench's permission-scoped filesystem access. */

import type { PackFile } from "./resource-pack";
import { tr } from "./i18n";

const MANIFEST_NAME = ".display-anim-preview-manifest.json";

export interface WriteTarget {
  /** Absolute path of the pack root. */
  root: string;
  files: PackFile[];
}

function getScopedFs(scopeRoot: string, prompt: boolean): NodeFs | null {
  const fs = requireNativeModule("fs", {
    scope: scopeRoot,
    message: tr("dap.permission.export"),
    show_permission_dialog: prompt,
  }) as NodeFs | undefined;
  return fs ?? null;
}

function getPathModule(): NodePath {
  return requireNativeModule("path") as NodePath;
}

function isSafeGeneratedPath(relativePath: string): boolean {
  if (!relativePath || relativePath.startsWith("/") || relativePath.includes("..")) {
    return false;
  }
  return (
    relativePath === "pack.mcmeta" ||
    relativePath.startsWith("assets/") ||
    relativePath.startsWith("data/")
  );
}

function cleanPreviousGeneratedFiles(
  fs: NodeFs,
  pathModule: NodePath,
  target: WriteTarget
): void {
  const manifestPath = pathModule.join(target.root, MANIFEST_NAME);
  if (!fs.existsSync(manifestPath)) return;

  let previous: string[] = [];
  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
      files?: unknown;
    };
    if (Array.isArray(parsed.files)) {
      previous = parsed.files.filter((value): value is string => typeof value === "string");
    }
  } catch (err) {
    console.warn("Could not read the previous export manifest; skipping stale-file cleanup", err);
    return;
  }

  const current = new Set(target.files.map((file) => file.path));
  for (const relativePath of previous) {
    if (current.has(relativePath) || !isSafeGeneratedPath(relativePath)) continue;
    const fullPath = pathModule.join(target.root, relativePath);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  }
}

/**
 * Requests access to `scopeRoot`, creates target directories, writes files, and returns the
 * verified file count.
 */
export function writePacks(scopeRoot: string, targets: WriteTarget[]): number {
  const fs = getScopedFs(scopeRoot, true);
  if (!fs) {
    throw new Error(tr("dap.error.write_permission"));
  }
  const pathModule = getPathModule();

  let written = 0;
  for (const target of targets) {
    cleanPreviousGeneratedFiles(fs, pathModule, target);
    for (const file of target.files) {
      const fullPath = pathModule.join(target.root, file.path);
      fs.mkdirSync(pathModule.dirname(fullPath), { recursive: true });
      Blockbench.writeFile(fullPath, {
        content: file.content,
        savetype: file.isImage ? "image" : "text",
      });
      if (!fs.existsSync(fullPath)) {
        throw new Error(tr("dap.error.file_not_written", { path: fullPath }));
      }
      if (!file.isImage && fs.readFileSync(fullPath, "utf8") !== file.content) {
        throw new Error(tr("dap.error.file_verify", { path: fullPath }));
      }
      written++;
    }
    const manifestPath = pathModule.join(target.root, MANIFEST_NAME);
    const manifestContent = `${JSON.stringify(
        { version: 1, files: target.files.map((file) => file.path) },
        null,
        2
      )}\n`;
    Blockbench.writeFile(manifestPath, {
      content: manifestContent,
      savetype: "text",
    });
    if (!fs.existsSync(manifestPath)) {
      throw new Error(tr("dap.error.manifest_not_written", { path: manifestPath }));
    }
    if (fs.readFileSync(manifestPath, "utf8") !== manifestContent) {
      throw new Error(tr("dap.error.manifest_verify", { path: manifestPath }));
    }
  }
  return written;
}

/**
 * Counts existing files after explicitly requesting access so overwrite confirmation is not
 * skipped on the first export to a selected parent.
 */
export function inspectExisting(scopeRoot: string, dir: string): number | null {
  const fs = getScopedFs(scopeRoot, true);
  if (!fs) {
    throw new Error(tr("dap.error.read_permission"));
  }
  if (!fs.existsSync(dir)) return null;
  const pathModule = getPathModule();

  let count = 0;
  const walk = (current: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const child = pathModule.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(child);
      } else {
        count++;
      }
    }
  };
  walk(dir);
  return count;
}
