import {promises as nodeFS} from "fs";
import * as nodePath from "path";
import * as zlib from "zlib";
// import {v4 as uuidv4} from "uuid";

import * as dungeonsFS from "./dungeonsFStoTS.js";
import GidFlags from "./GidFlags.js";
//https://0xacab.org/bidasci/starbound-v1.4.4-source-code/-/blob/no-masters/tiled/properties.txt?ref_type=heads


interface TilesetJson extends Record<string,any> { 
  name: string,
  tilecount: number,
  tileproperties:{
    [key: string] : any,
  }
};

// const TILESETJSON_NAME = {
//   materials: "materials",
//   supports: "supports",
//   liquids: "liquids",
//   misc: "miscellaneous",
// } as const;

enum TILESETJSON_NAME {
  materials = "materials",
  supports = "supports",
  liquids = "liquids",
  misc = "miscellaneous",
  //objects
  objHuge = "huge-objects",
  objByCat = 1,
  objByTag = 2,
  objByRace = 3,
  objByType = 4,
} //as const;

const TS_CAT_PATH = "objects-by-category" as const;
enum TSJSON_OBJ_BY_CAT {
  "actionfigure",
  "artifact",
  "bug",
  "breakable",
  "crafting",
  "decorative",
  "door",
  "farmable",
  "farmbeastegg",
  "fridgestorage",
  "furniture",
  "genboss",
  "generic",
  "light",
  "other",
  "playerstation",
  "pot",
  "rail",
  "railpoint",
  "refinery",
  "sapling",
  "seed",
  "shippingcontainer",
  "spawner",
  "storage",
  "techmanagement",
  "teleporter",
  "teleportmarker",
  "terraformer",
  "tool",
  "tools",
  "trap",
  "wire",
}

const TS_COLTAG_PATH = "objects-by-colonytag" as const;
enum TSJSON_OBJ_BY_COLTAG {
  "agaran",
  "alien",
  "alpaca",
  "alpine",
  "ancient",
  "apexcamp",
  "apex",
  "apexmansion",
  "apexmission1",
  "apexresearchlab",
  "apexvillage",
  "astro",
  "astronaut",
  "avianairship",
  "avian",
  "aviantemple",
  "aviantomb",
  "avianvillage",
  "bench",
  "bioluminescence",
  "bone",
  "cabin",
  "cell",
  "christmas",
  "colourful",
  "combat",
  "commerce",
  "cooking",
  "copper",
  "coral",
  "crafting",
  "crystalline",
  "cultist",
  "dark",
  "doom",
  "door",
  "egyptian",
  "electronic",
  "evil",
  "executive",
  "explorer",
  "eyepatch",
  "farming",
  "farm",
  "fenerox",
  "flesh",
  "floranhuntinggrounds",
  "floran",
  "floranprison",
  "floranvillage",
  "fossil",
  "foundry",
  "frozenfire",
  "geode",
  "geometric",
  "giantflower",
  "glitchcastle",
  "glitch",
  "glitchsewer",
  "glitchvillage",
  "gnome",
  "gothic",
  "hive",
  "hoard",
  "humanbunker",
  "human",
  "humanprison",
  "humanvillage",
  "hylotl",
  "hylotloceancity",
  "hylotlvillage",
  "ice",
  "industrial",
  "island",
  "jungle",
  "knowledge",
  "light",
  "lunarbase",
  "mechanical",
  "mech",
  "medical",
  "mining",
  "misc",
  "mushroompatch",
  "musical",
  "naturalcave",
  "nature",
  "neon",
  "novakid",
  "novakidvillage",
  "oasis",
  "ocean",
  "odd",
  "office",
  "opulent",
  "outdoor",
  "outpost",
  "pastel",
  "peacekeeper",
  "pretty",
  "prism",
  "protectorate",
  "rails",
  "retroscifi",
  "rust",
  "saloon",
  "sandstone",
  "science",
  "scorched",
  "sea",
  "serene",
  "sign",
  "slime",
  "space",
  "spooky",
  "spring",
  "station",
  "steampunk",
  "steamspring",
  "stonecave",
  "storage",
  "swamp",
  "tar",
  "technology",
  "tentacle",
  "tier1",
  "tier2",
  "tier3",
  "tier4",
  "toxic",
  "trap",
  "traveller",
  "valentines",
  "valuable",
  "volcanic",
  "wave",
  "wired",
  "wreck",
  "zen",
}

