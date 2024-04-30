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
var MISCJSON_MAP = [
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
        anchors: [],
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
                        oldTiles.objects.push(tile);
                        break;
                    case "playerstart":
                        oldTiles.anchors.push(tile);
                        break;
                    case "surface":
                        // if (tile.rules) {
                        // }
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
                //throw new Error(`Tile brush is ${brush}`);
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
        else if (newTilesetJSON.name === TILESETJSON_NAME.misc) {
            //TODO Special Misc tiles
            /*
            SPECIAL:
            magic pink brush  = comment: "magic pinkppp, a no-op value"
            0 = brush:["clear"], comment:"Empty hole"
            0 = brush:["clear"], comment:"Empty hole overwritable"
      
            SPECIALBKG
            ??? = brush:["surfacebackground"]
            ??? = brush:["surfacebackground",{variant: 0}]
            ??? = brush:["surfacebackground",{variant: 0}], rules: [["allowOverdrawing"]]
            ??? = brush:["surfacebackground",{variant: 1}]
            ??? = brush:["surfacebackground",{variant: 1}], rules: [["allowOverdrawing"]]
            ??? = brush:["surfacebackground",{variant: 2}]
            ??? = brush:["surfacebackground",{variant: 2}], rules: [["allowOverdrawing"]]
      
            SPECIALFRONT
            move worldGenMustContainSolidBackground to SPECIAL
            ??? = brush: ["surface"]
            ??? = brush: ["surface"], rules: [["allowOverdrawing"]]
            ??? = brush:["surface",{variant: 0}]
            ??? = brush:["surface",{variant: 0}], rules: [["allowOverdrawing"]]
            ??? = brush:["surface",{variant: 1}]
            ??? = brush:["surface",{variant: 1}], rules: [["allowOverdrawing"]]
            ??? = brush:["surface",{variant: 2}]
            ??? = brush:["surface",{variant: 2}], rules: [["allowOverdrawing"]]
            */
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