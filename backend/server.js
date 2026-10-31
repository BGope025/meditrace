const express = require('express');
const dotenv = require('dotenv');

// Load environment variables before importing route modules and their services.
dotenv.config();

const batchRoutes = require('./routes/batch.routes');
const telemetryRoutes = require('./routes/telemetry.routes');
const algorandRoutes = require('./routes/algorand.routes');
const { connectDB } = require('./config/db');
const { initializeWeb3 } = require('./config/web3');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Connect to database
connectDB();

// Initialize Web3 (blockchain connection)
initializeWeb3();

// Routes
app.use('/api/batch', batchRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/algorand', algorandRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
