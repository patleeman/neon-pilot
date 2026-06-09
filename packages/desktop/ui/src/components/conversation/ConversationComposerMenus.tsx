import { useEffect, useLayoutEffect, useRef } from 'react';

import type { SlashMenuItem } from '../../commands/slashMenu';
import { filterMentionItems, MAX_MENTION_MENU_ITEMS, type MentionItem } from '../../conversation/conversationMentions';
import { getModelSelectionValue, groupModelsByProvider } from '../../model/modelPreferences';
import type { ModelInfo } from '../../shared/types';
import { cx, IconButton, MenuGroupLabel, MetaLabel, Pill, RowButton, SectionLabel } from '../ui';

const useMenuLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function ModelPicker({
  models,
  allModels = models,
  currentModel,
  query,
  idx,
  onSelect,
  onClose,
}: {
  models: ModelInfo[];
  allModels?: ModelInfo[];
  currentModel: string;
  query: string;
  idx: number;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const groups = groupModelsByProvider(models);
  const selectedModel = models.length > 0 ? models[((idx % models.length) + models.length) % models.length] : null;
  const formatContext = (context: number) => (context >= 1_000_000 ? `${context / 1_000_000}M` : `${context / 1_000}k`);
  const selectedModelValue = selectedModel ? getModelSelectionValue(selectedModel, allModels) : '';

  return (
    <div className="ui-menu-shell">
      <div className="ui-menu-header">
        <SectionLabel>Switch model</SectionLabel>
        <IconButton onClick={onClose} title="Close model picker" aria-label="Close model picker" compact>
          <span className="text-[11px] font-mono">esc</span>
        </IconButton>
      </div>
      {models.length === 0 ? (
        <div className="px-3 py-4 text-[12px] text-dim">
          No models match <span className="font-mono text-secondary">{query}</span>
        </div>
      ) : (
        groups.map(([provider, providerModels]) => (
          <div key={provider}>
            <MenuGroupLabel className="px-3 pt-2 pb-0.5">{provider}</MenuGroupLabel>
            {providerModels.map((model) => {
              const modelValue = getModelSelectionValue(model, allModels);
              const isCurrent = modelValue === currentModel;
              const isFocused = modelValue === selectedModelValue;
              return (
                <RowButton
                  key={modelValue}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onSelect(modelValue);
                  }}
                  selected={isFocused}
                  className={cx('flex w-full items-center gap-3 px-3 py-2.5', !isFocused && 'text-secondary')}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isCurrent ? 'bg-accent' : 'bg-transparent border border-border-default'
                    }`}
                  />
                  <span className="flex-1 text-[13px] font-medium truncate">{model.name}</span>
                  <Pill tone={isCurrent ? 'accent' : 'muted'} mono>
                    {modelValue}
                  </Pill>
                  <span className="text-[10px] text-dim/60 shrink-0">{formatContext(model.context)}</span>
                </RowButton>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}

export function SlashMenu({ items, idx, onSelect }: { items: SlashMenuItem[]; idx: number; onSelect: (item: SlashMenuItem) => void }) {
  if (!items.length) return null;

  const selectedIndex = idx % items.length;
  const selectedItemRef = useRef<HTMLButtonElement | null>(null);

  useMenuLayoutEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  return (
    <div className="ui-menu-shell max-h-[28rem] overflow-y-auto py-1.5">
      {items.map((item, itemIndex) => (
        <RowButton
          key={item.key}
          ref={itemIndex === selectedIndex ? selectedItemRef : undefined}
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect(item);
          }}
          selected={itemIndex === selectedIndex}
          className={cx('flex w-full items-start gap-3 px-3 py-2.5', itemIndex !== selectedIndex && 'text-secondary')}
        >
          <span className="w-5 pt-0.5 text-center text-[13px] select-none text-dim/70">{item.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 max-w-[26rem] truncate whitespace-nowrap font-mono text-[12px] text-accent">{item.displayCmd}</span>
              {item.source && <MetaLabel tone="muted">{item.source}</MetaLabel>}
            </div>
            <p className="mt-0.5 truncate text-[12px] text-dim/90">{item.desc}</p>
          </div>
        </RowButton>
      ))}
    </div>
  );
}

export function MentionMenu({
  items,
  query,
  idx,
  onSelect,
}: {
  items: MentionItem[];
  query: string;
  idx: number;
  onSelect: (id: string) => void;
}) {
  const filtered = filterMentionItems(items, query, { limit: MAX_MENTION_MENU_ITEMS });
  if (!filtered.length) return null;

  const selectedIndex = idx % filtered.length;
  const selectedItemRef = useRef<HTMLButtonElement | null>(null);

  useMenuLayoutEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  return (
    <div className="ui-menu-shell max-h-[18rem] overflow-y-auto py-1.5">
      <div className="px-3 pt-2 pb-1">
        <SectionLabel>Mention</SectionLabel>
      </div>
      {filtered.map((item, index) => (
        <RowButton
          key={`${item.kind}:${item.id}`}
          ref={index === selectedIndex ? selectedItemRef : undefined}
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect(item.id);
          }}
          selected={index === selectedIndex}
          className={cx('flex w-full items-start gap-3 px-3 py-2.5', index !== selectedIndex && 'text-secondary')}
        >
          <Pill tone="muted">{item.kind}</Pill>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[13px] text-accent truncate">{item.id}</p>
            {(item.summary || (item.title && item.title !== item.label)) && (
              <p className="mt-0.5 truncate text-[12px] text-dim/90">{item.summary || item.title}</p>
            )}
          </div>
        </RowButton>
      ))}
    </div>
  );
}
