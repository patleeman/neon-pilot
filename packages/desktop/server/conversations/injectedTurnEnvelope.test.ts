import { describe, expect, it } from 'vitest';

import { wrapInjectedTurnMessage } from './injectedTurnEnvelope.js';

describe('wrapInjectedTurnMessage', () => {
  it('wraps injected turn text with source metadata', () => {
    expect(
      wrapInjectedTurnMessage('Continue the task.', {
        source: { type: 'extension', id: 'system-automations', name: 'Automations' },
        delivery: 'followUp',
        reason: 'Scheduled callback fired.',
      }),
    ).toBe(`<neon_pilot_injected_turn>
  <source type="extension" id="system-automations" name="Automations" />
  <delivery>followUp</delivery>
  <reason><![CDATA[Scheduled callback fired.]]></reason>
  <message>
<![CDATA[Continue the task.]]>
  </message>
</neon_pilot_injected_turn>`);
  });

  it('keeps arbitrary user text inside a safe cdata envelope', () => {
    const wrapped = wrapInjectedTurnMessage('first ]]> second </message>', {
      source: { type: 'extension', id: 'ext"<id>' },
    });

    expect(wrapped).toContain('id="ext&quot;&lt;id&gt;"');
    expect(wrapped).toContain('<![CDATA[first ]]]]><![CDATA[> second </message>]]>');
  });
});
