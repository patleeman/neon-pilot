import type { NeonPilotClient } from '@neon-pilot/extensions';
import { Button, Notice, SettingsPanel, SettingsRow, TextInput } from '@neon-pilot/extensions/settings';
import React from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';

const ONBOARDING_ENSURE_DELAY_MS = 900;
const COMPOSER_DRAFT_RETRY_MS = 100;
const COMPOSER_DRAFT_MAX_ATTEMPTS = 20;
const WINDOWED_SHELL_ACTIVE_ATTRIBUTE = 'data-neon-pilot-windowed-shell-active';
const HELLO_AGENT_PROMPT =
  "Hi, I'm new to Neon Pilot. Can you give me a quick tour of what I can do here, then help me choose a good first thing to try?";

type OnboardingTourStatus = 'unseen' | 'active' | 'completed' | 'skipped';

interface OnboardingTourState {
  status: OnboardingTourStatus;
  stepIndex: number;
  updatedAt: string;
}

interface EnsureResult {
  state?: OnboardingTourState;
  shouldStart?: boolean;
}

interface TourStep {
  id: string;
  route: string;
  target?: string;
  title: string;
  body: string;
  detail: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'provider',
    route: '/settings/providers',
    target: '#settings-providers',
    title: 'Choose your AI provider',
    body: 'Neon Pilot needs an AI provider before it can chat. Pick the provider you use, sign in or add a key, then choose the model to use for new chats.',
    detail: 'You can change this later in Settings.',
  },
  {
    id: 'extensions',
    route: '/extensions',
    title: 'Features live in Apps',
    body: 'Apps are the parts of Neon Pilot you can turn on, replace, or change. They add things like Files, Terminal, Artifacts, Automations, and Settings.',
    detail: 'This is where you manage them.',
  },
  {
    id: 'extension-authoring',
    route: '/extensions',
    target: '[data-onboarding-target="build-extension"]',
    title: 'Ask for the app you want',
    body: 'If Neon Pilot is missing something, start here. The agent will ask what you want, sketch a first version, build it as an app package, and keep changing it with you.',
    detail: 'Try a release checklist, a PR summary button, a notes panel, or a tool for your internal API.',
  },
  {
    id: 'conversation',
    route: '/conversations/new',
    target: '[aria-label="Saved workspace"]',
    title: 'Start a chat, or choose a folder',
    body: 'Use a normal chat for questions. Choose a folder when you want Neon Pilot to read files, edit code, or run commands for a project.',
    detail: 'You can mention files with @ and use / for commands.',
  },
  {
    id: 'first-extension-prompt',
    route: '/conversations/new',
    target: 'textarea',
    title: 'Say hello to the agent',
    body: 'The easiest way to start is to ask what Neon Pilot can do. The agent can explain the main workflows, suggest a useful first task, and help you from there.',
    detail: 'The button below drafts a first message. You can edit it before sending.',
  },
];

function canAutoStartOnboarding(pathname: string): boolean {
  return pathname === '/' || pathname === '/conversations' || pathname === '/conversations/new';
}

function shouldSuppressOnboardingAutoStart(locationState: unknown): boolean {
  return Boolean(
    locationState &&
    typeof locationState === 'object' &&
    (locationState as { suppressOnboardingAutoStart?: unknown }).suppressOnboardingAutoStart === true,
  );
}

function isWindowedShellActive(): boolean {
  if (typeof document === 'undefined') return false;
  return document.body.hasAttribute(WINDOWED_SHELL_ACTIVE_ATTRIBUTE) || Boolean(document.querySelector('.windowed-os-shell'));
}

function useWindowedShellActive(): boolean {
  const [active, setActive] = useState(() => isWindowedShellActive());

  useLayoutEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
      return undefined;
    }

    const update = () => setActive(isWindowedShellActive());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: [WINDOWED_SHELL_ACTIVE_ATTRIBUTE],
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, []);

  return active;
}

