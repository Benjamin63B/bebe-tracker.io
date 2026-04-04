<?php
declare(strict_types=1);

if (!isset($pageKey)) {
    $pageKey = 'today';
}
$includeChartJs = $includeChartJs ?? false;

$pageMeta = [
    'today' => [
        'docTitle' => "Statistique 2026 - Aujourd'hui",
        'headerTitle' => "Statistique 2026 - Aujourd'hui",
        'subtitle' => "Vue du jour, saisie rapide et progression.",
    ],
    'history' => [
        'docTitle' => 'Statistique 2026 - Historique',
        'headerTitle' => 'Statistique 2026 - Historique',
        'subtitle' => 'Retrouve et filtre les événements passés.',
    ],
    'totals' => [
        'docTitle' => 'Statistique 2026 - Totaux par jour',
        'headerTitle' => 'Statistique 2026 - Totaux par jour',
        'subtitle' => 'Synthèse quotidienne des volumes et fréquences.',
    ],
    'chart' => [
        'docTitle' => 'Statistique 2026 - Graphique',
        'headerTitle' => 'Statistique 2026 - Graphique',
        'subtitle' => 'Tendances visuelles sur plusieurs jours.',
    ],
    'stocks' => [
        'docTitle' => 'Statistique 2026 - Stocks',
        'headerTitle' => 'Statistique 2026 - Stocks',
        'subtitle' => 'Gestion du stock congelé avec FIFO.',
    ],
    'stock_history' => [
        'docTitle' => 'Statistique 2026 - Historique de stocks',
        'headerTitle' => 'Statistique 2026 - Historique de stocks',
        'subtitle' => 'Liste des mouvements triée par date.',
    ],
    'settings' => [
        'docTitle' => 'Statistique 2026 - Paramètres',
        'headerTitle' => 'Statistique 2026 - Paramètres',
        'subtitle' => 'Configuration Firebase et synchronisation.',
    ],
];

$m = $pageMeta[$pageKey] ?? $pageMeta['today'];
$currentYear = date('Y');
$docTitle = $m['docTitle'];
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?= htmlspecialchars($docTitle, ENT_QUOTES, 'UTF-8'); ?></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Manrope:wght@600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css" integrity="sha512-Evv84Mr4kqVGRNSgIGL/F/aIDqQb7xQ2vcrdIwxfjThSH8CSR7PBEakCr51Ck+w+/U6swU2Im1vVX0SVk9ABhg==" crossorigin="anonymous" referrerpolicy="no-referrer">
  <link rel="icon" type="image/x-icon" href="assets/img/biberon.ico">
  <link rel="stylesheet" href="assets/css/style.css">
  <?php if ($includeChartJs) : ?>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <?php endif; ?>
</head>
<body data-page="<?= htmlspecialchars($pageKey, ENT_QUOTES, 'UTF-8'); ?>">
  <header class="topbar">
    <div class="topbar-head">
      <button id="menuToggle" class="menu-toggle" type="button" aria-label="Ouvrir le menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
      <div>
        <h1 id="projectTitle"><?= htmlspecialchars($m['headerTitle'], ENT_QUOTES, 'UTF-8'); ?></h1>
        <p id="projectSubtitle"><?= htmlspecialchars($m['subtitle'], ENT_QUOTES, 'UTF-8'); ?></p>
        <p class="topbar-datetime">
          <span id="topbarDate">--</span>
          <span id="topbarTime" class="topbar-time">--:--:--</span>
        </p>
      </div>
      <div class="topbar-logout-row">
        <a href="logout.php" class="btn-secondary topbar-logout">Déconnexion</a>
      </div>
    </div>
  </header>

  <nav class="navbar" aria-label="Navigation principale">
    <a class="tab-btn<?= $pageKey === 'today' ? ' active' : ''; ?>" href="index.php"><i class="fa-solid fa-calendar-day" aria-hidden="true"></i><span>Aujourd'hui</span></a>
    <a class="tab-btn<?= $pageKey === 'history' ? ' active' : ''; ?>" href="history.php"><i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i><span>Historique</span></a>
    <a class="tab-btn<?= $pageKey === 'totals' ? ' active' : ''; ?>" href="totals.php"><i class="fa-solid fa-table-list" aria-hidden="true"></i><span>Totaux</span></a>
    <a class="tab-btn<?= $pageKey === 'chart' ? ' active' : ''; ?>" href="chart.php"><i class="fa-solid fa-chart-line" aria-hidden="true"></i><span>Graphique</span></a>
    <a class="tab-btn<?= $pageKey === 'stocks' ? ' active' : ''; ?>" href="stocks.php"><i class="fa-solid fa-snowflake" aria-hidden="true"></i><span>Stocks</span></a>
    <a class="tab-btn<?= $pageKey === 'stock_history' ? ' active' : ''; ?>" href="stock_history.php"><i class="fa-solid fa-list" aria-hidden="true"></i><span>Hist. stocks</span></a>
    <a class="tab-btn<?= $pageKey === 'settings' ? ' active' : ''; ?>" href="settings.php"><i class="fa-solid fa-sliders" aria-hidden="true"></i><span>Paramètres</span></a>
  </nav>
  <div id="navBackdrop" class="nav-backdrop"></div>

  <main class="container">
