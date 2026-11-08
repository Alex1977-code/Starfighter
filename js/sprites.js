/* ============================================================
   STARFIGHTER — Pixel-Art-Sprites
   Detailreiche Sprites im Stil der Arcade-Automaten der
   80er/90er: als Zeichen-Matrizen definiert, beim Start in
   Offscreen-Canvases kompiliert. '.' = transparent, alle
   anderen Zeichen schlagen in der Palette nach.
   Symmetrische Sprites werden nur halb definiert (mirror).
   ============================================================ */

const PAL = {
  o: '#10141f',                                    // Outline
  // Stahl / Rumpf
  w: '#f0f5ff', l: '#c4d2ea', g: '#8fa2c4', d: '#5a6a8c', e: '#333e58', s: '#1f2739',
  // Cockpit
  c: '#39d5ff', C: '#c2f1ff',
  // Rot / Orange / Gelb
  r: '#ff4b3a', R: '#a92318', y: '#ffcf5a', Y: '#ff9432', h: '#ffe9b0',
  // Violett (Kanonenboot)
  p: '#c95cff', P: '#7a2fb8', q: '#471a78',
  // Pink (Drohne)
  m: '#ff77b1', M: '#c33f6e', n: '#7c1f43',
  // Teal (Kreisel)
  t: '#3fe0b6', T: '#128c6d', u: '#0b5a46',
  // Grün (Panzer)
  v: '#93b04f', V: '#5a7a2e', b: '#39511f',
  // Explosion
  '1': '#ffffff', '2': '#ffe066', '3': '#ff9d2e', '4': '#ff5a2e', '5': '#b3311f',
};

/* Matrix → {img, white, w, h}; white = Silhouette für Treffer-Blitz */
function makeSprite(rows, opts = {}) {
  const mirror = !!opts.mirror;
  const hgt = rows.length;
  const wA = rows[0].length;
  for (const r of rows) {
    if (r.length !== wA) throw new Error('Sprite-Zeile ungleich lang: "' + r + '"');
  }
  const wid = mirror ? wA * 2 - 1 : wA;

  const cv = document.createElement('canvas');
  cv.width = wid; cv.height = hgt;
  const cx = cv.getContext('2d');
  for (let y = 0; y < hgt; y++) {
    for (let x = 0; x < wid; x++) {
      const sx = x < wA ? x : 2 * wA - 2 - x;
      const ch = rows[y][sx];
      if (ch === '.') continue;
      cx.fillStyle = PAL[ch] || '#ff00ff';
      cx.fillRect(x, y, 1, 1);
    }
  }

  const wcv = document.createElement('canvas');
  wcv.width = wid; wcv.height = hgt;
  const wx = wcv.getContext('2d');
  wx.drawImage(cv, 0, 0);
  wx.globalCompositeOperation = 'source-in';
  wx.fillStyle = '#ffffff';
  wx.fillRect(0, 0, wid, hgt);

  return { img: cv, white: wcv, w: wid, h: hgt };
}

/* zentriert zeichnen; scale 2 = Standard-Pixelgröße */
const SpriteGfx = { snap: false };
function drawSprite(ctx, spr, x, y, opts = {}) {
  const s = opts.scale || 2;
  const rot = opts.rot || 0;
  if (SpriteGfx.snap && !rot) { x = Math.round(x / 2) * 2; y = Math.round(y / 2) * 2; }
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.imageSmoothingEnabled = false;
  const dw = spr.w * s, dh = spr.h * s;
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  ctx.drawImage(spr.img, -dw / 2, -dh / 2, dw, dh);
  if (opts.flash > 0) {
    ctx.globalAlpha = Math.min(1, opts.flash * 10);
    ctx.drawImage(spr.white, -dw / 2, -dh / 2, dw, dh);
  }
  ctx.restore();
}

/* ============================================================
   SPRITE-DEFINITIONEN
   ============================================================ */
const SPRITES = {};

/* --- Spielerjet: Delta-Jäger, weißer Rumpf, Cyan-Kanzel --- */
SPRITES.player = makeSprite([
  '.......o',
  '......ow',
  '......ow',
  '.....oww',
  '.....owl',
  '.....oCc',
  '.....oCc',
  '.....olc',
  '....oowl',
  '....owll',
  '...owllg',
  '..owllgg',
  '.owlggdd',
  'owllggdd',
  'oyYolgdd',
  '.oo.olgd',
  '.....oeo',
  '.....oso',
], { mirror: true });

