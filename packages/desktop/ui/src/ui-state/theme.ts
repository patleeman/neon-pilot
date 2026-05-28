import { createContext, createElement, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api } from '../client/api';
import type { ExtensionManifest } from '../extensions/types';
import { ACCENT_STORAGE_KEY, DARK_THEME_STORAGE_KEY, LIGHT_THEME_STORAGE_KEY, THEME_STORAGE_KEY } from '../local/localSettings';

type ThemeAppearance = 'light' | 'dark';
type Theme = 'light' | 'dark' | string;
export type ThemePreference = 'light' | 'dark' | 'system';
export type ThemeAccent = 'lime' | 'forest' | 'cobalt' | 'ember' | 'violet' | 'ink';

interface AccentTokenSet {
  accent: string;
  accentBg: string;
  selection: string;
  warning: string;
  base: string;
  surface: string;
  elevated: string;
  panel: string;
  borderSubtle: string;
  borderDefault: string;
  hover: string;
  active: string;
}

const THEME_ACCENTS: Array<{ id: ThemeAccent; label: string; light: AccentTokenSet; dark: AccentTokenSet }> = [
  {
    id: 'lime',
    label: 'Lime',
    light: {
      accent: '62 184 0',
      accentBg: '226 246 215',
      selection: '202 255 51',
      warning: '184 115 10',
      base: '247 246 241',
      surface: '255 255 255',
      elevated: '251 250 245',
      panel: '240 238 229',
      borderSubtle: '227 224 212',
      borderDefault: '211 207 190',
      hover: '240 238 229',
      active: '232 229 216',
    },
    dark: {
      accent: '202 255 51',
      accentBg: '45 56 14',
      selection: '71 88 24',
      warning: '255 180 73',
      base: '12 12 8',
      surface: '26 26 19',
      elevated: '36 36 28',
      panel: '20 20 15',
      borderSubtle: '44 44 36',
      borderDefault: '61 61 49',
      hover: '36 36 28',
      active: '46 46 36',
    },
  },
  {
    id: 'forest',
    label: 'Forest',
    light: {
      accent: '47 122 58',
      accentBg: '226 240 228',
      selection: '108 229 138',
      warning: '47 122 58',
      base: '246 247 243',
      surface: '255 255 252',
      elevated: '249 251 246',
      panel: '238 242 234',
      borderSubtle: '224 230 220',
      borderDefault: '208 216 202',
      hover: '238 242 234',
      active: '229 235 224',
    },
    dark: {
      accent: '108 229 138',
      accentBg: '22 52 31',
      selection: '34 82 49',
      warning: '108 229 138',
      base: '8 12 9',
      surface: '18 25 19',
      elevated: '27 37 29',
      panel: '13 19 14',
      borderSubtle: '33 45 35',
      borderDefault: '48 65 51',
      hover: '25 34 27',
      active: '34 47 36',
    },
  },
  {
    id: 'cobalt',
    label: 'Cobalt',
    light: {
      accent: '31 95 200',
      accentBg: '225 234 251',
      selection: '116 168 255',
      warning: '31 95 200',
      base: '245 246 249',
      surface: '252 253 255',
      elevated: '247 249 253',
      panel: '235 239 246',
      borderSubtle: '220 226 237',
      borderDefault: '202 211 227',
      hover: '235 239 246',
      active: '225 231 242',
    },
    dark: {
      accent: '116 168 255',
      accentBg: '24 41 74',
      selection: '37 64 115',
      warning: '116 168 255',
      base: '7 9 13',
      surface: '15 18 24',
      elevated: '25 30 40',
      panel: '11 14 19',
      borderSubtle: '31 38 52',
      borderDefault: '45 55 76',
      hover: '23 28 38',
      active: '33 40 55',
    },
  },
  {
    id: 'ember',
    label: 'Ember',
    light: {
      accent: '196 77 18',
      accentBg: '249 231 220',
      selection: '255 147 82',
      warning: '196 77 18',
      base: '249 246 243',
      surface: '255 253 250',
      elevated: '252 248 244',
      panel: '244 236 229',
      borderSubtle: '232 222 214',
      borderDefault: '218 205 194',
      hover: '244 236 229',
      active: '235 225 216',
    },
    dark: {
      accent: '255 147 82',
      accentBg: '72 36 20',
      selection: '113 57 32',
      warning: '255 147 82',
      base: '13 9 7',
      surface: '25 18 14',
      elevated: '39 28 22',
      panel: '19 13 10',
      borderSubtle: '52 38 30',
      borderDefault: '76 55 43',
      hover: '36 26 20',
      active: '51 37 29',
    },
  },
  {
    id: 'violet',
    label: 'Violet',
    light: {
      accent: '106 61 209',
      accentBg: '235 228 251',
      selection: '182 156 255',
      warning: '106 61 209',
      base: '247 245 250',
      surface: '254 252 255',
      elevated: '250 247 254',
      panel: '239 235 247',
      borderSubtle: '226 220 237',
      borderDefault: '211 202 228',
      hover: '239 235 247',
      active: '230 224 242',
    },
    dark: {
      accent: '182 156 255',
      accentBg: '47 36 82',
      selection: '74 56 128',
      warning: '182 156 255',
      base: '10 8 13',
      surface: '20 16 26',
      elevated: '32 26 43',
      panel: '15 12 20',
      borderSubtle: '41 34 55',
      borderDefault: '60 49 82',
      hover: '29 24 39',
      active: '42 34 57',
    },
  },
  {
    id: 'ink',
    label: 'Ink',
    light: {
      accent: '20 20 15',
      accentBg: '235 234 229',
      selection: '20 20 15',
      warning: '20 20 15',
      base: '247 246 243',
      surface: '255 255 252',
      elevated: '249 248 245',
      panel: '239 238 233',
      borderSubtle: '226 224 218',
      borderDefault: '210 207 199',
      hover: '239 238 233',
      active: '230 228 221',
    },
    dark: {
      accent: '245 243 232',
      accentBg: '46 46 36',
      selection: '82 80 66',
      warning: '245 243 232',
      base: '10 10 10',
      surface: '22 22 21',
      elevated: '34 34 32',
      panel: '16 16 15',
      borderSubtle: '40 40 37',
      borderDefault: '58 57 52',
      hover: '32 32 30',
      active: '44 43 39',
    },
  },
];

