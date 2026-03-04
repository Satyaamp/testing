const authService = require('../services/auth.service');
const { success } = require('../utils/response.util');

// Register Route
exports.register = async (req, res, next) => {
  try {
    const user = await authService.register(req.body);
    success(res, user, 'Registration successful');
  } catch (err) {
    next(err);
  }
};

const fs = require('fs');
const path = require('path');

// Upload Avatar Route
exports.uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    // 1. Get current user to check for old avatar
    const user = await authService.getMe(req.user.id);
    const oldAvatar = user.avatar;

    // 2. Construct the new avatar URL path
    const avatarUrl = `/api/uploads/avatars/${req.file.filename}`;

    // 3. Update user in database
    await authService.updateUser(req.user.id, { avatar: avatarUrl });

    // 4. Cleanup old local avatar file if it exists
    if (oldAvatar) {
      if (oldAvatar.startsWith('/api/uploads/avatars/')) {
        const oldFilename = oldAvatar.split('/').pop();
        const oldPath = path.join(__dirname, '../uploads/avatars', oldFilename);
        fs.unlink(oldPath, (err) => { if (err) console.log("Failed to delete old backend avatar:", err); });
      } else if (oldAvatar.startsWith('/assets/avatars/')) {
        const oldPath = path.join(__dirname, '../../../frontend', oldAvatar);
        fs.unlink(oldPath, (err) => { if (err) console.log("Failed to delete old frontend avatar:", err); });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Avatar uploaded successfully',
      avatarUrl: avatarUrl
    });
  } catch (err) {
    next(err);
  }
};

// Login Route
exports.login = async (req, res, next) => {
  try {
    const user = await authService.login(
      req.body.email,
      req.body.password
    );
    success(res, user, 'Login successful');
  } catch (err) {
    next(err); // ✅ VERY IMPORTANT
  }
};

// Profile Route
exports.me = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user.id);
    success(res, user, 'User profile fetched');
  } catch (err) {
    next(err);
  }
};