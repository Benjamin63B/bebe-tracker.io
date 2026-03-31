<?php
declare(strict_types=1);

require_once __DIR__ . '/firebase.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
}

$body = readJsonBody();

$settings = [
    'roomCode' => trim((string)($body['roomCode'] ?? 'famille2026')),
    'databaseUrl' => trim((string)($body['databaseUrl'] ?? '')),
    'entriesPath' => trim((string)($body['entriesPath'] ?? 'rooms/{roomCode}/entries')),
    'syncEnabled' => (bool)($body['syncEnabled'] ?? false),
];

saveSettings($settings);

jsonResponse(['success' => true, 'settings' => $settings]);

