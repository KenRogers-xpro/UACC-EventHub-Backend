const multer = require('multer');
const path = require('path');

const allowedExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png'];
const maxSizeInBytes = 10 * 1024 * 1024; // 10MB

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).replace('.', '').toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    const error = new Error('File type not allowed. Use PDF, Word, Excel, or image files.');
    error.status = 400;
    return cb(error, false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: maxSizeInBytes,
  },
  fileFilter,
});

module.exports = {
  upload,
  allowedExtensions,
  maxSizeInBytes,
};
