import * as dungeonsFS from "./dungeonsFS";
import * as tilesetMatcher from "./tilesetMatch";
import * as compressor from "./compression";
import { SbDungeonChunk } from "./dungeonChunkAssembler";
import {
  extractOldTileset,
  matchAllObjects,
  writeConvertedMap_test
} from "./conversionSteps";
import {
  getFilenameFromPath,
  getDirContents,
  getDungeons,
  getPixels_test,
} from "./legacy";

import getPixels from "get-pixels";

// import * as nodePath from "path";

import yargs from "yargs";
import { promisify } from "util";

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
            const dungeons = await dungeonsFS.getDungeons(dungeonPath);
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
                (dungeons as dungeonsFS.DungeonFile).parts?.forEach((part) => {
                  try {
                    // console.log(part);
                    if (part.def[0] === "tmx")
                      throw new Error(
                        `Part ${part.name} seems to be in new format already (TMX, not 'image'). Aborting.`
                      );
                    if (part.def[0] === "image") {
                      partPairs.push(part.def[1]); //let's save related parts in a nice table
                      // console.log(`    Processing dungeon part ${part.def[1][0]}`);
                      part.def[1] = part.def[1][0]; //parts past 0 are objects, items etc. located in separate PNGs. TMX format should only have one JSON file, so user will need to superimpose those "partials" manually later. For now we leave in the registry only the main one
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

function invokeAction(argv: { [key: string]: unknown }) {
  const { action } = argv;
  switch (action) {
    // case "dir_test":
    //   getDirContents(true);
    //   break;
    // case "dungeons":
    //   getDungeons(true);
    //   break;
    // case "getpixels_test":
    //   getPixels_test();
    //   break;
    // case "calctilesetshapes_test":
    //   tilesetMatcher.calcNewTilesetShapes(true);
    //   break;
    case "convdungeons":
      convertDungeon();
      break;
    case "zlib_test":
      compressor.zlibTest();
      break;
    case "extractoldtileset":
      extractOldTileset(true);
      break;
    case "writeconverted_test":
      writeConvertedMap_test(true);
      break;
    default:
      console.warn(`\x1B[31m Unknown action type: ${action}!`);
      console.log(argv);
  }
}

const args = yargs(process.argv.slice(2)).argv;
Promise.resolve(args).then((args) => {
  // console.log(args);
  invokeAction(args);
})