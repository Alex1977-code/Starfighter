/* ============================================================
   STARFIGHTER — Terrain
   Endlos scrollende, prozedural generierte Landschaft.
   Abwechslung statt Monotonie: wechselnde Biome (Wiesen, Wald,
   Ozean, Wüste, Tech-Basis), Fluss, Straßen, Wolken-Parallax.
   ============================================================ */

const TILE = 32;
const T_GRASS = 0, T_GRASS2 = 1, T_TREES = 2, T_WATER = 3, T_DEEP = 4,
      T_SAND = 5, T_ROCK = 6, T_ROAD = 7, T_TECH = 8, T_TECH2 = 9;

const TILE_COLORS = {
  [T_GRASS]:  ['#2c6b35', '#2f7239', '#29632f', '#31763c'],
  [T_GRASS2]: ['#245c2c', '#276230', '#215728', '#296434'],
  [T_TREES]:  ['#1d4a24', '#1f4f27', '#1b4521', '#215229'],
  [T_WATER]:  ['#1b5f8a', '#1d6591', '#195a83', '#1f6a97'],
  [T_DEEP]:   ['#123f63', '#144368', '#103a5c', '#16476e'],
  [T_SAND]:   ['#b99a5e', '#c0a166', '#b29357', '#c6a76c'],
  [T_ROCK]:   ['#6e6a63', '#75716a', '#66625c', '#7c7870'],
  [T_ROAD]:   ['#3a3d45', '#3d4048', '#373a42', '#40434b'],
  [T_TECH]:   ['#39414f', '#3c4453', '#363e4c', '#3f4756'],
  [T_TECH2]:  ['#2c3340', '#2e3643', '#2a313d', '#303845'],
};

const BIOMES = ['meadow', 'forest', 'ocean', 'desert', 'tech'];
const BIOME_ROWS = 110;                  // Zeilen pro Biom

