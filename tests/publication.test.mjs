import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import matter from 'gray-matter';
import { stringify } from 'yaml';

test('real build excludes drafts and escapes metadata without executing article templates', async () => {
  const root = process.cwd();
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'greenverse-publication-test-'));
  try {
    await fs.cp('src', path.join(fixture, 'src'), { recursive: true });
    await fs.cp('assets/data', path.join(fixture, 'assets/data'), { recursive: true });
    await fs.cp('assets/js', path.join(fixture, 'assets/js'), { recursive: true });
    await fs.cp('assets/uploads', path.join(fixture, 'assets/uploads'), { recursive: true });
    const { data } = matter(await fs.readFile('src/posts/why-you-need-social-media-manager.md', 'utf8'));
    await fs.writeFile(path.join(fixture, 'src/posts/draft-test.md'), matter.stringify('DO NOT PUBLISH THIS DRAFT', {
      ...data, slug: 'draft-test', title: 'Unpublished draft fixture', published: false
    }));
    const cmsYaml = stringify({
      ...data, slug: 'escape-test', title: '<img src=x onerror=alert(1)>', published: true
    });
    await fs.writeFile(path.join(fixture, 'src/posts/escape-test.md'),
      `---\n${cmsYaml}---\n{{ 7 * 7 }}\n\n<script>bad()</script>`);
    const eleventyModule = pathToFileURL(path.join(root, 'node_modules/@11ty/eleventy/src/Eleventy.js')).href;
    const script = `import Eleventy from ${JSON.stringify(eleventyModule)};
      const site = new Eleventy('src', 'dist', {configPath: ${JSON.stringify(path.join(root, 'eleventy.config.js'))}});
      await site.write();`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: fixture, encoding: 'utf8', timeout: 60000
    });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    await assert.rejects(fs.access(path.join(fixture, 'dist/blog/draft-test.html')));
    for (const name of ['blog.html', 'feed.xml', 'sitemap.xml']) {
      const output = await fs.readFile(path.join(fixture, 'dist', name), 'utf8');
      assert.ok(!output.includes('draft-test'), name);
      assert.ok(!output.includes('DO NOT PUBLISH'), name);
    }
    const published = await fs.readFile(path.join(fixture, 'dist/blog/escape-test.html'), 'utf8');
    assert.ok(published.includes('&lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(!published.includes('<img src=x'));
    assert.ok(published.includes('{{ 7 * 7 }}'));
    assert.ok(!published.includes('<script>bad()'));
  } finally {
    // Only this test's uniquely created fixture directory is removed.
    await fs.rm(fixture, { recursive: true, force: true });
  }
});
