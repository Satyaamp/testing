import { apiRequest, showToast } from "./api.js";

const form = document.getElementById("loginForm");

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

    // Save JWT and Avatar
    localStorage.setItem("token", res.token || res.data.token || res.data);
    const newAvatar = (res.user && res.user.avatar) || (res.data && res.data.user && res.data.user.avatar);
    if (newAvatar) {
      localStorage.setItem("userAvatar", newAvatar);
    } else {
      localStorage.removeItem("userAvatar");
    }

    // Redirect to dashboard
    window.location.href = "dashboard";
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

    // Save JWT and Avatar from your backend
    localStorage.setItem("token", res.token);
    if (res.user && res.user.avatar) {
      localStorage.setItem("userAvatar", res.user.avatar);
    } else {
      localStorage.removeItem("userAvatar");
    }

    showToast("Google login successful!", "success");
    setTimeout(() => window.location.href = "dashboard", 1000);
  } catch (err) {
    showToast(err.message, "error");
  }
};
