import { describe, expect, it } from 'vitest';
import { DriveSim, NO_INPUT, SIM_DT } from '../../src/game/sim/sim';

const base = { kind: 'demo' as const, biome: 'desert' as const, depth: 0, risk: 1, seed: 5 };
function quiet(sim: DriveSim) {
  const s = sim as any;
  s.spawnTimer = 1e9; s.obstacleTimer = 1e9; s.crateTimer = 1e9;
}
function shieldRun(): any {
  return {
    upgrades: { shockShield: 1 }, meta: {},
    vehicles: { command: { hp: 160, maxHp: 160, alive: true }, escort: { hp: 80, maxHp: 80, alive: true }, salvager: { hp: 95, maxHp: 95, alive: true } },
    stats: {},
  };
}

describe('corrections de simulation', () => {
  it('le boss final n\'apparaît qu\'une fois et la fin de segment survient sans boss vivant', () => {
    const sim = new DriveSim({ kind: 'final', biome: 'desert', depth: 3, risk: 2, seed: 21 });
    for (const v of sim.vehicles) v.cooldown = 1e9;
    let spawns = 0;
    while (!sim.boss) sim.step(SIM_DT, NO_INPUT);
    spawns += sim.drainEvents().filter((e) => e.type === 'bossSpawn').length;
    const first = sim.boss!;
    sim.damageEnemy(first, 1e9, first.x, first.y);
    for (let i = 0; i < 60 * 8 && !sim.done; i++) {
      sim.step(SIM_DT, NO_INPUT);
      spawns += sim.drainEvents().filter((e) => e.type === 'bossSpawn').length;
    }
    expect(spawns).toBe(1);
    expect(sim.boss).toBeNull();
    expect(sim.enemies.some((e) => e.type === 'boss' && !e.dead)).toBe(false);
    expect(sim.outcome).toBe('cleared');
  });

  it('même distance parcourue après 10 s simulées à 30/60/120/144/240 Hz', () => {
    const dist: number[] = [];
    for (const hz of [30, 60, 120, 144, 240]) {
      const sim = new DriveSim({ ...base, kind: 'route', lengthOverride: 1e9 });
      for (let i = 0; i < hz * 10; i++) sim.update(1 / hz, NO_INPUT);
      dist.push(sim.distance);
      expect(Math.abs(sim.time - 10)).toBeLessThan(SIM_DT * 1.5);
    }
    const ref = dist[1];
    for (const d of dist) expect(Math.abs(d - ref)).toBeLessThan(sim60Step() * 1.5);
  });

  it('update(1/60) fait exactement un pas', () => {
    const sim = new DriveSim({ ...base, kind: 'route', lengthOverride: 1e9 });
    for (let i = 1; i <= 100; i++) { sim.update(1 / 60, NO_INPUT); expect(sim.time).toBeCloseTo(i / 60, 9); }
  });

  it('un kamikaze qui explose seul ne compte pas comme kill et ne lâche rien', () => {
    const sim = new DriveSim(base);
    quiet(sim);
    const c = sim.command;
    const k = sim.spawnEnemy('kamikaze', c.x + 40, c.y);
    k.fuse = 0.001;
    for (const v of sim.vehicles) v.cooldown = 1e9;
    const hp = c.hp;
    sim.step(SIM_DT, NO_INPUT);
    expect(sim.enemies.includes(k)).toBe(false);
    expect(sim.kills).toBe(0);
    expect(sim.killsByType).toEqual({});
    expect(sim.pickups.filter((p) => p.kind === 'scrap').length).toBe(0);
    expect(c.hp).toBeLessThan(hp); // l'explosion télégraphiée touche malgré tout
  });

  it('les ennemis tués par le souffle d\'un kamikaze ennemi ne donnent ni kill ni butin', () => {
    const sim = new DriveSim(base);
    quiet(sim);
    for (const v of sim.vehicles) v.cooldown = 1e9;
    const c = sim.command;
    const k = sim.spawnEnemy('kamikaze', c.x + 60, c.y);
    const m = sim.spawnEnemy('marauder', c.x + 60, c.y + 10);
    m.hp = 1;
    k.fuse = 0.001;
    sim.step(SIM_DT, NO_INPUT);
    expect(m.dead).toBe(true);
    expect(sim.kills).toBe(0);
    expect(sim.pickups.filter((p) => p.kind === 'scrap').length).toBe(0);
  });

  it('le butin de ferraille total est exactement n', () => {
    for (const t of ['brute', 'boss', 'marauder'] as const) {
      for (let seed = 1; seed <= 40; seed++) {
        const sim = new DriveSim({ ...base, seed });
        quiet(sim);
        const e = sim.spawnEnemy(t, 1000, 100);
        sim.damageEnemy(e, 1e9, e.x, e.y);
        const total = sim.pickups.filter((p) => p.kind === 'scrap').reduce((a, p) => a + p.amount, 0);
        expect(Number.isInteger(total)).toBe(true);
        const max = Math.round(({ brute: 9, boss: 40, marauder: 2 } as const)[t] * 1.3);
        expect(total).toBeLessThanOrEqual(max);
        expect(total).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('les ennemis en fuite sont retirés en moins de 30 s', () => {
    const sim = new DriveSim(base);
    quiet(sim);
    for (const v of sim.vehicles) v.cooldown = 1e9;
    const s = sim.spawnEnemy('scout', 900, 360); s.t = 16;
    const g = sim.spawnEnemy('gunner', 900, 200); g.t = 23;
    const m = sim.spawnEnemy('marauder', 300, 500); m.t = 15; m.state = 'leave';
    for (let i = 0; i < 60 * 30; i++) {
      sim.step(SIM_DT, NO_INPUT);
      sim.vehicles.forEach((v) => { v.hp = v.maxHp; });
    }
    expect(sim.enemies.includes(s)).toBe(false);
    expect(sim.enemies.includes(g)).toBe(false);
    expect(sim.enemies.includes(m)).toBe(false);
  });

  it('le bouclier de choc absorbe et protège les impacts consécutifs (0,35 s)', () => {
    const sim = new DriveSim({ ...base, run: shieldRun() });
    const c = sim.command; const hp0 = c.hp;
    sim.damageVehicle(c, 30, false, 'contact:brute');
    expect(c.hp).toBe(hp0);
    expect(c.invuln).toBeCloseTo(0.35, 5);
    sim.damageVehicle(c, 30, false, 'contact:brute');
    expect(c.hp).toBe(hp0);
  });

  it('les explosions respectent l\'invulnérabilité, sauf le kamikaze', () => {
    const sim = new DriveSim(base);
    quiet(sim);
    const c = sim.command;
    c.invuln = 0.3;
    const hp = c.hp;
    (sim as any).explode(c.x, c.y, 80, 24, true);
    expect(c.hp).toBe(hp);
    (sim as any).explode(c.x, c.y, 80, 24, true, false, true);
    expect(c.hp).toBeLessThan(hp);
  });

  it('progress reste défini avec une longueur nulle', () => {
    const sim = new DriveSim({ ...base, kind: 'route', lengthOverride: 0 });
    expect(sim.progress).toBe(1);
  });
});

function sim60Step() { return 230 * SIM_DT; }
