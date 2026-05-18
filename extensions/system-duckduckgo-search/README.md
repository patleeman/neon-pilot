# DuckDuckGo Search Extension

This extension owns the `web.search` agent tool.

## Tool

| Tool         | Parameters                          | Description                            |
| ------------ | ----------------------------------- | -------------------------------------- |
| `web.search` | `query`, `count?` (max 20), `page?` | Scrape DuckDuckGo HTML search results. |

Scrapes `https://html.duckduckgo.com/html/` and falls back to `https://lite.duckduckgo.com/lite/` when the HTML page yields no parsed results.

## Search parameters

| Parameter | Type   | Default  | Description                |
| --------- | ------ | -------- | -------------------------- |
| `query`   | string | required | Search query               |
| `count`   | number | 5        | Number of results (max 20) |
| `page`    | number | 1        | Page number for pagination |
