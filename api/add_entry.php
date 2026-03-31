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

$date = trim((string)($body['date'] ?? ''));
$time = trim((string)($body['time'] ?? ''));
$milkPumpedMl = max(0, (int)($body['milkPumpedMl'] ?? 0));
$bottleMl = max(0, (int)($body['bottleMl'] ?? 0));
$note = trim((string)($body['note'] ?? ''));

if ($date === '' || $time === '') {
    jsonResponse(['success' => false, 'error' => 'Date et heure sont obligatoires.'], 422);
}

$entry = [
    'date' => $date,
    'time' => $time,
    'milkPumpedMl' => $milkPumpedMl,
    'bottleMl' => $bottleMl,
    'note' => $note,
    'createdAt' => gmdate('c'),
];

try {
    $result = firebaseRequest('POST', getConfiguredEntriesPath() . '.json', $entry);
    jsonResponse(['success' => true, 'id' => $result['name'] ?? null, 'entry' => $entry]);
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
}

