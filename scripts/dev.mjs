// Local test server: static files + the api/ routes, no Vercel CLI needed.
//   node --env-file=.env scripts/dev.mjs        → http://localhost:3000
// .env needs STRIPE_SECRET_KEY (sk_test_…), STRIPE_WEBHOOK_SECRET (from `stripe listen`), LULU_KEY, LULU_SECRET,
// BLOB_READ_WRITE_TOKEN (from the Vercel Blob store), CHROME_PATH (your Chrome), SITE_URL=http://localhost:3000.
// Stripe events locally: stripe listen --forward-to localhost:3000/api/stripe-webhook
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const ROOT = join(import.meta.dirname, '..'), PORT = +(process.env.PORT || 3000);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      const mod = await import(join(ROOT, url.pathname.replace(/\/$/, '') + '.js') + '?t=' + Date.now());
      const fn = mod[req.method]; if (!fn) { res.writeHead(405).end(); return; }
      const chunks = []; for await (const c of req) chunks.push(c);
      const body = ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks);
      const r = await fn(new Request(url, { method: req.method, headers: req.headers, body }));
      res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); return;
    }
    let p = join(ROOT, decodeURIComponent(url.pathname));
    if ((await stat(p).catch(() => null))?.isDirectory()) p = join(p, 'index.html');
    const data = await readFile(p); // read first, so a missing file can still get a 404
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(data);
  } catch (e) {
    if (e.code !== 'ENOENT') console.error(e);
    if (!res.headersSent) res.writeHead(e.code === 'ENOENT' ? 404 : 500); res.end(e.code === 'ENOENT' ? 'not found' : String(e.message));
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}  (print page: /print/?token=0)`));
