import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import { navNodes } from '../src/data/navNodes';
import {
  CAT_IDLE_BEFORE_SITTING_SECONDS,
  CAT_INITIAL_SEATED_SECONDS,
  CAT_MAX_POSTURE_STEP,
  CAT_SIT_DOWN_SECONDS,
  CAT_STAND_UP_SECONDS,
  createCatPostureState,
  getCatPostureRotation,
  getCatSitBlend,
  isCatStanding,
  updateCatPosture,
  type CatPostureState,
} from '../src/scene/catPosture';
import { CAT_COLLISION_RADIUS, resolveBlockedMove, type ObstacleRect } from '../src/scene/collisions';
import {
  calculateFollowCameraFraming,
  FOLLOW_CAMERA_DISTANCE,
} from '../src/scene/followCamera';
import {
  CAT_COAT_STORAGE_KEY,
  nextCatCoat,
  readCatCoat,
  recolorCatCoatPixels,
  writeCatCoat,
} from '../src/scene/catCoat';
import {
  CAT_MAX_FRAME_DELTA,
  clampCatFrameDelta,
  updateCatLocomotion,
  type CatLocomotionState,
} from '../src/scene/catMotion';

const routes = ['/', '/about', '/writing', '/contact', '/missing-route'];

function advancePosture(state: CatPostureState, seconds: number, movementRequested = false) {
  let elapsed = 0;

  while (elapsed < seconds) {
    const step = Math.min(0.02, seconds - elapsed);
    updateCatPosture(state, step, movementRequested);
    elapsed += step;
  }
}

function hasVisualVariation(buffer: Buffer) {
  const image = PNG.sync.read(buffer);
  const [firstRed, firstGreen, firstBlue, firstAlpha] = image.data;
  let changedPixels = 0;

  for (let index = 0; index < image.data.length; index += 16) {
    const red = image.data[index];
    const green = image.data[index + 1];
    const blue = image.data[index + 2];
    const alpha = image.data[index + 3];
    const colorDelta =
      Math.abs(red - firstRed) +
      Math.abs(green - firstGreen) +
      Math.abs(blue - firstBlue) +
      Math.abs(alpha - firstAlpha);

    if (alpha > 0 && colorDelta > 12) {
      changedPixels += 1;
    }

    if (changedPixels > 50) return true;
  }

  return false;
}

test('destination knock boxes allow contact but block object centers', () => {
  for (const node of navNodes.filter(({ id }) => id !== 'about')) {
    const obstacle: ObstacleRect = {
      center: [0, 0],
      halfSize: node.collisionHalfSize,
      id: `destination-${node.id}`,
    };
    const approach = {
      x: -node.collisionHalfSize[0] - CAT_COLLISION_RADIUS - 0.1,
      z: 0,
    };
    const contact = {
      x: -node.collisionHalfSize[0] - CAT_COLLISION_RADIUS - 0.001,
      z: 0,
    };

    expect(resolveBlockedMove(approach, contact, [obstacle])).toEqual(contact);
    expect(resolveBlockedMove(contact, { x: 0, z: 0 }, [obstacle])).not.toEqual({ x: 0, z: 0 });
  }
});

test('Spotify speaker uses a wider interaction radius and remains outside link navigation', () => {
  const speaker = navNodes.find(({ id }) => id === 'spotify');

  expect(speaker).toBeDefined();
  expect(speaker?.kind).toBe('spotify');
  expect(speaker?.interactionRadius).toBeGreaterThan(0.58);
  expect(speaker?.collisionHalfSize).toEqual([0.34, 0.25]);
  expect('path' in speaker!).toBe(false);
});

test('Goodreads is an external shelf destination excluded from the header menu', () => {
  const goodreads = navNodes.find(({ id }) => id === 'goodreads');

  expect(goodreads).toMatchObject({
    kind: 'link',
    path: 'http://goodreads.com/douganjard',
    external: true,
    showInMenu: false,
    position: [3.4, 0.445, 0.4],
  });
});

test('cat coat toggles deterministically and persists valid presets', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };

  expect(nextCatCoat('light-orange')).toBe('buff');
  expect(nextCatCoat('buff')).toBe('light-orange');
  expect(readCatCoat(storage)).toBe('light-orange');

  writeCatCoat(storage, 'buff');
  expect(values.get(CAT_COAT_STORAGE_KEY)).toBe('buff');
  expect(readCatCoat(storage)).toBe('buff');

  values.set(CAT_COAT_STORAGE_KEY, 'blue');
  expect(readCatCoat(storage)).toBe('light-orange');
});

