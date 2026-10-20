const db = require('../config/db');

// 5.1 Get Invitation by Token
// GET /api/invite/:token
async function getInviteByToken(req, res) {
  try {
    const { token } = req.params;

    // STEP 1: Look up invitee by their token
    const inviteeResult = await db.query('SELECT * FROM invitees WHERE token = $1', [token]);
    if (inviteeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'This invitation link is invalid or has expired',
      });
    }

    const invitee = inviteeResult.rows[0];

    // STEP 2: Get the event this invitation belongs to
    const eventResult = await db.query('SELECT * FROM events WHERE id = $1', [invitee.event_id]);
    if (eventResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'The event for this invitation no longer exists',
      });
    }

    const event = eventResult.rows[0];

    // STEP 3: Check if the RSVP deadline has passed
    const deadlinePassed = new Date() > new Date(event.rsvp_deadline);

    // STEP 4: Return invitation data to display on guest page
    return res.status(200).json({
      success: true,
      guest_name: invitee.name,
      current_status: invitee.status,
      deadline_passed: deadlinePassed,
      event: {
        title: event.title,
        description: event.description,
        event_date: event.event_date,
        event_time: event.event_time,
        venue: event.venue,
        dress_code: event.dress_code,
        rsvp_deadline: event.rsvp_deadline,
        cover_image_url: event.cover_image_url,
      },
    });
  } catch (error) {
    console.error('Error in getInviteByToken:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve invitation',
    });
  }
}

// 5.2 Submit RSVP Response
// POST /api/invite/:token/respond
async function submitRSVP(req, res) {
  try {
    const { token } = req.params;
    const { response } = req.body;

    // STEP 1: Find invitee by token
    const inviteeResult = await db.query('SELECT * FROM invitees WHERE token = $1', [token]);
    if (inviteeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invalid invitation link',
      });
    }

    const invitee = inviteeResult.rows[0];

    // STEP 2: Check guest has not already responded
    if (invitee.status !== 'pending') {
      return res.status(409).json({
        success: false,
        message: 'You have already responded to this invitation',
      });
    }

    // STEP 3: Validate response value
    if (response !== 'accepted' && response !== 'declined') {
      return res.status(400).json({
        success: false,
        message: 'Response must be accepted or declined',
      });
    }

    // STEP 4: Check RSVP deadline has not passed
    const eventResult = await db.query('SELECT * FROM events WHERE id = $1', [invitee.event_id]);
    if (eventResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'The event for this invitation no longer exists',
      });
    }

    const event = eventResult.rows[0];
    if (new Date() > new Date(event.rsvp_deadline)) {
      return res.status(410).json({
        success: false,
        message: 'The RSVP deadline for this event has passed',
      });
    }

    // STEP 5: Save response to database
    await db.query(
      `UPDATE invitees 
       SET status = $1, responded_at = NOW() 
       WHERE id = $2`,
      [response, invitee.id]
    );

    // STEP 6: Return appropriate confirmation message
    if (response === 'accepted') {
      return res.status(200).json({
        success: true,
        message: 'Your attendance has been confirmed. Welcome!',
        status: 'accepted',
      });
    } else {
      return res.status(200).json({
        success: true,
        message: 'Thank you for letting us know. You have been marked as unable to attend.',
        status: 'declined',
      });
    }
  } catch (error) {
    console.error('Error in submitRSVP:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit RSVP response',
    });
  }
}

module.exports = {
  getInviteByToken,
  submitRSVP,
};
