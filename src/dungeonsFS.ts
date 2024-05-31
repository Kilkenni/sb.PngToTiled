import {Dirent, promises as nodeFS} from "fs";
import nodePath from "path";

import { Tile, resolveTilesets, TilesetJson } from "./tilesetMatch";
import { SbDungeonChunk } from "./dungeonChunkAssembler";
// import { TILESETJSON_NAME } from "./tilesetMatch.js";

const ioDirPath: string = nodePath.resolve("./input-output/");

type RuleNoCombine = [
  "doNotCombineWith",
  string[], //names of parts
];
type RuleNoConnect = [
  "doNotConnectToPart",
  string[], //names of parts
];
type RuleMaxSpawn = [
  "maxSpawnCount",
  [number]
];
type RuleIgnoreMax = ["ignorePartMaximumRule"];

interface DungeonPart {
  name: string, //unique across the same dungeon
  rules?: (RuleNoCombine|RuleNoConnect|RuleMaxSpawn|RuleIgnoreMax)[],
  def: ["image", string[]]|["tmx", string],
  chance?: number, //cannot be negative
};

interface DungeonFile extends Record<string, any> {
  metadata: {
    name: string,
    species: string,
    rules: any[],
    anchor: string[], //names of parts serving as anchors
    gravity: number,
    maxRadius: number,
    maxParts: number,
    extendSurfaceFreeSpace?: number,
    protected?: boolean,
  },
  tiles?: Tile[],
  parts: DungeonPart[],
};

interface DungeonPartTodo {
  extension: "png"|"json",
  mainPartName: string,
  addPartNames: string[]|undefined,
  targetName: string,
  finished: boolean,
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

async function readDir():Promise<Dirent[]> {
  const ioDir = await nodeFS.readdir(ioDirPath, { withFileTypes: true });

  return ioDir;
}

async function getDungeons(ioFiles: Dirent[], log = false):Promise<DungeonFile> {
  // console.table(ioDir);
  let dungeonPath:string = "";

  for (const file of ioFiles) {
    if (file.isFile())
      if (getExtension(file.name) === "dungeon") {
        dungeonPath = ioDirPath + "/" + file.name;
        break; //break on first dungeon found!
      }
  }

  if(dungeonPath === "") {
    throw new Error(`Unable to find .dungeon file`);
  }

  /*
  throw new Error(`${dungeonPath} does not contain <tiles> map. New SB .dungeon files cannot be used.`)
  */

  const dungeonsRaw = await nodeFS.readFile(dungeonPath, {
    encoding: "utf-8",
  });
  const dungeons:DungeonFile = JSON.parse(
    dungeonsRaw.replace(
      /\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g,
      (m, g) => (g ? "" : m)
    )
  ); //magic RegEx string to remove comments from JSON
  console.log(
    `Found .dungeon file: ${dungeons.metadata.name || "some weird shit"}`
  );
  return dungeons;
}


async function extractOldTileset(ioFiles: Dirent[], log = false):Promise<Tile[]> {
  const dungeons = await getDungeons(ioFiles);
 
  const tileMap = dungeons.tiles;
  if(tileMap === undefined) {
    throw new Error(`Dungeon file does not contain <tiles> map. New SB .dungeon files cannot be used.`)
  }
  
  if (log) {
    writeTileMap(`${ioDirPath + "OLDTILESET.TILES"}`, tileMap); //debug file
    console.log(`Old tileset extracted and saved as OLDTILESET.TILES to I/O dir`);
  }
  return tileMap;
}

async function parseChunkConnections(ioFiles: Dirent[], dungeonFile: DungeonFile):Promise<DungeonPartTodo[]> {
  const dungeonTodo:DungeonPartTodo[] = dungeonFile.parts.map((part) => {
    const todo:DungeonPartTodo = {
      extension: part.def[0].toLowerCase() === "tmx"? "json" : "png",
      mainPartName: typeof part.def[1]==="string"? part.def[1]: part.def[1][0],
      targetName: typeof part.def[1]==="string"? part.def[1] : getFilename(part.def[1][0])+".json",
      addPartNames: typeof part.def[1]==="string"? undefined : part.def[1].filter((_, partIndex) => {
        partIndex !== 0;
      }),
      finished: part.def[0].toLowerCase() === "tmx"? true : false,
    };

    return todo;
  })
  
    return dungeonTodo;
}

async function verifyChunkConnections() {
  const ioDir = await readDir();
  if (ioDir === undefined) {
    throw new Error(`Can't get access to ${ioDirPath}`);
  }


  //TODO
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
    await nodeFS.writeFile(
      newPath,
      JSON.stringify(DungeonChunk, null, 2),
      "utf-8"
    );
    // console.log(`Writing ${file.name}.new done.`);
    return true;
  }
}

//For debug and logging only. Required map is always stored in memory.
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
  ioDirPath,
  getFilename,
  getExtension,
  readDir,
  getDungeons,
  extractOldTileset,
  //parseChunkConnections,
  verifyChunkConnections,
  writeConvertedDungeons,
  writeConvertedMapJson,
  writeTileMap,
  getTilesetPath,
  getTileset,
  getTilesetNameFromPath,
};
  
export type {
  DungeonFile,
  DungeonPart,
};
