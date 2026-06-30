import { randomUUID } from "node:crypto";
import OpenAI, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
} from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ProxyAgent } from "undici";
import { PALM_SYSTEM_PROMPT, PALM_USER_PROMPT } from "@/lib/palm-prompt";
import {
  palmAiReportSchema,
  palmReportSchema,
  type PalmReport,
  type PalmLineId,
} from "@/lib/report-schema";
import { getPalmLineSources } from "@/lib/palm-sources";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const OPENAI_TIMEOUT_MS = 28_000;
const OPENAI_MAX_RETRIES = 0;
const TIMEOUT_MESSAGE =
  "AI分析超时，请稍后重试或换一张更清晰的照片。";
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 8;
const requestLog = new Map<string, number[]>();

const LINE_META: Record<
  PalmLineId,
  {
    name: PalmReport["lines"][number]["name"];
    position: string;
    traditional: string;
    western: string;
    advice: string;
    question: string;
  }
> = {
  "life-line": {
    name: "生命线",
    position: "通常环绕拇指根部，向手腕方向形成弧线。",
    traditional:
      "以下为传统掌纹体系中常见说法的现代归纳，并非古籍原文。生命线常被看作精力节奏、行动韧性与生活稳定感的象征。",
    western:
      "以下为西方 palmistry 传统观点的现代归纳，并非原文直引。Life Line 多关注弧度、连续性和围绕拇指根部的范围。",
    advice: "把它当作精力管理提醒：观察最近睡眠、运动、压力与恢复节奏，先做一个可持续的小调整。",
    question: "我最近的精力被什么消耗最多？",
  },
  "head-line": {
    name: "智慧线",
    position: "通常位于掌心中部，横向或微斜穿过掌心。",
    traditional:
      "以下为传统掌纹体系中常见说法的现代归纳，并非古籍原文。智慧线常被用来象征思考方式、专注习惯和判断节奏。",
    western:
      "以下为西方 palmistry 传统观点的现代归纳，并非原文直引。Head Line 多观察方向、长度、清晰度与心智表达倾向。",
    advice: "适合把注意力放在决策质量上：重要选择前先列出事实、感受和不确定项，减少反复内耗。",
    question: "我现在最需要想清楚的问题是什么？",
  },
  "heart-line": {
    name: "感情线",
    position: "通常位于四指下方，沿掌心上部横向延伸。",
    traditional:
      "以下为传统掌纹体系中常见说法的现代归纳，并非古籍原文。感情线常被视为情绪表达、人际敏感度和关系边界的象征。",
    western:
      "以下为西方 palmistry 传统观点的现代归纳，并非原文直引。Heart Line 多关联情感表达、亲密需求和互动方式。",
    advice: "把它作为沟通提醒：表达感受时尽量具体，说清需要和边界，而不是急着判断关系结果。",
    question: "我在关系里最想被怎样理解？",
  },
  "fate-line": {
    name: "事业线",
    position: "通常被描述为掌心纵向纹路，可能从掌根向中指方向延伸。",
    traditional:
      "以下为传统掌纹体系中常见说法的现代归纳，并非古籍原文。事业线常被用来象征阶段目标、责任感和行动路径。",
    western:
      "以下为西方 palmistry 传统观点的现代归纳，并非原文直引。Fate Line 多与职业路径、外部结构和方向感相关。",
    advice: "不要把它当作职业预言；更适合复盘当前目标是否清晰，以及下一步是否足够具体。",
    question: "我眼下最重要的责任是什么？",
  },
  "wealth-line": {
    name: "财运线",
    position: "现代说法多指小指下方或掌侧的细纹组合，位置并不完全统一。",
    traditional:
      "以下为传统掌纹体系中常见说法的现代归纳，并非古籍原文。财运相关纹路更适合理解为资源意识和规划习惯。",
    western:
      "以下为西方 palmistry 传统观点的现代归纳，并非原文直引。西方体系常将资源、表达和商业能力放在多条线综合观察。",
    advice: "只把它当作资源管理提醒：记录支出、学习一项能力、优化协作方式，比预测财富更实际。",
    question: "我如何更稳地管理资源？",
  },
  "marriage-line": {
    name: "婚姻线",
    position: "通常指小指下方掌侧的短横纹，照片中常因角度而不清晰。",
    traditional:
      "以下为传统掌纹体系中常见说法的现代归纳，并非古籍原文。婚姻线适合转化为亲密关系态度和沟通边界的象征。",
    western:
      "以下为西方 palmistry 传统观点的现代归纳，并非原文直引。Relationship Lines 常被用作亲密互动倾向参考。",
    advice: "不要用掌纹判断关系结局；更适合反思自己如何表达承诺、需求和边界。",
    question: "我在亲密关系中如何表达边界？",
  },
};

