const state = {
  chart: null,
  totalsRaw: [],
  historyRaw: [],
  stocksRaw: [],
  currentDayIso: todayISODate(),
  historyQuickFilters: {
    type: null,
    period: null,
    volume: null
  }
};

const APP_TITLE_BASE = "Statistique 2026";
const DAILY_GOAL_ML = 1000;
const TAB_TITLES = {
  today: "Aujourd'hui",
  history: "Historique",
  totals: "Totaux par jour",
  chart: "Graphique",
  stocks: "Stocks",
  settings: "Paramètres"
};
const TAB_SUBTITLES = {
  today: "Vue du jour, saisie rapide et progression.",
  history: "Retrouve et filtre les événements passés.",
  totals: "Synthèse quotidienne des volumes et fréquences.",
  chart: "Tendances visuelles sur plusieurs jours.",
  stocks: "Gestion du stock congelé avec FIFO.",
  settings: "Configuration Firebase et synchronisation."
};

function todayISODate() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

function nowHHMM() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function shiftIsoDate(dateIso, deltaDays) {
  const d = new Date(`${dateIso}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function formatDateFrLong(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  let dateObj = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    dateObj = new Date(`${raw}T00:00:00`);
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split("/").map(Number);
    dateObj = new Date(year, month - 1, day);
  }

  if (!dateObj || Number.isNaN(dateObj.getTime())) {
    return raw;
  }

  return dateObj.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function toast(message, isError = false) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.remove("toast-success", "toast-error", "show");
  void el.offsetWidth;
  el.classList.add(isError ? "toast-error" : "toast-success", "show");
  setTimeout(() => el.classList.remove("show"), 2200);
}

async function api(path, options = {}) {
  const response = await fetch(`api/${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json();
  if (!response.ok || data.success === false) {
    throw new Error(data.error || "Erreur API");
  }
  return data;
}

function updateDayNavUi() {
  const label = document.getElementById("dayNavLabel");
  if (label) {
    label.textContent = `📅 ${formatDateFrLong(state.currentDayIso)}`;
  }
  const todayBtn = document.getElementById("dayTodayBtn");
  if (todayBtn) {
    const isToday = state.currentDayIso === todayISODate();
    todayBtn.classList.toggle("active", isToday);
  }
}

function setupTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  const sections = document.querySelectorAll(".tab-content");
  const titleElement = document.getElementById("projectTitle");
  const subtitleElement = document.getElementById("projectSubtitle");

  function setActiveTitle(tabKey) {
    const label = TAB_TITLES[tabKey] || "Aujourd'hui";
    const fullTitle = `${APP_TITLE_BASE} - ${label}`;
    document.title = fullTitle;
    if (titleElement) {
      titleElement.textContent = fullTitle;
    }
    if (subtitleElement) {
      subtitleElement.textContent = TAB_SUBTITLES[tabKey] || TAB_SUBTITLES.today;
    }
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      sections.forEach((s) => s.classList.remove("active"));
      btn.classList.add("active");
      const tabKey = btn.dataset.tab;
      document.getElementById(tabKey).classList.add("active");
      setActiveTitle(tabKey);
      if (window.innerWidth <= 1024) {
        document.body.classList.remove("nav-open");
      }
    });
  });

  const current = document.querySelector(".tab-btn.active");
  setActiveTitle(current?.dataset.tab || "today");
}

function setupHamburgerMenu() {
  const toggle = document.getElementById("menuToggle");
  const backdrop = document.getElementById("navBackdrop");
  if (!toggle || !backdrop) {
    return;
  }

  const close = () => {
    document.body.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
  };

  const open = () => {
    document.body.classList.add("nav-open");
    toggle.setAttribute("aria-expanded", "true");
  };

  toggle.addEventListener("click", () => {
    const isOpen = document.body.classList.contains("nav-open");
    if (isOpen) {
      close();
    } else {
      open();
    }
  });

  backdrop.addEventListener("click", close);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      close();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1024) {
      close();
    }
  });
}

