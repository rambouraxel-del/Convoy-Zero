/**
 * Rendu Phaser d'un segment de convoi. La logique vit dans DriveSim ; cette scène
 * ne fait que dessiner l'état et jouer les effets (VFX/SFX).
 */
import Phaser from 'phaser';
import { audio } from '../audio/audio';
import { ROAD, VIEW } from '../config/balance';
import { Rng } from '../core/rng';
import type { Biome, EnemyType, VehicleId } from '../core/types';
import type { InputManager } from '../input/input';
import { buildTextures, DECOR } from '../render/textures';
import { DriveSim, type SimConfig, type SimEvent } from '../game/sim/sim';

export interface DriveCallbacks {
  onEnd: (sim: DriveSim) => void;
  onFrame: (sim: DriveSim) => void;
  onEvent?: (e: SimEvent) => void;
}

interface VehicleView { body: Phaser.GameObjects.Image; turret: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; smokeT: number; dustT: number }

const COLORS = { scrap: '#d8dde3', fuel: '#ff8a6a', food: '#a6d86a' };
const DARK_SCALE = 2;
const ENEMY_SCALE: Record<EnemyType, number> = { marauder: 1, gunner: 1, scout: 1, brute: 1, kamikaze: 1, boss: 1 };

export class DriveScene extends Phaser.Scene {
  sim: DriveSim | null = null;
  input2!: InputManager;
  paused = false;
  timeScale = 1;
  shakeEnabled = true;
  private cb: DriveCallbacks | null = null;
  private ground!: Phaser.GameObjects.TileSprite;
  private biome: Biome = 'desert';
  private vehicles = new Map<VehicleId, VehicleView>();
  private enemyViews = new Map<number, Phaser.GameObjects.Image>();
  private bulletViews = new Map<number, Phaser.GameObjects.Image>();
  private pickupViews = new Map<number, Phaser.GameObjects.Image>();
  private obstacleViews = new Map<number, Phaser.GameObjects.Image>();
  private decor: Phaser.GameObjects.Image[] = [];
  private pool: Phaser.GameObjects.Image[] = [];
  private decorTimer = 0;
  private overlay!: Phaser.GameObjects.Graphics;
  private dark!: Phaser.GameObjects.RenderTexture;
  private lightImg!: Phaser.GameObjects.Image;
  private headImg!: Phaser.GameObjects.Image;
  private flashes: { x: number; y: number; r: number; t: number }[] = [];
  private fire!: Phaser.GameObjects.Particles.ParticleEmitter;
  private smoke!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private debris!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sand!: Phaser.GameObjects.Particles.ParticleEmitter;
  private texts: Phaser.GameObjects.Text[] = [];
  private ended = false;
  private rng = new Rng(7);
  private ready = false;
  private pending: { cfg: SimConfig; cb: DriveCallbacks | null } | null = null;

  constructor() {
    super('drive');
  }

