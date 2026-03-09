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

const calculateBalance = async (userId, forCurrentMonth = false) => {
    let matchQuery = { userId: userId };

    if (forCurrentMonth) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        matchQuery.date = { $gte: startOfMonth, $lte: endOfMonth };
    }

    const incomeAggr = await Income.aggregate([
        { $match: matchQuery },
        { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const expenseAggr = await Expense.aggregate([
        { $match: matchQuery },
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
        `1️⃣ Add Today Expense\n` +
        `2️⃣ Add Budget for Current Month\n` +
        `3️⃣ Monthly Snapshot\n` +
        `4️⃣ View Expenses List\n\n` +
        `Send *0* at anytime to cancel.`;

    return whatsappService.sendTextMessage(from, text);
};

// ==========================================
// REPORT VIEWERS (OPTIONS 3 & 4)
// ==========================================

const generateDayReport = async (from, user, queryDate, startOfDay, endOfDay) => {
    const expenses = await Expense.find({
        userId: user._id,
        date: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ date: 1 });

    if (expenses.length === 0) {
        return whatsappService.sendTextMessage(from, "❌ No any expenses for that day.\n\n_Reply 0 to return to Menu._");
    }

    let replyText = `📅 *${queryDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}*\n`;
    replyText += '```text\n';

    const catWidth = 13;
    const amtWidth = 10;

    const borderTop = `┌${'─'.repeat(catWidth + 2)}┬${'─'.repeat(amtWidth + 2)}┐\n`;
    const borderMid = `├${'─'.repeat(catWidth + 2)}┼${'─'.repeat(amtWidth + 2)}┤\n`;
    const borderBot = `└${'─'.repeat(catWidth + 2)}┴${'─'.repeat(amtWidth + 2)}┘\n`;

    replyText += borderTop;
    replyText += `│ ${'Category'.padEnd(catWidth)} │ ${'Amount'.padStart(amtWidth)} │\n`;
    replyText += borderMid;

    let dailyTotal = 0;
    expenses.forEach(item => {
        let catName = item.category;
        if (catName.length > catWidth) catName = catName.substring(0, catWidth - 1) + '…';

        const amtStr = item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        replyText += `│ ${catName.padEnd(catWidth)} │ ${amtStr.padStart(amtWidth)} │\n`;
        dailyTotal += item.amount;
    });

    if (expenses.length > 1) {
        replyText += borderMid;
        const totalStr = dailyTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        replyText += `│ ${'Daily Total'.padEnd(catWidth)} │ ${totalStr.padStart(amtWidth)} │\n`;
    }

    replyText += borderBot;
    replyText += '```\n';
    replyText += `\n_Reply 0 to return to Menu._`;

    return whatsappService.sendTextMessage(from, replyText);
};

const generateMonthReport = async (from, user, year, monthIndex) => {
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

    const monthName = new Date(year, monthIndex).toLocaleString('default', { month: 'long' });
    let replyText = `📊 *Snapshot for ${monthName.toUpperCase()} ${year}*\n\n` +
        `💰 Income: ₹${totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
        `💸 Expenses: ₹${totalExpense.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
        `📈 Balance: ₹${balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n`;

    const expenses = await Expense.find({
        userId: user._id,
        date: { $gte: startOfMonth, $lte: endOfMonth }
    }).sort({ date: 1 });

    if (expenses.length > 0) {
        const grouped = {};
        expenses.forEach(e => {
            const d = new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            if (!grouped[d]) grouped[d] = [];
            grouped[d].push(e);
        });

        const catWidth = 13;
        const amtWidth = 10;
        const borderTop = `┌${'─'.repeat(catWidth + 2)}┬${'─'.repeat(amtWidth + 2)}┐\n`;
        const borderMid = `├${'─'.repeat(catWidth + 2)}┼${'─'.repeat(amtWidth + 2)}┤\n`;
        const borderBot = `└${'─'.repeat(catWidth + 2)}┴${'─'.repeat(amtWidth + 2)}┘\n`;

        for (const [date, items] of Object.entries(grouped)) {
            replyText += `📅 *${date}*\n\`\`\`text\n`;
            replyText += borderTop;
            replyText += `│ ${'Category'.padEnd(catWidth)} │ ${'Amount'.padStart(amtWidth)} │\n`;
            replyText += borderMid;

            let dailyTotal = 0;
            items.forEach(item => {
                let catName = item.category;
                if (catName.length > catWidth) catName = catName.substring(0, catWidth - 1) + '…';

                const amtStr = item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                replyText += `│ ${catName.padEnd(catWidth)} │ ${amtStr.padStart(amtWidth)} │\n`;
                dailyTotal += item.amount;
            });

            if (items.length > 1) {
                replyText += borderMid;
                const totalStr = dailyTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                replyText += `│ ${'Daily Total'.padEnd(catWidth)} │ ${totalStr.padStart(amtWidth)} │\n`;
            }
            replyText += borderBot;
            replyText += '```\n';
        }
    }

    replyText += `_Reply 0 to return to Menu._`;
    return whatsappService.sendTextMessage(from, replyText);
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
                const currentBalance = await calculateBalance(user._id, true);
                const currentMonthName = new Date().toLocaleString('default', { month: 'long' });
                if (amount > currentBalance) {
                    userSessions.delete(from); // Kill session
                    return whatsappService.sendTextMessage(
                        from,
                        `⚠️ *Insufficient Balance!*\n\n` +
                        `You are trying to add an expense of ₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, ` +
                        `but your remaining purse for ${currentMonthName} is only ₹${currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.\n\n` +
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

        // --- SNAPSHOT FLOW (Option 3) ---
        if (session.type === 'snapshot') {
            if (session.step === 'awaiting_year') {
                const year = parseInt(text);
                if (isNaN(year) || year < 2000 || year > 2100) {
                    return whatsappService.sendTextMessage(from, "❌ Invalid year. Reply with a valid year (e.g. 2026), or send 0 to cancel.");
                }

                const startOfYear = new Date(year, 0, 1);
                const endOfYear = new Date(year, 11, 31, 23, 59, 59);
                const count = await Expense.countDocuments({
                    userId: user._id,
                    date: { $gte: startOfYear, $lte: endOfYear }
                });

                if (count === 0) {
                    userSessions.delete(from);
                    return whatsappService.sendTextMessage(from, `❌ You have no expenses recorded for the year ${year}.\n\n_Reply 0 to return to Menu._`);
                }

                session.data.year = year;
                session.step = 'awaiting_month';
                userSessions.set(from, session);

                return whatsappService.sendTextMessage(from, `📅 Year: ${year}\n\n*Reply with the Month Number (1-12)*:`);
            }

            if (session.step === 'awaiting_month') {
                const month = parseInt(text);
                if (isNaN(month) || month < 1 || month > 12) {
                    return whatsappService.sendTextMessage(from, "❌ Invalid month. Reply with a number from 1 to 12, or send 0 to cancel.");
                }

                const year = session.data.year;
                const monthIndex = month - 1;

                const startOfMonth = new Date(year, monthIndex, 1);
                const endOfMonth = new Date(year, monthIndex + 1, 0, 23, 59, 59);

                const count = await Expense.countDocuments({
                    userId: user._id,
                    date: { $gte: startOfMonth, $lte: endOfMonth }
                });

                if (count === 0) {
                    userSessions.delete(from);
                    const monthName = new Date(year, monthIndex).toLocaleString('default', { month: 'long' });
                    return whatsappService.sendTextMessage(from, `❌ You have no expenses recorded for ${monthName} ${year}.\n\n_Reply 0 to return to Menu._`);
                }

                userSessions.delete(from); // Clear session
                return generateMonthReport(from, user, year, monthIndex);
            }
        }

        // --- EXPENSE LIST FLOW (Option 4) ---
        if (session.type === 'expense_list') {
            if (session.step === 'awaiting_date') {
                const parts = text.split('-');
                if (parts.length !== 3) {
                    return whatsappService.sendTextMessage(from, "❌ Invalid format. Please use DD-MM-YYYY (e.g. 15-03-2026), or send 0 to cancel.");
                }
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1;
                const year = parseInt(parts[2]);

                const queryDate = new Date(year, month, day);
                if (isNaN(queryDate.getTime()) || queryDate.getDate() !== day) {
                    return whatsappService.sendTextMessage(from, "❌ Invalid date. Please try again with format DD-MM-YYYY, or send 0 to cancel.");
                }

                // Make sure to query correctly for that day
                const startOfDay = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
                const endOfDay = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));

                userSessions.delete(from);
                return generateDayReport(from, user, queryDate, startOfDay, endOfDay);
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
                        const remaining = await calculateBalance(user._id, true);
                        const currentMonthName = new Date().toLocaleString('default', { month: 'long' });
                        await whatsappService.sendTextMessage(from, `✅ Expense recorded successfully!\n\n💼 Remaining purse for ${currentMonthName}: ₹${remaining.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                    } else if (session.type === 'income') {
                        const newIncome = new Income({
                            ...session.data,
                            userId: user._id,
                            date: new Date()
                        });
                        await newIncome.save();
                        const current = await calculateBalance(user._id, true);
                        const currentMonthName = new Date().toLocaleString('default', { month: 'long' });
                        await whatsappService.sendTextMessage(from, `✅ Income added successfully!\n\n💼 Remaining purse for ${currentMonthName}: ₹${current.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
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
            userSessions.set(from, { type: 'snapshot', step: 'awaiting_year', data: {} });
            return whatsappService.sendTextMessage(from, "Reply with the *Year* to view (e.g. 2026):");
        }

        if (text === '4') {
            userSessions.set(from, { type: 'expense_list', step: 'awaiting_date', data: {} });
            return whatsappService.sendTextMessage(from, "Reply with the *Date* in DD-MM-YYYY format (e.g. 15-03-2026):");
        }

        // Fallback -> Show Menu
        return sendGreeting(from, user.name);
    }
};