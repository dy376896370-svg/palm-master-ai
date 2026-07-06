import type { PalmAchievement, PalmDiscovery, PalmScoreKey } from "../profile/types";

export type PalmFeatureInput = {
  lifeLine: "short" | "medium" | "long" | "unclear";
  headLine: "straight" | "curved" | "unclear";
  heartLine: "deep" | "light" | "forked" | "unclear";
  fateLine: "strong" | "weak" | "absent" | "unclear";
  palmShape: "square" | "long" | "round" | "unclear";
  sunLine: "visible" | "unclear";
  specialMarks: string[];
};

export type PalmPatternLevel =
  | "strong"
  | "balanced"
  | "supportive"
  | "caution";

export type PalmPatternCondition = {
  required: string[];
  bonus?: string[];
  caution?: string[];
};

export type PalmPatternEffect = {
  scores?: Partial<Record<PalmScoreKey, number>>;
  keywords?: string[];
  achievements?: PalmAchievement[];
  discoveries?: PalmDiscovery[];
  advice?: string[];
};

export type PalmPattern = {
  id: string;
  name: string;
  level: PalmPatternLevel;
  description: string;
  lines: string[];
  conditions: PalmPatternCondition;
  source: "palm-knowledge" | "canon-lab" | "rule-engine";
  safetyNote: string;
  when: (features: PalmFeatureInput) => boolean;
  effects: PalmPatternEffect;
};

export type PalmPatternEngineResult = {
  matchedPatterns: PalmPattern[];
  scoreDeltas: Record<PalmScoreKey, number>;
  discoveries: PalmDiscovery[];
  achievements: PalmAchievement[];
  keywords: string[];
  advice: string[];
};
