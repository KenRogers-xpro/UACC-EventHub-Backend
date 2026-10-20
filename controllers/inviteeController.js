const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
require('dotenv').config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

// 4.1 Add Invitee
// POST /api/events/:id/invitees
async function addInvitee(req, res) {
  try {
    const adminId = req.admin.adminId;
    const eventId = req.params.id;
    const { name, email, phone } = req.body;

    // STEP 1: Verify admin owns the event
    const eventResult = await db.query('SELECT * FROM events WHERE id = $1', [eventId]);
    if (eventResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    const event = eventResult.rows[0];
    if (event.created_by !== adminId) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied',
      });
    }

    // STEP 2: Validate guest name
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Guest name is required',
      });
    }

    const trimmedEmail = email ? email.trim().toLowerCase() : null;
    const trimmedPhone = phone ? phone.trim() : null;

    // STEP 3: Check if this guest is already invited to this event
    if (trimmedEmail) {
      const existing = await db.query(
        'SELECT id FROM invitees WHERE event_id = $1 AND LOWER(email) = LOWER($2)',
        [eventId, trimmedEmail]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'This guest has already been invited to this event',
        });
      }
    }

    // STEP 4: Generate unique private token for this guest
    const uniqueToken = uuidv4();
    const inviteLink = `${BASE_URL.replace(/\/$/, '')}/invite/${uniqueToken}`;

    // STEP 5: Save invitee to database
    const insertQuery = `
      INSERT INTO invitees (
        event_id, name, email, phone, token, status, responded_at
      )
      VALUES ($1, $2, $3, $4, $5, 'pending', NULL)
      RETURNING *
    `;

    const result = await db.query(insertQuery, [
      eventId,
      name.trim(),
      trimmedEmail,
      trimmedPhone,
      uniqueToken,
    ]);

    const newInvitee = result.rows[0];

    // STEP 6: Return invitee record including shareable link
    return res.status(201).json({
      success: true,
      invitee: newInvitee,
      invite_link: inviteLink,
    });
  } catch (error) {
    console.error('Error in addInvitee:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add invitee',
    });
  }
}

// 4.2 Remove Invitee
// DELETE /api/invitees/:id
async function removeInvitee(req, res) {
  try {
    const adminId = req.admin.adminId;
    const inviteeId = req.params.id;

    // STEP 1: Find invitee record
    const inviteeResult = await db.query('SELECT * FROM invitees WHERE id = $1', [inviteeId]);
    if (inviteeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invitee not found',
      });
    }

    const invitee = inviteeResult.rows[0];

    // STEP 2: Verify admin owns the event this invitee belongs to
    const eventResult = await db.query('SELECT * FROM events WHERE id = $1', [invitee.event_id]);
    if (eventResult.rows.length === 0 || eventResult.rows[0].created_by !== adminId) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied',
      });
    }

    // STEP 3: Delete the invitee
    await db.query('DELETE FROM invitees WHERE id = $1', [inviteeId]);

    return res.status(200).json({
      success: true,
      message: 'Guest removed from event',
    });
  } catch (error) {
    console.error('Error in removeInvitee:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove invitee',
    });
  }
}

module.exports = {
  addInvitee,
  removeInvitee,
};
