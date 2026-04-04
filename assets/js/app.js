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

const DAILY_GOAL_ML = 1000;

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
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const text = await response.text();
  let data = {};
  if (text.trim() !== "") {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        response.ok
          ? "Réponse JSON invalide du serveur."
          : (text.slice(0, 120) || `Erreur HTTP ${response.status}`)
      );
    }
  }
  if (!response.ok || data.success === false) {
    throw new Error(data.error || `Erreur API (${response.status})`);
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

function getPageKey() {
  return document.body.dataset.page || "today";
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

  document.querySelectorAll(".navbar a.tab-btn").forEach((link) => {
    link.addEventListener("click", () => {
      close();
    });
  });

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

function normalizeEntryDateIso(e) {
  const iso = String(e.dateIso || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return iso;
  }
  const raw = String(e.date || "").trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split("/");
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }
  return iso || raw || "0000-00-00";
}

function normalizeEntryTime(t) {
  const s = String(t || "00:00").trim();
  const parts = s.split(":");
  const h = String(parts[0] ?? "0").padStart(2, "0");
  const m = String(parts[1] ?? "0").padStart(2, "0");
  const sec = String(parts[2] ?? "0").padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

function compareHistoryEntries(a, b, sortBy, sortOrder) {
  const mult = sortOrder === "asc" ? 1 : -1;
  const dateA = normalizeEntryDateIso(a);
  const dateB = normalizeEntryDateIso(b);
  if (dateA !== dateB) {
    return mult * dateA.localeCompare(dateB);
  }
  const tA = normalizeEntryTime(a.time);
  const tB = normalizeEntryTime(b.time);
  if (sortBy === "dateTime") {
    return mult * tA.localeCompare(tB);
  }
  if (sortBy === "milkPumpedMl") {
    const v = Number(a.milkPumpedMl || 0) - Number(b.milkPumpedMl || 0);
    if (v !== 0) {
      return mult * v;
    }
    return mult * tA.localeCompare(tB);
  }
  if (sortBy === "bottleMl") {
    const v = Number(a.bottleMl || 0) - Number(b.bottleMl || 0);
    if (v !== 0) {
      return mult * v;
    }
    return mult * tA.localeCompare(tB);
  }
  return mult * tA.localeCompare(tB);
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

  function buildGroupedRows(rows, renderDataRow) {
    if (!rows.length) {
      return "";
    }
    let html = "";
    let lastDateKey = null;
    rows.forEach((e) => {
      const dk = normalizeEntryDateIso(e);
      if (dk !== lastDateKey) {
        lastDateKey = dk;
        const label = formatDateFrLong(dk);
        html += `<tr class="history-date-heading"><td colspan="5"><span class="history-date-label">📅 ${label}</span></td></tr>`;
      }
      html += renderDataRow(e);
    });
    return html;
  }

  bottleBody.innerHTML = bottleRows.length
    ? buildGroupedRows(bottleRows, (e) => `
      <tr>
        <td class="history-date-cell-muted" aria-hidden="true">—</td>
        <td>${e.time}</td>
        <td>${e.bottleMl}</td>
        <td><strong class="note-strong">${e.note || "-"}</strong></td>
        ${actionsCell(e)}
      </tr>`)
    : "<tr><td colspan='5'>Aucune donnée biberon.</td></tr>";

  milkBody.innerHTML = milkRows.length
    ? buildGroupedRows(milkRows, (e) => `
      <tr>
        <td class="history-date-cell-muted" aria-hidden="true">—</td>
        <td>${e.time}</td>
        <td>${e.milkPumpedMl}</td>
        <td><strong class="note-strong">${e.note || "-"}</strong></td>
        ${actionsCell(e)}
      </tr>`)
    : "<tr><td colspan='5'>Aucune donnée tirage.</td></tr>";
}

function applyHistoryFiltersAndRender() {
  const search = (document.getElementById("historySearch")?.value || "").trim().toLowerCase();
  const sortBy = document.getElementById("historySortBy")?.value || "dateTime";
  const sortOrder = document.getElementById("historySortOrder")?.value || "desc";
  let rows = [...state.historyRaw];

  if (search !== "") {
    rows = rows.filter((e) => {
      const iso = normalizeEntryDateIso(e);
      const haystack = `${iso} ${e.date} ${e.time} ${e.note || ""} ${e.milkPumpedMl} ${e.bottleMl}`.toLowerCase();
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
        const iso = normalizeEntryDateIso(e);
        if (!iso || iso === "0000-00-00") {
          return false;
        }
        const d = new Date(`${iso}T00:00:00`);
        return d >= threshold;
      });
    }
  }

  const fromRaw = (document.getElementById("historyDateFrom")?.value || "").trim();
  const toRaw = (document.getElementById("historyDateTo")?.value || "").trim();
  if (fromRaw !== "" || toRaw !== "") {
    let fromIso = fromRaw;
    let toIso = toRaw;
    if (fromIso !== "" && toIso !== "" && fromIso > toIso) {
      const tmp = fromIso;
      fromIso = toIso;
      toIso = tmp;
    }
    rows = rows.filter((e) => {
      const iso = normalizeEntryDateIso(e);
      if (!iso || iso === "0000-00-00") {
        return false;
      }
      if (fromIso !== "" && iso < fromIso) {
        return false;
      }
      if (toIso !== "" && iso > toIso) {
        return false;
      }
      return true;
    });
  }

  if (state.historyQuickFilters.volume === "gt100") {
    rows = rows.filter((e) => Math.max(Number(e.milkPumpedMl || 0), Number(e.bottleMl || 0)) > 100);
  } else if (state.historyQuickFilters.volume === "lt100") {
    rows = rows.filter((e) => {
      const v = Math.max(Number(e.milkPumpedMl || 0), Number(e.bottleMl || 0));
      return v > 0 && v < 100;
    });
  }

  rows.sort((a, b) => compareHistoryEntries(a, b, sortBy, sortOrder));

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
  const inputs = ["historySearch", "historySortBy", "historySortOrder", "historyDateFrom", "historyDateTo"];
  inputs.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) {
      return;
    }
    const evt = id === "historySearch" ? "input" : "change";
    el.addEventListener(evt, applyHistoryFiltersAndRender);
  });
  const clearBtn = document.getElementById("historyDateClear");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      const fromEl = document.getElementById("historyDateFrom");
      const toEl = document.getElementById("historyDateTo");
      if (fromEl) {
        fromEl.value = "";
      }
      if (toEl) {
        toEl.value = "";
      }
      applyHistoryFiltersAndRender();
    });
  }
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
  if (!tbody) {
    return;
  }
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
    tbody.innerHTML = "<tr><td colspan='7'>Aucun mouvement.</td></tr>";
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
  if (!ctx) {
    return;
  }
  if (state.chart) {
    state.chart.destroy();
    state.chart = null;
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

function setupHeaderClock() {
  const dateEl = document.getElementById("topbarDate");
  const timeEl = document.getElementById("topbarTime");
  if (!dateEl || !timeEl) {
    return;
  }

  const render = () => {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    timeEl.textContent = now.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  render();
  setInterval(render, 1000);
}

const homeStatsAnimState = {
  count: 0,
  milkEntriesCount: 0,
  bottleEntriesCount: 0,
  totalMilk: 0,
  totalBottle: 0,
  total: 0,
  progressPct: 0
};

function animateValue(from, to, onUpdate, duration = 520) {
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (reduceMotion) {
    onUpdate(to);
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const start = performance.now();
    const delta = to - from;
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    function step(now) {
      const progress = Math.min(1, (now - start) / duration);
      const value = from + delta * easeOutCubic(progress);
      onUpdate(value);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        onUpdate(to);
        resolve();
      }
    }

    requestAnimationFrame(step);
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
  const els = {
    count: document.getElementById("statEntriesCount"),
    milkEntries: document.getElementById("statMilkEntriesCount"),
    bottleEntries: document.getElementById("statBottleEntriesCount"),
    milkTotal: document.getElementById("statMilkTotal"),
    bottleTotal: document.getElementById("statBottleTotal"),
    globalTotal: document.getElementById("statGlobalTotal"),
    progressText: document.getElementById("statProgressText"),
    progressBar: document.getElementById("statProgressBar")
  };

  if (!els.count || !els.progressBar || !els.progressText) {
    return;
  }

  animateValue(homeStatsAnimState.count, count, (v) => {
    els.count.textContent = String(Math.round(v));
  });
  animateValue(homeStatsAnimState.milkEntriesCount, milkEntriesCount, (v) => {
    els.milkEntries.textContent = String(Math.round(v));
  });
  animateValue(homeStatsAnimState.bottleEntriesCount, bottleEntriesCount, (v) => {
    els.bottleEntries.textContent = String(Math.round(v));
  });
  animateValue(homeStatsAnimState.totalMilk, totalMilk, (v) => {
    els.milkTotal.textContent = `${Math.round(v)} ml`;
  });
  animateValue(homeStatsAnimState.totalBottle, totalBottle, (v) => {
    els.bottleTotal.textContent = `${Math.round(v)} ml`;
  });
  animateValue(homeStatsAnimState.total, total, (v) => {
    els.globalTotal.textContent = `${Math.round(v)} ml`;
  });
  animateValue(homeStatsAnimState.progressPct, progressPct, (v) => {
    const pct = Math.round(v);
    const animatedMilk = Math.round((pct / 100) * DAILY_GOAL_ML);
    els.progressText.textContent = `${pct}% (${animatedMilk}/${DAILY_GOAL_ML} ml)`;
    els.progressBar.style.width = `${pct}%`;
  });

  homeStatsAnimState.count = count;
  homeStatsAnimState.milkEntriesCount = milkEntriesCount;
  homeStatsAnimState.bottleEntriesCount = bottleEntriesCount;
  homeStatsAnimState.totalMilk = totalMilk;
  homeStatsAnimState.totalBottle = totalBottle;
  homeStatsAnimState.total = total;
  homeStatsAnimState.progressPct = progressPct;
}

function setDashboardLoading(isLoading) {
  const hero = document.getElementById("homeHero");
  if (!hero) {
    return;
  }
  hero.classList.toggle("is-loading", Boolean(isLoading));
}

async function refreshAll() {
  const page = getPageKey();
  if (page === "today") {
    setDashboardLoading(true);
  }
  updateDayNavUi();
  const entryDateInput = document.getElementById("entryDate");
  if (entryDateInput) {
    entryDateInput.value = state.currentDayIso;
  }
  try {
    if (page === "today") {
      const today = await api(`get_today.php?date=${encodeURIComponent(state.currentDayIso)}`);
      const todayEntries = today.entries || [];
      renderTodayList(todayEntries);
      updateHomeStats(todayEntries);
      return;
    }
    if (page === "history") {
      const history = await api("get_history.php");
      state.historyRaw = history.entries || [];
      applyHistoryFiltersAndRender();
      return;
    }
    if (page === "totals") {
      const totals = await api("get_totals.php");
      state.totalsRaw = totals.totals || [];
      applyTotalsFiltersAndRender();
      return;
    }
    if (page === "chart") {
      const totals = await api("get_totals.php");
      state.totalsRaw = totals.totals || [];
      applyTotalsFiltersAndRender();
      return;
    }
    if (page === "stocks") {
      const stocks = await api("get_stocks.php");
      state.stocksRaw = stocks.movements || [];
      renderStocks(state.stocksRaw);
      return;
    }
    if (page === "settings") {
      return;
    }
  } finally {
    if (page === "today") {
      setDashboardLoading(false);
    }
  }
}

function setupEntryForm() {
  const form = document.getElementById("entryForm");
  const dateInput = document.getElementById("entryDate");
  const timeInput = document.getElementById("entryTime");
  const noteInput = document.getElementById("entryNote");
  const breastfedFlag = document.getElementById("breastfedFlag");
  const breastfedFlagBottle = document.getElementById("breastfedFlagBottle");
  if (!form || !dateInput || !timeInput || !noteInput) {
    return;
  }
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
  if (!form || !status) {
    return;
  }

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
  const pumpDateInput = document.getElementById("stockPumpDate");
  const directionInput = document.getElementById("stockDirection");
  const amountInput = document.getElementById("stockAmountMl");
  const fifoHint = document.getElementById("stockFifoHint");

  if (!form || !dateInput || !pumpDateInput || !directionInput || !amountInput || !fifoHint) {
    return;
  }
  dateInput.value = todayISODate();
  pumpDateInput.value = todayISODate();

  function refreshStockDerivedFields() {
    const dir = directionInput.value;
    if (dir === "in") {
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
    const amountMl = Number(document.getElementById("stockAmountMl")?.value || 0);
    if (!Number.isFinite(amountMl) || amountMl <= 0) {
      toast("Indique un volume supérieur à 0 ml.", true);
      return;
    }
    const payload = {
      date: dateInput.value,
      direction: document.getElementById("stockDirection")?.value || "in",
      amountMl,
      pumpDate: pumpDateInput.value,
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
      pumpDateInput.value = todayISODate();
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
  const page = getPageKey();
  setupHeaderClock();
  setupHamburgerMenu();
  if (page === "today") {
    setupDayNavigation();
    setupTodaySwipe();
    setupEntryForm();
    setupQuickValueButtons();
  }
  if (page === "history") {
    setupHistoryFilters();
    setupHistoryQuickFilters();
    setupHistoryActions();
  }
  if (page === "totals" || page === "chart") {
    setupTotalsFilters();
  }
  if (page === "stocks") {
    setupStockForm();
  }
  if (page === "settings") {
    setupSettingsForm();
    await loadSettings();
  }
  await refreshAll();
}

bootstrap().catch((error) => toast(error.message, true));