export interface ColorTheme {
  id: Theme;
  label: string;
  appearance: ThemeAppearance;
  tokens?: Record<string, string>;
  extensionId?: string;
}

const BUILT_IN_THEMES: ColorTheme[] = [
  { id: 'studio-light', label: 'Light', appearance: 'light' },
  { id: 'studio-dark', label: 'Dark', appearance: 'dark' },
];

const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';
const DEFAULT_LIGHT_THEME: Theme = 'studio-light';
const DEFAULT_DARK_THEME: Theme = 'studio-dark';
const DEFAULT_ACCENT: ThemeAccent = 'cobalt';
const SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)';

interface ThemeContextValue {
  theme: Theme;
  themePreference: ThemePreference;
  lightTheme: Theme;
  darkTheme: Theme;
  availableThemes: ColorTheme[];
  setThemePreference: (theme: ThemePreference) => void;
  setLightTheme: (theme: Theme) => void;
  setDarkTheme: (theme: Theme) => void;
  accent: ThemeAccent;
  availableAccents: typeof THEME_ACCENTS;
  setAccent: (accent: ThemeAccent) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function setStoredThemeValue(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures.
  }
}

function normalizeThemeId(theme: Theme): Theme {
  if (theme === 'light' || theme === 'tokyo-night-light') return 'studio-light';
  if (theme === 'dark' || theme === 'tokyo-night-dark') return 'studio-dark';
  return theme;
}

function findTheme(themes: ColorTheme[], theme: Theme): ColorTheme {
  const normalizedTheme = normalizeThemeId(theme);
  return themes.find((candidate) => candidate.id === normalizedTheme) ?? BUILT_IN_THEMES[0];
}

function normalizeAccent(value: string | null | undefined): ThemeAccent {
  return THEME_ACCENTS.some((accent) => accent.id === value) ? (value as ThemeAccent) : DEFAULT_ACCENT;
}

function accentTokensFor(accent: ThemeAccent, appearance: ThemeAppearance): AccentTokenSet {
  const entry = THEME_ACCENTS.find((candidate) => candidate.id === accent) ?? THEME_ACCENTS[0];
  return appearance === 'dark' ? entry.dark : entry.light;
}

