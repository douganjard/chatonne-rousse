import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { RoundedBox, useAnimations, useGLTF } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef, type MutableRefObject, type PropsWithChildren } from 'react';
import * as THREE from 'three';
import type { NavNode } from '../data/navNodes';
import { trackEvent } from '../lib/telemetry';
import { SceneModel, TOON_CAT_URL } from './SceneModel';
import { CAT_START, ROOM_LIMIT, resolveBlockedMove } from './collisions';
import type { CameraMode } from './cameraMode';
import type { MovementInput } from './movementInput';
import {
  createFabricMaterial,
  createMetalMaterial,
  createWoodMaterial,
} from './materials';

type DiscoverySceneProps = {
  activeId: NavNode['id'] | null;
  cameraMode: CameraMode;
  mobileInput: MutableRefObject<MovementInput>;
  nodes: NavNode[];
  onSelect: (id: NavNode['id'] | null) => void;
};

type KeyState = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
};

type CatMotionState = {
  gaitPhase: number;
  move: number;
  speed: number;
  turn: number;
};

type CatBonePose = {
  object: THREE.Object3D;
  rotation: THREE.Euler;
};

type CatLegPose = CatBonePose & {
  lastOffset: THREE.Euler;
  phase: number;
  side: -1 | 1;
  stride: number;
};

type SparkleState = {
  duration: number;
  nextAt: number;
  rotation: number;
  size: number;
  startedAt: number;
  x: number;
  y: number;
  z: number;
};

type SparkleSettings = {
  center: [number, number, number];
  initialDelay: number;
  plane: 'floor' | 'wall';
  radius: number;
};

const CAT_LEG_BONES = [
  { name: 'leg.upper.F.L_014', phase: 0, side: -1, stride: 0.1 },
  { name: 'leg.lower.FL_015', phase: Math.PI * 0.16, side: -1, stride: -0.075 },
  { name: 'foot.F.L_016', phase: Math.PI * 0.34, side: -1, stride: 0.045 },
  { name: 'leg.upper.F.R_024', phase: Math.PI, side: 1, stride: 0.1 },
  { name: 'leg.lower.F.R_00', phase: Math.PI * 1.16, side: 1, stride: -0.075 },
  { name: 'foot.F.R_025', phase: Math.PI * 1.34, side: 1, stride: 0.045 },
  { name: 'leg.upper.B.L_04', phase: Math.PI, side: -1, stride: 0.085 },
  { name: 'leg.lower.B.L_05', phase: Math.PI * 1.18, side: -1, stride: -0.07 },
  { name: 'foot.B.L_06', phase: Math.PI * 1.36, side: -1, stride: 0.04 },
  { name: 'leg.upper.B.R_027', phase: 0, side: 1, stride: 0.085 },
  { name: 'leg.lower.B.R_028', phase: Math.PI * 0.18, side: 1, stride: -0.07 },
  { name: 'foot.B.R_029', phase: Math.PI * 0.36, side: 1, stride: 0.04 },
] satisfies Array<{ name: string; phase: number; side: -1 | 1; stride: number }>;

const DESTINATION_SPARKLE_SETTINGS = {
  about: { center: [0, 0.04, 0.04], initialDelay: 1.2, plane: 'wall', radius: 0.12 },
  chess: { center: [0, 0.13, 0], initialDelay: 3.7, plane: 'floor', radius: 0.2 },
  synth: { center: [0, 0.14, 0], initialDelay: 4.8, plane: 'floor', radius: 0.18 },
} satisfies Record<NavNode['id'], SparkleSettings>;

const OVERVIEW_TARGET = new THREE.Vector3(0, 0.45, 0);
const BASE_CAMERA_POSITION = new THREE.Vector3(0, 4.9, 6.2);
const CAMERA_BACKWARD = BASE_CAMERA_POSITION.clone().sub(OVERVIEW_TARGET).normalize();
const CAMERA_FORWARD = CAMERA_BACKWARD.clone().negate();
const CAMERA_RIGHT = CAMERA_FORWARD.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
const CAMERA_UP = CAMERA_RIGHT.clone().cross(CAMERA_FORWARD).normalize();
const BASE_CAMERA_DISTANCE = BASE_CAMERA_POSITION.distanceTo(OVERVIEW_TARGET);
const ROOM_FRAME_MARGIN = 1.06;
const ROOM_FRAME_POINTS = [-3.7, 3.7].flatMap((x) =>
  [0, 3.5].flatMap((y) => [-3.7, 3.7].map((z) => new THREE.Vector3(x, y, z))),
);

function calculateOverviewDistance(aspect: number) {
  if (aspect >= 1) return BASE_CAMERA_DISTANCE;

  const verticalTangent = Math.tan(THREE.MathUtils.degToRad(43 / 2));
  const horizontalTangent = verticalTangent * Math.max(aspect, 0.3);

  return ROOM_FRAME_POINTS.reduce((requiredDistance, point) => {
    const relativeX = point.x - OVERVIEW_TARGET.x;
    const relativeY = point.y - OVERVIEW_TARGET.y;
    const relativeZ = point.z - OVERVIEW_TARGET.z;
    const cameraX = relativeX * CAMERA_RIGHT.x + relativeY * CAMERA_RIGHT.y + relativeZ * CAMERA_RIGHT.z;
    const cameraY = relativeX * CAMERA_UP.x + relativeY * CAMERA_UP.y + relativeZ * CAMERA_UP.z;
    const cameraDepth =
      relativeX * CAMERA_FORWARD.x + relativeY * CAMERA_FORWARD.y + relativeZ * CAMERA_FORWARD.z;
    const horizontalDistance = (Math.abs(cameraX) * ROOM_FRAME_MARGIN) / horizontalTangent - cameraDepth;
    const verticalDistance = (Math.abs(cameraY) * ROOM_FRAME_MARGIN) / verticalTangent - cameraDepth;

    return Math.max(requiredDistance, horizontalDistance, verticalDistance);
  }, BASE_CAMERA_DISTANCE);
}

function applyDeadZone(value: number, radius: number) {
  if (Math.abs(value) <= radius) return 0;
  return Math.sign(value) * (Math.abs(value) - radius);
}

