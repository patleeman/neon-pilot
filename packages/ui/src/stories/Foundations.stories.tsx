import type { Meta, StoryObj } from '@storybook/react';

import '../styles.css';

const meta = {
  title: 'Foundations/Tokens',
  tags: ['autodocs'],
  render: () => (
    <div style={{ display: 'grid', gap: 24, minWidth: 720 }}>
      <section>
        <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Color Tokens</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12 }}>
          {[
            ['Base', 'base'],
            ['Surface', 'surface'],
            ['Elevated', 'elevated'],
            ['Accent', 'accent'],
            ['Success', 'success'],
            ['Warning', 'warning'],
            ['Danger', 'danger'],
            ['Teal', 'teal'],
            ['Steel', 'steel'],
            ['Panel', 'panel'],
          ].map(([label, token]) => (
            <div key={token} className="ui-panel-muted" style={{ overflow: 'hidden' }}>
              <div style={{ height: 48, background: `rgb(var(--color-${token}))` }} />
              <div style={{ padding: 10, fontSize: 12 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Type Scale</h2>
        <div className="ui-panel" style={{ display: 'grid', gap: 8, padding: 16 }}>
          <div className="ui-app-page-eyebrow">Eyebrow</div>
          <h1 className="ui-app-page-title">Agent Extension Page Title</h1>
          <div className="ui-app-page-summary">
            Summary text describes what the surface does and what agents should expect users to do here.
          </div>
        </div>
      </section>
    </div>
  ),
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tokens: Story = {};
