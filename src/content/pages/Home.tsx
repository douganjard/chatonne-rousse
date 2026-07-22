import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { MobileCameraControl } from '../../components/MobileCameraControl';
import { MobileControls } from '../../components/MobileControls';
import { NavOverlay } from '../../components/NavOverlay';
import { ReducedMotionFallback } from '../../components/ReducedMotionFallback';
import { navNodes, type NavNode } from '../../data/navNodes';
import { createMovementInput } from '../../scene/movementInput';
import type { CameraMode } from '../../scene/cameraMode';

const DiscoveryScene = lazy(() =>
  import('../../scene/DiscoveryScene').then((module) => ({ default: module.DiscoveryScene })),
);

export function Home() {
  const [activeId, setActiveId] = useState<NavNode['id'] | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>('follow');
  const [reducedMotion, setReducedMotion] = useState(false);
  const mobileInput = useRef(createMovementInput());

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
            cameraMode={cameraMode}
            mobileInput={mobileInput}
            nodes={navNodes}
            onSelect={setActiveId}
          />
          <MobileControls inputRef={mobileInput} />
          <MobileCameraControl mode={cameraMode} onChange={setCameraMode} />
        </Suspense>
      )}
      <NavOverlay activeId={activeId} nodes={navNodes} />
    </main>
  );
}
