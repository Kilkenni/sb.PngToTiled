import {Dirent, promises as nodeFS} from "fs";
import nodePath from "path";
import { promisify } from "util";
import { NdArray } from "ndarray";
import getPixels from "get-pixels";

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

interface DungeonJson extends Record<string, any> {
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
  return fileName.toLowerCase().substring(fileName.lastIndexOf(".") + 1);
}

/**
 * utility
 * @param fileName 
 * @returns name without extension
 */
function getFilename(fileName:string) {
return fileName.toLowerCase().substring(0, fileName.lastIndexOf("."));
}

/**
 * 
 * @returns contents of I/O folder, only .png and .dungeon files
 */
async function readDir():Promise<Dirent[]> {
  const ioDir = await nodeFS.readdir(ioDirPath, { withFileTypes: true });
  const ioFiles = ioDir.filter((fileEntry) => {
    return (fileEntry.isFile() && (getExtension(fileEntry.name) === "dungeon" || getExtension(fileEntry.name) == "png"));
  });
  return ioFiles;
}

async function getPixelsFromPngFile(name: string):Promise<NdArray<Uint8Array>> {
  if (getExtension(name) !== "png") {
    throw new Error(`${name} is not a PNG file`);
  }
  const path = ioDirPath + "/" + name;
  const getPixelsPromise = promisify(getPixels); //getPixels originally doesn't support promises
  const pixels: NdArray<Uint8Array> = await getPixelsPromise(path, "image/png");
  //arg2 is MIMEtype, only for Buffers (we can skip it here)
  return pixels;
}

async function getDungeons(ioFiles: Dirent[], log = false):Promise<DungeonJson> {
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
  const dungeons:DungeonJson = JSON.parse(
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

/**
 * Returns .dungeon file parsed as JSON, trims comments
 * @param file Dirent containing .dungeon file info
 * @param log 
 * @returns 
 */
async function getDungeon(ioFiles:Dirent[], log = false): Promise<DungeonJson> {
  let dungeonsAmount: number = 0;
  let dungeonEntry: Dirent|undefined = undefined;
  for (const fileEntry of ioFiles) {
    if (getExtension(fileEntry.name) === "dungeon") {
      dungeonsAmount = dungeonsAmount + 1;
      dungeonEntry = fileEntry;
    }
  }
  if (dungeonsAmount !== 1 || dungeonEntry === undefined) {
    throw new Error(`Input folder must contain exactly one .dungeon file but found ${dungeonsAmount}`);
  };
  const dungeonPath:string =  ioDirPath + "/" + dungeonEntry.name;

  const dungeonsRaw = await nodeFS.readFile(dungeonPath, {
    encoding: "utf-8",
  });
  const dungeons:DungeonJson = JSON.parse(
    dungeonsRaw.replace(
      /\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g,
      (m, g) => (g ? "" : m)
    )
  ); //magic RegEx string to remove comments from JSON
  return dungeons;
}


async function extractOldTileset(ioFiles: Dirent[], log = false): Promise<Tile[]> {
  const dungeonEntry = ioFiles.find((fileEntry) => {
    return (fileEntry.isFile() && getExtension(fileEntry.name) === "dungeon");
  })
  if (dungeonEntry === undefined) {
    throw new Error(`Cannot find .dungeon file`);
  }
  const dungeons = await getDungeon(ioFiles);
 
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

function parseChunkConnections(/*ioFiles: Dirent[],*/ dungeonFile: DungeonJson):DungeonPartTodo[] {
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

function verifyChunkConnections(ioFiles: Dirent[], dungeonFile:DungeonJson, strict = false, log = false):DungeonPartTodo[] {
  // const ioDir = await readDir();
  // if (ioDir === undefined) {
  //   throw new Error(`Can't get access to ${ioDirPath}`);
  // }

  // const ioFiles:Dirent[] = ioDir.filter((fileEntry) => {
  //   return (fileEntry.isFile() && (getExtension(fileEntry.name) === ".dungeon" || getExtension(fileEntry.name) == ".png"));
  // });

  // let dungeonsAmount: number = 0;
  // let dungeonEntry: Dirent|undefined = undefined;
  // for (const fileEntry of ioFiles) {
  //   if (getExtension(fileEntry.name) === ".dungeon") {
  //     dungeonsAmount = dungeonsAmount + 1;
  //     dungeonEntry = fileEntry;
  //   }
  // }
  // if (dungeonsAmount !== 1 || dungeonEntry === undefined) {
  //   throw new Error(`Input folder must contain exactly one .dungeon file but found ${dungeonsAmount}`);
  // };
  // const dungeonFile: DungeonFile = await getDungeon(dungeonEntry);

  //validate dungeon file
  const dungeonTodos: DungeonPartTodo[] = parseChunkConnections(dungeonFile);
  if (dungeonTodos.some((todo) => { return todo.extension === "png"; }) === false) {
    throw new Error(`${dungeonFile.name}.dungeon does not contain any "image" parts. Nothing to convert. Wrong .dungeon file?`)
  }
  if (dungeonFile.tiles === undefined) {
    throw new Error(`${dungeonFile.name}.dungeon is missing tileset for "image" parts. Broken .dungeon file?`);
  }

  //resolve chunks
  for (const todo of dungeonTodos.filter((todo) => todo.extension === "png")) {
    const todoIndex = dungeonTodos.findIndex((curTodo) => curTodo.mainPartName === todo.mainPartName);
    if (ioFiles.find((fileEntry) => todo.mainPartName === fileEntry.name) === undefined) {
      if (strict) {
        throw new Error(`${dungeonFile.name}.dungeon lists ${todo.mainPartName} but it cannot be resolved in I/O folder.`);
      }
      else {
        console.log(`${dungeonFile.name}.dungeon lists ${todo.mainPartName} but it cannot be resolved in I/O folder. It will be skipped`);
        dungeonTodos[todoIndex].finished === true;
        continue;
      }
    }
    if (todo.addPartNames !== undefined) {
      for (const chunkPart of todo.addPartNames) {
        if (ioFiles.find((fileEntry) => chunkPart === fileEntry.name) === undefined) {
          if (strict) {
            throw new Error(`${dungeonFile.name} lists ${todo.mainPartName} but its dependency ${chunkPart} cannot be resolved in I/O folder.`);
          }
          else {
            console.log(`${dungeonFile.name}.dungeon lists ${todo.mainPartName} but its dependency ${chunkPart} cannot be resolved in I/O folder. Conversion will be incomplete!`);
            dungeonTodos[todoIndex].addPartNames = todo.addPartNames.filter((chunk) => chunk !== chunkPart); //ignore part
            if (dungeonTodos[todoIndex].addPartNames?.length === 0) {
              dungeonTodos[todoIndex].addPartNames = undefined; //if no parts remain, wipe array
            }
            continue;
          }
        }
      }
    }
  }
  return dungeonTodos;
}

// async function cacheTilesets(tilesetPaths: string[]) {
  //TODO
// }

async function writeConvertedDungeons(dungeonJson: DungeonJson): Promise<true|undefined> {
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
              JSON.stringify(dungeonJson, null, 2),
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

async function getDungeonTodos(strict = false, log = false): Promise<{ dungeonFile: DungeonJson; todos: DungeonPartTodo[]; }> {
  const filesTodo:Dirent[] = await readDir();
  const dungeonFile: DungeonJson = await getDungeon(filesTodo);
  const todos: DungeonPartTodo[] = verifyChunkConnections(filesTodo, dungeonFile, strict, log);
  
  return {
    dungeonFile,
    todos,
  };
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
  DungeonJson,
  DungeonPart,
};
