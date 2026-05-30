import { useCallback, useEffect, useState } from 'react';

import { api } from '../client/api';
import type { ModelInfo } from '../shared/types';
import { useInvalidateOnTopics } from '../hooks/useInvalidateOnTopics';

export function useConversationModels(enabled: boolean) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [defaultModel, setDefaultModel] = useState<string>('');
  const [defaultVisionModel, setDefaultVisionModel] = useState<string>('');
  const [defaultThinkingLevel, setDefaultThinkingLevel] = useState<string>('');
  const [defaultServiceTier, setDefaultServiceTier] = useState<string>('');

  const refreshModels = useCallback(() => {
    if (!enabled) {
      return Promise.resolve();
    }

    return api
      .models()
      .then((data) => {
        setModels(data.models);
        setDefaultModel(data.currentModel);
        setDefaultVisionModel(data.currentVisionModel ?? '');
        setDefaultThinkingLevel(data.currentThinkingLevel ?? '');
        setDefaultServiceTier(data.currentServiceTier ?? '');
      })
      .catch(() => {});
  }, [enabled]);

  useInvalidateOnTopics(['models'], () => refreshModels());

  useEffect(() => {
    void refreshModels();
  }, [enabled, refreshModels]);

  return {
    models,
    defaultModel,
    defaultVisionModel,
    defaultThinkingLevel,
    defaultServiceTier,
  };
}
