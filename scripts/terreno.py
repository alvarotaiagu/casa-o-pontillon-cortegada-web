# Datos del 3D del Miño (sección #rio de «Alrededor»), adaptado del tablero (dirección B, «En la curva del Miño»).
# Fuente: IGN, CC BY 4.0 (© Instituto Geográfico Nacional), descargado para el tablero:
#   ../casa-o-pontillon-cortegada-bocetos/ref/terreno/mdt5.tif + mdt5-sur.tif   (MDT05 por WCS, 42,145–42,265)
#   ../casa-o-pontillon-cortegada-bocetos/ref/terreno/pnoa-4096.jpg + pnoa-sur.jpg (ortofoto PNOA por WMS, misma caja)
#   ../casa-o-pontillon-cortegada-bocetos/ref/terreno/finca-pnoa.jpg             (la casa a 0,3 m/px)
# Caja del 3D: lat 42,147–42,259, lon −8,235 – −8,105 (unos 10,7 × 12,4 km: el Miño embalsado en Frieira,
#   de las termas de Prexigueiro a la presa, con la casa dentro de la curva). Mismo tratamiento que el tablero.
#
# Salida en img/terreno/:
#   alturas-256.bin, alturas-384.bin   Uint16 little-endian, decímetros, fila 0 = norte (móvil / escritorio),
#                                      con el lecho del embalse rebajado bajo el agua
#   orto-1792.{webp,jpg}, orto-2880.{webp,jpg}  ortofoto (móvil / escritorio), fila 0 = norte
#   finca-1024.{webp,jpg}, finca-1536.{webp,jpg} la casa de cerca (móvil / escritorio)
#   plano.{webp,jpg}                   relieve sombreado sobre la ortofoto (modo «En plano»)
#   terreno.json                       caja, lugares (OSM), agua por tramos de fila para cada malla, eje del río
# Los pósteres los pinta pruebas/3d-poster.mjs con la propia escena.
#
# Uso (desde la carpeta de la web): python -I scripts/terreno.py
import json, math, pathlib
from collections import deque
import numpy as np
from PIL import Image, ImageEnhance
from scipy import ndimage as nd
Image.MAX_IMAGE_PIXELS = None

R = pathlib.Path(__file__).resolve().parent.parent
REF = R.parent / 'casa-o-pontillon-cortegada-bocetos' / 'ref' / 'terreno'
OUT = R / 'img' / 'terreno'
OUT.mkdir(parents=True, exist_ok=True)
MALLAS = (256, 384)
EX = 1.6

# ---------- 1. Relieve y foto completos (42,145–42,265 × −8,245 – −8,085) ----------
GS, GN, GO, GE = 42.145, 42.265, -8.245, -8.085
dem = np.vstack([np.array(Image.open(REF / 'mdt5.tif'), dtype=np.float32), np.array(Image.open(REF / 'mdt5-sur.tif'), dtype=np.float32)])
orto = np.vstack([np.array(Image.open(REF / 'pnoa-4096.jpg').convert('RGB'), dtype=np.float32), np.array(Image.open(REF / 'pnoa-sur.jpg').convert('RGB'), dtype=np.float32)])
# tesela más oscura y azulada arriba a la derecha (filas < 505, columnas ≥ 1485 de pnoa-4096): ganancia por canal, borde difuminado
F0, C0 = 505, 1485
for ch in range(3):
    g = np.median(orto[F0 + 5:F0 + 120, C0 + 60:, ch]) / max(1, np.median(orto[F0 - 120:F0 - 5, C0 + 60:, ch]))
    yy, xx = np.mgrid[0:F0 + 16, 0:orto.shape[1]]
    peso = np.clip((F0 + 8 - yy) / 16, 0, 1) * np.clip((xx - C0 + 8) / 16, 0, 1)
    orto[:F0 + 16, :, ch] *= 1 + (g - 1) * peso
orto = np.clip(orto, 0, 255)

# ---------- 2. Recorte ----------
S, N, O, E = 42.147, 42.259, -8.235, -8.105
def recorta(a):
    h, w = a.shape[:2]
    r0, r1 = round((GN - N) / (GN - GS) * h), round((GN - S) / (GN - GS) * h)
    c0, c1 = round((O - GO) / (GE - GO) * w), round((E - GO) / (GE - GO) * w)
    return a[r0:r1, c0:c1]
dem, orto = recorta(dem), recorta(orto)
lat0 = (S + N) / 2
ancho = (E - O) * 111320 * math.cos(math.radians(lat0)); alto = (N - S) * 110950
hD, wD = dem.shape
mx, mz = ancho / wD, alto / hD

# ---------- 3. El agua: el embalse de Frieira (≈67 m) y el río bajo la presa (≈41 m) ----------
def pxl(lat, lon): return min(hD - 1, int((N - lat) / (N - S) * hD)), min(wD - 1, int((lon - O) / (E - O) * wD))
def componente(mask, semilla):
    if not mask[semilla]:
        _, (ir, ic) = nd.distance_transform_edt(~mask, return_indices=True); semilla = (ir[semilla], ic[semilla])
    lab, _ = nd.label(mask); return lab == lab[semilla]
