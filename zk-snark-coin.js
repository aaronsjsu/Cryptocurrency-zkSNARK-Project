"use strict";

const zksnarkUtils = require("./zk-snark-utils.js");
const crypto = require("crypto");

/**
 * Represents a single coin. Holds the values: cm, r, and sn. These are the values that make up a coin.
 */
module.exports = class ZksnarkCoin {

  /**
   * Constructs a new coin.
   *
   * @constructor
   * @param {Buffer} cm - A 256 bit byte buffer. Should be equal to the hash of r||sn.
   * @param {Buffer} r - A 256 bit byte buffer. Should be a random number.
   * @param {Buffer} sn - A 256 bit byte buffer. Should be a random number.
   */
  constructor(cm, r, sn) {
    this.cm = cm;
    this.r = r;
    this.sn = sn;
  }

}
