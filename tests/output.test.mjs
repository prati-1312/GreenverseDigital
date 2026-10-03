import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { validateOutput, listFiles, elements, attributes } from '../scripts/validate-output.mjs';
import { parse } from 'parse5';

test('release has working case-sensitive links, canonicals and no source artifacts or telemetry', async () => {
  const result = await validateOutput();
  assert.equal(result.sitemapEntries, 9);
  assert.equal(result.pages, 11);
  const files = await listFiles('dist');
  assert.ok(!files.some((file) => /BLOG 1|\.DS_Store|\.pages\.yml|partials\.js/.test(file)));
});

test('journal and articles use identical generated publication metadata', async () => {
  const journal = await fs.readFile('dist/blog.html', 'utf8');
  for (const slug of ['why-you-need-social-media-manager', 'is-growing-sustainably-enough']) {
    const article = await fs.readFile(`dist/blog/${slug}.html`, 'utf8');
    const date = article.match(/<time datetime="([^"]+)"/)[1];
    assert.ok(journal.includes(`datetime="${date}"`));
    assert.ok(journal.includes(`/blog/${slug}.html`));
    assert.ok(article.includes('aria-current="location"'));
    assert.ok(!article.includes('/blog/images/'));
  }
  assert.ok(!journal.includes('December 16, 2025'));
});

test('media has truthful encoding and smaller derivatives', async () => {
  assert.equal((await sharp('dist/images/Logo.jpg').metadata()).format, 'jpeg');
  assert.equal((await sharp('dist/images/Founder.webp').metadata()).format, 'webp');
  assert.equal((await sharp('dist/images/greenversedigitalcover.webp').metadata()).width, 1180);
  assert.ok((await fs.stat('dist/images/greenversedigitalcover.webp')).size < 1900187);
  assert.ok((await fs.stat('dist/images/Founder.webp')).size < 760310);
});

test('runtime includes and analytics do not remain in source templates', async () => {
  for (const file of await listFiles('src')) {
    const text = await fs.readFile(file, 'utf8');
    assert.ok(!/googletagmanager|google-analytics|dataLayer|data-include=/.test(text), file);
  }
});

test('CSP requires local executable scripts and generated pages contain none inline', async () => {
  const policy = await fs.readFile('dist/.htaccess', 'utf8');
  assert.ok(policy.includes("script-src 'self'"));
  assert.ok(!policy.includes('report-uri'));
  for (const file of (await listFiles('dist')).filter((file) => file.endsWith('.html'))) {
    const scripts = elements(parse(await fs.readFile(file, 'utf8'))).filter((node) => node.tagName === 'script');
    assert.ok(scripts.every((node) => attributes(node).src?.startsWith('/assets/js/')));
  }
});
