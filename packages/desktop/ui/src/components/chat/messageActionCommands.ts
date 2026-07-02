import { setExtensionCommandContext } from '../../extensions/commands';

type MessageActionCommand = 'copyFirst' | 'editFirst' | 'rewindFirst' | 'forkFirst';

export const MESSAGE_ACTION_COMMAND_EVENT = 'neon-pilot:message-action-command';

export interface MessageActionCommandDetail {
  command: MessageActionCommand;
  handled?: boolean;
}

type MessageActionCapability = 'copy' | 'edit' | 'rewind' | 'fork';

const messageActionContextKeys: Record<MessageActionCapability, string> = {
  copy: 'messageAction.canCopyFirst',
  edit: 'messageAction.canEditFirst',
  rewind: 'messageAction.canRewindFirst',
  fork: 'messageAction.canForkFirst',
};

const messageActionCapabilityCounts = new Map<MessageActionCapability, number>();

export function registerMessageActionCapability(capability: MessageActionCapability): () => void {
  const nextCount = (messageActionCapabilityCounts.get(capability) ?? 0) + 1;
  messageActionCapabilityCounts.set(capability, nextCount);
  setExtensionCommandContext(messageActionContextKeys[capability], true);

  return () => {
    const currentCount = messageActionCapabilityCounts.get(capability) ?? 0;
    const remainingCount = Math.max(0, currentCount - 1);
    if (remainingCount === 0) {
      messageActionCapabilityCounts.delete(capability);
      setExtensionCommandContext(messageActionContextKeys[capability], null);
      return;
    }

    messageActionCapabilityCounts.set(capability, remainingCount);
  };
}
