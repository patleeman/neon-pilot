import type { NeonPilotClient } from '@neon-pilot/extensions';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const ONBOARDING_ENSURE_DELAY_MS = 2_000;

interface EnsureResult {
  created?: boolean;
  conversationId?: string;
  shouldOpen?: boolean;
}

function canAutoOpenOnboarding(pathname: string): boolean {
  return pathname === '/' || pathname === '/conversations';
}

export function OnboardingBootstrap({ pa }: { pa: NeonPilotClient }) {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  const location = useLocation();
  const pathnameRef = useRef(location.pathname);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    const startedPathname = pathnameRef.current;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const currentBeforeEnsure = pathnameRef.current;
      if (!canAutoOpenOnboarding(startedPathname) || !canAutoOpenOnboarding(currentBeforeEnsure)) {
        return;
      }
      void pa.extension
        .invoke('ensure', { source: 'frontend' })
        .then((result) => {
          if (cancelled) return;
          const ensureResult = result as EnsureResult;
          if (!ensureResult.conversationId || ensureResult.shouldOpen !== true) {
            return;
          }
          const target = `/conversations/${encodeURIComponent(ensureResult.conversationId)}`;
          const currentPathname = pathnameRef.current;
          if (!canAutoOpenOnboarding(startedPathname) && startedPathname !== target) {
            return;
          }
          if (currentPathname !== startedPathname && currentPathname !== target) {
            return;
          }
          if (currentPathname !== target) {
            navigateRef.current(target, { replace: true });
          }
        })
        .catch((error) => {
          console.warn('[system-onboarding] failed to ensure onboarding conversation', error);
        });
    }, ONBOARDING_ENSURE_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pa]);

  return null;
}
