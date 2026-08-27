<?php

require_once __DIR__ . '/_bootstrap.php';

$watchlist = Store::read(DATA_DIR . '/deal_watchlist.json', ['items' => []]);
$items = $watchlist['items'];
$count = count($items);

if ($count === 0) {
    echo json_encode(['empty' => true]);
    exit;
}

$index = ((int) ($_GET['index'] ?? 0)) % $count;
if ($index < 0) {
    $index += $count;
}
$item = $items[$index];

$config = load_config();
$threshold = (float) $config['threshold_percent'];
$torn = new TornClient($config['torn_api_key']);
$weav3r = new Weav3rClient();

$officialHit = null;
$market = $torn->itemMarket($item['id']);
if ($market && $market['average_price'] && !empty($market['listings'])) {
    $avg = (float) $market['average_price'];
    $cheapest = null;
    foreach ($market['listings'] as $listing) {
        if ($cheapest === null || $listing['price'] < $cheapest['price']) {
            $cheapest = $listing;
        }
    }
    $thresholdPrice = $avg * (1 - $threshold / 100);
    if ($cheapest && $cheapest['price'] <= $thresholdPrice) {
        $officialHit = [
            'source' => 'itemmarket',
            'price' => $cheapest['price'],
            'quantityAvailable' => $cheapest['amount'] ?? null,
            'averagePrice' => $avg,
            'discountPercent' => round((1 - $cheapest['price'] / $avg) * 100, 1),
            'url' => "https://www.torn.com/page.php?sid=ItemMarket#/market/view=search&itemID={$item['id']}",
        ];
    }
}

$communityHits = [];
$mp = $weav3r->marketplaceItem($item['id']);
if ($mp && !empty($mp['listings'])) {
    $ref = $mp['bazaar_average'] ?? $mp['market_price'] ?? null;
    if ($ref) {
        $thresholdPrice = $ref * (1 - $threshold / 100);
        foreach ($mp['listings'] as $listing) {
            if ($listing['price'] <= $thresholdPrice) {
                $communityHits[] = [
                    'source' => 'bazaar_community',
                    'price' => $listing['price'],
                    'quantity' => $listing['quantity'],
                    'sellerId' => $listing['player_id'] ?? null,
                    'sellerName' => $listing['player_name'] ?? null,
                    'referencePrice' => $ref,
                    'discountPercent' => round((1 - $listing['price'] / $ref) * 100, 1),
                    'url' => isset($listing['player_id'])
                        ? "https://www.torn.com/bazaar.php?userId={$listing['player_id']}#/"
                        : null,
                ];
            }
        }
    }
}

echo json_encode([
    'index' => $index,
    'count' => $count,
    'item' => $item,
    'officialHit' => $officialHit,
    'communityHits' => $communityHits,
]);
