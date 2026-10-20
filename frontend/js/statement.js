import { apiRequest } from "./api.js";

/* ===================================================
   URL PARAMETERS & AUTH VALIDATION
=================================================== */
const urlParams = new URLSearchParams(window.location.search);
const queryStart = urlParams.get("startDate") || urlParams.get("from");
const queryEnd = urlParams.get("endDate") || urlParams.get("to");
const queryPage = parseInt(urlParams.get("page"), 10) || 1;
const queryLimit = parseInt(urlParams.get("limit"), 10) || 10;
const queryToken = urlParams.get("token") || urlParams.get("access_token");

if (queryToken && queryToken.trim()) {
  localStorage.setItem("token", queryToken.trim());
}

/* ===================================================
   STATE & DOM CACHE
=================================================== */
let currentUser = null;
let userJoinDate = new Date();
let currentTransactions = [];
let currentSummary = { income: 0, expense: 0, balance: 0 };
let currentPage = queryPage;
let currentLimit = queryLimit;

const startDateInput = document.getElementById("startDate");
const endDateInput = document.getElementById("endDate");
const fetchBtn = document.getElementById("fetchBtn");
const fetchBtnText = document.getElementById("fetchBtnText");
const fetchBtnIcon = document.getElementById("fetchBtnIcon");
const dateAlertBox = document.getElementById("dateAlertBox");
const dateAlertMsg = document.getElementById("dateAlertMsg");
let earliestHistoricalDate = new Date("1990-01-01");

const kpiSection = document.getElementById("kpiSection");
const totalInflowDisplay = document.getElementById("totalInflowDisplay");
const totalOutflowDisplay = document.getElementById("totalOutflowDisplay");
const netBalanceDisplay = document.getElementById("netBalanceDisplay");
const totalInflowCountDisplay = document.getElementById("totalInflowCountDisplay");
const totalOutflowCountDisplay = document.getElementById("totalOutflowCountDisplay");

const tableSection = document.getElementById("tableSection");
const resultsPeriodText = document.getElementById("resultsPeriodText");
const recordsCountDisplay = document.getElementById("recordsCountDisplay");
const statementTableBody = document.getElementById("statementTableBody");
const downloadPdfBtn = document.getElementById("downloadPdfBtn");
const emptySection = document.getElementById("emptySection");

/* ===================================================
   HELPER UTILITIES
=================================================== */
function formatINR(amount) {
  return Number(amount || 0).toLocaleString("en-IN");
}

function fmtDate(d) {
  if (!d) return "";
  const dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return "";
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = dateObj.toLocaleString('en-IN', { month: 'short' });
  const year = dateObj.getFullYear();
  return `${day} ${month} ${year}`;
}

function fmtISO(d) {
  const dateObj = d instanceof Date ? d : new Date(d);
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
      canvas.width = size;
      canvas.height = size;

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

function showToast(message, type = "info") {
  let toast = document.getElementById("statement-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "statement-toast";
    document.body.appendChild(toast);
  }

  const bg = type === "success" ? "rgba(34, 197, 94, 0.94)" :
    type === "error" ? "rgba(239, 68, 68, 0.94)" :
      "rgba(14, 165, 233, 0.94)";

  Object.assign(toast.style, {
    position: "fixed",
    bottom: "28px",
    left: "50%",
    transform: "translateX(-50%) translateY(0)",
    background: bg,
    backdropFilter: "blur(14px)",
    border: "1px solid rgba(255, 255, 255, 0.25)",
    color: "#fff",
    padding: "10px 20px",
    borderRadius: "12px",
    fontSize: "0.88rem",
    fontWeight: "600",
    zIndex: "999999",
    boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
    transition: "all 0.3s ease",
    opacity: "1",
    pointerEvents: "none"
  });

  toast.innerText = message;
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(16px)";
  }, 3200);
}