  create() {
    buildTextures(this);
    this.ground = this.add.tileSprite(0, 0, VIEW.w, VIEW.h, 'ground_desert').setOrigin(0).setDepth(0);
    this.overlay = this.add.graphics().setDepth(10);
    // calque d'obscurité à demi-résolution, étiré ×2 (les halos sont flous : aucune perte visible)
    this.dark = this.add.renderTexture(0, 0, Math.ceil(VIEW.w / DARK_SCALE), Math.ceil(VIEW.h / DARK_SCALE)).setOrigin(0).setScale(DARK_SCALE).setDepth(9).setVisible(false);
    this.lightImg = this.make.image({ key: 'light', add: false });
    this.headImg = this.make.image({ key: 'headlight', add: false }).setOrigin(0, 0.5);

    this.smoke = this.add.particles(0, 0, 'dot', {
      lifespan: { min: 700, max: 1300 }, speedX: { min: -120, max: -60 }, speedY: { min: -30, max: 30 },
      scale: { start: 0.5, end: 1.8 }, alpha: { start: 0.45, end: 0 }, tint: 0x3a3534, emitting: false,
    }).setDepth(8);
    this.fire = this.add.particles(0, 0, 'dot', {
      lifespan: { min: 250, max: 600 }, speed: { min: 40, max: 260 }, scale: { start: 1.3, end: 0 },
      alpha: { start: 1, end: 0 }, tint: [0xffe08a, 0xff9a3a, 0xff5a2a], blendMode: 'ADD', emitting: false,
    }).setDepth(8);
    this.sparks = this.add.particles(0, 0, 'dot', {
      lifespan: { min: 120, max: 260 }, speed: { min: 80, max: 320 }, scale: { start: 0.35, end: 0 },
      tint: [0xfff2b0, 0x9ff0ea], blendMode: 'ADD', emitting: false,
    }).setDepth(8);
    this.dust = this.add.particles(0, 0, 'dot', {
      lifespan: { min: 500, max: 900 }, speedX: { min: -260, max: -160 }, speedY: { min: -25, max: 25 },
      scale: { start: 0.5, end: 1.4 }, alpha: { start: 0.35, end: 0 }, tint: 0xd9c49a, emitting: false,
    }).setDepth(4);
    this.debris = this.add.particles(0, 0, 'debris', {
      lifespan: { min: 500, max: 900 }, speed: { min: 120, max: 380 }, rotate: { min: 0, max: 360 },
      scale: { start: 1.2, end: 0.6 }, gravityY: 0, emitting: false,
    }).setDepth(7);
    this.sand = this.add.particles(0, 0, 'dot', {
      x: { min: VIEW.w, max: VIEW.w + 40 }, y: { min: 0, max: VIEW.h }, lifespan: 1600, speedX: { min: -900, max: -600 },
      speedY: { min: -40, max: 40 }, scale: { start: 0.25, end: 0.1 }, alpha: { start: 0.5, end: 0 }, tint: 0xe8cc94,
      frequency: 12, emitting: false,
    }).setDepth(8);

    const make = (id: VehicleId): VehicleView => ({
      shadow: this.add.image(0, 0, 'shadow').setDepth(4).setAlpha(0.28).setTint(0x000000),
      body: this.add.image(0, 0, `v_${id}`).setDepth(6),
      turret: this.add.image(0, 0, `t_${id}`).setDepth(6.5).setOrigin(id === 'command' ? 0.19 : 0.18, 0.5),
      smokeT: 0, dustT: 0,
    });
    for (const id of ['command', 'escort', 'salvager'] as VehicleId[]) this.vehicles.set(id, make(id));

    this.scale.on('resize', () => this.cameras.main.setViewport(0, 0, VIEW.w, VIEW.h));
    this.ready = true;
    if (this.pending) {
      this.startSegment(this.pending.cfg, this.pending.cb);
      this.pending = null;
    } else {
      this.startDemo();
    }
  }

  startDemo(biome: Biome = 'desert') {
    if (this.sim?.cfg.kind === 'demo' && this.biome === biome && this.cb === null) return;
    this.startSegment({ kind: 'demo', biome, depth: 0, risk: 1, seed: 12345 }, null);
  }

  startSegment(cfg: SimConfig, cb: DriveCallbacks | null) {
    if (!this.ready) { this.pending = { cfg, cb }; return; }
    this.clearWorld();
    this.sim = new DriveSim(cfg);
    this.cb = cb;
    this.ended = false;
    this.paused = false;
    this.biome = cfg.biome;
    this.ground.setTexture(`ground_${cfg.biome}`);
    this.dark.setVisible(cfg.biome === 'night');
    this.rng = new Rng(cfg.seed ^ 0x5eed);
    // décor initial
    for (let x = 0; x < VIEW.w + 200; x += 140) this.spawnDecor(x + this.rng.range(-40, 40));
  }

  private clearWorld() {
    for (const m of [this.enemyViews, this.bulletViews, this.pickupViews, this.obstacleViews]) {
      for (const s of m.values()) this.release(s);
      m.clear();
    }
    for (const d of this.decor) this.release(d);
    this.decor = [];
    for (const t of this.texts) t.destroy();
    this.texts = [];
    this.flashes = [];
    this.overlay.clear();
    this.cameras.main.resetFX();
  }

