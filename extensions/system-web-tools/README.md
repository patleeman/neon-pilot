# Web Fetch Extension

This extension owns the `web.fetch` agent tool.

## Tools

| Tool        | Parameters    | Description                                |
| ----------- | ------------- | ------------------------------------------ |
| `web.fetch` | `url`, `raw?` | Fetch a URL and extract readable markdown. |

## Web Fetch

Reads a URL and extracts clean markdown content with Mozilla Readability.

```bash
web.fetch(url: "https://example.com/docs/api")
```

Set `raw: true` to return raw HTML/text instead of extracted markdown. Non-HTML responses are returned as raw text.

### Content limits

| Limit      | Default | Description            |
| ---------- | ------- | ---------------------- |
| `maxBytes` | 50 KB   | Maximum response size  |
| `maxLines` | 2000    | Maximum response lines |

Content beyond these limits is truncated, and the tool reports truncation details.

Search tools live in separate system extensions:

- `system-duckduckgo-search` contributes `web.search`.
- `system-exa-search` contributes `web.search` and owns the Exa API key secret.
