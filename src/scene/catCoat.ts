export type CatCoat = 'buff' | 'light-orange';

export const CAT_COAT_STORAGE_KEY = 'chatonne.catCoat';
export const DEFAULT_CAT_COAT: CatCoat = 'light-orange';

const CAT_COAT_COLORS: Record<CatCoat, readonly [number, number, number]> = {
  'light-orange': [255, 170, 51],
  buff: [218, 160, 109],
};

export function isCatCoat(value: unknown): value is CatCoat {
  return value === 'light-orange' || value === 'buff';
}

export function nextCatCoat(coat: CatCoat): CatCoat {
  return coat === 'light-orange' ? 'buff' : 'light-orange';
}

export function readCatCoat(storage: Pick<Storage, 'getItem'> | null | undefined): CatCoat {
  try {
    const stored = storage?.getItem(CAT_COAT_STORAGE_KEY);
    return isCatCoat(stored) ? stored : DEFAULT_CAT_COAT;
  } catch {
    return DEFAULT_CAT_COAT;
  }
}

export function writeCatCoat(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  coat: CatCoat,
) {
  try {
    storage?.setItem(CAT_COAT_STORAGE_KEY, coat);
  } catch {
    // The visual preference remains session-local when storage is unavailable.
  }
}

export function recolorCatCoatPixels(source: Uint8ClampedArray, coat: CatCoat) {
  const output = new Uint8ClampedArray(source);
  const target = CAT_COAT_COLORS[coat];

  for (let index = 0; index < output.length; index += 4) {
    const red = source[index];
    const green = source[index + 1];
    const blue = source[index + 2];
    const lightness = (Math.max(red, green, blue) + Math.min(red, green, blue)) / 510;
    const warm = red > green * 1.02 && red > blue * 1.08 && red - Math.min(green, blue) > 18;

    // Preserve pale markings and the darkest facial details from the source atlas.
    if (!warm || lightness < 0.16) continue;

    if (lightness <= 0.5) {
      const shade = 0.55 + lightness * 0.9;
      output[index] = target[0] * shade;
      output[index + 1] = target[1] * shade;
      output[index + 2] = target[2] * shade;
      continue;
    }

    const highlight = Math.min(1, (lightness - 0.5) * 2) * 0.72;
    output[index] = target[0] + (255 - target[0]) * highlight;
    output[index + 1] = target[1] + (255 - target[1]) * highlight;
    output[index + 2] = target[2] + (255 - target[2]) * highlight;
  }

  return output;
}