function applyAccent(accent: ThemeAccent, appearance: ThemeAppearance) {
  if (typeof document === 'undefined') return;

  const tokens = accentTokensFor(accent, appearance);
  document.documentElement.setAttribute('data-accent', accent);
  document.documentElement.style.setProperty('--color-base', tokens.base);
  document.documentElement.style.setProperty('--color-surface', tokens.surface);
  document.documentElement.style.setProperty('--color-elevated', tokens.elevated);
  document.documentElement.style.setProperty('--color-panel', tokens.panel);
  document.documentElement.style.setProperty('--color-border-subtle', tokens.borderSubtle);
  document.documentElement.style.setProperty('--color-border-default', tokens.borderDefault);
  document.documentElement.style.setProperty('--color-hover', tokens.hover);
  document.documentElement.style.setProperty('--color-active', tokens.active);
  document.documentElement.style.setProperty('--color-accent', tokens.accent);
  document.documentElement.style.setProperty('--color-teal', tokens.accent);
  document.documentElement.style.setProperty('--color-steel', tokens.accent);
  document.documentElement.style.setProperty('--color-mission-glow', tokens.accent);
  document.documentElement.style.setProperty('--color-streaming-glow', tokens.accent);
  document.documentElement.style.setProperty('--color-accent-bg', tokens.accentBg);
  document.documentElement.style.setProperty('--color-selection', tokens.selection);
  document.documentElement.style.setProperty('--color-warning', tokens.warning);
  document.documentElement.style.setProperty('--pa-accent', 'rgb(var(--color-accent))');
  document.documentElement.style.setProperty('--pa-accent-hover', 'rgb(var(--color-accent))');
}

function applyTheme(theme: ColorTheme, accent: ThemeAccent = DEFAULT_ACCENT) {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.setAttribute('data-theme', theme.id);
  document.documentElement.setAttribute('data-theme-appearance', theme.appearance);
  document.documentElement.style.colorScheme = theme.appearance;

  for (const property of Array.from(document.documentElement.style)) {
    if (property.startsWith('--color-')) {
      document.documentElement.style.removeProperty(property);
    }
  }

  for (const [property, value] of Object.entries(theme.tokens ?? {})) {
    document.documentElement.style.setProperty(property, value);
  }

  applyAccent(accent, theme.appearance);

  document.documentElement.style.setProperty('--pa-bg', 'rgb(var(--color-base))');
  document.documentElement.style.setProperty('--pa-surface', 'rgb(var(--color-surface))');
  document.documentElement.style.setProperty('--pa-surface-hover', 'rgb(var(--color-elevated))');
  document.documentElement.style.setProperty('--pa-border', 'rgb(var(--color-border-default))');
  document.documentElement.style.setProperty('--pa-border-subtle', 'rgb(var(--color-border-subtle))');
  document.documentElement.style.setProperty('--pa-text', 'rgb(var(--color-primary))');
  document.documentElement.style.setProperty('--pa-text-secondary', 'rgb(var(--color-secondary))');
  document.documentElement.style.setProperty('--pa-text-dim', 'rgb(var(--color-dim))');
  document.documentElement.style.setProperty('--pa-accent', 'rgb(var(--color-accent))');
  document.documentElement.style.setProperty('--pa-accent-hover', 'rgb(var(--color-accent))');
  document.documentElement.style.setProperty('--pa-danger', 'rgb(var(--color-danger))');
  document.documentElement.style.setProperty('--pa-success', 'rgb(var(--color-success))');
  document.documentElement.style.setProperty('--pa-warning', 'rgb(var(--color-warning))');
}

function readSystemTheme(): ThemeAppearance {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia(SYSTEM_THEME_QUERY).matches ? 'dark' : 'light';
}

function resolveThemePreference(preference: ThemePreference, systemTheme: ThemeAppearance, lightTheme: Theme, darkTheme: Theme): Theme {
  const appearance = preference === 'system' ? systemTheme : preference;
  return appearance === 'dark' ? darkTheme : lightTheme;
}

function isColorThemeContribution(value: unknown): value is ColorTheme {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.label === 'string' &&
    (record.appearance === 'light' || record.appearance === 'dark') &&
    (record.tokens === undefined || (typeof record.tokens === 'object' && record.tokens !== null && !Array.isArray(record.tokens)))
  );
}

