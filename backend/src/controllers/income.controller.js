const incomeService = require('../services/income.service');
const { success } = require('../utils/response.util');

exports.createIncome = async (req, res) => {
  try {
    const income = await incomeService.createIncome(
      req.user.id,
      req.body
    );

    success(res, income, 'Income added successfully');
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getMonthlyIncome = async (req, res) => {
  try {
    const { month, year, startDate, endDate } = req.query;
    const data = await incomeService.getIncome(
      req.user.id,
      month,
      year,
      startDate,
      endDate
    );
    success(res, data, 'Income fetched successfully');
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
