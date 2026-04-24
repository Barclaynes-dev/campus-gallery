// ============================================================
//  public/js/global.js
//  Runs on EVERY page. Handles:
//  - Light/Dark mode toggle (persistent via localStorage)
//  - Service Worker registration (PWA)
//  - Session check utility (used by other pages)
// ============================================================

// ── 1. Theme Toggle ──────────────────────────────────────────
const THEME_KEY = "campus-gallery-theme";

function applyTheme(theme) {
  // "dark" or "light"
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);

  // Update the toggle button icon
  const toggleBtn = document.querySelector(".theme-toggle");
  if (toggleBtn) {
    toggleBtn.setAttribute("aria-label", `Switch to ${theme === "dark" ? "light" : "dark"} mode`);
    toggleBtn.innerHTML = theme === "dark"
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>` // Sun icon for dark mode
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`; // Moon icon for light mode
  }
}

function initTheme() {
  // Load saved preference, default to "light"
  const saved = localStorage.getItem(THEME_KEY) || "light";
  applyTheme(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  applyTheme(current === "dark" ? "light" : "dark");
}

// Theme is set early via inline <head> script to avoid a light/dark flash; sync
// localStorage, aria-label, and toggle icon when this script runs.
initTheme();

// Attach toggle listener once DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.querySelector(".theme-toggle");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", toggleTheme);
  }
});

// ── 2. Service Worker Registration (PWA) ─────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const RELOAD_FLAG = "cg-sw-reloaded";

    // Reload once when a new SW takes control so users immediately get fresh JS/CSS.
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (sessionStorage.getItem(RELOAD_FLAG)) return;
      sessionStorage.setItem(RELOAD_FLAG, "1");
      window.location.reload();
    });

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("✅ Service Worker registered:", reg.scope);

        // If an updated worker is already waiting, activate it now.
        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        // Watch for newly installed updates and activate immediately.
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;

          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              installing.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      })
      .catch((err) => console.warn("⚠️ Service Worker failed:", err));
  });
}

// ── 3. Auth Session Utility ───────────────────────────────────
// Call this from any page to check if user is logged in
async function checkSession() {
  try {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    return data; // { loggedIn: true/false, user: {...} }
  } catch {
    return { loggedIn: false };
  }
}

// Redirect if user is not logged in (use on protected pages)
async function requireAuth(allowedRoles = []) {
  const { loggedIn, user } = await checkSession();

  if (!loggedIn) {
    window.location.href = "/login.html";
    return null;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    // Wrong role — redirect to their correct dashboard
    window.location.href = user.role === "admin"
      ? "/admin/dashboard.html"
      : "/friend/dashboard.html";
    return null;
  }

  return user;
}

// ── 4. Logout Helper ─────────────────────────────────────────
async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login.html";
}

// Attach to any element with data-action="logout"
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-action='logout']").forEach((el) => {
    el.addEventListener("click", logout);
  });
});

// ── 5. Shared Utility Functions ───────────────────────────────

// Format a date nicely: "April 2025"
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

// Determine available download resolutions based on original image size
function getAvailableResolutions(width, height) {
  const maxDim = Math.max(width, height);
  const options = [];

  if (maxDim >= 720) options.push({ label: "720p", value: "720" });
  if (maxDim >= 1080) options.push({ label: "1080p", value: "1080" });
  if (maxDim >= 2000) options.push({ label: "2K", value: "2000" });
  if (maxDim >= 3840) options.push({ label: "4K", value: "3840" });

  return options;
}

// Expose to other scripts
window.CampusGallery = {
  checkSession,
  requireAuth,
  logout,
  formatDate,
  getAvailableResolutions,
  toggleTheme,
  
  // ── 6. Custom Alerts (Modals & Toasts) ───────────────────────
  
  showConfirm({ title = "Confirm", message = "Are you sure?", onConfirm }) {
    // Cleanup any existing
    const existing = document.getElementById('cgConfirmBackdrop');
    if (existing) existing.remove();

    const backdrop = document.createElement('div');
    backdrop.id = 'cgConfirmBackdrop';
    backdrop.className = 'cg-modal-backdrop';
    backdrop.innerHTML = `
      <div class="cg-modal">
        <h3 class="cg-modal__title">${title}</h3>
        <p class="cg-modal__msg">${message}</p>
        <div class="cg-modal__actions">
          <button class="cg-modal__btn cg-modal__btn--cancel" id="cgConfirmCancel">Cancel</button>
          <button class="cg-modal__btn cg-modal__btn--confirm" id="cgConfirmOk">Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    
    // Animate in
    requestAnimationFrame(() => backdrop.classList.add('is-open'));

    const close = () => {
      backdrop.classList.remove('is-open');
      setTimeout(() => backdrop.remove(), 300);
    };

    backdrop.querySelector('#cgConfirmCancel').onclick = close;
    backdrop.querySelector('#cgConfirmOk').onclick = () => { onConfirm(); close(); };
  },

  showToast({ message, type = "info", duration = 3000 }) {
    const existing = document.querySelector('.cg-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `cg-toast cg-toast--${type}`;
    
    const icon = type === 'success' 
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

    toast.innerHTML = `${icon} <span>${message}</span>`;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('is-open'));

    setTimeout(() => {
      toast.classList.remove('is-open');
      setTimeout(() => toast.remove(), 400);
    }, duration);
  },

  initHeroCanvas() {
    const canvas = document.getElementById("heroCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function resize() {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    function isDark() {
      return document.documentElement.getAttribute("data-theme") === "dark";
    }

    const orbs = Array.from({ length: 6 }, (_, i) => ({
      x:    Math.random() * canvas.width,
      y:    Math.random() * canvas.height,
      r:    150 + Math.random() * 250,
      vx:   (Math.random() - 0.5) * 1.2, // Faster motion
      vy:   (Math.random() - 0.5) * 1.2, // Faster motion
      hue:  i < 3 ? 38 : 140,
      alpha: 0.08 + Math.random() * 0.1, // More visible
    }));

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // ONLY visible in dark mode as requested
      if (!isDark()) {
        requestAnimationFrame(draw);
        return;
      }

      orbs.forEach(orb => {
        orb.x += orb.vx;
        orb.y += orb.vy;
        if (orb.x < -orb.r || orb.x > canvas.width + orb.r)  orb.vx *= -1;
        if (orb.y < -orb.r || orb.y > canvas.height + orb.r) orb.vy *= -1;

        const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
        grad.addColorStop(0, `hsla(${orb.hue}, 60%, 55%, ${orb.alpha})`);
        grad.addColorStop(1, `hsla(${orb.hue}, 60%, 55%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
        ctx.fill();
      });

      requestAnimationFrame(draw);
    }
    draw();
  }
};
