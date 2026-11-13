import { autoplay } from '../tests/unit/autoplay';
import { coinsEarned } from '../src/game/run';
const N = Number(process.argv[2] ?? 20);
const metaLvl = Number(process.argv[3] ?? 0);
const meta = { hull: metaLvl, tanks: metaLvl, magnet: metaLvl, guns: metaLvl, pantry: metaLvl, workshop: metaLvl };
let wins = 0, steps = 0, coins = 0, time = 0;
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const r = autoplay(`BAL-${i}`, meta);
  if (r.outcome === 'victory') wins++;
  steps += r.stats.stepsCleared; coins += coinsEarned(r); time += r.stats.timeMs;
  console.log(i, r.outcome, r.defeatReason ?? '', 'steps', r.stats.stepsCleared, 'kills', r.stats.kills, 'res', JSON.stringify(r.res), 'hp', Math.round(r.vehicles.command.hp), 'coins', coinsEarned(r), 'min', (r.stats.timeMs / 60000).toFixed(1));
}
console.log(`win ${wins}/${N}  avgSteps ${(steps / N).toFixed(1)}  avgCoins ${(coins / N).toFixed(1)}  avgDriveMin ${(time / N / 60000).toFixed(1)}  wall ${Date.now() - t0}ms`);
