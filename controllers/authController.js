const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { SECRET_KEY } = require('../middleware/auth');

// POST /api/auth/login
// Section 2.1: Admin Login
async function adminLogin(req, res) {
  try {
    const { email, password } = req.body;

    // STEP 1: Validate that inputs are not empty
    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required',
      });
    }

    if (!password || !password.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Password is required',
      });
    }

    // STEP 2: Search database for an admin with that email
    const result = await db.query(
      'SELECT id, name, email, password_hash FROM admins WHERE LOWER(email) = LOWER($1)',
      [email.trim()]
    );

    const admin = result.rows[0];

    // Note: same error message for both cases — do not reveal which is wrong
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // STEP 3: Compare provided password with stored hash
    const isValid = await bcrypt.compare(password, admin.password_hash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // STEP 4: Create signed JWT token expiring in 8 hours
    const payload = { adminId: admin.id, email: admin.email };
    const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '8h' });

    // STEP 5: Return token and admin details
    return res.status(200).json({
      success: true,
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
      },
    });
  } catch (error) {
    console.error('Error in adminLogin:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication',
    });
  }
}

// GET /api/auth/me
// Returns the authenticated admin profile
async function getMe(req, res) {
  try {
    const adminId = req.admin.adminId;
    const result = await db.query(
      'SELECT id, name, email, created_at FROM admins WHERE id = $1',
      [adminId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin account not found',
      });
    }

    return res.status(200).json({
      success: true,
      admin: result.rows[0],
    });
  } catch (error) {
    console.error('Error in getMe:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve admin details',
    });
  }
}

module.exports = {
  adminLogin,
  getMe,
};
