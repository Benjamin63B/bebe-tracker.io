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
$direction = trim((string)($body['direction'] ?? 'in'));
$amountMl = max(0, (int)($body['amountMl'] ?? 0));
$pumpDate = trim((string)($body['pumpDate'] ?? $date));
$expiryDate = trim((string)($body['expiryDate'] ?? ''));
$note = trim((string)($body['note'] ?? ''));

if ($date === '' || $amountMl <= 0) {
    jsonResponse(['success' => false, 'error' => 'Date et volume (supérieur à 0) sont obligatoires.'], 422);
}
if (!in_array($direction, ['in', 'out'], true)) {
    jsonResponse(['success' => false, 'error' => 'Type de mouvement invalide.'], 422);
}

$pumpDateIso = normalizeDateToIso($pumpDate);
if ($pumpDateIso === '') {
    $pumpDateIso = normalizeDateToIso($date);
}
if ($pumpDateIso === '') {
    jsonResponse(['success' => false, 'error' => 'Date du tirage invalide.'], 422);
}

$expiryDateIso = normalizeDateToIso($expiryDate);
if ($expiryDateIso === '') {
    $baseTs = strtotime($pumpDateIso . ' 00:00:00');
    $expiryDateIso = date('Y-m-d', strtotime('+8 months', $baseTs !== false ? $baseTs : time()));
}

$fifoSource = null;
if ($direction === 'out') {
    $existing = fetchStockMovementsFromFirebase();
    $lots = [];
    foreach ($existing as $move) {
        $qty = (int)($move['amountMl'] ?? 0);
        if ($qty <= 0) {
            continue;
        }
        $remaining = $qty;
        if (($move['direction'] ?? 'in') === 'out') {
            continue;
        }
        $lots[] = [
            'id' => (string)($move['id'] ?? ''),
            'pumpDateIso' => (string)($move['pumpDateIso'] ?? ''),
            'expiryDateIso' => (string)($move['expiryDateIso'] ?? ''),
            'remainingMl' => $remaining,
        ];
    }

    foreach ($existing as $move) {
        if (($move['direction'] ?? '') !== 'out') {
            continue;
        }
        $sourceId = (string)(($move['fifoSource']['id'] ?? ''));
        $used = (int)(($move['amountMl'] ?? 0));
        if ($sourceId === '' || $used <= 0) {
            continue;
        }
        foreach ($lots as &$lot) {
            if ($lot['id'] === $sourceId) {
                $lot['remainingMl'] = max(0, $lot['remainingMl'] - $used);
                break;
            }
        }
        unset($lot);
    }

    usort($lots, static function (array $a, array $b): int {
        $aKey = ($a['pumpDateIso'] ?: '9999-12-31') . ' ' . ($a['id'] ?? '');
        $bKey = ($b['pumpDateIso'] ?: '9999-12-31') . ' ' . ($b['id'] ?? '');
        return strcmp($aKey, $bKey);
    });

    $selected = null;
    foreach ($lots as $lot) {
        if (($lot['remainingMl'] ?? 0) >= $amountMl) {
            $selected = $lot;
            break;
        }
    }
    if ($selected === null) {
        jsonResponse(['success' => false, 'error' => 'Stock insuffisant pour appliquer FIFO (lot le plus ancien).'], 422);
    }
    $lotExpiryIso = normalizeDateToIso((string)($selected['expiryDateIso'] ?? ''));
    if ($lotExpiryIso !== '') {
        $expiryDateIso = $lotExpiryIso;
    }
    $fifoSource = [
        'id' => $selected['id'],
        'pumpDate' => $selected['pumpDateIso'],
        'expiryDate' => $selected['expiryDateIso'],
    ];
}

$movement = [
    'date' => $date,
    'time' => $time,
    'direction' => $direction,
    'category' => 'frozen',
    'amountMl' => $amountMl,
    'pumpDate' => $pumpDateIso,
    'expiryDate' => $expiryDateIso,
    'note' => $note,
    'createdAt' => gmdate('c'),
];
if ($fifoSource !== null) {
    $movement['fifoSource'] = $fifoSource;
}

try {
    $result = firebaseRequest('POST', getConfiguredStocksPath() . '.json', $movement);
    jsonResponse(['success' => true, 'id' => $result['name'] ?? null, 'movement' => $movement]);
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
}