test('cat coats map warm midtones to their requested colors and preserve details', () => {
  const source = new Uint8ClampedArray([
    204, 112, 51, 255,
    235, 230, 220, 255,
    20, 10, 5, 255,
  ]);
  const lightOrange = recolorCatCoatPixels(source, 'light-orange');
  const buff = recolorCatCoatPixels(source, 'buff');

  expect([...lightOrange.slice(0, 4)]).toEqual([255, 170, 51, 255]);
  expect([...buff.slice(0, 4)]).toEqual([218, 160, 109, 255]);
  expect([...lightOrange.slice(4, 8)]).toEqual([...source.slice(4, 8)]);
  expect([...lightOrange.slice(8, 12)]).toEqual([...source.slice(8, 12)]);
});

test('cat locomotion damping remains stable across common frame rates', () => {
  const simulate = (framesPerSecond: number) => {
    const state: CatLocomotionState = { move: 0, speed: 0, turn: 0 };
    for (let frame = 0; frame < framesPerSecond; frame += 1) {
      updateCatLocomotion(state, 1, 0.7, 1 / framesPerSecond);
    }
    return state;
  };

  const at30Fps = simulate(30);
  const at60Fps = simulate(60);
  const at120Fps = simulate(120);

  for (const state of [at30Fps, at120Fps]) {
    expect(state.move).toBeCloseTo(at60Fps.move, 6);
    expect(state.speed).toBeCloseTo(at60Fps.speed, 6);
    expect(state.turn).toBeCloseTo(at60Fps.turn, 6);
  }
});

test('cat motion caps long frames to prevent position and rotation jumps', () => {
  const state: CatLocomotionState = { move: 0, speed: 0, turn: 0 };
  const frameDelta = updateCatLocomotion(state, 1, 1, 1);

  expect(clampCatFrameDelta(1)).toBe(CAT_MAX_FRAME_DELTA);
  expect(frameDelta).toBe(CAT_MAX_FRAME_DELTA);
  expect(state.move).toBeLessThan(0.3);
  expect(state.turn).toBeLessThan(0.34);
  expect(1.38 * state.move * frameDelta).toBeLessThan(0.021);
});

test('cat starts seated, rises on load, and sits after ten seconds without movement', () => {
  const posture = createCatPostureState();

  advancePosture(posture, CAT_INITIAL_SEATED_SECONDS - 0.02);
  expect(posture.phase).toBe('seated');

  advancePosture(posture, 0.04);
  expect(posture.phase).toBe('standingUp');
  expect(isCatStanding(posture)).toBe(false);

  advancePosture(posture, CAT_STAND_UP_SECONDS + 0.02);
  expect(posture.phase).toBe('standing');

  advancePosture(posture, CAT_IDLE_BEFORE_SITTING_SECONDS - 0.2);
  expect(posture.phase).toBe('standing');

  advancePosture(posture, 0.25);
  expect(posture.phase).toBe('sittingDown');

  advancePosture(posture, CAT_SIT_DOWN_SECONDS + 0.02);
  expect(posture.phase).toBe('seated');
});

test('movement makes a seated cat stand before locomotion can resume', () => {
  const posture = createCatPostureState();

  updateCatPosture(posture, 0.02, true);
  expect(posture.phase).toBe('standingUp');
  expect(isCatStanding(posture)).toBe(false);

  advancePosture(posture, CAT_STAND_UP_SECONDS + 0.02, true);
  expect(posture.phase).toBe('standing');
  expect(isCatStanding(posture)).toBe(true);
});

test('movement smoothly reverses an in-progress sit transition', () => {
  const posture = createCatPostureState();
  advancePosture(posture, CAT_INITIAL_SEATED_SECONDS + CAT_STAND_UP_SECONDS + 0.04);
  advancePosture(posture, CAT_IDLE_BEFORE_SITTING_SECONDS + 0.04);
  advancePosture(posture, CAT_SIT_DOWN_SECONDS / 2);
  const partialSit = posture.sitAmount;

  expect(posture.phase).toBe('sittingDown');
  expect(partialSit).toBeGreaterThan(0);
  expect(partialSit).toBeLessThan(1);

  updateCatPosture(posture, 0.02, true);
  expect(posture.phase).toBe('standingUp');
  expect(posture.sitAmount).toBe(partialSit);
});

