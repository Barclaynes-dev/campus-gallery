// ============================================================
//  public/js/admin-dashboard.js
//  Admin Dashboard: gallery view, photo upload, user management
// ============================================================

let allPhotos    = [];
let deleteTarget = null;
let selectedFiles = [];
let currentFileIndex = 0;

document.addEventListener("DOMContentLoaded", async () => {

  // ── Auth guard — admin only ──────────────────────────────
  const user = await CampusGallery.requireAuth(["admin"]);
  if (!user) return; // requireAuth handles the redirect

  // Set user name in chip
  const nameEl = document.getElementById("dashUserName");
  if (nameEl) nameEl.textContent = user.name || user.username;

  // ── Init all panels ──────────────────────────────────────
  initSidebar();
  initGalleryPanel();
  initUploadPanel();
  initUsersPanel();
  initDeleteModal();
  loadDashboardData();
});

// ══════════════════════════════════════════════════════════════
//  SIDEBAR & PANEL SWITCHING
// ══════════════════════════════════════════════════════════════
function initSidebar() {
  // Sidebar links → switch panel
  document.querySelectorAll(".sidebar__link[data-panel]").forEach(btn => {
    btn.addEventListener("click", () => switchPanel(btn.dataset.panel));
  });

  // Upload shortcut from gallery panel header
  const goUpload = document.getElementById("goToUploadBtn");
  if (goUpload) goUpload.addEventListener("click", () => switchPanel("upload"));

  // Mobile: open/close sidebar
  const menuBtn  = document.getElementById("dashMenuBtn");
  const sidebar  = document.getElementById("sidebar");
  const overlay  = document.getElementById("sidebarOverlay");
  const closeBtn = document.getElementById("sidebarClose");

  function openSidebar() {
    sidebar.classList.add("is-open");
    overlay.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }
  function closeSidebar() {
    sidebar.classList.remove("is-open");
    overlay.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  if (menuBtn) menuBtn.addEventListener("click", openSidebar);
  if (overlay) overlay.addEventListener("click", closeSidebar);
  if (closeBtn) closeBtn.addEventListener("click", closeSidebar);
}

function switchPanel(name) {
  // Hide all panels
  document.querySelectorAll(".dash-panel").forEach(p => p.style.display = "none");

  // Show target
  const panel = document.getElementById(`panel-${name}`);
  if (panel) panel.style.display = "block";

  // Update sidebar active state
  document.querySelectorAll(".sidebar__link[data-panel]").forEach(btn => {
    btn.classList.toggle("sidebar__link--active", btn.dataset.panel === name);
  });

  // Update topbar title
  const titles = { gallery: "Gallery", upload: "Upload Photo", users: "Friends" };
  const titleEl = document.getElementById("dashTopbarTitle");
  if (titleEl) titleEl.textContent = titles[name] || name;

  // Close mobile sidebar
  document.getElementById("sidebar").classList.remove("is-open");
  document.getElementById("sidebarOverlay").classList.remove("is-open");
  document.body.style.overflow = "";
}

// ══════════════════════════════════════════════════════════════
//  LOAD DASHBOARD DATA
// ══════════════════════════════════════════════════════════════
async function loadDashboardData() {
  try {
    // Load photos
    const photosRes = await fetch("/api/photos");
    allPhotos = await photosRes.json();
    renderAdminGrid(allPhotos);
    updateStats();
    buildYearTabs();

    // Load friend count
    const usersRes  = await fetch("/api/users");
    const users     = await usersRes.json();
    const el = document.getElementById("statTotalFriends");
    if (el) el.textContent = users.length;

  } catch (err) {
    console.error("Dashboard load error:", err);
  }
}

function updateStats() {
  const years = [...new Set(allPhotos.map(p => p.year))];
  setText("statTotalPhotos", allPhotos.length);
  setText("statTotalYears",  years.length);
}

// ══════════════════════════════════════════════════════════════
//  GALLERY PANEL — render admin grid
// ══════════════════════════════════════════════════════════════
function initGalleryPanel() {
  // Year tab switching is handled in buildYearTabs after data loads
}

function buildYearTabs() {
  const years  = [...new Set(allPhotos.map(p => p.year))].sort((a,b) => b - a);
  const filter = document.getElementById("dashYearFilter");
  if (!filter) return;

  filter.innerHTML = `<button class="year-tab year-tab--active" data-year="all">All</button>`;
  years.forEach(y => {
    const btn = document.createElement("button");
    btn.className    = "year-tab";
    btn.dataset.year = y;
    btn.textContent  = y;
    filter.appendChild(btn);
  });

  filter.querySelectorAll(".year-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      filter.querySelectorAll(".year-tab").forEach(b => b.classList.remove("year-tab--active"));
      btn.classList.add("year-tab--active");
      const filtered = btn.dataset.year === "all"
        ? allPhotos
        : allPhotos.filter(p => String(p.year) === btn.dataset.year);
      renderAdminGrid(filtered);
    });
  });
}

