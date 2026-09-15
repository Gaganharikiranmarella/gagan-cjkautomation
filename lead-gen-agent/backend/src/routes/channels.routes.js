const { Router } = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const controller = require('../controllers/channels.controller');

const router = Router();

router.get('/', asyncHandler(controller.list));
router.post('/:name/connect', asyncHandler(controller.connect));
router.post('/:name/disconnect', asyncHandler(controller.disconnect));

module.exports = router;
