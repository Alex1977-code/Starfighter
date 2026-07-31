/* ============================================================
   STARFIGHTER — Entities
   Spieler, Gegner (Luft & Boden), Boss, Projektile, Power-ups,
   Partikel & schwebende Texte. Alles Vektor-Rendering mit
   Glow-Effekten — keine Assets nötig.
   ============================================================ */

/* ---------- Mathe-Helfer ---------- */
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

/* ============================================================
   PARTIKEL & TEXTE
   ============================================================ */

class Particle {
  constructor(x, y, vx, vy, life, size, color, glow) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life;
    this.size = size; this.color = color; this.glow = glow;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 1 - 1.6 * dt;
    this.vy *= 1 - 1.6 * dt;
    this.life -= dt;
    return this.life > 0;
  }
  draw(ctx) {
    const a = clamp(this.life / this.maxLife, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = this.color;
    const s = this.size * (0.4 + 0.6 * a);
    ctx.beginPath();
    ctx.arc(this.x, this.y, s, 0, 6.3);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/* expandierender Explosions-Ring */
class Shockwave {
  constructor(x, y, maxR, color) {
    this.x = x; this.y = y;
    this.r = 6;
    this.maxR = maxR;
    this.color = color || '255,210,140';
    this.life = 0.38;
    this.maxLife = 0.38;
  }
  update(dt) {
    this.life -= dt;
    this.r += (this.maxR - this.r) * Math.min(1, 9 * dt);
    return this.life > 0;
  }
  draw(ctx) {
    const a = clamp(this.life / this.maxLife, 0, 1);
    ctx.strokeStyle = `rgba(${this.color},${0.75 * a})`;
    ctx.lineWidth = 2.5 * a + 0.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, 6.3);
    ctx.stroke();
    ctx.lineWidth = 1;
  }
}

/* klassische 4-Frame-Arcade-Explosion */
class BoomAnim {
  constructor(x, y, scale) {
    this.x = x; this.y = y;
    this.scale = scale || 2.5;
    this.t = 0;
    this.dur = 0.4;
  }
  update(dt) {
    this.t += dt;
    return this.t < this.dur;
  }
  draw(ctx) {
    const i = Math.min(3, Math.floor(this.t / this.dur * 4));
    drawSprite(ctx, SPRITES.boom[i], this.x, this.y, { scale: this.scale });
  }
}

class FloatText {
  constructor(x, y, text, color, big) {
    this.x = x; this.y = y; this.text = text;
    this.color = color || '#ffffff';
    this.life = big ? 1.6 : 1.0;
    this.maxLife = this.life;
    this.big = big;
  }
  update(dt) {
    this.y -= 28 * dt;
    this.life -= dt;
    return this.life > 0;
  }
  draw(ctx) {
    const a = clamp(this.life / this.maxLife * 1.4, 0, 1);
    ctx.globalAlpha = a;
    ctx.font = `bold ${this.big ? 24 : 15}px 'Segoe UI', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, this.x, this.y);
    ctx.globalAlpha = 1;
  }
}

/* Explosionswolke erzeugen */
function spawnExplosion(game, x, y, opts = {}) {
  const n = opts.count || 22;
  const spd = opts.speed || 190;
  const colors = opts.colors || ['#ffd166', '#ff9d2e', '#ff5c33', '#ffe9b0'];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = rand(0.2, 1) * spd;
    game.particles.push(new Particle(
      x, y, Math.cos(a) * v, Math.sin(a) * v,
      rand(0.3, 0.75) * (opts.lifeScale || 1),
      rand(2, opts.maxSize || 6), pick(colors), true
    ));
  }
  if (!opts.noSmoke) {
    for (let i = 0; i < n / 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = rand(0.1, 0.5) * spd * 0.5;
      game.particles.push(new Particle(
        x, y, Math.cos(a) * v, Math.sin(a) * v,
        rand(0.5, 1.1), rand(5, 11), 'rgba(80,80,90,0.55)', false
      ));
    }
  }
}

/* ============================================================
   PROJEKTILE
   ============================================================ */

class PlayerBullet {
  constructor(x, y, vx, vy) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.r = 4;
    this.alive = true;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y < -20 || this.x < -20 || this.x > 500) this.alive = false;
  }
  draw(ctx) {
    ctx.fillStyle = '#9fe8ff';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, 2.5, 8, Math.atan2(this.vx, -this.vy), 0, 6.3);
    ctx.fill();
    ctx.fillStyle = 'rgba(120,220,255,0.35)';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 6, 0, 6.3);
    ctx.fill();
  }
}

/* durchschlagender Laserbolzen (Raiden-Stil) */
class PlayerLaser {
  constructor(x, y, w) {
    this.x = x; this.y = y;
    this.w = w;
    this.vy = -780;
    this.r = 6;
    this.dmg = 2;
    this.pierce = 3;
    this.hitSet = new Set();
    this.alive = true;
  }
  update(dt) {
    this.y += this.vy * dt;
    if (this.y < -40) this.alive = false;
  }
  draw(ctx) {
    ctx.fillStyle = 'rgba(90,140,255,0.30)';
    ctx.fillRect(this.x - this.w, this.y - 16, this.w * 2, 34);
    ctx.fillStyle = '#7fa8ff';
    ctx.fillRect(this.x - this.w / 2, this.y - 14, this.w, 30);
    ctx.fillStyle = '#e6efff';
    ctx.fillRect(this.x - 1, this.y - 12, 2, 26);
  }
}

/* Zielsuchrakete des Spielers */
class PlayerMissile {
  constructor(x, y, side) {
    this.x = x; this.y = y;
    this.a = -Math.PI / 2 + side * 0.5;     // Startwinkel leicht seitlich
    this.speed = 260;
    this.dmg = 3;
    this.r = 6;
    this.t = 0;
    this.ttl = 2.4;
    this.target = null;
    this.alive = true;
  }
  update(dt, game) {
    this.t += dt;
    this.ttl -= dt;
    if (this.ttl <= 0) { this.alive = false; return; }
    if (!this.target || !this.target.alive) {
      // nächstes Luftziel suchen
      let best = null, bd = Infinity;
      for (const e of game.airEnemies) {
        if (!e.alive || e.y < -20) continue;
        const d = dist2(e.x, e.y, this.x, this.y);
        if (d < bd) { bd = d; best = e; }
      }
      this.target = best;
    }
    let want = this.a;
    if (this.target) {
      want = Math.atan2(this.target.y - this.y, this.target.x - this.x);
    } else if (game.boss && game.boss.dying <= 0) {
      want = Math.atan2(game.boss.y - this.y, game.boss.x - this.x);
    } else {
      want = -Math.PI / 2;
    }
    let dA = want - this.a;
    while (dA > Math.PI) dA -= Math.PI * 2;
    while (dA < -Math.PI) dA += Math.PI * 2;
    this.a += clamp(dA, -5.5 * dt, 5.5 * dt);
    this.speed = Math.min(540, this.speed + 500 * dt);
    this.x += Math.cos(this.a) * this.speed * dt;
    this.y += Math.sin(this.a) * this.speed * dt;
    if (this.y < -30 || this.y > 830 || this.x < -30 || this.x > 510) this.alive = false;
    // Rauchfahne
    if (Math.random() < dt * 40) {
      game.particles.push(new Particle(
        this.x, this.y, rand(-12, 12), rand(-8, 30),
        rand(0.2, 0.4), rand(1.5, 3), 'rgba(200,205,220,0.5)', false
      ));
    }
  }
  draw(ctx) {
    drawSprite(ctx, SPRITES.missile, this.x, this.y, { rot: this.a + Math.PI / 2 });
    ctx.fillStyle = 'rgba(255,190,90,0.8)';
    ctx.beginPath();
    ctx.arc(this.x - Math.cos(this.a) * 8, this.y - Math.sin(this.a) * 8, 2.5, 0, 6.3);
    ctx.fill();
  }
}

class EnemyBullet {
  constructor(x, y, vx, vy, big) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.r = big ? 7 : 4.5;
    this.big = big;
    this.alive = true;
    this.t = 0;
  }
  update(dt) {
    this.t += dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y < -30 || this.y > 830 || this.x < -30 || this.x > 510) this.alive = false;
  }
  draw(ctx) {
    const pulse = 0.75 + 0.25 * Math.sin(this.t * 18);
    ctx.fillStyle = this.big ? 'rgba(255,80,140,0.30)' : 'rgba(255,150,60,0.30)';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * 2 * pulse, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = this.big ? '#ff5c8f' : '#ffb257';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#fff2e0';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * 0.45, 0, 6.3);
    ctx.fill();
  }
}

/* Flak-Granate: platzt nach Zündzeit in einen Ring */
class FlakShell {
  constructor(x, y, vx, vy, fuse) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.fuse = fuse;
    this.r = 6;
    this.t = 0;
    this.alive = true;
  }
  update(dt, game) {
    this.t += dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.fuse -= dt;
    if (this.y < -30 || this.y > 830 || this.x < -30 || this.x > 510) { this.alive = false; return; }
    if (this.fuse <= 0 && game) {
      this.alive = false;
      const n = 5;
      const spd = (95 + game.diff * 8) * game.bulletF;
      const a0 = Math.random() * 6.3;
      for (let i = 0; i < n; i++) {
        const a = a0 + i * Math.PI * 2 / n;
        game.enemyBullets.push(new EnemyBullet(this.x, this.y, Math.cos(a) * spd, Math.sin(a) * spd, false));
      }
      game.explosions.push(new BoomAnim(this.x, this.y, 1.8));
      game.shocks.push(new Shockwave(this.x, this.y, 26, '255,150,90'));
    }
  }
  draw(ctx) {
    const blink = Math.sin(this.t * (this.fuse < 0.5 ? 40 : 14)) > 0;
    ctx.fillStyle = '#2c3242';
    ctx.beginPath(); ctx.arc(this.x, this.y, 6, 0, 6.3); ctx.fill();
    ctx.fillStyle = blink ? '#ff5a3c' : '#7a2f18';
    ctx.beginPath(); ctx.arc(this.x, this.y, 3, 0, 6.3); ctx.fill();
  }
}

/* Bombe fliegt zum anvisierten Bodenziel */
class Bomb {
  constructor(x, y, tx, ty, staticTarget) {
    this.sx = x; this.sy = y;
    this.tx = tx; this.ty = ty;
    this.staticTarget = !!staticTarget;   // z. B. Festungskern: scrollt nicht mit
    this.t = 0;
    this.dur = 0.36;
    this.alive = true;
    this.x = x; this.y = y;
  }
  update(dt, game) {
    this.t += dt;
    const p = clamp(this.t / this.dur, 0, 1);
    this.x = this.sx + (this.tx - this.sx) * p;
    // Ziel wandert mit dem Scrolling nach unten
    if (!this.staticTarget) this.ty += game.scrollSpeed * dt;
    this.y = this.sy + (this.ty - this.sy) * p;
    if (p >= 1) {
      this.alive = false;
      game.bombImpact(this.tx, this.ty);
    }
  }
  draw(ctx) {
    const p = clamp(this.t / this.dur, 0, 1);
    const scale = 1 - p * 0.55;                    // wird "kleiner" beim Fallen
    ctx.fillStyle = '#e8edf5';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, 4 * scale, 7 * scale, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,190,80,0.7)';
    ctx.beginPath();
    ctx.arc(this.x, this.y - 6 * scale, 2.5 * scale, 0, 6.3);
    ctx.fill();
  }
}

/* ============================================================
   SPIELER
   ============================================================ */

class Player {
  constructor() {
    this.x = 240; this.y = 640;
    this.hitR = 7;                       // kleine faire Hitbox
    this.shield = 3; this.shieldMax = 3;
    this.weapon = 'vulcan';              // 'vulcan' (Fächer) | 'laser' (Durchschlag)
    this.spread = 1;                     // 1..3 Fächerstufen
    this.laserLvl = 1;                   // 1..3 Laserstufen
    this.rapid = 0;                      // 0..2 Feuerraten-Stufen
    this.drones = 0;                     // 0..2 Begleit-Drohnen
    this.homing = 0;                     // 0..2 Zielsuchraketen-Werfer
    this.homingTimer = 0;
    this.homingSide = 1;
    this.megaBomb = false;               // größerer Bombenradius
    this.fireTimer = 0;
    this.bombTimer = 0;
    this.invuln = 0;
    this.alive = true;
    this.vx = 0; this.vy = 0;            // nur fürs Banking / Effekte
    this.tilt = 0;
    this.t = 0;
  }

  get fireInterval() {
    if (this.weapon === 'laser') return 1 / (8 + this.rapid * 3 + (this.laserLvl >= 3 ? 2 : 0));
    return 1 / (7 + this.rapid * 3.5);
  }
  get reticleY() { return this.y - 165; }
  get bombRadius() { return this.megaBomb ? 64 : 46; }

  move(dx, dy) {
    this.vx = dx; this.vy = dy;
    this.x = clamp(this.x + dx, 18, 462);
    this.y = clamp(this.y + dy, 90, 770);
  }

  update(dt, game) {
    this.t += dt;
    if (this.invuln > 0) this.invuln -= dt;
    this.tilt += (clamp(this.vx * 0.010, -0.30, 0.30) - this.tilt) * Math.min(1, 12 * dt);
    this.vx *= 1 - Math.min(1, 10 * dt);
    this.vy *= 1 - Math.min(1, 10 * dt);

    // Triebwerks-Partikel
    if (Math.random() < dt * 60) {
      game.particles.push(new Particle(
        this.x + rand(-4, 4), this.y + 18, rand(-15, 15), rand(120, 220),
        rand(0.12, 0.3), rand(1.5, 3.5), pick(['#59c8ff', '#9fe8ff', '#2f7dff']), true
      ));
    }

    // Autofeuer
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = this.fireInterval;
      this.shoot(game);
    }
    if (this.bombTimer > 0) this.bombTimer -= dt;

    // Zielsuchraketen-Werfer
    if (this.homing > 0) {
      this.homingTimer -= dt;
      if (this.homingTimer <= 0) {
        this.homingTimer = 0.62;
        for (let i = 0; i < this.homing; i++) {
          this.homingSide *= -1;
          game.playerBullets.push(new PlayerMissile(
            this.x + this.homingSide * 16, this.y + 6, this.homingSide
          ));
        }
        game.sound.sfx('missile');
      }
    }
  }

  shoot(game) {
    const B = game.playerBullets;
    if (this.weapon === 'laser') {
      if (this.laserLvl === 1) {
        B.push(new PlayerLaser(this.x, this.y - 24, 5));
      } else {
        const w = this.laserLvl >= 3 ? 7 : 5;
        B.push(new PlayerLaser(this.x - 7, this.y - 22, w));
        B.push(new PlayerLaser(this.x + 7, this.y - 22, w));
      }
      game.sound.sfx('laser');
    } else {
      B.push(new PlayerBullet(this.x, this.y - 20, 0, -560));
      if (this.spread >= 2) {
        B.push(new PlayerBullet(this.x - 10, this.y - 12, -95, -540));
        B.push(new PlayerBullet(this.x + 10, this.y - 12, 95, -540));
      }
      if (this.spread >= 3) {
        B.push(new PlayerBullet(this.x - 14, this.y - 6, -195, -500));
        B.push(new PlayerBullet(this.x + 14, this.y - 6, 195, -500));
      }
      game.sound.sfx('shot');
    }
    for (let i = 0; i < this.drones; i++) {
      const off = i === 0 ? -34 : 34;
      B.push(new PlayerBullet(this.x + off, this.y + 2, 0, -560));
    }
    // Mündungsfeuer
    game.particles.push(new Particle(
      this.x, this.y - 22, rand(-8, 8), -60,
      0.07, 5, this.weapon === 'laser' ? '#9db8ff' : '#cfeaff', true
    ));
  }

  draw(ctx) {
    const blink = this.invuln > 0 && Math.floor(this.t * 14) % 2 === 0;
    if (blink) ctx.globalAlpha = 0.35;

    // Begleit-Drohnen
    for (let i = 0; i < this.drones; i++) {
      const off = i === 0 ? -34 : 34;
      const bob = Math.sin(this.t * 5 + i * 3) * 3;
      ctx.fillStyle = 'rgba(90,200,255,0.22)';
      ctx.beginPath(); ctx.arc(this.x + off, this.y + 4 + bob, 11, 0, 6.3); ctx.fill();
      drawSprite(ctx, SPRITES.droneBuddy, this.x + off, this.y + 4 + bob);
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.tilt);

    // Triebwerksflamme
    const fl = 10 + Math.sin(this.t * 40) * 3;
    const fg = ctx.createLinearGradient(0, 16, 0, 16 + fl + 12);
    fg.addColorStop(0, 'rgba(160,230,255,0.95)');
    fg.addColorStop(0.5, 'rgba(60,140,255,0.6)');
    fg.addColorStop(1, 'rgba(60,140,255,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-5, 16); ctx.lineTo(5, 16); ctx.lineTo(0, 16 + fl + 12);
    ctx.closePath(); ctx.fill();

    drawSprite(ctx, SPRITES.player, 0, 0);
    ctx.restore();

    // Schildring
    if (this.invuln > 0.6 || this.shield >= this.shieldMax) {
      const a = this.invuln > 0.6 ? 0.5 : 0.10 + 0.05 * Math.sin(this.t * 4);
      ctx.strokeStyle = `rgba(90,210,255,${a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 30 + Math.sin(this.t * 6) * 2, 0, 6.3);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
    ctx.globalAlpha = 1;
  }

  drawReticle(ctx, locked) {
    const y = this.reticleY;
    const x = this.x;
    const t = this.t;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(locked ? t * 4 : t * 1.2);
    const c = locked ? '#ff5c5c' : 'rgba(160,220,255,0.75)';
    ctx.strokeStyle = c;
    ctx.lineWidth = locked ? 2.5 : 1.5;
    const r = locked ? 15 : 18;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      ctx.beginPath();
      ctx.arc(0, 0, r, a + 0.28, a + Math.PI / 2 - 0.28);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-5, 0); ctx.lineTo(5, 0);
    ctx.moveTo(0, -5); ctx.lineTo(0, 5);
    ctx.stroke();
    ctx.restore();
    ctx.lineWidth = 1;
  }
}

/* ============================================================
   LUFTGEGNER
   ============================================================ */

class AirEnemy {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.t = 0;
    this.alive = true;
    this.flash = 0;
    this.r = 14;
    this.hp = 1;
    this.score = 50;
  }
  hurt(dmg, game) {
    this.hp -= dmg;
    this.flash = 0.08;
    if (this.hp <= 0) {
      this.alive = false;
      game.onAirKill(this);
      return true;
    }
    return false;
  }
  baseUpdate(dt) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.y > 850 || this.x < -60 || this.x > 540) this.alive = false;
  }
  /* Sprite mit Treffer-Blitz zeichnen */
  sprite(ctx, spr, rot) {
    drawSprite(ctx, spr, this.x, this.y, { rot, flash: this.flash > 0 ? this.flash + 0.04 : 0 });
  }
}

