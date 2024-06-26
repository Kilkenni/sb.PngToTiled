// const {promises:nodeFS} = require("fs");
// const nodePathModule = require("path");
// const {v4: uuidv4} = require("uuid");
// import {promises as nodeFS} from "fs";
// import * as nodePath from "path";
// import {v4 as uuidv4} from "uuid";

// import * as dungeonsFS from "./dungeonsFS.js";
// import * as tilesetMatcher from "./tilesetMatch.js";
import { getFilename, getTileset, getTilesetPath, getTilesetNameFromPath, writeObjectVariationsDump } from "./dungeonsFS";
import { matchObjects, matchObjectsBiome, getObjectFromTileset, getTileSizeFromTileset, isRgbaEqual, ObjectTileMatchType } from "./tilesetMatch";
import { TilesetJson, ObjectTile, ObjectFullMatchType, LayerTileMatchType, FullTileMatchType, TilesetMiscJson, ObjectJson, RgbaValueType, ObjectBrushType, NpcMatchType, ModMatchType, StagehandMatchType } from "./tilesetMatch";
import { FullObjectMap } from "./conversionSteps";
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
  "mods",
  "stagehands",
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
  color?: string; //HEX color
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

interface SbNpc extends SbObjectgroupItem {
  readonly height: 8, 
  readonly width:8,
  properties: {
    npc?: string,
    monster?: string,
    typeName?: string,
    parameters?: string,
  },
}

interface SbMod extends SbObjectgroupItem {
  readonly height: 8,
  properties: {
    mod: string, //name of mod to apply to tile
    surface: number, //surfaceGid of underlying tile
  },
}

interface SbStagehand extends SbObjectgroupItem {
  properties: {
    stagehand: "questlocation"|"objecttracker",
    parameters?: string, //{locationType:"%LocationRefForQuest%"}
  }
}

