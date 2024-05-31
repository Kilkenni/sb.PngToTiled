/**
 * Legacy conversion steps for debug
 * Not used in actual conversion.
 */
import nodePath from "path";
import { promisify } from "util";
import { NdArray } from "ndarray";
import getPixels from "get-pixels";

import * as dungeonsFS from "./dungeonsFS";
import * as tilesetMatcher from "./tilesetMatch";

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
          if (dungeonsFS.getExtension(file.name) === "dungeon") {
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
        if (dungeonsFS.getExtension(file.name) === "png") {
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

export {
  getFilenameFromPath,
  getDirContents,
  getDungeons,
  getPixels_test,
}