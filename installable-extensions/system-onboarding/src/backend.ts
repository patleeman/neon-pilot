import type { ExtensionBackendContext } from '@neon-pilot/extensions/backend';

const ONBOARDING_STATE_KEY = 'onboarding:v1';

interface OnboardingState {
  completed: boolean;
  conversationId?: string;
  completedAt: string;
  openedInUi?: boolean;
}

interface EnsureInput {
  source?: string;
}

interface EnsureResult {
  created: boolean;
  conversationId?: string;
  skipped?: string;
  shouldOpen?: boolean;
}

const ensureInFlightByRuntimeScope = new Map<string, Promise<EnsureResult>>();

const onboardingMessage = `Welcome to Neon Pilot. This first conversation is here to get you unstuck before the app becomes a very expensive blank text box.

Start here:

1. Open **Settings** and configure your model provider first. Neon Pilot needs a provider before normal agent conversations can run.
2. Neon Pilot is extension-based. Most product features live as extensions, including tools, panels, automations, browser features, artifacts, and workflow helpers.
3. Open **Settings → Extensions** to enable, disable, inspect, or manage extensions and imported plugin packages. System extensions ship with the app; user extensions are where your own workflows belong.
4. After your provider is configured, start a new conversation and ask Neon Pilot to help with a real task. The app works best when you give it a concrete objective and let it use tools.

Recommended first move: configure your provider, then come back and ask “what can you do in this repo?”`;

function disableOnboarding(ctx: ExtensionBackendContext): void {
  // Defer disable so it doesn't run inside the enable handler.
  // Calling setEnabled from within the enable handler could cause
  // recursion or undefined lifecycle behavior.
  queueMicrotask(() => {
    ctx.extensions?.setEnabled?.(ctx.extensionId, false);
    ctx.ui?.invalidate?.(['extensions']);
  });
}

async function ensureOnce(input: EnsureInput | undefined, ctx: ExtensionBackendContext): Promise<EnsureResult> {
  const frontendRequest = input?.source === 'frontend';
  const existingState = await ctx.storage.get<OnboardingState>(ONBOARDING_STATE_KEY);
  if (existingState?.completed) {
    if (frontendRequest && existingState.conversationId && !existingState.openedInUi) {
      await ctx.storage.put(ONBOARDING_STATE_KEY, {
        ...existingState,
        openedInUi: true,
      } satisfies OnboardingState);
      disableOnboarding(ctx);
      return {
        created: false,
        conversationId: existingState.conversationId,
        skipped: 'completed',
        shouldOpen: true,
      };
    }

    disableOnboarding(ctx);
    return {
      created: false,
      conversationId: existingState.conversationId,
      skipped: 'completed',
      shouldOpen: false,
    };
  }

  const created = (await ctx.conversations.create({
    cwd: ctx.runtime.getRepoRoot(),
    title: 'Welcome to Neon Pilot',
    live: false,
  })) as { id?: string; conversationId?: string };
  const conversationId = created.conversationId ?? created.id;
  if (!conversationId) {
    throw new Error('Onboarding conversation was not created.');
  }
  await ctx.conversations.appendTranscriptBlock({
    conversationId,
    blockType: 'onboarding_intro',
    title: onboardingMessage,
    data: { source: ctx.extensionId },
  });

  await ctx.storage.put(ONBOARDING_STATE_KEY, {
    completed: true,
    conversationId,
    completedAt: new Date().toISOString(),
    openedInUi: frontendRequest,
  } satisfies OnboardingState);
  disableOnboarding(ctx);

  return { created: true, conversationId, shouldOpen: frontendRequest };
}

export async function ensure(input: unknown, ctx: ExtensionBackendContext): Promise<EnsureResult> {
  const runtimeScope = ctx.runtimeScope ?? ctx.profile;
  const existingTask = ensureInFlightByRuntimeScope.get(runtimeScope);
  if (existingTask) {
    return existingTask;
  }

  const normalizedInput = input && typeof input === 'object' ? (input as EnsureInput) : undefined;
  const task = ensureOnce(normalizedInput, ctx).finally(() => {
    if (ensureInFlightByRuntimeScope.get(runtimeScope) === task) {
      ensureInFlightByRuntimeScope.delete(runtimeScope);
    }
  });
  ensureInFlightByRuntimeScope.set(runtimeScope, task);
  return task;
}
