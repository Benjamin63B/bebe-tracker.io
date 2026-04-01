<?php
declare(strict_types=1);

require_once __DIR__ . '/firebase.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
}

$settings = getSettings();
if (!settingsAreCloudReady($settings)) {
    jsonResponse(['success' => true, 'entries' => []]);
}

$requestedDate = trim((string)($_GET['date'] ?? ''));
$today = normalizeDateToIso($requestedDate);
if ($today === '') {
    $today = date('Y-m-d');
}

try {
    $entries = array_values(array_filter(
        fetchEntriesFromFirebase(),
        static fn(array $entry): bool => ($entry['dateIso'] ?? '') === $today
    ));
    jsonResponse(['success' => true, 'entries' => $entries, 'date' => $today]);
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
}

