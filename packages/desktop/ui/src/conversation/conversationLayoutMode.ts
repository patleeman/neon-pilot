export function shouldSwitchToWorkbenchForSelectedRun(input: {
  selectedRunId: string | null;
  previousSelectedRunId: string | null;
  appLayoutMode: string;
}): boolean {
  return Boolean(input.selectedRunId && input.selectedRunId !== input.previousSelectedRunId && input.appLayoutMode !== 'workbench');
}
