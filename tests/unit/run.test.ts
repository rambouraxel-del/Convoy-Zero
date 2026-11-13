import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import type { RunUpgradeId } from '../../src/core/types';
import { EVENTS } from '../../src/game/events';
import { reachable } from '../../src/game/mapgen';
import {
  addRes, buyUpgrade, coinsEarned, createRun, fieldRepair, grantUpgrade, repairVehicle, resolveEventChoice, travelTo, VEHICLE_IDS,
} from '../../src/game/run';
import { ALL_RUN_UPGRADES, fuelMultiplier, META_UPGRADES, RUN_UPGRADES, vehicleStats } from '../../src/game/upgrades';

const nonNeg = (r: ReturnType<typeof createRun>) => {
  for (const k of ['fuel', 'scrap', 'food'] as const) {
    expect(r.res[k]).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(r.res[k])).toBe(true);
  }
};

describe('Ressources', () => {
  it('ne deviennent jamais négatives', () => {
    const run = createRun('X', {});
    addRes(run, { fuel: -999, scrap: -5, food: -1e9 });
    nonNeg(run);
    expect(run.res.fuel).toBe(0);
  });
  it('fuzz : opérations aléatoires sans valeurs négatives', () => {
    const r = new Rng(9);
    for (let i = 0; i < 40; i++) {
      const run = createRun(`F${i}`, {});
      for (let k = 0; k < 60; k++) {
        const op = r.int(0, 3);
        if (op === 0) addRes(run, { fuel: r.int(-30, 30), scrap: r.int(-30, 30), food: r.int(-5, 5) });
        if (op === 1) buyUpgrade(run, r.pick(ALL_RUN_UPGRADES));
        if (op === 2) repairVehicle(run, r.pick(VEHICLE_IDS));
        if (op === 3) resolveEventChoice(run, r.pick(EVENTS).id, r.int(0, 3));
        nonNeg(run);
        for (const v of Object.values(run.vehicles)) expect(v.hp).toBeLessThanOrEqual(v.maxHp);
      }
    }
  });
});

describe('Voyage et règles de secours', () => {
  it('consomme carburant et provisions', () => {
    const run = createRun('T', {});
    const id = reachable(run.map, null)[0];
    const f0 = run.res.fuel, food0 = run.res.food;
    const rep = travelTo(run, id);
    expect(run.res.fuel).toBe(f0 - rep.fuelPaid);
    expect(run.res.food).toBe(food0 - 2);
    expect(run.currentId).toBe(id);
  });
  it('refuse un nœud inaccessible', () => {
    const run = createRun('T', {});
    expect(() => travelTo(run, run.map.finalId)).toThrow();
  });
  it('panne sèche : ferraille puis coque, jamais mortel ; famine non mortelle', () => {
    const run = createRun('DRY', {});
    run.res = { fuel: 0, scrap: 3, food: 0 };
    run.vehicles.command.hp = 5;
    let cur: string | null = null;
    for (let i = 0; i <= run.map.layers; i++) {
      const id = reachable(run.map, cur)[0];
      const rep = travelTo(run, id);
      cur = id;
      nonNeg(run);
      expect(run.vehicles.command.hp).toBeGreaterThanOrEqual(1);
      if (i === 0) { expect(rep.emergencyScrap).toBe(2); expect(rep.emergencyHull).toBeGreaterThan(0); expect(rep.hunger).toBe(true); }
    }
    expect(run.currentId).toBe(run.map.finalId); // la progression n'est jamais bloquée
  });
});

