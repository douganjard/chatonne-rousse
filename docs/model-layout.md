# Model and Layout Metadata

This document records the current `DiscoveryScene` room layout, GLB asset bounds, placement conventions, and collision rectangle pairings. It is descriptive metadata only; changing this file does not change scene behavior.

Structured values are also mirrored in `src/scene/modelMetadata.ts`. `DiscoveryScene.tsx` does not import that module.

## Coordinate conventions

- Coordinates use Three.js room space: `[x, y, z]`.
- `y=0` is the floor plane. Positive `y` moves upward.
- Negative `x` is the left/window side of the room. Positive `x` is the right/bookshelf side.
- Negative `z` moves toward the back wall and sofa. Positive `z` moves toward the open/front edge.
- The visible floor is `7.4 x 7.4`, centered at the origin. The back wall is at `z=-3.7`; side walls are at `x=-3.7` and `x=3.7`.
- Cat movement is manually clamped to `ROOM_LIMIT=3.2`, leaving margin inside the walls.
- Cat navigation collision is resolved in the x/z plane with `CAT_COLLISION_RADIUS=0.22`. Portal activation uses an x/z distance threshold of `0.58`.

## Room anchors

| Item | Position | Notes |
| --- | --- | --- |
| Cat start | `[0, 0.34, 0.45]` | Kinematic body origin. Cat model is locally shifted to `[0, -0.31, 0]`, rotated `Math.PI` on y, and scaled `0.0019`. |
| Rug | `[0, 0.021, 0.38]` | Procedural geometry, not `rugRectangle.glb`. Size is `4.45 x 3.05`. |
| Built-in shelves | `[3.58, 1.59, -0.15]`, rotation y `-Math.PI / 2` | Procedural geometry. Collision rect is paired as `bookshelf`. |
| Window | `[-3.58, 1.82, -0.1]`, rotation y `Math.PI / 2` | Procedural geometry on left wall. |

## Navigation objects

| Node | Object | Position | Collision half-size x/z |
| --- | --- | --- | --- |
| `about` | Framed portrait | `[1.82, 0.82, -2.42]` | `[0.12, 0.08]` |
| `chess` | Chess board | `[-1.55, 0.08, 2.05]` | `[0.3, 0.3]` |
| `synth` | MIDI keyboard | `[1.55, 0.07, 1.55]` | `[0.32, 0.12]` |

## GLB assets

Bounds are unscaled model-space bounds measured from the current `.glb` files. Values are rounded to 4 decimals.

| Asset | Status | Unscaled size | Center | Notes |
| --- | --- | --- | --- | --- |
| `/models/toon_cat_free.glb` | Used | `[179.5411, 576.5118, 370.627]` | `[0, -48.794, -184.7572]` | Authored in much larger units than Kenney assets; rendered at scale `0.0019`. |
| `/models/kenney/loungeSofa.glb` | Used | `[0.98, 0.46, 0.41]` | `[0.49, 0.23, -0.205]` | Origin is not centered; mesh extends from x `0` to `0.98` and z `-0.41` to `0`. |
| `/models/kenney/sideTableDrawers.glb` | Used | `[0.5345, 0.3844, 0.2223]` | `[0.2572, 0.1922, -0.0989]` | Off-center origin: most mesh volume is positive x and negative z. The side-table placements compensate for this. |
| `/models/kenney/tableCoffee.glb` | Used | `[0.661, 0.23, 0.4]` | `[-0.1305, 0.115, -0.1]` | Origin is not centered; model placement adds `[0.1, -0.38, 0.1]`. |
| `/models/kenney/lampRoundFloor.glb` | Used | `[0.152, 0.86, 0.1756]` | `[0.06, 0.43, -0.06]` | Slightly off-center x/z origin. |
| `/models/kenney/plantSmall1.glb` | Used | `[0.0947, 0.14, 0.0947]` | `[0, 0.07, 0]` | Used on tables and in shelf cells. |
| `/models/kenney/plant_bushDetailed.glb` | Used | `[0.6025, 0.3604, 0.6025]` | `[0, 0.1302, 0]` | Lower bound reaches `y=-0.05`, so it intentionally overlaps pots. |
| `/models/kenney/plant_flatTall.glb` | Used | `[0.2717, 0.2843, 0.2717]` | `[0, 0.0922, 0]` | Lower bound reaches `y=-0.05`, so it intentionally overlaps pots. |
| `/models/kenney/pot_large.glb` | Used | `[0.5636, 0.2, 0.4881]` | `[0, 0.05, 0]` | Lower bound reaches `y=-0.05`; current floor-plant group offsets seat the pot visually. |
| `/models/kenney/rugRectangle.glb` | Available, unused | `[1.57, 0.01, 0.92]` | `[0.785, 0.005, -0.46]` | Origin is at a corner. The scene currently uses a procedural rug. |
| `/models/kenney/pottedPlant.glb` | Available, unused | `[0.2121, 0.654, 0.2415]` | `[0, 0.327, 0]` | Scene composes pots and foliage separately instead. |

## Cat animation bones

`DiscoveryScene` uses the stock `Scene` animation for the main walk cycle, then applies a lightweight procedural layer to confirmed bones after the animation mixer updates. This keeps the cat responsive without adding IK, physics-driven limbs, or extra animation assets.

