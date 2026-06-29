export interface ComposerModelInfo {
  id: string;
  provider: string;
  name: string;
  context: number;
  input?: Array<'text' | 'image'>;
  supportedServiceTiers?: string[];
  reasoning?: boolean;
}

export type ComposerControlSlot = 'leading' | 'preferences' | 'actions';
export type ComposerControlRenderMode = 'inline' | 'menu';

export interface ComposerControlContext {
  /** Stable host-owned id for the composer instance rendering this control. */
  composerId?: string;
  /** True when this composer is the active target for composer-scoped commands. */
  composerActive?: boolean;
  composerDisabled: boolean;
  streamIsStreaming: boolean;
  composerHasContent: boolean;
  renderMode: ComposerControlRenderMode;
  /** Mark this composer as the active target for composer-scoped commands. */
  activateComposer?: () => void;
  /** Request the host-owned file picker. Extensions must not query or mutate host DOM. */
  openFilePicker: () => void;
  /** Request host-owned composer attachment ingestion. */
  addFiles: (files: File[]) => void;
  /** Request host-owned text insertion. The host owns composer state, selection, and caret restore. */
  insertText: (text: string) => void;
  /** Request host-owned text insertion at the end of the composer, ignoring the current selection. */
  appendText?: (text: string) => void;
  models: ComposerModelInfo[];
  currentModel: string;
  currentThinkingLevel: string;
  currentServiceTier: string;
  savingPreference: 'model' | 'thinking' | 'serviceTier' | null;
  selectModel: (modelId: string) => void;
  selectThinkingLevel: (thinkingLevel: string) => void;
  selectServiceTier: (serviceTier: string) => void;
}

export type ComposerButtonContext = ComposerControlContext;
