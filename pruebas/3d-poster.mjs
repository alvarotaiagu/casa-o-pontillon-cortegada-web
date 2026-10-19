// Póster de #rio = la vista del valle del explorador (el primer fotograma del vuelo), pintada con la propia escena.
// Uso (desde la carpeta de la web, después de python -I scripts/terreno.py): node pruebas/3d-poster.mjs
// Salida en img/terreno/: poster-rio-1600.{avif,webp,jpg} (16:10) y poster-rio-movil-900.{avif,webp,jpg} (4:5).
// Luz fija: 19 de octubre a las 18:30 (luz de tarde, sol a 12° por el oeste-suroeste). Movimiento reducido: sin vuelo ni ondas.
import { servir, lanzar, URL_BANCO, espera, RAIZ, sharp } from './3d-comun.mjs';
import path from 'node:path';
import { statSync } from 'node:fs';
const HORA = '2026-10-19T18:30';
const OUT = path.join(RAIZ, 'img', 'terreno');
const srv = await servir(); const nav = await lanzar();

async function pintar({ ancho, alto, escala, movil }) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: escala, isMobile: movil, hasTouch: movil, reducedMotion: 'reduce' });
  const pag = await ctx.newPage();
  pag.on('pageerror', e => console.log('error:', e.message));
  await pag.goto(`${URL_BANCO}?poster=1&ahora3d=${HORA}&dpr3d=${escala}`);
  await pag.waitForFunction(() => document.getElementById('rio').classList.contains('con-3d'), null, { timeout: 120000 });
  await pag.addStyleTag({ content: '#rio-rotulos, .rio-chip, .rio-carga, .rio-mover, #rio-poster { visibility: hidden !important; }' });
  await espera(1500);
  const png = await pag.locator('#rio-marco').screenshot({ animations: 'disabled' });
  await ctx.close();
  return png;
}
async function guardar(png, nombre, w) {
  const base = sharp(png).resize({ width: w });
  await base.clone().avif({ quality: 50, effort: 6 }).toFile(path.join(OUT, `${nombre}.avif`));
  await base.clone().webp({ quality: 74, effort: 6 }).toFile(path.join(OUT, `${nombre}.webp`));
  await base.clone().jpeg({ quality: 78, mozjpeg: true, progressive: true }).toFile(path.join(OUT, `${nombre}.jpg`));
}
try {
  await guardar(await pintar({ ancho: 800, alto: 500, escala: 2, movil: false }), 'poster-rio-1600', 1600);
  await guardar(await pintar({ ancho: 412, alto: 515, escala: 900 / 412, movil: true }), 'poster-rio-movil-900', 900);
} finally { await nav.close(); srv.close(); }
for (const n of ['poster-rio-1600', 'poster-rio-movil-900']) for (const e of ['avif', 'webp', 'jpg']) {
  const f = path.join(OUT, `${n}.${e}`), m = await sharp(f).metadata();
  console.log(`${n}.${e}`.padEnd(28), `${m.width}×${m.height}`.padEnd(11), Math.round(statSync(f).size / 1024), 'KB');
}
