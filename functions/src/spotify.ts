export type SpotifyPlaybackState = 'playing' | 'paused' | 'recent' | 'idle' | 'unavailable';

export type SpotifyNowPlaying = {
  state: SpotifyPlaybackState;
  item?: {
    type: 'track' | 'episode';
    title: string;
    creators: string[];
    collection?: string;
    artwork?: { url: string; width: number; height: number };
    spotifyUrl: string;
  };
  fetchedAt: string;
};

export type SpotifySecrets = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

type TokenCache = { token: string; expiresAt: number };
type ResponseCache = { value: SpotifyNowPlaying; expiresAt: number };
type Fetch = typeof fetch;

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const CURRENT_URL = 'https://api.spotify.com/v1/me/player/currently-playing';
const RECENT_URL = 'https://api.spotify.com/v1/me/player/recently-played?limit=1';

export class SpotifyNowPlayingService {
  private tokenCache?: TokenCache;
  private responseCache?: ResponseCache;

  constructor(
    private readonly fetcher: Fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async get(secrets: SpotifySecrets): Promise<SpotifyNowPlaying> {
    const timestamp = this.now();
    if (this.responseCache && this.responseCache.expiresAt > timestamp) return this.responseCache.value;

    if (!secrets.clientId || !secrets.clientSecret || !secrets.refreshToken) {
      return this.cache({ state: 'unavailable', fetchedAt: new Date(timestamp).toISOString() });
    }

    try {
      const value = await this.load(secrets, true);
      return this.cache(value);
    } catch {
      if (this.responseCache) return this.responseCache.value;
      return this.cache({ state: 'unavailable', fetchedAt: new Date(timestamp).toISOString() });
    }
  }

  private cache(value: SpotifyNowPlaying) {
    this.responseCache = { value, expiresAt: this.now() + 10_000 };
    return value;
  }

  private async load(secrets: SpotifySecrets, retryUnauthorized: boolean): Promise<SpotifyNowPlaying> {
    const token = await this.accessToken(secrets);
    const current = await this.fetcher(CURRENT_URL, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    if (current.status === 401 && retryUnauthorized) {
      this.tokenCache = undefined;
      return this.load(secrets, false);
    }
    if (current.status === 204) return this.loadRecent(token);
    if (!current.ok) throw new Error(`Spotify current playback failed with ${current.status}`);

    const payload: unknown = await current.json();
    const record = asRecord(payload);
    const item = normalizeItem(record.item);
    if (!item) throw new Error('Spotify current playback response was malformed');

    return {
      state: record.is_playing === true ? 'playing' : 'paused',
      item,
      fetchedAt: new Date(this.now()).toISOString(),
    };
  }

  private async loadRecent(token: string): Promise<SpotifyNowPlaying> {
    const response = await this.fetcher(RECENT_URL, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Spotify recent playback failed with ${response.status}`);

    const payload = asRecord(await response.json());
    const entries = Array.isArray(payload.items) ? payload.items : [];
    const first = asRecord(entries[0]);
    const item = normalizeItem(first.track);

    return {
      state: item ? 'recent' : 'idle',
      ...(item ? { item } : {}),
      fetchedAt: new Date(this.now()).toISOString(),
    };
  }

  private async accessToken(secrets: SpotifySecrets) {
    if (this.tokenCache && this.tokenCache.expiresAt > this.now() + 60_000) return this.tokenCache.token;

    const response = await this.fetcher(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${secrets.clientId}:${secrets.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: secrets.refreshToken }),
    });
    if (!response.ok) throw new Error(`Spotify token refresh failed with ${response.status}`);

    const payload = asRecord(await response.json());
    if (typeof payload.access_token !== 'string') throw new Error('Spotify token response was malformed');
    const expiresIn = typeof payload.expires_in === 'number' ? payload.expires_in : 3600;
    this.tokenCache = { token: payload.access_token, expiresAt: this.now() + expiresIn * 1000 };
    return payload.access_token;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function imageFrom(value: unknown) {
  const images = Array.isArray(value) ? value : [];
  const image = asRecord(images[0]);
  return typeof image.url === 'string' && typeof image.width === 'number' && typeof image.height === 'number'
    ? { url: image.url, width: image.width, height: image.height }
    : undefined;
}

export function normalizeItem(value: unknown): SpotifyNowPlaying['item'] | undefined {
  const item = asRecord(value);
  const externalUrls = asRecord(item.external_urls);
  if (typeof item.name !== 'string' || typeof externalUrls.spotify !== 'string') return undefined;

  if (item.type === 'track') {
    const artists = Array.isArray(item.artists) ? item.artists : [];
    const album = asRecord(item.album);
    return {
      type: 'track',
      title: item.name,
      creators: artists.map((artist) => asRecord(artist).name).filter((name): name is string => typeof name === 'string'),
      ...(typeof album.name === 'string' ? { collection: album.name } : {}),
      ...(imageFrom(album.images) ? { artwork: imageFrom(album.images) } : {}),
      spotifyUrl: externalUrls.spotify,
    };
  }

  if (item.type === 'episode') {
    const show = asRecord(item.show);
    const creators = typeof show.name === 'string' ? [show.name] : [];
    return {
      type: 'episode',
      title: item.name,
      creators,
      ...(typeof show.name === 'string' ? { collection: show.name } : {}),
      ...(imageFrom(item.images) ? { artwork: imageFrom(item.images) } : {}),
      spotifyUrl: externalUrls.spotify,
    };
  }

  return undefined;
}
