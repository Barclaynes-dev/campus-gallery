// ============================================================
//  public/js/gallery.js
//  Gallery page: masonry grid, year tabs, lightbox, GSAP
// ============================================================

// State
let allPhotos = [];
let filteredPhotos = [];
let currentIndex = 0;
let currentUser = null;

document.addEventListener("DOMContentLoaded", async () => {

  // ── Check session ────────────────────────────────────────
  const { loggedIn, user } = await CampusGallery.checkSession();
  currentUser = user;

  // Update nav login link
  const navLogin = document.getElementById("navLoginLink");
  if (loggedIn && navLogin) {
    navLogin.textContent = user.role === "admin" ? "Dashboard" : "My Space";
    navLogin.href = user.role === "admin"
      ? "/admin/dashboard.html"
      : "/friend/dashboard.html";
  }

  // ── Init everything ──────────────────────────────────────
  initGSAP();
  initMobileNav();
  initHeaderScroll();
  await loadPhotos();
  initLightbox();
  initBulkDownload();
  initSearch();
});

function initSearch() {
  const input = document.getElementById('gallerySearchInput');
  const btn = document.getElementById('gallerySearchBtn');

  if (!input || !btn) return;

  const performSearch = () => {
    const query = input.value.toLowerCase().trim();
    
    if (query === "") {
      filteredPhotos = [...allPhotos];
    } else {
      filteredPhotos = allPhotos.filter(p => {
        const title = (p.title || "").toLowerCase();
        const loc = (p.location || "").toLowerCase();
        const people = (p.people_names || "").toLowerCase();
        return title.includes(query) || loc.includes(query) || people.includes(query);
      });
    }

    // Reset year tabs to "All" since search overrides year filtering
    const tabs = document.getElementById('yearTabs');
    if (tabs) {
      tabs.querySelectorAll('.year-tab').forEach(b => b.classList.remove('year-tab--active'));
      const allTab = tabs.querySelector('[data-year="all"]');
      if (allTab) allTab.classList.add('year-tab--active');
    }

    renderGrid(filteredPhotos);
    updateViewCount(filteredPhotos.length);
    
    // Scroll to results if not at top
    if (window.scrollY > 400) {
      window.scrollTo({ top: 400, behavior: 'smooth' });
    }
  };

  btn.addEventListener('click', performSearch);
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performSearch();
  });
}

// Bulk selection state
let isSelectionMode = false;
let selectedPhotoIds = new Set();

function initBulkDownload() {
  const selectBtn = document.getElementById('bulkSelectBtn');
  const downloadBtn = document.getElementById('bulkDownloadBtn');

  if (!selectBtn) return;

  selectBtn.addEventListener('click', () => {
    isSelectionMode = !isSelectionMode;
    if (!isSelectionMode) {
      selectedPhotoIds.clear();
      updateBulkUI();
    }
    
    selectBtn.classList.toggle('btn--active', isSelectionMode);
    selectBtn.innerHTML = isSelectionMode 
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Cancel Selection'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> Select';
    
    document.getElementById('masonryGrid').classList.toggle('is-selecting', isSelectionMode);
    renderGrid(filteredPhotos); 
  });

  downloadBtn.addEventListener('click', () => {
    if (selectedPhotoIds.size === 0) return;

    const count = selectedPhotoIds.size;
    CampusGallery.showConfirm({
      title: "Bulk Download",
      message: `Download all ${count} selected photos? This will trigger multiple downloads.`,
      onConfirm: async () => {
        const ids = Array.from(selectedPhotoIds);
        const photosToDownload = allPhotos.filter(p => ids.includes(p.id));
        
        CampusGallery.showToast({ message: `Starting download for ${count} photos...`, type: "info" });

        // Trigger downloads with a small delay to avoid browser blocking
        for (let i = 0; i < photosToDownload.length; i++) {
          const photo = photosToDownload[i];
          // Ensure fl_attachment is added for forcing download
          const url = photo.image_url.replace('/upload/', '/upload/fl_attachment/');
          
          const link = document.createElement('a');
          link.href = url;
          // Set a unique filename
          link.download = `campus_gallery_${photo.id}.jpg`;
          document.body.appendChild(link);
          link.click();
          
          // Cleanup
          setTimeout(() => document.body.removeChild(link), 200);

          // Small delay between downloads to satisfy browser security
          if (i < photosToDownload.length - 1) {
            await new Promise(r => setTimeout(r, 800)); 
          }
        }

        CampusGallery.showToast({ message: "All downloads triggered!", type: "success" });
        
        // Reset selection
        isSelectionMode = false;
        selectedPhotoIds.clear();
        selectBtn.click(); // Reset UI via toggle
      }
    });
  });
}

