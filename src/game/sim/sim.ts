/**
 * Simulation pure (sans Phaser) d'un segment de convoi : déplacement, ennemis, tirs, collecte.
 * Pas de temps fixe ; déterministe pour une graine donnée et une suite d'entrées donnée.
 */
import { BIOMES, ENEMIES, ROAD, SEGMENT_LENGTH, VEHICLES, VIEW, spawnInterval } from '../../config/balance';
import { Rng } from '../../core/rng';
import type { Biome, EnemyType, ResourceKey, Resources, RunState, VehicleId } from '../../core/types';
import { addRes } from '../run';
import { vehicleStats, type CombatStats } from '../upgrades';

export const SIM_DT = 1 / 60;
export type SegmentKind = 'route' | 'event' | 'workshop' | 'camp' | 'final' | 'ambush' | 'demo';

export interface SimVehicle {
  id: VehicleId;
  x: number; y: number; vx: number; vy: number;
  hp: number; maxHp: number; alive: boolean;
  stats: CombatStats;
  radius: number;
  cooldown: number; rearCooldown: number;
  invuln: number; hitFlash: number;
  aim: number; // angle de la tourelle
  shieldCd: number;
}

export interface SimEnemy {
  uid: number; type: EnemyType;
  x: number; y: number; vx: number; vy: number;
  hp: number; maxHp: number; radius: number;
  state: 'enter' | 'act' | 'retreat' | 'leave';
  t: number; shotTimer: number; telegraph: number; aimX: number; aimY: number;
  fuse: number; // kamikaze : >0 = amorcé
  phase: number; hitFlash: number; dead: boolean; damageMul: number; spawnTimer: number;
}

export interface Bullet {
  uid: number; x: number; y: number; vx: number; vy: number;
  damage: number; friendly: boolean; radius: number; life: number; heavy: boolean; pierce: number;
}

export interface Pickup { uid: number; kind: ResourceKey; amount: number; x: number; y: number; vx: number; vy: number; magnet: boolean; dead: boolean }

export type ObstacleKind = 'rock' | 'barrel' | 'wreck' | 'mine' | 'pothole';
export interface Obstacle { uid: number; kind: ObstacleKind; x: number; y: number; radius: number; dead: boolean; hp: number }

export type SimEvent =
  | { type: 'shot'; x: number; y: number; friendly: boolean; heavy: boolean; angle: number }
  | { type: 'hit'; x: number; y: number; friendly: boolean }
  | { type: 'explosion'; x: number; y: number; r: number }
  | { type: 'pickup'; kind: ResourceKey; amount: number; x: number; y: number }
  | { type: 'kill'; enemy: EnemyType; x: number; y: number }
  | { type: 'damage'; vehicle: VehicleId; amount: number; x: number; y: number }
  | { type: 'destroyed'; vehicle: VehicleId; x: number; y: number }
  | { type: 'shield'; x: number; y: number }
  | { type: 'gust'; dir: number }
  | { type: 'bossSpawn' }
  | { type: 'spawn'; enemy: EnemyType };

export interface SimInput { manual: boolean; dx: number; dy: number }
export const NO_INPUT: SimInput = { manual: false, dx: 0, dy: 0 };

export interface SimConfig {
  kind: SegmentKind;
  biome: Biome;
  depth: number; // 0..6
  risk: number;
  seed: number;
  run?: RunState; // états des véhicules et améliorations
  lengthOverride?: number;
}

const ROAD_MIN = ROAD.top + 26;
const ROAD_MAX = ROAD.bottom - 26;

export class DriveSim {
  readonly cfg: SimConfig;
  readonly rng: Rng;
  readonly scroll: number;
  readonly length: number;
  time = 0;
  distance = 0;
  vehicles: SimVehicle[] = [];
  enemies: SimEnemy[] = [];
  bullets: Bullet[] = [];
  pickups: Pickup[] = [];
  obstacles: Obstacle[] = [];
  events: SimEvent[] = [];
  collected: Resources = { fuel: 0, scrap: 0, food: 0 };
  kills = 0;
  killsByType: Partial<Record<EnemyType, number>> = {};
  damageTaken = 0;
  damageBySource: Record<string, number> = {};
  outcome: null | 'cleared' | 'lost' = null;
  boss: SimEnemy | null = null;
  bossDefeated = false;
  gust = 0; gustTimer = 9; gustWarn = 0; gustDir = 1;
  private uid = 1;
  private spawnTimer = 3;
  private obstacleTimer = 2;
  private crateTimer = 5;
  private aiTimer = 0;
  private aiTargetY: number = ROAD.centerY;
  private endTimer = -1;
  /** Temps réel non encore simulé (accumulateur du pas fixe). */
  private acc = 0;
  /** Le boss final n'apparaît qu'une fois par segment. */
  private bossSpawned = false;

