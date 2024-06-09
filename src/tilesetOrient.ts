//A one-time script chunk to enhance object tilesets with GAY, in true spirit of June

import {Dir, Dirent, opendir, PathLike, promises as nodeFS} from "fs";
import nodePath from "path";
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';


import { resolveTilesets, TilesetJson, TilesetObjectJson, ObjectJson } from "./tilesetMatch";
import * as tilesetMatcher from "./tilesetMatch";
import * as dungeonsFS from "./dungeonsFS";
import {resolveObjectsPath, getTodoTilesets, getObjectByName} from "./tilesetOrientFs";
import {UpgradedObjectJson, ObjectFile, ObjectOrientation, ObjectFileOriented, TilesetTodos} from "./tilesetOrientFs"; //types
// import { TILESETJSON_NAME } from "./tilesetMatch.js";

let assetsPath:PathLike = await resolveObjectsPath(); //assetsPath has correct path to OBJECT files

function getRemainingTasks(tilesets: TilesetTodos):number {
  let tiles = 0;
  for(const tileset in tilesets) {
    tiles = tiles + tilesets[tileset].tilesRemaining.length;
  }
  return tiles;
}

function upgradeTile(correctOrientation: ObjectOrientation, tile: ObjectJson):UpgradedObjectJson {
  let anchorLayer:"front"|"back"|undefined = undefined;
  switch(correctOrientation.anchors?.toString()) {
    case "[background]": {
      anchorLayer = "back";
      break;
    }
    case "undefined": {
      anchorLayer = undefined;
      break;
    }
    default: {
      anchorLayer = "front";
    }
  }
  const upgradedTile:UpgradedObjectJson = {
    ...(tile as ObjectJson),
    "//obj-anchorLayer": anchorLayer,
    "//obj-anchors": undefined, //TODO fix later
    "//obj-spriteDirection": correctOrientation.direction,
    "//obj-verified": true,
    "//obj-offset": correctOrientation.imagePosition,
  };

  return upgradedTile;
}

function getOffsetDelta(offsetVector1:[number, number], offsetVector2: [number, number]):number {
  const delta = [offsetVector1[0] - offsetVector2[0], offsetVector1[1] - offsetVector2[1]];
  return Math.sqrt(delta[0]*delta[0] + delta[1]*delta[1]);
}

//Here will be tilesets that we need to improve
const tilesetTodos = await getTodoTilesets();
const remaining = console.log(`TODO ${getRemainingTasks(tilesetTodos)} tile definitions`);

const stats:{remaining: number, orientOutOfBounds: [string, string][], tilesetsOutOfBounds: string[]} = {
  remaining: 0,
  orientOutOfBounds: [],
  tilesetsOutOfBounds: [],
}

