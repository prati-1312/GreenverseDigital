/* Local-only testimonial previews and contact email drafts; no network submission. */
(function () {
  'use strict';

  function setStatus(form, message, isError = false) {
    const status = form.querySelector('.form__status');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('form__status--error', isError);
  }

  function setupValidation(form) {
    const fields = Array.from(form.querySelectorAll('input, textarea, select'));
    const check = (field) => {
      field.setCustomValidity('');
      if (field.required && !field.value.trim()) {
        field.setCustomValidity('Please enter more than spaces.');
      }
      const invalid = !field.validity.valid;
      field.setAttribute('aria-invalid', String(invalid));
      field.closest('.field')?.classList.toggle('field--invalid', invalid);
      const error = document.getElementById(`${field.id}-error`);
      if (error) {
        error.textContent = invalid ? field.validationMessage : '';
        error.hidden = !invalid;
      }
      return !invalid;
    };
    fields.forEach((field) => {
      const errorId = `${field.id}-error`;
      let error = document.getElementById(errorId);
      if (!error) {
        error = document.createElement('p');
        error.id = errorId;
        error.className = 'field__error';
        error.hidden = true;
        field.after(error);
      }
      const descriptions = new Set((field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
      descriptions.add(errorId);
      field.setAttribute('aria-describedby', Array.from(descriptions).join(' '));
      field.addEventListener('input', () => {
        field.setCustomValidity('');
        if (field.getAttribute('aria-invalid') === 'true') check(field);
      });
      field.addEventListener('blur', () => {
        if (field.value || field.getAttribute('aria-invalid') === 'true') check(field);
      });
    });
    // Native constraints remain active without JS; enhanced validation adds field errors.
    form.noValidate = true;
    return () => {
      const invalid = fields.filter((field) => !check(field));
      if (!invalid.length) return true;
      setStatus(form, 'Please correct the highlighted fields.', true);
      invalid[0].focus();
      return false;
    };
  }

  function init() {
    document.querySelectorAll('#contactForm, #testimonialForm').forEach((form) => {
      if (form.dataset.formInitialized) return;
      form.dataset.formInitialized = 'true';
      const validate = setupValidation(form);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!validate()) return;
        const data = new FormData(form);
        const value = (name) => String(data.get(name) || '').trim();

        if (form.id === 'testimonialForm') {
          const list = document.querySelector('#testimonialList');
          if (!list) {
            setStatus(form, 'Preview is unavailable. Nothing was sent or saved. Use the Google Forms link to submit.', true);
            return;
          }
          const preview = document.createElement('article');
          preview.className = 'testimonial';
          const label = document.createElement('p');
          label.className = 't-meta';
          label.textContent = 'Your local preview — not sent or saved';
          const quote = document.createElement('p');
          quote.className = 'testimonial__quote';
          quote.textContent = value('message');
          const cite = document.createElement('cite');
          cite.className = 'testimonial__cite';
          cite.textContent = value('name');
          preview.append(label, quote, cite);
          list.prepend(preview);
          setStatus(form, 'Preview added on this page only — not sent or saved. It disappears when you reload. Use Google Forms to submit.');
          return;
        }

        const action = form.getAttribute('action') || '';
        const email = form.dataset.mailto || (action.startsWith('mailto:') ? action.slice(7) : '');
        if (form.dataset.endpoint || (action && !action.startsWith('mailto:'))) {
          setStatus(form, 'Online submission is not configured. Nothing was sent. Please email us directly.', true);
          return;
        }
        if (!/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(email)) {
          setStatus(form, 'The contact email is not configured. Nothing was sent. Please use the contact details on this page.', true);
          return;
        }
        const subject = encodeURIComponent(`Project enquiry from ${value('name')}`);
        const body = encodeURIComponent(
          `Name: ${value('name')}\nEmail: ${value('email')}\nOrganisation: ${value('organisation')}\n\n${value('message')}`
        );
        window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
        setStatus(form, 'Email draft requested — nothing has been sent by this website. Review and send it in your email app, or email us directly if no app opens.');
      });
      const previewButton = form.querySelector('[data-preview-submit]');
      if (previewButton) previewButton.disabled = false;
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
