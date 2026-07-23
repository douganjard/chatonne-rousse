import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const redirectUri = 'http://127.0.0.1:8888/callback';

if (!clientId || !clientSecret) {
  console.error('Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET before running this script.');
  process.exit(1);
}

const state = randomBytes(24).toString('hex');
const authorizeUrl = new URL('https://accounts.spotify.com/authorize');
authorizeUrl.search = new URLSearchParams({
  client_id: clientId,
  response_type: 'code',
  redirect_uri: redirectUri,
  scope: 'user-read-currently-playing user-read-recently-played',
  state,
}).toString();

const server = createServer(async (request, response) => {
  const callback = new URL(request.url ?? '/', redirectUri);
  if (callback.pathname !== '/callback') {
    response.writeHead(404).end('Not found');
    return;
  }

  if (callback.searchParams.get('state') !== state) {
    response.writeHead(400).end('OAuth state did not match. Close this window and try again.');
    server.close();
    return;
  }

  const code = callback.searchParams.get('code');
  if (!code) {
    response.writeHead(400).end(`Spotify authorization failed: ${callback.searchParams.get('error') ?? 'missing code'}`);
    server.close();
    return;
  }

  try {
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ code, grant_type: 'authorization_code', redirect_uri: redirectUri }),
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || typeof tokens.refresh_token !== 'string') {
      throw new Error(`Token exchange failed with ${tokenResponse.status}`);
    }

    response.writeHead(200, { 'Content-Type': 'text/plain' }).end('Authorization complete. Return to the terminal.');
    console.log('\nRefresh token (store this in Firebase Secret Manager; do not commit it):\n');
    console.log(tokens.refresh_token);
    console.log('\nRun: pnpm exec firebase functions:secrets:set SPOTIFY_REFRESH_TOKEN');
  } catch (error) {
    response.writeHead(500).end('Token exchange failed. Return to the terminal for details.');
    console.error(error instanceof Error ? error.message : error);
  } finally {
    server.close();
  }
});

server.listen(8888, '127.0.0.1', () => {
  console.log(`Add this exact redirect URI in the Spotify dashboard: ${redirectUri}`);
  console.log('\nOpen this URL to authorize Doug’s Spotify account:\n');
  console.log(authorizeUrl.toString());
});

setTimeout(() => {
  console.error('Authorization timed out after five minutes.');
  server.close();
}, 300_000).unref();
