# Project Guidance for Codex Agents

This repo is a small Vite/React personal site with an interactive Three.js room on the home page. Work cheaply: read the files listed below before changing behavior, avoid broad refactors, and keep generated/build output out of edits unless the user explicitly asks for it.

## Key Scripts

- `pnpm run dev:codex`: preferred Codex dev server at `http://127.0.0.1:5173/` with `--strictPort`.
- `pnpm dev`: start the Vite dev server with Vite's default host/port behavior.
- `pnpm run check`: run `tsc`, `vite build`, and ESLint.
- `pnpm run check:quick`: run `tsc` and ESLint without a production build.
- `pnpm build`: run `tsc` and then `vite build`.
- `pnpm lint`: run ESLint.
- `pnpm preview`: serve the production build.

In this Codex desktop environment, the default shell may find `pnpm` but not `node`. If scripts fail with `exec: node: not found`, use the bundled runtime:

```sh
PATH=/Users/danjard/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/danjard/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:$PATH pnpm run check
```

## Known Warnings

- pnpm currently warns that the `pnpm.onlyBuiltDependencies` field in `package.json` is ignored by newer pnpm. This is non-blocking; do not edit `package.json` just to silence it unless asked.
- Production builds currently warn that `dist/assets/DiscoveryScene-*.js` is larger than 500 kB after minification. This is expected because the home scene lazy-loads Three, Rapier, Drei, and GLB handling in one scene chunk.
- Browser verification may show Rapier's deprecated initialization-parameter warning. This is accepted only if the scene renders, animates, and blocks collisions normally.
- `dist/` is generated output. Do not treat existing files there as source of truth unless debugging a build artifact.

## Main Files

- `src/content/pages/Home.tsx`: home page switch between the lazy 3D scene and the reduced-motion fallback.
- `src/scene/DiscoveryScene.tsx`: top-level Three/Rapier scene setup, room geometry, furniture, portals, cat controller, and animation.
- `src/scene/materials.ts`: procedural wood, fabric, metal, and fur texture/material helpers.
- `src/scene/SceneModel.tsx`: shared GLB cloning/material override wrapper and scene model preloads.
- `src/scene/collisions.ts`: cat start/room limits plus manual obstacle rectangles and movement resolution.
- `src/scene/modelMetadata.ts`: structured model/layout reference values for future agents; not imported by runtime scene code.
- `src/data/navNodes.ts`: navigation destinations, page paths, interactive object positions, accent colors, and fallback icons.
- `src/components/NavOverlay.tsx`: popup shown when the cat is near a nav node.
- `src/components/ReducedMotionFallback.tsx`: accessible destination grid for reduced motion or scene loading fallback.
- `src/components/SiteLayout.tsx`: fixed header and route navigation.
- `src/styles/global.css`: site layout, overlay, content pages, fallback grid, and mobile nav adjustments.
- `public/models/**`: runtime GLB assets copied by Vite; scene URLs are absolute paths like `/models/toon_cat_free.glb`.
- `docs/model-layout.md`: human-readable GLB model metadata, offsets, and layout notes.
- `docs/visual-qa.md` and `scripts/visual-qa.mjs`: repeatable browser QA workflow and terminal checklist.
- `docs/room-acceptance-checklist.md`: manual acceptance checklist for room layout, furniture symmetry, collisions, destination popup reachability, controls, materials, and expected warnings.
- `ATTRIBUTION.md`: required attribution for the Toon Cat and Kenney assets.

## Scene Coordinates and Movement

- Three.js uses `[x, y, z]`; the room floor is `y = 0`.
- The camera is fixed near `[0, 4.9, 6.2]` and looks at `[0, 0.45, 0]`.
- The room spans roughly `-3.7..3.7` in `x` and `z`; cat movement is clamped by `ROOM_LIMIT = 3.2`.
- The back wall/furniture cluster is at negative `z`; the window is on the left wall at negative `x`; the built-in shelves are on positive `x`.
- Cat spawn is `CAT_START = [0, 0.34, 0.45]`.
- Interactive destination positions live in `navNodes.ts`; the active popup triggers when the cat is within `0.58` units in the X/Z plane.
- Manual obstacle blocking is separate from Rapier mesh colliders. If moving furniture or portals, update both the visual placement and `SOLID_OBSTACLES` when the cat should not pass through it.
- `SOLID_OBSTACLES` stores 2D rectangles as `{ center: [x, z], halfSize: [xHalf, zHalf] }`.

## Interaction Constraints

- Cat controls are intentionally simple: `W`/ArrowUp moves forward, `A`/ArrowLeft turns left, `D`/ArrowRight turns right. `S`/ArrowDown are prevented but do not move backward.
- The scene calls `event.preventDefault()` for handled movement keys, so be careful adding global keyboard shortcuts.
- The cat is a `kinematicPosition` Rapier body; movement is driven in `useFrame`, not by impulses.
- Selection state belongs to `Home.tsx`; `DiscoveryScene` only reports nearby nav node ids through `onSelect`.
- `NavOverlay` has `pointer-events: none` at the overlay and `pointer-events: auto` on the popup so scene layout and links can coexist.
- Respect `prefers-reduced-motion: reduce`: `Home.tsx` must keep a non-3D route through `ReducedMotionFallback`.

## GLB Model Quirks

- `SceneModel` clones `gltf.scene` before applying material overrides. Keep that pattern for shared Kenney assets so one instance does not mutate another.
- The orange cat intentionally uses the loaded `gltf.scene` directly, applies fur textures to its existing materials, disables frustum culling, and plays `actions.Scene` or the first animation.
- The cat model is tiny in source units and is displayed at `scale={0.0019}`, with local position `[0, -0.31, 0]` and rotation `[0, Math.PI, 0]`.
- Tail animation depends on object names: `tail.CTRL_030`, `tail_07`, `tail.01_08`, `tail.02_09`, and `tail.03_010`. Check these names before replacing the cat GLB.
- Several Kenney models need hand-tuned offsets/scales to sit on the floor; do not assume their origins are centered or consistent.
- `KENNEY_MODEL_URLS` and `TOON_CAT_URL` are preloaded in `SceneModel.tsx`; add new required scene GLBs there if they are needed immediately.

## Browser and Dev Server Notes

- For app verification, run Vite with an explicit local host: `pnpm run dev:codex`.
- The home page needs a dev/preview server because GLB URLs are rooted at `/models/...`; do not rely on opening `index.html` from the filesystem.
- `dev:codex` uses port `5173` with `--strictPort`; if that port is already running, use the existing localhost URL or intentionally start another Vite server on a different port.
- Visual QA matters for this repo. Check the home scene on desktop and mobile widths, and verify the reduced-motion fallback when touching scene entry/loading behavior.

## Validation Expectations

- Run `pnpm run check` before handing off when code changes are made.
- If the default PATH lacks `node`, rerun with the bundled runtime PATH shown above and report that detail.
- For scene, layout, or interaction changes, also verify in a browser that:
  - the canvas is nonblank and GLB models load;
  - the cat is visible at spawn and moves with keyboard controls;
  - destination proximity opens the correct popup/link;
  - reduced-motion users get the fallback destination grid;
  - mobile header/nav and popup text do not overlap.
- For content-only page changes, lint/build is usually enough unless CSS or routing changes are involved.