/* --- Begleit-Drohne --- */
SPRITES.droneBuddy = makeSprite([
  '...o',
  '..oc',
  '.olc',
  'owlg',
  'oldg',
  '.ogo',
  '..o.',
], { mirror: true });

/* --- Toroid-Drohne: rotierender Ring --- */
SPRITES.drone = makeSprite([
  '...ooo',
  '..ommm',
  '.omMmm',
  'omMmoo',
  'omMmo.',
  'onMmo.',
  'onMmo.',
  'onMmoo',
  '.onMnn',
  '..onnn',
  '...ooo',
], { mirror: true });

/* --- Kurvenflieger: orangener Pfeil --- */
SPRITES.swooper = makeSprite([
  '.....o',
  '....oY',
  '....oY',
  '...oYy',
  '...oYy',
  '..oYYh',
  '..oYyR',
  '.oYYyR',
  '.oYyRR',
  'oYYyRo',
  'oYyRo.',
  '.oRRo.',
  '..oo..',
], { mirror: true });

/* --- Sturzflieger: roter Habicht --- */
SPRITES.diver = makeSprite([
  'o....o',
  'oR...o',
  'oRR.oR',
  '.oRRoR',
  '.oRrry',
  '..orry',
  '..orrh',
  '..oRry',
  '.oRRry',
  '.oR.or',
  'oR..or',
  'o....o',
], { mirror: true });

/* --- Kanonenboot: violettes Gunship mit Seitengondeln --- */
SPRITES.gunner = makeSprite([
  '........o',
  '.......op',
  '......opp',
  '..o..oppP',
  '.oqo.opPP',
  '.oqooppPP',
  'oqqoppPPq',
  'oqPpppcco',
  'oqPpppcco',
  'oqPPppPPq',
  'oqqoPPPPq',
  '.oo.oPPqq',
  '.....oqqo',
  '......oyo',
  '.......o.',
], { mirror: true });

/* --- Kreisel: rotierender X-Stern --- */
SPRITES.spinner = makeSprite([
  'oo.....',
  'otto...',
  '.otto..',
  '..ottoo',
  '...ottt',
  '....oTu',
  '.....ou',
  '....oTu',
  '...ottt',
  '..ottoo',
  '.otto..',
  'otto...',
  'oo.....',
], { mirror: true });

/* --- Bodenkuppel (passives Ziel) --- */
SPRITES.dome = makeSprite([
  '....ooo',
  '..oogll',
  '.ogllll',
  '.ogllgg',
  'ogglggd',
  'ogglgdd',
  'odgggdd',
  'oedddde',
  'osesese',
  '.oooooo',
], { mirror: true });

/* --- Geschützturm-Sockel (Rohr wird dynamisch gezeichnet) --- */
SPRITES.turretBase = makeSprite([
  '...oooo',
  '..oddgg',
  '.odggll',
  'oddgllg',
  'odglggd',
  'odglgdd',
  'oeglgdd',
  'oedggdd',
  '.oeddde',
  '..oeeee',
  '...oooo',
], { mirror: true });

/* --- Panzer (Rohr dynamisch) --- */
SPRITES.tank = makeSprite([
  'oo.ooooo',
  'oso.ovvV',
  'osoovvVV',
  'osoovVbb',
  'ooovvVVb',
  'osovVggd',
  'osovVgdd',
  'osovVVbb',
  'oooovVVb',
  'osoovvVV',
  'oso.ovvV',
  'oo.ooooo',
], { mirror: true });

/* --- Radaranlage (Schüssel dynamisch) --- */
SPRITES.radarBase = makeSprite([
  '...oooo',
  '..odddg',
  '.odggll',
  'odglldd',
  'odglddc',
  'oeglddc',
  'oedgldd',
  '.oeeddd',
  '..oeeee',
  '...oooo',
], { mirror: true });

/* --- Boss-Rumpf: Manta-Schlachtschiff, prozedural gepixelt
       (Türme/Kern werden dynamisch darüber gezeichnet)      --- */
