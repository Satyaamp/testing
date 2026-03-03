import { apiRequest } from "./api.js";

window.exportData = function () {
  document.getElementById("exportModal").classList.remove("hidden");
  document.body.classList.add("modal-open");
};

window.closeExportModal = function () {
  document.getElementById("exportModal").classList.add("hidden");
  document.body.classList.remove("modal-open");
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
      pointerEvents: "none",
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

  // 4. Set text and show
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
        img.src = `${data.avatarUrl}?t=${new Date().getTime()}`;
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