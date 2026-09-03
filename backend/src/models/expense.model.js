const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  amount: { type: Number, required: true },
  category: { 
    type: String, 
    required: [true, 'Category is required'],
    trim: true
  },
  description: String,
  isOverBudget: { type: Boolean, default: false },
  month: Number,
  year: Number
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);
