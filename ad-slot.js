/*
  MICRO MONETIZE - ADSGRAM INTEGRATION
  AdsGram Interstitial UnitID: int-45961
  The ad is shown only inside Telegram Mini App and at natural game start breaks.
*/
(() => {
  const CONFIG = {
    provider: 'adsgram',
    blockId: 'int-45961',
    cooldownMs: 90000
  };

  window.MM_AD_CONFIG = CONFIG;

  let controller = null;
  let initPromise = null;

  function inTelegram() {
    const tg = window.Telegram?.WebApp;
    return !!(tg && tg.initData);
  }

  function init() {
    if (!inTelegram()) return Promise.resolve(null);
    if (controller) return Promise.resolve(controller);
    if (initPromise) return initPromise;

    initPromise = new Promise((resolve) => {
      const start = () => {
        try {
          if (window.Adsgram?.init) {
            controller = window.Adsgram.init({ blockId: CONFIG.blockId });
          }
        } catch (_) {
          controller = null;
        }
        resolve(controller);
      };

      if (window.Adsgram?.init) start();
      else {
        const script = document.createElement('script');
        script.src = 'https://sad.adsgram.ai/js/sad.min.js';
        script.async = true;
        script.onload = start;
        script.onerror = () => resolve(null);
        document.head.appendChild(script);
      }
    });

    return initPromise;
  }

  async function showInterstitial(force = false) {
    if (!inTelegram()) return { ok: false, skipped: true, reason: 'not-telegram' };

    const now = Date.now();
    const last = Number(sessionStorage.getItem('mm_adsgram_last') || 0);
    if (!force && now - last < CONFIG.cooldownMs) {
      return { ok: false, skipped: true, reason: 'cooldown' };
    }

    const ad = await init();
    if (!ad?.show) return { ok: false, skipped: true, reason: 'sdk-not-ready' };

    try {
      sessionStorage.setItem('mm_adsgram_last', String(now));
      const result = await ad.show();
      return { ok: true, result };
    } catch (error) {
      return { ok: false, error };
    }
  }

  window.MMAds = {
    init,
    showInterstitial,
    getController: () => controller,
    config: CONFIG
  };

  // Preload/initialize without displaying an ad.
  if (inTelegram()) init().catch(() => {});

  // Natural breakpoint: when a user starts a game.
  document.addEventListener('click', (event) => {
    const target = event.target?.closest?.('#startBtn, #play');
    if (!target) return;
    // Do not block game startup while the ad loads.
    showInterstitial().catch(() => {});
  }, true);
})();
