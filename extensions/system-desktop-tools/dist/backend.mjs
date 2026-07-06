import { createRequire as __paExtensionCreateRequire } from "node:module"; const require = __paExtensionCreateRequire(import.meta.url);

// packages/desktop/server/extensions/backendApi/desktop.ts
var EXTENSION_HOST_CAPABILITY_BRIDGE = Symbol.for("neon-pilot.extensionHostCapabilityBridge");
function requireDesktopCapabilityBridge() {
  const bridge = globalThis[EXTENSION_HOST_CAPABILITY_BRIDGE];
  if (!bridge) throw new Error("Desktop control requires an active extension host capability bridge.");
  return bridge;
}
async function controlDesktop(input) {
  return requireDesktopCapabilityBridge()("desktop", "control", input);
}
async function captureDesktopScreenshot(input) {
  return requireDesktopCapabilityBridge()("desktop", "screenshot", input);
}
async function readDesktopState() {
  return requireDesktopCapabilityBridge()("desktop", "state");
}
async function readDesktopUserActionEvents(input) {
  return requireDesktopCapabilityBridge()("desktop", "events", input);
}

// extensions/system-desktop-tools/src/backend.ts
function toolResult(details) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(details, null, 2)
      }
    ],
    details
  };
}
function screenshotDetails(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return result;
  const record = result;
  const image = record.image && typeof record.image === "object" && !Array.isArray(record.image) ? record.image : null;
  if (!image) return result;
  const imageMetadata = { ...image };
  delete imageMetadata.data;
  return { ...record, image: imageMetadata };
}
function screenshotText(details) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return JSON.stringify(details, null, 2);
  const record = details;
  if (record.ok === false) {
    const error = typeof record.error === "string" && record.error.trim() ? record.error.trim() : "Windowed OS screenshot failed.";
    return `desktop_screenshot failed: ${error}`;
  }
  return JSON.stringify(details, null, 2);
}
async function desktopControl(input, _ctx) {
  const result = await controlDesktop(input);
  return toolResult(result);
}
async function desktopState(_input, _ctx) {
  const state = await readDesktopState();
  return toolResult(state);
}
async function desktopWindowEvents(input, _ctx) {
  const events = await readDesktopUserActionEvents(input);
  return toolResult(events);
}
async function desktopScreenshot(input, _ctx) {
  const result = await captureDesktopScreenshot(input);
  const details = screenshotDetails(result);
  const content = [
    {
      type: "text",
      text: screenshotText(details)
    }
  ];
  const image = result && typeof result === "object" && !Array.isArray(result) && "image" in result ? result.image ?? null : null;
  if (image && typeof image.data === "string" && typeof image.mimeType === "string") {
    content.push({ type: "image", data: image.data, mimeType: image.mimeType });
  }
  return { content, details };
}
export {
  desktopControl,
  desktopScreenshot,
  desktopState,
  desktopWindowEvents
};
