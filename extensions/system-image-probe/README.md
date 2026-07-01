# Multimedia Probe Extension

This extension lets the agent ask questions about multimedia attachments in the current conversation. Images and sampled video frames are inspected by a configured vision model. Audio and documents are converted to text through host-owned transcription and extraction APIs so text-only models can still reason over them.

## User-Facing Behavior

- Adds the `probe_media` tool for image, video, audio, and document analysis.
- Keeps the `probe_image` tool for image-only compatibility.
- Reads selected conversation image attachments by stable image id.
- Reads selected conversation video attachments by stable video id, samples frames, and optionally includes audio transcription.
- Reads selected audio attachments by stable audio id and transcribes them through the existing audio backend.
- Reads selected document attachments by stable document id and extracts text from PDFs and common text/document formats.
- Sends the user's question plus visual attachments to the configured vision model when visual analysis is needed.
- Answers audio-only and document-only probes directly from extracted text, without requiring a vision model.
- Adds a Multimedia Probe settings panel where users choose the vision model used for this fallback path.

Image generation and image editing are not owned by this extension. Those are provided by the Codex Compatibility extension through its `image` tool.

## Tool

`probe_media` accepts:

| Parameter      | Description                                                                |
| -------------- | -------------------------------------------------------------------------- |
| `imageIds`     | Optional conversation image ids to inspect.                                |
| `videoIds`     | Optional conversation video ids to inspect.                                |
| `audioIds`     | Optional conversation audio ids to transcribe and inspect.                 |
| `documentIds`  | Optional conversation document ids to extract and inspect.                 |
| `question`     | The question to ask about the selected media.                              |
| `startSec`     | Optional start timestamp for video frame sampling and audio transcription. |
| `endSec`       | Optional end timestamp for video frame sampling and audio transcription.   |
| `frameCount`   | Optional number of frames to sample per video.                             |
| `includeAudio` | Optional boolean for audio transcription. Defaults to enabled.             |
| `language`     | Optional transcription language hint.                                      |

Use `probe_media` when the active chat model cannot see attachments directly. For videos, prefer this tool over manually calling `sample_video_frames` and then `probe_image`; sampled frames are also registered as image attachments, but `probe_media` keeps the video timeline, optional audio transcript, and user question in one call.

Document extraction currently uses the host runtime's local tools in priority order: plain-text readers for text-like files, `pdftotext` for PDFs, then optional CLI fallbacks such as `markitdown`, `pandoc`, or macOS `textutil` when installed. If no extractor supports a file, the probe reports a visible tool error instead of guessing.

`probe_image` accepts:

| Parameter  | Description                                     |
| ---------- | ----------------------------------------------- |
| `imageIds` | One to eight conversation image ids to inspect. |
| `question` | The question to ask about the selected images.  |

Use this tool when the active chat model cannot see image attachments directly, or when the user wants a specific secondary vision model to inspect an image. Use `probe_media` for videos.

## QA Notes

- Verify video questions through `probe_media` with a text-only chat model.
- Verify audio-only questions return transcript-grounded output without a configured vision model.
- Verify PDF/text document questions return extracted-text-grounded output without a configured vision model.
- Verify missing, stale, and malformed image ids.
- Verify missing, stale, and malformed video ids.
- Verify missing, stale, and malformed audio ids.
- Verify missing, stale, and malformed document ids.
- Verify single-image and multi-image questions.
- Verify single-video and image-plus-video questions.
- Verify mixed image, video, audio, and document questions include all selected context.
- Verify the text-only model path explains that image analysis needs the configured vision model.
- Verify settings save and the selected vision model is used for subsequent probes.
