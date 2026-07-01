# Composer Attachments

System extension that owns the visible composer attachment control. Core still owns the hidden file input and file ingestion plumbing for images, drawings, videos, audio, and documents; this extension calls `openFilePicker()` through the composer control context.

Attachments prepared by the composer flow into the conversation prompt payload as stable typed inputs. The multimedia probe extension can then resolve image, video, audio, and document ids through host-owned backend APIs without importing app internals.
