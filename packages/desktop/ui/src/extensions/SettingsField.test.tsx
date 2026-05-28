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

describe('SettingsField', () => {
  it('separates setting labels from inline descriptions in text content', () => {
    const onChange = vi.fn();
    const { getByText } = render(<SettingsField entry={emojiListEntry} value={undefined} onChange={onChange} />);

    expect(getByText('Emoji Picker Items').closest('label')?.textContent).toBe('Emoji Picker Items Emoji reply starters.');
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
});
