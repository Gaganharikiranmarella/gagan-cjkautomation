const express = require('express');
const {
  listOpenJobs,
  getJob,
  listMyJobs,
  createJob,
  updateJob,
  deleteJob,
} = require('../controllers/jobController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', listOpenJobs);
router.get('/mine', requireAuth('company'), listMyJobs);
router.get('/:id', getJob);
router.post('/', requireAuth('company'), createJob);
router.put('/:id', requireAuth('company'), updateJob);
router.delete('/:id', requireAuth('company'), deleteJob);

module.exports = router;
