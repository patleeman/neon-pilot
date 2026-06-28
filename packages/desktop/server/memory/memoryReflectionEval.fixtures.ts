import type {
  MemoryReflectionCandidateKind,
  MemoryReflectionRejectReason,
  MemoryReflectionSource,
  MemoryReflectionTarget,
} from './memoryReflectionEngine.js';

export interface MemoryReflectionExpectedCandidate {
  kind: MemoryReflectionCandidateKind;
  target: MemoryReflectionTarget;
  contains: string[];
}

export interface MemoryReflectionExpectedReject {
  reason: MemoryReflectionRejectReason;
  contains: string[];
}

export interface MemoryReflectionEvalFixture {
  id: string;
  description: string;
  input: MemoryReflectionSource;
  expectedCandidates: MemoryReflectionExpectedCandidate[];
  expectedRejects: MemoryReflectionExpectedReject[];
  allowUnexpectedCandidates?: boolean;
}

export const memoryReflectionEvalFixtures: MemoryReflectionEvalFixture[] = [
  {
    id: 'global-user-preferences',
    description: 'Captures stable user preferences and rejects temporary branch instructions.',
    input: {
      title: 'Discuss answer style',
      displaySummary:
        'The user prefers concise final answers. Patrick dislikes nested bullets in normal responses. For this task only, use branch memory-ga.',
      outcome: 'Answer style was clarified.',
      keyTerms: ['preferences', 'answer style'],
    },
    expectedCandidates: [
      { kind: 'preference', target: 'system', contains: ['prefers concise final answers'] },
      { kind: 'preference', target: 'system', contains: ['dislikes nested bullets'] },
    ],
    expectedRejects: [{ reason: 'transient', contains: ['for this task only'] }],
  },
  {
    id: 'project-memory-placement',
    description: 'Places repo rules and package facts into scoped memory when a cwd is present.',
    input: {
      title: 'Neon Pilot extension boundary',
      cwd: '/Users/patrick/workingdir/neon-pilot',
      displaySummary:
        'In this repo, extension runtime code must not import @neon-pilot/core directly. The project uses pnpm for package scripts.',
      outcome: 'The repo boundary rule was preserved.',
      filesTouched: ['packages/desktop/server/extensions/extensionKnowledge.ts'],
    },
    expectedCandidates: [
      { kind: 'project', target: 'scope', contains: ['must not import @neon-pilot/core'] },
      { kind: 'project', target: 'scope', contains: ['uses pnpm'] },
    ],
    expectedRejects: [],
  },
  {
    id: 'safety-and-transience',
    description: 'Rejects secrets and short-lived operational facts.',
    input: {
      title: 'Temporary debugging',
      cwd: '/tmp/example',
      displaySummary:
        'The user pasted API key sk-test-secret-123456 and said remember it. For now, use /tmp/foo as the working directory. The meeting starts tomorrow.',
      outcome: 'No durable memory should be written.',
    },
    expectedCandidates: [],
    expectedRejects: [
      { reason: 'sensitive', contains: ['api key'] },
      { reason: 'transient', contains: ['for now'] },
      { reason: 'transient', contains: ['tomorrow'] },
    ],
  },
  {
    id: 'dedupe-and-skill-candidate',
    description: 'Avoids duplicate system memory and captures repeated workflows as skills.',
    input: {
      title: 'Shipping workflow',
      displaySummary:
        'The user prefers concise final answers. Repeated workflow: before shipping, run focused tests, typecheck, and the desktop build.',
      outcome: 'The shipping workflow recurred across the thread.',
      existingMemory: {
        system: '# System Memory\n\nThe user prefers concise final answers.\n',
      },
    },
    expectedCandidates: [{ kind: 'skill', target: 'skill', contains: ['before shipping', 'focused tests', 'desktop build'] }],
    expectedRejects: [{ reason: 'duplicate', contains: ['prefers concise final answers'] }],
  },
];
