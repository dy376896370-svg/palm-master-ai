import type { PalmFeatureInput } from "../pattern-engine";

export type PalmFeatureSource = "vision" | "manual" | "fallback";

export type LineVisibility = "clear" | "unclear" | "not_sure";
export type LineLength = "long" | "medium" | "short" | "not_sure";
export type LineDepth = "deep" | "light" | "not_sure";
export type LineContinuity = "continuous" | "broken" | "forked" | "not_sure";
export type HeadLineDirection = "straight" | "curved" | "not_sure";
export type HeartLineDirection = "rising" | "drooping" | "flat" | "not_sure";
export type PalmShapeFeature =
  | "square"
  | "long"
  | "round"
  | "fire"
  | "water"
  | "earth"
  | "air"
  | "unclear";
export type ThumbFeature = "strong" | "weak" | "flexible" | "unclear";

export type ManualLineFeature = {
  visibility?: LineVisibility;
  length?: LineLength;
  depth?: LineDepth;
  continuity?: LineContinuity;
  direction?: HeadLineDirection | HeartLineDirection;
};

export type PalmManualFeatureInput = {
  lifeLine?: ManualLineFeature;
  headLine?: ManualLineFeature;
  heartLine?: ManualLineFeature;
  fateLine?: {
    visibility?: LineVisibility;
    depth?: LineDepth;
  };
  palmShape?: PalmShapeFeature;
  thumb?: ThumbFeature;
  mounts?: string[];
};

export type PalmFeatureObservation = {
  id: string;
  label: string;
  source: PalmFeatureSource;
  value: string;
  confidence: number;
  note: string;
};

export type PalmFeatureSet = {
  version: "2.0";
  inputSources: PalmFeatureSource[];
  features: PalmFeatureInput;
  manualInput: PalmManualFeatureInput;
  observations: PalmFeatureObservation[];
  reliability: {
    score: number;
    label: "high" | "medium" | "low";
    reasons: string[];
  };
};
