/**
 * Audio 100 % procédural (Web Audio API) : aucun fichier externe, aucune licence à gérer.
 * Le contexte n'est créé/repris qu'après une interaction utilisateur (contrainte mobile).
 */
import type { Settings } from '../core/types';

export type Sfx = 'shot' | 'heavy' | 'enemyShot' | 'hit' | 'explosion' | 'bigExplosion' | 'pickup' | 'ui' | 'uiBack' | 'victory' | 'defeat' | 'damage' | 'shield' | 'warn' | 'upgrade';

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfx!: GainNode;
  private noise!: AudioBuffer;
  private settings: Settings | null = null;
  private musicTimer: number | null = null;
  private nextNote = 0;
  private step = 0;
  private musicMood: 'menu' | 'drive' | 'boss' = 'menu';
  private lastPlay: Partial<Record<Sfx, number>> = {};
  private suspendedByVisibility = false;

  /** À appeler sur la première interaction (clic / toucher / touche). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.music = this.ctx.createGain();
      this.music.connect(this.master);
      this.sfx = this.ctx.createGain();
      this.sfx.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      if (this.settings) this.apply(this.settings);
      this.startMusic();
    }
    if (this.ctx.state === 'suspended' && !this.suspendedByVisibility) void this.ctx.resume();
  }

  apply(s: Settings) {
    this.settings = s;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : 1, t, 0.05);
    this.music.gain.setTargetAtTime(s.musicVolume * 0.32, t, 0.05);
    this.sfx.gain.setTargetAtTime(s.sfxVolume * 0.55, t, 0.05);
  }

  setVisible(visible: boolean) {
    if (!this.ctx) return;
    this.suspendedByVisibility = !visible;
    if (visible) void this.ctx.resume(); else void this.ctx.suspend();
  }

  setMood(m: 'menu' | 'drive' | 'boss') {
    this.musicMood = m;
  }

  play(name: Sfx, intensity = 1) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    // limitation de polyphonie par effet
    const minGap = name === 'shot' ? 0.05 : name === 'hit' ? 0.04 : name === 'pickup' ? 0.03 : 0.015;
    if ((this.lastPlay[name] ?? -1) > now - minGap) return;
    this.lastPlay[name] = now;
    switch (name) {
      case 'shot': this.blip(now, 900, 300, 0.05, 'square', 0.12, 2400); break;
      case 'heavy': this.noiseHit(now, 0.18, 900, 0.5); this.blip(now, 160, 50, 0.16, 'sine', 0.5); break;
      case 'enemyShot': this.blip(now, 520, 180, 0.12, 'sawtooth', 0.16, 1800); break;
      case 'hit': this.noiseHit(now, 0.05, 3000, 0.18); break;
      case 'damage': this.noiseHit(now, 0.12, 700, 0.5); this.blip(now, 120, 60, 0.12, 'square', 0.25, 600); break;
      case 'explosion': this.noiseHit(now, 0.45 * intensity, 500, 0.8); this.blip(now, 90, 30, 0.4, 'sine', 0.7); break;
      case 'bigExplosion': this.noiseHit(now, 1.2, 350, 1); this.blip(now, 70, 20, 1, 'sine', 0.9); break;
      case 'pickup': this.blip(now, 880, 1320, 0.08, 'triangle', 0.25); this.blip(now + 0.05, 1320, 1760, 0.07, 'triangle', 0.18); break;
      case 'ui': this.blip(now, 660, 880, 0.06, 'triangle', 0.25); break;
      case 'uiBack': this.blip(now, 660, 440, 0.08, 'triangle', 0.22); break;
      case 'upgrade': [523, 659, 784, 1046].forEach((f, i) => this.blip(now + i * 0.07, f, f, 0.14, 'triangle', 0.25)); break;
      case 'shield': this.blip(now, 300, 1200, 0.25, 'sine', 0.35); break;
      case 'warn': this.blip(now, 440, 440, 0.12, 'square', 0.15, 1500); this.blip(now + 0.16, 440, 440, 0.12, 'square', 0.15, 1500); break;
      case 'victory': [392, 523, 659, 784, 1046].forEach((f, i) => this.blip(now + i * 0.13, f, f, 0.35, 'triangle', 0.3)); break;
      case 'defeat': [392, 330, 262, 196].forEach((f, i) => this.blip(now + i * 0.22, f, f * 0.97, 0.45, 'sawtooth', 0.18, 900)); break;
    }
  }

  private blip(t: number, f0: number, f1: number, dur: number, type: OscillatorType, vol: number, lp = 0, out: AudioNode = this.sfx) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = o;
    if (lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lp;
      o.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noiseHit(t: number, dur: number, cutoff: number, vol: number) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(cutoff, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, cutoff * 0.15), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfx);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  // ------------------------------------------------------------ musique générative
  private startMusic() {
    if (this.musicTimer !== null || !this.ctx) return;
    this.nextNote = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.schedule(), 50);
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const bpm = this.musicMood === 'boss' ? 132 : this.musicMood === 'drive' ? 112 : 84;
    const s16 = 60 / bpm / 4;
    // gamme mineure (ré mineur), progression : i – VI – III – VII
    const roots = [50, 46, 41, 48];
    while (this.nextNote < ctx.currentTime + 0.2) {
      const t = this.nextNote;
      const bar = Math.floor(this.step / 16) % 4;
      const pos = this.step % 16;
      const root = roots[bar];
      const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
      // basse
      if (pos % 4 === 0 || (this.musicMood !== 'menu' && pos % 4 === 3 && pos !== 15)) {
        this.blip(t, midi(root - 12), midi(root - 12), s16 * (pos % 4 === 0 ? 3 : 1), 'sawtooth', 0.22, 420, this.music);
      }
      // nappe (menu) / arpège (route)
      if (this.musicMood === 'menu') {
        if (pos === 0) for (const iv of [0, 3, 7]) this.blip(t, midi(root + iv), midi(root + iv), s16 * 15, 'triangle', 0.06, 1200, this.music);
        if (pos === 8 || pos === 14) this.blip(t, midi(root + 12 + (pos === 8 ? 7 : 10)), midi(root + 12 + 7), s16 * 2, 'sine', 0.05, 0, this.music);
      } else {
        const arp = [0, 7, 12, 15, 12, 7, 3, 7];
        if (pos % 2 === 0) this.blip(t, midi(root + 12 + arp[(pos / 2) % 8]), midi(root + 12 + arp[(pos / 2) % 8]), s16 * 1.5, 'square', 0.045, 1600, this.music);
        // percussions
        if (pos % 8 === 0) this.kick(t);
        if (pos % 8 === 4) this.snare(t);
        if (this.musicMood === 'boss' && pos % 2 === 1) this.hat(t);
        else if (pos % 4 === 2) this.hat(t);
      }
      this.step++;
      this.nextNote += s16;
    }
  }

  private kick(t: number) {
    this.blip(t, 140, 40, 0.18, 'sine', 0.55, 0, this.music);
  }
  private snare(t: number) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    s.connect(f); f.connect(g); g.connect(this.music); s.start(t, Math.random() * 0.5); s.stop(t + 0.16);
  }
  private hat(t: number) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    s.connect(f); f.connect(g); g.connect(this.music); s.start(t, Math.random() * 0.5); s.stop(t + 0.05);
  }
}

export const audio = new AudioEngine();