| Purpose | Bone names |
| --- | --- |
| Tail sway/flick | `tail.CTRL_030`, `tail_07`, `tail.01_08`, `tail.02_09`, `tail.03_010` |
| Front left leg | `leg.upper.F.L_014`, `leg.lower.FL_015`, `foot.F.L_016` |
| Front right leg | `leg.upper.F.R_024`, `leg.lower.F.R_00`, `foot.F.R_025` |
| Back left leg | `leg.upper.B.L_04`, `leg.lower.B.L_05`, `foot.B.L_06` |
| Back right leg | `leg.upper.B.R_027`, `leg.lower.B.R_028`, `foot.B.R_029` |
| Head and ears | `head_018`, `ear.L_019`, `ear.R_020` |

The GLB also includes `thigh.B.L_03`, `thigh.B.R_026`, and foot IK helper objects (`foot.F.IK.L_031`, `foot.B.IK.L_032`, `foot.F.IK.R_033`, `foot.B.IK.R_034`). The current runtime does not drive those directly.

## Intended furniture positions

| Furniture | Group position | Model/decor placements | Collision rect |
| --- | --- | --- | --- |
| Sofa | `[0, 0.58, -2.78]` | `loungeSofa.glb` at `[-1.543, -0.58, 0.36]`, scale `[3.15, 2.35, 2.05]`; pillows are procedural. | `sofa` |
| Coffee table | `[0, 0.38, -1.55]` | `tableCoffee.glb` at `[0.1, -0.38, 0.1]`, scale `[2.25, 2.05, 2.15]`; small plant at `[0.48, -0.14, -0.08]`, rotation y `-0.28`, scale `0.54`. | `coffee-table` |
| Left side table | `[-1.82, 0.66, -2.62]` | `sideTableDrawers.glb` at `[0.1, -0.66, 0.26]`, rotation y `Math.PI / 2`, scale `1.72`; small plant at `[0.16, 0, 0]`, scale `0.62`. | `left-side-table` |
| Right side table | `[1.82, 0.66, -2.62]` | `sideTableDrawers.glb` at `[-0.1, -0.66, -0.62]`, rotation y `-Math.PI / 2`, scale `1.72`; small plant at `[-0.16, 0, 0]`, scale `0.62`. | `right-side-table` |
| Back-left floor plant | `[-2.78, 0.55, -3.02]` | `pot_large.glb` plus bush/tall foliage layers. | `large-plant` |
| Left-window floor plant | `[-2.82, 0.5, 1.5]` | `pot_large.glb` plus bush/tall foliage layers. | `left-window-plant` |
| Floor lamp | `[3.05, 0.9, -3.05]` | `lampRoundFloor.glb` at `[-0.09, -0.9, 0.09]`, scale `1.82`; point light at `[0, 0.92, 0]`. | `floor-lamp` |
| Bookshelf | `[3.58, 1.59, -0.15]`, rotation y `-Math.PI / 2` | Procedural shelf frame, books, decor, and occasional `plantSmall1.glb`. | `bookshelf` |

## Side table origin and depth correction

`sideTableDrawers.glb` has model-space bounds `min=[-0.01, 0, -0.21]`, `max=[0.5245, 0.3844, 0.0123]`, and center `[0.2572, 0.1922, -0.0989]`. The origin is therefore close to one back/side edge rather than the visual center.

The current scene corrects that visually by using different local model positions after mirroring:

- Left side table: `[0.1, -0.66, 0.26]`, rotation y `Math.PI / 2`.
- Right side table: `[-0.1, -0.66, -0.62]`, rotation y `-Math.PI / 2`.

After applying the `1.72` scale and rotations, the visual centers land near `[-1.89, 0.33, -2.80]` and `[1.89, 0.33, -2.80]`, which keeps the table depth aligned with the sofa wall and the manual collision rectangles centered at z `-2.8`.

## Collision rectangle pairings

`SOLID_OBSTACLES` rectangles are manual x/z blockers used by `resolveBlockedMove`. They are paired with visual objects by id and expanded at runtime by `CAT_COLLISION_RADIUS=0.22`.

| Collision id | Center x/z | Half-size x/z | Visual pairing |
| --- | --- | --- | --- |
| `sofa` | `[0, -2.78]` | `[2.35, 0.42]` | Sofa group at `[0, 0.58, -2.78]`. |
| `left-side-table` | `[-1.82, -2.8]` | `[0.42, 0.46]` | Left side table group at `[-1.82, 0.66, -2.62]`; visual center is depth-corrected to about z `-2.80`. |
| `right-side-table` | `[1.82, -2.8]` | `[0.42, 0.46]` | Right side table group at `[1.82, 0.66, -2.62]`; visual center is depth-corrected to about z `-2.80`. |
| `coffee-table` | `[0, -1.58]` | `[0.78, 0.42]` | Coffee table group at `[0, 0.38, -1.55]`. |
| `large-plant` | `[-2.78, -3.05]` | `[0.52, 0.5]` | Back-left floor plant group at `[-2.78, 0.55, -3.02]`. |
| `floor-lamp` | `[3.05, -3.05]` | `[0.32, 0.32]` | Floor lamp group at `[3.05, 0.9, -3.05]`. |
| `bookshelf` | `[3.05, -0.25]` | `[0.45, 2.75]` | Right-wall built-in shelves. |
| `left-window-plant` | `[-2.82, 1.5]` | `[0.38, 0.38]` | Left-window floor plant group at `[-2.82, 0.5, 1.5]`. |

Destination objects add their `collisionHalfSize` rectangles to these furniture blockers at runtime. They are intentionally compact, and the shared cat collision radius expands them so the cat can touch each object without moving through its center. Keep both destination and furniture rectangles aligned with their visual objects whenever the room layout changes.
