const express = require('express');
const router = express.Router();
const telemetryController = require('../controllers/telemetry.controller');
const { verifySignature, verifyBulkSignatures } = require('../middleware/verifySignature');

// POST /api/telemetry/ingest - receive one signed sensor reading
router.post('/ingest', verifySignature, telemetryController.ingestTelemetry);

// POST /api/telemetry/ingest/bulk - receive signed store-and-forward readings
router.post('/ingest/bulk', verifyBulkSignatures, telemetryController.ingestBulkTelemetry);

// GET /api/telemetry/:batchId/history - retrieve bounded telemetry history
router.get('/:batchId/history', telemetryController.getTelemetryHistory);

module.exports = router;