function clampStepIndex(index: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(0, Math.floor(index)), TOUR_STEPS.length - 1);
}

function readEnsureState(result: unknown): OnboardingTourState | null {
  const maybe = result && typeof result === 'object' ? (result as EnsureResult).state : null;
  if (!maybe || typeof maybe !== 'object') return null;
  if (maybe.status !== 'unseen' && maybe.status !== 'active' && maybe.status !== 'completed' && maybe.status !== 'skipped') {
    return null;
  }
  return {
    status: maybe.status,
    stepIndex: clampStepIndex(maybe.stepIndex),
    updatedAt: typeof maybe.updatedAt === 'string' ? maybe.updatedAt : new Date().toISOString(),
  };
}

function shouldStartFromEnsure(result: unknown): boolean {
  return Boolean(result && typeof result === 'object' && (result as EnsureResult).shouldStart === true);
}

function draftComposerTextWhenReady(text: string, attempt = 0): void {
  const textarea = document.querySelector('textarea');
  const currentValue = textarea instanceof HTMLTextAreaElement ? textarea.value : '';
  if (currentValue.includes(text)) {
    return;
  }

  if (textarea) {
    window.dispatchEvent(new CustomEvent('neon-pilot:composer-append-text', { detail: { text } }));
    window.dispatchEvent(new CustomEvent('neon-pilot:composer-focus'));
  }

  if (attempt + 1 < COMPOSER_DRAFT_MAX_ATTEMPTS) {
    window.setTimeout(() => draftComposerTextWhenReady(text, attempt + 1), COMPOSER_DRAFT_RETRY_MS);
  }
}

function useTargetRect(selector: string | undefined, routeKey: string, active: boolean): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!active || !selector || typeof document === 'undefined') {
      setRect(null);
      return;
    }

    let frame: number | null = null;
    let cancelled = false;
    const update = () => {
      if (cancelled) return;
      const element = document.querySelector(selector);
      setRect(element ? element.getBoundingClientRect() : null);
    };
    frame = window.requestAnimationFrame(update);
    const timers = [window.setTimeout(update, 250), window.setTimeout(update, 700)];
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelled = true;
      if (frame !== null) window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [active, routeKey, selector]);

  return rect;
}

function OnboardingStyles() {
  return (
    <style>{`
      .np-onboarding-highlight {
        position: fixed;
        z-index: 120;
        pointer-events: none;
        border: 1px solid rgb(var(--color-accent) / 0.72);
        border-radius: 10px;
      }
      .np-onboarding-panel {
        --np-onboarding-surface: rgb(var(--color-surface));
        --np-onboarding-control: rgb(var(--color-elevated));
        --np-onboarding-control-hover: rgb(var(--color-hover, var(--color-panel)));
        --np-onboarding-primary-bg: rgb(var(--color-accent-bg, var(--color-selection)) / 0.72);
        --np-onboarding-primary-hover: rgb(var(--color-accent-bg, var(--color-selection)));
        position: fixed;
        z-index: 121;
        width: min(25rem, calc(100vw - 2rem));
        border: 1px solid rgb(var(--color-border-default));
        border-radius: 8px;
        background: var(--np-onboarding-surface);
        color: rgb(var(--color-primary));
      }
      .np-onboarding-panel-inner {
        padding: 14px;
      }
      .np-onboarding-kicker {
        margin: 0 0 7px;
        color: rgb(var(--color-dim));
        font: 600 10px/1.3 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .np-onboarding-title {
        margin: 0;
        font-size: 16px;
        font-weight: 680;
        line-height: 1.25;
      }
      .np-onboarding-body {
        margin: 8px 0 0;
        color: rgb(var(--color-secondary));
        font-size: 13px;
        line-height: 1.55;
      }
      .np-onboarding-detail {
        margin: 9px 0 0;
        color: rgb(var(--color-dim));
        font-size: 12px;
        line-height: 1.45;
      }
      .np-onboarding-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-top: 14px;
      }
      .np-onboarding-action-group {
        display: flex;
        align-items: center;
        gap: 7px;
      }
      .np-onboarding-button {
        min-height: 30px;
        border: 1px solid rgb(var(--color-border-default));
        border-radius: 6px;
        background: var(--np-onboarding-control);
        color: rgb(var(--color-primary));
        padding: 5px 9px;
        font: inherit;
        font-size: 12px;
      }
      .np-onboarding-button:hover {
        background: var(--np-onboarding-control-hover);
      }
      .np-onboarding-button:focus-visible {
        outline: 2px solid rgb(var(--color-accent) / 0.56);
        outline-offset: 2px;
      }
      .np-onboarding-button:disabled {
        cursor: default;
        opacity: 0.58;
      }
      .np-onboarding-button-primary {
        border-color: rgb(var(--color-accent) / 0.42);
        background: var(--np-onboarding-primary-bg);
        color: rgb(var(--color-primary));
      }
      .np-onboarding-button-primary:hover {
        background: var(--np-onboarding-primary-hover);
      }
      .np-onboarding-link-button {
        border-color: transparent;
        background: transparent;
        color: rgb(var(--color-dim));
      }
      .np-onboarding-link-button:hover {
        background: transparent;
        color: rgb(var(--color-primary));
      }
      @media (max-width: 720px) {
        .np-onboarding-panel {
          left: 1rem !important;
          right: 1rem !important;
          top: auto !important;
          bottom: 1rem !important;
          width: auto;
        }
      }
    `}</style>
  );
}

