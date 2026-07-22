export type MovementInput = {
  forward: boolean;
  left: boolean;
  right: boolean;
};

export function createMovementInput(): MovementInput {
  return {
    forward: false,
    left: false,
    right: false,
  };
}
