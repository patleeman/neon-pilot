import { useState } from 'react';

import { api } from '../client/api';
import { RuntimeFooter, Spinner, TerminalBlock } from './ui';

export function ScheduledTaskLogSection({ taskId }: { taskId: string }) {
  const [log, setLog] = useState<string | null>(null);
  const [logPath, setLogPath] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  function loadLog() {
    if (log !== null) {
      setOpen((current) => !current);
      return;
    }

    setLoading(true);
    api
      .taskLog(taskId)
      .then((data) => {
        setLog(data.log);
        setLogPath(data.path);
        setOpen(true);
        setLoading(false);
      })
      .catch(() => {
        setLog('No log available.');
        setOpen(true);
        setLoading(false);
      });
  }

  return (
    <RuntimeFooter
      summary={
        <span className="flex items-center gap-1.5 text-[11px]">
          {loading ? <Spinner /> : null}
          Last run log
        </span>
      }
      open={open && log !== null}
      onToggle={loadLog}
      className="pt-3"
    >
      {open && log !== null && (
        <div className="mt-2">
          {logPath && <p className="text-[9px] font-mono text-dim/50 truncate mb-1">{logPath.split('/').slice(-1)[0]}</p>}
          <TerminalBlock compact className="max-h-64 min-h-0 break-all bg-elevated p-2.5 text-[10px] leading-relaxed">
            {log || '(empty)'}
          </TerminalBlock>
        </div>
      )}
    </RuntimeFooter>
  );
}
