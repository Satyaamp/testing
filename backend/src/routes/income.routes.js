const express = require('express');
const mongoose = require('mongoose');
const protect = require('../middleware/auth.middleware');
const Income = require('../models/income.model');

const {
  createIncome,
  getMonthlyIncome,
} = require('../controllers/income.controller');

const router = express.Router();

router.post('/', protect, createIncome);
router.get('/', protect, getMonthlyIncome);

router.get('/yearly', protect, async (req, res) => {
  try {
    const incomeStats = await Income.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.user.id) } },
      {
        $group: {
          _id: { $year: "$date" },
          totalIncome: { $sum: "$amount" }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    res.status(200).json({ success: true, data: incomeStats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
