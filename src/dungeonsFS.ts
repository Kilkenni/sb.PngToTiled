import {Dirent, promises as nodeFS} from "fs";
import nodePath from "path";

import { Tile, resolveTilesets, TilesetJson } from "./tilesetMatch";
import { SbDungeonChunk } from "./dungeonChunkAssembler";
// import { TILESETJSON_NAME } from "./tilesetMatch.js";

const ioDirPath: string = nodePath.resolve("./input-output/");

interface DungeonPart {
  name: string,
  rules?: any[],
  def: any[],
}

interface DungeonFile extends Record<string, any> {
  metadata: {
    name: string,
    species?: string,
    rules: any[],
    anchor: string[],
    gravity: number,
    maxRadius: number,
    maxParts: number,
    extendSurfaceFreeSpace?: number,
    protected?: boolean,
  },
  tiles?: Tile[],
  parts?: DungeonPart[],
}

/**
 * utility
 * @param fileName 
 * @returns extension without the (.)
 */
function getExtension(fileName:string) {
  return fileName.substring(fileName.lastIndexOf(".") + 1);
}

/**
 * utility
 * @param fileName 
 * @returns name without extension
 */
function getFilename(fileName:string) {
return fileName.substring(0, fileName.lastIndexOf("."));
}

async function readDir():Promise<Dirent[]|undefined> {
  try {
    const ioDir = await nodeFS.readdir(ioDirPath, { withFileTypes: true });
    return ioDir;
  } catch (err) {
    console.error(err);
    return undefined;
  }
}

async function getDungeons(dungeonPath:string):Promise<DungeonFile|undefined> {
  try {
    const dungeonsRaw = await nodeFS.readFile(dungeonPath, {
      encoding: "utf-8",
    });
    const dungeons:DungeonFile = JSON.parse(
      dungeonsRaw.replace(
        /\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g,
        (m, g) => (g ? "" : m)
      )
    ); //magic RegEx string to remove comments from JSON
    return dungeons;
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

// async function cacheTilesets(tilesetPaths: string[]) {
  //TODO
// }

async function writeConvertedDungeons(JsonData: Object): Promise<true|undefined> {
  const ioDir = await readDir();
  let newDungeonPath;
  if (ioDir) {
    for (const file of ioDir) {
      if (file.isFile()) {
        newDungeonPath = undefined;
      }
      try {
        if (getExtension(file.name) === "dungeon") {
          //for every .dungeon file in I/O dir
          newDungeonPath = ioDirPath + "/" + file.name + ".new";
        }
        if (newDungeonPath) {
          try {
            console.log(`Checking if ${newDungeonPath} is available...`);
            const accessed = await nodeFS.access(
              newDungeonPath,
              nodeFS.constants.F_OK
            );
            console.error(
              `Output file <${
                file.name + ".new"
              }> already exists. Rewriting prohibited. Remove it before running again.`
            );
            return undefined;
          } catch (error) {
            //this error appears if no .new file is found, i.e. if we can safely write
            // console.log(error.message);
            await nodeFS.writeFile(
              newDungeonPath,
              JSON.stringify(JsonData, null, 2),
              "utf-8"
            );
            // console.log(`Writing ${file.name}.new done.`);
            return true;
          }
        }
      } catch (error) {
        console.error(error);
        return undefined;
      }
    }
  }
  return undefined;
}

async function writeConvertedMapJson(newPath:string, DungeonChunk: SbDungeonChunk) {
  // const ioDir = await readDir();
  try {
    console.log(`Checking if ${newPath} is available...`);
    const accessed = await nodeFS.access(
      newPath,
      nodeFS.constants.F_OK
    );
    console.error(
      `Output file <${newPath}> already exists. Rewriting prohibited. Remove it before running again.`
    );
    return undefined;
  } catch (error) {
    //this error appears if no converted file is found, i.e. if we can safely write
    // console.log(error.message);
    await nodeFS.writeFile(
      newPath,
      JSON.stringify(DungeonChunk, null, 2),
      "utf-8"
    );
    // console.log(`Writing ${file.name}.new done.`);
    return true;
  }
}

async function writeTileMap(path: string, JsonData: Object) {
  await nodeFS.writeFile(path, JSON.stringify(JsonData, null, 2), "utf-8");
  return true;
}

function getTilesetPath(tilesetName: string):string {
  return`${resolveTilesets()}/${tilesetName}.json`;
}

/**
 * Takes Sb-format tileset name (string) and returns tileset as parsed JSON, comments trimmed
 * @param tilesetName 
 * @returns 
 */
async function getTileset(tilesetName: string, path?: string):Promise<TilesetJson|undefined> {
  const tilesetPath = path!==undefined ? path:`${resolveTilesets()}/${tilesetName}.json`;
  try {
    if (!tilesetPath || typeof tilesetPath != "string") {
      return undefined; //basic path validation check
    }
    const tilesetRaw = await nodeFS.readFile(tilesetPath, {
      encoding: "utf-8",
    });
    const tileset: TilesetJson = JSON.parse(
      tilesetRaw.replace(
        /\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g,
        (m, g) => (g ? "" : m)
      )
    ); //magic RegEx string to remove comments from JSON
    return tileset;
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

async function getTilesetNameFromPath(path: string):Promise<string> {
  const tileset = await getTileset("", path);
  if (tileset === undefined) { //no tileset found
    throw new Error(`Cannot resolve tileset ${path}`);
  }
  return tileset.name
}

export {
  readDir,
  getDungeons,
  getFilename,
  getExtension,
  writeConvertedDungeons,
  writeConvertedMapJson,
  writeTileMap,
  getTilesetPath,
  getTileset,
  getTilesetNameFromPath,
  ioDirPath,
};
  
export type {
  DungeonFile,
  DungeonPart,
};