function readExtensionThemes(extensions: ExtensionManifest[]): ColorTheme[] {
  return extensions.flatMap((extension) =>
    (extension.contributes?.themes ?? []).filter(isColorThemeContribution).map((theme) => ({
      id: `${extension.id}/${theme.id}`,
      label: theme.label,
      appearance: theme.appearance,
      tokens: theme.tokens,
      extensionId: extension.id,
    })),
  );
}

function readStoredThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'system') return 'system';
    if (stored === 'light' || stored === 'studio-light') return 'light';
    if (stored === 'dark' || stored === 'studio-dark') return 'dark';
  } catch {
    // ignore
  }

  return DEFAULT_THEME_PREFERENCE;
}

function readStoredThemeId(storageKey: string, fallback: Theme): Theme {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored && stored.trim().length > 0) return normalizeThemeId(stored);
  } catch {
    // ignore
  }

  return fallback;
}

function readStoredAccent(): ThemeAccent {
  try {
    return normalizeAccent(localStorage.getItem(ACCENT_STORAGE_KEY));
  } catch {
    return DEFAULT_ACCENT;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() => {
    const currentPreference = readStoredThemePreference();
    const lightTheme = readStoredThemeId(LIGHT_THEME_STORAGE_KEY, DEFAULT_LIGHT_THEME);
    const darkTheme = readStoredThemeId(DARK_THEME_STORAGE_KEY, DEFAULT_DARK_THEME);
    applyTheme(
      findTheme(BUILT_IN_THEMES, resolveThemePreference(currentPreference, readSystemTheme(), lightTheme, darkTheme)),
      readStoredAccent(),
    );
    return currentPreference;
  });
  const [systemTheme, setSystemTheme] = useState<ThemeAppearance>(() => readSystemTheme());
  const [lightTheme, setLightThemeState] = useState<Theme>(() => readStoredThemeId(LIGHT_THEME_STORAGE_KEY, DEFAULT_LIGHT_THEME));
  const [darkTheme, setDarkThemeState] = useState<Theme>(() => readStoredThemeId(DARK_THEME_STORAGE_KEY, DEFAULT_DARK_THEME));
  const [accent, setAccentState] = useState<ThemeAccent>(() => readStoredAccent());
  const [extensionThemes, setExtensionThemes] = useState<ColorTheme[]>([]);
  const availableThemes = useMemo(() => [...BUILT_IN_THEMES, ...extensionThemes], [extensionThemes]);

  const theme = useMemo(() => {
    const resolvedTheme = resolveThemePreference(themePreference, systemTheme, lightTheme, darkTheme);
    return findTheme(availableThemes, resolvedTheme).id;
  }, [availableThemes, darkTheme, lightTheme, systemTheme, themePreference]);

  useEffect(() => {
    applyTheme(findTheme(availableThemes, theme), accent);
  }, [accent, availableThemes, theme]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;
    const load = () => {
      if (typeof api.extensions !== 'function') {
        setExtensionThemes([]);
        return;
      }
      void api
        .extensions()
        .then((extensions) => {
          if (!cancelled) setExtensionThemes(readExtensionThemes(extensions));
        })
        .catch(() => {
          if (!cancelled) setExtensionThemes([]);
        });
    };
    if (typeof api.extensions === 'function') {
      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        load();
      }, 6000);
    } else {
      setExtensionThemes([]);
    }
    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (themePreference !== 'system' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia(SYSTEM_THEME_QUERY);
    const updateSystemTheme = (matches: boolean) => {
      setSystemTheme(matches ? 'dark' : 'light');
    };
    const handleChange = (event: Event) => {
      updateSystemTheme((event as MediaQueryListEvent).matches);
    };
    const legacyHandleChange = (event: MediaQueryListEvent) => {
      updateSystemTheme(event.matches);
    };

    updateSystemTheme(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }

    mediaQuery.addListener(legacyHandleChange);
    return () => {
      mediaQuery.removeListener(legacyHandleChange);
    };
  }, [themePreference]);

  const setThemePreference = useCallback(
    (nextThemePreference: ThemePreference) => {
      const nextSystemTheme = nextThemePreference === 'system' ? readSystemTheme() : systemTheme;
      const nextTheme = findTheme(availableThemes, resolveThemePreference(nextThemePreference, nextSystemTheme, lightTheme, darkTheme));

      setThemePreferenceState(nextThemePreference);
      if (nextThemePreference === 'system') {
        setSystemTheme(nextSystemTheme);
      }
      applyTheme(nextTheme, accent);

      try {
        localStorage.setItem(THEME_STORAGE_KEY, nextThemePreference);
      } catch {
        // Ignore storage failures.
      }
    },
    [accent, availableThemes, darkTheme, lightTheme, systemTheme],
  );

  const setAccent = useCallback(
    (nextAccent: ThemeAccent) => {
      const normalizedAccent = normalizeAccent(nextAccent);
      setAccentState(normalizedAccent);
      applyAccent(normalizedAccent, findTheme(availableThemes, theme).appearance);
      try {
        localStorage.setItem(ACCENT_STORAGE_KEY, normalizedAccent);
      } catch {
        // Ignore storage failures.
      }
    },
    [availableThemes, theme],
  );

  const setLightTheme = useCallback((nextTheme: Theme) => {
    const normalizedTheme = normalizeThemeId(nextTheme);
    setLightThemeState(normalizedTheme);
    try {
      localStorage.setItem(LIGHT_THEME_STORAGE_KEY, normalizedTheme);
    } catch {
      // Ignore storage failures.
    }
  }, []);

  const setDarkTheme = useCallback((nextTheme: Theme) => {
    const normalizedTheme = normalizeThemeId(nextTheme);
    setDarkThemeState(normalizedTheme);
    try {
      localStorage.setItem(DARK_THEME_STORAGE_KEY, normalizedTheme);
    } catch {
      // Ignore storage failures.
    }
  }, []);

  const toggle = useCallback(() => {
    setThemePreference(findTheme(availableThemes, theme).appearance === 'light' ? 'dark' : 'light');
  }, [availableThemes, setThemePreference, theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      themePreference,
      lightTheme,
      darkTheme,
      availableThemes,
      setThemePreference,
      setLightTheme,
      setDarkTheme,
      accent,
      availableAccents: THEME_ACCENTS,
      setAccent,
      toggle,
    }),
    [
      accent,
      availableThemes,
      darkTheme,
      lightTheme,
      setAccent,
      setDarkTheme,
      setLightTheme,
      setThemePreference,
      theme,
      themePreference,
      toggle,
    ],
  );

  return createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (value) return value;

  const themePreference = readStoredThemePreference();
  const lightTheme = readStoredThemeId(LIGHT_THEME_STORAGE_KEY, DEFAULT_LIGHT_THEME);
  const darkTheme = readStoredThemeId(DARK_THEME_STORAGE_KEY, DEFAULT_DARK_THEME);
  const theme = findTheme(BUILT_IN_THEMES, resolveThemePreference(themePreference, readSystemTheme(), lightTheme, darkTheme)).id;
  return {
    theme,
    themePreference,
    lightTheme,
    darkTheme,
    availableThemes: BUILT_IN_THEMES,
    setThemePreference: (nextThemePreference) => {
      setStoredThemeValue(THEME_STORAGE_KEY, nextThemePreference);
      applyTheme(
        findTheme(BUILT_IN_THEMES, resolveThemePreference(nextThemePreference, readSystemTheme(), lightTheme, darkTheme)),
        readStoredAccent(),
      );
    },
    setLightTheme: (nextTheme) => setStoredThemeValue(LIGHT_THEME_STORAGE_KEY, normalizeThemeId(nextTheme)),
    setDarkTheme: (nextTheme) => setStoredThemeValue(DARK_THEME_STORAGE_KEY, normalizeThemeId(nextTheme)),
    accent: readStoredAccent(),
    availableAccents: THEME_ACCENTS,
    setAccent: (nextAccent) => {
      const normalizedAccent = normalizeAccent(nextAccent);
      setStoredThemeValue(ACCENT_STORAGE_KEY, normalizedAccent);
      applyAccent(normalizedAccent, findTheme(BUILT_IN_THEMES, theme).appearance);
    },
    toggle: () => {
      const currentTheme = findTheme(BUILT_IN_THEMES, theme);
      setStoredThemeValue(THEME_STORAGE_KEY, currentTheme.appearance === 'light' ? 'dark' : 'light');
    },
  };
}