type VisionLineInput = {
  id?: string;
  confidence?: string | number;
  confidenceLabel?: string;
  visionStatus?: string;
  detectionMethod?: string;
  confidenceBreakdown?: {
    roi?: number;
    landmarks?: number;
    edge?: number;
    classification?: number;
    final?: number;
  };
  failureReasons?: string[];
  path?: Array<{ x?: number; y?: number }>;
  annotation?: {
    type?: string;
    points?: Array<{ x?: number; y?: number }>;
  };
};

type VisionPayloadInput = {
  imageQuality?: {
    contrast?: number;
    edgeStrength?: number;
    roiConfidence?: number;
    landmarksConfidence?: number;
    accepted?: boolean;
    failureReasons?: string[];
  };
  lines?: VisionLineInput[];
};

type NormalizedVisionLine = {
  id: PalmLineId;
  confidence: "low" | "medium" | "high";
  visionConfidence: number;
  visionStatus: "detected" | "estimated" | "unavailable";
  detectionMethod: "landmarks-classical-cv" | "template-estimate" | "not-detected";
  confidenceBreakdown: {
    roi: number;
    landmarks: number;
    edge: number;
    classification: number;
    final: number;
  };
  failureReasons: string[];
  annotation: {
    type: "path";
    points: Array<{ x: number; y: number }>;
  };
};

const DEFAULT_ANNOTATIONS: Record<PalmLineId, NormalizedVisionLine> = {
  "life-line": {
    id: "life-line",
    confidence: "low",
    visionConfidence: 0,
    confidenceBreakdown: { roi: 0, landmarks: 0, edge: 0, classification: 0, final: 0 },
    failureReasons: ["landmarks_missing", "candidate_not_found"],
    visionStatus: "unavailable",
    detectionMethod: "not-detected",
    annotation: { type: "path", points: [] },
  },
  "head-line": {
    id: "head-line",
    confidence: "low",
    visionConfidence: 0,
    confidenceBreakdown: { roi: 0, landmarks: 0, edge: 0, classification: 0, final: 0 },
    failureReasons: ["landmarks_missing", "candidate_not_found"],
    visionStatus: "unavailable",
    detectionMethod: "not-detected",
    annotation: { type: "path", points: [] },
  },
  "heart-line": {
    id: "heart-line",
    confidence: "low",
    visionConfidence: 0,
    confidenceBreakdown: { roi: 0, landmarks: 0, edge: 0, classification: 0, final: 0 },
    failureReasons: ["landmarks_missing", "candidate_not_found"],
    visionStatus: "unavailable",
    detectionMethod: "not-detected",
    annotation: { type: "path", points: [] },
  },
  "fate-line": {
    id: "fate-line",
    confidence: "low",
    visionConfidence: 0,
    confidenceBreakdown: { roi: 0, landmarks: 0, edge: 0, classification: 0, final: 0 },
    failureReasons: ["candidate_not_found"],
    visionStatus: "unavailable",
    detectionMethod: "not-detected",
    annotation: { type: "path", points: [] },
  },
  "wealth-line": {
    id: "wealth-line",
    confidence: "low",
    visionConfidence: 0,
    confidenceBreakdown: { roi: 0, landmarks: 0, edge: 0, classification: 0, final: 0 },
    failureReasons: ["candidate_not_found"],
    visionStatus: "unavailable",
    detectionMethod: "not-detected",
    annotation: { type: "path", points: [] },
  },
  "marriage-line": {
    id: "marriage-line",
    confidence: "low",
    visionConfidence: 0,
    confidenceBreakdown: { roi: 0, landmarks: 0, edge: 0, classification: 0, final: 0 },
    failureReasons: ["candidate_not_found"],
    visionStatus: "unavailable",
    detectionMethod: "not-detected",
    annotation: { type: "path", points: [] },
  },
};

