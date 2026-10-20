const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');
const { allowedExtensions } = require('../middleware/upload');

// Helper to upload buffer to Cloudinary
function uploadBufferToCloudinary(fileBuffer, options) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    uploadStream.end(fileBuffer);
  });
}

// 6.1 Upload Material
// POST /api/events/:id/materials
async function uploadMaterial(req, res) {
  try {
    const adminId = req.admin.adminId;
    const eventId = req.params.id;
    const file = req.file;

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

    // STEP 2: Validate uploaded file
    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const fileExt = path.extname(file.originalname).replace('.', '').toLowerCase();
    const fileSizeMB = file.size / (1024 * 1024);
    const fileSizeKB = Math.round((file.size / 1024) * 100) / 100;

    if (!allowedExtensions.includes(fileExt)) {
      return res.status(400).json({
        success: false,
        message: 'File type not allowed. Use PDF, Word, Excel, or image files.',
      });
    }

    if (fileSizeMB > 10) {
      return res.status(400).json({
        success: false,
        message: 'File is too large. Maximum size is 10MB.',
      });
    }

    // STEP 3: Upload file to Cloudinary for storage
    let fileUrl = '';
    let publicId = uuidv4();

    if (isCloudinaryConfigured()) {
      try {
        const uploadResult = await uploadBufferToCloudinary(file.buffer, {
          folder: `uacc-eventhub/events/${eventId}/materials`,
          resource_type: 'raw',
          public_id: publicId,
        });
        fileUrl = uploadResult.secure_url;
        publicId = uploadResult.public_id;
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'File upload failed. Please try again.',
        });
      }
    } else {
      // In local dev without Cloudinary credentials configured yet:
      fileUrl = `https://placeholder-materials.uacc.org/materials/${publicId}.${fileExt}`;
      console.warn('⚠️ Cloudinary is not configured yet. Using placeholder URL for uploaded material.');
    }

    // STEP 4: Save the material record to the database
    const insertQuery = `
      INSERT INTO event_materials (
        event_id, file_name, file_url, cloudinary_public_id, file_type, file_size_kb
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await db.query(insertQuery, [
      eventId,
      file.originalname,
      fileUrl,
      publicId,
      fileExt,
      fileSizeKB,
    ]);

    const newMaterial = result.rows[0];

    return res.status(201).json({
      success: true,
      material: newMaterial,
    });
  } catch (error) {
    console.error('Error in uploadMaterial:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload event material',
    });
  }
}

// 6.2 Get Materials (Accepted Guests Only)
// GET /api/invite/:token/materials
async function getMaterialsForGuest(req, res) {
  try {
    const { token } = req.params;

    // STEP 1: Find invitee and verify they accepted invitation
    const inviteeResult = await db.query('SELECT * FROM invitees WHERE token = $1', [token]);
    if (inviteeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invalid invitation link',
      });
    }

    const invitee = inviteeResult.rows[0];

    // STEP 2: Only accepted guests may access materials
    if (invitee.status !== 'accepted') {
      return res.status(403).json({
        success: false,
        message: 'Event materials are only available to confirmed guests',
      });
    }

    // STEP 3: Fetch all materials for this event
    const materialsResult = await db.query(
      'SELECT id, file_name, file_url, file_type, file_size_kb, uploaded_at FROM event_materials WHERE event_id = $1 ORDER BY uploaded_at DESC',
      [invitee.event_id]
    );

    return res.status(200).json({
      success: true,
      materials: materialsResult.rows,
    });
  } catch (error) {
    console.error('Error in getMaterialsForGuest:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve materials',
    });
  }
}

// 6.3 Delete Material
// DELETE /api/materials/:id
async function deleteMaterial(req, res) {
  try {
    const adminId = req.admin.adminId;
    const materialId = req.params.id;

    // STEP 1: Find the material
    const materialResult = await db.query(
      'SELECT * FROM event_materials WHERE id = $1',
      [materialId]
    );

    if (materialResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Material not found',
      });
    }

    const material = materialResult.rows[0];

    // STEP 2: Verify admin owns the event this material belongs to
    const eventResult = await db.query('SELECT * FROM events WHERE id = $1', [material.event_id]);
    if (eventResult.rows.length === 0 || eventResult.rows[0].created_by !== adminId) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied',
      });
    }

    // STEP 3: Delete file from Cloudinary
    if (material.cloudinary_public_id && isCloudinaryConfigured()) {
      try {
        await cloudinary.uploader.destroy(material.cloudinary_public_id, {
          resource_type: 'raw',
        });
      } catch (cloudErr) {
        console.warn(`Failed to delete Cloudinary file ${material.cloudinary_public_id}:`, cloudErr.message);
      }
    }

    // STEP 4: Delete record from the database
    await db.query('DELETE FROM event_materials WHERE id = $1', [materialId]);

    return res.status(200).json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    console.error('Error in deleteMaterial:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete material',
    });
  }
}

module.exports = {
  uploadMaterial,
  getMaterialsForGuest,
  deleteMaterial,
};
