import { SAFETY_CLAUSE, type PalmKnowledgeEntry } from "./types";

export const lifeLineKnowledge: PalmKnowledgeEntry = {
  id: "life-line",
  name: "生命线",
  description: "通常环绕拇指根部向手腕方向延伸，是掌纹娱乐解读中最常被观察的主线之一。",
  folkMeaning: "民间说法常把它与精力节奏、恢复力、生活稳定感联系在一起。",
  entertainmentInterpretation: "从娱乐角度看，生命线可作为观察自我照顾、作息节奏和持续行动力的提醒。",
  positiveAngle: "适合引导用户关注长期主义、精力管理和稳定投入。",
  cautionText: `不用于判断寿命、疾病或身体状况。${SAFETY_CLAUSE}`,
};