export function DiscoveryScene({ activeId, cameraMode, mobileInput, nodes, onSelect }: DiscoverySceneProps) {
  const catPosition = useRef(new THREE.Vector3(...CAT_START));

  return (
    <div className="scene-wrap" data-camera-mode={cameraMode} aria-label="Interactive room navigation">
      <Canvas
        camera={{ position: [0, 4.9, 6.2], fov: 43 }}
        dpr={[1, 1.75]}
        onCreated={() => trackEvent('scene_loaded')}
        onError={() => trackEvent('webgl_failed')}
        shadows
      >
        <Suspense fallback={null}>
          <color attach="background" args={[cameraMode === 'overview' ? '#000000' : '#d9b892']} />
          <ambientLight intensity={0.58} />
          <hemisphereLight args={['#f2deb3', '#243028', 0.42]} />
          <directionalLight
            castShadow
            color="#f4d7a1"
            intensity={2.15}
            position={[-3.2, 5.6, 2.8]}
            shadow-mapSize={[1024, 1024]}
          />
          <pointLight color="#ffae66" intensity={2.2} distance={5.7} position={[-3.15, 2.05, -0.15]} />
          <pointLight color="#ffca8a" intensity={1.4} distance={3.8} position={[3.05, 1.72, -3.0]} />
          <CameraRig catPosition={catPosition} mode={cameraMode} />
          <Room />
          <Furniture />
          {nodes.map((node) => (
            <DestinationObject key={node.id} activeId={activeId} node={node} />
          ))}
          <CatController catPosition={catPosition} mobileInput={mobileInput} nodes={nodes} onSelect={onSelect} />
        </Suspense>
      </Canvas>
    </div>
  );
}

function StaticGroup({
  children,
  position,
}: PropsWithChildren<{ position?: [number, number, number] }>) {
  return <group position={position}>{children}</group>;
}

function CameraRig({ catPosition, mode }: { catPosition: MutableRefObject<THREE.Vector3>; mode: CameraMode }) {
  const { size } = useThree();
  const initialized = useRef(false);
  const lastAspect = useRef(0);
  const overviewDistance = useRef(BASE_CAMERA_DISTANCE);
  const currentDistance = useRef(BASE_CAMERA_DISTANCE);
  const currentTarget = useRef(OVERVIEW_TARGET.clone());
  const desiredTarget = useRef(OVERVIEW_TARGET.clone());

  useFrame(({ camera }, delta) => {
    const aspect = size.width / Math.max(size.height, 1);
    if (Math.abs(aspect - lastAspect.current) > 0.001) {
      lastAspect.current = aspect;
      overviewDistance.current = calculateOverviewDistance(aspect);
    }

    desiredTarget.current.copy(OVERVIEW_TARGET);
    let desiredDistance = overviewDistance.current;

    if (mode === 'follow') {
      const horizontalPan = THREE.MathUtils.clamp(applyDeadZone(catPosition.current.x, 0.3) * 0.95, -2.65, 2.65);
      const depthPan = THREE.MathUtils.clamp(applyDeadZone(catPosition.current.z, 0.5) * 0.62, -1.85, 1.85);
      desiredTarget.current.x += horizontalPan;
      desiredTarget.current.z += depthPan;
      desiredDistance = BASE_CAMERA_DISTANCE;
    }

    if (!initialized.current) {
      initialized.current = true;
      currentTarget.current.copy(desiredTarget.current);
      currentDistance.current = desiredDistance;
    } else {
      const cameraDamping = mode === 'follow' ? 7 : 3.2;
      currentTarget.current.x = THREE.MathUtils.damp(currentTarget.current.x, desiredTarget.current.x, cameraDamping, delta);
      currentTarget.current.y = THREE.MathUtils.damp(currentTarget.current.y, desiredTarget.current.y, cameraDamping, delta);
      currentTarget.current.z = THREE.MathUtils.damp(currentTarget.current.z, desiredTarget.current.z, cameraDamping, delta);
      currentDistance.current = THREE.MathUtils.damp(currentDistance.current, desiredDistance, cameraDamping, delta);
    }

    camera.position.copy(currentTarget.current).addScaledVector(CAMERA_BACKWARD, currentDistance.current);
    camera.lookAt(currentTarget.current);
  });

  return null;
}

