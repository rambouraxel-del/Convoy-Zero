/**
 * Textures procédurales dessinées au Canvas 2D (aucun asset externe).
 * Tous les véhicules sont dessinés « vers la droite » (vue du dessus).
 */
import Phaser from 'phaser';
import { ROAD, VIEW } from '../config/balance';
import { Rng } from '../core/rng';
import type { Biome } from '../core/types';

type Ctx = CanvasRenderingContext2D;

export const PAL = {
  sand: '#d9b98a', sandDark: '#b8925f', rust: '#b5602f', rustDark: '#7a3b1c', asphalt: '#3b3a3c', asphaltLight: '#4b4a4d',
  teal: '#2fb8b0', tealLight: '#7fe3d8', petrol: '#1d5f6b', ink: '#1d1612', cream: '#f2e3c6',
  enemyRed: '#a8322b', enemyDark: '#3a1d1f', hazard: '#f2c230',
};

function canvas(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx, w: number, h: number) => void) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h)!;
  const ctx = tex.getContext();
  draw(ctx, w, h);
  tex.refresh();
}

function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function fillStroke(c: Ctx, fill: string | CanvasGradient, stroke = PAL.ink, lw = 2.5) {
  c.fillStyle = fill;
  c.fill();
  c.lineWidth = lw;
  c.strokeStyle = stroke;
  c.stroke();
}

function vgrad(c: Ctx, y0: number, y1: number, a: string, b: string) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
}

function wheel(c: Ctx, x: number, y: number, w: number, h: number) {
  rr(c, x, y, w, h, 3);
  fillStroke(c, '#222', PAL.ink, 2);
  c.strokeStyle = '#444';
  c.lineWidth = 1.5;
  for (let i = 1; i < 4; i++) {
    c.beginPath();
    c.moveTo(x + (w * i) / 4, y + 1);
    c.lineTo(x + (w * i) / 4, y + h - 1);
    c.stroke();
  }
}

function rivets(c: Ctx, pts: [number, number][]) {
  c.fillStyle = 'rgba(0,0,0,0.35)';
  for (const [x, y] of pts) {
    c.beginPath();
    c.arc(x, y, 1.6, 0, Math.PI * 2);
    c.fill();
  }
}

// ---------------------------------------------------------------- convoi
function drawCommand(c: Ctx, _w: number, h: number) {
  wheel(c, 10, 2, 22, 10); wheel(c, 40, 2, 22, 10); wheel(c, 78, 4, 18, 9);
  wheel(c, 10, h - 12, 22, 10); wheel(c, 40, h - 12, 22, 10); wheel(c, 78, h - 13, 18, 9);
  // caisse arrière
  rr(c, 4, 9, 70, h - 18, 7);
  fillStroke(c, vgrad(c, 9, h - 9, '#d58a4d', '#9a4f25'));
  c.strokeStyle = 'rgba(40,20,10,0.45)'; c.lineWidth = 2;
  for (let x = 16; x < 70; x += 12) { c.beginPath(); c.moveTo(x, 12); c.lineTo(x, h - 12); c.stroke(); }
  // bande turquoise
  c.fillStyle = PAL.teal; c.fillRect(6, h / 2 - 4, 66, 8);
  c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(6, h / 2 - 4, 66, 2);
  // cabine
  rr(c, 72, 11, 34, h - 22, 9);
  fillStroke(c, vgrad(c, 11, h - 11, '#e0a065', '#a85a2a'));
  rr(c, 90, 15, 12, h - 30, 4);
  fillStroke(c, vgrad(c, 15, h - 15, '#9ff0ea', '#2a8f93'), PAL.ink, 2);
  // pare-buffle
  c.fillStyle = '#5a5a5a'; rr(c, 104, 12, 5, h - 24, 2); fillStroke(c, '#6b6b6b', PAL.ink, 1.5);
  rivets(c, [[10, 14], [10, h - 14], [66, 14], [66, h - 14], [78, 15], [78, h - 15]]);
  // reflet
  c.fillStyle = 'rgba(255,255,255,0.18)'; rr(c, 8, 12, 62, 6, 3); c.fill();
}

