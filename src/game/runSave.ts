/**
 * Sauvegarde d'expédition en cours (reprise). Distincte de la progression permanente (save.ts).
 *
 * Schéma versionné (v1) : { version, savedAt, phase, run (sans `map`), post?, driveSalt }.
 * La carte n'est JAMAIS lue depuis le stockage : elle est régénérée depuis la graine (generateMap) ;
 * toutes les références du run (currentId, visited) sont validées contre cette carte.
 * Toute donnée absente / corrompue / incohérente donne `null`, jamais d'exception.
 *
 * Phases :
 *  - 'map'   : écran de carte (aucune conduite en cours).
 *  - 'drive' : juste après travelTo ; la reprise relance le segment depuis le début (carburant déjà payé).
 *  - 'post'  : écran d'arrivée (event / reward / workshop / camp) ; `post` conserve son état.
 */
import type { MetaUpgradeId, ResourceKey, RunState, RunUpgradeId, VehicleId } from '../core/types';
import { generateMap } from './mapgen';
import type { StorageLike } from './save';
import { ALL_META_UPGRADES, ALL_RUN_UPGRADES, META_MAX, RUN_UPGRADES } from './upgrades';

export const RUN_SAVE_KEY = 'convoy-zero.run';
export const RUN_SAVE_VERSION = 1;

export type RunPhase = 'map' | 'drive' | 'post';

export interface PostState {
  eventResult: { text: string; ambush: boolean } | null;
  rewardOffers: RunUpgradeId[];
  workshopOffers: RunUpgradeId[];
  campUsed: string[];
}

export interface RunSave {
  version: number;
  savedAt: number;
  phase: RunPhase;
  run: RunState;
  post: PostState;
  driveSalt: number;
}

export function emptyPost(): PostState {
  return { eventResult: null, rewardOffers: [], workshopOffers: [], campUsed: [] };
}

/** Sérialise (la carte est omise : elle se régénère depuis la graine). */
export function serializeRun(run: RunState, phase: RunPhase, post: PostState = emptyPost(), driveSalt = 0, now = Date.now()): string {
  const { map: _map, ...rest } = run;
  return JSON.stringify({ version: RUN_SAVE_VERSION, savedAt: now, phase, run: rest, post, driveSalt });
}

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isNat = (v: unknown): v is number => isNum(v) && v >= 0;
const isInt = (v: unknown): v is number => isNat(v) && Number.isInteger(v);
const isStrArr = (v: unknown, max = 200): v is string[] => Array.isArray(v) && v.length <= max && v.every((x) => typeof x === 'string');

function validUpgradeIds(v: unknown): v is RunUpgradeId[] {
  return Array.isArray(v) && v.length <= 8 && v.every((x) => typeof x === 'string' && (ALL_RUN_UPGRADES as string[]).includes(x));
}

