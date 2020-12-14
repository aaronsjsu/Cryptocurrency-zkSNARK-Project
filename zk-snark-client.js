"use strict";

const { Client } = require("spartan-gold");
const snarkjs = require("snarkjs");
const fs = require("fs");
const ZksnarkBlockchain = require('./zk-snark-blockchain.js');
const ZksnarkTransaction = require("./zk-snark-transaction.js");
const ZksnarkCoin = require("./zk-snark-coin.js");
const zksnarkUtils = require("./zk-snark-utils.js");

/**
 * A ZksnarkClient keeps track of all the coins the client owns. It can also
 * make transactions by sending/receiving messages on the blockchain network.
 */
module.exports = class ZksnarkClient extends Client {

  /**
   * The net object determines how the client communicates
   * with other entities in the system. (This approach allows us to
   * simplify our testing setup.)
   *
   * @constructor
   * @param {Object} obj - The properties of the client.
   * @param {String} [obj.name] - The client's name, used for debugging messages.
   * @param {Object} obj.net - The network used by the client
   *    to send messages to all miners and clients.
   * @param {Block} [obj.startingBlock] - The starting point of the blockchain for the client.
   */
  constructor({name, net, startingBlock} = {}) {
    super({name, net, startingBlock});

    this.coins = [];
    this.on(ZksnarkBlockchain.SEND_COIN, this.receiveTransaction);
  }

  /*
   * Returns the number of coins that are spendable by the client (i.e. coins that haven't
   * been already spent and that are already on the blockchain).
   */
  get confirmedBalance() {
    let count = 0;
    for (let i = 0; i < this.coins.length; i++) {
      if (zksnarkUtils.listContains(this.lastConfirmedBlock.cmlist, this.coins[i].cm) &&
          !zksnarkUtils.listContains(this.lastConfirmedBlock.snlist, this.coins[i].sn)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Posts a transaction by sending a coin to the user specified by address.
   *
   * @param {String} address - The address of the client to send to.
   * @param {Integer} amt - The amount of coins to send
   */
  postTransaction(address, amt=1) {
    let validCoins = [];
    let i = 0;
    let j = 0;
    while (i < this.coins.length && j < amt) {
      let coin = this.coins[i];
      // Only add the coin if it is confirmed on the blockchain.
      if (zksnarkUtils.listContains(this.lastConfirmedBlock.cmlist, coin.cm)) {
        validCoins.push(coin);
        j++
      }
      i++;
    }
    if (validCoins.length !== amt) { // True if amt > client's confirmed coin count
      return;
    }
    for (i = 0; i < validCoins.length; i++) {
      let coin = validCoins[i];
      let index = this.coins.indexOf(coin);
      this.coins.splice(index, 1); // Removes the coin from the array.
      this.net.sendMessage(address, ZksnarkBlockchain.SEND_COIN, coin); // Send the coin
    }
  }

  /**
   * The complement of postTransaction() above. When one client calls postTransaction(), it'll
   * trigger the receiving client to call this method. This method takes a coin and turns it into
   * a new coin. To do this, it has to generate a proof, create a new coin, and then broadcast
   * that as a zksnarkTransaction.
   *
   * @param {ZksnarkCoin} coin - The coin object that the payer sends to us.
   */
  async receiveTransaction(coin) {
    coin = ZksnarkBlockchain.deserializeCoin(coin);

    // First, get sn, r, and cm in the proper format for the proof.
    let sn = zksnarkUtils.bufferToBitArray(coin.sn);
    let r = zksnarkUtils.bufferToBitArray(coin.r);
    let correctHash = zksnarkUtils.bufferToBitArray(coin.cm);

    // Get a random cm from the cmlist
    let cmlist = this.lastConfirmedBlock.cmlist;
    let random_cm;
    do {
      random_cm = cmlist[Math.floor(Math.random() * cmlist.length)];
    } while (random_cm === coin.cm)

    let badHash = zksnarkUtils.bufferToBitArray(random_cm);
    let input = {sn: sn, r: r};

    // Randomize which cm is the correct cm.
    if (Math.floor(Math.random() * 2) === 1) {
      input.cm1 = correctHash;
      input.cm2 = badHash;
      input.index = 0;
    } else {
      input.cm1 = badHash;
      input.cm2 = correctHash;
      input.index = 1;
    }

    // Generate proof
    let proof = await snarkjs.groth16.fullProve(input, "verifier.wasm", "circuit_final.zkey");
    // Now create a new coin and broadcast the transaction.
    let newCoin = zksnarkUtils.createNewCoin();
    this.coins.push(newCoin);
    let tx = new ZksnarkTransaction(proof, newCoin.cm);
    this.net.broadcast(ZksnarkBlockchain.POST_TRANSACTION, tx);
  }

  /**
   * Utitlity method used to initialize this client with the specified number of coins.
   * Returns the list of cm's, which is to be added to the genesis block.
   *
   * @param {Integer} amt - The number of coins to mint.
   *
   * @returns {Array[Buffer]} - The cm's of all the newly minted coins.
   */
  createInitialCoins(amt) {
    let cms = [];
    for (let i = 0; i < amt; i++) {
      this.coins.push(zksnarkUtils.createNewCoin());
      cms.push(this.coins[i].cm);
    }
    return cms;
  }

  /**
   * Validates and adds a block to the list of blocks, possibly updating the head
   * of the blockchain.  Any transactions in the block are rerun in order to
   * update the gold balances for all clients.  If any transactions are found to be
   * invalid due to lack of funds, the block is rejected and 'null' is returned to
   * indicate failure.
   *
   * If any blocks cannot be connected to an existing block but seem otherwise valid,
   * they are added to a list of pending blocks and a request is sent out to get the
   * missing blocks from other clients.
   *
   * @param {Block | Object} block - The block to add to the clients list of available blocks.
   *
   *  @returns {Block | null} The block with rerun transactions, or null for an invalid block.
   */
  receiveBlock(block) {
    // If the block is a string, then deserialize it.
    block = ZksnarkBlockchain.deserializeBlock(block);

    // Ignore the block if it has been received previously.
    if (this.blocks.has(block.id)) return null;

    // First, make sure that the block has a valid proof.
    if (!block.hasValidProof() && !block.isGenesisBlock()) {
      this.log(`Block ${block.id} does not have a valid proof.`);
      return null;
    }

    // Make sure that we have the previous blocks, unless it is the genesis block.
    // If we don't have the previous blocks, request the missing blocks and exit.
    let prevBlock = this.blocks.get(block.prevBlockHash);
    if (!prevBlock && !block.isGenesisBlock()) {
      let stuckBlocks = this.pendingBlocks.get(block.prevBlockHash);
      // If this is the first time that we have identified this block as missing,
      // send out a request for the block.
      if (stuckBlocks === undefined) {
        this.requestMissingBlock(block);
        stuckBlocks = new Set();
      }
      stuckBlocks.add(block);

      this.pendingBlocks.set(block.prevBlockHash, stuckBlocks);
      return null;
    }

    // Storing the block.
    this.blocks.set(block.id, block);

    // If it is a better block than the client currently has, set that
    // as the new currentBlock, and update the lastConfirmedBlock.
    if (this.lastBlock.chainLength < block.chainLength) {
      this.lastBlock = block;
      this.setLastConfirmed();
    }

    // Go through any blocks that were waiting for this block
    // and recursively call receiveBlock.
    let unstuckBlocks = this.pendingBlocks.get(block.id) || [];
    // Remove these blocks from the pending set.
    this.pendingBlocks.delete(block.id);
    unstuckBlocks.forEach((b) => {
      this.log(`Processing unstuck block ${b.id}`);
      this.receiveBlock(b);
    });
    return block;
  }

}
