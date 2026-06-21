// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { UnifiedSettingsEntry } from '../shared/types';
import { SettingsField } from './SettingsField';

const emojiListEntry: UnifiedSettingsEntry = {
  extensionId: 'system-reply-actions',
  key: 'systemReplyActions.emojiPickerItems',
  type: 'string',
  control: 'emoji-label-list',
  default: '👍 Agree, 👎 Disagree',
  description: 'Emoji reply starters.',
  group: 'Reply Actions',
  placeholder: 'Agree',
  order: 10,
};

const agentToolListEntry: UnifiedSettingsEntry = {
  extensionId: 'system-dynamic-workflows',
  key: 'dynamicWorkflows.defaultAgentAllowedTools',
  type: 'string',
  control: 'agent-tool-list',
  default: 'bash,read,edit,write',
  description: 'Default tool names for workflow subagents.',
  group: 'Dynamic Workflows',
  placeholder: 'Custom tool name',
  order: 20,
};

const selectEntry: UnifiedSettingsEntry = {
  extensionId: 'system-settings',
  key: 'conversation.diffDisclosure',
  type: 'select',
  default: 'collapsed',
  description: 'Controls whether file changes start collapsed or expanded.',
  group: 'Conversation',
  enum: ['collapsed', 'expanded'],
  enumLabels: {
    collapsed: 'Start collapsed',
    expanded: 'Always expanded',
  },
  order: 30,
};

describe('SettingsField', () => {
  it('separates setting labels from inline descriptions in text content', () => {
    const onChange = vi.fn();
    const { getByText } = render(<SettingsField entry={emojiListEntry} value={undefined} onChange={onChange} />);

    expect(getByText('Emoji Picker Items').textContent).toBe('Emoji Picker Items');
    expect(getByText('Emoji reply starters.').textContent).toBe('Emoji reply starters.');
  });

  it('renders human labels for select values when provided', () => {
    const onChange = vi.fn();
    const { getByText } = render(<SettingsField entry={selectEntry} value={undefined} onChange={onChange} />);

    expect(getByText('Start collapsed')).toBeTruthy();
    expect(getByText('Always expanded')).toBeTruthy();
  });

  it('renders emoji label lists as separate emoji and label controls', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(<SettingsField entry={emojiListEntry} value={undefined} onChange={onChange} />);

    expect((getByLabelText('Emoji for reply action 1') as HTMLSelectElement).value).toBe('👍');
    expect((getByLabelText('Label for reply action 1') as HTMLInputElement).value).toBe('Agree');
    expect((getByLabelText('Emoji for reply action 2') as HTMLSelectElement).value).toBe('👎');
    expect((getByLabelText('Label for reply action 2') as HTMLInputElement).value).toBe('Disagree');
  });

  it('serializes edited emoji label lists back to the setting string', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(<SettingsField entry={emojiListEntry} value="👍 Agree, 👎 Disagree" onChange={onChange} />);

    fireEvent.change(getByLabelText('Label for reply action 2'), { target: { value: 'Push back' } });

    expect(onChange).toHaveBeenCalledWith('systemReplyActions.emojiPickerItems', '👍 Agree, 👎 Push back');
  });

  it('uses a compact bare remove control for emoji label rows', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(<SettingsField entry={emojiListEntry} value="👍 Agree" onChange={onChange} />);

    expect(getByLabelText('Remove reply action 1').textContent).toBe('×');

    fireEvent.click(getByLabelText('Remove reply action 1'));

    expect(onChange).toHaveBeenCalledWith('systemReplyActions.emojiPickerItems', '');
  });

  it('renders agent tool lists as common tool checkboxes and custom rows', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(<SettingsField entry={agentToolListEntry} value="bash,read,custom_tool" onChange={onChange} />);

    expect((getByLabelText('bash') as HTMLInputElement).checked).toBe(true);
    expect((getByLabelText('read') as HTMLInputElement).checked).toBe(true);
    expect((getByLabelText('edit') as HTMLInputElement).checked).toBe(false);
    expect((getByLabelText('Additional agent tool 1') as HTMLInputElement).value).toBe('custom_tool');
  });

  it('serializes edited agent tool lists back to the setting string', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(<SettingsField entry={agentToolListEntry} value="bash,read,custom_tool" onChange={onChange} />);

    fireEvent.click(getByLabelText('edit'));
    expect(onChange).toHaveBeenLastCalledWith('dynamicWorkflows.defaultAgentAllowedTools', 'bash,read,edit,custom_tool');

    fireEvent.change(getByLabelText('Additional agent tool 1'), { target: { value: 'browser_snapshot' } });
    expect(onChange).toHaveBeenLastCalledWith('dynamicWorkflows.defaultAgentAllowedTools', 'bash,read,browser_snapshot');

    fireEvent.click(getByLabelText('Remove additional agent tool 1'));
    expect(onChange).toHaveBeenLastCalledWith('dynamicWorkflows.defaultAgentAllowedTools', 'bash,read');
  });
});