function updateBulkUI() {
  const downloadBtn = document.getElementById('bulkDownloadBtn');
  const countEl = document.getElementById('bulkCount');
  
  if (selectedPhotoIds.size > 0) {
    downloadBtn.style.display = 'flex';
    countEl.textContent = selectedPhotoIds.size;
  } else {
    downloadBtn.style.display = 'none';
  }
}

// ══════════════════════════════════════════════════════════════
//  LOAD PHOTOS FROM SERVER
// ══════════════════════════════════════════════════════════════
async function loadPhotos() {
  try {
    const res = await fetch("/api/photos");

    // If not logged in, server returns 401
    if (res.status === 401) {
      showLoginPrompt();
      return;
    }

    allPhotos = await res.json();
    filteredPhotos = [...allPhotos];

    hideSkeleton();

    if (allPhotos.length === 0) {
      showEmpty();
      return;
    }

    buildYearTabs();
    renderGrid(allPhotos);
    updateStats();

  } catch (err) {
    console.error("Failed to load photos:", err);
    hideSkeleton();
    showEmpty();
  }
}

// ══════════════════════════════════════════════════════════════
//  YEAR TABS
// ══════════════════════════════════════════════════════════════
function buildYearTabs() {
  const years = [...new Set(allPhotos.map(p => p.year))].sort((a, b) => b - a);
  const tabsEl = document.getElementById("yearTabs");

  // Clear existing, keep "All Years"
  tabsEl.innerHTML = `<button class="year-tab year-tab--active" data-year="all">All Years</button>`;

  years.forEach(year => {
    const btn = document.createElement("button");
    btn.className = "year-tab";
    btn.dataset.year = year;
    btn.textContent = year;
    tabsEl.appendChild(btn);
  });

  // Update stat
  const statYears = document.getElementById("statYears");
  if (statYears) statYears.textContent = years.length;

  // Click handlers
  tabsEl.querySelectorAll(".year-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      tabsEl.querySelectorAll(".year-tab").forEach(b => b.classList.remove("year-tab--active"));
      btn.classList.add("year-tab--active");

      const year = btn.dataset.year;
      filteredPhotos = year === "all"
        ? [...allPhotos]
        : allPhotos.filter(p => String(p.year) === String(year));

      renderGrid(filteredPhotos);
      updateViewCount(filteredPhotos.length);
    });
  });
}

// ══════════════════════════════════════════════════════════════
//  RENDER MASONRY GRID
// ══════════════════════════════════════════════════════════════
function renderGrid(photos) {
  const grid = document.getElementById("masonryGrid");
  grid.style.display = "block";
  grid.innerHTML = "";

  if (photos.length === 0) {
    showEmpty();
    return;
  }
  document.getElementById("galleryEmpty").hidden = true;

  photos.forEach((photo, i) => {
    const item = document.createElement("div");
    // Every 5th item gets the "feature" class for a taller appearance
    item.className = `masonry-item${i % 5 === 0 ? " masonry-item--feature" : ""}`;
    if (isSelectionMode && selectedPhotoIds.has(photo.id)) {
      item.classList.add('is-selected');
    }
    item.dataset.index = i;

    item.innerHTML = `
      <div class="masonry-item__check">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <img
        src="${photo.image_url.replace('/upload/', '/upload/f_auto,q_auto,w_800,c_scale/')}"
        alt="${photo.title || 'Campus photo'}"
        loading="lazy"
      />
      <div class="masonry-item__overlay">
        <div class="masonry-item__overlay-title">${photo.title || 'Untitled'}</div>
        <div class="masonry-item__overlay-meta">
          ${photo.location ? photo.location + ' · ' : ''}${photo.year}
        </div>
      </div>
    `;

    item.addEventListener("click", () => {
      if (isSelectionMode) {
        if (selectedPhotoIds.has(photo.id)) {
          selectedPhotoIds.delete(photo.id);
          item.classList.remove('is-selected');
        } else {
          selectedPhotoIds.add(photo.id);
          item.classList.add('is-selected');
        }
        updateBulkUI();
      } else {
        openLightbox(i);
      }
    });
    grid.appendChild(item);
  });

  // Animate items in with GSAP stagger
  if (typeof gsap !== "undefined") {
    gsap.to(".masonry-item", {
      opacity: 1,
      scale: 1,
      y: 0,
      duration: 0.55,
      stagger: {
        each: 0.06,
        from: "start"
      },
      ease: "power3.out",
      clearProps: "transform"
    });

    // ScrollTrigger for items below the fold
    gsap.utils.toArray(".masonry-item").forEach((item, i) => {
      ScrollTrigger.create({
        trigger: item,
        start: "top 90%",
        onEnter: () => {
          gsap.to(item, {
            opacity: 1, scale: 1, y: 0,
            duration: 0.5, ease: "power3.out",
            delay: (i % 4) * 0.05
          });
        }
      });
    });
  } else {
    // Fallback: show all without animation
    document.querySelectorAll(".masonry-item").forEach(el => {
      el.style.opacity = "1";
      el.style.transform = "none";
    });
  }
}

