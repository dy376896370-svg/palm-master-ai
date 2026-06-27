import type { ConfidenceBreakdown, ConfidenceLabel, FailureReason } from "./types";

export function labelConfidence(score: number): ConfidenceLabel {
  if (score >= 0.72) return "high";
  if (score >= 0.46) return "medium";
  return "low";
}

export function buildConfidenceBreakdown({
  roi,
  landmarks,
  edge,
  classification,
}: {
  roi: number;
  landmarks: number;
  edge: number;
  classification: number;
}): ConfidenceBreakdown {
  const final =
    roi * 0.25 +
    landmarks * 0.28 +
    edge * 0.18 +
    classification * 0.29;

  return {
    roi: Math.max(0, Math.min(1, roi)),
    landmarks: Math.max(0, Math.min(1, landmarks)),
    edge: Math.max(0, Math.min(1, edge)),
    classification: Math.max(0, Math.min(1, classification)),
    final: Math.max(0, Math.min(1, final)),
  };
}

export function failureReasonsFromBreakdown(
  breakdown: ConfidenceBreakdown,
): FailureReason[] {
  const reasons: FailureReason[] = [];
  if (breakdown.roi < 0.45) reasons.push("roi_unstable");
  if (breakdown.landmarks < 0.45) reasons.push("landmarks_missing");
  if (breakdown.edge < 0.35) reasons.push("low_contrast");
  if (breakdown.classification < 0.35) reasons.push("classification_score_low");
  return reasons;
}
