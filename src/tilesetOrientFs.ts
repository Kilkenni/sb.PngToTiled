import {Dir, Dirent, PathLike, promises as nodeFS} from "fs";
import nodePath from "path";
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { resolveTilesets, TilesetJson, TilesetObjectJson, ObjectJson } from "./tilesetMatch";
import * as tilesetMatcher from "./tilesetMatch";
import * as dungeonsFS from "./dungeonsFS";
// import { TILESETJSON_NAME } from "./tilesetMatch.js";

const ioDirPath: string = nodePath.resolve("./input-output/");
const enhancedTilesetsPath = ioDirPath + "/tilesetsEnh/packed/";

interface UpgradedObjectJson extends ObjectJson {
  "//obj-anchors"?:["left"|"right"|"bottom"|"top"]|["left"|"right","bottom"|"top"];
  "//obj-anchorLayer"?: "front"|"back";
  "//obj-offset": [number, number];
  "//obj-spriteDirection": "left"|"right";
  "//obj-verified": boolean;
}

interface TilesetUpgradedObjectJson extends TilesetObjectJson {
  tileproperties: {
    [key: string]: UpgradedObjectJson|ObjectJson,
  },
}

interface ObjectFile {
  objectName?: string; //unique
}

interface ObjectOrientation {
  flipImages?: boolean, //undefined === false
  imagePosition: [number, number], //OffsetX, OffsetY
  spaces: [number, number][],
  anchors?: ["left"|"right"|"bottom"|"top"|"background"], //can have this or fgAnchors, not both
  fgAnchors?: [[number, number], [number, number]]|[[number, number]],
  direction: "left"|"right",
}

interface ObjectFileOriented extends ObjectFile {
  orientations: ObjectOrientation[],
}

/**
 * returns unique values from array. Ignores undefined values.
 * @param value Must be primitive type
 * @param index 
 * @param array Must be attay of primitive types
 * @returns 
 */
 function getUniqueFromArray(value:any, index:number, array:any[]) {
  return (array.indexOf(value) === index && value !== undefined);
}

/**
 * returns duplicate values from array. Ignores undefined values.
 * @param value 
 * @param index 
 * @param array 
 * @returns 
 */
function getDuplicatesFromArray(value:any, index:number, array:any[]) {
  return (array.indexOf(value) !== index && value!== undefined);
}

async function resolveObjectsPath():Promise<PathLike> {
  let assetsPath:PathLike = "";
  let assetsResolved = false;
  const rl = readline.createInterface({ input, output });

  while(assetsResolved === false) {
    //assetsPath = await rl.question(`Please enter full path to OBJECTS in the unpacked Starbound assets folder: `);
    //temp
    assetsPath = `../SB_assets_133/packed/objects`;
    //do smth
    const pathToTest = nodePath.resolve(assetsPath);
    const testAssetPath = "/wreck/wreckbed";
    const testAssetName = "wreckbed.object";
    try {
      const wreckbedDir:Dirent[] = await nodeFS.readdir(`${pathToTest}${testAssetPath}`, { withFileTypes: true });
      //console.table(wreckbedDir); //debug line
      if(wreckbedDir.find((file) => file.name === testAssetName) === undefined) {
        console.error(`Cannot resolve test asset at path ${pathToTest}. Broken assets? [Ctrl+C] to exit.`);
        throw new Error();
      }
      assetsResolved = true;
    }
    catch(error) {
      //console.error(error);
      console.error(`Cannot resolve path ${pathToTest}. Wrong path? Try again or [Ctrl+C] to exit.`);
      throw(error);
    }
  }
  rl.close();

  return assetsPath;
}

async function getObjectByName(objectDirPath:PathLike, name:string, recursionDepth: number):Promise<ObjectFile|undefined> {
  if(recursionDepth > 5 ) {
    throw new Error(`Max recursion depth = 5 exceeded!`);
  }
  const dir:Dirent[] = await nodeFS.readdir(objectDirPath, { withFileTypes: true });
  for (const dirent of dir) {
    if(dirent.isFile() === true && dungeonsFS.getExtension(dirent.name) === "object") {
      const objectRaw = await nodeFS.readFile(`${dirent.path}/${dirent.name}`, {
        encoding: "utf-8",
      });
      try {
        const objectFile = JSON.parse(
          objectRaw.replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g,(m, g) => (g ? "" : m))
        ) as ObjectFile;
  
        if(objectFile.objectName === name) {
          return objectFile;
        }
      }
      catch(error) {
        //console.error(`  !File ${dirent.name} is unreadable, skipping`);
      }
    }
    else if(dirent.isDirectory() === true) {
      const obj = await getObjectByName(`${dirent.path}/${dirent.name}`, name, recursionDepth+1)
      if(obj === undefined) {
        continue;
      }
      else {
        return obj;
      }
    }
    continue;
  }

  return undefined;
}

interface TilesetTodos {
  [key:string]: {
    tileNamesToVerify: string[],
    tileset: TilesetUpgradedObjectJson,
    tilesToVerify: number[],
    tilesRemaining: number[],
  },
};

async function getTodoTilesets():Promise<TilesetTodos> {
  const allObjTilesets: string[] = [
    ...tilesetMatcher.TILESETOBJ_NAME.byCategory,
    ...tilesetMatcher.TILESETOBJ_NAME.byColonyTag,
    ...tilesetMatcher.TILESETOBJ_NAME.byRace,
    ...tilesetMatcher.TILESETOBJ_NAME.byType,
    tilesetMatcher.TILESETOBJ_NAME.objHuge
  ];

  //Here will be tilesets that we need to improve
  const tilesetJsons:TilesetTodos = {};

  for(const tilesetName of allObjTilesets) {
    const vanillaTileset:TilesetUpgradedObjectJson = await dungeonsFS.getTileset(tilesetName) as TilesetUpgradedObjectJson;
    //try to eliminate tiles with duplicating 
    const tileNames:string[] = Object.values(vanillaTileset.tileproperties).map((tile) => {
      return tile.object;
    });
    //we get duplicates, then de-duplicate duplicates to get array of diplicates, each occuring only once
    const duplicateTileNames:string[] = tileNames.filter(getDuplicatesFromArray).filter(getUniqueFromArray);
    if(duplicateTileNames.length === 0) {
      //all object names in tileset occur only once, there are no oriented objects => tileset does not need modifying
      continue;
    }

    const tilesIndexes:number[] = Object.keys(vanillaTileset.tileproperties).map((key) => parseInt(key));
    const indexesToVerify:number[] = tilesIndexes.filter((index) => duplicateTileNames.includes(vanillaTileset.tileproperties[index.toString()].object)).sort((a,b) => {
      return a-b;
    });
    
    tilesetJsons[tilesetName] = {
        tileNamesToVerify: duplicateTileNames,
        tileset: vanillaTileset,
        tilesToVerify: [...indexesToVerify],
        tilesRemaining: [...indexesToVerify],
      };
  }
  return tilesetJsons;
}

export {
  resolveObjectsPath,
  getTodoTilesets,
  getObjectByName,
}

export type {
  UpgradedObjectJson,
  ObjectFile,
  ObjectOrientation,
  ObjectFileOriented,
  TilesetTodos,
}