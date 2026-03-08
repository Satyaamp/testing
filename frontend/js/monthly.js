import { apiRequest } from "./api.js";


/* ===============================
   GLOBAL ELEMENTS
================================ */
const mobileDayScroll = document.getElementById("mobile-day-scroll");
const mobileListContainer = document.getElementById("mobile-transaction-list");
const mobileMonthText = document.getElementById("mobileMonthText");
const pageMonthTitle = document.getElementById("pageMonthTitle");
const calendarViewMonthTitle = document.getElementById("calendarViewMonthTitle");
const backToTopBtn = document.getElementById("backToTopBtn");
const histogramSort = document.getElementById("histogramSort");
const prevMonthBtn = document.getElementById("prevMonthBtn");
const nextMonthBtn = document.getElementById("nextMonthBtn");
const monthSelectModal = document.getElementById("monthSelectModal");
const modalYearDisplay = document.getElementById("modalYearDisplay");
const modalMonthGrid = document.getElementById("modalMonthGrid");
const monthTxCount = document.getElementById("monthTxCount");
const monthTxCountMobile = document.getElementById("monthTxCountMobile");
const downloadPdfBtn = document.getElementById("downloadPdfBtn");

let currentMonthExpenses = [];
let currentMonthIncomes = [];
let currentMonthCategories = [];
let dailyChart = null;
let cumulativeChart = null;
let categoryPieChart = null;
let currentSlide = 0;
let modalCurrentYear = new Date().getFullYear();
let currentMonth = "";
let currentMonthBalance = 0;

// for mobile screen only
let currentExpensePage = 1;
const EXPENSES_PER_PAGE = 3;

// for desktop screen only
let currentSelectPage = 1;
const SELECT_PER_PAGE = 2;

let currentIncomePage = 1;
const INCOME_PER_PAGE = 1;

/* ===============================
   INIT
================================ */
const now = new Date();
currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

updateMobileMonthText();
loadMonthlyData();
setupCarousel();
populateCategorySelect();

/* Resize Listener for Chart Responsiveness */
window.addEventListener("resize", () => {
  const [year, month] = currentMonth.split("-");
  if (currentMonthExpenses && currentMonthExpenses.length > 0) {
    renderDailyChart(currentMonthExpenses, +year, +month);
    renderCumulativeChart(currentMonthExpenses, +year, +month);
  }
});

