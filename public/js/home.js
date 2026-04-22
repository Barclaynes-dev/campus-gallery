// ============================================================
//  public/js/home.js — Home Page Logic
//  Handles: hero canvas, GSAP animations, Picture of Day,
//           infinite scroll band, header scroll, mobile nav
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {

  // ── 1. Update nav login link if already logged in ─────────
  const { loggedIn, user } = await CampusGallery.checkSession();
  const navLoginLink = document.getElementById("navLoginLink");
  if (loggedIn && navLoginLink) {
    navLoginLink.textContent = user.role === "admin" ? "Dashboard" : "My Space";
    navLoginLink.href = user.role === "admin"
      ? "/admin/dashboard.html"
      : "/friend/dashboard.html";
  }

  // ── 2. Hero Canvas — animated floating orbs/shapes ────────
  CampusGallery.initHeroCanvas();

  // ── 3. GSAP Animations ────────────────────────────────────
  initGSAP();

  // ── 4. Picture of the Day ─────────────────────────────────
  loadPictureOfDay();

  // ── 5. Infinite Scroll Band ───────────────────────────────
  loadScrollBand();

  // ── 6. Header shrink on scroll ────────────────────────────
  initHeaderScroll();

  // ── 7. Mobile nav ─────────────────────────────────────────
  initMobileNav();

  // ── 8. Photo count pill ───────────────────────────────────
  loadPhotoCount();
});



// ══════════════════════════════════════════════════════════════
//  GSAP ANIMATIONS
// ══════════════════════════════════════════════════════════════
function initGSAP() {
  if (typeof gsap === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);

  // ── Logo intro animation ───────────────────────────────────
  gsap.from(".js-logo", {
    opacity: 0, x: -20, duration: 0.8, delay: 0.1,
    ease: "power3.out"
  });
  gsap.from(".site-header__nav .nav-link", {
    opacity: 0, y: -10, duration: 0.6, delay: 0.2,
    stagger: 0.07, ease: "power2.out"
  });

  // ── Hero title — line by line reveal ──────────────────────
  gsap.from(".js-title-line", {
    y: "100%", opacity: 0, duration: 1,
    stagger: 0.12, ease: "power4.out", delay: 0.3
  });

  // ── Hero other elements ───────────────────────────────────
  gsap.from(".hero-content .label-tag, .hero-sub, .hero-ctas", {
    opacity: 0, y: 24, duration: 0.9,
    stagger: 0.12, ease: "power3.out", delay: 0.8
  });

  // ── Hero collage frames float in ──────────────────────────
  gsap.from(".js-collage-frame", {
    opacity: 0, y: 50, rotation: 0, duration: 1.2,
    stagger: 0.15, ease: "power3.out", delay: 0.6
  });

  // ── Hero pills float in ───────────────────────────────────
  gsap.from(".hero-pill", {
    opacity: 0, scale: 0.85, duration: 0.8,
    stagger: 0.1, ease: "back.out(1.7)", delay: 1.2
  });

  // ── Scroll hint ───────────────────────────────────────────
  gsap.from(".hero-scroll-hint", {
    opacity: 0, y: 10, duration: 0.8, delay: 1.8, ease: "power2.out"
  });

  // ── All .js-fade-up elements on scroll ────────────────────
  gsap.utils.toArray(".js-fade-up").forEach(el => {
    gsap.from(el, {
      scrollTrigger: {
        trigger: el,
        start: "top 88%",
        toggleActions: "play none none none"
      },
      opacity: 0, y: 36, duration: 0.9, ease: "power3.out"
    });
  });

  // ── Hero parallax on scroll ───────────────────────────────
  gsap.to(".hero-canvas", {
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: "bottom top",
      scrub: true
    },
    y: 80, opacity: 0.2
  });

  gsap.to(".hero-collage", {
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: "bottom top",
      scrub: 1.5
    },
    y: -60
  });

  // ── POTD section parallax ────────────────────────────────
  gsap.from(".potd-main", {
    scrollTrigger: {
      trigger: ".potd",
      start: "top 80%",
      toggleActions: "play none none none"
    },
    opacity: 0, x: -50, duration: 1.2, ease: "power3.out"
  });

  gsap.from(".potd-info", {
    scrollTrigger: {
      trigger: ".potd",
      start: "top 80%",
      toggleActions: "play none none none"
    },
    opacity: 0, x: 50, duration: 1.2, ease: "power3.out", delay: 0.2
  });

  // ── About teaser stacked images ───────────────────────────
  gsap.from(".visual-stack__img--back", {
    scrollTrigger: {
      trigger: ".about-teaser",
      start: "top 80%",
    },
    opacity: 0, rotation: 0, x: 30, duration: 1.2, ease: "power3.out"
  });

  gsap.from(".visual-stack__img--front", {
    scrollTrigger: {
      trigger: ".about-teaser",
      start: "top 80%",
    },
    opacity: 0, rotation: 0, x: -30, duration: 1.2, ease: "power3.out", delay: 0.15
  });
}

