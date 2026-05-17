import type { ExtensionBackendContext } from '@personal-agent/extensions';

interface CaffeinateStatus {
  running: boolean;
  pid: number | null;
}

let processHandle: { pid: number | null; kill: () => void } | null = null;
let processPid: number | null = null;

function currentStatus(): CaffeinateStatus {
  return { running: Boolean(processHandle && processPid), pid: processPid };
}

export async function status(): Promise<CaffeinateStatus> {
  return currentStatus();
}

export async function start(_input: unknown, ctx: ExtensionBackendContext): Promise<CaffeinateStatus> {
  if (processHandle && processPid) return currentStatus();

  const child = await ctx.shell.spawn({
    command: 'caffeinate',
    args: ['-dimsu'],
    onExit: (event) => {
      ctx.log.info('caffeinate exited', { code: event.code ?? null, signal: event.signal ?? null });
      if (processHandle === child) {
        processHandle = null;
        processPid = null;
      }
    },
  });

  processHandle = child;
  processPid = child.pid ?? null;
  if (!processPid) throw new Error('Failed to start caffeinate: missing child pid');
  return currentStatus();
}

export async function stop(_input: unknown, ctx: ExtensionBackendContext): Promise<CaffeinateStatus> {
  const handle = processHandle;
  const pid = processPid;
  processHandle = null;
  processPid = null;
  if (handle && pid) {
    try {
      handle.kill();
    } catch (error) {
      ctx.log.warn('failed to stop caffeinate', { pid, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return currentStatus();
}

export async function toggle(input: unknown, ctx: ExtensionBackendContext): Promise<CaffeinateStatus> {
  return processHandle && processPid ? stop(input, ctx) : start(input, ctx);
}
