/** Builds the Minecraft 26.2 datapack that drives baked item animations. */

import { tr } from "./i18n";

const DATA_PACK_FORMAT: [number, number] = [107, 1];

export interface DatapackOptions {
  packName: string;
  dataNamespace: string;
  assetNamespace: string;
  itemModel: string;
  baseItem: string;
  itemDisplayName: string;
  frameObjective: string;
  modeObjective: string;
  playingTag: string;
  frameCount: number;
  description: string;
}

export interface DatapackFile {
  path: string;
  content: string;
}

function prefix(options: DatapackOptions): string {
  return `{"text":"[${options.packName}] ","color":"gold"}`;
}

function tellraw(
  options: DatapackOptions,
  text: string,
  color: string,
  target = "@s"
): string {
  return `tellraw ${target} [${prefix(options)},{"text":${JSON.stringify(text)},"color":"${color}"}]`;
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function lines(...commands: string[]): string {
  return `${commands.join("\n")}\n`;
}

/** Escapes JSON used inside a single-quoted item component command value. */
function customNameComponent(name: string): string {
  const component = JSON.stringify({ text: name, color: "gold", italic: false })
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
  return `minecraft:custom_name='${component}'`;
}

export function buildDatapack(options: DatapackOptions): DatapackFile[] {
  const {
    dataNamespace: ns,
    frameObjective: frameScore,
    modeObjective: modeScore,
    playingTag: tag,
    frameCount,
  } = options;
  const lastFrame = Math.max(frameCount - 1, 0);
  const itemModelId = `${options.assetNamespace}:${options.itemModel}`;
  const heldItem = `*[minecraft:item_model="${itemModelId}"]`;
  const ifHeld = `execute if items entity @s weapon.mainhand ${heldItem} run`;
  const applyFrame = `${ifHeld} item modify entity @s weapon.mainhand ${ns}:set_frame`;
  const files: DatapackFile[] = [];
  const fn = (name: string, content: string): void => {
    files.push({ path: `data/${ns}/function/${name}.mcfunction`, content });
  };

  files.push({
    path: "pack.mcmeta",
    content: json({
      pack: {
        description: options.description,
        min_format: DATA_PACK_FORMAT,
        max_format: DATA_PACK_FORMAT,
      },
    }),
  });

  fn(
    "load",
    lines(
      `scoreboard objectives add ${frameScore} dummy`,
      `scoreboard objectives add ${modeScore} dummy`,
      tellraw(options, tr("dap.datapack.loaded", { namespace: ns }), "green", "@a")
    )
  );

  // Stop immediately when the player switches items so unrelated items are never modified.
  fn(
    "tick",
    lines(
      `execute as @a[tag=${tag}] unless items entity @s weapon.mainhand ${heldItem} run scoreboard players set @s ${modeScore} 0`,
      `execute as @a[tag=${tag}] unless items entity @s weapon.mainhand ${heldItem} run tag @s remove ${tag}`,
      `execute as @a[tag=${tag}] if items entity @s weapon.mainhand ${heldItem} run function ${ns}:_tick_player`
    )
  );

  fn(
    "_tick_player",
    lines(
      `scoreboard players add @s ${frameScore} 1`,
      `execute if score @s ${modeScore} matches 1 if score @s ${frameScore} matches ${frameCount}.. run scoreboard players set @s ${frameScore} 0`,
      `execute if score @s ${modeScore} matches 2 if score @s ${frameScore} matches ${frameCount}.. run scoreboard players set @s ${frameScore} ${lastFrame}`,
      applyFrame,
      `execute if score @s ${modeScore} matches 2 if score @s ${frameScore} matches ${lastFrame} run tag @s remove ${tag}`
    )
  );

  fn(
    "give",
    lines(
      `give @s ${options.baseItem}[minecraft:item_model="${itemModelId}",minecraft:custom_model_data={floats:[0.0]},${customNameComponent(options.itemDisplayName)}]`,
      `scoreboard players set @s ${frameScore} 0`,
      `scoreboard players set @s ${modeScore} 0`,
      `tag @s remove ${tag}`,
      tellraw(options, tr("dap.datapack.item_given"), "green")
    )
  );

  const startGuard = `execute unless items entity @s weapon.mainhand ${heldItem} run`;
  fn(
    "play_loop",
    lines(
      `${startGuard} ${tellraw(options, tr("dap.datapack.hold_item"), "red")}`,
      `${ifHeld} scoreboard players set @s ${frameScore} 0`,
      `${ifHeld} scoreboard players set @s ${modeScore} 1`,
      applyFrame,
      `${ifHeld} tag @s add ${tag}`,
      `${ifHeld} ${tellraw(options, tr("dap.datapack.loop_started", { last_frame: lastFrame }), "green")}`
    )
  );

  fn(
    "play_once",
    lines(
      `${startGuard} ${tellraw(options, tr("dap.datapack.hold_item"), "red")}`,
      `${ifHeld} scoreboard players set @s ${frameScore} 0`,
      `${ifHeld} scoreboard players set @s ${modeScore} 2`,
      applyFrame,
      `${ifHeld} tag @s add ${tag}`,
      `${ifHeld} ${tellraw(options, tr("dap.datapack.once_started", { last_frame: lastFrame }), "green")}`
    )
  );

  const frameReadout = `tellraw @s [${prefix(options)},{"text":${JSON.stringify(tr("dap.datapack.current_frame"))},"color":"gold"},{"score":{"name":"@s","objective":"${frameScore}"},"color":"aqua"}]`;
  fn(
    "next",
    lines(
      `${ifHeld} tag @s remove ${tag}`,
      `${ifHeld} scoreboard players add @s ${frameScore} 1`,
      `${ifHeld} execute if score @s ${frameScore} matches ${frameCount}.. run scoreboard players set @s ${frameScore} 0`,
      applyFrame,
      `${ifHeld} ${frameReadout}`
    )
  );
  fn(
    "prev",
    lines(
      `${ifHeld} tag @s remove ${tag}`,
      `${ifHeld} scoreboard players remove @s ${frameScore} 1`,
      `${ifHeld} execute if score @s ${frameScore} matches ..-1 run scoreboard players set @s ${frameScore} ${lastFrame}`,
      applyFrame,
      `${ifHeld} ${frameReadout}`
    )
  );
  fn(
    "reset",
    lines(
      `${ifHeld} tag @s remove ${tag}`,
      `${ifHeld} scoreboard players set @s ${frameScore} 0`,
      `${ifHeld} scoreboard players set @s ${modeScore} 0`,
      applyFrame,
      `${ifHeld} ${tellraw(options, tr("dap.datapack.reset"), "green")}`
    )
  );
  fn(
    "stop",
    lines(
      `tag @s remove ${tag}`,
      `scoreboard players set @s ${modeScore} 0`,
      tellraw(options, tr("dap.datapack.stopped"), "yellow")
    )
  );

  files.push({
    path: `data/${ns}/item_modifier/set_frame.json`,
    content: json({
      function: "minecraft:set_custom_model_data",
      floats: {
        values: [{ type: "minecraft:score", target: "this", score: frameScore }],
        mode: "replace_all",
      },
    }),
  });
  files.push({
    path: "data/minecraft/tags/function/load.json",
    content: json({ values: [`${ns}:load`] }),
  });
  files.push({
    path: "data/minecraft/tags/function/tick.json",
    content: json({ values: [`${ns}:tick`] }),
  });

  return files;
}
