import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const entry = `
  import {
    FORMAT_COORDINATE_OPTIONS,
    FORMAT_ID,
    registerModelFormat,
    unregisterModelFormat,
  } from ${JSON.stringify(
    fileURLToPath(new URL("../src/format.ts", import.meta.url))
  )};
  import { resolveJavaBlockCodec } from ${JSON.stringify(
    fileURLToPath(new URL("../src/java-block-codec.ts", import.meta.url))
  )};

  if (FORMAT_COORDINATE_OPTIONS.centered_grid !== false) {
    throw new Error("the plugin format must use the Minecraft non-centered grid");
  }

  globalThis.Codecs = {
    java_block: { id: "java_block_codec", compile() { return "{}"; } }
  };
  globalThis.Formats = { java_block: { codec: globalThis.Codecs.java_block } };
  const translations = {};
  globalThis.Language = {
    addTranslations(language, values) {
      translations[language] = values;
    },
  };
  globalThis.tl = (key) => translations.en?.[key] ?? key;
  const { registerTranslations } = await import(${JSON.stringify(
    fileURLToPath(new URL("../src/i18n.ts", import.meta.url))
  )});
  registerTranslations();
  globalThis.ModelFormat = class {
    constructor(id, options) {
      Object.assign(this, options, { id });
      globalThis.Formats[id] = this;
    }

    delete() {
      if (globalThis.Formats[this.id] === this) {
        delete globalThis.Formats[this.id];
      }
    }
  };

  registerModelFormat();
  const owned = globalThis.Formats[FORMAT_ID];
  if (!owned || owned.centered_grid !== false || owned.codec !== globalThis.Codecs.java_block) {
    throw new Error("standalone format registration failed");
  }
  unregisterModelFormat();
  if (globalThis.Formats[FORMAT_ID]) {
    throw new Error("owned format was not removed during unload");
  }

  let externalDeletes = 0;
  const external = {
    name: "External Format",
    delete() {
      externalDeletes += 1;
    },
  };
  globalThis.Formats.external_sequence_format = external;
  registerModelFormat();
  if (!globalThis.Formats[FORMAT_ID]) {
    throw new Error("independent format was not registered during coexistence");
  }
  unregisterModelFormat();
  if (globalThis.Formats.external_sequence_format !== external || externalDeletes !== 0) {
    throw new Error("external format was removed during unload");
  }
  if (external.name !== "External Format") {
    throw new Error("external format name was not restored during unload");
  }

  const retainedBuiltInCodec = globalThis.Formats.java_block.codec;
  globalThis.Format = { id: "legacy_sequence", codec: null };
  delete globalThis.Codecs.java_block;
  if (resolveJavaBlockCodec() !== retainedBuiltInCodec) {
    throw new Error("legacy-format fallback did not use the retained built-in Java codec");
  }

  process.stdout.write(JSON.stringify({
    ...FORMAT_COORDINATE_OPTIONS,
    standalone: true,
    coexistence: true,
    legacyCodecFallback: true,
  }));
`;

const output = await build({
  stdin: {
    contents: entry,
    resolveDir: process.cwd(),
    sourcefile: "format-test.ts",
    loader: "ts",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  target: "node20",
});

await import(
  `data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString("base64")}`
);
