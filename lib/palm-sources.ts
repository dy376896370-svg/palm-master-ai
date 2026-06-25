import type { PalmLineId, PalmLineSources } from "@/lib/report-schema";

export const SOURCE_NOT_COLLECTED = "当前资料库暂未收录该条原文。";

export type PalmSourceRecord = {
  lineId: PalmLineId;
  lineName: string;
  chineseSources: PalmLineSources["chineseClassics"];
  westernSources: PalmLineSources["westernPalmistry"];
};

const PALM_SOURCE_LIBRARY: Record<PalmLineId, PalmSourceRecord> = {
  "life-line": {
    lineId: "life-line",
    lineName: "生命线",
    chineseSources: [],
    westernSources: [
      {
        book: "Palmistry for All",
        author: "Cheiro",
        originalText:
          "The Line of Life ... runs round the base of the thumb.",
        source: "Chapter III, The Line of Life and Its Variations",
        sourceUrl: "https://www.gutenberg.org/ebooks/20480",
        chineseTranslation: "生命线环绕拇指根部延伸。",
        note: "公版英文资料的短节录；省略号表示删节，仅用于说明传统位置定义。",
      },
    ],
  },
  "head-line": {
    lineId: "head-line",
    lineName: "智慧线",
    chineseSources: [],
    westernSources: [],
  },
  "heart-line": {
    lineId: "heart-line",
    lineName: "感情线",
    chineseSources: [],
    westernSources: [
      {
        book: "Palmistry for All",
        author: "Cheiro",
        originalText:
          "The Line of Heart ... runs across the hand under the fingers.",
        source:
          "Chapter VII, The Line of Heart as Indicating the Affectionate and Emotional Nature",
        sourceUrl: "https://www.gutenberg.org/ebooks/20480",
        chineseTranslation: "感情线横向延伸于手指下方。",
        note: "公版英文资料的短节录；省略号表示删节，仅用于说明传统位置定义。",
      },
    ],
  },
  "fate-line": {
    lineId: "fate-line",
    lineName: "事业线",
    chineseSources: [],
    westernSources: [],
  },
  "wealth-line": {
    lineId: "wealth-line",
    lineName: "财运线",
    chineseSources: [],
    westernSources: [],
  },
  "marriage-line": {
    lineId: "marriage-line",
    lineName: "婚姻线",
    chineseSources: [],
    westernSources: [],
  },
};

export function getPalmLineSources(lineId: PalmLineId): PalmLineSources {
  const record = PALM_SOURCE_LIBRARY[lineId];
  return {
    chineseClassics: record.chineseSources.map((source) => ({ ...source })),
    westernPalmistry: record.westernSources.map((source) => ({ ...source })),
  };
}

export function getPalmSourceRecord(lineId: PalmLineId) {
  return PALM_SOURCE_LIBRARY[lineId];
}
