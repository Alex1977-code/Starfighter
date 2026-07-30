/* ============================================================
   STARFIGHTER — Hauptspiel
   Spielschleife, Wellen-Direktor, Kollisionen, Scoring/Kette,
   HUD, Touch-/Tastatur-Steuerung, Bestenliste, Screens.
   ============================================================ */

const W = 480, H = 800;

/* ---------- Persistenz ---------- */
const LS_SETTINGS = 'starfighter.settings.v1';
const LS_SCORES = 'starfighter.scores.v1';

function loadJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v === null || v === undefined ? fallback : v;
  } catch (e) { return fallback; }
}
function saveJSON(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* voll/privat */ }
}

/* ============================================================ */

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.sound = Sound;

    this.settings = Object.assign({
      soundMode: 'modern',   // 'modern' | 'retro'
      music: true,
      sfx: true,
      vibrate: true,
      sense: 'normal',       // 'normal' | 'high'
      lastName: '',
    }, loadJSON(LS_SETTINGS, {}));

    Sound.setMode(this.settings.soundMode);
    Sound.setMusicOn(this.settings.music);
    Sound.setSfxOn(this.settings.sfx);

    this.terrain = new Terrain(W, H);
    this.state = 'title';
    this.paused = false;
    this.time = 0;

    this.cssScale = 1;
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.initInput();
    this.initUI();
    this.refreshTitleHiscore();

    this.resetWorld();

    this.last = performance.now();
    requestAnimationFrame(t => this.frame(t));
  }

  /* ---------- Skalierung / Letterbox ---------- */
  resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const s = Math.min(vw / W, vh / H);
    this.cssScale = s;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.canvas.style.width = `${W * s}px`;
    this.canvas.style.height = `${H * s}px`;
    this.dpr = dpr;
  }

  /* ---------- Weltzustand ---------- */
  resetWorld() {
    this.player = new Player();
    this.playerBullets = [];
    this.enemyBullets = [];
    this.airEnemies = [];
    this.groundEnemies = [];
    this.bombs = [];
    this.powerups = [];
    this.particles = [];
    this.floats = [];
    this.boss = null;

    this.score = 0;
    this.lives = 3;
    this.stage = 1;
    this.stageTimer = 0;
    this.nextLifeAt = 30000;
    this.chain = 0;
    this.chainTimer = 0;
    this.killsSinceDrop = 0;

    this.airTimer = 1.2;
    this.groundTimer = 1.6;
    this.deathTimer = 0;

    this.shakeAmp = 0;
    this.shakeTime = 0;
    this.hitFlash = 0;

    this.scrollSpeed = 92;
    this.terrain.reset((Math.random() * 1e9) | 0);
  }

  get diff() {
    return Math.min(4.5, 1 + (this.stage - 1) * 0.35 + this.stageTimer * 0.004);
  }

  /* ============================================================
     INPUT
     ============================================================ */
  initInput() {
    const c = this.canvas;
    this.pointerId = null;
    this.lastPX = 0; this.lastPY = 0;
    this.keys = new Set();

    const sens = () => (this.settings.sense === 'high' ? 2.1 : 1.5) / this.cssScale;

    c.addEventListener('pointerdown', e => {
      e.preventDefault();
      Sound.ensure();
      if (this.state === 'playing' && !this.paused && this.pointerId === null) {
        this.pointerId = e.pointerId;
        this.lastPX = e.clientX; this.lastPY = e.clientY;
        try { c.setPointerCapture(e.pointerId); } catch (err) {}
      }
    });
    c.addEventListener('pointermove', e => {
      if (e.pointerId !== this.pointerId) return;
      e.preventDefault();
      const k = sens();
      const dx = (e.clientX - this.lastPX) * k;
      const dy = (e.clientY - this.lastPY) * k;
      this.lastPX = e.clientX; this.lastPY = e.clientY;
      if (this.state === 'playing' && !this.paused && this.player.alive) {
        this.player.move(dx, dy);
      }
    });
    const release = e => {
      if (e.pointerId === this.pointerId) this.pointerId = null;
    };
    c.addEventListener('pointerup', release);
    c.addEventListener('pointercancel', release);

    window.addEventListener('keydown', e => {
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (this.state === 'playing') this.togglePause();
        return;
      }
      this.keys.add(e.key.toLowerCase());
      if ((e.key === ' ' || e.key === 'Enter') && this.state === 'title'
          && !this.isAnyPanelOpen()) {
        this.startGame();
      }
    });
    window.addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing' && !this.paused) this.togglePause();
    });
  }

  keyboardMove(dt) {
    let dx = 0, dy = 0;
    const k = this.keys;
    if (k.has('arrowleft') || k.has('a')) dx -= 1;
    if (k.has('arrowright') || k.has('d')) dx += 1;
    if (k.has('arrowup') || k.has('w')) dy -= 1;
    if (k.has('arrowdown') || k.has('s')) dy += 1;
    if (dx || dy) {
      const n = Math.hypot(dx, dy);
      const spd = 380 * dt;
      this.player.move(dx / n * spd, dy / n * spd);
    }
  }

  vibrate(pattern) {
    if (this.settings.vibrate && navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) {}
    }
  }

  /* ============================================================
     UI / SCREENS
     ============================================================ */
  $(id) { return document.getElementById(id); }
  show(id) { this.$(id).classList.remove('hidden'); }
  hide(id) { this.$(id).classList.add('hidden'); }
  isAnyPanelOpen() {
    return ['screenOptions', 'screenHelp', 'screenScores']
      .some(id => !this.$(id).classList.contains('hidden'));
  }

  initUI() {
    const ui = () => Sound.sfx('ui');

    this.$('btnStart').addEventListener('click', () => { Sound.ensure(); ui(); this.startGame(); });
    this.$('btnScores').addEventListener('click', () => { ui(); this.openScores(); });
    this.$('btnOptions').addEventListener('click', () => { ui(); this.openOptions('title'); });
    this.$('btnHelp').addEventListener('click', () => { ui(); this.hide('screenTitle'); this.show('screenHelp'); });
    this.$('btnHelpBack').addEventListener('click', () => { ui(); this.hide('screenHelp'); this.show('screenTitle'); });
    this.$('btnScoresBack').addEventListener('click', () => { ui(); this.hide('screenScores'); this.show('screenTitle'); });

    this.$('btnOptionsBack').addEventListener('click', () => {
      ui();
      this.hide('screenOptions');
      if (this.optionsFrom === 'pause') this.show('screenPause');
      else this.show('screenTitle');
    });

    this.$('pauseBtn').addEventListener('click', () => { if (this.state === 'playing') this.togglePause(); });
    this.$('btnResume').addEventListener('click', () => { ui(); this.togglePause(); });
    this.$('btnPauseOptions').addEventListener('click', () => { ui(); this.hide('screenPause'); this.openOptions('pause'); });
    this.$('btnAbort').addEventListener('click', () => { ui(); this.hide('screenPause'); this.paused = false; this.gameOver(true); });

    this.$('btnRetry').addEventListener('click', () => { ui(); this.hide('screenGameOver'); this.startGame(); });
    this.$('btnToTitle').addEventListener('click', () => { ui(); this.hide('screenGameOver'); this.toTitle(); });

    this.$('btnSaveScore').addEventListener('click', () => this.submitScore());
    this.$('nameInput').addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') this.submitScore();
    });

    // Options-Toggles
    this.bindToggle('optSoundMode', () => {
      const retro = this.settings.soundMode === 'retro';
      this.settings.soundMode = retro ? 'modern' : 'retro';
      Sound.setMode(this.settings.soundMode);
      Sound.sfx('power');   // sofort hörbares Beispiel des neuen Stils
    }, btn => {
      const retro = this.settings.soundMode === 'retro';
      btn.textContent = retro ? '8-Bit' : 'Modern';
      btn.classList.toggle('retro', retro);
      btn.classList.toggle('on', !retro);
    });

    this.bindToggle('optMusic', () => {
      this.settings.music = !this.settings.music;
      Sound.setMusicOn(this.settings.music);
      if (this.settings.music && this.state === 'playing' && !this.paused) {
        Sound.startMusic(this.boss ? 'boss' : 'main');
      }
    }, btn => {
      btn.textContent = this.settings.music ? 'An' : 'Aus';
      btn.classList.toggle('on', this.settings.music);
    });

    this.bindToggle('optSfx', () => {
      this.settings.sfx = !this.settings.sfx;
      Sound.setSfxOn(this.settings.sfx);
    }, btn => {
      btn.textContent = this.settings.sfx ? 'An' : 'Aus';
      btn.classList.toggle('on', this.settings.sfx);
    });

    this.bindToggle('optVibrate', () => {
      this.settings.vibrate = !this.settings.vibrate;
      if (this.settings.vibrate) this.vibrate(40);
    }, btn => {
      btn.textContent = this.settings.vibrate ? 'An' : 'Aus';
      btn.classList.toggle('on', this.settings.vibrate);
    });

    this.bindToggle('optSense', () => {
      this.settings.sense = this.settings.sense === 'high' ? 'normal' : 'high';
    }, btn => {
      btn.textContent = this.settings.sense === 'high' ? 'Hoch' : 'Normal';
    });
  }

  bindToggle(id, onChange, render) {
    const btn = this.$(id);
    render(btn);
    btn.addEventListener('click', () => {
      Sound.ensure();
      onChange();
      render(btn);
      saveJSON(LS_SETTINGS, this.settings);
    });
  }

  openOptions(from) {
    this.optionsFrom = from;
    this.hide('screenTitle');
    this.show('screenOptions');
  }

  refreshTitleHiscore() {
    const scores = loadJSON(LS_SCORES, []);
    const el = this.$('titleHiscore');
    if (scores.length) {
      el.innerHTML = `Rekord: <b>${scores[0].score.toLocaleString('de-DE')}</b> von <b>${this.escapeHtml(scores[0].name)}</b>`;
    } else {
      el.textContent = 'Noch kein Rekord – zeig, was du kannst!';
    }
  }

  escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  openScores(highlightIdx = -1) {
    this.hide('screenTitle');
    this.hide('screenGameOver');
    const scores = loadJSON(LS_SCORES, []);
    const rows = this.$('scoreRows');
    rows.innerHTML = '';
    this.$('scoresEmpty').style.display = scores.length ? 'none' : 'block';
    scores.forEach((s, i) => {
      const tr = document.createElement('tr');
      if (i === highlightIdx) tr.className = 'you';
      tr.innerHTML =
        `<td class="rank">${i + 1}.</td>` +
        `<td class="name">${this.escapeHtml(s.name)}</td>` +
        `<td class="pts">${s.score.toLocaleString('de-DE')}</td>` +
        `<td class="stg">St. ${s.stage}</td>`;
      rows.appendChild(tr);
    });
    this.show('screenScores');
  }

  /* ============================================================
     SPIELFLUSS
     ============================================================ */
  startGame() {
    this.resetWorld();
    this.cachedScores = null;
    this.state = 'playing';
    this.paused = false;
    this.hide('screenTitle');
    this.hide('screenGameOver');
    this.$('pauseBtn').classList.add('visible');
    this.$('footerNote').style.display = 'none';
    Sound.ensure();
    Sound.startMusic('main');
    this.banner('STUFE 1', '#9fe8ff');
    this.floats.push(new FloatText(W / 2, 470, 'Ziehen = Steuern', '#cfe0ff'));
    this.floats.push(new FloatText(W / 2, 496, 'Feuer & Bomben: automatisch', '#8fa8d0'));
  }

  toTitle() {
    this.state = 'title';
    this.paused = false;
    Sound.stopMusic();
    this.$('pauseBtn').classList.remove('visible');
    this.$('footerNote').style.display = '';
    this.refreshTitleHiscore();
    this.show('screenTitle');
  }

  togglePause() {
    if (this.state !== 'playing') return;
    this.paused = !this.paused;
    if (this.paused) {
      Sound.stopMusic();
      this.show('screenPause');
    } else {
      this.hide('screenPause');
      this.hide('screenOptions');
      Sound.startMusic(this.boss ? 'boss' : 'main');
      this.last = performance.now();
    }
  }

  gameOver(aborted = false) {
    this.state = 'gameover';
    Sound.stopMusic();
    this.$('pauseBtn').classList.remove('visible');

    this.$('finalScore').textContent = this.score.toLocaleString('de-DE');
    this.$('finalStage').textContent = `Erreichte Stufe: ${this.stage}`;

    const scores = loadJSON(LS_SCORES, []);
    const qualifies = !aborted && this.score > 0 &&
      (scores.length < 10 || this.score > scores[scores.length - 1].score);

    const box = this.$('recordBox');
    if (qualifies) {
      box.classList.remove('hidden');
      const inp = this.$('nameInput');
      inp.value = this.settings.lastName || '';
      this.$('btnSaveScore').disabled = false;
    } else {
      box.classList.add('hidden');
    }
    this.show('screenGameOver');
  }

  submitScore() {
    const inp = this.$('nameInput');
    const name = (inp.value.trim() || 'PILOT').toUpperCase().slice(0, 12);
    this.settings.lastName = name;
    saveJSON(LS_SETTINGS, this.settings);

    const scores = loadJSON(LS_SCORES, []);
    const entry = { name, score: this.score, stage: this.stage, date: Date.now() };
    scores.push(entry);
    scores.sort((a, b) => b.score - a.score);
    const top = scores.slice(0, 10);
    saveJSON(LS_SCORES, top);
    this.cachedScores = null;
    Sound.sfx('oneup');

    this.hide('screenGameOver');
    this.openScores(top.indexOf(entry));
  }

  /* ============================================================
     SCORING & EVENTS
     ============================================================ */
  addScore(pts, x, y, silent) {
    this.score += pts;
    if (x !== undefined && !silent) {
      this.floats.push(new FloatText(x, y - 10, `+${pts}`, '#cfe0ff'));
    }
    if (this.score >= this.nextLifeAt) {
      this.nextLifeAt += 50000;
      this.lives++;
      Sound.sfx('oneup');
      this.banner('EXTRALEBEN!', '#7bed9f');
      this.vibrate([40, 60, 40]);
    }
  }

  banner(text, color) {
    this.floats.push(new FloatText(W / 2, 330, text, color || '#ffffff', true));
  }

  shake(amp, dur) {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeTime = Math.max(this.shakeTime, dur);
  }

  onAirKill(e) {
    spawnExplosion(this, e.x, e.y, { count: 20 });
    Sound.sfx('expl');
    this.addScore(e.score, e.x, e.y);
    this.shake(2.5, 0.12);

    this.killsSinceDrop++;
    const isCarrier = (e instanceof Gunner) || (e instanceof Spinner);
    if ((isCarrier && Math.random() < 0.38) || this.killsSinceDrop >= 16) {
      this.killsSinceDrop = 0;
      this.powerups.push(new PowerUp(e.x, e.y, this.pickPowerType()));
    }
  }

  pickPowerType() {
    const p = this.player;
    const pool = [];
    const add = (t, w) => { for (let i = 0; i < w; i++) pool.push(t); };
    add('S', p.spread < 3 ? 24 : 4);
    add('R', p.rapid < 2 ? 20 : 4);
    add('E', p.shield < p.shieldMax ? 22 : 6);
    add('D', p.drones < 2 ? 12 : 2);
    add('B', p.megaBomb ? 2 : 10);
    if (this.lives < 4) add('U', 3);
    return pick(pool);
  }

  onGroundKill(g) {
    spawnExplosion(this, g.x, g.y, { count: 26, maxSize: 8, colors: ['#ffd166', '#ff7b33', '#ff4d2e', '#ffe9b0'] });
    this.chain = Math.min(8, this.chain + 1);
    this.chainTimer = 6;
    const mult = this.chain;
    const pts = g.score * mult;
    this.score += pts;
    this.floats.push(new FloatText(g.x, g.y - 14,
      mult > 1 ? `+${pts} ×${mult}` : `+${pts}`,
      mult >= 4 ? '#ffe066' : '#ffd9a0'));
    Sound.sfx('chain', { level: this.chain });
    this.addScore(0);   // Extraleben-Check
  }

  onGroundEscape(g) { /* bewusst straffrei — fair bleiben */ }

  enemyAimedShot(x, y, count) {
    const p = this.player;
    if (!p.alive) return;
    const base = Math.atan2(p.y - y, p.x - x);
    const spd = 135 + this.diff * 16;
    for (let i = 0; i < count; i++) {
      const a = base + (i - (count - 1) / 2) * 0.22;
      this.enemyBullets.push(new EnemyBullet(x, y, Math.cos(a) * spd, Math.sin(a) * spd, false));
    }
  }

  bombImpact(x, y) {
    const r = this.player.bombRadius;
    spawnExplosion(this, x, y, { count: 30, speed: 240, maxSize: 9, lifeScale: 1.2 });
    Sound.sfx('gexpl');
    this.shake(5, 0.2);
    this.vibrate(30);

    let kills = 0;
    for (const g of this.groundEnemies) {
      if (g.alive && dist2(g.x, g.y, x, y) < (r + g.r) * (r + g.r)) {
        g.hurt(1, this);
        kills++;
      }
    }
    if (kills === 0 && this.chain > 0) {
      this.chain = 0;
      this.floats.push(new FloatText(x, y, 'Kette verloren', '#8fa8d0'));
    }
  }

  onBossDefeated(boss) {
    this.addScore(boss.score);
    this.banner(`MUTTERSCHIFF ZERSTÖRT  +${boss.score.toLocaleString('de-DE')}`, '#ffe066');
    this.boss = null;
    this.stage++;
    this.stageTimer = 0;
    this.airTimer = 3.5;
    this.groundTimer = 2.5;
    this.scrollSpeed = Math.min(150, 92 + (this.stage - 1) * 9);
    this.powerups.push(new PowerUp(boss.x - 30, 160, 'E'));
    this.powerups.push(new PowerUp(boss.x + 30, 160, this.pickPowerType()));
    Sound.startMusic('main');
    this.vibrate([50, 80, 50, 80, 120]);
    setTimeout(() => {
      if (this.state === 'playing') this.banner(`STUFE ${this.stage}`, '#9fe8ff');
    }, 1800);
  }

  playerHit() {
    const p = this.player;
    if (!p.alive || p.invuln > 0) return;
    if (p.shield > 0) {
      p.shield--;
      p.invuln = 1.3;
      this.hitFlash = 0.35;
      Sound.sfx('hit');
      this.shake(6, 0.25);
      this.vibrate(60);
    } else {
      this.killPlayer();
    }
  }

  killPlayer() {
    const p = this.player;
    p.alive = false;
    this.deathTimer = 1.7;
    this.lives--;
    spawnExplosion(this, p.x, p.y, { count: 44, speed: 280, maxSize: 10, lifeScale: 1.4 });
    Sound.sfx('pdie');
    this.shake(12, 0.6);
    this.hitFlash = 0.55;
    this.vibrate([80, 60, 120]);
  }

  respawn() {
    const p = this.player;
    p.alive = true;
    p.x = W / 2; p.y = 640;
    p.shield = p.shieldMax;
    p.invuln = 2.6;
    p.spread = Math.max(1, p.spread - 1);   // milde Strafe statt Total-Reset
    p.tilt = 0;
  }

  /* ============================================================
     WELLEN-DIREKTOR
     ============================================================ */
  director(dt) {
    this.stageTimer += dt;

    // Boss auslösen
    if (!this.boss && this.stageTimer > 65) {
      this.boss = new Boss(this.stage);
      this.banner('WARNUNG: MUTTERSCHIFF!', '#ff5c8f');
      Sound.sfx('boss');
      Sound.startMusic('boss');
    }

    // Luftwellen
    this.airTimer -= dt;
    if (this.airTimer <= 0) {
      const bossFactor = this.boss ? 2.1 : 1;
      this.airTimer = Math.max(0.9, rand(1.7, 2.7) / (0.7 + this.diff * 0.22)) * bossFactor;
      this.spawnAirWave();
    }

    // Bodenziele (nicht während des Bosskampfs)
    if (!this.boss) {
      this.groundTimer -= dt;
      if (this.groundTimer <= 0) {
        this.groundTimer = Math.max(0.8, rand(1.3, 2.3) / (0.75 + this.diff * 0.15));
        this.spawnGround();
      }
    }
  }

  spawnAirWave() {
    const s = this.stage, d = this.diff;
    const types = ['drones', 'swoopers', 'divers'];
    if (s >= 1) types.push('gunner');
    if (s >= 2) types.push('spinner', 'gunner');
    if (s >= 3) types.push('spinner');
    const kind = pick(types);

    switch (kind) {
      case 'drones': {
        const n = 3 + Math.min(4, Math.floor(d));
        const cx = rand(90, 390);
        for (let i = 0; i < n; i++) {
          const e = new Drone(clamp(cx + (i - n / 2) * 34, 30, 450), i * 0.8);
          e.y = -24 - i * 30;
          this.airEnemies.push(e);
        }
        break;
      }
      case 'swoopers': {
        const left = Math.random() < 0.5;
        const n = 2 + Math.min(3, Math.floor(d * 0.7));
        const yb = rand(80, 260);
        for (let i = 0; i < n; i++) {
          const e = new Swooper(left, yb + i * 26, d);
          e.x += (left ? -1 : 1) * i * 46;
          this.airEnemies.push(e);
        }
        break;
      }
      case 'divers': {
        const n = 1 + Math.min(2, Math.floor(d * 0.5));
        for (let i = 0; i < n; i++) {
          this.airEnemies.push(new Diver(rand(60, 420)));
        }
        break;
      }
      case 'gunner':
        this.airEnemies.push(new Gunner(rand(70, 410), d));
        if (d > 2.4 && Math.random() < 0.5) this.airEnemies.push(new Gunner(rand(70, 410), d));
        break;
      case 'spinner':
        this.airEnemies.push(new Spinner(rand(80, 400), d));
        break;
    }
  }

  spawnGround() {
    const n = Math.random() < 0.3 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const roll = Math.random();
      const type = roll < 0.30 ? 'dome' : roll < 0.60 ? 'turret' : roll < 0.85 ? 'tank' : 'radar';
      this.groundEnemies.push(new GroundEnemy(rand(45, 435), -30 - i * 50, type, this.diff));
    }
  }

  /* ============================================================
     UPDATE
     ============================================================ */
  update(dt) {
    this.time += dt;

    if (this.state === 'title') {
      this.terrain.update(55 * dt);
      this.updateLists(dt, true);
      return;
    }
    if (this.state !== 'playing' || this.paused) return;

    const p = this.player;
    this.terrain.update(this.scrollSpeed * dt);
    this.director(dt);

    if (p.alive) {
      this.keyboardMove(dt);
      p.update(dt, this);
      this.autoBomb(dt);
    } else {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        if (this.lives > 0) this.respawn();
        else { this.gameOver(); return; }
      }
    }

    if (this.chainTimer > 0) {
      this.chainTimer -= dt;
      if (this.chainTimer <= 0) this.chain = 0;
    }

    if (this.boss) this.boss.update(dt, this);

    for (const e of this.airEnemies) e.update(dt, this);
    for (const g of this.groundEnemies) g.update(dt, this);
    for (const b of this.playerBullets) b.update(dt);
    for (const b of this.enemyBullets) b.update(dt);
    for (const b of this.bombs) b.update(dt, this);
    for (const u of this.powerups) u.update(dt, this);
    this.updateLists(dt);

    this.collisions();

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      if (this.shakeTime <= 0) this.shakeAmp = 0;
    }
    if (this.hitFlash > 0) this.hitFlash -= dt;

    // tote Objekte entsorgen
    this.airEnemies = this.airEnemies.filter(e => e.alive);
    this.groundEnemies = this.groundEnemies.filter(g => g.alive);
    this.playerBullets = this.playerBullets.filter(b => b.alive);
    this.enemyBullets = this.enemyBullets.filter(b => b.alive);
    this.bombs = this.bombs.filter(b => b.alive);
    this.powerups = this.powerups.filter(u => u.alive);
  }

  updateLists(dt) {
    this.particles = this.particles.filter(pt => pt.update(dt));
    this.floats = this.floats.filter(f => f.update(dt));
  }

  /* automatisches Bombardieren des anvisierten Bodenziels */
  autoBomb(dt) {
    const p = this.player;
    this.lockedTarget = null;
    const rx = p.x, ry = p.reticleY;
    let best = null, bestD = 52 * 52;
    for (const g of this.groundEnemies) {
      if (!g.alive || g.y < 0) continue;
      const d = dist2(g.x, g.y, rx, ry);
      if (d < bestD) { bestD = d; best = g; }
    }
    if (best) {
      if (this.lastLock !== best) Sound.sfx('lock');
      this.lockedTarget = best;
      if (p.bombTimer <= 0) {
        p.bombTimer = 0.55;
        const dur = 0.36;
        const tx = best.x + (best.type === 'tank' ? best.dir * 34 * dur : 0);
        this.bombs.push(new Bomb(p.x, p.y - 8, tx, best.y));
        Sound.sfx('bomb');
      }
    }
    this.lastLock = best;
  }

  /* ============================================================
     KOLLISIONEN
     ============================================================ */
  collisions() {
    const p = this.player;

    // Spielerschüsse
    for (const b of this.playerBullets) {
      if (!b.alive) continue;
      if (this.boss && this.boss.dying <= 0 && this.boss.hitTest(b, this)) {
        b.alive = false;
        continue;
      }
      for (const e of this.airEnemies) {
        if (!e.alive) continue;
        if (dist2(b.x, b.y, e.x, e.y) < (e.r + b.r) * (e.r + b.r)) {
          b.alive = false;
          e.hurt(1, this);
          break;
        }
      }
    }

    if (!p.alive) return;

    // Power-ups einsammeln
    for (const u of this.powerups) {
      if (u.alive && dist2(u.x, u.y, p.x, p.y) < 27 * 27) {
        u.alive = false;
        this.applyPowerUp(u.type, u.x, u.y);
      }
    }

    if (p.invuln > 0) return;

    // feindliche Projektile
    for (const b of this.enemyBullets) {
      if (b.alive && dist2(b.x, b.y, p.x, p.y) < (b.r + p.hitR) * (b.r + p.hitR)) {
        b.alive = false;
        this.playerHit();
        if (!p.alive || p.invuln > 0) break;
      }
    }
    if (!p.alive) return;

    // Rammen von Luftgegnern
    for (const e of this.airEnemies) {
      if (e.alive && dist2(e.x, e.y, p.x, p.y) < (e.r + p.hitR + 2) * (e.r + p.hitR + 2)) {
        e.hurt(3, this);
        this.playerHit();
        break;
      }
    }
    if (!p.alive) return;

    // Boss-Rumpf
    if (this.boss && this.boss.dying <= 0 && this.boss.bodyHit(p.x, p.y, p.hitR)) {
      this.playerHit();
    }
  }

  applyPowerUp(type, x, y) {
    const p = this.player;
    const def = POWERUP_DEFS[type];
    switch (type) {
      case 'S': p.spread = Math.min(3, p.spread + 1); break;
      case 'R': p.rapid = Math.min(2, p.rapid + 1); break;
      case 'E': p.shield = p.shieldMax; break;
      case 'D': p.drones = Math.min(2, p.drones + 1); break;
      case 'B': p.megaBomb = true; break;
      case 'U':
        this.lives++;
        Sound.sfx('oneup');
        this.vibrate([40, 60, 40]);
        break;
    }
    if (type !== 'U') Sound.sfx('power');
    this.addScore(500, x, y, true);
    this.floats.push(new FloatText(x, y - 18, def.name, def.color));
  }

  /* ============================================================
     RENDERING
     ============================================================ */
  frame(now) {
    const dt = Math.min(0.035, (now - this.last) / 1000 || 0.016);
    this.last = now;
    this.update(dt);
    this.draw();
    requestAnimationFrame(t => this.frame(t));
  }

  draw() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Screenshake
    if (this.shakeAmp > 0) {
      ctx.translate(
        (Math.random() - 0.5) * 2 * this.shakeAmp,
        (Math.random() - 0.5) * 2 * this.shakeAmp
      );
    }

    this.terrain.draw(ctx, this.time);

    for (const g of this.groundEnemies) g.draw(ctx);
    for (const u of this.powerups) u.draw(ctx);
    for (const b of this.playerBullets) b.draw(ctx);
    if (this.boss) this.boss.draw(ctx);
    for (const e of this.airEnemies) e.draw(ctx);
    for (const b of this.bombs) b.draw(ctx);
    for (const b of this.enemyBullets) b.draw(ctx);

    if (this.state === 'playing') {
      const p = this.player;
      if (p.alive) {
        p.drawReticle(ctx, !!this.lockedTarget);
        p.draw(ctx);
      }
    }

    // Partikel: Glow additiv, Rauch normal
    ctx.globalCompositeOperation = 'lighter';
    for (const pt of this.particles) if (pt.glow) pt.draw(ctx);
    ctx.globalCompositeOperation = 'source-over';
    for (const pt of this.particles) if (!pt.glow) pt.draw(ctx);

    this.terrain.drawClouds(ctx);

    for (const f of this.floats) f.draw(ctx);

    if (this.state === 'playing') this.drawHUD(ctx);

    // Treffer-Blitz
    if (this.hitFlash > 0) {
      ctx.fillStyle = `rgba(255,60,60,${this.hitFlash * 0.5})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Vignette für den modernen Look
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,10,0.32)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  drawHUD(ctx) {
    ctx.font = "bold 20px 'Segoe UI', sans-serif";
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillText(this.score.toLocaleString('de-DE'), 14, 30);
    ctx.fillStyle = '#dfeaff';
    ctx.fillText(this.score.toLocaleString('de-DE'), 13, 29);

    const scores = this.cachedScores || (this.cachedScores = loadJSON(LS_SCORES, []));
    const hi = Math.max(scores.length ? scores[0].score : 0, this.score);
    ctx.font = "12px 'Segoe UI', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7d8db0';
    ctx.fillText(`REKORD ${hi.toLocaleString('de-DE')}`, W / 2, 24);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#9fb4dd';
    ctx.font = "bold 13px 'Segoe UI', sans-serif";
    ctx.fillText(`STUFE ${this.stage}`, W - 60, 27);

    // Kette
    if (this.chain > 1) {
      ctx.textAlign = 'center';
      ctx.font = "bold 17px 'Segoe UI', sans-serif";
      ctx.fillStyle = this.chain >= 6 ? '#ffe066' : '#ffd9a0';
      ctx.fillText(`KETTE ×${this.chain}`, W / 2, 56);
    }

    // Schild-Segmente
    const p = this.player;
    const sx = 13, sy = H - 26;
    ctx.textAlign = 'left';
    ctx.font = "10px 'Segoe UI', sans-serif";
    ctx.fillStyle = '#7d8db0';
    ctx.fillText('SCHILD', sx, sy - 8);
    for (let i = 0; i < p.shieldMax; i++) {
      ctx.fillStyle = i < p.shield ? (p.shield === 1 ? '#ffdd57' : '#46c8ff') : 'rgba(70,90,130,0.35)';
      ctx.fillRect(sx + i * 30, sy, 26, 8);
    }

    // Leben
    for (let i = 0; i < Math.min(6, this.lives); i++) {
      const lx = W - 22 - i * 24, ly = H - 22;
      ctx.fillStyle = '#b9c8e2';
      ctx.beginPath();
      ctx.moveTo(lx, ly - 9);
      ctx.lineTo(lx + 8, ly + 7);
      ctx.lineTo(lx, ly + 3);
      ctx.lineTo(lx - 8, ly + 7);
      ctx.closePath();
      ctx.fill();
    }

    if (this.boss && !this.boss.entering) this.boss.drawHpBar(ctx);
  }
}

/* ---------- Los geht's ---------- */
window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
