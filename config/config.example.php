<?php
// Copy this file to config.php and fill in your details.
// config.php is git-ignored and never committed.
return [
    // Your Torn API key (Limited/read-only access is enough — this app only reads public data).
    'torn_api_key' => 'PUT_YOUR_TORN_API_KEY_HERE',

    // A Deals listing counts as a hit when its price is at least this many percent
    // below the item's average/market price.
    'threshold_percent' => 5,

    // How often (ms) the "Show Deals" loop checks the next watchlist item.
    // Torn's official API allows 100 calls/min per key; this keeps us well under that.
    'deals_poll_interval_ms' => 1100,

    // How often (ms) the "Show $1 Items" panel re-fetches the community $1 listing feed.
    // That feed is cached for 30-180s on weav3r.dev's side, so refreshing faster is wasted effort.
    'dollar_refresh_interval_ms' => 60000,
];
