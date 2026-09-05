import { apiRequest } from './api.js';

// Parse query params or fallback to current
const urlParams = new URLSearchParams(window.location.search);
const now = new Date();
let targetYear = parseInt(urlParams.get("year")) || now.getFullYear();
let targetMonth = parseInt(urlParams.get("month")) || (now.getMonth() + 1);

// State
let currentPage = 1;
let currentLimit = 10;
let currentType = 'all';
let currentSearch = '';
let currentCategory = '';
let currentDate = '';
let currentMinAmount = '';
let currentMaxAmount = '';
let currentStatus = 'all';
let currentSortBy = 'date';
let currentSortOrder = 'desc';

let currentTransactions = [];
let categoriesPopulated = false;

// Month Names Helper
const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  updatePageHeader();
  fetchTransactions();
  setupSearchListener();
});

// Update page title and header
function updatePageHeader() {
  const monthName = monthNames[targetMonth - 1] || `Month ${targetMonth}`;
  const titleText = `${monthName} ${targetYear} Transactions`;

  const periodNameEl = document.getElementById("periodName");
  const periodSubtextEl = document.getElementById("periodSubtext");

  if (periodNameEl) periodNameEl.innerText = `${monthName} ${targetYear}`;
  if (periodSubtextEl) {
    periodSubtextEl.innerText = `Detailed date-wise ledger for ${monthName} ${targetYear} with server pagination and Excel-safe CSV export.`;
  }
  document.title = `Dhan₹ekha – ${titleText}`;

  // Constrain date picker filter to target month bounds
  const dateFilterInput = document.getElementById("dateFilter");
  if (dateFilterInput) {
    const mStr = String(targetMonth).padStart(2, "0");
    const lastDay = new Date(targetYear, targetMonth, 0).getDate();
    dateFilterInput.min = `${targetYear}-${mStr}-01`;
    dateFilterInput.max = `${targetYear}-${mStr}-${String(lastDay).padStart(2, "0")}`;
    dateFilterInput.value = "";
  }
}

// Month stepping (Prev / Next month)
window.stepMonth = function (delta) {
  targetMonth += delta;
  if (targetMonth > 12) {
    targetMonth = 1;
    targetYear++;
  } else if (targetMonth < 1) {
    targetMonth = 12;
    targetYear--;
  }

  // Update browser URL silently without reload
  const newUrl = `${window.location.pathname}?year=${targetYear}&month=${targetMonth}`;
  window.history.pushState({ path: newUrl }, '', newUrl);

  currentPage = 1;
  currentDate = '';
  categoriesPopulated = false;
  updatePageHeader();
  fetchTransactions();
};

// Fetch transactions with pagination & filters
async function fetchTransactions() {
  const tableBody = document.getElementById("transactionsTableBody");
  const mobileList = document.getElementById("mobileCardsList");
  const emptyPlaceholder = document.getElementById("emptyPlaceholder");
  const paginationBar = document.getElementById("paginationBar");

  if (tableBody) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 50px; color: #94a3b8;">
          <div class="loader" style="margin: 0 auto 12px auto; width: 28px; height: 28px; border-width: 3px;"></div>
          Loading records...
        </td>
      </tr>
    `;
  }

  const queryParams = new URLSearchParams({
    year: targetYear,
    month: targetMonth,
    page: currentPage,
    limit: currentLimit,
    type: currentType,
    search: currentSearch,
    category: currentCategory,
    date: currentDate,
    minAmount: currentMinAmount,
    maxAmount: currentMaxAmount,
    status: currentStatus,
    sortBy: currentSortBy,
    sortOrder: currentSortOrder
  });

  try {
    const res = await apiRequest(`/expenses/transactions/paginated?${queryParams.toString()}`);
    const data = res.data;

    currentTransactions = data.transactions || [];

    // Populate categories once per month
    if (!categoriesPopulated && data.categories) {
      populateCategorySelect(data.categories);
      categoriesPopulated = true;
    }

    // Render KPIs
    renderKpis(data.kpis);

    // Check empty state
    if (currentTransactions.length === 0) {
      if (tableBody) tableBody.innerHTML = "";
      if (mobileList) mobileList.innerHTML = "";
      if (emptyPlaceholder) emptyPlaceholder.style.display = "block";
      if (paginationBar) paginationBar.style.display = "none";
      return;
    }

    if (emptyPlaceholder) emptyPlaceholder.style.display = "none";
    if (paginationBar) paginationBar.style.display = "flex";

    // Render desktop & mobile list
    renderTable(currentTransactions);
    renderMobileCards(currentTransactions);
    renderPagination(data.pagination);

  } catch (err) {
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 35px; color: #f43f5e;">
            ⚠️ Failed to load transactions: ${err.message}
            <br>
            <button onclick="fetchTransactions()" class="page-nav-btn" style="margin-top: 12px;">Retry</button>
          </td>
        </tr>
      `;
    }
  }
}

