const mongoose = require('mongoose');
const Category = require('../models/category.model');
const Expense = require('../models/expense.model');

// Ensure system categories exist in MongoDB
async function ensureSystemCategories() {
  const count = await Category.countDocuments({ isSystem: true });
  if (count === 0) {
    const defaults = Category.DEFAULT_SYSTEM_CATEGORIES.map(c => ({
      ...c,
      userId: null,
      hiddenBy: []
    }));
    await Category.insertMany(defaults);
    console.log('[Category Service] Seeded default system categories.');
  }
}

// ---------------- GET USER CATEGORIES ----------------
exports.getUserCategories = async (userId) => {
  await ensureSystemCategories();
  const uid = new mongoose.Types.ObjectId(userId);

  // 1. Fetch all permanent system defaults
  const systemCategories = await Category.find({
    isSystem: true
  }).lean();

  // 2. Fetch user's active custom categories
  const customCategories = await Category.find({
    userId: uid,
    isArchived: { $ne: true }
  }).lean();

  // Combine and format
  const combined = [
    ...systemCategories.map(c => ({
      _id: c._id,
      name: c.name,
      icon: c.icon || '🏷️',
      color: c.color || '#38bdf8',
      isSystem: true,
      monthlyBudget: c.monthlyBudget || 0
    })),
    ...customCategories.map(c => ({
      _id: c._id,
      name: c.name,
      icon: c.icon || '🏷️',
      color: c.color || '#38bdf8',
      isSystem: false,
      monthlyBudget: c.monthlyBudget || 0
    }))
  ];

  // Put 'Other' at the end, sort rest alphabetically
  combined.sort((a, b) => {
    if (a.name === 'Other') return 1;
    if (b.name === 'Other') return -1;
    if (a.name === 'Carry Forward') return 1;
    if (b.name === 'Carry Forward') return -1;
    return a.name.localeCompare(b.name);
  });

  return combined;
};

// ---------------- GET CATEGORY NAMES ONLY ----------------
exports.getUserCategoryNames = async (userId) => {
  const categories = await exports.getUserCategories(userId);
  return categories.map(c => c.name);
};

// ---------------- CREATE CUSTOM CATEGORY ----------------
exports.createCategory = async (userId, data) => {
  const name = (data.name || '').trim();
  if (!name) {
    throw new Error('Category name is required');
  }

  const uid = new mongoose.Types.ObjectId(userId);

  // Check case-insensitive duplicate in user custom or active system categories
  const existing = await Category.findOne({
    $or: [
      { userId: uid, isArchived: { $ne: true }, name: new RegExp(`^${name}$`, 'i') },
      { isSystem: true, name: new RegExp(`^${name}$`, 'i') }
    ]
  });

  if (existing) {
    // If it was a system category that the user had hidden, unhide it!
    if (existing.isSystem) {
      await Category.findByIdAndUpdate(existing._id, {
        $pull: { hiddenBy: uid }
      });
      return existing;
    }
    throw new Error(`Category "${name}" already exists`);
  }

  const category = await Category.create({
    userId: uid,
    name,
    icon: data.icon || '🏷️',
    color: data.color || '#38bdf8',
    isSystem: false,
    monthlyBudget: Number(data.monthlyBudget) || 0
  });

  return category;
};

// ---------------- UPDATE CUSTOM CATEGORY ----------------
exports.updateCategory = async (userId, categoryId, data) => {
  const uid = new mongoose.Types.ObjectId(userId);
  const category = await Category.findOne({ _id: categoryId, userId: uid });

  if (!category) {
    throw new Error('Custom category not found or not editable');
  }

  const oldName = category.name;
  const newName = (data.name || '').trim();

  if (newName && newName.toLowerCase() !== oldName.toLowerCase()) {
    // Check if new name collides
    const conflict = await Category.findOne({
      _id: { $ne: categoryId },
      $or: [
        { userId: uid, isArchived: { $ne: true }, name: new RegExp(`^${newName}$`, 'i') },
        { isSystem: true, name: new RegExp(`^${newName}$`, 'i') }
      ]
    });
    if (conflict) {
      throw new Error(`Category "${newName}" already exists`);
    }

    category.name = newName;

    // Propagate category name update to existing expenses
    await Expense.updateMany(
      { userId: uid, category: oldName },
      { category: newName }
    );
  }

  if (data.icon) category.icon = data.icon;
  if (data.color) category.color = data.color;
  if (data.monthlyBudget !== undefined) category.monthlyBudget = Number(data.monthlyBudget) || 0;

  await category.save();
  return category;
};

// ---------------- DELETE CUSTOM CATEGORY ----------------
exports.deleteCategory = async (userId, categoryId, reassignTo = 'Other') => {
  const uid = new mongoose.Types.ObjectId(userId);
  const category = await Category.findOne({ _id: categoryId, userId: uid });

  if (!category) {
    throw new Error('Custom category not found or cannot be deleted');
  }

  const catName = category.name;

  // Reassign any existing expenses for this user to fallback category
  await Expense.updateMany(
    { userId: uid, category: catName },
    { category: reassignTo || 'Other' }
  );

  // Soft delete / archive category
  category.isArchived = true;
  await category.save();

  return { success: true, message: `Category "${catName}" removed. Existing expenses reassigned to "${reassignTo || 'Other'}".` };
};

// ---------------- TOGGLE HIDE/SHOW SYSTEM CATEGORY ----------------
exports.toggleHideSystemCategory = async (userId, categoryId, hide = true) => {
  const uid = new mongoose.Types.ObjectId(userId);
  const category = await Category.findOne({ _id: categoryId, isSystem: true });

  if (!category) {
    throw new Error('System category not found');
  }

  if (hide) {
    await Category.findByIdAndUpdate(categoryId, {
      $addToSet: { hiddenBy: uid }
    });
  } else {
    await Category.findByIdAndUpdate(categoryId, {
      $pull: { hiddenBy: uid }
    });
  }

  return { success: true, isHidden: hide };
};