  constructor(cfg: SimConfig) {
    this.cfg = cfg;
    this.rng = new Rng(cfg.seed);
    this.scroll = BIOMES[cfg.biome].scroll;
    this.length = cfg.lengthOverride ?? (cfg.kind === 'ambush' ? 3600 : cfg.kind === 'demo' ? Infinity : SEGMENT_LENGTH[cfg.kind]);
    const ids: VehicleId[] = ['command', 'escort', 'salvager'];
    for (const id of ids) {
      const d = VEHICLES[id];
      const st = vehicleStats(id, cfg.run?.upgrades ?? {}, cfg.run?.meta ?? {});
      const rs = cfg.run?.vehicles[id];
      this.vehicles.push({
        id, x: 420 + d.offset.x, y: ROAD.centerY + d.offset.y, vx: 0, vy: 0,
        hp: rs ? rs.hp : st.maxHp, maxHp: rs ? rs.maxHp : st.maxHp, alive: rs ? rs.alive : true,
        stats: st, radius: d.radius, cooldown: this.rng.range(0, 0.5), rearCooldown: 1,
        invuln: 0, hitFlash: 0, aim: 0, shieldCd: 0,
      });
    }
    if (cfg.kind === 'demo') this.spawnTimer = 2.5;
    if (cfg.kind === 'ambush') this.spawnTimer = 0.8;
  }

  get command(): SimVehicle { return this.vehicles[0]; }
  get progress(): number { return this.length > 0 ? Math.min(1, this.distance / this.length) : 1; }
  get done(): boolean { return this.outcome !== null; }

  /** Avance la simulation de dt secondes (découpé en pas fixes). */
  update(dt: number, input: SimInput = NO_INPUT) {
    // Accumulateur : le reste est reporté, la vitesse simulée ne dépend pas de la cadence d'appel.
    this.acc += Math.max(0, dt);
    let n = 0;
    while (this.acc >= SIM_DT - 1e-9 && n < 30 && !this.outcome) {
      this.step(SIM_DT, input);
      this.acc -= SIM_DT;
      n++;
    }
    if (this.acc < 0) this.acc = 0;
    if (this.acc > SIM_DT * 2) this.acc = SIM_DT * 2; // anti-spirale après un gros à-coup
  }

  step(dt: number, input: SimInput) {
    this.time += dt;
    const finalHold = this.cfg.kind === 'final' && !this.bossDefeated;
    if (!(finalHold && this.distance >= this.length * 0.92)) this.distance += this.scroll * dt;

    this.updateHazards(dt);
    this.updateConvoy(dt, input);
    this.updateSpawns(dt);
    this.updateEnemies(dt);
    this.updateFire(dt);
    this.updateBullets(dt);
    this.updatePickups(dt);
    this.updateObstacles(dt);

    if (!this.command.alive) { this.outcome = 'lost'; return; }
    const reached = this.distance >= this.length;
    if (this.cfg.kind === 'final') {
      if (this.bossDefeated && this.endTimer < 0) this.endTimer = 2.5;
    } else if (reached && this.endTimer < 0) {
      this.endTimer = 0.01;
    }
    if (this.endTimer > 0) {
      this.endTimer -= dt;
      if (this.endTimer <= 0) this.outcome = 'cleared';
    }
  }

  // ---------------------------------------------------------------- convoi
  private updateConvoy(dt: number, input: SimInput) {
    const lead = this.command;
    if (input.manual && lead.alive) {
      const sp = 330;
      const len = Math.hypot(input.dx, input.dy) || 1;
      const k = Math.min(1, len);
      lead.vx = (input.dx / len) * sp * k;
      lead.vy = (input.dy / len) * sp * k;
    } else {
      this.aiTimer -= dt;
      if (this.aiTimer <= 0) { this.aiTimer = 0.12; this.aiTargetY = this.chooseLane(); }
      const dy = this.aiTargetY - lead.y;
      lead.vy += (Math.max(-280, Math.min(280, dy * 3.2)) - lead.vy) * Math.min(1, dt * 6);
      const anchorX = this.boss ? 520 : 420;
      lead.vx += ((anchorX - lead.x) * 1.5 - lead.vx) * Math.min(1, dt * 4);
    }
    if (this.gust > 0) lead.vy += this.gustDir * 120 * dt * 3;
    lead.x = clamp(lead.x + lead.vx * dt, 150, 900);
    lead.y = clamp(lead.y + lead.vy * dt, ROAD_MIN, ROAD_MAX);

    for (const v of this.vehicles) {
      if (v.invuln > 0) v.invuln -= dt;
      if (v.hitFlash > 0) v.hitFlash -= dt;
      if (v.shieldCd > 0) v.shieldCd -= dt;
      if (!v.alive) { v.x -= this.scroll * dt; continue; }
      if (v.stats.regen > 0) v.hp = Math.min(v.maxHp, v.hp + v.stats.regen * dt);
      if (v === lead) continue;
      const off = VEHICLES[v.id].offset;
      let ty = clamp(lead.y + off.y, ROAD_MIN, ROAD_MAX);
      const tx = lead.x + off.x;
      // évitement simple des obstacles devant l'escorte
      for (const o of this.obstacles) {
        if (o.dead || o.x < v.x - 20 || o.x > v.x + 220) continue;
        if (Math.abs(o.y - ty) < o.radius + v.radius + 12) ty += (ty >= o.y ? 1 : -1) * (o.radius + v.radius + 14);
      }
      // séparation avec le commandement
      if (Math.abs(ty - lead.y) < 70 && Math.abs(tx - lead.x) < 90) ty = lead.y + Math.sign(off.y) * 70;
      ty = clamp(ty, ROAD_MIN, ROAD_MAX);
      if (this.gust > 0) ty += this.gustDir * 30;
      const nvx = (tx - v.x) * 3.2;
      const nvy = (ty - v.y) * 3.6;
      v.vx = clamp(nvx, -320, 320);
      v.vy = clamp(nvy, -320, 320);
      v.x += v.vx * dt;
      v.y = clamp(v.y + v.vy * dt, ROAD_MIN, ROAD_MAX);
    }
  }

