"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Aperture,
  Camera,
  Check,
  Clock3,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  SunMedium,
} from "lucide-react";
import type { PalmReport } from "@/lib/report-schema";
import {
  analyzePalmVisionImage,
  type PalmVisionResult,
} from "./palm-vision-assist";
import { ReportView } from "./report-view";

const schools = ["麻衣神相", "神相全编", "冰鉴", "周易", "Palmistry"];
const ANALYSIS_TIMEOUT_MS = 70_000;
const TIMEOUT_MESSAGE =
  "AI分析超时，请稍后重试或换一张更清晰的照片";
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PROGRESS_STEPS = [
  { after: 0, label: "正在安全上传照片" },
  { after: 4, label: "正在检查清晰度与手掌完整性" },
  { after: 10, label: "正在观察主要掌纹特征" },
  { after: 20, label: "正在汇集五大体系参考" },
  { after: 35, label: "正在整理你的文化报告" },
];

type AnalyzeResponse = {
  report?: PalmReport;
  error?: {
    message?: string;
    type?: string;
    status?: number;
    retryable?: boolean;
  };
  fallback?: {
    type?: string;
    message?: string;
    retryable?: boolean;
  };
};

function safeParseAnalyzeResponse(text: string): AnalyzeResponse | null {
  if (!text.trim()) return null;

  try {
    return JSON.parse(text) as AnalyzeResponse;
  } catch {
    return null;
  }
}

function getFallbackErrorMessage(status: number) {
  if (status === 504) return TIMEOUT_MESSAGE;
  if (status === 503) return "AI 服务暂时不可用，请稍后重试。";
  if (status === 429) return "当前体验人数较多，请稍后重试。";
  if (status >= 500) return "分析服务暂时异常，请稍后重试。";
  return "分析暂时失败，请检查照片后重试。";
}

function getFriendlyErrorMessage(error?: AnalyzeResponse["error"], status?: number) {
  if (!error) return getFallbackErrorMessage(status ?? 500);

  switch (error.type) {
    case "missing_openai_api_key":
      return "AI 服务暂未配置完成，请联系网站维护者。";
    case "openai_auth_error":
      return "AI 服务授权暂时不可用，请联系网站维护者。";
    case "openai_quota_exceeded":
      return "今日 AI 体验额度已用完，请稍后再来。";
    case "openai_rate_limited":
    case "rate_limited":
      return "当前体验人数较多，请稍后重试。";
    case "openai_server_error":
      return "AI服务暂时繁忙，请稍后重试。";
    case "openai_connection_error":
      return "暂时无法连接 AI 服务，请稍后重试。";
    case "timeout":
      return TIMEOUT_MESSAGE;
    case "openai_bad_request":
    case "empty_ai_report":
      return "AI 无法完成本次结构化分析，请换一张清晰照片重试。";
    default:
      return error.message || getFallbackErrorMessage(status ?? 500);
  }
}

