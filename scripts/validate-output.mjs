import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'parse5';
import { fileURLToPath } from 'node:url';

export async function listFiles(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are not publishable: ${filename}`);
    if (entry.isDirectory()) files.push(...await listFiles(filename));
    else files.push(filename);
  }
  return files;
}

export function elements(node, result = []) {
  if (node.tagName) result.push(node);
  for (const child of node.childNodes || []) elements(child, result);
  return result;
}

export function attributes(node) {
  return Object.fromEntries((node.attrs || []).map(({ name, value }) => [name, value]));
}

export async function validateOutput(directory = 'dist') {
  const files = await listFiles(directory);
  const relative = (file) => path.relative(directory, file).split(path.sep).join('/');
  const filenames = new Set(files.map(relative));
  const documents = new Map();
  const issues = [];
  for (const required of ['index.html', '404.html', 'assets/css/style.css', 'assets/js/nav.js', 'sitemap.xml', 'robots.txt']) {
    if (!filenames.has(required)) issues.push(`Missing generated release file: ${required}`);
  }
  for (const file of files) {
    const name = relative(file);
    if (/(?:^|\/)(?:\.DS_Store|\.gitkeep|README\.md|AGENTS\.md)|\.(?:pages|md|njk|json|ya?ml|toml)$/.test(name)
      || /^(?:src|scripts|tests|node_modules|\.git|\.vscode|assets\/data)\//.test(name)
      || (/\.(?:[cm]?js)$/.test(name) && !name.startsWith('assets/js/'))) {
      issues.push(`Nonpublic source artifact: ${name}`);
    }
    if (!name.endsWith('.html')) continue;
    const html = await fs.readFile(file, 'utf8');
    const nodes = elements(parse(html));
    const ids = nodes.map(attributes).map((attrs) => attrs.id).filter(Boolean);
    if (new Set(ids).size !== ids.length) issues.push(`${name}: duplicate element IDs`);
    documents.set(name, { nodes, ids: new Set(ids) });
    if (/googletagmanager|google-analytics|dataLayer|data-include=/.test(html)) {
      issues.push(`${name}: telemetry or runtime fragment loading found`);
    }
    const canonicals = nodes.filter((node) => node.tagName === 'link' && attributes(node).rel === 'canonical');
    if (canonicals.length !== 1 || !attributes(canonicals[0]).href.startsWith('https://greenversedigital.com/')) {
      issues.push(`${name}: expected one production canonical`);
    }
    const redirect = nodes.some((node) => node.tagName === 'meta' && attributes(node)['http-equiv'] === 'refresh');
    if (!redirect) {
      for (const tag of ['h1', 'main', 'footer']) {
        if (nodes.filter((node) => node.tagName === tag).length !== 1) issues.push(`${name}: expected one ${tag}`);
      }
      if (nodes.filter((node) => node.tagName === 'header' && attributes(node).role === 'banner').length !== 1) {
        issues.push(`${name}: expected one site banner`);
      }
    }
    for (const node of nodes) {
      const attrs = attributes(node);
      if (Object.keys(attrs).some((key) => key.startsWith('on'))) issues.push(`${name}: inline event handler`);
      if (node.tagName === 'script' && (!attrs.src || !attrs.src.startsWith('/assets/js/'))) {
        issues.push(`${name}: executable inline or external script`);
      }
    }
  }
  for (const [name, { nodes }] of documents) {
    for (const node of nodes) {
      const attrs = attributes(node);
      const values = [attrs.href, attrs.src];
      if (attrs.srcset) values.push(...attrs.srcset.split(',').map((part) => part.trim().split(/\s+/)[0]));
      for (const value of values.filter(Boolean)) {
        if (/^(https:|mailto:|tel:|data:)/.test(value)) continue;
        if (/^[a-z]+:/i.test(value) || value.startsWith('//')) {
          issues.push(`${name}: unsupported URL ${value}`);
          continue;
        }
        const url = new URL(value, `https://greenversedigital.com/${name}`);
        let target = decodeURIComponent(url.pathname.slice(1));
        if (!target || target.endsWith('/')) target += 'index.html';
        if (!filenames.has(target)) issues.push(`${name}: missing case-sensitive target ${value}`);
        if (url.hash && documents.has(target) && !documents.get(target).ids.has(decodeURIComponent(url.hash.slice(1)))) {
          issues.push(`${name}: missing anchor ${value}`);
        }
      }
    }
  }
  const sitemap = await fs.readFile(path.join(directory, 'sitemap.xml'), 'utf8');
  const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  if (!listed.length || new Set(listed).size !== listed.length) issues.push('Sitemap must have unique entries');
  for (const url of listed) {
    if (!url.startsWith('https://greenversedigital.com/')) issues.push(`Invalid sitemap origin: ${url}`);
    const name = new URL(url).pathname.slice(1) || 'index.html';
    const document = documents.get(name);
    if (!document) issues.push(`Missing sitemap target: ${url}`);
    else if (document.nodes.some((node) => attributes(node).name === 'robots' && attributes(node).content === 'noindex')) {
      issues.push(`Sitemap includes noindex page: ${url}`);
    }
  }
  if (issues.length) throw new Error(`Output validation failed:\n${issues.join('\n')}`);
  return { pages: documents.size, files: filenames.size, sitemapEntries: listed.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(await validateOutput());
}
