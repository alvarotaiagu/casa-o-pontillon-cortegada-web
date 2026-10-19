/* Prepara las fotos de la web desde las de Booking (máx. 1280 px) y los datos del IGN
   guardados en la carpeta de bocetos (../caserio-de-fontes-nogueira-bocetos/).
   Uso: node scripts/fotos.mjs
   - Gradación común y suave: un poco menos de saturación (las fotos son de móvil, a
     mediodía) y un punto de contraste. Las del IGN («crudo») van sin tocar.
   - NUNCA amplía: los anchos se cortan en el ancho original (la aérea y el mirador
     solo tienen 640 px y se enseñan pequeñas a propósito).
   - Escribe img/fotos/<nombre>-<ancho>.{avif,webp,jpg} e img/fotos/fotos.json.  */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const sharp = require('sharp');

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const REF = path.join(RAIZ, '../casa-o-pontillon-cortegada-bocetos/ref/fotos');
const SALIDA = path.join(RAIZ, 'img/fotos');
fs.mkdirSync(SALIDA, { recursive: true });

const FOTOS = JSON.parse(fs.readFileSync(path.join(RAIZ, 'scripts/fotos-lista.json'), 'utf8'));
const ANCHOS = [480, 800, 1200];

const salida = [];
for (const f of FOTOS) {
  const fuente = path.join(REF, f.ruta);
  if (!fs.existsSync(fuente)) throw new Error(`Falta ${fuente} (${f.nombre})`);
  const buf = await sharp(fuente).rotate().toBuffer();
  const meta = await sharp(buf).metadata();
  const anchos = ANCHOS.filter((w) => w < meta.width - 40);
  anchos.push(meta.width);
  const unicos = [...new Set(anchos)];
  for (const w of unicos) {
    let p = sharp(buf).resize({ width: w, withoutEnlargement: true, kernel: 'lanczos3' });
    if (!f.crudo) p = p.modulate({ saturation: f.sat ?? 0.9, brightness: f.claro ?? 1.0 }).linear(1.04, -4);
    if (meta.width <= 700) p = p.sharpen({ sigma: 0.5, m1: 0.6, m2: 1.2 });
    const dst = path.join(SALIDA, `${f.nombre}-${w}`);
    await p.clone().avif({ quality: f.aq ?? 50, effort: 4 }).toFile(dst + '.avif');
    await p.clone().webp({ quality: f.wq ?? 72 }).toFile(dst + '.webp');
    await p.clone().jpeg({ quality: 78, mozjpeg: true }).toFile(dst + '.jpg');
  }
  const ancho = unicos[unicos.length - 1];
  salida.push({ nombre: f.nombre, anchos: unicos, ancho, alto: Math.round(meta.height * (ancho / meta.width)), origen: f.ruta, ancho_origen: meta.width, alto_origen: meta.height });
  console.log(f.nombre.padEnd(14), unicos.join(','), `${meta.width}x${meta.height}`);
}
fs.writeFileSync(path.join(SALIDA, 'fotos.json'), JSON.stringify(salida, null, 1));
console.log(salida.length + ' fotos');

