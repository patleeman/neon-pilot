import { useApi, useInvalidateOnTopics } from '@neon-pilot/extensions/settings';
import { Button, CardMeta, Field, LoadingState, Notice, Textarea, TextInput, ToolbarButton, cx } from '@neon-pilot/extensions/ui';
import { useEffect, useMemo, useState } from 'react';

import { knowledgeApi } from '../lib/knowledgeApi';
import { getKnowledgeBaseSyncPresentation } from '../lib/knowledgeBaseSyncStatus';

export function KnowledgeSettingsPanel({ variant = 'settings' }: { variant?: 'settings' | 'onboarding' } = {}) {
  const {
    data: knowledgeBaseState,
    loading: knowledgeBaseLoading,
    error: knowledgeBaseLoadError,
    refetch: refetchKnowledgeBase,
  } = useApi(knowledgeApi.state, 'knowledge-settings-knowledge-base');
  const [repoUrlDraft, setRepoUrlDraft] = useState('');
  const [branchDraft, setBranchDraft] = useState('main');
  const [directoriesDraft, setDirectoriesDraft] = useState('');
  const [action, setAction] = useState<'save' | 'sync' | null>(null);
  const [actionStartedAt, setActionStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  const dirty = knowledgeBaseState
    ? repoUrlDraft.trim() !== knowledgeBaseState.repoUrl ||
      branchDraft.trim() !== knowledgeBaseState.branch ||
      directoriesDraft.trim() !== (knowledgeBaseState.directories ?? []).join('\n')
    : false;
  const isOnboarding = variant === 'onboarding';
  const syncPresentation = useMemo(
    () => getKnowledgeBaseSyncPresentation(knowledgeBaseState, { includeLastSyncAt: true }),
    [knowledgeBaseState],
  );

  useInvalidateOnTopics(['knowledgeBase'], refetchKnowledgeBase);

  const actionProgressText = useMemo(() => {
    if (action === null) {
      return null;
    }

    const verb = action === 'save' ? 'Connecting repository' : 'Syncing knowledge base';
    if (elapsedSeconds < 3) {
      return `${verb}…`;
    }
    if (elapsedSeconds < 10) {
      return `${verb}… cloning and reading git state (${elapsedSeconds}s)`;
    }
    return `${verb}… still waiting on git (${elapsedSeconds}s). If this is a private repo, check whether git is prompting for credentials.`;
  }, [action, elapsedSeconds]);

  useEffect(() => {
    if (knowledgeBaseState) {
      setRepoUrlDraft(knowledgeBaseState.repoUrl);
      setBranchDraft(knowledgeBaseState.branch);
      setDirectoriesDraft((knowledgeBaseState.directories ?? []).join('\n'));
    }
  }, [knowledgeBaseState?.repoUrl, knowledgeBaseState?.branch, knowledgeBaseState?.directories]);

  useEffect(() => {
    if (action === null || actionStartedAt === null) {
      setElapsedSeconds(0);
      return undefined;
    }

    const updateElapsed = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - actionStartedAt) / 1000)));
    };
    updateElapsed();
    const interval = window.setInterval(updateElapsed, 500);
    return () => {
      window.clearInterval(interval);
    };
  }, [action, actionStartedAt]);

  async function save(nextInput?: { repoUrl?: string | null; branch?: string | null; directories?: string[] | null }) {
    if (!knowledgeBaseState || action !== null) {
      return;
    }

    const repoUrl = typeof nextInput?.repoUrl === 'string' ? nextInput.repoUrl.trim() : repoUrlDraft.trim();
    const branch = typeof nextInput?.branch === 'string' ? nextInput.branch.trim() : branchDraft.trim();
    const directories =
      nextInput?.directories ??
      directoriesDraft
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean);
    if (!nextInput && !dirty) {
      return;
    }

    setSaveError(null);
    setActionStartedAt(Date.now());
    setAction('save');

    try {
      const saved = await knowledgeApi.updateState({ repoUrl: repoUrl || null, branch: branch || null, directories });
      setRepoUrlDraft(saved.repoUrl);
      setBranchDraft(saved.branch);
      setDirectoriesDraft((saved.directories ?? []).join('\n'));
      await refetchKnowledgeBase({ resetLoading: false });
      if (isOnboarding && saved.configured) {
        window.location.reload();
        return;
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setAction(null);
      setActionStartedAt(null);
    }
  }

  async function sync() {
    if (!knowledgeBaseState || !knowledgeBaseState.configured || action !== null) {
      return;
    }

    setSaveError(null);
    setActionStartedAt(Date.now());
    setAction('sync');

    try {
      const synced = await knowledgeApi.sync();
      setRepoUrlDraft(synced.repoUrl);
      setBranchDraft(synced.branch);
      await refetchKnowledgeBase({ resetLoading: false });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setAction(null);
      setActionStartedAt(null);
    }
  }

  useEffect(() => {
    if (isOnboarding || !knowledgeBaseState || !dirty || action !== null) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      void save();
    }, 700);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [action, branchDraft, directoriesDraft, dirty, isOnboarding, knowledgeBaseState, repoUrlDraft]);

  if (knowledgeBaseLoading && !knowledgeBaseState) {
    return <LoadingState label="Loading knowledge base..." />;
  }

  if (knowledgeBaseLoadError && !knowledgeBaseState) {
    return (
      <Notice tone="danger" title="Failed to load knowledge base">
        {knowledgeBaseLoadError}
      </Notice>
    );
  }

  if (!knowledgeBaseState) {
    return null;
  }

  return (
    <>
      <form
        className={isOnboarding ? 'space-y-4' : 'space-y-3'}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Field
          label="Repository"
          hint={
            isOnboarding
              ? 'Use an SSH/HTTPS remote or a local git repository path. Private repos use your local git credentials.'
              : undefined
          }
          htmlFor="settings-knowledge-base-repo"
        >
          <TextInput
            id="settings-knowledge-base-repo"
            name="knowledge-base-repo-url"
            type="text"
            value={repoUrlDraft}
            onChange={(event) => {
              setRepoUrlDraft(event.target.value);
              if (saveError) setSaveError(null);
            }}
            className="min-w-0 flex-1 font-mono text-[13px]"
            placeholder="git@github.com:you/knowledge-base.git, https://github.com/you/kb.git, or /path/to/repo"
            autoComplete="off"
            spellCheck={false}
            disabled={action !== null}
          />
        </Field>
        {isOnboarding ? null : (
          <Field label="Local directories" htmlFor="settings-knowledge-base-directories">
            <Textarea
              id="settings-knowledge-base-directories"
              name="knowledge-base-directories"
              value={directoriesDraft}
              onChange={(event) => {
                setDirectoriesDraft(event.target.value);
                if (saveError) setSaveError(null);
              }}
              className="min-h-20 min-w-0 flex-1 font-mono text-[13px]"
              placeholder={'/Users/you/Notes\n/Users/you/Projects/docs'}
              autoComplete="off"
              spellCheck={false}
              disabled={action !== null}
            />
          </Field>
        )}
        <Field label="Branch" htmlFor="settings-knowledge-base-branch">
          <TextInput
            id="settings-knowledge-base-branch"
            name="knowledge-base-branch"
            value={branchDraft}
            onChange={(event) => {
              setBranchDraft(event.target.value);
              if (saveError) setSaveError(null);
            }}
            className="min-w-0 flex-1 font-mono text-[13px]"
            placeholder="main"
            autoComplete="off"
            spellCheck={false}
            disabled={action !== null}
          />
        </Field>
        {isOnboarding ? null : (
          <>
            <CardMeta className="break-all">
              Managed mirror · <span className="font-mono text-[11px]">{knowledgeBaseState.managedRoot}</span>
            </CardMeta>
            <CardMeta className="break-all">
              Agent-visible knowledge paths ·{' '}
              <span className="font-mono text-[11px]">
                {(knowledgeBaseState.effectiveRoots ?? [knowledgeBaseState.effectiveRoot]).join(', ')}
              </span>
            </CardMeta>
            <CardMeta className={cx('break-all', action === null && syncPresentation.toneClass)}>
              {actionProgressText ?? syncPresentation.text}
            </CardMeta>
            <CardMeta className="break-all">
              Recovery copies · <span className="font-mono text-[11px]">{knowledgeBaseState.recoveryDir}</span> ·{' '}
              {knowledgeBaseState.recoveredEntryCount} saved
            </CardMeta>
          </>
        )}
        {isOnboarding ? (
          <div className="flex items-center gap-3 pt-1">
            <Button
              type="submit"
              variant="action"
              tone="accent"
              disabled={action !== null || repoUrlDraft.trim().length === 0}
              className="h-8 px-3 text-[12px] font-semibold"
            >
              {action === 'save' ? 'Connecting…' : 'Connect Repository'}
            </Button>
            <span className="text-[12px] text-dim">You can change this later in Settings.</span>
          </div>
        ) : null}
        {isOnboarding && actionProgressText ? (
          <Notice className="text-[12px]" role="status">
            <div className="mb-1 h-1.5 overflow-hidden rounded-md bg-border-subtle">
              <div className="h-full w-1/2 animate-pulse rounded-md bg-accent/80" />
            </div>
            {actionProgressText}
          </Notice>
        ) : null}
        {isOnboarding ? null : (
          <div className="flex flex-wrap items-center gap-2">
            <CardMeta as="span">{action === 'save' ? 'Saving…' : dirty ? 'Auto-save pending…' : 'Auto-saved'}</CardMeta>
            <ToolbarButton
              type="button"
              onClick={() => {
                void sync();
              }}
              disabled={action !== null || !knowledgeBaseState.configured}
              className="px-3 py-1.5 text-[12px] shadow-none"
            >
              {action === 'sync' ? 'Syncing…' : 'Sync now'}
            </ToolbarButton>
            <ToolbarButton
              type="button"
              onClick={() => {
                setRepoUrlDraft('');
                setBranchDraft('main');
                void save({
                  repoUrl: '',
                  branch: 'main',
                  directories: directoriesDraft
                    .split(/\r?\n/u)
                    .map((line) => line.trim())
                    .filter(Boolean),
                });
              }}
              disabled={action !== null || !knowledgeBaseState.configured}
              className="px-3 py-1.5 text-[12px] shadow-none"
            >
              Disable managed sync
            </ToolbarButton>
          </div>
        )}
        {isOnboarding ? null : (
          <CardMeta>
            Neon Pilot can index a managed git mirror and any local directories listed above. Folder and file @ mentions read from all
            agent-visible knowledge paths.
          </CardMeta>
        )}
      </form>

      {saveError ? <Notice tone="danger">{saveError}</Notice> : null}
    </>
  );
}
