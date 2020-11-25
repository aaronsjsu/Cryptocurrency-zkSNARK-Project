"use strict";

const { Blockchain } = require("spartan-gold");

const SEND_COIN = "SEND_COIN";

/**
 * The Blockchain class tracks configuration information and settings for the blockchain,
 * as well as some utility methods to allow for easy extensibility.
 */
module.exports = class ZksnarkBlockchain extends Blockchain {

  /**
   * Makes a genesis block.
   *
   * @param {Object} cfg - The object that is passed straight to Blockchain.makeGenesis().
   * @param {Array} initialCoins - An array containing all the cm's of the initial coins to start with.
   */
  static makeGenesis(cfg, initialCoins) {
    let block = super.makeGenesis(cfg);

    // For Zksnark functionality
    block.transactions = [];
    block.coinbaseTransactions = [];
    block.coinbaseTransactions.push(initialCoins);

    return block;
  }

}
