import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const i18nPath = fileURLToPath(new URL("../src/i18n.ts", import.meta.url));

async function runBuild(forcedLanguage, selectedLanguage) {
  const entry = `
    const translations = {};
    globalThis.Language = {
      addTranslations(language, values) {
        translations[language] = values;
      }
    };
    globalThis.tl = key => translations[${JSON.stringify(selectedLanguage)}]?.[key] ?? key;
    const i18n = await import(${JSON.stringify(i18nPath)});
    i18n.registerTranslations();
    globalThis.__I18N_RESULT__ = {
      title: i18n.tr("dap.export.complete"),
      warning: i18n.tr("dap.export.resampled_message", {
        source_fps: 10,
        game_fps: 20,
        frames: 21
      }),
      forced: i18n.isChineseOnlyBuild()
    };
  `;
  const output = await build({
    stdin: {
      contents: entry,
      resolveDir: process.cwd(),
      sourcefile: "i18n-test.ts",
      loader: "ts",
    },
    bundle: true,
    write: false,
    platform: "node",
    format: "esm",
    target: "node20",
    define: {
      __DAP_FORCE_LANGUAGE__: forcedLanguage,
    },
  });
  await import(
    `data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString("base64")}`
  );
  return globalThis.__I18N_RESULT__;
}

const universalChinese = await runBuild("null", "zh");
if (universalChinese.title !== "导出完成" || universalChinese.forced) {
  throw new Error("universal build did not follow the selected Blockbench language");
}

const forcedChinese = await runBuild('"zh"', "en");
if (forcedChinese.title !== "导出完成" || !forcedChinese.forced) {
  throw new Error("Simplified Chinese build did not override the Blockbench language");
}
if (!forcedChinese.warning.includes("10 FPS") || !forcedChinese.warning.includes("21 帧")) {
  throw new Error("Simplified Chinese replacement text was not rendered correctly");
}

process.stdout.write(JSON.stringify({ universalChinese, forcedChinese }));
