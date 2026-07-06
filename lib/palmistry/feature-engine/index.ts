import type { PalmLineId } from "@/lib/report-schema";
import type { PalmFeatureInput } from "../pattern-engine";
import type {
  ManualLineFeature,
  PalmFeatureObservation,
  PalmFeatureSet,
  PalmManualFeatureInput,
} from "./types";

type VisionLineLike = {
  id: PalmLineId;
  confidence?: "low" | "medium" | "high";
  visionConfidence: number;
  visionStatus: "detected" | "estimated" | "unavailable";
  failureReasons: string[];
  annotation: {
    points: Array<{ x: number; y: number }>;
  };
};

const baseFeatures: PalmFeatureInput = {
  lifeLine: "unclear",
  headLine: "unclear",
  heartLine: "unclear",
  fateLine: "absent",
  palmShape: "unclear",
  sunLine: "unclear",
  specialMarks: [],
};

function hasManualSignal(line?: ManualLineFeature) {
  if (!line) return false;
  return Object.values(line).some((value) => value && value !== "not_sure");
}

function observation(
  id: string,
  label: string,
  source: PalmFeatureObservation["source"],
  value: string,
  confidence: number,
  note: string,
): PalmFeatureObservation {
  return { id, label, source, value, confidence, note };
}

function confidenceFromVision(line?: VisionLineLike) {
  if (!line || line.visionStatus === "unavailable") return 0.24;
  if (line.visionStatus === "estimated") return Math.min(0.56, line.visionConfidence);
  return Math.max(0.52, line.visionConfidence);
}

function mapLifeLine(line?: VisionLineLike): PalmFeatureInput["lifeLine"] {
  if (!line || line.visionStatus === "unavailable") return "unclear";
  if (line.visionConfidence >= 0.72) return "long";
  if (line.visionConfidence <= 0.42) return "short";
  return "medium";
}

function mapHeadLine(line?: VisionLineLike): PalmFeatureInput["headLine"] {
  if (!line || line.visionStatus === "unavailable") return "unclear";
  const first = line.annotation.points[0];
  const last = line.annotation.points.at(-1);

  if (first && last && Math.abs(last.y - first.y) > 0.1) {
    return "curved";
  }

  return "straight";
}

function mapHeartLine(line?: VisionLineLike): PalmFeatureInput["heartLine"] {
  if (!line || line.visionStatus === "unavailable") return "unclear";
  if (line.failureReasons.includes("candidate_fragmented")) return "forked";
  return line.visionConfidence >= 0.68 ? "deep" : "light";
}

function mapPalmShape(shape?: PalmManualFeatureInput["palmShape"]) {
  if (shape === "square" || shape === "earth") return "square";
  if (shape === "long" || shape === "water" || shape === "air") return "long";
  if (shape === "round" || shape === "fire") return "round";
  return "unclear";
}

function applyManualLineFeatures(
  features: PalmFeatureInput,
  manual: PalmManualFeatureInput,
) {
  if (hasManualSignal(manual.lifeLine)) {
    if (manual.lifeLine?.visibility === "unclear") {
      features.lifeLine = "unclear";
    } else if (manual.lifeLine?.length && manual.lifeLine.length !== "not_sure") {
      features.lifeLine = manual.lifeLine.length;
    } else if (manual.lifeLine?.depth === "deep") {
      features.lifeLine = "long";
    } else if (manual.lifeLine?.depth === "light") {
      features.lifeLine = "medium";
    }
  }

  if (hasManualSignal(manual.headLine)) {
    if (manual.headLine?.visibility === "unclear") {
      features.headLine = "unclear";
    } else if (manual.headLine?.direction === "straight") {
      features.headLine = "straight";
    } else if (manual.headLine?.direction === "curved") {
      features.headLine = "curved";
    }
  }

  if (hasManualSignal(manual.heartLine)) {
    if (manual.heartLine?.visibility === "unclear") {
      features.heartLine = "unclear";
    } else if (manual.heartLine?.continuity === "forked") {
      features.heartLine = "forked";
    } else if (manual.heartLine?.depth === "deep") {
      features.heartLine = "deep";
    } else if (manual.heartLine?.depth === "light") {
      features.heartLine = "light";
    }
  }

  if (manual.fateLine?.visibility === "clear") {
    features.fateLine = manual.fateLine.depth === "deep" ? "strong" : "weak";
  } else if (manual.fateLine?.visibility === "unclear") {
    features.fateLine = "absent";
  }

  features.palmShape = mapPalmShape(manual.palmShape);

  const marks = new Set(features.specialMarks);
  if (manual.heartLine?.continuity === "forked") marks.add("fork");
  if (manual.lifeLine?.continuity === "broken") marks.add("island");
  if (manual.thumb === "strong" || manual.thumb === "flexible") {
    marks.add(`thumb_${manual.thumb}`);
  }
  for (const mount of manual.mounts ?? []) marks.add(mount);
  features.specialMarks = Array.from(marks).filter(Boolean);
}

