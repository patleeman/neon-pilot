import type { NeonPilotClient } from '@neon-pilot/extensions';
import React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';

const ONBOARDING_ENSURE_DELAY_MS = 900;
const COMPOSER_DRAFT_RETRY_MS = 100;
const COMPOSER_DRAFT_MAX_ATTEMPTS = 20;
const EXTENSION_PROMPT =
  'Help me build a small Neon Pilot extension for something I do often. Ask me what workflow I want to improve, then propose the simplest useful version before changing anything.';

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
    title: 'Choose your AI model',
    body: 'Neon Pilot needs a model before it can chat. Pick the provider you use, sign in or add a key, then choose the model to use for new chats.',
    detail: 'You can change this later in Settings.',
  },
  {
    id: 'extensions',
    route: '/extensions',
    title: 'Features live in Extensions',
    body: 'Extensions are the parts of Neon Pilot you can turn on, replace, or change. They add things like Files, Terminal, Artifacts, Automations, and Settings.',
    detail: 'This is where you manage them.',
  },
  {
    id: 'extension-authoring',
    route: '/extensions',
    title: 'Ask for the app you want',
    body: 'If Neon Pilot is missing something, ask the agent to build it as an extension. Start small, try it, then keep asking for changes until it fits how you work.',
    detail: 'Examples: a release checklist, a PR summary button, a notes panel, or a tool for your internal API.',
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
    title: 'Try your first change',
    body: 'A good first prompt is: build a small extension for something I do often. The agent can ask questions, make the first version, and help you refine it.',
    detail: 'The button below drafts that prompt so you can edit it before sending.',
  },
];

function canAutoStartOnboarding(pathname: string): boolean {
  return pathname === '/' || pathname === '/conversations' || pathname === '/conversations/new';
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
  const startedPathnameRef = useRef(location.pathname);
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
  }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;
    const startedPathname = startedPathnameRef.current;
    const timer = window.setTimeout(() => {
      void pa.extension
        .invoke('ensure', { source: 'frontend' })
        .then((result) => {
          if (cancelled) return;
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
  }, [navigateToStep, pa, startTour]);

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
        draftComposerTextWhenReady(EXTENSION_PROMPT);
      }, COMPOSER_DRAFT_RETRY_MS);
    } finally {
      setBusy(false);
    }
  }, [navigate, stepIndex, updateTour]);

  if (!active || typeof document === 'undefined') {
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
                    Draft extension prompt
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
