<?php

/**
 * Small file-backed JSON store for the watchlist and item catalog cache.
 */
class Store
{
    public static function read(string $path, array $default): array
    {
        if (!file_exists($path)) {
            return $default;
        }
        $raw = file_get_contents($path);
        $data = json_decode($raw, true);
        return is_array($data) ? $data : $default;
    }

    public static function write(string $path, array $data): bool
    {
        $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        $fp = fopen($path, 'c');
        if (!$fp) {
            return false;
        }
        flock($fp, LOCK_EX);
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, $json);
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
        return true;
    }
}
