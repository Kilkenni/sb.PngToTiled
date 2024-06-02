import * as dungeonsFS from "./dungeonsFS";
import * as compressor from "./compression";
import {convertAllChunks} from "./conversionSteps";
// import {
//   getFilenameFromPath,
//   getDirContents,
//   getDungeons,
//   getPixels_test,
//   convertDungeon
// } from "./legacy";
import floran from "./floran";

import yargs from "yargs";
import { hideBin } from 'yargs/helpers';

import {version as script_version} from "../package.json";

yargs(hideBin(process.argv))
  .command({
    command: "*",
    handler: (argv) => {
      yargs(hideBin(process.argv)).showHelp();
    },
  })
  .command({
    command: "bulk-convert [strict] [skipIncomplete] [log]",
    aliases: ["bulk"],
    describe: "Mass convert .png dungeon chunks in I/O dir to .json. Requires one .dungeon file and at least one .png.",
    builder: (yargs) => {
      return yargs.positional("strict", {
        desc: "Resolving .png chunks in .dungeon file. If false, skips unresolved files.",
        type: "boolean",
        default: false,
      }).positional("skipIncomplete", {
        desc: "Skip conversions lacking missing additional .png files. Ignored in strict mode.",
        type: "boolean",
        default: true,
      }).positional("log", {
        desc: "Console logging at every step",
        type: "boolean",
        default: true,
      })
    },
    handler: async (argv) => {
      await convertAllChunks(argv.strict, argv.log);
    }
  })
  
  .command({
    command: "list",
    aliases:["ls"],
    describe: "Lists all files in I/O folder that it can possibly try to convert.",
    handler: async (argv)=> {
      await dungeonsFS.readDir(true);
    },
  })
  
  .command({
    command: "extractTileset",
    aliases: ["tileset"],
    describe: "Debug function. Extracts old tileset from .dungeon file. Forced logging.",
    handler: async (argv) => {
        const ioFiles = await dungeonsFS.readDir();
        await dungeonsFS.extractOldTileset(ioFiles , true);
    }
  })

  .command({
    command: "getDungeon",
    aliases: ["dungeon"],
    describe: "Debug function. Posts .dungeon in console. You probably don't wanna do this.",
    handler: async (argv) => {
      const ioFiles = await dungeonsFS.readDir();
      dungeonsFS.getDungeon(ioFiles, true)
    },
  })

  .command({
    command: ["sendNudes", "nude", "nudefloran", "nudeFloran"],
    describe: false,
    handler: (argv) => {
      console.log(floran);
    },
  })

  .command({
    command: "zlib_test",
    aliases: ["zlib"],
    describe: "Debug function. Tries to use zlib on in-built tilelayer.",
    handler: (argv) => compressor.zlibTest(),
  })

  .help().alias("-h", "--help")
  .version(script_version).alias("-v", "--version")
  .parse();