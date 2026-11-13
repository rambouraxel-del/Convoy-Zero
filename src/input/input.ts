/**
 * Entrées unifiées : clavier (flèches / WASD, qui correspond physiquement à ZQSD en AZERTY), joystick tactile, bascule auto/manuel.
 * Mode « toggle » : Espace ou bouton bascule. Mode « hold » : manuel tant qu'une direction est tenue.
 */
import type { SimInput } from '../game/sim/sim';

export class InputManager {
  manualToggle = false;
  mode: 'toggle' | 'hold' = 'toggle';
  private keys = new Set<string>();
  private joy = { x: 0, y: 0, active: false };
  onToggle: (() => void) | null = null;
  onPause: (() => void) | null = null;
  enabled = false;

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) { if (this.isDir(e.code)) e.preventDefault(); return; }
      if (!this.enabled) return;
      if (e.code === 'Space') { e.preventDefault(); this.toggle(); return; }
      if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); this.onPause?.(); return; }
      if (this.isDir(e.code)) {
        e.preventDefault();
        this.keys.add(e.code);
        // une direction en mode auto reprend la main (mode toggle : bascule auto → manuel)
        if (this.mode === 'toggle' && !this.manualToggle) this.setManual(true);
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.joy.active = false; });
  }

  private isDir(code: string) {
    return ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(code);
  }

  toggle() {
    this.setManual(!this.manualToggle);
  }

  setManual(v: boolean) {
    if (this.manualToggle === v) return;
    this.manualToggle = v;
    this.onToggle?.();
  }

  reset() {
    this.keys.clear();
    this.joy = { x: 0, y: 0, active: false };
    this.manualToggle = false;
  }

  setJoystick(x: number, y: number, active: boolean) {
    this.joy = { x, y, active };
    if (active && this.mode === 'toggle' && !this.manualToggle && Math.hypot(x, y) > 0.25) this.setManual(true);
  }

  get isManual(): boolean {
    if (this.mode === 'hold') return this.hasDirection();
    return this.manualToggle;
  }

  private hasDirection(): boolean {
    return this.keys.size > 0 || (this.joy.active && Math.hypot(this.joy.x, this.joy.y) > 0.15);
  }

  read(): SimInput {
    let dx = 0, dy = 0;
    const k = this.keys;
    if (k.has('ArrowLeft') || k.has('KeyA')) dx -= 1;
    if (k.has('ArrowRight') || k.has('KeyD')) dx += 1;
    if (k.has('ArrowUp') || k.has('KeyW')) dy -= 1;
    if (k.has('ArrowDown') || k.has('KeyS')) dy += 1;
    if (this.joy.active) { dx += this.joy.x; dy += this.joy.y; }
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    return { manual: this.isManual, dx, dy };
  }
}