/* ===================================================
   DATE RANGE VALIDATION
=================================================== */
function validateDates() {
  const startVal = startDateInput.value;
  const endVal = endDateInput.value;
  const maxVal = endDateInput.max;

  startDateInput.classList.remove("invalid-input");
  endDateInput.classList.remove("invalid-input");
  dateAlertBox.style.display = "none";

  if (!startVal || !endVal) {
    showDateError("Please select both a Start Date and an End Date.");
    return false;
  }

  if (maxVal && endVal > maxVal) {
    endDateInput.classList.add("invalid-input");
    showDateError(`End Date cannot be greater than today (${fmtDate(maxVal)}).`);
    return false;
  }

  if (startVal > endVal) {
    startDateInput.classList.add("invalid-input");
    endDateInput.classList.add("invalid-input");
    showDateError("Start Date cannot be after End Date.");
    return false;
  }

  return true;
}

function showDateError(msg) {
  dateAlertMsg.innerText = msg;
  dateAlertBox.style.display = "flex";
}

/* ===================================================
   INITIALIZATION & ACCOUNT BOUNDARIES
=================================================== */
async function initPage() {
  try {
    // 1. Fetch Logged-in User Profile to retrieve Join Date & verify token
    const meRes = await apiRequest("/auth/me", "GET", null, { skipLoader: true });
    currentUser = meRes?.data || {};

    // Display dynamic user first name in navbar (before first space, matching patches page)
    const userNameHeader = document.getElementById("userNameHeader");
    if (userNameHeader) {
      const rawName = currentUser.name || localStorage.getItem("userName") || "";
      if (rawName) {
        localStorage.setItem("userName", rawName);
        const firstName = rawName.trim().split(/\s+/)[0];
        userNameHeader.textContent = firstName;
      }
    }

    // Display verified session indicator in header
    const authBadge = document.getElementById("authSessionBadge");
    const authUserDisplay = document.getElementById("authUserDisplay");
    if (authBadge && authUserDisplay) {
      authUserDisplay.innerText = currentUser.email ? `Verified: ${currentUser.email}` : "Authenticated Session";
      authBadge.style.display = "inline-flex";
    }

    let regDateRaw = currentUser.createdAt;
    if (!regDateRaw && currentUser._id) {
      regDateRaw = new Date(parseInt(String(currentUser._id).substring(0, 8), 16) * 1000);
    }
    userJoinDate = regDateRaw ? new Date(regDateRaw) : new Date();

    const today = new Date();
    const todayStr = fmtISO(today);

    // No min restriction on dates. Only restrict max date to today.
    startDateInput.removeAttribute("min");
    endDateInput.removeAttribute("min");
    startDateInput.max = todayStr;
    endDateInput.max = todayStr;

    // Apply pagination from query params if specified
    currentPage = queryPage;
    currentLimit = queryLimit;
    const limitSelectEl = document.getElementById("limitSelect");
    if (limitSelectEl) {
      limitSelectEl.value = String(currentLimit);
    }

    // Determine target date range (defaults to 1990-01-01 to avoid heavy queries for user's earliest transaction)
    const defaultStartDate = "1990-01-01";
    let targetStart = queryStart || defaultStartDate;
    let targetEnd = queryEnd || todayStr;

    earliestHistoricalDate = new Date(defaultStartDate);

    startDateInput.value = targetStart;
    endDateInput.value = targetEnd;

    updateURLParams();

    // Do NOT load all data at once on tab click / initial load.
    // Only serve from server when user explicitly clicks "Fetch Statement" (or explicitly provides autoFetch=true).
    const autoFetch = urlParams.get("autoFetch") === "true";
    if (autoFetch) {
      await fetchStatementData();
    } else {
      const initialPlaceholder = document.getElementById("initialFetchPlaceholder");
      if (initialPlaceholder) initialPlaceholder.style.display = "block";
      if (kpiSection) kpiSection.style.display = "none";
      if (tableSection) tableSection.style.display = "none";
      if (emptySection) emptySection.style.display = "none";
    }

  } catch (err) {
    console.error("Init Error:", err);
    showToast("Failed to initialize statement: " + err.message, "error");
  }
}

