import { useEffect, useState } from 'react';
import {
  SPOTIFY_NOW_PLAYING_URL,
  isSpotifyNowPlaying,
  type SpotifyNowPlaying,
} from './nowPlaying';

export type SpotifyRequestState = {
  data?: SpotifyNowPlaying;
  loading: boolean;
  error: boolean;
};

export function useSpotifyNowPlaying(active: boolean) {
  const [request, setRequest] = useState<SpotifyRequestState>({ loading: active, error: false });

  useEffect(() => {
    if (!active) {
      setRequest((current) => ({ ...current, loading: false }));
      return;
    }

    let disposed = false;
    let timeout: number | undefined;
    let controller: AbortController | undefined;

    const schedule = () => {
      if (!disposed && document.visibilityState === 'visible') {
        timeout = window.setTimeout(load, 15_000);
      }
    };

    const load = async () => {
      window.clearTimeout(timeout);
      controller?.abort();

      if (document.visibilityState !== 'visible') return;

      controller = new AbortController();
      setRequest((current) => ({ ...current, loading: !current.data, error: false }));

      try {
        const response = await fetch(SPOTIFY_NOW_PLAYING_URL, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Spotify status request failed: ${response.status}`);

        const data: unknown = await response.json();
        if (!isSpotifyNowPlaying(data)) throw new Error('Spotify status response was malformed');
        if (!disposed) setRequest({ data, loading: false, error: false });
      } catch (error) {
        if (!disposed && !(error instanceof DOMException && error.name === 'AbortError')) {
          setRequest((current) => ({ ...current, loading: false, error: true }));
        }
      } finally {
        schedule();
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        window.clearTimeout(timeout);
        controller?.abort();
      } else {
        void load();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    void load();

    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      controller?.abort();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [active]);

  return request;
}
