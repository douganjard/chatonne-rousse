import { expect, test, type Page } from '@playwright/test';
import type * as CatSceneProbe from './helpers/catSceneProbe';

// Vite serves this test helper with the same Three/Fiber instances as the real app.
const probeUrl = '/tests/helpers/catSceneProbe.ts';

async function advance(page: Page, seconds: number) {
  await page.evaluate(async ({ url, seconds }) => {
    const probe: typeof CatSceneProbe = await import(/* @vite-ignore */ url);
    probe.advance(seconds);
  }, { url: probeUrl, seconds });
}

async function sample(page: Page) {
  return page.evaluate(async url => {
    const probe: typeof CatSceneProbe = await import(/* @vite-ignore */ url);
    return probe.sample();
  }, probeUrl);
}

function expectStanding(pose: Awaited<ReturnType<typeof sample>>) {
  expect(pose.pawAngle, 'Rear paws should face the same direction').toBeLessThan(0.1);
  expect(pose.floorHeight, 'Paws should rest near the thin rug').toBeGreaterThan(0.01);
  expect(pose.floorHeight).toBeLessThan(0.04);
  expect(pose.height, 'The skinned body must remain upright').toBeGreaterThan(0.6);
  expect(pose.height).toBeLessThan(0.9);
  for (const [x, y, z] of pose.segments) {
    expect(y, 'Every leg segment should point down').toBeLessThan(-0.999);
    expect(Math.hypot(x, z), 'Legs should be perpendicular to the floor').toBeLessThan(0.002);
  }
}

test('cat plants matching rear paws after movement and after sitting', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(async url => {
    const probe: typeof CatSceneProbe = await import(/* @vite-ignore */ url);
    return probe.ready();
  }, probeUrl)).toBe(true);
  await page.evaluate(async url => {
    const probe: typeof CatSceneProbe = await import(/* @vite-ignore */ url);
    probe.start();
  }, probeUrl);

  try {
    await advance(page, 2);
    expectStanding(await sample(page));
    await page.keyboard.down('ArrowLeft');
    await advance(page, 0.8);
    await page.keyboard.up('ArrowLeft');
    await page.keyboard.down('ArrowUp');
    await advance(page, 0.5);
    await page.keyboard.up('ArrowUp');
    await advance(page, 2);
    expectStanding(await sample(page));
    await page.screenshot({ path: testInfo.outputPath('cat-standing.png') });

    await advance(page, 5);
    const seated = await sample(page);
    expect(seated.rearPawPitch, 'Sitting should retain the existing paw endpoint').toBeCloseTo(-0.65047, 2);
    expect(seated.floorHeight).toBeGreaterThan(-0.005);

    await page.keyboard.down('ArrowRight');
    await advance(page, 1);
    await page.keyboard.up('ArrowRight');
    await advance(page, 2);
    expectStanding(await sample(page));
    expect(errors).toEqual([]);
  } finally {
    await page.keyboard.up('ArrowUp');
    await page.keyboard.up('ArrowLeft');
    await page.keyboard.up('ArrowRight');
    await page.evaluate(async url => {
      const probe: typeof CatSceneProbe = await import(/* @vite-ignore */ url);
      probe.stop();
    }, probeUrl);
  }
});
