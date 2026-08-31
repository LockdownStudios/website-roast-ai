import { generateFallbackRoast } from "./ai";
import { benchmarkCases } from "./benchmarkCases";
import { categoryRatio } from "./scoringConfig";
import { scoreWebsite } from "./scoring";
import type { BenchmarkCase, BenchmarkCaseResult, BenchmarkRun, ScoreBreakdown } from "./types";

function isRepeatable(testCase: BenchmarkCase): boolean {
  const a = scoreWebsite(testCase.scraped);
  const b = scoreWebsite(testCase.scraped);
  const c = scoreWebsite(testCase.scraped);

  return (
    a.score === b.score &&
    b.score === c.score &&
    a.rawScore === b.rawScore &&
    b.rawScore === c.rawScore &&
    JSON.stringify(a.breakdown) === JSON.stringify(b.breakdown) &&
    JSON.stringify(b.breakdown) === JSON.stringify(c.breakdown)
  );
}

function evaluateCase(testCase: BenchmarkCase): BenchmarkCaseResult {
  const scoring = scoreWebsite(testCase.scraped);
  const roast = generateFallbackRoast(testCase.scraped, scoring);
  const [min, max] = testCase.expectedScoreRange;
  const visualDesignScore = scoring.visualDesign?.score;
  const visualDesignPass = testCase.expectedVisualDesignRange
    ? typeof visualDesignScore === "number" &&
      visualDesignScore >= testCase.expectedVisualDesignRange[0] &&
      visualDesignScore <= testCase.expectedVisualDesignRange[1]
    : undefined;
  const flaggedWeaknesses = (Object.entries(scoring.breakdown) as Array<
    [keyof ScoreBreakdown, number]
  >)
    .filter((entry) => categoryRatio(entry[0], entry[1]) <= 0.45)
    .map((entry) => entry[0]);
  const penaltyLabels = scoring.penalties.map((penalty) => penalty.label);

  return {
    id: testCase.id,
    label: testCase.label,
    score: scoring.score,
    breakdown: scoring.breakdown,
    visualDesignScore,
    expectedScoreRange: testCase.expectedScoreRange,
    scorePass: scoring.score >= min && scoring.score <= max,
    visualDesignPass,
    repeatabilityPass: isRepeatable(testCase),
    flaggedWeaknesses,
    missingExpectedFlags: testCase.mustFlag.filter((flag) => !flaggedWeaknesses.includes(flag)),
    missingExpectedPenalties: (testCase.mustPenalty ?? []).filter(
      (penalty) => !penaltyLabels.includes(penalty),
    ),
    sampleLeak: roast.single_biggest_leak,
  };
}

function toRate(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function summarizeBuckets(results: BenchmarkCaseResult[]): {
  under4: number;
  from4to6: number;
  from6to8: number;
  above8: number;
} {
  return results.reduce(
    (acc, item) => {
      if (item.score < 4) acc.under4 += 1;
      else if (item.score < 6) acc.from4to6 += 1;
      else if (item.score < 8) acc.from6to8 += 1;
      else acc.above8 += 1;
      return acc;
    },
    { under4: 0, from4to6: 0, from6to8: 0, above8: 0 },
  );
}

export function runBenchmarkSuite(): BenchmarkRun & {
  diagnostics: {
    scoreBuckets: {
      under4: number;
      from4to6: number;
      from6to8: number;
      above8: number;
    };
    averageScore: number;
    medianScore: number;
    failingCases: string[];
  };
} {
  const results = benchmarkCases.map(evaluateCase);
  const totalCases = results.length;
  const scorePassCount = results.filter((item) => item.scorePass).length;
  const repeatabilityPassCount = results.filter((item) => item.repeatabilityPass).length;
  const visualDesignFailures = results.filter((item) => item.visualDesignPass === false);
  const missingFlags = results.flatMap((item) => item.missingExpectedFlags);
  const missingPenalties = results.flatMap((item) => item.missingExpectedPenalties ?? []);
  const overallPass =
    scorePassCount === totalCases &&
    repeatabilityPassCount === totalCases &&
    visualDesignFailures.length === 0 &&
    missingFlags.length === 0 &&
    missingPenalties.length === 0;

  const sortedScores = [...results].map((item) => item.score).sort((a, b) => a - b);
  const medianIndex = Math.floor(sortedScores.length / 2);
  const medianScore =
    sortedScores.length % 2 === 0
      ? Math.round(((sortedScores[medianIndex - 1] + sortedScores[medianIndex]) / 2) * 10) / 10
      : sortedScores[medianIndex];
  const averageScore =
    Math.round(
      (sortedScores.reduce((sum, score) => sum + score, 0) / (sortedScores.length || 1)) * 10,
    ) / 10;

  const failingCases = results
    .filter(
      (item) =>
        !item.scorePass ||
        item.visualDesignPass === false ||
        !item.repeatabilityPass ||
        item.missingExpectedFlags.length > 0 ||
        (item.missingExpectedPenalties ?? []).length > 0,
    )
    .map((item) => item.id);

  return {
    runAt: new Date().toISOString(),
    summary: {
      totalCases,
      scorePassRate: toRate(scorePassCount, totalCases),
      repeatabilityPassRate: toRate(repeatabilityPassCount, totalCases),
      overallPass,
    },
    diagnostics: {
      scoreBuckets: summarizeBuckets(results),
      averageScore,
      medianScore,
      failingCases,
    },
    results,
  };
}
