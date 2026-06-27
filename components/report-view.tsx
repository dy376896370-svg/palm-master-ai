"use client";

import { useCallback, useMemo, useState } from "react";
import { BookOpen, Share2, TriangleAlert } from "lucide-react";
import type { PalmReport } from "@/lib/report-schema";
import { LineCard } from "./line-card";
import {
  PalmVisionAssist,
  type PalmVisionResult,
} from "./palm-vision-assist";
import { ShareCard } from "./share-card";

export function ReportView({
  imageSrc,
  report,
  initialVisionResult = null,
}: {
  imageSrc: string;
  report: PalmReport;
  initialVisionResult?: PalmVisionResult | null;
}) {
  const [visionResult, setVisionResult] = useState<PalmVisionResult | null>(
    initialVisionResult,
  );
  const [developerMode, setDeveloperMode] = useState(false);
  const handleVisionResult = useCallback((result: PalmVisionResult) => {
    setVisionResult(result);
  }, []);
  const displayReport = useMemo(() => {
    if (!visionResult) return report;

    const visionMap = new Map(
      visionResult.lines.map((line) => [line.id, line]),
    );

    return {
      ...report,
      lines: report.lines.map((line) => {
        const vision = visionMap.get(line.id);
        if (!vision) return line;

        const unstableFallback =
          vision.visionStatus === "unavailable"
            ? "当前照片不适合稳定判断该掌纹，建议重新拍摄更清晰角度。"
            : line.visibleFeature;

        return {
          ...line,
          confidence: vision.confidenceLabel,
          visionStatus: vision.visionStatus,
          detectionMethod: vision.detectionMethod,
          annotation: vision.annotation,
          visionConfidence: vision.confidence,
          isClearlyVisible:
            vision.visionStatus === "detected" ||
            (vision.visionStatus === "estimated" && line.isClearlyVisible),
          visibleFeature: unstableFallback,
        };
      }),
    };
  }, [report, visionResult]);

  async function share() {
    const shareData = {
      title: displayReport.share.title,
      text: `${displayReport.share.summary}\n\n仅供娱乐参考。`,
      url: window.location.origin,
    };
    if (navigator.share) {
      await navigator.share(shareData).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
      window.alert("分享文案已复制。");
    }
  }

  if (!displayReport.imageQuality.accepted) {
    return (
      <section className="mx-auto max-w-3xl px-5 py-24 sm:px-8">
        <div className="report-shell text-center">
          <TriangleAlert className="mx-auto h-10 w-10 text-amber-300" />
          <h2 className="mt-5 font-serif text-3xl text-stone-100">这张照片还不够清晰</h2>
          <p className="mx-auto mt-4 max-w-xl leading-7 text-stone-400">
            为避免编造掌纹内容，本次没有生成解读。请按以下方式重新拍摄：
          </p>
          <ul className="mx-auto mt-6 max-w-md space-y-3 text-left text-sm text-stone-300">
            {displayReport.imageQuality.retakeGuidance.map((tip) => (
              <li className="flex gap-3" key={tip}><span className="text-amber-300">◇</span>{tip}</li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl px-5 py-24 sm:px-8">
      <div className="mb-12 text-center">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="eyebrow"><BookOpen className="h-3.5 w-3.5" />你的掌心文化报告</div>
          <label className="developer-toggle">
            <input
              checked={developerMode}
              onChange={(event) => setDeveloperMode(event.target.checked)}
              type="checkbox"
            />
            Developer Mode
          </label>
        </div>
        <h2 className="mt-5 font-serif text-4xl text-stone-50 sm:text-5xl">五家合观 · 一念自省</h2>
        <p className="mt-4 text-sm text-stone-500">
          图像清晰度 {Math.round(displayReport.imageQuality.score)} / 100 · 报告编号 {displayReport.reportId}
        </p>
        <p className="source-transparency mt-4">
          本站仅展示已核验原典资料，未收录内容不会由 AI 编造。
        </p>
      </div>

      <article className="report-shell">
        <p className="section-kicker">整体印象</p>
        <h3 className="mt-2 font-serif text-2xl text-stone-100">掌心初见</h3>
        <div className="mt-5 flex flex-wrap gap-2">
          {displayReport.overallImpression.observedFeatures.map((feature) => (
            <span className="feature-tag" key={feature}>{feature}</span>
          ))}
        </div>
        <p className="mt-6 leading-8 text-stone-300">{displayReport.overallImpression.culturalReading}</p>
        <p className="mt-3 leading-8 text-stone-500">{displayReport.overallImpression.modernReflection}</p>
      </article>

      <div className="mt-6">
        <PalmVisionAssist
          imageSrc={imageSrc}
          developerMode={developerMode}
          lines={displayReport.lines}
          initialVisionResult={visionResult}
          onVisionResult={handleVisionResult}
        />
      </div>

      <div className="mt-6 space-y-6">
        {displayReport.lines.map((line, lineIndex) => (
          <LineCard index={lineIndex} key={line.id} line={line} />
        ))}
      </div>

      <article className="report-shell mt-6">
        <p className="section-kicker">综合总结</p>
        <h3 className="mt-2 font-serif text-3xl text-stone-100">把掌纹当作一面镜子</h3>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <p className="field-label">当下主题</p>
            <ul className="mt-3 space-y-3 text-stone-300">
              {displayReport.finalSynthesis.keyThemes.map((item) => <li key={item}>◇ {item}</li>)}
            </ul>
          </div>
          <div>
            <p className="field-label">自我探索</p>
            <ul className="mt-3 space-y-3 text-stone-300">
              {displayReport.finalSynthesis.selfExplorationQuestions.map((item) => <li key={item}>◇ {item}</li>)}
            </ul>
          </div>
        </div>
        <div className="mt-7 border-t border-white/8 pt-6">
          <p className="field-label">可以从今天开始</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {displayReport.finalSynthesis.practicalSuggestions.map((item) => (
              <span className="feature-tag" key={item}>{item}</span>
            ))}
          </div>
        </div>
        <button className="primary-button mt-8" onClick={share} type="button">
          <Share2 className="h-5 w-5" />分享我的文化解读
        </button>
        <ShareCard report={displayReport} />
        <p className="mt-5 text-center text-xs leading-6 text-stone-600">{displayReport.safety.disclaimer}</p>
      </article>
    </section>
  );
}
