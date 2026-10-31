import algosdk from 'algosdk';

const account = algosdk.generateAccount();
const mnemonic = algosdk.secretKeyToMnemonic(account.sk);

console.log('\n======================================================');
console.log('✨ Fresh Algorand TestNet Account Generated');
console.log('======================================================');
console.log(`\n📌 Public Address:\n${account.addr.toString()}`);
console.log(`\n🔑 25-Word Mnemonic:\n"${mnemonic}"`);
console.log('\n======================================================');
console.log('Next Steps:');
console.log('1. Go to: https://bank.testnet.algorand.network/');
console.log('2. Paste the Public Address above to get free TestNet ALGO.');
console.log('3. Set DEPLOYER_MNEMONIC in .env.algorand to the mnemonic above.');
console.log('4. Run: npm run deploy:testnet');
console.log('======================================================\n');
