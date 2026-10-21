const express = require('express');
const router = express.Router();
const {
  createEvent,
  getAllEvents,
  getSingleEvent,
  updateEvent,
  deleteEvent,
} = require('../controllers/eventController');
const { addInvitee } = require('../controllers/inviteeController');
const { uploadMaterial } = require('../controllers/materialController');
const { verifyAdminToken } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

// All event routes are protected by admin JWT
router.use(verifyAdminToken);

// Cover image upload (must be before /:id routes to avoid route conflict)
const { uploadCoverImage } = require('../controllers/eventController');
router.post('/cover-image', upload.single('cover_image'), uploadCoverImage);

// Event CRUD
router.post('/', createEvent);
router.get('/', getAllEvents);
router.get('/:id', getSingleEvent);
router.put('/:id', updateEvent);
router.delete('/:id', deleteEvent);

// Sub-resources on event
router.post('/:id/invitees', addInvitee);
router.post('/:id/materials', upload.single('file'), uploadMaterial);

module.exports = router;
