import { createRequire as __paExtensionCreateRequire } from "node:module"; const require = __paExtensionCreateRequire(import.meta.url);

// extensions/system-data-tools/src/backend.ts
var pendingWatches = /* @__PURE__ */ new Set();
function cancelWatch(entry) {
  clearTimeout(entry.timer);
  pendingWatches.delete(entry);
}
async function dataList(input, ctx) {
  const collections = await ctx.documents.listCollections({
    ...input.owner ? { owner: input.owner } : {}
  });
  return { collections };
}
async function dataRead(input, ctx) {
  if (input.id) {
    const document = await ctx.documents.getDocument({ owner: input.owner, collection: input.collection, id: input.id });
    if (!document) {
      return { error: `Document "${input.owner}/${input.collection}/${input.id}" not found` };
    }
    return { document };
  }
  const limit = typeof input.limit === "number" && input.limit > 0 ? Math.min(input.limit, 1e3) : 100;
  const offset = typeof input.offset === "number" && input.offset >= 0 ? input.offset : 0;
  const result = await ctx.documents.listDocuments({ owner: input.owner, collection: input.collection, limit, offset });
  return result;
}
async function dataWrite(input, ctx) {
  const document = await ctx.documents.putDocument({ owner: input.owner, collection: input.collection, id: input.id, body: input.body });
  return { document };
}
async function dataWatch(input, _ctx) {
  const timeoutMs = Math.min(typeof input.timeout === "number" && input.timeout > 0 ? input.timeout * 1e3 : 6e4, 3e5);
  return new Promise((resolve) => {
    const entry = {
      owner: input.owner,
      collection: input.collection,
      resolve: (value) => {
        resolve(value);
      },
      timer: setTimeout(() => {
        pendingWatches.delete(entry);
        resolve({ event: null, reason: "timeout" });
      }, timeoutMs)
    };
    pendingWatches.add(entry);
  });
}
function onDocumentEvent(input) {
  const payload = input.payload;
  if (!payload || typeof payload !== "object") return;
  const type = payload.type;
  if (type !== "document.updated" && type !== "document.deleted") return;
  for (const entry of pendingWatches) {
    if (entry.owner !== payload.owner) continue;
    if (entry.collection && entry.collection !== payload.collection) continue;
    cancelWatch(entry);
    entry.resolve({ event: payload });
    return;
  }
}
export {
  dataList,
  dataRead,
  dataWatch,
  dataWrite,
  onDocumentEvent
};
