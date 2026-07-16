export function resolveBenchmarkProxyAuthStrategy(api) {
  return api === 'anthropic-messages' ? { header: 'x-api-key', prefix: '' } : { header: 'authorization', prefix: 'Bearer ' };
}

export const BENCHMARK_PROXY_ALLOWED_PATHS = new Set(['/chat/completions', '/responses', '/messages']);
