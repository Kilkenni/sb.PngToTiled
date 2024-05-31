import nodePath from "path";
import { promisify } from "util";
import { NdArray } from "ndarray";
import getPixels from "get-pixels";
import { Dirent } from "fs";

import * as dungeonsFS from "./dungeonsFS";
import {DungeonFile } from "./dungeonsFS";
import * as tilesetMatcher from "./tilesetMatch";
import {Tile, ObjectTile, ObjectTileMatchType, TilesetObjectJson, TilesetMiscJson, OldTilesetSorted } from "./tilesetMatch";
import { SbDungeonChunk } from "./dungeonChunkAssembler";

async function extractOldTileset(log = false):Promise<Tile[]> {
  const ioDir = await dungeonsFS.readDir();
  // console.table(ioDir);
  let dungeonPath:string = "";
  if(ioDir) {
    for (const file of ioDir) {
      if (file.isFile())
        if (dungeonsFS.getExtension(file.name) === "dungeon") {
          dungeonPath = dungeonsFS.ioDirPath + "/" + file.name;
          break; //break on first dungeon found!
        }
    }
  }
  let dungeons:DungeonFile|undefined;

  dungeons = await dungeonsFS.getDungeons(dungeonPath);
  console.log(
    `Found .dungeon file: ${dungeons?.metadata?.name || "some weird shit"}`
  );
 
  let tileMap;
  if (dungeons?.tiles) {
    tileMap = dungeons.tiles;
  }
  else {
    throw new Error(`${dungeonPath} does not contain <tiles> map. New SB .dungeon files cannot be used.`)
  }

  if (log) {
    dungeonsFS.writeTileMap(`${dungeonsFS.getFilename(dungeonPath) + ".TILES"}`, tileMap); //debug file
    console.log(`${dungeonsFS.getFilename(dungeonPath) + ".TILES"} saved to I/O dir`);
  }
  return tileMap;
}

type FullObjectMap = {
  matchMap: (ObjectTileMatchType | undefined)[],
  undefinedTiles: number,
  tilesets: string[],
}