/** Valide un objet brut et reconstruit un RunState complet, ou null. */
export function parseRun(text: string): RunSave | null {
  try {
    const o = JSON.parse(text);
    if (!isObj(o) || o.version !== RUN_SAVE_VERSION) return null;
    if (!isNum(o.savedAt)) return null;
    if (o.phase !== 'map' && o.phase !== 'drive' && o.phase !== 'post') return null;
    const r = o.run;
    if (!isObj(r) || typeof r.seed !== 'string' || !r.seed || r.seed.length > 32) return null;
    const map = generateMap(r.seed);

    // position et trajet : doivent être un chemin valide dans la carte régénérée
    if (!Array.isArray(r.visited) || r.visited.length > map.layers + 1 || !r.visited.every((x: unknown) => typeof x === 'string')) return null;
    const visited: string[] = r.visited;
    let prev: string | null = null;
    for (const id of visited) {
      const n = map.nodes[id];
      if (!n) return null;
      if (prev === null ? !map.startIds.includes(id) : !map.nodes[prev].next.includes(id)) return null;
      prev = id;
    }
    if (r.currentId !== prev) return null; // null ↔ visited vide, sinon dernier nœud visité
    if (o.phase !== 'map' && prev === null) return null;

    // ressources
    if (!isObj(r.res)) return null;
    const res = {} as Record<ResourceKey, number>;
    for (const k of ['fuel', 'scrap', 'food'] as ResourceKey[]) {
      if (!isNat(r.res[k]) || r.res[k] > 1e6) return null;
      res[k] = r.res[k];
    }

    // véhicules
    if (!isObj(r.vehicles)) return null;
    const vehicles = {} as RunState['vehicles'];
    for (const id of ['command', 'escort', 'salvager'] as VehicleId[]) {
      const v = r.vehicles[id];
      if (!isObj(v) || v.id !== id || typeof v.alive !== 'boolean') return null;
      if (!isNat(v.hp) || !isNum(v.maxHp) || v.maxHp <= 0 || v.maxHp > 1e5 || v.hp > v.maxHp + 1e-6) return null;
      vehicles[id] = { id, hp: v.hp, maxHp: v.maxHp, alive: v.alive };
    }
    if (!vehicles.command.alive) return null; // une expédition perdue ne se reprend pas

    // améliorations de run et permanentes
    if (!isObj(r.upgrades) || !isObj(r.meta)) return null;
    const upgrades: RunState['upgrades'] = {};
    for (const [k, l] of Object.entries(r.upgrades)) {
      if (!(ALL_RUN_UPGRADES as string[]).includes(k) || !isInt(l) || l > RUN_UPGRADES[k as RunUpgradeId].maxLevel) return null;
      if (l > 0) upgrades[k as RunUpgradeId] = l;
    }
    const meta: RunState['meta'] = {};
    for (const [k, l] of Object.entries(r.meta)) {
      if (!(ALL_META_UPGRADES as string[]).includes(k) || !isInt(l) || l > META_MAX) return null;
      meta[k as MetaUpgradeId] = l;
    }

    // statistiques
    const s = r.stats;
    if (!isObj(s) || !isObj(s.killsByType)) return null;
    for (const k of ['kills', 'distance', 'scrapCollected', 'stepsCleared', 'eventsSeen', 'damageTaken', 'timeMs']) if (!isNat(s[k])) return null;
    const killsByType: RunState['stats']['killsByType'] = {};
    for (const [k, n] of Object.entries(s.killsByType)) {
      if (!isInt(n)) return null;
      (killsByType as Record<string, number>)[k] = n;
    }
    if (!isNum(r.rngState) || r.outcome !== null || !isStrArr(r.log)) return null;

    const run: RunState = {
      seed: r.seed, map, currentId: r.currentId, visited: [...visited], res, vehicles, upgrades, meta,
      stats: {
        kills: s.kills, killsByType, distance: s.distance, scrapCollected: s.scrapCollected, stepsCleared: s.stepsCleared,
        eventsSeen: s.eventsSeen, damageTaken: s.damageTaken, timeMs: s.timeMs,
      },
      rngState: r.rngState, outcome: null, log: r.log.slice(-200),
    };

    // état de l'écran d'arrivée
    const p = o.post;
    if (!isObj(p)) return null;
    const ev = p.eventResult;
    if (ev !== null && !(isObj(ev) && typeof ev.text === 'string' && ev.text.length < 1000 && typeof ev.ambush === 'boolean')) return null;
    if (!validUpgradeIds(p.rewardOffers) || !validUpgradeIds(p.workshopOffers)) return null;
    if (!isStrArr(p.campUsed, 4) || !p.campUsed.every((x: string) => x === 'rest' || x === 'scav')) return null;
    const post: PostState = {
      eventResult: ev === null ? null : { text: ev.text, ambush: ev.ambush },
      rewardOffers: p.rewardOffers, workshopOffers: p.workshopOffers, campUsed: p.campUsed,
    };
    if (o.phase === 'post') {
      const t = map.nodes[run.currentId!].type;
      if (t === 'final') return null; // la finale n'a pas d'écran d'arrivée
      if (t === 'route' && post.rewardOffers.length === 0) return null;
      if (t === 'event' && !map.nodes[run.currentId!].eventId) return null;
    }
    if (!isInt(o.driveSalt) || o.driveSalt > 1e6) return null;
    return { version: RUN_SAVE_VERSION, savedAt: o.savedAt, phase: o.phase, run, post, driveSalt: o.driveSalt };
  } catch {
    return null;
  }
}

export function loadRun(storage: StorageLike | null): RunSave | null {
  if (!storage) return null;
  try {
    const txt = storage.getItem(RUN_SAVE_KEY);
    return txt ? parseRun(txt) : null;
  } catch {
    return null;
  }
}

export function writeRun(storage: StorageLike | null, run: RunState, phase: RunPhase, post: PostState = emptyPost(), driveSalt = 0): boolean {
  if (!storage || run.outcome) return false;
  try {
    storage.setItem(RUN_SAVE_KEY, serializeRun(run, phase, post, driveSalt));
    return true;
  } catch {
    return false;
  }
}

export function clearRun(storage: StorageLike | null): void {
  if (!storage) return;
  try { storage.removeItem(RUN_SAVE_KEY); } catch { /* ignore */ }
}
