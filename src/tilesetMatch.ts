import {promises as nodeFS} from "fs";
import * as nodePath from "path";
import { promisify } from "util";
import getPixels from "get-pixels";

import * as dungeonsFS from "./dungeonsFS";
import GidFlags from "./GidFlags";
import { TilesetShape } from "./dungeonChunkAssembler";

interface TilesetJson extends Record<string,any> { 
  name: string,
  tilecount: number,
  tileproperties:{
    [key: string] : any,
  }
};

enum TILESETMAT_NAME {
  materials = "materials",
  supports = "supports",
  liquids = "liquids",
  misc = "miscellaneous",
} //as const;

const TSJSON_OBJ_BY_CAT = [
  "objects-by-category/actionfigure",
  "objects-by-category/artifact",
  "objects-by-category/bug",
  "objects-by-category/breakable",
  "objects-by-category/crafting",
  "objects-by-category/decorative",
  "objects-by-category/door",
  "objects-by-category/farmable",
  "objects-by-category/farmbeastegg",
  "objects-by-category/fridgestorage",
  "objects-by-category/furniture",
  "objects-by-category/genboss",
  "objects-by-category/generic",
  "objects-by-category/light",
  "objects-by-category/other",
  "objects-by-category/playerstation",
  "objects-by-category/pot",
  "objects-by-category/rail",
  "objects-by-category/railpoint",
  "objects-by-category/refinery",
  "objects-by-category/sapling",
  "objects-by-category/seed",
  "objects-by-category/shippingcontainer",
  "objects-by-category/spawner",
  "objects-by-category/storage",
  "objects-by-category/techmanagement",
  "objects-by-category/teleporter",
  "objects-by-category/teleportmarker",
  "objects-by-category/terraformer",
  "objects-by-category/tool",
  "objects-by-category/tools",
  "objects-by-category/trap",
  "objects-by-category/wire",
] as const;
const TSJSON_OBJ_BY_COLTAG = [
  "objects-by-colonytag/agaran",
  "objects-by-colonytag/alien",
  "objects-by-colonytag/alpaca",
  "objects-by-colonytag/alpine",
  "objects-by-colonytag/ancient",
  "objects-by-colonytag/apexcamp",
  "objects-by-colonytag/apex",
  "objects-by-colonytag/apexmansion",
  "objects-by-colonytag/apexmission1",
  "objects-by-colonytag/apexresearchlab",
  "objects-by-colonytag/apexvillage",
  "objects-by-colonytag/astro",
  "objects-by-colonytag/astronaut",
  "objects-by-colonytag/avianairship",
  "objects-by-colonytag/avian",
  "objects-by-colonytag/aviantemple",
  "objects-by-colonytag/aviantomb",
  "objects-by-colonytag/avianvillage",
  "objects-by-colonytag/bench",
  "objects-by-colonytag/bioluminescence",
  "objects-by-colonytag/bone",
  "objects-by-colonytag/cabin",
  "objects-by-colonytag/cell",
  "objects-by-colonytag/christmas",
  "objects-by-colonytag/colourful",
  "objects-by-colonytag/combat",
  "objects-by-colonytag/commerce",
  "objects-by-colonytag/cooking",
  "objects-by-colonytag/copper",
  "objects-by-colonytag/coral",
  "objects-by-colonytag/crafting",
  "objects-by-colonytag/crystalline",
  "objects-by-colonytag/cultist",
  "objects-by-colonytag/dark",
  "objects-by-colonytag/doom",
  "objects-by-colonytag/door",
  "objects-by-colonytag/egyptian",
  "objects-by-colonytag/electronic",
  "objects-by-colonytag/evil",
  "objects-by-colonytag/executive",
  "objects-by-colonytag/explorer",
  "objects-by-colonytag/eyepatch",
  "objects-by-colonytag/farming",
  "objects-by-colonytag/farm",
  "objects-by-colonytag/fenerox",
  "objects-by-colonytag/flesh",
  "objects-by-colonytag/floranhuntinggrounds",
  "objects-by-colonytag/floran",
  "objects-by-colonytag/floranprison",
  "objects-by-colonytag/floranvillage",
  "objects-by-colonytag/fossil",
  "objects-by-colonytag/foundry",
  "objects-by-colonytag/frozenfire",
  "objects-by-colonytag/geode",
  "objects-by-colonytag/geometric",
  "objects-by-colonytag/giantflower",
  "objects-by-colonytag/glitchcastle",
  "objects-by-colonytag/glitch",
  "objects-by-colonytag/glitchsewer",
  "objects-by-colonytag/glitchvillage",
  "objects-by-colonytag/gnome",
  "objects-by-colonytag/gothic",
  "objects-by-colonytag/hive",
  "objects-by-colonytag/hoard",
  "objects-by-colonytag/humanbunker",
  "objects-by-colonytag/human",
  "objects-by-colonytag/humanprison",
  "objects-by-colonytag/humanvillage",
  "objects-by-colonytag/hylotl",
  "objects-by-colonytag/hylotloceancity",
  "objects-by-colonytag/hylotlvillage",
  "objects-by-colonytag/ice",
  "objects-by-colonytag/industrial",
  "objects-by-colonytag/island",
  "objects-by-colonytag/jungle",
  "objects-by-colonytag/knowledge",
  "objects-by-colonytag/light",
  "objects-by-colonytag/lunarbase",
  "objects-by-colonytag/mechanical",
  "objects-by-colonytag/mech",
  "objects-by-colonytag/medical",
  "objects-by-colonytag/mining",
  "objects-by-colonytag/misc",
  "objects-by-colonytag/mushroompatch",
  "objects-by-colonytag/musical",
  "objects-by-colonytag/naturalcave",
  "objects-by-colonytag/nature",
  "objects-by-colonytag/neon",
  "objects-by-colonytag/novakid",
  "objects-by-colonytag/novakidvillage",
  "objects-by-colonytag/oasis",
  "objects-by-colonytag/ocean",
  "objects-by-colonytag/odd",
  "objects-by-colonytag/office",
  "objects-by-colonytag/opulent",
  "objects-by-colonytag/outdoor",
  "objects-by-colonytag/outpost",
  "objects-by-colonytag/pastel",
  "objects-by-colonytag/peacekeeper",
  "objects-by-colonytag/pretty",
  "objects-by-colonytag/prism",
  "objects-by-colonytag/protectorate",
  "objects-by-colonytag/rails",
  "objects-by-colonytag/retroscifi",
  "objects-by-colonytag/rust",
  "objects-by-colonytag/saloon",
  "objects-by-colonytag/sandstone",
  "objects-by-colonytag/science",
  "objects-by-colonytag/scorched",
  "objects-by-colonytag/sea",
  "objects-by-colonytag/serene",
  "objects-by-colonytag/sign",
  "objects-by-colonytag/slime",
  "objects-by-colonytag/space",
  "objects-by-colonytag/spooky",
  "objects-by-colonytag/spring",
  "objects-by-colonytag/station",
  "objects-by-colonytag/steampunk",
  "objects-by-colonytag/steamspring",
  "objects-by-colonytag/stonecave",
  "objects-by-colonytag/storage",
  "objects-by-colonytag/swamp",
  "objects-by-colonytag/tar",
  "objects-by-colonytag/technology",
  "objects-by-colonytag/tentacle",
  "objects-by-colonytag/tier1",
  "objects-by-colonytag/tier2",
  "objects-by-colonytag/tier3",
  "objects-by-colonytag/tier4",
  "objects-by-colonytag/toxic",
  "objects-by-colonytag/trap",
  "objects-by-colonytag/traveller",
  "objects-by-colonytag/valentines",
  "objects-by-colonytag/valuable",
  "objects-by-colonytag/volcanic",
  "objects-by-colonytag/wave",
  "objects-by-colonytag/wired",
  "objects-by-colonytag/wreck",
  "objects-by-colonytag/zen",
] as const;
const TSJSON_OBJ_BY_RACE = [
  "objects-by-race/alpaca",
  "objects-by-race/ancient",
  "objects-by-race/apex",
  "objects-by-race/avian",
  "objects-by-race/floran",
  "objects-by-race/generic",
  "objects-by-race/glitch",
  "objects-by-race/human",
  "objects-by-race/hylotl",
  "objects-by-race/novakid",
  "objects-by-race/protectorate",
  "objects-by-race/tentacle"
] as const;
const TSJSON_OBJ_BY_TYPE = [
  "objects-by-type/container",
  "objects-by-type/farmable",
  "objects-by-type/loungeable",
  "objects-by-type/noisy",
  "objects-by-type/physics",
  "objects-by-type/teleporter",
] as const;

