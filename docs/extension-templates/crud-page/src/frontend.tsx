import type { NativeExtensionClient } from '@neon-pilot/extensions';
import { AppPageIntro, AppPageLayout, EmptyState, ErrorState, IconButton, LoadingState, ToolbarButton } from '@neon-pilot/extensions/ui';
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

// ── helpers ───────────────────────────────────────────────────────────────────

function fieldClass() {
  return 'w-full rounded-lg border border-border-subtle bg-surface/70 px-3 py-2 text-[13px] text-primary shadow-none outline-none transition-colors placeholder:text-dim focus:border-accent/50 focus:bg-surface';
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-[12px] text-secondary">
      <span className="font-medium text-primary">{label}</span>
      {children}
      {hint ? <span className="text-[11px] leading-5 text-dim">{hint}</span> : null}
    </label>
  );
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
    const result = (await pa.actions.call('myItemsList', {})) as { items: Item[] };
    setItems(result.items ?? []);
  }, [pa]);

  useEffect(() => {
    load()
      .catch((err: Error) => {
        setError(err.message);
        pa.ui.notify({ type: 'error', message: `Failed to load items: ${err.message}`, source: 'my-crud-page' });
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
    async (event: React.FormEvent) => {
      event.preventDefault();
      setBusy('save');
      try {
        await pa.actions.call('myItemsSave', {
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
        pa.ui.notify({ type: 'error', message: `Save failed: ${msg}`, source: 'my-crud-page' });
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
        await pa.actions.call('myItemsDelete', { id: item.id });
        setNotice('Item deleted.');
        if (editingId === item.id) closeEditor();
        await load();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        pa.ui.notify({ type: 'error', message: `Delete failed: ${msg}`, source: 'my-crud-page' });
      } finally {
        setBusy(null);
      }
    },
    [closeEditor, editingId, load, pa],
  );

  // ── render states ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <LoadingState label="Loading items…" />
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <ErrorState message={error} />
      </div>
    );
  }

  // ── editor view ───────────────────────────────────────────────────────────

  if (editorOpen) {
    return (
      <div className="h-full overflow-y-auto">
        <AppPageLayout shellClassName="max-w-[72rem]" contentClassName="space-y-0">
          <form onSubmit={save}>
            {/* Editor header */}
            <div className="flex items-start justify-between gap-4 pb-10">
              <div className="min-w-0">
                <button type="button" className="text-[13px] text-secondary hover:text-primary" onClick={closeEditor}>
                  ← Items
                </button>
                <h2 className="mt-6 text-[32px] font-semibold tracking-tight text-primary">{editingId ? 'Edit item' : 'New item'}</h2>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <ToolbarButton type="button" onClick={closeEditor}>
                  Cancel
                </ToolbarButton>
                <ToolbarButton type="submit" disabled={busy === 'save'}>
                  {busy === 'save' ? 'Saving…' : editingId ? 'Save changes' : 'Create'}
                </ToolbarButton>
              </div>
            </div>

            {/* Editor fields — replace with your domain fields */}
            <section className="grid gap-6 border-t border-border-subtle py-7 md:grid-cols-[13rem_minmax(0,1fr)]">
              <div className="space-y-2">
                <h3 className="text-[16px] font-semibold tracking-tight text-primary">General</h3>
                <p className="text-[13px] leading-6 text-secondary">Basic item details.</p>
              </div>
              <div className="grid gap-4">
                <Field label="Name">
                  <input
                    className={fieldClass()}
                    required
                    autoComplete="off"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </Field>
                <Field label="Description" hint="Optional. One sentence about what this item does.">
                  <textarea
                    className={fieldClass()}
                    rows={4}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </Field>
                <label className="flex items-center gap-2 text-[13px] text-secondary">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border-default bg-base text-accent focus:outline-none"
                    checked={form.enabled}
                    onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                  />
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
                  {busy === 'save' ? 'Saving…' : editingId ? 'Save changes' : 'Create item'}
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
          summary={`Manage your items. ${countLabel}`}
          actions={
            <div className="flex items-center gap-2">
              <ToolbarButton onClick={() => openEditor()}>New item</ToolbarButton>
              <IconButton title="Reload" aria-label="Reload" disabled={busy === 'reload'} onClick={() => void reload()}>
                <RefreshIcon />
              </IconButton>
            </div>
          }
        />

        {notice ? <div className="rounded-lg bg-surface/35 px-3 py-2 text-[13px] text-secondary">{notice}</div> : null}

        {error ? <div className="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger">{error}</div> : null}

        {items.length === 0 ? (
          <EmptyState title="No items yet" body="Create one to get started." className="py-10" />
        ) : (
          <section className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[36rem] table-fixed border-collapse text-left text-[13px]">
              <colgroup>
                <col className="w-[45%]" />
                <col className="w-[40%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-base/95 backdrop-blur">
                <tr className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dim">
                  <th className="py-2 pr-4 font-semibold">Name</th>
                  <th className="py-2 px-3 font-semibold">Description</th>
                  <th className="py-2 pl-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="group border-t border-border-subtle/70 transition-colors hover:bg-surface/30">
                    <td className="min-w-0 py-3 pr-4 align-middle">
                      <div className="truncate text-[14px] font-semibold text-primary">{item.name}</div>
                      <div className="mt-0.5 text-[11px] text-dim">
                        {item.enabled ? 'Enabled' : 'Disabled'} · {item.id}
                      </div>
                    </td>
                    <td className="min-w-0 px-3 py-3 align-middle">
                      <span className="line-clamp-2 text-[13px] text-secondary">{item.description || '—'}</span>
                    </td>
                    <td className="py-3 pl-3 align-middle">
                      <div className="flex items-center justify-end gap-1.5">
                        <IconButton
                          compact
                          title={`Edit ${item.name}`}
                          aria-label={`Edit ${item.name}`}
                          disabled={!!busy}
                          onClick={() => openEditor(item)}
                        >
                          <EditIcon />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </AppPageLayout>
    </div>
  );
}