function drawEscort(c: Ctx, w: number, h: number) {
  wheel(c, 6, 1, 18, 9); wheel(c, 50, 3, 14, 8);
  wheel(c, 6, h - 10, 18, 9); wheel(c, 50, h - 11, 14, 8);
  c.beginPath();
  c.moveTo(4, 9); c.lineTo(46, 7); c.lineTo(w - 4, h / 2 - 6); c.lineTo(w - 2, h / 2); c.lineTo(w - 4, h / 2 + 6); c.lineTo(46, h - 7); c.lineTo(4, h - 9); c.closePath();
  fillStroke(c, vgrad(c, 7, h - 7, '#e8cfa0', '#b08a55'));
  c.beginPath(); c.moveTo(30, 12); c.lineTo(w - 12, h / 2 - 3); c.lineTo(w - 12, h / 2 + 3); c.lineTo(30, h - 12); c.closePath();
  fillStroke(c, vgrad(c, 12, h - 12, '#4fd1c7', '#1e7f86'), PAL.ink, 2);
  // arceau
  c.strokeStyle = PAL.ink; c.lineWidth = 3; rr(c, 14, 12, 18, h - 24, 4); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(8, 10, 34, 3);
}

function drawSalvager(c: Ctx, _w: number, h: number) {
  wheel(c, 8, 2, 20, 10); wheel(c, 34, 2, 20, 10); wheel(c, 66, 4, 16, 9);
  wheel(c, 8, h - 12, 20, 10); wheel(c, 34, h - 12, 20, 10); wheel(c, 66, h - 13, 16, 9);
  rr(c, 4, 8, 58, h - 16, 6);
  fillStroke(c, vgrad(c, 8, h - 8, '#e8b44e', '#a8742a'));
  // bennes / grilles
  c.strokeStyle = 'rgba(50,30,10,0.5)'; c.lineWidth = 1.5;
  for (let y = 14; y < h - 12; y += 7) { c.beginPath(); c.moveTo(8, y); c.lineTo(58, y); c.stroke(); }
  // cabine
  rr(c, 60, 11, 28, h - 22, 8);
  fillStroke(c, vgrad(c, 11, h - 11, '#f0c36a', '#b07c2c'));
  rr(c, 76, 15, 9, h - 30, 3);
  fillStroke(c, vgrad(c, 15, h - 15, '#9ff0ea', '#2a8f93'), PAL.ink, 2);
  // grue + aimant
  c.strokeStyle = PAL.ink; c.lineWidth = 5; c.beginPath(); c.moveTo(48, h / 2); c.lineTo(14, h / 2 - 8); c.stroke();
  c.strokeStyle = '#8a8a8a'; c.lineWidth = 3; c.beginPath(); c.moveTo(48, h / 2); c.lineTo(14, h / 2 - 8); c.stroke();
  c.beginPath(); c.arc(14, h / 2 - 8, 9, 0, Math.PI * 2); fillStroke(c, '#5b5b5b');
  c.beginPath(); c.arc(14, h / 2 - 8, 5, 0, Math.PI * 2); fillStroke(c, PAL.teal, PAL.ink, 1.5);
}

function drawTurret(c: Ctx, _w: number, h: number, barrelLen: number, barrelW: number, base: number, color: string) {
  const cy = h / 2;
  rr(c, base - 2, cy - barrelW / 2, barrelLen, barrelW, 2);
  fillStroke(c, '#5d5d5d', PAL.ink, 2);
  c.fillStyle = '#333'; c.fillRect(base + barrelLen - 6, cy - barrelW / 2, 4, barrelW);
  c.beginPath(); c.arc(base, cy, base - 2, 0, Math.PI * 2);
  fillStroke(c, color, PAL.ink, 2);
  c.beginPath(); c.arc(base - 2, cy - 2, (base - 2) * 0.45, 0, Math.PI * 2);
  c.fillStyle = 'rgba(255,255,255,0.25)'; c.fill();
}

// ---------------------------------------------------------------- ennemis
function spikes(c: Ctx, x: number, y0: number, y1: number, n: number, len: number) {
  c.fillStyle = '#cfcfcf';
  for (let i = 0; i < n; i++) {
    const y = y0 + ((y1 - y0) * (i + 0.5)) / n;
    c.beginPath(); c.moveTo(x, y - 3); c.lineTo(x + len, y); c.lineTo(x, y + 3); c.closePath();
    c.fill(); c.strokeStyle = PAL.ink; c.lineWidth = 1; c.stroke();
  }
}

