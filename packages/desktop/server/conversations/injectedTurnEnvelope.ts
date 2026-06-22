export interface InjectedTurnSource {
  type: 'extension' | 'automation' | 'system';
  id: string;
  name?: string;
}

export interface InjectedTurnEnvelopeOptions {
  source: InjectedTurnSource;
  delivery?: 'started' | 'steer' | 'followUp' | 'nextTurn';
  reason?: string;
}

function escapeXmlAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function cdata(value: string): string {
  return `<![CDATA[${value.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

function optionalAttribute(name: string, value: string | undefined): string {
  const normalized = value?.trim();
  return normalized ? ` ${name}="${escapeXmlAttribute(normalized)}"` : '';
}

/**
 * Wraps non-human prompt text injected by host/extension automation so the agent
 * can tell who caused the extra turn and how it was delivered.
 */
export function wrapInjectedTurnMessage(text: string, options: InjectedTurnEnvelopeOptions): string {
  const source = options.source;
  const delivery = options.delivery?.trim();
  const reason = options.reason?.trim();

  return [
    '<neon_pilot_injected_turn>',
    `  <source type="${escapeXmlAttribute(source.type)}" id="${escapeXmlAttribute(source.id)}"${optionalAttribute('name', source.name)} />`,
    delivery ? `  <delivery>${escapeXmlAttribute(delivery)}</delivery>` : undefined,
    reason ? `  <reason>${cdata(reason)}</reason>` : undefined,
    '  <message>',
    cdata(text),
    '  </message>',
    '</neon_pilot_injected_turn>',
  ]
    .filter((line): line is string => line !== undefined)
    .join('\n');
}