function renderTodayList(entries) {
  const list = document.getElementById("todayList");
  if (!entries.length) {
    list.innerHTML = "<p>Aucune entrée pour aujourd'hui.</p>";
    return;
  }

  const milkEntries = entries.filter((entry) => Number(entry.milkPumpedMl || 0) > 0);
  const bottleEntries = entries.filter((entry) => Number(entry.bottleMl || 0) > 0);

  function renderSectionRows(sectionEntries, type) {
    if (!sectionEntries.length) {
      return "<p class='today-empty'>Aucune entrée.</p>";
    }

    return sectionEntries
      .map((entry) => {
        const value = type === "milk" ? `${entry.milkPumpedMl} ml` : `${entry.bottleMl} ml`;
        return `
        <div class="today-row">
          <strong>${entry.time}</strong>
          <span>${value}</span>
          <strong class="note-strong">${entry.note || "-"}</strong>
        </div>`;
      })
      .join("");
  }

  list.innerHTML = `
    <div class="today-split">
      <div class="today-col">
        <h4>Tirages 👩‍🍼</h4>
        <div class="today-head">
          <strong>Heure</strong>
          <strong>Volume</strong>
          <strong>Note</strong>
        </div>
        ${renderSectionRows(milkEntries, "milk")}
      </div>
      <div class="today-col">
        <h4>Biberons 🧴</h4>
        <div class="today-head">
          <strong>Heure</strong>
          <strong>Volume</strong>
          <strong>Note</strong>
        </div>
        ${renderSectionRows(bottleEntries, "bottle")}
      </div>
    </div>`;
}

function renderHistorySplit(entries) {
  const bottleBody = document.querySelector("#historyBottleTable tbody");
  const milkBody = document.querySelector("#historyMilkTable tbody");
  const bottleRows = entries.filter((e) => Number(e.bottleMl || 0) > 0);
  const milkRows = entries.filter((e) => Number(e.milkPumpedMl || 0) > 0);

  function actionsCell(entry) {
    const entryId = String(entry.id || "").replace(/"/g, "&quot;");
    return `
      <td class="history-actions-cell">
        <button type="button" class="btn-secondary history-action-btn" data-action="edit" data-id="${entryId}" title="Modifier" aria-label="Modifier"><i class="fa-solid fa-pen"></i></button>
        <button type="button" class="btn-secondary history-action-btn danger" data-action="delete" data-id="${entryId}" title="Supprimer" aria-label="Supprimer"><i class="fa-solid fa-trash"></i></button>
      </td>`;
  }

  bottleBody.innerHTML = bottleRows.length
    ? bottleRows
        .map(
          (e) => `
      <tr>
        <td>${formatDateFrLong(e.dateIso || e.date)}</td>
        <td>${e.time}</td>
        <td>${e.bottleMl}</td>
        <td><strong class="note-strong">${e.note || "-"}</strong></td>
        ${actionsCell(e)}
      </tr>`
        )
        .join("")
    : "<tr><td colspan='5'>Aucune donnée biberon.</td></tr>";

  milkBody.innerHTML = milkRows.length
    ? milkRows
        .map(
          (e) => `
      <tr>
        <td>${formatDateFrLong(e.dateIso || e.date)}</td>
        <td>${e.time}</td>
        <td>${e.milkPumpedMl}</td>
        <td><strong class="note-strong">${e.note || "-"}</strong></td>
        ${actionsCell(e)}
      </tr>`
        )
        .join("")
    : "<tr><td colspan='5'>Aucune donnée tirage.</td></tr>";
}

function applyHistoryFiltersAndRender() {
  const search = (document.getElementById("historySearch")?.value || "").trim().toLowerCase();
  const sortBy = document.getElementById("historySortBy")?.value || "dateTime";
  const sortOrder = document.getElementById("historySortOrder")?.value || "desc";
  let rows = [...state.historyRaw];

  if (search !== "") {
    rows = rows.filter((e) => {
      const haystack = `${e.date} ${e.time} ${e.note || ""} ${e.milkPumpedMl} ${e.bottleMl}`.toLowerCase();
      return haystack.includes(search);
    });
  }

  if (state.historyQuickFilters.type === "bottle") {
    rows = rows.filter((e) => Number(e.bottleMl || 0) > 0);
  } else if (state.historyQuickFilters.type === "milk") {
    rows = rows.filter((e) => Number(e.milkPumpedMl || 0) > 0);
  }

  if (state.historyQuickFilters.period !== null) {
    const days = Number(state.historyQuickFilters.period || 0);
    if (days > 0) {
      const now = new Date();
      const threshold = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);
      rows = rows.filter((e) => {
        const iso = String(e.dateIso || "");
        if (!iso) {
          return false;
        }
        const d = new Date(`${iso}T00:00:00`);
        return d >= threshold;
      });
    }
  }

  if (state.historyQuickFilters.volume === "gt100") {
    rows = rows.filter((e) => Math.max(Number(e.milkPumpedMl || 0), Number(e.bottleMl || 0)) > 100);
  } else if (state.historyQuickFilters.volume === "lt100") {
    rows = rows.filter((e) => {
      const v = Math.max(Number(e.milkPumpedMl || 0), Number(e.bottleMl || 0));
      return v > 0 && v < 100;
    });
  }

  rows.sort((a, b) => {
    let cmp = 0;
    if (sortBy === "dateTime") {
      const aKey = `${a.dateIso || ""} ${a.time || ""}`;
      const bKey = `${b.dateIso || ""} ${b.time || ""}`;
      cmp = aKey.localeCompare(bKey);
    } else {
      cmp = Number(a[sortBy] || 0) - Number(b[sortBy] || 0);
    }
    return sortOrder === "asc" ? cmp : -cmp;
  });

  renderHistorySplit(rows);
}

