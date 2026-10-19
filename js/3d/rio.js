// La sección #rio: el vuelo por la S del Miño hasta la casa (la primera vez que se ve, y con «Volar por el río»)
// y el explorador (OrbitControls) con rótulos, la hora de hoy, «Bajar a la casa» y En 3D / En plano.
// El vuelo empieza en la vista del valle (la del póster), baja al río por Prexigueiro, lo sigue río abajo
// y se posa junto a la casa mirando al agua. Arrastrar (o «Saltar el vuelo») lo corta y deja el explorador.
import { OrbitControls } from './vendor/OrbitControls.js';

const $ = id => document.getElementById(id);
const TACTIL = matchMedia('(pointer: coarse)').matches;
const suave = t => (t = Math.min(1, Math.max(0, t)), t * t * (3 - 2 * t));
const DUR = 22000;            // ms de vuelo
const VIAJE = 2400;           // ms de los viajes de cámara (Bajar a la casa, volver al valle)

/** Curva monótona (Hermite con pendientes de Fritsch–Carlson), que arranca y se posa con velocidad 0 */
function monotona(xs, ys) {
  const n = xs.length, h = [], d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) { h[i] = xs[i + 1] - xs[i]; d[i] = (ys[i + 1] - ys[i]) / h[i]; }
  for (let i = 1; i < n - 1; i++) if (d[i - 1] * d[i] > 0) { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
  return x => {
    x = Math.max(xs[0], Math.min(xs[n - 1], x)); let i = 0; while (i < n - 2 && x > xs[i + 1]) i++;
    const t = (x - xs[i]) / h[i], t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1];
  };
}

