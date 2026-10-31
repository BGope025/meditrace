const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batch.controller');

// Define routes
// GET /api/batch - Get all batches
router.get('/', batchController.getAllBatches);
router.get('/list', batchController.getAllBatches);

// POST /api/batch/create - Create a new batch
router.post('/create', batchController.createBatch);

// POST /api/batch/transfer - Accept a signed custody handoff
router.post('/transfer', batchController.transferBatch);

// GET /api/batch/:batchId - Get batch provenance
router.get('/:batchId', batchController.getBatchProvenance);

// POST /api/batch/:batchId/flag-breach - Flag batch as breached
router.post('/:batchId/flag-breach', batchController.flagBreach);

module.exports = router;
