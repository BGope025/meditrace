const axios = require('axios');
const cryptoUtils = require('./cryptoUtils');

class SensorNode {
  /**
   * @param {Object} options
   * @param {string} options.sensorId - Unique identifier for this sensor
   * @param {string} options.privateKey - Ethereum private key for signing
   * @param {string} options.batchId - Batch ID this sensor is monitoring
   * @param {number} options.updateInterval - Interval in seconds between readings
   * @param {number} options.safeMinTemp - Minimum safe temperature (Celsius)
   * @param {number} options.safeMaxTemp - Maximum safe temperature (Celsius)
   * @param {string} options.backendUrl - Backend endpoint for telemetry ingestion
   */
  constructor(options) {
    this.sensorId = options.sensorId;
    this.privateKey = options.privateKey;
    this.batchId = options.batchId;
    this.updateInterval = options.updateInterval * 1000; // convert to milliseconds
    this.safeMinTemp = options.safeMinTemp || 5.0; // Default to 5.0°C (ideal refrigeration)
    this.safeMaxTemp = options.safeMaxTemp || 8.0;
    this.backendUrl = options.backendUrl;

    // Environmental physics: start at ideal refrigeration temperature
    this.baseTemperature = 5.0; // Base state: 5.0°C
    this.temperature = this.baseTemperature; // Current temperature with drift
    this.humidity = 60.0; // Start at moderate humidity (typical for refrigerated)

    // Hardware security: identity is established via private key
    // (signing happens in signPayload method)

    // Network transport & outage handling
    this.isOnline = true; // Start in online mode
    this.offlineQueue = []; // Queue for storing data when offline
    this.isRunning = false;
    this.intervalId = null;
  }

  /**
   * Generate a realistic temperature reading with environmental physics
   * Instead of reading a physical thermistor, uses mathematical random walk
   * to generate realistic temperature fluctuations.
   *
   * Base State: 5.0°C (ideal refrigeration temperature)
   * Normal Fluctuation: ±0.2°C every 5 seconds (random walk)
   * Breach Trigger: Handled externally via triggerBreach() method (B key)
   *
   * @returns {Object} temperature and humidity readings
   */
  generateReading() {
    // Simulate small random fluctuations: ±0.2°C for temperature
    const tempChange = (Math.random() - 0.5) * 0.4; // Range: -0.2 to +0.2
    // Humidity fluctuation: ±1.5% (more realistic for refrigerated environments)
    const humidityChange = (Math.random() - 0.5) * 3; // Range: -1.5 to +1.5

    this.temperature += tempChange;
    this.humidity += humidityChange;

    // Keep within reasonable bounds for refrigerated transport
    this.temperature = Math.max(-5, Math.min(15, this.temperature)); // -5°C to 15°C range
    this.humidity = Math.max(40, Math.min(90, this.humidity)); // 40% to 90% humidity range

    return {
      temperature: parseFloat(this.temperature.toFixed(2)),
      humidity: parseFloat(this.humidity.toFixed(2))
    };
  }

  /**
   * Trigger a temperature breach (simulating door left open or compressor failure)
   * This corresponds to pressing 'B' in the terminal
   * Instantly sets temperature to 12.0°C to simulate a breach condition
   */
  triggerBreach() {
    console.log(`🚨 [${this.sensorId}] BREACH: Temperature set to 12.0°C (door open/compressor failure)`);
    this.temperature = 12.0;
  }

  /**
   * Toggle between online and offline network modes
   * This corresponds to pressing 'O' in the terminal
   * When going online: flushes the offline queue with retroactive timestamps
   */
  toggleOnlineMode() {
    this.isOnline = !this.isOnline;
    const status = this.isOnline ? 'ONLINE' : 'OFFLINE';
    console.log(`📡 [${this.sensorId}] Connection mode: ${status}`);

    // If coming online, flush any queued data
    if (this.isOnline && this.offlineQueue.length > 0) {
      this.flushOfflineQueue();
    }
  }

  /**
   * Set the online status (used during initialization)
   * @param {boolean} status - True for online, false for offline
   */
  setOnlineStatus(status) {
    this.isOnline = status;
  }

  /**
   * Sign the payload using the sensor's private key (hardware security simulation)
   * Real enterprise cold-chain monitors use a hardware security module to prevent
   * logistics companies from spoofing data to avoid liability.
   *
   * Device Identity: Instantiated Ethers.js Wallet using dedicated private key
   * Payload Signing: Signs the JSON payload before transmission
   *
   * @param {Object} payload - The telemetry payload to sign
   * @returns {Promise<string>} Hexadecimal signature
   */
  async signPayload(payload) {
    return await cryptoUtils.signPayload(payload, this.privateKey);
  }

