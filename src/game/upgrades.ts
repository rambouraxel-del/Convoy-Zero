import { VEHICLES } from '../config/balance';
import type { MetaUpgradeId, RunState, RunUpgradeId, VehicleId } from '../core/types';

export type UpgradeCategory = 'blindage' | 'puissance' | 'cadence' | 'collecte' | 'carburant' | 'réparation' | 'soutien';

export interface RunUpgradeDef {
  id: RunUpgradeId;
  name: string;
  category: UpgradeCategory;
  maxLevel: number;
  cost: number; // ferraille en atelier
  desc: (lvl: number) => string;
  icon: string;
}

export const RUN_UPGRADES: Record<RunUpgradeId, RunUpgradeDef> = {
  plating: { id: 'plating', name: 'Blindage soudé', category: 'blindage', maxLevel: 3, cost: 22, icon: '🛡', desc: (l) => `+20 % PV max de tout le convoi (niv. ${l})` },
  reactive: { id: 'reactive', name: 'Plaques réactives', category: 'blindage', maxLevel: 2, cost: 26, icon: '⬢', desc: () => '−12 % de dégâts reçus' },
  calibrated: { id: 'calibrated', name: 'Canons calibrés', category: 'puissance', maxLevel: 3, cost: 24, icon: '✦', desc: () => '+20 % de dégâts pour toutes les armes' },
  apRounds: { id: 'apRounds', name: 'Obus perforants', category: 'puissance', maxLevel: 1, cost: 20, icon: '➹', desc: () => '+60 % de dégâts contre Blindés et Béhémoth' },
  rapid: { id: 'rapid', name: 'Culasse rapide', category: 'cadence', maxLevel: 3, cost: 24, icon: '⟫', desc: () => '+18 % de cadence de tir' },
  scopes: { id: 'scopes', name: 'Lunettes de visée', category: 'cadence', maxLevel: 2, cost: 16, icon: '◎', desc: () => '+20 % de portée' },
  magnet: { id: 'magnet', name: 'Électro-aimant', category: 'collecte', maxLevel: 2, cost: 14, icon: '⊂', desc: () => '+50 % de rayon de ramassage' },
  sorting: { id: 'sorting', name: 'Tri sélectif', category: 'collecte', maxLevel: 2, cost: 16, icon: '⚙', desc: () => '+30 % de ferraille ramassée' },
  injectors: { id: 'injectors', name: 'Injecteurs économes', category: 'carburant', maxLevel: 2, cost: 16, icon: '⛽', desc: () => '−20 % de carburant par étape' },
  welder: { id: 'welder', name: 'Soudeur automatique', category: 'réparation', maxLevel: 2, cost: 26, icon: '✚', desc: () => 'Le commandement régénère 1,5 PV/s' },
  drone: { id: 'drone', name: 'Drone de réparation', category: 'réparation', maxLevel: 2, cost: 22, icon: '✈', desc: () => 'Les escortes régénèrent 1,2 PV/s' },
  rearTurret: { id: 'rearTurret', name: 'Tourelle arrière', category: 'soutien', maxLevel: 1, cost: 30, icon: '⊕', desc: () => 'Le commandement tire un second obus vers l\'arrière' },
  shockShield: { id: 'shockShield', name: 'Bouclier de choc', category: 'soutien', maxLevel: 1, cost: 28, icon: '◍', desc: () => 'Annule le prochain gros impact (recharge 12 s)' },
  rations: { id: 'rations', name: 'Rations compactes', category: 'soutien', maxLevel: 1, cost: 12, icon: '☰', desc: () => 'Pas de provisions consommées une étape sur deux' },
};

export interface MetaUpgradeDef {
  id: MetaUpgradeId;
  name: string;
  costs: number[]; // coût par niveau
  desc: (lvl: number) => string;
  icon: string;
}

export const META_UPGRADES: Record<MetaUpgradeId, MetaUpgradeDef> = {
  hull: { id: 'hull', name: 'Châssis renforcés', costs: [18, 42, 75], icon: '🛡', desc: (l) => `+${l * 12} % PV initiaux` },
  tanks: { id: 'tanks', name: 'Réservoirs auxiliaires', costs: [15, 36, 66], icon: '⛽', desc: (l) => `+${l * 10} carburant au départ` },
  magnet: { id: 'magnet', name: 'Aimants de récupération', costs: [15, 33, 60], icon: '⊂', desc: (l) => `+${l * 15} % rayon de ramassage` },
  guns: { id: 'guns', name: 'Armurerie', costs: [21, 45, 82], icon: '✦', desc: (l) => `+${l * 8} % de dégâts` },
  pantry: { id: 'pantry', name: 'Garde-manger', costs: [12, 30, 54], icon: '☰', desc: (l) => `+${l * 3} provisions au départ` },
  workshop: { id: 'workshop', name: 'Atelier mobile', costs: [18, 39, 69], icon: '✚', desc: (l) => `Réparations ${l * 15} % moins chères, +${l * 5} ferraille au départ` },
};

export const META_MAX = 3;

export interface CombatStats {
  maxHp: number;
  damage: number;
  fireCooldown: number;
  range: number;
  bulletSpeed: number;
  pickupRadius: number;
  scrapMult: number;
  damageTaken: number; // multiplicateur
  regen: number; // PV/s
  armorPierce: number; // multiplicateur contre blindés
  rearTurret: boolean;
}

export function lvl(map: Partial<Record<string, number>>, id: string): number {
  return map[id] ?? 0;
}

/** Statistiques effectives d'un véhicule selon méta + améliorations de run. */
export function vehicleStats(id: VehicleId, upgrades: RunState['upgrades'], meta: RunState['meta']): CombatStats {
  const d = VEHICLES[id];
  const u = (k: RunUpgradeId) => lvl(upgrades, k);
  const m = (k: MetaUpgradeId) => lvl(meta, k);
  return {
    maxHp: Math.round(d.maxHp * (1 + 0.12 * m('hull')) * (1 + 0.2 * u('plating'))),
    damage: d.damage * (1 + 0.08 * m('guns')) * (1 + 0.2 * u('calibrated')),
    fireCooldown: d.fireCooldown / (1 + 0.18 * u('rapid')),
    range: d.range * (1 + 0.2 * u('scopes')),
    bulletSpeed: d.bulletSpeed,
    pickupRadius: d.pickupRadius * (1 + 0.15 * m('magnet')) * (1 + 0.5 * u('magnet')),
    scrapMult: d.scrapMult * (1 + 0.3 * u('sorting')),
    damageTaken: Math.pow(0.88, u('reactive')),
    regen: id === 'command' ? 1.5 * u('welder') : 1.2 * u('drone'),
    armorPierce: 1 + 0.6 * u('apRounds'),
    rearTurret: id === 'command' && u('rearTurret') > 0,
  };
}

export function fuelMultiplier(upgrades: RunState['upgrades']): number {
  return Math.pow(0.8, lvl(upgrades, 'injectors'));
}

export function repairCostMultiplier(meta: RunState['meta']): number {
  return 1 - 0.15 * lvl(meta, 'workshop');
}

export function canTakeUpgrade(upgrades: RunState['upgrades'], id: RunUpgradeId): boolean {
  return lvl(upgrades, id) < RUN_UPGRADES[id].maxLevel;
}

export const ALL_RUN_UPGRADES = Object.keys(RUN_UPGRADES) as RunUpgradeId[];
export const ALL_META_UPGRADES = Object.keys(META_UPGRADES) as MetaUpgradeId[];
