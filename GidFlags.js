var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _a, _GidFlags_checkUInt32;
/**
 * static class to set/reset bit flags on a Tiled global ID
 */
class GidFlags {
    constructor() { }
    static getPureGid(gidWithFlags) {
        __classPrivateFieldGet(this, _a, "m", _GidFlags_checkUInt32).call(this, gidWithFlags);
        return (gidWithFlags & this.FLAGS_CLEAR) >>> 0; //Gid > 0, convert to Unsigned Int!
    }
    static getFlagsOnly(gidWithFlags) {
        __classPrivateFieldGet(this, _a, "m", _GidFlags_checkUInt32).call(this, gidWithFlags);
        return gidWithFlags & this.FLAGS_MASK;
    }
    static getHorizontal(gidWithFlags) {
        __classPrivateFieldGet(this, _a, "m", _GidFlags_checkUInt32).call(this, gidWithFlags);
        return (gidWithFlags & this.FLIP_HORIZ) === this.FLIP_HORIZ;
    }
    static getVertical(gidWithFlags) {
        __classPrivateFieldGet(this, _a, "m", _GidFlags_checkUInt32).call(this, gidWithFlags);
        return (gidWithFlags & this.FLIP_VERT) === this.FLIP_VERT;
    }
    static getDiagonal(gidWithFlags) {
        __classPrivateFieldGet(this, _a, "m", _GidFlags_checkUInt32).call(this, gidWithFlags);
        return (gidWithFlags & this.FLIP_DIAG) === this.FLIP_DIAG;
    }
    static apply(pureGid, flipDiag, flipHoriz, flipVert) {
        //Starbound uses orthogonal maps; order of flips matters! DIAG > HORIZ > VERT
        __classPrivateFieldGet(this, _a, "m", _GidFlags_checkUInt32).call(this, pureGid);
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
_a = GidFlags, _GidFlags_checkUInt32 = function _GidFlags_checkUInt32(gid) {
    if (gid > 0 && gid < 4294967295) {
        return true;
    }
    throw new Error(`Gid ${gid} in not an Unsigned Int32`);
};
//Tiled writes non-compressed GIDs in little-endian 32-bit unsigned ints, i.e. each 4 bytes in a buffer represent a GID
//however, highest 4 bits are used as flipping flags (no pun intended)
//details: https://doc.mapeditor.org/en/latest/reference/global-tile-ids/#tile-flipping
//bit 32 - horizontal flip, bit 31 - vertical, bit 30 - diagonal (rotation). Bit 29 is for hexagonal maps, which Starbound file is not, so it can be ignored - but we still need to clear it, just in case
GidFlags.FLIP_HORIZ = 8 << 28; //1000 shifted left 32-4=28 positions.
GidFlags.FLIP_VERT = 4 << 28; //0100 shifted left
GidFlags.FLIP_DIAG = 2 << 28; //0010 shifted left
GidFlags.HEX_120_ROTATE = 1 << 28; //0001 shifted left
GidFlags.FLAGS_MASK = 15 << 28; //Sum all flags. When applied to a UInt32 it should reset all bits but flags to 0
//in other words, since flags are 4 high bits, it's 111100...0000
GidFlags.FLAGS_CLEAR = ~(15 << 28); //reverse (~) mask is 000011..1111, it will reset flags and give us "pure" GID
export default GidFlags;
//# sourceMappingURL=GidFlags.js.map