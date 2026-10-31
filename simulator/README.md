# MediTrace Virtual Sensor

Run the standalone edge simulator with:

```bash
npm start --workspace=simulator
```

The process creates one Ethereum device identity at startup. For a stable identity that is already registered in the backend, set `SENSOR_PRIVATE_KEY` and make sure the corresponding wallet address is stored for `SIMULATOR_SENSOR_ID` in the backend `sensors` table. If no key is supplied, a fresh wallet is generated and printed; that wallet must be enrolled before signed readings can be accepted.

## Environment

```env
BACKEND_URL=http://localhost:3000/api/telemetry/ingest
BULK_BACKEND_URL=http://localhost:3000/api/telemetry/ingest/bulk
SENSOR_PRIVATE_KEY=
SIMULATOR_SENSOR_ID=sensor_001
SIMULATOR_BATCH_ID=batch_001
SIMULATOR_INTERVAL_MS=5000
SIMULATOR_MAX_QUEUE=10000
SIMULATOR_HTTP_TIMEOUT_MS=8000
SIMULATOR_START_HUMIDITY=50
```

The terminal controls are single-key commands: `B` forces a temperature excursion, `R` returns to the 4.5°C mean, `O` toggles offline store-and-forward mode, and `Q` exits. Readings are signed over the exact JSON serialization of the nested `payload` object.

The simulator first attempts a bulk flush at `BULK_BACKEND_URL`. If the backend responds with 404 or 405, it falls back to ordered requests against `BACKEND_URL`, preserving each reading’s original timestamp and signature.
