// GLOBAL SCOPE: Runs once on page load to immediately kick unauthenticated users back to login
const token = localStorage.getItem("token");

if (!token) {
  // Not logged in → redirect to login
  window.location.href = "/login";
}

// Global Avatar Sync
async function updateNavAvatars() {
  let avatarUrl = localStorage.getItem('userAvatar');
  if (avatarUrl === 'null' || avatarUrl === 'undefined') {
    avatarUrl = null;
    localStorage.removeItem('userAvatar');
  }
  // FUNCTION SCOPE: Fetches the freshest token at the exact moment this function runs (e.g. after an upload event)
  const token = localStorage.getItem("token");

  // If no avatar in storage, try fetching from server once
  if (!avatarUrl && token) {
    try {
      const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? "http://localhost:5000/api"
        : "https://dhanrekhabackend.onrender.com/api";

      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const result = await res.json();

      if (result && result.data && result.data.avatar) {
        avatarUrl = result.data.avatar;
        localStorage.setItem('userAvatar', avatarUrl);
      } else {
        return; // Still no avatar
      }
    } catch (e) {
      console.warn("Failed to fetch user avatar in authGuard", e);
      return;
    }
  }

  if (!avatarUrl || avatarUrl === 'null') return;

  // Find all profile navigation buttons (more resilient selector)
  const profileBtns = document.querySelectorAll('.nav-btn-profile[title="Your Profile"], .nav-btn-profile[title="Profile"], button[onclick*="profile"]');

  profileBtns.forEach(btn => {
    // 1. Mobile Icon replacement (SVG)
    const mobileIcon = btn.querySelector('.mobile-icon');

    // Make avatar URL absolute if relative
    let fullAvatarUrl = avatarUrl;
    if (avatarUrl && avatarUrl.startsWith('/')) {
      const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? "http://localhost:5000/api"
        : "https://dhanrekhabackend.onrender.com/api";
      const baseUrl = API_BASE.replace('/api', '');
      fullAvatarUrl = baseUrl + avatarUrl;
    }

    const svgIcon = "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M20%2021v-2a4%204%200%200%200-4-4H8a4%204%200%200%200-4%204v2%22%20%2F%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%227%22%20r%3D%224%22%20%2F%3E%3C%2Fsvg%3E";
    const onErrorMobile = `this.onerror=null; this.src='${svgIcon}'; this.style.borderRadius='0'; this.style.border='none';`;

    const imgHtml = `<img src="${fullAvatarUrl}" alt="Profile" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.2); vertical-align: middle;" onerror="${onErrorMobile}" />`;

    if (mobileIcon) {
      mobileIcon.innerHTML = imgHtml;
    }

    // 2. Desktop Text replacement (Emoji)
    const desktopText = btn.querySelector('.desktop-text');
    if (desktopText) {
      const currentText = desktopText.innerText;
      if (currentText.includes('👤') || currentText.toLowerCase().includes('profile')) {
        const svgIconDesktop = "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2218%22%20height%3D%2218%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M20%2021v-2a4%204%200%200%200-4-4H8a4%204%200%200%200-4%204v2%22%20%2F%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%227%22%20r%3D%224%22%20%2F%3E%3C%2Fsvg%3E";
        const onErrorDesktop = `this.onerror=null; this.src='${svgIconDesktop}'; this.style.borderRadius='0'; this.style.border='none';`;

        // If it has the emoji, replace it. Otherwise prepend.
        if (currentText.includes('👤')) {
          desktopText.innerHTML = currentText.replace('👤', `<img src="${fullAvatarUrl}" alt="" style="width: 18px; height: 18px; border-radius: 50%; object-fit: cover; margin-right: 6px; vertical-align: sub; border: 1px solid rgba(255,255,255,0.1);" onerror="${onErrorDesktop}" />`);
        } else {
          desktopText.innerHTML = `<img src="${fullAvatarUrl}" alt="" style="width: 18px; height: 18px; border-radius: 50%; object-fit: cover; margin-right: 6px; vertical-align: sub; border: 1px solid rgba(255,255,255,0.1);" onerror="${onErrorDesktop}" /> ` + currentText;
        }
      }
    }

    // 3. Fallback for buttons without spans (direct replacement of SVG/Text)
    if (!mobileIcon && !desktopText) {
      const svg = btn.querySelector('svg');
      if (svg) {
        svg.outerHTML = imgHtml;
      }
    }
  });
}

// Run on load
if (document.readyState === "complete" || document.readyState === "interactive") {
  updateNavAvatars();
} else {
  document.addEventListener("DOMContentLoaded", updateNavAvatars);
}

// Run when custom event is fired (from profile page)
window.addEventListener("avatarUpdated", updateNavAvatars);
