const { query } = require('../config/db');
const { batchRegistryContract } = require('../config/web3');
const { keccak256, toUtf8Bytes } = require('ethers');
const algorandService = require('../services/algorand.service');

const SAFE_MIN_TEMP = 2;
const SAFE_MAX_TEMP = 8;

function numericBatchId(batchId) {
  return isNaN(batchId) ? (parseInt(String(batchId).replace(/\D/g, ''), 10) || 1) : parseInt(batchId, 10);
}

async function ensureBatch(batchId) {
  await query(
    `INSERT INTO batches (batch_id, drug_name, manufacturer, state, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (batch_id) DO NOTHING`,
    [batchId, `Pharmaceutical Batch ${batchId}`, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 0]
  );
}

async function flagBreachIfNeeded(batchId, temperature, payload, sensorAddress) {
  if (temperature >= SAFE_MIN_TEMP && temperature <= SAFE_MAX_TEMP) return false;

  const stateResult = await query('SELECT state FROM batches WHERE batch_id = $1', [batchId]);
  if (!stateResult.rows.length || stateResult.rows[0].state === 1) return true;

  if (batchRegistryContract) {
    try {
      const evidenceHash = keccak256(toUtf8Bytes(JSON.stringify(payload)));
      const observedAt = Math.floor(new Date(payload.timestamp).getTime() / 1000);
      const temperatureCenti = Math.round(temperature * 100);
      const tx = await batchRegistryContract.recordTemperature(
        numericBatchId(batchId),
        temperatureCenti,
        observedAt,
        sensorAddress,
        evidenceHash
      );
      await tx.wait();
    } catch (blockchainError) {
      // The database remains the source for the API read model if the chain is unavailable.
      console.warn('Smart contract breach warning:', blockchainError.message);
    }
  }

  // Anchor breach on Algorand TestNet if configured
  if (process.env.ALGORAND_APP_ID && process.env.ALGORAND_ORACLE_MNEMONIC) {
    try {
      const evidenceHash = keccak256(toUtf8Bytes(JSON.stringify(payload)));
      const observedAt = Math.floor(new Date(payload.timestamp).getTime() / 1000);
      const temperatureCenti = Math.round(temperature * 100);
      const algoResult = await algorandService.recordTemperatureWithOracle({
        batchId: numericBatchId(batchId),
        temperatureCenti,
        observedAt,
        sensorAddress,
        evidenceHash,
      });
      console.log(`Algorand on-chain breach recorded: Tx ${algoResult.txId} in round ${algoResult.confirmedRound}`);
      await query(
        `UPDATE batches SET 
          state = 1, 
          updated_at = NOW(), 
          chain = 'algorand', 
          algorand_tx_id = $1, 
          algorand_confirmed_round = $2 
         WHERE batch_id = $3`,
        [algoResult.txId, algoResult.confirmedRound, batchId]
      );
    } catch (algoError) {
      console.warn('Algorand smart contract breach warning:', algoError.message);
    }
  }

  await query('UPDATE batches SET state = $1, updated_at = $2 WHERE batch_id = $3', [1, new Date(), batchId]);
  console.log(`Batch ${batchId} flagged as breached: ${temperature}°C`);
  return true;
}

async function storeTelemetryRecord(payload, sensorId, sensorAddress) {
  await ensureBatch(payload.batchId);
  const isSafe = payload.temperature >= SAFE_MIN_TEMP && payload.temperature <= SAFE_MAX_TEMP;
  const timestamp = new Date(payload.timestamp);

  const result = await query(
    'INSERT INTO telemetry_logs (batch_id, sensor_id, temperature, humidity, timestamp, is_safe) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    [payload.batchId, sensorId, payload.temperature, payload.humidity ?? null, timestamp, isSafe]
  );

  await flagBreachIfNeeded(payload.batchId, payload.temperature, payload, sensorAddress);
  return { id: result.rows[0] && result.rows[0].id, isSafe, timestamp: timestamp.toISOString() };
}

async function ingestTelemetry(req, res) {
  try {
    const stored = await storeTelemetryRecord(req.telemetryPayload || req.body, req.sensorId || req.body.sensorId, req.recoveredAddress);
    res.status(201).json({ success: true, message: 'Telemetry ingested successfully', ...stored });
  } catch (error) {
    console.error('Error ingesting telemetry:', error);
    res.status(500).json({ success: false, error: 'Telemetry could not be stored' });
  }
}

async function ingestBulkTelemetry(req, res) {
  try {
    const results = [];
    for (const verified of req.verifiedReadings) {
      results.push(await storeTelemetryRecord(verified.payload, verified.sensorId, verified.recoveredAddress));
    }
    res.status(201).json({ success: true, accepted: results.length, readings: results });
  } catch (error) {
    console.error('Error ingesting bulk telemetry:', error);
    res.status(500).json({ success: false, error: 'Bulk telemetry could not be stored' });
  }
}

async function getTelemetryHistory(req, res) {
  try {
    const { batchId } = req.params;
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(1000, Math.max(1, parsedLimit)) : 100;
    const result = await query(
      'SELECT * FROM telemetry_logs WHERE batch_id = $1 ORDER BY timestamp DESC LIMIT $2',
      [batchId, limit]
    );
    res.json({ success: true, telemetry: result.rows });
  } catch (error) {
    console.error('Error fetching telemetry history:', error);
    res.status(500).json({ success: false, error: 'Telemetry history could not be loaded' });
  }
}

module.exports = { ingestTelemetry, ingestBulkTelemetry, getTelemetryHistory, storeTelemetryRecord };
