import type { PalmLineId } from "@/lib/report-schema";

export type VisionPoint = { x: number; y: number };

export type VisionLineId = Extract<
  PalmLineId,
  "life-line" | "head-line" | "heart-line"
>;

export type VisionStatus = "detected" | "estimated" | "unavailable";

export type DetectionMethod =
  | "landmarks-classical-cv"
  | "template-estimate"
  | "not-detected";

export type ConfidenceLabel = "low" | "medium" | "high";

export type FailureReason =
  | "image_blurry"
  | "palm_rotated"
  | "landmarks_missing"
  | "candidate_fragmented"
  | "low_contrast"
  | "roi_unstable"
  | "candidate_not_found"
  | "classification_score_low"
  | "mediapipe_unavailable";

export type ImageMatrix = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export type HandLandmarkName =
  | "wrist"
  | "thumbBase"
  | "indexMcp"
  | "middleMcp"
  | "ringMcp"
  | "pinkyMcp";

export type HandLandmarks = Record<HandLandmarkName, VisionPoint>;

export type PalmRoi = {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  method: "mediapipe-landmarks" | "foreground-bbox" | "full-frame-fallback";
  rotationAngle: number;
};

export type NormalizedPalmImage = {
  width: number;
  height: number;
  imageData: ImageData;
  gray: ImageMatrix;
  imageSrc: string;
  transform: {
    sourceWidth: number;
    sourceHeight: number;
    palmCenter: VisionPoint;
    rotationAngle: number;
    roi: PalmRoi;
  };
};

export type HandPose = {
  detected: boolean;
  handedness: "Left" | "Right" | "unknown";
  confidence: number;
  landmarks: HandLandmarks | null;
  allLandmarks: VisionPoint[];
  palmCenter: VisionPoint | null;
  rotationAngle: number;
  roi: PalmRoi;
  normalizedPalm: NormalizedPalmImage | null;
  failureReasons: FailureReason[];
};

export type PalmLineCandidate = {
  id: string;
  points: VisionPoint[];
  length: number;
  bbox: { x: number; y: number; width: number; height: number };
  continuity: number;
  meanEdgeStrength: number;
};

export type ConfidenceBreakdown = {
  roi: number;
  landmarks: number;
  edge: number;
  classification: number;
  final: number;
};

export type PalmVisionLine = {
  id: PalmLineId;
  detected: boolean;
  visionStatus: VisionStatus;
  detectionMethod: DetectionMethod;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  confidenceBreakdown: ConfidenceBreakdown;
  failureReasons: FailureReason[];
  path: VisionPoint[];
  width: number;
  length: number;
  annotation: {
    type: "path";
    points: VisionPoint[];
  };
  metrics: {
    edgeScore: number;
    skeletonHits: number;
    templateDistance: number;
    classificationScore: number;
  };
};

export type PalmVisionResult = {
  version: "palm-vision-assist-v2";
  imageQuality: {
    contrast: number;
    edgeStrength: number;
    roiConfidence: number;
    landmarksConfidence: number;
    accepted: boolean;
    failureReasons: FailureReason[];
  };
  hand: HandPose;
  roi: PalmRoi;
  artifacts: {
    originalImageSrc: string;
    landmarksImageSrc: string;
    roiImageSrc: string;
    normalizedImageSrc: string;
    enhancedImageSrc: string;
    edgeImageSrc: string;
    skeletonImageSrc: string;
    candidateImageSrc: string;
  };
  candidates: PalmLineCandidate[];
  lines: PalmVisionLine[];
  stages: string[];
};
