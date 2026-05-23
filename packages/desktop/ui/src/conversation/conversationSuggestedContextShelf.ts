export function buildSuggestedContextShelfState<TResult>(input: {
  query: string;
  results: TResult[];
  selectedSessionIds: string[];
  autoSelectedSessionIds: string[];
  loading: boolean;
  busy: boolean;
  error: string | null;
  maxSelections: number;
  hotkeyLimit: number;
  onToggle: (id: string) => void;
}): {
  query: string;
  results: TResult[];
  selectedSessionIds: string[];
  autoSelectedSessionIds: string[];
  loading: boolean;
  busy: boolean;
  error: string | null;
  maxSelections: number;
  hotkeyLimit: number;
  onToggle: (id: string) => void;
} {
  return input;
}
