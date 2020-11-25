"use strict";

const { Client, utils } = require("spartan-gold");

const ZksnarkCoin = require("./zk-snark-coin.js");
const ZksnarkTransaction = require("./zk-snark-transaction.js");
const zksnarkUtils = require("./zk-snark-utils.js");
const Blockchain = require('./zk-snark-blockchain.js');

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

    this.coins[];
    this.on(Blockchain.SEND_COIN, this.receiveTransaction);
  }

  /*
   * Returns the number of coins that are spendable by the client (i.e. coins that haven't
   * been already spent and that are already on the blockchain).
   */
  get confirmedBalance() {
    let count = 0;
    for (let i = 0; i < this.coins.length; i++) {
      if (this.lastConfirmedBlock.cmlist.contains(this.coins[i].cm)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Posts a transaction by sending a coin to the user specified by address.
   *
   * @param {String} address - The address of the client to send to.
   */
  postTransaction(address) {
    let coin = this.coins[0];
    if (coin === undefined) { return; }
    this.coins.splice(0, 1); // Removes the coin from the array.
    this.net.sendMessage(address, Blockchain.SEND_COIN, coin);
  }

  /**
   * The complement of postTransaction() above. When one client calls postTransaction(), it'll
   * trigger the receiving client to call this method. This method takes a coin and turns it into
   * a new coin. To do this, it has to generate a proof, create a new coin, and then broadcast
   * that as a ZksnarkTransaction.
   *
   * @param {ZksnarkCoin} coin - The coin object that the payer sends to us.
   */
  receiveTransaction(coin) {
    // First, get sn, r, and cm in the proper format for the proof.
    let sn = zksnarkUtils.bufferToBitArray(coin.sn);
    let r = zksnarkUtils.bufferToBitArray(coin.r);
    let correctHash = zksnarkUtils.bufferToBitArray(coin.cm);
    // Get a random cm from the cmlist
    let cmlist = this.lastConfirmedBlock.cmlist;
    let random_cm;
    do {
      random_cm = cmlist[Math.floor(Math.random() * cmlist.length)];
    } while (random_cm !== coin.cm)
    let badHash = zksnarkUtils.bufferToBitArray(random_cm);
    let input = {sn: sn, r: r, index: 0};

    // Randomize which cm is the correct cm.
    if (Math.floor(Math.random() * 2) === 1) {
      input.cm1 = correctHash;
      input.cm2 = badHash;
    } else {
      input.cm1 = badHash;
      input.cm2 = correctHash;
    }

    // Generate proof
    let proof = await snarkjs.groth16.fullProve(input, "circuit.wasm", "circuit_final.zkey");

    // Now create a new coin and broadcast the transaction.
    let newCoin = ZksnarkCoin.createNewCoin();
    this.coins.push(newCoin);
    this.net.broadcast(Blockchain.POST_TRANSACTION, new ZksnarkTransaction(proof, newCoin.cm));
  }

}
