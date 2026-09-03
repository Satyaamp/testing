const express = require('express');
const cors = require('cors');
const path = require('path');

const Expense = require('./models/expense.model');
const app = express();

app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "../../frontend")));



app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'DhanRekha API' });
});

// Fetch Categories dynamically (Backward-compatible fallback & User-aware)
const categoryService = require('./services/category.service');
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      req.user = decoded;
    }
  } catch (e) { /* ignore error for optional auth */ }
  next();
};

app.get('/api/expenses/categories', optionalAuth, async (req, res) => {
  try {
    if (req.user && (req.user.id || req.user._id)) {
      const names = await categoryService.getUserCategoryNames(req.user.id || req.user._id);
      return res.status(200).json({ data: names });
    }
    const defaultCategories = require('./models/category.model').DEFAULT_SYSTEM_CATEGORIES.map(c => c.name);
    res.status(200).json({ data: defaultCategories });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/categories', require('./routes/category.routes'));
app.use('/api/expenses', require('./routes/expense.routes'));
app.use('/api/income', require('./routes/income.routes'));
app.use('/api/whatsapp', require('./routes/whatsapp.routes'));
app.use('/api', require('./routes/password.routes'));

app.use(require('./middleware/error.middleware'));

module.exports = app;