const TILESETOBJ_NAME = {
  objHuge: "huge-objects",
  byCategory: TSJSON_OBJ_BY_CAT,
  byColonyTag: TSJSON_OBJ_BY_COLTAG,
  byRace: TSJSON_OBJ_BY_RACE, 
  byType: TSJSON_OBJ_BY_TYPE,
} as const;

const MISCJSON_MAP = [
  "Air",                               //0 - is it ever used?
  "Magic Pink Brush",                  //1 - back
  "Invisible wall (boundary)",         //2 - front (only for quests)
  "Player Start",                      //3 --> anchors etc
  "worldGenMustContainAir",            //4 --> anchors etc
  "worldGenMustContainSolid",          //5 --> anchors etc
  "Biome Item",                        //6 --> objects
  "Biome Tree",                        //7 --> objects
  "Default Surface Tile 0",            //8 - front/back
  "Default Surface Tile 1",            //9 - front/back
  "Default Surface Tile 2",            //10 - front/back
  "Air (overwritable)",                //11 -is it ever used?
  "Red Connector",                     //12 --> anchors etc
  "Yellow Connector",                  //13 --> anchors etc
  "Green Connector",                   //14 --> anchors etc
  "Blue Connector",                    //15 --> anchors etc
  "worldGenMustContainAir (background)",   //16 --> anchors etc
  "worldGenMustContainSolid (background)", //17 --> anchors etc
  "Invisible wall (climbable)",            //18 - front (only for quests)
  "Underwater invisible wall (boundary)",  //19 - front (only for quests)
  "Zero G",                                //20 --> front, but can be ignored? Probably no space maps in old format
  "Zero G (protected)",                    //21 --> front, but can be ignored? Probably no space maps in old format
  "worldGenMustContainLiquid (ocean)",     //22 --> anchors etc
  "worldGenMustNotContainLiquid (ocean)"   //23 --> anchors etc
]; //index = tile #

interface TileSubstanceJson {
  "//name"? : string,
  "//description"? : string,
  "//shortdescription"? : string,
}

interface TileLiquidJson extends TileSubstanceJson {
  source?: "true",
  liquid?: string,
  invalid?: "true"
}

interface TileSolidJson extends TileSubstanceJson {
  material?: string,
  invalid?: "true",
}

interface TilesetMatJson extends TilesetJson {
  name: TILESETMAT_NAME.materials|TILESETMAT_NAME.supports,
  tileproperties:{
    [key: string] : TileSolidJson,
  },
}

interface TilesetLiquidJson extends TilesetJson {
  name: TILESETMAT_NAME.liquids,
  tileproperties:{
    [key: string] : TileLiquidJson,
  },
}

interface ObjectJson {
  "//description": string,
  "//name": string,
  "//shortdescription": string,
  imagePositionX: string,
  imagePositionY: string,
  object: string,
  tilesetDirection: "left" | "right",
}

interface TilesetObjectJson extends TilesetJson {
  //name
  //tilecount
  //tileproperties
  margin: number,
  spacing: number,
  tileheight: number,
  tilewidth: number,
  tileproperties: {
    [key: string]: ObjectJson,
  },
  tiles: {
    [key: string]: {
      image: string,
    },
  }
}

interface TilesetMiscJson extends TilesetJson {
  name: TILESETMAT_NAME.misc,
  tileproperties: {
    [key: string]: {
      "//description": string,
      "//shortdescription": string,
      clear?: "true" | "false",
      allowOverdrawing? : "true",
      surface? : string,
      layer?: "back",
      worldGenMustContainAir?: "",
      worldGenMustContainSolid?: "",
      worldGenMustContainLiquid?: "",
      worldGenMustNotContainLiquid?: ""
      connector?: string,
      material?: string,
      dungeonId?: number,
      playerstart?: "",
      biomeitems?: "",
      biometree?: "",
    }
  }
}

type AnchorBrush = ["clear"|"surface"|"playerstart"];

type FrontOrBack = "front" | "back";

type Brush = ["clear"] |
["surface"|"surfacebackground", {variant:number}?, any?] | //material, tilled? 
["liquid", string] |
[FrontOrBack, string, string?] |
AnchorBrush |
["biometree" | "biomeitems" | "playerstart" | "wire" | "stagehand" | "npc" | "object", any?, {}?];

