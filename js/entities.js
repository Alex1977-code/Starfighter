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

/* Bombe fliegt zum anvisierten Bodenziel */
class Bomb {
  constructor(x, y, tx, ty) {
    this.sx = x; this.sy = y;
    this.tx = tx; this.ty = ty;
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
    this.ty += game.scrollSpeed * dt;
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
    this.spread = 1;                     // 1..3 Fächerstufen
    this.rapid = 0;                      // 0..2 Feuerraten-Stufen
    this.drones = 0;                     // 0..2 Begleit-Drohnen
    this.megaBomb = false;               // größerer Bombenradius
    this.fireTimer = 0;
    this.bombTimer = 0;
    this.invuln = 0;
    this.alive = true;
    this.vx = 0; this.vy = 0;            // nur fürs Banking / Effekte
    this.tilt = 0;
    this.t = 0;
  }

  get fireInterval() { return 1 / (7 + this.rapid * 3.5); }
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
  }

  shoot(game) {
    const B = game.playerBullets;
    B.push(new PlayerBullet(this.x, this.y - 20, 0, -560));
    if (this.spread >= 2) {
      B.push(new PlayerBullet(this.x - 10, this.y - 12, -95, -540));
      B.push(new PlayerBullet(this.x + 10, this.y - 12, 95, -540));
    }
    if (this.spread >= 3) {
      B.push(new PlayerBullet(this.x - 14, this.y - 6, -195, -500));
      B.push(new PlayerBullet(this.x + 14, this.y - 6, 195, -500));
    }
    for (let i = 0; i < this.drones; i++) {
      const off = i === 0 ? -34 : 34;
      B.push(new PlayerBullet(this.x + off, this.y + 2, 0, -560));
    }
    game.sound.sfx('shot');
  }

  draw(ctx) {
    const blink = this.invuln > 0 && Math.floor(this.t * 14) % 2 === 0;
    if (blink) ctx.globalAlpha = 0.35;

    // Drohnen
    for (let i = 0; i < this.drones; i++) {
      const off = i === 0 ? -34 : 34;
      const bob = Math.sin(this.t * 5 + i * 3) * 3;
      ctx.save();
      ctx.translate(this.x + off, this.y + 4 + bob);
      ctx.fillStyle = 'rgba(90,200,255,0.25)';
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#bfe9ff';
      ctx.beginPath();
      ctx.moveTo(0, -8); ctx.lineTo(6, 5); ctx.lineTo(0, 2); ctx.lineTo(-6, 5);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.tilt);

    // Triebwerksflamme
    const fl = 10 + Math.sin(this.t * 40) * 3;
    const fg = ctx.createLinearGradient(0, 14, 0, 14 + fl + 12);
    fg.addColorStop(0, 'rgba(160,230,255,0.95)');
    fg.addColorStop(0.5, 'rgba(60,140,255,0.6)');
    fg.addColorStop(1, 'rgba(60,140,255,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-5, 14); ctx.lineTo(5, 14); ctx.lineTo(0, 14 + fl + 12);
    ctx.closePath(); ctx.fill();

    // Rumpf
    const body = ctx.createLinearGradient(0, -24, 0, 18);
    body.addColorStop(0, '#f2f7ff');
    body.addColorStop(0.55, '#b9c8e2');
    body.addColorStop(1, '#7c8cad');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(7, -4);
    ctx.lineTo(24, 10);
    ctx.lineTo(24, 15);
    ctx.lineTo(8, 12);
    ctx.lineTo(5, 17);
    ctx.lineTo(-5, 17);
    ctx.lineTo(-8, 12);
    ctx.lineTo(-24, 15);
    ctx.lineTo(-24, 10);
    ctx.lineTo(-7, -4);
    ctx.closePath();
    ctx.fill();

    // Flügelspitzen-Akzente
    ctx.fillStyle = '#ff9d2e';
    ctx.fillRect(-24, 10, 4, 5);
    ctx.fillRect(20, 10, 4, 5);

    // Cockpit
    ctx.fillStyle = '#39d5ff';
    ctx.beginPath();
    ctx.ellipse(0, -8, 3.4, 7, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(-1, -11, 1.2, 2.6, 0, 0, 6.3);
    ctx.fill();

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
  preDraw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.flash > 0) {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 14;
    }
  }
  postDraw(ctx) { ctx.restore(); }
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
    this.preDraw(ctx);
    ctx.rotate(Math.sin(this.t * 3.2 + this.phase) * 0.25);
    ctx.fillStyle = '#c33f6e';
    ctx.beginPath();
    ctx.moveTo(0, 12); ctx.lineTo(12, -6); ctx.lineTo(0, -2); ctx.lineTo(-12, -6);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff8fb3';
    ctx.beginPath(); ctx.arc(0, 2, 4, 0, 6.3); ctx.fill();
    this.postDraw(ctx);
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
    this.preDraw(ctx);
    ctx.rotate((this.fromLeft ? 1 : -1) * 1.35);
    ctx.fillStyle = '#d95f2b';
    ctx.beginPath();
    ctx.moveTo(0, -14); ctx.lineTo(9, 4); ctx.lineTo(0, 14); ctx.lineTo(-9, 4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, 6.3); ctx.fill();
    this.postDraw(ctx);
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
    this.preDraw(ctx);
    ctx.rotate(this.state === 2 ? Math.atan2(this.vx, this.vy) * -1 : Math.sin(this.t * 8) * 0.2);
    ctx.fillStyle = this.state === 2 ? '#ff4757' : '#b8405e';
    ctx.beginPath();
    ctx.moveTo(0, 13); ctx.lineTo(10, -9); ctx.lineTo(0, -4); ctx.lineTo(-10, -9);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffe066';
    ctx.beginPath(); ctx.arc(0, 4, 3, 0, 6.3); ctx.fill();
    this.postDraw(ctx);
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
    this.preDraw(ctx);
    ctx.fillStyle = '#8a4bd6';
    ctx.beginPath();
    ctx.moveTo(0, -16); ctx.lineTo(14, -4); ctx.lineTo(17, 10);
    ctx.lineTo(6, 14); ctx.lineTo(-6, 14); ctx.lineTo(-17, 10); ctx.lineTo(-14, -4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c9a0ff';
    ctx.fillRect(-9, -2, 18, 4);
    const gl = 0.5 + 0.5 * Math.sin(this.t * 6);
    ctx.fillStyle = `rgba(255,120,220,${0.4 + 0.5 * gl})`;
    ctx.beginPath(); ctx.arc(0, 7, 4.5, 0, 6.3); ctx.fill();
    this.postDraw(ctx);
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
      const spd = 120 + game.diff * 14;
      this.spiralA += 2.4;
      game.enemyBullets.push(new EnemyBullet(
        this.x, this.y,
        Math.cos(this.spiralA) * spd, Math.abs(Math.sin(this.spiralA)) * spd * 0.6 + spd * 0.55,
        false
      ));
    }
  }
  draw(ctx) {
    this.preDraw(ctx);
    ctx.rotate(this.t * 4);
    ctx.fillStyle = '#2fbf9f';
    for (let i = 0; i < 3; i++) {
      ctx.rotate(Math.PI * 2 / 3);
      ctx.beginPath();
      ctx.moveTo(0, -4); ctx.lineTo(16, -10); ctx.lineTo(16, -2);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#aef3e2';
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#0d6653';
    ctx.beginPath(); ctx.arc(0, 0, 3, 0, 6.3); ctx.fill();
    this.postDraw(ctx);
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
        const spd = 95 + game.diff * 11;
        game.enemyBullets.push(new EnemyBullet(
          this.x + Math.cos(this.aim) * 14, this.y + Math.sin(this.aim) * 14,
          Math.cos(this.aim) * spd, Math.sin(this.aim) * spd, true
        ));
      }
    }
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.flash > 0) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 12; }

    // Bodenschatten macht klar: das ist ein Bodenziel
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath();
    ctx.ellipse(3, 5, this.r + 3, this.r * 0.75, 0, 0, 6.3);
    ctx.fill();

    switch (this.type) {
      case 'dome': {
        ctx.fillStyle = '#5d6675';
        ctx.beginPath(); ctx.arc(0, 0, 14, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#828da0';
        ctx.beginPath(); ctx.arc(-3, -4, 9, 0, 6.3); ctx.fill();
        const gl = 0.5 + 0.5 * Math.sin(this.t * 2.4);
        ctx.fillStyle = `rgba(255,90,90,${0.35 + 0.55 * gl})`;
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, 6.3); ctx.fill();
        break;
      }
      case 'turret': {
        ctx.fillStyle = '#4d5666';
        ctx.beginPath(); ctx.arc(0, 0, 15, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#6c7788';
        ctx.beginPath(); ctx.arc(0, 0, 10, 0, 6.3); ctx.fill();
        ctx.strokeStyle = '#39404d';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(this.aim) * 19, Math.sin(this.aim) * 19);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillStyle = '#ff6b5c';
        ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, 6.3); ctx.fill();
        break;
      }
      case 'tank': {
        ctx.rotate(this.dir > 0 ? 0.05 : -0.05);
        ctx.fillStyle = '#57604f';
        ctx.fillRect(-14, -10, 28, 20);
        ctx.fillStyle = '#3c452f';
        ctx.fillRect(-16, -12, 6, 24);
        ctx.fillRect(10, -12, 6, 24);
        ctx.fillStyle = '#707a63';
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, 6.3); ctx.fill();
        ctx.strokeStyle = '#39402f';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(this.aim) * 16, Math.sin(this.aim) * 16);
        ctx.stroke();
        ctx.lineWidth = 1;
        break;
      }
      case 'radar': {
        ctx.fillStyle = '#4d5666';
        ctx.beginPath(); ctx.arc(0, 2, 12, 0, 6.3); ctx.fill();
        ctx.save();
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
        ctx.beginPath(); ctx.arc(0, 2, 3.5, 0, 6.3); ctx.fill();
        break;
      }
    }
    ctx.restore();
  }
}

