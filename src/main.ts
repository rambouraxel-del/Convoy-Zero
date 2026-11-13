import Phaser from 'phaser';
import { VIEW } from './config/balance';
import { InputManager } from './input/input';
import { DriveScene } from './scenes/DriveScene';
import { App } from './ui/app';
import './ui/styles.css';

const scene = new DriveScene();
const input = new InputManager();
scene.input2 = input;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW.w,
  height: VIEW.h,
  backgroundColor: '#120d0a',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [scene],
  audio: { noAudio: true },
  disableContextMenu: true,
  banner: false,
  fps: { target: 60, smoothStep: true },
  render: { antialias: true, powerPreference: 'high-performance' },
});

const app = new App(scene, input);
const params = new URLSearchParams(location.search);
app.testMode = params.has('test');

declare global {
  interface Window { __CZ?: unknown }
}
// Lecture d'état toujours disponible (diagnostic) ; crochets de triche uniquement avec ?test
window.__CZ = app.testMode ? { app, game, ...app.debug() } : { state: () => ({ screen: app.screen }) };
