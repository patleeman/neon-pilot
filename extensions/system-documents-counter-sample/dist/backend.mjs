import { createRequire as __paExtensionCreateRequire } from "node:module"; const require = __paExtensionCreateRequire(import.meta.url);

// extensions/system-documents-counter-sample/src/backend.ts
var SHARED_OWNER = "system-documents-counter-sample";
var SHARED_COLLECTION = "shared-heartbeat";
var BEAT_ID = "beat";
async function ensureSharedCollection(ctx) {
  const existing = await ctx.documents.getCollection({ owner: SHARED_OWNER, collection: SHARED_COLLECTION });
  if (!existing) {
    await ctx.documents.upsertCollection({
      owner: SHARED_OWNER,
      collection: SHARED_COLLECTION,
      options: {
        description: "Shared heartbeat collection for cross-extension document sharing demo",
        defaultGrantRead: "all",
        defaultGrantWrite: "owner"
      }
    });
  }
}
async function readCurrentBeat(ctx) {
  const doc = await ctx.documents.getDocument({ owner: SHARED_OWNER, collection: SHARED_COLLECTION, id: BEAT_ID });
  if (!doc) return null;
  return doc.body;
}
async function writeBeat(_input, ctx) {
  await ensureSharedCollection(ctx);
  const current = await readCurrentBeat(ctx);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const body = {
    count: (current?.count ?? 0) + 1,
    timestamp: now,
    ...current ? { previousTimestamp: current.timestamp } : {}
  };
  const document = await ctx.documents.putDocument({
    owner: SHARED_OWNER,
    collection: SHARED_COLLECTION,
    id: BEAT_ID,
    body
  });
  return { document };
}
async function resetBeat(_input, ctx) {
  await ensureSharedCollection(ctx);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const body = { count: 0, timestamp: now };
  await ctx.documents.putDocument({
    owner: SHARED_OWNER,
    collection: SHARED_COLLECTION,
    id: BEAT_ID,
    body
  });
  return { ok: true };
}
export {
  resetBeat,
  writeBeat
};
