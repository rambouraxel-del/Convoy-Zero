import { expect, type Page } from '@playwright/test';

export async function boot(page: Page, query = '?test') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/' + query);
  await expect(page.locator('[data-act=play]')).toBeVisible();
  await page.waitForFunction(() => !!(window as any).__CZ);
  return errors;
}

export const screen = (page: Page) => page.evaluate(() => (window as any).__CZ.state().screen as string);

/** Choisit un nœud accessible (de préférence d'un type donné) et part. */
export async function departTo(page: Page, prefer?: string) {
  const id = await page.evaluate((prefer) => {
    const s = (window as any).__CZ.state();
    const run = s.run;
    const ids: string[] = run.currentId ? run.map.nodes[run.currentId].next : run.map.startIds;
    return ids.find((i) => run.map.nodes[i].type === prefer) ?? ids[0];
  }, prefer);
  await page.locator(`.map-node[data-id="${id}"]`).click({ force: true });
  await page.locator('[data-act=depart]').click();
  await expect.poll(() => screen(page)).toBe('drive');
}

/** Termine le segment courant via le crochet de test et attend l'écran suivant. */
export async function finishSegment(page: Page) {
  await page.evaluate(() => (window as any).__CZ.finishSegment());
  await expect.poll(() => screen(page), { timeout: 15_000 }).not.toBe('drive');
}

/** Résout l'écran post-segment courant et revient à la carte (ou au bilan). */
export async function resolveScreen(page: Page) {
  const s = await screen(page);
  if (s === 'event') {
    await page.locator('[data-act=event-choice]:not([disabled])').first().click();
    const fight = page.locator('[data-act=event-fight]');
    if (await fight.count()) {
      await fight.click();
      await expect.poll(() => screen(page)).toBe('drive');
      await finishSegment(page);
    } else await page.locator('[data-act=event-continue]').click();
  } else if (s === 'reward') await page.locator('[data-act=reward-pick]').first().click();
  else if (s === 'workshop' || s === 'camp') await page.locator('[data-act=leave]').click();
}
