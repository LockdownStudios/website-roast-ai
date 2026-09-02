export type VisualHints = {
  aboveFoldCtaLikely: boolean;
  heroHeadingEarly: boolean;
  formAboveFoldLikely: boolean;
  trustTokenAboveFold: boolean;
  buttonCount: number;
  linkCount: number;
};

export type CrawlStrategy = "single_page" | "multi_page";

export type CrawlPageRole =
  | "home"
  | "contact"
  | "about"
  | "services"
  | "pricing"
  | "projects"
  | "testimonials"
  | "faq"
  | "other";

export type CrawlPageSummary = {
  url: string;
  role: CrawlPageRole;
  title: string;
  primaryHeading?: string;
  contentSnippet?: string;
  contentLength: number;
  headingCount: number;
};

export type CrawlSummary = {
  strategy: CrawlStrategy;
  pageCount: number;
  visitedUrls: string[];
  failedUrls: string[];
  pages: CrawlPageSummary[];
};

export type VisualViewportName = "desktop" | "mobile";

export type VisualViewportMetrics = {
  viewport: VisualViewportName;
  width: number;
  height: number;
  sampledElementCount: number;
  aboveFoldElementCount: number;
  ctaCount: number;
  primaryCtaText?: string;
  primaryCtaAboveFold: boolean;
  primaryCtaContrast: number;
  primaryCtaAreaRatio: number;
  averageTextContrast: number;
  lowContrastTextShare: number;
  averageFontSize: number;
  headingCountAboveFold: number;
  uniqueColorBuckets: number;
  uniqueFontFamilies: number;
  animatedElementShare: number;
  autoplayMediaCount: number;
};

export type VisualSummaryScores = {
  ctaProminence: number;
  readability: number;
  hierarchy: number;
  consistency: number;
  motionDistraction: number;
};

export type VisualAudit = {
  available: boolean;
  reason?: string;
  sampledAt: string;
  desktop?: VisualViewportMetrics;
  mobile?: VisualViewportMetrics;
  summary?: VisualSummaryScores;
  findings: string[];
  evidence: string[];
};

export type ScrapeQuality = "high" | "medium" | "low";

export type SiteFactEvidence = {
  value: string;
  sourceUrl?: string;
  sourceRole?: CrawlPageRole;
};

export type SiteFacts = {
  companyName?: string;
  services: SiteFactEvidence[];
  productCategories?: SiteFactEvidence[];
  exclusions?: SiteFactEvidence[];
  locations: SiteFactEvidence[];
  contacts: SiteFactEvidence[];
  ctas: SiteFactEvidence[];
  trustSignals: SiteFactEvidence[];
  pagesReviewed: SiteFactEvidence[];
  copyIssues: SiteFactEvidence[];
};

export type ScrapedWebsiteData = {
  url: string;
  title: string;
  description: string;
  headings: {
    h1: string[];
    h2: string[];
  };
  content: string;
  contentSnippet: string;
  ctas: string[];
  trustSignals: string[];
  contactSignals: string[];
  genericPhrasesFound: string[];
  visualHints: VisualHints;
  visualAudit?: VisualAudit;
  crawl?: CrawlSummary;
  siteFacts?: SiteFacts;
  contentLength: number;
  retryUsed: boolean;
  usedRelaxedFallback: boolean;
  scrapeQuality: ScrapeQuality;
};

export type ScoringAnalysisMeta = {
  engineVersion: string;
  generatedAt: string;
  freshness: "fresh" | "cached";
  sourcePageCount: number;
  crawlStrategy: CrawlStrategy;
};

export type ScoreBreakdown = {
  clarity: number;
  trust: number;
  CTA: number;
  differentiation: number;
  design_hint: number;
};

export type ScoreAdjustment = {
  label: string;
  points: number;
  reason: string;
};

export type VisualDesignAssessment = {
  score: number;
  label: "Weak" | "Mixed" | "Strong";
  basis: "visual_audit" | "structure_fallback";
  summary: string;
  factors: string[];
};

export type WebsiteScoring = {
  score: number;
  rawScore: number;
  confidence: number;
  analysisMeta?: ScoringAnalysisMeta;
  breakdown: ScoreBreakdown;
  visualDesign?: VisualDesignAssessment;
  findings: string[];
  evidence: string[];
  penalties: ScoreAdjustment[];
  bonuses: ScoreAdjustment[];
  singleBiggestLeak: string;
};

export type ScoreLabel =
  | "Brutal"
  | "Needs Work"
  | "Decent but Leaking"
  | "Strong Foundation"
  | "Conversion Ready";

export type ReportAccessTier = "free_teaser" | "full_unlocked";
export type ReportUnlockSource = "none" | "mock" | "paystack" | "legacy" | "office";

