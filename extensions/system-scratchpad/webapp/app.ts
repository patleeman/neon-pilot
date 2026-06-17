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
const saveButton = document.querySelector<HTMLButtonElement>('#save')!;
const clearButton = document.querySelector<HTMLButtonElement>('#clear')!;
const revertButton = document.querySelector<HTMLButtonElement>('#revert')!;
const refreshButton = document.querySelector<HTMLButtonElement>('#refresh')!;

let saved = '';
let saving = false;

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
  saveButton.disabled = saving || !conversationId || !dirty();
  revertButton.disabled = saving || !dirty();
  clearButton.disabled = saving || !conversationId || editor.value.length === 0;
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
  saving = true;
  updateControls();
  setNotice(null);
  try {
    applyState(await invoke<ScratchpadState>('setScratchpad', { conversationId, content }));
    setNotice(content.trim() ? 'Saved' : 'Cleared');
  } catch (error) {
    setNotice(error instanceof Error ? error.message : String(error), 'error');
  } finally {
    saving = false;
    updateControls();
  }
}

editor.addEventListener('input', updateControls);
refreshButton.addEventListener('click', () => void load());
revertButton.addEventListener('click', () => {
  editor.value = saved;
  setNotice(null);
  updateControls();
});
clearButton.addEventListener('click', () => void save(''));
saveButton.addEventListener('click', () => void save(editor.value));

void load();
