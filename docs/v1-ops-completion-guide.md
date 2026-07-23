# V1 Ops Readiness Checklist

Last reviewed: 2026-07-22.

Use this as the working checklist for getting Chatonne Rousse from "deployed" to "robust V1." Checked items are complete or verified from this repository, local Git config, GitHub Actions results, or the Firebase default hosting URL. Unchecked items need account-level setup, a real pull request, or production-domain cutover verification.

## Current Verified State

- [x] Local repository is on `main`.
- [x] Local worktree is clean.
- [x] Git identity is configured globally and locally as `Doug Anjard <douganjard@gmail.com>` for future commits.
- [x] Remote `origin` is `git@github.com:douganjard/chatonne-rousse.git`.
- [x] GitHub repository is public.
- [x] `main` is pushed to GitHub.
- [x] Firebase project ID is `chatonne-rousse` in `.firebaserc`.
- [x] Firebase default domain is live at `https://chatonne-rousse.web.app/`.
- [x] Firebase deep link `https://chatonne-rousse.web.app/about` returns HTTP 200.
- [x] Firebase model asset `https://chatonne-rousse.web.app/models/toon_cat_free.glb` returns HTTP 200.
- [x] Latest verified `CI` run succeeded on commit `257220e`.
- [x] Latest verified `Firebase Production` run succeeded on commit `257220e`.
- [ ] Branch protection could not be verified from the unauthenticated public API; confirm manually in GitHub settings.
- [ ] Squarespace custom-domain DNS cutover has not been verified.
- [ ] Google Cloud Monitoring uptime checks have not been verified.
- [ ] Firebase Analytics event receipt has not been verified in the Firebase or GA console.

## 1. Source Control And Repo Hygiene

- [x] Initialize Git repository.
- [x] Use `main` as the production branch.
- [x] Configure Git author/committer identity.
- [x] Add `.gitignore` for dependencies, build output, local env files, reports, and generated artifacts.
- [x] Add `README.md`.
- [x] Add `CONTRIBUTING.md`.
- [x] Add `.github/pull_request_template.md`.
- [x] Add `.github/dependabot.yml`.
- [x] Add `LICENSE`.
- [x] Add `ATTRIBUTION.md`.
- [x] Publish the repo to public GitHub.
- [x] Push `main` to `origin`.
- [ ] Enable or confirm branch protection on `main`.
- [ ] Require pull requests before merging to `main`.
- [ ] Require status checks before merging.
- [ ] Require the `CI` workflow.
- [ ] Consider requiring `Visual Smoke` and `Lighthouse` once PR runtime and warning posture are stable.
- [ ] Disallow force pushes to `main`.

## 2. GitHub Actions

- [x] Add `CI` workflow for pushes to `main` and pull requests.
- [x] Add workflow concurrency so newer commits cancel stale runs.
- [x] Install pnpm explicitly with `pnpm/action-setup@v4`.
- [x] Use Node 22 in workflows.
- [x] Run `pnpm install --frozen-lockfile`.
- [x] Run `pnpm run check` in CI.
- [x] Fix pnpm ignored-builds policy by approving `re2`.
- [x] Verify `CI` passes on GitHub.
- [x] Add Firebase production workflow for pushes to `main`.
- [x] Verify Firebase production workflow passes on GitHub.
- [x] Add Firebase preview workflow for pull requests.
- [x] Add Visual Smoke workflow for scene/layout/content/model changes.
- [x] Add Lighthouse workflow for frontend and public-asset changes.
- [ ] Open a normal PR and verify Firebase Preview posts a preview channel URL.
- [ ] Open or update a PR touching visual paths and verify `Visual Smoke` passes in GitHub.
- [ ] Open or update a PR touching Lighthouse paths and verify `Lighthouse` passes or produces accepted warnings.
- [ ] Decide whether `Visual Smoke` and `Lighthouse` should become required checks.

## 3. Package And Build Policy

