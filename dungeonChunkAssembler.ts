// const {promises:nodeFS} = require("fs");
// const nodePathModule = require("path");
// const {v4: uuidv4} = require("uuid");
import {promises as nodeFS} from "fs";
import * as nodePath from "path";
import {v4 as uuidv4} from "uuid";
import * as zlib from "zlib";

// const dungeonsFS = require("./dungeonsFS");
import * as dungeonsFS from "./dungeonsFS";
import * as tilesetMatcher from "./tilesetMatch.js";
import {TilesetShape} from "./tilesetMatch";

//Tiled JSON format reference: https://doc.mapeditor.org/en/stable/reference/json-map-format/

/*
interface DungeonChunk {
  backgroundcolor?: string,
  compressionlevel: number,
  height: number,
  infinite:boolean,
  layers: Layer[],
  nextlayerid: number,
  nextobjectid: number,
  orientation:"orthogonal"|"isometric"|"staggered"|"hexagonal",
  properties:object,
  renderorder:"right-down"|"right-up"|"left-down"|"left-up",
  tileheight:number,
  tilesets: TilesetShape[],
  tilewidth:number,
  type:"map",
  version:number|string,
  width:number,
}
*/

/*
const SB_DUNGEONCHUNK : DungeonChunk = {
  backgroundcolor:"#000000",
  compressionlevel:-1,
  height:60,
  infinite:false,
  layers:[],
  nextlayerid:1,
  nextobjectid:1,
  orientation:"orthogonal",
  properties:{},
  renderorder:"right-down",
  tileheight:8,
  tilesets:[],
  tilewidth:8,
  type:"map",
  version:1,
  width:60
}
*/


interface Layer {
  chunks: [any],
  class?: string,
  id: number, //Unique, incremental
  locked: boolean, //Lock layer in Tiled? default:false
  name: string,
  offsetx?: number, //horizontal offset in pixels, def:0
  offsety?: number,
  opacity: number, //0 to 1
  parallaxx?: number, //def: 1
  parallaxy?: number, //def: 1
  properties: [any], //custom properties
  startx?: number, //X coordinate where layer content starts (for infinite maps)
  starty?: number, //Y coordinate where layer content starts (for infinite maps)
  tintcolor?: string, //Hex-format (#RRGGBB or #AARRGGBB) multiplied with any graphics
  type: "tilelayer"|"objectgroup"|"imagelayer"|"group",
  readonly visible: true, //Whether layer is shown or hidden in editor
  readonly x: 0, //Horizontal layer offset in tiles. Always 0.
  readonly y: 0, //Vertical layer offset in tiles. Always 0.
  // image?: string, //for "imagelayer" only
  // layers?: Layer[], //for "group" layer only
  // repeatx: boolean, //repeated along the X axis? imagelayer only.
  // repeaty: boolean, //repeated along the Y axis? imagelayer only.
  // transparentcolor?: string, //Hex-formatted color (#RRGGBB) (optional). imagelayer only.
};

/**
 * Starbound "ground" dungeon layer with placeable tiles
 */
interface SbTilelayer extends Layer {
  compression?: "zlib", //Starbound uses only zlib compression -- |"gzip"|"zstd"
  data:Uint32Array|string, //Array for csv, base64-encoded for compressed
  encoding: "csv"|"base64",
  name: "front"|"back",
  opacity: 0.5|1.0, //0.5 for background
  height: number,
  width: number,
};

interface SbObjectgroupLayer extends Layer {
  readonly draworder: "topdown", //topdown (default) or index.
  name: "anchors etc"|"outside the map"|"wiring - locked door"|"monsters & npcs"|"wiring - lights & guns"|"objects"|"mods",
  objects: [any], //Array of objects.
}

/**
 * Starbound layer for generic objects (furniture etc)
 */
interface SbObjectLayer extends SbObjectgroupLayer {
  readonly name:"objects",
}

/**
 * Starbound layers for mods overlayed on top of SbTilelayer (like sand, snow, tilled, moss etc)
 */
interface SbModsLayer extends SbObjectgroupLayer {
  readonly name: "mods",
}

