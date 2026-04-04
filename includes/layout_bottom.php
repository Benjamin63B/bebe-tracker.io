<?php
declare(strict_types=1);
if (!isset($currentYear)) {
    $currentYear = date('Y');
}
?>
  </main>

  <footer class="footer">
    Créé avec <span class="footer-heart" aria-label="coeur">❤️</span> par Benjamin <?= htmlspecialchars((string)$currentYear, ENT_QUOTES, 'UTF-8'); ?>
  </footer>

  <div id="toast" class="toast"></div>

  <script src="assets/js/app.js"></script>
</body>
</html>
