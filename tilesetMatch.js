var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { promises as nodeFS } from "fs";
import * as nodePath from "path";
import * as zlib from "zlib";
;
const TILESETJSON_NAME = {
    materials: "materials",
    supports: "supports",
    liquids: "liquids",
    misc: "miscellaneous",
};
const MISCJSON_MAP = [
    "Air", //0 - is it ever used?
    "Magic Pink Brush", //1 - back
    "Invisible wall (boundary)", //2 - front (only for quests)
    "Player Start", //3 --> anchors etc
    "worldGenMustContainAir", //4 --> anchors etc
    "worldGenMustContainSolid", //5 --> anchors etc
    "Biome Item", //6 --> objects
    "Biome Tree", //7 --> objects
    "Default Surface Tile 0", //8 - front/back
    "Default Surface Tile 1", //9 - front/back
    "Default Surface Tile 2", //10 - front/back
    "Air (overwritable)", //11 -is it ever used?
    "Red Connector", //12 --> anchors etc
    "Yellow Connector", //13 --> anchors etc
    "Green Connector", //14 --> anchors etc
    "Blue Connector", //15 --> anchors etc
    "worldGenMustContainAir (background)", //16 --> anchors etc
    "worldGenMustContainSolid (background)", //17 --> anchors etc
    "Invisible wall (climbable)", //18 - front (only for quests)
    "Underwater invisible wall (boundary)", //19 - front (only for quests)
    "Zero G", //20 --> front, but can be ignored? Probably no space maps in old format
    "Zero G (protected)", //21 --> front, but can be ignored? Probably no space maps in old format
    "worldGenMustContainLiquid (ocean)", //22 --> anchors etc
    "worldGenMustNotContainLiquid (ocean)" //23 --> anchors etc
]; //index = tile #
const ANCHORS = [
    "worldGenMustContainSolidBackground",
    "worldGenMustContainAirBackground",
    "worldGenMustContainAirForeground"
];
//determine paths to tilesets for mapping PNG
function resolveTilesets() {
    const matPath = nodePath.resolve("./input-output/tilesets/packed/materials.json");
    const pathToTileset = matPath.substring(0, matPath.lastIndexOf("/"));
    return pathToTileset;
}
function calcNewTilesetShapes() {
    return __awaiter(this, arguments, void 0, function* (log = false) {
        const path = resolveTilesets();
        const TILESETS = [
            ///blocks
            TILESETJSON_NAME.materials,
            TILESETJSON_NAME.supports,
            TILESETJSON_NAME.liquids,
            TILESETJSON_NAME.misc,
            //TODO other tilesets for objects
        ];
        let startGID = 1;
        const tilesetsArray = [];
        for (const tilesetName of TILESETS) {
            const currentTsPath = `${path}/${tilesetName}.json`;
            const tilesetShape = {
                firstgid: startGID,
                source: currentTsPath // `${currentTsPath.replace(/\//g, "\/")}`, //RegEx is useless since JSON.stringify either loses backslash or doubles it
            };
            const currentTileset = JSON.parse((yield nodeFS.readFile(currentTsPath)).toString("utf8"));
            // console.log(currentTileset)
            startGID = startGID + currentTileset.tilecount; //increase GID by size of current tileset
            tilesetsArray.push(tilesetShape);
        }
        if (log) {
            console.log(tilesetsArray);
        }
        return tilesetsArray;
    });
}
function getSortedTileset(arrayOfOldTiles) {
    const oldTiles = {
        foreground: [],
        background: [],
        specialforeground: [],
        specialbackground: [],
        special: [],
        anchors: [],
        wires: [],
        stagehands: [],
        npcs: [],
        objects: [],
        undefined: [],
    };
    for (const tile of arrayOfOldTiles) {
        if (tile.connector === true) {
            oldTiles.anchors.push(tile);
            continue;
        }
        if (tile.rules) {
            const ruleMatch = tile.rules.flat(3).filter((ruleString) => {
                return ANCHORS.includes(ruleString);
            });
            if (ruleMatch.length === 1) {
                oldTiles.anchors.push(tile);
                continue;
            }
        }
        if (tile.brush === undefined) {
            oldTiles.special.push(tile); //if there is no brush at all, probably a Special tile
            continue;
        }
        else {
            //first, consistency expectation checks
            if (tile.brush.length > 1) {
                if (tile.brush[0][0] != "clear") {
                    console.log(`Error, tile brush of size ${tile.brush.length} contains ${tile.brush}, first slot is not "clear". Skipping tile`);
                    continue; //NEXT TILE
                }
            }
            for (const brush of tile.brush) {
                switch (brush[0]) {
                    case "clear":
                        if (tile.brush.length === 1) {
                            oldTiles.special.push(tile); //brush contains 1 "clear" element > special tile
                        }
                        break; //otherwise skip
                    case "biometree":
                    case "biomeitems":
                        oldTiles.objects.push(tile);
                        break;
                    case "playerstart":
                        oldTiles.anchors.push(tile);
                        break;
                    case "surface":
                        if (tile.comment.toLowerCase().includes("biome tile brush")) {
                            oldTiles.specialbackground.push(tile); //for biome tile brush duplicate to background, as it is often setup incorrectly in old tileset
                        }
                        oldTiles.specialforeground.push(tile);
                        break;
                    case "surfacebackground":
                        oldTiles.specialbackground.push(tile);
                        break;
                    case "wire":
                        oldTiles.wires.push(tile);
                        break;
                    case "stagehand":
                        oldTiles.stagehands.push(tile);
                        break;
                    case "npc":
                        oldTiles.npcs.push(tile);
                        break;
                    case "object":
                        oldTiles.objects.push(tile);
                        break;
                    case "back":
                        oldTiles.background.push(tile);
                        break;
                    case "front":
                    case "liquid": //liquids are foreground-only
                        oldTiles.foreground.push(tile);
                        break;
                    default:
                        oldTiles.undefined.push(tile);
                }
            }
        }
    }
    return oldTiles;
}
//compares explicitly defined tilelayer-related tiles, like foreground/background, liquid etc
function matchTilelayer(oldTilesCategoryArray, newTilesetJSON, layerName, firstgid) {
    if (firstgid < 1) {
        return undefined;
    }
    const matchMap = oldTilesCategoryArray.map((tile) => {
        const { value, comment, brush, rules } = tile;
        //if we match materials, platforms or liquids
        if ([TILESETJSON_NAME.materials, TILESETJSON_NAME.supports, TILESETJSON_NAME.liquids].includes(newTilesetJSON.name)) {
            if (brush === undefined) {
                return;
                //throw new Error(`Tile brush is ${brush}`);
            }
            const newBrushType = (newTilesetJSON.name === TILESETJSON_NAME.liquids) ? "liquid" : "material";
            const oldBrushTypes = [];
            if (layerName === "front") {
                oldBrushTypes.push("front", "liquid");
            }
            else if (layerName === "back") {
                oldBrushTypes.push("back");
            }
            for (const brushLayer of brush) {
                const [brushType, brushMaterial] = brushLayer;
                if (oldBrushTypes.includes(brushType)) {
                    for (const materialIndex in newTilesetJSON.tileproperties) {
                        const material = newTilesetJSON.tileproperties[materialIndex][newBrushType];
                        if (material === brushMaterial) {
                            return { tileName: brushMaterial, tileRgba: value, tileGid: (parseInt(materialIndex) + firstgid) };
                        }
                    }
                }
            }
        }
        //Misc tileset
        else if (newTilesetJSON.name === TILESETJSON_NAME.misc) {
            //if we have bkg tile, but search for front layer, or VV - skip
            if (layerName === "front" && brush && brush.flat(1).includes("surfacebackground") ||
                layerName === "back" && brush && brush.flat(1).includes("surface") && !comment.toLowerCase().includes("biome tile brush")) {
                return;
            }
            //if we have special tile, but search for front layer - skip
            if (layerName === "front" && (comment.toLowerCase().includes("magic pink") ||
                brush.length === 1 && brush.flat(1)[0] === "clear")) {
                return;
            }
            /*
            SPECIAL - BKG:
            1 = comment: "magic pinkppp, a no-op value"
            0 = brush:["clear"], comment:"Empty hole"
            11 = brush:["clear"], comment:"Empty hole overwritable" */
            //Magic Pink Brush #1
            if (comment.toLowerCase().includes("magic pink")) {
                return { tileName: "magic pink", tileRgba: value, tileGid: 1 + firstgid };
            }
            if (brush && brush.length === 1 && brush.flat(1)[0] === "clear") {
                //Empty hole overwritable #11
                if (comment.toLowerCase().includes("empty hole") && rules &&
                    rules.flat(2).includes("allowOverwriting")) {
                    return { tileName: "empty hole overwritable", tileRgba: value, tileGid: 11 + firstgid };
                }
                //Empty hole #0
                if (comment.toLowerCase().includes("empty hole")) {
                    return { tileName: "empty hole overwritable", tileRgba: value, tileGid: 0 + firstgid };
                }
            }
            if (brush) {
                for (const brushLayer of brush) {
                    const [brushType, options] = brushLayer;
                    if (brushType === "surface") {
                        /*
                          SPECIALFRONT
                          ??? = brush: ["surface"]
                          ??? = brush: ["surface"], rules: [["allowOverdrawing"]]
                          8 = brush:["surface",{variant: 0}]
                          8 = brush:["surface",{variant: 0}], rules: [["allowOverdrawing"]]
                          9 = brush:["surface",{variant: 1}]
                          9 = brush:["surface",{variant: 1}], rules: [["allowOverdrawing"]]
                          10 = brush:["surface",{variant: 2}]
                          10 = brush:["surface",{variant: 2}], rules: [["allowOverdrawing"]]
                        */
                        if (options && options.variant) {
                            switch (options.variant) {
                                case 0:
                                    return { tileName: "surface #0", tileRgba: value, tileGid: 8 + firstgid };
                                case 1:
                                    return { tileName: "surface #1", tileRgba: value, tileGid: 9 + firstgid };
                                case 2:
                                    return { tileName: "surface #2", tileRgba: value, tileGid: 10 + firstgid };
                            }
                        }
                        else {
                            return { tileName: "surface", tileRgba: value, tileGid: 8 + firstgid };
                        }
                    }
                    else if (brushType === "surfacebackground") {
                        /*
                        SPECIALBKG
                        ??? = brush:["surfacebackground"]
                        8 = brush:["surfacebackground",{variant: 0}]
                        8 = brush:["surfacebackground",{variant: 0}], rules: [["allowOverdrawing"]]
                        9 = brush:["surfacebackground",{variant: 1}]
                        9 = brush:["surfacebackground",{variant: 1}], rules: [["allowOverdrawing"]]
                        10 = brush:["surfacebackground",{variant: 2}]
                        10 = brush:["surfacebackground",{variant: 2}], rules: [["allowOverdrawing"]]
                        */
                        if (options && options.variant) {
                            switch (options.variant) {
                                case 0:
                                    return { tileName: "surfacebackground #0", tileRgba: value, tileGid: 8 + firstgid };
                                case 1:
                                    return { tileName: "surfacebackground #1", tileRgba: value, tileGid: 9 + firstgid };
                                case 2:
                                    return { tileName: "surfacebackground #2", tileRgba: value, tileGid: 10 + firstgid };
                            }
                        }
                        else {
                            return { tileName: "surfacebackground", tileRgba: value, tileGid: 8 + firstgid };
                        }
                    }
                }
            }
        }
        /*
        const MISCJSON_MAP = [
          "Magic Pink Brush",                  //1 - back
          "Default Surface Tile 0",            //8 - front/back
          "Default Surface Tile 1",            //9 - front/back
          "Default Surface Tile 2",            //10 - front/back
        
          "Air",                               //0 - is it ever used?
          "Air (overwritable)",                //11 -is it ever used?
          "Invisible wall (boundary)",             //2 - front (only for quests)
          "Invisible wall (climbable)",            //18 - front (only for quests)
          "Underwater invisible wall (boundary)",  //19 - front (only for quests)
          "Zero G",                                //20 --> front, but can be ignored?
          "Zero G (protected)",                    //21 --> front, but can be ignored?
        ]; //index = tile #
         */
        return; //if no matches are found - next tile
    });
    return matchMap;
}
//merge two match maps with non-intersecting values and return new map
function mergeMatchMaps(matchMap1, matchMap2) {
    if (matchMap1.length > 0 && matchMap1.length != matchMap2.length) {
        throw new Error(`MAP SIZE MISMATCH: Merging matchMap1 of size ${matchMap1.length} with matchMap2 of size ${matchMap2.length}`);
    }
    const sumMap = [];
    matchMap2.forEach((element, index) => {
        if (element != undefined && matchMap1[index] != undefined) {
            throw new Error(`CANNOT MERGE: both matches are defined at index ${index}`);
        }
        if (element != undefined) {
            sumMap[index] = element;
        }
        else {
            sumMap[index] = matchMap1[index];
        }
    });
    return sumMap;
}
function slicePixelsToArray(pixelArray, width, height, channels) {
    const pixelCount = width * height;
    const RgbaArray = [];
    for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
        const Rgba = [0, 0, 0, 0];
        for (let channel = 0; channel < channels; channel++) {
            Rgba[channel] = (pixelArray[pixelIndex * channels + channel]);
        }
        RgbaArray.push(Rgba);
    }
    return RgbaArray;
}
const FLAGS = {
    //Tiled writes non-compressed GIDs in little-endian 32-bit unsigned ints, i.e. each 4 bytes in a buffer represent a GID
    //however, highest 4 bits are used as flipping flags (no pun intended)
    //details: https://doc.mapeditor.org/en/latest/reference/global-tile-ids/#tile-flipping
    //bit 32 - horizontal flip, bit 31 - vertical, bit 30 - diagonal (rotation). Bit 29 is for hexagonal maps, which Starbound file is not, so it can be ignored - but we still need to clear it, just in case
    HORIZ_FLIP: 8 << 28, //1000 shifted left 32-4=28 positions.
    VERT_FLIP: 4 << 28, //0100 shifted left
    DIAG_FLIP: 2 << 28, //0010 shifted left
    HEX_120_ROTATE: 1 << 28, //0001 shifted left
    MASK: 15 << 28, //Sum all flags. When applied to a UInt32 it should reset all bits but flags to 0
    //in other words, since flags are 4 high bits, it's 111100...0000
    CLEAR: ~(15 << 28) //reverse (~) mask is 000011..1111, it will reset flags and give us "pure" GID
};
function isRgbaEqual(Rgba1, Rgba2) {
    for (let component = 0; component < 4; component++) {
        if (Rgba1[component] != Rgba2[component]) {
            return false;
        }
    }
    return true;
}
/*
function convertPngToGid(RgbaArray:RgbaValue[], tileMatchMap: TileMatch[]):Buffer {
  const GidBuffer = Buffer.alloc(RgbaArray.length*4);
  for(let rgbaN = 0; rgbaN < RgbaArray.length; rgbaN++) {
    for(const conversion of tileMatchMap) {
      if(isRgbaEqual(RgbaArray[rgbaN], conversion.tileRgba)) {
        const gid = conversion.tileGid;
        GidBuffer.writeUInt32LE(gid, rgbaN*4);
      }
    }
  }
  return GidBuffer;
}
*/
function convertPngToGid(RgbaArray, tileMatchMap) {
    const layerGids = new Array(RgbaArray.length).fill(0);
    for (let rgbaN = 0; rgbaN < RgbaArray.length; rgbaN++) {
        for (const conversion of tileMatchMap) {
            if (isRgbaEqual(RgbaArray[rgbaN], conversion.tileRgba)) {
                const gid = conversion.tileGid;
                layerGids[rgbaN] = gid; //layerGids[rgbaN] = gid;
            }
        }
    }
    return layerGids;
}
function zlibTest() {
    console.log(`Testing zlib functionality`);
    const chunk = "eJzt1T9uwjAUx3HfxGoOwWV6iQ4MqBNjlx6BSzAwW108MHGj5gmsGniJXxoHv9i/J30FSPn3kRPijNk7hBBCCCFULKNoXEPWMK4hazwOXnjhhRdelePghRdeeOFNzu6N/9x09585xxXykm0ocsblnP+YxpKcc8zKeXOaS3hpLtaYQ287Mn101977PitY3zASb+7hrnlOU84t8Yb7OfyXxfNt+e81eMkzpda8Q2btXups0x1v+cR9vQYvt02cr9z7ZdrxkjXUgnft63ti2nbXanp+U+8SchxuSd492r2pNYu94Xc83t6n3UszdD9TZ/vsfTSu0Std3zErvHq8P/YvqTdlffSG42v0Sp5fzV7fH9Mb/nw+dwNezzjDPkt5tQYvvLV4c1tb9Go2L+XVaF7Sqs39Kmtp86udc8zS/bjtSjqn+qXbl77+OebS14Ha6xfz8DLr";
    const chunk64 = Buffer.from(chunk, "base64");
    console.log(chunk64);
    // console.log(chunk64.toString("base64"));
    zlib.inflate(chunk64, (error, buffer) => {
        console.error(error || "Decompression OK");
        console.log(buffer);
        console.log(`First raw GID is ${buffer.readUInt32LE(4)}`);
        /*
        zlib.deflate(buffer, (error, result) => {
          const recompressed = Buffer.from(result).toString("base64");
          console.log(recompressed);
          console.log(
            `initial and recompressed chunks match? ${chunk === recompressed}`
          );
        });
        */
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
        const flagsMask = 15 << 28;
        //FLAG_HORIZ_FLIP | FLAG_VERT_FLIP | FLAG_DIAG_FLIP | FLAG_HEX_120_ROTATE; //Sum all flags using bitwise OR to get a mask. When applied to a UInt32 it should reset all bits but flags to 0
        //in other words, since flags are 4 high bits, it's 111100...0000
        const gidMask = ~flagsMask; //reverse (~) mask is 000011..1111, it will reset flags and give us "pure" GID
        const rawGidFirst = buffer.readUInt32LE(0);
        console.log(rawGidFirst);
        const pureFlags = rawGidFirst & flagsMask;
        const pureGid = rawGidFirst & gidMask;
        //what we have from decompression
        console.log(`Flags are ${pureFlags >>> 28}, pure GID is ${pureGid}`);
        //what we should have from correct decompression
        console.log(`Flags are ${(2147483847 & flagsMask) >>> 28}, pure GID is ${2147483847 & gidMask}`);
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
export { getSortedTileset, calcNewTilesetShapes, matchTilelayer, mergeMatchMaps, slicePixelsToArray, convertPngToGid, zlibTest, TILESETJSON_NAME, FLAGS };
//# sourceMappingURL=tilesetMatch.js.map