<?php
declare(strict_types=1);
require_once __DIR__ . '/auth.php';
requirePageAuth();
if (authMustChangePassword()) {
  header('Location: change_password.php');
  exit;
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Statistique 2026 - Aujourd'hui</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Manrope:wght@600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css" integrity="sha512-Evv84Mr4kqVGRNSgIGL/F/aIDqQb7xQ2vcrdIwxfjThSH8CSR7PBEakCr51Ck+w+/U6swU2Im1vVX0SVk9ABhg==" crossorigin="anonymous" referrerpolicy="no-referrer">
  <link rel="icon" type="image/x-icon" href="assets/img/biberon.ico">
  <link rel="stylesheet" href="assets/css/style.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <?php $currentYear = date('Y'); ?>
  <header class="topbar">
    <div class="topbar-head">
      <button id="menuToggle" class="menu-toggle" type="button" aria-label="Ouvrir le menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
      <div>
        <h1 id="projectTitle">Statistique 2026 - Aujourd'hui</h1>
        <p id="projectSubtitle">Historique, statistiques et suivi intelligent bébé.</p>
      </div>
      <a href="logout.php" class="btn-secondary" style="margin-left:auto;">Déconnexion</a>
    </div>
  </header>

  <nav class="navbar">
    <button class="tab-btn active" data-tab="today"><i class="fa-solid fa-calendar-day"></i><span>Aujourd'hui</span></button>
    <button class="tab-btn" data-tab="history"><i class="fa-solid fa-clock-rotate-left"></i><span>Historique</span></button>
    <button class="tab-btn" data-tab="totals"><i class="fa-solid fa-table-list"></i><span>Totaux par jour</span></button>
    <button class="tab-btn" data-tab="chart"><i class="fa-solid fa-chart-line"></i><span>Graphique</span></button>
    <button class="tab-btn" data-tab="stocks"><i class="fa-solid fa-snowflake"></i><span>Stocks</span></button>
    <button class="tab-btn" data-tab="settings"><i class="fa-solid fa-sliders"></i><span>Paramètres</span></button>
  </nav>
  <div id="navBackdrop" class="nav-backdrop"></div>

  <main class="container">
    <section id="today" class="tab-content active">
      <div class="card day-nav-card">
        <div class="day-nav">
          <button type="button" id="dayPrevBtn" class="btn-secondary day-nav-btn">← Hier</button>
          <button type="button" id="dayTodayBtn" class="btn-secondary day-nav-btn active">Aujourd'hui</button>
          <button type="button" id="dayNextBtn" class="btn-secondary day-nav-btn">Demain →</button>
        </div>
        <p id="dayNavLabel" class="day-nav-label"></p>
      </div>

      <div class="hero card">
        <div>
          <p class="hero-badge">Dashboard 2026</p>
          <h2>Suivi intelligent de la journée</h2>
          <p class="hero-subtitle">Visualise instantanément les prises de biberon, les tirages et les tendances du jour.</p>
        </div>
        <div class="hero-stats">
          <div class="stat-chip">
            <span>Entrées</span>
            <strong id="statEntriesCount">0</strong>
          </div>
          <div class="stat-chip">
            <span>Entrées tirage 👩‍🍼</span>
            <strong id="statMilkEntriesCount">0</strong>
          </div>
          <div class="stat-chip">
            <span>Entrées biberon 🧴</span>
            <strong id="statBottleEntriesCount">0</strong>
          </div>
          <div class="stat-chip">
            <span>Tire-lait 👩‍🍼</span>
            <strong id="statMilkTotal">0 ml</strong>
          </div>
          <div class="stat-chip">
            <span>Biberon 🧴</span>
            <strong id="statBottleTotal">0 ml</strong>
          </div>
          <div class="stat-chip">
            <span>Total</span>
            <strong id="statGlobalTotal">0 ml</strong>
          </div>
          <div class="stat-chip stat-chip-wide">
            <span>Progression tire-lait du jour 👩‍🍼</span>
            <strong id="statProgressText">0%</strong>
            <div class="progress-track" aria-hidden="true">
              <div id="statProgressBar" class="progress-fill"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="section-intro">
        <h2>Nouvelle entrée</h2>
        <p>Renseigne rapidement une prise, puis vérifie le récapitulatif juste en dessous.</p>
      </div>
      <form id="entryForm" class="card">
        <div class="grid-2">
          <label>Date
            <input type="date" id="entryDate" required>
          </label>
          <label>Heure
            <input type="time" id="entryTime" required>
          </label>
        </div>

        <div class="grid-2">
          <div class="block mint">
            <h3>Tirage 👩‍🍼</h3>
            <label>Millilitres tirés
              <input type="number" id="milkPumpedMl" min="0" step="10" value="0" required>
            </label>
            <label class="toggle inline-toggle">
              <input type="checkbox" id="breastfedFlag">
              Tétée associée
            </label>
          </div>
          <div class="block sky">
            <h3>Biberon 🧴</h3>
            <label>Millilitres au biberon
              <input type="number" id="bottleMl" min="0" step="10" value="0" required>
            </label>
            <div class="quick-values" data-target="bottleMl">
              <button type="button" class="quick-value-btn" data-value="80">80ml</button>
              <button type="button" class="quick-value-btn" data-value="100">100ml</button>
              <button type="button" class="quick-value-btn" data-value="110">110ml</button>
            </div>
            <label class="toggle inline-toggle">
              <input type="checkbox" id="breastfedFlagBottle">
              Tétée associée
            </label>
          </div>
        </div>

        <label>Note (facultatif)
          <input type="text" id="entryNote" placeholder="Ex: côté gauche, après la sieste...">
        </label>

        <div class="actions">
          <button type="submit" class="btn-primary">Ajouter au tableau</button>
          <button type="reset" class="btn-secondary">Réinitialiser</button>
        </div>
      </form>

      <div class="card">
        <h3>Entrées du jour</h3>
        <div id="todayList" class="list"></div>
      </div>
    </section>

    <section id="history" class="tab-content">
      <h2>Historique</h2>
      <div class="card history-toolbar">
        <label>Recherche
          <input type="text" id="historySearch" placeholder="Ex: tétée, 90, 31 mars...">
        </label>
        <label>Tri par
          <select id="historySortBy">
            <option value="dateTime">Date et heure</option>
            <option value="milkPumpedMl">Tire-lait (ml)</option>
            <option value="bottleMl">Biberon (ml)</option>
          </select>
        </label>
        <label>Ordre
          <select id="historySortOrder">
            <option value="desc">Décroissant</option>
            <option value="asc">Croissant</option>
          </select>
        </label>
      </div>
      <div class="card history-quick-filters">
        <button type="button" class="history-chip" data-filter-group="type" data-filter-value="bottle">🍼 Biberon</button>
        <button type="button" class="history-chip" data-filter-group="type" data-filter-value="milk">👩‍🍼 Tirage</button>
        <button type="button" class="history-chip" data-filter-group="period" data-filter-value="1">📅 Aujourd'hui</button>
        <button type="button" class="history-chip" data-filter-group="period" data-filter-value="7">📅 7 jours</button>
        <button type="button" class="history-chip" data-filter-group="period" data-filter-value="30">📅 30 jours</button>
        <button type="button" class="history-chip" data-filter-group="volume" data-filter-value="gt100">🔢 &gt;100ml</button>
        <button type="button" class="history-chip" data-filter-group="volume" data-filter-value="lt100">🔢 &lt;100ml</button>
      </div>
      <div class="grid-2 history-split">
        <div class="card table-wrap">
          <h3>Historique Biberon</h3>
          <table id="historyBottleTable">
            <thead>
              <tr>
                <th>Date</th>
                <th>Heure</th>
                <th>Biberon (ml)</th>
                <th>Note</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="card table-wrap">
          <h3>Historique Tirage</h3>
          <table id="historyMilkTable">
            <thead>
              <tr>
                <th>Date</th>
                <th>Heure</th>
                <th>Tire-lait (ml)</th>
                <th>Note</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    </section>

    <section id="totals" class="tab-content">
      <h2>Totaux par jour</h2>
      <div class="card totals-toolbar">
        <label>Tri par
          <select id="totalsSortBy">
            <option value="dateIso">Date</option>
            <option value="countMilkEntries">Nb tirages</option>
            <option value="totalMilkPumped">Total tire-lait</option>
            <option value="countBottleEntries">Nb biberons</option>
            <option value="totalBottle">Total biberon</option>
          </select>
        </label>
        <label>Ordre
          <select id="totalsSortOrder">
            <option value="desc">Décroissant</option>
            <option value="asc">Croissant</option>
          </select>
        </label>
        <label>Période
          <select id="totalsPeriod">
            <option value="all">Toutes les dates</option>
            <option value="30">30 derniers jours</option>
            <option value="7">7 derniers jours</option>
          </select>
        </label>
      </div>
      <div class="card table-wrap">
        <table id="totalsTable">
          <thead>
            <tr>
              <th>Date</th>
              <th>Nb tirages</th>
              <th>Total tire-lait (ml)</th>
              <th>Nb biberons</th>
              <th>Total biberon (ml)</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </section>

    <section id="chart" class="tab-content">
      <h2>Graphique</h2>
      <div class="card">
        <canvas id="dailyChart" height="100"></canvas>
      </div>
    </section>

    <section id="stocks" class="tab-content">
      <h2>Stocks lait congelé / avancé</h2>
      <div class="card stock-kpis">
        <div class="stat-chip">
          <span>Stock congelé total</span>
          <strong id="stockFrozenMl">0 ml</strong>
        </div>
        <div class="stat-chip">
          <span>Sorties FIFO (congelé)</span>
          <strong id="stockFifoOutMl">0 ml</strong>
        </div>
      </div>

      <form id="stockForm" class="card">
        <div class="grid-2">
          <label>Date
            <input type="date" id="stockDate" required>
          </label>
          <label>Heure
            <input type="time" id="stockTime" required>
          </label>
        </div>
        <div class="grid-2">
          <label>Date du tirage
            <input type="date" id="stockPumpDate" required>
          </label>
          <label>Péremption estimée
            <input type="date" id="stockExpiryDate" required>
          </label>
        </div>
        <label>Type de mouvement
          <select id="stockDirection">
            <option value="in">Entrée (+)</option>
            <option value="out">Sortie (-)</option>
          </select>
        </label>
        <label>Volume (ml)
          <input type="number" id="stockAmountMl" min="0" step="10" value="0" required>
        </label>
        <label>Note (facultatif)
          <input type="text" id="stockNote" placeholder="Ex: sachet 120ml, décongelé pour biberon...">
        </label>
        <div class="actions">
          <button type="submit" class="btn-primary">Ajouter mouvement</button>
        </div>
        <p id="stockFifoHint" class="status"></p>
      </form>

      <div class="card table-wrap">
        <table id="stocksTable">
          <thead>
            <tr>
              <th>Date</th>
              <th>Heure</th>
              <th>Date tirage</th>
              <th>Péremption</th>
              <th>Mouvement</th>
              <th>Volume (ml)</th>
              <th>FIFO</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </section>

    <section id="settings" class="tab-content">
      <h2>Paramètres Firebase</h2>
      <form id="settingsForm" class="card">
        <label>Code salon (famille)
          <input type="text" id="roomCode" placeholder="famille2026" required>
        </label>
        <label>Database URL (Firebase Realtime Database)
          <input type="url" id="databaseUrl" placeholder="https://xxx-default-rtdb.europe-west1.firebasedatabase.app" required>
        </label>
        <label>Chemin des données (optionnel)
          <input type="text" id="entriesPath" placeholder="rooms/{roomCode}/entries">
        </label>
        <label class="toggle">
          <input type="checkbox" id="syncEnabled">
          Activer la synchro cloud
        </label>
        <button type="submit" class="btn-primary">Enregistrer et connecter</button>
      </form>
      <p id="syncStatus" class="status"></p>
    </section>
  </main>

  <footer class="footer">
    Créé avec ❤️ Par Benjamin <?php echo htmlspecialchars($currentYear, ENT_QUOTES, 'UTF-8'); ?>
  </footer>

  <div id="toast" class="toast"></div>

  <script src="assets/js/app.js"></script>
</body>
</html>
