<?php

require_once __DIR__ . '/_bootstrap.php';

$cache = Store::read(DATA_DIR . '/items_cache.json', ['generated_at' => 0, 'items' => []]);
$items = $cache['items'];

$q = strtolower(trim($_GET['q'] ?? ''));

$matches = [];
foreach ($items as $item) {
    if (empty($item['is_tradable'])) {
        continue;
    }
    if ($q === '' || strpos(strtolower($item['name']), $q) !== false) {
        $matches[] = [
            'id' => $item['id'],
            'name' => $item['name'],
            'type' => $item['type'] ?? null,
            'marketPrice' => $item['market_price'] ?? null,
        ];
    }
    if (count($matches) >= 20) {
        break;
    }
}

echo json_encode([
    'generatedAt' => $cache['generated_at'],
    'results' => $matches,
]);
