import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

const KENNEY_MODEL_URLS = [
  '/models/kenney/loungeSofa.glb',
  '/models/kenney/sideTableDrawers.glb',
  '/models/kenney/tableCoffee.glb',
  '/models/kenney/lampRoundFloor.glb',
  '/models/kenney/plantSmall1.glb',
  '/models/kenney/plant_bushDetailed.glb',
  '/models/kenney/plant_flatTall.glb',
  '/models/kenney/pot_large.glb',
] as const;

export const TOON_CAT_URL = '/models/toon_cat_free.glb';

type SceneModelProps = {
  color?: string;
  emissive?: string;
  emissiveIntensity?: number;
  material?: THREE.Material;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  url: string;
};

export function SceneModel({
  color,
  emissive,
  emissiveIntensity = 0,
  material: materialOverride,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  url,
}: SceneModelProps) {
  const gltf = useGLTF(url);
  const model = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  useEffect(() => {
    model.traverse((object) => {
      if ('isMesh' in object && object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        if ((color || emissive || materialOverride) && 'material' in object) {
          const mesh = object as THREE.Mesh;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

          const clonedMaterials = materials.map((sourceMaterial) =>
            materialOverride ? materialOverride.clone() : sourceMaterial.clone(),
          );
          clonedMaterials.forEach((material) => {
            if (color && 'color' in material && material.color instanceof THREE.Color) {
              material.color.set(color);
            }
            if (emissive && material instanceof THREE.MeshStandardMaterial) {
              material.emissive.set(emissive);
              material.emissiveIntensity = emissiveIntensity;
            }
          });
          mesh.material = Array.isArray(mesh.material) ? clonedMaterials : clonedMaterials[0];
        }
      }
    });
  }, [color, emissive, emissiveIntensity, materialOverride, model]);

  return <primitive object={model} position={position} rotation={rotation} scale={scale} />;
}

useGLTF.preload(TOON_CAT_URL);
KENNEY_MODEL_URLS.forEach((url) => useGLTF.preload(url));
