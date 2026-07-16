# Agent

The Agent system extension owns Neon Pilot's singleton Agent application. Chat and conversations remain internal to the application; other first-party extensions contribute Agent pages through the qualified `system-agent:agent` application id and named navigation slots.

The extension uses public host components and manifest contributions only. It must not import desktop or core runtime modules. Agent destinations render as one flat navigation list; named slots preserve contribution ordering without adding redundant section headers.
