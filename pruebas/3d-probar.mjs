// Una pasada de pruebas del 3D del Miño sobre el banco, con capturas para revisar.
// Uso (desde la carpeta de la web): node pruebas/3d-probar.mjs
// Escritorio 1280×800 (vuelo, saltar, casa, mediodía, noche, plano, arrastre, pausa fuera de pantalla),
// móvil 390×780 táctil, movimiento reducido y sin WebGL. Capturas en pruebas/3d-cap-*.png.
import { servir, lanzar, URL_BANCO, espera, RAIZ } from './3d-comun.mjs';
import path from 'node:path';

const HORA = '2026-10-19T18:30';
const cap = n => path.join(RAIZ, 'pruebas', `3d-cap-${n}.png`);
let ok = 0, mal = 0;
const comprobar = (cond, txt, extra = '') => { if (cond) { ok++; console.log('  ✓', txt); } else { mal++; console.log('  ✗', txt, extra); } };
const srv = await servir();

async function contexto(nav, op, nombre) {
  const ctx = await nav.newContext(op);
  const pag = await ctx.newPage();
  const errores = [];
  pag.on('pageerror', e => errores.push(e.message));
  pag.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && m.text().includes('[3d]'))) errores.push(m.text()); });
  return { ctx, pag, errores, nombre };
}
const con3d = pag => pag.waitForFunction(() => document.getElementById('rio').classList.contains('con-3d'), null, { timeout: 150000 });
const alMarco = pag => pag.evaluate(() => document.getElementById('rio-marco').scrollIntoView({ block: 'start' }));
const marcoRio = pag => pag.locator('#rio');

