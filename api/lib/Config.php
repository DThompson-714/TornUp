<?php

function load_config(): array
{
    $path = __DIR__ . '/../../config/config.php';
    if (!file_exists($path)) {
        json_error(
            "Missing config/config.php. Copy config/config.example.php to config/config.php " .
            "and fill in your Torn API key.",
            500
        );
    }

    $config = require $path;
    if (!is_array($config) || empty($config['torn_api_key']) || $config['torn_api_key'] === 'PUT_YOUR_TORN_API_KEY_HERE') {
        json_error("config/config.php is missing a valid 'torn_api_key'.", 500);
    }

    return array_merge([
        'threshold_percent' => 5,
        'deals_poll_interval_ms' => 1100,
        'dollar_refresh_interval_ms' => 60000,
    ], $config);
}
