import { clamp } from "./image-preprocess";
import type { ImageMatrix } from "./types";

export function clahe(gray: ImageMatrix): { matrix: ImageMatrix; contrast: number } {
  let min = 255;
  let max = 0;
  for (const value of gray.data) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }

  const spread = Math.max(1, max - min);
  const data = new Uint8ClampedArray(gray.data.length);
  const clipLow = min + spread * 0.02;
  const clipHigh = max - spread * 0.02;
  const clippedSpread = Math.max(1, clipHigh - clipLow);

  for (let index = 0; index < gray.data.length; index += 1) {
    const stretched = ((gray.data[index] - clipLow) / clippedSpread) * 255;
    data[index] = clamp((stretched - 128) * 1.24 + 128);
  }

  return {
    contrast: spread,
    matrix: { ...gray, data },
  };
}

export function gaussianBlur(gray: ImageMatrix): ImageMatrix {
  const { width, height, data } = gray;
  const output = new Uint8ClampedArray(data.length);
  const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky += 1) {
        for (let kx = -1; kx <= 1; kx += 1) {
          sum += data[(y + ky) * width + (x + kx)] * kernel[(ky + 1) * 3 + kx + 1];
        }
      }
      output[y * width + x] = Math.round(sum / 16);
    }
  }

  return { ...gray, data: output };
}

export function sharpen(gray: ImageMatrix): ImageMatrix {
  const { width, height, data } = gray;
  const output = new Uint8ClampedArray(data.length);
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky += 1) {
        for (let kx = -1; kx <= 1; kx += 1) {
          sum += data[(y + ky) * width + (x + kx)] * kernel[(ky + 1) * 3 + kx + 1];
        }
      }
      output[y * width + x] = clamp(sum);
    }
  }

  return { ...gray, data: output };
}

export function enhancePalmTexture(gray: ImageMatrix) {
  const equalized = clahe(gray);
  const blurred = gaussianBlur(equalized.matrix);
  const enhanced = sharpen(blurred);
  return {
    enhanced,
    contrast: equalized.contrast,
  };
}

