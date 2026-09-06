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
  }, { passive: true });

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
  }, { passive: true });

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
  const todayIso = new Date().toISOString().split("T")[0];
  if (dateInput) {
    dateInput.max = todayIso;
    if (!dateInput.value) {
      dateInput.value = todayIso;
    }
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

  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (date > todayIso) {
    const parts = date.split('-');
    const formattedDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : date;
    const formattedToday = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    showToast(`Future date not allowed: ${formattedDate} is in the future (today is ${formattedToday}).`, "warning");
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
  const todayIso = new Date().toISOString().split("T")[0];
  if (dateInput) {
    dateInput.max = todayIso;
    if (!dateInput.value) {
      dateInput.value = todayIso;
    }
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

  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (date > todayIso) {
    const parts = date.split('-');
    const formattedDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : date;
    const formattedToday = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    showToast(`Future date not allowed: ${formattedDate} is in the future (today is ${formattedToday}).`, "warning");
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
  const file = input.files ? input.files[0] : null;
  const placeholder = document.getElementById("fileUploadPlaceholder");
  const badge = document.getElementById("fileSelectedBadge");
  const nameText = document.getElementById("selectedFileNameText");

  if (file) {
    if (placeholder) placeholder.style.display = "none";
    if (badge) {
      badge.style.display = "flex";
      if (nameText) nameText.innerText = `📄 ${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
    }
  } else {
    window.clearSelectedImage();
  }
};

window.clearSelectedImage = function (e) {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }
  const input = document.getElementById("scanImageInput");
  if (input) input.value = "";
  const placeholder = document.getElementById("fileUploadPlaceholder");
  const badge = document.getElementById("fileSelectedBadge");
  if (placeholder) placeholder.style.display = "block";
  if (badge) badge.style.display = "none";
  const display = document.getElementById("fileNameDisplay");
  if (display) display.innerText = "Tap to upload receipt or bill";
};

window.resetScan = function (keepText = false) {
  document.getElementById("scanInputSection").classList.remove("hidden");
  document.getElementById("scanPreviewSection").classList.add("hidden");
  window.clearSelectedImage();
  if (!keepText) {
    document.getElementById("scanTextInput").value = "";
  }
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
    if (scannedExpensesData && scannedExpensesData.length > 0) {
      const updatedLines = scannedExpensesData.map(item => {
        if (item.rawLine) {
          return item.rawLine;
        }
        const dateStr = item.rawDateText || formatScanDisplayDate(item.date);
        const desc = (item.description && item.description !== 'Scanned Expense') ? item.description : item.category;
        return `${dateStr} ${item.amount} ${desc}`.trim();
      }).filter(Boolean);
      textInput.value = updatedLines.join('\n');
    }
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
  const fileInput = document.getElementById("scanImageInput");
  const textInput = document.getElementById("scanTextInput");
  const file = fileInput?.files?.[0];
  const text = textInput ? textInput.value.trim() : "";

  if (!file && !text) {
    showDialog(
      "Input Required",
      "Kindly add at least one expense as per the required format:<br/><br/><strong style='color: #60a5fa; letter-spacing: 0.3px;'>Date &nbsp;Amount &nbsp;Category</strong><br/><br/><span style='font-size: 0.88rem; color: #94a3b8;'>Example:<br/><code>06-09-2026 250 Groceries</code><br/><code>06-09-2026 100 Transport</code></span>",
      "warning"
    );
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

  const analyzeBtn = document.getElementById("scanAnalyzeBtn") || document.querySelector("#scanInputSection .modal-actions button");
  const origBtnText = analyzeBtn ? analyzeBtn.innerHTML : "Analyze";
  if (analyzeBtn) {
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = file ? "⏳ Scanning Receipt (OCR)..." : "⏳ Analyzing...";
  }

  try {
    let res;
    if (file) {
      const formData = new FormData();
      formData.append("image", file);
      if (text) {
        formData.append("text", text);
      }
      res = await apiRequest("/expenses/parse", "POST", formData);
    } else {
      res = await apiRequest("/expenses/parse", "POST", { text });
    }

    scannedExpensesData = res.data?.expenses || [];

    if (scannedExpensesData.length === 0) {
      showDialog(
        "No Expenses Detected",
        "Could not detect any valid expenses in the provided notes. Kindly add at least one expense with date and amount as per the format:<br/><br/><strong style='color: #60a5fa; letter-spacing: 0.3px;'>DD-MM-YYYY &nbsp;Amount &nbsp;Category / Notes</strong><br/><br/><span style='font-size: 0.88rem; color: #94a3b8;'>Example:<br/><code>06-09-2026 250 Groceries</code><br/><code>06-09-2026 100 Transport</code></span>",
        "warning"
      );
      return;
    }

    renderScanPreview(false); // false = not yet validated

    document.getElementById("scanInputSection").classList.add("hidden");
    document.getElementById("scanPreviewSection").classList.remove("hidden");

  } catch (err) {
    showDialog("Analysis Failed", err.message || "Failed to analyze receipt or notes.", "error");
  } finally {
    if (analyzeBtn) {
      analyzeBtn.disabled = false;
      analyzeBtn.innerHTML = origBtnText;
    }
  }
};

function formatScanDisplayDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const parts = String(dateStr).split("-");
    if (parts.length === 3 && parts[0].length === 4) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${day}-${month}-${year}`; // DD-MM-YYYY
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `${day}-${month}-${d.getFullYear()}`;
    }
    return dateStr;
  } catch (e) {
    return dateStr;
  }
}

function validateClientExpenseDate(dateStr) {
  if (!dateStr) return { isValid: false, error: "Date is required" };
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return { isValid: false, error: "Invalid date format" };
  let y, m, d;
  if (parts[0].length === 4) {
    y = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10);
    d = parseInt(parts[2], 10);
  } else {
    d = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10);
    y = parseInt(parts[2], 10);
  }
  if (isNaN(y) || isNaN(m) || isNaN(d)) return { isValid: false, error: "Invalid date values" };
  if (m < 1 || m > 12) return { isValid: false, error: `Invalid month (${m}). Must be between 1 and 12.` };
  const daysInMonth = new Date(y, m, 0).getDate();
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const mName = months[m - 1];
  if (d < 1 || d > daysInMonth) {
    return { isValid: false, error: `Invalid date: ${mName} ${y} only has ${daysInMonth} days (got ${d}).` };
  }
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const formattedIso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const formattedInput = `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`;
  const formattedToday = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
  if (formattedIso > todayIso) {
    return { isValid: false, error: `Future date not allowed: ${formattedInput} is in the future (today is ${formattedToday}).` };
  }
  return { isValid: true, error: null, isoDate: formattedIso, displayDate: formattedInput };
}

window.updateScannedDate = function (index, newIsoDate) {
  if (scannedExpensesData[index]) {
    const item = scannedExpensesData[index];
    const val = validateClientExpenseDate(newIsoDate);
    const oldRawDate = item.rawDateText;
    const newFormattedDate = val.displayDate || formatScanDisplayDate(newIsoDate);

    item.date = newIsoDate;
    item.rawDateText = newFormattedDate;
    item.isValid = val.isValid;
    item.dateError = val.error;

    // Retain corrected date inside rawLine for "Edit Notes" synchronization
    if (item.rawLine) {
      if (oldRawDate && item.rawLine.includes(oldRawDate)) {
        item.rawLine = item.rawLine.replace(oldRawDate, newFormattedDate);
      } else {
        const desc = (item.description && item.description !== 'Scanned Expense') ? item.description : item.category;
        item.rawLine = `${newFormattedDate} ${item.amount} ${desc}`.trim();
      }
    } else {
      const desc = (item.description && item.description !== 'Scanned Expense') ? item.description : item.category;
      item.rawLine = `${newFormattedDate} ${item.amount} ${desc}`.trim();
    }

    renderScanPreview();
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

  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  pageItems.forEach((item, pageIdx) => {
    const globalIndex = start + pageIdx;
    const isInvalid = item.isValid === false;

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

    const displayDate = item.rawDateText || formatScanDisplayDate(item.date);

    const tr = document.createElement("tr");
    if (isInvalid) {
      tr.style.background = "rgba(239, 68, 68, 0.12)";
      tr.style.boxShadow = "inset 3px 0 0 #ef4444";
    }

    tr.innerHTML = `
      <td style="white-space: nowrap; font-weight: 500; vertical-align: middle;">
        <div style="color: ${isInvalid ? '#fca5a5' : '#e2e8f0'}; display: flex; align-items: center; gap: 6px;">
          <span>${displayDate}</span>
          ${isInvalid ? `
            <span style="background: rgba(239, 68, 68, 0.25); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 4px; padding: 1px 5px; font-size: 0.68rem; font-weight: 700;">
              Invalid
            </span>
          ` : ''}
        </div>
        ${isInvalid ? `
          <div class="scan-date-error">
            ⚠️ ${item.dateError || 'Invalid date'}
          </div>
          <input type="date" value="${item.isValid ? item.date : ''}" max="${todayIso}" onchange="updateScannedDate(${globalIndex}, this.value)" class="scan-date-input" title="Pick a valid date" />
        ` : ''}
      </td>
      <td style="font-weight: 600; color: #34d399; vertical-align: middle;">₹${formatINR(item.amount)}</td>
      <td style="vertical-align: middle;">
        <select onchange="updateScannedCategory(${globalIndex}, this.value)" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 6px; padding: 2px 4px; font-size: 0.8rem; outline: none; cursor: pointer; width: 100%;">${options}</select>
      </td>
      <td style="text-align: center; vertical-align: middle;">
        <button class="delete-scan-btn" onclick="deleteScannedItem(${globalIndex})" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px;" title="Delete this entry">
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
    const item = scannedExpensesData[index];
    const oldCat = item.category;
    item.category = value;

    // Retain updated category in rawLine if present
    if (item.rawLine && oldCat && oldCat !== value) {
      const catRegex = new RegExp(`(^|\\s)${oldCat}(\\s|$)`, 'i');
      if (catRegex.test(item.rawLine)) {
        item.rawLine = item.rawLine.replace(catRegex, `$1${value}$2`).trim();
      }
    }
  }
};

window.deleteScannedItem = function (index) {
  scannedExpensesData.splice(index, 1);
  renderScanPreview();
};

function renderScanButtons() {
  const container = document.querySelector("#scanPreviewSection .modal-actions");
  if (!container) return;

  const invalidCount = (scannedExpensesData || []).filter(i => i.isValid === false).length;

  container.innerHTML = `
    ${invalidCount > 0 ? `
      <div style="width: 100%; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 8px; padding: 8px 12px; margin-bottom: 8px; font-size: 0.8rem; color: #fca5a5; display: flex; align-items: center; gap: 8px;">
        <span>⚠️</span>
        <span><b>${invalidCount} entry with invalid or future date.</b> Please fix or delete before saving.</span>
      </div>
    ` : ''}
    <div style="display: flex; gap: 10px; width: 100%;">
      <button onclick="confirmScanUpload()" style="background: ${invalidCount > 0 ? '#475569' : '#22c55e'}; color: white; font-weight: 600; flex: 1; padding: 12px; border-radius: 8px; border: none; cursor: ${invalidCount > 0 ? 'not-allowed' : 'pointer'}; opacity: ${invalidCount > 0 ? '0.7' : '1'};">
        ${invalidCount > 0 ? 'Fix Dates to Save' : 'Confirm & Save'}
      </button>
      <button class="cancel" onclick="backToEditScan()" style="background: rgba(255,255,255,0.1); color: white; flex: 1; padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); cursor: pointer;">← Edit Notes</button>
    </div>
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

  // Double check all items client-side
  let hasInvalid = false;
  scannedExpensesData.forEach(item => {
    const val = validateClientExpenseDate(item.date);
    if (!val.isValid) {
      item.isValid = false;
      item.dateError = val.error;
      hasInvalid = true;
    }
  });

  if (hasInvalid) {
    renderScanPreview();
    const count = scannedExpensesData.filter(i => i.isValid === false).length;
    showDialog(
      "Action Required",
      `Cannot save: ${count} expense(s) have invalid or future dates. Please fix the dates using the calendar input or delete them with the trash button before saving.`,
      "warning"
    );
    return;
  }

  try {
    const res = await apiRequest("/expenses/bulk", "POST", scannedExpensesData);
    const addedCount = res.results?.added?.length || 0;
    const failedCount = res.results?.failed?.length || 0;

    if (failedCount === 0) {
      showToast(`${addedCount} expense${addedCount === 1 ? '' : 's'} added successfully!`, "success");
    } else {
      const firstReason = res.results?.failed?.[0]?.reason || "Validation error";
      showToast(`${addedCount} added, ${failedCount} failed: ${firstReason}`, "warning");
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
    document.body.appendChild(toast);
  }

  // Always re-apply responsive styling to adapt to orientation / viewport size
  Object.assign(toast.style, {
    position: "fixed",
    bottom: "28px",
    left: "50%",
    transform: "translateX(-50%) translateY(20px)",
    backdropFilter: "blur(14px)",
    webkitBackdropFilter: "blur(14px)",
    border: "1px solid rgba(255, 255, 255, 0.25)",
    color: "#fff",
    padding: "10px 16px",
    borderRadius: "14px",
    fontSize: "0.88rem",
    fontWeight: "500",
    zIndex: "999999",
    opacity: "0",
    transition: "all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    pointerEvents: "auto",
    whiteSpace: "normal", // Wrap text so it never goes outside phone screens
    wordBreak: "break-word",
    maxWidth: "min(92vw, 420px)",
    width: "max-content",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    textAlign: "left",
    lineHeight: "1.4"
  });

  // 3. Apply Dynamic Colors based on Type
  if (type === "success") {
    toast.style.background = "rgba(34, 197, 94, 0.92)"; // Green
    toast.style.boxShadow = "0 8px 30px rgba(34, 197, 94, 0.35)";
  } else if (type === "info") {
    toast.style.background = "rgba(14, 165, 233, 0.92)"; // Cyan / Info
    toast.style.boxShadow = "0 8px 30px rgba(14, 165, 233, 0.35)";
  } else if (type === "warning") {
    toast.style.background = "rgba(245, 158, 11, 0.92)"; // Amber / Warning
    toast.style.boxShadow = "0 8px 30px rgba(245, 158, 11, 0.35)";
  } else {
    toast.style.background = "rgba(220, 38, 38, 0.92)"; // Red
    toast.style.boxShadow = "0 8px 30px rgba(220, 38, 38, 0.35)";
  }

  // 4. Clear existing timeout to prevent previous auto-hide from closing this new toast
  if (toast.hideTimeout) {
    clearTimeout(toast.hideTimeout);
    toast.hideTimeout = null;
  }

  // 5. Populate text and OK button
  toast.innerHTML = "";
  const textSpan = document.createElement("span");
  textSpan.style.cssText = "flex: 1; word-break: break-word;";
  textSpan.innerText = message;
  toast.appendChild(textSpan);

  const okBtn = document.createElement("button");
  okBtn.innerText = "OK";
  okBtn.style.cssText = "margin-left: auto; background: rgba(255,255,255,0.22); border: 1px solid rgba(255,255,255,0.5); color: white; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: bold; flex-shrink: 0; transition: background 0.15s;";
  okBtn.onmouseover = () => okBtn.style.background = "rgba(255,255,255,0.35)";
  okBtn.onmouseout = () => okBtn.style.background = "rgba(255,255,255,0.22)";

  okBtn.onclick = () => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(20px)";
    if (toast.hideTimeout) clearTimeout(toast.hideTimeout);
  };

  toast.appendChild(okBtn);

  // Animate in
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";
  });

  // 6. Only set auto-hide if duration is greater than 0
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
                <span class="breakdown-in-tag" title="Income">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
                  ₹${formatINR(yearObj.totalIncome)}
                </span>
                <span class="breakdown-sep">•</span>
                <span class="breakdown-out-tag" title="Expense">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                  ₹${formatINR(yearObj.totalExpense)}
                </span>
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
                      <div class="breakdown-month-sub">
                        <span class="breakdown-in-tag" title="Income">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
                          ₹${formatINR(m.income)}
                        </span>
                        <span class="breakdown-sep">|</span>
                        <span class="breakdown-out-tag" title="Expense">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                          ₹${formatINR(m.expense)}
                        </span>
                      </div>
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

/* ===============================
   VOICE & HINGLISH EXPENSE/INCOME ENTRY (OPTION 1 CONFIRMATION)
================================ */

let voiceRecognition = null;
let isVoiceListening = false;
let voiceParsedTransactions = [];
let activeVoiceTarget = null; // null = voiceModal, 'expense' = expenseModal, 'income' = incomeModal, 'bulk' = scanModal
let voiceSilenceTimer = null;

const voiceSystemCategoryKeywords = {
  'Transport': [
    'transport', 'travel', 'uber', 'ola', 'rapido', 'taxi', 'cab', 'bus', 'train',
    'flight', 'air', 'metro', 'auto', 'fuel', 'petrol', 'diesel', 'cng', 'parking',
    'toll', 'fare', 'vehicle', 'bike', 'car', 'scooter', 'fastag', 'gaadi'
  ],
  'Food': [
    'food', 'lunch', 'dinner', 'breakfast', 'snack', 'snacks', 'cafe', 'restaurant',
    'hotel', 'zomato', 'swiggy', 'tea', 'chai', 'coffee', 'bakery', 'meal', 'meals',
    'burger', 'pizza', 'dosa', 'samosa', 'maggi', 'sweets', 'mithai', 'dhaba',
    'nashta', 'khana', 'paneer', 'roti', 'lassi'
  ],
  'Groceries': [
    'grocery', 'groceries', 'supermarket', 'mart', 'dmart', 'blinkit', 'zepto',
    'instamart', 'bigbasket', 'milk', 'vegetables', 'vegetable', 'fruits', 'fruit',
    'kirana', 'ration', 'sabzi', 'sabji', 'atta', 'rice', 'dal', 'oil', 'masala', 'doodh'
  ],
  'Rent': [
    'rent', 'house rent', 'room rent', 'flat rent', 'hostel', 'pg', 'maintenance', 'landlord', 'kiraya'
  ],
  'Electric Bill': [
    'electricity', 'electric', 'power bill', 'current bill', 'bijli', 'electricity bill',
    'bescom', 'msedcl', 'uppcl', 'tneb', 'cesc'
  ],
  'Water Bill': [
    'water bill', 'jal board', 'water tanker', 'pani bill'
  ],
  'Cylinder': [
    'cylinder', 'lpg', 'gas cylinder', 'indane', 'bharat gas', 'hp gas', 'gas bill', 'cooking gas'
  ],
  'Bills': [
    'bill', 'bills', 'recharge', 'mobile recharge', 'dth', 'postpaid', 'prepaid',
    'airtel', 'jio', 'vi', 'vodafone', 'utility', 'broadband', 'wifi'
  ],
  'Shopping': [
    'shopping', 'amazon', 'flipkart', 'myntra', 'meesho', 'ajio', 'clothes',
    'clothing', 'shoes', 'dress', 'shirt', 'pants', 'tshirt', 'mall', 'store', 'fashion'
  ],
  'Health': [
    'health', 'doctor', 'medicine', 'medicines', 'pharmacy', 'hospital', 'clinic',
    'medical', 'test', 'lab', 'apollo', 'pharmeasy', '1mg', 'dentist', 'consultation',
    'dawa', 'dawai'
  ],
  'Salary': [
    'salary', 'stipend', 'wages', 'kamai', 'bonus', 'freelance'
  ]
};

function escapeVoiceRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeVoiceHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const voiceMonthNames = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12
};

window.parseHinglishVoiceTranscript = function (transcript) {
  if (!transcript || typeof transcript !== 'string') return [];

  let text = transcript.trim();
  // Segment on connectors: 'aur', 'phir', 'and', 'then', 'also', commas, semicolons, newlines
  const connectorRegex = /\b(?:aur|phir|and|then|also)\b|[,;\n]+/gi;
  const rawSegments = text.split(connectorRegex).map(s => s.trim()).filter(Boolean);

  const items = [];
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayIso = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  const userCats = Array.isArray(expenseCategories) ? expenseCategories.map(c => typeof c === 'string' ? c : c.name).filter(Boolean) : [];

  for (const seg of rawSegments) {
    let segmentText = seg;

    // 1. Detect Date (Explicit DD-MM-YYYY, YYYY-MM-DD, Named Month, or Relative kal/aaj/parso)
    let date = todayIso;
    let dateText = 'Today';

    // 1a. Explicit full date DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
    const fullDmy = segmentText.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/);
    if (fullDmy) {
      const day = parseInt(fullDmy[1], 10);
      const month = parseInt(fullDmy[2], 10);
      const year = parseInt(fullDmy[3], 10);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000 && year <= 2099) {
        date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        dateText = `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`;
        segmentText = segmentText.replace(fullDmy[0], ' ');
      }
    } else {
      // 1b. Explicit full date YYYY-MM-DD
      const fullYmd = segmentText.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
      if (fullYmd) {
        const year = parseInt(fullYmd[1], 10);
        const month = parseInt(fullYmd[2], 10);
        const day = parseInt(fullYmd[3], 10);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000 && year <= 2099) {
          date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          dateText = `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`;
          segmentText = segmentText.replace(fullYmd[0], ' ');
        }
      } else {
        // 1c. Named month: e.g. "4th March 2026", "4 march", "15 aug"
        const dMonthY = segmentText.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{4}))?\b/i);
        if (dMonthY && voiceMonthNames[dMonthY[2].toLowerCase()]) {
          const day = parseInt(dMonthY[1], 10);
          const month = voiceMonthNames[dMonthY[2].toLowerCase()];
          const year = dMonthY[3] ? parseInt(dMonthY[3], 10) : now.getFullYear();
          if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            dateText = `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`;
            segmentText = segmentText.replace(dMonthY[0], ' ');
          }
        } else {
          // 1d. Named month: "March 4th 2026", "Aug 15"
          const monthDY = segmentText.match(/\b([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b/i);
          if (monthDY && voiceMonthNames[monthDY[1].toLowerCase()]) {
            const month = voiceMonthNames[monthDY[1].toLowerCase()];
            const day = parseInt(monthDY[2], 10);
            const year = monthDY[3] ? parseInt(monthDY[3], 10) : now.getFullYear();
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
              date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              dateText = `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`;
              segmentText = segmentText.replace(monthDY[0], ' ');
            }
          } else if (/\b(?:parso|parson|day\s*before\s*yesterday)\b/i.test(segmentText)) {
            const d = new Date(now);
            d.setDate(d.getDate() - 2);
            date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            dateText = '2 Days Ago';
            segmentText = segmentText.replace(/\b(?:parso|parson|day\s*before\s*yesterday)\b/gi, ' ');
          } else if (/\b(?:yesterday|kal|beeta\s*kal)\b/i.test(segmentText)) {
            date = yesterdayIso;
            dateText = 'Yesterday';
            segmentText = segmentText.replace(/\b(?:yesterday|kal|beeta\s*kal)\b/gi, ' ');
          } else if (/\b(?:today|aaj)\b/i.test(segmentText)) {
            date = todayIso;
            dateText = 'Today';
            segmentText = segmentText.replace(/\b(?:today|aaj)\b/gi, ' ');
          } else {
            // 1e. Hindi spoken: "4 tarikh ko", "5 tareekh", "20 date ko"
            const tarikhMatch = segmentText.match(/\b(\d{1,2})\s*(?:st|nd|rd|th)?\s*(?:tarikh|tareekh|taareekh|date)\s*(?:ko)?\b/i);
            if (tarikhMatch) {
              const day = parseInt(tarikhMatch[1], 10);
              const m = now.getMonth() + 1;
              const y = now.getFullYear();
              if (day >= 1 && day <= 31) {
                date = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                dateText = `${String(day).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`;
                segmentText = segmentText.replace(tarikhMatch[0], ' ');
              }
            }
          }
        }
      }
    }

    // 2. Detect Amount
    let amount = null;
    const kMatch = segmentText.match(/\b(\d+(?:\.\d+)?)\s*k\b/i);
    if (kMatch) {
      amount = parseFloat(kMatch[1]) * 1000;
      segmentText = segmentText.replace(kMatch[0], ' ');
    } else {
      const numMatch = segmentText.match(/(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{1,2})?)/i);
      if (numMatch) {
        amount = parseFloat(numMatch[1]);
        segmentText = segmentText.replace(numMatch[0], ' ');
      }
    }

    if (!amount || isNaN(amount) || amount <= 0) {
      continue;
    }

    // 3. Detect Type (Income vs Expense)
    const incomeKeywords = /\b(?:salary|income|bonus|cashback|credited|aaya|aayi|mila|mile|kamaya|interest|refund)\b/i;
    const isIncome = incomeKeywords.test(segmentText);
    const type = isIncome ? 'income' : 'expense';

    // 4. Clean Description
    let cleanDesc = segmentText
      .replace(/\b(?:rs\.?|inr|rupees|rupaye|rupay|bucks)\b/gi, '')
      .replace(/[₹$]/g, '')
      .replace(/\b(?:spent|paid|kharcha|diya|kharida|bheja|on|for|ka|ki|ke|liye)\b/gi, '')
      .replace(/\b(?:salary|income|bonus|cashback|credited|aaya|aayi|mila|mile|kamaya|interest|refund)\b/gi, '')
      .replace(/^[\s\-:–—]+|[\s\-:–—]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Specific Income source extraction
    let incomeSource = 'Salary';
    if (isIncome) {
      const sourceMatches = ['Bonus', 'Freelance', 'Salary', 'Cashback', 'Gift', 'Rental', 'Investment', 'Interest'];
      for (const sm of sourceMatches) {
        if (new RegExp(`\\b${sm}\\b`, 'i').test(seg)) {
          incomeSource = sm;
          break;
        }
      }
      if (incomeSource === 'Salary' && cleanDesc) {
        incomeSource = cleanDesc.charAt(0).toUpperCase() + cleanDesc.slice(1);
      }
    }

    // 5. Category Detection
    let category = null;
    const allCandidates = Array.from(new Set([...userCats, ...Object.keys(voiceSystemCategoryKeywords)]));

    for (const cand of allCandidates) {
      const regex = new RegExp(`(^|[^a-z0-9])${escapeVoiceRegex(cand.toLowerCase())}([^a-z0-9]|$)`, 'i');
      if (regex.test(cleanDesc.toLowerCase()) || regex.test(seg.toLowerCase())) {
        category = cand;
        break;
      }
    }

    if (!category) {
      for (const [catName, keywords] of Object.entries(voiceSystemCategoryKeywords)) {
        const match = keywords.some(kw => {
          const kwRegex = new RegExp(`(^|[^a-z0-9])${escapeVoiceRegex(kw)}([^a-z0-9]|$)`, 'i');
          return kwRegex.test(cleanDesc.toLowerCase()) || kwRegex.test(seg.toLowerCase());
        });
        if (match) {
          category = catName;
          break;
        }
      }
    }

    if (!category) {
      category = isIncome ? 'Salary' : 'Other';
    }

    const note = cleanDesc || (isIncome ? incomeSource : category);

    items.push({
      id: `vt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      amount,
      category: isIncome ? incomeSource : category,
      source: isIncome ? incomeSource : undefined,
      date,
      dateText,
      description: note,
      rawSegment: seg
    });
  }

  return items;
};

window.openVoiceModal = function () {
  activeVoiceTarget = null;
  const modal = document.getElementById("voiceModal");
  if (!modal) return;

  document.getElementById("voiceListeningSection")?.classList.remove("hidden");
  document.getElementById("voiceReviewSection")?.classList.add("hidden");

  const transcriptInput = document.getElementById("voiceTranscriptInput");
  if (transcriptInput) transcriptInput.value = "";

  const tipsContent = document.getElementById("voiceTipsContent");
  const tipsBtn = document.getElementById("voiceTipsToggleBtn");
  const tipsArrow = document.getElementById("voiceTipsArrow");
  if (tipsContent) tipsContent.classList.add("hidden");
  if (tipsBtn) tipsBtn.classList.remove("active");
  if (tipsArrow) tipsArrow.innerText = "▼";

  setVoiceListeningUI(false, "Ready — Tap Start to Speak");
  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");
};

window.toggleVoiceTips = function () {
  const content = document.getElementById("voiceTipsContent");
  const toggleBtn = document.getElementById("voiceTipsToggleBtn");
  const arrow = document.getElementById("voiceTipsArrow");
  if (!content) return;

  const isHidden = content.classList.contains("hidden");
  if (isHidden) {
    content.classList.remove("hidden");
    if (toggleBtn) toggleBtn.classList.add("active");
    if (arrow) arrow.innerText = "▲";
  } else {
    content.classList.add("hidden");
    if (toggleBtn) toggleBtn.classList.remove("active");
    if (arrow) arrow.innerText = "▼";
  }
};

window.closeVoiceModal = function () {
  window.stopVoiceRecognition();
  const modal = document.getElementById("voiceModal");
  if (modal) modal.classList.add("hidden");
  document.body.classList.remove("modal-open");
  voiceParsedTransactions = [];
  activeVoiceTarget = null;
};

function setVoiceListeningUI(listening, statusText) {
  isVoiceListening = listening;
  const micCircle = document.getElementById("voiceMicCircle");
  const micIcon = document.getElementById("voiceMicIcon");
  const statusBadge = document.getElementById("voiceStatusBadge");
  const statusLabel = document.getElementById("voiceStatusText");
  const toggleBtn = document.getElementById("voiceToggleBtn");
  const toggleIcon = document.getElementById("voiceToggleIcon");
  const toggleText = document.getElementById("voiceToggleText");

  if (listening) {
    if (micCircle) micCircle.classList.add("listening");
    if (micIcon) micIcon.innerText = "🛑";
    if (statusBadge) statusBadge.classList.add("active");
    if (statusLabel) statusLabel.innerText = statusText || "Listening... Speak now";

    if (toggleBtn) {
      toggleBtn.style.background = "linear-gradient(135deg, #ef4444, #f43f5e)";
      toggleBtn.style.boxShadow = "0 4px 20px rgba(239, 68, 68, 0.5)";
    }
    if (toggleIcon) toggleIcon.innerText = "⏹️";
    if (toggleText) toggleText.innerText = "Stop & Process";
  } else {
    if (micCircle) micCircle.classList.remove("listening");
    if (micIcon) micIcon.innerText = "🎤";
    if (statusBadge) statusBadge.classList.remove("active");
    if (statusLabel) statusLabel.innerText = statusText || "Ready — Tap Start to Speak";

    if (toggleBtn) {
      toggleBtn.style.background = "linear-gradient(135deg, #0284c7, #2563eb)";
      toggleBtn.style.boxShadow = "0 4px 15px rgba(2, 132, 199, 0.4)";
    }
    if (toggleIcon) toggleIcon.innerText = "🎙️";
    if (toggleText) toggleText.innerText = "Start Speaking";
  }
}

function cleanupVoiceEngine() {
  if (voiceRecognition) {
    try {
      voiceRecognition.onstart = null;
      voiceRecognition.onresult = null;
      voiceRecognition.onerror = null;
      voiceRecognition.onend = null;
      voiceRecognition.abort();
    } catch (e) { }
    voiceRecognition = null;
  }
}

let voiceLanguageFallbackTried = false;

window.initVoiceEngine = function (lang) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.lang = lang || 'en-IN'; // Indian English natively supports Hindi/Hinglish words

  recognition.onstart = function () {
    setVoiceListeningUI(true, "Listening... Speak now");
  };

  recognition.onresult = function (event) {
    let interim = "";
    let final = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        final += transcript;
      } else {
        interim += transcript;
      }
    }

    const currentText = (final || interim).trim();
    if (activeVoiceTarget === 'bulk') {
      const bulkInput = document.getElementById("scanTextInput");
      if (bulkInput && final) {
        bulkInput.value = (bulkInput.value ? bulkInput.value + "\n" : "") + final.trim();
      }
    } else {
      const transcriptInput = document.getElementById("voiceTranscriptInput");
      if (transcriptInput && currentText) {
        transcriptInput.value = currentText;
      }
    }
  };

  recognition.onerror = function (event) {
    console.warn("Speech Recognition Event:", event.error);
    if (event.error === 'network') {
      // If we haven't tried language fallback yet, try with default navigator language
      if (!voiceLanguageFallbackTried && recognition.lang === 'en-IN') {
        voiceLanguageFallbackTried = true;
        console.log("Retrying speech recognition with system language fallback...");
        cleanupVoiceEngine();
        setTimeout(() => {
          window.startVoiceRecognition(navigator.language || 'en-US');
        }, 300);
        return;
      }

      setVoiceListeningUI(false, "Cloud speech offline. You can type below!");
      const input = document.getElementById("voiceTranscriptInput");
      if (input) input.focus();
      showToast("Speech service network error. Please type notes directly below.", "warning");
    } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      setVoiceListeningUI(false, "Microphone access blocked.");
      showDialog(
        "Microphone Access Required",
        "Please allow microphone access in your browser settings (chrome://settings/content/microphone) or Windows Privacy Settings, or type your expense directly in the text box.",
        "warning"
      );
    } else if (event.error === 'no-speech') {
      setVoiceListeningUI(false, "No speech detected. Tap Start to try again.");
    } else {
      setVoiceListeningUI(false, "Mic stopped. Tap Start to speak.");
    }
  };

  recognition.onend = function () {
    if (isVoiceListening) {
      setVoiceListeningUI(false, "Ready — Tap Start to Speak");
    }
  };

  return recognition;
};

window.startVoiceRecognition = function (langOverride) {
  try {
    if (!langOverride) {
      voiceLanguageFallbackTried = false;
    }
    cleanupVoiceEngine();

    voiceRecognition = window.initVoiceEngine(langOverride);
    if (!voiceRecognition) {
      showToast("Speech recognition not supported in this browser. Please use Chrome, Edge, or type below.", "warning");
      return;
    }
    voiceRecognition.start();
  } catch (e) {
    console.error("Voice start error", e);
    setVoiceListeningUI(false, "Ready — Tap Start to Speak");
  }
};

window.stopVoiceRecognition = function () {
  if (voiceSilenceTimer) clearTimeout(voiceSilenceTimer);
  if (voiceRecognition) {
    try {
      voiceRecognition.stop();
    } catch (e) { }
  }
  setVoiceListeningUI(false, "Ready — Tap Start to Speak");
};

window.toggleVoiceRecognition = function () {
  if (isVoiceListening) {
    // User explicitly pressed Stop!
    window.stopVoiceRecognition();
    window.processVoiceTranscript();
  } else {
    // User explicitly pressed Start!
    window.startVoiceRecognition();
  }
};

// Process transcript into Option 1 Confirmation List
window.processVoiceTranscript = function () {
  window.stopVoiceRecognition();
  const transcriptInput = document.getElementById("voiceTranscriptInput");
  const text = transcriptInput ? transcriptInput.value.trim() : "";

  if (!text) {
    showToast("No speech detected. Please speak or type an expense.", "info");
    return;
  }

  // If shortcut target from expense/income modals
  if (activeVoiceTarget === 'expense') {
    const parsed = window.parseHinglishVoiceTranscript(text);
    if (parsed.length > 0) {
      const item = parsed[0];
      const amtInput = document.getElementById("expenseAmount");
      const catInput = document.getElementById("expenseCategory");
      const descInput = document.getElementById("expenseDesc");
      const dateInput = document.getElementById("expenseDate");
      if (amtInput) amtInput.value = item.amount;
      if (catInput && item.category) catInput.value = item.category;
      if (descInput) descInput.value = item.description;
      if (dateInput) dateInput.value = item.date;
      showToast(`Filled: ₹${item.amount} for ${item.category}`, "success");
    }
    window.closeVoiceModal();
    return;
  }

  if (activeVoiceTarget === 'income') {
    const parsed = window.parseHinglishVoiceTranscript(text);
    if (parsed.length > 0) {
      const item = parsed[0];
      const amtInput = document.getElementById("incomeAmount");
      const srcInput = document.getElementById("incomeSource");
      const dateInput = document.getElementById("incomeDate");
      if (amtInput) amtInput.value = item.amount;
      if (srcInput) srcInput.value = item.source || item.category;
      if (dateInput) dateInput.value = item.date;
      showToast(`Filled: ₹${item.amount} (${item.source || item.category})`, "success");
    }
    window.closeVoiceModal();
    return;
  }

  // Option 1 Multi-Item Flow
  const newItems = window.parseHinglishVoiceTranscript(text);
  if (newItems.length === 0) {
    showDialog(
      "No Valid Items Detected",
      `Could not recognize any amount in: <em>"${escapeVoiceHtml(text)}"</em>.<br/><br/>Kindly speak an amount along with the item, e.g.:<br/><code>Chai 50, petrol 300 aur dinner 450</code>`,
      "warning"
    );
    return;
  }

  // Append to current list (for "Speak Another" feature)
  voiceParsedTransactions = [...voiceParsedTransactions, ...newItems];
  renderVoiceConfirmationList();

  document.getElementById("voiceListeningSection")?.classList.add("hidden");
  document.getElementById("voiceReviewSection")?.classList.remove("hidden");
};

window.renderVoiceConfirmationList = function () {
  const container = document.getElementById("voiceItemsList");
  const summaryStrip = document.getElementById("voiceSummaryStrip");
  const countBadge = document.getElementById("voiceItemCountBadge");
  if (!container) return;

  if (voiceParsedTransactions.length === 0) {
    container.innerHTML = `<div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 0.88rem;">No transactions in list. Tap "Speak Another" to add.</div>`;
    if (summaryStrip) summaryStrip.innerHTML = "";
    if (countBadge) countBadge.innerText = "0 Items";
    return;
  }

  let totalExp = 0;
  let expCount = 0;
  let totalInc = 0;
  let incCount = 0;

  voiceParsedTransactions.forEach(item => {
    if (item.type === 'income') {
      incCount++;
      totalInc += Number(item.amount) || 0;
    } else {
      expCount++;
      totalExp += Number(item.amount) || 0;
    }
  });

  if (countBadge) countBadge.innerText = `${voiceParsedTransactions.length} Item${voiceParsedTransactions.length === 1 ? '' : 's'}`;

  if (summaryStrip) {
    summaryStrip.innerHTML = `
      <span>Total: <b>${voiceParsedTransactions.length}</b></span>
      ${expCount > 0 ? `<span style="color: #f87171;">Expenses (${expCount}): <b>₹${totalExp.toLocaleString('en-IN')}</b></span>` : ''}
      ${incCount > 0 ? `<span style="color: #4ade80;">Income (${incCount}): <b>₹${totalInc.toLocaleString('en-IN')}</b></span>` : ''}
    `;
  }

  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const userCats = Array.isArray(expenseCategories) ? expenseCategories.map(c => typeof c === 'string' ? c : c.name).filter(Boolean) : [];
  const allCategoryOptions = Array.from(new Set([...userCats, ...Object.keys(voiceSystemCategoryKeywords), 'Other']));

  container.innerHTML = voiceParsedTransactions.map((item, idx) => {
    const isIncome = item.type === 'income';
    const catOptions = allCategoryOptions.map(cat =>
      `<option value="${cat}" ${cat.toLowerCase() === (item.category || '').toLowerCase() ? 'selected' : ''}>${cat}</option>`
    ).join('');

    return `
      <div class="voice-item-card">
        <div class="voice-item-top">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="voice-type-badge ${isIncome ? 'income' : 'expense'}">
              ${isIncome ? '🟢 Income' : '🔴 Expense'}
            </span>
            <span style="font-size: 0.76rem; color: #94a3b8;">${item.dateText || 'Today'}</span>
          </div>
          <button type="button" class="voice-item-delete-btn" onclick="deleteVoiceItem(${idx})" title="Remove item">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>

        <div class="voice-item-fields">
          <div style="position: relative;">
            <span style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); color: ${isIncome ? '#34d399' : '#f87171'}; font-weight: 700; font-size: 0.85rem;">₹</span>
            <input type="number" value="${item.amount}" onchange="updateVoiceItem(${idx}, 'amount', this.value)" class="voice-input-sm" style="padding-left: 20px !important; font-weight: 700; color: ${isIncome ? '#34d399' : '#f87171'} !important; width: 100%;" min="1" step="any" placeholder="Amount" />
          </div>

          ${isIncome ? `
            <input type="text" value="${escapeVoiceHtml(item.source || item.category || 'Salary')}" onchange="updateVoiceItem(${idx}, 'source', this.value)" class="voice-input-sm" placeholder="Source (Salary, Bonus...)" style="width: 100%;" />
          ` : `
            <select onchange="updateVoiceItem(${idx}, 'category', this.value)" class="voice-input-sm" style="width: 100%; cursor: pointer;">
              ${catOptions}
            </select>
          `}

          <input type="date" value="${item.date}" max="${todayIso}" onchange="updateVoiceItem(${idx}, 'date', this.value)" class="voice-input-sm" style="width: 100%;" />

          <input type="text" value="${escapeVoiceHtml(item.description || '')}" onchange="updateVoiceItem(${idx}, 'description', this.value)" class="voice-input-sm voice-desc-field" placeholder="Note / Details (optional)" />
        </div>
      </div>
    `;
  }).join('');
};

window.updateVoiceItem = function (index, field, value) {
  if (voiceParsedTransactions[index]) {
    if (field === 'amount') {
      voiceParsedTransactions[index].amount = parseFloat(value) || 0;
    } else if (field === 'category') {
      voiceParsedTransactions[index].category = value;
    } else if (field === 'source') {
      voiceParsedTransactions[index].source = value;
      voiceParsedTransactions[index].category = value;
    } else if (field === 'date') {
      voiceParsedTransactions[index].date = value;
    } else if (field === 'description') {
      voiceParsedTransactions[index].description = value;
    }
    renderVoiceConfirmationList();
  }
};

window.deleteVoiceItem = function (index) {
  voiceParsedTransactions.splice(index, 1);
  renderVoiceConfirmationList();
  showToast("Item removed", "info");
};

window.voiceSpeakAnother = function () {
  document.getElementById("voiceReviewSection")?.classList.add("hidden");
  document.getElementById("voiceListeningSection")?.classList.remove("hidden");
  const transcriptInput = document.getElementById("voiceTranscriptInput");
  if (transcriptInput) transcriptInput.value = "";
  setVoiceListeningUI(false, "Ready — Tap Start to Speak");
};

window.transferVoiceToBulkScan = function () {
  if (!voiceParsedTransactions || voiceParsedTransactions.length === 0) {
    showToast("No transactions to transfer", "info");
    return;
  }

  const expenses = voiceParsedTransactions.filter(i => i.type === 'expense');
  if (expenses.length === 0) {
    showToast("No expenses to transfer to bulk table (incomes are not supported in bulk notes)", "info");
    return;
  }

  scannedExpensesData = expenses.map(item => {
    const displayDate = formatScanDisplayDate(item.date);
    const desc = (item.description && item.description.trim()) || item.category || 'Expense';
    return {
      date: item.date,
      rawDateText: displayDate,
      rawLine: `${displayDate} ${item.amount} ${desc}`.trim(),
      isValid: true,
      dateError: null,
      amount: Number(item.amount),
      category: item.category || 'Other',
      description: desc
    };
  });

  // Pre-populate the bulk notes textarea so that "<- Edit Notes" retains the lines!
  const bulkLines = scannedExpensesData.map(i => i.rawLine).join("\n");
  const scanTextInput = document.getElementById("scanTextInput");
  if (scanTextInput) {
    scanTextInput.value = bulkLines;
  }

  // Close voice modal
  window.closeVoiceModal();

  // Open scan modal directly WITHOUT calling resetScan()
  const scanModal = document.getElementById("scanModal");
  if (scanModal) {
    scanModal.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }

  document.getElementById("scanInputSection")?.classList.add("hidden");
  document.getElementById("scanPreviewSection")?.classList.remove("hidden");

  currentScanPage = 1;
  renderScanPreview(false);
  showToast(`Transferred ${expenses.length} item(s) to Bulk Preview!`, "success");
};

window.saveAllVoiceTransactions = async function () {
  if (!voiceParsedTransactions || voiceParsedTransactions.length === 0) {
    showToast("No transactions to save", "error");
    return;
  }

  // Validate dates
  for (const item of voiceParsedTransactions) {
    const val = validateClientExpenseDate(item.date);
    if (!val.isValid) {
      showDialog("Invalid Date", `Item "${item.description || item.category}": ${val.error}`, "warning");
      return;
    }
  }

  const saveBtn = document.getElementById("voiceSaveAllBtn");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerText = "⏳ Saving Transactions...";
  }

  try {
    const expensesToSave = voiceParsedTransactions
      .filter(i => i.type === 'expense')
      .map(i => ({
        date: i.date,
        amount: Number(i.amount),
        category: i.category,
        description: i.description || i.category
      }));

    const incomesToSave = voiceParsedTransactions
      .filter(i => i.type === 'income')
      .map(i => ({
        date: i.date,
        amount: Number(i.amount),
        source: i.source || i.category || 'Salary'
      }));

    let savedExpCount = 0;
    let savedIncCount = 0;

    // 1. Bulk Save Expenses
    if (expensesToSave.length > 0) {
      const res = await apiRequest("/expenses/bulk", "POST", expensesToSave);
      savedExpCount = res.results?.added?.length || expensesToSave.length;
    }

    // 2. Save Incomes sequentially
    for (const inc of incomesToSave) {
      await apiRequest("/income", "POST", inc);
      savedIncCount++;
    }

    const totalSaved = savedExpCount + savedIncCount;
    showToast(`🎉 Successfully saved ${totalSaved} transaction${totalSaved === 1 ? '' : 's'}!`, "success");

    window.closeVoiceModal();
    loadDashboard();
    loadRecentExpenses();

  } catch (err) {
    showDialog("Save Failed", err.message || "Could not save voice transactions.", "error");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerText = "✅ Save All Transactions";
    }
  }
};

window.startVoiceForModal = function (target) {
  activeVoiceTarget = target;
  window.openVoiceModal();
};

window.startVoiceForBulkNotes = function () {
  activeVoiceTarget = 'bulk';
  window.openVoiceModal();
};