// ══════════════════════════════════════════════════════════════
//  PICTURE OF THE DAY
// ══════════════════════════════════════════════════════════════
async function loadPictureOfDay() {
  // Set today's date display
  const dateEl = document.getElementById("potdDate");
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });
  }

  try {
    const res  = await fetch("/api/photos/daily");
    const photo = await res.json();

    if (!photo) return; // No photos uploaded yet — placeholder stays

    // Show the image
    const img = document.getElementById("potdImage");
    const placeholder = document.getElementById("potdPlaceholder");

    if (img && placeholder) {
      img.src = photo.image_url.replace('/upload/', '/upload/f_auto,q_auto/');
      img.alt = photo.title || "Picture of the day";
      img.style.display = "block";
      placeholder.style.display = "none";

      img.addEventListener("load", () => {
        // If image is landscape, add class to trigger CSS panning motion
        if (img.naturalWidth > img.naturalHeight) {
          const wrap = img.closest(".potd-main__img-wrap");
          if (wrap) wrap.classList.add("is-landscape");
        }

        // Subtle reveal animation once image loads
        if (typeof gsap !== "undefined") {
          gsap.from(img, { opacity: 0, scale: 1.05, duration: 1.2, ease: "power3.out" });
        }
      });
    }

    // Fill in metadata
    setMeta("potdTitle",       photo.title        || "Untitled");
    setMetaRow("potdPeople",      photo.people_names  || "Unknown");
    setMetaRow("potdLocation",    photo.location      || "Campus");
    setMetaRow("potdPhotographer",photo.photographer  || "Unknown");
    setMetaRow("potdYear",        photo.year          || "—");

  } catch (err) {
    // No photos yet or server not running — placeholder stays, that's fine
    console.log("No daily photo available yet.");
  }
}

function setMeta(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setMetaRow(id, value) {
  const el = document.getElementById(id);
  if (el) el.querySelector("span").textContent = value;
}

// ══════════════════════════════════════════════════════════════
//  INFINITE SCROLL BAND
// ══════════════════════════════════════════════════════════════
async function loadScrollBand() {
  const track = document.getElementById("scrollTrack");
  if (!track) return;

  try {
    const res    = await fetch("/api/photos/recent");
    const photos = await res.json();

    if (!photos || photos.length === 0) return; // Keep placeholder

    // Build items HTML
    function buildItems(photoArr) {
      return photoArr.map(photo => `
        <div class="band-item" onclick="window.location.href='/gallery.html'">
          <img class="band-item__img" src="${photo.image_url.replace('/upload/', '/upload/f_auto,q_auto,w_600,c_scale/')}" alt="${photo.title || ''}" loading="lazy" />
          <div class="band-item__caption">${photo.location || photo.title || 'Campus'}</div>
        </div>
      `).join("");
    }

    // Double the content for seamless infinite loop
    track.innerHTML = buildItems(photos) + buildItems(photos);

  } catch (err) {
    console.log("Could not load recent photos for scroll band.");
  }
}

// ══════════════════════════════════════════════════════════════
//  HEADER SCROLL BEHAVIOUR
// ══════════════════════════════════════════════════════════════
function initHeaderScroll() {
  const header = document.getElementById("siteHeader");
  if (!header) return;

  window.addEventListener("scroll", () => {
    header.classList.toggle("scrolled", window.scrollY > 60);
  }, { passive: true });
}

// ══════════════════════════════════════════════════════════════
//  MOBILE NAV
// ══════════════════════════════════════════════════════════════
function initMobileNav() {
  const btn     = document.getElementById("mobileMenuBtn");
  const nav     = document.getElementById("mobileNav");
  const overlay = document.getElementById("mobileNavOverlay");
  if (!btn) return;

  function openNav() {
    nav.classList.add("is-open");
    overlay.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }

  function closeNav() {
    nav.classList.remove("is-open");
    overlay.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  btn.addEventListener("click", openNav);
  overlay.addEventListener("click", closeNav);
  nav.querySelectorAll("a").forEach(a => a.addEventListener("click", closeNav));
}

// ══════════════════════════════════════════════════════════════
//  PHOTO COUNT PILL
// ══════════════════════════════════════════════════════════════
async function loadPhotoCount() {
  try {
    const res    = await fetch("/api/photos");
    const photos = await res.json();
    const el     = document.getElementById("photoCount");
    if (el && Array.isArray(photos)) {
      el.textContent = photos.length || "0";
    }
  } catch {
    // Not logged in or no photos yet — leave as dash
  }
}
