import type { Resources, RunUpgradeId } from '../core/types';

export interface EventEffect {
  res?: Partial<Resources>;
  hpPct?: { target: 'all' | 'command' | 'escorts'; pct: number }; // pct négatif = dégâts, positif = soin
  upgrade?: 'random' | RunUpgradeId;
  ambush?: boolean; // déclenche un combat court
  text: string;
}
export interface EventOutcome { p: number; effect: EventEffect }
export interface EventChoice { label: string; cost?: Partial<Resources>; outcomes: EventOutcome[] }
export interface EventDef { id: string; title: string; text: string; icon: string; choices: EventChoice[] }

const leave: EventChoice = { label: 'Passer son chemin', outcomes: [{ p: 1, effect: { text: 'Le convoi reprend la route sans s\'attarder.' } }] };

export const EVENTS: EventDef[] = [
  {
    id: 'station', icon: '⛽', title: 'Station-service',
    text: 'Une station éventrée. Les cuves souterraines sentent encore l\'essence.',
    choices: [
      { label: 'Siphonner les cuves', outcomes: [
        { p: 0.75, effect: { res: { fuel: 18 }, text: 'Les cuves livrent un bon plein.' } },
        { p: 0.25, effect: { res: { fuel: 6 }, hpPct: { target: 'all', pct: -0.1 }, text: 'Une poche de vapeur s\'enflamme ! Peu de carburant récupéré.' } },
      ] },
      { label: 'Pompe manuelle (lent, sûr)', cost: { food: 2 }, outcomes: [{ p: 1, effect: { res: { fuel: 12 }, text: 'Des heures de pompage, mais aucun risque.' } }] },
      leave,
    ],
  },
  {
    id: 'scrapper', icon: '⚙', title: 'Ferrailleur',
    text: 'Un vieil homme trône sur une montagne de pièces détachées. Il répare tout, contre paiement.',
    choices: [
      { label: 'Réparation complète du convoi', cost: { scrap: 15 }, outcomes: [{ p: 1, effect: { hpPct: { target: 'all', pct: 0.35 }, text: 'Soudures nettes, boulons neufs : +35 % PV.' } }] },
      { label: 'Acheter une pièce rare', cost: { scrap: 18 }, outcomes: [{ p: 1, effect: { upgrade: 'random', text: 'Il vous tend une pièce introuvable.' } }] },
      leave,
    ],
  },
  {
    id: 'merchant', icon: '⚖', title: 'Convoi marchand',
    text: 'Des marchands armés jusqu\'aux dents proposent un échange équitable.',
    choices: [
      { label: 'Acheter du carburant', cost: { scrap: 12 }, outcomes: [{ p: 1, effect: { res: { fuel: 14 }, text: '+14 carburant.' } }] },
      { label: 'Acheter des provisions', cost: { scrap: 10 }, outcomes: [{ p: 1, effect: { res: { food: 6 }, text: '+6 provisions.' } }] },
      { label: 'Vendre des provisions', cost: { food: 3 }, outcomes: [{ p: 1, effect: { res: { scrap: 12 }, text: '+12 ferraille.' } }] },
      leave,
    ],
  },
  {
    id: 'camp', icon: '⛺', title: 'Camp abandonné',
    text: 'Des tentes déchirées, un feu encore tiède. Quelqu\'un était là il y a peu.',
    choices: [
      { label: 'Fouiller le camp', outcomes: [
        { p: 0.6, effect: { res: { food: 5, scrap: 8 }, text: 'Provisions et outils récupérés.' } },
        { p: 0.4, effect: { res: { scrap: 6 }, ambush: true, text: 'C\'était un piège ! Les pillards attaquent.' } },
      ] },
      { label: 'Se reposer et réparer', cost: { food: 2 }, outcomes: [{ p: 1, effect: { hpPct: { target: 'all', pct: 0.25 }, text: 'Une nuit de repos : +25 % PV.' } }] },
      leave,
    ],
  },
  {
    id: 'wreck', icon: '⚒', title: 'Carcasse de camion',
    text: 'Un camion-citerne couché sur le flanc. Sa structure est intacte.',
    choices: [
      { label: 'Démonter la carrosserie', cost: { food: 1 }, outcomes: [{ p: 1, effect: { res: { scrap: 14 }, text: '+14 ferraille.' } }] },
      { label: 'Percer la citerne', outcomes: [
        { p: 0.5, effect: { res: { fuel: 15 }, text: 'La citerne était encore pleine !' } },
        { p: 0.5, effect: { res: { fuel: 3 }, text: 'Presque vide. Quelques litres seulement.' } },
      ] },
      leave,
    ],
  },
  {
    id: 'minefield', icon: '✹', title: 'Passage miné',
    text: 'Des panneaux à tête de mort. La route traverse un champ de mines.',
    choices: [
      { label: 'Contourner par les dunes', cost: { fuel: 6 }, outcomes: [{ p: 1, effect: { text: 'Le détour coûte du carburant, mais personne n\'est blessé.' } }] },
      { label: 'Foncer tout droit', outcomes: [
        { p: 0.65, effect: { text: 'Le convoi passe sans encombre.' } },
        { p: 0.35, effect: { hpPct: { target: 'all', pct: -0.2 }, text: 'Une mine explose sous les roues : −20 % PV.' } },
      ] },
      { label: 'Déminer avec le Glaneur', cost: { scrap: 6 }, outcomes: [{ p: 1, effect: { res: { scrap: 14 }, text: 'Les mines désamorcées valent de la ferraille : +14.' } }] },
    ],
  },
  {
    id: 'storm', icon: '🌪', title: 'Tempête de sable',
    text: 'Un mur ocre avance à l\'horizon. Il faut décider vite.',
    choices: [
      { label: 'S\'abriter et attendre', cost: { food: 3 }, outcomes: [{ p: 1, effect: { text: 'La tempête passe. L\'équipage a mangé.' } }] },
      { label: 'Avancer à l\'aveugle', outcomes: [
        { p: 0.5, effect: { res: { scrap: 5 }, text: 'Le convoi trouve sa route et des débris utiles.' } },
        { p: 0.5, effect: { hpPct: { target: 'escorts', pct: -0.2 }, res: { fuel: -4 }, text: 'Les escortes heurtent des épaves : −20 % PV, −4 carburant.' } },
      ] },
      { label: 'Contourner la tempête', cost: { fuel: 7 }, outcomes: [{ p: 1, effect: { text: 'Un long détour, sans danger.' } }] },
    ],
  },
  {
    id: 'ambush', icon: '☠', title: 'Embuscade',
    text: 'Des épaves bloquent la route. Des silhouettes armées surgissent des carcasses.',
    choices: [
      { label: 'Combattre', outcomes: [{ p: 1, effect: { ambush: true, res: { scrap: 18 }, text: 'Aux armes ! Le butin des pillards sera à vous : +18 ferraille.' } }] },
      { label: 'Payer le péage', cost: { scrap: 14 }, outcomes: [{ p: 1, effect: { text: 'Ils prennent la ferraille et vous laissent passer.' } }] },
      { label: 'Forcer le barrage', outcomes: [{ p: 1, effect: { hpPct: { target: 'all', pct: -0.18 }, text: 'Le Mastodonte enfonce le barrage : −18 % PV.' } }] },
    ],
  },
  {
    id: 'survivor', icon: '☺', title: 'Survivant isolé',
    text: 'Une mécanicienne fait signe au bord de la route, un sac d\'outils à l\'épaule.',
    choices: [
      { label: 'L\'accueillir à bord', cost: { food: 2 }, outcomes: [{ p: 1, effect: { upgrade: 'random', text: 'Elle améliore aussitôt un véhicule.' } }] },
      { label: 'Échanger des vivres', outcomes: [
        { p: 0.7, effect: { res: { food: 6 }, text: 'Elle partage ses réserves : +6 provisions.' } },
        { p: 0.3, effect: { hpPct: { target: 'command', pct: -0.12 }, text: 'Un leurre ! Des tirs touchent le Mastodonte.' } },
      ] },
      leave,
    ],
  },
  {
    id: 'crossroads', icon: '✛', title: 'Croisement dangereux',
    text: 'Deux routes : un raccourci par un village en ruines, ou l\'autoroute effondrée.',
    choices: [
      { label: 'Le raccourci', outcomes: [
        { p: 0.6, effect: { res: { fuel: 6 }, text: 'Le raccourci fait économiser du carburant : +6.' } },
        { p: 0.4, effect: { ambush: true, text: 'Le village est occupé. Embuscade !' } },
      ] },
      { label: 'L\'autoroute', cost: { fuel: 4 }, outcomes: [{ p: 1, effect: { res: { scrap: 6 }, text: 'Route longue mais calme. +6 ferraille trouvée.' } }] },
    ],
  },
];

export const EVENT_IDS = EVENTS.map((e) => e.id);
export const EVENTS_BY_ID: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

/** Texte d'annonce des probabilités, sans tromperie. */
export function describeOutcomes(c: EventChoice): string {
  if (c.outcomes.length === 1) return c.outcomes[0].effect.text;
  return c.outcomes.map((o) => `${Math.round(o.p * 100)} % : ${o.effect.text}`).join(' / ');
}
