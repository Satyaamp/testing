const mongoose = require('mongoose');
const Expense = require('../models/expense.model');
const Income = require('../models/income.model');
const { extractMonthYear } = require('../utils/date.util');



// ---------------- CREATE EXPENSE ----------------
exports.createExpense = async (userId, data) => {
  const { month, year } = extractMonthYear(data.date);
  const uid = new mongoose.Types.ObjectId(userId);
  const amount = Number(Number(data.amount).toFixed(2));

  if (!amount || amount <= 0) {
    throw new Error('Amount must be a positive number');
  }

  // 1. Calculate Total Income for the target month
  const [incomeAgg] = await Income.aggregate([
    { $match: { userId: uid, month, year } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  const totalIncome = Number((incomeAgg?.total || 0).toFixed(2));

  // 2. Calculate Total Expense for the target month
  const [expenseAgg] = await Expense.aggregate([
    { $match: { userId: uid, month, year } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  const totalExpense = Number((expenseAgg?.total || 0).toFixed(2));

  // 3. Verify Budget (Round to 2 decimal places to prevent floating point precision errors)
  const remainingBalance = Number((totalIncome - totalExpense).toFixed(2));
  const isOverBudget = amount > remainingBalance;
  const overBudgetAmount = isOverBudget ? Number((amount - remainingBalance).toFixed(2)) : 0;

  console.log(`[Budget Check] User: ${userId} | Month: ${month}/${year}`);
  console.log(`Income: ${totalIncome} | Expense: ${totalExpense} | Balance: ${remainingBalance} | Attempting: ${amount} | OverBudget: ${isOverBudget}`);

  const expense = await Expense.create({
    ...data,
    amount,
    isOverBudget,
    userId,
    month,
    year
  });

  const expenseObj = expense.toObject();
  expenseObj.isOverBudget = isOverBudget;
  expenseObj.overBudgetAmount = overBudgetAmount;
  return expenseObj;
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
    return Expense.find(query).sort({ date: -1, _id: -1 });
  }

  // Default: Last 7 days, limit 3 (for Recent Expenses list)
  return Expense.find({
    userId: uid,
    date: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
  })
    .sort({ date: -1, _id: -1 })   // latest first
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


// ---------------- HIERARCHY BREAKDOWN (YEARS & MONTHS) ----------------
exports.getHierarchyBreakdown = async (userId) => {
  const uid = new mongoose.Types.ObjectId(userId);

  const [incomeAgg, expenseAgg] = await Promise.all([
    Income.aggregate([
      { $match: { userId: uid } },
      {
        $group: {
          _id: { year: "$year", month: "$month" },
          totalIncome: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      }
    ]),
    Expense.aggregate([
      { $match: { userId: uid } },
      {
        $group: {
          _id: { year: "$year", month: "$month" },
          totalExpense: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const yearMap = {};

  const ensureYearMonth = (year, month) => {
    if (!year) return null;
    if (!yearMap[year]) {
      yearMap[year] = {
        year: Number(year),
        totalIncome: 0,
        totalExpense: 0,
        balance: 0,
        incomeCount: 0,
        expenseCount: 0,
        months: {}
      };
    }
    if (month && !yearMap[year].months[month]) {
      yearMap[year].months[month] = {
        month: Number(month),
        name: monthNames[month - 1] || `Month ${month}`,
        income: 0,
        expense: 0,
        balance: 0,
        incomeCount: 0,
        expenseCount: 0
      };
    }
    return yearMap[year];
  };

  for (const item of incomeAgg) {
    const y = item._id.year;
    const m = item._id.month;
    if (y) {
      const yearObj = ensureYearMonth(y, m);
      const inc = Number(item.totalIncome.toFixed(2));
      yearObj.totalIncome = Number((yearObj.totalIncome + inc).toFixed(2));
      yearObj.incomeCount += item.count;
      if (m && yearObj.months[m]) {
        yearObj.months[m].income = inc;
        yearObj.months[m].incomeCount = item.count;
      }
    }
  }

  for (const item of expenseAgg) {
    const y = item._id.year;
    const m = item._id.month;
    if (y) {
      const yearObj = ensureYearMonth(y, m);
      const exp = Number(item.totalExpense.toFixed(2));
      yearObj.totalExpense = Number((yearObj.totalExpense + exp).toFixed(2));
      yearObj.expenseCount += item.count;
      if (m && yearObj.months[m]) {
        yearObj.months[m].expense = exp;
        yearObj.months[m].expenseCount = item.count;
      }
    }
  }

  const result = Object.values(yearMap).map(y => {
    y.balance = Number((y.totalIncome - y.totalExpense).toFixed(2));
    y.months = Object.values(y.months)
      .map(m => {
        m.balance = Number((m.income - m.expense).toFixed(2));
        return m;
      })
      .sort((a, b) => b.month - a.month);
    return y;
  }).sort((a, b) => b.year - a.year);

  return result;
};


// ---------------- PAGINATED TRANSACTIONS LIST ----------------
exports.getPaginatedTransactions = async (userId, query = {}) => {
  const uid = new mongoose.Types.ObjectId(userId);
  const {
    year,
    month,
    page = 1,
    limit = 10,
    type = 'all',
    search = '',
    category = '',
    date = '',
    minAmount = null,
    maxAmount = null,
    status = 'all',
    sortBy = 'date',
    sortOrder = 'desc'
  } = query;

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.max(1, parseInt(limit) || 10);

  const expMatch = { userId: uid };
  const incMatch = { userId: uid };

  if (year) {
    expMatch.year = parseInt(year);
    incMatch.year = parseInt(year);
  }
  if (month) {
    expMatch.month = parseInt(month);
    incMatch.month = parseInt(month);
  }

  // 1. Fetch Month KPIs (unfiltered by text/type, for overall banner)
  const [allMonthExp, allMonthInc] = await Promise.all([
    Expense.find(expMatch, 'amount category isOverBudget').lean(),
    Income.find(incMatch, 'amount source').lean()
  ]);

  const monthExpense = allMonthExp.reduce((s, e) => s + (e.amount || 0), 0);
  const monthIncome = allMonthInc.reduce((s, i) => s + (i.amount || 0), 0);
  const totalMonthCount = allMonthExp.length + allMonthInc.length;

  // Extract all expense categories for dynamic filter (NO Income in categories)
  const distinctCategories = [...new Set(allMonthExp.map(e => e.category).filter(Boolean))].sort();

  // 2. Apply Filters
  if (date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    expMatch.date = { $gte: dayStart, $lte: dayEnd };
    incMatch.date = { $gte: dayStart, $lte: dayEnd };
  }

  if (minAmount || maxAmount) {
    const amtFilter = {};
    if (minAmount) amtFilter.$gte = parseFloat(minAmount);
    if (maxAmount) amtFilter.$lte = parseFloat(maxAmount);
    expMatch.amount = amtFilter;
    incMatch.amount = amtFilter;
  }

  if (category) {
    expMatch.category = new RegExp(`^${category.trim()}$`, 'i');
    incMatch._id = null; // Incomes do not have an expense category
  }

  if (search) {
    const regex = new RegExp(search.trim(), 'i');
    expMatch.$or = [{ category: regex }, { description: regex }];
    incMatch.$or = [{ source: regex }];
  }

  if (status === 'overBudget') {
    expMatch.isOverBudget = true;
    incMatch._id = null; // Incomes can't be over-budget
  } else if (status === 'normal') {
    expMatch.isOverBudget = { $ne: true };
  }

  // 3. Query based on type
  let fetchedExpenses = [];
  let fetchedIncomes = [];

  if (type === 'all' || type === 'expense') {
    fetchedExpenses = await Expense.find(expMatch).sort({ date: -1, _id: -1 }).lean();
  }
  if (type === 'all' || type === 'income') {
    if (status !== 'overBudget' && incMatch._id !== null) {
      fetchedIncomes = await Income.find(incMatch).sort({ date: -1, _id: -1 }).lean();
    }
  }

  // Format and merge
  const unified = [
    ...fetchedExpenses.map(e => ({
      _id: e._id,
      createdAt: e.createdAt,
      type: 'expense',
      category: e.category,
      amount: e.amount,
      date: e.date,
      description: e.description || '-',
      isOverBudget: !!e.isOverBudget,
      year: e.year,
      month: e.month
    })),
    ...fetchedIncomes.map(i => ({
      _id: i._id,
      createdAt: i.createdAt,
      type: 'income',
      category: '-',
      source: i.source || 'Income',
      amount: i.amount,
      date: i.date,
      description: i.source || 'Income',
      isOverBudget: false,
      year: i.year,
      month: i.month
    }))
  ];

  // 4. Sort (by date, tie-breaking by exact creation datetime)
  unified.sort((a, b) => {
    if (sortBy === 'amount') {
      return sortOrder === 'asc' ? a.amount - b.amount : b.amount - a.amount;
    }
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    if (dateA !== dateB) {
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    }
    // Tie-breaker: sort by creation datetime / ObjectId timestamp (LIFO)
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a._id ? parseInt(String(a._id).substring(0, 8), 16) * 1000 : 0);
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b._id ? parseInt(String(b._id).substring(0, 8), 16) * 1000 : 0);
    return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
  });

  // 5. Paginate
  const total = unified.length;
  const totalPages = Math.ceil(total / limitNum) || 1;
  const startIndex = (pageNum - 1) * limitNum;
  const paginated = unified.slice(startIndex, startIndex + limitNum);

  return {
    transactions: paginated,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1
    },
    kpis: {
      totalIncome: Number(monthIncome.toFixed(2)),
      totalExpense: Number(monthExpense.toFixed(2)),
      balance: Number((monthIncome - monthExpense).toFixed(2)),
      totalTransactions: totalMonthCount
    },
    categories: distinctCategories
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
    .sort({ date: -1, _id: -1 }); // latest first

};


exports.getByMonthYear = async (userId, month, year) => {
  return Expense.find({
    userId,
    month: Number(month),
    year: Number(year)
  }).sort({ date: -1, _id: -1 });
};
