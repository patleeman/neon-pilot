import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ExtensionBackendContext } from '@neon-pilot/extensions';

const VENDOR_ID = '0x0911';
const PRODUCT_ID = '0x0c1c';
const MAX_LOGS = 80;
const SETTINGS_KEY = 'settings';

const ACTIONS = [
  { id: 'none', label: 'No action' },
  { id: 'dictation.toggle', label: 'Toggle dictation' },
  { id: 'conversation.previous', label: 'Previous conversation' },
  { id: 'conversation.next', label: 'Next conversation' },
  { id: 'composer.submit', label: 'Send message' },
  { id: 'conversation.pageUp', label: 'Page conversation up' },
  { id: 'conversation.pageDown', label: 'Page conversation down' },
  { id: 'composer.focus', label: 'Focus composer' },
  { id: 'model.cycle', label: 'Cycle model' },
  { id: 'thinking.cycle', label: 'Cycle thinking' },
  { id: 'conversation.newAndFocus', label: 'New chat + focus' },
  { id: 'composer.clear', label: 'Clear composer' },
  { id: 'composer.focusAndClear', label: 'Focus + clear composer' },
] as const;

const EVENTS = [
  { id: 'record.press', label: 'Record press' },
  { id: 'record.release', label: 'Record release' },
  { id: 'rewind.press', label: 'Rewind' },
  { id: 'forward.press', label: 'Forward' },
  { id: 'play.press', label: 'Play' },
  { id: 'eol.press', label: 'EOL' },
  { id: 'insert.press', label: 'Insert/Overwrite' },
  { id: 'info.press', label: 'Info button' },
  { id: 'f1.press', label: 'F1' },
  { id: 'f2.press', label: 'F2' },
  { id: 'f3.press', label: 'F3' },
  { id: 'f4.press', label: 'F4' },
  { id: 'device.pickedUp', label: 'Device picked up' },
  { id: 'device.laidDown', label: 'Device laid down' },
  { id: 'trigger.secondary.press', label: 'Secondary rear trigger' },
] as const;

const DEFAULT_BINDINGS: Record<string, string> = {
  'record.press': 'dictation.toggle',
  'record.release': 'dictation.toggle',
  'rewind.press': 'conversation.previous',
  'forward.press': 'conversation.next',
  'play.press': 'composer.submit',
  'eol.press': 'conversation.pageUp',
  'insert.press': 'none',
  'info.press': 'conversation.pageDown',
  'f1.press': 'model.cycle',
  'f2.press': 'thinking.cycle',
  'f3.press': 'conversation.newAndFocus',
  'f4.press': 'composer.focusAndClear',
  'device.pickedUp': 'composer.focus',
  'device.laidDown': 'none',
  'trigger.secondary.press': 'composer.focus',
};

interface SpeechMikeEvent {
  name: string;
  raw: string;
  at: string;
}

interface SpeechMikeSettings {
  bindings: Record<string, string>;
}

let monitorProcess: { kill: () => void; pid?: number } | null = null;
let monitorPid: number | null = null;
let running = false;
let lastEvent: SpeechMikeEvent | null = null;
let logs: string[] = [];
let stdoutBuffer = '';
let activeButton: string | null = null;
let cachedSettings: SpeechMikeSettings | null = null;

function parseHelperPids(output: string, helperPath: string, currentPid: number | null): number[] {
  const pids: number[] = [];
  for (const line of output.split(/\r?\n/)) {
    const match = line.trim().match(/^(\d+)\s+(.+)$/);
    if (!match) continue;
    const pid = Number(match[1]);
    const command = match[2];
    if (!Number.isSafeInteger(pid) || pid === currentPid) continue;
    if (command === helperPath || command.startsWith(`${helperPath} `)) pids.push(pid);
  }
  return pids;
}

