import type { PalmLineId } from "@/lib/report-schema";
import {
  buildConfidenceBreakdown,
  failureReasonsFromBreakdown,
  labelConfidence,
} from "./confidence";
import type {
  FailureReason,
  HandPose,
  PalmLineCandidate,
  PalmVisionLine,
  VisionLineId,
  VisionPoint,
} from "./types";

const MAIN_LINE_IDS: VisionLineId[] = [
  "life-line",
  "head-line",
  "heart-line",
];

const NON_PRIMARY_LINE_IDS: PalmLineId[] = [
  "fate-line",
  "wealth-line",
  "marriage-line",
];

function pathLength(path: VisionPoint[]) {
  let length = 0;
  for (let index = 1; index < path.length; index += 1) {
    length += Math.hypot(
      path[index].x - path[index - 1].x,
      path[index].y - path[index - 1].y,
    );
  }
  return length;
}

function centerOf(candidate: PalmLineCandidate) {
  return {
    x: candidate.bbox.x + candidate.bbox.width / 2,
    y: candidate.bbox.y + candidate.bbox.height / 2,
  };
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function angleScore(candidate: PalmLineCandidate, target: "horizontal" | "curved") {
  const verticalness = Math.abs(Math.sin(candidate.averageAngle));
  const horizontalness = Math.abs(Math.cos(candidate.averageAngle));
  if (target === "horizontal") return clamp01(horizontalness);
  return clamp01(0.45 + candidate.curvature * 1.4 - verticalness * 0.25);
}

function scoreCandidateForLine(id: VisionLineId, candidate: PalmLineCandidate) {
  const center = centerOf(candidate);
  const lengthScore = clamp01(candidate.length / 0.34);
  const edgeScore = clamp01(candidate.meanEdgeStrength / 105);
  const continuityScore = candidate.continuity;

  if (id === "life-line") {
    const sideScore = clamp01(1 - Math.abs(center.x - 0.34) / 0.24);
    const startZone = clamp01(1 - Math.abs(candidate.bbox.y - 0.28) / 0.32);
    const lowerReach = clamp01((candidate.bbox.y + candidate.bbox.height - 0.5) / 0.3);
    const curveScore = angleScore(candidate, "curved");
    const regionScore = candidate.region === "thumb-side" ? 1 : 0.45;
    return (
      sideScore * 0.22 +
      startZone * 0.12 +
      lowerReach * 0.18 +
      curveScore * 0.18 +
      regionScore * 0.12 +
      lengthScore * 0.1 +
      continuityScore * 0.05 +
      edgeScore * 0.03
    );
  }

  if (id === "head-line") {
    const midScore = clamp01(1 - Math.abs(center.y - 0.5) / 0.18);
    const spanScore = clamp01(candidate.bbox.width / 0.32);
    const horizontalScore = angleScore(candidate, "horizontal");
    const regionScore = candidate.region === "middle-palm" ? 1 : 0.5;
    const notVerticalPenalty = candidate.bbox.height > candidate.bbox.width * 1.25 ? 0.55 : 1;
    return (
      (midScore * 0.24 +
        spanScore * 0.22 +
        horizontalScore * 0.2 +
        regionScore * 0.12 +
        lengthScore * 0.1 +
        continuityScore * 0.08 +
        edgeScore * 0.04) *
      notVerticalPenalty
    );
  }

  const upperScore = clamp01(1 - Math.abs(center.y - 0.32) / 0.16);
  const spanScore = clamp01(candidate.bbox.width / 0.3);
  const horizontalScore = angleScore(candidate, "horizontal");
  const regionScore = candidate.region === "upper-palm" ? 1 : 0.5;
  const fingerPenalty = candidate.bbox.y < 0.2 ? 0.2 : 1;
  return (
    (upperScore * 0.28 +
      spanScore * 0.22 +
      horizontalScore * 0.2 +
      regionScore * 0.12 +
      lengthScore * 0.08 +
      continuityScore * 0.06 +
      edgeScore * 0.04) *
    fingerPenalty
  );
}

function lineSpecificReasons(id: VisionLineId, candidate: PalmLineCandidate | undefined) {
  const reasons: FailureReason[] = [];
  if (!candidate) return reasons;
  if ((id === "head-line" || id === "heart-line") && candidate.bbox.height > candidate.bbox.width * 1.3) {
    reasons.push("too_vertical_for_heart_or_head");
  }
  if (id === "heart-line" && candidate.bbox.y < 0.2) reasons.push("crosses_fingers");
  return reasons;
}

function pickBestCandidate(id: VisionLineId, candidates: PalmLineCandidate[]) {
  return candidates
    .filter((candidate) => candidate.accepted)
    .map((candidate) => ({
      candidate,
      score: scoreCandidateForLine(id, candidate),
    }))
    .sort((a, b) => b.score - a.score)[0];
}

function classifyMainLine({
  id,
  candidates,
  handPose,
  edgeStrength,
}: {
  id: VisionLineId;
  candidates: PalmLineCandidate[];
  handPose: HandPose;
  edgeStrength: number;
}): PalmVisionLine {
  const best = pickBestCandidate(id, candidates);
  const classification = best?.score ?? 0;
  const candidateReasons = [
    ...(best?.candidate.reason ?? []),
    ...lineSpecificReasons(id, best?.candidate),
  ];
  const breakdown = buildConfidenceBreakdown({
    roi: handPose.roi.confidence,
    landmarks: handPose.detected ? handPose.confidence : 0,
    edge: clamp01(edgeStrength / 58),
    classification,
    penaltyReasons: candidateReasons,
  });
  const hasCandidate = Boolean(best?.candidate);
  const detected = handPose.detected && hasCandidate && breakdown.final >= 0.55;
  const estimated =
    handPose.detected && hasCandidate && !detected && breakdown.final >= 0.35;
  const path = detected || estimated ? best?.candidate.points ?? [] : [];
  const failureReasons = [
    ...handPose.failureReasons,
    ...candidateReasons,
    ...failureReasonsFromBreakdown(breakdown),
  ];
  if (!hasCandidate) failureReasons.push("candidate_not_found");
  if (hasCandidate && !detected) failureReasons.push("candidate_fragmented");

  return {
    id,
    detected,
    confidence: breakdown.final,
    confidenceLabel: labelConfidence(breakdown.final),
    confidenceBreakdown: breakdown,
    failureReasons: Array.from(new Set(failureReasons)),
    visionStatus: detected ? "detected" : estimated ? "estimated" : "unavailable",
    detectionMethod: detected || estimated ? "landmarks-classical-cv" : "not-detected",
    path,
    width: detected ? Math.max(1, (best?.candidate.meanEdgeStrength ?? 0) / 35) : 0,
    length: pathLength(path),
    annotation: {
      type: "path",
      points: path,
    },
    metrics: {
      edgeScore: Math.round(best?.candidate.meanEdgeStrength ?? 0),
      skeletonHits: Math.round((best?.candidate.continuity ?? 0) * 10),
      templateDistance: Number((1 - classification).toFixed(3)),
      classificationScore: Number(classification.toFixed(3)),
    },
  };
}

function unavailableLine(id: PalmLineId, handPose: HandPose): PalmVisionLine {
  const breakdown = buildConfidenceBreakdown({
    roi: handPose.roi.confidence,
    landmarks: handPose.detected ? handPose.confidence : 0,
    edge: 0,
    classification: 0,
    penaltyReasons: ["candidate_not_found"],
  });

  return {
    id,
    detected: false,
    confidence: 0,
    confidenceLabel: "low",
    confidenceBreakdown: breakdown,
    failureReasons: Array.from(
      new Set([...handPose.failureReasons, "candidate_not_found"]),
    ),
    visionStatus: "unavailable",
    detectionMethod: "not-detected",
    path: [],
    width: 0,
    length: 0,
    annotation: { type: "path", points: [] },
    metrics: {
      edgeScore: 0,
      skeletonHits: 0,
      templateDistance: 1,
      classificationScore: 0,
    },
  };
}

export function classifyPalmLines({
  candidates,
  handPose,
  edgeStrength,
}: {
  candidates: PalmLineCandidate[];
  handPose: HandPose;
  edgeStrength: number;
}) {
  return [
    ...MAIN_LINE_IDS.map((id) =>
      classifyMainLine({
        id,
        candidates,
        handPose,
        edgeStrength,
      }),
    ),
    ...NON_PRIMARY_LINE_IDS.map((id) => unavailableLine(id, handPose)),
  ];
}
