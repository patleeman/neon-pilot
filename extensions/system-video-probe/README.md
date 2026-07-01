# System Video Probe

Bundled system extension that gives agents deterministic tools for local video attachments. The desktop host stores only path-backed metadata for composer video attachments; this extension resolves those `videoId`s through `@neon-pilot/extensions/backend/videos`.

For ordinary questions about video content, agents should use `probe_media` from the Multimedia Probe extension. `probe_media` samples video frames, optionally transcribes audio, and sends the media to the configured vision model in one step. The tools here are lower-level helpers for deterministic extraction, timestamp checks, or transcript-only workflows.

Tools:

- `extract_video_frame`: extract a single screenshot at `timeSec`.
- `sample_video_frames`: sample screenshots between `startSec` and `endSec`.
- `transcribe_video`: transcribe the video's audio track, optionally over a timestamp range. Transcript segment timestamps are absolute to the original video.

Video bytes are not copied into extension storage. The host keeps the user's original local path and uses temporary files only for generated frames or extracted audio.