function resolvePanelPosition(rect: DOMRect | null): { left: number; top: number } {
  const panelWidth = Math.min(400, Math.max(320, window.innerWidth - 32));
  const panelHeight = 260;
  if (!rect) {
    return {
      left: Math.max(16, window.innerWidth - panelWidth - 24),
      top: Math.max(16, window.innerHeight - panelHeight - 24),
    };
  }

  const rightSpace = window.innerWidth - rect.right;
  const left = rightSpace >= panelWidth + 28 ? rect.right + 14 : Math.max(16, Math.min(rect.left, window.innerWidth - panelWidth - 16));
  const below = rect.bottom + 14;
  const top = below + panelHeight < window.innerHeight ? below : Math.max(16, Math.min(rect.top, window.innerHeight - panelHeight - 16));
  return { left, top };
}

export function OnboardingBootstrap({ pa }: { pa: NeonPilotClient }) {
  const navigate = useNavigate();
  const location = useLocation();
  const windowedShellActive = useWindowedShellActive();
  const startedPathnameRef = useRef(location.pathname);
  const suppressAutoStartRef = useRef(shouldSuppressOnboardingAutoStart(location.state));
  const pathnameRef = useRef(location.pathname);
  const [state, setState] = useState<OnboardingTourState | null>(null);
  const [busy, setBusy] = useState(false);
  const active = state?.status === 'active';
  const stepIndex = clampStepIndex(state?.stepIndex ?? 0);
  const step = TOUR_STEPS[stepIndex];
  const targetRect = useTargetRect(step?.target, `${location.pathname}${location.search}`, active);
  const panelPosition = useMemo(() => (active ? resolvePanelPosition(targetRect) : { left: 0, top: 0 }), [active, targetRect]);

  const navigateToStep = useCallback(
    (nextIndex: number, replace = false) => {
      const nextStep = TOUR_STEPS[clampStepIndex(nextIndex)];
      navigate(nextStep.route, { replace });
    },
    [navigate],
  );

  const updateTour = useCallback(
    async (nextStatus: OnboardingTourStatus, nextIndex: number) => {
      const clampedIndex = clampStepIndex(nextIndex);
      const optimistic: OnboardingTourState = {
        status: nextStatus,
        stepIndex: clampedIndex,
        updatedAt: new Date().toISOString(),
      };
      setState(optimistic);
      const result = await pa.extension.invoke('update', { status: nextStatus, stepIndex: clampedIndex });
      const persisted = readEnsureState(result);
      if (persisted) {
        setState(persisted);
      }
    },
    [pa],
  );

  const startTour = useCallback(
    async (replace = true) => {
      if (isWindowedShellActive()) {
        return;
      }
      setBusy(true);
      try {
        navigateToStep(0, replace);
        await updateTour('active', 0);
      } finally {
        setBusy(false);
      }
    },
    [navigateToStep, updateTour],
  );

  useEffect(() => {
    pathnameRef.current = location.pathname;
    startedPathnameRef.current = location.pathname;
    suppressAutoStartRef.current = shouldSuppressOnboardingAutoStart(location.state);
  }, [location.pathname, location.state]);

  useEffect(() => {
    if (windowedShellActive) {
      return undefined;
    }

    let cancelled = false;
    const startedPathname = startedPathnameRef.current;
    const timer = window.setTimeout(() => {
      if (isWindowedShellActive()) {
        return;
      }
      void pa.extension
        .invoke('ensure', { source: 'frontend' })
        .then((result) => {
          if (cancelled) return;
          if (isWindowedShellActive()) return;
          const ensuredState = readEnsureState(result);
          if (ensuredState?.status === 'active') {
            setState(ensuredState);
            navigateToStep(ensuredState.stepIndex, true);
            return;
          }
          if (ensuredState) {
            setState(ensuredState);
          }
          if (!shouldStartFromEnsure(result)) {
            return;
          }
          const currentPathname = pathnameRef.current;
          if (suppressAutoStartRef.current) {
            return;
          }
          if (!canAutoStartOnboarding(startedPathname) || !canAutoStartOnboarding(currentPathname)) {
            return;
          }
          void startTour(true);
        })
        .catch((error) => {
          console.warn('[system-onboarding] failed to ensure onboarding tour', error);
        });
    }, ONBOARDING_ENSURE_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [navigateToStep, pa, startTour, windowedShellActive]);

  const moveToStep = useCallback(
    async (nextIndex: number) => {
      setBusy(true);
      try {
        navigateToStep(nextIndex);
        await updateTour('active', nextIndex);
      } finally {
        setBusy(false);
      }
    },
    [navigateToStep, updateTour],
  );

  const skipTour = useCallback(async () => {
    setBusy(true);
    try {
      await updateTour('skipped', stepIndex);
    } finally {
      setBusy(false);
    }
  }, [stepIndex, updateTour]);

  const finishTour = useCallback(async () => {
    setBusy(true);
    try {
      await updateTour('completed', stepIndex);
      navigate('/conversations/new');
      window.setTimeout(() => {
        draftComposerTextWhenReady(HELLO_AGENT_PROMPT);
      }, COMPOSER_DRAFT_RETRY_MS);
    } finally {
      setBusy(false);
    }
  }, [navigate, stepIndex, updateTour]);

  if (!active || windowedShellActive || typeof document === 'undefined') {
    return null;
  }

  const isLastStep = stepIndex >= TOUR_STEPS.length - 1;
  const highlightStyle = targetRect
    ? {
        left: Math.max(8, targetRect.left - 6),
        top: Math.max(8, targetRect.top - 6),
        width: targetRect.width + 12,
        height: targetRect.height + 12,
      }
    : null;

  return createPortal(
    <>
      <OnboardingStyles />
      {highlightStyle ? <div className="np-onboarding-highlight" style={highlightStyle} aria-hidden="true" /> : null}
      <section
        className="np-onboarding-panel"
        style={{ left: panelPosition.left, top: panelPosition.top }}
        role="dialog"
        aria-modal="false"
        aria-labelledby="np-onboarding-title"
        data-testid="onboarding-tour"
      >
        <div className="np-onboarding-panel-inner">
          <p className="np-onboarding-kicker">
            Tour {stepIndex + 1} of {TOUR_STEPS.length}
          </p>
          <h2 className="np-onboarding-title" id="np-onboarding-title">
            {step.title}
          </h2>
          <p className="np-onboarding-body">{step.body}</p>
          <p className="np-onboarding-detail">{step.detail}</p>
          <div className="np-onboarding-actions">
            {/* ui-pattern-ok raw-control reason="First-run top-bar bootstrap must stay standalone and avoid loading the full extension UI chunk before the tour renders." */}
            <button type="button" className="np-onboarding-button np-onboarding-link-button" onClick={skipTour} disabled={busy}>
              Skip tour
            </button>
            <div className="np-onboarding-action-group">
              {stepIndex > 0 ? (
                <>
                  {/* ui-pattern-ok raw-control reason="First-run top-bar bootstrap must stay standalone and avoid loading the full extension UI chunk before the tour renders." */}
                  <button type="button" className="np-onboarding-button" onClick={() => void moveToStep(stepIndex - 1)} disabled={busy}>
                    Back
                  </button>
                </>
              ) : null}
              {isLastStep ? (
                <>
                  {/* ui-pattern-ok raw-control reason="First-run top-bar bootstrap must stay standalone and avoid loading the full extension UI chunk before the tour renders." */}
                  <button
                    type="button"
                    className="np-onboarding-button np-onboarding-button-primary"
                    onClick={() => void finishTour()}
                    disabled={busy}
                  >
                    Draft first message
                  </button>
                </>
              ) : (
                <>
                  {/* ui-pattern-ok raw-control reason="First-run top-bar bootstrap must stay standalone and avoid loading the full extension UI chunk before the tour renders." */}
                  <button
                    type="button"
                    className="np-onboarding-button np-onboarding-button-primary"
                    onClick={() => void moveToStep(stepIndex + 1)}
                    disabled={busy}
                  >
                    Next
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </>,
    document.body,
  );
}

export function PersonaNameSettingsPanel({ pa }: { pa: NeonPilotClient }) {
  const [currentName, setCurrentName] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void pa.extension
      .invoke('personaNameStatus')
      .then((result: unknown) => {
        if (cancelled) return;
        const maybe = result && typeof result === 'object' ? (result as Record<string, unknown>) : {};
        const name = typeof maybe.name === 'string' ? maybe.name : '';
        setCurrentName(name || 'Neon Pilot Persona');
        setEditName(name || '');
      })
      .catch((error: Error) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [pa]);

  async function handleSave() {
    const trimmed = editName.trim();
    if (!trimmed) {
      setMessage('Name must not be empty.');
      return;
    }
    setBusy('Saving...');
    setMessage(null);
    setSaved(false);
    try {
      await pa.extension.invoke('setPersonaName', { name: trimmed });
      setCurrentName(trimmed);
      setEditName(trimmed);
      setSaved(true);
      setMessage('Name saved!');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <SettingsPanel title="Persona name" description="Choose the name Neon Pilot uses for your AI assistant." contentClassName="gap-3">
      <SettingsRow
        title="Assistant name"
        description="Stored in your persona soul doc and used when the assistant introduces itself."
        actionsClassName="min-w-[16rem] max-w-md flex-col items-stretch gap-2 sm:flex-row sm:items-center"
      >
        <TextInput
          id="persona-name-input"
          type="text"
          value={editName}
          onChange={(e) => {
            setEditName(e.target.value);
            setSaved(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSave();
          }}
          className="min-w-0 flex-1"
          placeholder="Enter a name for your assistant"
          disabled={Boolean(busy)}
          autoComplete="off"
          spellCheck={false}
        />
        <Button
          variant="action"
          tone="accent"
          onClick={() => void handleSave()}
          disabled={Boolean(busy) || !editName.trim() || editName.trim() === currentName}
        >
          {busy === 'Saving...' ? 'Saving...' : 'Save'}
        </Button>
      </SettingsRow>
      {busy ? <Notice tone="info">{busy}</Notice> : null}
      {!busy && message ? <Notice tone={saved ? 'success' : 'warning'}>{message}</Notice> : null}
    </SettingsPanel>
  );
}