function Room() {
  const floorMaterial = useMemo(() => createWoodMaterial('floor'), []);

  return (
    <group>
      <StaticGroup>
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[7.4, 7.4]} />
          <primitive attach="material" object={floorMaterial} />
        </mesh>
      </StaticGroup>
      <StaticGroup>
        <mesh receiveShadow position={[0, 1.75, -3.7]}>
          <boxGeometry args={[7.4, 3.5, 0.16]} />
          <meshStandardMaterial color="#2f3a32" roughness={0.94} />
        </mesh>
      </StaticGroup>
      <StaticGroup>
        <mesh receiveShadow position={[-3.7, 1.75, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[7.4, 3.5, 0.16]} />
          <meshStandardMaterial color="#242e29" roughness={0.94} />
        </mesh>
      </StaticGroup>
      <StaticGroup>
        <mesh receiveShadow position={[3.7, 1.75, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[7.4, 3.5, 0.16]} />
          <meshStandardMaterial color="#38453b" roughness={0.94} />
        </mesh>
      </StaticGroup>
      <Rug />
      <Baseboards />
      <BuiltInShelves />
      <Window />
    </group>
  );
}

function Rug() {
  const width = 4.45;
  const depth = 3.05;
  const stripeCount = 13;
  const rugMaterial = useMemo(() => createFabricMaterial('rug'), []);

  return (
    <group position={[0, 0.021, 0.38]}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <primitive attach="material" object={rugMaterial} />
      </mesh>
      {Array.from({ length: stripeCount }, (_, index) => {
        const x = -width / 2 + 0.34 + index * ((width - 0.68) / (stripeCount - 1));
        return (
          <mesh key={x} position={[x, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.028, depth - 0.44]} />
            <meshStandardMaterial color={index % 2 ? '#eee3ce' : '#bfb49f'} roughness={1} transparent opacity={0.28} />
          </mesh>
        );
      })}
      {[-1, 1].map((z) => (
        <mesh key={`border-${z}`} position={[0, 0.002, z * (depth / 2 - 0.28)]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
          <planeGeometry args={[0.035, width - 0.44]} />
          <meshStandardMaterial color="#f0e5d0" roughness={0.98} />
        </mesh>
      ))}
      {[-1, 1].map((x) => (
        <mesh key={`side-border-${x}`} position={[x * (width / 2 - 0.24), 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.035, depth - 0.5]} />
          <meshStandardMaterial color="#b8ad98" roughness={0.98} transparent opacity={0.3} />
        </mesh>
      ))}
      {[-depth / 2 - 0.1, depth / 2 + 0.1].map((z) =>
        Array.from({ length: 20 }, (_, index) => {
          const x = -width / 2 + 0.2 + index * ((width - 0.4) / 19);
          return (
            <mesh key={`${z}-${x}`} position={[x, 0.002, z]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.016, 0.14]} />
              <meshStandardMaterial color="#f3ead8" roughness={1} />
            </mesh>
          );
        }),
      )}
    </group>
  );
}

function Baseboards() {
  const trimMaterial = useMemo(() => createWoodMaterial('trim'), []);

  return (
    <group>
      <mesh position={[0, 0.18, -3.58]}>
        <boxGeometry args={[7.15, 0.16, 0.08]} />
        <primitive attach="material" object={trimMaterial} />
      </mesh>
      <mesh position={[-3.58, 0.18, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[7.15, 0.16, 0.08]} />
        <primitive attach="material" object={trimMaterial} />
      </mesh>
      <mesh position={[3.58, 0.18, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[7.15, 0.16, 0.08]} />
        <primitive attach="material" object={trimMaterial} />
      </mesh>
    </group>
  );
}

function BuiltInShelves() {
  const shelfRows = [-1.12, -0.48, 0.16, 0.8, 1.4];
  const shelfColumns = [-2.48, -1.56, -0.62, 0.34, 1.28, 2.22];
  const shelfMaterial = useMemo(() => createWoodMaterial('shelf'), []);

  return (
    <StaticGroup>
      <group position={[3.58, 1.59, -0.15]} rotation={[0, -Math.PI / 2, 0]}>
        <RoundedBox castShadow receiveShadow args={[5.85, 3.18, 0.22]} radius={0.025}>
          <primitive attach="material" object={shelfMaterial} />
        </RoundedBox>
        <mesh position={[0, 0, 0.13]}>
          <boxGeometry args={[5.58, 2.92, 0.06]} />
          <primitive attach="material" object={shelfMaterial} />
        </mesh>
        {[-2.2, -1.1, 0, 1.1, 2.2].map((x) => (
          <mesh key={x} position={[x, 0, 0.14]}>
            <boxGeometry args={[0.06, 2.96, 0.1]} />
            <primitive attach="material" object={shelfMaterial} />
          </mesh>
        ))}
        {[-1.18, -0.54, 0.1, 0.74, 1.34].map((y) => (
          <mesh key={y} position={[0, y, 0.15]}>
            <boxGeometry args={[5.52, 0.055, 0.1]} />
            <primitive attach="material" object={shelfMaterial} />
          </mesh>
        ))}
        {shelfRows.flatMap((y, row) =>
          shelfColumns.map((x, column) => (
            <ShelfCell key={`${row}-${column}`} position={[x, y, 0.22]} seed={row * 7 + column} />
          )),
        )}
      </group>
    </StaticGroup>
  );
}

function ShelfCell({ position, seed }: { position: [number, number, number]; seed: number }) {
  const colors = ['#d0b88d', '#1f2522', '#b99468', '#f4dfbd', '#7b4a28', '#46563d'];
  const pattern = seed % 5;

  return (
    <group position={position}>
      <ShelfBooks count={6 + (seed % 5)} position={[-0.32, 0, 0]} seed={seed} />
      {pattern !== 1 && <BookStack colors={[colors[seed % colors.length], colors[(seed + 2) % colors.length], colors[(seed + 4) % colors.length]]} position={[0.18, 0, 0]} />}
      {pattern === 1 && <ShelfDecor position={[0.22, 0, 0.01]} />}
      {pattern === 3 && <SceneModel color="#496c48" position={[0.28, 0, 0]} scale={0.52} url="/models/kenney/plantSmall1.glb" />}
    </group>
  );
}

function ShelfBooks({ count, position, seed }: { count: number; position: [number, number, number]; seed: number }) {
  const colors = ['#1f2522', '#b99468', '#d0b88d', '#7b4a28', '#46563d', '#f4dfbd'];

  return (
    <group position={position}>
      {Array.from({ length: count }, (_, index) => {
        const height = 0.22 + ((seed + index) % 5) * 0.038;
        const width = 0.04 + ((seed + index) % 3) * 0.01;
        return (
          <mesh key={`${seed}-${index}`} position={[index * 0.057, height / 2, 0]} rotation={[0, 0, ((seed + index) % 3 - 1) * 0.035]}>
            <boxGeometry args={[width, height, 0.1]} />
            <meshStandardMaterial color={colors[(seed + index) % colors.length]} roughness={0.78} />
          </mesh>
        );
      })}
    </group>
  );
}

function BookStack({ position, colors }: { position: [number, number, number]; colors: string[] }) {
  return (
    <group position={position}>
      {colors.map((color, index) => (
        <mesh key={`${color}-${index}`} position={[0, 0.015 + index * 0.035, 0]} rotation={[0, 0, index % 2 ? 0.02 : -0.015]}>
          <boxGeometry args={[0.42 - index * 0.04, 0.03, 0.11]} />
          <meshStandardMaterial color={color} roughness={0.78} />
        </mesh>
      ))}
    </group>
  );
}

function ShelfDecor({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.16, 18]} />
        <meshStandardMaterial color="#d0b88d" roughness={0.82} />
      </mesh>
      <mesh castShadow position={[0.2, 0.09, 0]} rotation={[0, 0, 0.2]}>
        <boxGeometry args={[0.12, 0.18, 0.06]} />
        <meshStandardMaterial color="#3f4a41" roughness={0.8} />
      </mesh>
    </group>
  );
}

function Window() {
  const trimMaterial = useMemo(() => createWoodMaterial('trim'), []);

  return (
    <group position={[-3.58, 1.82, -0.1]} rotation={[0, Math.PI / 2, 0]}>
      <mesh>
        <boxGeometry args={[5.55, 2.55, 0.05]} />
        <meshStandardMaterial color="#f0a064" emissive="#d96f38" emissiveIntensity={0.42} roughness={0.24} />
      </mesh>
      <mesh position={[0, 0.1, 0.075]}>
        <planeGeometry args={[5.25, 2.2]} />
        <meshStandardMaterial color="#ffd19a" emissive="#ff8d4a" emissiveIntensity={0.55} transparent opacity={0.58} roughness={0.18} />
      </mesh>
      <mesh position={[-1.35, 0.42, 0.09]} rotation={[0, 0, -0.14]}>
        <planeGeometry args={[1.15, 1.4]} />
        <meshStandardMaterial color="#ffe2b7" transparent opacity={0.24} roughness={0.2} />
      </mesh>
      {[-2.72, 2.72].map((x) => (
        <mesh key={x} position={[x, 0, 0.11]}>
          <boxGeometry args={[0.16, 2.75, 0.06]} />
          <primitive attach="material" object={trimMaterial} />
        </mesh>
      ))}
      {[-1.38, 0, 1.38].map((x) => (
        <mesh key={x} position={[x, 0, 0.12]}>
          <boxGeometry args={[0.08, 2.52, 0.08]} />
          <primitive attach="material" object={trimMaterial} />
        </mesh>
      ))}
      {[-1.22, 0, 1.22].map((y) => (
        <mesh key={y} position={[0, y, 0.12]}>
          <boxGeometry args={[5.55, 0.08, 0.08]} />
          <primitive attach="material" object={trimMaterial} />
        </mesh>
      ))}
      <mesh position={[0, -1.36, 0.13]}>
        <boxGeometry args={[5.72, 0.14, 0.26]} />
        <primitive attach="material" object={trimMaterial} />
      </mesh>
    </group>
  );
}

function Furniture() {
  const tableMaterial = useMemo(() => createWoodMaterial('furniture'), []);

  return (
    <group>
      <Sofa />
      <StaticGroup>
        <group position={[0, 0.38, -1.55]}>
          <SceneModel material={tableMaterial} position={[0.1, -0.38, 0.1]} scale={[2.25, 2.05, 2.15]} url="/models/kenney/tableCoffee.glb" />
          <SceneModel color="#3f5f43" position={[0.48, -0.14, -0.08]} rotation={[0, -0.28, 0]} scale={0.54} url="/models/kenney/plantSmall1.glb" />
        </group>
      </StaticGroup>

      <StaticGroup>
        <SideTable position={[-1.82, 0.66, -2.62]} rotation={Math.PI / 2} />
      </StaticGroup>
      <StaticGroup>
        <SideTable position={[1.82, 0.66, -2.62]} rotation={-Math.PI / 2} />
      </StaticGroup>
      <Plant />
      <LargeFloorPlant position={[-2.82, 0.5, 1.5]} variant="bush" />
      <FloorLamp />
    </group>
  );
}

function SideTable({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  const tableMaterial = useMemo(() => createWoodMaterial('furniture'), []);
  const modelPosition: [number, number, number] = rotation > 0 ? [0.1, -0.66, 0.26] : [-0.1, -0.66, -0.62];

  return (
    <group position={position}>
      <SceneModel material={tableMaterial} position={modelPosition} rotation={[0, rotation, 0]} scale={1.72} url="/models/kenney/sideTableDrawers.glb" />
      <SceneModel color="#3f5f43" position={[0.16 * Math.sign(rotation), 0, 0.0]} rotation={[0, 0.5, 0]} scale={0.62} url="/models/kenney/plantSmall1.glb" />
    </group>
  );
}

function Sofa() {
  const sofaMaterial = useMemo(() => createFabricMaterial('sofa'), []);
  const greenPillowMaterial = useMemo(() => createFabricMaterial('pillow-green'), []);
  const lightPillowMaterial = useMemo(() => createFabricMaterial('pillow-light'), []);

  return (
    <StaticGroup>
      <group position={[0, 0.58, -2.78]}>
        <SceneModel material={sofaMaterial} position={[-1.543, -0.58, 0.36]} scale={[3.15, 2.35, 2.05]} url="/models/kenney/loungeSofa.glb" />
        {[-0.72, 0.02, 0.76].map((x, index) => (
          <RoundedBox key={x} castShadow args={[0.46, 0.34, 0.16]} radius={0.08} position={[x, 0.22, -0.08]} rotation={[-0.4, 0, index === 1 ? 0 : x > 0 ? -0.04 : 0.04]}>
            <primitive attach="material" object={index === 1 ? lightPillowMaterial : greenPillowMaterial} />
          </RoundedBox>
        ))}
      </group>
    </StaticGroup>
  );
}

function Plant() {
  return (
    <StaticGroup>
      <group position={[-2.78, 0.55, -3.02]}>
        <SceneModel color="#7a4d32" position={[0, -0.54, 0]} scale={2.2} url="/models/kenney/pot_large.glb" />
        <SceneModel color="#78a96b" emissive="#2b4d28" emissiveIntensity={0.16} position={[-0.02, -0.02, 0.01]} rotation={[0, 0.35, 0]} scale={1.76} url="/models/kenney/plant_bushDetailed.glb" />
        <SceneModel color="#8fbd79" emissive="#304f2c" emissiveIntensity={0.18} position={[-0.12, 0.34, -0.02]} rotation={[0, -0.65, 0]} scale={2.08} url="/models/kenney/plant_flatTall.glb" />
        <SceneModel color="#6fa765" emissive="#264825" emissiveIntensity={0.16} position={[0.28, 0.12, 0.08]} rotation={[0, 1.05, 0]} scale={1.54} url="/models/kenney/plant_flatTall.glb" />
      </group>
    </StaticGroup>
  );
}

function LargeFloorPlant({ position, variant }: { position: [number, number, number]; variant: 'bush' | 'flat' }) {
  return (
    <StaticGroup>
      <group position={position}>
        <SceneModel color="#7a4d32" position={[0, -0.48, 0]} scale={1.82} url="/models/kenney/pot_large.glb" />
        {variant === 'bush' ? (
          <>
            <SceneModel color="#78a96b" emissive="#2b4d28" emissiveIntensity={0.16} position={[0, -0.08, 0]} rotation={[0, 0.45, 0]} scale={1.22} url="/models/kenney/plant_bushDetailed.glb" />
            <SceneModel color="#8fbd79" emissive="#304f2c" emissiveIntensity={0.18} position={[0.12, 0.12, 0.02]} rotation={[0, -0.9, 0]} scale={1.0} url="/models/kenney/plant_flatTall.glb" />
          </>
        ) : (
          <>
            <SceneModel color="#8fbd79" emissive="#304f2c" emissiveIntensity={0.18} position={[0, 0.08, 0]} rotation={[0, -0.3, 0]} scale={1.48} url="/models/kenney/plant_flatTall.glb" />
            <SceneModel color="#78a96b" emissive="#2b4d28" emissiveIntensity={0.16} position={[0.1, -0.12, 0.05]} rotation={[0, 0.8, 0]} scale={0.92} url="/models/kenney/plant_bushDetailed.glb" />
          </>
        )}
      </group>
    </StaticGroup>
  );
}

function FloorLamp() {
  const lampMaterial = useMemo(() => createMetalMaterial('lamp'), []);

  return (
    <StaticGroup>
      <group position={[3.05, 0.9, -3.05]}>
        <SceneModel material={lampMaterial} position={[-0.09, -0.9, 0.09]} scale={1.82} url="/models/kenney/lampRoundFloor.glb" />
        <pointLight color="#ffce8a" intensity={1.25} distance={4.2} position={[0, 0.92, 0]} />
      </group>
    </StaticGroup>
  );
}

type DestinationObjectProps = {
  activeId: NavNode['id'] | null;
  node: NavNode;
};

function DestinationObject({ activeId, node }: DestinationObjectProps) {
  const isActive = activeId === node.id;
  const sparkle = DESTINATION_SPARKLE_SETTINGS[node.id];

  return (
    <StaticGroup position={node.position}>
      <group>
        {node.id === 'about' && <FramedPortrait active={isActive} />}
        {node.id === 'chess' && <ChessBoard color={node.accent} active={isActive} />}
        {node.id === 'synth' && <MidiKeyboard color={node.accent} active={isActive} />}
        <InteractiveSparkle
          active={isActive}
          center={sparkle.center}
          initialDelay={sparkle.initialDelay}
          plane={sparkle.plane}
          radius={sparkle.radius}
        />
      </group>
    </StaticGroup>
  );
}

function InteractiveSparkle({
  active,
  center,
  initialDelay,
  plane,
  radius,
}: {
  active: boolean;
  center: [number, number, number];
  initialDelay: number;
  plane: 'floor' | 'wall';
  radius: number;
}) {
  const billboard = useRef<THREE.Group>(null);
  const glint = useRef<THREE.Group>(null);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        blending: THREE.AdditiveBlending,
        color: '#fff1c7',
        depthTest: false,
        depthWrite: false,
        opacity: 0,
        toneMapped: false,
        transparent: true,
      }),
    [],
  );
  const sparkle = useRef<SparkleState>({
    duration: 0.78,
    nextAt: initialDelay,
    rotation: 0,
    size: 1,
    startedAt: -Infinity,
    x: center[0],
    y: center[1],
    z: center[2],
  });

  useEffect(() => {
    return () => material.dispose();
  }, [material]);

  useFrame(({ camera, clock }) => {
    const state = sparkle.current;
    const elapsed = clock.elapsedTime;

    if (elapsed >= state.nextAt) {
      const angle = Math.random() * Math.PI * 2;
      const distance = radius * (0.35 + Math.random() * 0.65);

      state.duration = 0.64 + Math.random() * 0.3;
      state.rotation = Math.random() * Math.PI;
      state.size = 0.74 + Math.random() * 0.34;
      state.startedAt = elapsed;

      if (plane === 'wall') {
        state.x = center[0] + Math.cos(angle) * distance;
        state.y = center[1] + Math.sin(angle) * distance * 0.82;
        state.z = center[2] + (Math.random() - 0.5) * 0.03;
      } else {
        state.x = center[0] + Math.cos(angle) * distance;
        state.y = center[1] + (Math.random() - 0.5) * 0.07;
        state.z = center[2] + Math.sin(angle) * distance;
      }

      state.nextAt = elapsed + state.duration + (active ? 1.6 + Math.random() * 2.1 : 4.2 + Math.random() * 4.4);
    }

    const progress = THREE.MathUtils.clamp((elapsed - state.startedAt) / state.duration, 0, 1);
    const pulse = Math.sin(progress * Math.PI);
    const opacity = Math.pow(pulse, 1.7) * (active ? 0.52 : 0.38);

    material.opacity = opacity;

    if (billboard.current) {
      billboard.current.visible = opacity > 0.01;
      billboard.current.position.set(state.x, state.y, state.z);
      billboard.current.quaternion.copy(camera.quaternion);
    }

    if (glint.current) {
      const scale = state.size * (0.68 + progress * 0.46);
      glint.current.rotation.z = state.rotation + progress * 0.82;
      glint.current.scale.setScalar(scale);
    }
  });

  return (
    <group ref={billboard} visible={false}>
      <group ref={glint}>
        <mesh>
          <planeGeometry args={[0.014, 0.17]} />
          <primitive attach="material" object={material} />
        </mesh>
        <mesh>
          <planeGeometry args={[0.17, 0.014]} />
          <primitive attach="material" object={material} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <planeGeometry args={[0.009, 0.11]} />
          <primitive attach="material" object={material} />
        </mesh>
        <mesh rotation={[0, 0, -Math.PI / 4]}>
          <planeGeometry args={[0.009, 0.11]} />
          <primitive attach="material" object={material} />
        </mesh>
      </group>
    </group>
  );
}

