var nodeFileSys = require("fs").promises;
var nodePathModule = require("path");
var uuidv4 = require("uuid").v4;
;
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
function matchTilelayer(oldTilesCategoryArray, newTilesetJSON) {
    var matchMap = oldTilesCategoryArray.map(function (tile) {
        var value = tile.value, comment = tile.comment, brush = tile.brush, rules = tile.rules;
        if (brush === undefined) {
            throw new Error("Tile brush is ".concat(brush));
        }
        for (var _i = 0, brush_1 = brush; _i < brush_1.length; _i++) {
            var brushLayer = brush_1[_i];
            var brushType = brushLayer[0], brushMaterial = brushLayer[1];
            switch (brushType) {
                case "front":
                    for (var materialIndex in newTilesetJSON.tileproperties) {
                        var material = newTilesetJSON.tileproperties[materialIndex]["material"];
                        if (material === brushMaterial) {
                            return { oldTileName: brushMaterial, newTileIndex: materialIndex };
                        }
                    }
                    break;
                default:
                //do nothing
            }
        }
        var tileMatch = {};
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
        return tile;
    });
}
module.exports = {
    getSortedTileset: getSortedTileset,
};
//# sourceMappingURL=tilesetMatch.js.map