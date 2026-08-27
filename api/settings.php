<?php

require_once __DIR__ . '/_bootstrap.php';

$config = load_config();

echo json_encode([
    'dealsPollMs' => (int) $config['deals_poll_interval_ms'],
    'dollarRefreshMs' => (int) $config['dollar_refresh_interval_ms'],
]);
