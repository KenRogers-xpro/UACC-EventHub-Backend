const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function runMigration() {
  console.log('🔄 Running database migrations...');
  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    await db.query(schemaSql);
    console.log('✅ Database migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
