const express = require('express');
const { applyToJob, listMyApplications, listApplicantsForJob } = require('../controllers/applicationController');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.get('/mine', requireAuth('applicant'), listMyApplications);
router.get('/job/:jobId', requireAuth('company'), listApplicantsForJob);
router.post('/:jobId', requireAuth('applicant'), upload.single('resume'), applyToJob);

module.exports = router;
