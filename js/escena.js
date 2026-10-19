/* El valle de noche o de día (SVG) con la luna de hoy, y el sonido de la casa (Web Audio, solo tras un clic).
   Lo usan la portada y la sección «De noche» (main.js). Expone window.PONT_ESCENA y window.PONT_SONIDO. */
(function () {
  'use strict';
  var MOV = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS = 'http://www.w3.org/2000/svg';
  function el(padre, t, a, txt) { var e = document.createElementNS(NS, t); for (var k in a) if (a[k] != null) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; padre.appendChild(e); return e; }

  // ---- la luna de hoy (fase media desde la luna nueva del 6-1-2000 18:14 UTC) ----
  var SINODICO = 29.530588853, edad = ((Date.now() - Date.UTC(2000, 0, 6, 18, 14)) / 864e5) % SINODICO, fase = edad / SINODICO;
  var ilum = (1 - Math.cos(2 * Math.PI * fase)) / 2;
  var NOMBRE = fase < .03 || fase > .97 ? 'luna nueva' : fase < .22 ? 'luna creciente' : fase < .28 ? 'cuarto creciente' : fase < .47 ? 'luna gibosa creciente'
    : fase < .53 ? 'luna llena' : fase < .72 ? 'luna gibosa menguante' : fase < .78 ? 'cuarto menguante' : 'luna menguante';
  var lunaTxt = NOMBRE + ', iluminada al ' + Math.round(ilum * 100) + ' %';

  // ---- la hora de Madrid y si es de noche en Cortegada (puesta y salida aproximadas por mes) ----
  var PUESTA = [18.3, 18.9, 19.5, 21.1, 21.6, 22.0, 22.0, 21.6, 20.8, 19.9, 18.4, 18.0], SALIDA = [9.0, 8.7, 8.1, 8.2, 7.4, 7.0, 7.2, 7.7, 8.2, 8.7, 8.3, 8.8];
  function ahora() {
    var p = {}; new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', month: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date()).forEach(function (x) { p[x.type] = +x.value; });
    var h = p.hour + p.minute / 60, mes = p.month - 1;
    return { h: h, mes: mes, hhmm: String(p.hour).padStart(2, '0') + ':' + String(p.minute).padStart(2, '0'), noche: h >= PUESTA[mes] || h < SALIDA[mes], sale: SALIDA[mes], pone: PUESTA[mes] };
  }

  function luna(svg, cx, cy, r) {
    var g = el(svg, 'g', {});
    el(g, 'circle', { cx: cx, cy: cy, r: r * 3.2, fill: 'url(#halo' + svg.id + ')', opacity: .35 + ilum * .5 });
    el(g, 'circle', { cx: cx, cy: cy, r: r, fill: '#1b2333' });
    var k = Math.cos(2 * Math.PI * fase), rx = Math.abs(k) * r, crece = fase < .5, media = ilum < .5;
    var ext = crece ? 1 : 0, int = crece ? (media ? 0 : 1) : (media ? 1 : 0);
    if (ilum > .02) el(g, 'path', { d: 'M' + cx + ' ' + (cy - r) + 'A' + r + ' ' + r + ' 0 0 ' + ext + ' ' + cx + ' ' + (cy + r) + 'A' + rx + ' ' + r + ' 0 0 ' + int + ' ' + cx + ' ' + (cy - r) + 'Z', fill: '#dfe7f3' });
  }
  function azar(s) { return function () { s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5 | 0; return ((s >>> 0) % 10000) / 10000; }; }
  function monte(W, base, amp, f, sem) {
    var r = azar(sem), fs = [r() * 6, r() * 6, r() * 6], d = 'M0 ' + base;
    for (var x = 0; x <= W; x += W / 80) d += 'L' + x.toFixed(1) + ' ' + (base - amp * (.55 * Math.sin(x / W * f * 6.3 + fs[0]) + .3 * Math.sin(x / W * f * 13 + fs[1]) + .15 * Math.sin(x / W * f * 31 + fs[2]))).toFixed(1);
    return d + 'L' + W + ' 9999L0 9999Z';
  }
  // modo: 'noche' | 'dia' | 'lluvia'
  function escena(svg, W, H, modo) {
    svg.textContent = '';
    var dia = modo === 'dia', gris = modo === 'lluvia', defs = el(svg, 'defs', {});
    var gc = el(defs, 'linearGradient', { id: 'cielo' + svg.id, x1: 0, y1: 0, x2: 0, y2: 1 });
    var C = gris ? ['#5d6673', '#8a929c', '#a7adb3'] : dia ? ['#4f84bd', '#93b9d8', '#e3d9c4'] : ['#04070e', '#0d1830', '#1f2f4f'];
    C.forEach(function (c, i) { el(gc, 'stop', { offset: i / 2, 'stop-color': c }); });
    var gh = el(defs, 'radialGradient', { id: 'halo' + svg.id }); el(gh, 'stop', { offset: 0, 'stop-color': '#c9d6e8', 'stop-opacity': .55 }); el(gh, 'stop', { offset: 1, 'stop-color': '#c9d6e8', 'stop-opacity': 0 });
    el(svg, 'rect', { width: W, height: H, fill: 'url(#cielo' + svg.id + ')' });
    var r, i;
    if (!dia && !gris) {
      r = azar(7);
      for (i = 0; i < W * H / 3600; i++) { var s = el(svg, 'circle', { cx: r() * W, cy: r() * H * .62, r: .5 + r() * 1.3, fill: '#e6eeff', opacity: .25 + r() * .7 });
        if (MOV && i % 6 === 0 && s.animate) s.animate([{ opacity: .9 }, { opacity: .2 }, { opacity: .9 }], { duration: 2400 + r() * 3000, iterations: Infinity, delay: -r() * 3000 }); }
      luna(svg, W * .74, H * .2, H * .055);
    }
    if (dia) { el(svg, 'circle', { cx: W * .76, cy: H * .2, r: H * .16, fill: '#fff4d6', opacity: .35 }); el(svg, 'circle', { cx: W * .76, cy: H * .2, r: H * .055, fill: '#fff8e6' }); }
    var capas = gris ? ['#6f7782', '#5a626c', '#454c55', '#2f343b'] : dia ? ['#8aa3b8', '#5d7c62', '#41604a', '#2b4232'] : ['#16233c', '#101a2e', '#0b1322', '#070c16'];
    el(svg, 'path', { d: monte(W, H * .5, H * .11, 1.2, 11), fill: capas[0] });
    el(svg, 'path', { d: monte(W, H * .6, H * .1, 1.7, 23), fill: capas[1] });
    var yR = H * .7;
    el(svg, 'path', { d: 'M0 ' + yR + 'C' + W * .3 + ' ' + (yR - H * .03) + ' ' + W * .55 + ' ' + (yR + H * .04) + ' ' + W + ' ' + (yR - H * .01) + 'L' + W + ' ' + (yR + H * .05) + 'C' + W * .6 + ' ' + (yR + H * .08) + ' ' + W * .3 + ' ' + (yR + H * .02) + ' 0 ' + (yR + H * .045) + 'Z', fill: gris ? '#7d858f' : dia ? '#9dbad0' : '#2a3d63' });
    r = azar(31);
    for (i = 0; i < 26; i++) { var b = el(svg, 'rect', { x: W * (.52 + r() * .4), y: yR + H * (.005 + r() * .03), width: 8 + r() * 40, height: 1.6, rx: 1, fill: dia ? '#fff' : '#dfe7f3', opacity: .5 });
      if (MOV && b.animate) b.animate([{ opacity: .05 }, { opacity: .8 }, { opacity: .05 }], { duration: 1400 + r() * 2200, iterations: Infinity, delay: -r() * 2000 }); }
    el(svg, 'path', { d: monte(W, H * .78, H * .06, 2.2, 5), fill: capas[2] });
    if (!dia) { var q = azar(91); for (i = 0; i < 9; i++) el(svg, 'circle', { cx: W * (.1 + q() * .8), cy: H * (.74 + q() * .05), r: 1.6 + q() * 1.4, fill: '#f1c27d', opacity: .55 + q() * .4 }); }
    el(svg, 'path', { d: monte(W, H * .9, H * .05, 3, 17), fill: capas[3] });
    if (gris) { var z = azar(3); for (i = 0; i < 90; i++) { var x = z() * W, y = z() * H, l = el(svg, 'line', { x1: x, y1: y, x2: x - 6, y2: y + 26, stroke: '#dfe5ec', 'stroke-width': 1, opacity: .35 });
      if (MOV && l.animate) l.animate([{ transform: 'translate(0,-60px)' }, { transform: 'translate(-14px,' + H + 'px)' }], { duration: 900 + z() * 500, iterations: Infinity, delay: -z() * 1200 }); } }
  }
  window.PONT_ESCENA = { escena: escena, ahora: ahora, lunaTxt: lunaTxt, el: el, MOV: MOV };

  // ---- el sonido: todo sintetizado, nada suena hasta que alguien lo pide ----
  var PISTAS = [
    { k: 'rio', t: 'El agua', s: 'el río y el regato' }, { k: 'lluvia', t: 'Lluvia', s: 'en la galería' }, { k: 'lareira', t: 'La lareira', s: 'leña que cruje' },
    { k: 'grillos', t: 'Grillos', s: 'noches de verano' }, { k: 'carabo', t: 'Cárabo', s: 'noches de invierno' }
  ];
  var nivel = { rio: 70, lluvia: 0, lareira: 0, grillos: 0, carabo: 0 };
  var ctx = null, canal = {}, analizador = null, sonando = false, reloj = 0, prox = {}, oyentes = [];
  function ruido(tipo, seg) { var n = ctx.sampleRate * (seg || 3), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), ult = 0;
    for (var i = 0; i < n; i++) { var w = Math.random() * 2 - 1; if (tipo === 'marron') { ult = (ult + .02 * w) / 1.02; d[i] = ult * 3.5; } else d[i] = w; } return b; }
  function filtro(type, f, Q) { var x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = Q || .7; return x; }
  function bucle(buf, nodos) { var s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; var a = s; nodos.forEach(function (n) { a.connect(n); a = n; }); s.start(); }
  function montar() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    var master = ctx.createGain(); master.gain.value = .9; analizador = ctx.createAnalyser(); analizador.fftSize = 1024;
    master.connect(analizador); analizador.connect(ctx.destination);
    PISTAS.forEach(function (p) { canal[p.k] = ctx.createGain(); canal[p.k].gain.value = 0; canal[p.k].connect(master); });
    var marron = ruido('marron'), blanco = ruido('blanco');
    ctx._chas = ruido('blanco', .3);
    var vaiven = ctx.createGain(); vaiven.gain.value = .8; var lfo = ctx.createOscillator(), prof = ctx.createGain(); lfo.frequency.value = .13; prof.gain.value = .25; lfo.connect(prof); prof.connect(vaiven.gain); lfo.start();
    bucle(marron, [filtro('lowpass', 750), vaiven, canal.rio]);
    var agudo = ctx.createGain(); agudo.gain.value = .05; bucle(blanco, [filtro('bandpass', 2400, .6), agudo, canal.rio]);
    var ll = ctx.createGain(); ll.gain.value = .32; bucle(blanco, [filtro('highpass', 900), filtro('lowpass', 7000), ll, canal.lluvia]);
    var fu = ctx.createGain(); fu.gain.value = .45; bucle(marron, [filtro('lowpass', 160), fu, canal.lareira]);
  }
  function golpe(destino, t, o) {
    var f = o.f || 600, f2 = o.f2 || f, dur = o.dur || .05, g = o.g || .3;
    if (o.q) { var s = ctx.createBufferSource(); s.buffer = ctx._chas; var bp = filtro('bandpass', f, o.q), e = ctx.createGain();
      e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(.001, t + dur); s.connect(bp); bp.connect(e); e.connect(destino); s.start(t, Math.random() * .2, dur + .02); return; }
    var osc = ctx.createOscillator(), en = ctx.createGain(); osc.frequency.setValueAtTime(f, t); osc.frequency.exponentialRampToValueAtTime(f2, t + dur);
    en.gain.setValueAtTime(0, t); en.gain.linearRampToValueAtTime(g, t + Math.min(.02, dur / 3)); en.gain.exponentialRampToValueAtTime(.001, t + dur); osc.connect(en); en.connect(destino); osc.start(t); osc.stop(t + dur + .05);
  }
  function programar() {
    var t = ctx.currentTime, R = Math.random;
    function toca(k, cada, fn) { if (!nivel[k]) return; if (!prox[k] || prox[k] < t) prox[k] = t + R() * cada; while (prox[k] < t + .25) { fn(prox[k]); prox[k] += cada * (.4 + R() * 1.2); } }
    toca('rio', .35, function (x) { golpe(canal.rio, x, { f: 300 + R() * 500, f2: 700 + R() * 900, dur: .04 + R() * .05, g: .05 + R() * .07 }); });
    toca('lluvia', .03, function (x) { golpe(canal.lluvia, x, { f: 2500 + R() * 4000, dur: .012, g: .12 + R() * .2, q: 4 }); });
    toca('lareira', .22, function (x) { golpe(canal.lareira, x, { f: 1800 + R() * 2600, dur: .008 + R() * .02, g: .5 + R() * .5, q: 2 }); });
    toca('grillos', .9, function (x) { for (var i = 0; i < 3; i++) golpe(canal.grillos, x + i * .055, { f: 4400, dur: .035, g: .08 }); });
    toca('carabo', 9, function (x) { golpe(canal.carabo, x, { f: 410, f2: 380, dur: .55, g: .32 }); for (var i = 0; i < 5; i++) golpe(canal.carabo, x + 1.6 + i * .16, { f: 400 - i * 4, f2: 395 - i * 4, dur: .14, g: .2 - i * .02 }); golpe(canal.carabo, x + 2.5, { f: 420, f2: 360, dur: .9, g: .3 }); });
  }
  function aplicar() { if (!ctx) return; PISTAS.forEach(function (p) { canal[p.k].gain.setTargetAtTime(sonando ? Math.pow(nivel[p.k] / 100, 1.6) : 0, ctx.currentTime, .25); }); }
  function encender(on) {
    try { if (on && !ctx) montar(); } catch (e) { return; }
    sonando = on; if (ctx) { if (on) ctx.resume(); aplicar(); }
    clearInterval(reloj); if (on) reloj = setInterval(programar, 120);
    oyentes.forEach(function (f) { f(on); });
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden && sonando) encender(false); });
  window.PONT_SONIDO = {
    PISTAS: PISTAS, nivel: nivel,
    poner: function (k, v) { nivel[k] = v; aplicar(); },
    encender: encender, sonando: function () { return sonando; },
    alCambiar: function (f) { oyentes.push(f); },
    analizador: function () { return analizador; }
  };
})();