SPRITES.boss = (function () {
  const H = 34, WA = 34;
  // linke Hüllenkante pro Zeile (WA-1 = Mittelachse)
  const left = [30, 28, 26, 24, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4, 2, 0, 0, 2,
                5, 8, 10, 12, 13, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 22];
  const darker = { w: 'l', l: 'g', g: 'd', d: 'e', e: 's', s: 's' };
  const lighter = { s: 'e', e: 'd', d: 'g', g: 'l', l: 'w', w: 'w' };
  const rows = [];
  for (let y = 0; y < H; y++) {
    let row = '';
    for (let x = 0; x < WA; x++) {
      if (x < left[y]) { row += '.'; continue; }
      // Umriss
      const aboveOut = y === 0 || x < left[y - 1];
      const belowOut = y === H - 1 || x < left[y + 1];
      if (x === left[y] || aboveOut || belowOut) { row += 'o'; continue; }
      // Grundschattierung: oben hell (Licht von vorn), unten dunkel
      let ch = y < 6 ? 'l' : y < 10 ? 'g' : y < 18 ? 'd' : y < 26 ? 'e' : 's';
      // Mittelspine deutlich heller, mit Glanzkante
      if (x >= 29) ch = lighter[ch];
      if (x >= 32 && y > 2 && y < 12) ch = lighter[ch];
      // Warnstreifen an der Flügel-Hinterkante
      if ((y === 16 || y === 17) && x >= left[y] + 2 && x <= left[y] + 13) {
        ch = ((x + y) & 2) ? 'y' : 'Y';
      }
      // Lufteinlässe
      if (y >= 20 && y <= 23 && ((x >= 12 && x <= 13) || (x >= 17 && x <= 18) || (x >= 22 && x <= 23))) {
        ch = 's';
      }
      // Heck-Lüftungsschlitze
      if (y >= 28 && y <= 30 && x >= 24 && (x & 1)) ch = 'o';
      // Panel-Linien
      if (x % 7 === 0 && y > 7 && y < 27) ch = darker[ch] || ch;
      // Nieten-Sprenkel
      if ((x * 7 + y * 13) % 29 === 0) ch = darker[ch] || ch;
      row += ch;
    }
    rows.push(row);
  }
  return makeSprite(rows, { mirror: true });
})();

/* --- Boss-Turmgondel --- */
SPRITES.bossPod = makeSprite([
  '...oo',
  '..opp',
  '.oppP',
  'opmpP',
  'opppP',
  'oPPPq',
  'oqPqq',
  '.oqqo',
  '..oo.',
], { mirror: true });

SPRITES.bossPodDead = makeSprite([
  '...oo',
  '..oss',
  '.osse',
  'osoes',
  'oseos',
  'osses',
  'oesss',
  '.osso',
  '..oo.',
], { mirror: true });

/* --- Explosion, 4 Frames (klassische Arcade-Animation) --- */
SPRITES.boom = [
  makeSprite([
    '.......',
    '.......',
    '....o..',
    '...o12',
    '....o12',
    '.....o.',
    '.......',
    '.......',
  ].map(r => (r + '.......').slice(0, 7)), { mirror: true }),
  makeSprite([
    '.......',
    '...o2..',
    '..o221.',
    '.o22112',
    '..o2112',
    '...2212',
    '..o322.',
    '.......',
  ], { mirror: true }),
  makeSprite([
    '..3..3.',
    '.o332..',
    '.33221.',
    '3322112',
    '.322112',
    '..32212',
    '.4.332.',
    '..4..3.',
  ], { mirror: true }),
  makeSprite([
    '4...4..',
    '.4..3..',
    '..43.4.',
    '4.3..45',
    '..4.5.4',
    '.5..4..',
    '4..5..4',
    '..4...5',
  ], { mirror: true }),
];

/* --- Spalter: Panzerkäfer, zerfällt in zwei Splitter --- */
SPRITES.splitter = makeSprite([
  '....oo.',
  '..ooYy.',
  '.oYyooo',
  '.oyoMmm',
  'ooYommm',
  'oYyomMm',
  'oyYonnm',
  'ooYomMm',
  '.oyommm',
  '.oYyooo',
  '..ooYy.',
  '....oo.',
], { mirror: true });

/* --- Splitter-Fragment --- */
SPRITES.fragment = makeSprite([
  '..o',
  '.om',
  'omM',
  'omM',
  '.on',
  '..o',
], { mirror: true });

