import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const entry = `
  import {
    getDisplayAnimationEnabled,
    setDisplayAnimationEnabled,
    configuredDisplayAnimations
  } from ${JSON.stringify(
    fileURLToPath(new URL("../src/display-animation-settings.ts", import.meta.url))
  )};

  globalThis.Project = {
    saved: true,
    display_anim_variants: {
      thirdperson_righthand: { groupUuid: "legacy-group", animated: false },
      firstperson_righthand: { groupUuid: "another-group", animated: true }
    }
  };

  if (getDisplayAnimationEnabled("thirdperson_righthand") !== false) {
    throw new Error("third-person setting was not read independently");
  }
  if (getDisplayAnimationEnabled("firstperson_righthand") !== true) {
    throw new Error("first-person setting was not read independently");
  }

  setDisplayAnimationEnabled("thirdperson_righthand", true);
  if (getDisplayAnimationEnabled("firstperson_righthand") !== true) {
    throw new Error("changing third-person overwrote first-person");
  }
  setDisplayAnimationEnabled("firstperson_righthand", false);
  if (getDisplayAnimationEnabled("thirdperson_righthand") !== true) {
    throw new Error("changing first-person overwrote third-person");
  }

  const serialized = JSON.stringify(Project.display_anim_variants);
  if (serialized.includes("groupUuid")) {
    throw new Error("legacy slot-model data was not removed");
  }
  if (Project.saved !== false) {
    throw new Error("setting change did not mark project dirty");
  }

  const routes = configuredDisplayAnimations();
  const gui = routes.find(route => route.context.id === "gui");
  if (!gui || gui.animated !== false) {
    throw new Error("GUI default animation state is wrong");
  }

  process.stdout.write(serialized);
`;

const output = await build({
  stdin: {
    contents: entry,
    resolveDir: process.cwd(),
    sourcefile: "display-settings-test.ts",
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
