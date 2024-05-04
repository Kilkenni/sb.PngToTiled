export type UnsignedInt32 = number;

/**
 * static class to set/reset bit flags on a Tiled global ID
 */
export default class GidFlags {
  //Tiled writes non-compressed GIDs in little-endian 32-bit unsigned ints, i.e. each 4 bytes in a buffer represent a GID
  //however, highest 4 bits are used as flipping flags (no pun intended)
  //details: https://doc.mapeditor.org/en/latest/reference/global-tile-ids/#tile-flipping
  //bit 32 - horizontal flip, bit 31 - vertical, bit 30 - diagonal (rotation). Bit 29 is for hexagonal maps, which Starbound file is not, so it can be ignored - but we still need to clear it, just in case
  static FLIP_HORIZ = 8 << 28; //1000 shifted left 32-4=28 positions.
  static FLIP_VERT = 4 << 28; //0100 shifted left
  static FLIP_DIAG = 2 << 28; //0010 shifted left
  static HEX_120_ROTATE = 1 << 28; //0001 shifted left
  static FLAGS_MASK = 15 << 28; //Sum all flags. When applied to a UInt32 it should reset all bits but flags to 0
  //in other words, since flags are 4 high bits, it's 111100...0000
  static FLAGS_CLEAR = ~(15 << 28); //reverse (~) mask is 000011..1111, it will reset flags and give us "pure" GID

  constructor() { }

  static #checkUInt32(gid: number) {
    if (gid > 0 && gid < 4294967295) {
      return true;
    }
    throw new Error(`Gid ${gid} in not an Unsigned Int32`);
  }
  
  static getPureGid(gidWithFlags: UnsignedInt32):UnsignedInt32 {
    this.#checkUInt32(gidWithFlags);
    return (gidWithFlags & this.FLAGS_CLEAR) >>> 0; //Gid > 0, convert to Unsigned Int!
  }

  static getFlagsOnly(gidWithFlags: UnsignedInt32): number {
    this.#checkUInt32(gidWithFlags);
    return gidWithFlags & this.FLAGS_MASK;
  }

  static getHorizontal(gidWithFlags: UnsignedInt32): boolean {
    this.#checkUInt32(gidWithFlags);
    return (gidWithFlags & this.FLIP_HORIZ) === this.FLIP_HORIZ;
  }

  static getVertical(gidWithFlags: UnsignedInt32): boolean {
    this.#checkUInt32(gidWithFlags);
    return (gidWithFlags & this.FLIP_VERT) === this.FLIP_VERT;
  }

  static getDiagonal(gidWithFlags: UnsignedInt32): boolean {
    this.#checkUInt32(gidWithFlags);
    return (gidWithFlags & this.FLIP_DIAG) === this.FLIP_DIAG;
  }

  static apply(pureGid: UnsignedInt32, flipDiag: boolean, flipHoriz: boolean, flipVert: boolean):UnsignedInt32 {
    //Starbound uses orthogonal maps; order of flips matters! DIAG > HORIZ > VERT
    this.#checkUInt32(pureGid);
    let gidWithFlags = pureGid;
    if (flipDiag) {
      gidWithFlags = gidWithFlags | this.FLIP_DIAG;
    }
    if (flipHoriz) {
      gidWithFlags = gidWithFlags | this.FLIP_HORIZ;
    }
    if (flipVert) {
      gidWithFlags = gidWithFlags | this.FLIP_VERT;
    }

    return (gidWithFlags >>> 0); //Gid > 0, convert to Unsigned Int!
  }
}