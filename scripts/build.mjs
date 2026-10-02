import fs from 'node:fs/promises';
import path from 'node:path';
import Eleventy from '@11ty/eleventy';
import sharp from 'sharp';
import { listFiles, validateOutput } from './validate-output.mjs';
import { validateArticles } from './content.mjs';

const root = path.resolve(import.meta.dirname, '..');
process.chdir(root);
validateArticles();
const output = path.join(root, 'dist');
const outputInfo = await fs.lstat(output).catch((error) => {
  if (error.code === 'ENOENT') return null;
  throw error;
});
if (outputInfo?.isSymbolicLink() || (outputInfo && !outputInfo.isDirectory())) {
  throw new Error('Refusing to replace dist: expected an ordinary generated directory');
}
await fs.rm(output, { recursive: true, force: true });
const site = new Eleventy();
await site.write();

await fs.mkdir(path.join(output, 'assets', 'css'), { recursive: true });
const layers = ['tokens', 'base', 'layout', 'components', 'effects', 'utilities'];
const css = await Promise.all(layers.map((layer) => fs.readFile(`assets/css/${layer}.css`, 'utf8')));
await fs.writeFile(path.join(output, 'assets', 'css', 'style.css'), css.join('\n'));
await fs.mkdir(path.join(output, 'images'), { recursive: true });
await fs.copyFile('images/Logo.webp', path.join(output, 'images', 'Logo.jpg'));
await sharp('images/Founder.jpg').rotate().resize({ width: 1000, withoutEnlargement: true })
  .webp({ quality: 82 }).toFile(path.join(output, 'images', 'Founder.webp'));
await sharp('Case studies/greenversedigitalcover.png').resize({ width: 1180, withoutEnlargement: true })
  .webp({ quality: 82 }).toFile(path.join(output, 'images', 'greenversedigitalcover.webp'));

for (const file of await listFiles('assets/uploads')) {
  if (path.basename(file) === '.gitkeep') continue;
  if (!/\.(?:jpe?g|png|webp|avif)$/i.test(file)) throw new Error(`Unsupported upload: ${file}`);
  if ((await fs.stat(file)).size > 10 * 1024 * 1024) throw new Error(`Upload exceeds 10 MB: ${file}`);
  const metadata = await sharp(file).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`Undecodable image: ${file}`);
  const destination = path.join(output, file);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(file, destination);
}
console.log('Verified release:', await validateOutput());
