const express = require('express');
const controller = require('../controllers/algorand.controller');

const router = express.Router();

router.get('/config', controller.config);
router.get('/account/:address', controller.account);
router.post('/app-call/prepare', controller.prepareAppCall);
router.post('/transactions/submit', controller.submit);
router.post('/transactions/submit-and-confirm', controller.submitAndConfirm);
router.get('/transactions/:txId/confirm', controller.confirm);
router.get('/transactions/:txId', controller.lookup);
router.post('/batches/record', controller.recordBatchTransaction);
router.post('/batches/sync', controller.syncBatchTransaction);

module.exports = router;
