// ============================================================
//  public/js/login.js — Login Page Logic
//  Handles: form submit, password toggle, redirect after login
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {

  // ── If already logged in, redirect to correct dashboard ──
  const { loggedIn, user } = await CampusGallery.checkSession();
  if (loggedIn) {
    window.location.href = user.role === "admin"
      ? "/admin/dashboard.html"
      : "/friend/dashboard.html";
    return;
  }

  // ── Element refs ─────────────────────────────────────────
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const loginBtn      = document.getElementById("loginBtn");
  const loginSpinner  = document.getElementById("loginSpinner");
  const submitText    = loginBtn.querySelector(".login-submit__text");
  const errorBanner   = document.getElementById("loginError");
  const errorText     = document.getElementById("loginErrorText");
  const pwToggle      = document.getElementById("pwToggle");
  const eyeIcon       = document.getElementById("eyeIcon");

  // ── Password visibility toggle ───────────────────────────
  pwToggle.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";

    // Swap eye icon
    eyeIcon.innerHTML = isHidden
      ? // Eye-off icon (password visible)
        `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
         <line x1="1" y1="1" x2="23" y2="23"/>`
      : // Eye icon (password hidden)
        `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;

    pwToggle.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
  });

  // ── Show / hide error banner ──────────────────────────────
  function showError(message) {
    errorText.textContent = message;
    errorBanner.hidden    = false;
    // Shake animation
    errorBanner.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-6px)" },
        { transform: "translateX(6px)" },
        { transform: "translateX(-4px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 400, easing: "ease-out" }
    );
  }

  function hideError() {
    errorBanner.hidden = true;
  }

  // Clear error when user starts typing again
  [usernameInput, passwordInput].forEach((input) => {
    input.addEventListener("input", () => {
      hideError();
      input.closest(".form-field").classList.remove("has-error");
    });
  });

  // ── Set loading state on button ───────────────────────────
  function setLoading(isLoading) {
    loginBtn.classList.toggle("is-loading", isLoading);
    submitText.style.display   = isLoading ? "none" : "inline";
    loginSpinner.style.display = isLoading ? "inline" : "none";
  }

  // ── Login submit handler ──────────────────────────────────
  async function handleLogin() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    // Basic client-side validation
    let hasError = false;

    if (!username) {
      document.getElementById("fieldUsername").classList.add("has-error");
      hasError = true;
    }
    if (!password) {
      document.getElementById("fieldPassword").classList.add("has-error");
      hasError = true;
    }
    if (hasError) {
      showError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    hideError();

    try {
      const response = await fetch("/api/auth/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Server returned an error (wrong credentials etc.)
        showError(data.error || "Invalid credentials. Please try again.");
        document.getElementById("fieldUsername").classList.add("has-error");
        document.getElementById("fieldPassword").classList.add("has-error");
        setLoading(false);
        return;
      }

      // ✅ Login successful — redirect
      // Small delay so user sees the success state briefly
      submitText.style.display = "inline";
      loginSpinner.style.display = "none";
      loginBtn.textContent = "Welcome back ✦";
      loginBtn.style.pointerEvents = "none";

      setTimeout(() => {
        window.location.href = data.redirect;
      }, 700);

    } catch (err) {
      console.error("Login fetch error:", err);
      showError("Connection error. Please check your internet and try again.");
      setLoading(false);
    }
  }

  // Click handler
  loginBtn.addEventListener("click", handleLogin);

  // Enter key handler (on either input)
  [usernameInput, passwordInput].forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleLogin();
    });
  });

  // Focus username on load
  usernameInput.focus();
});
