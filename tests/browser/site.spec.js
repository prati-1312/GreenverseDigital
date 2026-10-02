import { test, expect } from '@playwright/test';

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
  await page.goto('http://127.0.0.1:8080/blog.html');
  await expect(page.locator('header')).toBeVisible();
  await expect(page.locator('footer')).toBeVisible();
  await expect(page.locator('#primary-nav')).toBeVisible();
  await expect(page.locator('.card--post')).toHaveCount(2);
  for (const card of await page.locator('.card--post').all()) await expect(card).toHaveCSS('opacity', '1');
  await context.close();
});

test('representative routes reflow at every audited viewport width', async ({ page }) => {
  for (const route of ['/', '/contact.html', '/blog.html', '/blog/is-growing-sustainably-enough.html']) {
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
  await page.goto('/contact.html');
  await page.locator('#c-name').fill('Local validation');
  await page.locator('#c-email').fill('not-an-email');
  await page.locator('#c-message').fill('This local test must not send anything.');
  await page.locator('#contactForm button').click();
  await expect(page.locator('#c-email')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#c-email')).toBeFocused();
  await expect(page).toHaveURL(/\/contact.html$/);
});

test('testimonial preview explicitly does not submit and safely renders text', async ({ page }) => {
  await page.goto('/testimonials.html');
  await page.locator('#t-name').fill('Local preview');
  await page.locator('#t-message').fill('<img src=x onerror=alert(1)>');
  await page.locator('#testimonialForm button').click();
  await expect(page.locator('#testimonialForm .form__status')).toContainText(/not (sent|saved)|only|preview/i);
  await expect(page.locator('#testimonialList')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#testimonialList img')).toHaveCount(0);
});

test('nested article links and cover load from root; errors and aliases retain status', async ({ page, request }) => {
  await page.goto('/blog/why-you-need-social-media-manager.html');
  await expect(page.locator('.site-header__brand')).toHaveAttribute('href', '/');
  await expect(page.locator('.site-header__logo')).toHaveJSProperty('naturalWidth', 500);
  await page.goto('/case-studies.html');
  await expect(page.locator('.page-banner img')).toHaveJSProperty('naturalWidth', 1180);
  const moved = await request.get('/Testimonials.html', { maxRedirects: 0 });
  expect(moved.status()).toBe(301);
  const missing = await request.get('/missing-page');
  expect(missing.status()).toBe(404);
  expect(await missing.text()).toContain("This path didn't lead anywhere.");
});

test('journal text has AA contrast and article print mode removes controls', async ({ page }) => {
  await page.goto('/blog.html');
  const contrast = await page.locator('.card__link').first().evaluate((link) => {
    const luminance = (value) => {
      const channels = value.match(/[\d.]+/g).slice(0, 3).map(Number).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const a = luminance(getComputedStyle(link).color);
    const b = luminance(getComputedStyle(link.closest('.card')).backgroundColor);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  await page.goto('/blog/is-growing-sustainably-enough.html');
  await page.emulateMedia({ media: 'print', reducedMotion: 'reduce' });
  await expect(page.locator('.prose')).toBeVisible();
  await expect(page.locator('[data-print]')).not.toBeVisible();
  await expect(page.locator('.site-header')).not.toBeVisible();
});
