import { createRequire as __paExtensionCreateRequire } from "node:module"; const require = __paExtensionCreateRequire(import.meta.url);

// extensions/system-alerts/src/types.ts
var ALERT_SOUND_IDS = [
  "basso",
  "blow",
  "bottle",
  "frog",
  "funk",
  "glass",
  "hero",
  "morse",
  "ping",
  "pop",
  "purr",
  "sosumi",
  "submarine",
  "tink"
];

// extensions/system-alerts/src/backend.ts
var SETTINGS_KEY = "settings";
var NOTIFIED_PREFIX = "notified/";
var LAST_SOUND_KEY = "lastSound";
var SOUND_COOLDOWN_MS = 1e4;
var DEFAULT_SETTINGS = {
  enabled: true,
  nativeNotifications: true,
  soundEnabled: true,
  severity: "disruptive",
  sound: "pop"
};
var SOUND_PATHS = {
  basso: "/System/Library/Sounds/Basso.aiff",
  blow: "/System/Library/Sounds/Blow.aiff",
  bottle: "/System/Library/Sounds/Bottle.aiff",
  frog: "/System/Library/Sounds/Frog.aiff",
  funk: "/System/Library/Sounds/Funk.aiff",
  glass: "/System/Library/Sounds/Glass.aiff",
  hero: "/System/Library/Sounds/Hero.aiff",
  morse: "/System/Library/Sounds/Morse.aiff",
  ping: "/System/Library/Sounds/Ping.aiff",
  pop: "/System/Library/Sounds/Pop.aiff",
  purr: "/System/Library/Sounds/Purr.aiff",
  sosumi: "/System/Library/Sounds/Sosumi.aiff",
  submarine: "/System/Library/Sounds/Submarine.aiff",
  tink: "/System/Library/Sounds/Tink.aiff"
};
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function normalizeSound(value) {
  return typeof value === "string" && ALERT_SOUND_IDS.includes(value) ? value : DEFAULT_SETTINGS.sound;
}
function normalizeSettings(value) {
  const record = isRecord(value) ? value : {};
  return {
    enabled: typeof record.enabled === "boolean" ? record.enabled : DEFAULT_SETTINGS.enabled,
    nativeNotifications: typeof record.nativeNotifications === "boolean" ? record.nativeNotifications : DEFAULT_SETTINGS.nativeNotifications,
    soundEnabled: typeof record.soundEnabled === "boolean" ? record.soundEnabled : DEFAULT_SETTINGS.soundEnabled,
    severity: record.severity === "all" ? "all" : DEFAULT_SETTINGS.severity,
    sound: normalizeSound(record.sound)
  };
}
function normalizeUpdate(input) {
  if (!isRecord(input)) return {};
  const update = {};
  if (typeof input.enabled === "boolean") update.enabled = input.enabled;
  if (typeof input.nativeNotifications === "boolean") update.nativeNotifications = input.nativeNotifications;
  if (typeof input.soundEnabled === "boolean") update.soundEnabled = input.soundEnabled;
  if (input.severity === "all" || input.severity === "disruptive") update.severity = input.severity;
  if (typeof input.sound === "string" && ALERT_SOUND_IDS.includes(input.sound)) update.sound = input.sound;
  return update;
}
async function loadSettings(ctx) {
  return normalizeSettings(await ctx.storage.get(SETTINGS_KEY));
}
async function saveSettings(ctx, settings) {
  await ctx.storage.put(SETTINGS_KEY, settings);
  return settings;
}
function alertMatchesSettings(alert, settings) {
  if (!settings.enabled || alert.status !== "active") return false;
  if (settings.severity === "disruptive" && alert.severity !== "disruptive") return false;
  return true;
}
function notificationBody(alert) {
  const body = alert.body.trim();
  if (!body) return "Open Neon Pilot to review the alert.";
  const firstLine = body.split("\n").map((line) => line.trim()).find(Boolean);
  return firstLine ?? "Open Neon Pilot to review the alert.";
}
async function alreadyDelivered(ctx, alert) {
  const key = `${NOTIFIED_PREFIX}${alert.id}`;
  const previous = await ctx.storage.get(key);
  if (isRecord(previous) && previous.updatedAt === alert.updatedAt) {
    return true;
  }
  await ctx.storage.put(key, { updatedAt: alert.updatedAt, deliveredAt: (/* @__PURE__ */ new Date()).toISOString() });
  return false;
}
async function playSound(ctx, settings, options = {}) {
  const now = Date.now();
  if (!options.force) {
    const previous = await ctx.storage.get(LAST_SOUND_KEY);
    const previousPlayedAt = isRecord(previous) && typeof previous.playedAt === "number" ? previous.playedAt : 0;
    if (now - previousPlayedAt < SOUND_COOLDOWN_MS) {
      return;
    }
  }
  await ctx.storage.put(LAST_SOUND_KEY, { playedAt: now });
  const soundPath = SOUND_PATHS[settings.sound] ?? SOUND_PATHS.pop;
  try {
    const child = await ctx.shell.spawn({
      command: "/usr/bin/afplay",
      args: [soundPath],
      onExit: (event) => {
        if (event.code && event.code !== 0) {
          ctx.log.warn("alert sound exited unsuccessfully", { code: event.code, signal: event.signal ?? null, soundPath });
        }
      }
    });
    if (!child.pid) {
      child.kill();
      ctx.log.warn("alert sound did not start", { soundPath });
    }
  } catch (error) {
    ctx.log.warn("failed to play alert sound", { message: error instanceof Error ? error.message : String(error), soundPath });
  }
}
async function deliverAlert(ctx, alert, settings, options = {}) {
  if (settings.nativeNotifications) {
    const delivered = ctx.notify.system({
      title: alert.title || "Neon Pilot needs attention",
      subtitle: alert.conversationId ? "Conversation needs attention" : void 0,
      message: notificationBody(alert),
      persistent: Boolean(alert.requiresAck)
    });
    if (!delivered) {
      ctx.log.warn("system notification listener unavailable", { alertId: alert.id });
    }
  }
  if (settings.soundEnabled) {
    await playSound(ctx, settings, { force: options.forceSound });
  }
}
async function readSettings(_input, ctx) {
  return {
    settings: await loadSettings(ctx),
    systemNotificationsAvailable: ctx.notify.isSystemAvailable()
  };
}
async function updateSettings(input, ctx) {
  const current = await loadSettings(ctx);
  const settings = await saveSettings(ctx, { ...current, ...normalizeUpdate(input) });
  return {
    settings,
    systemNotificationsAvailable: ctx.notify.isSystemAvailable()
  };
}
async function sendTestAlert(_input, ctx) {
  const settings = await loadSettings(ctx);
  await deliverAlert(
    ctx,
    {
      id: "test-alert",
      kind: "blocked",
      severity: "disruptive",
      status: "active",
      title: "Neon Pilot test alert",
      body: "Notifications and sound are working.",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      requiresAck: false,
      sourceKind: "system-alerts",
      sourceId: "test"
    },
    { ...settings, enabled: true },
    { forceSound: true }
  );
  return { ok: true };
}
async function onAlertUpserted(event, ctx) {
  const payload = event.payload;
  const alert = payload?.type === "upserted" && payload.alert ? payload.alert : null;
  if (!alert) return;
  const settings = await loadSettings(ctx);
  if (!alertMatchesSettings(alert, settings)) return;
  if (await alreadyDelivered(ctx, alert)) return;
  await deliverAlert(ctx, alert, settings);
}
export {
  onAlertUpserted,
  readSettings,
  sendTestAlert,
  updateSettings
};
