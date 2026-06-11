import { setExtensionCommandContext } from '../../extensions/commands';

export const FILE_CHANGE_TOGGLE_FIRST_COMMAND_EVENT = 'neon-pilot:file-change-toggle-first';

export interface FileChangeCommandDetail {
  handled?: boolean;
}

const FILE_CHANGE_CAN_TOGGLE_FIRST_CONTEXT = 'fileChange.canToggleFirst';
let fileChangeToggleCapabilityCount = 0;

export function registerFileChangeToggleCapability(): () => void {
  fileChangeToggleCapabilityCount += 1;
  setExtensionCommandContext(FILE_CHANGE_CAN_TOGGLE_FIRST_CONTEXT, true);

  return () => {
    fileChangeToggleCapabilityCount = Math.max(0, fileChangeToggleCapabilityCount - 1);
    if (fileChangeToggleCapabilityCount === 0) {
      setExtensionCommandContext(FILE_CHANGE_CAN_TOGGLE_FIRST_CONTEXT, null);
    }
  };
}
