import * as dungeonsFS from "./dungeonsFS";
// import * as tilesetMatcher from "./tilesetMatch";
import * as tilesetMatcher from "./tilesetMatch";
import {Tile, ObjectTile, ObjectTileMatchType, TilesetObjectJsonType, TilesetMiscJsonType, OldTilesetSortedType } from "./tilesetMatch";
import {SbDungeonChunk} from "./dungeonChunkAssembler";
import { promisify } from "util";
import { NdArray } from "ndarray";

import getPixels from "get-pixels";

import * as nodePath from "path";

/**
 * utility
 * @param fileName 
 * @returns extension without the (.)
 */
function getExtension(fileName:string) {
    return fileName.substring(fileName.lastIndexOf(".") + 1);
  }
  
/**
 * utility
 * @param fileName 
 * @returns name without extension
 */
function getFilename(fileName:string) {
return fileName.substring(0, fileName.lastIndexOf("."));
}

function getFilenameFromPath(filePath:string) {
return nodePath.parse(filePath).name;
}

/**
 * debug function
 * @param log 
 * @returns 1
 */
async function getDirContents(log = false) {
  const ioDir = await dungeonsFS.readDir();
  if (log) {
    console.table(ioDir);
  }
  return 1;
}

async function getDungeons(log = false) {
  const ioDir = await dungeonsFS.readDir();
  if (log) {
    console.table(ioDir);
  }
  let dungeonPath = "";
  try {
    if(ioDir) {
      for (const file of ioDir) {
        if (file.isFile())
          if (getExtension(file.name) === "dungeon") {
            dungeonPath = file.path + "/" + file.name;
            // console.log(dungeonPath);
            const dungeons = await dungeonsFS.getDungeons(dungeonPath);
            if(dungeons?.metadata)
            console.log(
              `Found .dungeon file: ${dungeons?.metadata?.name || "some weird shit"
              }`
            );
          }
      }
    }
  } catch (error) {
    console.error(error);
    return undefined;
  }
  return 2;
}

async function extractOldTileset(log = false):Promise<tilesetMatcher.Tile[]|undefined> {
  const ioDir = await dungeonsFS.readDir();
  // console.table(ioDir);
  let dungeonPath:string = "";
  if(ioDir) {
    for (const file of ioDir) {
      if (file.isFile())
        if (getExtension(file.name) === "dungeon") {
          dungeonPath = dungeonsFS.ioDirPath + "/" + file.name;
          break; //break on first dungeon found!
        }
    }
  }
  let dungeons;

  dungeons = await dungeonsFS.getDungeons(dungeonPath);
  console.log(
    `Found .dungeon file: ${dungeons?.metadata?.name || "some weird shit"}`
  );
 
  let tileMap;
  if (dungeons?.tiles) {
    tileMap = dungeons.tiles;
  }
  else {
    console.error(
      `${dungeonPath} does not contain <tiles> map. New SB .dungeon files cannot be used.`
    );
    return undefined;
  }

  if (log) {
    dungeonsFS.writeTileMap(`${getFilename(dungeonPath) + ".TILES"}`, tileMap); //debug file
    console.log(`${getFilename(dungeonPath) + ".TILES"} saved to I/O dir`);
  }
  return tileMap;
}

/**
 * debug function
 * @returns promise of NdArray<Uint8Array>
 */
async function getPixels_test():Promise<NdArray<Uint8Array>> {
  const ioDir = await dungeonsFS.readDir();
  let filePath = "";
  if(ioDir) {
    for (const file of ioDir) {
      if (file.isFile()) {
        if (getExtension(file.name) === "png") {
          filePath = `${dungeonsFS.ioDirPath}/${file.name}`;
          break;
        }
      }
    }
  }
  const getPixelsPromise = promisify(getPixels); //getPixels originally doesn't support promises
  let pixelsArray:NdArray<Uint8Array>;
  try {
    pixelsArray = await getPixelsPromise(filePath, "image/png");
  } catch (error) {
    throw error;
    // console.error(error);
  }

  console.log("  -obtained image shape: ", pixelsArray?.shape.slice()); //shape = width, height, channels

  //pixelsArray.data is a Uint8Array of (shape.width * shape.height * #channels) elements

  const shape = {
    width: pixelsArray?.shape[0] as number,
    height: pixelsArray?.shape[1] as number,
    channels: pixelsArray?.shape[2] as number,
  };
  console.log(shape);
  let RgbaArray;
  if(pixelsArray?.data) {
    RgbaArray = tilesetMatcher.slicePixelsToArray(
      pixelsArray?.data,
      shape.width, shape.height, shape.channels
    );
  }
  
  return pixelsArray;
}

type FullObjectMap = {
  matchMap: (ObjectTileMatchType | undefined)[],
  undefinedTiles: number,
  tilesets: string[],
}

/**
 * 
 * @param arrayOfObjects Builds matchMap of objects
 * @returns matchMap, number of undefined tiles, list of names of used tilesets
 */
async function matchAllObjects(arrayOfObjects: ObjectTile[]): Promise<FullObjectMap> {
  function calcUndefined(matchArray: (ObjectTileMatchType | undefined)[]): number {
    let numOfUndefined = 0;
    for (const match of matchArray) {
      if (match === undefined) {
        numOfUndefined++;
      }
    }
    return numOfUndefined;
  }
  
  const tilesets: string[] = [];
  let matchMap = Array<ObjectTileMatchType | undefined>(arrayOfObjects.length);
  const allObjTilesets: string[] = [tilesetMatcher.TILESETOBJ_NAME.objHuge,
    ...tilesetMatcher.TILESETOBJ_NAME.byCategory,
    ...tilesetMatcher.TILESETOBJ_NAME.byColonyTag,
    ...tilesetMatcher.TILESETOBJ_NAME.byRace,
    ...tilesetMatcher.TILESETOBJ_NAME.byType
  ];
  const miscTilesetJSON = await dungeonsFS.getTileset(tilesetMatcher.TILESETMAT_NAME.misc) as TilesetMiscJsonType;
  matchMap = tilesetMatcher.matchObjectsBiome(arrayOfObjects, miscTilesetJSON, matchMap);
  let undefinedTiles: number = calcUndefined(matchMap);
  for (const objTileset of allObjTilesets) {
    const tilesetJson: TilesetObjectJsonType = await dungeonsFS.getTileset(objTileset) as TilesetObjectJsonType;
    matchMap = tilesetMatcher.matchObjects(arrayOfObjects, tilesetJson, matchMap);
    if (undefinedTiles > calcUndefined(matchMap)) {
      tilesets.push(objTileset); //If we found any matches - remember this tileset
      undefinedTiles = calcUndefined(matchMap); //and recalculate how much we have left to do
    }; 
  }
  return {
    matchMap,
    undefinedTiles,
    tilesets,
  };
}

export {
  getExtension,
  getFilename,
  getFilenameFromPath,
  getDirContents,
  getDungeons,
  extractOldTileset,
  getPixels_test,
  matchAllObjects,
  // FullObjectMap,
};

export type {
  FullObjectMap,
};

