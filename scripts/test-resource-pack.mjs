import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const entry = `
  import { buildResourcePack } from ${JSON.stringify(
    fileURLToPath(new URL("../src/resource-pack.ts", import.meta.url))
  )};
  import { applyCompiledDisplaySnapshot } from ${JSON.stringify(
    fileURLToPath(new URL("../src/display-snapshot.ts", import.meta.url))
  )};

  globalThis.Texture = {
    all: [{
      id: "0",
      name: "test.png",
      width: 16,
      height: 16,
      javaTextureLink() { return "block/test"; },
      getDataURL() { return "data:image/png;base64,AA=="; }
    }]
  };

  const frame = (index, x) => ({
    frame: index,
    json: JSON.stringify({
      textures: { "0": "block/test" },
      elements: [{
        from: [x, 0, 0],
        to: [x + 1, 1, 1],
        faces: { north: { texture: "#0" } }
      }]
    })
  });
  const a = frame(0, 0);
  const b = frame(1, 1);
  const result = buildResourcePack([a, b, a], {
    packName: "test",
    namespace: "test",
    itemModel: "item",
    description: "test",
    displayContexts: [
      { context: "gui", animated: false },
      { context: "firstperson_righthand", animated: true }
    ]
  });

  const itemFile = result.files.find(file => file.path === "assets/test/items/item.json");
  const definition = JSON.parse(itemFile.content);
  if (definition.model.type !== "minecraft:select") throw new Error("missing display-context select");
  if (definition.model.property !== "minecraft:display_context") throw new Error("wrong select property");
  const firstPerson = definition.model.cases.find(entry => entry.when === "firstperson_righthand");
  if (firstPerson.model.type !== "minecraft:range_dispatch") throw new Error("animated route missing");
  if (result.report.sampledFrames !== 3) throw new Error("wrong sampled frame count");
  if (result.report.uniqueModels !== 2) throw new Error("exact-frame deduplication failed");
  if (result.report.duplicateFrames !== 1) throw new Error("wrong duplicate count");
  if (result.files.filter(file => file.path.includes("/generated/model_")).length !== 2) {
    throw new Error("wrong generated model file count");
  }
  const firstModel = JSON.parse(
    result.files.find(file => file.path.includes("/generated/model_0.json")).content
  );
  if (firstModel.textures.particle !== "#0") {
    throw new Error("particle texture fallback was not generated");
  }

  const collapsed = buildResourcePack([a, a, a], {
    packName: "test",
    namespace: "test",
    itemModel: "collapsed",
    description: "test",
    displayContexts: [
      { context: "firstperson_righthand", animated: true }
    ]
  });
  const collapsedItem = JSON.parse(
    collapsed.files.find(file => file.path === "assets/test/items/collapsed.json").content
  );
  const collapsedRoute = collapsedItem.model.cases[0].model;
  if (collapsedRoute.type !== "minecraft:model") {
    throw new Error("identical animated frames were not collapsed to one static route");
  }

  const sanitized = buildResourcePack([{
      frame: 0,
      json: JSON.stringify({
        elements: [{
          faces: { north: { texture: "#missing" } }
        }]
      })
    }], {
      packName: "test",
      namespace: "test",
      itemModel: "broken",
      description: "test"
    });
  if (sanitized.report.omittedUntexturedFaces !== 1) {
    throw new Error("missing-texture face was not omitted");
  }
  if (sanitized.report.omittedEmptyElements !== 1) {
    throw new Error("element with no visible faces was not omitted");
  }
  const sanitizedModel = JSON.parse(
    sanitized.files.find(file => file.path.includes("/generated/model_0.json")).content
  );
  if (sanitizedModel.elements?.length) {
    throw new Error("empty untextured element remained in generated model");
  }

  const currentDisplay = {
    firstperson_righthand: {
      translation: [-10.5, 7.25, 1.25],
      scale: [0.37, 0.37, 0.37]
    }
  };
  const correctedFrame = JSON.parse(applyCompiledDisplaySnapshot(
    JSON.stringify({
      display: {
        firstperson_righthand: { translation: [-10, 7.25, 1.25] }
      }
    }),
    currentDisplay
  ));
  if (correctedFrame.display.firstperson_righthand.translation[0] !== -10.5) {
    throw new Error("stale per-frame display transform was not replaced");
  }

  process.stdout.write(JSON.stringify(result.report));
`;

const output = await build({
  stdin: {
    contents: entry,
    resolveDir: process.cwd(),
    sourcefile: "resource-pack-test.ts",
    loader: "ts",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  target: "node20",
});

await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString("base64")}`);
