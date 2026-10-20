const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

const isProduction = process.env.NODE_ENV === 'production';
const isRemoteDb = connectionString && (connectionString.includes('neon.tech') || connectionString.includes('sslmode=require'));

const pool = new Pool({
  connectionString: connectionString,
  ssl: isRemoteDb || isProduction ? { rejectUnauthorized: false } : false,
});

pool.on('connect', () => {
  // Connected to PostgreSQL database
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
