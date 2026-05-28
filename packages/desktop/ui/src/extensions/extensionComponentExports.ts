import { type ComponentType, lazy, type LazyExoticComponent } from 'react';

export function isExtensionComponentExport<TProps = Record<string, never>>(value: unknown): value is ComponentType<TProps> {
  return typeof value === 'function' || (typeof value === 'object' && value !== null && '$$typeof' in value);
}

type LoadExtensionModule = (revision: number) => Promise<Record<string, unknown>>;

const extensionComponentCache = new Map<string, LazyExoticComponent<ComponentType<unknown>>>();

export function extensionComponentCacheKey(input: {
  extensionId: string;
  frontendEntry?: string | null;
  component: string;
  revision: number;
  surface: string;
}): string {
  return `${input.surface}:${input.extensionId}:${input.frontendEntry ?? ''}:${input.component}:${input.revision}`;
}

export function getCachedExtensionComponent<TProps>({
  cacheKey,
  component,
  loadModule,
  revision,
}: {
  cacheKey: string;
  component: string;
  loadModule: LoadExtensionModule;
  revision: number;
}): LazyExoticComponent<ComponentType<TProps>> {
  const cached = extensionComponentCache.get(cacheKey);
  if (cached) {
    return cached as LazyExoticComponent<ComponentType<TProps>>;
  }

  const LazyComponent = lazy(async () => {
    const module = await loadModule(revision);
    const exportValue = module[component];
    if (!isExtensionComponentExport<TProps>(exportValue)) {
      return { default: () => null };
    }
    return { default: exportValue };
  });
  extensionComponentCache.set(cacheKey, LazyComponent as LazyExoticComponent<ComponentType<unknown>>);
  return LazyComponent;
}

export function clearExtensionComponentCacheForTests(): void {
  extensionComponentCache.clear();
}
