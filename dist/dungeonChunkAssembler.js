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
var _SbDungeonChunk_instances, _SbDungeonChunk_height, _SbDungeonChunk_layers, _SbDungeonChunk_nextlayerid, _SbDungeonChunk_nextobjectid, _SbDungeonChunk_properties, _SbDungeonChunk_tilesets, _SbDungeonChunk_width, _SbDungeonChunk_getLayerIndexByName, _SbDungeonChunk_mergeLayerData, _SbDungeonChunk_initObjectLayer;
import { TILESETJSON_NAME } from "./tilesetMatch.js";
import GidFlags from "./GidFlags.js";
;
;
const OBJECTLAYERS = [
    "anchors etc",
    "outside the map",
    "wiring - locked door",
    "monsters & npcs",
    "wiring - lights & guns",
    "objects",
    "mods"
];
class SbDungeonChunk {
    constructor(tilesetShapes) {
        _SbDungeonChunk_instances.add(this);
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
    addBothTilelayers(frontLayerData, backLayerData, layerWidth, layerHeight) {
        this.addUncompressedTileLayer(backLayerData, "back", layerWidth, layerHeight);
        this.addUncompressedTileLayer(frontLayerData, "front", layerWidth, layerHeight);
        return this;
    }
    mergeTilelayers(frontLayerData, backLayerData) {
        const frontIndex = __classPrivateFieldGet(this, _SbDungeonChunk_instances, "m", _SbDungeonChunk_getLayerIndexByName).call(this, "front");
        const backIndex = __classPrivateFieldGet(this, _SbDungeonChunk_instances, "m", _SbDungeonChunk_getLayerIndexByName).call(this, "back");
        if (!frontIndex || !backIndex) {
            throw new Error("Cannot merge: original chunk lacks tilelayers!");
        }
        if (typeof __classPrivateFieldGet(this, _SbDungeonChunk_layers, "f")[frontIndex].data === "string" || typeof __classPrivateFieldGet(this, _SbDungeonChunk_layers, "f")[backIndex].data === "string") {
            throw new Error(`Cannot merge into encoded tilelayer ${frontIndex}!`);
        }
        __classPrivateFieldGet(this, _SbDungeonChunk_instances, "m", _SbDungeonChunk_mergeLayerData).call(this, __classPrivateFieldGet(this, _SbDungeonChunk_layers, "f")[frontIndex].data, frontLayerData);
        __classPrivateFieldGet(this, _SbDungeonChunk_instances, "m", _SbDungeonChunk_mergeLayerData).call(this, __classPrivateFieldGet(this, _SbDungeonChunk_layers, "f")[backIndex].data, backLayerData);
        return this;
    }
    isLayerExist(layerName) {
        for (const layer of __classPrivateFieldGet(this, _SbDungeonChunk_layers, "f")) {
            if (layer.name === layerName) {
                return layer.id;
            }
        }
        return false;
    }
    addAnchorToObjectLayer(anchorGid, pngX, pngY) {
        const layerId = __classPrivateFieldGet(this, _SbDungeonChunk_instances, "m", _SbDungeonChunk_initObjectLayer).call(this, "anchors etc") - 1; //layers in Sb start from 1
        const newAnchor = {
            gid: anchorGid,
            id: this.getNextObjectId(),
            name: "",
            type: "",
            height: 8,
            width: 8,
            rotation: 0,
            visible: true,
            x: pngX * 8,
            y: (pngY + 1) * 8, //shift coordinates because Sb uses bottom-left corner as zero while normal programs use top-left
        };
        __classPrivateFieldGet(this, _SbDungeonChunk_layers, "f")[layerId].objects.push(newAnchor);
        __classPrivateFieldSet(this, _SbDungeonChunk_nextobjectid, __classPrivateFieldGet(this, _SbDungeonChunk_nextobjectid, "f") + 1, "f");
        return this;
    }
    getNextObjectId() {
        return __classPrivateFieldGet(this, _SbDungeonChunk_nextobjectid, "f");
    }
    getFirstGid(tilesetName) {
        const tsShape = __classPrivateFieldGet(this, _SbDungeonChunk_tilesets, "f").find((shape) => shape.source.includes(`${tilesetName}.json`));
        if (tsShape) {
            return tsShape.firstgid;
        }
        return undefined;
    }
    setSize(width, height) {
        __classPrivateFieldSet(this, _SbDungeonChunk_height, height, "f");
        __classPrivateFieldSet(this, _SbDungeonChunk_width, width, "f");
        return this;
    }
    //Add back private fields explicitly! Serialize via JSON.stringify to store as file.
    toJSON() {
        return {
            ...this,
            height: __classPrivateFieldGet(this, _SbDungeonChunk_height, "f"),
            layers: __classPrivateFieldGet(this, _SbDungeonChunk_layers, "f"),
            nextlayerid: __classPrivateFieldGet(this, _SbDungeonChunk_nextlayerid, "f"),
            nextobjectid: __classPrivateFieldGet(this, _SbDungeonChunk_nextobjectid, "f"),
            properties: __classPrivateFieldGet(this, _SbDungeonChunk_properties, "f"),
            tilesets: __classPrivateFieldGet(this, _SbDungeonChunk_tilesets, "f"),
            width: __classPrivateFieldGet(this, _SbDungeonChunk_width, "f")
        };
    }
}
_SbDungeonChunk_height = new WeakMap(), _SbDungeonChunk_layers = new WeakMap(), _SbDungeonChunk_nextlayerid = new WeakMap(), _SbDungeonChunk_nextobjectid = new WeakMap(), _SbDungeonChunk_properties = new WeakMap(), _SbDungeonChunk_tilesets = new WeakMap(), _SbDungeonChunk_width = new WeakMap(), _SbDungeonChunk_instances = new WeakSet(), _SbDungeonChunk_getLayerIndexByName = function _SbDungeonChunk_getLayerIndexByName(layerName) {
    for (let layerIndex = 0; layerIndex < __classPrivateFieldGet(this, _SbDungeonChunk_layers, "f").length; layerIndex++) {
        if (layerName === __classPrivateFieldGet(this, _SbDungeonChunk_layers, "f")[layerIndex].name) {
            return layerIndex;
        }
    }
    return;
}, _SbDungeonChunk_mergeLayerData = function _SbDungeonChunk_mergeLayerData(baseLayerData, mergeLayerData) {
    if (baseLayerData.length !== mergeLayerData.length) {
        throw new Error(`Cannot merge Tilelayers: size mismatch!`);
    }
    const miscFirstGid = this.getFirstGid(TILESETJSON_NAME.misc);
    if (!miscFirstGid) {
        throw new Error(`Cannot find ${TILESETJSON_NAME.misc} tileset in chunk tileset shapes`);
    }
    const magicPinkBrushGid = GidFlags.apply(miscFirstGid + 1, false, true, false); //MPP is 2nd in tileset + Horiz flip
    for (let pixelN = 0; pixelN < baseLayerData.length; pixelN++) {
        if (baseLayerData[pixelN] === magicPinkBrushGid) {
            if (baseLayerData[pixelN] === magicPinkBrushGid) {
                continue; //both layers have MPP in pixel, skip
            }
            else {
                baseLayerData[pixelN] = mergeLayerData[pixelN]; //merge
            }
        }
        else {
            if (mergeLayerData[pixelN] != magicPinkBrushGid) {
                throw new Error(`Merging layers both have non-empty values at pixel ${pixelN}`);
            }
        }
    }
    return baseLayerData;
}, _SbDungeonChunk_initObjectLayer = function _SbDungeonChunk_initObjectLayer(layerName) {
    const layerId = this.isLayerExist(layerName);
    if (layerId != false) {
        return layerId; //already initiated
    }
    const newObjectLayer = {
        draworder: "topdown",
        name: layerName,
        id: __classPrivateFieldGet(this, _SbDungeonChunk_nextlayerid, "f"),
        objects: [],
        opacity: 1,
        type: "objectgroup",
        visible: true,
        x: 0,
        y: 0
    };
    __classPrivateFieldGet(this, _SbDungeonChunk_layers, "f").push(newObjectLayer);
    __classPrivateFieldSet(this, _SbDungeonChunk_nextlayerid, __classPrivateFieldGet(this, _SbDungeonChunk_nextlayerid, "f") + 1, "f");
    return __classPrivateFieldGet(this, _SbDungeonChunk_nextlayerid, "f") - 1;
};
export { SbDungeonChunk, };
//# sourceMappingURL=dungeonChunkAssembler.js.map