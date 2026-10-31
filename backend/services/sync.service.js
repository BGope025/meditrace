const { batchRegistryContract } = require('../config/web3');
const { query } = require('../config/db');

let listeners = {};

// Start listening to blockchain events
async function startEventListeners() {
  if (!batchRegistryContract) {
    console.warn('Blockchain contract not initialized, skipping event listeners');
    return;
  }

  console.log('Starting blockchain event listeners...');

  // Listen for BatchCreated events
  batchRegistryContract.on('BatchCreated', async (batchId, drugName, manufacturer, timestamp, event) => {
    try {
      console.log(`BatchCreated event received: batchId=${batchId}`);

      // Insert or update batch in database
      await query(
        `INSERT INTO batches (batch_id, drug_name, manufacturer, state, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (batch_id) DO UPDATE SET
           drug_name = EXCLUDED.drug_name,
           manufacturer = EXCLUDED.manufacturer,
           created_at = EXCLUDED.created_at`,
        [
          batchId.toString(),
          drugName,
          manufacturer,
          0, // Active state (default)
          new Date(timestamp * 1000) // Convert seconds to milliseconds
        ]
      );
    } catch (error) {
      console.error('Error handling BatchCreated event:', error);
    }
  });

  // Listen for StateChanged events
  batchRegistryContract.on('StateChanged', async (batchId, oldState, newState, timestamp, event) => {
    try {
      console.log(`StateChanged event received: batchId=${batchId}, oldState=${oldState}, newState=${newState}`);

      // Update batch state in database
      await query(
        'UPDATE batches SET state = $1, updated_at = $2 WHERE batch_id = $3',
        [
          newState.toString(),
          new Date(timestamp * 1000),
          batchId.toString()
        ]
      );
    } catch (error) {
      console.error('Error handling StateChanged event:', error);
    }
  });

  // We could also listen for other events if needed

  // Store listeners so we can remove them later if needed
  listeners.batchCreated = batchRegistryContract.listeners('BatchCreated').length;
  listeners.stateChanged = batchRegistryContract.listeners('StateChanged').length;
}

// Stop listening to blockchain events (useful for testing or shutdown)
async function stopEventListeners() {
  if (!batchRegistryContract) return;

  console.log('Stopping blockchain event listeners...');
  batchRegistryContract.removeAllListeners('BatchCreated');
  batchRegistryContract.removeAllListeners('StateChanged');
  listeners = {};
}

module.exports = {
  startEventListeners,
  stopEventListeners
};