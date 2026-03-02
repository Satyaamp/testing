const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  amount: { type: Number, required: true },
  category: { 
    type: String, 
    enum: [
      'Food', 
      'Transport', 
      'Groceries', 
      'Rent', 
      'Stationery', 
      'Personal Care',
      'Electric Bill',  
      'Water Bill',  
      'Cylinder',  
      'Internet Bill',  
      'EMI',            
      'Carry Forward',      
      'Other'
    ],
    required: true 
  },
  description: String,
  month: Number,
  year: Number
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);
