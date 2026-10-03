/* Content is visible until an observer successfully opts it into motion. */
(function () {
  'use strict';
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');

  function init() {
    const targets = document.querySelectorAll('[data-reveal]');
    if (!targets.length || preference.matches || !('IntersectionObserver' in window)) return;
    let observer;
    const reveal = (element) => {
      element.classList.remove('reveal-pending');
      element.classList.add('is-visible');
    };
    const finish = () => {
      targets.forEach(reveal);
      observer?.disconnect();
    };
    try {
      observer = new IntersectionObserver((entries) => {
        entries.forEach(({ target, isIntersecting }) => {
          if (!isIntersecting) return;
          reveal(target);
          observer.unobserve(target);
        });
      }, { threshold: 0.08 });
      targets.forEach((target) => {
        observer.observe(target);
        const delay = Math.max(0, Math.min(400, Number(target.dataset.revealDelay) || 0));
        target.style.setProperty('--reveal-delay', `${delay}ms`);
        target.classList.add('reveal-pending');
      });
      // Fail open even if an observer never delivers, or the tab is restored later.
      window.setTimeout(finish, 4000);
      preference.addEventListener('change', finish, { once: true });
    } catch {
      finish();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