describe('Améliorations de run (12+ distinctes, effet observable)', () => {
  it('au moins 12 améliorations', () => expect(ALL_RUN_UPGRADES.length).toBeGreaterThanOrEqual(12));
  const base = { command: vehicleStats('command', {}, {}), escort: vehicleStats('escort', {}, {}), salvager: vehicleStats('salvager', {}, {}) };
  const statChanged = (id: RunUpgradeId) => {
    const u = { [id]: 1 };
    return (['command', 'escort', 'salvager'] as const).some((v) => JSON.stringify(vehicleStats(v, u, {})) !== JSON.stringify(base[v]));
  };
  it.each(ALL_RUN_UPGRADES)('%s modifie le jeu', (id) => {
    if (id === 'injectors') expect(fuelMultiplier({ injectors: 1 })).toBeLessThan(1);
    else if (id === 'shockShield' || id === 'rations') expect(RUN_UPGRADES[id].maxLevel).toBe(1); // testés dans sim.test / ci-dessous
    else expect(statChanged(id)).toBe(true);
  });
  it('blindage : PV max et PV actuels augmentent immédiatement', () => {
    const run = createRun('U', {});
    const before = run.vehicles.command.maxHp;
    grantUpgrade(run, 'plating');
    expect(run.vehicles.command.maxHp).toBeGreaterThan(before);
    expect(run.vehicles.command.hp).toBe(run.vehicles.command.maxHp);
  });
  it('rations : une étape sur deux sans provisions', () => {
    const run = createRun('R', {});
    grantUpgrade(run, 'rations');
    let cur: string | null = null;
    const used: number[] = [];
    for (let i = 0; i < 4; i++) { const id = reachable(run.map, cur)[0]; const rep = travelTo(run, id); used.push(rep.foodPaid); cur = id; }
    expect(used).toEqual([2, 0, 2, 0]);
  });
  it('niveau max respecté et achat payant', () => {
    const run = createRun('M', {});
    run.res.scrap = 1000;
    for (let i = 0; i < 10; i++) buyUpgrade(run, 'apRounds');
    expect(run.upgrades.apRounds).toBe(1);
    expect(run.res.scrap).toBe(1000 - RUN_UPGRADES.apRounds.cost);
  });
});

describe('Réparations', () => {
  it('réparation de terrain limitée par la ferraille', () => {
    const run = createRun('Rep', {});
    run.vehicles.command.hp = 10;
    run.res.scrap = 5;
    const hp = fieldRepair(run, 'command');
    expect(hp).toBe(10);
    expect(run.res.scrap).toBe(0);
  });
  it('remise en route d\'une escorte détruite à l\'atelier', () => {
    const run = createRun('Rev', {});
    run.vehicles.escort.alive = false;
    run.vehicles.escort.hp = 0;
    run.res.scrap = 100;
    expect(repairVehicle(run, 'escort')).toBe(true);
    expect(run.vehicles.escort.alive).toBe(true);
    expect(run.vehicles.escort.hp).toBe(Math.round(run.vehicles.escort.maxHp * 0.5));
  });
});

describe('Événements', () => {
  it('le coût est exigé et le résultat est déterministe pour une graine', () => {
    const a = createRun('EV', {}), b = createRun('EV', {});
    const ra = resolveEventChoice(a, 'station', 0), rb = resolveEventChoice(b, 'station', 0);
    expect(ra?.effect.text).toBe(rb?.effect.text);
    const c = createRun('EV', {});
    c.res.food = 0;
    expect(resolveEventChoice(c, 'station', 1)).toBeNull(); // pompe manuelle : 2 provisions
  });
  it('fréquences observées proches des probabilités annoncées', () => {
    let fails = 0;
    for (let i = 0; i < 2000; i++) {
      const run = createRun(`P${i}`, {});
      const r = resolveEventChoice(run, 'minefield', 1)!; // 65 % / 35 %
      if (r.effect.hpPct) fails++;
    }
    expect(fails / 2000).toBeGreaterThan(0.3);
    expect(fails / 2000).toBeLessThan(0.4);
  });
});

describe('Méta-progression', () => {
  it('6 améliorations permanentes ; impossible de tout acheter après une partie', () => {
    expect(Object.keys(META_UPGRADES)).toHaveLength(6);
    const total = Object.values(META_UPGRADES).reduce((a, m) => a + m.costs.reduce((x, y) => x + y, 0), 0);
    const run = createRun('C', {});
    run.stats.stepsCleared = 7; run.stats.kills = 200; run.res.scrap = 300; run.outcome = 'victory';
    expect(coinsEarned(run)).toBeLessThan(total / 3);
  });
  it('les améliorations permanentes modifient le départ', () => {
    const r0 = createRun('S', {});
    const r1 = createRun('S', { hull: 2, tanks: 1, pantry: 1, workshop: 1 });
    expect(r1.vehicles.command.maxHp).toBeGreaterThan(r0.vehicles.command.maxHp);
    expect(r1.res.fuel).toBe(r0.res.fuel + 10);
    expect(r1.res.food).toBe(r0.res.food + 3);
    expect(r1.res.scrap).toBe(r0.res.scrap + 5);
  });
});
