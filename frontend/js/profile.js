import { apiRequest } from "./api.js";

window.exportData = async function () {
  try {
    const token = localStorage.getItem("token") || "";
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    let startStr = "";
    try {
      const meRes = await apiRequest("/auth/me", "GET", null, { skipLoader: true });
      if (meRes?.data?.createdAt) {
        startStr = new Date(meRes.data.createdAt).toISOString().split("T")[0];
      }
    } catch (e) {
      console.warn("Could not fetch user createdAt for export URL", e);
    }

    if (!startStr) {
      const d = new Date(today.getFullYear(), 0, 1);
      startStr = d.toISOString().split("T")[0];
    }

    const queryParams = new URLSearchParams({
      startDate: startStr,
      endDate: todayStr,
      page: "1",
      limit: "10"
    });

    if (token) {
      queryParams.set("token", token);
    }

    window.open(`/statement?${queryParams.toString()}`, "_blank");
  } catch (err) {
    console.error("Export launch error:", err);
    window.open("/statement", "_blank");
  }
};

window.confirmExport = async function () {
  window.closeExportModal();
  try {
    const blob = await apiRequest("/auth/export", "GET");

    // Create a blob and download
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `dhanrekha_backup_${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast("Data exported successfully!", "success");
  } catch (err) {
    showToast("Failed to export data: " + err.message, "error");
  }
};

/* ===================================================
   HELPERS FOR PDF GENERATION
=================================================== */
function formatINR(amount) {
  return Number(amount || 0).toLocaleString("en-IN");
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

/* ===================================================
   LIFETIME STATEMENT PDF (UP TO CURRENT DATE)
=================================================== */
window.downloadLifetimeStatementPDF = async function () {
  try {
    if (!window.jspdf) {
      showToast("PDF engine is initializing. Please try again in a moment.", "info");
      return;
    }

    if (window.closeExportModal) {
      window.closeExportModal();
    }

    showToast("Generating account statement...", "info");

    // 1. Fetch User Data
    const userRes = await apiRequest("/auth/me", "GET", null, { skipLoader: true });
    const user = userRes?.data || {};
    const userName = user.name || "User";
    const userEmail = user.email || "";

    // 2. Set Current Date as End Date (Inclusive of all today's transactions)
    const currentDate = new Date();
    const endISO = currentDate.toISOString().split("T")[0];

    // 3. Fetch All Historical Expenses and Incomes up to Current Date
    const [expRes, incRes] = await Promise.all([
      apiRequest(`/expenses?endDate=${endISO}`, "GET", null, { skipLoader: true }),
      apiRequest(`/income?endDate=${endISO}`, "GET", null, { skipLoader: true })
    ]);

    const expenses = expRes?.data || [];
    const incomes = incRes?.data || [];

    if (expenses.length === 0 && incomes.length === 0) {
      showToast("No transactions found in your account history.", "warning");
      return;
    }

    // 4. Aggregate Data
    const combined = [];
    let totalExpense = 0;
    let totalIncome = 0;

    expenses.forEach(e => {
      const amt = Number(e.amount || 0);
      totalExpense += amt;
      combined.push({
        date: new Date(e.date),
        type: "EXPENSE",
        category: e.category || "General",
        amount: amt
      });
    });

    incomes.forEach(i => {
      const amt = Number(i.amount || 0);
      totalIncome += amt;
      combined.push({
        date: new Date(i.date),
        type: "INCOME",
        category: "Income",
        amount: amt
      });
    });

    // Sort chronologically (oldest to newest)
    combined.sort((a, b) => a.date - b.date);

    const netBalance = totalIncome - totalExpense;

    // Determine statement start date (earliest transaction date or registration date)
    let regDateRaw = user.createdAt;
    if (!regDateRaw && user._id) {
      regDateRaw = new Date(parseInt(String(user._id).substring(0, 8), 16) * 1000);
    }
    const regDate = regDateRaw ? new Date(regDateRaw) : new Date();
    const earliestTxDate = combined[0]?.date || regDate;
    const startDate = (regDate < earliestTxDate) ? regDate : earliestTxDate;

    // 5. Assets (Avatar & Logo)
    let avatarBase64 = null;
    const userAvatar = user.avatar || localStorage.getItem("userAvatar");
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

    // 6. Initialize jsPDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");

    const addWatermark = (pDoc) => {
      pDoc.saveGraphicsState();
      pDoc.setFontSize(38);
      pDoc.setTextColor(230, 230, 230);
      pDoc.setFont("helvetica", "bold");
      pDoc.setGState(new pDoc.GState({ opacity: 0.08 }));
      pDoc.text("DHANREKHA VERIFIED", 105, 150, { align: "center", angle: 45 });
      pDoc.restoreGraphicsState();
    };

    const fmtDate = (d) => {
      const day = String(d.getDate()).padStart(2, '0');
      const month = d.toLocaleString('en-IN', { month: 'short' });
      const year = d.getFullYear();
      return `${day} ${month} ${year}`;
    };

    const periodStr = `${fmtDate(startDate)}  —  ${fmtDate(currentDate)}`;
    /* ===================================================
       PAGE 1: COVER PAGE
    =================================================== */
    doc.setFillColor(15, 32, 39);
    doc.rect(0, 0, 210, 297, "F");

    // Decorative Green Accent
    doc.setFillColor(34, 197, 94);
    doc.triangle(160, 297, 210, 297, 210, 240, "F");

    if (logoBase64) {
      try { doc.addImage(logoBase64, "PNG", 85, 38, 40, 40); } catch {}
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
      try { doc.addImage(avatarBase64, "PNG", 81, avatarY - 24, 48, 48); } catch {}
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
    const joinDateStr = fmtDate(regDate);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(134, 239, 172); // Subtle emerald green
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
      try { doc.addImage(logoBase64, "PNG", 14, 5, 22, 22); } catch {}
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
    doc.text(`${formatINR(totalIncome)}`, 22, 56);

    // Total Debit (DR)
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text("TOTAL DEBIT (DR)", 82, 47);
    doc.setFontSize(11);
    doc.setTextColor(220, 38, 38);
    doc.text(`${formatINR(totalExpense)}`, 82, 56);

    // Net Balance (Without INR prefix)
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text("NET BALANCE", 144, 47);
    doc.setFontSize(11);
    doc.setTextColor(netBalance >= 0 ? 22 : 220, netBalance >= 0 ? 163 : 38, netBalance >= 0 ? 74 : 38);
    doc.text(`${netBalance >= 0 ? '+' : '-'}${formatINR(Math.abs(netBalance))}`, 144, 56);

    // Clean table rows: Date | Category | Amount (NO INR, NO running balance)
    const tableRows = combined.map(item => {
      const isIncome = item.type === "INCOME";
      const prefix = isIncome ? "+" : "-";
      return [
        fmtDate(item.date),
        item.category,
        `${prefix}${formatINR(item.amount)}`
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
          const val = String(data.cell.raw || "");
          if (val.startsWith("+")) {
            data.cell.styles.textColor = [22, 163, 74];
          } else if (val.startsWith("-")) {
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

    const startStr = startDate.toISOString().split("T")[0];
    const filename = `DhanRekha_Statement_${startStr}_to_${endISO}.pdf`;
    doc.save(filename);
    showToast("Statement downloaded successfully!", "success");

  } catch (err) {
    console.error("Statement PDF error:", err);
    showToast("Failed to generate statement: " + err.message, "error");
  }
};

window.deleteAccount = function () {
  document.getElementById("deleteModal").classList.remove("hidden");
  document.body.classList.add("modal-open");
};

window.closeDeleteModal = function () {
  document.getElementById("deleteModal").classList.add("hidden");
  document.body.classList.remove("modal-open");
};

window.confirmDelete = async function () {
  try {
    await apiRequest("/auth/me", "DELETE");
    localStorage.removeItem("token");
    window.location.href = "/";
  } catch (err) {
    showToast(err.message, "error");
  }
};

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
    whiteSpace: "normal",
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
    toast.style.background = "rgba(34, 197, 94, 0.92)";
    toast.style.boxShadow = "0 8px 30px rgba(34, 197, 94, 0.35)";
  } else if (type === "info") {
    toast.style.background = "rgba(14, 165, 233, 0.92)";
    toast.style.boxShadow = "0 8px 30px rgba(14, 165, 233, 0.35)";
  } else if (type === "warning") {
    toast.style.background = "rgba(245, 158, 11, 0.92)";
    toast.style.boxShadow = "0 8px 30px rgba(245, 158, 11, 0.35)";
  } else {
    toast.style.background = "rgba(220, 38, 38, 0.92)";
    toast.style.boxShadow = "0 8px 30px rgba(220, 38, 38, 0.35)";
  }

  // 4. Set text and show with OK button
  if (toast.hideTimeout) clearTimeout(toast.hideTimeout);

  toast.innerHTML = "";
  const textSpan = document.createElement("span");
  textSpan.style.cssText = "flex: 1; word-break: break-word;";
  textSpan.innerText = message;
  toast.appendChild(textSpan);

  const okBtn = document.createElement("button");
  okBtn.innerText = "OK";
  okBtn.style.cssText = "margin-left: auto; background: rgba(255,255,255,0.22); border: 1px solid rgba(255,255,255,0.5); color: white; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: bold; flex-shrink: 0;";
  okBtn.onclick = () => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(20px)";
    if (toast.hideTimeout) clearTimeout(toast.hideTimeout);
  };
  toast.appendChild(okBtn);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";
  });

  toast.hideTimeout = setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(20px)";
  }, 3000);
}

/* ===============================
   AVATAR UPLOAD LOGIC
================================ */
const avatarContainer = document.getElementById('avatarContainer');
const avatarInput = document.getElementById('avatarInput');
const avatarOverlay = document.getElementById('avatarOverlay');

if (avatarContainer && avatarInput) {
  // Show overlay on hover
  avatarContainer.addEventListener('mouseenter', () => {
    if (avatarOverlay) avatarOverlay.style.opacity = '1';
  });
  avatarContainer.addEventListener('mouseleave', () => {
    if (avatarOverlay) avatarOverlay.style.opacity = '0';
  });

  // Click container to trigger file input
  avatarContainer.addEventListener('click', () => {
    avatarInput.click();
  });

  // Handle file selection
  avatarInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be less than 5MB', 'error');
      return;
    }

    // Prepare FormData
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      // Custom fetch for multipart/form-data (can't use standard apiRequest easily because it forces application/json)
      const token = localStorage.getItem('token');

      showToast('Uploading profile picture...', 'success'); // using success color as a neutral indicator

      const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? "http://localhost:5000/api"
        : "https://dhanrekhabackend.onrender.com/api";

      const res = await fetch(`${API_BASE}/auth/upload-avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to upload avatar');
      }

      // Success
      showToast('Profile picture updated!', 'success');

      // Update UI 
      const defaultSvg = document.getElementById('avatarDefault');
      const img = document.getElementById('avatarImg');

      if (defaultSvg && img) {
        defaultSvg.style.display = 'none';

        // Cache bust the image URL if replacing identically named image
        let fullAvatarUrl = data.avatarUrl;
        if (fullAvatarUrl && fullAvatarUrl.startsWith('/')) {
          const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
            ? "http://localhost:5000/api"
            : "https://dhanrekhabackend.onrender.com/api";
          const baseUrl = API_BASE.replace('/api', '');
          fullAvatarUrl = baseUrl + fullAvatarUrl;
        }

        img.src = `${fullAvatarUrl}?t=${new Date().getTime()}`;
        img.style.display = 'block';
      }

      // Update LocalStorage for navbars
      localStorage.setItem('userAvatar', data.avatarUrl);

      // Trigger a custom event so authGuard updates the navbar immediately
      window.dispatchEvent(new Event('avatarUpdated'));

    } catch (err) {
      console.error('Avatar upload error:', err);
      showToast(err.message, 'error');
    }
  });
}