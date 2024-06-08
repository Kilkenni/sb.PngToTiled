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
      console.table(wreckbedDir);
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

interface TilesetJsons {
  [key:string]: {
    tileNamesToVerify: string[],
    tileset: TilesetObjectJson,
    tilesToVerify: number[],
  },
};

async function getTodoTilesets():Promise<TilesetJsons> {
  const allObjTilesets: string[] = [
    ...tilesetMatcher.TILESETOBJ_NAME.byCategory,
    ...tilesetMatcher.TILESETOBJ_NAME.byColonyTag,
    ...tilesetMatcher.TILESETOBJ_NAME.byRace,
    ...tilesetMatcher.TILESETOBJ_NAME.byType,
    tilesetMatcher.TILESETOBJ_NAME.objHuge
  ];

  //Here will be tilesets that we need to improve
  const tilesetJsons:TilesetJsons = {};

  for(const tilesetName of allObjTilesets) {
    const vanillaTileset:TilesetObjectJson = await dungeonsFS.getTileset(tilesetName) as TilesetObjectJson;
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
    
    tilesetJsons[tilesetName] = {
        tileNamesToVerify: duplicateTileNames,
        tileset: vanillaTileset,
        tilesToVerify: tilesIndexes.filter((index) => duplicateTileNames.includes(vanillaTileset.tileproperties[index.toString()].object)),
      };
  }
  return tilesetJsons;
}

export {
  resolveObjectsPath,
  getTodoTilesets,
}