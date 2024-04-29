# sb.PngToTiled

An attempt to build a small JS script to convert old Starbound dungeon assets in PNG layers into new format (multilayered Tiled JSONs), which is used in post-release versions.

So far DOESN'T WORK.

## Usage

To use under Linux:
- Install Node
Converter script was written under Node 20, but any modern version will do, hopefully
- Clone this repo locally
- <npm install> in terminal inside repo directory to install dependencies
- TODO: <node index.js --help> 
- Place files in /input-output/ . You will need at least one .dungeon file or a .dungeon and .png file.
- <node index.js --action COMMAND> to start converting

## TODO + ISSUES
- can't properly convert base64 string and gzip.inflate to get value similar to decompressed files from Tiled. Mismatch happens only with back tilelayer, resulting GIDs in code are lower than real ones from the file by 7. Reason unknown.
- Front tilelayer seems to be decompressing OK

- rough algo to get conversion done:
1. Debug Tiled JSON decompression to make it work.
2. Map PNG with tile definitions extracted from old .dungeons file. 
a) RBG > Tile
b) Tile > Tile GID from Tileset. Tilesets available in packed/tilesets/packed
3. Form reference to tilesets for resulting JSON. Note the paths, as those should point to tilesets from 2b relative of original PNG location in assets (assuming we want to place JSON in the same location)
4. Possibly process associated PNGs (original SB format splits layers into separate files, Tiled keeps map info in layers inside a single file). Note the flip flags!

## Useful links

[Tiled JSON file documentation](https://doc.mapeditor.org/en/latest/reference/json-map-format)

[Tiled: Global IDs and tile flipping flags](https://doc.mapeditor.org/en/latest/reference/global-tile-ids/)

[Node zlib docs](https://nodejs.org/api/zlib.html#class-zlibinflate)

[JavaScript bitwise operations](https://www.w3schools.com/js/js_bitwise.asp)

I do not provide Starbound assets or unpacker.

## Credits

uses [get-pixels](https://www.npmjs.com/package/get-pixels) by [Mikola Lysenko](https://github.com/mikolalysenko)

bitwise operators help by [Tinedel](https://github.com/tinedel)

Thanks to mysticmalevolence and all the Starbound community for support.

"There is no greater power in the universe than the need for freedom"
