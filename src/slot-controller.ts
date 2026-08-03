import { enforceCurrentDisplayAnimationPolicy } from "./playback";

/** Uses Blockbench's display mode so transforms, camera presets, mirroring, and pivots stay native. */

let previousModeId: string | null = null;

/** Enters display mode when necessary and loads the requested context. */
export function enterDisplaySlot(slot: string): void {
  if (Modes.selected.id !== "display") {
    previousModeId = Modes.selected.id;
    Modes.options.display?.select();
  }
  DisplayMode.load(slot);
  enforceCurrentDisplayAnimationPolicy();
}

/** Returns to the mode that was active before entering display mode. */
export function restorePreviousMode(): void {
  if (previousModeId) {
    Modes.options[previousModeId]?.select();
  }
  previousModeId = null;
}

export function listAvailableSlots(): string[] {
  return DisplayMode.slots;
}

export function currentSlot(): string {
  return DisplayMode.display_slot;
}