function setupHistoryQuickFilters() {
  const chips = document.querySelectorAll(".history-chip[data-filter-group][data-filter-value]");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const group = chip.getAttribute("data-filter-group");
      const value = chip.getAttribute("data-filter-value");
      if (!group || !value) {
        return;
      }
      const current = state.historyQuickFilters[group];
      state.historyQuickFilters[group] = current === value ? null : value;
      chips.forEach((other) => {
        if (other.getAttribute("data-filter-group") !== group) {
          return;
        }
        const isActive = state.historyQuickFilters[group] === other.getAttribute("data-filter-value");
        other.classList.toggle("active", isActive);
      });
      applyHistoryFiltersAndRender();
    });
  });
}

function setupHistoryFilters() {
  const inputs = ["historySearch", "historySortBy", "historySortOrder"];
  inputs.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) {
      return;
    }
    const evt = id === "historySearch" ? "input" : "change";
    el.addEventListener(evt, applyHistoryFiltersAndRender);
  });
}

async function handleHistoryAction(action, entryId) {
  const entry = state.historyRaw.find((row) => String(row.id || "") === String(entryId));
  if (!entry || !entry.id) {
    toast("Entrée introuvable", true);
    return;
  }

  if (action === "delete") {
    const ok = window.confirm("Supprimer cette entrée ?");
    if (!ok) {
      return;
    }
    await api("delete_entry.php", {
      method: "POST",
      body: JSON.stringify({ id: entry.id })
    });
    toast("Entrée supprimée");
    await refreshAll();
    return;
  }

  if (action === "edit") {
    const nextDate = window.prompt("Date (AAAA-MM-JJ)", entry.dateIso || "");
    if (nextDate === null) {
      return;
    }
    const nextTime = window.prompt("Heure (HH:MM)", entry.time || "");
    if (nextTime === null) {
      return;
    }
    const nextMilk = window.prompt("Tire-lait (ml)", String(entry.milkPumpedMl || 0));
    if (nextMilk === null) {
      return;
    }
    const nextBottle = window.prompt("Biberon (ml)", String(entry.bottleMl || 0));
    if (nextBottle === null) {
      return;
    }
    const nextNote = window.prompt("Note", entry.note || "");
    if (nextNote === null) {
      return;
    }

    await api("update_entry.php", {
      method: "POST",
      body: JSON.stringify({
        id: entry.id,
        date: String(nextDate).trim(),
        time: String(nextTime).trim(),
        milkPumpedMl: Number(nextMilk || 0),
        bottleMl: Number(nextBottle || 0),
        note: String(nextNote).trim()
      })
    });
    toast("Entrée modifiée");
    await refreshAll();
  }
}

