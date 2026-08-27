# TornUp

A personal Torn City dashboard with two views:

- **Show $1 Items** — every current $1 player-bazaar listing, sourced from
  [weav3r.dev](https://weav3r.dev)'s public `dollar-bazaars` feed. Refreshes
  automatically every 60 seconds while open.
- **Show Deals** — checks a watchlist of items you choose, one at a time
  (about once a second), and flags any Item Market or bazaar listing priced
  a configurable percentage (default 5%) below the item's average price.

Both link straight to the relevant Torn page so you can go buy.

## Important limitation

Torn's API has no way to tell us which $1 bazaar listings *you specifically*
are allowed to buy (some are locked to certain players by a mechanic Torn
doesn't document). The $1 list shows everything currently known — you'll
still need to glance at each one in-game before making a special trip.
Bazaar-sourced Deals hits come from a community-synced feed and can lag
reality by a few minutes, so those may already be sold too. Item Market
hits are checked live against the official API.

## Requirements

- Shared PHP hosting with the `curl` extension enabled (on by default almost
  everywhere) and Apache with `.htaccess` support. No database, no Node, no
  build step.
- A Torn API key. A **Limited** (read-only) key is enough — this app never
  writes anything to your Torn account.

## Deploy

1. Upload the whole contents of this repo to your hosting (e.g. `public_html/`
   or a subfolder) via FTP or your host's file manager.

2. Copy `config/config.example.php` to `config/config.php` and fill in your
   Torn API key:
   ```php
   'torn_api_key' => 'your key here',
   ```

3. **Set the password.** The whole site is protected by HTTP Basic Auth via
   `.htaccess`, since your API key lives server-side here and this will be a
   public URL.
   - **Easiest:** if your host's control panel (cPanel or similar) has a
     "Directory Privacy" / "Password Protect Directory" tool, use that on
     this folder instead of steps below — it writes `.htaccess` and
     `.htpasswd` for you correctly.
   - **Manual:** create a `.htpasswd` file (e.g. via `htpasswd -c .htpasswd
     yourusername` if you have shell access, or any online htpasswd
     generator), upload it *outside* the web root if your host allows that,
     then edit `.htaccess` in this repo and replace
     `/REPLACE/WITH/ABSOLUTE/PATH/TO/.htpasswd` with the real absolute
     server path your host gives you.

4. Make sure the `data/` folder is writable by PHP (`chmod 755` or `775`,
   depending on your host — try 755 first).

5. Visit the site, log in with the password you set, open **Settings**,
   and click **Refresh Item Catalog** once (needed so item names can be
   resolved to IDs). Then search for items to add to your Deals watchlist.

6. Click **Show $1 Items** or **Show Deals**.

## Rate limits

- Torn's official API allows 100 calls/min per key. The Deals loop polls
  about once per second (~55-60/min), leaving headroom.
- weav3r.dev's public API allows 100 calls/min via Cloudflare. We call it
  once per Deals tick (same cadence as above) plus once every 60s for the
  $1 feed — comfortably under that limit too.

## Project layout

```
index.html, assets/          front end (vanilla HTML/CSS/JS)
api/                         PHP endpoints, one file per action
api/lib/                     Torn + weav3r.dev API clients, JSON storage
config/config.php            your API key + tunables (git-ignored)
data/                        watchlist + item catalog cache (JSON files)
```
