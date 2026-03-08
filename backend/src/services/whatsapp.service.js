const axios = require('axios');

const getBaseUrl = () => {
    // Note: The user will need to supply their phone number ID via .env later
    return `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
};

const getHeaders = () => ({
    Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
    'Content-Type': 'application/json'
});

exports.sendTextMessage = async (to, text) => {
    try {
        await axios.post(getBaseUrl(), {
            messaging_product: 'whatsapp',
            to: to,
            type: 'text',
            text: { body: text }
        }, { headers: getHeaders() });
    } catch (error) {
        console.error('Failed to send WhatsApp text:', error?.response?.data || error.message);
    }
};

exports.sendInteractiveButtons = async (to, bodyText, buttons) => {
    try {
        const actionButtons = buttons.map(btn => ({
            type: 'reply',
            reply: { id: btn.id, title: btn.title }
        }));

        await axios.post(getBaseUrl(), {
            messaging_product: 'whatsapp',
            to: to,
            type: 'interactive',
            interactive: {
                type: 'button',
                body: { text: bodyText },
                action: { buttons: actionButtons }
            }
        }, { headers: getHeaders() });
    } catch (error) {
        console.error('Failed to send WhatsApp interactive buttons:', error?.response?.data || error.message);
    }
};
