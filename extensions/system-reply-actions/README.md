# Reply Actions

System Reply Actions owns transcript selection reply starters.

It contributes selection actions for the transcript context menu. Core provides the reusable selection/composer surface; this extension owns the product opinions like emoji draft starters.

## Settings

- `systemReplyActions.emojiPickerItems` — emoji reply starters for the transcript selection picker. Settings renders this as separate emoji and label fields, then stores the value as comma-separated `emoji label` items for the selection action contribution. Each item is used as both the button label and the drafted reply text. Empty items are ignored; remove every row to hide the emoji starter buttons.
