import { expect, test } from '@playwright/test';
import { boot, departTo, finishSegment, resolveScreen, screen } from './helpers';

test('parcours complet : menu → expédition → victoire → garage → achat persistant', async ({ page }) => {
  const errors = await boot(page);
  await page.locator('[data-act=play]').click();
  await expect(page.locator('.map-svg-wrap svg')).toBeVisible();
  const visited = new Set<string>();
  for (let guard = 0; guard < 30; guard++) {
    const s = await screen(page);
    if (s === 'result') break;
    if (s === 'map') {
      const order = ['event', 'workshop', 'camp', 'route'];
      const want = order.find((t) => !visited.has(t));
      await departTo(page, want);
      const type = await page.evaluate(() => { const s = (window as any).__CZ.state(); return s.run.map.nodes[s.run.currentId].type; });
      visited.add(type);
      // la simulation avance réellement
      const d0 = await page.evaluate(() => (window as any).__CZ.state().sim?.distance ?? 0);
      await page.waitForTimeout(700);
      const d1 = await page.evaluate(() => (window as any).__CZ.state().sim?.distance ?? 0);
      expect(d1).toBeGreaterThan(d0);
      await finishSegment(page);
    } else await resolveScreen(page);
  }
  await expect(page.locator('.victory')).toBeVisible();
  expect(visited.has('route')).toBe(true);
  const coins = await page.evaluate(() => (window as any).__CZ.state().save.coins);
  expect(coins).toBeGreaterThan(0);
  await page.locator('[data-act=result-garage]').click();
  const buy = page.locator('[data-act=buy-meta]:not([disabled])').first();
  const metaId = await buy.getAttribute('data-id');
  await buy.dblclick(); // double clic : un seul achat
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__CZ);
  const save = await page.evaluate(() => (window as any).__CZ.state().save);
  expect(save.meta[metaId!]).toBe(1);
  expect(save.profile.victories).toBe(1);
  expect(errors).toEqual([]);
});

test('défaite : destruction du commandement → bilan → garage', async ({ page }) => {
  const errors = await boot(page);
  await page.locator('[data-act=play]').click();
  await departTo(page);
  await page.evaluate(() => (window as any).__CZ.killCommand());
  await expect(page.locator('.defeat')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.defeat')).toContainText('Mastodonte');
  await page.locator('[data-act=result-garage]').click();
  await expect(page.locator('h2', { hasText: 'Garage' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('pilotage : auto par défaut, manuel au clavier, retour auto', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'clavier testé sur desktop');
  await boot(page);
  await page.locator('[data-act=play]').click();
  await departTo(page);
  await expect(page.locator('#mode-btn')).toHaveText('AUTO');
  const y0 = await page.evaluate(() => (window as any).__CZ.state().sim.command.y);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(600);
  await page.keyboard.up('ArrowUp');
  await expect(page.locator('#mode-btn')).toHaveText('MANUEL');
  const y1 = await page.evaluate(() => (window as any).__CZ.state().sim.command.y);
  expect(y1).toBeLessThan(y0 - 40);
  await page.keyboard.press('Space');
  await expect(page.locator('#mode-btn')).toHaveText('AUTO');
});

test('pilotage tactile : joystick et bouton de mode', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'tactile');
  await boot(page);
  await page.locator('[data-act=play]').click();
  await departTo(page);
  const joy = page.locator('#joy');
  await expect(joy).toBeVisible();
  const box = (await joy.boundingBox())!;
  const y0 = await page.evaluate(() => (window as any).__CZ.state().sim.command.y);
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  // glisser vers le haut via événements pointer (tactile)
  await joy.dispatchEvent('pointerdown', { pointerId: 7, clientX: cx, clientY: cy, pointerType: 'touch', isPrimary: true });
  await joy.dispatchEvent('pointermove', { pointerId: 7, clientX: cx, clientY: cy - 60, pointerType: 'touch', isPrimary: true });
  await page.waitForTimeout(600);
  await joy.dispatchEvent('pointerup', { pointerId: 7, clientX: cx, clientY: cy - 60, pointerType: 'touch', isPrimary: true });
  await expect(page.locator('#mode-btn')).toHaveText('MANUEL');
  const y1 = await page.evaluate(() => (window as any).__CZ.state().sim.command.y);
  expect(y1).toBeLessThan(y0 - 40);
  await page.locator('#mode-btn').tap();
  await expect(page.locator('#mode-btn')).toHaveText('AUTO');
});

test('pause fiable (Échap / bouton / retour navigateur) et reprise', async ({ page }) => {
  await boot(page);
  await page.locator('[data-act=play]').click();
  await departTo(page);
  await page.locator('[data-act=pause]').click();
  await expect(page.locator('#overlay')).toBeVisible();
  const t0 = await page.evaluate(() => (window as any).__CZ.state().sim.time);
  await page.waitForTimeout(500);
  const t1 = await page.evaluate(() => (window as any).__CZ.state().sim.time);
  expect(t1).toBe(t0);
  await page.locator('[data-act=resume]').click();
  await expect(page.locator('#overlay')).toBeHidden();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__CZ.state().sim.time)).toBeGreaterThan(t1);
  // retour navigateur = pause, pas de sortie de page
  await page.goBack();
  await expect(page.locator('#overlay')).toBeVisible();
  expect(page.url()).toContain('localhost:4173');
  await page.locator('[data-act=resume]').click();
  // abandon explicite
  await page.locator('[data-act=pause]').click();
  await page.locator('#overlay [data-act=abandon]').click();
  await page.locator('[data-act=abandon-yes]').click();
  await expect(page.locator('.defeat')).toBeVisible();
});

test('paramètres audio enregistrés après rechargement', async ({ page }) => {
  await boot(page);
  await page.locator('[data-act=settings]').click();
  await page.locator('input[data-set=music]').fill('20');
  await page.locator('[data-act=toggle-mute]').click();
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__CZ);
  const s = await page.evaluate(() => (window as any).__CZ.state().save.settings);
  expect(s.musicVolume).toBeCloseTo(0.2);
  expect(s.muted).toBe(true);
});

test('cibles tactiles ≥ 44 px et pas de débordement', async ({ page }) => {
  await boot(page);
  const check = async () => {
    const small = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('#ui button')]
      .filter((b) => b.offsetParent && getComputedStyle(b).display !== 'none')
      .map((b) => ({ t: b.textContent?.trim(), r: b.getBoundingClientRect() }))
      .filter((x) => x.r.width > 0 && (x.r.height < 44 || x.r.width < 44))
      .map((x) => `${x.t} ${Math.round(x.r.width)}x${Math.round(x.r.height)}`));
    expect(small).toEqual([]);
  };
  await check();
  await page.locator('[data-act=garage]').click();
  await check();
  await page.locator('[data-act=launch]').click();
  await check();
  await departTo(page);
  await check();
});

test('sauvegarde corrompue : le jeu démarre quand même', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('convoy-zero.save', '{corrupt'));
  const errors = await boot(page);
  await expect(page.locator('.menu-foot')).toContainText('0 pièces');
  expect(errors).toEqual([]);
});