function renderAdminGrid(photos) {
  const grid  = document.getElementById("adminGrid");
  const empty = document.getElementById("adminGridEmpty");

  if (photos.length === 0) {
    grid.innerHTML = "";
    grid.appendChild(empty);
    empty.style.display = "flex";
    return;
  }

  empty.style.display = "none";
  // Clear all except the empty placeholder
  grid.innerHTML = "";

  photos.forEach(photo => {
    const item = document.createElement("div");
    item.className = "admin-photo-item";
    item.innerHTML = `
      <img src="${photo.image_url}" alt="${photo.title || ''}" loading="lazy" />
      <div class="admin-photo-item__overlay">
        <button class="admin-delete-btn" data-id="${photo.id}" data-title="${photo.title || 'this photo'}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          </svg>
          Delete
        </button>
      </div>
    `;

    // Delete button → open confirmation modal
    item.querySelector(".admin-delete-btn").addEventListener("click", e => {
      e.stopPropagation();
      openDeleteModal(photo.id, photo.title || "this photo");
    });

    grid.appendChild(item);
  });
}

// ══════════════════════════════════════════════════════════════
//  UPLOAD PANEL
// ══════════════════════════════════════════════════════════════
function initUploadPanel() {
  const dropzone  = document.getElementById("uploadDropzone");
  const fileInput = document.getElementById("fileInput");
  const browseBtn = document.getElementById("browseBtn");
  const clearBtn  = document.getElementById("clearFileBtn");
  const submitBtn = document.getElementById("uploadSubmitBtn");
  const cancelBtn = document.getElementById("uploadCancelBtn");
  
  const prevBtn = document.getElementById("previewPrevBtn");
  const nextBtn = document.getElementById("previewNextBtn");

  // Browse button
  browseBtn.addEventListener("click", e => { e.stopPropagation(); fileInput.click(); });

  // Click dropzone to browse
  dropzone.addEventListener("click", () => { if (selectedFiles.length === 0) fileInput.click(); });

  // File selected via input
  fileInput.addEventListener("change", () => {
    if (fileInput.files.length > 0) handleFilesSelected(fileInput.files);
  });

  // Drag and drop
  dropzone.addEventListener("dragover", e => {
    e.preventDefault();
    dropzone.classList.add("drag-over");
  });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
  dropzone.addEventListener("drop", e => {
    e.preventDefault();
    dropzone.classList.remove("drag-over");
    if (e.dataTransfer.files.length > 0) handleFilesSelected(e.dataTransfer.files);
  });

  // Clear preview
  clearBtn.addEventListener("click", e => {
    e.stopPropagation();
    removeCurrentFile();
  });

  if(prevBtn) prevBtn.addEventListener("click", e => {
    e.stopPropagation();
    navigatePreview(-1);
  });
  
  if(nextBtn) nextBtn.addEventListener("click", e => {
    e.stopPropagation();
    navigatePreview(1);
  });

  // Submit
  submitBtn.addEventListener("click", handleUpload);

  // Cancel
  cancelBtn.addEventListener("click", () => {
    clearAllPreviews();
    switchPanel("gallery");
  });
}

function handleFilesSelected(files) {
  const newFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
  
  if (selectedFiles.length + newFiles.length > 15) {
    showUploadResult("Maximum 15 photos allowed.", "error");
    return;
  }
  
  // Get last selected year, or default to 2025
  let defaultYear = "2025";
  if (selectedFiles.length > 0) {
    saveCurrentMeta();
    defaultYear = selectedFiles[selectedFiles.length - 1].meta.year;
  } else {
    defaultYear = document.getElementById("photoYear").value || "2025";
  }

  newFiles.forEach(file => {
    selectedFiles.push({
      file: file,
      meta: {
        title: "",
        people: "",
        location: "",
        photographer: "",
        year: defaultYear
      }
    });
  });

  if (selectedFiles.length > 0) {
    if (currentFileIndex >= selectedFiles.length) currentFileIndex = selectedFiles.length - 1;
    renderCurrentPreview();
    document.getElementById("dropzoneContent").style.display  = "none";
    document.getElementById("dropzonePreview").style.display = "block";
  }
}

function saveCurrentMeta() {
  if (selectedFiles.length === 0 || !selectedFiles[currentFileIndex]) return;
  
  selectedFiles[currentFileIndex].meta = {
    title: document.getElementById("photoTitle").value,
    people: document.getElementById("photoPeople").value,
    location: document.getElementById("photoLocation").value,
    photographer: document.getElementById("photoPhotographer").value,
    year: document.getElementById("photoYear").value
  };
}

