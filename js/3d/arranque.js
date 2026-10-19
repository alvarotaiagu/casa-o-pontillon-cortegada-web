// Arranque del 3D del Miño. La web lo carga al final del <body>: <script type="module" src="js/3d/arranque.js?v=…"></script>
// No pide nada hasta después de `load` y de un rato libre. El chip dice la hora y el sol desde el principio;
// al acercarse #rio se montan los mandos de hora y, con WebGL2, se descargan los datos y se monta la escena.
// Sin WebGL2, con ahorro de datos o si algo falla: clase `sin-3d` en #rio, se queda el póster y #rio-carga dice el motivo.
// VERSION: súbela al cambiar cualquier fichero de js/3d/ o img/terreno/. Cambia la huella de este fichero
// (versionar.mjs de la web la pone en el <script>) y todo lo que se pide desde aquí lleva ?v=VERSION.
const VERSION = '2026-10-19.1', V = '?v=' + VERSION;
const $ = id => document.getElementById(id);
const rioEl = $('rio');
const MOV = !matchMedia('(prefers-reduced-motion: reduce)').matches;
let motor = null;

function sinTres(motivo) {
  try { motor?.detener(); } catch (e) { /* nada */ }
  if (rioEl) {
    rioEl.classList.remove('con-3d', 'volando'); rioEl.classList.add('sin-3d');
    rioEl.querySelector('canvas.lienzo3d')?.remove();
    const rot = $('rio-rotulos'); if (rot) rot.textContent = '';
    const m = $('rio-mover'); if (m) m.hidden = true;
    // sin 3D no hay vuelo, casa ni plano que mover: fuera el grupo «Vista» (la hora y la lectura siguen, en texto)
    const g = $('rio-volar')?.closest('[role="group"]'); if (g) g.hidden = true;
  }
  const carga = $('rio-carga');
  if (carga) { carga.hidden = false; carga.textContent = motivo; }
  window.PONT_3D = { ...(window.PONT_3D || {}), estado: 'sin-3d', motivo };
}

function hayWebGL2() {
  try {
    const c = document.createElement('canvas'), gl = c.getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch (e) { return false; }
}

const trasCarga = () => new Promise(res => {
  const libre = () => ('requestIdleCallback' in window ? requestIdleCallback(() => res(), { timeout: 2000 }) : setTimeout(res, 300));
  if (document.readyState === 'complete') libre(); else addEventListener('load', libre, { once: true });
});
const alAcercarse = (el, margen) => new Promise(res => {
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); res(); } }, { rootMargin: margen });
  io.observe(el);
});

async function iniciar() {
  if (!rioEl) return;
  await trasCarga();
  const S = await import('./sol.js' + V);
  const M = await import('./mandos.js' + V);
  M.montarChip(S);
  window.PONT_3D = { estado: 'esperando' };

  let sinMotivo = '';
  if (navigator.connection?.saveData) sinMotivo = 'Con el ahorro de datos activado no se carga el relieve 3D: aquí tienes el río en una imagen.';
  else if (!hayWebGL2()) sinMotivo = 'Este navegador no puede mostrar el 3D: aquí tienes el río en una imagen.';
  if (sinMotivo) sinTres(sinMotivo);

  await alAcercarse(rioEl, '1200px 0px');
  const mandos = M.montarMandos(S);
  window.PONT_3D.mandos = mandos;
  if (sinMotivo) return;

  window.PONT_3D.estado = 'cargando';
  const avisoLento = setTimeout(() => { const c = $('rio-carga'); if (c && !rioEl.classList.contains('con-3d') && !rioEl.classList.contains('sin-3d')) c.textContent = 'El relieve 3D está tardando: mientras, la imagen.'; }, 15000);
  // la cortina (si la hay) se ha retirado: nada de tareas largas que traben su trazo (6 s de red de seguridad)
  const cortinaFuera = Promise.race([
    new Promise(r => document.documentElement.classList.contains('cortina-fuera') ? r() : document.addEventListener('pontillon:cortina-fuera', r, { once: true })),
    new Promise(r => setTimeout(r, 6000)),
  ]);
  // los dos módulos y los datos se piden a la vez
  const [E, R] = await Promise.all([import('./escena.js' + V), import('./rio.js' + V)]);
  const D = await E.cargarDatos(V);
  await cortinaFuera;
  motor = E.crearMotor(D, { S, alFallar: () => sinTres('El 3D se ha detenido en este equipo: aquí tienes el río en una imagen.') });
  await motor.listo;
  if (window.PONT_3D.estado === 'sin-3d') return;
  window.PONT_3D = { ...window.PONT_3D, estado: 'listo', motor };
  window.PONT_3D.rio = R.montarRio(motor, { movimiento: MOV, mandos });
  clearTimeout(avisoLento);
}

iniciar().catch(e => { console.warn('[3d]', e); sinTres('El 3D no ha podido cargar aquí: se queda el río en una imagen.'); });
