import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { RoundedBox, useAnimations, useGLTF } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef, type MutableRefObject, type PropsWithChildren } from 'react';
import * as THREE from 'three';
import type { NavNode } from '../data/navNodes';
import { trackEvent } from '../lib/telemetry';
import { SceneModel, TOON_CAT_URL } from './SceneModel';
import { CAT_ROOM_LIMIT, CAT_START, resolveBlockedMove } from './collisions';
import {
  calculateFollowCameraFraming,
  FOLLOW_CAMERA_BACKWARD,
  FOLLOW_CAMERA_TARGET,
} from './followCamera';
import type { MovementInput } from './movementInput';
import {
  createCatPostureState,
  isCatStanding,
  updateCatPosture,
  type CatPostureState,
} from './catPosture';
import {
  createFabricMaterial,
  createMetalMaterial,
  createWoodMaterial,
} from './materials';

type DiscoverySceneProps = {
  activeId: NavNode['id'] | null;
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
  posture: CatPostureState;
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

type CatPostureBonePose = CatBonePose & {
  offset: [number, number, number];
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
  { name: 'legupperFL_014', phase: 0, side: -1, stride: 0.1 },
  { name: 'leglowerFL_015', phase: Math.PI * 0.16, side: -1, stride: -0.075 },
  { name: 'footFL_016', phase: Math.PI * 0.34, side: -1, stride: 0.045 },
  { name: 'legupperFR_024', phase: Math.PI, side: 1, stride: 0.1 },
  { name: 'leglowerFR_00', phase: Math.PI * 1.16, side: 1, stride: -0.075 },
  { name: 'footFR_025', phase: Math.PI * 1.34, side: 1, stride: 0.045 },
  { name: 'legupperBL_04', phase: Math.PI, side: -1, stride: 0.085 },
  { name: 'leglowerBL_05', phase: Math.PI * 1.18, side: -1, stride: -0.07 },
  { name: 'footBL_06', phase: Math.PI * 1.36, side: -1, stride: 0.04 },
  { name: 'legupperBR_027', phase: 0, side: 1, stride: 0.085 },
  { name: 'leglowerBR_028', phase: Math.PI * 0.18, side: 1, stride: -0.07 },
  { name: 'footBR_029', phase: Math.PI * 0.36, side: 1, stride: 0.04 },
] satisfies Array<{ name: string; phase: number; side: -1 | 1; stride: number }>;

const CAT_SIT_BONE_OFFSETS = {
  torso_02: [-0.72, 0, 0],
  spine01_012: [0.08, 0, 0],
  spine02_013: [0.1, 0, 0],
  neck_017: [0.32, 0, 0],
  thighBL_03: [0.01, 0.04, 0.04],
  legupperBL_04: [0.71, 0, 0],
  leglowerBL_05: [-1.32, 0, 0],
  footBL_06: [0.57, 0, 0],
  thighBR_026: [-0.33, -0.04, -0.04],
  legupperBR_027: [0.25, 0, 0],
  leglowerBR_028: [-1.45, 0, 0],
  footBR_029: [-0.29, 0, 0],
  legupperFL_014: [0.84, 0, 0],
  leglowerFL_015: [0.5, 0, 0],
  footFL_016: [-0.7, 0, 0],
  legupperFR_024: [-0.09, 0, 0],
  leglowerFR_00: [0.37, 0, 0],
  footFR_025: [0.37, 0, 0],
} satisfies Record<string, [number, number, number]>;

const DESTINATION_SPARKLE_SETTINGS = {
  about: { center: [0, 0.04, 0.04], initialDelay: 1.2, plane: 'wall', radius: 0.12 },
  chess: { center: [0, 0.13, 0], initialDelay: 3.7, plane: 'floor', radius: 0.2 },
  synth: { center: [0, 0.14, 0], initialDelay: 4.8, plane: 'floor', radius: 0.18 },
  spotify: { center: [0.06, 1.08, 0.27], initialDelay: 2.8, plane: 'wall', radius: 0.24 },
} satisfies Record<NavNode['id'], SparkleSettings>;

function applyDeadZone(value: number, radius: number) {
  if (Math.abs(value) <= radius) return 0;
  return Math.sign(value) * (Math.abs(value) - radius);
}

export function DiscoveryScene({ activeId, mobileInput, nodes, onSelect }: DiscoverySceneProps) {
  const catPosition = useRef(new THREE.Vector3(...CAT_START));

  return (
    <div className="scene-wrap" aria-label="Interactive room navigation">
      <Canvas
        camera={{ position: [0, 4.9, 6.2], fov: 43 }}
        dpr={[1, 1.75]}
        onCreated={() => trackEvent('scene_loaded')}
        onError={() => trackEvent('webgl_failed')}
        shadows
      >
        <Suspense fallback={null}>
          <color attach="background" args={['#d9b892']} />
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
          <CameraRig catPosition={catPosition} />
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

function CameraRig({ catPosition }: { catPosition: MutableRefObject<THREE.Vector3> }) {
  const { size } = useThree();
  const initialized = useRef(false);
  const lastAspect = useRef(0);
  const framing = useRef(calculateFollowCameraFraming(1));
  const currentTarget = useRef(FOLLOW_CAMERA_TARGET.clone());
  const desiredTarget = useRef(FOLLOW_CAMERA_TARGET.clone());

  useFrame(({ camera }, delta) => {
    const aspect = size.width / Math.max(size.height, 1);
    if (Math.abs(aspect - lastAspect.current) > 0.001) {
      lastAspect.current = aspect;
      framing.current = calculateFollowCameraFraming(aspect);
    }

    desiredTarget.current.copy(FOLLOW_CAMERA_TARGET);
    const horizontalPan = THREE.MathUtils.clamp(
      applyDeadZone(catPosition.current.x, 0.3) * 0.95,
      -framing.current.maxTargetX,
      framing.current.maxTargetX,
    );
    const depthPan = THREE.MathUtils.clamp(
      applyDeadZone(catPosition.current.z, 0.5) * 0.62,
      -1.85,
      framing.current.maxTargetZ,
    );
    desiredTarget.current.x += horizontalPan;
    desiredTarget.current.z += depthPan;

    if (!initialized.current) {
      initialized.current = true;
      currentTarget.current.copy(desiredTarget.current);
    } else {
      currentTarget.current.x = THREE.MathUtils.damp(currentTarget.current.x, desiredTarget.current.x, 7, delta);
      currentTarget.current.y = THREE.MathUtils.damp(currentTarget.current.y, desiredTarget.current.y, 7, delta);
      currentTarget.current.z = THREE.MathUtils.damp(currentTarget.current.z, desiredTarget.current.z, 7, delta);
    }

    camera.position
      .copy(currentTarget.current)
      .addScaledVector(FOLLOW_CAMERA_BACKWARD, framing.current.distance);
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
  const shelfFloors = [-1.145, -0.505, 0.135];
  const shelfBays = [
    { center: -2.49, width: 0.48 },
    { center: -1.65, width: 0.98 },
    { center: -0.55, width: 0.98 },
    { center: 0.55, width: 0.98 },
    { center: 1.65, width: 0.98 },
    { center: 2.49, width: 0.48 },
  ];
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
        {shelfFloors.flatMap((y, row) =>
          shelfBays.map(({ center, width }, column) => (
            <ShelfCell
              key={`${row}-${column}`}
              column={column}
              position={[center, y, 0.18]}
              row={row}
              seed={row * 17 + column * 11}
              slotWidth={width}
            />
          )),
        )}
      </group>
    </StaticGroup>
  );
}

function seededUnit(seed: number, salt: number) {
  const value = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function ShelfCell({
  column,
  position,
  row,
  seed,
  slotWidth,
}: {
  column: number;
  position: [number, number, number];
  row: number;
  seed: number;
  slotWidth: number;
}) {
  const colors = ['#d0b88d', '#1f2522', '#b99468', '#f4dfbd', '#7b4a28', '#46563d', '#8e6f49'];
  const cellPatterns = [
    [7, 1, 2, 4, 11, 9],
    [9, 5, 3, 14, 2, 8],
    [0, 11, 6, 1, 13, 12],
  ];
  const pattern = cellPatterns[row]?.[column] ?? Math.floor(seededUnit(seed, 2) * 16);
  const sideBay = slotWidth < 0.6;
  const maxOffset = sideBay ? 0.035 : 0.18;
  const offsetX = (seededUnit(seed, 1) - 0.5) * maxOffset;
  const objectScale = sideBay ? 0.82 : 1;

  return (
    <group position={position}>
      {pattern === 0 && <ShelfTray position={[offsetX, 0, 0.005]} scale={objectScale} seed={seed} />}
      {pattern === 1 && (
        <ShelfBooks
          count={sideBay ? 3 : 5 + (seed % 2)}
          lean={seed % 2 === 0}
          position={[sideBay ? -0.1 + offsetX : -0.34 + offsetX, 0, 0]}
          scale={objectScale}
          seed={seed}
        />
      )}
      {pattern === 2 && (
        <BookStack
          colors={[colors[seed % colors.length], colors[(seed + 2) % colors.length], colors[(seed + 5) % colors.length]]}
          position={[offsetX, 0, 0.005]}
          scale={objectScale}
          seed={seed}
        />
      )}
      {pattern === 3 && !sideBay && (
        <>
          <ShelfBooks count={5} position={[-0.34 + offsetX, 0, 0]} seed={seed} />
          <ShelfBowl position={[0.18 + offsetX, 0, 0.005]} seed={seed} />
        </>
      )}
      {pattern === 4 && <ShelfFoldedTextiles position={[offsetX, 0, 0.005]} scale={objectScale} seed={seed} />}
      {pattern === 5 && (
        <>
          <ShelfVase position={[-0.18 + offsetX, 0, 0]} scale={objectScale} seed={seed} />
          <BookStack colors={[colors[(seed + 1) % colors.length], colors[(seed + 4) % colors.length]]} position={[0.16 + offsetX, 0, 0]} scale={0.92} seed={seed} />
        </>
      )}
      {pattern === 6 && !sideBay && (
        <>
          <ShelfFramedArt position={[-0.2 + offsetX, 0, 0.005]} seed={seed} />
          {seed % 2 === 0 ? (
            <SceneModel color="#496c48" position={[0.22 + offsetX, 0, 0]} scale={0.42} url="/models/kenney/plantSmall1.glb" />
          ) : (
            <BookStack colors={[colors[seed % colors.length], colors[(seed + 3) % colors.length]]} position={[0.18 + offsetX, 0, 0]} scale={0.86} seed={seed} />
          )}
        </>
      )}
      {pattern === 7 && <ShelfBasket position={[offsetX, 0, 0.005]} scale={objectScale} seed={seed} />}
      {pattern === 8 && <ShelfBowl position={[offsetX, 0, 0.005]} scale={sideBay ? 0.88 : 1} seed={seed} />}
      {pattern === 9 && (
        <ShelfBooks count={sideBay ? 2 : 3 + (seed % 2)} lean position={[sideBay ? -0.08 + offsetX : -0.24 + offsetX, 0, 0]} scale={objectScale} seed={seed} />
      )}
      {pattern === 10 && !sideBay && (
        <>
          <ShelfVase position={[-0.2 + offsetX, 0, 0]} seed={seed} />
          <ShelfBowl position={[0.18 + offsetX, 0, 0.005]} seed={seed + 2} />
        </>
      )}
      {pattern === 11 && !sideBay && (
        <>
          <BookStack colors={[colors[seed % colors.length], colors[(seed + 3) % colors.length]]} position={[-0.16 + offsetX, 0, 0]} scale={0.88} seed={seed} />
          <ShelfBooks count={3} position={[0.12 + offsetX, 0, 0]} scale={0.9} seed={seed + 2} />
        </>
      )}
      {pattern === 12 && <ShelfCandles position={[offsetX, 0, 0.005]} scale={objectScale} seed={seed} />}
      {pattern === 13 && <ShelfVasePair position={[offsetX, 0, 0]} scale={objectScale} seed={seed} />}
      {pattern === 14 && !sideBay && (
        <>
          <ShelfBooks count={4} lean position={[-0.32 + offsetX, 0, 0]} seed={seed} />
          <ShelfSculpture position={[0.2 + offsetX, 0, 0.005]} seed={seed} />
        </>
      )}
      {pattern === 15 && !sideBay && <ShelfTray position={[offsetX, 0, 0.005]} scale={0.9} seed={seed + 1} />}
    </group>
  );
}

function ShelfBooks({
  count,
  lean = false,
  position,
  scale = 1,
  seed,
}: {
  count: number;
  lean?: boolean;
  position: [number, number, number];
  scale?: number;
  seed: number;
}) {
  const colors = ['#1f2522', '#b99468', '#d0b88d', '#7b4a28', '#46563d', '#f4dfbd', '#9b5537'];

  return (
    <group position={position} scale={scale}>
      {Array.from({ length: count }, (_, index) => {
        const height = 0.22 + ((seed + index) % 5) * 0.038;
        const width = 0.04 + ((seed + index) % 3) * 0.01;
        const depth = 0.075 + ((seed + index) % 2) * 0.025;
        const tilt = lean && index === count - 1 ? -0.16 : ((seed + index) % 3 - 1) * 0.035;

        return (
          <mesh key={`${seed}-${index}`} position={[index * 0.057, height / 2, 0]} rotation={[0, 0, tilt]}>
            <boxGeometry args={[width, height, depth]} />
            <meshStandardMaterial color={colors[(seed + index) % colors.length]} roughness={0.78} />
          </mesh>
        );
      })}
    </group>
  );
}

function BookStack({
  colors,
  position,
  scale = 1,
  seed = 0,
}: {
  colors: string[];
  position: [number, number, number];
  scale?: number;
  seed?: number;
}) {
  return (
    <group position={position} rotation={[0, 0, seed % 2 ? 0.025 : -0.02]} scale={scale}>
      {colors.map((color, index) => (
        <mesh key={`${color}-${index}`} position={[0, 0.015 + index * 0.035, 0]} rotation={[0, 0, index % 2 ? 0.02 : -0.015]}>
          <boxGeometry args={[0.42 - index * 0.05, 0.03, 0.11 + (index % 2) * 0.02]} />
          <meshStandardMaterial color={color} roughness={0.78} />
        </mesh>
      ))}
    </group>
  );
}

function ShelfBowl({ position, scale = 1, seed }: { position: [number, number, number]; scale?: number; seed: number }) {
  const colors = ['#d0b88d', '#2f332f', '#b99468', '#f1dbc0'];

  return (
    <group position={position} scale={scale}>
      <mesh castShadow position={[0, 0.055, 0]} scale={[1.25, 0.42, 1]}>
        <sphereGeometry args={[0.11, 22, 10]} />
        <meshStandardMaterial color={colors[seed % colors.length]} roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0, 0.092, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.09, 0.008, 8, 24]} />
        <meshStandardMaterial color="#211f1b" roughness={0.82} />
      </mesh>
    </group>
  );
}

function ShelfBasket({ position, scale = 1, seed }: { position: [number, number, number]; scale?: number; seed: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow receiveShadow position={[0, 0.07, 0]}>
        <boxGeometry args={[0.44, 0.14, 0.18]} />
        <meshStandardMaterial color={seed % 2 ? '#a87945' : '#b8905f'} roughness={0.92} />
      </mesh>
      {[-0.16, -0.05, 0.06, 0.17].map((x) => (
        <mesh key={x} position={[x, 0.143, 0.092]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.005, 0.005, 0.12, 6]} />
          <meshStandardMaterial color="#6f4a2b" roughness={0.96} />
        </mesh>
      ))}
    </group>
  );
}

function ShelfFoldedTextiles({ position, scale = 1, seed }: { position: [number, number, number]; scale?: number; seed: number }) {
  const colors = ['#d9c9b0', '#f1dfbd', '#bfa98d'];

  return (
    <group position={position} scale={scale}>
      {Array.from({ length: 3 }, (_, index) => (
        <RoundedBox key={index} castShadow args={[0.44 - index * 0.035, 0.048, 0.18]} radius={0.025} position={[0, 0.026 + index * 0.05, 0]}>
          <meshStandardMaterial color={colors[(seed + index) % colors.length]} roughness={0.96} />
        </RoundedBox>
      ))}
    </group>
  );
}

function ShelfFramedArt({ position, seed }: { position: [number, number, number]; seed: number }) {
  const artColors = ['#f4dfbd', '#46563d', '#b99468', '#1f2522'];

  return (
    <group position={position} rotation={[0, 0, seed % 2 ? 0.08 : -0.06]}>
      <mesh castShadow position={[0, 0.13, 0]}>
        <boxGeometry args={[0.28, 0.22, 0.025]} />
        <meshStandardMaterial color="#8b572f" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.13, 0.016]}>
        <planeGeometry args={[0.22, 0.16]} />
        <meshStandardMaterial color={artColors[seed % artColors.length]} roughness={0.76} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function ShelfVase({ position, scale = 1, seed }: { position: [number, number, number]; scale?: number; seed: number }) {
  const colors = ['#d0b88d', '#f4dfbd', '#6f5a43', '#2f332f'];

  return (
    <group position={position} scale={scale}>
      <mesh castShadow position={[0, 0.075, 0]}>
        <cylinderGeometry args={[0.052, 0.075, 0.15, 18]} />
        <meshStandardMaterial color={colors[seed % colors.length]} roughness={0.78} />
      </mesh>
      <mesh castShadow position={[0, 0.165, 0]}>
        <cylinderGeometry args={[0.032, 0.045, 0.07, 18]} />
        <meshStandardMaterial color={colors[seed % colors.length]} roughness={0.78} />
      </mesh>
    </group>
  );
}

function ShelfTray({ position, scale = 1, seed }: { position: [number, number, number]; scale?: number; seed: number }) {
  const colors = ['#7b4a28', '#2f332f', '#b99468'];

  return (
    <group position={position} scale={scale}>
      <mesh castShadow position={[0, 0.025, 0]}>
        <boxGeometry args={[0.46, 0.05, 0.15]} />
        <meshStandardMaterial color={colors[seed % colors.length]} roughness={0.78} />
      </mesh>
      <mesh castShadow position={[0, 0.065, 0]} scale={[1.6, 0.35, 0.8]}>
        <sphereGeometry args={[0.12, 20, 8]} />
        <meshStandardMaterial color={colors[(seed + 1) % colors.length]} roughness={0.84} />
      </mesh>
    </group>
  );
}

function ShelfCandles({ position, scale = 1, seed }: { position: [number, number, number]; scale?: number; seed: number }) {
  const candleColors = ['#f4dfbd', '#d9c9b0', '#c78b6c'];

  return (
    <group position={position} scale={scale}>
      <mesh castShadow receiveShadow position={[0, 0.012, 0.005]}>
        <cylinderGeometry args={[0.13, 0.13, 0.024, 24]} />
        <meshStandardMaterial color="#d0b88d" roughness={0.82} />
      </mesh>
      {[-0.08, 0.015, 0.095].map((x, index) => {
        const height = 0.12 + ((seed + index) % 3) * 0.035;

        return (
          <mesh key={x} castShadow position={[x, 0.024 + height / 2, 0]}>
            <cylinderGeometry args={[0.025, 0.028, height, 16]} />
            <meshStandardMaterial color={candleColors[(seed + index) % candleColors.length]} roughness={0.88} />
          </mesh>
        );
      })}
    </group>
  );
}

function ShelfVasePair({ position, scale = 1, seed }: { position: [number, number, number]; scale?: number; seed: number }) {
  return (
    <group position={position} scale={scale}>
      <ShelfVase position={[-0.08, 0, 0]} scale={0.88} seed={seed} />
      <ShelfVase position={[0.09, 0, 0.018]} scale={0.66} seed={seed + 3} />
    </group>
  );
}

function ShelfSculpture({ position, seed }: { position: [number, number, number]; seed: number }) {
  const colors = ['#2f332f', '#6f5a43', '#b99468'];

  return (
    <group position={position} rotation={[0, 0, seed % 2 ? 0.08 : -0.06]}>
      <mesh castShadow position={[0, 0.018, 0]}>
        <boxGeometry args={[0.19, 0.036, 0.13]} />
        <meshStandardMaterial color="#1f2522" roughness={0.78} />
      </mesh>
      <mesh castShadow position={[-0.035, 0.085, 0]} rotation={[0.18, 0.12, 0.22]}>
        <dodecahedronGeometry args={[0.07, 0]} />
        <meshStandardMaterial color={colors[seed % colors.length]} roughness={0.86} />
      </mesh>
      <mesh castShadow position={[0.065, 0.075, 0.015]} rotation={[-0.12, 0.32, -0.18]}>
        <boxGeometry args={[0.08, 0.1, 0.06]} />
        <meshStandardMaterial color={colors[(seed + 1) % colors.length]} roughness={0.82} />
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
        <group position={[0, 0.38, -1.185]}>
          <SceneModel material={tableMaterial} position={[0.294, -0.38, 0.1]} scale={[2.25, 2.05, 2.15]} url="/models/kenney/tableCoffee.glb" />
          <SceneModel color="#3f5f43" position={[0.48, -0.14, -0.08]} rotation={[0, -0.28, 0]} scale={0.54} url="/models/kenney/plantSmall1.glb" />
        </group>
      </StaticGroup>

      <StaticGroup>
        <SideTable position={[-1.82, 0.66, -2.62]} rotation={Math.PI / 2} />
      </StaticGroup>
      <StaticGroup>
        <SideTable position={[1.82, 0.66, -2.62]} rotation={-Math.PI / 2} />
      </StaticGroup>
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
          <RoundedBox key={x} castShadow args={[0.46, 0.34, 0.16]} radius={0.08} position={[x, 0.11, -0.23]} rotation={[-0.34, 0, index === 1 ? 0 : x > 0 ? -0.04 : 0.04]}>
            <primitive attach="material" object={index === 1 ? lightPillowMaterial : greenPillowMaterial} />
          </RoundedBox>
        ))}
      </group>
    </StaticGroup>
  );
}