const lineIds = new Set(Object.keys(DEFAULT_ANNOTATIONS));
const confidenceValues = new Set(["low", "medium", "high"]);
const visionStatusValues = new Set(["detected", "estimated", "unavailable"]);
const detectionMethodValues = new Set([
  "landmarks-classical-cv",
  "template-estimate",
  "not-detected",
]);
const failureReasonValues = new Set([
  "image_blurry",
  "palm_rotated",
  "landmarks_missing",
  "candidate_fragmented",
  "low_contrast",
  "roi_unstable",
  "candidate_not_found",
  "classification_score_low",
  "mediapipe_unavailable",
  "path_zigzag_too_high",
  "crosses_fingers",
  "jumps_too_large",
  "outside_palm_roi",
  "touches_image_border",
  "too_vertical_for_heart_or_head",
  "too_many_sharp_turns",
  "too_short",
  "too_long",
]);

function confidenceLabelFromScore(score: number): NormalizedVisionLine["confidence"] {
  if (score >= 0.72) return "high";
  if (score >= 0.46) return "medium";
  return "low";
}

function jsonError(
  message: string,
  type: string,
  status: number,
  retryable = status >= 500 || status === 429 || type === "timeout",
) {
  return Response.json(
    {
      error: {
        message,
        type,
        status,
        retryable,
      },
    },
    { status },
  );
}

function buildFastReport(
  visionMap: Map<PalmLineId, NormalizedVisionLine>,
): PalmReport {
  const merged = new Map<PalmLineId, NormalizedVisionLine>(
    Object.entries(DEFAULT_ANNOTATIONS) as Array<[PalmLineId, NormalizedVisionLine]>,
  );
  for (const [id, line] of visionMap) merged.set(id, line);

  const visibleMainLines = ["life-line", "head-line", "heart-line"]
    .map((id) => merged.get(id as PalmLineId))
    .filter((line) => line && line.visionStatus !== "unavailable").length;
  const score = Math.max(
    35,
    Math.min(
      88,
      Math.round(
        Array.from(merged.values()).reduce(
          (sum, line) => sum + line.confidenceBreakdown.roi + line.confidenceBreakdown.edge,
          0,
        ) / Math.max(1, merged.size) * 50,
      ),
    ),
  );

  const lines = Array.from(merged.values()).map((visionLine) => {
    const meta = LINE_META[visionLine.id];
    const isVisible = visionLine.visionStatus !== "unavailable";
    const visibilityIssue = isVisible
      ? "本次仅作为辅助观察，仍不代表专业精准识别；若想提高可靠度，可用均匀光线重新拍摄。"
      : "本次未能稳定识别该掌纹，常见原因是角度偏斜、掌纹对比度低、掌心占比不足或线条过细。";

    return {
      ...visionLine,
      name: meta.name,
      approximatePosition: meta.position,
      visibilityAssessment: isVisible
        ? "照片中可见部分纹理，但仍以辅助观察为准。"
        : "照片中无法稳定判断该线的完整走向。",
      visibilityIssue,
      visibleFeature: isVisible
        ? "可观察到局部纹理方向和深浅变化，但不做精准坐标判断。"
        : "照片中无法稳定判断该线的连续走向、深浅、分叉或末端变化。",
      isClearlyVisible: isVisible,
      referenceBasis: "原典资料由本地资料库注入；未核验内容不会由 AI 编造。",
      traditionalGeneralInterpretation: meta.traditional,
      westernGeneralInterpretation: meta.western,
      combinedReading: `${meta.name}在快速报告中作为文化象征解读：它不用于预测命运，而是帮助你观察当下的节奏、选择和需要调整的习惯。`,
      practicalAdvice: meta.advice,
      selfObservationQuestion: meta.question,
      sources: getPalmLineSources(visionLine.id),
    };
  });

  return palmReportSchema.parse({
    schemaVersion: "3.0",
    reportId: `fast_${randomUUID().slice(0, 8)}`,
    generatedAt: new Date().toISOString(),
    imageQuality: {
      accepted: score >= 52,
      score,
      issues: score < 52 ? ["照片质量一般，已切换快速报告"] : ["已切换快速报告"],
      retakeGuidance: [
        "手掌完全张开，掌心朝向镜头。",
        "掌心靠近镜头，占画面约 80%。",
        "使用均匀光线，避免反光和复杂背景。",
      ],
    },
    overallImpression: {
      observedFeatures: [
        visibleMainLines ? `三条主线中约 ${visibleMainLines} 条有可参考纹理` : "主线纹理不够稳定",
        "已启用快速报告",
        "仅作文化参考",
      ],
      culturalReading:
        "本次完整报告生成耗时较长，系统已切换为快速 Palm Canon 报告。内容保留照片质量、三条主线和中西观点要点。",
      modernReflection:
        "快速报告更适合先获得方向感：把掌纹当作自我观察的入口，而不是命运判断。若想更细，可稍后重试完整分析。",
    },
    finalSynthesis: {
      keyThemes: ["观察精力节奏", "整理思考方式", "改善沟通边界"],
      selfExplorationQuestions: [
        "我最近最需要调整的生活节奏是什么？",
        "哪些决定需要更多事实而不是焦虑？",
        "我如何更清楚表达自己的需要？",
      ],
      practicalSuggestions: [
        "先做一次睡眠和精力复盘",
        "为重要决定列出事实清单",
        "用一句话表达当前真实需要",
      ],
    },
    safety: {
      entertainmentOnly: true,
      disclaimer: "仅供娱乐参考，不构成医疗、投资、婚姻或人生决策建议。",
      prohibitedAdviceDetected: false,
    },
    share: {
      title: "我的 AI 掌心快速文化报告",
      summary: "这是一份快速 Palm Canon 文化解读，用掌纹作为自我观察入口，而不是命运预测。",
      oneLineSummary: "看见掌纹，也看见此刻可调整的自己。",
      tags: ["Palm Canon", "文化参考", "自我探索"],
    },
    lines,
  });
}