export function montarRio(motor, { movimiento, mandos }) {
  const { THREE, D, CASA, S } = motor, { EX, W, H, L, T, suelo, AGUA, EJE } = D;
  const rioEl = $('rio'), marco = $('rio-marco'), caja = $('rio-lienzo'), capa = $('rio-rotulos');
  const bMover = $('rio-mover'), carga = $('rio-carga');
  const bVolar = $('rio-volar'), bCasa = $('rio-casa'), b3 = $('rio-3d'), bP = $('rio-plano');
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const camara = new THREE.PerspectiveCamera(42, 16 / 10, 20, 70000);

  // ---------- poses ----------
  // El valle (la del póster y la de «volver»): desde el norte-noroeste y en alto, con la S entera y la casa en el centro
  const VT = V3(CASA.x - 400, 100 * EX, CASA.z + 1200);
  const VP = VT.clone().addScaledVector(V3(-.278, .574, -.77).normalize(), 8000);
  const VALLE = { p: VP, o: VT };
  // Junto a la casa, mirando al río por encima del tejado (la del tablero)
  const alRio = V3(EJE[41][0] - CASA.x, 0, EJE[41][1] - CASA.z).normalize();
  const CASA_V = { p: CASA.clone().addScaledVector(alRio, -380).setY(CASA.y + 190), o: CASA.clone().addScaledVector(alRio, 160) };

  // ---------- la curva del vuelo ----------
  const ULT = Math.min(EJE.length - 1, 66), P = [VP.clone()];
  const r0 = V3(EJE[0][0], (AGUA + 470) * EX, EJE[0][1]);
  P.push(VP.clone().lerp(r0, .5));
  for (let i = 0; i <= ULT; i += 2) { const k = i / ULT; P.push(V3(EJE[i][0], (AGUA + 470 - 320 * k) * EX, EJE[i][1])); }
  const iRio = 2, iSal = P.length - 1;
  const sal = P[iSal];
  P.push(sal.clone().lerp(CASA_V.p, .5).setY((AGUA + 230) * EX), CASA_V.p.clone());
  const curva = new THREE.CatmullRomCurve3(P, false, 'centripetal');
  const largos = curva.getLengths(800), fr = i => largos[Math.round(i / (P.length - 1) * 800)] / largos[800];
  const f0 = fr(iRio), f1 = fr(iSal);
  const arco = monotona([0, 4500, 18000, DUR], [0, f0, f1, 1]);   // 4,5 s de bajada al río, 13,5 s por el río, 4 s hasta la casa

  // ---------- rótulos ----------
  const lug = (k, sub, clase = '', alto = 140) => ({ k, html: `${L[k].t}<small>${sub}</small>`, clase, p: V3(L[k].xz[0], L[k].h * EX + alto * EX, L[k].xz[1]), uv: L[k].uv });
  const rioR = (k, t, e) => ({ k, html: t, clase: 'rio', p: V3(e[0], AGUA * EX + 30, e[1]), uv: [e[0] / W + .5, e[1] / H + .5] });
  const LISTA = [
    lug('casa', `${Math.round(L.casa.h)} m · ${T.casaAgua.sobre} m sobre el agua`, 'casa', 230),
    lug('cortegada', `${Math.round(L.cortegada.h)} m`), lug('termas', 'a unos 10 min en coche'), lug('presa', 'aquí acaba el embalse'),
    lug('crecente', 'en la otra orilla, Pontevedra'), lug('cotocruz', `${Math.round(L.cotocruz.h)} m`),
    rioR('mino', 'Miño', EJE[22]), rioR('encoro', 'Encoro da Frieira', EJE[Math.min(EJE.length - 1, 84)]),
  ];
  capa.textContent = '';
  const rot = LISTA.map(r => {
    const d = document.createElement('div');
    d.className = 'rotulo3d' + (r.clase ? ' ' + r.clase : ''); d.dataset.lugar = r.k; d.innerHTML = r.html;
    capa.appendChild(d); return { ...r, d, w: 0, h: 0 };
  });
  const rCasa = rot[0];
  // en el vuelo: «Río Miño» sobre el agua por delante
  const rVuelo = document.createElement('div'); rVuelo.className = 'rotulo3d rio'; rVuelo.dataset.lugar = 'vuelo'; rVuelo.textContent = 'Río Miño';
  capa.appendChild(rVuelo);
  const pant = {}, pRio = V3(0, 0, 0);
  function repartir(pos) {   // coloca en orden y quita los que chocan con uno anterior o no caben enteros en el marco
    const puestos = [], cw = capa.clientWidth;
    rot.forEach((r, i) => {
      const p = pos[i];
      if (!r.w) { r.w = r.d.offsetWidth || 90; r.h = r.d.offsetHeight || 30; }
      const c = { x0: p.x - r.w / 2, x1: p.x + r.w / 2, y0: p.y - r.h - 12, y1: p.y };
      const vis = p.visible && c.x0 >= 2 && c.x1 <= cw - 2 && c.y0 >= 0 && !puestos.some(o => c.x0 < o.x1 && c.x1 > o.x0 && c.y0 < o.y1 && c.y1 > o.y0);
      r.d.style.display = vis ? '' : 'none'; r.d.style.opacity = '';
      if (vis) { puestos.push(c); r.d.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -100%)`; }
    });
    rVuelo.style.display = 'none';
  }
  // el rótulo de la casa baja al acercarse (de lejos, alto sobre la aguja; junto a la casa, justo encima del tejado)
  const alturaCasa = () => { rCasa.p.y = CASA.y + Math.min(230 * EX, Math.max(28, camara.position.distanceTo(CASA) * .07)); };
  const colocar3d = () => { alturaCasa(); repartir(rot.map(r => ({ ...motor.aPantalla(r.p, pant) }))); };
  function colocarUno(el, p, op) {
    if (op <= 0) { el.style.display = 'none'; return; }
    motor.aPantalla(p, pant);
    el.style.display = pant.visible ? '' : 'none'; el.style.opacity = op.toFixed(2);
    if (pant.visible) el.style.transform = `translate(${pant.x.toFixed(1)}px, ${pant.y.toFixed(1)}px) translate(-50%, -100%)`;
  }

  // ---------- En plano: la imagen se crea al pulsar (object-fit: contain) y los rótulos van por uv ----------
  let plano = null;
  function asegurarPlano() {
    if (plano) return plano;
    const pic = document.createElement('picture'); pic.className = 'rio-plano';
    const src = document.createElement('source'); src.type = 'image/webp'; src.srcset = new URL('../../img/terreno/plano.webp', import.meta.url).href;
    plano = document.createElement('img'); plano.id = 'rio-plano-img';
    plano.src = new URL('../../img/terreno/plano.jpg', import.meta.url).href;
    plano.alt = 'El valle del Miño en plano: el relieve sombreado sobre la foto aérea, de las termas de Prexigueiro a la presa de Frieira, con la casa dentro de la curva';
    plano.width = T.plano.w; plano.height = T.plano.h; plano.decoding = 'async';
    pic.append(src, plano); caja.before(pic);
    plano.addEventListener('load', () => { if (enPlano) colocarPlano(); });
    return plano;
  }
  function colocarPlano() {
    const cw = marco.clientWidth, ch = marco.clientHeight, nw = T.plano.w, nh = T.plano.h;
    const r = plano.getBoundingClientRect(), m = marco.getBoundingClientRect();
    const ajuste = getComputedStyle(plano).objectFit;
    const s = ajuste === 'cover' ? Math.max(r.width / nw, r.height / nh) : Math.min(r.width / nw, r.height / nh);
    const dw = nw * s, dh = nh * s, ox = r.left - m.left + (r.width - dw) / 2, oy = r.top - m.top + (r.height - dh) / 2;
    repartir(rot.map(x => { const px = ox + x.uv[0] * dw, py = oy + x.uv[1] * dh - (x.clase === 'rio' ? 0 : 6); return { x: px, y: py, visible: px > -20 && px < cw + 20 && py > 0 && py < ch + 20 }; }));
  }

  // ---------- estado ----------
  let modo = 'explorar';          // 'explorar' | 'vuelo'
  let tv = 0, viaje = null, enPlano = false, abajo = false, yaVolo = false, visto = false, pintado = false;
  const pos = V3(0, 0, 0), adelante = V3(0, 0, 0), mirar = VT.clone();

  // ---------- control ----------
  camara.position.copy(VP); camara.lookAt(VT);
  const ctl = new OrbitControls(camara, caja);
  ctl.target.copy(VT);
  Object.assign(ctl, { enableDamping: true, dampingFactor: .08, minDistance: 220, maxDistance: 17000, maxPolarAngle: 1.47, screenSpacePanning: false, rotateSpeed: .6, enableZoom: false });
  ctl.addEventListener('change', () => {
    ctl.target.x = Math.max(-W / 2, Math.min(W / 2, ctl.target.x)); ctl.target.z = Math.max(-H / 2, Math.min(H / 2, ctl.target.z));
    motor.pedir();
  });
  let moviendo = false, interactuado = false;
  ctl.addEventListener('start', () => { moviendo = true; interactuado = true; viaje = null; motor.pedir(); });
  ctl.addEventListener('end', () => { moviendo = false; });
  ctl.update();
  // la rueda solo acerca después de pinchar en el mapa (así la página sigue bajando con la rueda)
  caja.addEventListener('pointerdown', () => { ctl.enableZoom = true; });
  caja.addEventListener('pointerleave', () => { ctl.enableZoom = false; });
  // en táctil, el dedo hace scroll hasta que se pulsa «Mover el mapa» (OrbitControls pone touch-action: none al crearse)
  let suelto = !TACTIL;
  const ponerMover = activo => {
    suelto = activo; ctl.enabled = activo && modo === 'explorar';
    caja.style.touchAction = activo ? 'none' : 'pan-y';
    bMover.textContent = activo ? 'Soltar el mapa' : 'Mover el mapa';
    marco.classList.toggle('mapa-suelto', activo);
  };
  if (TACTIL) {
    bMover.hidden = false; ponerMover(false);
    bMover.addEventListener('click', () => { interactuado = true; if (modo === 'vuelo') terminarVuelo(false); ponerMover(!suelto); });
  } else caja.style.touchAction = 'pan-y';
  // teclado: flechas giran e inclinan, + y − acercan
  caja.tabIndex = 0;
  caja.setAttribute('role', 'application');
  caja.setAttribute('aria-roledescription', 'relieve en 3D');
  caja.setAttribute('aria-label', 'El valle del Miño en 3D, con la casa dentro de la curva. Flechas: girar e inclinar. Más y menos: acercar y alejar.');
  const esf = new THREE.Spherical(), off = V3(0, 0, 0);
  caja.addEventListener('keydown', e => {
    const k = e.key; let dTh = 0, dPh = 0, f = 1;
    if (k === 'ArrowLeft') dTh = -.12; else if (k === 'ArrowRight') dTh = .12;
    else if (k === 'ArrowUp') dPh = -.08; else if (k === 'ArrowDown') dPh = .08;
    else if (k === '+' || k === '=') f = .85; else if (k === '-' || k === '_') f = 1 / .85;
    else return;
    e.preventDefault(); interactuado = true;
    if (modo === 'vuelo') terminarVuelo(false);
    viaje = null;
    off.copy(camara.position).sub(ctl.target); esf.setFromVector3(off);
    esf.theta += dTh; esf.phi = Math.max(.15, Math.min(ctl.maxPolarAngle, esf.phi + dPh));
    esf.radius = Math.max(ctl.minDistance, Math.min(ctl.maxDistance, esf.radius * f));
    camara.position.copy(ctl.target).add(off.setFromSpherical(esf)); ctl.update(); motor.pedir();
  });

  function ponerAbajo(v) { abajo = v; bCasa.setAttribute('aria-pressed', String(v)); }
  function ponerModo(m) {
    modo = m;
    rioEl.classList.toggle('volando', m === 'vuelo');
    bVolar.textContent = m === 'vuelo' ? 'Saltar el vuelo' : 'Volar por el río';
    ctl.enabled = m === 'explorar' && suelto;
    if (m === 'explorar') rCasa.d.style.opacity = '';
  }
  /** Lleva la cámara (y el punto al que mira) a una pose; con movimiento reducido, de golpe */
  function irA(dest, alAcabar, dur = VIAJE) {
    if (!movimiento) { camara.position.copy(dest.p); ctl.target.copy(dest.o); camara.lookAt(dest.o); ctl.update(); alAcabar?.(); motor.pedir(); return; }
    viaje = { t0: -1, dur, p0: camara.position.clone(), p1: dest.p.clone(), o0: (modo === 'vuelo' ? mirar : ctl.target).clone(), o1: dest.o.clone(), alAcabar };
    motor.pedir();
  }

  function pose(t) {
    const e = arco(t);
    curva.getPointAt(e, pos);
    const minY = (suelo(pos.x, pos.z) + 70) * EX; if (pos.y < minY) pos.y = minY;
    camara.position.copy(pos);
    // mira al agua, un kilómetro por delante en el cauce; al principio, al valle; al final, al río por encima de la casa
    curva.getPointAt(Math.min(1, e + .07), adelante); adelante.y = AGUA * EX;
    const b0 = suave(e / f0), b1 = suave((e - (f1 - .07)) / (.99 - (f1 - .07)));
    mirar.copy(VT).lerp(adelante, b0).lerp(CASA_V.o, b1);
    camara.lookAt(mirar); camara.updateMatrixWorld();
    return e;
  }
  function rotulosVuelo(e) {
    for (const r of rot) if (r !== rCasa) r.d.style.display = 'none';
    alturaCasa(); colocarUno(rCasa.d, rCasa.p, suave((e - (f1 - .02)) / .06));
    // «Río Miño»: el primer punto del cauce por delante que cae en la pantalla, entre el 30 % y el 88 % del alto
    let op = Math.min(suave((e - f0 * .8) / .05), suave((f1 - .08 - e) / .05));
    if (op > 0) {
      let ok = false;
      for (const d of [.06, .09, .12, .16]) {
        curva.getPointAt(Math.min(1, e + d), pRio); pRio.y = AGUA * EX + 20;
        motor.aPantalla(pRio, pant);
        if (pant.visible && pant.y > caja.clientHeight * .3 && pant.y < caja.clientHeight * .88) { ok = true; break; }
      }
      if (!ok) op = 0;
    }
    colocarUno(rVuelo, pRio, op);
  }

  function empezarVuelo() {
    if (!movimiento) return;
    if (enPlano) ponerVista(false);
    yaVolo = true; ponerAbajo(false);
    mirar.copy(ctl.target);
    ponerModo('vuelo');
    tv = 0;
    // si la cámara no está en el valle, primero vuelve a él (desde ahí arranca el vuelo)
    if (camara.position.distanceTo(VP) > 30) irA(VALLE, null, 1800); else viaje = null;
    motor.pedir();
  }
  /** a la casa: «Saltar el vuelo» (un viaje hasta el final); si no, el explorador se queda donde está */
  function terminarVuelo(aLaCasa) {
    if (modo !== 'vuelo') return;
    viaje = null;
    ctl.target.copy(mirar);
    ponerModo('explorar');
    if (aLaCasa) { irA(CASA_V, null, 1600); ponerAbajo(true); } else ponerAbajo(false);
    ctl.update(); motor.pedir();
  }

  // ---------- botones ----------
  if (!movimiento) bVolar.hidden = true;
  bVolar.addEventListener('click', () => { interactuado = true; if (modo === 'vuelo') terminarVuelo(true); else empezarVuelo(); });
  bCasa.addEventListener('click', () => {
    interactuado = true;
    if (enPlano) ponerVista(false);
    if (modo === 'vuelo') terminarVuelo(false);
    const ir = !abajo; ponerAbajo(ir); irA(ir ? CASA_V : VALLE);
  });
  function ponerVista(p) {
    enPlano = p; marco.classList.toggle('plano', p);
    b3.setAttribute('aria-pressed', String(!p)); bP.setAttribute('aria-pressed', String(p));
    rot.forEach(r => { r.w = 0; });
    if (p) {
      if (modo === 'vuelo') terminarVuelo(false);
      viaje = null; asegurarPlano(); colocarPlano();
      if (TACTIL) { bMover.hidden = true; ponerMover(false); }
    } else {
      if (TACTIL) bMover.hidden = false;
      motor.pedir();
    }
  }
  b3.addEventListener('click', () => ponerVista(false));
  bP.addEventListener('click', () => { interactuado = true; ponerVista(true); });
  new ResizeObserver(() => { if (enPlano && plano) colocarPlano(); }).observe(marco);

  // ---------- gestos durante el vuelo: arrastrar lo corta y deja el explorador ----------
  // en captura: antes que OrbitControls, para que el mismo arrastre ya gire el mapa
  let toque = null;
  caja.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') { toque = modo === 'vuelo' ? { x: e.clientX, y: e.clientY, id: e.pointerId } : null; return; }
    interactuado = true;
    if (modo === 'vuelo') terminarVuelo(false);
    viaje = null;
  }, { capture: true });
  caja.addEventListener('pointermove', e => {
    if (!toque || e.pointerId !== toque.id) return;
    const dx = e.clientX - toque.x, dy = e.clientY - toque.y;
    if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { toque = null; return; }   // es scroll
    if (Math.abs(dx) > 14) { toque = null; interactuado = true; terminarVuelo(false); }
  });
  const soltarToque = () => { toque = null; };
  caja.addEventListener('pointerup', soltarToque); caja.addEventListener('pointercancel', soltarToque);

  // ---------- la luz: la de la barra de hora ----------
  mandos.escuchar(m => { motor.ponerHora(S.fechaDe(m)); motor.pedir(); });

  // ---------- el vuelo, la primera vez que se ve (la mitad del marco en pantalla) ----------
  const probarVuelo = () => {
    if (!movimiento || yaVolo || !visto || !pintado || interactuado || enPlano) return;
    yaVolo = true;
    setTimeout(() => { if (!interactuado && !enPlano && modo === 'explorar') empezarVuelo(); }, 700);   // tras el fundido del canvas
  };
  const ioVisto = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { visto = true; ioVisto.disconnect(); probarVuelo(); } }, { threshold: .5 });
  ioVisto.observe(marco);

  const vista = motor.montar({
    caja, camara,
    ajustarCamara: a => { camara.fov = motor.fovPara(a); },
    cuadro(t, dt) {
      if (enPlano) return false;
      if (viaje) {
        if (viaje.t0 < 0) viaje.t0 = t;
        const k = Math.min(1, (t - viaje.t0) / viaje.dur), e = suave(k);
        camara.position.lerpVectors(viaje.p0, viaje.p1, e);
        const o = V3(0, 0, 0).lerpVectors(viaje.o0, viaje.o1, e);
        const minY = (suelo(camara.position.x, camara.position.z) + 40) * EX; if (camara.position.y < minY) camara.position.y = minY;
        if (modo === 'vuelo') { mirar.copy(o); camara.lookAt(o); camara.updateMatrixWorld(); rotulosVuelo(0); }
        else { ctl.target.copy(o); camara.lookAt(o); }
        if (k >= 1) { const fin = viaje.alAcabar; viaje = null; fin?.(); }
        if (modo === 'vuelo') return true;
      }
      if (modo === 'vuelo') {
        tv = Math.min(DUR, tv + dt);
        const e = pose(tv);
        motor.aguja.visible = false;
        rotulosVuelo(e);
        if (tv >= DUR) { ctl.target.copy(CASA_V.o); ponerModo('explorar'); ponerAbajo(true); ctl.update(); }
        return true;
      }
      const cambia = ctl.update();
      const c = camara.position, minY = (suelo(c.x, c.z) + 40) * EX; if (c.y < minY) c.y = minY;
      motor.aguja.visible = c.distanceTo(CASA) > 800;
      return !!viaje || cambia || moviendo;
    },
    trasPintar: () => { if (!enPlano && modo === 'explorar') colocar3d(); },
    alPrimerFotograma() {
      pintado = true;
      rioEl.classList.add('con-3d');
      carga.hidden = true;
      document.dispatchEvent(new CustomEvent('pontillon:3d-listo'));
      probarVuelo();
    },
  });
  return {
    vista, ctl, camara, curva, DUR, poses: { VALLE, CASA_V },
    get modo() { return modo; }, get tv() { return tv; }, set tv(v) { tv = v; motor.pedir(); },
    get enPlano() { return enPlano; }, get abajo() { return abajo; },
    volar: empezarVuelo, saltar: () => terminarVuelo(true), vista3d: () => ponerVista(false), plano: () => ponerVista(true),
  };
}
