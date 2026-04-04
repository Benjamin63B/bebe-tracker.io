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
    $rawExisting = firebaseRequest('GET', getConfiguredStocksPath() . '/' . rawurlencode($id) . '.json');
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
}

if (!is_array($rawExisting)) {
    jsonResponse(['success' => false, 'error' => 'Mouvement introuvable.'], 404);
}

$date = trim((string)($body['date'] ?? (string)($rawExisting['date'] ?? '')));
$time = trim((string)($body['time'] ?? (string)($rawExisting['time'] ?? '')));
$direction = trim((string)($body['direction'] ?? (string)($rawExisting['direction'] ?? 'in')));
$amountMl = array_key_exists('amountMl', $body) ? max(0, (int)$body['amountMl']) : max(0, (int)($rawExisting['amountMl'] ?? 0));
$pumpDate = trim((string)($body['pumpDate'] ?? (string)($rawExisting['pumpDate'] ?? $date)));
$note = trim((string)($body['note'] ?? (string)($rawExisting['note'] ?? '')));

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

$baseTs = strtotime($pumpDateIso . ' 00:00:00');
$expiryDateIso = date('Y-m-d', strtotime('+8 months', $baseTs !== false ? $baseTs : time()));

$fifoSource = null;
if ($direction === 'out') {
    $all = fetchStockMovementsFromFirebase();
    $others = [];
    foreach ($all as $move) {
        if ((string)($move['id'] ?? '') === $id) {
            continue;
        }
        $others[] = $move;
    }
    $fifo = selectFifoLotForOutgoing($others, $amountMl);
    if ($fifo === null) {
        jsonResponse(['success' => false, 'error' => 'Stock insuffisant pour appliquer FIFO (lot le plus ancien).'], 422);
    }
    if ($fifo['expiryDateIso'] !== '') {
        $expiryDateIso = $fifo['expiryDateIso'];
    }
    $fifoSource = $fifo['fifoSource'];
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
    'createdAt' => (string)($rawExisting['createdAt'] ?? gmdate('c')),
];
if ($fifoSource !== null) {
    $movement['fifoSource'] = $fifoSource;
} else {
    $movement['fifoSource'] = null;
}

try {
    patchStockMovementInFirebase($id, $movement);
    jsonResponse(['success' => true, 'id' => $id, 'movement' => $movement]);
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
}
