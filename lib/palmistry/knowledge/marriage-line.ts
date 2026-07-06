import { SAFETY_CLAUSE, type PalmKnowledgeEntry } from "./types";

export const marriageLineKnowledge: PalmKnowledgeEntry = {
  id: "marriage-line",
  name: "婚姻线",
  description: "常指小指下方掌侧短横纹，拍照角度稍有偏差就可能看不清。",
  folkMeaning: "民间说法常把它与亲密关系态度、承诺感和沟通模式联系起来。",
  entertainmentInterpretation: "从娱乐角度看，婚姻线只适合作为关系自我觉察话题，而非关系结论。",
  positiveAngle: "适合提醒用户表达需求、尊重边界、提升沟通质量。",
  cautionText: `不用于判断结婚、离婚、分手或伴侣选择。${SAFETY_CLAUSE}`,
};
