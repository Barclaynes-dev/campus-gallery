// ============================================================
//  public/js/friend-dashboard.js
//  Friend Dashboard: favorites grid, categories, lightbox
// ============================================================

let allFavorites = [];
let allCategories = [];
let currentFavIndex = 0;
let assignTargetFavId = null;

// Bulk selection state
let isSelectionMode = false;
let selectedFavIds = new Set();

document.addEventListener("DOMContentLoaded", async () => {

  // ── Auth guard — friends only ────────────────────────────
  const user = await CampusGallery.requireAuth(["friend", "admin"]);
  if (!user) return;

  // Set display name
  setText("dashUserName", user.name || user.username);
  setText("sidebarFriendName", user.name || user.username);

  // ── Init ─────────────────────────────────────────────────
  initSidebar();
  initLightbox();
  initCategoriesPanel();
  initAssignModal();
  initBulkActions();
  await loadData();
});

function initBulkActions() {
  const selectBtn = document.getElementById('bulkSelectBtn');
  const deleteBtn = document.getElementById('bulkDeleteBtn');

  if (!selectBtn) return;

  selectBtn.addEventListener('click', () => {
    isSelectionMode = !isSelectionMode;
    if (!isSelectionMode) {
      selectedFavIds.clear();
      updateBulkUI();
    }
    
    selectBtn.classList.toggle('btn--active', isSelectionMode);
    selectBtn.innerHTML = isSelectionMode 
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Cancel Selection'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> Select';
    
    document.getElementById('favoritesGrid').classList.toggle('is-selecting', isSelectionMode);
    renderFavorites(allFavorites); 
  });

  deleteBtn.addEventListener('click', () => {
    if (selectedFavIds.size === 0) return;
    
    CampusGallery.showConfirm({
      title: "Remove Favorites",
      message: `Remove ${selectedFavIds.size} selected photo${selectedFavIds.size > 1 ? 's' : ''} from your favorites?`,
      onConfirm: async () => {
        try {
          const ids = Array.from(selectedFavIds);
          await Promise.all(ids.map(id => fetch(`/api/favorites/${id}`, { method: "DELETE" })));
          
          CampusGallery.showToast({
            message: `Successfully removed ${selectedFavIds.size} photo${selectedFavIds.size > 1 ? 's' : ''}`,
            type: "success"
          });
          
          isSelectionMode = false;
          selectedFavIds.clear();
          selectBtn.click(); // Reset UI via toggle
          await loadData();
        } catch (err) {
          CampusGallery.showToast({ message: "Failed to remove some favorites.", type: "error" });
        }
      }
    });
  });
}

function updateBulkUI() {
  const deleteBtn = document.getElementById('bulkDeleteBtn');
  const countEl = document.getElementById('bulkDeleteCount');
  
  if (selectedFavIds.size > 0) {
    deleteBtn.style.display = 'flex';
    countEl.textContent = selectedFavIds.size;
  } else {
    deleteBtn.style.display = 'none';
  }
}

// ══════════════════════════════════════════════════════════════
//  DATA LOADING
// ══════════════════════════════════════════════════════════════
async function loadData() {
  await Promise.all([loadFavorites(), loadCategories()]);
}

async function loadFavorites() {
  try {
    const res = await fetch("/api/favorites");
    allFavorites = await res.json();
    renderFavorites(allFavorites);
    setText("statFavCount", allFavorites.length);
    buildCategoryFilterTabs();
  } catch (err) {
    console.error("Could not load favorites:", err);
  }
}

async function loadCategories() {
  try {
    const res = await fetch("/api/favorites/categories");
    allCategories = await res.json();
    setText("statCatCount", allCategories.length);
    renderCategoriesList();
    buildCategoryFilterTabs();
  } catch (err) {
    console.error("Could not load categories:", err);
  }
}