// ══════════════════════════════════════════════════════════════
//  LIGHTBOX
// ══════════════════════════════════════════════════════════════
function initLightbox() {
  document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
  document.getElementById("lightboxBackdrop").addEventListener("click", closeLightbox);
  document.getElementById("lightboxPrev").addEventListener("click", () => navigateLightbox(-1));
  document.getElementById("lightboxNext").addEventListener("click", () => navigateLightbox(1));

  // Keyboard navigation
  document.addEventListener("keydown", e => {
    const lb = document.getElementById("lightbox");
    if (lb.hidden) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") navigateLightbox(-1);
    if (e.key === "ArrowRight") navigateLightbox(1);
  });

  // Favorite button
  const favBtn = document.getElementById("lbFavoriteBtn");
  if (favBtn) {
    favBtn.addEventListener("click", () => toggleFavorite(filteredPhotos[currentIndex]));
  }
}

function openLightbox(index) {
  currentIndex = index;
  const lightbox = document.getElementById("lightbox");
  lightbox.hidden = false;
  document.body.style.overflow = "hidden";

  populateLightbox(filteredPhotos[index]);

  // Animate in
  if (typeof gsap !== "undefined") {
    gsap.fromTo(".lightbox__content", 
      { opacity: 0, scale: 0.94 },
      { opacity: 1, scale: 1, duration: 0.45, ease: "power3.out" }
    );
  }
}

function closeLightbox() {
  const lightbox = document.getElementById("lightbox");

  if (typeof gsap !== "undefined") {
    gsap.to(".lightbox__content", {
      opacity: 0, scale: 0.94, duration: 0.3,
      ease: "power3.in",
      onComplete: () => {
        lightbox.hidden = true;
        document.body.style.overflow = "";
      }
    });
  } else {
    lightbox.hidden = true;
    document.body.style.overflow = "";
  }
}

function navigateLightbox(dir) {
  const newIndex = currentIndex + dir;
  if (newIndex < 0 || newIndex >= filteredPhotos.length) return;
  currentIndex = newIndex;

  // Slide transition
  if (typeof gsap !== "undefined") {
    gsap.to(".lightbox__img-wrap img", {
      opacity: 0, x: dir * -30, duration: 0.2,
      ease: "power2.in",
      onComplete: () => {
        populateLightbox(filteredPhotos[currentIndex]);
        gsap.fromTo(".lightbox__img-wrap img",
          { opacity: 0, x: dir * 30 },
          { opacity: 1, x: 0, duration: 0.3, ease: "power2.out" }
        );
      }
    });
  } else {
    populateLightbox(filteredPhotos[currentIndex]);
  }
}