function renderCurrentPreview() {
  if (selectedFiles.length === 0) {
    clearAllPreviews();
    return;
  }

  const current = selectedFiles[currentFileIndex];
  
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById("previewImg").src = e.target.result;
  };
  reader.readAsDataURL(current.file);
  
  document.getElementById("photoTitle").value = current.meta.title;
  document.getElementById("photoPeople").value = current.meta.people;
  document.getElementById("photoLocation").value = current.meta.location;
  document.getElementById("photoPhotographer").value = current.meta.photographer;
  document.getElementById("photoYear").value = current.meta.year || "2025";
  
  document.getElementById("previewCounter").textContent = `${currentFileIndex + 1} / ${selectedFiles.length}`;
  
  const prevBtn = document.getElementById("previewPrevBtn");
  const nextBtn = document.getElementById("previewNextBtn");
  if (prevBtn) prevBtn.disabled = currentFileIndex === 0;
  if (nextBtn) nextBtn.disabled = currentFileIndex === selectedFiles.length - 1;
}

function navigatePreview(direction) {
  saveCurrentMeta();
  currentFileIndex += direction;
  if (currentFileIndex < 0) currentFileIndex = 0;
  if (currentFileIndex >= selectedFiles.length) currentFileIndex = selectedFiles.length - 1;
  renderCurrentPreview();
}

function removeCurrentFile() {
  selectedFiles.splice(currentFileIndex, 1);
  if (currentFileIndex >= selectedFiles.length) {
    currentFileIndex = Math.max(0, selectedFiles.length - 1);
  }
  renderCurrentPreview();
}

function clearAllPreviews() {
  selectedFiles = [];
  currentFileIndex = 0;
  document.getElementById("fileInput").value = "";
  document.getElementById("previewImg").src = "";
  document.getElementById("dropzoneContent").style.display  = "flex";
  document.getElementById("dropzonePreview").style.display = "none";
  
  // Clear form
  document.getElementById("photoTitle").value = "";
  document.getElementById("photoPeople").value = "";
  document.getElementById("photoLocation").value = "";
  document.getElementById("photoPhotographer").value = "";
}

