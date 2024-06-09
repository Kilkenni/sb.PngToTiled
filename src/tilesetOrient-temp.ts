if(tile.object === objectName) {
  const orientNum = objFile.orientations.length;
  if(orientNum === 1) {
    tilesetTodos[currentTileset].tileset.tileproperties[tileIndex] = upgradeTile(objFile.orientations[0], tile);
    const beforeVerify = tilesetTodos[currentTileset].tilesToVerify; //debug line
    console.log(`   ---assigning what remains`)
    stats.assignedWhatRemains = stats.assignedWhatRemains+1;

  }
  if(orientNum === 2) {
    const imageOffset = [tile.imagePositionX, tile.imagePositionY];
    const orient = objFile.orientations.filter((orientation) => {
      return orientation.imagePosition.toString() === imageOffset.toString();
    });
    if(orient.length === 1) {         
      tilesetTodos[currentTileset].tileset.tileproperties[tileIndex] = upgradeTile(orient[0], tile);
      console.log(`   --strict match`);
      stats.strict = stats.strict+1;
      const beforeVerify = tilesetTodos[currentTileset].tilesToVerify; //debug line

      objFile.orientations = objFile.orientations.filter((orientation)=> JSON.stringify(orientation) !== JSON.stringify(orient[0]));
    }
    else {
      //strict match failed
      let chosenOr = -1;
      for(let orN = 0; orN < objFile.orientations.length; orN++) {
        const orientation = objFile.orientations[orN];
        const tempTile = tilesetTodos[currentTileset].tileset.tileproperties[tileIndex] as UpgradedObjectJson;
        const deltaOld = tempTile["//obj-verified"] === undefined? 
        1000 : 
        getOffsetDelta([parseInt(tempTile.imagePositionX), parseInt(tempTile.imagePositionY)], tempTile["//obj-offset"]);
        const deltaNew = getOffsetDelta([parseInt(tempTile.imagePositionX), parseInt(tempTile.imagePositionY)], orientation.imagePosition);
        console.log(`   --comparing offset delta, old: ${deltaOld}, new: ${deltaNew}`); //debug
        if(deltaOld > deltaNew && (orientation as Record<string,any>).TAKEN !== true) {
          console.log(`   --replacing match`)
          tilesetTodos[currentTileset].tileset.tileproperties[tileIndex] = upgradeTile(orientation, tile);
          chosenOr = orN;
        }
        else {
          if( (orientation as Record<string,any>).TAKEN === true) {
            //console.log(`   --TAKEN`)
          }
          else {
            console.log(`   --preserve`);
          }

        }
        if(deltaOld === deltaNew) {
          ///this is bad - we have 2 orientations with equal offsets. Need another matching metod (example: florancurtan)
          //for now just pick the first one
          break;
        }
      }
      try {
        (objFile.orientations[chosenOr] as Record<string,any>).TAKEN = true;
      }
      catch(error) {
        if(chosenOr < 0) {
          console.error(`   ----${objectName} has more variations than in the .object file!`)
          stats.orientOutOfBound = stats.orientOutOfBound + 1;
        }
      }
      
      /*
      for(const orientation of objFile.orientations) {
        const tempTile = tilesetTodos[currentTileset].tileset.tileproperties[tileIndex] as UpgradedObjectJson;
        const deltaOld = tempTile["//obj-verified"] === undefined? 
        1000 : 
        getOffsetDelta([parseInt(tempTile.imagePositionX), parseInt(tempTile.imagePositionY)], tempTile["//obj-offset"]);
        const deltaNew = getOffsetDelta([parseInt(tempTile.imagePositionX), parseInt(tempTile.imagePositionY)], orientation.imagePosition);
        console.log(`   --comparing offset delta, old: ${deltaOld}, new: ${deltaNew}`); //debug
        if(deltaOld > deltaNew) {
          console.log(`   --replacing match`)
          tilesetTodos[currentTileset].tileset.tileproperties[tileIndex] = upgradeTile(orientation, tile);
        }
        else {
          console.log(`   --preserve`)
        }
        if(deltaOld === deltaNew) {
          ///this is bad - we have 2 orientations with equal offsets. Need another matching metod (example: florancurtan)
          //for now just pick the first one
          break;
        }
      }
      */
      
      /*tilesetTodos[currentTileset].tileset.tileproperties[tileIndex] = upgradeTile(objFile.orientations[0], tile);
      console.log(`  --just pick first`);
      stats.pickFirst = stats.pickFirst+1;
      )*/
      //tilesetTodos[currentTileset].tileset.tileproperties[tileIndex] = upgradeTile(objFile.orientations[0], tile);
      const beforeVerify = tilesetTodos[currentTileset].tilesToVerify; //debug line
      //tilesetTodos[currentTileset].tilesToVerify.splice(indexToVerify, 1);
      //objFile.orientations.splice(0, 1)
      //throw new Error(`Filtering ${objectName} orientations by offset failed.`)
    }
  }
  else {
    //console.log(`OrientNum = ${orientNum}`);
  }
}