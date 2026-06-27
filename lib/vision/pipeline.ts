import {
  detectHandPose,
  renderLandmarksOverlay,
  renderRoiOverlay,
} from "./hand-detector";
import {
  canvasFromImageData,
  drawPolyline,
  grayFromImageData,
  loadImageMatrix,
  renderGrayMatrix,
} from "./image-preprocess";
import {
  cannyEdges,
  extractLineCandidates,
  morphologyClose,
  skeletonize,
} from "./line-detector";
import { classifyPalmLines } from "./line-classifier";
import { enhancePalmTexture } from "./palm-enhancer";
import type {
  NormalizedPalmImage,
  PalmLineCandidate,
  PalmVisionLine,
  PalmVisionResult,
  VisionPoint,
} from "./types";

function mapNormalizedPointToSource(
  point: VisionPoint,
  normalized: NormalizedPalmImage,
): VisionPoint {
  const { palmCenter, sourceWidth, sourceHeight, rotationAngle, roi } =
    normalized.transform;
  const cropSize = Math.max(roi.width, roi.height, 64);
  const dx = (point.x - 0.5) * cropSize;
  const dy = (point.y - 0.5) * cropSize;
  const cos = Math.cos(rotationAngle);
  const sin = Math.sin(rotationAngle);
  const sourceX = palmCenter.x * sourceWidth + dx * cos - dy * sin;
  const sourceY = palmCenter.y * sourceHeight + dx * sin + dy * cos;

  return {
    x: Math.min(1, Math.max(0, sourceX / sourceWidth)),
    y: Math.min(1, Math.max(0, sourceY / sourceHeight)),
  };
}

function mapLineToSource(
  line: PalmVisionLine,
  normalized: NormalizedPalmImage,
): PalmVisionLine {
  const sourcePath = line.path.map((point) =>
    mapNormalizedPointToSource(point, normalized),
  );

  return {
    ...line,
    path: sourcePath,
    annotation: {
      type: "path",
      points: sourcePath,
    },
  };
}

function renderCandidatesOverlay(
  normalized: NormalizedPalmImage,
  candidates: PalmLineCandidate[],
) {
  const canvas = canvasFromImageData(normalized.imageData);
  const context = canvas.getContext("2d");
  if (!context) return normalized.imageSrc;

  const colors = ["#d7b56d", "#64c7d4", "#ef7f9b", "#76d39b", "#b49af3"];
  candidates.slice(0, 10).forEach((candidate, index) => {
    drawPolyline(
      context,
      candidate.points,
      canvas.width,
      canvas.height,
      colors[index % colors.length],
      index > 2,
    );
  });

  return canvas.toDataURL("image/webp", 0.9);
}

export async function runPalmVisionPipeline(
  imageSrc: string,
): Promise<PalmVisionResult> {
  const source = await loadImageMatrix(imageSrc);
  const sourceGray = grayFromImageData(source.rgba, source.width, source.height);
  const handPose = await detectHandPose(source.rgba, sourceGray);
  const normalized = handPose.normalizedPalm;

  if (!normalized) {
    throw new Error("Palm normalization failed");
  }

  const { enhanced, contrast } = enhancePalmTexture(normalized.gray);
  const canny = cannyEdges(enhanced);
  const morphology = morphologyClose(canny.binary);
  const skeleton = skeletonize(morphology);
  const candidates = extractLineCandidates(skeleton, canny.magnitude);
  const normalizedLines = classifyPalmLines({
    candidates,
    handPose,
    edgeStrength: canny.edgeStrength,
  });
  const lines = normalizedLines.map((line) => mapLineToSource(line, normalized));
  const imageFailures = [
    ...handPose.failureReasons,
    ...(contrast < 32 ? ["low_contrast" as const] : []),
    ...(canny.edgeStrength < 8 ? ["image_blurry" as const] : []),
  ];

  return {
    version: "palm-vision-assist-v2",
    imageQuality: {
      contrast: Math.round(contrast),
      edgeStrength: Math.round(canny.edgeStrength),
      roiConfidence: Number(handPose.roi.confidence.toFixed(2)),
      landmarksConfidence: Number(handPose.confidence.toFixed(2)),
      accepted:
        handPose.roi.confidence >= 0.2 &&
        canny.edgeStrength >= 8 &&
        !imageFailures.includes("landmarks_missing"),
      failureReasons: Array.from(new Set(imageFailures)),
    },
    hand: handPose,
    roi: handPose.roi,
    artifacts: {
      originalImageSrc: source.imageSrc,
      landmarksImageSrc: renderLandmarksOverlay(
        source.rgba,
        handPose.allLandmarks,
        handPose.roi,
      ),
      roiImageSrc: renderRoiOverlay(source.rgba, handPose.roi),
      normalizedImageSrc: normalized.imageSrc,
      enhancedImageSrc: renderGrayMatrix(enhanced, (value, index) => {
        const edge = canny.magnitude.data[index] * 0.42;
        const boosted = Math.min(255, value + edge);
        return [boosted, boosted, boosted];
      }),
      edgeImageSrc: renderGrayMatrix(canny.binary, (value) =>
        value > 0 ? [227, 190, 107] : [8, 12, 18],
      ),
      skeletonImageSrc: renderGrayMatrix(skeleton, (value) =>
        value > 0 ? [120, 220, 190] : [8, 12, 18],
      ),
      candidateImageSrc: renderCandidatesOverlay(normalized, candidates),
    },
    candidates,
    lines,
    stages: [
      "read-image",
      "mediapipe-hand-landmarks",
      "palm-roi",
      "normalize-palm",
      "clahe",
      "gaussian",
      "sharpen",
      "canny",
      "morphology",
      "skeleton",
      "candidate-lines",
      "classify-life-head-heart",
      "confidence-breakdown",
    ],
  };
}