function drawMarauder(c: Ctx, _w: number, h: number) {
  wheel(c, 4, 2, 14, 8); wheel(c, 4, h - 10, 14, 8); wheel(c, 32, h / 2 - 4, 12, 8);
  c.beginPath(); c.moveTo(8, 9); c.lineTo(36, h / 2 - 5); c.lineTo(36, h / 2 + 5); c.lineTo(8, h - 9); c.closePath();
  fillStroke(c, vgrad(c, 8, h - 8, '#d24a3a', '#7c2219'));
  spikes(c, 38, h / 2 - 8, h / 2 + 8, 3, 9);
  c.beginPath(); c.arc(16, h / 2, 6, 0, Math.PI * 2); fillStroke(c, '#2b2b2b');
}

function drawGunner(c: Ctx, _w: number, h: number) {
  wheel(c, 8, 2, 16, 9); wheel(c, 42, 2, 14, 9); wheel(c, 8, h - 11, 16, 9); wheel(c, 42, h - 11, 14, 9);
  rr(c, 4, 8, 56, h - 16, 6);
  fillStroke(c, vgrad(c, 8, h - 8, '#7d2a3a', '#3e1420'));
  rr(c, 40, 12, 14, h - 24, 4); fillStroke(c, '#c94a5e', PAL.ink, 2);
  // canon
  rr(c, 18, h / 2 - 4, 44, 8, 2); fillStroke(c, '#4a4a4a');
  c.beginPath(); c.arc(20, h / 2, 9, 0, Math.PI * 2); fillStroke(c, '#5a1c28');
}

function drawScout(c: Ctx, w: number, h: number) {
  wheel(c, 6, 4, 12, 7); wheel(c, 6, h - 11, 12, 7);
  c.beginPath(); c.moveTo(4, 6); c.lineTo(w - 4, h / 2); c.lineTo(4, h - 6); c.lineTo(14, h / 2); c.closePath();
  fillStroke(c, vgrad(c, 6, h - 6, '#f0c43a', '#9c7414'));
  c.beginPath(); c.moveTo(18, 4); c.lineTo(30, h / 2 - 3); c.lineTo(18, h / 2 - 3); c.closePath(); fillStroke(c, PAL.enemyDark, PAL.ink, 1.5);
  c.beginPath(); c.moveTo(18, h - 4); c.lineTo(30, h / 2 + 3); c.lineTo(18, h / 2 + 3); c.closePath(); fillStroke(c, PAL.enemyDark, PAL.ink, 1.5);
  c.fillStyle = '#1a1a1a'; c.fillRect(22, h / 2 - 2, 20, 4);
}

function drawBrute(c: Ctx, w: number, h: number) {
  // chenilles
  rr(c, 2, 2, w - 10, 16, 6); fillStroke(c, '#262626');
  rr(c, 2, h - 18, w - 10, 16, 6); fillStroke(c, '#262626');
  c.strokeStyle = '#3d3d3d'; c.lineWidth = 2;
  for (let x = 8; x < w - 12; x += 8) { c.beginPath(); c.moveTo(x, 4); c.lineTo(x, 16); c.moveTo(x, h - 16); c.lineTo(x, h - 4); c.stroke(); }
  rr(c, 8, 12, w - 18, h - 24, 10);
  fillStroke(c, vgrad(c, 12, h - 12, '#5f6152', '#2e3027'), PAL.ink, 3);
  // plaques
  c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 2;
  rr(c, 16, 20, 36, h - 40, 4); c.stroke(); rr(c, 56, 20, 30, h - 40, 4); c.stroke();
  rivets(c, [[20, 24], [48, 24], [20, h - 24], [48, h - 24], [60, 24], [82, 24], [60, h - 24], [82, h - 24]]);
  // éperon
  c.beginPath(); c.moveTo(w - 12, 14); c.lineTo(w - 1, h / 2); c.lineTo(w - 12, h - 14); c.closePath(); fillStroke(c, '#8a8a8a');
  // yeux rouges
  c.fillStyle = '#ff3b2f'; c.fillRect(w - 20, h / 2 - 12, 5, 5); c.fillRect(w - 20, h / 2 + 7, 5, 5);
  c.beginPath(); c.arc(42, h / 2, 13, 0, Math.PI * 2); fillStroke(c, '#45473b', PAL.ink, 2.5);
  rr(c, 44, h / 2 - 5, 40, 10, 2); fillStroke(c, '#3a3a3a');
}

