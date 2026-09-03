/** Waits for Blockbench's single active Undo transaction to finish without disturbing it. */

export interface UndoIdleWaitOptions {
  initialDelayMs?: number;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

/**
 * Blockbench does not support nested Undo transactions. Some integrations briefly wrap an
 * action invocation in their own transaction, so callers must wait until that transaction has
 * committed before starting temporary bake edits.
 */
export function waitForUndoIdle(options: UndoIdleWaitOptions = {}): Promise<boolean> {
  const initialDelayMs = options.initialDelayMs ?? 50;
  const pollIntervalMs = options.pollIntervalMs ?? 50;
  const timeoutMs = options.timeoutMs ?? 5000;
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve) => {
    const check = (): void => {
      if (!Undo.current_save) {
        resolve(true);
        return;
      }
      if (Date.now() >= deadline) {
        resolve(false);
        return;
      }
      setTimeout(check, pollIntervalMs);
    };
    setTimeout(check, initialDelayMs);
  });
}