function manualObservations(
  manual: PalmManualFeatureInput,
): PalmFeatureObservation[] {
  const observations: PalmFeatureObservation[] = [];

  if (hasManualSignal(manual.lifeLine)) {
    observations.push(
      observation(
        "manual-life-line",
        "生命线可见特征",
        "manual",
        [
          manual.lifeLine?.visibility,
          manual.lifeLine?.length,
          manual.lifeLine?.depth,
          manual.lifeLine?.continuity,
        ]
          .filter((item) => item && item !== "not_sure")
          .join(" / "),
        0.82,
        "来自用户对照片可见现象的结构化选择。",
      ),
    );
  }

  if (hasManualSignal(manual.headLine)) {
    observations.push(
      observation(
        "manual-head-line",
        "智慧线可见特征",
        "manual",
        [manual.headLine?.visibility, manual.headLine?.direction]
          .filter((item) => item && item !== "not_sure")
          .join(" / "),
        0.82,
        "来自用户对照片可见现象的结构化选择。",
      ),
    );
  }

  if (hasManualSignal(manual.heartLine)) {
    observations.push(
      observation(
        "manual-heart-line",
        "感情线可见特征",
        "manual",
        [
          manual.heartLine?.visibility,
          manual.heartLine?.depth,
          manual.heartLine?.continuity,
        ]
          .filter((item) => item && item !== "not_sure")
          .join(" / "),
        0.82,
        "来自用户对照片可见现象的结构化选择。",
      ),
    );
  }

  if (manual.palmShape && manual.palmShape !== "unclear") {
    observations.push(
      observation(
        "manual-palm-shape",
        "手型",
        "manual",
        manual.palmShape,
        0.76,
        "手型由用户按可见轮廓选择，作为 Profile 的辅助维度。",
      ),
    );
  }

  if (manual.thumb && manual.thumb !== "unclear") {
    observations.push(
      observation(
        "manual-thumb",
        "拇指",
        "manual",
        manual.thumb,
        0.72,
        "拇指特征只作为行动风格的娱乐化参考。",
      ),
    );
  }

  return observations;
}

export function buildPalmFeatureSet({
  visionLines,
  manualInput = {},
}: {
  visionLines: VisionLineLike[];
  manualInput?: PalmManualFeatureInput;
}): PalmFeatureSet {
  const visionMap = new Map(visionLines.map((line) => [line.id, line]));
  const features: PalmFeatureInput = {
    ...baseFeatures,
    lifeLine: mapLifeLine(visionMap.get("life-line")),
    headLine: mapHeadLine(visionMap.get("head-line")),
    heartLine: mapHeartLine(visionMap.get("heart-line")),
    fateLine:
      confidenceFromVision(visionMap.get("fate-line")) >= 0.68
        ? "strong"
        : "absent",
    specialMarks: [
      visionMap.get("heart-line")?.failureReasons.includes("candidate_fragmented")
        ? "fork"
        : "",
      visionMap.get("life-line")?.failureReasons.includes("candidate_fragmented")
        ? "island"
        : "",
    ].filter(Boolean),
  };

  applyManualLineFeatures(features, manualInput);

  const visionObservations = visionLines.slice(0, 6).map((line) =>
    observation(
      `vision-${line.id}`,
      line.id,
      "vision",
      `${line.visionStatus} / ${Math.round(line.visionConfidence * 100)}%`,
      confidenceFromVision(line),
      line.visionStatus === "unavailable"
        ? "自动视觉未稳定判断，低权重进入 Feature Engine。"
        : "来自前端 Palm Vision Assist 的辅助观察。",
    ),
  );
  const observations = [...manualObservations(manualInput), ...visionObservations];
  const manualCount = observations.filter((item) => item.source === "manual").length;
  const averageConfidence =
    observations.reduce((sum, item) => sum + item.confidence, 0) /
    Math.max(1, observations.length);
  const score = Math.round(
    Math.min(96, Math.max(35, averageConfidence * 100 + manualCount * 5)),
  );

  return {
    version: "2.0",
    inputSources: [
      ...(visionLines.length ? (["vision"] as const) : []),
      ...(manualCount ? (["manual"] as const) : []),
      ...(visionLines.length || manualCount ? [] : (["fallback"] as const)),
    ],
    features,
    manualInput,
    observations,
    reliability: {
      score,
      label: score >= 76 ? "high" : score >= 55 ? "medium" : "low",
      reasons: [
        manualCount
          ? "已结合用户结构化选择，减少自动识别不准的影响。"
          : "未填写手动特征，主要依赖照片质量和视觉辅助观察。",
        score < 55
          ? "建议补充手动特征或重拍清晰照片。"
          : "当前输入可用于生成稳定的娱乐文化报告。",
      ],
    },
  };
}

export type {
  PalmFeatureObservation,
  PalmFeatureSet,
  PalmManualFeatureInput,
} from "./types";
