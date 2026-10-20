const bcrypt = require('bcryptjs');
const db = require('../config/db');
require('dotenv').config();

async function seedAdmin() {
  const name = process.env.INITIAL_ADMIN_NAME || 'UACC Administrator';
  const email = (process.env.INITIAL_ADMIN_EMAIL || 'admin@uacc.go.ug').toLowerCase().trim();
  const password = process.env.INITIAL_ADMIN_PASSWORD || 'AdminPassword123!';

  console.log(`🌱 Checking/Seeding initial admin account: ${email}...`);

  try {
    const existing = await db.query('SELECT id, email, name FROM admins WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      console.log(`ℹ️ Admin account (${email}) already exists.`);
      process.exit(0);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await db.query(
      `INSERT INTO admins (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
      [name, email, passwordHash]
    );

    console.log('✅ Admin account created successfully:');
    console.log(result.rows[0]);
    console.log(`🔑 Login credentials -> Email: ${email} | Password: ${password}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed admin:', error.message);
    process.exit(1);
  }
}

seedAdmin();
