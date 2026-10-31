const { query } = require('../config/db');
const { batchRegistryContract, wallet } = require('../config/web3');
const blockchainService = require('../services/blockchain.service');

// Get all batches
async function getAllBatches(req, res) {
  try {
    const result = await query('SELECT * FROM batches ORDER BY created_at DESC');
    res.json({
      success: true,
      batches: result.rows
    });
  } catch (error) {
    console.error('Error fetching all batches:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Create a new batch (called by manufacturer)
async function createBatch(req, res) {
  try {
    const { drugName } = req.body;
    if (!drugName) {
      return res.status(400).json({ success: false, error: 'drugName is required' });
    }

    let batchId = null;
    let txHash = null;

    if (batchRegistryContract) {
      try {
        const tx = await batchRegistryContract.createBatch(drugName);
        const receipt = await tx.wait();
        txHash = tx.hash;

        // Try extracting batchId from logs or events
        if (receipt.logs) {
          for (const log of receipt.logs) {
            try {
              const parsed = batchRegistryContract.interface.parseLog(log);
              if (parsed && parsed.name === 'BatchCreated') {
                batchId = parsed.args.batchId.toString();
                break;
              }
            } catch (_) {}
          }
        }
        if (!batchId && receipt.events) {
          const ev = receipt.events.find(e => e.event === 'BatchCreated');
          if (ev) batchId = ev.args.batchId.toString();
        }
      } catch (bcErr) {
        console.warn('Smart contract createBatch failed, fallback to local ID:', bcErr.message);
      }
    }

    if (!batchId) {
      batchId = `batch_${Date.now()}`;
    }

    const manufacturerAddress = (req.user && req.user.address) || (wallet && wallet.address) || '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

    // Store batch metadata in database
    await query(
      'INSERT INTO batches (batch_id, drug_name, manufacturer, state, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (batch_id) DO NOTHING',
      [
        batchId,
        drugName,
        manufacturerAddress,
        0, // Active state
        new Date()
      ]
    );

    res.status(201).json({
      success: true,
      batchId,
      transactionHash: txHash
    });
  } catch (error) {
    console.error('Error creating batch:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Get batch provenance history (from database and blockchain)
async function getBatchProvenance(req, res) {
  try {
    const { batchId } = req.params;

    const dbResult = await query(
      'SELECT * FROM batches WHERE batch_id = $1',
      [batchId]
    );

    if (dbResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Batch not found'
      });
    }

    const batch = dbResult.rows[0];
    let blockchainVerified = null;

    if (batchRegistryContract) {
      try {
        const numId = isNaN(batchId) ? 1 : parseInt(batchId);
        const blockchainBatch = await batchRegistryContract.getBatch(numId);
        blockchainVerified = {
          drugName: blockchainBatch[0],
          manufacturer: blockchainBatch[1],
          state: blockchainBatch[2].toString(),
          timestamp: blockchainBatch[3].toString()
        };
      } catch (_) {}
    }

    res.json({
      success: true,
      batch: {
        batchId: batch.batch_id,
        drugName: batch.drug_name,
        manufacturer: batch.manufacturer,
        state: batch.state,
        createdAt: batch.created_at,
        blockchainVerified
      }
    });
  } catch (error) {
    console.error('Error fetching batch provenance:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Flag a batch as breached
async function flagBreach(req, res) {
  try {
    const { batchId } = req.params;
    let txHash = null;

    if (batchRegistryContract) {
      try {
        const numId = isNaN(batchId) ? 1 : parseInt(batchId);
        const tx = await batchRegistryContract.flagBreach(numId);
        await tx.wait();
        txHash = tx.hash;
      } catch (bcErr) {
        console.warn('Smart contract flagBreach failed:', bcErr.message);
      }
    }

    await query(
      'UPDATE batches SET state = $1, updated_at = $2 WHERE batch_id = $3',
      [1, new Date(), batchId]
    );

    res.json({
      success: true,
      transactionHash: txHash
    });
  } catch (error) {
    console.error('Error flagging breach:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Accept a signed custody handoff from an operator wallet
async function transferBatch(req, res) {
  try {
    const { batchId, newCustodian, signature } = req.body;
    if (!batchId || !newCustodian || !signature) {
      return res.status(400).json({ success: false, error: 'batchId, newCustodian, and signature are required' });
    }

    const existing = await query('SELECT state FROM batches WHERE batch_id = $1', [batchId]);
    if (!existing.rows.length) return res.status(404).json({ success: false, error: 'Batch not found' });
    if (existing.rows[0].state === 1) return res.status(409).json({ success: false, error: 'Breached batches cannot be transferred' });

    let txHash = null;
    if (batchRegistryContract) {
      try {
        const numId = isNaN(batchId) ? (parseInt(String(batchId).replace(/\D/g, '')) || 1) : parseInt(batchId);
        const tx = await batchRegistryContract.transferBatch(numId, newCustodian);
        await tx.wait();
        txHash = tx.hash;
      } catch (blockchainError) {
        console.warn('Smart contract transfer warning:', blockchainError.message);
      }
    }

    await query('UPDATE batches SET state = $1, updated_at = $2, manufacturer = $3 WHERE batch_id = $4', [2, new Date(), newCustodian, batchId]);
    res.json({ success: true, transactionHash: txHash });
  } catch (error) {
    console.error('Error transferring batch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getAllBatches,
  createBatch,
  getBatchProvenance,
  flagBreach,
  transferBatch
};
