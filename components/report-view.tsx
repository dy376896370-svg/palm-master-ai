"use client";

import { useCallback, useMemo, useState } from "react";
import { BookOpen, Camera, CheckCircle2, Share2, Sparkles, TriangleAlert } from "lucide-react";
import type { PalmReport } from "@/lib/report-schema";
import { LineCard } from "./line-card";
import {
  PalmVisionAssist,
  type PalmVisionResult,
} from "./palm-vision-assist";
import { ShareCard } from "./share-card";

function qualityLabel(score: number) {
  if (score >= 76) return "良好";
  if (score >= 52) return "一般";
  return "较差";
}

function reliabilityLabel(score: number) {
  if (score >= 76) return "较高";
  if (score >= 52) return "中等";
  return "偏低";
}

function qualityChecks(report: PalmReport, visionResult: PalmVisionResult | null) {
  const score = report.imageQuality.score;
  const roiConfidence = visionResult?.imageQuality.roiConfidence ?? score / 100;
  const edgeStrength = visionResult?.imageQuality.edgeStrength ?? score;
  const contrast = visionResult?.imageQuality.contrast ?? score;
  const issues = new Set(report.imageQuality.issues);

  return [
    {
      label: "手掌是否完整",
      passed: roiConfidence >= 0.55 && !issues.has("手掌不完整"),
      detail: roiConfidence >= 0.55 ? "掌心区域基本可用" : "建议让整只手完整入镜",
    },
    {
      label: "掌心是否占画面 70% 以上",
      passed: roiConfidence >= 0.65,
      detail: roiConfidence >= 0.65 ? "画面占比适合观察" : "建议掌心靠近镜头，占画面约 80%",
    },
    {
      label: "光线是否均匀",
      passed: contrast >= 28 && !issues.has("光线不均"),
      detail: contrast >= 28 ? "明暗层次可用" : "建议使用柔和均匀光线",
    },
    {
      label: "是否模糊",
      passed: edgeStrength >= 8 && !issues.has("照片模糊"),
      detail: edgeStrength >= 8 ? "纹理边缘可观察" : "建议重新对焦后拍摄",
    },
    {
      label: "是否反光",
      passed: !Array.from(issues).some((issue) => issue.includes("反光")),
      detail: "避免强光直射、桌面反光或皮肤过曝",
    },
    {
      label: "背景是否干扰",
      passed: !Array.from(issues).some((issue) => issue.includes("背景")),
      detail: "纯色背景更利于观察掌心纹理",
    },
  ];
}

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

  const checks = qualityChecks(displayReport, visionResult);
  const shouldRetake =
    !displayReport.imageQuality.accepted || displayReport.imageQuality.score < 52;
  const visibleOverview = displayReport.lines
    .filter((line) => line.isClearlyVisible || line.visionStatus !== "unavailable")
    .slice(0, 4);

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
          照片质量 {qualityLabel(displayReport.imageQuality.score)} · 报告可靠度 {reliabilityLabel(displayReport.imageQuality.score)} · 报告编号 {displayReport.reportId}
        </p>
        <p className="source-transparency mt-4">
          本站仅展示已核验原典资料，未收录内容不会由 AI 编造。
        </p>
      </div>

      <article className="report-shell">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="section-kicker">Palm Photo Quality Check</p>
            <h3 className="mt-2 font-serif text-2xl text-stone-100">
              照片质量：{qualityLabel(displayReport.imageQuality.score)}
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-500">
              本模块只做照片质量诊断与辅助观察，不承诺精准识别每条掌纹。报告会优先基于可见特征和 Palm Canon 资料库生成文化参考解读。
            </p>
          </div>
          <span className={`quality-badge ${shouldRetake ? "is-warning" : ""}`}>
            预计报告可靠度：{reliabilityLabel(displayReport.imageQuality.score)}
          </span>
        </div>

        <div className="quality-grid mt-6">
          {checks.map((check) => (
            <div className="quality-item" key={check.label}>
              {check.passed ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-300/80" />
              ) : (
                <TriangleAlert className="h-4 w-4 text-amber-300/80" />
              )}
              <div>
                <strong>{check.label}</strong>
                <p>{check.detail}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-amber-300/10 bg-amber-950/10 p-4">
          <div className="flex items-center gap-2 text-sm text-amber-100/80">
            <Camera className="h-4 w-4" />
            {shouldRetake ? "建议重拍后获得更稳定的观察结果" : "这张照片可以用于本次文化解读"}
          </div>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-stone-400 sm:grid-cols-2">
            {(displayReport.imageQuality.retakeGuidance.length
              ? displayReport.imageQuality.retakeGuidance
              : [
                  "手掌完全张开，掌心朝向镜头。",
                  "掌心靠近镜头，占画面约 80%。",
                  "使用均匀光线，避免反光。",
                  "选择简单背景，不要开美颜。",
                ]
            ).map((tip) => (
              <li className="flex gap-2" key={tip}>
                <span className="text-amber-300">◇</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </article>

      <article className="report-shell mt-6">
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

      <article className="report-shell mt-6">
        <div className="flex items-center gap-2 text-amber-100">
          <Sparkles className="h-4 w-4" />
          <p className="section-kicker">可见掌纹概览</p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {(visibleOverview.length ? visibleOverview : displayReport.lines.slice(0, 4)).map((line) => (
            <div className="interpretation-card" key={`overview-${line.id}`}>
              <h4>{line.name}</h4>
              <p>{line.visibleFeature}</p>
            </div>
          ))}
        </div>
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
