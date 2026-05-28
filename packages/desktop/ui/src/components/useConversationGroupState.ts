import { useCallback, useMemo, useState } from 'react';

import {
  readCollapsedConversationGroupKeys,
  readConversationGroupLabelOverrides,
  writeCollapsedConversationGroupKeys,
  writeConversationGroupLabelOverrides,
} from './sidebarPreferences';

export function useConversationGroupState() {
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState(() => readCollapsedConversationGroupKeys());
  const [labelOverrides, setLabelOverrides] = useState(() => readConversationGroupLabelOverrides());
  const collapsedGroupKeySet = useMemo(() => new Set(collapsedGroupKeys), [collapsedGroupKeys]);

  const toggleGroupCollapsed = useCallback((groupKey: string) => {
    const normalizedGroupKey = groupKey.trim();
    if (!normalizedGroupKey) {
      return;
    }

    setCollapsedGroupKeys((current) => {
      const next = current.includes(normalizedGroupKey)
        ? current.filter((key) => key !== normalizedGroupKey)
        : [...current, normalizedGroupKey];
      writeCollapsedConversationGroupKeys(next);
      return next;
    });
  }, []);

  const clearGroupCollapsedState = useCallback((groupKey: string) => {
    const normalizedGroupKey = groupKey.trim();
    if (!normalizedGroupKey) {
      return;
    }

    setCollapsedGroupKeys((current) => {
      if (!current.includes(normalizedGroupKey)) {
        return current;
      }

      const next = current.filter((key) => key !== normalizedGroupKey);
      writeCollapsedConversationGroupKeys(next);
      return next;
    });
  }, []);

  const updateGroupLabelOverride = useCallback((groupKey: string, nextLabel: string | null) => {
    const normalizedGroupKey = groupKey.trim();
    if (!normalizedGroupKey) {
      return;
    }

    setLabelOverrides((current) => {
      const next = { ...current };
      const normalizedLabel = nextLabel?.trim() ?? '';
      if (normalizedLabel) {
        next[normalizedGroupKey] = normalizedLabel;
      } else {
        delete next[normalizedGroupKey];
      }
      writeConversationGroupLabelOverrides(next);
      return next;
    });
  }, []);

  return {
    collapsedGroupKeys,
    collapsedGroupKeySet,
    clearGroupCollapsedState,
    labelOverrides,
    toggleGroupCollapsed,
    updateGroupLabelOverride,
  };
}
