# V1 Ops Completion Guide

Use this checklist to finish the operations lifecycle before the first V1 commit and public launch. The repository-side scaffolding exists, but several external systems still need account-level setup.

## Current State

- Local Git repository exists on `main`.
- No commit has been created yet.
- Most current files are staged from the initial lifecycle setup.
- GitHub remote has not been created or connected.
- Firebase Hosting config exists, but the Firebase project ID and hosting site must be verified.
- Squarespace DNS, GitHub secrets, Firebase deploy auth, analytics properties, and uptime checks are not configured yet.
- Local validation passed previously with `pnpm run check` and `pnpm run test:smoke`.
- Lighthouse CI ran, but currently reports warnings for home-page performance/LCP and home-page accessibility.

## 1. Before The First Commit

1. Review the staged diff:

   ```sh
   git status --short
   git diff --cached
   git diff
   ```

2. Confirm the placeholder Firebase/site values:

   - `.firebaserc`: replace `chatonne-rousse` if the real Firebase project ID differs.
   - `index.html`: replace `https://chatonne-rousse.web.app/` with the canonical production domain when known.
   - `public/robots.txt`: replace the sitemap host when known.
   - `public/sitemap.xml`: replace all URL hosts when known.

3. Re-run local validation:

   ```sh
   CI=true pnpm run check
   CI=true pnpm run test:smoke
   ```

4. Optional but recommended before V1:

   ```sh
   pnpm run analyze
   pnpm run lhci
   ```

   Treat Lighthouse warnings as V1 quality items. The current config warns instead of failing so deployment is not blocked while the site is still being tuned.

5. Commit only after the V1 baseline is acceptable:

   ```sh
   git commit -m "Set up V1 operations lifecycle"
   ```

## 2. GitHub Setup

1. Create a public GitHub repository named `chatonne-rousse`.
2. Add the remote and push:

   ```sh
   git remote add origin git@github.com:YOUR_GITHUB_USER/chatonne-rousse.git
   git push -u origin main
   ```

3. Configure repository settings:

   - Enable Actions.
   - Enable Dependabot alerts.
   - Enable secret scanning.
   - Add branch protection for `main`.
   - Require pull requests before merging.
   - Require status checks before merging.
   - Require the `CI` workflow.
   - Add `Visual Smoke` and `Lighthouse` as required checks once their runtime and warning posture are stable.
   - Disallow force pushes to `main`.

4. Verify the workflows start cleanly on the first push:

   - `CI`
   - `Visual Smoke` when relevant paths change
   - `Lighthouse`
   - Firebase workflows after Firebase secrets are added

## 3. Firebase Project And Hosting

1. Create or choose a Firebase project.
2. Update `.firebaserc` if the project ID is not `chatonne-rousse`.
3. Login and select the project:

   ```sh
   pnpm exec firebase login
   pnpm exec firebase use --add
   ```

4. Confirm Hosting uses the existing repo config:

   - Public directory: `dist`
   - SPA rewrite: `** -> /index.html`
   - Static asset caching: configured in `firebase.json`
   - Security headers: configured in `firebase.json`

5. Create a Firebase web app and copy its config values into GitHub repository variables. Use repository variables, not secrets, for the Firebase web app config because these values are embedded into the public browser bundle:

   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_MEASUREMENT_ID`
   - `VITE_ANALYTICS_DISABLED`: set to `false` when analytics should run, or `true` as a production kill switch.

6. Confirm the Firebase Hosting GitHub workflows expose those variables to the Vite build. The preview and production workflows set the `VITE_*` values from the GitHub `vars` context.

7. Add deploy authentication:

   - GitHub repository variable: `FIREBASE_PROJECT_ID`
   - GitHub repository secret: `FIREBASE_SERVICE_ACCOUNT`

8. Run a manual deploy once before relying on CI:

   ```sh
   pnpm run build
   pnpm run firebase:deploy
   ```

9. Verify Firebase-hosted URLs:

   - `/`
   - `/about`
   - `/writing`
   - `/contact`
   - `/missing-route`
   - `/models/toon_cat_free.glb`

## 4. GitHub Actions Deploy Wiring

The workflow files exist, but they are not proven against the real repository and Firebase project yet.

1. Confirm the preview workflow posts a Firebase preview URL on pull requests.
2. Confirm the production workflow deploys only from `main`.
3. Confirm the service account has the minimum permissions needed for Firebase Hosting deploys.
4. Add `VITE_*` Firebase web config values to the build environment if production analytics should be enabled.
5. Confirm forked PR behavior is acceptable. The preview workflow currently deploys only PRs whose source branch is in the same repository.

## 5. Squarespace DNS Cutover

Use Squarespace only as DNS/domain management.

1. In Firebase Hosting, add the custom domain.
2. In Squarespace DNS, add Firebase's TXT verification record.
3. Add Firebase Hosting records for the chosen hostnames:

   ```text
   @    A    199.36.158.100
   www  A    199.36.158.100
   ```

4. Remove conflicting records for the same hostnames.
5. Wait for DNS and SSL provisioning.
6. Verify:

   - `https://YOUR_DOMAIN/`
   - `https://YOUR_DOMAIN/about`
   - `https://YOUR_DOMAIN/models/toon_cat_free.glb`