function getClientId(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "local";
}

function isRateLimited(clientId: string) {
  const now = Date.now();
  const recent = (requestLog.get(clientId) || []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );

  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestLog.set(clientId, recent);
    return true;
  }

  requestLog.set(clientId, [...recent, now]);
  return false;
}

function hasValidImageSignature(bytes: Buffer, type: string) {
  if (type === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8;
  }
  if (type === "image/png") {
    return bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }
  if (type === "image/webp") {
    return (
      bytes.subarray(0, 4).toString() === "RIFF" &&
      bytes.subarray(8, 12).toString() === "WEBP"
    );
  }
  return false;
}

function normalizeVisionLine(line: VisionLineInput): NormalizedVisionLine | null {
  if (!line.id || !lineIds.has(line.id)) return null;
  const id = line.id as PalmLineId;
  const fallback = DEFAULT_ANNOTATIONS[id];
  const visionStatus = visionStatusValues.has(line.visionStatus || "")
    ? (line.visionStatus as NormalizedVisionLine["visionStatus"])
    : fallback.visionStatus;
  const detectionMethod = detectionMethodValues.has(line.detectionMethod || "")
    ? (line.detectionMethod as NormalizedVisionLine["detectionMethod"])
    : fallback.detectionMethod;
  const rawConfidence =
    typeof line.confidence === "number"
      ? line.confidence
      : Number(line.confidence);
  const visionConfidence = Number.isFinite(rawConfidence)
    ? Math.min(1, Math.max(0, rawConfidence))
    : fallback.visionConfidence;
  const confidence = confidenceValues.has(line.confidenceLabel || "")
    ? (line.confidenceLabel as NormalizedVisionLine["confidence"])
    : confidenceValues.has(String(line.confidence || ""))
      ? (line.confidence as NormalizedVisionLine["confidence"])
      : confidenceLabelFromScore(visionConfidence);
  const rawPoints = Array.isArray(line.annotation?.points)
    ? line.annotation.points
    : line.path;
  const points = Array.isArray(rawPoints)
    ? rawPoints
        .map((point) => ({
          x: Number(point.x),
          y: Number(point.y),
        }))
        .filter(
          (point) =>
            Number.isFinite(point.x) &&
            Number.isFinite(point.y) &&
            point.x >= 0 &&
            point.x <= 1 &&
            point.y >= 0 &&
            point.y <= 1,
        )
        .slice(0, 12)
    : fallback.annotation.points;
  const confidenceBreakdown = {
    roi: Math.min(1, Math.max(0, Number(line.confidenceBreakdown?.roi ?? fallback.confidenceBreakdown.roi))),
    landmarks: Math.min(1, Math.max(0, Number(line.confidenceBreakdown?.landmarks ?? fallback.confidenceBreakdown.landmarks))),
    edge: Math.min(1, Math.max(0, Number(line.confidenceBreakdown?.edge ?? fallback.confidenceBreakdown.edge))),
    classification: Math.min(1, Math.max(0, Number(line.confidenceBreakdown?.classification ?? fallback.confidenceBreakdown.classification))),
    final: Math.min(1, Math.max(0, Number(line.confidenceBreakdown?.final ?? visionConfidence))),
  };
  const failureReasons = Array.isArray(line.failureReasons)
    ? line.failureReasons.filter((reason) => failureReasonValues.has(reason)).slice(0, 6)
    : fallback.failureReasons;

  return {
    id,
    confidence,
    visionConfidence,
    visionStatus,
    detectionMethod,
    confidenceBreakdown,
    failureReasons,
    annotation: {
      type: "path",
      points,
    },
  };
}

