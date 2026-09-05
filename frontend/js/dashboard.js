const chartColors = {
  primary: "#7C7CFF",
  success: "#22C55E",
  warning: "#FACC15",
  danger: "#EF4444",
  info: "#38BDF8",
  violet: "#A78BFA",
  bg: "rgba(255,255,255,0.08)"
};



import { apiRequest } from "./api.js";





// Global Chart Instances
let categoryChart = null;
let weeklyChart = null;
let monthlyChart = null;
let yearlyChart = null;
let dayOfWeekChart = null;
let scannedExpensesData = []; // Store parsed data temporarily
let currentSlide = 0;
let expenseCategories = [];
let currentScanPage = 1;
const SCAN_PER_PAGE = 3;


function formatINR(amount) {
  return Number(amount || 0).toLocaleString("en-IN");
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

  // Create dots
  dotsContainer.innerHTML = "";
  slides.forEach((_, i) => {
    const dot = document.createElement("div");
    dot.className = `dot ${i === 0 ? "active" : ""}`;
    dot.onclick = () => goToSlide(i);
    dotsContainer.appendChild(dot);
  });

  let startX = 0;
  let isDragging = false;

  // Touch events for swipe
  track.addEventListener("touchstart", (e) => {
    // Prevent carousel swipe if user is scrolling a chart horizontally
    if (e.target.closest('.chart-scroll-wrapper')) {
      return;
    }

    startX = e.touches[0].clientX;
    isDragging = true;
  });

  track.addEventListener("touchend", (e) => {
    if (!isDragging) return;
    isDragging = false;
    const endX = e.changedTouches[0].clientX;
    const diff = startX - endX;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
  });

  // Resize Observer to adjust height dynamically
  const resizeObserver = new ResizeObserver(() => {
    const activeSlide = slides[currentSlide];
    if (activeSlide && container) {
      container.style.height = activeSlide.offsetHeight + "px";
    }
  });
  slides.forEach(slide => resizeObserver.observe(slide));

  function updateCarousel() {
    track.style.transform = `translateX(-${currentSlide * 100}%)`;
    document.querySelectorAll(".dot").forEach((d, i) => {
      d.classList.toggle("active", i === currentSlide);
    });
  }

  function nextSlide() {
    if (currentSlide < slides.length - 1) {
      currentSlide++;
      updateCarousel();
      if (window.syncCarouselHeight) window.syncCarouselHeight();
    }
  }

  function prevSlide() {
    if (currentSlide > 0) {
      currentSlide--;
      updateCarousel();
      if (window.syncCarouselHeight) window.syncCarouselHeight();
    }
  }

  function goToSlide(index) {
    currentSlide = index;
    updateCarousel();
  }

  // Expose height sync globally
  window.syncCarouselHeight = () => {
    const activeSlide = slides[currentSlide];
    if (activeSlide && container) {
      container.style.height = activeSlide.offsetHeight + "px";
    }
  };
}

/* ===============================
   LOADING HELPER
================================ */
function toggleChartLoading(canvasId, isLoading) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const parent = canvas.parentElement;

  if (isLoading) {
    const loader = document.createElement("div");
    loader.className = "chart-loading";
    loader.innerHTML = '<div class="spinner"></div>';
    parent.appendChild(loader);
  } else {
    const loader = parent.querySelector(".chart-loading");
    if (loader) loader.remove();
  }
}