PRESA = (42.15525, -8.19308)   # Presa da Frieira (OSM, waterway=dam)
embalse = componente(nd.binary_closing((dem >= 65.5) & (dem <= 67.45), iterations=8), pxl(42.2192, -8.1607))
bajo = componente(dem <= 42.5, pxl(42.15468, -8.19655))
embalse = nd.binary_opening(nd.binary_fill_holes(embalse), iterations=1)
bajo = nd.binary_fill_holes(bajo) & ~embalse
NIVEL = [67.2, 41.2]
CASA = (42.21599, -8.16337)
dist = nd.distance_transform_edt(~embalse, sampling=(mz, mx))
rc = pxl(*CASA); d_agua = float(dist[rc]); h_casa = float(dem[rc])
fondo = nd.distance_transform_edt(embalse | bajo, sampling=(mz, mx))
lecho = np.where(embalse, NIVEL[0], NIVEL[1]) - np.minimum(28, 3 + fondo * .12)
dem3 = np.where(embalse | bajo, np.minimum(dem, lecho), dem)

# ---------- 4. Mallas (alturas y agua por tramos de fila, una por tamaño) ----------
def rejilla(m, n): return np.array(Image.fromarray(m.astype(np.uint8) * 255).resize((n, n), Image.BILINEAR)) > 40
agua = {}
for n in MALLAS:
    a = np.array(Image.fromarray(dem3).resize((n, n), Image.BILINEAR), dtype=np.float32)
    (OUT / f'alturas-{n}.bin').write_bytes(np.round(np.clip(a, 0, 6000) * 10).astype('<u2').tobytes())
    # 1 = embalse, 2 = bajo la presa; ensanchada para que la orilla quede bajo el relieve (≈45 m, como en el tablero)
    it = max(1, round(2 * n / 480 + .4))
    ge = nd.binary_dilation(rejilla(embalse, n), iterations=it); gb = nd.binary_dilation(rejilla(bajo, n), iterations=it) & ~ge
    tipo = np.where(ge, 1, np.where(gb, 2, 0)).astype(np.uint8)
    filas = []
    for r in range(n):
        t, tramos, c = tipo[r], [], 0
        while c < n:
            if not t[c]: c += 1; continue
            c0, k = c, t[c]
            while c < n and t[c] == k: c += 1
            tramos += [c0, c, int(k)]
        filas.append(tramos)
    agua[str(n)] = filas

# ---------- 5. Eje del río (para el vuelo), igual que el tablero: rejilla de 480 ----------
n = 480
geje = componente(rejilla(embalse, n), (n // 2, n // 2))
rr, cc = np.where(geje); ini = (int(rr.min()), int(cc[rr == rr.min()].mean()))
cx, cz = ancho / (n - 1), alto / (n - 1)
gd = np.full((n, n), np.inf); gd[ini] = 0; q = deque([ini])
while q:
    r, c = q.popleft()
    for dr in (-1, 0, 1):
        for dc in (-1, 0, 1):
            r2, c2 = r + dr, c + dc
            if (dr or dc) and 0 <= r2 < n and 0 <= c2 < n and geje[r2, c2]:
                v = gd[r, c] + math.hypot(dr * cz, dc * cx)
                if v < gd[r2, c2]: gd[r2, c2] = v; q.append((r2, c2))
pr = (round((N - PRESA[0]) / (N - S) * (n - 1)), round((PRESA[1] - O) / (E - O) * (n - 1)))
_, (ir, ic) = nd.distance_transform_edt(~geje, return_indices=True); cur = (int(ir[pr]), int(ic[pr]))
camino = [cur]
while gd[cur] > 0:
    r, c = cur
    cur = min(((r + dr, c + dc) for dr in (-1, 0, 1) for dc in (-1, 0, 1) if (dr or dc) and 0 <= r + dr < n and 0 <= c + dc < n), key=lambda k: gd[k])
    camino.append(cur)
camino = np.array(camino[::-1], dtype=np.float64)
camino = np.column_stack([nd.uniform_filter1d(camino[:, k], 15, mode='nearest') for k in (0, 1)])
xz = np.column_stack([(camino[:, 1] / (n - 1) - .5) * ancho, (camino[:, 0] / (n - 1) - .5) * alto])
s_ = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(xz, axis=0).T))])
eje = [[round(float(np.interp(t, s_, xz[:, 0])), 1), round(float(np.interp(t, s_, xz[:, 1])), 1)] for t in np.arange(0, s_[-1], 120)]

