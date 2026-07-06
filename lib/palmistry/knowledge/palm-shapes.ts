import { SAFETY_CLAUSE, type PalmKnowledgeEntry } from "./types";

export const palmShapesKnowledge: PalmKnowledgeEntry = {
  id: "palm-shapes",
  name: "手型",
  description: "手型通常从掌形、手指比例、整体轮廓进行娱乐化观察。",
  folkMeaning: "传统说法常把方掌、长掌、圆掌等与行动风格、稳定性和感受力联系起来。",
  entertainmentInterpretation: "从娱乐角度看，手型可作为理解做事节奏和偏好表达的入口。",
  positiveAngle: "适合帮助用户发现自己的优势表达方式，而不是贴固定人格标签。",
  cautionText: `不用于判断职业命运、阶层或人生价值。${SAFETY_CLAUSE}`,
};
