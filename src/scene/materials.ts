import * as THREE from 'three';

type FabricKind = 'pillow-light' | 'pillow-green' | 'rug' | 'sofa';
type WoodKind = 'floor' | 'furniture' | 'shelf' | 'trim';

function textureFromCanvas(
  size: number,
  repeat: [number, number],
  paint: (context: CanvasRenderingContext2D, size: number) => void,
  colorMap = true,
) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');

  if (context) paint(context, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.colorSpace = colorMap ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.needsUpdate = true;

  return texture;
}

function seededValue(seed: number) {
  return Math.sin(seed * 12.9898) * 43758.5453 % 1;
}

function createWoodColorTexture(kind: WoodKind) {
  const palette: Record<WoodKind, string[]> = {
    floor: ['#6f3e20', '#7b4827', '#8b552f', '#62361d'],
    furniture: ['#6b3d22', '#7f4a28', '#8f572f', '#5f341d'],
    shelf: ['#5b351f', '#704326', '#8a552e', '#4c2c1b'],
    trim: ['#8b5a32', '#a66b3b', '#b77942', '#774927'],
  };
  const repeat: Record<WoodKind, [number, number]> = {
    floor: [1.35, 1.35],
    furniture: [1.9, 1.2],
    shelf: [2.6, 1.35],
    trim: [3.2, 0.9],
  };

  return textureFromCanvas(1024, repeat[kind], (context, size) => {
    const planks = kind === 'floor' ? 12 : 8;
    const plankWidth = size / planks;
    context.fillStyle = palette[kind][0];
    context.fillRect(0, 0, size, size);

    for (let plank = 0; plank < planks; plank += 1) {
      const x = plank * plankWidth;
      context.fillStyle = palette[kind][plank % palette[kind].length];
      context.fillRect(x, 0, plankWidth + 1, size);

      context.strokeStyle = kind === 'floor' ? 'rgba(255, 216, 160, 0.055)' : 'rgba(255, 216, 160, 0.1)';
      context.lineWidth = 1.3;
      for (let grain = 0; grain < 34; grain += 1) {
        const offset = (seededValue(plank * 31 + grain * 7) + 0.5) * plankWidth * 0.55;
        const startY = (grain * 37 + plank * 19) % size;
        context.beginPath();
        context.moveTo(x + plankWidth * 0.16 + offset, startY);
        context.bezierCurveTo(
          x + plankWidth * 0.1 + offset * 0.75,
          startY + 80,
          x + plankWidth * 0.86 - offset * 0.2,
          startY + 150,
          x + plankWidth * 0.62 + offset * 0.3,
          startY + 250,
        );
        context.stroke();
      }

      context.fillStyle = 'rgba(42, 23, 13, 0.5)';
      context.fillRect(x, 0, kind === 'floor' ? 3 : 2, size);
    }

    context.fillStyle = kind === 'floor' ? 'rgba(255, 228, 176, 0.035)' : 'rgba(255, 228, 176, 0.07)';
    for (let y = 0; y < size; y += kind === 'floor' ? size / 5 : size / 3) {
      context.fillRect(0, y, size, 2);
    }
  });
}

function createWoodBumpTexture(kind: WoodKind) {
  const repeat: Record<WoodKind, [number, number]> = {
    floor: [1.35, 1.35],
    furniture: [1.9, 1.2],
    shelf: [2.6, 1.35],
    trim: [3.2, 0.9],
  };

  return textureFromCanvas(512, repeat[kind], (context, size) => {
    context.fillStyle = '#808080';
    context.fillRect(0, 0, size, size);
    context.strokeStyle = 'rgba(35, 35, 35, 0.42)';
    context.lineWidth = 1;
    for (let line = 0; line < 90; line += 1) {
      const x = (line * 41 + 17) % size;
      context.beginPath();
      context.moveTo(x, 0);
      context.bezierCurveTo(x + 24, size * 0.28, x - 18, size * 0.68, x + 8, size);
      context.stroke();
    }
    context.strokeStyle = 'rgba(230, 230, 230, 0.22)';
    for (let line = 0; line < 36; line += 1) {
      const x = (line * 73 + 9) % size;
      context.beginPath();
      context.moveTo(x, 0);
      context.bezierCurveTo(x - 12, size * 0.35, x + 16, size * 0.72, x - 6, size);
      context.stroke();
    }
  }, false);
}

function createFabricTexture(kind: FabricKind, bump = false) {
  const base: Record<FabricKind, string> = {
    sofa: '#526243',
    'pillow-green': '#4a5c3d',
    'pillow-light': '#d6c7a5',
    rug: '#d8cbb5',
  };
  const repeat: Record<FabricKind, [number, number]> = {
    sofa: [4.5, 3.2],
    'pillow-green': [2.6, 2.2],
    'pillow-light': [2.6, 2.2],
    rug: [8.5, 5.5],
  };

  return textureFromCanvas(512, repeat[kind], (context, size) => {
    context.fillStyle = bump ? '#858585' : base[kind];
    context.fillRect(0, 0, size, size);

    const spacing = kind === 'rug' ? 18 : 12;
    context.lineWidth = 1;
    for (let index = 0; index < size; index += spacing) {
      context.strokeStyle = bump ? 'rgba(40,40,40,0.38)' : 'rgba(255,255,255,0.13)';
      context.beginPath();
      context.moveTo(index, 0);
      context.lineTo(index + Math.sin(index) * 3, size);
      context.stroke();

      context.strokeStyle = bump ? 'rgba(220,220,220,0.28)' : 'rgba(22,20,16,0.18)';
      context.beginPath();
      context.moveTo(0, index);
      context.lineTo(size, index + Math.cos(index) * 3);
      context.stroke();
    }

    if (kind === 'rug') {
      context.fillStyle = bump ? 'rgba(112,112,112,0.35)' : 'rgba(244, 234, 212, 0.28)';
      for (let stripe = 0; stripe < 10; stripe += 1) {
        const x = 38 + stripe * 46;
        context.fillRect(x, 0, 5, size);
      }
    }
  }, !bump);
}

export function createWoodMaterial(kind: WoodKind) {
  return new THREE.MeshStandardMaterial({
    map: createWoodColorTexture(kind),
    bumpMap: createWoodBumpTexture(kind),
    bumpScale: kind === 'floor' ? 0.024 : 0.025,
    roughness: kind === 'shelf' ? 0.62 : 0.74,
    metalness: 0,
  });
}

export function createFabricMaterial(kind: FabricKind) {
  return new THREE.MeshPhysicalMaterial({
    map: createFabricTexture(kind),
    bumpMap: createFabricTexture(kind, true),
    bumpScale: kind === 'rug' ? 0.015 : 0.025,
    roughness: kind === 'rug' ? 0.96 : 0.88,
    sheen: 0.45,
    sheenColor: new THREE.Color(kind === 'pillow-light' || kind === 'rug' ? '#f4e8d2' : '#7f9368'),
    sheenRoughness: 0.78,
  });
}

export function createMetalMaterial(kind: 'brass' | 'lamp') {
  return new THREE.MeshStandardMaterial({
    color: kind === 'brass' ? '#d8aa5c' : '#d6c18a',
    metalness: 0.72,
    roughness: kind === 'brass' ? 0.36 : 0.44,
  });
}
