import { describe, expect, it } from 'vitest';
import { createRun, travelTo } from '../../src/game/run';
import { reachable } from '../../src/game/mapgen';
import { clearRun, emptyPost, loadRun, parseRun, RUN_SAVE_KEY, serializeRun, writeRun } from '../../src/game/runSave';
import type { StorageLike } from '../../src/game/save';

class Mem implements StorageLike {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

function sampleRun() {
  const run = createRun('TESTSEED', { tanks: 1 });
  travelTo(run, reachable(run.map, null)[0]);
  run.stats.kills = 4;
  run.stats.killsByType = { marauder: 3, gunner: 1 };
  return run;
}

function tampered(mut: (o: any) => void, phase: 'map' | 'drive' | 'post' = 'drive') {
  const o = JSON.parse(serializeRun(sampleRun(), phase, emptyPost(), 3, 1000));
  mut(o);
  return JSON.stringify(o);
}

describe('Sauvegarde d\'expédition', () => {
  it('aller-retour fidèle (carte régénérée depuis la graine)', () => {
    const st = new Mem();
    const run = sampleRun();
    const post = { eventResult: { text: 'Un choix', ambush: true }, rewardOffers: ['plating' as const], workshopOffers: [], campUsed: ['rest'] };
    expect(writeRun(st, run, 'post', post, 5)).toBe(true);
    expect(JSON.parse(st.getItem(RUN_SAVE_KEY)!).run.map).toBeUndefined();
    const l = loadRun(st)!;
    expect(l).not.toBeNull();
    expect(l.phase).toBe('post');
    expect(l.driveSalt).toBe(5);
    expect(l.post).toEqual(post);
    expect(l.run).toEqual(run);
  });

  it('absente, sans stockage ou corrompue → null', () => {
    expect(loadRun(new Mem())).toBeNull();
    expect(loadRun(null)).toBeNull();
    for (const bad of ['', '{', 'null', '[]', '42', '{"version":1}']) {
      const st = new Mem();
      st.setItem(RUN_SAVE_KEY, bad);
      expect(loadRun(st)).toBeNull();
    }
    const throwing: StorageLike = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
    expect(loadRun(throwing)).toBeNull();
    expect(writeRun(throwing, sampleRun(), 'map')).toBe(false);
    expect(() => clearRun(throwing)).not.toThrow();
  });

  it('version inconnue → null', () => {
    expect(parseRun(tampered((o) => { o.version = 2; }))).toBeNull();
    expect(parseRun(tampered((o) => { o.version = 0; }))).toBeNull();
  });

  it('currentId / trajet invalides → null', () => {
    expect(parseRun(tampered((o) => { o.run.currentId = 'inexistant'; }))).toBeNull();
    expect(parseRun(tampered((o) => { o.run.visited = ['inexistant']; o.run.currentId = 'inexistant'; }))).toBeNull();
    expect(parseRun(tampered((o) => { o.run.currentId = null; }))).toBeNull();
  });

  it('ressources négatives ou non numériques → null', () => {
    expect(parseRun(tampered((o) => { o.run.res.fuel = -1; }))).toBeNull();
    expect(parseRun(tampered((o) => { o.run.res.scrap = 'x'; }))).toBeNull();
    expect(parseRun(tampered((o) => { o.run.res.food = null; }))).toBeNull();
  });

  it('autres incohérences → null', () => {
    expect(parseRun(tampered((o) => { o.run.vehicles.command.hp = 9999; }))).toBeNull();
    expect(parseRun(tampered((o) => { o.run.vehicles.command.alive = false; }))).toBeNull();
    expect(parseRun(tampered((o) => { o.run.upgrades = { plating: 99 }; }))).toBeNull();
    expect(parseRun(tampered((o) => { o.run.outcome = 'defeat'; }))).toBeNull();
    expect(parseRun(tampered((o) => { o.phase = 'autre'; }))).toBeNull();
    expect(parseRun(tampered((o) => { o.post.rewardOffers = ['nimporte']; }))).toBeNull();
    expect(parseRun(tampered((o) => { o.run.seed = ''; }))).toBeNull();
  });

  it('phase post : cohérence avec le type de nœud', () => {
    // un nœud route sans offres de récompense ne peut pas être un écran d'arrivée
    const first = sampleRun().map.nodes[sampleRun().currentId!];
    const raw = tampered(() => {}, 'post');
    expect(parseRun(raw) === null).toBe(first.type === 'route' || first.type === 'final');
  });

  it('clearRun supprime la sauvegarde', () => {
    const st = new Mem();
    writeRun(st, sampleRun(), 'map');
    expect(loadRun(st)).not.toBeNull();
    clearRun(st);
    expect(loadRun(st)).toBeNull();
    expect(st.getItem(RUN_SAVE_KEY)).toBeNull();
  });

  it('n\'écrit jamais une expédition terminée', () => {
    const run = sampleRun();
    run.outcome = 'defeat';
    expect(writeRun(new Mem(), run, 'map')).toBe(false);
  });
});
