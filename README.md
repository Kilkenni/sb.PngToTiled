# sb.PngToTiled

A small (kek) ~~JS~~ pile of Typescript to convert old Starbound dungeon assets in PNG layers into new format (multilayered Tiled JSONs), which is used in post-release versions.

Now with Bulk conversion!

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

<details>
<summary>Has several bottlenecks which require post-conversion manual QA:</summary>

- Anchors occasionally have empty blocks behind them in tilelayer, as original level designers sometimes included them in tilelayer, not in objects (thus tilelayer has no info for these blocks).

Solution: Manually check background layer at anchor locations, paint similar to neighbouring tiles if necessary.

- Objects with even tilewidth have their horizontal placement calculated only approximately. One tile for objects is selected as "anchor tile" against which other coords are calculated. While "uneven" objects do not change their position when flipped (they are flipped regarding to their "center tile"), even objects may shift one tile, or, in case of objects have anchors in corners, by width-1 number of tiles. Heuristics to calculate their position accurately seems too complex to implement.

Solution: Manually shift to required locations referring to key_with_grid PNG file (anchor tiles are painted light red). I'll try to come up with a proper solution, but so far I don't see one.


- Objects that have separate sprites for different placements (as opposed to simply flipping single sprite horizontally) use tile with default orientation after conversion. Meaning they can possibly lack mount points, hang in the air or overlap solid blocks, leading to log errors when spawning in-game.

Solution: Manually check such objects and replace with appropriate `_orientationN` versions from the same tileset. Most common cases include light sources (example: glitch torches), diagonal supports (example: wooden, foundry etc), signs (example: glitch village signs).

- Old dungeon chunks use a limited number of preset stagehands. Meaning that, for example, "objectrracker" stagehands (used for tracking player stealing blocks from villages) are bigger/smaller than needed (usually bigger).

Solution: Manually adjust size of stagehands after conversion to include required constructions but exclude unnecessary space.

- Biome trees and biome items (always?) tend to have a width of 2 blocks (16 pixels), but are often placed at adjacent blocks in old dungeon chunks. This will obviously lead to some of them being always unable to spawn exactly as painter in the chunk.

Solution: Manually remove some of BTs/BIs after conversion to eliminate spawn overlaps. Needs manual experimenting on models to figure out optimal strategy. You're welcome to share your findings :)

</details>

## Usage

To use under Linux:

- Install Node.
  Converter script was written under Node 20. Current TS settings require at least Node 16, so there's that. Hopefully, any modern version will do.
- Clone this repo locally
- `npm install` in terminal inside repo directory to install dependencies
- `npx tsx src/index.js --help` or simply `npm start` to get a list of available commands.
- Converter has migrated onto TS to ensure type checks. ~~Remember to `npm run build` before you run anything with node~~ No need to transpile into JS any more, uses TSX out of the box.
- Place files in /input-output/ . You will need exactly one .dungeon file and at least one .png file for typical "bulk" routine. If an _objects.png exists, place it there as well. Objects will be parsed and merged into the parent dungeon chunk automatically.
- Place tilesets/packed in /input-output/. This is a set of .json files describing Starbound tilesets for Tiled. PNG files will be remapped relative to these tilesets.
- Place tiled/packed in /input-output/. This is a set of .png files containing tiles for Tiled. Required to correctly calculate size of object sprites. Can be found in unpacked game assets.
- `npx tsx src/index.js COMMAND` to start sorcery (list of available commands also can be found at the end of index.js)

- TODO: If you try to use converted dungeons in the game, remember to change their internal tileset paths relative to their actual location in Starbound assets!

## KNOWN ISSUES

- can't properly convert base64 string and gzip.inflate to get value similar to decompressed files from Tiled. Mismatch happens only with back tilelayer, resulting GIDs for tiles with flags in code are lower than real ones from the file by 7. Reason unknown - probably Magic Pink Brush involved.

- Front tilelayer seems to be decompressing OK

- Consequently, output file is currently NOT compressed. You can re-save it from Tiled after enabling compression. Automating this step is already in my backlog.

- Some corners have been cut, so it currently can't parse Very Big dungeons (like the mission ones) due to some exotic tiles used there. It's on my todo list.

## Terms of use

A Very Fancy Caption to say that the code is available to use freely. License to be specified later. You are strongly encouraged to share conversion results with the Starbound modding community.

Parts of this code were written during air raids, missile strikes and blackouts. If you are in any way or form related to Russian invasion of Ukraine of 2014-ongoing, I ask you to donate any amount to a reliable charity of your choice that helps Ukrainians survive. Personally, I can recommend [Come Back Alive](https://savelife.in.ua/en/donate-en/).

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