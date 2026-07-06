import { SAFETY_CLAUSE, type PalmKnowledgeEntry } from "./types";

export const fateLineKnowledge: PalmKnowledgeEntry = {
  id: "fate-line",
  name: "事业线",
  description: "通常被描述为掌心中部向中指方向延伸的纵向纹路，现实照片中经常不明显。",
  folkMeaning: "民间说法常把它与目标感、责任感、事业路径和外部环境影响联系起来。",
  entertainmentInterpretation: "从娱乐角度看，事业线可转译为阶段目标、执行路径和自我驱动力。",
  positiveAngle: "适合鼓励用户把大目标拆成小行动，并观察自己的稳定执行能力。",
  cautionText: `不用于预测升职、失业、成功或失败。${SAFETY_CLAUSE}`,
};
