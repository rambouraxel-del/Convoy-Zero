/** Toutes les valeurs d'équilibrage centralisées. */
import type { Biome, EnemyType, Resources, VehicleId } from '../core/types';

export const VIEW = { w: 1280, h: 720 };
export const ROAD = { top: 110, bottom: 610, centerY: 360 };

export const START_RES: Resources = { fuel: 50, scrap: 20, food: 10 };
export const STEP_FOOD_COST = 2;
export const HUNGER_DAMAGE_PCT = 0.12; // dégâts à chaque véhicule si provisions épuisées
export const EMERGENCY_SCRAP_PER_FUEL = 2; // carburant manquant compensé par de la ferraille
export const EMERGENCY_HULL_PER_FUEL = 3; // puis par des dégâts de coque (jamais mortels)
export const REPAIR_SCRAP_PER_HP = 0.25; // 4 PV par ferraille

export interface VehicleDef {
  id: VehicleId;
  name: string;
  role: string;
  maxHp: number;
  damage: number;
  fireCooldown: number; // s
  range: number;
  bulletSpeed: number;
  pickupRadius: number;
  scrapMult: number;
  radius: number;
  offset: { x: number; y: number }; // formation relative au commandement
}

export const VEHICLES: Record<VehicleId, VehicleDef> = {
  command: {
    id: 'command', name: 'Mastodonte', role: 'Commandement — sa perte termine l\'expédition. Canon lourd.',
    maxHp: 160, damage: 22, fireCooldown: 0.85, range: 520, bulletSpeed: 900, pickupRadius: 60, scrapMult: 1,
    radius: 34, offset: { x: 0, y: 0 },
  },
  escort: {
    id: 'escort', name: 'Lame', role: 'Escorte — mitrailleuse rapide, portée moyenne.',
    maxHp: 80, damage: 7, fireCooldown: 0.18, range: 380, bulletSpeed: 1100, pickupRadius: 50, scrapMult: 1,
    radius: 24, offset: { x: -110, y: -95 },
  },
  salvager: {
    id: 'salvager', name: 'Glaneur', role: 'Récupérateur — aimant large, +40 % ferraille, tir faible.',
    maxHp: 95, damage: 5, fireCooldown: 0.6, range: 300, bulletSpeed: 800, pickupRadius: 150, scrapMult: 1.4,
    radius: 28, offset: { x: -110, y: 95 },
  },
};

export interface EnemyDef {
  type: EnemyType;
  name: string;
  hp: number;
  speed: number;
  radius: number;
  contactDamage: number;
  shotDamage: number;
  shotCooldown: number;
  telegraph: number; // s d'avertissement avant tir/explosion
  scrap: number; // butin moyen
  desc: string;
}

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  marauder: { type: 'marauder', name: 'Maraudeur', hp: 22, speed: 330, radius: 18, contactDamage: 10, shotDamage: 0, shotCooldown: 0, telegraph: 0, scrap: 2, desc: 'Rapide et fragile, éperonne puis revient.' },
  gunner: { type: 'gunner', name: 'Tireur', hp: 45, speed: 160, radius: 22, contactDamage: 8, shotDamage: 10, shotCooldown: 2.9, telegraph: 0.7, scrap: 3, desc: 'Reste à distance, tire des obus visibles.' },
  scout: { type: 'scout', name: 'Éclaireur', hp: 30, speed: 220, radius: 18, contactDamage: 6, shotDamage: 3, shotCooldown: 1.6, telegraph: 0.25, scrap: 2, desc: 'Harcèle en balayant latéralement.' },
  brute: { type: 'brute', name: 'Blindé', hp: 240, speed: 70, radius: 40, contactDamage: 30, shotDamage: 22, shotCooldown: 3.6, telegraph: 1.0, scrap: 9, desc: 'Lent, très résistant, obus lourds.' },
  kamikaze: { type: 'kamikaze', name: 'Kamikaze', hp: 18, speed: 260, radius: 18, contactDamage: 0, shotDamage: 38, shotCooldown: 0, telegraph: 0.45, scrap: 2, desc: 'Fonce et explose près du convoi.' },
  boss: { type: 'boss', name: 'Béhémoth', hp: 1150, speed: 60, radius: 70, contactDamage: 40, shotDamage: 16, shotCooldown: 1.6, telegraph: 0.8, scrap: 40, desc: 'Forteresse roulante des Charognards.' },
};

export const BIOMES: Record<Biome, { name: string; hazard: string; scroll: number }> = {
  desert: { name: 'Désert poussiéreux', hazard: 'Rochers et rafales de sable qui dévient le convoi', scroll: 230 },
  industrial: { name: 'Zone industrielle', hazard: 'Barils explosifs et carcasses métalliques', scroll: 215 },
  night: { name: 'Terres mortes de nuit', hazard: 'Visibilité réduite et mines enfouies', scroll: 200 },
};

/** Distance (px) d'un segment selon le type d'étape. */
export const SEGMENT_LENGTH = { route: 8200, event: 5600, workshop: 4800, camp: 4800, final: 6000 } as const;

/** Densité d'apparition (ennemis par seconde environ) selon profondeur + risque. */
export function spawnInterval(depth: number, risk: number): number {
  return Math.max(0.75, 2.6 - depth * 0.18 - (risk - 1) * 0.35);
}

export const COINS = { perStep: 4, perKill: 0.2, victory: 30, perScrapLeft: 0.1 };
