#!/usr/bin/env node
/* eslint-env node */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultModels = ['opencode-go/qwen3.6-plus', 'opencode-go/mimo-v2.5', 'opencode-go/kimi-k2.5'];

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

function firstArg(names, fallback = '') {
  for (const name of names) {
    const value = arg(name);
    if (value) return value;
  }
  return fallback;
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

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function readText(file) {
  return readFileSync(file, 'utf8');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function readModels() {
  return unique(
    arg('models', defaultModels.join(','))
      .split(',')
      .map((model) => model.trim()),
  );
}

function normalizeMimeType(file) {
  const lower = file.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/png';
}

function readImageInput(file) {
  const absolute = resolve(file);
  const data = readFileSync(absolute).toString('base64');
  return {
    type: 'input_image',
    image_url: `data:${normalizeMimeType(absolute)};base64,${data}`,
    detail: 'high',
  };
}

function readChatImageInput(file) {
  const absolute = resolve(file);
  const data = readFileSync(absolute).toString('base64');
  return {
    type: 'image_url',
    image_url: {
      url: `data:${normalizeMimeType(absolute)};base64,${data}`,
      detail: 'high',
    },
  };
}

function screenshotItemsFromSummary(summary) {
  const items = [
    ...(Array.isArray(summary.baseline) ? summary.baseline : []),
    ...(Array.isArray(summary.generated) ? summary.generated : []),
  ];
  return items
    .map((item) => ({
      route: typeof item?.route === 'string' ? item.route : '',
      variant: typeof item?.variant === 'string' ? item.variant : '',
      path: typeof item?.judgeScreenshot === 'string' ? item.judgeScreenshot : typeof item?.screenshot === 'string' ? item.screenshot : '',
    }))
    .filter((item) => item.route && item.path);
}

function imageInputsForCapture(captureDir) {
  const summaryPath = resolve(captureDir, 'visual-capture-summary.json');
  if (!existsSync(summaryPath)) throw new Error(`Missing visual capture summary: ${summaryPath}`);
  const summary = readJson(summaryPath);
  const items = screenshotItemsFromSummary(summary);
  if (items.length === 0) throw new Error(`No screenshots found in ${summaryPath}`);
  for (const item of items) {
    if (!existsSync(item.path)) throw new Error(`Screenshot not found for ${item.route}: ${item.path}`);
  }
  return { summary, items, images: items.map((item) => readImageInput(item.path)) };
}

function buildPrompt(captureDir, items) {
  const promptPath = resolve(captureDir, arg('prompt', 'visual-judge-prompt.md'));
  const prompt = existsSync(promptPath) ? readText(promptPath) : '';
  const imageList = items
    .map((item, index) => `${index + 1}. ${item.route}${item.variant ? ` [${item.variant}]` : ''}: ${item.path}`)
    .join('\n');
  return [
    prompt || '# Extension Visual Eval Judge Prompt',
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

export function buildInferenceRequest(model, captureDir, api = 'openai-responses') {
  const { summary, items, images } = imageInputsForCapture(captureDir);
  const prompt = buildPrompt(captureDir, items);
  if (api === 'openai-completions') {
    return {
      model,
      messages: [
        {
          role: 'system',
          content:
            'Judge the attached UI screenshots and return only one strict JSON object matching the requested rubric. Do not include analysis or Markdown.',
        },
        {
          role: 'user',
          content: [{ type: 'text', text: prompt }, ...items.map((item) => readChatImageInput(item.path))],
        },
      ],
      temperature: 0,
      max_tokens: numberArg('max-output-tokens', 4000),
      response_format: { type: 'json_object' },
    };
  }
  return {
    model,
    input: [
      {
        role: 'user',
        content: [{ type: 'input_text', text: prompt }, ...images],
      },
    ],
    temperature: 0,
    max_output_tokens: numberArg('max-output-tokens', 4000),
    metadata: {
      eval: 'extension-visual-judge',
      calibrationTarget: summary.calibrationTarget,
      extensionId: summary.extensionId,
      screenshotCount: images.length,
    },
  };
}

export function responseText(response) {
  const chatContent = response?.choices?.[0]?.message?.content;
  if (typeof chatContent === 'string') return chatContent.trim();
  if (Array.isArray(chatContent)) {
    return chatContent
      .map((item) => (typeof item?.text === 'string' ? item.text : ''))
      .filter(Boolean)
      .join('\n')
      .trim();
  }
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

async function postInference(baseUrl, apiKey, api, body, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const endpoint = api === 'openai-completions' ? '/chat/completions' : '/responses';
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}${endpoint}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${endpoint} returned ${response.status}: ${text}`);
    return text ? JSON.parse(text) : {};
  } finally {
    clearTimeout(timeout);
  }
}

function safeModelFileName(model) {
  return model.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-|-$/g, '') || 'model';
}

export function aggregateResults(results) {
  const usable = results.filter((result) => result.status === 'pass' && result.judge?.imageAccess === true);
  const failures = results.filter(
    (result) =>
      result.status !== 'pass' ||
      result.judge?.imageAccess !== true ||
      result.judge?.decision === 'fail' ||
      (Array.isArray(result.judge?.mustFix) && result.judge.mustFix.length > 0),
  );
  return {
    models: results.map((result) => result.model),
    usableVisualJudges: usable.map((result) => result.model),
    decision:
      usable.length === results.length &&
      usable.length > 0 &&
      usable.every(
        (result) => result.judge?.decision === 'pass' && (!Array.isArray(result.judge?.mustFix) || result.judge.mustFix.length === 0),
      )
        ? 'pass'
        : failures.length > 0
          ? 'fail'
          : 'borderline',
    results: results.map((result) => ({
      model: result.model,
      status: result.status,
      imageAccess: result.judge?.imageAccess ?? false,
      decision: result.judge?.decision ?? 'fail',
      overall: result.judge?.overall ?? 1,
      mustFix: Array.isArray(result.judge?.mustFix) ? result.judge.mustFix : [],
      error: result.error,
    })),
  };
}

export async function runVisualJudges() {
  const captureDir = resolve(repoRoot, firstArg(['capture', 'capture-dir'], 'artifacts/extension-quality/settings-calibration'));
  const outDir = resolve(arg('out', resolve(captureDir, 'visual-judges')));
  const baseUrl = arg('base-url', process.env.MODEL_GATEWAY_BASE_URL ?? 'http://127.0.0.1:8766/v1');
  const apiKey = arg('api-key', process.env.MODEL_GATEWAY_API_KEY ?? 'visual-judge');
  const models = readModels();
  const api = arg('api', 'openai-responses');
  const timeoutMs = numberArg('timeout-ms', 300000);
  const dryRun = boolArg('dry-run');

  mkdirSync(outDir, { recursive: true });
  const results = [];
  for (const model of models) {
    const request = buildInferenceRequest(model, captureDir, api);
    const requestPath = resolve(outDir, `${safeModelFileName(model)}.request.json`);
    if (dryRun) {
      write(requestPath, `${JSON.stringify({ ...request, input: '[omitted image payloads in dry-run summary]' }, null, 2)}\n`);
      results.push({ model, status: 'dry-run', judge: { imageAccess: false, decision: 'fail', overall: 1 } });
      continue;
    }
    try {
      const response = await postInference(baseUrl, apiKey, api, request, timeoutMs);
      write(resolve(outDir, `${safeModelFileName(model)}.response.json`), `${JSON.stringify(response, null, 2)}\n`);
      const text = responseText(response);
      write(resolve(outDir, `${safeModelFileName(model)}.txt`), `${text}\n`);
      const judge = parseJudgeJson(text);
      write(resolve(outDir, `${safeModelFileName(model)}.json`), `${JSON.stringify(judge, null, 2)}\n`);
      results.push({ model, status: 'pass', judge });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const judge = {
        judge: model,
        imageAccess: false,
        overall: 1,
        decision: 'fail',
        scores: {},
        failureTags: ['judge_runner_error'],
        topFindings: [message],
        mustFix: ['Fix the direct image-input judge runner or model gateway call before trusting this judge.'],
      };
      write(resolve(outDir, `${safeModelFileName(model)}.json`), `${JSON.stringify(judge, null, 2)}\n`);
      results.push({ model, status: 'error', error: message, judge });
    }
  }
  const aggregate = aggregateResults(results);
  write(resolve(outDir, 'aggregate.json'), `${JSON.stringify(aggregate, null, 2)}\n`);
  console.log(JSON.stringify({ captureDir, outDir, baseUrl, dryRun, ...aggregate }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runVisualJudges().catch((error) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exit(1);
  });
}