function FramedPortrait({ active }: { active: boolean }) {
  const portrait = useLoader(THREE.TextureLoader, '/images/about-portrait.png');
  const frameMaterial = useMemo(() => createWoodMaterial('trim'), []);

  useEffect(() => {
    portrait.colorSpace = THREE.SRGBColorSpace;
    portrait.needsUpdate = true;
  }, [portrait]);

  return (
    <group rotation={[-0.12, 0, 0]} scale={active ? 0.32 : 0.3}>
      <mesh castShadow receiveShadow position={[0, 0, -0.018]}>
        <boxGeometry args={[0.82, 0.98, 0.035]} />
        <meshStandardMaterial color="#f2dfbd" roughness={0.84} />
      </mesh>
      <mesh position={[0, 0.08, 0.012]}>
        <planeGeometry args={[0.58, 0.58]} />
        <meshStandardMaterial map={portrait} roughness={0.58} />
      </mesh>
      <mesh position={[0, -0.33, 0.018]}>
        <boxGeometry args={[0.3, 0.035, 0.018]} />
        <meshStandardMaterial color="#b99468" metalness={0.42} roughness={0.46} />
      </mesh>
      <mesh castShadow position={[-0.43, 0, 0.02]}>
        <boxGeometry args={[0.085, 1.04, 0.075]} />
        <primitive attach="material" object={frameMaterial} />
      </mesh>
      <mesh castShadow position={[0.43, 0, 0.02]}>
        <boxGeometry args={[0.085, 1.04, 0.075]} />
        <primitive attach="material" object={frameMaterial} />
      </mesh>
      <mesh castShadow position={[0, 0.52, 0.02]}>
        <boxGeometry args={[0.86, 0.085, 0.075]} />
        <primitive attach="material" object={frameMaterial} />
      </mesh>
      <mesh castShadow position={[0, -0.52, 0.02]}>
        <boxGeometry args={[0.86, 0.085, 0.075]} />
        <primitive attach="material" object={frameMaterial} />
      </mesh>
      <mesh position={[0, 0.08, 0.018]}>
        <planeGeometry args={[0.6, 0.6]} />
        <meshStandardMaterial color="#fffaf0" opacity={0.08} transparent roughness={0.12} />
      </mesh>
    </group>
  );
}

