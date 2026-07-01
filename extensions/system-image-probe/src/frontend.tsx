import { api, type ModelState, useApi } from '@neon-pilot/extensions/settings';
import { LoadingState, Notice, Select, SettingsRow } from '@neon-pilot/extensions/ui';
import { useEffect, useMemo, useState } from 'react';

type ModelOption = ModelState['models'][number];

function formatModelLabel(model: ModelOption): string {
  return `${model.name} · ${model.provider}`;
}

export function MultimediaProbeSettings() {
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
    <div id="settings-image-probe" className="space-y-0">
      {loading && !modelState ? (
        <LoadingState label="Loading models…" />
      ) : error && !modelState ? (
        <Notice tone="danger" title="Failed to load models">
          {error}
        </Notice>
      ) : modelState ? (
        <SettingsRow
          title="Vision model"
          description={
            saving
              ? 'Saving vision model…'
              : selectedVisionModel
                ? `Media questions use ${selectedVisionModel}.`
                : 'Choose a vision model before asking about uploaded images or video frames from text-only chats.'
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
        </SettingsRow>
      ) : null}

      {saveError ? <Notice tone="danger">{saveError}</Notice> : null}
    </div>
  );
}
