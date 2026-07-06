import { SAFETY_CLAUSE, type PalmKnowledgeEntry } from "./types";

export const specialMarksKnowledge: PalmKnowledgeEntry = {
  id: "special-marks",
  name: "特殊纹路",
  description: "包括分叉、岛纹、十字纹、星纹、断续纹等，在普通照片中需要谨慎观察。",
  folkMeaning: "民间说法常把特殊纹路理解为阶段变化、注意力分散或某类经验的象征。",
  entertainmentInterpretation: "从娱乐角度看，特殊纹路适合转译为提醒用户关注变化、压力和选择节点。",
  positiveAngle: "适合引导用户复盘近期状态，找到可以改善的小切口。",
  cautionText: `不用于判断灾祸、疾病、死亡或不可改变的命运。${SAFETY_CLAUSE}`,
};
