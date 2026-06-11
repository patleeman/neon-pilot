import { api, type ModelState, useApi } from '@neon-pilot/extensions/settings';
import { Field, LoadingState, Notice, Select } from '@neon-pilot/extensions/ui';
import { useEffect, useMemo, useState } from 'react';

type ModelOption = ModelState['models'][number];

function formatModelLabel(model: ModelOption): string {
  return `${model.name} · ${model.provider}`;
}

export function ImageProbeSettings() {
  const { data: modelState, loading, error } = useApi(api.models);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedVisionModel, setSelectedVisionModel] = useState('');
  const imageCapableModels = useMemo(
    () => (modelState?.models ?? []).filter((model) => model.input?.includes('image')),
    [modelState?.models],
  );

  useEffect(() => {
    setSelectedVisionModel(modelState?.currentVisionModel ?? '');
  }, [modelState?.currentVisionModel]);

  async function handleVisionModelChange(visionModel: string) {
    if (!modelState || saving) {
      return;
    }
    const previousVisionModel = modelState.currentVisionModel ?? '';
    if (visionModel === previousVisionModel) {
      setSelectedVisionModel(visionModel);
      return;
    }

    setSelectedVisionModel(visionModel);
    setSaving(true);
    setSaveError(null);

    try {
      await api.updateModelPreferences({ visionModel });
    } catch (nextError) {
      setSelectedVisionModel(previousVisionModel);
      setSaveError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="settings-image-probe" className="scroll-mt-24 space-y-3">
      {loading && !modelState ? (
        <LoadingState label="Loading models…" />
      ) : error && !modelState ? (
        <Notice tone="danger" title="Failed to load models">
          {error}
        </Notice>
      ) : modelState ? (
        <Field
          label="Vision model"
          hint={
            saving
              ? 'Saving vision model…'
              : selectedVisionModel
                ? `Image probing uses ${selectedVisionModel}.`
                : 'Required before probing uploaded images with text-only models.'
          }
        >
          <Select
            id="settings-image-probe-vision-model"
            value={selectedVisionModel}
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
      ) : null}

      {saveError ? <Notice tone="danger">{saveError}</Notice> : null}
    </section>
  );
}
