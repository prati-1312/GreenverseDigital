import fs from 'node:fs';
import MarkdownIt from 'markdown-it';
import { validateArticles, formatDate, readingMinutes, parseFrontmatter } from './scripts/content.mjs';

export default function (config) {
  const site = JSON.parse(fs.readFileSync('assets/data/site.json', 'utf8'));
  const navigation = JSON.parse(fs.readFileSync('assets/data/nav.json', 'utf8'));
  config.addGlobalData('site', site);
  config.addGlobalData('navigation', navigation);
  config.addGlobalData('buildYear', new Date().getUTCFullYear());
  config.setNunjucksEnvironmentOptions({ autoescape: true });
  config.setFrontMatterParsingOptions({ engines: { yaml: parseFrontmatter } });
  config.setLibrary('md', new MarkdownIt({ html: false, linkify: false }));
  config.addFilter('displayDate', formatDate);
  config.addFilter('readingMinutes', readingMinutes);
  config.addFilter('latestPostDate', (posts) => posts
    .map((post) => post.data.updatedOn || post.data.publishedOn)
    .sort().at(-1) || new Date().toISOString().slice(0, 10));
  config.addFilter('absoluteUrl', (path) => new URL(path, site.url).href);
  config.addFilter('jsonLd', (value) => JSON.stringify(value).replace(/</g, '\\u003c'));
  config.addCollection('posts', (collection) => collection.getFilteredByGlob('src/posts/*.md')
    .filter((post) => post.data.published === true)
    .sort((a, b) => b.data.publishedOn.localeCompare(a.data.publishedOn)));
  config.addCollection('publicPages', (collection) => collection.getAll()
    .filter((item) => !item.data.noindex && item.url && (item.url === '/' || item.url.endsWith('.html'))));
  config.on('eleventy.before', () => validateArticles());
  config.addPassthroughCopy({ 'assets/js': 'assets/js' });
  return {
    dir: { input: 'src', output: 'dist', includes: '_includes' },
    templateFormats: ['njk', 'md'],
    htmlTemplateEngine: 'njk',
    // Article body is content, never executable template code.
    markdownTemplateEngine: false
  };
}
