# Web Fetch Extension

This extension owns the `web_fetch` agent tool.

## Tools

| Tool        | Parameters    | Description                                |
| ----------- | ------------- | ------------------------------------------ |
| `web_fetch` | `url`, `raw?` | Fetch a URL and extract readable markdown. |

## Web Fetch

Reads a URL and extracts clean markdown content with Mozilla Readability.

```bash
web_fetch(url: "https://example.com/docs/api")
```

Set `raw: true` to return raw HTML/text instead of extracted markdown. Non-HTML responses are returned as raw text.

### Content limits

| Limit      | Default | Description            |
| ---------- | ------- | ---------------------- |
| `maxBytes` | 50 KB   | Maximum response size  |
| `maxLines` | 2000    | Maximum response lines |

Content beyond these limits is truncated, and the tool reports truncation details.

Search tools live in separate system extensions:

- `system-duckduckgo-search` contributes `web_search`.
- `system-exa-search` is installable and contributes `web_search` with an Exa API key secret when installed.
