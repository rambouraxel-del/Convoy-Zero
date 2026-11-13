export type Biome = 'desert' | 'industrial' | 'night';
export type VehicleId = 'command' | 'escort' | 'salvager';
export type EnemyType = 'marauder' | 'gunner' | 'scout' | 'brute' | 'kamikaze' | 'boss';
export type ResourceKey = 'fuel' | 'scrap' | 'food';
export type Resources = Record<ResourceKey, number>;
export type NodeType = 'route' | 'event' | 'workshop' | 'camp' | 'final';

export interface MapNode {
  id: string;
  layer: number;
  lane: number; // 0..1 position horizontale sur la carte
  type: NodeType;
  biome: Biome;
  risk: 1 | 2 | 3;
  fuelCost: number;
  eventId?: string;
  next: string[];
}

export interface MapData {
  seed: string;
  layers: number; // nombre d'étapes avant la finale
  nodes: Record<string, MapNode>;
  startIds: string[];
  finalId: string;
}

export interface VehicleState {
  id: VehicleId;
  hp: number;
  maxHp: number;
  alive: boolean;
}

export interface RunStats {
  kills: number;
  killsByType: Partial<Record<EnemyType, number>>;
  distance: number;
  scrapCollected: number;
  stepsCleared: number;
  eventsSeen: number;
  damageTaken: number;
  timeMs: number;
}

export type RunUpgradeId =
  | 'plating' | 'reactive' | 'calibrated' | 'apRounds' | 'rapid' | 'scopes' | 'magnet'
  | 'sorting' | 'injectors' | 'welder' | 'drone' | 'rearTurret' | 'shockShield' | 'rations';

export type MetaUpgradeId = 'hull' | 'tanks' | 'magnet' | 'guns' | 'pantry' | 'workshop';

export interface RunState {
  seed: string;
  map: MapData;
  currentId: string | null;
  visited: string[];
  res: Resources;
  vehicles: Record<VehicleId, VehicleState>;
  upgrades: Partial<Record<RunUpgradeId, number>>;
  meta: Partial<Record<MetaUpgradeId, number>>;
  stats: RunStats;
  rngState: number;
  outcome: null | 'victory' | 'defeat';
  defeatReason?: string;
  log: string[];
}

export interface Settings {
  musicVolume: number; // 0..1
  sfxVolume: number;
  muted: boolean;
  driveMode: 'toggle' | 'hold';
  showTutorial: boolean;
  screenShake: boolean;
}

export interface ProfileStats {
  runs: number;
  victories: number;
  bestSteps: number;
  totalKills: number;
  totalCoinsEarned: number;
}

export interface SaveData {
  version: number;
  coins: number;
  meta: Record<MetaUpgradeId, number>;
  settings: Settings;
  profile: ProfileStats;
  tutorialDone: boolean;
}
