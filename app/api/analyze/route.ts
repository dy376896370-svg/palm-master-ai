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
  type PalmLineId,
} from "@/lib/report-schema";
import { getPalmLineSources } from "@/lib/palm-sources";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const OPENAI_TIMEOUT_MS = 60_000;
const OPENAI_MAX_RETRIES = 2;
const TIMEOUT_MESSAGE =
  "AI分析超时，请稍后重试或换一张更清晰的照片";
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 8;
const requestLog = new Map<string, number[]>();

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

function jsonError(message: string, type: string, status: number) {
  return Response.json(
    {
      error: {
        message,
        type,
        status,
      },
    },
    { status },
  );
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
      max_output_tokens: 3_500,
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
                visibleFeature:
                  "当前照片未能稳定识别该掌纹。建议手掌完全张开、掌心占画面 80%、使用均匀光线重新拍摄。",
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
      return jsonError(TIMEOUT_MESSAGE, "timeout", 504);
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
          "AI 服务暂时繁忙，系统已自动重试，请稍后再试。",
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
