const express = require('express');
const router = express.Router();
const { getInviteByToken, submitRSVP } = require('../controllers/rsvpController');
const { getMaterialsForGuest } = require('../controllers/materialController');

// Public endpoints — NO authentication required
// 5.1 Get invitation details by token
router.get('/:token', getInviteByToken);

// 5.2 Submit RSVP response ('accepted' | 'declined')
router.post('/:token/respond', submitRSVP);

// 6.2 Get materials (accepted guests only)
router.get('/:token/materials', getMaterialsForGuest);

module.exports = router;
