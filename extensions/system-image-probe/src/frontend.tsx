import { api, type ModelState, useApi } from '@neon-pilot/extensions/settings';
import { WindowedField, WindowedPageSection, WindowedSelect, WindowedStateBlock } from '@neon-pilot/extensions/ui';
import { useEffect, useMemo, useState } from 'react';

type ModelOption = ModelState['models'][number];

function formatModelLabel(model: ModelOption): string {
  return `${model.name} · ${model.provider}`;
}

export function MultimediaProbeSettings({ settingsContext: _settingsContext }: { settingsContext?: { extensionId?: string } }) {
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

  const meta = saving
    ? 'Saving'
    : selectedVisionModel
      ? selectedVisionModel
      : imageCapableModels.length === 0
        ? 'No image-capable models'
        : 'Not configured';

  return (
    <div id="settings-image-probe" className="image-probe-page-windowed flex min-h-0 flex-col gap-3">
      {loading && !modelState ? <WindowedStateBlock>Loading models.</WindowedStateBlock> : null}
      {error && !modelState ? (
        <WindowedStateBlock tone="danger" title="Failed to load models">
          {error}
        </WindowedStateBlock>
      ) : null}
      {modelState ? (
        <WindowedPageSection title="Vision model" meta={meta}>
          <WindowedField
            label="Fallback model"
            hint="Used when text-only chats ask about attached images, screenshots, or sampled video frames."
          >
            <WindowedSelect
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
            </WindowedSelect>
          </WindowedField>
        </WindowedPageSection>
      ) : null}
      {saveError ? <WindowedStateBlock tone="danger">{saveError}</WindowedStateBlock> : null}
    </div>
  );
}