/* ===============================
   PREMIUM PLACEHOLDER UTILITY
================================ */
function showPlaceholder(containerId, icon, text) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="empty-state-placeholder">
      <div class="placeholder-icon">${icon}</div>
      <p class="placeholder-text">${text}</p>
      <button onclick="openExpense()" class="placeholder-btn">Add Your First Record</button>
    </div>
  `;
}

function handleChartDataState(canvasId, hasData, containerId, icon = "📊", text = "No data to show yet") {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (!hasData) {
    canvas.style.display = "none";
    showPlaceholder(containerId || canvas.parentElement.id, icon, text);
  } else {
    canvas.style.display = "block";
    const placeholder = canvas.parentElement.querySelector(".empty-state-placeholder");
    if (placeholder) placeholder.remove();
  }
}

/* ===============================
   POPULATE CATEGORIES
================================ */
let fullCategoryList = [];
let selectedCatColor = "#38bdf8";

async function populateCategorySelect(selectedCategoryName = "") {
  const select = document.getElementById("expenseCategory");

  try {
    let res;
    try {
      res = await apiRequest("/categories");
    } catch (e) {
      res = await apiRequest("/expenses/categories");
    }

    fullCategoryList = res.data || [];
    expenseCategories = fullCategoryList.map(c => typeof c === 'string' ? c : c.name);

    if (select) {
      select.innerHTML = '<option value="" disabled selected>Select Category</option>';

      fullCategoryList.forEach(c => {
        const catName = typeof c === 'string' ? c : c.name;
        const catIcon = (typeof c === 'object' && c.icon) ? `${c.icon} ` : '';
        const option = document.createElement("option");
        option.value = catName;
        option.textContent = `${catIcon}${catName}`;
        if (selectedCategoryName && selectedCategoryName === catName) {
          option.selected = true;
        }
        select.appendChild(option);
      });

      // Quick add custom category option at bottom
      const addOption = document.createElement("option");
      addOption.value = "__ADD_NEW__";
      addOption.textContent = "➕ Add Custom Category...";
      addOption.style.color = "#38bdf8";
      addOption.style.fontWeight = "bold";
      select.appendChild(addOption);

      select.onchange = function () {
        if (this.value === "__ADD_NEW__") {
          this.value = "";
          window.openCategoryManager(true);
        }
      };
    }
  } catch (err) {
    console.error("Failed to load categories", err);
  }
}

/* ===============================
   CATEGORY MANAGER LOGIC
================================ */
window.switchCategoryTab = function (tab) {
  const listTab = document.getElementById("catTabList");
  const formTab = document.getElementById("catTabForm");
  const listBtn = document.getElementById("catTabListBtn");
  const formBtn = document.getElementById("catTabFormBtn");

  if (!listTab || !formTab) return;

  if (tab === "form") {
    listTab.style.display = "none";
    formTab.style.display = "flex";
    if (listBtn) listBtn.classList.remove("active");
    if (formBtn) formBtn.classList.add("active");
    setTimeout(() => {
      document.getElementById("catNameInput")?.focus();
    }, 120);
  } else {
    formTab.style.display = "none";
    listTab.style.display = "flex";
    if (formBtn) formBtn.classList.remove("active");
    if (listBtn) listBtn.classList.add("active");
  }
};

window.openCategoryManager = function (focusAdd = false) {
  const modal = document.getElementById("categoryModal");
  if (!modal) return;

  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");
  resetCategoryForm();
  renderCategoryManagerList();

  if (focusAdd) {
    switchCategoryTab("form");
  } else {
    switchCategoryTab("list");
  }
};

window.closeCategoryManager = function () {
  const modal = document.getElementById("categoryModal");
  if (modal) modal.classList.add("hidden");
  document.body.classList.remove("modal-open");
};

window.selectCatEmoji = function (emoji) {
  const iconInput = document.getElementById("catIconInput");
  if (iconInput) iconInput.value = emoji;
};

window.selectCatColor = function (color, swatchEl) {
  selectedCatColor = color;
  const picker = document.getElementById("catColorPicker");
  if (picker) picker.value = color;

  document.querySelectorAll(".color-swatch-chip").forEach(el => el.classList.remove("active"));
  if (swatchEl) {
    swatchEl.classList.add("active");
  }
};

window.resetCategoryForm = function () {
  const title = document.getElementById("categoryFormTitle");
  const cancelBtn = document.getElementById("cancelCategoryEditBtn");
  const idInput = document.getElementById("editingCategoryId");
  const nameInput = document.getElementById("catNameInput");
  const iconInput = document.getElementById("catIconInput");
  const saveBtn = document.getElementById("saveCategoryBtn");

  if (title) title.innerText = "➕ Create Custom Category";
  if (cancelBtn) cancelBtn.style.display = "none";
  if (idInput) idInput.value = "";
  if (nameInput) nameInput.value = "";
  if (iconInput) iconInput.value = "🏷️";
  if (saveBtn) saveBtn.innerHTML = "<span>💾 Save Category</span>";
  selectCatColor("#38bdf8");
};

window.filterCategoryManagerList = function () {
  const query = (document.getElementById("catSearchInput")?.value || "").toLowerCase().trim();
  renderCategoryManagerList(query);
};

window.renderCategoryManagerList = function (searchQuery = "") {
  const listEl = document.getElementById("categoryManagerList");
  const tabCount = document.getElementById("catTabCount");
  if (!listEl) return;

  if (tabCount) tabCount.innerText = fullCategoryList.length;

  let displayList = fullCategoryList;
  if (searchQuery) {
    displayList = fullCategoryList.filter(c => {
      const name = typeof c === 'string' ? c : c.name;
      return name.toLowerCase().includes(searchQuery);
    });
  }

  if (displayList.length === 0) {
    listEl.innerHTML = `
      <div style="text-align: center; padding: 30px 10px; color: #94a3b8; font-size: 0.88rem;">
        No categories match your search.
        <br>
        <button type="button" onclick="switchCategoryTab('form')" style="margin-top: 10px; padding: 6px 14px; border-radius: 8px; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); color: #7dd3fc; cursor: pointer; font-size: 0.8rem; font-weight: 600;">
          + Create "${searchQuery}"
        </button>
      </div>
    `;
    return;
  }

  listEl.innerHTML = displayList.map(c => {
    const isCustom = typeof c === 'object' && !c.isSystem;
    const catName = typeof c === 'string' ? c : c.name;
    const catIcon = (typeof c === 'object' && c.icon) ? c.icon : '🏷️';
    const catColor = (typeof c === 'object' && c.color) ? c.color : '#38bdf8';
    const catId = typeof c === 'object' ? c._id : '';

    return `
      <div class="category-row-card">
        <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
          <span style="font-size: 1.25rem;">${catIcon}</span>
          <div style="min-width: 0;">
            <div style="font-weight: 600; color: #fff; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${catName}
            </div>
          </div>
          <span class="${isCustom ? 'cat-badge-custom' : 'cat-badge-system'}">
            ${isCustom ? 'Custom' : 'Default'}
          </span>
          <span style="width: 10px; height: 10px; border-radius: 50%; background-color: ${catColor}; display: inline-block;" title="Color: ${catColor}"></span>
        </div>

        <div style="display: flex; align-items: center; gap: 6px;">
          ${isCustom ? `
            <button onclick="editCategory('${catId}')" class="cat-action-btn" title="Edit Category" style="color: #38bdf8;">
              ✏️
            </button>
            <button onclick="deleteCategory('${catId}', '${catName.replace(/'/g, "\\'")}')" class="cat-action-btn" title="Delete Category" style="color: #ef4444;">
              🗑️
            </button>
          ` : `
          
          `}
        </div>
      </div>
    `;
  }).join("");
};

window.saveCustomCategory = async function () {
  const id = document.getElementById("editingCategoryId")?.value;
  const name = document.getElementById("catNameInput")?.value?.trim();
  const icon = document.getElementById("catIconInput")?.value?.trim() || "🏷️";
  const color = selectedCatColor || "#38bdf8";

  if (!name) {
    showToast("Please enter a category name", "error");
    return;
  }

  try {
    if (id) {
      await apiRequest(`/categories/${id}`, "PUT", { name, icon, color });
      showToast(`Category "${name}" updated successfully`, "success");
    } else {
      await apiRequest("/categories", "POST", { name, icon, color });
      showToast(`Category "${name}" created successfully`, "success");
    }

    resetCategoryForm();
    await populateCategorySelect(name);
    renderCategoryManagerList();
    switchCategoryTab("list");
  } catch (err) {
    showToast(err.message || "Failed to save category", "error");
  }
};

window.editCategory = function (id) {
  const category = fullCategoryList.find(c => c._id === id);
  if (!category) return;

  const title = document.getElementById("categoryFormTitle");
  const cancelBtn = document.getElementById("cancelCategoryEditBtn");
  const idInput = document.getElementById("editingCategoryId");
  const nameInput = document.getElementById("catNameInput");
  const iconInput = document.getElementById("catIconInput");
  const saveBtn = document.getElementById("saveCategoryBtn");

  if (title) title.innerText = `✏️ Edit "${category.name}"`;
  if (cancelBtn) cancelBtn.style.display = "inline";
  if (idInput) idInput.value = category._id;
  if (nameInput) nameInput.value = category.name;
  if (iconInput) iconInput.value = category.icon || "🏷️";
  if (saveBtn) saveBtn.innerHTML = "<span>💾 Update Category</span>";
  selectCatColor(category.color || "#38bdf8");

  switchCategoryTab("form");
};

window.deleteCategory = async function (id, name) {
  if (!confirm(`Are you sure you want to delete "${name}"? Any existing expenses will be reassigned to "Other".`)) {
    return;
  }

  try {
    await apiRequest(`/categories/${id}`, "DELETE", { reassignTo: "Other" });
    showToast(`Category "${name}" deleted`, "success");
    await populateCategorySelect();
    renderCategoryManagerList();
  } catch (err) {
    showToast(err.message || "Failed to delete category", "error");
  }
};

window.toggleCategoryVisibility = async function (id, hide) {
  try {
    await apiRequest(`/categories/${id}/visibility`, "PATCH", { hide });
    showToast(hide ? "Default category hidden" : "Default category restored", "success");
    await populateCategorySelect();
    renderCategoryManagerList();
  } catch (err) {
    showToast(err.message || "Failed to update category visibility", "error");
  }
};

/* ===============================
   LOAD DASHBOARD DATA
================================ */
async function loadDashboard() {
  try {
    const res = await apiRequest("/expenses/balance");
    const income = res.data.totalIncome || 0;
    const expense = res.data.totalExpense || 0;
    const balance = res.data.remainingBalance || 0;

    // Update Text
    const balanceEl = document.getElementById("balance");
    if (balanceEl) {
      if (balance < 0) {
        balanceEl.innerText = `-₹${formatINR(Math.abs(balance))}`;
        balanceEl.style.color = "#ef4444";
      } else {
        balanceEl.innerText = `₹${formatINR(balance)}`;
        balanceEl.style.color = "";
      }
    }

    const incomeEl = document.getElementById("totalIncome");
    if (incomeEl) incomeEl.innerText = `₹${formatINR(income)}`;

    const expenseEl = document.getElementById("totalExpense");
    if (expenseEl) expenseEl.innerText = `₹${formatINR(expense)}`;

    // Calculate Liquid Fill Percentages (Income is baseline)
    const base = income > 0 ? income : (expense > 0 ? expense : 1);

    // Visual Fill (Capped at 100%)
    const expenseFill = Math.min((expense / base) * 100, 100);
    const balanceFill = balance > 0 ? Math.min((balance / base) * 100, 100) : 0;

    // Apply Heights & Over-Budget Visual Indicator
    const fillIncome = document.getElementById("fillIncome");
    if (fillIncome) fillIncome.style.height = "100%"; // Income is the limit

    const fillExpense = document.getElementById("fillExpense");
    if (fillExpense) fillExpense.style.height = `${expenseFill}%`;

    const fillBalance = document.getElementById("fillBalance");
    const balanceCard = document.querySelector(".balance-card");

    if (balance < 0) {
      if (balanceCard) {
        balanceCard.classList.add("over-budget");
        balanceCard.style.borderColor = "rgba(239, 68, 68, 0.5)";
        balanceCard.style.boxShadow = "0 0 25px rgba(239, 68, 68, 0.25)";
      }
      if (fillBalance) {
        fillBalance.classList.remove("liquid-green");
        fillBalance.classList.add("liquid-red");
        fillBalance.style.height = "25%";
      }
    } else {
      if (balanceCard) {
        balanceCard.classList.remove("over-budget");
        balanceCard.style.borderColor = "";
        balanceCard.style.boxShadow = "";
      }
      if (fillBalance) {
        fillBalance.classList.remove("liquid-red");
        fillBalance.classList.add("liquid-green");
        fillBalance.style.height = `${balanceFill}%`;
      }
    }

    // Dynamic Wave Speed based on Fill Level (Higher fill = Faster waves)
    const setWaveSpeed = (id, pct) => {
      const el = document.getElementById(id);
      if (!el) return;
      // Map 0% -> 12s (Slow), 100% -> 3s (Fast)
      const duration = 12 - (pct / 100 * 9);
      el.style.setProperty('--wave-speed', `${duration}s`);
      el.style.setProperty('--wave-speed-reverse', `${duration * 1.6}s`);
    };

    setWaveSpeed("fillIncome", 100);
    setWaveSpeed("fillExpense", expenseFill);
    setWaveSpeed("fillBalance", balanceFill);

    // Update Hover Percentages
    const pctIncome = document.getElementById("pctIncome");
    if (pctIncome) pctIncome.innerText = "100%";

    const pctExpense = document.getElementById("pctExpense");
    if (pctExpense) pctExpense.innerText = `${((expense / base) * 100).toFixed(1)}%`;

    const pctBalance = document.getElementById("pctBalance");
    if (pctBalance) {
      pctBalance.innerText = balance < 0
        ? `Over budget by ₹${formatINR(Math.abs(balance))}`
        : `${((balance / base) * 100).toFixed(1)}%`;
      pctBalance.style.color = balance < 0 ? "#fca5a5" : "";
    }

  } catch (err) {
    showToast(err.message, "error");
    console.error("Dashboard load error:", err);
  }
}

/* ===============================
   AUTH / LOGOUT
================================ */

window.logout = function () {
  localStorage.removeItem("token");
  window.location.href = "index.html";
};

/* ===============================
   EXPENSE MODAL
================================ */


window.openExpense = function () {
  const modal = document.getElementById("expenseModal");
  const dateInput = document.getElementById("expenseDate");
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split("T")[0];
  }

  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");
};

window.closeExpense = function () {
  const modal = document.getElementById("expenseModal");

  modal.classList.add("hidden");
  document.body.classList.remove("modal-open");
};


window.addExpense = async function () {
  const amount = document.getElementById("expenseAmount").value;
  const category = document.getElementById("expenseCategory").value;
  const date = document.getElementById("expenseDate").value;
  const description = document.getElementById("expenseDesc").value;

  if (!amount || !category || !date) {
    showToast("Amount, category and date are required", "error");
    return;
  }

  try {
    await apiRequest("/expenses", "POST", {
      amount,
      category,
      date,
      description
    });

    closeExpense();
    loadDashboard();
    loadRecentExpenses();
    showToast("Expense added successfully", "success");

  } catch (err) {
    showDialog("Error", err.message, "error");
  }
};

/* ===============================
   INCOME MODAL
================================ */

window.openIncome = function () {
  const modal = document.getElementById("incomeModal");
  const dateInput = document.getElementById("incomeDate");
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split("T")[0];
  }

  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");
};

window.closeIncome = function () {
  const modal = document.getElementById("incomeModal");
  modal.classList.add("hidden");
  document.body.classList.remove("modal-open");
};


window.addIncome = async function () {
  const amount = document.getElementById("incomeAmount").value;
  const source = document.getElementById("incomeSource").value;
  const date = document.getElementById("incomeDate").value;

  if (!amount || !date) {
    showToast("Amount and date are required", "error");
    return;
  }

  try {
    await apiRequest("/income", "POST", {
      amount,
      source,
      date
    });

    closeIncome();
    loadDashboard();
    showToast("Income added successfully", "success");

  } catch (err) {
    showDialog("Error", err.message, "error");
  }
};

/* ===============================
   SCAN / PASTE MODAL LOGIC
================================ */
window.openScanModal = function () {
  document.getElementById("scanModal").classList.remove("hidden");
  document.body.classList.add("modal-open");
  resetScan();
};

window.closeScanModal = function () {
  document.getElementById("scanModal").classList.add("hidden");
  document.body.classList.remove("modal-open");
};

window.handleFileSelect = function (input) {
  const fileName = input.files[0] ? input.files[0].name : "Tap to upload image";
  document.getElementById("fileNameDisplay").innerText = fileName;
};

window.resetScan = function (keepText = false) {
  document.getElementById("scanInputSection").classList.remove("hidden");
  document.getElementById("scanPreviewSection").classList.add("hidden");
  document.getElementById("scanImageInput").value = "";
  if (!keepText) {
    document.getElementById("scanTextInput").value = "";
  }
  document.getElementById("fileNameDisplay").innerText = "Tap to upload image";
  const formatInfo = document.getElementById("formatInfoNote");
  if (formatInfo) formatInfo.style.display = "none";
  scannedExpensesData = [];
  currentScanPage = 1;
};

window.backToEditScan = function () {
  document.getElementById("scanInputSection").classList.remove("hidden");
  document.getElementById("scanPreviewSection").classList.add("hidden");
  const textInput = document.getElementById("scanTextInput");
  if (textInput) {
    textInput.focus();
  }
};

window.toggleFormatInfo = function (e) {
  if (e) e.preventDefault();
  const info = document.getElementById("formatInfoNote");
  if (info) {
    info.style.display = (info.style.display === "none" || !info.style.display) ? "block" : "none";
  }
};

window.processScan = async function () {
  const textInput = document.getElementById("scanTextInput");
  const text = textInput.value.trim();

  if (!text) {
    showDialog("Input Required", "Please paste your expense notes to analyze.", "warning");
    return;
  }

  // Ensure categories are loaded before scan
  if (!expenseCategories || expenseCategories.length === 0) {
    try {
      await populateCategorySelect();
    } catch (e) {
      console.warn("Could not load categories before scan:", e);
    }
  }

  try {
    // Use apiRequest for JSON (Text Only)
    const res = await apiRequest("/expenses/parse", "POST", { text });

    scannedExpensesData = res.data.expenses;
    renderScanPreview(false); // false = not yet validated

    document.getElementById("scanInputSection").classList.add("hidden");
    document.getElementById("scanPreviewSection").classList.remove("hidden");

  } catch (err) {
    showDialog("Analysis Failed", err.message || "Failed to analyze text.", "error");
  }
};

function renderScanPreview(isValidated = false) {
  const tbody = document.getElementById("scanPreviewTableBody");
  const pagination = document.getElementById("scanPagination");
  if (!tbody || !pagination) return;

  tbody.innerHTML = "";
  pagination.innerHTML = "";

  if (scannedExpensesData.length === 0) {
    tbody.innerHTML = "<tr><td colspan='4' style='text-align:center; padding: 20px; color:rgba(255,255,255,0.6);'>No expenses detected.</td></tr>";
    renderScanButtons(false);
    return;
  }

  // Calculate Pagination
  const totalItems = scannedExpensesData.length;
  const totalPages = Math.ceil(totalItems / SCAN_PER_PAGE);
  if (currentScanPage > totalPages) currentScanPage = totalPages || 1;

  const start = (currentScanPage - 1) * SCAN_PER_PAGE;
  const end = Math.min(start + SCAN_PER_PAGE, totalItems);
  const pageItems = scannedExpensesData.slice(start, end);

  pageItems.forEach((item, pageIdx) => {
    const globalIndex = start + pageIdx;

    let currentCat = item.category || 'Other';
    const matchedCategory = expenseCategories.find(
      c => c.trim().toLowerCase() === currentCat.trim().toLowerCase()
    );
    if (matchedCategory) {
      currentCat = matchedCategory;
      item.category = matchedCategory;
    } else if (expenseCategories.includes('Other')) {
      currentCat = 'Other';
      item.category = 'Other';
    } else if (expenseCategories.length > 0) {
      currentCat = expenseCategories[0];
      item.category = expenseCategories[0];
    }

    const options = expenseCategories.map(cat =>
      `<option value="${cat}" ${cat === currentCat ? "selected" : ""} style="background: #333; color: white;">${cat}</option>`
    ).join("");

    let rowStyle = "";
    if (item.isValid === true) {
      rowStyle = "background: rgba(34, 197, 94, 0.15);";
    } else if (item.isValid === false) {
      rowStyle = "background: rgba(239, 68, 68, 0.15);";
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="white-space: nowrap;">${item.date}</td>
      <td style="font-weight: 600; color: #34d399;">₹${formatINR(item.amount)}</td>
      <td>
        <select onchange="updateScannedCategory(${globalIndex}, this.value)" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 6px; padding: 2px 4px; font-size: 0.8rem; outline: none; cursor: pointer; width: 100%;">${options}</select>
      </td>
      <td style="text-align: center;">
        <button class="delete-scan-btn" onclick="deleteScannedItem(${globalIndex})" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px;">
           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Render Pagination Buttons if needed
  if (totalPages > 1) {
    pagination.innerHTML = `
      <button class="pagination-btn" onclick="changeScanPage(-1)" ${currentScanPage === 1 ? 'disabled' : ''}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>
      <span style="font-size: 0.9rem; color: rgba(255,255,255,0.7); min-width: 60px;">${currentScanPage} / ${totalPages}</span>
      <button class="pagination-btn" onclick="changeScanPage(1)" ${currentScanPage === totalPages ? 'disabled' : ''}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
    `;
  }

  renderScanButtons();
}

window.changeScanPage = function (dir) {
  currentScanPage += dir;
  renderScanPreview();
};

window.updateScannedCategory = function (index, value) {
  if (scannedExpensesData[index]) {
    scannedExpensesData[index].category = value;
  }
};

window.deleteScannedItem = function (index) {
  scannedExpensesData.splice(index, 1);
  renderScanPreview();
};

function renderScanButtons() {
  const container = document.querySelector("#scanPreviewSection .modal-actions");
  if (!container) return;

  container.innerHTML = `
    <button onclick="confirmScanUpload()" style="background: #22c55e; color: white; font-weight: 600; flex: 1; padding: 12px; border-radius: 8px; border: none; cursor: pointer;">Confirm & Save</button>
    <button class="cancel" onclick="backToEditScan()" style="background: rgba(255,255,255,0.1); color: white; flex: 1; padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); cursor: pointer;">← Edit Notes</button>
  `;
}

// Backward-compatible alias (balance check removed across DhanRekha)
window.validateBudget = async function () {
  await window.confirmScanUpload();
};

window.confirmScanUpload = async function () {
  if (!scannedExpensesData || scannedExpensesData.length === 0) {
    showToast("No expenses to save", "error");
    return;
  }

  try {
    const res = await apiRequest("/expenses/bulk", "POST", scannedExpensesData);
    const addedCount = res.results?.added?.length || 0;
    const failedCount = res.results?.failed?.length || 0;

    if (failedCount === 0) {
      showToast(`${addedCount} expense${addedCount === 1 ? '' : 's'} added successfully!`, "success");
    } else {
      showToast(`${addedCount} added, ${failedCount} failed to save.`, "warning");
    }

    closeScanModal();
    loadDashboard();
    loadRecentExpenses();
  } catch (err) {
    showDialog("Error", err.message, "error");
  }
};

/* ===============================
   RECENT EXPENSES 
================================ */

async function loadRecentExpenses() {
  try {
    const res = await apiRequest("/expenses/weekly");
    const tbody = document.getElementById("expenseTableBody");
    const container = document.getElementById("recentExpensesContainer");

    if (!res.data || res.data.length === 0) {
      tbody.innerHTML = "";
      showPlaceholder("recentExpensesContainer", "📝", "No transactions recorded yet.");
      if (window.syncCarouselHeight) window.syncCarouselHeight();
      return;
    }

    // Remove placeholder if it exists
    const placeholder = container.querySelector(".empty-state-placeholder");
    if (placeholder) placeholder.remove();

    tbody.innerHTML = "";
    res.data.forEach(exp => {
      const tr = document.createElement("tr");

      const d = new Date(exp.date);
      const date = `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;

      tr.innerHTML = `
        <td style="white-space: nowrap;">${date}</td>
        <td style="font-weight: 600; color: #34d399;">₹${formatINR(exp.amount)}</td>
        <td>${exp.category}</td>
        <td style="opacity: 0.7;">${exp.description || "—"}</td>
      `;

      tbody.appendChild(tr);
    });

    if (window.syncCarouselHeight) window.syncCarouselHeight();

  } catch (err) {
    showToast(err.message, "error");
    console.error(err);
  }
}


