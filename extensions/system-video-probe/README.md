# System Video Probe

Bundled system extension that gives agents deterministic tools for local video attachments. The desktop host stores only path-backed metadata for composer video attachments; this extension resolves those `videoId`s through `@neon-pilot/extensions/backend/videos`.

Tools:

- `extract_video_frame`: extract a single screenshot at `timeSec`.
- `sample_video_frames`: sample screenshots between `startSec` and `endSec`.
- `transcribe_video`: transcribe the video's audio track, optionally over a timestamp range. Transcript segment timestamps are absolute to the original video.

Video bytes are not copied into extension storage. The host keeps the user's original local path and uses temporary files only for generated frames or extracted audio.
