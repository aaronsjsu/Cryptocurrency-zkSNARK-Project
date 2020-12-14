"use strict";

const ZksnarkBlockchain = require('./zk-snark-blockchain.js');
const ZksnarkClient = require("./zk-snark-client.js");
const ZksnarkBlock = require("./zk-snark-block.js");
const zksnarkUtils = require("./zk-snark-utils.js");

/**
 * A ZksnarkMiner is a ZksnarkClient, but they also mine blocks and reward themselves if they
 * find a block proof before anyone else. Extends ZksnarkClient, but most of the additional
 * funcionality is copied directly from Miner in Spartan-Gold.
 */
module.exports = class ZksnarkMiner extends ZksnarkClient {

  /**
   * When a new miner is created, but the PoW search is **not** yet started.
   * The initialize method kicks things off.
   *
   * @constructor
   * @param {Object} obj - The properties of the client.
   * @param {String} [obj.name] - The miner's name, used for debugging messages.
   * * @param {Object} net - The network that the miner will use
   *      to send messages to all other clients.
   * @param {Block} [startingBlock] - The most recently ALREADY ACCEPTED block.
   * @param {Object} [obj.keyPair] - The public private keypair for the client.
   * @param {Number} [miningRounds] - The number of rounds a miner mines before checking
   *      for messages.  (In single-threaded mode with FakeNet, this parameter can
   *      simulate miners with more or less mining power.)
   */
  constructor({name, net, startingBlock, keyPair, miningRounds=ZksnarkBlockchain.NUM_ROUNDS_MINING} = {}) {
    super({name, net, startingBlock, keyPair});
    this.miningRounds=miningRounds;

    this.txCount = 0;
  }

  /**
   * Starts listeners and begins mining.
   */
  initialize() {
    this.log('initializing');
    this.startNewSearch();

    this.on(ZksnarkBlockchain.START_MINING, this.findProof);
    this.on(ZksnarkBlockchain.POST_TRANSACTION, this.addTransaction);

    setTimeout(() => this.emit(ZksnarkBlockchain.START_MINING), 0);
  }

  /**
   * Sets up the miner to start searching for a new block.
   *
   * @param {Set} [txSet] - Transactions the miner has that have not been accepted yet.
   */
  startNewSearch(txSet=new Set()) {
    this.log('starting new search');

    this.currentBlock = ZksnarkBlockchain.makeBlock(this.lastBlock);

    txSet.forEach((tx) => this.addTransaction(tx));

    // Start looking for a proof at 0.
    this.currentBlock.proof = 0;

    // In each block that we try to find a proof for, include the coinbase to pay this miner.
    this.addCoinbaseTransaction();
  }

  /**
   * Looks for a "proof".  It breaks after some time to listen for messages.  (We need
   * to do this since JS does not support concurrency).
   *
   * The 'oneAndDone' field is used for testing only; it prevents the findProof method
   * from looking for the proof again after the first attempt.
   *
   * @param {boolean} oneAndDone - Give up after the first PoW search (testing only).
   */
  findProof(oneAndDone=false) {
    let pausePoint = this.currentBlock.proof + this.miningRounds;
    while (this.currentBlock.proof < pausePoint) {
      if (this.currentBlock.hasValidProof()) {
        if (this.txCount !== this.currentBlock.snlist.length) {
          // This here is an attempt to fix a bug where the block transactions get out of sync.
          this.currentBlock.proof++;
          continue;
        }
        this.log(`found proof for block ${this.currentBlock.chainLength}: ${this.currentBlock.proof}`);
        this.announceProof();
        this.receiveBlock(this.currentBlock);
        this.startNewSearch();
        break;
      }
      this.currentBlock.proof++;
    }
    // If we are testing, don't continue the search.
    if (!oneAndDone) {
      // Check if anyone has found a block, and then return to mining.
      setTimeout(() => this.emit(ZksnarkBlockchain.START_MINING), 0);
    }
  }

  /**
   * Broadcast the block, with a valid proof included.
   */
  announceProof() {
    this.net.broadcast(ZksnarkBlockchain.PROOF_FOUND, this.currentBlock);
  }

  /**
   * Receives a block from another miner. If it is valid,
   * the block will be stored. If it is also a longer chain,
   * the miner will accept it and replace the currentBlock.
   *
   * @param {Block | Object} b - The block
   */
  receiveBlock(s) {
    let b = super.receiveBlock(s);
    if (b === null) return null;

    // We switch over to the new chain only if it is better.
    if (this.currentBlock && s.chainLength > this.currentBlock.chainLength) {
      this.log(`cutting over to new chain.`);
      let txSet = this.syncTransactions(s);
      this.startNewSearch(txSet);
    }
  }

  /**
   * This function should determine what transactions
   * need to be added or deleted.  It should find a common ancestor (retrieving
   * any transactions from the rolled-back blocks), remove any transactions
   * already included in the newly accepted blocks, and add any remaining
   * transactions to the new block.
   *
   * @param {Block} nb - The newly accepted block.
   *
   * @returns {Set} - The set of transactions that have not yet been accepted by the new block.
   */
  syncTransactions(nb) {
    let cb = this.currentBlock;
    let cbTxs = [];
    let nbTxs = [];

    // The new block may be ahead of the old block.  We roll back the new chain
    // to the matching height, collecting any transactions.
    while (nb.chainLength > cb.chainLength) {
      nb.transactions.forEach((tx) => nbTxs.push(tx));
      nb = this.blocks.get(nb.prevBlockHash);
    }

    // Step back in sync until we hit the common ancestor.
    while (cb && nb && cb.id !== nb.id) {
      // Store any transactions in the two chains.
      cb.transactions.forEach((tx) => cbTxs.push(tx));
      nb.transactions.forEach((tx) => nbTxs.push(tx));

      cb = this.blocks.get(cb.prevBlockHash);
      nb = this.blocks.get(nb.prevBlockHash);
    }

    // Remove all transactions that the new chain already has.
    nbTxs.forEach((tx) => {
      let index = cbTxs.indexOf(tx);
      cbTxs.splice(index, 1);
    });

    return cbTxs;
  }

  /**
   * Returns false if transaction is not accepted. Otherwise adds the transaction to
   * the current block. The verify function takes a while to run, so we first verify
   * the transaction, and once verified we add it to the current block (otherwise, by
   * the time the transaction is verified the miner may have moved onto another block).
   *
   * @param {Transaction | String} tx - The transaction to add.
   */
  async addTransaction(tx) {
    tx = ZksnarkBlockchain.deserializeTransaction(tx);
    let res = await this.currentBlock.verifyTransaction(tx, this);
    if (res) {
      this.log("transaction verified, adding it to the current block");
      this.txCount++;
      return this.currentBlock.addTransaction(res.tx, res.public_sn);
    }
  }

  /**
   * Adds a coinbase transaction to the block, awarding this miner if it finds a proof.
   */
  addCoinbaseTransaction() {
    for (let i = 0; i < ZksnarkBlockchain.COINBASE_AMT_ALLOWED; i++) {
      let coin = zksnarkUtils.createNewCoin();
      this.coins.push(coin);
      this.currentBlock.addCoinbaseTransaction(coin.cm);
    }
  }

  /**
   * The complement of postTransaction(). When one client calls postTransaction(), it'll
   * trigger the receiving client to call this method. This method takes a coin and turns it into
   * a new coin. To do this, it has to generate a proof, create a new coin, and then broadcast
   * that as a zksnarkTransaction. This does calls the superclass method from ZksnarkClient, and then
   * it calls addTransaction() to add it to the current block.
   *
   * @param {ZksnarkCoin} coin - The coin object that the payer sends to us.
   */
  async receiveTransaction(coin) {
    super.receiveTransaction(coin);
    this.addTransaction(tx);
  }

}
