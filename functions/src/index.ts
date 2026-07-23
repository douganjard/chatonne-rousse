import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { onRequest } from 'firebase-functions/v2/https';
import { SpotifyNowPlayingService } from './spotify.js';

const clientId = defineSecret('SPOTIFY_CLIENT_ID');
const clientSecret = defineSecret('SPOTIFY_CLIENT_SECRET');
const refreshToken = defineSecret('SPOTIFY_REFRESH_TOKEN');
const service = new SpotifyNowPlayingService();

export const spotifyNowPlaying = onRequest(
  {
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 10,
    minInstances: 0,
    secrets: [clientId, clientSecret, refreshToken],
  },
  async (request, response) => {
    if (request.method !== 'GET') {
      response.set('Allow', 'GET').status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const value = await service.get({
        clientId: clientId.value(),
        clientSecret: clientSecret.value(),
        refreshToken: refreshToken.value(),
      });
      response
        .set('Cache-Control', 'public,max-age=10,s-maxage=10,stale-while-revalidate=20')
        .set('Content-Type', 'application/json')
        .status(200)
        .json(value);
    } catch (error) {
      logger.warn('Spotify now-playing request failed', {
        error: error instanceof Error ? error.name : 'UnknownError',
      });
      response.status(200).json({ state: 'unavailable', fetchedAt: new Date().toISOString() });
    }
  },
);
