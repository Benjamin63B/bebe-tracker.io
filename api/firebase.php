<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

function getSettings(): array
{
    ensureDataDirectory();
    if (!file_exists(SETTINGS_FILE)) {
        return [
            'roomCode' => 'famille2026',
            'databaseUrl' => '',
            'entriesPath' => 'rooms/{roomCode}/entries',
            'syncEnabled' => false,
        ];
    }

    $raw = file_get_contents(SETTINGS_FILE);
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function saveSettings(array $settings): void
{
    ensureDataDirectory();
    file_put_contents(SETTINGS_FILE, json_encode($settings, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function firebaseUrlFromPath(string $path): string
{
    $settings = getSettings();
    $databaseUrl = rtrim((string)($settings['databaseUrl'] ?? ''), '/');

    if ($databaseUrl === '') {
        throw new RuntimeException('Database URL Firebase manquante.');
    }

    return $databaseUrl . '/' . ltrim($path, '/');
}

function normalizePathTemplate(string $template, string $roomCode): string
{
    $path = trim($template);
    if ($path === '') {
        $path = 'rooms/{roomCode}/entries';
    }
    $path = str_replace('{roomCode}', $roomCode, $path);
    return trim($path, '/');
}

function getConfiguredEntriesPath(): string
{
    $settings = getSettings();
    $roomCode = trim((string)($settings['roomCode'] ?? 'famille2026'));
    $template = (string)($settings['entriesPath'] ?? 'rooms/{roomCode}/entries');
    return normalizePathTemplate($template, $roomCode);
}

function firebaseRequest(string $method, string $path, ?array $payload = null): mixed
{
    $settings = getSettings();
    $url = firebaseUrlFromPath($path);

    $ch = curl_init($url);
    if ($ch === false) {
        throw new RuntimeException('Impossible d initialiser CURL.');
    }

    $headers = ['Content-Type: application/json'];
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, strtoupper($method));
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);

    // Force SSL bypass for local compatibility (user requested "works directly").
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);

    if ($payload !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    }

    $raw = curl_exec($ch);
    $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    if ($raw === false) {
        $error = curl_error($ch);
        curl_close($ch);
        throw new RuntimeException('Erreur CURL: ' . $error);
    }

    curl_close($ch);

    if ($statusCode >= 400) {
        throw new RuntimeException('Firebase a retourne HTTP ' . $statusCode);
    }

    return json_decode($raw, true);
}

function settingsAreCloudReady(array $settings): bool
{
    return (bool)($settings['syncEnabled'] ?? false) && trim((string)($settings['databaseUrl'] ?? '')) !== '';
}

function normalizeDateToIso(string $value): string
{
    $date = trim($value);
    if ($date === '') {
        return '';
    }

    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) === 1) {
        return $date;
    }

    if (preg_match('/^(\d{2})\/(\d{2})(?:\/(\d{2,4}))?$/', $date, $m) === 1) {
        $day = (int)$m[1];
        $month = (int)$m[2];
        $year = isset($m[3]) ? (int)$m[3] : (int)date('Y');
        if ($year < 100) {
            $year += 2000;
        }

        if (checkdate($month, $day, $year)) {
            return sprintf('%04d-%02d-%02d', $year, $month, $day);
        }
    }

    $ts = strtotime($date);
    if ($ts !== false) {
        return date('Y-m-d', $ts);
    }

    return '';
}

function normalizeTimeToHHMM(string $value): string
{
    $time = trim($value);
    if ($time === '') {
        return '';
    }

    if (preg_match('/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/', $time, $m) === 1) {
        return sprintf('%02d:%02d', (int)$m[1], (int)$m[2]);
    }

    $ts = strtotime($time);
    if ($ts !== false) {
        return date('H:i', $ts);
    }

    return '';
}

function displayDateFromIso(string $dateIso): string
{
    if ($dateIso === '') {
        return '';
    }
    $ts = strtotime($dateIso . ' 00:00:00');
    if ($ts === false) {
        return $dateIso;
    }
    return date('d/m/Y', $ts);
}

function displayDateLongFrFromIso(string $dateIso): string
{
    if ($dateIso === '') {
        return '';
    }

    $parts = explode('-', $dateIso);
    if (count($parts) !== 3) {
        return $dateIso;
    }

    $year = (int)$parts[0];
    $month = (int)$parts[1];
    $day = (int)$parts[2];

    $months = [
        1 => 'Janvier',
        2 => 'Février',
        3 => 'Mars',
        4 => 'Avril',
        5 => 'Mai',
        6 => 'Juin',
        7 => 'Juillet',
        8 => 'Août',
        9 => 'Septembre',
        10 => 'Octobre',
        11 => 'Novembre',
        12 => 'Décembre',
    ];

    if (!isset($months[$month])) {
        return $dateIso;
    }

    return sprintf('%d %s %d', $day, $months[$month], $year);
}

