<?php
declare(strict_types=1);
require_once __DIR__ . '/auth.php';

requirePageAuth();

$error = '';
$ok = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $current = trim((string)($_POST['current_password'] ?? ''));
    $next = trim((string)($_POST['new_password'] ?? ''));
    $confirm = trim((string)($_POST['confirm_password'] ?? ''));

    if ($current === '' || $next === '' || $confirm === '') {
        $error = 'Tous les champs sont obligatoires.';
    } elseif (!authLogin($current)) {
        $error = 'Mot de passe actuel incorrect.';
    } elseif (mb_strlen($next) < 6) {
        $error = 'Le nouveau mot de passe doit contenir au moins 6 caractères.';
    } elseif ($next !== $confirm) {
        $error = 'La confirmation ne correspond pas.';
    } else {
        try {
            authUpdatePassword($next);
            header('Location: index.php');
            exit;
        } catch (Throwable $e) {
            $error = 'Enregistrement impossible (vérifie la connexion Firebase). ' . $e->getMessage();
        }
    }
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Changer le mot de passe</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css" integrity="sha512-Evv84Mr4kqVGRNSgIGL/F/aIDqQb7xQ2vcrdIwxfjThSH8CSR7PBEakCr51Ck+w+/U6swU2Im1vVX0SVk9ABhg==" crossorigin="anonymous" referrerpolicy="no-referrer">
  <link rel="stylesheet" href="assets/css/style.css">
  <link rel="icon" type="image/x-icon" href="assets/img/biberon.ico">
</head>
<body>
  <main class="container" style="max-width:560px;margin-top:5vh;">
    <section class="card">
      <h2>Changer le mot de passe</h2>
      <p>Le mot de passe doit être renouvelé tous les 7 jours.</p>
      <?php if ($error !== ''): ?>
        <p style="color:#b3261e;font-weight:700;"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8'); ?></p>
      <?php endif; ?>
      <?php if ($ok !== ''): ?>
        <p style="color:#1f9f7a;font-weight:700;"><?= htmlspecialchars($ok, ENT_QUOTES, 'UTF-8'); ?></p>
      <?php endif; ?>
      <form method="post">
        <label>Mot de passe actuel
          <input type="password" name="current_password" required>
        </label>
        <label>Nouveau mot de passe
          <input type="password" name="new_password" required>
        </label>
        <label>Confirmer le nouveau mot de passe
          <input type="password" name="confirm_password" required>
        </label>
        <button class="btn-primary" type="submit">Enregistrer</button>
      </form>
    </section>
  </main>
</body>
</html>

