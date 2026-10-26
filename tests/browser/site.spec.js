import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { readArticle } from '../../scripts/content.mjs';

const publishedCount = fs.readdirSync('src/posts').filter((file) => file.endsWith('.md'))
  .map((file) => readArticle(fs.readFileSync(`src/posts/${file}`, 'utf8')))
  .filter(({ data }) => data.published).length;

test.beforeEach(async ({ context }) => {
  // Validation never contacts analytics, font, image, map or other external services.
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
});

test('mobile menu is a keyboard-accessible disclosure', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto('/');
  const toggle = page.locator('.nav-toggle');
  const nav = page.locator('#primary-nav');
  await expect(nav).not.toBeVisible();
  await toggle.focus();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement.closest('#primary-nav')))).toBe(false);
  await toggle.click();
  await expect(nav).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const geometry = await page.evaluate(() => ({
    navBottom: document.querySelector('#primary-nav').getBoundingClientRect().bottom,
    headerBottom: document.querySelector('.site-header').getBoundingClientRect().bottom,
    overflow: getComputedStyle(document.body).overflow
  }));
  expect(geometry.navBottom).toBeLessThanOrEqual(geometry.headerBottom + 1);
  expect(geometry.overflow).not.toBe('hidden');
  await page.keyboard.press('Tab');
  await expect(nav.locator('a').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(nav).not.toBeVisible();
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page.setViewportSize({ width: 1024, height: 700 });
  await expect(nav).toBeVisible();
});

test('essential content and mobile navigation survive JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 800 } });
  await context.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1'
    ? route.continue() : route.abort());
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:8080/blog/');
  await expect(page.locator('header')).toBeVisible();
  await expect(page.locator('footer')).toBeVisible();
  await expect(page.locator('#primary-nav')).toBeVisible();
  await expect(page.locator('.card--post')).toHaveCount(publishedCount);
  for (const card of await page.locator('.card--post').all()) await expect(card).toHaveCSS('opacity', '1');
  await context.close();
});

