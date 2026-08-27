(function () {
  'use strict';

  const DEFAULT_DEALS_POLL_MS = 1100;
  const DEFAULT_DOLLAR_REFRESH_MS = 60000;
  const MIN_DEALS_POLL_MS = 700;
  const MIN_DOLLAR_REFRESH_MS = 30000;
  const MAX_INTERVAL_MS = 3600000;
  const MAX_ROWS = 250;

  const el = {
    btnDollar: document.getElementById('btnDollar'),
    btnDeals: document.getElementById('btnDeals'),
    btnStop: document.getElementById('btnStop'),
    status: document.getElementById('status'),
    banner: document.getElementById('banner'),
    resultsBody: document.getElementById('resultsBody'),
    emptyState: document.getElementById('emptyState'),
    settingsToggle: document.getElementById('settingsToggle'),
    settingsPanel: document.getElementById('settingsPanel'),
    settingsClose: document.getElementById('settingsClose'),
    itemSearch: document.getElementById('itemSearch'),
    searchResults: document.getElementById('searchResults'),
    watchlist: document.getElementById('watchlist'),
    btnRefreshCatalog: document.getElementById('btnRefreshCatalog'),
    catalogStatus: document.getElementById('catalogStatus'),
    dealsIntervalInput: document.getElementById('dealsIntervalInput'),
    dollarIntervalInput: document.getElementById('dollarIntervalInput'),
    btnClearDismissed: document.getElementById('btnClearDismissed'),
  };

  let mode = null;
  let timer = null;
  let currentTick = null;
  let dealsIndex = 0;
  let dealsCount = 0;
  let resultsData = [];
  let sortState = { key: null, dir: 1 };
  let dealsPollMs = DEFAULT_DEALS_POLL_MS;
  let dollarRefreshMs = DEFAULT_DOLLAR_REFRESH_MS;

  function isDealKey(key) {
    return typeof key === 'string' && key.startsWith('deal:');
  }

  function loadDismissedDeals() {
    try {
      const raw = localStorage.getItem('tornup_dismissedDeals');
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveDismissedDeals() {
    try {
      localStorage.setItem('tornup_dismissedDeals', JSON.stringify([...dismissedDeals]));
    } catch (e) {
      // storage unavailable/full — dismiss state just won't persist this time
    }
  }

  let dismissedDeals = new Set(loadDismissedDeals());

  async function fetchJson(url, opts) {
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error((data && data.error) || `HTTP ${res.status}`);
    }
    return data;
  }

  function money(n) {
    if (n === null || n === undefined) return '—';
    return '$' + Math.round(n).toLocaleString();
  }

  function relTime(input) {
    if (!input) return '—';
    const t = typeof input === 'number' ? input * 1000 : Date.parse(input);
    if (Number.isNaN(t)) return '—';
    const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  }

  function setStatus(text) {
    el.status.textContent = text;
  }

  function setBanner(text) {
    if (!text) {
      el.banner.hidden = true;
      return;
    }
    el.banner.textContent = text;
    el.banner.hidden = false;
  }

  function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text ?? '';
    return d.innerHTML;
  }

  function itemMarketUrl(itemId) {
    return itemId
      ? `https://www.torn.com/page.php?sid=ItemMarket#/market/view=search&itemID=${itemId}`
      : null;
  }

  function clamp(n, min, max) {
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  function rowHtml(row) {
    const muted = row._key && dismissedDeals.has(row._key);

    const discountHtml = row.discountPercent !== undefined
      ? `<span class="discount-good">-${row.discountPercent}%</span>`
      : '—';

    const openHtml = row.url
      ? `<a class="open-link" href="${row.url}" target="_blank" rel="noopener noreferrer">Open ↗</a>`
      : '';

    const marketUrl = itemMarketUrl(row.itemId);
    const marketHtml = marketUrl
      ? `<a class="open-link" href="${marketUrl}" target="_blank" rel="noopener noreferrer">Market ↗</a>`
      : '';

    const dismissHtml = row._key
      ? `<button type="button" class="dismiss-btn" data-key="${escapeHtml(row._key)}" title="${muted ? 'Restore to active list' : (isDealKey(row._key) ? 'Mark as sold/unavailable' : 'Remove from this list')}">${muted ? '↺' : '✕'}</button>`
      : '';

    const links = [openHtml, marketHtml, dismissHtml].filter(Boolean).join('');
    const linksHtml = links ? `<span class="links-cell">${links}</span>` : '—';

    const mutedTag = muted ? '<span class="muted-tag">Sold?</span>' : '';

    return `
      <tr class="${row._fresh ? 'hit-fresh' : ''} ${muted ? 'row-muted' : ''}">
        <td>${escapeHtml(row.itemName)} ${mutedTag}</td>
        <td>${money(row.price)}</td>
        <td>${money(row.reference)}</td>
        <td>${discountHtml}</td>
        <td>${row.quantity ?? '—'}</td>
        <td>${row.seller ? escapeHtml(row.seller) : '—'}</td>
        <td>${relTime(row.updated)}</td>
        <td>${linksHtml}</td>
      </tr>
    `;
  }

  const SORT_ACCESSORS = {
    item: (r) => (r.itemName || '').toLowerCase(),
    price: (r) => r.price,
    reference: (r) => r.reference,
    discount: (r) => r.discountPercent,
    qty: (r) => r.quantity,
    seller: (r) => (r.seller || '').toLowerCase(),
    updated: (r) => {
      if (!r.updated) return null;
      const t = typeof r.updated === 'number' ? r.updated * 1000 : Date.parse(r.updated);
      return Number.isNaN(t) ? null : t;
    },
  };

  function isMissing(v) {
    return v === null || v === undefined || v === '';
  }

  function compareRows(a, b, key, dir) {
    const accessor = SORT_ACCESSORS[key];
    const av = accessor(a);
    const bv = accessor(b);
    const aMissing = isMissing(av);
    const bMissing = isMissing(bv);
    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  }

  function updateSortIndicators() {
    document.querySelectorAll('#resultsTable thead th[data-sort]').forEach((th) => {
      const ind = th.querySelector('.sort-ind');
      if (!ind) return;
      ind.textContent = th.dataset.sort === sortState.key ? (sortState.dir === 1 ? '▲' : '▼') : '';
    });
  }

  function renderResults() {
    let rows = resultsData;
    if (sortState.key) {
      rows = [...resultsData].sort((a, b) => compareRows(a, b, sortState.key, sortState.dir));
    }
    el.resultsBody.innerHTML = rows.map(rowHtml).join('');
    el.emptyState.hidden = rows.length > 0;
    resultsData.forEach((r) => { r._fresh = false; });
    updateSortIndicators();
  }

  function clearResults() {
    resultsData = [];
    renderResults();
  }

  function setResults(rows) {
    resultsData = rows.map((r) => ({ ...r, _fresh: true }));
    renderResults();
  }

  /**
   * Adds/updates hits. A row already present with identical price/quantity/
   * discount is a routine reconfirmation — updated in place with no reorder
   * or flash. Only a genuinely new row, or one whose numbers actually moved,
   * jumps to the top and flashes, so the list doesn't reshuffle every tick.
   */
  function addResults(rows) {
    let changed = false;
    rows.forEach((row) => {
      const idx = row._key ? resultsData.findIndex((r) => r._key === row._key) : -1;
      if (idx === -1) {
        resultsData.unshift({ ...row, _fresh: true });
        changed = true;
        return;
      }
      const existing = resultsData[idx];
      const materiallyChanged = existing.price !== row.price
        || existing.quantity !== row.quantity
        || existing.discountPercent !== row.discountPercent;
      if (materiallyChanged) {
        if (dismissedDeals.delete(row._key)) saveDismissedDeals();
        resultsData.splice(idx, 1);
        resultsData.unshift({ ...row, _fresh: true });
        changed = true;
      }
    });
    if (changed) resultsData = resultsData.slice(0, MAX_ROWS);
    return changed;
  }

  /** Drops any existing row for this item whose key isn't in this tick's valid set. */
  function pruneStaleForItem(itemId, validKeys) {
    const before = resultsData.length;
    const removedKeys = [];
    resultsData = resultsData.filter((r) => {
      if (r.itemId !== itemId || validKeys.has(r._key)) return true;
      removedKeys.push(r._key);
      return false;
    });
    let dismissChanged = false;
    removedKeys.forEach((k) => {
      if (dismissedDeals.delete(k)) dismissChanged = true;
    });
    if (dismissChanged) saveDismissedDeals();
    return resultsData.length !== before;
  }

  el.resultsBody.addEventListener('click', (e) => {
    const btn = e.target.closest('.dismiss-btn');
    if (!btn) return;
    const key = btn.dataset.key;
    if (!key) return;
    if (isDealKey(key)) {
      if (dismissedDeals.has(key)) {
        dismissedDeals.delete(key);
      } else {
        dismissedDeals.add(key);
      }
      saveDismissedDeals();
    } else {
      resultsData = resultsData.filter((r) => r._key !== key);
    }
    renderResults();
  });

  document.querySelectorAll('#resultsTable thead th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (sortState.key === key) {
        sortState.dir *= -1;
      } else {
        sortState.key = key;
        sortState.dir = 1;
      }
      renderResults();
    });
  });

  function setActiveButton() {
    el.btnDollar.classList.toggle('active', mode === 'dollar');
    el.btnDeals.classList.toggle('active', mode === 'deals');
    el.btnStop.disabled = mode === null;
  }

  function stopAll(message) {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    currentTick = null;
    mode = null;
    setActiveButton();
    setBanner(null);
    setStatus(message || 'Stopped.');
  }

  async function startDollar() {
    stopAll();
    mode = 'dollar';
    setActiveButton();
    clearResults();
    setBanner(
      'Torn’s API can’t tell us which $1 listings you personally can buy (some are locked to ' +
      'specific players). This is every current $1 bazaar listing the community feed knows about — ' +
      'click through and check in-game before making a trip.'
    );

    async function tick() {
      setStatus('Refreshing $1 bazaar listings…');
      try {
        const data = await fetchJson('api/dollar_items.php');
        setResults((data.items || []).map((it) => ({
          _key: `dollar:${it.itemId}:${it.sellerId}`,
          itemId: it.itemId,
          itemName: it.itemName,
          price: 1,
          reference: it.marketPrice,
          discountPercent: undefined,
          quantity: it.quantity,
          seller: it.sellerName,
          updated: it.lastUpdated,
          url: it.url,
        })));
        setStatus(`Showing ${(data.items || []).length} $1 listings · refreshed ${new Date().toLocaleTimeString()}`);
      } catch (e) {
        setStatus('Error: ' + e.message);
      }
    }

    currentTick = tick;
    await tick();
    timer = setInterval(tick, dollarRefreshMs);
  }

  async function startDeals() {
    stopAll();
    let wl;
    try {
      wl = await fetchJson('api/watchlist.php');
    } catch (e) {
      setStatus('Error loading watchlist: ' + e.message);
      return;
    }
    if (!wl.items || !wl.items.length) {
      alert('Add at least one item to your watchlist in Settings first.');
      return;
    }

    mode = 'deals';
    setActiveButton();
    clearResults();
    setBanner(
      'Bazaar-sourced hits below link to a specific seller but that data can lag a few minutes ' +
      '(community-synced, not live) — it may already be sold. Item Market hits are checked live.'
    );
    dealsIndex = 0;
    dealsCount = wl.items.length;

    async function tick() {
      try {
        const data = await fetchJson(`api/deals_scan.php?index=${dealsIndex}`);
        if (data.empty) {
          stopAll('Watchlist is empty.');
          return;
        }
        dealsIndex = (data.index + 1) % data.count;
        dealsCount = data.count;
        setStatus(`Checked ${data.item.name} (${data.index + 1}/${data.count}) · ${new Date().toLocaleTimeString()}`);

        const newRows = [];
        const validKeys = new Set();

        if (data.officialHit) {
          const key = `deal:${data.item.id}:itemmarket`;
          validKeys.add(key);
          newRows.push({
            _key: key,
            itemId: data.item.id,
            itemName: data.item.name,
            price: data.officialHit.price,
            reference: data.officialHit.averagePrice,
            discountPercent: data.officialHit.discountPercent,
            quantity: data.officialHit.quantityAvailable,
            seller: null,
            updated: null,
            url: data.officialHit.url,
          });
        }
        (data.communityHits || []).forEach((hit) => {
          const key = `deal:${data.item.id}:bazaar:${hit.sellerId ?? hit.sellerName ?? Math.random()}`;
          validKeys.add(key);
          newRows.push({
            _key: key,
            itemId: data.item.id,
            itemName: data.item.name,
            price: hit.price,
            reference: hit.referencePrice,
            discountPercent: hit.discountPercent,
            quantity: hit.quantity,
            seller: hit.sellerName,
            updated: null,
            url: hit.url,
          });
        });

        // A prior hit for this item that's no longer confirmed (price back up,
        // listing sold out, etc.) is stale — drop it rather than leave it showing.
        const pruned = pruneStaleForItem(data.item.id, validKeys);
        const added = addResults(newRows);
        if (pruned || added) renderResults();
      } catch (e) {
        setStatus('Error: ' + e.message);
      }
    }

    currentTick = tick;
    await tick();
    timer = setInterval(tick, dealsPollMs);
  }

  el.btnDollar.addEventListener('click', startDollar);
  el.btnDeals.addEventListener('click', startDeals);
  el.btnStop.addEventListener('click', () => stopAll('Stopped.'));

  // --- Settings panel ---

  function openSettings() {
    el.settingsPanel.hidden = false;
    loadWatchlist();
  }

  function closeSettings() {
    el.settingsPanel.hidden = true;
    el.searchResults.innerHTML = '';
    el.itemSearch.value = '';
  }

  el.settingsToggle.addEventListener('click', openSettings);
  el.settingsClose.addEventListener('click', closeSettings);
  el.settingsPanel.addEventListener('click', (e) => {
    if (e.target === el.settingsPanel) closeSettings();
  });

  async function loadWatchlist() {
    try {
      const wl = await fetchJson('api/watchlist.php');
      renderWatchlist(wl.items || []);
    } catch (e) {
      el.watchlist.innerHTML = `<li>Error: ${escapeHtml(e.message)}</li>`;
    }
  }

  function renderWatchlist(items) {
    el.watchlist.innerHTML = '';
    if (!items.length) {
      el.watchlist.innerHTML = '<li>No items yet — search above to add some.</li>';
      return;
    }
    items.forEach((item) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${escapeHtml(item.name)}</span>`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Remove';
      btn.addEventListener('click', async () => {
        await fetchJson(`api/watchlist.php?id=${item.id}`, { method: 'DELETE' });
        loadWatchlist();
      });
      li.appendChild(btn);
      el.watchlist.appendChild(li);
    });
  }

  let searchDebounce = null;
  el.itemSearch.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    const q = el.itemSearch.value.trim();
    searchDebounce = setTimeout(async () => {
      try {
        const data = await fetchJson(`api/catalog_search.php?q=${encodeURIComponent(q)}`);
        renderSearchResults(data.results || []);
      } catch (e) {
        el.searchResults.innerHTML = `<li>Error: ${escapeHtml(e.message)}</li>`;
      }
    }, 300);
  });

  function renderSearchResults(results) {
    el.searchResults.innerHTML = '';
    results.forEach((item) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${escapeHtml(item.name)}</span><span>${money(item.marketPrice)}</span>`;
      li.addEventListener('click', async () => {
        await fetchJson('api/watchlist.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id }),
        });
        el.itemSearch.value = '';
        el.searchResults.innerHTML = '';
        loadWatchlist();
      });
      el.searchResults.appendChild(li);
    });
  }

  el.btnClearDismissed.addEventListener('click', () => {
    dismissedDeals.clear();
    saveDismissedDeals();
    renderResults();
  });

  el.btnRefreshCatalog.addEventListener('click', async () => {
    el.btnRefreshCatalog.disabled = true;
    el.catalogStatus.textContent = 'Refreshing… this can take a little while.';
    try {
      const data = await fetchJson('api/catalog_refresh.php', { method: 'POST' });
      el.catalogStatus.textContent = `Loaded ${data.count} items.`;
    } catch (e) {
      el.catalogStatus.textContent = 'Error: ' + e.message;
    } finally {
      el.btnRefreshCatalog.disabled = false;
    }
  });

  // --- Check intervals ---

  function restartTimer(ms) {
    if (!timer) return;
    clearInterval(timer);
    timer = setInterval(currentTick, ms);
  }

  async function loadIntervalSettings() {
    let server = { dealsPollMs: DEFAULT_DEALS_POLL_MS, dollarRefreshMs: DEFAULT_DOLLAR_REFRESH_MS };
    try {
      server = await fetchJson('api/settings.php');
    } catch (e) {
      // config.php unreadable or similar — fall back to built-in defaults silently
    }

    const storedDeals = parseInt(localStorage.getItem('tornup_dealsPollMs'), 10);
    const storedDollar = parseInt(localStorage.getItem('tornup_dollarRefreshMs'), 10);

    dealsPollMs = clamp(
      Number.isFinite(storedDeals) ? storedDeals : server.dealsPollMs,
      MIN_DEALS_POLL_MS, MAX_INTERVAL_MS
    );
    dollarRefreshMs = clamp(
      Number.isFinite(storedDollar) ? storedDollar : server.dollarRefreshMs,
      MIN_DOLLAR_REFRESH_MS, MAX_INTERVAL_MS
    );

    el.dealsIntervalInput.value = dealsPollMs;
    el.dollarIntervalInput.value = dollarRefreshMs;
  }

  el.dealsIntervalInput.addEventListener('change', () => {
    const v = clamp(parseInt(el.dealsIntervalInput.value, 10), MIN_DEALS_POLL_MS, MAX_INTERVAL_MS);
    el.dealsIntervalInput.value = v;
    dealsPollMs = v;
    localStorage.setItem('tornup_dealsPollMs', String(v));
    if (mode === 'deals') restartTimer(v);
  });

  el.dollarIntervalInput.addEventListener('change', () => {
    const v = clamp(parseInt(el.dollarIntervalInput.value, 10), MIN_DOLLAR_REFRESH_MS, MAX_INTERVAL_MS);
    el.dollarIntervalInput.value = v;
    dollarRefreshMs = v;
    localStorage.setItem('tornup_dollarRefreshMs', String(v));
    if (mode === 'dollar') restartTimer(v);
  });

  loadIntervalSettings();
})();