/* Zickzack-Drohne — Kanonenfutter in Formationen */
class Drone extends AirEnemy {
  constructor(x, phase) {
    super(x, -24);
    this.phase = phase || 0;
    this.score = 60;
    this.r = 13;
  }
  update(dt, game) {
    this.baseUpdate(dt);
    this.y += (140 + game.diff * 12) * dt;
    this.x += Math.sin(this.t * 3.2 + this.phase) * 95 * dt;
  }
  draw(ctx) {
    // rotierender Ring wie die klassischen Toroid-Formationen
    this.sprite(ctx, SPRITES.drone, this.t * 3 + this.phase);
  }
}

/* Kurvenflieger — quert das Bild in einem Bogen, schießt einmal */
class Swooper extends AirEnemy {
  constructor(fromLeft, yBase, diff) {
    super(fromLeft ? -30 : 510, yBase);
    this.fromLeft = fromLeft;
    this.score = 90;
    this.r = 14;
    this.shot = false;
    this.diff = diff;
  }
  update(dt, game) {
    this.baseUpdate(dt);
    const dir = this.fromLeft ? 1 : -1;
    this.x += dir * (230 + game.diff * 14) * dt;
    this.y += Math.sin(this.t * 2.4) * 130 * dt + 36 * dt;
    if (!this.shot && ((this.fromLeft && this.x > 200) || (!this.fromLeft && this.x < 280))) {
      this.shot = true;
      game.enemyAimedShot(this.x, this.y, 1);
    }
  }
  draw(ctx) {
    this.sprite(ctx, SPRITES.swooper, (this.fromLeft ? 1 : -1) * 1.45);
  }
}

