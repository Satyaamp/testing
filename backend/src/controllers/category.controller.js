const service = require('../services/category.service');
const { success } = require('../utils/response.util');

// ---------------- GET ALL CATEGORIES FOR LOGGED-IN USER ----------------
exports.getAll = async (req, res) => {
  try {
    const categories = await service.getUserCategories(req.user.id);
    success(res, categories, 'Categories fetched successfully');
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------- CREATE CUSTOM CATEGORY ----------------
exports.create = async (req, res) => {
  try {
    const category = await service.createCategory(req.user.id, req.body);
    success(res, category, 'Category created successfully');
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ---------------- UPDATE CUSTOM CATEGORY ----------------
exports.update = async (req, res) => {
  try {
    const category = await service.updateCategory(req.user.id, req.params.id, req.body);
    success(res, category, 'Category updated successfully');
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ---------------- DELETE CUSTOM CATEGORY ----------------
exports.delete = async (req, res) => {
  try {
    const result = await service.deleteCategory(req.user.id, req.params.id, req.body?.reassignTo);
    success(res, result, result.message);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ---------------- TOGGLE DEFAULT VISIBILITY ----------------
exports.toggleVisibility = async (req, res) => {
  try {
    const hide = req.body?.hide !== false; // default to true if hide requested
    const result = await service.toggleHideSystemCategory(req.user.id, req.params.id, hide);
    success(res, result, hide ? 'Category hidden' : 'Category restored');
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