/* ===================================================
   URL PARAMETERS SYNCHRONIZATION
=================================================== */
function updateURLParams() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (startDateInput.value) params.set("startDate", startDateInput.value);
    if (endDateInput.value) params.set("endDate", endDateInput.value);
    params.set("page", String(currentPage));
    params.set("limit", String(currentLimit));

    const token = localStorage.getItem("token");
    if (token && (params.has("token") || params.has("access_token"))) {
      params.set("token", token);
    }

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", newUrl);
  } catch (e) {
    console.warn("Could not update URL parameters", e);
  }
}

/* ===================================================
   FETCH STATEMENT DATA
=================================================== */
async function fetchStatementData() {
  if (!validateDates()) return;

  const startDate = startDateInput.value;
  const endDate = endDateInput.value;

  const initialPlaceholder = document.getElementById("initialFetchPlaceholder");
  if (initialPlaceholder) initialPlaceholder.style.display = "none";
  if (emptySection) emptySection.style.display = "none";

  fetchBtn.disabled = true;
  fetchBtnText.innerText = "Fetching Records...";
  fetchBtnIcon.innerHTML = `<span class="spinner"></span>`;

  try {
    const [expRes, incRes] = await Promise.all([
      apiRequest(`/expenses?startDate=${startDate}&endDate=${endDate}`, "GET", null, { skipLoader: true }),
      apiRequest(`/income?startDate=${startDate}&endDate=${endDate}`, "GET", null, { skipLoader: true })
    ]);

    const expenses = expRes?.data || [];
    const incomes = incRes?.data || [];

    const combined = [];
    let totalExpense = 0;
    let totalIncome = 0;

    let expenseCount = 0;
    let incomeCount = 0;

    expenses.forEach(e => {
      const amt = Number(e.amount || 0);
      totalExpense += amt;
      expenseCount++;
      combined.push({
        date: new Date(e.date),
        type: "EXPENSE",
        category: e.category || "General",
        amount: amt,
        description: e.description || ""
      });
    });

    incomes.forEach(i => {
      const amt = Number(i.amount || 0);
      totalIncome += amt;
      incomeCount++;
      combined.push({
        date: new Date(i.date),
        type: "INCOME",
        category: "Income", // Standardized to "Income" as requested
        amount: amt,
        description: i.source || i.description || ""
      });
    });

    // Chronological Sort: Oldest to Newest
    combined.sort((a, b) => a.date - b.date);

    currentTransactions = combined;
    currentPage = 1;
    currentSummary = {
      income: totalIncome,
      expense: totalExpense,
      balance: totalIncome - totalExpense,
      expenseCount: expenseCount,
      incomeCount: incomeCount,
      totalCount: currentTransactions.length,
    };

    renderResults(startDate, endDate);
    updateURLParams();

  } catch (err) {
    console.error("Fetch statement error:", err);
    showToast("Failed to fetch statement records: " + err.message, "error");
  } finally {
    fetchBtn.disabled = false;
    fetchBtnText.innerText = "Fetch Statement";
    fetchBtnIcon.innerText = "🔍";
  }
}

/* ===================================================
   RENDER RESULTS (KPI, TABLE & PAGINATION)
=================================================== */
function renderResults(startDate, endDate) {
  const { income, expense, balance, expenseCount, incomeCount } = currentSummary;

  // 1. Update KPI Section
  totalInflowDisplay.innerText = formatINR(income);
  totalInflowCountDisplay.innerText = `${incomeCount} items`;
  totalOutflowDisplay.innerText = formatINR(expense);
  totalOutflowCountDisplay.innerText = `${expenseCount} items`;
  netBalanceDisplay.innerText = `${balance >= 0 ? '+' : '-'}${formatINR(Math.abs(balance))}`;
  netBalanceDisplay.className = `kpi-value ${balance >= 0 ? 'kpi-inflow' : 'kpi-outflow'}`;
  kpiSection.style.display = "grid";

  // 2. Results Header
  resultsPeriodText.innerText = `Statement Period: ${fmtDate(startDate)} — ${fmtDate(endDate)}`;
  recordsCountDisplay.innerText = `${currentTransactions.length} items`;

  // 3. Render Paginated Table and Controls
  renderTableRows();
  renderPagination();
}