function ChessBoard({ active, color }: { active: boolean; color: string }) {
  const squareSize = 0.068;
  const boardOffset = (squareSize * 7) / 2;
  const pieces = [
    [-0.205, -0.205, '#f5ecd4', 0.064],
    [-0.068, -0.205, '#f5ecd4', 0.05],
    [0.068, -0.205, '#f5ecd4', 0.05],
    [0.205, -0.205, '#f5ecd4', 0.064],
    [-0.205, 0.205, '#2b2a25', 0.064],
    [-0.068, 0.205, '#2b2a25', 0.05],
    [0.068, 0.205, '#2b2a25', 0.05],
    [0.205, 0.205, '#2b2a25', 0.064],
  ] satisfies Array<[number, number, string, number]>;

  return (
    <group rotation={[0, -0.35, 0]} scale={active ? 1.08 : 1}>
      <RoundedBox castShadow receiveShadow args={[0.66, 0.06, 0.66]} radius={0.025} position={[0, 0.03, 0]}>
        <meshStandardMaterial color="#7b5535" roughness={0.72} />
      </RoundedBox>
      <mesh receiveShadow position={[0, 0.064, 0]}>
        <boxGeometry args={[0.565, 0.012, 0.565]} />
        <meshStandardMaterial color="#e9d2a6" roughness={0.66} />
      </mesh>
      {Array.from({ length: 64 }, (_, index) => {
        const row = Math.floor(index / 8);
        const column = index % 8;
        const x = column * squareSize - boardOffset;
        const z = row * squareSize - boardOffset;
        const isDark = (row + column) % 2 === 1;

        return (
          <mesh key={index} receiveShadow position={[x, 0.073, z]}>
            <boxGeometry args={[squareSize, 0.01, squareSize]} />
            <meshStandardMaterial color={isDark ? '#455448' : '#f1dfbd'} roughness={0.7} />
          </mesh>
        );
      })}
      {pieces.map(([x, z, pieceColor, height], index) => (
        <group key={index} position={[x, 0.084, z]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.018, 0.024, height, 16]} />
            <meshStandardMaterial color={pieceColor} roughness={0.48} />
          </mesh>
          <mesh castShadow position={[0, height / 2 + 0.012, 0]}>
            <sphereGeometry args={[index % 4 === 0 || index % 4 === 3 ? 0.021 : 0.017, 16, 8]} />
            <meshStandardMaterial color={pieceColor} roughness={0.42} />
          </mesh>
        </group>
      ))}
      {[-0.32, 0.32].map((x) => (
        <mesh key={x} castShadow position={[x, 0.078, 0]}>
          <boxGeometry args={[0.028, 0.028, 0.66]} />
          <meshStandardMaterial color="#5b3d25" roughness={0.7} />
        </mesh>
      ))}
      {[-0.32, 0.32].map((z) => (
        <mesh key={z} castShadow position={[0, 0.078, z]}>
          <boxGeometry args={[0.66, 0.028, 0.028]} />
          <meshStandardMaterial color="#5b3d25" roughness={0.7} />
        </mesh>
      ))}
      <mesh castShadow position={[0.255, 0.135, -0.255]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.026, 0.055, 4]} />
        <meshStandardMaterial color={color} roughness={0.48} />
      </mesh>
    </group>
  );
}

