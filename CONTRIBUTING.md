# Contributing

## Workflow

1. Create a branch from `main`.
2. Make a focused change.
3. Run `pnpm run check`.
4. Open a pull request and complete the PR template.
5. For scene, layout, route, or asset changes, run the visual QA workflow in `docs/visual-qa.md`.

`main` is the production branch and should only change through reviewed pull requests once branch protection is enabled in GitHub.

## Quality Bar

- Keep generated output out of commits unless explicitly needed.
- Do not commit `.env`, Firebase service account JSON, screenshots, reports, or local logs.
- Preserve the reduced-motion fallback for the home page.
- Keep GLB attribution in `ATTRIBUTION.md` when assets change.
- Use the existing Vite/React/Three patterns instead of adding broad abstractions.

## Deployment Changes

Changes to Firebase, GitHub Actions, DNS, or monitoring should include a note in the pull request explaining:

- What environment is affected.
- How the change was validated.
- How to roll back if the change fails.
