"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Aperture,
  Eye,
  Fingerprint,
  Image as ImageIcon,
  ScanLine,
  Waypoints,
} from "lucide-react";
import type { PalmLine, PalmLineId } from "@/lib/report-schema";
import { runPalmVisionPipeline } from "@/lib/vision/pipeline";
import type {
  PalmVisionLine,
  PalmVisionResult,
} from "@/lib/vision/types";
import { PalmAnnotation } from "./palm-annotation";

export type { PalmVisionLine, PalmVisionResult };

const PRIMARY_LINE_IDS = new Set<PalmLineId>([
  "life-line",
  "head-line",
  "heart-line",
]);

const LINE_LABELS: Record<PalmLineId, PalmLine["name"]> = {
  "life-line": "生命线",
  "head-line": "智慧线",
  "heart-line": "感情线",
  "fate-line": "事业线",
  "wealth-line": "财运线",
  "marriage-line": "婚姻线",
};

const VIEW_OPTIONS = [
  { id: "original", label: "原图", icon: ImageIcon },
  { id: "landmarks", label: "Hand Landmarks", icon: Waypoints },
  { id: "roi", label: "Palm ROI", icon: ScanLine },
  { id: "normalized", label: "Normalized Palm", icon: Fingerprint },
  { id: "enhanced", label: "增强图", icon: Aperture },
  { id: "edge", label: "边缘图", icon: ScanLine },
  { id: "skeleton", label: "骨架图", icon: Waypoints },
  { id: "candidates", label: "Candidate Lines", icon: Eye },
  { id: "recognized", label: "识别图", icon: Fingerprint },
] as const;

type ViewMode = (typeof VIEW_OPTIONS)[number]["id"];

function statusText(visionStatus: PalmLine["visionStatus"]) {
  if (visionStatus === "detected") return "图像处理检测";
  if (visionStatus === "estimated") return "候选线低置信度";
  return "无法稳定判断";
}

function lineDecisionText(line: PalmVisionLine) {
  if (line.visionStatus === "detected") {
    return `选择原因：候选线通过安全过滤，分类评分 ${Math.round(line.metrics.classificationScore * 100)}%，最终置信度 ${Math.round(line.confidence * 100)}%。`;
  }
  if (line.visionStatus === "estimated") {
    return `低置信度原因：存在候选线，但分类/连续性不足；当前仅以虚线呈现，最终置信度 ${Math.round(line.confidence * 100)}%。`;
  }
  return `拒绝原因：未找到合格候选线，或候选线触发安全惩罚；${line.failureReasons.join(" / ") || "candidate_not_found"}。`;
}

function toDisplayLines(lines: PalmLine[], visionLines: PalmVisionLine[]): PalmLine[] {
  const visionMap = new Map(visionLines.map((line) => [line.id, line]));
  return lines.map((line) => {
    const vision = visionMap.get(line.id);
    if (!vision) return line;
    return {
      ...line,
      confidence: vision.confidenceLabel,
      visionStatus: vision.visionStatus,
      detectionMethod: vision.detectionMethod,
      annotation: vision.annotation,
      visionConfidence: vision.confidence,
    };
  });
}

function selectedImageSrc({
  imageSrc,
  viewMode,
  visionResult,
}: {
  imageSrc: string;
  viewMode: ViewMode;
  visionResult: PalmVisionResult | null;
}) {
  if (!visionResult) return imageSrc;
  if (viewMode === "original") return visionResult.artifacts.originalImageSrc;
  if (viewMode === "landmarks") return visionResult.artifacts.landmarksImageSrc;
  if (viewMode === "roi") return visionResult.artifacts.roiImageSrc;
  if (viewMode === "normalized") return visionResult.artifacts.normalizedImageSrc;
  if (viewMode === "enhanced") return visionResult.artifacts.enhancedImageSrc;
  if (viewMode === "edge") return visionResult.artifacts.edgeImageSrc;
  if (viewMode === "skeleton") return visionResult.artifacts.skeletonImageSrc;
  if (viewMode === "candidates") return visionResult.artifacts.candidateImageSrc;
  return imageSrc;
}

export async function analyzePalmVisionImage(imageSrc: string) {
  return runPalmVisionPipeline(imageSrc);
}