class Terrain {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.cols = Math.ceil(w / TILE);
    this.rowCount = Math.ceil(h / TILE) + 2;
    this.reset(1);
  }

  reset(seed) {
    this.seed = seed | 0;
    this.acc = 0;                        // Scroll-Akkumulator [0..TILE)
    this.worldRow = 0;                   // global fortlaufende Zeilennummer
    this.rows = [];
    for (let i = this.rowCount - 1; i >= 0; i--) this.rows.push(this._genRow(i));
    this.worldRow = this.rowCount;
    this.rows.reverse();                 // rows[0] = oberste Zeile

    this.clouds = [];
    for (let i = 0; i < 10; i++) {
      this.clouds.push(this._newCloud(Math.random() * this.h));
    }
  }

  /* deterministisches 2D-Rauschen */
  _hash(x, y) {
    let n = (x * 374761393 + y * 668265263 + this.seed * 1442695041) | 0;
    n = (n ^ (n >> 13)) | 0;
    n = Math.imul(n, 1274126177);
    return ((n ^ (n >> 16)) >>> 0) / 4294967295;
  }

  _smooth(x, y, scale) {
    // wertkontinuierliches Rauschen (bilinear interpoliert)
    const fx = x / scale, fy = y / scale;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const a = this._hash(x0, y0), b = this._hash(x0 + 1, y0);
    const c = this._hash(x0, y0 + 1), d = this._hash(x0 + 1, y0 + 1);
    const u = tx * tx * (3 - 2 * tx), v = ty * ty * (3 - 2 * ty);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  biomeAt(gy) {
    return BIOMES[Math.floor(gy / BIOME_ROWS) % BIOMES.length];
  }

  _riverX(gy) {
    return 7.5 + Math.sin(gy * 0.045) * 3.4 + (this._smooth(3, gy, 14) - 0.5) * 6;
  }

  _genRow(gy) {
    const cols = this.cols;
    const tiles = new Uint8Array(cols);
    const vars = new Uint8Array(cols);
    let biome = this.biomeAt(gy);

    // weicher Übergang: in den ersten Zeilen eines Bioms mischt sich das alte ein
    const intoBiome = gy % BIOME_ROWS;
    const prevBiome = this.biomeAt(Math.max(0, gy - BIOME_ROWS));

    const isRoad = biome !== 'ocean' && gy % 43 === 0 && gy > 8;
    const riverX = this._riverX(gy);
    const hasRiver = (biome === 'meadow' || biome === 'forest' || biome === 'tech');

    for (let x = 0; x < cols; x++) {
      let b = biome;
      if (intoBiome < 7 && this._hash(x, gy) > (intoBiome + 1) / 8) b = prevBiome;

      let t;
      const n = this._smooth(x, gy, 5);
      const n2 = this._hash(x * 7 + 1, gy);

      switch (b) {
        case 'meadow':
          t = n2 > 0.5 ? T_GRASS : T_GRASS2;
          if (n > 0.76) t = T_TREES;
          if (n < 0.10) t = T_WATER;
          break;
        case 'forest':
          t = T_GRASS2;
          if (n > 0.42) t = T_TREES;
          if (n < 0.07) t = T_WATER;
          break;
        case 'ocean':
          t = T_DEEP;
          if (n > 0.68) t = T_WATER;
          if (n > 0.78) t = T_SAND;
          if (n > 0.86) t = n2 > 0.5 ? T_GRASS : T_TREES;
          break;
        case 'desert':
          t = T_SAND;
          if (n > 0.82) t = T_ROCK;
          if (n < 0.045) t = T_WATER;          // Oase
          break;
        case 'tech':
          t = (gy % 9 === 0 || x % 5 === 0) ? T_TECH2 : T_TECH;
          break;
        default:
          t = T_GRASS;
      }

      // Fluss über Landbiome
      if (hasRiver) {
        const dRiver = Math.abs(x - riverX);
        if (dRiver < 1.4) t = dRiver < 0.9 ? T_DEEP : T_WATER;
        else if (dRiver < 2.1 && t !== T_WATER && b !== 'tech') t = T_SAND;
      }

      if (isRoad) t = T_ROAD;
      tiles[x] = t;
      vars[x] = (this._hash(x + 31, gy + 17) * 4) | 0;
    }

    return { gy, tiles, vars, isRoad };
  }

  update(dy) {
    this.acc += dy;
    while (this.acc >= TILE) {
      this.acc -= TILE;
      this.rows.pop();                              // unterste Zeile fällt raus
      this.rows.unshift(this._genRow(this.worldRow++));
    }
    for (const c of this.clouds) {
      c.y += dy * c.speed;
      if (c.y - c.r > this.h + 40) {
        Object.assign(c, this._newCloud(-60 - Math.random() * 80));
      }
    }
  }

  draw(ctx, time) {
    const cols = this.cols;
    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i];
      const y = (i - 1) * TILE + this.acc;
      if (y > this.h || y + TILE < 0) continue;
      const tiles = row.tiles, vars = row.vars;

      for (let x = 0; x < cols; x++) {
        const t = tiles[x];
        ctx.fillStyle = TILE_COLORS[t][vars[x]];
        ctx.fillRect(x * TILE, y, TILE, TILE);

        // Tile-Details
        if (t === T_TREES) {
          ctx.fillStyle = vars[x] & 1 ? '#173d1d' : '#144019';
          ctx.beginPath();
          ctx.arc(x * TILE + 10 + (vars[x] & 2) * 3, y + 12, 8, 0, 6.3);
          ctx.arc(x * TILE + 22, y + 22, 7, 0, 6.3);
          ctx.fill();
        } else if (t === T_WATER || t === T_DEEP) {
          const ph = ((row.gy * 13 + x * 7) % 32 + time * 26) % 32;
          ctx.fillStyle = 'rgba(180,220,255,0.10)';
          ctx.fillRect(x * TILE + 3, y + ph, TILE - 6, 2);
          // Schaumkanten an Uferübergängen
          const isW = tt => tt === T_WATER || tt === T_DEEP;
          const above = this.rows[i - 1], below = this.rows[i + 1];
          ctx.fillStyle = 'rgba(210,235,255,0.28)';
          if (x > 0 && !isW(tiles[x - 1])) ctx.fillRect(x * TILE, y, 2, TILE);
          if (x < cols - 1 && !isW(tiles[x + 1])) ctx.fillRect(x * TILE + TILE - 2, y, 2, TILE);
          if (above && !isW(above.tiles[x])) ctx.fillRect(x * TILE, y, TILE, 2);
          if (below && !isW(below.tiles[x])) ctx.fillRect(x * TILE, y + TILE - 2, TILE, 2);
        } else if (t === T_ROAD && row.isRoad) {
          ctx.fillStyle = '#c8c34a';
          if ((x & 1) === 0) ctx.fillRect(x * TILE + 4, y + TILE / 2 - 1, TILE - 12, 2);
        } else if (t === T_ROCK) {
          ctx.fillStyle = 'rgba(255,255,255,0.10)';
          ctx.fillRect(x * TILE + 6, y + 6, 10, 4);
        } else if (t === T_TECH) {
          ctx.strokeStyle = 'rgba(120,200,255,0.08)';
          ctx.strokeRect(x * TILE + 0.5, y + 0.5, TILE - 1, TILE - 1);
          if (vars[x] === 3 && this._hash(x, row.gy + 5) > 0.86) {
            const blink = 0.4 + 0.6 * Math.abs(Math.sin(time * 3 + x * 2 + row.gy));
            ctx.fillStyle = `rgba(90,220,255,${0.55 * blink})`;
            ctx.fillRect(x * TILE + 14, y + 14, 4, 4);
          }
        }
      }
    }

    // sanfte Tiefenschattierung über allem Boden
    const grad = ctx.createLinearGradient(0, 0, 0, this.h);
    grad.addColorStop(0, 'rgba(4,8,20,0.34)');
    grad.addColorStop(0.35, 'rgba(4,8,20,0.05)');
    grad.addColorStop(1, 'rgba(4,8,20,0.16)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  _newCloud(y) {
    return {
      x: Math.random() * this.w,
      y,
      r: 34 + Math.random() * 60,
      speed: 1.7 + Math.random() * 1.2,
      alpha: 0.05 + Math.random() * 0.09,
    };
  }

  /* Wolken über den Sprites — Tiefenwirkung */
  drawClouds(ctx, soft = true) {
    for (const c of this.clouds) {
      if (soft) {
        // weicher Radialverlauf für den modernen Look
        const g = ctx.createRadialGradient(c.x, c.y, c.r * 0.15, c.x, c.y, c.r * 1.6);
        g.addColorStop(0, `rgba(235,242,255,${c.alpha * 1.5})`);
        g.addColorStop(1, 'rgba(235,242,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r * 1.6, 0, 6.3);
        ctx.fill();
      } else {
        ctx.fillStyle = `rgba(235,242,255,${c.alpha * 1.3})`;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, 6.3);
        ctx.arc(c.x + c.r * 0.7, c.y + c.r * 0.25, c.r * 0.7, 0, 6.3);
        ctx.arc(c.x - c.r * 0.65, c.y + c.r * 0.2, c.r * 0.6, 0, 6.3);
        ctx.fill();
      }
    }
  }
}
