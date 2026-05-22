import { describe, expect, it } from 'vitest';

import * as routes from './index.js';

describe('server routes barrel', () => {
  it('reexports server route registration', () => {
    expect(routes.registerServerRoutes).toBeTypeOf('function');
  });
});