type RgbaValue = [number, number, number, number];

interface Tile {
  value: RgbaValue, // [R, G, B, A]
  comment?: string,
  brush?: Brush[],
  rules?: (["allowOverdrawing"] | any)[],
  connector?: boolean,
};

const ANCHOR_RULES = [
  "worldGenMustContainSolidBackground",
  "worldGenMustContainAirBackground",
  "worldGenMustContainAirForeground",
] as const;

type AnchorRule = ["allowOverdrawing"] | [typeof ANCHOR_RULES[number]];

interface AnchorTile extends Tile {
  brush?: AnchorBrush[],
  rules?: AnchorRule[],
  connector? : true,
}

type ObjectBrush = ["clear"] |
["liquid", string] |
["object",
  string,
  {
  direction?: "left"|"right",
  parameters?: {}
  },
];

/**
 * broadcast area is leftX, leftY, rightX, rightY
 */
type StagehandBrush = [
  "stagehand",
  {
    type: "objecttracker"|"questlocation",
    parameters: {
      broadcastArea: [number, number, number, number]; //offsets of area from coords - use to cals size
      locationType?: string, //for quest locations only - ref to string describing the location
    },
  },
];

interface StagehandTile extends Tile {
  rules: undefined,
  connector: undefined,
  brush: [StagehandBrush],
}

interface ObjectTile extends Tile {
  //comment can include "facing left/right"
  brush: ObjectBrush[],
  connector: undefined,
}

interface OldTilesetSorted extends Record<string, Tile[]> {
  foreground: Tile[],
  background: Tile[],
  specialforeground: Tile[],
  specialbackground: Tile[],
  special: Tile[],
  anchors: Tile[],
  wires: Tile[],
  stagehands: Tile[],
  npcs: Tile[],
  objects: Tile[],
  undefined: Tile[],
};

type LayerTileMatch = {
  tileName: string,
  tileRgba: RgbaValue,
  tileGid: number,
  rules?: string[];
};

type ModMatch = LayerTileMatch & {
  mod: string,
}

type StagehandMatch = LayerTileMatch & {
  tileGid: 0,
  stagehand: "questlocation"|"objecttracker",
  nameParam?: {
    locationType: string,
  },
  broadcastArea: [number, number, number, number],
}

/**
 * TileId is not Gid but local tileset ID! Requires transforming into Gid before inserting into chunk!
 */
type ObjectTileMatch = {
  tileName: string,
  tileRgba: RgbaValue,
  tileId: number, //Not Gid! Needs conversion to Gid!
  tileIdVariations: {id: number, tileset: string}[],
  tileset: string,
  flipHorizontal?: boolean,
}

type ObjectFullMatch = {
  tileName: string,
  tileRgba: RgbaValue,
  tileId: number,
  tileIdVariations: number[],
  tileGid: number,
  tileset: string
}

type FullTileMatch = {
  front: LayerTileMatch[],
  back: LayerTileMatch[]
}

type NPCBrush = ["npc",
  {
    kind: "monster",
    typeName: string, //monster name
    seed?: "stable";
    parameters?: {
      aggressive?: boolean;
    },
  },
]|["npc",
  {
    kind: "npc",
    typeName: string, //ex: villager, merchant, villageguard, villageguardcaptain
    species: string; //ex: glitch
    parameters?: {
      scriptConfig?: {
        // merchant?: {
        //   categories?: {},
        //   numItems?: number,
        //   priceVarianceRange?: [number, number]
        //   storeRadius?: number,
        // },
        // noticePlayersRadius?: number,
        // sit?: { searchRadius: number };
        // sleep?: { searchRadius: number };
      };
    },
  },
];


interface NpcTile extends Tile {
  brush: [NPCBrush],
  connector: undefined,
}

/**
 * npcValue - species or monster name
 * typeName - type of NPC, only for NPC
 * parameters - JSON.stringified
 */
type NpcMatch = {
  tileRgba: RgbaValue,
  npcKey: "monster" | "npc",
  npcValue: string,
  typeName?: string,
  parameters: string,
}

//determine paths to tilesets for mapping PNG
function resolveTilesets():string {
  const matPath = nodePath.resolve(
    "./input-output/tilesets/packed/materials.json"
  );
  const pathToTileset = matPath.substring(0, matPath.lastIndexOf("/"));
  return pathToTileset;
}

async function calcNewTilesetShapes(log: boolean = false): Promise<TilesetShape[]> {
  const path: string = resolveTilesets();
  const TILESETS = [
    ///blocks
    TILESETMAT_NAME.materials,
    TILESETMAT_NAME.supports,
    TILESETMAT_NAME.liquids,
    TILESETMAT_NAME.misc,
    //TODO other tilesets for objects
  ];
  let startGID: number = 1;
  const tilesetsArray: TilesetShape[] = [];
  for (const tilesetName of TILESETS) {
    const currentTsPath: string = `${path}/${tilesetName}.json`;

    const tilesetShape: TilesetShape = {
      firstgid: startGID,
      source: currentTsPath// `${currentTsPath.replace(/\//g, "\/")}`, //RegEx is useless since JSON.stringify either loses backslash or doubles it
    };
    const currentTileset: TilesetJson = JSON.parse(
      (await nodeFS.readFile(currentTsPath)).toString("utf8")
    );
    // console.log(currentTileset)
    startGID = startGID + currentTileset.tilecount; //increase GID by size of current tileset
    tilesetsArray.push(tilesetShape);
  }

  if (log) {
    console.log(tilesetsArray);
  }

  return tilesetsArray;
}

function ruleGetName(rule: typeof ANCHOR_RULES[number]): string {
  let ruleName: string = rule;
  //try to trim layer from the name
  if (rule.includes("Background")) {
    ruleName = rule.substring(0, rule.indexOf("Background"));
  }
  else if (rule.includes("Foreground")) {
    ruleName = rule.substring(0, rule.indexOf("Foreground"));
  }
  return ruleName;
}

function ruleIsBackLayer(rule: typeof ANCHOR_RULES[number]): "back"|void {
  if (rule.includes("Background")) {
    return "back";
  }
  else if (rule.includes("Foreground")) {
    return undefined;
  }
  return undefined;
}

