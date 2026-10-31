const { batchRegistryContract } = require('../config/web3');

// Service for blockchain interactions

// Flag a batch as breached on the blockchain
async function flagBreach(batchId) {
  if (!batchRegistryContract) {
    throw new Error('Blockchain contract not initialized');
  }

  const tx = await batchRegistryContract.flagBreach(batchId);
  const receipt = await tx.wait();
  return receipt;
}

// Transfer batch custody
async function transferBatch(batchId, newCustodianAddress) {
  if (!batchRegistryContract) {
    throw new Error('Blockchain contract not initialized');
  }

  const tx = await batchRegistryContract.transferBatch(batchId, newCustodianAddress);
  const receipt = await tx.wait();
  return receipt;
}

// Confirm delivery of a batch
async function confirmDelivery(batchId) {
  if (!batchRegistryContract) {
    throw new Error('Blockchain contract not initialized');
  }

  const tx = await batchRegistryContract.confirmDelivery(batchId);
  const receipt = await tx.wait();
  return receipt;
}

// Get batch data from blockchain
async function getBatch(batchId) {
  if (!batchRegistryContract) {
    throw new Error('Blockchain contract not initialized');
  }

  return await batchRegistryContract.getBatch(batchId);
}

// Create a new batch
async function createBatch(drugName, manufacturerAddress) {
  if (!batchRegistryContract) {
    throw new Error('Blockchain contract not initialized');
  }

  const tx = await batchRegistryContract.createBatch(drugName);
  const receipt = await tx.wait();
  return receipt;
}

// Grant roles (for setup)
async function grantRole(role, account) {
  // This would need to be called on the AccessManager contract
  // For simplicity, we assume we have access to it
  // We'll need to import accessManagerContract from web3.js
  // For now, we'll leave it as a placeholder
  throw new Error('Not implemented');
}

module.exports = {
  flagBreach,
  transferBatch,
  confirmDelivery,
  getBatch,
  createBatch,
  grantRole
};