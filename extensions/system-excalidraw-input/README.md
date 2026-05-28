# Excalidraw input extension

Provides the composer drawing tool and Workbench drawing panel as a system extension.

The extension contributes a composer input tool that opens an Excalidraw modal and returns a serialized scene plus PNG preview to the host composer. For existing conversations, the editor can also save the drawing as a conversation attachment. The lightweight button loads first; the Excalidraw editor, styles, and export stack are split into lazy chunks loaded only when the modal opens.

The extension also contributes a Workbench drawing tab. Opening the drawing surface creates a drawing editor inside that tab, so drawings do not depend on a companion right rail. Saving from the Workbench editor persists the drawing to the active conversation when one is available; attaching publishes the drawing payload back to the composer through the extension event channel.
