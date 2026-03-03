const mongoose = require('mongoose');
const Expense = require('../models/expense.model');
const Income = require('../models/income.model');
const { extractMonthYear } = require('../utils/date.util');



// ---------------- CREATE EXPENSE ----------------
exports.createExpense = async (userId, data) => {
  const { month, year } = extractMonthYear(data.date);
  const uid = new mongoose.Types.ObjectId(userId);
  const amount = Number(data.amount);

  if (!amount || amount <= 0) {
    throw new Error('Amount must be a positive number');
  }

  // 1. Calculate Total Income for the target month
  const [incomeAgg] = await Income.aggregate([
    { $match: { userId: uid, month, year } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  const totalIncome = incomeAgg ? incomeAgg.total : 0;

  // 2. Calculate Total Expense for the target month
  const [expenseAgg] = await Expense.aggregate([
    { $match: { userId: uid, month, year } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  const totalExpense = expenseAgg ? expenseAgg.total : 0;

  // 3. Verify Budget
  const remainingBalance = totalIncome - totalExpense;

  console.log(`[Budget Check] User: ${userId} | Month: ${month}/${year}`);
  console.log(`Income: ${totalIncome} | Expense: ${totalExpense} | Balance: ${remainingBalance} | Attempting: ${amount}`);

  if (amount > remainingBalance) {
    const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' });
    throw new Error(`Low balance for ${monthName} ${year}.
    Left: ₹${remainingBalance}`);


  }

  const expense = await Expense.create({
    ...data,
    userId,
    month,
    year
  });
  return expense;
};


// ---------------- WEEKLY EXPENSE ----------------
exports.getWeekly = async (userId, startDate, endDate) => {
  const uid = new mongoose.Types.ObjectId(userId);

  let query = { userId: uid };

  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.date.$lte = end;
    }
    // If date range is provided, return all matching data (for charts)
    return Expense.find(query).sort({ date: -1 });
  }

  // Default: Last 7 days, limit 3 (for Recent Expenses list)
  return Expense.find({
    userId: uid,
    date: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
  })
    .sort({ date: -1 })   // latest first
    .limit(3);            // ✅ only 3 transactions
};



// ---------------- CATEGORY SUMMARY ----------------
exports.categorySummary = async (userId, startDate, endDate) => {
  const uid = new mongoose.Types.ObjectId(userId);

  const matchStage = { userId: uid };

  if (startDate || endDate) {
    matchStage.date = {};
    if (startDate) matchStage.date.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchStage.date.$lte = end;
    }
  }

  return Expense.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' }
      }
    }
  ]);
};


// ---------------- REMAINING BALANCE ----------------
exports.getRemainingBalance = async (userId) => {
  const uid = new mongoose.Types.ObjectId(userId);

  const [expenseAgg] = await Expense.aggregate([
    { $match: { userId: uid } },
    {
      $group: {
        _id: null,
        totalExpense: { $sum: '$amount' }
      }
    }
  ]);

  const [incomeAgg] = await Income.aggregate([
    { $match: { userId: uid } },
    {
      $group: {
        _id: null,
        totalIncome: { $sum: '$amount' }
      }
    }
  ]);

  const totalExpense = expenseAgg?.totalExpense || 0;
  const totalIncome = incomeAgg?.totalIncome || 0;
  const remaining = totalIncome - totalExpense;

  // ✅ FIXED: Rounded to 2 decimal places
  return {
    totalIncome: Number(totalIncome.toFixed(2)),
    totalExpense: Number(totalExpense.toFixed(2)),
    remainingBalance: Number(remaining.toFixed(2))
  };
};


// ---------------- MONTHLY SUMMARY ----------------
exports.getMonthlySummary = async (userId, month, year) => {
  const m = parseInt(month);
  const y = parseInt(year);
  const userObjectId = new mongoose.Types.ObjectId(userId);

  // 1. Calculate Total Expenses
  const expenseAggregation = await Expense.aggregate([
    { $match: { userId: userObjectId, month: m, year: y } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  // 2. Calculate Total Income
  const incomeAggregation = await Income.aggregate([
    { $match: { userId: userObjectId, month: m, year: y } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  // 3. Calculate Category Breakdown
  const categoryAggregation = await Expense.aggregate([
    { $match: { userId: userObjectId, month: m, year: y } },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    { $sort: { total: -1 } }
  ]);

  const totalExpense = expenseAggregation.length > 0 ? expenseAggregation[0].total : 0;
  const totalIncome = incomeAggregation.length > 0 ? incomeAggregation[0].total : 0;
  const balance = totalIncome - totalExpense;

  // ✅ FIXED: Returns clean numbers (e.g., 230.61 instead of 230.6100005)
  return {
    month: m,
    year: y,
    totalIncome: Number(totalIncome.toFixed(2)),
    totalExpense: Number(totalExpense.toFixed(2)),
    balance: Number(balance.toFixed(2)),

    categories: categoryAggregation.map(item => ({
      category: item._id,
      total: Number(item.total.toFixed(2)), // Round category totals too
      count: item.count
    }))
  };
};

// ---------------- UPDATE EXPENSE ----------------
exports.updateExpense = async (userId, expenseId, data) => {
  const { month, year } = extractMonthYear(data.date);

  const expense = await Expense.findOneAndUpdate(
    { _id: expenseId, userId },
    { ...data, month, year },
    { new: true }
  );

  if (!expense) throw new Error('Expense not found');
  return expense;
};

// ---------------- DELETE EXPENSE ----------------
exports.deleteExpense = async (userId, expenseId) => {
  const expense = await Expense.findOneAndDelete({
    _id: expenseId,
    userId
  });

  if (!expense) throw new Error('Expense not found');
  return expense;
};

// ---------------- GET ALL EXPENSES ----------------
exports.getAllExpenses = async (userId, startDate, endDate) => {
  const query = { userId };

  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.date.$lte = end;
    }
  }

  return Expense.find(query)
    .sort({ date: -1 }); // latest first
};


exports.getByMonthYear = async (userId, month, year) => {
  return Expense.find({
    userId,
    month: Number(month),
    year: Number(year)
  }).sort({ date: -1 });
};
