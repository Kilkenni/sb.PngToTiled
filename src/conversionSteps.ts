import nodePath from "path";
import { NdArray } from "ndarray";
import { Dirent } from "fs";

import * as dungeonsFS from "./dungeonsFS";
import { DungeonPartTodo, DungeonJson } from "./dungeonsFS";
import * as tilesetMatcher from "./tilesetMatch";
import {Tile, ObjectTile, ObjectTileMatchType, TilesetObjectJson, TilesetMiscJson, OldTilesetSorted } from "./tilesetMatch";
import { SbDungeonChunk } from "./dungeonChunkAssembler";

type FullObjectMap = {
  matchMap: (ObjectTileMatchType | undefined)[],
  undefinedTiles: number,
  tilesets: string[],
}

/**
 * Builds matchMap of objects
 * @param arrayOfObjects from sorted old tileset
 * @returns matchMap, number of undefined tiles, list of names of used tilesets
 */
async function matchAllObjects(arrayOfObjects: ObjectTile[]): Promise<FullObjectMap> {
  function calcUndefined(matchArray: (ObjectTileMatchType | undefined)[]): number {
    let numOfUndefined = 0;
    for (const match of matchArray) {
      if (match === undefined) {
        numOfUndefined++;
      }
    }
    return numOfUndefined;
  }
  
  const tilesets: string[] = [];
  let matchMap = Array<ObjectTileMatchType | undefined>(arrayOfObjects.length);
  const allObjTilesets: string[] = [tilesetMatcher.TILESETOBJ_NAME.objHuge,
    ...tilesetMatcher.TILESETOBJ_NAME.byCategory,
    ...tilesetMatcher.TILESETOBJ_NAME.byColonyTag,
    ...tilesetMatcher.TILESETOBJ_NAME.byRace,
    ...tilesetMatcher.TILESETOBJ_NAME.byType
  ];
  const miscTilesetJSON = await dungeonsFS.getTileset(tilesetMatcher.TILESETMAT_NAME.misc) as TilesetMiscJson;
  matchMap = tilesetMatcher.matchObjectsBiome(arrayOfObjects, miscTilesetJSON, matchMap);
  let undefinedTiles: number = calcUndefined(matchMap);
  for (const objTileset of allObjTilesets) {
    const tilesetJson: TilesetObjectJson = await dungeonsFS.getTileset(objTileset) as TilesetObjectJson;
    matchMap = tilesetMatcher.matchObjects(arrayOfObjects, tilesetJson, matchMap);
    if (undefinedTiles > calcUndefined(matchMap)) {
      tilesets.push(objTileset); //If we found any matches - remember this tileset
      undefinedTiles = calcUndefined(matchMap); //and recalculate how much we have left to do
    }; 
  }
  return {
    matchMap,
    undefinedTiles,
    tilesets,
  };
}

/**
 * 
 * @param tilePixels Pixels.data is a Uint8Array of (shape.width * shape.height * #channels) elements
 * @param objPixels Pixels.data is a Uint8Array of (shape.width * shape.height * #channels) elements
 * @param oldTileset old dungeon tileset, sorted by categories. Common for all dungeon chunks in a set.
 * @returns 
 */
