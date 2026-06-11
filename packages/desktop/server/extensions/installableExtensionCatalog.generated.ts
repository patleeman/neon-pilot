// Generated from patleeman/neon-pilot-extensions/neon.extensions.json.
// Regenerate when first-party extension release metadata changes.

import type { CatalogSeed } from './extensionCatalog.js';

export const INSTALLABLE_EXTENSION_CATALOG: CatalogSeed[] = [
  {
    id: 'system-agent-browser',
    name: 'Agent Browser',
    description: 'Control browsers and Electron apps with the agent-browser CLI. Docs: https://agent-browser.dev',
    version: '0.1.0',
    tag: 'v0.10.2',
  },
  {
    id: 'system-alleycat',
    name: 'Kitty Litter Mobile Pairing (Alleycat)',
    description:
      'Pair the Kitty Litter iOS app directly with Neon Pilot using a PA-owned Alleycat-compatible host and Codex-shaped conversation APIs.',
    version: '0.1.1',
    tag: 'v0.11.1',
  },
  {
    id: 'system-auto-router',
    name: 'Auto Router',
    description: 'Adds a composer control for judge-based model routing policy settings.',
    version: '0.1.0',
    tag: 'v0.10.2',
  },
  {
    id: 'system-browser',
    name: 'Browser',
    description: 'Browse web pages beside the active conversation.',
    version: '0.1.0',
    tag: 'v0.10.2',
  },
  {
    id: 'system-ds4',
    name: 'DS4',
    description: 'DeepSeek V4 Flash local model profile and ds4-agent-shaped tools for antirez/ds4.',
    version: '0.1.3',
    tag: 'v0.10.2',
  },
  {
    id: 'system-duckduckgo-search',
    name: 'DuckDuckGo Search',
    description: 'Agent web search tool backed by DuckDuckGo HTML results.',
    version: '0.1.0',
    tag: 'v0.10.2',
  },
  {
    id: 'system-dynamic-workflows',
    name: 'Dynamic Workflows',
    description: 'Run model-authored JavaScript workflow coordinators that fan out daemon-backed subagents.',
    version: '0.1.0',
    tag: 'v0.11.14',
  },
  {
    id: 'system-exa-search',
    name: 'Exa Search',
    description: 'Agent tool for Exa web search.',
    version: '0.1.0',
    tag: 'v0.10.2',
  },
  {
    id: 'system-hermes-agent',
    name: 'Hermes Agent',
    description: 'Connect to a running Hermes Agent instance and use Neon Pilot as its session interface.',
    version: '0.1.0',
    tag: 'v0.10.2',
  },
  {
    id: 'system-local-models',
    name: 'Local Models',
    description: 'Manage local MLX and GGUF model runtimes from one workspace.',
    version: '0.1.0',
    tag: 'v0.10.2',
  },
  {
    id: 'system-self-preservation',
    name: 'Self Preservation',
    description: 'Blocks the agent from killing its own process.',
    version: '0.1.0',
    tag: 'v0.10.2',
  },
  {
    id: 'system-suggested-context',
    name: 'Suggested Context',
    description: 'Suggests related conversations as pointer context for new prompts.',
    version: '0.1.0',
    tag: 'v0.10.2',
  },
  {
    id: 'system-video-probe',
    name: 'Video Probe',
    description:
      'Analyze video files using a video-capable model. Manages a local mlx-vlm runtime (Apple Silicon) or routes to OpenRouter.',
    version: '0.1.0',
    tag: 'v0.10.2',
  },
  {
    id: 'system-writing-studio',
    name: 'Writing Studio',
    description: 'Document-first collaborative markdown editor with CRDT replay, agent annotations, reactions, suggestions, and chat.',
    version: '0.1.2',
    tag: 'v0.10.2',
    compatibility: {
      neonPilot: '>=0.10.0 <0.11.0',
      extensionApi: '^2',
    },
  },
];
