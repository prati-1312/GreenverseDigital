import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const pageSource = (name) => {
  const candidates = [`src/${name.toLowerCase()}.njk`, `src/${name}.njk`, `${name}.html`];
  const path = candidates.find((candidate) => existsSync(new URL(`../${candidate}`, import.meta.url)));
  assert.ok(path, `Missing source for ${name}`);
  return source(path);
};

function element(attributes = {}) {
  const classes = new Set();
  const handlers = new Map();
  return {
    dataset: {},
    hidden: false,
    inert: false,
    style: { setProperty() {} },
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
      toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
    },
    getAttribute: (name) => attributes[name] ?? null,
    setAttribute: (name, value) => { attributes[name] = value; },
    removeAttribute: (name) => { delete attributes[name]; },
    addEventListener(name, handler) {
      if (!handlers.has(name)) handlers.set(name, []);
      handlers.get(name).push(handler);
    },
    emit(name, event = {}) { handlers.get(name)?.forEach((handler) => handler(event)); },
    handlerCount: (name) => handlers.get(name)?.length || 0,
  };
}

test('mobile disclosure hides only after initialization, restores focus and resets on desktop', () => {
  const toggle = element({ 'aria-expanded': 'false' });
  const nav = element();
  const header = element();
  const blog = element({ href: '../blog.html' });
  const home = element({ href: '/' });
  const document = element();
  const window = element();
  const query = element();
  query.matches = true;
  window.matchMedia = () => query;
  window.scrollY = 0;
  document.readyState = 'complete';
  document.querySelector = () => header;
  header.querySelector = (selector) => selector === '.nav-toggle' ? toggle : nav;
  header.querySelectorAll = () => [home, blog];
  toggle.focus = () => { document.activeElement = toggle; };
  nav.contains = (target) => target === blog;
  const context = {
    document, window, URL,
    location: { pathname: '/blog/article.html', href: 'http://localhost/blog/article.html' },
  };
  assert.equal(nav.hidden, false);
  runInNewContext(source('assets/js/nav.js'), context);
  assert.equal(nav.hidden, true);
  assert.equal(nav.inert, true);
  assert.equal(blog.getAttribute('aria-current'), 'location');
  assert.equal(home.getAttribute('aria-current'), null);
  toggle.emit('click');
  assert.equal(nav.hidden, false);
  assert.equal(nav.inert, false);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(toggle.getAttribute('aria-label'), 'Close navigation menu');
  let prevented = false;
  document.emit('keydown', { key: 'Escape', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(nav.hidden, true);
  assert.equal(document.activeElement, toggle);
  assert.equal(toggle.getAttribute('aria-label'), 'Open navigation menu');
  query.matches = false;
  query.emit('change');
  assert.equal(nav.hidden, false);
  assert.equal(nav.inert, false);
  runInNewContext(source('assets/js/nav.js'), context);
  assert.equal(toggle.handlerCount('click'), 1);
  assert.equal(window.handlerCount('scroll'), 1);

  delete header.dataset.navInitialized;
  context.location.pathname = '/';
  context.location.href = 'http://localhost/';
  runInNewContext(source('assets/js/nav.js'), context);
  assert.equal(home.getAttribute('aria-current'), 'page');
  assert.equal(blog.getAttribute('aria-current'), null);
});

test('motion fails open without observers, when setup fails, and after its safety timeout', () => {
  for (const mode of ['missing', 'throws', 'silent', 'reduced']) {
    const target = element();
    const preference = element();
    preference.matches = mode === 'reduced';
    const timeouts = [];
    const document = { readyState: 'complete', querySelectorAll: () => [target] };
    const window = { matchMedia: () => preference, setTimeout: (callback) => timeouts.push(callback) };
    class Observer {
      observe() {
        assert.equal(target.classList.contains('reveal-pending'), false);
        if (mode === 'throws') throw new Error('Observer unavailable');
      }
      disconnect() {}
    }
    if (mode !== 'missing') window.IntersectionObserver = Observer;
    runInNewContext(source('assets/js/motion.js'), { window, document, IntersectionObserver: Observer });
    if (mode === 'silent') {
      assert.equal(target.classList.contains('reveal-pending'), true);
      timeouts.forEach((callback) => callback());
    }
    assert.equal(target.classList.contains('reveal-pending'), false, mode);
  }
});

test('form markup preserves native constraints and explicitly local-only behavior', () => {
  const contact = pageSource('contact');
  const testimonials = pageSource('Testimonials');
  assert.doesNotMatch(contact, /\bnovalidate\b/i);
  assert.doesNotMatch(testimonials, /\bnovalidate\b/i);
  assert.match(contact, /action="mailto:\{\{\s*site\.email\s*\}\}"/);
  assert.match(contact, /data-mailto="\{\{\s*site\.email\s*\}\}"/);
  assert.match(contact, /type="email"[^>]*required/);
  assert.match(contact, /Prepare email draft/);
  assert.match(testimonials, /disabled data-preview-submit/);
  assert.match(testimonials, /not sent or saved/);
  assert.match(testimonials, /https:\/\/forms\.gle\/jPgR4j9Kk19Zhc4i7/);
});

test('form handlers use constraints, accessible errors, safe text, and no network transport', () => {
  const forms = source('assets/js/forms.js');
  assert.match(forms, /field\.required && !field\.value\.trim\(\)/);
  assert.match(forms, /field\.validity\.valid/);
  assert.match(forms, /setAttribute\('aria-invalid'/);
  assert.match(forms, /setAttribute\('aria-describedby'/);
  assert.match(forms, /invalid\[0\]\.focus\(\)/);
  assert.match(forms, /Organisation: \$\{value\('organisation'\)\}/);
  assert.match(forms, /Online submission is not configured/);
  assert.match(forms, /quote\.textContent = value\('message'\)/);
  assert.doesNotMatch(forms, /fetch\(|XMLHttpRequest|sendBeacon|innerHTML|localStorage/);
});

test('contact submission rejects whitespace and constructs an encoded mailto draft with every field', () => {
  const form = element({ action: 'mailto:studio@example.test' });
  form.id = 'contactForm';
  const status = element();
  const errors = new Map();
  const document = { readyState: 'complete', activeElement: null };
  const values = {
    name: ' Ana & Ren\u00e9 + Partners? ',
    email: 'ana+draft@example.test',
    organisation: ' Moss & Co / R&D #1 ',
    message: ' Plan 50% reuse?\nLine two: a+b & c=#yes ',
  };
  const fields = Object.entries(values).map(([name, value]) => {
    const field = element({ 'aria-describedby': 'existing-hint' });
    const wrapper = element();
    Object.assign(field, {
      id: `c-${name}`,
      name,
      value,
      required: name !== 'organisation',
      validationMessage: '',
      setCustomValidity(message) { this.validationMessage = message; },
      closest: () => wrapper,
      after: (error) => errors.set(error.id, error),
      focus: () => { document.activeElement = field; },
    });
    Object.defineProperty(field, 'validity', {
      get: () => ({ valid: !field.validationMessage && (!field.required || field.value !== '') }),
    });
    return field;
  });
  form.querySelectorAll = () => fields;
  form.querySelector = (selector) => selector === '.form__status' ? status : null;
  document.querySelectorAll = () => [form];
  document.getElementById = (id) => errors.get(id);
  document.createElement = () => element();
  const destinations = [];
  const location = {};
  Object.defineProperty(location, 'href', { set: (value) => destinations.push(value) });
  class FormDataMock {
    constructor(submittedForm) {
      assert.equal(submittedForm, form);
      this.values = new Map(fields.map((field) => [field.name, field.value]));
    }
    get(name) { return this.values.get(name); }
  }
  runInNewContext(source('assets/js/forms.js'), {
    document,
    window: { location },
    FormData: FormDataMock,
    fetch: () => assert.fail('The draft handler must not send a network request'),
  });

  const submit = () => {
    let prevented = false;
    form.emit('submit', { preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
  };
  const name = fields.find((field) => field.name === 'name');
  const message = fields.find((field) => field.name === 'message');
  name.value = ' \t ';
  message.value = ' \n\t ';
  submit();
  assert.deepEqual(destinations, []);
  assert.equal(document.activeElement, name);
  for (const field of [name, message]) {
    assert.equal(field.getAttribute('aria-invalid'), 'true');
    assert.equal(field.getAttribute('aria-describedby'), `existing-hint ${field.id}-error`);
    assert.equal(errors.get(`${field.id}-error`).hidden, false);
    assert.match(errors.get(`${field.id}-error`).textContent, /more than spaces/);
  }

  name.value = values.name;
  message.value = values.message;
  submit();
  const subject = 'Project enquiry from Ana & Ren\u00e9 + Partners?';
  const body = 'Name: Ana & Ren\u00e9 + Partners?\nEmail: ana+draft@example.test\n' +
    'Organisation: Moss & Co / R&D #1\n\nPlan 50% reuse?\nLine two: a+b & c=#yes';
  assert.deepEqual(destinations, [
    `mailto:studio@example.test?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  ]);
  const draft = new URL(destinations[0]);
  assert.equal(draft.protocol, 'mailto:');
  assert.equal(draft.pathname, 'studio@example.test');
  assert.equal(draft.hash, '');
  assert.deepEqual([...draft.searchParams.keys()], ['subject', 'body']);
  assert.equal(draft.searchParams.get('subject'), subject);
  assert.equal(draft.searchParams.get('body'), body);
  for (const encoded of ['%20', '%26', '%2B', '%0A', '%23', '%25', '%C3%A9']) {
    assert.ok(destinations[0].includes(encoded), `Missing encoded ${encoded}`);
  }
  assert.equal(name.getAttribute('aria-invalid'), 'false');
  assert.equal(errors.get(`${name.id}-error`).hidden, true);
  assert.match(status.textContent, /nothing has been sent/);
});

test('enhancements avoid runtime partial bindings, body locks, and custom cursor loops', () => {
  for (const script of ['nav', 'forms', 'motion', 'effects']) {
    assert.doesNotMatch(source(`assets/js/${script}.js`), /partials:loaded/);
  }
  assert.doesNotMatch(source('assets/js/nav.js'), /body\.style\.overflow/);
  assert.doesNotMatch(source('assets/js/effects.js'), /initCursor|cursor-ring|cursor-dot/);
  assert.match(source('assets/css/components.css'), /\[data-reveal\]\s*\{\s*opacity: 1/);
  assert.doesNotMatch(source('assets/css/effects.css'), /cursor:\s*none/);
});

test('semantic text and focus tokens meet contrast on their intended surfaces', () => {
  const tokens = source('assets/css/tokens.css');
  const base = source('assets/css/base.css');
  const color = (css, token) => css.match(new RegExp(`--${token}:\\s*(#[\\da-f]{6})`, 'i'))[1];
  const luminance = (hex) => hex.slice(1).match(/../g).map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const contrast = (foreground, background) => {
    const values = [foreground, background].map(luminance).sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  };
  for (const surface of ['color-bg', 'color-surface', 'color-surface-alt']) {
    for (const text of ['color-clay-text', 'color-ink-muted', 'color-ink-soft']) {
      assert.ok(contrast(color(tokens, text), color(tokens, surface)) >= 4.5, `${text} on ${surface}`);
    }
    assert.ok(contrast(color(tokens, 'color-focus'), color(tokens, surface)) >= 3);
  }
  for (const text of ['color-clay-text', 'color-ink-muted', 'color-ink-soft']) {
    assert.ok(contrast(color(base, text), color(tokens, 'color-forest-deep')) >= 4.5, text);
  }
  assert.ok(contrast(color(base, 'color-focus'), color(tokens, 'color-forest-deep')) >= 3);
});

test('print styling exposes pending content and hides the print control', () => {
  const print = source('assets/css/base.css').split('@media print')[1];
  assert.ok(print);
  assert.match(print, /\[data-print\][^{]*\{\s*display: none !important/);
  assert.match(print, /\[data-reveal\]\.reveal-pending/);
  assert.match(print, /opacity: 1 !important/);
  assert.match(print, /transform: none !important/);
});
