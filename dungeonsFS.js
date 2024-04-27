const nodeFileSys = require("fs").promises;
const nodePathModule = require("path");
const { v4: uuidv4 } = require("uuid");

const ioDirPath = nodePathModule.resolve("./input-output/");

function getExtension(fileName) {
  return fileName.substring(fileName.lastIndexOf(".") + 1);
}

async function readDir() {
  try {
    const ioDir = await nodeFileSys.readdir(ioDirPath, { withFileTypes: true });
    return ioDir;
  } catch (err) {
    console.error(err.message);
    return undefined;
  }
}

async function getDungeons(dungeonPath) {
  try {
    const dungeonsRaw = await nodeFileSys.readFile(dungeonPath, {
      encoding: "utf-8",
    });
    const dungeons = JSON.parse(
      dungeonsRaw.replace(
        /\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g,
        (m, g) => (g ? "" : m)
      )
    ); //magic RegEx string to remove comments from JSON
    return dungeons;
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

async function writeConvertedDungeons(JsonData) {
  const ioDir = await readDir();
  let newDungeonPath;
  for (const file of ioDir) {
    if (file.isFile()) newDungeonPath = undefined;
    try {
      if (getExtension(file.name) === "dungeon") {
        //for every .dungeon file in I/O dir
        newDungeonPath = file.path + "/" + file.name + ".new";
      }
      if (newDungeonPath) {
        try {
          console.log(`Checking if ${newDungeonPath} is available...`);
          const accessed = await nodeFileSys.access(
            newDungeonPath,
            nodeFileSys.constants.F_OK
          );
          console.error(
            `Output file <${
              file.name + ".new"
            }> already exists. Rewriting prohibited. Remove it before running again.`
          );
          return undefined;
        } catch (error) {
          //this error appears if no .new file is found, i.e. if we can safely write
          // console.log(error.message);
          await nodeFileSys.writeFile(
            newDungeonPath,
            JSON.stringify(JsonData, null, 2),
            "utf-8"
          );
          // console.log(`Writing ${file.name}.new done.`);
          return true;
        }
      }
    } catch (error) {
      console.error(error.message);
      return undefined;
    }
  }
}

async function writeConvertedMapJson(newPath, JsonData) {
  const ioDir = await readDir();
  try {
    console.log(`Checking if ${newPath} is available...`);
    const accessed = await nodeFileSys.access(
      newPath,
      nodeFileSys.constants.F_OK
    );
    console.error(
      `Output file <${newPath}> already exists. Rewriting prohibited. Remove it before running again.`
    );
    return undefined;
  } catch (error) {
    //this error appears if no converted file is found, i.e. if we can safely write
    // console.log(error.message);
    const template = await getDungeons(`${ioDirPath}/template.json`);
    let fileToWrite = { ...template, ...JsonData };
    await nodeFileSys.writeFile(
      newPath,
      JSON.stringify(fileToWrite, null, 2),
      "utf-8"
    );
    // console.log(`Writing ${file.name}.new done.`);
    return true;
  }
}

async function writeTileMap(path, JsonData) {
  await nodeFileSys.writeFile(path, JSON.stringify(JsonData, null, 2), "utf-8");
  return true;
}

module.exports = {
  readDir,
  getDungeons,
  writeConvertedDungeons,
  writeConvertedMapJson,
  writeTileMap,
  ioDirPath,
};
