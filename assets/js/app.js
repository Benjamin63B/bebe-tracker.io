const state = {
  chart: null,
  totalsRaw: [],
  historyRaw: []
};

const APP_TITLE_BASE = "Statistique 2026";
const TAB_TITLES = {
  today: "Aujourd'hui",
  history: "Historique",
  totals: "Totaux par jour",
  chart: "Graphique",
  settings: "Paramètres"
};

function todayISODate() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

function nowHHMM() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
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

function setupTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  const sections = document.querySelectorAll(".tab-content");
  const titleElement = document.getElementById("projectTitle");

  function setActiveTitle(tabKey) {
    const label = TAB_TITLES[tabKey] || "Aujourd'hui";
    const fullTitle = `${APP_TITLE_BASE} - ${label}`;
    document.title = fullTitle;
    if (titleElement) {
      titleElement.textContent = fullTitle;
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

  const header = `
    <div class="item item-head">
      <strong>Heure</strong>
      <strong>Tire-lait</strong>
      <strong>Biberon</strong>
      <strong>Note</strong>
    </div>`;

  list.innerHTML = header + entries
    .map(
      (entry) => `
      <div class="item">
        <strong>${entry.time}</strong>
        <span>Tire-lait: ${entry.milkPumpedMl} ml</span>
        <span>Biberon: ${entry.bottleMl} ml</span>
        <strong class="note-strong">${entry.note || "-"}</strong>
      </div>`
    )
    .join("");
}

function renderHistorySplit(entries) {
  const bottleBody = document.querySelector("#historyBottleTable tbody");
  const milkBody = document.querySelector("#historyMilkTable tbody");
  const bottleRows = entries.filter((e) => Number(e.bottleMl || 0) > 0);
  const milkRows = entries.filter((e) => Number(e.milkPumpedMl || 0) > 0);

  bottleBody.innerHTML = bottleRows.length
    ? bottleRows
        .map(
          (e) => `
      <tr>
        <td>${formatDateFrLong(e.dateIso || e.date)}</td>
        <td>${e.time}</td>
        <td>${e.bottleMl}</td>
        <td>${e.note || "-"}</td>
      </tr>`
        )
        .join("")
    : "<tr><td colspan='4'>Aucune donnée biberon.</td></tr>";

  milkBody.innerHTML = milkRows.length
    ? milkRows
        .map(
          (e) => `
      <tr>
        <td>${formatDateFrLong(e.dateIso || e.date)}</td>
        <td>${e.time}</td>
        <td>${e.milkPumpedMl}</td>
        <td>${e.note || "-"}</td>
      </tr>`
        )
        .join("")
    : "<tr><td colspan='4'>Aucune donnée tirage.</td></tr>";
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

function renderTotalsTable(totals) {
  const tbody = document.querySelector("#totalsTable tbody");
  if (!totals.length) {
    tbody.innerHTML = "<tr><td colspan='6'>Aucune donnée.</td></tr>";
    return;
  }
  tbody.innerHTML = totals
    .map(
      (row) => `
      <tr>
        <td>${row.date}</td>
        <td>${row.countMilkEntries ?? 0}</td>
        <td>${row.countBottleEntries ?? 0}</td>
        <td>${row.totalMilkPumped}</td>
        <td>${row.totalBottle}</td>
        <td>${row.totalGlobal}</td>
      </tr>`
    )
    .join("");
}

function renderChart(totals) {
  const ctx = document.getElementById("dailyChart");
  if (state.chart) {
    state.chart.destroy();
  }

  state.chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: totals.map((t) => t.date),
      datasets: [
        {
          label: "Tire-lait (ml)",
          data: totals.map((t) => t.totalMilkPumped),
          borderColor: "#1f9f7a",
          backgroundColor: "rgba(31, 159, 122, 0.2)",
          tension: 0.3
        },
        {
          label: "Biberon (ml)",
          data: totals.map((t) => t.totalBottle),
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
  const total = totalMilk + totalBottle;

  document.getElementById("statEntriesCount").textContent = String(count);
  document.getElementById("statMilkTotal").textContent = `${totalMilk} ml`;
  document.getElementById("statBottleTotal").textContent = `${totalBottle} ml`;
  document.getElementById("statGlobalTotal").textContent = `${total} ml`;
}

async function refreshAll() {
  const [today, history, totals] = await Promise.all([
    api("get_today.php"),
    api("get_history.php"),
    api("get_totals.php")
  ]);

  const todayEntries = today.entries || [];
  renderTodayList(todayEntries);
  state.historyRaw = history.entries || [];
  applyHistoryFiltersAndRender();
  state.totalsRaw = totals.totals || [];
  applyTotalsFiltersAndRender();
  updateHomeStats(todayEntries);
}

function setupEntryForm() {
  const form = document.getElementById("entryForm");
  const dateInput = document.getElementById("entryDate");
  const timeInput = document.getElementById("entryTime");
  const noteInput = document.getElementById("entryNote");
  const breastfedFlag = document.getElementById("breastfedFlag");
  dateInput.value = todayISODate();
  timeInput.value = nowHHMM();

  breastfedFlag.addEventListener("change", () => {
    const note = noteInput.value.trim();
    if (breastfedFlag.checked) {
      if (note === "") {
        noteInput.value = "Tétée";
      } else if (!note.toLowerCase().includes("tétée")) {
        noteInput.value = `${note} - Tétée`;
      }
      return;
    }

    noteInput.value = noteInput.value.replace(/\s*-\s*Tétée/gi, "").replace(/\bTétée\b/gi, "").trim();
  });

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
      dateInput.value = todayISODate();
      timeInput.value = nowHHMM();
    } catch (error) {
      toast(error.message, true);
    }
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
  setupHistoryFilters();
  setupTotalsFilters();
  setupEntryForm();
  setupSettingsForm();
  await loadSettings();
  await refreshAll();
}

bootstrap().catch((error) => toast(error.message, true));
