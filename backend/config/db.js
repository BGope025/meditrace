const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let activePool = null;

async function seedDatabase(poolInstance) {
  try {
    // Seed default sensors
    await poolInstance.query(`
      INSERT INTO sensors (sensor_id, public_key)
      VALUES 
        ('sensor_001', '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'),
        ('sensor_002', '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC')
      ON CONFLICT (sensor_id) DO NOTHING;
    `);

    // Seed default batches
    await poolInstance.query(`
      INSERT INTO batches (batch_id, drug_name, manufacturer, state, created_at)
      VALUES 
        ('batch_001', 'COVID-19 Vaccine (mRNA)', '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 0, NOW()),
        ('batch_002', 'Insulin Glargine', '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 0, NOW())
      ON CONFLICT (batch_id) DO NOTHING;
    `);

    console.log('Database initial seed completed (sensors and batches ready)');
  } catch (err) {
    console.warn('Database seed notice:', err.message);
  }
}

async function connectDB() {
  const databaseUrl = process.env.DATABASE_URL || 'postgres://meditrace:meditracepass@localhost:5432/meditrace';

  // 1. Try real PostgreSQL first
  try {
    const testPool = new Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 1500
    });
    await testPool.query('SELECT NOW()');
    console.log('Connected to PostgreSQL database at ' + databaseUrl);
    activePool = testPool;

    // Apply schema if file exists
    const schemaPath = path.join(__dirname, '../db/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await activePool.query(sql);
    }
    await seedDatabase(activePool);
    return activePool;
  } catch (error) {
    console.warn('Real PostgreSQL not available (' + error.message + '). Initializing in-memory PostgreSQL engine...');
  }

  // 2. Fallback to in-memory PostgreSQL (pg-mem)
  try {
    const { newDb } = require('pg-mem');
    const db = newDb();
    
    const schemaPath = path.join(__dirname, '../db/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
      db.public.none(schemaSql);
    }

    const pgMemPool = db.adapters.createPg().Pool;
    activePool = new pgMemPool();
    await seedDatabase(activePool);
    console.log('Connected to in-memory PostgreSQL database (Docker / local Postgres not available)');
    return activePool;
  } catch (memError) {
    console.error('Failed to initialize in-memory database:', memError.message);
    process.exit(1);
  }
}

async function query(text, params) {
  if (!activePool) {
    await connectDB();
  }
  return await activePool.query(text, params);
}

module.exports = {
  connectDB,
  query,
  get pool() {
    return activePool;
  }
};