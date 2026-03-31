<?php
declare(strict_types=1);

const AUTH_LOCAL_CACHE_FILE = __DIR__ . '/data/auth_cache.json';
const SETTINGS_FILE_FOR_AUTH = __DIR__ . '/data/settings.json';
const DEFAULT_PASSWORD_SHA256 = 'c83e0f93b218d5a0fa7e420fab25e5a69dee76601b7dcc041861b75befe04bb8';

function authEnsureStorage(): void
{
    $dir = dirname(AUTH_LOCAL_CACHE_FILE);
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
    if (!file_exists(AUTH_LOCAL_CACHE_FILE)) {
        $initial = [
            'passwordSha256' => DEFAULT_PASSWORD_SHA256,
            'passwordHash' => password_hash('admin2026!', PASSWORD_DEFAULT),
            'passwordChangedAt' => gmdate('c'),
        ];
        file_put_contents(AUTH_LOCAL_CACHE_FILE, json_encode($initial, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
}

function authStartSession(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_name('recap_auth');
        session_start();
    }
}

function authRead(): array
{
    // Firebase storage (primary): /rooms/{roomCode}/security/auth
    try {
        $remote = authReadFromFirebase();
        if (is_array($remote) && isset($remote['passwordHash'])) {
            if (empty($remote['passwordSha256'])) {
                $remote['passwordSha256'] = DEFAULT_PASSWORD_SHA256;
                authWriteToFirebase($remote);
            }
            authWriteLocalCache($remote);
            return $remote;
        }
    } catch (Throwable $_e) {
        // Fallback on local cache when Firebase is temporarily unavailable.
    }

    authEnsureStorage();
    $raw = file_get_contents(AUTH_LOCAL_CACHE_FILE);
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        return [];
    }
    if (empty($data['passwordSha256'])) {
        $data['passwordSha256'] = DEFAULT_PASSWORD_SHA256;
        authWriteLocalCache($data);
    }
    return $data;
}

function authWrite(array $data): void
{
    authWriteLocalCache($data);
    authWriteToFirebase($data);
}

function authWriteLocalCache(array $data): void
{
    authEnsureStorage();
    file_put_contents(AUTH_LOCAL_CACHE_FILE, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function authReadSettings(): array
{
    if (!file_exists(SETTINGS_FILE_FOR_AUTH)) {
        throw new RuntimeException('Configuration Firebase absente.');
    }
    $raw = file_get_contents(SETTINGS_FILE_FOR_AUTH);
    if ($raw === false || trim($raw) === '') {
        throw new RuntimeException('Configuration Firebase vide.');
    }
    $settings = json_decode($raw, true);
    if (!is_array($settings)) {
        throw new RuntimeException('Configuration Firebase invalide.');
    }
    return $settings;
}

function authFirebaseAuthPath(): string
{
    $settings = authReadSettings();
    $databaseUrl = rtrim((string)($settings['databaseUrl'] ?? ''), '/');
    $roomCode = trim((string)($settings['roomCode'] ?? 'famille2026'));
    if ($databaseUrl === '') {
        throw new RuntimeException('Database URL Firebase manquante.');
    }
    if ($roomCode === '') {
        throw new RuntimeException('Code salon manquant.');
    }
    return $databaseUrl . '/rooms/' . rawurlencode($roomCode) . '/security.json';
}

function authFirebaseRequest(string $method, ?array $payload = null): mixed
{
    $url = authFirebaseAuthPath();
    $ch = curl_init($url);
    if ($ch === false) {
        throw new RuntimeException('Impossible d initialiser CURL.');
    }
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, strtoupper($method));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
    if ($payload !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    }

    $raw = curl_exec($ch);
    $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ($raw === false) {
        $err = curl_error($ch);
        curl_close($ch);
        throw new RuntimeException('Erreur CURL: ' . $err);
    }
    curl_close($ch);
    if ($statusCode >= 400) {
        throw new RuntimeException('Firebase a retourne HTTP ' . $statusCode);
    }
    return json_decode($raw, true);
}

function authReadFromFirebase(): array
{
    $raw = authFirebaseRequest('GET');
    if (!is_array($raw)) {
        $initial = [
            'pwdHash' => DEFAULT_PASSWORD_SHA256,
            'passwordChangedAt' => gmdate('c'),
        ];
        authWriteToFirebase($initial);
        return [
            'passwordSha256' => $initial['pwdHash'],
            'passwordChangedAt' => $initial['passwordChangedAt'],
        ];
    }

    $pwdHash = (string)($raw['pwdHash'] ?? $raw['passwordSha256'] ?? '');
    $changedAt = (string)($raw['passwordChangedAt'] ?? gmdate('c'));
    if ($pwdHash === '') {
        $pwdHash = DEFAULT_PASSWORD_SHA256;
        authFirebaseRequest('PATCH', ['pwdHash' => $pwdHash, 'passwordChangedAt' => $changedAt]);
    }

    return [
        'passwordSha256' => $pwdHash,
        'passwordChangedAt' => $changedAt,
    ];
}

function authWriteToFirebase(array $data): void
{
    $payload = [
        'pwdHash' => (string)($data['passwordSha256'] ?? DEFAULT_PASSWORD_SHA256),
        'passwordChangedAt' => (string)($data['passwordChangedAt'] ?? gmdate('c')),
    ];
    authFirebaseRequest('PATCH', $payload);
}

function authIsLoggedIn(): bool
{
    authStartSession();
    return (bool)($_SESSION['authenticated'] ?? false);
}

function authLogin(string $password): bool
{
    $auth = authRead();
    $sha = strtolower(trim((string)($auth['passwordSha256'] ?? '')));
    $candidateSha = hash('sha256', $password);
    if ($sha !== '' && hash_equals($sha, $candidateSha)) {
        authStartSession();
        $_SESSION['authenticated'] = true;
        $_SESSION['loginAt'] = time();
        return true;
    }
    return false;
}

function authLogout(): void
{
    authStartSession();
    $_SESSION = [];
    session_destroy();
}

function authMustChangePassword(): bool
{
    $auth = authRead();
    $changedAt = (string)($auth['passwordChangedAt'] ?? '');
    $changedTs = strtotime($changedAt);
    if ($changedTs === false) {
        return true;
    }
    return (time() - $changedTs) >= (7 * 24 * 60 * 60);
}

function authUpdatePassword(string $newPassword): void
{
    $auth = authRead();
    $auth['passwordSha256'] = hash('sha256', $newPassword);
    $auth['passwordChangedAt'] = gmdate('c');
    authWrite($auth);
}

function requirePageAuth(): void
{
    if (!authIsLoggedIn()) {
        header('Location: login.php');
        exit;
    }
}

function requireApiAuth(): void
{
    if (!authIsLoggedIn()) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'error' => 'Non autorisé'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

