import type { NativeExtensionClient } from '@neon-pilot/extensions';
import {
  AppPageIntro,
  AppPageLayout,
  Checkbox,
  DataTable,
  DataTableActionGroup,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  LoadingState,
  Notice,
  Textarea,
  TextButton,
  TextInput,
  ToolbarButton,
} from '@neon-pilot/extensions/ui';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';

// ── types ─────────────────────────────────────────────────────────────────────

interface Item {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FormState {
  name: string;
  description: string;
  enabled: boolean;
}

const emptyForm: FormState = { name: '', description: '', enabled: true };

function formFromItem(item: Item): FormState {
  return { name: item.name, description: item.description, enabled: item.enabled };
}

function EditIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3.5 11.8 4 9.5 10.8 2.7a1.4 1.4 0 0 1 2 2L6 11.5l-2.5.3Z" />
      <path d="M9.6 4 12 6.4" />
      <path d="M3 13h10" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12.5 7.5a4.5 4.5 0 1 1-1.2-3.1" />
      <path d="M10 2.8h3v3" />
    </svg>
  );
}

// ── page component ────────────────────────────────────────────────────────────

export function CrudPage({ pa }: { pa: NativeExtensionClient }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  // ── data loading ──────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    const result = (await pa.extension.invoke('templateItemsList', {})) as { items: Item[] };
    setItems(result.items ?? []);
  }, [pa]);

  useEffect(() => {
    load()
      .catch((err: Error) => {
        setError(err.message);
        pa.ui.notify({ type: 'error', message: `Failed to load items: ${err.message}`, source: 'template-crud-page' });
      })
      .finally(() => setLoading(false));
  }, [load, pa]);

  const reload = useCallback(async () => {
    setBusy('reload');
    setError(null);
    try {
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setBusy(null);
    }
  }, [load]);

  // ── editor ────────────────────────────────────────────────────────────────

  const openEditor = useCallback((item?: Item) => {
    setEditingId(item?.id ?? null);
    setForm(item ? formFromItem(item) : { ...emptyForm });
    setEditorOpen(true);
    setNotice(null);
  }, []);

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }, []);

  const save = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setBusy('save');
      try {
        await pa.extension.invoke('templateItemsSave', {
          id: editingId ?? undefined,
          name: form.name.trim(),
          description: form.description.trim(),
          enabled: form.enabled,
        });
        setNotice(editingId ? 'Item updated.' : 'Item created.');
        closeEditor();
        await load();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        pa.ui.notify({ type: 'error', message: `Save failed: ${msg}`, source: 'template-crud-page' });
      } finally {
        setBusy(null);
      }
    },
    [closeEditor, editingId, form, load, pa],
  );

  const deleteItem = useCallback(
    async (item: Item) => {
      const confirmed = await pa.ui.confirm({
        title: 'Delete item',
        message: `Delete "${item.name}"? This cannot be undone.`,
      });
      if (!confirmed) return;

      setBusy(`delete:${item.id}`);
      try {
        await pa.extension.invoke('templateItemsDelete', { id: item.id });
        setNotice('Item deleted.');
        if (editingId === item.id) closeEditor();
        await load();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        pa.ui.notify({ type: 'error', message: `Delete failed: ${msg}`, source: 'template-crud-page' });
      } finally {
        setBusy(null);
      }
    },
    [closeEditor, editingId, load, pa],
  );

  // ── render states ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-full overflow-y-auto">
        <AppPageLayout shellClassName="max-w-[72rem]" contentClassName="space-y-6">
          <AppPageIntro title="My Items" />
          <LoadingState label="Loading items..." />
        </AppPageLayout>
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="h-full overflow-y-auto">
        <AppPageLayout shellClassName="max-w-[72rem]" contentClassName="space-y-6">
          <AppPageIntro title="My Items" />
          <ErrorState message={error} />
        </AppPageLayout>
      </div>
    );
  }

  // ── editor view ───────────────────────────────────────────────────────────

  if (editorOpen) {
    return (
      <div className="h-full overflow-y-auto">
        <AppPageLayout shellClassName="max-w-[72rem]" contentClassName="space-y-0">
          <form onSubmit={save}>
            <div className="pb-8">
              <TextButton type="button" onClick={closeEditor}>
                Items
              </TextButton>
              <AppPageIntro
                title={editingId ? 'Edit item' : 'New item'}
                actions={
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <ToolbarButton type="button" onClick={closeEditor}>
                      Cancel
                    </ToolbarButton>
                    <ToolbarButton type="submit" disabled={busy === 'save'}>
                      {busy === 'save' ? 'Saving...' : editingId ? 'Save changes' : 'Create'}
                    </ToolbarButton>
                  </div>
                }
              />
            </div>

            {/* Editor fields — replace with your domain fields */}
            <section className="grid gap-6 border-t border-border-subtle py-7 md:grid-cols-[13rem_minmax(0,1fr)]">
              <div className="space-y-2">
                <h3 className="text-[16px] font-semibold tracking-tight text-primary">General</h3>
                <p className="text-[13px] leading-6 text-secondary">Basic item details.</p>
              </div>
              <div className="grid gap-4">
                <Field label="Name">
                  <TextInput required autoComplete="off" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </Field>
                <Field label="Description" hint="Optional. One sentence about what this item does.">
                  <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </Field>
                <label className="flex items-center gap-2 text-[13px] text-secondary">
                  <Checkbox checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
                  Enabled
                </label>
              </div>
            </section>

            {/* Editor footer */}
            <div className="flex flex-wrap justify-between gap-2 border-t border-border-subtle pt-5">
              <div>
                {editingId ? (
                  <ToolbarButton
                    type="button"
                    disabled={busy === `delete:${editingId}`}
                    onClick={() => void deleteItem({ id: editingId, name: form.name } as Item)}
                  >
                    Delete
                  </ToolbarButton>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <ToolbarButton type="button" onClick={closeEditor}>
                  Cancel
                </ToolbarButton>
                <ToolbarButton type="submit" disabled={busy === 'save'}>
                  {busy === 'save' ? 'Saving...' : editingId ? 'Save changes' : 'Create item'}
                </ToolbarButton>
              </div>
            </div>
          </form>
        </AppPageLayout>
      </div>
    );
  }

  // ── list view ─────────────────────────────────────────────────────────────

  const countLabel = items.length === 1 ? '1 item' : `${items.length} items`;

  return (
    <div className="h-full overflow-y-auto">
      <AppPageLayout shellClassName="max-w-[72rem]" contentClassName="space-y-8">
        <AppPageIntro
          title="My Items"
          actions={
            <div className="flex items-center gap-2">
              <ToolbarButton onClick={() => openEditor()}>New item</ToolbarButton>
              <IconButton title="Reload" aria-label="Reload" disabled={busy === 'reload'} onClick={() => void reload()}>
                <RefreshIcon />
              </IconButton>
            </div>
          }
        />

        <p className="text-[13px] text-secondary">{countLabel}</p>

        {notice ? <Notice tone="success">{notice}</Notice> : null}

        {error ? <Notice tone="danger">{error}</Notice> : null}

        {items.length === 0 ? (
          <EmptyState
            eyebrow="Table page"
            title="No items yet"
            body="Items are the records this extension manages. Replace this copy with the feature's real job and the user's next decision."
            steps={['Create the first item', 'Fill in the required fields', 'Use row actions to edit or delete it later']}
            action={<ToolbarButton onClick={() => openEditor()}>New item</ToolbarButton>}
            className="py-10"
          />
        ) : (
          <DataTable
            columns={
              <colgroup>
                <col className="w-[45%]" />
                <col className="w-[40%]" />
                <col className="w-[15%]" />
              </colgroup>
            }
            tableClassName="min-w-[36rem] table-fixed"
          >
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell className="pr-4">Name</DataTableHeaderCell>
                <DataTableHeaderCell className="px-3">Description</DataTableHeaderCell>
                <DataTableHeaderCell className="pl-3 text-right">Actions</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {items.map((item) => (
                <DataTableRow key={item.id} className="group">
                  <DataTableCell className="min-w-0 pr-4">
                    <div className="truncate text-[14px] font-semibold text-primary">{item.name}</div>
                    <div className="mt-0.5 text-[11px] text-dim">
                      {item.enabled ? 'Enabled' : 'Disabled'} · {item.id}
                    </div>
                  </DataTableCell>
                  <DataTableCell className="min-w-0 px-3">
                    <span className="line-clamp-2 text-[13px] text-secondary">{item.description || '—'}</span>
                  </DataTableCell>
                  <DataTableCell className="pl-3">
                    <DataTableActionGroup>
                      <IconButton
                        compact
                        title={`Edit ${item.name}`}
                        aria-label={`Edit ${item.name}`}
                        disabled={!!busy}
                        onClick={() => openEditor(item)}
                      >
                        <EditIcon />
                      </IconButton>
                    </DataTableActionGroup>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </AppPageLayout>
    </div>
  );
}
