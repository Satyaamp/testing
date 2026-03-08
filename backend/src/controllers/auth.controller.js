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



// Upload Avatar Route
exports.uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    // Use Cloudinary URL directly from multer-storage-cloudinary
    const avatarUrl = req.file.path;

    // Update user in database
    await authService.updateUser(req.user.id, { avatar: avatarUrl });

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

// Update Profile Route
exports.updateProfile = async (req, res, next) => {
  try {
    const { phoneNumber } = req.body;
    let data = {};
    if (phoneNumber) {
      // WhatsApp webhooks provide phone numbers as pure digit strings (e.g. 919876543210).
      // We strip out +, -, spaces, and parentheses to ensure a flawless match.
      data.phoneNumber = phoneNumber.replace(/\D/g, '');
    }

    // Only update if there are fields to update
    if (Object.keys(data).length > 0) {
      const user = await authService.updateUser(req.user.id, data);
      success(res, user, 'User profile updated');
    } else {
      res.status(400).json({ message: "No data provided to update" });
    }
  } catch (err) {
    next(err);
  }
};