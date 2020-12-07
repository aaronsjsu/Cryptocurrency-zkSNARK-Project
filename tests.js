const snarkjs = require("snarkjs");
const fs = require("fs");
const crypto = require("crypto");
const zksnarkUtils = require("./zk-snark-utils.js");


async function run() {

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


    // Test parsePublicSignals()
    let [public_cm1, public_cm2, public_sn] = zksnarkUtils.parsePublicSignals(publicSignals);
    console.log("\nExpect true:");
    console.log(public_cm1.equals(correctHashBuf));
    console.log(public_cm2.equals(badHashBuf));
    console.log(public_sn.equals(snBuf));

}

run().then(() => {
    process.exit(0);
});
