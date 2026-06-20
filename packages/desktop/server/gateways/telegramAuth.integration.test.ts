import { describe, expect, it } from 'vitest';

import { TELEGRAM_SECRET_EXTENSION, TELEGRAM_SECRET_ID } from './telegramAuth.js';

describe('telegramAuth external extension secret contract', () => {
  it('uses the externally distributed system-gateways secret id', () => {
    expect(TELEGRAM_SECRET_EXTENSION).toBe('system-gateways');
    expect(TELEGRAM_SECRET_ID).toBe('telegramBotToken');
  });
});
