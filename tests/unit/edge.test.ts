import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import type { MapData, Resources, RunState } from '../../src/core/types';
import { EVENTS } from '../../src/game/events';
import { generateMap, reachable } from '../../src/game/mapgen';
import { migrate } from '../../src/game/save';
import {
  coinsEarned, createRun, isAtFinal, resolveEventChoice, travelTo, VEHICLE_IDS,
} from '../../src/game/run';
import { ALL_META_UPGRADES, META_MAX } from '../../src/game/upgrades';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ZERO: Resources = { fuel: 0, scrap: 0, food: 0 };

function zeroRun(seed: string): RunState {
  const run = createRun(seed, {});
  run.res = { ...ZERO };
  return run;
}

function expectRunInvariants(run: RunState) {
  for (const k of ['fuel', 'scrap', 'food'] as const) {
    expect(Number.isFinite(run.res[k])).toBe(true);
    expect(run.res[k]).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(run.res[k])).toBe(true);
  }
  for (const v of Object.values(run.vehicles)) {
    expect(v.hp).toBeLessThanOrEqual(v.maxHp);
    if (v.alive) expect(v.hp).toBeGreaterThanOrEqual(1);
    expect(Number.isFinite(v.hp)).toBe(true);
  }
}

/** Parcourt la carte depuis le départ ; retourne true si la finale est atteignable depuis `from`. */
function canReachFinal(map: MapData, from: string): boolean {
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === map.finalId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...map.nodes[id].next);
  }
  return false;
}

// Graines : vides, très longues, caractères spéciaux, noms réservés, Unicode, plus 480 graines numérotées.
const SPECIAL_SEEDS: string[] = [
  '',
  ' ',
  '\0',
  '\n\t\r',
  '"\'\\/<>&;`${}',
  '__proto__',
  'constructor',
  'hasOwnProperty',
  '🚗🔥☠',
  'ÉTÉ-ÀÇ-œ',
  '\uD800',
  'x'.repeat(10_000),
  'DUNE-'.repeat(2_000),
];
const SEEDS: string[] = [
  ...SPECIAL_SEEDS,
  ...Array.from({ length: 500 - SPECIAL_SEEDS.length }, (_, i) => `SEED-${i}`),
];

// ---------------------------------------------------------------------------
// 1. Génération de carte
// ---------------------------------------------------------------------------