function normalizeSettings(value: unknown): SpeechMikeSettings {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const bindings = record.bindings && typeof record.bindings === 'object' && !Array.isArray(record.bindings) ? record.bindings : {};
  const validActionIds = new Set(ACTIONS.map((action) => action.id));
  return {
    bindings: Object.fromEntries(
      EVENTS.map((event) => {
        const action = bindings[event.id];
        return [
          event.id,
          typeof action === 'string' && validActionIds.has(action as never) ? action : (DEFAULT_BINDINGS[event.id] ?? 'none'),
        ];
      }),
    ),
  };
}

async function loadSettings(ctx: ExtensionBackendContext): Promise<SpeechMikeSettings> {
  if (cachedSettings) return cachedSettings;
  cachedSettings = normalizeSettings(await ctx.storage.get(SETTINGS_KEY).catch(() => null));
  return cachedSettings;
}

function remember(message: string): void {
  const line = `${new Date().toISOString()} ${message}`;
  logs = [...logs.slice(-(MAX_LOGS - 1)), line];
}

function helperSource(): string {
  return String.raw`import Foundation
import IOKit.hid

final class Context { var buffers: [IOHIDDevice: UnsafeMutablePointer<UInt8>] = [:] }
let context = Context()

func hex(_ bytes: UnsafePointer<UInt8>, _ length: Int) -> String { (0..<length).map { String(format: "%02x", bytes[$0]) }.joined(separator: " ") }
func intProperty(_ device: IOHIDDevice, _ key: CFString) -> Int? {
    guard let value = IOHIDDeviceGetProperty(device, key), CFGetTypeID(value) == CFNumberGetTypeID() else { return nil }
    var n: Int = 0
    CFNumberGetValue((value as! CFNumber), .intType, &n)
    return n
}
func productName(_ device: IOHIDDevice) -> String { IOHIDDeviceGetProperty(device, kIOHIDProductKey as CFString).map { String(describing: $0) } ?? "unknown" }
func deviceTag(_ device: IOHIDDevice) -> String {
    "product=\(productName(device)) usagePage=\(intProperty(device, kIOHIDPrimaryUsagePageKey as CFString) ?? -1) usage=\(intProperty(device, kIOHIDPrimaryUsageKey as CFString) ?? -1)"
}

let inputCallback: IOHIDReportCallback = { contextPtr, result, sender, type, reportID, report, reportLength in
    guard let sender else { return }
    let device = unsafeBitCast(sender, to: IOHIDDevice.self)
    print("REPORT \(deviceTag(device)) reportID=\(reportID) len=\(reportLength) bytes=\(hex(report, reportLength))")
    fflush(stdout)
}

let deviceMatched: IOHIDDeviceCallback = { contextPtr, result, sender, device in
    guard productName(device).contains("SpeechMike") else { return }
    let usagePage = intProperty(device, kIOHIDPrimaryUsagePageKey as CFString) ?? -1
    let usage = intProperty(device, kIOHIDPrimaryUsageKey as CFString) ?? -1
    guard usagePage == 65440 && usage == 1 else { return }
    let maxInput = intProperty(device, kIOHIDMaxInputReportSizeKey as CFString) ?? 9
    print("MATCH product=\(productName(device)) usagePage=\(usagePage) usage=\(usage) maxInput=\(maxInput)")
    fflush(stdout)
    guard let contextPtr else { return }
    let ctx = Unmanaged<Context>.fromOpaque(contextPtr).takeUnretainedValue()
    if ctx.buffers[device] != nil { return }
    let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: max(1, maxInput))
    ctx.buffers[device] = buffer
    IOHIDDeviceRegisterInputReportCallback(device, buffer, maxInput, inputCallback, contextPtr)
}

let deviceRemoved: IOHIDDeviceCallback = { contextPtr, result, sender, device in
    print("REMOVE \(deviceTag(device))")
    fflush(stdout)
    guard let contextPtr else { return }
    let ctx = Unmanaged<Context>.fromOpaque(contextPtr).takeUnretainedValue()
    if let buffer = ctx.buffers.removeValue(forKey: device) { buffer.deallocate() }
}

let manager = IOHIDManagerCreate(kCFAllocatorDefault, IOOptionBits(kIOHIDOptionsTypeNone))
IOHIDManagerSetDeviceMatching(manager, nil)
let opaqueContext = Unmanaged.passUnretained(context).toOpaque()
IOHIDManagerRegisterDeviceMatchingCallback(manager, deviceMatched, opaqueContext)
IOHIDManagerRegisterDeviceRemovalCallback(manager, deviceRemoved, opaqueContext)
IOHIDManagerScheduleWithRunLoop(manager, CFRunLoopGetCurrent(), CFRunLoopMode.defaultMode.rawValue)
let openResult = IOHIDManagerOpen(manager, IOOptionBits(kIOHIDOptionsTypeNone))
if let devices = IOHIDManagerCopyDevices(manager) as? Set<IOHIDDevice> {
    for device in devices { deviceMatched(opaqueContext, IOReturn(kIOReturnSuccess), nil, device) }
}
print("READY vendor=0x0911 product=0x0c1c openResult=\(openResult)")
fflush(stdout)
CFRunLoopRun()
`;
}

