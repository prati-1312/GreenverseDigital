/* =====================================================
   partials.js — tiny include system for static HTML.
   Looks for elements with `data-include="path/to/file.html"`
   and injects their HTML inline. Resolves paths relative to
   the page (so nested pages like /blog/post.html work too,
   provided the include path is correct relative to the page).
   Dispatches `partials:loaded` on the document when finished.
   ===================================================== */
(function () {
  'use strict';

  async function loadOne(el) {
    const url = el.getAttribute('data-include');
    if (!url) return;
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const html = await res.text();
      // Replace the placeholder element's children with the partial
      const tpl = document.createElement('template');
      tpl.innerHTML = html.trim();
      el.replaceWith(tpl.content);
    } catch (err) {
      console.error('[partials] failed to load', url, err);
      el.remove();
    }
  }

  function init() {
    const nodes = Array.from(document.querySelectorAll('[data-include]'));
    if (!nodes.length) {
      document.dispatchEvent(new CustomEvent('partials:loaded'));
      return;
    }
    Promise.all(nodes.map(loadOne)).then(() => {
      document.dispatchEvent(new CustomEvent('partials:loaded'));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
