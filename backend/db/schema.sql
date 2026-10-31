-- Table for storing batch information
CREATE TABLE IF NOT EXISTS batches (
  batch_id VARCHAR PRIMARY KEY,
  drug_name VARCHAR NOT NULL,
  manufacturer VARCHAR NOT NULL, -- address of manufacturer
  state INTEGER NOT NULL, -- 0: Active, 1: Breached, 2: Transferred, 3: Delivered
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP,
  chain VARCHAR NOT NULL DEFAULT 'evm',
  algorand_app_id BIGINT,
  algorand_batch_id BIGINT,
  algorand_tx_id VARCHAR,
  algorand_confirmed_round BIGINT
);

-- Table for storing telemetry logs from IoT sensors
CREATE TABLE IF NOT EXISTS telemetry_logs (
  id SERIAL PRIMARY KEY,
  batch_id VARCHAR NOT NULL REFERENCES batches(batch_id),
  sensor_id VARCHAR NOT NULL,
  temperature DECIMAL NOT NULL,
  humidity DECIMAL,
  timestamp TIMESTAMP NOT NULL,
  is_safe BOOLEAN NOT NULL,
  algorand_tx_id VARCHAR,
  algorand_confirmed_round BIGINT
);

ALTER TABLE batches ADD COLUMN IF NOT EXISTS chain VARCHAR NOT NULL DEFAULT 'evm';
ALTER TABLE batches ADD COLUMN IF NOT EXISTS algorand_app_id BIGINT;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS algorand_batch_id BIGINT;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS algorand_tx_id VARCHAR;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS algorand_confirmed_round BIGINT;
ALTER TABLE telemetry_logs ADD COLUMN IF NOT EXISTS algorand_tx_id VARCHAR;
ALTER TABLE telemetry_logs ADD COLUMN IF NOT EXISTS algorand_confirmed_round BIGINT;

-- Table for storing registered IoT sensors and their public keys
CREATE TABLE IF NOT EXISTS sensors (
  sensor_id VARCHAR PRIMARY KEY,
  public_key VARCHAR NOT NULL -- Ethereum address of the sensor
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_telemetry_batch_id ON telemetry_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry_logs(timestamp);
