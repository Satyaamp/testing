const webpush = require('web-push');
const cron = require('node-cron');
const User = require('../models/user.model');

// Initialize WebPush with VAPID keys
const vapidContact = process.env.EMAIL_USER
  ? `mailto:${process.env.EMAIL_USER}`
  : 'mailto:support@dhanrekha.com';

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    vapidContact,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  console.log('✅ WebPush VAPID details configured successfully.');
} else {
  console.warn('⚠️ WebPush VAPID keys not configured in .env!');
}

exports.getVapidPublicKey = () => {
  return process.env.VAPID_PUBLIC_KEY || null;
};

exports.getSettings = async (userId) => {
  const user = await User.findById(userId).select('reminderSettings');
  if (!user) throw new Error('User not found');
  return user.reminderSettings || { enabled: false, time: '21:00', timezone: 'Asia/Kolkata' };
};

exports.saveSubscription = async (userId, subscription, reminderSettings) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  if (reminderSettings) {
    user.reminderSettings = {
      ...user.reminderSettings.toObject(),
      ...reminderSettings
    };
  }

  if (subscription && subscription.endpoint) {
    const exists = user.pushSubscriptions.some(
      (sub) => sub.endpoint === subscription.endpoint
    );
    if (!exists) {
      user.pushSubscriptions.push(subscription);
    }
  }

  await user.save();
  return {
    reminderSettings: user.reminderSettings,
    subscriptionCount: user.pushSubscriptions.length
  };
};

exports.sendNotificationToUser = async (userId, payload) => {
  const user = await User.findById(userId);
  if (!user || !user.pushSubscriptions || user.pushSubscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const payloadString = JSON.stringify(payload);
  const deadSubscriptions = [];
  let sentCount = 0;

  for (const sub of user.pushSubscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth
          }
        },
        payloadString
      );
      sentCount++;
    } catch (err) {
      // Status 410 (Gone) or 404 means the subscription expired/unsubscribed
      if (err.statusCode === 410 || err.statusCode === 404) {
        deadSubscriptions.push(sub.endpoint);
      } else {
        console.warn(`WebPush delivery error for ${sub.endpoint}:`, err.message);
      }
    }
  }

  // Clean up any dead/expired subscriptions
  if (deadSubscriptions.length > 0) {
    user.pushSubscriptions = user.pushSubscriptions.filter(
      (sub) => !deadSubscriptions.includes(sub.endpoint)
    );
    await user.save();
  }

  return { sent: sentCount, failed: deadSubscriptions.length };
};

exports.sendTestNotification = async (userId) => {
  const user = await User.findById(userId);
  const rawName = (user?.name || '').trim();
  const firstName = rawName.split(' ')[0];
  const greeting = firstName ? `Hi ${firstName.charAt(0).toUpperCase() + firstName.slice(1)}` : 'Hello';

  const testPayload = {
    title: '🔔 Daily Reminders Active • Dhan₹ekha',
    body: `${greeting}, your daily expense reminder is working smoothly! Tap anytime to log expenses.`,
    icon: '/assets/icons/icon-192.png',
    badge: '/assets/icons/icon-72.png',
    url: '/dashboard?action=add-expense',
    data: {
      action: 'add-expense',
      url: '/dashboard?action=add-expense'
    }
  };

  const result = await exports.sendNotificationToUser(userId, testPayload);
  return result;
};

// Scheduled job: checks every minute for users whose reminder time has arrived
exports.initReminderCron = () => {
  cron.schedule('* * * * *', async () => {
    try {
      // Format current time in Asia/Kolkata (IST) as HH:mm
      const now = new Date();
      const istTimeStr = now.toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      // Find users with reminders enabled for this time
      const usersToRemind = await User.find({
        'reminderSettings.enabled': true,
        'reminderSettings.time': istTimeStr,
        'pushSubscriptions.0': { $exists: true }
      });

      if (usersToRemind.length > 0) {
        console.log(`⏰ [Reminder Cron] Triggering reminders for ${usersToRemind.length} user(s) at ${istTimeStr} IST.`);

        for (const user of usersToRemind) {
          const rawName = (user.name || '').trim();
          const firstName = rawName.split(' ')[0];
          const greeting = firstName ? `Hi ${firstName.charAt(0).toUpperCase() + firstName.slice(1)}` : 'Hello';

          const reminderPayload = {
            title: '🔔 Daily Expense Check-in',
            body: `${greeting}, have you logged all your expenses for today? Take 30 seconds to keep your Dhan₹ekha budget accurate!`,
            icon: '/assets/icons/icon-192.png',
            badge: '/assets/icons/icon-72.png',
            url: '/dashboard?action=add-expense',
            data: {
              action: 'add-expense',
              url: '/dashboard?action=add-expense'
            }
          };

          exports.sendNotificationToUser(user._id, reminderPayload).catch((err) => {
            console.error(`Failed sending reminder to user ${user._id}:`, err);
          });
        }
      }
    } catch (err) {
      console.error('Error in Reminder Cron job:', err);
    }
  });

  console.log('⏰ [Reminder Cron] Daily expense reminder scheduler initialized.');
};
