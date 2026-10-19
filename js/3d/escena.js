// La escena del Miño: un solo renderer WebGL sobre #rio-lienzo. Relieve MDT05 + ortofoto PNOA del IGN (CC BY 4.0),
// altura ×1,6, cantos de maqueta, la casa de cerca a 0,3 m/px, agua del embalse que refleja el cielo (sol o luna de verdad),
// cúpula de cielo, estrellas, sombras del sol, calidad automática. Lo mismo que el tablero, con la arquitectura de Fontes.
import * as THREE from './vendor/three.module.min.js';
import { Water } from './vendor/Water.js';

export { THREE };
const BASE = new URL('../../img/terreno/', import.meta.url);
const rad = Math.PI / 180;

// Móvil: malla 256, ortofoto 1792 y la casa a 1024; escritorio: 384, 2880 y 1536
const REDUCIDO = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const MOVIL = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 700;

// ---------- Datos ----------
let promesaDatos = null;
/** v: «?v=…» que pone arranque.js, para que la caché no sirva datos viejos */
export function cargarDatos(v = '') {
  return promesaDatos ||= (async () => {
    const n = MOVIL ? 256 : 384, lado = MOVIL ? 1792 : 2880, ladoF = MOVIL ? 1024 : 1536;
    const pedir = f => fetch(new URL(f + v, BASE), { priority: 'low' }).then(r => { if (!r.ok) throw new Error(f + ' ' + r.status); return r; });
    const imagen = async nombre => {   // WebP y, si falla, JPG; decodificada fuera del hilo principal
      let ultimo;
      for (const ext of ['webp', 'jpg']) {
        try {
          const b = await (await pedir(`${nombre}.${ext}`)).blob();
          if ('createImageBitmap' in window) return await createImageBitmap(b);
          const img = new Image(); img.src = URL.createObjectURL(b); await img.decode(); return img;
        } catch (e) { ultimo = e; }
      }
      throw ultimo;
    };
    const [T, buf, orto, finca] = await Promise.all([pedir('terreno.json').then(r => r.json()), pedir(`alturas-${n}.bin`).then(r => r.arrayBuffer()),
      imagen(`orto-${lado}`), imagen(`finca-${ladoF}`)]);
    const ALT = new Uint16Array(buf);
    if (ALT.length !== n * n) throw new Error('alturas: tamaño inesperado');
    const W = T.ancho, H = T.alto, EX = T.exageracion;
    const cota = (r, c) => ALT[r * n + c] / 10;
    const suelo = (x, z) => {   // metros reales bajo un punto del mundo (bilineal)
      const c = Math.min(n - 1.001, Math.max(0, (x / W + .5) * (n - 1))), r = Math.min(n - 1.001, Math.max(0, (z / H + .5) * (n - 1)));
      const c0 = Math.floor(c), r0 = Math.floor(r), fc = c - c0, fr = r - r0;
      return (cota(r0, c0) * (1 - fc) + cota(r0, c0 + 1) * fc) * (1 - fr) + (cota(r0 + 1, c0) * (1 - fc) + cota(r0 + 1, c0 + 1) * fc) * fr;
    };
    return { T, n, W, H, EX, cota, suelo, orto, finca, L: T.lugares, AGUA: T.agua.nivel[0], EJE: T.eje };
  })();
}

// Luz según la altura del sol: [altura, cielo arriba, horizonte y bruma, color del sol, intensidad del sol, intensidad del cielo, color del agua]
const TABLA = [[-18, '#03060d', '#09111f', '#8fa6d8', .22, .16, '#02080b'], [-6, '#0c1630', '#26304d', '#9fb0e0', .3, .22, '#041015'], [-1, '#2f3d66', '#c27758', '#ff8f55', .8, .3, '#0a1a1e'],
  [5, '#5f7fae', '#eaa673', '#ffad66', 2.0, .55, '#163834'], [18, '#7fa6cf', '#d3dde0', '#ffeedb', 2.7, .8, '#1f4943'], [60, '#77a2d0', '#cbdae3', '#ffffff', 3.0, .92, '#224f48']];
