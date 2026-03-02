const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const protect = require('../middleware/auth.middleware');
const limiter = require('../middleware/rateLimiter.middleware');
const User = require('../models/user.model');
const archiver = require('archiver'); // npm install archiver
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

router.post('/register', limiter, ctrl.register);
router.post('/login', limiter, ctrl.login);
router.get('/me',protect , ctrl.me);

// POST /google - Google Login
router.post('/google', async (req, res) => {
  try {
    const { token } = req.body;
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const { name, email, picture } = ticket.getPayload();

    let user = await User.findOne({ email });

    if (!user) {
      // Create new user with random password
      const randomPassword = Math.random().toString(36).slice(-8) + "1Aa!"; 
      user = await User.create({
        name,
        email,
        password: randomPassword,
        avatar: picture
      });
    }

    const jwtToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.status(200).json({ token: jwtToken, message: "Login successful" });
  } catch (err) {
    console.error("Google Login Error:", err);
    res.status(400).json({ message: 'Google login failed' });
  }
});

// GET /export - Download all user data (Expenses & Income)
router.get("/export", protect, async (req, res) => {
  try {
    console.log("📥 Export data request received for user:", req.user.id);
    const Expense = require('../models/expense.model');
    // Try requiring Income model if it exists
    let Income;
    try { Income = require('../models/income.model'); } catch(e) {}

    const expenses = await Expense.find({ userId: req.user.id });
    const incomes = Income ? await Income.find({ userId: req.user.id }) : [];

    res.attachment(`dhanrekha_backup_${new Date().toISOString().split('T')[0]}.zip`);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => { throw err; });
    archive.pipe(res);

    archive.append(JSON.stringify(expenses, null, 2), { name: 'expenses.json' });
    archive.append(JSON.stringify(incomes, null, 2), { name: 'incomes.json' });

    await archive.finalize();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ message: err.message });
  }
});

// POST /import - Import user data
router.post("/import", protect, async (req, res) => {
  try {
    const { expenses, incomes } = req.body;
    const Expense = require('../models/expense.model');
    // Try requiring Income model if it exists
    let Income;
    try { Income = require('../models/income.model'); } catch(e) {}

    let count = 0;

    // Import Expenses
    if (expenses && Array.isArray(expenses)) {
      const cleanExpenses = expenses.map(e => {
        // Remove _id and other system fields to avoid conflicts, assign to current user
        const { _id, createdAt, updatedAt, __v, ...rest } = e;
        return { ...rest, userId: req.user.id };
      });
      if (cleanExpenses.length > 0) {
        await Expense.insertMany(cleanExpenses);
        count += cleanExpenses.length;
      }
    }

    // You can add logic for Incomes here similarly if needed

    res.json({ message: `Successfully imported ${count} items` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /me - Delete logged in user and their data
router.delete("/me", protect, async (req, res) => {
  try {
    console.log("🗑️ DELETE /auth/me request received for user:", req.user.id);
    await User.findByIdAndDelete(req.user.id);
    
    // Cleanup associated data
    const Expense = require('../models/expense.model'); 
    await Expense.deleteMany({ userId: req.user.id });
    // const Income = require('../models/income.model');
    // await Income.deleteMany({ userId: req.user.id });

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


module.exports = router;
