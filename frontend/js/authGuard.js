// Check if JWT token exists
const token = localStorage.getItem("token");

if (!token) {
  // Not logged in → redirect to login
  window.location.href = "/";
}

// Global Avatar Sync
async function updateNavAvatars() {
  let avatarUrl = localStorage.getItem('userAvatar');
  if (avatarUrl === 'null' || avatarUrl === 'undefined') {
    avatarUrl = null;
    localStorage.removeItem('userAvatar');
  }
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

    const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>`;
    const onErrorMobile = `this.outerHTML='${svgIcon}'`;

    const imgHtml = `<img src="${fullAvatarUrl}" alt="Profile" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.2); vertical-align: middle;" onerror="${onErrorMobile}" />`;

    if (mobileIcon) {
      mobileIcon.innerHTML = imgHtml;
    }

    // 2. Desktop Text replacement (Emoji)
    const desktopText = btn.querySelector('.desktop-text');
    if (desktopText) {
      const currentText = desktopText.innerText;
      if (currentText.includes('👤') || currentText.toLowerCase().includes('profile')) {
        const onErrorDesktop = `this.outerHTML='👤'`;

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
