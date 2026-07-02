import '@fontsource-variable/space-grotesk';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import '../src/styles.css';

import type { Preview } from '@storybook/react';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'desktop',
      values: [
        { name: 'desktop', value: 'oklch(95% 0.022 75)' },
        { name: 'paper', value: 'oklch(99% 0.01 75)' },
        { name: 'ink', value: 'oklch(20% 0.01 60)' },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: 'fullscreen',
  },
};

export default preview;
