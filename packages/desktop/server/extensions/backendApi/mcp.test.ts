import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({ callServerModuleExport: vi.fn() }));

vi.mock('./serverModuleResolver.js', () => resolver);

describe('backendApi/mcp', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('writes explicit MCP config documents through the private core writer', async () => {
    const mcp = await import('./mcp.js');
    resolver.callServerModuleExport.mockResolvedValueOnce(undefined);

    await expect(mcp.writeExplicitMcpConfigDocument({ path: '/tmp/mcp.json', document: { mcpServers: {} } })).resolves.toBeUndefined();

    expect(resolver.callServerModuleExport).toHaveBeenCalledWith(
      '@neon-pilot/core',
      'writePrivateMcpConfigJson',
      '/tmp/mcp.json',
      { mcpServers: {} },
    );
  });
});
