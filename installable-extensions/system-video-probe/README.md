# Video Probe

Analyze video files using a video-capable model. The agent calls `probe_video` with a file path and a question; the extension handles encoding and model dispatch.

## Backends

### OpenRouter (default)

Calls the OpenRouter API with any video-capable model. Requires an OpenRouter key configured in Settings → Providers or `OPENROUTER_API_KEY`.

**Setup:**

1. Configure OpenRouter in Settings → Providers (or set `OPENROUTER_API_KEY`)
2. Settings → Video Probe → Backend: OpenRouter
3. Optionally change the model (default: `google/gemini-2.5-flash`)

Good video-capable models on OpenRouter:

- `google/gemini-2.5-flash` — fast, cheap, excellent video support
- `google/gemini-2.5-pro` — best quality
- `qwen/qwen3.5-72b` — strong open model option

### Local mlx-vlm (Apple Silicon)

Runs [Nemotron 3 Nano Omni](https://huggingface.co/nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-BF16) locally via [mlx-vlm](https://github.com/Blaizzy/mlx-vlm). 30B total / 3B active MoE model with native video, image, and audio understanding. Fast on Apple Silicon due to 4-bit quantization and unified memory.

**Setup:**

```bash
pip install -U mlx-vlm

# Start the server (downloads model on first run, ~18GB)
python -m mlx_vlm.server \
  --model mlx-community/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-nvfp4 \
  --port 8000
```

Then in Settings → Video Probe → Backend: Local mlx-vlm.

## Tool usage

The agent calls this automatically when you reference a video file:

```
What's happening in /path/to/recording.mp4?
Summarize the content of ~/Desktop/demo.webm
```

## Notes

- Video files are base64-encoded and sent to the model. Large files (>100MB) may be slow or hit provider limits.
- For the local backend, the mlx-vlm server must be running before invoking the tool.
- Supported formats: mp4, mov, avi, mkv, webm, mpg, mpeg, m4v, 3gp, wmv, flv
