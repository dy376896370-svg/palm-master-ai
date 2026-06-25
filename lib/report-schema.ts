import { z } from "zod";

export const lineIdSchema = z.enum([
  "life-line",
  "head-line",
  "heart-line",
  "fate-line",
  "wealth-line",
  "marriage-line",
]);

export const lineNameSchema = z.enum([
  "生命线",
  "智慧线",
  "感情线",
  "事业线",
  "财运线",
  "婚姻线",
]);

const chineseClassicSourceSchema = z.object({
  book: z.string(),
  originalText: z.string(),
  source: z.string(),
  sourceUrl: z.string(),
  modernExplanation: z.string(),
  note: z.string(),
});

const westernPalmistrySourceSchema = z.object({
  book: z.string(),
  author: z.string(),
  originalText: z.string(),
  source: z.string(),
  sourceUrl: z.string(),
  chineseTranslation: z.string(),
  note: z.string(),
});

const palmLineSourcesSchema = z.object({
  chineseClassics: z.array(chineseClassicSourceSchema),
  westernPalmistry: z.array(westernPalmistrySourceSchema),
});

const annotationSchema = z.object({
  type: z.literal("path"),
  points: z.array(
    z.object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
    }),
  ),
});

const palmLineAnalysisSchema = z.object({
  id: lineIdSchema,
  name: lineNameSchema,
  confidence: z.enum(["low", "medium", "high"]),
  approximatePosition: z.string(),
  visibleFeature: z.string(),
  isClearlyVisible: z.boolean(),
  referenceBasis: z.string(),
  combinedReading: z.string(),
  practicalAdvice: z.string(),
  annotation: annotationSchema.nullable(),
});

const palmReportBaseSchema = z.object({
  schemaVersion: z.literal("3.0"),
  reportId: z.string(),
  generatedAt: z.string(),
  imageQuality: z.object({
    accepted: z.boolean(),
    score: z.number().min(0).max(100),
    issues: z.array(z.string()),
    retakeGuidance: z.array(z.string()),
  }),
  overallImpression: z.object({
    observedFeatures: z.array(z.string()),
    culturalReading: z.string(),
    modernReflection: z.string(),
  }),
  finalSynthesis: z.object({
    keyThemes: z.array(z.string()),
    selfExplorationQuestions: z.array(z.string()),
    practicalSuggestions: z.array(z.string()),
  }),
  safety: z.object({
    entertainmentOnly: z.literal(true),
    disclaimer: z.string(),
    prohibitedAdviceDetected: z.literal(false),
  }),
  share: z.object({
    title: z.string(),
    summary: z.string(),
    tags: z.array(z.string()),
  }),
});

export const palmAiReportSchema = palmReportBaseSchema.extend({
  lines: z.array(palmLineAnalysisSchema),
});

export const palmReportSchema = palmReportBaseSchema.extend({
  lines: z.array(
    palmLineAnalysisSchema.extend({
      sources: palmLineSourcesSchema,
    }),
  ),
});

export type PalmReport = z.infer<typeof palmReportSchema>;
export type PalmLine = PalmReport["lines"][number];
export type PalmLineId = z.infer<typeof lineIdSchema>;
export type PalmLineSources = z.infer<typeof palmLineSourcesSchema>;
