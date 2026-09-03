const router = require('express').Router();
const protect = require('../middleware/auth.middleware');
const ctrl = require('../controllers/notification.controller');

router.get('/vapid-key', ctrl.getVapidKey);
router.get('/settings', protect, ctrl.getSettings);
router.post('/subscribe', protect, ctrl.subscribe);
router.post('/test', protect, ctrl.sendTest);

module.exports = router;
