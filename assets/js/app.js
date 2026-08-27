(function () {
  'use strict';

  const DEALS_POLL_MS = 1100;
  const DOLLAR_REFRESH_MS = 60000;
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
  };

  let mode = null;
  let timer = null;
  let dealsIndex = 0;
  let dealsCount = 0;

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

  function clearResults() {
    el.resultsBody.innerHTML = '';
    el.emptyState.hidden = false;
  }

  function addRow(row) {
    el.emptyState.hidden = true;
    const tr = document.createElement('tr');
    tr.className = 'hit-fresh';

    const discountHtml = row.discountPercent !== undefined
      ? `<span class="discount-good">-${row.discountPercent}%</span>`
      : '—';

    const linkHtml = row.url
      ? `<a class="open-link" href="${row.url}" target="_blank" rel="noopener noreferrer">Open ↗</a>`
      : '—';

    tr.innerHTML = `
      <td>${escapeHtml(row.itemName)}</td>
      <td>${money(row.price)}</td>
      <td>${money(row.reference)}</td>
      <td>${discountHtml}</td>
      <td>${row.quantity ?? '—'}</td>
      <td>${row.seller ? escapeHtml(row.seller) : '—'}</td>
      <td>${relTime(row.updated)}</td>
      <td>${linkHtml}</td>
    `;
    el.resultsBody.insertBefore(tr, el.resultsBody.firstChild);

    while (el.resultsBody.children.length > MAX_ROWS) {
      el.resultsBody.removeChild(el.resultsBody.lastChild);
    }
  }

  function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text ?? '';
    return d.innerHTML;
  }

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
        clearResults();
        (data.items || []).forEach((it) => {
          addRow({
            itemName: it.itemName,
            price: 1,
            reference: it.marketPrice,
            discountPercent: undefined,
            quantity: it.quantity,
            seller: it.sellerName,
            updated: it.lastUpdated,
            url: it.url,
          });
        });
        setStatus(`Showing ${(data.items || []).length} $1 listings · refreshed ${new Date().toLocaleTimeString()}`);
      } catch (e) {
        setStatus('Error: ' + e.message);
      }
    }

    await tick();
    timer = setInterval(tick, DOLLAR_REFRESH_MS);
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

        if (data.officialHit) {
          addRow({
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
          addRow({
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
      } catch (e) {
        setStatus('Error: ' + e.message);
      }
    }

    await tick();
    timer = setInterval(tick, DEALS_POLL_MS);
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
})();
