# Spotify Now-Playing Operations

The browser never authenticates with Spotify. A second-generation Firebase HTTPS Function reads Doug's authorized account and returns only normalized playback metadata.

## Prerequisites

- Firebase project `chatonne-rousse` on the Blaze plan. Cloud Functions and Secret Manager require billing.
- A Spotify developer app owned by Doug. Development-mode ownership requires Spotify Premium and is limited to the app's allowed users.
- Node.js 22 and the repository's pinned pnpm version.

## Spotify App Setup

1. Create an app in the Spotify Developer Dashboard.
2. Add this exact redirect URI: `http://127.0.0.1:8888/callback`.
3. Export the app credentials only in the local shell:

   ```sh
   export SPOTIFY_CLIENT_ID='...'
   export SPOTIFY_CLIENT_SECRET='...'
   ```

4. Run `node scripts/spotify-auth.mjs`, open the printed authorization URL, and approve only `user-read-currently-playing` and `user-read-recently-played`.
5. Copy the refresh token shown in the terminal into Firebase Secret Manager. Do not save it in an env file or commit it.

## Firebase Secrets And Deployment

Set each secret through Firebase's interactive prompt so values do not enter shell history:

```sh
pnpm exec firebase functions:secrets:set SPOTIFY_CLIENT_ID
pnpm exec firebase functions:secrets:set SPOTIFY_CLIENT_SECRET
pnpm exec firebase functions:secrets:set SPOTIFY_REFRESH_TOKEN
pnpm run firebase:deploy
```

Production CI deploys `spotifyNowPlaying` before Hosting. Pull-request Hosting previews intentionally use the currently deployed function; proposed function changes are checked in CI and should be exercised with the emulator before merge.

## Local Emulator

Create an ignored `functions/.secret.local` with the three secret names for local-only testing, then run:

```sh
pnpm run firebase:emulate
```

Hosting proxies `/api/spotify/now-playing` to the Functions emulator at `http://127.0.0.1:5001`. When running Vite separately, set `VITE_SPOTIFY_API_URL` to `http://127.0.0.1:5001/chatonne-rousse/us-central1/spotifyNowPlaying`.

## Reauthorization And Recovery

Spotify refresh tokens expire after six months under the current development-mode rules. Schedule reauthorization before that deadline:

1. Re-run `node scripts/spotify-auth.mjs` with the same Spotify app credentials.
2. Replace `SPOTIFY_REFRESH_TOKEN` using `firebase functions:secrets:set`.
3. Deploy the function so the new secret version is bound.
4. Request `/api/spotify/now-playing` and confirm a normalized `playing`, `paused`, `recent`, or `idle` response.

An expired or revoked token produces `unavailable` without exposing upstream details. For `401`, reauthorize. For `403`, confirm Doug remains an allowed Premium development user and the requested scopes are unchanged. For `429` or temporary Spotify failures, the function serves its last sanitized value when available; wait for the retry window rather than increasing the 15-second client polling rate.
