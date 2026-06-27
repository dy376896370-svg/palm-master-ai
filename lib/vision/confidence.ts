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
  penaltyReasons = [],
}: {
  roi: number;
  landmarks: number;
  edge: number;
  classification: number;
  penaltyReasons?: FailureReason[];
}): ConfidenceBreakdown {
  const rawFinal =
    roi * 0.25 +
    landmarks * 0.28 +
    edge * 0.18 +
    classification * 0.29;
  const severe = penaltyReasons.some((reason) =>
    [
      "path_zigzag_too_high",
      "crosses_fingers",
      "jumps_too_large",
      "outside_palm_roi",
      "touches_image_border",
      "too_many_sharp_turns",
    ].includes(reason),
  );
  const moderate = penaltyReasons.some((reason) =>
    [
      "too_vertical_for_heart_or_head",
      "candidate_fragmented",
      "too_long",
      "too_short",
    ].includes(reason),
  );
  const cappedFinal = severe
    ? Math.min(rawFinal, 0.35)
    : moderate
      ? Math.min(rawFinal, 0.5)
      : rawFinal;

  return {
    roi: Math.max(0, Math.min(1, roi)),
    landmarks: Math.max(0, Math.min(1, landmarks)),
    edge: Math.max(0, Math.min(1, edge)),
    classification: Math.max(0, Math.min(1, classification)),
    final: Math.max(0, Math.min(1, cappedFinal)),
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
