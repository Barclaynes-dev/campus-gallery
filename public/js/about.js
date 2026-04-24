// ============================================================
//  public/js/about.js — About Page Logic
//  GSAP animations, timeline reveals, video placeholder
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  initGSAP();
  CampusGallery.initHeroCanvas();
  initVideo();
  initMobileNav();
  initHeaderScroll();
  void (async () => {
    const { loggedIn, user } = await CampusGallery.checkSession();
    const navLogin = document.getElementById("navLoginLink");
    if (loggedIn && navLogin) {
      navLogin.textContent = user.role === "admin" ? "Dashboard" : "My Space";
      navLogin.href = user.role === "admin"
        ? "/admin/dashboard.html"
        : "/friend/dashboard.html";
    }
  })();
});

// ══════════════════════════════════════════════════════════════
//  GSAP ANIMATIONS
// ══════════════════════════════════════════════════════════════
function initGSAP() {
  if (typeof gsap === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);

  // ── Hero title — line by line ────────────────────────────
  gsap.from(".split-line", {
    y: "110%", opacity: 0, duration: 1,
    stagger: 0.14, ease: "power4.out", delay: 0.3
  });

  // ── All .js-fade-up ──────────────────────────────────────
  gsap.utils.toArray(".js-fade-up").forEach(el => {
    gsap.from(el, {
      scrollTrigger: { trigger: el, start: "top 88%", toggleActions: "play none none none" },
      opacity: 0, y: 36, duration: 0.9, ease: "power3.out"
    });
  });

  // ── Hero image parallax ──────────────────────────────────
  gsap.to(".about-hero__img-frame", {
    scrollTrigger: {
      trigger: ".about-hero",
      start: "top top",
      end: "bottom top",
      scrub: 1.5
    },
    y: -50
  });

  // ── Mission quote — word by word reveal ─────────────────
  const quote = document.querySelector(".mission__quote");
  if (quote) {
    const words = quote.textContent.trim().split(" ");
    quote.innerHTML = words.map(w =>
      `<span class="word-wrap"><span class="word">${w}</span></span>`
    ).join(" ");

    gsap.from(".word", {
      scrollTrigger: { trigger: quote, start: "top 85%" },
      opacity: 0, y: 18,
      stagger: 0.035, duration: 0.5, ease: "power2.out"
    });
  }

  // ── Value cards — staggered ──────────────────────────────
  gsap.from(".value-card", {
    scrollTrigger: { trigger: ".values__grid", start: "top 85%" },
    opacity: 0, y: 40, scale: 0.96,
    stagger: 0.08, duration: 0.7, ease: "power3.out"
  });

  // ── Video section ────────────────────────────────────────
  gsap.from(".video-wrapper", {
    scrollTrigger: { trigger: ".video-wrapper", start: "top 85%" },
    opacity: 0, y: 50, scale: 0.97,
    duration: 1, ease: "power3.out"
  });

  // ── Timeline items ───────────────────────────────────────
  gsap.utils.toArray(".js-timeline-item").forEach((item, i) => {
    gsap.to(item, {
      scrollTrigger: { trigger: item, start: "top 85%", toggleActions: "play none none none" },
      opacity: 1, x: 0, duration: 0.8,
      delay: i * 0.1, ease: "power3.out"
    });
  });

  // ── CTA banner ───────────────────────────────────────────
  gsap.from(".about-cta__text", {
    scrollTrigger: { trigger: ".about-cta", start: "top 85%" },
    opacity: 0, x: -40, duration: 1, ease: "power3.out"
  });
  gsap.from(".about-cta__actions", {
    scrollTrigger: { trigger: ".about-cta", start: "top 85%" },
    opacity: 0, x: 40, duration: 1, ease: "power3.out", delay: 0.15
  });
}

// ══════════════════════════════════════════════════════════════
//  VIDEO PLACEHOLDER
// ══════════════════════════════════════════════════════════════
function initVideo() {
  const playBtn     = document.getElementById("videoPlayBtn");
  const placeholder = document.getElementById("videoPlaceholder");
  const video       = document.getElementById("aboutVideo");

  if (!playBtn) return;

  playBtn.addEventListener("click", () => {
    // If a real video source is added, show it
    if (video.querySelector("source")) {
      placeholder.style.display = "none";
      video.style.display       = "block";
      video.play();
    } else {
      // No video yet — animate the button to indicate "coming soon"
      playBtn.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.15)" }, { transform: "scale(1)" }],
        { duration: 300, easing: "ease-out" }
      );
      const sub = placeholder.querySelector(".video-placeholder__sub");
      if (sub) {
        sub.textContent = "Video coming soon — stay tuned!";
        sub.style.color = "#C8A96E";
      }
    }
  });
}

// ══════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════
function initHeaderScroll() {
  const header = document.getElementById("siteHeader");
  if (!header) return;
  window.addEventListener("scroll", () => {
    header.classList.toggle("scrolled", window.scrollY > 60);
  }, { passive: true });
}

function initMobileNav() {
  const btn     = document.getElementById("mobileMenuBtn");
  const nav     = document.getElementById("mobileNav");
  const overlay = document.getElementById("mobileNavOverlay");
  if (!btn) return;
  btn.addEventListener("click", () => {
    nav.classList.add("is-open");
    overlay.classList.add("is-open");
    document.body.style.overflow = "hidden";
  });
  overlay.addEventListener("click", () => {
    nav.classList.remove("is-open");
    overlay.classList.remove("is-open");
    document.body.style.overflow = "";
  });
}
