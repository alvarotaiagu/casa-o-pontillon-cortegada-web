// Común a las pruebas del 3D: servidor estático de la web en el 8797 y Chromium con WebGL por software.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PUERTO = 8797;
const PW = 'C:/Users/alvar/Desktop/WEBS NEGOCIOS/ayuntamiento-cabeza-la-vaca-web/node_modules/playwright/index.mjs';
export const { chromium, devices } = await import('file:///' + PW.replace(/ /g, '%20'));
export const sharp = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/')('sharp');

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.bin': 'application/octet-stream', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

export function servir(puerto = PUERTO) {
  const srv = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(RAIZ, p);
      if (!f.startsWith(RAIZ)) { res.writeHead(403).end(); return; }
      await stat(f);
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(await readFile(f));
    } catch (e) { res.writeHead(404).end('no'); }
  });
  return new Promise((ok, mal) => { srv.once('error', mal); srv.listen(puerto, '127.0.0.1', () => ok(srv)); });
}

export const ARGS_GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
export const lanzar = (extra = []) => chromium.launch({ args: [...ARGS_GL, ...extra] });
export const URL_BANCO = `http://127.0.0.1:${PUERTO}/pruebas/3d-banco.html`;
export const espera = ms => new Promise(r => setTimeout(r, ms));
