const snarkjs = require("snarkjs");
const fs = require("fs");
const crypto = require("crypto");
const zksnarkUtils = require("./zk-snark-utils.js");
const ZKSnarkBlockchain = require('./zk-snark-blockchain.js');
const ZKSnarkBlock = require('./zk-snark-block.js');
const ZKSnarkClient = require('./zk-snark-client.js');
const ZKSnarkMiner = require('./zk-snark-miner.js');
const ZKSnarkTransaction = require('./zk-snark-transaction.js');
const ZKSnarkCoin = require('./zk-snark-coin.js');

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
    // Test block serialization/deserialization
    let initialCoins = [];
    initialCoins.push(ZKSnarkCoin.createNewCoin().cm);
    initialCoins.push(ZKSnarkCoin.createNewCoin().cm);
    let genesisBlock = ZKSnarkBlockchain.makeGenesis({
        blockClass: ZKSnarkBlock,
        transactionClass: ZKSnarkTransaction,
        currencyClass: ZKSnarkCoin.ZksnarkCoin,
        powLeadingZeroes: 12,
        coinbaseAmount: 1
    }, initialCoins);
    let serializedBlock = JSON.parse(JSON.stringify(genesisBlock));
    let deserializedBlock = ZKSnarkBlockchain.deserializeBlock(serializedBlock);
    console.log("\nExpect true:");
    let equals = true;
    if (!(deserializedBlock instanceof ZKSnarkBlock)) { equals = false; }
    if (genesisBlock.prevBlockHash !== deserializedBlock.prevBlockHash) { equals = false; }
    if (genesisBlock.proof !== deserializedBlock.proof) { equals = false; }
    if (genesisBlock.prevBlockHash !== deserializedBlock.prevBlockHash) { equals = false; }
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
    let cm = ZKSnarkCoin.createNewCoin().cm;
    let tx = new ZKSnarkTransaction(proof, cm);
    let serializedTx = JSON.parse(JSON.stringify(tx));
    let deserializedTx = ZKSnarkBlockchain.deserializeTransaction(serializedTx);
    console.log("\nExpect true:");
    equals = true;
    if (!(deserializedTx instanceof ZKSnarkTransaction)) { equals = false; }
    let vKey = JSON.parse(fs.readFileSync("verification_key.json"));
    equals = await snarkjs.groth16.verify(vKey, proof.publicSignals, proof.proof);
    if (tx.cm.compare(deserializedTx.cm) !== 0) { equals = false; }
    console.log(equals);


    // Test coin serialization/deserialization
    let coin = ZKSnarkCoin.createNewCoin();
    let serializedCoin = JSON.parse(JSON.stringify(coin));
    let deserializedCoin = ZKSnarkBlockchain.deserializeCoin(serializedCoin);
    console.log("\nExpect true:");
    equals = true;
    if (!(deserializedCoin instanceof ZKSnarkCoin.ZksnarkCoin)) { equals = false; }
    if (coin.cm.compare(deserializedCoin.cm) !== 0) { equals = false; }
    if (coin.r.compare(deserializedCoin.r) !== 0) { equals = false; }
    if (coin.sn.compare(deserializedCoin.sn) !== 0) { equals = false; }
    console.log(equals);
}

testSerializations().then(() => {
    process.exit(0);
});
