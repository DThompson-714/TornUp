<?php

/**
 * Minimal cURL GET-JSON helper shared by the Torn and weav3r.dev clients.
 * Returns the decoded body on success, or null on any transport/JSON error.
 */
function http_get_json(string $url, int $timeoutSec = 10): ?array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => $timeoutSec,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
        CURLOPT_USERAGENT => 'TornUp/1.0 (personal dashboard)',
    ]);
    $body = curl_exec($ch);
    $errno = curl_errno($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($errno !== 0 || $body === false || $status < 200 || $status >= 300) {
        return null;
    }

    $data = json_decode($body, true);
    return is_array($data) ? $data : null;
}
