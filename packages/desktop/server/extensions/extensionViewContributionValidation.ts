import {
  EXTENSION_ICON_NAMES,
  EXTENSION_RIGHT_SURFACE_SCOPES,
  EXTENSION_ROUTE_CAPABILITIES,
  EXTENSION_VIEW_ACTIVATIONS,
  EXTENSION_VIEW_PLACEMENTS,
  EXTENSION_VIEW_SCOPES,
} from './extensionManifest.js';
import {
  assertRecordArray,
  requireString,
  requireStringArray,
  validateEnum,
  validateOptionalString,
} from './extensionManifestValidation.js';
import { validateThemeTokens, validateViewComponent } from './extensionManifestViewValidation.js';

function validateOptionalBoolean(value: unknown, path: string): void {
  if (value !== undefined && typeof value !== 'boolean') {
    throw new Error(`Extension manifest ${path} must be a boolean.`);
  }
}

function validateWebappPath(value: string, path: string): void {
  if (value.startsWith('/') || value.includes('..')) {
    throw new Error(`Extension manifest ${path} must be a package-relative path that does not contain ..`);
  }
}

function validateLoopbackHttpTarget(value: string, path: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Extension manifest ${path} must be a valid URL.`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Extension manifest ${path} must use http or https.`);
  }
  const hostname = parsed.hostname.replace(/^\[/, '').replace(/\]$/, '');
  if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) {
    throw new Error(`Extension manifest ${path} must target localhost, 127.0.0.1, or ::1.`);
  }
}

function isDnsSafeName(value: string): boolean {
  return /^[a-z0-9](?:[a-z0-9.-]{0,61}[a-z0-9])?$/.test(value) && !value.includes('..');
}

function validateWebappId(value: string, path: string): void {
  if (!isDnsSafeName(value)) {
    throw new Error(`Extension manifest ${path} must be a lowercase DNS-safe webapp id.`);
  }
}

function validatePortlessName(value: string, path: string): void {
  if (!isDnsSafeName(value)) {
    throw new Error(`Extension manifest ${path} must be a lowercase DNS-safe Portless name.`);
  }
}

export function validateViewContributions(value: unknown): void {
  for (const [index, view] of assertRecordArray(value, 'contributes.views').entries()) {
    requireString(view.id, `contributes.views[${index}].id`);
    requireString(view.title, `contributes.views[${index}].title`);
    validateEnum(view.location, ['main', 'rightRail', 'workbench', 'sidebar'], `contributes.views[${index}].location`);
    validateViewComponent(view.component, `contributes.views[${index}].component`);
    validateOptionalString(view.route, `contributes.views[${index}].route`);
    if (view.scope !== undefined) validateEnum(view.scope, EXTENSION_RIGHT_SURFACE_SCOPES, `contributes.views[${index}].scope`);
    if (view.placement !== undefined) validateEnum(view.placement, EXTENSION_VIEW_PLACEMENTS, `contributes.views[${index}].placement`);
    if (view.placement !== undefined && view.scope !== undefined)
      validateEnum(view.scope, EXTENSION_VIEW_SCOPES, `contributes.views[${index}].scope`);
    if (view.activation !== undefined) validateEnum(view.activation, EXTENSION_VIEW_ACTIVATIONS, `contributes.views[${index}].activation`);
    if (view.icon !== undefined) validateEnum(view.icon, EXTENSION_ICON_NAMES, `contributes.views[${index}].icon`);
    validateOptionalString(view.detailView, `contributes.views[${index}].detailView`);
    validateOptionalString(view.toolSlot, `contributes.views[${index}].toolSlot`);
    if (view.routeCapabilities !== undefined) {
      for (const [capabilityIndex, capability] of requireStringArray(
        view.routeCapabilities,
        `contributes.views[${index}].routeCapabilities`,
      ).entries()) {
        validateEnum(capability, EXTENSION_ROUTE_CAPABILITIES, `contributes.views[${index}].routeCapabilities[${capabilityIndex}]`);
      }
    }
  }
}

export function validateWebappContributions(value: unknown): void {
  for (const [index, webapp] of assertRecordArray(value, 'contributes.webapps').entries()) {
    const id = requireString(webapp.id, `contributes.webapps[${index}].id`);
    validateWebappId(id, `contributes.webapps[${index}].id`);
    requireString(webapp.title, `contributes.webapps[${index}].title`);
    validateOptionalString(webapp.description, `contributes.webapps[${index}].description`);
    validateOptionalString(webapp.entry, `contributes.webapps[${index}].entry`);
    validateOptionalString(webapp.target, `contributes.webapps[${index}].target`);
    validateOptionalString(webapp.portlessName, `contributes.webapps[${index}].portlessName`);
    validateOptionalBoolean(webapp.spaFallback, `contributes.webapps[${index}].spaFallback`);
    if (webapp.entry !== undefined) validateWebappPath(webapp.entry as string, `contributes.webapps[${index}].entry`);
    if (webapp.target !== undefined) validateLoopbackHttpTarget(webapp.target as string, `contributes.webapps[${index}].target`);
    if (webapp.portlessName !== undefined) validatePortlessName(webapp.portlessName as string, `contributes.webapps[${index}].portlessName`);
    if (webapp.entry !== undefined && webapp.target !== undefined) {
      throw new Error(`Extension manifest contributes.webapps[${index}] must declare either entry or target, not both.`);
    }
    if (webapp.entry === undefined && webapp.target === undefined) {
      throw new Error(`Extension manifest contributes.webapps[${index}] must declare entry or target.`);
    }
  }
}

export function validatePromptReferenceContributions(value: unknown): void {
  for (const [index, resolver] of assertRecordArray(value, 'contributes.promptReferences').entries()) {
    requireString(resolver.id, `contributes.promptReferences[${index}].id`);
    requireString(resolver.handler, `contributes.promptReferences[${index}].handler`);
    validateOptionalString(resolver.title, `contributes.promptReferences[${index}].title`);
  }
}

export function validateTranscriptRendererContributions(value: unknown): void {
  for (const [index, renderer] of assertRecordArray(value, 'contributes.transcriptRenderers').entries()) {
    requireString(renderer.id, `contributes.transcriptRenderers[${index}].id`);
    requireString(renderer.tool, `contributes.transcriptRenderers[${index}].tool`);
    requireString(renderer.component, `contributes.transcriptRenderers[${index}].component`);
    if (renderer.standalone !== undefined && typeof renderer.standalone !== 'boolean') {
      throw new Error(`Extension manifest contributes.transcriptRenderers[${index}].standalone must be a boolean.`);
    }
  }
}

export function validateThemeContributions(value: unknown): void {
  for (const [index, theme] of assertRecordArray(value, 'contributes.themes').entries()) {
    requireString(theme.id, `contributes.themes[${index}].id`);
    requireString(theme.label, `contributes.themes[${index}].label`);
    validateEnum(theme.appearance, ['light', 'dark'], `contributes.themes[${index}].appearance`);
    validateThemeTokens(theme.tokens, `contributes.themes[${index}].tokens`);
  }
}
