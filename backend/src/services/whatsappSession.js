const User = require('../models/user.model');
const Expense = require('../models/expense.model');
const Income = require('../models/income.model');
const whatsappService = require('./whatsapp.service');

// A simple in-memory cache for pending confirmations
// Key: phone number, Value: { type: 'expense'|'income', data: {...} }
const pendingConfirmations = new Map();

exports.processMessage = async (from, messageBody) => {
    if (!messageBody) return;

    // 1. Find the User by phone number
    const user = await User.findOne({ phoneNumber: from });
    if (!user) {
        return whatsappService.sendTextMessage(from, "Your phone number is not registered. Please add it to your profile on the DhanRekha website.");
    }

    const text = messageBody.trim().toLowerCase();

    // 2. Check for Pending Confirmations
    if (pendingConfirmations.has(from)) {
        if (text === 'yes' || text === 'confirm' || text === 'confirm_expense' || text === 'confirm_income') {
            const pending = pendingConfirmations.get(from);

            try {
                if (pending.type === 'expense') {
                    const newExpense = new Expense(pending.data);
                    await newExpense.save();
                    whatsappService.sendTextMessage(from, "✅ Expense added successfully!");
                } else if (pending.type === 'income') {
                    const newIncome = new Income(pending.data);
                    await newIncome.save();
                    whatsappService.sendTextMessage(from, "✅ Income added successfully!");
                }
            } catch (err) {
                whatsappService.sendTextMessage(from, "❌ Failed to save record. " + err.message);
            }
            pendingConfirmations.delete(from);
            return;
        } else if (text === 'no' || text === 'cancel' || text === 'cancel_action') {
            pendingConfirmations.delete(from);
            return whatsappService.sendTextMessage(from, "❌ Action cancelled.");
        }
    }

    // 3. Parse Commands

    // Command: "expenses [optional date]"
    if (text.startsWith('expenses')) {
        const parts = text.split(/\s+/);
        let query = { user: user._id };
        let replyText = "";

        if (parts.length > 1) {
            // Specific Date (YYYY-MM-DD)
            const dateStr = parts[1];
            const startOfDay = new Date(dateStr);
            startOfDay.setUTCHours(0, 0, 0, 0);
            const endOfDay = new Date(dateStr);
            endOfDay.setUTCHours(23, 59, 59, 999);

            query.date = { $gte: startOfDay, $lte: endOfDay };
            replyText = `📊 Expenses for ${dateStr}:\n`;
        } else {
            // Current month until today
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            query.date = { $gte: startOfMonth, $lte: now };
            replyText = `📊 Current Month Expenses:\n`;
        }

        const expenses = await Expense.find(query).sort({ date: 1 });
        if (expenses.length === 0) {
            return whatsappService.sendTextMessage(from, replyText + "No expenses found.");
        }

        let total = 0;
        expenses.forEach(e => {
            const d = new Date(e.date).toLocaleDateString();
            replyText += `${d} | ₹${e.amount} | ${e.category} | ${e.description}\n`;
            total += e.amount;
        });
        replyText += `\nTotal: ₹${total}`;
        return whatsappService.sendTextMessage(from, replyText);
    }

    // Command: "monthly snapshot" or "march 2026"
    const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december", "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const textParts = text.split(/\s+/);
    if (textParts.length === 2 && months.includes(textParts[0]) && !isNaN(textParts[1])) {
        let monthIndex = months.indexOf(textParts[0]);
        if (monthIndex > 11) monthIndex -= 12; // handle 3 letter abbreviations

        const year = parseInt(textParts[1]);
        const startOfMonth = new Date(year, monthIndex, 1);
        const endOfMonth = new Date(year, monthIndex + 1, 0, 23, 59, 59);

        const incomeAggr = await Income.aggregate([
            { $match: { user: user._id, date: { $gte: startOfMonth, $lte: endOfMonth } } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);

        const expenseAggr = await Expense.aggregate([
            { $match: { user: user._id, date: { $gte: startOfMonth, $lte: endOfMonth } } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);

        const totalIncome = incomeAggr.length > 0 ? incomeAggr[0].total : 0;
        const totalExpense = expenseAggr.length > 0 ? expenseAggr[0].total : 0;
        const balance = totalIncome - totalExpense;

        const reply = `🗓️ Snapshot for ${textParts[0].toUpperCase()} ${year}\n` +
            `Income: ₹${totalIncome}\n` +
            `Expenses: ₹${totalExpense}\n` +
            `Balance: ₹${balance}`;
        return whatsappService.sendTextMessage(from, reply);
    }

    // Command: Add Income
    // amount
    // description
    const lines = messageBody.split('\n').map(l => l.trim()).filter(l => l);

    if (lines.length === 2 && !isNaN(lines[0])) {
        const amount = parseFloat(lines[0]);
        const desc = lines[1] || "Add from whatsapp";

        pendingConfirmations.set(from, {
            type: 'income',
            data: {
                user: user._id,
                amount: amount,
                source: desc,
                date: new Date()
            }
        });

        const confirmText = `Add Income?\nAmount: ₹${amount}\nDesc: ${desc}`;
        return whatsappService.sendInteractiveButtons(from, confirmText, [
            { id: 'confirm_income', title: 'Confirm' },
            { id: 'cancel_action', title: 'Cancel' }
        ]);
    }

    // Command: Add Expense
    // amount
    // category
    // description
    if ((lines.length === 3 || lines.length === 2) && !isNaN(lines[0])) {
        const amount = parseFloat(lines[0]);
        let category = lines[1].charAt(0).toUpperCase() + lines[1].slice(1).toLowerCase();
        const desc = lines.length === 3 ? lines[2] : "Add from whatsapp";

        pendingConfirmations.set(from, {
            type: 'expense',
            data: {
                user: user._id,
                amount: amount,
                category: category,
                description: desc,
                date: new Date()
            }
        });

        const confirmText = `Add Expense?\nDate: Today\nAmount: ₹${amount}\nCategory: ${category}\nDesc: ${desc}`;
        return whatsappService.sendInteractiveButtons(from, confirmText, [
            { id: 'confirm_expense', title: 'Confirm' },
            { id: 'cancel_action', title: 'Cancel' }
        ]);
    }

    // Default Fallback
    whatsappService.sendTextMessage(from,
        "🤖 I didn't understand that. Try sending an expense format:\n\n" +
        "100\nFood\nLunch\n\n" +
        "Or checking expenses:\n" +
        "- `expenses`\n" +
        "- `expenses 2026-03-15`\n" +
        "- `march 2026`"
    );
};