/* Back to Top Logic */
if (backToTopBtn) {
  window.addEventListener("scroll", () => {
    if (window.scrollY > 300) {
      backToTopBtn.classList.add("show");
    } else {
      backToTopBtn.classList.remove("show");
    }
  });

  backToTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/* Histogram Sort Listener */
if (histogramSort) {
  histogramSort.addEventListener("change", applyHistogramSort);
}

/* Month Navigation Buttons */
if (prevMonthBtn) prevMonthBtn.addEventListener("click", () => changeMonth(-1));
if (nextMonthBtn) nextMonthBtn.addEventListener("click", () => changeMonth(1));

/* Title Click -> Open Modal */
if (pageMonthTitle) {
  pageMonthTitle.addEventListener("click", () => {
    openMonthModal();
  });
}


function formatINR(amount) {
  return Number(amount || 0).toLocaleString("en-IN");
}

/* Transaction Count Badge Click -> Scroll to List */
if (monthTxCount) {
  monthTxCount.style.cursor = "pointer";
  monthTxCount.addEventListener("click", () => {
    const isMobile = window.innerWidth <= 768;
    const target = isMobile
      ? document.querySelector(".mobile-date-view")
      : document.querySelector(".date-wise");

    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

/* Download PDF Listener */
if (downloadPdfBtn) {
  downloadPdfBtn.addEventListener("click", downloadMonthlyReport);
}

/* ===============================
   LOAD MONTHLY DATA
================================ */
async function loadMonthlyData() {
  const [year, month] = currentMonth.split("-");

  const res = await apiRequest(
    `/expenses/summary/monthly?month=${month}&year=${year}`
  );

  const income = res.data.totalIncome || 0;
  const expense = res.data.totalExpense || 0;
  const balance = res.data.balance || 0;
  currentMonthBalance = balance;

  document.getElementById("monthlyIncome").innerText = `₹${formatINR(income)}`;
  document.getElementById("monthlyExpense").innerText = `₹${formatINR(expense)}`;
  document.getElementById("monthlyBalance").innerText = `₹${formatINR(balance)}`;

  // Calculate Liquid Fill Percentages (Income is baseline)
  const base = income > 0 ? income : (expense > 0 ? expense : 1);

  // Visual Fill (Capped at 100%)
  const expenseFill = Math.min((expense / base) * 100, 100);
  const balanceFill = Math.min((balance / base) * 100, 100);

  // Apply Heights
  const fillBudget = document.getElementById("fillBudget");
  const fillExpense = document.getElementById("fillExpense");
  const fillBalance = document.getElementById("fillBalance");

  if (fillBudget) fillBudget.style.height = "100%";
  if (fillExpense) fillExpense.style.height = `${expenseFill}%`;
  if (fillBalance) fillBalance.style.height = `${Math.max(0, balanceFill)}%`;

  // Update Hover Percentages
  const pctIncome = document.getElementById("pctIncome");
  const pctExpense = document.getElementById("pctExpense");
  const pctBalance = document.getElementById("pctBalance");

  if (pctIncome) pctIncome.innerText = "100%";
  if (pctExpense) pctExpense.innerText = `${((expense / base) * 100).toFixed(1)}%`;
  if (pctBalance) pctBalance.innerText = `${((balance / base) * 100).toFixed(1)}%`;

  renderDailyAverage(expense, year, month);
  renderTopCategory(res.data.categories);

  currentMonthCategories = res.data.categories;
  applyHistogramSort();
  renderCategoryPie(res.data.categories);
  await loadDateWiseExpenses(month, year);
}

/* ===============================
   DAILY AVERAGE INDICATOR
================================ */
function renderDailyAverage(totalExpense, year, month) {
  const avgElDesktop = document.getElementById("dailyAvgIndicatorDesktop");
  const avgElMobile = document.getElementById("dailyAvgIndicatorMobile");

  const now = new Date();
  const isCurrentMonth =
    parseInt(year) === now.getFullYear() &&
    (parseInt(month) - 1) === now.getMonth();

  let dayCount = 0;
  let label = "Avg";

  if (isCurrentMonth) {
    dayCount = now.getDate();
    label = "Avg";
  } else {
    dayCount = new Date(year, month, 0).getDate();
    label = "Avg";
  }

  const avg = dayCount > 0 ? totalExpense / dayCount : 0;
  let html = "";

  if (totalExpense > 0) {
    html = `<span class="daily-avg-badge">₹${formatINR(Math.round(avg))} / day</span>`;
  }

  if (avgElDesktop) avgElDesktop.innerHTML = html;
  if (avgElMobile) avgElMobile.innerHTML = html;
}

/* ===============================
   TOP CATEGORY INDICATOR
================================ */
function renderTopCategory(categories) {
  const elDesktop = document.getElementById("topCategoryIndicatorDesktop");
  const elMobile = document.getElementById("topCategoryIndicatorMobile");

  // Clear previous content
  if (elDesktop) elDesktop.innerHTML = "";
  if (elMobile) elMobile.innerHTML = "";

  if (!categories || categories.length === 0) {
    return;
  }

  // Find category with highest total
  const top = categories.reduce((prev, current) => (prev.total > current.total) ? prev : current);

  const html = `<span class="daily-avg-badge" style="margin-top: 4px; background: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.3); color: #fca5a5;">${top.category} (₹${formatINR(top.total)})</span>`;

  if (elDesktop) elDesktop.innerHTML = html;
  if (elMobile) elMobile.innerHTML = html;
}

/* ===============================
   CATEGORY HISTOGRAM
================================ */
function renderExpenseHistogram(categories) {
  const container = document.getElementById("expenseHistogram");
  container.innerHTML = "";

  if (!categories || categories.length === 0) {
    container.innerHTML = "<p>No data available</p>";
    return;
  }

  const totalExpense = categories.reduce((sum, c) => sum + c.total, 0);

  categories.forEach((cat, index) => {
    const percent = ((cat.total / totalExpense) * 100).toFixed(1);

    const item = document.createElement("div");
    item.className = "histogram-item";
    item.style.cursor = "pointer"; // Indicate clickable

    item.innerHTML = `
      <div class="histogram-header">
        <span class="category-name">${cat.category} <span style="font-size:0.7em; opacity:0.5; margin-left:4px;">▼</span></span>
        <span class="category-value">
          ₹${formatINR(cat.total)}
          <span class="category-percent">${percent}%</span>
        </span>
      </div>

      <div class="histogram-bar-wrapper">
        <div 
          class="histogram-bar" 
          style="--bar-width:${percent}%"
        ></div>
      </div>

      <div class="histogram-count">
        ${cat.count} transaction${cat.count !== 1 ? "s" : ""}
      </div>
      
      <!-- Hidden Transaction List Container -->
      <div class="category-tx-list" id="cat-tx-${index}" style="display: none; margin-top: 12px; background: rgba(68, 40, 94, 0.38); border-radius: 8px; padding: 5px 10px;"></div>
    `;

    // Add Click Event to Expand/Collapse
    item.addEventListener('click', (e) => {
      // Prevent closing if clicking inside the list itself (e.g. if we add buttons later)
      if (e.target.closest('.category-tx-list')) return;

      const list = document.getElementById(`cat-tx-${index}`);
      const isHidden = list.style.display === "none";

      // Optional: Close other open categories for cleaner UI
      document.querySelectorAll('.category-tx-list').forEach(el => el.style.display = 'none');

      if (isHidden) {
        list.style.display = "block";

        // Filter transactions for this category from the global currentMonthExpenses
        const txs = currentMonthExpenses.filter(tx => tx.category === cat.category);
        // Sort by date descending (newest first)
        txs.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (txs.length === 0) {
          list.innerHTML = `<div style="padding: 10px; text-align: center; opacity: 0.6; font-size: 0.85rem;">No transactions loaded yet.</div>`;
        } else {
          // Sort by date descending (newest first)
          txs.sort((a, b) => new Date(b.date) - new Date(a.date));

          list.innerHTML = txs.map(t => `
             <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
               <div>
                 <div style="font-size: 0.9rem; color: #fff;">${new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                 <div style="font-size: 0.8rem; opacity: 0.6;">${t.description || 'No description'}</div>
               </div>
               <div style="font-weight: 600; color: #ff0000;">₹${formatINR(t.amount)}</div>
             </div>
           `).join('');
        }
        renderPaginatedList(list, txs, 1);
      } else {
        list.style.display = "none";
      }

      // Sync Carousel Height after expanding/collapsing
      if (window.syncCarouselHeight) window.syncCarouselHeight();
    });

    container.appendChild(item);
  });

  // Initial sync after rendering histogram
  if (window.syncCarouselHeight) setTimeout(window.syncCarouselHeight, 100);
}

function renderPaginatedList(container, txs, page) {
  const pageSize = 4;
  const totalPages = Math.ceil(txs.length / pageSize);

  if (txs.length === 0) {
    container.innerHTML = `<div style="padding: 10px; text-align: center; opacity: 0.6; font-size: 0.85rem;">No transactions loaded yet.</div>`;
    return;
  }

  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pageTxs = txs.slice(start, end);

  let html = pageTxs.map(t => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
      <div>
        <div style="font-size: 0.9rem; color: #fff;">${new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
        <div style="font-size: 0.8rem; opacity: 0.6;">${t.description || 'No description'}</div>
      </div>
      <div style="font-weight: 600; color: #ef4444;">₹${formatINR(t.amount)}</div>
    </div>
  `).join('');

  if (totalPages > 1) {
    html += `
      <div style="display: flex; justify-content: center; align-items: center; gap: 15px; margin-top: 10px; padding-top: 5px; border-top: 1px solid rgba(255,255,255,0.1);">
        <button class="pg-btn prev" ${page === 1 ? 'disabled style="opacity:0.3; cursor:default;"' : ''} style="background:none; border:none; color:white; cursor:pointer; font-size:1.2rem; padding: 0 10px;">❮</button>
        <span style="font-size: 0.8rem; opacity: 0.8;">Page ${page} of ${totalPages}</span>
        <button class="pg-btn next" ${page === totalPages ? 'disabled style="opacity:0.3; cursor:default;"' : ''} style="background:none; border:none; color:white; cursor:pointer; font-size:1.2rem; padding: 0 10px;">❯</button>
      </div>
    `;
  }

  container.innerHTML = html;

  if (totalPages > 1) {
    const prevBtn = container.querySelector('.pg-btn.prev');
    const nextBtn = container.querySelector('.pg-btn.next');

    if (prevBtn && !prevBtn.disabled) {
      prevBtn.onclick = (e) => {
        e.stopPropagation();
        renderPaginatedList(container, txs, page - 1);
        if (window.syncCarouselHeight) setTimeout(window.syncCarouselHeight, 50);
      };
    }
    if (nextBtn && !nextBtn.disabled) {
      nextBtn.onclick = (e) => {
        e.stopPropagation();
        renderPaginatedList(container, txs, page + 1);
        if (window.syncCarouselHeight) setTimeout(window.syncCarouselHeight, 50);
      };
    }
  }
}

/* ===============================
   SORT LOGIC
================================ */
function applyHistogramSort() {
  if (!currentMonthCategories) return;

  const sortType = histogramSort ? histogramSort.value : "high-low";
  let sorted = [...currentMonthCategories];

  if (sortType === "high-low") {
    sorted.sort((a, b) => b.total - a.total);
  } else if (sortType === "low-high") {
    sorted.sort((a, b) => a.total - b.total);
  } else if (sortType === "a-z") {
    sorted.sort((a, b) => a.category.localeCompare(b.category));
  }

  renderExpenseHistogram(sorted);
}

/* ===============================
   CATEGORY PIE CHART (NEW)
================================ */
function renderCategoryPie(categories) {
  if (!categories || categories.length === 0) {
    showPlaceholder("categoryPieChartContainer", "🍕", "No categorical data yet. Your spending breakdown will appear here.");
    return;
  }

  const canvas = document.getElementById("categoryPieChart");
  if (!canvas) return;

  if (categoryPieChart) categoryPieChart.destroy();

  const labels = categories.map(c => c.category);
  const data = categories.map(c => c.total);
  const colors = ["#7C7CFF", "#22C55E", "#FACC15", "#EF4444", "#38BDF8", "#A78BFA", "#FB923C", "#EC4899"];

  categoryPieChart = new Chart(canvas, {
    type: "pie",
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        animateScale: true,
        animateRotate: true
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#fff",
            boxWidth: 12,
            font: { size: 11 },
            padding: 20
          }
        },

        tooltip: {
          backgroundColor: "rgba(0,0,0,0.95)",
          borderColor: "#22C55E",
          borderWidth: 2,
          cornerRadius: 14,
          padding: 16,
          displayColors: false,
          titleColor: "#22C55E",
          bodyColor: "#ffffff",
          titleFont: {
            size: 14,
            weight: "bold"
          },
          bodyFont: {
            size: 13
          },
          callbacks: {
            title: (context) => {
              return context[0].label;
            },

            label: (context) => {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const value = context.raw;
              const percentage = ((value / total) * 100).toFixed(1);

              return [
                "---------------------------",
                `Amount : ₹${formatINR(value)}`,
                `Share  : ${percentage}%`
              ];
            }
          }
        }
      }
    }
  });
}

/* ===============================
   DATE-WISE DATA
================================ */
async function loadDateWiseExpenses(month, year) {
  // 1. Fetch Expenses
  const res = await apiRequest(`/expenses/month?month=${month}&year=${year}`);
  currentMonthExpenses = res.data;

  // 2. Fetch Income for the same period
  const lastDay = new Date(year, month, 0).getDate();
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
  const incRes = await apiRequest(`/income?startDate=${startDate}&endDate=${endDate}`);
  currentMonthIncomes = incRes.data || [];

  // Update Transaction Count with Animation
  if (monthTxCount) {
    monthTxCount.style.transform = "scale(1.2)";
    monthTxCount.innerHTML = `<span>📊</span> ${currentMonthExpenses.length} Txns`;
    setTimeout(() => monthTxCount.style.transform = "scale(1)", 200);
  }

  if (monthTxCountMobile) {
    monthTxCountMobile.innerHTML = `<span class="daily-avg-badge" style="margin-top: 4px;">${currentMonthExpenses.length} Txns</span>`;
  }

  if (currentMonthExpenses.length === 0 && currentMonthIncomes.length === 0) {
    showPlaceholder("dateWiseList", "📅", "Your daily transaction log is empty. Add a transaction to get started!");
    const mobileList = document.getElementById("mobile-transaction-list");
    if (mobileList) {
      mobileList.innerHTML = `
        <div class="empty-state-placeholder" style="margin: 20px;">
          <div class="placeholder-icon">📅</div>
          <div class="placeholder-text">Your daily transaction log is empty. Add a transaction to get started!</div>
        </div>
      `;
    }
  } else {
    renderCalendar(+year, +month - 1);
  }

  renderDailyChart(currentMonthExpenses, +year, +month);
  renderCumulativeChart(currentMonthExpenses, +year, +month);

  setupMobileDaySearch();
  if (currentMonthExpenses.length > 0 || currentMonthIncomes.length > 0) {
    autoSelectDay(+year, +month);
  }
}

/* ===============================
   MOBILE DAY SEARCH (ONLY ONE INPUT)
================================ */
function setupMobileDaySearch() {
  if (!mobileDayScroll || !mobileListContainer) return;

  mobileDayScroll.innerHTML = "";
  mobileListContainer.innerHTML =
    `<p class="text-muted" style="text-align:center; padding: 20px;">Select a day above to view details</p>`;

  const [year, month] = currentMonth.split("-");
  const daysInMonth = new Date(year, month, 0).getDate();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${month}-${String(d).padStart(2, "0")}`;
    const tx = getTransactionsForDate(dateStr);
    const hasTx = tx.length > 0;
    const hasIncome = tx.some(t => t.type === 'income');

    // Check if date is in the future
    const checkDate = new Date(Number(year), Number(month) - 1, d);
    const isFuture = checkDate > today;

    const bubble = document.createElement("div");
    bubble.className = `day-bubble ${hasTx ? "has-data" : ""} ${hasIncome ? "has-income" : ""} ${isFuture ? "disabled" : ""}`;
    bubble.dataset.day = d;
    bubble.innerHTML = `
      <span class="day-num">${d}</span>
      <span class="day-dot"></span>
    `;

    if (!isFuture) {
      bubble.onclick = () => {
        document.querySelectorAll(".day-bubble").forEach(b => b.classList.remove("active"));
        bubble.classList.add("active");
        currentExpensePage = 1; // Reset pagination on day change
        renderMobileTransactions(dateStr);
        bubble.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      };
    }

    mobileDayScroll.appendChild(bubble);
  }
}

function autoSelectDay(year, month) {
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && (today.getMonth() + 1) === month;

  let targetDay = null;

  if (isCurrentMonth) {
    targetDay = today.getDate();
  } else if (currentMonthExpenses.length > 0) {
    // Find the latest day with a transaction
    let maxDay = 0;
    currentMonthExpenses.forEach(e => {
      const d = new Date(e.date).getDate();
      if (d > maxDay) maxDay = d;
    });
    if (maxDay > 0) targetDay = maxDay;
  }

  if (targetDay) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;

    // 1. Update Mobile View
    const bubble = document.querySelector(`.day-bubble[data-day="${targetDay}"]`);
    if (bubble) {
      // Simulate a real user tap to load data, remove siblings' active states, and scroll into view automatically
      bubble.click();
    }

    // 2. Update Desktop View
    const cell = document.querySelector(`.calendar-day[data-date="${dateStr}"]`);
    if (cell) {
      selectDate(dateStr, cell);
    }
  }
}

/* ===============================
   MOBILE TRANSACTIONS
================================ */

function renderMobileTransactions(dateStr) {
  const tx = getTransactionsForDate(dateStr);
  // const isToday = dateStr === new Date().toISOString().split('T')[0];

  const incomes = tx.filter(t => t.type === 'income');
  const expenses = tx.filter(t => t.type === 'expense');

  const totalIncome = incomes.reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpense = expenses.reduce((sum, t) => sum + Number(t.amount), 0);
  const dateText = new Date(dateStr).toDateString();

  let html = "";

  html += `
    <div class="day-header-card" style="position: relative;">

      <button 
        onclick="event.stopPropagation(); openEmptyStateModal()" 
        title="Add Expense"
        style="
          position: absolute;
          top: 8px;
          right: 8px;
          background: rgba(11, 246, 86, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: rgb(19, 235, 203);
          padding: 0;
          transition: background 0.2s ease;
        "
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
          viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>

      <div class="day-header-date">
        ${dateText}
      </div>

      <div class="day-header-row">
        <span class="income-amount">
          ₹${formatINR(totalIncome || 0)}
        </span>

        <span class="expense-amount">
          ₹${formatINR(totalExpense || 0)}
        </span>
      </div>

    </div>
  `;

  // Dynamic Add Button for Today
  // if (isToday) {
  //   html += `
  //   <div class="today-action-row">

  //     <button 
  //       onclick="openAddExpenseModal('${dateStr}')"
  //       class="add-expense-btn"
  //     >
  //       ➕ Today Expense
  //     </button>

  //     <span class="today-expense-badge">
  //       ₹${totalExpense}
  //     </span>

  //   </div>`;
  // }


  if (!tx.length) {
    html += `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <div class="empty-title">No transactions</div>
          <div class="empty-sub">
            Start by adding your expense by clicking the green plus icon above <br>
            <span style="display:inline-flex; vertical-align:middle; margin:0 4px; color:#13ebcb;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </span>
          </div>

        </div>
      `;
  } else {
    if (incomes.length > 0) {

      // show added budget (Currently not shown on phoen type screen)

      // html += `<div class="section-header" style="color:#4ade80; font-size: 0.9rem; margin: 10px 0 5px 0; font-weight: 600;">Income</div>`;
      // html += incomes.map(t => renderTxItemHTML(t)).join("");
    }

    if (expenses.length > 0) {

      const totalPages = Math.ceil(expenses.length / EXPENSES_PER_PAGE);

      const start = (currentExpensePage - 1) * EXPENSES_PER_PAGE;
      const end = start + EXPENSES_PER_PAGE;

      const paginatedExpenses = expenses.slice(start, end);

      html += paginatedExpenses.map(t => renderTxItemHTML(t)).join("");

      // Show pagination 
      if (totalPages > 1) {
        html += `
          <div class="expense-pagination">

            <button 
              class="expense-page-btn"
              onclick="changeExpensePage(-1, '${dateStr}')"
              ${currentExpensePage === 1 ? "disabled" : ""}
            >
              ◀
            </button>

            <span class="expense-page-info">
              ${currentExpensePage} / ${totalPages}
            </span>

            <button 
              class="expense-page-btn"
              onclick="changeExpensePage(1, '${dateStr}')"
              ${currentExpensePage === totalPages ? "disabled" : ""}
            >
              ▶
            </button>

          </div>
        `;
      }
    }
  }

  // --- SHOW REMAINING PURSE (Last Day Only) ---
  const [y, m] = currentMonth.split("-");
  const lastDay = new Date(y, m, 0).getDate();
  const lastDateStr = `${y}-${m}-${String(lastDay).padStart(2, "0")}`;

  if (dateStr === lastDateStr && currentMonthBalance > 0) {
    html += `
      <div class="transaction-item" onclick="openCarryForwardModal(${currentMonthBalance})" style="background: rgba(250, 204, 21, 0.1); border: 1px dashed rgba(250, 204, 21, 0.5); cursor: pointer; transition: transform 0.2s;">
        <div class="transaction-top" style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="transaction-amount" style="color: #facc15;">₹${formatINR(currentMonthBalance)}</span>
            <span class="transaction-category">Remaining Purse</span>
          </div>
          <div style="color: #facc15; font-size: 1.2rem;">➔</div>
        </div>
        <div class="transaction-description" style="opacity: 0.7; font-size: 0.85rem;">
          Tap to carry forward to next month
        </div>
      </div>
    `;
  }

  mobileListContainer.innerHTML = html;
}




window.changeExpensePage = function (direction, dateStr) {
  currentExpensePage += direction;

  if (currentExpensePage < 1) currentExpensePage = 1;

  renderMobileTransactions(dateStr);
}

/* Helper to render individual transaction item HTML */
function renderTxItemHTML(t) {
  const isCarryForward = t.category === "Carry Forward" || (t.category && t.category.trim() === "Carry Forward");
  const canEdit = t.type === 'expense' && !isCarryForward;

  return `
    <div class="transaction-item" ${canEdit ? `draggable="true" ondragstart="window.handleDragStart(event, '${t._id}')"` : ''}>
      <div class="transaction-top">
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="transaction-amount ${t.type === 'income' ? 'income' : 'expense'}" style="${t.type === 'income' ? 'color:#22c55e;' : ''}">
            ₹${formatINR(t.amount)}
          </span>
          <span class="transaction-category">
            ${t.category || t.source}
            ${isCarryForward ? '<span title="Read-only" style="margin-left:6px; font-size:0.9em; opacity:0.8;">🔒</span>' : ''}
          </span>
        </div>
        <div class="tx-actions">
          ${canEdit ? `<button class="btn-icon-small" onclick="openEditExpenseModal('${t._id}')" title="Edit">✎</button>` : ''}
          ${canEdit ? `<button class="btn-icon-small delete" onclick="openDeleteConfirmation('${t._id}')" title="Delete">✕</button>` : ''}
        </div>
      </div>
      <div class="transaction-description">
        ${t.description || (t.type === 'income' ? 'Income Record' : "No description")}
      </div>
    </div>
  `;
}

/* ===============================
   UTILITIES
================================ */
function getTransactionsForDate(dateStr) {
  const exps = currentMonthExpenses.filter(e =>
    new Date(e.date).toISOString().split("T")[0] === dateStr
  ).map(e => ({ ...e, type: 'expense' }));

  const incs = currentMonthIncomes.filter(i =>
    new Date(i.date).toISOString().split("T")[0] === dateStr
  ).map(i => ({ ...i, type: 'income', category: i.source }));

  return [...exps, ...incs];
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

/* ===============================
   DESKTOP CALENDAR
================================ */
function renderCalendar(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  let html = `
    <div class="calendar-view">
      <div class="calendar-grid">
        ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      .map(d => `<div class="calendar-day-label">${d}</div>`).join("")}
  `;

  for (let i = 0; i < firstDay; i++) {
    html += `<div class="calendar-day empty"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const tx = getTransactionsForDate(dateStr);
    const hasTx = tx.length > 0;
    const hasIncome = tx.some(t => t.type === 'income');

    const disabled = new Date(year, month, d) > today ? "disabled" : "";
    const isDesktop = window.innerWidth > 768;

    html += `
      <div class="calendar-day 
        ${hasTx ? "day-has-tx" : "day-no-tx"} 
        ${hasIncome ? "day-has-income" : ""}
        ${disabled}"
        data-date="${dateStr}"
        ${isDesktop && !disabled ? `ondragover="window.allowDrop(event)" ondragleave="window.handleDragLeave(event)" ondrop="window.handleDrop(event)"` : ''}
        >
        ${d}
      </div>`;
  }

  html += `
      </div>
    </div>

    <div class="transactions-panel">
      <div class="transactions-header">
        <h4 id="selectedDateTitle">Select a date</h4>
      </div>
      <div class="transactions-list" id="transactionsList">
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <div class="empty-title">No transactions</div>
          <div class="empty-sub">Start by adding your expense.</div><br>
        </div>
      </div>
    </div>
  `;

  document.getElementById("dateWiseList").innerHTML = html;

  document.querySelectorAll(".calendar-day:not(.empty)").forEach(cell => {
    cell.addEventListener("click", () => {
      if (cell.classList.contains("disabled")) return;
      currentSelectPage = 1; // Reset pagination on date change
      selectDate(cell.dataset.date, cell);
    });
  });
}

/* ===============================
   DESKTOP DATE SELECT
================================ */
function selectDate(dateStr, cell) {
  document.querySelectorAll(".calendar-day.selected")
    .forEach(d => d.classList.remove("selected"));

  cell.classList.add("selected");

  const list = document.getElementById("transactionsList");
  const tx = getTransactionsForDate(dateStr);

  const incomes = tx.filter(t => t.type === 'income');
  const expenses = tx.filter(t => t.type === 'expense');

  const totalIncome = incomes.reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpense = expenses.reduce((sum, t) => sum + Number(t.amount), 0);

  const dateText = dateStr
    ? new Date(dateStr).toDateString()
    : "Select Date";

  const badgeStyle = `
    margin-left: 10px;
    background: rgba(250, 204, 21, 0.15);
    border: 1px solid rgba(250, 204, 21, 0.3);
    color: #fef9c3;
    border-radius: 12px;
    padding: 4px 10px;
    font-size: 0.8rem;
    vertical-align: middle;
  `;

  document.getElementById("selectedDateTitle").innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between;">

      <div>
        ${dateText}

        <span style="${badgeStyle}">
          Exp: ₹${formatINR(totalExpense)}
        </span>

        ${incomes.length > 0 ? `
          <span style="
            ${badgeStyle};
            color:#4ade80;
            border-color:rgba(34,197,94,0.3);
            background:rgba(34,197,94,0.15);
          ">
            Inc: ₹${formatINR(totalIncome)}
          </span>
        ` : ''}
      </div>

      <button 
        onclick="event.stopPropagation(); openEmptyStateModal()" 
        title="Add Expense"
        style="
          background: rgba(11, 246, 86, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: rgb(19, 235, 203);
          padding: 0;
          transition: background 0.2s;
        "
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
          viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>

    </div>
  `;
  // const isToday = dateStr === new Date().toISOString().split('T')[0];
  // let html = "";
  let html = "";

  // if (isToday) {
  //   html += `
  //     <div class="today-action">
  //       <button 
  //         onclick="openAddExpenseModal('${dateStr}')"
  //         class="add-expense-btn"
  //       >
  //         ➕ Today Expense
  //       </button>
  //     </div>
  //   `;
  // }

  if (!tx.length) {
    html += `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <div class="empty-title">No transactions</div>
          <div class="empty-sub">Start by adding your expense.</div><br>
        </div>
      `;
  } else {
    // Render Income Section
    if (incomes.length > 0) {

      const totalIncomePages = Math.ceil(incomes.length / INCOME_PER_PAGE);

      currentIncomePage = Math.max(1, Math.min(currentIncomePage, totalIncomePages));

      const start = (currentIncomePage - 1) * INCOME_PER_PAGE;
      const end = start + INCOME_PER_PAGE;

      const paginatedIncome = incomes.slice(start, end);

      html += `
        <div class="income-header-row">
          <div class="income-title">Income</div>
          <div class="income-line"></div>
          ${totalIncomePages > 1 ? `
            <div class="income-pagination">
              <button 
                onclick="changeIncomePage(-1, '${dateStr}')"
                ${currentIncomePage === 1 ? "disabled" : ""}
              >◀</button>

              <span>${currentIncomePage}/${totalIncomePages}</span>

              <button 
                onclick="changeIncomePage(1, '${dateStr}')"
                ${currentIncomePage === totalIncomePages ? "disabled" : ""}
              >▶</button>
            </div>
            ` : ""
        }
        </div>
      `;

      html += paginatedIncome.map(t => renderTxItemHTML(t)).join("");
    }



    // Render Expense Section
    if (expenses.length > 0) {

      const totalPages = Math.ceil(expenses.length / SELECT_PER_PAGE);

      const start = (currentSelectPage - 1) * SELECT_PER_PAGE;
      const end = start + SELECT_PER_PAGE;

      const paginatedExpenses = expenses.slice(start, end);


      html += `
        <div class="section-header-row">

          <div class="section-title">Expenses</div>

          <div class="section-line"></div>

          ${totalPages > 1 ? `
            <div class="pagination-wrapper">
              <button 
                class="pagination-btn"
                onclick="changeSelectPage(-1, '${dateStr}')"
                ${currentSelectPage === 1 ? "disabled" : ""}
              >
                ◀
              </button>

              <span class="pagination-info">
                ${currentSelectPage} / ${totalPages}
              </span>

              <button 
                class="pagination-btn"
                onclick="changeSelectPage(1, '${dateStr}')"
                ${currentSelectPage === totalPages ? "disabled" : ""}
              >
                ▶
              </button>
            </div>
          ` : ""}

        </div>
      `;


      html += paginatedExpenses.map(t => renderTxItemHTML(t)).join("");
    }
  }

  // --- SHOW REMAINING PURSE (Desktop) ---
  const [y, m] = currentMonth.split("-");
  const lastDay = new Date(y, m, 0).getDate();
  const lastDateStr = `${y}-${m}-${String(lastDay).padStart(2, "0")}`;

  if (dateStr === lastDateStr && currentMonthBalance > 0) {
    html += `
      <div class="transaction-item" onclick="openCarryForwardModal(${currentMonthBalance})" style="background: rgba(250, 204, 21, 0.1); border: 1px dashed rgba(250, 204, 21, 0.5); cursor: pointer; transition: transform 0.2s;">
        <div class="transaction-top" style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="transaction-amount" style="color: #facc15;">₹${formatINR(currentMonthBalance)}</span>
            <span class="transaction-category">Remaining Purse</span>
          </div>
          <div style="color: #facc15; font-size: 1.2rem;">➔</div>
        </div>
        <div class="transaction-description" style="opacity: 0.7; font-size: 0.85rem;">
          Tap to carry forward to next month
        </div>
      </div>
    `;
  }

  list.innerHTML = html;
}


window.changeIncomePage = function (step, dateStr) {
  currentIncomePage += step;
  selectDate(dateStr, document.querySelector(".calendar-day.selected"));
};


window.changeSelectPage = function (direction, dateStr) {
  currentSelectPage += direction;

  if (currentSelectPage < 1) currentSelectPage = 1;

  selectDate(dateStr, document.querySelector(".calendar-day.selected"));
};

/* ===============================
   MOBILE MONTH SWIPE
================================ */
/* Update visible month text */
function updateMobileMonthText() {
  const [year, month] = currentMonth.split("-");
  const date = new Date(year, month - 1);
  const text = date.toLocaleString("default", {
    month: "long",
    year: "numeric"
  });

  if (mobileMonthText) mobileMonthText.innerText = text;
  if (pageMonthTitle) pageMonthTitle.innerText = text;
  if (calendarViewMonthTitle) calendarViewMonthTitle.innerText = text;

  // Update Watermark CSS Variable
  document.documentElement.style.setProperty('--watermark-text', `"${text}"`);
}


function changeMonth(delta) {
  const [year, month] = currentMonth.split("-").map(Number);

  // Create Date object for target month (using date 1 to avoid overflow)
  const newDate = new Date(year, month - 1 + delta, 1);

  // Get current date to compare against (also set to day 1 for strict month comparison)
  const today = new Date();
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  // BLOCKING LOGIC: If the user tries to go past the current month
  if (newDate > currentMonthStart) {
    showToast("Future data not available");
    return; // Block execution
  }

  const newMonth = String(newDate.getMonth() + 1).padStart(2, "0");
  const newYear = newDate.getFullYear();

  currentMonth = `${newYear}-${newMonth}`;

  updateMobileMonthText();
  loadMonthlyData();
}

/* ===============================
   MONTH SELECTION MODAL
================================ */
function openMonthModal() {
  const [year] = currentMonth.split("-");
  modalCurrentYear = parseInt(year);
  renderMonthModal();
  monthSelectModal.classList.remove("hidden");
}

function renderMonthModal() {
  if (!modalYearDisplay || !modalMonthGrid) return;

  modalYearDisplay.innerText = modalCurrentYear;
  modalMonthGrid.innerHTML = "";

  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  const today = new Date();
  const currentRealYear = today.getFullYear();
  const currentRealMonth = today.getMonth(); // 0-11

  months.forEach((m, index) => {
    const btn = document.createElement("button");
    btn.className = "month-tile";
    btn.innerText = m;

    // Highlight currently selected month in picker
    const [pickerYear, pickerMonth] = currentMonth.split("-");
    if (parseInt(pickerYear) === modalCurrentYear && (parseInt(pickerMonth) - 1) === index) {
      btn.classList.add("selected");
    }

    // Disable future months
    if (modalCurrentYear > currentRealYear || (modalCurrentYear === currentRealYear && index > currentRealMonth)) {
      btn.disabled = true;
    }

    btn.onclick = () => {
      const newMonth = String(index + 1).padStart(2, "0");
      currentMonth = `${modalCurrentYear}-${newMonth}`;
      updateMobileMonthText();
      loadMonthlyData();
      monthSelectModal.classList.add("hidden");
    };

    modalMonthGrid.appendChild(btn);
  });

  // Setup Year Navigation inside Modal
  document.getElementById("modalPrevYear").onclick = () => {
    modalCurrentYear--;
    renderMonthModal();
  };

  document.getElementById("modalNextYear").onclick = () => {
    // Prevent going to future years
    if (modalCurrentYear >= currentRealYear) {
      showToast("Future data not available");
      return;
    }
    modalCurrentYear++;
    renderMonthModal();
  };
}

/* ===============================
   DAILY CHART
================================ */
function renderDailyChart(expenses, year, month) {
  if (expenses.length === 0) {
    showPlaceholder("dailyTrendChartContainer", "📉", "No expenses recorded this month. Start tracking to see your trend!");
    return;
  }

  const ctx = document.getElementById("dailyExpenseChart");
  if (!ctx) return;

  if (dailyChart) dailyChart.destroy();
  const daysInMonth = new Date(year, month, 0).getDate();
  const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const data = new Array(daysInMonth).fill(0);
  const details = Array.from({ length: daysInMonth }, () => []);

  expenses.forEach((e) => {
    const day = new Date(e.date).getDate();
    if (day >= 1 && day <= daysInMonth) {
      data[day - 1] += e.amount;
      const desc = e.description || e.category;
      details[day - 1].push(`${desc}: ₹${formatINR(e.amount)}`);
    }
  });

  // 2. Determine Chart Type & Style
  const isMobile = window.innerWidth <= 768;
  const chartType = isMobile ? "bar" : "line";

  const dataset = {
    label: "Daily Expense",
    data: data,
    borderColor: "#34d399",
    borderWidth: isMobile ? 1 : 2,
    backgroundColor: isMobile ? "rgba(52, 211, 153, 0.7)" : "rgba(52, 211, 153, 0.2)",
  };

  if (isMobile) {
    dataset.borderRadius = 6;
  } else {
    dataset.tension = 0.4;
    dataset.fill = true;
    dataset.pointRadius = 3;
    dataset.pointHoverRadius = 6;
  }

  // 3. Render Chart
  dailyChart = new Chart(ctx, {
    type: chartType,
    data: {
      labels: labels,
      datasets: [dataset]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1000,
        easing: 'easeOutQuart',
        delay: (context) => {
          if (context.type === 'data' && context.mode === 'default') {
            return context.dataIndex * 50; // Delay each point by 50ms
          }
          return 0;
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(0, 0, 0, 0.95)",
          borderColor: "#34d399",
          borderWidth: 2,
          cornerRadius: 14,
          padding: 16,
          displayColors: false,
          titleColor: "#34d399",
          bodyColor: "#ffffff",
          titleFont: {
            size: 14,
            weight: "bold"
          },
          bodyFont: {
            size: 13
          },
          callbacks: {
            title: (context) => {
              const day = parseInt(context[0].label, 10);
              const fullDate = new Date(year, month - 1, day);

              return fullDate.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric"
              });
            },

            label: (context) => {
              return `Total: ₹${formatINR(context.raw)}`;
            },

            afterBody: (context) => {
              const index = context[0].dataIndex;
              const transactions = details[index];

              if (!transactions.length) {
                return ["", "No transactions"];
              }

              return [
                "",
                "Transactions:",
                "-------------------------",
                ...transactions
              ];
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(255, 255, 255, 0.1)" },
          ticks: { color: "rgba(255, 255, 255, 0.7)" }
        },
        x: {
          grid: { display: false },
          ticks: { color: "rgba(255, 255, 255, 0.7)" }
        }
      },
      onClick: (e, elements) => {
        if (!elements.length) return;

        const index = elements[0].index;
        const day = labels[index];
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

        if (window.innerWidth <= 768) {
          const bubble = document.querySelector(`.day-bubble[data-day="${day}"]`);
          if (bubble) {
            bubble.click(); // Trigger the click logic defined in setupMobileDaySearch
            document.querySelector(".mobile-date-view").scrollIntoView({ behavior: "smooth" });
          }
        } else {
          const cell = document.querySelector(`.calendar-day[data-date="${dateStr}"]`);
          if (cell && !cell.classList.contains("disabled")) {
            selectDate(dateStr, cell);
          }
        }
      }
    }
  });
}

/* ===============================
   CUMULATIVE CHART
================================ */
function renderCumulativeChart(expenses, year, month) {
  if (expenses.length === 0) {
    showPlaceholder("cumulativeChartContainer", "📈", "Log your first expense to see your cumulative spending journey!");
    return;
  }

  const canvas = document.getElementById("cumulativeChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  if (cumulativeChart) cumulativeChart.destroy();

  const daysInMonth = new Date(year, month, 0).getDate();
  const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // 1️⃣ Daily totals
  const daily = new Array(daysInMonth).fill(0);
  expenses.forEach(e => {
    const d = new Date(e.date).getDate();
    if (d >= 1 && d <= daysInMonth) daily[d - 1] += e.amount;
  });

  // 2️⃣ Cumulative
  const cumulative = [];
  let sum = 0;
  for (let x of daily) {
    sum += x;
    cumulative.push(sum);
  }

  // 3️⃣ Adjust for current month
  const now = new Date();
  let chartData = cumulative;
  let chartLabels = labels;

  if (now.getFullYear() === year && now.getMonth() + 1 === month) {
    const today = now.getDate();
    let lastTxDay = 0;
    expenses.forEach(e => {
      const d = new Date(e.date).getDate();
      if (d > lastTxDay) lastTxDay = d;
    });
    const cutoff = Math.max(today, lastTxDay);
    chartData = cumulative.slice(0, cutoff);
    chartLabels = labels.slice(0, cutoff);
  }

  const isMobile = window.innerWidth <= 768;

  // 4️⃣ Gradient fill
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, "rgba(250, 204, 21, 0.5)");
  gradient.addColorStop(1, "rgba(250, 204, 21, 0.05)");

  cumulativeChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: chartLabels,
      datasets: [{
        label: "Cumulative Spending",
        data: chartData,
        borderColor: "#FACC15",
        backgroundColor: gradient,
        borderWidth: isMobile ? 3 : 4,
        fill: true,
        tension: 0.45,
        pointRadius: isMobile ? 0 : 3,
        pointHoverRadius: 7,
        pointBackgroundColor: "#FACC15"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,

      interaction: {
        mode: "index",
        intersect: false
      },

      animation: {
        duration: 1600,
        easing: "easeOutCubic"
      },

      plugins: {
        legend: { display: false },

        tooltip: {
          backgroundColor: "rgba(0,0,0,0.9)",
          borderColor: "#FACC15",
          borderWidth: 1,
          cornerRadius: 12,
          padding: 14,
          displayColors: false,
          callbacks: {
            title: (context) => {
              const day = parseInt(context[0].label, 10);
              const fullDate = new Date(year, month - 1, day);
              return fullDate.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric"
              });
            },
            label: (context) =>
              `Total Till Date: ₹${formatINR(context.raw)}`
          }
        }
      },

      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: { color: "rgba(255,255,255,0.7)" }
        },
        x: {
          grid: { display: false },
          ticks: { color: "rgba(255,255,255,0.7)" }
        }
      }
    }
  });
}