describe('generateMap : cas limites de graines', () => {
  it('génère 500 cartes sans exception', () => {
    expect(SEEDS).toHaveLength(500);
    for (const seed of SEEDS) {
      expect(() => generateMap(seed)).not.toThrow();
    }
  });

  it('chaque nœud non final a au moins une sortie, valide, et la finale est atteignable depuis chaque départ', () => {
    for (const seed of SEEDS) {
      const map = generateMap(seed);
      expect(map.startIds.length).toBeGreaterThanOrEqual(2);
      for (const node of Object.values(map.nodes)) {
        if (node.id === map.finalId) {
          expect(node.next).toHaveLength(0);
          continue;
        }
        expect(node.next.length, `${seed.slice(0, 20)} / ${node.id}`).toBeGreaterThanOrEqual(1);
        for (const to of node.next) expect(map.nodes[to], `lien cassé ${node.id} -> ${to}`).toBeDefined();
      }
      for (const start of map.startIds) {
        expect(canReachFinal(map, start), `seed=${JSON.stringify(seed.slice(0, 20))} départ=${start}`).toBe(true);
      }
    }
  });

  it('garanties documentées : 2-3 nœuds par étape, atelier à l\'étape 3, camp ou atelier à l\'étape 5', () => {
    for (const seed of SEEDS) {
      const map = generateMap(seed);
      const layers = Array.from({ length: map.layers }, (_, L) =>
        Object.values(map.nodes).filter((n) => n.layer === L));
      for (let L = 0; L < map.layers; L++) {
        expect(layers[L].length).toBeGreaterThanOrEqual(2);
        expect(layers[L].length).toBeLessThanOrEqual(3);
      }
      expect(layers[3].some((n) => n.type === 'workshop'), `atelier étape 3 (${seed.slice(0, 20)})`).toBe(true);
      expect(layers[5].some((n) => n.type === 'camp' || n.type === 'workshop'), `camp/atelier étape 5 (${seed.slice(0, 20)})`).toBe(true);
    }
  });

  it('garantie documentée : les événements ne sont pas dupliqués dans une carte', () => {
    for (const seed of SEEDS) {
      const map = generateMap(seed);
      const ids = Object.values(map.nodes).filter((n) => n.type === 'event').map((n) => n.eventId);
      expect(ids.every((id) => typeof id === 'string')).toBe(true);
      expect(new Set(ids).size, `doublon d'événement (${seed.slice(0, 20)})`).toBe(ids.length);
    }
  });

  it('les nœuds de départ sont exactement ceux de l\'étape 0 et les nœuds accessibles sont cohérents', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const map = generateMap(seed);
      expect(reachable(map, null)).toEqual(map.startIds);
      for (const id of map.startIds) expect(map.nodes[id].layer).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Événements avec ressources à zéro
// ---------------------------------------------------------------------------

describe('événements : ressources à zéro', () => {
  for (const ev of EVENTS) {
    for (let c = 0; c < ev.choices.length; c++) {
      const choice = ev.choices[c];
      const paid = !!choice.cost && Object.values(choice.cost).some((v) => (v ?? 0) > 0);

      it(`${ev.id} / "${choice.label}" (${paid ? 'payant' : 'gratuit'})`, () => {
        const run = zeroRun(`EV-${ev.id}-${c}`);
        const before = JSON.stringify(run.res);
        const result = resolveEventChoice(run, ev.id, c);
        if (paid) {
          expect(result).toBeNull();
          expect(JSON.stringify(run.res)).toBe(before);
        } else {
          expect(result).not.toBeNull();
        }
        expectRunInvariants(run);
      });
    }
  }

  it('tous les événements ont au moins un choix gratuit (sinon le joueur peut être bloqué)', () => {
    for (const ev of EVENTS) {
      const free = ev.choices.some((c) => !c.cost || Object.values(c.cost).every((v) => (v ?? 0) === 0));
      expect(free, ev.id).toBe(true);
    }
  });

  it('rejette un index de choix hors bornes et un identifiant inconnu', () => {
    const run = createRun('OOB', {});
    expect(resolveEventChoice(run, EVENTS[0].id, 99)).toBeNull();
    expect(resolveEventChoice(run, EVENTS[0].id, -1)).toBeNull();
    expect(resolveEventChoice(run, 'inconnu', 0)).toBeNull();
  });

  it('tous les choix gratuits, sur de nombreuses graines, laissent les invariants intacts', () => {
    for (let i = 0; i < 40; i++) {
      for (const ev of EVENTS) {
        for (let c = 0; c < ev.choices.length; c++) {
          if (ev.choices[c].cost) continue;
          const run = zeroRun(`FREE-${i}-${ev.id}-${c}`);
          resolveEventChoice(run, ev.id, c);
          expectRunInvariants(run);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Expédition complète à ressources nulles
// ---------------------------------------------------------------------------

describe('expédition : ressources à zéro', () => {
  it('un parcours aléatoire jusqu\'à la finale ne fait jamais échouer travelTo', () => {
    const picker = new Rng(4242);
    for (let i = 0; i < 100; i++) {
      const run = zeroRun(`TRIP-${i}`);
      let steps = 0;
      while (!isAtFinal(run)) {
        const options = reachable(run.map, run.currentId);
        expect(options.length, `aucune sortie depuis ${run.currentId}`).toBeGreaterThan(0);
        const next = options[Math.floor(picker.next() * options.length)];
        expect(() => travelTo(run, next)).not.toThrow();
        expectRunInvariants(run);
        steps++;
        if (steps > run.map.layers + 2) throw new Error(`boucle détectée sur ${run.seed}`);
      }
      expect(steps).toBe(run.map.layers + 1);
    }
  });

  it('un départ à zéro force bien le secours (ferraille puis coque, jamais mortel)', () => {
    const run = zeroRun('RESCUE');
    const target = run.map.startIds[0];
    const rep = travelTo(run, target);
    expect(rep.fuelPaid).toBe(0);
    expect(rep.hunger).toBe(true);
    expect(run.vehicles.command.hp).toBeGreaterThanOrEqual(1);
  });

  it('refuse un nœud non accessible', () => {
    const run = zeroRun('NOPE');
    const notStart = Object.keys(run.map.nodes).find((id) => !run.map.startIds.includes(id) && id !== run.map.finalId)!;
    expect(() => travelTo(run, notStart)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 4. migrate() : entrées aléatoires
// ---------------------------------------------------------------------------

describe('migrate : fuzz de sauvegarde', () => {
  const KEYS = [
    'version', 'coins', 'meta', 'upgrades', 'volume', 'settings', 'profile', 'tutorialDone',
    'musicVolume', 'sfxVolume', 'muted', 'driveMode', 'showTutorial', 'screenShake',
    'runs', 'victories', 'bestSteps', 'totalKills', 'totalCoinsEarned', 'hull', 'guns', 'magnet', 'workshop',
  ];
  const SCALARS: unknown[] = [
    0, 1, 2, 3, 4, -1, -0, 0.5, 2.7, -2.7, 1e308, -1e308, Number.MAX_SAFE_INTEGER, 1e-300,
    NaN, Infinity, -Infinity, '', 'abc', '1', 'hold', 'toggle', true, false, null, undefined,
  ];

  function randomValue(r: Rng, depth: number): unknown {
    const k = r.int(0, depth > 2 ? 3 : 6);
    if (k === 0) return r.pick(SCALARS);
    if (k === 1) return r.range(-1e6, 1e6);
    if (k === 2) return Array.from({ length: r.int(0, 3) }, () => randomValue(r, depth + 1));
    if (k === 3) return r.pick(['a', '', 'coins', '🔥', 'x'.repeat(50)]);
    const obj: Record<string, unknown> = {};
    for (let i = r.int(0, 6); i > 0; i--) obj[r.pick(KEYS)] = randomValue(r, depth + 1);
    return obj;
  }

  it('retourne toujours une sauvegarde valide pour 200 entrées aléatoires', () => {
    const r = new Rng(20260613);
    for (let i = 0; i < 200; i++) {
      const raw = randomValue(r, 0);
      let out: ReturnType<typeof migrate>;
      expect(() => { out = migrate(raw); }, `entrée #${i}`).not.toThrow();
      out = migrate(raw);

      expect(Number.isInteger(out.coins), `coins #${i}`).toBe(true);
      expect(out.coins).toBeGreaterThanOrEqual(0);
      for (const k of ALL_META_UPGRADES) {
        const lv = out.meta[k];
        expect(Number.isInteger(lv), `meta.${k} #${i}`).toBe(true);
        expect(lv).toBeGreaterThanOrEqual(0);
        expect(lv).toBeLessThanOrEqual(META_MAX);
      }
      for (const v of [out.settings.musicVolume, out.settings.sfxVolume]) {
        expect(Number.isFinite(v), `volume #${i}`).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      expect(typeof out.settings.muted).toBe('boolean');
      expect(['toggle', 'hold']).toContain(out.settings.driveMode);
      for (const n of Object.values(out.profile)) {
        expect(Number.isFinite(n) && n >= 0, `profile #${i}`).toBe(true);
      }
      expect(typeof out.tutorialDone).toBe('boolean');
      expect(out.version).toBe(2);
    }
  });

  it('une sauvegarde déjà valide est stable (migrate(migrate(x)) === migrate(x))', () => {
    const r = new Rng(77);
    for (let i = 0; i < 50; i++) {
      const once = migrate(randomValue(r, 0));
      expect(migrate(JSON.parse(JSON.stringify(once)))).toEqual(once);
    }
  });

  it('cas explicites : null, tableau, chaîne, NaN, Infinity', () => {
    for (const raw of [null, undefined, [], 'x', 0, NaN, Infinity, true]) {
      const out = migrate(raw);
      expect(out.coins).toBe(0);
      expect(out.version).toBe(2);
    }
    const out = migrate({ coins: Infinity, meta: { hull: NaN, guns: Infinity, magnet: -5 }, settings: { musicVolume: 9 } });
    expect(out.coins).toBe(0);
    expect(out.meta.hull).toBe(0);
    expect(out.meta.guns).toBe(0);
    expect(out.meta.magnet).toBe(0);
    expect(out.settings.musicVolume).toBe(1); // 9 est borné à 1, pas remplacé par le défaut
  });
});

// ---------------------------------------------------------------------------
// 5. coinsEarned
// ---------------------------------------------------------------------------

describe('coinsEarned : jamais négatif ni NaN', () => {
  it('un run neuf donne une valeur finie positive ou nulle', () => {
    const run = createRun('COIN-0', {});
    const c = coinsEarned(run);
    expect(Number.isFinite(c)).toBe(true);
    expect(c).toBeGreaterThanOrEqual(0);
  });

  it('reste valide pendant des parcours aléatoires avec événements, déplacements et issues variées', () => {
    const r = new Rng(5150);
    for (let i = 0; i < 60; i++) {
      const run = createRun(`COIN-${i}`, {});
      run.res = { ...ZERO };
      for (let k = 0; k < 15; k++) {
        const options = reachable(run.map, run.currentId);
        if (options.length === 0) break;
        const to = options[r.int(0, options.length - 1)];
        travelTo(run, to);
        const node = run.map.nodes[to];
        if (node.eventId) resolveEventChoice(run, node.eventId, r.int(0, 2));
        run.stats.kills += r.int(0, 5);
        run.stats.stepsCleared += 1;
        const c = coinsEarned(run);
        expect(Number.isFinite(c)).toBe(true);
        expect(c).toBeGreaterThanOrEqual(0);
      }
      run.outcome = r.pick(['victory', 'defeat', null] as const);
      const c = coinsEarned(run);
      expect(Number.isNaN(c)).toBe(false);
      expect(c).toBeGreaterThanOrEqual(0);
    }
  });

  it('chaque véhicule vivant reste dans [1, maxHp] après l\'expédition à zéro', () => {
    const run = zeroRun('FINAL-HP');
    while (!isAtFinal(run)) travelTo(run, reachable(run.map, run.currentId)[0]);
    for (const id of VEHICLE_IDS) {
      const v = run.vehicles[id];
      if (v.alive) {
        expect(v.hp).toBeGreaterThanOrEqual(1);
        expect(v.hp).toBeLessThanOrEqual(v.maxHp);
      }
    }
  });
});
