// const {promises:nodeFS} = require("fs");
// const nodePathModule = require("path");
// const {v4: uuidv4} = require("uuid");
// import {promises as nodeFS} from "fs";
// import * as nodePath from "path";
// import {v4 as uuidv4} from "uuid";

// import * as dungeonsFS from "./dungeonsFS.js";
// import * as tilesetMatcher from "./tilesetMatch.js";
import { getTileset, getTilesetPath } from "./dungeonsFS.js";
import { TilesetJson } from "./tilesetMatch.js";
import { getFilenameFromPath } from "./conversionSteps.js";
import { TILESETMAT_NAME } from "./tilesetMatch.js";
import GidFlags from "./GidFlags.js";

//Tiled JSON format reference: https://doc.mapeditor.org/en/stable/reference/json-map-format/

type TilesetShape = {
  firstgid: number,
  source: string,
};

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
  encoding?: "csv"|"base64", //default "csv"
  name: "front"|"back",
  opacity: 0.5|1.0, //0.5 for background
  height: number,
  width: number,
};

const OBJECTLAYERS = [
  "anchors etc",
  "outside the map",
  "wiring - locked door",
  "monsters & npcs",
  "wiring - lights & guns",
  "objects",
  "mods"
] as const;

interface SbObjectgroupItem {
  height: number, //divides by 8
  width:number,
  id:number, //unique
  readonly name:"",
  properties: {},
  readonly rotation:0,
  readonly type:"",
  readonly visible:true,
  x:number, //must divide by 8!
  y:number, //must divide by 8! 
}

interface SbObjectgroupLayer extends Layer {
  readonly draworder: "topdown", //topdown (default) or index.
  readonly type: "objectgroup",
  name: typeof OBJECTLAYERS[number],
  objects: SbObjectgroupItem[], //Array of objects.
  readonly opacity: 1,
}

interface SbAnchor extends SbObjectgroupItem {
  gid:number,
  readonly height: 8,
  readonly width: 8,
  readonly properties: {},
}

/**
 * Starbound layer for anchors (connectors to adjacent dungeon chunks)
 */
interface SbAnchorLayer extends SbObjectgroupLayer {
  readonly name: "anchors etc",
  objects: SbAnchor[],
}

interface SbObject extends SbObjectgroupItem {
  gid:number, 
  properties: {
    parameters?: any, //treasure pools, detect areas etc
  },
}

interface SbEntity extends SbObjectgroupItem{
  readonly height: 8, 
  readonly width:8,
  properties: {
    npc: string,
    typeName:string,
  },
}

interface SbWire extends SbObjectgroupItem {
  readonly height: 0,
  readonly width: 0,
  polyline:[
        {x:number, y:number}, 
        {x:number, y:number}],
  readonly properties: {},
}

interface SbStagehand extends SbObjectgroupItem{
  properties: { stagehand:string },
}

const TEMPLATE = {
  SBOBJECT: {
    name: "",
    rotation: 0,
    type: "",
    visible: true,
  },
  SBANCHOR: {
    height: 8,
    width: 8,
    properties: {},
  },
  SBENTITY: {
    height: 8,
    width: 8,
  },
  SBWIRE: {
    heigth: 0,
    width: 0,
    properties: {},
  },
} as const;

/**
 * Starbound layer for generic objects (furniture etc)
 */
interface SbObjectLayer extends SbObjectgroupLayer {
  readonly name: "objects",
  objects: SbObject[],
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

  async #getFirstFreeGid(): Promise<number> {
    if (this.#tilesets.length === 0) {
      return 1;
    }
    const lastTilesetShape: TilesetShape = this.#tilesets[this.#tilesets.length - 1];
    
