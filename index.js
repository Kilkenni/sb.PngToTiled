import * as dungeonsApi from "./dungeonsFS.js";
// import * as tilesetMatcher from "./tilesetMatch";
import * as tilesetMatcher from "./tilesetMatch.js";
import * as dungeonAssembler from "./dungeonChunkAssembler.js";

import getPixels from "get-pixels";

import { promises as nodeFileSys } from "fs";
import * as nodePath from "path";

// const tilesetMatcher = require("./tilesetMatch");
// const getPixels = require("get-pixels");
// const zlib = require("zlib");
// const nodeFileSys = require("fs").promises;
// const nodePathModule = require("path");

// const argv = require("yargs").help().argv;

import yargs from "yargs";
import { promisify } from "util";
// import { hideBin } from 'yargs/helpers';

// const argv = yargs.help().argv;

let dungeonDefinition = {};
let rawPNG = undefined;

//get extention from path (without .)
function getExtension(fileName) {
  return fileName.substring(fileName.lastIndexOf(".") + 1);
}

//trunc extension and .
function getFilename(fileName) {
  return fileName.substring(0, fileName.lastIndexOf("."));
}

function getFilenameFromPath(filePath) {
  return nodePath.parse(filePath).name;
}

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
    for (const file of ioDir) {
      if (file.isFile())
        if (getExtension(file.name) === "dungeon") {
          dungeonPath = file.path + "/" + file.name;
          // console.log(dungeonPath);
          const dungeons = await dungeonsApi.getDungeons(dungeonPath);
          console.log(
            `Found .dungeon file: ${
              dungeons?.metadata?.name || "some weird shit"
            }`
          );
        }
    }
  } catch (error) {
    console.error(error);
    return undefined;
  }
  return 2;
}

