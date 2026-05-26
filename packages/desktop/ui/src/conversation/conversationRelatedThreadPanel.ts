import type { ConversationSummaryRecord } from '../shared/types';
import {
  listRecentConversationResults,
  rankRelatedConversationSessions,
  type RelatedConversationSearchResult,
} from './relatedConversationSearch';
export { selectDraftRelatedThreadCandidates } from './relatedConversationCandidates';
import { buildRelatedThreadCandidateLookup, selectVisibleRelatedThreadResults } from './relatedThreadSelection';

export function resolveRelatedThreadResults(input: {
  selectedRelatedThreadIds: string[];
  query: string;
  candidates: RelatedConversationSearchResult[];
  searchIndex: Map<string, string>;
  summaries: Map<string, ConversationSummaryRecord>;
  workspaceCwd: string | null;
  limit: number;
}): RelatedConversationSearchResult[] {
  const lookup = buildRelatedThreadCandidateLookup(input.candidates);
  const searchResults = rankRelatedConversationSessions({
    sessions: input.candidates,
    searchIndex: input.searchIndex,
    summaries: input.summaries,
    query: input.query,
    workspaceCwd: input.workspaceCwd,
    limit: input.limit,
  });
  const recentResults = listRecentConversationResults(input.candidates, {
    workspaceCwd: input.workspaceCwd,
    summaries: input.summaries,
    recentWindowDays: null,
    limit: input.limit,
  });
  return selectVisibleRelatedThreadResults({
    selectedRelatedThreadIds: input.selectedRelatedThreadIds,
    query: input.query,
    searchResults,
    recentResults,
    candidateById: lookup.candidateById,
    searchIndex: input.searchIndex,
    summaries: input.summaries,
    workspaceCwd: input.workspaceCwd,
    limit: input.limit,
  });
}
