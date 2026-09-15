const { Router } = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const controller = require('../controllers/leads.controller');

const router = Router();

router.get('/', asyncHandler(controller.list));
router.post('/', asyncHandler(controller.create));
router.post('/import', asyncHandler(controller.importBatch));
router.patch('/:id', asyncHandler(controller.update));
router.delete('/:id', asyncHandler(controller.remove));

module.exports = router;