function getSortedTileset(arrayOfOldTiles: Tile[], log: boolean = false): OldTilesetSorted {
  const oldSorted :OldTilesetSorted = {
    foreground: [] ,
    background: [],
    specialforeground: [],
    specialbackground: [],
    special: [],
    anchors: [],
    wires: [],
    stagehands: [],
    npcs: [],
    objects: [],
    undefined: [],
  };

  for (const tile of arrayOfOldTiles) {
    if(tile.connector === true) {
      oldSorted.anchors.push(tile);
      continue;
    }
    if(tile.rules) {
      const ruleMatch = tile.rules.flat(3).filter((ruleString) => {
        return ANCHOR_RULES.includes(ruleString);
      });
      if(ruleMatch.length > 0 /*=== 1*/) {
        oldSorted.anchors.push(tile);
        //continue; - anchor may also contain surface tile data
      }
    }
    
    if (tile.brush === undefined) {
      if(tile.rules !== undefined) {
        if((tile.rules as AnchorRule[]).flat().includes(ANCHOR_RULES[2])) {
          oldSorted.specialforeground.push(tile); //detected foreground rule
          continue;
        }
        if((tile.rules as AnchorRule[]).flat().includes(ANCHOR_RULES[0]) || (tile.rules as AnchorRule[]).flat().includes(ANCHOR_RULES[1])) {
          oldSorted.specialbackground.push(tile); //detected background rule
          continue;
        }
      }
      oldSorted.special.push(tile); //if there is no brush at all, probably a Special tile
      continue;
    } else {
      //first, consistency expectation checks
      if (tile.brush.length > 1) {
        if (tile.brush[0][0] != "clear") {
          console.log(
            `Error, tile brush of size ${tile.brush.length} contains ${tile.brush}, first slot is not "clear". Skipping tile`
          );
          continue; //NEXT TILE
        }
      }

      for (const brush of tile.brush) {
        switch (brush[0]) {
          case "clear":
            if(tile.brush.length === 1) {
              if(tile.rules !== undefined) {
                if((tile.rules as AnchorRule[]).flat().includes(ANCHOR_RULES[2])) {
                  oldSorted.specialforeground.push(tile); //detected foreground rule
                  break;
                }
                if((tile.rules as AnchorRule[]).flat().includes(ANCHOR_RULES[0]) || (tile.rules as AnchorRule[]).flat().includes(ANCHOR_RULES[1])) {
                  oldSorted.specialbackground.push(tile); //detected background rule
                  break;
                }
              }
              oldSorted.special.push(tile); //brush contains 1 "clear" element > special tile
            }
            break; //otherwise skip
          case "biometree":
          case "biomeitems":
            oldSorted.objects.push(tile);
            break;
          case "playerstart":
            oldSorted.anchors.push(tile);
            break;
          case "surface":
            if (tile.comment?.toLowerCase().includes("biome tile brush") /*|| tile.comment === undefined*/) {
              oldSorted.specialbackground.push(tile); //for biome tile brush duplicate to background, as it is often setup incorrectly in old tileset
            }
            oldSorted.specialforeground.push(tile);
            break;
          case "surfacebackground":
            oldSorted.specialbackground.push(tile);
            break;
          case "wire":
            oldSorted.wires.push(tile);
            break;
          case "stagehand":
            oldSorted.stagehands.push(tile);
            break;
          case "npc":
            oldSorted.npcs.push(tile);
            break;
          case "object":
            oldSorted.objects.push(tile);
            break;
          case "back":
            oldSorted.background.push(tile);
            break;
          case "front":
          case "liquid": //liquids are foreground-only
            oldSorted.foreground.push(tile);
            break;
          default:
            oldSorted.undefined.push(tile);
        }
      }
    }
  }

  //DEBUG PART
  if (log) {
    console.log(`Total tile count: ${arrayOfOldTiles.length}`);
    for (const tiletype in oldSorted) {
      if (tiletype != "undefined") {
        console.log(
          `Checking ${tiletype}, matched tiles: ${oldSorted[tiletype].length}`
        );
      } else {
        if (oldSorted[tiletype].length > 0) {
          console.log(
            `FOUND ${tiletype} tiles, matched tiles: ${oldSorted[tiletype].length}`
          );
          console.log(oldSorted.undefined);
        } else {
          console.log("All tiles sorted!");
        }
      }
    }
  }
  //END DEBUG PART
  return oldSorted;
}

