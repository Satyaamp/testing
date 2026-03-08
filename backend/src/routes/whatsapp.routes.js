const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsapp.controller');

// Meta WhatsApp Webhook Validation Endpoint
router.get('/webhook', whatsappController.verifyWebhook);

// Meta WhatsApp Inbound Message Endpoint
router.post('/webhook', whatsappController.handleMessage);

module.exports = router;
