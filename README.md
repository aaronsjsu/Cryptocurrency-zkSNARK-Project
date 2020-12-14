# Implementing zk-SNARKs in SpartanGold
This is an SJSU class project for CS168 (Blockchain and Cryptocurrencies) completed Fall 2020. 

The goal of this project is to extend [SpartanGold](https://github.com/taustin/spartan-gold) (a simplified blockchain-based cryptocurrency for education and experimentation) to use zk-SNARKs to hide transaction details. This project is inspired by [Zcash](https://z.cash/) and it's solution for fixing Bitcoin's weak anonymity guarantees. A zk-SNARK is a Zero-Knowledge Succinct Non-Interactive Argument of Knowledge. Essentially, this is a special proof that can be used to prove (or "argue") that you know some information without revealing what that information is. In the case of my project, a spender of a coin (a basic unit of this currency) proves that they know the private parameters of a coin (these private parameters are kept secret and are used to form the coin) by using a zk-SNARK. If someone knows the private parameters of a coin then they can spend that coin. So a zk-SNARK is used to prove that a spender can spend a coin, while also not revealing which coin they're spending. In no way is the currency tied to an address like it might be in Bitcoin, nor can individual coins be tracked in transactions, which make transactions completely anonymous (i.e. transactions are public on the blockchain but no one can see any identifiable information on who is involved in the transaction). I will be using the existing [snarkjs](https://github.com/iden3/snarkjs) and [Circom](https://github.com/iden3/circom) libraries for my implementation.

## Installation
You'll need to have node (v14 or later) and npm installed. After cloning the repository, with npm install the following packages: spartan-gold, snarkjs, and circom. Then you can run the starter file driver.js by using node (you may run into npm installation issues like I did, if so you'll just have to do your best to figure it out). The file driver.js runs a basic simulation that demonstrates the code in this repository. 

## Other Notes
The file verifier.circom is the circom file that, once compiled to verifier.wasm, is used by the source code. The other files verification_key.json and circuit_final.zkey are created during the snarkjs setup process. Documentation on the snarkjs and circom setup can be found in their repositories: [snarkjs](https://github.com/iden3/snarkjs), [Circom](https://github.com/iden3/circom).

For a more detailed overview and explanation of this project, please review the Final Project Report.
