"use client";

import type { PalmLine } from "@/lib/report-schema";

type LineTemplate = {
  id: PalmLine["id"];
  name: PalmLine["name"];
  color: string;
  path: string;
};

const LINE_TEMPLATES: LineTemplate[] = [
  {
    id: "life-line",
    name: "生命线",
    color: "#f1a35b",
    path: "M 42 35 C 29 38, 24 50, 28 65 C 31 76, 40 84, 48 88",
  },
  {
    id: "head-line",
    name: "智慧线",
    color: "#64c7d4",
    path: "M 35 45 C 48 47, 61 52, 76 58",
  },
  {
    id: "heart-line",
    name: "感情线",
    color: "#ef7f9b",
    path: "M 35 36 C 48 31, 62 32, 78 39",
  },
  {
    id: "fate-line",
    name: "事业线",
    color: "#b49af3",
    path: "M 55 82 C 54 67, 54 52, 52 37",
  },
  {
    id: "wealth-line",
    name: "财运线",
    color: "#e7cb62",
    path: "M 68 71 C 67 61, 68 52, 70 44",
  },
  {
    id: "marriage-line",
    name: "婚姻线",
    color: "#76d39b",
    path: "M 77 43 C 83 42, 87 42, 91 43",
  },
];

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
    <article className="report-shell" id="palm-annotation">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-kicker">掌纹标注图</p>
          <h3 className="mt-2 font-serif text-2xl text-stone-100">
            六条主要掌纹 · AI 辅助示意
          </h3>
        </div>
        <p className="max-w-sm text-xs leading-6 text-stone-500">
          当前线条为辅助示意，不代表专业图像识别。
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
            const muted = line?.isClearlyVisible === false;

            return (
              <g
                className={`annotation-path ${muted ? "is-muted" : ""}`}
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
                <path className="annotation-path-halo" d={template.path} />
                <path
                  d={template.path}
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
              <small>{line?.confidence ?? "low"}</small>
            </button>
          );
        })}
      </div>
    </article>
  );
}
