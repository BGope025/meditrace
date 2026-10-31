require('dotenv').config();
const { SensorNode } = require('./SensorNode');
const config = require('./config.json');
const readline = require('readline');

// Backend URL for sending telemetry
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000/api/telemetry/ingest';

// Create sensor nodes based on config
const sensors = config.sensors.map(sensorConfig => {
  return new SensorNode({
    sensorId: sensorConfig.sensorId,
    privateKey: sensorConfig.privateKey,
    batchId: sensorConfig.batchId,
    updateInterval: sensorConfig.updateInterval || 5000, // 5 seconds default
    safeMinTemp: sensorConfig.safeMinTemp || 2,
    safeMaxTemp: sensorConfig.safeMaxTemp || 8,
    backendUrl: BACKEND_URL
  });
});

// Set up keyboard input handling
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: ''
});

console.log('\n=== MediTrace IoT Simulator ===');
console.log('Commands:');
console.log('  B - Trigger temperature breach (set to 12.0°C)');
console.log('  O - Toggle online/offline mode');
console.log('  Q - Quit simulator\n');

let onlineStatus = true;

// Handle keyboard input
rl.on('line', (input) => {
  const command = input.trim().toUpperCase();

  switch (command) {
    case 'B':
      console.log('\n🚨 BREACH TRIGGERED: Setting all sensors to 12.0°C');
      sensors.forEach(sensor => sensor.triggerBreach());
      break;

    case 'O':
      onlineStatus = !onlineStatus;
      const statusText = onlineStatus ? 'ONLINE' : 'OFFLINE';
      console.log(`\n📡 Connection mode changed to: ${statusText}`);

      // If coming online, flush any queued data from all sensors
      if (onlineStatus) {
        console.log('🔄 Flushing offline data queues...');
        sensors.forEach(sensor => sensor.flushOfflineQueue());
      }
      break;

    case 'Q':
      console.log('\n👋 Shutting down simulator...');
      rl.close();
      sensors.forEach(sensor => {
        sensor.stop();
        // Flush any remaining offline data before stopping
        sensor.flushOfflineQueue();
      });
      process.exit(0);
      break;

    default:
      // Ignore unrecognized commands
      break;
  }

  // Show prompt again
  rl.prompt();
}).on('close', () => {
  console.log('\n👋 Simulator terminated.');
  process.exit(0);
});

// Initial prompt
rl.prompt();

// Start all sensors
console.log('🚀 Starting all sensors...');
sensors.forEach(sensor => {
  sensor.start();
  // Set initial online status for all sensors
  sensor.setOnlineStatus(onlineStatus);
});

console.log(`✅ All ${sensors.length} sensors started.`);
console.log(`🌐 Initial connection mode: ${onlineStatus ? 'ONLINE' : 'OFFLINE'}`);