  update(_t: number, deltaMs: number) {
    const sim = this.sim;
    if (!sim) return;
    const dt = Math.min(0.05, deltaMs / 1000);
    if (!this.paused && !this.ended) {
      const input = this.cb ? this.input2.read() : { manual: false, dx: 0, dy: 0 };
      sim.update(dt * this.timeScale, input);
      if (sim.cfg.kind === 'demo') for (const v of sim.vehicles) { v.alive = true; v.hp = Math.max(v.hp, v.maxHp * 0.6); }
      for (const e of sim.drainEvents()) this.handleEvent(e);
      const sd = dt * this.timeScale;
      this.ground.tilePositionX += sim.scroll * sd;
      this.updateDecor(sd, sim.scroll);
      this.flashes = this.flashes.filter((f) => (f.t -= dt) > 0);
      for (const t of this.texts) { t.y -= 40 * dt; t.alpha -= dt * 1.2; }
      this.texts = this.texts.filter((t) => { if (t.alpha <= 0) { t.destroy(); return false; } return true; });
      if (sim.done) {
        this.ended = true;
        this.cb?.onEnd(sim);
      }
    }
    this.sync(sim, dt);
    this.cb?.onFrame(sim);
  }

  // -------------------------------------------------------------- pool d'images
  private acquire(x: number, y: number, key: string, depth: number): Phaser.GameObjects.Image {
    const img = this.pool.pop();
    if (!img) return this.add.image(x, y, key).setDepth(depth);
    return img.setTexture(key).setPosition(x, y).setDepth(depth).setScale(1).setRotation(0).setAlpha(1)
      .clearTint().setBlendMode(Phaser.BlendModes.NORMAL).setVisible(true).setActive(true);
  }

  private release(img: Phaser.GameObjects.Image) {
    img.setVisible(false).setActive(false);
    this.pool.push(img);
  }

