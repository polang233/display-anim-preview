export type CompiledDisplay = Record<string, unknown>;

type CompiledModel = {
  display?: CompiledDisplay;
} & Record<string, unknown>;

export function cloneCompiledDisplay(
  display: CompiledDisplay | undefined
): CompiledDisplay | undefined {
  return display
    ? (JSON.parse(JSON.stringify(display)) as CompiledDisplay)
    : undefined;
}

/** Replaces potentially stale frame display data with the export-start snapshot. */
export function applyCompiledDisplaySnapshot(
  json: string,
  display: CompiledDisplay | undefined
): string {
  if (!display) return json;
  const compiled = JSON.parse(json) as CompiledModel;
  compiled.display = display;
  return JSON.stringify(compiled);
}
