import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', 'dist');
await fs.access(path.join(root, 'index.html'));
const port = Number(process.env.PORT || 8080);
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.png': 'image/png', '.avif': 'image/avif'
};
const redirects = new Map([
  ['/index.html', '/'],
  ['/Testimonials.html', '/testimonials.html'],
  ['/blog/blog/is-growing-sustainably-enough.html', '/blog/is-growing-sustainably-enough.html']
]);

http.createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    const url = new URL(request.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    const redirect = redirects.get(pathname)
      || (pathname.startsWith('/blog/Is Growing Sustainably Enough') ? '/blog/is-growing-sustainably-enough.html' : null);
    if (redirect) {
      response.writeHead(301, { Location: redirect }).end();
      return;
    }
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (relative.split(/[\\/]/).some((part) => part.startsWith('.'))) {
      response.writeHead(404).end();
      return;
    }
    const target = path.resolve(root, relative);
    if (!target.startsWith(root + path.sep)) {
      response.writeHead(404).end();
      return;
    }
    let data;
    let status = 200;
    let extension = path.extname(target);
    try { data = await fs.readFile(target); }
    catch (error) {
      if (!['ENOENT', 'EISDIR', 'ENOTDIR'].includes(error.code)) throw error;
      data = await fs.readFile(path.join(root, '404.html'));
      status = 404;
      extension = '.html';
    }
    response.writeHead(status, {
      'Content-Type': mime[extension] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch (error) {
    if (error instanceof URIError) {
      response.writeHead(400).end('Invalid URL');
      return;
    }
    console.error('[preview]', error);
    response.writeHead(500).end('Preview failed');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Local preview: http://127.0.0.1:${port} (dist only; no request logging)`);
});