function populateLightbox(photo) {
  if (!photo) return;

  // Show loader
  const loader = document.getElementById("lightboxLoader");
  const img = document.getElementById("lightboxImg");
  loader.style.display = "flex";
  img.style.opacity = "0";

  // Load image
  img.onload = () => {
    loader.style.display = "none";
    img.style.opacity = "1";
  };
  img.src = photo.image_url.replace('/upload/', '/upload/f_auto,q_auto/');
  img.alt = photo.title || "Campus photo";

  // Fill text
  setText("lbTitle", photo.title || "Untitled");
  setText("lbPeople", photo.people_names || "—");
  setText("lbLocation", photo.location || "—");
  setText("lbPhotographer", photo.photographer || "—");
  setText("lbYear", photo.year || "—");

  // Download options — based on original resolution
  const opts = CampusGallery.getAvailableResolutions(
    photo.original_width || 0,
    photo.original_height || 0
  );
  const dlContainer = document.getElementById("lbDownloadOptions");
  if (dlContainer) {
    if (opts.length === 0) {
      dlContainer.innerHTML = `<a href="${photo.image_url.replace('/upload/', '/upload/fl_attachment/')}" target="_blank" class="lb-res-btn">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Original
      </a>`;
    } else {
      dlContainer.innerHTML = opts.map(opt => `
        <a href="${getCloudinaryUrl(photo.image_url, photo.cloudinary_public_id, opt.value)}"
           download class="lb-res-btn" target="_blank">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          ${opt.label}
        </a>
      `).join("");
    }
  }

  // Show favorite button for logged-in friends
  const favBtn = document.getElementById("lbFavoriteBtn");
  if (favBtn && currentUser) {
    favBtn.style.display = "flex";
    // Reset state
    favBtn.classList.remove("is-saved");
    const span = favBtn.querySelector("span");
    if (span) span.textContent = "Save to Favorites";
  }

  // Update nav visibility
  document.getElementById("lightboxPrev").style.opacity = currentIndex === 0 ? "0.3" : "1";
  document.getElementById("lightboxNext").style.opacity = currentIndex === filteredPhotos.length - 1 ? "0.3" : "1";
}

// Build a Cloudinary URL for a specific resolution
function getCloudinaryUrl(originalUrl, publicId, width) {
  if (!publicId) return originalUrl.replace("/upload/", "/upload/fl_attachment/");
  return originalUrl.replace("/upload/", `/upload/fl_attachment,w_${width},c_scale/`);
}

// ── Toggle Favorite ──────────────────────────────────────────
async function toggleFavorite(photo) {
  if (!currentUser) {
    window.location.href = "/login.html";
    return;
  }
  const favBtn = document.getElementById("lbFavoriteBtn");
  try {
    const res = await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo_id: photo.id }),
    });
    if (res.ok) {
      favBtn.classList.add("is-saved");
      favBtn.querySelector("span").textContent = "Saved!";
    } else if (res.status === 409) {
      favBtn.querySelector("span").textContent = "Already saved";
    }
  } catch (err) {
    console.error("Favorite error:", err);
  }
}

// ══════════════════════════════════════════════════════════════
//  GSAP
// ══════════════════════════════════════════════════════════════
function initGSAP() {
  if (typeof gsap === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);

  gsap.from(".gallery-hero__text .label-tag", { opacity: 0, y: 20, duration: 0.8, delay: 0.2, ease: "power3.out" });
  gsap.from(".gallery-hero__text h1", { opacity: 0, y: 30, duration: 0.9, delay: 0.35, ease: "power3.out" });
  gsap.from(".gallery-hero__sub", { opacity: 0, y: 20, duration: 0.8, delay: 0.5, ease: "power3.out" });
  gsap.from(".stat-pill", { opacity: 0, y: 20, duration: 0.7, delay: 0.6, stagger: 0.1, ease: "back.out(1.4)" });
}

// ══════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function hideSkeleton() {
  const sk = document.getElementById("gallerySkeleton");
  if (sk) sk.style.display = "none";
}

function showEmpty() {
  document.getElementById("galleryEmpty").hidden = false;
  document.getElementById("masonryGrid").style.display = "none";
}

function showLoginPrompt() {
  hideSkeleton();
  const empty = document.getElementById("galleryEmpty");
  empty.hidden = false;
  empty.querySelector("h3").textContent = "Please sign in";
  empty.querySelector("p").textContent = "You need to be logged in to view the gallery.";
}

function updateStats() {
  const total = document.getElementById("statTotal");
  if (total) total.textContent = allPhotos.length;
  updateViewCount(allPhotos.length);
}

function updateViewCount(n) {
  const el = document.getElementById("viewCount");
  if (el) el.textContent = n;
}

function initHeaderScroll() {
  const header = document.getElementById("siteHeader");
  if (!header) return;
  window.addEventListener("scroll", () => {
    header.classList.toggle("scrolled", window.scrollY > 60);
  }, { passive: true });
}

function initMobileNav() {
  const btn = document.getElementById("mobileMenuBtn");
  const nav = document.getElementById("mobileNav");
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
