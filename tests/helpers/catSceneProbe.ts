import { _roots, type RootState } from '@react-three/fiber';
import * as THREE from 'three';

const legChains = [
  ['legupperFL_014', 'leglowerFL_015', 'footFL_016'],
  ['legupperFR_024', 'leglowerFR_00', 'footFR_025'],
  ['thighBL_03', 'legupperBL_04', 'leglowerBL_05', 'footBL_06'],
  ['thighBR_026', 'legupperBR_027', 'leglowerBR_028', 'footBR_029'],
];

let state: RootState;
let render: THREE.WebGLRenderer['render'];

function bone(name: string) {
  const object = state.scene.getObjectByName(name);
  if (!object) throw new Error(`Missing cat bone: ${name}`);
  return object;
}

// Test-only coupling to Fiber's root registry; no instrumentation is shipped in the app.
export function ready() {
  const canvas = document.querySelector('canvas');
  if (!canvas) return false;
  const root = _roots.get(canvas);
  return Boolean(root?.store.getState().scene.getObjectByName('Object_43'));
}

export function start() {
  const canvas = document.querySelector('canvas');
  if (!canvas) throw new Error('Cat scene canvas is missing');
  const root = _roots.get(canvas);
  if (!root) throw new Error('Cat scene root is missing');
  state = root.store.getState();
  state.setFrameloop('never');
  render = state.gl.render;
  // Update animation and skinning each frame, but draw only the sampled states.
  state.gl.render = () => {};
}

export function advance(seconds: number) {
  for (let frame = 0; frame < Math.round(seconds * 60); frame += 1) {
    state.advance(state.clock.elapsedTime + 1 / 60, true);
  }
}

export function sample() {
  state.scene.updateMatrixWorld(true);
  const mesh = bone('Object_43');
  if (!(mesh instanceof THREE.SkinnedMesh)) throw new Error('Cat mesh must be skinned');
  mesh.skeleton.update();
  mesh.computeBoundingBox();
  const bounds = mesh.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
  const left = bone('footBL_06').getWorldQuaternion(new THREE.Quaternion());
  const right = bone('footBR_029').getWorldQuaternion(new THREE.Quaternion());
  const segments = legChains.flatMap(chain => {
    const points = chain.map(name => bone(name).getWorldPosition(new THREE.Vector3()));
    return points.slice(1).map((point, index) => point.clone().sub(points[index]).normalize().toArray());
  });
  render.call(state.gl, state.scene, state.camera);
  return {
    floorHeight: bounds.min.y,
    height: bounds.max.y - bounds.min.y,
    pawAngle: THREE.MathUtils.radToDeg(left.angleTo(right)),
    rearPawPitch: bone('footBR_029').rotation.x,
    segments,
  };
}

export function stop() {
  if (!state) return;
  state.gl.render = render;
  state.setFrameloop('always');
}
