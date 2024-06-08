//A one-time script chunk to enhance object tilesets with GAY, in true spirit of June

import {Dir, Dirent, PathLike, promises as nodeFS} from "fs";
import nodePath from "path";
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';


import { resolveTilesets, TilesetJson, TilesetObjectJson, ObjectJson } from "./tilesetMatch";
import * as tilesetMatcher from "./tilesetMatch";
import * as dungeonsFS from "./dungeonsFS";
import {resolveObjectsPath, getTodoTilesets} from "./tilesetOrientFs";
// import { TILESETJSON_NAME } from "./tilesetMatch.js";

interface ObjectFile {
  objectName?: string; //unique
  orientations?: {
    flipImages?: boolean, //undefined === false
    imagePosition: [number, number], //OffsetX, OffsetY
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
  "//verified": boolean;
}

interface TilesetUpgradedObjectJson extends TilesetObjectJson {
  tileproperties: {
    [key: string]: UpgradedObjectJson|ObjectJson,
  },
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
        throw new Error(`can't read file ${dirent.name}`)
      }
    }
    else if(dirent.isDirectory() === true) {
      const obj = await getObjectByName(`${dirent.path}/${dirent.name}`, name, recursionDepth+1)
      if(obj === undefined) {
        continue;
      }
    }
    continue;
  }

  return undefined;
  /*if(recursionDepth === 0) {
    throw new Error(`Object ${name} cannot be found in OBJECTS folder`);
  }*/
}

let assetsPath:PathLike = await resolveObjectsPath(); //assetsPath has correct path to OBJECT files

//Here will be tilesets that we need to improve
const tilesetJsons = await getTodoTilesets();

  const currentTileset = "huge-objects";

  const tileIndex = tilesetJsons[currentTileset].tilesToVerify[0];
  const tile = tilesetJsons[currentTileset].tileset.tileproperties[tileIndex];
  const objectName = tile.object;

  const objFile:ObjectFile = await getObjectByName(assetsPath, tile.object, 0);
  console.log("found?");


  //TODO
  //get tile name
  //find tile file
  //match tile variation
  //write extended info into ObjectJson


//write upgradedTileset at enhancedTilesetsPath
