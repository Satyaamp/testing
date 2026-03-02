const Income = require('../models/income.model');
const { extractMonthYear } = require('../utils/date.util');
const { insertIncome, updateIncome, deleteIncome } = require('./sql.service');

exports.createIncome = async (userId, data) => {
  const { month, year } = extractMonthYear(data.date);
  const income = await Income.create({ ...data, userId, month, year });
  await insertIncome(income);
  return income;
};

exports.getIncome = async (userId, month, year) => {
  const query = { userId };

  if (month && year) {
    query.month = Number(month);
    query.year = Number(year);
  }

  return Income.find(query).sort({ date: -1 });
};

exports.updateIncome = async (userId, incomeId, data) => {
  const { month, year } = extractMonthYear(data.date);
  const income = await Income.findOneAndUpdate(
    { _id: incomeId, userId },
    { ...data, month, year },
    { new: true }
  );

  if (!income) throw new Error('Income not found');
  await updateIncome(income); // Sync to SQL (Safe)
  return income;
};

exports.deleteIncome = async (userId, incomeId) => {
  const income = await Income.findOneAndDelete({ _id: incomeId, userId });
  
  if (!income) throw new Error('Income not found');
  await deleteIncome(incomeId); // Sync to SQL (Safe)
  return income;
};
