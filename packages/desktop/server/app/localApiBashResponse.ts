export function buildExecuteLiveSessionBashResponse(input: { result: unknown }): { ok: true; result: unknown } {
  return { ok: true, result: input.result };
}
