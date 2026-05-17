# Suggested Context

Suggests related past conversations as pointer-only context before a new prompt starts.

This system extension owns the new-conversation panel UI for suggested context. Core still owns the generic conversation ranking and prompt-injection plumbing: selected related conversation IDs are sent with the prompt, then the live-session server converts them into `related_conversation_pointers` internal context only while seeding an empty conversation.

Injected pointer context is intentionally compact: one warning line plus one line per conversation. Automatic suggestions default to three pointers; manually selected threads can include up to five. Each line includes the title, cached preview when available, and conversation ID for `conversation_inspect`; debug ranking fields such as workspace, timestamp, source, relevance score, and match reasons stay out of the prompt.
