import { BookOpenText, CircleAlert, ExternalLink, Sparkles } from "lucide-react";
import type { PalmLine } from "@/lib/report-schema";

const confidenceLabels: Record<PalmLine["confidence"], string> = {
  low: "低置信度",
  medium: "中等置信度",
  high: "较高置信度",
};

const visionStatusLabels: Record<PalmLine["visionStatus"], string> = {
  detected: "图像处理检测",
  estimated: "常见位置估计",
  unavailable: "无法稳定判断",
};

const failureReasonLabels: Record<PalmLine["failureReasons"][number], string> = {
  image_blurry: "照片略模糊",
  palm_rotated: "手掌角度偏斜",
  landmarks_missing: "未稳定识别手部关键点",
  candidate_fragmented: "候选线条断裂",
  low_contrast: "掌纹对比度偏低",
  roi_unstable: "掌心区域不稳定",
  candidate_not_found: "未找到稳定候选线",
  classification_score_low: "分类评分偏低",
  mediapipe_unavailable: "关键点模型暂不可用",
  path_zigzag_too_high: "路径曲折异常",
  crosses_fingers: "候选线穿过手指区域",
  jumps_too_large: "候选线存在大跳跃",
  outside_palm_roi: "候选线超出掌心区域",
  touches_image_border: "候选线贴近图片边缘",
  too_vertical_for_heart_or_head: "横向主线方向异常",
  too_many_sharp_turns: "候选线急转过多",
  too_short: "候选线过短",
  too_long: "候选线过长",
};

