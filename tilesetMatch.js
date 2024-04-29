var nodeFileSys = require("fs").promises;
var nodePathModule = require("path");
var uuidv4 = require("uuid").v4;
;
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
            /*
            //COMPLE OUTDATED CHECK - REMOVE
      
            if (oldTile.brush.length === 1) {
              if (oldTile.brush[0].length === 1) {
                if (oldTile.brush[0][0] === "clear") {
                  oldTiles.special.push(oldTile); //brush contains 1 "clear" element > special tile
                } else {
                  oldTiles.foreground.push(oldTile);
                }
              } else {
                switch (oldTile.brush[0][0]) {
                  case "surface":
                    oldTiles.foreground.push(oldTile);
                    break;
                  case "wire":
                    oldTiles.wires.push(oldTile);
                    break;
                  case "stagehand":
                    oldTiles.stagehands.push(oldTile);
                    break;
                  case "npc":
                    oldTiles.npcs.push(oldTile);
                    break;
                  default:
                    console.log(
                      `Error, tile brush of size 1 contains ${oldTile.brush} which cannot be identified`
                    );
                }
              }
            } else if (oldTile.brush.length === 2) {
              if (oldTile.brush[0].length === 1) {
                if (oldTile.brush[0][0] === "clear") {
                  if (oldTile.brush[1][0] === "back") {
                    oldTiles.background.push(oldTile); //brush contains 2 elements, 1-st is "clear" element > background tile
                  } else {
                    oldTiles.undefined.push(oldTile);
                  }
                } else
                  console.log(
                    `Error, tile brush of size 2; 1-st element is not "clear", contains ${oldTile.brush}`
                  );
              } else {
                console.log(
                  `Error, tile brush of size 2, strange 1-st element: ${oldTile.brush}`
                );
              }
            } else if (oldTile.brush.length === 3) {
              if (oldTile.brush[0][0] != "clear") {
                console.log(
                  `Error, tile brush of size ${oldTile.brush.length} contains ${oldTile.brush}, first slot is not "clear"`
                );
                continue; //NEXT TILE
              }
              for (const brush of oldTile.brush) {
                switch (brush[0]) {
                  case "clear":
                    break;
                  case "back":
                    oldTiles.background.push(oldTile);
                    break;
                  case "front":
                    oldTiles.foreground.push(oldTile);
                    break;
                  default:
                    console.log(
                      `Error, tile brush of size ${oldTile.brush.length} contains ${oldTile.brush} - CANNOT BE SORTED`
                    );
                }
              }
              if (oldTile.brush[1][0] === "back") {
              }
            } else {
              console.log(
                `Error, tile brush of size ${oldTile.brush.length} contains ${oldTile.brush}`
              );
            }
            */
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
        if (brush === undefined) {
            return;
            //throw new Error(`Tile brush is ${brush}`); //TODO Special Misc tiles
        }
        for (var _i = 0, brush_1 = brush; _i < brush_1.length; _i++) {
            var brushLayer = brush_1[_i];
            var brushType = brushLayer[0], brushMaterial = brushLayer[1];
            switch (brushType) {
                case "front":
                    for (var materialIndex in newTilesetJSON.tileproperties) {
                        var material = newTilesetJSON.tileproperties[materialIndex]["material"];
                        if (material === brushMaterial) {
                            return { tileName: brushMaterial, tileGid: (parseInt(materialIndex) + firstgid) };
                        }
                    }
                    break;
                default:
                //No matches on this brush layer, do nothing
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
    if (matchMap1.length != matchMap2.length) {
        throw new Error("MAP SIZE MISMATCH: Merging matchMap1 of size ".concat(matchMap1.length, " with matchMap2 of size ").concat(matchMap2.length));
    }
    var sumMap = [];
    matchMap1.forEach(function (element, index) {
        if (element != undefined && matchMap2[index] != undefined) {
            throw new Error("CANNOT MERGE: both matches are defined at index ".concat(index));
        }
        if (element != undefined) {
            sumMap[index] = element;
        }
        else {
            sumMap[index] = matchMap2[index];
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