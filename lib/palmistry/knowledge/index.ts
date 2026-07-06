import { fateLineKnowledge } from "./fate-line";
import { headLineKnowledge } from "./head-line";
import { heartLineKnowledge } from "./heart-line";
import { lifeLineKnowledge } from "./life-line";
import { marriageLineKnowledge } from "./marriage-line";
import { palmShapesKnowledge } from "./palm-shapes";
import { specialMarksKnowledge } from "./special-marks";
import { sunLineKnowledge } from "./sun-line";
import { wealthLineKnowledge } from "./wealth-line";
import type { PalmKnowledgeEntry } from "./types";

export const palmKnowledgeEntries = [
  lifeLineKnowledge,
  headLineKnowledge,
  heartLineKnowledge,
  fateLineKnowledge,
  sunLineKnowledge,
  marriageLineKnowledge,
  wealthLineKnowledge,
  palmShapesKnowledge,
  specialMarksKnowledge,
] satisfies PalmKnowledgeEntry[];

export const palmKnowledgeById = Object.fromEntries(
  palmKnowledgeEntries.map((entry) => [entry.id, entry]),
) as Record<string, PalmKnowledgeEntry>;

export type { PalmKnowledgeEntry };