function renderTableRows() {
  if (currentTransactions.length === 0) {
    tableSection.style.display = "none";
    emptySection.style.display = "block";
    return;
  }

  emptySection.style.display = "none";
  tableSection.style.display = "block";

  const startIdx = (currentPage - 1) * currentLimit;
  const pageItems = currentTransactions.slice(startIdx, startIdx + currentLimit);

  // Construct pure HTML rows with tr and td tags (#, Date, Category, Amount)
  let html = "";
  pageItems.forEach((tx, idx) => {
    const isIncome = tx.type === "INCOME";
    const amountClass = isIncome ? "amount-inflow" : "amount-outflow";
    const amountColor = isIncome ? "#22c55e" : "#ef4444";

    html += `
      <tr style="animation-delay: ${Math.min(idx * 0.02, 0.4)}s;">
        <td style="color: #64748b; font-size: 0.82rem;">${startIdx + idx + 1}</td>
        <td style="font-weight: 500;">${fmtDate(tx.date)}</td>
        <td style="color: #f1f5f9;">${tx.category}</td>
        <td class="amount-cell ${amountClass}" style="color: ${amountColor} !important;">${formatINR(tx.amount)}</td>
        <td style="color: #f1f5f9;">${tx.description || '-'}</td>  
      </tr>
    `;
  });

  statementTableBody.innerHTML = html;
}

function renderPagination() {
  const infoEl = document.getElementById("paginationInfo");
  const btnContainer = document.getElementById("paginationButtons");
  const barEl = document.getElementById("paginationBar");

  if (!infoEl || !btnContainer || !barEl) return;

  const total = currentTransactions.length;
  if (total === 0) {
    barEl.style.display = "none";
    return;
  }

  barEl.style.display = "flex";

  const totalPages = Math.ceil(total / currentLimit) || 1;
  const startIdx = (currentPage - 1) * currentLimit + 1;
  const endIdx = Math.min(currentPage * currentLimit, total);

  infoEl.innerText = `Showing ${startIdx}–${endIdx} of ${total} transactions`;

  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  let html = `
    <button class="page-nav-btn" onclick="window.goToPage(${currentPage - 1})" ${!hasPrev ? 'disabled' : ''}>
      ◀ Prev
    </button>
  `;

  // Sliding window of 5 buttons (Matching /transactions)
  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  for (let p = startPage; p <= endPage; p++) {
    html += `
      <button class="page-nav-btn ${p === currentPage ? 'active' : ''}" onclick="window.goToPage(${p})">
        ${p}
      </button>
    `;
  }

  html += `
    <button class="page-nav-btn" onclick="window.goToPage(${currentPage + 1})" ${!hasNext ? 'disabled' : ''}>
      Next ▶
    </button>
  `;

  btnContainer.innerHTML = html;
}

window.goToPage = function (page) {
  const totalPages = Math.ceil(currentTransactions.length / currentLimit) || 1;
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  updateURLParams();
  renderTableRows();
  renderPagination();
};

window.changeLimit = function (limit) {
  currentLimit = Number(limit) || 10;
  currentPage = 1;
  updateURLParams();
  renderTableRows();
  renderPagination();
};

/* ===================================================
   PRESET BUTTONS HANDLER
=================================================== */
function setupPresets() {
  const presetButtons = document.querySelectorAll(".preset-pill");
  presetButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      presetButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const preset = btn.getAttribute("data-preset");
      const today = new Date();
      const todayStr = fmtISO(today);

      let targetStart = "1990-01-01";

      if (preset === "all") {
        targetStart = "1990-01-01";
      } else if (preset === "month") {
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        targetStart = fmtISO(monthStart);
      } else if (preset === "last30") {
        const last30 = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
        targetStart = fmtISO(last30);
      } else if (preset === "year") {
        const yearStart = new Date(today.getFullYear(), 0, 1);
        targetStart = fmtISO(yearStart);
      }

      startDateInput.value = targetStart;
      endDateInput.value = todayStr;
      currentPage = 1;

      validateDates();
      updateURLParams();

      // If user has already loaded transactions, refresh the view for the new preset.
      // Otherwise keep in ready state and let user click 'Fetch Statement'.
      if (currentTransactions.length > 0) {
        fetchStatementData();
      }
    });
  });
}

