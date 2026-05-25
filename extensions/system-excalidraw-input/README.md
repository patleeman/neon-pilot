# Excalidraw input extension

Provides the composer drawing tool and Workbench drawing panel as a system extension.

The extension contributes a composer input tool that opens an Excalidraw modal and returns a serialized scene plus PNG preview to the host composer. For existing conversations, the editor can also save the drawing as a conversation attachment. The lightweight button loads first; the Excalidraw editor, styles, and export stack are split into lazy chunks loaded only when the modal opens.

The extension also contributes a Workbench right-rail entry with a paired detail pane. The rail lists saved Excalidraw drawings for the active conversation, and the modal can move the active drawing into the Workbench pane. Saving from the Workbench editor persists the drawing into the right rail; attaching publishes the drawing payload back to the composer through the extension event channel.
