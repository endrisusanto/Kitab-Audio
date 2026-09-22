/**
 * AI Audio Chat Module (LMStudio Integration)
 * Antislop & Ponytail Clean: Zero dependencies, fast streaming UI, grounded answers with interactive product cards.
 */

(function () {
  let chatHistory = [];
  let isSending = false;
  let availableModels = ["google/gemma-4-e4b", "google/gemma-4-12b-qat", "qwen3.6-35b-a3b-uncensored-hauhaucs-aggressive"];
  let allProducts = [];

  const openAiChatBtn = document.getElementById("openAiChatBtn");
  const aiChatModal = document.getElementById("aiChatModal");
  const closeAiChatBtn = document.getElementById("closeAiChatBtn");
  const chatMessagesEl = document.getElementById("chatMessages");
  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");
  const aiModelSelect = document.getElementById("aiModelSelect");
  const clearChatBtn = document.getElementById("clearChatBtn");
  const quickPromptChips = document.querySelectorAll(".quick-prompt-chip");

  async function init() {
    setupEventListeners();
    await fetchModels();
    await loadProducts();
    
    // Add initial greeting if history is empty
    if (chatHistory.length === 0) {
      appendMessage("assistant", "Halo! Saya Asisten Audio Kitab Audio. Mau tanya rekomendasi gear audio, perbandingan DAC/IEM/TWS, atau karakter suara tertentu?");
    }
  }

  async function loadProducts() {
    try {
      const resp = await fetch("data/audio_data.json");
      if (!resp.ok) return;
      const data = await resp.json();
      if (data && data.categories) {
        allProducts = [];
        data.categories.forEach(cat => {
          (cat.items || []).forEach(item => {
            allProducts.push(item);
          });
        });
      }
    } catch (e) {
      console.warn("Could not load products for chat:", e);
    }
  }

  async function fetchModels() {
    try {
      const resp = await fetch("/api/models");
      if (!resp.ok) return;
      const data = await resp.json();
      if (data && data.data && data.data.length > 0) {
        availableModels = data.data.map(m => m.id).filter(id => !id.includes("embedding"));
        renderModelOptions();
      }
    } catch (e) {
      console.warn("Using fallback models:", e);
      renderModelOptions();
    }
  }

  function renderModelOptions() {
    if (!aiModelSelect) return;
    aiModelSelect.innerHTML = availableModels.map(m => `
      <option value="${m}" ${m.includes("gemma-4-e4b") ? "selected" : ""}>
        Model: ${m}
      </option>
    `).join("");
  }

  function setupEventListeners() {
    if (openAiChatBtn) {
      openAiChatBtn.onclick = () => {
        aiChatModal.classList.add("active");
        chatInput?.focus();
      };
    }

    if (closeAiChatBtn) {
      closeAiChatBtn.onclick = () => {
        aiChatModal.classList.remove("active");
      };
    }

    if (aiChatModal) {
      aiChatModal.onclick = (e) => {
        if (e.target === aiChatModal) aiChatModal.classList.remove("active");
      };
    }

    if (clearChatBtn) {
      clearChatBtn.onclick = () => {
        chatHistory = [];
        chatMessagesEl.innerHTML = "";
        appendMessage("assistant", "Riwayat percakapan telah dibersihkan. Ada yang ingin kamu tanyakan lagi seputar audio gear?");
      };
    }

    if (chatForm) {
      chatForm.onsubmit = async (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text || isSending) return;
        
        chatInput.value = "";
        await sendMessage(text);
      };
    }

    quickPromptChips.forEach(chip => {
      chip.onclick = () => {
        const text = chip.getAttribute("data-prompt");
        if (text && !isSending) {
          sendMessage(text);
        }
      };
    });
  }

  function matchProductsInResponse(text, serverRelevant = []) {
    const matched = new Map();
    const textLow = (text || "").toLowerCase();

    // Check server relevant items first
    if (Array.isArray(serverRelevant)) {
      serverRelevant.forEach(p => {
        if (p && p.id && !matched.has(p.id)) {
          const nameLow = (p.name || "").toLowerCase();
          const cleanWords = nameLow.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length >= 3);
          const isMentioned = textLow.includes(nameLow) || cleanWords.some(w => textLow.includes(w) && w.length >= 4);
          if (isMentioned) {
            matched.set(p.id, p);
          }
        }
      });
    }

    // Also scan all products for exact names mentioned in text
    if (matched.size < 4 && allProducts.length > 0) {
      for (const p of allProducts) {
        if (matched.has(p.id)) continue;
        const nameLow = (p.name || "").toLowerCase().trim();
        if (nameLow.length >= 4 && textLow.includes(nameLow)) {
          matched.set(p.id, p);
          if (matched.size >= 4) break;
        }
      }
    }

    // If still empty but server returned relevant items, take top 2
    if (matched.size === 0 && Array.isArray(serverRelevant) && serverRelevant.length > 0) {
      serverRelevant.slice(0, 2).forEach(p => {
        if (p && p.id) matched.set(p.id, p);
      });
    }

    return Array.from(matched.values()).slice(0, 4);
  }

  async function sendMessage(text) {
    isSending = true;
    appendMessage("user", text);
    chatHistory.push({ role: "user", content: text });

    // Render loading bubble
    const loadingId = appendLoadingIndicator();

    try {
      const selectedModel = aiModelSelect ? aiModelSelect.value : "google/gemma-4-e4b";
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          messages: chatHistory
        })
      });

      removeLoadingIndicator(loadingId);

      if (!resp.ok) {
        throw new Error(`HTTP Error ${resp.status}`);
      }

      const resData = await resp.json();
      const choice = resData.choices?.[0];
      let assistantReply = choice?.message?.content || choice?.message?.reasoning_content || "Tidak ada respon.";
      
      // Clean up any stray markdown thinking tags if present
      assistantReply = assistantReply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

      const matchedProducts = matchProductsInResponse(assistantReply, resData.relevant_gear);

      appendMessage("assistant", assistantReply, matchedProducts);
      chatHistory.push({ role: "assistant", content: assistantReply });

    } catch (err) {
      removeLoadingIndicator(loadingId);
      console.error(err);
      appendMessage("assistant", "Maaf, terjadi kendala saat menghubungi server model AI. Pastikan server aktif dan coba lagi.");
    } finally {
      isSending = false;
    }
  }

  function appendMessage(role, content, products = []) {
    if (!chatMessagesEl) return;

    const msgDiv = document.createElement("div");
    msgDiv.className = `chat-bubble ${role === "user" ? "user-bubble" : "assistant-bubble"}`;
    
    // Format links and linebreaks
    const formatted = formatMessageContent(content);
    
    let productsHtml = "";
    if (products && products.length > 0) {
      productsHtml = `
        <div class="chat-products-section">
          <div class="chat-products-title">Perangkat Terkait / Rekomendasi:</div>
          <div class="chat-products-grid">
            ${products.map(p => renderChatProductCard(p)).join("")}
          </div>
        </div>
      `;
    }

    msgDiv.innerHTML = `
      <div class="bubble-role-label">${role === "user" ? "Kamu" : "Asisten Kitab Audio"}</div>
      <div class="bubble-content">${formatted}</div>
      ${productsHtml}
    `;

    chatMessagesEl.appendChild(msgDiv);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }

  function renderChatProductCard(item) {
    const tierClass = `tier-${(item.tier || "A").replace(/\+/g, '\\+').replace(/-/g, '\\-')}`;
    const links = item.links || {};
    let storeLinks = [];
    if (links.tokopedia) storeLinks.push(`<a href="${links.tokopedia}" target="_blank" rel="noopener" class="chat-link-btn" title="Tokopedia">Tokopedia</a>`);
    if (links.shopee) storeLinks.push(`<a href="${links.shopee}" target="_blank" rel="noopener" class="chat-link-btn" title="Shopee">Shopee</a>`);
    if (links.review_video) storeLinks.push(`<a href="${links.review_video}" target="_blank" rel="noopener" class="chat-link-btn yt-link" title="Review Video">YouTube</a>`);

    return `
      <div class="chat-product-card" data-id="${item.id}">
        <div class="chat-card-top">
          <div class="chat-card-name" onclick="window.openDetail('${item.id}')">${item.name}</div>
          <span class="tier-badge ${tierClass}">Tier ${item.tier || "-"}</span>
        </div>
        <div class="chat-card-meta">
          <span class="chat-card-price">${item.price_formatted || item.price_raw || "Cek Toko"}</span>
          <span class="chat-card-vfm">VFM: <strong>${item.value_for_money || "-"}</strong></span>
        </div>
        ${item.tagline || item.review ? `
          <div class="chat-card-snippet">${item.tagline || (item.review.substring(0, 90) + '...')}</div>
        ` : ""}
        <div class="chat-card-actions">
          <button class="btn btn-sm btn-secondary flex-1" onclick="window.openDetail('${item.id}')">Detail Review</button>
          <button class="btn btn-sm btn-ghost" onclick="window.toggleCompare('${item.id}')" title="Bandingkan">+ Adu</button>
        </div>
        ${storeLinks.length > 0 ? `<div class="chat-card-stores">${storeLinks.join("")}</div>` : ""}
      </div>
    `;
  }

  function formatMessageContent(text) {
    if (!text) return "";
    let safe = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Bold text **word**
    safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Code blocks `code`
    safe = safe.replace(/`([^`]+)`/g, '<code class="chat-code">$1</code>');
    // Bullet points
    safe = safe.replace(/^[•\-\*]\s+(.*)$/gm, '<div class="chat-list-item">• $1</div>');
    // Line breaks
    safe = safe.replace(/\n/g, '<br>');

    return safe;
  }

  function appendLoadingIndicator() {
    if (!chatMessagesEl) return null;
    const loadId = `loading_${Date.now()}`;
    const loadDiv = document.createElement("div");
    loadDiv.id = loadId;
    loadDiv.className = "chat-bubble assistant-bubble loading-bubble";
    loadDiv.innerHTML = `
      <div class="bubble-role-label">Asisten Kitab Audio</div>
      <div class="chat-typing-dots">
        <span></span><span></span><span></span>
      </div>
    `;
    chatMessagesEl.appendChild(loadDiv);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    return loadId;
  }

  function removeLoadingIndicator(id) {
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
