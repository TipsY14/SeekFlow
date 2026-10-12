/* SPDX-License-Identifier: Apache-2.0
Copyright 2026 TipsY14 */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/capture' && req.method === 'POST') {
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 2000000) throw new Error('too large'); chunks.push(chunk); }
      const name = /^\w+$/.test(url.searchParams.get('name') || '') ? url.searchParams.get('name') : 'page';
      await fs.writeFile(path.join(root, 'artifacts', `live-${name}.html`), Buffer.concat(chunks));
      res.end('captured'); return;
    }
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/tests/fixtures/home.html';
    if (/^\/post-/.test(pathname)) pathname = '/tests/fixtures/post.html';
    if (pathname.startsWith('/categories/')) pathname = '/tests/fixtures/home.html';
    const file = path.resolve(root, `.${pathname}`);
    if (!file.startsWith(root + path.sep) || /(?:^|[\\/])\./.test(path.relative(root, file))) throw new Error('invalid path');
    const bytes = await fs.readFile(file); res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); res.end(bytes);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(4173, '127.0.0.1', () => console.log('SeekFlow preview: http://127.0.0.1:4173'));
