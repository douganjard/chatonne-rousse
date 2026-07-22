# Room Acceptance Checklist

Use this checklist before accepting changes to the interactive room scene. It is scoped to the home-page room in `DiscoveryScene` and the destination navigation overlay.

## Room Layout Invariants

- [ ] The room remains a bounded square floor with visible left, right, and back walls; the playable cat area remains clamped inside the room limits.
- [ ] The camera frames the whole navigable room from the front/top angle without clipping the sofa, shelves, window, destination objects, or cat start position.
- [ ] The rug stays centered in the room and does not visually disappear into the floor or z-fight with nearby meshes.
- [ ] The built-in shelves remain on the right wall and do not intrude into the center walking path.
- [ ] The window remains on the left wall, visually distinct from wall trim, baseboards, and the floor.
- [ ] The cat starts on an open patch of floor and can turn in place without intersecting furniture.

## Table And Sofa Symmetry

- [ ] The sofa remains centered on the back wall, parallel to the wall, and visually balanced around the room centerline.
- [ ] The left and right side tables remain mirrored around the sofa center, with matching scale, height, and distance from the sofa arms.
- [ ] Side-table accessories remain on top of their respective tables and do not float, sink, or cross into the sofa cushions.
- [ ] The coffee table remains centered in front of the sofa, parallel to it, and leaves a clear walkway around both long sides.
- [ ] Sofa pillows remain distributed across the sofa without hiding the sofa silhouette or overlapping each other.

## Plant And Window Separation

- [ ] The large floor plant near the back-left corner remains separate from the left-wall window plant.
- [ ] The window plant stays low enough that it reads as foreground decor, not as part of the window frame.
- [ ] Plant foliage does not clip through the window pane, wall, baseboard, side table, or sofa.
- [ ] The back-left plant and left-window plant each have distinct collision footprints where applicable; the cat should not be blocked by invisible plant space outside the visible pot/foliage.
- [ ] Plant colors and emissive accents remain warm-green and do not overpower the window glow.

## Collisions And Movement

- [ ] Solid obstacles match their visual footprints closely enough that the cat stops before visibly entering the sofa, side tables, coffee table, plants, lamp, or shelves.
- [ ] Sliding movement still works when the cat approaches an obstacle diagonally; the cat should not get stuck against simple furniture edges.
- [ ] Room-edge clamping prevents the cat from passing through or behind walls.
- [ ] No obstacle blocks the initial cat spawn or the direct approach path to any destination object.
- [ ] Destination collision boxes let the cat touch the portrait, chessboard, and MIDI keyboard but prevent her center from passing through them.
- [ ] The chessboard and MIDI keyboard occupy distinct left and right floor zones with clear walking space between them.
- [ ] The cat can rotate freely beside each obstacle and can back away using normal controls.
- [ ] Physics bodies remain fixed for static furniture, room pieces, and destination objects; the cat remains the only kinematic moving body.

## Destination Popup Reachability

- [ ] All active destination objects are visible from the default camera angle: Framed portrait, Chess board, and MIDI keyboard.
- [ ] Each destination object can be reached by walking the cat within popup range without crossing blocked furniture.
- [ ] The popup appears only when the cat is close to the intended destination object and clears when the cat walks away.
- [ ] The popup content matches the active destination object, destination label, tagline, accent, and link target.
- [ ] The "Open" link remains clickable with pointer input and does not block movement keys when no popup is active.
- [ ] Destination active states remain visually noticeable without causing large scale jumps or overlapping nearby objects.

## Controls And Accessibility

- [ ] `W` and `ArrowUp` move the cat forward; `A`/`ArrowLeft` and `D`/`ArrowRight` turn the cat.
- [ ] `S` and `ArrowDown` are handled consistently with the current forward-only movement model and do not scroll the page while interacting with the scene.
- [ ] Key listeners are cleaned up when the scene unmounts.
- [ ] Coarse-pointer devices show bottom-centered Turn left, Move forward, and Turn right controls with at least 56px touch targets.
- [ ] Mobile controls move continuously while held and support holding forward with either turn direction.
- [ ] Pointer release, cancellation, lost capture, page hiding, window blur, route changes, and unmount all stop mobile movement.
- [ ] The mobile dock stays above the device safe area, remains available while a popup is open, and does not overlap the header or cat at spawn.
- [ ] Fine-pointer desktop users do not see the mobile dock, and keyboard controls continue to work unchanged.
- [ ] Mobile Follow is the default and keeps the cat approximately the same visual size as the desktop camera.
- [ ] Mobile Overview fits the complete room, side walls, portrait, window, shelves, cat, and destination objects on a black background at portrait and landscape aspect ratios.
- [ ] The 44px camera control sits beside the steering dock without shifting it off center or overlapping the header, popup, or safe area.
- [ ] Follow mode uses restrained dead-zone panning, keeps the cat fully visible at every room limit, preserves camera pitch, and does not rotate, bob, overshoot, jitter, or expose empty space outside the room.
- [ ] Switching between Overview and Follow is smooth, does not move the cat, and does not change the active destination.
- [ ] Resizing or rotating the viewport smoothly recalculates the Overview fit without clipping room boundaries.
- [ ] The scene keeps an accessible label for the interactive room navigation area.
- [ ] The popup announces destination changes politely and keeps a descriptive accessible label.
- [ ] Reduced-motion fallback remains available and still exposes the same destinations if WebGL or motion is unavailable.

## Material Expectations

- [ ] Wood surfaces keep visible grain or bump detail on the floor, trim, shelves, and tables.
- [ ] Fabric surfaces keep woven texture and non-metallic roughness on the sofa, pillows, and rug.
- [ ] Brass and lamp materials retain controlled metalness and roughness; they should not read as flat yellow plastic or mirror chrome.
- [ ] Cat fur keeps its orange texture/bump treatment and remains lit enough to read against the room floor.
- [ ] Window materials keep warm emissive/translucent qualities without washing out adjacent objects.
- [ ] Texture changes do not create severe aliasing, flicker, or repeating seams visible from the default camera.

## Known Acceptable Warnings

- [ ] No new runtime warnings appear during ordinary room navigation beyond known third-party development noise from Vite, React Three Fiber, Drei, Three.js, Rapier, or browser WebGL diagnostics.
- [ ] Asset-loading warnings are acceptable only when they are transient during development reloads and all referenced GLB models still render after loading completes.
- [ ] WebGL precision, antialiasing, or performance warnings are acceptable only when the scene remains visible, interactive, and correctly framed on supported desktop and mobile browsers.
- [ ] React Strict Mode duplicate mount/loading behavior is acceptable only if it does not leave duplicate meshes, duplicate event listeners, stuck controls, or persistent duplicate console errors.
- [ ] Any warning tied to missing assets, broken routes, failed links, uncaught exceptions, or inaccessible controls is not acceptable.
