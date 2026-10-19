// El sol y la luna en O Pontillón (fórmulas de SunCalc) y la hora de Madrid.
// Sin Three.js: arranque.js lo usa para el chip, la barra de hora y la lectura aunque no haya WebGL.
//
// Para pruebas y para el póster: ?ahora3d=2026-10-19T16:30 fija «ahora» (hora de Madrid).

const rad = Math.PI / 180, OBL = rad * 23.4397;
export const LAT = 42.21599, LON = -8.16337;   // Os Muíños, Rabiño (Cortegada)

const diasDe = d => d.valueOf() / 864e5 - .5 + 2440588 - 2451545;
function aCielo(dias, ra, dec) {   // ascensión recta y declinación → acimut (desde el norte) y altura, en grados
  const H = rad * (280.16 + 360.9856235 * dias) - rad * -LON - ra, phi = rad * LAT;
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  return { az: (az / rad + 180 + 360) % 360, alt: alt / rad };
}
function solEq(dias) {
  const M = rad * (357.5291 + .98560028 * dias);
  const Lc = M + rad * (1.9148 * Math.sin(M) + .02 * Math.sin(2 * M) + .0003 * Math.sin(3 * M)) + rad * 102.9372 + Math.PI;
  return { dec: Math.asin(Math.sin(OBL) * Math.sin(Lc)), ra: Math.atan2(Math.sin(Lc) * Math.cos(OBL), Math.cos(Lc)) };
}
function lunaEq(dias) {
  const Lm = rad * (218.316 + 13.176396 * dias), M = rad * (134.963 + 13.064993 * dias), F = rad * (93.272 + 13.22935 * dias);
  const l = Lm + rad * 6.289 * Math.sin(M), b = rad * 5.128 * Math.sin(F);
  return { ra: Math.atan2(Math.sin(l) * Math.cos(OBL) - Math.tan(b) * Math.sin(OBL), Math.cos(l)),
    dec: Math.asin(Math.sin(b) * Math.cos(OBL) + Math.cos(b) * Math.sin(OBL) * Math.sin(l)), dist: 385001 - 20905 * Math.cos(M) };
}
/** { az, alt } del sol en grados */
export const sol = d => { const dd = diasDe(d), e = solEq(dd); return aCielo(dd, e.ra, e.dec); };
/** { az, alt, luz (0–1 iluminada), crece } de la luna */
export function luna(d) {
  const dd = diasDe(d), s = solEq(dd), m = lunaEq(dd), p = aCielo(dd, m.ra, m.dec);
  const phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
  const inc = Math.atan2(149598000 * Math.sin(phi), m.dist - 149598000 * Math.cos(phi));
  const ang = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra), Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
  return { ...p, luz: (1 + Math.cos(inc)) / 2, crece: ang < 0 };
}

const TZ = 'Europe/Madrid';
const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const partes = d => Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]));
// minutos que Madrid va por delante de UTC en ese instante (60 o 120)
const desfase = d => { const t = Math.floor(d.getTime() / 6e4) * 6e4, p = partes(new Date(t)); return Math.round((Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute) - t) / 6e4); };

let corrimiento = 0;
try {
  const q = new URLSearchParams(location.search).get('ahora3d');
  const m = q && /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)$/.exec(q);
  if (m) { const b = Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]); corrimiento = b - desfase(new Date(b)) * 6e4 - Date.now(); }
} catch (e) { /* sin URL: hora real */ }
export const ahora = () => new Date(Date.now() + corrimiento);

const HOY = partes(ahora());
/** Fecha de hoy (en Madrid) a los m minutos del día */
export const fechaDe = m => { const b = Date.UTC(+HOY.year, HOY.month - 1, +HOY.day, 0, m); return new Date(b - desfase(new Date(b)) * 6e4); };
export const minutoAhora = () => { const p = partes(ahora()); return +p.hour * 60 + +p.minute; };
export const hhmm = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };

/** Salida, puesta y mediodía solar de hoy (minutos) */
export const DIA = (() => {
  let sale = null, pone = null, ant = sol(fechaDe(0)).alt;
  for (let m = 2; m < 1440; m += 2) { const a = sol(fechaDe(m)).alt; if (ant < -.833 && a >= -.833) sale = m; if (ant >= -.833 && a < -.833) pone = m; ant = a; }
  let alto = -90, mAlto = 720; for (let m = 600; m < 960; m += 2) { const a = sol(fechaDe(m)).alt; if (a > alto) { alto = a; mAlto = m; } }
  return { sale, pone, mediodia: mAlto, alto };
})();
/** Minuto de cada momento de los botones (data-h) */
export const momento = k => k === 'ahora' ? minutoAhora() : k === 'sale' ? (DIA.sale ?? 480) + 20 : k === 'pone' ? (DIA.pone ?? 1140) - 25
  : k === 'mediodia' ? DIA.mediodia : ((DIA.pone ?? 1140) + 150) % 1440;

export const RUMBO = az => ['norte', 'nordeste', 'este', 'sudeste', 'sur', 'suroeste', 'oeste', 'noroeste'][Math.round(az / 45) % 8];
export const FASE = l => (l.luz < .04 ? 'luna nueva' : l.luz > .96 ? 'luna llena' : (l.crece ? 'luna creciente' : 'luna menguante'))
  + (l.luz >= .04 && l.luz <= .96 ? ` al ${Math.round(l.luz * 100)} %` : '');

/** Texto del chip: «Ahora en O Pontillón · 16:30 · sol a 29° por el suroeste» */
export function textoChip() {
  const m = minutoAhora(), f = fechaDe(m), s = sol(f);
  let cielo;
  if (s.alt > 0) cielo = `sol a ${Math.round(s.alt)}° por el ${RUMBO(s.az)}`;
  else if (s.alt > -6) cielo = 'crepúsculo';
  else { const l = luna(f); cielo = l.alt > 0 ? `${FASE(l)} sobre el río` : 'de noche, sin luna todavía'; }
  return `Ahora en O Pontillón · ${hhmm(m)} · ${cielo}`;
}

/** La lectura de la barra de hora (lo mismo que se ve, en texto) */
export function lectura(m) {
  const f = fechaDe(m), s = sol(f), a = Math.round(s.alt), r = RUMBO(s.az);
  const cab = DIA.sale != null ? `Hoy en O Pontillón el sol sale a las ${hhmm(DIA.sale)} y se pone a las ${hhmm(DIA.pone)}. ` : '';
  if (s.alt < -6) {
    const l = luna(f);
    return cab + (l.alt > 0 ? `A las ${hhmm(m)} es de noche y hay ${FASE(l)} a ${Math.round(l.alt)}° por el ${RUMBO(l.az)}: el embalse devuelve su reflejo y el de las estrellas.`
      : `A las ${hhmm(m)} es de noche y la luna (${FASE(l)}) aún no ha salido: el agua es un espejo negro con estrellas.`);
  }
  return cab + (s.alt < 0 ? `A las ${hhmm(m)} es el crepúsculo: el fondo del valle ya está en sombra y el agua guarda el último color del cielo.`
    : s.alt < 12 ? `A las ${hhmm(m)} el sol está bajo, a ${a}° por el ${r}: media ladera del valle en sombra y el reflejo del sol corriendo por el agua.`
    : s.alt < 30 ? `A las ${hhmm(m)} el sol está a ${a}° por el ${r}. Las laderas que miran al norte quedan en sombra; el agua refleja el cielo.`
    : `A las ${hhmm(m)} el sol está alto, a ${a}° por el ${r}, y entra hasta el agua en el fondo del valle.`);
}
