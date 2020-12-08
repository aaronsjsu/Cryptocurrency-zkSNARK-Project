const snarkjs = require("snarkjs");
const fs = require("fs");
const crypto = require("crypto");
const ZksnarkBlockchain = require('./zk-snark-blockchain.js');
const ZksnarkTransaction = require('./zk-snark-transaction.js');
const ZksnarkBlock = require('./zk-snark-block.js');
const ZksnarkCoin = require('./zk-snark-coin.js');
const zksnarkUtils = require("./zk-snark-utils.js");

async function testCircuit() {

  // The output of each hash is a byte buffer
  let snBuf = crypto.createHash("sha256").update("random text 1").digest();
  let rBuf = crypto.createHash("sha256").update("random text 2").digest();

  let buf = Buffer.alloc(snBuf.length * 2);
  buf.fill(snBuf, snBuf.length);
  buf.fill(rBuf, 0, rBuf.length);

  let correctHashBuf = crypto.createHash("sha256").update(buf).digest(); // corectHash = sha256(r||sn)
  let badHashBuf = crypto.createHash("sha256").update("random text 3").digest();

  // Circuit takes bit array as input, convert from byte buffer to bit array
  let sn = zksnarkUtils.bufferToBitArray(snBuf);
  let r = zksnarkUtils.bufferToBitArray(rBuf);
  let correctHash = zksnarkUtils.bufferToBitArray(correctHashBuf);
  let badHash = zksnarkUtils.bufferToBitArray(badHashBuf);


  // Generate proof
  let input = {cm1: correctHash, cm2: badHash, sn: sn, r: r, index: 0};
  let proof = await snarkjs.groth16.fullProve(input, "verifier.wasm", "circuit_final.zkey");
  let publicSignals = proof.publicSignals;

  // Verify proof
  let vKey = JSON.parse(fs.readFileSync("verification_key.json"));
  let res = await snarkjs.groth16.verify(vKey, proof.publicSignals, proof.proof);
  console.log("\nExpect valid:");
  if (res === true) {
    console.log("Verification OK");
  } else {
    console.log("Invalid proof");
  }

  // Now run it again but switch index
  input = {cm1: badHash, cm2: correctHash, sn: sn, r: r, index: 1};
  proof = await snarkjs.groth16.fullProve(input, "verifier.wasm", "circuit_final.zkey");

  // Verify proof
  res = await snarkjs.groth16.verify(vKey, proof.publicSignals, proof.proof);
  console.log("\nExpect valid:");
  if (res === true) {
    console.log("Verification OK");
  } else {
    console.log("Invalid proof");
  }

  // Now run it again but make sure the proof is invalid by giving incorrect index
  input = {cm1: correctHash, cm2: badHash, sn: sn, r: r, index: 1};
  proof = await snarkjs.groth16.fullProve(input, "verifier.wasm", "circuit_final.zkey");

  // Verify proof
  res = await snarkjs.groth16.verify(vKey, proof.publicSignals, proof.proof);
  console.log("\nExpect invalid:");
  if (res === true) {
    console.log("Verification OK");
  } else {
    console.log("Invalid proof");
  }

  // Now run it again, make sure it's invalid and swith the indices
  input = {cm1: badHash, cm2: correctHash, sn: sn, r: r, index: 0};
  proof = await snarkjs.groth16.fullProve(input, "verifier.wasm", "circuit_final.zkey");

  // Verify proof
  res = await snarkjs.groth16.verify(vKey, proof.publicSignals, proof.proof);
  console.log("\nExpect invalid:");
  if (res === true) {
    console.log("Verification OK");
  } else {
    console.log("Invalid proof");
  }

}

async function testUtils() {
  let snBuf = crypto.createHash("sha256").update("random text 1").digest();
  let rBuf = crypto.createHash("sha256").update("random text 2").digest();
  let buf = Buffer.alloc(snBuf.length * 2);
  buf.fill(snBuf, snBuf.length);
  buf.fill(rBuf, 0, rBuf.length);
  let correctHashBuf = crypto.createHash("sha256").update(buf).digest(); // corectHash = sha256(r||sn)
  let badHashBuf = crypto.createHash("sha256").update("random text 3").digest();
  let sn = zksnarkUtils.bufferToBitArray(snBuf);
  let r = zksnarkUtils.bufferToBitArray(rBuf);
  let correctHash = zksnarkUtils.bufferToBitArray(correctHashBuf);
  let badHash = zksnarkUtils.bufferToBitArray(badHashBuf);
  let input = {cm1: correctHash, cm2: badHash, sn: sn, r: r, index: 0};
  let proof = await snarkjs.groth16.fullProve(input, "verifier.wasm", "circuit_final.zkey");
  let publicSignals = proof.publicSignals;

  // Test parsePublicSignals()
  let [public_cm1, public_cm2, public_sn] = zksnarkUtils.parsePublicSignals(publicSignals);
  console.log("\nExpect true:");
  console.log(public_cm1.equals(correctHashBuf));
  console.log(public_cm2.equals(badHashBuf));
  console.log(public_sn.equals(snBuf));
}

