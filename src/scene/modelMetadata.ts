export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];

export type GlbBounds = {
  readonly min: Vec3;
  readonly max: Vec3;
  readonly size: Vec3;
  readonly center: Vec3;
};

export type ModelAssetMetadata = {
  readonly path: string;
  readonly status: 'used' | 'available-unused';
  readonly role: string;
  readonly unscaledBounds: GlbBounds;
  readonly notes?: readonly string[];
};

export const roomLayoutMetadata = {
  coordinateSystem: {
    axes: {
      x: 'Horizontal floor axis. Negative x is left/window side; positive x is right/bookshelf side.',
      y: 'Vertical axis. Floor plane is y=0.',
      z: 'Depth axis. Negative z moves toward the back wall/sofa; positive z moves toward the open/front edge.',
    },
    roomLimit: 3.2,
    floorSize: [7.4, 7.4] as Vec2,
    walls: {
      back: { position: [0, 1.75, -3.7] as Vec3, size: [7.4, 3.5, 0.16] as Vec3 },
      left: { position: [-3.7, 1.75, 0] as Vec3, size: [7.4, 3.5, 0.16] as Vec3, rotationY: 1.5708 },
      right: { position: [3.7, 1.75, 0] as Vec3, size: [7.4, 3.5, 0.16] as Vec3, rotationY: 1.5708 },
    },
    cat: {
      start: [0, 0.34, 0.45] as Vec3,
      collisionRadius: 0.22,
      selectionRadius: 0.58,
      modelLocalTransform: {
        position: [0, -0.31, 0] as Vec3,
        rotationY: 3.1416,
        scale: 0.0019,
      },
    },
  },
  portals: [
    { id: 'about', objectLabel: 'Framed portrait', position: [1.82, 0.82, -2.42] as Vec3, collisionHalfSize: [0.12, 0.08] as Vec2 },
    { id: 'chess', objectLabel: 'Chess board', position: [-1.55, 0.08, 2.05] as Vec3, collisionHalfSize: [0.3, 0.3] as Vec2 },
    { id: 'synth', objectLabel: 'MIDI keyboard', position: [1.55, 0.07, 1.55] as Vec3, collisionHalfSize: [0.32, 0.12] as Vec2 },
  ],
  furniturePlacements: [
    {
      id: 'sofa',
      groupPosition: [0, 0.58, -2.78] as Vec3,
      model: { path: '/models/kenney/loungeSofa.glb', position: [-1.543, -0.58, 0.36] as Vec3, scale: [3.15, 2.35, 2.05] as Vec3 },
      collisionRect: 'sofa',
    },
    {
      id: 'coffee-table',
      groupPosition: [0, 0.38, -1.55] as Vec3,
      model: { path: '/models/kenney/tableCoffee.glb', position: [0.1, -0.38, 0.1] as Vec3, scale: [2.25, 2.05, 2.15] as Vec3 },
      decor: [{ path: '/models/kenney/plantSmall1.glb', position: [0.48, -0.14, -0.08] as Vec3, rotationY: -0.28, scale: 0.54 }],
      collisionRect: 'coffee-table',
    },
    {
      id: 'left-side-table',
      groupPosition: [-1.82, 0.66, -2.62] as Vec3,
      model: { path: '/models/kenney/sideTableDrawers.glb', position: [0.1, -0.66, 0.26] as Vec3, rotationY: 1.5708, scale: 1.72 },
      decor: [{ path: '/models/kenney/plantSmall1.glb', position: [0.16, 0, 0] as Vec3, rotationY: 0.5, scale: 0.62 }],
      collisionRect: 'left-side-table',
      notes: ['The local z=0.26 offset is part of the current side-table visual-depth correction.'],
    },
    {
      id: 'right-side-table',
      groupPosition: [1.82, 0.66, -2.62] as Vec3,
      model: { path: '/models/kenney/sideTableDrawers.glb', position: [-0.1, -0.66, -0.62] as Vec3, rotationY: -1.5708, scale: 1.72 },
      decor: [{ path: '/models/kenney/plantSmall1.glb', position: [-0.16, 0, 0] as Vec3, rotationY: 0.5, scale: 0.62 }],
      collisionRect: 'right-side-table',
      notes: ['The local z=-0.62 offset is the mirrored visual-depth correction for the asset origin.'],
    },
    {
      id: 'large-plant',
      groupPosition: [-2.78, 0.55, -3.02] as Vec3,
      models: [
        { path: '/models/kenney/pot_large.glb', position: [0, -0.54, 0] as Vec3, scale: 2.2 },
        { path: '/models/kenney/plant_bushDetailed.glb', position: [-0.02, -0.02, 0.01] as Vec3, rotationY: 0.35, scale: 1.76 },
        { path: '/models/kenney/plant_flatTall.glb', position: [-0.12, 0.34, -0.02] as Vec3, rotationY: -0.65, scale: 2.08 },
        { path: '/models/kenney/plant_flatTall.glb', position: [0.28, 0.12, 0.08] as Vec3, rotationY: 1.05, scale: 1.54 },
      ],
      collisionRect: 'large-plant',
    },
    {
      id: 'left-window-plant',
      groupPosition: [-2.82, 0.5, 1.5] as Vec3,
      models: [
        { path: '/models/kenney/pot_large.glb', position: [0, -0.48, 0] as Vec3, scale: 1.82 },
        { path: '/models/kenney/plant_bushDetailed.glb', position: [0, -0.08, 0] as Vec3, rotationY: 0.45, scale: 1.22 },
        { path: '/models/kenney/plant_flatTall.glb', position: [0.12, 0.12, 0.02] as Vec3, rotationY: -0.9, scale: 1.0 },
      ],
      collisionRect: 'left-window-plant',
    },
    {
      id: 'floor-lamp',
      groupPosition: [3.05, 0.9, -3.05] as Vec3,
      model: { path: '/models/kenney/lampRoundFloor.glb', position: [-0.09, -0.9, 0.09] as Vec3, scale: 1.82 },
      light: { position: [0, 0.92, 0] as Vec3 },
      collisionRect: 'floor-lamp',
    },
    {
      id: 'bookshelf',
      groupPosition: [3.58, 1.59, -0.15] as Vec3,
      rotationY: -1.5708,
      collisionRect: 'bookshelf',
      notes: ['Procedural shelf geometry, not a GLB asset.'],
    },
  ],
  collisionRectangles: [
    { id: 'sofa', center: [0, -2.78] as Vec2, halfSize: [2.35, 0.42] as Vec2 },
    { id: 'left-side-table', center: [-1.82, -2.8] as Vec2, halfSize: [0.42, 0.46] as Vec2 },
    { id: 'right-side-table', center: [1.82, -2.8] as Vec2, halfSize: [0.42, 0.46] as Vec2 },
    { id: 'coffee-table', center: [0, -1.58] as Vec2, halfSize: [0.78, 0.42] as Vec2 },
    { id: 'large-plant', center: [-2.78, -3.05] as Vec2, halfSize: [0.52, 0.5] as Vec2 },
    { id: 'floor-lamp', center: [3.05, -3.05] as Vec2, halfSize: [0.32, 0.32] as Vec2 },
    { id: 'bookshelf', center: [3.05, -0.25] as Vec2, halfSize: [0.45, 2.75] as Vec2 },
    { id: 'left-window-plant', center: [-2.82, 1.5] as Vec2, halfSize: [0.38, 0.38] as Vec2 },
  ],
} as const;