const TABLA_C = TABLA.map(([a, c1, c2, c3, i, h, c4]) => [a, new THREE.Color(c1), new THREE.Color(c2), new THREE.Color(c3), i, h, new THREE.Color(c4)]);
function mezcla(a) {
  let i = 0; while (i < TABLA_C.length - 2 && a > TABLA_C[i + 1][0]) i++;
  const p = TABLA_C[i], q = TABLA_C[i + 1], k = Math.min(1, Math.max(0, (a - p[0]) / (q[0] - p[0])));
  const col = j => p[j].clone().lerp(q[j], k);
  return { cielo: col(1), bruma: col(2), sol: col(3), i: p[4] + (q[4] - p[4]) * k, h: p[5] + (q[5] - p[5]) * k, agua: col(6), noche: Math.min(1, Math.max(0, (-a - 2) / 10)) };
}
const direccion = (az, al, v = new THREE.Vector3()) => v.set(Math.sin(az * rad) * Math.cos(al * rad), Math.sin(al * rad), -Math.cos(az * rad) * Math.cos(al * rad));

/** Campo de visión vertical para un aspecto: apaisado, 42° en vertical; en vertical, 34° en horizontal fijos
 *  (el póster vertical se pinta a 4:5 y con object-fit: cover encaja igual). */
export function fovPara(aspecto, vBase = 42, hFijo = 34) {
  if (aspecto >= 1) return vBase;
  return Math.max(vBase, 2 * Math.atan(Math.tan(hFijo / 2 * rad) / aspecto) / rad);
}

