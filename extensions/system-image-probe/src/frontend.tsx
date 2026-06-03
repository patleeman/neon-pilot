import { api, type ModelState, useApi } from '@neon-pilot/extensions/settings';
import { useMemo, useState } from 'react';

const INPUT_CLASS =
  'w-full rounded-md border border-border-subtle bg-elevated px-3 py-2 text-[13px] text-primary shadow-none transition-colors focus:border-accent/50 focus:bg-surface focus:outline-none disabled:opacity-50';

type ModelOption = ModelState['models'][number];

function formatModelLabel(model: ModelOption): string {
  return `${model.name} · ${model.provider}`;
}

export function ImageProbeSettings() {
  const { data: modelState, loading, error } = useApi(api.models);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const imageCapableModels = useMemo(
    () => (modelState?.models ?? []).filter((model) => model.input?.includes('image')),
    [modelState?.models],
  );

  async function handleVisionModelChange(visionModel: string) {
    if (!modelState || saving || visionModel === (modelState.currentVisionModel ?? '')) {
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      await api.updateModelPreferences({ visionModel });
    } catch (nextError) {
      setSaveError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="settings-image-probe" className="space-y-3">
      <div className="rounded-lg border border-border-subtle bg-surface p-4">
        <div className="mb-3">
          <h3 className="text-[13px] font-semibold text-primary">Vision model</h3>
          <p className="ui-card-meta">Used by image probing when the active conversation model cannot inspect images directly.</p>
        </div>

        {loading && !modelState ? (
          <p className="ui-card-meta">Loading models...</p>
        ) : error && !modelState ? (
          <p className="text-[12px] text-danger">Failed to load models: {error}</p>
        ) : modelState ? (
          <>
            <label className="ui-card-meta" htmlFor="settings-image-probe-vision-model">
              Model
            </label>
            <select
              id="settings-image-probe-vision-model"
              value={modelState.currentVisionModel ?? ''}
              onChange={(event) => {
                void handleVisionModelChange(event.target.value);
              }}
              disabled={saving || imageCapableModels.length === 0}
              className={INPUT_CLASS}
            >
              <option value="">Not configured</option>
              {imageCapableModels.map((model) => (
                <option key={`${model.provider}/${model.id}`} value={`${model.provider}/${model.id}`}>
                  {formatModelLabel(model)}
                </option>
              ))}
            </select>
            <p className="ui-card-meta">
              {saving
                ? 'Saving vision model...'
                : modelState.currentVisionModel
                  ? `Image probing uses ${modelState.currentVisionModel}.`
                  : 'Required before probing uploaded images with text-only models.'}
            </p>
          </>
        ) : null}

        {saveError ? <p className="text-[12px] text-danger">{saveError}</p> : null}
      </div>
    </section>
  );
}
