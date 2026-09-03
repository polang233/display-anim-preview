/** Multi-animation export settings persisted with the Blockbench project. */

import { defaultRuntimeNames, sanitizeProjectName } from "./export-layout";
import { tr } from "./i18n";

export type ExportOutputMode =
  | "both_default"
  | "both_separate"
  | "resource_only"
  | "datapack_only";

export type ExportWriteMode = "create" | "insert";

export interface StoredExportAnimationSettings {
  version: 6;
  selectedAnimationUuids: string[];
  defaultAnimationUuid: string;
  packName: string;
  projectName: string;
  outputMode: ExportOutputMode;
  writeMode: ExportWriteMode;
  baseItem: string;
  displayName: string;
  frameObjective: string;
  modeObjective: string;
  maxFrameObjective: string;
  playingTag: string;
  debugEnabled?: boolean;
  exactBoundsOnExport: boolean;
  animationFps: number;
  sharedRoot: string;
  resourcePackFolder: string;
  datapackFolder: string;
}

const PROPERTY_NAME = "display_anim_export_settings";
let settingsProperty: PropertyInstance | null = null;

function isOutputMode(value: unknown): value is ExportOutputMode {
  return ["both_default", "both_separate", "resource_only", "datapack_only"].includes(
    String(value)
  );
}

function isWriteMode(value: unknown): value is ExportWriteMode {
  return value === "create" || value === "insert";
}

export function normalizeAnimationFps(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Math.min(20, Math.max(1, Math.round(Number.isFinite(numeric) ? numeric : 20)));
}

function storedSettings(): StoredExportAnimationSettings | null {
  if (!Project) return null;
  const value = Project[PROPERTY_NAME] as
    | (Partial<Omit<StoredExportAnimationSettings, "version">> & { version?: number })
    | undefined;
  if (
    !value ||
    (value.version !== 2 && value.version !== 3 && value.version !== 4 && value.version !== 5 && value.version !== 6) ||
    !Array.isArray(value.selectedAnimationUuids) ||
    typeof value.defaultAnimationUuid !== "string" ||
    typeof value.packName !== "string" ||
    typeof value.projectName !== "string" ||
    !isOutputMode(value.outputMode) ||
    !isWriteMode(value.writeMode) ||
    typeof value.baseItem !== "string" ||
    typeof value.displayName !== "string" ||
    typeof value.frameObjective !== "string" ||
    typeof value.modeObjective !== "string" ||
    typeof value.maxFrameObjective !== "string" ||
    typeof value.playingTag !== "string"
  ) {
    return null;
  }
  return {
    version: 6,
    selectedAnimationUuids: value.selectedAnimationUuids.filter(
      (uuid): uuid is string => typeof uuid === "string"
    ),
    defaultAnimationUuid: value.defaultAnimationUuid,
    packName: value.packName,
    projectName: value.projectName,
    outputMode: value.outputMode,
    writeMode: value.writeMode,
    baseItem: value.baseItem,
    displayName: value.displayName,
    frameObjective: value.frameObjective,
    modeObjective: value.modeObjective,
    maxFrameObjective: value.maxFrameObjective,
    playingTag: value.playingTag,
    debugEnabled: value.debugEnabled === true,
    exactBoundsOnExport: value.exactBoundsOnExport !== false,
    animationFps: normalizeAnimationFps(value.animationFps),
    sharedRoot: typeof value.sharedRoot === "string" ? value.sharedRoot : "",
    resourcePackFolder: typeof value.resourcePackFolder === "string" ? value.resourcePackFolder : "",
    datapackFolder: typeof value.datapackFolder === "string" ? value.datapackFolder : "",
  };
}

export function registerExportAnimationSettingsProperty(): void {
  if (ModelProject.properties?.[PROPERTY_NAME]) return;
  settingsProperty = new Property(ModelProject, "object", PROPERTY_NAME, {
    default: {},
    label: tr("dap.export.property.name"),
    description: tr("dap.export.property.description"),
  });
}

export function unregisterExportAnimationSettingsProperty(): void {
  settingsProperty?.delete();
  settingsProperty = null;
}

/** Restores compatible settings, or creates lightweight defaults for a new project. */
export function initialExportSettings(
  animations: Animation[]
): StoredExportAnimationSettings {
  const projectName = sanitizeProjectName(Project?.name ?? "", "display_animation");
  const runtime = defaultRuntimeNames(projectName);
  const stored = storedSettings();
  const available = new Set(animations.map((animation) => animation.uuid));
  const selected = stored?.selectedAnimationUuids.filter((uuid) => available.has(uuid)) ?? [];
  const fallback = Animation.selected ?? animations[0] ?? null;
  if (!stored && fallback) selected.push(fallback.uuid);

  const selectedSet = new Set(selected);
  const defaultAnimationUuid =
    (stored?.defaultAnimationUuid && selectedSet.has(stored.defaultAnimationUuid)
      ? stored.defaultAnimationUuid
      : Animation.selected && selectedSet.has(Animation.selected.uuid)
        ? Animation.selected.uuid
        : selected[0]) ?? "";

  return {
    version: 6,
    selectedAnimationUuids: selected,
    defaultAnimationUuid,
    packName: stored?.packName || projectName,
    projectName: stored?.projectName || projectName,
    outputMode: stored?.outputMode ?? "both_default",
    writeMode: stored?.writeMode ?? "create",
    baseItem: stored?.baseItem || "minecraft:potion",
    displayName: stored?.displayName || Project?.name?.trim() || projectName,
    frameObjective: stored?.frameObjective || runtime.frameObjective,
    modeObjective: stored?.modeObjective || runtime.modeObjective,
    maxFrameObjective: stored?.maxFrameObjective || runtime.maxFrameObjective,
    playingTag: stored?.playingTag || runtime.playingTag,
    debugEnabled: stored?.debugEnabled === true,
    exactBoundsOnExport: stored?.exactBoundsOnExport !== false,
    animationFps: stored?.animationFps ?? 20,
    sharedRoot: stored?.sharedRoot ?? "",
    resourcePackFolder: stored?.resourcePackFolder ?? "",
    datapackFolder: stored?.datapackFolder ?? "",
  };
}

/** Called only after every requested file has been committed and verified. */
export function rememberExportSettings(
  settings: Omit<StoredExportAnimationSettings, "version">
): void {
  if (!Project) return;
  Project[PROPERTY_NAME] = {
    version: 6,
    ...settings,
    selectedAnimationUuids: [...settings.selectedAnimationUuids],
    debugEnabled: settings.debugEnabled === true,
  } satisfies StoredExportAnimationSettings;
  Project.saved = false;
}

/** Stores an explicitly edited project setting immediately without saving the bbmodel file. */
export function rememberExportSettingsDraft(settings: StoredExportAnimationSettings): void {
  if (!Project) return;
  Project[PROPERTY_NAME] = {
    ...settings,
    version: 6,
    selectedAnimationUuids: [...settings.selectedAnimationUuids],
    debugEnabled: settings.debugEnabled === true,
  } satisfies StoredExportAnimationSettings;
  Project.saved = false;
}

export function getProjectAnimationFps(): number {
  return storedSettings()?.animationFps ?? 20;
}

export function setProjectAnimationFps(value: number): number {
  const fps = normalizeAnimationFps(value);
  const settings = initialExportSettings(Animation.all);
  settings.animationFps = fps;
  rememberExportSettingsDraft(settings);
  return fps;
}
