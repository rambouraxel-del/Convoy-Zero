import { DriveSim } from '../src/game/sim/sim';
import type { Biome } from '../src/core/types';
for (const [biome, depth] of [['desert', 0], ['desert', 1], ['industrial', 2], ['industrial', 3], ['night', 4], ['night', 5]] as [Biome, number][]) {
  const tot: Record<string, number> = {};
  let lost = 0; let kills = 0;
  for (let i = 0; i < 8; i++) {
    const sim = new DriveSim({ kind: 'route', biome, depth, risk: 2, seed: 1000 + i });
    let t = 0; while (!sim.done && t < 200) { sim.update(1 / 60); t += 1 / 60; }
    if (sim.outcome === 'lost') lost++;
    kills += sim.kills;
    for (const [k, v] of Object.entries(sim.damageBySource)) tot[k] = (tot[k] ?? 0) + v / 8;
  }
  console.log(biome, depth, 'lost', lost, 'kills', kills / 8, Object.entries(tot).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v.toFixed(0)}`).join(' '));
}
