<?php
declare(strict_types=1);

require_once __DIR__ . '/firebase.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
}

$settings = getSettings();
if (!settingsAreCloudReady($settings)) {
    jsonResponse(['success' => true, 'movements' => []]);
}

try {
    $movements = fetchStockMovementsFromFirebase();
    jsonResponse(['success' => true, 'movements' => $movements]);
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
}

