interface ParsedCronField {
  values: Set<number>;
  wildcard: boolean;
}

export interface ParsedCronExpression {
  raw: string;
  minute: ParsedCronField;
  hour: ParsedCronField;
  dayOfMonth: ParsedCronField;
  month: ParsedCronField;
  dayOfWeek: ParsedCronField;
}

interface CronTaskSchedule {
  type: 'cron';
  expression: string;
  parsed: ParsedCronExpression;
}

interface AtTaskSchedule {
  type: 'at';
  at: string;
  atMs: number;
}

export type ParsedTaskSchedule = CronTaskSchedule | AtTaskSchedule;

export interface ParsedTaskDefinition {
  key: string;
  filePath: string;
  fileName: string;
  id: string;
  title?: string;
  enabled: boolean;
  schedule: ParsedTaskSchedule;
  prompt: string;
  profile: string;
  modelRef?: string;
  thinkingLevel?: string;
  allowedTools?: string[];
  cwd?: string;
  timeoutSeconds: number;
}

function parseCronNumber(raw: string, min: number, max: number, label: string, allowSunday7 = false): number {
  if (!/^\d+$/.test(raw)) {
    throw new Error(`Invalid ${label} value: ${raw}`);
  }

  const value = Number.parseInt(raw, 10);
  const maxValue = allowSunday7 ? Math.max(max, 7) : max;

  if (value < min || value > maxValue) {
    throw new Error(`Invalid ${label} value: ${raw}`);
  }

  return value;
}

function parseStep(raw: string, label: string): number {
  if (!/^\d+$/.test(raw)) {
    throw new Error(`Invalid ${label} step value: ${raw}`);
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label} step value: ${raw}`);
  }

  return parsed;
}

function normalizeCronValue(value: number, allowSunday7: boolean): number {
  if (allowSunday7 && value === 7) {
    return 0;
  }

  return value;
}

function parseCronField(raw: string, min: number, max: number, label: string, allowSunday7 = false): ParsedCronField {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error(`Cron ${label} field cannot be empty`);
  }

  const values = new Set<number>();
  const tokens = trimmed.split(',');

  for (const token of tokens) {
    const part = token.trim();
    if (part.length === 0) {
      throw new Error(`Cron ${label} field has empty list item`);
    }

    const stepParts = part.split('/');
    if (stepParts.length > 2) {
      throw new Error(`Cron ${label} field has invalid step syntax: ${part}`);
    }

    const rangePart = stepParts[0] ?? '';
    const step = stepParts[1] ? parseStep(stepParts[1], label) : 1;

    let start: number;
    let end: number;

    if (rangePart === '*') {
      start = min;
      end = max;
    } else if (rangePart.includes('-')) {
      const [startRaw, endRaw] = rangePart.split('-', 2);
      if (!startRaw || !endRaw) {
        throw new Error(`Cron ${label} field has invalid range: ${rangePart}`);
      }

      start = parseCronNumber(startRaw, min, max, label, allowSunday7);
      end = parseCronNumber(endRaw, min, max, label, allowSunday7);
    } else {
      start = parseCronNumber(rangePart, min, max, label, allowSunday7);
      end = start;
    }

    if (start > end) {
      throw new Error(`Cron ${label} field has descending range: ${rangePart}`);
    }

    for (let value = start; value <= end; value += step) {
      values.add(normalizeCronValue(value, allowSunday7));
    }
  }

  return {
    values,
    wildcard: trimmed === '*',
  };
}

export function parseCronExpression(rawExpression: string): ParsedCronExpression {
  const expression = rawExpression.trim();
  const fields = expression.split(/\s+/);

  if (fields.length !== 5) {
    throw new Error(`Cron expression must have 5 fields: ${rawExpression}`);
  }

  return {
    raw: expression,
    minute: parseCronField(fields[0] ?? '', 0, 59, 'minute'),
    hour: parseCronField(fields[1] ?? '', 0, 23, 'hour'),
    dayOfMonth: parseCronField(fields[2] ?? '', 1, 31, 'day-of-month'),
    month: parseCronField(fields[3] ?? '', 1, 12, 'month'),
    dayOfWeek: parseCronField(fields[4] ?? '', 0, 6, 'day-of-week', true),
  };
}

export function cronMatches(expression: ParsedCronExpression, at: Date): boolean {
  const minute = at.getMinutes();
  const hour = at.getHours();
  const dayOfMonth = at.getDate();
  const month = at.getMonth() + 1;
  const dayOfWeek = at.getDay();

  if (!expression.minute.values.has(minute)) {
    return false;
  }

  if (!expression.hour.values.has(hour)) {
    return false;
  }

  if (!expression.month.values.has(month)) {
    return false;
  }

  const domMatch = expression.dayOfMonth.values.has(dayOfMonth);
  const dowMatch = expression.dayOfWeek.values.has(dayOfWeek);

  const dayMatches =
    expression.dayOfMonth.wildcard && expression.dayOfWeek.wildcard
      ? true
      : expression.dayOfMonth.wildcard
        ? dowMatch
        : expression.dayOfWeek.wildcard
          ? domMatch
          : domMatch || dowMatch;

  return dayMatches;
}
