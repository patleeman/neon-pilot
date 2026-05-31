# DS4 extension

DeepSeek V4 Flash local model profile for [`antirez/ds4`](https://github.com/antirez/ds4).

Enable this extension after building or installing it. On enable it installs a `ds4` model provider that points at the upstream default server endpoint:

```sh
./ds4-server --ctx 100000 --kv-disk-dir /tmp/ds4-kv --kv-disk-space-mb 8192
```

The provider model is `ds4/deepseek-v4-flash`, served from `http://127.0.0.1:8000/v1` with API key `dsv4-local`, matching the Pi config documented by ds4.

When that model is selected, the extension activates DS4-compatible tool schemas for `bash`, `read`, `more`, `write`, `edit`, and `search`. The tools route through Neon Pilot host boundaries rather than importing core or desktop internals.
