import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.env.PORT ?? 8000);
// Used by browser tests to reproduce a GitHub Pages project URL.
const prefix = `/${(process.env.BASE_PATH ?? '').split('/').filter(Boolean).join('/')}`.replace(
  /\/$/,
  '',
);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};

await stat(new URL('../dist/index.html', import.meta.url)).catch(() => {
  throw new Error('Build the project first with npm run build (or use npm start).');
});

const server = createServer((request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Access-Control-Allow-Origin', '*');
  void serve(request, response).catch((error) => {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') console.error(error);
    if (!response.headersSent) response.writeHead(404);
    response.end('Not found');
  });
});

async function serve(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }
  const url = new URL(request.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);
  if (prefix && pathname !== prefix && !pathname.startsWith(`${prefix}/`)) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  let path = resolve(root, `.${pathname.slice(prefix.length) || '/'}`);
  if (path !== resolve(root) && !path.startsWith(`${resolve(root)}${sep}`)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }
  const info = await stat(path);
  if (info.isDirectory()) {
    if (!url.pathname.endsWith('/')) {
      response.writeHead(301, { Location: `${url.pathname}/${url.search}` });
      response.end();
      return;
    }
    path = resolve(path, 'index.html');
  }
  const file = await stat(path);
  response.writeHead(200, {
    'Content-Type': mime[extname(path)] ?? 'application/octet-stream',
    'Content-Length': file.size,
  });
  if (request.method === 'HEAD') response.end();
  else
    createReadStream(path)
      .on('error', (error) => response.destroy(error))
      .pipe(response);
}

server.listen(port, '127.0.0.1', () => {
  console.log(`MashaJS preview: http://127.0.0.1:${server.address().port}${prefix}/preview/`);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