// ══════════════════════════════════════════════════════════════
//  FAVORITES GRID
// ══════════════════════════════════════════════════════════════
function renderFavorites(favs) {
  const grid = document.getElementById("favoritesGrid");
  const empty = document.getElementById("favEmpty");

  // Clear existing items (keep empty state element)
  Array.from(grid.children).forEach(child => {
    if (child.id !== "favEmpty") child.remove();
  });

  if (favs.length === 0) {
    empty.style.display = "flex";
    return;
  }
  empty.style.display = "none";

  favs.forEach((fav, i) => {
    const item = document.createElement("div");
    item.className = "fav-item";
    item.dataset.favIndex = i;

    // Find category name
    const cat = allCategories.find(c => c.id === fav.category_id);
    const catBadge = cat
      ? `<div class="fav-item__cat-badge">${cat.name}</div>`
      : "";

    item.innerHTML = `
      ${catBadge}
      <div class="fav-item__check">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <img src="${fav.image_url.replace('/upload/', '/upload/f_auto,q_auto,w_800,c_scale/')}" alt="${fav.title || ''}" loading="lazy" />
      <div class="fav-item__overlay">
        <div class="fav-item__title">${fav.title || 'Untitled'}</div>
        <div class="fav-item__actions">
          <button class="fav-action-btn fav-action-btn--cat" data-fav-id="${fav.id}">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
            ${cat ? 'Move' : 'Categorise'}
          </button>
          <button class="fav-action-btn fav-action-btn--remove" data-fav-id="${fav.id}">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            Remove
          </button>
        </div>
      </div>
    `;

    // Interaction handler
    item.addEventListener('click', () => {
      if (isSelectionMode) {
        if (selectedFavIds.has(fav.id)) {
          selectedFavIds.delete(fav.id);
          item.classList.remove('is-selected');
        } else {
          selectedFavIds.add(fav.id);
          item.classList.add('is-selected');
        }
        updateBulkUI();
      } else {
        openLightbox(i, favs);
      }
    });

    // Categorise button
    item.querySelector(".fav-action-btn--cat").addEventListener("click", e => {
      e.stopPropagation();
      if (isSelectionMode) return;
      openAssignModal(fav.id);
    });

    // Remove button
    item.querySelector(".fav-action-btn--remove").addEventListener("click", async e => {
      e.stopPropagation();
      if (isSelectionMode) return;
      await removeFavorite(fav.id, item);
    });

    grid.appendChild(item);
  });
}

// ── Category filter tabs ──────────────────────────────────────
function buildCategoryFilterTabs() {
  const filter = document.getElementById("favCategoryFilter");
  if (!filter) return;

  filter.innerHTML = `<button class="year-tab year-tab--active" data-cat="all">All Saved</button>`;

  allCategories.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "year-tab";
    btn.dataset.cat = cat.id;
    btn.textContent = cat.name;
    filter.appendChild(btn);
  });

  // Uncategorised tab
  const uncatBtn = document.createElement("button");
  uncatBtn.className = "year-tab";
  uncatBtn.dataset.cat = "none";
  uncatBtn.textContent = "Uncategorised";
  filter.appendChild(uncatBtn);

  // Click handlers
  filter.querySelectorAll(".year-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      filter.querySelectorAll(".year-tab").forEach(b => b.classList.remove("year-tab--active"));
      btn.classList.add("year-tab--active");

      const cat = btn.dataset.cat;
      let filtered;
      if (cat === "all") {
        filtered = allFavorites;
      } else if (cat === "none") {
        filtered = allFavorites.filter(f => !f.category_id);
      } else {
        filtered = allFavorites.filter(f => String(f.category_id) === cat);
      }
      renderFavorites(filtered);
    });
  });
}

// ── Remove from favorites ─────────────────────────────────────
async function removeFavorite(favId, itemEl) {
  CampusGallery.showConfirm({
    title: "Remove Favorite",
    message: "Remove this photo from your favorites?",
    onConfirm: async () => {
      try {
        itemEl.style.opacity = "0.4";
        itemEl.style.pointerEvents = "none";
        await fetch(`/api/favorites/${favId}`, { method: "DELETE" });
        
        CampusGallery.showToast({
          message: "Photo removed from favorites",
          type: "success"
        });
        
        await loadData();
      } catch {
        itemEl.style.opacity = "1";
        itemEl.style.pointerEvents = "auto";
        CampusGallery.showToast({ message: "Failed to remove photo.", type: "error" });
      }
    }
  });
}

// ══════════════════════════════════════════════════════════════
//  LIGHTBOX
// ══════════════════════════════════════════════════════════════
let lightboxFavs = [];

function initLightbox() {
  document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
  document.getElementById("lightboxBackdrop").addEventListener("click", closeLightbox);
  document.getElementById("lightboxPrev").addEventListener("click", () => navLightbox(-1));
  document.getElementById("lightboxNext").addEventListener("click", () => navLightbox(1));

  document.addEventListener("keydown", e => {
    const lb = document.getElementById("lightbox");
    if (lb.hidden) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") navLightbox(-1);
    if (e.key === "ArrowRight") navLightbox(1);
  });

  // Remove from favorites via lightbox button
  document.getElementById("lbRemoveBtn").addEventListener("click", async () => {
    const fav = lightboxFavs[currentFavIndex];
    if (!fav) return;
    await fetch(`/api/favorites/${fav.id}`, { method: "DELETE" });
    closeLightbox();
    await loadData();
  });
}

