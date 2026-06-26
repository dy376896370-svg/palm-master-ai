"use client";

import { useEffect, useMemo, useState } from "react";
import { Aperture, Eye, Image as ImageIcon, ScanLine } from "lucide-react";
import type { PalmLine, PalmLineId } from "@/lib/report-schema";
import { PalmAnnotation } from "./palm-annotation";

type VisionPoint = { x: number; y: number };

export type PalmVisionLine = Pick<
  PalmLine,
  "id" | "visionStatus" | "detectionMethod" | "confidence" | "annotation"
>;

export type PalmVisionResult = {
  enhancedImageSrc: string;
  lines: PalmVisionLine[];
  quality: {
    edgeStrength: number;
    contrast: number;
  };
};

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

const VISION_TEMPLATES: Record<
  Extract<PalmLineId, "life-line" | "head-line" | "heart-line">,
  VisionPoint[]
> = {
  "life-line": [
    { x: 0.42, y: 0.34 },
    { x: 0.34, y: 0.42 },
    { x: 0.29, y: 0.57 },
    { x: 0.34, y: 0.74 },
    { x: 0.48, y: 0.88 },
  ],
  "head-line": [
    { x: 0.36, y: 0.46 },
    { x: 0.47, y: 0.48 },
    { x: 0.59, y: 0.52 },
    { x: 0.75, y: 0.58 },
  ],
  "heart-line": [
    { x: 0.34, y: 0.36 },
    { x: 0.47, y: 0.32 },
    { x: 0.62, y: 0.33 },
    { x: 0.79, y: 0.39 },
  ],
};

const FALLBACK_LINE_IDS: PalmLineId[] = [
  "fate-line",
  "wealth-line",
  "marriage-line",
];

const VIEW_OPTIONS = [
  { id: "original", label: "原图", icon: ImageIcon },
  { id: "enhanced", label: "增强图", icon: Aperture },
  { id: "annotated", label: "标注图", icon: ScanLine },
] as const;

type ViewMode = (typeof VIEW_OPTIONS)[number]["id"];

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片无法读取，无法生成增强图。"));
    image.src = src;
  });
}

function grayscale(data: Uint8ClampedArray) {
  const gray = new Uint8ClampedArray(data.length / 4);
  for (let index = 0; index < data.length; index += 4) {
    gray[index / 4] = Math.round(
      data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114,
    );
  }
  return gray;
}

function enhanceGray(gray: Uint8ClampedArray) {
  let min = 255;
  let max = 0;
  for (const value of gray) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }

  const spread = Math.max(1, max - min);
  const enhanced = new Uint8ClampedArray(gray.length);
  for (let index = 0; index < gray.length; index += 1) {
    const stretched = ((gray[index] - min) / spread) * 255;
    enhanced[index] = clamp((stretched - 128) * 1.28 + 128, 0, 255);
  }
  return { enhanced, contrast: spread };
}

function sharpen(gray: Uint8ClampedArray, width: number, height: number) {
  const output = new Uint8ClampedArray(gray.length);
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky += 1) {
        for (let kx = -1; kx <= 1; kx += 1) {
          sum += gray[(y + ky) * width + (x + kx)] * kernel[(ky + 1) * 3 + kx + 1];
        }
      }
      output[y * width + x] = clamp(sum, 0, 255);
    }
  }

  return output;
}

function sobel(gray: Uint8ClampedArray, width: number, height: number) {
  const edges = new Uint8ClampedArray(gray.length);
  let total = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const a = gray[(y - 1) * width + x - 1];
      const b = gray[(y - 1) * width + x];
      const c = gray[(y - 1) * width + x + 1];
      const d = gray[y * width + x - 1];
      const f = gray[y * width + x + 1];
      const g = gray[(y + 1) * width + x - 1];
      const h = gray[(y + 1) * width + x];
      const i = gray[(y + 1) * width + x + 1];
      const gx = -a + c - 2 * d + 2 * f - g + i;
      const gy = -a - 2 * b - c + g + 2 * h + i;
      const value = clamp(Math.sqrt(gx * gx + gy * gy), 0, 255);
      edges[y * width + x] = value;
      total += value;
    }
  }

  return {
    edges,
    edgeStrength: total / Math.max(1, (width - 2) * (height - 2)),
  };
}