interface SbWire extends SbObjectgroupItem {
  readonly height: 0,
  readonly width: 0,
  polyline:[
    { x: number, y: number }, 
    { x: number, y: number }
  ],
  readonly properties: {},
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
  SBNPC: {
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

interface SbNpcLayer extends SbObjectgroupLayer {
  readonly name: "monsters & npcs",
  objects: SbNpc[],
}

interface SbModLayer extends SbObjectgroupLayer {
  readonly name: "mods",
  objects: SbMod[],
}

interface SbStagehandLayer extends SbObjectgroupLayer {
  readonly name: "stagehands",
  objects: SbStagehand[],
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
  #targetName: string; //debug, do not export to result file!
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
  
  constructor(tilesetShapes:TilesetShape[], targetName: string) {
    this.#tilesets = tilesetShapes;
    this.#targetName = targetName;
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
  async addTilesetShape(tileset: TilesetJson, log = false): Promise<SbDungeonChunk> {
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

  #mergeLayerData(baseLayerData: number[], mergeLayerData: number[], matchMap: LayerTileMatchType[]):number[] {
    if(baseLayerData.length !== mergeLayerData.length) {
      throw new Error(`Cannot merge Tilelayers: size mismatch!`)
    }

    let threwWarning = false;

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
          const coords = this.getCoordsFromFlatRgbaArray(pixelN, this.#width);

          const GidOld = baseLayerData[pixelN];
          const GidNew = mergeLayerData[pixelN];    
          const oldRules: string[]|undefined = matchMap.find((match) => match.tileGid === GidOld)?.rules;

          if(GidOld === 0 || (oldRules !== undefined && oldRules.flat().includes("allowOverdrawing"))) {
            baseLayerData[pixelN] = mergeLayerData[pixelN]; //merge
            continue;
          }       
        }
      }
      else {
        //baselayer tile is neither MPP or 0
        if(mergeLayerData[pixelN] !== magicPinkBrushGid && mergeLayerData[pixelN] !== 0) {
          const coords = this.getCoordsFromFlatRgbaArray(pixelN, this.#width);
          const GidOld = baseLayerData[pixelN];
          const oldRules: string[]|undefined = matchMap.find((match) => match.tileGid === GidOld)?.rules;
          const GidNew = mergeLayerData[pixelN];
          if(GidOld === GidNew ) {
            continue;
            
            if(threwWarning === false) {
              console.warn(`  WARNING: Merging layers both have equal non-empty values at pixel ${pixelN}, coords X ${coords?.x}, Y ${coords?.y}
              While technically not an error, object PNGs usually do not contain tiles that overwrite front tilelayer tiles.
              Original tiles from front tilelayer will be saved, similar tiles from objects PNG will be ignored.
              This is a one-per-file warning.`);
              threwWarning = true;
              continue; //skip to next pixel
            }
            else {
              continue;
            }
          }
          else {
            //GidOld !== GidNew
            if(oldRules !== undefined && oldRules.flat().includes("allowOverdrawing")) {
              baseLayerData[pixelN] = mergeLayerData[pixelN]; //merge
              continue;
            }
            else {
              throw new Error(`Merging layers both have *different* non-empty values at pixel ${pixelN}, coords X ${coords?.x}, Y ${coords?.y}, and allowOverdrawing is false`);
            }
          }

         
        }
      }
    }
    return baseLayerData;
  }

  mergeTilelayers(frontLayerData: number[], backLayerData: number[], matchMap: FullTileMatchType, log = false):SbDungeonChunk {
    if (log) {
      console.log(`  - merging tilelayers from objects.png`);
    }
    const frontIndex = this.#getLayerIndexByName("front");
    const backIndex = this.#getLayerIndexByName("back");

    if(frontIndex === undefined || backIndex === undefined) {
      throw new Error("Cannot merge: original chunk lacks tilelayers!");
    }

    if(typeof (this.#layers[frontIndex] as SbTilelayer).data === "string" || typeof (this.#layers[backIndex] as SbTilelayer).data === "string") {
      throw new Error(`Cannot merge into encoded tilelayer ${frontIndex}!`);
    }
    
    this.#mergeLayerData((this.#layers[frontIndex] as SbTilelayer).data as Array<number>, frontLayerData, matchMap.front);
    this.#mergeLayerData((this.#layers[backIndex] as SbTilelayer).data as Array<number>, backLayerData, matchMap.back);
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

    let color;
    switch (layerName) {
      case "monsters & npcs": {
        color = "#ff0000"; //red
        break;
      }
      case "wiring - lights & guns": {
        color = "#ffff00"; //yellow
        break;
      }
      case "wiring - locked door": {
        color = "#00ffff"; //light blue
        break;
      }
      case "mods": {
        color = "#5555ff"; //purple
        break;
      }
      default: {
        color = undefined;
        }
    };

    const newObjectLayer: SbObjectgroupLayer = {
      color,
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

  /**
   * Searches layer by name.
   * @param layerName
   * @returns index or false if no matching layer found
   */
  isLayerExist(layerName:typeof OBJECTLAYERS[number]):number|false {
    for(const layer of this.#layers) {
      if(layer.name === layerName) {
        return layer.id;
      }
    }
    return false;
  }

  /**
   * Compares objects by Gid, coords and properties
   * @param object1 
   * @param object2 
   * @returns 
   */
  #isObjectExist(object1:SbObjectgroupItem, object2: SbObjectgroupItem):boolean {
    const equalCoords = object1.x === object2.x && object1.y === object2.y;
    const equalGids = (object1 as SbObject).gid === (object2 as SbObject).gid;
    const equalProps = JSON.stringify((object1 as SbObject).properties) === JSON.stringify((object2 as SbObject).properties);

    if(equalCoords && equalGids && equalProps) {
      return true;
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
  addAnchorToLayer(anchorGid: number, pngX: number, pngY: number): SbDungeonChunk {
    const layerIndex: number = this.#initObjectLayer("anchors etc") - 1; //layer Ids in Sb start from 1
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
    //check to avoid adding doubles
    for(const anchor of (this.#layers[layerIndex] as SbObjectgroupLayer).objects) {
      if(this.#isObjectExist(anchor, newAnchor)) {
        return this;
      }
    }
    (this.#layers[layerIndex] as SbAnchorLayer).objects.push(newAnchor);
    this.#nextobjectid = this.#nextobjectid +1;
    return this;
  }

  parseAnchors(rgbaArray: RgbaValueType[], anchorsMatchMap: LayerTileMatchType[], log = false):SbDungeonChunk {
    if (log) {
      console.log(`  - adding anchors`);
    }

    for (let rgbaN = 0; rgbaN < rgbaArray.length; rgbaN++) {
      for (const match of anchorsMatchMap) {
        if (match!== undefined && isRgbaEqual(rgbaArray[rgbaN], match.tileRgba)) {
          const gid = match.tileGid;
          const { x: anchorX, y: anchorY } = this.getCoordsFromFlatRgbaArray(rgbaN, this.#width);
          this.addAnchorToLayer(gid, anchorX, anchorY);
        }
      }
    }
    
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
  addObjectToLayer(objectGid: number, height: number, width: number, x: number, y: number, properties: {parameters:any}|{} = {}): number {
    const layerIndex = this.#initObjectLayer("objects") - 1; //layer Ids in Sb start from 1

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
    //check to avoid adding doubles
    for(const obj of (this.#layers[layerIndex] as SbObjectgroupLayer).objects) {
      if(this.#isObjectExist(obj, newObject)) {
        return layerIndex+1;
      }
    }
    
    const objLayer: SbObjectLayer = this.#layers[layerIndex] as SbObjectLayer;
    objLayer.objects.push(newObject);
    this.#nextobjectid = this.#nextobjectid +1;
    return layerIndex;
  }

  /**
   * Add shapes for object tilesets in SbDungeonChunk. Required before adding objects from these tilesets.
   * @param tilesets - array of names for tilesets to add
   * @returns 
   */
  async addObjectTilesetShapes(tilesets: string[], log = false): Promise<SbDungeonChunk> {
    if (log) {
      console.log(`  - injecting object tilesets`);
    }
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

  /*
  convertIdMapToGid(objMatchMap: FullObjectMap):(ObjectFullMatchType|undefined)[] {
    const idMap = objMatchMap.matchMap;

    const GidMap: (ObjectFullMatchType | undefined)[] = idMap.map((idMatch) => {
      if (idMatch === undefined) {
        return undefined;
      }

      this.getFirstGid(idMatch.tileset);

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
  */

  convertObjectIdToGid(tileIdMatch: ObjectTileMatchType|undefined):ObjectFullMatchType|undefined {
    if(tileIdMatch === undefined) {
      return undefined;
    }

    const firstGid = this.getFirstGid(tileIdMatch.tileset);
    const { tileName, tileRgba, tileId, tileIdVariations, tileset } = tileIdMatch;
    const variations = tileIdVariations.filter((option)=> option.tileset === tileset);
    if(variations.length > 1) {
      const a = 0;
      //TODO heuristics to select variation here
    }
    //Apply flip here if present
    const assumedGid = variations.length>1? tileIdMatch.tileId + firstGid : GidFlags.apply( tileIdMatch.tileId + firstGid, false, tileIdMatch.flipHorizontal || false, false); //if there are variations available, do not apply flip to Gid

    const gidMatch: ObjectFullMatchType = {
      tileName,
      tileRgba,
      tileId,
      tileIdVariations: variations.map((variation) => variation.id + firstGid),
      tileGid: assumedGid,
      tileset: tileIdMatch.tileset,
    };
    return gidMatch;
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

  async parseObjects(oldObjects:ObjectTile[], rgbaArray: RgbaValueType[], objMatchMap: FullObjectMap, log = false): Promise<SbDungeonChunk> {
    if (log) {
      console.log(`  - adding objects`);
    }

    //Add shapes for object tilesets in SbDungeonChunk
    await this.addObjectTilesetShapes(objMatchMap.tilesets);
    //const objGidMap = this.convertIdMapToGid(objMatchMap);
    //quick check to ensure size of rgbaArray
    if (rgbaArray.length !== this.#height * this.#width) {
      throw new Error(`Unable to add objects from image with ${rgbaArray.length} pixels to a chunk of height ${this.#height} and width ${this.#width}: size mismatch!`)
    }

    const objectsWithOrientations: ObjectFullMatchType[] = [];
  
    for (let rgbaN = 0; rgbaN < rgbaArray.length; rgbaN++) {
      for (const match of objMatchMap.matchMap) {
        const gidMatch: ObjectFullMatchType|undefined = this.convertObjectIdToGid(match);
        if (gidMatch !== undefined) {
          if (isRgbaEqual(gidMatch.tileRgba, rgbaArray[rgbaN]) === false) {
            continue; //skip until we find the right match
          }
          const objectData: ObjectJson = await getObjectFromTileset(gidMatch);
          const oldObjectData = oldObjects.find((objData) => {
            return isRgbaEqual(gidMatch.tileRgba, objData.value);
          });
          
          const tileSize = await getTileSizeFromTileset(gidMatch);
          //TODO calc height, width
          //exchange width with height b/c of difference in XY coords in Sb and Tiled
          const height = tileSize.tilewidth;
          const width = tileSize.tileheight;
          //calc x, y from rgbaArray
          const { x: objX, y: objY } = this.getCoordsFromFlatRgbaArray(rgbaN, this.#width);

          //write parameters. Important: parameters should be stringified!
          const objBrushLayer = oldObjectData?.brush.find((brushLayer) => {
            return brushLayer[0] === "object";
          });
          let params;
          if(objBrushLayer && objBrushLayer[2] !== undefined && objBrushLayer[2].parameters !== undefined) {
            params = {
              parameters: JSON.stringify(objBrushLayer[2].parameters)};
          }
                   
          const spriteShiftX:number = isNaN(parseInt(objectData.imagePositionX))? 0 : parseInt(objectData.imagePositionX);
          const spriteShiftY:number = isNaN(parseInt(objectData.imagePositionY))? 0 : parseInt(objectData.imagePositionY);
          //Add object
          //Y + 1 because of difference in coords in Sb and Tiled (coords of pixel are shifted by 1)
          //also remove shift by Y due to reversed axis
          this.addObjectToLayer(
            gidMatch.tileGid, 
            height, 
            width, 
            (objX*this.tilewidth + spriteShiftX), 
            ((objY + 1)*this.tileheight - spriteShiftY), 
            params);
            if(gidMatch.tileIdVariations.length>1) {
              objectsWithOrientations.push(gidMatch);
            }
        }
      }
    }
    //dump objectsWithOrientations here
    if(objectsWithOrientations.length > 0) {
      await writeObjectVariationsDump(this.#targetName, objectsWithOrientations);
    }
    
    return this;
  }

  #addNpcToLayer(npc: NpcMatchType, x: number, y: number): number {
    const layerId = this.#initObjectLayer("monsters & npcs");

    const newNpc: SbNpc = {
      ...TEMPLATE.SBOBJECT,
      ...TEMPLATE.SBNPC,
      id: this.getNextObjectId(),
      properties: {
        [npc.npcKey]: npc.npcValue,
        typeName: npc.npcKey === "npc" ? npc.typeName : undefined,
        parameters: npc.parameters,
      },
      x,
      y,
    };
    
    const npcLayer: SbNpcLayer = this.#layers.find((layer) => { return layer.id === layerId }) as SbNpcLayer;
    npcLayer.objects.push(newNpc);
    this.#nextobjectid = this.#nextobjectid +1;
    return layerId;
  }

  parseAddNpcs(rgbaArray: RgbaValueType[], npcMap: NpcMatchType[], log = false): SbDungeonChunk {
    //quick check to ensure size of rgbaArray
    if (rgbaArray.length !== this.#height * this.#width) {
      throw new Error(`Unable to parse image with ${rgbaArray.length} pixels to a chunk of height ${this.#height} and width ${this.#width}: size mismatch!`)
    }

    if (log) {
      console.log(`  - adding NPCs`);
    }
  
    for (let rgbaN = 0; rgbaN < rgbaArray.length; rgbaN++) {
      for (const match of npcMap) {
        if (match !== undefined) {
          if (isRgbaEqual(match.tileRgba, rgbaArray[rgbaN]) === false) {
            continue; //skip until we find the right match
          }
          //calc x, y from rgbaArray
          const { x: objX, y: objY } = this.getCoordsFromFlatRgbaArray(rgbaN, this.#width);
                   
          //Add NPC or monster
          //Y + 1 because of difference in coords in Sb and Tiled (Y unchanged to make NPCs spawn 1 block up in the air)
          this.#addNpcToLayer(match, (objX*this.tilewidth), (objY*this.tileheight));
        }
      }
    }
    return this;
  }

  /**
   * Util function to try and find previous mod at this row (i.e. with the same y and 0 < ??? < x)
   * Returns undefined only when there are no mods of ANY kind to the left of x
   * @param x - max position at row until which to search
   * @param y - coord of row
   * @returns 
   */
  #findPrevModAtLayer(x: number, y: number): SbMod|undefined {
    const layerId = this.#initObjectLayer("mods");
    const modLayer: SbModLayer = this.#layers.find((layer) => { return layer.id === layerId }) as SbModLayer;
    
    for (let tileNum = x; tileNum >= 0; tileNum = tileNum-this.tilewidth) {
      const foundMod = modLayer.objects.find((mod) => {
        return (mod.x === tileNum && mod.y === y);
      });
      if (foundMod !== undefined) {
        return foundMod;
      }
    }

    return undefined;
  }

  #addModToLayer(mod: ModMatchType, x: number, y: number): number {
    const layerId = this.#initObjectLayer("mods");
    const modLayer: SbModLayer = this.#layers.find((layer) => { return layer.id === layerId }) as SbModLayer;

    const newMod: SbMod = {
      ...TEMPLATE.SBOBJECT,
      id: this.getNextObjectId(),
      height: 8,
      width: 8, //change to merge mods horizontally!
      properties: {
        mod: mod.mod,
        surface: mod.tileGid,
      },
      x,
      y,
    };
    
    const modAtLeft = this.#findPrevModAtLayer(x - this.tilewidth, y);
    if (modAtLeft !== undefined && modAtLeft.properties.mod === newMod.properties.mod && (modAtLeft.x + modAtLeft.width === newMod.x)) {
      modAtLeft.width = modAtLeft.width + this.tilewidth; //if mod to the left is the same -simply increase its width by 1 tilewidth
      return layerId;
    }
    else {
      modLayer.objects.push(newMod);
      this.#nextobjectid = this.#nextobjectid +1;
      return layerId;
    }
  }

  parseMods(rgbaArray: RgbaValueType[], modMap: ModMatchType[], log = false): SbDungeonChunk {
    if (rgbaArray.length !== this.#height * this.#width) {
      throw new Error(`Unable to parse image with ${rgbaArray.length} pixels to a chunk of height ${this.#height} and width ${this.#width}: size mismatch!`)
    }

    if (log) {
      console.log(`  - adding modded terrain regions`);
    }

    for (let rgbaN = 0; rgbaN < rgbaArray.length; rgbaN++) {
      for (const match of modMap) {
        if (match !== undefined) {
          if (isRgbaEqual(match.tileRgba, rgbaArray[rgbaN]) === false) {
            continue; //skip until we find the right match
          }
          //calc x, y from rgbaArray
          const { x: objX, y: objY } = this.getCoordsFromFlatRgbaArray(rgbaN, this.#width);
                   
          //Add mod
          this.#addModToLayer(match, (objX*this.tilewidth), (objY*this.tileheight));
        }
      }
    }

    return this;
  }

  #addStagehand(stagehand: StagehandMatchType, x: number, y: number): number {
    const layerId = this.#initObjectLayer("stagehands");
    const stagehandLayer: SbStagehandLayer = this.#layers.find((layer) => { return layer.id === layerId }) as SbStagehandLayer;

    //remove shift by Y due to reversed axis
    const newStagehand: SbStagehand = {
      ...TEMPLATE.SBOBJECT,
      id: this.getNextObjectId(),
      height: (stagehand.broadcastArea[3] - stagehand.broadcastArea[1])*this.tileheight,
      width: (stagehand.broadcastArea[2] - stagehand.broadcastArea[0])*this.tilewidth,
      properties: {
        stagehand: stagehand.stagehand,
        parameters: stagehand.nameParam?JSON.stringify(stagehand.nameParam):undefined,
      },
      x: (x + stagehand.broadcastArea[0] * this.tilewidth),
      y: (y - stagehand.broadcastArea[3] * this.tileheight),
    };
    
    stagehandLayer.objects.push(newStagehand);
    this.#nextobjectid = this.#nextobjectid +1;
    return layerId;
  }

  setSize(width:number, height:number):SbDungeonChunk {
    this.#height = height;
    this.#width = width;
    return this;
  }

  parseStagehands(rgbaArray: RgbaValueType[], stagehandMap: StagehandMatchType[], log = false): SbDungeonChunk {
    if (rgbaArray.length !== this.#height * this.#width) {
      throw new Error(`Unable to parse image with ${rgbaArray.length} pixels to a chunk of height ${this.#height} and width ${this.#width}: size mismatch!`)
    }

    if (log) {
      console.log(`  - adding stagehands`);
    }

    for (let rgbaN = 0; rgbaN < rgbaArray.length; rgbaN++) {
      for (const match of stagehandMap) {
        if (match !== undefined) {
          if (isRgbaEqual(match.tileRgba, rgbaArray[rgbaN]) === false) {
            continue; //skip until we find the right match
          }
          //calc x, y from rgbaArray
          const { x: objX, y: objY } = this.getCoordsFromFlatRgbaArray(rgbaN, this.#width);
                   
          //Add mod
          this.#addStagehand(match, (objX*this.tilewidth), (objY*this.tileheight));
        }
      }
    }

    return this;
  }

  //Add back private fields explicitly! Serialize via JSON.stringify to store as file.
  //ignore #targetName
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


