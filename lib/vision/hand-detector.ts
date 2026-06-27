import {
  FilesetResolver,
  HandLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import {
  canvasFromImageData,
  grayFromImageData,
  renderGrayMatrix,
} from "./image-preprocess";
import type {
  HandLandmarks,
  HandPose,
  ImageMatrix,
  NormalizedPalmImage,
  PalmRoi,
  VisionPoint,
} from "./types";

const NORMALIZED_SIZE = 512;
const MEDIAPIPE_VERSION = "0.10.35";
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

let landmarkerPromise: Promise<HandLandmarker> | null = null;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function toPoint(landmark: NormalizedLandmark): VisionPoint {
  return {
    x: clamp01(landmark.x),
    y: clamp01(landmark.y),
  };
}

async function getHandLandmarker() {
  landmarkerPromise ??= FilesetResolver.forVisionTasks(WASM_URL).then(
    async (vision) => {
      try {
        return await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: "GPU",
          },
          numHands: 1,
          runningMode: "IMAGE",
        });
      } catch {
        return HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: "CPU",
          },
          numHands: 1,
          runningMode: "IMAGE",
        });
      }
    },
  );

  return landmarkerPromise;
}

function detectBrightnessRoi(gray: ImageMatrix): PalmRoi {
  const { width, height, data } = gray;
  let sum = 0;
  for (const value of data) sum += value;
  const mean = sum / Math.max(1, data.length);
  const threshold = Math.max(28, Math.min(210, mean * 0.58));
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let count = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = data[y * width + x];
      if (value > threshold) {
        count += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const areaRatio = count / Math.max(1, width * height);
  if (areaRatio < 0.12 || minX >= maxX || minY >= maxY) {
    return {
      x: 0,
      y: 0,
      width,
      height,
      confidence: 0.18,
      method: "full-frame-fallback",
      rotationAngle: 0,
    };
  }

  const padX = Math.round((maxX - minX) * 0.08);
  const padY = Math.round((maxY - minY) * 0.08);
  const x = Math.max(0, minX - padX);
  const y = Math.max(0, minY - padY);
  const roiWidth = Math.min(width - x, maxX - minX + padX * 2);
  const roiHeight = Math.min(height - y, maxY - minY + padY * 2);

  return {
    x,
    y,
    width: roiWidth,
    height: roiHeight,
    confidence: Math.min(0.62, 0.28 + areaRatio),
    method: "foreground-bbox",
    rotationAngle: 0,
  };
}

function keyLandmarks(landmarks: NormalizedLandmark[]): HandLandmarks {
  return {
    wrist: toPoint(landmarks[0]),
    thumbBase: toPoint(landmarks[2]),
    indexMcp: toPoint(landmarks[5]),
    middleMcp: toPoint(landmarks[9]),
    ringMcp: toPoint(landmarks[13]),
    pinkyMcp: toPoint(landmarks[17]),
  };
}

function average(points: VisionPoint[]): VisionPoint {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function computeRotationAngle(points: HandLandmarks) {
  const dx = points.middleMcp.x - points.wrist.x;
  const dy = points.middleMcp.y - points.wrist.y;
  return Math.atan2(dy, dx) + Math.PI / 2;
}

function computePalmRoi({
  points,
  sourceWidth,
  sourceHeight,
  confidence,
  rotationAngle,
}: {
  points: HandLandmarks;
  sourceWidth: number;
  sourceHeight: number;
  confidence: number;
  rotationAngle: number;
}): PalmRoi {
  const roiPoints = [
    points.wrist,
    points.thumbBase,
    points.indexMcp,
    points.middleMcp,
    points.ringMcp,
    points.pinkyMcp,
  ];
  const xs = roiPoints.map((point) => point.x * sourceWidth);
  const ys = roiPoints.map((point) => point.y * sourceHeight);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;
  const pad = Math.max(width, height) * 0.45;
  const x = Math.max(0, minX - pad);
  const y = Math.max(0, minY - pad * 0.5);
  const roiWidth = Math.min(sourceWidth - x, width + pad * 2);
  const roiHeight = Math.min(sourceHeight - y, height + pad * 1.6);

  return {
    x,
    y,
    width: roiWidth,
    height: roiHeight,
    confidence,
    method: "mediapipe-landmarks",
    rotationAngle,
  };
}

function normalizePalm({
  source,
  roi,
  palmCenter,
}: {
  source: ImageData;
  roi: PalmRoi;
  palmCenter: VisionPoint;
}): NormalizedPalmImage {
  const sourceCanvas = canvasFromImageData(source);
  const canvas = document.createElement("canvas");
  canvas.width = NORMALIZED_SIZE;
  canvas.height = NORMALIZED_SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("当前浏览器不支持掌心归一化。");

  const centerX = palmCenter.x * source.width;
  const centerY = palmCenter.y * source.height;
  const cropSize = Math.max(roi.width, roi.height, 64);
  const scale = NORMALIZED_SIZE / cropSize;

  context.fillStyle = "#05080d";
  context.fillRect(0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE);
  context.translate(NORMALIZED_SIZE / 2, NORMALIZED_SIZE / 2);
  context.rotate(-roi.rotationAngle);
  context.scale(scale, scale);
  context.drawImage(sourceCanvas, -centerX, -centerY);

  const imageData = context.getImageData(0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE);
  const gray = grayFromImageData(imageData, NORMALIZED_SIZE, NORMALIZED_SIZE);

  return {
    width: NORMALIZED_SIZE,
    height: NORMALIZED_SIZE,
    imageData,
    gray,
    imageSrc: canvas.toDataURL("image/webp", 0.9),
    transform: {
      sourceWidth: source.width,
      sourceHeight: source.height,
      palmCenter,
      rotationAngle: roi.rotationAngle,
      roi,
    },
  };
}

export function renderLandmarksOverlay(
  source: ImageData,
  allLandmarks: VisionPoint[],
  roi: PalmRoi,
) {
  const canvas = canvasFromImageData(source);
  const context = canvas.getContext("2d");
  if (!context) return "";

  context.save();
  context.strokeStyle = "rgba(215,181,109,0.95)";
  context.lineWidth = Math.max(2, canvas.width * 0.004);
  context.strokeRect(roi.x, roi.y, roi.width, roi.height);

  for (const point of allLandmarks) {
    context.beginPath();
    context.fillStyle = "rgba(120,220,190,0.95)";
    context.arc(point.x * canvas.width, point.y * canvas.height, 4, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  return canvas.toDataURL("image/webp", 0.9);
}

export function renderRoiOverlay(source: ImageData, roi: PalmRoi) {
  const canvas = canvasFromImageData(source);
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.save();
  context.strokeStyle = "rgba(239,127,155,0.95)";
  context.lineWidth = Math.max(3, canvas.width * 0.006);
  context.setLineDash([12, 8]);
  context.strokeRect(roi.x, roi.y, roi.width, roi.height);
  context.restore();
  return canvas.toDataURL("image/webp", 0.9);
}

export async function detectHandPose(source: ImageData, gray: ImageMatrix): Promise<HandPose> {
  try {
    const landmarker = await getHandLandmarker();
    const sourceCanvas = canvasFromImageData(source);
    const result = landmarker.detect(sourceCanvas);
    const landmarks = result.landmarks[0];

    if (!landmarks?.length) {
      throw new Error("No hand landmarks");
    }

    const named = keyLandmarks(landmarks);
    const allLandmarks = landmarks.map(toPoint);
    const handednessCategory = result.handednesses[0]?.[0];
    const handedness =
      handednessCategory?.categoryName === "Left" ||
      handednessCategory?.categoryName === "Right"
        ? handednessCategory.categoryName
        : "unknown";
    const confidence = handednessCategory?.score ?? 0.86;
    const palmCenter = average([
      named.wrist,
      named.indexMcp,
      named.middleMcp,
      named.ringMcp,
      named.pinkyMcp,
    ]);
    const rotationAngle = computeRotationAngle(named);
    const roi = computePalmRoi({
      points: named,
      sourceWidth: source.width,
      sourceHeight: source.height,
      confidence,
      rotationAngle,
    });
    const normalizedPalm = normalizePalm({
      source,
      roi,
      palmCenter,
    });

    return {
      detected: true,
      handedness,
      confidence,
      landmarks: named,
      allLandmarks,
      palmCenter,
      rotationAngle,
      roi,
      normalizedPalm,
      failureReasons: [],
    };
  } catch {
    const roi = detectBrightnessRoi(gray);
    return {
      detected: false,
      handedness: "unknown",
      confidence: roi.confidence,
      landmarks: null,
      allLandmarks: [],
      palmCenter: null,
      rotationAngle: 0,
      roi,
      normalizedPalm: {
        width: gray.width,
        height: gray.height,
        imageData: new ImageData(gray.width, gray.height),
        gray,
        imageSrc: renderGrayMatrix(gray),
        transform: {
          sourceWidth: gray.width,
          sourceHeight: gray.height,
          palmCenter: { x: 0.5, y: 0.5 },
          rotationAngle: 0,
          roi,
        },
      },
      failureReasons: ["mediapipe_unavailable", "landmarks_missing"],
    };
  }
}
