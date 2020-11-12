include "node_modules/circomlib/circuits/sha256/sha256.circom";

// This is the verification circuit for my zk-SNARK implementation project.
// It works by first calculating the hash sha256(r||sn), i.e. the hash of r concatenated with sn.
// This result is then compared to cm1 or cm2, depending on the value of index. If the hash equals
// the cm that it's compared to, then a valid proof is created. The reason that there are two cm 
// values accepted as input is because these are public values for others on the blockchain to verify.
// They won't know which cm value is the correct one for the coin, but they will know that the coin 
// cm is indeed on the cmlist. In other terms, this circuit is used to prove: "I know r, such that 
// sha256(r||sn) appears in the list of valid coins"
//
// It takes as input: 
//   cm1: a 256 bit array, contains a hash that is in the cmlist
//   cm2: a 256 bit array, contains a hash that is in the cmlist
//   r: 256 bit array
//   sn: 256 bit array 
//   index: the value 0 or 1, 0 if cm1 is the correct hash, 1 if cm2 is correct


template Verify() {

    var HASH_LENGTH = 256;

    signal input cm1[HASH_LENGTH];
    signal input cm2[HASH_LENGTH];
    signal input sn[HASH_LENGTH];
    signal private input r[HASH_LENGTH];
    signal private input index;
    
    signal switcher[256];


    // First compute sha256(r||sn)
    component hash = Sha256(HASH_LENGTH * 2);
    for (var i = 0; i < HASH_LENGTH; i++) {
        hash.in[i] <== r[i];
        hash.in[i + HASH_LENGTH] <== sn[i];
    }
    
    // Now compare the hash to one of the cmlist inputs, specified by index
    for (var i = 0; i < HASH_LENGTH; i++) {
        // 'switcher' is used to break this constraint into two lines, the circom compiler doesn't like it when I do it all on the same line
        switcher[i] <== (cm2[i] * index); 
        hash.out[i] === (cm1[i] * (1 - index)) + switcher[i];
    }

    // At this point, we've verified that hash(r||sn) is indeed equivalent to cm1 or cm2
}
component main = Verify();

