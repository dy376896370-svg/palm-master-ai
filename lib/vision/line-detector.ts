import { clamp } from "./image-preprocess";
import type {
  FailureReason,
  ImageMatrix,
  PalmLineCandidate,
  VisionPoint,
} from "./types";

type Pixel = { x: number; y: number };

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
  const high = Math.max(44, average * 2.0);
  const low = high * 0.62;
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
  const output = new Uint8ClampedArray(data);

  // V3 deliberately avoids aggressive dilation: it was merging unrelated
  // palm, finger and background edges into ECG-like paths.
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (data[index] > 0) continue;
      const horizontal =
        data[y * width + x - 1] > 0 && data[y * width + x + 1] > 0;
      const vertical =
        data[(y - 1) * width + x] > 0 && data[(y + 1) * width + x] > 0;
      output[index] = horizontal || vertical ? 255 : 0;
    }
  }

  return { ...binary, data: output };
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

  while (changed && iterations < 16) {
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

function key(pixel: Pixel) {
  return `${pixel.x},${pixel.y}`;
}

function pixelIndex(pixel: Pixel, width: number) {
  return pixel.y * width + pixel.x;
}

function adjacentPixels(pixel: Pixel, componentSet: Set<string>) {
  const result: Pixel[] = [];
  for (let y = pixel.y - 1; y <= pixel.y + 1; y += 1) {
    for (let x = pixel.x - 1; x <= pixel.x + 1; x += 1) {
      if (x === pixel.x && y === pixel.y) continue;
      if (componentSet.has(`${x},${y}`)) result.push({ x, y });
    }
  }
  return result;
}

function traceFrom(start: Pixel, componentSet: Set<string>) {
  const queue = [start];
  const visited = new Set([key(start)]);
  const parent = new Map<string, string>();
  let farthest = start;

  while (queue.length) {
    const current = queue.shift();
    if (!current) break;
    farthest = current;
    for (const next of adjacentPixels(current, componentSet)) {
      const nextKey = key(next);
      if (visited.has(nextKey)) continue;
      visited.add(nextKey);
      parent.set(nextKey, key(current));
      queue.push(next);
    }
  }

  return { farthest, parent };
}

function longestOrderedPath(pixels: Pixel[]) {
  if (!pixels.length) return [];
  const componentSet = new Set(pixels.map(key));
  const endpoints = pixels.filter(
    (pixel) => adjacentPixels(pixel, componentSet).length <= 1,
  );
  const start = endpoints[0] ?? pixels[0];
  const first = traceFrom(start, componentSet).farthest;
  const secondTrace = traceFrom(first, componentSet);
  const pathKeys: string[] = [];
  let cursor = key(secondTrace.farthest);

  while (cursor) {
    pathKeys.push(cursor);
    const next = secondTrace.parent.get(cursor);
    if (!next) break;
    cursor = next;
  }

  return pathKeys
    .map((item) => {
      const [x, y] = item.split(",").map(Number);
      return { x, y };
    })
    .reverse();
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

function maxJump(points: VisionPoint[]) {
  let jump = 0;
  for (let index = 1; index < points.length; index += 1) {
    jump = Math.max(
      jump,
      Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y),
    );
  }
  return jump;
}

function averageAngle(points: VisionPoint[]) {
  if (points.length < 2) return 0;
  const first = points[0];
  const last = points[points.length - 1];
  return Math.atan2(last.y - first.y, last.x - first.x);
}

function sharpTurnStats(points: VisionPoint[]) {
  let turns = 0;
  let total = 0;
  for (let index = 2; index < points.length; index += 1) {
    const a = points[index - 2];
    const b = points[index - 1];
    const c = points[index];
    const angleA = Math.atan2(b.y - a.y, b.x - a.x);
    const angleB = Math.atan2(c.y - b.y, c.x - b.x);
    const diff = Math.abs(Math.atan2(Math.sin(angleB - angleA), Math.cos(angleB - angleA)));
    total += diff;
    if (diff > 1.2) turns += 1;
  }
  return {
    sharpTurns: turns,
    curvature: total / Math.max(1, points.length - 2),
    zigzag: turns / Math.max(1, points.length - 2),
  };
}

function regionFor(bbox: PalmLineCandidate["bbox"]): PalmLineCandidate["region"] {
  const centerX = bbox.x + bbox.width / 2;
  const centerY = bbox.y + bbox.height / 2;
  if (bbox.x < 0.04 || bbox.y < 0.04 || bbox.x + bbox.width > 0.96 || bbox.y + bbox.height > 0.96) {
    return "border-zone";
  }
  if (centerY < 0.2) return "finger-zone";
  if (centerX < 0.42 && centerY > 0.28) return "thumb-side";
  if (centerY < 0.38) return "upper-palm";
  if (centerY > 0.68) return "lower-palm";
  return "middle-palm";
}

function rejectionReasons({
  bbox,
  length,
  maxPathJump,
  sharpTurns,
  zigzag,
  angle,
}: {
  bbox: PalmLineCandidate["bbox"];
  length: number;
  maxPathJump: number;
  sharpTurns: number;
  zigzag: number;
  angle: number;
}): FailureReason[] {
  const reasons: FailureReason[] = [];
  const verticalness = Math.abs(Math.sin(angle));

  if (length < 0.045) reasons.push("too_short");
  if (length > 0.72) reasons.push("too_long");
  if (bbox.x < 0.05 || bbox.y < 0.05 || bbox.x + bbox.width > 0.95 || bbox.y + bbox.height > 0.96) {
    reasons.push("touches_image_border");
  }
  if (bbox.y < 0.18 && bbox.height > 0.18) reasons.push("crosses_fingers");
  if (bbox.y < 0.24 && verticalness > 0.78) reasons.push("crosses_fingers");
  if (bbox.width < 0.055 && bbox.height > 0.26) reasons.push("too_vertical_for_heart_or_head");
  if (maxPathJump > 0.075) reasons.push("jumps_too_large");
  if (sharpTurns > 5) reasons.push("too_many_sharp_turns");
  if (zigzag > 0.28) reasons.push("path_zigzag_too_high");
  return reasons;
}

function componentToCandidate({
  id,
  pixels,
  skeleton,
  edge,
}: {
  id: number;
  pixels: Pixel[];
  skeleton: ImageMatrix;
  edge: ImageMatrix;
}): PalmLineCandidate | null {
  if (pixels.length < 8) return null;

  const orderedPixels = longestOrderedPath(pixels);
  if (orderedPixels.length < 6) return null;
  const sampleStep = Math.max(1, Math.floor(orderedPixels.length / 34));
  const points = orderedPixels
    .filter((_, index) => index % sampleStep === 0)
    .slice(0, 40)
    .map((pixel) => ({
      x: pixel.x / skeleton.width,
      y: pixel.y / skeleton.height,
    }));

  if (points.length < 4) return null;

  const length = pathLength(points);
  const bbox = candidateBbox(points);
  const pathPixelSet = new Set(orderedPixels.map(key));
  const meanEdgeStrength =
    orderedPixels.reduce((sum, pixel) => sum + edge.data[pixelIndex(pixel, edge.width)], 0) /
    orderedPixels.length;
  const continuity = Math.min(1, orderedPixels.length / Math.max(1, pixels.length));
  const angle = averageAngle(points);
  const turnStats = sharpTurnStats(points);
  const maxPathJump = maxJump(points);
  const region = regionFor(bbox);
  const reasons = rejectionReasons({
    bbox,
    length,
    maxPathJump,
    sharpTurns: turnStats.sharpTurns,
    zigzag: turnStats.zigzag,
    angle,
  });
  if (pathPixelSet.size < pixels.length * 0.42) reasons.push("candidate_fragmented");

  return {
    id: `candidate-${id}`,
    points,
    bbox,
    length,
    continuity,
    curvature: Number(turnStats.curvature.toFixed(3)),
    averageAngle: Number(angle.toFixed(3)),
    meanEdgeStrength,
    edgeStrength: meanEdgeStrength,
    region,
    accepted: reasons.length === 0,
    reason: Array.from(new Set(reasons)),
    maxJump: Number(maxPathJump.toFixed(3)),
    sharpTurns: turnStats.sharpTurns,
    zigzag: Number(turnStats.zigzag.toFixed(3)),
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
      const pixels: Pixel[] = [];
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
    .sort((a, b) => Number(b.accepted) - Number(a.accepted) || b.length - a.length)
    .slice(0, 40);
}
