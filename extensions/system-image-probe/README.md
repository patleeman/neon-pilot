# Image Questions Extension

This extension lets the agent ask a configured vision model questions about images and screenshots attached to the current conversation.

## User-Facing Behavior

- Adds the `probe_image` tool for image analysis.
- Reads selected conversation image attachments by stable image id.
- Sends the user's question plus the selected image attachments to the configured vision model.
- Adds an Image Questions settings panel where users choose the vision model used for this fallback path.

Image generation and image editing are not owned by this extension. Those are provided by the Codex Compatibility extension through its `image` tool.

## Tool

`probe_image` accepts:

| Parameter  | Description                                     |
| ---------- | ----------------------------------------------- |
| `imageIds` | One to eight conversation image ids to inspect. |
| `question` | The question to ask about the selected images.  |

Use this tool when the active chat model cannot see image attachments directly, or when the user wants a specific secondary vision model to inspect an image.

## QA Notes

- Verify missing, stale, and malformed image ids.
- Verify single-image and multi-image questions.
- Verify the text-only model path explains that image analysis needs the configured vision model.
- Verify settings save and the selected vision model is used for subsequent probes.
