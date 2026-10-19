import { createServer } from 'node:http';

// A separate origin that consumes only the published library, without preview code.
const server = createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(
    '<!doctype html><html><head><link rel="icon" href="data:,"></head><body><button>Host button</button></body></html>',
  );
});
server.listen(4174, '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