async function testSerializations() {
  // Initialize
  let initialCoins = [];
  initialCoins.push(zksnarkUtils.createNewCoin().cm);
  initialCoins.push(zksnarkUtils.createNewCoin().cm);
  let genesisBlock = ZksnarkBlockchain.makeGenesis({
    blockClass: ZksnarkBlock,
    transactionClass: ZksnarkTransaction,
    currencyClass: ZksnarkCoin,
    powLeadingZeroes: 12,
    coinbaseAmount: 1
  }, initialCoins);

  // Test transaction serialization/deserialization
  let snBuf = crypto.createHash("sha256").update("random text 1").digest();
  let rBuf = crypto.createHash("sha256").update("random text 2").digest();
  let buf = Buffer.alloc(snBuf.length * 2);
  buf.fill(snBuf, snBuf.length);
  buf.fill(rBuf, 0, rBuf.length);
  let correctHashBuf = crypto.createHash("sha256").update(buf).digest(); // corectHash = sha256(r||sn)
  let badHashBuf = crypto.createHash("sha256").update("random text 3").digest();
  let sn = zksnarkUtils.bufferToBitArray(snBuf);
  let r = zksnarkUtils.bufferToBitArray(rBuf);
  let correctHash = zksnarkUtils.bufferToBitArray(correctHashBuf);
  let badHash = zksnarkUtils.bufferToBitArray(badHashBuf);
  let input = {cm1: correctHash, cm2: badHash, sn: sn, r: r, index: 0};
  let proof = await snarkjs.groth16.fullProve(input, "verifier.wasm", "circuit_final.zkey");
  let cm = zksnarkUtils.createNewCoin().cm;
  let tx = new ZksnarkTransaction(proof, cm);
  let serializedTx = JSON.parse(JSON.stringify(tx));
  let deserializedTx = ZksnarkBlockchain.deserializeTransaction(serializedTx);
  console.log("\nTesting transaction serialization. Expect true:");
  let equals = true;
  if (!(deserializedTx instanceof ZksnarkTransaction)) { equals = false; }
  let vKey = JSON.parse(fs.readFileSync("verification_key.json"));
  equals = await snarkjs.groth16.verify(vKey, proof.publicSignals, proof.proof);
  if (deserializedTx.cm === undefined) { equals = false; }
  if (tx.cm.compare(deserializedTx.cm) !== 0) { equals = false; }
  if (tx.id !== deserializedTx.id) { equals = false; }
  console.log(equals);

  // Test block serialization/deserialization
  genesisBlock.transactions.set(tx.id, tx);
  genesisBlock.snlist.push(zksnarkUtils.createNewCoin().sn);
  genesisBlock.coinbaseTransactions.push(zksnarkUtils.createNewCoin().cm);
  let serializedBlock = JSON.parse(JSON.stringify(genesisBlock));
  let deserializedBlock = ZksnarkBlockchain.deserializeBlock(serializedBlock);
  console.log("\nTesting block serialization. Expect true:");
  equals = true;
  if (!(deserializedBlock instanceof ZksnarkBlock)) { equals = false; }
  if (genesisBlock.prevBlockHash !== deserializedBlock.prevBlockHash) { equals = false; }
  if (genesisBlock.proof !== deserializedBlock.proof) { equals = false; }
  if (genesisBlock.prevBlockHash !== deserializedBlock.prevBlockHash) { equals = false; }
  for (let [txId, tx] of genesisBlock.transactions) {
    if (tx.cm.compare(deserializedBlock.transactions.get(txId).cm) !== 0) {
      equals = false;
    } else {
      let dtx = deserializedBlock.transactions.get(txId);
      equals = await snarkjs.groth16.verify(vKey, dtx.proof.publicSignals, dtx.proof.proof);
    }
  }
  for (let i = 0; i < genesisBlock.cmlist.length; i++) {
    if (genesisBlock.cmlist[i].compare(deserializedBlock.cmlist[i]) !== 0) {
      equals = false;
    }
  }
  for (let i = 0; i < genesisBlock.snlist.length; i++) {
    if (genesisBlock.snlist[i].compare(deserializedBlock.snlist[i]) !== 0) {
      equals = false;
    }
  }
  for (let i = 0; i < genesisBlock.coinbaseTransactions.length; i++) {
    if (genesisBlock.coinbaseTransactions[i].compare(deserializedBlock.coinbaseTransactions[i]) !== 0) {
      equals = false;
    }
  }
  console.log(equals);

  // Test coin serialization/deserialization
  let coin = zksnarkUtils.createNewCoin();
  let serializedCoin = JSON.parse(JSON.stringify(coin));
  let deserializedCoin = ZksnarkBlockchain.deserializeCoin(serializedCoin);
  console.log("\nTesting coin serialization. Expect true:");
  equals = true;
  if (!(deserializedCoin instanceof ZksnarkCoin)) { equals = false; }
  if (coin.cm.compare(deserializedCoin.cm) !== 0) { equals = false; }
  if (coin.r.compare(deserializedCoin.r) !== 0) { equals = false; }
  if (coin.sn.compare(deserializedCoin.sn) !== 0) { equals = false; }
  console.log(equals);
}

testCircuit().then(() => {
  process.exit(0);
});