test('sit and stand easing is deterministic across common frame rates', () => {
  const simulateStandingUp = (framesPerSecond: number) => {
    const posture: CatPostureState = {
      phase: 'standingUp',
      phaseElapsed: 0,
      inactivity: 0,
      initialRisePending: false,
      sitAmount: 1,
    };
    const frames = Math.round((CAT_STAND_UP_SECONDS / 2) * framesPerSecond);
    for (let frame = 0; frame < frames; frame += 1) {
      updateCatPosture(posture, 1 / framesPerSecond, true);
    }
    return getCatSitBlend(posture.sitAmount);
  };

  const at30Fps = simulateStandingUp(30);
  const at60Fps = simulateStandingUp(60);
  const at120Fps = simulateStandingUp(120);

  expect(at30Fps).toBeCloseTo(at60Fps, 6);
  expect(at120Fps).toBeCloseTo(at60Fps, 6);
});

test('posture interpolation has stable endpoints and no overshoot', () => {
  expect(getCatSitBlend(-1)).toBe(0);
  expect(getCatSitBlend(0)).toBe(0);
  expect(getCatSitBlend(1)).toBe(1);
  expect(getCatSitBlend(2)).toBe(1);
  expect(getCatSitBlend(1 / 60)).toBeLessThan(0.00005);
  expect(1 - getCatSitBlend(59 / 60)).toBeLessThan(0.00005);

  const halfway = getCatPostureRotation([0.2, -0.1, 0.4], [1, 0.5, -0.2], 0.5);
  expect(halfway).toEqual([0.7, 0.15, 0.30000000000000004]);
});

test('sit and stand transitions cap stalled frames', () => {
  const posture: CatPostureState = {
    phase: 'standingUp',
    phaseElapsed: 0,
    inactivity: 0,
    initialRisePending: false,
    sitAmount: 1,
  };

  updateCatPosture(posture, 1, true);

  expect(posture.phase).toBe('standingUp');
  expect(posture.phaseElapsed).toBe(CAT_MAX_POSTURE_STEP);
  expect(posture.sitAmount).toBeCloseTo(1 - CAT_MAX_POSTURE_STEP / CAT_STAND_UP_SECONDS, 8);
});

test('follow framing keeps the bottom viewport edge inside the room floor', () => {
  const portrait = calculateFollowCameraFraming(390 / 844);
  const desktop = calculateFollowCameraFraming(1440 / 1000);
  const landscape = calculateFollowCameraFraming(844 / 390);

  expect(portrait.distance).toBeCloseTo(FOLLOW_CAMERA_DISTANCE);
  expect(portrait.maxTargetX).toBeGreaterThan(2.5);
  expect(desktop.maxTargetX).toBeGreaterThan(0);
  expect(landscape.distance).toBeLessThan(FOLLOW_CAMERA_DISTANCE);
  expect(landscape.maxTargetX).toBeCloseTo(0);

  for (const framing of [portrait, desktop, landscape]) {
    expect(framing.maxTargetZ).toBeGreaterThan(0);
  }
});

test.describe('route smoke checks', () => {
  for (const route of routes) {
    test(`${route} renders without failed app assets`, async ({ page }) => {
      const failedRequests: string[] = [];

      page.on('requestfailed', (request) => {
        failedRequests.push(request.url());
      });

      const response = await page.goto(route);

      expect(response?.ok()).toBeTruthy();
      await expect(page.locator('.site-header')).toBeVisible();
      await expect(page.locator('main, .home-page')).toBeVisible();
      expect(failedRequests.filter((url) => url.includes('/models/') || url.includes('/assets/'))).toEqual([]);
    });
  }
});

test('home scene paints a nonblank canvas and loads the cat model', async ({ page }) => {
  const modelResponses: string[] = [];

  page.on('response', (response) => {
    if (response.url().includes('/models/toon_cat_free.glb') && response.ok()) {
      modelResponses.push(response.url());
    }
  });

  await page.goto('/');
  const canvas = page.locator('canvas');

  await expect(canvas).toBeVisible();
  await expect.poll(() => modelResponses.length).toBeGreaterThan(0);
  await page.waitForTimeout(500);

  expect(hasVisualVariation(await canvas.screenshot())).toBe(true);
});