function setupHistoryActions() {
  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const button = target.closest(".history-action-btn");
    if (!(button instanceof HTMLElement)) {
      return;
    }
    const action = button.getAttribute("data-action") || "";
    const id = button.getAttribute("data-id") || "";
    if (!action || !id) {
      return;
    }
    try {
      await handleHistoryAction(action, id);
    } catch (error) {
      toast(error.message || "Action impossible", true);
    }
  });
}

function renderTotalsTable(totals) {
  const tbody = document.querySelector("#totalsTable tbody");
  if (!totals.length) {
    tbody.innerHTML = "<tr><td colspan='5'>Aucune donnée.</td></tr>";
    return;
  }
  tbody.innerHTML = totals
    .map(
      (row) => `
      <tr>
        <td>${row.date}</td>
        <td>${row.countMilkEntries ?? 0}</td>
        <td>${row.totalMilkPumped}</td>
        <td>${row.countBottleEntries ?? 0}</td>
        <td>${row.totalBottle}</td>
      </tr>`
    )
    .join("");
}

function renderStocks(movements) {
  const tbody = document.querySelector("#stocksTable tbody");
  const frozenEl = document.getElementById("stockFrozenMl");
  const fifoOutEl = document.getElementById("stockFifoOutMl");
  if (!tbody || !frozenEl || !fifoOutEl) {
    return;
  }

  let frozen = 0;
  let fifoOut = 0;
  movements.forEach((m) => {
    const amount = Number(m.amountMl || 0);
    const signed = m.direction === "out" ? -amount : amount;
    frozen += signed;
    if (m.direction === "out") {
      fifoOut += amount;
    }
  });

  frozen = Math.max(0, frozen);
  frozenEl.textContent = `${frozen} ml`;
  fifoOutEl.textContent = `${fifoOut} ml`;

  if (!movements.length) {
    tbody.innerHTML = "<tr><td colspan='8'>Aucun mouvement.</td></tr>";
    return;
  }

  tbody.innerHTML = movements
    .map((m) => {
      const directionLabel = m.direction === "out" ? "Sortie" : "Entrée";
      const fifoLabel = m.direction === "out" && m.fifoSource?.pumpDate
        ? `Lot ${formatDateFrLong(m.fifoSource.pumpDate)}`
        : "-";
      return `
      <tr>
        <td>${m.date || formatDateFrLong(m.dateIso)}</td>
        <td>${m.time || "-"}</td>
        <td>${formatDateFrLong(m.pumpDateIso || "") || "-"}</td>
        <td>${formatDateFrLong(m.expiryDateIso || "") || "-"}</td>
        <td>${directionLabel}</td>
        <td>${m.amountMl}</td>
        <td>${fifoLabel}</td>
        <td><strong class="note-strong">${m.note || "-"}</strong></td>
      </tr>`;
    })
    .join("");
}

function computeEstimatedExpiryDate(pumpDateIso) {
  const base = String(pumpDateIso || "").trim();
  if (!base) {
    return "";
  }
  const d = new Date(`${base}T00:00:00`);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  const days = 180;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function computeFifoCandidate(movements, neededMl) {
  const lots = [];
  movements.forEach((m) => {
    if (m.direction !== "in") {
      return;
    }
    lots.push({
      id: m.id,
      pumpDateIso: m.pumpDateIso || m.dateIso || "",
      remainingMl: Number(m.amountMl || 0),
      expiryDateIso: m.expiryDateIso || ""
    });
  });

  movements.forEach((m) => {
    if (m.direction !== "out") {
      return;
    }
    const sourceId = String(m.fifoSource?.id || "");
    if (!sourceId) {
      return;
    }
    const lot = lots.find((x) => String(x.id) === sourceId);
    if (lot) {
      lot.remainingMl = Math.max(0, lot.remainingMl - Number(m.amountMl || 0));
    }
  });

  lots.sort((a, b) => String(a.pumpDateIso).localeCompare(String(b.pumpDateIso)));
  return lots.find((lot) => lot.remainingMl >= neededMl) || null;
}

function renderChart(totals) {
  const ctx = document.getElementById("dailyChart");
  if (state.chart) {
    state.chart.destroy();
  }

  const chartRows = [...totals].sort((a, b) => {
    const aKey = String(a.dateIso || a.date || "");
    const bKey = String(b.dateIso || b.date || "");
    return aKey.localeCompare(bKey);
  });

  state.chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: chartRows.map((t) => t.date),
      datasets: [
        {
          label: "Tire-lait (ml)",
          data: chartRows.map((t) => t.totalMilkPumped),
          borderColor: "#1f9f7a",
          backgroundColor: "rgba(31, 159, 122, 0.2)",
          tension: 0.3
        },
        {
          label: "Biberon (ml)",
          data: chartRows.map((t) => t.totalBottle),
          borderColor: "#2563eb",
          backgroundColor: "rgba(37, 99, 235, 0.2)",
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" }
      }
    }
  });
}

