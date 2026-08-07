import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const exportDialogPath = fileURLToPath(
  new URL("../src/export-dialog.ts", import.meta.url)
);

const entry = `
  globalThis.tl = key => key;
  let shown = null;
  globalThis.Blockbench = {
    showMessageBox(options, callback) {
      shown = { options, callback };
    }
  };

  const { confirmWarnings } = await import(${JSON.stringify(exportDialogPath)});
  const acceptedPromise = confirmWarnings([
    { title: "Texture warning", message: "Texture details" },
    { title: "Bounds warning", message: "Bounds details" }
  ]);
  if (!shown) throw new Error("warning confirmation dialog was not shown");
  if (!shown.options.message.includes("Texture details") ||
      !shown.options.message.includes("Bounds details")) {
    throw new Error("export warnings were not combined into one confirmation");
  }
  shown.callback(1);
  if (await acceptedPromise !== true) {
    throw new Error("confirm button did not continue export");
  }

  const cancelledPromise = confirmWarnings([
    { title: "Warning", message: "Details" }
  ]);
  shown.callback(0);
  if (await cancelledPromise !== false) {
    throw new Error("cancel button did not stop export");
  }

  if (await confirmWarnings([]) !== true) {
    throw new Error("empty warning list did not continue immediately");
  }
`;

const output = await build({
  stdin: {
    contents: entry,
    resolveDir: process.cwd(),
    sourcefile: "export-confirmation-test.ts",
    loader: "ts",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  target: "node20",
  define: {
    __DAP_FORCE_LANGUAGE__: "null",
  },
});

await import(
  `data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString("base64")}`
);
