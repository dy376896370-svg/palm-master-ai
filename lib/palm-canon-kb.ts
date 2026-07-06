/**
 * Palm Canon Knowledge Base
 *
 * 设计原则：
 * - 原典原文、现代解释、AI 建议严格分离。
 * - 未逐字核验的原文不录入，不让 AI 根据书名补写。
 * - 每个解释段都挂 sourceIds，方便未来补充版本、页码、扫描件和译文。
 * - 本文件是结构化知识模型，不是当前报告生成的唯一来源；未来可接入数据库。
 */

export type PalmCanonLineId =
  | "life-line"
  | "head-line"
  | "heart-line"
  | "fate-line"
  | "sun-line"
  | "wealth-line"
  | "marriage-line";

export type PalmCanonTradition =
  | "chinese-canon"
  | "western-palmistry"
  | "indian-tradition"
  | "history"
  | "modern-psychology"
  | "science"
  | "internal-workbench";

export type VerificationStatus =
  | "verified"
  | "candidate"
  | "pending_verification"
  | "not_collected";

export type PalmCanonSource = {
  id: string;
  tradition: PalmCanonTradition;
  title: string;
  author?: string;
  year?: string;
  language?: string;
  url?: string;
  licenseNote: string;
  verificationStatus: VerificationStatus;
  note: string;
};

export type PalmCanonPassage = {
  sourceId: string;
  location: string;
  originalText: string | null;
  originalLanguage: string;
  translationZh: string | null;
  modernExplanationZh: string;
  verificationStatus: VerificationStatus;
  note: string;
};

export type PalmKnowledgeSection = {
  summaryZh: string;
  sourceIds: string[];
  verificationStatus: VerificationStatus;
  notes?: string[];
};

export type PalmCanonEntry = {
  id: PalmCanonLineId;
  nameZh: string;
  nameEn: string;
  aliases: string[];
  aiVisionObservation: {
    observableFeatures: string[];
    qualityRequirements: string[];
    doNotInfer: string[];
  };
  chineseCanon: {
    status: VerificationStatus;
    passages: PalmCanonPassage[];
    modernInterpretation: PalmKnowledgeSection;
  };
  westernPalmistry: {
    status: VerificationStatus;
    passages: PalmCanonPassage[];
    modernInterpretation: PalmKnowledgeSection;
  };
  indianTradition: {
    status: VerificationStatus;
    passages: PalmCanonPassage[];
    modernInterpretation: PalmKnowledgeSection;
  };
  historicalBackground: PalmKnowledgeSection;
  modernPsychologicalInterpretation: PalmKnowledgeSection;
  scientificEvidence: {
    culturalTradition: string;
    lacksScientificEvidence: string;
    relatedScientificBoundary: string;
    sourceIds: string[];
  };
  aiComparativeAnalysis: PalmKnowledgeSection;
  personalizedSuggestions: {
    principles: string[];
    avoid: string[];
    sourceIds: string[];
  };
  shareCardSummary: {
    shortTitle: string;
    summaryZh: string;
    safetyLine: string;
  };
};