function applyTotalsFiltersAndRender() {
  const sortBy = document.getElementById("totalsSortBy")?.value || "dateIso";
  const sortOrder = document.getElementById("totalsSortOrder")?.value || "desc";
  const period = document.getElementById("totalsPeriod")?.value || "all";
  let rows = [...state.totalsRaw];

  if (period !== "all") {
    const days = Number(period);
    const now = new Date();
    const threshold = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);
    rows = rows.filter((row) => {
      const iso = row.dateIso || "";
      if (!iso) {
        return false;
      }
      const d = new Date(`${iso}T00:00:00`);
      return d >= threshold;
    });
  }

  rows.sort((a, b) => {
    const av = a[sortBy];
    const bv = b[sortBy];
    let cmp = 0;
    if (sortBy === "dateIso") {
      cmp = String(av || "").localeCompare(String(bv || ""));
    } else {
      cmp = Number(av || 0) - Number(bv || 0);
    }
    return sortOrder === "asc" ? cmp : -cmp;
  });

  renderTotalsTable(rows);
  renderChart(rows);
}

function setupTotalsFilters() {
  const ids = ["totalsSortBy", "totalsSortOrder", "totalsPeriod"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("change", applyTotalsFiltersAndRender);
    }
  });
}

function updateHomeStats(entries) {
  const totalMilk = entries.reduce((sum, e) => sum + Number(e.milkPumpedMl || 0), 0);
  const totalBottle = entries.reduce((sum, e) => sum + Number(e.bottleMl || 0), 0);
  const count = entries.length;
  const milkEntriesCount = entries.filter((e) => Number(e.milkPumpedMl || 0) > 0).length;
  const bottleEntriesCount = entries.filter((e) => Number(e.bottleMl || 0) > 0).length;
  const total = totalMilk + totalBottle;
  const progressPct = Math.min(100, Math.round((totalMilk / DAILY_GOAL_ML) * 100));

  document.getElementById("statEntriesCount").textContent = String(count);
  document.getElementById("statMilkEntriesCount").textContent = String(milkEntriesCount);
  document.getElementById("statBottleEntriesCount").textContent = String(bottleEntriesCount);
  document.getElementById("statMilkTotal").textContent = `${totalMilk} ml`;
  document.getElementById("statBottleTotal").textContent = `${totalBottle} ml`;
  document.getElementById("statGlobalTotal").textContent = `${total} ml`;
  document.getElementById("statProgressText").textContent = `${progressPct}% (${totalMilk}/${DAILY_GOAL_ML} ml)`;
  document.getElementById("statProgressBar").style.width = `${progressPct}%`;
}

async function refreshAll() {
  updateDayNavUi();
  const entryDateInput = document.getElementById("entryDate");
  if (entryDateInput) {
    entryDateInput.value = state.currentDayIso;
  }
  const [today, history, totals, stocks] = await Promise.all([
    api(`get_today.php?date=${encodeURIComponent(state.currentDayIso)}`),
    api("get_history.php"),
    api("get_totals.php"),
    api("get_stocks.php")
  ]);

  const todayEntries = today.entries || [];
  renderTodayList(todayEntries);
  state.historyRaw = history.entries || [];
  applyHistoryFiltersAndRender();
  state.totalsRaw = totals.totals || [];
  applyTotalsFiltersAndRender();
  state.stocksRaw = stocks.movements || [];
  renderStocks(state.stocksRaw);
  updateHomeStats(todayEntries);
}

