export type ObstacleRect = {
  center: [number, number];
  halfSize: [number, number];
  id: string;
};

type XZPosition = {
  x: number;
  z: number;
};

export const ROOM_LIMIT = 3.2;
export const CAT_START: [number, number, number] = [0, 0.34, 0.45];

export const CAT_COLLISION_RADIUS = 0.24;
export const CAT_WALL_CLEARANCE = 0.12;
export const CAT_ROOM_LIMIT = ROOM_LIMIT - CAT_WALL_CLEARANCE;
export const SOLID_OBSTACLES: readonly ObstacleRect[] = [
  { id: 'sofa', center: [0, -2.78], halfSize: [2.35, 0.42] },
  { id: 'left-side-table', center: [-1.82, -2.8], halfSize: [0.42, 0.46] },
  { id: 'right-side-table', center: [1.82, -2.8], halfSize: [0.42, 0.46] },
  { id: 'coffee-table', center: [0, -1.3], halfSize: [0.78, 0.42] },
  { id: 'floor-lamp', center: [3.05, -3.05], halfSize: [0.32, 0.32] },
  { id: 'bookshelf', center: [3.5, -0.15], halfSize: [0.18, 2.92] },
  { id: 'left-window-plant', center: [-2.82, 1.5], halfSize: [0.55, 0.55] },
];

function intersectsObstacle(position: XZPosition, obstacle: ObstacleRect) {
  return (
    Math.abs(position.x - obstacle.center[0]) < obstacle.halfSize[0] + CAT_COLLISION_RADIUS &&
    Math.abs(position.z - obstacle.center[1]) < obstacle.halfSize[1] + CAT_COLLISION_RADIUS
  );
}

function isBlocked(position: XZPosition, additionalObstacles: readonly ObstacleRect[]) {
  return (
    SOLID_OBSTACLES.some((obstacle) => intersectsObstacle(position, obstacle)) ||
    additionalObstacles.some((obstacle) => intersectsObstacle(position, obstacle))
  );
}

export function resolveBlockedMove(
  current: XZPosition,
  proposed: XZPosition,
  additionalObstacles: readonly ObstacleRect[] = [],
) {
  if (!isBlocked(proposed, additionalObstacles)) return proposed;

  const xOnly = { x: proposed.x, z: current.z };
  if (!isBlocked(xOnly, additionalObstacles)) return xOnly;

  const zOnly = { x: current.x, z: proposed.z };
  if (!isBlocked(zOnly, additionalObstacles)) return zOnly;

  return current;
}
