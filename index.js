const dungeonsApi = require("./dungeonsFS.js");
const tilesetMatcher = require("./tilesetMatch.js");
const getPixels = require("get-pixels");
const zlib = require("zlib");
const nodeFileSys = require("fs").promises;
const nodePathModule = require("path");

//Tiled JSON format reference: https://doc.mapeditor.org/en/stable/reference/json-map-format/

const argv = require("yargs").help().argv;

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
  return nodePathModule.parse(filePath).name;
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

//determine paths to tilesets for mapping PNG
function resolveTilesets() {
  const matPath = nodePathModule.resolve(
    "./input-output/tilesets/packed/materials.json"
  );
  const pathToTileset = matPath.substring(0, matPath.lastIndexOf("/"));
  return pathToTileset;
}

//calculates new tileset shapes (GIDs and stuff)
async function calcNewTilesetShapes(log = false) {
  const path = resolveTilesets();
  const TILESETS = [
    ///blocks
    "materials",
    "miscellaneous",
    "liquids",
    "supports",
    //TODO other tilesets for objects
  ];
  let startGID = 1;
  const tilesetsArray = [];
  for (tilesetName of TILESETS) {
    const currentTsPath = `${path}/${tilesetName}.json`;
    // console.log(currentTsPath);
    const tilesetDesc = {
      firstgid: startGID,
      source: `${currentTsPath.replace(/\//g, "\u005C" + "/")}`,
    };
    const currentTileset = JSON.parse(
      await nodeFileSys.readFile(currentTsPath)
    );
    // console.log(currentTileset)
    startGID = startGID + currentTileset.tilecount; //increase GID by size of current tileset
    tilesetsArray.push(tilesetDesc);

    // const tilesetsMatch = oldTileMap.map((tile) => {
    //   const newTile = tile;

    //   return newTile;
    // });

    // if (currentTileset.tileproperties) {
    //   for (const tile of currentTileset) {
    //   }
    // }
  }

  if (log) {
    console.log(tilesetsArray);
  }

  return tilesetsArray;
}

async function sortOldTileset(log = false) {
  const oldTileMap = await extractOldTileset(true);
  // const oldTiles = {
  //   tiletype: [],
  //   ...
  // };

  const oldTiles = tilesetMatcher.getSortedTileset(oldTileMap);

  console.log(`Total tile count: ${oldTileMap.length}`);
  for (const tiletype in oldTiles) {
    if (log && tiletype != "undefined") {
      console.log(
        `Checking ${tiletype}, matched tiles: ${oldTiles[tiletype].length}`
      );
    } else if (tiletype === "undefined") {
      if (oldTiles[tiletype].length > 0) {
        console.log(
          `FOUND ${tiletype} tiles, matched tiles: ${oldTiles[tiletype].length}`
        );
        console.log(oldTiles.undefined);
      } else {
        console.log("All tiles sorted!");
      }
    }
  }

  const oldTilesSorted = oldTiles;

  return oldTilesSorted;
}

async function matchTileset_test(log = false) {
  const oldTilesetSorted = await sortOldTileset();

  const tilesetsDesc = await calcNewTilesetShapes();

  const tilesetsDir = "/tilesets/packed/"  ;

  const tilesetFileNames = [
    "supports",
    "materials",
    "liquids",
  ]

  let matchMap = [];

  for(const tilesetFile of tilesetFileNames) {
    const tilesetFilepath = `${dungeonsApi.ioDirPath}${tilesetsDir}${tilesetFile}.json`

    const tilesetJson = await dungeonsApi.getTileset(tilesetFilepath);

    const firstgid = tilesetsDesc.find(
      (element) =>
        getFilenameFromPath(element.source) === getFilenameFromPath(tilesetFilepath)
    ).firstgid;

    const partialMatchMap = tilesetMatcher.matchTilelayer(
      oldTilesetSorted.background,
      tilesetJson,
      "back",
      firstgid
    );

    matchMap = tilesetMatcher.mergeMatchMaps(matchMap,partialMatchMap);
  }
  
  return matchMap;
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

async function extractOldTiles(log = false) {
  const tileMap = await extractOldTileset(true);

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
            map = mapPixelsToJson(pixels, tileMap);
            const tilesets = calcnewTilesets();
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

//TODO: PNG conversion here
function mapPixelsToJson(pixelsArray, tileMap) {
  console.log("  -obtained image shape: ", pixelsArray.shape.slice()); //shape = width, height, channels
  //pixelsArray.data is a Uint8Array of (shape.width * shape.height * #channels) elements
  const map = {
    width: pixelsArray.shape[0],
    height: pixelsArray.shape[1],
  };

  console.log(map);
  return map;
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
            map = mapPixelsToJson(pixels, tileMap);
            const tilesets = calcNewTilesetShapes();
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
    zlib.deflate(buffer, (error, result) => {
      const recompressed = Buffer.from(result).toString("base64");
      console.log(recompressed);
      console.log(
        `initial and recompressed chunks match? ${chunk === recompressed}`
      );
    });
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
    const flagsMask =
      FLAG_HORIZ_FLIP | FLAG_VERT_FLIP | FLAG_DIAG_FLIP | FLAG_HEX_120_ROTATE; //Sum all flags using bitwise OR to get a mask. When applied to a UInt32 it should reset all bits but flags to 0
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

function invokeAction({ action }) {
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
      zlibTest();
      break;
    case "extractoldtileset":
      extractOldTileset(true);
      break;
    case "calctilesetshapes":
      calcNewTilesetShapes(true);
      break;
    case "sortoldtileset_test":
      sortOldTileset(true);
      break;
    case "matchtileset_test":
      matchTileset_test(true);
      break;
    case "convpng":
      convertPixelToData();
      break;
    default:
      console.warn("\x1B[31m Unknown action type!");
  }
}

invokeAction(argv);
