//A one-time script chunk to enhance object tilesets with GAY, in true spirit of June

import {Dirent, promises as nodeFS} from "fs";
import nodePath from "path";
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { resolveTilesets, TilesetJson, TilesetObjectJson, ObjectJson } from "./tilesetMatch";
import * as tilesetMatcher from "./tilesetMatch";
import * as dungeonsFS from "./dungeonsFS";
// import { TILESETJSON_NAME } from "./tilesetMatch.js";

const ioDirPath: string = nodePath.resolve("./input-output/");
const enhancedTilesetsPath = ioDirPath + "/tilesetsEnh/packed/";

const allObjTilesets: string[] = [
    ...tilesetMatcher.TILESETOBJ_NAME.byCategory,
    ...tilesetMatcher.TILESETOBJ_NAME.byColonyTag,
    ...tilesetMatcher.TILESETOBJ_NAME.byRace,
    ...tilesetMatcher.TILESETOBJ_NAME.byType,
    tilesetMatcher.TILESETOBJ_NAME.objHuge
  ];

let assetsPath = "";
let assetsResolved = false;

interface ObjectFile {
  objectName: string; //unique
  orientations?: {
    flipImages?: boolean,
    imagePosition: [number, number],
    spaces: [number, number][],
    anchors?: ["left"|"right"|"bottom"|"top"|"background"], //can have this or fgAnchors, not both
    fgAnchors?: [[number, number], [number, number]]|[[number, number]],
    direction: "left"|"right",
  }[],
}

interface UpgradedObjectJson extends ObjectJson {
  "//anchors":["left"|"right"|"bottom"|"top"]|["left"|"right","bottom"|"top"];
  "//anchorLayer": "front"|"back";
  "imageOffset": [number, number];
  "//spriteDirection": "left"|"right";
}

interface TilesetUpgradedObjectJson extends TilesetObjectJson {
  tileproperties: {
    [key: string]: UpgradedObjectJson|ObjectJson,
  },
}

const rl = readline.createInterface({ input, output });

while(assetsResolved === false) {
  assetsPath = await rl.question(`Please enter full path to OBJECTS in the unpacked Starbound assets folder: `);
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
  }
}
rl.close();
//assetsPath now has correct path to OBJECT files

const vanillaTileset:TilesetObjectJson = await dungeonsFS.getTileset(allObjTilesets[0]) as TilesetObjectJson;

const upgradedTileset:TilesetUpgradedObjectJson = {...vanillaTileset};

for(const tile in upgradedTileset.tileproperties) {
  //TODO
  //get tile name
  //find tile file
  //match tile variation
  //write extended info into ObjectJson
}

//write upgradedTileset at enhancedTilesetsPath
