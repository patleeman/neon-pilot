import { describe, expect, it } from 'vitest';

import { formatMemoryReflectionEvalScorecard, runMemoryReflectionEval } from './memoryReflectionEval.js';

describe('memory reflection eval', () => {
  it('passes the bundled golden fixtures', () => {
    const scorecard = runMemoryReflectionEval();

    expect(formatMemoryReflectionEvalScorecard(scorecard)).toContain('Memory reflection eval');
    expect(scorecard.passed).toBe(true);
    expect(scorecard.totals).toMatchObject({
      candidatePrecision: 1,
      candidateRecall: 1,
      rejectRecall: 1,
    });
  });
});
