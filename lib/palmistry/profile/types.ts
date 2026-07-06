export type PalmDiscovery = {
  title: string;
  description: string;
  knowledgeNote: string;
};

export type PalmAchievement = {
  name: string;
  description: string;
};

export type PalmScoreKey =
  | "personality"
  | "career"
  | "wealth"
  | "relationship"
  | "energy";

export type PalmDossier = {
  title: string;
  summary: string;
  scores: Record<PalmScoreKey, number>;
  discoveries: PalmDiscovery[];
  sections: Record<
    "personality" | "career" | "wealth" | "relationship" | "energy" | "advice",
    string
  >;
  achievements: PalmAchievement[];
  luckyKeyword: string;
  dailySuggestion: string;
  disclaimer: string;
};
