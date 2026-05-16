import type { ExtensionBackendContext } from '@personal-agent/extensions';

import * as gguf from '../../llama-cpp/src/backend';
import * as mlx from '../../qwen-mlx/src/backend';

export async function status(input: unknown, ctx: ExtensionBackendContext) {
  const [mlxStatus, ggufStatus] = await Promise.all([mlx.status(input, ctx), gguf.runtimeStatus(input, ctx)]);
  return { ok: true, mlx: mlxStatus, gguf: ggufStatus };
}

export async function mlxSetModel(input: unknown, ctx: ExtensionBackendContext) {
  return mlx.setModel(input, ctx);
}

export async function mlxSetup(input: unknown, ctx: ExtensionBackendContext) {
  return mlx.setup(input, ctx);
}

export async function mlxStart(input: unknown, ctx: ExtensionBackendContext) {
  return mlx.start(input, ctx);
}

export async function mlxStop(input: unknown, ctx: ExtensionBackendContext) {
  return mlx.stop(input, ctx);
}

export async function mlxSearch(input: unknown, ctx: ExtensionBackendContext) {
  return mlx.searchModels(input, ctx);
}

export async function ggufDownload(input: unknown, ctx: ExtensionBackendContext) {
  return gguf.downloadModel(input as never, ctx);
}

export async function ggufSetModel(input: unknown, ctx: ExtensionBackendContext) {
  return gguf.setModel(input as never, ctx);
}

export async function ggufReveal(input: unknown, ctx: ExtensionBackendContext) {
  return gguf.revealModel(input as never, ctx);
}

export async function ggufStart(input: unknown, ctx: ExtensionBackendContext) {
  return gguf.startServer(input as never, ctx);
}

export async function ggufStop(input: unknown, ctx: ExtensionBackendContext) {
  return gguf.stopServer(input, ctx);
}

export async function ggufRunPrompt(input: unknown, ctx: ExtensionBackendContext) {
  return gguf.runPrompt(input as never, ctx);
}