function drawKamikaze(c: Ctx, w: number, h: number) {
  wheel(c, 8, 1, 12, 7); wheel(c, 24, 1, 12, 7); wheel(c, 8, h - 8, 12, 7); wheel(c, 24, h - 8, 12, 7);
  c.save();
  c.beginPath(); c.arc(w / 2, h / 2, h / 2 - 5, 0, Math.PI * 2); c.clip();
  c.fillStyle = PAL.hazard; c.fillRect(0, 0, w, h);
  c.fillStyle = '#1b1b1b';
  for (let i = -h; i < w + h; i += 10) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 5, 0); c.lineTo(i + 5 - h, h); c.lineTo(i - h, h); c.closePath(); c.fill(); }
  c.restore();
  c.beginPath(); c.arc(w / 2, h / 2, h / 2 - 5, 0, Math.PI * 2); c.lineWidth = 2.5; c.strokeStyle = PAL.ink; c.stroke();
  c.beginPath(); c.arc(w / 2, h / 2, 6, 0, Math.PI * 2); fillStroke(c, '#ff3b2f', PAL.ink, 2);
}

function drawBoss(c: Ctx, w: number, h: number) {
  for (const x of [14, 44, 74, 104, 134]) { wheel(c, x, 4, 24, 14); wheel(c, x, h - 18, 24, 14); }
  rr(c, 6, 16, w - 40, h - 32, 14);
  fillStroke(c, vgrad(c, 16, h - 16, '#4a2a26', '#1f1110'), PAL.ink, 3.5);
  // plaques rouges
  c.fillStyle = '#8f2a22';
  for (const [x, y, ww, hh] of [[16, 24, 40, 26], [16, h - 50, 40, 26], [64, 24, 46, 26], [64, h - 50, 46, 26]] as const) { rr(c, x, y, ww, hh, 4); fillStroke(c, '#8f2a22', PAL.ink, 2); }
  // cabine avant + éperon
  rr(c, w - 44, 26, 30, h - 52, 8); fillStroke(c, vgrad(c, 26, h - 26, '#6a3a32', '#2e1714'), PAL.ink, 3);
  c.beginPath(); c.moveTo(w - 16, 20); c.lineTo(w - 1, h / 2); c.lineTo(w - 16, h - 20); c.closePath(); fillStroke(c, '#9a9a9a');
  spikes(c, w - 16, 24, h - 24, 6, 10);
  // emblème crâne
  c.beginPath(); c.arc(70, h / 2, 16, 0, Math.PI * 2); fillStroke(c, PAL.cream, PAL.ink, 2.5);
  c.fillStyle = PAL.ink; c.beginPath(); c.arc(64, h / 2 - 3, 4, 0, Math.PI * 2); c.arc(76, h / 2 - 3, 4, 0, Math.PI * 2); c.fill();
  c.fillRect(66, h / 2 + 6, 8, 5);
  // tourelles latérales
  for (const y of [h / 2 - 42, h / 2 + 42]) {
    c.beginPath(); c.arc(116, y, 11, 0, Math.PI * 2); fillStroke(c, '#5a1c28');
    rr(c, 118, y - 3, 30, 6, 2); fillStroke(c, '#444');
  }
  c.fillStyle = '#ff3b2f'; c.fillRect(w - 34, h / 2 - 20, 6, 6); c.fillRect(w - 34, h / 2 + 14, 6, 6);
}

// ---------------------------------------------------------------- obstacles / bonus
function drawRock(c: Ctx, w: number, h: number, seed: number) {
  const r = new Rng(seed);
  c.beginPath();
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rad = (w / 2 - 4) * r.range(0.75, 1);
    const x = w / 2 + Math.cos(a) * rad, y = h / 2 + Math.sin(a) * rad * 0.85;
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.closePath();
  fillStroke(c, vgrad(c, 0, h, '#a8957c', '#5f5040'));
  c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.ellipse(w / 2 - 6, h / 2 - 7, w / 5, h / 8, -0.4, 0, Math.PI * 2); c.fill();
}

function drawBarrel(c: Ctx, w: number, h: number) {
  c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 3, 0, Math.PI * 2); fillStroke(c, vgrad(c, 0, h, '#e0503a', '#8a2216'));
  c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 9, 0, Math.PI * 2); c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 2; c.stroke();
  c.fillStyle = PAL.hazard; c.beginPath(); c.moveTo(w / 2, h / 2 - 7); c.lineTo(w / 2 + 6, h / 2 + 5); c.lineTo(w / 2 - 6, h / 2 + 5); c.closePath(); c.fill();
}

function drawWreck(c: Ctx, w: number, h: number) {
  rr(c, 4, 8, w - 8, h - 16, 8); fillStroke(c, vgrad(c, 8, h - 8, '#6d5a4a', '#3a2c22'));
  c.fillStyle = 'rgba(30,20,15,0.8)'; rr(c, w * 0.55, 14, w * 0.25, h - 28, 4); c.fill();
  c.fillStyle = 'rgba(160,80,30,0.6)';
  for (const [x, y, r] of [[18, 16, 6], [w - 30, h - 18, 7], [w / 2, h / 2, 5]]) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
}

