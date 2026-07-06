import { SAFETY_CLAUSE, type PalmKnowledgeEntry } from "./types";

export const wealthLineKnowledge: PalmKnowledgeEntry = {
  id: "wealth-line",
  name: "财运线",
  description: "现代说法多指小指下方或掌侧的细纹组合，不同体系定义并不完全一致。",
  folkMeaning: "民间说法常把它与资源意识、交易能力、规划习惯和机会敏感度联系起来。",
  entertainmentInterpretation: "从娱乐角度看，财运线适合转译为资源管理和能力积累风格。",
  positiveAngle: "适合鼓励用户记录收支、提高技能、优化协作和长期积累。",
  cautionText: `不用于预测发财、亏损、投资收益或财务结果。${SAFETY_CLAUSE}`,
};
