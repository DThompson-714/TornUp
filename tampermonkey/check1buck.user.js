// ==UserScript==
// @name         TornUp - $1 Bazaar Quick Check
// @namespace    tornup
// @version      1.1.0
// @description  On a bazaar page opened with ?Check1Buck=True, highlights every $1 item you can actually buy and closes (or flags) the tab if none are available to you.
// @match        https://www.torn.com/bazaar.php*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const TRIGGER_PARAM = 'Check1Buck';
  const MAX_WAIT_ATTEMPTS = 20;
  const WAIT_INTERVAL_MS = 300;
  const RESCAN_PASSES = 5;
  const RESCAN_INTERVAL_MS = 500;
  const CLOSE_FALLBACK_DELAY_MS = 300;

  function isActive() {
    const params = new URLSearchParams(window.location.search);
    const value = (params.get(TRIGGER_PARAM) || '').toLowerCase();
    return value === 'true' || value === '1';
  }

  function injectStyle() {
    const style = document.createElement('style');
    style.textContent = `
      .tornup-available {
        outline: 3px solid #22c55e !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.35) !important;
      }
      .tornup-badge {
        position: fixed;
        bottom: 16px;
        right: 16px;
        z-index: 999998;
        background: #1f2937;
        color: #fff;
        padding: 8px 14px;
        border-radius: 6px;
        font: 13px/1.4 system-ui, sans-serif;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
      }
      .tornup-badge--found {
        background: #166534;
      }
      .tornup-overlay {
        position: fixed;
        inset: 0;
        z-index: 999999;
        background: #7f1d1d;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 16px;
        font-family: system-ui, sans-serif;
        text-align: center;
        padding: 24px;
      }
      .tornup-overlay h1 {
        font-size: 28px;
        margin: 0;
      }
      .tornup-overlay p {
        font-size: 16px;
        font-weight: normal;
        margin: 0;
        max-width: 480px;
      }
    `;
    document.head.appendChild(style);
  }

  function findItemCards() {
    return Array.from(document.querySelectorAll('[data-testid="item"]'));
  }

  function isAvailable(card) {
    return !!card.querySelector('[data-testid="activate-buy-button"]');
  }

  function getPriceValue(card) {
    const priceEl = card.querySelector('[data-testid="price"]');
    if (!priceEl) return null;
    const digits = (priceEl.textContent || '').replace(/[^0-9]/g, '');
    return digits ? parseInt(digits, 10) : null;
  }

  function isDollarItem(card) {
    return getPriceValue(card) === 1;
  }

  function highlight(card) {
    card.classList.add('tornup-available');
  }

  function ensureBadge() {
    let badge = document.getElementById('tornup-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'tornup-badge';
      badge.className = 'tornup-badge';
      document.body.appendChild(badge);
    }
    return badge;
  }

  function updateBadge(count, done) {
    const badge = ensureBadge();
    if (count > 0) {
      badge.textContent = `${count} $1 item${count === 1 ? '' : 's'} available`;
      badge.classList.add('tornup-badge--found');
    } else {
      badge.textContent = done ? 'Nothing available here' : 'Scanning for $1 items…';
      badge.classList.remove('tornup-badge--found');
    }
  }

  function showNothingAvailableBanner() {
    const overlay = document.createElement('div');
    overlay.className = 'tornup-overlay';

    const h1 = document.createElement('h1');
    h1.textContent = 'NOTHING AVAILABLE HERE';

    const p = document.createElement('p');
    p.textContent = 'This tab tried to close itself automatically but your browser blocked it. You can close it now.';

    overlay.appendChild(h1);
    overlay.appendChild(p);
    document.body.appendChild(overlay);
  }

  const foundCards = new Set();

  function scanOnce() {
    const cards = findItemCards();
    const available = cards.filter((card) => isDollarItem(card) && isAvailable(card));
    available.forEach((card) => {
      if (!foundCards.has(card)) {
        foundCards.add(card);
        highlight(card);
      }
    });
    updateBadge(foundCards.size, false);
  }

  function finish() {
    if (foundCards.size > 0) {
      updateBadge(foundCards.size, true);
      const first = foundCards.values().next().value;
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    updateBadge(0, true);
    window.close();
    // Still here shortly after means the browser blocked the close
    // (it only allows closing tabs a script opened itself).
    setTimeout(() => {
      if (!document.hidden) showNothingAvailableBanner();
    }, CLOSE_FALLBACK_DELAY_MS);
  }

  function runRepeatedScan(pass) {
    pass = pass || 0;
    scanOnce();
    if (pass < RESCAN_PASSES) {
      setTimeout(() => runRepeatedScan(pass + 1), RESCAN_INTERVAL_MS);
      return;
    }
    finish();
  }

  function waitForItemsThenScan(attempt) {
    attempt = attempt || 0;
    const cards = findItemCards();
    if (cards.length > 0 || attempt >= MAX_WAIT_ATTEMPTS) {
      runRepeatedScan();
      return;
    }
    setTimeout(() => waitForItemsThenScan(attempt + 1), WAIT_INTERVAL_MS);
  }

  if (isActive()) {
    injectStyle();
    waitForItemsThenScan();
  }
})();
