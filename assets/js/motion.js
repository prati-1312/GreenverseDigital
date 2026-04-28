/* =====================================================
   motion.js — IntersectionObserver-driven reveal animations.
   Add `data-reveal` to any element to fade/slide it in once
   it enters the viewport. Optional `data-reveal-delay="120"`
   sets a per-element CSS delay (ms). Honors prefers-reduced-motion.
   ===================================================== */
(function () {
  'use strict';

  const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function reveal(el) {
    el.classList.add('is-visible');
  }

  function init() {
    const targets = document.querySelectorAll('[data-reveal]');
    if (!targets.length) return;

    if (REDUCE || !('IntersectionObserver' in window)) {
      targets.forEach(reveal);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const delay = el.dataset.revealDelay;
          if (delay) el.style.setProperty('--reveal-delay', `${delay}ms`);
          reveal(el);
          io.unobserve(el);
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.08 }
    );

    targets.forEach((t) => io.observe(t));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  // Re-run when partials add new content
  document.addEventListener('partials:loaded', init);
})();
