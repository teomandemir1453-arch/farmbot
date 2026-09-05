(function () {
  'use strict';

  var root = document.documentElement;
  var isTelegram = !!(window.Telegram && window.Telegram.WebApp);
  if (!isTelegram) return;

  root.classList.add('tg-miniapp');

  function updateSafeArea() {
    var webApp = window.Telegram && window.Telegram.WebApp;
    if (!webApp) return;

    var safe = webApp.safeAreaInset && Number(webApp.safeAreaInset.top) || 0;
    var content = webApp.contentSafeAreaInset && Number(webApp.contentSafeAreaInset.top) || 0;

    // Telegram can report 0 while the native Mini App header is still visible.
    // Keep the content safely below the native close/X area.
    var top = Math.max(56, safe, content);
    root.style.setProperty('--tg-top-safe', top + 'px');

    try {
      if (webApp.ready) webApp.ready();
    } catch (_) {}
  }

  updateSafeArea();
  setTimeout(updateSafeArea, 150);
  setTimeout(updateSafeArea, 700);

  window.addEventListener('resize', updateSafeArea, { passive: true });
  window.addEventListener('orientationchange', updateSafeArea, { passive: true });
})();
