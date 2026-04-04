<?php
declare(strict_types=1);

require_once __DIR__ . '/firebase.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
}

$settings = getSettings();
if (!settingsAreCloudReady($settings)) {
    jsonResponse(['success' => false, 'error' => 'Active la synchro et configure Firebase dans Parametres.'], 400);
}

$body = readJsonBody();
$id = trim((string)($body['id'] ?? ''));
if ($id === '') {
    jsonResponse(['success' => false, 'error' => 'ID mouvement manquant.'], 422);
}

try {
    deleteStockMovementInFirebase($id);
    jsonResponse(['success' => true, 'id' => $id]);
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
}
