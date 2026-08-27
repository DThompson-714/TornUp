<?php

require_once __DIR__ . '/_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Use POST to refresh the catalog.', 405);
}

set_time_limit(60);

$config = load_config();
$torn = new TornClient($config['torn_api_key']);
$items = $torn->itemsCatalog();

if (empty($items)) {
    json_error('Torn API returned no items - check your API key in config/config.php.', 502);
}

$cachePath = DATA_DIR . '/items_cache.json';
Store::write($cachePath, [
    'generated_at' => time(),
    'items' => $items,
]);

echo json_encode([
    'generatedAt' => time(),
    'count' => count($items),
]);
