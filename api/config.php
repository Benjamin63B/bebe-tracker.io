<?php
declare(strict_types=1);
require_once __DIR__ . '/../auth.php';

const DATA_DIR = __DIR__ . '/../data';
const SETTINGS_FILE = DATA_DIR . '/settings.json';

authStartSession();
requireApiAuth();

function ensureDataDirectory(): void
{
    if (!is_dir(DATA_DIR)) {
        mkdir(DATA_DIR, 0777, true);
    }
}

function readJsonBody(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function jsonResponse(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

