import type { PalmLineId } from "@/lib/report-schema";
import {
  buildConfidenceBreakdown,
  failureReasonsFromBreakdown,
  labelConfidence,
} from "./confidence";
import type {
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

const TEMPLATES: Record<VisionLineId, VisionPoint[]> = {
  "life-line": [
    { x: 0.42, y: 0.28 },
    { x: 0.35, y: 0.38 },
    { x: 0.29, y: 0.55 },
    { x: 0.34, y: 0.73 },
    { x: 0.48, y: 0.88 },
  ],
  "head-line": [
    { x: 0.35, y: 0.43 },
    { x: 0.48, y: 0.47 },
    { x: 0.62, y: 0.51 },
    { x: 0.78, y: 0.56 },
  ],
  "heart-line": [
    { x: 0.30, y: 0.31 },
    { x: 0.45, y: 0.28 },
    { x: 0.62, y: 0.29 },
    { x: 0.82, y: 0.35 },
  ],
};

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

function scoreCandidateForLine(id: VisionLineId, candidate: PalmLineCandidate) {
  const center = centerOf(candidate);
  const horizontal = candidate.bbox.width / Math.max(0.01, candidate.bbox.height);
  const vertical = candidate.bbox.height / Math.max(0.01, candidate.bbox.width);
  const lengthScore = clamp01(candidate.length / 0.32);
  const edgeScore = clamp01(candidate.meanEdgeStrength / 95);
  const continuityScore = candidate.continuity;

  if (id === "life-line") {
    const sideScore = clamp01(1 - Math.abs(center.x - 0.34) / 0.28);
    const lowerReach = clamp01((candidate.bbox.y + candidate.bbox.height - 0.52) / 0.28);
    const curveShape = clamp01(vertical / 1.45);
    return (
      sideScore * 0.24 +
      lowerReach * 0.2 +
      curveShape * 0.18 +
      lengthScore * 0.17 +
      continuityScore * 0.13 +
      edgeScore * 0.08
    );
  }

  if (id === "head-line") {
    const midScore = clamp01(1 - Math.abs(center.y - 0.49) / 0.2);
    const spanScore = clamp01(candidate.bbox.width / 0.38);
    const horizontalScore = clamp01(horizontal / 2.1);
    return (
      midScore * 0.25 +
      spanScore * 0.24 +
      horizontalScore * 0.18 +
      lengthScore * 0.15 +
      continuityScore * 0.1 +
      edgeScore * 0.08
    );
  }

  const upperScore = clamp01(1 - Math.abs(center.y - 0.31) / 0.18);
  const spanScore = clamp01(candidate.bbox.width / 0.36);
  const horizontalScore = clamp01(horizontal / 2.0);
  return (
    upperScore * 0.28 +
    spanScore * 0.24 +
    horizontalScore * 0.18 +
    lengthScore * 0.12 +
    continuityScore * 0.1 +
    edgeScore * 0.08
  );
}

function pickBestCandidate(id: VisionLineId, candidates: PalmLineCandidate[]) {
  return candidates
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
  const breakdown = buildConfidenceBreakdown({
    roi: handPose.roi.confidence,
    landmarks: handPose.detected ? handPose.confidence : 0,
    edge: clamp01(edgeStrength / 55),
    classification,
  });
  const hasCandidate = Boolean(best?.candidate);
  const detected = handPose.detected && hasCandidate && breakdown.final >= 0.52;
  const estimated =
    handPose.detected && hasCandidate && !detected && breakdown.final >= 0.34;
  const path = detected ? best?.candidate.points ?? [] : estimated ? TEMPLATES[id] : [];
  const failureReasons = [
    ...handPose.failureReasons,
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
    detectionMethod: detected
      ? "landmarks-classical-cv"
      : estimated
        ? "template-estimate"
        : "not-detected",
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
