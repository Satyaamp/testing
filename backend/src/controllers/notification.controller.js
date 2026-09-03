const notificationService = require('../services/notification.service');
const { success } = require('../utils/response.util');

exports.getVapidKey = async (req, res) => {
  try {
    const publicKey = notificationService.getVapidPublicKey();
    success(res, { publicKey }, 'VAPID public key fetched');
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getSettings = async (req, res) => {
  try {
    const settings = await notificationService.getSettings(req.user.id);
    success(res, settings, 'Reminder settings fetched');
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.subscribe = async (req, res) => {
  try {
    const { subscription, reminderSettings } = req.body;
    const result = await notificationService.saveSubscription(
      req.user.id,
      subscription,
      reminderSettings
    );
    success(res, result, 'Notification preferences saved successfully');
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.sendTest = async (req, res) => {
  try {
    const result = await notificationService.sendTestNotification(req.user.id);
    success(res, result, 'Test notification sent');
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