async function ensureHelper(ctx: ExtensionBackendContext): Promise<string> {
  const sourcePath = join(ctx.runtimeDir, 'speechmike-helper.swift');
  const binaryPath = join(ctx.runtimeDir, 'speechmike-helper');
  writeFileSync(sourcePath, helperSource());
  if (!existsSync(binaryPath)) {
    const result = await ctx.shell.exec({ command: 'swiftc', args: [sourcePath, '-o', binaryPath], timeoutMs: 30_000 });
    if (result.exitCode !== 0) throw new Error(`swiftc failed: ${result.stderr || result.stdout}`);
  }
  return binaryPath;
}

async function cleanupStaleHelpers(ctx: ExtensionBackendContext, helperPath: string, currentPid: number | null): Promise<void> {
  try {
    const result = await ctx.shell.exec({ command: '/bin/ps', args: ['-axo', 'pid=,command='], timeoutMs: 5_000, maxBuffer: 1024 * 1024 });
    const stalePids = parseHelperPids(result.stdout, helperPath, currentPid);
    if (stalePids.length === 0) return;
    await ctx.shell.exec({ command: '/bin/kill', args: ['-TERM', ...stalePids.map(String)], timeoutMs: 5_000, maxBuffer: 64 * 1024 });
    remember(`stopped stale SpeechMike helper pid=${stalePids.join(',')}`);
  } catch (error) {
    remember(`stale helper cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function decodeReport(raw: string, _usagePage?: number, _usage?: number): string | null {
  const bytes = raw
    .trim()
    .split(/\s+/)
    .map((byte) => Number.parseInt(byte, 16));
  if (bytes.length !== 9) return null;
  if (bytes[0] === 0x9e) return bytes[8] === 0x01 ? 'device.laidDown' : 'device.pickedUp';
  if (bytes[0] !== 0x80) return null;

  const low = bytes[8];
  const high = bytes[7];
  if (low === 0 && high === 0) return 'release';
  if (low === 0x01) return 'record.press';
  if (low === 0x10) return 'rewind.press';
  if (low === 0x08) return 'forward.press';
  if (low === 0x04) return 'play.press';
  if (low === 0x20) return 'eol.press';
  if (low === 0x40) return 'insert.press';
  if (low === 0x80) return 'info.press';
  if (high === 0x02) return 'f1.press';
  if (high === 0x04) return 'f2.press';
  if (high === 0x08) return 'f3.press';
  if (high === 0x10) return 'f4.press';
  if (high === 0x20) return 'trigger.secondary.press';
  return `unknown.${raw.replace(/\s+/g, '-')}`;
}

async function executeEvent(eventName: string, ctx: ExtensionBackendContext): Promise<void> {
  const settings = await loadSettings(ctx);
  const action = settings.bindings[eventName] ?? DEFAULT_BINDINGS[eventName] ?? 'none';
  if (action === 'none') return;
  if (action === 'composer.focusAndClear') {
    await ctx.commands.execute('composer.focus');
    await ctx.commands.execute('composer.clear');
    return;
  }
  await ctx.commands.execute(action);
}

function handleLine(line: string, ctx: ExtensionBackendContext): void {
  if (line.startsWith('MATCH') || line.startsWith('READY') || line.startsWith('REMOVE')) remember(line);
  const match = line.match(/^REPORT .*?usagePage=([0-9-]+) usage=([0-9-]+) reportID=\d+ len=\d+ bytes=(.+)$/);
  if (!match) return;
  const usagePage = Number(match[1]);
  const usage = Number(match[2]);
  const raw = match[3];
  const decodedName = decodeReport(raw, usagePage, usage);
  if (!decodedName) return;

  let name = decodedName;
  if (decodedName === 'release') {
    name = activeButton ? `${activeButton}.release` : 'release';
    activeButton = null;
  } else if (decodedName.endsWith('.press')) {
    activeButton = decodedName.slice(0, -'.press'.length);
  }

  if (name === lastEvent?.name && raw === lastEvent.raw && Date.now() - Date.parse(lastEvent.at) < 250) return;
  lastEvent = { name, raw, at: new Date().toISOString() };
  remember(`event ${name} raw=${raw}`);
  void executeEvent(name, ctx).catch((error) =>
    remember(`command failed for ${name}: ${error instanceof Error ? error.message : String(error)}`),
  );
}

export async function start(_input: unknown, ctx: ExtensionBackendContext) {
  if (monitorProcess) return status(undefined, ctx);
  const helper = await ensureHelper(ctx);
  await cleanupStaleHelpers(ctx, helper, null);
  stdoutBuffer = '';
  const child = await ctx.shell.spawn({
    command: helper,
    onStdout: (chunk) => {
      stdoutBuffer += Buffer.from(chunk).toString('utf8');
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? '';
      for (const line of lines) handleLine(line, ctx);
    },
    onStderr: (chunk) => remember(`stderr ${Buffer.from(chunk).toString('utf8').trim()}`),
    onExit: (event) => {
      remember(`helper exited code=${event.code ?? 'null'} signal=${event.signal ?? 'null'}`);
      monitorProcess = null;
      monitorPid = null;
      running = false;
    },
  });
  monitorProcess = child;
  monitorPid = child.pid ?? null;
  running = true;
  remember(`started SpeechMike monitor pid=${monitorPid ?? 'unknown'}`);
  return status(undefined, ctx);
}

export async function startService(input: unknown, ctx: ExtensionBackendContext): Promise<() => Promise<void>> {
  try {
    await start(input, ctx);
  } catch (error) {
    remember(`service start failed: ${error instanceof Error ? error.message : String(error)}`);
    ctx.log.warn('SpeechMike service start failed', { error: error instanceof Error ? error.message : String(error) });
  }
  return async () => {
    await stop(undefined, ctx);
  };
}

export async function stop(_input: unknown, _ctx: ExtensionBackendContext) {
  const processToStop = monitorProcess;
  const pidToStop = monitorPid;
  const helper = join(_ctx.runtimeDir, 'speechmike-helper');
  if (processToStop) processToStop.kill();
  monitorProcess = null;
  monitorPid = null;
  running = false;
  await cleanupStaleHelpers(_ctx, helper, pidToStop);
  remember('stopped SpeechMike monitor');
  return { ok: true };
}

export async function status(_input: unknown, _ctx: ExtensionBackendContext) {
  return {
    ok: true,
    running,
    pid: monitorPid,
    vendorId: VENDOR_ID,
    productId: PRODUCT_ID,
    lastEvent,
    logs,
  };
}

export async function readSettings(_input: unknown, ctx: ExtensionBackendContext) {
  return { settings: await loadSettings(ctx), events: EVENTS, actions: ACTIONS };
}

export async function updateSettings(input: unknown, ctx: ExtensionBackendContext) {
  const next = normalizeSettings(input);
  cachedSettings = next;
  await ctx.storage.put(SETTINGS_KEY, next);
  remember('updated button bindings');
  return { settings: next, events: EVENTS, actions: ACTIONS };
}
