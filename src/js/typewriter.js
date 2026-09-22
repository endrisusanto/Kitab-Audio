/**
 * Interactive Typewriter Audio Concierge
 * Panduan Interaktif Rekomendasi Audio Gear Kitab Audio
 * Zero bloat, antislop copywriting.
 */

class AudioConcierge {
  constructor(containerId, optionsId, resultsId, audioDatabase, onSelectProductCallback) {
    this.container = document.getElementById(containerId);
    this.optionsContainer = document.getElementById(optionsId);
    this.resultsContainer = document.getElementById(resultsId);
    this.db = audioDatabase;
    this.onSelectProduct = onSelectProductCallback;
    
    this.typingSpeed = 22; // ms per char
    this.isTyping = false;
    this.typeTimeout = null;
    
    this.state = {
      step: 0,
      category: null,
      budget: null,
      soundPref: null,
      feature: null
    };

    this.steps = [
      {
        id: "category",
        prompt: "Halo. Mau cari rekomendasi audio gear apa hari ini?",
        options: [
          { label: "TWS (Wireless Earphone)", value: "TWS" },
          { label: "IEM (Kabel Audiophile)", value: "IEM" },
          { label: "Headphone", value: "Headphone" },
          { label: "OWS (Open Ear)", value: "OWS" },
          { label: "Dongle / Bluetooth DAC", value: "Dongle DAC" },
          { label: "Speaker / Soundbar", value: "Speaker 2 unit" },
          { label: "Microphone", value: "Mic" },
          { label: "Kabel / Eartips", value: "Eartips" }
        ]
      },
      {
        id: "budget",
        prompt: "Berapa perkiraan batas budget yang kamu siapkan?",
        options: [
          { label: "Budget Hemat (< 500 Ribu)", value: "under_500k", max: 500000, min: 0 },
          { label: "Sweet Spot (500 Ribu sampai 1.5 Juta)", value: "500k_1.5m", max: 1500000, min: 500000 },
          { label: "Mid-Range (1.5 Juta sampai 4 Juta)", value: "1.5m_4m", max: 4000000, min: 1500000 },
          { label: "High-End / Flagship (> 4 Juta)", value: "above_4m", max: 999000000, min: 4000000 },
          { label: "Bebas / Cari yang Terbaik Saja", value: "any", max: 999000000, min: 0 }
        ]
      },
      {
        id: "soundPref",
        prompt: "Karakter suara seperti apa yang paling kamu sukai?",
        options: [
          { label: "All-Rounder / Balance (Seimbang buat semua lagu)", value: "balance" },
          { label: "Bass Mantap (Nendang, punchy, ngebass)", value: "bass" },
          { label: "Vokal Intim & Bersih (Fokus mid dan penyanyi)", value: "vocal" },
          { label: "Bright / Detail & Soundstage Luas (Airy, jernih)", value: "bright" },
          { label: "Bebas / Ikut Tuning Terbaik Pabrikan", value: "any" }
        ]
      },
      {
        id: "feature",
        prompt: "Ada fitur khusus yang wajib ada di perangkat ini?",
        options: [
          { label: "ANC Kedap & Nyaman", value: "anc" },
          { label: "Mic Jernih buat Kerja / Telepon", value: "mic" },
          { label: "Gaming Mode / Low Latency", value: "gaming" },
          { label: "Kualitas Suara Maksimal (No Kompromi)", value: "sq_first" },
          { label: "Tidak ada kebutuhan khusus", value: "none" }
        ]
      }
    ];

    this.start();
  }

  start() {
    this.state = {
      step: 0,
      category: null,
      budget: null,
      soundPref: null,
      feature: null
    };
    this.renderStep();
  }

  typeText(text, callback) {
    if (this.typeTimeout) clearTimeout(this.typeTimeout);
    this.container.innerHTML = '<span class="typewriter-text"></span><span class="typewriter-cursor"></span>';
    const textEl = this.container.querySelector('.typewriter-text');
    
    let index = 0;
    this.isTyping = true;
    
    const typeNext = () => {
      if (index < text.length) {
        textEl.textContent += text.charAt(index);
        index++;
        this.typeTimeout = setTimeout(typeNext, this.typingSpeed);
      } else {
        this.isTyping = false;
        if (callback) callback();
      }
    };
    
    typeNext();
  }

  renderStep() {
    this.resultsContainer.innerHTML = "";
    this.optionsContainer.innerHTML = "";

    if (this.state.step < this.steps.length) {
      const curStep = this.steps[this.state.step];
      this.typeText(curStep.prompt, () => {
        this.renderOptions(curStep.options);
      });
    } else {
      this.finishAndRecommend();
    }
  }

  renderOptions(options) {
    this.optionsContainer.innerHTML = "";
    options.forEach(opt => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = opt.label;
      btn.onclick = () => this.handleSelect(opt);
      this.optionsContainer.appendChild(btn);
    });

