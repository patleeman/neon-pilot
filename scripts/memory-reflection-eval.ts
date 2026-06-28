#!/usr/bin/env -S tsx

import { formatMemoryReflectionEvalScorecard, runMemoryReflectionEval } from '../packages/desktop/server/memory/memoryReflectionEval.js';

const scorecard = runMemoryReflectionEval();
console.log(formatMemoryReflectionEvalScorecard(scorecard));

if (!scorecard.passed) {
  process.exitCode = 1;
}
