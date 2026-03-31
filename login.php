<?php
declare(strict_types=1);
require_once __DIR__ . '/auth.php';

authStartSession();
if (authIsLoggedIn() && !authMustChangePassword()) {
    header('Location: index.php');
    exit;
}

$error = '';
$success = false;
$redirectTo = 'index.php';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $password = trim((string)($_POST['password'] ?? ''));
    if ($password === '') {
        $error = 'Mot de passe requis.';
    } elseif (!authLogin($password)) {
        $error = 'Mot de passe incorrect.';
    } elseif (authMustChangePassword()) {
        $success = true;
        $redirectTo = 'change_password.php';
    } else {
        $success = true;
    }
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connexion - Statistique 2026</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Manrope:wght@600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/style.css">
  <link rel="icon" type="image/x-icon" href="assets/img/biberon.ico">
</head>
<body>
  <main class="login-fullscreen">
    <section class="card auth-card login-card">
      <h2 class="login-title">Connexion</h2>
      <p class="login-subtitle">Entrez votre mot de passe.</p>
      <?php if ($error !== ''): ?>
        <p class="auth-message auth-error"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8'); ?></p>
      <?php endif; ?>
      <?php if ($success): ?>
        <p class="auth-message auth-success">Connexion réussie, redirection en cours...</p>
      <?php endif; ?>
      <form method="post" class="login-form">
        <label>Mot de passe
          <input type="password" name="password" required>
        </label>
        <button class="btn-primary login-btn" type="submit">Se connecter</button>
      </form>
      <p class="login-hint">Le mot de passe doit être renouvelé tous les 7 jours.</p>
    </section>
  </main>
  <?php if ($success): ?>
  <script>
    setTimeout(() => {
      window.location.href = <?= json_encode($redirectTo, JSON_UNESCAPED_UNICODE); ?>;
    }, 850);
  </script>
  <?php endif; ?>
</body>
</html>