  /**
   * Send telemetry data to the backend with offline queueing support
   * Simulates network transport & outages:
   * - When online: sends data immediately via HTTP
   * - When offline: stores signed payloads in local queue for later transmission
   *
   * @param {Object} telemetryData - The telemetry data to send
   */
  async sendTelemetry(telemetryData) {
    if (this.isOnline) {
      // Online mode: send immediately
      try {
        const response = await axios.post(this.backendUrl, telemetryData);
        // Optional: log successful transmission
        // console.log(`✅ [${this.sensorId}] Data sent successfully`);
        return response.data;
      } catch (error) {
        console.error(`❌ [${this.sensorId}] Failed to send telemetry:`, error.message);
        // In a real implementation with more sophisticated retry logic,
        // we might temporarily go offline or implement exponential backoff
        throw error;
      }
    } else {
      // Offline mode: store in queue for later transmission
      this.offlineQueue.push({
        ...telemetryData,
        queuedAt: Date.now() // Timestamp when we went offline
      });
      // Optional: log queuing for debugging
      // console.log(`📦 [${this.sensorId}] Data queued for later transmission (offline mode)`);
    }
  }

  /**
   * Flush the offline queue when network connectivity is restored
   * Sends all queued data in one bulk payload with retroactive timestamps
   * This simulates a truck driving through a mountain tunnel and regaining cell service
   */
  async flushOfflineQueue() {
    if (this.offlineQueue.length === 0) {
      // Nothing to flush
      return;
    }

    const queueLength = this.offlineQueue.length;
    console.log(`🔄 [${this.sensorId}] Flushing ${queueLength} queued data points...`);

    try {
      // Send all queued data in one bulk request
      const response = await axios.post(`${this.backendUrl}/bulk`, {
        sensorId: this.sensorId,
        batchId: this.batchId,
        data: this.offlineQueue
      });

      console.log(`✅ [${this.sensorid}] Successfully flushed ${queueLength} queued data points`);

      // Clear the queue after successful transmission
      this.offlineQueue = [];

      return response.data;
    } catch (error) {
      console.error(`❌ [${this.sensorId}] Failed to flush offline queue:`, error.message);
      // Keep the data in queue for next retry attempt
      throw error;
    }
  }

  /**
   * Start the sensor simulation
   * Begins the setInterval loop for generating and sending telemetry readings
   */
  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log(`🚀 [${this.sensorId}] Starting sensor simulation for batch ${this.batchId}`);

    this.intervalId = setInterval(async () => {
      try {
        // Generate new reading based on environmental physics
        const { temperature, humidity } = this.generateReading();
        const timestamp = Date.now();

        // Create payload to sign (includes all telemetry data)
        const payload = {
          batchId: this.batchId,
          temperature,
          humidity,
          timestamp,
          sensorId: this.sensorId
        };

        // Sign the payload using hardware security simulation
        const signature = await this.signPayload(payload);

        // Prepare data to send to backend
        const telemetryData = {
          ...payload,
          signature
        };

        // Send telemetry data (handles online/offline logic internally)
        await this.sendTelemetry(telemetryData);

        // Log successful reading transmission
        const status = this.isOnline ? '📡' : '📦';
        console.log(`${status} [${this.sensorId}] Temp: ${temperature}°C, Humidity: ${humidity}%`);
      } catch (error) {
        // Log error but continue simulation (don't let one failed reading stop everything)
        console.error(`⚠️ [${this.sensorId}] Error in telemetry cycle:`, error.message);
        // Continue despite errors - the sensor keeps generating readings
      }
    }, this.updateInterval);
  }

  /**
   * Stop the sensor simulation
   * Clears the interval and performs cleanup
   */
  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    clearInterval(this.intervalId);
    this.intervalId = null;
    console.log(`🛑 [${this.sensorId}] Sensor stopped`);

    // Before stopping, flush any remaining offline data
    if (this.offlineQueue.length > 0) {
      console.log(`📦 [${this.sensorId}] Flushing ${this.offlineQueue.length} queued items before shutdown`);
      // Note: We don't await this because we're shutting down, but in production
      // you might want to handle this more carefully
      this.flushOfflineQueue().catch(() => {/* Ignore flush errors on shutdown */});
    }
  }
}

module.exports = { SensorNode };