/* ===============================
   VIEW ALL EXPENSES
================================ */

window.loadAllExpenses = function () {
  window.location.href = "monthly.html";
};


async function loadCategoryChart(startDate = "", endDate = "") {
  toggleChartLoading("categoryChart", true);
  try {
    let url = "/expenses/summary/category";
    if (startDate || endDate) {
      url += `?startDate=${startDate}&endDate=${endDate}`;
    }
    const res = await apiRequest(url, "GET", null, { skipLoader: true });

    if (!res.data || res.data.length === 0) {
      handleChartDataState("categoryChart", false, "categoryChartContainer", "🍕", "Ready to see where your money goes?");
      if (categoryChart) categoryChart.destroy();
      return;
    }
    handleChartDataState("categoryChart", true, "categoryChartContainer");

    const labels = res.data.map(i => i._id);
    const values = res.data.map(i => i.total);

    if (categoryChart) categoryChart.destroy();
    categoryChart = new Chart(document.getElementById("categoryChart"), {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: [
            chartColors.primary,
            chartColors.success,
            chartColors.warning,
            chartColors.danger,
            chartColors.info,
            chartColors.violet
          ],
          borderWidth: 0,
          hoverOffset: 15
        }]
      },
      options: {
        cutout: "65%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: "#fff",
              padding: 20,
              font: { size: 12, family: "'Segoe UI', sans-serif" },
              usePointStyle: true
            }
          }
        },
        animation: {
          animateScale: true,
          animateRotate: true,
          duration: 1500,
          easing: 'easeOutBounce'
        }
      }
    });
  } catch (err) {
    console.error("Failed to load category chart", err);
  } finally {
    toggleChartLoading("categoryChart", false);
  }
}



