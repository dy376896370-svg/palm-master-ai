"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Aperture,
  Camera,
  Check,
  Clock3,
  FileImage,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import type { PalmReport } from "@/lib/report-schema";
import {
  analyzePalmVisionImage,
  type PalmVisionResult,
} from "./palm-vision-assist";
import { ReportView } from "./report-view";
import { Alert } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Progress } from "./ui/progress";

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

type ManualFeatures = {
  lifeLine: {
    visibility: "not_sure" | "clear" | "unclear";
    length: "not_sure" | "long" | "medium" | "short";
    depth: "not_sure" | "deep" | "light";
    continuity: "not_sure" | "continuous" | "broken" | "forked";
  };
  headLine: {
    visibility: "not_sure" | "clear" | "unclear";
    direction: "not_sure" | "straight" | "curved";
  };
  heartLine: {
    visibility: "not_sure" | "clear" | "unclear";
    depth: "not_sure" | "deep" | "light";
    continuity: "not_sure" | "continuous" | "broken" | "forked";
  };
  fateLine: {
    visibility: "not_sure" | "clear" | "unclear";
    depth: "not_sure" | "deep" | "light";
  };
  palmShape: "unclear" | "square" | "long" | "round" | "fire" | "water" | "earth" | "air";
  thumb: "unclear" | "strong" | "weak" | "flexible";
};

const defaultManualFeatures: ManualFeatures = {
  lifeLine: {
    visibility: "not_sure",
    length: "not_sure",
    depth: "not_sure",
    continuity: "not_sure",
  },
  headLine: {
    visibility: "not_sure",
    direction: "not_sure",
  },
  heartLine: {
    visibility: "not_sure",
    depth: "not_sure",
    continuity: "not_sure",
  },
  fateLine: {
    visibility: "not_sure",
    depth: "not_sure",
  },
  palmShape: "unclear",
  thumb: "unclear",
};

function FeatureSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-600">
        {label}
      </span>
      <select
        className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-zinc-200 outline-none transition focus:border-white/25"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

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
    case "missing_image":
      return "请先上传或拍摄一张手掌照片。";
    case "unsupported_image_type":
      return "图片格式不支持，请上传 JPG、PNG 或 WebP。";
    case "image_too_large":
      return "照片超过 8MB，请换一张较小的照片。";
    case "invalid_image_file":
      return "图片文件无法识别，请重新选择原始照片。";
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
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [consented, setConsented] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [manualFeatures, setManualFeatures] = useState<ManualFeatures>(
    defaultManualFeatures,
  );
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
    setNotice("");
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
    setNotice("");
    const body = new FormData();
    body.append("image", file);
    body.append("manualFeatures", JSON.stringify(manualFeatures));
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

      if (data.fallback?.message || data.error?.type === "timeout") {
        setNotice(
          data.fallback?.message ||
            "完整报告暂时不可用，已自动切换为快速报告。",
        );
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
    setNotice("");
    setConsented(false);
    setElapsedSeconds(0);
    setManualFeatures(defaultManualFeatures);
    if (uploadRef.current) uploadRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#050506] text-zinc-50">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(255,255,255,.13),transparent_28%),radial-gradient(circle_at_78%_18%,rgba(201,166,84,.12),transparent_26%),linear-gradient(180deg,#08090b_0%,#050506_55%,#030304_100%)]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white text-sm font-semibold text-zinc-950 shadow-[0_18px_60px_rgba(255,255,255,.14)]">
            PM
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-white">Palm Master</p>
            <p className="text-[11px] text-zinc-500">AI Palm Canon Experience</p>
          </div>
        </div>
        <nav className="hidden items-center gap-2 md:flex">
          {["Privacy-first", "No destiny claims", "Share-ready"].map((item) => (
            <Badge key={item}>{item}</Badge>
          ))}
        </nav>
      </header>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-10 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[1.04fr_.96fr] lg:items-center lg:pb-24 lg:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <Badge className="border-amber-200/15 bg-amber-100/5 text-amber-100">
            <Sparkles className="h-3.5 w-3.5" />
            Entertainment culture report
          </Badge>
          <h1 className="mt-7 max-w-4xl text-5xl font-semibold leading-[0.98] tracking-[-0.06em] text-white sm:text-7xl lg:text-8xl">
            Your palm, translated into a calm AI profile.
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-8 text-zinc-400 sm:text-lg">
            上传一张手掌照片，Palm Master 会先做照片质量诊断，再结合掌纹知识库、规则引擎与 AI 解读，生成一份漂亮、克制、可分享的娱乐文化档案。
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            {schools.map((school) => (
              <Badge className="bg-white/[0.045]" key={school}>
                {school}
              </Badge>
            ))}
          </div>

          <div className="mt-12 grid max-w-2xl gap-3 sm:grid-cols-3">
            {[
              ["01", "Upload", "清晰掌心照片"],
              ["02", "Analyze", "照片质量与纹理观察"],
              ["03", "Share", "生成掌纹档案卡"],
            ].map(([step, title, text]) => (
              <Card className="p-5" key={step}>
                <p className="text-xs text-zinc-500">{step}</p>
                <h3 className="mt-3 text-sm font-medium text-white">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-zinc-500">{text}</p>
              </Card>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.12, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between px-1 pb-4">
            <div>
              <p className="text-sm font-medium text-white">Create your palm profile</p>
              <p className="mt-1 text-xs text-zinc-500">JPG / PNG / WebP · 最大 8MB</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-zinc-300">
              <Aperture className="h-5 w-5" />
            </div>
          </div>

          <button
            className="group relative grid min-h-[360px] w-full place-items-center overflow-hidden rounded-[24px] border border-dashed border-white/14 bg-black/40 transition hover:border-white/28"
            onClick={() => uploadRef.current?.click()}
            type="button"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="待分析的手掌预览"
                className="h-[360px] w-full object-contain"
              />
            ) : (
              <div className="flex max-w-xs flex-col items-center px-8 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-3xl bg-white text-zinc-950 shadow-[0_18px_80px_rgba(255,255,255,.12)] transition group-hover:scale-105">
                  <FileImage className="h-7 w-7" />
                </div>
                <p className="mt-6 text-base font-medium text-white">Drop in a palm photo</p>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  掌心朝向镜头，手掌完全张开，掌心占画面约 80%。
                </p>
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
            <Button variant="secondary" onClick={() => uploadRef.current?.click()} type="button">
              <ImagePlus className="h-4 w-4" />上传照片
            </Button>
            <Button variant="secondary" onClick={() => cameraRef.current?.click()} type="button">
              <Camera className="h-4 w-4" />打开摄像头
            </Button>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium text-white">
                  看不清时，补充可见特征
                </p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  可选项。不是手动画线，只把你看得见的现象交给 Palm Feature Engine。
                </p>
              </div>
              <Badge>2.0</Badge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <FeatureSelect
                label="生命线是否清晰"
                value={manualFeatures.lifeLine.visibility}
                options={[
                  ["not_sure", "不确定"],
                  ["clear", "清晰"],
                  ["unclear", "模糊 / 看不清"],
                ]}
                onChange={(value) =>
                  setManualFeatures((current) => ({
                    ...current,
                    lifeLine: {
                      ...current.lifeLine,
                      visibility: value as ManualFeatures["lifeLine"]["visibility"],
                    },
                  }))
                }
              />
              <FeatureSelect
                label="生命线长度"
                value={manualFeatures.lifeLine.length}
                options={[
                  ["not_sure", "不确定"],
                  ["long", "偏长"],
                  ["medium", "中等"],
                  ["short", "偏短"],
                ]}
                onChange={(value) =>
                  setManualFeatures((current) => ({
                    ...current,
                    lifeLine: {
                      ...current.lifeLine,
                      length: value as ManualFeatures["lifeLine"]["length"],
                    },
                  }))
                }
              />
              <FeatureSelect
                label="智慧线方向"
                value={manualFeatures.headLine.direction}
                options={[
                  ["not_sure", "不确定"],
                  ["straight", "偏直"],
                  ["curved", "偏弯"],
                ]}
                onChange={(value) =>
                  setManualFeatures((current) => ({
                    ...current,
                    headLine: {
                      ...current.headLine,
                      direction: value as ManualFeatures["headLine"]["direction"],
                    },
                  }))
                }
              />
              <FeatureSelect
                label="感情线状态"
                value={manualFeatures.heartLine.continuity}
                options={[
                  ["not_sure", "不确定"],
                  ["continuous", "连续"],
                  ["broken", "断续"],
                  ["forked", "有分叉"],
                ]}
                onChange={(value) =>
                  setManualFeatures((current) => ({
                    ...current,
                    heartLine: {
                      ...current.heartLine,
                      continuity:
                        value as ManualFeatures["heartLine"]["continuity"],
                    },
                  }))
                }
              />
              <FeatureSelect
                label="感情线深浅"
                value={manualFeatures.heartLine.depth}
                options={[
                  ["not_sure", "不确定"],
                  ["deep", "较深 / 明显"],
                  ["light", "较浅"],
                ]}
                onChange={(value) =>
                  setManualFeatures((current) => ({
                    ...current,
                    heartLine: {
                      ...current.heartLine,
                      depth: value as ManualFeatures["heartLine"]["depth"],
                    },
                  }))
                }
              />
              <FeatureSelect
                label="手型"
                value={manualFeatures.palmShape}
                options={[
                  ["unclear", "不确定"],
                  ["square", "方掌"],
                  ["long", "长掌"],
                  ["round", "圆掌"],
                  ["fire", "火型"],
                  ["water", "水型"],
                  ["earth", "土型"],
                  ["air", "风型"],
                ]}
                onChange={(value) =>
                  setManualFeatures((current) => ({
                    ...current,
                    palmShape: value as ManualFeatures["palmShape"],
                  }))
                }
              />
            </div>
          </div>

          <Button
            className="mt-3 w-full"
            disabled={loading || !file}
            onClick={analyze}
            size="lg"
            type="button"
          >
            {loading ? (
              <>
                <LoaderCircle className="h-5 w-5 animate-spin" />
                {progressLabel}
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                生成掌纹档案
              </>
            )}
          </Button>

          {loading && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
              <Progress value={Math.min(92, 12 + elapsedSeconds * 2)} />
              <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5" />
                  通常需要 10–40 秒
                </span>
                <span>{elapsedSeconds} 秒</span>
              </div>
            </div>
          )}

          {error && (
            <Alert className="mt-4 border-red-400/20 bg-red-950/25 text-red-100">
              <p>{error}</p>
              {file && (
                <button
                  className="mt-2 text-xs text-red-100 underline underline-offset-4"
                  onClick={analyze}
                  type="button"
                >
                  一键重试
                </button>
              )}
            </Alert>
          )}

          {notice && (
            <Alert className="mt-4 border-amber-300/20 bg-amber-950/20 text-amber-100">
              {notice}
            </Alert>
          )}

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-xs leading-6 text-zinc-500">
            <input
              checked={consented}
              className="mt-1 accent-white"
              onChange={(event) => setConsented(event.target.checked)}
              type="checkbox"
            />
            <span>
              我了解照片会发送给 AI 服务商进行本次分析；本站不建立账户，也不保存照片或报告。
            </span>
          </label>

          <div className="mt-4 flex items-start gap-2 px-1 text-[11px] leading-5 text-zinc-600">
            <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
            仅供传统文化娱乐参考，不代表真实命运，不作为医疗、投资、婚姻、职业决策依据。
          </div>
        </Card>
        </motion.div>
      </section>

      <section className="relative z-10 border-y border-white/8 bg-white/[0.025]">
        <div className="mx-auto grid max-w-7xl gap-px px-5 py-8 sm:grid-cols-3 sm:px-8">
          {[
            ["Photo quality first", "先判断清晰度、完整度和掌心占比。"],
            ["Rules + Knowledge", "用掌纹知识库和规则引擎生成结构化档案。"],
            ["Safe by design", "不做命运、医疗、投资或婚姻决策建议。"],
          ].map(([title, text]) => (
            <div className="px-0 py-4 sm:px-6" key={title}>
              <div className="mb-4 h-px w-10 bg-white/30" />
              <h3 className="text-sm font-medium text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-500">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <div className="max-w-2xl">
          <Badge>Trust layer</Badge>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
            A palm report that behaves like a modern AI product.
          </h2>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            ["不保存照片", "照片仅用于当前请求，不建立个人档案或历史记录。"],
            ["看不清就重拍", "手掌不完整或纹理模糊时，系统会提示重试。"],
            ["只做娱乐文化", "不预测疾病、财富、寿命、死亡或关系结果。"],
          ].map(([title, text]) => (
            <Card className="p-6" key={title}>
              <Check className="h-5 w-5 text-zinc-300" />
              <h3 className="mt-8 text-lg font-medium text-white">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-zinc-500">{text}</p>
            </Card>
          ))}
        </div>
      </section>

      {report && (
        <motion.div
          id="report"
          className="relative z-10"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <ReportView
            imageSrc={preview}
            initialVisionResult={visionResult}
            onReset={reset}
            report={report}
          />
          <div className="mx-auto max-w-5xl px-5 pb-24 text-center">
            <Button variant="secondary" onClick={reset} type="button">
              <RotateCcw className="h-4 w-4" />分析另一张照片
            </Button>
          </div>
        </motion.div>
      )}

      <footer className="relative z-10 border-t border-white/8 px-5 py-8 text-center text-xs text-zinc-600">
        <p>© {new Date().getFullYear()} Palm Master · Entertainment culture reference</p>
        <div className="mt-3 flex justify-center gap-5">
          <a className="hover:text-zinc-400" href="/privacy">隐私说明</a>
          <a className="hover:text-zinc-400" href="/terms">使用条款</a>
        </div>
      </footer>
    </main>
  );
}
