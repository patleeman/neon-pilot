import { createHash } from 'node:crypto';

/**
 * Stable adjective/noun pools used to generate human-readable worker names.
 *
 * Names are picked deterministically from a seed so the same worker intent
 * yields the same name across re-runs and recovery, without relying on a
 * global counter.
 */
const WORKER_ADJECTIVES = [
  'Focused',
  'Steady',
  'Keen',
  'Brisk',
  'Careful',
  'Nimble',
  'Sturdy',
  'Lucid',
  'Crisp',
  'Direct',
  'Adept',
  'Calm',
  'Swift',
  'Solid',
  'Sharp',
  'Bright',
  'Patient',
  'Ready',
  'Exact',
  'Clear',
  'Bold',
  'Clean',
  'Rapid',
  'Measured',
  'Cogent',
  'Tidy',
  'Stoic',
  'Fleet',
  'Orderly',
  'Polished',
  'Practical',
  'Warm',
];

const WORKER_NOUNS = [
  'Analyst',
  'Builder',
  'Reviewer',
  'Runner',
  'Operator',
  'Planner',
  'Inspector',
  'Maintainer',
  'Coordinator',
  'Checker',
  'Researcher',
  'Writer',
  'Mapper',
  'Assembler',
  'Tester',
  'Dispatcher',
  'Auditor',
  'Compiler',
  'Watcher',
  'Guide',
  'Verifier',
  'Scout',
  'Recorder',
  'Designer',
  'Formatter',
  'Indexer',
  'Synthesizer',
  'Navigator',
  'Editor',
  'Monitor',
  'Fixer',
  'Reporter',
];

function capitalizeWord(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Generate a stable, human-readable worker name from a deterministic seed.
 */
export function generateWorkerName(seed: string): string {
  const hash = createHash('sha1').update(seed, 'utf8').digest('hex');
  const digest = Buffer.from(hash, 'hex');
  const adjective = WORKER_ADJECTIVES[digest.readUInt16BE(0) % WORKER_ADJECTIVES.length];
  const noun = WORKER_NOUNS[digest.readUInt16BE(2) % WORKER_NOUNS.length];
  return `${capitalizeWord(adjective)} ${capitalizeWord(noun)} ${hash.slice(0, 4)}`;
}