function LargeFloorPlant({ position, variant }: { position: [number, number, number]; variant: 'bush' | 'flat' }) {
  return (
    <StaticGroup>
      <group position={position}>
        <SceneModel color="#7a4d32" position={[0, -0.54, 0]} scale={2.2} url="/models/kenney/pot_large.glb" />
        {variant === 'bush' ? (
          <>
            <SceneModel color="#78a96b" emissive="#2b4d28" emissiveIntensity={0.16} position={[-0.02, -0.02, 0.01]} rotation={[0, 0.35, 0]} scale={1.76} url="/models/kenney/plant_bushDetailed.glb" />
            <SceneModel color="#8fbd79" emissive="#304f2c" emissiveIntensity={0.18} position={[-0.12, 0.34, -0.02]} rotation={[0, -0.65, 0]} scale={2.08} url="/models/kenney/plant_flatTall.glb" />
            <SceneModel color="#6fa765" emissive="#264825" emissiveIntensity={0.16} position={[0.28, 0.12, 0.08]} rotation={[0, 1.05, 0]} scale={1.54} url="/models/kenney/plant_flatTall.glb" />
            <SceneModel color="#8fbd79" emissive="#304f2c" emissiveIntensity={0.16} position={[0.04, 0.82, 0.02]} rotation={[0, -0.35, 0]} scale={1.36} url="/models/kenney/plant_flatTall.glb" />
            <SceneModel color="#78a96b" emissive="#2b4d28" emissiveIntensity={0.14} position={[0.02, 0.7, 0.02]} rotation={[0, 0.85, 0]} scale={0.96} url="/models/kenney/plant_bushDetailed.glb" />
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
        {node.id === 'spotify' && <StandingSpeaker active={isActive} />}
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

function StandingSpeaker({ active }: { active: boolean }) {
  const cabinetMaterial = useMemo(() => createWoodMaterial('furniture'), []);
  const scale = active ? 1.025 : 1;

  return (
    <group scale={scale} rotation={[0, -0.04, 0]}>
      <RoundedBox castShadow receiveShadow args={[0.68, 0.96, 0.44]} radius={0.035} position={[0, 1.0, 0]}>
        <primitive attach="material" object={cabinetMaterial} />
      </RoundedBox>
      <mesh castShadow position={[0, 1.0, 0.226]}>
        <boxGeometry args={[0.58, 0.86, 0.024]} />
        <meshStandardMaterial color="#121413" roughness={0.84} />
      </mesh>
      <SpeakerDriver position={[0, 1.21, 0.25]} radius={0.115} />
      <SpeakerDriver position={[0, 0.84, 0.25]} radius={0.205} />
      {[-0.23, 0.23].map((x) => (
        <mesh key={`post-${x}`} castShadow position={[x, 0.35, 0]}>
          <boxGeometry args={[0.065, 0.38, 0.065]} />
          <meshStandardMaterial color="#111313" metalness={0.55} roughness={0.48} />
        </mesh>
      ))}
      <mesh castShadow receiveShadow position={[0, 0.14, 0]}>
        <boxGeometry args={[0.72, 0.07, 0.5]} />
        <meshStandardMaterial color="#101212" metalness={0.56} roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0, 0.54, 0]}>
        <boxGeometry args={[0.72, 0.07, 0.48]} />
        <meshStandardMaterial color="#101212" metalness={0.56} roughness={0.5} />
      </mesh>
    </group>
  );
}

function SpeakerDriver({ position, radius }: { position: [number, number, number]; radius: number }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <torusGeometry args={[radius, radius * 0.13, 12, 32]} />
        <meshStandardMaterial color="#c6c9c7" metalness={0.72} roughness={0.34} />
      </mesh>
      <mesh position={[0, 0.012, 0]}>
        <circleGeometry args={[radius * 0.86, 32]} />
        <meshStandardMaterial color="#252827" roughness={0.62} />
      </mesh>
      <mesh position={[0, 0, 0.018]} scale={[1, 1, 0.28]}>
        <sphereGeometry args={[radius * 0.43, 24, 12]} />
        <meshStandardMaterial color="#0d0f0f" roughness={0.4} />
      </mesh>
    </group>
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
  const whiteKeys = Array.from({ length: 7 }, (_, index) => -0.07 + index * 0.052);
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
  const motion = useRef<CatMotionState>({
    gaitPhase: 0,
    move: 0,
    posture: createCatPostureState(),
    speed: 0,
    turn: 0,
  });
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
    const requestedTurn =
      Number(keys.current.left || mobileInput.current.left) -
      Number(keys.current.right || mobileInput.current.right);
    const requestedMove = Number(keys.current.forward || mobileInput.current.forward);
    const movementRequested = requestedMove !== 0 || requestedTurn !== 0;
    motion.current.posture ??= createCatPostureState();
    updateCatPosture(motion.current.posture, delta, movementRequested);
    const standing = isCatStanding(motion.current.posture);
    const turnInput = standing ? requestedTurn : 0;
    const moveInput = standing ? requestedMove : 0;
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
      x: THREE.MathUtils.clamp(translation.x + direction.x * maxSpeed * motion.current.move * delta, -CAT_ROOM_LIMIT, CAT_ROOM_LIMIT),
      z: THREE.MathUtils.clamp(translation.z + direction.z * maxSpeed * motion.current.move * delta, -CAT_ROOM_LIMIT, CAT_ROOM_LIMIT),
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

    const nextActiveId = nearest && nearest.distance < nearest.node.interactionRadius ? nearest.node.id : null;

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
  const postureBones = useRef<CatPostureBonePose[]>([]);
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

    tailBones.current = ['tailCTRL_030', 'tail_07', 'tail01_08', 'tail02_09', 'tail03_010']
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

    postureBones.current = Object.entries(CAT_SIT_BONE_OFFSETS)
      .map(([name, offset]) => {
        const object = model.getObjectByName(name);
        if (!object) return null;

        return {
          object,
          offset,
          rotation: object.rotation.clone(),
        };
      })
      .filter((pose): pose is CatPostureBonePose => Boolean(pose));

    const head = model.getObjectByName('head_018');
    headBone.current = head ? { object: head, rotation: head.rotation.clone() } : null;

    earBones.current = ['earL_019', 'earR_020']
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
    const posture = motion.current.posture;
    const sitAmount = THREE.MathUtils.smoothstep(posture.sitAmount, 0, 1);
    const isPosturing = sitAmount > 0.001;
    const seatedStill = posture.phase === 'seated' && sitAmount > 0.995;
    const turnAmount = Math.abs(turn);
    const gaitAmount = Math.max(walk, turnAmount * 0.58);
    const idleAmount = 1 - THREE.MathUtils.clamp(gaitAmount * 1.8, 0, 1);
    const action = actions.Scene ?? Object.values(actions)[0];

    if (action) {
      const targetTimeScale = gaitAmount > 0.035 ? 0.48 + walk * 0.92 + turnAmount * 0.38 : 0;
      action.enabled = !seatedStill;
      action.paused = seatedStill || (gaitAmount < 0.025 && action.timeScale < 0.03);
      action.timeScale = THREE.MathUtils.damp(action.timeScale, targetTimeScale, 8, delta);
      action.weight = 1 - sitAmount;
    }

    if (root.current) {
      const breath = Math.sin(clock.elapsedTime * 1.45) * idleAmount;
      root.current.rotation.z = THREE.MathUtils.damp(root.current.rotation.z, -turn * 0.09, 8, delta);
      root.current.rotation.x = THREE.MathUtils.damp(root.current.rotation.x, walk * 0.04 + turnAmount * 0.012, 8, delta);
      root.current.position.y = THREE.MathUtils.damp(
        root.current.position.y,
        -0.31 - sitAmount * 0.2 + breath * 0.005,
        8,
        delta,
      );
      root.current.scale.setScalar(0.0019 * (1 + breath * 0.006));
    }

    legBones.current.forEach((bone) => {
      bone.object.rotation.x -= bone.lastOffset.x;
      bone.object.rotation.y -= bone.lastOffset.y;
      bone.object.rotation.z -= bone.lastOffset.z;
      bone.lastOffset.set(0, 0, 0);

      if (isPosturing) return;

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

    if (isPosturing) {
      postureBones.current.forEach(({ object, offset, rotation }) => {
        const targetX = rotation.x + offset[0] * sitAmount;
        const targetY = rotation.y + offset[1] * sitAmount;
        const targetZ = rotation.z + offset[2] * sitAmount;

        if (seatedStill) {
          object.rotation.set(targetX, targetY, targetZ);
          return;
        }

        object.rotation.x = THREE.MathUtils.damp(object.rotation.x, targetX, 14, delta);
        object.rotation.y = THREE.MathUtils.damp(object.rotation.y, targetY, 14, delta);
        object.rotation.z = THREE.MathUtils.damp(object.rotation.z, targetZ, 14, delta);
      });
    }

    if (headBone.current) {
      const { object, rotation } = headBone.current;
      const idleLook = Math.sin(clock.elapsedTime * 0.72) * 0.055 * idleAmount;
      const idleNod = Math.sin(clock.elapsedTime * 1.15 + 0.8) * 0.025 * idleAmount;
      object.rotation.x = THREE.MathUtils.damp(object.rotation.x, rotation.x + idleNod - sitAmount * 0.08, 4, delta);
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
