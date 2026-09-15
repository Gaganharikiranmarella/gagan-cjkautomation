const { Router } = require('express');

const router = Router();

router.use('/leads', require('./leads.routes'));
router.use('/campaigns', require('./campaigns.routes'));
router.use('/channels', require('./channels.routes'));
router.use('/dashboard', require('./dashboard.routes'));

module.exports = router;
