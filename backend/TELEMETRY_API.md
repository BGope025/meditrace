# MediTrace telemetry API

## Single reading

`POST /api/telemetry/ingest`

```json
{
  "payload": {
    "batchId": "batch_001",
    "temperature": 4.5,
    "humidity": 50,
    "timestamp": "2026-10-28T13:30:00.000Z",
    "sensorId": "sensor_001"
  },
  "signature": "0x..."
}
```

The signature must be an Ethereum personal-sign signature over the exact string `JSON.stringify(payload)`. The backend recovers the signer and compares it with the `public_key` registered for `sensorId` in the `sensors` table.

Successful ingestion returns HTTP 201 with `success`, the stored reading ID, the normalized timestamp, and `isSafe`. The safe band is 2°C through 8°C inclusive. Unsafe readings are stored and flag the batch as breached in the database; a configured blockchain client is also asked to record the breach.

## Bulk store-and-forward replay

`POST /api/telemetry/ingest/bulk`

```json
{
  "readings": [
    { "payload": { "...": "..." }, "signature": "0x..." },
    { "payload": { "...": "..." }, "signature": "0x..." }
  ]
}
```

The request accepts at most 1,000 readings. Every signature is verified before any reading in the batch is stored. A successful response returns HTTP 201 with `accepted` and per-reading results. Timestamps are taken from each signed payload, so offline replay preserves the original measurement time.

## History

`GET /api/telemetry/:batchId/history?limit=100`

History is returned newest first. `limit` is clamped to 1–1000.

## Validation and security

Sensor IDs and batch IDs are bounded identifiers. Temperature must be between -100°C and 100°C; humidity, when provided, must be between 0% and 100%; timestamps must be valid and cannot be more than five minutes in the future. If flattened top-level fields are included beside `payload`, they must exactly match the signed payload fields. Request bodies are limited to 2 MB.
