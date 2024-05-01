import {promises as nodeFS} from "fs";
import * as nodePath from "path";
// import {v4 as uuidv4} from "uuid";

//https://0xacab.org/bidasci/starbound-v1.4.4-source-code/-/blob/no-masters/tiled/properties.txt?ref_type=heads


interface TilesetJson { 
  tilecount: number
};

const TILESETJSON_NAME = {
  materials: "materials",
  supports: "supports",
  liquids: "liquids",
  misc: "miscellaneous",
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

const ANCHORS = [
  "worldGenMustContainSolidBackground",
  "worldGenMustContainAirBackground",
  "worldGenMustContainAirForeground"
];

interface TilesetMatJson extends TilesetJson {
  name: "materials"|"supports",
  tileproperties:{
    [key: string] : ({
      "//description"? : string,
      "//name"? : string,
      "//shortdescription"? : string,
      material: string
    } | {
      "//name": string,
      invalid: "true",
    }),
  },
}

interface TilesetLiquidJson extends TilesetJson {
  name: "liquids",
  tileproperties:{
    [key: string] : {
      "//name" : string,
      "//shortdescription"? : string,
      source?: "true",
    } & ( {liquid: string} | {invalid: "true"} ),
  },
}

interface TilesetMiscJson extends TilesetJson {
  name: "miscellaneous",
  tileproperties: {
    [key:string] : {
      "//description" : string,
      "//shortdescription" : string,
    } & ( ({
      clear?: "true" | "false",
      allowOverdrawing? : "true",
      surface? : string,
      layer?: "back",
    } & ( {worldGenMustContainAir?: ""} | 
      {worldGenMustContainSolid?: ""} | 
      {worldGenMustContainLiquid?: ""} | { worldGenMustNotContainLiquid?: ""} )
      ) | 
    {
      connector: string
    } | {
      material: string
    } | {
      dungeonid: string
    } | {
      playerstart: ""
    } | {
      biomeitems: ""
    } | {
      biometree: ""
    })
  }
}

type Brush = ["clear"] |
["surface"|"surfacebackground", {variant:number}?, any?] | //material, tilled? 
["liquid", string] |
["front"|"back", string, string?] |
["biometree"|"biomeitems"|"playerstart"|"wire"|"stagehand"|"npc"|"object", any?];

type RgbaValue = [number, number, number, number];

type Tile = {
  value: RgbaValue, // [R, G, B, A]
  comment?: string,
  brush?: Brush[],
  rules?: ["allowOverdrawing"] | any[],
  connector?: boolean,
};

//old tile structure:
    /*
  {
    "value": [ R, G, B, A],
    "comment": "some comment"
    ?"brush":[
    [special|"clear"],
    [?background],
    [?foreground]
    ]
    ...
  }
*/

type OldTilesetSorted = {
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

type TileMatch = {
  tileName: string,
  tileRgba: RgbaValue,
  tileGid: number
};

type TileMatchMap = TileMatch[];

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
      source: `${currentTsPath.replace(/\//g, "\u005C" + "/")}`,
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

function getSortedTileset(arrayOfOldTiles : Tile[]) :OldTilesetSorted {
  const oldTiles :OldTilesetSorted = {
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
      oldTiles.anchors.push(tile);
      continue;
    }
    if(tile.rules) {
      const ruleMatch = tile.rules.flat(3).filter((ruleString) => {
        return ANCHORS.includes(ruleString);
      });
      if(ruleMatch.length === 1) {
        oldTiles.anchors.push(tile);
        continue;
      }
    }
    
    if (tile.brush === undefined) {
      oldTiles.special.push(tile); //if there is no brush at all, probably a Special tile
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
              oldTiles.special.push(tile); //brush contains 1 "clear" element > special tile
            }
            break; //otherwise skip
          case "biometree":
          case "biomeitems":
            oldTiles.objects.push(tile);
            break;
          case "playerstart":
            oldTiles.anchors.push(tile);
            break;
          case "surface":
            oldTiles.specialforeground.push(tile);
            break;
          case "surfacebackground":
            oldTiles.specialbackground.push(tile);
            break;
          case "wire":
            oldTiles.wires.push(tile);
            break;
          case "stagehand":
            oldTiles.stagehands.push(tile);
            break;
          case "npc":
            oldTiles.npcs.push(tile);
            break;
          case "object":
            oldTiles.objects.push(tile);
            break;
          case "back":
            oldTiles.background.push(tile);
            break;
          case "front":
          case "liquid": //liquids are foreground-only
            oldTiles.foreground.push(tile);
            break;
          default:
            oldTiles.undefined.push(tile);
        }
      }
    }
  }

  return oldTiles;
}