/* --- Minenleger: breiter Lastkahn --- */
SPRITES.minelayer = makeSprite([
  '......ooooo',
  '..oooodddgg',
  '.odddgggllg',
  'odgglllgggd',
  'odglgggdddd',
  'odgggddeeee',
  'oddeeeseses',
  '.oeeeeeeeee',
  '..ooooooooo',
], { mirror: true });

/* --- Schwebemine: Stachelkugel --- */
SPRITES.mine = makeSprite([
  '....o',
  '.o.oY',
  '.ooYy',
  'ooYyy',
  'oYyry',
  'ooYyy',
  '.ooYy',
  '.o.oY',
  '....o',
], { mirror: true });

/* --- Raketensilo (Boden) --- */
SPRITES.silo = makeSprite([
  '..oooooo',
  '.oddgggl',
  'odglllgg',
  'odgloooo',
  'odgloees',
  'odgloese',
  'odgloees',
  'odgloooo',
  'odggdddd',
  '.oeeeeee',
  '..oooooo',
], { mirror: true });

/* --- Flak-Batterie (Boden) --- */
SPRITES.flak = makeSprite([
  '...ooooo',
  '..odddgg',
  '.odgollo',
  'odggollo',
  'odgggoo.',
  'odgollo.',
  'oegollo.',
  'oedggoo.',
  '.oeedddd',
  '..oooooo',
], { mirror: true });

/* --- Rakete (Zielsucher, Spieler & Silo) --- */
SPRITES.missile = makeSprite([
  '.o',
  'ow',
  'ol',
  'ol',
  'og',
  'oY',
], { mirror: true });

/* --- Festungs-Boss: Bastion (Kern/Türme dynamisch) --- */
SPRITES.fortress = (function () {
  const H = 30, WA = 32;
  const left = [24, 20, 16, 13, 10, 8, 6, 5, 4, 3, 2, 2, 1, 1, 0, 0, 0, 1, 1, 2,
                2, 3, 4, 5, 6, 8, 10, 13, 16, 20];
  const darker = { w: 'l', l: 'g', g: 'd', d: 'e', e: 's', s: 's', v: 'V', V: 'b', b: 'b' };
  const rows = [];
  for (let y = 0; y < H; y++) {
    let row = '';
    for (let x = 0; x < WA; x++) {
      if (x < left[y]) { row += '.'; continue; }
      const aboveOut = y === 0 || x < left[y - 1];
      const belowOut = y === H - 1 || x < left[y + 1];
      if (x === left[y] || aboveOut || belowOut) { row += 'o'; continue; }
      // Bronze-grüne Panzerung, oben hell
      let ch = y < 5 ? 'v' : y < 12 ? 'V' : y < 20 ? 'b' : y < 25 ? 'e' : 's';
      // Mittelbereich: Stahlplatte um den Kern
      const cx = WA - 1 - x;
      if (cx < 12 && y > 8 && y < 24) ch = y < 12 ? 'g' : y < 18 ? 'd' : 'e';
      // Warnstreifen am oberen Wall
      if (y === 6 && x > left[y] + 1 && x < WA - 13) ch = ((x & 2) ? 'y' : 'Y');
      // Bunker-Schlitze
      if (y >= 14 && y <= 16 && x >= left[y] + 3 && x <= left[y] + 4) ch = 'o';
      if (y >= 14 && y <= 16 && x >= left[y] + 8 && x <= left[y] + 9) ch = 'o';
      // Panel-Linien & Sprenkel
      if (x % 6 === 0 && y > 4 && y < 24) ch = darker[ch] || ch;
      if ((x * 11 + y * 7) % 31 === 0) ch = darker[ch] || ch;
      row += ch;
    }
    rows.push(row);
  }
  return makeSprite(rows, { mirror: true });
})();

/* --- Festungs-Turm (bronze) --- */
SPRITES.fortressPod = makeSprite([
  '...oo',
  '..ovv',
  '.ovvV',
  'ovyvV',
  'ovvVV',
  'oVVVb',
  'obVbb',
  '.obbo',
  '..oo.',
], { mirror: true });

/* --- Power-up-Kapsel (Buchstabe wird darüber gerendert) --- */
SPRITES.capsule = makeSprite([
  '...oooo',
  '..oYYYY',
  '.oYyyyy',
  'oYywwww',
  'oYywwww',
  'oYywwww',
  '.oYyyyy',
  '..oYYYY',
  '...oooo',
], { mirror: true });