- [x] Pin package manager in `package.json` to `pnpm@11.9.0`.
- [x] Keep `pnpm-lock.yaml` valid for frozen installs.
- [x] Keep allowed native/build scripts in `pnpm-workspace.yaml`.
- [x] Approve build scripts for `@firebase/util`, `esbuild`, `protobufjs`, and `re2`.
- [x] Keep TypeScript on a version supported by `typescript-eslint`.
- [x] Update Vite `manualChunks` to the function form required by current Vite/Rolldown.
- [x] Document known chunk-size warnings in `AGENTS.md`.
- [x] Local `CI=true pnpm install --frozen-lockfile` passes.
- [x] Local `CI=true pnpm run check` passes.
- [x] Local Playwright smoke tests passed previously: 21 passed, 3 skipped.
- [ ] Re-run `pnpm run test:smoke` after the next scene, layout, route, or asset change.

## 4. Firebase Hosting

- [x] Create or choose Firebase project `chatonne-rousse`.
- [x] Add `.firebaserc` with the `chatonne-rousse` project alias.
- [x] Add `firebase.json`.
- [x] Configure Hosting public directory as `dist`.
- [x] Configure SPA rewrite from `**` to `/index.html`.
- [x] Configure long-cache headers for hashed assets.
- [x] Configure model asset caching.
- [x] Configure no-cache behavior for `index.html`.
- [x] Configure baseline security headers.
- [x] Create Firebase web app.
- [x] Add Firebase web config repository variables for Vite builds.
- [x] Add `FIREBASE_PROJECT_ID` repository variable.
- [x] Add `FIREBASE_SERVICE_ACCOUNT` repository secret.
- [x] Confirm production deploy from `main` works.
- [x] Confirm Firebase default-domain root URL works.
- [x] Confirm Firebase default-domain deep link works.
- [x] Confirm representative GLB asset URL works.
- [ ] Confirm Firebase service account uses the minimum practical deploy permissions.
- [ ] Run and document one manual Firebase deploy or rollback drill.

## 5. Squarespace DNS Cutover

Use Squarespace only as DNS/domain management. Do not embed the React app into Squarespace page content.

- [ ] Choose the final production domain and hostnames.
- [ ] In Firebase Hosting, add the custom domain.
- [ ] In Squarespace DNS, add Firebase's TXT verification record.
- [ ] Add Firebase Hosting DNS records for the chosen hostnames, as provided by Firebase.
- [ ] For apex and `www`, use Firebase's documented A record target when applicable:

  ```text
  @    A    199.36.158.100
  www  A    199.36.158.100
  ```

- [ ] Remove conflicting A, AAAA, or CNAME records for the same hostnames.
- [ ] Wait for DNS propagation and Firebase SSL provisioning.
- [ ] Verify `https://YOUR_DOMAIN/`.
- [ ] Verify `https://YOUR_DOMAIN/about`.
- [ ] Verify `https://YOUR_DOMAIN/models/toon_cat_free.glb`.
- [ ] Add custom domain to Firebase authorized domains if needed.

## 6. Canonical URLs, Search, And Social Metadata

- [x] Add `public/robots.txt`.
- [x] Add `public/sitemap.xml`.
- [x] Add canonical URL metadata in `index.html`.
- [x] Add Open Graph title, description, and URL metadata.
- [x] Add Twitter card metadata.
- [x] Current canonical, sitemap, and robots URLs point to `https://chatonne-rousse.web.app/`.
- [ ] After Squarespace DNS cutover, replace Firebase default-domain URLs with the final production domain in `index.html`.
- [ ] After Squarespace DNS cutover, replace the sitemap host in `public/robots.txt`.
- [ ] After Squarespace DNS cutover, replace URL hosts in `public/sitemap.xml`.
- [ ] Submit or inspect the final sitemap in Google Search Console if search indexing matters for V1.

## 7. Analytics And Privacy

Repository-side telemetry exists in `src/lib/telemetry.ts`. It runs only in production, only when Firebase config is present, and only when `VITE_ANALYTICS_DISABLED` is not `true`.