  // -------------------------------------------------------------- synchronisation des sprites
  private sync(sim: DriveSim, dt: number) {
    for (const v of sim.vehicles) {
      const view = this.vehicles.get(v.id)!;
      const tilt = Math.atan2(v.vy, Math.max(220, sim.scroll + v.vx)) * 0.55;
      view.body.setPosition(v.x, v.y).setRotation(tilt);
      view.shadow.setPosition(v.x + 6, v.y + 8).setRotation(tilt).setDisplaySize(view.body.width * 0.95, view.body.height * 0.9);
      view.turret.setPosition(v.x - (v.id === 'command' ? 4 : 2), v.y).setRotation(v.aim);
      const visible = v.x > -150;
      view.body.setVisible(visible); view.shadow.setVisible(visible); view.turret.setVisible(visible && v.alive);
      if (!v.alive) {
        view.body.setTint(0x2a2522);
        view.smokeT -= dt;
        if (view.smokeT <= 0 && visible) { view.smokeT = 0.08; this.smoke.emitParticleAt(v.x, v.y, 1); }
        continue;
      }
      if (v.hitFlash > 0) view.body.setTintFill(0xffffff); else view.body.clearTint();
      if (v.invuln > 0 && v.hitFlash <= 0) view.body.setAlpha(0.75); else view.body.setAlpha(1);
      const ratio = v.hp / v.maxHp;
      view.smokeT -= dt;
      if (ratio < 0.5 && view.smokeT <= 0) {
        view.smokeT = ratio < 0.25 ? 0.05 : 0.14;
        this.smoke.emitParticleAt(v.x - 10, v.y, 1);
        if (ratio < 0.25) this.fire.emitParticleAt(v.x - 6, v.y + this.rng.range(-8, 8), 1);
      }
      view.dustT -= dt;
      if (view.dustT <= 0 && !this.paused) {
        view.dustT = 0.08;
        this.dust.emitParticleAt(v.x - view.body.width / 2, v.y + this.rng.range(-view.body.height / 3, view.body.height / 3), 1);
      }
    }

    const rel = (img: Phaser.GameObjects.Image) => this.release(img);
    syncMap(this.enemyViews, sim.enemies, (e) => {
      return this.acquire(e.x, e.y, `e_${e.type}`, e.type === 'boss' ? 5.5 : 5).setScale(ENEMY_SCALE[e.type]);
    }, (img, e) => {
      img.setPosition(e.x, e.y);
      let ang: number;
      if (e.type === 'marauder' || e.type === 'kamikaze') ang = Math.atan2(e.vy, e.vx || -1);
      else if (e.type === 'boss') ang = Math.PI;
      else {
        const t = sim.command;
        ang = Math.atan2(t.y - e.y, t.x - e.x);
      }
      img.setRotation(Phaser.Math.Angle.RotateTo(img.rotation, ang, 0.15));
      if (e.hitFlash > 0) img.setTintFill(0xffffff);
      else if (e.type === 'kamikaze' && Math.floor(sim.time * (e.fuse > 0 ? 16 : 4)) % 2 === 0) img.setTint(0xff8a7a);
      else img.clearTint();
    }, rel);

    syncMap(this.bulletViews, sim.bullets, (b) => {
      const key = b.friendly ? (b.heavy ? 'bullet_h' : 'bullet_f') : 'bullet_e';
      const img = this.acquire(b.x, b.y, key, 7).setBlendMode(Phaser.BlendModes.ADD);
      if (!b.friendly) img.setScale((b.radius * 2.4) / 24);
      return img;
    }, (img, b) => {
      img.setPosition(b.x, b.y);
      if (b.friendly) img.setRotation(Math.atan2(b.vy, b.vx));
      else img.setRotation(img.rotation + dt * 8);
    }, rel);

    syncMap(this.pickupViews, sim.pickups, (p) => this.acquire(p.x, p.y, `p_${p.kind}`, 2.5), (img, p) => {
      img.setPosition(p.x, p.y).setScale(1 + Math.sin(sim.time * 6 + p.uid) * 0.08);
    }, rel);

    syncMap(this.obstacleViews, sim.obstacles, (o) => {
      const key = o.kind === 'rock' ? (o.uid % 2 ? 'o_rock' : 'o_rock2') : `o_${o.kind}`;
      return this.acquire(o.x, o.y, key, o.kind === 'pothole' ? 1.5 : 3).setRotation((o.uid * 1.7) % 6.28);
    }, (img, o) => {
      img.setPosition(o.x, o.y);
      if (o.kind === 'mine') img.setAlpha(Math.floor(sim.time * 3 + o.uid) % 2 ? 1 : 0.75);
    }, rel);

    this.drawOverlay(sim);
    if (this.biome === 'night') this.drawDarkness(sim);
  }