//compares explicitly defined tilelayer-related tiles, like foreground/background, liquid etc
function matchTilelayer(oldTilesCategoryArray: Tile[], newTilesetJSON: TilesetJson, layerName: FrontOrBack, firstgid: number) : (LayerTileMatch|undefined)[]|void {
  if (firstgid < 1) {
    throw new Error(`FirstGid is ${firstgid} but it can't be negative!`)
  }
  const matchMap = oldTilesCategoryArray.map((tile : Tile, index: number): undefined|LayerTileMatch => {
    const { value, comment, brush, rules }: Tile = tile;
    
    //TODO Typeguard
    let newTilesetJsonTyped = newTilesetJSON;
    switch (newTilesetJSON.name) {
      case TILESETMAT_NAME.materials:
      case TILESETMAT_NAME.supports: {
        newTilesetJsonTyped = newTilesetJSON as TilesetMatJson;
        break;
      }
      case TILESETMAT_NAME.liquids: {
        newTilesetJsonTyped = newTilesetJSON as TilesetLiquidJson;
      }
      case TILESETMAT_NAME.misc: {
        newTilesetJsonTyped = newTilesetJSON as TilesetMiscJson;
      }
    }
    //if we match materials, platforms or liquids
    if(TILESETMAT_NAME.materials === newTilesetJSON.name || TILESETMAT_NAME.supports === newTilesetJSON.name || TILESETMAT_NAME.liquids === newTilesetJSON.name) {
      if (brush === undefined) {
        return;
        //throw new Error(`Tile brush is ${brush}`);
      }

      const oldBrushTypes:string[] = [];
      if(layerName === "front") {
        oldBrushTypes.push("front", "liquid");
      }
      else if(layerName === "back") {
        oldBrushTypes.push("back");
      }
      for (const brushLayer of brush) {
        const [brushType, brushMaterial]: Brush = brushLayer;
        if(oldBrushTypes.includes(brushType)) {
          for (const materialIndex in newTilesetJSON.tileproperties) {
            const tileDesc = newTilesetJSON.tileproperties[materialIndex] as TileSubstanceJson;
            let material;
            if(newTilesetJSON.name === TILESETMAT_NAME.liquids) { // TS Typeguard
              material = (tileDesc as TileLiquidJson)["liquid"];  
            }
            else {
              material = (tileDesc as TileSolidJson)["material"];  
            }
            if (material === brushMaterial) {
              return { tileName: brushMaterial, tileRgba: value, rules: rules, tileGid: (parseInt(materialIndex) + firstgid )};
            }
          }
        }
      }
    }
    //Misc tileset
    else if (newTilesetJSON.name === TILESETMAT_NAME.misc) {
      //if we have bkg tile, but search for front layer, or VV - skip
      if(layerName === "front" && brush && brush.flat(1).includes("surfacebackground") ||
      layerName === "back" && brush && brush.flat(1).includes("surface") && !comment?.toLowerCase().includes("biome tile brush") ) {
        return;
      }
      //if we have special tile, but search for front layer - write 0. Precaution!
      if(layerName === "front" && (comment?.toLowerCase().includes("magic pink") || 
      brush?.length === 1 && brush.flat(1)[0] === "clear")) {
        return{tileName: "special", tileRgba: value, tileGid: 0, rules};
      }

      /*
      SPECIAL - BKG:
      1 = comment: "magic pinkppp, a no-op value"
      0 = brush:["clear"], comment:"Empty hole"
      11 = brush:["clear"], comment:"Empty hole overwritable" */
      //Magic Pink Brush #1
      if(comment?.toLowerCase().includes("magic pink")) {
        return { tileName: "magic pink", tileRgba: value, tileGid: GidFlags.apply(1 + firstgid, false, true, false), rules };
        //Gid for Magic Pink Brush in original files is flipped horizontally, let's mimic that
      }
      if(brush && brush.length === 1 && brush.flat(1)[0] === "clear") {
        if (comment?.toLowerCase().includes("empty hole")) {
          return { tileName: "empty", tileRgba: value, tileGid: 0, rules}; //EMPTY TILE
        }
        /*
        //Empty hole overwritable #11
        if(comment.toLowerCase().includes("empty hole") && rules &&
        rules.flat(2).includes("allowOverdrawing")) {
          return {tileName: "empty hole overwritable", tileRgba: value, tileGid: 11 + firstgid}
        }
        //Empty hole #0
        if(comment.toLowerCase().includes("empty hole")) {
          return {tileName: "empty hole", tileRgba: value, tileGid: 0 + firstgid}
        }
        */
      }
      
      if(brush) {
        for (const brushLayer of brush) {
          const [brushType, options]: Brush = brushLayer;
          if(brushType === "surface") {
            /*
              SPECIALFRONT
              ??? = brush: ["surface"]
              ??? = brush: ["surface"], rules: [["allowOverdrawing"]]
              8 = brush:["surface",{variant: 0}]
              8 = brush:["surface",{variant: 0}], rules: [["allowOverdrawing"]]
              9 = brush:["surface",{variant: 1}]
              9 = brush:["surface",{variant: 1}], rules: [["allowOverdrawing"]]
              10 = brush:["surface",{variant: 2}]
              10 = brush:["surface",{variant: 2}], rules: [["allowOverdrawing"]]
            */

            if(options && options.variant) {
              switch(options.variant) {
                case 0:
                  return {tileName: "surface #0", tileRgba: value, tileGid: 8 + firstgid, rules};    
                case 1: 
                  return {tileName: "surface #1", tileRgba: value, tileGid: 9 + firstgid, rules};
                case 2:
                  return {tileName: "surface #2", tileRgba: value, tileGid: 10 + firstgid, rules};
              }
            }
            else {
              return {tileName: "surface", tileRgba: value, tileGid: 8 + firstgid, rules};
            }
          }
          else if(brushType === "surfacebackground") {
            /*
            SPECIALBKG
            ??? = brush:["surfacebackground"]
            8 = brush:["surfacebackground",{variant: 0}]
            8 = brush:["surfacebackground",{variant: 0}], rules: [["allowOverdrawing"]]
            9 = brush:["surfacebackground",{variant: 1}]
            9 = brush:["surfacebackground",{variant: 1}], rules: [["allowOverdrawing"]]
            10 = brush:["surfacebackground",{variant: 2}]
            10 = brush:["surfacebackground",{variant: 2}], rules: [["allowOverdrawing"]]
            */
            if(options && options.variant) {
              switch(options.variant) {
                case 0:
                  return {tileName: "surfacebackground #0", tileRgba: value, tileGid: 8 + firstgid, rules};    
                case 1: 
                  return {tileName: "surfacebackground #1", tileRgba: value, tileGid: 9 + firstgid, rules};
                case 2:
                  return {tileName: "surfacebackground #2", tileRgba: value, tileGid: 10 + firstgid, rules};
              }
            }
            else {
              return {tileName: "surfacebackground", tileRgba: value, tileGid: 8 + firstgid, rules};
            }
          }
        }
      } 

      if(layerName === "back" && rules !== undefined) {
        const flatRules = rules.flat()
        if(flatRules.includes(ANCHOR_RULES[0])) {
          //solid background
          return {
            tileName: "surfacebackground",
            tileRgba: value,
            tileGid: 8 + firstgid,
            rules: flatRules.includes("allowOverdrawing")? ["allowOverdrawing"] : undefined,
          };
        }
        else if(flatRules.includes(ANCHOR_RULES[1])) {
          //air background
          if(flatRules.includes("allowOverdrawing")) {
            return {tileName: "Air (overwritable)", tileRgba: value, tileGid: 11 + firstgid, rules: ["allowOverdrawing"]};
          }
          else {
            return {tileName: "Air", tileRgba: value, tileGid: 0 + firstgid};
          }
        }
      }
      if(layerName === "front" && rules !== undefined) {
        const flatRules = rules.flat()
        if(flatRules.includes(ANCHOR_RULES[2])) {
          //solid background
          return {
            tileName: "Air",
            tileRgba: value, 
            tileGid: 0 + firstgid,
            rules: flatRules.includes("allowOverdrawing")? ["allowOverdrawing"] : undefined,
          };
        }
      }
    /*
    const MISCJSON_MAP = [
      "Magic Pink Brush",                  //1 - back
      "Default Surface Tile 0",            //8 - front/back
      "Default Surface Tile 1",            //9 - front/back
      "Default Surface Tile 2",            //10 - front/back

      "Air",                               //0 - front/back
      "Air (overwritable)",                //11
      "Invisible wall (boundary)",             //2 - front (only for quests)
      "Invisible wall (climbable)",            //18 - front (only for quests)
      "Underwater invisible wall (boundary)",  //19 - front (only for quests)
      "Zero G",                                //20 --> front, but can be ignored? 
      "Zero G (protected)",                    //21 --> front, but can be ignored? 
    ]; //index = tile #
    */
    }
    
    return; //if no matches are found - next tile
  });
    return matchMap;
}

