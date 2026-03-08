import { apiRequest, showToast } from './api.js';

let monthlyChartInstance = null;
let categoryChartInstance = null;
let allIncomes = [];
let allExpenses = [];
let yearlyIncomeStats = [];
let yearlyExpenseStats = [];
let currentYear = new Date().getFullYear();

// Table Pagination & Search state (moved from HTML)
let currentYearExpenses = [];
let filteredExpenses = [];
let currentPage = 1;
const itemsPerPage = 10;

document.addEventListener('DOMContentLoaded', init);

async function init() {
    await fetchData();
    setupYearNavigation();
    syncNavbarAvatar(); // Sync avatar on load
    renderDashboard(currentYear);

    // Setup PDF Download Button (moved from HTML)
    const downloadBtn = document.getElementById('downloadYearlyBtn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadYearlyReport);
    }

    // Setup Search (moved from HTML)
    const searchInput = document.getElementById('expenseSearch');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }

    // Pagination buttons
    document.getElementById('prevPageBtn')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTablePage();
        }
    });

    document.getElementById('nextPageBtn')?.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderTablePage();
        }
    });
}

async function fetchData() {
    try {
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

/**
 * Syncs the navbar avatar across pages
 */
async function syncNavbarAvatar() {
    const avatarUrl = localStorage.getItem("userAvatar");
    const profileBtn = document.getElementById("navbarProfileBtn");
    const profileIcon = document.getElementById("navbarProfileIcon");

    if (avatarUrl && profileBtn && profileIcon) {
        profileIcon.innerHTML = `<img src="${avatarUrl}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1.5px solid rgba(255,255,255,0.8);">`;
        profileBtn.style.padding = "0"; // Ensure centering
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

        if (summarySection) summarySection.style.display = 'none';
        document.querySelectorAll('.chart-grid').forEach(grid => grid.style.display = 'none');
        if (monthlyBreakdownSection) monthlyBreakdownSection.style.display = 'none';
        if (allExpensesSection) allExpensesSection.style.display = 'none';
        return;
    }

    if (summarySection) summarySection.style.display = '';
    document.querySelectorAll('.chart-grid').forEach(grid => grid.style.display = 'grid');
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

    // Update Savings Progress
    const ratio = totalIncome > 0 ? (balance / totalIncome) * 100 : 0;
    const progressBar = document.getElementById('savingsProgressBar');
    const ratioText = document.getElementById('savingsRatioText');
    if (progressBar) {
        progressBar.style.width = `${Math.max(0, Math.min(100, ratio))}%`;
        progressBar.style.background = ratio > 20 ? '#22c55e' : (ratio > 0 ? '#eab308' : '#ef4444');
    }
    if (ratioText) {
        ratioText.innerText = `Savings Ratio: ${ratio.toFixed(1)}%`;
    }

    // 2. Prepare Chart Data
    updateMonthlyChart(yearIncomes, yearExpenses);
    updateCategoryChart(yearExpenses);
    updateMonthlyTable(yearIncomes, yearExpenses);
    updateYearlyInsights(yearIncomes, yearExpenses);

    // 3. Setup Table State
    currentYearExpenses = [...yearExpenses].sort((a, b) => new Date(b.date) - new Date(a.date));
    filteredExpenses = [...currentYearExpenses];
    currentPage = 1;
    renderTablePage();
}

/**
 * Table Rendering & Pagination
 */
function handleSearch(e) {
    const term = e.target.value.toLowerCase().trim();
    filteredExpenses = currentYearExpenses.filter(tx => {
        const d = new Date(tx.date);
        const day = d.getDate();
        const month = d.toLocaleString('en-IN', { month: 'short' });
        const year = d.getFullYear();
        const dateStr = `${day} ${month} ${year}`.toLowerCase();
        const catStr = tx.category.toLowerCase();
        const descStr = (tx.description || "").toLowerCase();

        return dateStr.includes(term) || catStr.includes(term) || descStr.includes(term);
    });
    currentPage = 1;
    renderTablePage();
}

function renderTablePage() {
    const tbody = document.getElementById('yearlyExpenseTableBody');
    if (!tbody) return;

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = filteredExpenses.slice(start, end);

    const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);

    // Update pagination controls
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) pageInfo.innerText = `Page ${currentPage} of ${totalPages || 1}`;

    if (currentYearExpenses.length === 0) {
        showPlaceholder('yearlyTableContainer', '📝', 'No transactions logged for this year yet.');
        if (prevPageBtn) prevPageBtn.disabled = true;
        if (nextPageBtn) nextPageBtn.disabled = true;
        if (pageInfo) pageInfo.innerText = "Page 1 of 1";
        return;
    }

    if (pageItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; opacity: 0.7;">No matching records found.</td></tr>';
        return;
    }

    tbody.innerHTML = pageItems.map(tx => `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
            <td style="padding: 12px;">${new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
            <td style="padding: 12px; font-weight: 600; color: #ef4444;">₹${tx.amount.toLocaleString('en-IN')}</td>
            <td style="padding: 12px;"><span style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 6px; font-size: 0.85rem;">${tx.category}</span></td>
            <td style="padding: 12px; opacity: 0.7;">${tx.description || "—"}</td>
        </tr>
    `).join('');
}

