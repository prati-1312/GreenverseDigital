/* =====================================================
   nav.js — site header behaviour:
     - sticky scroll-state class
     - mobile menu open/close (a11y aware)
     - active link highlighting based on current page
   Depends on the header partial having:
     .site-header, .nav, .nav-toggle[aria-controls="primary-nav"]
   ===================================================== */
(function () {
  'use strict';

  function setupScrollState() {
    const header = document.querySelector('.site-header');
    if (!header) return;
    const onScroll = () => {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  function setupMobileToggle() {
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.querySelector('#primary-nav');
    if (!toggle || !nav) return;

    const close = () => {
      toggle.setAttribute('aria-expanded', 'false');
      nav.classList.remove('is-open');
      document.body.style.overflow = '';
    };
    const open = () => {
      toggle.setAttribute('aria-expanded', 'true');
      nav.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    };

    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      expanded ? close() : open();
    });

    // Close on link click (mobile)
    nav.querySelectorAll('a').forEach((a) =>
      a.addEventListener('click', () => close())
    );

    // Close on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });

    // Reset state when crossing breakpoint
    const mq = window.matchMedia('(min-width: 821px)');
    mq.addEventListener?.('change', () => close());
  }

  function setupActiveLink() {
    const links = document.querySelectorAll('.nav__link');
    if (!links.length) return;
    const here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    links.forEach((link) => {
      const target = (link.getAttribute('href') || '').split('/').pop().toLowerCase();
      if (target && target === here) {
        link.setAttribute('aria-current', 'page');
      }
    });
  }

  function init() {
    setupScrollState();
    setupMobileToggle();
    setupActiveLink();
  }

  // Run after partials inject the header
  document.addEventListener('partials:loaded', init);
  // Fallback if no partials are used on the page
  if (document.readyState !== 'loading') {
    setTimeout(() => {
      if (document.querySelector('.site-header')) init();
    }, 0);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.querySelector('.site-header')) init();
    });
  }
})();
