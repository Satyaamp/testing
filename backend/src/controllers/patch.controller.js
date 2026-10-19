const Patch = require('../models/patch.model');

exports.getAll = async (req, res) => {
  try {
    const patches = await Patch.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: patches });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch patches' });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, amount, category, description } = req.body;
    if (!name || !amount || !category) {
      return res.status(400).json({ success: false, message: 'Name, amount, and category are required' });
    }

    const patch = await Patch.create({
      userId: req.user.id,
      name: name.trim(),
      amount: Number(amount),
      category: category.trim(),
      description: description ? description.trim() : ''
    });

    res.status(201).json({ success: true, data: patch });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to create patch' });
  }
};

exports.update = async (req, res) => {
  try {
    const { name, amount, category, description } = req.body;
    const patch = await Patch.findOne({ _id: req.params.id, userId: req.user.id });

    if (!patch) {
      return res.status(404).json({ success: false, message: 'Patch not found' });
    }

    if (name !== undefined) patch.name = name.trim();
    if (amount !== undefined) patch.amount = Number(amount);
    if (category !== undefined) patch.category = category.trim();
    if (description !== undefined) patch.description = description.trim();

    await patch.save();
    res.status(200).json({ success: true, data: patch });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update patch' });
  }
};

exports.delete = async (req, res) => {
  try {
    const patch = await Patch.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!patch) {
      return res.status(404).json({ success: false, message: 'Patch not found' });
    }
    res.status(200).json({ success: true, message: 'Patch deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to delete patch' });
  }
};
