import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { parse as parseYaml } from 'yaml';

export function parseFrontmatter(source) {
  return parseYaml(source.replace(/\r\n?/g, '\n'));
}

export function readArticle(source) {
  if (!/^---\r?\n/.test(source)) throw new Error('Article must start with YAML frontmatter (---)');
  // YAML 1.2 keeps CMS-serialized ISO dates as strings, whether quoted or not.
  return matter(source, { engines: { yaml: parseFrontmatter } });
}

export function formatDate(value) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC'
  }).format(new Date(`${value}T00:00:00Z`));
}

export function readingMinutes(content) {
  const words = content.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
}

export function validateArticle(data, content, filename) {
  const fail = (message) => { throw new Error(`${filename}: ${message}`); };
  const allowed = new Set([
    'title', 'seoTitle', 'description', 'excerpt', 'slug', 'author',
    'publishedOn', 'updatedOn', 'published', 'hero', 'heroAlt', 'body'
  ]);
  for (const key of Object.keys(data)) {
    if (!allowed.has(key)) fail(`unsupported field "${key}"; do not put build settings in content`);
  }
  for (const field of ['title', 'description', 'excerpt', 'slug', 'author', 'publishedOn', 'hero', 'heroAlt']) {
    if (typeof data[field] !== 'string' || !data[field].trim()) fail(`${field} is required`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)) fail('slug must be lowercase words separated by hyphens');
  if (path.basename(filename, '.md') !== data.slug) fail('filename must match slug; published URLs must stay stable');
  if (typeof data.published !== 'boolean') fail('published must be explicitly true or false');
  if (!validDate(data.publishedOn)) fail('publishedOn must be a YYYY-MM-DD date');
  if (data.updatedOn && (!validDate(data.updatedOn) || data.updatedOn < data.publishedOn)) {
    fail('updatedOn must be a valid date on or after publication');
  }
  for (const field of ['seoTitle', 'updatedOn']) {
    if (data[field] !== undefined && typeof data[field] !== 'string') fail(`${field} must be text`);
  }
  if (!content.trim()) fail('article body cannot be empty');
  if (data.hero.startsWith('/assets/uploads/')) {
    if (!/^\/assets\/uploads\/[a-zA-Z0-9/_-]+\.(?:jpe?g|png|webp|avif)$/.test(data.hero)) {
      fail('uploaded hero must be a supported image with a safe filename');
    }
    if (!fs.existsSync(data.hero.slice(1))) fail('uploaded hero does not exist');
  } else {
    let url;
    try { url = new URL(data.hero); } catch { fail('hero must be an uploaded image or HTTPS URL'); }
    // Existing Unsplash assets are retained; new uploads use the repository media library.
    if (url.protocol !== 'https:' || url.hostname !== 'images.unsplash.com') {
      fail('remote hero must use the existing images.unsplash.com host');
    }
  }
}

export function validateArticles(directory = 'src/posts') {
  const files = fs.readdirSync(directory).filter((name) => name.endsWith('.md'));
  const slugs = new Set();
  for (const filename of files) {
    const { data, content } = readArticle(fs.readFileSync(path.join(directory, filename), 'utf8'));
    validateArticle(data, content, filename);
    if (slugs.has(data.slug)) throw new Error(`Duplicate article slug: ${data.slug}`);
    slugs.add(data.slug);
  }
}
