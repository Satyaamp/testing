const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:5000/api"
  : "https://dhanrekhabackend.onrender.com/api";

// 03-Sep-2026 SATYAM KUMAR
export const APP_VERSION = "v1.0.22";

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
    const currentPath = window.location.pathname + window.location.search;
    window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
    return;
  }

  if (!skipLoader) {
    activeRequests++;
    loaderDiv.classList.add('visible');
  }

  const isFormData = body instanceof FormData;
  const headers = {
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(!isFormData && { "Content-Type": "application/json" })
  };

  let res, data;
  try {
    res = await fetch(API_BASE + endpoint, {
      method,
      headers,
      body: isFormData ? body : (body ? JSON.stringify(body) : null)
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

  // Handle Token Expiry (401 Unauthorized) with proper redirect back to target page
  if (res.status === 401 && !window.location.pathname.includes('/login') && !window.location.pathname.includes('/signup')) {
    localStorage.removeItem("token");
    localStorage.removeItem("userAvatar");
    const currentPath = window.location.pathname + window.location.search;
    window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}&expired=true`;
    return;
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
