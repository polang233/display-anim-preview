/** 范围检测共用的异步进度与取消协议。 */

export interface BoundsProgress {
  mode: "quick" | "exact";
  animationUuid: string;
  animationName: string;
  animationFrame: number;
  animationFrames: number;
  completedFrames: number;
  totalFrames: number;
}

export interface BoundsTaskControl {
  isCancelled(): boolean;
  onProgress?(progress: BoundsProgress): void;
}

export class BoundsTaskCancelledError extends Error {
  constructor() {
    super("Bounds check cancelled");
    this.name = "BoundsTaskCancelledError";
  }
}

export function assertBoundsTaskActive(control: BoundsTaskControl): void {
  if (control.isCancelled()) throw new BoundsTaskCancelledError();
}

/** 在帧之间把控制权交还 Blockbench，使进度条和取消按钮能够刷新。 */
export function yieldBoundsTask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
