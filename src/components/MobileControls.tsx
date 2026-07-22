import { useCallback, useEffect, useRef, useState, type MutableRefObject, type PointerEvent } from 'react';
import { ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import type { MovementInput } from '../scene/movementInput';

type MobileControlsProps = {
  inputRef: MutableRefObject<MovementInput>;
};

type MovementAction = keyof MovementInput;

const controls = [
  { action: 'left', label: 'Turn left', Icon: ArrowLeft },
  { action: 'forward', label: 'Move forward', Icon: ArrowUp },
  { action: 'right', label: 'Turn right', Icon: ArrowRight },
] satisfies Array<{ action: MovementAction; label: string; Icon: typeof ArrowLeft }>;

export function MobileControls({ inputRef }: MobileControlsProps) {
  const activePointers = useRef(new Map<number, MovementAction>());
  const [activeActions, setActiveActions] = useState<Set<MovementAction>>(() => new Set());

  const syncInput = useCallback(() => {
    const nextActions = new Set(activePointers.current.values());

    inputRef.current.forward = nextActions.has('forward');
    inputRef.current.left = nextActions.has('left');
    inputRef.current.right = nextActions.has('right');
    setActiveActions(nextActions);
  }, [inputRef]);

  const resetInput = useCallback(() => {
    activePointers.current.clear();
    inputRef.current.forward = false;
    inputRef.current.left = false;
    inputRef.current.right = false;
  }, [inputRef]);

  const clearInput = useCallback(() => {
    resetInput();
    setActiveActions(new Set());
  }, [resetInput]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') clearInput();
    };

    window.addEventListener('blur', clearInput);
    window.addEventListener('pagehide', clearInput);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', clearInput);
      window.removeEventListener('pagehide', clearInput);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      resetInput();
    };
  }, [clearInput, resetInput]);

  const press = (action: MovementAction, event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;

    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointer events used by browser tests do not own a native pointer.
    }
    activePointers.current.set(event.pointerId, action);
    syncInput();
  };

  const release = (event: PointerEvent<HTMLButtonElement>) => {
    activePointers.current.delete(event.pointerId);
    syncInput();
  };

  return (
    <div className="mobile-controls" role="group" aria-label="Cat movement controls">
      {controls.map(({ action, label, Icon }) => (
        <button
          key={action}
          type="button"
          className={`mobile-control${activeActions.has(action) ? ' is-active' : ''}`}
          aria-label={label}
          data-action={action}
          onContextMenu={(event) => event.preventDefault()}
          onPointerCancel={release}
          onPointerDown={(event) => press(action, event)}
          onPointerUp={release}
          onLostPointerCapture={release}
        >
          <Icon size={23} strokeWidth={2.2} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
