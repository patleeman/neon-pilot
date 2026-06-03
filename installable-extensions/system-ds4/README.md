# DS4 extension

DeepSeek V4 Flash local model profile for [`antirez/ds4`](https://github.com/antirez/ds4).

Enable this extension after building or installing it. On enable it installs a `ds4` model provider that points at the upstream default server endpoint used by the managed runtime:

```sh
./ds4-server --ctx 1000000 --kv-disk-dir /tmp/ds4-kv --kv-disk-space-mb 8192
```

The provider model is `ds4/deepseek-v4-flash`, served from `http://127.0.0.1:8000/v1` with API key `dsv4-local`, matching the Pi config documented by ds4.

The extension owns DS4 runtime setup. It does not assume `ds4` is already installed on the machine. Use the backend action `ds4BootstrapRuntime` to clone `https://github.com/antirez/ds4`, build `ds4-server`, and download the recommended `q2-imatrix` DeepSeek V4 Flash GGUF into extension-owned app storage. The action runs in the background because the model is about 81 GB. Use `ds4Status` to inspect bootstrap progress and `ds4StartServer` / `ds4StopServer` to manage the local server. When the DS4 model profile is selected for a conversation, Neon Pilot invokes `ds4StartServer` before sending the model request; if the runtime has not been bootstrapped yet, the startup error tells the user to run `ds4BootstrapRuntime`.

The extension settings include an advanced config section for context window, max response tokens, KV disk cache size, and DS4 context intervention toggles. The default context window is 1,000,000 tokens, matching DeepSeek V4 Flash's advertised context support; lower it when local runtime resources are constrained. Context and KV cache changes are applied to the managed `ds4-server` launch after restart; model metadata and prompt/session intervention settings are refreshed when settings are saved.

When that model is selected, the extension keeps the live tool set to `bash`, `read`, and `edit`. Typical non-core tool affordances, including subagents, are intentionally offloaded to the `ds4` CLI that the extension adds to DS4 bash sessions, keeping the prompt and tool schema surface small and prompt-cache stable.

RTK shell output compression is enabled by default for DS4 when the installed binary verifies with `rtk gain`. The extension automatically prefixes simple supported DS4 bash commands with `rtk` for compact output, falls back to raw shell output when RTK is unavailable, and exposes `ds4 compression off` / `ds4 compression rtk` as the session escape hatch. It does not run `rtk init` or patch global agent hooks.
