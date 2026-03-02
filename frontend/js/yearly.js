import { apiRequest } from './api.js';

let monthlyChartInstance = null;
let categoryChartInstance = null;
let allIncomes = [];
let allExpenses = [];
let yearlyIncomeStats = [];
let yearlyExpenseStats = [];
let currentYear = new Date().getFullYear();

document.addEventListener('DOMContentLoaded', init);

async function init() {
    await fetchData();
    setupYearNavigation();
    renderDashboard(currentYear);
}

async function fetchData() {
    try {
        // Fetch all data to process client-side for flexibility
        const [incomeRes, expenseRes, incomeYearlyRes, expenseYearlyRes] = await Promise.all([
            apiRequest('/income', 'GET'),
            apiRequest('/expenses', 'GET'),
            apiRequest('/income/yearly', 'GET'),
            apiRequest('/expenses/yearly', 'GET')
        ]);

        allIncomes = incomeRes.data || [];
        allExpenses = expenseRes.data || [];
        yearlyIncomeStats = incomeYearlyRes.data || [];
        yearlyExpenseStats = expenseYearlyRes.data || [];
    } catch (error) {
        console.error("Failed to fetch data:", error);
    }
}

function setupYearNavigation() {
    const prevBtn = document.getElementById('prevYearBtn');
    const nextBtn = document.getElementById('nextYearBtn');
    const display = document.getElementById('currentYearDisplay');
    const input = document.getElementById('yearInput');

    updateYearDisplay();

    prevBtn.addEventListener('click', () => {
        currentYear--;
        updateYearDisplay();
        renderDashboard(currentYear);
    });

    nextBtn.addEventListener('click', () => {
        if (currentYear >= new Date().getFullYear()) return;
        currentYear++;
        updateYearDisplay();
        renderDashboard(currentYear);
    });

    display.addEventListener('click', () => {
        display.style.display = 'none';
        input.style.display = 'block';
        input.value = currentYear;
        input.focus();
    });

    const saveYear = () => {
        const val = parseInt(input.value);
        if (val && val > 1900 && val <= new Date().getFullYear()) {
            currentYear = val;
            renderDashboard(currentYear);
        }
        input.style.display = 'none';
        display.style.display = 'block';
        updateYearDisplay();
    };

    input.addEventListener('blur', saveYear);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') input.blur();
    });
}

function updateYearDisplay() {
    document.getElementById('currentYearDisplay').innerText = currentYear;
    
    const nextBtn = document.getElementById('nextYearBtn');
    if (currentYear >= new Date().getFullYear()) {
        nextBtn.style.opacity = "0.3";
        nextBtn.style.pointerEvents = "none";
        nextBtn.disabled = true;
    } else {
        nextBtn.style.opacity = "1";
        nextBtn.style.pointerEvents = "auto";
        nextBtn.disabled = false;
    }
}

function renderDashboard(year) {
    year = parseInt(year);
    // Filter data for selected year
    const yearIncomes = allIncomes.filter(i => new Date(i.date).getFullYear() === year);
    const yearExpenses = allExpenses.filter(e => new Date(e.date).getFullYear() === year);

    const incomeStat = yearlyIncomeStats.find(item => item._id == year);
    const expenseStat = yearlyExpenseStats.find(item => item._id == year);

    const hasData = yearIncomes.length > 0 || yearExpenses.length > 0 || 
                    (incomeStat && incomeStat.totalIncome > 0) || 
                    (expenseStat && expenseStat.totalExpense > 0);

    const summarySection = document.querySelector('.summary');
    const chartGrid = document.querySelector('.chart-grid');
    const monthlyBreakdownSection = document.getElementById('monthlyBreakdownSection');
    const allExpensesSection = document.getElementById('allExpensesSection');
    let noDataMsg = document.getElementById('no-data-msg');

    if (!hasData) {
        if (summarySection) summarySection.style.display = 'none';
        if (chartGrid) chartGrid.style.display = 'none';
        if (monthlyBreakdownSection) monthlyBreakdownSection.style.display = 'none';
        if (allExpensesSection) allExpensesSection.style.display = 'none';

        // Fix: Clear monthly table so it doesn't show previous year's data
        updateMonthlyTable([], []);

        if (!noDataMsg) {
            noDataMsg = document.createElement('div');
            noDataMsg.id = 'no-data-msg';
            noDataMsg.className = 'glass-card';
            noDataMsg.style.textAlign = 'center';
            noDataMsg.style.padding = '40px';
            noDataMsg.style.marginTop = '20px';
            noDataMsg.style.color = 'rgba(255, 255, 255, 0.8)';
            noDataMsg.innerHTML = `
                <div style="font-size: 3rem; margin-bottom: 15px;">📭</div>
                <h3 style="margin-bottom: 10px;">No Transactions Found</h3>
                <p>There are no income or expense records for ${year}.</p>
            `;
            const nav = document.querySelector('.year-navigation');
            if (nav && nav.parentNode) nav.parentNode.insertBefore(noDataMsg, nav.nextSibling);
        } else {
            noDataMsg.querySelector('p').innerText = `There are no income or expense records for ${year}.`;
            noDataMsg.style.display = 'block';
        }
        return;
    }

    if (summarySection) summarySection.style.display = '';
    if (chartGrid) chartGrid.style.display = '';
    if (monthlyBreakdownSection) monthlyBreakdownSection.style.display = '';
    if (allExpensesSection) allExpensesSection.style.display = '';
    if (noDataMsg) noDataMsg.style.display = 'none';

    // 1. Update Summary Cards
    // Use server-side aggregated data for income
    const totalIncome = incomeStat ? incomeStat.totalIncome : yearIncomes.reduce((sum, i) => sum + i.amount, 0);
    
    // Use server-side aggregated data for expense
    const totalExpense = expenseStat ? expenseStat.totalExpense : yearExpenses.reduce((sum, e) => sum + e.amount, 0);
    
    const balance = totalIncome - totalExpense;

    document.getElementById('yearlyIncome').innerText = `₹${totalIncome.toLocaleString('en-IN')}`;
    document.getElementById('yearlyExpense').innerText = `₹${totalExpense.toLocaleString('en-IN')}`;
    document.getElementById('yearlyBalance').innerText = `₹${balance.toLocaleString('en-IN')}`;

    // 2. Prepare Chart Data
    updateMonthlyChart(yearIncomes, yearExpenses);
    updateCategoryChart(yearExpenses);
    updateMonthlyTable(yearIncomes, yearExpenses);
}

