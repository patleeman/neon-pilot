import { createRequire as __paExtensionCreateRequire } from "node:module"; const require = __paExtensionCreateRequire(import.meta.url);

// extensions/system-documents-reader-sample/src/backend.ts
var SHARED_OWNER = "system-documents-counter-sample";
var SHARED_COLLECTION = "shared-heartbeat";
var BEAT_ID = "beat";
var receivedEvents = [];
function _resetReceivedEventsForTests() {
  receivedEvents.length = 0;
}
async function readBeat(_input, ctx) {
  const doc = await ctx.documents.getDocument({ owner: SHARED_OWNER, collection: SHARED_COLLECTION, id: BEAT_ID });
  return { document: doc };
}
async function getEvents(_input) {
  return { events: [...receivedEvents] };
}
function onDocumentChanged(input) {
  const payload = input.payload;
  if (!payload || typeof payload !== "object") return;
  if (payload.type !== "document.updated" && payload.type !== "document.deleted") return;
  if (payload.owner !== SHARED_OWNER) return;
  if (payload.collection !== SHARED_COLLECTION) return;
  receivedEvents.push({ ...payload });
}
export {
  _resetReceivedEventsForTests,
  getEvents,
  onDocumentChanged,
  readBeat
};
