import { BookOpenText, CircleAlert, ExternalLink, Sparkles } from "lucide-react";
import type { PalmLine } from "@/lib/report-schema";
import { SOURCE_NOT_COLLECTED } from "@/lib/palm-sources";

const confidenceLabels: Record<PalmLine["confidence"], string> = {
  low: "低置信度",
  medium: "中等置信度",
  high: "较高置信度",
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
            line.isClearlyVisible ? "" : "visibility-low"
          }`}
        >
          {confidenceLabels[line.confidence]}
        </span>
      </div>

      <a
        className="line-annotation-link mt-5"
        href={`#annotation-${line.id}`}
      >
        <span />
        查看这条掌纹在图片上的辅助标注
      </a>

      {!line.isClearlyVisible && (
        <div className="mt-5 flex gap-3 rounded-xl border border-amber-400/15 bg-amber-950/20 p-4 text-sm leading-6 text-amber-100/75">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          这条掌纹在照片中不够清晰，以下内容仅说明传统位置与有限观察，建议重新拍摄后再判断。
        </div>
      )}

      <div className="mt-7 grid gap-4 rounded-xl border border-white/6 bg-black/15 p-5 sm:grid-cols-2">
        <div>
          <p className="field-label">观察特征</p>
          <p className="mt-2 leading-7 text-stone-300">
            {line.visibleFeature}
          </p>
        </div>
        <div>
          <p className="field-label">大概位置</p>
          <p className="mt-2 leading-7 text-stone-300">
            {line.approximatePosition}
          </p>
        </div>
      </div>

      <div className="school-view mt-7">
        <h4>参考依据</h4>
        <p>{line.referenceBasis}</p>
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
          <p className="source-empty mt-4">{SOURCE_NOT_COLLECTED}</p>
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
          <p className="source-empty mt-4">{SOURCE_NOT_COLLECTED}</p>
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
