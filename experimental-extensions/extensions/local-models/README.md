# Local Models extension

Single workspace for local LLM runtimes:

- MLX Hugging Face models through `mlx_lm.server` on `http://127.0.0.1:8011/v1`.
- GGUF models through bundled `llama.cpp` binaries on `http://127.0.0.1:8012/v1`.

The page combines model library/search/download, prompt smoke testing, and runtime settings into one interface. The older `qwen-mlx` and `llama-cpp` pages are retained as implementation references but should not be primary navigation surfaces.
