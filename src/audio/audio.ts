/**
 * Audio 100 % procédural (Web Audio API) : aucun fichier externe, aucune licence à gérer.
 * Le contexte n'est créé/repris qu'après une interaction utilisateur (contrainte mobile).
 */
import type { Settings } from '../core/types';

export type Sfx = 'shot' | 'heavy' | 'enemyShot' | 'hit' | 'explosion' | 'bigExplosion' | 'pickup' | 'ui' | 'uiBack' | 'victory' | 'defeat' | 'damage' | 'shield' | 'warn' | 'upgrade';

export type AudioBiome = 'desert' | 'industrial' | 'night';
type Mood = 'menu' | 'drive' | 'boss';

/** Nappe/ronronnement longue durée : gain rampé, sources stoppées + déconnectées à la libération. */
interface Bed {
  gain: GainNode;
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
  killTimer: number | null;
}

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
  private musicMood: Mood = 'menu';
  private biome: AudioBiome = 'desert';
  private engineBed: Bed | null = null;
  private padBed: Bed | null = null;
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
      this.updateBeds();
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

  setMood(m: Mood) {
    this.musicMood = m;
    this.updateBeds();
  }

  /**
   * Biome de la musique de conduite (désert / industriel / nuit). Mémorisé si le contexte n'existe pas
   * encore (avant unlock). Le changement s'applique à la prochaine note (enveloppes individuelles) et
   * la nappe grave de nuit entre/sort par rampe de gain : pas de clic.
   * À APPELER depuis src/ui/app.ts : dans le lancement d'un segment (là où audio.setMood('drive') est appelé,
   * ~l.568, avec node.biome) et au démarrage du démo de menu (~l.436, cur.biome, optionnel).
   */
  setBiome(b: AudioBiome) {
    if (this.biome === b) return;
    this.biome = b;
    this.updateBeds();
  }

  /** Libère tout (timer, nappes, contexte). Non utilisé par l'UI actuelle ; utile pour les tests/HMR. */
  dispose() {
    if (this.musicTimer !== null) { window.clearInterval(this.musicTimer); this.musicTimer = null; }
    this.releaseBed(this.engineBed); this.engineBed = null;
    this.releaseBed(this.padBed); this.padBed = null;
    if (this.ctx) { void this.ctx.close().catch(() => undefined); this.ctx = null; }
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

  // ------------------------------------------------------------ nappes longues (moteur, nappe de nuit)
  private updateBeds() {
    if (!this.ctx) return;
    const driving = this.musicMood !== 'menu';
    this.engineBed = this.setBedLevel(this.engineBed, driving ? (this.biome === 'night' ? 0.10 : 0.14) : 0, () => this.buildEngine());
    this.padBed = this.setBedLevel(this.padBed, driving && this.biome === 'night' ? 0.5 : 0, () => this.buildPad());
  }

  private setBedLevel(bed: Bed | null, level: number, build: () => Bed): Bed | null {
    const ctx = this.ctx;
    if (!ctx) return bed;
    const t = ctx.currentTime;
    if (level > 0) {
      if (!bed) bed = build();
      if (bed.killTimer !== null) { window.clearTimeout(bed.killTimer); bed.killTimer = null; }
      bed.gain.gain.setTargetAtTime(level, t, 0.7);
      return bed;
    }
    if (bed && bed.killTimer === null) {
      bed.gain.gain.setTargetAtTime(0, t, 0.35);
      const b = bed;
      b.killTimer = window.setTimeout(() => {
        b.killTimer = null;
        this.releaseBed(b);
        if (this.engineBed === b) this.engineBed = null;
        if (this.padBed === b) this.padBed = null;
      }, 2500);
    }
    return bed;
  }

  private releaseBed(bed: Bed | null) {
    if (!bed) return;
    if (bed.killTimer !== null) { window.clearTimeout(bed.killTimer); bed.killTimer = null; }
    for (const s of bed.sources) { try { s.stop(); } catch { /* déjà arrêté */ } }
    for (const n of bed.nodes) { try { n.disconnect(); } catch { /* déjà déconnecté */ } }
    try { bed.gain.disconnect(); } catch { /* idem */ }
  }

  /** Ronronnement du convoi : deux oscillateurs graves filtrés (+ léger tremblement) et du bruit très grave. */
  private buildEngine(): Bed {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.sfx);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160; lp.Q.value = 1.5;
    lp.connect(gain);
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 46;
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 69.5;
    const g1 = ctx.createGain(); g1.gain.value = 0.55;
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    o1.connect(g1); o2.connect(g2); g1.connect(lp); g2.connect(lp);
    // cycle de combustion : LFO lent sur la hauteur
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 7;
    const lfoG = ctx.createGain(); lfoG.gain.value = 2.5;
    lfo.connect(lfoG); lfoG.connect(o1.frequency); lfoG.connect(o2.frequency);
    const ns = ctx.createBufferSource(); ns.buffer = this.noise; ns.loop = true;
    const nlp = ctx.createBiquadFilter(); nlp.type = 'lowpass'; nlp.frequency.value = 220;
    const ng = ctx.createGain(); ng.gain.value = 0.25;
    ns.connect(nlp); nlp.connect(ng); ng.connect(gain);
    const sources = [o1, o2, lfo, ns];
    sources.forEach((s) => s.start());
    return { gain, sources, nodes: [lp, g1, g2, lfoG, nlp, ng], killTimer: null };
  }

  /** Nappe grave de nuit (ré + quinte), très lente, sur le bus musique. */
  private buildPad(): Bed {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.music);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
    lp.connect(gain);
    const sources: AudioScheduledSourceNode[] = [];
    const nodes: AudioNode[] = [lp];
    for (const [f, d] of [[36.7, -6], [36.7, 7], [55, 0]] as const) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d;
      const g = ctx.createGain(); g.gain.value = f > 50 ? 0.12 : 0.22;
      o.connect(g); g.connect(lp);
      o.start(); sources.push(o); nodes.push(g);
    }
    // respiration lente du filtre
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain(); lfoG.gain.value = 90;
    lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
    sources.push(lfo); nodes.push(lfoG);
    return { gain, sources, nodes, killTimer: null };
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
    const biome = this.biome;
    const mood = this.musicMood;
    const base = mood === 'boss' ? 132 : mood === 'drive' ? 112 : 84;
    const bpm = mood === 'menu' ? base : biome === 'night' ? base * 0.82 : biome === 'industrial' ? base + 6 : base;
    const s16 = 60 / bpm / 4;
    // après une suspension / un onglet en arrière-plan : on repart du présent (pas de rafale de notes)
    if (this.nextNote < ctx.currentTime - 0.5) this.nextNote = ctx.currentTime + 0.05;
    // gamme mineure (ré mineur), progression : i – VI – III – VII
    const roots = [50, 46, 41, 48];
    const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
    let guard = 0;
    while (this.nextNote < ctx.currentTime + 0.2 && guard++ < 32) {
      const t = this.nextNote;
      const bar = Math.floor(this.step / 16) % 4;
      const pos = this.step % 16;
      const root = roots[bar];
      if (mood === 'menu') {
        if (pos % 4 === 0) this.blip(t, midi(root - 12), midi(root - 12), s16 * 3, 'sawtooth', 0.22, 420, this.music);
        if (pos === 0) for (const iv of [0, 3, 7]) this.blip(t, midi(root + iv), midi(root + iv), s16 * 15, 'triangle', 0.06, 1200, this.music);
        if (pos === 8 || pos === 14) this.blip(t, midi(root + 12 + (pos === 8 ? 7 : 10)), midi(root + 12 + 7), s16 * 2, 'sine', 0.05, 0, this.music);
      } else if (biome === 'industrial') this.industrialStep(t, pos, root, s16, mood === 'boss', midi);
      else if (biome === 'night') this.nightStep(t, pos, root, s16, mood === 'boss', midi);
      else this.desertStep(t, pos, root, s16, mood === 'boss', midi);
      this.step++;
      this.nextNote += s16;
    }
  }

  /** Désert : arpège ample (quinte, neuvième, octave), basse aérée, kick/snare classiques. */
  private desertStep(t: number, pos: number, root: number, s16: number, boss: boolean, midi: (n: number) => number) {
    if (pos % 4 === 0 || (pos % 4 === 3 && pos !== 15)) this.blip(t, midi(root - 12), midi(root - 12), s16 * (pos % 4 === 0 ? 3 : 1), 'sawtooth', 0.22, 420, this.music);
    const arp = [0, 7, 14, 19, 14, 12, 7, 5];
    if (pos % 2 === 0) { const n = root + 12 + arp[(pos / 2) % 8]; this.blip(t, midi(n), midi(n), s16 * 2.2, 'triangle', 0.075, 2200, this.music); }
    if (pos === 6 || pos === 14) this.blip(t, midi(root + 24 + (pos === 6 ? 7 : 3)), midi(root + 24), s16 * 3, 'sine', 0.035, 0, this.music);
    if (pos % 8 === 0) this.kick(t);
    if (pos % 8 === 4) this.snare(t);
    if (boss && pos % 2 === 1) this.hat(t); else if (pos % 4 === 2) this.hat(t);
  }

  /** Industriel : rythme mécanique 4/4 régulier, basse hachée, percussions métalliques. */
  private industrialStep(t: number, pos: number, root: number, s16: number, boss: boolean, midi: (n: number) => number) {
    if (pos % 2 === 0) this.blip(t, midi(root - 12), midi(root - 12), s16 * 0.9, 'square', 0.17, 380, this.music);
    const seq = [0, 0, 12, 0, 7, 0, 10, 12];
    if (pos % 2 === 1 || boss) { const n = root + seq[pos % 8]; this.blip(t, midi(n), midi(n), s16 * 0.6, 'square', 0.04, 1100, this.music); }
    if (pos % 4 === 0) this.kick(t, 0.6);
    if (pos % 8 === 4) this.snare(t);
    if (pos % 4 === 2) this.clang(t, 520 + (root % 3) * 90, 0.07);
    if (pos === 7 || pos === 15 || (boss && pos % 4 === 3)) this.clang(t, 1180, 0.05);
    if (boss && pos % 2 === 1) this.hat(t);
  }

  /** Nuit : plus lent, sparse, sombre (sinus + nappe grave), un seul coup de grosse caisse par mesure. */
  private nightStep(t: number, pos: number, root: number, s16: number, boss: boolean, midi: (n: number) => number) {
    if (pos === 0 || (boss && pos === 8)) this.blip(t, midi(root - 12), midi(root - 12), s16 * 7, 'sawtooth', 0.2, 260, this.music);
    const arp = [0, 3, 7, 10, 7, 3];
    if (pos % 4 === 2 && (pos === 2 || Math.random() < 0.55)) { const n = root + 12 + arp[Math.floor(this.step / 4) % 6]; this.blip(t, midi(n), midi(n), s16 * 4, 'sine', 0.06, 900, this.music); }
    if (pos === 0) this.kick(t, boss ? 0.5 : 0.35);
    if (boss && pos === 8) this.snare(t);
    if (pos === 10 || (boss && pos % 4 === 2)) this.hat(t);
  }

  /** Coup métallique : deux carrés inharmoniques très brefs + un peu de bruit passe-bande. */
  private clang(t: number, f: number, vol: number) {
    this.blip(t, f, f * 0.98, 0.09, 'square', vol, 4000, this.music);
    this.blip(t, f * 1.504, f * 1.5, 0.07, 'square', vol * 0.7, 5000, this.music);
    const ctx = this.ctx!;
    const s = ctx.createBufferSource(); s.buffer = this.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 4; bp.Q.value = 6;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol * 1.4, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    s.connect(bp); bp.connect(g); g.connect(this.music); s.start(t, Math.random() * 0.5); s.stop(t + 0.09);
  }

  private kick(t: number, vol = 0.55) {
    this.blip(t, 140, 40, 0.18, 'sine', vol, 0, this.music);
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
