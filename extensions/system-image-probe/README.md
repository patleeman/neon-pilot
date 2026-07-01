# Multimedia Probe Extension

This extension lets the agent ask a configured vision model questions about images, screenshots, and sampled video frames attached to the current conversation.

## User-Facing Behavior

- Adds the `probe_media` tool for image and video analysis.
- Keeps the `probe_image` tool for image-only compatibility.
- Reads selected conversation image attachments by stable image id.
- Reads selected conversation video attachments by stable video id, samples frames, and optionally includes audio transcription.
- Sends the user's question plus the selected image attachments to the configured vision model.
- Adds a Multimedia Probe settings panel where users choose the vision model used for this fallback path.

Image generation and image editing are not owned by this extension. Those are provided by the Codex Compatibility extension through its `image` tool.

## Tool

`probe_media` accepts:

| Parameter      | Description                                                                |
| -------------- | -------------------------------------------------------------------------- |
| `imageIds`     | Optional conversation image ids to inspect.                                |
| `videoIds`     | Optional conversation video ids to inspect.                                |
| `question`     | The question to ask about the selected media.                              |
| `startSec`     | Optional start timestamp for video frame sampling and audio transcription. |
| `endSec`       | Optional end timestamp for video frame sampling and audio transcription.   |
| `frameCount`   | Optional number of frames to sample per video.                             |
| `includeAudio` | Optional boolean for audio transcription. Defaults to enabled.             |
| `language`     | Optional transcription language hint.                                      |

Use `probe_media` when the active chat model cannot see image or video attachments directly. For videos, prefer this tool over manually calling `sample_video_frames` and then `probe_image`; sampled video frame labels are not image attachment ids.

`probe_image` accepts:

| Parameter  | Description                                     |
| ---------- | ----------------------------------------------- |
| `imageIds` | One to eight conversation image ids to inspect. |
| `question` | The question to ask about the selected images.  |

Use this tool when the active chat model cannot see image attachments directly, or when the user wants a specific secondary vision model to inspect an image. Use `probe_media` for videos.

## QA Notes

- Verify video questions through `probe_media` with a text-only chat model.
- Verify missing, stale, and malformed image ids.
- Verify missing, stale, and malformed video ids.
- Verify single-image and multi-image questions.
- Verify single-video and image-plus-video questions.
- Verify the text-only model path explains that image analysis needs the configured vision model.
- Verify settings save and the selected vision model is used for subsequent probes.
