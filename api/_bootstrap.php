<?php

declare(strict_types=1);

header('Content-Type: application/json');

require_once __DIR__ . '/lib/Config.php';
require_once __DIR__ . '/lib/Http.php';
require_once __DIR__ . '/lib/Store.php';
require_once __DIR__ . '/lib/TornClient.php';
require_once __DIR__ . '/lib/Weav3rClient.php';

define('DATA_DIR', __DIR__ . '/../data');

function json_error(string $message, int $code = 400): void
{
    http_response_code($code);
    echo json_encode(['error' => $message]);
    exit;
}

function json_body(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}
