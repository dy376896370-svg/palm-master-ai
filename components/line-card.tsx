import { BookOpenText, CircleAlert, ExternalLink, Sparkles } from "lucide-react";
import type { PalmLine } from "@/lib/report-schema";

const LINE_GUIDES: Record<
  PalmLine["id"],
  {
    traditional: string;
    western: string;
  }
> = {
  "life-line": {
    traditional:
      "传统相术通常把生命线视为精力状态、行动韧性与生活节奏的象征。这里是传统说法的现代归纳，并非古籍原文。",
    western:
      "西方 Palmistry 通常关注生命线的弧度、连续性与围绕拇指根部的范围，用来象征活力与生活方式倾向。",
  },
  "head-line": {
    traditional:
      "传统相术常以智慧线观察思考方式、专注程度与处事取向。这里是传统说法的现代归纳，并非古籍原文。",
    western:
      "西方 Palmistry 多把 Head Line 视为心智模式的象征，关注其横向延伸、倾斜角度与清晰程度。",
  },
  "heart-line": {
    traditional:
      "传统相术常以感情线观察情绪表达、人际敏感度与关系中的自我觉察。这里是传统说法的现代归纳，并非古籍原文。",
    western:
      "西方 Palmistry 多把 Heart Line 放在情感与关系表达框架中观察，重视其位置、长度与连贯性。",
  },
  "fate-line": {
    traditional:
      "传统相术常把事业线视为阶段目标、责任感与外部环境牵引的象征。这里是传统说法的现代归纳，并非古籍原文。",
    western:
      "西方 Palmistry 通常将 Fate Line 与职业路径、人生阶段感和外部结构感联系起来，但并不视为决定论。",
  },
  "wealth-line": {
    traditional:
      "传统相术中的财运相关纹路多被理解为资源意识、积累习惯与现实规划能力。这里是传统说法的现代归纳，并非古籍原文。",
    western:
      "西方 Palmistry 对金钱相关细纹没有统一标准，更多作为资源管理与实践能力的象征性参考。",
  },
  "marriage-line": {
    traditional:
      "传统相术常把婚姻线作为亲密关系态度、沟通习惯与情感边界的象征。这里是传统说法的现代归纳，并非古籍原文。",
    western:
      "西方 Palmistry 常把小指下方的关系线视为亲密互动倾向参考，不用于判断婚姻结果。",
  },
};

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

const detectionMethodLabels: Record<PalmLine["detectionMethod"], string> = {
  "landmarks-classical-cv": "landmarks + classical-cv",
  "template-estimate": "template-estimate",
  "not-detected": "not-detected",
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
  const guide = LINE_GUIDES[line.id];
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

      {line.visionStatus !== "detected" && (
        <div className="mt-5 flex gap-3 rounded-xl border border-amber-400/15 bg-amber-950/20 p-4 text-sm leading-6 text-amber-100/75">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {line.visionStatus === "estimated"
            ? "这条掌纹只找到低置信度候选线，当前以虚线呈现，不能视为专业精准识别。"
            : "当前照片未能稳定识别该掌纹。建议手掌完全张开、掌心占画面 80%、使用均匀光线重新拍摄。"}
        </div>
      )}

      <div className="mt-7 grid gap-4 rounded-xl border border-white/6 bg-black/15 p-5 sm:grid-cols-3">
        <div>
          <p className="field-label">掌纹位置说明</p>
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
          <p className="field-label">当前照片观察</p>
          <p className="mt-2 leading-7 text-stone-300">
            {line.visibleFeature}
          </p>
        </div>
        <div>
          <p className="field-label">识别方式</p>
          <p className="mt-2 leading-7 text-stone-300">
            {detectionMethodLabels[line.detectionMethod]}
          </p>
        </div>
      </div>

      {line.failureReasons.length > 0 && (
        <div className="mt-4 rounded-xl border border-white/6 bg-black/15 p-4">
          <p className="field-label">失败原因 / 重拍建议</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {line.failureReasons.map((reason) => (
              <span className="feature-tag" key={reason}>
                {failureReasonLabels[reason]}
              </span>
            ))}
          </div>
          <p className="mt-3 text-sm leading-7 text-stone-500">
            当前照片未能稳定识别该掌纹。建议手掌完全张开、掌心占画面 80%、使用均匀光线重新拍摄。
          </p>
        </div>
      )}

      <div className="mt-7 grid gap-4 md:grid-cols-2">
        <div className="interpretation-card">
          <h4>传统相术通用解释</h4>
          <p>{guide.traditional}</p>
        </div>
        <div className="interpretation-card">
          <h4>西方 Palmistry 通用解释</h4>
          <p>{guide.western}</p>
        </div>
      </div>

      <div className="school-view mt-7">
        <h4>原典资料状态</h4>
        <p>{line.referenceBasis}</p>
        {!sources.chineseClassics.length && !sources.westernPalmistry.length ? (
          <p className="modern">原典原文：待校勘。</p>
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
          <p className="source-empty mt-4">原典原文：待校勘。</p>
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
          <p className="source-empty mt-4">原典原文：待校勘。</p>
        )}
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
      </div>

      <p className="line-disclaimer mt-5">
        仅供传统文化参考与娱乐体验，不构成医疗、投资、婚姻或人生决策建议。
      </p>
    </article>
  );
}
