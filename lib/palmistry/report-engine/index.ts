import type { PalmFeatureSet } from "../feature-engine";
import type { PalmPattern } from "../pattern-engine";
import type { PalmPatternReportItem, PalmReportEngineContext } from "./types";

const confidenceByLevel: Record<PalmPattern["level"], number> = {
  strong: 0.86,
  balanced: 0.74,
  supportive: 0.66,
  caution: 0.52,
};

export function toPalmPatternReportItem(
  pattern: PalmPattern,
): PalmPatternReportItem {
  return {
    id: pattern.id,
    name: pattern.name,
    level: pattern.level,
    description: pattern.description,
    meaning: pattern.description,
    lines: pattern.lines,
    conditions: pattern.conditions,
    source: pattern.source,
    sourceType: pattern.source,
    confidence: confidenceByLevel[pattern.level],
    safetyNote: pattern.safetyNote,
  };
}

export function summarizePalmFeatures(featureSet: PalmFeatureSet) {
  const feature = featureSet.features;
  const readable = [
    `生命线=${feature.lifeLine}`,
    `智慧线=${feature.headLine}`,
    `感情线=${feature.heartLine}`,
    `事业线=${feature.fateLine}`,
    `手型=${feature.palmShape}`,
    feature.specialMarks.length
      ? `特殊观察=${feature.specialMarks.join("/")}`
      : "特殊观察=无明确输入",
  ];

  return `${readable.join("；")}。输入可靠度 ${featureSet.reliability.score}/100，来源：${featureSet.inputSources.join(" + ")}。`;
}

export function buildPalmReportEngineContext({
  featureSet,
  patterns,
}: {
  featureSet: PalmFeatureSet;
  patterns: PalmPattern[];
}): PalmReportEngineContext {
  const patternItems = patterns.map(toPalmPatternReportItem);

  return {
    featureSet,
    featureSummary: summarizePalmFeatures(featureSet),
    patternSummary: patternItems.length
      ? `识别到 ${patternItems.length} 个 Palm Pattern：${patternItems
          .slice(0, 5)
          .map((pattern) => pattern.name)
          .join("、")}。`
      : "没有识别到稳定 Palm Pattern，报告以通用知识和自我观察建议为主。",
    patternItems,
  };
}

export type { PalmPatternReportItem, PalmReportEngineContext };