async function loadWeeklyTrend(startDate = "", endDate = "") {
  toggleChartLoading("weeklyChart", true);
  try {
    let url = "/expenses/weekly";
    if (startDate || endDate) {
      url += `?startDate=${startDate}&endDate=${endDate}`;
    } else {
      // If no range selected, default to last 7 days to ensure chart gets data
      // (Backend default limits to 3 items which is bad for charts)
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7);
      url += `?startDate=${start.toISOString().split('T')[0]}&endDate=${end.toISOString().split('T')[0]}`;
    }

    const res = await apiRequest(url, "GET", null, { skipLoader: true });

    if (!res.data || res.data.length === 0) {
      handleChartDataState("weeklyChart", false, "weeklyChartContainer", "📈", "No spending trends detected this week.");
      if (weeklyChart) weeklyChart.destroy();
      return;
    }
    handleChartDataState("weeklyChart", true, "weeklyChartContainer");

    const grouped = {};
    res.data.forEach(e => {
      const day = new Date(e.date).toLocaleDateString("en-IN", {
        weekday: "short"
      });
      grouped[day] = (grouped[day] || 0) + e.amount;
    });

    const ctx = document.getElementById("weeklyChart").getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, "rgba(124, 124, 255, 0.5)");
    gradient.addColorStop(1, "rgba(124, 124, 255, 0.0)");

    if (weeklyChart) weeklyChart.destroy();
    weeklyChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: Object.keys(grouped),
        datasets: [{
          label: "Spending (₹)",
          data: Object.values(grouped),
          borderColor: chartColors.primary,
          backgroundColor: gradient,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: chartColors.primary,
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            titleColor: '#fff',
            bodyColor: '#fff',
            padding: 10,
            cornerRadius: 8,
            displayColors: false
          }
        },
        scales: {
          x: { ticks: { color: "rgba(255,255,255,0.7)" }, grid: { display: false } },
          y: { ticks: { color: "rgba(255,255,255,0.7)" }, grid: { color: "rgba(255,255,255,0.05)", borderDash: [5, 5] } }
        },
        animation: {
          y: {
            duration: 2000,
            easing: 'easeOutQuart'
          }
        }
      }
    });
  } catch (err) {
    console.error("Failed to load weekly chart", err);
  } finally {
    toggleChartLoading("weeklyChart", false);
  }
}