//iteration over tilesets
for(const currentTileset in tilesetTodos) {
  console.log(`Processing ${currentTileset}...`)

  //iteration over tileNames in current tileset - each full cycle should fix all problematic tiles in one tileset
  for(let tilenameIndex = 0; tilenameIndex < tilesetTodos[currentTileset].tileNamesToVerify.length; tilenameIndex++) {
    const objectName = tilesetTodos[currentTileset].tileNamesToVerify[tilenameIndex];

    console.log(`  Searching ${objectName}`);
    const objFile: ObjectFileOriented = await getObjectByName(assetsPath, objectName, 0) as ObjectFileOriented;
    if(objFile === undefined) {
      console.error(`>>>Unable to find object file ${objectName}`);
      continue;
      //throw new Error(`Unable to find object file ${objectName}`);
    }
    if(objFile.orientations === undefined) {
      throw new Error(`Object file ${objectName} contains no orientations`);
    }
  
    //iteration over tilesToVerify - each full cycle should match all orientations of one objectName
    for(let indexToVerify = 0; indexToVerify < tilesetTodos[currentTileset].tilesToVerify.length; indexToVerify++) {
  
      const tileIndex = tilesetTodos[currentTileset].tilesToVerify[indexToVerify];
      const tileReadonly = tilesetTodos[currentTileset].tileset.tileproperties[tileIndex];
  
      //experimental - matches tiles and orientations simply in order of occurence (tilesToVerify is ordered by ascendance)
      if(tileReadonly.object === objectName) {
        const mentionsOrient = tileReadonly["//name"].indexOf("orientation");
        const lastSymbol = mentionsOrient > 0? tileReadonly["//name"].substring(mentionsOrient+11) : "0";
        const possibleIndex = parseInt(lastSymbol);
          if(isNaN(possibleIndex)) {
            //orientation zero, no idex
            console.log(`   --mapping tile ${tileIndex} called ${tileReadonly["//name"]} to orientation 0`);
            const orientation = objFile.orientations[0];
            if((orientation as Record<string,any>).TAKEN === true) {
              throw new Error(`   Orientation 0 already taken!`)
            }
            tilesetTodos[currentTileset].tileset.tileproperties[tileIndex] = upgradeTile(orientation, tileReadonly);
            (objFile.orientations[0] as Record<string,any>).TAKEN = true;
            tilesetTodos[currentTileset].tilesRemaining.splice(indexToVerify, 1);
          }
          else {
            if(possibleIndex < objFile.orientations.length ) {
              console.log(`   --mapping tile ${tileIndex} called ${tileReadonly["//name"]} to orientation ${possibleIndex}`);
              const orientation = objFile.orientations[possibleIndex];
              if((orientation as Record<string,any>).TAKEN === true) {
                throw new Error(`   Orientation ${possibleIndex} already taken!`)
              }
              tilesetTodos[currentTileset].tileset.tileproperties[tileIndex] = upgradeTile(orientation, tileReadonly);
              (objFile.orientations[possibleIndex] as Record<string,any>).TAKEN = true;
              tilesetTodos[currentTileset].tilesRemaining.splice(indexToVerify, 1);
            }
            else {
              console.error(`   ----${objectName} has more variations than in the .object file! Orientation ${possibleIndex} out of bounds`);
              stats.orientOutOfBounds.push([tileReadonly["//name"], currentTileset]);
              if(stats.tilesetsOutOfBounds.includes(currentTileset) === false) {
                stats.tilesetsOutOfBounds.push(currentTileset);
              }
            }  
          }
/*
        for(let orN = 0; orN < objFile.orientations.length; orN++) {
          const orientation = objFile.orientations[orN];
          if((orientation as Record<string,any>).TAKEN === true) {
            continue; //if current orientation is already matched, skip
          }
          else {
            const possibleIndex = parseInt(tileReadonly["//name"].substring(tileReadonly["//name"].length - 2));
            if(!isNaN(possibleIndex) && possibleIndex < ) {
              console.log(`   --mapping tile ${tileIndex} called ${tileReadonly["//name"]} to orientation ${orN}`);
            }
            console.log(`   --mapping tile ${tileIndex} called ${tileReadonly["//name"]} to orientation ${orN}`);
            tilesetTodos[currentTileset].tileset.tileproperties[tileIndex] = upgradeTile(orientation, tileReadonly);
            chosenOr = orN;
            (objFile.orientations[chosenOr] as Record<string,any>).TAKEN = true;
            break; //we've found our match, skip other checks
          }
        }
        if(chosenOr < 0) {
          console.error(`   ----${objectName} has more variations than in the .object file! Last variation will have no match!`);
          stats.orientOutOfBounds.push(tileReadonly["//name"]);
        }
        */
      }
    }
    const untaken = objFile.orientations.findIndex((or) => (or as Record<string,any>).TAKEN === undefined);
    if(untaken > -1) {
      console.log(`   >Untaken orientations remained: ${untaken}`)
    }
  }
  
  stats.remaining = getRemainingTasks(tilesetTodos);
  console.log(stats);
  console.log(`Tileset ${currentTileset} is gay now`);
}

console.log(`TODO: ${getRemainingTasks(tilesetTodos)} tile definitions`);
console.log(`Kawabunga`);
  


  //TODO
  //get tile name
  //find tile file
  //match tile variation
  //write extended info into ObjectJson


//write upgradedTileset at enhancedTilesetsPath
