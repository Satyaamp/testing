const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:5000/api"
  : "https://dhanrekhabackend.onrender.com/api";


export const APP_VERSION = "v1.0.20";

// Inject Global Loader CSS
const loaderStyle = document.createElement('style');
loaderStyle.textContent = `
  #global-loader {
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5);
    z-index: 9999;
    display: flex; justify-content: center; align-items: center;
    opacity: 0; pointer-events: none; transition: opacity 0.3s;
    backdrop-filter: blur(2px);
  }
  #global-loader.visible { opacity: 1; pointer-events: all; }
  .global-spinner {
    width: 50px; height: 50px;
    border: 4px solid rgba(255,255,255,0.3);
    border-top: 4px solid #22c55e;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
`;
document.head.appendChild(loaderStyle);

// Create Global Loader DOM
const loaderDiv = document.createElement('div');
loaderDiv.id = 'global-loader';
loaderDiv.innerHTML = '<div class="global-spinner"></div>';
document.body.appendChild(loaderDiv);

let activeRequests = 0;

export async function apiRequest(endpoint, method = "GET", body = null, { skipLoader = false } = {}) {
  let token = localStorage.getItem("token");

  // Validate token (Fix for [object Object] or malformed strings)
  if (token && (token.startsWith('[object') || token === 'undefined' || token === 'null')) {
    localStorage.removeItem("token");
    localStorage.removeItem("userAvatar");
    token = null;
    window.location.href = "/login";
    return;
  }

  if (!skipLoader) {
    activeRequests++;
    loaderDiv.classList.add('visible');
  }

  let res, data;
  try {
    res = await fetch(API_BASE + endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` })
      },
      body: body ? JSON.stringify(body) : null
    });

    // Handle 204 No Content (common for DELETE requests)
    if (res.status === 204) {
      return null;
    }

    // Check if response is JSON
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await res.json();
    } else if (contentType && (contentType.includes("zip") || contentType.includes("octet-stream"))) {
      data = await res.blob();
    } else {
      // Fallback for non-JSON (e.g. HTML error pages)
      data = { message: await res.text() };
    }
  } finally {
    if (!skipLoader) {
      activeRequests--;
      if (activeRequests <= 0) {
        activeRequests = 0;
        loaderDiv.classList.remove('visible');
      }
    }
  }

  if (!res.ok) {
    let msg = data.message || "Request failed";
    // If the error message looks like HTML, use the status text instead
    if (typeof msg === 'string' && msg.trim().startsWith('<')) {
      msg = `Request failed: ${res.status} ${res.statusText}`;
    }
    throw new Error(msg);
  }

  return data;
}

/* ===============================
   TOAST NOTIFICATION HELPER
================================ */
export function showToast(message, type = "error") {
  // 1. Play Beep Sound (Short, subtle alert)
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      const ctx = new AudioContext();
      // Chrome requires user gesture or resumed state
      if (ctx.state === 'running' || ctx.state === 'suspended') {
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
      bottom: "80px",
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
  toast.style.background = type === "success" ? "rgba(34, 197, 94, 0.85)" : "rgba(220, 38, 38, 0.75)";
  toast.style.boxShadow = type === "success" ? "0 8px 32px rgba(34, 197, 94, 0.3)" : "0 8px 32px rgba(220, 38, 38, 0.3)";

  // 4. Set text and show
  toast.innerText = message;
  toast.style.opacity = "1";
  toast.style.transform = "translateX(-50%) translateY(0)";

  if (toast.hideTimeout) clearTimeout(toast.hideTimeout);
  toast.hideTimeout = setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(20px)";
  }, 2000);
}