function updateMonthlyChart(incomes, expenses) {
    if (incomes.length === 0 && expenses.length === 0) {
        showPlaceholder('monthlyBreakdownChartContainer', '📊', 'No monthly data available for this year.');
        return;
    }

    const ctx = document.getElementById('monthlyBreakdownChart');
    if (!ctx) return;
    const context = ctx.getContext('2d');

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

function updateYearlyInsights(incomes, expenses) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Peak Month
    const monthlySpending = new Array(12).fill(0);
    expenses.forEach(e => {
        monthlySpending[new Date(e.date).getMonth()] += e.amount;
    });

    let maxSpend = -1;
    let peakIdx = -1;
    monthlySpending.forEach((amt, idx) => {
        if (amt > maxSpend) {
            maxSpend = amt;
            peakIdx = idx;
        }
    });

    const peakMonthEl = document.getElementById('peakMonth');
    if (peakMonthEl) {
        peakMonthEl.innerText = peakIdx !== -1 && maxSpend > 0 ? `${monthNames[peakIdx]} (₹${maxSpend.toLocaleString('en-IN')})` : 'No Data';
    }

    // Top Category
    const categoryTotals = {};
    expenses.forEach(e => {
        categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });

    let topCat = '-';
    let topAmt = -1;
    Object.entries(categoryTotals).forEach(([cat, amt]) => {
        if (amt > topAmt) {
            topAmt = amt;
            topCat = cat;
        }
    });

    const topCatEl = document.getElementById('topCategory');
    if (topCatEl) {
        topCatEl.innerText = topAmt > 0 ? `${topCat} (₹${topAmt.toLocaleString('en-IN')})` : 'No Data';
    }
}

function updateCategoryChart(expenses) {
    if (expenses.length === 0) {
        showPlaceholder('categoryDistributionChartContainer', '🍕', 'No expense categories found for this year.');
        return;
    }

    const ctx = document.getElementById('categoryDistributionChart');
    if (!ctx) return;
    const context = ctx.getContext('2d');

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
                backgroundColor: ['#7C7CFF', '#22C55E', '#FACC15', '#EF4444', '#38BDF8', '#A78BFA'],
                borderWidth: 2,
                borderColor: 'rgba(255,255,255,0.1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: 'white', font: { size: 10 } } }
            },
            cutout: '65%'
        }
    });
}

/**
 * Premium PDF Generation Logic
 */
