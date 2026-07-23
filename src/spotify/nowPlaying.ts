export type SpotifyPlaybackState = 'playing' | 'paused' | 'recent' | 'idle' | 'unavailable';

export type SpotifyItem = {
  type: 'track' | 'episode';
  title: string;
  creators: string[];
  collection?: string;
  artwork?: {
    url: string;
    width: number;
    height: number;
  };
  spotifyUrl: string;
};

export type SpotifyNowPlaying = {
  state: SpotifyPlaybackState;
  item?: SpotifyItem;
  fetchedAt: string;
};

export const SPOTIFY_NOW_PLAYING_URL =
  import.meta.env.VITE_SPOTIFY_API_URL || '/api/spotify/now-playing';

export function isSpotifyNowPlaying(value: unknown): value is SpotifyNowPlaying {
  if (!value || typeof value !== 'object') return false;

  const response = value as Partial<SpotifyNowPlaying>;
  return (
    ['playing', 'paused', 'recent', 'idle', 'unavailable'].includes(response.state ?? '') &&
    typeof response.fetchedAt === 'string'
  );
}
