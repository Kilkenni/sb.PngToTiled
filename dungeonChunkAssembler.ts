// const {promises:nodeFS} = require("fs");
// const nodePathModule = require("path");
// const {v4: uuidv4} = require("uuid");
import {promises as nodeFS} from "fs";
import * as nodePath from "path";
import {v4 as uuidv4} from "uuid";

// const dungeonsFS = require("./dungeonsFS");
import * as dungeonsFS from "./dungeonsFS";
import * as tilesetMatcher from "./tilesetMatch.js";
import {TilesetShape} from "./tilesetMatch";

//Tiled JSON format reference: https://doc.mapeditor.org/en/stable/reference/json-map-format/

interface Layer {
  chunks?: [any],
  class?: string,
  id: number, //Unique, incremental
  locked?: boolean, //Lock layer in Tiled? default:false
  name: string,
  offsetx?: number, //horizontal offset in pixels, def:0
  offsety?: number,
  opacity: number, //0 to 1
  parallaxx?: number, //def: 1
  parallaxy?: number, //def: 1
  properties?: [any], //custom properties
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
  type: "tilelayer",
  compression?: "zlib", //Starbound uses only zlib compression -- |"gzip"|"zstd"
  data:number[]|string, //Array for csv, base64-encoded for compressed
  encoding?: "csv"|"base64", //defaul "csv"
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

class SbDungeonChunk{
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

  addUncompressedTileLayer(layerData:number[],layerName:"front"|"back", layerWidth: number, layerHeight: number):SbDungeonChunk {
    const newLayer:SbTilelayer = {
      data: layerData,
      name: layerName,
      opacity: (layerName === "front")?1.0:0.5,
      height: layerHeight,
      width: layerWidth,
      id: this.#nextlayerid,
      // locked: false,
      type: "tilelayer",
      visible: true,
      x: 0,
      y: 0
    }
    //id and name must be unique!
    for(const layer of this.#layers) {
      if(layer.name === newLayer.name) {
        throw new Error(`Unable to add new layer: layer with name ${layer.name} already exists.`);
      }
    }
    this.#layers.push(newLayer);
    this.#nextlayerid = this.#nextlayerid + 1;
    return this;
  }

  addBothTilelayers(frontLayerData: number[], backLayerData: number[], layerWidth: number, layerHeight: number): SbDungeonChunk{
    this.addUncompressedTileLayer(backLayerData, "back", layerWidth, layerHeight);
    this.addUncompressedTileLayer(frontLayerData, "front", layerWidth, layerHeight);
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

export {
  SbDungeonChunk,
};