function openLightbox(index, favs) {
  lightboxFavs = favs;
  currentFavIndex = index;
  document.getElementById("lightbox").hidden = false;
  document.body.style.overflow = "hidden";
  populateLightbox(favs[index]);
}

function closeLightbox() {
  document.getElementById("lightbox").hidden = true;
  document.body.style.overflow = "";
}

function navLightbox(dir) {
  const newIndex = currentFavIndex + dir;
  if (newIndex < 0 || newIndex >= lightboxFavs.length) return;
  currentFavIndex = newIndex;
  populateLightbox(lightboxFavs[currentFavIndex]);
}

function populateLightbox(fav) {
  if (!fav) return;
  const loader = document.getElementById("lightboxLoader");
  const img = document.getElementById("lightboxImg");
  loader.style.display = "flex";
  img.style.opacity = "0";
  img.onload = () => { loader.style.display = "none"; img.style.opacity = "1"; };
  img.src = fav.image_url;
  img.alt = fav.title || "";

  setText("lbTitle", fav.title || "Untitled");
  setText("lbPeople", fav.people_names || "—");
  setText("lbLocation", fav.location || "—");
  setText("lbPhotographer", fav.photographer || "—");
  setText("lbYear", fav.year || "—");

  // Download options
  const opts = CampusGallery.getAvailableResolutions(fav.original_width || 0, fav.original_height || 0);
  const dlEl = document.getElementById("lbDownloadOptions");
  dlEl.innerHTML = opts.length === 0
    ? `<a href="${fav.image_url.replace('/upload/', '/upload/fl_attachment/')}" target="_blank" class="lb-res-btn">Original</a>`
    : opts.map(o => `<a href="${fav.image_url.replace('/upload/', `/upload/fl_attachment,w_${o.value},c_scale/`)}"
         download target="_blank" class="lb-res-btn">${o.label}</a>`).join("");

  // Nav arrows opacity
  document.getElementById("lightboxPrev").style.opacity = currentFavIndex === 0 ? "0.3" : "1";
  document.getElementById("lightboxNext").style.opacity = currentFavIndex === lightboxFavs.length - 1 ? "0.3" : "1";
}

// ══════════════════════════════════════════════════════════════
//  CATEGORIES PANEL
// ══════════════════════════════════════════════════════════════
function initCategoriesPanel() {
  document.getElementById("createCatBtn").addEventListener("click", handleCreateCategory);
  document.getElementById("newCatName").addEventListener("keydown", e => {
    if (e.key === "Enter") handleCreateCategory();
  });
}

function renderCategoriesList() {
  const list = document.getElementById("catsList");
  const empty = document.getElementById("catsEmpty");

  if (allCategories.length === 0) {
    list.innerHTML = "";
    list.appendChild(empty || createEl("p", "cats-empty", "No categories yet. Create one above!"));
    return;
  }

  list.innerHTML = allCategories.map(cat => {
    const count = allFavorites.filter(f => f.category_id === cat.id).length;
    return `
      <div class="cat-row">
        <div class="cat-row__left">
          <div class="cat-row__icon">✦</div>
          <div class="cat-row__info">
            <span class="cat-row__name">${cat.name}</span>
            <span class="cat-row__count">${count} photo${count !== 1 ? "s" : ""}</span>
          </div>
        </div>
        <div class="cat-row__actions">
          <button class="cat-view-btn" data-cat-id="${cat.id}">View</button>
          <button class="cat-delete-btn" data-cat-id="${cat.id}" aria-label="Delete">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join("");

  // View → switch to favorites and filter by that category
  list.querySelectorAll(".cat-view-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      switchPanel("favorites");
      setTimeout(() => {
        const tab = document.querySelector(`.fav-category-filter [data-cat="${btn.dataset.catId}"]`);
        if (tab) tab.click();
      }, 100);
    });
  });

  // Delete category
  list.querySelectorAll(".cat-delete-btn").forEach(btn => {
    btn.addEventListener("click", () => handleDeleteCategory(btn.dataset.catId));
  });
}

async function handleCreateCategory() {
  const input = document.getElementById("newCatName");
  const name = input.value.trim();
  if (!name) return;

  const btn = document.getElementById("createCatBtn");
  btn.disabled = true;
  btn.textContent = "Creating...";

  try {
    const res = await fetch("/api/favorites/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();

    if (res.ok) {
      showCatResult(`✓ "${name}" created!`, "success");
      input.value = "";
      await loadData();
    } else {
      showCatResult(data.error || "Could not create.", "error");
    }
  } catch {
    showCatResult("Connection error.", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Create`;
  }
}

async function handleDeleteCategory(catId) {
  const cat = allCategories.find(c => String(c.id) === catId);
  
  CampusGallery.showConfirm({
    title: "Delete Category",
    message: `Delete category "${cat?.name}"? Photos will stay in your favorites but become uncategorised.`,
    onConfirm: async () => {
      await fetch(`/api/favorites/categories/${catId}`, { method: "DELETE" });
      CampusGallery.showToast({ message: `Category "${cat?.name}" deleted`, type: "success" });
      await loadData();
    }
  });
}

function showCatResult(msg, type) {
  const el = document.getElementById("catResult");
  el.textContent = msg;
  el.className = `cat-result cat-result--${type}`;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 3500);
}

