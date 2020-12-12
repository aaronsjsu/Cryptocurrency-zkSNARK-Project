"use strict";

const crypto = require('crypto');
const getRandomValues = require('get-random-values');
const ZksnarkCoin = require("./zk-snark-coin.js");

const HASH_LENGTH = 256;

/**
 * Converts a byte buffer to a bit array
 *
 * @param {Buffer} - The buffer to convert to the array.
 *
 * @returns {Array} - An array of bits.
 */
exports.bufferToBitArray = function(buf) {
  let result = [];
  for (let i = 0; i < buf.length; i++) {
    for (let j = 0; j < 8; j++) {
      result.push((buf[i] >> (7 - j) & 1));
    }
  }
  return result;
}

/**
 * Parses the public signals involved in a snarkjs proof. Returns the three 256 bit
 * values involved in the public signals as a buffer.
 *
 * @param {Object} - The public signals involved in the snarkjs proof.
 *
 * @returns {Array} - An array containing the buffers cm1, cm2, sn.
 */
exports.parsePublicSignals = function(publicSignals) {
  // publicSignals is in the form of a bit array of length 256 * 3.
  // We want to parse it into three byte buffers each of length 256 bits.
  const BUFFER_LENGTH = HASH_LENGTH / 8
  let cm1 = Buffer.alloc(BUFFER_LENGTH);
  let cm2 = Buffer.alloc(BUFFER_LENGTH);
  let sn = Buffer.alloc(BUFFER_LENGTH);
  for (let i = 0; i < publicSignals.length / 8; i++) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      byte += publicSignals[(i * 8) + j] << (7 - j);
    }
    if (i < BUFFER_LENGTH) {
      cm1.fill(byte, i, i + 1);
    } else if (i < BUFFER_LENGTH * 2) {
      cm2.fill(byte, i - BUFFER_LENGTH, i - BUFFER_LENGTH + 1);
    } else {
      sn.fill(byte, i - (BUFFER_LENGTH*2), i - (BUFFER_LENGTH*2) + 1);
    }
  }
  return [cm1, cm2, sn];
}

/**
 * Generates a random 256 bit number and returns it as a buffer..
 *
 * @returns {Buffer} - The random 256 bit number.
 */
exports.random256BitNumber = function() {
  let randomBytes = new Uint8Array(32);
  getRandomValues(randomBytes);
  return Buffer.alloc(32, randomBytes);
}

/**
 * Creates a new ZksnarkCoin using random numbers for r and sn.
 *
 * @returns {ZksnarkCoin} - The new coin.
 */
exports.createNewCoin = function() {
  let r = this.random256BitNumber();
  let sn = this.random256BitNumber();
  let buf = Buffer.alloc(sn.length * 2);
  buf.fill(sn, sn.length);
  buf.fill(r, 0, r.length);
  let cm = crypto.createHash("sha256").update(buf).digest();
  return new ZksnarkCoin(cm, r, sn);
}

/**
* Helper method used by addTransaction(). Searches the list to see if it contains the buffer.
*
* @param {Buffer[]} list - The list of cm's.
* @param {Buffer} buf - The cm to search for.
* @returns {Boolean} - True if cm is in cmlist, false otherwise.
*/
exports.listContains = function(list, buf) {
  for (let i = 0; i < list.length; i++) {
    if (list[i].compare(buf) === 0) {
      return true;
    }
  }
  return false;
}
