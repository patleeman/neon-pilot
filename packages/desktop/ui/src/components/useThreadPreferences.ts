import { useCallback, useState } from 'react';

import {
  readThreadsFilterMode,
  readThreadsOrganizeMode,
  readThreadsSortMode,
  writeThreadsFilterMode,
  writeThreadsOrganizeMode,
  writeThreadsSortMode,
} from './sidebarPreferences';
import type { ThreadsFilterMode, ThreadsOrganizeMode, ThreadsSortMode } from './sidebarThreadModel';

export function useThreadPreferences() {
  const [organizeMode, setOrganizeMode] = useState<ThreadsOrganizeMode>(() => readThreadsOrganizeMode());
  const [filterMode, setFilterMode] = useState<ThreadsFilterMode>(() => readThreadsFilterMode());
  const [sortMode, setSortMode] = useState<ThreadsSortMode>(() => readThreadsSortMode());

  const updateOrganizeMode = useCallback((value: ThreadsOrganizeMode) => {
    setOrganizeMode(value);
    writeThreadsOrganizeMode(value);
  }, []);

  const updateFilterMode = useCallback((value: ThreadsFilterMode) => {
    setFilterMode(value);
    writeThreadsFilterMode(value);
  }, []);

  const updateSortMode = useCallback((value: ThreadsSortMode) => {
    setSortMode(value);
    writeThreadsSortMode(value);
  }, []);

  return {
    filterMode,
    organizeMode,
    sortMode,
    updateFilterMode,
    updateOrganizeMode,
    updateSortMode,
  };
}
