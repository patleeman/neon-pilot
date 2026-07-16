import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { analyzeBundledAuthoringManifest } from './bundled-authoring-contract.mjs';
import { buildBenchmarkBaseEnv } from './benchmark-child-env.mjs';
import { hasForbiddenPackagedResourceRead } from './benchmark-packaged-resource-policy.mjs';
import { isSuccessfulBehaviorResult } from './bundled-behavior-evidence.mjs';
import { createArtifactRedactor, registerSensitiveStringLeaves } from './benchmark-artifact-redaction.mjs';
import { resolveBenchmarkProxyAuthStrategy } from './benchmark-provider-proxy-contract.mjs';
import { validateGeneratedVisualEvidence } from './bundled-visual-evidence.mjs';
import { packagedExtensionSdkSeeds, resolvePackagedExtensionSdkFilter } from './packaged-extension-sdk.mjs';

const tempRoots = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('bundled extension authoring eval', () => {
  it('uses narrow Bearer and API-key-header proxy authentication strategies', () => {
    expect(resolveBenchmarkProxyAuthStrategy('openai-completions')).toEqual({ header: 'authorization', prefix: 'Bearer ' });
    expect(resolveBenchmarkProxyAuthStrategy('anthropic-messages')).toEqual({ header: 'x-api-key', prefix: '' });
  });

  it('passes only non-secret host environment fields into benchmark children', () => {
    const childEnv = buildBenchmarkBaseEnv({
      PATH: '/bin',
      LANG: 'en_US.UTF-8',
      BUNDLED_EVAL_HOST_SECRET: 'must-not-cross',
      GH_TOKEN: 'must-not-cross',
      SSH_AUTH_SOCK: '/private/agent.sock',
    });
    expect(childEnv).toEqual({ PATH: '/bin', LANG: 'en_US.UTF-8' });
  });

  it('keeps proxy concurrency accounting scoped to admitted requests and rejects redirects', () => {
    const source = readFileSync(join(new URL('..', import.meta.url).pathname, 'scripts/benchmark-provider-proxy.mjs'), 'utf8');
    expect(source).toContain('let counted = false');
    expect(source).toContain('counted = true');
    expect(source).toContain('if (counted) activeRequests');
    expect(source).toContain("redirect: 'error'");
  });

  it('registers the ephemeral provider proxy bearer with artifact redaction', () => {
    const source = readFileSync(join(new URL('..', import.meta.url).pathname, 'scripts/bundled-extension-authoring-eval.mjs'), 'utf8');
    expect(source).toContain('benchmarkProxyToken = randomBytes(32)');
    expect(source).toContain('artifactRedactor.add(benchmarkProxyToken)');
  });

  it('verifies and filesystem-isolates the signed app used for agent authoring', () => {
    const source = readFileSync(join(new URL('..', import.meta.url).pathname, 'scripts/bundled-extension-authoring-eval.mjs'), 'utf8');
    expect(source).toContain("['--verify', '--deep', '--strict', appBundle]");
    expect(source).toContain("run('/bin/cp', ['-cR', appBundle, runtimeAppBundle]");
    expect(source).toContain("'/usr/bin/sandbox-exec'");
    expect(source).toContain('sandbox-exec-multi-root-denied');
    expect(source).toContain("resolve('/tmp', `.neon-pilot-authoring-temp-canary-");
    expect(source).toContain("resolve(repoRoot, 'package.json')");
    expect(source).toContain('(literal ${sandboxLiteral(tempCanary)})');
    expect(source).toContain('(subpath ${sandboxLiteral(realpathSync(repoRoot))})');
    expect(source).toContain("'--no-sandbox'");
    expect(source).toContain('CFBundleExecutable');
    expect(source).toContain('child.runtimePid = record.pid');
    expect(source).toContain("process.kill(runtimePid, 'SIGKILL')");
    expect(source).toContain("block?.type === 'tool_use'");
    expect(source).toContain('Inspect agent-authored tool inputs, never tool outputs');
  });

  it('rejects action-level failures wrapped by a successful CLI envelope', () => {
    expect(isSuccessfulBehaviorResult({ ok: false, error: 'benchmark text was not saved' })).toBe(false);
    expect(isSuccessfulBehaviorResult({ error: 'benchmark text was not saved' })).toBe(false);
    expect(isSuccessfulBehaviorResult({ ok: true, details: { ok: false, error: 'write failed' } })).toBe(false);
    expect(isSuccessfulBehaviorResult({ ok: true, result: { details: { ok: true, value: 'saved' } } })).toBe(true);
    expect(isSuccessfulBehaviorResult({ ok: true, value: 'benchmark text' })).toBe(true);
  });

  it('gates UI cases on an image-backed taste judge', () => {
    const source = readFileSync(join(new URL('..', import.meta.url).pathname, 'scripts/bundled-extension-authoring-eval.mjs'), 'utf8');
    expect(source).toContain("resolve(repoRoot, 'scripts/extension-visual-judge.mjs')");
    expect(source).toContain("aggregate?.decision === 'pass'");
    expect(source).toContain('result?.imageAccess === true');
    expect(source).toContain('Number(result?.overall ?? 0) >= 4');
    expect(source).toContain('result.mustFix.length === 0');
    expect(source).toContain('visualEvidenceProblems.length === 0 &&');
  });

  it('packages the recursive closure of public SDK declarations', () => {
    const root = mkdtempSync(join(tmpdir(), 'packaged-extension-sdk-'));
    tempRoots.push(root);
    writeFileSync(join(root, 'workbench.d.ts'), "export type { BrowserTabItem } from './workbenchBrowserTabs.js';\n");
    writeFileSync(join(root, 'workbench-browser.d.ts'), "export { createTabs } from './workbenchBrowserTabs.js';\n");
    writeFileSync(join(root, 'workbenchBrowserTabs.d.ts'), 'export interface BrowserTabItem { id: string }\n');
    const declarations = resolvePackagedExtensionSdkFilter(root, ['workbench.d.ts', 'workbench-browser.d.ts']);
    expect(declarations).toContain('workbenchBrowserTabs.d.ts');
    expect(packagedExtensionSdkSeeds).toContain('backend/browser.d.ts');
    expect(packagedExtensionSdkSeeds).toContain('workbenchBrowserTabs.d.ts');
  });

  it('rejects blank, host-error, and semantically incomplete generated routes', () => {
    const out = mkdtempSync(join(tmpdir(), 'bundled-authoring-visual-evidence-'));
    tempRoots.push(out);
    const healthy = join(out, 'healthy.txt');
    const broken = join(out, 'broken.txt');
    const liveError = join(out, 'live-error.txt');
    writeFileSync(healthy, 'Local Models\nModels\nRefresh');
    writeFileSync(broken, 'APPLICATION UNAVAILABLE\nLocal Models');
    writeFileSync(liveError, 'This extension surface could not be loaded.');
    const expectation = [{ route: '/ext/models', expectAllText: ['Models', 'Refresh'] }];

    expect(validateGeneratedVisualEvidence(['/ext/models'], [{ route: '/ext/models', text: healthy }], expectation)).toEqual([]);
    expect(validateGeneratedVisualEvidence(['/ext/models'], [{ route: '/ext/models', text: broken }], expectation)).toEqual(
      expect.arrayContaining([expect.stringContaining('host error surface'), expect.stringContaining('missing expected text')]),
    );
    expect(validateGeneratedVisualEvidence(['/ext/models'], [{ route: '/ext/models', text: liveError }], expectation)).toEqual(
      expect.arrayContaining([expect.stringContaining('host error surface')]),
    );
    expect(validateGeneratedVisualEvidence(['/ext/models'], [{ route: '/ext/models', text: healthy }], [])).toEqual([
      '/ext/models: missing semantic route expectation',
    ]);
  });

  it('requires stable conversation quiescence instead of treating a tool-batch gap as completion', () => {
    const source = readFileSync(join(new URL('..', import.meta.url).pathname, 'scripts/bundled-extension-authoring-eval.mjs'), 'utf8');
    expect(source).toContain('const quiescenceMs = 30_000');
    expect(source).toContain('activityAt !== quietActivityAt');
    expect(source).toContain('Date.now() - quietSince >= quiescenceMs');
    expect(source).toContain("newestBlock?.type === 'text'");
    expect(source).toContain('latest === null || Number(block?.index) > Number(latest?.index)');
    expect(source).toContain('Packaged app exited during an unfinished agent tool turn');
    expect(source).toContain("'failed-agent-sessions'");
    expect(source).toContain("'generated-extension-on-failure'");
    expect(source).not.toContain('appExited: true');
    expect(source).toContain('env: benchmarkChildEnv');
    expect(source).not.toContain('env: { ...process.env');
    expect(source).toContain("text.replaceAll(String(allowedPath), '[PACKAGED_NEON_PILOT]')");
  });

  it('allows public packaged authoring reads but rejects private bundled extension reads', () => {
    const app = '/Applications/Neon Pilot.app';
    const skill = `${app}/Contents/Resources/extensions/system-extension-manager/skills/local-extension-development`;
    const authoring = `${app}/Contents/Resources/extension-authoring`;
    expect(hasForbiddenPackagedResourceRead(`{"path":"${skill}/SKILL.md"}`, app, [skill, authoring])).toBe(false);
    expect(hasForbiddenPackagedResourceRead(`{"path":"${skill}\\\\\\"}`, app, [skill, authoring])).toBe(false);
    expect(hasForbiddenPackagedResourceRead(`{"path":"${authoring}/sdk/index.d.ts"}`, app, [skill, authoring])).toBe(false);
    expect(
      hasForbiddenPackagedResourceRead(`{"path":"${app}/Contents/Resources/extensions/system-alerts/extension.json"}`, app, [
        skill,
        authoring,
      ]),
    ).toBe(true);
    expect(hasForbiddenPackagedResourceRead(`rg secret "${app}/Contents/Resources/app.asar"`, app, [skill, authoring])).toBe(true);
    expect(
      hasForbiddenPackagedResourceRead(`{"path":"${authoring}/../extensions/system-alerts/extension.json"}`, app, [skill, authoring]),
    ).toBe(true);
  });

  it('redacts a deliberately echoed provider credential from every artifact file', () => {
    const out = mkdtempSync(join(tmpdir(), 'bundled-authoring-redaction-'));
    tempRoots.push(out);
    const credential = 'benchmark-provider-secret-value';
    const redactor = createArtifactRedactor();
    redactor.add(credential);
    redactor.write(join(out, 'agent.stdout.txt'), `agent echoed ${credential}`);
    redactor.write(join(out, 'agent.transcript.json'), JSON.stringify({ output: credential }));
    mkdirSync(join(out, 'generated-extension'), { recursive: true });
    writeFileSync(join(out, 'generated-extension', 'frontend.js'), `export const leaked = '${credential}'`);
    writeFileSync(join(out, 'app.stderr.txt'), `split log ${credential}`);

    redactor.sanitizeTree(out);
    redactor.assertCleanTree(out);

    for (const relative of ['agent.stdout.txt', 'agent.transcript.json', 'generated-extension/frontend.js', 'app.stderr.txt']) {
      const text = readFileSync(join(out, relative), 'utf8');
      expect(text).not.toContain(credential);
      expect(text).toContain('[REDACTED]');
    }
  });

  it('rejects and removes credential-bearing filenames and symlinks', () => {
    const out = mkdtempSync(join(tmpdir(), 'bundled-authoring-redaction-path-'));
    tempRoots.push(out);
    const credential = 'benchmark-provider-secret-value';
    const redactor = createArtifactRedactor();
    redactor.add(credential);
    writeFileSync(join(out, `leak-${credential}.txt`), 'content');
    symlinkSync('/tmp/runtime-auth.json', join(out, 'runtime-auth-link'));

    expect(() => redactor.assertCleanTree(out)).toThrow(/sensitive benchmark credential/iu);
    redactor.sanitizeTree(out);
    redactor.assertCleanTree(out);

    expect(readdirSync(out).join('\n')).not.toContain(credential);
    expect(readdirSync(out)).toContain('runtime-auth-link.removed-symlink');
  });

  it('redacts nested environment and OAuth credential string leaves', () => {
    const redactor = createArtifactRedactor();
    registerSensitiveStringLeaves(redactor, {
      type: 'oauth',
      env: { ACCESS_TOKEN: 'nested-access-token-secret' },
      session: { refresh: ['nested-refresh-token-secret'] },
    });
    expect(redactor.redactText('nested-access-token-secret nested-refresh-token-secret')).toBe('[REDACTED] [REDACTED]');
    expect(redactor.redactText('api_key oauth')).toBe('api_key oauth');
  });

  it('accepts an explicit multi-page singleton application contract', () => {
    const testCase = { extensionId: 'local-models', productKind: 'application' };
    const manifest = {
      schemaVersion: 2,
      id: 'local-models',
      packageType: 'user',
      contributes: {
        applications: [
          {
            id: 'app',
            startRoute: '/ext/local-models',
            sidebarView: 'sidebar',
            instancePolicy: 'singleton',
            navigationSlots: [{ id: 'primary' }],
          },
        ],
        views: [
          { id: 'models', location: 'main', route: '/ext/local-models', applicationId: 'local-models:app', openPolicy: 'internal' },
          {
            id: 'downloads',
            location: 'main',
            route: '/ext/local-models/downloads',
            applicationId: 'local-models:app',
            openPolicy: 'internal',
          },
          {
            id: 'runtime',
            location: 'main',
            route: '/ext/local-models/runtime',
            applicationId: 'local-models:app',
            openPolicy: 'internal',
          },
          { id: 'sidebar', location: 'sidebar' },
        ],
        nav: [
          { id: 'models', applicationId: 'local-models:app' },
          { id: 'downloads', applicationId: 'local-models:app' },
          { id: 'runtime', applicationId: 'local-models:app' },
        ],
        commands: [
          { id: 'open', title: 'Open models' },
          { id: 'refresh', title: 'Refresh models' },
        ],
      },
    };

    expect(
      analyzeBundledAuthoringManifest(testCase, manifest, {
        backend: 'await ctx.storage.put("models", records)',
        frontend: '<EmptyState /> <ErrorState />',
      }),
    ).toEqual({ ok: true, problems: [] });
  });

  it('rejects an implicit app and a duplicate app for an Agent contribution', () => {
    expect(
      analyzeBundledAuthoringManifest(
        { extensionId: 'reading-list', productKind: 'page' },
        {
          schemaVersion: 2,
          id: 'reading-list',
          packageType: 'user',
          contributes: { views: [{ id: 'page', location: 'main', route: '/ext/reading-list' }] },
        },
      ).ok,
    ).toBe(false);
    expect(
      analyzeBundledAuthoringManifest(
        { extensionId: 'reviews', productKind: 'application-contribution', targetApplicationId: 'system-agent:agent' },
        {
          schemaVersion: 2,
          id: 'reviews',
          packageType: 'user',
          contributes: {
            applications: [{ id: 'app' }],
            views: [{ id: 'page', location: 'main', applicationId: 'reviews:app', openPolicy: 'internal' }],
            nav: [{ id: 'page', applicationId: 'reviews:app' }],
          },
        },
      ).ok,
    ).toBe(false);
  });

  it('dry-runs in an empty temporary workspace without injecting repo implementation guidance', () => {
    const out = mkdtempSync(join(tmpdir(), 'bundled-authoring-eval-test-'));
    tempRoots.push(out);
    execFileSync(
      process.execPath,
      ['scripts/bundled-extension-authoring-eval.mjs', '--dry-run', '--case=eq-bundled-page', `--out=${out}`],
      {
        cwd: new URL('..', import.meta.url),
      },
    );
    const summary = JSON.parse(readFileSync(join(out, 'summary.json'), 'utf8'));
    expect(summary.ok).toBe(true);
    expect(summary.cases).toHaveLength(1);
    expect(summary.cases[0].prompt).toContain('Use the bundled local-extension-development skill');
    expect(summary.cases[0].prompt).not.toContain('docs/design/neon-pilot-taste.md');
    expect(summary.cases[0].prompt).not.toContain('contributes.applications');
    expect(summary.cases[0].workspace).not.toContain('/workingdir/neon-pilot/');
    expect(summary.provenance.isolatedStateRoot).toContain('/np-authoring-');
    expect(summary.provenance.isolatedUserData).toContain('/np-authoring-');
    expect(summary.provenance.isolatedDaemonSocket).toContain('/np-authoring-');
    expect(summary.provenance.clearedEnvironmentOverrides).toEqual(
      expect.arrayContaining([
        'NEON_PILOT_AUTH_PATH',
        'NEON_PILOT_SESSION_PATH',
        'NEON_PILOT_CACHE_PATH',
        'NEON_PILOT_EXTENSION_PATHS',
        'NEON_PILOT_DESKTOP_DEV_BUNDLE',
        'NEON_PILOT_DESKTOP_APP_PATH',
        'PI_CODING_AGENT_DIR',
        'PI_PACKAGE_DIR',
      ]),
    );
  });

  it('includes a natural app-authoring case without naming the injected skill', () => {
    const out = mkdtempSync(join(tmpdir(), 'bundled-authoring-natural-eval-test-'));
    tempRoots.push(out);
    execFileSync(
      process.execPath,
      ['scripts/bundled-extension-authoring-eval.mjs', '--dry-run', '--case=eq-bundled-agent-page', `--out=${out}`],
      {
        cwd: new URL('..', import.meta.url),
      },
    );
    const summary = JSON.parse(readFileSync(join(out, 'summary.json'), 'utf8'));
    expect(summary.cases[0].prompt).toContain('adds a Reviews page inside the existing Agent application');
    expect(summary.cases[0].prompt).not.toContain('local-extension-development');
  });

  it('copies only hashed model/auth seed inputs and excludes machine instructions and MCPs', () => {
    const out = mkdtempSync(join(tmpdir(), 'bundled-authoring-seed-out-'));
    const seed = mkdtempSync(join(tmpdir(), 'bundled-authoring-seed-input-'));
    tempRoots.push(out, seed);
    mkdirSync(join(seed, 'neon-pilot-runtime'), { recursive: true });
    writeFileSync(
      join(seed, 'secrets.index.json'),
      JSON.stringify(['extension:machine-extension:token', 'provider:opencode-go:apiKey', 'provider:other-provider:apiKey']),
    );
    writeFileSync(
      join(seed, 'neon-pilot-runtime', 'auth.json'),
      JSON.stringify({
        'opencode-go': { type: 'api_key', key: 'test-provider-secret' },
        'unrelated-provider': { type: 'api_key', key: 'unrelated-secret' },
      }),
    );
    writeFileSync(
      join(seed, 'neon-pilot-runtime', 'models.json'),
      JSON.stringify({
        providers: {
          'opencode-go': {
            baseUrl: 'https://example.test/v1',
            api: 'openai-completions',
            apiKey: 'shell:security find-generic-password',
            headers: { Authorization: 'secret-header' },
            models: [
              {
                id: 'glm-5.1',
                name: 'GLM 5.1',
                contextWindow: 1000000,
                headers: { 'X-Secret': 'model-secret' },
              },
            ],
          },
          'unrelated-provider': {
            apiKey: 'unrelated-config-secret',
            models: [{ id: 'unrelated-model' }],
          },
        },
      }),
    );
    writeFileSync(
      join(seed, 'neon-pilot-runtime', 'settings.json'),
      JSON.stringify({
        defaultProvider: 'test-provider',
        defaultModel: 'test-model',
        packages: ['/machine/package'],
        extensions: ['/machine/extension'],
        skills: ['/machine/skill'],
        prompts: ['machine prompt'],
      }),
    );
    writeFileSync(join(seed, 'neon-pilot-runtime', 'AGENTS.md'), 'untrusted machine instructions\n');
    writeFileSync(join(seed, 'neon-pilot-runtime', 'APPEND_SYSTEM.md'), 'untrusted prompt suffix\n');
    writeFileSync(join(seed, 'neon-pilot-runtime', 'mcp_servers.json'), '{"servers":[]}\n');

    execFileSync(
      process.execPath,
      ['scripts/bundled-extension-authoring-eval.mjs', '--dry-run', '--case=eq-bundled-page', `--out=${out}`, `--seed-state-root=${seed}`],
      { cwd: new URL('..', import.meta.url) },
    );

    const summary = JSON.parse(readFileSync(join(out, 'summary.json'), 'utf8'));
    expect(summary.provenance.seedInputs).toEqual([
      expect.objectContaining({
        relative: 'secrets.index.json',
        sanitizedEntries: ['provider:opencode-go:apiKey'],
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      }),
      expect.objectContaining({
        relative: 'neon-pilot-runtime/auth.json',
        destinationClass: 'runtime-state',
        sanitizedProvider: 'opencode-go',
        credentialSource: 'dry-run-placeholder',
      }),
      expect.objectContaining({
        relative: 'neon-pilot-runtime/models.json',
        destinationClass: 'runtime-config',
        sanitizedProvider: 'opencode-go',
        sanitizedModel: 'glm-5.1',
      }),
      expect.objectContaining({
        relative: 'neon-pilot-runtime/settings.json',
        destinationClass: 'runtime-config',
        sanitizedKeys: ['defaultProvider', 'defaultModel'],
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      }),
    ]);
    expect(JSON.stringify(summary)).not.toContain('test-provider-secret');
    expect(JSON.stringify(summary)).not.toContain('unrelated-secret');
    expect(JSON.stringify(summary)).not.toContain('secret-header');
    expect(JSON.stringify(summary)).not.toContain('security find-generic-password');
    expect(existsSync(summary.provenance.isolatedStateRoot)).toBe(false);
    expect(existsSync(join(out, 'isolated-state', 'neon-pilot-runtime', 'auth.json'))).toBe(false);
  });

  it('rejects runtime paths outside the benchmark-owned temporary root', () => {
    const out = mkdtempSync(join(tmpdir(), 'bundled-authoring-external-state-test-'));
    tempRoots.push(out);
    expect(() =>
      execFileSync(
        process.execPath,
        [
          'scripts/bundled-extension-authoring-eval.mjs',
          '--dry-run',
          '--case=eq-bundled-page',
          `--out=${out}`,
          `--state-root=${join(out, 'state')}`,
        ],
        { cwd: new URL('..', import.meta.url), stdio: 'pipe' },
      ),
    ).toThrow();
  });
});
