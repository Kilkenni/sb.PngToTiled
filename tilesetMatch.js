var nodeFileSys = require("fs").promises;
var nodePathModule = require("path");
var uuidv4 = require("uuid").v4;
;
var TILESETJSON_NAME = {
    materials: "materials",
    supports: "supports",
    liquids: "liquids",
    misc: "miscellaneous",
};
/*

/will Array.sort() speed up things?
//Do we need to account for duplicate items? Better do not add them in the first place!
//returns percents of matches from 1st array
function matchTileKeywords(tileKeywordsArray, testTileKeywordsArray) {
  let matched = 0;
  for (const keyword of tileKeywordsArray) {
    if (testTileKeywordsArray.includes(keyword)) {
      matched++;
    }
  }
  const matchPercent = (matched * 100) / tileKeywordsArray.length;
  return Math.round(matchPercent);
}

//searches match for an old tile in an array of new tiles based on matching comment (old) with shortdescription (new)
function findTileMatch(oldTile, newTilesObjectArray) {
  let oldTileKeywords;
  if (oldTile?.comment) {
    oldTileKeywords = [
      ...new Set(oldTile.comment.toLowerCase().split(/[,!?.:;]*[\s]+/)),
    ]; //use Set to remove duplicate values
    //add splitting by CamelCase as well - for rules, not comments
  }

  for (const testTile in newTilesObjectArray) {
  }
}

*/
function getSortedTileset(arrayOfOldTiles) {
    var oldTiles = {
        foreground: [],
        background: [],
        specialforeground: [],
        specialbackground: [],
        special: [],
        wires: [],
        stagehands: [],
        npcs: [],
        objects: [],
        undefined: [],
    };
    for (var _i = 0, arrayOfOldTiles_1 = arrayOfOldTiles; _i < arrayOfOldTiles_1.length; _i++) {
        var tile = arrayOfOldTiles_1[_i];
        if (tile.brush === undefined) {
            oldTiles.special.push(tile); //if there is no brush at all, probably a Special tile
        }
        else {
            //first, consistency expectation checks
            if (tile.brush.length > 1) {
                if (tile.brush[0][0] != "clear") {
                    console.log("Error, tile brush of size ".concat(tile.brush.length, " contains ").concat(tile.brush, ", first slot is not \"clear\". Skipping tile"));
                    continue; //NEXT TILE
                }
            }
            for (var _a = 0, _b = tile.brush; _a < _b.length; _a++) {
                var brush = _b[_a];
                switch (brush[0]) {
                    case "clear":
                        if (tile.brush.length === 1) {
                            oldTiles.special.push(tile); //brush contains 1 "clear" element > special tile
                        }
                        break; //otherwise skip
                    case "biometree":
                    case "biomeitems":
                    case "playerstart":
                        oldTiles.special.push(tile);
                        break;
                    case "surface":
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
    var matchMap = oldTilesCategoryArray.map(function (tile) {
        var /*value, comment,*/ brush = tile.brush, rules = tile.rules;
        //if we match materials, platforms or liquids
        if ([TILESETJSON_NAME.materials, TILESETJSON_NAME.supports, TILESETJSON_NAME.liquids].includes(newTilesetJSON.name)) {
            if (brush === undefined) {
                return;
                //throw new Error(`Tile brush is ${brush}`); //TODO Special Misc tiles
            }
            var newBrushType = (newTilesetJSON.name === TILESETJSON_NAME.liquids) ? "liquid" : "material";
            var oldBrushTypes = [];
            if (layerName === "front") {
                oldBrushTypes.push("front", "liquid");
            }
            else if (layerName === "back") {
                oldBrushTypes.push("back");
            }
            for (var _i = 0, brush_1 = brush; _i < brush_1.length; _i++) {
                var brushLayer = brush_1[_i];
                var brushType = brushLayer[0], brushMaterial = brushLayer[1];
                if (oldBrushTypes.includes(brushType)) {
                    for (var materialIndex in newTilesetJSON.tileproperties) {
                        var material = newTilesetJSON.tileproperties[materialIndex][newBrushType];
                        if (material === brushMaterial) {
                            return { tileName: brushMaterial, tileGid: (parseInt(materialIndex) + firstgid) };
                        }
                    }
                }
            }
        }
        return; //if no matches are found - next tile
    });
    /*
    front tile:
    -brush: []
    --type: "clear", "liquid", "front, "back"
    --material (for any but "clear" - can be mat or support)
    --tilled (optional)
    -comment: "string"
    -value: [RGBA]
    -rules (optional)
    --allowOverdrawing (optional)
    */
    return matchMap;
}
//merge two match maps with non-intersecting values and return new map
function mergeMatchMaps(matchMap1, matchMap2) {
    if (matchMap1.length > 0 && matchMap1.length != matchMap2.length) {
        throw new Error("MAP SIZE MISMATCH: Merging matchMap1 of size ".concat(matchMap1.length, " with matchMap2 of size ").concat(matchMap2.length));
    }
    var sumMap = [];
    matchMap2.forEach(function (element, index) {
        if (element != undefined && matchMap1[index] != undefined) {
            throw new Error("CANNOT MERGE: both matches are defined at index ".concat(index));
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
module.exports = {
    getSortedTileset: getSortedTileset,
    matchTilelayer: matchTilelayer,
    mergeMatchMaps: mergeMatchMaps,
};
//# sourceMappingURL=tilesetMatch.js.map