function entryFromString(string $value, string $id = ''): ?array
{
    $text = trim($value);
    if ($text === '') {
        return null;
    }

    if (preg_match('/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(\d{1,2}:\d{2}).*?(\d+)\s*ml/i', $text, $m) !== 1) {
        return null;
    }

    $dateIso = normalizeDateToIso($m[1]);
    $time = normalizeTimeToHHMM($m[2]);
    $ml = (int)$m[3];

    return [
        'id' => $id,
        'date' => $m[1],
        'dateIso' => $dateIso,
        'time' => $time,
        'milkPumpedMl' => 0,
        'bottleMl' => $ml,
        'note' => '',
        'createdAt' => '',
    ];
}

function mapEntries(array $firebaseEntries): array
{
    $entries = [];
    foreach ($firebaseEntries as $id => $row) {
        if (is_string($row)) {
            $parsed = entryFromString($row, (string)$id);
            if ($parsed !== null) {
                $entries[] = $parsed;
            }
            continue;
        }
        if (!is_array($row)) {
            continue;
        }

        // Some logs store metadata at root and real values in "entry".
        if (isset($row['entry']) && is_array($row['entry'])) {
            $row = array_merge($row, $row['entry']);
        }

        $rawDate = trim((string)($row['date'] ?? ($row['day'] ?? $row['entryDate'] ?? '')));
        $rawTime = trim((string)($row['time'] ?? ($row['hour'] ?? $row['entryTime'] ?? '')));
        if ($rawDate === '' && isset($row['datetime'])) {
            $dt = strtotime((string)$row['datetime']);
            if ($dt !== false) {
                $rawDate = date('Y-m-d', $dt);
                $rawTime = date('H:i', $dt);
            }
        }
        if (($rawDate === '' || $rawTime === '') && isset($row['createdAt'])) {
            $created = $row['createdAt'];
            if (is_numeric($created)) {
                $timestamp = (int)$created;
                if ($timestamp > 20000000000) {
                    $timestamp = (int)floor($timestamp / 1000);
                }
                if ($timestamp > 0) {
                    if ($rawDate === '') {
                        $rawDate = date('Y-m-d', $timestamp);
                    }
                    if ($rawTime === '') {
                        $rawTime = date('H:i', $timestamp);
                    }
                }
            }
        }
        $dateIso = normalizeDateToIso($rawDate);
        $time = normalizeTimeToHHMM($rawTime);
        $displayDate = $rawDate !== '' ? $rawDate : displayDateFromIso($dateIso);
        $note = trim((string)($row['note'] ?? ($row['comment'] ?? $row['details'] ?? '')));
        $amount = (int)($row['ml'] ?? ($row['amountMl'] ?? ($row['amount'] ?? ($row['quantity'] ?? ($row['value'] ?? 0)))));
        $milkPumpedMl = (int)($row['milkPumpedMl'] ?? ($row['pumpedMl'] ?? ($row['tirage'] ?? 0)));
        $bottleMl = (int)($row['bottleMl'] ?? ($row['drankMl'] ?? ($row['biberon'] ?? 0)));
        $kind = strtolower(trim((string)($row['type'] ?? ($row['mode'] ?? $row['category'] ?? ''))));

        if ($milkPumpedMl <= 0 && $bottleMl <= 0 && $amount > 0) {
            $hint = $kind . ' ' . strtolower($note);
            if (str_contains($hint, 'tirage') || str_contains($hint, 'tire') || str_contains($hint, 'pump')) {
                $milkPumpedMl = $amount;
            } else {
                $bottleMl = $amount;
            }
        }

        $entries[] = [
            'id' => (string)$id,
            'date' => $displayDate,
            'dateIso' => $dateIso,
            'time' => $time,
            'milkPumpedMl' => $milkPumpedMl,
            'bottleMl' => $bottleMl,
            'note' => $note,
            'createdAt' => (string)($row['createdAt'] ?? ''),
        ];
    }

    usort($entries, static function (array $a, array $b): int {
        $aKey = (($a['dateIso'] ?? '') . ' ' . ($a['time'] ?? ''));
        $bKey = (($b['dateIso'] ?? '') . ' ' . ($b['time'] ?? ''));
        return strcmp($bKey, $aKey);
    });

    return $entries;
}

function collectEntriesRecursively(mixed $node, array &$flat, string $prefix = ''): void
{
    if (is_string($node)) {
        $flat[$prefix !== '' ? $prefix : uniqid('str_', true)] = $node;
        return;
    }

    if (!is_array($node)) {
        return;
    }

    $looksLikeEntry = isset($node['date']) || isset($node['time']) || isset($node['bottleMl']) || isset($node['milkPumpedMl']) || isset($node['ml']) || isset($node['amountMl']) || isset($node['datetime']);
    if ($looksLikeEntry) {
        $flat[$prefix !== '' ? $prefix : uniqid('row_', true)] = $node;
        return;
    }

    foreach ($node as $k => $child) {
        $childPrefix = $prefix === '' ? (string)$k : $prefix . '_' . (string)$k;
        collectEntriesRecursively($child, $flat, $childPrefix);
    }
}

