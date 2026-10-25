import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { readArticle } from './content.mjs';

export const journalWidths = [480, 800, 1200, 1920];

export function journalImage(source, slug) {
  const src = (width) => {
    if (source.startsWith('/assets/uploads/')) return `/images/journal/${slug}-${width}.webp`;
    const url = new URL(source);
    url.searchParams.set('fm', 'webp');
    url.searchParams.set('fit', 'crop');
    url.searchParams.set('w', String(width));
    url.searchParams.set('h', String(width * 5 / 8));
    url.searchParams.set('q', '78');
    return url.href;
  };
  return {
    src: src(1200),
    srcset: journalWidths.map((width) => `${src(width)} ${width}w`).join(', '),
    width: 1920,
    height: 1200
  };
}

export async function buildJournalImages(output) {
  const destination = path.join(output, 'images', 'journal');
  await fs.mkdir(destination, { recursive: true });
  for (const filename of await fs.readdir('src/posts')) {
    if (!filename.endsWith('.md')) continue;
    const { data } = readArticle(await fs.readFile(path.join('src/posts', filename), 'utf8'));
    if (!data.published || !data.hero.startsWith('/assets/uploads/')) continue;
    for (const width of journalWidths) {
      await sharp(data.hero.slice(1)).rotate()
        .resize(width, width * 5 / 8, { fit: 'cover', position: 'attention' })
        .webp({ quality: 78 })
        .toFile(path.join(destination, `${data.slug}-${width}.webp`));
    }
  }
}
