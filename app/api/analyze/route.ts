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

export async function POST(request: Request) {
  try {
    if (isRateLimited(getClientId(request))) {
      return Response.json(
        { error: "体验人数较多，请十分钟后再试。" },
        { status: 429 },
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "服务尚未配置 OPENAI_API_KEY。" },
        { status: 503 },
      );
    }

    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return Response.json({ error: "请选择一张手掌照片。" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(image.type)) {
      return Response.json(
        { error: "仅支持 JPG、PNG 或 WebP 图片。" },
        { status: 415 },
      );
    }

    if (image.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: "图片不能超过 8MB，请压缩后重试。" },
        { status: 413 },
      );
    }

    const bytes = Buffer.from(await image.arrayBuffer());
    if (!hasValidImageSignature(bytes, image.type)) {
      return Response.json(
        { error: "图片文件无法识别，请重新选择原始照片。" },
        { status: 415 },
      );
    }
    const imageUrl = `data:${image.type};base64,${bytes.toString("base64")}`;
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

    const response = await client.responses.parse({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      input: [
        { role: "system", content: PALM_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "input_text", text: PALM_USER_PROMPT },
            { type: "input_image", image_url: imageUrl, detail: "high" },
          ],
        },
      ],
      text: {
        format: zodTextFormat(palmAiReportSchema, "palm_reading_report"),
      },
      max_output_tokens: 3_500,
    });

    if (!response.output_parsed) {
      return Response.json(
        { error: "本次分析未能生成完整报告，请换一张更清晰的照片重试。" },
        { status: 502 },
      );
    }

    const report = palmReportSchema.parse({
      ...response.output_parsed,
      reportId: `palm_${randomUUID().slice(0, 8)}`,
      generatedAt: new Date().toISOString(),
      lines: response.output_parsed.lines.map((line) => ({
        ...line,
        sources: getPalmLineSources(line.id),
      })),
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
      return Response.json({ error: TIMEOUT_MESSAGE }, { status: 504 });
    }

    if (error instanceof APIConnectionError) {
      return Response.json(
        { error: "暂时无法连接 AI 服务，请稍后重试。" },
        { status: 502 },
      );
    }

    if (error instanceof APIError) {
      if (error.status === 401 || error.status === 403) {
        return Response.json(
          { error: "AI 服务配置暂时不可用，请联系网站维护者。" },
          { status: 503 },
        );
      }

      if (error.status === 429) {
        const quotaExceeded = /quota|billing|credit/i.test(error.message);
        return Response.json(
          {
            error: quotaExceeded
              ? "今日 AI 体验额度已用完，请稍后再来。"
              : "当前体验人数较多，请稍后重试。",
          },
          { status: 429 },
        );
      }

      if (error.status >= 500) {
        return Response.json(
          { error: "AI 服务暂时繁忙，系统已自动重试，请稍后再试。" },
          { status: 502 },
        );
      }

      if (error.status === 400) {
        return Response.json(
          { error: "AI 无法完成本次结构化分析，请换一张清晰照片重试。" },
          { status: 502 },
        );
      }
    }

    return Response.json(
      { error: "分析服务暂时异常，请稍后重试。" },
      { status: 500 },
    );
  }
}
