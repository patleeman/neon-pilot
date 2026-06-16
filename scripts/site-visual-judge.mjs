#!/usr/bin/env node
/* eslint-env node */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultModels = ['opencode-go/kimi-k2.5', 'opencode-go/mimo-v2.5', 'opencode-go/qwen3.6-plus'];

function arg(name, fallback = '') {
  const args = process.argv.slice(2).filter((value, index) => !(index === 0 && value === '--'));
  const exact = `--${name}`;
  const prefix = `${exact}=`;
  const found = args.find((value) => value.startsWith(prefix));
  if (found) return found.slice(prefix.length);
  const index = args.indexOf(exact);
  if (index < 0) return fallback;
  const next = args[index + 1];
  return next && !next.startsWith('--') ? next : 'true';
}

function boolArg(name) {
  return arg(name, 'false') === 'true';
}

function numberArg(name, fallback) {
  const value = Number(arg(name, String(fallback)));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function write(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text, 'utf8');
}

function normalizeMimeType(file) {
  const lower = file.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/png';
}

function readImageInput(file) {
  const absolute = resolve(file);
  return {
    type: 'input_image',
    image_url: `data:${normalizeMimeType(absolute)};base64,${readFileSync(absolute).toString('base64')}`,
    detail: 'high',
  };
}

function readModels() {
  return [
    ...new Set(
      arg('models', defaultModels.join(','))
        .split(',')
        .map((model) => model.trim())
        .filter(Boolean),
    ),
  ];
}

function imageInputsForCapture(captureDir) {
  const summaryPath = resolve(captureDir, 'visual-capture-summary.json');
  if (!existsSync(summaryPath)) throw new Error(`Missing visual capture summary: ${summaryPath}`);
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
  const items = Array.isArray(summary.captures) ? summary.captures : [];
  if (items.length === 0) throw new Error(`No captures found in ${summaryPath}`);
  for (const item of items) {
    const path = item.judgeScreenshot || item.screenshot;
    if (!path || !existsSync(path)) throw new Error(`Screenshot not found: ${path}`);
  }
  return { summary, items, images: items.map((item) => readImageInput(item.judgeScreenshot || item.screenshot)) };
}

function buildPrompt(captureDir, items) {
  const promptPath = resolve(captureDir, arg('prompt', 'visual-judge-prompt.md'));
  const prompt = existsSync(promptPath) ? readFileSync(promptPath, 'utf8') : '# Neonpilot.net Visual Eval Judge Prompt';
  const imageList = items
    .map(
      (item, index) =>
        `${index + 1}. ${item.route} ${item.viewport?.name ?? ''} ${item.variant}: ${item.judgeScreenshot || item.screenshot}`,
    )
    .join('\n');
  return [
    prompt,
    '',
    '## Direct Image Inputs',
    '',
    'The screenshots below are attached to this model call as actual image inputs. Do not use file-read tools or path inspection for visual scoring.',
    '',
    imageList,
    '',
    'Return strict JSON only. Set imageAccess=true only if you can inspect the attached images.',
  ].join('\n');
}

function buildResponsesRequest(model, captureDir) {
  const { summary, items, images } = imageInputsForCapture(captureDir);
  return {
    model,
    input: [{ role: 'user', content: [{ type: 'input_text', text: buildPrompt(captureDir, items) }, ...images] }],
    temperature: 0,
    max_output_tokens: numberArg('max-output-tokens', 4000),
    metadata: { eval: 'site-visual-judge', baseUrl: summary.baseUrl, screenshotCount: images.length },
  };
}

function responseText(response) {
  const chunks = [];
  for (const output of Array.isArray(response?.output) ? response.output : []) {
    for (const content of Array.isArray(output?.content) ? output.content : []) {
      if (typeof content?.text === 'string') chunks.push(content.text);
    }
  }
  return chunks.join('\n').trim();
}

function parseJudgeJson(text) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Judge returned empty text.');
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
    if (fenced?.[1]) return JSON.parse(fenced[1].trim());
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first >= 0 && last > first) return JSON.parse(trimmed.slice(first, last + 1));
    throw new Error(`Judge did not return JSON: ${trimmed.slice(0, 500)}`);
  }
}

async function postResponses(baseUrl, apiKey, body, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/responses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`/responses returned ${response.status}: ${text}`);
    return text ? JSON.parse(text) : {};
  } finally {
    clearTimeout(timeout);
  }
}

function safeModelFileName(model) {
  return model.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-|-$/g, '') || 'model';
}

function aggregateResults(results) {
  const usable = results.filter((result) => result.status === 'pass' && result.judge?.imageAccess === true);
  const failing = results.filter((result) => result.status !== 'pass' || result.judge?.decision === 'fail');
  return {
    models: results.map((result) => result.model),
    usableVisualJudges: usable.map((result) => result.model),
    decision:
      usable.length > 0 && usable.every((result) => result.judge?.decision === 'pass')
        ? 'pass'
        : failing.length > 0
          ? 'fail'
          : 'borderline',
    results: results.map((result) => ({
      model: result.model,
      status: result.status,
      imageAccess: result.judge?.imageAccess ?? false,
      decision: result.judge?.decision ?? 'fail',
      overall: result.judge?.overall ?? 1,
      error: result.error,
    })),
  };
}

async function runVisualJudges() {
  const captureDir = resolve(repoRoot, arg('capture', 'artifacts/site-quality/latest'));
  const outDir = resolve(arg('out', resolve(captureDir, 'visual-judges')));
  const baseUrl = arg('base-url', process.env.MODEL_GATEWAY_BASE_URL ?? 'http://127.0.0.1:8766/v1');
  const apiKey = arg('api-key', process.env.MODEL_GATEWAY_API_KEY ?? 'visual-judge');
  const timeoutMs = numberArg('timeout-ms', 300000);
  const dryRun = boolArg('dry-run');
  mkdirSync(outDir, { recursive: true });

  const results = [];
  for (const model of readModels()) {
    const request = buildResponsesRequest(model, captureDir);
    const requestFile = resolve(outDir, `${safeModelFileName(model)}.request.json`);
    write(requestFile, `${JSON.stringify(request, null, 2)}\n`);
    if (dryRun) {
      results.push({ model, status: 'dry-run', requestFile });
      continue;
    }
    try {
      const response = await postResponses(baseUrl, apiKey, request, timeoutMs);
      const rawText = responseText(response);
      let judge;
      try {
        judge = parseJudgeJson(rawText);
      } catch (error) {
        const result = { model, status: 'error', error: error instanceof Error ? error.message : String(error), rawText };
        results.push(result);
        write(resolve(outDir, `${safeModelFileName(model)}.error.json`), `${JSON.stringify(result, null, 2)}\n`);
        continue;
      }
      const result = { model, status: 'pass', judge, rawText };
      results.push(result);
      write(resolve(outDir, `${safeModelFileName(model)}.json`), `${JSON.stringify(result, null, 2)}\n`);
    } catch (error) {
      const result = { model, status: 'error', error: error instanceof Error ? error.message : String(error) };
      results.push(result);
      write(resolve(outDir, `${safeModelFileName(model)}.error.json`), `${JSON.stringify(result, null, 2)}\n`);
    }
  }

  const summary = aggregateResults(results);
  write(resolve(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

runVisualJudges().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
});
