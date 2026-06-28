import { extractMemoryReflection, type MemoryReflectionCandidate, type MemoryReflectionReject } from './memoryReflectionEngine.js';
import {
  type MemoryReflectionEvalFixture,
  memoryReflectionEvalFixtures,
  type MemoryReflectionExpectedCandidate,
  type MemoryReflectionExpectedReject,
} from './memoryReflectionEval.fixtures.js';

export interface MemoryReflectionEvalCaseResult {
  id: string;
  description: string;
  passed: boolean;
  expectedCandidates: number;
  matchedCandidates: number;
  unexpectedCandidates: string[];
  expectedRejects: number;
  matchedRejects: number;
  failures: string[];
}

export interface MemoryReflectionEvalScorecard {
  passed: boolean;
  cases: MemoryReflectionEvalCaseResult[];
  totals: {
    cases: number;
    passedCases: number;
    expectedCandidates: number;
    matchedCandidates: number;
    producedCandidates: number;
    unexpectedCandidates: number;
    expectedRejects: number;
    matchedRejects: number;
    candidatePrecision: number;
    candidateRecall: number;
    rejectRecall: number;
  };
}

function includesAll(value: string, fragments: string[]): boolean {
  const normalized = value.toLowerCase();
  return fragments.every((fragment) => normalized.includes(fragment.toLowerCase()));
}

function candidateMatches(candidate: MemoryReflectionCandidate, expected: MemoryReflectionExpectedCandidate): boolean {
  return candidate.kind === expected.kind && candidate.target === expected.target && includesAll(candidate.statement, expected.contains);
}

function rejectMatches(reject: MemoryReflectionReject, expected: MemoryReflectionExpectedReject): boolean {
  return reject.reason === expected.reason && includesAll(reject.evidence, expected.contains);
}

function evaluateFixture(fixture: MemoryReflectionEvalFixture): MemoryReflectionEvalCaseResult {
  const result = extractMemoryReflection(fixture.input);
  const matchedCandidateIndexes = new Set<number>();
  const failures: string[] = [];

  for (const expected of fixture.expectedCandidates) {
    const matchIndex = result.candidates.findIndex(
      (candidate, index) => !matchedCandidateIndexes.has(index) && candidateMatches(candidate, expected),
    );
    if (matchIndex >= 0) {
      matchedCandidateIndexes.add(matchIndex);
    } else {
      failures.push(`missing candidate ${expected.kind}/${expected.target}: ${expected.contains.join(' + ')}`);
    }
  }

  const matchedRejectIndexes = new Set<number>();
  for (const expected of fixture.expectedRejects) {
    const matchIndex = result.rejects.findIndex((reject, index) => !matchedRejectIndexes.has(index) && rejectMatches(reject, expected));
    if (matchIndex >= 0) {
      matchedRejectIndexes.add(matchIndex);
    } else {
      failures.push(`missing reject ${expected.reason}: ${expected.contains.join(' + ')}`);
    }
  }

  const unexpectedCandidates = result.candidates
    .filter((_, index) => !matchedCandidateIndexes.has(index))
    .map((candidate) => `${candidate.kind}/${candidate.target}: ${candidate.statement}`);
  if (!fixture.allowUnexpectedCandidates && unexpectedCandidates.length > 0) {
    failures.push(`unexpected candidates: ${unexpectedCandidates.join('; ')}`);
  }

  return {
    id: fixture.id,
    description: fixture.description,
    passed: failures.length === 0,
    expectedCandidates: fixture.expectedCandidates.length,
    matchedCandidates: matchedCandidateIndexes.size,
    unexpectedCandidates,
    expectedRejects: fixture.expectedRejects.length,
    matchedRejects: matchedRejectIndexes.size,
    failures,
  };
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 1;
  return Number((numerator / denominator).toFixed(4));
}

export function runMemoryReflectionEval(
  fixtures: MemoryReflectionEvalFixture[] = memoryReflectionEvalFixtures,
): MemoryReflectionEvalScorecard {
  const cases = fixtures.map(evaluateFixture);
  const expectedCandidates = cases.reduce((sum, item) => sum + item.expectedCandidates, 0);
  const matchedCandidates = cases.reduce((sum, item) => sum + item.matchedCandidates, 0);
  const unexpectedCandidates = cases.reduce((sum, item) => sum + item.unexpectedCandidates.length, 0);
  const expectedRejects = cases.reduce((sum, item) => sum + item.expectedRejects, 0);
  const matchedRejects = cases.reduce((sum, item) => sum + item.matchedRejects, 0);
  const producedCandidates = matchedCandidates + unexpectedCandidates;
  const passedCases = cases.filter((item) => item.passed).length;

  return {
    passed: cases.every((item) => item.passed),
    cases,
    totals: {
      cases: cases.length,
      passedCases,
      expectedCandidates,
      matchedCandidates,
      producedCandidates,
      unexpectedCandidates,
      expectedRejects,
      matchedRejects,
      candidatePrecision: ratio(matchedCandidates, producedCandidates),
      candidateRecall: ratio(matchedCandidates, expectedCandidates),
      rejectRecall: ratio(matchedRejects, expectedRejects),
    },
  };
}

export function formatMemoryReflectionEvalScorecard(scorecard: MemoryReflectionEvalScorecard): string {
  const lines = [
    'Memory reflection eval',
    `Cases: ${scorecard.totals.passedCases}/${scorecard.totals.cases} passed`,
    `Candidate precision: ${scorecard.totals.candidatePrecision.toFixed(2)}`,
    `Candidate recall: ${scorecard.totals.candidateRecall.toFixed(2)}`,
    `Reject recall: ${scorecard.totals.rejectRecall.toFixed(2)}`,
  ];

  for (const result of scorecard.cases) {
    lines.push('', `${result.passed ? 'PASS' : 'FAIL'} ${result.id}: ${result.description}`);
    if (result.failures.length > 0) {
      for (const failure of result.failures) lines.push(`- ${failure}`);
    }
  }

  return lines.join('\n');
}
