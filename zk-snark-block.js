"use strict";

const { Block } = require("spartan-gold");
const ZKSnarkBlockchain = require('./zk-snark-blockchain.js');
const snarkjs = require("snarkjs");
const fs = require("fs");
const crypto = require("crypto");
const zksnarkUtils = require("./zk-snark-utils.js");

/**
 * A block is a collection of transactions, with a hash connecting it to a previous block.
 */
module.exports = class ZksnarkBlock extends Block {

  /**
   * Creates a new Block.  Note that the previous block will not be stored;
   * instead, its hash value will be maintained in this block.
   *
   * @constructor
   * @param {Block} [prevBlock] - The previous block in the blockchain.
   * @param {Number} [target] - The POW target.  The miner must find a proof that
   *      produces a smaller value when hashed.
   */
  constructor(prevBlock, target=ZKSnarkBlockchain.POW_TARGET) {
    this.prevBlockHash = prevBlock ? prevBlock.hashVal() : null;
    this.target = target;

    this.transactions = [];
    this.coinbaseTransactions = []; // Doesn't store ZksnarkTransactions but rather cm's

    this.chainLength = prevBlock ? prevBlock.chainLength+1 : 0;
    this.timestamp = Date.now();

    this.cmlist = prevBlock ? prevBlock.cmlist : [];
    this.snlist = prevBlock ? prevBlock.snlist : [];
  }

  toJSON() {
    let o = {
      chainLength: this.chainLength,
      timestamp: this.timestamp,
    };
    if (!this.isGenesisBlock()) {
      o.transactions = Array.from(this.transactions);
      o.coinbaseTransactions = Array.from(this.coinbaseTransactions);
      o.prevBlockHash = this.prevBlockHash;
      o.proof = this.proof;
    }
    return o;
  }

  /**
   * Accepts a new transaction if it is valid and adds it to the block.
   *
   * @param {ZksnarkTransaction} tx - The transaction to add to the block.
   * @returns {Boolean} - True if the transaction was valid and added, false otherwise.
   */
  addTransaction(tx) {
    // First, verify the transaction proof.
    let vKey = JSON.parse(fs.readFileSync("verification_key.json"));
    let res = await snarkjs.groth16.verify(vKey, tx.proof.publicSignals, tx.proof.proof);
    if (res !== true) { return false; }

    // Now verify that the proof's public signals are valid.
    // Namely, make sure the input cm's are authentic cm's.
    let [public_cm1, public_cm2, public_sn] = zksnarkUtils.parsePublicSignals(tx.proof.publicSignals);
    if (!this.cmlist.includes(public_cm1) || !this.cmlist.includes(public_cm2)) {
      return false;
    }

    // Also verify no one is double spending.
    if (this.snlist.includes(public_sn)) { return false }

    // Now mint a new coin and prevent the old coin from being spent again.
    this.snlist.push(public_sn);
    this.cmlist.push(tx.cm);
    // And add the transaction to the block
    this.transactions.push(tx);
  }

  /**
   * Creates a new coinbase transaction. These are not like normal transactions. A coinbase
   * transaction takes no proof; the only thing it does take is the cm of the new coin to mint.
   *
   * @param {Buffer} cm - The hash value that represents the new coin.
   */
  addCoinbaseTransaction(cm) {
    this.coinbaseTransactions.push(tx.cm);
    this.cmlist.push(tx.cm);
  }

}
