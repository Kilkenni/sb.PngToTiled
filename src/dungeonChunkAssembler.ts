// const {promises:nodeFS} = require("fs");
// const nodePathModule = require("path");
// const {v4: uuidv4} = require("uuid");
// import {promises as nodeFS} from "fs";
// import * as nodePath from "path";
// import {v4 as uuidv4} from "uuid";

// import * as dungeonsFS from "./dungeonsFS.js";
// import * as tilesetMatcher from "./tilesetMatch.js";
import { getTileset, getTilesetPath, getTilesetNameFromPath } from "./dungeonsFS";
import { TilesetJsonType, matchObjects, matchObjectsBiome, ObjectTileType, ObjectFullMatchType, getObjectFromTileset, getTileSizeFromTileset, LayerTileMatchType, TilesetMiscJsonType, ObjectJsonType, RgbaValueType, isRgbaEqual, ObjectBrushType } from "./tilesetMatch";
import { getFilenameFromPath, getFilename, FullObjectMap } from "./conversionSteps";
import { TILESETMAT_NAME, TILESETOBJ_NAME, resolveTilesets} from "./tilesetMatch";
// import * as dungeonsFS from "./dungeonsFS";
import GidFlags from "./GidFlags";

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

  /**
   * Reads tileset shape path from DungeonChunk and returns only its name
   * @param shapeIndex 
   * @returns 
   */
  getTilesetNameFromShape(shapeIndex: number): string | undefined {
    if (shapeIndex >= this.#tilesets.length) { //tileset index out of bounds
      return undefined;
    }
    const tilesetDir = resolveTilesets()+"/";
    const tilesetRelDir = "./tilesets/packed/";
    //strip path to dir from full path, leaving only name
    const tilesetName = getFilename(this.#tilesets[shapeIndex].source.replace(tilesetDir, ``).replace(tilesetRelDir, ""));
    if ((<any>Object).values(TILESETMAT_NAME).includes(tilesetName) ||
      TILESETOBJ_NAME.objHuge === tilesetName ||
      (TILESETOBJ_NAME.byCategory as ReadonlyArray<string>).includes(tilesetName) ||
      (TILESETOBJ_NAME.byColonyTag as ReadonlyArray<string>).includes(tilesetName) ||
      (TILESETOBJ_NAME.byRace as ReadonlyArray<string>).includes(tilesetName) ||
      (TILESETOBJ_NAME.byType as ReadonlyArray<string>).includes(tilesetName) ) {
      return tilesetName;
    }
    throw new Error(`Cannot recognize tileset with name ${tilesetName}`);
    //tileset name from shapes not found. Technically an error.
  }

  async #getFirstFreeGid(): Promise<number> {
    if (this.#tilesets.length === 0) {
      return 1;
    }
    const lastTilesetShape: TilesetShape = this.#tilesets[this.#tilesets.length - 1];
    const tilesetName = this.getTilesetNameFromShape(this.#tilesets.length - 1) as string;
    
    const lastTileset = await getTileset(tilesetName);
    if (lastTileset === undefined) {
      throw new Error(`Unable to resolve tileset ${lastTilesetShape.source}`);
    }
    return lastTilesetShape.firstgid + lastTileset.tilecount;
  }

  /**
   * Add new tileset shape (path and start Gid). Needs to be run before adding tiles from the tileset.
   * @param tileset - parsed JSON containing tileset
   * @param log - enables posting limited debug info in console. default: false.
   * @returns 
   */
  async addTilesetShape(tileset: TilesetJsonType, log = false): Promise<SbDungeonChunk> {
    const tilesetFound = this.#tilesets.find((shape: TilesetShape, shapeIndex: number) => {
      return tileset.name.includes(this.getTilesetNameFromShape(shapeIndex) as string);
    })
    if (tilesetFound !== undefined) { //tileset already exists, skip
      return this;
    }
    const newShape: TilesetShape = {
      firstgid: await this.#getFirstFreeGid(),
      source: getTilesetPath(tileset.name),
    }
    this.#tilesets.push(newShape);
    return this;
  }

  getFirstGid(tilesetName:string):number {
    const tsShape = this.#tilesets.find((shape) => shape.source.includes(`${tilesetName}.json`));
    if(tsShape) {
      return tsShape.firstgid;
    }
    throw new Error(`Tileset with name ${tilesetName} not present in shapes, can't retrieve firstGid`)
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
        if (mergeLayerData[pixelN] === baseLayerData[pixelN] || mergeLayerData[pixelN] === magicPinkBrushGid) {
          continue; //both layers have MPP or 0 in pixel, or mergeLayer has MPP - skip
        }
        else {
          //debug
          const p1 = baseLayerData[pixelN];
          const p2 = mergeLayerData[pixelN];
          const coords = this.getCoordsFromFlatRgbaArray(pixelN, this.#width);
          /*if (mergeLayerData[pixelN] === 0) {
            //additional condition: if mergeLayer Gid === 0 (happens when we have an object which is not a tile block and is not recognized at this stage) - reset this tile to transparent in baseLayer
            baseLayerData[pixelN] = magicPinkBrushGid;
          }
          else*/ {
            baseLayerData[pixelN] = mergeLayerData[pixelN]; //merge
          }
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
   * @param anchorGid - Global Tile ID
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

  getNextObjectId():number {
    return this.#nextobjectid;
  }

  /**
   * 
   * @param objectGid form Object from loose properties and push to Object Layer
   * @param height  > 0
   * @param width > 0
   * @param x >= 0
   * @param y >=0
   * @param properties Object with parameters like loot tables etc
   * @returns 
   */
  addObjectToObjectLayer(objectGid: number, height: number, width: number, x: number, y: number, properties: {} = {}): SbDungeonChunk {
    const layerId = this.#initObjectLayer("objects");

    const newObject: SbObject = {
      ...TEMPLATE.SBOBJECT as SbObjectgroupItem,
      gid: objectGid,
      id: this.getNextObjectId(),
      properties: properties,
      height: height,
      width: width,
      x: x,
      y: y,
    };
    
    const objLayer: SbObjectLayer = this.#layers.find((layer) => { return layer.id === layerId }) as SbObjectLayer;
    objLayer.objects.push(newObject);
    this.#nextobjectid = this.#nextobjectid +1;
    return this;
  }

  /**
   * Add shapes for object tilesets in SbDungeonChunk. Required before adding objects from these tilesets.
   * @param tilesets - array of names for tilesets to add
   * @returns 
   */
  async addObjectTilesetShapes(tilesets: string[]): Promise<SbDungeonChunk> {
    //Gather all the tilesets already present in the DungeonChunk
    const shapeNames: string[] = [];
    for (let shapeIndex = 0; shapeIndex < this.#tilesets.length; shapeIndex++) {
     shapeNames.push(this.getTilesetNameFromShape(shapeIndex) as string);
    }
    //Check if we need to add tilesets, one by one
    for (const tilesetName of tilesets) {
      if (shapeNames.includes(tilesetName)) {
        continue; //tileset present in shapes, do nothing
      }
      else {
        const tilesetJson = await getTileset(tilesetName);
        if (tilesetJson) {
          await this.addTilesetShape(tilesetJson);
        }
        else {
          throw new Error(`Unable to resolve tileset ${tilesetName} to add in DungeonChunk`);
        }
      }
    }
    return this;
  }

  convertIdMapToGid(objMatchMap: FullObjectMap):(ObjectFullMatchType|undefined)[] {
    const idMap = objMatchMap.matchMap;

    const GidMap: (ObjectFullMatchType | undefined)[] = idMap.map((idMatch) => {
      if (idMatch === undefined) {
        return undefined;
      }
      //try {
        this.getFirstGid(idMatch.tileset);
      /*}
      catch (error) {
        const typedError = error as Error;
        if (typedError.message.includes("not present in shapes, can't retrieve firstGid")) {
          //we are trying to map something absent from shapes - it is an error we've already found. Use await for async ops!
        }
      }*/
      const { tileName, tileRgba, tileId, tileset } = idMatch;
      const gidMatch: ObjectFullMatchType = {
        tileName,
        tileRgba,
        tileId,
        //Apply flip here if present
        tileGid: GidFlags.apply((this.getFirstGid(idMatch.tileset)) + idMatch.tileId, false, idMatch.flipHorizontal || false, false),
        tileset,
      };
      return gidMatch;
    });
    return GidMap;
  }

  /**
   * Utility function to get X, Y from flattened 2D array knowing its dimensions
   * @param index - Index of an RgbaValue in array
   * @param width - horizontal dimension of the array
   * @returns 
   */
  getCoordsFromFlatRgbaArray(index:number, width:number) {
    const x = index % width;
    const y = Math.trunc(index / width);
    return { x, y };
  }

  async parseAddObjects(oldObjects:ObjectTileType[], rgbaArray: RgbaValueType[], objMatchMap: FullObjectMap): Promise<SbDungeonChunk> {
    //Add shapes for object tilesets in SbDungeonChunk
    await this.addObjectTilesetShapes(objMatchMap.tilesets);
    const objGidMap = this.convertIdMapToGid(objMatchMap);
    //quick check to ensure size of rgbaArray
    if (rgbaArray.length !== this.#height * this.#width) {
      throw new Error(`Unable to add objects from image with ${rgbaArray.length} pixels to a chunk of height ${this.#height} and width ${this.#width}: size mismatch!`)
    }
  
    for (let rgbaN = 0; rgbaN < rgbaArray.length; rgbaN++) {
      for (const match of objGidMap) {
        if (match !== undefined) {
          if (isRgbaEqual(match.tileRgba, rgbaArray[rgbaN]) === false) {
            continue; //skip until we find the right match
          }
          const objectData: ObjectJsonType = await getObjectFromTileset(match);
          const oldObjectData = oldObjects.find((objData) => {
            return isRgbaEqual(match.tileRgba, objData.value);
          });
          
          const tileSize = await getTileSizeFromTileset(match);
          //TODO calc height, width
          //exchange width with height b/c of difference in XY coords in Sb and Tiled
          const height = tileSize.tilewidth;
          const width = tileSize.tileheight;
          //TODO calc x, y from rgbaArray
          const { x: objX, y: objY } = this.getCoordsFromFlatRgbaArray(rgbaN, this.#width);
          const name = match.tileName;
          
          //TODO write parameters
          
          //TODO add object
          //Y + 1 because of difference in coords in Sb and Tiled (coords of pixel are shifted by 1)
          this.addObjectToObjectLayer(match.tileGid, height, width, (objX*this.tilewidth + parseInt(objectData.imagePositionX)), ((objY + 1)*this.tileheight + parseInt(objectData.imagePositionY)));
        }
      }
    }
    
    return this;
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
  
export type {
  TilesetShape
};


