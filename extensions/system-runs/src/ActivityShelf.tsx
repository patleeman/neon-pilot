export function ActivityShelf() {
  // Conversation-scoped background activity is rendered by the core execution
  // shelf, which uses the product Execution projection. Do not poll raw durable
  // runs from the renderer on the conversation hot path.
  return null;
}
