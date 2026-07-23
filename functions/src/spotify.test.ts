import assert from 'node:assert/strict';
import test from 'node:test';
import { SpotifyNowPlayingService, type SpotifySecrets } from './spotify.js';

const secrets: SpotifySecrets = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  refreshToken: 'refresh-token',
};

const artwork = [{ url: 'https://i.scdn.co/image/cover', width: 640, height: 640 }];
const track = {
  type: 'track',
  name: 'Track title',
  artists: [{ name: 'Artist one' }, { name: 'Artist two' }],
  album: { name: 'Album title', images: artwork },
  external_urls: { spotify: 'https://open.spotify.com/track/example' },
};
const episode = {
  type: 'episode',
  name: 'Episode title',
  show: { name: 'Podcast title' },
  images: artwork,
  external_urls: { spotify: 'https://open.spotify.com/episode/example' },
};

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

function queuedFetch(responses: Response[]) {
  const requests: Array<{ input: string; init?: RequestInit }> = [];
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ input: String(input), init });
    const response = responses.shift();
    if (!response) throw new Error('Unexpected request');
    return response;
  };
  return { fetcher: fetcher as typeof fetch, requests };
}

test('normalizes a currently playing track and caches its access token and response', async () => {
  const mock = queuedFetch([
    json({ access_token: 'access-token', expires_in: 3600 }),
    json({ is_playing: true, item: track, device: { id: 'private-device' } }),
  ]);
  const service = new SpotifyNowPlayingService(mock.fetcher, () => 1_700_000_000_000);

  const first = await service.get(secrets);
  const second = await service.get(secrets);

  assert.deepEqual(second, first);
  assert.equal(first.state, 'playing');
  assert.deepEqual(first.item, {
    type: 'track',
    title: 'Track title',
    creators: ['Artist one', 'Artist two'],
    collection: 'Album title',
    artwork: artwork[0],
    spotifyUrl: 'https://open.spotify.com/track/example',
  });
  assert.equal(mock.requests.length, 2);
  assert.doesNotMatch(JSON.stringify(first), /access-token|client-id|private-device/);
});

test('normalizes a paused podcast episode', async () => {
  const mock = queuedFetch([
    json({ access_token: 'token', expires_in: 3600 }),
    json({ is_playing: false, item: episode }),
  ]);
  const value = await new SpotifyNowPlayingService(mock.fetcher).get(secrets);

  assert.equal(value.state, 'paused');
  assert.deepEqual(value.item?.creators, ['Podcast title']);
  assert.equal(value.item?.type, 'episode');
});

test('falls back from 204 current playback to the latest recent track', async () => {
  const mock = queuedFetch([
    json({ access_token: 'token', expires_in: 3600 }),
    new Response(null, { status: 204 }),
    json({ items: [{ track, played_at: '2026-07-22T12:00:00Z' }] }),
  ]);
  const value = await new SpotifyNowPlayingService(mock.fetcher).get(secrets);

  assert.equal(value.state, 'recent');
  assert.equal(value.item?.title, 'Track title');
  assert.match(mock.requests[2].input, /recently-played\?limit=1/);
});

test('returns idle for empty recent history', async () => {
  const mock = queuedFetch([
    json({ access_token: 'token', expires_in: 3600 }),
    new Response(null, { status: 204 }),
    json({ items: [] }),
  ]);
  const value = await new SpotifyNowPlayingService(mock.fetcher).get(secrets);

  assert.deepEqual(value.state, 'idle');
  assert.equal(value.item, undefined);
});

test('refreshes the token once after a 401', async () => {
  const mock = queuedFetch([
    json({ access_token: 'old-token', expires_in: 3600 }),
    json({}, 401),
    json({ access_token: 'new-token', expires_in: 3600 }),
    json({ is_playing: true, item: track }),
  ]);
  const value = await new SpotifyNowPlayingService(mock.fetcher).get(secrets);

  assert.equal(value.state, 'playing');
  assert.equal(mock.requests.length, 4);
  assert.equal(new Headers(mock.requests[3].init?.headers).get('Authorization'), 'Bearer new-token');
});

test('returns unavailable for missing secrets and malformed or rejected upstream responses', async (context) => {
  await context.test('missing secrets', async () => {
    const value = await new SpotifyNowPlayingService().get({ ...secrets, refreshToken: '' });
    assert.equal(value.state, 'unavailable');
  });

  for (const [name, response] of [
    ['403', json({}, 403)],
    ['429', json({}, 429)],
    ['malformed', json({ is_playing: true, item: { type: 'track' } })],
  ] as const) {
    await context.test(name, async () => {
      const mock = queuedFetch([json({ access_token: 'token', expires_in: 3600 }), response]);
      const value = await new SpotifyNowPlayingService(mock.fetcher).get(secrets);
      assert.equal(value.state, 'unavailable');
    });
  }
});

test('returns stale sanitized data during a short upstream failure', async () => {
  let now = 1_700_000_000_000;
  const mock = queuedFetch([
    json({ access_token: 'token', expires_in: 3600 }),
    json({ is_playing: true, item: track }),
    json({}, 429),
  ]);
  const service = new SpotifyNowPlayingService(mock.fetcher, () => now);
  const first = await service.get(secrets);
  now += 11_000;
  const stale = await service.get(secrets);

  assert.deepEqual(stale, first);
});