/**
 * 
 * @param arrayOfObjects Builds matchMap of objects
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
async function generateDungeonChunk(tilePixels: NdArray<Uint8Array>, objPixels: NdArray<Uint8Array>|undefined, oldTileset: tilesetMatcher.OldTilesetSorted, log = false):Promise<SbDungeonChunk> {
  const newTilesetShapes = await tilesetMatcher.calcNewTilesetShapes();
  //convert absolute paths to relative
  for (const tilesetShape of newTilesetShapes) {
    tilesetShape.source = `.${tilesetShape.source.substring(
      tilesetShape.source.indexOf("input-output") + 12
    )}`; //replace everything up to and with "input-output" with .
  }

  const convertedChunk = new SbDungeonChunk(
    newTilesetShapes
  );
  
  convertedChunk.setSize(tilePixels.shape[0], tilePixels.shape[1]);
  const RgbaArray = tilesetMatcher.slicePixelsToArray(
    tilePixels.data,
    tilePixels.shape[0], tilePixels.shape[1], tilePixels.shape[2]
  );

  const fullMatchMap = await tilesetMatcher.matchAllTilelayers(oldTileset);
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
    tilePixels.shape[0],
    tilePixels.shape[1]
  );

  const miscTileset = await dungeonsFS.getTileset(
    tilesetMatcher.TILESETMAT_NAME.misc
  );
  if (miscTileset === undefined) {
    throw new Error(`Cannot resolve tileset: ${tilesetMatcher.TILESETMAT_NAME.misc}`);
  }
  const anchorsMap = tilesetMatcher.matchAnchors(
    oldTileset.anchors as tilesetMatcher.AnchorTile[],
    miscTileset as tilesetMatcher.TilesetMiscJson,
    convertedChunk.getFirstGid(tilesetMatcher.TILESETMAT_NAME.misc)
  );
  for (let rgbaN = 0; rgbaN < RgbaArray.length; rgbaN++) {
    for (const match of anchorsMap) {
      if (match!== undefined && tilesetMatcher.isRgbaEqual(RgbaArray[rgbaN], match.tileRgba)) {
        const gid = match.tileGid;
        const { x: anchorX, y: anchorY } =
          convertedChunk.getCoordsFromFlatRgbaArray(
            rgbaN,
            tilePixels.shape[0]
          );
        convertedChunk.addAnchorToObjectLayer(gid, anchorX, anchorY);
      }
    }
  }

  //MERGE additional tilelayers from OBJECTS

  if (objPixels !== undefined) {
    //if we found name-objects.png file
    // convertedChunk.setSize(pixelsObjArray.shape[0], pixelsObjArray.shape[1]);
    const RgbaArray = tilesetMatcher.slicePixelsToArray(
      objPixels.data,
      tilePixels.shape[0],
      tilePixels.shape[1],
      tilePixels.shape[2]
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
  

  //match object RGB to ID locally, calc required tilesets
  const objectsMap = await matchAllObjects(oldTileset.objects as tilesetMatcher.ObjectTile[]);
  //Add required tilesets to chunk
  if (log) {
    console.log(`  - injecting object tilesets...`);
  }
  await convertedChunk.addObjectTilesetShapes(objectsMap.tilesets);
  // await convertedChunk.parseAddObjects();
  //convert objectsMap from using Ids to using Gids
  const objectsGidMap = convertedChunk.convertIdMapToGid(objectsMap);
  if (objPixels !== undefined) {
    const objRgbaArray = tilesetMatcher.slicePixelsToArray(
      objPixels.data,
      tilePixels.shape[0],
      tilePixels.shape[1],
      tilePixels.shape[2]
    );
    //map PNG to objects using objectsGidMap
    if (log) {
      console.log(`  - adding objects...`);
    }
    await convertedChunk.parseAddObjects(
      oldTileset.objects as tilesetMatcher.ObjectTile[],
      objRgbaArray,
      objectsMap
    );

    //NPCs
    const npcMap = tilesetMatcher.matchNPCS(oldTileset.npcs as tilesetMatcher.NpcTile[]);
    if (log) {
      console.log(`  - adding NPCs...`);
    }
    convertedChunk.parseAddNpcs(objRgbaArray, npcMap);
    //ground tile mods
    const modMap = tilesetMatcher.matchMods(oldTileset.foreground);
    //add mods to chunk
    if (log) {
      console.log(`  - adding modded terrain regions...`);
    }
    convertedChunk.parseMods(RgbaArray, modMap);
    convertedChunk.parseMods(objRgbaArray, modMap);

    const stagehandMap = tilesetMatcher.matchStagehands(
      oldTileset.stagehands as tilesetMatcher.StagehandTile[]
    );
    if (log) {
      console.log(`  - adding stagehands...`);
    }
    convertedChunk.parseStagehands(objRgbaArray, stagehandMap);
  }
  
  return convertedChunk;

}

async function convertChunk(chunk: Dirent, chunk_object?: Dirent, log = false): Promise<void> {
  if (chunk.isFile() === false || (chunk_object!== undefined && chunk_object.isFile() === false)) {
    throw new Error(`All layers of ${chunk} must be .png files`)
  }
  else {
    if (dungeonsFS.getExtension(chunk.name) === "png") {
      if (chunk.name.includes("objects")||chunk.name.includes("wires")) {
        throw new Error(`${chunk} must be a main .png for the chunk`); //do not convert objects layers as separate files
      }

      const newChunkPath = `${dungeonsFS.ioDirPath}/${dungeonsFS.getFilename(chunk.name)}.json`;
      console.log(
        `Detected ${chunk.name}, writing ${dungeonsFS.getFilename(chunk.name)}.json...`
      );

      const getPixelsPromise = promisify(getPixels); //getPixels originally doesn't support promises

      const oldTileset = await extractOldTileset(false);
      const sortedOldTileset = await tilesetMatcher.getSortedTileset(oldTileset);
      const fullMatchMap = await tilesetMatcher.matchAllTilelayers(sortedOldTileset);

      let pixelsArray:NdArray<Uint8Array> = await getPixelsPromise(
          `${dungeonsFS.ioDirPath}/${chunk.name}`
        , "image/png"); //arg2 is MIMEtype, only for Buffers (we can skip it here);
      if (log) {
        console.log("  -obtained image shape: ", pixelsArray.shape); //shape = width, height, channels
      }
      //pixelsArray.data is a Uint8Array of (shape.width * shape.height * #channels) elements

      const RgbaArray:tilesetMatcher.RgbaValueType[] = tilesetMatcher.slicePixelsToArray(
        pixelsArray.data,
        pixelsArray.shape[0], pixelsArray.shape[1], pixelsArray.shape[2]
      );

      //Calculating original chunk
      const convertedChunk: SbDungeonChunk = await generateDungeonChunk();
      
      
      
      
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
      if (miscTileset === undefined) {
        throw new Error(`Cannot resolve tileset: ${tilesetMatcher.TILESETMAT_NAME.misc}`);
      }
      const anchorsMap = tilesetMatcher.matchAnchors(
        sortedOldTileset.anchors as tilesetMatcher.AnchorTile[],
        miscTileset as tilesetMatcher.TilesetMiscJson,
        convertedChunk.getFirstGid(tilesetMatcher.TILESETMAT_NAME.misc)
      );
      for (let rgbaN = 0; rgbaN < RgbaArray.length; rgbaN++) {
        for (const match of anchorsMap) {
          if (match!== undefined && tilesetMatcher.isRgbaEqual(RgbaArray[rgbaN], match.tileRgba)) {
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
            fileObjects.name.includes(dungeonsFS.getFilename(file.name)) &&
            dungeonsFS.getExtension(fileObjects.name) === "png"
        );

        if (pngObjects) {
          //if we found name-objects.png file
          try {
            pixelsObjArray = await getPixelsPromise(`${dungeonsFS.ioDirPath}/${pngObjects.name}`, "image/png");
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
            pixelsArray.shape[0],
            pixelsArray.shape[1],
            pixelsArray.shape[2]
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
      const objectsMap = await matchAllObjects(sortedOldTileset.objects as tilesetMatcher.ObjectTile[]);
      //Add required tilesets to chunk
      if (log) {
        console.log(`  - injecting object tilesets...`);
      }
      await convertedChunk.addObjectTilesetShapes(objectsMap.tilesets);
      // await convertedChunk.parseAddObjects();
      //convert objectsMap from using Ids to using Gids
      const objectsGidMap = convertedChunk.convertIdMapToGid(objectsMap);
      if (pixelsObjArray !== undefined) {
        const objRgbaArray = tilesetMatcher.slicePixelsToArray(
          pixelsObjArray.data,
          pixelsArray.shape[0],
          pixelsArray.shape[1],
          pixelsArray.shape[2]
        );
        //map PNG to objects using objectsGidMap
        if (log) {
          console.log(`  - adding objects...`);
        }
        await convertedChunk.parseAddObjects(
          sortedOldTileset.objects as tilesetMatcher.ObjectTile[],
          objRgbaArray,
          objectsMap
        );

        //NPCs
        const npcMap = tilesetMatcher.matchNPCS(sortedOldTileset.npcs as tilesetMatcher.NpcTile[]);
        if (log) {
          console.log(`  - adding NPCs...`);
        }
        convertedChunk.parseAddNpcs(objRgbaArray, npcMap);
        //ground tile mods
        const modMap = tilesetMatcher.matchMods(sortedOldTileset.foreground);
        //add mods to chunk
        if (log) {
          console.log(`  - adding modded terrain regions...`);
        }
        convertedChunk.parseMods(RgbaArray, modMap);
        convertedChunk.parseMods(objRgbaArray, modMap);

        const stagehandMap = tilesetMatcher.matchStagehands(
          sortedOldTileset.stagehands as tilesetMatcher.StagehandTile[]
        );
        if (log) {
          console.log(`  - adding stagehands...`);
        }
        convertedChunk.parseStagehands(objRgbaArray, stagehandMap);
      }
      
      

      const success = await dungeonsFS.writeConvertedMapJson(
        newChunkPath,
        convertedChunk
      );
      if (success) {
        console.log(`SUCCESS! ${dungeonsFS.getFilename(file.name)}.json saved.`);
      }

      //return 4; //TEMP - return on first PNG converted
    }
  }
  
  
  
  return 4;
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
  if (ioDir !== undefined) {
    for (const file of ioDir.filter((file) => dungeonsFS.getExtension(file.name) === "png")) {
      if (file.isFile()) {
        if (dungeonsFS.getExtension(file.name) === "png") {
          if (file.name.includes("objects")) {
            continue; //do not convert objects layers as separate files
          }

          const newPath = `${dungeonsFS.ioDirPath}/${dungeonsFS.getFilename(
            file.name
          )}.json`;
          console.log(
            `Detected ${file.name}, writing ${dungeonsFS.getFilename(file.name)}.json...`
          );

          const convertedChunk = new SbDungeonChunk(
            newTilesetShapes
          );
          const getPixelsPromise = promisify(getPixels); //getPixels originally doesn't support promises
          const oldTileset = await extractOldTileset(false);
          if (oldTileset === undefined) {
            return -1;
          }
          const sortedOldTileset = await tilesetMatcher.getSortedTileset(
            oldTileset
          );
          const fullMatchMap = await tilesetMatcher.matchAllTilelayers(
            sortedOldTileset
          );

          let pixelsArray:NdArray<Uint8Array>|undefined = undefined;
          //Calculating original chunk
          try {
            pixelsArray = await getPixelsPromise(
              `${dungeonsFS.ioDirPath}/${file.name}`
            , "image/png"); //arg2 is MIMEtype, only for Buffers (we can skip it here)
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
            pixelsArray.shape[0], pixelsArray.shape[1], pixelsArray.shape[2]
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
          if (miscTileset === undefined) {
            throw new Error(`Cannot resolve tileset: ${tilesetMatcher.TILESETMAT_NAME.misc}`);
          }
          const anchorsMap = tilesetMatcher.matchAnchors(
            sortedOldTileset.anchors as tilesetMatcher.AnchorTile[],
            miscTileset as tilesetMatcher.TilesetMiscJson,
            convertedChunk.getFirstGid(tilesetMatcher.TILESETMAT_NAME.misc)
          );
          for (let rgbaN = 0; rgbaN < RgbaArray.length; rgbaN++) {
            for (const match of anchorsMap) {
              if (match!== undefined && tilesetMatcher.isRgbaEqual(RgbaArray[rgbaN], match.tileRgba)) {
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
                fileObjects.name.includes(dungeonsFS.getFilename(file.name)) &&
                dungeonsFS.getExtension(fileObjects.name) === "png"
            );

            if (pngObjects) {
              //if we found name-objects.png file
              try {
                pixelsObjArray = await getPixelsPromise(`${dungeonsFS.ioDirPath}/${pngObjects.name}`, "image/png");
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
                pixelsArray.shape[0],
                pixelsArray.shape[1],
                pixelsArray.shape[2]
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
          const objectsMap = await matchAllObjects(sortedOldTileset.objects as tilesetMatcher.ObjectTile[]);
          //Add required tilesets to chunk
          if (log) {
            console.log(`  - injecting object tilesets...`);
          }
          await convertedChunk.addObjectTilesetShapes(objectsMap.tilesets);
          // await convertedChunk.parseAddObjects();
          //convert objectsMap from using Ids to using Gids
          const objectsGidMap = convertedChunk.convertIdMapToGid(objectsMap);
          if (pixelsObjArray !== undefined) {
            const objRgbaArray = tilesetMatcher.slicePixelsToArray(
              pixelsObjArray.data,
              pixelsArray.shape[0],
              pixelsArray.shape[1],
              pixelsArray.shape[2]
            );
            //map PNG to objects using objectsGidMap
            if (log) {
              console.log(`  - adding objects...`);
            }
            await convertedChunk.parseAddObjects(
              sortedOldTileset.objects as tilesetMatcher.ObjectTile[],
              objRgbaArray,
              objectsMap
            );

            //NPCs
            const npcMap = tilesetMatcher.matchNPCS(sortedOldTileset.npcs as tilesetMatcher.NpcTile[]);
            if (log) {
              console.log(`  - adding NPCs...`);
            }
            convertedChunk.parseAddNpcs(objRgbaArray, npcMap);
            //ground tile mods
            const modMap = tilesetMatcher.matchMods(sortedOldTileset.foreground);
            //add mods to chunk
            if (log) {
              console.log(`  - adding modded terrain regions...`);
            }
            convertedChunk.parseMods(RgbaArray, modMap);
            convertedChunk.parseMods(objRgbaArray, modMap);

            const stagehandMap = tilesetMatcher.matchStagehands(
              sortedOldTileset.stagehands as tilesetMatcher.StagehandTile[]
            );
            if (log) {
              console.log(`  - adding stagehands...`);
            }
            convertedChunk.parseStagehands(objRgbaArray, stagehandMap);
          }
          
         

          const success = await dungeonsFS.writeConvertedMapJson(
            newPath,
            convertedChunk
          );
          if (success) {
            console.log(`SUCCESS! ${dungeonsFS.getFilename(file.name)}.json saved.`);
          }

          //return 4; //TEMP - return on first PNG converted
        }
      }
    }
  }
  
  return 4;
}

export {
  extractOldTileset,
  matchAllObjects,
  convertChunk,
  writeConvertedMap_test,
  // FullObjectMap,
};

export type {
  FullObjectMap,
};