  private drawOverlay(sim: DriveSim) {
    const g = this.overlay;
    g.clear();
    const pulse = 0.55 + 0.45 * Math.sin(sim.time * 22);
    for (const e of sim.enemies) {
      // barres de vie
      if (e.hp < e.maxHp && e.type !== 'boss') {
        const w = e.radius * 1.6;
        g.fillStyle(0x000000, 0.55).fillRect(e.x - w / 2, e.y - e.radius - 12, w, 5);
        g.fillStyle(0xff5a3a, 1).fillRect(e.x - w / 2, e.y - e.radius - 12, (w * Math.max(0, e.hp)) / e.maxHp, 5);
      }
      // télégraphie des tirs
      if (e.telegraph > 0) {
        if (e.type === 'boss') {
          const base = Math.atan2(e.aimY - e.y, e.aimX - e.x);
          const n = e.hp < e.maxHp * 0.5 ? 7 : 5;
          g.lineStyle(3, 0xff3b2f, 0.35 * pulse + 0.2);
          for (let i = 0; i < n; i++) {
            const a = base + (i - (n - 1) / 2) * 0.16;
            g.lineBetween(e.x - 50, e.y, e.x - 50 + Math.cos(a) * 900, e.y + Math.sin(a) * 900);
          }
        } else {
          g.lineStyle(e.type === 'brute' ? 4 : 2, 0xff3b2f, 0.3 + 0.5 * pulse);
          dashed(g, e.x, e.y, e.aimX, e.aimY, 14, 9);
          g.fillStyle(0xff3b2f, 0.5 * pulse).fillCircle(e.x, e.y, e.radius * 0.6);
        }
      }
      if (e.type === 'kamikaze' && e.fuse > 0) {
        g.lineStyle(3, 0xff3b2f, 0.5 + 0.5 * pulse).strokeCircle(e.x, e.y, 95);
        g.fillStyle(0xff3b2f, 0.12).fillCircle(e.x, e.y, 95);
      }
    }
    // rayon d'aimant du Glaneur
    const salv = sim.vehicles[2];
    if (salv.alive) g.lineStyle(1.5, 0x7fe3d8, 0.18).strokeCircle(salv.x, salv.y, salv.stats.pickupRadius);
    // bouclier
    for (const v of sim.vehicles) {
      if (v.alive && v.shieldCd > 11.3) g.lineStyle(4, 0x7fe3d8, (v.shieldCd - 11.3) * 1.4).strokeCircle(v.x, v.y, v.radius + 16);
    }
    // rafale de sable
    if (sim.gustWarn > 0) {
      const y = sim.gustDir > 0 ? ROAD.bottom - 30 : ROAD.top + 30;
      g.fillStyle(0xf2c230, 0.5 * pulse);
      for (let x = 200; x < VIEW.w; x += 220) g.fillTriangle(x, y, x + 30, y, x + 15, y + sim.gustDir * 26);
    }
    if (this.biome === 'desert') this.sand.emitting = sim.gust > 0;
  }

  private drawDarkness(sim: DriveSim) {
    const rt = this.dark;
    const k = 1 / DARK_SCALE;
    rt.clear();
    rt.fill(0x070912, 0.74);
    // une seule passe d'effacement groupée (un seul flush GPU)
    rt.beginDraw();
    const li = this.lightImg;
    const light = (x: number, y: number, scale: number, alpha = 1) => {
      li.setPosition(x * k, y * k).setScale(scale * k).setAlpha(alpha);
      rt.batchDraw(li);
    };
    for (const v of sim.vehicles) {
      if (!v.alive || v.x < -100) continue;
      this.headImg.setPosition((v.x + v.radius * 0.6) * k, v.y * k).setRotation(Math.atan2(v.vy, sim.scroll) * 0.5)
        .setScale((v.id === 'command' ? 1.1 : 0.8) * k);
      rt.batchDraw(this.headImg);
      light(v.x, v.y, 0.75);
    }
    for (const f of this.flashes) light(f.x, f.y, (f.r / 128) * Math.min(1, f.t * 3), Math.min(1, f.t * 3));
    for (const p of sim.pickups) light(p.x, p.y, 0.18);
    if (sim.boss) light(sim.boss.x, sim.boss.y, 1.3);
    for (const e of sim.enemies) if (e.telegraph > 0 || e.fuse > 0) light(e.x, e.y, 0.3);
    for (const b of sim.bullets) if (!b.friendly) light(b.x, b.y, 0.15);
    rt.endDraw(true);
    li.setAlpha(1);
  }