function matchAnchors(oldAnchorsArray: AnchorTile[], miscTilesetJSON: TilesetMiscJson, firstGid: number): LayerTileMatch[] {

  if (firstGid < 1) {
    throw new Error (`firstGid is ${firstGid} but must be positive!`);
  }
  const matchMap = oldAnchorsArray.map((tile: AnchorTile): LayerTileMatch|undefined => {
    const { value, comment, brush, rules, connector }: AnchorTile = tile;
    
    /*
    "Player Start",                      //3 --> anchors etc
    "worldGenMustContainAir",            //4 --> anchors etc
    "worldGenMustContainSolid",          //5 --> anchors etc
    "Red Connector",                     //12 --> anchors etc
    "Yellow Connector",                  //13 --> anchors etc
    "Green Connector",                   //14 --> anchors etc
    "Blue Connector",                    //15 --> anchors etc
    "worldGenMustContainAir (background)",   //16 --> anchors etc
    "worldGenMustContainSolid (background)", //17 --> anchors etc
    "worldGenMustContainLiquid (ocean)",     //22 --> anchors etc
    "worldGenMustNotContainLiquid (ocean)"   //23 --> anchors etc
    */

    if(brush){
      for(const brushlayer of brush) {
        if(brushlayer.includes("playerstart")) {
          return {tileName: "Player Start", tileRgba: value, tileGid: (3 + firstGid )};
        }
      }
    }

    if(connector) {
      if(comment?.includes("entrance coupler")) {
        return {tileName: comment + " -> red", tileRgba: value, tileGid: (12 + firstGid )};
      };
      if(comment?.includes("alternate coupler #2")) {
        return {tileName: comment + " -> yellow", tileRgba: value, tileGid: (13 + firstGid )};
      };
      if(comment?.includes("alternate coupler #3")) {
        return {tileName: comment + " -> green", tileRgba: value, tileGid: (14 + firstGid )};
      }
      else {
        return {tileName: comment + " -> blue", tileRgba: value, tileGid: (15 + firstGid )};
      }
    }

    if(rules) {
      for (const rule of rules.flat()) { //worldGenMust(Not)Contain
        for (const anchorRule of ANCHOR_RULES) {
          if (rule === anchorRule) {
            for (const materialIndex in miscTilesetJSON.tileproperties) {
              const material = miscTilesetJSON.tileproperties[materialIndex];
              if (Object.keys(material).includes(ruleGetName(rule)) && material.layer === ruleIsBackLayer(rule)) { 
                return {tileName: material["//shortdescription"], tileRgba: value, tileGid: (parseInt(materialIndex) + firstGid )};
              }            
            }  
          }     
        } 
      }
    }
    
    return; //skip tile if no matches
  });
  //return using typeguard to avoid TS complaining too much
  return matchMap.filter((match):match is LayerTileMatch => {
    return match !== undefined;
  });
}

function matchObjects(oldObjectsArray: ObjectTile[], tileset: TilesetObjectJson, partialMatchMap: (ObjectTileMatch|undefined)[]): (ObjectTileMatch|undefined)[] {
  if (partialMatchMap && partialMatchMap.length !== oldObjectsArray.length) {
    throw new Error(`Partial object matchMap has a length of ${partialMatchMap.length} but be equal to the list of objects, which has ${oldObjectsArray.length}`);
  }
  const matchMap = [...partialMatchMap];
  for (let objectIndex = 0; objectIndex < oldObjectsArray.length; objectIndex++) {
    
    const { brush:brushArray, comment, value }: ObjectTile = oldObjectsArray[objectIndex];
    for (const brush of brushArray) {
      const [brushType, objectName, stats] = brush;
      if(brush.flat().includes("biometree") || brush.flat().includes("biomeitems")) {
        continue; //skip biom items, we match them separately
      }
      if (brushType === "clear" || brushType == "liquid" || brushType !== "object") {
        continue; //skip empty brush
      }
      else {
        if (brushType !== "object") {
          throw new Error(`Found non-object item at ${objectIndex} in Object Array: ${JSON.stringify(oldObjectsArray[objectIndex])}`);
        }
        else {
          for (const objIndex in tileset.tileproperties) {
            const obj = tileset.tileproperties[objIndex];
            if (obj.object === objectName) {
              const tileMatch = matchMap[objectIndex] as ObjectTileMatch;
              if (JSON.stringify(oldObjectsArray[objectIndex].value) === JSON.stringify(matchMap[objectIndex]?.tileRgba)) {
                //we already have a match for this element           
                let variation = -1;
                if (obj["//name"].includes("orientation") || obj["//description"].includes("orientation") || obj["//shortdescription"].includes("orientation")) {
                  variation = parseInt(objIndex); //if it is variation from the same/other tileset
                }
                else if(tileMatch.tileset.includes(tileset.name) === false) {
                  variation = parseInt(objIndex); //if it is a basic match from other set (object may be included into several tilesets)
                }
                
                tileMatch.tileIdVariations = [...tileMatch.tileIdVariations, {id: variation, tileset: tileset.name}];

                //experimental: selecting tileset with max number of variations
                const matchesNumber: {variants: number, tileset:string}[] = [];
                if(tileMatch !== undefined) {
                  const uniqueVars = tileMatch.tileIdVariations.filter((value, index, array) => array.indexOf(value) === index);
                  for(const tsInfo of uniqueVars) {
                    const variantsInTileset = tileMatch.tileIdVariations.filter((variant) => {
                      return variant.tileset === tsInfo.tileset;
                    });
                    matchesNumber.push({
                      variants: variantsInTileset.length,
                      tileset: tsInfo.tileset,
                    });
                  }
                }
                
                const sortedMatchesNumber = matchesNumber.length > 0? matchesNumber.sort((a, b) => b.variants - a.variants) : [{variants: 1, tileset: tileset.name}];
                tileMatch.tileset = sortedMatchesNumber[0].tileset;

                continue; //Experimental - record alt variation ids and skip, since we already have a match
              }
              //Check if we need horizontal flip
              let flip:boolean = false;
              if (stats && stats.direction) {
                flip = obj.tilesetDirection !== stats.direction;
              };

              // let newTilesets:string[] = [];
              // if(matchMap[objectIndex] !== undefined) {
              //   const onlyUnique = (matchMap[objectIndex] as ObjectTileMatch).tileIdVariations.filter((value, index, array) => {
              //     return array.indexOf(value) === index;
              //   });
              //   for(const tsInfo of onlyUnique) {
              //     newTilesets.push(tsInfo.tileset);
              //   }
              // }
              // if(newTilesets.includes(tileset.name) === false) {
              //   newTilesets.push(tileset.name);
              // }

              const objMatch: ObjectTileMatch = {
                tileName: comment ? comment : objectName,
                tileRgba: value,
                tileId: parseInt(objIndex),
                tileIdVariations: [{id: parseInt(objIndex), tileset: tileset.name}],
                tileset: tileset.name,
                flipHorizontal: flip || undefined 
              };
              matchMap[objectIndex] = objMatch;
            }
          }
        }
      }
    }
  }
  return matchMap;
}