    if (this.state.step > 0) {
      const resetBtn = document.createElement("button");
      resetBtn.className = "option-btn btn-ghost";
      resetBtn.style.color = "var(--text-muted)";
      resetBtn.textContent = "Ulang dari awal";
      resetBtn.onclick = () => this.start();
      this.optionsContainer.appendChild(resetBtn);
    }
  }

  handleSelect(option) {
    const curStep = this.steps[this.state.step];
    if (curStep.id === "category") this.state.category = option.value;
    else if (curStep.id === "budget") this.state.budget = option;
    else if (curStep.id === "soundPref") this.state.soundPref = option.value;
    else if (curStep.id === "feature") this.state.feature = option.value;

    this.state.step++;
    this.renderStep();
  }

  finishAndRecommend() {
    const matches = this.calculateRecommendations();
    
    let resultMsg = `Berdasarkan preferensi kamu (${this.state.category || "Audio Gear"}, `;
    if (this.state.budget) resultMsg += `${this.state.budget.label}): `;
    resultMsg += `kami menemukan ${matches.length} perangkat pilihan dengan Tier & Value tertinggi di database.`;

    this.typeText(resultMsg, () => {
      this.renderRecommendationCards(matches);
      
      this.optionsContainer.innerHTML = "";
      const restartBtn = document.createElement("button");
      restartBtn.className = "option-btn";
      restartBtn.textContent = "Cari Rekomendasi Lain";
      restartBtn.onclick = () => this.start();
      this.optionsContainer.appendChild(restartBtn);
    });
  }

  calculateRecommendations() {
    if (!this.db || !this.db.categories) return [];

    let targetCatName = this.state.category;
    let targetCat = this.db.categories.find(c => c.name.toLowerCase() === targetCatName.toLowerCase());
    
    if (!targetCat) {
      // Fallback search
      targetCat = this.db.categories.find(c => c.name.toLowerCase().includes(targetCatName.toLowerCase())) || this.db.categories[0];
    }

    let items = [...targetCat.items];

    // Filter budget
    if (this.state.budget && this.state.budget.value !== "any") {
      const min = this.state.budget.min || 0;
      const max = this.state.budget.max || 999999999;
      items = items.filter(it => {
        if (!it.price_num) return true; // Keep if price unknown
        return it.price_num >= min && it.price_num <= max;
      });
    }

    // Filter Sound Preference
    if (this.state.soundPref && this.state.soundPref !== "any") {
      if (this.state.soundPref === "bass") {
        items.sort((a, b) => {
          const bassA = a.sound_scores?.Bass || 0;
          const bassB = b.sound_scores?.Bass || 0;
          return bassB - bassA;
        });
      } else if (this.state.soundPref === "vocal") {
        items.sort((a, b) => {
          const vocA = a.sound_scores?.Vocal || a.sound_scores?.Voc || 0;
          const vocB = b.sound_scores?.Vocal || b.sound_scores?.Voc || 0;
          return vocB - vocA;
        });
      } else if (this.state.soundPref === "bright") {
        items.sort((a, b) => {
          const treA = a.sound_scores?.Treble || 0;
          const treB = b.sound_scores?.Treble || 0;
          return treB - treA;
        });
      }
    }

    // Filter Feature
    if (this.state.feature === "anc") {
      items = items.filter(it => it.anc && !it.anc.toLowerCase().includes("no"));
    } else if (this.state.feature === "mic") {
      items = items.filter(it => it.mic_test && ["S+", "SS", "SSS", "S", "A"].some(r => it.mic_test.includes(r)));
    }

    // Sort by Tier hierarchy (SS > S > A+ > A > B)
    const tierOrder = { "SSS": 1, "S++": 2, "S+": 3, "SS": 4, "S": 5, "A+": 6, "A": 7, "A-": 8, "B+": 9, "B": 10 };
    items.sort((a, b) => {
      const rankA = tierOrder[a.tier] || 20;
      const rankB = tierOrder[b.tier] || 20;
      return rankA - rankB;
    });

    return items.slice(0, 4);
  }

  renderRecommendationCards(items) {
    this.resultsContainer.innerHTML = "";

    if (items.length === 0) {
      this.resultsContainer.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 12px; background: var(--bg-surface); border-radius: var(--radius-md); font-size: 0.85rem; color: var(--text-muted);">
          Belum ada perangkat yang persis cocok dengan semua kriteria filter. Coba naikkan budget atau pilih preferensi suara lain.
        </div>
      `;
      return;
    }

    items.forEach(item => {
      const card = document.createElement("div");
      card.className = "gear-card";
      card.style.cursor = "pointer";
      card.onclick = () => {
        if (this.onSelectProduct) this.onSelectProduct(item);
      };

      const tierClass = `tier-${(item.tier || "A").replace('+', '\\+').replace('-', '\\-')}`;

      card.innerHTML = `
        <div>
          <div class="card-top">
            <div>
              <div class="gear-name">${item.name}</div>
              ${item.tagline ? `<div class="gear-tagline">${item.tagline}</div>` : ''}
            </div>
            <span class="tier-badge ${tierClass}">Tier ${item.tier || "-"}</span>
          </div>
          
          <div class="card-price-row">
            <span class="gear-price">${item.price_formatted || item.price_raw || "Cek Link"}</span>
            <span class="gear-vfm">Value: <strong>${item.value_for_money || "-"}</strong></span>
          </div>

          ${item.review ? `<div class="gear-review-snippet">${item.review}</div>` : ''}
        </div>

        <div class="card-primary-actions" style="margin-top: 10px;">
          <button class="btn btn-sm btn-primary flex-1">Buka Detail & Link Toko</button>
        </div>
      `;

      this.resultsContainer.appendChild(card);
    });
  }
}

window.AudioConcierge = AudioConcierge;
