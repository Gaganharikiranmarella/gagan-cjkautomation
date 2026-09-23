const multer = require('multer');

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'text/plain',
]);

// Memory storage only - Vercel's filesystem is read-only in production, and
// we never need the file on disk, just its extracted text.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('Only PDF, DOCX or TXT resumes are accepted'));
    }
    cb(null, true);
  },
});

module.exports = upload;