function MidiKeyboard({ active, color }: { active: boolean; color: string }) {
  const whiteKeys = Array.from({ length: 8 }, (_, index) => -0.07 + index * 0.052);
  const blackKeyIndexes = [0, 1, 3, 4, 5];
  const pads = [
    [-0.27, -0.07],
    [-0.19, -0.07],
    [-0.27, 0.035],
    [-0.19, 0.035],
  ] satisfies Array<[number, number]>;

  return (
    <group rotation={[0, -0.18, 0]} scale={active ? 1.08 : 1}>
      <RoundedBox castShadow receiveShadow args={[0.82, 0.08, 0.36]} radius={0.035} position={[0, 0.04, 0]}>
        <meshStandardMaterial color="#121616" roughness={0.7} />
      </RoundedBox>
      <mesh castShadow position={[0.13, 0.09, 0.01]}>
        <boxGeometry args={[0.5, 0.025, 0.27]} />
        <meshStandardMaterial color="#1d2221" roughness={0.74} />
      </mesh>
      {whiteKeys.map((x) => (
        <mesh key={x} castShadow position={[x + 0.08, 0.118, 0.04]}>
          <boxGeometry args={[0.044, 0.026, 0.215]} />
          <meshStandardMaterial color="#f3f1e8" roughness={0.46} />
        </mesh>
      ))}
      {blackKeyIndexes.map((index) => (
        <mesh key={index} castShadow position={[0.035 + index * 0.052, 0.139, -0.03]}>
          <boxGeometry args={[0.03, 0.034, 0.13]} />
          <meshStandardMaterial color="#0b0d0d" roughness={0.52} />
        </mesh>
      ))}
      {pads.map(([x, z]) => (
        <mesh key={`${x}-${z}`} castShadow position={[x, 0.116, z]}>
          <boxGeometry args={[0.062, 0.023, 0.062]} />
          <meshStandardMaterial color="#393e3e" roughness={0.78} />
        </mesh>
      ))}
      {[-0.31, -0.235].map((x) => (
        <mesh key={x} castShadow position={[x, 0.127, -0.125]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.026, 0.026, 0.018, 20]} />
          <meshStandardMaterial color="#1f2322" roughness={0.58} />
        </mesh>
      ))}
      <mesh castShadow position={[-0.12, 0.111, -0.125]}>
        <boxGeometry args={[0.09, 0.016, 0.026]} />
        <meshStandardMaterial color="#2c3231" roughness={0.72} />
      </mesh>
      <mesh castShadow position={[-0.06, 0.122, 0.105]}>
        <sphereGeometry args={[0.02, 14, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.18} roughness={0.42} />
      </mesh>
    </group>
  );
}

