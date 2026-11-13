import { test } from '@playwright/test';
import { boot, departTo, finishSegment, screen } from './helpers';

/** Captures de référence (dossier docs/screenshots) — revue visuelle humaine/IA, pas une assertion. */
test('captures des écrans clés', async ({ page }, info) => {
  test.setTimeout(180_000);
  const dir = `docs/screenshots/${info.project.name}`;
  await boot(page);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${dir}/01-menu.png` });
  await page.locator('[data-act=garage]').click();
  await page.screenshot({ path: `${dir}/02-garage.png` });
  await page.locator('#seed').fill('DUNE-42');
  await page.locator('[data-act=launch]').click();
  await page.screenshot({ path: `${dir}/03-carte.png` });
  await departTo(page, 'route');
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${dir}/04-desert.png` });
  await finishSegment(page);
  await page.screenshot({ path: `${dir}/05-${await screen(page)}.png` });
  // saute à la zone industrielle puis à la nuit pour les captures de biomes
  for (const [layer, name] of [[2, '06-industriel'], [4, '07-nuit']] as const) {
    await page.evaluate((layer) => {
      const app = (window as any).__CZ.app;
      const run = app.run;
      const n = Object.values(run.map.nodes).find((x: any) => x.layer === layer - 1) as any;
      run.currentId = n.id; run.visited.push(n.id);
      app.toMap();
    }, layer);
    await departTo(page, 'route');
    await page.waitForTimeout(7000);
    await page.screenshot({ path: `${dir}/${name}.png` });
    await finishSegment(page);
  }
  await page.evaluate(() => {
    const app = (window as any).__CZ.app;
    const run = app.run;
    const n = Object.values(run.map.nodes).find((x: any) => x.layer === 5) as any;
    run.currentId = n.id; run.visited.push(n.id);
    app.toMap();
  });
  await departTo(page);
  await page.evaluate(() => (window as any).__CZ.setTimeScale(3));
  await page.waitForFunction(() => !!(window as any).__CZ.state().sim?.boss, null, { timeout: 60_000 });
  await page.evaluate(() => (window as any).__CZ.setTimeScale(1));
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${dir}/08-boss.png` });
  await page.locator('[data-act=pause]').click();
  await page.screenshot({ path: `${dir}/09-pause.png` });
  await page.locator('[data-act=resume]').click();
  await finishSegment(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/10-bilan.png` });
});
