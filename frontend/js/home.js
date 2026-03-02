// Register Service Worker first
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .catch(err => console.log("SW registration failed:", err));
  });
}

// Redirect logged-in user AFTER page is stable
if (localStorage.getItem("token")) {
  // Give browser time to detect PWA installability
  setTimeout(() => {
    window.location.href = "dashboard";
  }, 1500); // 🔥 Important delay
}
