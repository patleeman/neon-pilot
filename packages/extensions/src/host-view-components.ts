export type HostViewComponentLocation = 'main' | 'sidebar' | 'rightRail' | 'workbench';

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

export const HOST_VIEW_COMPONENT_DEFINITIONS: readonly HostViewComponentDefinition[] = [
  {
    id: 'application.home',
    title: 'Application home',
    description: 'Renders the standard Neon Pilot application launcher and recent-work home page.',
    locations: ['main'],
    propsSchema: { type: 'object', properties: {}, additionalProperties: false },
    overrideSlots: {},
    examples: [{}],
  },
  {
    id: 'application.sidebar',
    title: 'Application sidebar',
    description: 'Renders the standard application navigation sidebar for a supplied qualified application id.',
    locations: ['sidebar'],
    propsSchema: {
      type: 'object',
      properties: {
        applicationId: { type: 'string', description: 'Qualified application id.' },
        showConversations: {
          type: 'boolean',
          description: 'Whether to show the standard conversation controls and thread list below application navigation.',
        },
      },
      required: ['applicationId'],
      additionalProperties: false,
    },
    overrideSlots: {},
    examples: [{ applicationId: 'system-agent:agent', showConversations: true }],
  },
  {
    id: 'conversation.page',
    title: 'Conversation page',
    description: 'Renders the standard Neon Pilot conversation transcript and composer for a supplied conversation id.',
    locations: ['main'],
    propsSchema: {
      type: 'object',
      properties: {
        conversationId: {
          type: 'string',
          description: 'Conversation id to render. Extensions may also pass this dynamically through hostProps.',
        },
      },
      additionalProperties: false,
    },
    overrideSlots: {
      wrapper: {
        description: 'Wraps the standard conversation page and may provide dynamic hostProps such as conversationId.',
        propsSchema: { type: 'object', additionalProperties: true },
      },
    },
    examples: [{ conversationId: 'conv_123' }],
  },
];

export type HostViewComponentId = (typeof HOST_VIEW_COMPONENT_DEFINITIONS)[number]['id'];

export const HOST_VIEW_COMPONENT_IDS = HOST_VIEW_COMPONENT_DEFINITIONS.map((definition) => definition.id) as HostViewComponentId[];

export function getHostViewComponentDefinition(id: string): HostViewComponentDefinition | undefined {
  return HOST_VIEW_COMPONENT_DEFINITIONS.find((definition) => definition.id === id);
}