function updateMonthlyChart(incomes, expenses) {
    const ctx = document.getElementById('monthlyBreakdownChart').getContext('2d');
    
    // Initialize arrays for 12 months
    const monthlyIncome = new Array(12).fill(0);
    const monthlyExpense = new Array(12).fill(0);

    incomes.forEach(i => {
        const month = new Date(i.date).getMonth(); // 0-11
        monthlyIncome[month] += i.amount;
    });

    expenses.forEach(e => {
        const month = new Date(e.date).getMonth();
        monthlyExpense[month] += e.amount;
    });

    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (monthlyChartInstance) monthlyChartInstance.destroy();

    monthlyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Income',
                    data: monthlyIncome,
                    backgroundColor: '#3b82f6',
                    borderRadius: 4
                },
                {
                    label: 'Expense',
                    data: monthlyExpense,
                    backgroundColor: '#ef4444',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: 'rgba(255, 255, 255, 0.7)' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: 'rgba(255, 255, 255, 0.7)' }
                }
            },
            plugins: {
                legend: { labels: { color: 'white' } }
            }
        }
    });
}

function updateMonthlyTable(incomes, expenses) {
    const tbody = document.getElementById('monthlyTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const monthlyIncome = new Array(12).fill(0);
    const monthlyExpense = new Array(12).fill(0);

    incomes.forEach(i => {
        const month = new Date(i.date).getMonth();
        monthlyIncome[month] += (i.amount || 0);
    });

    expenses.forEach(e => {
        const month = new Date(e.date).getMonth();
        monthlyExpense[month] += (e.amount || 0);
    });

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    let html = '';

    for (let i = 0; i < 12; i++) {
        const inc = monthlyIncome[i];
        const exp = monthlyExpense[i];
        
        // Skip months with no activity
        if (inc === 0 && exp === 0) continue;

        const savings = inc - exp;
        const arrow = savings >= 0 ? '▲' : '▼';
        html += `<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
            <td style="padding: 12px;">${monthNames[i]}</td>
            <td style="padding: 12px; color: #4ade80;">₹${inc.toLocaleString('en-IN')}</td>
            <td style="padding: 12px; color: #ef4444;">₹${exp.toLocaleString('en-IN')}</td>
            <td style="padding: 12px; color: ${savings >= 0 ? '#4ade80' : '#ef4444'};"><span style="margin-right: 4px; font-size: 0.8em;">${arrow}</span>₹${savings.toLocaleString('en-IN')}</td>
        </tr>`;
    }

    if (!html) {
        html = '<tr><td colspan="4" style="text-align:center; padding: 20px; opacity: 0.7;">No data available for this year.</td></tr>';
    }
    tbody.innerHTML = html;
}

function updateCategoryChart(expenses) {
    const ctx = document.getElementById('categoryDistributionChart').getContext('2d');
    
    const categoryTotals = {};
    expenses.forEach(e => {
        categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);

    if (categoryChartInstance) categoryChartInstance.destroy();

    categoryChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: 'white' } }
            }
        }
    });
}