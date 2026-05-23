export type GitTextRunner = (cwd: string, args: string[], options?: { allowFailure?: boolean }) => string;
export type GitBufferRunner = (cwd: string, args: string[], options?: { allowFailure?: boolean }) => Buffer;

export function getKnowledgeBaseRemoteRef(branch: string): string {
  return `refs/remotes/origin/${branch}`;
}

export function knowledgeBaseRefExists(runGitText: GitTextRunner, cwd: string, ref: string): boolean {
  const output = runGitText(cwd, ['show-ref', '--verify', ref], { allowFailure: true }).trim();
  return output.length > 0;
}

export function knowledgeBaseHeadExists(runGitText: GitTextRunner, cwd: string): boolean {
  return runGitText(cwd, ['rev-parse', '--verify', 'HEAD'], { allowFailure: true }).trim().length > 0;
}

export function readKnowledgeBaseRemoteFileBuffer(input: {
  runGitText: GitTextRunner;
  runGitBuffer: GitBufferRunner;
  cwd: string;
  branch: string;
  relativePath: string;
}): Buffer | null {
  const remoteRef = getKnowledgeBaseRemoteRef(input.branch);
  if (!knowledgeBaseRefExists(input.runGitText, input.cwd, remoteRef)) {
    return null;
  }

  const buffer = input.runGitBuffer(input.cwd, ['show', `${remoteRef}:${input.relativePath}`], { allowFailure: true });
  return buffer.length > 0 ? buffer : null;
}

export function readKnowledgeBaseRemotePathTimestampMs(input: {
  runGitText: GitTextRunner;
  cwd: string;
  branch: string;
  relativePath: string;
  existsInRemote: boolean;
}): number {
  const remoteRef = getKnowledgeBaseRemoteRef(input.branch);
  const args = input.existsInRemote
    ? ['log', '-1', '--format=%ct', remoteRef, '--', input.relativePath]
    : ['log', '-1', '--diff-filter=D', '--format=%ct', remoteRef, '--', input.relativePath];
  const output = input.runGitText(input.cwd, args, { allowFailure: true }).trim();
  const parsed = Number.parseInt(output, 10);
  return Number.isFinite(parsed) ? parsed * 1000 : 0;
}