/* ===============================
   CAROUSEL LOGIC
================================ */
function setupCarousel() {
  const container = document.querySelector(".carousel-container");
  const track = document.getElementById("analyticsTrack");
  const dotsContainer = document.getElementById("carouselDots");
  const slides = document.querySelectorAll(".carousel-slide");

  if (!track || slides.length === 0) return;

  let startX = 0;
  let currentTranslate = 0;
  let prevTranslate = 0;
  let isDragging = false;
  let animationID;

  // Create dots
  dotsContainer.innerHTML = "";
  slides.forEach((_, i) => {
    const dot = document.createElement("div");
    dot.className = `dot ${i === 0 ? "active" : ""}`;
    dot.onclick = () => goToSlide(i);
    dotsContainer.appendChild(dot);
  });

  // Touch + Mouse Support
  track.addEventListener("touchstart", startDrag, { passive: true });
  track.addEventListener("touchmove", drag, { passive: true });
  track.addEventListener("touchend", endDrag, { passive: true });

  track.addEventListener("mousedown", startDrag);
  track.addEventListener("mousemove", drag);
  track.addEventListener("mouseup", endDrag);
  track.addEventListener("mouseleave", endDrag);

  function startDrag(e) {
    isDragging = true;
    startX = getPositionX(e);
    animationID = requestAnimationFrame(animation);
    track.style.transition = "none";
  }

  function drag(e) {
    if (!isDragging) return;
    const currentPosition = getPositionX(e);
    currentTranslate = prevTranslate + currentPosition - startX;
  }

  function endDrag() {
    if (!isDragging) return;
    cancelAnimationFrame(animationID);
    isDragging = false;

    const movedBy = currentTranslate - prevTranslate;

    if (movedBy < -80 && currentSlide < slides.length - 1) {
      currentSlide++;
    }
    if (movedBy > 80 && currentSlide > 0) {
      currentSlide--;
    }

    updateCarousel(true);
  }

  function getPositionX(e) {
    return e.type.includes("mouse") ? e.pageX : e.touches[0].clientX;
  }

  function animation() {
    track.style.transform = `translateX(${currentTranslate}px)`;
    if (isDragging) requestAnimationFrame(animation);
  }

  function updateCarousel(animate = false) {
    track.style.transition = animate ? "transform 0.5s cubic-bezier(.22,.61,.36,1)" : "none";
    track.style.transform = `translateX(-${currentSlide * container.offsetWidth}px)`;
    prevTranslate = -currentSlide * container.offsetWidth;
    currentTranslate = prevTranslate;

    document.querySelectorAll(".dot").forEach((d, i) => {
      d.classList.toggle("active", i === currentSlide);
    });

    slides.forEach((slide, i) => {
      slide.classList.toggle("active-slide", i === currentSlide);
    });

    // Charts are now only rendered once when data is loaded, 
    // preventing re-animation on every swipe/touch.

    updateHeight();
  }

  function updateHeight() {
    const activeSlide = slides[currentSlide];
    if (activeSlide && container) {
      container.style.height = activeSlide.offsetHeight + "px";
    }
  }

  // Expose for dynamic content changes (like histogram expansion)
  window.syncCarouselHeight = updateHeight;

  function goToSlide(index) {
    currentSlide = index;
    updateCarousel(true);
  }

  // Adjust on window resize
  window.addEventListener("resize", () => updateCarousel(false));

  updateCarousel();
}

