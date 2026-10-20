const express = require('express');
const router = express.Router();
const { adminLogin, getMe } = require('../controllers/authController');
const { verifyAdminToken } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', adminLogin);

// GET /api/auth/me (Protected - validates session)
router.get('/me', verifyAdminToken, getMe);

module.exports = router;
