<?php

require_once __DIR__ . '/_bootstrap.php';

$path = DATA_DIR . '/deal_watchlist.json';
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    echo json_encode(Store::read($path, ['items' => []]));
    exit;
}

$watchlist = Store::read($path, ['items' => []]);

if ($method === 'POST') {
    $body = json_body();
    $id = isset($body['id']) ? (int) $body['id'] : null;
    $name = trim($body['name'] ?? '');

    if (!$id && $name === '') {
        json_error('Provide an item id or name.');
    }

    if (!$id) {
        $cache = Store::read(DATA_DIR . '/items_cache.json', ['items' => []]);
        $found = null;
        foreach ($cache['items'] as $item) {
            if (strcasecmp($item['name'], $name) === 0) {
                $found = $item;
                break;
            }
        }
        if (!$found) {
            json_error("No exact catalog match for \"$name\" - use the search box to pick an item, or refresh the catalog first.");
        }
        $id = $found['id'];
        $name = $found['name'];
    } else {
        $cache = Store::read(DATA_DIR . '/items_cache.json', ['items' => []]);
        foreach ($cache['items'] as $item) {
            if ($item['id'] === $id) {
                $name = $item['name'];
                break;
            }
        }
        if ($name === '') {
            $name = "Item #$id";
        }
    }

    foreach ($watchlist['items'] as $existing) {
        if ($existing['id'] === $id) {
            echo json_encode($watchlist);
            exit;
        }
    }

    $watchlist['items'][] = ['id' => $id, 'name' => $name];
    Store::write($path, $watchlist);
    echo json_encode($watchlist);
    exit;
}

if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    $watchlist['items'] = array_values(array_filter(
        $watchlist['items'],
        fn ($item) => $item['id'] !== $id
    ));
    Store::write($path, $watchlist);
    echo json_encode($watchlist);
    exit;
}

json_error('Unsupported method.', 405);
