# DS4 extension

DeepSeek V4 Flash local model profile for [`antirez/ds4`](https://github.com/antirez/ds4).

Enable this extension after building or installing it. On enable it installs a `ds4` model provider that points at the upstream default server endpoint used by the managed runtime:

```sh
./ds4-server --ctx 100000 --kv-disk-dir /tmp/ds4-kv --kv-disk-space-mb 8192
```

The provider model is `ds4/deepseek-v4-flash`, served from `http://127.0.0.1:8000/v1` with API key `dsv4-local`, matching the Pi config documented by ds4.

The extension owns DS4 runtime setup. It does not assume `ds4` is already installed on the machine. Use the backend action `ds4BootstrapRuntime` to clone `https://github.com/antirez/ds4`, build `ds4-server`, and download the recommended `q2-imatrix` DeepSeek V4 Flash GGUF into extension-owned app storage. The action runs in the background because the model is about 81 GB. Use `ds4Status` to inspect bootstrap progress and `ds4StartServer` / `ds4StopServer` to manage the local server. When the DS4 model profile is selected for a conversation, Neon Pilot invokes `ds4StartServer` before sending the model request; if the runtime has not been bootstrapped yet, the startup error tells the user to run `ds4BootstrapRuntime`.

When that model is selected, the extension keeps the live tool set to `bash`, `read`, and `edit`. Extra DS4 affordances are exposed through the `ds4` CLI that the extension adds to DS4 bash sessions, keeping the prompt and tool schema surface small.

The settings panel can optionally enable RTK shell output compression. The extension verifies the installed binary with `rtk gain` to avoid the unrelated Rust Type Kit package, then teaches DS4 to prefer explicit `rtk ...` shell commands for compact output. It does not run `rtk init` or patch global agent hooks.
