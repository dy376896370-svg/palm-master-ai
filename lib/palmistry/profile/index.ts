import { palmistryDisclaimers } from "../knowledge/disclaimers";
import {
  detectPalmPatterns,
  type PalmFeatureInput,
} from "../pattern-engine";
import type { PalmAchievement, PalmDiscovery, PalmDossier, PalmScoreKey } from "./types";

const baseScores: Record<PalmScoreKey, number> = {
  personality: 62,
  career: 60,
  wealth: 58,
  relationship: 60,
  energy: 60,
};

const baseSections: PalmDossier["sections"] = {
  personality:
    "从娱乐角度看，你的掌纹档案更适合被理解为一种自我观察镜子：看见思考方式、行动节奏和表达习惯。",
  career: "事业倾向不用于预测职业成败，而是提醒你观察目标是否清晰、行动是否可持续。",
  wealth: "财富风格只谈资源管理与能力积累，不涉及投资判断或收益预测。",
  relationship: "感情模式只作为沟通和边界的自我观察，不用于判断婚姻或关系结局。",
  energy: "能量状态更适合提醒你关注作息、恢复和长期投入方式，不涉及健康判断。",
  advice: "今天可以选一个最小行动：整理一个目标、表达一个真实需求，或给自己留出恢复时间。",
};

const defaultDiscoveries: PalmDiscovery[] = [
  {
    title: "掌纹档案已生成",
    description: "本报告把照片观察、掌纹知识库和轻量规则组合成娱乐文化解读。",
    knowledgeNote: "传统掌纹学属于文化经验系统，不是科学诊断。",
  },
  {
    title: "重视可见度",
    description: "看不清的掌纹不会被强行解释成确定结论。",
    knowledgeNote: "照片质量会影响观察结果。",
  },
  {
    title: "自我探索优先",
    description: "报告更适合作为整理状态的提示卡，而不是人生答案。",
    knowledgeNote: palmistryDisclaimers.short,
  },
];

const fallbackAchievements: PalmAchievement[] = [
  { name: "自我观察者", description: "愿意把掌纹当作整理当下状态的入口。" },
  { name: "温和行动派", description: "适合从一个小行动开始调整节奏。" },
  { name: "文化探索者", description: "用轻松方式接触传统文化。" },
];

function clampScore(value: number) {
  return Math.max(35, Math.min(96, Math.round(value)));
}

function applyScoreDeltas(
  scores: Record<PalmScoreKey, number>,
  deltas: Record<PalmScoreKey, number>,
) {
  const nextScores = { ...scores };

  for (const [key, delta] of Object.entries(deltas)) {
    nextScores[key as PalmScoreKey] += delta;
  }

  return nextScores;
}

export function buildPalmProfile(features: PalmFeatureInput): PalmDossier {
  const patternResult = detectPalmPatterns(features);
  const rawScores = applyScoreDeltas(baseScores, patternResult.scoreDeltas);
  const discoveries = [
    ...patternResult.discoveries,
    ...defaultDiscoveries,
  ].slice(0, 5);
  const achievements = (
    patternResult.achievements.length
      ? patternResult.achievements
      : fallbackAchievements
  ).slice(0, 5);
  const luckyKeyword = patternResult.keywords[0] || "自我观察";
  const advice = [...patternResult.advice, baseSections.advice]
    .slice(0, 3)
    .join(" ");

  return {
    title: "你的掌纹档案",
    summary: `从娱乐角度看，本次档案关键词是「${luckyKeyword}」。它更像一张自我观察卡，帮助你看见节奏、表达和行动方式。`,
    scores: {
      personality: clampScore(rawScores.personality),
      career: clampScore(rawScores.career),
      wealth: clampScore(rawScores.wealth),
      relationship: clampScore(rawScores.relationship),
      energy: clampScore(rawScores.energy),
    },
    discoveries,
    sections: {
      ...baseSections,
      advice,
    },
    achievements,
    luckyKeyword,
    dailySuggestion:
      patternResult.advice[0] ||
      "今天先完成一个小而明确的行动，再回头观察自己的状态变化。",
    disclaimer: palmistryDisclaimers.full,
  };
}

export type { PalmAchievement, PalmDiscovery, PalmDossier, PalmScoreKey };