//compares explicitly defined tilelayer-related tiles, like foreground/background, liquid etc
function matchTilelayer(oldTilesCategoryArray: Tile[], newTilesetJSON: TilesetMatJson | TilesetLiquidJson | TilesetMiscJson, layerName: "front" | "back", firstgid: number) : TileMatch[] {
  if (firstgid < 1) {
    return undefined;
  }
  const matchMap = oldTilesCategoryArray.map((tile : Tile): TileMatch => {
    const { value, comment, brush, rules }: Tile = tile;
    
    //if we match materials, platforms or liquids
    if([TILESETJSON_NAME.materials, TILESETJSON_NAME.supports, TILESETJSON_NAME.liquids].includes(newTilesetJSON.name)) {
      if (brush === undefined) {
        return;
        //throw new Error(`Tile brush is ${brush}`);
      }
      const newBrushType = (newTilesetJSON.name === TILESETJSON_NAME.liquids)?"liquid":"material";

      const oldBrushTypes = [];
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
            const material = newTilesetJSON.tileproperties[materialIndex][newBrushType];
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
      if(layerName === "front" && brush.flat(1).includes("surfacebackground") ||
      layerName === "back" && brush.flat(1).includes("surface")) {
        return;
      }
      //if we have special tile, but search for front layer - skip
      if(layerName === "front" && (comment.toLowerCase().includes("magic pink") || 
      brush.length === 1 && brush.flat(1)[0] === "clear")) {
        return;
      }

      /*
      SPECIAL - BKG:
      1 = comment: "magic pinkppp, a no-op value"
      0 = brush:["clear"], comment:"Empty hole"
      11 = brush:["clear"], comment:"Empty hole overwritable" */
      //Magic Pink Brush #1
      if(comment.toLowerCase().includes("magic pink")) {
        return {tileName: "magic pink", tileRgba: value, tileGid: 1 + firstgid};
      }
      if(brush && brush.length === 1 && brush.flat(1)[0] === "clear") {
        //Empty hole overwritable #11
        if(comment.toLowerCase().includes("empty hole") &&
        rules.flat(2).includes("allowOverwriting")) {
          return {tileName: "empty hole overwritable", tileRgba: value, tileGid: 11}
        }
        //Empty hole #0
        if(comment.toLowerCase().includes("empty hole")) {
          return {tileName: "empty hole overwritable", tileRgba: value, tileGid: 0}
        }
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
                  return {tileName: "surface #0", tileRgba: value, tileGid: 8};    
                case 1: 
                  return {tileName: "surface #1", tileRgba: value, tileGid: 9};
                case 2:
                  return {tileName: "surface #2", tileRgba: value, tileGid: 10};
              }
            }
            else {
              return {tileName: "surface", tileRgba: value, tileGid: 8};
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
                  return {tileName: "surfacebackground #0", tileRgba: value, tileGid: 8};    
                case 1: 
                  return {tileName: "surfacebackground #1", tileRgba: value, tileGid: 9};
                case 2:
                  return {tileName: "surfacebackground #2", tileRgba: value, tileGid: 10};
              }
            }
            else {
              return {tileName: "surfacebackground", tileRgba: value, tileGid: 8};
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

//merge two match maps with non-intersecting values and return new map
function mergeMatchMaps(matchMap1: TileMatch[], matchMap2: TileMatch[]): TileMatch[] {
  if (matchMap1.length > 0 && matchMap1.length != matchMap2.length) {
    throw new Error(`MAP SIZE MISMATCH: Merging matchMap1 of size ${matchMap1.length} with matchMap2 of size ${matchMap2.length}`);
  }
  const sumMap: TileMatch[] = []; 
  matchMap2.forEach((element, index) => {
    if (element != undefined && matchMap1[index] != undefined) {
      throw new Error(`CANNOT MERGE: both matches are defined at index ${index}`);
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

export {
  getSortedTileset,
  calcNewTilesetShapes,
  matchTilelayer,
  mergeMatchMaps,
  TILESETJSON_NAME,
  };
  