/* ===================================================
   PDF GENERATION (EXACT SAME MODERN FORMAT)
=================================================== */
async function downloadStatementPDF() {
  if (currentTransactions.length === 0) {
    showToast("No transactions to generate PDF statement.", "error");
    return;
  }

  showToast("Generating PDF statement...", "info");

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");

    const startDate = new Date(startDateInput.value);
    const endDate = new Date(endDateInput.value);
    const periodStr = `${fmtDate(startDate)}  —  ${fmtDate(endDate)}`;

    const userName = currentUser?.name || "User";
    const userEmail = currentUser?.email || "";
    const joinDateStr = fmtDate(userJoinDate);

    // Assets
    let avatarBase64 = null;
    const userAvatar = currentUser?.avatar || localStorage.getItem("userAvatar");
    if (userAvatar) {
      try {
        avatarBase64 = await toCircularDataURL(userAvatar);
      } catch (e) {
        console.warn("Avatar conversion failed", e);
      }
    }

    let logoBase64 = null;
    try {
      logoBase64 = await toDataURL("assets/logo1.png");
    } catch (e) {
      console.warn("Logo conversion failed", e);
    }

    const addWatermark = (pDoc) => {
      pDoc.saveGraphicsState();
      pDoc.setFontSize(38);
      pDoc.setTextColor(230, 230, 230);
      pDoc.setFont("helvetica", "bold");
      pDoc.setGState(new pDoc.GState({ opacity: 0.08 }));
      pDoc.text("DHANREKHA VERIFIED", 105, 150, { align: "center", angle: 45 });
      pDoc.restoreGraphicsState();
    };

    /* ===================================================
       PAGE 1: COVER PAGE
    =================================================== */
    doc.setFillColor(15, 32, 39);
    doc.rect(0, 0, 210, 297, "F");

    // Decorative Green Accent
    doc.setFillColor(34, 197, 94);
    doc.triangle(160, 297, 210, 297, 210, 240, "F");

    if (logoBase64) {
      try { doc.addImage(logoBase64, "PNG", 85, 38, 40, 40); } catch { }
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(38);
    doc.text("DhanRekha", 105, 96, { align: "center" });

    doc.setDrawColor(255, 255, 255, 0.2);
    doc.setLineWidth(0.5);
    doc.line(65, 106, 145, 106);

    doc.setFontSize(15);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(134, 239, 172);
    doc.text(periodStr, 105, 118, { align: "center" });

    // User Avatar Frame
    const avatarY = 175;
    doc.setDrawColor(34, 197, 94);
    doc.setLineWidth(1.5);
    doc.circle(105, avatarY, 26, "S");

    if (avatarBase64) {
      try { doc.addImage(avatarBase64, "PNG", 81, avatarY - 24, 48, 48); } catch { }
    } else {
      doc.setFillColor(200, 200, 200);
      doc.circle(105, avatarY - 8, 8, "F");
      doc.ellipse(105, avatarY + 12, 16, 10, "F");
    }

    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(userName, 105, avatarY + 42, { align: "center" });

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(160, 160, 160);
    doc.text(userEmail, 105, avatarY + 50, { align: "center" });

    // User joining date below email
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(134, 239, 172);
    doc.text(`Joined on ${joinDateStr}`, 105, avatarY + 58, { align: "center" });

    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated on ${new Date().toLocaleString("en-IN")}`, 105, 275, { align: "center" });
    doc.text("DhanRekha • Where Your Money Tells a Story", 105, 282, { align: "center" });

    /* ===================================================
       PAGE 2: EXECUTIVE SUMMARY & TRANSACTION LEDGER
    =================================================== */
    doc.addPage();
    addWatermark(doc);

    // Top Header
    doc.setFillColor(15, 32, 39);
    doc.rect(0, 0, 210, 32, "F");

    if (logoBase64) {
      try { doc.addImage(logoBase64, "PNG", 14, 5, 22, 22); } catch { }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(34, 197, 94);
    doc.text("DhanRekha", 42, 21);

    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(periodStr, 196, 21, { align: "right" });

    // Summary KPI Container
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 38, 182, 25, 3, 3, "FD");

    // Total Income (CR)
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("TOTAL INCOME (CR)", 22, 47);
    doc.setFontSize(11);
    doc.setTextColor(22, 163, 74);
    doc.text(formatINR(currentSummary.income), 22, 56);

    // Total Debit (DR)
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text("TOTAL DEBIT (DR)", 82, 47);
    doc.setFontSize(11);
    doc.setTextColor(220, 38, 38);
    doc.text(formatINR(currentSummary.expense), 82, 56);

    // Net Balance
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text("NET BALANCE", 144, 47);
    doc.setFontSize(11);
    doc.setTextColor(currentSummary.balance >= 0 ? 22 : 220, currentSummary.balance >= 0 ? 163 : 38, currentSummary.balance >= 0 ? 74 : 38);
    doc.text(`${currentSummary.balance >= 0 ? '+' : '-'}${formatINR(Math.abs(currentSummary.balance))}`, 144, 56);

    // Clean table rows: Date | Category | Amount
    const tableRows = currentTransactions.map(item => {
      return [
        fmtDate(item.date),
        item.category,
        formatINR(item.amount)
      ];
    });

    doc.autoTable({
      startY: 69,
      head: [["Date", "Category", "Amount"]],
      body: tableRows,
      theme: "grid",
      headStyles: {
        fillColor: [15, 32, 39],
        textColor: [34, 197, 94],
        fontStyle: "bold",
        fontSize: 9.5,
        halign: "left"
      },
      columnStyles: {
        0: { cellWidth: 42, halign: "left" },
        1: { cellWidth: "auto", halign: "left" },
        2: { cellWidth: 46, halign: "right", fontStyle: "bold" }
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 3,
        textColor: [30, 41, 59]
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      didParseCell: function (data) {
        if (data.section === 'body' && data.column.index === 2) {
          const item = currentTransactions[data.row.index];
          if (item?.type === "INCOME") {
            data.cell.styles.textColor = [22, 163, 74];
          } else {
            data.cell.styles.textColor = [220, 38, 38];
          }
        }
      },
      didDrawPage: function (data) {
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Page ${data.pageNumber} • DhanRekha Statement`,
          105,
          doc.internal.pageSize.getHeight() - 8,
          { align: "center" }
        );
      }
    });

    const startStr = fmtISO(startDate);
    const endStr = fmtISO(endDate);
    const filename = `DhanRekha_Statement_${startStr}_to_${endStr}.pdf`;
    doc.save(filename);
    showToast("Statement downloaded successfully!", "success");

  } catch (err) {
    console.error("PDF generation failed:", err);
    showToast("Failed to generate PDF: " + err.message, "error");
  }
}

/* ===================================================
   EVENT LISTENERS
=================================================== */
document.addEventListener("DOMContentLoaded", () => {
  // Instant render from localStorage before async fetch completes
  try {
    const cached = localStorage.getItem("userName");
    if (cached) {
      const el = document.getElementById("userNameHeader");
      const firstName = cached.trim().split(/\s+/)[0];
      if (el && firstName) el.textContent = firstName;
    }
  } catch (e) { /* ignore */ }

  initPage();
  setupPresets();

  fetchBtn.addEventListener("click", fetchStatementData);
  downloadPdfBtn.addEventListener("click", downloadStatementPDF);

  startDateInput.addEventListener("change", validateDates);
  endDateInput.addEventListener("change", validateDates);

  const limitSelectEl = document.getElementById("limitSelect");
  if (limitSelectEl) {
    limitSelectEl.addEventListener("change", (e) => window.changeLimit(e.target.value));
  }
});
