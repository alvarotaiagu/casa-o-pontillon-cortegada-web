// Mandos de la hora (barra, momentos, lectura) y el chip de «ahora». Sin Three.js: funcionan también sin 3D
// (la lectura dice en texto dónde está el sol o la luna a esa hora).
const $ = id => document.getElementById(id);

/** El chip de «Ahora en O Pontillón…», cada 30 s */
export function montarChip(S) {
  const chip = $('rio-chip');
  if (!chip) return;
  const poner = () => { chip.textContent = S.textoChip(); };
  poner(); setInterval(poner, 30000);
}

/** La barra de hora, los momentos del día y la lectura (aria-live, se escribe al parar la barra) */
export function montarMandos(S) {
  const rango = $('rio-hora'), txt = $('rio-hora-txt'), lect = $('rio-lectura');
  const oyentes = [];
  let minuto = S.minutoAhora(), tLect = 0;
  const pintar = inmediato => {
    minuto = +rango.value;
    if (txt) txt.textContent = S.hhmm(minuto);
    rango.setAttribute('aria-valuetext', S.hhmm(minuto));
    for (const f of oyentes) f(minuto);
    clearTimeout(tLect);
    if (!lect) return;
    if (inmediato) lect.textContent = S.lectura(minuto); else tLect = setTimeout(() => { lect.textContent = S.lectura(minuto); }, 350);
  };
  const ir = m => { rango.value = String(((Math.round(m) % 1440) + 1440) % 1440); pintar(true); };
  if (rango) {
    rango.addEventListener('input', () => pintar(false));
    document.querySelectorAll('#rio [data-h]').forEach(b => b.addEventListener('click', () => ir(S.momento(b.dataset.h))));
    ir(S.minutoAhora());
  }
  return { get minuto() { return minuto; }, ir, escuchar(f) { oyentes.push(f); f(minuto); } };
}
