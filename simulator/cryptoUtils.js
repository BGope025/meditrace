const { ethers } = require('ethers');

/**
 * Sign a payload using an Ethereum private key
 * @param {Object} payload - The payload to sign (will be JSON stringified)
 * @param {string} privateKey - Ethereum private key (hex string)
 * @returns {Promise<string>} Hexadecimal signature
 */
async function signPayload(payload, privateKey) {
  // Create a wallet from the private key
  const wallet = new ethers.Wallet(privateKey);

  // Convert payload to JSON string
  const payloadString = JSON.stringify(payload);

  // Sign the message
  const signature = await wallet.signMessage(payloadString);

  return signature;
}

/**
 * Verify a signature (for backend use)
 * @param {Object} payload - The original payload
 * @param {string} signature - The hexadecimal signature
 * @param {string} publicKey - The Ethereum address public key
 * @returns {boolean} True if signature is valid
 */
function verifyPayload(payload, signature, publicKey) {
  // Recover the address from the signature
  const verifyFn = ethers.verifyMessage || (ethers.utils && ethers.utils.verifyMessage);
  const address = verifyFn(payloadString, signature);

  // Check if recovered address matches the public key
  return address.toLowerCase() === publicKey.toLowerCase();
}

module.exports = {
  signPayload,
  verifyPayload
};