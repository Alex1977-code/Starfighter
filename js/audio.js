/* ============================================================
   STARFIGHTER — SoundEngine
   Alles wird zur Laufzeit per WebAudio synthetisiert.
   Zwei Klangwelten, jederzeit umschaltbar:
     'modern' — fette Synths, Sub-Bass, Delay, weiche Drums
     'retro'  — 8-Bit-Chiptune: Rechteck/Dreieck, LoFi-Noise
   ============================================================ */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.mode = 'modern';        // 'modern' | 'retro'
    this.musicOn = true;
    this.sfxOn = true;

    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.delay = null;

    this.noiseBuf = null;        // weißes Rauschen
    this.crushBuf = null;        // LoFi-Rauschen (Sample & Hold, NES-Stil)

    // Sequencer-Zustand
    this.song = null;            // 'main' | 'boss' | null
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
  }

  /* ---------- Setup (erst nach User-Geste möglich) ---------- */

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = this.ctx = new AC();

      this.master = ctx.createGain();
      this.master.gain.value = 0.6;
      this.master.connect(ctx.destination);

      this.musicGain = ctx.createGain();
      this.musicGain.gain.value = 0.5;
      this.musicGain.connect(this.master);

      this.sfxGain = ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.master);

      // Stereo-Delay für den Modern-Modus (Raumgefühl)
      this.delay = ctx.createDelay(0.5);
      this.delay.delayTime.value = 0.22;
      const fb = ctx.createGain();
      fb.gain.value = 0.28;
      const wet = ctx.createGain();
      wet.gain.value = 0.22;
      this.delay.connect(fb);
      fb.connect(this.delay);
      this.delay.connect(wet);
      wet.connect(this.master);

      // Rausch-Puffer vorberechnen
      const sr = ctx.sampleRate;
      this.noiseBuf = ctx.createBuffer(1, sr, sr);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < sr; i++) d[i] = Math.random() * 2 - 1;

      this.crushBuf = ctx.createBuffer(1, sr, sr);
      const c = this.crushBuf.getChannelData(0);
      let hold = 0;
      for (let i = 0; i < sr; i++) {
        if (i % 6 === 0) hold = (Math.random() * 2 - 1) > 0 ? 0.8 : -0.8; // ~7 kHz, 1-Bit-Charakter
        c[i] = hold;
      }
      return true;
    } catch (e) {
      this.ctx = null;
      return false;
    }
  }

  setMode(m) { this.mode = m; }
  setMusicOn(on) {
    this.musicOn = on;
    if (!on) this.stopMusic();
  }
  setSfxOn(on) { this.sfxOn = on; }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  /* ---------- kleine Synth-Helfer ---------- */

  _env(t0, peak, attack, decay) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    return g;
  }

  _osc(type, f0, t0, dur, sweepTo) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (sweepTo !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), t0 + dur);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
    return o;
  }

  _noise(t0, dur, retro) {
    const s = this.ctx.createBufferSource();
    s.buffer = retro ? this.crushBuf : this.noiseBuf;
    s.loop = true;
    s.start(t0);
    s.stop(t0 + dur + 0.05);
    return s;
  }

  /* ============================================================
     SOUNDEFFEKTE
     ============================================================ */

  sfx(name, opts = {}) {
    if (!this.sfxOn || !this.ctx || this.ctx.state !== 'running') return;
    try { this['_sfx_' + name](this.now, opts); } catch (e) { /* nie das Spiel crashen */ }
  }

  _out(gainNode, alsoDelay = 0) {
    gainNode.connect(this.sfxGain);
    if (alsoDelay > 0 && this.mode === 'modern') {
      const send = this.ctx.createGain();
      send.gain.value = alsoDelay;
      gainNode.connect(send);
      send.connect(this.delay);
    }
  }

  _sfx_shot(t) {
    if (this.mode === 'retro') {
      const g = this._env(t, 0.10, 0.002, 0.06);
      this._osc('square', 980, t, 0.07, 240).connect(g);
      this._out(g);
    } else {
      const g = this._env(t, 0.09, 0.002, 0.08);
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(2600, t);
      f.frequency.exponentialRampToValueAtTime(500, t + 0.08);
      this._osc('sawtooth', 1300, t, 0.09, 260).connect(f);
      f.connect(g);
      this._out(g);
    }
  }

  _sfx_laser(t) {
    if (this.mode === 'retro') {
      const g = this._env(t, 0.09, 0.002, 0.07);
      this._osc('square', 1800, t, 0.08, 300).connect(g);
      this._out(g);
    } else {
      const g = this._env(t, 0.08, 0.002, 0.09);
      const f = this.ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.setValueAtTime(400, t);
      this._osc('sawtooth', 2200, t, 0.1, 500).connect(f);
      f.connect(g);
      this._out(g, 0.2);
      const g2 = this._env(t, 0.05, 0.002, 0.06);
      this._osc('sine', 1100, t, 0.07, 350).connect(g2);
      this._out(g2);
    }
  }

  _sfx_missile(t) {
    const retro = this.mode === 'retro';
    const g = this._env(t, 0.07, 0.01, 0.22);
    if (retro) {
      this._noise(t, 0.24, true).connect(g);
    } else {
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(600, t);
      f.frequency.exponentialRampToValueAtTime(2400, t + 0.22);
      f.Q.value = 3;
      this._noise(t, 0.24, false).connect(f);
      f.connect(g);
    }
    this._out(g, 0.2);
  }

  _sfx_bomb(t) {
    // fallende Bombe: Pfeifton abwärts
    const retro = this.mode === 'retro';
    const g = this._env(t, retro ? 0.10 : 0.09, 0.01, 0.30);
    this._osc(retro ? 'square' : 'triangle', 1100, t, 0.32, 180).connect(g);
    this._out(g, 0.3);
  }

  _sfx_expl(t, o) {
    const big = o.big ? 1.6 : 1;
    if (this.mode === 'retro') {
      const g = this._env(t, 0.22 * big, 0.004, 0.30 * big);
      this._noise(t, 0.35 * big, true).connect(g);
      this._out(g);
      const g2 = this._env(t, 0.16 * big, 0.004, 0.2 * big);
      this._osc('square', 220, t, 0.2 * big, 40).connect(g2);
      this._out(g2);
    } else {
      const g = this._env(t, 0.24 * big, 0.004, 0.4 * big);
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(3200, t);
      f.frequency.exponentialRampToValueAtTime(160, t + 0.4 * big);
      this._noise(t, 0.45 * big, false).connect(f);
      f.connect(g);
      this._out(g, 0.25);
      const g2 = this._env(t, 0.30 * big, 0.004, 0.28 * big);   // Sub-Wumms
      this._osc('sine', 130, t, 0.3 * big, 36).connect(g2);
      this._out(g2);
    }
  }

  _sfx_gexpl(t) { this._sfx_expl(t, { big: true }); }

  _sfx_hit(t) {
    if (this.mode === 'retro') {
      const g = this._env(t, 0.18, 0.002, 0.12);
      this._osc('square', 300, t, 0.12, 80).connect(g);
      this._out(g);
    } else {
      const g = this._env(t, 0.2, 0.002, 0.15);
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 700;
      f.Q.value = 2;
      this._noise(t, 0.15, false).connect(f);
      f.connect(g);
      this._out(g);
      const g2 = this._env(t, 0.16, 0.002, 0.12);
      this._osc('sine', 240, t, 0.12, 70).connect(g2);
      this._out(g2);
    }
  }

  _sfx_pdie(t) {
    this._sfx_expl(t, { big: true });
    const retro = this.mode === 'retro';
    const g = this._env(t + 0.05, 0.2, 0.01, 0.9);
    this._osc(retro ? 'square' : 'sawtooth', 600, t + 0.05, 0.9, 50).connect(g);
    this._out(g, 0.3);
  }

  _sfx_power(t) {
    const retro = this.mode === 'retro';
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      const tt = t + i * 0.055;
      const g = this._env(tt, 0.12, 0.004, 0.12);
      this._osc(retro ? 'square' : 'triangle', f, tt, 0.13).connect(g);
      this._out(g, 0.35);
    });
  }

  _sfx_oneup(t) {
    const retro = this.mode === 'retro';
    const seq = [659, 784, 1319, 1047, 1568];
    seq.forEach((f, i) => {
      const tt = t + i * 0.09;
      const g = this._env(tt, 0.14, 0.004, 0.16);
      this._osc(retro ? 'square' : 'triangle', f, tt, 0.17).connect(g);
      this._out(g, 0.4);
    });
  }

  _sfx_chain(t, o) {
    const lvl = Math.min(8, o.level || 1);
    const f = 440 * Math.pow(1.122, lvl);          // steigt mit der Kette
    const retro = this.mode === 'retro';
    const g = this._env(t, 0.1, 0.003, 0.1);
    this._osc(retro ? 'square' : 'sine', f, t, 0.1, f * 1.5).connect(g);
    this._out(g, 0.3);
  }

  _sfx_lock(t) {
    const g = this._env(t, 0.05, 0.002, 0.04);
    this._osc(this.mode === 'retro' ? 'square' : 'sine', 1500, t, 0.04).connect(g);
    this._out(g);
  }

  _sfx_ui(t) {
    const g = this._env(t, 0.08, 0.002, 0.06);
    this._osc(this.mode === 'retro' ? 'square' : 'triangle', 700, t, 0.06, 900).connect(g);
    this._out(g);
  }

  _sfx_boss(t) {
    const retro = this.mode === 'retro';
    for (let i = 0; i < 3; i++) {
      const tt = t + i * 0.28;
      const g = this._env(tt, 0.16, 0.01, 0.22);
      this._osc(retro ? 'square' : 'sawtooth', i % 2 ? 466 : 622, tt, 0.24).connect(g);
      this._out(g, 0.3);
    }
  }

  /* ============================================================
     MUSIK — kompakter Step-Sequencer (16tel-Raster)
     Gleiche Noten-Daten, unterschiedliche Instrumente je Modus.
     ============================================================ */

  startMusic(song) {
    if (!this.musicOn || !this.ctx) return;
    if (this.song === song && this.timer) return;
    this.stopMusic();
    this.song = song;
    this.step = 0;
    this.nextTime = this.now + 0.08;
    this.timer = setInterval(() => this._schedule(), 30);
  }

  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.song = null;
  }

  _schedule() {
    if (!this.ctx || !this.song) return;
    const data = SoundEngine.SONGS[this.song];
    const stepDur = 60 / data.bpm / 4;
    while (this.nextTime < this.now + 0.18) {
      this._playStep(this.song, this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  _playStep(song, step, t, stepDur) {
    const d = SoundEngine.SONGS[song];
    const s16 = step % 16;
    const bassNote = d.bass[step % d.bass.length];
    const leadNote = d.lead[step % d.lead.length];

    if (d.kick[s16]) this._drumKick(t);
    if (d.snare[s16]) this._drumSnare(t);
    if (d.hat[s16]) this._drumHat(t);
    if (bassNote) this._instBass(t, this._mtof(bassNote), stepDur * 0.95);
    if (leadNote) this._instLead(t, this._mtof(leadNote), stepDur * 1.8);
  }

  _mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  _mout(gainNode, delaySend = 0) {
    gainNode.connect(this.musicGain);
    if (delaySend > 0 && this.mode === 'modern') {
      const send = this.ctx.createGain();
      send.gain.value = delaySend;
      gainNode.connect(send);
      send.connect(this.delay);
    }
  }

  _instBass(t, f, dur) {
    if (this.mode === 'retro') {
      const g = this._env(t, 0.20, 0.004, dur);
      this._osc('triangle', f, t, dur).connect(g);
      this._mout(g);
    } else {
      const g = this._env(t, 0.17, 0.004, dur);
      const flt = this.ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(900, t);
      flt.frequency.exponentialRampToValueAtTime(220, t + dur);
      this._osc('sawtooth', f, t, dur).connect(flt);
      flt.connect(g);
      this._mout(g);
      const g2 = this._env(t, 0.14, 0.004, dur);
      this._osc('sine', f / 2, t, dur).connect(g2);   // Sub-Oktave
      this._mout(g2);
    }
  }

  _instLead(t, f, dur) {
    if (this.mode === 'retro') {
      const g = this._env(t, 0.10, 0.006, dur);
      const o = this._osc('square', f, t, dur);
      // leichtes Chip-Vibrato
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 6;
      const lg = this.ctx.createGain();
      lg.gain.value = f * 0.006;
      lfo.connect(lg);
      lg.connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
      o.connect(g);
      this._mout(g);
    } else {
      const g = this._env(t, 0.085, 0.008, dur);
      const flt = this.ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(3600, t);
      flt.frequency.exponentialRampToValueAtTime(700, t + dur);
      const o1 = this._osc('sawtooth', f, t, dur);
      const o2 = this._osc('sawtooth', f * 1.007, t, dur);   // Detune = Breite
      o1.connect(flt);
      o2.connect(flt);
      flt.connect(g);
      this._mout(g, 0.3);
    }
  }

  _drumKick(t) {
    const retro = this.mode === 'retro';
    const g = this._env(t, retro ? 0.24 : 0.3, 0.002, 0.14);
    this._osc(retro ? 'square' : 'sine', 150, t, 0.14, 40).connect(g);
    this._mout(g);
  }

  _drumSnare(t) {
    const retro = this.mode === 'retro';
    const g = this._env(t, 0.14, 0.002, 0.12);
    if (retro) {
      this._noise(t, 0.12, true).connect(g);
    } else {
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1800;
      this._noise(t, 0.12, false).connect(f);
      f.connect(g);
    }
    this._mout(g);
  }

  _drumHat(t) {
    const retro = this.mode === 'retro';
    const g = this._env(t, 0.05, 0.001, 0.035);
    if (retro) {
      this._noise(t, 0.04, true).connect(g);
    } else {
      const f = this.ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 7000;
      this._noise(t, 0.04, false).connect(f);
      f.connect(g);
    }
    this._mout(g);
  }
}

/* ---------- Songdaten (MIDI-Noten, 0 = Pause) ----------
   'main': treibendes A-Moll-Thema, 4 Takte Lead-Loop
   'boss': schneller, düsterer, halbtonlastig               */
SoundEngine.SONGS = {
  main: {
    bpm: 132,
    kick:  [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
    hat:   [1,0,1,0, 1,0,1,1, 1,0,1,0, 1,0,1,0],
    bass: [
      45,0,45,0, 45,0,45,45, 41,0,41,0, 41,0,41,41,
      43,0,43,0, 43,0,43,43, 40,0,40,0, 40,0,43,44,
    ],
    lead: [
      69,0,72,74, 76,0,74,72, 69,0,67,0, 69,0,0,0,
      65,0,69,72, 77,0,76,72, 74,0,72,0, 74,0,76,0,
      79,0,76,74, 76,0,74,72, 69,0,72,0, 76,0,74,0,
      72,0,69,0, 67,0,64,67, 69,0,0,0,  0,0,0,0,
    ],
  },
  boss: {
    bpm: 152,
    kick:  [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,1,0],
    hat:   [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
    bass: [
      38,0,38,38, 38,0,38,0, 39,0,39,39, 39,0,39,0,
      38,0,38,38, 38,0,38,0, 41,0,41,41, 43,0,43,0,
    ],
    lead: [
      62,0,0,63, 62,0,58,0, 63,0,0,65, 63,0,62,0,
      62,0,0,63, 66,0,65,0, 63,0,62,0, 58,0,0,0,
    ],
  },
};

/* globale Instanz */
const Sound = new SoundEngine();