function renderEnhancedPreview(
  enhanced: Uint8ClampedArray,
  edges: Uint8ClampedArray,
  width: number,
  height: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return "";

  const imageData = context.createImageData(width, height);
  for (let index = 0; index < enhanced.length; index += 1) {
    const edgeBoost = edges[index] * 0.52;
    const value = clamp(enhanced[index] + edgeBoost, 0, 255);
    imageData.data[index * 4] = value;
    imageData.data[index * 4 + 1] = value;
    imageData.data[index * 4 + 2] = value;
    imageData.data[index * 4 + 3] = 255;
  }
  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/webp", 0.86);
}

function sampleBestEdge(
  edges: Uint8ClampedArray,
  width: number,
  height: number,
  point: VisionPoint,
) {
  const centerX = Math.round(point.x * width);
  const centerY = Math.round(point.y * height);
  const radius = Math.max(5, Math.round(Math.min(width, height) * 0.035));
  let best = { value: 0, x: centerX, y: centerY };

  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      if (x < 1 || x >= width - 1 || y < 1 || y >= height - 1) continue;
      const distance = Math.hypot(x - centerX, y - centerY);
      const weight = 1 - distance / (radius + 1);
      const value = edges[y * width + x] * Math.max(0.18, weight);
      if (value > best.value) best = { value, x, y };
    }
  }

  return {
    value: best.value,
    point: {
      x: clamp(best.x / width),
      y: clamp(best.y / height),
    },
  };
}

function detectTemplateLine(
  id: Extract<PalmLineId, "life-line" | "head-line" | "heart-line">,
  edges: Uint8ClampedArray,
  width: number,
  height: number,
  globalEdgeStrength: number,
): PalmVisionLine {
  const samples = VISION_TEMPLATES[id].map((point) =>
    sampleBestEdge(edges, width, height, point),
  );
  const average = samples.reduce((sum, sample) => sum + sample.value, 0) / samples.length;
  const threshold = Math.max(20, globalEdgeStrength * 1.55);
  const detected = average >= threshold;
  const strong = average >= threshold * 1.45;

  return {
    id,
    confidence: detected ? (strong ? "high" : "medium") : "low",
    visionStatus: detected ? "detected" : "estimated",
    detectionMethod: detected ? "image-processing" : "template-estimate",
    annotation: {
      type: "path",
      points: detected ? samples.map((sample) => sample.point) : VISION_TEMPLATES[id],
    },
  };
}

function unavailableLine(id: PalmLineId): PalmVisionLine {
  return {
    id,
    confidence: "low",
    visionStatus: "unavailable",
    detectionMethod: "not-detected",
    annotation: {
      type: "path",
      points: [],
    },
  };
}

export async function analyzePalmVisionImage(imageSrc: string): Promise<PalmVisionResult> {
  const image = await loadImage(imageSrc);
  const maxSide = 900;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("当前浏览器不支持图像预处理。");

  context.drawImage(image, 0, 0, width, height);
  const source = context.getImageData(0, 0, width, height);
  const gray = grayscale(source.data);
  const { enhanced, contrast } = enhanceGray(gray);
  const sharpened = sharpen(enhanced, width, height);
  const { edges, edgeStrength } = sobel(sharpened, width, height);
  const enhancedImageSrc = renderEnhancedPreview(sharpened, edges, width, height);

  return {
    enhancedImageSrc,
    quality: {
      edgeStrength: Math.round(edgeStrength),
      contrast: Math.round(contrast),
    },
    lines: [
      detectTemplateLine("life-line", edges, width, height, edgeStrength),
      detectTemplateLine("head-line", edges, width, height, edgeStrength),
      detectTemplateLine("heart-line", edges, width, height, edgeStrength),
      ...FALLBACK_LINE_IDS.map(unavailableLine),
    ],
  };
}