function drawMine(c: Ctx, w: number, h: number) {
  c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 3, 0, Math.PI * 2); fillStroke(c, '#4a4a40');
  c.fillStyle = '#2a2a24';
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; c.beginPath(); c.arc(w / 2 + Math.cos(a) * 8, h / 2 + Math.sin(a) * 8, 2, 0, Math.PI * 2); c.fill(); }
  c.beginPath(); c.arc(w / 2, h / 2, 4, 0, Math.PI * 2); fillStroke(c, '#ff3b2f', PAL.ink, 1);
}

function drawPothole(c: Ctx, w: number, h: number) {
  c.beginPath(); c.ellipse(w / 2, h / 2, w / 2 - 2, h / 2 - 2, 0, 0, Math.PI * 2);
  c.fillStyle = '#1c1b1d'; c.fill(); c.strokeStyle = '#5a5a5d'; c.lineWidth = 3; c.stroke();
}

function drawPickup(c: Ctx, w: number, h: number, kind: 'scrap' | 'fuel' | 'food') {
  c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 1, 0, Math.PI * 2);
  c.fillStyle = 'rgba(127,227,216,0.25)'; c.fill();
  if (kind === 'scrap') {
    c.save(); c.translate(w / 2, h / 2);
    c.beginPath();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; const r = i % 2 ? 7 : 10; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    c.closePath(); fillStroke(c, '#b9bcc2', PAL.ink, 2);
    c.beginPath(); c.arc(0, 0, 3, 0, Math.PI * 2); c.fillStyle = PAL.ink; c.fill();
    c.restore();
  } else if (kind === 'fuel') {
    rr(c, w / 2 - 7, h / 2 - 9, 14, 18, 3); fillStroke(c, '#d63b2c', PAL.ink, 2);
    c.fillStyle = '#333'; c.fillRect(w / 2 + 1, h / 2 - 12, 5, 4);
    c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(w / 2 - 4, h / 2 - 5); c.lineTo(w / 2 + 4, h / 2 + 5); c.stroke();
  } else {
    rr(c, w / 2 - 9, h / 2 - 7, 18, 14, 2); fillStroke(c, '#6f9a3a', PAL.ink, 2);
    c.strokeStyle = PAL.ink; c.lineWidth = 1.5; c.beginPath(); c.moveTo(w / 2 - 9, h / 2); c.lineTo(w / 2 + 9, h / 2); c.moveTo(w / 2, h / 2 - 7); c.lineTo(w / 2, h / 2 + 7); c.stroke();
  }
}

// ---------------------------------------------------------------- décor et sol
function speckle(c: Ctx, r: Rng, w: number, y0: number, y1: number, n: number, colors: string[], maxR: number) {
  for (let i = 0; i < n; i++) {
    c.fillStyle = r.pick(colors);
    c.beginPath(); c.arc(r.range(0, w), r.range(y0, y1), r.range(0.6, maxR), 0, Math.PI * 2); c.fill();
  }
}

const GROUND: Record<Biome, { ground: [string, string]; road: string; roadLight: string; speck: string[]; line: string }> = {
  desert: { ground: ['#e3c48f', '#cfa86c'], road: '#5b524b', roadLight: '#6b6158', speck: ['#c79d63', '#efd6a6', '#b98c55'], line: '#e8d7a8' },
  industrial: { ground: ['#8f8577', '#6c6559'], road: '#3f3e40', roadLight: '#4c4b4e', speck: ['#5d564c', '#a59b8b', '#7a5a3a'], line: '#e1b84a' },
  night: { ground: ['#5b4f5c', '#3f3543'], road: '#2d2b31', roadLight: '#38353c', speck: ['#4a3f4c', '#6b5e6d', '#2d2630'], line: '#c9c2b0' },
};

