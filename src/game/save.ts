import type { MetaUpgradeId, SaveData, Settings } from '../core/types';
import { ALL_META_UPGRADES, META_MAX, META_UPGRADES } from './upgrades';

export const SAVE_KEY = 'convoy-zero.save';
export const SAVE_VERSION = 2;

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export function defaultSettings(): Settings {
  return { musicVolume: 0.5, sfxVolume: 0.7, muted: false, driveMode: 'toggle', showTutorial: true, screenShake: true };
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    coins: 0,
    meta: Object.fromEntries(ALL_META_UPGRADES.map((k) => [k, 0])) as Record<MetaUpgradeId, number>,
    settings: defaultSettings(),
    profile: { runs: 0, victories: 0, bestSteps: 0, totalKills: 0, totalCoinsEarned: 0 },
    tutorialDone: false,
  };
}

const num = (v: unknown, d: number, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;

/**
 * Migration + validation : accepte n'importe quelle entrée et renvoie toujours une sauvegarde valide.
 * v1 (prototype) : { coins, upgrades: {...}, volume } → v2.
 */
export function migrate(raw: unknown): SaveData {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  let o = raw as Record<string, any>;
  if (o.version === undefined || o.version === 1) {
    o = {
      version: 2,
      coins: o.coins,
      meta: o.upgrades ?? o.meta,
      settings: typeof o.volume === 'number' ? { musicVolume: o.volume, sfxVolume: o.volume } : o.settings,
      profile: o.profile,
      tutorialDone: o.tutorialDone,
    };
  }
  const meta = { ...d.meta };
  if (o.meta && typeof o.meta === 'object') {
    for (const k of ALL_META_UPGRADES) meta[k] = Math.floor(num(o.meta[k], 0, 0, META_MAX));
  }
  const s = o.settings && typeof o.settings === 'object' ? o.settings : {};
  const p = o.profile && typeof o.profile === 'object' ? o.profile : {};
  return {
    version: SAVE_VERSION,
    coins: Math.floor(num(o.coins, 0)),
    meta,
    settings: {
      musicVolume: num(s.musicVolume, d.settings.musicVolume, 0, 1),
      sfxVolume: num(s.sfxVolume, d.settings.sfxVolume, 0, 1),
      muted: typeof s.muted === 'boolean' ? s.muted : false,
      driveMode: s.driveMode === 'hold' ? 'hold' : 'toggle',
      showTutorial: typeof s.showTutorial === 'boolean' ? s.showTutorial : true,
      screenShake: typeof s.screenShake === 'boolean' ? s.screenShake : true,
    },
    profile: {
      runs: Math.floor(num(p.runs, 0)),
      victories: Math.floor(num(p.victories, 0)),
      bestSteps: Math.floor(num(p.bestSteps, 0)),
      totalKills: Math.floor(num(p.totalKills, 0)),
      totalCoinsEarned: Math.floor(num(p.totalCoinsEarned, 0)),
    },
    tutorialDone: o.tutorialDone === true,
  };
}

export function loadSave(storage: StorageLike | null): SaveData {
  if (!storage) return defaultSave();
  try {
    const txt = storage.getItem(SAVE_KEY);
    if (!txt) return defaultSave();
    return migrate(JSON.parse(txt));
  } catch {
    // sauvegarde corrompue : on la met de côté et on repart proprement
    try { storage.setItem(SAVE_KEY + '.corrupt', storage.getItem(SAVE_KEY) ?? ''); } catch { /* ignore */ }
    return defaultSave();
  }
}

export function writeSave(storage: StorageLike | null, data: SaveData): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function metaCost(data: SaveData, id: MetaUpgradeId): number | null {
  const l = data.meta[id];
  return l >= META_MAX ? null : META_UPGRADES[id].costs[l];
}

/** Achat d'amélioration permanente. `expectedLevel` rend l'achat idempotent (double-clic, double appel). */
export function buyMeta(data: SaveData, id: MetaUpgradeId, expectedLevel = data.meta[id]): boolean {
  if (data.meta[id] !== expectedLevel) return false;
  const cost = metaCost(data, id);
  if (cost === null || data.coins < cost) return false;
  data.coins -= cost;
  data.meta[id] += 1;
  return true;
}

export function getStorage(): StorageLike | null {
  try {
    const s = window.localStorage;
    const k = '__cz_probe';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}
