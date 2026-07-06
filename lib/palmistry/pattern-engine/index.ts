import type { PalmScoreKey } from "../profile/types";
import { palmPatterns } from "./patterns";
import type {
  PalmFeatureInput,
  PalmPatternEngineResult,
} from "./types";

const emptyScoreDeltas: Record<PalmScoreKey, number> = {
  personality: 0,
  career: 0,
  wealth: 0,
  relationship: 0,
  energy: 0,
};

export function detectPalmPatterns(
  features: PalmFeatureInput,
): PalmPatternEngineResult {
  const matchedPatterns = palmPatterns.filter((pattern) =>
    pattern.when(features),
  );
  const result: PalmPatternEngineResult = {
    matchedPatterns,
    scoreDeltas: { ...emptyScoreDeltas },
    discoveries: [],
    achievements: [],
    keywords: [],
    advice: [],
  };

  for (const pattern of matchedPatterns) {
    for (const [key, delta] of Object.entries(pattern.effects.scores ?? {})) {
      result.scoreDeltas[key as PalmScoreKey] += delta ?? 0;
    }

    result.discoveries.push(...(pattern.effects.discoveries ?? []));
    result.keywords.push(...(pattern.effects.keywords ?? []));
    result.advice.push(...(pattern.effects.advice ?? []));

    for (const achievement of pattern.effects.achievements ?? []) {
      if (!result.achievements.some((item) => item.name === achievement.name)) {
        result.achievements.push(achievement);
      }
    }
  }

  return result;
}

export { palmPatterns };
export type {
  PalmFeatureInput,
  PalmPattern,
  PalmPatternCondition,
  PalmPatternEffect,
  PalmPatternEngineResult,
  PalmPatternLevel,
} from "./types";