class SbDungeonChunk /*implements DungeonChunk */{
  readonly backgroundcolor?:string = "#000000";
  // #compressionlevel:number = -1;
  #height:number = 10;
  readonly infinite:boolean = false;
  #layers:Layer[] = [];
  #nextlayerid:number = 1;
  #nextobjectid:number = 1;
  readonly orientation:"orthogonal"|"isometric"|"staggered"|"hexagonal" = "orthogonal";
  #properties:object = {};
  readonly renderorder:"right-down"|"right-up"|"left-down"|"left-up" ="right-down";
  readonly tileheight:number = 8;
  #tilesets:TilesetShape[] = [];
  readonly tilewidth:number = 8;
  readonly type:"map" = "map";
  readonly version:number|string = 1;
  #width:number = 10;
  
  constructor(tilesetShapes:TilesetShape[]) {
    this.#tilesets = tilesetShapes;
  }

  addLayer(newLayer:SbTilelayer):SbDungeonChunk {
    //id and name must be unique!
    for(const layer of this.#layers) {
      if(layer.id === newLayer.id || layer.name === newLayer.name) {
        throw new Error(`Unable to add new layer: layer with id ${layer.id} or name ${layer.name} already exists.`);
      }
    }
    newLayer.id = this.#nextlayerid;
    this.#layers.push(newLayer);
    this.#nextlayerid = this.#nextlayerid + 1;
    return this;
  }

  getNextObjectId():number {
    return this.#nextobjectid;
  }

  setSize(width:number, height:number):SbDungeonChunk {
    this.#height = height;
    this.#width = width;
    return this;
  }

  //Add back private fields explicitly! Serialize via JSON.stringify to store as file.
  toJSON() {
    return {
      ...this,
      height: this.#height,
      layers: this.#layers,
      nextlayerid: this.#nextlayerid,
      nextobjectid: this.#nextobjectid,
      properties: this.#properties,
      tilesets: this.#tilesets,
      width: this.#width
    };
  }
}

/* async function addTilesets(chunk: SbDungeonChunk):Promise<SbDungeonChunk> {
  const tilesetShapes:TilesetShape[] = await tilesetMatcher.calcNewTilesetShapes();
  chunk.addTilesets(tilesetShapes);
    return chunk;
} */

/*
function writeDungeonChunk(chunk) {
    const tileMap = await extractOldTileset(true);
  
    let mapPath = "";
    try {
      // console.table(tileMap);
      dungeonsApi.writeTileMap(`${getFilename(dungeonPath) + ".TILES"}`, tileMap);
      for (const file of ioDir) {
        if (file.isFile())
          if (getExtension(file.name) === "png") {
            mapPath = `${file.path}/${getFilename(file.name)}.json`;
            console.log(
              `Detected ${file.name}, writing ${getFilename(file.name)}.json...`
            );
            let map = {};
            getPixels(`${file.path}/${file.name}`, (error, pixels) => {
              if (error) {
                console.error(error);
                console.log("Bad PNG image path");
                return;
              }
              //PNG conversion here
              map = mapPixelsToJson(pixels, tileMap);
              const tilesets = calcnewTilesets();
              //NEEDS AWAIT
              // dungeonsApi.writeConvertedMapJson(mapPath, map);
            });
          }
      }
    } catch (error) {
      console.error(error);
      return undefined;
    }
    return 4;
}
*/

