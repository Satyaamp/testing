const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    default: null // null = Global System Default, ObjectId = User-Created Custom Category
  },
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  icon: { 
    type: String, 
    default: '🏷️' 
  },
  color: { 
    type: String, 
    default: '#38bdf8' 
  },
  isSystem: { 
    type: Boolean, 
    default: false 
  },
  isArchived: { 
    type: Boolean, 
    default: false 
  },
  monthlyBudget: { 
    type: Number, 
    default: 0 
  },
  // Users who chose to hide this category from their personal view
  hiddenBy: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }]
}, { timestamps: true });

// Compound index for fast queries and unique category names per user
categorySchema.index({ userId: 1, name: 1 });

const DEFAULT_SYSTEM_CATEGORIES = [
  { name: 'Food', icon: '🍔', color: '#f59e0b', isSystem: true },
  { name: 'Transport', icon: '🚗', color: '#3b82f6', isSystem: true },
  { name: 'Groceries', icon: '🛒', color: '#10b981', isSystem: true },
  { name: 'Rent', icon: '🏠', color: '#8b5cf6', isSystem: true },
  { name: 'Personal Care', icon: '🧴', color: '#ec4899', isSystem: true },
  { name: 'Shopping', icon: '🛍️', color: '#f43f5e', isSystem: true },
  { name: 'Bills', icon: '📄', color: '#06b6d4', isSystem: true },
  { name: 'Entertainment', icon: '🎬', color: '#a855f7', isSystem: true },
  { name: 'Health', icon: '💊', color: '#ef4444', isSystem: true },
  { name: 'Education', icon: '📚', color: '#6366f1', isSystem: true },
  { name: 'Investment', icon: '📈', color: '#14b8a6', isSystem: true },
  { name: 'Electric Bill', icon: '⚡', color: '#eab308', isSystem: true },
  { name: 'Water Bill', icon: '💧', color: '#0ea5e9', isSystem: true },
  { name: 'Cylinder', icon: '🔥', color: '#f97316', isSystem: true },
  { name: 'Internet Bill', icon: '🌐', color: '#0284c7', isSystem: true },
  { name: 'Stationery', icon: '✏️', color: '#64748b', isSystem: true },
  { name: 'EMI', icon: '💳', color: '#d946ef', isSystem: true },
  { name: 'Carry Forward', icon: '🔄', color: '#64748b', isSystem: true },
  { name: 'Other', icon: '📦', color: '#94a3b8', isSystem: true }
];

const Category = mongoose.model('Category', categorySchema);
Category.DEFAULT_SYSTEM_CATEGORIES = DEFAULT_SYSTEM_CATEGORIES;

module.exports = Category;