/* Sturzflieger — wartet oben, stürzt dann auf den Spieler */
class Diver extends AirEnemy {
  constructor(x) {
    super(x, -24);
    this.state = 0;                       // 0 = anfliegen, 1 = zielen, 2 = sturz
    this.score = 120;
    this.r = 13;
    this.vx = 0; this.vy = 0;
    this.hp = 1;
  }
  update(dt, game) {
    this.baseUpdate(dt);
    if (this.state === 0) {
      this.y += 120 * dt;
      if (this.y > 110) { this.state = 1; this.pause = 0.5; }
    } else if (this.state === 1) {
      this.pause -= dt;
      this.x += Math.sin(this.t * 8) * 26 * dt;
      if (this.pause <= 0) {
        this.state = 2;
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y;
        const len = Math.hypot(dx, dy) || 1;
        const spd = 380 + game.diff * 20;
        this.vx = dx / len * spd; this.vy = dy / len * spd;
      }
    } else {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }
  }
  draw(ctx) {
    const rot = this.state === 2 ? -Math.atan2(this.vx, this.vy) : Math.sin(this.t * 8) * 0.2;
    this.sprite(ctx, SPRITES.diver, rot);
  }
}

/* Kanonenboot — robust, feuert Fächer-Salven */
class Gunner extends AirEnemy {
  constructor(x, diff) {
    super(x, -30);
    this.hp = 3 + Math.floor(diff * 0.5);
    this.score = 200;
    this.r = 18;
    this.fireIn = rand(1.0, 1.8);
    this.dir = Math.random() < 0.5 ? -1 : 1;
  }
  update(dt, game) {
    this.baseUpdate(dt);
    this.y += 58 * dt;
    this.x += this.dir * 46 * dt;
    if (this.x < 40 || this.x > 440) this.dir *= -1;
    this.fireIn -= dt;
    if (this.fireIn <= 0 && this.y > 20 && this.y < 560) {
      this.fireIn = rand(1.7, 2.6) / (0.8 + game.diff * 0.08);
      game.enemyAimedShot(this.x, this.y + 10, 3);
    }
  }
  draw(ctx) {
    this.sprite(ctx, SPRITES.gunner, Math.sin(this.t * 1.8) * 0.06);
    // pulsierende Mündung
    const gl = 0.5 + 0.5 * Math.sin(this.t * 6);
    ctx.fillStyle = `rgba(255,120,220,${0.35 + 0.5 * gl})`;
    ctx.beginPath(); ctx.arc(this.x, this.y + 12, 4.5, 0, 6.3); ctx.fill();
  }
}

