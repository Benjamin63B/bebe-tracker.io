<?php
declare(strict_types=1);

require_once __DIR__ . '/firebase.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
}

$settings = getSettings();
if (!settingsAreCloudReady($settings)) {
    jsonResponse(['success' => true, 'totals' => []]);
}

try {
    $entries = fetchEntriesFromFirebase();

    $groups = [];
    foreach ($entries as $entry) {
        $dateIso = (string)($entry['dateIso'] ?? '');
        if ($dateIso === '') {
            continue;
        }

        if (!isset($groups[$dateIso])) {
            $groups[$dateIso] = [
                'date' => displayDateLongFrFromIso($dateIso),
                'dateIso' => $dateIso,
                'totalMilkPumped' => 0,
                'totalBottle' => 0,
                'totalGlobal' => 0,
                'countMilkEntries' => 0,
                'countBottleEntries' => 0,
            ];
        }

        if ((int)$entry['milkPumpedMl'] > 0) {
            $groups[$dateIso]['countMilkEntries'] += 1;
        }
        if ((int)$entry['bottleMl'] > 0) {
            $groups[$dateIso]['countBottleEntries'] += 1;
        }
        $groups[$dateIso]['totalMilkPumped'] += (int)$entry['milkPumpedMl'];
        $groups[$dateIso]['totalBottle'] += (int)$entry['bottleMl'];
        $groups[$dateIso]['totalGlobal'] += (int)$entry['milkPumpedMl'] + (int)$entry['bottleMl'];
    }

    ksort($groups);
    $totals = array_values($groups);

    jsonResponse(['success' => true, 'totals' => $totals]);
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
}

