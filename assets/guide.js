/* complaint.website — guide pages.
 *
 * Deliberately not assets/auth.js: that file drives the dashboard and will
 * redirect to the login page on a 401, which would be a disaster on a page
 * someone reached from a search result.
 */
(function () {
  'use strict';

  window.setLang = function (l) {
    document.body.classList.toggle('hi', l === 'hi');
    document.documentElement.lang = l;
    try { localStorage.setItem('cw-lang', l); } catch (e) {}
    document.querySelectorAll('.lang-toggle button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.lang === l);
    });
  };

  document.addEventListener('DOMContentLoaded', function () {
    var stored = 'en';
    try { stored = localStorage.getItem('cw-lang') === 'hi' ? 'hi' : 'en'; } catch (e) {}
    window.setLang(stored);

    // Highlight the section being read. Cheap enough to skip entirely when
    // there is no sidebar (mobile collapses the contents into a <details>).
    var links = [].slice.call(document.querySelectorAll('.toc a'));
    if (!links.length || !('IntersectionObserver' in window)) return;

    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });

    var seen = new Set();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) seen.add(e.target.id); else seen.delete(e.target.id);
      });
      // Mark the topmost heading currently on screen, so scrolling back up
      // moves the marker up rather than leaving it on the furthest section.
      var current = null;
      Object.keys(byId).forEach(function (id) {
        if (!current && seen.has(id)) current = id;
      });
      links.forEach(function (a) {
        a.classList.toggle('on', a.getAttribute('href') === '#' + current);
      });
    }, { rootMargin: '-88px 0px -60% 0px' });

    Object.keys(byId).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) io.observe(el);
    });

    // Close the mobile contents panel once a link inside it is used.
    var m = document.querySelector('.toc-m');
    if (m) {
      m.addEventListener('click', function (e) {
        if (e.target.closest('a')) m.removeAttribute('open');
      });
    }
  });
})();