/* Kreisel — rotiert, spuckt Spiralschüsse (ab höheren Stufen) */
class Spinner extends AirEnemy {
  constructor(x, diff) {
    super(x, -26);
    this.hp = 4 + Math.floor(diff * 0.6);
    this.score = 260;
    this.r = 16;
    this.fireIn = 0.9;
    this.spiralA = Math.random() * 6.3;
  }
  update(dt, game) {
    this.baseUpdate(dt);
    this.y += (72 + game.diff * 6) * dt;
    this.x += Math.sin(this.t * 1.7) * 60 * dt;
    this.fireIn -= dt;
    if (this.fireIn <= 0 && this.y > 30 && this.y < 520) {
      this.fireIn = Math.max(0.42, 0.85 - game.diff * 0.05);
      const spd = (120 + game.diff * 14) * game.bulletF;
      this.spiralA += 2.4;
      game.enemyBullets.push(new EnemyBullet(
        this.x, this.y,
        Math.cos(this.spiralA) * spd, Math.abs(Math.sin(this.spiralA)) * spd * 0.6 + spd * 0.55,
        false
      ));
    }
  }
  draw(ctx) {
    // Glühen im Zentrum + rotierender Stern
    const gl = 0.4 + 0.4 * Math.sin(this.t * 7);
    ctx.fillStyle = `rgba(63,224,182,${gl * 0.4})`;
    ctx.beginPath(); ctx.arc(this.x, this.y, 18, 0, 6.3); ctx.fill();
    this.sprite(ctx, SPRITES.spinner, this.t * 4);
  }
}

/* Panzerkäfer — zerfällt beim Tod in zwei Splitter */
class Splitter extends AirEnemy {
  constructor(x, diff) {
    super(x, -26);
    this.hp = 3 + Math.floor(diff * 0.4);
    this.score = 150;
    this.r = 15;
    this.vx = (Math.random() < 0.5 ? -1 : 1) * 44;
  }
  hurt(dmg, game) {
    const died = super.hurt(dmg, game);
    if (died) {
      for (const s of [-1, 1]) {
        const f = new Fragment(this.x + s * 8, this.y, s * rand(80, 160), rand(60, 150));
        game.airEnemies.push(f);
      }
    }
    return died;
  }
  update(dt, game) {
    this.baseUpdate(dt);
    this.y += (86 + game.diff * 8) * dt;
    this.x += this.vx * dt + Math.sin(this.t * 2) * 28 * dt;
    if (this.x < 30 || this.x > 450) this.vx *= -1;
  }
  draw(ctx) {
    this.sprite(ctx, SPRITES.splitter, Math.sin(this.t * 2.4) * 0.12);
  }
}

