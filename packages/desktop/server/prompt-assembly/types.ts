export interface AssemblyDiagnostic {
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  sourceId?: string;
}

export interface AssemblySource {
  kind: 'extension' | 'knowledge' | 'configured-folder' | 'builtin' | 'runtime';
  label: string;
  extensionId?: string;
  root?: string;
}

export interface AssemblyRuntimeContext {
  runtimeScope?: string;
  /** @deprecated Runtime resources are no longer user-profile scoped. Use runtimeScope. */
  profile?: string;
  repoRoot: string;
  modelRef?: string;
  provider?: string;
  cwd?: string;
}

export interface PromptAssemblyPlan {
  runtimeScope: string;
  /** @deprecated Runtime resources are no longer user-profile scoped. */
  profile?: string;
  repoRoot: string;
  skills: {
    skillPaths: string[];
    inlineSkills: unknown[];
    diagnostics: AssemblyDiagnostic[];
  };
  tools: {
    activeToolNames: string[];
    diagnostics: AssemblyDiagnostic[];
  };
  promptTemplates: {
    templatePaths: string[];
    diagnostics: AssemblyDiagnostic[];
  };
  context: {
    blocks: unknown[];
    diagnostics: AssemblyDiagnostic[];
  };
  instructions: {
    layers: unknown[];
    diagnostics: AssemblyDiagnostic[];
  };
  diagnostics: AssemblyDiagnostic[];
}