# ---------- 6. Ortofoto (dos tamaños), la casa de cerca y el plano ----------
im = Image.fromarray(orto.astype('uint8'))
im = ImageEnhance.Contrast(im).enhance(1.1); im = ImageEnhance.Color(im).enhance(0.9)
ortos = {}
for w, qj, qw in ((1792, 62, 48), (2880, 62, 50)):
    h = round(w * alto / ancho / 8) * 8
    o = im.resize((w, h), Image.LANCZOS)
    o.save(OUT / f'orto-{w}.jpg', quality=qj, optimize=True, progressive=True)
    o.save(OUT / f'orto-{w}.webp', quality=qw, method=6)
    ortos[str(w)] = [w, h]
FS, FN, FO, FE = 42.2128, 42.2192, -8.1676, -8.1590   # caja de finca-pnoa.jpg (WMS PNOA, 2048 × 2048)
f = Image.open(REF / 'finca-pnoa.jpg').convert('RGB')
f = ImageEnhance.Contrast(ImageEnhance.Color(f).enhance(.95)).enhance(1.08)
for w in (1024, 1536):
    fw = f.resize((w, w), Image.LANCZOS)
    fw.save(OUT / f'finca-{w}.jpg', quality=72, optimize=True, progressive=True)
    fw.save(OUT / f'finca-{w}.webp', quality=50, method=6)
PW = 1400; PH = round(PW * alto / ancho)
d = np.array(Image.fromarray(dem3).resize((PW, PH), Image.BILINEAR), dtype=np.float32)
gy, gx = np.gradient(d * EX, ancho / PW)
az, al = math.radians(315), math.radians(40)
sl = np.arctan(np.hypot(gx, gy)); asp = np.arctan2(-gx, gy)
hs = np.clip(math.sin(al) * np.cos(sl) + math.cos(al) * np.sin(sl) * np.cos(az - asp), 0, 1)
o = np.array(im.resize((PW, PH), Image.LANCZOS), dtype=np.float32) / 255
agua2d = np.array(Image.fromarray(((embalse | bajo) * 255).astype(np.uint8)).resize((PW, PH), Image.BILINEAR), dtype=np.float32)[..., None] / 255
img = np.clip(o * (0.38 + 0.82 * hs[..., None]), 0, 1)
img = img * (1 - agua2d * .55) + np.array([.07, .16, .2]) * agua2d * .55   # el agua, un poco más honda
plano = Image.fromarray((img * 255).astype('uint8'))
plano.save(OUT / 'plano.jpg', quality=74, optimize=True, progressive=True)
plano.save(OUT / 'plano.webp', quality=72, method=6)

# ---------- 7. Lugares (OpenStreetMap, los del tablero) y metadatos ----------
def local(lat, lon): return [round((lon - (O + E) / 2) / (E - O) * ancho, 1), round(((S + N) / 2 - lat) / (N - S) * alto, 1)]
def cota(lat, lon): return float(dem[pxl(lat, lon)])
def uv(lat, lon): return [round((lon - O) / (E - O), 4), round((N - lat) / (N - S), 4)]
L = {'casa': ('Casa O Pontillón', *CASA), 'cortegada': ('Cortegada', 42.20727, -8.17008),
     'termas': ('Termas de Prexigueiro', 42.25334, -8.16736), 'presa': ('Presa da Frieira', *PRESA),
     'iglesia': ('San Bieito do Rabiño', 42.21788, -8.15953), 'petroglifos': ('Petróglifos de Ferradura', 42.21974, -8.15645),
     'crecente': ('Crecente', 42.1517, -8.22392), 'mirador': ('Miradoiro do Coto da Pena', 42.19762, -8.17694),
     'cotocruz': ('Coto da Cruz', 42.22587, -8.21871)}
meta = {'caja': {'s': S, 'n': N, 'o': O, 'e': E}, 'ancho': round(ancho), 'alto': round(alto), 'mallas': list(MALLAS),
        'exageracion': EX, 'min': float(dem3.min()), 'max': float(dem3.max()), 'ortos': ortos, 'plano': {'w': PW, 'h': PH},
        'lugares': {k: {'t': t, 'xz': local(la, lo), 'h': round(cota(la, lo), 1), 'uv': uv(la, lo)} for k, (t, la, lo) in L.items()},
        'agua': {'nivel': NIVEL, 'filas': agua}, 'eje': eje,
        'casaAgua': {'dist': round(d_agua), 'sobre': round(h_casa - 67)},
        'finca': {'s': FS, 'n': FN, 'o': FO, 'e': FE, 'ancho': round((FE - FO) * 111320 * math.cos(math.radians(lat0))), 'alto': round((FN - FS) * 110950),
                  'xz': local((FS + FN) / 2, (FO + FE) / 2)},
        'fuente': 'MDT05 y ortofoto PNOA © Instituto Geográfico Nacional (CC BY 4.0)'}
(OUT / 'terreno.json').write_text(json.dumps(meta, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('casa al agua', meta['casaAgua'], 'km', round(ancho / 1000, 2), round(alto / 1000, 2), 'eje', len(eje), 'pts')
for p in sorted(OUT.iterdir()): print(f'{p.name:28} {p.stat().st_size // 1024:6} KB')
