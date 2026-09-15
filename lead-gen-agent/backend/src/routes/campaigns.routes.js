const { Router } = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const controller = require('../controllers/campaigns.controller');

const router = Router();

router.get('/', asyncHandler(controller.list));
router.post('/', asyncHandler(controller.create));
router.get('/recipients/preview', asyncHandler(controller.previewRecipients));
router.get('/:id', asyncHandler(controller.get));
router.get('/:id/status', asyncHandler(controller.status));
router.post('/:id/send', asyncHandler(controller.send));
router.delete('/:id', asyncHandler(controller.remove));

module.exports = router;
