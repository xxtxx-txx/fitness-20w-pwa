/** Development-only static file server; no API or application backend. */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const port = Number(arg('--port', process.env.PORT || '8000'));
const host = arg('--host', '127.0.0.1');
const prefix = `/${arg('--base', '/').split('/').filter(Boolean).join('/')}`.replace(/\/?$/, '/');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.md': 'text/plain; charset=utf-8' };
const server = http.createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end('Method not allowed'); }
    const pathname = decodeURIComponent(new URL(req.url, `http://${host}:${port}`).pathname);
    if (prefix !== '/' && pathname === prefix.slice(0, -1)) { res.writeHead(301, { Location: prefix }); return res.end(); }
    if (!pathname.startsWith(prefix)) { res.writeHead(404); return res.end('Not found'); }
    let relative = pathname.slice(prefix.length);
    if (relative.endsWith('/') || !relative) relative += 'index.html';
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
    if (!(await stat(file)).isFile()) { res.writeHead(404); return res.end('Not found'); }
    const bytes = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Content-Length': bytes.length, 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(port, host, () => console.log(`Fitness static preview: http://${host}:${server.address().port}${prefix}`));
