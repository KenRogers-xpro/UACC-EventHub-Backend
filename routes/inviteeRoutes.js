const express = require('express');
const router = express.Router();
const { removeInvitee } = require('../controllers/inviteeController');
const { verifyAdminToken } = require('../middleware/auth');

// Protected invitee management
router.use(verifyAdminToken);

// DELETE /api/invitees/:id
router.delete('/:id', removeInvitee);

module.exports = router;
