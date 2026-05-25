# Code Mode

Code Mode replaces the model-visible tool surface with a single JavaScript execution tool, `exec_code`.

Inside `exec_code`, built-in coding tools and manifest-declared extension tools are exposed as async functions on `tools.<name>()`. The runtime also exposes `listTools()` and `describeTool(name)` so agents can discover tool names, descriptions, and input schemas without each tool being independently model-callable.

This extension owns the workflow UX. Core owns the shared tool boundary used to invoke extension tools by name.