async function loadMonthlyHistogram() {
  toggleChartLoading("monthlyChart", true);
  try {
    // Fetch ALL expenses to build the year list and allow full history navigation
    const res = await apiRequest("/expenses", "GET", null, { skipLoader: true });

    if (!res.data || res.data.length === 0) {
      handleChartDataState("monthlyChart", false, "monthlyChartContainer", "📊", "Ready to start your financial journey?");
      if (monthlyChart) monthlyChart.destroy();

      // Clear range if no data
      const navRange = document.getElementById("navbarDateRange");
      const mobRange = document.getElementById("mobileDateRange");
      if (navRange) navRange.innerText = "";
      if (mobRange) mobRange.style.display = 'none';

      return;
    }
    handleChartDataState("monthlyChart", true, "monthlyChartContainer");

    // CALCULATE OVERALL DATE RANGE
    const dates = res.data.map(e => new Date(e.date).getTime());
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    const fmt = { month: 'short', year: 'numeric' };
    const startStr = minDate.toLocaleDateString('en-US', fmt);
    const endStr = maxDate.toLocaleDateString('en-US', fmt);
    const rangeText = startStr === endStr ? startStr : `${startStr} - ${endStr}`;

    const navRange = document.getElementById("navbarDateRange");
    const mobRange = document.getElementById("mobileDateRange");

    if (navRange) navRange.innerText = rangeText;
    if (mobRange) {
      mobRange.innerText = rangeText;
      // Ensure it's visible (might be hidden by CSS on desktop, but block on mobile)
      // We don't force display:block here to respect CSS media queries, 
      // but we ensure content is set.
    }

    // 1. Extract Available Years
    const years = new Set();
    res.data.forEach(e => {
      const y = new Date(e.date).getFullYear();
      years.add(y);
    });
    const sortedYears = Array.from(years).sort((a, b) => b - a); // Descending (Newest first)

    // 2. Populate Year Dropdown
    const yearSelect = document.getElementById("monthlyChartYear");
    let selectedYear = yearSelect ? yearSelect.value : null;

    if (yearSelect) {
      // Default to current year if nothing selected
      if (!selectedYear) selectedYear = new Date().getFullYear().toString();

      yearSelect.innerHTML = "";
      sortedYears.forEach(y => {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y;
        opt.style.color = "#333"; // Ensure text is visible on white background
        if (String(y) === String(selectedYear)) opt.selected = true;
        yearSelect.appendChild(opt);
      });

      // If selected year isn't in data (e.g. new year), select the most recent available
      if (!sortedYears.includes(Number(selectedYear)) && sortedYears.length > 0) {
        selectedYear = sortedYears[0];
        yearSelect.value = selectedYear;
      }
    }

    // 3. Filter Data by Selected Year
    const filteredData = res.data.filter(e => new Date(e.date).getFullYear() == selectedYear);

    // Calculate Total for Selected Year
    const totalYearly = filteredData.reduce((sum, e) => sum + e.amount, 0);
    const totalEl = document.getElementById("monthlyYearTotal");
    if (totalEl) totalEl.innerText = `Total: ₹${totalYearly.toFixed(2)}`;
    if (totalEl) totalEl.innerText = `Total: ₹${formatINR(totalYearly)}`;

    if (filteredData.length === 0) {
      handleChartDataState("monthlyChart", false, "monthlyChartContainer", "📊", "No data for this specific year.");
      if (monthlyChart) monthlyChart.destroy();
      return;
    }
    handleChartDataState("monthlyChart", true, "monthlyChartContainer");

    // 4. Group by Month (Initialize all 12 months)
    const grouped = new Array(12).fill(0);
    filteredData.forEach(e => {
      const m = new Date(e.date).getMonth(); // 0-11
      grouped[m] += e.amount;
    });

    // Round values to 2 decimal places
    const roundedGrouped = grouped.map(val => Number(val.toFixed(2)));

    const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const ctx = document.getElementById("monthlyChart").getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, "rgba(34, 197, 94, 0.8)");
    gradient.addColorStop(1, "rgba(34, 197, 94, 0.2)");

    if (monthlyChart) monthlyChart.destroy();
    monthlyChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: monthLabels,
        datasets: [{
          label: "Monthly Spend (₹)",
          data: roundedGrouped,
          backgroundColor: gradient,
          borderRadius: 6,
          barThickness: 15,
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: 10,
            cornerRadius: 8
          }
        },
        scales: {
          x: { ticks: { color: "rgba(255,255,255,0.7)" }, grid: { display: false } },
          y: { ticks: { color: "rgba(255,255,255,0.7)" }, grid: { color: "rgba(255,255,255,0.05)", borderDash: [5, 5] } }
        },
        animation: {
          duration: 1000,
          easing: 'easeOutQuart',
          delay: (c) => c.dataIndex * 150
        }
      }
    });
  } catch (err) {
    console.error("Failed to load monthly chart", err);
  } finally {
    toggleChartLoading("monthlyChart", false);
  }
}

