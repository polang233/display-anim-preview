/** Reports baked frames outside Minecraft's -16 to 32 model-coordinate limits. */

import type { OutOfBoundsHit } from "./bake";
import { tr } from "./i18n";

/** Groups hits by frame so large reports remain readable. */
export interface OutOfBoundsFrameSummary {
  frame: number;
  description: string;
}

export function summarizeOutOfBoundsByFrame(hits: OutOfBoundsHit[]): OutOfBoundsFrameSummary[] {
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
    const nameList = names.length > 2
      ? tr("dap.bounds.parts_many", {
          names: names.slice(0, 2).join(", "),
          count: names.length,
        })
      : names.join(", ");
    return { frame, description: tr("dap.bounds.frame", {
      frame,
      parts: nameList,
      field: worst.field,
      axis: worst.axis,
      value: worst.value.toFixed(2),
    }) };
  });
}

/** Returns a readable warning, or null when every frame is in range. */
export function describeOutOfBounds(hits: OutOfBoundsHit[]): string | null {
  if (!hits.length) return null;

  const lines = summarizeOutOfBoundsByFrame(hits).map((item) => item.description);
  const shown = lines.slice(0, 12);
  const omitted = lines.length - shown.length;

  const parts = [
    tr("dap.bounds.summary", { frames: lines.length }),
    "",
    tr("dap.bounds.guidance"),
    "",
    ...shown,
  ];
  if (omitted > 0) {
    parts.push(tr("dap.bounds.omitted", { count: omitted }));
  }
  return parts.join("\n");
}
