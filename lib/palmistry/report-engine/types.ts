import type { PalmFeatureSet } from "../feature-engine";
import type { PalmPattern } from "../pattern-engine";

export type PalmPatternReportItem = {
  id: string;
  name: string;
  level: PalmPattern["level"];
  description: string;
  meaning: string;
  lines: string[];
  conditions: PalmPattern["conditions"];
  source: PalmPattern["source"];
  sourceType: "palm-knowledge" | "canon-lab" | "rule-engine";
  confidence: number;
  safetyNote: string;
};

export type PalmReportEngineContext = {
  featureSet: PalmFeatureSet;
  featureSummary: string;
  patternSummary: string;
  patternItems: PalmPatternReportItem[];
};
