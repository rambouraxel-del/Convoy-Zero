/** Joueur automatique pour tests d'équilibrage et de non-blocage. */
import { seedFromString } from '../../src/core/rng';
import type { MetaUpgradeId, RunState } from '../../src/core/types';
import { EVENTS_BY_ID } from '../../src/game/events';
import { reachable } from '../../src/game/mapgen';
import { fieldRepair, canAfford, completeStep, createRun, randomUpgradeChoices, grantUpgrade, buyUpgrade, repairCost, repairVehicle, resolveEventChoice, travelTo, VEHICLE_IDS } from '../../src/game/run';
import { DriveSim, type SegmentKind } from '../../src/game/sim/sim';
import { RUN_UPGRADES } from '../../src/game/upgrades';

export function driveSegment(run: RunState, kind: SegmentKind, salt: number, maxSeconds = 400): DriveSim {
  const node = run.map.nodes[run.currentId!];
  const sim = new DriveSim({ kind, biome: node.biome, depth: node.layer, risk: node.risk, seed: seedFromString(run.seed) ^ salt, run });
  let t = 0;
  while (!sim.done && t < maxSeconds) { sim.update(1 / 60); t += 1 / 60; }
  sim.writeBack(run);
  return sim;
}

export function autoplay(seed: string, meta: Partial<Record<MetaUpgradeId, number>> = {}): RunState {
  const run = createRun(seed, meta);
  let salt = 1;
  while (!run.outcome) {
    for (const id of VEHICLE_IDS) if (run.vehicles[id].hp / run.vehicles[id].maxHp < 0.75) fieldRepair(run, id);
    const opts = reachable(run.map, run.currentId);
    const cmd = run.vehicles.command;
    const hurt = cmd.hp / cmd.maxHp < 0.55;
    const pick = opts.find((id) => hurt && ['workshop', 'camp'].includes(run.map.nodes[id].type))
      ?? opts.find((id) => run.map.nodes[id].type === 'route') ?? opts[0];
    travelTo(run, pick);
    const node = run.map.nodes[pick];
    const sim = driveSegment(run, node.type === 'final' ? 'final' : node.type, salt++);
    if (sim.outcome !== 'cleared') { run.outcome = 'defeat'; run.defeatReason = node.type + '@' + node.layer; break; }
    completeStep(run);
    if (node.type === 'final') { run.outcome = 'victory'; break; }
    if (node.type === 'route') { const c = randomUpgradeChoices(run, 3); if (c[0]) grantUpgrade(run, c[0]); }
    if (node.type === 'event' && node.eventId) {
      const ev = EVENTS_BY_ID[node.eventId];
      const idx = ev.choices.findIndex((c) => canAfford(run, c.cost));
      const res = resolveEventChoice(run, node.eventId, Math.max(0, idx));
      if (res?.effect.ambush) {
        const s2 = driveSegment(run, 'ambush', salt++);
        if (s2.outcome !== 'cleared') { run.outcome = 'defeat'; break; }
      }
    }
    if (node.type === 'workshop' || node.type === 'camp') {
      for (const id of VEHICLE_IDS) if (repairCost(run, id) > 0) repairVehicle(run, id);
      if (node.type === 'workshop') for (const id of ['plating', 'calibrated', 'rapid', 'welder'] as const) if (run.res.scrap >= RUN_UPGRADES[id].cost + 10) buyUpgrade(run, id);
    }
  }
  return run;
}