7. Update canonical domain references after cutover:

   - `index.html`
   - `public/robots.txt`
   - `public/sitemap.xml`
   - Google Cloud Monitoring checks
   - Firebase authorized domains if needed

## 6. Analytics And Privacy

Repository-side telemetry exists in `src/lib/telemetry.ts`, but it is inert unless production Firebase config is present.

1. Create or connect the Google Analytics for Firebase property.
2. Confirm production builds include `VITE_FIREBASE_MEASUREMENT_ID`.
3. Confirm analytics remains privacy-conscious:

   - No user IDs.
   - No ad personalization.
   - No marketing pixels.
   - No invasive profiling.

4. Verify expected events:

   - `page_view`
   - `scene_loaded`
   - `webgl_failed`
   - `reduced_motion_fallback`
   - `destination_popup_opened`
   - `route_opened_from_scene`
   - `cat_collision_blocked`
   - `web_vital`

5. Document any future marketing analytics separately before enabling them.

## 7. Google Cloud Monitoring

Google Cloud Monitoring checks are not configured in the repo and must be created in the Google Cloud project.

Create public HTTPS uptime checks for:

- `https://YOUR_DOMAIN/`
- `https://YOUR_DOMAIN/about`
- `https://YOUR_DOMAIN/models/toon_cat_free.glb`

Alert on:

- HTTP failure.
- SSL certificate failure or expiry.
- Slow response.
- Asset 404.

Use notification channels that you will actually see, such as email or a preferred incident channel.

## 8. V1 Quality Work Still Open

These are not blockers for wiring the lifecycle, but they are the main gaps before calling the site a robust V1.

- Lighthouse home-page performance is low because the 3D scene is heavy.
- Lighthouse LCP is above the current 4 second warning budget.
- Home-page accessibility is slightly below the current 0.9 warning budget.
- The Three.js scene chunk is still large; bundle analysis is available with `pnpm run analyze`.
- GLB asset compression with Draco or meshopt is documented as future work but not implemented.
- Firebase Performance Monitoring for web was intentionally not enabled because the web SDK is beta.
- Error monitoring with Sentry or another runtime error tool is not configured.
- The production domain, sitemap, robots, and Open Graph URLs still use placeholder Firebase Hosting URLs.
- Branch protection, required status checks, and deploy permissions cannot be completed until the public GitHub repository exists.

## 9. Launch Acceptance Checklist

Before announcing or treating V1 as launched:

- [ ] First commit exists locally.
- [ ] Public GitHub remote exists.
- [ ] `main` is pushed.
- [ ] Branch protection is enabled.
- [ ] CI passes in GitHub.
- [ ] Playwright smoke tests pass in GitHub.
- [ ] Lighthouse workflow runs in GitHub and warnings are accepted or fixed.
- [ ] Firebase project ID is real in `.firebaserc`.
- [ ] Firebase preview deploy works for a pull request.
- [ ] Firebase production deploy works from `main`.
- [ ] Squarespace DNS points the chosen domain to Firebase Hosting.
- [ ] HTTPS is provisioned.
- [ ] Deep links refresh without 404s.
- [ ] Firebase Analytics receives only intended events.
- [ ] Google Cloud Monitoring checks are green.
- [ ] Rollback command is tested or documented with the real project.
- [ ] Canonical URLs, sitemap, and robots use the final production domain.
