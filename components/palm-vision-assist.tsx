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
  if (visionStatus === "estimated") return "模板估计";
  return "无法稳定判断";
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
          <p className="section-kicker">Palm Vision Assist V1.0</p>
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
        </div>
      )}
    </article>
  );
}