export function LineCard({
  line,
  index,
}: {
  line: PalmLine;
  index: number;
}) {
  const sources = line.sources ?? {
    chineseClassics: [],
    westernPalmistry: [],
  };
  const hasAnnotation = line.annotation.points.length > 1 && line.visionConfidence >= 0.55;

  return (
    <article
      className="report-shell scroll-mt-8"
      id={`line-${line.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="section-kicker">
            掌纹 {String(index + 1).padStart(2, "0")}
          </p>
          <h3 className="mt-2 font-serif text-3xl text-stone-100">
            {line.name}
          </h3>
        </div>
        <span
          className={`visibility ${
            line.visionStatus === "detected" ? "" : "visibility-low"
          }`}
        >
          {visionStatusLabels[line.visionStatus]} · {confidenceLabels[line.confidence]}
        </span>
      </div>

      {hasAnnotation ? (
        <a
          className="line-annotation-link mt-5"
          href={`#annotation-${line.id}`}
        >
          <span />
          查看这条掌纹在开发者标注图中的辅助位置
        </a>
      ) : null}

      <div className="mt-7 grid gap-4 rounded-xl border border-white/6 bg-black/15 p-5 sm:grid-cols-3">
        <div>
          <p className="field-label">这条线通常在哪里</p>
          <p className="mt-2 leading-7 text-stone-300">
            {line.approximatePosition}
          </p>
          <p className="mt-1 text-xs text-stone-600">
            视觉辅助：{visionStatusLabels[line.visionStatus]} · {Math.round(line.visionConfidence * 100)}%
          </p>
          <p className="mt-1 text-xs text-stone-600">
            ROI {Math.round(line.confidenceBreakdown.roi * 100)}% ·
            关键点 {Math.round(line.confidenceBreakdown.landmarks * 100)}% ·
            分类 {Math.round(line.confidenceBreakdown.classification * 100)}%
          </p>
        </div>
        <div>
          <p className="field-label">本次照片是否看得清</p>
          <p className="mt-2 leading-7 text-stone-300">
            {line.visibilityAssessment}
          </p>
        </div>
        <div>
          <p className="field-label">AI 观察到什么</p>
          <p className="mt-2 leading-7 text-stone-300">
            {line.visibleFeature}
          </p>
        </div>
      </div>

      <div className="mt-7 grid gap-4 md:grid-cols-2">
        <div className="interpretation-card">
          <h4>传统相术通用解释</h4>
          <p>{line.traditionalGeneralInterpretation}</p>
        </div>
        <div className="interpretation-card">
          <h4>西方 Palmistry 通用解释</h4>
          <p>{line.westernGeneralInterpretation}</p>
        </div>
      </div>

      <div className="synthesis mt-7">
        <div className="flex items-center gap-2 text-amber-200">
          <Sparkles className="h-4 w-4" />
          <h4 className="font-serif text-lg">AI 综合解读</h4>
        </div>
        <p className="mt-3 leading-7 text-stone-200">
          {line.combinedReading}
        </p>
        <div className="mt-4 border-t border-amber-100/10 pt-4">
          <p className="field-label">现实建议</p>
          <p className="mt-2 text-sm leading-7 text-stone-400">
            {line.practicalAdvice}
          </p>
        </div>
        <div className="mt-4 border-t border-amber-100/10 pt-4">
          <p className="field-label">自我观察问题</p>
          <p className="mt-2 text-sm leading-7 text-stone-400">
            {line.selfObservationQuestion}
          </p>
        </div>
      </div>

      {line.visionStatus !== "detected" && (
        <div className="mt-5 flex gap-3 rounded-xl border border-amber-400/15 bg-amber-950/20 p-4 text-sm leading-6 text-amber-100/75">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p>
              {line.visionStatus === "estimated"
                ? "这条掌纹只找到低置信度候选线，不能视为专业精准识别。"
                : "本次未能稳定识别该掌纹。"}
            </p>
            <p className="mt-1 text-amber-100/60">{line.visibilityIssue}</p>
          </div>
        </div>
      )}

      {line.failureReasons.length > 0 && (
        <div className="mt-4 rounded-xl border border-white/6 bg-black/15 p-4">
          <p className="field-label">看不清的可能原因 / 重拍方式</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {line.failureReasons.map((reason) => (
              <span className="feature-tag" key={reason}>
                {failureReasonLabels[reason]}
              </span>
            ))}
          </div>
          <p className="mt-3 text-sm leading-7 text-stone-500">
            {line.visibilityIssue}
          </p>
        </div>
      )}

      <div className="school-view mt-7">
        <h4>原典资料状态</h4>
        <p>{line.referenceBasis}</p>
        {!sources.chineseClassics.length && !sources.westernPalmistry.length ? (
          <p className="modern">原典原文：待校勘</p>
        ) : null}
      </div>

      <div className="source-section mt-7">
        <div className="source-section-title">
          <BookOpenText className="h-4 w-4" />
          <div>
            <h4>中文古籍依据</h4>
            <p>仅展示本地资料库中已经逐字核验的公版内容。</p>
          </div>
        </div>
        {sources.chineseClassics.length ? (
          <div className="mt-4 space-y-3">
            {sources.chineseClassics.map((source) => (
              <article className="source-card" key={`${source.book}-${source.source}`}>
                <p className="source-book">{source.book}</p>
                <blockquote>{source.originalText}</blockquote>
                <p><strong>出处：</strong>{source.source}</p>
                <p><strong>现代解释：</strong>{source.modernExplanation}</p>
                {source.note && <p className="source-note">{source.note}</p>}
              </article>
            ))}
          </div>
        ) : (
          <p className="source-empty mt-4">原典原文：待校勘</p>
        )}
      </div>

      <div className="source-section mt-4">
        <div className="source-section-title">
          <BookOpenText className="h-4 w-4" />
          <div>
            <h4>西方 Palmistry 原典</h4>
            <p>英文原文与翻译均来自本地已核验公版资料。</p>
          </div>
        </div>
        {sources.westernPalmistry.length ? (
          <div className="mt-4 space-y-3">
            {sources.westernPalmistry.map((source) => (
              <article className="source-card" key={`${source.book}-${source.source}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="source-book">{source.book} · {source.author}</p>
                  <a href={source.sourceUrl} target="_blank" rel="noreferrer">
                    核验来源 <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <blockquote lang="en">{source.originalText}</blockquote>
                <p><strong>出处：</strong>{source.source}</p>
                <p><strong>中文翻译：</strong>{source.chineseTranslation}</p>
                {source.note && <p className="source-note">{source.note}</p>}
              </article>
            ))}
          </div>
        ) : (
          <p className="source-empty mt-4">原典原文：待校勘</p>
        )}
      </div>

      <p className="line-disclaimer mt-5">
        仅供传统文化参考与娱乐体验，不构成医疗、投资、婚姻或人生决策建议。
      </p>
    </article>
  );
}
