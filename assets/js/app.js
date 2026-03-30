(function () {
      /**
       * Synchro temps réel : créez un projet sur https://console.firebase.google.com
       * -> Realtime Database -> créer la base -> Règles (test) : .read/.write true sur "rooms"
       * -> Paramètres du projet -> Votre appli -> config Web -> copiez apiKey, authDomain, databaseURL, projectId
       */
      /** Si la synchro échoue : Firebase -> Realtime Database -> copier l'URL exacte dans databaseURL ci-dessous. */
      const FIREBASE_CONFIG = {
        apiKey: "AIzaSyDP1_68KcSqNAfKx8ObwkYbw_KmVLwaVAU",
        authDomain: "eleonore-617ce.firebaseapp.com",
        databaseURL: "https://eleonore-617ce-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "eleonore-617ce",
        storageBucket: "eleonore-617ce.firebasestorage.app",
        messagingSenderId: "130077142531",
        appId: "1:130077142531:web:4a1d72194eca4d0eaea836"
      };

      const STORAGE_KEY = "poupette_recap_lait_v1";
      const HISTORY_KEY = "poupette_recap_historique_v1";
      const NAMES_KEY = "poupette_recap_names_v1";
      const BABY_PROFILE_KEY = "poupette_baby_profile_v1";
      const BABY_GROWTH_LOG_KEY = "poupette_baby_growth_log_v1";
      const FIXED_BIRTH_DATE = "2026-03-14";
      const DEFAULT_GROWTH_WEIGHTS = [
        { date: "2026-03-17", weightKg: 3.315 },
        { date: "2026-03-18", weightKg: 3.32 },
        { date: "2026-03-19", weightKg: 3.345 },
        { date: "2026-03-20", weightKg: 3.3 },
        { date: "2026-03-21", weightKg: 3.22 },
        { date: "2026-03-22", weightKg: 3.4 },
        { date: "2026-03-24", weightKg: 3.54 },
        { date: "2026-03-26", weightKg: 3.6 }
      ];
      const PWD_HASH_KEY = "poupette_pwd_hash_v1";
      const SESSION_KEY = "poupette_session_unlock_v1";
      /** Session longue durée (mobile / « rester connecté ») */
      const PERSISTENT_UNLOCK_KEY = "poupette_rester_connecte_v1";
      const SYNC_ROOM_KEY = "poupette_sync_room_v1";
      const SYNC_ENABLED_KEY = "poupette_sync_enabled_v1";
      const REMINDER_SETTINGS_KEY = "poupette_tirage_reminders_v1";
      const REMINDER_HISTORY_KEY = "poupette_tirage_reminder_history_v1";
      const REMINDER_PERMISSION_PROMPT_KEY = "poupette_reminder_perm_prompt_v1";
      const FIXED_REMINDER_TIMES = ["00:00", "03:00", "06:00", "09:00", "12:00", "15:00", "18:00", "21:00"];
      const APP_BASE_PATH = (function () {
        try {
          // Ex: https://x.github.io/repo/ -> /repo/
          // Ex: https://x.github.io/repo/index.html -> /repo/
          const p = String(location.pathname || "/");
          if (p.endsWith("/")) return p;
          const i = p.lastIndexOf("/");
          return i >= 0 ? p.slice(0, i + 1) : "/";
        } catch {
          return "/";
        }
      })();

      let firebaseDb = null;
      let firebaseSyncRef = null;
      let applyingRemote = false;
      let cloudPushTimer = null;
      let reminderTimer = null;
      let reminderTestTimer = null;
      let swRegPromise = null;
      let firebaseSyncFirstSnapshot = true;
      let chartMode = "day";
      let chartMlInstance = null;
      let chartPrisesInstance = null;
      let chartGrowthWeightInstance = null;
      let chartGrowthSizeInstance = null;

      /** @typedef {{ id: string, date: string, time: string, tirage: number, biberon: number, note: string, createdAt: string }} Entry */

      function bufferToHex(buf) {
        return Array.from(new Uint8Array(buf))
          .map(function (b) {
            return b.toString(16).padStart(2, "0");
          })
          .join("");
      }

      async function hashPassword(pw) {
        if (!window.crypto || !crypto.subtle || !crypto.subtle.digest) {
          throw new Error("crypto");
        }
        const data = new TextEncoder().encode(pw);
        const hash = await crypto.subtle.digest("SHA-256", data);
        return bufferToHex(hash);
      }

      function uid() {
        return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2);
      }

      function todayISODate() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return y + "-" + m + "-" + day;
      }

      function nowTime() {
        const d = new Date();
        return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
      }

      function loadBabyProfile() {
        const defaults = {
          birthDate: FIXED_BIRTH_DATE,
          birthTime: "11:47",
          weightKg: "3.454",
          sizeCm: ""
        };
        try {
          const raw = localStorage.getItem(BABY_PROFILE_KEY);
          if (!raw) return defaults;
          const x = JSON.parse(raw);
          return {
            birthDate: FIXED_BIRTH_DATE,
            birthTime: typeof x.birthTime === "string" ? x.birthTime : defaults.birthTime,
            weightKg: typeof x.weightKg === "string" ? x.weightKg : defaults.weightKg,
            sizeCm: typeof x.sizeCm === "string" ? x.sizeCm : defaults.sizeCm
          };
        } catch {
          return defaults;
        }
      }

      function saveBabyProfile(profile) {
        localStorage.setItem(
          BABY_PROFILE_KEY,
          JSON.stringify({
            birthDate: FIXED_BIRTH_DATE,
            birthTime: (profile && profile.birthTime) || "",
            weightKg: (profile && profile.weightKg) || "",
            sizeCm: (profile && profile.sizeCm) || ""
          })
        );
        scheduleCloudPush();
      }

      function loadBabyGrowthLog() {
        try {
          const raw = localStorage.getItem(BABY_GROWTH_LOG_KEY);
          if (!raw) return [];
          const arr = JSON.parse(raw);
          return Array.isArray(arr) ? arr : [];
        } catch {
          return [];
        }
      }

      function saveBabyGrowthLog(log) {
        localStorage.setItem(BABY_GROWTH_LOG_KEY, JSON.stringify(log));
        scheduleCloudPush();
      }

      function loadReminderSettings() {
        const defaults = { enabled: false, intervalHours: 3, minute: 0 };
        try {
          const raw = localStorage.getItem(REMINDER_SETTINGS_KEY);
          if (!raw) return defaults;
          const x = JSON.parse(raw);
          return {
            enabled: !!(x && x.enabled),
            intervalHours: Math.min(12, Math.max(1, Number((x && x.intervalHours) || 3) || 3)),
            minute: Math.min(59, Math.max(0, Number((x && x.minute) || 0) || 0))
          };
        } catch {
          return defaults;
        }
      }

      function saveReminderSettings(v) {
        const clean = {
          enabled: !!(v && v.enabled),
          intervalHours: Math.min(12, Math.max(1, Number((v && v.intervalHours) || 3) || 3)),
          minute: Math.min(59, Math.max(0, Number((v && v.minute) || 0) || 0))
        };
        localStorage.setItem(REMINDER_SETTINGS_KEY, JSON.stringify(clean));
      }

      function loadReminderHistory() {
        try {
          const raw = localStorage.getItem(REMINDER_HISTORY_KEY);
          if (!raw) return [];
          const arr = JSON.parse(raw);
          return Array.isArray(arr) ? arr : [];
        } catch {
          return [];
        }
      }

      function saveReminderHistory(items) {
        localStorage.setItem(REMINDER_HISTORY_KEY, JSON.stringify((items || []).slice(0, 120)));
      }

      function firebaseConfigured() {
        if (typeof firebase === "undefined") return false;
        return !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey.indexOf("YOUR_") !== 0);
      }

      function sanitizeRoomCode(raw) {
        return String(raw || "")
          .replace(/[^a-zA-Z0-9_-]/g, "")
          .slice(0, 64);
      }

      function getEnabledRoomCode() {
        if (localStorage.getItem(SYNC_ENABLED_KEY) !== "1") return "";
        const room = sanitizeRoomCode(localStorage.getItem(SYNC_ROOM_KEY) || "");
        return room.length >= 4 ? room : "";
      }

      function getCloudPasswordRef() {
        const db = ensureFirebaseDb();
        if (!db) return null;
        const room = getEnabledRoomCode();
        if (!room) return null;
        return db.ref("rooms/" + room + "/security/pwdHash");
      }

      function readCloudPasswordHash() {
        const ref = getCloudPasswordRef();
        if (!ref) return Promise.resolve("");
        return new Promise(function (resolve) {
          ref.once(
            "value",
            function (snap) {
              const v = snap.val();
              resolve(typeof v === "string" ? v : "");
            },
            function () {
              resolve("");
            }
          );
        });
      }

      function pushPasswordHashToCloud(hash) {
        const ref = getCloudPasswordRef();
        if (!ref || !hash) return;
        ref.set(hash, function () {});
      }

      function clearCloudPasswordHash() {
        const ref = getCloudPasswordRef();
        if (!ref) return;
        ref.remove(function () {});
      }

      async function ensurePasswordHashLoadedFromCloud() {
        const local = localStorage.getItem(PWD_HASH_KEY);
        if (local) return local;
        const cloud = await readCloudPasswordHash();
        if (cloud) {
          localStorage.setItem(PWD_HASH_KEY, cloud);
          return cloud;
        }
        return "";
      }

      function setSyncStatusText(msg) {
        const el = document.getElementById("sync-status");
        if (el) el.textContent = msg || "";
        updateSyncPill();
      }

      function updateSyncPill(state) {
        const pill = document.getElementById("sync-pill");
        if (!pill) return;
        const online = typeof navigator !== "undefined" ? navigator.onLine !== false : true;
        if (!online) {
          pill.hidden = false;
          pill.textContent = "Hors ligne";
          pill.className = "sync-pill sync-pill--warn";
          return;
        }

        const enabled = localStorage.getItem(SYNC_ENABLED_KEY) === "1";
        if (!enabled) {
          pill.hidden = true;
          pill.textContent = "";
          pill.className = "sync-pill sync-pill--off";
          return;
        }

        const statusText = (document.getElementById("sync-status") && document.getElementById("sync-status").textContent) || "";
        if (/Erreur|erreur|impossible/i.test(statusText)) {
          pill.hidden = false;
          pill.textContent = "Erreur";
          pill.className = "sync-pill sync-pill--err";
          return;
        }

        if (firebaseSyncRef) {
          pill.hidden = false;
          pill.textContent = "Connecté";
          pill.className = "sync-pill sync-pill--ok";
          return;
        }

        pill.hidden = false;
        pill.textContent = "En cours";
        pill.className = "sync-pill sync-pill--warn";
      }

      window.addEventListener("online", function () {
        updateSyncPill();
      });
      window.addEventListener("offline", function () {
        updateSyncPill();
      });

      function updateFirebaseHintUI() {
        const miss = document.getElementById("sync-firebase-missing");
        if (!miss) return;
        miss.hidden = firebaseConfigured();
      }

      function tearDownFirebaseSync() {
        if (firebaseSyncRef) {
          firebaseSyncRef.off();
          firebaseSyncRef = null;
          updateSyncPill();
        }
      }

      function ensureFirebaseDb() {
        if (firebaseDb) return firebaseDb;
        if (!firebaseConfigured()) return null;
        try {
          if (!firebase.apps.length) {
            firebase.initializeApp(FIREBASE_CONFIG);
          }
          firebaseDb = firebase.database();
          return firebaseDb;
        } catch (e) {
          setSyncStatusText("Erreur Firebase : " + e.message);
          return null;
        }
      }

      function scheduleCloudPush() {
        if (applyingRemote) return;
        if (!firebaseConfigured()) return;
        ensureFirebaseDb();
        if (!firebaseDb) return;
        if (localStorage.getItem(SYNC_ENABLED_KEY) !== "1") return;
        const room = sanitizeRoomCode(localStorage.getItem(SYNC_ROOM_KEY) || "");
        if (room.length < 4) return;
        clearTimeout(cloudPushTimer);
        cloudPushTimer = setTimeout(pushBundleToCloud, 450);
      }

      function pushBundleToCloud() {
        if (applyingRemote) return;
        const db = ensureFirebaseDb();
        if (!db) return;
        if (localStorage.getItem(SYNC_ENABLED_KEY) !== "1") return;
        const room = sanitizeRoomCode(localStorage.getItem(SYNC_ROOM_KEY) || "");
        if (room.length < 4) return;
        const ref = db.ref("rooms/" + room + "/bundle");
        ref.set(
          {
            entries: loadEntries(),
            names: loadNames(),
            babyProfile: loadBabyProfile(),
            babyGrowthLog: loadBabyGrowthLog(),
            reminderSettings: loadReminderSettings(),
            reminderHistory: loadReminderHistory(),
            historyLog: loadHistoryLog(),
            updatedAt: firebase.database.ServerValue.TIMESTAMP
          },
          function (err) {
            if (err) {
              setSyncStatusText("Erreur d'envoi : " + (err.message || String(err)));
            } else {
              setSyncStatusText("Synchronisé · " + new Date().toLocaleTimeString("fr-FR"));
            }
          }
        );
      }

      function populateSyncUI() {
        const roomEl = document.getElementById("sync-room-code");
        const enEl = document.getElementById("sync-enabled");
        if (roomEl) roomEl.value = localStorage.getItem(SYNC_ROOM_KEY) || "";
        if (enEl) enEl.checked = localStorage.getItem(SYNC_ENABLED_KEY) === "1";
        updateFirebaseHintUI();
      }

      function initFirebaseSync() {
        tearDownFirebaseSync();
        firebaseSyncFirstSnapshot = true;
        updateFirebaseHintUI();
        updateSyncPill();
        if (!firebaseConfigured()) {
          setSyncStatusText("Configurez Firebase (objet FIREBASE_CONFIG) pour la synchro en ligne.");
          return;
        }
        const db = ensureFirebaseDb();
        if (!db) return;
        if (localStorage.getItem(SYNC_ENABLED_KEY) !== "1") {
          setSyncStatusText("Synchro désactivée.");
          return;
        }
        const room = sanitizeRoomCode(localStorage.getItem(SYNC_ROOM_KEY) || "");
        if (room.length < 4) {
          setSyncStatusText("Code salon : au moins 4 caractères (lettres, chiffres, - _).");
          return;
        }
        firebaseSyncRef = db.ref("rooms/" + room + "/bundle");
        firebaseSyncRef.on("value", function (snap) {
          const v = snap.val();
          if (firebaseSyncFirstSnapshot) {
            firebaseSyncFirstSnapshot = false;
            if (!v || !Array.isArray(v.entries)) {
              pushBundleToCloud();
              setSyncStatusText("Connexion - envoi de vos données locales.");
              return;
            }
          }
          if (!v || !Array.isArray(v.entries)) return;
          applyingRemote = true;
          try {
            saveEntries(v.entries);
            if (v.names && typeof v.names === "object") {
              saveNames(v.names);
            }
            if (v.babyProfile && typeof v.babyProfile === "object") {
              saveBabyProfile(v.babyProfile);
            }
            if (v.babyGrowthLog && Array.isArray(v.babyGrowthLog)) {
              saveBabyGrowthLog(v.babyGrowthLog);
            }
            if (v.reminderSettings && typeof v.reminderSettings === "object") {
              saveReminderSettings(v.reminderSettings);
            }
            if (v.reminderHistory && Array.isArray(v.reminderHistory)) {
              saveReminderHistory(v.reminderHistory);
            }
            applyNamesToInputs();
            renderBabyProfile(true);
            renderGrowthSection();
            renderReminderHistory();
            syncReminderUI();
            scheduleTirageReminders();
            if (v.historyLog && Array.isArray(v.historyLog)) {
              saveHistoryLog(v.historyLog);
            }
            renderTodayTable();
            renderHistory();
            renderDailyRecap();
            setSyncStatusText("Données à jour · " + new Date().toLocaleTimeString("fr-FR"));
          } finally {
            applyingRemote = false;
          }
        });
        setSyncStatusText("Écoute du salon « " + room + " »...");
      }

      function loadEntries() {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (!raw) return [];
          const arr = JSON.parse(raw);
          return Array.isArray(arr) ? arr : [];
        } catch {
          return [];
        }
      }

      function saveEntries(entries) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
        scheduleCloudPush();
      }

      /** Retour haptique court après une saisie enregistrée (mobile : API Vibration). */
      function hapticSuccess() {
        try {
          if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
            navigator.vibrate(20);
          }
        } catch (_e) {}
      }

      let toastHideTimer = null;
      let toastRemoveTimer = null;

      function showToast(message, kind) {
        const el = document.getElementById("toast");
        if (!el) return;
        clearTimeout(toastHideTimer);
        clearTimeout(toastRemoveTimer);
        el.textContent = message;
        el.hidden = false;
        el.classList.remove("toast--error", "toast--ok", "toast--visible");
        el.classList.add(kind === "error" ? "toast--error" : "toast--ok");
        requestAnimationFrame(function () {
          el.classList.add("toast--visible");
        });
        toastHideTimer = setTimeout(function () {
          el.classList.remove("toast--visible");
          toastRemoveTimer = setTimeout(function () {
            el.hidden = true;
          }, 400);
        }, 2600);
      }

      function shakeFormCard() {
        const card = document.getElementById("card-form-entry");
        if (!card) return;
        card.classList.remove("card-shake");
        void card.offsetWidth;
        card.classList.add("card-shake");
        card.addEventListener(
          "animationend",
          function () {
            card.classList.remove("card-shake");
          },
          { once: true }
        );
      }

      function shakeModalEdit() {
        const modal = document.querySelector("#modal-edit .modal");
        if (!modal) return;
        modal.classList.remove("modal-shake");
        void modal.offsetWidth;
        modal.classList.add("modal-shake");
        modal.addEventListener(
          "animationend",
          function () {
            modal.classList.remove("modal-shake");
          },
          { once: true }
        );
      }

      /** Données d'exemple identiques à la maquette (biberons Éléonore / tirages Andéole), 23-25 mars. */
      function buildDemoEntries() {
        const year = new Date().getFullYear();
        function iso(day) {
          return year + "-03-" + String(day).padStart(2, "0");
        }
        function row(dateStr, timeStr, tirage, biberon) {
          return {
            id: uid(),
            date: dateStr,
            time: timeStr,
            tirage: tirage,
            biberon: biberon,
            note: "",
            createdAt: new Date().toISOString()
          };
        }
        const out = [];
        const biberonSpec = [
          [23, "03:00", 80], [23, "07:00", 80], [23, "10:30", 90], [23, "13:30", 80], [23, "15:35", 90], [23, "18:00", 90], [23, "21:20", 80],
          [24, "02:10", 80], [24, "05:35", 80], [24, "09:10", 80], [24, "12:00", 90], [24, "15:00", 90], [24, "17:30", 80], [24, "20:00", 80], [24, "23:15", 90],
          [25, "04:15", 60], [25, "05:10", 30], [25, "08:30", 90], [25, "11:10", 90], [25, "13:30", 80], [25, "16:25", 80]
        ];
        const tirageSpec = [
          [23, "01:30", 80], [23, "05:00", 80], [23, "08:10", 90], [23, "10:00", 50], [23, "13:00", 60], [23, "16:10", 60], [23, "19:40", 80], [23, "22:10", 20],
          [24, "02:30", 80], [24, "05:40", 80], [24, "10:17", 140], [24, "12:40", 70], [24, "14:30", 45], [24, "18:00", 80], [24, "21:30", 90], [24, "23:30", 60],
          [25, "04:30", 120], [25, "09:25", 120], [25, "13:00", 120], [25, "15:30", 60]
        ];
        biberonSpec.forEach(function (spec) {
          out.push(row(iso(spec[0]), spec[1], 0, spec[2]));
        });
        tirageSpec.forEach(function (spec) {
          out.push(row(iso(spec[0]), spec[1], spec[2], 0));
        });
        return sortEntriesChrono(out);
      }

      /** Si aucune donnée : insère la démo pour que l'historique ne soit jamais vide au premier usage. */
      function ensureDemoDataIfEmpty() {
        if (loadEntries().length > 0) return;
        saveEntries(buildDemoEntries());
        saveNames({ biberon: "Éléonore", tirage: "Andéole" });
        applyNamesToInputs();
      }

      function ensureDefaultGrowthWeights() {
        const current = loadBabyGrowthLog();
        const present = new Set(
          current.map(function (x) {
            return String(x.date || "") + "|" + String(x.weightKg == null ? "" : x.weightKg);
          })
        );
        let changed = false;
        DEFAULT_GROWTH_WEIGHTS.forEach(function (row) {
          const key = row.date + "|" + row.weightKg;
          if (present.has(key)) return;
          current.push({
            id: uid(),
            date: row.date,
            weightKg: row.weightKg,
            sizeCm: null,
            createdAt: new Date().toISOString()
          });
          changed = true;
        });
        if (changed) saveBabyGrowthLog(current);
      }

      function loadDemoReplace() {
        saveEntries(buildDemoEntries());
        saveNames({ biberon: "Éléonore", tirage: "Andéole" });
        applyNamesToInputs();
        try {
          localStorage.removeItem(HISTORY_KEY);
        } catch (e) {}
        renderTodayTable();
        renderHistory();
        renderDailyRecap();
      }

      function loadHistoryLog() {
        try {
          const raw = localStorage.getItem(HISTORY_KEY);
          if (!raw) return [];
          const arr = JSON.parse(raw);
          return Array.isArray(arr) ? arr : [];
        } catch {
          return [];
        }
      }

      function saveHistoryLog(log) {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(log.slice(0, 500)));
        scheduleCloudPush();
      }

      function pushHistory(action, entrySnapshot) {
        const log = loadHistoryLog();
        log.unshift({
          at: new Date().toISOString(),
          action,
          entry: entrySnapshot
        });
        saveHistoryLog(log);
      }

      /** @param {Entry[]} entries */
      function sortEntries(entries) {
        return [...entries].sort((a, b) => {
          const da = a.date + "T" + (a.time || "00:00");
          const db = b.date + "T" + (b.time || "00:00");
          return db.localeCompare(da);
        });
      }

      const addDate = document.getElementById("add-date");
      const addTime = document.getElementById("add-time");
      const tbodyAujourdhui = document.getElementById("tbody-aujourdhui");
      const emptyAujourdhui = document.getElementById("empty-aujourdhui");
      const dayTimeline = document.getElementById("day-timeline");
      const badgeDate = document.getElementById("badge-date");
      const totalTirage = document.getElementById("total-tirage");
      const totalBiberon = document.getElementById("total-biberon");
      const bottleFill = document.getElementById("bottle-fill");
      const bottleCaption = document.getElementById("bottle-caption");
      const babyBirthDate = document.getElementById("baby-birth-date");
      const babyBirthTime = document.getElementById("baby-birth-time");
      const babyWeight = document.getElementById("baby-weight");
      const babySize = document.getElementById("baby-size");
      const babyAgeExact = document.getElementById("baby-age-exact");
      const babyWeightDisplay = document.getElementById("baby-weight-display");
      const babySizeDisplay = document.getElementById("baby-size-display");
      const growthDateInput = document.getElementById("growth-date");
      const growthWeightInput = document.getElementById("growth-weight");
      const growthSizeInput = document.getElementById("growth-size");
      const growthPanel = document.getElementById("panel-croissance");
      const growthUnlockForm = document.getElementById("form-growth-unlock");
      const growthUnlockPassword = document.getElementById("growth-unlock-password");
      const growthUnlockError = document.getElementById("growth-unlock-error");
      const reminderEnabledInput = document.getElementById("reminder-enabled");
      const reminderIntervalInput = document.getElementById("reminder-interval-hours");
      const reminderMinuteInput = document.getElementById("reminder-minute");
      const reminderTestTimeInput = document.getElementById("reminder-test-time");
      const reminderStatus = document.getElementById("reminder-status");
      const reminderFixedTimesEl = document.getElementById("reminder-fixed-times");
      const reminderHistoryList = document.getElementById("reminder-history-list");
      const historyContainer = document.getElementById("history-container");
      const emptyHistorique = document.getElementById("empty-historique");
      const inputNameBiberon = document.getElementById("name-biberon");
      const inputNameTirage = document.getElementById("name-tirage");
      let growthSectionUnlocked = false;

      function setGrowthUnlockError(msg) {
        if (!growthUnlockError) return;
        if (!msg) {
          growthUnlockError.hidden = true;
          growthUnlockError.textContent = "";
        } else {
          growthUnlockError.textContent = msg;
          growthUnlockError.hidden = false;
        }
      }

      function applyGrowthLockState() {
        if (!growthPanel) return;
        growthPanel.classList.toggle("growth-locked", !growthSectionUnlocked);
        if (growthUnlockPassword) {
          growthUnlockPassword.value = "";
          if (!growthSectionUnlocked && !growthPanel.hidden) growthUnlockPassword.focus();
        }
        setGrowthUnlockError("");
      }

      function setReminderStatus(text) {
        if (reminderStatus) reminderStatus.textContent = text || "";
      }

      function updateReminderPermissionUI() {
        const btn = document.getElementById("btn-reminder-permission");
        if (!btn) return;
        btn.hidden = false;
        if (typeof Notification === "undefined") {
          btn.textContent = "Notifications non supportées";
          btn.disabled = true;
          return;
        }
        if (Notification.permission === "granted") {
          btn.textContent = "Notifications activées";
          btn.disabled = true;
          return;
        }
        if (Notification.permission === "denied") {
          btn.textContent = "Notifications bloquées (paramètres)";
          btn.disabled = false;
          return;
        }
        btn.textContent = "Autoriser notifications";
        btn.disabled = false;
      }

      function ensureServiceWorkerReady() {
        if (swRegPromise) return swRegPromise;
        if (!("serviceWorker" in navigator)) return Promise.resolve(null);
        const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
        if (location.protocol !== "https:" && !isLocal) return Promise.resolve(null);
        // Important pour GitHub Pages : scope doit être la racine du projet (ex: /bebe-tracker.io/).
        swRegPromise = navigator.serviceWorker
          .register(APP_BASE_PATH + "assets/sw/poupette-sw.js", { scope: APP_BASE_PATH })
          .catch(function () {
          return null;
        });
        return swRegPromise;
      }

      function renderReminderFixedTimes() {
        if (!reminderFixedTimesEl) return;
        reminderFixedTimesEl.innerHTML = "";
        FIXED_REMINDER_TIMES.forEach(function (t) {
          const s = document.createElement("span");
          s.className = "reminder-time-chip";
          s.textContent = t;
          reminderFixedTimesEl.appendChild(s);
        });
      }

      function addReminderHistory(kind, msg) {
        const hist = loadReminderHistory();
        hist.unshift({ at: new Date().toISOString(), kind: kind || "info", msg: msg || "" });
        saveReminderHistory(hist);
        renderReminderHistory();
      }

      function renderReminderHistory() {
        if (!reminderHistoryList) return;
        const hist = loadReminderHistory();
        reminderHistoryList.innerHTML = "";
        if (!hist.length) {
          const li = document.createElement("li");
          li.textContent = "Aucun événement de rappel pour le moment.";
          reminderHistoryList.appendChild(li);
          return;
        }
        hist.forEach(function (x) {
          const li = document.createElement("li");
          const d = new Date(x.at);
          const hhmm = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          li.textContent = "[" + hhmm + "] " + (x.kind || "info") + " - " + (x.msg || "");
          reminderHistoryList.appendChild(li);
        });
      }

      function showMobileNotification(title, body) {
        if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
        const optsPrimary = {
          body: body || "",
          tag: "poupette-rappel",
          renotify: true,
          requireInteraction: true,
          silent: false,
          vibrate: [280, 120, 280, 120, 420],
          icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect x='18' y='8' width='28' height='50' rx='10' fill='%23F2B5D4'/%3E%3Crect x='22' y='20' width='20' height='34' rx='8' fill='%237BDFF2'/%3E%3C/svg%3E"
        };
        const optsWatchCompat = {
          body: body || "",
          // Tag unique pour éviter la fusion et améliorer le relais montre.
          tag: "poupette-watch-" + Date.now(),
          renotify: true,
          requireInteraction: false,
          silent: false,
          vibrate: [350, 180, 350],
          icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect x='18' y='8' width='28' height='50' rx='10' fill='%23F2B5D4'/%3E%3Crect x='22' y='20' width='20' height='34' rx='8' fill='%237BDFF2'/%3E%3C/svg%3E"
        };

        function emit(reg, t, opts) {
          if (reg && typeof reg.showNotification === "function") return reg.showNotification(t, opts);
          return Promise.resolve().then(function () {
            new Notification(t, opts);
          });
        }

        ensureServiceWorkerReady()
          .then(function (reg) {
            emit(reg, title, optsPrimary).catch(function () {});
            // 2e notification courte "compat montre" ~2s après.
            setTimeout(function () {
              emit(reg, "Rappel tirage (montre)", optsWatchCompat).catch(function () {});
            }, 1900);
          })
          .catch(function () {
            try {
              new Notification(title, optsPrimary);
              setTimeout(function () {
                try {
                  new Notification("Rappel tirage (montre)", optsWatchCompat);
                } catch (_e2) {}
              }, 1900);
            } catch (_e) {}
          });
      }

      function playReminderRingtone() {
        try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return;
          const ctx = new Ctx();
          const notes = [880, 988, 1175, 988, 880];
          let t = ctx.currentTime + 0.02;
          notes.forEach(function (freq) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.exponentialRampToValueAtTime(0.12, t + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.24);
            t += 0.18;
          });
          setTimeout(function () {
            try { ctx.close(); } catch (_e) {}
          }, 1400);
        } catch (_e) {}
      }

      function requestReminderPermission() {
        if (typeof Notification === "undefined") {
          setReminderStatus("Notifications non supportées sur ce navigateur.");
          return Promise.resolve("denied");
        }
        return Notification.requestPermission().then(function (perm) {
          if (perm === "granted") setReminderStatus("Notifications autorisées.");
          else setReminderStatus("Notifications non autorisées.");
          updateReminderPermissionUI();
          return perm;
        });
      }

      function isLikelyMobile() {
        try {
          const ua = (navigator.userAgent || "").toLowerCase();
          return /android|iphone|ipad|ipod|mobile/i.test(ua) || (window.matchMedia && window.matchMedia("(max-width: 900px)").matches);
        } catch {
          return false;
        }
      }

      function maybePromptNotificationOnMobile() {
        if (typeof Notification === "undefined") return;
        if (Notification.permission !== "default") return;
        if (!isLikelyMobile()) return;
        const today = todayISODate();
        const last = localStorage.getItem(REMINDER_PERMISSION_PROMPT_KEY) || "";
        if (last === today) return;
        localStorage.setItem(REMINDER_PERMISSION_PROMPT_KEY, today);
        requestReminderPermission();
      }

      function nextReminderDate(now, intervalHours, minute) {
        const stepMin = Math.max(1, intervalHours) * 60;
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
        for (let i = 0; i < Math.ceil((48 * 60) / stepMin) + 5; i++) {
          const t = new Date(start + i * stepMin * 60000 + minute * 60000);
          if (t.getTime() > now.getTime() + 1000) return t;
        }
        return new Date(now.getTime() + stepMin * 60000);
      }

      function nextReminderDateFromFixedTimes(now) {
        const items = FIXED_REMINDER_TIMES.map(function (t) {
          const p = String(t).split(":").map(Number);
          return { h: p[0] || 0, m: p[1] || 0, label: t };
        });
        for (let i = 0; i < items.length; i++) {
          const d = new Date(now);
          d.setHours(items[i].h, items[i].m, 0, 0);
          if (d.getTime() > now.getTime() + 1000) return d;
        }
        const first = items[0];
        const d2 = new Date(now);
        d2.setDate(d2.getDate() + 1);
        d2.setHours(first.h, first.m, 0, 0);
        return d2;
      }

      function clearReminderTimers() {
        if (reminderTimer) {
          clearTimeout(reminderTimer);
          reminderTimer = null;
        }
        if (reminderTestTimer) {
          clearTimeout(reminderTestTimer);
          reminderTestTimer = null;
        }
      }

      function scheduleTirageReminders() {
        try {
          if (reminderTimer) {
            clearTimeout(reminderTimer);
            reminderTimer = null;
          }
          const s = loadReminderSettings();
          if (!s.enabled) {
            setReminderStatus("Rappels désactivés.");
            return;
          }
          const next = nextReminderDateFromFixedTimes(new Date());
          const waitMs = Math.max(1000, next.getTime() - Date.now());
          setReminderStatus(
            "Prochain rappel à " + next.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + "."
          );
          addReminderHistory(
            "planifié",
            "Prochain rappel prévu à " +
              next.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
              "."
          );
          reminderTimer = setTimeout(function () {
            showMobileNotification("Rappel tirage", "Pensez au prochain tirage.");
            playReminderRingtone();
            showToast("Rappel tirage", "ok");
            addReminderHistory("envoyé", "Notification automatique envoyée.");
            scheduleTirageReminders();
          }, waitMs);
        } catch (err) {
          setReminderStatus("Erreur planification: " + (err && err.message ? err.message : String(err)));
        }
      }

      function syncReminderUI() {
        const s = loadReminderSettings();
        if (reminderEnabledInput) reminderEnabledInput.checked = !!s.enabled;
        if (reminderIntervalInput) reminderIntervalInput.value = String(s.intervalHours);
        if (reminderMinuteInput) reminderMinuteInput.value = String(s.minute);
        if (reminderTestTimeInput && !reminderTestTimeInput.value) reminderTestTimeInput.value = nowTime();
        updateReminderPermissionUI();
      }

      function persistReminderSettingsFromUI() {
        try {
          const current = loadReminderSettings();
          const next = {
            enabled: reminderEnabledInput ? reminderEnabledInput.checked : current.enabled,
            intervalHours: reminderIntervalInput
              ? Number(reminderIntervalInput.value || current.intervalHours)
              : current.intervalHours,
            minute: reminderMinuteInput ? Number(reminderMinuteInput.value || current.minute) : current.minute
          };
          saveReminderSettings(next);
          // Feedback immédiat (ça évite l'impression que "rien ne se passe").
          setReminderStatus(next.enabled ? "Rappels activés." : "Rappels désactivés.");
          if (next.enabled && typeof Notification !== "undefined" && Notification.permission === "default") {
            requestReminderPermission();
          }
          syncReminderUI();
          scheduleTirageReminders();
        } catch (err) {
          setReminderStatus("Erreur rappels: " + (err && err.message ? err.message : String(err)));
        }
      }

      function scheduleReminderTest(timeStr) {
        if (reminderTestTimer) {
          clearTimeout(reminderTestTimer);
          reminderTestTimer = null;
        }
        const m = /^(\d{2}):(\d{2})$/.exec(String(timeStr || ""));
        if (!m) {
          setReminderStatus("Heure de test invalide.");
          return;
        }
        const hh = Number(m[1]);
        const mm = Number(m[2]);
        const target = new Date();
        target.setHours(hh, mm, 0, 0);
        if (target.getTime() <= Date.now() + 1000) target.setDate(target.getDate() + 1);
        const waitMs = target.getTime() - Date.now();
        setReminderStatus("Test programmé à " + target.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + ".");
        addReminderHistory("test", "Test programmé à " + target.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + ".");
        reminderTestTimer = setTimeout(function () {
          showMobileNotification("Test rappel tirage", "Notification de test réussie.");
          playReminderRingtone();
          showToast("Notification de test envoyée.", "ok");
          addReminderHistory("test", "Notification de test envoyée.");
          scheduleTirageReminders();
        }, waitMs);
      }

      function daysBetweenIso(a, b) {
        try {
          const pa = a.split("-").map(Number);
          const pb = b.split("-").map(Number);
          const da = Date.UTC(pa[0], pa[1] - 1, pa[2]);
          const db = Date.UTC(pb[0], pb[1] - 1, pb[2]);
          return Math.floor((db - da) / 86400000);
        } catch {
          return 0;
        }
      }

      function renderBabyProfile(syncInputs) {
        const p = loadBabyProfile();
        if (syncInputs) {
          if (babyBirthDate) babyBirthDate.value = FIXED_BIRTH_DATE;
          if (babyBirthTime) babyBirthTime.value = p.birthTime || "";
          if (babyWeight) babyWeight.value = p.weightKg || "";
          if (babySize) babySize.value = p.sizeCm || "";
        }
        const refDate = addDate && addDate.value ? addDate.value : todayISODate();
        const days = Math.max(0, daysBetweenIso(p.birthDate, refDate));
        const weeks = Math.floor(days / 7);
        const rem = days % 7;
        if (babyAgeExact) babyAgeExact.textContent = weeks + " sem + " + rem + " j";
        if (babyWeightDisplay) {
          babyWeightDisplay.textContent = p.weightKg ? p.weightKg.replace(".", ",") + " kg" : "—";
        }
        if (babySizeDisplay) {
          babySizeDisplay.textContent = p.sizeCm ? p.sizeCm.replace(".", ",") + " cm" : "—";
        }
      }

      function persistBabyProfile() {
        saveBabyProfile({
          birthDate: (babyBirthDate && babyBirthDate.value) || "",
          birthTime: (babyBirthTime && babyBirthTime.value) || "",
          weightKg: (babyWeight && babyWeight.value) || "",
          sizeCm: (babySize && babySize.value) || ""
        });
        renderBabyProfile(false);
      }

      [babyBirthDate, babyBirthTime, babyWeight, babySize].forEach(function (el) {
        if (!el) return;
        el.addEventListener("change", persistBabyProfile);
      });

      if (growthUnlockForm) {
        growthUnlockForm.addEventListener("submit", async function (ev) {
          ev.preventDefault();
          setGrowthUnlockError("");
          const pw = (growthUnlockPassword && growthUnlockPassword.value) || "";
          if (!pw) {
            setGrowthUnlockError("Entrez le mot de passe.");
            return;
          }
          const stored = localStorage.getItem(PWD_HASH_KEY);
          if (!stored) {
            growthSectionUnlocked = true;
            applyGrowthLockState();
            return;
          }
          try {
            const h = await hashPassword(pw);
            if (h !== stored) {
              setGrowthUnlockError("Mot de passe incorrect.");
              return;
            }
            growthSectionUnlocked = true;
            applyGrowthLockState();
            renderGrowthSection();
            showToast("Section croissance déverrouillée.", "ok");
          } catch (_e) {
            setGrowthUnlockError("Erreur de vérification.");
          }
        });
      }

      function renderGrowthCharts(log) {
        if (typeof Chart === "undefined") return;
        const cW = document.getElementById("chart-growth-weight");
        const cS = document.getElementById("chart-growth-size");
        if (!cW || !cS) return;

        const sorted = [...log].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
        const labels = sorted.map((x) => formatChartLabel(x.date || ""));
        const wData = sorted.map((x) => (x.weightKg == null ? null : Number(x.weightKg)));
        const sData = sorted.map((x) => (x.sizeCm == null ? null : Number(x.sizeCm)));

        if (chartGrowthWeightInstance) {
          chartGrowthWeightInstance.destroy();
          chartGrowthWeightInstance = null;
        }
        if (chartGrowthSizeInstance) {
          chartGrowthSizeInstance.destroy();
          chartGrowthSizeInstance = null;
        }

        const lbl = labels.length ? labels : ["—"];
        const w = labels.length ? wData : [0];
        const s = labels.length ? sData : [0];

        chartGrowthWeightInstance = new Chart(cW.getContext("2d"), {
          type: "line",
          data: {
            labels: lbl,
            datasets: [{ label: "Poids (kg)", data: w, borderColor: "#0d6b62", tension: 0.2 }]
          },
          options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: false } } }
        });

        chartGrowthSizeInstance = new Chart(cS.getContext("2d"), {
          type: "line",
          data: {
            labels: lbl,
            datasets: [{ label: "Taille (cm)", data: s, borderColor: "#0a6fa0", tension: 0.2 }]
          },
          options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: false } } }
        });
      }

      function renderGrowthSection() {
        if (growthDateInput && !growthDateInput.value) {
          growthDateInput.value = todayISODate();
        }
        const tbody = document.getElementById("tbody-growth");
        const empty = document.getElementById("empty-growth");
        if (!tbody || !empty) return;
        const log = loadBabyGrowthLog();
        const sorted = [...log].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
        tbody.innerHTML = "";
        if (!sorted.length) {
          empty.hidden = false;
        } else {
          empty.hidden = true;
          sorted.forEach(function (x) {
            const tr = document.createElement("tr");
            tr.innerHTML =
              "<td>" + escapeHtml(formatDateLabel(x.date || "")) + "</td>" +
              "<td>" + (x.weightKg != null ? String(x.weightKg).replace(".", ",") + " kg" : "—") + "</td>" +
              "<td>" + (x.sizeCm != null ? String(x.sizeCm).replace(".", ",") + " cm" : "—") + "</td>";
            tbody.appendChild(tr);
          });
        }
        renderGrowthCharts(log);
      }

      document.getElementById("btn-growth-add").addEventListener("click", function () {
        const date = (growthDateInput && growthDateInput.value) || todayISODate();
        const w = growthWeightInput && growthWeightInput.value ? Number(growthWeightInput.value) : null;
        const s = growthSizeInput && growthSizeInput.value ? Number(growthSizeInput.value) : null;
        if (w == null && s == null) {
          showToast("Ajoutez au moins un poids ou une taille.", "error");
          return;
        }
        const log = loadBabyGrowthLog();
        log.push({ id: uid(), date: date, weightKg: w, sizeCm: s, createdAt: new Date().toISOString() });
        saveBabyGrowthLog(log);
        if (growthWeightInput) growthWeightInput.value = "";
        if (growthSizeInput) growthSizeInput.value = "";
        renderGrowthSection();
        showToast("Entrée croissance ajoutée.", "ok");
      });

      function loadNames() {
        try {
          const raw = localStorage.getItem(NAMES_KEY);
          if (!raw) return { biberon: "Éléonore", tirage: "Andéole" };
          const o = JSON.parse(raw);
          return {
            biberon: typeof o.biberon === "string" && o.biberon.trim() ? o.biberon.trim() : "Éléonore",
            tirage: typeof o.tirage === "string" && o.tirage.trim() ? o.tirage.trim() : "Andéole"
          };
        } catch {
          return { biberon: "Éléonore", tirage: "Andéole" };
        }
      }

      function saveNames(names) {
        localStorage.setItem(NAMES_KEY, JSON.stringify(names));
        scheduleCloudPush();
      }

      function applyNamesToInputs() {
        const n = loadNames();
        inputNameBiberon.value = n.biberon;
        inputNameTirage.value = n.tirage;
      }

      applyNamesToInputs();
      function persistNamesAndRefresh() {
        saveNames({ biberon: inputNameBiberon.value, tirage: inputNameTirage.value });
        renderHistory();
      }
      inputNameBiberon.addEventListener("input", persistNamesAndRefresh);
      inputNameTirage.addEventListener("input", persistNamesAndRefresh);

      addDate.value = todayISODate();
      addTime.value = nowTime();

      function getSelectedDayEntries() {
        const day = addDate.value || todayISODate();
        const entries = loadEntries();
        return entries.filter((e) => e.date === day);
      }

      function pulseTotalBox(kind) {
        const box = document.querySelector(".total-box." + kind);
        if (!box) return;
        box.classList.remove("total-box-pulse");
        void box.offsetWidth;
        box.classList.add("total-box-pulse");
        box.addEventListener(
          "animationend",
          function () {
            box.classList.remove("total-box-pulse");
          },
          { once: true }
        );
      }

      function renderTodayTable(highlightEntryId) {
        const day = addDate.value || todayISODate();
        badgeDate.textContent = formatDateLabel(day);
        if (highlightEntryId) {
          badgeDate.classList.remove("badge-pop");
          void badgeDate.offsetWidth;
          badgeDate.classList.add("badge-pop");
          badgeDate.addEventListener(
            "animationend",
            function () {
              badgeDate.classList.remove("badge-pop");
            },
            { once: true }
          );
        }

        const list = sortEntries(getSelectedDayEntries());
        tbodyAujourdhui.innerHTML = "";
        if (dayTimeline) dayTimeline.innerHTML = "";

        function minutesFromTimeStr(t) {
          const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || "").trim());
          if (!m) return null;
          const hh = Number(m[1]);
          const mm = Number(m[2]);
          if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
          if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
          return hh * 60 + mm;
        }

        function formatDeltaMinutes(mins) {
          if (mins == null) return "—";
          if (mins < 0) return "—";
          const h = Math.floor(mins / 60);
          const m = mins % 60;
          if (h <= 0) return m + " min";
          return h + " h " + String(m).padStart(2, "0");
        }

        let sumT = 0;
        let sumB = 0;
        let nbT = 0;
        let nbB = 0;
        let lastTime = "";
        let lastTMin = null;
        let prevTMin = null;
        let lastBMin = null;
        let prevBMin = null;

        const chrono = [...list].reverse();
        chrono.forEach((e) => {
          sumT += Number(e.tirage) || 0;
          sumB += Number(e.biberon) || 0;
          const tMl = Number(e.tirage) || 0;
          const bMl = Number(e.biberon) || 0;
          if (tMl > 0) nbT++;
          if (bMl > 0) nbB++;
          if (e.time) lastTime = e.time;

          const mins = minutesFromTimeStr(e.time);
          if (mins != null) {
            if (tMl > 0) {
              prevTMin = lastTMin;
              lastTMin = mins;
            }
            if (bMl > 0) {
              prevBMin = lastBMin;
              lastBMin = mins;
            }
          }

          if (dayTimeline && mins != null) {
            const wrap = document.createElement("div");
            wrap.className = "tl-item " + (tMl > 0 ? "tl--tirage" : "tl--biberon");
            const dot = document.createElement("span");
            dot.className = "tl-dot";
            const time = document.createElement("span");
            time.className = "tl-time";
            time.textContent = e.time || "—";
            const label = document.createElement("span");
            label.className = "tl-label";
            label.textContent = tMl > 0 ? "tirage" : "biberon";
            wrap.appendChild(dot);
            wrap.appendChild(time);
            wrap.appendChild(label);
            dayTimeline.appendChild(wrap);
          }
        });

        // Table : plus récent -> plus ancien (comme avant)
        list.forEach((e) => {
          const tr = document.createElement("tr");
          tr.dataset.entryId = e.id;
          if (highlightEntryId && e.id === highlightEntryId) {
            tr.classList.add("tr-row-flash");
          }
          tr.innerHTML =
            "<td>" + escapeHtml(e.time || "—") + "</td>" +
            '<td class="col-tirage">' + (e.tirage || 0) + " ml</td>" +
            '<td class="col-biberon">' + (e.biberon || 0) + " ml</td>" +
            "<td>" + escapeHtml(e.note || "") + "</td>" +
            '<td class="cell-actions">' +
            '<button type="button" class="ghost small" data-edit="' + e.id + '">Modifier</button> ' +
            '<button type="button" class="ghost small danger" data-del="' + e.id + '">Supprimer</button>' +
            "</td>";
          tbodyAujourdhui.appendChild(tr);
        });

        totalTirage.textContent = sumT + " ml";
        totalBiberon.textContent = sumB + " ml";
        if (bottleFill) {
          const GOAL_ML = 500;
          const VISUAL_MAX_ML = 700;
          const pct = Math.max(0, Math.min(100, Math.round((sumB / VISUAL_MAX_ML) * 100)));
          const goalPct = Math.max(0, Math.min(100, (GOAL_ML / VISUAL_MAX_ML) * 100));
          const shell = bottleFill.parentElement;
          shell.style.setProperty("--fill", pct + "%");
          shell.style.setProperty("--goal-line", goalPct + "%");
          const remaining = Math.max(0, GOAL_ML - sumB);
          const ratio = Math.round((Math.min(sumB, GOAL_ML) / GOAL_ML) * 100);
          if (bottleCaption) {
            bottleCaption.innerHTML = "Objectif <strong>500 ml</strong> · " +
              (remaining > 0
                ? "reste <strong>" + remaining + " ml</strong> (" + ratio + "%)"
                : "atteint <strong>" + ratio + "%</strong>");
          }
          shell.classList.toggle("bottle-reached", sumB >= GOAL_ML);
          if (highlightEntryId) {
            shell.classList.remove("bottle-animate");
            void shell.offsetWidth;
            shell.classList.add("bottle-animate");
            shell.addEventListener(
              "animationend",
              function () {
                shell.classList.remove("bottle-animate");
              },
              { once: true }
            );
          }
        }
        emptyAujourdhui.hidden = list.length > 0;

        const elNbT = document.getElementById("chip-val-nb-tirage");
        const elNbB = document.getElementById("chip-val-nb-biberon");
        const elLast = document.getElementById("chip-val-last");
        const elDeltaT = document.getElementById("chip-val-delta-tirage");
        const elDeltaB = document.getElementById("chip-val-delta-biberon");
        if (elNbT) elNbT.textContent = String(nbT);
        if (elNbB) elNbB.textContent = String(nbB);
        if (elLast) elLast.textContent = lastTime || "—";
        // list est triée du plus récent au plus ancien : lastXMin = plus récent, prevXMin = juste avant (plus ancien)
        if (elDeltaT) elDeltaT.textContent = formatDeltaMinutes(prevTMin == null || lastTMin == null ? null : lastTMin - prevTMin);
        if (elDeltaB) elDeltaB.textContent = formatDeltaMinutes(prevBMin == null || lastBMin == null ? null : lastBMin - prevBMin);
        if (highlightEntryId) {
          ["chip-nb-tirage", "chip-nb-biberon", "chip-delta-tirage", "chip-delta-biberon", "chip-last"].forEach(function (id) {
            const chip = document.getElementById(id);
            if (!chip) return;
            chip.classList.remove("chip-pop");
            void chip.offsetWidth;
            chip.classList.add("chip-pop");
            chip.addEventListener(
              "animationend",
              function () {
                chip.classList.remove("chip-pop");
              },
              { once: true }
            );
          });
        }

        tbodyAujourdhui.querySelectorAll("[data-edit]").forEach((btn) => {
          btn.addEventListener("click", () => openEdit(btn.getAttribute("data-edit")));
        });
        tbodyAujourdhui.querySelectorAll("[data-del]").forEach((btn) => {
          btn.addEventListener("click", () => confirmDelete(btn.getAttribute("data-del")));
        });

        if (highlightEntryId) {
          const flashRow = tbodyAujourdhui.querySelector("tr.tr-row-flash");
          if (flashRow) {
            flashRow.addEventListener(
              "animationend",
              function () {
                flashRow.classList.remove("tr-row-flash");
              },
              { once: true }
            );
          }
        }
      }

      function formatDateLabel(iso) {
        try {
          const [y, m, d] = iso.split("-").map(Number);
          const dt = new Date(y, m - 1, d);
          return dt.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
        } catch {
          return iso;
        }
      }

      function escapeHtml(s) {
        const div = document.createElement("div");
        div.textContent = s;
        return div.innerHTML;
      }

      /** Tri chronologique ancien -> récent */
      function sortEntriesChrono(entries) {
        return [...entries].sort((a, b) => {
          const da = a.date + "T" + (a.time || "00:00");
          const db = b.date + "T" + (b.time || "00:00");
          return da.localeCompare(db);
        });
      }

      /** JJ/MM HH:MM -> X ml */
      function formatHistoryBullet(isoDate, time, ml) {
        const parts = isoDate.split("-");
        const ddmm = parts.length === 3 ? parts[2] + "/" + parts[1] : isoDate;
        const hm = time && time.length ? time : "00:00";
        return ddmm + " " + hm + " -> " + ml + " ml";
      }

      function mondayOfWeek(isoDate) {
        const parts = isoDate.split("-").map(Number);
        const dt = new Date(parts[0], parts[1] - 1, parts[2]);
        const dow = dt.getDay();
        const diff = dow === 0 ? -6 : 1 - dow;
        dt.setDate(dt.getDate() + diff);
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, "0");
        const dd = String(dt.getDate()).padStart(2, "0");
        return y + "-" + m + "-" + dd;
      }

      function aggregateByDayForCharts(entries) {
        const byDay = {};
        entries.forEach(function (e) {
          if (!e.date) return;
          if (!byDay[e.date]) {
            byDay[e.date] = { tirageMl: 0, biberonMl: 0, nbTirage: 0, nbBiberon: 0 };
          }
          const t = Number(e.tirage) || 0;
          const b = Number(e.biberon) || 0;
          byDay[e.date].tirageMl += t;
          byDay[e.date].biberonMl += b;
          if (t > 0) byDay[e.date].nbTirage++;
          if (b > 0) byDay[e.date].nbBiberon++;
        });
        return byDay;
      }

      function aggregateByWeekForCharts(entries) {
        const byWeek = {};
        entries.forEach(function (e) {
          if (!e.date) return;
          const mon = mondayOfWeek(e.date);
          if (!byWeek[mon]) {
            byWeek[mon] = { tirageMl: 0, biberonMl: 0, nbTirage: 0, nbBiberon: 0 };
          }
          const t = Number(e.tirage) || 0;
          const b = Number(e.biberon) || 0;
          byWeek[mon].tirageMl += t;
          byWeek[mon].biberonMl += b;
          if (t > 0) byWeek[mon].nbTirage++;
          if (b > 0) byWeek[mon].nbBiberon++;
        });
        return byWeek;
      }

      function formatChartLabel(iso) {
        try {
          const parts = iso.split("-").map(Number);
          const dt = new Date(parts[0], parts[1] - 1, parts[2]);
          return dt.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
        } catch (_e) {
          return iso;
        }
      }

      function initVolumeShortcuts() {
        document.querySelectorAll(".volume-shortcuts[data-volume-for]").forEach(function (wrap) {
          if (wrap.getAttribute("data-volume-shortcuts-init") === "1") return;
          wrap.setAttribute("data-volume-shortcuts-init", "1");
          const fieldId = wrap.getAttribute("data-volume-for");
          const input = document.getElementById(fieldId);
          if (!input) return;
          for (var n = 10; n <= 150; n += 10) {
            (function (ml) {
              const btn = document.createElement("button");
              btn.type = "button";
              btn.className = "shortcut-ml";
              btn.textContent = String(ml);
              btn.setAttribute("aria-label", ml + " millilitres");
              btn.addEventListener("click", function () {
                input.value = String(ml);
                input.dispatchEvent(new Event("input", { bubbles: true }));
              });
              wrap.appendChild(btn);
            })(n);
          }
        });
      }

      function renderCharts() {
        if (typeof Chart === "undefined") return;
        const canvasMl = document.getElementById("chart-ml");
        const canvasPr = document.getElementById("chart-prises");
        if (!canvasMl || !canvasPr) return;

        const entries = loadEntries();
        const labels = [];
        const tirageMl = [];
        const biberonMl = [];
        const nbT = [];
        const nbB = [];

        if (chartMode === "day") {
          const byDay = aggregateByDayForCharts(entries);
          let dates = Object.keys(byDay).sort();
          if (dates.length > 60) dates = dates.slice(-60);
          dates.forEach(function (d) {
            labels.push(formatChartLabel(d));
            const x = byDay[d];
            tirageMl.push(x.tirageMl);
            biberonMl.push(x.biberonMl);
            nbT.push(x.nbTirage);
            nbB.push(x.nbBiberon);
          });
        } else {
          const byWeek = aggregateByWeekForCharts(entries);
          let mondays = Object.keys(byWeek).sort();
          if (mondays.length > 26) mondays = mondays.slice(-26);
          mondays.forEach(function (mon) {
            labels.push("Sem. " + formatChartLabel(mon));
            const x = byWeek[mon];
            tirageMl.push(x.tirageMl);
            biberonMl.push(x.biberonMl);
            nbT.push(x.nbTirage);
            nbB.push(x.nbBiberon);
          });
        }

        if (chartMlInstance) {
          chartMlInstance.destroy();
          chartMlInstance = null;
        }
        if (chartPrisesInstance) {
          chartPrisesInstance.destroy();
          chartPrisesInstance = null;
        }

        if (labels.length === 0) {
          labels.push("—");
          tirageMl.push(0);
          biberonMl.push(0);
          nbT.push(0);
          nbB.push(0);
        }

        const ctxMl = canvasMl.getContext("2d");
        chartMlInstance = new Chart(ctxMl, {
          type: "line",
          data: {
            labels: labels,
            datasets: [
              {
                label: "Tirage (ml)",
                data: tirageMl,
                borderColor: "#1db0a0",
                backgroundColor: "rgba(29, 176, 160, 0.2)",
                tension: 0.25,
                fill: false
              },
              {
                label: "Biberon (ml)",
                data: biberonMl,
                borderColor: "#1a9fd4",
                backgroundColor: "rgba(26, 159, 212, 0.2)",
                tension: 0.25,
                fill: false
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: { legend: { position: "bottom" } },
            scales: {
              y: {
                beginAtZero: true,
                title: { display: true, text: "ml" }
              }
            }
          }
        });

        const ctxPr = canvasPr.getContext("2d");
        chartPrisesInstance = new Chart(ctxPr, {
          type: "line",
          data: {
            labels: labels,
            datasets: [
              {
                label: "Nb tirages",
                data: nbT,
                borderColor: "#0d6b62",
                tension: 0.25
              },
              {
                label: "Nb biberons",
                data: nbB,
                borderColor: "#0a6fa0",
                tension: 0.25
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: { legend: { position: "bottom" } },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { stepSize: 1 },
                title: { display: true, text: "Prises" }
              }
            }
          }
        });
      }

      function renderDailyRecap() {
        const tbody = document.getElementById("tbody-recap-jour");
        const emptyEl = document.getElementById("empty-recap-jour");
        if (!tbody || !emptyEl) return;

        const entries = loadEntries();
        const byDay = {};
        entries.forEach(function (e) {
          if (!e.date) return;
          if (!byDay[e.date]) {
            byDay[e.date] = { tirageMl: 0, biberonMl: 0, nbTirage: 0, nbBiberon: 0 };
          }
          const t = Number(e.tirage) || 0;
          const b = Number(e.biberon) || 0;
          byDay[e.date].tirageMl += t;
          byDay[e.date].biberonMl += b;
          if (t > 0) byDay[e.date].nbTirage++;
          if (b > 0) byDay[e.date].nbBiberon++;
        });

        const dates = Object.keys(byDay).sort(function (a, b) {
          return b.localeCompare(a);
        });

        tbody.innerHTML = "";
        if (dates.length === 0) {
          emptyEl.hidden = false;
          renderCharts();
          return;
        }

        emptyEl.hidden = true;
        dates.forEach(function (d) {
          const tot = byDay[d];
          const tr = document.createElement("tr");
          tr.innerHTML =
            "<td>" + escapeHtml(formatDateLabel(d)) + "</td>" +
            '<td class="col-tirage recap-nb">' +
            tot.nbTirage +
            "</td>" +
            '<td class="col-tirage">' +
            tot.tirageMl +
            " ml</td>" +
            '<td class="col-biberon recap-nb">' +
            tot.nbBiberon +
            "</td>" +
            '<td class="col-biberon">' +
            tot.biberonMl +
            " ml</td>";
          tbody.appendChild(tr);
        });
        renderCharts();
      }

      function renderHistory() {
        const entries = sortEntriesChrono(loadEntries());
        historyContainer.innerHTML = "";

        if (entries.length === 0) {
          emptyHistorique.hidden = false;
          renderHistoryAudit();
          renderDailyRecap();
          return;
        }

        const hasAny = entries.some(function (e) {
          return (Number(e.tirage) || 0) > 0 || (Number(e.biberon) || 0) > 0;
        });
        emptyHistorique.hidden = hasAny;

        const names = loadNames();

        let nbBiberons = 0;
        let nbTirages = 0;
        entries.forEach(function (e) {
          if ((Number(e.biberon) || 0) > 0) nbBiberons++;
          if ((Number(e.tirage) || 0) > 0) nbTirages++;
        });

        const twoCol = document.createElement("div");
        twoCol.className = "history-two-col";

        const colBiberon = document.createElement("div");
        colBiberon.className = "history-column biberon-col";
        colBiberon.innerHTML =
          "<h3>Historique biberons</h3>" +
          "<p class=\"history-sub\">🍼 Historique biberons - " +
          escapeHtml(names.biberon) +
          "</p>" +
          "<p class=\"history-count\">Nombre de prises au biberon : <strong>" +
          nbBiberons +
          "</strong></p>";
        const ulB = document.createElement("ul");
        ulB.className = "history-list";

        const colTirage = document.createElement("div");
        colTirage.className = "history-column tirage-col";
        colTirage.innerHTML =
          "<h3>Historique tirages</h3>" +
          "<p class=\"history-sub\">🤱 Historique tirages - " +
          escapeHtml(names.tirage) +
          "</p>" +
          "<p class=\"history-count\">Nombre de tirages : <strong>" + nbTirages + "</strong></p>";
        const ulT = document.createElement("ul");
        ulT.className = "history-list";

        entries.forEach(function (e) {
          const bid = (Number(e.biberon) || 0) > 0;
          const tid = (Number(e.tirage) || 0) > 0;

          if (bid) {
            const li = document.createElement("li");
            const line = document.createElement("div");
            line.className = "history-line";
            const span = document.createElement("span");
            span.textContent = formatHistoryBullet(e.date, e.time, e.biberon);
            const act = document.createElement("div");
            act.className = "history-actions";
            act.innerHTML =
              '<button type="button" class="ghost small" data-edit="' +
              e.id +
              '">Modifier</button> ' +
              '<button type="button" class="ghost small danger" data-del="' +
              e.id +
              '">Supprimer</button>';
            line.appendChild(span);
            line.appendChild(act);
            li.appendChild(line);
            ulB.appendChild(li);
          }

          if (tid) {
            const li = document.createElement("li");
            const line = document.createElement("div");
            line.className = "history-line";
            const span = document.createElement("span");
            span.textContent = formatHistoryBullet(e.date, e.time, e.tirage);
            const act = document.createElement("div");
            act.className = "history-actions";
            act.innerHTML =
              '<button type="button" class="ghost small" data-edit="' +
              e.id +
              '">Modifier</button> ' +
              '<button type="button" class="ghost small danger" data-del="' +
              e.id +
              '">Supprimer</button>';
            line.appendChild(span);
            line.appendChild(act);
            li.appendChild(line);
            ulT.appendChild(li);
          }
        });

        if (ulB.children.length === 0) {
          const li = document.createElement("li");
          li.style.color = "var(--muted)";
          li.style.listStyle = "none";
          li.style.marginLeft = "-1rem";
          li.textContent = "Aucun biberon enregistré.";
          ulB.appendChild(li);
        }
        if (ulT.children.length === 0) {
          const li = document.createElement("li");
          li.style.color = "var(--muted)";
          li.style.listStyle = "none";
          li.style.marginLeft = "-1rem";
          li.textContent = "Aucun tirage enregistré.";
          ulT.appendChild(li);
        }

        colBiberon.appendChild(ulB);
        colTirage.appendChild(ulT);
        twoCol.appendChild(colBiberon);
        twoCol.appendChild(colTirage);
        historyContainer.appendChild(twoCol);

        historyContainer.querySelectorAll("[data-edit]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            openEdit(btn.getAttribute("data-edit"));
          });
        });
        historyContainer.querySelectorAll("[data-del]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            confirmDelete(btn.getAttribute("data-del"));
          });
        });

        renderHistoryAudit();
      }

      function renderHistoryAudit() {
        const log = loadHistoryLog();
        if (log.length === 0) return;

        const wrap = document.createElement("div");
        wrap.className = "card";
        wrap.style.marginTop = "1.35rem";
        wrap.innerHTML =
          '<h2>Journal des actions</h2><p class="lead mb-075">Créations, modifications et suppressions récentes.</p>';

        const ul = document.createElement("ul");
        ul.style.cssText = "margin:0;padding-left:1.1rem;font-size:0.88rem;color:var(--muted);max-height:220px;overflow-y:auto;";
        log.slice(0, 40).forEach((row) => {
          const li = document.createElement("li");
          li.style.marginBottom = "0.4rem";
          const t = new Date(row.at);
          const label = t.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
          let msg = "";
          if (row.action === "create") msg = "Ajout";
          else if (row.action === "update") msg = "Modification";
          else if (row.action === "delete") msg = "Suppression";
          else msg = row.action;
          const snap = row.entry;
          let detail = "";
          if (snap) {
            detail =
              " -> " +
              (snap.date || "") +
              " " +
              (snap.time || "") +
              " · tirage " +
              (snap.tirage || 0) +
              " ml · biberon " +
              (snap.biberon || 0) +
              " ml";
            if (row.action === "update" && snap._prevDate != null) {
              detail +=
                " (avant : " +
                snap._prevDate +
                " " +
                (snap._prevTime || "") +
                " · " +
                (snap._prevTirage || 0) +
                " / " +
                (snap._prevBiberon || 0) +
                " ml)";
            }
          }
          li.textContent = label + " · " + msg + detail;
          ul.appendChild(li);
        });
        wrap.appendChild(ul);
        historyContainer.appendChild(wrap);
      }

      document.getElementById("form-add").addEventListener("submit", function (ev) {
        ev.preventDefault();
        const tirage = parseInt(document.getElementById("add-tirage").value, 10) || 0;
        const biberon = parseInt(document.getElementById("add-biberon").value, 10) || 0;
        if (tirage === 0 && biberon === 0) {
          shakeFormCard();
          showToast("Indiquez au moins un volume (tirage ou biberon).", "error");
          return;
        }

        const entry = {
          id: uid(),
          date: document.getElementById("add-date").value,
          time: document.getElementById("add-time").value || "",
          tirage,
          biberon,
          note: (document.getElementById("add-note").value || "").trim(),
          createdAt: new Date().toISOString()
        };

        const entries = loadEntries();
        entries.push(entry);
        saveEntries(entries);
        pushHistory("create", { ...entry });
        hapticSuccess();
        showToast("Entrée enregistrée", "ok");
        const btnAdd = document.getElementById("btn-submit-add");
        if (btnAdd) {
          btnAdd.classList.remove("btn-just-used");
          void btnAdd.offsetWidth;
          btnAdd.classList.add("btn-just-used");
          btnAdd.addEventListener(
            "animationend",
            function () {
              btnAdd.classList.remove("btn-just-used");
            },
            { once: true }
          );
        }

        document.getElementById("add-tirage").value = "";
        document.getElementById("add-biberon").value = "";
        document.getElementById("add-note").value = "";
        addTime.value = nowTime();

        renderTodayTable(entry.id);
        if (tirage > 0) pulseTotalBox("tirage");
        if (biberon > 0) pulseTotalBox("biberon");
        renderHistory();
        renderDailyRecap();
      });

      document.getElementById("btn-reset-form").addEventListener("click", function () {
        addDate.value = todayISODate();
        addTime.value = nowTime();
        document.getElementById("add-tirage").value = "";
        document.getElementById("add-biberon").value = "";
        document.getElementById("add-note").value = "";
        renderTodayTable();
      });

      addDate.addEventListener("change", function () {
        renderTodayTable();
        renderBabyProfile(false);
      });

      const modalEdit = document.getElementById("modal-edit");
      const formEdit = document.getElementById("form-edit");

      function openEdit(id) {
        const entries = loadEntries();
        const e = entries.find((x) => x.id === id);
        if (!e) return;

        document.getElementById("edit-id").value = e.id;
        document.getElementById("edit-date").value = e.date;
        document.getElementById("edit-time").value = e.time || "";
        document.getElementById("edit-tirage").value = e.tirage;
        document.getElementById("edit-biberon").value = e.biberon;
        document.getElementById("edit-note").value = e.note || "";

        modalEdit.classList.add("open");
        modalEdit.setAttribute("aria-hidden", "false");
      }

      function closeEdit() {
        modalEdit.classList.remove("open");
        modalEdit.setAttribute("aria-hidden", "true");
      }

      document.getElementById("modal-edit-cancel").addEventListener("click", closeEdit);
      modalEdit.addEventListener("click", function (ev) {
        if (ev.target === modalEdit) closeEdit();
      });

      formEdit.addEventListener("submit", function (ev) {
        ev.preventDefault();
        const id = document.getElementById("edit-id").value;
        const tirage = parseInt(document.getElementById("edit-tirage").value, 10) || 0;
        const biberon = parseInt(document.getElementById("edit-biberon").value, 10) || 0;
        if (tirage === 0 && biberon === 0) {
          shakeModalEdit();
          showToast("Indiquez au moins un volume (tirage ou biberon).", "error");
          return;
        }

        const entries = loadEntries();
        const idx = entries.findIndex((x) => x.id === id);
        if (idx === -1) {
          closeEdit();
          return;
        }

        const before = { ...entries[idx] };
        entries[idx] = {
          ...entries[idx],
          date: document.getElementById("edit-date").value,
          time: document.getElementById("edit-time").value || "",
          tirage,
          biberon,
          note: (document.getElementById("edit-note").value || "").trim()
        };

        saveEntries(entries);
        pushHistory("update", {
          ...entries[idx],
          _prevDate: before.date,
          _prevTime: before.time,
          _prevTirage: before.tirage,
          _prevBiberon: before.biberon
        });
        hapticSuccess();
        showToast("Modifications enregistrées", "ok");

        closeEdit();
        renderTodayTable();
        renderHistory();
        renderDailyRecap();
      });

      const modalConfirm = document.getElementById("modal-confirm");
      let confirmCallback = null;

      function openConfirm(title, text, onYes) {
        document.getElementById("confirm-title").textContent = title;
        document.getElementById("confirm-text").textContent = text;
        confirmCallback = onYes;
        modalConfirm.classList.add("open");
        modalConfirm.setAttribute("aria-hidden", "false");
      }

      function closeConfirm() {
        modalConfirm.classList.remove("open");
        modalConfirm.setAttribute("aria-hidden", "true");
        confirmCallback = null;
      }

      document.getElementById("confirm-yes").addEventListener("click", function () {
        if (confirmCallback) confirmCallback();
        closeConfirm();
      });
      document.getElementById("confirm-no").addEventListener("click", closeConfirm);
      modalConfirm.addEventListener("click", function (ev) {
        if (ev.target === modalConfirm) closeConfirm();
      });

      function confirmDelete(id) {
        openConfirm(
          "Supprimer cette entrée ?",
          "Cette action est définitive pour la ligne du tableau. Un enregistrement reste dans le journal des actions.",
          function () {
            const entries = loadEntries();
            const e = entries.find((x) => x.id === id);
            const next = entries.filter((x) => x.id !== id);
            if (e) pushHistory("delete", { ...e });
            saveEntries(next);
            renderTodayTable();
            renderHistory();
            renderDailyRecap();
          }
        );
      }

      document.getElementById("btn-load-demo").addEventListener("click", function () {
        openConfirm(
          "Charger la démo maquette ?",
          "Vos entrées actuelles seront remplacées par l'exemple (23-25 mars, biberons + tirages comme sur l'image).",
          loadDemoReplace
        );
      });

      document.getElementById("btn-clear-all").addEventListener("click", function () {
        openConfirm(
          "Tout effacer ?",
          "Toutes les entrées et le journal seront supprimés de ce navigateur.",
          function () {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(HISTORY_KEY);
            localStorage.removeItem(BABY_PROFILE_KEY);
            localStorage.removeItem(BABY_GROWTH_LOG_KEY);
            localStorage.removeItem(REMINDER_SETTINGS_KEY);
            localStorage.removeItem(REMINDER_HISTORY_KEY);
            renderTodayTable();
            renderHistory();
            renderDailyRecap();
            renderBabyProfile(true);
            renderGrowthSection();
            renderReminderHistory();
            syncReminderUI();
            scheduleTirageReminders();
          }
        );
      });

      document.querySelectorAll(".tab").forEach((tab) => {
        tab.addEventListener("click", function () {
          const id = tab.id.replace("tab-", "");
          document.querySelectorAll(".tab").forEach((t) => {
            t.setAttribute("aria-selected", t === tab ? "true" : "false");
          });
          document.querySelectorAll(".panel").forEach((p) => {
            const active = p.id === "panel-" + id;
            p.classList.toggle("active", active);
            p.hidden = !active;
          });
          if (id === "historique") renderHistory();
          if (id === "croissance") renderBabyProfile(false);
          if (id === "croissance") {
            applyGrowthLockState();
            if (growthSectionUnlocked) renderGrowthSection();
          }
          if (id === "recap-jour") renderDailyRecap();
          if (id === "graphiques") renderCharts();
          if (id === "rappel") {
            renderReminderFixedTimes();
            renderReminderHistory();
            syncReminderUI();
            maybePromptNotificationOnMobile();
            scheduleTirageReminders();
          }
          if (id === "sync") {
            populateSyncUI();
            initFirebaseSync();
          }
        });
      });

      document.getElementById("chart-mode-day").addEventListener("click", function () {
        chartMode = "day";
        document.getElementById("chart-mode-day").setAttribute("aria-pressed", "true");
        document.getElementById("chart-mode-week").setAttribute("aria-pressed", "false");
        renderCharts();
      });
      document.getElementById("chart-mode-week").addEventListener("click", function () {
        chartMode = "week";
        document.getElementById("chart-mode-day").setAttribute("aria-pressed", "false");
        document.getElementById("chart-mode-week").setAttribute("aria-pressed", "true");
        renderCharts();
      });

      document.getElementById("btn-sync-apply").addEventListener("click", function () {
        const raw = document.getElementById("sync-room-code").value;
        const room = sanitizeRoomCode(raw);
        if (document.getElementById("sync-room-code")) {
          document.getElementById("sync-room-code").value = room;
        }
        const enabled = document.getElementById("sync-enabled").checked;
        if (enabled && room.length < 4) {
          alert("Code salon : au moins 4 caractères (lettres, chiffres, tirets bas ou tirets).");
          return;
        }
        localStorage.setItem(SYNC_ROOM_KEY, room);
        localStorage.setItem(SYNC_ENABLED_KEY, enabled ? "1" : "0");
        initFirebaseSync();
      });

      [reminderEnabledInput, reminderIntervalInput, reminderMinuteInput].forEach(function (el) {
        if (!el) return;
        el.addEventListener("change", persistReminderSettingsFromUI);
        // Sur mobile, certains contrôles réagissent mieux à "input".
        el.addEventListener("input", persistReminderSettingsFromUI);
      });

      if (reminderEnabledInput) {
        reminderEnabledInput.addEventListener("click", persistReminderSettingsFromUI);
      }

      const btnReminderPermission = document.getElementById("btn-reminder-permission");
      if (btnReminderPermission) {
        btnReminderPermission.addEventListener("click", function () {
          if (typeof Notification !== "undefined" && Notification.permission === "denied") {
            showToast("Notifications bloquées : Chrome > cadenas > Notifications > Autoriser.", "error");
            updateReminderPermissionUI();
            return;
          }
          requestReminderPermission().finally(function () {
            updateReminderPermissionUI();
          });
        });
      }
      const btnReminderTestNow = document.getElementById("btn-reminder-test-now");
      if (btnReminderTestNow) {
        btnReminderTestNow.addEventListener("click", function () {
          showMobileNotification("Test rappel tirage", "Notification de test immédiate.");
          playReminderRingtone();
          showToast("Test notification lancé.", "ok");
          addReminderHistory("test", "Notification de test immédiate.");
        });
      }
      const btnReminderTestSchedule = document.getElementById("btn-reminder-test-schedule");
      if (btnReminderTestSchedule) {
        btnReminderTestSchedule.addEventListener("click", function () {
          scheduleReminderTest(reminderTestTimeInput ? reminderTestTimeInput.value : "");
        });
      }
      const btnReminderApplyFixed = document.getElementById("btn-reminder-apply-fixed");
      if (btnReminderApplyFixed) {
        btnReminderApplyFixed.addEventListener("click", function () {
          if (reminderIntervalInput) reminderIntervalInput.value = "3";
          if (reminderMinuteInput) reminderMinuteInput.value = "0";
          persistReminderSettingsFromUI();
          addReminderHistory("info", "Horaires fixes 00/03/06/09/12/15/18/21 appliqués.");
          showToast("Horaires fixes appliqués.", "ok");
        });
      }
      const btnReminderHistoryClear = document.getElementById("btn-reminder-history-clear");
      if (btnReminderHistoryClear) {
        btnReminderHistoryClear.addEventListener("click", function () {
          saveReminderHistory([]);
          renderReminderHistory();
          setReminderStatus("Historique des rappels vidé.");
        });
      }

      document.getElementById("btn-export-json").addEventListener("click", function () {
        const bundle = {
          version: 1,
          exportedAt: new Date().toISOString(),
          entries: loadEntries(),
          names: loadNames(),
          babyProfile: loadBabyProfile(),
          babyGrowthLog: loadBabyGrowthLog(),
          reminderSettings: loadReminderSettings(),
          reminderHistory: loadReminderHistory(),
          historyLog: loadHistoryLog()
        };
        const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "poupette-export-" + todayISODate() + ".json";
        a.click();
        URL.revokeObjectURL(a.href);
      });

      document.getElementById("btn-import-json").addEventListener("click", function () {
        document.getElementById("import-json-file").click();
      });

      document.getElementById("import-json-file").addEventListener("change", function (ev) {
        const f = ev.target.files && ev.target.files[0];
        ev.target.value = "";
        if (!f) return;
        const reader = new FileReader();
        reader.onload = function () {
          try {
            const bundle = JSON.parse(reader.result);
            applyImportedBundle(bundle);
          } catch (e) {
            alert("Fichier JSON illisible : " + e.message);
          }
        };
        reader.readAsText(f);
      });

      const lockScreen = document.getElementById("lock-screen");
      const appRoot = document.getElementById("app-root");
      const formLockSetup = document.getElementById("form-lock-setup");
      const formLockLogin = document.getElementById("form-lock-login");
      const lockError = document.getElementById("lock-error");
      const lockForgotWrap = document.getElementById("lock-forgot-wrap");

      function setLockError(msg) {
        if (!msg) {
          lockError.hidden = true;
          lockError.textContent = "";
        } else {
          lockError.textContent = msg;
          lockError.hidden = false;
        }
      }

      function isUnlocked() {
        if (!localStorage.getItem(PWD_HASH_KEY)) return false;
        return (
          sessionStorage.getItem(SESSION_KEY) === "1" ||
          localStorage.getItem(PERSISTENT_UNLOCK_KEY) === "1"
        );
      }

      function markUnlocked(rememberDevice) {
        sessionStorage.setItem(SESSION_KEY, "1");
        if (rememberDevice) {
          localStorage.setItem(PERSISTENT_UNLOCK_KEY, "1");
        } else {
          localStorage.removeItem(PERSISTENT_UNLOCK_KEY);
        }
      }

      function clearAllUnlockTokens() {
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(PERSISTENT_UNLOCK_KEY);
      }

      function configureLockUI() {
        const hasPwd = !!localStorage.getItem(PWD_HASH_KEY);
        formLockSetup.hidden = hasPwd;
        formLockLogin.hidden = !hasPwd;
        lockForgotWrap.hidden = !hasPwd;
        setLockError("");
        if (hasPwd) {
          document.getElementById("lock-password").value = "";
          document.getElementById("lock-remember-login").checked =
            localStorage.getItem(PERSISTENT_UNLOCK_KEY) === "1";
          document.getElementById("lock-password").focus();
        } else {
          document.getElementById("lock-setup-pw").value = "";
          document.getElementById("lock-setup-pw2").value = "";
          document.getElementById("lock-remember-setup").checked = false;
          document.getElementById("lock-setup-pw").focus();
        }
      }

      function unlockApp() {
        lockScreen.hidden = true;
        appRoot.hidden = false;
      }

      function lockApp() {
        clearReminderTimers();
        clearAllUnlockTokens();
        appRoot.hidden = true;
        lockScreen.hidden = false;
        configureLockUI();
      }

      function runAfterUnlock() {
        ensureDemoDataIfEmpty();
        ensureDefaultGrowthWeights();
        growthSectionUnlocked = false;
        applyGrowthLockState();
        ensureServiceWorkerReady();
        renderReminderFixedTimes();
        renderReminderHistory();
        initVolumeShortcuts();
        renderBabyProfile(true);
        renderGrowthSection();
        renderTodayTable();
        renderHistory();
        renderDailyRecap();
        populateSyncUI();
        syncReminderUI();
        maybePromptNotificationOnMobile();
        scheduleTirageReminders();
        initFirebaseSync();
        const localHash = localStorage.getItem(PWD_HASH_KEY);
        if (localHash) pushPasswordHashToCloud(localHash);
      }

      function applyImportedBundle(bundle) {
        if (!bundle || !Array.isArray(bundle.entries)) {
          alert("Fichier invalide : un tableau « entries » est attendu.");
          return;
        }
        applyingRemote = true;
        try {
          saveEntries(bundle.entries);
          if (bundle.names && typeof bundle.names === "object") {
            saveNames(bundle.names);
          }
          if (bundle.babyProfile && typeof bundle.babyProfile === "object") {
            saveBabyProfile(bundle.babyProfile);
          }
          if (bundle.babyGrowthLog && Array.isArray(bundle.babyGrowthLog)) {
            saveBabyGrowthLog(bundle.babyGrowthLog);
          }
          if (bundle.reminderSettings && typeof bundle.reminderSettings === "object") {
            saveReminderSettings(bundle.reminderSettings);
          }
          if (bundle.reminderHistory && Array.isArray(bundle.reminderHistory)) {
            saveReminderHistory(bundle.reminderHistory);
          }
          applyNamesToInputs();
          renderBabyProfile(true);
          renderGrowthSection();
          renderReminderHistory();
          syncReminderUI();
          scheduleTirageReminders();
          if (bundle.historyLog && Array.isArray(bundle.historyLog)) {
            saveHistoryLog(bundle.historyLog);
          }
          renderTodayTable();
          renderHistory();
          renderDailyRecap();
          initFirebaseSync();
        } finally {
          applyingRemote = false;
        }
        alert("Import terminé.");
      }

      formLockSetup.addEventListener("submit", async function (ev) {
        ev.preventDefault();
        setLockError("");
        const a = document.getElementById("lock-setup-pw").value;
        const b = document.getElementById("lock-setup-pw2").value;
        if (a.length < 4) {
          setLockError("Utilisez au moins 4 caractères.");
          return;
        }
        if (a !== b) {
          setLockError("Les deux mots de passe ne correspondent pas.");
          return;
        }
        try {
          const h = await hashPassword(a);
          localStorage.setItem(PWD_HASH_KEY, h);
          pushPasswordHashToCloud(h);
          markUnlocked(document.getElementById("lock-remember-setup").checked);
          unlockApp();
          runAfterUnlock();
        } catch (err) {
          setLockError(
            "Impossible de sécuriser le mot de passe (navigateur trop ancien ou contexte non sécurisé)."
          );
        }
      });

      formLockLogin.addEventListener("submit", async function (ev) {
        ev.preventDefault();
        setLockError("");
        const pw = document.getElementById("lock-password").value;
        let stored = localStorage.getItem(PWD_HASH_KEY);
        if (!stored) {
          stored = await ensurePasswordHashLoadedFromCloud();
        }
        if (!stored) {
          formLockLogin.hidden = true;
          formLockSetup.hidden = false;
          lockForgotWrap.hidden = true;
          setLockError("Aucun mot de passe trouvé. Créez-en un nouveau ci-dessous.");
          document.getElementById("lock-setup-pw").focus();
          return;
        }
        try {
          const h = await hashPassword(pw);
          if (h === stored) {
            markUnlocked(document.getElementById("lock-remember-login").checked);
            unlockApp();
            runAfterUnlock();
          } else {
            setLockError("Mot de passe incorrect.");
          }
        } catch (err) {
          setLockError("Erreur de vérification.");
        }
      });

      document.getElementById("btn-forgot-pwd").addEventListener("click", function () {
        openConfirm(
          "Réinitialiser tout ?",
          "Toutes les données (suivi, prénoms, journal) et le mot de passe seront effacés de ce navigateur. Irréversible.",
          function () {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(HISTORY_KEY);
            localStorage.removeItem(NAMES_KEY);
            localStorage.removeItem(BABY_PROFILE_KEY);
            localStorage.removeItem(BABY_GROWTH_LOG_KEY);
            localStorage.removeItem(REMINDER_SETTINGS_KEY);
            localStorage.removeItem(REMINDER_HISTORY_KEY);
            localStorage.removeItem(PWD_HASH_KEY);
            clearCloudPasswordHash();
            clearAllUnlockTokens();
            setLockError("");
            formLockLogin.hidden = true;
            formLockSetup.hidden = false;
            lockForgotWrap.hidden = true;
            document.getElementById("lock-setup-pw").value = "";
            document.getElementById("lock-setup-pw2").value = "";
            document.getElementById("lock-setup-pw").focus();
          }
        );
      });

      document.getElementById("btn-lock-session").addEventListener("click", function () {
        lockApp();
      });

      const modalChangePwd = document.getElementById("modal-change-pwd");
      const changePwdErr = document.getElementById("change-pwd-error");

      function openChangePwdModal() {
        document.getElementById("change-pwd-old").value = "";
        document.getElementById("change-pwd-new").value = "";
        document.getElementById("change-pwd-new2").value = "";
        changePwdErr.hidden = true;
        changePwdErr.textContent = "";
        modalChangePwd.classList.add("open");
        modalChangePwd.setAttribute("aria-hidden", "false");
        document.getElementById("change-pwd-old").focus();
      }

      function closeChangePwdModal() {
        modalChangePwd.classList.remove("open");
        modalChangePwd.setAttribute("aria-hidden", "true");
      }

      document.getElementById("btn-change-password").addEventListener("click", openChangePwdModal);
      document.getElementById("modal-change-pwd-cancel").addEventListener("click", closeChangePwdModal);
      modalChangePwd.addEventListener("click", function (ev) {
        if (ev.target === modalChangePwd) closeChangePwdModal();
      });

      document.getElementById("form-change-pwd").addEventListener("submit", async function (ev) {
        ev.preventDefault();
        changePwdErr.hidden = true;
        const oldPw = document.getElementById("change-pwd-old").value;
        const newPw = document.getElementById("change-pwd-new").value;
        const new2 = document.getElementById("change-pwd-new2").value;
        let stored = localStorage.getItem(PWD_HASH_KEY);
        if (!stored) stored = await ensurePasswordHashLoadedFromCloud();
        if (newPw.length < 4) {
          changePwdErr.textContent = "Le nouveau mot de passe doit faire au moins 4 caractères.";
          changePwdErr.hidden = false;
          return;
        }
        if (newPw !== new2) {
          changePwdErr.textContent = "La confirmation ne correspond pas.";
          changePwdErr.hidden = false;
          return;
        }
        try {
          const hOld = await hashPassword(oldPw);
          if (hOld !== stored) {
            changePwdErr.textContent = "Mot de passe actuel incorrect.";
            changePwdErr.hidden = false;
            return;
          }
          const hNew = await hashPassword(newPw);
          localStorage.setItem(PWD_HASH_KEY, hNew);
          pushPasswordHashToCloud(hNew);
          closeChangePwdModal();
        } catch (err) {
          changePwdErr.textContent = "Erreur. Réessayez.";
          changePwdErr.hidden = false;
        }
      });

      ensurePasswordHashLoadedFromCloud()
        .catch(function () {})
        .finally(function () {
          if (isUnlocked()) {
            unlockApp();
            runAfterUnlock();
          } else {
            if (sessionStorage.getItem(SESSION_KEY) === "1") {
              sessionStorage.removeItem(SESSION_KEY);
            }
            appRoot.hidden = true;
            lockScreen.hidden = false;
            configureLockUI();
          }
        });
    })();
