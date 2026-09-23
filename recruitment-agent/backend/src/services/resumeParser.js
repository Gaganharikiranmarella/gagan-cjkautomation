const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

// Turns an uploaded resume buffer into plain text, regardless of format.
async function extractResumeText(file) {
  const { mimetype, buffer } = file;

  if (mimetype === 'application/pdf') {
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (mimetype === 'text/plain') {
    return buffer.toString('utf-8');
  }

  throw new Error('Unsupported resume format');
}

module.exports = { extractResumeText };