function matchObjectsBiome(oldObjectsArray: ObjectTile[], miscTilesetJSON: TilesetMiscJson, partialMatchMap: (ObjectTileMatch | undefined)[]): (ObjectTileMatch | undefined)[] {
  const newMatchMap = [...partialMatchMap];
  if (partialMatchMap && partialMatchMap.length !== oldObjectsArray.length) {
    throw new Error(`Partial object matchMap has a length of ${partialMatchMap.length} but be equal to the list of objects, which has ${oldObjectsArray.length}`);
  }
  for (let objectIndex = 0; objectIndex < oldObjectsArray.length; objectIndex++) {
    if (JSON.stringify(oldObjectsArray[objectIndex].value) === JSON.stringify(newMatchMap[objectIndex]?.tileRgba)) {
      //we already have a match for this element, skip it
      continue;
    }
    else {
      /*
      "Biome Item",                        //6 --> objects
      "Biome Tree",                        //7 --> objects
      */
      const { brush, comment, value } = oldObjectsArray[objectIndex];
      if (brush.flat().includes("biomeitems")) {
        newMatchMap[objectIndex] = { tileName: comment ? comment : "Biome Flora", tileRgba: value, tileId: 6, tileIdVariations: [], tileset: miscTilesetJSON.name };
      }
      else if (brush.flat().includes("biometree")) {
        newMatchMap[objectIndex] = {tileName: comment?comment:"Biome Tree", tileRgba: value, tileId: 7, tileIdVariations: [], tileset: miscTilesetJSON.name};
      }
      else {
        continue;
      }
    }
  }
  return newMatchMap;
}

async function getTilesetTilesize(tilesetName: string):Promise<{ tileheight: number; tilewidth: number; } | undefined> {
  const {tileheight, tilewidth} = await dungeonsFS.getTileset(tilesetName) as TilesetObjectJson;
  if (tileheight !== undefined && tilewidth !== undefined) {
    return {tileheight, tilewidth};
  }
  else {
    return undefined;
  }
}

async function getObjectFromTileset(tileMatch: ObjectFullMatch):Promise<ObjectJson> {
  const tilesetJson = await dungeonsFS.getTileset(tileMatch.tileset) as TilesetObjectJson; //get appropriate tileset
  return tilesetJson.tileproperties[tileMatch.tileId];
}

async function getTileSizeFromTileset(tileMatch: ObjectFullMatch): Promise<{tileheight:number, tilewidth:number}> {
  const tilesetJson: TilesetObjectJson = await dungeonsFS.getTileset(tileMatch.tileset) as TilesetObjectJson; //get appropriate tileset
  const { tileheight, tilewidth } = tilesetJson;
  if (tileheight === 8 && tilewidth === 8) {
    return { tileheight, tilewidth };
  }
  const getPixelsPromise = promisify(getPixels); //getPixels originally doesn't support promises
  const pngPath = tilesetJson.tiles[tileMatch.tileId].image;
  const relPngPath = `${dungeonsFS.ioDirPath}/${pngPath.substring(pngPath.indexOf("tiled"))}`;
  //pixelsArray.data is a Uint8Array of (shape.width * shape.height * #channels) elements
  let pixelsArray = await getPixelsPromise(relPngPath, "image/png");
  return {tileheight: pixelsArray.shape[0], tilewidth: pixelsArray.shape[1]}; //shape = width, height, channels
}

function matchNPCS(oldNpcsArray: NpcTile[]): NpcMatch[] {
  const matchMap: NpcMatch[] = oldNpcsArray.map((npcTile) => {
    const {brush } = npcTile;
    const newNpc: NpcMatch = {
      tileRgba: npcTile.value,
      npcKey: brush[0][1].kind,
      npcValue: brush[0][1].kind === "npc" ? brush[0][1].species : brush[0][1].typeName,
      typeName: brush[0][1].kind === "npc" ? brush[0][1].typeName : undefined,
      parameters: JSON.stringify(brush[0][1].parameters),
    };
    return newNpc;
  });
  return matchMap;
}

function matchStagehands(oldTilesCategoryArray: StagehandTile[]): StagehandMatch[] {
  const stagehandMap: StagehandMatch[] = [];
  //TODO
  oldTilesCategoryArray.forEach((tile) => {
    const [_, shParams] = tile.brush[0];
    const stagehand: StagehandMatch = {
      tileName: tile.comment || "",
      tileGid: 0,
      tileRgba: tile.value,
      stagehand: shParams.type,
      nameParam: shParams.parameters.locationType? { locationType: shParams.parameters.locationType }:undefined,
      broadcastArea: shParams.parameters.broadcastArea,
    };
    stagehandMap.push(stagehand);
  });

  return stagehandMap;
}

function matchWires() {
  //TODO
}

function matchMods(oldTilesCategoryArray: Tile[]): ModMatch[] {
  const modMap: ModMatch[] = [];
  oldTilesCategoryArray.forEach((tile) => {
    const { brush } = tile;
    if (brush !== undefined) {
      for (const brushLayer of brush) {
        if (brushLayer[0] !== "front" && brushLayer.length > 2) {
          throw new Error(`Tile ${tile.value} contains some mods in unknown layer: ${brushLayer[0]}! TODO: write processing this case!`)
        }
        if (brushLayer[0] === "front" && brushLayer.length > 2) {
          //we found mod for front tile!
          const [brushType, brushMaterial, brushMod] = brushLayer;
          const modMatch: ModMatch = {
            tileName: tile.comment || brushMaterial,
            tileRgba: tile.value,
            tileGid: 0, //simply apply mod to any tile under it, ignore material
            mod: brushMod as string, 
          }
          modMap.push(modMatch);
        }
      }
    }
  });
  return modMap;
}

