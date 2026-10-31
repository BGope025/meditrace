const { ethers } = require('ethers');
const { query } = require('../config/db');
require('dotenv').config();

const REQUIRED_FIELDS = ['batchId', 'temperature', 'timestamp', 'sensorId'];
const OPTIONAL_FIELDS = ['humidity'];
const MAX_ID_LENGTH = 128;

class RequestError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function assertIdentifier(value, field) {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_ID_LENGTH || !/^[a-zA-Z0-9._:-]+$/.test(value)) {
    throw new RequestError(400, `${field} must be a non-empty identifier no longer than ${MAX_ID_LENGTH} characters`);
  }
}

function assertNumber(value, field, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new RequestError(400, `${field} must be a number between ${min} and ${max}`);
  }
}

function assertTimestamp(value) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new RequestError(400, 'timestamp must be an ISO string or Unix timestamp');
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new RequestError(400, 'timestamp is invalid');
  if (parsed.getTime() > Date.now() + 5 * 60 * 1000) throw new RequestError(400, 'timestamp cannot be more than five minutes in the future');
}

function compareField(body, payload, field) {
  if (hasOwn(body, field) && JSON.stringify(body[field]) !== JSON.stringify(payload[field])) {
    throw new RequestError(400, `top-level ${field} does not match payload.${field}`);
  }
}

function normalizePayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RequestError(400, 'request body must be a JSON object');
  if (!body.signature || typeof body.signature !== 'string') throw new RequestError(400, 'signature is required');

  let payload = body.payload;
  if (payload === undefined) {
    // Backward-compatible form for existing sensors; the simulator uses the
    // nested payload form so the exact signed JSON object is preserved.
    payload = {};
    for (const field of [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]) {
      if (hasOwn(body, field)) payload[field] = body[field];
    }
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new RequestError(400, 'payload must be a JSON object');

  for (const field of REQUIRED_FIELDS) {
    if (!hasOwn(payload, field)) throw new RequestError(400, `payload.${field} is required`);
  }
  for (const field of [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]) compareField(body, payload, field);

  assertIdentifier(payload.batchId, 'batchId');
  assertIdentifier(payload.sensorId, 'sensorId');
  assertNumber(payload.temperature, 'temperature', -100, 100);
  if (payload.humidity !== undefined && payload.humidity !== null) assertNumber(payload.humidity, 'humidity', 0, 100);
  assertTimestamp(payload.timestamp);

  return payload;
}

async function verifySignedPayload(body) {
  const payload = normalizePayload(body);
  const result = await query('SELECT public_key FROM sensors WHERE sensor_id = $1', [payload.sensorId]);
  if (!result.rows.length) throw new RequestError(400, 'Sensor not registered');

  let recoveredAddress;
  try {
    recoveredAddress = ethers.verifyMessage(JSON.stringify(payload), body.signature);
  } catch (_) {
    throw new RequestError(401, 'Invalid signature format');
  }

  const registeredAddress = String(result.rows[0].public_key);
  if (recoveredAddress.toLowerCase() !== registeredAddress.toLowerCase()) {
    throw new RequestError(401, 'Invalid signature for registered sensor');
  }

  return { payload, sensorId: payload.sensorId, recoveredAddress };
}

function sendVerificationError(res, error) {
  const status = error.statusCode || 500;
  if (status === 500) console.error('Telemetry signature verification error:', error);
  return res.status(status).json({ success: false, error: status === 500 ? 'Signature verification failed' : error.message });
}

async function verifySignature(req, res, next) {
  try {
    const verified = await verifySignedPayload(req.body);
    req.telemetryPayload = verified.payload;
    req.sensorId = verified.sensorId;
    req.recoveredAddress = verified.recoveredAddress;
    req.body = { ...req.body, ...verified.payload, sensorId: verified.sensorId };
    next();
  } catch (error) {
    sendVerificationError(res, error);
  }
}

async function verifyBulkSignatures(req, res, next) {
  try {
    const readings = req.body && req.body.readings;
    if (!Array.isArray(readings) || readings.length === 0) throw new RequestError(400, 'readings must be a non-empty array');
    if (readings.length > 1000) throw new RequestError(413, 'A bulk request cannot contain more than 1000 readings');
    const verifiedReadings = [];
    for (const reading of readings) verifiedReadings.push(await verifySignedPayload(reading));
    req.verifiedReadings = verifiedReadings;
    next();
  } catch (error) {
    sendVerificationError(res, error);
  }
}

module.exports = { verifySignature, verifyBulkSignatures, verifySignedPayload, RequestError };
