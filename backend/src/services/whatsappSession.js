const User = require('../models/user.model');
const Expense = require('../models/expense.model');
const Income = require('../models/income.model');
const whatsappService = require('./whatsapp.service');

// ==========================================
// STATE MANAGEMENT & CONSTANTS
// ==========================================

// State Machine Cache
// Key: phone number 
// Value: { step: string, data: object, type: 'expense'|'income'|'none' }
const userSessions = new Map();

const EXPENSE_CATEGORIES = [
    'Food', 'Transport', 'Groceries', 'Rent', 'Stationery',
    'Personal Care', 'Electric Bill', 'Water Bill', 'Cylinder',
    'Internet Bill', 'EMI', 'Other'
];

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
    // Reset any stuck sessions when they ask for the menu
    userSessions.delete(from);

    const text = `👋 Hello ${userName}!\n\n` +
        `💼 *Dhan₹ekha*\n` +
        `_Where Your Money Tells a Story_\n\n` +
        `Track income, control expenses, and understand your spending.\n\n` +
        `*Reply with a number to begin:*\n\n` +
        `1️⃣ Add Expense\n` +
        `2️⃣ Add Income\n` +
        `3️⃣ Monthly Snapshot\n` +
        `4️⃣ View Expenses List\n\n` +
        `Send *0* at anytime to cancel.`;

    return whatsappService.sendTextMessage(from, text);
};

// ==========================================
// REPORT VIEWERS (OPTIONS 3 & 4)
// ==========================================

