import claims from "@/data/canon-lab/western/cheiro-palmistry-for-all/claims.json";
import evidence from "@/data/canon-lab/western/cheiro-palmistry-for-all/evidence.json";
import type { PalmLineId } from "@/lib/report-schema";

type CanonLabClaim = {
  claimId: string;
  topicId: string;
  sourceTitle: string;
  sourceAuthor: string;
  sourceUrl: string;
  chapterOrSection: string;
  claimZh: string;
  originalText: string;
  verificationStatus: string;
  notes: string;
};

type CanonLabEvidence = {
  evidenceId: string;
  claimId: string;
  documentId: string;
  sourceUrl: string;
  evidenceType: string;
  confidence: string;
  notes: string;
};

export type WesternPalmistryReference = CanonLabClaim & {
  evidence: CanonLabEvidence[];
};

const lineTopicMap: Partial<Record<PalmLineId, string>> = {
  "life-line": "life_line",
  "head-line": "head_line",
  "heart-line": "heart_line",
  "fate-line": "fate_line",
};

export function getWesternPalmistryReferences(
  lineId: PalmLineId,
): WesternPalmistryReference[] {
  const topicId = lineTopicMap[lineId];

  if (!topicId) {
    return [];
  }

  return (claims as CanonLabClaim[])
    .filter((claim) => claim.topicId === topicId)
    .map((claim) => ({
      ...claim,
      evidence: (evidence as CanonLabEvidence[]).filter(
        (item) => item.claimId === claim.claimId,
      ),
    }));
}