/* Splitter-Fragment — klein und flink */
class Fragment extends AirEnemy {
  constructor(x, y, vx, vy) {
    super(x, y);
    this.hp = 1;
    this.score = 40;
    this.r = 8;
    this.vx = vx; this.vy = vy;
  }
  update(dt, game) {
    this.baseUpdate(dt);
    this.vy += 90 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
  draw(ctx) {
    this.sprite(ctx, SPRITES.fragment, this.t * 9);
  }
}

/* Minenleger — quert oben und wirft Schwebeminen ab */
class Minelayer extends AirEnemy {
  constructor(fromLeft, yBase, diff) {
    super(fromLeft ? -36 : 516, yBase);
    this.hp = 4 + Math.floor(diff * 0.5);
    this.score = 220;
    this.r = 17;
    this.vx = (fromLeft ? 1 : -1) * (92 + diff * 6);
    this.dropIn = 0.7;
  }
  update(dt, game) {
    this.baseUpdate(dt);
    this.x += this.vx * dt;
    this.y += Math.sin(this.t * 1.6) * 18 * dt + 9 * dt;
    this.dropIn -= dt;
    if (this.dropIn <= 0 && this.x > 30 && this.x < 450) {
      this.dropIn = rand(0.9, 1.4);
      game.airEnemies.push(new Mine(this.x, this.y + 12));
      game.sound.sfx('lock');
    }
  }
  draw(ctx) {
    this.sprite(ctx, SPRITES.minelayer, this.vx > 0 ? 0.05 : -0.05);
  }
}

/* Schwebemine — treibt langsam nach unten */
class Mine extends AirEnemy {
  constructor(x, y) {
    super(x, y);
    this.hp = 1;
    this.score = 30;
    this.r = 10;
  }
  update(dt, game) {
    this.baseUpdate(dt);
    this.y += (42 + game.scrollSpeed * 0.25) * dt;
    this.x += Math.sin(this.t * 1.8) * 22 * dt;
  }
  draw(ctx) {
    this.sprite(ctx, SPRITES.mine, this.t * 1.3);
    const gl = 0.4 + 0.6 * Math.abs(Math.sin(this.t * 5));
    ctx.fillStyle = `rgba(255,80,60,${gl})`;
    ctx.beginPath(); ctx.arc(this.x, this.y, 2.5, 0, 6.3); ctx.fill();
  }
}

/* Zielsuchrakete aus dem Bodensilo */
class HomingMissile extends AirEnemy {
  constructor(x, y, diff, game) {
    super(x, y);
    this.hp = 1;
    this.score = 80;
    this.r = 9;
    this.speed = (115 + diff * 16) * game.bulletF;
    this.homeT = 2.8;
    const p = game.player;
    this.a = p.alive ? Math.atan2(p.y - y, p.x - x) : -Math.PI / 2;
  }
  update(dt, game) {
    this.baseUpdate(dt);
    this.homeT -= dt;
    const p = game.player;
    if (this.homeT > 0 && p.alive) {
      const want = Math.atan2(p.y - this.y, p.x - this.x);
      let dA = want - this.a;
      while (dA > Math.PI) dA -= Math.PI * 2;
      while (dA < -Math.PI) dA += Math.PI * 2;
      this.a += clamp(dA, -2.6 * dt, 2.6 * dt);
    }
    this.x += Math.cos(this.a) * this.speed * dt;
    this.y += Math.sin(this.a) * this.speed * dt;
    if (Math.random() < dt * 30) {
      game.particles.push(new Particle(
        this.x, this.y, rand(-10, 10), rand(-10, 10),
        rand(0.2, 0.45), rand(1.5, 3), 'rgba(120,120,130,0.5)', false
      ));
    }
  }
  draw(ctx) {
    ctx.fillStyle = 'rgba(255,90,60,0.25)';
    ctx.beginPath(); ctx.arc(this.x, this.y, 10, 0, 6.3); ctx.fill();
    this.sprite(ctx, SPRITES.missile, this.a + Math.PI / 2);
  }
}

/* ============================================================
   BODENGEGNER — nur mit Bomben zerstörbar (wie beim Vorbild)
   ============================================================ */

class GroundEnemy {
  constructor(x, y, type, diff) {
    this.x = x; this.y = y;
    this.type = type;                    // 'dome' | 'turret' | 'tank' | 'radar'
    this.t = Math.random() * 10;
    this.alive = true;
    this.flash = 0;
    this.aim = Math.PI / 2;
    switch (type) {
      case 'dome':   this.r = 15; this.hp = 1; this.score = 150; break;
      case 'turret': this.r = 16; this.hp = 1; this.score = 300; this.fireIn = rand(1.2, 2.6); break;
      case 'tank':   this.r = 15; this.hp = 1; this.score = 250; this.fireIn = rand(1.5, 2.8); this.dir = Math.random() < 0.5 ? -1 : 1; break;
      case 'radar':  this.r = 15; this.hp = 1; this.score = 500; break;
      case 'silo':   this.r = 16; this.hp = 1; this.score = 400; this.fireIn = rand(2.2, 3.6); this.hatch = 0; break;
      case 'flak':   this.r = 16; this.hp = 1; this.score = 350; this.fireIn = rand(1.8, 3.0); break;
    }
  }
  hurt(dmg, game) {
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.alive = false;
      game.onGroundKill(this);
      return true;
    }
    this.flash = 0.1;
    return false;
  }
  update(dt, game) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    this.y += game.scrollSpeed * dt;
    if (this.y > 840) {
      this.alive = false;
      game.onGroundEscape(this);
      return;
    }
    const p = game.player;
    if (this.type === 'silo') {
      if (this.hatch > 0) this.hatch -= dt;
      this.fireIn -= dt;
      if (this.fireIn <= 0 && this.y > 40 && this.y < 600 && p.alive) {
        this.fireIn = rand(3.4, 5.0) / (0.8 + game.diff * 0.06);
        this.hatch = 0.8;
        game.airEnemies.push(new HomingMissile(this.x, this.y - 6, game.diff, game));
        game.sound.sfx('bomb');
      }
    } else if (this.type === 'flak') {
      this.fireIn -= dt;
      if (this.fireIn <= 0 && this.y > 40 && this.y < 620 && p.alive) {
        this.fireIn = rand(2.4, 3.6) / (0.75 + game.diff * 0.08);
        const a = Math.atan2(p.y - this.y, p.x - this.x);
        const spd = (135 + game.diff * 10) * game.bulletF;
        const dist = Math.hypot(p.x - this.x, p.y - this.y);
        game.enemyBullets.push(new FlakShell(
          this.x, this.y, Math.cos(a) * spd, Math.sin(a) * spd,
          Math.max(0.4, dist / spd * 0.72)
        ));
      }
    }
    if (this.type === 'turret' || this.type === 'tank') {
      const want = Math.atan2(p.y - this.y, p.x - this.x);
      let dA = want - this.aim;
      while (dA > Math.PI) dA -= Math.PI * 2;
      while (dA < -Math.PI) dA += Math.PI * 2;
      this.aim += clamp(dA, -1.6 * dt, 1.6 * dt);

      if (this.type === 'tank') {
        this.x += this.dir * 34 * dt;
        if (this.x < 30 || this.x > 450) this.dir *= -1;
      }
      this.fireIn -= dt;
      if (this.fireIn <= 0 && this.y > 40 && this.y < 640 && p.alive) {
        this.fireIn = rand(2.0, 3.2) / (0.75 + game.diff * 0.08);
        const spd = (95 + game.diff * 11) * game.bulletF;
        game.enemyBullets.push(new EnemyBullet(
          this.x + Math.cos(this.aim) * 14, this.y + Math.sin(this.aim) * 14,
          Math.cos(this.aim) * spd, Math.sin(this.aim) * spd, true
        ));
      }
    }
  }
  draw(ctx) {
    const fl = this.flash > 0 ? this.flash + 0.04 : 0;

    // Bodenschatten macht klar: das ist ein Bodenziel
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath();
    ctx.ellipse(this.x + 3, this.y + 5, this.r + 3, this.r * 0.75, 0, 0, 6.3);
    ctx.fill();

    switch (this.type) {
      case 'dome': {
        drawSprite(ctx, SPRITES.dome, this.x, this.y, { flash: fl });
        const gl = 0.5 + 0.5 * Math.sin(this.t * 2.4);
        ctx.fillStyle = `rgba(255,90,90,${0.35 + 0.55 * gl})`;
        ctx.beginPath(); ctx.arc(this.x, this.y - 2, 3.5, 0, 6.3); ctx.fill();
        break;
      }
      case 'turret': {
        drawSprite(ctx, SPRITES.turretBase, this.x, this.y, { flash: fl });
        ctx.strokeStyle = '#2a3140';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + Math.cos(this.aim) * 19, this.y + Math.sin(this.aim) * 19);
        ctx.stroke();
        ctx.strokeStyle = '#8fa2c4';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x + Math.cos(this.aim) * 6, this.y + Math.sin(this.aim) * 6);
        ctx.lineTo(this.x + Math.cos(this.aim) * 17, this.y + Math.sin(this.aim) * 17);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillStyle = '#ff6b5c';
        ctx.beginPath(); ctx.arc(this.x, this.y, 4, 0, 6.3); ctx.fill();
        break;
      }
      case 'tank': {
        // Wanne quer zur Fahrtrichtung
        drawSprite(ctx, SPRITES.tank, this.x, this.y, {
          rot: this.dir > 0 ? Math.PI / 2 : -Math.PI / 2, flash: fl,
        });
        ctx.strokeStyle = '#2c3322';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + Math.cos(this.aim) * 16, this.y + Math.sin(this.aim) * 16);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillStyle = '#93b04f';
        ctx.beginPath(); ctx.arc(this.x, this.y, 4.5, 0, 6.3); ctx.fill();
        break;
      }
      case 'silo': {
        drawSprite(ctx, SPRITES.silo, this.x, this.y, { flash: fl });
        if (this.hatch > 0) {
          // geöffnete Luke glüht
          ctx.fillStyle = `rgba(255,160,60,${Math.min(0.85, this.hatch)})`;
          ctx.fillRect(this.x - 5, this.y - 7, 10, 12);
        }
        break;
      }
      case 'flak': {
        drawSprite(ctx, SPRITES.flak, this.x, this.y, { flash: fl });
        const gl = 0.4 + 0.6 * Math.abs(Math.sin(this.t * 3));
        ctx.fillStyle = `rgba(255,200,90,${gl * 0.7})`;
        ctx.beginPath(); ctx.arc(this.x, this.y, 3, 0, 6.3); ctx.fill();
        break;
      }
      case 'radar': {
        drawSprite(ctx, SPRITES.radarBase, this.x, this.y, { flash: fl });
        ctx.save();
        ctx.translate(this.x, this.y - 2);
        ctx.rotate(this.t * 1.8);
        ctx.strokeStyle = '#9fd8ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 11, -0.8, 0.8);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillStyle = '#cfeaff';
        ctx.fillRect(-1.5, -12, 3, 12);
        ctx.restore();
        const gl = 0.5 + 0.5 * Math.sin(this.t * 5);
        ctx.fillStyle = `rgba(120,220,255,${0.4 + 0.5 * gl})`;
        ctx.beginPath(); ctx.arc(this.x, this.y - 2, 3.5, 0, 6.3); ctx.fill();
        break;
      }
    }
  }
}

