"use strict";

const ZksnarkBlockchain = require('./zk-snark-blockchain.js');
const ZksnarkBlock = require('./zk-snark-block.js');
const ZksnarkClient = require('./zk-snark-client.js');
const ZksnarkMiner = require('./zk-snark-miner.js');
const ZksnarkTransaction = require('./zk-snark-transaction.js');
const ZksnarkCoin = require('./zk-snark-coin.js');
const { FakeNet } = require('Spartan-Gold');

console.log("Starting simulation.  This may take a moment...\n");


let fakeNet = new FakeNet();

// Clients
let alice = new ZksnarkClient({name: "Alice", net: fakeNet});
let bob = new ZksnarkClient({name: "Bob", net: fakeNet});
let charlie = new ZksnarkClient({name: "Charlie", net: fakeNet});

// Miners
let minnie = new ZksnarkMiner({name: "Minnie", net: fakeNet});
let mickey = new ZksnarkMiner({name: "Mickey", net: fakeNet});

// Start each client and miner off with 10 coins
let initialCoins = [];
let initAmt = 4;
initialCoins = initialCoins.concat(alice.createInitialCoins(initAmt));
initialCoins = initialCoins.concat(bob.createInitialCoins(initAmt));
initialCoins = initialCoins.concat(charlie.createInitialCoins(initAmt));
initialCoins = initialCoins.concat(minnie.createInitialCoins(initAmt));
initialCoins = initialCoins.concat(mickey.createInitialCoins(initAmt));

// Creating genesis block
let genesis = ZksnarkBlockchain.makeGenesis({
  blockClass: ZksnarkBlock,
  transactionClass: ZksnarkTransaction,
  currencyClass: ZksnarkCoin,
  powLeadingZeroes: 14,
  coinbaseAmount: 1
}, initialCoins);

alice.setGenesisBlock(ZksnarkBlockchain.copyBlock(genesis));
bob.setGenesisBlock(ZksnarkBlockchain.copyBlock(genesis));
charlie.setGenesisBlock(ZksnarkBlockchain.copyBlock(genesis));
minnie.setGenesisBlock(ZksnarkBlockchain.copyBlock(genesis));
mickey.setGenesisBlock(ZksnarkBlockchain.copyBlock(genesis));

function showBalances() {
  console.log(`Alice has ${alice.confirmedBalance} coins.`);
  console.log(`Bob has ${bob.confirmedBalance} coins.`);
  console.log(`Charlie has ${charlie.confirmedBalance} coins.`);
  console.log(`Minnie has ${minnie.confirmedBalance} coins.`);
  console.log(`Mickey has ${mickey.confirmedBalance} coins.\n`);
}

// Showing the initial balances from Alice's perspective, for no particular reason.
console.log("Initial balances:");
showBalances();

fakeNet.register(alice, bob, charlie, minnie, mickey);

// Miners start mining.
minnie.initialize();
mickey.initialize();

// Transfer some money around.
console.log(`Charlie is transferring 2 coins to ${bob.address}`);
charlie.postTransaction(bob.address, 2);
console.log(`Charlie is transferring 2 coin to ${alice.address}`);
charlie.postTransaction(alice.address, 2);
console.log(`Alice is transferring a coin to ${bob.address}`);
alice.postTransaction(bob.address);
console.log(`Alice is transferring a coin to ${bob.address}`);
alice.postTransaction(bob.address);

// Print out the final balances after it has been running for some time.
setTimeout(() => {
  console.log();
  console.log(`Minnie has a chain of length ${minnie.currentBlock.chainLength}`);
  console.log(`Mickey has a chain of length ${mickey.currentBlock.chainLength}`);
  console.log("Final balances:");
  console.log(`Alice has ${alice.confirmedBalance} coins.`);
  console.log(`Bob has ${bob.confirmedBalance} coins.`);
  console.log(`Charlie has ${charlie.confirmedBalance} coins.`);
  console.log(`Minnie has ${minnie.confirmedBalance} coins.`);
  console.log(`Mickey has ${mickey.confirmedBalance} coins.`);
  process.exit(0);
}, 90000);
