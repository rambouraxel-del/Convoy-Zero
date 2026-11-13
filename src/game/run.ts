import {
  COINS, EMERGENCY_HULL_PER_FUEL, EMERGENCY_SCRAP_PER_FUEL, HUNGER_DAMAGE_PCT, REPAIR_SCRAP_PER_HP, START_RES, STEP_FOOD_COST,
} from '../config/balance';
import { Rng, seedFromString } from '../core/rng';
import type { MetaUpgradeId, Resources, RunState, RunUpgradeId, VehicleId } from '../core/types';
import { EVENTS_BY_ID, type EventChoice, type EventEffect } from './events';
import { generateMap, reachable } from './mapgen';
import { ALL_RUN_UPGRADES, canTakeUpgrade, fuelMultiplier, lvl, repairCostMultiplier, RUN_UPGRADES, vehicleStats } from './upgrades';

export const VEHICLE_IDS: VehicleId[] = ['command', 'escort', 'salvager'];

export function createRun(seed: string, meta: Partial<Record<MetaUpgradeId, number>>): RunState {
  const run: RunState = {
    seed,
    map: generateMap(seed),
    currentId: null,
    visited: [],
    res: {
      fuel: START_RES.fuel + 10 * lvl(meta, 'tanks'),
      scrap: START_RES.scrap + 5 * lvl(meta, 'workshop'),
      food: START_RES.food + 3 * lvl(meta, 'pantry'),
    },
    vehicles: {} as RunState['vehicles'],
    upgrades: {},
    meta: { ...meta },
    stats: { kills: 0, killsByType: {}, distance: 0, scrapCollected: 0, stepsCleared: 0, eventsSeen: 0, damageTaken: 0, timeMs: 0 },
    rngState: seedFromString(seed + '#events'),
    outcome: null,
    log: [],
  };
  for (const id of VEHICLE_IDS) {
    const hp = vehicleStats(id, run.upgrades, run.meta).maxHp;
    run.vehicles[id] = { id, hp, maxHp: hp, alive: true };
  }
  return run;
}

/** Applique une variation de ressources, jamais négative. Retourne la variation réellement appliquée. */
export function addRes(run: RunState, delta: Partial<Resources>): Partial<Resources> {
  const applied: Partial<Resources> = {};
  for (const k of Object.keys(delta) as (keyof Resources)[]) {
    const before = run.res[k];
    run.res[k] = Math.max(0, Math.round(before + (delta[k] ?? 0)));
    applied[k] = run.res[k] - before;
    if (k === 'scrap' && applied[k]! > 0) run.stats.scrapCollected += applied[k]!;
  }
  return applied;
}

export function canAfford(run: RunState, cost?: Partial<Resources>): boolean {
  if (!cost) return true;
  return (Object.keys(cost) as (keyof Resources)[]).every((k) => run.res[k] >= (cost[k] ?? 0));
}

export function pay(run: RunState, cost?: Partial<Resources>): boolean {
  if (!canAfford(run, cost)) return false;
  if (cost) for (const k of Object.keys(cost) as (keyof Resources)[]) run.res[k] -= cost[k] ?? 0;
  return true;
}

export function rngFor(run: RunState): Rng {
  return new Rng(run.rngState);
}
function rollRun<T>(run: RunState, fn: (r: Rng) => T): T {
  const r = new Rng(run.rngState);
  const out = fn(r);
  run.rngState = r.state;
  return out;
}

export function fuelCostFor(run: RunState, nodeId: string): number {
  return Math.max(1, Math.round(run.map.nodes[nodeId].fuelCost * fuelMultiplier(run.upgrades)));
}

export interface TravelReport {
  fuelPaid: number;
  emergencyScrap: number;
  emergencyHull: number;
  foodPaid: number;
  hunger: boolean;
}

/**
 * Départ vers un nœud. Règles de secours (aucun blocage possible) :
 * carburant manquant → payé en ferraille (2 par unité) puis en dégâts de coque non mortels ;
 * provisions épuisées → l'équipage affamé fait perdre 12 % PV à chaque véhicule (non mortel).
 */
export function travelTo(run: RunState, nodeId: string): TravelReport {
  if (!reachable(run.map, run.currentId).includes(nodeId)) throw new Error(`Nœud inaccessible: ${nodeId}`);
  const rep: TravelReport = { fuelPaid: 0, emergencyScrap: 0, emergencyHull: 0, foodPaid: 0, hunger: false };
  let need = fuelCostFor(run, nodeId);
  rep.fuelPaid = Math.min(run.res.fuel, need);
  run.res.fuel -= rep.fuelPaid;
  need -= rep.fuelPaid;
  if (need > 0) {
    const scrapUnits = Math.min(need, Math.floor(run.res.scrap / EMERGENCY_SCRAP_PER_FUEL));
    rep.emergencyScrap = scrapUnits * EMERGENCY_SCRAP_PER_FUEL;
    run.res.scrap -= rep.emergencyScrap;
    need -= scrapUnits;
  }
  if (need > 0) {
    rep.emergencyHull = need * EMERGENCY_HULL_PER_FUEL;
    const c = run.vehicles.command;
    c.hp = Math.max(1, c.hp - rep.emergencyHull);
  }
  const skipFood = lvl(run.upgrades, 'rations') > 0 && run.visited.length % 2 === 1;
  const foodNeed = skipFood ? 0 : STEP_FOOD_COST;
  if (run.res.food >= foodNeed) {
    run.res.food -= foodNeed;
    rep.foodPaid = foodNeed;
  } else {
    rep.hunger = true;
    for (const v of Object.values(run.vehicles)) if (v.alive) v.hp = Math.max(1, Math.round(v.hp - v.maxHp * HUNGER_DAMAGE_PCT));
  }
  run.currentId = nodeId;
  run.visited.push(nodeId);
  return rep;
}