export function PalmVisionAssist({
  imageSrc,
  lines,
  initialVisionResult,
  onVisionResult,
  developerMode = false,
}: {
  imageSrc: string;
  lines: PalmLine[];
  initialVisionResult?: PalmVisionResult | null;
  onVisionResult?: (result: PalmVisionResult) => void;
  developerMode?: boolean;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("recognized");
  const [visionResult, setVisionResult] = useState<PalmVisionResult | null>(
    initialVisionResult ?? null,
  );
  const [visionError, setVisionError] = useState("");

  useEffect(() => {
    let cancelled = false;

    if (visionResult) return;

    runPalmVisionPipeline(imageSrc)
      .then((result) => {
        if (cancelled) return;
        setVisionResult(result);
        onVisionResult?.(result);
      })
      .catch(() => {
        if (!cancelled) setVisionError("当前浏览器未能完成视觉管线，已保留原图与 AI 报告。");
      });

    return () => {
      cancelled = true;
    };
  }, [imageSrc, onVisionResult, visionResult]);

  const displayLines = useMemo(
    () => toDisplayLines(lines, visionResult?.lines ?? []),
    [lines, visionResult],
  );
  const currentImageSrc = selectedImageSrc({
    imageSrc,
    viewMode,
    visionResult,
  });

  return (
    <article className="report-shell" id="palm-vision-assist">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-kicker">Palm Vision Assist V3</p>
          <h3 className="mt-2 font-serif text-2xl text-stone-100">
            掌纹识别辅助系统
          </h3>
        </div>
        <p className="max-w-sm text-xs leading-6 text-stone-500">
          当前为 AI 辅助识别，不等于专业掌纹检测。不清晰的线条会显示为估计或无法判断。
        </p>
      </div>

      {developerMode && (
        <div className="vision-tabs mt-6">
          {VIEW_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <button
                className={viewMode === option.id ? "is-active" : ""}
                key={option.id}
                onClick={() => setViewMode(option.id)}
                type="button"
              >
                <Icon className="h-4 w-4" />
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      {viewMode === "recognized" ? (
        <PalmAnnotation imageSrc={imageSrc} lines={displayLines} />
      ) : (
        <div className="annotation-stage mt-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={currentImageSrc} alt={`${VIEW_OPTIONS.find((item) => item.id === viewMode)?.label}预览`} />
        </div>
      )}

      {visionError && (
        <p className="mt-4 rounded-xl border border-amber-400/15 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/70">
          {visionError}
        </p>
      )}

      <div className="vision-status-grid mt-5">
        {displayLines.map((line) => {
          const vision = visionResult?.lines.find((item) => item.id === line.id);
          const isPrimary = PRIMARY_LINE_IDS.has(line.id);
          return (
            <button
              className={`vision-status-card ${line.visionStatus}`}
              key={line.id}
              onClick={() =>
                document.getElementById(`line-${line.id}`)?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
              type="button"
            >
              <span className="flex items-center gap-2">
                <Eye className="h-3.5 w-3.5" />
                {LINE_LABELS[line.id]}
              </span>
              <strong>{statusText(line.visionStatus)}</strong>
              <small>
                {Math.round((vision?.confidence ?? line.visionConfidence ?? 0) * 100)}%
                {" · "}
                {line.detectionMethod}
                {!isPrimary ? " · 本版暂不强识别" : ""}
              </small>
              {developerMode && vision && (
                <em>
                  ROI {Math.round(vision.confidenceBreakdown.roi * 100)}% ·
                  Landmarks {Math.round(vision.confidenceBreakdown.landmarks * 100)}% ·
                  Edge {Math.round(vision.confidenceBreakdown.edge * 100)}% ·
                  Class {Math.round(vision.confidenceBreakdown.classification * 100)}%
                </em>
              )}
              {developerMode && vision?.failureReasons.length ? (
                <em>原因：{vision.failureReasons.join(" / ")}</em>
              ) : null}
            </button>
          );
        })}
      </div>

      {developerMode && visionResult && (
        <div className="vision-pipeline-note mt-4">
          <p>
            Pipeline：
            {visionResult.stages.join(" → ")}
          </p>
          <p>
            ROI：{visionResult.roi.method} · {Math.round(visionResult.roi.confidence * 100)}%
            ，Landmarks：{Math.round(visionResult.hand.confidence * 100)}%
            ，纹理强度：{visionResult.imageQuality.edgeStrength}
            ，对比度：{visionResult.imageQuality.contrast}
          </p>
          {visionResult.imageQuality.failureReasons.length ? (
            <p>失败原因：{visionResult.imageQuality.failureReasons.join(" / ")}</p>
          ) : null}
          <p>
            Candidates：total {visionResult.candidateStats.total} · accepted{" "}
            {visionResult.candidateStats.accepted} · rejected{" "}
            {visionResult.candidateStats.rejected}
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {visionResult.lines
              .filter((line) => PRIMARY_LINE_IDS.has(line.id))
              .map((line) => (
                <div
                  className="rounded-xl border border-white/6 bg-black/20 p-3"
                  key={`decision-${line.id}`}
                >
                  <p className="font-serif text-sm text-amber-100">
                    {LINE_LABELS[line.id]}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-stone-500">
                    {lineDecisionText(line)}
                  </p>
                  <p className="mt-2 text-xs text-stone-600">
                    length {line.length.toFixed(2)} · skeleton{" "}
                    {line.metrics.skeletonHits} · method {line.detectionMethod}
                  </p>
                </div>
              ))}
          </div>
          {visionResult.candidates.length ? (
            <div className="mt-3 rounded-xl border border-white/6 bg-black/20 p-3">
              <p className="font-serif text-sm text-amber-100">
                Candidate rejection log
              </p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {visionResult.candidates.slice(0, 16).map((candidate) => (
                  <p
                    className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs leading-5 text-stone-500"
                    key={candidate.id}
                  >
                    <span className="text-stone-300">{candidate.id}</span>{" "}
                    · {candidate.accepted ? "accepted" : "rejected"} ·{" "}
                    {candidate.region} · len {candidate.length.toFixed(2)} ·
                    zigzag {candidate.zigzag.toFixed(2)} · jump{" "}
                    {candidate.maxJump.toFixed(2)}
                    <br />
                    reason: {candidate.reason.join(" / ") || "passed"}
                  </p>
                ))}
              </div>
            </div>
          ) : (
            <p>Candidate rejection log：未提取到候选线。</p>
          )}
        </div>
      )}
    </article>
  );
}