/* ===============================
   TOAST NOTIFICATION HELPER
================================ */
function showToast(message, type = "error") {
  // 1. Play Beep Sound (Short, subtle alert)
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime); // Low volume

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.15); // 150ms duration
    }
  } catch (e) {
    // Ignore audio context errors
  }

  // 2. Create toast element if it doesn't exist
  let toast = document.getElementById("toast-notification");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast-notification";

    // Apply styling via JS so no CSS file edit is needed
    Object.assign(toast.style, {
      position: "fixed",
      bottom: "80px", // Just above bottom nav usually
      left: "50%",
      transform: "translateX(-50%) translateY(20px)",

      // Glassy Red Warning Style
      background: "rgba(220, 38, 38, 0.75)",
      backdropFilter: "blur(12px)",
      webkitBackdropFilter: "blur(12px)",
      border: "1px solid rgba(255, 255, 255, 0.25)",
      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",

      color: "#fff",
      padding: "12px 24px",
      borderRadius: "50px",
      fontSize: "0.95rem",
      fontWeight: "500",
      zIndex: "9999",
      opacity: "0",
      transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      pointerEvents: "none",
      whiteSpace: "nowrap"
    });

    document.body.appendChild(toast);
  }

  // Update style based on type
  if (type === "success") {
    toast.style.background = "rgba(34, 197, 94, 0.85)";
  } else {
    toast.style.background = "rgba(220, 38, 38, 0.75)";
  }

  // 3. Set text and show
  toast.innerText = message;
  toast.style.opacity = "1";
  toast.style.transform = "translateX(-50%) translateY(0)";

  // 4. Clear existing timeout if multiple swipes happen quickly
  if (toast.hideTimeout) clearTimeout(toast.hideTimeout);

  // 5. Hide after 2 seconds
  toast.hideTimeout = setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(20px)";
  }, 2000);
}

