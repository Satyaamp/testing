const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const { generateToken } = require('../utils/jwt.util');


exports.register = async (data) => {
  // 1️⃣ Check if user already exists
  const existingUser = await User.findOne({ email: data.email });
  if (existingUser) {
    throw new Error('Email already registered');
  }

  // 2️⃣ Hash password
  const hashed = await bcrypt.hash(data.password, 10);

  // 3️⃣ Create user
  const user = await User.create({
    name: data.name,
    email: data.email,
    password: hashed
  });

  // 4️⃣ Return JWT
  return generateToken({ id: user._id });
};

exports.login = async (email, password) => {
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new Error('Invalid credentials');
  }

  return {
    token: generateToken({ id: user._id }),
    user: {
      name: user.name,
      email: user.email,
      avatar: user.avatar
    }
  };
};

exports.getMe = async (userId) => {
  const user = await User.findById(userId).select('-password');
  if (!user) throw new Error('User not found');
  return user;
};

exports.updateUser = async (userId, data) => {
  const user = await User.findByIdAndUpdate(userId, data, { new: true });
  if (!user) throw new Error('User not found');

  return user;
};

exports.deleteUser = async (userId) => {
  const user = await User.findByIdAndDelete(userId);
  if (!user) throw new Error('User not found');

  return { message: 'User deleted successfully' };
};
