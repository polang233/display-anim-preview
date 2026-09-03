import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const modulePath = fileURLToPath(new URL("../src/resource-pack.ts", import.meta.url));
const entry = `
  import { buildResourcePack } from ${JSON.stringify(modulePath)};
  globalThis.tl = key => key;
  globalThis.Texture = { all: [{ id:"0", name:"gun.png", width:16, height:16,
    javaTextureLink(){ return "item/gun"; }, getDataURL(){ return "data:image/png;base64,AA=="; } }] };
  const assert = (v,m) => { if(!v) throw new Error(m); };
  const same = (a,b,m) => { if(JSON.stringify(a)!==JSON.stringify(b)) throw new Error(m+JSON.stringify(a)); };
  const frame = (index,x) => ({ frame:index, json:JSON.stringify({textures:{"0":"item/gun"},elements:[{from:[x,0,0],to:[x+1,1,1],faces:{north:{texture:"#0"}}}]}) });
  const a=frame(0,0), b=frame(1,1);
  const result = buildResourcePack([
    {key:"reload",sourceName:"Reload",frames:[b,a]},
    {key:"idle",sourceName:"Idle",frames:[a,b,a]}
  ], {packName:"Map Pack",projectName:"resin_gun",description:"test",defaultAnimationKey:"idle",displayContexts:[
    {context:"gui",animated:false},{context:"firstperson_righthand",animated:true},{context:"thirdperson_righthand",animated:false}
  ]});
  const paths = new Set(result.files.map(f=>f.path));
  assert(paths.has("assets/jsb/items/resin_gun.json"), "fixed jsb item path missing");
  assert(paths.has("assets/jsb/textures/item/resin_gun/gun.png"), "fixed jsb item-atlas texture path missing");
  const generated = result.files.find(file => file.path === "assets/jsb/models/resin_gun/_generated/model_0.json");
  assert(generated?.content.includes("jsb:item/resin_gun/gun"), "generated model must use item-atlas texture id");
  assert(paths.has("assets/jsb/models/resin_gun/reload/fp_r/0.json"), "animated slot alias missing");
  assert(paths.has("assets/jsb/models/resin_gun/idle/fp_r/2.json"), "local frame alias missing");
  for (const forbidden of ["/gui/","/tp_r/","/fp_l/","/_static/"]) {
    assert(![...paths].some(p=>p.includes(forbidden)), "static/disabled slot folder generated: "+forbidden);
  }
  const aliases = result.files.filter(f=>f.path.includes("/fp_r/"));
  assert(aliases.length===5, "expected one lightweight alias per sampled animated-context frame");
  for (const alias of aliases) {
    const model=JSON.parse(alias.content);
    assert(Object.keys(model).join() === "parent" && model.parent.startsWith("jsb:resin_gun/_generated/model_"),
      "alias is not a parent-only lightweight model");
  }
  assert(result.files.filter(f=>f.path.includes("/_generated/model_")).length===2, "global geometry dedup failed");
  assert(result.report.sampledFrames===5 && result.report.uniqueModels===2 && result.report.duplicateFrames===3,
    "dedup report is wrong");
  same(result.report.animatedContextFolders,["fp_r"],"animated context folder report is wrong");

  const item=JSON.parse(result.files.find(f=>f.path==="assets/jsb/items/resin_gun.json").content);
  const gui=item.model.cases.find(v=>v.when==="gui");
  const fp=item.model.cases.find(v=>v.when==="firstperson_righthand");
  assert(gui.model.type==="minecraft:model" && gui.model.model.startsWith("jsb:resin_gun/_generated/"),
    "static context does not directly reference default generated model");
  assert(fp.model.type==="minecraft:select" && fp.model.property==="minecraft:custom_model_data" && fp.model.index===0,
    "animation string selector missing");
  const idle=fp.model.cases.find(v=>v.when==="idle"), reload=fp.model.cases.find(v=>v.when==="reload");
  assert(idle.model.type==="minecraft:range_dispatch" && idle.model.index===0, "float frame selector missing");
  same(idle.model.entries.map(v=>v.threshold),[0,1,2],"idle local frames wrong");
  same(reload.model.entries.map(v=>v.threshold),[0,1],"reload local frames wrong");
  same(fp.model.fallback,idle.model,"invalid animation key does not fall back to default track");
  same(item.model.fallback,gui.model,"unknown display context does not fall back to static model");

  const allStatic=buildResourcePack([{key:"idle",sourceName:"Idle",frames:[a]}],{
    packName:"Static",projectName:"static_item",description:"test",defaultAnimationKey:"idle",
    displayContexts:[{context:"gui",animated:false},{context:"firstperson_righthand",animated:false}]
  });
  const staticPaths=allStatic.files.map(f=>f.path);
  assert(staticPaths.filter(p=>p.includes("assets/jsb/models/static_item/")).length===1,
    "all-static export wrote more than the one generated model");
  assert(staticPaths.some(p=>p.endsWith("/_generated/model_0.json")),"all-static model_0 missing");
  assert(allStatic.report.animatedContextFolders.length===0,"all-static report lists animated folders");

  let unknown=false;
  try { buildResourcePack([{key:"idle",sourceName:"Idle",frames:[a]}],{
    packName:"Bad",projectName:"bad",description:"test",defaultAnimationKey:"idle",
    displayContexts:[{context:"future_context",animated:true}]
  }); } catch(error) { unknown=String(error).includes("Unknown display context"); }
  assert(unknown,"unknown animated display context was accepted");
  process.stdout.write(JSON.stringify(result.report));
`;
const output=await build({stdin:{contents:entry,resolveDir:process.cwd(),sourcefile:"resource-test.ts",loader:"ts"},bundle:true,write:false,platform:"node",format:"esm",target:"node20",define:{__DAP_FORCE_LANGUAGE__:"null"}});
await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString("base64")}`);
