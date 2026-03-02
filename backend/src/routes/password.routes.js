const express = require('express');
require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const { sendEmail } = require('../utils/sendEmail');

const router = express.Router();

// 1. Forgot Password Route
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  let user; // Define user here so it's accessible in catch block

  try {
    user = await User.findOne({ email });
    if (!user) {
      console.log("❌ User not found:", email);
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if a valid token already exists to prevent spam
    if (user.resetPasswordExpires && user.resetPasswordExpires > Date.now()) {
      return res.status(429).json({ message: 'A reset link is already active. Please check your email or wait 5 minutes.' });
    }

    // Generate Token
    const token = crypto.randomBytes(20).toString('hex');

    // Set Token and Expiration (5 minutes)
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 300000; // 5 minutes
    await user.save();

    // Construct the Link dynamically
    // Use 'origin' header to point back to Netlify if request came from there
    const clientUrl = req.headers.origin || `${req.headers['x-forwarded-proto'] || req.protocol}://${req.get('host')}`;
    
    const resetUrl = `${clientUrl}/reset-password?token=${token}`;
    const logoUrl = `${clientUrl}/assets/logo1.png`;
    const bannerUrl = `${clientUrl}/assets/banner.png`;

    await sendEmail({
      to: user.email,
      subject: 'Password Reset Request',
      // Fallback text
      text: `Hello ${user.name},\n\n 
      We received a request to reset your password for DhanRekha.\n
      Please click the link below to choose a new password:\n\n
      ${resetUrl}\n\n
      This link is valid for 5 minutes.\n
      If you did not request this change, please ignore this email.\n`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f4f4f5; padding: 20px; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="${logoUrl}" alt="DhanRekha Logo" style="width: 60px; height: 60px; border-radius: 12px; object-fit: cover;">
            <h2 style="color: #22c55e; margin: 10px 0 0; font-size: 24px;">DhanRekha</h2>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <h3 style="color: #1f2937; margin-top: 0; font-size: 20px;">Reset Your Password</h3>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">Hello <strong>${user.name}</strong>,</p>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">We received a request to reset the password for your account. To create a new password, click the button below:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #22c55e; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 10px rgba(34, 197, 94, 0.3);">Reset Password</a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">This link is valid for <strong>5 minutes</strong>.</p>
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">If you didn't request this, you can safely ignore this email.</p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
            <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} DhanRekha. All rights reserved.</p>
            <p style="margin: 5px 0;">Where Your Money Tells a Story.</p>
            <div style="margin-top: 15px;">
              <img src="${bannerUrl}" alt="DhanRekha Banner" style="width: 100%; border-radius: 8px;">
            </div>
          </div>
        </div>
      `
    });

    res.status(200).json({ message: 'Email sent successfully' });

  } catch (err) {
    console.error("Email Send Error:", err.message);

    // If email fails, clear the token so the user can try again immediately
    if (user) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save().catch(e => console.error("Failed to rollback user token", e));
    }

    // Send the actual error message to the frontend
    res.status(500).json({ message: err.message || 'Error sending email' });
  }
});

// 2. Verify Token Validity (GET) - Checks expiry on page load
router.get('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }, // Check if time is valid
    });

    if (!user) {
      return res.status(400).json({ message: 'Link expired or invalid.' });
    }
    res.status(200).json({ message: 'Valid' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// 2. Reset Password Route
router.post('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }, // Check if expiration is in the future
    });

    if (!user) {
      return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Clear the reset fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.status(200).json({ message: 'Password has been updated' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 3. Test Email Preview Route (For Development)
router.get('/test-email', (req, res) => {
  console.log('✅ Test email route hit');
  // Dummy data for preview
  const user = { name: "Test User" };
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const resetUrl = `${protocol}://${host}/reset-password.html?token=test-token-123`;
  const logoUrl = `${protocol}://${host}/assets/logo1.png`;
  const bannerUrl = `${protocol}://${host}/assets/banner.jpg`;

  // Same HTML template as above
  const html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f4f4f5; padding: 20px; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="${logoUrl}" alt="DhanRekha Logo" style="width: 60px; height: 60px; border-radius: 12px; object-fit: cover;">
            <h2 style="color: #22c55e; margin: 10px 0 0; font-size: 24px;">DhanRekha</h2>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <h3 style="color: #1f2937; margin-top: 0; font-size: 20px;">Reset Your Password</h3>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">Hello <strong>${user.name}</strong>,</p>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">We received a request to reset the password for your account. To create a new password, click the button below:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #22c55e; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 10px rgba(34, 197, 94, 0.3);">Reset Password</a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">This link is valid for <strong>5 minutes</strong>.</p>
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">If you didn't request this, you can safely ignore this email.</p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
            <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} DhanRekha. All rights reserved.</p>
            <p style="margin: 5px 0;">Where Your Money Tells a Story.</p>
            <div style="margin-top: 15px;">
              <img src="${bannerUrl}" alt="DhanRekha Banner" style="width: 100%; border-radius: 8px;">
            </div>
          </div>
        </div>
  `;
  
  res.send(html);
});

module.exports = router;