/* ===============================
   PDF GENERATION – MONTHLY REPORT
================================ */

/**
 * Convert image URL to Base64 for jsPDF
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

/**
 * Creates a circular version of an image URL
 */
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

      // Draw circular clip
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();

      // Draw image centered
      ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, size, size);

      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function downloadMonthlyReport() {
  if (!currentMonthExpenses || currentMonthExpenses.length === 0) {
    showToast("No transactions to download");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // 1. Fetch User Info for Cover
  let userName = "User";
  let avatarBase64 = null;
  try {
    const userRes = await apiRequest('/auth/me', 'GET', null, { skipLoader: true });
    if (userRes.data) {
      userName = userRes.data.name || "User";
      const userAvatar = userRes.data.avatar || localStorage.getItem("userAvatar");
      if (userAvatar) {
        // Use circular converter
        avatarBase64 = await toCircularDataURL(userAvatar);
      }
    }
  } catch (err) {
    console.warn("Could not fetch user info for PDF", err);
  }

  // 2. Prepare Data for Enhancements
  const incomeVal = parseFloat(document.getElementById("monthlyIncome").innerText.replace(/₹|,/g, "")) || 0;
  const expenseVal = parseFloat(document.getElementById("monthlyExpense").innerText.replace(/₹|,/g, "")) || 0;
  const balanceVal = incomeVal - expenseVal;


  // Top 5 Expenses
  const topExpenses = [...currentMonthExpenses]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Category Color Map (Match Pie Chart colors)
  const colors = ["#7C7CFF", "#22C55E", "#FACC15", "#EF4444", "#38BDF8", "#A78BFA", "#FB923C", "#EC4899"];
  const catColorMap = {};
  currentMonthCategories.forEach((c, i) => {
    catColorMap[c.category] = colors[i % colors.length];
  });

  const [year, month] = currentMonth.split("-");
  const dateObj = new Date(year, month - 1);
  const monthName = dateObj.toLocaleString("en-IN", { month: "long" });

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
     PAGE 1: PREMIUM COVER PAGE (ENHANCED)
  ========================================= */

  // Background
  doc.setFillColor(15, 32, 39);
  doc.rect(0, 0, 210, 297, "F");

  // Decorative Accent
  doc.setFillColor(34, 197, 94);
  doc.triangle(170, 297, 210, 297, 210, 250, "F");

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
  doc.setFont("helvetica", "normal");
  doc.setTextColor(34, 197, 94);
  doc.text("MONTHLY FINANCIAL STATEMENT", 105, 112, { align: "center" });

  doc.setDrawColor(255, 255, 255, 0.2);
  doc.setLineWidth(0.5);
  doc.line(60, 120, 150, 120);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text(`${monthName.toUpperCase()} ${year}`, 105, 140, { align: "center" });

  // User Section
  const avatarY = 195;
  if (avatarBase64) {
    // Outer white ring
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(1.5);
    doc.circle(105, avatarY, 26, "S");
    // Image 
    try {
      // Just add the image (it's already cropped to a circle by canvas)
      doc.addImage(avatarBase64, "PNG", 81, avatarY - 24, 48, 48);
    } catch (e) {
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(1.5);
      doc.circle(105, avatarY, 26, "S");
      // Draw a manual vector silhouette 
      doc.setFillColor(200, 200, 200);
      doc.circle(105, avatarY - 8, 8, "F"); // Head
      doc.ellipse(105, avatarY + 12, 16, 10, "F"); // Body
    }
  } else {
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(1.5);
    doc.circle(105, avatarY, 26, "S");
    // Draw a manual vector silhouette 
    doc.setFillColor(200, 200, 200);
    doc.circle(105, avatarY - 8, 8, "F"); // Head
    doc.ellipse(105, avatarY + 12, 16, 10, "F"); // Body
  }

  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(userName, 105, avatarY + 45, { align: "center" });

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(160, 160, 160);
  doc.text("Monthly Report", 105, avatarY + 55, { align: "center" });

  // Footer on cover
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated on ${new Date().toLocaleDateString("en-IN")}`, 105, 280, { align: "center" });
  doc.text("DhanRekha • Where Your Money Tells a Story", 105, 287, { align: "center" });

  // Start actual report on next page
  doc.addPage();

  /* ===============================
     PAGE 2+: REPORT CONTENT
  ================================ */

  doc.setFillColor(15, 32, 39);
  doc.rect(0, 0, 210, 40, "F");

  // Logo
  try {
    const logo = await toDataURL("assets/logo1.png");
    doc.addImage(logo, "PNG", 14, 8, 24, 24);
  } catch { }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(34, 197, 94);
  doc.text("DhanRekha", 44, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(255);
  doc.text("Monthly Report", 44, 30);

  doc.setFontSize(16);
  doc.text(`${monthName} ${year}`, 196, 25, { align: "right" });

  addWatermark(doc);

  /* ===============================
     SUMMARY
  ================================ */


  const incomeText = formatINR(incomeVal);
  const expenseText = formatINR(expenseVal);
  const balanceText = formatINR(balanceVal);

  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text("PURSE SUMMARY", 14, 48);
  doc.setFont("helvetica", "normal");

  doc.text(`Total Income: ${incomeText}`, 14, 54);
  doc.text(`Total Expense: ${expenseText}`, 80, 54);

  doc.setTextColor(balanceVal < 0 ? 220 : 22, balanceVal < 0 ? 38 : 163, balanceVal < 0 ? 38 : 74);
  doc.text(`Balance: ${balanceText}`, 150, 54);
  doc.setTextColor(0);

  /* ===============================
     PREPARED FOR 
  ================================ */

  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(`Prepared for: ${userName}`, 14, 60);
  doc.setTextColor(0);

  doc.setFont("helvetica", "bold");
  doc.text("TOP 5 EXPENSES", 14, 70);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  let txY = 76;
  topExpenses.forEach((tx, i) => {
    const color = catColorMap[tx.category] || "#9ca3af";
    doc.setFillColor(color);
    doc.circle(16, txY - 1, 1, "F"); // Category color dot

    doc.text(`${tx.description || tx.category}`, 20, txY);
    doc.text(`${formatINR(tx.amount)}`, 130, txY, { align: "right" });
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`${tx.category} • ${new Date(tx.date).toLocaleDateString("en-IN")}`, 140, txY);
    doc.setFontSize(10);
    doc.setTextColor(0);
    txY += 6;
  });




  /* ===============================
     JOURNEY OF YOUR MONEY (Ledger)
  =============================== */
  let journeyY = 135;
  doc.setFont("helvetica", "bold");
  doc.text("JOURNEY OF YOUR MONEY", 14, journeyY);
  doc.setFont("helvetica", "normal");
  journeyY += 6;

  const drawLedgerRow = (label, amount, symbol, color) => {
    doc.setTextColor(100);
    doc.text(label, 20, journeyY);
    doc.setTextColor(...color);
    doc.text(`${symbol} ${formatINR(Math.abs(amount))}`, 130, journeyY, { align: "right" });
    journeyY += 6;
  };

  drawLedgerRow("Total Monthly Earnings", incomeVal, "(+)", [34, 197, 94]);
  drawLedgerRow("Total Monthly Spending", expenseVal, "(-)", [239, 68, 68]);

  doc.setDrawColor(200);
  journeyY += 2; // Add a bit of space before the line
  doc.line(20, journeyY, 130, journeyY);
  journeyY += 6; // Add space after the line before the final row

  doc.setFont("helvetica", "bold");
  drawLedgerRow("Final Closing Balance", balanceVal, "(=)", balanceVal < 0 ? [239, 68, 68] : [34, 197, 94]);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0);

  /* ===============================
     CATEGORY SUMMARY (8)
  ================================ */

  const categoryTotals = {};
  currentMonthExpenses.forEach(tx => {
    categoryTotals[tx.category] =
      (categoryTotals[tx.category] || 0) + tx.amount;
  });

  /* ===============================
     CHART GENERATION
  ================================ */

  let chartImg = null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1200; // High resolution for print
    canvas.height = 600;
    const ctx = canvas.getContext("2d");

    const sortedCats = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a);
    const chartLabels = sortedCats.map(([k, v]) => `${k} - ${formatINR(v)}`);
    const chartData = sortedCats.map(([, v]) => v);

    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: chartLabels,
        datasets: [{
          data: chartData,
          backgroundColor: ["#7C7CFF", "#22C55E", "#FACC15", "#EF4444", "#38BDF8", "#A78BFA", "#FB923C", "#EC4899"],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: false,
        animation: false,
        cutout: '45%',
        plugins: {
          legend: { position: 'right', labels: { color: '#1f2937', font: { size: 24, family: 'Helvetica' }, padding: 30, boxWidth: 30 } },
          title: { display: true, text: 'Expense Distribution', color: '#111827', font: { size: 32, weight: 'bold', family: 'Helvetica' }, padding: { bottom: 30 } }
        },
        layout: { padding: 40 }
      }
    });

    // Fill background white (Chart.js is transparent by default)
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    chartImg = canvas.toDataURL("image/png");
  } catch (err) { console.warn("Chart generation failed:", err); }

  let nextY = journeyY + 10;
  if (chartImg) {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (nextY + 80 > pageHeight - 20) { doc.addPage(); nextY = 20; }
    doc.addImage(chartImg, 'PNG', 15, nextY, 180, 80);
    nextY += 90;
  }

  /* ===============================
     DAY OF WEEK BAR CHART
  ================================ */
  let barChartImg = null;
  const dayOfWeekTotals = new Array(7).fill(0);
  currentMonthExpenses.forEach(tx => {
    const day = new Date(tx.date).getDay(); // 0=Sun, 1=Mon, ...
    dayOfWeekTotals[day] += tx.amount;
  });

  try {
    const barCanvas = document.createElement("canvas");
    barCanvas.width = 1200;
    barCanvas.height = 600;
    const barCtx = barCanvas.getContext("2d");

    new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        datasets: [{
          label: 'Total Spending',
          data: dayOfWeekTotals,
          backgroundColor: 'rgba(34, 197, 94, 0.7)',
          borderColor: 'rgba(34, 197, 94, 1)',
          borderWidth: 2,
          borderRadius: 6,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: false,
        animation: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Spending by Day of the Week', color: '#111827', font: { size: 32, weight: 'bold', family: 'Helvetica' }, padding: { bottom: 30 } }
        },
        scales: {
          x: { beginAtZero: true, ticks: { color: '#374151', font: { size: 20, family: 'Helvetica' }, callback: (value) => `${formatINR(value)}` }, grid: { color: '#e5e7eb' } },
          y: { ticks: { color: '#1f2937', font: { size: 24, family: 'Helvetica' } }, grid: { display: false } }
        },
        layout: { padding: 40 }
      }
    });

    barCtx.globalCompositeOperation = 'destination-over';
    barCtx.fillStyle = '#ffffff';
    barCtx.fillRect(0, 0, barCanvas.width, barCanvas.height);
    barChartImg = barCanvas.toDataURL("image/png");
  } catch (err) { console.warn("Bar chart generation failed:", err); }

  if (barChartImg) {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (nextY + 90 > pageHeight - 20) { doc.addPage(); nextY = 20; }

    // Chart on Left (Reduced width to make room for text)
    doc.addImage(barChartImg, 'PNG', 15, nextY, 120, 70);

    // Calculations on Right
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text("Weekly Breakdown", 145, nextY + 10);

    doc.setFont("helvetica", "normal");
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let textY = nextY + 20;
    days.forEach((day, index) => {
      const amount = dayOfWeekTotals[index];
      doc.text(`${day}: ${formatINR(amount)}`, 145, textY);
      textY += 7;
    });

    nextY += 85;
  }

  // Always start Transactions Table on a new page
  doc.addPage();
  nextY = 20;

  /* ===============================
     TRANSACTIONS TABLE
  ================================ */

  const tableData = currentMonthExpenses.map(tx => [
    new Date(tx.date).toLocaleDateString("en-IN"),
    `${formatINR(tx.amount)}`,
    tx.category
  ]);

  doc.autoTable({
    startY: nextY,
    head: [["Date", "Amount", "Category"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [20, 83, 45], textColor: 255 },
    columnStyles: {
      1: { halign: "right", fontStyle: "bold", textColor: [220, 38, 38] }
    },

    /* ===============================
       PAGE HEADER + FOOTER (6)
    ================================ */

    didDrawPage: data => {
      const h = doc.internal.pageSize.getHeight();
      const w = doc.internal.pageSize.getWidth();



      // Footer
      doc.setFontSize(8);
      doc.text(
        "DhanRekha • Where Your Money Tells a Story",
        w / 2,
        h - 5,
        { align: "center" }
      );

      doc.text(`Page ${data.pageNumber}`, w - 14, h - 10, { align: "right" });
      addWatermark(doc);
      doc.text(new Date().toLocaleString("en-IN"), 14, h - 10);
    }
  });

  /* ===============================
     SAVE FILE
  ================================ */

  doc.save(`DhanRekha_Monthly_Report_${userName}_${monthName}_${year}.pdf`);
  showToast("Downloading report...", "success");
}

/* ===============================
   ADD EXPENSE LOGIC (Dynamic)
================================ */

async function populateCategorySelect() {
  const select = document.getElementById("expenseCategory");
  if (!select) return;

  try {
    const res = await apiRequest("/expenses/categories");
    select.innerHTML = '<option value="" disabled selected>Select Category</option>';
    if (res.data && Array.isArray(res.data)) {
      res.data.forEach(cat => {
        const option = document.createElement("option");
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
      });
    }
  } catch (err) {
    console.error("Failed to load categories", err);
  }
}

window.openAddExpenseModal = function (dateStr) {
  const modal = document.getElementById("expenseModal");
  const dateInput = document.getElementById("expenseDate");

  if (modal && dateInput) {
    dateInput.value = dateStr; // Pre-fill selected date
    modal.classList.remove("hidden");
    document.getElementById("expenseModalTitle").innerText = "Add Expense";
    document.getElementById("editExpenseId").value = "";

    // Reset fields for Add (Enable all except date which is locked to selection)
    document.getElementById("expenseCategory").disabled = false;
    document.getElementById("expenseDesc").disabled = false;
    dateInput.disabled = true;
    if (document.getElementById("saveExpenseBtn")) {
      const btn = document.getElementById("saveExpenseBtn");
      btn.innerText = "Save";
      btn.style.background = ""; // Reset to default CSS
      btn.style.color = "";
    }

    document.body.classList.add("modal-open");
  }
};

window.closeExpenseModal = function () {
  const modal = document.getElementById("expenseModal");
  if (modal) {
    modal.classList.add("hidden");
    document.body.classList.remove("modal-open");
    // Reset fields
    document.getElementById("expenseAmount").value = "";
    document.getElementById("expenseDesc").value = "";
    document.getElementById("expenseCategory").value = "";
    document.getElementById("editExpenseId").value = "";
    if (document.getElementById("saveExpenseBtn")) {
      const btn = document.getElementById("saveExpenseBtn");
      btn.innerText = "Save";
      btn.style.background = ""; // Reset to default CSS
      btn.style.color = "";
    }
  }
};

/* ===============================
   ADD INCOME LOGIC
================================ */
window.openAddIncomeModal = function (dateStr) {
  const modal = document.getElementById("incomeModal");
  const dateInput = document.getElementById("incomeDate");

  if (modal && dateInput) {
    dateInput.value = dateStr;
    modal.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }
};

window.closeIncomeModal = function () {
  const modal = document.getElementById("incomeModal");
  if (modal) {
    modal.classList.add("hidden");
    document.body.classList.remove("modal-open");
    document.getElementById("incomeAmount").value = "";
    document.getElementById("incomeSource").value = "";
  }
};

window.saveIncome = async function () {
  const amount = document.getElementById("incomeAmount").value;
  const source = document.getElementById("incomeSource").value;
  const date = document.getElementById("incomeDate").value;

  if (!amount || !date) {
    showToast("Amount and date are required", "error");
    return;
  }

  try {
    await apiRequest("/income", "POST", { amount, source, date });
    showToast("Income added successfully", "success");
    closeIncomeModal();
    loadMonthlyData();
  } catch (err) {
    showToast(err.message, "error");
  }
};

window.openEditExpenseModal = function (id) {
  const tx = currentMonthExpenses.find(e => e._id === id);
  if (!tx) return;

  const modal = document.getElementById("expenseModal");

  document.getElementById("expenseAmount").value = tx.amount;
  document.getElementById("expenseCategory").value = tx.category;
  // Format date for input type="date" (YYYY-MM-DD)
  document.getElementById("expenseDate").value = new Date(tx.date).toISOString().split('T')[0];
  document.getElementById("expenseDesc").value = tx.description || "";
  document.getElementById("editExpenseId").value = tx._id;

  document.getElementById("expenseModalTitle").innerText = "Edit Expense";
  if (document.getElementById("saveExpenseBtn")) {
    const btn = document.getElementById("saveExpenseBtn");
    btn.innerText = "Update";
    btn.style.background = "#3b82f6"; // Blue color for Update
    btn.style.color = "white";
  }

  // Edit Mode
  document.getElementById("expenseCategory").disabled = true;
  document.getElementById("expenseDate").disabled = true;
  document.getElementById("expenseDesc");
  document.getElementById("expenseDate").style.cursor = "not-allowed";

  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");
};

window.saveExpense = async function () {
  const amount = document.getElementById("expenseAmount").value;
  const category = document.getElementById("expenseCategory").value;
  const date = document.getElementById("expenseDate").value;
  const description = document.getElementById("expenseDesc").value;
  const editId = document.getElementById("editExpenseId").value;
  const saveBtn = document.getElementById("saveExpenseBtn");

  if (!amount || !category || !date) {
    showToast("Amount and category are required", "error");
    return;
  }

  try {
    // Disable button to prevent double-click duplicates
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerText = "Saving...";
    }

    if (editId) {
      // Delete old and create new to ensure budget validation is applied
      await apiRequest(`/expenses/${editId}`, "DELETE");
      await apiRequest("/expenses", "POST", { amount, category, date, description });
      showToast("Expense updated successfully", "success");
    } else {
      // Create new expense
      await apiRequest("/expenses", "POST", { amount, category, date, description });
      showToast("Expense added successfully", "success");
    }

    closeExpenseModal();
    loadMonthlyData();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    // Re-enable button
    if (saveBtn) {
      saveBtn.disabled = false;
      // If editId is still present (error case), keep "Update", otherwise "Save"
      saveBtn.innerText = document.getElementById("editExpenseId").value ? "Update" : "Save";
    }
  }
};


/* ===============================
   DELETE TRANSACTION LOGIC
================================ */

window.openDeleteConfirmation = function (id) {
  const tx = currentMonthExpenses.find(t => t._id === id);
  if (!tx) return;

  const modal = document.getElementById("deleteConfirmModal");
  const details = document.getElementById("deleteDetails");
  const confirmBtn = document.getElementById("confirmDeleteBtn");

  // Calculate projected balance (Current + Expense Amount)
  const balanceText = document.getElementById("monthlyBalance").innerText.replace(/[^\d.-]/g, '');
  const currentBalance = parseFloat(balanceText) || 0;
  const newBalance = currentBalance + tx.amount;

  details.innerHTML = `
    <div style="margin-bottom: 8px;"><strong>Transaction:</strong> ${tx.category} (₹${formatINR(tx.amount)})</div>
    <div style="margin-bottom: 8px;"><strong>Date:</strong> ${new Date(tx.date).toLocaleDateString('en-IN')}</div>
    <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 0.9rem;">
      Current Balance: <span style="color: #fff;">₹${formatINR(currentBalance)}</span><br>
      <span style="color: #34d399; font-weight:bold;">New Balance after delete: ₹${formatINR(newBalance)}</span>
    </div>
  `;

  confirmBtn.onclick = () => executeDelete(id);
  modal.classList.remove("hidden");
};

async function executeDelete(id) {
  try {
    await apiRequest(`/expenses/${id}`, "DELETE");
    document.getElementById("deleteConfirmModal").classList.add("hidden");
    showToast("Transaction deleted successfully", "success");
    loadMonthlyData();
  } catch (err) {
    showToast("Failed to delete: " + err.message, "error");
  }
}

/* ===============================
   DRAG AND DROP LOGIC (Desktop)
================================ */

let draggedTxId = null;

window.handleDragStart = function (e, id) {
  draggedTxId = id;
  e.dataTransfer.effectAllowed = "copy";
  e.dataTransfer.setData("text/plain", id);
};

window.allowDrop = function (e) {
  e.preventDefault();
  const cell = e.target.closest('.calendar-day');
  if (cell && !cell.classList.contains('disabled')) {
    cell.classList.add('drag-over');
    e.dataTransfer.dropEffect = "copy";
  }
};

window.handleDragLeave = function (e) {
  const cell = e.target.closest('.calendar-day');
  if (cell) {
    cell.classList.remove('drag-over');
  }
};

window.handleDrop = function (e) {
  e.preventDefault();
  const cell = e.target.closest('.calendar-day');
  if (!cell) return;

  cell.classList.remove('drag-over');

  const targetDate = cell.dataset.date;
  if (!draggedTxId || !targetDate) return;

  // Find transaction details
  const tx = currentMonthExpenses.find(t => t._id === draggedTxId);
  if (!tx) return;

  // Check if moving to same date
  const sourceDate = new Date(tx.date).toISOString().split('T')[0];
  if (sourceDate === targetDate) return;

  openCopyConfirmation(tx, targetDate);
};

function openCopyConfirmation(tx, targetDate) {
  const modal = document.getElementById("copyConfirmModal");
  const details = document.getElementById("copyDetails");
  const confirmBtn = document.getElementById("confirmCopyBtn");

  // Calculate remaining purse (Monthly Balance)
  // Note: Moving within the same month doesn't change the total balance, 
  // but we show it for validation/context.
  const balanceText = document.getElementById("monthlyBalance").innerText;

  details.innerHTML = `
    <div style="margin-bottom: 8px;"><strong>Transaction:</strong> ${tx.category} (₹${formatINR(tx.amount)})</div>
    <div style="margin-bottom: 8px;"><strong>From:</strong> ${new Date(tx.date).toLocaleDateString('en-IN')}</div>
    <div style="margin-bottom: 8px; color: #34d399;"><strong>To:</strong> ${new Date(targetDate).toLocaleDateString('en-IN')}</div>
    <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 0.9rem;">
      Current Monthly Balance: <span style="color: #fff;">${balanceText}</span><br>
      <span style="opacity: 0.6; font-size: 0.8rem;">(Balance will update after copy)</span>
    </div>
  `;

  confirmBtn.onclick = () => executeCopy(tx, targetDate);
  modal.classList.remove("hidden");
}

async function executeCopy(tx, targetDate) {
  try {
    // 1. Create new transaction on target date
    await apiRequest("/expenses", "POST", {
      amount: tx.amount,
      category: tx.category,
      date: targetDate,
      description: tx.description
    });

    document.getElementById("copyConfirmModal").classList.add("hidden");
    alert("Transaction copied successfully");
    showToast("Transaction copied successfully", "success");
    loadMonthlyData();
  } catch (err) {
    showToast("Failed to copy transaction: " + err.message, "error");
  }
}

/* ===============================
   CARRY FORWARD LOGIC
================================ */
window.openCarryForwardModal = function (amount) {
  const modal = document.getElementById("carryForwardModal");
  if (!modal) return;

  document.getElementById("cfAmount").value = `₹${formatINR(amount)}`;
  document.getElementById("cfAmount").dataset.value = amount; // Store raw value
  document.getElementById("cfCategory").value = "Carry Forward";

  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");
};

window.executeCarryForward = async function () {
  const rawAmount = document.getElementById("cfAmount").dataset.value;
  const amount = parseFloat(rawAmount);
  const category = document.getElementById("cfCategory").value;

  if (!amount || !category) {
    showToast("Invalid details", "error");
    return;
  }

  try {
    const [year, month] = currentMonth.split("-").map(Number);

    // Calculate next month
    let nextYear = year;
    let nextMonth = month + 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear++;
    }

    // Get Month Names for Description
    const currentMonthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
    const nextMonthName = new Date(nextYear, nextMonth - 1).toLocaleString('default', { month: 'long' });

    // 1. Expense in Current Month (Last Day)
    const lastDay = new Date(year, month, 0).getDate();
    const expenseDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    await apiRequest("/expenses", "POST", {
      amount: amount,
      category: category,
      date: expenseDate,
      description: `Balance forward (To ${nextMonthName})`
    });

    // 2. Income in Next Month (1st Day)
    const incomeDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    await apiRequest("/income", "POST", {
      amount: amount,
      amount: rawAmount,
      source: `${category} (From ${currentMonthName})`,
      date: incomeDate
    });

    document.getElementById("carryForwardModal").classList.add("hidden");
    document.body.classList.remove("modal-open");
    showToast("Balance forward successfully!", "success");

    // Auto-navigate to next month to show the moved funds
    // Check if next month is accessible (not in future)
    const today = new Date();
    const nextMonthDate = new Date(year, month, 1); // month is 1-based from split, so this creates date for 1st of next month
    const currentRealMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    if (nextMonthDate <= currentRealMonthStart) {
      changeMonth(1);
    } else {
      loadMonthlyData(); // Stay on current month if next is future
    }

  } catch (err) {
    showToast(err.message, "error");
  }
};
