import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ExtensionBackendContext } from '@neon-pilot/extensions';

const VENDOR_ID = '0x0911';
const PRODUCT_ID = '0x0c1c';
const MAX_LOGS = 80;

interface SpeechMikeEvent {
  name: string;
  raw: string;
  at: string;
}

let monitorProcess: { kill: () => void; pid?: number } | null = null;
let monitorPid: number | null = null;
let running = false;
let lastEvent: SpeechMikeEvent | null = null;
let logs: string[] = [];
let stdoutBuffer = '';

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
  if (high === 0x02) return 'f1.press';
  if (high === 0x04) return 'f2.press';
  if (high === 0x08) return 'f3.press';
  if (high === 0x10) return 'f4.press';
  return `unknown.${raw.replace(/\s+/g, '-')}`;
}

async function executeEvent(eventName: string, ctx: ExtensionBackendContext): Promise<void> {
  switch (eventName) {
    case 'record.press':
    case 'release':
      await ctx.commands.execute('dictation.toggle');
      return;
    case 'rewind.press':
      await ctx.commands.execute('conversation.previous');
      return;
    case 'forward.press':
      await ctx.commands.execute('conversation.next');
      return;
    case 'play.press':
    case 'eol.press':
      await ctx.commands.execute('composer.submit');
      return;
    case 'insert.press':
    case 'f2.press':
      await ctx.commands.execute('composer.focus');
      return;
    case 'f1.press':
      await ctx.commands.execute('palette.open', { scope: 'commands' });
      return;
    case 'f3.press':
      await ctx.commands.execute('conversation.previous');
      return;
    case 'f4.press':
      await ctx.commands.execute('conversation.next');
      return;
    default:
      return;
  }
}

function handleLine(line: string, ctx: ExtensionBackendContext): void {
  if (line.startsWith('MATCH') || line.startsWith('READY') || line.startsWith('REMOVE')) remember(line);
  const match = line.match(/^REPORT .*?usagePage=([0-9-]+) usage=([0-9-]+) reportID=\d+ len=\d+ bytes=(.+)$/);
  if (!match) return;
  const usagePage = Number(match[1]);
  const usage = Number(match[2]);
  const raw = match[3];
  const name = decodeReport(raw, usagePage, usage);
  if (!name) return;
  if (name === lastEvent?.name && raw === lastEvent.raw && Date.now() - Date.parse(lastEvent.at) < 50) return;
  lastEvent = { name, raw, at: new Date().toISOString() };
  remember(`event ${name} raw=${raw}`);
  void executeEvent(name, ctx).catch((error) =>
    remember(`command failed for ${name}: ${error instanceof Error ? error.message : String(error)}`),
  );
}

export async function start(_input: unknown, ctx: ExtensionBackendContext) {
  if (monitorProcess) return status(undefined, ctx);
  const helper = await ensureHelper(ctx);
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
  if (monitorProcess) monitorProcess.kill();
  monitorProcess = null;
  monitorPid = null;
  running = false;
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
