/* =====================================================
   forms.js — light client-side handlers for testimonial and
   contact forms. Provides:
     - basic required-field validation
     - aria-live status messaging
     - testimonial preview append (no backend yet)
     - contact form: posts to the form's `action` if present,
       otherwise falls back to a `mailto:` link.
   To swap in a real backend later, set `action` on the <form>
   and (optionally) `data-endpoint="https://..."`.
   ===================================================== */
(function () {
  'use strict';

  function setStatus(form, message, isError) {
    const status = form.querySelector('.form__status');
    if (!status) return;
    status.textContent = message || '';
    status.classList.toggle('form__status--error', !!isError);
  }

  function validate(form) {
    let ok = true;
    form.querySelectorAll('[required]').forEach((field) => {
      const wrap = field.closest('.field');
      const empty = !String(field.value || '').trim();
      if (wrap) wrap.classList.toggle('field--invalid', empty);
      if (empty) ok = false;
    });
    return ok;
  }

  /* ---- Testimonial form ---- */
  function initTestimonialForm() {
    const form = document.querySelector('#testimonialForm');
    if (!form) return;
    const list = document.querySelector('#testimonialList');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validate(form)) {
        setStatus(form, 'Please fill out all required fields.', true);
        return;
      }
      const data = new FormData(form);
      const name = String(data.get('name') || '').trim();
      const message = String(data.get('message') || '').trim();

      if (list) {
        const node = document.createElement('article');
        node.className = 'testimonial';
        node.setAttribute('data-reveal', '');
        node.innerHTML =
          `<p class="testimonial__quote">${escapeHtml(message)}</p>` +
          `<cite class="testimonial__cite">${escapeHtml(name)}</cite>`;
        list.prepend(node);
        // Trigger reveal manually
        requestAnimationFrame(() => node.classList.add('is-visible'));
      }

      setStatus(form, 'Thank you for sharing your experience.', false);
      form.reset();
    });
  }

  /* ---- Contact form ---- */
  function initContactForm() {
    const form = document.querySelector('#contactForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validate(form)) {
        setStatus(form, 'Please complete the required fields.', true);
        return;
      }

      const endpoint = form.dataset.endpoint || form.getAttribute('action');
      const fallbackMail = form.dataset.mailto;

      // No backend yet → mailto fallback
      if (!endpoint && fallbackMail) {
        const data = new FormData(form);
        const subject = encodeURIComponent(
          `Project enquiry from ${data.get('name') || 'Greenverse visitor'}`
        );
        const body = encodeURIComponent(
          `Name: ${data.get('name') || ''}\n` +
          `Email: ${data.get('email') || ''}\n\n` +
          `${data.get('message') || ''}`
        );
        window.location.href = `mailto:${fallbackMail}?subject=${subject}&body=${body}`;
        setStatus(form, 'Opening your email client…', false);
        return;
      }

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          body: new FormData(form),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setStatus(form, 'Thanks — we will be in touch shortly.', false);
        form.reset();
      } catch (err) {
        console.error('[contact form] submission failed', err);
        setStatus(form, 'Something went wrong. Please email us directly.', true);
      }
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function init() {
    initTestimonialForm();
    initContactForm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
