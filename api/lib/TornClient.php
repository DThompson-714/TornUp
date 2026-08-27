<?php

/**
 * Thin wrapper around the official Torn API (api.torn.com), v2.
 */
class TornClient
{
    private string $apiKey;

    public function __construct(string $apiKey)
    {
        $this->apiKey = $apiKey;
    }

    /**
     * Item Market listings for one item, cheapest first, plus its average price.
     * Returns null on failure, or ['average_price'=>float|null, 'listings'=>array].
     */
    public function itemMarket(int $itemId): ?array
    {
        $url = 'https://api.torn.com/v2/market/' . $itemId . '/itemmarket?key=' . urlencode($this->apiKey);
        $data = http_get_json($url);
        if (!$data || empty($data['itemmarket'])) {
            return null;
        }

        $im = $data['itemmarket'];
        return [
            'average_price' => $im['item']['average_price'] ?? null,
            'listings' => $im['listings'] ?? [],
        ];
    }

    /**
     * Full item catalog (id, name, type, tradability, market price), following
     * pagination if the API returns any. Bounded to avoid a runaway loop.
     */
    public function itemsCatalog(): array
    {
        $items = [];
        $url = 'https://api.torn.com/v2/torn/items?key=' . urlencode($this->apiKey);
        $maxPages = 20;

        for ($page = 0; $url && $page < $maxPages; $page++) {
            $data = http_get_json($url, 20);
            if (!$data || empty($data['items'])) {
                break;
            }
            foreach ($data['items'] as $item) {
                $items[] = [
                    'id' => $item['id'],
                    'name' => $item['name'],
                    'type' => $item['type'] ?? null,
                    'is_tradable' => $item['is_tradable'] ?? true,
                    'market_price' => $item['value']['market_price'] ?? null,
                ];
            }
            $url = $data['_metadata']['links']['next'] ?? null;
        }

        return $items;
    }
}
