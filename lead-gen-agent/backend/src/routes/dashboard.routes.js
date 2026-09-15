const { Router } = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const controller = require('../controllers/dashboard.controller');

const router = Router();

router.get('/summary', asyncHandler(controller.summary));

module.exports = router;