export const PALM_CANON_SOURCES: Record<string, PalmCanonSource> = {
  "workbench.source-backlog": {
    id: "workbench.source-backlog",
    tradition: "internal-workbench",
    title: "AI 手相大师：原典资料库补全工作台",
    language: "zh-CN",
    licenseNote: "项目内部核验清单，不作为原典引用。",
    verificationStatus: "verified",
    note: "用于记录哪些中文、印度和西方资料尚未完成逐字校勘。",
  },
  "cheiro.palmistry-for-all.1916": {
    id: "cheiro.palmistry-for-all.1916",
    tradition: "western-palmistry",
    title: "Palmistry for All",
    author: "Cheiro",
    year: "1916",
    language: "en",
    url: "https://www.gutenberg.org/ebooks/20480",
    licenseNote: "Project Gutenberg 公版文本；录入时仅保留必要短引文。",
    verificationStatus: "verified",
    note: "当前已核验生命线和感情线的位置定义短摘录；其他章节待逐条校勘。",
  },
  "benham.laws-scientific-hand-reading": {
    id: "benham.laws-scientific-hand-reading",
    tradition: "western-palmistry",
    title: "The Laws of Scientific Hand Reading",
    author: "William G. Benham",
    year: "1900",
    language: "en",
    url: "https://archive.org/search?query=The%20Laws%20of%20Scientific%20Hand%20Reading%20Benham",
    licenseNote: "需逐页确认版本、公版状态和可引用页码后再录入原文。",
    verificationStatus: "candidate",
    note: "作为西方 palmistry 重要候选资料；本知识库暂不录入未核验原文。",
  },
  "samudrika-shastra.overview": {
    id: "samudrika-shastra.overview",
    tradition: "indian-tradition",
    title: "Samudrika Shastra / Hasta Samudrika",
    language: "sa/en",
    url: "https://en.wikipedia.org/wiki/Samudrika_Shastra",
    licenseNote: "仅作为历史与术语入口；不可替代梵文原典校勘。",
    verificationStatus: "candidate",
    note: "印度身体特征学传统，涉及手相、面相和体相；具体掌纹原文需另找版本核验。",
  },
  "palmistry.scientific-boundary": {
    id: "palmistry.scientific-boundary",
    tradition: "science",
    title: "Palmistry as a pseudoscientific divination practice",
    language: "en",
    url: "https://en.wikipedia.org/wiki/Palmistry",
    licenseNote: "用于科学边界说明；产品文案应避免将掌纹解释包装成科学预测。",
    verificationStatus: "candidate",
    note: "用于说明 palmistry 的预测性主张缺乏可靠科学证据，需在产品中保持娱乐与文化参考定位。",
  },
  "dermatoglyphics.boundary": {
    id: "dermatoglyphics.boundary",
    tradition: "science",
    title: "Dermatoglyphics",
    language: "en",
    url: "https://en.wikipedia.org/wiki/Dermatoglyphics",
    licenseNote: "用于区分科学研究的皮纹学与掌纹占卜。",
    verificationStatus: "candidate",
    note: "皮纹学研究指纹、掌纹等皮肤嵴线，但不支持用掌纹预测命运。",
  },
};

const PENDING_CHINESE_CANON: PalmCanonPassage[] = [
  {
    sourceId: "workbench.source-backlog",
    location: "docs/source-backlog.md",
    originalText: null,
    originalLanguage: "zh",
    translationZh: null,
    modernExplanationZh:
      "中国原典术语与现代掌纹线名存在映射风险；未找到可复查版本、卷次、页码和上下文前，不录入原文。",
    verificationStatus: "pending_verification",
    note: "原典原文：待校勘。",
  },
];

const PENDING_INDIAN_CANON: PalmCanonPassage[] = [
  {
    sourceId: "samudrika-shastra.overview",
    location: "specific manuscript/chapter pending",
    originalText: null,
    originalLanguage: "sa",
    translationZh: null,
    modernExplanationZh:
      "Samudrika Shastra 可作为印度身体特征学传统背景，但具体到单条掌纹的梵文原文尚未逐字核验。",
    verificationStatus: "pending_verification",
    note: "原典原文：待校勘。",
  },
];

const DEFAULT_SCIENCE_EVIDENCE = {
  culturalTradition:
    "掌纹解释属于跨文化传统、象征系统和自我叙事工具，适合用于娱乐体验、文化学习和自我观察。",
  lacksScientificEvidence:
    "目前没有可靠科学证据支持通过掌纹预测寿命、财富、婚姻、疾病或命运结果；产品不得输出决定论结论。",
  relatedScientificBoundary:
    "皮纹学可研究手掌皮肤嵴线的形成、遗传和身份识别边界，但这不同于用掌纹解释性格或预测人生。",
  sourceIds: ["palmistry.scientific-boundary", "dermatoglyphics.boundary"],
};