/* ============================================================
   BOSS — Mutterschiff mit Türmen und Kern
   ============================================================ */

class Boss {
  constructor(stage) {
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
        spawnExplosion(game, this.x + rand(-90, 90), this.y + rand(-30, 50), { count: 14 });
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
        const spd = 150 + game.diff * 14;
        game.enemyBullets.push(new EnemyBullet(px, py, Math.cos(a) * spd, Math.sin(a) * spd, false));
      }
    }
    if (this.coreFlash > 0) this.coreFlash -= dt;

    this.ringIn -= dt;
    if (this.ringIn <= 0 && p.alive) {
      this.ringIn = this.coreExposed ? 2.6 : 4.2;
      const n = this.coreExposed ? 16 : 10;
      const spd = 130 + game.diff * 10;
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
    // Türme
    for (const pod of this.pods) {
      if (!pod.alive) continue;
      if (dist2(b.x, b.y, this.x + pod.off, this.podY) < 18 * 18) {
        pod.hp -= 1;
        pod.flash = 0.08;
        if (pod.hp <= 0) {
          pod.alive = false;
          spawnExplosion(game, this.x + pod.off, this.podY, { count: 20 });
          game.sound.sfx('expl');
          game.addScore(400, this.x + pod.off, this.podY);
          if (this.coreExposed) game.banner('KERN FREIGELEGT!', '#ffe066');
        }
        return true;
      }
    }
    // Kern
    if (this.coreExposed && dist2(b.x, b.y, this.x, this.coreY) < 24 * 24) {
      this.coreHp -= 1;
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

    // Rumpf
    const g = ctx.createLinearGradient(0, -50, 0, 50);
    g.addColorStop(0, '#5a6478');
    g.addColorStop(0.5, '#3d4557');
    g.addColorStop(1, '#262c3a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-100, 10);
    ctx.lineTo(-64, -38);
    ctx.lineTo(64, -38);
    ctx.lineTo(100, 10);
    ctx.lineTo(64, 44);
    ctx.lineTo(-64, 44);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(130,170,220,0.35)';
    ctx.stroke();

    // Struktur-Linien
    ctx.strokeStyle = 'rgba(20,24,34,0.6)';
    for (let i = -60; i <= 60; i += 30) {
      ctx.beginPath();
      ctx.moveTo(i, -36); ctx.lineTo(i, 42);
      ctx.stroke();
    }

    // Positionslichter
    const bl = 0.5 + 0.5 * Math.sin(this.t * 5);
    ctx.fillStyle = `rgba(255,80,80,${0.4 + 0.6 * bl})`;
    ctx.beginPath(); ctx.arc(-96, 10, 3.5, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.arc(96, 10, 3.5, 0, 6.3); ctx.fill();

    // Türme
    for (const pod of this.pods) {
      if (!pod.alive) {
        ctx.fillStyle = '#1c212c';
        ctx.beginPath(); ctx.arc(pod.off, 34, 12, 0, 6.3); ctx.fill();
        continue;
      }
      if (pod.flash > 0) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 12; }
      ctx.fillStyle = '#79486e';
      ctx.beginPath(); ctx.arc(pod.off, 34, 14, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#b76ba5';
      ctx.beginPath(); ctx.arc(pod.off, 30, 8, 0, 6.3); ctx.fill();
      ctx.shadowBlur = 0;
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
   POWER-UPS
   ============================================================ */

const POWERUP_DEFS = {
  S:  { color: '#46c8ff', label: 'S',   name: 'Fächerfeuer +' },
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
    ctx.rotate(Math.sin(this.t * 3) * 0.15);
    ctx.fillStyle = 'rgba(10,16,30,0.9)';
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, 6.3); ctx.fill();
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, 6.3); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = def.color;
    ctx.font = `bold ${this.type === 'U' ? 9 : 13}px 'Segoe UI', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.label, 0, 1);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }
}
