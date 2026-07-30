#!/usr/bin/env python3
"""Erzeugt die App-Icons (PNG) fuer Starfighter ohne externe Abhaengigkeiten.

Aufruf:  python3 tools/gen_icons.py
Schreibt nach icons/: icon-192.png, icon-512.png, icon-maskable-512.png,
apple-touch-icon.png
"""
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(__file__), '..', 'icons')

# Schiffs-Silhouette wie im Spiel (Einheiten /30 normalisiert)
SHIP = [(0, -24), (7, -4), (24, 10), (24, 15), (8, 12), (5, 17),
        (-5, 17), (-8, 12), (-24, 15), (-24, 10), (-7, -4)]
SHIP = [(x / 30.0, y / 30.0) for x, y in SHIP]
FLAME = [(-5 / 30.0, 15 / 30.0), (5 / 30.0, 15 / 30.0), (0.0, 34 / 30.0)]


def in_poly(px, py, poly):
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > py) != (yj > py):
            if px < (xj - xi) * (py - yi) / (yj - yi) + xi:
                inside = not inside
        j = i
    return inside


def hash01(x, y):
    n = (x * 374761393 + y * 668265263) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) & 0xFFFFFFFF
    n = (n * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFFFFFF) / 4294967295.0


def lerp(a, b, t):
    return a + (b - a) * t


def sample(u, v, scale, px, py):
    """Farbe an normalisierter Position (u,v in -1..1), Schiff skaliert."""
    # Hintergrund: dunkler Vertikal-Verlauf
    t = (v + 1) / 2
    r, g, b = lerp(14, 5, t), lerp(20, 7, t), lerp(52, 17, t)

    # Sterne
    h = hash01(px, py)
    if h > 0.9985:
        s = 120 + (h - 0.9985) / 0.0015 * 135
        r, g, b = max(r, s), max(g, s), max(b, min(255, s * 1.05))

    # Schiffskoordinaten
    sx, sy = u / scale, v / scale

    # Cyan-Glow rund ums Schiff
    d = (sx * sx + (sy * 0.8) ** 2) ** 0.5
    if d < 1.5:
        a = (1 - d / 1.5) ** 2 * 0.55
        r, g, b = lerp(r, 70, a), lerp(g, 200, a), lerp(b, 255, a)

    # Triebwerksflamme
    if in_poly(sx, sy, FLAME):
        fade = max(0.0, 1 - (sy - 0.5) / 0.65)
        r, g, b = lerp(r, 255, fade), lerp(g, 170, fade), lerp(b, 60, fade * 0.9)

    # Rumpf
    if in_poly(sx, sy, SHIP):
        bt = (sy + 0.8) / 1.4  # 0 oben .. 1 unten
        r, g, b = lerp(242, 124, bt), lerp(247, 140, bt), lerp(255, 173, bt)
        # Fluegelspitzen orange
        if abs(sx) > 0.62 and sy > 0.30:
            r, g, b = 255, 157, 46

    # Cockpit
    cx, cy = sx / (4.2 / 30.0), (sy + 8 / 30.0) / (7.5 / 30.0)
    if cx * cx + cy * cy < 1:
        r, g, b = 57, 213, 255

    return r, g, b


def render(size, pad):
    scale = 0.62 * (1 - pad)
    rows = []
    ss = 2  # 2x2 Supersampling
    for y in range(size):
        row = bytearray()
        for x in range(size):
            ar = ag = ab = 0.0
            for sy_ in range(ss):
                for sx_ in range(ss):
                    u = ((x + (sx_ + 0.5) / ss) / size) * 2 - 1
                    v = ((y + (sy_ + 0.5) / ss) / size) * 2 - 1
                    r, g, b = sample(u, v, scale, x, y)
                    ar += r; ag += g; ab += b
            n = ss * ss
            row += bytes((int(ar / n), int(ag / n), int(ab / n), 255))
        rows.append(bytes(row))
    return rows


def write_png(path, size, rows):
    raw = b''.join(b'\x00' + r for r in rows)

    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    png = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr)
           + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)
    print(f'  {os.path.basename(path)}  ({size}x{size}, {len(png)} Bytes)')


def main():
    os.makedirs(OUT, exist_ok=True)
    print('Erzeuge Icons...')
    write_png(os.path.join(OUT, 'icon-512.png'), 512, render(512, 0.08))
    write_png(os.path.join(OUT, 'icon-192.png'), 192, render(192, 0.08))
    write_png(os.path.join(OUT, 'icon-maskable-512.png'), 512, render(512, 0.28))
    write_png(os.path.join(OUT, 'apple-touch-icon.png'), 180, render(180, 0.12))
    print('Fertig.')


if __name__ == '__main__':
    main()