export function PalmAnalyzer() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [report, setReport] = useState<PalmReport | null>(null);
  const [visionResult, setVisionResult] = useState<PalmVisionResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [consented, setConsented] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => {
    if (!loading) return;

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [loading]);

  const progressLabel = useMemo(
    () =>
      [...PROGRESS_STEPS]
        .reverse()
        .find((step) => elapsedSeconds >= step.after)?.label ??
      PROGRESS_STEPS[0].label,
    [elapsedSeconds],
  );

  function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;

    if (!ALLOWED_TYPES.has(selected.type)) {
      setError("请选择 JPG、PNG 或 WebP 格式的照片。");
      event.target.value = "";
      return;
    }

    if (selected.size > MAX_FILE_SIZE) {
      setError("照片超过 8MB，请换一张较小的照片。");
      event.target.value = "";
      return;
    }

    if (preview) URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setReport(null);
    setVisionResult(null);
    setError("");
  }

  async function analyze() {
    if (!file) {
      setError("请先上传或拍摄一张手掌照片。");
      return;
    }

    if (!consented) {
      setError("请先确认已阅读照片处理说明。");
      return;
    }

    setLoading(true);
    setElapsedSeconds(0);
    setError("");
    const body = new FormData();
    body.append("image", file);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      ANALYSIS_TIMEOUT_MS,
    );

    try {
      try {
        const vision = await analyzePalmVisionImage(preview);
        setVisionResult(vision);
        body.append(
          "vision",
          JSON.stringify({
            imageQuality: vision.imageQuality,
            roi: vision.roi,
            lines: vision.lines,
          }),
        );
      } catch {
        setVisionResult(null);
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        body,
        signal: controller.signal,
      });

      const responseText = await response.text();
      const data = safeParseAnalyzeResponse(responseText);

      if (!response.ok) {
        throw new Error(getFriendlyErrorMessage(data?.error, response.status));
      }

      if (!data?.report) {
        throw new Error("分析结果格式异常，请稍后重试。");
      }

      setReport(data.report);
      requestAnimationFrame(() =>
        document.getElementById("report")?.scrollIntoView({ behavior: "smooth" }),
      );
    } catch (cause) {
      const isTimeout =
        cause instanceof DOMException && cause.name === "AbortError";
      setError(
        isTimeout
          ? TIMEOUT_MESSAGE
          : cause instanceof Error
            ? cause.message || "网络连接失败，请稍后重试。"
            : "分析失败，请重试。",
      );
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
      setElapsedSeconds(0);
    }
  }

  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview("");
    setReport(null);
    setVisionResult(null);
    setError("");
    setConsented(false);
    setElapsedSeconds(0);
    if (uploadRef.current) uploadRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="min-h-screen overflow-hidden">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="seal">掌</div>
          <div>
            <p className="font-serif text-lg font-semibold tracking-[0.15em] text-stone-100">
              AI手相大师
            </p>
            <p className="text-[10px] uppercase tracking-[0.28em] text-amber-200/50">
              Palm Master AI
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-2 text-xs text-stone-400 sm:flex">
          <ShieldCheck className="h-4 w-4 text-amber-300/70" />
          照片仅用于本次分析
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:pt-20">
        <div>
          <div className="eyebrow">
            <Sparkles className="h-3.5 w-3.5" />
            五大经典体系 · 联合解读
          </div>
          <h1 className="mt-6 font-serif text-5xl font-semibold leading-[1.12] tracking-tight text-stone-50 sm:text-7xl">
            看见掌心纹理，
            <br />
            <span className="gold-text">读懂此刻的自己</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-stone-400 sm:text-lg">
            上传手掌照片，AI 将从可见纹理出发，汇集东方古典相学与西方
            Palmistry，为你生成一份克制、细腻的文化解读。
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            {schools.map((school, index) => (
              <span className="school-chip" key={school}>
                <span>{index + 1}</span>
                {school}
              </span>
            ))}
          </div>

          <div className="mt-10 grid max-w-lg grid-cols-3 gap-5 border-t border-white/8 pt-6 text-sm text-stone-400">
            <div><strong>01</strong><br />上传照片</div>
            <div><strong>02</strong><br />AI观察</div>
            <div><strong>03</strong><br />获得报告</div>
          </div>
        </div>

        <div className="upload-card">
          <div className="corner corner-tl" />
          <div className="corner corner-tr" />
          <div className="corner corner-bl" />
          <div className="corner corner-br" />

          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="font-serif text-xl text-stone-100">掌纹观照</p>
              <p className="mt-1 text-xs text-stone-500">请拍摄完整、清晰的手掌正面</p>
            </div>
            <Aperture className="h-6 w-6 text-amber-300/60" />
          </div>

          <div className="shooting-guide mb-4">
            <p>为了获得更好的报告，请这样拍：</p>
            <ul>
              <li>掌心朝向镜头</li>
              <li>手掌完全张开</li>
              <li>掌心占画面 80%</li>
              <li>光线均匀</li>
              <li>不要开美颜</li>
              <li>避免复杂背景</li>
            </ul>
          </div>

          <div className="photo-guide mb-4">
            <div><SunMedium /><span>光线均匀</span></div>
            <div><Aperture /><span>手掌完整</span></div>
            <div><Camera /><span>镜头平行</span></div>
          </div>

          <button
            className={`photo-stage ${preview ? "has-photo" : ""}`}
            onClick={() => uploadRef.current?.click()}
            type="button"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="待分析的手掌预览" />
            ) : (
              <div className="flex flex-col items-center">
                <div className="palm-mark">掌</div>
                <p className="mt-5 text-sm font-medium text-stone-300">点击选择手掌照片</p>
                <p className="mt-2 text-xs text-stone-600">JPG / PNG / WebP · 最大 8MB</p>
              </div>
            )}
          </button>

          <input
            ref={uploadRef}
            className="hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={selectImage}
          />
          <input
            ref={cameraRef}
            className="hidden"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={selectImage}
          />

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button className="secondary-button" onClick={() => uploadRef.current?.click()} type="button">
              <ImagePlus className="h-4 w-4" />上传照片
            </button>
            <button className="secondary-button" onClick={() => cameraRef.current?.click()} type="button">
              <Camera className="h-4 w-4" />打开摄像头
            </button>
          </div>

          <button className="primary-button mt-3" disabled={loading || !file} onClick={analyze} type="button">
            {loading ? (
              <><LoaderCircle className="h-5 w-5 animate-spin" />{progressLabel}</>
            ) : (
              <><Sparkles className="h-5 w-5" />开始分析</>
            )}
          </button>

          {loading && (
            <div className="analysis-progress mt-3">
              <div className="analysis-progress-bar">
                <span style={{ width: `${Math.min(92, 12 + elapsedSeconds * 2)}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-stone-500">
                <span className="flex items-center gap-1.5"><Clock3 className="h-3 w-3" />通常需要 10–40 秒</span>
                <span>{elapsedSeconds} 秒</span>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-lg bg-red-950/40 px-4 py-3 text-sm text-red-200">
              <p>{error}</p>
              {file && (
                <button
                  className="mt-2 text-xs text-red-100 underline underline-offset-4"
                  onClick={analyze}
                  type="button"
                >
                  重新尝试
                </button>
              )}
            </div>
          )}

          <label className="consent-row mt-4">
            <input
              checked={consented}
              onChange={(event) => setConsented(event.target.checked)}
              type="checkbox"
            />
            <span>
              我了解照片会发送给 AI 服务商进行本次分析；本站不建立账户，也不保存照片或报告。
            </span>
          </label>

          <div className="mt-5 flex items-start gap-2 text-[11px] leading-5 text-stone-600">
            <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400/60" />
            仅供传统文化参考与娱乐体验，不构成医疗、投资、婚姻或人生决策建议。
          </div>
        </div>
      </section>

      <section className="relative z-10 border-y border-white/6 bg-black/15">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-10 sm:grid-cols-3 sm:px-8">
          {[
            ["如实观察", "只分析照片中可见的深浅、长度、分叉与清晰度。"],
            ["拒绝断言", "使用可能与倾向性表达，不制造焦虑，不替你做决定。"],
            ["模糊即重拍", "照片不清晰时直接提示重新拍摄，不编造掌纹内容。"],
          ].map(([title, text], index) => (
            <div className="principle" key={title}>
              <span>0{index + 1}</span>
              <div><h2>{title}</h2><p>{text}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="text-center">
          <p className="section-kicker">开始之前</p>
          <h2 className="mt-3 font-serif text-3xl text-stone-100 sm:text-4xl">
            一次安心、克制的 AI 文化体验
          </h2>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            ["不保存照片", "照片仅用于完成当前请求，本站不建立个人档案或历史记录。"],
            ["看不清就拒绝", "手掌不完整或纹理模糊时，系统会要求重拍，而不是编造结果。"],
            ["不替你做决定", "所有内容是文化参考和自我探索，不预测疾病、财富或关系结果。"],
          ].map(([title, text]) => (
            <article className="trust-card" key={title}>
              <Check className="h-5 w-5 text-amber-300/70" />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      {report && (
        <div id="report" className="relative z-10">
          <ReportView
            imageSrc={preview}
            initialVisionResult={visionResult}
            report={report}
          />
          <div className="mx-auto max-w-4xl px-5 pb-24 text-center">
            <button className="secondary-button inline-flex w-auto px-6" onClick={reset} type="button">
              <RotateCcw className="h-4 w-4" />分析另一张照片
            </button>
          </div>
        </div>
      )}

      <footer className="relative z-10 border-t border-white/6 px-5 py-8 text-center text-xs text-stone-600">
        <p>© {new Date().getFullYear()} Palm Master AI · 传统文化参考 · 娱乐体验 · 自我探索</p>
        <div className="mt-3 flex justify-center gap-5">
          <a className="hover:text-stone-400" href="/privacy">隐私说明</a>
          <a className="hover:text-stone-400" href="/terms">使用条款</a>
        </div>
      </footer>
    </main>
  );
}
