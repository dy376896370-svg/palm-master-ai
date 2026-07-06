import { getPalmCanonClaimsByLine } from "@/lib/palmistry/canon";
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

export function getWesternPalmistryReferences(
  lineId: PalmLineId,
): WesternPalmistryReference[] {
  return getPalmCanonClaimsByLine(lineId).map((claim) => ({
    claimId: claim.claimId,
    topicId: claim.topicId,
    sourceTitle: claim.sourceTitle,
    sourceAuthor: claim.sourceAuthor,
    sourceUrl: claim.sourceUrl,
    chapterOrSection: claim.chapterOrSection,
    claimZh: claim.claimZh,
    originalText: claim.originalText,
    verificationStatus: claim.verificationStatus,
    notes: claim.notes,
    evidence: claim.evidence,
  }));
}
