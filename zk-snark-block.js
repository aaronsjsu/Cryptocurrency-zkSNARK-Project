"use strict";

const { Block } = require("spartan-gold");
const snarkjs = require("snarkjs");
const fs = require("fs");
const ZksnarkBlockchain = require('./zk-snark-blockchain.js');
const ZksnarkTransaction = require("./zk-snark-transaction.js");
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
  constructor(prevBlock, target=ZksnarkBlockchain.POW_TARGET) {
    super();

    this.prevBlockHash = prevBlock ? prevBlock.hashVal() : null;
    this.chainLength = prevBlock ? prevBlock.chainLength+1 : 0;
    this.target = target;

    this.coinbaseTransactions = []; // Doesn't store zksnarkTransactions but rather cm's

    this.cmlist = prevBlock ? prevBlock.cmlist : [];
    this.snlist = prevBlock ? prevBlock.snlist : [];

    this.proof = null;
  }

  /**
   * Adds a transaction to the block (does not validate it).
   *
   * @param {ZksnarkTransaction} tx - The transaction to add to the block.
   * @param {Buffer} sn - The sn of the coin being spent in the transaction.
   * @returns {Boolean} - True if the transaction was added, false otherwise.
   */
  addTransaction(tx, sn) {
    // Mint a new coin by adding it's cm, prevent the old coin from being spent again by adding sn.
    this.cmlist.push(tx.cm);
    this.snlist.push(sn);
    // And add the transaction to the block
    this.transactions.set(tx.id, tx);
    return true;
  }


  /**
   * Verifies a transaction. Specifically, checks that the zkSNARK proof is valid,
   * and also verifies that the coin wasn't alrady spent (preventing double spending).
   *
   * @param {ZksnarkTransaction} tx - The transaction to verify.
   * @returns {Boolean} - True if the transaction was valid, false otherwise.
   */
  async verifyTransaction(tx) {
    tx = ZksnarkBlockchain.deserializeTransaction(tx);

    // First, verify the transaction proof.
    let vKey = JSON.parse(fs.readFileSync("verification_key.json"));
    let res = await snarkjs.groth16.verify(vKey, tx.proof.publicSignals, tx.proof.proof);
    if (res !== true) {
      console.log('unverified proof');
      return false;
    }

    // Now verify that the proof's public signals are valid.
    // Namely, make sure the input cm's are authentic cm's.
    let [public_cm1, public_cm2, public_sn] = zksnarkUtils.parsePublicSignals(tx.proof.publicSignals);
    if (!zksnarkUtils.listContains(this.cmlist, public_cm1) || !zksnarkUtils.listContains(this.cmlist, public_cm2)) {
      console.log('invalid cm');
      return false;
    }

    // Also verify no one is double spending.
    if (zksnarkUtils.listContains(this.snlist, public_sn)) {
      console.log('sn already spent');
      return false;
    }

    return {tx: tx, public_sn: public_sn};
  }

  /**
   * Creates a new coinbase transaction. These are not like normal transactions. A coinbase
   * transaction takes no proof; the only thing it does take is the cm of the new coin to mint.
   *
   * @param {Buffer} cm - The hash value that represents the new coin.
   */
  addCoinbaseTransaction(cm) {
    this.coinbaseTransactions.push(cm);
    this.cmlist.push(cm);
  }

  /**
   * Converts this block to an object that is to be made into a string using JSON.stringify().
   */
  toJSON() {
    let o = {
      chainLength: this.chainLength,
      timestamp: this.timestamp,
      transactions: Array.from(this.transactions.entries()),
      coinbaseTransactions: Array.from(this.coinbaseTransactions),
      prevBlockHash: this.prevBlockHash,
      proof: this.proof,
      cmlist: this.cmlist,
      snlist: this.snlist
    };
    return o;
  }

}