  /** Pilote automatique : choisit une voie qui évite dangers et rapproche des bonus. */
  private chooseLane(): number {
    const lead = this.command;
    let best = lead.y;
    let bestScore = -Infinity;
    const lo = ROAD_MIN + 70, hi = ROAD_MAX - 70;
    for (let y = lo; y <= hi; y += 24) {
      let s = -Math.abs(y - ROAD.centerY) * 0.04 - Math.abs(y - this.aiTargetY) * 0.02 - Math.abs(y - lead.y) * 0.015;
      for (const o of this.obstacles) {
        if (o.dead) continue;
        const ahead = o.x - lead.x;
        if (ahead < -40 || ahead > 520) continue;
        const gap = Math.abs(o.y - y) - (o.radius + 120);
        if (gap < 0) s -= 140 * (1 - Math.max(0, ahead) / 560) + (-gap) * 0.6;
      }
      for (const b of this.bullets) {
        if (b.friendly) continue;
        const t = (lead.x - b.x) / (b.vx || -1);
        if (t < 0 || t > 1.6) continue;
        const py = b.y + b.vy * t;
        if (Math.abs(py - y) < 60 + b.radius) s -= b.heavy ? 90 : 35;
      }
      for (const e of this.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - lead.x, e.y - y);
        if (e.type === 'kamikaze' && d < 260) s -= (260 - d) * 0.5;
        if ((e.type === 'brute' || e.type === 'boss') && Math.abs(e.y - y) < e.radius + 60 && e.x > lead.x) s -= 40;
      }
      for (const p of this.pickups) {
        const ahead = p.x - lead.x;
        if (ahead < 0 || ahead > 450) continue;
        if (Math.abs(p.y - y) < 50) s += 14;
      }
      if (s > bestScore) { bestScore = s; best = y; }
    }
    return best;
  }

  // ---------------------------------------------------------------- dangers de biome
  private updateHazards(dt: number) {
    if (this.cfg.kind === 'demo') return;
    if (this.cfg.biome === 'desert') {
      this.gustTimer -= dt;
      if (this.gustTimer <= 0 && this.gustWarn <= 0 && this.gust <= 0) {
        this.gustWarn = 1.2;
        this.gustDir = this.rng.chance(0.5) ? 1 : -1;
        this.events.push({ type: 'gust', dir: this.gustDir });
      }
      if (this.gustWarn > 0) {
        this.gustWarn -= dt;
        if (this.gustWarn <= 0) { this.gust = 1.8; this.gustTimer = this.rng.range(8, 13); }
      }
      if (this.gust > 0) this.gust -= dt;
    }
  }

  // ---------------------------------------------------------------- apparitions
  private updateSpawns(dt: number) {
    const k = this.cfg.kind;
    const late = this.distance > this.length - 900;
    // obstacles
    this.obstacleTimer -= dt;
    if (this.obstacleTimer <= 0 && !late) {
      this.obstacleTimer = this.rng.range(1.6, 3.2) * (k === 'demo' ? 1.5 : 1);
      this.spawnObstacle();
    }
    // caisses au bord de la route
    this.crateTimer -= dt;
    if (this.crateTimer <= 0 && !late) {
      this.crateTimer = this.rng.range(4.5, 7.5);
      const kinds: ResourceKey[] = ['scrap', 'scrap', 'fuel', 'food'];
      const kind = this.rng.pick(kinds);
      const amount = kind === 'scrap' ? 3 : 2;
      this.addPickup(kind, amount, VIEW.w + 40, this.rng.range(ROAD_MIN + 20, ROAD_MAX - 20), -this.scroll, 0);
    }
    if (k === 'demo' && this.enemies.length >= 2) return;
    // boss final
    if (k === 'final' && !this.bossSpawned && this.distance > 1400) {
      this.bossSpawned = true;
      this.boss = this.spawnEnemy('boss', VIEW.w + 120, ROAD.centerY);
      this.events.push({ type: 'bossSpawn' });
    }
    if (late && k !== 'final') return;
    if (k === 'final' && this.boss && !this.boss.dead) return; // le boss appelle ses renforts
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    const depth = this.cfg.depth;
    const risk = k === 'ambush' ? 3 : k === 'route' ? this.cfg.risk : Math.max(1, this.cfg.risk - 1);
    this.spawnTimer = spawnInterval(depth, risk) * this.rng.range(0.8, 1.25) * (k === 'event' || k === 'camp' || k === 'workshop' ? 1.35 : 1) * (k === 'demo' ? 2 : 1);
    const type = this.pickEnemyType();
    const group = type === 'marauder' ? this.rng.int(1, depth >= 2 ? 3 : 2) : 1;
    for (let i = 0; i < group; i++) {
      const fromBehind = type === 'marauder' && this.rng.chance(0.4);
      const x = fromBehind ? -60 - i * 40 : VIEW.w + 60 + i * 50;
      const y = this.rng.range(ROAD_MIN, ROAD_MAX);
      this.spawnEnemy(type, x, y);
    }
  }

  private pickEnemyType(): EnemyType {
    const d = this.cfg.depth;
    const b = this.cfg.biome;
    const w: [EnemyType, number][] = [
      ['marauder', 5 + (b === 'desert' ? 2 : 0)],
      ['scout', 3 + (b === 'desert' ? 1 : 0)],
      ['gunner', d >= 1 ? 2.5 + (b === 'industrial' ? 1.5 : 0) : 1],
      ['kamikaze', d >= 1 ? 1.5 + (b === 'night' ? 2 : 0) : 0],
      ['brute', d >= 2 ? 0.8 + (b === 'industrial' ? 0.8 : 0) + (d >= 4 ? 0.5 : 0) : 0],
    ];
    if (this.cfg.kind === 'demo') return this.rng.pick(['marauder', 'scout'] as EnemyType[]);
    const tot = w.reduce((a, [, x]) => a + x, 0);
    let r = this.rng.next() * tot;
    for (const [t, x] of w) { r -= x; if (r <= 0) return t; }
    return 'marauder';
  }

  spawnEnemy(type: EnemyType, x: number, y: number): SimEnemy {
    const def = ENEMIES[type];
    const scale = 1 + 0.12 * this.cfg.depth;
    const e: SimEnemy = {
      uid: this.uid++, type, x, y, vx: 0, vy: 0,
      hp: Math.round(def.hp * (type === 'boss' ? 1 : scale)), maxHp: 0, radius: def.radius,
      state: 'enter', t: 0, shotTimer: def.shotCooldown * this.rng.range(0.5, 1), telegraph: 0, aimX: 0, aimY: 0,
      fuse: 0, phase: this.rng.range(0, Math.PI * 2), hitFlash: 0, dead: false,
      damageMul: 1 + 0.06 * this.cfg.depth, spawnTimer: 5,
    };
    e.maxHp = e.hp;
    this.enemies.push(e);
    this.events.push({ type: 'spawn', enemy: type });
    return e;
  }

  private spawnObstacle() {
    const b = this.cfg.biome;
    let kind: ObstacleKind;
    const r = this.rng.next();
    if (b === 'desert') kind = r < 0.85 ? 'rock' : 'wreck';
    else if (b === 'industrial') kind = r < 0.5 ? 'barrel' : r < 0.8 ? 'wreck' : 'rock';
    else kind = r < 0.5 ? 'mine' : r < 0.8 ? 'pothole' : 'rock';
    if (this.cfg.kind === 'demo' && (kind === 'mine' || kind === 'barrel')) kind = 'rock';
    const radius = { rock: 26, barrel: 18, wreck: 40, mine: 14, pothole: 22 }[kind];
    const y = this.rng.range(ROAD_MIN + 10, ROAD_MAX - 10);
    this.obstacles.push({ uid: this.uid++, kind, x: VIEW.w + 60, y, radius, dead: false, hp: kind === 'barrel' ? 10 : 9999 });
  }

  // ---------------------------------------------------------------- ennemis
  private nearestVehicle(x: number, y: number): SimVehicle | null {
    let best: SimVehicle | null = null;
    let bd = Infinity;
    for (const v of this.vehicles) {
      if (!v.alive) continue;
      const d = (v.x - x) ** 2 + (v.y - y) ** 2;
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  private updateEnemies(dt: number) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.t += dt;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      const def = ENEMIES[e.type];
      const target = this.nearestVehicle(e.x, e.y) ?? this.command;
      switch (e.type) {
        case 'marauder': {
          if (e.state === 'leave') {
            this.steer(e, -400, e.y, def.speed, dt); // cible au-delà du seuil de retrait (-260)
          } else if (e.state === 'retreat') {
            if (e.t > 1.2) { e.state = 'act'; e.t = 0; }
            this.steer(e, e.x + 300, e.y + Math.sin(e.phase) * 200, def.speed * 0.8, dt);
          } else {
            this.steer(e, target.x, target.y, def.speed, dt);
            if (e.t > 14) e.state = 'leave';
          }
          break;
        }
        case 'gunner': {
          const holdX = 980 + Math.sin(e.phase) * 120;
          const ty = clamp(target.y + Math.sin(e.t * 0.7 + e.phase) * 110, ROAD_MIN, ROAD_MAX);
          if (e.t > 22) this.steer(e, VIEW.w + 560, e.y, def.speed, dt); else this.steer(e, holdX, ty, def.speed, dt, 0.6);
          this.shooter(e, target, dt, 1, 430, 9);
          break;
        }
        case 'scout': {
          const ty = ROAD.centerY + Math.sin(e.t * 1.7 + e.phase) * 210;
          if (e.t > 15) this.steer(e, VIEW.w + 560, ty, def.speed, dt); else this.steer(e, 900 + Math.cos(e.t * 0.8 + e.phase) * 90, ty, def.speed * 1.4, dt);
          this.shooter(e, target, dt, 1, 470, 6);
          break;
        }
        case 'brute': {
          this.steer(e, 760, clamp(this.command.y, ROAD_MIN + 20, ROAD_MAX - 20), def.speed, dt, 0.4);
          this.shooter(e, target, dt, 1, 330, 13, true);
          break;
        }
        case 'kamikaze': {
          const sp = def.speed * (1 + Math.min(1.2, e.t * 0.25));
          this.steer(e, target.x, target.y, sp, dt);
          const d = Math.hypot(target.x - e.x, target.y - e.y);
          if (e.fuse <= 0 && d < e.radius + target.radius + 46) e.fuse = def.telegraph;
          if (e.fuse > 0) {
            e.fuse -= dt;
            if (e.fuse <= 0) {
              // l'émetteur est marqué mort avant le souffle : ni kill du joueur, ni butin ; l'explosion télégraphiée ignore l'invulnérabilité
              this.killEnemy(e, false);
              this.explode(e.x, e.y, 95, def.shotDamage * e.damageMul, true, false, true);
            }
          }
          break;
        }
        case 'boss': {
          const enraged = e.hp < e.maxHp * 0.5;
          this.steer(e, 830, ROAD.centerY + Math.sin(e.t * 0.5) * 150, e.x > 960 ? 220 : def.speed * (enraged ? 1.5 : 1), dt, e.x > 960 ? 1 : 0.5);
          // tir en éventail télégraphié
          if (e.telegraph > 0) {
            e.telegraph -= dt;
            if (e.telegraph <= 0) {
              const base = Math.atan2(e.aimY - e.y, e.aimX - e.x);
              const n = enraged ? 7 : 5;
              for (let i = 0; i < n; i++) {
                const a = base + (i - (n - 1) / 2) * 0.16;
                this.enemyBullet(e.x - 50, e.y, a, 360, def.shotDamage * 1.0, 11, true);
              }
            }
          } else {
            e.shotTimer -= dt;
            if (e.shotTimer <= 0) {
              e.shotTimer = def.shotCooldown * (enraged ? 0.7 : 1) + 1;
              e.telegraph = def.telegraph;
              e.aimX = target.x; e.aimY = target.y;
            }
          }
          e.spawnTimer -= dt;
          if (e.spawnTimer <= 0) {
            e.spawnTimer = enraged ? 5 : 7;
            const t: EnemyType = this.rng.pick(['marauder', 'kamikaze', 'scout', 'gunner'] as EnemyType[]);
            this.spawnEnemy(t, VIEW.w + 60, clamp(e.y + this.rng.range(-200, 200), ROAD_MIN, ROAD_MAX));
            if (t === 'marauder') this.spawnEnemy('marauder', -60, this.rng.range(ROAD_MIN, ROAD_MAX));
          }
          break;
        }
      }
      e.x += e.vx * dt;
      e.y = clamp(e.y + e.vy * dt, ROAD_MIN - 30, ROAD_MAX + 30);

      // contact avec le convoi
      if (def.contactDamage > 0) {
        for (const v of this.vehicles) {
          if (!v.alive) continue;
          const d = Math.hypot(v.x - e.x, v.y - e.y);
          if (d < v.radius + e.radius) {
            if (v.invuln <= 0) {
              this.damageVehicle(v, def.contactDamage * e.damageMul, false, 'contact:' + e.type);
              this.damageEnemy(e, e.type === 'marauder' ? 8 : 4, v.x, v.y);
            }
            // répulsion
            const nx = (e.x - v.x) / (d || 1), ny = (e.y - v.y) / (d || 1);
            e.vx += nx * 260; e.vy += ny * 260;
            if (e.type === 'marauder' && e.state !== 'leave') { e.state = 'retreat'; e.t = 0; }
          }
        }
      }
      if (e.x < -260 || e.x > VIEW.w + 420) { e.dead = true; if (e === this.boss) this.boss = null; }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  private steer(e: SimEnemy, tx: number, ty: number, speed: number, dt: number, smooth = 1) {
    const dx = tx - e.x, dy = ty - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const sp = Math.min(speed, d * 2.5);
    const k = Math.min(1, dt * 3 * smooth);
    e.vx += ((dx / d) * sp - e.vx) * k;
    e.vy += ((dy / d) * sp - e.vy) * k;
  }

  /** Tir ennemi télégraphié : visée verrouillée pendant `telegraph`, puis projectile lisible. */
  private shooter(e: SimEnemy, target: SimVehicle, dt: number, count: number, speed: number, radius: number, heavy = false) {
    const def = ENEMIES[e.type];
    if (e.x > VIEW.w - 20) return;
    if (e.telegraph > 0) {
      e.telegraph -= dt;
      if (e.telegraph <= 0) {
        const a = Math.atan2(e.aimY - e.y, e.aimX - e.x);
        for (let i = 0; i < count; i++) this.enemyBullet(e.x, e.y, a, speed, def.shotDamage * e.damageMul, radius, heavy);
      }
      return;
    }
    e.shotTimer -= dt;
    if (e.shotTimer <= 0) {
      e.shotTimer = def.shotCooldown * this.rng.range(0.85, 1.2);
      e.telegraph = def.telegraph;
      // visée avec anticipation légère
      e.aimX = target.x + target.vx * 0.3;
      e.aimY = target.y + target.vy * 0.3;
    }
  }

  private enemyBullet(x: number, y: number, a: number, speed: number, damage: number, radius: number, heavy: boolean) {
    this.bullets.push({ uid: this.uid++, x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, damage, friendly: false, radius, life: 4, heavy, pierce: 1 });
    this.events.push({ type: 'shot', x, y, friendly: false, heavy, angle: a });
  }

  // ---------------------------------------------------------------- tirs du convoi
  private updateFire(dt: number) {
    for (const v of this.vehicles) {
      if (!v.alive) continue;
      v.cooldown -= dt;
      const target = this.pickTarget(v);
      if (target) {
        const lead = Math.hypot(target.x - v.x, target.y - v.y) / v.stats.bulletSpeed;
        const ax = target.x + target.vx * lead, ay = target.y + target.vy * lead;
        const want = Math.atan2(ay - v.y, ax - v.x);
        v.aim = lerpAngle(v.aim, want, Math.min(1, dt * 14));
        if (v.cooldown <= 0) {
          v.cooldown = v.stats.fireCooldown;
          this.fire(v, want, v.stats.damage);
        }
      } else {
        v.aim = lerpAngle(v.aim, 0, Math.min(1, dt * 4));
      }
      if (v.stats.rearTurret) {
        v.rearCooldown -= dt;
        if (v.rearCooldown <= 0) {
          const t2 = this.pickTarget(v, true);
          if (t2) {
            v.rearCooldown = 1.1;
            this.fire(v, Math.atan2(t2.y - v.y, t2.x - v.x), v.stats.damage * 0.7);
          }
        }
      }
    }
  }

  private fire(v: SimVehicle, a: number, damage: number) {
    const sp = v.stats.bulletSpeed;
    const mx = v.x + Math.cos(a) * (v.radius + 6), my = v.y + Math.sin(a) * (v.radius + 6);
    this.bullets.push({
      uid: this.uid++, x: mx, y: my, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, damage,
      friendly: true, radius: v.id === 'command' ? 7 : 4, life: v.stats.range / sp + 0.1, heavy: v.id === 'command', pierce: v.stats.armorPierce,
    });
    this.events.push({ type: 'shot', x: mx, y: my, friendly: true, heavy: v.id === 'command', angle: a });
  }

  /** Ciblage prioritaire : kamikazes amorcés > kamikazes > tireurs qui visent > le plus proche. */
  private pickTarget(v: SimVehicle, rear = false): SimEnemy | null {
    let best: SimEnemy | null = null;
    let bs = Infinity;
    const range = v.stats.range;
    for (const e of this.enemies) {
      if (e.dead || e.x > VIEW.w - 10 || e.x < 10) continue;
      if (rear && e.x > v.x) continue;
      const d = Math.hypot(e.x - v.x, e.y - v.y);
      if (d > range + e.radius) continue;
      let s = d;
      if (e.type === 'kamikaze') s *= e.fuse > 0 ? 0.2 : 0.4;
      if (e.telegraph > 0) s *= 0.7;
      if (e.type === 'boss') s *= 1.3;
      if (s < bs) { bs = s; best = e; }
    }
    return best;
  }

  // ---------------------------------------------------------------- projectiles
  private updateBullets(dt: number) {
    for (const b of this.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0) continue;
      if (b.friendly) {
        for (const e of this.enemies) {
          if (e.dead) continue;
          if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 < (e.radius + b.radius) ** 2) {
            const mult = e.type === 'brute' || e.type === 'boss' ? b.pierce : 1;
            this.damageEnemy(e, b.damage * mult, b.x, b.y);
            b.life = 0;
            break;
          }
        }
        if (b.life > 0) {
          for (const o of this.obstacles) {
            if (o.dead || o.kind !== 'barrel') continue;
            if ((o.x - b.x) ** 2 + (o.y - b.y) ** 2 < (o.radius + b.radius) ** 2) {
              o.hp -= b.damage; b.life = 0;
              if (o.hp <= 0) this.detonateObstacle(o, true);
              break;
            }
          }
        }
      } else {
        for (const v of this.vehicles) {
          if (!v.alive) continue;
          if ((v.x - b.x) ** 2 + (v.y - b.y) ** 2 < (v.radius + b.radius) ** 2) {
            this.damageVehicle(v, b.damage, false, b.heavy ? 'heavyshot' : 'shot');
            this.events.push({ type: 'hit', x: b.x, y: b.y, friendly: false });
            b.life = 0;
            break;
          }
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0 && b.x > -100 && b.x < VIEW.w + 100 && b.y > -100 && b.y < VIEW.h + 100);
  }

  // ---------------------------------------------------------------- ramassage
  addPickup(kind: ResourceKey, amount: number, x: number, y: number, vx: number, vy: number) {
    this.pickups.push({ uid: this.uid++, kind, amount, x, y, vx, vy, magnet: false, dead: false });
  }

  private updatePickups(dt: number) {
    for (const p of this.pickups) {
      let collector: SimVehicle | null = null;
      let cd = Infinity;
      for (const v of this.vehicles) {
        if (!v.alive) continue;
        const d = Math.hypot(v.x - p.x, v.y - p.y);
        if (d < v.stats.pickupRadius && d < cd) { cd = d; collector = v; }
      }
      if (collector) {
        p.magnet = true;
        const a = Math.atan2(collector.y - p.y, collector.x - p.x);
        const sp = 520;
        p.vx += (Math.cos(a) * sp - p.vx) * Math.min(1, dt * 8);
        p.vy += (Math.sin(a) * sp - p.vy) * Math.min(1, dt * 8);
        if (cd < collector.radius + 12) {
          p.dead = true;
          const amount = p.kind === 'scrap' ? Math.max(1, Math.round(p.amount * collector.stats.scrapMult)) : p.amount;
          this.collected[p.kind] += amount;
          this.events.push({ type: 'pickup', kind: p.kind, amount, x: p.x, y: p.y });
        }
      } else {
        p.magnet = false;
        p.vx += (-this.scroll - p.vx) * Math.min(1, dt * 2);
        p.vy *= 1 - Math.min(1, dt * 2);
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < -60) p.dead = true;
    }
    this.pickups = this.pickups.filter((p) => !p.dead);
  }

  // ---------------------------------------------------------------- obstacles
  private updateObstacles(dt: number) {
    for (const o of this.obstacles) {
      if (o.dead) continue;
      o.x -= this.scroll * dt;
      if (o.x < -80) { o.dead = true; continue; }
      for (const v of this.vehicles) {
        if (!v.alive) continue;
        const d = Math.hypot(v.x - o.x, v.y - o.y);
        if (d < v.radius + o.radius - 4) {
          if (o.kind === 'barrel' || o.kind === 'mine') { this.detonateObstacle(o, false); break; }
          if (v.invuln <= 0) {
            const dmg = o.kind === 'wreck' ? 14 : o.kind === 'rock' ? 12 : 6;
            this.damageVehicle(v, dmg, false, 'obstacle:' + o.kind);
          }
          // pousse le véhicule hors de l'obstacle
          const ny = (v.y - o.y) / (d || 1);
          v.y = clamp(v.y + ny * 6, ROAD_MIN, ROAD_MAX);
          v.x -= 3;
        }
      }
      // les ennemis aussi heurtent les mines / barils
      if (!o.dead && (o.kind === 'mine' || o.kind === 'barrel')) {
        for (const e of this.enemies) {
          if (!e.dead && e.type !== 'boss' && Math.hypot(e.x - o.x, e.y - o.y) < e.radius + o.radius) { this.detonateObstacle(o, false); break; }
        }
      }
    }
    this.obstacles = this.obstacles.filter((o) => !o.dead);
  }

  /**
   * Règle : kills et butin comptent pour le joueur si c'est son tir qui déclenche le baril/la mine
   * (byPlayer) ; pas si un véhicule ou un ennemi roule dessus.
   */
  private detonateObstacle(o: Obstacle, byPlayer: boolean) {
    if (o.dead) return;
    o.dead = true;
    this.explode(o.x, o.y, o.kind === 'barrel' ? 100 : 80, o.kind === 'barrel' ? 26 : 24, true, byPlayer);
  }

  // ---------------------------------------------------------------- dégâts
  /**
   * Règle d'invulnérabilité : les explosions respectent l'invulnérabilité du véhicule, sauf
   * l'explosion télégraphiée du kamikaze (ignoreInvuln). byPlayer : les ennemis tués comptent
   * comme kills du joueur et lâchent du butin ; sinon (souffle d'un kamikaze ennemi) ni l'un ni l'autre.
   */
  private explode(x: number, y: number, r: number, damage: number, hurtsConvoy: boolean, byPlayer = true, ignoreInvuln = false) {
    this.events.push({ type: 'explosion', x, y, r });
    if (hurtsConvoy) {
      for (const v of this.vehicles) {
        if (!v.alive) continue;
        const d = Math.hypot(v.x - x, v.y - y);
        if (d < r + v.radius) this.damageVehicle(v, damage * (d < r * 0.5 + v.radius ? 1 : 0.6), ignoreInvuln, 'explosion');
      }
    }
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < r + e.radius) this.damageEnemy(e, damage * 1.5, e.x, e.y, byPlayer);
    }
  }

  damageVehicle(v: SimVehicle, raw: number, ignoreInvuln = false, source = 'other') {
    if (!v.alive || (!ignoreInvuln && v.invuln > 0)) return;
    let dmg = raw * v.stats.damageTaken;
    if (dmg >= 20 && (this.cfg.run?.upgrades.shockShield ?? 0) > 0 && v.shieldCd <= 0) {
      v.shieldCd = 12;
      v.invuln = 0.35;
      this.events.push({ type: 'shield', x: v.x, y: v.y });
      return;
    }
    dmg = Math.round(dmg * 10) / 10;
    v.hp -= dmg;
    v.invuln = 0.35;
    v.hitFlash = 0.15;
    this.damageTaken += dmg;
    this.damageBySource[source] = (this.damageBySource[source] ?? 0) + dmg;
    this.events.push({ type: 'damage', vehicle: v.id, amount: dmg, x: v.x, y: v.y });
    if (v.hp <= 0) {
      v.hp = 0;
      v.alive = false;
      this.events.push({ type: 'destroyed', vehicle: v.id, x: v.x, y: v.y });
      this.events.push({ type: 'explosion', x: v.x, y: v.y, r: 110 });
    }
  }

  damageEnemy(e: SimEnemy, dmg: number, x: number, y: number, byPlayer = true) {
    if (e.dead) return;
    e.hp -= dmg;
    e.hitFlash = 0.08;
    this.events.push({ type: 'hit', x, y, friendly: true });
    if (e.hp <= 0) this.killEnemy(e, byPlayer);
  }

  private killEnemy(e: SimEnemy, loot: boolean) {
    if (e.dead) return;
    e.dead = true;
    if (loot) { // loot = tué par le joueur
      this.kills += 1;
      this.killsByType[e.type] = (this.killsByType[e.type] ?? 0) + 1;
    }
    this.events.push({ type: 'kill', enemy: e.type, x: e.x, y: e.y });
    if (e.type !== 'kamikaze' || loot) this.events.push({ type: 'explosion', x: e.x, y: e.y, r: e.radius * 1.6 });
    if (e.type === 'kamikaze' && loot) this.explode(e.x, e.y, 70, 20, false);
    if (e === this.boss) { this.bossDefeated = true; this.boss = null; this.events.push({ type: 'explosion', x: e.x, y: e.y, r: 220 }); }
    if (!loot) return;
    const def = ENEMIES[e.type];
    const n = Math.max(1, Math.round(def.scrap * this.rng.range(0.7, 1.3)));
    const chunks = Math.min(6, n);
    const base = Math.floor(n / chunks), rem = n % chunks; // total exact = n
    for (let i = 0; i < chunks; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      this.addPickup('scrap', base + (i < rem ? 1 : 0), e.x, e.y, Math.cos(a) * 140 - this.scroll * 0.3, Math.sin(a) * 140);
    }
    if (this.rng.chance(0.08)) this.addPickup('fuel', 2, e.x, e.y, -this.scroll * 0.5, this.rng.range(-80, 80));
    if (this.rng.chance(0.07)) this.addPickup('food', 1, e.x, e.y, -this.scroll * 0.5, this.rng.range(-80, 80));
  }

  /** Vide la file d'événements (lecture par le rendu/l'audio). */
  drainEvents(): SimEvent[] {
    const ev = this.events;
    this.events = [];
    return ev;
  }

  /** Reporte l'état de fin de segment dans la run. */
  writeBack(run: RunState) {
    for (const v of this.vehicles) {
      const rv = run.vehicles[v.id];
      rv.alive = v.alive;
      rv.hp = v.alive ? Math.max(1, Math.round(v.hp)) : 0;
    }
    addRes(run, this.collected);
    run.stats.kills += this.kills;
    for (const [k, n] of Object.entries(this.killsByType)) {
      const t = k as EnemyType;
      run.stats.killsByType[t] = (run.stats.killsByType[t] ?? 0) + (n ?? 0);
    }
    run.stats.distance += Math.round(this.distance);
    run.stats.damageTaken += Math.round(this.damageTaken);
    run.stats.timeMs += Math.round(this.time * 1000);
  }
}

function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}
function lerpAngle(a: number, b: number, t: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
