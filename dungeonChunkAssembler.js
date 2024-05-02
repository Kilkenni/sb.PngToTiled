var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _SbDungeonChunk_height, _SbDungeonChunk_layers, _SbDungeonChunk_nextlayerid, _SbDungeonChunk_nextobjectid, _SbDungeonChunk_properties, _SbDungeonChunk_tilesets, _SbDungeonChunk_width;
;
;
class SbDungeonChunk /*implements DungeonChunk */ {
    constructor(tilesetShapes) {
        this.backgroundcolor = "#000000";
        // #compressionlevel:number = -1;
        _SbDungeonChunk_height.set(this, 10);
        this.infinite = false;
        _SbDungeonChunk_layers.set(this, []);
        _SbDungeonChunk_nextlayerid.set(this, 1);
        _SbDungeonChunk_nextobjectid.set(this, 1);
        this.orientation = "orthogonal";
        _SbDungeonChunk_properties.set(this, {});
        this.renderorder = "right-down";
        this.tileheight = 8;
        _SbDungeonChunk_tilesets.set(this, []);
        this.tilewidth = 8;
        this.type = "map";
        this.version = 1;
        _SbDungeonChunk_width.set(this, 10);
        __classPrivateFieldSet(this, _SbDungeonChunk_tilesets, tilesetShapes, "f");
    }
    addUncompressedTileLayer(layerData, layerName, layerWidth, layerHeight) {
        const newLayer = {
            data: layerData,
            name: layerName,
            opacity: (layerName === "front") ? 1.0 : 0.5,
            height: layerHeight,
            width: layerWidth,
            id: __classPrivateFieldGet(this, _SbDungeonChunk_nextlayerid, "f"),
            // locked: false,
            type: "tilelayer",
            visible: true,
            x: 0,
            y: 0
        };
        //id and name must be unique!
        for (const layer of __classPrivateFieldGet(this, _SbDungeonChunk_layers, "f")) {
            if (layer.name === newLayer.name) {
                throw new Error(`Unable to add new layer: layer with name ${layer.name} already exists.`);
            }
        }
        __classPrivateFieldGet(this, _SbDungeonChunk_layers, "f").push(newLayer);
        __classPrivateFieldSet(this, _SbDungeonChunk_nextlayerid, __classPrivateFieldGet(this, _SbDungeonChunk_nextlayerid, "f") + 1, "f");
        return this;
    }
    getNextObjectId() {
        return __classPrivateFieldGet(this, _SbDungeonChunk_nextobjectid, "f");
    }
    setSize(width, height) {
        __classPrivateFieldSet(this, _SbDungeonChunk_height, height, "f");
        __classPrivateFieldSet(this, _SbDungeonChunk_width, width, "f");
        return this;
    }
    //Add back private fields explicitly! Serialize via JSON.stringify to store as file.
    toJSON() {
        return Object.assign(Object.assign({}, this), { height: __classPrivateFieldGet(this, _SbDungeonChunk_height, "f"), layers: __classPrivateFieldGet(this, _SbDungeonChunk_layers, "f"), nextlayerid: __classPrivateFieldGet(this, _SbDungeonChunk_nextlayerid, "f"), nextobjectid: __classPrivateFieldGet(this, _SbDungeonChunk_nextobjectid, "f"), properties: __classPrivateFieldGet(this, _SbDungeonChunk_properties, "f"), tilesets: __classPrivateFieldGet(this, _SbDungeonChunk_tilesets, "f"), width: __classPrivateFieldGet(this, _SbDungeonChunk_width, "f") });
    }
}
_SbDungeonChunk_height = new WeakMap(), _SbDungeonChunk_layers = new WeakMap(), _SbDungeonChunk_nextlayerid = new WeakMap(), _SbDungeonChunk_nextobjectid = new WeakMap(), _SbDungeonChunk_properties = new WeakMap(), _SbDungeonChunk_tilesets = new WeakMap(), _SbDungeonChunk_width = new WeakMap();
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
export { SbDungeonChunk, };
//# sourceMappingURL=dungeonChunkAssembler.js.map