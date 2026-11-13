import { Rng, seedFromString } from '../core/rng';
import type { Biome, MapData, MapNode, NodeType } from '../core/types';
import { EVENT_IDS } from './events';

export const MAP_LAYERS = 6; // étapes principales avant la confrontation finale

export function biomeForLayer(layer: number): Biome {
  if (layer <= 1) return 'desert';
  if (layer <= 3) return 'industrial';
  return 'night';
}

/**
 * Génère une carte à embranchements reproductible.
 * Garanties : 2-3 nœuds par étape, chaque nœud a au moins une sortie et une entrée,
 * un atelier à l'étape 3, un camp ou atelier à l'étape 5, événements sans doublon.
 */
export function generateMap(seed: string): MapData {
  const rng = new Rng(seedFromString(seed));
  const nodes: Record<string, MapNode> = {};
  const layerIds: string[][] = [];
  const events = rng.shuffle([...EVENT_IDS]);
  let evIdx = 0;

  for (let L = 0; L < MAP_LAYERS; L++) {
    const count = L === 0 ? 2 : rng.int(2, 3);
    const ids: string[] = [];
    const types = layerTypes(L, count, rng);
    for (let i = 0; i < count; i++) {
      const id = `n${L}_${i}`;
      const lane = count === 1 ? 0.5 : 0.15 + (0.7 * i) / (count - 1) + rng.range(-0.04, 0.04);
      const type = types[i];
      const risk = (type === 'route' ? Math.min(3, 1 + Math.floor(L / 2) + rng.int(0, 1)) : rng.int(1, 2)) as 1 | 2 | 3;
      const node: MapNode = {
        id, layer: L, lane, type, biome: biomeForLayer(L), risk,
        fuelCost: 7 + rng.int(0, 3) + (risk - 1),
        next: [],
      };
      if (type === 'event') node.eventId = events[evIdx++ % events.length];
      nodes[id] = node;
      ids.push(id);
    }
    layerIds.push(ids);
  }

  const finalId = 'final';
  nodes[finalId] = { id: finalId, layer: MAP_LAYERS, lane: 0.5, type: 'final', biome: 'night', risk: 3, fuelCost: 8, next: [] };

  // Liaisons : chaque nœud relie le(s) nœud(s) les plus proches de l'étape suivante, sans croisements.
  for (let L = 0; L < MAP_LAYERS - 1; L++) {
    const a = layerIds[L];
    const b = layerIds[L + 1];
    for (let i = 0; i < a.length; i++) {
      const t = a.length === 1 ? 0.5 : i / (a.length - 1);
      const j = Math.round(t * (b.length - 1));
      link(nodes[a[i]], b[j]);
      // embranchement supplémentaire vers un voisin
      const alt = j + (rng.chance(0.5) ? 1 : -1);
      if (alt >= 0 && alt < b.length && rng.chance(0.65)) link(nodes[a[i]], b[alt]);
    }
    // toute entrée doit être atteignable
    for (let j = 0; j < b.length; j++) {
      if (!a.some((id) => nodes[id].next.includes(b[j]))) {
        const t = b.length === 1 ? 0.5 : j / (b.length - 1);
        link(nodes[a[Math.round(t * (a.length - 1))]], b[j]);
      }
    }
  }
  for (const id of layerIds[MAP_LAYERS - 1]) link(nodes[id], finalId);
  for (const n of Object.values(nodes)) n.next.sort();

  return { seed, layers: MAP_LAYERS, nodes, startIds: layerIds[0], finalId };
}

function link(n: MapNode, to: string) {
  if (!n.next.includes(to)) n.next.push(to);
}

function layerTypes(L: number, count: number, rng: Rng): NodeType[] {
  const t: NodeType[] = [];
  if (L === 0) return rng.shuffle<NodeType>(['route', 'event']);
  if (L === 3) t.push('workshop');
  if (L === 5) t.push(rng.chance(0.5) ? 'camp' : 'workshop');
  while (t.length < count) {
    const r = rng.next();
    if (r < 0.45) t.push('route');
    else if (r < 0.85) t.push('event');
    else t.push(L >= 2 ? 'camp' : 'event');
  }
  // au moins une route de combat par étape (sauf étape 0 déjà traitée) si 3 nœuds
  if (count === 3 && !t.includes('route')) t[t.length - 1] = 'route';
  return rng.shuffle(t);
}

/** Nœuds accessibles depuis la position actuelle. */
export function reachable(map: MapData, currentId: string | null): string[] {
  if (currentId === null) return [...map.startIds];
  return [...map.nodes[currentId].next];
}