async function downloadYearlyReport() {
    const year = currentYear;
    const yearExpenses = allExpenses.filter(e => new Date(e.date).getFullYear() === year).sort((a, b) => new Date(b.date) - new Date(a.date));

    if (!yearExpenses || yearExpenses.length === 0) {
        showToast("No data to download for this year", "error");
        return;
    }

    showToast("Generating Premium PDF...", "success");

    let userName = localStorage.getItem("userName") || "User";
    let avatarBase64 = null;
    try {
        const userRes = await apiRequest('/auth/me', 'GET', null, { skipLoader: true });
        if (userRes.data) {
            userName = userRes.data.name || userName;
            const userAvatar = userRes.data.avatar || localStorage.getItem("userAvatar");
            if (userAvatar) avatarBase64 = await toCircularDataURL(userAvatar);
        }
    } catch (e) { console.warn("Could not fetch user info for PDF", e); }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // 1. Prepare Data
    const incomeVal = yearlyIncomeStats.find(item => item._id == year)?.totalIncome || 0;
    const expenseVal = yearlyExpenseStats.find(item => item._id == year)?.totalExpense || 0;
    const balanceVal = incomeVal - expenseVal;

    // Watermark Helper
    const addWatermark = (pDoc) => {
        pDoc.saveGraphicsState();
        pDoc.setFontSize(40);
        pDoc.setTextColor(230, 230, 230);
        pDoc.setFont("helvetica", "bold");
        pDoc.setGState(new pDoc.GState({ opacity: 0.1 }));
        pDoc.text("DHANREKHA VERIFIED", 105, 150, { align: "center", angle: 45 });
        pDoc.restoreGraphicsState();
    };

    /* =========================================
       PAGE 1: PREMIUM COVER PAGE
    ========================================= */
    doc.setFillColor(15, 32, 39);
    doc.rect(0, 0, 210, 297, "F");

    // App Logo
    try {
        const logo = await toDataURL("assets/logo1.png");
        doc.addImage(logo, "PNG", 85, 40, 40, 40);
    } catch { }

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(40);
    doc.text("DhanRekha", 105, 100, { align: "center" });

    doc.setFontSize(16);
    doc.setTextColor(34, 197, 94);
    doc.text("YEARLY FINANCIAL STATEMENT", 105, 112, { align: "center" });

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.text(`YEAR ${year}`, 105, 140, { align: "center" });

    // User Avatar
    const avatarY = 195;
    if (avatarBase64) {
        doc.setDrawColor(255, 255, 255); doc.setLineWidth(1.5);
        doc.circle(105, avatarY, 26, "S");
        try { doc.addImage(avatarBase64, "PNG", 81, avatarY - 24, 48, 48); } catch { }
    } else {
        doc.setDrawColor(255, 255, 255); doc.setLineWidth(1.5);
        doc.circle(105, avatarY, 26, "S");
        doc.setFillColor(200, 200, 200);
        doc.circle(105, avatarY - 8, 8, "F");
        doc.ellipse(105, avatarY + 12, 16, 10, "F");
    }

    doc.setFontSize(22);
    doc.text(userName, 105, avatarY + 45, { align: "center" });
    doc.setFontSize(12); doc.setFont("helvetica", "normal"); doc.setTextColor(160, 160, 160);
    doc.text("Annual Audit", 105, avatarY + 55, { align: "center" });

    doc.setFontSize(10); doc.setTextColor(255);
    doc.text(`Issued on ${new Date().toLocaleDateString("en-IN")}`, 105, 280, { align: "center" });


    // Cover Footer (No Page Number)
    const h = doc.internal.pageSize.getHeight();
    doc.setFontSize(8); doc.setTextColor(255); // White color for first page
    const timestampGlobal = new Date().toLocaleString('en-IN', { hour12: true });
    doc.text("DhanRekha • Where Your Money Tells a Story", 105, h - 10, { align: "center" });

    /* ===============================
       PAGE 2: SUMMARY & BREAKDOWN
    ================================ */
    doc.addPage();
    addWatermark(doc);

    // Header
    doc.setFillColor(15, 32, 39); doc.rect(0, 0, 210, 40, "F");
    doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(22);
    doc.text("DhanRekha", 14, 25);
    doc.setFontSize(12); doc.setFont("helvetica", "normal");
    doc.text(`Annual Statement ${year}`, 14, 33);
    doc.text(`${userName}`, 196, 25, { align: "right" });

    let finalY = 55;
    doc.setFontSize(14); doc.setTextColor(34, 197, 94); doc.setFont("helvetica", "bold");
    doc.text("ANNUAL PERFORMANCE", 14, finalY);

    finalY += 10;
    doc.setTextColor(0); doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(`Total Annual Income:  ${incomeVal.toLocaleString('en-IN')}`, 14, finalY);
    doc.text(`Total Annual Expense: ${expenseVal.toLocaleString('en-IN')}`, 80, finalY);
    doc.text(`Net Savings: ${balanceVal.toLocaleString('en-IN')}`, 150, finalY);

    // Monthly Breakdown Table
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthlyData = new Array(12).fill(null).map(() => ({ inc: 0, exp: 0 }));
    allIncomes.filter(i => new Date(i.date).getFullYear() === year).forEach(i => monthlyData[new Date(i.date).getMonth()].inc += i.amount);
    allExpenses.filter(e => new Date(e.date).getFullYear() === year).forEach(e => monthlyData[new Date(e.date).getMonth()].exp += e.amount);

    const monthlyBody = [];
    monthlyData.forEach((d, i) => {
        if (d.inc > 0 || d.exp > 0) {
            monthlyBody.push([monthNames[i], d.inc.toLocaleString('en-IN'), d.exp.toLocaleString('en-IN'), (d.inc - d.exp).toLocaleString('en-IN')]);
        }
    });

    doc.autoTable({
        startY: finalY + 8,
        head: [["Month", "Income", "Expense", "Savings"]],
        body: monthlyBody,
        theme: "grid",
        headStyles: { fillColor: [15, 32, 39], textColor: 255 },
        columnStyles: { 1: { textColor: [34, 197, 94] }, 2: { textColor: [220, 38, 38] }, 3: { fontStyle: 'bold' } },
        didDrawPage: (data) => {
            const h = doc.internal.pageSize.getHeight();
            doc.setFontSize(8); doc.setTextColor(0); // Black color
            doc.text(timestampGlobal, 14, h - 10);
            doc.text("DhanRekha • Where Your Money Tells a Story", 105, h - 10, { align: "center" });
            // No Page Number for Summary section as per user request
        }
    });

    /* ===============================
       PAGE 3+: DETAILED LOGS
    ================================ */
    doc.addPage();
    addWatermark(doc);
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(34, 197, 94);
    doc.text("Transactions List", 14, 25);

    const tableData = yearExpenses.map(tx => [
        new Date(tx.date).toLocaleDateString("en-IN"),
        tx.amount.toLocaleString('en-IN'),
        tx.category
    ]);

    let transactionPageCounter = 0;
    doc.autoTable({
        startY: 30,
        head: [["Date", "Amount", "Category"]],
        body: tableData,
        theme: "grid",
        headStyles: { fillColor: [20, 83, 45], textColor: 255 },
        columnStyles: { 1: { halign: "right", fontStyle: "bold", textColor: [220, 38, 38] } },
        didDrawPage: (data) => {
            const h = doc.internal.pageSize.getHeight();
            doc.setFontSize(8); doc.setTextColor(0); // Black color
            doc.text(timestampGlobal, 14, h - 10);
            doc.text("DhanRekha • Where Your Money Tells a Story", 105, h - 10, { align: "center" });

            transactionPageCounter++;
            doc.text(`Page ${transactionPageCounter}`, 196, h - 10, { align: "right" });
        }
    });

    // Final Signature Section
    const finalTableY = doc.lastAutoTable.finalY || 30;
    const sigY = finalTableY + 30;
    if (sigY < 250) {
        doc.setDrawColor(200); doc.line(140, sigY, 190, sigY);
        doc.setFontSize(10); doc.setTextColor(0);
        doc.text("Verified Signature", 165, sigY + 5, { align: "center" });

        // Timestamp
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        doc.setFontSize(8); doc.setTextColor(100);
        doc.text(`Timestamp: ${timeStr}`, 165, sigY + 12, { align: "center" });

        doc.setFont("courier", "italic");
        doc.setTextColor(0);
        doc.text(userName, 165, sigY - 5, { align: "center" });
    }

    doc.save(`DhanRekha_Yearly_Audit_${year}_${userName}.pdf`);
    showToast("Report Downloaded Successfully", "success");
}

/**
 * Helpers (moved/copied from monthly)
 */
async function toDataURL(url) {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function toCircularDataURL(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const size = Math.min(img.width, img.height);
            canvas.width = size; canvas.height = size;
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, size, size);
            resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = reject;
        img.src = url;
    });
}

function showPlaceholder(containerId, icon, text) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="empty-state-placeholder">
        <div class="placeholder-icon">${icon}</div>
        <div class="placeholder-text">${text}</div>
      </div>
    `;
}