let nav = await lanzar();
try {
  // ================= escritorio =================
  console.log('Escritorio 1280×800');
  {
    const { ctx, pag, errores } = await contexto(nav, { viewport: { width: 1280, height: 800 } });
    const pedidos = [];
    pag.on('request', r => pedidos.push({ url: r.url(), t: Date.now() }));
    await pag.goto(`${URL_BANCO}?ahora3d=${HORA}`);
    await pag.waitForLoadState('load'); const tLoad = Date.now();
    await espera(400);
    const pronto = pedidos.filter(p => p.t < tLoad && /js\/3d\/(?!arranque)|img\/terreno\/(?!poster)/.test(p.url));
    comprobar(pronto.length === 0, 'nada del 3D (salvo arranque.js) antes de load', pronto.map(p => p.url).join(' '));
    await pag.waitForFunction(() => document.getElementById('rio-chip').textContent.includes('18:3'), null, { timeout: 15000 });
    comprobar(true, 'chip con la hora fijada: ' + await pag.textContent('#rio-chip'));
    // los datos se piden a 1200 px de #rio: solo se comprueba si el banco lo deja más lejos (en el banco suele estar dentro)
    const lejos = await pag.evaluate(() => document.getElementById('rio').getBoundingClientRect().top - innerHeight > 1300);
    if (lejos) comprobar(!pedidos.some(p => /alturas|orto-/.test(p.url)), 'los datos no se piden hasta acercarse a #rio');
    await alMarco(pag);
    await con3d(pag);
    comprobar(pedidos.some(p => p.url.includes('alturas-384.bin')) && pedidos.some(p => /orto-2880\.webp/.test(p.url)), 'escritorio: malla 384 y ortofoto 2880 en WebP');
    comprobar(await pag.isHidden('#rio-carga'), '#rio-carga oculto con el 3D');
    await pag.waitForFunction(() => document.getElementById('rio').classList.contains('volando'), null, { timeout: 15000 });
    comprobar(await pag.textContent('#rio-volar') === 'Saltar el vuelo', 'el vuelo empieza solo al verse y el botón dice «Saltar el vuelo»');
    const p0 = await pag.evaluate(() => window.PONT_3D.rio.camara.position.toArray());
    await espera(2500);
    const p1 = await pag.evaluate(() => window.PONT_3D.rio.camara.position.toArray());
    comprobar(Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]) > 20, 'la cámara avanza');
    // a mitad de vuelo, por el río
    await pag.evaluate(() => { window.PONT_3D.rio.tv = 11000; });
    await espera(1800);
    await marcoRio(pag).screenshot({ path: cap('vuelo-mitad') });
    comprobar(await pag.evaluate(() => getComputedStyle(document.querySelector('[data-lugar="vuelo"]')).display !== 'none'), 'rótulo «Río Miño» sobre el agua a mitad de vuelo');
    // saltar → a la casa
    await pag.click('#rio-volar');
    await espera(2600);
    const est = await pag.evaluate(() => ({ modo: window.PONT_3D.rio.modo, abajo: document.getElementById('rio-casa').getAttribute('aria-pressed'), txt: document.getElementById('rio-volar').textContent }));
    comprobar(est.modo === 'explorar' && est.abajo === 'true' && est.txt === 'Volar por el río', '«Saltar el vuelo» deja el explorador junto a la casa', JSON.stringify(est));
    await marcoRio(pag).screenshot({ path: cap('casa') });
    comprobar(await pag.evaluate(() => { const r = document.querySelector('[data-lugar="casa"]'); return r && getComputedStyle(r).display !== 'none'; }), 'rótulo de la casa a la vista');
    // volver al valle, mediodía y noche
    await pag.click('#rio-casa');
    await espera(3200);
    comprobar(await pag.getAttribute('#rio-casa', 'aria-pressed') === 'false', '«Bajar a la casa» otra vez: vuelve al valle');
    await pag.click('[data-h="mediodia"]');
    await espera(1800);
    const lMed = await pag.textContent('#rio-lectura');
    comprobar(/sol/.test(lMed) && /\d\d:\d\d/.test(await pag.textContent('#rio-hora-txt')), 'mediodía: lectura del sol', lMed);
    await marcoRio(pag).screenshot({ path: cap('mediodia') });
    await pag.click('[data-h="noche"]');
    await espera(1800);
    const lNoc = await pag.textContent('#rio-lectura');
    comprobar(/noche/.test(lNoc), 'noche: lectura de noche', lNoc);
    await marcoRio(pag).screenshot({ path: cap('noche') });
    const rotVis = await pag.evaluate(() => [...document.querySelectorAll('#rio-rotulos .rotulo3d')].filter(r => getComputedStyle(r).display !== 'none').map(r => r.dataset.lugar));
    comprobar(rotVis.includes('casa') && rotVis.length >= 4, 'rótulos del explorador: ' + rotVis.join(', '));
    // en plano
    await pag.click('[data-h="pone"]');
    await pag.click('#rio-plano');
    await pag.waitForFunction(() => { const i = document.getElementById('rio-plano-img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 });
    await espera(500);
    const pl = await pag.evaluate(() => {
      const m = document.getElementById('rio-marco'), r = document.querySelector('[data-lugar="casa"]').getBoundingClientRect(), mm = m.getBoundingClientRect();
      return { clase: m.classList.contains('plano'), b3: document.getElementById('rio-3d').getAttribute('aria-pressed'), bp: document.getElementById('rio-plano').getAttribute('aria-pressed'),
        dentro: r.left >= mm.left && r.right <= mm.right && r.top >= mm.top && r.bottom <= mm.bottom, lienzo: getComputedStyle(document.getElementById('rio-lienzo')).visibility };
    });
    comprobar(pl.clase && pl.b3 === 'false' && pl.bp === 'true' && pl.dentro && pl.lienzo === 'hidden', 'En plano: imagen, aria-pressed y rótulo de la casa dentro del marco', JSON.stringify(pl));
    await marcoRio(pag).screenshot({ path: cap('plano') });
    await pag.click('#rio-3d');
    await espera(800);
    comprobar(await pag.evaluate(() => !document.getElementById('rio-marco').classList.contains('plano')), 'En 3D otra vez');
    // arrastre con el ratón: gira
    const bb = await pag.locator('#rio-lienzo').boundingBox();
    const q0 = await pag.evaluate(() => window.PONT_3D.rio.camara.position.toArray());
    await pag.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await pag.mouse.down();
    for (let i = 1; i <= 8; i++) { await pag.mouse.move(bb.x + bb.width / 2 + i * 25, bb.y + bb.height / 2); await espera(60); }
    await pag.mouse.up(); await espera(1200);
    const q1 = await pag.evaluate(() => window.PONT_3D.rio.camara.position.toArray());
    comprobar(Math.hypot(q1[0] - q0[0], q1[2] - q0[2]) > 100, 'arrastrar con el ratón gira el valle');
    // «Volar por el río» y cortarlo arrastrando
    await pag.click('#rio-volar');
    await pag.waitForFunction(() => window.PONT_3D.rio.modo === 'vuelo', null, { timeout: 5000 });
    await espera(3000);
    await pag.mouse.move(bb.x + 300, bb.y + 300); await pag.mouse.down();
    await pag.mouse.move(bb.x + 380, bb.y + 300, { steps: 5 }); await pag.mouse.up();
    await espera(400);
    comprobar(await pag.evaluate(() => window.PONT_3D.rio.modo) === 'explorar', '«Volar por el río» lo repite y arrastrar lo corta');
    // fuera de pantalla no pinta
    await pag.click('#rio-volar');
    await espera(1000);
    await pag.evaluate(() => window.scrollTo(0, 0));
    await espera(1500);
    const f0 = await pag.evaluate(() => window.PONT_3D.motor.renderer.info.render.frame);
    await espera(2000);
    const f1 = await pag.evaluate(() => window.PONT_3D.motor.renderer.info.render.frame);
    comprobar(f1 === f0, 'fuera de pantalla no pinta', `${f0} → ${f1}`);
    comprobar(await pag.evaluate(() => window.PONT_3D.motor.calidad.nivel >= 0), 'calidad automática: ' + JSON.stringify(await pag.evaluate(() => window.PONT_3D.motor.calidad)));
    comprobar(errores.length === 0, 'sin errores en consola', errores.join(' | '));
    await ctx.close();
  }

  // ================= móvil =================
  console.log('Móvil 390×780 táctil');
  {
    const { ctx, pag, errores } = await contexto(nav, { viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const pedidos = []; pag.on('request', r => pedidos.push(r.url()));
    await pag.goto(`${URL_BANCO}?ahora3d=${HORA}`);
    await alMarco(pag);
    await con3d(pag);
    comprobar(pedidos.some(u => u.includes('alturas-256.bin')) && pedidos.some(u => u.includes('orto-1792')), 'móvil: malla 256 y ortofoto 1792');
    comprobar(await pag.isVisible('#rio-mover'), '«Mover el mapa» visible en táctil');
    comprobar(await pag.evaluate(() => getComputedStyle(document.getElementById('rio-lienzo')).touchAction) === 'pan-y', 'el dedo hace scroll (touch-action: pan-y)');
    comprobar(await pag.evaluate(() => window.PONT_3D.motor.renderer.getPixelRatio() <= 1.5), 'tope de densidad 1,5');
    await pag.waitForFunction(() => window.PONT_3D.rio.modo === 'vuelo', null, { timeout: 15000 });
    await pag.tap('#rio-mover');
    await espera(300);
    const m = await pag.evaluate(() => ({ modo: window.PONT_3D.rio.modo, ta: getComputedStyle(document.getElementById('rio-lienzo')).touchAction, txt: document.getElementById('rio-mover').textContent }));
    comprobar(m.modo === 'explorar' && m.ta === 'none' && m.txt === 'Soltar el mapa', '«Mover el mapa» corta el vuelo y suelta el mapa', JSON.stringify(m));
    await pag.tap('#rio-mover');
    await pag.evaluate(() => window.PONT_3D.rio.vista3d());
    await pag.click('#rio-casa'); await espera(3000);
    await pag.evaluate(() => document.getElementById('rio').scrollIntoView({ block: 'start' }));
    await espera(800);
    await pag.screenshot({ path: cap('movil-casa') });
    comprobar(errores.length === 0, 'sin errores en consola', errores.join(' | '));
    await ctx.close();
  }

  // ================= movimiento reducido =================
  console.log('Movimiento reducido');
  {
    const { ctx, pag, errores } = await contexto(nav, { viewport: { width: 1000, height: 700 }, reducedMotion: 'reduce' });
    await pag.goto(`${URL_BANCO}?ahora3d=${HORA}`);
    await alMarco(pag);
    await con3d(pag);
    await espera(2500);
    const r = await pag.evaluate(() => ({ modo: window.PONT_3D.rio.modo, volar: document.getElementById('rio-volar').hidden, volando: document.getElementById('rio').classList.contains('volando') }));
    comprobar(r.modo === 'explorar' && r.volar && !r.volando, 'sin vuelo: explorador quieto y sin «Volar por el río»', JSON.stringify(r));
    await pag.click('#rio-casa'); await espera(400);
    const d = await pag.evaluate(() => window.PONT_3D.rio.camara.position.distanceTo(window.PONT_3D.rio.poses.CASA_V.p));
    comprobar(d < 1, '«Bajar a la casa» de golpe', String(d));
    comprobar(errores.length === 0, 'sin errores en consola', errores.join(' | '));
    await ctx.close();
  }
} finally { await nav.close(); }

// ================= sin WebGL =================
console.log('Sin WebGL');
nav = await lanzar(['--disable-webgl', '--disable-webgl2', '--disable-3d-apis']);
try {
  const { ctx, pag, errores } = await contexto(nav, { viewport: { width: 1000, height: 700 } });
  const pedidos = []; pag.on('request', r => pedidos.push(r.url()));
  await pag.goto(`${URL_BANCO}?ahora3d=${HORA}`);
  await pag.waitForFunction(() => document.getElementById('rio').classList.contains('sin-3d'), null, { timeout: 15000 });
  await alMarco(pag); await espera(1200);
  const s = await pag.evaluate(() => ({ carga: document.getElementById('rio-carga').textContent, visible: !document.getElementById('rio-carga').hidden,
    grupo: document.getElementById('rio-volar').closest('[role="group"]').hidden, poster: document.getElementById('rio-poster').complete && document.getElementById('rio-poster').naturalWidth > 0,
    lectura: document.getElementById('rio-lectura').textContent, chip: document.getElementById('rio-chip').textContent }));
  comprobar(s.visible && /3D/.test(s.carga) && s.grupo && s.poster, 'sin-3d: póster, motivo en #rio-carga y sin grupo «Vista»', JSON.stringify(s));
  comprobar(/sol/.test(s.lectura) && /Ahora en O Pontillón · 18:3/.test(s.chip), 'sin 3D, la hora y el chip siguen en texto');
  comprobar(!pedidos.some(u => /three\.module|alturas|orto-/.test(u)), 'sin WebGL no se descarga Three.js ni el relieve');
  await pag.screenshot({ path: cap('sin-webgl') });
  comprobar(errores.length === 0, 'sin errores en consola', errores.join(' | '));
  await ctx.close();
} finally { await nav.close(); srv.close(); }

console.log(`\n${ok} bien, ${mal} mal`);
process.exitCode = mal ? 1 : 0;
