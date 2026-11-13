import { describe, expect, it } from 'vitest';
import { Rng, seedFromString } from '../../src/core/rng';
import { EVENTS } from '../../src/game/events';
import { biomeForLayer, generateMap, MAP_LAYERS, reachable } from '../../src/game/mapgen';

describe('Rng', () => {
  it('est reproductible', () => {
    const a = new Rng(42), b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
  it('reste dans les bornes', () => {
    const r = new Rng(1);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
    }
  });
  it('hache les graines textuelles de façon stable', () => {
    expect(seedFromString('DUNE-42')).toBe(seedFromString('DUNE-42'));
    expect(seedFromString('DUNE-42')).not.toBe(seedFromString('DUNE-43'));
  });
});

describe('Carte procédurale', () => {
  it('est identique pour une même graine', () => {
    expect(JSON.stringify(generateMap('ABCD-123'))).toBe(JSON.stringify(generateMap('ABCD-123')));
  });
  it('diffère selon la graine', () => {
    const maps = new Set(['A', 'B', 'C', 'D', 'E'].map((s) => JSON.stringify(generateMap(s).nodes)));
    expect(maps.size).toBeGreaterThan(1);
  });
  it.each(Array.from({ length: 60 }, (_, i) => `SEED-${i}`))('respecte les garanties structurelles (%s)', (seed) => {
    const m = generateMap(seed);
    const nodes = Object.values(m.nodes);
    expect(m.layers).toBe(MAP_LAYERS);
    expect(MAP_LAYERS).toBeGreaterThanOrEqual(5);
    expect(MAP_LAYERS).toBeLessThanOrEqual(7);
    for (let L = 0; L < MAP_LAYERS; L++) {
      const layer = nodes.filter((n) => n.layer === L);
      expect(layer.length).toBeGreaterThanOrEqual(2);
      expect(layer.length).toBeLessThanOrEqual(3);
      for (const n of layer) {
        expect(n.next.length).toBeGreaterThan(0); // aucune impasse
        expect(n.biome).toBe(biomeForLayer(L));
        for (const t of n.next) expect(m.nodes[t].layer).toBe(L + 1);
      }
    }
    // chaque nœud est atteignable depuis le départ, et la finale depuis tout nœud
    const seen = new Set<string>();
    const stack = [...m.startIds];
    while (stack.length) { const id = stack.pop()!; if (seen.has(id)) continue; seen.add(id); stack.push(...m.nodes[id].next); }
    expect(seen.size).toBe(nodes.length);
    expect(nodes.some((n) => n.layer === 3 && n.type === 'workshop')).toBe(true);
    const evIds = nodes.filter((n) => n.type === 'event').map((n) => n.eventId);
    expect(new Set(evIds).size).toBe(evIds.length);
    expect(new Set(nodes.map((n) => n.biome))).toEqual(new Set(['desert', 'industrial', 'night']));
    expect(reachable(m, null)).toEqual(m.startIds);
  });
});

describe('Événements', () => {
  it('au moins 8 événements distincts', () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(EVENTS.map((e) => e.id)).size).toBe(EVENTS.length);
  });
  it.each(EVENTS.map((e) => [e.id, e] as const))('%s : probabilités cohérentes et option gratuite', (_id, ev) => {
    expect(ev.choices.length).toBeGreaterThanOrEqual(2);
    for (const c of ev.choices) {
      const sum = c.outcomes.reduce((a, o) => a + o.p, 0);
      expect(sum).toBeCloseTo(1, 6);
    }
    // anti-blocage : toujours un choix sans coût
    expect(ev.choices.some((c) => !c.cost)).toBe(true);
  });
});