  // -------------------------------------------------------------- événements → effets
  private handleEvent(e: SimEvent) {
    this.cb?.onEvent?.(e);
    const demo = this.sim?.cfg.kind === 'demo';
    switch (e.type) {
      case 'shot':
        if (e.friendly) {
          this.sparks.emitParticleAt(e.x, e.y, e.heavy ? 4 : 1);
          if (!demo) audio.play(e.heavy ? 'heavy' : 'shot');
          if (e.heavy) this.flashes.push({ x: e.x, y: e.y, r: 80, t: 0.12 });
        } else if (!demo) audio.play('enemyShot');
        break;
      case 'hit':
        this.sparks.emitParticleAt(e.x, e.y, e.friendly ? 3 : 6);
        if (!demo) audio.play('hit');
        break;
      case 'explosion': {
        const big = e.r > 100;
        this.fire.explode(big ? 40 : 18, e.x, e.y);
        this.smoke.explode(big ? 20 : 8, e.x, e.y);
        this.debris.explode(big ? 16 : 6, e.x, e.y);
        this.flashes.push({ x: e.x, y: e.y, r: e.r * 2.2, t: 0.4 });
        if (!demo) {
          audio.play(big ? 'bigExplosion' : 'explosion', Math.min(1.2, e.r / 80));
          if (this.shakeEnabled) this.cameras.main.shake(big ? 260 : 120, big ? 0.012 : 0.004);
        }
        break;
      }
      case 'pickup':
        if (!demo) {
          this.floatText(e.x, e.y - 10, `+${e.amount}`, COLORS[e.kind]);
          audio.play('pickup');
        }
        break;
      case 'damage':
        if (!demo && e.vehicle === 'command') {
          audio.play('damage');
          if (this.shakeEnabled && e.amount >= 10) this.cameras.main.shake(140, 0.006);
        }
        break;
      case 'shield':
        this.floatText(e.x, e.y - 30, 'BOUCLIER', '#7fe3d8');
        audio.play('shield');
        break;
      case 'gust':
        if (!demo) audio.play('warn');
        break;
      case 'bossSpawn':
        audio.setMood('boss');
        audio.play('warn');
        break;
      default:
        break;
    }
  }

  private floatText(x: number, y: number, txt: string, color: string) {
    if (this.texts.length > 30) return;
    const t = this.add.text(x, y, txt, {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', fontStyle: 'bold', color, stroke: '#1d1612', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(11);
    this.texts.push(t);
  }

  // -------------------------------------------------------------- décor
  private updateDecor(dt: number, scroll: number) {
    for (const d of this.decor) d.x -= scroll * dt;
    this.decor = this.decor.filter((d) => { if (d.x < -200) { this.release(d); return false; } return true; });
    this.decorTimer -= dt;
    if (this.decorTimer <= 0) {
      this.decorTimer = this.rng.range(0.35, 0.8);
      this.spawnDecor(VIEW.w + 120);
    }
  }

  private spawnDecor(x: number) {
    const list = DECOR[this.biome];
    const tot = list.reduce((a, d) => a + d.weight, 0);
    let r = this.rng.next() * tot;
    let def = list[0];
    for (const d of list) { r -= d.weight; if (r <= 0) { def = d; break; } }
    const top = this.rng.chance(0.5);
    const y = top ? this.rng.range(10, ROAD.top - 40) : this.rng.range(ROAD.bottom + 40, VIEW.h - 10);
    const img = this.acquire(x, y, `d_${def.kind}`, 1).setRotation(def.kind === 'sign' ? 0 : this.rng.range(-0.3, 0.3));
    if (this.biome === 'night') img.setTint(0x9a8fa8);
    this.decor.push(img);
  }
}

function syncMap<T extends { uid: number }>(
  map: Map<number, Phaser.GameObjects.Image>, items: T[],
  create: (t: T) => Phaser.GameObjects.Image, update: (img: Phaser.GameObjects.Image, t: T) => void,
  release: (img: Phaser.GameObjects.Image) => void,
) {
  const seen = new Set<number>();
  for (const it of items) {
    seen.add(it.uid);
    let img = map.get(it.uid);
    if (!img) { img = create(it); map.set(it.uid, img); }
    update(img, it);
  }
  for (const [uid, img] of map) if (!seen.has(uid)) { release(img); map.delete(uid); }
}

function dashed(g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number, dash: number, gap: number) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const ux = (x1 - x0) / len, uy = (y1 - y0) / len;
  for (let d = 0; d < len; d += dash + gap) {
    const e = Math.min(len, d + dash);
    g.lineBetween(x0 + ux * d, y0 + uy * d, x0 + ux * e, y0 + uy * e);
  }
}