const TS_RACE_PATH = "objects-by-race" as const;
enum TSJSON_OBJ_BY_RACE {
  "alpaca",
  "ancient",
  "apex",
  "avian",
  "floran",
  "generic",
  "glitch",
  "human",
  "hylotl",
  "novakid",
  "protectorate",
  "tentacle"
}

const TS_TYPE_PATH = "objects-by-type" as const;
enum TSJSON_OBJ_BY_TYPE {
  "container",
  "farmable",
  "loungeable",
  "noisy",
  "physics",
  "teleporter"
}

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
  name: TILESETJSON_NAME.materials|TILESETJSON_NAME.supports,
  tileproperties:{
    [key: string] : TileSolidJson,
  },
}

interface TilesetLiquidJson extends TilesetJson {
  name: TILESETJSON_NAME.liquids,
  tileproperties:{
    [key: string] : TileLiquidJson,
  },
}

interface TilesetObjectJson extends TilesetJson {

}

interface TilesetMiscJson extends TilesetJson {
  name: TILESETJSON_NAME.misc,
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

interface TilesetObjectsJson extends TilesetJson {
  tilecount: number,
  tileproperties:{
    [key: string] : any,
  }
}

type AnchorBrush = ["clear"|"surface"|"playerstart"];

type FrontOrBack = "front" | "back";

type Brush = ["clear"] |
["surface"|"surfacebackground", {variant:number}?, any?] | //material, tilled? 
["liquid", string] |
[FrontOrBack, string, string?] |
AnchorBrush |
["biometree"|"biomeitems"|"playerstart"|"wire"|"stagehand"|"npc"|"object", any?];

type RgbaValue = [number, number, number, number];

interface Tile {
  value: RgbaValue, // [R, G, B, A]
  comment?: string,
  brush?: Brush[],
  rules?: ["allowOverdrawing"] | any[],
  connector?: boolean,
};

const ANCHOR_RULES = [
  "worldGenMustContainSolidBackground",
  "worldGenMustContainAirBackground",
  "worldGenMustContainAirForeground",
] as const;

type AnchorRule = "allowOverdrawing" | typeof ANCHOR_RULES[number];

interface AnchorTile extends Tile {
  brush?: AnchorBrush[],
  rules?: AnchorRule[],
  connector? : true,
}

interface ObjectTile extends Tile {

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
  tileGid: number
};

type FullTileMatch = {
  front: LayerTileMatch[],
  back: LayerTileMatch[]
}

export type TilesetShape = {
  firstgid: number,
  source: string,
};

//determine paths to tilesets for mapping PNG
function resolveTilesets():string {
  const matPath = nodePath.resolve(
    "./input-output/tilesets/packed/materials.json"
  );
  const pathToTileset = matPath.substring(0, matPath.lastIndexOf("/"));
  return pathToTileset;
}

async function calcNewTilesetShapes(log:boolean = false):Promise<TilesetShape[]> {
  const path:string = resolveTilesets();
  const TILESETS = [
    ///blocks
    TILESETJSON_NAME.materials,
    TILESETJSON_NAME.supports,
    TILESETJSON_NAME.liquids,
    TILESETJSON_NAME.misc,
    //TODO other tilesets for objects
  ];
  let startGID:number = 1;
  const tilesetsArray:TilesetShape[] = [];
  for (const tilesetName of TILESETS) {
    const currentTsPath:string = `${path}/${tilesetName}.json`;

    const tilesetShape:TilesetShape = {
      firstgid: startGID,
      source: currentTsPath// `${currentTsPath.replace(/\//g, "\/")}`, //RegEx is useless since JSON.stringify either loses backslash or doubles it
    };
    const currentTileset:TilesetJson = JSON.parse(
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
      if(ruleMatch.length === 1) {
        oldSorted.anchors.push(tile);
        continue;
      }
    }
    
    if (tile.brush === undefined) {
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
            if (tile.comment?.toLowerCase().includes("biome tile brush")) {
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
  const matchMap = oldTilesCategoryArray.map((tile : Tile): undefined|LayerTileMatch => {
    const { value, comment, brush, rules }: Tile = tile;
    
    //TODO Typeguard
    let newTilesetJsonTyped = newTilesetJSON;
    switch (newTilesetJSON.name) {
      case TILESETJSON_NAME.materials:
      case TILESETJSON_NAME.supports: {
        newTilesetJsonTyped = newTilesetJSON as TilesetMatJson;
        break;
      }
      case TILESETJSON_NAME.liquids: {
        newTilesetJsonTyped = newTilesetJSON as TilesetLiquidJson;
      }
      case TILESETJSON_NAME.misc: {
        newTilesetJsonTyped = newTilesetJSON as TilesetMiscJson;
      }
    }
    //if we match materials, platforms or liquids
    if(TILESETJSON_NAME.materials === newTilesetJSON.name || TILESETJSON_NAME.supports === newTilesetJSON.name || TILESETJSON_NAME.liquids === newTilesetJSON.name) {
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
            if(newTilesetJSON.name === TILESETJSON_NAME.liquids) { // TS Typeguard
              material = (tileDesc as TileLiquidJson)["liquid"];  
            }
            else {
              material = (tileDesc as TileSolidJson)["material"];  
            }
            if (material === brushMaterial) {
              return { tileName: brushMaterial, tileRgba: value, tileGid: (parseInt(materialIndex) + firstgid )};
            }
          }
        }
      }
    }
    //Misc tileset
    else if (newTilesetJSON.name === TILESETJSON_NAME.misc) {
      //if we have bkg tile, but search for front layer, or VV - skip
      if(layerName === "front" && brush && brush.flat(1).includes("surfacebackground") ||
      layerName === "back" && brush && brush.flat(1).includes("surface") && !comment?.toLowerCase().includes("biome tile brush") ) {
        return;
      }
      //if we have special tile, but search for front layer - write 0. Precaution!
      if(layerName === "front" && (comment?.toLowerCase().includes("magic pink") || 
      brush?.length === 1 && brush.flat(1)[0] === "clear")) {
        return{tileName: "special", tileRgba: value, tileGid: 0};
      }

      /*
      SPECIAL - BKG:
      1 = comment: "magic pinkppp, a no-op value"
      0 = brush:["clear"], comment:"Empty hole"
      11 = brush:["clear"], comment:"Empty hole overwritable" */
      //Magic Pink Brush #1
      if(comment?.toLowerCase().includes("magic pink")) {
        return { tileName: "magic pink", tileRgba: value, tileGid: GidFlags.apply(1 + firstgid, false, true, false) };
        //Gid for Magic Pink Brush in original files is flipped horizontally, let's mimic that
      }
      if(brush && brush.length === 1 && brush.flat(1)[0] === "clear") {
        if (comment?.toLowerCase().includes("empty hole")) {
          return { tileName: "empty", tileRgba: value, tileGid: 0 }; //EMPTY TILE
        }
        /*
        //Empty hole overwritable #11
        if(comment.toLowerCase().includes("empty hole") && rules &&
        rules.flat(2).includes("allowOverwriting")) {
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
                  return {tileName: "surface #0", tileRgba: value, tileGid: 8 + firstgid};    
                case 1: 
                  return {tileName: "surface #1", tileRgba: value, tileGid: 9 + firstgid};
                case 2:
                  return {tileName: "surface #2", tileRgba: value, tileGid: 10 + firstgid};
              }
            }
            else {
              return {tileName: "surface", tileRgba: value, tileGid: 8 + firstgid};
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
                  return {tileName: "surfacebackground #0", tileRgba: value, tileGid: 8 + firstgid};    
                case 1: 
                  return {tileName: "surfacebackground #1", tileRgba: value, tileGid: 9 + firstgid};
                case 2:
                  return {tileName: "surfacebackground #2", tileRgba: value, tileGid: 10 + firstgid};
              }
            }
            else {
              return {tileName: "surfacebackground", tileRgba: value, tileGid: 8 + firstgid};
            }
          }
        }
      } 
    }
/*
const MISCJSON_MAP = [
  "Magic Pink Brush",                  //1 - back
  "Default Surface Tile 0",            //8 - front/back
  "Default Surface Tile 1",            //9 - front/back
  "Default Surface Tile 2",            //10 - front/back

  "Air",                               //0 - is it ever used?
  "Air (overwritable)",                //11 -is it ever used?
  "Invisible wall (boundary)",             //2 - front (only for quests)
  "Invisible wall (climbable)",            //18 - front (only for quests)
  "Underwater invisible wall (boundary)",  //19 - front (only for quests)
  "Zero G",                                //20 --> front, but can be ignored? 
  "Zero G (protected)",                    //21 --> front, but can be ignored? 
]; //index = tile #
 */

    return; //if no matches are found - next tile
  });
    return matchMap;
}

function matchAnchors(oldAnchorsArray: AnchorTile[], miscTilesetJSON: TilesetMiscJson, firstgid: number): (LayerTileMatch|undefined)[]|void {
  
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

  if (firstgid < 1) {
    return undefined;
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
          return {tileName: "Player Start", tileRgba: value, tileGid: (3 + firstgid )};
        }
      }
    }

    if(connector) {
      if(comment?.includes("entrance coupler")) {
        return {tileName: comment + " -> red", tileRgba: value, tileGid: (12 + firstgid )};
      };
      if(comment?.includes("alternate coupler #2")) {
        return {tileName: comment + " -> yellow", tileRgba: value, tileGid: (13 + firstgid )};
      };
      if(comment?.includes("alternate coupler #3")) {
        return {tileName: comment + " -> green", tileRgba: value, tileGid: (14 + firstgid )};
      }
      else {
        return {tileName: comment + " -> blue", tileRgba: value, tileGid: (15 + firstgid )};
      }
    }

    if(rules) {
      for (const rule of rules.flat()) { //worldGenMust(Not)Contain
        for (const anchorRule of ANCHOR_RULES) {
          if (rule === anchorRule) {
            for (const materialIndex in miscTilesetJSON.tileproperties) {
              const material = miscTilesetJSON.tileproperties[materialIndex];
              if (Object.keys(material).includes(ruleGetName(rule)) && material.layer === ruleIsBackLayer(rule)) { 
                return {tileName: material["//shortdescription"], tileRgba: value, tileGid: (parseInt(materialIndex) + firstgid )};
              }            
            }  
          }     
        } 
      }
    }
    
    return; //skip tile if no matches
  });
  return matchMap;
}

