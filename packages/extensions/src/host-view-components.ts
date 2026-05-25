export type HostViewComponentLocation = 'main' | 'rightRail' | 'workbench';

export interface HostViewComponentOverrideSlotDefinition {
  description: string;
  propsSchema: Record<string, unknown>;
}

export interface HostViewComponentDefinition {
  id: string;
  title: string;
  description: string;
  locations: HostViewComponentLocation[];
  propsSchema: Record<string, unknown>;
  overrideSlots: Record<string, HostViewComponentOverrideSlotDefinition>;
  examples: Array<Record<string, unknown>>;
}

export const HOST_VIEW_COMPONENT_DEFINITIONS: readonly HostViewComponentDefinition[] = [];

export type HostViewComponentId = (typeof HOST_VIEW_COMPONENT_DEFINITIONS)[number]['id'];

export const HOST_VIEW_COMPONENT_IDS = HOST_VIEW_COMPONENT_DEFINITIONS.map((definition) => definition.id) as HostViewComponentId[];

export function getHostViewComponentDefinition(id: string): HostViewComponentDefinition | undefined {
  return HOST_VIEW_COMPONENT_DEFINITIONS.find((definition) => definition.id === id);
}
