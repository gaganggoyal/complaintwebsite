/* Install-to-home-screen + service worker registration.
 *
 * Shared by every page. The prompt UI is built here rather than in each HTML
 * file so the five pages cannot drift apart, and so a page that only wants the
 * offline behaviour costs one script tag.
 *
 * A page can place its own trigger anywhere by adding class="js-install" and
 * the hidden attribute; this script reveals those elements only when an install
 * is genuinely possible.
 */
(function () {
  'use strict';

  var LS_DISMISSED = 'cw-pwa-dismissed';
  var LS_INSTALLED = 'cw-pwa-installed';
  var SNOOZE_DAYS = 14;

  // ---------- environment ----------

  var standalone = matchMedia('(display-mode: standalone)').matches ||
                   matchMedia('(display-mode: minimal-ui)').matches ||
                   navigator.standalone === true;

  var ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac, so touch points are the giveaway.
  var isIOS = /iphone|ipad|ipod/i.test(ua) ||
              (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  // Chrome/Firefox/Edge on iOS are WebKit wrappers that cannot add to the home
  // screen at all — only Safari can, so only Safari gets the instructions.
  // navigator.standalone is Safari-only and is the check that keeps a Mac with
  // a touchscreen peripheral from being handed iPad instructions.
  var isIOSSafari = isIOS &&
                    typeof navigator.standalone !== 'undefined' &&
                    !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);

  var deferred = null;   // the captured beforeinstallprompt event
  var banner = null;
  var sheet = null;

  function store(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }
  function read(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }

  function snoozed() {
    if (read(LS_INSTALLED) === '1') return true;
    var at = parseInt(read(LS_DISMISSED) || '0', 10);
    return at > 0 && Date.now() - at < SNOOZE_DAYS * 864e5;
  }

  // ---------- service worker ----------

  if ('serviceWorker' in navigator) {
    addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function (e) {
        console.warn('sw registration failed:', e && e.message);
      });
    });
    // Deliberately no auto-reload on controllerchange: pages are fetched
    // network-first, so a new worker brings nothing a reload would add — and a
    // reload would wipe a half-filled registration form.
  }

  // ---------- injected UI ----------

  var CSS = [
    '#cwInstall,#cwIos{font-family:inherit;-webkit-tap-highlight-color:transparent}',
    '#cwInstall{position:fixed;left:12px;right:12px;z-index:95;display:none;',
      'background:#fff;border:1px solid #ede0d0;border-radius:18px;',
      'box-shadow:0 18px 44px rgba(40,28,16,.22);padding:13px 14px;',
      'align-items:center;gap:12px;max-width:520px;margin:0 auto;',
      'transform:translateY(16px);opacity:0;transition:transform .3s cubic-bezier(.22,1,.36,1),opacity .3s ease}',
    '#cwInstall.show{display:flex;transform:none;opacity:1}',
    '#cwInstall .ic{width:44px;height:44px;border-radius:13px;flex:0 0 auto;overflow:hidden;',
      'box-shadow:0 5px 14px rgba(236,95,34,.32)}',
    '#cwInstall .ic img{width:100%;height:100%;display:block}',
    '#cwInstall .tx{flex:1;min-width:0;line-height:1.35}',
    '#cwInstall .tx b{display:block;font-size:14.5px;font-weight:800;color:#163644;letter-spacing:-.2px}',
    '#cwInstall .tx span{display:block;font-size:12.5px;color:#5d6f7a;margin-top:1px}',
    '#cwInstall .go{flex:0 0 auto;border:0;cursor:pointer;font-family:inherit;font-weight:800;font-size:14px;',
      'color:#fff;background:linear-gradient(135deg,#ff7a33,#e85a18);border-radius:12px;padding:11px 16px;min-height:44px;',
      'box-shadow:0 6px 16px rgba(236,95,34,.34)}',
    '#cwInstall .go:active{transform:scale(.97)}',
    '#cwInstall .x{flex:0 0 auto;width:32px;height:32px;border:0;background:transparent;cursor:pointer;',
      'color:#98a8b1;font-size:20px;line-height:1;border-radius:9px;font-family:inherit}',
    '#cwInstall .x:hover{background:#f4efe8;color:#5d6f7a}',
    '@media(max-width:400px){#cwInstall .tx span{display:none}#cwInstall .go{padding:11px 14px}}',

    '#cwIos{position:fixed;inset:0;z-index:120;display:none}',
    '#cwIos.show{display:block}',
    '#cwIos .bd{position:absolute;inset:0;background:rgba(13,36,48,.55);opacity:0;transition:opacity .25s ease}',
    '#cwIos.show .bd{opacity:1}',
    '#cwIos .pn{position:absolute;left:0;right:0;bottom:0;background:#fff;',
      'border-radius:24px 24px 0 0;padding:22px 20px calc(24px + env(safe-area-inset-bottom));',
      'max-width:520px;margin:0 auto;transform:translateY(101%);transition:transform .32s cubic-bezier(.22,1,.36,1);',
      'max-height:88dvh;overflow-y:auto}',
    '#cwIos.show .pn{transform:none}',
    '#cwIos .gr{width:38px;height:4px;border-radius:4px;background:#e2d7c8;margin:0 auto 16px}',
    '#cwIos h3{font-size:19px;font-weight:800;color:#163644;letter-spacing:-.3px;margin:0 0 6px;line-height:1.3}',
    '#cwIos p{font-size:14px;color:#5d6f7a;margin:0 0 16px;line-height:1.6}',
    '#cwIos ol{list-style:none;margin:0 0 18px;padding:0;display:grid;gap:10px}',
    '#cwIos li{display:flex;gap:12px;align-items:center;background:#fbf7f1;border:1px solid #ede0d0;',
      'border-radius:14px;padding:12px 14px;font-size:14.5px;color:#1f2f38;line-height:1.45}',
    '#cwIos li .n{flex:0 0 auto;width:26px;height:26px;border-radius:8px;background:linear-gradient(145deg,#ff7a33,#e85a18);',
      'color:#fff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center}',
    '#cwIos li svg{width:17px;height:20px;flex:0 0 auto;vertical-align:-4px}',
    '#cwIos .ok{width:100%;min-height:50px;border:0;cursor:pointer;font-family:inherit;font-weight:800;font-size:15px;',
      'color:#fff;background:linear-gradient(135deg,#2a5a6e,#0d2430);border-radius:14px}'
  ].join('');

  var SHARE_SVG = '<svg viewBox="0 0 20 24" aria-hidden="true" fill="none">' +
    '<path d="M10 2.5v12" stroke="#0a84ff" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M6 6.2 10 2.2l4 4" stroke="#0a84ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M4.6 9.5H3.4v12h13.2v-12h-1.2" stroke="#0a84ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function injectStyles() {
    var s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function buildBanner() {
    var el = document.createElement('div');
    el.id = 'cwInstall';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Install app');
    el.innerHTML =
      '<div class="ic"><img src="/assets/brand/icon-192.png" alt="" width="44" height="44"></div>' +
      '<div class="tx">' +
        '<b class="l-en">Install Complaint.Website</b><b class="l-hi">Complaint.Website इंस्टॉल कीजिए</b>' +
        '<span class="l-en">One tap from your home screen</span>' +
        '<span class="l-hi">होम स्क्रीन से एक टैप में</span>' +
      '</div>' +
      '<button type="button" class="go"><span class="l-en">Install</span><span class="l-hi">इंस्टॉल</span></button>' +
      '<button type="button" class="x" aria-label="Not now">&times;</button>';
    document.body.appendChild(el);

    el.querySelector('.go').addEventListener('click', promptInstall);
    el.querySelector('.x').addEventListener('click', function () {
      store(LS_DISMISSED, String(Date.now()));
      hideBanner();
    });
    return el;
  }

  function buildSheet() {
    var el = document.createElement('div');
    el.id = 'cwIos';
    el.innerHTML =
      '<div class="bd"></div>' +
      '<div class="pn" role="dialog" aria-modal="true" aria-label="Add to Home Screen">' +
        '<div class="gr"></div>' +
        '<h3 class="l-en">Add Complaint.Website to your home screen</h3>' +
        '<h3 class="l-hi">Complaint.Website को होम स्क्रीन पर जोड़िए</h3>' +
        '<p class="l-en">It opens like an app — full screen, no address bar, and it works even on a weak connection.</p>' +
        '<p class="l-hi">यह app की तरह खुलेगा — पूरी स्क्रीन, कोई address bar नहीं, और कमज़ोर network में भी चलेगा।</p>' +
        '<ol>' +
          '<li><span class="n">1</span><span class="l-en">Tap the Share button ' + SHARE_SVG + ' in Safari\'s toolbar</span>' +
            '<span class="l-hi">Safari की toolbar में Share बटन ' + SHARE_SVG + ' दबाइए</span></li>' +
          '<li><span class="n">2</span><span class="l-en">Scroll down and choose <b>Add to Home Screen</b></span>' +
            '<span class="l-hi">नीचे scroll करके <b>Add to Home Screen</b> चुनिए</span></li>' +
          '<li><span class="n">3</span><span class="l-en">Tap <b>Add</b> — that\'s it</span>' +
            '<span class="l-hi"><b>Add</b> दबाइए — हो गया</span></li>' +
        '</ol>' +
        '<button type="button" class="ok"><span class="l-en">Got it</span><span class="l-hi">समझ गया</span></button>' +
      '</div>';
    document.body.appendChild(el);

    function close() {
      el.classList.remove('show');
      store(LS_DISMISSED, String(Date.now()));
    }
    el.querySelector('.bd').addEventListener('click', close);
    el.querySelector('.ok').addEventListener('click', close);
    addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && el.classList.contains('show')) close();
    });
    return el;
  }

  // Sit above the sticky WhatsApp/Register bar on the homepage instead of
  // covering it. Measured rather than hard-coded, since the bar is only
  // present below 760px and its height follows the font size.
  function positionBanner(el) {
    var bar = document.querySelector('.m-bottom');
    var h = bar && getComputedStyle(bar).display !== 'none' ? bar.offsetHeight : 0;
    el.style.bottom = h ? (h + 10) + 'px' : 'calc(14px + env(safe-area-inset-bottom))';
  }

  function showBanner() {
    if (snoozed() || standalone) return;
    if (!banner) banner = buildBanner();
    positionBanner(banner);
    requestAnimationFrame(function () { banner.classList.add('show'); });
  }

  function hideBanner() {
    if (banner) banner.classList.remove('show');
  }

  function showSheet() {
    if (!sheet) sheet = buildSheet();
    requestAnimationFrame(function () { sheet.classList.add('show'); });
  }

  function revealTriggers() {
    var list = document.querySelectorAll('.js-install');
    for (var i = 0; i < list.length; i++) list[i].hidden = false;
  }

  function hideTriggers() {
    var list = document.querySelectorAll('.js-install');
    for (var i = 0; i < list.length; i++) list[i].hidden = true;
  }

  function promptInstall() {
    if (deferred) {
      deferred.prompt();
      deferred.userChoice.then(function (choice) {
        if (choice && choice.outcome === 'accepted') {
          store(LS_INSTALLED, '1');
          hideTriggers();
        } else {
          // Chrome discards a prompt once used; a second call would throw.
          store(LS_DISMISSED, String(Date.now()));
        }
        deferred = null;
        hideBanner();
      });
      return;
    }
    if (isIOSSafari) showSheet();
  }

  // Wait for a sign of interest before asking. An install bar thrown up on
  // arrival is the thing people reflexively dismiss.
  function armBanner() {
    var fired = false;
    function go() {
      if (fired) return;
      fired = true;
      clearTimeout(timer);
      removeEventListener('scroll', onScroll);
      showBanner();
    }
    function onScroll() {
      var max = document.documentElement.scrollHeight - innerHeight;
      if (max > 0 && scrollY / max > 0.35) go();
    }
    var timer = setTimeout(go, 30000);
    addEventListener('scroll', onScroll, { passive: true });
  }

  // ---------- wiring ----------

  addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();          // keep Chrome's own mini-infobar out of the way
    deferred = e;
    revealTriggers();
    if (!snoozed()) armBanner();
  });

  addEventListener('appinstalled', function () {
    store(LS_INSTALLED, '1');
    deferred = null;
    hideBanner();
    hideTriggers();
  });

  function init() {
    injectStyles();
    if (standalone) { store(LS_INSTALLED, '1'); return; }

    // Delegate for triggers that exist in the page markup.
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('.js-install');
      if (!t) return;
      e.preventDefault();
      promptInstall();
    });

    // iOS never fires beforeinstallprompt, so its triggers are shown on the
    // strength of the browser check alone.
    if (isIOSSafari) {
      revealTriggers();
      if (!snoozed()) armBanner();
    }

    if (banner) positionBanner(banner);
    addEventListener('resize', function () { if (banner) positionBanner(banner); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
