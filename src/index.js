import * as dungeonsFS from "./dungeonsFS";
import * as tilesetMatcher from "./tilesetMatch";
import * as dungeonAssembler from "./dungeonChunkAssembler";
import {
  getFilename,
  getExtension,
  getFilenameFromPath,
  getDirContents,
  getDungeons,
  extractOldTileset,
  getPixels_test,
  matchAllObjects,
} from "./conversionSteps";

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
          if (getExtension(file.name) === "dungeon") {
            dungeonPath = file.path + "/" + file.name;
            // console.log(dungeonPath);
            const dungeons = await dungeonsFS.getDungeons(dungeonPath);
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
              if (dungeons.parts in dungeons) {
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

async function writeConvertedMap_test(log = false) {
  const newTilesetShapes = await tilesetMatcher.calcNewTilesetShapes();
  //convert absolute paths to relative

  for (const tilesetShape of newTilesetShapes) {
    tilesetShape.source = `.${tilesetShape.source.substring(
      tilesetShape.source.indexOf("input-output") + 12
    )}`; //replace everything up to and with "input-output" with .
  }

  const ioDir = await dungeonsFS.readDir();
  for (const file of ioDir.filter(
    (file) => getExtension(file.name) === "png"
  )) {
    if (file.isFile()) {
      if (getExtension(file.name) === "png") {
        if (file.name.includes("objects")) {
          continue; //do not convert objects layers as separate files
        }

        const newPath = `${dungeonsFS.ioDirPath}/${getFilename(
          file.name
        )}.json`;
        console.log(
          `Detected ${file.name}, writing ${getFilename(file.name)}.json...`
        );

        const convertedChunk = new dungeonAssembler.SbDungeonChunk(
          newTilesetShapes
        );
        const getPixelsPromise = promisify(getPixels); //getPixels originally doesn't support promises
        const oldTileset = await extractOldTileset(log);
        const sortedOldTileset = await tilesetMatcher.getSortedTileset(
          oldTileset
        );
        const fullMatchMap = await tilesetMatcher.matchAllTilelayers(
          sortedOldTileset
        );

        let pixelsArray;
        //Calculating original chunk
        try {
          pixelsArray = await getPixelsPromise(
            `${dungeonsFS.ioDirPath}/${file.name}`
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

        const miscTileset = await dungeonsFS.getTileset(
          tilesetMatcher.TILESETMAT_NAME.misc
        );
        const anchorsMap = tilesetMatcher.matchAnchors(
          sortedOldTileset.anchors,
          miscTileset,
          convertedChunk.getFirstGid(tilesetMatcher.TILESETMAT_NAME.misc)
        );
        for (let rgbaN = 0; rgbaN < RgbaArray.length; rgbaN++) {
          for (const match of anchorsMap) {
            if (tilesetMatcher.isRgbaEqual(RgbaArray[rgbaN], match.tileRgba)) {
              const gid = match.tileGid;
              const { x: anchorX, y: anchorY } =
                convertedChunk.getCoordsFromFlatRgbaArray(
                  rgbaN,
                  pixelsArray.shape[0]
                );
              convertedChunk.addAnchorToObjectLayer(gid, anchorX, anchorY);
            }
          }
        }

        let pixelsObjArray;
        //MERGE additional tilelayers from OBJECTS
        if (ioDir) {
          const pngObjects = ioDir.find(
            (fileObjects) =>
              fileObjects.isFile() &&
              fileObjects.name.includes("-objects") &&
              fileObjects.name.includes(getFilename(file.name)) &&
              getExtension(fileObjects.name) === "png"
          );

          if (pngObjects) {
            //if we found name-objects.png file
            try {
              pixelsObjArray = await getPixelsPromise(
                `${dungeonsFS.ioDirPath}/${pngObjects.name}`
              );
            } catch (error) {
              console.error(error);
              return undefined;
            }
            if (log) {
              console.log(
                "  -Found objects PNG, image shape: ",
                pixelsObjArray.shape
              ); //shape = width, height, channels
            }
            //pixelsObjArray.data is a Uint8Array of (shape.width * shape.height * #channels) elements
            // convertedChunk.setSize(pixelsObjArray.shape[0], pixelsObjArray.shape[1]);
            const RgbaArray = tilesetMatcher.slicePixelsToArray(
              pixelsObjArray.data,
              ...pixelsObjArray.shape
            );
            //we use the same MatchMap since it's still the same dungeon - tilesets didn't change
            const convertedBackLayer = tilesetMatcher.convertPngToGid(
              RgbaArray,
              fullMatchMap.back
            );
            const convertedFrontLayer = tilesetMatcher.convertPngToGid(
              RgbaArray,
              fullMatchMap.front
            );
            if (log) {
              console.log(`  - merging tilelayers from objects.png...`);
            }
            convertedChunk.mergeTilelayers(
              convertedFrontLayer,
              convertedBackLayer
            );
          }
        }

        //match object RGB to ID locally, calc required tilesets
        const objectsMap = await matchAllObjects(sortedOldTileset.objects);
        //Add required tilesets to chunk
        await convertedChunk.addObjectTilesetShapes(objectsMap.tilesets);
        // await convertedChunk.parseAddObjects();
        //convert objectsMap from using Ids to using Gids
        const objectsGidMap = convertedChunk.convertIdMapToGid(objectsMap);
        const objRgbaArray = tilesetMatcher.slicePixelsToArray(
          pixelsObjArray.data,
          ...pixelsObjArray.shape
        );
        //TODO map PNG to objects using objectsGidMap - DEBUG THIS!!!
        await convertedChunk.parseAddObjects(
          sortedOldTileset.objects,
          objRgbaArray,
          objectsMap
        );

        //NPCs
        const npcMap = tilesetMatcher.matchNPCS(sortedOldTileset.npcs);
        convertedChunk.parseAddNpcs(objRgbaArray, npcMap);
        //ground tile mods
        const modMap = tilesetMatcher.matchMods(sortedOldTileset.foreground);
        //TODO add mods to chunk here
        convertedChunk.parseMods(RgbaArray, modMap);
        convertedChunk.parseMods(objRgbaArray, modMap);

        const success = await dungeonsFS.writeConvertedMapJson(
          newPath,
          convertedChunk
        );
        if (success) {
          console.log(`SUCCESS! ${getFilename(file.name)}.json saved.`);
        }

        //return 4; //TEMP - return on first PNG converted
      }
    }
  }
  return 4;
}

function invokeAction(argv) {
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
    case "writeconverted_test":
      writeConvertedMap_test(true);
      break;
    default:
      console.warn(`\x1B[31m Unknown action type: ${action}!`);
      console.log(argv);
  }
}

const args = yargs(process.argv.slice(2)).argv;
// console.log(args);
invokeAction(args);
