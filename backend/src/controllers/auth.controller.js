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