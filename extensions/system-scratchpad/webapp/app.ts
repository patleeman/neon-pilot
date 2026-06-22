import './style.css';

type ScratchpadState = {
  conversationId: string;
  content: string;
  updatedAt: string | null;
};

const params = new URLSearchParams(window.location.search);
const conversationId = params.get('conversationId')?.trim() ?? '';
const editor = document.querySelector<HTMLTextAreaElement>('#editor')!;
const meta = document.querySelector<HTMLSpanElement>('#meta')!;
const notice = document.querySelector<HTMLDivElement>('#notice')!;
const count = document.querySelector<HTMLSpanElement>('#count')!;
const conversation = document.querySelector<HTMLSpanElement>('#conversation')!;
const clearButton = document.querySelector<HTMLButtonElement>('#clear')!;
const revertButton = document.querySelector<HTMLButtonElement>('#revert')!;
const refreshButton = document.querySelector<HTMLButtonElement>('#refresh')!;

let saved = '';
let saving = false;
let autosaveTimer: number | null = null;
let saveRequestId = 0;

function setNotice(message: string | null, tone: 'info' | 'error' = 'info') {
  if (!message) {
    notice.hidden = true;
    notice.textContent = '';
    notice.dataset.tone = '';
    return;
  }
  notice.hidden = false;
  notice.textContent = message;
  notice.dataset.tone = tone;
}

function dirty() {
  return editor.value !== saved;
}

function updateControls() {
  count.textContent = `${editor.value.length.toLocaleString()} chars`;
  revertButton.disabled = saving || !dirty();
  clearButton.disabled = saving || !conversationId || editor.value.length === 0;
  if (saving) {
    meta.textContent = 'Saving...';
  } else if (dirty()) {
    meta.textContent = 'Unsaved changes';
  }
}

async function invoke<T>(actionId: string, input: unknown): Promise<T> {
  const response = await fetch(`/.neon/api/extensions/system-scratchpad/actions/${encodeURIComponent(actionId)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as { ok?: boolean; result?: T; error?: string };
  if (!response.ok || payload.ok === false) throw new Error(payload.error || `${response.status} ${response.statusText}`);
  return (payload.result ?? payload) as T;
}

function applyState(state: ScratchpadState) {
  saved = state.content ?? '';
  editor.value = saved;
  meta.textContent = state.updatedAt ? `Updated ${new Date(state.updatedAt).toLocaleString()}` : 'No saved notes';
  updateControls();
}

async function load() {
  if (!conversationId) {
    editor.disabled = true;
    meta.textContent = 'Open with ?conversationId=...';
    conversation.textContent = 'No conversation';
    setNotice('Scratchpad sidecars are scoped to one conversation.');
    updateControls();
    return;
  }

  editor.disabled = true;
  refreshButton.disabled = true;
  setNotice(null);
  try {
    applyState(await invoke<ScratchpadState>('getScratchpad', { conversationId }));
    conversation.textContent = conversationId;
  } catch (error) {
    setNotice(error instanceof Error ? error.message : String(error), 'error');
  } finally {
    editor.disabled = false;
    refreshButton.disabled = false;
    updateControls();
  }
}

async function save(content: string) {
  const requestId = ++saveRequestId;
  saving = true;
  updateControls();
  setNotice(null);
  try {
    const state = await invoke<ScratchpadState>('setScratchpad', { conversationId, content });
    if (saveRequestId !== requestId) return;
    saved = state.content ?? '';
    if (editor.value === content) {
      editor.value = saved;
    }
    meta.textContent = state.updatedAt ? `Updated ${new Date(state.updatedAt).toLocaleString()}` : 'No saved notes';
    updateControls();
    setNotice(content.trim() ? 'Saved' : 'Cleared');
  } catch (error) {
    if (saveRequestId !== requestId) return;
    setNotice(error instanceof Error ? error.message : String(error), 'error');
  } finally {
    if (saveRequestId === requestId) {
      saving = false;
      updateControls();
    }
  }
}

function scheduleAutosave() {
  updateControls();
  setNotice(null);
  if (autosaveTimer !== null) {
    window.clearTimeout(autosaveTimer);
  }
  if (!conversationId || !dirty()) return;
  autosaveTimer = window.setTimeout(() => {
    autosaveTimer = null;
    void save(editor.value);
  }, 700);
}

editor.addEventListener('input', scheduleAutosave);
refreshButton.addEventListener('click', () => void load());
revertButton.addEventListener('click', () => {
  if (autosaveTimer !== null) {
    window.clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }
  editor.value = saved;
  setNotice(null);
  updateControls();
});
clearButton.addEventListener('click', () => void save(''));

void load();