/* ===============================
   YEARLY OVERVIEW CHART
================================ */
async function loadYearlyChart(startDate = "", endDate = "") {
  toggleChartLoading("yearlyChart", true);
  try {
    let query = "";
    if (startDate || endDate) {
      query = `?startDate=${startDate}&endDate=${endDate}`;
    }

    // Fetch both Expenses and Income
    // Assuming GET /income supports date filtering similar to /expenses
    const [expRes, incRes] = await Promise.all([
      apiRequest("/expenses" + query, "GET", null, { skipLoader: true }),
      apiRequest("/income" + query, "GET", null, { skipLoader: true })
    ]);

    const expenses = expRes.data || [];
    const incomes = incRes.data || [];
    const years = new Set();
    const yearlyData = {};

    if (expenses.length === 0 && incomes.length === 0) {
      handleChartDataState("yearlyChart", false, "yearlyChartContainer", "🏦", "Plan your future! Add some data to see yearly trends.");
      if (yearlyChart) yearlyChart.destroy();
      return;
    }
    handleChartDataState("yearlyChart", true, "yearlyChartContainer");

    // Aggregate Income
    incomes.forEach(inc => {
      const y = new Date(inc.date).getFullYear();
      years.add(y);
      if (!yearlyData[y]) yearlyData[y] = { income: 0, expense: 0 };
      yearlyData[y].income += inc.amount;
    });

    // Aggregate Expenses
    expenses.forEach(exp => {
      const y = new Date(exp.date).getFullYear();
      years.add(y);
      if (!yearlyData[y]) yearlyData[y] = { income: 0, expense: 0 };
      yearlyData[y].expense += exp.amount;
    });

    const sortedYears = Array.from(years).sort((a, b) => a - b);
    const incomeData = sortedYears.map(y => yearlyData[y].income);
    const expenseData = sortedYears.map(y => yearlyData[y].expense);
    const savingsData = sortedYears.map(y => yearlyData[y].income - yearlyData[y].expense);

    const ctx = document.getElementById("yearlyChart").getContext("2d");
    if (yearlyChart) yearlyChart.destroy();

    yearlyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sortedYears,
        datasets: [
          {
            label: 'Income',
            data: incomeData,
            backgroundColor: chartColors.success,
            borderRadius: 4
          },
          {
            label: 'Expense',
            data: expenseData,
            backgroundColor: chartColors.danger,
            borderRadius: 4
          },
          {
            label: 'Savings',
            data: savingsData,
            backgroundColor: chartColors.info,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#fff' } },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          x: { ticks: { color: "rgba(255,255,255,0.7)" }, grid: { display: false } },
          y: { ticks: { color: "rgba(255,255,255,0.7)" }, grid: { color: "rgba(255,255,255,0.1)", borderDash: [5, 5] } }
        }
      }
    });
  } catch (err) {
    console.error("Failed to load yearly chart", err);
  } finally {
    toggleChartLoading("yearlyChart", false);
  }
}

/* ===============================
   DAY OF WEEK CHART
================================ */
async function loadDayOfWeekChart(startDate = "", endDate = "") {
  toggleChartLoading("dayOfWeekChart", true);
  try {
    let url = "/expenses";
    if (startDate || endDate) {
      url += `?startDate=${startDate}&endDate=${endDate}`;
    }
    const res = await apiRequest(url, "GET", null, { skipLoader: true });

    if (!res.data || res.data.length === 0) {
      handleChartDataState("dayOfWeekChart", false, "dayOfWeekChartContainer", "📅", "Tracking your busy days...");
      if (dayOfWeekChart) dayOfWeekChart.destroy();
      return;
    }
    handleChartDataState("dayOfWeekChart", true, "dayOfWeekChartContainer");

    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const totals = new Array(7).fill(0);

    res.data.forEach(e => {
      const d = new Date(e.date).getDay();
      totals[d] += e.amount;
    });

    const ctx = document.getElementById("dayOfWeekChart").getContext("2d");
    if (dayOfWeekChart) dayOfWeekChart.destroy();

    dayOfWeekChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: days,
        datasets: [{
          label: 'Total Spending',
          data: totals,
          backgroundColor: chartColors.violet,
          borderRadius: 6,
          barThickness: 25
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (c) => ` ₹${formatINR(c.raw)}`
            }
          }
        },
        scales: {
          x: { ticks: { color: "rgba(255,255,255,0.7)" }, grid: { display: false } },
          y: { ticks: { color: "rgba(255,255,255,0.7)" }, grid: { color: "rgba(255,255,255,0.1)", borderDash: [5, 5] } }
        },
        animation: {
          duration: 1000,
          easing: 'easeOutQuart',
          delay: (c) => c.dataIndex * 100
        }
      }
    });
  } catch (err) {
    console.error("Failed to load day of week chart", err);
  } finally {
    toggleChartLoading("dayOfWeekChart", false);
  }
}

/* ===============================
   FILTER LOGIC
================================ */
window.filterCharts = function () {
  const start = document.getElementById('startDate').value;
  const end = document.getElementById('endDate').value;

  if (start && end && new Date(start) > new Date(end)) {
    showToast("Start date cannot be after end date", "error");
    return;
  }

  loadCategoryChart(start, end);
  loadWeeklyTrend(start, end);
  loadYearlyChart(start, end);
  loadDayOfWeekChart(start, end);
};

window.resetFilters = function () {
  document.getElementById('startDate').value = '';
  document.getElementById('endDate').value = '';
  loadCategoryChart();
  loadWeeklyTrend();
  loadYearlyChart();
  loadDayOfWeekChart();
};

/* ===============================
   INITIAL PAGE LOAD
================================ */

loadDashboard();
loadRecentExpenses();
populateCategorySelect();

loadCategoryChart();
loadWeeklyTrend();
loadMonthlyHistogram();
loadYearlyChart();
loadDayOfWeekChart();
setupCarousel();

// Event Listener for Year Filter
document.getElementById("monthlyChartYear")?.addEventListener("change", () => {
  loadMonthlyHistogram();
});

/* ===============================
   TOAST NOTIFICATION HELPER
================================ */
function showToast(message, type = "error", duration = 3000) {
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

      backdropFilter: "blur(12px)",
      webkitBackdropFilter: "blur(12px)",
      border: "1px solid rgba(255, 255, 255, 0.25)",

      color: "#fff",
      padding: "12px 24px",
      borderRadius: "50px",
      fontSize: "0.95rem",
      fontWeight: "500",
      zIndex: "9999",
      opacity: "0",
      transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      pointerEvents: "auto",
      pointerEvents: "auto", // Ensure button is clickable
      whiteSpace: "nowrap"
    });

    document.body.appendChild(toast);
  }

  // 3. Apply Dynamic Colors based on Type
  if (type === "success") {
    toast.style.background = "rgba(34, 197, 94, 0.85)"; // Green
    toast.style.boxShadow = "0 8px 32px rgba(34, 197, 94, 0.3)";
  } else {
    toast.style.background = "rgba(220, 38, 38, 0.85)"; // Red
    toast.style.boxShadow = "0 8px 32px rgba(220, 38, 38, 0.3)";
  }

  // 4. Clear existing timeout to prevent previous auto-hide from closing this new toast
  if (toast.hideTimeout) {
    clearTimeout(toast.hideTimeout);
    toast.hideTimeout = null;
  }

  // 4. Set text and show
  toast.innerHTML = "";
  const textSpan = document.createElement("span");
  textSpan.innerText = message;
  toast.appendChild(textSpan);

  const okBtn = document.createElement("button");
  okBtn.innerText = "OK";
  okBtn.style.cssText = "margin-left: 12px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.5); color: white; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: bold;";

  okBtn.onclick = () => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(20px)";
    if (toast.hideTimeout) clearTimeout(toast.hideTimeout);
  };

  toast.appendChild(okBtn);

  toast.style.opacity = "1";
  toast.style.transform = "translateX(-50%) translateY(0)";

  // 4. Clear existing timeout if multiple swipes happen quickly
  if (toast.hideTimeout) clearTimeout(toast.hideTimeout);

  // 5. Hide after duration (if > 0)
  // 5. Only set auto-hide if duration is greater than 0
  if (duration > 0) {
    toast.hideTimeout = setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(-50%) translateY(20px)";
    }, duration);
  }
}

