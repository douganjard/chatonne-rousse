export type CatPosturePhase = 'seated' | 'standingUp' | 'standing' | 'sittingDown';

export type CatPostureState = {
  phase: CatPosturePhase;
  phaseElapsed: number;
  inactivity: number;
  initialRisePending: boolean;
  sitAmount: number;
};

export const CAT_INITIAL_SEATED_SECONDS = 0.7;
export const CAT_IDLE_BEFORE_SITTING_SECONDS = 10;
export const CAT_SIT_DOWN_SECONDS = 0.72;
export const CAT_STAND_UP_SECONDS = 0.66;
export const CAT_MAX_POSTURE_STEP = 1 / 20;

export function getCatSitBlend(sitAmount: number) {
  const amount = Math.min(Math.max(sitAmount, 0), 1);
  return amount * amount * amount * (amount * (amount * 6 - 15) + 10);
}

export function getCatPostureRotation(
  base: readonly [number, number, number],
  offset: readonly [number, number, number],
  sitAmount: number,
): [number, number, number] {
  const blend = getCatSitBlend(sitAmount);
  return [
    base[0] + offset[0] * blend,
    base[1] + offset[1] * blend,
    base[2] + offset[2] * blend,
  ];
}

export function createCatPostureState(): CatPostureState {
  return {
    phase: 'seated',
    phaseElapsed: 0,
    inactivity: 0,
    initialRisePending: true,
    sitAmount: 1,
  };
}

export function isCatStanding(state: CatPostureState) {
  return state.phase === 'standing';
}

export function updateCatPosture(state: CatPostureState, delta: number, movementRequested: boolean) {
  const step = Math.min(Math.max(delta, 0), CAT_MAX_POSTURE_STEP);
  state.phaseElapsed += step;

  if (state.phase === 'seated') {
    const shouldRise = movementRequested || (state.initialRisePending && state.phaseElapsed >= CAT_INITIAL_SEATED_SECONDS);
    if (shouldRise) {
      state.phase = 'standingUp';
      state.phaseElapsed = 0;
      state.initialRisePending = false;
    }
    return;
  }

  if (state.phase === 'standingUp') {
    state.sitAmount = Math.max(0, state.sitAmount - step / CAT_STAND_UP_SECONDS);
    if (state.sitAmount === 0) {
      state.phase = 'standing';
      state.phaseElapsed = 0;
      state.inactivity = 0;
    }
    return;
  }

  if (state.phase === 'standing') {
    if (movementRequested) {
      state.inactivity = 0;
    } else {
      state.inactivity += step;
      if (state.inactivity >= CAT_IDLE_BEFORE_SITTING_SECONDS) {
        state.phase = 'sittingDown';
        state.phaseElapsed = 0;
      }
    }
    return;
  }

  if (movementRequested) {
    state.phase = 'standingUp';
    state.phaseElapsed = 0;
    state.inactivity = 0;
    return;
  }

  state.sitAmount = Math.min(1, state.sitAmount + step / CAT_SIT_DOWN_SECONDS);
  if (state.sitAmount === 1) {
    state.phase = 'seated';
    state.phaseElapsed = 0;
    state.inactivity = 0;
  }
}