function fetchEntriesFromFirebase(): array
{
    $settings = getSettings();
    $roomCode = trim((string)($settings['roomCode'] ?? 'famille2026'));
    $configured = getConfiguredEntriesPath();
    $configuredEntriesSibling = preg_replace('/historyLog$/i', 'entries', $configured);
    $configuredPath = $configured . '.json';
    $configuredError = null;
    $configuredWasNull = false;

    $candidatePaths = [
        $configuredEntriesSibling . '.json',
        'entries.json',
        'history.json',
        'historique.json',
        'bundle/historyLog.json',
        'bundle/entries.json',
        $roomCode . '.json',
        $roomCode . '/entries.json',
        $roomCode . '/history.json',
        $roomCode . '/historique.json',
        $roomCode . '/bundle/historyLog.json',
        $roomCode . '/bundle/entries.json',
        'rooms/' . $roomCode . '/entries.json',
        'rooms/' . $roomCode . '/history.json',
        'rooms/' . $roomCode . '/historique.json',
        'rooms/' . $roomCode . '/bundle/historyLog.json',
        'rooms/' . $roomCode . '/bundle/entries.json',
    ];

    $best = [];
    $hadUnauthorized = false;
    try {
        $raw = firebaseRequest('GET', $configuredPath);
        if ($raw === null) {
            $configuredWasNull = true;
        }
        $flat = [];
        collectEntriesRecursively($raw, $flat);
        $best = mapEntries($flat);
    } catch (Throwable $e) {
        $configuredError = $e;
    }

    foreach ($candidatePaths as $path) {
        try {
            $raw = firebaseRequest('GET', $path);
            $flat = [];
            collectEntriesRecursively($raw, $flat);
            $mapped = mapEntries($flat);
            if (count($mapped) > count($best)) {
                $best = $mapped;
            }
        } catch (Throwable $_e) {
            if (str_contains($_e->getMessage(), 'HTTP 401')) {
                $hadUnauthorized = true;
            }
            // Ignore denied/missing paths and keep probing.
        }
    }

    if (count($best) === 0 && $configuredError !== null) {
        throw new RuntimeException('Lecture Firebase impossible sur "' . $configured . '" : ' . $configuredError->getMessage());
    }

    if (count($best) === 0 && $configuredWasNull) {
        if ($hadUnauthorized) {
            throw new RuntimeException(
                'Le chemin configure est vide et d autres chemins potentiels sont refuses (HTTP 401). ' .
                'Verifie les regles Firebase (.read/.write).'
            );
        }
        throw new RuntimeException(
            'Aucune donnee trouvee sur "' . $configured . '". ' .
            'Ce noeud existe mais il est vide (null) ou les donnees sont dans un autre chemin.'
        );
    }

    return $best;
}

function updateEntryInFirebase(string $entryId, array $entry): mixed
{
    $id = trim($entryId);
    if ($id === '') {
        throw new RuntimeException('ID entrée manquant.');
    }

    return firebaseRequest('PATCH', getConfiguredEntriesPath() . '/' . $id . '.json', $entry);
}

function deleteEntryInFirebase(string $entryId): mixed
{
    $id = trim($entryId);
    if ($id === '') {
        throw new RuntimeException('ID entrée manquant.');
    }

    return firebaseRequest('DELETE', getConfiguredEntriesPath() . '/' . $id . '.json');
}

function getConfiguredStocksPath(): string
{
    $settings = getSettings();
    $roomCode = trim((string)($settings['roomCode'] ?? 'famille2026'));
    return 'rooms/' . $roomCode . '/stocks';
}

function fetchStockMovementsFromFirebase(): array
{
    $raw = firebaseRequest('GET', getConfiguredStocksPath() . '.json');
    if (!is_array($raw)) {
        return [];
    }

    $rows = [];
    foreach ($raw as $id => $row) {
        if (!is_array($row)) {
            continue;
        }
        $dateIso = normalizeDateToIso((string)($row['date'] ?? ''));
        $time = normalizeTimeToHHMM((string)($row['time'] ?? ''));
        $rows[] = [
            'id' => (string)$id,
            'dateIso' => $dateIso,
            'date' => displayDateLongFrFromIso($dateIso),
            'time' => $time,
            'direction' => (string)($row['direction'] ?? 'in'),
            'category' => (string)($row['category'] ?? 'frozen'),
            'amountMl' => max(0, (int)($row['amountMl'] ?? 0)),
            'pumpDateIso' => normalizeDateToIso((string)($row['pumpDate'] ?? '')),
            'expiryDateIso' => normalizeDateToIso((string)($row['expiryDate'] ?? '')),
            'fifoSource' => is_array($row['fifoSource'] ?? null) ? $row['fifoSource'] : null,
            'note' => trim((string)($row['note'] ?? '')),
            'createdAt' => (string)($row['createdAt'] ?? ''),
        ];
    }

    usort($rows, static function (array $a, array $b): int {
        $aKey = ($a['dateIso'] ?? '') . ' ' . ($a['time'] ?? '');
        $bKey = ($b['dateIso'] ?? '') . ' ' . ($b['time'] ?? '');
        return strcmp($bKey, $aKey);
    });

    return $rows;
}