function parseVisionPayload(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return {
      visionMap: new Map<PalmLineId, NormalizedVisionLine>(),
      qualitySummary: "未收到前端照片质量诊断。",
    };
  }

  try {
    const parsed = JSON.parse(value) as VisionPayloadInput;
    const lines = Array.isArray(parsed.lines) ? parsed.lines : [];
    const quality = parsed.imageQuality;
    const qualitySummary = quality
      ? `contrast=${Math.round(Number(quality.contrast ?? 0))}; edgeStrength=${Math.round(Number(quality.edgeStrength ?? 0))}; roiConfidence=${Math.round(Number(quality.roiConfidence ?? 0) * 100)}%; landmarksConfidence=${Math.round(Number(quality.landmarksConfidence ?? 0) * 100)}%; accepted=${Boolean(quality.accepted)}; qualityFailures=${Array.isArray(quality.failureReasons) ? quality.failureReasons.filter((reason) => failureReasonValues.has(reason)).join("|") || "none" : "none"}`
      : "未收到前端照片质量诊断。";

    return {
      visionMap: new Map(
        lines
          .map(normalizeVisionLine)
          .filter((line): line is NormalizedVisionLine => Boolean(line))
          .map((line) => [line.id, line]),
      ),
      qualitySummary,
    };
  } catch {
    return {
      visionMap: new Map<PalmLineId, NormalizedVisionLine>(),
      qualitySummary: "前端照片质量诊断解析失败。",
    };
  }
}

function buildVisionPrompt(
  visionMap: Map<PalmLineId, NormalizedVisionLine>,
  qualitySummary: string,
) {
  const merged = new Map<PalmLineId, NormalizedVisionLine>(
    Object.entries(DEFAULT_ANNOTATIONS) as Array<[PalmLineId, NormalizedVisionLine]>,
  );
  for (const [id, line] of visionMap) merged.set(id, line);

  const summary = Array.from(merged.values())
    .map(
      (line) =>
        `${line.id}: ${line.visionStatus}/${Math.round(line.visionConfidence * 100)}%/${line.detectionMethod}; failures=${line.failureReasons.join("|") || "none"}`,
    )
    .join("; ");

  return `\n\nPalmVisionResult（由前端图像处理 pipeline 产生；模型只能读取这些结构化结果，不得自行看图、猜坐标或补线）：photoQuality={${qualitySummary}}; lines={${summary}}`;
}

