import * as dungeonsApi from "./dungeonsFS.js";
// import * as tilesetMatcher from "./tilesetMatch.js";
import * as tilesetMatcher from "./tilesetMatch.js";
// import * as dungeonAssembler from "./dungeonChunkAssembler.js";
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
  const ioDir = await dungeonsApi.readDir();
  if (log) {
    console.table(ioDir);
  }
  return 1;
}

async function getDungeons(log = false) {
  const ioDir = await dungeonsApi.readDir();
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
            const dungeons = await dungeonsApi.getDungeons(dungeonPath);
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

async function extractOldTileset(log = false) {
  const ioDir = await dungeonsApi.readDir();
  // console.table(ioDir);
  let dungeonPath:string = "";
  if(ioDir) {
    for (const file of ioDir) {
      if (file.isFile())
        if (getExtension(file.name) === "dungeon") {
          dungeonPath = dungeonsApi.ioDirPath + "/" + file.name;
          break; //break on first dungeon found!
        }
    }
  }
  let dungeons;
  try {
    dungeons = await dungeonsApi.getDungeons(dungeonPath);
    console.log(
      `Found .dungeon file: ${dungeons?.metadata?.name || "some weird shit"}`
    );
  } catch (error:any) {
    if(error) {
      console.error(error);
    }
    
    return undefined;
  }
  let tileMap;
  if (dungeons?.tiles) tileMap = dungeons.tiles;
  else {
    console.error(
      `${dungeonPath} does not contain <tiles> map. New SB .dungeon files cannot be used.`
    );
    return undefined;
  }

  if (log) {
    dungeonsApi.writeTileMap(`${getFilename(dungeonPath) + ".TILES"}`, tileMap); //debug file
    console.log(`${getFilename(dungeonPath) + ".TILES"} saved to I/O dir`);
  }
  return tileMap;
}

/**
 * debug function
 * @returns promise of NdArray<Uint8Array>
 */
async function getPixels_test():Promise<NdArray<Uint8Array>> {
  const ioDir = await dungeonsApi.readDir();
  let filePath = "";
  if(ioDir) {
    for (const file of ioDir) {
      if (file.isFile()) {
        if (getExtension(file.name) === "png") {
          filePath = `${dungeonsApi.ioDirPath}/${file.name}`;
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

export {
    getExtension,
    getFilename,
    getFilenameFromPath,
    getDirContents,
    getDungeons,
    extractOldTileset,
    getPixels_test,
};

