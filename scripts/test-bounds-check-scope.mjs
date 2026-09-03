import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const modulePath = fileURLToPath(new URL("../src/bounds-check-panel.ts", import.meta.url));
const entry = `
  globalThis.tl = key => key;
  const a = { uuid: "a", name: "Idle" };
  const b = { uuid: "b", name: "Reload" };
  const duplicateB = { uuid: "b", name: "Reload Duplicate" };
  globalThis.Animation = { all: [a, b], selected: a };
  const timers = [];
  globalThis.document = { activeElement: { blur() {} } };
  globalThis.Undo = { current_save: null };
  let modeDialogCount = 0;
  globalThis.Blockbench = {
    showQuickMessage() {},
    showMessageBox() { modeDialogCount++; },
  };
  globalThis.setTimeout = callback => { timers.push(callback); return timers.length; };
  const { resolveBoundsCheckAnimations, runBoundsCheck } = await import(${JSON.stringify(modulePath)});
  const all = resolveBoundsCheckAnimations();
  if (all.length !== 2 || all[0] !== a || all[1] !== b) {
    throw new Error("manual bounds check did not include every project animation");
  }
  const selectedExport = resolveBoundsCheckAnimations([b, a, duplicateB]);
  if (selectedExport.length !== 2 || selectedExport[0] !== b || selectedExport[1] !== a) {
    throw new Error("export bounds check did not preserve and deduplicate the selected animation group");
  }
  const c = { uuid: "c", name: "New Animation" };
  Animation.all.push(c);
  const refreshed = resolveBoundsCheckAnimations();
  if (refreshed.length !== 3 || refreshed[2] !== c) {
    throw new Error("recheck did not resolve the current animation list");
  }
  runBoundsCheck();
  runBoundsCheck();
  if (modeDialogCount !== 2 || timers.length !== 0) {
    throw new Error("mode selection should not start scanning before the user chooses a mode");
  }
`;

const output = await build({
  stdin: { contents: entry, resolveDir: process.cwd(), sourcefile: "bounds-check-scope-test.ts", loader: "ts" },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  target: "node20",
  define: { __DAP_FORCE_LANGUAGE__: "null" },
});

await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString("base64")}`);

const undoIdlePath = fileURLToPath(new URL("../src/undo-idle.ts", import.meta.url));
const undoIdleEntry = `
  const timers = [];
  globalThis.Undo = { current_save: { source: "MCP action" } };
  globalThis.setTimeout = callback => { timers.push(callback); return timers.length; };
  const { waitForUndoIdle } = await import(${JSON.stringify(undoIdlePath)});
  const waiting = waitForUndoIdle({ timeoutMs: 100000 });
  if (timers.length !== 1) throw new Error("Undo-idle wait did not schedule its initial check");
  timers.shift()();
  if (timers.length !== 1) throw new Error("Undo-idle wait did not retry a busy transaction");
  Undo.current_save = null;
  timers.shift()();
  if (!(await waiting)) throw new Error("Undo-idle wait did not continue after the transaction committed");
`;

const undoIdleOutput = await build({
  stdin: { contents: undoIdleEntry, resolveDir: process.cwd(), sourcefile: "undo-idle-test.ts", loader: "ts" },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  target: "node20",
});

await import(`data:text/javascript;base64,${Buffer.from(undoIdleOutput.outputFiles[0].contents).toString("base64")}`);
