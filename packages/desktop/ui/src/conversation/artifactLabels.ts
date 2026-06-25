import type { ConversationArtifactMetadata } from '../shared/types';

const ARTIFACT_TYPE_LABELS: Record<string, string> = {
  architecture: 'Architecture explainer',
  'data-table': 'Data table',
  'diff-review': 'Diff review',
  'fact-check': 'Fact check',
  'plan-review': 'Plan review',
  'project-recap': 'Project recap',
  report: 'Report',
  slides: 'Slide deck',
  'visual-explainer': 'Visual explainer',
  'visual-plan': 'Visual plan',
};

const STYLE_PRESET_LABELS: Record<string, string> = {
  'architecture-map': 'Architecture map',
  'review-matrix': 'Review matrix',
  'slide-deck': 'Slide deck',
  'technical-report': 'Technical report',
  'visual-explainer': 'Visual explainer',
};

function labelFromSlug(value: string): string {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function artifactTypeLabel(input: { kind: string; metadata?: ConversationArtifactMetadata }): string {
  const type = input.metadata?.type;
  return type ? (ARTIFACT_TYPE_LABELS[type] ?? labelFromSlug(type)) : input.kind;
}

export function artifactDetailLabel(input: { kind: string; metadata?: ConversationArtifactMetadata }): string {
  const preset = input.metadata?.stylePreset;
  const presetLabel = preset ? (STYLE_PRESET_LABELS[preset] ?? labelFromSlug(preset)) : null;
  return [presetLabel, input.kind].filter(Boolean).join(' · ');
}
