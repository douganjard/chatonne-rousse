import { Focus, Scan } from 'lucide-react';
import type { CameraMode } from '../scene/cameraMode';

type MobileCameraControlProps = {
  mode: CameraMode;
  onChange: (mode: CameraMode) => void;
};

export function MobileCameraControl({ mode, onChange }: MobileCameraControlProps) {
  const isFollowing = mode === 'follow';
  const Icon = isFollowing ? Scan : Focus;

  return (
    <button
      type="button"
      className={`mobile-camera-control${isFollowing ? ' is-active' : ''}`}
      aria-label="Follow cat with camera"
      aria-pressed={isFollowing}
      title={isFollowing ? 'Use overview camera' : 'Follow cat with camera'}
      onClick={() => onChange(isFollowing ? 'overview' : 'follow')}
    >
      <Icon size={20} strokeWidth={2.1} aria-hidden="true" />
    </button>
  );
}
