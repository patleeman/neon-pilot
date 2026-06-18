export type HostComponent = (...args: never[]) => unknown;

export declare const ConversationCheckpointWorkbenchPane: HostComponent;
export declare const ConversationDiffRailContent: HostComponent;
export declare function getConversationCheckpointIdFromSearch(search: string): string | null;
export declare function readCheckpointPresentation(...args: never[]): unknown;
export declare function setConversationCheckpointIdInSearch(search: string, checkpointId: string | null): string;
export declare function useConversationCheckpointSummaries(...args: never[]): unknown;
