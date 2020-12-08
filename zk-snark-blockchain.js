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
    block.cmlist = initialCoins;
    Blockchain.cfg.currencyClass = cfg.currencyClass;

    return block;
  }

  /**
   * Converts a string representation of a block to a new Block instance.
   *
   * @param {Object} o - An object representing a block, but not necessarily an instance of Block.
   *
   * @returns {ZksnarkBlock}
   */
  static deserializeBlock(o) {
    if (o instanceof Blockchain.cfg.blockClass) { return o; }

    let block = new Blockchain.cfg.blockClass();
    block.chainLength = parseInt(o.chainLength, 10);
    block.timestamp = o.timestamp;
    block.prevBlockHash = o.prevBlockHash;
    block.proof = o.proof;
    block.transactions = [];
    for (let i = 0; i < o.transactions.length; i++) {
      block.transactions.push(Blockchain.deserializeTransaction(o.transactions[i]));
    }
    block.coinbaseTransactions = [];
    for (let i = 0; i < o.coinbaseTransactions.length; i++) {
      block.coinbaseTransactions.push(Buffer.from(o.coinbaseTransactions[i]));
    }
    block.snlist = [];
    for (let i = 0; i < o.snlist.length; i++) {
      block.snlist.push(Buffer.from(o.snlist[i]));
    }
    block.cmlist = [];
    for (let i = 0; i < o.cmlist.length; i++) {
      block.cmlist.push(Buffer.from(o.cmlist[i]));
    }

    return block;
  }

  /**
   * Converts a string representation of a transaction to a new Transaction instance.
   *
   * @param {Object} o - An object representing a transaction, but not necessarily an instance of transaction.
   *
   * @returns {ZksnarkTransaction}
   */
  static deserializeTransaction(o) {
    if (o instanceof Blockchain.cfg.transactionClass) { return o; }

    let tx = new Blockchain.cfg.transactionClass();
    tx.proof = o.proof;
    tx.cm = Buffer.from(o.cm);
    return tx;
  }

  /**
   * Converts a string representation of a coin to a new Coin instance.
   *
   * @param {Object} o - An object representing a coin, but not necessarily an instance of coin.
   *
   * @returns {ZksnarkCoin}
   */
  static deserializeCoin(o) {
    if (o instanceof Blockchain.cfg.currencyClass) { return o; }

    let coin = new Blockchain.cfg.currencyClass()
    coin.cm = Buffer.from(o.cm);
    coin.r = Buffer.from(o.r);
    coin.sn = Buffer.from(o.sn);
    return coin;
  }

}
