/* =====================================================
   effects.js — progressive enhancement layer
   - Scroll progress bar
   - Film-grain overlay injection
   - Magnetic buttons
   - 3D card tilt
   - Kinetic split-text (word-by-word reveal)
   - Animated stat counters (count-up on view)
   - Sticky index active-section highlight
   All effects honour prefers-reduced-motion.
   ===================================================== */
(function () {
  'use strict';

  const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- 1. Scroll progress bar ---- */
  function initScrollProgress() {
    if (document.querySelector('.scroll-progress')) return;
    const wrap = document.createElement('div');
    wrap.className = 'scroll-progress';
    wrap.setAttribute('aria-hidden', 'true');
    const bar = document.createElement('div');
    bar.className = 'scroll-progress__bar';
    wrap.appendChild(bar);
    document.body.prepend(wrap);

    const update = () => {
      const h = document.documentElement;
      const scrolled = h.scrollTop || document.body.scrollTop;
      const max = (h.scrollHeight - h.clientHeight) || 1;
      bar.style.width = Math.min(100, (scrolled / max) * 100) + '%';
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  /* ---- 2. Film-grain overlay ---- */
  function initGrain() {
    if (REDUCE) return;
    if (document.querySelector('.grain')) return;
    const g = document.createElement('div');
    g.className = 'grain';
    g.setAttribute('aria-hidden', 'true');
    document.body.appendChild(g);
  }

  /* ---- 3. Magnetic buttons ---- */
  function initMagnetic() {
    if (REDUCE) return;
    const els = document.querySelectorAll('[data-magnetic]');
    els.forEach((el) => {
      const strength = parseFloat(el.dataset.magnetic) || 18;
      const reset = () => {
        el.style.setProperty('--mx', '0px');
        el.style.setProperty('--my', '0px');
      };
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        const ratio = Math.min(1, Math.hypot(x, y) / (Math.max(r.width, r.height) / 1.2));
        el.style.setProperty('--mx', (x / r.width) * strength * (1 - ratio * 0.4) + 'px');
        el.style.setProperty('--my', (y / r.height) * strength * (1 - ratio * 0.4) + 'px');
      });
      el.addEventListener('pointerleave', reset);
      el.addEventListener('blur', reset);
    });
  }

  /* ---- 4. 3D card tilt ---- */
  function initTilt() {
    if (REDUCE) return;
    const els = document.querySelectorAll('[data-tilt]');
    els.forEach((el) => {
      const max = parseFloat(el.dataset.tiltMax) || 6;
      const reset = () => {
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      };
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        const ry = (px - 0.5) * 2 * max;
        const rx = (0.5 - py) * 2 * max;
        el.style.setProperty('--rx', rx.toFixed(2) + 'deg');
        el.style.setProperty('--ry', ry.toFixed(2) + 'deg');
      });
      el.addEventListener('pointerleave', reset);
    });
  }

  /* ---- 5. Kinetic split-text ----
     Wraps each word: <span class="kinetic__word"><span class="kinetic__inner">word</span></span>
     Reveals via IntersectionObserver, with per-word stagger. */
  function initKinetic() {
    const els = document.querySelectorAll('[data-kinetic]');
    if (!els.length) return;

    els.forEach((el) => {
      // Avoid re-wrapping
      if (el.classList.contains('kinetic')) return;
      el.classList.add('kinetic');

      const stagger = parseInt(el.dataset.kineticStagger || '60', 10);
      // Walk text nodes only — preserve inline children (e.g. <strong>, <span>)
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);

      let idx = 0;
      textNodes.forEach((node) => {
        const parts = node.nodeValue.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        parts.forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(part));
            return;
          }
          const word = document.createElement('span');
          word.className = 'kinetic__word';
          const inner = document.createElement('span');
          inner.className = 'kinetic__inner';
          inner.style.setProperty('--kinetic-delay', (idx * stagger) + 'ms');
          inner.textContent = part;
          word.appendChild(inner);
          frag.appendChild(word);
          idx += 1;
        });
        node.parentNode.replaceChild(frag, node);
      });
    });

    if (REDUCE || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.2 });
    els.forEach((el) => io.observe(el));
  }

  /* ---- 6. Count-up stats ---- */
  function initCounters() {
    const els = document.querySelectorAll('[data-count-to]');
    if (!els.length) return;

    const animate = (el) => {
      const target = parseFloat(el.dataset.countTo);
      if (isNaN(target)) return;
      if (REDUCE) { el.textContent = formatNum(target, el); return; }
      const dur = parseInt(el.dataset.countDuration || '1400', 10);
      const start = performance.now();
      const from = 0;
      const tick = (now) => {
        const t = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
        const value = from + (target - from) * eased;
        el.textContent = formatNum(value, el);
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const formatNum = (v, el) => {
      const decimals = parseInt(el.dataset.countDecimals || '0', 10);
      const prefix = el.dataset.countPrefix || '';
      const suffix = el.dataset.countSuffix || '';
      return prefix + v.toFixed(decimals) + suffix;
    };

    if (!('IntersectionObserver' in window)) { els.forEach(animate); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animate(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.4 });
    els.forEach((el) => io.observe(el));
  }

  /* ---- 8. Soft parallax ----
     Add data-parallax="0.15" (strength 0–1) to translate Y on scroll.
     Uses transform only — no layout thrash. */
  function initParallax() {
    if (REDUCE) return;
    const els = document.querySelectorAll('[data-parallax]');
    if (!els.length) return;
    const items = Array.from(els).map((el) => ({
      el,
      strength: Math.min(0.5, Math.max(0, parseFloat(el.dataset.parallax) || 0.15)),
    }));
    let ticking = false;
    const update = () => {
      const vh = window.innerHeight || 1;
      items.forEach(({ el, strength }) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        // Distance of element center from viewport center, normalised
        const offset = (r.top + r.height / 2 - vh / 2) / vh;
        el.style.setProperty('--py', (offset * strength * -60).toFixed(2) + 'px');
      });
      ticking = false;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  }

  /* ---- 10. Custom cursor ----
     Dot snaps to pointer; ring trails with easing.
     Disabled on touch / coarse pointer / reduced motion. */
  function initCursor() {
    if (REDUCE) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (document.querySelector('.cursor-dot')) return;

    const dot  = document.createElement('div');
    const ring = document.createElement('div');
    dot.className  = 'cursor-dot';
    ring.className = 'cursor-ring';
    document.body.appendChild(dot);
    document.body.appendChild(ring);
    document.documentElement.classList.add('cursor-on');

    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let rx = mx, ry = my;
    const SPEED = 0.18;

    window.addEventListener('pointermove', (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0) translate(-50%, -50%)`;
    }, { passive: true });

    const tick = () => {
      rx += (mx - rx) * SPEED;
      ry += (my - ry) * SPEED;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    const HOVER_SEL   = 'a, button, [data-cursor], input[type="submit"], .nav__link, .btn, .social-icons__link';
    const COMPACT_SEL = '.nav__link, .site-header__cta, .social-icons__link, .nav-toggle, [data-cursor-compact]';
    const onOver = (e) => {
      const t = e.target;
      if (t.closest(HOVER_SEL))   document.body.classList.add('is-cursor-hover');
      if (t.closest(COMPACT_SEL)) document.body.classList.add('is-cursor-compact');
    };
    const onOut = (e) => {
      const rel = e.relatedTarget;
      if (e.target.closest(HOVER_SEL) && !rel?.closest?.(HOVER_SEL)) {
        document.body.classList.remove('is-cursor-hover');
      }
      if (e.target.closest(COMPACT_SEL) && !rel?.closest?.(COMPACT_SEL)) {
        document.body.classList.remove('is-cursor-compact');
      }
    };
    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerout', onOut);
    document.addEventListener('pointerdown', () => document.body.classList.add('is-cursor-down'));
    document.addEventListener('pointerup',   () => document.body.classList.remove('is-cursor-down'));
    document.addEventListener('mouseleave',  () => { dot.style.opacity = ring.style.opacity = '0'; });
    document.addEventListener('mouseenter',  () => { dot.style.opacity = ring.style.opacity = '1'; });
  }

  /* ---- 9. Sticky-index active highlight ---- */
  function initStickyIndex() {
    const groups = document.querySelectorAll('[data-sticky-index]');
    if (!groups.length || !('IntersectionObserver' in window)) return;

    groups.forEach((group) => {
      const links = group.querySelectorAll('.sticky-index__item');
      const sections = Array.from(links)
        .map((l) => document.querySelector(l.getAttribute('href')))
        .filter(Boolean);
      if (!sections.length) return;

      const setActive = (id) => {
        links.forEach((l) => l.classList.toggle('is-active', l.getAttribute('href') === '#' + id));
      };

      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });

      sections.forEach((s) => io.observe(s));
    });
  }

  /* ---- Boot ---- */
  function init() {
    initScrollProgress();
    initGrain();
    initMagnetic();
    initTilt();
    initKinetic();
    initCounters();
    initParallax();
    initStickyIndex();
    initCursor();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  // Re-run when partials inject new DOM (cta-banner buttons, etc.)
  document.addEventListener('partials:loaded', () => {
    initMagnetic();
    initTilt();
  });
})();
