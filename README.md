# sb.PngToTiled

An attempt to build a small (lol) JS script to convert old Starbound dungeon assets in PNG layers into new format (multilayered Tiled JSONs), which is used in post-release versions.

Current state:

1. Tilelayers
2. Anchors
3. Objects

3a. Recognizes sprite flips with exception (below)

3b. properties (loot tables for containers etc)

4. NPCs
5. Stagehands
6. Tilelayer modifications
7. TODO: Wiring

Has several bottlenecks which require post-conversion manual QA:

- Anchors occasionally have empty blocks behind them in tilelayer, as original level designers sometimes included them in tilelayer, not in objects (thus tilelayer has no info for these blocks).

Solution: Manually check background layer at anchor locations, paint similar to neighbouring tiles in necessary.

- Objects that have separate sprites for different placements (as opposed to simply flipping single sprite horizontally) use tile with default orientation after conversion. Meaning they can possibly lack mount points, hang in the air or overlap solid blocks, leading to log errors when spawning in-game.

Solution: Manually check such objects and replace with appropriate `_orientationN` versions from the same tileset. Most common cases include light sources (example: glitch torches), diagonal supports (example: wooden, foundry etc), signs (example: glitch village signs).

- Old dungeon chunks use a limited number of preset stagehands. Meaning that, for example, "objectrracker" stagehands (used for tracking player stealing blocks from villages) are bigger/smaller than needed (usually bigger).

Solution: Manually adjust size of stagehands after conversion to include required constructions but exclude unnecessary space.

## Usage

To use under Linux:

- Install Node
  Converter script was written under Node 20, but any modern version will do, hopefully
- Clone this repo locally
- `npm install` in terminal inside repo directory to install dependencies
- TODO: `npx tsx src/index.js --help`
- Converter has (partially) migrated onto TS to ensure type checks. ~~Remember to `npm run build` before you run anything with node~~ No need to transpile into JS any more, uses TSX out of the box.
- Place files in /input-output/ . You will need at least one .dungeon file or a .dungeon and .png file.
- Place tilesets/packed in /input-output/. This is a set of .json files describing Starbound tilesets for Tiled. PNG files will be remapped relative to these tilesets.
- Place tiled/packed in /input-output/. This is a set of .png files containing tiles for Tiled. Required to correctly calculate size of object sprites. Can be found in unpacked game assets.
- `npx tsx src/index.js --action COMMAND` to start converting (list of available commands can be found at the end of index.js)
- TODO: If you try to use converted dungeons in the game, remember to change their internal tileset paths relative to their actual location in Starbound assets!

## TODO + ISSUES

- can't properly convert base64 string and gzip.inflate to get value similar to decompressed files from Tiled. Mismatch happens only with back tilelayer, resulting GIDs for tiles with flags in code are lower than real ones from the file by 7. Reason unknown - probably Magic Pink Brush involved.
- Front tilelayer seems to be decompressing OK

## Useful links

[Tiled JSON file documentation](https://doc.mapeditor.org/en/latest/reference/json-map-format)

[Tiled: Global IDs and tile flipping flags](https://doc.mapeditor.org/en/latest/reference/global-tile-ids/)

[Node zlib docs](https://nodejs.org/api/zlib.html#class-zlibinflate)

[JavaScript bitwise operations](https://www.w3schools.com/js/js_bitwise.asp)

I _do not_ provide Starbound assets or unpacker. Please use those found in the copy that you own.

## Credits

uses [get-pixels](https://www.npmjs.com/package/get-pixels) by [Mikola Lysenko](https://github.com/mikolalysenko)

bitwise operators help by [Tinedel](https://github.com/tinedel)

Thanks to mysticmalevolence and all the Starbound community for support.

"There is no greater power in the universe than the need for freedom"