function CatController({
  catPosition,
  mobileInput,
  nodes,
  onSelect,
}: Pick<DiscoverySceneProps, 'mobileInput' | 'nodes' | 'onSelect'> & {
  catPosition: MutableRefObject<THREE.Vector3>;
}) {
  const body = useRef<THREE.Group>(null);
  const keys = useRef<KeyState>({ forward: false, backward: false, left: false, right: false });
  const facing = useRef(0);
  const motion = useRef<CatMotionState>({ gaitPhase: 0, move: 0, speed: 0, turn: 0 });
  const selectedRef = useRef<NavNode['id'] | null>(null);
  const lastCollisionEvent = useRef(0);
  const destinationObstacles = useMemo(
    () =>
      nodes.map((node) => ({
        center: [node.position[0], node.position[2]] as [number, number],
        halfSize: node.collisionHalfSize,
        id: `destination-${node.id}`,
      })),
    [nodes],
  );

  useEffect(() => {
    const setKey = (event: KeyboardEvent, pressed: boolean) => {
      const key = event.key.toLowerCase();
      let handled = true;

      if (key === 'arrowup' || key === 'w') keys.current.forward = pressed;
      else if (key === 'arrowleft' || key === 'a') keys.current.left = pressed;
      else if (key === 'arrowright' || key === 'd') keys.current.right = pressed;
      else if (key !== 'arrowdown' && key !== 's') handled = false;

      if (handled) event.preventDefault();
    };
    const down = (event: KeyboardEvent) => setKey(event, true);
    const up = (event: KeyboardEvent) => setKey(event, false);

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);

    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useFrame((_, delta) => {
    if (!body.current) return;

    const translation = body.current.position;
    const turnInput =
      Number(keys.current.left || mobileInput.current.left) -
      Number(keys.current.right || mobileInput.current.right);
    const moveInput = Number(keys.current.forward || mobileInput.current.forward);
    const turnSpeed = 2.35;
    const maxSpeed = 1.38;
    const targetMove = moveInput;
    const targetSpeed = Math.abs(moveInput);

    motion.current.turn = THREE.MathUtils.damp(motion.current.turn, turnInput, 8, delta);
    motion.current.move = THREE.MathUtils.damp(motion.current.move, targetMove, 7, delta);
    motion.current.speed = THREE.MathUtils.damp(motion.current.speed, targetSpeed, 7, delta);
    motion.current.gaitPhase += delta * (2.2 + Math.max(motion.current.speed, Math.abs(motion.current.turn) * 0.68) * 6.4);
    facing.current += motion.current.turn * turnSpeed * delta;

    const direction = new THREE.Vector3(-Math.sin(facing.current), 0, -Math.cos(facing.current));
    const proposed = {
      x: THREE.MathUtils.clamp(translation.x + direction.x * maxSpeed * motion.current.move * delta, -ROOM_LIMIT, ROOM_LIMIT),
      z: THREE.MathUtils.clamp(translation.z + direction.z * maxSpeed * motion.current.move * delta, -ROOM_LIMIT, ROOM_LIMIT),
    };
    const resolved = resolveBlockedMove({ x: translation.x, z: translation.z }, proposed, destinationObstacles);
    const wasBlocked =
      moveInput > 0 &&
      (Math.abs(resolved.x - proposed.x) > 0.001 || Math.abs(resolved.z - proposed.z) > 0.001);

    if (wasBlocked) {
      const now = performance.now();
      if (now - lastCollisionEvent.current > 2000) {
        lastCollisionEvent.current = now;
        trackEvent('cat_collision_blocked');
      }
    }

    const next = {
      x: resolved.x,
      y: CAT_START[1],
      z: resolved.z,
    };

    body.current.position.set(next.x, next.y, next.z);
    body.current.rotation.set(0, facing.current, 0);
    catPosition.current.set(next.x, next.y, next.z);

    const nearest = nodes
      .map((node) => ({
        node,
        distance: Math.hypot(node.position[0] - next.x, node.position[2] - next.z),
      }))
      .sort((a, b) => a.distance - b.distance)[0];

    const nextActiveId = nearest && nearest.distance < 0.58 ? nearest.node.id : null;

    if (nextActiveId !== selectedRef.current) {
      selectedRef.current = nextActiveId;
      onSelect(nextActiveId);
    }
  });

  return (
    <group ref={body} position={CAT_START}>
      <OrangeCat motion={motion} />
    </group>
  );
}

function OrangeCat({ motion }: { motion: React.MutableRefObject<CatMotionState> }) {
  const gltf = useGLTF(TOON_CAT_URL);
  const model = gltf.scene;
  const { actions } = useAnimations(gltf.animations, model);
  const root = useRef<THREE.Group>(null);
  const tailBones = useRef<CatBonePose[]>([]);
  const legBones = useRef<CatLegPose[]>([]);
  const headBone = useRef<CatBonePose | null>(null);
  const earBones = useRef<CatBonePose[]>([]);

  useEffect(() => {
    model.traverse((object) => {
      if ('isMesh' in object && object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        object.frustumCulled = false;
      }
    });

    tailBones.current = ['tail.CTRL_030', 'tail_07', 'tail.01_08', 'tail.02_09', 'tail.03_010']
      .map((name) => model.getObjectByName(name))
      .filter((object): object is THREE.Object3D => Boolean(object))
      .map((object) => ({
        object,
        rotation: object.rotation.clone(),
      }));

    legBones.current = CAT_LEG_BONES.map(({ name, phase, side, stride }) => {
      const object = model.getObjectByName(name);
      if (!object) return null;

      return {
        object,
        phase,
        rotation: object.rotation.clone(),
        side,
        stride,
        lastOffset: new THREE.Euler(),
      };
    }).filter((pose): pose is CatLegPose => Boolean(pose));

    const head = model.getObjectByName('head_018');
    headBone.current = head ? { object: head, rotation: head.rotation.clone() } : null;

    earBones.current = ['ear.L_019', 'ear.R_020']
      .map((name) => model.getObjectByName(name))
      .filter((object): object is THREE.Object3D => Boolean(object))
      .map((object) => ({
        object,
        rotation: object.rotation.clone(),
      }));
  }, [model]);

  useEffect(() => {
    const action = actions.Scene ?? Object.values(actions)[0];
    if (!action) return;

    action.reset();
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.play();

    return () => {
      action.stop();
    };
  }, [actions]);

  useFrame(({ clock }, delta) => {
    const walk = motion.current.speed;
    const turn = motion.current.turn;
    const turnAmount = Math.abs(turn);
    const gaitAmount = Math.max(walk, turnAmount * 0.58);
    const idleAmount = 1 - THREE.MathUtils.clamp(gaitAmount * 1.8, 0, 1);
    const action = actions.Scene ?? Object.values(actions)[0];

    if (action) {
      const targetTimeScale = gaitAmount > 0.035 ? 0.48 + walk * 0.92 + turnAmount * 0.38 : 0;
      action.paused = gaitAmount < 0.025 && action.timeScale < 0.03;
      action.timeScale = THREE.MathUtils.damp(action.timeScale, targetTimeScale, 8, delta);
      action.weight = 1;
    }

    if (root.current) {
      const breath = Math.sin(clock.elapsedTime * 1.45) * idleAmount;
      root.current.rotation.z = THREE.MathUtils.damp(root.current.rotation.z, -turn * 0.09, 8, delta);
      root.current.rotation.x = THREE.MathUtils.damp(root.current.rotation.x, walk * 0.04 + turnAmount * 0.012, 8, delta);
      root.current.position.y = THREE.MathUtils.damp(root.current.position.y, -0.31 + breath * 0.005, 4, delta);
      root.current.scale.setScalar(0.0019 * (1 + breath * 0.006));
    }

    legBones.current.forEach((bone) => {
      bone.object.rotation.x -= bone.lastOffset.x;
      bone.object.rotation.y -= bone.lastOffset.y;
      bone.object.rotation.z -= bone.lastOffset.z;
      bone.lastOffset.set(0, 0, 0);

      if (gaitAmount < 0.16) {
        const settleRate = 5 + idleAmount * 7;
        bone.object.rotation.x = THREE.MathUtils.damp(bone.object.rotation.x, bone.rotation.x, settleRate, delta);
        bone.object.rotation.y = THREE.MathUtils.damp(bone.object.rotation.y, bone.rotation.y, settleRate, delta);
        bone.object.rotation.z = THREE.MathUtils.damp(bone.object.rotation.z, bone.rotation.z, settleRate, delta);
      }

      if (gaitAmount > 0.035) {
        const phase = motion.current.gaitPhase + bone.phase;
        const step = Math.sin(phase);
        const lift = Math.max(0, Math.sin(phase + Math.PI * 0.2));
        const outerStepBoost = 1 + Math.max(0, turn * bone.side) * 0.38;
        const strideAmount = THREE.MathUtils.clamp(gaitAmount, 0, 1) * outerStepBoost;
        const xOffset = step * bone.stride * strideAmount;
        const yOffset = turn * bone.side * 0.016 * strideAmount;
        const zOffset = lift * 0.018 * strideAmount;

        bone.object.rotation.x += xOffset;
        bone.object.rotation.y += yOffset;
        bone.object.rotation.z += zOffset;
        bone.lastOffset.set(xOffset, yOffset, zOffset);
      }
    });

    if (headBone.current) {
      const { object, rotation } = headBone.current;
      const idleLook = Math.sin(clock.elapsedTime * 0.72) * 0.055 * idleAmount;
      const idleNod = Math.sin(clock.elapsedTime * 1.15 + 0.8) * 0.025 * idleAmount;
      object.rotation.x = THREE.MathUtils.damp(object.rotation.x, rotation.x + idleNod, 4, delta);
      object.rotation.y = THREE.MathUtils.damp(object.rotation.y, rotation.y + idleLook - turn * 0.04, 4, delta);
      object.rotation.z = THREE.MathUtils.damp(object.rotation.z, rotation.z - turn * 0.018, 4, delta);
    }

    earBones.current.forEach(({ object, rotation }, index) => {
      const earTwitch = Math.pow(Math.max(0, Math.sin(clock.elapsedTime * 0.88 + index * 1.9)), 14) * idleAmount;
      object.rotation.z = THREE.MathUtils.damp(object.rotation.z, rotation.z + (index === 0 ? 1 : -1) * earTwitch * 0.045, 7, delta);
      object.rotation.x = THREE.MathUtils.damp(object.rotation.x, rotation.x + earTwitch * 0.025, 7, delta);
      object.rotation.y = THREE.MathUtils.damp(object.rotation.y, rotation.y, 7, delta);
    });

    tailBones.current.forEach(({ object, rotation }, index) => {
      const chain = index / Math.max(1, tailBones.current.length - 1);
      const wag = Math.sin(clock.elapsedTime * (1.75 + gaitAmount * 1.15) + index * 0.56);
      const wave = Math.sin(clock.elapsedTime * 0.95 + index * 0.92);
      const attentiveSway = Math.sin(clock.elapsedTime * 0.38 - 0.7) * idleAmount;
      const targetX = rotation.x + wag * (0.026 + idleAmount * 0.014) + wave * 0.014 * chain;
      const targetY = rotation.y + wag * (0.095 + idleAmount * 0.052 + walk * 0.018) + attentiveSway * 0.03 * chain + turn * 0.068;
      const targetZ = rotation.z + wave * 0.018 * chain - turn * 0.02 * chain;

      object.rotation.x = THREE.MathUtils.damp(object.rotation.x, targetX, 9, delta);
      object.rotation.y = THREE.MathUtils.damp(object.rotation.y, targetY, 9, delta);
      object.rotation.z = THREE.MathUtils.damp(object.rotation.z, targetZ, 9, delta);
    });
  });

  return (
    <group ref={root} position={[0, -0.31, 0]} rotation={[0, Math.PI, 0]} scale={0.0019}>
      <primitive object={model} />
    </group>
  );
}