function statusText(line: PalmVisionLine) {
  if (line.visionStatus === "detected") return "图像处理检测";
  if (line.visionStatus === "estimated") return "模板估计";
  return "无法稳定判断";
}

function toDisplayLines(lines: PalmLine[], visionLines: PalmVisionLine[]): PalmLine[] {
  const visionMap = new Map(visionLines.map((line) => [line.id, line]));
  return lines.map((line) => {
    const vision = visionMap.get(line.id);
    if (!vision) return line;
    return {
      ...line,
      confidence: vision.confidence,
      visionStatus: vision.visionStatus,
      detectionMethod: vision.detectionMethod,
      annotation: vision.annotation,
    };
  });
}

export function PalmVisionAssist({
  imageSrc,
  lines,
  initialVisionResult,
  onVisionResult,
}: {
  imageSrc: string;
  lines: PalmLine[];
  initialVisionResult?: PalmVisionResult | null;
  onVisionResult?: (result: PalmVisionResult) => void;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("annotated");
  const [visionResult, setVisionResult] = useState<PalmVisionResult | null>(
    initialVisionResult ?? null,
  );
  const [visionError, setVisionError] = useState("");

  useEffect(() => {
    let cancelled = false;

    if (visionResult) return;

    analyzePalmVisionImage(imageSrc)
      .then((result) => {
        if (cancelled) return;
        setVisionResult(result);
        onVisionResult?.(result);
      })
      .catch(() => {
        if (!cancelled) setVisionError("当前浏览器未能生成增强图，已保留原图与 AI 报告。");
      });

    return () => {
      cancelled = true;
    };
  }, [imageSrc, onVisionResult, visionResult]);

  const displayLines = useMemo(
    () => toDisplayLines(lines, visionResult?.lines ?? []),
    [lines, visionResult],
  );
  const imageForView = viewMode === "enhanced" && visionResult?.enhancedImageSrc
    ? visionResult.enhancedImageSrc
    : imageSrc;

  return (
    <article className="report-shell" id="palm-vision-assist">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-kicker">Palm Vision Assist</p>
          <h3 className="mt-2 font-serif text-2xl text-stone-100">
            掌纹识别辅助系统
          </h3>
        </div>
        <p className="max-w-sm text-xs leading-6 text-stone-500">
          当前为 AI 辅助识别，不等于专业掌纹检测。不清晰的线条会显示为估计或无法判断。
        </p>
      </div>

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

      {viewMode === "annotated" ? (
        <PalmAnnotation imageSrc={imageSrc} lines={displayLines} />
      ) : (
        <div className="annotation-stage mt-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageForView}
            alt={viewMode === "enhanced" ? "掌纹增强图预览" : "手掌原图预览"}
          />
        </div>
      )}

      {visionError && (
        <p className="mt-4 rounded-xl border border-amber-400/15 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/70">
          {visionError}
        </p>
      )}

      <div className="vision-status-grid mt-5">
        {displayLines.map((line) => {
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
              <strong>{statusText(line)}</strong>
              <small>
                {line.confidence} · {line.detectionMethod}
                {!isPrimary ? " · 本版暂不强识别" : ""}
              </small>
            </button>
          );
        })}
      </div>

      {visionResult && (
        <p className="mt-4 text-xs leading-6 text-stone-600">
          已执行灰度化、对比度增强、锐化、Sobel 边缘检测与纹理增强。纹理强度：
          {visionResult.quality.edgeStrength}，对比度：{visionResult.quality.contrast}。
        </p>
      )}
    </article>
  );
}
