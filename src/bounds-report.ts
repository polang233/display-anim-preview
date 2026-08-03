/** Reports baked frames outside Minecraft's -16 to 32 model-coordinate limits. */

import type { OutOfBoundsHit } from "./bake";

/** Groups hits by frame so large reports remain readable. */
function summarizeByFrame(hits: OutOfBoundsHit[]): string[] {
  const byFrame = new Map<number, OutOfBoundsHit[]>();
  for (const hit of hits) {
    const list = byFrame.get(hit.frame);
    if (list) {
      list.push(hit);
    } else {
      byFrame.set(hit.frame, [hit]);
    }
  }

  const frames = [...byFrame.keys()].sort((a, b) => a - b);
  return frames.map((frame) => {
    const frameHits = byFrame.get(frame) ?? [];
    const worst = frameHits.reduce((acc, hit) =>
      Math.abs(hit.value) > Math.abs(acc.value) ? hit : acc
    );
    const names = [...new Set(frameHits.map((hit) => hit.elementName))];
    const nameList = names.length > 2 ? `${names.slice(0, 2).join(", ")} and ${names.length} parts` : names.join(", ");
    return `Frame ${frame}: ${nameList}, ${worst.field}.${worst.axis} = ${worst.value.toFixed(2)}`;
  });
}

/** Returns a readable warning, or null when every frame is in range. */
export function describeOutOfBounds(hits: OutOfBoundsHit[]): string | null {
  if (!hits.length) return null;

  const lines = summarizeByFrame(hits);
  const shown = lines.slice(0, 12);
  const omitted = lines.length - shown.length;

  const parts = [
    `Parts exceed Minecraft model bounds in ${lines.length} frames (every axis must remain between -16 and 32).`,
    "",
    "Out-of-range frames may render offset or disappear. Use the datapack next/prev functions to inspect these frames, then reduce the affected motion in Blockbench:",
    "",
    ...shown,
  ];
  if (omitted > 0) {
    parts.push(`…and ${omitted} more out-of-range frames.`);
  }
  return parts.join("\n");
}
