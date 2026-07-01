# Context and attachments

Neon Pilot conversations can include files, folders, images, PDFs, videos, screenshots, and extension-provided context. The agent sees this context alongside your message and the conversation history.

## Reference files with `@`

Type `@` in the composer to search files and other available context.

Select an item to insert a reference. When you send the message, Neon Pilot adds that referenced content to the agent's context.

Example:

```text
@src/auth.ts Review this file and suggest one simplification.
```

Use file references when you want the agent to focus on specific files instead of scanning a whole folder.

## Attach files and folders

Use the attachment button or drag files into the composer.

Attach a folder when the agent needs broader project context. Attach individual files when you want a narrower review.

Good uses:

- ask for a bug fix in a local project;
- summarize a document;
- compare two files;
- review a screenshot or design;
- ask the agent to update docs from a folder of source files.

## Attach images

Paste or drag images into the composer.

Image-capable models can inspect images directly. Text-only models may use Neon Pilot's local image probe tools when a vision model is configured.

Use images for:

- UI feedback;
- visual bug reports;
- screenshots of errors;
- diagrams or sketches;
- generated assets you want the agent to inspect.

## Attach videos

Attach videos when the agent needs to inspect a recording. Neon Pilot stores video references locally and exposes tools for frame sampling and transcription when available.

Use videos for:

- reproducing UI bugs;
- reviewing animations;
- inspecting screen recordings;
- extracting notes from recorded walkthroughs.

## Use standing instructions

Neon Pilot can include standing instructions from project files such as `AGENTS.md`, from configured local instruction files, and from extension-provided context.

Use standing instructions for durable preferences and project rules. Use conversation attachments for context that belongs only to the current thread.

## Context priority

When several context sources apply, the current message is usually the most specific instruction. Use clear wording in the prompt when a file or screenshot should override older context.

In practice:

- put the task in the message;
- attach only the files the task needs;
- use `@` references for the most important files;
- keep durable instructions short and stable.

## Privacy and locality

Context is stored locally by Neon Pilot. Model providers receive the prompt and context needed for the request you send to them.

If a file should not be sent to a model provider, do not attach or reference it in the prompt.

## Related pages

- [Conversations](conversations.md)
- [Providers and models](providers-and-models.md)
- [Local data and permissions](sandboxing.md)