function matchObjects() {
 //TODO
}

function matchObjectsBiome(oldObjectsArray: ObjectTile[], miscTilesetJSON: TilesetMiscJson, firstgid: number): (LayerTileMatch|undefined)[]|void {
  //TODO
/*
  "Biome Item",                        //6 --> objects
  "Biome Tree",                        //7 --> objects
  */
}

function matchNPCS() {
  //TODO
}

function matchStagehands() {
  //TODO
}

function matchWires() {
  //TODO
}

function matchMods() {
  //TODO
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

    const partialBack = matchTilelayer(
      oldTileset.background.concat(oldTileset.specialbackground).concat(oldTileset.special),
      tilesetJson as TilesetJson,
      "back",
      firstgid
    );

    if(partialBack) {
      fullMatchMap.back = mergeLayerMatchMaps(fullMatchMap.back, partialBack);
    }
    

    const partialFront = matchTilelayer(oldTileset.foreground.concat(oldTileset.specialforeground).concat(oldTileset.special), tilesetJson as TilesetJson, "front", firstgid);
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

/*
function convertPngToGid(RgbaArray:RgbaValue[], tileMatchMap: TileMatch[]):Buffer {
  const GidBuffer = Buffer.alloc(RgbaArray.length*4);
  for(let rgbaN = 0; rgbaN < RgbaArray.length; rgbaN++) {
    for(const conversion of tileMatchMap) {
      if(isRgbaEqual(RgbaArray[rgbaN], conversion.tileRgba)) {
        const gid = conversion.tileGid;
        GidBuffer.writeUInt32LE(gid, rgbaN*4);
      }
    }
  }
  return GidBuffer;
}
*/

function convertPngToGid(RgbaArray:RgbaValue[], tileMatchMap: LayerTileMatch[]):number[] {
  const layerGids = new Array(RgbaArray.length).fill(0);
  for(let rgbaN = 0; rgbaN < RgbaArray.length; rgbaN++) {
    for(const conversion of tileMatchMap) {
      if(isRgbaEqual(RgbaArray[rgbaN], conversion.tileRgba)) {
        const gid = conversion.tileGid;
        layerGids[rgbaN] = gid;//layerGids[rgbaN] = gid;
      }
    }
  }
  return layerGids;
}

function zlibTest() {
  console.log(`Testing zlib functionality`);
  const chunk =
    "eJzt1T9uwjAUx3HfxGoOwWV6iQ4MqBNjlx6BSzAwW108MHGj5gmsGniJXxoHv9i/J30FSPn3kRPijNk7hBBCCCFULKNoXEPWMK4hazwOXnjhhRdelePghRdeeOFNzu6N/9x09585xxXykm0ocsblnP+YxpKcc8zKeXOaS3hpLtaYQ287Mn101977PitY3zASb+7hrnlOU84t8Yb7OfyXxfNt+e81eMkzpda8Q2btXups0x1v+cR9vQYvt02cr9z7ZdrxkjXUgnft63ti2nbXanp+U+8SchxuSd492r2pNYu94Xc83t6n3UszdD9TZ/vsfTSu0Std3zErvHq8P/YvqTdlffSG42v0Sp5fzV7fH9Mb/nw+dwNezzjDPkt5tQYvvLV4c1tb9Go2L+XVaF7Sqs39Kmtp86udc8zS/bjtSjqn+qXbl77+OebS14Ha6xfz8DLr";
  const chunk64 = Buffer.from(chunk, "base64");
  console.log(chunk64);
  // console.log(chunk64.toString("base64"));
  zlib.inflate(chunk64, (error, buffer) => {
    console.error(error || "Decompression OK");
    console.log(buffer);
    console.log(`First raw GID is ${buffer.readUInt32LE(4)}`);
    /*
    zlib.deflate(buffer, (error, result) => {
      const recompressed = Buffer.from(result).toString("base64");
      console.log(recompressed);
      console.log(
        `initial and recompressed chunks match? ${chunk === recompressed}`
      );
    });
    */
    const arr = [...buffer];
    console.log(arr);
    // console.log(buffer.toString("hex"));

    const FLIPPED_HORIZONTALLY_FLAG = 0x80000000;
    const FLIPPED_VERTICALLY_FLAG = 0x40000000;
    const FLIPPED_DIAGONALLY_FLAG = 0x20000000;
    const ROTATED_HEXAGONAL_120_FLAG = 0x10000000;
    let tile_index = 0;
    //Tiled writes non-compressed GIDs in little-endian 32-bit unsigned ints, i.e. each4 bytes in a buffer is a GID
    //however, highest 4 bits are used as flipping flags (no pun intended)
    //details: https://doc.mapeditor.org/en/latest/reference/global-tile-ids/#tile-flipping
    //bit 32 - horizontal flip, bit 31 - vertical, bit 30 - diagonal (rotation). Bit 29 is for hexagonal maps, which Starbound file is not, so it can be ignored - but we still need to clear it, just in case
    const FLAG_HORIZ_FLIP = 8 << 28; //1000 shifted left 32-4=28 positions.
    const FLAG_VERT_FLIP = 4 << 28; //0100 shifted left
    const FLAG_DIAG_FLIP = 2 << 28; //0010 shifted left
    const FLAG_HEX_120_ROTATE = 1 << 28; //0001 shifted left
    //1+2+4+8 = 15, i.e. 1111 in binary, the case with all flags set to true
    const flagsMask = 15 << 28
      //FLAG_HORIZ_FLIP | FLAG_VERT_FLIP | FLAG_DIAG_FLIP | FLAG_HEX_120_ROTATE; //Sum all flags using bitwise OR to get a mask. When applied to a UInt32 it should reset all bits but flags to 0
    //in other words, since flags are 4 high bits, it's 111100...0000
    const gidMask = ~flagsMask; //reverse (~) mask is 000011..1111, it will reset flags and give us "pure" GID
    const rawGidFirst = buffer.readUInt32LE(0);
    console.log(rawGidFirst);
    const pureFlags = rawGidFirst & flagsMask;
    const pureGid = rawGidFirst & gidMask;
    //what we have from decompression
    console.log(`Flags are ${pureFlags >>> 28}, pure GID is ${pureGid}`);
    //what we should have from correct decompression
    console.log(
      `Flags are ${(2147483847 & flagsMask) >>> 28}, pure GID is ${
        2147483847 & gidMask
      }`
    );
    //DAFUQ

    /*
    let flags = 15 // 1111 binary - all set
  let gid = 7892 // whatever
  let flagsShifted = flags << 28 // flags need to end up on the left side of the combined number. Whole length is 32, flags length is 4 so we need to shift left 32 - 4 =28
  let gidMask = ~ (15 << 28) // all set flags shifted (<<) and negated (~) will give us 0000111...111 
  let flagsMask = (15 << 28)
  let combined = ( flags & flagsMask) | (gid & gidMask)

  Розпаковка на js

let gid = combined & gidMask
let flags = combined >>> 28

int -> little endian byte array

let res = [0,0,0,0]
let byteMask = 255
res[0] = combined & byteMask

res[1] = (combined >>> 8) & byteMask;
res[2] = (combined >>> 16) & byteMask;
res[3] = (combined >>> 24) & byteMask;
*/

    // Here you should check that the data has the right size
    // (map_width * map_height * 4)
  });
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
  matchObjectsBiome,
  matchNPCS,
  matchStagehands,
  matchWires,
  matchMods,
  //mergeLayerMatchMaps,
  slicePixelsToArray,
  convertPngToGid,
  zlibTest,
  TILESETJSON_NAME,
  };
  