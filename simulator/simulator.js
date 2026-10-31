/*
 * MediTrace Virtual Sensor
 *
 * A standalone Node.js edge-compute simulator for a pharmaceutical cold-chain
 * tracker. It models temperature drift, signs every reading with an Ethereum
 * device identity, and stores readings locally while the network is offline.
 */

require('dotenv').config();

const axios = require('axios');
const { Wallet } = require('ethers');
const readline = require('readline');

const TARGET_TEMPERATURE = 4.5;
const SAFE_MIN_TEMPERATURE = 2;
const SAFE_MAX_TEMPERATURE = 8;
const BREACH_TEMPERATURE = 12;
const DEFAULT_INTERVAL_MS = 5000;
const DEFAULT_BACKEND_URL = 'http://localhost:3000/api/telemetry/ingest';

function numberFromEnv(name, fallback, { min = -Infinity, max = Infinity } = {}) {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeEndpoint(url) {
  return url.replace(/\/+$/, '');
}

function formatTemperature(value) {
  return `${value.toFixed(2)}°C`;
}

class VirtualSensor {
  constructor() {
    this.sensorId = process.env.SIMULATOR_SENSOR_ID || 'sensor_001';
    this.batchId = process.env.SIMULATOR_BATCH_ID || 'batch_001';
    this.backendUrl = normalizeEndpoint(process.env.BACKEND_URL || DEFAULT_BACKEND_URL);
    this.bulkBackendUrl = process.env.BULK_BACKEND_URL || `${this.backendUrl}/bulk`;
    this.intervalMs = numberFromEnv('SIMULATOR_INTERVAL_MS', DEFAULT_INTERVAL_MS, { min: 1000, max: 3600000 });
    this.maxQueueSize = numberFromEnv('SIMULATOR_MAX_QUEUE', 10000, { min: 1, max: 100000 });
    this.httpTimeoutMs = numberFromEnv('SIMULATOR_HTTP_TIMEOUT_MS', 8000, { min: 500, max: 120000 });

    const configuredPrivateKey = process.env.SENSOR_PRIVATE_KEY || process.env.PRIVATE_KEY;
    // A configured key gives the sensor a stable identity registered in the backend.
    // Defaults to the seeded sensor_001 key (0x70997970C51812dc3A010C7d01b50e0d17dc79C8).
    const privateKey = configuredPrivateKey || '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
    this.wallet = new Wallet(privateKey);

    this.temperature = TARGET_TEMPERATURE;
    this.humidity = numberFromEnv('SIMULATOR_START_HUMIDITY', 50, { min: 0, max: 100 });
    this.breachMode = false;
    this.offline = false;
    this.running = false;
    this.interval = null;
    this.inFlight = false;
    this.queue = [];
    this.readingCount = 0;
    this.sentCount = 0;
    this.failedCount = 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.printStartup();
    this.setupCli();
    this.tick();
    this.interval = setInterval(() => this.tick(), this.intervalMs);
  }

  async stop() {
    if (!this.running) return;
    this.running = false;
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    if (this.cliCleanup) this.cliCleanup();
    console.log(`\nStopped. Generated ${this.readingCount} readings, sent ${this.sentCount}, queued ${this.queue.length}.`);
  }

  printStartup() {
    console.log('\nMediTrace Virtual Sensor');
    console.log('────────────────────────');
    console.log(`Device identity : ${this.wallet.address}`);
    console.log(`Sensor / batch  : ${this.sensorId} / ${this.batchId}`);
    console.log(`Backend         : ${this.backendUrl}`);
    console.log(`Interval        : ${this.intervalMs / 1000}s`);
    if (!process.env.SENSOR_PRIVATE_KEY && !process.env.PRIVATE_KEY) {
      console.warn('Warning: no SENSOR_PRIVATE_KEY configured; a new identity was generated for this run.');
      console.warn('Register this address in the backend sensor registry before sending signed telemetry.');
    }
    console.log('Controls        : B = breach | R = reset | O = offline/online | Q = quit');
    console.log('State           : ONLINE / NORMAL\n');
  }

  setupCli() {
    if (!process.stdin.isTTY) return;
    readline.emitKeypressEvents(process.stdin);
    if (typeof process.stdin.setRawMode === 'function') process.stdin.setRawMode(true);

    const onKeypress = async (input, key = {}) => {
      if (key.ctrl && key.name === 'c' || input && input.toLowerCase() === 'q') {
        await this.stop();
        process.exit(0);
      }
      if (input && input.toLowerCase() === 'b') this.setBreachMode(true);
      if (input && input.toLowerCase() === 'r') this.setBreachMode(false);
      if (input && input.toLowerCase() === 'o') await this.toggleOffline();
    };

    process.stdin.on('keypress', onKeypress);
    this.cliCleanup = () => {
      process.stdin.off('keypress', onKeypress);
      if (typeof process.stdin.setRawMode === 'function') process.stdin.setRawMode(false);
      process.stdin.pause();
    };
  }

  setBreachMode(enabled) {
    this.breachMode = enabled;
    if (!enabled) this.temperature = TARGET_TEMPERATURE;
    console.log(`\n[CONTROL] ${enabled ? `BREACH forced at ${BREACH_TEMPERATURE}°C` : 'NORMAL mode restored around 4.5°C'}`);
  }

  async toggleOffline() {
    this.offline = !this.offline;
    console.log(`\n[CONTROL] ${this.offline ? 'OFFLINE mode enabled; readings will be buffered locally.' : `ONLINE mode restored; flushing ${this.queue.length} buffered reading(s).`}`);
    if (!this.offline) await this.flushQueue();
  }

  driftTemperature() {
    if (this.breachMode) {
      // Fast movement toward a refrigerator-failure temperature with small noise.
      this.temperature += (BREACH_TEMPERATURE - this.temperature) * 0.75 + (Math.random() - 0.5) * 0.35;
      return Math.max(9, Math.min(20, this.temperature));
    }

    // Mean-reverting random walk: gentle noise plus a pull toward the ideal 4.5°C.
    const meanReversion = (TARGET_TEMPERATURE - this.temperature) * 0.22;
    const randomNoise = (Math.random() - 0.5) * 0.45;
    this.temperature += meanReversion + randomNoise;
    return Math.max(1.5, Math.min(9, this.temperature));
  }

  driftHumidity() {
    this.humidity += (50 - this.humidity) * 0.08 + (Math.random() - 0.5) * 1.8;
    return Math.max(0, Math.min(100, this.humidity));
  }

  createPayload() {
    this.temperature = this.driftTemperature();
    this.humidity = this.driftHumidity();
    this.readingCount += 1;

    return {
      batchId: this.batchId,
      temperature: Number(this.temperature.toFixed(2)),
      humidity: Number(this.humidity.toFixed(2)),
      timestamp: new Date().toISOString(),
      sensorId: this.sensorId
    };
  }

  async signPayload(payload) {
    // The exact JSON string is signed and sent as the nested payload so the
    // backend can verify the same bytes and recover this device address.
    const payloadString = JSON.stringify(payload);
    return this.wallet.signMessage(payloadString);
  }

  async createSignedReading() {
    const payload = this.createPayload();
    const signature = await this.signPayload(payload);
    return { payload, signature, ...payload };
  }

  enqueue(reading, reason = 'offline') {
    if (this.queue.length >= this.maxQueueSize) {
      this.queue.shift();
      console.warn(`[QUEUE] Capacity reached; discarded the oldest reading (${this.maxQueueSize} max).`);
    }
    this.queue.push(reading);
    console.log(`[QUEUE] ${reason}; buffered ${this.queue.length} reading(s).`);
  }

  async sendReading(reading) {
    const response = await axios.post(this.backendUrl, reading, {
      timeout: this.httpTimeoutMs,
      headers: { 'Content-Type': 'application/json' }
    });
    this.sentCount += 1;
    return response.data;
  }

  async flushQueue() {
    if (this.offline || this.inFlight || this.queue.length === 0) return;
    this.inFlight = true;
    const pending = this.queue.splice(0);
    try {
      // Prefer one bulk payload so reconnecting devices do not create a burst
      // of independent HTTP handshakes. Each reading keeps its original
      // timestamp and signature inside the bulk envelope.
      await axios.post(this.bulkBackendUrl, { readings: pending }, {
        timeout: this.httpTimeoutMs,
        headers: { 'Content-Type': 'application/json' }
      });
      this.sentCount += pending.length;
      console.log(`[QUEUE] Bulk-flushed ${pending.length} buffered reading(s).`);
    } catch (error) {
      // Backward compatibility with the current single-reading backend.
      if (error.response?.status === 404 || error.response?.status === 405) {
        try {
          for (let index = 0; index < pending.length; index += 1) {
            await this.sendReading(pending[index]);
          }
          console.log(`[QUEUE] Flushed ${pending.length} buffered reading(s) via compatibility mode.`);
          return;
        } catch (fallbackError) {
          error = fallbackError;
        }
      }
      this.failedCount += 1;
      this.queue = pending.concat(this.queue).slice(-this.maxQueueSize);
      console.warn(`[QUEUE] Flush interrupted: ${this.describeError(error)}. Retained ${this.queue.length} reading(s).`);
    } finally {
      this.inFlight = false;
    }
  }

  describeError(error) {
    return error.response ? `HTTP ${error.response.status}` : error.code || error.message;
  }

  async tick() {
    if (!this.running) return;
    try {
      const reading = await this.createSignedReading();
      const state = this.breachMode ? 'BREACH' : 'normal';
      console.log(`[READING ${this.readingCount}] ${formatTemperature(reading.temperature)} | ${state} | ${this.offline ? 'BUFFERED' : 'sending'}`);

      if (this.offline) {
        this.enqueue(reading);
        return;
      }

      await this.flushQueue();
      try {
        await this.sendReading(reading);
        console.log(`[HTTP] accepted by backend (${this.wallet.address.slice(0, 10)}…).`);
      } catch (error) {
        this.failedCount += 1;
        this.enqueue(reading, `network failure: ${this.describeError(error)}`);
      }
    } catch (error) {
      this.failedCount += 1;
      console.error(`[CYCLE] ${error.message}`);
    }
  }
}

module.exports = { VirtualSensor };

if (require.main === module) {
  const sensor = new VirtualSensor();
  sensor.start();

  process.on('SIGINT', async () => {
    await sensor.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await sensor.stop();
    process.exit(0);
  });
}
