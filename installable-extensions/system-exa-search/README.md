# Exa Search Extension

This installable extension owns the `web_search` agent web search tool and the Exa API key secret.

## Tool

| Tool         | Parameters                          | Description                         |
| ------------ | ----------------------------------- | ----------------------------------- |
| `web_search` | `query`, `count?` (max 20), `page?` | Agent web search using Exa results. |

## Configuration

Set the secret in Settings for **Exa Search → Exa API key**, or provide `EXA_API_KEY` in the environment.

## Search parameters

| Parameter | Type   | Default  | Description                |
| --------- | ------ | -------- | -------------------------- |
| `query`   | string | required | Search query               |
| `count`   | number | 5        | Number of results (max 20) |
| `page`    | number | 1        | Page number for pagination |
