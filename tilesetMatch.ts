const nodeFileSys = require("fs").promises;
const nodePathModule = require("path");
const { v4: uuidv4 } = require("uuid");

//https://0xacab.org/bidasci/starbound-v1.4.4-source-code/-/blob/no-masters/tiled/properties.txt?ref_type=heads


interface TilesetJson { 
  tilecount: number,
};

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
["surface"|"surfacebackground", any?, any?] | //material, tilled? 
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
  wires: Tile[],
  stagehands: Tile[],
  npcs: Tile[],
  objects: Tile[],
  undefined: Tile[],
};

type TileMatchMap = {
  tileName: string,
  tileGid: number
}[];

/*

/will Array.sort() speed up things?
//Do we need to account for duplicate items? Better do not add them in the first place!
//returns percents of matches from 1st array
function matchTileKeywords(tileKeywordsArray, testTileKeywordsArray) {
  let matched = 0;
  for (const keyword of tileKeywordsArray) {
    if (testTileKeywordsArray.includes(keyword)) {
      matched++;
    }
  }
  const matchPercent = (matched * 100) / tileKeywordsArray.length;
  return Math.round(matchPercent);
}

//searches match for an old tile in an array of new tiles based on matching comment (old) with shortdescription (new)
function findTileMatch(oldTile, newTilesObjectArray) {
  let oldTileKeywords;
  if (oldTile?.comment) {
    oldTileKeywords = [
      ...new Set(oldTile.comment.toLowerCase().split(/[,!?.:;]*[\s]+/)),
    ]; //use Set to remove duplicate values
    //add splitting by CamelCase as well - for rules, not comments
  }

  for (const testTile in newTilesObjectArray) {
  }
} 

*/

function getSortedTileset(arrayOfOldTiles) :OldTilesetSorted {
  const oldTiles :OldTilesetSorted = {
    foreground: [] ,
    background: [],
    specialforeground: [],
    specialbackground: [],
    special: [],
    wires: [],
    stagehands: [],
    npcs: [],
    objects: [],
    undefined: [],
  };

  for (const tile of arrayOfOldTiles) {
    
    if (tile.brush === undefined) {
      oldTiles.special.push(tile); //if there is no brush at all, probably a Special tile
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
          case "playerstart":
            oldTiles.special.push(tile);
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


      
      /*
      //COMPLE OUTDATED CHECK - REMOVE

      if (oldTile.brush.length === 1) {
        if (oldTile.brush[0].length === 1) {
          if (oldTile.brush[0][0] === "clear") {
            oldTiles.special.push(oldTile); //brush contains 1 "clear" element > special tile
          } else {
            oldTiles.foreground.push(oldTile);
          }
        } else {
          switch (oldTile.brush[0][0]) {
            case "surface":
              oldTiles.foreground.push(oldTile);
              break;
            case "wire":
              oldTiles.wires.push(oldTile);
              break;
            case "stagehand":
              oldTiles.stagehands.push(oldTile);
              break;
            case "npc":
              oldTiles.npcs.push(oldTile);
              break;
            default:
              console.log(
                `Error, tile brush of size 1 contains ${oldTile.brush} which cannot be identified`
              );
          }
        }
      } else if (oldTile.brush.length === 2) {
        if (oldTile.brush[0].length === 1) {
          if (oldTile.brush[0][0] === "clear") {
            if (oldTile.brush[1][0] === "back") {
              oldTiles.background.push(oldTile); //brush contains 2 elements, 1-st is "clear" element > background tile
            } else {
              oldTiles.undefined.push(oldTile);
            }
          } else
            console.log(
              `Error, tile brush of size 2; 1-st element is not "clear", contains ${oldTile.brush}`
            );
        } else {
          console.log(
            `Error, tile brush of size 2, strange 1-st element: ${oldTile.brush}`
          );
        }
      } else if (oldTile.brush.length === 3) {
        if (oldTile.brush[0][0] != "clear") {
          console.log(
            `Error, tile brush of size ${oldTile.brush.length} contains ${oldTile.brush}, first slot is not "clear"`
          );
          continue; //NEXT TILE
        }
        for (const brush of oldTile.brush) {
          switch (brush[0]) {
            case "clear":
              break;
            case "back":
              oldTiles.background.push(oldTile);
              break;
            case "front":
              oldTiles.foreground.push(oldTile);
              break;
            default:
              console.log(
                `Error, tile brush of size ${oldTile.brush.length} contains ${oldTile.brush} - CANNOT BE SORTED`
              );
          }
        }
        if (oldTile.brush[1][0] === "back") {
        }
      } else {
        console.log(
          `Error, tile brush of size ${oldTile.brush.length} contains ${oldTile.brush}`
        );
      }
      */
    }
  }

  return oldTiles;
}

//compares explicitly defined tilelayer-related tiles, like foreground/background, liquid etc

function matchTilelayer(oldTilesCategoryArray: Tile[], newTilesetJSON: TilesetMatJson, layerName: "front" | "back", firstgid: number) : TileMatchMap {
  if (firstgid < 1) {
    return undefined;
  }
  const matchMap = oldTilesCategoryArray.map((tile) => {
    const { /*value, comment,*/ brush, rules }: Tile = tile;
    if (brush === undefined) {
      return;
      //throw new Error(`Tile brush is ${brush}`); //TODO Special Misc tiles
    }
    for (const brushLayer of brush) {
      const [brushType, brushMaterial]: Brush = brushLayer;
      switch (brushType) {
        case "front":
          for (const materialIndex in newTilesetJSON.tileproperties) {
            const material = newTilesetJSON.tileproperties[materialIndex]["material"];
            if (material === brushMaterial) {
              return { tileName: brushMaterial, tileGid: (parseInt(materialIndex) + firstgid )};
            }
          }
          break;
        default:
          //No matches on this brush layer, do nothing
      }
    }
    return; //if no matches are found - next tile
  });
    /*
    front tile:
    -brush: []
    --type: "clear", "liquid", "front, "back"
    --material (for any but "clear" - can be mat or support)
    --tilled (optional)
    -comment: "string"
    -value: [RGBA]
    -rules (optional)
    --allowOverdrawing (optional)
    */

    return matchMap;
}

//merge two match maps with non-intersecting values and return new map
function mergeMatchMaps(matchMap1: TileMatchMap, matchMap2: TileMatchMap): TileMatchMap {
  if (matchMap1.length != matchMap2.length) {
    throw new Error(`MAP SIZE MISMATCH: Merging matchMap1 of size ${matchMap1.length} with matchMap2 of size ${matchMap2.length}`);
  }
  const sumMap: TileMatchMap = []; 
  matchMap1.forEach((element, index) => {
    if (element != undefined && matchMap2[index] != undefined) {
      throw new Error(`CANNOT MERGE: both matches are defined at index ${index}`);
    }
    if (element != undefined) {
      sumMap[index] = element;
    }
    else {
      sumMap[index] = matchMap2[index];
    }
  })

  return sumMap;
}

module.exports = {
  getSortedTileset,
  matchTilelayer,
  mergeMatchMaps,
  };
  