import claims from "@/data/canon-lab/western/cheiro-palmistry-for-all/claims.json";
import evidence from "@/data/canon-lab/western/cheiro-palmistry-for-all/evidence.json";
import type { PalmLineId } from "@/lib/report-schema";
import type {
  PalmCanonClaim,
  PalmCanonEvidence,
  PalmCanonSearchResult,
  PalmCanonTopic,
} from "./types";

type CanonLabClaim = Omit<
  PalmCanonClaim,
  "tradition" | "lineId" | "evidence"
>;

export const palmCanonTopics: PalmCanonTopic[] = [
  {
    topicId: "life_line",
    label: "生命线",
    lineId: "life-line",
    description: "传统掌纹体系中用于讨论精力节奏、活力感受与生活状态的主题。",
  },
  {
    topicId: "head_line",
    label: "智慧线",
    lineId: "head-line",
    description: "传统掌纹体系中用于讨论思考习惯、判断方式与决策风格的主题。",
  },
  {
    topicId: "heart_line",
    label: "感情线",
    lineId: "heart-line",
    description: "传统掌纹体系中用于讨论情绪表达、关系感受与沟通方式的主题。",
  },
  {
    topicId: "fate_line",
    label: "事业线",
    lineId: "fate-line",
    description: "传统掌纹体系中用于讨论目标感、责任节奏与职业路径象征的主题。",
  },
  {
    topicId: "wealth_line",
    label: "财运线",
    lineId: "wealth-line",
    description: "传统掌纹体系中用于讨论资源管理、经营意识与积累方式的主题。",
  },
  {
    topicId: "marriage_line",
    label: "婚姻线",
    lineId: "marriage-line",
    description: "传统掌纹体系中用于讨论亲密关系观与边界感的主题，不作婚姻判断。",
  },
  {
    topicId: "sun_line",
    label: "太阳线",
    description: "传统掌纹体系中用于讨论表达、作品感与被看见需求的主题。",
  },
  {
    topicId: "thumb",
    label: "拇指",
    description: "传统掌纹体系中用于讨论意志、执行和自我管理风格的主题。",
  },
];

const topicByLineId = new Map(
  palmCanonTopics
    .filter((topic): topic is PalmCanonTopic & { lineId: PalmLineId } =>
      Boolean(topic.lineId),
    )
    .map((topic) => [topic.lineId, topic]),
);

const topicById = new Map(
  palmCanonTopics.map((topic) => [topic.topicId, topic]),
);

const canonClaims: PalmCanonClaim[] = (claims as CanonLabClaim[]).map(
  (claim) => ({
    ...claim,
    lineId: topicById.get(claim.topicId)?.lineId,
    tradition: "western-palmistry",
    evidence: (evidence as PalmCanonEvidence[]).filter(
      (item) => item.claimId === claim.claimId,
    ),
  }),
);

export function getPalmCanonTopics(): PalmCanonTopic[] {
  return palmCanonTopics;
}

export function getPalmCanonClaims(): PalmCanonClaim[] {
  return canonClaims;
}

export function getPalmCanonClaimsByTopic(topicId: string): PalmCanonClaim[] {
  return canonClaims.filter((claim) => claim.topicId === topicId);
}

export function getPalmCanonClaimsByLine(
  lineId: PalmLineId,
): PalmCanonClaim[] {
  const topic = topicByLineId.get(lineId);

  if (!topic) {
    return [];
  }

  return getPalmCanonClaimsByTopic(topic.topicId);
}

export function getPalmCanonEvidenceForClaim(
  claimId: string,
): PalmCanonEvidence[] {
  return (evidence as PalmCanonEvidence[]).filter(
    (item) => item.claimId === claimId,
  );
}

export function searchPalmCanon(
  query: string,
  limit = 8,
): PalmCanonSearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  const results: PalmCanonSearchResult[] = [];

  for (const claim of canonClaims) {
    const topic = topicById.get(claim.topicId);
    const haystacks = [
      { value: claim.topicId, matchedBy: "topic" as const },
      { value: topic?.label ?? "", matchedBy: "line" as const },
      { value: claim.sourceTitle, matchedBy: "source" as const },
      { value: claim.claimZh, matchedBy: "text" as const },
    ];
    const match = haystacks.find((item) =>
      item.value.toLowerCase().includes(normalizedQuery),
    );

    if (match) {
      results.push({ claim, matchedBy: match.matchedBy });
    }

    if (results.length >= limit) {
      break;
    }
  }

  return results;
}

export type {
  PalmCanonClaim,
  PalmCanonEvidence,
  PalmCanonSearchResult,
  PalmCanonTopic,
} from "./types";