const getExpensesList = async (from, user) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const expenses = await Expense.find({
        userId: user._id,
        date: { $gte: startOfMonth, $lte: now }
    }).sort({ date: 1 });

    let replyText = `📊 *${now.toLocaleString('default', { month: 'long' })} Expenses*\n\n`;

    if (expenses.length === 0) {
        return whatsappService.sendTextMessage(from, replyText + "No expenses found this month.");
    }

    let total = 0;
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
            replyText += `${item.category} — ₹${item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
        });
        replyText += `\n`;
    }

    replyText += `*Total: ₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*\n\n_Reply 0 to return to Menu._`;
    return whatsappService.sendTextMessage(from, replyText);
};

const getMonthlySnapshot = async (from, user) => {
    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = now.getMonth();
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

    const reply = `📊 *Snapshot for ${now.toLocaleString('default', { month: 'long' }).toUpperCase()} ${year}*\n\n` +
        `💰 Income: ₹${totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
        `💸 Expenses: ₹${totalExpense.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
        `📈 Balance: ₹${balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n` +
        `_Reply 0 to return to Menu._`;

    return whatsappService.sendTextMessage(from, reply);
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

    // 2. Global Cancel / Menu triggers
    const greetings = ['hi', 'hello', 'menu', 'start', 'help', '0'];
    if (greetings.includes(text)) {
        return sendGreeting(from, user.name);
    }

    // 3. Process Active State Machine Sessions
    if (userSessions.has(from)) {
        const session = userSessions.get(from);

        // --- EXPENSE FLOW ---
        if (session.type === 'expense') {

            // Step 1 -> Waiting for Amount
            if (session.step === 'awaiting_amount') {
                const amount = parseFloat(text);
                if (isNaN(amount) || amount <= 0) {
                    return whatsappService.sendTextMessage(from, "❌ Invalid amount. Reply with a valid number (e.g. 500), or send 0 to cancel.");
                }

                // Balance Validation
                const currentBalance = await calculateBalance(user._id);
                if (amount > currentBalance) {
                    userSessions.delete(from); // Kill session
                    return whatsappService.sendTextMessage(
                        from,
                        `⚠️ *Insufficient Balance!*\n\n` +
                        `You are trying to add an expense of ₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, ` +
                        `but your current purse balance is only ₹${currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.\n\n` +
                        `_Reply 'menu' to start over._`
                    );
                }

                session.data.amount = amount;
                session.step = 'awaiting_category';
                userSessions.set(from, session); // Update session

                let categoryList = `💸 Amount: ₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n*Reply with a category number:*\n\n`;
                EXPENSE_CATEGORIES.forEach((cat, index) => {
                    categoryList += `${index + 1}. ${cat}\n`;
                });
                return whatsappService.sendTextMessage(from, categoryList);
            }

            // Step 2 -> Waiting for Category
            if (session.step === 'awaiting_category') {
                const catIndex = parseInt(text) - 1;
                if (isNaN(catIndex) || catIndex < 0 || catIndex >= EXPENSE_CATEGORIES.length) {
                    return whatsappService.sendTextMessage(from, "❌ Invalid choice. Please reply with the number corresponding to the category.");
                }

                session.data.category = EXPENSE_CATEGORIES[catIndex];
                session.step = 'awaiting_desc';
                userSessions.set(from, session);

                return whatsappService.sendTextMessage(
                    from,
                    `📂 Category: ${session.data.category}\n\n*Please reply with a short description* (e.g. "Lunch with friends"):`
                );
            }

            // Step 3 -> Waiting for Description
            if (session.step === 'awaiting_desc') {
                session.data.description = messageBody.trim();
                session.step = 'awaiting_confirmation';
                userSessions.set(from, session);

                const confirmText = `📌 *Expense Preview*\n\n` +
                    `💸 Amount: ₹${session.data.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
                    `📂 Category: ${session.data.category}\n` +
                    `📝 Description: ${session.data.description}\n\n` +
                    `*Confirm this expense?*`;

                return whatsappService.sendInteractiveButtons(from, confirmText, [
                    { id: 'confirm_expense', title: 'Confirm' },
                    { id: 'cancel_action', title: 'Cancel' }
                ]);
            }

            // Step 4 -> Confirmation Button Handled below in Global Button handlers
        }

        // --- INCOME FLOW ---
        if (session.type === 'income') {
            // Step 1 -> Waiting for Amount
            if (session.step === 'awaiting_amount') {
                const amount = parseFloat(text);
                if (isNaN(amount) || amount <= 0) {
                    return whatsappService.sendTextMessage(from, "❌ Invalid amount. Reply with a valid number (e.g. 5000), or send 0 to cancel.");
                }

                session.data.amount = amount;
                session.step = 'awaiting_source';
                userSessions.set(from, session); // Update session

                return whatsappService.sendTextMessage(
                    from,
                    `💰 Amount: ₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n*Please reply with the Income Source* (e.g. "Salary", "Freelance"):`
                );
            }

            // Step 2 -> Waiting for Source Description
            if (session.step === 'awaiting_source') {
                session.data.source = messageBody.trim();
                session.step = 'awaiting_confirmation';
                userSessions.set(from, session);

                const confirmText = `📌 *Income Preview*\n\n` +
                    `💰 Amount: ₹${session.data.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
                    `📂 Source: ${session.data.source}\n\n` +
                    `*Confirm this income?*`;

                return whatsappService.sendInteractiveButtons(from, confirmText, [
                    { id: 'confirm_income', title: 'Confirm' },
                    { id: 'cancel_action', title: 'Cancel' }
                ]);
            }
        }

        // --- GLOBAL BUTTON CONFIRMATIONS ---
        if (session.step === 'awaiting_confirmation') {
            if (text === 'yes' || text === 'confirm' || text === 'confirm_expense' || text === 'confirm_income') {
                try {
                    if (session.type === 'expense') {
                        const newExpense = new Expense({
                            ...session.data,
                            userId: user._id,
                            date: new Date(),
                            month: new Date().getMonth() + 1,
                            year: new Date().getFullYear()
                        });
                        await newExpense.save();
                        const remaining = await calculateBalance(user._id);
                        await whatsappService.sendTextMessage(from, `✅ Expense recorded successfully!\n\n💼 Remaining purse: ₹${remaining.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                    } else if (session.type === 'income') {
                        const newIncome = new Income({
                            ...session.data,
                            userId: user._id,
                            date: new Date()
                        });
                        await newIncome.save();
                        const current = await calculateBalance(user._id);
                        await whatsappService.sendTextMessage(from, `✅ Income added successfully!\n\n💼 Current purse: ₹${current.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                    }
                } catch (err) {
                    console.error("SAVE ERROR:", err);
                    await whatsappService.sendTextMessage(from, "❌ Failed to save record. Reply 'menu' to try again.");
                }
                userSessions.delete(from); // Clear session
                return;
            }

            if (text === 'no' || text === 'cancel' || text === 'cancel_action') {
                userSessions.delete(from); // Clear session
                return whatsappService.sendTextMessage(from, "❌ Action cancelled. Reply 'menu' to start over.");
            }

            // If they replied with junk instead of hitting the button
            return whatsappService.sendTextMessage(from, "⚠️ Please use the Confirm or Cancel buttons, or type 'cancel' to exit.");
        }
    }

    // 4. Initial Menu Selection Routing (If no active session)
    if (!userSessions.has(from)) {
        if (text === '1') {
            userSessions.set(from, { type: 'expense', step: 'awaiting_amount', data: {} });
            return whatsappService.sendTextMessage(from, "Reply with the *Amount* for this expense:");
        }

        if (text === '2') {
            userSessions.set(from, { type: 'income', step: 'awaiting_amount', data: {} });
            return whatsappService.sendTextMessage(from, "Reply with the *Amount* for this income:");
        }

        if (text === '3') {
            return getMonthlySnapshot(from, user);
        }

        if (text === '4') {
            return getExpensesList(from, user);
        }

        // Fallback -> Show Menu
        return sendGreeting(from, user.name);
    }
};