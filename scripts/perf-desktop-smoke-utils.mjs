import { readFileSync } from 'node:fs';

export function readNumericSourceExport(filePath, exportName) {
  const source = readFileSync(filePath, 'utf8');
  const match = new RegExp(`export\\s+const\\s+${exportName}\\s*=\\s*(\\d+)\\s*;`).exec(source);
  if (!match) {
    throw new Error(`Unable to read numeric export ${exportName} from ${filePath}`);
  }
  return Number(match[1]);
}

export function summarizeCpuOffenders(samples) {
  const byCommand = new Map();
  for (const sample of samples) {
    for (const offender of sample.offenders ?? []) {
      const key = offender.command;
      const current = byCommand.get(key) ?? {
        command: offender.command,
        samples: 0,
        totalCpu: 0,
        peakCpu: 0,
        pids: new Set(),
      };
      current.samples += 1;
      current.totalCpu += offender.cpu;
      current.peakCpu = Math.max(current.peakCpu, offender.cpu);
      current.pids.add(offender.pid);
      byCommand.set(key, current);
    }
  }
  return [...byCommand.values()]
    .map((entry) => ({
      command: entry.command,
      samples: entry.samples,
      avgCpu: Math.round((entry.totalCpu / entry.samples) * 10) / 10,
      peakCpu: Math.round(entry.peakCpu * 10) / 10,
      pids: [...entry.pids].sort((a, b) => a - b),
    }))
    .sort((a, b) => b.avgCpu - a.avgCpu || b.peakCpu - a.peakCpu);
}

export function samplesAfterCount(samples, beforeCount) {
  if (!Array.isArray(samples)) return [];
  if (!Number.isFinite(beforeCount) || beforeCount <= 0) return samples;
  return samples.slice(Math.min(samples.length, Math.max(0, Math.floor(beforeCount))));
}

export function readRecentOperationDurationMs(entries, label) {
  if (!Array.isArray(entries)) {
    return null;
  }

  let maxDurationMs = null;
  for (const entry of entries) {
    if (typeof entry !== 'string' || !entry.startsWith(`${label}:`)) {
      continue;
    }

    const match = /:(\d+(?:\.\d+)?)ms$/.exec(entry);
    if (!match) {
      continue;
    }

    const durationMs = Number(match[1]);
    if (!Number.isFinite(durationMs)) {
      continue;
    }

    maxDurationMs = maxDurationMs === null ? durationMs : Math.max(maxDurationMs, durationMs);
  }

  return maxDurationMs;
}
