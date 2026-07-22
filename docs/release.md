# Release And Operations Runbook

This project uses GitHub for source control, Firebase Hosting for the React app, and Squarespace DNS for the owned domain.

For the pre-launch checklist, account setup gaps, and first V1 commit steps, use `docs/v1-ops-completion-guide.md`.

## One-Time GitHub Setup

This workspace has been initialized as a local Git repository. To publish it:

```sh
git add .
git commit -m "Set up modern web lifecycle"
git remote add origin git@github.com:YOUR_GITHUB_USER/chatonne-rousse.git
git push -u origin main
```

Create the GitHub repository as public. Then protect `main`:

- Require pull requests before merging.
- Require status checks to pass.
- Require the `CI` workflow.
- Optionally require `Visual Smoke` and `Lighthouse` for relevant changes.
- Disallow force pushes.

## One-Time Firebase Setup

Create or choose a Firebase project. If the project ID is not `chatonne-rousse`, update `.firebaserc`.

Install or use the Firebase CLI:

```sh
pnpm exec firebase login
pnpm exec firebase use --add
pnpm exec firebase init hosting
pnpm exec firebase init hosting:github
```

The repository workflows are already configured for Firebase Hosting deploys. Add these GitHub settings:

- Repository variable `FIREBASE_PROJECT_ID`: the Firebase project ID.
- Repository secret `FIREBASE_SERVICE_ACCOUNT`: the service-account JSON used by the Firebase Hosting deploy action.

Firebase Hosting deploy behavior:

- Pull requests deploy to preview channels that expire after 14 days.
- Pushes to `main` deploy the live channel.
- `firebase.json` rewrites all app paths to `/index.html` so direct links work with `BrowserRouter`.

## Squarespace DNS Cutover

Use Squarespace for DNS only. Do not embed the React app inside Squarespace page content.

1. In Firebase Hosting, add the owned custom domain.
2. In Squarespace DNS, add the TXT verification record shown by Firebase.
3. Add Firebase Hosting A records for apex and/or `www` as needed:

   ```text
   @    A    199.36.158.100
   www  A    199.36.158.100
   ```

4. Remove conflicting A, AAAA, or CNAME records for the same hostnames.
5. Wait for DNS and SSL provisioning.
6. Verify:
   - `https://YOUR_DOMAIN/`
   - `https://YOUR_DOMAIN/about`
   - `https://YOUR_DOMAIN/models/toon_cat_free.glb`

After the canonical domain is known, update:

- `index.html` canonical and Open Graph URL.
- `public/robots.txt`
- `public/sitemap.xml`

## Release Flow

1. Open a pull request.
2. Wait for CI to pass.
3. Review the Firebase preview URL.
4. For scene/layout changes, complete `docs/visual-qa.md`.
5. Merge to `main`.
6. Confirm the production Firebase deploy succeeds.
7. Check the production domain and one deep link.

## Monitoring

Use Google Cloud Monitoring uptime checks:

- `https://YOUR_DOMAIN/`
- `https://YOUR_DOMAIN/about`
- `https://YOUR_DOMAIN/models/toon_cat_free.glb`

Alert on:

- HTTP failure.
- SSL certificate failure or expiry.
- Slow response.
- Asset 404.

Analytics should remain privacy-conscious:

- No user IDs.
- No ad tracking.
- No marketing pixels unless the consent model is revisited.
- Only route views, Web Vitals, and small custom interaction events are collected.

## Rollback

Preferred rollback is a Firebase Hosting rollback:

```sh
pnpm exec firebase hosting:releases:list
pnpm exec firebase hosting:rollback
```

If rollback is not enough, revert the Git commit on `main` and let the production workflow redeploy:

```sh
git revert <commit-sha>
git push origin main
```
