/* Non-modal navigation disclosure; the built header stays usable without JS. */
(function () {
  'use strict';

  function init() {
    const header = document.querySelector('.site-header');
    if (!header || header.dataset.navInitialized) return;
    header.dataset.navInitialized = 'true';

    const toggle = header.querySelector('.nav-toggle');
    const nav = header.querySelector('#primary-nav');
    const mobile = window.matchMedia('(max-width: 820px)');
    if (toggle && nav) {
      const setOpen = (open, restoreFocus = false) => {
        const expanded = mobile.matches && open;
        toggle.setAttribute('aria-expanded', String(expanded));
        toggle.setAttribute('aria-label', expanded ? 'Close navigation menu' : 'Open navigation menu');
        nav.classList.toggle('is-open', expanded);
        nav.hidden = mobile.matches && !expanded;
        nav.inert = nav.hidden;
        if (restoreFocus) toggle.focus();
      };
      toggle.addEventListener('click', () => {
        setOpen(toggle.getAttribute('aria-expanded') !== 'true');
      });
      nav.addEventListener('click', (event) => {
        if (mobile.matches && event.target.closest('a')) setOpen(false, true);
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
          event.preventDefault();
          setOpen(false, true);
        }
      });
      const reset = () => setOpen(false, mobile.matches && nav.contains(document.activeElement));
      mobile.addEventListener('change', reset);
      setOpen(false);
      header.classList.add('nav-ready');
    }

    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const path = location.pathname.toLowerCase();
    const here = path.split('/').pop() || 'index.html';
    header.querySelectorAll('.nav__link').forEach((link) => {
      const target = new URL(link.getAttribute('href'), location.href).pathname.toLowerCase();
      const page = target.split('/').pop() || 'index.html';
      const article = page === 'blog.html' && /\/blog\//.test(path);
      if (page === here) link.setAttribute('aria-current', 'page');
      else if (article) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
