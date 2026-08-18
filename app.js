(() => {
  const STORAGE_KEY = "cinese-viaggio-v1";
  const CARDS = window.TRAVEL_CARDS;
  const CAT_LABELS = window.CAT_LABELS;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  const state = {
    view: "study",
    category: "all",
    direction: "it-zh",
    queue: [],
    index: 0,
    flipped: false,
    selectedWord: -1,
    progress: loadProgress(),
    settings: loadSettings(),
    voices: { zh: [], it: [] },
    deckGloss: { id: null, i: -1 },
  };

  function defaultProgress() {
    const map = {};
    for (const c of CARDS) {
      map[c.id] = { ease: 2.3, interval: 0, due: 0, reps: 0, lapses: 0 };
    }
    return map;
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY + ":progress");
      if (!raw) return defaultProgress();
      const parsed = JSON.parse(raw);
      const base = defaultProgress();
      return { ...base, ...parsed };
    } catch {
      return defaultProgress();
    }
  }

  function saveProgress() {
    localStorage.setItem(STORAGE_KEY + ":progress", JSON.stringify(state.progress));
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY + ":settings");
      if (!raw) {
        return { rate: 0.9, rateSlow: 0.65, voiceZhURI: "", voiceItURI: "" };
      }
      return {
        rate: 0.9,
        rateSlow: 0.65,
        voiceZhURI: "",
        voiceItURI: "",
        ...JSON.parse(raw),
      };
    } catch {
      return { rate: 0.9, rateSlow: 0.65, voiceZhURI: "", voiceItURI: "" };
    }
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY + ":settings", JSON.stringify(state.settings));
  }

  function filteredCards() {
    if (state.category === "all") return [...CARDS];
    return CARDS.filter((c) => c.cat === state.category);
  }

  function buildQueue() {
    const now = Date.now();
    const cards = filteredCards();
    const scored = cards.map((c) => {
      const p = state.progress[c.id] || { due: 0, interval: 0, ease: 2.3 };
      const overdue = p.due <= now;
      const score = overdue ? p.due : p.due + 1e15;
      return { card: c, score, overdue };
    });
    scored.sort((a, b) => a.score - b.score);
    // Mix: due first, then new/low-rep, shuffle lightly within bands
    const due = scored.filter((s) => s.overdue).map((s) => s.card);
    const later = scored.filter((s) => !s.overdue).map((s) => s.card);
    shuffleInPlace(due);
    state.queue = due.length ? [...due, ...later] : shuffle([...cards]);
    state.index = 0;
    state.flipped = false;
    state.selectedWord = -1;
  }

  function shuffle(arr) {
    const a = [...arr];
    shuffleInPlace(a);
    return a;
  }

  function shuffleInPlace(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
  }

  function currentCard() {
    return state.queue[state.index] || null;
  }

  function gradeCard(grade) {
    const card = currentCard();
    if (!card) return;
    const p = state.progress[card.id] || {
      ease: 2.3,
      interval: 0,
      due: 0,
      reps: 0,
      lapses: 0,
    };
    const now = Date.now();
    const minute = 60 * 1000;
    const day = 24 * 60 * minute;

    if (grade === "again") {
      p.reps = 0;
      p.lapses = (p.lapses || 0) + 1;
      p.interval = 0;
      p.due = now + 1 * minute;
      p.ease = Math.max(1.3, (p.ease || 2.3) - 0.2);
    } else if (grade === "hard") {
      p.reps = (p.reps || 0) + 1;
      if (p.interval <= 0) p.interval = 10 * minute;
      else p.interval = Math.max(10 * minute, p.interval * 1.2);
      p.due = now + p.interval;
      p.ease = Math.max(1.3, (p.ease || 2.3) - 0.05);
    } else if (grade === "good") {
      p.reps = (p.reps || 0) + 1;
      if (p.interval <= 0) p.interval = 1 * day;
      else if (p.interval < day) p.interval = 1 * day;
      else p.interval = p.interval * (p.ease || 2.3);
      p.due = now + p.interval;
    } else if (grade === "easy") {
      p.reps = (p.reps || 0) + 1;
      p.ease = (p.ease || 2.3) + 0.15;
      if (p.interval <= 0) p.interval = 3 * day;
      else p.interval = p.interval * (p.ease || 2.5) * 1.3;
      p.due = now + p.interval;
    }

    state.progress[card.id] = p;
    saveProgress();

    // Move on
    state.index += 1;
    if (state.index >= state.queue.length) {
      buildQueue();
    }
    state.flipped = false;
    state.selectedWord = -1;
    renderCard();
    updateStats();
  }

  // —— Speech ——
  function refreshVoices() {
    const all = speechSynthesis.getVoices() || [];
    state.voices.zh = all.filter(
      (v) =>
        /zh(-|_|$)|chinese|中文|普通话|国语/i.test(`${v.lang} ${v.name}`)
    );
    state.voices.it = all.filter((v) =>
      /it(-|_|$)|italian/i.test(`${v.lang} ${v.name}`)
    );

    // Prefer mainland Mandarin-ish voices
    state.voices.zh.sort((a, b) => scoreZhVoice(b) - scoreZhVoice(a));
    state.voices.it.sort((a, b) => scoreItVoice(b) - scoreItVoice(a));

    fillVoiceSelects();
    updateVoiceWarning();
  }

  function scoreZhVoice(v) {
    let s = 0;
    const n = `${v.lang} ${v.name}`.toLowerCase();
    if (/zh-cn|zh_cn|cmn-hans|china/.test(n)) s += 5;
    if (/xiaoxiao|yaoyao|huihui|kangkang|zhi|neural|google|microsoft/.test(n)) s += 3;
    if (/zh-tw|zh_tw|hong|yue|cantonese/.test(n)) s -= 2;
    return s;
  }

  function scoreItVoice(v) {
    let s = 0;
    const n = `${v.lang} ${v.name}`.toLowerCase();
    if (/it-it|italia/.test(n)) s += 3;
    if (/elsa|diego|neural|google|microsoft/.test(n)) s += 2;
    return s;
  }

  function fillVoiceSelects() {
    const zhSel = $("#voice-zh");
    const itSel = $("#voice-it");
    const zh = state.voices.zh;
    const it = state.voices.it;

    zhSel.innerHTML = "";
    if (!zh.length) {
      zhSel.innerHTML = `<option value="">(nessuna voce cinese trovata)</option>`;
    } else {
      for (const v of zh) {
        const opt = document.createElement("option");
        opt.value = v.voiceURI;
        opt.textContent = `${v.name} (${v.lang})`;
        zhSel.appendChild(opt);
      }
      if (
        state.settings.voiceZhURI &&
        zh.some((v) => v.voiceURI === state.settings.voiceZhURI)
      ) {
        zhSel.value = state.settings.voiceZhURI;
      } else {
        state.settings.voiceZhURI = zh[0].voiceURI;
        zhSel.value = zh[0].voiceURI;
      }
    }

    itSel.innerHTML = `<option value="">Automatica</option>`;
    for (const v of it) {
      const opt = document.createElement("option");
      opt.value = v.voiceURI;
      opt.textContent = `${v.name} (${v.lang})`;
      itSel.appendChild(opt);
    }
    if (state.settings.voiceItURI) itSel.value = state.settings.voiceItURI;
  }

  function updateVoiceWarning() {
    const box = $("#voice-warning");
    if (!("speechSynthesis" in window)) {
      box.classList.remove("hidden");
      box.textContent =
        "Questo browser non supporta la sintesi vocale. Prova Chrome o Edge.";
      return;
    }
    if (!state.voices.zh.length) {
      box.classList.remove("hidden");
      box.innerHTML =
        "Nessuna voce <strong>cinese</strong> rilevata. Su Windows: Impostazioni → Ora e lingua → Voce → Aggiungi voci → Cinese (Mandarino). Poi riapri la pagina e premi “Ricarica voci”. Su Android/iOS di solito le voci cinesi ci sono già.";
    } else {
      box.classList.add("hidden");
    }
  }

  function pickVoice(lang) {
    const list = lang === "zh" ? state.voices.zh : state.voices.it;
    const uri =
      lang === "zh" ? state.settings.voiceZhURI : state.settings.voiceItURI;
    if (uri) {
      const found = list.find((v) => v.voiceURI === uri);
      if (found) return found;
    }
    return list[0] || null;
  }

  function speak(text, { lang = "zh", slow = false } = {}) {
    if (!("speechSynthesis" in window) || !text) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "zh" ? "zh-CN" : "it-IT";
    u.rate = slow ? state.settings.rateSlow : state.settings.rate;
    const voice = pickVoice(lang);
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  }

  function speakCurrent(slow = false) {
    const card = currentCard();
    if (!card) return;
    // Strip ellipsis placeholders for cleaner TTS
    const text = card.zh.replace(/……/g, "").replace(/…/g, "");
    speak(text, { lang: "zh", slow });
  }

  function isPunct(tok) {
    return !tok || (!tok.py && !tok.it);
  }

  function renderWordLine(container, card, selected, onTap) {
    container.innerHTML = "";
    const words = card.words;
    if (!words || !words.length) {
      container.classList.remove("zh-line");
      container.textContent = card.zh;
      return;
    }
    container.classList.add("zh-line");
    words.forEach((tok, i) => {
      if (isPunct(tok)) {
        const span = document.createElement("span");
        span.className = "zh-punct";
        span.textContent = tok.zh;
        container.appendChild(span);
        return;
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "zh-word" + (i === selected ? " is-on" : "");
      btn.dataset.i = String(i);
      btn.setAttribute("aria-label", `${tok.zh}, ${tok.py}, ${tok.it}`);
      btn.textContent = tok.zh;
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onTap(i);
      });
      container.appendChild(btn);
    });
  }

  function fillGloss(rootHan, rootPy, rootIt, tok) {
    rootHan.textContent = tok.zh;
    rootPy.textContent = tok.py;
    rootIt.textContent = tok.it;
  }

  function speakWord(tok) {
    if (!tok || isPunct(tok)) return;
    const text = String(tok.zh).replace(/……/g, "").replace(/…/g, "").trim();
    if (text) speak(text, { lang: "zh" });
  }

  function selectStudyWord(i) {
    const card = currentCard();
    if (!card || !card.words || !card.words[i] || isPunct(card.words[i])) return;
    if (state.selectedWord === i) {
      state.selectedWord = -1;
      renderCard();
      return;
    }
    state.selectedWord = i;
    renderCard();
    speakWord(card.words[i]);
  }

  // —— Render ——
  function renderCard() {
    const card = currentCard();
    const stage = $("#card-stage");
    const empty = $("#empty-state");

    if (!card) {
      stage.classList.add("hidden");
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");
    stage.classList.remove("hidden");

    const dir = state.direction;
    const front = $("#front-text");
    const frontLabel = $("#front-label");
    const backZh = $("#back-zh");
    const backPy = $("#back-pinyin");
    const backIt = $("#back-it");
    const frontFace = $(".card-front");
    const backFace = $(".card-back");
    const flashcard = $("#flashcard");

    if (dir === "it-zh") {
      frontLabel.textContent = "Italiano";
      front.textContent = card.it;
      front.classList.remove("zh");
    } else {
      frontLabel.textContent = "Cinese";
      front.textContent = card.zh;
      front.classList.add("zh");
    }

    renderWordLine(backZh, card, state.selectedWord, selectStudyWord);
    backPy.textContent = card.py;
    backPy.classList.remove("hidden");
    backIt.textContent = card.it;

    const tok =
      state.selectedWord >= 0 && card.words
        ? card.words[state.selectedWord]
        : null;
    const gloss = $("#word-gloss");
    if (tok && !isPunct(tok)) {
      gloss.classList.remove("hidden");
      fillGloss($("#gloss-han"), $("#gloss-py"), $("#gloss-it"), tok);
    } else {
      gloss.classList.add("hidden");
    }

    if (state.flipped) {
      frontFace.classList.add("hidden");
      backFace.classList.remove("hidden");
      flashcard.classList.remove("is-front");
      $("#grade-row").classList.remove("hidden");
      $("#flip-row").classList.add("hidden");
    } else {
      frontFace.classList.remove("hidden");
      backFace.classList.add("hidden");
      flashcard.classList.add("is-front");
      $("#grade-row").classList.add("hidden");
      $("#flip-row").classList.remove("hidden");
    }

    updateStats();
  }

  function updateStats() {
    const cards = filteredCards();
    const now = Date.now();
    let due = 0;
    for (const c of cards) {
      const p = state.progress[c.id];
      if (!p || p.due <= now) due += 1;
    }
    const pos = Math.min(state.index + 1, state.queue.length || 0);
    $("#progress-text").textContent = `${pos} / ${state.queue.length || 0}`;
    $("#session-stats").textContent = `Da ripassare ora: ${due}`;

    const total = CARDS.length;
    const learned = Object.values(state.progress).filter((p) => p.reps > 0).length;
    $("#progress-summary").textContent = `Carte viste almeno una volta: ${learned} / ${total}. I progressi restano in questo browser (localStorage).`;
  }

  function fillCategories() {
    const sel = $("#category-filter");
    const cats = ["all", ...new Set(CARDS.map((c) => c.cat))];
    sel.innerHTML = cats
      .map((c) => `<option value="${c}">${CAT_LABELS[c] || c}</option>`)
      .join("");
    sel.value = state.category;
  }

  function cardMatchesQuery(c, q) {
    if (
      c.it.toLowerCase().includes(q) ||
      c.zh.includes(q) ||
      c.py.toLowerCase().includes(q) ||
      (CAT_LABELS[c.cat] || "").toLowerCase().includes(q)
    ) {
      return true;
    }
    return (c.words || []).some(
      (t) =>
        (t.it && t.it.toLowerCase().includes(q)) ||
        (t.py && t.py.toLowerCase().includes(q)) ||
        (t.zh && t.zh.includes(q))
    );
  }

  function renderDeckList() {
    const q = ($("#deck-search").value || "").trim().toLowerCase();
    let list = [...CARDS];
    if (q) list = list.filter((c) => cardMatchesQuery(c, q));
    $("#deck-count").textContent = `${list.length} frasi`;
    const y = window.scrollY;
    const ul = $("#deck-list");
    ul.innerHTML = "";
    for (const c of list) {
      const li = document.createElement("li");
      li.className = "deck-item";
      const selected =
        state.deckGloss.id === c.id ? state.deckGloss.i : -1;
      const tok =
        selected >= 0 && c.words && c.words[selected] && !isPunct(c.words[selected])
          ? c.words[selected]
          : null;

      li.innerHTML = `
        <div class="it">${escapeHtml(c.it)}</div>
        <div class="zh"></div>
        <div class="py">${escapeHtml(c.py)}</div>
        <div class="cat">${escapeHtml(CAT_LABELS[c.cat] || c.cat)}</div>
        <button type="button" class="speak-mini" title="Ascolta" aria-label="Ascolta ${escapeHtml(c.zh)}">🔊</button>
        ${
          tok
            ? `<div class="word-gloss">
                <span class="word-gloss-han">${escapeHtml(tok.zh)}</span>
                <span class="word-gloss-py">${escapeHtml(tok.py)}</span>
                <span class="word-gloss-it">${escapeHtml(tok.it)}</span>
              </div>`
            : ""
        }
      `;
      renderWordLine(li.querySelector(".zh"), c, selected, (i) => {
        const again = state.deckGloss.id === c.id && state.deckGloss.i === i;
        state.deckGloss = again ? { id: null, i: -1 } : { id: c.id, i };
        if (!again) speakWord(c.words[i]);
        renderDeckList();
      });
      li.querySelector(".speak-mini").addEventListener("click", () => {
        speak(c.zh.replace(/……/g, "").replace(/…/g, ""), { lang: "zh" });
      });
      ul.appendChild(li);
    }
    window.scrollTo(0, y);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setView(name) {
    state.view = name;
    $$(".tab").forEach((t) =>
      t.classList.toggle("is-active", t.dataset.view === name)
    );
    $$(".view").forEach((v) =>
      v.classList.toggle("is-active", v.id === `view-${name}`)
    );
    if (name === "deck") renderDeckList();
    if (name === "settings") updateStats();
  }

  function bind() {
    $$(".tab").forEach((t) =>
      t.addEventListener("click", () => setView(t.dataset.view))
    );

    $("#category-filter").addEventListener("change", (e) => {
      state.category = e.target.value;
      buildQueue();
      renderCard();
    });

    $("#direction").addEventListener("change", (e) => {
      state.direction = e.target.value;
      state.flipped = false;
      state.selectedWord = -1;
      renderCard();
    });

    const flip = () => {
      if (!currentCard()) return;
      state.flipped = !state.flipped;
      if (!state.flipped) state.selectedWord = -1;
      renderCard();
      if (state.flipped) speakCurrent(false);
    };

    $("#flashcard").addEventListener("click", (e) => {
      if (state.flipped) return;
      if (e.target.closest(".zh-word, .word-gloss, #btn-speak-word")) return;
      flip();
    });
    $("#flashcard").addEventListener("keydown", (e) => {
      if (e.code === "Enter" && !state.flipped) {
        e.preventDefault();
        flip();
      }
    });
    $("#btn-flip").addEventListener("click", (e) => {
      e.stopPropagation();
      if (!state.flipped) flip();
    });

    $("#btn-speak-word").addEventListener("click", (e) => {
      e.stopPropagation();
      const card = currentCard();
      const tok = card && card.words && card.words[state.selectedWord];
      speakWord(tok);
    });

    $("#btn-speak").addEventListener("click", () => speakCurrent(false));
    $("#btn-speak-slow").addEventListener("click", () => speakCurrent(true));
    $("#btn-speak-it").addEventListener("click", () => {
      const card = currentCard();
      if (card) speak(card.it, { lang: "it" });
    });

    $$("#grade-row .grade").forEach((btn) =>
      btn.addEventListener("click", () => gradeCard(btn.dataset.grade))
    );

    $("#deck-search").addEventListener("input", renderDeckList);

    $("#rate").addEventListener("input", (e) => {
      state.settings.rate = Number(e.target.value);
      $("#rate-out").textContent = state.settings.rate.toFixed(2);
      saveSettings();
    });
    $("#rate-slow").addEventListener("input", (e) => {
      state.settings.rateSlow = Number(e.target.value);
      $("#rate-slow-out").textContent = state.settings.rateSlow.toFixed(2);
      saveSettings();
    });
    $("#voice-zh").addEventListener("change", (e) => {
      state.settings.voiceZhURI = e.target.value;
      saveSettings();
    });
    $("#voice-it").addEventListener("change", (e) => {
      state.settings.voiceItURI = e.target.value;
      saveSettings();
    });
    $("#btn-test-audio").addEventListener("click", () =>
      speak("你好，谢谢", { lang: "zh" })
    );
    $("#btn-refresh-voices").addEventListener("click", () => {
      refreshVoices();
      speak("测试", { lang: "zh" });
    });
    $("#btn-reset-progress").addEventListener("click", () => {
      if (confirm("Azzero tutti i progressi di ripasso?")) {
        state.progress = defaultProgress();
        saveProgress();
        buildQueue();
        renderCard();
        updateStats();
      }
    });

    // Keyboard
    document.addEventListener("keydown", (e) => {
      if (state.view !== "study") return;
      if (e.target.matches("input, select, textarea")) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (!state.flipped) {
          state.flipped = true;
          renderCard();
          speakCurrent(false);
        }
      } else if (e.key === "1" && state.flipped) gradeCard("again");
      else if (e.key === "2" && state.flipped) gradeCard("hard");
      else if (e.key === "3" && state.flipped) gradeCard("good");
      else if (e.key === "4" && state.flipped) gradeCard("easy");
      else if (e.key === "a" || e.key === "A") speakCurrent(false);
      else if (e.key === "s" || e.key === "S") speakCurrent(true);
    });
  }

  function initSettingsUI() {
    $("#rate").value = state.settings.rate;
    $("#rate-slow").value = state.settings.rateSlow;
    $("#rate-out").textContent = Number(state.settings.rate).toFixed(2);
    $("#rate-slow-out").textContent = Number(state.settings.rateSlow).toFixed(2);
  }

  function init() {
    fillCategories();
    initSettingsUI();
    bind();
    buildQueue();
    renderCard();
    renderDeckList();

    if ("speechSynthesis" in window) {
      refreshVoices();
      speechSynthesis.onvoiceschanged = refreshVoices;
      // Some browsers populate voices late
      setTimeout(refreshVoices, 250);
      setTimeout(refreshVoices, 1000);
    } else {
      updateVoiceWarning();
    }
  }

  init();
})();