test('reduced-motion users get the destination fallback', async ({ page }) => {
  await page.route('**/api/spotify/now-playing', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        state: 'playing',
        fetchedAt: '2026-07-22T22:00:00.000Z',
        item: {
          type: 'track',
          title: 'A test track with a long title',
          creators: ['Test Artist'],
          collection: 'Test Album',
          artwork: { url: 'https://i.scdn.co/image/test-cover', width: 640, height: 640 },
          spotifyUrl: 'https://open.spotify.com/track/test',
        },
      }),
    }),
  );
  await page.route('https://i.scdn.co/image/test-cover', (route) => route.fulfill({ status: 404 }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const fallback = page.getByLabel('Site destinations');

  await expect(fallback).toBeVisible();
  await expect(fallback.getByRole('link', { exact: true, name: 'About' })).toBeVisible();
  const chessLink = fallback.getByRole('link', { exact: true, name: 'How about a game of chess?' });
  await expect(chessLink).toBeVisible();
  await expect(chessLink).toHaveAttribute('href', 'http://chess.com/play/douganjard');
  await expect(chessLink).toHaveAttribute('target', '_blank');
  const goodreadsLink = fallback.getByRole('link', { exact: true, name: 'Library' });
  await expect(goodreadsLink).toHaveAttribute('href', 'http://goodreads.com/douganjard');
  await expect(goodreadsLink).toHaveAttribute('target', '_blank');
  await expect(fallback.getByRole('link', { exact: true, name: 'Synth Conductor' })).toBeVisible();
  const spotify = fallback.getByRole('link', { name: /Listening now: A test track/ });
  await expect(spotify).toBeVisible();
  await expect(spotify).toHaveAttribute('href', 'https://open.spotify.com/track/test');
  await expect(spotify.getByText('Test Artist')).toBeVisible();
  await expect(spotify.getByText('Test Album')).toBeVisible();
  await expect(spotify.getByRole('img', { name: 'Spotify' })).toBeVisible();
  await expect(spotify.locator('.spotify-artwork-placeholder')).toBeVisible();
});

test('navigation menu opens, links correctly, and closes with Escape', async ({ page }) => {
  await page.goto('/');

  const menuButton = page.locator('.menu-toggle');
  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });

  await expect(page.getByRole('link', { name: 'Home' })).toHaveText('Doug Anjard');
  await expect(menuButton).toHaveAccessibleName('Open navigation menu');
  await expect(navigation).toBeHidden();
  await menuButton.click();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  await expect(menuButton).toHaveAccessibleName('Close navigation menu');
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'About', exact: true })).toHaveAttribute('href', '/about');
  await expect(navigation.getByText('Library', { exact: true })).toHaveCount(0);
  await expect(navigation.getByText('Spotify', { exact: true })).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(navigation).toBeHidden();
  await expect(menuButton).toHaveAccessibleName('Open navigation menu');
  await expect(menuButton).toBeFocused();
});

test('touch controls stay hidden for fine-pointer desktop users', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chromium');
  await page.goto('/');

  await expect(page.getByRole('group', { name: 'Cat movement controls' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Follow cat with camera' })).toHaveCount(0);
});

test('touch controls provide correctly sized hold actions on mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await page.goto('/');

  const controls = page.getByRole('group', { name: 'Cat movement controls' });
  const turnLeft = controls.getByRole('button', { name: 'Turn left' });
  const moveForward = controls.getByRole('button', { name: 'Move forward' });
  const turnRight = controls.getByRole('button', { name: 'Turn right' });

  await expect(controls).toBeVisible();
  await expect(turnLeft).toBeVisible();
  await expect(moveForward).toBeVisible();
  await expect(turnRight).toBeVisible();
  await expect(page.getByRole('button', { name: 'Follow cat with camera' })).toHaveCount(0);

  for (const button of [turnLeft, moveForward, turnRight]) {
    const box = await button.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(56);
    expect(box?.height).toBeGreaterThanOrEqual(56);
  }

  const controlsBox = await controls.boundingBox();
  const headerBox = await page.locator('.site-header').boundingBox();
  const viewport = page.viewportSize();
  expect(controlsBox).not.toBeNull();
  expect(headerBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(controlsBox!.y).toBeGreaterThan(64);
  expect(controlsBox!.y + controlsBox!.height).toBeLessThanOrEqual(viewport!.height);
  expect(Math.abs(controlsBox!.x + controlsBox!.width / 2 - viewport!.width / 2)).toBeLessThanOrEqual(1);

  await moveForward.dispatchEvent('pointerdown', { button: 0, pointerId: 1, pointerType: 'touch' });
  await turnLeft.dispatchEvent('pointerdown', { button: 0, pointerId: 2, pointerType: 'touch' });
  await expect(moveForward).toHaveClass(/is-active/);
  await expect(turnLeft).toHaveClass(/is-active/);

  await moveForward.dispatchEvent('pointerup', { button: 0, pointerId: 1, pointerType: 'touch' });
  await expect(moveForward).not.toHaveClass(/is-active/);
  await expect(turnLeft).toHaveClass(/is-active/);

  await turnLeft.dispatchEvent('pointercancel', { button: 0, pointerId: 2, pointerType: 'touch' });
  await expect(turnLeft).not.toHaveClass(/is-active/);
});

test('reduced-motion fallback does not show cat movement controls', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  await expect(page.getByLabel('Site destinations')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Cat movement controls' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Follow cat with camera' })).toHaveCount(0);
});