// Render Desktop Table Rows
function renderTable(transactions) {
  const tableBody = document.getElementById("transactionsTableBody");
  if (!tableBody) return;

  tableBody.innerHTML = transactions.map(tx => {
    const isIncome = tx.type === 'income';
    const dateObj = new Date(tx.date);
    const dateFormatted = dateObj.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    const dayName = dateObj.toLocaleDateString('en-IN', { weekday: 'short' });

    return `
      <tr>
        <td style="white-space: nowrap;">
          <div style="font-weight: 600; color: #f8fafc;">${dateFormatted}</div>
          <div style="font-size: 0.75rem; color: #64748b; font-weight: 500;">${dayName}</div>
        </td>
        <td>
          <span class="pill-badge ${isIncome ? 'pill-inflow' : 'pill-outflow'}">
            ${isIncome ? '↑ Inflow' : '↓ Outflow'}
          </span>
        </td>
        <td>
          ${isIncome ? `
            <span style="color: rgba(255,255,255,0.3); font-weight: 500; font-size: 0.95rem;">-</span>
          ` : `
            <span class="category-tag">${tx.category}</span>
          `}
        </td>
        <td>
          <span style="color: ${isIncome ? '#cbd5e1' : '#94a3b8'}; font-weight: ${isIncome ? '600' : '400'};">
            ${tx.description || '-'}
          </span>
        </td>
        <td>
          ${tx.isOverBudget ? `
            <span class="pill-badge pill-overbudget" title="Exceeded balance limit at time of transaction">
              ⚠️ Over Budget
            </span>
          ` : `
            <span class="pill-badge pill-normal">Normal</span>
          `}
        </td>
        <td style="text-align: right;">
          <span class="amount-cell ${isIncome ? 'amount-positive' : 'amount-negative'}">
            ${isIncome ? '+' : '-'}₹${formatINR(tx.amount)}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

// Render Mobile Card List
function renderMobileCards(transactions) {
  const mobileList = document.getElementById("mobileCardsList");
  if (!mobileList) return;

  mobileList.innerHTML = transactions.map(tx => {
    const isIncome = tx.type === 'income';
    const dateFormatted = new Date(tx.date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    return `
      <div class="mobile-tx-card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <span class="pill-badge ${isIncome ? 'pill-inflow' : 'pill-outflow'}">
              ${isIncome ? '↑ Inflow' : '↓ Outflow'}
            </span>
            <span style="font-size: 0.8rem; color: #64748b; margin-left: 8px;">${dateFormatted}</span>
          </div>
          <span class="amount-cell ${isIncome ? 'amount-positive' : 'amount-negative'}">
            ${isIncome ? '+' : '-'}₹${formatINR(tx.amount)}
          </span>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
          <div>
            ${isIncome ? `
              <span style="font-weight: 700; color: #f8fafc; font-size: 0.98rem;">${tx.description || 'Income'}</span>
            ` : `
              <span class="category-tag">${tx.category}</span>
            `}
          </div>
          ${tx.isOverBudget ? `
            <span class="pill-badge pill-overbudget" style="font-size: 0.72rem;">⚠️ Over Budget</span>
          ` : ''}
        </div>

        ${!isIncome && tx.description && tx.description !== '-' ? `
          <div style="font-size: 0.85rem; color: #94a3b8;">${tx.description}</div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// Render Top KPI Cards
function renderKpis(kpis) {
  if (!kpis) return;

  const incEl = document.getElementById("kpiIncome");
  const expEl = document.getElementById("kpiExpense");
  const balEl = document.getElementById("kpiBalance");
  const countEl = document.getElementById("kpiCount");

  if (incEl) incEl.innerText = `₹${formatINR(kpis.totalIncome)}`;
  if (expEl) expEl.innerText = `₹${formatINR(kpis.totalExpense)}`;
  if (balEl) {
    const isNeg = kpis.balance < 0;
    balEl.innerText = `${isNeg ? '-' : ''}₹${formatINR(Math.abs(kpis.balance))}`;
    balEl.style.color = isNeg ? "#fb7185" : "#4ade80";
  }
  if (countEl) countEl.innerText = `${kpis.totalTransactions} txns`;
}

// Populate Categories Select (Strictly genuine expense categories)
function populateCategorySelect(categories) {
  const select = document.getElementById("categoryFilter");
  if (!select) return;

  select.innerHTML = '<option value="">All Categories</option>';
  // Filter out any accidental "Income" string
  const cleanCategories = (categories || []).filter(c => c && c.toLowerCase() !== 'income');
  cleanCategories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
}

// Render Pagination Controls
function renderPagination(pagination) {
  const infoEl = document.getElementById("paginationInfo");
  const btnContainer = document.getElementById("paginationButtons");

  if (!infoEl || !btnContainer || !pagination) return;

  const { total, page, limit, totalPages, hasNextPage, hasPrevPage } = pagination;
  const startIdx = total === 0 ? 0 : (page - 1) * limit + 1;
  const endIdx = Math.min(page * limit, total);

  infoEl.innerText = `Showing ${startIdx}–${endIdx} of ${total} transactions`;

  let html = '';

  // Prev Button
  html += `
    <button class="page-nav-btn" onclick="window.goToPage(${page - 1})" ${!hasPrevPage ? 'disabled' : ''}>
      ◀ Prev
    </button>
  `;

  // Page Numbers (sliding window of 5)
  const maxButtons = 5;
  let startPage = Math.max(1, page - Math.floor(maxButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  for (let p = startPage; p <= endPage; p++) {
    html += `
      <button class="page-nav-btn ${p === page ? 'active' : ''}" onclick="window.goToPage(${p})">
        ${p}
      </button>
    `;
  }

  // Next Button
  html += `
    <button class="page-nav-btn" onclick="window.goToPage(${page + 1})" ${!hasNextPage ? 'disabled' : ''}>
      Next ▶
    </button>
  `;

  btnContainer.innerHTML = html;
}

// Search Listener with Debounce
let searchTimeout;
function setupSearchListener() {
  const input = document.getElementById("searchInput");
  if (!input) return;

  input.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentSearch = e.target.value.trim();
      currentPage = 1;
      fetchTransactions();
    }, 300);
  });
}

// Filter triggers
window.setTypeFilter = function (type) {
  currentType = type;
  document.querySelectorAll(".type-tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.type === type);
  });

  const catSelect = document.getElementById("categoryFilter");
  if (catSelect) {
    if (type === "income") {
      catSelect.value = "";
      currentCategory = "";
      catSelect.disabled = true;
      catSelect.style.opacity = "0.4";
      catSelect.title = "Category filter applies to Expenses only";
    } else {
      catSelect.disabled = false;
      catSelect.style.opacity = "1";
      catSelect.title = "";
    }
  }

  currentPage = 1;
  fetchTransactions();
};

window.applyFilters = function () {
  currentCategory = document.getElementById("categoryFilter")?.value || '';
  currentDate = document.getElementById("dateFilter")?.value || '';
  currentStatus = document.getElementById("statusFilter")?.value || 'all';

  const sortVal = document.getElementById("sortFilter")?.value || 'date-desc';
  const [sBy, sOrd] = sortVal.split('-');
  currentSortBy = sBy;
  currentSortOrder = sOrd;

  currentPage = 1;
  fetchTransactions();
};

window.debouncedFilter = function () {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    currentMinAmount = document.getElementById("minAmountFilter")?.value || '';
    currentMaxAmount = document.getElementById("maxAmountFilter")?.value || '';
    currentPage = 1;
    fetchTransactions();
  }, 350);
};

window.resetFilters = function () {
  currentType = 'all';
  currentSearch = '';
  currentCategory = '';
  currentDate = '';
  currentMinAmount = '';
  currentMaxAmount = '';
  currentStatus = 'all';
  currentSortBy = 'date';
  currentSortOrder = 'desc';
  currentPage = 1;

  document.querySelectorAll(".type-tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.type === 'all');
  });

  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.value = '';

  const catFilter = document.getElementById("categoryFilter");
  if (catFilter) {
    catFilter.value = '';
    catFilter.disabled = false;
    catFilter.style.opacity = '1';
    catFilter.title = '';
  }

  const dateFilter = document.getElementById("dateFilter");
  if (dateFilter) dateFilter.value = '';

  const minAmt = document.getElementById("minAmountFilter");
  if (minAmt) minAmt.value = '';

  const maxAmt = document.getElementById("maxAmountFilter");
  if (maxAmt) maxAmt.value = '';

  const statusFilter = document.getElementById("statusFilter");
  if (statusFilter) statusFilter.value = 'all';

  const sortFilter = document.getElementById("sortFilter");
  if (sortFilter) sortFilter.value = 'date-desc';

  fetchTransactions();
};

window.changeLimit = function (newLimit) {
  currentLimit = parseInt(newLimit) || 10;
  currentPage = 1;
  fetchTransactions();
};

window.goToPage = function (page) {
  currentPage = page;
  fetchTransactions();
  window.scrollTo({ top: 160, behavior: 'smooth' });
};

window.toggleSort = function (column) {
  if (currentSortBy === column) {
    currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortBy = column;
    currentSortOrder = 'desc';
  }

  const sortSelect = document.getElementById("sortFilter");
  if (sortSelect) {
    sortSelect.value = `${currentSortBy}-${currentSortOrder}`;
  }

  const dateIcon = document.getElementById("sortIconDate");
  const amtIcon = document.getElementById("sortIconAmount");

  if (dateIcon) dateIcon.innerText = currentSortBy === 'date' ? (currentSortOrder === 'asc' ? '▲' : '▼') : '';
  if (amtIcon) amtIcon.innerText = currentSortBy === 'amount' ? (currentSortOrder === 'asc' ? '▲' : '▼') : '';

  currentPage = 1;
  fetchTransactions();
};

// Open Target Monthly Dashboard
window.openTargetMonthlyDashboard = function () {
  location.href = `/monthly?year=${targetYear}&month=${targetMonth}`;
};

// ---------------- EXCEL (.XLSX) EXPORT (RICH STYLED & COLORED) ----------------
window.downloadExcel = async function () {
  try {
    if (!window.XLSX) {
      alert("Excel library is loading, please try again in a moment.");
      return;
    }

    const queryParams = new URLSearchParams({
      year: targetYear,
      month: targetMonth,
      page: 1,
      limit: 5000,
      type: currentType,
      search: currentSearch,
      category: currentCategory,
      date: currentDate,
      minAmount: currentMinAmount,
      maxAmount: currentMaxAmount,
      status: currentStatus,
      sortBy: currentSortBy,
      sortOrder: currentSortOrder
    });

    const res = await apiRequest(`/expenses/transactions/paginated?${queryParams.toString()}`);
    const items = res.data.transactions || [];
    const kpis = res.data.kpis || {};

    if (items.length === 0) {
      alert("No transactions available to export.");
      return;
    }

    const monthName = monthNames[targetMonth - 1] || `Month ${targetMonth}`;

    // 1. Prepare Rows Data
    const aoa = [
      ["DHANREKHA - MONTHLY FINANCIAL STATEMENT"],
      [`Period: ${monthName} ${targetYear}   |   Generated On: ${new Date().toLocaleString('en-IN')}`],
      [],
      ["--- FINANCIAL SUMMARY ---"],
      ["", "Total Inflow (INR)", "Total Outflow (INR)", "Net Balance (INR)", "Total Records", ""],
      ["", Number(kpis.totalIncome || 0), Number(kpis.totalExpense || 0), Number(kpis.balance || 0), items.length, ""],
      [],
      ["--- TRANSACTION LEDGER ---"],
      ["Date", "Type", "Category", "Description / Source", "Amount (INR)", "Status"]
    ];

    const dataStartRow = 9; // 0-indexed: row 10 in Excel

    items.forEach(t => {
      const isIncome = t.type === 'income';
      aoa.push([
        new Date(t.date).toISOString().split('T')[0],
        isIncome ? "INFLOW" : "EXPENSE",
        isIncome ? "-" : (t.category || "-"),
        t.description || (isIncome ? "Income" : "-"),
        Number(t.amount || 0),
        t.isOverBudget ? "Over Budget" : "Normal"
      ]);
    });

    const dataEndRow = dataStartRow + items.length - 1;

    // Bottom Summary
    aoa.push([]);
    const summaryInflowRow = aoa.length;
    aoa.push(["", "", "", "TOTAL INFLOW", Number(kpis.totalIncome || 0), ""]);
    const summaryOutflowRow = aoa.length;
    aoa.push(["", "", "", "TOTAL OUTFLOW", Number(kpis.totalExpense || 0), ""]);
    const summaryNetRow = aoa.length;
    aoa.push(["", "", "", "NET BALANCE", Number(kpis.balance || 0), ""]);

    // 2. Convert to worksheet
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // 3. Merges for Banners
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // Row 1 Title
      { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }, // Row 2 Subtitle
      { s: { r: 3, c: 0 }, e: { r: 3, c: 5 } }, // Financial summary title
      { s: { r: 7, c: 0 }, e: { r: 7, c: 5 } }  // Ledger title
    ];

    // Helper to style cells
    function setStyle(r, c, style, numFmt) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
      ws[cellRef].s = style;
      if (numFmt) ws[cellRef].z = numFmt;
    }

    const thinBorder = {
      top: { style: "thin", color: { rgb: "E2E8F0" } },
      bottom: { style: "thin", color: { rgb: "E2E8F0" } },
      left: { style: "thin", color: { rgb: "E2E8F0" } },
      right: { style: "thin", color: { rgb: "E2E8F0" } }
    };

    // --- STYLE ROW 0 (Main Title Banner: Deep Emerald) ---
    for (let c = 0; c <= 5; c++) {
      setStyle(0, c, {
        fill: { fgColor: { rgb: "064E3B" } },
        font: { name: "Segoe UI", sz: 16, bold: true, color: { rgb: "FFFFFF" } },
        alignment: { horizontal: "center", vertical: "center" }
      });
    }

    // --- STYLE ROW 1 (Subtitle: Medium Emerald) ---
    for (let c = 0; c <= 5; c++) {
      setStyle(1, c, {
        fill: { fgColor: { rgb: "047857" } },
        font: { name: "Segoe UI", sz: 10, italic: true, color: { rgb: "D1FAE5" } },
        alignment: { horizontal: "center", vertical: "center" }
      });
    }

    // --- STYLE ROW 3 (Summary Section Title: Slate 800) ---
    for (let c = 0; c <= 5; c++) {
      setStyle(3, c, {
        fill: { fgColor: { rgb: "1E293B" } },
        font: { name: "Segoe UI", sz: 11, bold: true, color: { rgb: "F8FAFC" } },
        alignment: { horizontal: "center", vertical: "center" }
      });
    }

    // --- STYLE ROW 4 & 5 (KPI Cards) ---
    // Total Inflow Card (Col B)
    setStyle(4, 1, {
      fill: { fgColor: { rgb: "DCFCE7" } },
      font: { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "15803D" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: thinBorder
    });
    setStyle(5, 1, {
      fill: { fgColor: { rgb: "DCFCE7" } },
      font: { name: "Segoe UI", sz: 14, bold: true, color: { rgb: "15803D" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: thinBorder
    }, "₹#,##0.00");

    // Total Outflow Card (Col C)
    setStyle(4, 2, {
      fill: { fgColor: { rgb: "FFE4E6" } },
      font: { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "BE123C" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: thinBorder
    });
    setStyle(5, 2, {
      fill: { fgColor: { rgb: "FFE4E6" } },
      font: { name: "Segoe UI", sz: 14, bold: true, color: { rgb: "BE123C" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: thinBorder
    }, "₹#,##0.00");

    // Net Balance Card (Col D)
    setStyle(4, 3, {
      fill: { fgColor: { rgb: "E0F2FE" } },
      font: { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "0369A1" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: thinBorder
    });
    setStyle(5, 3, {
      fill: { fgColor: { rgb: "E0F2FE" } },
      font: { name: "Segoe UI", sz: 14, bold: true, color: { rgb: "0369A1" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: thinBorder
    }, "₹#,##0.00");

    // Total Transactions Card (Col E)
    setStyle(4, 4, {
      fill: { fgColor: { rgb: "F3E8FF" } },
      font: { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "7E22CE" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: thinBorder
    });
    setStyle(5, 4, {
      fill: { fgColor: { rgb: "F3E8FF" } },
      font: { name: "Segoe UI", sz: 14, bold: true, color: { rgb: "7E22CE" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: thinBorder
    });

    // --- STYLE ROW 7 (Ledger Title: Obsidian/Sky) ---
    for (let c = 0; c <= 5; c++) {
      setStyle(7, c, {
        fill: { fgColor: { rgb: "0F172A" } },
        font: { name: "Segoe UI", sz: 11, bold: true, color: { rgb: "38BDF8" } },
        alignment: { horizontal: "center", vertical: "center" }
      });
    }

    // --- STYLE ROW 8 (Table Column Headers: Emerald Gradient) ---
    for (let c = 0; c <= 5; c++) {
      setStyle(8, c, {
        fill: { fgColor: { rgb: "059669" } },
        font: { name: "Segoe UI", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
        alignment: { horizontal: c === 3 ? "left" : (c === 4 ? "right" : "center"), vertical: "center" },
        border: {
          top: { style: "medium", color: { rgb: "047857" } },
          bottom: { style: "medium", color: { rgb: "047857" } },
          left: { style: "thin", color: { rgb: "047857" } },
          right: { style: "thin", color: { rgb: "047857" } }
        }
      });
    }

    // --- STYLE DATA ROWS ---
    for (let i = 0; i < items.length; i++) {
      const r = dataStartRow + i;
      const t = items[i];
      const isIncome = t.type === 'income';
      const rowBg = i % 2 === 0 ? "FFFFFF" : "F8FAFC";

      // Col 0: Date
      setStyle(r, 0, {
        fill: { fgColor: { rgb: rowBg } },
        font: { name: "Segoe UI", sz: 10, color: { rgb: "334155" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: thinBorder
      });

      // Col 1: Type Pill
      setStyle(r, 1, {
        fill: { fgColor: { rgb: isIncome ? "DCFCE7" : "FFE4E6" } },
        font: { name: "Segoe UI", sz: 10, bold: true, color: { rgb: isIncome ? "15803D" : "BE123C" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: thinBorder
      });

      // Col 2: Category
      setStyle(r, 2, {
        fill: { fgColor: { rgb: rowBg } },
        font: { name: "Segoe UI", sz: 10, bold: !isIncome, color: { rgb: isIncome ? "94A3B8" : "1E293B" } },
        alignment: { horizontal: isIncome ? "center" : "left", vertical: "center" },
        border: thinBorder
      });

      // Col 3: Description / Source
      setStyle(r, 3, {
        fill: { fgColor: { rgb: rowBg } },
        font: { name: "Segoe UI", sz: 10, color: { rgb: "334155" } },
        alignment: { horizontal: "left", vertical: "center" },
        border: thinBorder
      });

      // Col 4: Amount
      setStyle(r, 4, {
        fill: { fgColor: { rgb: isIncome ? "F0FDF4" : "FEF2F2" } },
        font: { name: "Segoe UI", sz: 10.5, bold: true, color: { rgb: isIncome ? "16A34A" : "DC2626" } },
        alignment: { horizontal: "right", vertical: "center" },
        border: thinBorder
      }, "₹#,##0.00");

      // Col 5: Status
      setStyle(r, 5, {
        fill: { fgColor: { rgb: t.isOverBudget ? "FEF3C7" : rowBg } },
        font: { name: "Segoe UI", sz: 9.5, bold: t.isOverBudget, color: { rgb: t.isOverBudget ? "B45309" : "64748B" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: thinBorder
      });
    }

    // --- STYLE TOTALS ROWS AT BOTTOM ---
    // Total Inflow
    setStyle(summaryInflowRow, 3, {
      font: { name: "Segoe UI", sz: 11, bold: true, color: { rgb: "15803D" } },
      alignment: { horizontal: "right", vertical: "center" }
    });
    setStyle(summaryInflowRow, 4, {
      fill: { fgColor: { rgb: "DCFCE7" } },
      font: { name: "Segoe UI", sz: 11, bold: true, color: { rgb: "15803D" } },
      alignment: { horizontal: "right", vertical: "center" },
      border: thinBorder
    }, "₹#,##0.00");

    // Total Outflow
    setStyle(summaryOutflowRow, 3, {
      font: { name: "Segoe UI", sz: 11, bold: true, color: { rgb: "BE123C" } },
      alignment: { horizontal: "right", vertical: "center" }
    });
    setStyle(summaryOutflowRow, 4, {
      fill: { fgColor: { rgb: "FFE4E6" } },
      font: { name: "Segoe UI", sz: 11, bold: true, color: { rgb: "BE123C" } },
      alignment: { horizontal: "right", vertical: "center" },
      border: thinBorder
    }, "₹#,##0.00");

    // Net Balance
    setStyle(summaryNetRow, 3, {
      font: { name: "Segoe UI", sz: 12, bold: true, color: { rgb: "0369A1" } },
      alignment: { horizontal: "right", vertical: "center" }
    });
    setStyle(summaryNetRow, 4, {
      fill: { fgColor: { rgb: "E0F2FE" } },
      font: { name: "Segoe UI", sz: 12, bold: true, color: { rgb: "0369A1" } },
      alignment: { horizontal: "right", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "0284C7" } },
        bottom: { style: "double", color: { rgb: "0284C7" } },
        left: { style: "thin", color: { rgb: "0284C7" } },
        right: { style: "thin", color: { rgb: "0284C7" } }
      }
    }, "₹#,##0.00");

    // 4. Column Widths
    ws['!cols'] = [
      { wch: 14 }, // Date
      { wch: 14 }, // Type
      { wch: 22 }, // Category
      { wch: 42 }, // Description / Source
      { wch: 20 }, // Amount
      { wch: 16 }  // Status
    ];

    // 5. Row Heights for spacing
    ws['!rows'] = [
      { hpt: 32 }, // Row 1 Title
      { hpt: 20 }, // Row 2 Subtitle
      { hpt: 8 },  // Blank
      { hpt: 22 }, // Summary Title
      { hpt: 22 }, // KPI Headers
      { hpt: 26 }, // KPI Values
      { hpt: 10 }, // Blank
      { hpt: 22 }, // Ledger Title
      { hpt: 26 }  // Table Header
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${monthName}_${targetYear}`);

    XLSX.writeFile(wb, `DhanRekha_Statement_${targetYear}_${String(targetMonth).padStart(2, '0')}.xlsx`);
  } catch (err) {
    alert(`Export Excel failed: ${err.message}`);
  }
};

// ---------------- PDF EXPORT ----------------
window.downloadPDF = async function () {
  try {
    if (!window.jspdf) {
      alert("PDF library is still loading. Please try again in a moment.");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");

    const queryParams = new URLSearchParams({
      year: targetYear,
      month: targetMonth,
      page: 1,
      limit: 5000,
      type: currentType,
      search: currentSearch,
      category: currentCategory,
      date: currentDate,
      minAmount: currentMinAmount,
      maxAmount: currentMaxAmount,
      status: currentStatus,
      sortBy: currentSortBy,
      sortOrder: currentSortOrder
    });

    const res = await apiRequest(`/expenses/transactions/paginated?${queryParams.toString()}`);
    const items = res.data.transactions || [];
    const kpis = res.data.kpis || {};

    const monthName = monthNames[targetMonth - 1] || `Month ${targetMonth}`;

    // Dark Accent Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 32, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(34, 197, 94);
    doc.text("DhanRekha", 14, 14);

    doc.setFontSize(11);
    doc.setTextColor(241, 245, 249);
    doc.text(`Transaction Statement – ${monthName} ${targetYear}`, 14, 22);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 28);

    // Summary Stripe
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`Inflow: INR ${formatINR(kpis.totalIncome || 0)}   |   Outflow: INR ${formatINR(kpis.totalExpense || 0)}   |   Net: INR ${formatINR(kpis.balance || 0)}   |   Total: ${items.length} records`, 14, 40);

    // Table Rows
    const tableData = items.map(t => {
      const isIncome = t.type === 'income';
      return [
        new Date(t.date).toLocaleDateString('en-IN'),
        t.type.toUpperCase(),
        isIncome ? '-' : (t.category || '-'),
        t.description || '-',
        `${isIncome ? '+' : '-'}INR ${formatINR(t.amount)}`,
        t.isOverBudget ? 'Over Budget' : 'Normal'
      ];
    });

    doc.autoTable({
      startY: 45,
      head: [["Date", "Type", "Category", "Description", "Amount", "Status"]],
      body: tableData,
      theme: "grid",
      headStyles: {
        fillColor: [34, 197, 94],
        textColor: [5, 46, 22],
        fontStyle: "bold"
      },
      styles: {
        fontSize: 8,
        cellPadding: 3
      },
      columnStyles: {
        4: { halign: 'right', fontStyle: 'bold' }
      },
      didDrawPage: (data) => {
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(`Page ${data.pageNumber} of ${pageCount}`, 200, 290, { align: "right" });
      }
    });

    doc.save(`DhanRekha_Statement_${monthName}_${targetYear}.pdf`);
  } catch (err) {
    alert(`Export PDF failed: ${err.message}`);
  }
};

function formatINR(val) {
  return Number(val || 0).toLocaleString('en-IN');
}
