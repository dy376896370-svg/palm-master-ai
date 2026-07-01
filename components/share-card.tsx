"use client";

import { Download, ImageDown, Share2 } from "lucide-react";
import { useState } from "react";
import type { PalmReport } from "@/lib/report-schema";

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const lines: string[] = [];
  let current = "";

  for (const character of text) {
    const candidate = current + character;
    if (context.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }

  if (current) lines.push(current);
  return lines;
}

async function createShareImage(report: PalmReport) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1440;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法生成分享图片");

  const background = context.createLinearGradient(0, 0, 1080, 1440);
  background.addColorStop(0, "#0b1420");
  background.addColorStop(0.55, "#070b11");
  background.addColorStop(1, "#120e09");
  context.fillStyle = background;
  context.fillRect(0, 0, 1080, 1440);

  context.strokeStyle = "rgba(215,181,109,.55)";
  context.lineWidth = 2;
  context.strokeRect(54, 54, 972, 1332);

  context.fillStyle = "#d7b56d";
  context.font = "500 28px serif";
  context.fillText("PALM MASTER AI", 92, 120);

  context.fillStyle = "#f2efe8";
  context.font = "600 72px serif";
  context.fillText("我的掌心文化报告", 92, 245);

  context.fillStyle = "#8d8981";
  context.font = "30px sans-serif";
  context.fillText("五大体系联合解读 · 仅供娱乐参考", 92, 305);

  context.fillStyle = "#d7b56d";
  context.font = "500 26px sans-serif";
  context.fillText("本次关键词", 92, 410);

  let y = 480;
  context.font = "500 42px sans-serif";
  for (const theme of report.finalSynthesis.keyThemes.slice(0, 3)) {
    context.fillStyle = "#eee8dd";
    context.fillText(`◇ ${theme}`, 92, y);
    y += 78;
  }

  context.strokeStyle = "rgba(255,255,255,.1)";
  context.beginPath();
  context.moveTo(92, 745);
  context.lineTo(988, 745);
  context.stroke();

  context.fillStyle = "#d7b56d";
  context.font = "500 26px sans-serif";
  context.fillText("AI 综合寄语", 92, 825);

  context.fillStyle = "#c8c3ba";
  context.font = "34px sans-serif";
  const summary =
    report.share.oneLineSummary ||
    report.share.summary ||
    report.overallImpression.modernReflection;
  const summaryLines = wrapText(context, summary, 860).slice(0, 6);
  summaryLines.forEach((line, index) => {
    context.fillText(line, 92, 895 + index * 58);
  });

  context.fillStyle = "#77736c";
  context.font = "25px sans-serif";
  context.fillText("传统文化参考 · 娱乐体验 · 自我探索", 92, 1280);
  context.fillText("不构成医疗、投资、婚姻、寿命或死亡建议", 92, 1325);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("生成图片失败"))),
      "image/png",
    );
  });
}

export function ShareCard({ report }: { report: PalmReport }) {
  const [working, setWorking] = useState(false);

  async function generate(mode: "share" | "download") {
    setWorking(true);
    try {
      const blob = await createShareImage(report);
      const file = new File([blob], `掌心文化报告-${report.reportId}.png`, {
        type: "image/png",
      });

      if (
        mode === "share" &&
        navigator.share &&
        navigator.canShare?.({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: report.share.title,
          text: "我的 AI 掌心文化报告，仅供娱乐参考。",
        });
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="share-panel mt-8">
      <div>
        <div className="flex items-center gap-2 text-amber-200">
          <ImageDown className="h-4 w-4" />
          <h4 className="font-serif text-lg">生成分享海报</h4>
        </div>
        <p className="mt-2 text-xs leading-6 text-stone-500">
          海报只包含报告关键词与寄语，不包含你的手掌照片。
        </p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          className="secondary-button"
          disabled={working}
          onClick={() => generate("download")}
          type="button"
        >
          <Download className="h-4 w-4" />保存海报
        </button>
        <button
          className="primary-button"
          disabled={working}
          onClick={() => generate("share")}
          type="button"
        >
          <Share2 className="h-4 w-4" />分享海报
        </button>
      </div>
    </div>
  );
}
