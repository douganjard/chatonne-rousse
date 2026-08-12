import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { MobileControls } from '../../components/MobileControls';
import { NavOverlay } from '../../components/NavOverlay';
import { ReducedMotionFallback } from '../../components/ReducedMotionFallback';
import { navNodes, type NavNode } from '../../data/navNodes';
import {
  nextCatCoat,
  readCatCoat,
  writeCatCoat,
  type CatCoat,
} from '../../scene/catCoat';
import { createMovementInput } from '../../scene/movementInput';

const DiscoveryScene = lazy(() =>
  import('../../scene/DiscoveryScene').then((module) => ({ default: module.DiscoveryScene })),
);

function getLocalStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function Home() {
  const [activeId, setActiveId] = useState<NavNode['id'] | null>(null);
  const [catCoat, setCatCoat] = useState<CatCoat>(() =>
    readCatCoat(typeof window === 'undefined' ? null : getLocalStorage()),
  );
  const [reducedMotion, setReducedMotion] = useState(false);
  const mobileInput = useRef(createMovementInput());

  const toggleCatCoat = useCallback(() => {
    setCatCoat((current) => {
      const next = nextCatCoat(current);
      writeCatCoat(getLocalStorage(), next);
      return next;
    });
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(media.matches);

    updatePreference();
    media.addEventListener('change', updatePreference);

    return () => media.removeEventListener('change', updatePreference);
  }, []);

  return (
    <main className="home-page">
      {reducedMotion ? (
        <ReducedMotionFallback reason="reduced_motion" />
      ) : (
        <Suspense fallback={<ReducedMotionFallback reason="scene_loading" />}>
          <DiscoveryScene
            activeId={activeId}
            catCoat={catCoat}
            mobileInput={mobileInput}
            nodes={navNodes}
            onCatCoatToggle={toggleCatCoat}
            onSelect={setActiveId}
          />
          <MobileControls inputRef={mobileInput} />
        </Suspense>
      )}
      <NavOverlay activeId={activeId} nodes={navNodes} />
    </main>
  );
}
