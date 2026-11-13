/**
 * Contrôleur d'application : enchaînement des écrans (DOM) et des segments de conduite (Phaser).
 * Menu → Garage → Carte → Conduite → Événement/Atelier/Récompense → … → Finale → Bilan → Garage.
 */
import { audio } from '../audio/audio';
import { BIOMES, ENEMIES, VEHICLES } from '../config/balance';
import { randomSeedString, seedFromString } from '../core/rng';
import type { MetaUpgradeId, NodeType, ResourceKey, Resources, RunState, RunUpgradeId, SaveData, VehicleId } from '../core/types';
import { describeOutcomes, EVENTS_BY_ID } from '../game/events';
import { reachable } from '../game/mapgen';
import {
  addRes, canAfford, coinsEarned, completeStep, createRun, fieldRepair, fieldRepairCost, fuelCostFor, grantUpgrade, healPct,
  pay, randomUpgradeChoices, repairCost, repairVehicle, resolveEventChoice, travelTo, VEHICLE_IDS, buyUpgrade, rngFor,
} from '../game/run';
import { buyMeta, defaultSave, getStorage, loadSave, metaCost, writeSave, type StorageLike } from '../game/save';
import type { DriveSim, SegmentKind, SimEvent } from '../game/sim/sim';
import { ALL_META_UPGRADES, META_MAX, META_UPGRADES, RUN_UPGRADES, vehicleStats } from '../game/upgrades';
import type { InputManager } from '../input/input';
import type { DriveScene } from '../scenes/DriveScene';
import { ICON, resHtml } from './icons';

type ScreenName = 'menu' | 'garage' | 'howto' | 'settings' | 'map' | 'event' | 'reward' | 'workshop' | 'camp' | 'result' | 'drive';