async function generateDungeonChunk(tilePixels: NdArray<Uint8Array>, objPixels: NdArray<Uint8Array>[]|undefined, oldTileset: tilesetMatcher.OldTilesetSorted, log = false):Promise<SbDungeonChunk> {
  const newTilesetShapes = await tilesetMatcher.calcNewTilesetShapes();
  //convert absolute paths to relative
  for (const tilesetShape of newTilesetShapes) {
    tilesetShape.source = `.${tilesetShape.source.substring(
      tilesetShape.source.indexOf("input-output") + 12
    )}`; //replace everything up to and with "input-output" with .
  }

  const convertedChunk = new SbDungeonChunk(newTilesetShapes);
  
  const [chunkWidth, chunkHeight, chunkChannels] = tilePixels.shape;
  convertedChunk.setSize(chunkWidth, chunkHeight);
  const RgbaArray:tilesetMatcher.RgbaValueType[] = tilesetMatcher.slicePixelsToArray(tilePixels.data, chunkWidth, chunkHeight, chunkChannels);

  const fullMatchMap = await tilesetMatcher.matchAllTilelayers(oldTileset);
  const convertedBackLayer = tilesetMatcher.convertPngToGid(RgbaArray, fullMatchMap.back);
  const convertedFrontLayer = tilesetMatcher.convertPngToGid(RgbaArray, fullMatchMap.front);
  convertedChunk.addBothTilelayers(convertedFrontLayer, convertedBackLayer, chunkWidth, chunkHeight);

  const miscTileset = await dungeonsFS.getTileset(tilesetMatcher.TILESETMAT_NAME.misc) as tilesetMatcher.TilesetMiscJson;
  if (miscTileset === undefined) {
    throw new Error(`Cannot resolve tileset: ${tilesetMatcher.TILESETMAT_NAME.misc}`);
  }
  const anchorsMap:tilesetMatcher.LayerTileMatchType[] = tilesetMatcher.matchAnchors(
    oldTileset.anchors as tilesetMatcher.AnchorTile[],
    miscTileset,
    convertedChunk.getFirstGid(tilesetMatcher.TILESETMAT_NAME.misc)
  );
  convertedChunk.parseAnchors(RgbaArray, anchorsMap, log);

  //match object RGB to ID locally, calc required tilesets
  const objectsMap = await matchAllObjects(oldTileset.objects as tilesetMatcher.ObjectTile[]);
  //Add required tilesets to chunk
  await convertedChunk.addObjectTilesetShapes(objectsMap.tilesets, log); //for debug. parseAddObjects does that
  const objectsGidMap = convertedChunk.convertIdMapToGid(objectsMap); //for debug. parseAddObjects does that

  if (objPixels !== undefined) {
    const npcMap = tilesetMatcher.matchNPCS(oldTileset.npcs as tilesetMatcher.NpcTile[]);
    const modMap = tilesetMatcher.matchMods(oldTileset.foreground);
    convertedChunk.parseMods(RgbaArray, modMap, log); //add mods from main file, if any
    const stagehandMap = tilesetMatcher.matchStagehands(oldTileset.stagehands as tilesetMatcher.StagehandTile[]);

    //parse each file and merge with the first one
    for (const objLayer of objPixels) {
      //MERGE additional tilelayers from objects layer
      const objRgbaArray = tilesetMatcher.slicePixelsToArray(objLayer.data, chunkWidth, chunkHeight, chunkChannels);
      //we use the same MatchMap since it's still the same dungeon - tilesets didn't change
      //Disable converting and merging tiles from objects into background - we assume that objPNG contains NO background tiles
      //const convertedBackLayer = tilesetMatcher.convertPngToGid(objRgbaArray, fullMatchMap.back);
      const convertedFrontLayer = tilesetMatcher.convertPngToGid(objRgbaArray,fullMatchMap.front);
      convertedChunk.mergeTilelayers(convertedFrontLayer, /*convertedBackLayer, */log);

      convertedChunk.parseAnchors(objRgbaArray, anchorsMap, log); //let's try to find some anchors here as well
      //map PNG to objects using objectsGidMap
      await convertedChunk.parseObjects(
        oldTileset.objects as tilesetMatcher.ObjectTile[],
        objRgbaArray,
        objectsMap,
        log
      );

      //add NPCs
      convertedChunk.parseAddNpcs(objRgbaArray, npcMap, log);
      //add mods
      convertedChunk.parseMods(objRgbaArray, modMap, log);
      //add stagehands
      convertedChunk.parseStagehands(objRgbaArray, stagehandMap, log);
    }
  }
  return convertedChunk;
}

/**
 * Converts a single chunk with objects from PNG to JSON and writes it
 * @param chunkTodo file names of main PNG file and additional files
 * @param log 
 */
async function convertChunk(chunkTodo: DungeonPartTodo, oldTileset:OldTilesetSorted, log = false): Promise<boolean> {
  if (chunkTodo.extension === "json") {
    if (log) {
      console.log(`${chunkTodo.name} does not need conversion, skipping...`)
    }
    return true;
  }
  console.log(`${chunkTodo.name} is due for conversion`);

  const fullMatchMap = await tilesetMatcher.matchAllTilelayers(oldTileset); //for debug

  const pixelsArray: NdArray<Uint8Array> = await dungeonsFS.getPixelsFromPngFile(chunkTodo.mainPartName);
  //pixelsArray.data is a Uint8Array of (shape.width * shape.height * #channels) elements 

  let pixelsOptArrays: NdArray<Uint8Array>[]|undefined = undefined;
  if (chunkTodo.optPartNames !== undefined) {
    pixelsOptArrays = new Array<NdArray<Uint8Array>>(chunkTodo.optPartNames.length);
    for (let i = 0; i < chunkTodo.optPartNames.length; i++) {
      pixelsOptArrays[i] = await dungeonsFS.getPixelsFromPngFile(chunkTodo.optPartNames[i])
    }
  }
  
  const convertedChunk: SbDungeonChunk = await generateDungeonChunk(pixelsArray, pixelsOptArrays, oldTileset, log); //Assembling chunk

  const newChunkPath = `${dungeonsFS.ioDirPath}/${chunkTodo.targetName}`;
  const success = await dungeonsFS.writeConvertedMapJson(
    newChunkPath,
    convertedChunk
  );
  if (success) {
    console.log(` ${chunkTodo.targetName} saved >:3`);
  }
  return success;
}

/**
 * Bulk conversion routine. Does not change .dungeon file
 * @param strict if false, skips pngs in a .dungeon file that it cannot resolve. If true, throws errors instead.
 * @param log 
 */
async function convertAllChunks(strict = false, ignoreIncomplete = true, log = false):Promise<void> {
  const ioFiles:Dirent[] = await dungeonsFS.readDir();
  const dungeonFile:DungeonJson = await dungeonsFS.getDungeon(ioFiles, log);
  const chunkTodos:DungeonPartTodo[] = dungeonsFS.verifyChunkConnections(ioFiles, dungeonFile, strict, ignoreIncomplete, log);
  const oldTileset = await dungeonsFS.extractOldTileset(ioFiles, log);
  const sortedOldTileset = tilesetMatcher.getSortedTileset(oldTileset);
  for(const todo of chunkTodos) {
    if(todo.finished === false) {
     todo.finished = await convertChunk(todo, sortedOldTileset, log);
    }
  }
    
  //TODO check finished status
}

export {
  matchAllObjects,
  convertChunk,
  convertAllChunks,
};

export type {
  FullObjectMap,
};