// cúpula del cielo (también se refleja en el agua): degradado, disco y halo del sol, disco de la luna
const cieloVert = `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const cieloFrag = `uniform vec3 arriba, horizonte, colSol, dirSol, dirLuna; uniform float noche, luna;
varying vec3 vDir;
void main(){ vec3 d = normalize(vDir); float h = d.y;
  vec3 c = mix(horizonte, arriba, pow(smoothstep(-.02, .55, h), .75));
  c = mix(c, horizonte * .7, smoothstep(0., -.08, h));
  float s = max(dot(d, dirSol), 0.);
  c += colSol * (smoothstep(.99955, .9997, s) * 6. + pow(s, 14.) * .35 * (1. - noche) + pow(s, 3.) * .08 * (1. - noche));
  float m = dot(d, dirLuna);
  c += vec3(.93, .95, 1.) * (smoothstep(.99988, .99993, m) * 1.6 + pow(max(m, 0.), 60.) * .12) * luna;
  gl_FragColor = vec4(c, 1.);
  #include <colorspace_fragment>
}`;

// ---------- El motor ----------
/** S: el módulo sol.js (lo pasa arranque.js con su versión: una sola copia) */
export function crearMotor(D, { S, alFallar } = {}) {
  const { n, W, H, EX, cota, T, suelo, AGUA } = D;
  const renderer = new THREE.WebGLRenderer({ antialias: !MOVIL, powerPreference: 'high-performance' });   // lanza si no hay WebGL2
  const lienzo = renderer.domElement;
  lienzo.className = 'lienzo3d'; lienzo.setAttribute('aria-hidden', 'true');
  // tope de densidad: 1,5 en móvil y 1,75 en escritorio (?dpr3d=2 lo cambia, solo para el póster)
  const dprPedido = +new URLSearchParams(location.search).get('dpr3d');
  let dpr = dprPedido > 0 ? Math.min(devicePixelRatio || 1, dprPedido) : Math.min(devicePixelRatio || 1, MOVIL ? 1.5 : 1.75);
  renderer.setPixelRatio(dpr); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.5;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;   // el sol no se mueve dentro de un minuto: la sombra se rehace al cambiar la hora
  lienzo.addEventListener('webglcontextlost', e => { e.preventDefault(); detener(); alFallar?.('contexto perdido'); });

  const escena = new THREE.Scene();
  const anis = Math.min(MOVIL ? 4 : 8, renderer.capabilities.getMaxAnisotropy());
  // ---- relieve (por las dos caras: en el reflejo las laderas se ven desde abajo) ----
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * n * 3), uv = new Float32Array(n * n * 2), idx = new Uint32Array((n - 1) * (n - 1) * 6);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const i = r * n + c;
    pos[i * 3] = (c / (n - 1) - .5) * W; pos[i * 3 + 1] = cota(r, c) * EX; pos[i * 3 + 2] = (r / (n - 1) - .5) * H;
    uv[i * 2] = c / (n - 1); uv[i * 2 + 1] = r / (n - 1);   // textura sin voltear (ImageBitmap): fila 0 = norte
  }
  let k = 0; for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) { const a = r * n + c, b = a + 1, d = a + n, e = d + 1; idx.set([a, d, b, b, d, e], k); k += 6; }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeVertexNormals();
  const tex = new THREE.Texture(D.orto); tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = anis; tex.needsUpdate = true;
  const tierra = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: .96, metalness: 0, side: THREE.DoubleSide, shadowSide: THREE.FrontSide }));
  tierra.receiveShadow = tierra.castShadow = true; escena.add(tierra);
  // ---- los cuatro cantos de la maqueta ----
  {
    const base = (T.min - 120) * EX, p = [], borde = [];
    for (let c = 0; c < n; c++) borde.push([0, c]); for (let r = 1; r < n; r++) borde.push([r, n - 1]);
    for (let c = n - 2; c >= 0; c--) borde.push([n - 1, c]); for (let r = n - 2; r > 0; r--) borde.push([r, 0]); borde.push([0, 0]);
    for (let i = 0; i < borde.length - 1; i++) {
      const [r0, c0] = borde[i], [r1, c1] = borde[i + 1];
      const x0 = (c0 / (n - 1) - .5) * W, z0 = (r0 / (n - 1) - .5) * H, x1 = (c1 / (n - 1) - .5) * W, z1 = (r1 / (n - 1) - .5) * H, y0 = cota(r0, c0) * EX, y1 = cota(r1, c1) * EX;
      p.push(x0, y0, z0, x0, base, z0, x1, y1, z1, x1, y1, z1, x0, base, z0, x1, base, z1);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals();
    escena.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#2f2a24', roughness: 1, side: THREE.DoubleSide })));
  }
  // ---- la casa de cerca: un parche de foto aérea a 0,3 m/px, pegado al relieve, con los bordes difuminados ----
  const F = T.finca, seg = 60;
  const geoF = new THREE.BufferGeometry(), posF = new Float32Array((seg + 1) ** 2 * 3), uvF = new Float32Array((seg + 1) ** 2 * 2), idxF = [];
  for (let j = 0; j <= seg; j++) for (let i = 0; i <= seg; i++) {
    const q = j * (seg + 1) + i, x = F.xz[0] + (i / seg - .5) * F.ancho, z = F.xz[1] + (j / seg - .5) * F.alto;
    posF.set([x, suelo(x, z) * EX + 2.5, z], q * 3); uvF.set([i / seg, j / seg], q * 2);
  }
  for (let j = 0; j < seg; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + 1, d = a + seg + 1, e = d + 1; idxF.push(a, d, b, b, d, e); }
  geoF.setAttribute('position', new THREE.BufferAttribute(posF, 3)); geoF.setAttribute('uv', new THREE.BufferAttribute(uvF, 2)); geoF.setIndex(idxF); geoF.computeVertexNormals();
  const lienzoBorde = document.createElement('canvas'); lienzoBorde.width = lienzoBorde.height = 64;
  { const x = lienzoBorde.getContext('2d'), im = x.createImageData(64, 64);
    for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) { const d = Math.min(i, 63 - i, j, 63 - j) / 63, a = Math.max(0, Math.min(1, (d - .02) / .2)), v = Math.round(255 * a * a * (3 - 2 * a)); im.data.set([v, v, v, 255], (j * 64 + i) * 4); }
    x.putImageData(im, 0, 0); }
  const texF = new THREE.Texture(D.finca); texF.flipY = false; texF.colorSpace = THREE.SRGBColorSpace; texF.anisotropy = anis; texF.needsUpdate = true;
  const finca = new THREE.Mesh(geoF, new THREE.MeshStandardMaterial({ map: texF, alphaMap: new THREE.CanvasTexture(lienzoBorde), transparent: true, depthWrite: false, roughness: .96, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  finca.receiveShadow = true; finca.renderOrder = 2; escena.add(finca);
  // en el reflejo, fuera todo lo que queda bajo el agua (el plano solo actúa con localClippingEnabled)
  tierra.material.clippingPlanes = finca.material.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -(AGUA * EX - 1))];

  // ---- luces ----
  const sl = new THREE.DirectionalLight('#fff', 3); sl.castShadow = true;
  const tamSombra = MOVIL ? 1024 : 2048; sl.shadow.mapSize.set(tamSombra, tamSombra);
  Object.assign(sl.shadow.camera, { left: -8600, right: 8600, top: 8600, bottom: -8600, near: 100, far: 42000 }); sl.shadow.bias = -.0004; sl.shadow.normalBias = 16;
  escena.add(sl, sl.target);
  const hemi = new THREE.HemisphereLight('#cfe0ee', '#2a3a30', .6); escena.add(hemi);

  // ---- el agua: solo las celdas del embalse (y el río bajo la presa, más bajo), en el plano XY que espera Water ----
  const geoAgua = (() => {
    const tipo = new Uint8Array(n * n), filas = T.agua.filas[String(n)];
    filas.forEach((f, r) => { for (let i = 0; i < f.length; i += 3) tipo.fill(f[i + 2], r * n + f[i], r * n + f[i + 1]); });
    const p = [], ix = [], mapa = new Int32Array(n * n).fill(-1);
    const vert = (r, c, t) => { const i = r * n + c; if (mapa[i] < 0) { mapa[i] = p.length / 3; p.push((c / (n - 1) - .5) * W, -(r / (n - 1) - .5) * H, (T.agua.nivel[t - 1] - AGUA) * EX); } return mapa[i]; };
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
      const t = Math.max(tipo[r * n + c], tipo[r * n + c + 1], tipo[(r + 1) * n + c], tipo[(r + 1) * n + c + 1]); if (!t) continue;
      const kk = (rr, cc) => tipo[rr * n + cc] || t;
      const a = vert(r, c, kk(r, c)), b = vert(r, c + 1, kk(r, c + 1)), d = vert(r + 1, c, kk(r + 1, c)), e = vert(r + 1, c + 1, kk(r + 1, c + 1));
      ix.push(a, d, b, b, d, e);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(ix);
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(p.length).map((_, i) => i % 3 === 2 ? 1 : 0), 3));
    return g;
  })();
  // ondas: un mapa de normales que se repite, con senos de frecuencia entera (sin imagen que descargar)
  const texOndas = (() => {
    const N = 256, d = new Uint8Array(N * N * 4), ondas = [];
    let semilla = 7; const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;   // fijo: el póster y la escena coinciden
    for (let i = 0; i < 14; i++) { const a = azar() * Math.PI * 2, f = 2 + Math.floor(azar() * (i < 5 ? 5 : 16)); ondas.push([Math.round(Math.cos(a) * f), Math.round(Math.sin(a) * f), azar() * 6.3, .9 / (1 + i * .35)]); }
    const v = new THREE.Vector3();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let dx = 0, dy = 0;
      for (const [kx, ky, ph, am] of ondas) { const c = Math.cos((kx * x + ky * y) / N * Math.PI * 2 + ph) * am; dx += c * kx; dy += c * ky; }
      v.set(-dx * .03, -dy * .03, 1).normalize(); const i = (y * N + x) * 4;
      d[i] = (v.x * .5 + .5) * 255; d[i + 1] = (v.y * .5 + .5) * 255; d[i + 2] = (v.z * .5 + .5) * 255; d[i + 3] = 255;
    }
    const t = new THREE.DataTexture(d, N, N); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
  })();
  const agua = new Water(geoAgua, { textureWidth: 1, textureHeight: 1, waterNormals: texOndas,
    sunDirection: new THREE.Vector3(0, 1, 0), sunColor: '#ffffff', waterColor: '#123436', distortionScale: 1.6, fog: true, alpha: 1 });
  agua.rotation.x = -Math.PI / 2; agua.position.y = AGUA * EX; agua.receiveShadow = true;
  const uA = agua.material.uniforms; uA.size.value = 5.5;
  // agua de embalse, no de mar: fresnel del agua real (F0 ≈ 0,04), sin el gris que suma Water y con el reflejo regulable
  uA.reflejo = { value: .75 };
  agua.material.fragmentShader = agua.material.fragmentShader.replace('uniform vec3 waterColor;', 'uniform vec3 waterColor; uniform float reflejo;')
    .replace('float rf0 = 0.3;', 'float rf0 = 0.04;').replace('vec3( 0.1 ) + reflectionSample * 0.9 + reflectionSample * specularLight', 'reflectionSample * reflejo + specularLight');
  escena.add(agua);
  // El reflejo, hecho aquí (Water recorta con un plano cercano oblicuo que, con la cámara rasante, se come las laderas):
  // la cámara espejo dibuja la escena recortando lo que queda bajo el agua con un plano de recorte normal.
  let tamR = MOVIL ? 384 : 640;
  const rtR = new THREE.WebGLRenderTarget(tamR, tamR); uA.mirrorSampler.value = rtR.texture;
  const espejo = new THREE.PerspectiveCamera(), vCam = new THREE.Vector3(), vMira = new THREE.Vector3(), rotM = new THREE.Matrix4();
  agua.onBeforeRender = (r, esc, cam) => {
    vCam.setFromMatrixPosition(cam.matrixWorld); if (vCam.y < AGUA * EX) return;
    rotM.extractRotation(cam.matrixWorld); vMira.set(0, 0, -1).applyMatrix4(rotM).add(vCam);
    espejo.position.set(vCam.x, 2 * AGUA * EX - vCam.y, vCam.z);
    espejo.up.set(0, 1, 0).applyMatrix4(rotM); espejo.up.y *= -1;
    espejo.lookAt(vMira.x, 2 * AGUA * EX - vMira.y, vMira.z);
    espejo.near = cam.near; espejo.far = cam.far; espejo.updateMatrixWorld(); espejo.projectionMatrix.copy(cam.projectionMatrix);
    uA.textureMatrix.value.set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1).multiply(espejo.projectionMatrix).multiply(espejo.matrixWorldInverse);
    uA.eye.value.copy(vCam);
    const rtAntes = r.getRenderTarget();
    agua.visible = false; r.localClippingEnabled = true;
    r.setRenderTarget(rtR); r.clear(); r.render(esc, espejo);
    agua.visible = true; r.localClippingEnabled = false; r.setRenderTarget(rtAntes);
  };

  // ---- la casa: una aguja de luz con la bola en el verde de la galería ----
  const CASA = new THREE.Vector3(D.L.casa.xz[0], D.L.casa.h * EX, D.L.casa.xz[1]);
  const aguja = new THREE.Group();
  const palo = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 170, 8), new THREE.MeshBasicMaterial({ color: '#f1dcc0', transparent: true, opacity: .85, fog: false }));
  const bola = new THREE.Mesh(new THREE.SphereGeometry(13, 20, 14), new THREE.MeshBasicMaterial({ color: '#3f8f7b', fog: false })); bola.position.y = 90;
  aguja.add(palo, bola); aguja.position.set(CASA.x, CASA.y + 95, CASA.z); escena.add(aguja);
  const luzCasa = new THREE.PointLight('#ffb067', 0, 700, 1.6); luzCasa.position.set(CASA.x, CASA.y + 14, CASA.z); escena.add(luzCasa);

  // ---- cielo y estrellas: pegados a la cámara que dibuja (también a la del reflejo) ----
  const ep = []; { let s = 11; const az = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 1800; i++) { const t = az() * Math.PI * 2, f = Math.acos(az() * .92); ep.push(Math.sin(f) * Math.cos(t) * 2800, Math.cos(f) * 2800, Math.sin(f) * Math.sin(t) * 2800); } }
  const geoE = new THREE.BufferGeometry(); geoE.setAttribute('position', new THREE.Float32BufferAttribute(ep, 3));
  const estrellas = new THREE.Points(geoE, new THREE.PointsMaterial({ color: '#dfe8ff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  const uCielo = { arriba: { value: new THREE.Color() }, horizonte: { value: new THREE.Color() }, colSol: { value: new THREE.Color() }, dirSol: { value: new THREE.Vector3(0, 1, 0) },
    dirLuna: { value: new THREE.Vector3(0, -1, 0) }, noche: { value: 0 }, luna: { value: 0 } };
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), new THREE.ShaderMaterial({ uniforms: uCielo, vertexShader: cieloVert, fragmentShader: cieloFrag, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false }));
  cielo.frustumCulled = estrellas.frustumCulled = false; cielo.renderOrder = -2; estrellas.renderOrder = -1;
  cielo.onBeforeRender = estrellas.onBeforeRender = function (r, e, cam) { this.position.setFromMatrixPosition(cam.matrixWorld); this.updateMatrixWorld(); };
  escena.add(cielo, estrellas);
  escena.fog = new THREE.Fog('#cfdce4', 7000, 30000);

  // ---- la luz de una fecha ----
  let claveHora = '', estado = null;
  const blanco = new THREE.Color('#ffffff'), colLuna = new THREE.Color('#9fb3d6'), vDir = new THREE.Vector3();
  /** Pone la luz de una fecha; devuelve { s: sol, lu: luna, m: mezcla } */
  function ponerHora(fecha) {
    const clave = Math.floor(fecha / 6e4) + '';
    if (clave === claveHora && estado) return estado;
    claveHora = clave;
    const s = S.sol(fecha), m = mezcla(s.alt), lu = S.luna(fecha); estado = { s, m, lu };
    const deNoche = s.alt < -3, lunaArriba = lu.alt > 0 ? Math.min(1, lu.alt / 4) : 0;
    // de noche la luz principal es la luna (si está), o un cielo azul que viene del sur
    const az = deNoche ? (lunaArriba ? lu.az : 205) : s.az, al = deNoche ? (lunaArriba ? Math.max(lu.alt, 6) : 38) : Math.max(s.alt, 1.5);
    sl.target.position.set(0, 300, 0); sl.position.copy(direccion(az, al, vDir)).multiplyScalar(17000).add(sl.target.position); sl.target.updateMatrixWorld();
    sl.color.copy(m.sol); sl.intensity = deNoche ? m.i * (.6 + lu.luz * lunaArriba * 1.2) : m.i; hemi.intensity = m.h;
    hemi.color.copy(m.cielo).lerp(blanco, .35); hemi.groundColor.set(deNoche ? '#0c1416' : '#2a3a30');
    escena.fog.color.copy(m.bruma);
    uCielo.arriba.value.copy(m.cielo); uCielo.horizonte.value.copy(m.bruma); uCielo.colSol.value.copy(m.sol);
    direccion(s.az, s.alt, uCielo.dirSol.value); direccion(lu.az, lu.alt, uCielo.dirLuna.value);
    uCielo.noche.value = m.noche; uCielo.luna.value = lunaArriba * (.25 + lu.luz * .75);
    // el brillo en el agua: el sol de día, la luna de noche
    (deNoche ? direccion(lu.az, Math.max(lu.alt, 0), uA.sunDirection.value) : direccion(s.az, Math.max(s.alt, 0), uA.sunDirection.value)).normalize();
    uA.sunColor.value.copy(deNoche ? colLuna.clone().multiplyScalar(lunaArriba * (.15 + lu.luz * .85)) : m.sol);
    uA.waterColor.value.copy(m.agua);
    estrellas.material.opacity = m.noche * .95; estrellas.visible = m.noche > 0;
    renderer.toneMappingExposure = 1.5 + m.noche * .45;
    luzCasa.intensity = m.noche * 4200;   // de noche, la casa enciende su luz
    bola.material.color.set(deNoche ? '#ffd29a' : '#3f8f7b');
    renderer.shadowMap.needsUpdate = true;
    return estado;
  }

  // ---------- La vista (una sola: #rio-lienzo) ----------
  let vista = null, bw = 0, bh = 0;
  function medir(forzar) {
    if (!vista) return;
    const w = vista.caja.clientWidth, h = vista.caja.clientHeight;
    if (!w || !h) return;
    // la barra del móvil cambia solo el alto: no se rehace nada (el canvas cubre con object-fit)
    if (!forzar && w === bw && Math.abs(h - bh) < 160) return;
    bw = w; bh = h; renderer.setSize(w, h, false);
    vista.camara.aspect = w / h; vista.ajustarCamara?.(w / h); vista.camara.updateProjectionMatrix();
    pedir();
  }
  let visible = false;
  const io = new IntersectionObserver(es => {
    for (const e of es) visible = e.isIntersecting;
    ultimo = 0;
    if (!visible) { cancelAnimationFrame(raf); raf = 0; } else pedir();
  }, { rootMargin: '120px 0px' });
  const ro = new ResizeObserver(() => medir());
  document.addEventListener('visibilitychange', () => { ultimo = 0; if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else pedir(); });

  // ---------- Bucle: solo cuando se ve y hay algo que mover ----------
  let raf = 0, ultimo = 0, suma = 0, cuenta = 0, calentar = 20, parado = false, pintada = false;
  const calidad = { nivel: 0, dpr, sombras: true, reflejo: tamR, fpsMedio: 0 };
  function bajarCalidad() {
    calidad.nivel++;
    if (dpr > 1) dpr = Math.max(1, dpr - .25);
    else if (renderer.shadowMap.enabled) { renderer.shadowMap.enabled = false; sl.castShadow = false; tierra.material.needsUpdate = finca.material.needsUpdate = true; calidad.sombras = false; }
    else if (tamR > 256) { tamR = 256; rtR.setSize(tamR, tamR); calidad.reflejo = tamR; }
    else if (dpr > .75) dpr = .75;
    else return;
    calidad.dpr = dpr; renderer.setPixelRatio(dpr); renderer.setSize(bw, bh, false);
  }
  function pedir() { if (!raf && !parado && vista && visible && !document.hidden) raf = requestAnimationFrame(cuadro); }
  function cuadro(t) {
    raf = 0;
    if (parado || !visible || document.hidden) { ultimo = 0; return; }
    const dt = ultimo ? Math.min(120, t - ultimo) : 16;
    const sigue = vista.cuadro(t, dt) !== false;
    if (sigue && !REDUCIDO) uA.time.value += dt / 1000 * .35;
    renderer.render(escena, vista.camara);
    vista.trasPintar?.();
    if (!pintada) { pintada = true; requestAnimationFrame(() => { if (!parado) vista.alPrimerFotograma?.(); }); }
    // calidad automática: media de 45 fotogramas seguidos; por encima de 30 ms, un escalón abajo
    if (ultimo && sigue) {
      if (calentar > 0) calentar--;
      else { suma += dt; if (++cuenta === 45) { calidad.fpsMedio = Math.round(1000 / (suma / cuenta)); if (suma / cuenta > 30) { bajarCalidad(); calentar = 20; } suma = cuenta = 0; } }
    }
    ultimo = sigue ? t : 0;
    if (sigue) pedir();
  }
  function detener() { parado = true; cancelAnimationFrame(raf); raf = 0; }

  // ---------- Pantalla: proyección con la cuenta de object-fit: cover ----------
  const v3 = new THREE.Vector3();
  function aPantalla(p, out = {}) {
    out.visible = false;
    if (!vista || !bw || !bh) return out;
    const cw = vista.caja.clientWidth, ch = vista.caja.clientHeight;
    v3.copy(p).project(vista.camara);
    const s = Math.max(cw / bw, ch / bh), ox = (cw - bw * s) / 2, oy = (ch - bh * s) / 2;
    out.x = ox + (v3.x + 1) / 2 * bw * s; out.y = oy + (1 - v3.y) / 2 * bh * s;
    out.visible = v3.z < 1 && out.x > -40 && out.x < cw + 40 && out.y > -40 && out.y < ch + 40;
    return out;
  }

  // shaders en paralelo (KHR_parallel_shader_compile) y texturas subidas antes del primer fotograma
  const listo = (async () => {
    try { await renderer.compileAsync(escena, new THREE.PerspectiveCamera(42, 1.6, 20, 70000)); } catch (e) { /* se compila al pintar */ }
    await new Promise(r => ('requestIdleCallback' in window ? requestIdleCallback(r, { timeout: 500 }) : setTimeout(r, 0)));
    renderer.initTexture(tex);
    await new Promise(r => ('requestIdleCallback' in window ? requestIdleCallback(r, { timeout: 500 }) : setTimeout(r, 0)));
    renderer.initTexture(texF);
  })();

  return {
    THREE, D, S, escena, renderer, lienzo, listo, CASA, aguja, calidad, ponerHora, pedir, aPantalla, detener, fovPara,
    get visible() { return visible; },
    /** v: { caja, camara, cuadro(t, dt) → false si no hace falta otro fotograma, trasPintar, ajustarCamara, alPrimerFotograma } */
    montar(v) { vista = v; v.caja.appendChild(lienzo); io.observe(v.caja); ro.observe(v.caja); medir(true); pedir(); return v; },
  };
}
