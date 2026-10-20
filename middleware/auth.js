const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET_KEY = process.env.JWT_SECRET || 'uacc_eventhub_super_secret_jwt_key_change_in_production';

function verifyAdminToken(req, res, next) {
  // STEP 1: Extract the token from the Authorization header
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
    });
  }

  const token = authHeader.replace(/^Bearer\s+/, '').trim();

  // STEP 2: Verify the token is valid and not expired
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.admin = decoded; // attach admin info to request ({ adminId, email })
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please log in again.',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid token. Access denied.',
    });
  }
}

module.exports = {
  verifyAdminToken,
  SECRET_KEY,
};