function drawGround(c: Ctx, w: number, h: number, biome: Biome) {
  const g = GROUND[biome];
  const r = new Rng(biome.length * 1337);
  c.fillStyle = vgrad(c, 0, h, g.ground[0], g.ground[1]);
  c.fillRect(0, 0, w, h);
  speckle(c, r, w, 0, h, 900, g.speck, 2.2);
  // bas-côtés
  const top = ROAD.top - 18, bot = ROAD.bottom + 18;
  c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, top - 8, w, 8); c.fillRect(0, bot, w, 8);
  // chaussée
  c.fillStyle = g.road; c.fillRect(0, top, w, bot - top);
  speckle(c, r, w, top, bot, 700, [g.roadLight, 'rgba(0,0,0,0.25)'], 1.6);
  // rapiéçages
  for (let i = 0; i < 5; i++) { c.fillStyle = r.chance(0.5) ? g.roadLight : 'rgba(0,0,0,0.18)'; rr(c, r.range(0, w - 80), r.range(top + 10, bot - 60), r.range(40, 110), r.range(20, 50), 6); c.fill(); }
  // fissures
  c.strokeStyle = 'rgba(10,8,8,0.55)'; c.lineWidth = 1.6;
  for (let i = 0; i < 14; i++) {
    let x = r.range(0, w), y = r.range(top, bot);
    c.beginPath(); c.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += r.range(-22, 22); y += r.range(-14, 14); c.lineTo(x, y); }
    c.stroke();
  }
  // bords de route
  c.fillStyle = g.line; c.globalAlpha = 0.75;
  c.fillRect(0, top + 6, w, 4); c.fillRect(0, bot - 10, w, 4);
  // pointillés centraux (effacés par endroits)
  for (let x = 0; x < w; x += 64) {
    if (r.chance(0.2)) continue;
    c.fillRect(x + 8, ROAD.centerY - 3, 34, 6);
  }
  c.globalAlpha = 1;
  // sable qui déborde
  if (biome === 'desert') {
    c.fillStyle = 'rgba(227,196,143,0.75)';
    for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(r.range(0, w), r.chance(0.5) ? top + 8 : bot - 8, r.range(30, 70), r.range(8, 18), 0, 0, Math.PI * 2); c.fill(); }
  }
}

