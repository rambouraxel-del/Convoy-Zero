import { describe, expect, it } from 'vitest';
import { buyMeta, defaultSave, loadSave, migrate, SAVE_KEY, SAVE_VERSION, writeSave, type StorageLike } from '../../src/game/save';

class Mem implements StorageLike {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

describe('Sauvegarde', () => {
  it('valeurs par défaut si absente', () => {
    expect(loadSave(new Mem())).toEqual(defaultSave());
    expect(loadSave(null)).toEqual(defaultSave());
  });
  it('aller-retour fidèle (rechargement)', () => {
    const st = new Mem();
    const s = defaultSave();
    s.coins = 37; s.meta.hull = 2; s.settings.musicVolume = 0.2; s.settings.muted = true; s.profile.runs = 4;
    writeSave(st, s);
    expect(loadSave(st)).toEqual(s);
  });
  it('JSON corrompu → défaut + copie de secours', () => {
    const st = new Mem();
    st.setItem(SAVE_KEY, '{oops');
    expect(loadSave(st)).toEqual(defaultSave());
    expect(st.getItem(SAVE_KEY + '.corrupt')).toBe('{oops');
  });
  it('valeurs invalides bornées', () => {
    const s = migrate({ version: 2, coins: -50, meta: { hull: 99, guns: 'x' }, settings: { musicVolume: 7, sfxVolume: -1, driveMode: 'bogus' } });
    expect(s.coins).toBe(0);
    expect(s.meta.hull).toBe(3);
    expect(s.meta.guns).toBe(0);
    expect(s.settings.musicVolume).toBe(1);
    expect(s.settings.sfxVolume).toBe(0);
    expect(s.settings.driveMode).toBe('toggle');
  });
  it('migration v1 → v2', () => {
    const s = migrate({ coins: 12, upgrades: { tanks: 1 }, volume: 0.3 });
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.coins).toBe(12);
    expect(s.meta.tanks).toBe(1);
    expect(s.settings.musicVolume).toBe(0.3);
    expect(s.settings.sfxVolume).toBe(0.3);
  });
  it('achat idempotent (double clic) et coûts respectés', () => {
    const s = defaultSave();
    s.coins = 100;
    const lvl = s.meta.hull;
    expect(buyMeta(s, 'hull', lvl)).toBe(true);
    expect(buyMeta(s, 'hull', lvl)).toBe(false); // second clic avec l'ancien niveau
    expect(s.meta.hull).toBe(1);
    expect(s.coins).toBe(82);
    s.coins = 0;
    expect(buyMeta(s, 'hull')).toBe(false);
    s.coins = 1000; s.meta.hull = 3;
    expect(buyMeta(s, 'hull')).toBe(false);
  });
});