test('representative routes reflow at every audited viewport width', async ({ page }) => {
  for (const route of ['/', '/contact/', '/blog/', '/blog/is-growing-sustainably-enough/']) {
    await page.goto(route);
    for (const width of [320, 375, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const dimensions = await page.evaluate(() => {
        const footer = document.querySelector('.site-footer__top');
        return {
          page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          footer: footer.scrollWidth - footer.clientWidth
        };
      });
      expect(dimensions.page, `${route} at ${width}`).toBeLessThanOrEqual(1);
      expect(dimensions.footer, `footer ${route} at ${width}`).toBeLessThanOrEqual(1);
    }
  }
});

test('contact invalid email is rejected without sending or navigating', async ({ page }) => {
  await page.goto('/contact/');
  await page.locator('#c-name').fill('Local validation');
  await page.locator('#c-email').fill('not-an-email');
  await page.locator('#c-message').fill('This local test must not send anything.');
  await page.locator('#contactForm button').click();
  await expect(page.locator('#c-email')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#c-email')).toBeFocused();
  await expect(page).toHaveURL(/\/contact\/$/);
});

test('testimonial preview explicitly does not submit and safely renders text', async ({ page }) => {
  await page.goto('/testimonials/');
  await page.locator('#t-name').fill('Local preview');
  await page.locator('#t-message').fill('<img src=x onerror=alert(1)>');
  await page.locator('#testimonialForm button').click();
  await expect(page.locator('#testimonialForm .form__status')).toContainText(/not (sent|saved)|only|preview/i);
  await expect(page.locator('#testimonialList')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#testimonialList img')).toHaveCount(0);
});

test('nested article links and cover load from root; errors and aliases retain status', async ({ page, request }) => {
  await page.goto('/blog/why-you-need-social-media-manager/');
  await expect(page.locator('.site-header__brand')).toHaveAttribute('href', '/');
  await expect(page.locator('.site-header__logo')).toHaveJSProperty('naturalWidth', 500);
  await page.goto('/case-studies/');
  await expect(page.locator('.page-banner img')).toHaveJSProperty('naturalWidth', 1180);
  const moved = await request.get('/Testimonials.html', { maxRedirects: 0 });
  expect(moved.status()).toBe(301);
  for (const route of ['/blog', '/blog.html']) {
    const journal = await request.get(route, { maxRedirects: 0 });
    expect(journal.status()).toBe(301);
    expect(journal.headers().location).toBe('/blog/');
  }
  const missing = await request.get('/missing-page');
  expect(missing.status()).toBe(404);
  expect(await missing.text()).toContain("This path didn't lead anywhere.");
});

test('journal text has AA contrast and article print mode removes controls', async ({ page }) => {
  await page.goto('/blog/');
  const contrast = await page.locator('.journal-story__link').first().evaluate((link) => {
    const luminance = (value) => {
      const channels = value.match(/[\d.]+/g).slice(0, 3).map(Number).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const a = luminance(getComputedStyle(link).color);
    const b = luminance(getComputedStyle(link).backgroundColor);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  await page.goto('/blog/is-growing-sustainably-enough/');
  await page.emulateMedia({ media: 'print', reducedMotion: 'reduce' });
  await expect(page.locator('.prose')).toBeVisible();
  await expect(page.locator('[data-print]')).not.toBeVisible();
  await expect(page.locator('.site-header')).not.toBeVisible();
});

test('clean page and article URLs retain legacy redirects, queries and real 404s', async ({ request }) => {
  for (const route of ['about', 'services', 'case-studies', 'blog', 'contact', 'testimonials', 'blog/why-you-need-social-media-manager']) {
    const clean = `/${route}/`;
    const legacy = await request.get(`/${route}.html?from=archive`, { maxRedirects: 0 });
    expect(legacy.status()).toBe(301);
    expect(legacy.headers().location).toBe(`${clean}?from=archive`);
    const unslashed = await request.get(`/${route}`, { maxRedirects: 0 });
    expect(unslashed.status()).toBe(301);
    expect(unslashed.headers().location).toBe(clean);
    const nestedIndex = await request.get(`${clean}index.html`, { maxRedirects: 0 });
    expect(nestedIndex.status()).toBe(301);
    expect(nestedIndex.headers().location).toBe(clean);
    expect((await request.get(clean)).status()).toBe(200);
  }
  expect((await request.get('/blog/not-published/')).status()).toBe(404);
  const oldArticle = await request.get('/blog/blog/is-growing-sustainably-enough.html', { maxRedirects: 0 });
  expect(oldArticle.headers().location).toBe('/blog/is-growing-sustainably-enough/');
});

test('journal cards are keyboard-operable, load local media and disable motion on request', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/blog/');
  const cards = page.locator('.journal-story__link');
  await expect(cards).toHaveCount(publishedCount);
  for (const card of await cards.all()) {
    await card.scrollIntoViewIfNeeded();
    const image = card.locator('img');
    await expect.poll(() => image.evaluate((el) => el.naturalWidth)).toBeGreaterThan(0);
    await expect(image).toHaveCSS('animation-name', 'none');
    await expect(image).toHaveCSS('transform', 'none');
    await card.focus();
    await expect(card).toBeFocused();
    await expect(card).toHaveCSS('outline-style', 'solid');
  }
  const first = cards.first();
  const destination = await first.getAttribute('href');
  await first.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`${destination}$`));
  await expect(page.locator('.article-cover h1')).toBeVisible();
  await expect(page.locator('.article-cover img')).toHaveAttribute('srcset', /480w.*800w.*1200w.*1920w/);
});

test('navigation selects only the current page or article section with and without JavaScript', async ({ browser }) => {
  const routes = ['/', '/about/', '/services/', '/case-studies/', '/blog/', '/testimonials/', '/contact/',
    '/blog/is-growing-sustainably-enough/', '/blog/why-you-need-social-media-manager/'];
  for (const javaScriptEnabled of [true, false]) {
    const context = await browser.newContext({ javaScriptEnabled, viewport: { width: 1440, height: 900 } });
    await context.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue() : route.abort());
    const page = await context.newPage();
    for (const route of routes) {
      await page.goto(`http://127.0.0.1:8080${route}`);
      const current = page.locator('#primary-nav [aria-current]');
      await expect(current, `${route}, JavaScript=${javaScriptEnabled}`).toHaveCount(1);
      const article = route.startsWith('/blog/') && route !== '/blog/';
      await expect(current).toHaveAttribute('href', article ? '/blog/' : route);
      await expect(current).toHaveAttribute('aria-current', article ? 'location' : 'page');
      const highlighted = await page.locator('.nav__link').evaluateAll((links) => links
        .filter((link) => getComputedStyle(link).backgroundColor === 'rgb(217, 242, 107)').length);
      expect(highlighted).toBe(route === '/contact/' ? 0 : 1);
    }
    await page.goto('http://127.0.0.1:8080/unknown/');
    await expect(page.locator('#primary-nav [aria-current]')).toHaveCount(0);
    await context.close();
  }
});

test('story frames visibly settle as they enter the viewport and stop for keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/blog/');
  test.skip(!await page.evaluate(() => CSS.supports('animation-timeline: view()')), 'Scroll timelines unavailable');
  const story = page.locator('.journal-stories__stack > .journal-story').last();
  const top = await story.evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
  const stateAt = async (position) => {
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), position);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    return story.evaluate((element) => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
      return {
        scale: matrix.a,
        y: matrix.f,
        radius: parseFloat(getComputedStyle(element.querySelector('.journal-story__link')).borderTopLeftRadius)
      };
    });
  };
  const entering = await stateAt(top - 780);
  const settled = await stateAt(top - 80);
  expect(settled.scale - entering.scale).toBeGreaterThan(.01);
  expect(entering.y - settled.y).toBeGreaterThan(5);
  expect(entering.radius - settled.radius).toBeGreaterThan(5);
  expect(settled.scale).toBeCloseTo(1, 2);
  await story.locator('a').focus();
  await expect(story).toHaveCSS('animation-name', 'none');
  await expect(story).toHaveCSS('transform', 'none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(story.locator('.journal-story__link')).toHaveCSS('animation-name', 'none');
  await expect(story.locator('img')).toHaveCSS('animation-name', 'none');
});

test('newsletter note is right-aligned below its form at desktop and phone widths', async ({ page }) => {
  await page.goto('/blog/');
  const note = page.locator('#newsletter-note');
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(note).toHaveCSS('text-align', 'right');
    const positions = await page.evaluate(() => {
      const note = document.querySelector('#newsletter-note').getBoundingClientRect();
      const form = document.querySelector('.site-footer__newsletter-form').getBoundingClientRect();
      return { noteRight: note.right, formRight: form.right, noteTop: note.top, formBottom: form.bottom };
    });
    expect(Math.abs(positions.noteRight - positions.formRight)).toBeLessThanOrEqual(1);
    expect(positions.noteTop).toBeGreaterThanOrEqual(positions.formBottom);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  }
});
