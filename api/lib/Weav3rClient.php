<?php

/**
 * Thin wrapper around the public read endpoints of weav3r.dev's TornW3B API
 * (https://weav3r.dev/api-docs.html). No API key needed for these routes.
 * Published limit: 100 calls/min via Cloudflare - we stay far under that.
 */
class Weav3rClient
{
    private const BASE = 'https://weav3r.dev/api/';

    /** Game-wide list of items currently listed for $1 in player bazaars. */
    public function dollarItems(): array
    {
        $data = http_get_json(self::BASE . 'dollar-bazaars/items');
        return $data['items'] ?? [];
    }

    /**
     * Community-sourced bazaar listings for one item, with seller identity.
     * Can lag reality by a few minutes (crowd-synced, not authoritative) -
     * callers should surface that to the user.
     */
    public function marketplaceItem(int $itemId): ?array
    {
        return http_get_json(self::BASE . 'marketplace/' . $itemId);
    }
}