/** Fin d'un segment de conduite réussi. */
export function completeStep(run: RunState) {
  run.stats.stepsCleared += 1;
}

export function healPct(run: RunState, target: 'all' | 'command' | 'escorts', pct: number) {
  for (const v of Object.values(run.vehicles)) {
    if (!v.alive) continue;
    if (target === 'command' && v.id !== 'command') continue;
    if (target === 'escorts' && v.id === 'command') continue;
    const delta = Math.round(v.maxHp * pct);
    // les dégâts d'événement ne détruisent jamais un véhicule (minimum 1 PV)
    v.hp = Math.min(v.maxHp, Math.max(1, v.hp + delta));
  }
}

export function randomUpgradeChoices(run: RunState, n: number): RunUpgradeId[] {
  const pool = ALL_RUN_UPGRADES.filter((id) => canTakeUpgrade(run.upgrades, id));
  return rollRun(run, (r) => r.shuffle([...pool]).slice(0, n));
}

/** Applique une amélioration de run ; met à jour les PV max immédiatement. */
export function grantUpgrade(run: RunState, id: RunUpgradeId): boolean {
  if (!canTakeUpgrade(run.upgrades, id)) return false;
  run.upgrades[id] = lvl(run.upgrades, id) + 1;
  for (const v of Object.values(run.vehicles)) {
    const newMax = vehicleStats(v.id, run.upgrades, run.meta).maxHp;
    if (newMax > v.maxHp && v.alive) v.hp += newMax - v.maxHp;
    v.maxHp = newMax;
  }
  run.log.push(`Amélioration : ${RUN_UPGRADES[id].name}`);
  return true;
}

export function buyUpgrade(run: RunState, id: RunUpgradeId): boolean {
  if (!canTakeUpgrade(run.upgrades, id)) return false;
  if (!pay(run, { scrap: RUN_UPGRADES[id].cost })) return false;
  return grantUpgrade(run, id);
}

/** Réparation de fortune, disponible entre deux étapes : 2 PV par ferraille (atelier : 4 PV). */
export const FIELD_HP_PER_SCRAP = 2;
export function fieldRepairCost(run: RunState, id: VehicleId): number {
  const v = run.vehicles[id];
  if (!v.alive) return 0;
  return Math.ceil(((v.maxHp - v.hp) / FIELD_HP_PER_SCRAP) * repairCostMultiplier(run.meta));
}
/** Répare autant que la ferraille le permet. Retourne les PV rendus. */
export function fieldRepair(run: RunState, id: VehicleId): number {
  const v = run.vehicles[id];
  if (!v.alive || v.hp >= v.maxHp) return 0;
  const perScrap = FIELD_HP_PER_SCRAP / repairCostMultiplier(run.meta);
  const scrapNeeded = Math.ceil((v.maxHp - v.hp) / perScrap);
  const spend = Math.min(scrapNeeded, run.res.scrap);
  if (spend <= 0) return 0;
  run.res.scrap -= spend;
  const before = v.hp;
  v.hp = Math.min(v.maxHp, Math.round(v.hp + spend * perScrap));
  return v.hp - before;
}

export function repairCost(run: RunState, id: VehicleId): number {
  const v = run.vehicles[id];
  if (!v.alive) return Math.ceil(v.maxHp * 0.5 * REPAIR_SCRAP_PER_HP * repairCostMultiplier(run.meta) + 8);
  return Math.ceil((v.maxHp - v.hp) * REPAIR_SCRAP_PER_HP * repairCostMultiplier(run.meta));
}

/** Répare (ou remet en route à 50 % un véhicule d'escorte détruit). */
export function repairVehicle(run: RunState, id: VehicleId): boolean {
  const cost = repairCost(run, id);
  const v = run.vehicles[id];
  if (cost <= 0 || !pay(run, { scrap: cost })) return false;
  if (!v.alive) {
    v.alive = true;
    v.hp = Math.round(v.maxHp * 0.5);
  } else v.hp = v.maxHp;
  return true;
}

export interface ChoiceResult { effect: EventEffect; gainedUpgrade?: RunUpgradeId; applied: Partial<Resources> }

export function resolveEventChoice(run: RunState, eventId: string, choiceIdx: number): ChoiceResult | null {
  const ev = EVENTS_BY_ID[eventId];
  const choice: EventChoice | undefined = ev?.choices[choiceIdx];
  if (!choice || !pay(run, choice.cost)) return null;
  const roll = rollRun(run, (r) => r.next());
  let acc = 0;
  let effect = choice.outcomes[choice.outcomes.length - 1].effect;
  for (const o of choice.outcomes) {
    acc += o.p;
    if (roll < acc) { effect = o.effect; break; }
  }
  const applied = effect.res ? addRes(run, effect.res) : {};
  if (effect.hpPct) healPct(run, effect.hpPct.target, effect.hpPct.pct);
  let gainedUpgrade: RunUpgradeId | undefined;
  if (effect.upgrade) {
    const id = effect.upgrade === 'random' ? randomUpgradeChoices(run, 1)[0] : effect.upgrade;
    if (id && grantUpgrade(run, id)) gainedUpgrade = id;
  }
  run.stats.eventsSeen += 1;
  return { effect, gainedUpgrade, applied };
}

export function coinsEarned(run: RunState): number {
  const s = run.stats;
  const base = s.stepsCleared * COINS.perStep + s.kills * COINS.perKill + run.res.scrap * COINS.perScrapLeft;
  return Math.round(base + (run.outcome === 'victory' ? COINS.victory : 0));
}

export function isAtFinal(run: RunState): boolean {
  return run.currentId === run.map.finalId;
}