function entry(
  id: PalmCanonLineId,
  nameZh: string,
  nameEn: string,
  aliases: string[],
  observableFeatures: string[],
  westernPassages: PalmCanonPassage[],
  traditionalMeaning: string,
  westernMeaning: string,
  comparativeSummary: string,
  suggestions: string[],
): PalmCanonEntry {
  return {
    id,
    nameZh,
    nameEn,
    aliases,
    aiVisionObservation: {
      observableFeatures,
      qualityRequirements: [
        "掌心完整入镜，掌心占画面约 70%-80%。",
        "光线均匀，避免强反光、过曝和复杂桌面纹理。",
        "只描述可见深浅、长度、连续性、弧度、分叉和清晰度，不推断命运。",
      ],
      doNotInfer: [
        "不得根据掌纹判断寿命、疾病、财富、婚姻结果或死亡风险。",
        "不得把低置信度视觉结果写成精准识别。",
        "不得让 AI 生成、补写或伪造原典原文。",
      ],
    },
    chineseCanon: {
      status: "pending_verification",
      passages: PENDING_CHINESE_CANON,
      modernInterpretation: {
        summaryZh: traditionalMeaning,
        sourceIds: ["workbench.source-backlog"],
        verificationStatus: "pending_verification",
        notes: ["这是传统掌纹体系中常见说法的现代归纳，并非古籍原文。"],
      },
    },
    westernPalmistry: {
      status: westernPassages.length ? "verified" : "candidate",
      passages: westernPassages,
      modernInterpretation: {
        summaryZh: westernMeaning,
        sourceIds: [
          "cheiro.palmistry-for-all.1916",
          "benham.laws-scientific-hand-reading",
        ],
        verificationStatus: westernPassages.length ? "verified" : "candidate",
        notes: ["这是西方 palmistry 传统观点的现代归纳，并非原文直引。"],
      },
    },
    indianTradition: {
      status: "pending_verification",
      passages: PENDING_INDIAN_CANON,
      modernInterpretation: {
        summaryZh:
          "印度 Samudrika/Hasta Samudrika 传统通常把手部特征放在身体标志整体系统中理解；具体到本线的原文对应仍需版本核验。",
        sourceIds: ["samudrika-shastra.overview"],
        verificationStatus: "pending_verification",
        notes: ["不可将现代线名直接反推为梵文原典条目。"],
      },
    },
    historicalBackground: {
      summaryZh:
        "掌纹解释在中国、西方和印度传统中都曾与身体观察、性情判断和命运象征相关，但不同传统的术语、线名和解释体系并不完全对应。",
      sourceIds: [
        "workbench.source-backlog",
        "cheiro.palmistry-for-all.1916",
        "samudrika-shastra.overview",
      ],
      verificationStatus: "candidate",
    },
    modernPsychologicalInterpretation: {
      summaryZh:
        "现代产品中更适合把这条掌纹作为自我叙事和反思入口：用户可以借由线条的清晰度、走向和传统象征，观察自己的节奏、偏好、压力感和行动方式。",
      sourceIds: ["palmistry.scientific-boundary"],
      verificationStatus: "candidate",
      notes: ["心理学视角仅用于自我反思，不等同临床评估。"],
    },
    scientificEvidence: DEFAULT_SCIENCE_EVIDENCE,
    aiComparativeAnalysis: {
      summaryZh: comparativeSummary,
      sourceIds: [
        "workbench.source-backlog",
        "cheiro.palmistry-for-all.1916",
        "samudrika-shastra.overview",
      ],
      verificationStatus: "candidate",
    },
    personalizedSuggestions: {
      principles: suggestions,
      avoid: [
        "避免预测发财、离婚、生病、死亡或命中注定。",
        "避免把文化象征写成科学诊断。",
        "避免在照片不清晰时强行给出精准结论。",
      ],
      sourceIds: ["palmistry.scientific-boundary"],
    },
    shareCardSummary: {
      shortTitle: `${nameZh} · 文化解读`,
      summaryZh: `${nameZh}适合作为自我观察的一个入口：看见纹理，也看见当下的节奏、选择和可调整之处。`,
      safetyLine: "仅供传统文化参考与娱乐体验，不构成医疗、投资、婚姻或人生决策建议。",
    },
  };
}

