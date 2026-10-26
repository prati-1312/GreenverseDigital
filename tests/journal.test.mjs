import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { parse } from 'parse5';
import { elements, attributes, listFiles } from '../scripts/validate-output.mjs';
import { journalImage, journalWidths } from '../scripts/journal-images.mjs';
import { readArticle } from '../scripts/content.mjs';

test('journal and article covers use responsive local WebP with bounded payloads', async () => {
  const html = await fs.readFile('dist/blog/index.html', 'utf8');
  const images = elements(parse(html)).filter((node) => attributes(node).class === 'journal-story__image').map(attributes);
  const articles = await Promise.all((await fs.readdir('src/posts'))
    .filter((file) => file.endsWith('.md')).map(async (file) => readArticle(await fs.readFile(`src/posts/${file}`, 'utf8'))));
  assert.equal(images.length, articles.filter(({ data }) => data.published).length);
  assert.equal(images.filter((image) => image.fetchpriority === 'high').length, Math.min(1, images.length));
  assert.ok(images.slice(1).every((image) => image.loading === 'lazy'));
  let bytes = 0;
  let localCovers = 0;
  for (const image of images) {
    assert.equal(image.alt, '');
    assert.equal(image.srcset.split(', ').length, 4);
    if (!image.src.startsWith('/images/journal/')) continue;
    localCovers++;
    for (const candidate of image.srcset.split(', ')) {
      const [url, descriptor] = candidate.split(' ');
      const width = Number(descriptor.slice(0, -1));
      const metadata = await sharp(`dist${url}`).metadata();
      assert.equal(metadata.format, 'webp');
      assert.equal(metadata.width, width);
      assert.equal(metadata.height, width * 5 / 8);
      const size = (await fs.stat(`dist${url}`)).size;
      assert.ok(size < 180000, `${url}: ${size} bytes exceeds per-image budget`);
      bytes += size;
    }
  }
  assert.ok(bytes <= 275000 * localCovers, `Responsive journal assets total ${bytes} bytes`);
  const remote = journalImage('https://images.unsplash.com/photo-example?w=1400', 'example');
  assert.equal(remote.srcset.split(', ').length, journalWidths.length);
  assert.ok(remote.src.includes('w=1200'));
  assert.ok(remote.src.includes('h=750'));
});

test('public canonicals, navigation, sitemap and feed use clean URLs', async () => {
  for (const file of (await listFiles('dist')).filter((file) => file.endsWith('.html'))) {
    const nodes = elements(parse(await fs.readFile(file, 'utf8'))).map(attributes);
    const canonical = nodes.find((node) => node.rel === 'canonical');
    assert.ok(canonical, file);
    if (!file.endsWith('404.html')) assert.ok(!canonical.href.endsWith('.html'), file);
    for (const node of nodes) {
      if (node.href?.startsWith('/')) assert.ok(!node.href.includes('.html'), `${file}: ${node.href}`);
    }
  }
  for (const name of ['sitemap.xml', 'feed.xml']) {
    assert.ok(!(await fs.readFile(`dist/${name}`, 'utf8')).includes('.html'), name);
  }
});

test('journal and recommended story cards use a clear article label without sequence numbers', async () => {
  for (const file of (await listFiles('dist')).filter((file) => file.endsWith('.html'))) {
    const html = await fs.readFile(file, 'utf8');
    const nodes = elements(parse(html));
    const cards = nodes.filter((node) => attributes(node).class === 'journal-story__link');
    const labels = nodes.filter((node) => attributes(node).class === 'journal-story__label');
    assert.equal(labels.length, cards.length, file);
    for (const label of labels) {
      assert.equal(label.childNodes.map((node) => node.value || '').join('').trim(), 'Article', file);
    }
    assert.ok(!html.includes('/ Field notes'), file);
    assert.ok(!html.includes('journal-story__number'), file);
  }
});

test('cover overlay guarantees readable white text even over a white photograph', async () => {
  const css = await fs.readFile('assets/css/journal.css', 'utf8');
  assert.ok(css.includes('rgb(8 20 14 / .64)'));
  const luminance = [8, 20, 14].map((channel) => {
    const composite = (channel * .64 + 255 * .36) / 255;
    return composite <= .04045 ? composite / 12.92 : ((composite + .055) / 1.055) ** 2.4;
  });
  const background = luminance[0] * .2126 + luminance[1] * .7152 + luminance[2] * .0722;
  assert.ok(1.05 / (background + .05) >= 4.5);
});