async function handleUpload() {
  if (selectedFiles.length === 0) {
    showUploadResult("Please select a photo first.", "error");
    return;
  }
  
  saveCurrentMeta(); // Ensure the currently viewed photo's inputs are saved

  const progressEl = document.getElementById("uploadProgress");
  const fillEl     = document.getElementById("uploadProgressFill");
  const submitBtn  = document.getElementById("uploadSubmitBtn");
  const progressText = document.getElementById("uploadProgressText");

  progressEl.style.display = "flex";
  submitBtn.disabled       = true;
  submitBtn.textContent    = "Uploading...";
  
  let successCount = 0;
  
  for (let i = 0; i < selectedFiles.length; i++) {
    const item = selectedFiles[i];
    
    // Jump to the current uploading file to show what's happening
    currentFileIndex = i;
    renderCurrentPreview();
    
    progressText.textContent = `Uploading ${i + 1} of ${selectedFiles.length}...`;
    fillEl.style.width = `${((i) / selectedFiles.length) * 100}%`;
    
    const formData = new FormData();
    formData.append("image",        item.file);
    formData.append("title",        item.meta.title.trim());
    formData.append("people_names", item.meta.people.trim());
    formData.append("location",     item.meta.location.trim());
    formData.append("photographer", item.meta.photographer.trim());
    formData.append("year",         item.meta.year);
    
    try {
      const res = await fetch("/api/photos", { method: "POST", body: formData });
      if (res.ok) {
        successCount++;
      } else {
        const data = await res.json();
        showUploadResult(`Error on photo ${i + 1}: ${data.error}`, "error");
        break; // Stop on error
      }
    } catch (err) {
      showUploadResult(`Connection error on photo ${i + 1}.`, "error");
      break;
    }
  }

  fillEl.style.width = "100%";
  
  if (successCount === selectedFiles.length) {
    progressText.textContent = "All photos uploaded!";
    showUploadResult(`✓ ${successCount} photo(s) uploaded successfully!`, "success");
    setTimeout(() => {
      clearAllPreviews();
      progressEl.style.display = "none";
      fillEl.style.width = "0%";
      loadDashboardData();
      switchPanel("gallery");
    }, 1500);
  } else if (successCount > 0) {
    // Partial success
    showUploadResult(`✓ ${successCount} photo(s) uploaded. Some failed.`, "error");
    // Remove the successful ones from the list
    selectedFiles.splice(0, successCount);
    currentFileIndex = 0;
    renderCurrentPreview();
    progressEl.style.display = "none";
  } else {
    progressEl.style.display = "none";
  }

  submitBtn.disabled = false;
  submitBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
    Upload to Gallery`;
}

function showUploadResult(msg, type) {
  const el = document.getElementById("uploadResult");
  el.textContent  = msg;
  el.className    = `upload-result upload-result--${type}`;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 4000);
}

// ══════════════════════════════════════════════════════════════
//  USERS PANEL
// ══════════════════════════════════════════════════════════════
function initUsersPanel() {
  document.getElementById("addUserBtn").addEventListener("click", handleAddUser);
}

async function loadUsers() {
  const list = document.getElementById("usersList");
  try {
    const res   = await fetch("/api/users");
    const users = await res.json();

    if (users.length === 0) {
      list.innerHTML = `<p class="users-list__loading">No friend accounts yet.</p>`;
      return;
    }

    list.innerHTML = users.map(u => `
      <div class="user-row">
        <div class="user-row__info">
          <span class="user-row__name">${u.display_name}</span>
          <span class="user-row__username">@${u.username}</span>
        </div>
        <button class="user-delete-btn" data-id="${u.id}" data-name="${u.display_name}">
          Remove
        </button>
      </div>
    `).join("");

    // Remove buttons
    list.querySelectorAll(".user-delete-btn").forEach(btn => {
      btn.addEventListener("click", () => handleRemoveUser(btn.dataset.id, btn.dataset.name, btn));
    });

  } catch (err) {
    list.innerHTML = `<p class="users-list__loading">Could not load friends.</p>`;
  }
}

async function handleAddUser() {
  const username    = document.getElementById("newUsername").value.trim();
  const displayName = document.getElementById("newDisplayName").value.trim();
  const password    = document.getElementById("newPassword").value;
  const resultEl    = document.getElementById("addUserResult");

  if (!username || !displayName || !password) {
    showAddUserResult("Please fill in all fields.", "error");
    return;
  }

  const btn = document.getElementById("addUserBtn");
  btn.disabled    = true;
  btn.textContent = "Adding...";

  try {
    const res  = await fetch("/api/users", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ username, display_name: displayName, password }),
    });
    const data = await res.json();

    if (res.ok) {
      showAddUserResult(`✓ @${username} added successfully!`, "success");
      document.getElementById("newUsername").value    = "";
      document.getElementById("newDisplayName").value = "";
      document.getElementById("newPassword").value    = "";
      loadUsers();
      // Update stats
      const el = document.getElementById("statTotalFriends");
      if (el) el.textContent = parseInt(el.textContent || "0") + 1;
    } else {
      showAddUserResult(data.error || "Failed to add friend.", "error");
    }
  } catch {
    showAddUserResult("Connection error.", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Friend`;
  }
}

async function handleRemoveUser(id, name, btn) {
  if (!confirm(`Remove @${name}? They will lose access immediately.`)) return;
  btn.disabled    = true;
  btn.textContent = "Removing...";
  try {
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    loadUsers();
  } catch {
    btn.disabled    = false;
    btn.textContent = "Remove";
  }
}

function showAddUserResult(msg, type) {
  const el = document.getElementById("addUserResult");
  el.textContent  = msg;
  el.className    = `add-user-result add-user-result--${type}`;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 4000);
}

// Load users when the panel is opened
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".sidebar__link[data-panel='users']").forEach(btn => {
    btn.addEventListener("click", loadUsers);
  });
});

// ══════════════════════════════════════════════════════════════
//  DELETE MODAL
// ══════════════════════════════════════════════════════════════
function initDeleteModal() {
  document.getElementById("cancelDeleteBtn").addEventListener("click", closeDeleteModal);
  document.getElementById("deleteModalBackdrop").addEventListener("click", closeDeleteModal);
  document.getElementById("confirmDeleteBtn").addEventListener("click", confirmDelete);
}

function openDeleteModal(photoId, photoTitle) {
  deleteTarget = photoId;
  document.getElementById("deleteModal").hidden = false;
}

function closeDeleteModal() {
  deleteTarget = null;
  document.getElementById("deleteModal").hidden = true;
}

async function confirmDelete() {
  if (!deleteTarget) return;
  const btn = document.getElementById("confirmDeleteBtn");
  btn.textContent = "Deleting...";
  btn.disabled    = true;

  try {
    const res = await fetch(`/api/photos/${deleteTarget}`, { method: "DELETE" });
    if (res.ok) {
      closeDeleteModal();
      await loadDashboardData();
    }
  } catch (err) {
    console.error("Delete error:", err);
  } finally {
    btn.textContent = "Yes, Delete";
    btn.disabled    = false;
  }
}

// ── Helpers ──────────────────────────────────────────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