export async function POST(request: Request) {
  let fallbackVisionMap = new Map<PalmLineId, NormalizedVisionLine>();

  try {
    if (isRateLimited(getClientId(request))) {
      return jsonError("体验人数较多，请十分钟后再试。", "rate_limited", 429);
    }

    if (!process.env.OPENAI_API_KEY) {
      return jsonError("API Key 未配置", "missing_openai_api_key", 503);
    }

    const formData = await request.formData();
    const image = formData.get("image");
    const { visionMap, qualitySummary } = parseVisionPayload(formData.get("vision"));
    fallbackVisionMap = visionMap;

    if (!(image instanceof File)) {
      return jsonError("请选择一张手掌照片。", "missing_image", 400);
    }

    if (!ALLOWED_TYPES.has(image.type)) {
      return jsonError("仅支持 JPG、PNG 或 WebP 图片。", "unsupported_image_type", 415);
    }

    if (image.size > MAX_FILE_SIZE) {
      return jsonError("图片不能超过 8MB，请压缩后重试。", "image_too_large", 413);
    }

    const bytes = Buffer.from(await image.arrayBuffer());
    if (!hasValidImageSignature(bytes, image.type)) {
      return jsonError("图片文件无法识别，请重新选择原始照片。", "invalid_image_file", 415);
    }
    const proxyAgent = process.env.OPENAI_PROXY_URL
      ? new ProxyAgent(process.env.OPENAI_PROXY_URL)
      : undefined;
    const proxyFetch: typeof fetch | undefined = proxyAgent
      ? (input, init) =>
          fetch(
            input,
            { ...init, dispatcher: proxyAgent } as RequestInit,
          )
      : undefined;
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: OPENAI_MAX_RETRIES,
      timeout: OPENAI_TIMEOUT_MS,
      fetch: proxyFetch,
    });

    const visionPrompt = buildVisionPrompt(visionMap, qualitySummary);
    const response = await client.responses.parse({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      input: [
        { role: "system", content: PALM_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "input_text", text: `${PALM_USER_PROMPT}${visionPrompt}` },
          ],
        },
      ],
      text: {
        format: zodTextFormat(palmAiReportSchema, "palm_reading_report"),
      },
      max_output_tokens: 2_600,
    });

    if (!response.output_parsed) {
      return jsonError(
        "本次分析未能生成完整报告，请换一张更清晰的照片重试。",
        "empty_ai_report",
        502,
      );
    }

    const report = palmReportSchema.parse({
      ...response.output_parsed,
      reportId: `palm_${randomUUID().slice(0, 8)}`,
      generatedAt: new Date().toISOString(),
      lines: response.output_parsed.lines.map((line) => {
        const visionLine = visionMap.get(line.id) ?? DEFAULT_ANNOTATIONS[line.id];
        return {
          ...line,
          ...visionLine,
          ...(visionLine.visionStatus === "unavailable"
            ? {
                isClearlyVisible: false,
              }
            : {}),
          sources: getPalmLineSources(line.id),
        };
      }),
    });

    return Response.json({ report });
  } catch (error) {
    const errorDetails =
      error instanceof APIError
        ? {
            name: error.name,
            status: error.status,
            code: error.code,
            type: error.type,
            requestId: error.requestID,
            message: error.message,
          }
        : error instanceof Error
          ? {
              name: error.name,
              message: error.message,
            }
          : { message: String(error) };

    console.error("Palm analysis failed:", errorDetails);

    const isTimeout =
      error instanceof APIConnectionTimeoutError ||
      (error instanceof Error &&
        /timed?\s*out|timeout|aborted/i.test(error.message));

    if (isTimeout) {
      const fastReport = buildFastReport(fallbackVisionMap);
      return Response.json({
        report: fastReport,
        error: {
          type: "timeout",
          message: TIMEOUT_MESSAGE,
          retryable: true,
        },
        fallback: {
          type: "timeout",
          message: "完整报告生成超时，已自动切换为快速报告。",
          retryable: true,
        },
      });
    }

    const isSchemaIssue =
      error instanceof Error &&
      /zod|schema|validation|parse/i.test(`${error.name} ${error.message}`);

    if (isSchemaIssue) {
      const fastReport = buildFastReport(fallbackVisionMap);
      return Response.json({
        report: fastReport,
        fallback: {
          type: "schema_fallback",
          message: "完整报告格式不稳定，已自动切换为快速报告。",
          retryable: true,
        },
      });
    }

    if (error instanceof APIConnectionError) {
      return jsonError("暂时无法连接 AI 服务，请稍后重试。", "openai_connection_error", 502);
    }

    if (error instanceof APIError) {
      if (error.status === 401 || error.status === 403) {
        return jsonError(
          "AI 服务配置暂时不可用，请联系网站维护者。",
          "openai_auth_error",
          503,
          false,
        );
      }

      if (error.status === 429) {
        const quotaExceeded = /quota|billing|credit/i.test(error.message);
        return jsonError(
          quotaExceeded
            ? "今日 AI 体验额度已用完，请稍后再来。"
            : "当前体验人数较多，请稍后重试。",
          quotaExceeded ? "openai_quota_exceeded" : "openai_rate_limited",
          429,
        );
      }

      if (error.status >= 500) {
        return jsonError(
          "AI服务暂时繁忙，请稍后重试。",
          "openai_server_error",
          502,
        );
      }

      if (error.status === 400) {
        return jsonError(
          "AI 无法完成本次结构化分析，请换一张清晰照片重试。",
          "openai_bad_request",
          502,
        );
      }

      return jsonError(
        "AI 服务返回异常，请稍后重试。",
        "openai_api_error",
        error.status ?? 502,
      );
    }

    return jsonError("分析服务暂时异常，请稍后重试。", "internal_error", 500);
  }
}