//merge two match maps with non-intersecting values and return new map
function mergeLayerMatchMaps(matchMap1: LayerTileMatch[], matchMap2: (LayerTileMatch|undefined)[]): LayerTileMatch[] {
  if (matchMap1.length > 0 && matchMap1.length != matchMap2.length) {
    throw new Error(`MAP SIZE MISMATCH: Merging matchMap1 of size ${matchMap1.length} with matchMap2 of size ${matchMap2.length}`);
  }
  const sumMap: LayerTileMatch[] = []; 
  matchMap2.forEach((element, index) => {
    if (element != undefined && matchMap1[index] != undefined) {
      throw new Error(`CANNOT MERGE: both matches have values at index ${index}`);
    }
    if (element != undefined) {
      sumMap[index] = element;
    }
    else {
      sumMap[index] = matchMap1[index];
    }
  })

  return sumMap;
}

//get extention from path (without .)
function getExtension(fileName:string) {
  return fileName.substring(fileName.lastIndexOf(".") + 1);
}

//trunc extension and .
function getFilename(fileName:string) {
  return fileName.substring(0, fileName.lastIndexOf("."));
}

function getFilenameFromPath(filePath:string) {
  return nodePath.parse(filePath).name;
}

async function matchAllTilelayers(oldTileset:OldTilesetSorted, log:boolean = false):Promise<FullTileMatch> {
  const tilesetsDesc = await calcNewTilesetShapes();

  const tilesetsDir = resolveTilesets(); //"./tilesets/packed/";

  const TILELAYER_TILESETS:string[] = [
    "materials",
    "supports",
    "liquids",
    "miscellaneous",
  ];

  const fullMatchMap: FullTileMatch = {
    front: [],
    back: []
  }

  // let matchMap:LayerTileMatch[] = [];

  for (const tileset of TILELAYER_TILESETS) {
    const tilesetJson = await dungeonsFS.getTileset(tileset);
    if (tilesetJson === undefined) {
      throw new Error(`Unable to read tileset ${tileset}`);
    }

    const firstgid = tilesetsDesc.find(
      (element) =>
        getFilenameFromPath(element.source) === tileset
        // getFilenameFromPath(tilesetPath)
    )?.firstgid;
    if(!firstgid) {
      throw new Error(`Tileset ${tileset} not found in tileset shapes; cannot retrieve firstgid`);
    }

    const fullback =  oldTileset.background.concat(oldTileset.specialbackground).concat(oldTileset.special);
    const partialBack = matchTilelayer(
      fullback,
      tilesetJson as TilesetJson,
      "back",
      firstgid
    );

    if(partialBack) {
      fullMatchMap.back = mergeLayerMatchMaps(fullMatchMap.back, partialBack);
    }
    
    const fullfront = oldTileset.foreground.concat(oldTileset.specialforeground).concat(oldTileset.special);
    const partialFront = matchTilelayer(fullfront, tilesetJson as TilesetJson, "front", firstgid);
    if(partialFront) {
    fullMatchMap.front = mergeLayerMatchMaps(fullMatchMap.front, partialFront);
    }
  }

  // fullMatchMap.back = matchMap;

  return fullMatchMap;
}

function slicePixelsToArray(pixelArray: Uint8Array, width: number, height: number, channels: number): RgbaValue[] {
  const pixelCount = width * height;
  const RgbaArray = [];
  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
    const Rgba :RgbaValue = [0,0,0,0];
    for (let channel = 0; channel < channels; channel++){
      Rgba[channel] = (pixelArray[pixelIndex*channels + channel]);
    }
    RgbaArray.push(Rgba);
  }
  return RgbaArray;
}
export type UnsignedInt32 = number;

function isRgbaEqual(Rgba1:RgbaValue, Rgba2:RgbaValue):boolean {
  for(let component = 0; component < 4; component++) {
    if(Rgba1[component] != Rgba2[component]) {
      return false;
    }
  }
  return true;
}

function convertPngToGid(RgbaArray:RgbaValue[], tileMatchMap: (LayerTileMatch|undefined)[]):number[] {
  const layerGids = new Array(RgbaArray.length).fill(0);
  let undefinedMatches = false;
  for(let rgbaN = 0; rgbaN < RgbaArray.length; rgbaN++) {
    for (const conversion of tileMatchMap) {
      if (conversion !== undefined) {
         if(isRgbaEqual(RgbaArray[rgbaN], conversion.tileRgba)) {
          const gid = conversion.tileGid;
          layerGids[rgbaN] = gid;//layerGids[rgbaN] = gid;
        }
      }
      else {
        undefinedMatches = true;
      }
    }
  }
  if (undefinedMatches) {
    console.log(`WARNING: Conversion will be incomplete, undefined matches found!`)
  }
  return layerGids;
}

export {
  resolveTilesets,
  getSortedTileset,
  isRgbaEqual,
  calcNewTilesetShapes,
  //matchTilelayer,
  matchAllTilelayers,
  matchAnchors,
  matchObjects,
  getObjectFromTileset,
  getTileSizeFromTileset,
  matchObjectsBiome,
  matchNPCS,
  matchStagehands,
  matchWires,
  matchMods,
  //mergeLayerMatchMaps,
  slicePixelsToArray,
  convertPngToGid,
  TILESETMAT_NAME,
  TILESETOBJ_NAME,
};
export type {
  Tile,
  AnchorTile,
  ObjectTile,
  StagehandTile,
  NpcTile,

  RgbaValue as RgbaValueType,
  LayerTileMatch as LayerTileMatchType,
  FullTileMatch as FullTileMatchType,
  ObjectBrush as ObjectBrushType,
  ObjectTileMatch as ObjectTileMatchType,
  ObjectFullMatch as ObjectFullMatchType,
  NpcMatch as NpcMatchType,
  ModMatch as ModMatchType,
  StagehandMatch as StagehandMatchType,

  ObjectJson,
  TilesetObjectJson,
  TilesetMiscJson,
  OldTilesetSorted,
  TilesetJson,
}