/* ============================================================
   BOSS — Mutterschiff mit Türmen und Kern
   ============================================================ */

class Boss {
  constructor(stage) {
    this.kind = 'mothership';
    this.stage = stage;
    this.x = 240; this.y = -120;
    this.t = 0;
    this.alive = true;
    this.entering = true;
    this.w = 200; this.h = 100;
    this.pods = [-72, -26, 26, 72].map(off => ({
      off, hp: 6 + stage * 2, maxHp: 6 + stage * 2, alive: true, flash: 0, fireIn: rand(1.2, 3.0),
    }));
    this.coreHp = 40 + stage * 14;
    this.coreMax = this.coreHp;
    this.coreFlash = 0;
    this.ringIn = 4;
    this.score = 5000 + (stage - 1) * 1500;
    this.dying = 0;
  }

  get coreExposed() { return this.pods.every(p => !p.alive); }
  get podY() { return this.y + 34; }
  get coreY() { return this.y + 20; }

  update(dt, game) {
    this.t += dt;
    if (this.dying > 0) {
      this.dying -= dt;
      if (Math.random() < dt * 24) {
        const ex = this.x + rand(-90, 90), ey = this.y + rand(-30, 50);
        spawnExplosion(game, ex, ey, { count: 10 });
        game.explosions.push(new BoomAnim(ex, ey, rand(2, 3.4)));
        game.sound.sfx('expl');
      }
      if (this.dying <= 0) {
        this.alive = false;
        game.onBossDefeated(this);
      }
      return;
    }

    if (this.entering) {
      this.y += (110 - this.y) * Math.min(1, 1.6 * dt);
      if (this.y > 106) { this.entering = false; }
      return;
    }

    this.x = 240 + Math.sin(this.t * 0.55) * 130;
    this.y = 110 + Math.sin(this.t * 1.1) * 14;

    const p = game.player;
    for (const pod of this.pods) {
      if (!pod.alive) continue;
      if (pod.flash > 0) pod.flash -= dt;
      pod.fireIn -= dt;
      if (pod.fireIn <= 0 && p.alive) {
        pod.fireIn = rand(1.6, 2.8) / (0.8 + game.diff * 0.06);
        const px = this.x + pod.off, py = this.podY;
        const a = Math.atan2(p.y - py, p.x - px);
        const spd = (150 + game.diff * 14) * game.bulletF;
        game.enemyBullets.push(new EnemyBullet(px, py, Math.cos(a) * spd, Math.sin(a) * spd, false));
      }
    }
    if (this.coreFlash > 0) this.coreFlash -= dt;

    this.ringIn -= dt;
    if (this.ringIn <= 0 && p.alive) {
      this.ringIn = this.coreExposed ? 2.6 : 4.2;
      const n = this.coreExposed ? 16 : 10;
      const spd = (130 + game.diff * 10) * game.bulletF;
      const a0 = Math.random() * 6.3;
      for (let i = 0; i < n; i++) {
        const a = a0 + i * Math.PI * 2 / n;
        game.enemyBullets.push(new EnemyBullet(
          this.x, this.coreY, Math.cos(a) * spd, Math.abs(Math.sin(a)) * spd * 0.7 + 40, false
        ));
      }
    }
  }

  /* Rückgabe: true wenn Treffer verarbeitet */
  hitTest(b, game) {
    const dmg = b.dmg || 1;
    // Türme
    for (const pod of this.pods) {
      if (!pod.alive) continue;
      if (dist2(b.x, b.y, this.x + pod.off, this.podY) < 18 * 18) {
        pod.hp -= dmg;
        pod.flash = 0.08;
        if (pod.hp <= 0) {
          pod.alive = false;
          spawnExplosion(game, this.x + pod.off, this.podY, { count: 16 });
          game.explosions.push(new BoomAnim(this.x + pod.off, this.podY, 2.6));
          game.shocks.push(new Shockwave(this.x + pod.off, this.podY, 40));
          game.sound.sfx('expl');
          game.addScore(game.pts(400), this.x + pod.off, this.podY);
          if (this.coreExposed) game.banner('KERN FREIGELEGT!', '#ffe066');
        }
        return true;
      }
    }
    // Kern
    if (this.coreExposed && dist2(b.x, b.y, this.x, this.coreY) < 24 * 24) {
      this.coreHp -= dmg;
      this.coreFlash = 0.07;
      if (this.coreHp <= 0 && this.dying <= 0) {
        this.dying = 2.2;
        game.sound.sfx('gexpl');
        game.shake(14, 1.2);
      }
      return true;
    }
    // Rumpf blockt Schüsse
    if (Math.abs(b.x - this.x) < this.w / 2 && Math.abs(b.y - this.y) < this.h / 2) {
      return true;
    }
    return false;
  }

