import { existsSync, readFileSync } from 'node:fs';

const forbiddenGeneratedRoutePattern =
  /application unavailable|can(?:not|['’]t) open|could not (?:be )?load(?:ed)?|startup error|safe mode|loading extension|something went wrong/iu;

export function validateGeneratedVisualEvidence(routes, generated, expectations) {
  const problems = [];
  for (const route of routes) {
    const routeCaptures = (generated ?? []).filter((entry) => entry?.route === route && typeof entry?.text === 'string');
    if (routeCaptures.length === 0) {
      problems.push(`${route}: no captured route text`);
      continue;
    }
    const body = routeCaptures
      .map((entry) => (existsSync(entry.text) ? readFileSync(entry.text, 'utf8') : ''))
      .join('\n')
      .trim();
    const normalizedBody = body.toLocaleLowerCase();
    if (!body || forbiddenGeneratedRoutePattern.test(body)) problems.push(`${route}: blank or host error surface`);
    const expectation = (expectations ?? []).find((candidate) => candidate?.route === route);
    if (!expectation) {
      problems.push(`${route}: missing semantic route expectation`);
      continue;
    }
    for (const expected of expectation.expectAllText ?? []) {
      if (typeof expected === 'string' && !normalizedBody.includes(expected.toLocaleLowerCase())) {
        problems.push(`${route}: missing expected text ${JSON.stringify(expected)}`);
      }
    }
  }
  return problems;
}
