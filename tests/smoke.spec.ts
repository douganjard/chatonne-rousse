import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import { navNodes } from '../src/data/navNodes';
import {
  CAT_IDLE_BEFORE_SITTING_SECONDS,
  CAT_INITIAL_SEATED_SECONDS,
  CAT_SIT_DOWN_SECONDS,
  CAT_STAND_UP_SECONDS,
  createCatPostureState,
  isCatStanding,
  updateCatPosture,
  type CatPostureState,
} from '../src/scene/catPosture';
import { CAT_COLLISION_RADIUS, resolveBlockedMove, type ObstacleRect } from '../src/scene/collisions';

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
  await expect(chessLink).toHaveAttribute('href', 'https://link.chess.com/play/eTlu1T');
  await expect(chessLink).toHaveAttribute('target', '_blank');
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
  await expect(page.getByRole('button', { name: 'Follow cat with camera' })).toBeHidden();
  await expect(page.locator('.scene-wrap')).toHaveAttribute('data-camera-mode', 'follow');
});

test('touch controls provide correctly sized hold actions on mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await page.goto('/');

  const controls = page.getByRole('group', { name: 'Cat movement controls' });
  const turnLeft = controls.getByRole('button', { name: 'Turn left' });
  const moveForward = controls.getByRole('button', { name: 'Move forward' });
  const turnRight = controls.getByRole('button', { name: 'Turn right' });
  const cameraControl = page.getByRole('button', { name: 'Follow cat with camera' });
  const scene = page.locator('.scene-wrap');

  await expect(controls).toBeVisible();
  await expect(turnLeft).toBeVisible();
  await expect(moveForward).toBeVisible();
  await expect(turnRight).toBeVisible();
  await expect(cameraControl).toBeVisible();
  await expect(cameraControl).toHaveAttribute('aria-pressed', 'true');
  await expect(scene).toHaveAttribute('data-camera-mode', 'follow');

  for (const button of [turnLeft, moveForward, turnRight]) {
    const box = await button.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(56);
    expect(box?.height).toBeGreaterThanOrEqual(56);
  }

  const controlsBox = await controls.boundingBox();
  const cameraBox = await cameraControl.boundingBox();
  const headerBox = await page.locator('.site-header').boundingBox();
  const viewport = page.viewportSize();
  expect(controlsBox).not.toBeNull();
  expect(cameraBox).not.toBeNull();
  expect(headerBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(controlsBox!.y).toBeGreaterThan(64);
  expect(controlsBox!.y + controlsBox!.height).toBeLessThanOrEqual(viewport!.height);
  expect(cameraBox!.width).toBeGreaterThanOrEqual(44);
  expect(cameraBox!.height).toBeGreaterThanOrEqual(44);
  expect(cameraBox!.x).toBeGreaterThanOrEqual(controlsBox!.x + controlsBox!.width);
  expect(cameraBox!.x + cameraBox!.width).toBeLessThanOrEqual(viewport!.width);
  expect(cameraBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);

  await cameraControl.click();
  await expect(cameraControl).toHaveAttribute('aria-pressed', 'false');
  await expect(scene).toHaveAttribute('data-camera-mode', 'overview');
  await cameraControl.click();
  await expect(cameraControl).toHaveAttribute('aria-pressed', 'true');
  await expect(scene).toHaveAttribute('data-camera-mode', 'follow');

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