function setupEntryForm() {
  const form = document.getElementById("entryForm");
  const dateInput = document.getElementById("entryDate");
  const timeInput = document.getElementById("entryTime");
  const noteInput = document.getElementById("entryNote");
  const breastfedFlag = document.getElementById("breastfedFlag");
  const breastfedFlagBottle = document.getElementById("breastfedFlagBottle");
  dateInput.value = state.currentDayIso;
  timeInput.value = nowHHMM();

  function syncBreastfedNote() {
    const hasBreastfed = Boolean(breastfedFlag?.checked) || Boolean(breastfedFlagBottle?.checked);
    const note = noteInput.value.trim();
    if (hasBreastfed) {
      if (note === "") {
        noteInput.value = "Tétée";
      } else if (!note.toLowerCase().includes("tétée")) {
        noteInput.value = `${note} - Tétée`;
      }
      return;
    }

    noteInput.value = noteInput.value.replace(/\s*-\s*Tétée/gi, "").replace(/\bTétée\b/gi, "").trim();
  }

  if (breastfedFlag) {
    breastfedFlag.addEventListener("change", syncBreastfedNote);
  }
  if (breastfedFlagBottle) {
    breastfedFlagBottle.addEventListener("change", syncBreastfedNote);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      date: dateInput.value,
      time: timeInput.value,
      milkPumpedMl: Number(document.getElementById("milkPumpedMl").value || 0),
      bottleMl: Number(document.getElementById("bottleMl").value || 0),
      note: noteInput.value.trim()
    };

    try {
      await api("add_entry.php", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      toast("Entrée ajoutée");
      await refreshAll();
      timeInput.value = nowHHMM();
      form.reset();
      dateInput.value = state.currentDayIso;
      timeInput.value = nowHHMM();
    } catch (error) {
      toast(error.message, true);
    }
  });
}

function setupDayNavigation() {
  const prevBtn = document.getElementById("dayPrevBtn");
  const todayBtn = document.getElementById("dayTodayBtn");
  const nextBtn = document.getElementById("dayNextBtn");
  if (!prevBtn || !todayBtn || !nextBtn) {
    return;
  }

  prevBtn.addEventListener("click", async () => {
    state.currentDayIso = shiftIsoDate(state.currentDayIso, -1);
    await refreshAll();
  });

  todayBtn.addEventListener("click", async () => {
    state.currentDayIso = todayISODate();
    await refreshAll();
  });

  nextBtn.addEventListener("click", async () => {
    state.currentDayIso = shiftIsoDate(state.currentDayIso, 1);
    await refreshAll();
  });
}

function setupTodaySwipe() {
  const todaySection = document.getElementById("today");
  if (!todaySection) {
    return;
  }
  let startX = 0;
  let startY = 0;

  todaySection.addEventListener(
    "touchstart",
    (event) => {
      const touch = event.changedTouches?.[0];
      if (!touch) {
        return;
      }
      startX = touch.clientX;
      startY = touch.clientY;
    },
    { passive: true }
  );

  todaySection.addEventListener(
    "touchend",
    async (event) => {
      const touch = event.changedTouches?.[0];
      if (!touch) {
        return;
      }
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy)) {
        return;
      }
      if (dx < 0) {
        state.currentDayIso = shiftIsoDate(state.currentDayIso, 1);
      } else {
        state.currentDayIso = shiftIsoDate(state.currentDayIso, -1);
      }
      await refreshAll();
    },
    { passive: true }
  );
}

function setupQuickValueButtons() {
  const groups = document.querySelectorAll(".quick-values[data-target]");
  groups.forEach((group) => {
    const targetId = group.getAttribute("data-target");
    const input = document.getElementById(targetId);
    if (!input) {
      return;
    }
    group.querySelectorAll(".quick-value-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const value = Number(button.dataset.value || 0);
        input.value = String(value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    });
  });
}

