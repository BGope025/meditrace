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
    this.safeMinTemp = options.safeMinTemp;
    this.safeMaxTemp = options.safeMaxTemp;
    this.backendUrl = options.backendUrl;

    this.temperature = 20.0; // Start at room temperature
    this.humidity = 50.0; // Start at moderate humidity
    this.isRunning = false;
    this.intervalId = null;
  }

  /**
   * Generate a realistic temperature reading with some variance
   * @returns {Object} temperature and humidity readings
   */
  generateReading() {
    // Simulate small random fluctuations
    const tempChange = (Math.random() - 0.5) * 0.2; // +/- 0.1°C
    const humidityChange = (Math.random() - 0.5) * 2; // +/- 1% humidity

    this.temperature += tempChange;
    this.humidity += humidityChange;

    // Keep within reasonable bounds
    this.temperature = Math.max(-10, Math.min(40, this.temperature));
    this.humidity = Math.max(0, Math.min(100, this.humidity));

    // Occasionally simulate a breach (1% chance per reading)
    if (Math.random() < 0.01) {
      // Simulate a temperature excursion
      this.temperature += (Math.random() > 0.5 ? 10 : -10); // Spike up or down
    }

    return {
      temperature: parseFloat(this.temperature.toFixed(2)),
      humidity: parseFloat(this.humidity.toFixed(2))
    };
  }

  /**
   * Sign the payload using the sensor's private key
   * @param {Object} payload - The telemetry payload to sign
   * @returns {string} Hexadecimal signature
   */
  async signPayload(payload) {
    return await cryptoUtils.signPayload(payload, this.privateKey);
  }

  /**
   * Send telemetry data to the backend
   * @param {Object} telemetryData - The telemetry data to send
   */
  async sendTelemetry(telemetryData) {
    try {
      const response = await axios.post(this.backendUrl, telemetryData);
      return response.data;
    } catch (error) {
      console.error(`Sensor ${this.sensorId}: Failed to send telemetry:`, error.message);
      // In a real implementation, we would store-and-forward
      throw error;
    }
  }

  /**
   * Start the sensor simulation
   */
  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log(`Starting sensor ${this.sensorId} for batch ${this.batchId}`);

    this.intervalId = setInterval(async () => {
      try {
        // Generate new reading
        const { temperature, humidity } = this.generateReading();
        const timestamp = Date.now();

        // Create payload to sign
        const payload = {
          batchId: this.batchId,
          temperature,
          humidity,
          timestamp,
          sensorId: this.sensorId
        };

        // Sign the payload
        const signature = await this.signPayload(payload);

        // Prepare data to send to backend
        const telemetryData = {
          ...payload,
          signature
        };

        // Send to backend
        await this.sendTelemetry(telemetryData);

        console.log(`Sensor ${this.sensorId}: Sent telemetry - Temp: ${temperature}°C, Humidity: ${humidity}%`);
      } catch (error) {
        console.error(`Sensor ${this.sensorId}: Error in telemetry cycle:`, error.message);
        // Continue despite errors
      }
    }, this.updateInterval);
  }

  /**
   * Stop the sensor simulation
   */
  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    clearInterval(this.intervalId);
    this.intervalId = null;
    console.log(`Stopped sensor ${this.sensorId}`);
  }
}

module.exports = { SensorNode };