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
            const dungeons = await dungeonsFS.getDungeon(ioDir, true);
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

async function convertDungeon() {
  const ioDir = await dungeonsFS.readDir();
  // console.table(ioDir);
  let dungeonPath = "";
  try {
    if (ioDir) {
      for (const file of ioDir) {
        if (file.isFile())
          if (dungeonsFS.getExtension(file.name) === "dungeon") {
            dungeonPath = file.path + "/" + file.name;
            // console.log(dungeonPath);
            const dungeons = await dungeonsFS.getDungeon(ioDir, true);
            console.log(
              `Found .dungeon file: ${
                dungeons?.metadata?.name || "some weird shit"
              }`
            );

            //converting dungeon from old SB format into new
            if (dungeons!== undefined && dungeons.tiles) {
              //
              delete dungeons.tiles; //New format does not store a map of tiles here
              console.log("  Processing: <tiles> deleted");
              if (dungeons.protected === undefined) {
                dungeons.metadata.protected = false; //if tile protection is not enabled, disable it explicitly
              } 
              console.log("  Processing: <tile protection> established");
              if (dungeons.parts!== undefined) {
                const partPairs = [];
                console.log("  Processing: <parts>");
                (dungeons as dungeonsFS.DungeonJson).parts?.forEach((part) => {
                  try {
                    // console.log(part);
                    if (part.def[0] === "tmx")
                      throw new Error(
                        `Part ${part.name} seems to be in new format already (TMX, not 'image'). Aborting.`
                      );
                    if (part.def[0] === "image") {
                      partPairs.push(part.def[1]); //let's save related parts in a nice table
                      // console.log(`    Processing dungeon part ${part.def[1][0]}`);
                      //part.def[1] = part.def[1][0]; //parts past 0 are objects, items etc. located in separate PNGs. TMX format should only have one JSON file, so user will need to superimpose those "partials" manually later. For now we leave in the registry only the main one
                    }
                  } catch (error) {
                    console.error(error);
                    return;
                  }
                });
              }
            } else {
              console.error(
                "No tile info in dungeon file. Already converted to new format?"
              );
              continue; //next file, please
            }
            const success = await dungeonsFS.writeConvertedDungeons(dungeons);
            if (success) {
              console.log(
                `SUCCESS. ${dungeons.metadata.name} .dungeon file converted. Check I/O directory. Original file intact.`
              );
              console.log(
                `Remember to check files with JSONLint, just in case ;)`
              );
            }
          }
      }
    }
  } catch (error) {
    console.error(error);
    return undefined;
  }
  return 3;
}

export {
  getFilenameFromPath,
  getDirContents,
  getDungeons,
  getPixels_test,
  convertDungeon,
}