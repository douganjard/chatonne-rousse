# Visual QA Workflow

Use this runbook when a Codex agent changes layout, styling, 3D scene code, navigation, content pages, or model assets. The goal is to make browser verification repeatable without changing app behavior.

## Start The App

From the repo root:

```sh
pnpm run dev:codex
```

Open:

```text
http://127.0.0.1:5173/
```

If port `5173` is already in use, stop the old server first. The `dev:codex` script uses `--strictPort`, so a port conflict should fail loudly instead of moving to another URL.

Optional terminal checklist:

```sh
node scripts/visual-qa.mjs
```

Use `VISUAL_QA_URL=http://127.0.0.1:5173/ node scripts/visual-qa.mjs` if the app is intentionally running somewhere else.

## Browser Setup

Use the in-app browser skill or another Playwright-backed browser session. Keep DevTools console and network inspection available while capturing screenshots.

Required viewports:

```text
Desktop: 1440 x 1000
Tablet:  834 x 1112
Mobile:  390 x 844
Narrow:  320 x 568
Large mobile: 430 x 932
Landscape mobile: 844 x 390
```

Required browser states:

```text
Default motion: normal rendering, WebGL enabled
Reduced motion: emulate prefers-reduced-motion: reduce
```

## Screenshot Matrix

Capture these screenshots for each viewport unless the change is obviously limited to one route.

| Route | URL | State to capture | What to inspect |
| --- | --- | --- | --- |
| Home scene | `/` | Initial load after models settle | Full-bleed 3D room is visible, not blank, and not hidden behind the header. Cat, furniture, floor, lights, and destination objects render. |
| Home scene | `/` | After selecting each destination object | Centered frosted popup remains readable on desktop and mobile. It shows the destination label, description, icon, and correct link. |
| Home reduced motion | `/` | `prefers-reduced-motion: reduce` | Fallback destination grid replaces the WebGL scene. Destination links are visible, tappable, and not overlapped by the fixed header. |
| About | `/about` | Route page | Header nav is readable, active nav state is clear, H1 and copy fit without clipping. |
| Writing | `/writing` | Route page | Same route-page checks as About. |
| Contact | `/contact` | Route page | Same route-page checks as About. |
| Not found | `/missing-route` | Route page | 404 content renders inside the normal site shell and navigation still works. |

## Interaction Checks

On the home scene, move the cat with keyboard controls:

```text
W / ArrowUp: move forward
A / ArrowLeft: turn left
D / ArrowRight: turn right
S / ArrowDown: do nothing and should not scroll the page
```

On a coarse-pointer mobile device, verify the bottom steering dock:

```text
Left button: turn left while held
Up button: move forward while held
Right button: turn right while held
Forward + left/right: move and turn simultaneously
```

Release each pointer outside its button, background the page, and return to confirm movement never remains stuck. The dock must stay above the device safe area and remain available while a destination popup is open.

Verify both mobile camera modes:

```text
Follow: default desktop-scale cat framing that moves gently after the cat leaves the central dead zone
Overview: complete room, side walls, portrait, window, shelves, cat, and floor destinations on a black background
```

The camera button starts pressed in Follow, changes to an unpressed state in Overview, and returns smoothly to the closer framing when toggled again. Drive the cat to every room limit in Follow and confirm she remains visible with space between her and the viewport edge. The camera must not rotate with the cat, expose empty space outside the room, bob, overshoot, or jitter. Rotate between portrait and landscape in both modes and confirm reframing is smooth.

Visit each destination object:

```text
About: Framed portrait
How about a game of chess?: Chess board
Synth Conductor: MIDI keyboard
```

For each object, verify:

- The popup changes to the matching destination.
- The popup link routes to the matching page.
- The cat remains within the room and does not pass through major furniture.
- The scene continues animating after route navigation back to `/`.

## Browser Checks

For every QA pass, inspect these browser signals:

- Console has no uncaught exceptions.
- Console has no React hydration, key, hook, or router warnings.
- Network panel has no failed requests for `/models/**/*.glb` or app assets.
- The WebGL canvas has non-empty pixels after load at desktop and mobile sizes.
- The home scene remains interactive after resizing from desktop to mobile and back.
- Text does not overlap the fixed header, nav, popup, fallback grid, or content-page body copy.
- Mobile steering controls remain within the viewport, avoid the header and centered popup, and do not obscure the cat at spawn.
- Mobile Overview contains the complete room at every required aspect ratio; Follow keeps the cat comfortably framed without obscuring navigation UI.
- Focus states are visible for nav links, fallback links, and popup links.
- Pointer and keyboard navigation both work for route links.

## Known Warnings

The browser may show Rapier's development-time warning about deprecated initialization parameters:

```text
using deprecated parameters for the initialization function; pass a single object instead
```

This warning is accepted only when the scene still renders, animates, and handles collisions normally. Treat these as issues to investigate:

- GLB model `404` responses or MIME/type errors.
- `THREE.WebGLRenderer: Context Lost` during ordinary navigation or resize.
- WebGL unsupported errors outside an intentionally reduced-motion or no-GPU environment.
- React warnings about duplicate keys, invalid DOM props, or state updates during render.
- Vite overlay errors.

If the test environment cannot provide WebGL, capture the reduced-motion state and state clearly that the default-motion 3D scene could not be visually verified there.

## Suggested Evidence

Store temporary screenshots outside the repo unless the user asks to keep them:

```text
/private/tmp/chatonne-rousse-visual-qa/
```

Name files with route, viewport, and state:

```text
home-desktop-initial.png
home-desktop-about-popup.png
home-mobile-reduced-motion.png
about-tablet.png
```

Before handing off, summarize:

- Dev server URL used.
- Viewports tested.
- Routes and home-scene popup states tested.
- Any console or network warnings found.
- Any states not tested and why.
