const express = require('express');
const router = express.Router();
const { deleteMaterial } = require('../controllers/materialController');
const { verifyAdminToken } = require('../middleware/auth');

// Protected material management
router.use(verifyAdminToken);

// DELETE /api/materials/:id
router.delete('/:id', deleteMaterial);

module.exports = router;