function drawDecor(c: Ctx, w: number, h: number, kind: string, seed: number) {
  const r = new Rng(seed);
  switch (kind) {
    case 'cactus': {
      c.fillStyle = '#5d8a4a'; c.strokeStyle = PAL.ink; c.lineWidth = 2;
      c.beginPath(); c.arc(w / 2, h / 2, 12, 0, Math.PI * 2); c.fill(); c.stroke();
      for (const a of [0.3, 2.2, 4.1]) { c.beginPath(); c.arc(w / 2 + Math.cos(a) * 15, h / 2 + Math.sin(a) * 15, 7, 0, Math.PI * 2); c.fill(); c.stroke(); }
      c.fillStyle = '#86b36a'; c.beginPath(); c.arc(w / 2 - 3, h / 2 - 3, 4, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'dune': {
      c.fillStyle = 'rgba(190,150,95,0.55)'; c.beginPath(); c.ellipse(w / 2, h / 2, w / 2 - 2, h / 2 - 2, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,240,210,0.5)'; c.lineWidth = 2; c.beginPath(); c.ellipse(w / 2, h / 2 + 4, w / 2 - 14, h / 2 - 10, 0, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
      break;
    }
    case 'skull': {
      c.fillStyle = PAL.cream; c.strokeStyle = PAL.ink; c.lineWidth = 2;
      c.beginPath(); c.ellipse(w / 2, h / 2, 14, 10, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(w / 2 - 14, h / 2 - 4); c.lineTo(w / 2 - 26, h / 2 - 14); c.moveTo(w / 2 + 14, h / 2 - 4); c.lineTo(w / 2 + 26, h / 2 - 14); c.stroke();
      c.fillStyle = PAL.ink; c.beginPath(); c.arc(w / 2 - 5, h / 2, 3, 0, Math.PI * 2); c.arc(w / 2 + 5, h / 2, 3, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'sign': {
      c.fillStyle = '#6a5a48'; c.fillRect(w / 2 - 2, h / 2, 4, h / 2 - 4);
      rr(c, 6, 8, w - 12, h / 2 - 4, 3); fillStroke(c, PAL.petrol, PAL.ink, 2);
      c.fillStyle = PAL.cream; c.fillRect(12, 16, w - 24, 3); c.fillRect(12, 24, (w - 24) * 0.6, 3);
      c.fillStyle = 'rgba(140,70,30,0.6)'; c.beginPath(); c.arc(w - 16, 14, 5, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'car': {
      c.save(); c.translate(w / 2, h / 2); c.rotate(r.range(-0.6, 0.6));
      rr(c, -28, -14, 56, 28, 7); fillStroke(c, r.pick(['#7a5a40', '#5a6a70', '#6a4a4a']));
      c.fillStyle = 'rgba(20,15,10,0.75)'; rr(c, 2, -10, 14, 20, 3); c.fill();
      c.fillStyle = 'rgba(170,80,30,0.55)'; c.beginPath(); c.arc(-14, -4, 6, 0, Math.PI * 2); c.fill();
      c.restore();
      break;
    }
    case 'container': {
      c.save(); c.translate(w / 2, h / 2); c.rotate(r.range(-0.25, 0.25));
      const col = r.pick(['#b5602f', '#2f6f7a', '#8a7a3a']);
      rr(c, -44, -20, 88, 40, 3); fillStroke(c, col);
      c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 2;
      for (let x = -36; x < 44; x += 8) { c.beginPath(); c.moveTo(x, -18); c.lineTo(x, 18); c.stroke(); }
      c.restore();
      break;
    }
    case 'pylon': {
      c.strokeStyle = '#3a3a3a'; c.lineWidth = 3;
      c.strokeRect(w / 2 - 16, h / 2 - 16, 32, 32);
      c.beginPath(); c.moveTo(w / 2 - 16, h / 2 - 16); c.lineTo(w / 2 + 16, h / 2 + 16); c.moveTo(w / 2 + 16, h / 2 - 16); c.lineTo(w / 2 - 16, h / 2 + 16); c.stroke();
      c.fillStyle = '#2a2a2a'; c.beginPath(); c.arc(w / 2, h / 2, 5, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'pipes': {
      for (let i = 0; i < 3; i++) { rr(c, 4, 8 + i * 14, w - 8, 10, 5); fillStroke(c, i % 2 ? '#7a7f84' : '#8f6a4a', PAL.ink, 2); }
      break;
    }
    case 'tank': {
      c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2); fillStroke(c, vgrad(c, 0, h, '#a0a4a8', '#5b5f63'));
      c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 14, 0, Math.PI * 2); c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 2; c.stroke();
      c.fillStyle = 'rgba(160,80,30,0.5)'; c.beginPath(); c.arc(w / 2 + 8, h / 2 - 6, 8, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'deadtree': {
      c.strokeStyle = '#2a2026'; c.lineCap = 'round';
      const branch = (x: number, y: number, a: number, len: number, d: number) => {
        if (d === 0) return;
        const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
        c.lineWidth = d * 1.6; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke();
        branch(x2, y2, a - r.range(0.3, 0.7), len * 0.7, d - 1);
        branch(x2, y2, a + r.range(0.3, 0.7), len * 0.7, d - 1);
      };
      for (let i = 0; i < 4; i++) branch(w / 2, h / 2, (i / 4) * Math.PI * 2 + r.range(0, 1), 12, 4);
      break;
    }
    case 'oasis': {
      c.fillStyle = '#4fa8a0'; c.beginPath(); c.ellipse(w / 2, h / 2, w / 2 - 10, h / 2 - 12, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#8fd8cf'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#4f7a3a';
      for (const [x, y] of [[14, 14], [w - 16, 18], [w / 2, h - 10]]) { c.beginPath(); c.arc(x, y, 9, 0, Math.PI * 2); c.fill(); }
      break;
    }
  }
}

export const DECOR: Record<Biome, { kind: string; w: number; h: number; weight: number }[]> = {
  desert: [
    { kind: 'cactus', w: 56, h: 56, weight: 3 }, { kind: 'dune', w: 140, h: 60, weight: 3 }, { kind: 'skull', w: 60, h: 34, weight: 1 },
    { kind: 'sign', w: 52, h: 60, weight: 1 }, { kind: 'car', w: 80, h: 80, weight: 2 }, { kind: 'oasis', w: 130, h: 90, weight: 0.4 },
  ],
  industrial: [
    { kind: 'container', w: 110, h: 70, weight: 3 }, { kind: 'pylon', w: 48, h: 48, weight: 2 }, { kind: 'pipes', w: 120, h: 52, weight: 2 },
    { kind: 'tank', w: 90, h: 90, weight: 1.5 }, { kind: 'car', w: 80, h: 80, weight: 1.5 }, { kind: 'sign', w: 52, h: 60, weight: 1 },
  ],
  night: [
    { kind: 'deadtree', w: 90, h: 90, weight: 3 }, { kind: 'car', w: 80, h: 80, weight: 2.5 }, { kind: 'skull', w: 60, h: 34, weight: 1 },
    { kind: 'sign', w: 52, h: 60, weight: 1 }, { kind: 'pylon', w: 48, h: 48, weight: 1 },
  ],
};

function softDot(c: Ctx, w: number, h: number) {
  const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
}

function headlight(c: Ctx, w: number, h: number) {
  // cône de phare orienté vers la droite, origine au bord gauche-milieu
  const g = c.createRadialGradient(0, h / 2, 10, 0, h / 2, w);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.65)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.beginPath(); c.moveTo(0, h / 2 - 14); c.lineTo(w, 0); c.lineTo(w, h); c.lineTo(0, h / 2 + 14); c.closePath(); c.fill();
}

/** Crée toutes les textures. Idempotent. */
export function buildTextures(scene: Phaser.Scene) {
  canvas(scene, 'v_command', 112, 64, drawCommand);
  canvas(scene, 'v_escort', 76, 44, drawEscort);
  canvas(scene, 'v_salvager', 92, 58, drawSalvager);
  canvas(scene, 't_command', 64, 22, (c, w, h) => drawTurret(c, w, h, 50, 9, 12, '#c47a3e'));
  canvas(scene, 't_escort', 44, 14, (c, w, h) => { drawTurret(c, w, h, 34, 4, 8, '#2fb8b0'); c.fillStyle = '#444'; c.fillRect(10, h / 2 + 2, 30, 3); });
  canvas(scene, 't_salvager', 36, 14, (c, w, h) => drawTurret(c, w, h, 26, 5, 8, '#e8b44e'));
  canvas(scene, 'e_marauder', 52, 36, drawMarauder);
  canvas(scene, 'e_gunner', 66, 44, drawGunner);
  canvas(scene, 'e_scout', 54, 38, drawScout);
  canvas(scene, 'e_brute', 108, 82, drawBrute);
  canvas(scene, 'e_kamikaze', 46, 46, drawKamikaze);
  canvas(scene, 'e_boss', 196, 150, drawBoss);
  canvas(scene, 'o_rock', 60, 56, (c, w, h) => drawRock(c, w, h, 7));
  canvas(scene, 'o_rock2', 60, 56, (c, w, h) => drawRock(c, w, h, 99));
  canvas(scene, 'o_barrel', 40, 40, drawBarrel);
  canvas(scene, 'o_wreck', 92, 70, drawWreck);
  canvas(scene, 'o_mine', 32, 32, drawMine);
  canvas(scene, 'o_pothole', 52, 36, drawPothole);
  canvas(scene, 'p_scrap', 30, 30, (c, w, h) => drawPickup(c, w, h, 'scrap'));
  canvas(scene, 'p_fuel', 30, 30, (c, w, h) => drawPickup(c, w, h, 'fuel'));
  canvas(scene, 'p_food', 30, 30, (c, w, h) => drawPickup(c, w, h, 'food'));
  canvas(scene, 'dot', 32, 32, softDot);
  canvas(scene, 'light', 256, 256, softDot);
  canvas(scene, 'headlight', 360, 220, headlight);
  canvas(scene, 'shadow', 64, 40, (c, w, h) => { c.fillStyle = 'rgba(0,0,0,1)'; rr(c, 2, 2, w - 4, h - 4, 12); c.fill(); });
  canvas(scene, 'bullet_f', 18, 6, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(127,227,216,0)'); g.addColorStop(1, '#eaffd0'); c.fillStyle = g; rr(c, 0, 0, w, h, 3); c.fill(); });
  canvas(scene, 'bullet_h', 26, 10, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(255,200,90,0)'); g.addColorStop(1, '#fff2c0'); c.fillStyle = g; rr(c, 0, 0, w, h, 5); c.fill(); });
  canvas(scene, 'bullet_e', 24, 24, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, '#fff3c4'); g.addColorStop(0.4, '#ff6a2a'); g.addColorStop(1, 'rgba(255,40,20,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  canvas(scene, 'debris', 8, 8, (c) => { c.fillStyle = '#3a3330'; c.fillRect(0, 0, 8, 5); c.fillStyle = '#6a5a50'; c.fillRect(0, 0, 8, 2); });
  for (const b of ['desert', 'industrial', 'night'] as Biome[]) {
    canvas(scene, `ground_${b}`, 1024, VIEW.h, (c, w, h) => drawGround(c, w, h, b));
    DECOR[b].forEach((d, i) => canvas(scene, `d_${d.kind}`, d.w, d.h, (c, w, h) => drawDecor(c, w, h, d.kind, 31 + i)));
  }
}
