const User = require('../models/user.model');
const Expense = require('../models/expense.model');
const Income = require('../models/income.model');
const whatsappService = require('./whatsapp.service');

// ==========================================
// STATE MANAGEMENT
// ==========================================
const pendingConfirmations = new Map();

// ==========================================
// HELPER FUNCTIONS
// ==========================================

const calculateBalance = async (userId) => {
    const incomeAggr = await Income.aggregate([
        { $match: { userId: userId } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const expenseAggr = await Expense.aggregate([
        { $match: { userId: userId } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const totalIncome = incomeAggr[0]?.total || 0;
    const totalExpense = expenseAggr[0]?.total || 0;
    return totalIncome - totalExpense;
};

const sendGreeting = (from, userName) => {
    const text = `👋 Hello ${userName}!\n\n` +
        `💼 *Dhan₹ekha Assistant*\n` +
        `_Where Your Money Tells a Story_\n\n` +
        `Track income, control expenses, and understand your spending.\n\n` +
        `Choose an option (send the text):\n\n` +
        `➕ Add Expense (Format: Amount \\n Category \\n Desc)\n` +
        `💰 Add Income (Format: Amount \\n Source)\n` +
        `📊 Monthly Snapshot (Format: march 2026)\n` +
        `📋 View Expenses (Format: expenses)\n` +
        `❓ Help (Format: menu)`;

    return whatsappService.sendTextMessage(from, text);
};

// ==========================================
// FLOW CONTROLLERS
// ==========================================

const handleExpenseFlow = async (from, user, lines) => {
    const amount = parseFloat(lines[0]);
    let category = lines[1].charAt(0).toUpperCase() + lines[1].slice(1).toLowerCase();
    const desc = lines.length === 3 ? lines[2] : "Add from whatsapp";

    // Validate Purse Balance
    const currentBalance = await calculateBalance(user._id);
    if (amount > currentBalance) {
        return whatsappService.sendTextMessage(
            from,
            `⚠️ *Insufficient Balance!*\n\n` +
            `You are trying to add an expense of ₹${amount.toLocaleString('en-IN')}, ` +
            `but your current purse balance is only ₹${currentBalance.toLocaleString('en-IN')}.`
        );
    }

    pendingConfirmations.set(from, {
        type: 'expense',
        data: {
            userId: user._id,
            amount: amount,
            category: category,
            description: desc,
            date: new Date(),
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear()
        }
    });

    const confirmText = `📌 *Expense Preview*\n\n` +
        `💸 Amount: ₹${amount.toLocaleString('en-IN')}\n` +
        `📂 Category: ${category}\n` +
        `📝 Description: ${desc}\n\n` +
        `Confirm to record this expense.`;

    return whatsappService.sendInteractiveButtons(from, confirmText, [
        { id: 'confirm_expense', title: 'Confirm' },
        { id: 'cancel_action', title: 'Cancel' }
    ]);
};

const handleIncomeFlow = async (from, user, lines) => {
    const amount = parseFloat(lines[0]);
    const desc = lines[1] || "Add from whatsapp";

    pendingConfirmations.set(from, {
        type: 'income',
        data: {
            userId: user._id,
            amount: amount,
            source: desc,
            date: new Date()
        }
    });

    const confirmText = `📌 *Income Preview*\n\n` +
        `💰 Amount: ₹${amount.toLocaleString('en-IN')}\n` +
        `📂 Source: ${desc}\n\n` +
        `Confirm to record this income.`;

    return whatsappService.sendInteractiveButtons(from, confirmText, [
        { id: 'confirm_income', title: 'Confirm' },
        { id: 'cancel_action', title: 'Cancel' }
    ]);
};

const getExpensesList = async (from, user, text) => {
    const parts = text.split(/\s+/);
    let query = { userId: user._id };
    let replyText = "";

    if (parts.length > 1) {
        // Specific Date
        const dateStr = parts[1];
        const startOfDay = new Date(dateStr);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(dateStr);
        endOfDay.setUTCHours(23, 59, 59, 999);

        query.date = { $gte: startOfDay, $lte: endOfDay };
        replyText = `📊 *Expenses for ${dateStr}*\n\n`;
    } else {
        // Current month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        query.date = { $gte: startOfMonth, $lte: now };
        replyText = `📊 *${now.toLocaleString('default', { month: 'long' })} Expenses*\n\n`;
    }

    const expenses = await Expense.find(query).sort({ date: 1 });

    if (expenses.length === 0) {
        return whatsappService.sendTextMessage(from, replyText + "No expenses found.");
    }

    let total = 0;

    // Group by date
    const grouped = {};
    expenses.forEach(e => {
        const d = new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        if (!grouped[d]) grouped[d] = [];
        grouped[d].push(e);
        total += e.amount;
    });

    for (const [date, items] of Object.entries(grouped)) {
        replyText += `📅 *${date}*\n`;
        items.forEach(item => {
            replyText += `${item.category} — ₹${item.amount.toLocaleString('en-IN')}\n`;
        });
        replyText += `\n`;
    }

    replyText += `*Total: ₹${total.toLocaleString('en-IN')}*`;

    return whatsappService.sendTextMessage(from, replyText);
};

const getMonthlySnapshot = async (from, user, textParts) => {
    const parsedDate = new Date(`${textParts[0]} 1, ${textParts[1]}`);
    if (isNaN(parsedDate)) return false;

    const year = parsedDate.getFullYear();
    const monthIndex = parsedDate.getMonth();
    const startOfMonth = new Date(year, monthIndex, 1);
    const endOfMonth = new Date(year, monthIndex + 1, 0, 23, 59, 59);

    const incomeAggr = await Income.aggregate([
        { $match: { userId: user._id, date: { $gte: startOfMonth, $lte: endOfMonth } } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const expenseAggr = await Expense.aggregate([
        { $match: { userId: user._id, date: { $gte: startOfMonth, $lte: endOfMonth } } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const totalIncome = incomeAggr[0]?.total || 0;
    const totalExpense = expenseAggr[0]?.total || 0;
    const balance = totalIncome - totalExpense;

    const reply = `📊 *Snapshot for ${parsedDate.toLocaleString('default', { month: 'long' }).toUpperCase()} ${year}*\n\n` +
        `💰 Income: ₹${totalIncome.toLocaleString('en-IN')}\n` +
        `💸 Expenses: ₹${totalExpense.toLocaleString('en-IN')}\n` +
        `📈 Balance: ₹${balance.toLocaleString('en-IN')}`;

    await whatsappService.sendTextMessage(from, reply);
    return true;
};

// ==========================================
// MAIN MESSAGE ROUTER
// ==========================================

exports.processMessage = async (from, messageBody) => {
    if (!messageBody) return;

    // 1. Identify User
    const user = await User.findOne({
        $or: [{ phoneNumber: from }, { phoneNumber: `+${from}` }]
    });

    if (!user) {
        return whatsappService.sendTextMessage(
            from,
            "Your phone number is not registered. Please add it to your profile on the DhanRekha website."
        );
    }

    const text = messageBody.trim().toLowerCase();

    // 2. Process Pending Confirmations (Interactive Buttons / Text Replies)
    if (pendingConfirmations.has(from)) {
        if (text === 'yes' || text === 'confirm' || text === 'confirm_expense' || text === 'confirm_income') {
            const pending = pendingConfirmations.get(from);
            try {
                if (pending.type === 'expense') {
                    const newExpense = new Expense(pending.data);
                    await newExpense.save();
                    const remaining = await calculateBalance(user._id);
                    await whatsappService.sendTextMessage(from, `✅ Expense recorded successfully!\n\n💼 Remaining purse: ₹${remaining.toLocaleString('en-IN')}`);
                } else if (pending.type === 'income') {
                    const newIncome = new Income(pending.data);
                    await newIncome.save();
                    const current = await calculateBalance(user._id);
                    await whatsappService.sendTextMessage(from, `✅ Income added successfully!\n\n💼 Current purse: ₹${current.toLocaleString('en-IN')}`);
                }
            } catch (err) {
                console.error("SAVE ERROR:", err);
                await whatsappService.sendTextMessage(from, "❌ Failed to save record. Please try again.");
            }
            pendingConfirmations.delete(from);
            return;
        }

        if (text === 'no' || text === 'cancel' || text === 'cancel_action') {
            pendingConfirmations.delete(from);
            return whatsappService.sendTextMessage(from, "❌ Action cancelled.");
        }
    }

    // 3. Routing Commands

    // Greeting / Menu
    const greetings = ['hi', 'hello', 'menu', 'start', 'help'];
    if (greetings.includes(text)) {
        return sendGreeting(from, user.name);
    }

    // Show Expenses
    if (text.startsWith('expenses')) {
        return getExpensesList(from, user, text);
    }

    // Monthly Snapshot
    const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december", "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const textParts = text.split(/\s+/);
    if (textParts.length === 2 && months.includes(textParts[0]) && !isNaN(textParts[1])) {
        const handled = await getMonthlySnapshot(from, user, textParts);
        if (handled) return;
    }

    // Multi-line Inputs (Add Income / Add Expense)
    const lines = messageBody.split('\n').map(l => l.trim()).filter(l => l);

    // Add Income Format
    if (lines.length === 2 && !isNaN(lines[0])) {
        return handleIncomeFlow(from, user, lines);
    }

    // Add Expense Format
    if ((lines.length === 3 || lines.length === 2) && !isNaN(lines[0])) {
        return handleExpenseFlow(from, user, lines);
    }

    // Fallback -> Show Menu
    return sendGreeting(from, user.name);
};