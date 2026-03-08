const User = require('../models/user.model');

// Webhook Verification (GET)
exports.verifyWebhook = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else {
        res.status(400).send('Missing parameters');
    }
};

// Webhook Message Handling (POST)
exports.handleMessage = async (req, res) => {
    try {
        const body = req.body;

        if (body.object) {
            if (
                body.entry &&
                body.entry[0].changes &&
                body.entry[0].changes[0] &&
                body.entry[0].changes[0].value.messages &&
                body.entry[0].changes[0].value.messages[0]
            ) {
                const msg = body.entry[0].changes[0].value.messages[0];
                const from = msg.from;

                let msgBody = null;
                if (msg.type === 'text') {
                    msgBody = msg.text.body;
                } else if (msg.type === 'interactive' && msg.interactive.type === 'button_reply') {
                    msgBody = msg.interactive.button_reply.id;
                }

                if (msgBody) {
                    console.log(`[WhatsApp Webhook] Processing Message from ${from}: ${msgBody}`);
                    // Fire and forget so we acknowledge Meta quickly
                    const whatsappSession = require('../services/whatsappSession');
                    whatsappSession.processMessage(from, msgBody).catch(e => console.error("Session Error", e));
                }
            }
            res.status(200).send('EVENT_RECEIVED');
        } else {
            res.sendStatus(404);
        }
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).send('Internal Server Error');
    }
};
