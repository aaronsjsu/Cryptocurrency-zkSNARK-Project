"use strict";

/**
 * A ZksnarkTransaction holds all the details of a transaction that are published to the blockchain.
 * Since many transaction details are private, this only keeps track of a snarkjs proof and the new
 * coin to be minted. The proof holds all the required information to validate the transaction. Since
 * every transaction is turning an old coin into a new coin (except for coinbase transactions), the
 * transaction also takes the cm of the new coin to be published to the blockchain.
 */
module.exports = class ZksnarkTransaction {

  /**
   * Constructs a new transaction object.
   *
   * @param {proof} - The proper snarkjs proof for this transaction.
   * @param {Buffer} - The coin hash cm of the new coin to mint.
   */
  constructor(proof, cm) {
    this.proof = proof;
    this.cm = cm;
  }

}
