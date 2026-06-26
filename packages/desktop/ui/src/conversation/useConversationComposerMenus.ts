import { type KeyboardEvent, useCallback, useEffect, useMemo, useState } from 'react';

import type { SlashMenuItem } from '../commands/slashMenu';
import { filterModelPickerItems } from '../model/modelPicker';
import { getModelSelectionValue } from '../model/modelPreferences';
import type { ModelInfo } from '../shared/types';
import { resolveConversationComposerMenuState } from './conversationComposerMenuState';
import { filterMentionItems, MAX_MENTION_MENU_ITEMS, type MentionItem } from './conversationMentions';

export interface ConversationComposerMenuSelectionHandlers {
  onSlashCommandCommit?: (commandInput: string) => Promise<boolean> | boolean;
  onSlashMenuSelect: (item: SlashMenuItem, input: string) => Promise<void> | void;
  onMentionSelect: (id: string, input: string) => Promise<void> | void;
  onModelSelect: (modelId: string) => Promise<void> | void;
  onClearComposer: () => void;
}

export interface UseConversationComposerMenusOptions extends ConversationComposerMenuSelectionHandlers {
  input: string;
  slashItems: SlashMenuItem[];
  mentionItems: MentionItem[];
  models: ModelInfo[];
}

export interface UseConversationComposerMenusState {
  showModelPicker: boolean;
  showSlash: boolean;
  showMention: boolean;
  slashQuery: string;
  modelQuery: string;
  mentionQuery: string;
  slashIdx: number;
  mentionIdx: number;
  modelIdx: number;
  filteredMentionItems: MentionItem[];
  setModelIdx: (updater: number | ((prev: number) => number)) => void;
  setSlashIdx: (updater: number | ((prev: number) => number)) => void;
  setMentionIdx: (updater: number | ((prev: number) => number)) => void;
  handleMenuKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => Promise<boolean>;
  resetMenus: () => void;
  modelItems: ModelInfo[];
}

export function useConversationComposerMenus({
  input,
  slashItems,
  mentionItems,
  models,
  onSlashCommandCommit,
  onSlashMenuSelect,
  onMentionSelect,
  onModelSelect,
  onClearComposer,
}: UseConversationComposerMenusOptions): UseConversationComposerMenusState {
  const { showModelPicker, showSlash, showMention, slashQuery, modelQuery, mentionQuery } = resolveConversationComposerMenuState(input);
  const [slashIdx, setSlashIdx] = useState(0);
  const [mentionIdx, setMentionIdx] = useState(0);
  const [modelIdx, setModelIdx] = useState(0);
  const modelItems = useMemo(() => filterModelPickerItems(models, modelQuery), [models, modelQuery]);

  const filteredMentionItems = useMemo(
    () => filterMentionItems(mentionItems, mentionQuery, { limit: MAX_MENTION_MENU_ITEMS }),
    [mentionItems, mentionQuery],
  );

  const resetMenus = () => {
    setSlashIdx(0);
    setMentionIdx(0);
  };

  const handleMenuKeyDown = useCallback(
    async (event: KeyboardEvent<HTMLTextAreaElement>): Promise<boolean> => {
      if (showModelPicker) {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClearComposer();
          return true;
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setModelIdx((current) => (current + 1) % Math.max(modelItems.length, 1));
          return true;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setModelIdx((current) => (current - 1 + Math.max(modelItems.length, 1)) % Math.max(modelItems.length, 1));
          return true;
        }
        if (event.key === 'Enter' && !event.shiftKey) {
          if (!modelItems.length) {
            return true;
          }
          event.preventDefault();
          const selected = modelItems[modelIdx % modelItems.length];
          if (selected) {
            await onModelSelect(getModelSelectionValue(selected, models));
          }
          return true;
        }
      }

      if (showSlash || showMention) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          if (showSlash) {
            setSlashIdx((current) => current + 1);
          } else {
            setMentionIdx((current) => current + 1);
          }
          return true;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          if (showSlash) {
            setSlashIdx((current) => Math.max(0, current - 1));
          } else {
            setMentionIdx((current) => Math.max(0, current - 1));
          }
          return true;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          onClearComposer();
          return true;
        }
        if (event.key === 'Tab' || (event.key === 'Enter' && !event.shiftKey)) {
          event.preventDefault();
          const shouldCommitSlashCommand =
            showSlash && event.key === 'Enter' && onSlashCommandCommit ? await onSlashCommandCommit(input.trim()) : false;
          if (shouldCommitSlashCommand) {
            return true;
          }

          if (showSlash) {
            const nextIndex = slashIdx % (slashItems.length || 1);
            const selection = slashItems[nextIndex];
            if (selection) {
              await onSlashMenuSelect(selection, input);
            }
            return true;
          }

          const nextIndex = mentionIdx % (filteredMentionItems.length || 1);
          const selection = filteredMentionItems[nextIndex];
          if (selection) {
            await onMentionSelect(selection.id, input);
          }
          return true;
        }
      }

      return false;
    },
    [
      filteredMentionItems,
      input,
      modelIdx,
      modelItems,
      mentionIdx,
      onClearComposer,
      onMentionSelect,
      onModelSelect,
      onSlashCommandCommit,
      onSlashMenuSelect,
      showMention,
      showModelPicker,
      showSlash,
      slashIdx,
      slashItems,
    ],
  );

  useEffect(() => {
    setSlashIdx(0);
  }, [slashQuery]);

  useEffect(() => {
    setModelIdx(0);
  }, [modelQuery]);

  useEffect(() => {
    if (!showMention) {
      return;
    }
    setMentionIdx(0);
  }, [showMention, mentionQuery]);

  return {
    showModelPicker,
    showSlash,
    showMention,
    slashQuery,
    modelQuery,
    mentionQuery,
    slashIdx,
    mentionIdx,
    modelIdx,
    filteredMentionItems,
    modelItems,
    setModelIdx,
    setSlashIdx,
    setMentionIdx,
    handleMenuKeyDown,
    resetMenus,
  };
}
