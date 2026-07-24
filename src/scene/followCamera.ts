import * as THREE from 'three';

const FOLLOW_CAMERA_POSITION = new THREE.Vector3(0, 4.9, 6.2);
const FOLLOW_CAMERA_FOV = 43;
const FLOOR_FRONT_EDGE = 3.7;
const FLOOR_SIDE_EDGE = 3.7;
const FLOOR_EDGE_INSET = 0.05;

export const FOLLOW_CAMERA_TARGET = new THREE.Vector3(0, 0.45, 0);
export const FOLLOW_CAMERA_BACKWARD = FOLLOW_CAMERA_POSITION
  .clone()
  .sub(FOLLOW_CAMERA_TARGET)
  .normalize();
export const FOLLOW_CAMERA_DISTANCE = FOLLOW_CAMERA_POSITION.distanceTo(
  FOLLOW_CAMERA_TARGET,
);

const cameraForward = FOLLOW_CAMERA_BACKWARD.clone().negate();
const cameraRight = cameraForward
  .clone()
  .cross(new THREE.Vector3(0, 1, 0))
  .normalize();
const cameraUp = cameraRight.clone().cross(cameraForward).normalize();
const verticalTangent = Math.tan(
  THREE.MathUtils.degToRad(FOLLOW_CAMERA_FOV / 2),
);

export function calculateFollowCameraFraming(aspect: number) {
  const horizontalTangent = verticalTangent * Math.max(aspect, 0.3);
  const bottomRayY = cameraForward.y - cameraUp.y * verticalTangent;
  const bottomRayZ = cameraForward.z - cameraUp.z * verticalTangent;
  const horizontalFloorSlope =
    Math.abs(cameraRight.x * horizontalTangent) / Math.abs(bottomRayY);
  const safeFloorHalfWidth = FLOOR_SIDE_EDGE - FLOOR_EDGE_INSET;
  const maximumCameraHeight =
    horizontalFloorSlope > 0
      ? safeFloorHalfWidth / horizontalFloorSlope
      : Number.POSITIVE_INFINITY;
  const maximumDistance =
    (maximumCameraHeight - FOLLOW_CAMERA_TARGET.y) /
    FOLLOW_CAMERA_BACKWARD.y;
  const distance = Math.min(FOLLOW_CAMERA_DISTANCE, maximumDistance);
  const cameraHeight =
    FOLLOW_CAMERA_TARGET.y + FOLLOW_CAMERA_BACKWARD.y * distance;
  const bottomFloorXOffset = cameraHeight * horizontalFloorSlope;
  const bottomFloorZOffset =
    FOLLOW_CAMERA_BACKWARD.z * distance -
    (cameraHeight * bottomRayZ) / bottomRayY;

  return {
    distance,
    maxTargetX: Math.max(0, safeFloorHalfWidth - bottomFloorXOffset),
    maxTargetZ: FLOOR_FRONT_EDGE - FLOOR_EDGE_INSET - bottomFloorZOffset,
  };
}
