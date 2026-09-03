import { apiRequest, showToast } from "./api.js";

const form = document.getElementById("loginForm");

function getSafeRedirect() {
  const redirectUrl = new URLSearchParams(window.location.search).get("redirect");
  if (redirectUrl) {
    try {
      const decoded = decodeURIComponent(redirectUrl);
      if (decoded.startsWith("/") && !decoded.startsWith("//")) {
        return decoded;
      }
    } catch (e) {
      console.warn("Invalid redirect URL param", e);
    }
  }
  return "/dashboard";
}

// Show friendly notice if user was redirected due to token expiry
if (new URLSearchParams(window.location.search).get("expired") === "true") {
  setTimeout(() => {
    showToast("Your session has expired. Please log in to continue.", "warning");
  }, 400);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  // Ensure overlay is visible
  const overlay = document.getElementById('validation-overlay');
  if (overlay) overlay.style.display = 'flex';

  const MIN_DELAY = 3000; // 3 seconds minimum
  const startTime = Date.now();

  try {
    const res = await apiRequest("/auth/login", "POST", {
      email,
      password
    });

    // Wait for minimum delay
    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_DELAY) {
      await new Promise(resolve => setTimeout(resolve, MIN_DELAY - elapsed));
    }

    // Save JWT, Avatar, and Name
    localStorage.setItem("token", res.token || res.data.token || res.data);
    const newAvatar = (res.user && res.user.avatar) || (res.data && res.data.user && res.data.user.avatar);
    if (newAvatar) {
      localStorage.setItem("userAvatar", newAvatar);
    } else {
      localStorage.removeItem("userAvatar");
    }
    const newName = (res.user && res.user.name) || (res.data && res.data.user && res.data.user.name) || (res.data && res.data.name);
    if (newName) localStorage.setItem("userName", newName);

    // Redirect to preserved redirect parameter or dashboard
    window.location.href = getSafeRedirect();
  } catch (err) {
    // Also wait on error for consistent experience
    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_DELAY) {
      await new Promise(resolve => setTimeout(resolve, MIN_DELAY - elapsed));
    }
    if (overlay) overlay.style.display = 'none';
    showToast(err.message, "error");
  }
});

/* ===============================
   GOOGLE LOGIN HANDLER
================================ */
window.handleCredentialResponse = async function (response) {
  try {
    // Send the Google token to your backend
    const res = await apiRequest("/auth/google", "POST", {
      token: response.credential
    });

    // Save JWT, Avatar and Name from your backend
    localStorage.setItem("token", res.token);
    if (res.user && res.user.avatar) {
      localStorage.setItem("userAvatar", res.user.avatar);
    } else {
      localStorage.removeItem("userAvatar");
    }
    if (res.user && res.user.name) {
      localStorage.setItem("userName", res.user.name);
    }

    showToast("Google login successful!", "success");
    setTimeout(() => {
      window.location.href = getSafeRedirect();
    }, 1000);
  } catch (err) {
    showToast(err.message, "error");
  }
};
