import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import { parse as parseYaml } from 'yaml';
import { readArticle, validateArticle, validateArticles, readingMinutes, formatDate } from '../scripts/content.mjs';
import postDefaults from '../src/posts/posts.11tydata.js';

const source = fs.readFileSync('src/posts/why-you-need-social-media-manager.md', 'utf8');
const { data, content } = matter(source);
const filename = 'why-you-need-social-media-manager.md';

test('existing articles pass the shared publication schema', () => {
  assert.doesNotThrow(() => validateArticles());
  assert.equal(formatDate(data.publishedOn), 'June 21, 2025');
  assert.equal(readingMinutes('one two three'), 1);
  assert.equal(readingMinutes('word '.repeat(401)), 3);
});

test('CMS unquoted ISO dates are strings and non-YAML frontmatter is rejected', () => {
  for (const lineEnding of ['\n', '\r\n']) {
    const serialized = source.replace(/\r\n/g, '\n').replace(/\n/g, lineEnding)
      .replace('"2025-06-21"', '2025-06-21');
    const article = readArticle(serialized);
    assert.equal(article.data.publishedOn, '2025-06-21');
    assert.doesNotThrow(() => validateArticle(article.data, article.content, filename));
  }
  assert.throws(() => readArticle('---js\n{publishedOn: new Date()}\n---\nbody'));
});

test('rejects invalid dates, unstable slugs and executable build overrides', () => {
  for (const change of [
    { publishedOn: '2025-02-30' }, { slug: '../escape' }, { published: 'false' },
    { publishedOn: new Date() }, { updatedOn: '2024-01-01' }, { layout: 'unsafe.njk' },
    { hero: 'javascript:alert(1)' }, { hero: '/assets/uploads/../../source.png' }
  ]) {
    assert.throws(() => validateArticle({ ...data, ...change }, content, filename));
  }
});

test('drafts and missing publish flags produce no output or collection entries', () => {
  for (const published of [false, undefined, 'true']) {
    assert.equal(postDefaults.eleventyComputed.permalink({ ...data, published }), false);
    assert.equal(postDefaults.eleventyComputed.eleventyExcludeFromCollections({ ...data, published }), true);
  }
  assert.equal(postDefaults.eleventyComputed.permalink(data), `/blog/${data.slug}.html`);
});

test('article Markdown cannot execute HTML or JavaScript links', () => {
  const rendered = new MarkdownIt({ html: false }).render('<script>alert(1)</script>\n\n[x](javascript:alert(1))');
  assert.ok(!rendered.includes('<script>'));
  assert.ok(!rendered.includes('href="javascript:'));
});

test('Pages CMS fields match the article schema and default to unpublished', () => {
  const cms = parseYaml(fs.readFileSync('.pages.yml', 'utf8'));
  const collection = cms.content[0];
  assert.equal(collection.path, 'src/posts');
  assert.equal(collection.format, 'yaml-frontmatter');
  assert.equal(collection.filename, '{fields.slug}.md');
  assert.equal(collection.fields.find((field) => field.name === 'published').default, false);
  assert.equal(collection.fields.find((field) => field.name === 'body').options.format, 'markdown');
  assert.ok(!cms.media.extensions.includes('svg'));
  const fieldNames = new Set(collection.fields.map((field) => field.name));
  for (const key of Object.keys(data)) assert.ok(fieldNames.has(key), `${key} would be lost in the editor`);
});