  /* Kollisionsschaden am Spieler prüfen */
  bodyHit(px, py, pr) {
    return Math.abs(px - this.x) < this.w / 2 + pr - 6 && Math.abs(py - this.y) < this.h / 2 + pr - 6;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const wob = Math.sin(this.t * 1.1) * 0.02;
    ctx.rotate(wob);

    // Rumpf (Pixel-Schlachtschiff, Scale 3)
    drawSprite(ctx, SPRITES.boss, 0, 0, { scale: 3 });

    // Positionslichter an den Flügelspitzen
    const bl = 0.5 + 0.5 * Math.sin(this.t * 5);
    ctx.fillStyle = `rgba(255,80,80,${0.4 + 0.6 * bl})`;
    ctx.beginPath(); ctx.arc(-96, -3, 3.5, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.arc(96, -3, 3.5, 0, 6.3); ctx.fill();

    // Türme
    for (const pod of this.pods) {
      if (!pod.alive) {
        drawSprite(ctx, SPRITES.bossPodDead, pod.off, 34);
        continue;
      }
      drawSprite(ctx, SPRITES.bossPod, pod.off, 34, { flash: pod.flash > 0 ? pod.flash + 0.04 : 0 });
      const hpF = pod.hp / pod.maxHp;
      ctx.fillStyle = '#141822';
      ctx.fillRect(pod.off - 12, 48, 24, 3);
      ctx.fillStyle = '#ff7fb0';
      ctx.fillRect(pod.off - 12, 48, 24 * hpF, 3);
    }

    // Kern
    const exposed = this.coreExposed;
    if (this.coreFlash > 0) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 16; }
    const pulse = 0.5 + 0.5 * Math.sin(this.t * (exposed ? 7 : 2.5));
    ctx.fillStyle = exposed
      ? `rgba(255,${90 + pulse * 80},60,1)`
      : '#2c3242';
    ctx.beginPath(); ctx.arc(0, 20, 18, 0, 6.3); ctx.fill();
    ctx.shadowBlur = 0;
    if (exposed) {
      ctx.fillStyle = `rgba(255,235,180,${0.5 + 0.5 * pulse})`;
      ctx.beginPath(); ctx.arc(0, 20, 8 + pulse * 3, 0, 6.3); ctx.fill();
    } else {
      ctx.strokeStyle = `rgba(120,200,255,${0.3 + 0.4 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 20, 22, 0, 6.3); ctx.stroke();
      ctx.lineWidth = 1;
    }

    ctx.restore();
  }

  drawHpBar(ctx) {
    const total = this.coreMax + this.pods.reduce((s, p) => s + p.maxHp, 0);
    const cur = Math.max(0, this.coreHp) + this.pods.reduce((s, p) => s + Math.max(0, p.hp), 0);
    const f = cur / total;
    ctx.fillStyle = 'rgba(10,14,24,0.7)';
    ctx.fillRect(90, 34, 300, 8);
    ctx.fillStyle = f > 0.4 ? '#ff5c8f' : '#ffdd57';
    ctx.fillRect(91, 35, 298 * f, 6);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.strokeRect(90.5, 34.5, 299, 7);
  }
}

/* ============================================================
   FESTUNGS-BOSS — Kern nur mit Bomben verwundbar!
   Ab Stufe 2 im Wechsel mit dem Mutterschiff.
   ============================================================ */

class Fortress {
  constructor(stage) {
    this.kind = 'fortress';
    this.stage = stage;
    this.x = 240; this.y = -140;
    this.t = 0;
    this.alive = true;
    this.entering = true;
    this.w = 185; this.h = 88;
    this.pods = [-64, 64].map(off => ({
      off, hp: 10 + stage * 2, maxHp: 10 + stage * 2, alive: true, flash: 0, fireIn: rand(1.2, 2.4),
    }));
    this.coreHp = 24 + stage * 8;
    this.coreMax = this.coreHp;
    this.coreFlash = 0;
    this.coreOpen = false;
    this.coreTimer = 3.0;
    this.gunTimer = 2.0;
    this.spiralT = 0;
    this.spiralA = 0;
    this.score = 6000 + (stage - 1) * 1500;
    this.dying = 0;
  }

  get coreY() { return this.y + 24; }
  get bombable() { return this.coreOpen && !this.entering && this.dying <= 0; }

  update(dt, game) {
    this.t += dt;
    if (this.dying > 0) {
      this.dying -= dt;
      if (Math.random() < dt * 24) {
        const ex = this.x + rand(-85, 85), ey = this.y + rand(-30, 45);
        spawnExplosion(game, ex, ey, { count: 10 });
        game.explosions.push(new BoomAnim(ex, ey, rand(2, 3.4)));
        game.sound.sfx('expl');
      }
      if (this.dying <= 0) {
        this.alive = false;
        game.onBossDefeated(this);
      }
      return;
    }

    if (this.entering) {
      this.y += (150 - this.y) * Math.min(1, 1.5 * dt);
      if (this.y > 146) this.entering = false;
      return;
    }

    this.x = 240 + Math.sin(this.t * 0.42) * 100;
    this.y = 150 + Math.sin(this.t * 0.9) * 7;

    const p = game.player;

    // Kern-Zyklus: zu → offen → zu ...
    this.coreTimer -= dt;
    if (this.coreTimer <= 0) {
      this.coreOpen = !this.coreOpen;
      this.coreTimer = this.coreOpen ? 2.8 : 3.2;
      if (this.coreOpen) game.sound.sfx('lock');
    }

    // Türme feuern gezielt
    for (const pod of this.pods) {
      if (!pod.alive) continue;
      if (pod.flash > 0) pod.flash -= dt;
      pod.fireIn -= dt;
      if (pod.fireIn <= 0 && p.alive) {
        pod.fireIn = rand(1.5, 2.6) / (0.8 + game.diff * 0.06);
        const px = this.x + pod.off, py = this.y + 30;
        const a = Math.atan2(p.y - py, p.x - px);
        const spd = (155 + game.diff * 13) * game.bulletF;
        game.enemyBullets.push(new EnemyBullet(px, py, Math.cos(a) * spd, Math.sin(a) * spd, false));
      }
    }
    if (this.coreFlash > 0) this.coreFlash -= dt;

    // Hüllengeschütze: Doppelsalven
    this.gunTimer -= dt;
    if (this.gunTimer <= 0 && p.alive) {
      this.gunTimer = 2.6 / (0.8 + game.diff * 0.07);
      for (const gx of [-28, 28]) {
        const a = Math.atan2(p.y - (this.y + 36), p.x - (this.x + gx));
        const spd = (120 + game.diff * 10) * game.bulletF;
        game.enemyBullets.push(new EnemyBullet(this.x + gx, this.y + 36, Math.cos(a) * spd, Math.sin(a) * spd, true));
      }
    }

    // offener Kern: rotierende Spirale
    if (this.coreOpen && p.alive) {
      this.spiralT -= dt;
      if (this.spiralT <= 0) {
        this.spiralT = 0.17;
        this.spiralA += 0.9;
        const spd = (110 + game.diff * 9) * game.bulletF;
        for (const s of [0, Math.PI]) {
          game.enemyBullets.push(new EnemyBullet(
            this.x, this.coreY,
            Math.cos(this.spiralA + s) * spd,
            Math.abs(Math.sin(this.spiralA + s)) * spd * 0.7 + 30, false
          ));
        }
      }
    }
  }

  /* Schüsse: Türme verwundbar, Kern liegt tief — nur Bomben! */
  hitTest(b, game) {
    const dmg = b.dmg || 1;
    for (const pod of this.pods) {
      if (!pod.alive) continue;
      if (dist2(b.x, b.y, this.x + pod.off, this.y + 30) < 17 * 17) {
        pod.hp -= dmg;
        pod.flash = 0.08;
        if (pod.hp <= 0) {
          pod.alive = false;
          spawnExplosion(game, this.x + pod.off, this.y + 30, { count: 16 });
          game.explosions.push(new BoomAnim(this.x + pod.off, this.y + 30, 2.6));
          game.shocks.push(new Shockwave(this.x + pod.off, this.y + 30, 40));
          game.sound.sfx('expl');
          game.addScore(game.pts(500), this.x + pod.off, this.y + 30);
        }
        return true;
      }
    }
    // Rumpf blockt alles — Funkenflug am Kernschacht
    if (Math.abs(b.x - this.x) < this.w / 2 && Math.abs(b.y - this.y) < this.h / 2) {
      if (dist2(b.x, b.y, this.x, this.coreY) < 26 * 26 && Math.random() < 0.4) {
        game.particles.push(new Particle(b.x, b.y, rand(-60, 60), rand(-80, -20),
          rand(0.1, 0.25), rand(1.5, 3), '#cfd8ea', true));
      }
      return true;
    }
    return false;
  }

  /* Bombentreffer auf den offenen Kern */
  bombHit(x, y, r, game) {
    if (!this.bombable) return false;
    if (dist2(x, y, this.x, this.coreY) > (r + 22) * (r + 22)) return false;
    this.coreHp -= 5;
    this.coreFlash = 0.1;
    spawnExplosion(game, this.x, this.coreY, { count: 18 });
    game.shocks.push(new Shockwave(this.x, this.coreY, 60, '255,180,90'));
    if (this.coreHp <= 0 && this.dying <= 0) {
      this.dying = 2.2;
      game.sound.sfx('gexpl');
      game.shake(14, 1.2);
    }
    return true;
  }

  bodyHit(px, py, pr) {
    return Math.abs(px - this.x) < this.w / 2 + pr - 8 && Math.abs(py - this.y) < this.h / 2 + pr - 8;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    drawSprite(ctx, SPRITES.fortress, 0, 0, { scale: 3 });

    // Türme
    for (const pod of this.pods) {
      if (!pod.alive) {
        drawSprite(ctx, SPRITES.bossPodDead, pod.off, 30);
        continue;
      }
      drawSprite(ctx, SPRITES.fortressPod, pod.off, 30, { flash: pod.flash > 0 ? pod.flash + 0.04 : 0 });
      const hpF = pod.hp / pod.maxHp;
      ctx.fillStyle = '#141822';
      ctx.fillRect(pod.off - 12, 44, 24, 3);
      ctx.fillStyle = '#c6e06a';
      ctx.fillRect(pod.off - 12, 44, 24 * hpF, 3);
    }

    // Kernschacht
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 7);
    if (this.coreFlash > 0) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 16; }
    if (this.coreOpen && !this.entering) {
      ctx.fillStyle = '#1a1008';
      ctx.beginPath(); ctx.arc(0, 24, 19, 0, 6.3); ctx.fill();
      ctx.fillStyle = `rgba(255,${110 + pulse * 70},50,1)`;
      ctx.beginPath(); ctx.arc(0, 24, 14, 0, 6.3); ctx.fill();
      ctx.fillStyle = `rgba(255,235,180,${0.5 + 0.5 * pulse})`;
      ctx.beginPath(); ctx.arc(0, 24, 6 + pulse * 3, 0, 6.3); ctx.fill();
      // Hinweisring: jetzt bombardieren!
      ctx.strokeStyle = `rgba(255,200,90,${0.4 + 0.4 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 24, 24 + pulse * 3, 0, 6.3); ctx.stroke();
      ctx.lineWidth = 1;
    } else {
      // geschlossene Panzerluke
      ctx.fillStyle = '#262d3b';
      ctx.beginPath(); ctx.arc(0, 24, 18, 0, 6.3); ctx.fill();
      ctx.strokeStyle = '#10141f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-18, 24); ctx.lineTo(18, 24);
      ctx.moveTo(0, 6); ctx.lineTo(0, 42);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(140,160,200,0.3)';
      ctx.beginPath(); ctx.arc(0, 24, 18, 0, 6.3); ctx.stroke();
      ctx.lineWidth = 1;
    }
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  drawHpBar(ctx) {
    const total = this.coreMax + this.pods.reduce((s, p) => s + p.maxHp, 0);
    const cur = Math.max(0, this.coreHp) + this.pods.reduce((s, p) => s + Math.max(0, p.hp), 0);
    const f = cur / total;
    ctx.fillStyle = 'rgba(10,14,24,0.7)';
    ctx.fillRect(90, 34, 300, 8);
    ctx.fillStyle = f > 0.4 ? '#c6e06a' : '#ffdd57';
    ctx.fillRect(91, 35, 298 * f, 6);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.strokeRect(90.5, 34.5, 299, 7);
  }
}

/* ============================================================
   POWER-UPS
   ============================================================ */

const POWERUP_DEFS = {
  S:  { color: '#46c8ff', label: 'S',   name: 'Fächerfeuer +' },
  L:  { color: '#5c8dff', label: 'L',   name: 'Laser +' },
  H:  { color: '#ff8f4d', label: 'H',   name: 'Zielsuchraketen' },
  R:  { color: '#ffd166', label: 'R',   name: 'Feuerrate +' },
  E:  { color: '#7bed9f', label: 'E',   name: 'Schild voll' },
  D:  { color: '#c9a0ff', label: 'D',   name: 'Drohne' },
  B:  { color: '#ff9d2e', label: 'B',   name: 'Mega-Bomben' },
  U:  { color: '#ff7fb0', label: '1UP', name: 'Extraleben' },
};

class PowerUp {
  constructor(x, y, type) {
    this.x = x; this.y = y;
    this.type = type;
    this.t = 0;
    this.alive = true;
  }
  update(dt, game) {
    this.t += dt;
    const p = game.player;
    // sanfter Magnet, damit nichts Frustrierendes knapp vorbeitreibt
    if (p.alive && dist2(this.x, this.y, p.x, p.y) < 120 * 120) {
      this.x += (p.x - this.x) * 3.2 * dt;
      this.y += (p.y - this.y) * 3.2 * dt;
    } else {
      this.y += 85 * dt;
      this.x += Math.sin(this.t * 2.2) * 40 * dt;
    }
    if (this.y > 840) this.alive = false;
  }
  draw(ctx) {
    const def = POWERUP_DEFS[this.type];
    const pulse = 0.85 + 0.15 * Math.sin(this.t * 6);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = def.color + '44';
    ctx.beginPath(); ctx.arc(0, 0, 20 * pulse, 0, 6.3); ctx.fill();
    // Gradius-artige Pixel-Kapsel
    drawSprite(ctx, SPRITES.capsule, 0, 0, { rot: Math.sin(this.t * 3) * 0.15 });
    ctx.fillStyle = ['E', 'D', 'L'].includes(this.type) ? def.color : '#7a2f10';
    ctx.font = `bold ${this.type === 'U' ? 8 : 12}px 'Segoe UI', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.label, 0, 1);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }
}
