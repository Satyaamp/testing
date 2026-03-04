import { apiRequest, showToast } from "./api.js";

const form = document.getElementById("signupForm");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const btn = document.getElementById("signupBtn");
  const originalText = btn.innerText;

  // Ensure overlay is visible
  const overlay = document.getElementById('validation-overlay');
  if (overlay) overlay.style.display = 'flex';

  const MIN_DELAY = 3000; // 3 seconds minimum
  const startTime = Date.now();

  try {
    btn.disabled = true;

    await apiRequest("/auth/register", "POST", {
      name,
      email,
      password
    });

    // Wait for minimum delay
    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_DELAY) {
      await new Promise(resolve => setTimeout(resolve, MIN_DELAY - elapsed));
    }

    showToast("Registration successful. Redirecting...", "success");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 1000);
  } catch (err) {
    // Also wait on error for consistent experience
    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_DELAY) {
      await new Promise(resolve => setTimeout(resolve, MIN_DELAY - elapsed));
    }

    if (overlay) overlay.style.display = 'none';
    showToast(err.message, "error");
    btn.disabled = false;
    btn.innerText = originalText;
  }
});
