import { describe, expect, it } from 'vitest';
import { ROAD } from '../../src/config/balance';
import type { Biome, EnemyType } from '../../src/core/types';
import { coinsEarned, createRun, grantUpgrade } from '../../src/game/run';
import { DriveSim, NO_INPUT, type SimConfig, type SimEvent } from '../../src/game/sim/sim';
import { autoplay } from './autoplay';

const cfg = (o: Partial<SimConfig> = {}): SimConfig => ({ kind: 'route', biome: 'desert', depth: 2, risk: 2, seed: 77, ...o });
function run(sim: DriveSim, seconds: number, input = NO_INPUT, onEv?: (e: SimEvent) => void) {
  for (let t = 0; t < seconds && !sim.done; t += 1 / 60) {
    sim.update(1 / 60, input);
    const ev = sim.drainEvents();
    if (onEv) ev.forEach(onEv);
  }
}
/** Bac à sable : pas d'apparitions automatiques. */
function sandbox(o: Partial<SimConfig> = {}) {
  const sim = new DriveSim(cfg({ kind: 'demo', ...o }));
  (sim as unknown as { spawnTimer: number }).spawnTimer = 1e9;
  (sim as unknown as { obstacleTimer: number }).obstacleTimer = 1e9;
  (sim as unknown as { crateTimer: number }).crateTimer = 1e9;
  return sim;
}

describe('Simulation déterministe', () => {
  it('même graine + mêmes entrées → même état', () => {
    const a = new DriveSim(cfg()), b = new DriveSim(cfg());
    run(a, 20); run(b, 20);
    expect(a.kills).toBe(b.kills);
    expect(a.command.hp).toBe(b.command.hp);
    expect(a.distance).toBe(b.distance);
    expect(a.enemies.map((e) => [e.type, Math.round(e.x)])).toEqual(b.enemies.map((e) => [e.type, Math.round(e.x)]));
  });
  it('un segment se termine (dégagé ou perdu) sans blocage', () => {
    for (const biome of ['desert', 'industrial', 'night'] as Biome[]) {
      const sim = new DriveSim(cfg({ biome, seed: 5 }));
      run(sim, 300);
      expect(sim.done).toBe(true);
    }
  });
});

describe('Convoi', () => {
  it('contrôle manuel : le commandement suit les entrées', () => {
    const sim = sandbox();
    const y0 = sim.command.y;
    run(sim, 0.8, { manual: true, dx: 0, dy: -1 });
    expect(sim.command.y).toBeLessThan(y0 - 100);
    const x0 = sim.command.x;
    run(sim, 0.5, { manual: true, dx: 1, dy: 0 });
    expect(sim.command.x).toBeGreaterThan(x0 + 80);
  });
  it('pilote automatique : évite un rocher sur sa voie', () => {
    const sim = sandbox();
    sim.obstacles.push({ uid: 999, kind: 'rock', x: 900, y: sim.command.y, radius: 26, dead: false, hp: 9999 });
    let minGap = Infinity;
    for (let t = 0; t < 4; t += 1 / 60) {
      sim.update(1 / 60);
      const o = sim.obstacles[0];
      if (o) minGap = Math.min(minGap, Math.hypot(o.x - sim.command.x, o.y - sim.command.y));
    }
    expect(minGap).toBeGreaterThan(26 + 34);
    expect(sim.command.hp).toBe(sim.command.maxHp);
  });
  it('les escortes suivent en formation sans se superposer', () => {
    const sim = sandbox();
    run(sim, 3);
    const [c, e, s] = sim.vehicles;
    expect(Math.hypot(c.x - e.x, c.y - e.y)).toBeGreaterThan(c.radius + e.radius);
    expect(Math.hypot(c.x - s.x, c.y - s.y)).toBeGreaterThan(c.radius + s.radius);
    expect(Math.hypot(e.x - s.x, e.y - s.y)).toBeGreaterThan(e.radius + s.radius);
  });
  it('trois véhicules mécaniquement distincts', () => {
    const [c, e, s] = new DriveSim(cfg()).vehicles;
    expect(c.stats.damage).toBeGreaterThan(e.stats.damage);
    expect(e.stats.fireCooldown).toBeLessThan(c.stats.fireCooldown);
    expect(s.stats.pickupRadius).toBeGreaterThan(c.stats.pickupRadius * 2);
    expect(s.stats.scrapMult).toBeGreaterThan(1);
  });
  it('escorte détruite : la route continue ; commandement détruit : défaite', () => {
    const sim = sandbox({ kind: 'route', lengthOverride: 600 });
    sim.damageVehicle(sim.vehicles[1], 1e6, true);
    expect(sim.vehicles[1].alive).toBe(false);
    run(sim, 10);
    expect(sim.outcome).toBe('cleared');
    const sim2 = sandbox({ kind: 'route' });
    sim2.damageVehicle(sim2.command, 1e6, true);
    run(sim2, 0.1);
    expect(sim2.outcome).toBe('lost');
  });
  it('ramassage : le Glaneur attire de loin et multiplie la ferraille', () => {
    const sim = sandbox();
    const s = sim.vehicles[2];
    sim.addPickup('scrap', 10, s.x + 120, s.y, 0, 0);
    run(sim, 2);
    expect(sim.collected.scrap).toBe(14);
  });
  it('bouclier de choc : annule un gros impact', () => {
    const r = createRun('SH', {});
    grantUpgrade(r, 'shockShield');
    const sim = new DriveSim(cfg({ kind: 'demo', run: r }));
    const hp = sim.command.hp;
    sim.damageVehicle(sim.command, 30, true);
    expect(sim.command.hp).toBe(hp);
    sim.damageVehicle(sim.command, 30, true);
    expect(sim.command.hp).toBeLessThan(hp);
  });
});

