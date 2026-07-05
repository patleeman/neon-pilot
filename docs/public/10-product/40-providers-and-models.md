# Providers and models

Neon Pilot lets you bring your own model provider. It uses the providers supported by Pi, so you can switch models without moving your work to a different agent harness.

## Configure a provider

Open **Settings**, then open the provider or model section.

Use this page to:

- choose the default provider and model for new conversations;
- add or update API keys;
- configure provider-specific options;
- choose model defaults such as reasoning level or service tier when available;
- add custom provider definitions when you use a compatible API.

## Bring your own API key

Neon Pilot does not require a hosted Neon Pilot account for model access. You use your own provider account and credentials.

Store keys through the app when possible. Do not paste API keys into messages, shell history, screenshots, or shared logs.

## Provider flexibility

Provider support follows Pi's provider layer. Depending on your local configuration and installed extensions, you can use hosted models, local runtimes, gateway providers, or custom OpenAI-compatible endpoints.

Use the model picker in the composer when you want a different model for one conversation. Use Settings when you want to change defaults.

## Model-specific extension behavior

Extensions can contribute model profiles. A model profile lets an enabled extension change tools, instructions, or runtime behavior for matching providers or models.

For example, an extension can expose a safer edit tool for one model family, add vision-specific tools for vision models, or prepare a local runtime before a request starts.

## Troubleshooting

If the agent does not reply:

1. Open **Settings** and confirm that a provider and model are selected.
2. Confirm that the provider key is present and valid.
3. Try a small prompt in a new conversation.
4. If you installed the CLI, run:

   ```bash
   neon-pilot bootstrap doctor
   ```

5. Check whether an extension-specific model profile is enabled or disabled if the issue only affects one model family.

## Related pages

- [Getting Started](getting-started.md)
- [Conversations](conversations.md)
- [Install with another agent](agent-bootstrap.md)
