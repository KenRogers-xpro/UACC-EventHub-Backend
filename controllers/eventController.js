const db = require('../config/db');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');

// Upload cover image to Cloudinary
// POST /api/events/cover-image
async function uploadCoverImage(req, res) {
  try {
    if (!isCloudinaryConfigured()) {
      return res.status(500).json({
        success: false,
        message: 'Cloud storage is not configured. Please set up Cloudinary.',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided',
      });
    }

    // Upload buffer to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'uacc-eventhub/covers',
          resource_type: 'image',
          transformation: [
            { width: 1600, height: 900, crop: 'limit', quality: 'auto', format: 'jpg' },
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    return res.status(200).json({
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (error) {
    console.error('Error uploading cover image:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload cover image',
    });
  }
}

// 3.1 Create Event
// POST /api/events
async function createEvent(req, res) {
  try {
    const adminId = req.admin.adminId;
    const {
      title,
      description,
      event_date,
      event_time,
      venue,
      dress_code,
      rsvp_deadline,
      cover_image_url,
    } = req.body;

    // STEP 1: Validate required fields
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Event title is required' });
    }
    if (!event_date) {
      return res.status(400).json({ success: false, message: 'Event date is required' });
    }
    if (!venue || !venue.trim()) {
      return res.status(400).json({ success: false, message: 'Venue is required' });
    }
    if (!rsvp_deadline) {
      return res.status(400).json({ success: false, message: 'RSVP deadline is required' });
    }

    // STEP 2: Ensure RSVP deadline is before event date
    const rsvpDateObj = new Date(rsvp_deadline);
    const eventDateObj = new Date(event_date);

    if (rsvpDateObj > eventDateObj) {
      return res.status(400).json({
        success: false,
        message: 'RSVP deadline must be before the event date',
      });
    }

    // STEP 3: Insert new event into database
    const insertQuery = `
      INSERT INTO events (
        title, description, event_date, event_time, venue,
        dress_code, rsvp_deadline, cover_image_url, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      title.trim(),
      description ? description.trim() : null,
      event_date,
      event_time ? event_time.trim() : null,
      venue.trim(),
      dress_code ? dress_code.trim() : null,
      rsvp_deadline,
      cover_image_url || null,
      adminId,
    ];

    const result = await db.query(insertQuery, values);
    const newEvent = result.rows[0];

    // STEP 4: Return created event
    return res.status(201).json({
      success: true,
      event: newEvent,
    });
  } catch (error) {
    console.error('Error in createEvent:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create event',
    });
  }
}

// 3.2 Get All Events
// GET /api/events
async function getAllEvents(req, res) {
  try {
    const adminId = req.admin.adminId;

    // Fetch all events created by admin ordered by created_at DESC with aggregate RSVP counts
    const query = `
      SELECT 
        e.*,
        COALESCE(COUNT(i.id), 0)::INT AS total_invited,
        COALESCE(COUNT(CASE WHEN i.status = 'accepted' THEN 1 END), 0)::INT AS total_accepted,
        COALESCE(COUNT(CASE WHEN i.status = 'declined' THEN 1 END), 0)::INT AS total_declined,
        COALESCE(COUNT(CASE WHEN i.status = 'pending' THEN 1 END), 0)::INT AS total_pending
      FROM events e
      LEFT JOIN invitees i ON e.id = i.event_id
      WHERE e.created_by = $1
      GROUP BY e.id
      ORDER BY e.created_at DESC
    `;

    const result = await db.query(query, [adminId]);

    return res.status(200).json({
      success: true,
      events: result.rows,
    });
  } catch (error) {
    console.error('Error in getAllEvents:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch events',
    });
  }
}

// 3.3 Get Single Event
// GET /api/events/:id
async function getSingleEvent(req, res) {
  try {
    const adminId = req.admin.adminId;
    const eventId = req.params.id;

    // STEP 1: Find the event
    const eventResult = await db.query('SELECT * FROM events WHERE id = $1', [eventId]);
    if (eventResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    const event = eventResult.rows[0];

    // STEP 2: Confirm this admin owns the event
    if (event.created_by !== adminId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this event',
      });
    }

    // STEP 3: Fetch all guests for this event
    const guestsResult = await db.query(
      'SELECT * FROM invitees WHERE event_id = $1 ORDER BY created_at DESC',
      [eventId]
    );

    // STEP 4: Fetch all uploaded materials for this event
    const materialsResult = await db.query(
      'SELECT * FROM event_materials WHERE event_id = $1 ORDER BY uploaded_at DESC',
      [eventId]
    );

    // STEP 5: Build and return full response
    return res.status(200).json({
      success: true,
      event,
      guests: guestsResult.rows,
      materials: materialsResult.rows,
    });
  } catch (error) {
    console.error('Error in getSingleEvent:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch event details',
    });
  }
}

// 3.4 Update Event
// PUT /api/events/:id
async function updateEvent(req, res) {
  try {
    const adminId = req.admin.adminId;
    const eventId = req.params.id;
    const updatedData = req.body;

    // STEP 1: Find the event and verify ownership
    const existingResult = await db.query('SELECT * FROM events WHERE id = $1', [eventId]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    const event = existingResult.rows[0];
    if (event.created_by !== adminId) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied',
      });
    }

    // Allowed fields
    const validFields = [
      'title',
      'description',
      'event_date',
      'event_time',
      'venue',
      'dress_code',
      'rsvp_deadline',
      'cover_image_url',
    ];

    // STEP 2: Apply only fields that were provided
    const fieldsToUpdate = {};
    for (const field of validFields) {
      if (updatedData[field] !== undefined && updatedData[field] !== null && String(updatedData[field]).trim() !== '') {
        fieldsToUpdate[field] = updatedData[field];
      }
    }

    // STEP 3: If RSVP deadline changed, re-validate it
    if (fieldsToUpdate.rsvp_deadline || fieldsToUpdate.event_date) {
      const targetDate = fieldsToUpdate.event_date || event.event_date;
      const targetRsvp = fieldsToUpdate.rsvp_deadline || event.rsvp_deadline;

      if (new Date(targetRsvp) > new Date(targetDate)) {
        return res.status(400).json({
          success: false,
          message: 'RSVP deadline must be before the event date',
        });
      }
    }

    const fieldKeys = Object.keys(fieldsToUpdate);
    if (fieldKeys.length === 0) {
      return res.status(200).json({
        success: true,
        event,
      });
    }

    // STEP 4: Save changes to the database
    const setClauses = fieldKeys.map((key, idx) => `"${key}" = $${idx + 2}`).join(', ');
    const values = [eventId, ...fieldKeys.map((k) => fieldsToUpdate[k])];

    const updateQuery = `
      UPDATE events
      SET ${setClauses}
      WHERE id = $1
      RETURNING *
    `;

    const updateResult = await db.query(updateQuery, values);
    const updatedEvent = updateResult.rows[0];

    return res.status(200).json({
      success: true,
      event: updatedEvent,
    });
  } catch (error) {
    console.error('Error in updateEvent:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update event',
    });
  }
}

// 3.5 Delete Event
// DELETE /api/events/:id
async function deleteEvent(req, res) {
  try {
    const adminId = req.admin.adminId;
    const eventId = req.params.id;

    // STEP 1: Find event and verify ownership
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

    // STEP 2: Delete all associated materials from Cloudinary
    const materialsResult = await db.query(
      'SELECT id, cloudinary_public_id FROM event_materials WHERE event_id = $1',
      [eventId]
    );

    if (isCloudinaryConfigured()) {
      for (const material of materialsResult.rows) {
        if (material.cloudinary_public_id) {
          try {
            await cloudinary.uploader.destroy(material.cloudinary_public_id, {
              resource_type: 'raw',
            });
          } catch (cloudErr) {
            console.warn(`Failed to delete Cloudinary file ${material.cloudinary_public_id}:`, cloudErr.message);
          }
        }
      }
    }

    // STEP 3: Delete database records (cascade order: materials -> invitees -> event)
    await db.query('DELETE FROM event_materials WHERE event_id = $1', [eventId]);
    await db.query('DELETE FROM invitees WHERE event_id = $1', [eventId]);
    await db.query('DELETE FROM events WHERE id = $1', [eventId]);

    // STEP 4: Return success
    return res.status(200).json({
      success: true,
      message: 'Event and all associated data deleted',
    });
  } catch (error) {
    console.error('Error in deleteEvent:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete event',
    });
  }
}

module.exports = {
  uploadCoverImage,
  createEvent,
  getAllEvents,
  getSingleEvent,
  updateEvent,
  deleteEvent,
};
