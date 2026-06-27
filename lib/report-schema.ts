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

export const visionStatusSchema = z.enum([
  "detected",
  "estimated",
  "unavailable",
]);

export const detectionMethodSchema = z.enum([
  "landmarks-classical-cv",
  "template-estimate",
  "not-detected",
]);

export const failureReasonSchema = z.enum([
  "image_blurry",
  "palm_rotated",
  "landmarks_missing",
  "candidate_fragmented",
  "low_contrast",
  "roi_unstable",
  "candidate_not_found",
  "classification_score_low",
  "mediapipe_unavailable",
  "path_zigzag_too_high",
  "crosses_fingers",
  "jumps_too_large",
  "outside_palm_roi",
  "touches_image_border",
  "too_vertical_for_heart_or_head",
  "too_many_sharp_turns",
  "too_short",
  "too_long",
]);

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

const palmVisionLineSchema = z.object({
  visionStatus: visionStatusSchema,
  detectionMethod: detectionMethodSchema,
  visionConfidence: z.number().min(0).max(1),
  confidenceBreakdown: z.object({
    roi: z.number().min(0).max(1),
    landmarks: z.number().min(0).max(1),
    edge: z.number().min(0).max(1),
    classification: z.number().min(0).max(1),
    final: z.number().min(0).max(1),
  }),
  failureReasons: z.array(failureReasonSchema),
  annotation: annotationSchema,
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
      ...palmVisionLineSchema.shape,
      sources: palmLineSourcesSchema,
    }),
  ),
});

export type PalmReport = z.infer<typeof palmReportSchema>;
export type PalmLine = PalmReport["lines"][number];
export type PalmLineId = z.infer<typeof lineIdSchema>;
export type PalmLineSources = z.infer<typeof palmLineSourcesSchema>;
export type PalmVisionStatus = z.infer<typeof visionStatusSchema>;
export type PalmDetectionMethod = z.infer<typeof detectionMethodSchema>;
