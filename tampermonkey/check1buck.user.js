// ==UserScript==
// @name         TornUp - $1 Bazaar Quick Check
// @namespace    tornup
// @version      1.0.0
// @description  On a bazaar page opened with ?Check1Buck=True, highlights any item you can actually buy and closes (or flags) the tab if none are available to you.
// @match        https://www.torn.com/bazaar.php*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const TRIGGER_PARAM = 'Check1Buck';
  const MAX_WAIT_ATTEMPTS = 20;
  const WAIT_INTERVAL_MS = 300;
  const SETTLE_DELAY_MS = 800;
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

  function highlight(card) {
    card.classList.add('tornup-available');
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

  function runScan() {
    const cards = findItemCards();
    const available = cards.filter(isAvailable);

    if (available.length > 0) {
      available.forEach(highlight);
      available[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    window.close();
    // Still here shortly after means the browser blocked the close
    // (it only allows closing tabs a script opened itself).
    setTimeout(() => {
      if (!document.hidden) showNothingAvailableBanner();
    }, CLOSE_FALLBACK_DELAY_MS);
  }

  function waitForItemsThenScan(attempt) {
    attempt = attempt || 0;
    const cards = findItemCards();
    if (cards.length > 0 || attempt >= MAX_WAIT_ATTEMPTS) {
      // give React a moment to finish rendering the rest of the list
      setTimeout(runScan, SETTLE_DELAY_MS);
      return;
    }
    setTimeout(() => waitForItemsThenScan(attempt + 1), WAIT_INTERVAL_MS);
  }

  if (isActive()) {
    injectStyle();
    waitForItemsThenScan();
  }
})();
