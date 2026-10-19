/* Casa O Pontillón · todo lo de la web menos el 3D (js/3d/) y la escena y el sonido (js/escena.js) */
(function () {
  'use strict';
  var D = document.documentElement, $ = function (id) { return document.getElementById(id); };
  var E = window.PONT_ESCENA, S = window.PONT_SONIDO, MOV = E.MOV, el = E.el;
  var espera = function (ms) { return new Promise(function (r) { setTimeout(r, MOV ? ms : 0); }); };
  var anima = function (n, kf, op) { if (!n || !MOV || !n.animate) return Promise.resolve(); var a = n.animate(kf, Object.assign({ fill: 'forwards', easing: 'cubic-bezier(.65,0,.35,1)' }, op)); return a.finished.catch(function () {}); };
  var pop = function (n, delay) { if (MOV && n.animate) n.animate([{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1.18)', opacity: 1, offset: .6 }, { transform: 'scale(1)', opacity: 1 }], { duration: 520, delay: delay || 0, easing: 'cubic-bezier(.34,1.4,.64,1)', fill: 'backwards' }); };
  var A = E.ahora();

  // ---------- 1. cortina: los cristales de la galería se encienden de abajo arriba ----------
  (function () {
    var c = $('cortina'); if (!c) return;
    if (!D.classList.contains('cortina-puesta')) { c.hidden = true; return; }
    var cr = c.querySelectorAll('.cortina-galeria i'), nombre = c.querySelector('.cortina-nombre'), gal = $('cortina-galeria');
    var orden = [6, 7, 4, 5, 2, 3, 0, 1], fuera = false;
    var quitar = function () { if (fuera) return; fuera = true; c.hidden = true; window.__pontFuera(); };
    setTimeout(quitar, 4200);   // pase lo que pase
    (async function () {
      await espera(250);
      for (var i = 0; i < orden.length; i++) { cr[orden[i]].classList.add('on'); await espera(130); }
      anima(nombre, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: 'ease-out' });
      await espera(550);
      anima(gal, [{ transform: 'scale(1)' }, { transform: 'scale(9)', opacity: 0 }], { duration: 1000, easing: 'cubic-bezier(.7,0,.84,0)' });
      document.dispatchEvent(new Event('pontillon:cortina-abre'));
      await anima(c, [{ opacity: 1 }, { opacity: 1, offset: .5 }, { opacity: 0 }], { duration: 1000, easing: 'linear' });
      quitar();
    })();
  })();

  // ---------- 2. portada: el valle con el cielo de ahora; arrastrar de lado mueve la hora ----------
  (function () {
    var por = $('arriba'), noche = $('cielo-noche'), dia = $('cielo-dia');
    E.escena(noche, 1600, 1000, 'noche'); E.escena(dia, 1600, 1000, 'dia');
    var v = A.noche ? 0 : 1;
    var txt = $('portada-ahora');
    var pintar = function () { por.style.setProperty('--dia', v.toFixed(3)); };
    var leer = function () { txt.textContent = v < .5 ? 'Esta noche en Os Muíños · ' + E.lunaTxt : 'Hoy en Os Muíños · junto al Miño · ' + A.hhmm; };
    pintar(); txt.textContent = (A.noche ? 'Ahora en Os Muíños · ' + A.hhmm + ' · ' + E.lunaTxt : 'Ahora en Os Muíños · ' + A.hhmm + ' · junto al Miño');
    // la ventana se abre al retirarse la cortina
    var ven = por.querySelector('.ventana');
    var abrir = function () { if (!MOV) return; ven.animate([{ '--abre': '4deg' }, { '--abre': '64deg' }], { duration: 1600, easing: 'cubic-bezier(.16,1,.3,1)' }); };
    try { CSS.registerProperty({ name: '--abre', syntax: '<angle>', inherits: true, initialValue: '64deg' }); } catch (e) {}
    document.addEventListener('pontillon:cortina-abre', abrir, { once: true });
    // gesto: arrastrar de lado (ratón o dedo) pasa de la noche al día; en vertical, scroll
    var x0 = null, y0 = 0, v0 = 0, decidido = false, lateral = false;
    por.addEventListener('pointerdown', function (e) { if (e.target.closest('a,button')) return; x0 = e.clientX; y0 = e.clientY; v0 = v; decidido = false; lateral = false; });
    por.addEventListener('pointermove', function (e) {
      if (x0 === null) return;
      var dx = e.clientX - x0, dy = e.clientY - y0;
      if (!decidido && Math.hypot(dx, dy) > 9) { decidido = true; lateral = Math.abs(dx) > Math.abs(dy); if (lateral) try { por.setPointerCapture(e.pointerId); } catch (er) {} }
      if (!lateral) return;
      v = Math.max(0, Math.min(1, v0 + dx / (por.clientWidth * .6))); pintar(); leer();
    });
    var soltar = function () { x0 = null; };
    por.addEventListener('pointerup', soltar); por.addEventListener('pointercancel', soltar);
  })();

  // ---------- 3. el sonido: los dos botones manejan lo mismo ----------
  (function () {
    var bs = [$('oir-portada'), $('oir-noche')];
    bs.forEach(function (b) { b.addEventListener('click', function () { S.encender(!S.sonando()); }); });
    S.alCambiar(function (on) {
      bs.forEach(function (b) { b.setAttribute('aria-pressed', on); });
      $('oir-portada').querySelector('.t').textContent = on ? 'Silenciar' : 'Escuchar el río';
      $('oir-noche').querySelector('.t').textContent = on ? 'Apagar el sonido' : 'Encender el sonido';
      if (on) onda();
    });
    // la mesa de sonido
    var cont = $('pistas');
    S.PISTAS.forEach(function (p) {
      var d = document.createElement('div'); d.className = 'pista';
      d.innerHTML = '<label for="p-' + p.k + '">' + p.t + '<small>' + p.s + '</small></label><input type="range" id="p-' + p.k + '" min="0" max="100" step="1"><output id="o-' + p.k + '"></output>';
      cont.appendChild(d);
      var i = d.querySelector('input'); i.addEventListener('input', function () { S.poner(p.k, +i.value); $('o-' + p.k).textContent = i.value; marcar(null); });
    });
    var barras = function () { S.PISTAS.forEach(function (p) { $('p-' + p.k).value = S.nivel[p.k]; $('o-' + p.k).textContent = S.nivel[p.k]; }); };
    var frio = A.mes >= 9 || A.mes <= 3, calor = A.mes >= 5 && A.mes <= 7;
    var MEZ = {
      ahora: { n: { rio: 70, lluvia: 0, lareira: frio && (A.noche || A.h > 17) ? 45 : 0, grillos: calor && A.noche ? 50 : 0, carabo: frio && A.noche ? 40 : 0 }, modo: A.noche ? 'noche' : 'dia',
        t: 'Ahora en Os Muíños son las ' + A.hhmm + '. ' + (A.noche ? 'Es de noche, con ' + E.lunaTxt + '.' : 'Es de día.') + (frio ? ' Época de lareira encendida.' : calor ? ' Época de grillos.' : '') },
      verano: { n: { rio: 65, lluvia: 0, lareira: 0, grillos: 70, carabo: 0 }, modo: 'noche', t: 'Una noche de agosto: la ventana abierta, el agua abajo y los grillos en la viña.' },
      invierno: { n: { rio: 55, lluvia: 0, lareira: 70, grillos: 0, carabo: 55 }, modo: 'noche', t: 'Una noche de enero: la lareira encendida en el comedor y un cárabo en los robles.' },
      lluvia: { n: { rio: 60, lluvia: 75, lareira: 35, grillos: 0, carabo: 0 }, modo: 'lluvia', t: 'Un día de lluvia en el Ribeiro: el agua en los cristales de la galería y la leña ardiendo.' }
    };
    var marcar = function (k) { document.querySelectorAll('#sonido [data-mez]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.mez === k); }); };
    var mezcla = function (k) { var z = MEZ[k]; for (var p in z.n) S.poner(p, z.n[p]); barras(); E.escena($('cielo-sonido'), 600, 420, z.modo); $('s-ahora').textContent = z.t; marcar(k); };
    document.querySelectorAll('#sonido [data-mez]').forEach(function (b) { b.addEventListener('click', function () { mezcla(b.dataset.mez); }); });
    mezcla('ahora');
    // la onda de lo que suena, sobre el río
    var cv = $('onda'), g = cv.getContext('2d'), datos = null;
    var tam = function () { var k = Math.min(2, devicePixelRatio || 1); cv.width = cv.clientWidth * k; cv.height = cv.clientHeight * k; };
    new ResizeObserver(tam).observe(cv); tam();
    function onda() {
      var w = cv.width, h = cv.height, an = S.analizador(); g.clearRect(0, 0, w, h);
      if (!S.sonando() || !an) { g.strokeStyle = 'rgba(241,194,125,.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke(); return; }
      datos = datos || new Uint8Array(an.fftSize); an.getByteTimeDomainData(datos);
      g.strokeStyle = 'rgba(241,194,125,.75)'; g.lineWidth = 1.6; g.beginPath();
      for (var i = 0; i < datos.length; i++) { var x = i / (datos.length - 1) * w, y = h / 2 + (datos[i] - 128) / 128 * h * .7; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke(); if (MOV) requestAnimationFrame(onda);
    }
    onda();
  })();

  // ---------- 4. cabecera: sólida al bajar, el puentecillo se traza con la lectura; menú móvil ----------
  (function () {
    var cab = $('cab'), lec = $('cab-lectura'), tic = false;
    var leer = function () {
      tic = false;
      var y = scrollY, max = document.documentElement.scrollHeight - innerHeight, k = max > 0 ? Math.min(1, y / max) : 0;
      cab.classList.toggle('es-solida', y > 40);
      lec.style.strokeDashoffset = (1 - k).toFixed(4);
      cab.classList.toggle('es-completa', k > .985);
    };
    addEventListener('scroll', function () { if (!tic) { tic = true; requestAnimationFrame(leer); } }, { passive: true }); leer();
    var btn = $('menu-btn'), menu = $('menu-movil');
    var poner = function (on) { menu.hidden = !on; btn.setAttribute('aria-expanded', on); btn.textContent = on ? 'Cerrar' : 'Menú'; document.body.style.overflow = on ? 'hidden' : ''; cab.classList.toggle('es-solida', on || scrollY > 40); };
    btn.addEventListener('click', function () { poner(menu.hidden); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) poner(false); });
    addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { poner(false); btn.focus(); } });
  })();

  // ---------- 5. la galería: cada cristal abre una parte de la casa ----------
  (function () {
    var gal = $('galeria'), cris = gal.querySelectorAll('.cristal'), figs = gal.querySelectorAll('.g-fotos figure');
    var T = [
      ['Para dormir', 'Un cuarto con la ventana al verde', 'Cinco dormitorios con cama doble y uno con dos camas. Cada uno, con su baño: en grupo, nadie espera.'],
      ['Para dormir', 'Seis puertas, seis baños', 'Booking cuenta siete baños para seis dormitorios. «Cada habitación tenía su propio lavabo», escribe Agustí.'],
      ['Para dormir', 'El de las dos camas', 'Para los niños o para quien no comparte. Hay cuna gratis si la pides. La calefacción, dicen, va muy bien.'],
      ['Para estar', 'El salón', 'Tresillos, tele y aire acondicionado. 250 metros cuadrados en total: sitio para no estar encima unos de otros.'],
      ['Para estar', 'Una cocina para un grupo', 'Cocina entera con lavavajillas, y lavadora en casa. Y si no queréis cocinar, desayuno por 5 € por persona.'],
      ['Para estar', 'La mesa larga', 'Manteles de cuadros y dos mesas puestas una detrás de otra: aquí cenan doce.'],
      ['Abajo, la piedra', 'La entrada de granito', 'Piedra vista, suelo de barro y una barrica en el recibidor. Aquí empieza el Ribeiro.'],
      ['Abajo, la piedra', 'El comedor de la lareira', '«Tiene un comedor con lareira espectacular en la planta baja», escribe Rebeca. Mesa de madera y bancos para todos.'],
      ['Abajo, la piedra', 'Lo que guarda la pared', 'Cántaros, botellas y una radio vieja en los huecos del muro. La casa es de 1995, hecha con la piedra de siempre.']
    ];
    var elegir = function (i) {
      cris.forEach(function (b, k) { b.setAttribute('aria-pressed', k === i); });
      figs.forEach(function (f) { f.hidden = +f.dataset.i !== i; });
      $('g-planta').textContent = T[i][0]; $('g-tit').textContent = T[i][1]; $('g-txt').textContent = T[i][2];
      var img = figs[i].querySelector('img'); if (img && MOV) img.animate([{ opacity: 0, transform: 'scale(1.03)' }, { opacity: 1, transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.16,1,.3,1)' });
    };
    cris.forEach(function (b) { b.addEventListener('click', function () { elegir(+b.dataset.i); }); });
    var bn = $('g-noche'), bt = $('g-todos');
    var encendida = function (on) { gal.classList.toggle('encendida', on); bn.setAttribute('aria-pressed', on); bn.textContent = on ? 'Apagar la galería' : 'Encender la galería'; };
    bn.addEventListener('click', function () { encendida(!gal.classList.contains('encendida')); });
    bt.addEventListener('click', function () { var on = gal.classList.toggle('todos'); bt.setAttribute('aria-pressed', on); bt.textContent = on ? 'Cerrar todos' : 'Abrir todos'; });
    encendida(A.noche);
  })();

  // ---------- 6. ¿cómo dormimos? ----------
  (function () {
    var svg = $('esquema'), est = { n: 8, p: 3, b: 0 };
    var COL = ['#b0563a', '#2e6b5e', '#c99a2e', '#6d4c8a', '#3d6fa0', '#8f2e25'], SOLO = '#7a6a5a';
    el(svg, 'polygon', { points: '110,118 480,26 870,118', fill: '#b0563a', stroke: '#6b2f17', 'stroke-width': 3, 'stroke-linejoin': 'round' });
    for (var i = 0; i < 9; i++) el(svg, 'line', { x1: 150 + i * 84, y1: 116, x2: 480, y2: 30, stroke: '#8a3f22', 'stroke-width': 1, opacity: .35 });
    el(svg, 'rect', { x: 20, y: 70, width: 96, height: 470, rx: 40, fill: '#8c8274', stroke: '#1d1a17', 'stroke-width': 2 });
    for (var r = 0; r < 5; r++) for (var c = 0; c < 2; c++) el(svg, 'rect', { x: 34 + c * 35, y: 108 + r * 58, width: 33, height: 54, fill: r % 2 ? '#bfe0d6' : '#9fd0c0', stroke: '#2e6b5e', 'stroke-width': 4 });
    el(svg, 'text', { x: 68, y: 418, 'text-anchor': 'middle', class: 'subc', fill: '#1d1a17' }, 'galería');
    var CU = [];
    for (i = 0; i < 6; i++) {
      var col = i % 3, fi = Math.floor(i / 3), x = 130 + col * 247, y = 124 + fi * 150, gr = el(svg, 'g', {});
      var rect = el(gr, 'rect', { x: x, y: y, width: 247, height: 150, class: 'cuarto' });
      el(gr, 'text', { x: x + 12, y: y + 22, class: 'rotc' }, 'Dormitorio ' + (i + 1));
      el(gr, 'text', { x: x + 12, y: y + 39, class: 'subc' }, i === 0 ? 'dos camas' : 'cama doble');
      el(gr, 'rect', { x: x + 188, y: y + 10, width: 50, height: 66, rx: 4, class: 'bano' });
      el(gr, 'rect', { x: x + 195, y: y + 40, width: 36, height: 28, rx: 10, fill: '#fff', stroke: '#2e6b5e', 'stroke-width': 1.4 });
      el(gr, 'text', { x: x + 213, y: y + 30, 'text-anchor': 'middle', class: 'subc', fill: '#2e6b5e' }, 'baño');
      (i === 0 ? [[x + 22, y + 58, 52], [x + 96, y + 58, 52]] : [[x + 30, y + 54, 100]]).forEach(function (cm) {
        el(gr, 'rect', { x: cm[0], y: cm[1], width: cm[2], height: 84, rx: 6, class: 'cama' });
        if (cm[2] > 60) { el(gr, 'rect', { x: cm[0] + 8, y: cm[1] + 6, width: 38, height: 16, rx: 5, class: 'almohada' }); el(gr, 'rect', { x: cm[0] + 54, y: cm[1] + 6, width: 38, height: 16, rx: 5, class: 'almohada' }); }
        else el(gr, 'rect', { x: cm[0] + 8, y: cm[1] + 6, width: 36, height: 16, rx: 5, class: 'almohada' });
      });
      CU.push({ rect: rect, capa: el(gr, 'g', {}), sitios: i === 0 ? [[x + 48, y + 100], [x + 122, y + 100]] : [[x + 62, y + 100], [x + 98, y + 100]], cuna: [x + 160, y + 120] });
    }
    el(svg, 'rect', { x: 130, y: 424, width: 460, height: 116, class: 'cuarto' });
    el(svg, 'text', { x: 142, y: 446, class: 'rotc' }, 'Comedor con lareira');
    el(svg, 'path', { d: 'M150 540V478h46v62M156 478l17-18 17 18', fill: '#8c8274', stroke: '#1d1a17', 'stroke-width': 2 });
    el(svg, 'path', { d: 'M162 540q11-26 22 0', fill: '#e59a52' });
    el(svg, 'rect', { x: 236, y: 476, width: 330, height: 36, rx: 6, fill: '#73502f' });
    var PL = []; for (i = 0; i < 12; i++) PL.push(el(svg, 'circle', { cx: 262 + (i % 6) * 56, cy: i < 6 ? 466 : 522, r: 9, class: 'plato' }));
    el(svg, 'rect', { x: 590, y: 424, width: 125, height: 116, class: 'cuarto' }); el(svg, 'text', { x: 602, y: 446, class: 'rotc' }, 'Cocina'); el(svg, 'text', { x: 602, y: 464, class: 'subc' }, 'y asador');
    el(svg, 'rect', { x: 715, y: 424, width: 125, height: 116, class: 'cuarto' }); el(svg, 'text', { x: 727, y: 446, class: 'rotc' }, 'Salón');
    el(svg, 'text', { x: 840, y: 556, 'text-anchor': 'end', class: 'subc' }, 'esquema, no es el plano real');
    var persona = function (capa, s, color, k) { var g = el(capa, 'g', { style: 'transform-box:fill-box;transform-origin:center' });
      el(g, 'circle', { cx: s[0], cy: s[1], r: 13, fill: color, class: 'persona' }); el(g, 'circle', { cx: s[0], cy: s[1] - 22, r: 7, fill: color, class: 'persona' }); pop(g, k * 60); };
    var pintar = function () {
      var n = est.n, p = est.p, b = est.b, solos = n - 2 * p, k = 0;
      CU.forEach(function (c) { c.capa.textContent = ''; c.rect.classList.add('vacio'); });
      var ocupa = [[], [], [], [], [], []];
      for (var j = 0; j < p; j++) { var rr = j < 5 ? j + 1 : 0; ocupa[rr].push({ col: COL[j % 6] }, { col: COL[j % 6] }); }
      var s = solos;
      [0, 1, 2, 3, 4, 5].filter(function (q) { return !ocupa[q].length; }).forEach(function (q) { var cab = q === 0 ? 2 : 1; for (var m = 0; m < cab && s; m++, s--) ocupa[q].push({ col: SOLO, solo: true }); });
      [1, 2, 3, 4, 5].forEach(function (q) { if (s && ocupa[q].length === 1 && ocupa[q][0].solo) { ocupa[q].push({ col: SOLO, solo: true }); s--; } });
      var cunas = b;
      ocupa.forEach(function (o, q) {
        if (!o.length) return; CU[q].rect.classList.remove('vacio');
        o.forEach(function (z, m) { persona(CU[q].capa, CU[q].sitios[m], z.col, k++); });
        if (cunas && !o[0].solo) { cunas--; var cx = CU[q].cuna[0], cy = CU[q].cuna[1], g = el(CU[q].capa, 'g', { style: 'transform-box:fill-box;transform-origin:center' });
          el(g, 'rect', { x: cx - 16, y: cy - 26, width: 32, height: 34, rx: 6, fill: '#fffaf0', stroke: '#6b4a2e', 'stroke-width': 1.6 }); el(g, 'circle', { cx: cx, cy: cy - 10, r: 6, fill: '#c99a2e' }); pop(g, k * 60); }
      });
      PL.forEach(function (pl, m) { pl.classList.toggle('off', m >= n); });
      var vacios = ocupa.filter(function (o) { return !o.length; }).length, comparten = ocupa.slice(1).some(function (o) { return o.length === 2 && o[0].solo; });
      var partes = [];
      if (p) partes.push(p === 1 ? 'una pareja en una cama doble' : p + ' parejas, cada una en su cuarto');
      if (solos) partes.push(solos === 1 ? 'una persona sola' : solos + ' personas que duermen solas');
      $('c-res').textContent = n + (n === 1 ? ' persona' : ' personas') + (b ? ' y ' + (b === 1 ? 'un bebé' : b + ' bebés') + ' en cuna' : '') + ': ' + partes.join(' y ') + '. '
        + (comparten ? 'Alguno comparte cama doble. ' : '') + (vacios ? 'Os ' + (vacios === 1 ? 'sobra un cuarto' : 'sobran ' + vacios + ' cuartos') + ', con su baño.' : 'La casa, llena: doce en la mesa.')
        + ($('c-perro').checked ? ' El perro, gratis.' : '');
      var noche = 118 + 8.35 * n;
      $('c-noche').textContent = Math.round(noche) + ' €'; $('c-pp').textContent = Math.round(noche / n) + ' €';
      $('c-n').textContent = n; $('c-p').textContent = p; $('c-b').textContent = b; $('c-ir').textContent = 'Ver fechas para ' + n;
      document.querySelectorAll('#grupo .paso button').forEach(function (bt) { var d = bt.dataset.d, x = est[d] + +bt.dataset.v;
        bt.disabled = d === 'n' ? x < 1 || x > 12 : d === 'p' ? x < 0 || 2 * x > est.n || x > 6 : x < 0 || x > 3; });
    };
    document.querySelectorAll('#grupo .paso button').forEach(function (bt) { bt.addEventListener('click', function () { est[bt.dataset.d] += +bt.dataset.v; if (2 * est.p > est.n) est.p = Math.floor(est.n / 2); pintar(); }); });
    $('c-perro').addEventListener('change', pintar);
    $('c-ir').addEventListener('click', function () { window.reservaGrupo(est.n); });
    pintar();
  })();

  // ---------- 7. reserva: motor de DEMOSTRACIÓN (no envía nada) ----------
  (function () {
    var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    var vista = new Date(hoy.getFullYear(), hoy.getMonth(), 1), ini = null, fin = null;
    var fmtMes = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }), fmtDia = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
    var eur = function (n) { return n.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €'; };
    var azar = function (d, s) { var h = d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate() + s * 7919; h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^ (h >>> 16)) >>> 0) % 100; };
    var finde = function (d) { return d.getDay() === 5 || d.getDay() === 6; }, verano = function (d) { return d.getMonth() >= 6 && d.getMonth() <= 7; };
    var ocupado = function (d) { return azar(d, 3) < (finde(d) ? 55 : 18) + (verano(d) ? 25 : 0); };
    // precio por noche ajustado a Booking (noviembre de 2026): 2 pers. ≈ 135 €, 12 pers. ≈ 218 €; verano +15 % (supuesto)
    var noche = function (d, p) { return (118 + 8.35 * p) * (verano(d) ? 1.15 : 1); };
    var mismo = function (a, b) { return a && b && a.getTime() === b.getTime(); };
    var libre = function (a, b) { for (var d = new Date(a); d < b; d.setDate(d.getDate() + 1)) if (ocupado(d)) return false; return true; };
    var sel = $('res-pers');
    for (var i = 1; i <= 12; i++) { var o = document.createElement('option'); o.value = i; o.textContent = i + (i === 1 ? ' persona' : ' personas'); sel.appendChild(o); }
    sel.value = 8;
    var pintar = function () {
      var t = fmtMes.format(vista); $('cal-mes').textContent = t[0].toUpperCase() + t.slice(1);
      $('cal-ant').disabled = vista <= new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      var cal = $('cal'); cal.textContent = '';
      ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'].forEach(function (d) { var s = document.createElement('span'); s.className = 'dia-sem'; s.textContent = d; cal.appendChild(s); });
      var desf = (vista.getDay() + 6) % 7, dias = new Date(vista.getFullYear(), vista.getMonth() + 1, 0).getDate();
      for (var k = 0; k < desf; k++) { var v = document.createElement('button'); v.className = 'vacio'; v.tabIndex = -1; v.setAttribute('aria-hidden', 'true'); cal.appendChild(v); }
      for (var x = 1; x <= dias; x++) (function (d) {
        var b = document.createElement('button'); b.type = 'button'; b.textContent = d.getDate(); b.setAttribute('aria-label', fmtDia.format(d));
        var lib = d >= hoy && !ocupado(d), salida = ini && !fin && d > ini && libre(ini, d);
        b.disabled = !(lib || salida);
        if (mismo(d, ini) || mismo(d, fin)) { b.classList.add('extremo'); b.setAttribute('aria-pressed', 'true'); }
        else if (ini && fin && d > ini && d < fin) b.classList.add('en-rango');
        b.addEventListener('click', function () { elegir(d); });
        cal.appendChild(b);
      })(new Date(vista.getFullYear(), vista.getMonth(), x));
      resumir();
    };
    var elegir = function (d) {
      if (!ini || fin || d <= ini) { ini = d; fin = null; }
      else if (libre(ini, d) && (d - ini) / 864e5 <= 14) fin = d;
      else { ini = d; fin = null; }
      $('res-msg').textContent = ''; pintar();
    };
    var resumir = function () {
      $('res-llega').textContent = ini ? fmtDia.format(ini) : 'elige un día';
      $('res-sale').textContent = fin ? fmtDia.format(fin) : (ini ? 'elige la salida' : '—');
      var n = ini && fin ? Math.round((fin - ini) / 864e5) : 0, p = +sel.value || 1, total = 0;
      for (var k = 0; k < n; k++) { var d = new Date(ini); d.setDate(d.getDate() + k); total += noche(d, p); }
      if ($('res-des').checked) total += 5 * p * n;
      $('res-noches').textContent = n || '—'; $('res-pp').textContent = n ? eur(total / n / p) : '—'; $('res-total').textContent = n ? eur(total) : '—';
      $('res-btn').disabled = !n;
    };
    $('cal-ant').addEventListener('click', function () { vista = new Date(vista.getFullYear(), vista.getMonth() - 1, 1); pintar(); });
    $('cal-sig').addEventListener('click', function () { vista = new Date(vista.getFullYear(), vista.getMonth() + 1, 1); pintar(); });
    sel.addEventListener('change', resumir); $('res-des').addEventListener('change', resumir);
    $('res-perro').addEventListener('change', function (e) { $('res-msg').textContent = e.target.checked ? 'Los perros no pagan. Solo avisa a Carmen al reservar.' : ''; });
    $('res-btn').addEventListener('click', function () { $('res-msg').textContent = 'Es una demostración: no se ha enviado nada. En la web real, aquí se confirmaría la reserva y el pago.'; });
    window.reservaGrupo = function (n) { sel.value = Math.min(12, Math.max(1, n)); resumir(); $('reserva').scrollIntoView({ behavior: MOV ? 'smooth' : 'auto' }); };
    pintar();
  })();

  // ---------- 8. mapa solo al pedirlo ----------
  $('mapa-btn').addEventListener('click', function () {
    var f = document.createElement('iframe'); f.title = 'Mapa de Casa O Pontillón'; f.loading = 'lazy'; f.referrerPolicy = 'no-referrer-when-downgrade';
    f.src = 'https://maps.google.com/maps?q=42.21599,-8.16337&z=14&output=embed'; $('mapa').replaceChildren(f);
  });

  // ---------- 9. pie: el pontillón se completa al llegar ----------
  (function () {
    var p = $('pie-puente'); if (!MOV) { p.classList.add('completo'); return; }
    new IntersectionObserver(function (es, io) { if (es[0].isIntersecting) { p.classList.add('completo'); io.disconnect(); } }, { threshold: .4 }).observe(p);
  })();

  // ---------- 10. entradas al bajar y barra del móvil ----------
  (function () {
    var cosas = document.querySelectorAll('.sec-cab, .galeria, .servicios, .grupo, .sonido, .rio-marco, .lugares li, .op-rejilla > *, .motor, .saber, .llegar-rejilla > *');
    if (MOV && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('vista'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
      cosas.forEach(function (c) { c.classList.add('entra'); io.observe(c); });
    }
    var barra = $('barra'), enPortada = true, enReserva = false;
    var poner = function () { barra.classList.toggle('visible', !enPortada && !enReserva); };
    new IntersectionObserver(function (es) { enPortada = es[0].isIntersecting; poner(); }).observe($('arriba'));
    new IntersectionObserver(function (es) { enReserva = es[0].isIntersecting; poner(); }).observe($('reserva'));
  })();

  // ---------- 11. aviso de cookies ----------
  (function () {
    var c = $('cookies'), CL = 'pontillon-cookies';
    var visto = function () { try { return localStorage.getItem(CL); } catch (e) { return null; } };
    var cerrar = function (guardar) { c.hidden = true; if (guardar) try { localStorage.setItem(CL, '1'); } catch (e) {} };
    if (!visto()) c.hidden = false;
    $('ck-si').addEventListener('click', function () { cerrar(true); });
    $('ck-no').addEventListener('click', function () { cerrar(false); });
    $('abrir-cookies').addEventListener('click', function () { c.hidden = false; $('ck-si').focus(); });
  })();

  // MANDO DE MAQUETA: solo con ?revision
  (function () {
    var m = $('mando'); if (!m || !D.classList.contains('en-revision')) return;
    m.hidden = false;
    var bs = m.querySelectorAll('button');
    var poner = function (sobria) { D.classList.toggle('densidad-sobria', sobria); bs.forEach(function (b) { b.setAttribute('aria-pressed', (b.dataset.densidad === 'sobria') === sobria); }); };
    bs.forEach(function (b) { b.addEventListener('click', function () { poner(b.dataset.densidad === 'sobria'); }); });
    poner(D.classList.contains('densidad-sobria'));
  })();
  // fin del MANDO DE MAQUETA
})();