export const modelAssetMetadata: readonly ModelAssetMetadata[] = [
  {
    path: '/models/toon_cat_free.glb',
    status: 'used',
    role: 'Animated player cat.',
    unscaledBounds: { min: [-89.7705, -337.0499, -370.0707], max: [89.7705, 239.4618, 0.5563], size: [179.5411, 576.5118, 370.627], center: [0, -48.794, -184.7572] },
    notes: ['Authored in much larger units than the room assets; DiscoveryScene renders it at scale 0.0019.'],
  },
  {
    path: '/models/kenney/loungeSofa.glb',
    status: 'used',
    role: 'Back-wall sofa.',
    unscaledBounds: { min: [0, 0, -0.41], max: [0.98, 0.46, 0], size: [0.98, 0.46, 0.41], center: [0.49, 0.23, -0.205] },
    notes: ['Origin is at the front-left/back-corner style asset edge, so placement uses a negative x model offset.'],
  },
  {
    path: '/models/kenney/sideTableDrawers.glb',
    status: 'used',
    role: 'Mirrored side tables.',
    unscaledBounds: { min: [-0.01, 0, -0.21], max: [0.5245, 0.3844, 0.0123], size: [0.5345, 0.3844, 0.2223], center: [0.2572, 0.1922, -0.0989] },
    notes: ['Origin is off-center: most of the mesh is at positive x and negative z.', 'The current side-table visual-depth correction is model position [0.1, -0.66, 0.26] on the left and [-0.1, -0.66, -0.62] on the right after mirroring.'],
  },
  {
    path: '/models/kenney/tableCoffee.glb',
    status: 'used',
    role: 'Coffee table.',
    unscaledBounds: { min: [-0.461, 0, -0.3], max: [0.2, 0.23, 0.1], size: [0.661, 0.23, 0.4], center: [-0.1305, 0.115, -0.1] },
    notes: ['Origin is not centered; model placement adds [0.1, -0.38, 0.1] inside the table group.'],
  },
  {
    path: '/models/kenney/lampRoundFloor.glb',
    status: 'used',
    role: 'Back-right floor lamp.',
    unscaledBounds: { min: [-0.016, 0, -0.1478], max: [0.136, 0.86, 0.0278], size: [0.152, 0.86, 0.1756], center: [0.06, 0.43, -0.06] },
  },
  {
    path: '/models/kenney/plantSmall1.glb',
    status: 'used',
    role: 'Small table and shelf plant.',
    unscaledBounds: { min: [-0.0473, 0, -0.0473], max: [0.0473, 0.14, 0.0473], size: [0.0947, 0.14, 0.0947], center: [0, 0.07, 0] },
  },
  {
    path: '/models/kenney/plant_bushDetailed.glb',
    status: 'used',
    role: 'Bush foliage layered into floor plants.',
    unscaledBounds: { min: [-0.3013, -0.05, -0.3013], max: [0.3013, 0.3104, 0.3013], size: [0.6025, 0.3604, 0.6025], center: [0, 0.1302, 0] },
    notes: ['Lower bound extends below y=0, so current placements sink it slightly into pots.'],
  },
  {
    path: '/models/kenney/plant_flatTall.glb',
    status: 'used',
    role: 'Tall foliage layered into floor plants.',
    unscaledBounds: { min: [-0.1358, -0.05, -0.1358], max: [0.1358, 0.2343, 0.1358], size: [0.2717, 0.2843, 0.2717], center: [0, 0.0922, 0] },
    notes: ['Lower bound extends below y=0, so current placements intentionally overlap pot geometry.'],
  },
  {
    path: '/models/kenney/pot_large.glb',
    status: 'used',
    role: 'Floor plant pot.',
    unscaledBounds: { min: [-0.2818, -0.05, -0.244], max: [0.2818, 0.15, 0.244], size: [0.5636, 0.2, 0.4881], center: [0, 0.05, 0] },
    notes: ['Lower bound extends below y=0; current placements use negative y offsets to seat pots on floor groups.'],
  },
  {
    path: '/models/kenney/rugRectangle.glb',
    status: 'available-unused',
    role: 'Unused Kenney rug asset; scene currently uses procedural rug geometry.',
    unscaledBounds: { min: [0, 0, -0.92], max: [1.57, 0.01, 0], size: [1.57, 0.01, 0.92], center: [0.785, 0.005, -0.46] },
    notes: ['Origin is at a rug corner rather than the visual center.'],
  },
  {
    path: '/models/kenney/pottedPlant.glb',
    status: 'available-unused',
    role: 'Unused combined potted plant; scene composes pots and foliage separately.',
    unscaledBounds: { min: [-0.106, 0, -0.1207], max: [0.106, 0.654, 0.1207], size: [0.2121, 0.654, 0.2415], center: [0, 0.327, 0] },
  },
] as const;