// ══════════════════════════════════════════════════════════════
//  ASSIGN CATEGORY MODAL
// ══════════════════════════════════════════════════════════════
function initAssignModal() {
  document.getElementById("assignCatBackdrop").addEventListener("click", closeAssignModal);
  document.getElementById("assignCatCancel").addEventListener("click", closeAssignModal);
}

function openAssignModal(favId) {
  assignTargetFavId = favId;
  const list = document.getElementById("assignCatList");

  // Build options
  const options = [
    { id: null, name: "None (uncategorised)" },
    ...allCategories,
  ];

  list.innerHTML = options.map(cat => `
    <button class="assign-cat-option ${!cat.id ? 'assign-cat-option--none' : ''}"
            data-cat-id="${cat.id || ''}">
      ${cat.id ? "✦" : "○"} ${cat.name}
    </button>
  `).join("");

  // Click handler
  list.querySelectorAll(".assign-cat-option").forEach(btn => {
    btn.addEventListener("click", () => assignCategory(btn.dataset.catId || null));
  });

  document.getElementById("assignCatModal").hidden = false;
}

function closeAssignModal() {
  assignTargetFavId = null;
  document.getElementById("assignCatModal").hidden = true;
}

async function assignCategory(catId) {
  if (!assignTargetFavId) return;
  await fetch(`/api/favorites/${assignTargetFavId}/category`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category_id: catId || null }),
  });
  closeAssignModal();
  await loadData();
}

// ══════════════════════════════════════════════════════════════
//  SIDEBAR + PANEL SWITCHING
// ══════════════════════════════════════════════════════════════
function initSidebar() {
  document.querySelectorAll(".sidebar__link[data-panel]").forEach(btn => {
    btn.addEventListener("click", () => switchPanel(btn.dataset.panel));
  });

  const menuBtn = document.getElementById("dashMenuBtn");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  const closeBtn = document.getElementById("sidebarClose");

  const openSidebar = () => { sidebar.classList.add("is-open"); overlay.classList.add("is-open"); document.body.style.overflow = "hidden"; };
  const closeSidebar = () => { sidebar.classList.remove("is-open"); overlay.classList.remove("is-open"); document.body.style.overflow = ""; };

  if (menuBtn) menuBtn.addEventListener("click", openSidebar);
  if (overlay) overlay.addEventListener("click", closeSidebar);
  if (closeBtn) closeBtn.addEventListener("click", closeSidebar);
}

function switchPanel(name) {
  document.querySelectorAll(".dash-panel").forEach(p => p.style.display = "none");
  const panel = document.getElementById(`panel-${name}`);
  if (panel) panel.style.display = "block";

  document.querySelectorAll(".sidebar__link[data-panel]").forEach(btn => {
    btn.classList.toggle("sidebar__link--active", btn.dataset.panel === name);
  });

  const titles = { favorites: "My Favorites", categories: "My Categories" };
  setText("dashTopbarTitle", titles[name] || name);

  document.getElementById("sidebar").classList.remove("is-open");
  document.getElementById("sidebarOverlay").classList.remove("is-open");
  document.body.style.overflow = "";
}

// ── Helpers ──────────────────────────────────────────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function createEl(tag, cls, text) {
  const el = document.createElement(tag);
  el.className = cls;
  el.textContent = text;
  return el;
}
