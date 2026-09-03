const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  phoneNumber: { type: String, unique: true, sparse: true },
  avatar: { type: String, default: null },
  reminderSettings: {
    enabled: { type: Boolean, default: false },
    time: { type: String, default: "21:00" }, // "HH:mm" in user timezone
    timezone: { type: String, default: "Asia/Kolkata" }
  },
  pushSubscriptions: [
    {
      endpoint: { type: String, required: true },
      keys: {
        p256dh: { type: String, required: true },
        auth: { type: String, required: true }
      },
      createdAt: { type: Date, default: Date.now }
    }
  ],
  resetPasswordToken: String,
  resetPasswordExpires: Date
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
