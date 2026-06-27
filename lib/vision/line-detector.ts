import { clamp } from "./image-preprocess";
import type { ImageMatrix, PalmLineCandidate, VisionPoint } from "./types";

export function cannyEdges(gray: ImageMatrix) {
  const { width, height, data } = gray;
  const magnitude = new Uint8ClampedArray(data.length);
  let total = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const a = data[(y - 1) * width + x - 1];
      const b = data[(y - 1) * width + x];
      const c = data[(y - 1) * width + x + 1];
      const d = data[y * width + x - 1];
      const f = data[y * width + x + 1];
      const g = data[(y + 1) * width + x - 1];
      const h = data[(y + 1) * width + x];
      const i = data[(y + 1) * width + x + 1];
      const gx = -a + c - 2 * d + 2 * f - g + i;
      const gy = -a - 2 * b - c + g + 2 * h + i;
      const value = clamp(Math.sqrt(gx * gx + gy * gy));
      magnitude[y * width + x] = value;
      total += value;
    }
  }

  const average = total / Math.max(1, (width - 2) * (height - 2));
  const high = Math.max(36, average * 1.7);
  const low = high * 0.48;
  const binary = new Uint8ClampedArray(data.length);

  for (let index = 0; index < magnitude.length; index += 1) {
    binary[index] = magnitude[index] >= low ? 255 : 0;
  }

  return {
    edgeStrength: average,
    magnitude: { ...gray, data: magnitude },
    binary: { ...gray, data: binary },
  };
}

export function morphologyClose(binary: ImageMatrix): ImageMatrix {
  const { width, height, data } = binary;
  const dilated = new Uint8ClampedArray(data.length);
  const closed = new Uint8ClampedArray(data.length);

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      let on = false;
      for (let ky = -1; ky <= 1; ky += 1) {
        for (let kx = -1; kx <= 1; kx += 1) {
          on ||= data[(y + ky) * width + x + kx] > 0;
        }
      }
      dilated[y * width + x] = on ? 255 : 0;
    }
  }

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      let on = true;
      for (let ky = -1; ky <= 1; ky += 1) {
        for (let kx = -1; kx <= 1; kx += 1) {
          on &&= dilated[(y + ky) * width + x + kx] > 0;
        }
      }
      closed[y * width + x] = on ? 255 : 0;
    }
  }

  return { ...binary, data: closed };
}

function neighbours(data: Uint8ClampedArray, width: number, x: number, y: number) {
  return [
    data[(y - 1) * width + x] > 0,
    data[(y - 1) * width + x + 1] > 0,
    data[y * width + x + 1] > 0,
    data[(y + 1) * width + x + 1] > 0,
    data[(y + 1) * width + x] > 0,
    data[(y + 1) * width + x - 1] > 0,
    data[y * width + x - 1] > 0,
    data[(y - 1) * width + x - 1] > 0,
  ];
}

export function skeletonize(binary: ImageMatrix): ImageMatrix {
  const { width, height } = binary;
  const data = new Uint8ClampedArray(binary.data);
  let changed = true;
  let iterations = 0;

  while (changed && iterations < 18) {
    changed = false;
    iterations += 1;

    for (const phase of [0, 1]) {
      const remove: number[] = [];
      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          const index = y * width + x;
          if (data[index] === 0) continue;
          const n = neighbours(data, width, x, y);
          const count = n.filter(Boolean).length;
          const transitions = n.reduce((sum, current, currentIndex) => {
            const next = n[(currentIndex + 1) % n.length];
            return sum + (!current && next ? 1 : 0);
          }, 0);
          const conditionA = phase === 0 ? !(n[0] && n[2] && n[4]) : !(n[0] && n[2] && n[6]);
          const conditionB = phase === 0 ? !(n[2] && n[4] && n[6]) : !(n[0] && n[4] && n[6]);
          if (count >= 2 && count <= 6 && transitions === 1 && conditionA && conditionB) {
            remove.push(index);
          }
        }
      }

      if (remove.length) changed = true;
      for (const index of remove) data[index] = 0;
    }
  }

  return { ...binary, data };
}

function candidateBbox(points: VisionPoint[]) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function pathLength(points: VisionPoint[]) {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += Math.hypot(
      points[index].x - points[index - 1].x,
      points[index].y - points[index - 1].y,
    );
  }
  return length;
}

function componentToCandidate({
  id,
  pixels,
  skeleton,
  edge,
}: {
  id: number;
  pixels: Array<{ x: number; y: number }>;
  skeleton: ImageMatrix;
  edge: ImageMatrix;
}): PalmLineCandidate | null {
  if (pixels.length < 18) return null;

  const sorted = [...pixels].sort((a, b) => a.x - b.x || a.y - b.y);
  const points = sorted
    .filter((_, index) => index % Math.max(1, Math.floor(sorted.length / 28)) === 0)
    .slice(0, 32)
    .map((pixel) => ({
      x: pixel.x / skeleton.width,
      y: pixel.y / skeleton.height,
    }));

  if (points.length < 3) return null;

  const meanEdgeStrength =
    pixels.reduce((sum, pixel) => sum + edge.data[pixel.y * edge.width + pixel.x], 0) /
    pixels.length;
  const length = pathLength(points);
  const bbox = candidateBbox(points);
  const continuity = Math.min(1, pixels.length / Math.max(24, length * 1200));

  return {
    id: `candidate-${id}`,
    points,
    length,
    bbox,
    continuity,
    meanEdgeStrength,
  };
}

export function extractLineCandidates(
  skeleton: ImageMatrix,
  edge: ImageMatrix,
): PalmLineCandidate[] {
  const visited = new Uint8Array(skeleton.data.length);
  const candidates: PalmLineCandidate[] = [];
  let candidateId = 0;

  for (let y = 1; y < skeleton.height - 1; y += 1) {
    for (let x = 1; x < skeleton.width - 1; x += 1) {
      const start = y * skeleton.width + x;
      if (visited[start] || skeleton.data[start] === 0) continue;

      const queue = [{ x, y }];
      const pixels: Array<{ x: number; y: number }> = [];
      visited[start] = 1;

      while (queue.length) {
        const current = queue.shift();
        if (!current) break;
        pixels.push(current);

        for (let ky = -1; ky <= 1; ky += 1) {
          for (let kx = -1; kx <= 1; kx += 1) {
            if (kx === 0 && ky === 0) continue;
            const nx = current.x + kx;
            const ny = current.y + ky;
            if (nx < 1 || ny < 1 || nx >= skeleton.width - 1 || ny >= skeleton.height - 1) {
              continue;
            }
            const next = ny * skeleton.width + nx;
            if (!visited[next] && skeleton.data[next] > 0) {
              visited[next] = 1;
              queue.push({ x: nx, y: ny });
            }
          }
        }
      }

      const candidate = componentToCandidate({
        id: candidateId,
        pixels,
        skeleton,
        edge,
      });
      candidateId += 1;
      if (candidate) candidates.push(candidate);
    }
  }

  return candidates
    .filter((candidate) => candidate.length > 0.035)
    .sort((a, b) => b.length - a.length)
    .slice(0, 18);
}