describe('Cinq archétypes ennemis', () => {
  function spawnOnly(type: EnemyType, x = 1250, y = ROAD.centerY) {
    const sim = sandbox({ depth: 2 });
    for (const v of sim.vehicles) { v.stats = { ...v.stats, damage: 0 }; }
    const e = sim.spawnEnemy(type, x, y);
    return { sim, e };
  }
  it('Maraudeur : rapide, fonce sur le convoi', () => {
    const { sim, e } = spawnOnly('marauder');
    run(sim, 1.5);
    expect(Math.abs(e.vx) + Math.abs(e.vy)).toBeGreaterThan(150);
    expect(e.x).toBeLessThan(900);
  });
  it('Tireur : reste à distance et tire après une télégraphie', () => {
    const { sim, e } = spawnOnly('gunner');
    let telegraphSeen = false, shot = false;
    for (let t = 0; t < 8; t += 1 / 60) {
      sim.update(1 / 60);
      if (e.telegraph > 0) telegraphSeen = true;
      for (const ev of sim.drainEvents()) if (ev.type === 'shot' && !ev.friendly) { shot = true; expect(telegraphSeen).toBe(true); }
    }
    expect(shot).toBe(true);
    expect(e.x).toBeGreaterThan(800);
  });
  it('Éclaireur : déplacement latéral', () => {
    const { sim, e } = spawnOnly('scout');
    let minY = Infinity, maxY = -Infinity;
    for (let t = 0; t < 6; t += 1 / 60) { sim.update(1 / 60); minY = Math.min(minY, e.y); maxY = Math.max(maxY, e.y); }
    expect(maxY - minY).toBeGreaterThan(200);
  });
  it('Blindé : lent et résistant', () => {
    const { sim, e } = spawnOnly('brute');
    run(sim, 2);
    const m = spawnOnly('marauder');
    expect(e.maxHp).toBeGreaterThan(m.e.maxHp * 5);
    expect(Math.hypot(e.vx, e.vy)).toBeLessThan(120);
  });
  it('Kamikaze : s\'amorce près du convoi puis explose', () => {
    const { sim, e } = spawnOnly('kamikaze', 700);
    let armed = false, boom = false;
    for (let t = 0; t < 6; t += 1 / 60) {
      sim.update(1 / 60);
      if (e.fuse > 0) armed = true;
      for (const ev of sim.drainEvents()) if (ev.type === 'explosion') boom = true;
    }
    expect(armed).toBe(true);
    expect(boom).toBe(true);
    expect(sim.damageTaken).toBeGreaterThan(0);
  });
  it('rencontre finale : le Béhémoth et ses renforts ; victoire seulement après sa destruction', () => {
    const sim = new DriveSim(cfg({ kind: 'final', biome: 'night', depth: 6, risk: 3 }));
    const types = new Set<EnemyType>();
    run(sim, 30, NO_INPUT, (ev) => { if (ev.type === 'spawn') types.add(ev.enemy); });
    expect(types.has('boss')).toBe(true);
    expect(types.size).toBeGreaterThanOrEqual(3);
    if (!sim.bossDefeated) expect(sim.outcome).not.toBe('cleared');
  });
});

describe('Biomes : un risque distinct chacun', () => {
  const kinds = (biome: Biome) => {
    const sim = new DriveSim(cfg({ biome, seed: 3 }));
    const seen = new Set<string>();
    let gust = false;
    for (let t = 0; t < 40 && !sim.done; t += 1 / 60) {
      sim.update(1 / 60);
      sim.obstacles.forEach((o) => seen.add(o.kind));
      for (const ev of sim.drainEvents()) if (ev.type === 'gust') gust = true;
    }
    return { seen, gust };
  };
  it('désert : rafales de sable', () => expect(kinds('desert').gust).toBe(true));
  it('industriel : barils explosifs', () => expect(kinds('industrial').seen.has('barrel')).toBe(true));
  it('nuit : mines', () => expect(kinds('night').seen.has('mine')).toBe(true));
});

describe('Expéditions complètes (pilote automatique)', () => {
  it('30 expéditions se terminent sans blocage ni ressource négative', () => {
    let wins = 0;
    for (let i = 0; i < 30; i++) {
      const r = autoplay(`E2E-${i}`);
      expect(r.outcome === 'victory' || r.outcome === 'defeat').toBe(true);
      for (const k of ['fuel', 'scrap', 'food'] as const) expect(r.res[k]).toBeGreaterThanOrEqual(0);
      expect(coinsEarned(r)).toBeGreaterThan(0);
      if (r.outcome === 'victory') wins++;
    }
    // issue atteignable même sans méta-progression, sans être triviale
    expect(wins).toBeGreaterThan(0);
    expect(wins).toBeLessThan(30);
  }, 60_000);
});
