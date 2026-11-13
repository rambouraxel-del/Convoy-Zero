import { DriveSim } from '../src/game/sim/sim';
const sim = new DriveSim({ kind: 'route', biome: 'night', depth: 5, risk: 3, seed: 1, lengthOverride: 1e9 });
const t = performance.now(); let n = 0;
while (n < 60 * 120) { sim.update(1 / 60); sim.drainEvents(); n++; }
console.log(`sim: ${((performance.now() - t) / n).toFixed(3)} ms par pas (budget 16.7 ms)`);
