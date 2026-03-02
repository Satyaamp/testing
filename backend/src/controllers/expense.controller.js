const service = require('../services/expense.service');
const { success } = require('../utils/response.util');
const Expense = require('../models/expense.model'); // 👈 Add this line at the top!
const mongoose = require('mongoose');
const parser = require('../utils/parser.util');

exports.create = async (req, res) => {
  try {
    success(res, await service.createExpense(req.user.id, req.body));
  } catch (err) {
    console.error("[Create Expense Error]", err.message);
    res.status(400).json({ message: err.message });
  }
};

exports.weekly = async (req, res) => {
  try {
    success(res, await service.getWeekly(req.user.id, req.query.startDate, req.query.endDate));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.summary = async (req, res) => {
  try {
    success(res, await service.categorySummary(req.user.id, req.query.startDate, req.query.endDate));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.balance = async (req, res) => {
  try {
    const data = await service.getRemainingBalance(req.user.id);
    success(res, data, 'Balance fetched successfully');
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.monthlySummary = async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year)
      return res.status(400).json({ message: 'Month and Year required' });

    const data = await service.getMonthlySummary(
      req.user.id,
      month,
      year
    );

    success(res, data, 'Monthly summary fetched');
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const data = await service.deleteExpense(
      req.user.id,
      req.params.id
    );
    success(res, data, 'Expense deleted successfully');
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};


exports.update = async (req, res) => {
  try {
    const data = await service.updateExpense(req.user.id, req.params.id, req.body);
    success(res, data, 'Expense updated successfully');
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.addBulkExpenses = async (req, res) => {
  const expenses = req.body;
  const results = { added: [], failed: [] };

  // Process sequentially to ensure budget is checked against the UPDATED balance after each insertion
  for (const item of expenses) {
    try {
      // service.createExpense handles:
      // 1. Month/Year extraction
      // 2. Budget Validation (Throws error if exceeded)
      // 3. DB Insertion
      const saved = await service.createExpense(req.user.id, item);
      results.added.push(saved);
    } catch (error) {
      results.failed.push({
        data: item,
        reason: error.message
      });
    }
  }

  res.json({
    success: true,
    message: `Processed ${expenses.length} items. Added: ${results.added.length}, Failed: ${results.failed.length}`,
    results
  });
};


exports.getAll = async (req, res) => {
  try {
    const expenses = await service.getAllExpenses(req.user.id, req.query.startDate, req.query.endDate);
    success(res, expenses, 'Expenses fetched successfully');
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getByMonthYear = async (req, res) => {
  try {
    const { month, year } = req.query;

    const expenses = await service.getByMonthYear(
      req.user.id,
      month,
      year
    );

    success(res, expenses, "Monthly expenses fetched");
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.yearly = async (req, res) => {
  try {
    const stats = await Expense.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.user.id) } },
      {
        $group: {
          _id: { $year: "$date" },
          totalExpense: { $sum: "$amount" }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    success(res, stats, 'Yearly expenses fetched');
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.parseSource = async (req, res) => {
  try {
    let text = req.body.text || '';

    // If an image file is uploaded, perform OCR
    if (req.file) {
      text = await parser.extractTextFromImage(req.file.buffer);
    }

    if (!text) {
      return res.status(400).json({ message: "No text or image provided" });
    }

    // Parse the text into structured data
    const expenses = parser.parseExpenseText(text);

    success(res, { expenses, rawText: text }, 'Expenses parsed successfully');
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