- [x] Add Firebase Analytics initialization guarded by production config.
- [x] Add route/page-view tracking.
- [x] Add Web Vitals tracking for CLS, INP, LCP, and TTFB.
- [x] Add custom events:
  - `scene_loaded`
  - `webgl_failed`
  - `reduced_motion_fallback`
  - `destination_popup_opened`
  - `route_opened_from_scene`
  - `cat_collision_blocked`
  - `web_vital`
- [x] Keep telemetry privacy-conscious in code: no user IDs, no ad tracking, no marketing pixels.
- [x] Add `VITE_ANALYTICS_DISABLED` kill switch.
- [ ] Confirm Google Analytics for Firebase property is connected.
- [ ] Confirm production deploy includes `VITE_FIREBASE_MEASUREMENT_ID`.
- [ ] Confirm expected events arrive in Firebase or GA DebugView/Realtime.
- [ ] Document any future marketing analytics separately before enabling them.

## 8. Google Cloud Monitoring

Google Cloud Monitoring uptime checks are account-level resources and are not configured in this repo.

- [ ] Create public HTTPS uptime check for `https://YOUR_DOMAIN/`.
- [ ] Create public HTTPS uptime check for `https://YOUR_DOMAIN/about`.
- [ ] Create public HTTPS uptime check for `https://YOUR_DOMAIN/models/toon_cat_free.glb`.
- [ ] Alert on HTTP failure.
- [ ] Alert on SSL certificate failure or expiry.
- [ ] Alert on slow response.
- [ ] Alert on representative asset 404.
- [ ] Configure notification channels that you will actually see.
- [ ] After DNS cutover, update checks to the final production domain.

## 9. Release And Rollback

- [x] Add [release.md](release.md) release and operations runbook.
- [x] Document steady-state release flow.
- [x] Document Firebase rollback commands.
- [x] Document Git revert fallback.
- [x] Document visual QA process in [visual-qa.md](visual-qa.md).
- [x] Document room acceptance checklist in [room-acceptance-checklist.md](room-acceptance-checklist.md).
- [ ] Test or rehearse Firebase Hosting rollback against the real project.
- [ ] Update [release.md](release.md) once the final custom domain is known.
- [ ] Update [release.md](release.md) after branch protection is confirmed.

## 10. V1 Quality Work Still Open

These are not blockers for lifecycle wiring, but they are the main gaps before calling the public site a robust V1.

- [ ] Re-run Lighthouse CI and decide whether current warnings are acceptable for V1.
- [ ] Improve home-page LCP if it remains above budget.
- [ ] Improve home-page accessibility if it remains below budget.
- [ ] Review bundle visualization from `pnpm run analyze`.
- [ ] Reduce the large Three.js scene chunk if it becomes a user-facing performance issue.
- [ ] Evaluate GLB compression with Draco or meshopt.
- [ ] Decide whether to add runtime error monitoring such as Sentry.
- [ ] Keep Firebase Performance Monitoring for web disabled unless the beta SDK posture changes.

## 11. Launch Acceptance

Before announcing or treating V1 as launched:

- [x] Public GitHub remote exists.
- [x] `main` is pushed.
- [x] CI passes in GitHub.
- [x] Firebase production deploy works from `main`.
- [x] Firebase default domain works over HTTPS.
- [x] Deep links refresh without 404s on Firebase default domain.
- [x] Representative GLB asset is served from Firebase Hosting.
- [x] Rollback command is documented.
- [ ] Branch protection is enabled and verified.
- [ ] Firebase preview deploy works for a real pull request.
- [ ] Playwright smoke tests pass in GitHub for a relevant PR.
- [ ] Lighthouse workflow runs in GitHub and warnings are accepted or fixed.
- [ ] Squarespace DNS points the chosen domain to Firebase Hosting.
- [ ] HTTPS is provisioned for the final custom domain.
- [ ] Firebase Analytics receives only intended events.
- [ ] Google Cloud Monitoring checks are green.
- [ ] Canonical URLs, sitemap, and robots use the final production domain.
