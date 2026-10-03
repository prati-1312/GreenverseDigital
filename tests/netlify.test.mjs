import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { onPreBuild, onPostBuild } from '../scripts/netlify-publish-guard/index.js';

const root = process.cwd();
const options = (directory = path.join(root, 'dist'), command = 'npm run build') => ({
  constants: { PUBLISH_DIR: directory },
  netlifyConfig: { build: { command } }
});

test('Netlify configuration shares one build contract and publish guard across contexts', async () => {
  const config = await fs.readFile('netlify.toml', 'utf8');
  assert.match(config, /\[build\]\s+command = "npm run build"\s+publish = "dist"/);
  assert.match(config, /\[build\.environment\]\s+NODE_VERSION = "22"/);
  assert.match(config, /\[\[plugins\]\]\s+package = "\.\/scripts\/netlify-publish-guard"/);
  assert.doesNotMatch(config, /\[context\./);
  assert.match(await fs.readFile('scripts/netlify-publish-guard/manifest.yml', 'utf8'),
    /^name: netlify-publish-guard\s*$/);
});

test('Netlify guard rejects source directories and skipped or partial builds', async () => {
  assert.doesNotThrow(() => onPreBuild(options()));
  for (const directory of [root, path.join(root, 'src'), path.join(root, '_site'), '']) {
    assert.throws(() => onPreBuild(options(directory)), /publish directory/);
    await assert.rejects(onPostBuild(options(directory)), /publish directory/);
  }
  for (const command of ['', undefined, 'npx eleventy', 'npm run serve']) {
    const input = options();
    input.netlifyConfig.build.command = command;
    assert.throws(() => onPreBuild(input), /must run npm run build/);
  }
  await assert.doesNotReject(onPostBuild(options()));
});

test('release validation rejects missing homepage and copied source artifacts', async () => {
  const { validateOutput } = await import('../scripts/validate-output.mjs');
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'greenverse-netlify-test-'));
  try {
    await fs.cp('dist', fixture, { recursive: true });
    const homepage = await fs.readFile(path.join(fixture, 'index.html'));
    await fs.unlink(path.join(fixture, 'index.html'));
    await assert.rejects(validateOutput(fixture), /Missing generated release file: index.html/);
    await fs.writeFile(path.join(fixture, 'index.html'), homepage);
    for (const name of ['package.json', 'netlify.toml', 'eleventy.config.js', 'src/index.njk', 'scripts/build.mjs']) {
      const target = path.join(fixture, name);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, 'source artifact');
      await assert.rejects(validateOutput(fixture), /Nonpublic source artifact/);
      await fs.unlink(target);
    }
    await assert.doesNotReject(validateOutput(fixture));
  } finally {
    await fs.rm(fixture, { recursive: true, force: true });
  }
});
