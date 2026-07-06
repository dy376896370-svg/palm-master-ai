import type { PalmLineId } from "@/lib/report-schema";

export type PalmCanonTradition =
  | "western-palmistry"
  | "chinese-canon"
  | "indian-tradition"
  | "modern-psychology";

export type PalmCanonVerificationStatus =
  | "verified"
  | "pending"
  | "rejected"
  | "needs-review";

export type PalmCanonEvidence = {
  evidenceId: string;
  claimId: string;
  documentId: string;
  sourceUrl: string;
  evidenceType: string;
  confidence: "low" | "medium" | "high" | string;
  notes: string;
};

export type PalmCanonClaim = {
  claimId: string;
  topicId: string;
  lineId?: PalmLineId;
  tradition: PalmCanonTradition;
  sourceTitle: string;
  sourceAuthor: string;
  sourceUrl: string;
  chapterOrSection: string;
  claimZh: string;
  originalText: string;
  verificationStatus: PalmCanonVerificationStatus | string;
  notes: string;
  evidence: PalmCanonEvidence[];
};

export type PalmCanonTopic = {
  topicId: string;
  label: string;
  lineId?: PalmLineId;
  description: string;
};

export type PalmCanonSearchResult = {
  claim: PalmCanonClaim;
  matchedBy: "topic" | "line" | "source" | "text";
};
