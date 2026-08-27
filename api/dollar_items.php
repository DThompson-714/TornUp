<?php

require_once __DIR__ . '/_bootstrap.php';

$weav3r = new Weav3rClient();
$items = $weav3r->dollarItems();

$bazaars = [];
foreach ($items as $it) {
    $sellerId = $it['playerId'] ?? null;
    if ($sellerId === null) {
        continue;
    }
    if (!isset($bazaars[$sellerId])) {
        $bazaars[$sellerId] = [
            'sellerId' => $sellerId,
            'sellerName' => $it['sellerName'] ?? 'Unknown seller',
            'itemCount' => 0,
            'lastUpdated' => null,
        ];
    }
    $bazaars[$sellerId]['itemCount']++;
    $updated = $it['lastUpdated'] ?? null;
    if ($updated && (!$bazaars[$sellerId]['lastUpdated'] || $updated > $bazaars[$sellerId]['lastUpdated'])) {
        $bazaars[$sellerId]['lastUpdated'] = $updated;
    }
}

$out = array_map(function ($b) {
    $b['url'] = "https://www.torn.com/bazaar.php?userId={$b['sellerId']}&Check1Buck=True#/";
    return $b;
}, array_values($bazaars));

usort($out, fn ($a, $b) => strcmp($b['lastUpdated'] ?? '', $a['lastUpdated'] ?? ''));

echo json_encode([
    'generatedAt' => time(),
    'bazaars' => $out,
]);
