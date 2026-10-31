const algorandService = require('../services/algorand.service');
const { query } = require('../config/db');

function sendError(res, error) {
  const status = Number(error.statusCode) || 500;
  console.error('Algorand API error:', error.message);
  return res.status(status).json({ success: false, error: error.message });
}

async function config(req, res) {
  res.json({ success: true, config: algorandService.getConfig() });
}

async function account(req, res) {
  try {
    return res.json({ success: true, account: await algorandService.getAccount(req.params.address) });
  } catch (error) {
    return sendError(res, error);
  }
}

async function prepareAppCall(req, res) {
  try {
    const prepared = await algorandService.prepareAppCall(req.body || {});
    return res.json({ success: true, transaction: prepared });
  } catch (error) {
    return sendError(res, error);
  }
}

async function submit(req, res) {
  try {
    const result = await algorandService.submitSignedTransaction(req.body?.signedTxn);
    return res.status(202).json({ success: true, transaction: result });
  } catch (error) {
    return sendError(res, error);
  }
}

async function confirm(req, res) {
  try {
    const result = await algorandService.waitForConfirmation(req.params.txId, req.query.timeoutRounds || 20);
    return res.json({ success: true, transaction: result });
  } catch (error) {
    return sendError(res, error);
  }
}

async function submitAndConfirm(req, res) {
  try {
    const submitted = await algorandService.submitSignedTransaction(req.body?.signedTxn);
    const confirmed = await algorandService.waitForConfirmation(submitted.txId, req.body?.timeoutRounds || 20);
    return res.json({ success: true, transaction: { ...submitted, ...confirmed } });
  } catch (error) {
    return sendError(res, error);
  }
}

async function lookup(req, res) {
  try {
    const transaction = await algorandService.lookupTransaction(req.params.txId);
    return res.json({ success: true, transaction });
  } catch (error) {
    return sendError(res, error);
  }
}

async function recordBatchTransaction(req, res) {
  try {
    const { batchId, drugName, manufacturer, algorandBatchId, txId, confirmedRound, state = 0 } = req.body || {};
    if (!txId || !manufacturer) {
      return res.status(400).json({ success: false, error: 'txId and manufacturer are required.' });
    }
    const localBatchId = batchId || `algo_${algorandBatchId || txId.slice(0, 16)}`;
    await query(
      `INSERT INTO batches
        (batch_id, drug_name, manufacturer, state, created_at, updated_at, chain, algorand_app_id, algorand_batch_id, algorand_tx_id, algorand_confirmed_round)
       VALUES ($1, $2, $3, $4, NOW(), NOW(), 'algorand', $5, $6, $7, $8)
       ON CONFLICT (batch_id) DO UPDATE SET
        state = EXCLUDED.state,
        updated_at = NOW(),
        chain = 'algorand',
        algorand_app_id = EXCLUDED.algorand_app_id,
        algorand_batch_id = EXCLUDED.algorand_batch_id,
        algorand_tx_id = EXCLUDED.algorand_tx_id,
        algorand_confirmed_round = EXCLUDED.algorand_confirmed_round`,
      [localBatchId, drugName || `Algorand Batch ${algorandBatchId || localBatchId}`, manufacturer, state, algorandService.getConfig().appId, algorandBatchId || null, txId, confirmedRound || null]
    );
    return res.status(201).json({ success: true, batchId: localBatchId, chain: 'algorand', txId, confirmedRound: confirmedRound || null });
  } catch (error) {
    return sendError(res, error);
  }
}

async function syncBatchTransaction(req, res) {
  try {
    const { batchId, state, txId, confirmedRound } = req.body || {};
    if (!batchId || !txId) return res.status(400).json({ success: false, error: 'batchId and txId are required.' });
    const result = await query(
      `UPDATE batches SET state = COALESCE($1, state), updated_at = NOW(), chain = 'algorand',
        algorand_app_id = $2, algorand_tx_id = $3, algorand_confirmed_round = $4
       WHERE batch_id = $5 RETURNING *`,
      [state ?? null, algorandService.getConfig().appId, txId, confirmedRound || null, batchId]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Batch not found.' });
    return res.json({ success: true, batch: result.rows[0] });
  } catch (error) {
    return sendError(res, error);
  }
}

async function recordTemperatureWithOracle(req, res) {
  try {
    const { batchId, temperatureCenti, observedAt, sensorAddress, evidenceHash } = req.body || {};
    const result = await algorandService.recordTemperatureWithOracle({
      batchId,
      temperatureCenti,
      observedAt,
      sensorAddress,
      evidenceHash,
    });
    return res.json({ success: true, transaction: result });
  } catch (error) {
    return sendError(res, error);
  }
}

async function flagBreachWithOracle(req, res) {
  try {
    const { batchId } = req.body || {};
    const result = await algorandService.flagBreachWithOracle({ batchId });
    return res.json({ success: true, transaction: result });
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = {
  config,
  account,
  prepareAppCall,
  submit,
  confirm,
  submitAndConfirm,
  lookup,
  recordBatchTransaction,
  syncBatchTransaction,
  recordTemperatureWithOracle,
  flagBreachWithOracle,
};
