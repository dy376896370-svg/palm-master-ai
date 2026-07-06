import { SAFETY_CLAUSE, type PalmKnowledgeEntry } from "./types";

export const heartLineKnowledge: PalmKnowledgeEntry = {
  id: "heart-line",
  name: "感情线",
  description: "通常位于四指下方、掌心上部，是掌纹娱乐解读中与情绪表达相关的主线。",
  folkMeaning: "民间说法常把它与情绪敏感度、表达方式、亲密互动和边界感联系起来。",
  entertainmentInterpretation: "从娱乐角度看，感情线可作为观察沟通习惯和关系需求的入口。",
  positiveAngle: "适合提醒用户温和表达感受、练习倾听、建立健康边界。",
  cautionText: `不用于判断婚姻结果、分手或伴侣关系命运。${SAFETY_CLAUSE}`,
};