function zlibTest() {
  console.log(`Testing zlib functionality`);
  const chunk =
    "eJzt1T9uwjAUx3HfxGoOwWV6iQ4MqBNjlx6BSzAwW108MHGj5gmsGniJXxoHv9i/J30FSPn3kRPijNk7hBBCCCFULKNoXEPWMK4hazwOXnjhhRdelePghRdeeOFNzu6N/9x09585xxXykm0ocsblnP+YxpKcc8zKeXOaS3hpLtaYQ287Mn101977PitY3zASb+7hrnlOU84t8Yb7OfyXxfNt+e81eMkzpda8Q2btXups0x1v+cR9vQYvt02cr9z7ZdrxkjXUgnft63ti2nbXanp+U+8SchxuSd492r2pNYu94Xc83t6n3UszdD9TZ/vsfTSu0Std3zErvHq8P/YvqTdlffSG42v0Sp5fzV7fH9Mb/nw+dwNezzjDPkt5tQYvvLV4c1tb9Go2L+XVaF7Sqs39Kmtp86udc8zS/bjtSjqn+qXbl77+OebS14Ha6xfz8DLr";
  const chunk64 = Buffer.from(chunk, "base64");
  console.log(chunk64);
  // console.log(chunk64.toString("base64"));
  zlib.inflate(chunk64, (error, buffer) => {
    console.error(error || "Decompression OK");
    console.log(buffer);
    console.log(`First raw GID is ${buffer.readUInt32LE(4)}`);
    zlib.deflate(buffer, (error, result) => {
      const recompressed = Buffer.from(result).toString("base64");
      console.log(recompressed);
      console.log(
        `initial and recompressed chunks match? ${chunk === recompressed}`
      );
    });
    const arr = [...buffer];
    console.log(arr);
    // console.log(buffer.toString("hex"));

    const FLIPPED_HORIZONTALLY_FLAG = 0x80000000;
    const FLIPPED_VERTICALLY_FLAG = 0x40000000;
    const FLIPPED_DIAGONALLY_FLAG = 0x20000000;
    const ROTATED_HEXAGONAL_120_FLAG = 0x10000000;
    let tile_index = 0;
    //Tiled writes non-compressed GIDs in little-endian 32-bit unsigned ints, i.e. each4 bytes in a buffer is a GID
    //however, highest 4 bits are used as flipping flags (no pun intended)
    //details: https://doc.mapeditor.org/en/latest/reference/global-tile-ids/#tile-flipping
    //bit 32 - horizontal flip, bit 31 - vertical, bit 30 - diagonal (rotation). Bit 29 is for hexagonal maps, which Starbound file is not, so it can be ignored - but we still need to clear it, just in case
    const FLAG_HORIZ_FLIP = 8 << 28; //1000 shifted left 32-4=28 positions.
    const FLAG_VERT_FLIP = 4 << 28; //0100 shifted left
    const FLAG_DIAG_FLIP = 2 << 28; //0010 shifted left
    const FLAG_HEX_120_ROTATE = 1 << 28; //0001 shifted left
    //1+2+4+8 = 15, i.e. 1111 in binary, the case with all flags set to true
    const flagsMask =
      FLAG_HORIZ_FLIP | FLAG_VERT_FLIP | FLAG_DIAG_FLIP | FLAG_HEX_120_ROTATE; //Sum all flags using bitwise OR to get a mask. When applied to a UInt32 it should reset all bits but flags to 0
    //in other words, since flags are 4 high bits, it's 111100...0000
    const gidMask = ~flagsMask; //reverse (~) mask is 000011..1111, it will reset flags and give us "pure" GID
    const rawGidFirst = buffer.readUInt32LE(0);
    console.log(rawGidFirst);
    const pureFlags = rawGidFirst & flagsMask;
    const pureGid = rawGidFirst & gidMask;
    //what we have from decompression
    console.log(`Flags are ${pureFlags >>> 28}, pure GID is ${pureGid}`);
    //what we should have from correct decompression
    console.log(
      `Flags are ${(2147483847 & flagsMask) >>> 28}, pure GID is ${
        2147483847 & gidMask
      }`
    );
    //DAFUQ

    /*
    let flags = 15 // 1111 binary - all set
  let gid = 7892 // whatever
  let flagsShifted = flags << 28 // flags need to end up on the left side of the combined number. Whole length is 32, flags length is 4 so we need to shift left 32 - 4 =28
  let gidMask = ~ (15 << 28) // all set flags shifted (<<) and negated (~) will give us 0000111...111 
  let flagsMask = (15 << 28)
  let combined = ( flags & flagsMask) | (gid & gidMask)

  Розпаковка на js

let gid = combined & gidMask
let flags = combined >>> 28

int -> little endian byte array

let res = [0,0,0,0]
let byteMask = 255
res[0] = combined & byteMask

res[1] = (combined >>> 8) & byteMask;
res[2] = (combined >>> 16) & byteMask;
res[3] = (combined >>> 24) & byteMask;
*/

    // Here you should check that the data has the right size
    // (map_width * map_height * 4)
  });
}

export {
  zlibTest,
  SbDungeonChunk,
};