async function convertDungeon() {
  const ioDir = await dungeonsApi.readDir();
  // console.table(ioDir);
  let dungeonPath = "";
  try {
    for (const file of ioDir) {
      if (file.isFile())
        if (getExtension(file.name) === "dungeon") {
          dungeonPath = file.path + "/" + file.name;
          // console.log(dungeonPath);
          const dungeons = await dungeonsApi.getDungeons(dungeonPath);
          console.log(
            `Found .dungeon file: ${
              dungeons?.metadata?.name || "some weird shit"
            }`
          );

          //converting dungeon from old SB format into new
          if (dungeons && dungeons.tiles) {
            //
            delete dungeons.tiles; //New format does not store a map of tiles here
            console.log("  Processing: <tiles> deleted");
            if (!dungeons.protected) dungeons.metadata.protected = false; //if tile protection is not enabled, disable it explicitly
            console.log("  Processing: <tile protection> established");
            if (dungeons.parts) {
              const partPairs = [];
              console.log("  Processing: <parts>");
              dungeons.parts.forEach((part) => {
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
                  console.error(error.message);
                  return null;
                }
              });
            }
          } else {
            console.error(
              "No tile info in dungeon file. Already converted to new format?"
            );
            continue; //next file, please
          }
          const success = await dungeonsApi.writeConvertedDungeons(dungeons);
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
  } catch (error) {
    console.error(error);
    return undefined;
  }
  return 3;
}

async function extractOldTileset(log = false) {
  const ioDir = await dungeonsApi.readDir();
  // console.table(ioDir);
  let dungeonPath = "";
  for (const file of ioDir) {
    if (file.isFile())
      if (getExtension(file.name) === "dungeon") {
        // console.log(file.path);
        dungeonPath = dungeonsApi.ioDirPath + "/" + file.name;
        // console.log(dungeonPath);
        break; //break on first dungeon found!
      }
  }
  let dungeons;
  try {
    dungeons = await dungeonsApi.getDungeons(dungeonPath);
    console.log(
      `Found .dungeon file: ${dungeons?.metadata?.name || "some weird shit"}`
    );
  } catch (error) {
    console.error(error.message);
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

async function writeConvertedMap_test(log = false) {
  const newTilesetShapes = await tilesetMatcher.calcNewTilesetShapes();
  //convert absolute paths to relative

  for (const tilesetShape of newTilesetShapes) {
    tilesetShape.source = `.${tilesetShape.source.substring(
      tilesetShape.source.indexOf("input-output") + 12
    )}`; //replace everything up to and with "input-output" with .
  }
  const convertedChunk = new dungeonAssembler.SbDungeonChunk(newTilesetShapes);

  const ioDir = await dungeonsApi.readDir();
  for (const file of ioDir) {
    if (file.isFile()) {
      if (getExtension(file.name) === "png") {
        const newPath = `${dungeonsApi.ioDirPath}/${getFilename(
          file.name
        )}.json`;
        console.log(
          `Detected ${file.name}, writing ${getFilename(file.name)}.json...`
        );
        const getPixelsPromise = promisify(getPixels); //getPixels originally doesn't support promises
        let pixelsArray;
        try {
          pixelsArray = await getPixelsPromise(
            `${dungeonsApi.ioDirPath}/${file.name}`
          );
        } catch (error) {
          console.error(error);
          return undefined;
        }
        if (log) {
          console.log("  -obtained image shape: ", pixelsArray.shape); //shape = width, height, channels
        }
        //pixelsArray.data is a Uint8Array of (shape.width * shape.height * #channels) elements
        convertedChunk.setSize(pixelsArray.shape[0], pixelsArray.shape[1]);
        const RgbaArray = tilesetMatcher.slicePixelsToArray(
          pixelsArray.data,
          ...pixelsArray.shape
        );
        const oldTileset = await extractOldTileset(log);
        const sortedOldTileset = await tilesetMatcher.getSortedTileset(
          oldTileset
        );
        const fullMatchMap = await tilesetMatcher.matchAllTilelayers(
          oldTileset
        );
        const convertedBackLayer = tilesetMatcher.convertPngToGid(
          RgbaArray,
          fullMatchMap.back
        );
        const convertedFrontLayer = tilesetMatcher.convertPngToGid(
          RgbaArray,
          fullMatchMap.front
        );
        convertedChunk.addBothTilelayers(
          convertedFrontLayer,
          convertedBackLayer,
          pixelsArray.shape[0],
          pixelsArray.shape[1]
        );
        // convertedChunk.addUncompressedTileLayer(
        //   convertedBackLayer,
        //   "back",
        //   pixelsArray.shape[0],
        //   pixelsArray.shape[1]
        // );

        const success = await dungeonsApi.writeConvertedMapJson(
          newPath,
          convertedChunk
        );
        if (success) {
          console.log(`SUCCESS! ${getFilename(file.name)}.json saved.`);
        }

        return 4; //TEMP - return on first PNG converted
      }
    }
  }
  return 4;
}

async function getPixels_test() {
  const ioDir = await dungeonsApi.readDir();
  let filePath;
  for (const file of ioDir) {
    if (file.isFile()) {
      if (getExtension(file.name) === "png") {
        filePath = `${dungeonsApi.ioDirPath}/${file.name}`;
        break;
      }
    }
  }
  const getPixelsPromise = promisify(getPixels); //getPixels originally doesn't support promises
  let pixelsArray;
  try {
    pixelsArray = await getPixelsPromise(filePath);
  } catch (error) {
    console.error(error);
  }

  console.log("  -obtained image shape: ", pixelsArray.shape.slice()); //shape = width, height, channels

  //pixelsArray.data is a Uint8Array of (shape.width * shape.height * #channels) elements

  const shape = {
    width: pixelsArray.shape[0],
    height: pixelsArray.shape[1],
  };
  console.log(shape);
  const RgbaArray = tilesetMatcher.slicePixelsToArray(
    pixelsArray.data,
    ...pixelsArray.shape
  );
  return pixelsArray;
}

async function convertPixelToData() {
  const ioDir = await dungeonsApi.readDir();
  // console.table(ioDir);
  let dungeonPath = "";
  for (const file of ioDir) {
    if (file.isFile())
      if (getExtension(file.name) === "dungeon") {
        dungeonPath = file.path + "/" + file.name;
        // console.log(dungeonPath);
        break;
      }
  }
  let dungeons;
  try {
    dungeons = await dungeonsApi.getDungeons(dungeonPath);
    console.log(
      `Found .dungeon file: ${dungeons?.metadata?.name || "some weird shit"}`
    );
  } catch (error) {
    console.error(error.message);
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

  let mapPath = "";
  try {
    // console.table(tileMap);
    dungeonsApi.writeTileMap(`${getFilename(dungeonPath) + ".TILES"}`, tileMap);
    for (const file of ioDir) {
      if (file.isFile())
        if (getExtension(file.name) === "png") {
          mapPath = `${file.path}/${getFilename(file.name)}.json`;
          console.log(
            `Detected ${file.name}, writing ${getFilename(file.name)}.json...`
          );
          let map = {};
          getPixels(`${file.path}/${file.name}`, (error, pixels) => {
            if (error) {
              console.error(error);
              console.log("Bad PNG image path");
              return;
            }
            //PNG conversion here
            // map = mapPixelsToJson(pixels, tileMap);
            const tilesets = tilesetMatcher.calcNewTilesetShapes();
            //NEEDS AWAIT
            // dungeonsApi.writeConvertedMapJson(mapPath, map);
          });
        }
    }
  } catch (error) {
    console.error(error);
    return undefined;
  }
  return 4;
}

function invokeAction(argv) {
  const { action } = argv;
  switch (action) {
    case "dir_test":
      getDirContents(true);
      break;
    case "dungeons":
      getDungeons(true);
      break;
    case "convdungeons":
      convertDungeon();
      break;
    case "zlib_test":
      tilesetMatcher.zlibTest();
      break;
    case "extractoldtileset":
      extractOldTileset(true);
      break;
    case "calctilesetshapes_test":
      tilesetMatcher.calcNewTilesetShapes(true);
      break;
    case "getpixels_test":
      getPixels_test();
      break;
    case "writeconverted_test":
      writeConvertedMap_test(true);
      break;
    case "convertpixel_test":
      convertPixelToData();
      break;
    default:
      console.warn(`\x1B[31m Unknown action type: ${action}!`);
      console.log(argv);
  }
}

const args = yargs(process.argv.slice(2)).argv;
// console.log(args);
invokeAction(args);