    const lastTileset = await getTileset(getFilenameFromPath(lastTilesetShape.source));
    if (lastTileset === undefined) {
      throw new Error(`Unable to resolve tileset ${lastTilesetShape.source}`);
    }
    return lastTilesetShape.firstgid + lastTileset.tilecount;
  }

  async addTilesetShape(tileset: TilesetJson, log = false): Promise<SbDungeonChunk> {
    const newShape: TilesetShape = {
      firstgid: await this.#getFirstFreeGid(),
      source: getTilesetPath(tileset.name),
    }
    this.#tilesets.push(newShape);
    return this;
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

  #getLayerIndexByName(layerName:string):number|undefined {
    // const tempLayers = this.#layers;
    for(let layerIndex = 0; layerIndex < this.#layers.length; layerIndex++) {
      // const layName = tempLayers[layerIndex].name;
      if(layerName === this.#layers[layerIndex].name ) {
        return layerIndex;
      }
    }
    return;
  }

  #mergeLayerData(baseLayerData: number[], mergeLayerData: number[]):number[] {
    if(baseLayerData.length !== mergeLayerData.length) {
      throw new Error(`Cannot merge Tilelayers: size mismatch!`)
    }

    const miscFirstGid = this.getFirstGid(TILESETMAT_NAME.misc);
    if(!miscFirstGid) {
      throw new Error(`Cannot find ${TILESETMAT_NAME.misc} tileset in chunk tileset shapes`);
    }
    const magicPinkBrushGid = GidFlags.apply(miscFirstGid + 1, false, true, false); //MPP is 2nd in tileset + Horiz flip

    //caution! Front layer can have 0-s, which is "no tile" value
    for(let pixelN = 0; pixelN < baseLayerData.length; pixelN++) {
      if(baseLayerData[pixelN] === magicPinkBrushGid || baseLayerData[pixelN] === 0) {
        if(mergeLayerData[pixelN] === baseLayerData[pixelN]) {
          continue; //both layers have MPP or 0 in pixel, skip
        }
        else {
            baseLayerData[pixelN] = mergeLayerData[pixelN]; //merge
        }
      }
      else {
        if(mergeLayerData[pixelN] !== magicPinkBrushGid && mergeLayerData[pixelN] !== 0) {
          throw new Error(`Merging layers both have non-empty values at pixel ${pixelN}`)
        }
      }
    }
    return baseLayerData;
  }

  mergeTilelayers(frontLayerData: number[], backLayerData: number[]):SbDungeonChunk {
    const frontIndex = this.#getLayerIndexByName("front");
    const backIndex = this.#getLayerIndexByName("back");

    if(frontIndex === undefined || backIndex === undefined) {
      throw new Error("Cannot merge: original chunk lacks tilelayers!");
    }

    if(typeof (this.#layers[frontIndex] as SbTilelayer).data === "string" || typeof (this.#layers[backIndex] as SbTilelayer).data === "string") {
      throw new Error(`Cannot merge into encoded tilelayer ${frontIndex}!`);
    }
    
    this.#mergeLayerData((this.#layers[frontIndex] as SbTilelayer).data as Array<number>, frontLayerData);
    this.#mergeLayerData((this.#layers[backIndex] as SbTilelayer).data as Array<number>, backLayerData);
    return this;
  }

  /**
   * Initializes new empty Objectgroup Layer.
   * returns unique layer ID
   */
  #initObjectLayer(layerName:typeof OBJECTLAYERS[number]):number {
    const layerId = this.isLayerExist(layerName);
    if(layerId != false){
      return layerId; //already initiated
    }
    const newObjectLayer:SbObjectgroupLayer = {
      draworder: "topdown",
      name: layerName,
      id: this.#nextlayerid,
      objects: [],
      opacity: 1,
      type: "objectgroup",
      visible: true,
      x: 0,
      y: 0
    }

    this.#layers.push(newObjectLayer);
    this.#nextlayerid = this.#nextlayerid + 1;
    return this.#nextlayerid - 1;
  }

  isLayerExist(layerName:typeof OBJECTLAYERS[number]):number|false {
    for(const layer of this.#layers) {
      if(layer.name === layerName) {
        return layer.id;
      }
    }
    return false;
  }

  /**
   * Adds anchor to anchor layer
   * @param anchorGid - Glodal Tile ID
   * @param pngX
   * @param pngY 
   * @returns 
   */
  addAnchorToObjectLayer(anchorGid: number, pngX: number, pngY: number): SbDungeonChunk {
    const layerId: number = this.#initObjectLayer("anchors etc") - 1; //layers in Sb start from 1
    const newAnchor:SbAnchor = {
      gid: anchorGid,
      id: this.getNextObjectId(),
      name: "",
      type: "",
      height: 8,
      width: 8,
      rotation: 0,
      properties: {},
      visible: true,
      x: pngX * 8,
      y: pngY * 8 + 8, //shift coordinates because Sb uses bottom-left corner as zero while normal programs use top-left, shift on Y by height of the tile
    };
    (this.#layers[layerId] as SbAnchorLayer).objects.push(newAnchor);
    this.#nextobjectid = this.#nextobjectid +1;
    return this;
  }

  addObjectToObjectLayer(objectGid: number, x: number, Y: number): SbDungeonChunk {
    //TODO get layerID
    const newObject: SbObject = {
      ...TEMPLATE.SBOBJECT,
      gid: objectGid,
      id: this.getNextObjectId(),
      properties: {},
      height: -1,
      width: -1,
      x: -1,
      y: -1,
    }

    //TODO write parameters
    //TODO calc height, width
    //(this.#layers[layerId] as SbObjectLayer).objects.push(newObject);
    // this.#nextobjectid = this.#nextobjectid +1;
    return this;
  }

  getNextObjectId():number {
    return this.#nextobjectid;
  }

  getFirstGid(tilesetName:string):number|undefined {
    const tsShape = this.#tilesets.find((shape) => shape.source.includes(`${tilesetName}.json`));
    if(tsShape) {
      return tsShape.firstgid;
    }
    return undefined;
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
  TilesetShape,
};


