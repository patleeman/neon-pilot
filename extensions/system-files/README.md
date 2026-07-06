# Files Extension

This extension owns the product behavior documented below. Keep extension-specific user and agent docs here so the implementation and documentation move together.

---

# File Explorer

The File Explorer is a file tree browser in a workbench tab-local rail. It provides quick access to project and knowledge files alongside the active surface.

## Opening the Explorer

Open a File Explorer workbench tab to browse the project directory tree. The file tree lives in that tab's rail, and selected files open in the same tab's detail area.

File Explorer requires a working directory (the desktop root or a project folder). If no working directory is set, the rail shows an empty state explaining that a folder or project is needed before files can appear.

## Navigation

- **Expand** — click a folder to expand its contents
- **Select** — click a file to open it in the workbench detail pane
- **Edit** — text files open in a CodeMirror editor and autosave changes back to disk
- **Right-click** — context menu with file operations such as New File, New Folder, Open in Finder, Rename, Move, and Delete

The tree follows the filesystem. Directories that match common ignore patterns (node_modules, .git) may be excluded from the view.

## Integration with the Composer

### @-references

Type `@` in the composer to open a fuzzy-search overlay. Start typing a filename and matching files from the workspace appear. Select one to insert a file reference that the agent can read.

### Transcript path links

Existing plain file paths in conversation messages render as links after the workspace validates them. Workspace-relative paths open the File Explorer in Workbench with that file selected by default. Absolute paths inside the conversation workspace are converted to workspace-relative paths before opening; existing absolute paths outside the workspace fall back to the desktop shell path opener.

Set `systemFiles.transcriptPathLinkTarget` to `desktop` to open validated transcript path links with the desktop shell opener instead of the Workbench File Explorer.

### Drag and drop

Drag files from the File Explorer into the composer to attach them to the message. The file content is included in the prompt.

## File Picker Dialog

The file picker is a modal dialog for selecting files. It supports:

- Directory navigation
- File type filtering
- Multi-select
- Recent files list

Used by checkpoints (file selection), project setup, and other file-related operations.

## Folder Picker Dialog

The folder picker is a modal dialog for selecting directories. Used for:

- Checkpoint scope selection
- Change working directory target
- Project root selection

## Workspace Explorer

The workspace explorer shows the full project directory tree. It combines:

- Workspace files (local filesystem)
- Knowledge files (knowledge base)
- Project files (when a project is active)

The tree updates when files are created, modified, or deleted outside the app.