/* ===============================
   CUSTOM DIALOG HELPER
================================ */
function showDialog(title, message, type = "info") {
  // Remove existing dialog if any
  const existing = document.getElementById("custom-dialog");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "custom-dialog";

  // Inline styles for the overlay
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(5px);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;

  const card = document.createElement("div");
  // Inline styles for the card
  card.style.cssText = `
    background: rgba(30, 30, 35, 0.95);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 16px;
    padding: 30px;
    max-width: 400px;
    width: 85%;
    text-align: center;
    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    transform: scale(0.9);
    transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  `;

  const icon = type === "success" ? "✅" : (type === "warning" ? "⚠️" : "❌");
  const titleColor = type === "success" ? "#34d399" : (type === "warning" ? "#facc15" : "#ef4444");
  const btnColor = type === "success" ? "#34d399" : (type === "warning" ? "#facc15" : "#ef4444");

  card.innerHTML = `
    <div style="font-size: 3.5rem; margin-bottom: 15px;">${icon}</div>
    <h3 style="color: ${titleColor}; margin: 0 0 10px 0; font-size: 1.6rem;">${title}</h3>
    <div style="color: rgba(255,255,255,0.8); margin-bottom: 25px; line-height: 1.6; font-size: 1rem;">${message}</div>
    <button id="dialog-ok-btn" style="background: ${btnColor}; color: #000; border: none; padding: 12px 30px; border-radius: 10px; font-weight: bold; cursor: pointer; font-size: 1rem; transition: transform 0.2s; box-shadow: 0 4px 15px ${btnColor}40;">OK</button>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.style.opacity = "1";
    card.style.transform = "scale(1)";
  });

  const btn = card.querySelector("#dialog-ok-btn");
  btn.onclick = () => {
    overlay.style.opacity = "0";
    card.style.transform = "scale(0.9)";
    setTimeout(() => overlay.remove(), 300);
  };
  btn.focus();
}

/* ===============================
   BACK TO TOP LOGIC
================================ */
const backToTopBtn = document.getElementById("backToTopBtn");
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
};

/* ===============================
   DRILL-DOWN BREAKDOWN MODAL
================================ */
let cachedHierarchy = null;

window.closeBreakdownModal = function () {
  const modal = document.getElementById("breakdownModal");
  if (modal) {
    modal.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }
};

window.openBreakdownModal = async function (type) {
  const modal = document.getElementById("breakdownModal");
  const titleEl = document.getElementById("breakdownModalTitle");
  const subtitleEl = document.getElementById("breakdownModalSubtitle");
  const bodyEl = document.getElementById("breakdownModalBody");

  if (!modal || !bodyEl) return;

  // Set titles based on type
  if (type === "expense") {
    titleEl.innerText = "Expense Breakdown";
    // subtitleEl.innerText = "Select a year to open the full Yearly Report or view Monthly Breakdown";
  } else if (type === "income") {
    titleEl.innerText = "Income Breakdown";
    // subtitleEl.innerText = "Expand a year to view monthly income and open any month";
  } else {
    titleEl.innerText = "Remaining Balance Breakdown";
    // subtitleEl.innerText = "Expand a year to compare monthly savings and open any month";
  }

  bodyEl.innerHTML = `
    <div style="text-align: center; padding: 40px 20px; opacity: 0.7;">
      <p>Loading breakdown records...</p>
    </div>
  `;

  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");

  try {
    const res = await apiRequest("/expenses/breakdown/hierarchy");
    cachedHierarchy = res.data || [];
    renderBreakdownList(type, cachedHierarchy);
  } catch (err) {
    bodyEl.innerHTML = `
      <div style="text-align: center; padding: 30px; color: #ef4444;">
        <p>⚠️ Failed to load breakdown: ${err.message}</p>
        <button onclick="openBreakdownModal('${type}')" style="margin-top: 10px; padding: 8px 16px; border-radius: 8px; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); cursor: pointer;">Retry</button>
      </div>
    `;
  }
};

function renderBreakdownList(type, yearsData) {
  const bodyEl = document.getElementById("breakdownModalBody");
  if (!bodyEl) return;

  if (!yearsData || yearsData.length === 0) {
    bodyEl.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; opacity: 0.6;">
        <div style="font-size: 2.5rem; margin-bottom: 10px;">📂</div>
        <p>No transactions found to break down.</p>
      </div>
    `;
    return;
  }

  let html = `<div style="display: flex; flex-direction: column; gap: 14px;">`;

  yearsData.forEach((yearObj) => {
    const isExpense = type === "expense";
    const isIncome = type === "income";
    const isBalance = type === "balance";

    let mainStatText = "";
    let statColor = "";

    if (isExpense) {
      mainStatText = `₹${formatINR(yearObj.totalExpense)}`;
      statColor = "#ef4444";
    } else if (isIncome) {
      mainStatText = `₹${formatINR(yearObj.totalIncome)}`;
      statColor = "#38bdf8";
    } else {
      const isNegative = yearObj.balance < 0;
      mainStatText = `${isNegative ? '-' : ''}₹${formatINR(Math.abs(yearObj.balance))}`;
      statColor = isNegative ? "#ef4444" : "#22c55e";
    }

    const yearId = `breakdown-year-${yearObj.year}`;

    html += `
      <div class="breakdown-year-card">
        <div class="breakdown-year-header">
          <div>
            <div class="breakdown-year-title">Year ${yearObj.year}</div>
            ${isBalance ? `
              <div class="breakdown-in-out-pill">
                In: ₹${formatINR(yearObj.totalIncome)} • Out: ₹${formatINR(yearObj.totalExpense)}
              </div>
            ` : ''}
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            ${isExpense ? `
              <button onclick="window.open('/yearly?year=${yearObj.year}', '_blank')" class="btn-breakdown-report" title="View full year report in new tab">
                Year Report ↗
              </button>
            ` : ''}

            <button onclick="toggleBreakdownYear('${yearId}')" id="btn-${yearId}" class="btn-breakdown-toggle">
              <span>Monthly</span> <span class="arrow-indicator">▼</span>
            </button>
          </div>
        </div>

        <div class="breakdown-year-main-stat" style="color: ${statColor};">
          ${mainStatText}
        </div>

        <!-- Collapsible Monthly Section -->
        <div id="${yearId}" class="monthly-breakdown-container" style="display: none; margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 12px;">
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${yearObj.months.length === 0 ? `
              <div style="opacity: 0.6; font-size: 0.85rem; padding: 6px 0;">No active months recorded in ${yearObj.year}.</div>
            ` : yearObj.months.map(m => {
      let monthValueText = "";
      let monthColor = "";

      if (isExpense) {
        monthValueText = `₹${formatINR(m.expense)}`;
        monthColor = "#fb7185";
      } else if (isIncome) {
        monthValueText = `₹${formatINR(m.income)}`;
        monthColor = "#38bdf8";
      } else {
        const isNeg = m.balance < 0;
        monthValueText = `${isNeg ? '-' : ''}₹${formatINR(Math.abs(m.balance))}`;
        monthColor = isNeg ? "#fb7185" : "#4ade80";
      }

      return `
                <div class="breakdown-month-row">
                  <div style="min-width: 0;">
                    <div class="breakdown-month-name">${m.name}</div>
                    ${isBalance ? `
                      <div class="breakdown-month-sub">In: ₹${formatINR(m.income)} | Out: ₹${formatINR(m.expense)}</div>
                    ` : ''}
                  </div>
                  <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
                    <span style="font-weight: 700; font-size: 0.95rem; color: ${monthColor};">${monthValueText}</span>
                    <button onclick="window.open('/transactions?year=${yearObj.year}&month=${m.month}', '_blank')" class="breakdown-month-open-btn" title="Open ${m.name} ${yearObj.year} Transactions in new tab">
                      Open ↗
                    </button>
                  </div>
                </div>
              `;
    }).join('')}
          </div>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  bodyEl.innerHTML = html;
}

window.toggleBreakdownYear = function (containerId) {
  const container = document.getElementById(containerId);
  const btn = document.getElementById(`btn-${containerId}`);
  if (!container) return;

  const isHidden = container.style.display === "none";
  container.style.display = isHidden ? "block" : "none";

  if (btn) {
    const arrow = btn.querySelector(".arrow-indicator");
    if (arrow) arrow.innerText = isHidden ? "▲" : "▼";
  }
};

/* ===============================
   NOTIFICATION ACTION TRIGGER
================================ */
window.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("action") === "add-expense") {
    setTimeout(() => {
      if (typeof window.openExpense === "function") {
        window.openExpense();
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }, 600);
  }
});

/* ===============================
   DASHBOARD REMINDER MODAL LOGIC
================================ */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

window.openReminderModal = function () {
  const modal = document.getElementById("reminderModal");
  if (modal) {
    modal.classList.remove("hidden");
    document.body.classList.add("modal-open");
    loadDashboardReminderSettings();
  }
};

window.closeReminderModal = function () {
  const modal = document.getElementById("reminderModal");
  if (modal) {
    modal.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }
};

async function loadDashboardReminderSettings() {
  try {
    const res = await apiRequest('/notifications/settings', 'GET', null, { skipLoader: true });
    if (res && res.data) {
      const toggle = document.getElementById('modalReminderToggle');
      const timeSelect = document.getElementById('modalReminderTime');
      const navDot = document.getElementById('navReminderDot');
      const mobDot = document.getElementById('mobReminderDot');

      const isEnabled = !!res.data.enabled;
      if (toggle) toggle.checked = isEnabled;
      if (timeSelect && res.data.time) timeSelect.value = res.data.time;

      if (navDot) navDot.classList.toggle('active', isEnabled);
      if (mobDot) mobDot.classList.toggle('active', isEnabled);

      updateModalReminderStatus(isEnabled);
    }
  } catch (e) {
    console.warn("Could not load reminder settings in dashboard", e);
  }
}

function updateModalReminderStatus(enabled) {
  const statusEl = document.getElementById('modalReminderStatus');
  if (!statusEl) return;
  if (!('Notification' in window)) {
    statusEl.innerText = "❌ Notifications not supported in this browser.";
    return;
  }
  if (Notification.permission === 'denied') {
    statusEl.innerText = "⚠️ Notifications blocked in browser settings.";
    statusEl.style.color = "#f87171";
  } else if (enabled) {
    statusEl.innerText = "✅ Daily reminder active at selected time.";
    statusEl.style.color = "#4ade80";
  } else {
    statusEl.innerText = "⚪ Reminders disabled.";
    statusEl.style.color = "#94a3b8";
  }
}

window.toggleModalReminders = async function () {
  const toggle = document.getElementById('modalReminderToggle');
  const timeSelect = document.getElementById('modalReminderTime');
  const isEnabled = toggle.checked;

  if (isEnabled) {
    if (!('Notification' in window)) {
      alert("This browser does not support push notifications.");
      toggle.checked = false;
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      alert("Please allow notification permissions to receive daily reminders.");
      toggle.checked = false;
      updateModalReminderStatus(false);
      return;
    }

    try {
      let sub = null;
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const vapidRes = await apiRequest('/notifications/vapid-key', 'GET', null, { skipLoader: true });
        const vapidPublicKey = vapidRes.data?.publicKey;

        sub = await reg.pushManager.getSubscription();
        if (!sub && vapidPublicKey) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
          });
        }
      }

      await apiRequest('/notifications/subscribe', 'POST', {
        subscription: sub ? sub.toJSON() : null,
        reminderSettings: {
          enabled: true,
          time: timeSelect.value
        }
      });

      // Quick confirmation notification
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready;
          const timeFormatted = formatTime12h(timeSelect.value);
          const rawName = localStorage.getItem('userName') || '';
          const firstName = rawName.trim().split(' ')[0];
          const greeting = firstName ? `Hi ${firstName.charAt(0).toUpperCase() + firstName.slice(1)}, ` : '';
          reg.showNotification("🔔 Daily Reminder Active", {
            body: `${greeting}you will be reminded daily at ${timeFormatted} to record your expenses!`,
            icon: "/assets/icons/icon-192.png",
            badge: "/assets/icons/icon-72.png",
            vibrate: [100, 50, 100],
            data: { url: "/dashboard?action=add-expense" }
          });
        } catch (e) { /* ignore */ }
      }

      showToast("Daily reminder enabled!", "success");
      updateModalReminderStatus(true);
      document.getElementById('navReminderDot')?.classList.add('active');
      document.getElementById('mobReminderDot')?.classList.add('active');
    } catch (err) {
      console.error("Subscription error:", err);
      updateModalReminderStatus(true);
    }
  } else {
    await apiRequest('/notifications/subscribe', 'POST', {
      reminderSettings: { enabled: false }
    });
    showToast("Daily reminder disabled", "info");
    updateModalReminderStatus(false);
    document.getElementById('navReminderDot')?.classList.remove('active');
    document.getElementById('mobReminderDot')?.classList.remove('active');
  }
};

function formatTime12h(timeStr) {
  if (!timeStr) return "9:00 PM";
  const parts = timeStr.split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] || "00";
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${period}`;
}

window.setReminderPreset = function (timeStr) {
  const timeInput = document.getElementById("modalReminderTime");
  if (timeInput) {
    timeInput.value = timeStr;
    saveModalReminderTime();
  }
};

window.saveModalReminderTime = async function () {
  const toggle = document.getElementById('modalReminderToggle');
  const timeSelect = document.getElementById('modalReminderTime');
  if (!toggle.checked) return;

  try {
    await apiRequest('/notifications/subscribe', 'POST', {
      reminderSettings: {
        enabled: true,
        time: timeSelect.value
      }
    });
    showToast(`Reminder set for ${formatTime12h(timeSelect.value)}!`, "success");
  } catch (e) {
    console.error("Failed to update reminder time", e);
  }
};

// Check reminder status on page load to light up dot
loadDashboardReminderSettings();