const NODE_LABEL: Record<NodeType, string> = { route: 'Route hostile', event: 'Rencontre', workshop: 'Atelier', camp: 'Camp', final: 'Embuscade finale' };
const NODE_ICON: Record<NodeType, string> = { route: '⚔', event: '?', workshop: '⚒', camp: '⛺', final: '☠' };
const NODE_COLOR: Record<NodeType, string> = { route: '#b5602f', event: '#1d5f6b', workshop: '#6f8a3a', camp: '#8a6a3a', final: '#8f2a22' };
const VNAME: Record<VehicleId, string> = { command: VEHICLES.command.name, escort: VEHICLES.escort.name, salvager: VEHICLES.salvager.name };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export class App {
  save: SaveData;
  storage: StorageLike | null;
  run: RunState | null = null;
  screen: ScreenName = 'menu';
  private root: HTMLElement;
  private screenEl: HTMLElement;
  private hudEl: HTMLElement;
  private overlayEl: HTMLElement;
  private toastEl: HTMLElement;
  private selectedNode: string | null = null;
  private workshopOffers: RunUpgradeId[] = [];
  private rewardOffers: RunUpgradeId[] = [];
  private campUsed = new Set<string>();
  private eventResult: { text: string; ambush: boolean } | null = null;
  private settingsReturn: 'menu' | 'pause' = 'menu';
  private paused = false;
  private sim: DriveSim | null = null;
  private hudTimer = 0;
  private hintStep = 0;
  private hintTimer = 0;
  private ending = false;
  private confirmReset = false;
  private driveSalt = 0;
  testMode = false;

  constructor(private scene: DriveScene, private input: InputManager) {
    this.storage = getStorage();
    this.save = loadSave(this.storage);
    this.root = document.getElementById('ui')!;
    this.root.innerHTML = `
      <div id="screen" class="screen"></div>
      <div id="hud" class="hidden"></div>
      <div id="overlay" class="screen dim hidden"></div>
      <div class="toast-area" id="toasts"></div>
      <div id="rotate"><div class="phone"></div><h2>Tournez votre téléphone</h2><p class="muted">CONVOY ZERO se joue en mode paysage.</p><button class="btn ghost small" data-act="dismiss-rotate">Continuer quand même</button></div>`;
    this.screenEl = document.getElementById('screen')!;
    this.hudEl = document.getElementById('hud')!;
    this.overlayEl = document.getElementById('overlay')!;
    this.toastEl = document.getElementById('toasts')!;
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.root.addEventListener('input', (e) => this.onInput(e));
    this.input.onToggle = () => this.updateModeButton();
    this.input.onPause = () => (this.paused ? this.resume() : this.pause());
    this.applySettings();
    this.buildHud();

    // première interaction → déverrouille l'audio (contrainte navigateurs mobiles)
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    document.addEventListener('visibilitychange', () => {
      const vis = document.visibilityState === 'visible';
      audio.setVisible(vis);
      if (!vis && this.screen === 'drive' && !this.paused) this.pause();
    });
    window.addEventListener('pagehide', () => this.persist());
    // bouton retour du navigateur / téléphone
    history.replaceState({ cz: 0 }, '');
    history.pushState({ cz: 1 }, '');
    window.addEventListener('popstate', () => {
      history.pushState({ cz: 1 }, '');
      this.back();
    });
    this.show('menu');
  }

  // =================================================================== utilitaires
  persist() {
    writeSave(this.storage, this.save);
  }

  private applySettings() {
    audio.apply(this.save.settings);
    this.input.mode = this.save.settings.driveMode;
    this.scene.shakeEnabled = this.save.settings.screenShake;
  }

  toast(msg: string, kind: '' | 'warn' | 'good' = '') {
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    t.textContent = msg;
    this.toastEl.appendChild(t);
    setTimeout(() => t.remove(), 3300);
    while (this.toastEl.children.length > 4) this.toastEl.firstChild?.remove();
  }

  private resBar(res: Resources): string {
    return `<div class="resbar">${(['fuel', 'scrap', 'food'] as ResourceKey[]).map((k) => resHtml(k, res[k])).join('')}</div>`;
  }

  private costHtml(cost?: Partial<Resources>): string {
    if (!cost) return '<span class="cost">Gratuit</span>';
    const ok = !this.run || canAfford(this.run, cost);
    return `<span class="cost ${ok ? '' : 'no'}">Coût : ${(Object.keys(cost) as ResourceKey[]).map((k) => resHtml(k, cost[k]!)).join(' ')}</span>`;
  }

  private vehiclesHtml(withRepair: 'none' | 'field' | 'workshop'): string {
    const run = this.run!;
    return VEHICLE_IDS.map((id) => {
      const v = run.vehicles[id];
      const ratio = v.alive ? v.hp / v.maxHp : 0;
      const cls = ratio < 0.3 ? 'low' : ratio < 0.6 ? 'mid' : '';
      let btn = '';
      if (withRepair === 'field' && v.alive && v.hp < v.maxHp) {
        const c = fieldRepairCost(run, id);
        btn = `<button class="btn small alt" data-act="field-repair" data-id="${id}" ${run.res.scrap <= 0 ? 'disabled' : ''}>Réparer ${Math.min(c, run.res.scrap)}${ICON.scrap.replace('<svg', '<svg style="width:14px;height:14px"')}</button>`;
      } else if (withRepair === 'workshop' && (!v.alive || v.hp < v.maxHp)) {
        const c = repairCost(run, id);
        const canRevive = id !== 'command';
        if (v.alive || canRevive) btn = `<button class="btn small alt" data-act="ws-repair" data-id="${id}" ${run.res.scrap < c ? 'disabled' : ''}>${v.alive ? 'Réparer' : 'Remettre en route'} ${c}${ICON.scrap.replace('<svg', '<svg style="width:14px;height:14px"')}</button>`;
      }
      return `<div class="vehicle-row ${v.alive ? '' : 'dead'}"><span><b>${VNAME[id]}</b><br><span class="muted">${v.alive ? `${Math.round(v.hp)} / ${v.maxHp} PV` : 'Détruit'}</span></span>
        <div class="hpbar ${cls}"><i style="width:${ratio * 100}%"></i></div>${btn || '<span></span>'}</div>`;
    }).join('');
  }

  private upgradeCard(id: RunUpgradeId, act: string, priceScrap?: number): string {
    const u = RUN_UPGRADES[id];
    const lv = this.run?.upgrades[id] ?? 0;
    const afford = priceScrap === undefined || (this.run?.res.scrap ?? 0) >= priceScrap;
    const pips = Array.from({ length: u.maxLevel }, (_, i) => `<i class="pip ${i < lv ? 'on' : ''}"></i>`).join('');
    return `<div class="card choice ${afford ? '' : 'disabled'}" data-act="${act}" data-id="${id}" role="button" tabindex="0">
      <div class="row"><span class="icon">${u.icon}</span><span class="name">${u.name}</span></div>
      <div class="desc">${u.desc(lv + 1)}</div>
      <div class="row between"><span class="row" style="gap:8px"><span class="tag">${u.category}</span><span class="pips">${pips}</span></span>${priceScrap !== undefined ? `<span class="cost ${afford ? '' : 'no'}">${resHtml('scrap', priceScrap)}</span>` : '<span class="tag">Gratuit</span>'}</div>
    </div>`;
  }

  // =================================================================== navigation
  show(name: ScreenName) {
    this.screen = name;
    this.overlayEl.classList.add('hidden');
    this.hudEl.classList.toggle('hidden', name !== 'drive');
    this.screenEl.classList.toggle('hidden', name === 'drive');
    this.screenEl.className = `screen ${name === 'menu' ? 'menu-bg' : name === 'map' ? 'solid' : 'dim'}${name === 'drive' ? ' hidden' : ''}`;
    if (name !== 'drive') this.input.enabled = false;
    switch (name) {
      case 'menu': this.renderMenu(); break;
      case 'garage': this.renderGarage(); break;
      case 'howto': this.renderHowto(); break;
      case 'settings': this.renderSettings(this.screenEl); break;
      case 'map': this.renderMap(); break;
      case 'event': this.renderEvent(); break;
      case 'reward': this.renderReward(); break;
      case 'workshop': this.renderWorkshop(); break;
      case 'camp': this.renderCamp(); break;
      case 'result': this.renderResult(); break;
      case 'drive': break;
    }
    if (name === 'menu' || name === 'garage' || name === 'howto' || (name === 'settings' && !this.run)) audio.setMood('menu');
    this.screenEl.scrollTop = 0;
  }

  back() {
    if (this.overlayEl.classList.contains('hidden') === false && this.screen === 'drive') { this.resume(); return; }
    switch (this.screen) {
      case 'drive': this.pause(); break;
      case 'garage': case 'howto': this.show('menu'); break;
      case 'settings': if (this.settingsReturn === 'pause') this.openPause(); else this.show('menu'); break;
      case 'map': case 'event': case 'reward': case 'workshop': case 'camp': this.openPause(); break;
      case 'result': this.show('garage'); break;
      default: break;
    }
  }

  // =================================================================== actions
  private onClick(e: Event) {
    const el = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!el || (el as HTMLButtonElement).disabled) return;
    const act = el.dataset.act!;
    const id = el.dataset.id ?? '';
    audio.unlock();
    audio.play(act.startsWith('back') || act === 'menu' ? 'uiBack' : 'ui');
    switch (act) {
      case 'play': this.startRun(); break;
      case 'garage': this.show('garage'); break;
      case 'howto': this.show('howto'); break;
      case 'settings': this.settingsReturn = 'menu'; this.show('settings'); break;
      case 'menu': case 'back-menu': this.show('menu'); break;
      case 'launch': {
        const inp = document.getElementById('seed') as HTMLInputElement | null;
        this.startRun(inp?.value);
        break;
      }
      case 'buy-meta': {
        const mid = id as MetaUpgradeId;
        if (buyMeta(this.save, mid, Number(el.dataset.lvl))) {
          this.persist();
          audio.play('upgrade');
          this.toast(`${META_UPGRADES[mid].name} → niveau ${this.save.meta[mid]}`, 'good');
        }
        this.renderGarage();
        break;
      }
      case 'select-node': this.selectedNode = id; this.renderMap(); break;
      case 'depart': this.depart(); break;
      case 'field-repair': {
        const hp = fieldRepair(this.run!, id as VehicleId);
        if (hp > 0) this.toast(`${VNAME[id as VehicleId]} : +${hp} PV`, 'good');
        this.rerender();
        break;
      }
      case 'abandon': this.confirmAbandon(); break;
      case 'abandon-yes': this.endRun('defeat', 'Expédition abandonnée'); break;
      case 'event-choice': this.chooseEvent(Number(id)); break;
      case 'event-continue': this.eventResult = null; this.toMap(); break;
      case 'event-fight': this.eventResult = null; this.startDrive('ambush', () => this.toMap()); break;
      case 'reward-pick': {
        if (grantUpgrade(this.run!, id as RunUpgradeId)) { audio.play('upgrade'); this.toast(`${RUN_UPGRADES[id as RunUpgradeId].name} installé`, 'good'); }
        this.toMap();
        break;
      }
      case 'reward-scrap': addRes(this.run!, { scrap: 12 }); this.toMap(); break;
      case 'ws-repair': if (repairVehicle(this.run!, id as VehicleId)) this.toast(`${VNAME[id as VehicleId]} réparé`, 'good'); this.rerender(); break;
      case 'ws-buy': {
        if (buyUpgrade(this.run!, id as RunUpgradeId)) {
          audio.play('upgrade');
          this.toast(`${RUN_UPGRADES[id as RunUpgradeId].name} installé`, 'good');
          this.workshopOffers = this.workshopOffers.filter((x) => x !== id || (this.run!.upgrades[x] ?? 0) < RUN_UPGRADES[x].maxLevel);
        }
        this.rerender();
        break;
      }
      case 'ws-fuel': if (pay(this.run!, { scrap: 8 })) addRes(this.run!, { fuel: 10 }); this.rerender(); break;
      case 'ws-food': if (pay(this.run!, { scrap: 6 })) addRes(this.run!, { food: 4 }); this.rerender(); break;
      case 'camp-rest': if (!this.campUsed.has('rest') && pay(this.run!, { food: 2 })) { healPct(this.run!, 'all', 0.3); this.campUsed.add('rest'); this.toast('Le convoi se repose : +30 % PV', 'good'); } this.rerender(); break;
      case 'camp-scavenge': {
        if (this.campUsed.has('scav')) break;
        this.campUsed.add('scav');
        const r = rngFor(this.run!);
        const ok = r.chance(0.6);
        this.run!.rngState = r.state;
        if (ok) { addRes(this.run!, { scrap: 6 }); this.toast('Fouille fructueuse : +6 ferraille', 'good'); } else { addRes(this.run!, { food: 2 }); this.toast('Quelques conserves : +2 provisions'); }
        this.rerender();
        break;
      }
      case 'leave': this.toMap(); break;
      case 'pause': this.pause(); break;
      case 'resume': this.resume(); break;
      case 'pause-settings': this.settingsReturn = 'pause'; this.renderSettings(this.overlayEl); break;
      case 'settings-back': if (this.settingsReturn === 'pause') this.openPause(); else this.show('menu'); break;
      case 'toggle-mute': this.save.settings.muted = !this.save.settings.muted; this.settingsChanged(el); break;
      case 'toggle-drive': this.save.settings.driveMode = this.save.settings.driveMode === 'toggle' ? 'hold' : 'toggle'; this.settingsChanged(el); break;
      case 'toggle-shake': this.save.settings.screenShake = !this.save.settings.screenShake; this.settingsChanged(el); break;
      case 'reset-tuto': this.save.tutorialDone = false; this.persist(); this.toast('L\'aide s\'affichera à la prochaine expédition.'); break;
      case 'reset-save': {
        if (!this.confirmReset) { this.confirmReset = true; el.textContent = 'Confirmer la remise à zéro'; break; }
        const keepSettings = this.save.settings;
        this.save = defaultSave();
        this.save.settings = keepSettings;
        this.persist();
        this.confirmReset = false;
        this.toast('Progression remise à zéro.', 'warn');
        this.show('menu');
        break;
      }
      case 'toggle-mode': this.input.toggle(); break;
      case 'result-garage': this.run = null; this.show('garage'); break;
      case 'result-menu': this.run = null; this.show('menu'); break;
      case 'dismiss-rotate': document.getElementById('rotate')?.classList.add('dismissed'); break;
    }
  }

  private onInput(e: Event) {
    const el = e.target as HTMLInputElement;
    if (el.dataset.set === 'music') this.save.settings.musicVolume = Number(el.value) / 100;
    else if (el.dataset.set === 'sfx') { this.save.settings.sfxVolume = Number(el.value) / 100; audio.play('pickup'); }
    else return;
    this.applySettings();
    this.persist();
    const lab = el.parentElement?.querySelector('output');
    if (lab) lab.textContent = `${el.value} %`;
  }

  private settingsChanged(el: HTMLElement) {
    this.applySettings();
    this.persist();
    const host = el.closest('#overlay') ? this.overlayEl : this.screenEl;
    this.renderSettings(host);
  }

  private rerender() {
    this.show(this.screen);
  }

  // =================================================================== menu / garage / aide / réglages
  private renderMenu() {
    const p = this.save.profile;
    this.scene.startDemo();
    this.screenEl.innerHTML = `
      <div class="title-wrap">
        <h1 class="logo">CONVOY <span>ZERO</span></h1>
        <div class="tagline">Traverser les terres mortes. Ensemble.</div>
      </div>
      <div class="menu-buttons">
        <button class="btn big" data-act="play" autofocus>Jouer</button>
        <button class="btn alt" data-act="garage">Garage</button>
        <button class="btn ghost" data-act="howto">Comment jouer</button>
        <button class="btn ghost" data-act="settings">Paramètres</button>
      </div>
      <div class="menu-foot">
        <span class="coins">◉ ${this.save.coins} pièces de convoi</span> · Expéditions : ${p.runs} · Victoires : ${p.victories} · Record : ${p.bestSteps} étapes
        ${this.storage ? '' : '<br><span style="color:var(--danger)">Stockage local indisponible : la progression ne sera pas sauvegardée.</span>'}
      </div>`;
  }

  private renderGarage() {
    const s = this.save;
    const cards = ALL_META_UPGRADES.map((id) => {
      const d = META_UPGRADES[id];
      const lv = s.meta[id];
      const cost = metaCost(s, id);
      const pips = Array.from({ length: META_MAX }, (_, i) => `<i class="pip ${i < lv ? 'on' : ''}"></i>`).join('');
      return `<div class="card">
        <div class="row"><span class="icon">${d.icon}</span><span class="name">${d.name}</span></div>
        <div class="desc">${lv > 0 ? d.desc(lv) : 'Non acquis'}${lv < META_MAX ? ` → <b>${d.desc(lv + 1)}</b>` : ''}</div>
        <div class="row between"><div class="pips">${pips}</div>
        ${cost === null ? '<span class="tag">Max</span>' : `<button class="btn small" data-act="buy-meta" data-id="${id}" data-lvl="${lv}" ${s.coins < cost ? 'disabled' : ''}>◉ ${cost}</button>`}</div>
      </div>`;
    }).join('');
    const veh = VEHICLE_IDS.map((id) => {
      const st = vehicleStats(id, {}, s.meta);
      return `<div class="card"><div class="name">${VNAME[id]}</div><div class="desc">${VEHICLES[id].role}</div>
        <div class="muted">${st.maxHp} PV · ${Math.round(st.damage)} dégâts · ${(1 / st.fireCooldown).toFixed(1)} tirs/s · portée ${Math.round(st.range)}</div></div>`;
    }).join('');
    this.screenEl.innerHTML = `<div class="panel">
      <div class="row between"><h2>Garage</h2><span class="coins" style="font-size:22px">◉ ${s.coins} pièces</span></div>
      <p class="muted">Les améliorations permanentes s'appliquent à toutes les expéditions. Les pièces de convoi se gagnent au bilan de chaque expédition.</p>
      <div class="grid" style="margin:12px 0">${cards}</div>
      <h3>Le convoi</h3>
      <div class="grid garage-veh">${veh}</div>
      <div class="row between panel-foot">
        <button class="btn ghost" data-act="back-menu">Retour</button>
        <label class="row muted">Graine (optionnelle) <input id="seed" maxlength="16" placeholder="aléatoire" style="min-height:44px;width:140px;background:#120d0a;color:var(--sand);border:1px solid var(--ink-3);padding:6px 10px;font-family:inherit;font-size:16px" /></label>
        <button class="btn big" data-act="launch">Lancer l'expédition</button>
      </div></div>`;
  }

  private renderHowto() {
    const enemies = (['marauder', 'gunner', 'scout', 'brute', 'kamikaze'] as const).map((t) => `<div class="card"><span class="name">${ENEMIES[t].name}</span><span class="desc">${ENEMIES[t].desc}</span></div>`).join('');
    this.screenEl.innerHTML = `<div class="panel">
      <h2>Comment jouer</h2>
      <p>Menez le convoi jusqu'au refuge : <b>6 étapes</b> sur une carte à embranchements, puis l'<b>embuscade finale</b> du Béhémoth. Si le <b>Mastodonte</b> (commandement) est détruit, l'expédition est perdue. Les escortes détruites ne bloquent pas la route et peuvent être remises en route à l'atelier.</p>
      <div class="grid" style="margin:10px 0">
        <div class="card"><h3>Conduite</h3>
          <div class="keys"><span><kbd>←↑↓→</kbd> / <kbd>WASD</kbd> (ZQSD en AZERTY)</span><span>Prendre le volant</span>
          <span><kbd>Espace</kbd> ou bouton</span><span>Basculer AUTO / MANUEL</span>
          <span><kbd>Échap</kbd> / <kbd>P</kbd></span><span>Pause</span>
          <span>Mobile</span><span>Joystick à gauche, bouton de mode à droite</span></div>
          <p class="muted">En AUTO, le convoi évite les obstacles et ramasse les ressources. Les tirs sont automatiques, avec priorité aux kamikazes.</p></div>
        <div class="card"><h3>Ressources</h3>
          <p>${resHtml('fuel', 0).replace('<b>0</b>', '<b>Carburant</b>')} : chaque étape en consomme. À sec, la ferraille (2 par unité) puis la coque compensent.</p>
          <p>${resHtml('scrap', 0).replace('<b>0</b>', '<b>Ferraille</b>')} : réparations, améliorations, échanges.</p>
          <p>${resHtml('food', 0).replace('<b>0</b>', '<b>Provisions</b>')} : 2 par étape. Sans vivres, l'équipage affamé fait perdre 12 % PV au convoi.</p></div>
      </div>
      <h3>Menaces</h3>
      <div class="enemy-list">${enemies}</div>
      <p class="muted" style="margin-top:10px">Lignes rouges pointillées = tir imminent : changez de voie. Cercle rouge = kamikaze sur le point d'exploser. Biomes : ${Object.values(BIOMES).map((b) => `<b>${b.name}</b> (${b.hazard.toLowerCase()})`).join(', ')}.</p>
      <p class="muted">Quitter une expédition en cours la termine (pas de reprise en V1) ; les pièces déjà méritées sont conservées.</p>
      <div class="row center" style="margin-top:12px"><button class="btn" data-act="back-menu">Compris</button></div>
    </div>`;
  }

  private renderSettings(host: HTMLElement) {
    const s = this.save.settings;
    host.classList.remove('hidden');
    host.innerHTML = `<div class="panel narrow">
      <h2>Paramètres</h2>
      <div class="setting"><span>Musique</span><span class="row"><input type="range" min="0" max="100" value="${Math.round(s.musicVolume * 100)}" data-set="music" aria-label="Volume musique"><output>${Math.round(s.musicVolume * 100)} %</output></span></div>
      <div class="setting"><span>Effets sonores</span><span class="row"><input type="range" min="0" max="100" value="${Math.round(s.sfxVolume * 100)}" data-set="sfx" aria-label="Volume effets"><output>${Math.round(s.sfxVolume * 100)} %</output></span></div>
      <div class="setting"><span>Son</span><button class="btn small switch ${s.muted ? 'danger' : 'alt'}" data-act="toggle-mute">${s.muted ? 'Coupé' : 'Activé'}</button></div>
      <div class="setting"><span>Conduite manuelle<br><span class="muted">${s.driveMode === 'toggle' ? 'Bascule : une direction ou Espace passe en manuel, Espace/bouton revient en AUTO' : 'Maintien : manuel tant qu\'une direction est tenue'}</span></span><button class="btn small switch alt" data-act="toggle-drive">${s.driveMode === 'toggle' ? 'Bascule' : 'Maintien'}</button></div>
      <div class="setting"><span>Tremblements d'écran</span><button class="btn small switch ${s.screenShake ? 'alt' : 'ghost'}" data-act="toggle-shake">${s.screenShake ? 'Oui' : 'Non'}</button></div>
      <div class="setting"><span>Aide de première partie</span><button class="btn small ghost" data-act="reset-tuto">Revoir</button></div>
      ${this.settingsReturn === 'menu' ? '<div class="setting"><span>Progression</span><button class="btn small danger" data-act="reset-save">Remettre à zéro</button></div>' : ''}
      <div class="row center" style="margin-top:14px"><button class="btn" data-act="settings-back">Retour</button></div>
    </div>`;
  }

  // =================================================================== expédition
  startRun(seedInput?: string) {
    const clean = (seedInput ?? '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
    const seed = clean || randomSeedString();
    this.run = createRun(seed, this.save.meta);
    this.ending = false;
    this.selectedNode = null;
    this.driveSalt = 0;
    this.save.profile.runs += 1;
    this.persist();
    this.toast(`Expédition ${seed} : bonne route.`);
    this.toMap();
  }

  private toMap() {
    if (!this.run || this.run.outcome) return;
    this.selectedNode = null;
    const opts = reachable(this.run.map, this.run.currentId);
    if (opts.length === 1) this.selectedNode = opts[0];
    const cur = this.run.currentId ? this.run.map.nodes[this.run.currentId] : null;
    this.scene.timeScale = 1;
    this.scene.startDemo(cur ? cur.biome : 'desert');
    this.show('map');
  }

  private renderMap() {
    const run = this.run!;
    const map = run.map;
    const opts = reachable(map, run.currentId);
    const W = 1000, H = 560;
    const px = (layer: number) => 70 + (layer * (W - 140)) / map.layers;
    const py = (lane: number) => 50 + lane * (H - 100);
    let edges = '';
    let nodes = '';
    const onPath = (a: string, b: string) => {
      const ia = run.visited.indexOf(a), ib = run.visited.indexOf(b);
      return ia >= 0 && ib === ia + 1;
    };
    // bandes de biomes
    const bands = [['desert', 0, 1], ['industrial', 2, 3], ['night', 4, 6]] as const;
    const bandCol = { desert: 'rgba(227,196,143,0.07)', industrial: 'rgba(160,160,170,0.07)', night: 'rgba(120,90,140,0.10)' };
    const bandsSvg = bands.map(([b, a, z]) => {
      const x0 = px(a) - 45, x1 = px(z) + 45;
      return `<rect x="${x0}" y="8" width="${x1 - x0}" height="${H - 16}" fill="${bandCol[b]}" rx="8"/><text x="${(x0 + x1) / 2}" y="${H - 16}" text-anchor="middle" fill="#b9a582" font-size="15" letter-spacing="2">${BIOMES[b].name.toUpperCase()}</text>`;
    }).join('');
    for (const n of Object.values(map.nodes)) {
      for (const t of n.next) {
        const m = map.nodes[t];
        const active = (run.currentId === n.id && opts.includes(t)) || (run.currentId === null && false);
        const walked = onPath(n.id, t);
        edges += `<line x1="${px(n.layer)}" y1="${py(n.lane)}" x2="${px(m.layer)}" y2="${py(m.lane)}" stroke="${walked ? '#2fb8b0' : active ? '#e9d6b0' : 'rgba(233,214,176,0.22)'}" stroke-width="${walked ? 5 : active ? 3 : 2}" ${active ? 'stroke-dasharray="10 7"' : ''}/>`;
      }
    }
    if (run.currentId === null) {
      // point de départ
      for (const id of map.startIds) {
        const m = map.nodes[id];
        edges += `<line x1="18" y1="${H / 2}" x2="${px(m.layer)}" y2="${py(m.lane)}" stroke="#e9d6b0" stroke-width="3" stroke-dasharray="10 7"/>`;
      }
    }
    for (const n of Object.values(map.nodes)) {
      const reach = opts.includes(n.id);
      const visited = run.visited.includes(n.id);
      const cur = run.currentId === n.id;
      const cls = ['map-node', reach ? 'reachable' : '', visited ? 'visited' : '', !reach && !visited ? 'locked' : '', this.selectedNode === n.id ? 'selected' : ''].join(' ');
      const r = n.type === 'final' ? 34 : 24;
      const ev = n.type === 'event' && n.eventId ? EVENTS_BY_ID[n.eventId].icon : NODE_ICON[n.type];
      nodes += `<g class="${cls}" ${reach ? `data-act="select-node" data-id="${n.id}" role="button" tabindex="0" aria-label="${NODE_LABEL[n.type]}"` : ''} transform="translate(${px(n.layer)},${py(n.lane)})">
        <circle r="${r + 9}" class="ring"/>
        <circle r="${r}" fill="${NODE_COLOR[n.type]}" stroke="${cur ? '#7fe3d8' : '#1d1612'}" stroke-width="${cur ? 5 : 3}"/>
        <text y="7" text-anchor="middle" font-size="${n.type === 'final' ? 30 : 21}" fill="#f2e3c6">${ev}</text>
        ${n.type === 'route' || n.type === 'final' ? `<text y="${r + 18}" text-anchor="middle" font-size="13" fill="#ff8a6a">${'☠'.repeat(n.risk)}</text>` : ''}
        ${visited && !cur ? `<text x="${r - 4}" y="${-r + 6}" font-size="16" fill="#7fe3d8">✓</text>` : ''}
      </g>`;
    }
    const convoyMark = run.currentId === null ? `<g transform="translate(18,${H / 2})"><rect x="-12" y="-9" width="24" height="18" rx="4" fill="#c9773a" stroke="#1d1612" stroke-width="2"/></g>` : '';
    const sel = this.selectedNode ? map.nodes[this.selectedNode] : null;
    let info = '<p class="muted">Choisissez la prochaine étape sur la carte (nœuds clignotants).</p>';
    if (sel) {
      const fuel = fuelCostFor(run, sel.id);
      const enough = run.res.fuel >= fuel;
      const ev = sel.eventId ? EVENTS_BY_ID[sel.eventId] : null;
      const reward = {
        route: 'Combat intense. À l\'arrivée : <b>1 amélioration gratuite</b> au choix parmi 3. Butin abondant.',
        event: `Rencontre : <b>${ev?.title ?? '?'}</b>. Choix tactiques avec coûts et risques annoncés. Trajet modérément dangereux.`,
        workshop: 'Réparations à <b>4 PV par ferraille</b>, remise en route des escortes, achats d\'améliorations et de ressources.',
        camp: 'Repos (+30 % PV contre 2 provisions) et fouille des environs.',
        final: 'Le Béhémoth et sa horde barrent la route du refuge. Détruisez-le pour gagner.',
      }[sel.type];
      info = `<div class="node-info"><h3>${NODE_LABEL[sel.type]}</h3>
        <p class="muted">${BIOMES[sel.biome].name} — ${BIOMES[sel.biome].hazard}</p>
        <p>Danger : <span class="risk">${'☠'.repeat(sel.risk)}</span></p>
        <p>${reward}</p>
        <p class="cost ${enough ? '' : 'no'}">Trajet : ${resHtml('fuel', fuel)} ${resHtml('food', 2)}</p>
        ${enough ? '' : '<p class="muted" style="color:var(--danger)">Carburant insuffisant : le manque sera compensé par la ferraille (2 par unité), puis par des dégâts au Mastodonte (jamais mortels).</p>'}
        ${run.res.food < 2 ? '<p class="muted" style="color:var(--danger)">Provisions insuffisantes : l\'équipage affamé fera perdre 12 % PV à chaque véhicule.</p>' : ''}
        <button class="btn big" style="width:100%;margin-top:8px" data-act="depart">Partir</button></div>`;
    }
    const step = run.visited.length;
    this.screenEl.innerHTML = `<div class="map-layout">
      <div class="map-main">
        <div class="row between"><h2 style="margin:0">Carte — étape ${Math.min(step + 1, map.layers + 1)} / ${map.layers + 1}</h2>${this.resBar(run.res)}</div>
        <div class="map-svg-wrap"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${bandsSvg}${edges}${convoyMark}${nodes}</svg></div>
      </div>
      <div class="map-side panel" style="width:auto;padding:14px">
        ${info}
        <h3 style="margin-top:12px">Convoi</h3>
        ${this.vehiclesHtml('field')}
        <p class="muted">Réparation de fortune : 2 PV par ferraille.</p>
        <h3>Améliorations</h3>
        <p class="muted">${Object.entries(run.upgrades).map(([k, l]) => `${RUN_UPGRADES[k as RunUpgradeId].name}${(l ?? 0) > 1 ? ` ×${l}` : ''}`).join(' · ') || 'Aucune pour l\'instant.'}</p>
        <div class="row between" style="margin-top:auto"><span class="muted">Graine ${esc(run.seed)}</span><button class="btn small ghost" data-act="abandon">Abandonner</button></div>
      </div></div>`;
  }

  private depart() {
    const run = this.run!;
    const id = this.selectedNode;
    if (!id || !reachable(run.map, run.currentId).includes(id)) return;
    const rep = travelTo(run, id);
    if (rep.emergencyScrap > 0) this.toast(`Panne sèche évitée : ${rep.emergencyScrap} ferraille brûlée`, 'warn');
    if (rep.emergencyHull > 0) this.toast(`Remorquage forcé : −${rep.emergencyHull} PV au Mastodonte`, 'warn');
    if (rep.hunger) this.toast('Plus de provisions : l\'équipage affamé (−12 % PV)', 'warn');
    const node = run.map.nodes[id];
    const kind: SegmentKind = node.type === 'final' ? 'final' : node.type;
    this.startDrive(kind, () => this.afterSegment());
  }

  private afterSegment() {
    const run = this.run!;
    completeStep(run);
    const node = run.map.nodes[run.currentId!];
    switch (node.type) {
      case 'final': this.endRun('victory'); break;
      case 'route': this.rewardOffers = randomUpgradeChoices(run, 3); this.rewardOffers.length ? this.show('reward') : this.toMap(); break;
      case 'event': this.eventResult = null; this.show('event'); break;
      case 'workshop': this.workshopOffers = randomUpgradeChoices(run, 4); this.show('workshop'); break;
      case 'camp': this.campUsed.clear(); this.show('camp'); break;
    }
  }

  // =================================================================== conduite
  private startDrive(kind: SegmentKind, onCleared: () => void) {
    const run = this.run!;
    const node = run.map.nodes[run.currentId!];
    this.driveSalt += 1;
    const seed = (seedFromString(run.seed) ^ Math.imul(this.driveSalt, 0x9e3779b1)) >>> 0;
    this.input.reset();
    this.input.enabled = true;
    this.input.mode = this.save.settings.driveMode;
    this.paused = false;
    this.scene.paused = false;
    this.scene.timeScale = this.testMode ? Number(new URLSearchParams(location.search).get('speed') ?? 1) || 1 : 1;
    audio.setMood(kind === 'final' ? 'drive' : 'drive');
    this.show('drive');
    this.updateModeButton();
    this.hintStep = this.save.tutorialDone ? 99 : 0;
    this.hintTimer = 0;
    this.updateHint(0);
    const biome = BIOMES[node.biome];
    this.hudEl.querySelector('#hud-label')!.textContent = `${kind === 'ambush' ? 'Embuscade' : NODE_LABEL[node.type]} · ${biome.name}`;
    this.scene.startSegment(
      { kind, biome: node.biome, depth: node.layer, risk: node.risk, seed, run },
      {
        onFrame: (sim) => this.onFrame(sim),
        onEvent: (e) => this.onSimEvent(e),
        onEnd: (sim) => {
          this.input.enabled = false;
          sim.writeBack(run);
          this.sim = null;
          if (sim.outcome === 'lost') {
            setTimeout(() => this.endRun('defeat', 'Le Mastodonte a été détruit'), 1400);
          } else {
            if (!this.save.tutorialDone) { this.save.tutorialDone = true; this.persist(); }
            const c = sim.collected;
            const gains = [c.scrap && `+${c.scrap} ferraille`, c.fuel && `+${c.fuel} carburant`, c.food && `+${c.food} provisions`].filter(Boolean);
            this.toast(`Étape franchie${gains.length ? ' : ' + gains.join(', ') : ''}`, 'good');
            setTimeout(onCleared, 700);
          }
        },
      },
    );
    this.sim = this.scene.sim;
  }

  private onSimEvent(e: SimEvent) {
    if (e.type === 'destroyed') {
      this.toast(e.vehicle === 'command' ? 'Le Mastodonte est détruit !' : `${VNAME[e.vehicle]} détruit — le convoi continue`, 'warn');
    }
    if (e.type === 'gust') this.toast(`Rafale de sable ${e.dir > 0 ? 'vers le bas' : 'vers le haut'} !`, 'warn');
    if (e.type === 'bossSpawn') this.toast('Le Béhémoth surgit !', 'warn');
  }

  private buildHud() {
    this.hudEl.innerHTML = `
      <div class="hud-top">
        <div class="hud-box hud-res" id="hud-res"></div>
        <div class="hud-box hud-progress"><div class="label"><span id="hud-label"></span><span id="hud-pct"></span></div><div class="progress"><i id="hud-prog"></i></div></div>
        <div class="hud-box hud-vehicles" id="hud-veh"></div>
        <button class="btn small ghost hud-pause" data-act="pause" aria-label="Pause">❚❚</button>
      </div>
      <div class="bossbar hidden" id="hud-boss">Béhémoth<div class="progress"><i id="hud-boss-bar"></i></div></div>
      <div class="joystick" id="joy"><div class="knob" id="knob"></div></div>
      <button class="btn mode-btn alt" id="mode-btn" data-act="toggle-mode">AUTO</button>
      <div class="hint hidden" id="hint"></div>`;
    const joy = this.hudEl.querySelector('#joy') as HTMLElement;
    const knob = this.hudEl.querySelector('#knob') as HTMLElement;
    let pid: number | null = null;
    const move = (ev: PointerEvent) => {
      const r = joy.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = ev.clientX - cx, dy = ev.clientY - cy;
      const max = r.width / 2 - 10;
      const len = Math.hypot(dx, dy);
      if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.input.setJoystick(dx / max, dy / max, true);
    };
    joy.addEventListener('pointerdown', (ev) => { pid = ev.pointerId; joy.setPointerCapture(ev.pointerId); move(ev); ev.preventDefault(); });
    joy.addEventListener('pointermove', (ev) => { if (ev.pointerId === pid) move(ev); });
    const end = (ev: PointerEvent) => { if (ev.pointerId !== pid) return; pid = null; knob.style.transform = ''; this.input.setJoystick(0, 0, false); };
    joy.addEventListener('pointerup', end);
    joy.addEventListener('pointercancel', end);
  }

  private updateModeButton() {
    const b = this.hudEl.querySelector('#mode-btn') as HTMLElement | null;
    if (!b) return;
    const manual = this.input.mode === 'toggle' ? this.input.manualToggle : false;
    b.textContent = this.input.mode === 'hold' ? 'AUTO*' : manual ? 'MANUEL' : 'AUTO';
    b.classList.toggle('manual', manual);
    b.setAttribute('aria-pressed', String(manual));
  }

  private onFrame(sim: DriveSim) {
    const now = performance.now();
    if (now - this.hudTimer < 100) return;
    const dt = this.hudTimer ? (now - this.hudTimer) / 1000 : 0;
    this.hudTimer = now;
    const run = this.run;
    if (!run) return;
    const c = sim.collected;
    const resEl = this.hudEl.querySelector('#hud-res')!;
    resEl.innerHTML = (['fuel', 'scrap', 'food'] as ResourceKey[]).map((k) => resHtml(k, run.res[k] + c[k], c[k] > 0 ? `<span class="delta">+${c[k]}</span>` : '')).join('');
    const pct = Math.round(sim.progress * 100);
    (this.hudEl.querySelector('#hud-prog') as HTMLElement).style.width = `${pct}%`;
    this.hudEl.querySelector('#hud-pct')!.textContent = `${pct} %`;
    this.hudEl.querySelector('#hud-veh')!.innerHTML = sim.vehicles.map((v) => {
      const r = v.alive ? v.hp / v.maxHp : 0;
      return `<div class="hud-v ${v.alive ? '' : 'dead'}"><span>${VNAME[v.id]}</span><div class="hpbar ${r < 0.3 ? 'low' : r < 0.6 ? 'mid' : ''}"><i style="width:${r * 100}%"></i></div></div>`;
    }).join('');
    const boss = sim.boss;
    const bb = this.hudEl.querySelector('#hud-boss') as HTMLElement;
    bb.classList.toggle('hidden', !boss);
    if (boss) (this.hudEl.querySelector('#hud-boss-bar') as HTMLElement).style.width = `${(Math.max(0, boss.hp) / boss.maxHp) * 100}%`;
    if (!this.paused) this.updateHint(dt);
  }

  private updateHint(dt: number) {
    const el = this.hudEl.querySelector('#hint') as HTMLElement;
    const touch = window.matchMedia('(pointer: coarse)').matches;
    const steps = [
      'Le convoi roule et tire tout seul. Votre rôle : la trajectoire, les réparations et les choix.',
      touch ? 'Joystick à gauche : prenez le volant. Bouton AUTO/MANUEL à droite pour rendre la main.' : 'Flèches ou WASD/ZQSD : prenez le volant. Espace : retour au pilote AUTO.',
      'Lignes rouges = tir imminent, cercle rouge = kamikaze. Changez de voie !',
      'Ramassez ferraille, carburant et provisions. Le Glaneur les attire de loin.',
    ];
    if (this.hintStep >= steps.length) { el.classList.add('hidden'); return; }
    this.hintTimer += dt;
    if (this.hintTimer > 5.5) { this.hintStep += 1; this.hintTimer = 0; }
    if (this.hintStep >= steps.length) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.textContent = steps[this.hintStep];
  }

  pause() {
    if (this.screen !== 'drive' || this.ending) { if (this.screen !== 'drive') this.openPause(); return; }
    this.paused = true;
    this.scene.paused = true;
    this.input.enabled = false;
    this.openPause();
  }

  private openPause() {
    this.overlayEl.classList.remove('hidden');
    const inRun = !!this.run && !this.run.outcome;
    this.overlayEl.innerHTML = `<div class="panel narrow" style="text-align:center">
      <h2>Pause</h2>
      <div class="menu-buttons" style="margin:0 auto">
        <button class="btn big" data-act="resume">Reprendre</button>
        <button class="btn ghost" data-act="pause-settings">Paramètres</button>
        ${inRun ? '<button class="btn danger" data-act="abandon">Abandonner l\'expédition</button>' : ''}
      </div>
      <p class="muted" style="margin-top:12px">Quitter termine l'expédition (pas de reprise en V1).</p></div>`;
  }

  resume() {
    this.overlayEl.classList.add('hidden');
    if (this.screen === 'drive') {
      this.paused = false;
      this.scene.paused = false;
      this.input.enabled = true;
      this.input.reset();
      this.updateModeButton();
    }
  }

  private confirmAbandon() {
    if (this.screen === 'drive') { this.paused = true; this.scene.paused = true; }
    this.overlayEl.classList.remove('hidden');
    this.overlayEl.innerHTML = `<div class="panel narrow" style="text-align:center">
      <h2>Abandonner ?</h2>
      <p>L'expédition sera terminée. Vous conservez les pièces de convoi méritées jusqu'ici.</p>
      <div class="row center" style="margin-top:12px"><button class="btn ghost" data-act="resume">Annuler</button><button class="btn danger" data-act="abandon-yes">Abandonner</button></div></div>`;
  }

  // =================================================================== événements / récompenses / atelier
  private renderEvent() {
    const run = this.run!;
    const node = run.map.nodes[run.currentId!];
    const ev = EVENTS_BY_ID[node.eventId!];
    let body: string;
    if (this.eventResult) {
      body = `<div class="result-box">${esc(this.eventResult.text)}</div>
        <div class="row center" style="margin-top:14px">${this.eventResult.ambush ? '<button class="btn big danger" data-act="event-fight">Combattre !</button>' : '<button class="btn big" data-act="event-continue">Continuer</button>'}</div>`;
    } else {
      body = `<div class="choices">${ev.choices.map((c, i) => {
        const ok = canAfford(run, c.cost);
        return `<button class="btn ${c.label === 'Passer son chemin' ? 'ghost' : 'alt'} choice-btn" data-act="event-choice" data-id="${i}" ${ok ? '' : 'disabled'}>
          <span class="lbl">${esc(c.label)}</span>${c.cost ? this.costHtml(c.cost) : ''}<span class="out">${esc(describeOutcomes(c))}</span></button>`;
      }).join('')}</div>`;
    }
    this.screenEl.innerHTML = `<div class="panel event-card">
      <div class="row"><div class="event-icon">${ev.icon}</div><div><h2 style="margin:0">${ev.title}</h2><p class="muted">${BIOMES[node.biome].name}</p></div><span class="spacer"></span>${this.resBar(run.res)}</div>
      <p style="font-size:18px;margin-top:12px">${esc(ev.text)}</p>
      ${body}</div>`;
  }

  private chooseEvent(idx: number) {
    const run = this.run!;
    const node = run.map.nodes[run.currentId!];
    const res = resolveEventChoice(run, node.eventId!, idx);
    if (!res) return;
    const parts = [res.effect.text];
    const gained = (Object.keys(res.applied) as ResourceKey[]).filter((k) => res.applied[k]).map((k) => `${res.applied[k]! > 0 ? '+' : ''}${res.applied[k]} ${k === 'fuel' ? 'carburant' : k === 'scrap' ? 'ferraille' : 'provisions'}`);
    if (gained.length) parts.push(`(${gained.join(', ')})`);
    if (res.gainedUpgrade) { parts.push(`Amélioration obtenue : ${RUN_UPGRADES[res.gainedUpgrade].name}.`); audio.play('upgrade'); }
    if (res.effect.hpPct) parts.push(res.effect.hpPct.pct > 0 ? '' : '');
    this.eventResult = { text: parts.filter(Boolean).join(' '), ambush: !!res.effect.ambush };
    this.renderEvent();
  }

  private renderReward() {
    const run = this.run!;
    this.screenEl.innerHTML = `<div class="panel">
      <div class="row between"><h2>Butin de route</h2>${this.resBar(run.res)}</div>
      <p class="muted">Choisissez une amélioration gratuite pour cette expédition.</p>
      <div class="grid" style="margin:12px 0">${this.rewardOffers.map((id) => this.upgradeCard(id, 'reward-pick')).join('')}</div>
      <div class="row center"><button class="btn ghost" data-act="reward-scrap">Prendre 12 ferraille à la place</button></div></div>`;
  }

  private renderWorkshop() {
    const run = this.run!;
    const offers = this.workshopOffers.filter((id) => (run.upgrades[id] ?? 0) < RUN_UPGRADES[id].maxLevel);
    this.screenEl.innerHTML = `<div class="panel">
      <div class="row between"><h2>Atelier</h2>${this.resBar(run.res)}</div>
      <h3>Réparations (4 PV par ferraille)</h3>
      ${this.vehiclesHtml('workshop')}
      <h3 style="margin-top:12px">Améliorations</h3>
      <div class="grid" style="margin-bottom:12px">${offers.map((id) => this.upgradeCard(id, 'ws-buy', RUN_UPGRADES[id].cost)).join('') || '<p class="muted">Plus rien à vendre.</p>'}</div>
      <div class="row between">
        <div class="row"><button class="btn small alt" data-act="ws-fuel" ${run.res.scrap < 8 ? 'disabled' : ''}>+10 ${ICON.fuel.replace('<svg', '<svg style="width:16px;height:16px"')} pour 8 ${ICON.scrap.replace('<svg', '<svg style="width:16px;height:16px"')}</button>
        <button class="btn small alt" data-act="ws-food" ${run.res.scrap < 6 ? 'disabled' : ''}>+4 ${ICON.food.replace('<svg', '<svg style="width:16px;height:16px"')} pour 6 ${ICON.scrap.replace('<svg', '<svg style="width:16px;height:16px"')}</button></div>
        <button class="btn big" data-act="leave">Reprendre la route</button>
      </div></div>`;
  }

  private renderCamp() {
    const run = this.run!;
    this.screenEl.innerHTML = `<div class="panel narrow">
      <div class="row between"><h2>Camp</h2>${this.resBar(run.res)}</div>
      <p>Un abri sûr pour la nuit, à l'écart de la route.</p>
      ${this.vehiclesHtml('none')}
      <div class="choices">
        <button class="btn alt choice-btn" data-act="camp-rest" ${this.campUsed.has('rest') || run.res.food < 2 ? 'disabled' : ''}><span class="lbl">Se reposer</span>${this.costHtml({ food: 2 })}<span class="out">Tout le convoi récupère 30 % de ses PV.</span></button>
        <button class="btn alt choice-btn" data-act="camp-scavenge" ${this.campUsed.has('scav') ? 'disabled' : ''}><span class="lbl">Fouiller les environs</span><span class="out">60 % : +6 ferraille / 40 % : +2 provisions</span></button>
        <button class="btn big" data-act="leave">Reprendre la route</button>
      </div></div>`;
  }

  // =================================================================== fin d'expédition
  endRun(outcome: 'victory' | 'defeat', reason = '') {
    const run = this.run;
    if (!run || run.outcome || this.ending) return;
    this.ending = true;
    run.outcome = outcome;
    run.defeatReason = reason;
    const coins = coinsEarned(run);
    this.save.coins += coins;
    const p = this.save.profile;
    if (outcome === 'victory') p.victories += 1;
    p.bestSteps = Math.max(p.bestSteps, run.stats.stepsCleared);
    p.totalKills += run.stats.kills;
    p.totalCoinsEarned += coins;
    this.persist();
    this.paused = false;
    this.scene.paused = false;
    this.input.enabled = false;
    audio.setMood('menu');
    audio.play(outcome === 'victory' ? 'victory' : 'defeat');
    this.lastCoins = coins;
    this.show('result');
    this.ending = false;
  }
  private lastCoins = 0;

  private renderResult() {
    const run = this.run!;
    const s = run.stats;
    const win = run.outcome === 'victory';
    const kills = (Object.keys(s.killsByType) as (keyof typeof s.killsByType)[]).map((k) => `${ENEMIES[k].name} ×${s.killsByType[k]}`).join(' · ');
    this.screenEl.innerHTML = `<div class="panel ${win ? 'victory' : 'defeat'}" style="text-align:center">
      <h2>${win ? 'Refuge atteint !' : 'Expédition perdue'}</h2>
      <p>${win ? 'Le convoi franchit l\'ultime embuscade. Les portes du refuge s\'ouvrent.' : esc(run.defeatReason || 'Le convoi n\'ira pas plus loin.')}</p>
      <div class="stats">
        <div class="stat"><b>${s.stepsCleared} / ${run.map.layers + 1}</b><span>Étapes</span></div>
        <div class="stat"><b>${(s.distance / 1000).toFixed(1)} km</b><span>Distance</span></div>
        <div class="stat"><b>${s.kills}</b><span>Ennemis</span></div>
        <div class="stat"><b>${s.scrapCollected}</b><span>Ferraille récoltée</span></div>
        <div class="stat"><b>${s.eventsSeen}</b><span>Événements</span></div>
        <div class="stat"><b>${Math.floor(s.timeMs / 60000)}:${String(Math.floor((s.timeMs / 1000) % 60)).padStart(2, '0')}</b><span>Temps de route</span></div>
      </div>
      <p class="muted">${kills || 'Aucun ennemi détruit.'}</p>
      <p>Ressources restantes : ${resHtml('fuel', run.res.fuel)} ${resHtml('scrap', run.res.scrap)} ${resHtml('food', run.res.food)}</p>
      <p style="font-size:22px;margin:12px 0"><span class="coins">+${this.lastCoins} pièces de convoi</span> <span class="muted">(total ${this.save.coins})</span></p>
      <div class="row center"><button class="btn big" data-act="result-garage">Garage</button><button class="btn ghost" data-act="result-menu">Menu</button></div></div>`;
  }

  // =================================================================== crochets de test (?test)
  debug() {
    return {
      state: () => ({ screen: this.screen, run: this.run, save: this.save, paused: this.paused, sim: this.sim }),
      finishSegment: () => {
        const sim = this.scene.sim;
        if (!sim || sim.done) return;
        if (sim.cfg.kind === 'final') {
          if (!sim.boss) sim.boss = sim.spawnEnemy('boss', 1100, 360);
          sim.damageEnemy(sim.boss, 1e6, sim.boss.x, sim.boss.y);
        }
        sim.distance = sim.length;
      },
      killCommand: () => { const sim = this.scene.sim; if (sim) sim.damageVehicle(sim.command, 1e6, true); },
      setTimeScale: (n: number) => { this.scene.timeScale = n; },
      addCoins: (n: number) => { this.save.coins += n; this.persist(); },
    };
  }
}
