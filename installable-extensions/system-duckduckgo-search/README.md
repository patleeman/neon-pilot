# DuckDuckGo Search Extension

This installable extension owns the `web_search` agent web search tool. It uses DuckDuckGo's HTML search page rather than a search API.

## Tool

| Tool         | Parameters                          | Description                                     |
| ------------ | ----------------------------------- | ----------------------------------------------- |
| `web_search` | `query`, `count?` (max 20), `page?` | Agent web search using DuckDuckGo's HTML page. |

Scrapes `https://html.duckduckgo.com/html/` and falls back to `https://lite.duckduckgo.com/lite/` when the HTML page yields no parsed results.

## Search parameters

| Parameter | Type   | Default  | Description                |
| --------- | ------ | -------- | -------------------------- |
| `query`   | string | required | Search query               |
| `count`   | number | 5        | Number of results (max 20) |
| `page`    | number | 1        | Page number for pagination |