function setupSettingsForm() {
  const form = document.getElementById("settingsForm");
  const status = document.getElementById("syncStatus");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      roomCode: document.getElementById("roomCode").value.trim(),
      databaseUrl: document.getElementById("databaseUrl").value.trim(),
      entriesPath: document.getElementById("entriesPath").value.trim(),
      syncEnabled: document.getElementById("syncEnabled").checked
    };

    try {
      await api("save_settings.php", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      status.textContent = "Paramètres enregistrés.";
      toast("Firebase connecté");
      await refreshAll();
    } catch (error) {
      status.textContent = `Erreur: ${error.message}`;
      toast("Impossible de sauvegarder", true);
    }
  });
}

function setupStockForm() {
  const form = document.getElementById("stockForm");
  const dateInput = document.getElementById("stockDate");
  const timeInput = document.getElementById("stockTime");
  const pumpDateInput = document.getElementById("stockPumpDate");
  const expiryDateInput = document.getElementById("stockExpiryDate");
  const directionInput = document.getElementById("stockDirection");
  const amountInput = document.getElementById("stockAmountMl");
  const fifoHint = document.getElementById("stockFifoHint");

  if (!form || !dateInput || !timeInput || !pumpDateInput || !expiryDateInput || !directionInput || !amountInput || !fifoHint) {
    return;
  }
  dateInput.value = todayISODate();
  timeInput.value = nowHHMM();
  pumpDateInput.value = todayISODate();
  expiryDateInput.value = computeEstimatedExpiryDate(pumpDateInput.value);

  function refreshStockDerivedFields() {
    const dir = directionInput.value;
    if (dir === "in") {
      expiryDateInput.value = computeEstimatedExpiryDate(pumpDateInput.value);
      fifoHint.textContent = "FIFO: les sorties utiliseront automatiquement le lot le plus ancien.";
      return;
    }
    const needed = Number(amountInput.value || 0);
    const candidate = computeFifoCandidate(state.stocksRaw, needed);
    if (!candidate) {
      fifoHint.textContent = "FIFO: aucun lot suffisant disponible pour cette sortie.";
      return;
    }
    fifoHint.textContent = `FIFO: sortie depuis le lot du ${formatDateFrLong(candidate.pumpDateIso)} (${candidate.remainingMl} ml dispos).`;
  }

  [pumpDateInput, directionInput, amountInput].forEach((el) => {
    el.addEventListener("input", refreshStockDerivedFields);
    el.addEventListener("change", refreshStockDerivedFields);
  });
  refreshStockDerivedFields();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      date: dateInput.value,
      time: timeInput.value,
      direction: document.getElementById("stockDirection")?.value || "in",
      amountMl: Number(document.getElementById("stockAmountMl")?.value || 0),
      pumpDate: pumpDateInput.value,
      expiryDate: expiryDateInput.value,
      note: String(document.getElementById("stockNote")?.value || "").trim()
    };
    try {
      await api("add_stock_movement.php", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      toast("Mouvement de stock ajouté");
      form.reset();
      dateInput.value = todayISODate();
      timeInput.value = nowHHMM();
      pumpDateInput.value = todayISODate();
      expiryDateInput.value = computeEstimatedExpiryDate(pumpDateInput.value);
      await refreshAll();
      refreshStockDerivedFields();
    } catch (error) {
      toast(error.message, true);
    }
  });
}

async function loadSettings() {
  try {
    const response = await api("get_settings.php");
    const settings = response.settings || {};
    document.getElementById("roomCode").value = settings.roomCode || "";
    document.getElementById("databaseUrl").value = settings.databaseUrl || "";
    document.getElementById("entriesPath").value = settings.entriesPath || "rooms/{roomCode}/entries";
    document.getElementById("syncEnabled").checked = Boolean(settings.syncEnabled);
  } catch (_error) {
    toast("Paramètres non chargés", true);
  }
}

async function bootstrap() {
  setupTabs();
  setupHamburgerMenu();
  setupDayNavigation();
  setupTodaySwipe();
  setupHistoryFilters();
  setupHistoryQuickFilters();
  setupHistoryActions();
  setupTotalsFilters();
  setupEntryForm();
  setupQuickValueButtons();
  setupStockForm();
  setupSettingsForm();
  await loadSettings();
  await refreshAll();
}

bootstrap().catch((error) => toast(error.message, true));