export const PALM_CANON_KNOWLEDGE_BASE: Record<
  PalmCanonLineId,
  PalmCanonEntry
> = {
  "life-line": entry(
    "life-line",
    "生命线",
    "Life Line",
    ["地纹", "Line of Life"],
    ["起点区域", "围绕拇指根部的弧度", "长度", "深浅", "连续性", "分叉"],
    [
      {
        sourceId: "cheiro.palmistry-for-all.1916",
        location: "Chapter III, The Line of Life and Its Variations",
        originalText: "The Line of Life ... runs round the base of the thumb.",
        originalLanguage: "en",
        translationZh: "生命线环绕拇指根部延伸。",
        modernExplanationZh:
          "该短引文只用于说明西方传统中生命线的大概位置，不用于判断寿命。",
        verificationStatus: "verified",
        note: "公版英文资料短摘录；省略号表示删节。",
      },
    ],
    "传统相术常把生命线理解为精力状态、行动韧性、生活节奏和身体感受的象征，但不应解释为寿命长短。",
    "西方 palmistry 通常关注生命线围绕拇指根部的弧度、连续性和清晰程度，用来象征活力、稳定感和生活方式倾向。",
    "三种传统都倾向把生命线与生命力或生活状态相连；差异在于中国术语需校勘，西方体系线名较明确，印度传统更常放入整体身体标志系统。",
    ["把生命线作为精力管理提醒，观察近期睡眠、运动和压力节奏。", "如果照片看不清，先重拍，不根据模糊纹理下结论。"],
  ),
  "head-line": entry(
    "head-line",
    "智慧线",
    "Head Line",
    ["人纹", "Line of Head", "Line of Mentality"],
    ["横穿掌心的位置", "倾斜角度", "连续性", "深浅", "末端走向"],
    [],
    "传统相术常把智慧线理解为思考方式、专注力、判断习惯和处事节奏的象征。",
    "西方 palmistry 多把 Head Line 视为心智模式和思维路径的象征，关注其方向、长度、清晰度和与其他主线的关系。",
    "三种传统都可把该线作为心智与判断的象征入口；差异在于西方线名较固定，中国传统需核对‘人纹’等术语是否稳定对应。",
    ["把智慧线解读为思考习惯的提醒，观察自己更偏直觉、分析还是反复权衡。", "用问题替代断言：最近哪些决定需要更清晰的信息？"],
  ),
  "heart-line": entry(
    "heart-line",
    "感情线",
    "Heart Line",
    ["天纹", "Line of Heart"],
    ["四指下方位置", "横向延伸", "深浅", "弧度", "断续", "分叉"],
    [
      {
        sourceId: "cheiro.palmistry-for-all.1916",
        location:
          "Chapter VII, The Line of Heart as Indicating the Affectionate and Emotional Nature",
        originalText:
          "The Line of Heart ... runs across the hand under the fingers.",
        originalLanguage: "en",
        translationZh: "感情线横向延伸于手指下方。",
        modernExplanationZh:
          "该短引文只用于说明西方传统中感情线的大概位置，不用于预测婚恋结果。",
        verificationStatus: "verified",
        note: "公版英文资料短摘录；省略号表示删节。",
      },
    ],
    "传统相术常把感情线理解为情绪表达、人际敏感度、关系中的安全感和沟通方式的象征。",
    "西方 palmistry 通常把 Heart Line 与情感表达、亲密需求和人际互动倾向相关联，重视其位置、长度和连贯性。",
    "三种传统都容易把该线放入情感与关系框架；产品中必须避免婚姻结果断言，只保留自我觉察和沟通建议。",
    ["把感情线作为关系沟通的镜子，观察自己如何表达需要和边界。", "不要用掌纹判断关系成败，而是转化为一次温和的自我提问。"],
  ),
  "fate-line": entry(
    "fate-line",
    "事业线",
    "Fate Line",
    ["命运线", "玉柱纹", "Line of Fate", "Line of Destiny"],
    ["掌心纵向纹路", "起点位置", "是否穿过掌心", "连续性", "与主线交会"],
    [],
    "传统相术常把事业线或类似纵纹理解为责任感、阶段目标、外部环境牵引和行动路径的象征。",
    "西方 palmistry 常把 Fate Line 与职业路径、责任结构和人生阶段感相连，但现代解读不应把它视为命运决定线。",
    "共同点是都把纵向路径与人生方向感相连；差异在于‘事业线’与‘命运线’的概念边界在不同体系中并不一致。",
    ["把事业线作为目标感提醒，复盘当前最重要的责任和下一步行动。", "避免把事业线解读成职业成败预测。"],
  ),
  "sun-line": entry(
    "sun-line",
    "太阳线",
    "Sun Line",
    ["成功线", "阿波罗线", "Line of Sun", "Line of Apollo"],
    ["无名指下方区域", "纵向细纹", "清晰度", "长度", "与掌心主线关系"],
    [],
    "传统中文产品中常把太阳线或成功线归入名望、表达和被看见的象征，但古籍术语映射需单独核验。",
    "西方 palmistry 通常把 Sun/Apollo Line 与创造力、表达欲、审美、认可感和个人作品的可见度相关联。",
    "共同点是都把该线与外在呈现和认可感联系起来；差异在于中文‘财运/成功’混用较多，西方多与 Apollo/Sun mount 相连。",
    ["把太阳线作为表达力提醒，思考自己近期是否有作品、观点或能力值得被看见。", "不要把它解释为一定成名或成功。"],
  ),
  "wealth-line": entry(
    "wealth-line",
    "财运线",
    "Wealth / Mercury-related Lines",
    ["水星线", "金钱纹", "Line of Mercury", "财帛纹"],
    ["小指下方或掌侧细纹", "纵向/斜向纹路", "数量", "清晰度", "是否与太阳线混淆"],
    [],
    "传统相术中财运相关纹路常被现代产品概括为资源意识、积累习惯和现实规划能力，但固定线名需谨慎校勘。",
    "西方 palmistry 中金钱、商业和表达能力常与 Mercury/Sun 等多种区域或线条共同讨论，不一定存在单一‘财富线’。",
    "共同点是都倾向把财务主题和资源管理联系起来；差异在于现代‘财运线’常是营销化统称，必须避免承诺财富结果。",
    ["把财运线转化为资源管理提醒，观察预算、储蓄、学习和协作方式。", "只给习惯建议，不给投资建议或财富预测。"],
  ),
  "marriage-line": entry(
    "marriage-line",
    "婚姻线",
    "Marriage / Relationship Lines",
    ["关系线", "妻妾纹", "Line of Marriage", "Union Lines"],
    ["小指下方掌侧短横纹", "数量", "深浅", "方向", "是否清晰入镜"],
    [],
    "传统相术常把婚姻线或关系相关侧纹理解为亲密关系态度、沟通习惯和情感边界的象征。",
    "西方 palmistry 常把小指下方的 Relationship/Marriage Lines 作为亲密互动倾向参考，但不应用来判断结婚次数或关系结局。",
    "共同点是都把该线放入亲密关系语境；差异在于历史术语可能带有性别偏见，现代产品应改写为平等、非决定论的关系自省。",
    ["把婚姻线作为沟通方式提醒，观察自己如何表达需要、边界和承诺。", "不要用掌纹判断某段关系是否会成功。"],
  ),
};

export function getPalmCanonEntry(lineId: PalmCanonLineId) {
  return PALM_CANON_KNOWLEDGE_BASE[lineId];
}

export function listPalmCanonEntries() {
  return Object.values(PALM_CANON_KNOWLEDGE_BASE);
}

export function getPalmCanonSource(sourceId: string) {
  return PALM_CANON_SOURCES[sourceId];
}
