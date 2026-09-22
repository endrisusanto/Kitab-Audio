/**
 * Kitab Audio Web Application - Main Script
 * Antislop & Ponytail Compliant: Clean architecture, zero bloat, instant performance.
 */

(function () {
  let db = null;
  let currentCategory = null;
  let currentView = "grid"; // "grid" | "table"
  let selectedTiers = new Set();
  let searchQuery = "";
  let currentSort = "tier"; // "tier" | "price_asc" | "price_desc" | "name"
  let minPriceFilter = 0;
  let maxPriceFilter = 25000000;
  let compareList = [];

  // DOM Elements
  const catNav = document.getElementById("categoryNav");
  const catalogContainer = document.getElementById("catalogContainer");
  const searchInput = document.getElementById("searchInput");
  const sortSelect = document.getElementById("sortSelect");
  const tierPills = document.querySelectorAll(".tier-pill");
  const minPriceInput = document.getElementById("minPriceInput");
  const maxPriceInput = document.getElementById("maxPriceInput");
  const priceRangeLabel = document.getElementById("priceRangeLabel");
  const minPriceDisplay = document.getElementById("minPriceDisplay");
  const maxPriceDisplay = document.getElementById("maxPriceDisplay");
  const sliderHighlight = document.getElementById("sliderHighlight");
  const presetPills = document.querySelectorAll(".preset-pill");
  const viewGridBtn = document.getElementById("viewGridBtn");
  const viewTableBtn = document.getElementById("viewTableBtn");
  const categoryTitle = document.getElementById("categoryTitle");
  const categoryNotes = document.getElementById("categoryNotes");
  const modalOverlay = document.getElementById("productModal");
  const modalBody = document.getElementById("modalBody");
  const compareDrawer = document.getElementById("compareDrawer");
  const compareListEl = document.getElementById("compareList");
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const conciergeToggleBtn = document.getElementById("conciergeToggleBtn");
  const conciergePanel = document.getElementById("conciergePanel");
  const readmeModal = document.getElementById("readmeModal");
  const readmeBody = document.getElementById("readmeBody");
  const openUploadBtn = document.getElementById("openUploadBtn");
  const uploadModal = document.getElementById("uploadModal");
  const closeUploadModalBtn = document.getElementById("closeUploadModalBtn");
  const cancelUploadBtn = document.getElementById("cancelUploadBtn");
  const uploadDropzone = document.getElementById("uploadDropzone");
  const excelFileInput = document.getElementById("excelFileInput");
  const selectedFileInfo = document.getElementById("selectedFileInfo");
  const selectedFileName = document.getElementById("selectedFileName");
  const selectedFileSize = document.getElementById("selectedFileSize");
  const submitUploadBtn = document.getElementById("submitUploadBtn");
  const uploadStatusMsg = document.getElementById("uploadStatusMsg");
  let selectedUploadFile = null;

  // Init App
  async function init() {
    setupTheme();
    setupEventListeners();

    try {
      const resp = await fetch("data/audio_data.json");
      if (!resp.ok) throw new Error("Gagal memuat database audio");
      db = await resp.json();

      renderCategoryTabs();
      updatePriceRangeUI();
      selectCategory(db.categories[0]?.name || "TWS");

      // Initialize Typewriter Concierge
      if (window.AudioConcierge) {
        new window.AudioConcierge(
          "typewriterOutput",
          "conciergeOptions",
          "conciergeResults",
          db,
          (product) => openProductModal(product)
        );
      }
    } catch (err) {
      console.error(err);
      catalogContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">Gagal Memuat Data</div>
          <div class="empty-state-desc">Pastikan file data audio_data.json tersedia di folder src/data/.</div>
        </div>
      `;
    }
  }

  // Theme Manager
  function setupTheme() {
    const savedTheme = localStorage.getItem("kitab_audio_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    updateThemeIcon(savedTheme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("kitab_audio_theme", next);
    updateThemeIcon(next);
  }

  function updateThemeIcon(theme) {
    if (!themeToggleBtn) return;
    themeToggleBtn.innerHTML = theme === "dark" 
      ? `<span>☀️ Mode Terang</span>` 
      : `<span>🌙 Mode Gelap</span>`;
  }

  // Event Listeners
  function setupEventListeners() {
    if (themeToggleBtn) themeToggleBtn.onclick = toggleTheme;

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderCatalog();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        currentSort = e.target.value;
        renderCatalog();
      });
    }

    tierPills.forEach((pill) => {
      pill.addEventListener("click", () => {
        const tier = pill.getAttribute("data-tier");
        if (tier === "ALL") {
          selectedTiers.clear();
          tierPills.forEach((p) => p.classList.remove("active"));
          pill.classList.add("active");
        } else {
          document.querySelector('.tier-pill[data-tier="ALL"]')?.classList.remove("active");
          if (selectedTiers.has(tier)) {
            selectedTiers.delete(tier);
            pill.classList.remove("active");
          } else {
            selectedTiers.add(tier);
            pill.classList.add("active");
          }
          if (selectedTiers.size === 0) {
            document.querySelector('.tier-pill[data-tier="ALL"]')?.classList.add("active");
          }
        }
        renderCatalog();
      });
    });

    // Dual Price Range Slider
    if (minPriceInput && maxPriceInput) {
      minPriceInput.addEventListener("input", (e) => {
        let val = parseInt(e.target.value, 10);
        if (val > maxPriceFilter - 100000) {
          val = maxPriceFilter - 100000;
          minPriceInput.value = val;
        }
        minPriceFilter = Math.max(0, val);
        updatePriceRangeUI();
        renderCatalog();
      });

      maxPriceInput.addEventListener("input", (e) => {
        let val = parseInt(e.target.value, 10);
        if (val < minPriceFilter + 100000) {
          val = minPriceFilter + 100000;
          maxPriceInput.value = val;
        }
        maxPriceFilter = Math.min(25000000, val);
        updatePriceRangeUI();
        renderCatalog();
      });
    }

    presetPills.forEach((pill) => {
      pill.addEventListener("click", () => {
        const minVal = parseInt(pill.getAttribute("data-min") || "0", 10);
        const maxVal = parseInt(pill.getAttribute("data-max") || "25000000", 10);
        minPriceFilter = minVal;
        maxPriceFilter = maxVal;
        if (minPriceInput) minPriceInput.value = minVal;
        if (maxPriceInput) maxPriceInput.value = maxVal;
        updatePriceRangeUI();
        renderCatalog();
      });
    });

    if (viewGridBtn && viewTableBtn) {
      viewGridBtn.onclick = () => {
        currentView = "grid";
        viewGridBtn.classList.add("active");
        viewTableBtn.classList.remove("active");
        renderCatalog();
      };
      viewTableBtn.onclick = () => {
        currentView = "table";
        viewTableBtn.classList.add("active");
        viewGridBtn.classList.remove("active");
        renderCatalog();
      };
    }

    if (conciergeToggleBtn && conciergePanel) {
      conciergeToggleBtn.onclick = () => {
        const isHidden = conciergePanel.style.display === "none";
        conciergePanel.style.display = isHidden ? "block" : "none";
        conciergeToggleBtn.textContent = isHidden ? "Sembunyikan Panduan" : "Tanya Panduan Audio";
      };
    }

    // Modal Close
    modalOverlay.onclick = (e) => {
      if (e.target === modalOverlay) closeModal();
    };

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeModal();
        closeReadmeModal();
      }
    });

    // Readme button
    const openReadmeBtn = document.getElementById("openReadmeBtn");
    if (openReadmeBtn) {
      openReadmeBtn.onclick = openReadme;
    }

    // Upload Excel Modal
    if (openUploadBtn) {
      openUploadBtn.onclick = openUploadModal;
    }

    if (closeUploadModalBtn) {
      closeUploadModalBtn.onclick = closeUploadModal;
    }

    if (cancelUploadBtn) {
      cancelUploadBtn.onclick = closeUploadModal;
    }

    if (uploadModal) {
      uploadModal.onclick = (e) => {
        if (e.target === uploadModal) closeUploadModal();
      };
    }

    if (uploadDropzone && excelFileInput) {
      uploadDropzone.onclick = () => excelFileInput.click();

      uploadDropzone.ondragover = (e) => {
        e.preventDefault();
        uploadDropzone.classList.add("dragover");
      };

      uploadDropzone.ondragleave = () => {
        uploadDropzone.classList.remove("dragover");
      };

      uploadDropzone.ondrop = (e) => {
        e.preventDefault();
        uploadDropzone.classList.remove("dragover");
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleFileSelected(e.dataTransfer.files[0]);
        }
      };

      excelFileInput.onchange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
          handleFileSelected(e.target.files[0]);
        }
      };
    }

    if (submitUploadBtn) {
      submitUploadBtn.onclick = handleUploadSubmit;
    }
  }

  function openUploadModal() {
    if (!uploadModal) return;
    selectedUploadFile = null;
    if (excelFileInput) excelFileInput.value = "";
    if (selectedFileInfo) selectedFileInfo.style.display = "none";
    if (uploadStatusMsg) uploadStatusMsg.style.display = "none";
    if (submitUploadBtn) {
      submitUploadBtn.disabled = true;
      submitUploadBtn.textContent = "Proses & Update Database";
    }
    uploadModal.classList.add("active");
  }

  function closeUploadModal() {
    if (uploadModal) uploadModal.classList.remove("active");
  }

  function handleFileSelected(file) {
    if (!file || !file.name.endsWith(".xlsx")) {
      alert("Harap pilih file dengan format spreadsheet .xlsx");
      return;
    }

    selectedUploadFile = file;
    if (selectedFileName) selectedFileName.textContent = file.name;
    if (selectedFileSize) selectedFileSize.textContent = `${(file.size / 1024).toFixed(1)} KB`;
    if (selectedFileInfo) selectedFileInfo.style.display = "flex";
    if (submitUploadBtn) submitUploadBtn.disabled = false;
    if (uploadStatusMsg) uploadStatusMsg.style.display = "none";
  }

  async function handleUploadSubmit() {
    if (!selectedUploadFile) return;

    if (submitUploadBtn) {
      submitUploadBtn.disabled = true;
      submitUploadBtn.textContent = "Mengekstrak & Memperbarui Database...";
    }

    try {
      const resp = await fetch("/api/upload-excel", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Filename": encodeURIComponent(selectedUploadFile.name)
        },
        body: selectedUploadFile
      });

      const res = await resp.json();

      if (!resp.ok || !res.success) {
        throw new Error(res.error || "Gagal mengupdate database");
      }

      if (uploadStatusMsg) {
        uploadStatusMsg.className = "upload-status-msg success";
        uploadStatusMsg.style.display = "block";
        const stats = res.stats || {};
        uploadStatusMsg.innerHTML = `
          <strong>✓ Berhasil!</strong> ${res.message}<br>
          <span style="font-size: 0.76rem;">Total: ${stats.total_categories || 21} Kategori, ${stats.total_items || 0} Perangkat Audio terindeks.</span>
        `;
      }

      // Reload database immediately in web client
      await reloadDatabase();

      if (submitUploadBtn) {
        submitUploadBtn.textContent = "✓ Selesai Diperbarui";
      }

      setTimeout(() => {
        closeUploadModal();
      }, 1500);

    } catch (err) {
      console.error(err);
      if (uploadStatusMsg) {
        uploadStatusMsg.className = "upload-status-msg error";
        uploadStatusMsg.style.display = "block";
        uploadStatusMsg.textContent = `Gagal: ${err.message}`;
      }
      if (submitUploadBtn) {
        submitUploadBtn.disabled = false;
        submitUploadBtn.textContent = "Coba Lagi";
      }
    }
  }

  async function reloadDatabase() {
    try {
      const resp = await fetch(`data/audio_data.json?t=${Date.now()}`);
      if (!resp.ok) return;
      db = await resp.json();

      renderCategoryTabs();
      const currentCatName = currentCategory ? currentCategory.name : db.categories[0]?.name;
      selectCategory(currentCatName || "TWS");

      // Reinit typewriter concierge with updated database if available
      if (window.AudioConcierge) {
        new window.AudioConcierge(
          "typewriterOutput",
          "conciergeOptions",
          "conciergeResults",
          db,
          (product) => openProductModal(product)
        );
      }
    } catch (e) {
      console.error("Error reloading database:", e);
    }

  // Category Tabs
  function renderCategoryTabs() {
    if (!catNav || !db.categories) return;
    catNav.innerHTML = "";

    db.categories.forEach((cat) => {
      const btn = document.createElement("button");
      btn.className = `cat-tab ${cat.name === currentCategory?.name ? "active" : ""}`;
      btn.innerHTML = `${cat.name} <span class="cat-count">${cat.total_items}</span>`;
      btn.onclick = () => selectCategory(cat.name);
      catNav.appendChild(btn);
    });
  }

  function selectCategory(catName) {
    currentCategory = db.categories.find((c) => c.name === catName) || db.categories[0];
    
    // Update active tab styling
    document.querySelectorAll(".cat-tab").forEach((tab) => {
      tab.classList.toggle("active", tab.textContent.startsWith(currentCategory.name));
    });

    // Update Header & Notes
    if (categoryTitle) categoryTitle.textContent = `${currentCategory.name} (${currentCategory.total_items} Produk)`;
    
    if (categoryNotes) {
      if (currentCategory.notes && currentCategory.notes.length > 0) {
        categoryNotes.style.display = "block";
        categoryNotes.innerHTML = `<strong>Catatan Kategori:</strong> ${currentCategory.notes.join("<br>")}`;
      } else {
        categoryNotes.style.display = "none";
      }
    }

    renderCatalog();
  }

  // Filter & Sort Items
  function getFilteredItems() {
    if (!currentCategory || !currentCategory.items) return [];

    let items = [...currentCategory.items];

    // Search query
    if (searchQuery) {
      items = items.filter((it) => {
        const full = `${it.name} ${it.tagline} ${it.review} ${it.codec} ${it.driver}`.toLowerCase();
        return full.includes(searchQuery);
      });
    }

    // Price filter (Min and Max)
    if (minPriceFilter > 0 || maxPriceFilter < 25000000) {
      items = items.filter((it) => {
        if (!it.price_num) return minPriceFilter === 0;
        return it.price_num >= minPriceFilter && it.price_num <= maxPriceFilter;
      });
    }

    // Tier filter
    if (selectedTiers.size > 0) {
      items = items.filter((it) => {
        const itemTier = (it.tier || "").toUpperCase().trim();
        return Array.from(selectedTiers).some((t) => {
          if (t === "S") {
            return (itemTier === "S" || itemTier.startsWith("S+") || itemTier.startsWith("S-")) && !itemTier.startsWith("SS");
          }
          if (t === "SS") {
            return itemTier.startsWith("SS") || itemTier === "SSS";
          }
          return itemTier.startsWith(t.toUpperCase());
        });
      });
    }

    // Sort
    const tierOrder = {
      "SSS": 1, "S+++++": 2, "S++": 3, "S+": 4, "SS": 5, "S": 6, "S-": 7,
      "A+": 8, "A": 9, "A-": 10,
      "B+": 11, "B": 12, "B-": 13,
      "C+": 14, "C": 15, "C-": 16,
      "D+": 17, "D": 18, "D-": 19,
      "E+": 20, "E": 21, "E-": 22
    };

    if (currentSort === "tier") {
      items.sort((a, b) => {
        const rankA = tierOrder[a.tier] || 50;
        const rankB = tierOrder[b.tier] || 50;
        return rankA - rankB;
      });
    } else if (currentSort === "price_asc") {
      items.sort((a, b) => (a.price_num || 999999999) - (b.price_num || 999999999));
    } else if (currentSort === "price_desc") {
      items.sort((a, b) => (b.price_num || 0) - (a.price_num || 0));
    } else if (currentSort === "name") {
      items.sort((a, b) => a.name.localeCompare(b.name));
    }

    return items;
  }

  // Render Catalog (Grid or Table)
  function renderCatalog() {
    if (!catalogContainer) return;
    const items = getFilteredItems();

    if (items.length === 0) {
      catalogContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">Tidak ada perangkat yang cocok</div>
          <div class="empty-state-desc">Coba sesuaikan kata kunci pencarian atau reset filter tier di atas.</div>
          <button class="btn btn-secondary btn-sm" onclick="window.resetFilters()">Reset Filter</button>
        </div>
      `;
      return;
    }

    if (currentView === "grid") {
      renderGridView(items);
    } else {
      renderTableView(items);
    }
  }

  function renderGridView(items) {
    let html = `<div class="catalog-grid">`;

    items.forEach((item) => {
      const tierClass = `tier-${(item.tier || "A").replace(/\+/g, '\\+').replace(/-/g, '\\-')}`;
      const isCompared = compareList.some((c) => c.id === item.id);
      const storeLinksHtml = renderStoreLinks(item);

      html += `
        <div class="gear-card" data-id="${item.id}">
          <div>
            <div class="card-top">
              <div>
                <div class="gear-name" onclick="window.openDetail('${item.id}')" style="cursor: pointer;">${item.name}</div>
                ${item.tagline ? `<div class="gear-tagline">${item.tagline}</div>` : ""}
              </div>
              <span class="tier-badge ${tierClass}">Tier ${item.tier || "-"}</span>
            </div>

            <div class="card-price-row">
              <span class="gear-price">${item.price_formatted || item.price_raw || "Cek Link"}</span>
              <span class="gear-vfm">Value: <strong>${item.value_for_money || "-"}</strong></span>
            </div>

            ${item.review ? `<div class="gear-review-snippet">${item.review}</div>` : ""}

            ${renderCardMetrics(item)}
          </div>

          <div class="card-bottom">
            <div class="card-primary-actions">
              <button class="btn btn-sm btn-secondary flex-1" onclick="window.openDetail('${item.id}')">Detail Review</button>
              <button class="btn btn-sm btn-ghost" onclick="window.toggleCompare('${item.id}')" title="Bandingkan">
                ${isCompared ? "✓ Dibandingkan" : "+ Adu"}
              </button>
            </div>
            ${storeLinksHtml ? `<div class="card-store-links">${storeLinksHtml}</div>` : ""}
          </div>
        </div>
      `;
    });

    html += `</div>`;
    catalogContainer.innerHTML = html;
  }

  function renderTableView(items) {
    let html = `
      <div class="catalog-table-wrapper">
        <table class="catalog-table">
          <thead>
            <tr>
              <th>Tier</th>
              <th>Nama Produk</th>
              <th>Harga</th>
              <th>Value</th>
              <th>Review Singkat</th>
              <th>Link Toko</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
    `;

    items.forEach((item) => {
      const tierClass = `tier-${(item.tier || "A").replace(/\+/g, '\\+').replace(/-/g, '\\-')}`;
      const isCompared = compareList.some((c) => c.id === item.id);

      html += `
        <tr>
          <td><span class="tier-badge ${tierClass}">${item.tier || "-"}</span></td>
          <td>
            <div class="table-gear-name" onclick="window.openDetail('${item.id}')">${item.name}</div>
            ${item.tagline ? `<div class="table-tagline">${item.tagline}</div>` : ""}
          </td>
          <td><strong style="color: var(--accent-primary);">${item.price_formatted || item.price_raw || "-"}</strong></td>
          <td>${item.value_for_money || "-"}</td>
          <td style="max-width: 320px; font-size: 0.8rem; color: var(--text-secondary);">${item.review ? item.review.substring(0, 120) + (item.review.length > 120 ? "..." : "") : "-"}</td>
          <td>
            <div class="card-links">${renderStoreLinks(item)}</div>
          </td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-sm btn-secondary" onclick="window.openDetail('${item.id}')">Detail</button>
              <button class="btn btn-sm btn-ghost" onclick="window.toggleCompare('${item.id}')">${isCompared ? "✓" : "+ Adu"}</button>
            </div>
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;
    catalogContainer.innerHTML = html;
  }

  function renderCardMetrics(item) {
    const scores = item.sound_scores || {};
    const keys = Object.keys(scores).slice(0, 3);
    if (keys.length === 0) {
      if (item.codec || item.battery || item.anc) {
        return `
          <div class="card-metrics">
            <div class="metric-item">
              <span class="metric-label">Codec</span>
              <span class="metric-val">${item.codec ? item.codec.split('\n')[0] : "-"}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">ANC</span>
              <span class="metric-val">${item.anc || "-"}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Baterai</span>
              <span class="metric-val">${item.battery ? item.battery.split('\n')[0] : "-"}</span>
            </div>
          </div>
        `;
      }
      return "";
    }

    return `
      <div class="card-metrics">
        ${keys.map((k) => `
          <div class="metric-item">
            <span class="metric-label">${k}</span>
            <span class="metric-val">${scores[k] !== null ? scores[k] : "-"}</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderStoreLinks(item) {
    const links = item.links || {};
    let html = "";

    if (links.tokopedia) {
      html += `<a href="${links.tokopedia}" target="_blank" rel="noopener" class="link-icon-btn" title="Buka Tokopedia">Tokopedia</a>`;
    }
    if (links.shopee) {
      html += `<a href="${links.shopee}" target="_blank" rel="noopener" class="link-icon-btn" title="Buka Shopee">Shopee</a>`;
    }
    if (links.tiktok) {
      html += `<a href="${links.tiktok}" target="_blank" rel="noopener" class="link-icon-btn" title="Buka TikTok">TikTok</a>`;
    }
    if (links.review_video) {
      html += `<a href="${links.review_video}" target="_blank" rel="noopener" class="link-icon-btn" style="color: #ef4444;" title="Video Review">YouTube</a>`;
    }

    return html;
  }

  // Product Detail Modal
  function openProductModal(item) {
    if (!item || !modalBody) return;

    modalBody.className = "modal-content";
    const tierClass = `tier-${(item.tier || "A").replace(/\+/g, '\\+').replace(/-/g, '\\-')}`;

    modalBody.innerHTML = `
      <div class="modal-header">
        <div>
          <div class="modal-title">${item.name}</div>
          ${item.tagline ? `<div style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px;">${item.tagline}</div>` : ""}
        </div>
        <button class="modal-close" onclick="window.closeModal()">✕</button>
      </div>

      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; gap: 8px; align-items: center;">
          <span class="tier-badge ${tierClass}">Tier ${item.tier || "-"}</span>
          <span class="tier-badge" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); color: var(--text-primary);">Value: ${item.value_for_money || "-"}</span>
          <span class="tier-badge" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); color: var(--text-muted);">${item.category}</span>
        </div>
        <div style="font-size: 1.25rem; font-weight: 800; color: var(--accent-primary);">${item.price_formatted || item.price_raw || "Harga Belum Tercatat"}</div>
      </div>

      <div>
        <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">Catatan Review Lengkap:</div>
        <div class="modal-review-box">
          ${item.review || "Belum ada catatan review terperinci untuk item ini."}
        </div>
      </div>

      ${renderSoundScoreBars(item)}

      ${renderSpecsGrid(item)}

      <div class="modal-actions-row">
        ${item.links?.tokopedia ? `<a href="${item.links.tokopedia}" target="_blank" rel="noopener" class="btn btn-primary">Beli di Tokopedia</a>` : ""}
        ${item.links?.shopee ? `<a href="${item.links.shopee}" target="_blank" rel="noopener" class="btn btn-secondary">Beli di Shopee</a>` : ""}
        ${item.links?.tiktok ? `<a href="${item.links.tiktok}" target="_blank" rel="noopener" class="btn btn-secondary">Beli di TikTok</a>` : ""}
        ${item.links?.review_video ? `<a href="${item.links.review_video}" target="_blank" rel="noopener" class="btn btn-secondary" style="color: #ef4444;">Tonton Video Review</a>` : ""}
        ${item.links?.eq_drive || item.links?.Equalizer ? `<a href="${item.links.eq_drive || item.links.Equalizer}" target="_blank" rel="noopener" class="btn btn-secondary">Download Preset EQ</a>` : ""}
        <button class="btn btn-ghost" onclick="window.toggleCompare('${item.id}')">
          ${compareList.some((c) => c.id === item.id) ? "Hapus dari Komparasi" : "+ Tambah ke Komparasi"}
        </button>
      </div>
    `;

    modalOverlay.classList.add("active");
  }

  function renderSoundScoreBars(item) {
    const scores = item.sound_scores || {};
    const entries = Object.entries(scores).filter(([_, val]) => typeof val === "number" && !isNaN(val));
    if (entries.length === 0) return "";

    return `
      <div>
        <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">Karakteristik & Penilaian Suara:</div>
        <div class="modal-sound-grid">
          ${entries.map(([label, val]) => {
            const percent = Math.min(Math.max((val / 10) * 100, 0), 100);
            return `
              <div class="sound-bar-item">
                <div class="sound-bar-header">
                  <span>${label}</span>
                  <strong>${val.toFixed(1)}/10</strong>
                </div>
                <div class="sound-bar-track">
                  <div class="sound-bar-fill" style="width: ${percent}%;"></div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  function renderSpecsGrid(item) {
    const specs = [
      { label: "Driver", val: item.driver },
      { label: "Bluetooth Codec", val: item.codec },
      { label: "Kekuatan Baterai", val: item.battery },
      { label: "ANC & dB", val: item.anc },
      { label: "Kualitas Mic", val: item.mic_test },
      { label: "Fitting & Kenyamanan", val: item.fitting },
      { label: "IP Rating", val: item.ip_rating },
      { label: "Equalizer Support", val: item.eq }
    ].filter((s) => s.val && s.val.trim().length > 0);

    if (specs.length === 0) return "";

    return `
      <div>
        <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">Spesifikasi & Fitur:</div>
        <div class="modal-specs-grid">
          ${specs.map((s) => `
            <div class="spec-cell">
              <span class="spec-cell-label">${s.label}</span>
              <strong>${s.val.replace(/\n/g, ', ')}</strong>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function closeModal() {
    modalOverlay.classList.remove("active");
  }

  // Comparison Engine
  function toggleCompare(itemId) {
    const item = findItemById(itemId);
    if (!item) return;

    const idx = compareList.findIndex((c) => c.id === item.id);
    if (idx >= 0) {
      compareList.splice(idx, 1);
    } else {
      if (compareList.length >= 4) {
        alert("Maksimal 4 perangkat untuk dibandingkan sekaligus.");
        return;
      }
      compareList.push(item);
    }

    updateCompareDrawer();
    renderCatalog();
  }

  function updateCompareDrawer() {
    if (!compareDrawer || !compareListEl) return;

    if (compareList.length === 0) {
      compareDrawer.classList.remove("active");
      return;
    }

    compareDrawer.classList.add("active");
    compareListEl.innerHTML = compareList.map((item) => `
      <span class="compare-chip">
        ${item.name}
        <span class="compare-chip-remove" onclick="window.toggleCompare('${item.id}')">✕</span>
      </span>
    `).join("");
  }

  function showComparisonModal() {
    if (compareList.length < 2) {
      alert("Pilih minimal 2 perangkat untuk dibandingkan.");
      return;
    }

    if (modalBody) {
      modalBody.className = "modal-content modal-comparison-wide";
    }

    modalBody.innerHTML = `
      <div class="modal-header">
        <div>
          <div class="modal-title">Komparasi Perangkat (${compareList.length} Gear)</div>
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">Perbandingan side-by-side spesifikasi, harga, tier, dan karakteristik suara.</div>
        </div>
        <button class="modal-close" onclick="window.closeModal()">✕</button>
      </div>

      <div class="comparison-table-scroll">
        <table class="catalog-table comparison-table">
          <thead>
            <tr>
              <th style="width: 160px; min-width: 140px;">Parameter</th>
              ${compareList.map((item) => `
                <th style="min-width: 260px; vertical-align: top;">
                  <div style="font-size: 1.05rem; font-weight: 800; color: var(--text-primary); margin-bottom: 4px;">${item.name}</div>
                  <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 500;">${item.category}</div>
                </th>
              `).join("")}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Tier & Value</strong></td>
              ${compareList.map((item) => `
                <td>
                  <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                    <span class="tier-badge tier-${(item.tier || "A").replace(/\+/g, '\\+').replace(/-/g, '\\-')}">Tier ${item.tier || "-"}</span>
                    <span class="tier-badge" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); color: var(--text-primary);">Value: ${item.value_for_money || "-"}</span>
                  </div>
                </td>
              `).join("")}
            </tr>
            <tr>
              <td><strong>Harga</strong></td>
              ${compareList.map((item) => `
                <td><strong style="color: var(--accent-primary); font-size: 1.1rem;">${item.price_formatted || item.price_raw || "-"}</strong></td>
              `).join("")}
            </tr>
            <tr>
              <td><strong>Karakteristik Suara</strong></td>
              ${compareList.map((item) => `
                <td>
                  ${renderSoundScoreBars(item) || `<div style="font-size: 0.82rem; color: var(--text-muted);">${item.sound_tuning || "-"}</div>`}
                </td>
              `).join("")}
            </tr>
            <tr>
              <td><strong>Review Catatan</strong></td>
              ${compareList.map((item) => `
                <td style="font-size: 0.82rem; line-height: 1.55; color: var(--text-secondary);">
                  ${item.tagline ? `<div style="font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">${item.tagline}</div>` : ""}
                  ${item.review || "-"}
                </td>
              `).join("")}
            </tr>
            <tr>
              <td><strong>Driver</strong></td>
              ${compareList.map((item) => `
                <td style="font-size: 0.82rem;">${item.driver || "-"}</td>
              `).join("")}
            </tr>
            <tr>
              <td><strong>Bluetooth / Codec</strong></td>
              ${compareList.map((item) => `
                <td style="font-size: 0.82rem;">${item.codec ? item.codec.replace(/\n/g, ', ') : "-"}</td>
              `).join("")}
            </tr>
            <tr>
              <td><strong>Fitur & Baterai</strong></td>
              ${compareList.map((item) => `
                <td style="font-size: 0.82rem;">
                  <div>ANC: <strong>${item.anc || "-"}</strong></div>
                  <div>Mic: <strong>${item.mic_test || "-"}</strong></div>
                  <div>Baterai: <strong>${item.battery ? item.battery.replace(/\n/g, ' ') : "-"}</strong></div>
                  ${item.ip_rating ? `<div>IP Rating: <strong>${item.ip_rating}</strong></div>` : ""}
                </td>
              `).join("")}
            </tr>
            <tr>
              <td><strong>Aksi & Pembelian</strong></td>
              ${compareList.map((item) => `
                <td>
                  <div style="display: flex; flex-direction: column; gap: 6px;">
                    <button class="btn btn-sm btn-primary" style="width: 100%;" onclick="window.openDetail('${item.id}')">Lihat Detail Lengkap</button>
                    <div class="card-links" style="margin-top: 4px;">${renderStoreLinks(item)}</div>
                  </div>
                </td>
              `).join("")}
            </tr>
          </tbody>
        </table>
      </div>

      <div class="modal-actions-row">
        <button class="btn btn-secondary" onclick="window.clearCompare()">Bersihkan Komparasi</button>
        <button class="btn btn-primary" onclick="window.closeModal()">Tutup</button>
      </div>
    `;

    modalOverlay.classList.add("active");
  }

  function clearCompare() {
    compareList = [];
    updateCompareDrawer();
    renderCatalog();
    closeModal();
  }

  // Readme Guide
  function openReadme() {
    if (!readmeModal || !readmeBody || !db) return;

    const readmeItems = db.readme || [];
    readmeBody.innerHTML = `
      <div class="modal-header">
        <div class="modal-title">Panduan & Catatan Penting Kitab Audio</div>
        <button class="modal-close" onclick="window.closeReadmeModal()">✕</button>
      </div>
      <div style="font-size: 0.9rem; line-height: 1.7; color: var(--text-primary); white-space: pre-line;">
        ${readmeItems.map((r) => r.content).join("\n\n") || "Panduan tidak ditemukan di spreadsheet."}
      </div>
      <div class="modal-actions-row">
        <button class="btn btn-primary" onclick="window.closeReadmeModal()">Saya Mengerti</button>
      </div>
    `;

    readmeModal.classList.add("active");
  }

  function closeReadmeModal() {
    if (readmeModal) readmeModal.classList.remove("active");
  }

  // Helpers
  function findItemById(id) {
    if (!db) return null;
    for (const cat of db.categories) {
      const found = cat.items.find((it) => it.id === id);
      if (found) return found;
    }
    return null;
  }

  function updatePriceRangeUI() {
    const minPercent = (minPriceFilter / 25000000) * 100;
    const maxPercent = (maxPriceFilter / 25000000) * 100;

    if (sliderHighlight) {
      sliderHighlight.style.left = `${minPercent}%`;
      sliderHighlight.style.right = `${100 - maxPercent}%`;
    }

    if (minPriceDisplay) {
      minPriceDisplay.textContent = `Min: Rp ${minPriceFilter.toLocaleString("id-ID")}`;
    }

    if (maxPriceDisplay) {
      maxPriceDisplay.textContent = maxPriceFilter >= 25000000 ? "Maks: Bebas" : `Maks: Rp ${maxPriceFilter.toLocaleString("id-ID")}`;
    }

    if (priceRangeLabel) {
      if (minPriceFilter === 0 && maxPriceFilter >= 25000000) {
        priceRangeLabel.textContent = "Semua Rentang Harga (Rp 0 - Bebas)";
      } else if (maxPriceFilter >= 25000000) {
        priceRangeLabel.textContent = `Rentang: >= Rp ${minPriceFilter.toLocaleString("id-ID")}`;
      } else if (minPriceFilter === 0) {
        priceRangeLabel.textContent = `Rentang: <= Rp ${maxPriceFilter.toLocaleString("id-ID")}`;
      } else {
        priceRangeLabel.textContent = `Rentang: Rp ${minPriceFilter.toLocaleString("id-ID")} - Rp ${maxPriceFilter.toLocaleString("id-ID")}`;
      }
    }

    presetPills.forEach((p) => {
      const pMin = parseInt(p.getAttribute("data-min") || "0", 10);
      const pMax = parseInt(p.getAttribute("data-max") || "25000000", 10);
      p.classList.toggle("active", pMin === minPriceFilter && pMax === maxPriceFilter);
    });
  }

  // Expose global methods for onclick handlers
  window.openDetail = (id) => {
    const item = findItemById(id);
    if (item) openProductModal(item);
  };
  window.closeModal = closeModal;
  window.toggleCompare = toggleCompare;
  window.showComparisonModal = showComparisonModal;
  window.clearCompare = clearCompare;
  window.openReadmeModal = openReadme;
  window.closeReadmeModal = closeReadmeModal;
  window.resetFilters = () => {
    if (searchInput) searchInput.value = "";
    searchQuery = "";
    selectedTiers.clear();
    tierPills.forEach((p) => p.classList.remove("active"));
    document.querySelector('.tier-pill[data-tier="ALL"]')?.classList.add("active");
    minPriceFilter = 0;
    maxPriceFilter = 25000000;
    if (minPriceInput) minPriceInput.value = 0;
    if (maxPriceInput) maxPriceInput.value = 25000000;
    updatePriceRangeUI();
    renderCatalog();
  };

  // Start
  document.addEventListener("DOMContentLoaded", init);
})();
