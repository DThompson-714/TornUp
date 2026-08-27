<?php

require_once __DIR__ . '/_bootstrap.php';

$weav3r = new Weav3rClient();
$items = $weav3r->dollarItems();

$out = array_map(function ($it) {
    return [
        'itemId' => $it['itemId'] ?? null,
        'itemName' => $it['itemName'] ?? 'Unknown item',
        'itemType' => $it['itemType'] ?? null,
        'sellerId' => $it['playerId'] ?? null,
        'sellerName' => $it['sellerName'] ?? 'Unknown seller',
        'quantity' => $it['quantity'] ?? null,
        'marketPrice' => $it['marketPrice'] ?? null,
        'lastUpdated' => $it['lastUpdated'] ?? null,
        'url' => isset($it['playerId']) ? "https://www.torn.com/bazaar.php?userId={$it['playerId']}&Check1Buck=True#/" : null,
    ];
}, $items);

echo json_encode([
    'generatedAt' => time(),
    'items' => $out,
]);
