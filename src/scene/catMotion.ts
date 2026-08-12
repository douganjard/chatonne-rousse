export type CatLocomotionState = {
  move: number;
  speed: number;
  turn: number;
};

export const CAT_MAX_FRAME_DELTA = 1 / 20;

export function clampCatFrameDelta(delta: number) {
  return Math.min(Math.max(delta, 0), CAT_MAX_FRAME_DELTA);
}

function damp(current: number, target: number, smoothing: number, delta: number) {
  return current + (target - current) * (1 - Math.exp(-smoothing * delta));
}

export function updateCatLocomotion(
  state: CatLocomotionState,
  targetMove: number,
  targetTurn: number,
  delta: number,
) {
  const frameDelta = clampCatFrameDelta(delta);
  state.turn = damp(state.turn, targetTurn, 8, frameDelta);
  state.move = damp(state.move, targetMove, 7, frameDelta);
  state.speed = damp(state.speed, Math.abs(targetMove), 7, frameDelta);
  return frameDelta;
}
