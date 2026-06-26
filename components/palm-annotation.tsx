"use client";

import type { PalmLine } from "@/lib/report-schema";

type LineTemplate = {
  id: PalmLine["id"];
  name: PalmLine["name"];
  color: string;
  fallbackPoints: { x: number; y: number }[];
};

const LINE_TEMPLATES: LineTemplate[] = [
  {
    id: "life-line",
    name: "生命线",
    color: "#f1a35b",
    fallbackPoints: [
      { x: 0.42, y: 0.35 },
      { x: 0.29, y: 0.38 },
      { x: 0.24, y: 0.5 },
      { x: 0.28, y: 0.65 },
      { x: 0.4, y: 0.84 },
      { x: 0.48, y: 0.88 },
    ],
  },
  {
    id: "head-line",
    name: "智慧线",
    color: "#64c7d4",
    fallbackPoints: [
      { x: 0.35, y: 0.45 },
      { x: 0.48, y: 0.47 },
      { x: 0.61, y: 0.52 },
      { x: 0.76, y: 0.58 },
    ],
  },
  {
    id: "heart-line",
    name: "感情线",
    color: "#ef7f9b",
    fallbackPoints: [
      { x: 0.35, y: 0.36 },
      { x: 0.48, y: 0.31 },
      { x: 0.62, y: 0.32 },
      { x: 0.78, y: 0.39 },
    ],
  },
  {
    id: "fate-line",
    name: "事业线",
    color: "#b49af3",
    fallbackPoints: [],
  },
  {
    id: "wealth-line",
    name: "财运线",
    color: "#e7cb62",
    fallbackPoints: [],
  },
  {
    id: "marriage-line",
    name: "婚姻线",
    color: "#76d39b",
    fallbackPoints: [],
  },
];

function pointsToPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return "";
  return points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${(point.x * 100).toFixed(2)} ${(point.y * 100).toFixed(2)}`,
    )
    .join(" ");
}

function scrollToLine(id: PalmLine["id"]) {
  document.getElementById(`line-${id}`)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

export function PalmAnnotation({
  imageSrc,
  lines,
}: {
  imageSrc: string;
  lines: PalmLine[];
}) {
  const lineMap = new Map(lines.map((line) => [line.id, line]));

  return (
    <div id="palm-annotation">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-kicker">掌纹标注图</p>
          <h3 className="mt-2 font-serif text-2xl text-stone-100">
            主要掌纹 · AI 辅助标注
          </h3>
        </div>
        <p className="max-w-sm text-xs leading-6 text-stone-500">
          当前线条为辅助示意，不代表专业图像识别。实线表示图像处理检测，虚线表示估计。
        </p>
      </div>

      <div className="annotation-stage mt-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageSrc} alt="带掌纹辅助标注的手掌照片" />
        <svg
          aria-label="主要掌纹辅助标注层"
          className="annotation-overlay"
          preserveAspectRatio="none"
          role="img"
          viewBox="0 0 100 100"
        >
          {LINE_TEMPLATES.map((template) => {
            const line = lineMap.get(template.id);
            const points =
              line?.annotation?.points?.length ? line.annotation.points : template.fallbackPoints;
            const path = pointsToPath(points);
            const unavailable = line?.visionStatus === "unavailable" || !path;
            const estimated =
              line?.visionStatus === "estimated" ||
              line?.detectionMethod === "template-estimate";

            if (unavailable) return null;

            return (
              <g
                className={`annotation-path ${estimated ? "is-estimated" : ""}`}
                id={`annotation-${template.id}`}
                key={template.id}
                onClick={() => scrollToLine(template.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    scrollToLine(template.id);
                  }
                }}
              >
                <path className="annotation-path-halo" d={path} />
                <path
                  d={path}
                  fill="none"
                  stroke={template.color}
                  strokeLinecap="round"
                  strokeWidth="1.15"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {LINE_TEMPLATES.map((template) => {
          const line = lineMap.get(template.id);
          return (
            <button
              className="annotation-legend"
              key={template.id}
              onClick={() => scrollToLine(template.id)}
              type="button"
            >
              <span style={{ backgroundColor: template.color }} />
              <span>{template.name}</span>
              <small>{line?.visionStatus ?? "unavailable"} · {line?.confidence ?? "low"}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