export type ReportAccess = {
  tier: ReportAccessTier;
  priceZar: number;
  unlockSource: ReportUnlockSource;
  unlockedAt?: string;
};

export type PaymentTransactionStatus =
  | "initialized"
  | "success"
  | "failed"
  | "webhook_success"
  | "webhook_ignored";

export type PaymentTransaction = {
  reference: string;
  reportId: string;
  userId?: string;
  email?: string;
  amountKobo: number;
  currency: string;
  status: PaymentTransactionStatus;
  providerStatus?: string;
  providerMessage?: string;
  authorizationUrl?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type RoastClaimSource =
  | "title"
  | "meta"
  | "h1"
  | "h2"
  | "content"
  | "cta"
  | "trust"
  | "contact"
  | "visual"
  | "crawl"
  | "scoring";

export type RoastClaimSeverity = "high" | "medium" | "low";

export type RoastClaim = {
  claim: string;
  source: RoastClaimSource;
  evidence: string;
  severity: RoastClaimSeverity;
};

export type RoastResultPayload = {
  score: number;
  score_label: ScoreLabel;
  first_impression: string;
  single_biggest_leak: string;
  mistakes: string[];
  lost_customers: string;
  quick_fixes: string[];
  high_impact: string;
  tone_summary: string;
  evidence: string[];
  claim_contract?: RoastClaim[];
  access?: ReportAccess;
};

export type StoredRoastReport = {
  id: string;
  url: string;
  scrapeHash: string;
  userId?: string;
  scraped: ScrapedWebsiteData;
  scoring: WebsiteScoring;
  roast: RoastResultPayload;
  createdAt: string;
};

export type LandingVariant = "A" | "B";

export type AnalyticsEventName =
  | "landing_view"
  | "roast_submit"
  | "roast_success"
  | "roast_error"
  | "result_view";

export type AnalyticsMetadataValue = string | number | boolean;

export type AnalyticsEvent = {
  name: AnalyticsEventName;
  timestamp: string;
  sessionId: string;
  variant?: LandingVariant;
  metadata?: Record<string, AnalyticsMetadataValue>;
};

export type ToneAccuracy = "too_soft" | "balanced" | "too_harsh";

export type RoastFeedbackInput = {
  reportId: string;
  sessionId: string;
  userId?: string;
  url: string;
  scoreAtReview: number;
  scoreAccuracy: number;
  toneAccuracy: ToneAccuracy;
  notes?: string;
};

export type RoastFeedbackEntry = RoastFeedbackInput & {
  createdAt: string;
};

export type BenchmarkCase = {
  id: string;
  label: string;
  scraped: ScrapedWebsiteData;
  expectedScoreRange: [number, number];
  expectedVisualDesignRange?: [number, number];
  mustFlag: Array<keyof ScoreBreakdown>;
  mustPenalty?: string[];
};

export type BenchmarkCaseResult = {
  id: string;
  label: string;
  score: number;
  breakdown: ScoreBreakdown;
  visualDesignScore?: number;
  expectedScoreRange: [number, number];
  scorePass: boolean;
  visualDesignPass?: boolean;
  repeatabilityPass: boolean;
  flaggedWeaknesses: Array<keyof ScoreBreakdown>;
  missingExpectedFlags: Array<keyof ScoreBreakdown>;
  missingExpectedPenalties?: string[];
  sampleLeak: string;
};

export type BenchmarkSummary = {
  totalCases: number;
  scorePassRate: number;
  repeatabilityPassRate: number;
  overallPass: boolean;
};

export type BenchmarkRun = {
  runAt: string;
  summary: BenchmarkSummary;
  results: BenchmarkCaseResult[];
};

export type LiveCalibrationSiteInput =
  | string
  | {
      url: string;
      expectedScoreRange?: [number, number];
      label?: string;
    };

export type LiveCalibrationSiteResult = {
  url: string;
  label?: string;
  ok: boolean;
  error?: string;
  expectedScoreRange?: [number, number];
  expectedPass?: boolean;
  score?: number;
  rawScore?: number;
  confidence?: number;
  breakdown?: ScoreBreakdown;
  penalties?: ScoreAdjustment[];
  bonuses?: ScoreAdjustment[];
  findings?: string[];
  singleBiggestLeak?: string;
};

export type LiveCalibrationRun = {
  runAt: string;
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    averageScore: number;
    medianScore: number;
    minScore: number;
    maxScore: number;
    buckets: {
      under4: number;
      from4to6: number;
      from6to8: number;
      above8: number;
    };
    expectedPassRate?: number;
    presetUsed?: boolean;
  };
  results: LiveCalibrationSiteResult[];
};
