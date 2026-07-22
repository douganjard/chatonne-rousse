# Chatonne Rousse

A Vite/React personal site with an interactive Three.js room on the home page. The app is intended to be developed through GitHub pull requests, validated with automated checks, and deployed to Firebase Hosting with Squarespace managing DNS.

## Local Development

Install dependencies:

```sh
pnpm install
```

Start the Codex-friendly dev server:

```sh
pnpm run dev:codex
```

Open `http://127.0.0.1:5173/`.

## Scripts

- `pnpm run dev:codex`: run Vite at `http://127.0.0.1:5173/`.
- `pnpm run check`: run TypeScript, production build, and ESLint.
- `pnpm run check:quick`: run TypeScript and ESLint.
- `pnpm run test:smoke`: run Playwright route and scene smoke tests.
- `pnpm run lhci`: run Lighthouse CI after a production build.
- `pnpm run analyze`: build with a bundle visualization at `dist/bundle-stats.html`.
- `pnpm run firebase:emulate`: serve the production build through Firebase Hosting locally.
- `pnpm run firebase:deploy`: deploy `dist` to Firebase Hosting.

## Environment

Copy `.env.example` to `.env.local` and fill in Firebase web app values when production telemetry should be enabled locally. Analytics only runs in production builds and only when required Firebase values are present.

```sh
cp .env.example .env.local
```

Set `VITE_ANALYTICS_DISABLED=true` to force telemetry off.

## Validation

Run before opening a pull request:

```sh
pnpm run check
```

For scene, layout, route, or asset changes, also follow `docs/visual-qa.md` and run:

```sh
pnpm run test:smoke
```

## Deployment

Firebase Hosting is the primary host. Squarespace should manage DNS only.

The GitHub workflows expect:

- Repository variable: `FIREBASE_PROJECT_ID`
- Repository secret: `FIREBASE_SERVICE_ACCOUNT`
- Firebase project alias in `.firebaserc`; update `chatonne-rousse` if the actual Firebase project ID differs.

See `docs/v1-ops-completion-guide.md` for the remaining V1 setup checklist, and `docs/release.md` for the steady-state release, monitoring, and rollback runbook.

## Attribution And License

Source code is licensed under MIT. Third-party assets keep their original licenses and attribution requirements; see `ATTRIBUTION.md`.
