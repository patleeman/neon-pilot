import { api, type ModelState, useApi } from '@neon-pilot/extensions/settings';
import { Field, LoadingState, Notice, Select, SurfacePanel } from '@neon-pilot/extensions/ui';
import { useMemo, useState } from 'react';

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
      <SurfacePanel className="p-4 shadow-none">
        <div className="mb-3">
          <h3 className="text-[13px] font-semibold text-primary">Vision model</h3>
          <p className="ui-card-meta">Used by image probing when the active conversation model cannot inspect images directly.</p>
        </div>

        {loading && !modelState ? (
          <LoadingState label="Loading models..." />
        ) : error && !modelState ? (
          <Notice tone="danger" title="Failed to load models">
            {error}
          </Notice>
        ) : modelState ? (
          <>
            <Field
              label="Model"
              hint={
                saving
                  ? 'Saving vision model...'
                  : modelState.currentVisionModel
                    ? `Image probing uses ${modelState.currentVisionModel}.`
                    : 'Required before probing uploaded images with text-only models.'
              }
            >
              <Select
                id="settings-image-probe-vision-model"
                value={modelState.currentVisionModel ?? ''}
                onChange={(event) => {
                  void handleVisionModelChange(event.target.value);
                }}
                disabled={saving || imageCapableModels.length === 0}
              >
                <option value="">Not configured</option>
                {imageCapableModels.map((model) => (
                  <option key={`${model.provider}/${model.id}`} value={`${model.provider}/${model.id}`}>
                    {formatModelLabel(model)}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        ) : null}

        {saveError ? <Notice tone="danger">{saveError}</Notice> : null}
      </SurfacePanel>
    </section>
  );
}
