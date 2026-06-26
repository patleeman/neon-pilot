import {
  ccount,
  find,
  hastToReact,
  html,
  stringify,
  stringify2,
  svg,
  whitespace
} from "./chunk-4YPGCSK5.js";
import {
  addNotification,
  api,
  buildApiPath,
  getDesktopBridge,
  measureClientPerfTiming,
  recordChatRenderTiming,
  recordExtensionRegistryUsability,
  useApi,
  writeClipboardText
} from "./chunk-ATHL2BJA.js";
import {
  timeAgo
} from "./chunk-DP4YXAPY.js";
import {
  Link,
  listHostCommands,
  setExtensionCommandContext
} from "./chunk-T3OH4ARN.js";
import {
  Button,
  Checkbox,
  Disclosure,
  IconButton,
  InlineCode,
  InlineCodeButton,
  LoadingState,
  MediaPreviewButton,
  MenuGroupLabel,
  MenuItem,
  MenuSeparator,
  MenuShell,
  MessageActionButton,
  MessageCard,
  MessageMeta,
  MetaLabel,
  Notice,
  Pill,
  RowButton,
  SectionLabel,
  StatusDot,
  SurfacePanel,
  TextButton,
  Textarea,
  cx
} from "./chunk-5W2EFD7M.js";
import {
  createPortal,
  neon_pilot_shared_react_dom_exports
} from "./chunk-P4G4CXIQ.js";
import {
  Children,
  Fragment,
  Fragment2,
  Suspense,
  cloneElement,
  createContext,
  forwardRef,
  init_neon_pilot_shared_react,
  isValidElement,
  jsx,
  jsxs,
  lazy,
  memo,
  neon_pilot_shared_react_default,
  neon_pilot_shared_react_exports,
  neon_pilot_shared_react_jsx_runtime_exports,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from "./chunk-TTFLGCWD.js";
import {
  __commonJS,
  __export,
  __toESM
} from "./chunk-MZHE4QUL.js";

// node_modules/.pnpm/inline-style-parser@0.2.7/node_modules/inline-style-parser/cjs/index.js
var require_cjs = __commonJS({
  "node_modules/.pnpm/inline-style-parser@0.2.7/node_modules/inline-style-parser/cjs/index.js"(exports, module) {
    "use strict";
    var COMMENT_REGEX = /\/\*[^*]*\*+([^/*][^*]*\*+)*\//g;
    var NEWLINE_REGEX = /\n/g;
    var WHITESPACE_REGEX = /^\s*/;
    var PROPERTY_REGEX = /^(\*?[-#/*\\\w]+(\[[0-9a-z_-]+\])?)\s*/;
    var COLON_REGEX = /^:\s*/;
    var VALUE_REGEX = /^((?:'(?:\\'|.)*?'|"(?:\\"|.)*?"|\([^)]*?\)|[^};])+)/;
    var SEMICOLON_REGEX = /^[;\s]*/;
    var TRIM_REGEX = /^\s+|\s+$/g;
    var NEWLINE = "\n";
    var FORWARD_SLASH = "/";
    var ASTERISK = "*";
    var EMPTY_STRING = "";
    var TYPE_COMMENT = "comment";
    var TYPE_DECLARATION = "declaration";
    function index2(style, options) {
      if (typeof style !== "string") {
        throw new TypeError("First argument must be a string");
      }
      if (!style) return [];
      options = options || {};
      var lineno = 1;
      var column = 1;
      function updatePosition(str) {
        var lines = str.match(NEWLINE_REGEX);
        if (lines) lineno += lines.length;
        var i = str.lastIndexOf(NEWLINE);
        column = ~i ? str.length - i : column + str.length;
      }
      function position3() {
        var start2 = { line: lineno, column };
        return function(node2) {
          node2.position = new Position(start2);
          whitespace2();
          return node2;
        };
      }
      function Position(start2) {
        this.start = start2;
        this.end = { line: lineno, column };
        this.source = options.source;
      }
      Position.prototype.content = style;
      function error(msg) {
        var err = new Error(
          options.source + ":" + lineno + ":" + column + ": " + msg
        );
        err.reason = msg;
        err.filename = options.source;
        err.line = lineno;
        err.column = column;
        err.source = style;
        if (options.silent) ;
        else {
          throw err;
        }
      }
      function match(re) {
        var m = re.exec(style);
        if (!m) return;
        var str = m[0];
        updatePosition(str);
        style = style.slice(str.length);
        return m;
      }
      function whitespace2() {
        match(WHITESPACE_REGEX);
      }
      function comments(rules) {
        var c;
        rules = rules || [];
        while (c = comment()) {
          if (c !== false) {
            rules.push(c);
          }
        }
        return rules;
      }
      function comment() {
        var pos = position3();
        if (FORWARD_SLASH != style.charAt(0) || ASTERISK != style.charAt(1)) return;
        var i = 2;
        while (EMPTY_STRING != style.charAt(i) && (ASTERISK != style.charAt(i) || FORWARD_SLASH != style.charAt(i + 1))) {
          ++i;
        }
        i += 2;
        if (EMPTY_STRING === style.charAt(i - 1)) {
          return error("End of comment missing");
        }
        var str = style.slice(2, i - 2);
        column += 2;
        updatePosition(str);
        style = style.slice(i);
        column += 2;
        return pos({
          type: TYPE_COMMENT,
          comment: str
        });
      }
      function declaration() {
        var pos = position3();
        var prop = match(PROPERTY_REGEX);
        if (!prop) return;
        comment();
        if (!match(COLON_REGEX)) return error("property missing ':'");
        var val = match(VALUE_REGEX);
        var ret = pos({
          type: TYPE_DECLARATION,
          property: trim(prop[0].replace(COMMENT_REGEX, EMPTY_STRING)),
          value: val ? trim(val[0].replace(COMMENT_REGEX, EMPTY_STRING)) : EMPTY_STRING
        });
        match(SEMICOLON_REGEX);
        return ret;
      }
      function declarations() {
        var decls = [];
        comments(decls);
        var decl;
        while (decl = declaration()) {
          if (decl !== false) {
            decls.push(decl);
            comments(decls);
          }
        }
        return decls;
      }
      whitespace2();
      return declarations();
    }
    function trim(str) {
      return str ? str.replace(TRIM_REGEX, EMPTY_STRING) : EMPTY_STRING;
    }
    module.exports = index2;
  }
});

// node_modules/.pnpm/style-to-object@1.0.14/node_modules/style-to-object/cjs/index.js
var require_cjs2 = __commonJS({
  "node_modules/.pnpm/style-to-object@1.0.14/node_modules/style-to-object/cjs/index.js"(exports) {
    "use strict";
    var __importDefault = exports && exports.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = StyleToObject;
    var inline_style_parser_1 = __importDefault(require_cjs());
    function StyleToObject(style, iterator) {
      let styleObject = null;
      if (!style || typeof style !== "string") {
        return styleObject;
      }
      const declarations = (0, inline_style_parser_1.default)(style);
      const hasIterator = typeof iterator === "function";
      declarations.forEach((declaration) => {
        if (declaration.type !== "declaration") {
          return;
        }
        const { property, value } = declaration;
        if (hasIterator) {
          iterator(property, value, declaration);
        } else if (value) {
          styleObject = styleObject || {};
          styleObject[property] = value;
        }
      });
      return styleObject;
    }
  }
});

// node_modules/.pnpm/style-to-js@1.1.21/node_modules/style-to-js/cjs/utilities.js
var require_utilities = __commonJS({
  "node_modules/.pnpm/style-to-js@1.1.21/node_modules/style-to-js/cjs/utilities.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.camelCase = void 0;
    var CUSTOM_PROPERTY_REGEX = /^--[a-zA-Z0-9_-]+$/;
    var HYPHEN_REGEX = /-([a-z])/g;
    var NO_HYPHEN_REGEX = /^[^-]+$/;
    var VENDOR_PREFIX_REGEX = /^-(webkit|moz|ms|o|khtml)-/;
    var MS_VENDOR_PREFIX_REGEX = /^-(ms)-/;
    var skipCamelCase = function(property) {
      return !property || NO_HYPHEN_REGEX.test(property) || CUSTOM_PROPERTY_REGEX.test(property);
    };
    var capitalize = function(match, character) {
      return character.toUpperCase();
    };
    var trimHyphen = function(match, prefix) {
      return "".concat(prefix, "-");
    };
    var camelCase = function(property, options) {
      if (options === void 0) {
        options = {};
      }
      if (skipCamelCase(property)) {
        return property;
      }
      property = property.toLowerCase();
      if (options.reactCompat) {
        property = property.replace(MS_VENDOR_PREFIX_REGEX, trimHyphen);
      } else {
        property = property.replace(VENDOR_PREFIX_REGEX, trimHyphen);
      }
      return property.replace(HYPHEN_REGEX, capitalize);
    };
    exports.camelCase = camelCase;
  }
});

// node_modules/.pnpm/style-to-js@1.1.21/node_modules/style-to-js/cjs/index.js
var require_cjs3 = __commonJS({
  "node_modules/.pnpm/style-to-js@1.1.21/node_modules/style-to-js/cjs/index.js"(exports, module) {
    "use strict";
    var __importDefault = exports && exports.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    var style_to_object_1 = __importDefault(require_cjs2());
    var utilities_1 = require_utilities();
    function StyleToJS(style, options) {
      var output = {};
      if (!style || typeof style !== "string") {
        return output;
      }
      (0, style_to_object_1.default)(style, function(property, value) {
        if (property && value) {
          output[(0, utilities_1.camelCase)(property, options)] = value;
        }
      });
      return output;
    }
    StyleToJS.default = StyleToJS;
    module.exports = StyleToJS;
  }
});

// node_modules/.pnpm/extend@3.0.2/node_modules/extend/index.js
var require_extend = __commonJS({
  "node_modules/.pnpm/extend@3.0.2/node_modules/extend/index.js"(exports, module) {
    "use strict";
    var hasOwn = Object.prototype.hasOwnProperty;
    var toStr = Object.prototype.toString;
    var defineProperty = Object.defineProperty;
    var gOPD = Object.getOwnPropertyDescriptor;
    var isArray = function isArray2(arr) {
      if (typeof Array.isArray === "function") {
        return Array.isArray(arr);
      }
      return toStr.call(arr) === "[object Array]";
    };
    var isPlainObject2 = function isPlainObject3(obj) {
      if (!obj || toStr.call(obj) !== "[object Object]") {
        return false;
      }
      var hasOwnConstructor = hasOwn.call(obj, "constructor");
      var hasIsPrototypeOf = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, "isPrototypeOf");
      if (obj.constructor && !hasOwnConstructor && !hasIsPrototypeOf) {
        return false;
      }
      var key;
      for (key in obj) {
      }
      return typeof key === "undefined" || hasOwn.call(obj, key);
    };
    var setProperty = function setProperty2(target, options) {
      if (defineProperty && options.name === "__proto__") {
        defineProperty(target, options.name, {
          enumerable: true,
          configurable: true,
          value: options.newValue,
          writable: true
        });
      } else {
        target[options.name] = options.newValue;
      }
    };
    var getProperty = function getProperty2(obj, name2) {
      if (name2 === "__proto__") {
        if (!hasOwn.call(obj, name2)) {
          return void 0;
        } else if (gOPD) {
          return gOPD(obj, name2).value;
        }
      }
      return obj[name2];
    };
    module.exports = function extend2() {
      var options, name2, src, copy, copyIsArray, clone;
      var target = arguments[0];
      var i = 1;
      var length = arguments.length;
      var deep = false;
      if (typeof target === "boolean") {
        deep = target;
        target = arguments[1] || {};
        i = 2;
      }
      if (target == null || typeof target !== "object" && typeof target !== "function") {
        target = {};
      }
      for (; i < length; ++i) {
        options = arguments[i];
        if (options != null) {
          for (name2 in options) {
            src = getProperty(target, name2);
            copy = getProperty(options, name2);
            if (target !== copy) {
              if (deep && copy && (isPlainObject2(copy) || (copyIsArray = isArray(copy)))) {
                if (copyIsArray) {
                  copyIsArray = false;
                  clone = src && isArray(src) ? src : [];
                } else {
                  clone = src && isPlainObject2(src) ? src : {};
                }
                setProperty(target, { name: name2, newValue: extend2(deep, clone, copy) });
              } else if (typeof copy !== "undefined") {
                setProperty(target, { name: name2, newValue: copy });
              }
            }
          }
        }
      }
      return target;
    };
  }
});

// packages/desktop/ui/src/components/chat/ChatView.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/extensions/useExtensionRegistry.ts
init_neon_pilot_shared_react();

// packages/desktop/ui/src/extensions/extensionRegistryEvents.ts
var extensionRegistryRevision = Date.now();
function getExtensionRegistryRevision() {
  return extensionRegistryRevision;
}

// packages/desktop/ui/src/extensions/extensionRegistryPrewarm.ts
var criticalExtensionRegistryPrewarm = false ? fetch("/api/extensions/registry/critical", { cache: "no-store" }).then((res) => {
  if (!res.ok) throw new Error(`Extension critical registry failed: ${res.status}`);
  return res.json();
}) : null;

// packages/desktop/ui/src/extensions/extensionRegistryProjection.ts
function normalizeRegistryExtensions(extensions) {
  return extensions.map((extension2) => ({
    ...extension2.manifest,
    ...extension2
  }));
}
var EMPTY_EXTENSION_REGISTRY_STATE = {
  extensions: [],
  routes: [],
  surfaces: [],
  topBarElements: [],
  messageActions: [],
  composerShelves: [],
  newConversationPanels: [],
  settingsComponent: null,
  settingsComponents: [],
  composerControls: [],
  composerInputTools: [],
  toolbarActions: [],
  contextMenus: [],
  selectionActions: [],
  threadHeaderActions: [],
  statusBarItems: [],
  conversationHeaderElements: [],
  conversationDecorators: [],
  activityTreeItemElements: [],
  activityTreeItemStyles: [],
  conversationLifecycle: [],
  composerAttachmentProviders: [],
  composerAttachmentRenderers: [],
  composerAttachmentResolvers: [],
  activityTreeItemActions: [],
  loading: false,
  error: null
};
var INITIAL_EXTENSION_REGISTRY_STATE = {
  ...EMPTY_EXTENSION_REGISTRY_STATE,
  loading: true
};
function normalizeTopBarElements(extensions) {
  const result = [];
  for (const extension2 of extensions) {
    const elements = extension2.contributes?.topBarElements;
    if (!elements?.length) continue;
    for (const element3 of elements) {
      result.push({
        extensionId: extension2.id,
        id: element3.id,
        component: element3.component,
        label: element3.label,
        frontendEntry: extension2.frontend?.entry
      });
    }
  }
  return result;
}
function normalizeMessageActions(extensions) {
  const result = [];
  for (const extension2 of extensions) {
    const actions = extension2.contributes?.messageActions;
    if (!actions?.length) continue;
    for (const action of actions) {
      result.push({
        extensionId: extension2.id,
        id: action.id,
        title: action.title,
        action: action.action,
        ...action.when ? { when: action.when } : {},
        ...typeof action.priority === "number" ? { priority: action.priority } : {}
      });
    }
  }
  result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return result;
}
function normalizeComposerShelves(extensions) {
  const result = [];
  for (const extension2 of extensions) {
    const shelves = extension2.contributes?.composerShelves;
    if (!shelves?.length) continue;
    for (const shelf of shelves) {
      result.push({
        extensionId: extension2.id,
        id: shelf.id,
        component: shelf.component,
        title: shelf.title,
        placement: shelf.placement ?? "bottom",
        frontendEntry: extension2.frontend?.entry
      });
    }
  }
  return result;
}
function normalizeNewConversationPanels(extensions) {
  const result = [];
  for (const extension2 of extensions) {
    const panels = extension2.contributes?.newConversationPanels;
    if (!panels?.length) continue;
    for (const panel of panels) {
      result.push({
        extensionId: extension2.id,
        id: panel.id,
        component: panel.component,
        ...panel.title ? { title: panel.title } : {},
        ...typeof panel.priority === "number" ? { priority: panel.priority } : {},
        frontendEntry: extension2.frontend?.entry
      });
    }
  }
  result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return result;
}
function normalizeSettingsComponents(extensions) {
  const result = [];
  for (const extension2 of extensions) {
    const panel = extension2.contributes?.settingsComponent;
    if (!panel) continue;
    result.push({
      extensionId: extension2.id,
      id: panel.id,
      component: panel.component,
      sectionId: panel.sectionId,
      label: panel.label,
      ...panel.description ? { description: panel.description } : {},
      ...typeof panel.order === "number" ? { order: panel.order } : {},
      frontendEntry: extension2.frontend?.entry
    });
  }
  result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return result;
}
function compareComposerControls(a, b) {
  return (a.priority ?? 0) - (b.priority ?? 0) || a.extensionId.localeCompare(b.extensionId) || a.id.localeCompare(b.id);
}
function normalizeComposerControls(extensions) {
  const result = [];
  for (const extension2 of extensions) {
    for (const control of extension2.contributes?.composerControls ?? []) {
      result.push({
        extensionId: extension2.id,
        id: control.id,
        component: control.component,
        slot: control.slot ?? "preferences",
        ...control.title ? { title: control.title } : {},
        ...control.when ? { when: control.when } : {},
        ...typeof control.priority === "number" ? { priority: control.priority } : {},
        frontendEntry: extension2.frontend?.entry
      });
    }
  }
  result.sort(compareComposerControls);
  return result;
}
function normalizeComposerInputTools(extensions) {
  const result = [];
  for (const extension2 of extensions) {
    const tools = extension2.contributes?.composerInputTools;
    if (!tools?.length) continue;
    for (const tool of tools) {
      result.push({
        extensionId: extension2.id,
        id: tool.id,
        component: tool.component,
        ...tool.title ? { title: tool.title } : {},
        ...tool.when ? { when: tool.when } : {},
        ...typeof tool.priority === "number" ? { priority: tool.priority } : {},
        frontendEntry: extension2.frontend?.entry
      });
    }
  }
  result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return result;
}
function normalizeToolbarActions(extensions) {
  const result = [];
  for (const extension2 of extensions) {
    const actions = extension2.contributes?.toolbarActions;
    if (!actions?.length) continue;
    for (const action of actions) {
      result.push({
        extensionId: extension2.id,
        id: action.id,
        title: action.title,
        icon: action.icon,
        action: action.action,
        ...action.when ? { when: action.when } : {},
        ...typeof action.priority === "number" ? { priority: action.priority } : {}
      });
    }
  }
  result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return result;
}
function normalizeConversationHeaderElements(extensions) {
  const result = [];
  for (const extension2 of extensions) {
    const elements = extension2.contributes?.conversationHeaderElements;
    if (!elements?.length) continue;
    for (const element3 of elements) {
      result.push({
        extensionId: extension2.id,
        id: element3.id,
        component: element3.component,
        label: element3.label,
        frontendEntry: extension2.frontend?.entry
      });
    }
  }
  return result;
}
function normalizeConversationDecorators(extensions) {
  const result = [];
  for (const extension2 of extensions) {
    const decorators = extension2.contributes?.conversationDecorators;
    if (!decorators?.length) continue;
    for (const decorator of decorators) {
      result.push({
        extensionId: extension2.id,
        id: decorator.id,
        component: decorator.component,
        position: decorator.position,
        ...typeof decorator.priority === "number" ? { priority: decorator.priority } : {},
        frontendEntry: extension2.frontend?.entry
      });
    }
  }
  result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return result;
}
function normalizeActivityTreeItemElements(extensions) {
  const result = [];
  for (const extension2 of extensions) {
    const elements = extension2.contributes?.activityTreeItemElements;
    if (!elements?.length) continue;
    for (const element3 of elements) {
      result.push({
        extensionId: extension2.id,
        id: element3.id,
        component: element3.component,
        slot: element3.slot,
        ...typeof element3.priority === "number" ? { priority: element3.priority } : {},
        frontendEntry: extension2.frontend?.entry
      });
    }
  }
  result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return result;
}
function normalizeActivityTreeItemStyles(extensions) {
  const result = [];
  for (const extension2 of extensions) {
    const styles = extension2.contributes?.activityTreeItemStyles;
    if (!styles?.length) continue;
    for (const style of styles) {
      result.push({
        extensionId: extension2.id,
        id: style.id,
        provider: style.provider,
        ...typeof style.priority === "number" ? { priority: style.priority } : {}
      });
    }
  }
  result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return result;
}
function normalizeConversationLifecycle(extensions) {
  const result = [];
  for (const extension2 of extensions) {
    const items = extension2.contributes?.conversationLifecycle;
    if (!items?.length) continue;
    for (const item of items) {
      result.push({
        extensionId: extension2.id,
        id: item.id,
        component: item.component,
        events: item.events,
        slot: item.slot ?? "banner",
        ...typeof item.priority === "number" ? { priority: item.priority } : {},
        frontendEntry: extension2.frontend?.entry
      });
    }
  }
  result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return result;
}
function normalizeComposerAttachmentProviders(extensions) {
  const result = [];
  for (const extension2 of extensions)
    for (const provider of extension2.contributes?.composerAttachmentProviders ?? [])
      result.push({
        extensionId: extension2.id,
        id: provider.id,
        title: provider.title,
        action: provider.action,
        ...provider.icon ? { icon: provider.icon } : {},
        ...typeof provider.priority === "number" ? { priority: provider.priority } : {}
      });
  result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return result;
}
function normalizeComposerAttachmentRenderers(extensions) {
  const result = [];
  for (const extension2 of extensions)
    for (const renderer of extension2.contributes?.composerAttachmentRenderers ?? [])
      result.push({
        extensionId: extension2.id,
        id: renderer.id,
        type: renderer.type,
        component: renderer.component,
        ...typeof renderer.priority === "number" ? { priority: renderer.priority } : {},
        frontendEntry: extension2.frontend?.entry
      });
  result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return result;
}
function normalizeComposerAttachmentResolvers(extensions) {
  const result = [];
  for (const extension2 of extensions)
    for (const resolver2 of extension2.contributes?.composerAttachmentResolvers ?? [])
      result.push({ extensionId: extension2.id, id: resolver2.id, type: resolver2.type, action: resolver2.action });
  return result;
}
function normalizeActivityTreeItemActions(extensions) {
  const result = [];
  for (const extension2 of extensions)
    for (const action of extension2.contributes?.activityTreeItemActions ?? [])
      result.push({
        extensionId: extension2.id,
        id: action.id,
        title: action.title,
        action: action.action,
        ...action.icon ? { icon: action.icon } : {},
        ...action.when ? { when: action.when } : {},
        ...typeof action.priority === "number" ? { priority: action.priority } : {}
      });
  result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return result;
}
function normalizeContextMenus(extensions) {
  const result = [];
  for (const extension2 of extensions) {
    const menus = extension2.contributes?.contextMenus;
    if (!menus?.length) continue;
    for (const menu of menus) {
      result.push({
        extensionId: extension2.id,
        id: menu.id,
        title: menu.title,
        action: menu.action,
        surface: menu.surface,
        ...menu.separator ? { separator: true } : {},
        ...menu.when ? { when: menu.when } : {}
      });
    }
  }
  return result;
}
function toSelectionActionRegistration(extensionId, action) {
  return {
    extensionId,
    id: action.id,
    title: action.title,
    action: action.action,
    kinds: action.kinds,
    ...action.icon ? { icon: action.icon } : {},
    ...action.args !== void 0 ? { args: action.args } : {},
    ...action.when ? { when: action.when } : {},
    ...typeof action.priority === "number" ? { priority: action.priority } : {}
  };
}
function normalizeSettingItems(value) {
  if (typeof value !== "string") {
    return [];
  }
  return value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
}
function expandSelectionActionFromSetting(extensionId, action, settings) {
  const settingItems = action.settingItems;
  if (!settingItems) {
    return [toSelectionActionRegistration(extensionId, action)];
  }
  if (typeof settings[settingItems.key] !== "string") {
    return [toSelectionActionRegistration(extensionId, action)];
  }
  const items = normalizeSettingItems(settings[settingItems.key]);
  if (items.length === 0) {
    return [];
  }
  const baseArgs = action.args && typeof action.args === "object" && !Array.isArray(action.args) ? action.args : {};
  const idPrefix = settingItems.idPrefix?.trim() || action.id;
  return items.map((item, index2) => {
    const [firstToken = item] = item.split(/\s+/, 1);
    const args = settingItems.argsKey ? { ...baseArgs, [settingItems.argsKey]: item } : action.args;
    return {
      extensionId,
      id: `${idPrefix}-${index2 + 1}`,
      title: item,
      action: action.action,
      kinds: action.kinds,
      ...settingItems.icon === "firstToken" ? { icon: firstToken } : action.icon ? { icon: action.icon } : {},
      ...args !== void 0 ? { args } : {},
      ...action.when ? { when: action.when } : {},
      priority: action.priority !== void 0 ? action.priority - index2 : -index2
    };
  });
}
function normalizeSelectionActions(extensions, settings) {
  const result = [];
  for (const extension2 of extensions) {
    const actions = extension2.contributes?.selectionActions;
    if (!actions?.length) continue;
    for (const action of actions) {
      result.push(...expandSelectionActionFromSetting(extension2.id, action, settings));
    }
  }
  result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return result;
}
function normalizeThreadHeaderActions(extensions) {
  const result = [];
  for (const extension2 of extensions) {
    const actions = extension2.contributes?.threadHeaderActions;
    if (!actions?.length) continue;
    for (const action of actions) {
      result.push({
        extensionId: extension2.id,
        id: action.id,
        component: action.component,
        ...action.title ? { title: action.title } : {},
        ...typeof action.priority === "number" ? { priority: action.priority } : {},
        frontendEntry: extension2.frontend?.entry
      });
    }
  }
  result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return result;
}
function normalizeStatusBarItems(extensions) {
  const result = [];
  for (const extension2 of extensions) {
    const items = extension2.contributes?.statusBarItems;
    if (!items?.length) continue;
    for (const item of items) {
      result.push({
        extensionId: extension2.id,
        id: item.id,
        label: item.label,
        ...item.action ? { action: item.action } : {},
        ...item.component ? { component: item.component } : {},
        alignment: item.alignment ?? "right",
        ...typeof item.priority === "number" ? { priority: item.priority } : {},
        frontendEntry: extension2.frontend?.entry
      });
    }
  }
  result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return result;
}
function normalizeExtensionRegistryState(extensions, routes, surfaces, settings) {
  const registryExtensions = normalizeRegistryExtensions(extensions);
  const enabledRegistryExtensions = registryExtensions.filter((extension2) => extension2.enabled);
  const enabledExtensionIds = new Set(enabledRegistryExtensions.map((extension2) => extension2.id));
  const settingsComponents = normalizeSettingsComponents(enabledRegistryExtensions);
  const composerControls = normalizeComposerControls(enabledRegistryExtensions);
  return {
    extensions: registryExtensions,
    routes: routes.filter((route) => enabledExtensionIds.has(route.extensionId)),
    surfaces: surfaces.filter((surface) => enabledExtensionIds.has(surface.extensionId)),
    topBarElements: normalizeTopBarElements(enabledRegistryExtensions),
    messageActions: normalizeMessageActions(enabledRegistryExtensions),
    composerShelves: normalizeComposerShelves(enabledRegistryExtensions),
    newConversationPanels: normalizeNewConversationPanels(enabledRegistryExtensions),
    settingsComponents,
    settingsComponent: settingsComponents[0] ?? null,
    composerControls,
    composerInputTools: normalizeComposerInputTools(enabledRegistryExtensions),
    toolbarActions: normalizeToolbarActions(enabledRegistryExtensions),
    contextMenus: normalizeContextMenus(enabledRegistryExtensions),
    selectionActions: normalizeSelectionActions(enabledRegistryExtensions, settings),
    threadHeaderActions: normalizeThreadHeaderActions(enabledRegistryExtensions),
    statusBarItems: normalizeStatusBarItems(enabledRegistryExtensions),
    conversationHeaderElements: normalizeConversationHeaderElements(enabledRegistryExtensions),
    conversationDecorators: normalizeConversationDecorators(enabledRegistryExtensions),
    activityTreeItemElements: normalizeActivityTreeItemElements(enabledRegistryExtensions),
    activityTreeItemStyles: normalizeActivityTreeItemStyles(enabledRegistryExtensions),
    conversationLifecycle: normalizeConversationLifecycle(enabledRegistryExtensions),
    composerAttachmentProviders: normalizeComposerAttachmentProviders(enabledRegistryExtensions),
    composerAttachmentRenderers: normalizeComposerAttachmentRenderers(enabledRegistryExtensions),
    composerAttachmentResolvers: normalizeComposerAttachmentResolvers(enabledRegistryExtensions),
    activityTreeItemActions: normalizeActivityTreeItemActions(enabledRegistryExtensions),
    loading: false,
    error: null
  };
}

// packages/desktop/ui/src/extensions/useExtensionRegistry.ts
var ExtensionRegistryContext = createContext(EMPTY_EXTENSION_REGISTRY_STATE);
var initialExtensionRegistryState = null;
var initialExtensionRegistryLoad = criticalExtensionRegistryPrewarm ? criticalExtensionRegistryPrewarm.then(({ extensions, routes, surfaces, settings }) => normalizeExtensionRegistryState(extensions, routes, surfaces, settings)).then((state) => {
  initialExtensionRegistryState = state;
  recordLoadedExtensionRegistry(state);
  return state;
}).catch(() => {
  initialExtensionRegistryState = EMPTY_EXTENSION_REGISTRY_STATE;
  recordExtensionRegistryUsability({ loading: false, counts: {} });
  return EMPTY_EXTENSION_REGISTRY_STATE;
}) : null;
function recordLoadedExtensionRegistry(state) {
  recordExtensionRegistryUsability({
    loading: false,
    counts: {
      extensions: state.extensions.length,
      routes: state.routes.length,
      surfaces: state.surfaces.length,
      topBarElements: state.topBarElements.length,
      composerControls: state.composerControls.length,
      composerInputTools: state.composerInputTools.length
    }
  });
}
function useExtensionRegistry() {
  return useContext(ExtensionRegistryContext);
}

// packages/desktop/ui/src/store/createEntityStore.ts
function createEntityStore(initial, idAccessor) {
  const getId = idAccessor ?? ((entity) => entity.id);
  let entities = /* @__PURE__ */ new Map();
  let snapshots = /* @__PURE__ */ new Map();
  let allSnapshot = [];
  let _ready = false;
  const readyListeners = /* @__PURE__ */ new Set();
  const listeners2 = /* @__PURE__ */ new Map();
  const allListeners = /* @__PURE__ */ new Set();
  const rebuildAllSnapshot = () => {
    allSnapshot = Array.from(entities.values());
  };
  const notifyId = (id) => {
    listeners2.get(id)?.forEach((cb) => cb());
  };
  const notifyAll = () => {
    allListeners.forEach((cb) => cb());
  };
  const setReady = () => {
    if (!_ready) {
      _ready = true;
      readyListeners.forEach((cb) => cb(true));
    }
  };
  if (initial) {
    for (const entity of initial) {
      const key = getId(entity);
      entities.set(key, entity);
    }
    snapshots = new Map(entities);
    rebuildAllSnapshot();
  }
  return {
    subscribe(id, callback) {
      if (!listeners2.has(id)) listeners2.set(id, /* @__PURE__ */ new Set());
      listeners2.get(id).add(callback);
      return () => {
        listeners2.get(id)?.delete(callback);
      };
    },
    subscribeAll(callback) {
      allListeners.add(callback);
      return () => {
        allListeners.delete(callback);
      };
    },
    subscribeReady(callback) {
      readyListeners.add(callback);
      if (_ready) callback(true);
      return () => {
        readyListeners.delete(callback);
      };
    },
    get(id) {
      return snapshots.get(id);
    },
    getAll() {
      return allSnapshot;
    },
    get size() {
      return entities.size;
    },
    get ready() {
      return _ready;
    },
    // ── Mutations ──
    markReady() {
      setReady();
    },
    upsert(entity) {
      const key = getId(entity);
      entities.set(key, entity);
      snapshots.set(key, entity);
      rebuildAllSnapshot();
      notifyId(key);
      notifyAll();
    },
    patch(id, partial) {
      const current = entities.get(id);
      if (!current) return;
      let changed = false;
      const keys2 = Object.keys(partial);
      for (const key of keys2) {
        if (current[key] !== partial[key]) {
          changed = true;
          break;
        }
      }
      if (!changed) return;
      const next = { ...current, ...partial };
      entities.set(id, next);
      snapshots.set(id, next);
      rebuildAllSnapshot();
      notifyId(id);
      notifyAll();
    },
    replaceAll(newEntities) {
      const newMap = /* @__PURE__ */ new Map();
      for (const entity of newEntities) {
        newMap.set(getId(entity), entity);
      }
      const affectedIds = /* @__PURE__ */ new Set();
      for (const [id, current] of entities) {
        const next = newMap.get(id);
        if (!next) {
          affectedIds.add(id);
        } else if (JSON.stringify(current) !== JSON.stringify(next)) {
          affectedIds.add(id);
        }
      }
      for (const id of newMap.keys()) {
        if (!entities.has(id)) {
          affectedIds.add(id);
        }
      }
      entities.clear();
      snapshots.clear();
      for (const [id, entity] of newMap) {
        entities.set(id, entity);
        snapshots.set(id, entity);
      }
      rebuildAllSnapshot();
      for (const id of affectedIds) {
        notifyId(id);
      }
      if (affectedIds.size > 0) {
        notifyAll();
      }
    },
    remove(id) {
      const existed = entities.delete(id);
      snapshots.delete(id);
      rebuildAllSnapshot();
      if (existed) {
        notifyId(id);
        notifyAll();
      }
    },
    reset() {
      const oldIds = new Set(entities.keys());
      entities = /* @__PURE__ */ new Map();
      snapshots = /* @__PURE__ */ new Map();
      allSnapshot = [];
      _ready = false;
      for (const id of oldIds) {
        notifyId(id);
      }
      notifyAll();
      readyListeners.forEach((cb) => cb(false));
    }
  };
}

// packages/desktop/ui/src/store/hooks.ts
init_neon_pilot_shared_react();

// packages/desktop/ui/src/store/stores.ts
var sessionStore = createEntityStore();
var taskStore = createEntityStore();
var runStore = createEntityStore(void 0, (r) => r.runId);
var executionStore = createEntityStore();
var conversationActivityStatusStates = /* @__PURE__ */ new Map();
var conversationRuntimeStates = /* @__PURE__ */ new Map();
var conversationActivityStatusVersion = 0;
var conversationActivityStatusListeners = /* @__PURE__ */ new Map();
var conversationActivityStatusAllListeners = /* @__PURE__ */ new Set();
function isActiveExecutionStatus(status) {
  return status === "pending" || status === "queued" || status === "waiting" || status === "running" || status === "recovering";
}
function computeConversationActivityStatus(sessionId) {
  const backendRuntime = conversationRuntimeStates.get(sessionId);
  if (backendRuntime?.running === true) return "streaming";
  const session = sessionStore.get(sessionId);
  if (!session) return "idle";
  if (backendRuntime === void 0 && session.isRunning) return "streaming";
  const hasAutomation = taskStore.getAll().some((t) => (t.running || t.enabled) && t.threadConversationId === sessionId);
  if (hasAutomation) return "automation";
  const hasPendingRuns = executionStore.getAll().some((e) => e.conversationId === sessionId && isActiveExecutionStatus(e.status));
  if (hasPendingRuns) return "hasRuns";
  return "idle";
}
function rederiveConversationActivityStatusForAll() {
  const affectedIds = /* @__PURE__ */ new Set();
  for (const id of conversationActivityStatusStates.keys()) {
    const next = computeConversationActivityStatus(id);
    const current = conversationActivityStatusStates.get(id);
    if (current !== next) {
      conversationActivityStatusStates.set(id, next);
      affectedIds.add(id);
    }
  }
  if (affectedIds.size === 0) return;
  conversationActivityStatusVersion += 1;
  for (const id of affectedIds) {
    conversationActivityStatusListeners.get(id)?.forEach((cb) => cb());
  }
  conversationActivityStatusAllListeners.forEach((cb) => cb());
}
sessionStore.subscribeAll(() => rederiveConversationActivityStatusForAll());
taskStore.subscribeAll(() => rederiveConversationActivityStatusForAll());
executionStore.subscribeAll(() => rederiveConversationActivityStatusForAll());

// packages/desktop/ui/src/store/hooks.ts
function useAllSessions() {
  const subscribe = useCallback((onStoreChange) => sessionStore.subscribeAll(onStoreChange), []);
  const getSnapshot = useCallback(() => sessionStore.getAll(), []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
function useAllTasks() {
  const subscribe = useCallback((onStoreChange) => taskStore.subscribeAll(onStoreChange), []);
  const getSnapshot = useCallback(() => taskStore.getAll(), []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
function useAllRuns() {
  const subscribe = useCallback((onStoreChange) => runStore.subscribeAll(onStoreChange), []);
  const getSnapshot = useCallback(() => runStore.getAll(), []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// packages/desktop/ui/src/transcript/spotlight.ts
var SPOTLIGHT_CLASS = "pa-transcript-spotlight";
var SPOTLIGHT_DURATION_MS = 1600;
function escapeAttr(value) {
  return typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(value) : value.replace(/["\\]/g, "\\$&");
}
function transcriptTargetAttributes(target) {
  switch (target.kind) {
    case "block":
      return { "data-transcript-target": `block:${target.blockId}`, "data-transcript-block-id": target.blockId };
    case "tool_call":
      return { "data-transcript-target": `tool_call:${target.blockId}`, "data-transcript-tool-call-id": target.blockId };
    case "background_run":
      return { "data-transcript-target": `background_run:${target.runId}`, "data-background-run-id": target.runId };
    case "extension":
      return {
        "data-transcript-target": `extension:${target.extensionId}:${target.targetId}`,
        "data-transcript-extension-id": target.extensionId,
        "data-transcript-extension-target-id": target.targetId
      };
  }
}
function transcriptTargetSelector(target) {
  switch (target.kind) {
    case "block":
      return `[data-transcript-block-id="${escapeAttr(target.blockId)}"], [data-transcript-target="block:${escapeAttr(target.blockId)}"]`;
    case "tool_call":
      return `[data-transcript-tool-call-id="${escapeAttr(target.blockId)}"], [data-transcript-target="tool_call:${escapeAttr(target.blockId)}"]`;
    case "background_run":
      return `[data-background-run-id="${escapeAttr(target.runId)}"], [data-transcript-target="background_run:${escapeAttr(target.runId)}"]`;
    case "extension":
      return `[data-transcript-extension-id="${escapeAttr(target.extensionId)}"][data-transcript-extension-target-id="${escapeAttr(
        target.targetId
      )}"], [data-transcript-target="extension:${escapeAttr(target.extensionId)}:${escapeAttr(target.targetId)}"]`;
  }
}
function spotlightTranscriptElement(element3) {
  if (typeof element3.scrollIntoView === "function") {
    element3.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }
  if (element3 instanceof HTMLElement) {
    if (typeof element3.focus === "function") {
      element3.focus({ preventScroll: true });
    }
    element3.classList.remove(SPOTLIGHT_CLASS);
    void element3.offsetWidth;
    element3.classList.add(SPOTLIGHT_CLASS);
    window.setTimeout(() => element3.classList.remove(SPOTLIGHT_CLASS), SPOTLIGHT_DURATION_MS);
  }
}
function spotlightTranscriptTarget(target) {
  const element3 = document.querySelector(transcriptTargetSelector(target));
  if (!element3) return false;
  spotlightTranscriptElement(element3);
  return true;
}
function dispatchTranscriptSpotlight(target, options) {
  window.dispatchEvent(new CustomEvent("pa:transcript-spotlight", { detail: { target, options } }));
}

// packages/desktop/ui/src/transcript/messageBlocks.ts
var DEFERRED_ENTRY_HYDRATION_PREFIX = "entries:";
function buildDeferredEntryHydrationId(entryIds) {
  const normalizedEntryIds = [...new Set(entryIds.map((entryId) => entryId.trim()).filter(Boolean))];
  return normalizedEntryIds.length > 0 ? `${DEFERRED_ENTRY_HYDRATION_PREFIX}${JSON.stringify(normalizedEntryIds)}` : null;
}

// packages/desktop/ui/src/components/chat/ImageMessageBlocks.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/components/chat/imagePreviewCommands.ts
var IMAGE_PREVIEW_CLOSE_COMMAND_EVENT = "neon-pilot-image-preview-close-command";
var IMAGE_PREVIEW_INSPECT_FIRST_COMMAND_EVENT = "neon-pilot:image-preview-inspect-first";
var IMAGE_PREVIEW_LOAD_FIRST_COMMAND_EVENT = "neon-pilot:image-preview-load-first";
var imagePreviewContextKeys = {
  inspect: "imagePreview.canInspectFirst",
  load: "imagePreview.canLoadFirst"
};
var imagePreviewCapabilityCounts = /* @__PURE__ */ new Map();
function registerImagePreviewCapability(capability) {
  const nextCount = (imagePreviewCapabilityCounts.get(capability) ?? 0) + 1;
  imagePreviewCapabilityCounts.set(capability, nextCount);
  setExtensionCommandContext(imagePreviewContextKeys[capability], true);
  return () => {
    const currentCount = imagePreviewCapabilityCounts.get(capability) ?? 0;
    const remainingCount = Math.max(0, currentCount - 1);
    if (remainingCount === 0) {
      imagePreviewCapabilityCounts.delete(capability);
      setExtensionCommandContext(imagePreviewContextKeys[capability], null);
      return;
    }
    imagePreviewCapabilityCounts.set(capability, remainingCount);
  };
}

// packages/desktop/ui/src/components/chat/ImageMessageBlocks.tsx
function ImageInspectModal({ image: image3, onClose }) {
  const label = image3.caption?.trim() || image3.alt.trim() || "Conversation image";
  useEffect(() => {
    setExtensionCommandContext("imagePreview.active", true);
    return () => setExtensionCommandContext("imagePreview.active", null);
  }, []);
  useEffect(() => {
    function closeFromKeyboard(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }
    function closeFromCommand() {
      onClose();
    }
    window.addEventListener("keydown", closeFromKeyboard);
    window.addEventListener(IMAGE_PREVIEW_CLOSE_COMMAND_EVENT, closeFromCommand);
    return () => {
      window.removeEventListener("keydown", closeFromKeyboard);
      window.removeEventListener(IMAGE_PREVIEW_CLOSE_COMMAND_EVENT, closeFromCommand);
    };
  }, [onClose]);
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: "ui-overlay-backdrop",
      style: { background: "rgb(0 0 0 / 0.72)", backdropFilter: "blur(2px)", paddingTop: "1rem" },
      onMouseDown: (event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      },
      children: /* @__PURE__ */ jsx(
        "div",
        {
          role: "dialog",
          "aria-modal": "true",
          "aria-label": label,
          className: "ui-dialog-shell relative",
          style: {
            width: "min(96vw, 1440px)",
            height: "min(94vh, 1040px)",
            maxHeight: "calc(100vh - 2rem)",
            background: "rgb(10 13 20 / 0.96)"
          },
          children: /* @__PURE__ */ jsxs("div", { className: "relative min-h-0 flex-1 bg-black/30 px-4 py-4 sm:px-6 sm:py-6", children: [
            /* @__PURE__ */ jsxs("div", { className: "pointer-events-none absolute inset-x-4 top-4 z-10 flex items-start justify-between gap-3 sm:inset-x-6 sm:top-6", children: [
              /* @__PURE__ */ jsxs("div", { className: "pointer-events-auto min-w-0 rounded-lg bg-black/45 px-3 py-1.5", title: label, children: [
                /* @__PURE__ */ jsx("p", { className: "truncate text-[12px] font-medium text-white/95", children: label }),
                image3.width && image3.height ? /* @__PURE__ */ jsxs("p", { className: "mt-0.5 text-[10px] text-white/60", children: [
                  image3.width,
                  "\xD7",
                  image3.height
                ] }) : null
              ] }),
              /* @__PURE__ */ jsx(
                IconButton,
                {
                  shape: "circle",
                  compact: true,
                  onClick: onClose,
                  "aria-label": "Close image preview",
                  className: "pointer-events-auto h-8 w-8 shrink-0 border-white/15 bg-black/45 text-[16px] leading-none text-white/80 hover:text-white",
                  children: "\xD7"
                }
              )
            ] }),
            /* @__PURE__ */ jsx("img", { src: image3.src, alt: image3.alt, className: "h-full w-full object-contain" })
          ] })
        }
      )
    }
  );
}
function ImagePreview({
  alt,
  src,
  caption,
  width,
  height,
  maxHeight,
  deferred = false,
  loading = false,
  onLoad,
  onInspect
}) {
  const inspectableImage = src ? {
    alt,
    src,
    caption,
    width,
    height
  } : null;
  useEffect(() => {
    if (!inspectableImage || !onInspect) return void 0;
    return registerImagePreviewCapability("inspect");
  }, [inspectableImage, onInspect]);
  useEffect(() => {
    if (!deferred || !onLoad) return void 0;
    return registerImagePreviewCapability("load");
  }, [deferred, onLoad]);
  useEffect(() => {
    function handleInspectFirstCommand(event) {
      const detail = event.detail;
      if (detail?.handled || !inspectableImage || !onInspect) return;
      if (detail) detail.handled = true;
      onInspect(inspectableImage);
    }
    function handleLoadFirstCommand(event) {
      const detail = event.detail;
      if (detail?.handled || !deferred || loading || !onLoad) return;
      if (detail) detail.handled = true;
      void onLoad();
    }
    window.addEventListener(IMAGE_PREVIEW_INSPECT_FIRST_COMMAND_EVENT, handleInspectFirstCommand);
    window.addEventListener(IMAGE_PREVIEW_LOAD_FIRST_COMMAND_EVENT, handleLoadFirstCommand);
    return () => {
      window.removeEventListener(IMAGE_PREVIEW_INSPECT_FIRST_COMMAND_EVENT, handleInspectFirstCommand);
      window.removeEventListener(IMAGE_PREVIEW_LOAD_FIRST_COMMAND_EVENT, handleLoadFirstCommand);
    };
  }, [deferred, inspectableImage, loading, onInspect, onLoad]);
  return /* @__PURE__ */ jsxs(SurfacePanel, { muted: true, className: "overflow-hidden", children: [
    inspectableImage ? /* @__PURE__ */ jsx(
      MediaPreviewButton,
      {
        onClick: () => onInspect?.(inspectableImage),
        "aria-label": `Inspect image: ${caption ?? alt}`,
        title: "Inspect image",
        children: /* @__PURE__ */ jsx("img", { src: inspectableImage.src, alt, className: "block w-full object-contain bg-elevated", style: { maxHeight } })
      }
    ) : /* @__PURE__ */ jsxs(
      "div",
      {
        className: "w-full bg-elevated flex flex-col items-center justify-center gap-2 px-4 py-5 text-dim",
        style: { aspectRatio: `${width ?? 16} / ${height ?? 9}`, maxHeight },
        children: [
          /* @__PURE__ */ jsxs(
            "svg",
            {
              width: "28",
              height: "28",
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: "1.4",
              strokeLinecap: "round",
              strokeLinejoin: "round",
              className: "opacity-40",
              children: [
                /* @__PURE__ */ jsx("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }),
                /* @__PURE__ */ jsx("circle", { cx: "8.5", cy: "8.5", r: "1.5" }),
                /* @__PURE__ */ jsx("path", { d: "m21 15-5-5L5 21" })
              ]
            }
          ),
          /* @__PURE__ */ jsx("span", { className: "text-[11px] font-mono opacity-50", children: alt }),
          width && /* @__PURE__ */ jsxs("span", { className: "text-[10px] opacity-35", children: [
            width,
            "\xD7",
            height
          ] }),
          deferred && onLoad && /* @__PURE__ */ jsx(
            Button,
            {
              variant: "action",
              onClick: () => {
                void onLoad();
              },
              disabled: loading,
              className: "text-[11px]",
              children: loading ? "Loading image\u2026" : "Load image"
            }
          )
        ]
      }
    ),
    (caption || !src && alt) && /* @__PURE__ */ jsx("div", { className: "px-3 py-2 bg-surface border-t border-border-subtle", children: /* @__PURE__ */ jsx("p", { className: "text-[11px] text-dim font-mono", children: caption ?? alt }) })
  ] });
}
var ImageBlock = memo(function ImageBlock2({
  block,
  onHydrateMessage,
  hydratingMessageBlockIds,
  onInspectImage
}) {
  const blockId = typeof block.id === "string" ? block.id.trim() : "";
  const canHydrate = Boolean(block.deferred && blockId && onHydrateMessage);
  const loading = Boolean(blockId && hydratingMessageBlockIds?.has(blockId));
  return /* @__PURE__ */ jsx(
    ImagePreview,
    {
      alt: block.alt,
      src: block.src,
      caption: block.caption,
      width: block.width,
      height: block.height,
      maxHeight: 320,
      deferred: block.deferred,
      loading,
      onLoad: canHydrate ? () => onHydrateMessage?.(blockId) : void 0,
      onInspect: onInspectImage
    }
  );
});

// packages/desktop/ui/src/components/chat/MessageBlocks.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/markdown/markdownExtensions.tsx
init_neon_pilot_shared_react();
function parseSkillBlock(text7) {
  const match = text7.match(/^<skill name="([^"]+)" location="([^"]+)">\n([\s\S]*?)\n<\/skill>(?:\n\n([\s\S]+))?$/);
  if (!match) {
    return null;
  }
  return {
    name: match[1] ?? "",
    location: match[2] ?? "",
    content: match[3] ?? "",
    userMessage: match[4]?.trim() || void 0
  };
}

// packages/desktop/ui/src/components/chat/InlineTraceRunCard.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/automation/runPresentation.ts
function isRunActive(run) {
  const status = run?.status?.status;
  return status === "queued" || status === "waiting" || status === "running" || status === "recovering";
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function readString(record, key) {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : void 0;
}
function readSpec(run, key) {
  return isRecord(run.manifest?.spec) ? readString(run.manifest.spec, key) : void 0;
}
function readNestedSpec(run, key, nestedKey) {
  if (!isRecord(run.manifest?.spec)) {
    return void 0;
  }
  const value = run.manifest.spec[key];
  return isRecord(value) ? readString(value, nestedKey) : void 0;
}
function readCheckpoint(run, key) {
  return isRecord(run.checkpoint?.payload) ? readString(run.checkpoint.payload, key) : void 0;
}
function readNestedCheckpoint(run, key, nestedKey) {
  if (!isRecord(run.checkpoint?.payload)) {
    return void 0;
  }
  const value = run.checkpoint.payload[key];
  return isRecord(value) ? readString(value, nestedKey) : void 0;
}
function readTargetSpec(run, key) {
  return readNestedSpec(run, "target", key);
}
function readTargetCheckpoint(run, key) {
  return readNestedCheckpoint(run, "target", key);
}
function readMetadataSpec(run, key) {
  return readNestedSpec(run, "metadata", key);
}
function readMetadataCheckpoint(run, key) {
  return readNestedCheckpoint(run, "metadata", key);
}
function getRunTaskSlug(run) {
  return readMetadataSpec(run, "taskSlug") ?? readMetadataCheckpoint(run, "taskSlug") ?? readSpec(run, "taskSlug") ?? readCheckpoint(run, "taskSlug");
}
function getRunTargetPrompt(run) {
  return readTargetSpec(run, "prompt") ?? readTargetCheckpoint(run, "prompt") ?? readNestedSpec(run, "agent", "prompt") ?? readNestedCheckpoint(run, "agent", "prompt") ?? readSpec(run, "prompt") ?? readCheckpoint(run, "prompt");
}
function getRunTargetCommand(run) {
  return readTargetSpec(run, "command") ?? readTargetCheckpoint(run, "command") ?? readSpec(run, "shellCommand") ?? readCheckpoint(run, "shellCommand");
}
function getRunWorkingDirectory(run) {
  return readTargetSpec(run, "cwd") ?? readTargetCheckpoint(run, "cwd") ?? readMetadataSpec(run, "cwd") ?? readMetadataCheckpoint(run, "cwd") ?? readSpec(run, "cwd") ?? readCheckpoint(run, "cwd");
}
function getRunTargetModel(run) {
  return readTargetSpec(run, "model") ?? readTargetCheckpoint(run, "model") ?? readNestedSpec(run, "agent", "model") ?? readNestedCheckpoint(run, "agent", "model") ?? readSpec(run, "model") ?? readCheckpoint(run, "model");
}
function getRunTargetProfile(run) {
  return readTargetSpec(run, "profile") ?? readTargetCheckpoint(run, "profile") ?? readNestedSpec(run, "agent", "profile") ?? readNestedCheckpoint(run, "agent", "profile") ?? readSpec(run, "profile") ?? readCheckpoint(run, "profile");
}
function excerpt(value, maxLength = 88) {
  if (!value) {
    return void 0;
  }
  const firstLine = value.split(/\r?\n/).map((line) => line.trim()).find((line) => line.length > 0);
  if (!firstLine) {
    return void 0;
  }
  const normalized = firstLine.replace(/\s+/g, " ");
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trimEnd()}\u2026`;
}
function tokenizeShell(command) {
  const tokens = [];
  let index2 = 0;
  while (index2 < command.length) {
    while (index2 < command.length && /\s/.test(command[index2] ?? "")) {
      index2 += 1;
    }
    if (index2 >= command.length) {
      break;
    }
    const start2 = index2;
    let quote = null;
    while (index2 < command.length) {
      const char = command[index2] ?? "";
      if (quote) {
        if (char === "\\" && quote === '"' && index2 + 1 < command.length) {
          index2 += 2;
          continue;
        }
        index2 += 1;
        if (char === quote) {
          quote = null;
        }
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        index2 += 1;
        continue;
      }
      if (char === "\\" && index2 + 1 < command.length) {
        index2 += 2;
        continue;
      }
      if (/\s/.test(char)) {
        break;
      }
      index2 += 1;
    }
    tokens.push({
      raw: command.slice(start2, index2),
      start: start2
    });
  }
  return tokens;
}
function shellTokenValue(token) {
  if (token.startsWith('"') && token.endsWith('"') || token.startsWith("'") && token.endsWith("'")) {
    return token.slice(1, -1);
  }
  return token;
}
function isShellEnvAssignment(token) {
  return /^[A-Za-z_][A-Za-z0-9_]*=/.test(token);
}
function stripLeadingShellEnvironment(command) {
  if (!command) {
    return void 0;
  }
  const trimmed = command.trim();
  if (!trimmed) {
    return void 0;
  }
  const tokens = tokenizeShell(trimmed);
  if (tokens.length === 0) {
    return trimmed;
  }
  let index2 = 0;
  if (shellTokenValue(tokens[0]?.raw ?? "") === "env") {
    index2 = 1;
    while (index2 < tokens.length) {
      const token = shellTokenValue(tokens[index2]?.raw ?? "");
      if (!token) {
        index2 += 1;
        continue;
      }
      if (token === "--") {
        index2 += 1;
        break;
      }
      if (token === "-u" || token === "--unset" || token === "-C" || token === "--chdir" || token === "-S" || token === "--split-string") {
        index2 += 2;
        continue;
      }
      if (token === "-i" || token === "--ignore-environment" || token === "-0" || token === "--null" || token.startsWith("--unset=") || token.startsWith("--chdir=") || token.startsWith("-u") && token.length > 2 || token.startsWith("-C") && token.length > 2) {
        index2 += 1;
        continue;
      }
      if (!token.startsWith("-")) {
        break;
      }
      index2 += 1;
    }
  }
  while (index2 < tokens.length && isShellEnvAssignment(tokens[index2]?.raw ?? "")) {
    index2 += 1;
  }
  if (index2 <= 0 || index2 >= tokens.length) {
    return trimmed;
  }
  return trimmed.slice(tokens[index2]?.start ?? 0).trim();
}
function normalizeShellHeadlineCommand(command) {
  const withoutEnvironment = stripLeadingShellEnvironment(command);
  if (!withoutEnvironment) {
    return void 0;
  }
  const tokens = tokenizeShell(withoutEnvironment);
  const runIndex = tokens.findIndex((token) => shellTokenValue(token.raw) === "run");
  const scriptToken = runIndex >= 0 ? tokens[runIndex + 1] : void 0;
  if (!scriptToken || shellTokenValue(scriptToken.raw) !== "dev:client") {
    return withoutEnvironment;
  }
  return `${withoutEnvironment.slice(0, scriptToken.start)}dev`.trim();
}
function excerptShellCommand(command, maxLength = 88) {
  return excerpt(normalizeShellHeadlineCommand(command), maxLength);
}
function getRunTaskId(run) {
  return run.manifest?.source?.type === "scheduled-task" ? run.manifest.source.id ?? readMetadataSpec(run, "taskId") ?? readSpec(run, "taskId") : run.manifest?.kind === "scheduled-task" ? run.manifest?.source?.id ?? readMetadataSpec(run, "taskId") ?? readSpec(run, "taskId") : void 0;
}
function taskById(lookups, taskId) {
  if (!taskId || !lookups.tasks) {
    return void 0;
  }
  return lookups.tasks.find((task) => task.id === taskId);
}
function sessionById(lookups, conversationId) {
  if (!conversationId || !lookups.sessions) {
    return void 0;
  }
  return lookups.sessions.find((session) => session.id === conversationId);
}
function runTranscriptSession(run, lookups) {
  if (!lookups.sessions) {
    return void 0;
  }
  const matches = lookups.sessions.filter((session) => session.sourceRunId === run.runId).sort((left, right) => {
    const leftRoot = left.parentSessionId?.trim() ? 1 : 0;
    const rightRoot = right.parentSessionId?.trim() ? 1 : 0;
    if (leftRoot !== rightRoot) {
      return leftRoot - rightRoot;
    }
    const leftTimestamp = left.lastActivityAt ?? left.timestamp;
    const rightTimestamp = right.lastActivityAt ?? right.timestamp;
    return rightTimestamp.localeCompare(leftTimestamp) || left.id.localeCompare(right.id);
  });
  return matches[0];
}
function conversationLabel(run, lookups) {
  const sourceType = run.manifest?.source?.type;
  const isConversationRun = run.manifest?.kind === "conversation" || sourceType === "web-live-session" || sourceType === "deferred-resume";
  if (isConversationRun) {
    const conversationId = sourceType === "web-live-session" ? run.manifest?.source?.id ?? readTargetSpec(run, "conversationId") ?? readSpec(run, "conversationId") ?? readTargetCheckpoint(run, "conversationId") ?? readCheckpoint(run, "conversationId") : readTargetCheckpoint(run, "conversationId") ?? readCheckpoint(run, "conversationId") ?? readTargetSpec(run, "conversationId") ?? readSpec(run, "conversationId");
    const title = readCheckpoint(run, "title") ?? readMetadataCheckpoint(run, "title") ?? sessionById(lookups, conversationId)?.title;
    return {
      title,
      conversationId
    };
  }
  if (run.manifest?.kind === "background-run" && sourceType === "tool") {
    const conversationId = run.manifest.source?.id;
    const session = sessionById(lookups, conversationId);
    if (session) {
      return {
        title: session.title,
        conversationId: session.id
      };
    }
  }
  return {};
}
function sourceKindLabel(run) {
  if (run.manifest?.source?.type === "scheduled-task" || run.manifest?.kind === "scheduled-task") {
    return "Automation execution";
  }
  if (run.manifest?.source?.type === "web-live-session") {
    return "Conversation session";
  }
  if (run.manifest?.source?.type === "deferred-resume") {
    return "Wakeup";
  }
  if (run.manifest?.kind === "background-run" || run.manifest?.source?.type === "background-run") {
    return "Subagent";
  }
  if (run.manifest?.kind === "raw-shell") {
    return "Background command";
  }
  if (run.manifest?.kind === "workflow") {
    return "Workflow";
  }
  if (run.manifest?.kind === "conversation") {
    return "Conversation session";
  }
  return run.manifest?.kind ?? "Run";
}
function getRunHeadline(run, lookups = {}) {
  if (run.manifest?.source?.type === "scheduled-task" || run.manifest?.kind === "scheduled-task") {
    const taskId = getRunTaskId(run);
    const task = taskById(lookups, taskId);
    const title = task?.title ?? excerpt(task?.prompt) ?? taskId ?? run.runId;
    const kindLabel = task?.targetType === "conversation" ? "Thread automation" : "Automation execution";
    const summary = task?.title && taskId && task.title !== taskId ? `${kindLabel} \xB7 ${task.title}` : taskId ? `${kindLabel} \xB7 ${taskId}` : kindLabel;
    return { title, summary };
  }
  if (run.manifest?.source?.type === "web-live-session") {
    const { title, conversationId } = conversationLabel(run, lookups);
    const headline = title ?? conversationId ?? run.runId;
    const summary = conversationId && headline !== conversationId ? `Conversation session \xB7 ${conversationId}` : "Conversation session";
    return { title: headline, summary };
  }
  if (run.manifest?.source?.type === "deferred-resume") {
    const deferredResumeId = run.manifest.source.id;
    const prompt = excerpt(getRunTargetPrompt(run));
    const { title, conversationId } = conversationLabel(run, lookups);
    const target = title ?? conversationId;
    const headline = prompt ?? target ?? deferredResumeId ?? run.runId;
    const suffix = conversationId ?? deferredResumeId;
    const summary = suffix && headline !== suffix ? `Wakeup \xB7 ${suffix}` : "Wakeup";
    return { title: headline, summary };
  }
  if (run.manifest?.kind === "background-run" || run.manifest?.source?.type === "background-run") {
    const agentPrompt = excerpt(getRunTargetPrompt(run));
    const shellCommand = excerptShellCommand(getRunTargetCommand(run));
    const taskSlug = getRunTaskSlug(run);
    const headline = agentPrompt ?? shellCommand ?? taskSlug ?? run.runId;
    const kindLabel = agentPrompt ? "Subagent" : shellCommand ? "Background command" : "Subagent";
    const summary = taskSlug && headline !== taskSlug ? `${kindLabel} \xB7 ${taskSlug}` : shellCommand && headline !== shellCommand ? `${kindLabel} \xB7 ${shellCommand}` : kindLabel;
    return { title: headline, summary };
  }
  if (run.manifest?.kind === "raw-shell") {
    const shellCommand = excerptShellCommand(getRunTargetCommand(run));
    const taskSlug = getRunTaskSlug(run);
    const title = shellCommand ?? taskSlug ?? run.runId;
    const detail = taskSlug && taskSlug !== title ? taskSlug : void 0;
    return {
      title,
      summary: detail ? `Background command \xB7 ${detail}` : shellCommand ? "Background command" : sourceKindLabel(run)
    };
  }
  return {
    title: run.manifest?.source?.id ?? run.runId,
    summary: sourceKindLabel(run)
  };
}
function getRunConnections(run, lookups = {}) {
  const connections = [];
  const transcriptSession = runTranscriptSession(run, lookups);
  if (transcriptSession) {
    connections.push({
      key: `transcript:${transcriptSession.id}`,
      label: "Conversation transcript",
      value: transcriptSession.title,
      to: `/conversations/${encodeURIComponent(transcriptSession.id)}`,
      detail: transcriptSession.title !== transcriptSession.id ? transcriptSession.id : void 0
    });
  }
  if (run.manifest?.source?.type === "scheduled-task" || run.manifest?.kind === "scheduled-task") {
    const taskId = getRunTaskId(run);
    const task = taskById(lookups, taskId);
    if (taskId) {
      connections.push({
        key: `task:${taskId}`,
        label: "Automation",
        value: task?.title ?? taskId,
        to: `/automations/${encodeURIComponent(taskId)}`,
        detail: task?.title && task.title !== taskId ? taskId : excerpt(task?.prompt) ?? task?.filePath ?? run.manifest?.source?.filePath
      });
    }
  }
  const { title, conversationId } = conversationLabel(run, lookups);
  if (conversationId) {
    connections.push({
      key: `conversation:${conversationId}`,
      label: run.manifest?.source?.type === "deferred-resume" ? "Conversation to reopen" : "Conversation",
      value: title ?? conversationId,
      to: `/conversations/${encodeURIComponent(conversationId)}`,
      detail: title && title !== conversationId ? conversationId : void 0
    });
  }
  if (run.manifest?.source?.type === "deferred-resume" && run.manifest.source.id) {
    const prompt = excerpt(getRunTargetPrompt(run));
    connections.push({
      key: `deferred-resume:${run.manifest.source.id}`,
      label: "Wakeup",
      value: run.manifest.source.id,
      detail: prompt
    });
  }
  const filePath = run.manifest?.source?.filePath;
  if (filePath) {
    connections.push({
      key: `file:${filePath}`,
      label: "Source file",
      value: filePath
    });
  }
  return connections;
}
function getRunMoment(run) {
  if (run.status?.completedAt) {
    return { label: "completed", at: run.status.completedAt };
  }
  if (run.status?.startedAt && run.status.status === "running") {
    return { label: "started", at: run.status.startedAt };
  }
  if (run.status?.updatedAt) {
    return { label: "updated", at: run.status.updatedAt };
  }
  return { label: "created", at: run.manifest?.createdAt };
}
function getRunTimeline(run) {
  const timeline = [
    { label: "Created", at: run.manifest?.createdAt },
    { label: "Started", at: run.status?.startedAt },
    { label: "Updated", at: run.status?.updatedAt },
    { label: "Completed", at: run.status?.completedAt }
  ];
  return timeline.filter((item) => typeof item.at === "string" && item.at.length > 0);
}

// packages/desktop/ui/src/components/chat/linkedRunPolling.ts
init_neon_pilot_shared_react();
var INLINE_RUN_LOG_TAIL_LINES = 240;
var INLINE_RUN_POLL_INTERVAL_MS = 2200;
var MAX_INLINE_RUN_LOG_TAIL_LINES = 1e3;
var MAX_INLINE_RUN_POLL_INTERVAL_MS = 1e4;
var EMPTY_POLLED_RUN_SNAPSHOT_STATE = {
  detail: null,
  log: null,
  loading: false,
  refreshing: false,
  error: null,
  unavailable: false
};
function isDocumentVisible() {
  return typeof document === "undefined" || document.visibilityState !== "hidden";
}
function useDocumentVisible() {
  const [visible, setVisible] = useState(isDocumentVisible);
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const handleVisibilityChange = () => setVisible(isDocumentVisible());
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);
  return visible;
}
function buildInlineRunExpansionKey(clusterStartIndex, runId) {
  return `${clusterStartIndex}:${runId}`;
}
function normalizeInlineRunPollingOptions(options) {
  const tail = Number.isSafeInteger(options?.tail) && options?.tail > 0 ? Math.min(MAX_INLINE_RUN_LOG_TAIL_LINES, options?.tail) : INLINE_RUN_LOG_TAIL_LINES;
  const pollIntervalMs = Number.isSafeInteger(options?.pollIntervalMs) && options?.pollIntervalMs > 0 ? Math.min(MAX_INLINE_RUN_POLL_INTERVAL_MS, options?.pollIntervalMs) : INLINE_RUN_POLL_INTERVAL_MS;
  return { tail, pollIntervalMs };
}
function isDurableRunUnavailableError(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /run not found/i.test(message);
}
function describeDurableRunPollingError(error) {
  if (isDurableRunUnavailableError(error)) {
    return {
      message: "Background task unavailable. It may have been cleaned up or belongs to an older dev session.",
      unavailable: true
    };
  }
  return {
    message: error instanceof Error ? error.message : "Could not load run.",
    unavailable: false
  };
}
function shouldContinuePollingDurableRun(run) {
  if (!run) {
    return true;
  }
  return isRunActive(run);
}
function shouldPollInlineRunSnapshot(input) {
  if (!input.visible || !shouldContinuePollingDurableRun(input.run)) {
    return false;
  }
  return input.open || input.streaming === true;
}
function usePolledDurableRunSnapshot(runId, enabled, options) {
  const { tail, pollIntervalMs } = normalizeInlineRunPollingOptions(options);
  const documentVisible = useDocumentVisible();
  const enabledNow = enabled && documentVisible;
  const [state, setState] = useState(EMPTY_POLLED_RUN_SNAPSHOT_STATE);
  useEffect(() => {
    if (!runId) {
      setState(EMPTY_POLLED_RUN_SNAPSHOT_STATE);
      return;
    }
    setState(
      (current) => current.detail?.run.runId === runId ? current : {
        detail: null,
        log: null,
        loading: false,
        refreshing: false,
        error: null,
        unavailable: false
      }
    );
  }, [runId]);
  useEffect(() => {
    if (!runId || !enabledNow) {
      setState((current) => ({ ...current, loading: false, refreshing: false }));
      return;
    }
    let cancelled = false;
    let inFlight = false;
    let timeoutId = null;
    const stopPolling = () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
    const scheduleNextPoll = (detail) => {
      if (cancelled || !isDocumentVisible() || !shouldContinuePollingDurableRun(detail?.run)) {
        return;
      }
      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        void pollSnapshot(false);
      }, pollIntervalMs);
    };
    const pollSnapshot = async (initial) => {
      if (cancelled || inFlight) {
        return;
      }
      inFlight = true;
      setState((current) => {
        const hasDetail = current.detail?.run.runId === runId;
        return {
          ...current,
          loading: initial && !hasDetail,
          refreshing: !initial && hasDetail,
          error: initial ? null : current.error,
          unavailable: false
        };
      });
      try {
        const [detail, log] = await Promise.all([api.durableRun(runId), api.durableRunLog(runId, tail)]);
        if (cancelled) {
          return;
        }
        setState({
          detail,
          log,
          loading: false,
          refreshing: false,
          error: null,
          unavailable: false
        });
        scheduleNextPoll(detail);
      } catch (error) {
        if (!cancelled) {
          const pollingError = describeDurableRunPollingError(error);
          setState((current) => ({
            ...current,
            loading: false,
            refreshing: false,
            error: pollingError.message,
            unavailable: pollingError.unavailable
          }));
          if (pollingError.unavailable) {
            stopPolling();
          } else {
            scheduleNextPoll(null);
          }
        }
      } finally {
        inFlight = false;
      }
    };
    void pollSnapshot(true);
    return () => {
      stopPolling();
    };
  }, [enabledNow, pollIntervalMs, runId, tail]);
  return state;
}

// packages/desktop/ui/src/conversation/conversationRuns.ts
function looksLikeDurableRunId(value) {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }
  if (normalized.startsWith("conversation-live-") || normalized.startsWith("conversation-deferred-resume-")) {
    return normalized.length > "conversation-live-".length;
  }
  if (!normalized.startsWith("run-") && !normalized.startsWith("task-")) {
    return false;
  }
  const segments = normalized.split("-");
  if (segments.length < 3) {
    return false;
  }
  const tail = segments.at(-1) ?? "";
  return /\d{4}/.test(normalized) || /^[a-f0-9]{6,}$/i.test(tail) || segments.length >= 5;
}
function addRunId(target, seen, value) {
  const normalized = value?.trim();
  if (!normalized || !looksLikeDurableRunId(normalized) || seen.has(normalized)) {
    return;
  }
  seen.add(normalized);
  target.push(normalized);
}
function extractDurableRunIdsFromText(text7) {
  if (!text7.trim()) {
    return [];
  }
  const next = [];
  const seen = /* @__PURE__ */ new Set();
  const patterns = [
    /pa\s+runs\s+(?:show|logs|cancel)\s+([A-Za-z0-9_-]+)/g,
    /^\s*Run\s+([A-Za-z0-9_-]+)\s*$/gm,
    /^\s*Inspect\s+pa\s+runs\s+show\s+([A-Za-z0-9_-]+)\s*$/gm,
    /"runId"\s*:\s*"([A-Za-z0-9_-]+)"/g,
    /\brunId\b\s*[:=]\s*"?([A-Za-z0-9_-]+)/g,
    /\b((?:conversation-live|conversation-deferred-resume)-[A-Za-z0-9_-]+)\b/g,
    /\b((?:run|task)-[A-Za-z0-9_-]+)\b/g
  ];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text7)) !== null) {
      addRunId(next, seen, match[1]);
    }
  }
  return next;
}
function stringifyRecord(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}
function extractDurableRunIdsFromBlock(block) {
  switch (block.type) {
    case "user":
    case "text":
    case "summary":
    case "thinking":
      return extractDurableRunIdsFromText(block.text);
    case "error":
      return extractDurableRunIdsFromText(block.message);
    case "subagent": {
      const parts = [block.name, block.prompt, block.summary].filter((value) => typeof value === "string");
      return extractDurableRunIdsFromText(parts.join("\n"));
    }
    case "image":
      return [];
    case "tool_use": {
      const parts = [stringifyRecord(block.input)];
      if (block.output) {
        parts.push(block.output);
      }
      if (block.details && typeof block.details === "object" && !Array.isArray(block.details)) {
        parts.push(stringifyRecord(block.details));
      }
      return extractDurableRunIdsFromText(parts.join("\n"));
    }
    default:
      return [];
  }
}

// packages/desktop/ui/src/components/chat/summaryPreview.ts
var MAX_SUMMARY_PREVIEW_LINES = 8;
function stripPreviewMarkdownWrappers(line) {
  if (line.startsWith("**") && line.endsWith("**") || line.startsWith("__") && line.endsWith("__")) {
    return line.slice(2, -2).trim();
  }
  if (line.startsWith("*") && line.endsWith("*") || line.startsWith("_") && line.endsWith("_") || line.startsWith("`") && line.endsWith("`")) {
    return line.slice(1, -1).trim();
  }
  return line;
}
function formatSummaryPreviewLine(line) {
  let normalized = line;
  if (/^#{1,6}\s+/.test(normalized)) {
    normalized = normalized.replace(/^#{1,6}\s+/, "");
  }
  if (/^[-*+]\s+/.test(normalized)) {
    return `\u2022 ${stripPreviewMarkdownWrappers(normalized.replace(/^[-*+]\s+/, ""))}`;
  }
  return stripPreviewMarkdownWrappers(normalized);
}
function buildSummaryPreview(text7, maxLines) {
  const lineLimit = Number.isSafeInteger(maxLines) && maxLines > 0 ? Math.min(MAX_SUMMARY_PREVIEW_LINES, maxLines) : 1;
  const previewLines = [];
  for (const rawLine of text7.split("\n")) {
    const trimmed = rawLine.trim();
    if (trimmed.length === 0) {
      continue;
    }
    previewLines.push(formatSummaryPreviewLine(trimmed));
    if (previewLines.length >= lineLimit) {
      break;
    }
  }
  return previewLines.join("\n");
}

// packages/desktop/ui/src/components/chat/toolPresentation.ts
var TOOL_META = {
  bash: { icon: "$", label: "bash", color: "border border-border-subtle/70 bg-elevated/25 text-steel", tone: "steel" },
  background_bash: {
    icon: "$",
    label: "background task",
    color: "border border-border-subtle/70 bg-elevated/25 text-steel",
    tone: "steel"
  },
  read: { icon: "\u2261", label: "read", color: "border border-border-subtle/70 bg-elevated/25 text-teal", tone: "teal" },
  write: { icon: "\u270E", label: "write", color: "border border-border-subtle/70 bg-elevated/25 text-accent", tone: "accent" },
  edit: { icon: "\u270E", label: "edit", color: "border border-border-subtle/70 bg-elevated/25 text-accent", tone: "accent" },
  web_fetch: {
    icon: "\u2315",
    label: "web_fetch",
    color: "border border-border-subtle/70 bg-elevated/25 text-success",
    tone: "success"
  },
  web_search: {
    icon: "\u2315",
    label: "web_search",
    color: "border border-border-subtle/70 bg-elevated/25 text-success",
    tone: "success"
  },
  image: { icon: "\u25CC", label: "image", color: "border border-border-subtle/70 bg-elevated/25 text-accent", tone: "accent" },
  screenshot: { icon: "\u22A1", label: "screenshot", color: "text-secondary bg-elevated", tone: "muted" },
  artifact: { icon: "\u25EB", label: "artifact", color: "border border-border-subtle/70 bg-elevated/25 text-accent", tone: "accent" },
  checkpoint: { icon: "\u2713", label: "checkpoint", color: "border border-border-subtle/70 bg-elevated/25 text-success", tone: "success" },
  conversation: { icon: "\u25C6", label: "conversation", color: "border border-border-subtle/70 bg-elevated/25 text-warning", tone: "warning" }
};
function toolMeta(t) {
  return TOOL_META[t] ?? { icon: "\u2699", label: t, color: "text-secondary bg-elevated", tone: "muted" };
}
function stripAnsiForTranscript(value) {
  const escape = String.fromCharCode(27);
  const bell = String.fromCharCode(7);
  const oscPattern = new RegExp(`${escape}\\][^${bell}${escape}]*(?:${bell}|${escape}\\\\)`, "gu");
  const csiPattern = new RegExp(`${escape}(?:[@-Z\\\\-_]|\\[[0-?]*[ -/]*[@-~])`, "gu");
  return value.replace(oscPattern, "").replace(csiPattern, "");
}
function isRecord2(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function isBackgroundShellStart(block) {
  const input = isRecord2(block.input) ? block.input : null;
  const details = isRecord2(block.details) ? block.details : null;
  if (block.tool === "bash") {
    return input?.background === true || details?.background === true;
  }
  return (block.tool === "background_command" || block.tool === "background_bash") && (input?.action === "start" || details?.action === "start");
}
var CONVERSATION_TRANSCRIPT_DISCLOSURE_SETTING_KEY = "conversation.transcriptDisclosure";
var CONVERSATION_DIFF_DISCLOSURE_SETTING_KEY = "conversation.diffDisclosure";
var CONVERSATION_PINNED_TOOL_CALLS_SETTING_KEY = "conversation.pinnedToolCalls";
function normalizeConversationTranscriptDisclosureMode(value) {
  return value === "expanded" ? "expanded" : "auto";
}
function normalizeConversationDiffDisclosureMode(value) {
  return value === "expanded" ? "expanded" : "collapsed";
}
function resolveDisclosureOpen(autoOpen, preference) {
  if (preference === "open") return true;
  if (preference === "closed") return false;
  return autoOpen;
}
function toggleDisclosurePreference(autoOpen, preference) {
  if (preference === "auto" && autoOpen) {
    return "open";
  }
  return resolveDisclosureOpen(autoOpen, preference) ? "closed" : "open";
}
function shouldAutoOpenTraceCluster(live, hasRunning) {
  return live || hasRunning;
}
function resolveConversationBlockAutoOpen(block, index2, total, isStreaming, mode) {
  if (mode === "expanded" && (block.type === "tool_use" || block.type === "thinking")) {
    return true;
  }
  return shouldAutoOpenConversationBlock(block, index2, total, isStreaming);
}
function shouldAutoOpenConversationBlock(block, index2, total, isStreaming) {
  const isLatestStreamingBlock = isStreaming && index2 === total - 1;
  if (block.type === "tool_use") {
    return block.status === "running" || !!block.running || isLatestStreamingBlock;
  }
  if (block.type === "thinking") {
    return isLatestStreamingBlock;
  }
  return false;
}
function getStreamingStatusLabel(messages, isStreaming) {
  if (!isStreaming) {
    return null;
  }
  const last = messages[messages.length - 1];
  if (!last) {
    return "Working\u2026";
  }
  switch (last.type) {
    case "thinking":
      return "Thinking\u2026";
    case "tool_use":
      return last.status === "running" || !!last.running ? `Running ${toolMeta(last.tool).label}\u2026` : "Working\u2026";
    case "subagent":
      return last.status === "running" ? `Running ${last.name}\u2026` : "Working\u2026";
    case "text":
      return "Responding\u2026";
    default:
      return "Working\u2026";
  }
}

// packages/desktop/ui/src/components/chat/linkedRuns.ts
function isRecord3(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function summarizeLinkedRunTail(value) {
  let segments = value.split(/[-_]+/).map((segment) => segment.trim()).filter((segment) => segment.length > 0);
  const timestampIndex = segments.findIndex((segment) => /^\d{4}$/.test(segment) || /^\d{4}T\d+/i.test(segment));
  if (timestampIndex >= 0) {
    segments = segments.slice(0, timestampIndex);
  }
  while (segments.length > 0) {
    const last = segments[segments.length - 1] ?? "";
    if (/^[a-f0-9]{6,}$/i.test(last) || /^\d+$/.test(last)) {
      segments = segments.slice(0, -1);
      continue;
    }
    break;
  }
  const summary = segments.join(" ").trim();
  if (!summary) {
    return null;
  }
  const compact = summary.replace(/\s+/g, "");
  if (/^[a-f0-9]+$/i.test(compact) && compact.length >= 8) {
    return null;
  }
  return summary.charAt(0).toUpperCase() + summary.slice(1);
}
function describeLinkedRun(runId) {
  if (runId.startsWith("conversation-live-")) {
    return {
      title: "Conversation Session",
      detail: summarizeLinkedRunTail(runId.slice("conversation-live-".length)),
      kindLabel: "conversation session"
    };
  }
  if (runId.startsWith("conversation-deferred-resume-")) {
    return {
      title: "Wakeup",
      detail: summarizeLinkedRunTail(runId.slice("conversation-deferred-resume-".length)),
      kindLabel: "wakeup"
    };
  }
  if (runId.startsWith("task-")) {
    return {
      title: "Automation Execution",
      detail: summarizeLinkedRunTail(runId.slice("task-".length)),
      kindLabel: "automation execution"
    };
  }
  if (runId.startsWith("run-")) {
    return {
      title: "Background Work",
      detail: summarizeLinkedRunTail(runId.slice("run-".length)),
      kindLabel: "background task"
    };
  }
  return {
    title: "Background Work",
    detail: summarizeLinkedRunTail(runId),
    kindLabel: "background task"
  };
}
function normalizeRunLabel(value) {
  return value.replace(/[-_\s]+/g, " ").trim().toLowerCase();
}
function readRunField(record, key) {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
function excerptLinkedRunText(value, maxLength = 72) {
  if (!value) {
    return null;
  }
  const preview = buildSummaryPreview(value, 1).replace(/\s+/g, " ").trim();
  if (!preview) {
    return null;
  }
  return preview.length <= maxLength ? preview : `${preview.slice(0, maxLength - 1).trimEnd()}\u2026`;
}
function summarizeWorkspaceTail(value) {
  if (!value) {
    return null;
  }
  const normalized = value.replace(/[\\/]+$/g, "").trim();
  if (!normalized) {
    return null;
  }
  const segments = normalized.split(/[\\/]+/).filter((segment) => segment.length > 0);
  return segments.at(-1) ?? normalized;
}
function pushRunDetail(target, value) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return;
  }
  const normalized = normalizeRunLabel(trimmed);
  if (target.some((item) => normalizeRunLabel(item) === normalized)) {
    return;
  }
  target.push(trimmed);
}
function buildRunToolPreview(block) {
  const details = isRecord3(block.details) ? block.details : null;
  const input = isRecord3(block.input) ? block.input : null;
  const action = readRunField(details, "action") ?? readRunField(input, "action");
  if (!action) {
    return "";
  }
  const runId = readRunField(details, "runId") ?? readRunField(input, "runId");
  const sourceRunId = readRunField(details, "sourceRunId");
  const taskSlug = readRunField(details, "taskSlug") ?? readRunField(input, "taskSlug");
  const prompt = excerptLinkedRunText(readRunField(details, "prompt") ?? readRunField(input, "prompt"));
  const command = excerptLinkedRunText(readRunField(details, "command") ?? readRunField(input, "command"));
  const runLabel = summarizeLinkedRunTail((runId ?? sourceRunId ?? "").replace(/^(?:run|task)-/, ""));
  switch (action) {
    case "list":
      return "list background work";
    case "get":
      return `get ${runLabel ?? runId ?? "execution"}`;
    case "logs":
      return `logs ${runLabel ?? runId ?? "execution"}`;
    case "cancel":
      return `cancel ${runLabel ?? runId ?? "execution"}`;
    case "rerun":
      return `rerun ${summarizeLinkedRunTail((sourceRunId ?? "").replace(/^(?:run|task)-/, "")) ?? sourceRunId ?? runLabel ?? "execution"}`;
    case "follow_up":
      return `follow_up ${prompt ?? summarizeLinkedRunTail((sourceRunId ?? "").replace(/^(?:run|task)-/, "")) ?? sourceRunId ?? runLabel ?? "task"}`;
    case "start_agent":
      return `start_agent ${prompt ?? taskSlug ?? runLabel ?? "agent task"}`;
    case "start":
      return `start ${command ?? taskSlug ?? runLabel ?? "shell command"}`;
    default:
      return `${action} ${prompt ?? command ?? taskSlug ?? runLabel ?? "execution"}`.trim();
  }
}
function readBareDurableRunOutput(block) {
  const output = typeof block.output === "string" ? block.output.trim() : "";
  if (!output) {
    return null;
  }
  const runIds = extractDurableRunIdsFromBlock({
    type: "text",
    ts: block.ts,
    text: output
  });
  return runIds.length === 1 && runIds[0] === output ? output : null;
}
function buildToolPreview(block) {
  if (block.tool === "bash" && readBareDurableRunOutput(block)) {
    return "";
  }
  if (block.tool === "run") {
    const preview = buildRunToolPreview(block);
    if (preview) {
      return preview;
    }
  }
  const specificPreview = buildSpecificToolPreview(block);
  if (specificPreview) {
    return specificPreview;
  }
  return block.input.command !== void 0 ? buildGenericInputPreview(block.input.command) : block.input.path !== void 0 ? buildGenericInputPreview(summarizeWorkspaceTail(String(block.input.path)) ?? block.input.path) : block.input.url !== void 0 ? buildGenericInputPreview(block.input.url).replace("https://", "").slice(0, 60) : block.input.query !== void 0 ? buildGenericInputPreview(block.input.query).slice(0, 60) : "";
}
function buildSpecificToolPreview(block) {
  const input = isRecord3(block.input) ? block.input : {};
  const details = isRecord3(block.details) ? block.details : {};
  const read = (key) => readRunField(input, key) ?? readRunField(details, key);
  const excerpt2 = (key, maxLength = 72) => excerptLinkedRunText(read(key), maxLength);
  switch (block.tool) {
    case "background_command":
    case "background_bash": {
      const action = read("action");
      const subject = excerpt2("command") ?? read("taskSlug") ?? summarizeLinkedRunTail(read("runId") ?? "");
      return [action, subject].filter(Boolean).join(" ");
    }
    case "scheduled_task": {
      const action = read("action");
      const title = excerpt2("title") ?? read("taskId");
      const schedule = read("cron") ?? read("at");
      return [action, title, schedule ? `\xB7 ${schedule}` : null].filter(Boolean).join(" ");
    }
    case "deferred_resume": {
      const action = read("action");
      const when = read("delay") ?? read("at");
      const prompt = excerpt2("prompt");
      return [action, when, prompt ? `\xB7 ${prompt}` : null].filter(Boolean).join(" ");
    }
    case "conversation_queue": {
      const action = read("action");
      const title = excerpt2("title");
      const when = read("delay") ?? read("at") ?? read("cron");
      const prompt = excerpt2("prompt");
      return [action, title ?? when, title && when ? `\xB7 ${when}` : null, prompt ? `\xB7 ${prompt}` : null].filter(Boolean).join(" ");
    }
    case "todo": {
      const action = read("action");
      const text7 = excerpt2("text");
      const status = read("status");
      const scope = read("scope");
      const id = read("id");
      return [action, text7 ?? status ?? scope ?? id].filter(Boolean).join(" ");
    }
    case "artifact": {
      const action = read("action");
      const title = excerpt2("title") ?? read("artifactId");
      return [action, title].filter(Boolean).join(" ");
    }
    case "checkpoint": {
      const action = read("action");
      const message = action === "save" ? excerpt2("message") ?? read("checkpointId") : null;
      return [action, message].filter(Boolean).join(" ");
    }
    case "subagent": {
      const action = read("action");
      const task = read("taskSlug") ?? read("task");
      const prompt = excerpt2("prompt");
      return [action, task ?? prompt].filter(Boolean).join(" ");
    }
    case "workflow": {
      const name2 = read("name");
      const status = read("status");
      const result = excerpt2("summary") ?? excerpt2("result");
      const description = excerpt2("description");
      const phase = read("activePhase");
      const agentDefaultsModel = isRecord3(input.agentDefaults) ? readRunField(input.agentDefaults, "model") : null;
      const model = read("model") ?? agentDefaultsModel;
      const subject = [
        name2,
        status ? `[${status}]` : null,
        phase ? `phase ${phase}` : null,
        result ?? description,
        model ? `\xB7 ${model}` : null
      ].filter(Boolean).join(" ");
      return subject || "dynamic workflow";
    }
    case "goal":
      return excerpt2("objective") ?? excerpt2("status") ?? "";
    case "write":
    case "edit":
    case "apply_patch": {
      return excerpt2("path") ?? summarizePathList(input.paths) ?? summarizePatchPaths(read("patch")) ?? excerpt2("patch") ?? "";
    }
    case "image":
      return excerpt2("prompt") ?? "";
    case "probe_image":
      return excerpt2("question") ?? "";
    case "conversation_inspect": {
      const action = read("action");
      const subject = excerpt2("query") ?? excerpt2("text") ?? read("conversationId");
      return [action, subject].filter(Boolean).join(" ");
    }
    case "conversation": {
      const action = read("action");
      const subject = excerpt2("question") ?? excerpt2("query") ?? excerpt2("title") ?? excerpt2("prompt") ?? read("cwd");
      return [action, subject].filter(Boolean).join(" ");
    }
    case "set_conversation_title":
      return excerpt2("title") ?? "";
    case "change_working_directory":
      return excerpt2("cwd") ?? "";
    case "ask_user":
      return summarizeAskUserQuestion(input);
    case "mcp": {
      const server = read("server");
      const tool = read("tool");
      const action = read("action");
      return [server, tool, action].filter(Boolean).join(".");
    }
    case "browser_snapshot": {
      const tab2 = read("tabId");
      return tab2 ? `tab ${tab2}` : "snapshot active tab";
    }
    case "browser_screenshot": {
      const tab2 = read("tabId");
      return tab2 ? `tab ${tab2}` : "capture browser screenshot";
    }
    case "local_models_status":
      return "check local models";
    default:
      return "";
  }
}
function summarizePathList(value) {
  if (!Array.isArray(value)) return null;
  const paths = value.filter((item) => typeof item === "string" && item.trim().length > 0);
  if (paths.length === 0) return null;
  const preview = paths.slice(0, 2).map((path2) => summarizeWorkspaceTail(path2) ?? path2).join(", ");
  return paths.length > 2 ? `${preview}, \u2026` : preview;
}
function summarizePatchPaths(patch2) {
  if (!patch2) return null;
  const paths = [];
  const seen = /* @__PURE__ */ new Set();
  const push2 = (value) => {
    const path2 = value?.trim();
    if (!path2 || seen.has(path2)) return;
    seen.add(path2);
    paths.push(path2);
  };
  for (const line of patch2.split("\n")) {
    const fileMatch = line.match(/^\*\*\* (?:Add|Update|Delete) File:\s+(.+)$/);
    if (fileMatch) {
      push2(fileMatch[1]);
      continue;
    }
    const moveMatch = line.match(/^\*\*\* Move to:\s+(.+)$/);
    if (moveMatch) {
      push2(moveMatch[1]);
      continue;
    }
    const gitMatch = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (gitMatch) {
      push2(gitMatch[2]);
    }
  }
  return summarizePathList(paths);
}
function summarizeAskUserQuestion(input) {
  const direct = excerptLinkedRunText(typeof input.question === "string" ? input.question : null);
  if (direct) return direct;
  if (Array.isArray(input.questions)) {
    const first = input.questions.find(isRecord3);
    const label = typeof first?.label === "string" ? first.label : typeof first?.question === "string" ? first.question : null;
    const preview = excerptLinkedRunText(label);
    if (preview) {
      return input.questions.length > 1 ? `${preview} +${input.questions.length - 1}` : preview;
    }
  }
  return "";
}
function buildGenericInputPreview(value) {
  if (typeof value === "string") {
    return value.split("\n")[0]?.slice(0, 64) ?? "";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  const cdpPreview = buildCdpCommandPreview(value);
  if (cdpPreview) {
    return cdpPreview;
  }
  try {
    return JSON.stringify(value).slice(0, 64);
  } catch {
    return "";
  }
}
function buildCdpCommandPreview(value) {
  if (Array.isArray(value)) {
    const methods = value.map((item) => isRecord3(item) && typeof item.method === "string" ? item.method : null).filter((method) => Boolean(method));
    if (methods.length === 0) {
      return null;
    }
    const preview = methods.slice(0, 2).join(", ");
    return methods.length > 2 ? `${preview}, \u2026` : preview;
  }
  if (!isRecord3(value) || typeof value.method !== "string") {
    return null;
  }
  const params = isRecord3(value.params) ? value.params : null;
  const detail = typeof params?.url === "string" ? params.url.replace("https://", "").slice(0, 40) : typeof params?.expression === "string" ? params.expression.split("\n")[0]?.slice(0, 40) : null;
  return detail ? `${value.method} ${detail}` : value.method;
}
function describeListedRunKind(details) {
  if (details.source === "deferred-resume") {
    return "wakeup";
  }
  if (details.source === "web-live-session") {
    return "conversation session";
  }
  if (details.source === "scheduled-task" || details.kind === "scheduled-task") {
    return "automation execution";
  }
  if (details.kind === "raw-shell") {
    return "shell command";
  }
  if (details.kind === "workflow") {
    return "workflow";
  }
  if (details.kind === "background-run") {
    return "background task";
  }
  if (details.kind === "conversation") {
    return "conversation session";
  }
  return null;
}
function readListedRuns(block) {
  if (block.tool !== "run" || !isRecord3(block.details) || block.details.action !== "list" || !Array.isArray(block.details.runs)) {
    return null;
  }
  const next = [];
  const seen = /* @__PURE__ */ new Set();
  for (const candidate of block.details.runs) {
    if (!isRecord3(candidate)) {
      continue;
    }
    const runId = typeof candidate.runId === "string" ? candidate.runId.trim() : "";
    if (!runId || seen.has(runId)) {
      continue;
    }
    seen.add(runId);
    next.push({
      runId,
      status: typeof candidate.status === "string" ? candidate.status.trim() : null,
      kind: typeof candidate.kind === "string" ? candidate.kind.trim() : null,
      source: typeof candidate.source === "string" ? candidate.source.trim() : null
    });
  }
  return next.length > 0 ? next : null;
}
function presentLinkedRun(runId, listed = null) {
  const descriptor = describeLinkedRun(runId);
  const title = descriptor.detail ?? descriptor.title;
  const detailBits = [];
  const status = listed?.status && listed.status !== "unknown" ? normalizeRunLabel(listed.status) : null;
  const kindLabel = listed ? describeListedRunKind(listed) ?? descriptor.kindLabel : descriptor.kindLabel;
  if (status) {
    detailBits.push(status);
  }
  if (kindLabel && normalizeRunLabel(kindLabel) !== normalizeRunLabel(title)) {
    detailBits.push(kindLabel);
  }
  return {
    runId,
    title,
    detail: detailBits.length > 0 ? detailBits.join(" \xB7 ") : null
  };
}
function readRunToolLinkedRun(block) {
  if (block.tool !== "run") {
    return null;
  }
  const details = isRecord3(block.details) ? block.details : null;
  const input = isRecord3(block.input) ? block.input : null;
  const action = readRunField(details, "action") ?? readRunField(input, "action");
  if (!action || action === "list") {
    return null;
  }
  const sourceRunId = readRunField(details, "sourceRunId");
  const extractedRunIds = extractDurableRunIdsFromBlock(block);
  const runId = readRunField(details, "runId") ?? extractedRunIds.find((candidate) => candidate !== sourceRunId) ?? sourceRunId;
  if (!runId) {
    return null;
  }
  const descriptor = describeLinkedRun(runId);
  const taskSlug = readRunField(details, "taskSlug") ?? readRunField(input, "taskSlug");
  const prompt = excerptLinkedRunText(readRunField(details, "prompt") ?? readRunField(input, "prompt"));
  const command = excerptLinkedRunText(readRunField(details, "command") ?? readRunField(input, "command"));
  const cwd2 = summarizeWorkspaceTail(readRunField(details, "cwd") ?? readRunField(input, "cwd"));
  const model = readRunField(details, "model") ?? readRunField(input, "model");
  const status = readRunField(details, "status") ?? (typeof block.status === "string" ? block.status : null);
  const title = prompt ?? command ?? taskSlug ?? descriptor.detail ?? descriptor.title;
  const detailBits = [];
  if (status && status !== "unknown") {
    pushRunDetail(detailBits, normalizeRunLabel(status));
  }
  switch (action) {
    case "start_agent":
      pushRunDetail(detailBits, "agent task");
      break;
    case "start":
      pushRunDetail(detailBits, "background command");
      break;
    case "follow_up":
      pushRunDetail(detailBits, "follow-up task");
      break;
    case "rerun":
      pushRunDetail(detailBits, "rerun");
      break;
    case "logs":
      pushRunDetail(detailBits, "log view");
      break;
    case "get":
      pushRunDetail(detailBits, "execution details");
      break;
    case "cancel":
      pushRunDetail(detailBits, "cancelled");
      break;
    default:
      pushRunDetail(detailBits, action.replace(/_/g, " "));
      break;
  }
  if (taskSlug && normalizeRunLabel(taskSlug) !== normalizeRunLabel(title)) {
    pushRunDetail(detailBits, taskSlug);
  }
  if (cwd2) {
    pushRunDetail(detailBits, `cwd ${cwd2}`);
  }
  if (model) {
    pushRunDetail(detailBits, model.split("/").pop() ?? model);
  }
  if (sourceRunId) {
    pushRunDetail(detailBits, `from ${summarizeLinkedRunTail(sourceRunId.replace(/^(?:run|task)-/, "")) ?? sourceRunId}`);
  }
  return {
    runId,
    title,
    detail: detailBits.length > 0 ? detailBits.join(" \xB7 ") : null
  };
}
function readBackgroundCommandToolLinkedRun(block) {
  if (block.tool !== "background_command" && block.tool !== "background_bash") {
    return null;
  }
  const details = isRecord3(block.details) ? block.details : null;
  const input = isRecord3(block.input) ? block.input : null;
  const action = readRunField(details, "action") ?? readRunField(input, "action");
  if (!action || action === "list") {
    return null;
  }
  const sourceRunId = readRunField(details, "sourceRunId");
  const extractedRunIds = extractDurableRunIdsFromBlock(block);
  const runId = readRunField(details, "runId") ?? extractedRunIds.find((candidate) => candidate !== sourceRunId) ?? sourceRunId;
  if (!runId) {
    return null;
  }
  const descriptor = describeLinkedRun(runId);
  const taskSlug = readRunField(details, "taskSlug") ?? readRunField(input, "taskSlug");
  const command = excerptLinkedRunText(readRunField(details, "command") ?? readRunField(input, "command"));
  const cwd2 = summarizeWorkspaceTail(readRunField(details, "cwd") ?? readRunField(input, "cwd"));
  const status = readRunField(details, "status") ?? (typeof block.status === "string" ? block.status : null);
  const title = command ?? taskSlug ?? descriptor.detail ?? descriptor.title;
  const detailBits = [];
  if (status && status !== "unknown") {
    pushRunDetail(detailBits, normalizeRunLabel(status));
  }
  switch (action) {
    case "start":
      pushRunDetail(detailBits, "background command");
      break;
    case "rerun":
      pushRunDetail(detailBits, "rerun");
      break;
    case "logs":
      pushRunDetail(detailBits, "log view");
      break;
    case "get":
      pushRunDetail(detailBits, "command details");
      break;
    case "cancel":
      pushRunDetail(detailBits, "cancelled");
      break;
    default:
      pushRunDetail(detailBits, action.replace(/_/g, " "));
      break;
  }
  if (taskSlug && normalizeRunLabel(taskSlug) !== normalizeRunLabel(title)) {
    pushRunDetail(detailBits, taskSlug);
  }
  if (cwd2) {
    pushRunDetail(detailBits, `cwd ${cwd2}`);
  }
  if (sourceRunId) {
    pushRunDetail(detailBits, `from ${summarizeLinkedRunTail(sourceRunId.replace(/^(?:run|task)-/, "")) ?? sourceRunId}`);
  }
  return {
    runId,
    title,
    detail: detailBits.length > 0 ? detailBits.join(" \xB7 ") : null
  };
}
function readSubagentToolLinkedRun(block) {
  if (block.tool !== "subagent") {
    return null;
  }
  const details = isRecord3(block.details) ? block.details : null;
  const input = isRecord3(block.input) ? block.input : null;
  const runId = readRunField(details, "runId") ?? extractDurableRunIdsFromBlock(block)[0];
  if (!runId) {
    return null;
  }
  const taskSlug = readRunField(details, "taskSlug") ?? readRunField(input, "taskSlug") ?? readRunField(input, "task");
  const prompt = excerptLinkedRunText(readRunField(details, "prompt") ?? readRunField(input, "prompt"));
  const cwd2 = summarizeWorkspaceTail(readRunField(details, "cwd") ?? readRunField(input, "cwd"));
  const model = readRunField(details, "model") ?? readRunField(input, "model");
  const status = readRunField(details, "status") ?? (typeof block.status === "string" ? block.status : null);
  const descriptor = describeLinkedRun(runId);
  const title = prompt ?? taskSlug ?? descriptor.detail ?? descriptor.title;
  const detailBits = [];
  if (status && status !== "unknown") {
    pushRunDetail(detailBits, normalizeRunLabel(status));
  }
  pushRunDetail(detailBits, "agent task");
  if (taskSlug && normalizeRunLabel(taskSlug) !== normalizeRunLabel(title)) {
    pushRunDetail(detailBits, taskSlug);
  }
  if (cwd2) {
    pushRunDetail(detailBits, `cwd ${cwd2}`);
  }
  if (model) {
    pushRunDetail(detailBits, model.split("/").pop() ?? model);
  }
  return {
    runId,
    title,
    detail: detailBits.length > 0 ? detailBits.join(" \xB7 ") : null
  };
}
function readLinkedRuns(block) {
  const listedRuns = readListedRuns(block);
  if (listedRuns) {
    return {
      scope: "listed",
      runs: listedRuns.map((run) => presentLinkedRun(run.runId, run))
    };
  }
  const runToolLinkedRun = readRunToolLinkedRun(block);
  if (runToolLinkedRun) {
    return {
      scope: "mentioned",
      runs: [runToolLinkedRun]
    };
  }
  const backgroundCommandToolLinkedRun = readBackgroundCommandToolLinkedRun(block);
  if (backgroundCommandToolLinkedRun) {
    return {
      scope: "mentioned",
      runs: [backgroundCommandToolLinkedRun]
    };
  }
  const subagentToolLinkedRun = readSubagentToolLinkedRun(block);
  if (subagentToolLinkedRun) {
    return {
      scope: "mentioned",
      runs: [subagentToolLinkedRun]
    };
  }
  if (isBackgroundShellStart(block)) {
    const runId = extractDurableRunIdsFromBlock(block)[0];
    return { scope: "mentioned", runs: runId ? [presentLinkedRun(runId)] : [] };
  }
  if (block.tool === "bash") {
    const runId = readBareDurableRunOutput(block);
    if (runId) {
      return { scope: "mentioned", runs: [presentLinkedRun(runId)] };
    }
  }
  return {
    scope: "mentioned",
    runs: []
  };
}
function readMentionedLinkedRunsFromText(text7) {
  return extractDurableRunIdsFromBlock({
    type: "text",
    ts: (/* @__PURE__ */ new Date(0)).toISOString(),
    text: text7
  }).map((runId) => presentLinkedRun(runId));
}
function collectTraceClusterLinkedRuns(blocks, options = {}) {
  const seen = /* @__PURE__ */ new Set();
  const next = [];
  const pushRun = (run) => {
    const runId = run.runId.trim();
    if (!runId || seen.has(runId)) {
      return;
    }
    seen.add(runId);
    next.push(run);
  };
  for (let index2 = blocks.length - 1; index2 >= 0; index2 -= 1) {
    const block = blocks[index2];
    if (!block || block.type !== "tool_use") {
      continue;
    }
    const linkedRuns = readLinkedRuns(block);
    if (linkedRuns.scope !== "listed") {
      for (const run of linkedRuns.runs) {
        pushRun(run);
      }
    }
    if (block.output && options.outputMentionRunIds?.size) {
      for (const run of readMentionedLinkedRunsFromText(block.output)) {
        if (options.outputMentionRunIds.has(run.runId)) {
          pushRun(run);
        }
      }
    }
  }
  return next;
}

// packages/desktop/ui/src/components/chat/linkedRunResolution.ts
function extractLinkedTaskSlugFromRunId(runId) {
  const normalized = runId.trim();
  if (!normalized.startsWith("run-")) {
    return null;
  }
  const timestampIndex = normalized.search(/-\d{4}-\d{2}-\d{2}T/i);
  if (timestampIndex <= 4) {
    return null;
  }
  const taskSlug = normalized.slice(4, timestampIndex).trim();
  return taskSlug.length > 0 ? taskSlug : null;
}
function pickBestResolvedLinkedRunCandidate(candidates) {
  if (candidates.length === 0) {
    return null;
  }
  return [...candidates].sort((left, right) => {
    const leftActive = isRunActive(left) ? 1 : 0;
    const rightActive = isRunActive(right) ? 1 : 0;
    if (leftActive !== rightActive) {
      return rightActive - leftActive;
    }
    const leftAt = getRunMoment(left).at ?? "";
    const rightAt = getRunMoment(right).at ?? "";
    return rightAt.localeCompare(leftAt) || left.runId.localeCompare(right.runId);
  })[0] ?? null;
}
function resolveLinkedRunRecord(linkedRun, runs, lookups) {
  if (!runs || runs.length === 0) {
    return null;
  }
  const exactMatch = runs.find((candidate) => candidate.runId === linkedRun.runId);
  if (exactMatch) {
    return exactMatch;
  }
  const linkedTaskSlug = extractLinkedTaskSlugFromRunId(linkedRun.runId);
  if (linkedTaskSlug) {
    const linkedTaskSlugNormalized = normalizeRunLabel(linkedTaskSlug);
    const taskSlugMatches = runs.filter((candidate) => {
      const candidateTaskSlug = getRunTaskSlug(candidate);
      return candidateTaskSlug ? normalizeRunLabel(candidateTaskSlug) === linkedTaskSlugNormalized : false;
    });
    const taskSlugResolved = pickBestResolvedLinkedRunCandidate(taskSlugMatches);
    if (taskSlugResolved) {
      return taskSlugResolved;
    }
  }
  const linkedTitleNormalized = normalizeRunLabel(linkedRun.title);
  if (linkedTitleNormalized) {
    const titleMatches = runs.filter((candidate) => {
      const candidateHeadline = getRunHeadline(candidate, lookups);
      return normalizeRunLabel(candidateHeadline.title) === linkedTitleNormalized;
    });
    const titleResolved = pickBestResolvedLinkedRunCandidate(titleMatches);
    if (titleResolved) {
      return titleResolved;
    }
  }
  return null;
}

// packages/desktop/ui/src/components/chat/linkedRunStatus.ts
function inferStatusFromLinkedRunDetail(detail) {
  if (typeof detail !== "string" || !detail) {
    return void 0;
  }
  const firstSegment = detail.split("\xB7")[0]?.trim().toLowerCase();
  if (!firstSegment) {
    return void 0;
  }
  const knownStatus = ["queued", "waiting", "running", "recovering", "completed", "failed", "interrupted", "cancelled"];
  return knownStatus.includes(firstSegment) ? firstSegment : void 0;
}
function describeInlineRunStatus(status) {
  const statusText = typeof status === "string" ? status : void 0;
  if (statusText === "running") {
    return { text: "running", tone: "accent" };
  }
  if (statusText === "recovering") {
    return { text: "recovering", tone: "warning" };
  }
  if (statusText === "queued" || statusText === "waiting") {
    return { text: statusText, tone: "muted" };
  }
  if (statusText === "completed") {
    return { text: "completed", tone: "success" };
  }
  if (statusText === "failed" || statusText === "interrupted") {
    return { text: statusText, tone: "danger" };
  }
  if (statusText === "cancelled") {
    return { text: "cancelled", tone: "muted" };
  }
  return {
    text: statusText?.trim().length ? statusText : "mentioned",
    tone: "muted"
  };
}

// packages/desktop/ui/src/components/chat/InlineTraceRunCard.tsx
function InlineRunMetadataRow({ label, value }) {
  return /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-[auto,minmax(0,1fr)] items-start gap-2", children: [
    /* @__PURE__ */ jsx(MetaLabel, { tone: "muted", children: label }),
    /* @__PURE__ */ jsx("span", { className: "break-words text-[11px] text-primary", children: value })
  ] });
}
function InlineTraceRunCard({ run, expanded, onToggle }) {
  const tasks = useAllTasks();
  const sessions = useAllSessions();
  const runRecords = useAllRuns();
  const runLookups = useMemo(() => ({ tasks, sessions }), [tasks, sessions]);
  const resolvedRunRecord = useMemo(() => resolveLinkedRunRecord(run, runRecords, runLookups), [run, runLookups, runRecords]);
  const resolvedRunId = resolvedRunRecord?.runId ?? run.runId;
  const cardRef = useRef(null);
  const [isVisible, setIsVisible] = useState(true);
  useEffect(() => {
    if (!expanded) {
      setIsVisible(true);
      return;
    }
    const node2 = cardRef.current;
    if (!node2 || typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsVisible(Boolean(entry?.isIntersecting));
      },
      {
        threshold: [0, 0.01, 0.2]
      }
    );
    observer.observe(node2);
    return () => observer.disconnect();
  }, [expanded]);
  const pollEnabled = shouldPollInlineRunSnapshot({
    run: resolvedRunRecord,
    visible: isVisible,
    open: expanded
  });
  const snapshotRunId = pollEnabled ? resolvedRunId : null;
  const snapshot = usePolledDurableRunSnapshot(snapshotRunId, pollEnabled, {
    tail: INLINE_RUN_LOG_TAIL_LINES,
    pollIntervalMs: INLINE_RUN_POLL_INTERVAL_MS
  });
  const detailRun = snapshot.detail?.run ?? resolvedRunRecord ?? null;
  const fallbackSummary = run.detail ? `Background task mentioned by this step \xB7 ${run.detail}` : "Background task mentioned by this step";
  const headline = detailRun ? getRunHeadline(detailRun, runLookups) : {
    title: `Background task: ${run.title}`,
    summary: fallbackSummary
  };
  const status = describeInlineRunStatus(detailRun?.status?.status ?? inferStatusFromLinkedRunDetail(run.detail));
  const runStreaming = isRunActive(detailRun);
  const outputLabel = detailRun?.manifest?.kind === "raw-shell" ? "Terminal output" : "Output";
  const outputPathLabel = snapshot.log?.path?.split("/").filter(Boolean).pop() ?? "output.log";
  const hasOutput = Boolean(snapshot.log?.log && snapshot.log.log.length > 0);
  const emptyOutputLabel = runStreaming ? "Waiting for output\u2026" : "(empty)";
  const taskSlug = detailRun ? getRunTaskSlug(detailRun) : null;
  const targetPrompt = detailRun ? getRunTargetPrompt(detailRun) : null;
  const targetCommand = detailRun ? getRunTargetCommand(detailRun) : null;
  const targetCwd = detailRun ? getRunWorkingDirectory(detailRun) : null;
  const targetModel = detailRun ? getRunTargetModel(detailRun) : null;
  const targetProfile = detailRun ? getRunTargetProfile(detailRun) : null;
  const timeline = detailRun ? getRunTimeline(detailRun) : [];
  const runIsShell = detailRun?.manifest?.kind === "raw-shell" || Boolean(targetCommand);
  const conversationRoute = detailRun ? getRunConnections(detailRun, runLookups).find((connection) => connection.label === "Conversation transcript" && connection.to)?.to : void 0;
  const latestTimelinePoint = timeline.at(-1);
  const resolvedFromMention = resolvedRunId !== run.runId;
  const pollingLabel = snapshot.unavailable ? "Background task unavailable" : pollEnabled ? "Live log updating" : "Live log paused (off-screen)";
  return /* @__PURE__ */ jsxs(
    "div",
    {
      ref: cardRef,
      className: "ui-panel-muted overflow-hidden bg-elevated/35",
      tabIndex: -1,
      ...transcriptTargetAttributes({ kind: "background_run", runId: resolvedRunId }),
      children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3 px-2.5 py-2", children: [
          /* @__PURE__ */ jsxs(RowButton, { compact: true, onClick: onToggle, "aria-expanded": expanded, className: "min-w-0 flex-1 bg-transparent p-0", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 flex-wrap items-center gap-2", children: [
              detailRun && /* @__PURE__ */ jsx(Pill, { tone: "accent", mono: runIsShell, children: runIsShell ? "\u203A_ Shell" : "\u2726 Agent" }),
              /* @__PURE__ */ jsx(Pill, { tone: status.tone, children: status.text }),
              /* @__PURE__ */ jsx("span", { className: "truncate text-[12px] font-medium text-primary", children: headline.title })
            ] }),
            /* @__PURE__ */ jsx("p", { className: "mt-1 truncate text-[11px] text-secondary", children: headline.summary || run.detail || run.runId })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex shrink-0 items-center gap-2", children: [
            conversationRoute ? /* @__PURE__ */ jsx(Link, { to: conversationRoute, className: "ui-action-button text-[10px]", children: "Open conversation" }) : null,
            /* @__PURE__ */ jsx(TextButton, { onClick: onToggle, className: "text-[10px] uppercase tracking-[0.14em] text-dim", children: expanded ? "hide details" : "show details" })
          ] })
        ] }),
        expanded && /* @__PURE__ */ jsxs("div", { className: "space-y-2.5 border-t border-border-subtle/70 bg-base/30 px-2.5 py-2.5", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-1.5 text-[10px] text-dim", children: [
            /* @__PURE__ */ jsx("span", { className: snapshot.unavailable ? "text-warning" : pollEnabled ? "text-accent" : "text-dim", children: pollingLabel }),
            snapshot.refreshing && /* @__PURE__ */ jsx("span", { children: "\xB7 refreshing\u2026" }),
            resolvedFromMention && /* @__PURE__ */ jsxs(Fragment2, { children: [
              /* @__PURE__ */ jsx("span", { className: "opacity-40", children: "\xB7" }),
              /* @__PURE__ */ jsx("span", { className: "font-mono text-dim/80", title: `${run.runId} \u2192 ${resolvedRunId}`, children: resolvedRunId })
            ] }),
            latestTimelinePoint?.at && /* @__PURE__ */ jsxs(Fragment2, { children: [
              /* @__PURE__ */ jsx("span", { className: "opacity-40", children: "\xB7" }),
              /* @__PURE__ */ jsxs("span", { children: [
                latestTimelinePoint.label,
                " ",
                timeAgo(latestTimelinePoint.at)
              ] })
            ] })
          ] }),
          snapshot.loading && !detailRun && /* @__PURE__ */ jsx("p", { className: "text-[11px] text-dim animate-pulse", children: "Loading run\u2026" }),
          snapshot.error && !detailRun && /* @__PURE__ */ jsx("p", { className: cx("text-[11px]", snapshot.unavailable ? "text-warning" : "text-danger/85"), children: snapshot.error }),
          (detailRun || snapshot.log) && /* @__PURE__ */ jsxs(SurfacePanel, { muted: true, className: "overflow-hidden bg-elevated/40", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2 border-b border-border-subtle/60 px-2 py-1.5 text-dim", children: [
              /* @__PURE__ */ jsx(StatusDot, { tone: runStreaming ? "accent" : "muted", className: runStreaming ? "animate-pulse" : "opacity-40" }),
              /* @__PURE__ */ jsx(MetaLabel, { tone: "muted", children: outputLabel }),
              /* @__PURE__ */ jsx("span", { className: "min-w-0 truncate font-mono normal-case tracking-normal text-dim/80", children: outputPathLabel })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "max-h-56 overflow-auto px-2 py-2", children: hasOutput ? /* @__PURE__ */ jsxs("pre", { className: "whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-primary", children: [
              runIsShell && targetCommand ? /* @__PURE__ */ jsxs(Fragment2, { children: [
                /* @__PURE__ */ jsx("span", { className: "text-dim", children: "$ " }),
                targetCommand,
                "\n"
              ] }) : null,
              snapshot.log?.log
            ] }) : /* @__PURE__ */ jsx("p", { className: "text-[11px] italic leading-relaxed text-dim", children: emptyOutputLabel }) })
          ] }),
          detailRun && /* @__PURE__ */ jsxs(
            Disclosure,
            {
              summary: /* @__PURE__ */ jsxs(Fragment2, { children: [
                /* @__PURE__ */ jsx("span", { children: "Details" }),
                /* @__PURE__ */ jsx("span", { className: "ui-disclosure-meta", children: "Command details" })
              ] }),
              children: [
                /* @__PURE__ */ jsxs("div", { className: "space-y-2.5", children: [
                  taskSlug && /* @__PURE__ */ jsx(InlineRunMetadataRow, { label: "Task", value: taskSlug }),
                  targetPrompt && /* @__PURE__ */ jsx(InlineRunMetadataRow, { label: "Prompt", value: /* @__PURE__ */ jsx("span", { className: "whitespace-pre-wrap break-words", children: targetPrompt }) }),
                  targetCommand && /* @__PURE__ */ jsx(InlineRunMetadataRow, { label: "Command", value: /* @__PURE__ */ jsx("span", { className: "font-mono", children: targetCommand }) }),
                  targetCwd && /* @__PURE__ */ jsx(InlineRunMetadataRow, { label: "Working dir", value: /* @__PURE__ */ jsx("span", { className: "font-mono", children: targetCwd }) }),
                  targetModel && /* @__PURE__ */ jsx(InlineRunMetadataRow, { label: "Model", value: targetModel }),
                  targetProfile && /* @__PURE__ */ jsx(InlineRunMetadataRow, { label: "Profile", value: targetProfile }),
                  /* @__PURE__ */ jsx(InlineRunMetadataRow, { label: "Type", value: detailRun.manifest?.kind ?? "unknown" }),
                  /* @__PURE__ */ jsx(InlineRunMetadataRow, { label: "Started by", value: detailRun.manifest?.source?.type ?? "unknown" }),
                  /* @__PURE__ */ jsx(InlineRunMetadataRow, { label: "Attempt", value: String(detailRun.status?.activeAttempt ?? 0) }),
                  detailRun.checkpoint?.step && /* @__PURE__ */ jsx(InlineRunMetadataRow, { label: "Checkpoint", value: detailRun.checkpoint.step }),
                  snapshot.log?.path && /* @__PURE__ */ jsx(InlineRunMetadataRow, { label: "Log", value: /* @__PURE__ */ jsx("span", { className: "font-mono", children: snapshot.log.path }) })
                ] }),
                (detailRun.status?.lastError || detailRun.problems.length > 0) && /* @__PURE__ */ jsxs("div", { className: "mt-3 space-y-2 border-t border-border-subtle/60 pt-2.5", children: [
                  detailRun.status?.lastError && /* @__PURE__ */ jsxs("div", { className: "space-y-1", children: [
                    /* @__PURE__ */ jsx(SectionLabel, { tone: "muted", children: "Last error" }),
                    /* @__PURE__ */ jsx("p", { className: "whitespace-pre-wrap break-words text-[11px] text-danger/90", children: detailRun.status.lastError })
                  ] }),
                  detailRun.problems.length > 0 && /* @__PURE__ */ jsxs("div", { className: "space-y-1", children: [
                    /* @__PURE__ */ jsx(SectionLabel, { tone: "muted", children: "Problems" }),
                    /* @__PURE__ */ jsx("div", { className: "space-y-1 text-[11px] text-danger/90", children: detailRun.problems.map((problem) => /* @__PURE__ */ jsxs("p", { children: [
                      "\u2022 ",
                      problem
                    ] }, problem)) })
                  ] })
                ] })
              ]
            }
          ),
          snapshot.error && detailRun && /* @__PURE__ */ jsx("p", { className: "text-[11px] text-warning", children: snapshot.error })
        ] })
      ]
    }
  );
}

// packages/desktop/ui/src/components/chat/MarkdownMessage.tsx
init_neon_pilot_shared_react();

// node_modules/.pnpm/devlop@1.1.0/node_modules/devlop/lib/default.js
function ok() {
}
function unreachable() {
}

// node_modules/.pnpm/estree-util-is-identifier-name@3.0.0/node_modules/estree-util-is-identifier-name/lib/index.js
var nameRe = /^[$_\p{ID_Start}][$_\u{200C}\u{200D}\p{ID_Continue}]*$/u;
var nameReJsx = /^[$_\p{ID_Start}][-$_\u{200C}\u{200D}\p{ID_Continue}]*$/u;
var emptyOptions = {};
function name(name2, options) {
  const settings = options || emptyOptions;
  const re = settings.jsx ? nameReJsx : nameRe;
  return re.test(name2);
}

// node_modules/.pnpm/hast-util-to-jsx-runtime@2.3.6/node_modules/hast-util-to-jsx-runtime/lib/index.js
var import_style_to_js = __toESM(require_cjs3(), 1);

// node_modules/.pnpm/unist-util-position@5.0.0/node_modules/unist-util-position/lib/index.js
var pointEnd = point("end");
var pointStart = point("start");
function point(type) {
  return point4;
  function point4(node2) {
    const point5 = node2 && node2.position && node2.position[type] || {};
    if (typeof point5.line === "number" && point5.line > 0 && typeof point5.column === "number" && point5.column > 0) {
      return {
        line: point5.line,
        column: point5.column,
        offset: typeof point5.offset === "number" && point5.offset > -1 ? point5.offset : void 0
      };
    }
  }
}
function position(node2) {
  const start2 = pointStart(node2);
  const end = pointEnd(node2);
  if (start2 && end) {
    return { start: start2, end };
  }
}

// node_modules/.pnpm/unist-util-stringify-position@4.0.0/node_modules/unist-util-stringify-position/lib/index.js
function stringifyPosition(value) {
  if (!value || typeof value !== "object") {
    return "";
  }
  if ("position" in value || "type" in value) {
    return position2(value.position);
  }
  if ("start" in value || "end" in value) {
    return position2(value);
  }
  if ("line" in value || "column" in value) {
    return point2(value);
  }
  return "";
}
function point2(point4) {
  return index(point4 && point4.line) + ":" + index(point4 && point4.column);
}
function position2(pos) {
  return point2(pos && pos.start) + "-" + point2(pos && pos.end);
}
function index(value) {
  return value && typeof value === "number" ? value : 1;
}

// node_modules/.pnpm/vfile-message@4.0.3/node_modules/vfile-message/lib/index.js
var VFileMessage = class extends Error {
  /**
   * Create a message for `reason`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {Options | null | undefined} [options]
   * @returns
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | Options | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns
   *   Instance of `VFileMessage`.
   */
  // eslint-disable-next-line complexity
  constructor(causeOrReason, optionsOrParentOrPlace, origin) {
    super();
    if (typeof optionsOrParentOrPlace === "string") {
      origin = optionsOrParentOrPlace;
      optionsOrParentOrPlace = void 0;
    }
    let reason = "";
    let options = {};
    let legacyCause = false;
    if (optionsOrParentOrPlace) {
      if ("line" in optionsOrParentOrPlace && "column" in optionsOrParentOrPlace) {
        options = { place: optionsOrParentOrPlace };
      } else if ("start" in optionsOrParentOrPlace && "end" in optionsOrParentOrPlace) {
        options = { place: optionsOrParentOrPlace };
      } else if ("type" in optionsOrParentOrPlace) {
        options = {
          ancestors: [optionsOrParentOrPlace],
          place: optionsOrParentOrPlace.position
        };
      } else {
        options = { ...optionsOrParentOrPlace };
      }
    }
    if (typeof causeOrReason === "string") {
      reason = causeOrReason;
    } else if (!options.cause && causeOrReason) {
      legacyCause = true;
      reason = causeOrReason.message;
      options.cause = causeOrReason;
    }
    if (!options.ruleId && !options.source && typeof origin === "string") {
      const index2 = origin.indexOf(":");
      if (index2 === -1) {
        options.ruleId = origin;
      } else {
        options.source = origin.slice(0, index2);
        options.ruleId = origin.slice(index2 + 1);
      }
    }
    if (!options.place && options.ancestors && options.ancestors) {
      const parent = options.ancestors[options.ancestors.length - 1];
      if (parent) {
        options.place = parent.position;
      }
    }
    const start2 = options.place && "start" in options.place ? options.place.start : options.place;
    this.ancestors = options.ancestors || void 0;
    this.cause = options.cause || void 0;
    this.column = start2 ? start2.column : void 0;
    this.fatal = void 0;
    this.file = "";
    this.message = reason;
    this.line = start2 ? start2.line : void 0;
    this.name = stringifyPosition(options.place) || "1:1";
    this.place = options.place || void 0;
    this.reason = this.message;
    this.ruleId = options.ruleId || void 0;
    this.source = options.source || void 0;
    this.stack = legacyCause && options.cause && typeof options.cause.stack === "string" ? options.cause.stack : "";
    this.actual = void 0;
    this.expected = void 0;
    this.note = void 0;
    this.url = void 0;
  }
};
VFileMessage.prototype.file = "";
VFileMessage.prototype.name = "";
VFileMessage.prototype.reason = "";
VFileMessage.prototype.message = "";
VFileMessage.prototype.stack = "";
VFileMessage.prototype.column = void 0;
VFileMessage.prototype.line = void 0;
VFileMessage.prototype.ancestors = void 0;
VFileMessage.prototype.cause = void 0;
VFileMessage.prototype.fatal = void 0;
VFileMessage.prototype.place = void 0;
VFileMessage.prototype.ruleId = void 0;
VFileMessage.prototype.source = void 0;

// node_modules/.pnpm/hast-util-to-jsx-runtime@2.3.6/node_modules/hast-util-to-jsx-runtime/lib/index.js
var own = {}.hasOwnProperty;
var emptyMap = /* @__PURE__ */ new Map();
var cap = /[A-Z]/g;
var tableElements = /* @__PURE__ */ new Set(["table", "tbody", "thead", "tfoot", "tr"]);
var tableCellElement = /* @__PURE__ */ new Set(["td", "th"]);
var docs = "https://github.com/syntax-tree/hast-util-to-jsx-runtime";
function toJsxRuntime(tree, options) {
  if (!options || options.Fragment === void 0) {
    throw new TypeError("Expected `Fragment` in options");
  }
  const filePath = options.filePath || void 0;
  let create;
  if (options.development) {
    if (typeof options.jsxDEV !== "function") {
      throw new TypeError(
        "Expected `jsxDEV` in options when `development: true`"
      );
    }
    create = developmentCreate(filePath, options.jsxDEV);
  } else {
    if (typeof options.jsx !== "function") {
      throw new TypeError("Expected `jsx` in production options");
    }
    if (typeof options.jsxs !== "function") {
      throw new TypeError("Expected `jsxs` in production options");
    }
    create = productionCreate(filePath, options.jsx, options.jsxs);
  }
  const state = {
    Fragment: options.Fragment,
    ancestors: [],
    components: options.components || {},
    create,
    elementAttributeNameCase: options.elementAttributeNameCase || "react",
    evaluater: options.createEvaluater ? options.createEvaluater() : void 0,
    filePath,
    ignoreInvalidStyle: options.ignoreInvalidStyle || false,
    passKeys: options.passKeys !== false,
    passNode: options.passNode || false,
    schema: options.space === "svg" ? svg : html,
    stylePropertyNameCase: options.stylePropertyNameCase || "dom",
    tableCellAlignToStyle: options.tableCellAlignToStyle !== false
  };
  const result = one(state, tree, void 0);
  if (result && typeof result !== "string") {
    return result;
  }
  return state.create(
    tree,
    state.Fragment,
    { children: result || void 0 },
    void 0
  );
}
function one(state, node2, key) {
  if (node2.type === "element") {
    return element(state, node2, key);
  }
  if (node2.type === "mdxFlowExpression" || node2.type === "mdxTextExpression") {
    return mdxExpression(state, node2);
  }
  if (node2.type === "mdxJsxFlowElement" || node2.type === "mdxJsxTextElement") {
    return mdxJsxElement(state, node2, key);
  }
  if (node2.type === "mdxjsEsm") {
    return mdxEsm(state, node2);
  }
  if (node2.type === "root") {
    return root(state, node2, key);
  }
  if (node2.type === "text") {
    return text(state, node2);
  }
}
function element(state, node2, key) {
  const parentSchema = state.schema;
  let schema = parentSchema;
  if (node2.tagName.toLowerCase() === "svg" && parentSchema.space === "html") {
    schema = svg;
    state.schema = schema;
  }
  state.ancestors.push(node2);
  const type = findComponentFromName(state, node2.tagName, false);
  const props = createElementProps(state, node2);
  let children = createChildren(state, node2);
  if (tableElements.has(node2.tagName)) {
    children = children.filter(function(child) {
      return typeof child === "string" ? !whitespace(child) : true;
    });
  }
  addNode(state, props, type, node2);
  addChildren(props, children);
  state.ancestors.pop();
  state.schema = parentSchema;
  return state.create(node2, type, props, key);
}
function mdxExpression(state, node2) {
  if (node2.data && node2.data.estree && state.evaluater) {
    const program = node2.data.estree;
    const expression = program.body[0];
    ok(expression.type === "ExpressionStatement");
    return (
      /** @type {Child | undefined} */
      state.evaluater.evaluateExpression(expression.expression)
    );
  }
  crashEstree(state, node2.position);
}
function mdxEsm(state, node2) {
  if (node2.data && node2.data.estree && state.evaluater) {
    return (
      /** @type {Child | undefined} */
      state.evaluater.evaluateProgram(node2.data.estree)
    );
  }
  crashEstree(state, node2.position);
}
function mdxJsxElement(state, node2, key) {
  const parentSchema = state.schema;
  let schema = parentSchema;
  if (node2.name === "svg" && parentSchema.space === "html") {
    schema = svg;
    state.schema = schema;
  }
  state.ancestors.push(node2);
  const type = node2.name === null ? state.Fragment : findComponentFromName(state, node2.name, true);
  const props = createJsxElementProps(state, node2);
  const children = createChildren(state, node2);
  addNode(state, props, type, node2);
  addChildren(props, children);
  state.ancestors.pop();
  state.schema = parentSchema;
  return state.create(node2, type, props, key);
}
function root(state, node2, key) {
  const props = {};
  addChildren(props, createChildren(state, node2));
  return state.create(node2, state.Fragment, props, key);
}
function text(_, node2) {
  return node2.value;
}
function addNode(state, props, type, node2) {
  if (typeof type !== "string" && type !== state.Fragment && state.passNode) {
    props.node = node2;
  }
}
function addChildren(props, children) {
  if (children.length > 0) {
    const value = children.length > 1 ? children : children[0];
    if (value) {
      props.children = value;
    }
  }
}
function productionCreate(_, jsx2, jsxs2) {
  return create;
  function create(_2, type, props, key) {
    const isStaticChildren = Array.isArray(props.children);
    const fn = isStaticChildren ? jsxs2 : jsx2;
    return key ? fn(type, props, key) : fn(type, props);
  }
}
function developmentCreate(filePath, jsxDEV) {
  return create;
  function create(node2, type, props, key) {
    const isStaticChildren = Array.isArray(props.children);
    const point4 = pointStart(node2);
    return jsxDEV(
      type,
      props,
      key,
      isStaticChildren,
      {
        columnNumber: point4 ? point4.column - 1 : void 0,
        fileName: filePath,
        lineNumber: point4 ? point4.line : void 0
      },
      void 0
    );
  }
}
function createElementProps(state, node2) {
  const props = {};
  let alignValue;
  let prop;
  for (prop in node2.properties) {
    if (prop !== "children" && own.call(node2.properties, prop)) {
      const result = createProperty(state, prop, node2.properties[prop]);
      if (result) {
        const [key, value] = result;
        if (state.tableCellAlignToStyle && key === "align" && typeof value === "string" && tableCellElement.has(node2.tagName)) {
          alignValue = value;
        } else {
          props[key] = value;
        }
      }
    }
  }
  if (alignValue) {
    const style = (
      /** @type {Style} */
      props.style || (props.style = {})
    );
    style[state.stylePropertyNameCase === "css" ? "text-align" : "textAlign"] = alignValue;
  }
  return props;
}
function createJsxElementProps(state, node2) {
  const props = {};
  for (const attribute of node2.attributes) {
    if (attribute.type === "mdxJsxExpressionAttribute") {
      if (attribute.data && attribute.data.estree && state.evaluater) {
        const program = attribute.data.estree;
        const expression = program.body[0];
        ok(expression.type === "ExpressionStatement");
        const objectExpression = expression.expression;
        ok(objectExpression.type === "ObjectExpression");
        const property = objectExpression.properties[0];
        ok(property.type === "SpreadElement");
        Object.assign(
          props,
          state.evaluater.evaluateExpression(property.argument)
        );
      } else {
        crashEstree(state, node2.position);
      }
    } else {
      const name2 = attribute.name;
      let value;
      if (attribute.value && typeof attribute.value === "object") {
        if (attribute.value.data && attribute.value.data.estree && state.evaluater) {
          const program = attribute.value.data.estree;
          const expression = program.body[0];
          ok(expression.type === "ExpressionStatement");
          value = state.evaluater.evaluateExpression(expression.expression);
        } else {
          crashEstree(state, node2.position);
        }
      } else {
        value = attribute.value === null ? true : attribute.value;
      }
      props[name2] = /** @type {Props[keyof Props]} */
      value;
    }
  }
  return props;
}
function createChildren(state, node2) {
  const children = [];
  let index2 = -1;
  const countsByName = state.passKeys ? /* @__PURE__ */ new Map() : emptyMap;
  while (++index2 < node2.children.length) {
    const child = node2.children[index2];
    let key;
    if (state.passKeys) {
      const name2 = child.type === "element" ? child.tagName : child.type === "mdxJsxFlowElement" || child.type === "mdxJsxTextElement" ? child.name : void 0;
      if (name2) {
        const count = countsByName.get(name2) || 0;
        key = name2 + "-" + count;
        countsByName.set(name2, count + 1);
      }
    }
    const result = one(state, child, key);
    if (result !== void 0) children.push(result);
  }
  return children;
}
function createProperty(state, prop, value) {
  const info = find(state.schema, prop);
  if (value === null || value === void 0 || typeof value === "number" && Number.isNaN(value)) {
    return;
  }
  if (Array.isArray(value)) {
    value = info.commaSeparated ? stringify(value) : stringify2(value);
  }
  if (info.property === "style") {
    let styleObject = typeof value === "object" ? value : parseStyle(state, String(value));
    if (state.stylePropertyNameCase === "css") {
      styleObject = transformStylesToCssCasing(styleObject);
    }
    return ["style", styleObject];
  }
  return [
    state.elementAttributeNameCase === "react" && info.space ? hastToReact[info.property] || info.property : info.attribute,
    value
  ];
}
function parseStyle(state, value) {
  try {
    return (0, import_style_to_js.default)(value, { reactCompat: true });
  } catch (error) {
    if (state.ignoreInvalidStyle) {
      return {};
    }
    const cause = (
      /** @type {Error} */
      error
    );
    const message = new VFileMessage("Cannot parse `style` attribute", {
      ancestors: state.ancestors,
      cause,
      ruleId: "style",
      source: "hast-util-to-jsx-runtime"
    });
    message.file = state.filePath || void 0;
    message.url = docs + "#cannot-parse-style-attribute";
    throw message;
  }
}
function findComponentFromName(state, name2, allowExpression) {
  let result;
  if (!allowExpression) {
    result = { type: "Literal", value: name2 };
  } else if (name2.includes(".")) {
    const identifiers = name2.split(".");
    let index2 = -1;
    let node2;
    while (++index2 < identifiers.length) {
      const prop = name(identifiers[index2]) ? { type: "Identifier", name: identifiers[index2] } : { type: "Literal", value: identifiers[index2] };
      node2 = node2 ? {
        type: "MemberExpression",
        object: node2,
        property: prop,
        computed: Boolean(index2 && prop.type === "Literal"),
        optional: false
      } : prop;
    }
    ok(node2, "always a result");
    result = node2;
  } else {
    result = name(name2) && !/^[a-z]/.test(name2) ? { type: "Identifier", name: name2 } : { type: "Literal", value: name2 };
  }
  if (result.type === "Literal") {
    const name3 = (
      /** @type {string | number} */
      result.value
    );
    return own.call(state.components, name3) ? state.components[name3] : name3;
  }
  if (state.evaluater) {
    return state.evaluater.evaluateExpression(result);
  }
  crashEstree(state);
}
function crashEstree(state, place) {
  const message = new VFileMessage(
    "Cannot handle MDX estrees without `createEvaluater`",
    {
      ancestors: state.ancestors,
      place,
      ruleId: "mdx-estree",
      source: "hast-util-to-jsx-runtime"
    }
  );
  message.file = state.filePath || void 0;
  message.url = docs + "#cannot-handle-mdx-estrees-without-createevaluater";
  throw message;
}
function transformStylesToCssCasing(domCasing) {
  const cssCasing = {};
  let from;
  for (from in domCasing) {
    if (own.call(domCasing, from)) {
      cssCasing[transformStyleToCssCasing(from)] = domCasing[from];
    }
  }
  return cssCasing;
}
function transformStyleToCssCasing(from) {
  let to = from.replace(cap, toDash);
  if (to.slice(0, 3) === "ms-") to = "-" + to;
  return to;
}
function toDash($0) {
  return "-" + $0.toLowerCase();
}

// node_modules/.pnpm/html-url-attributes@3.0.1/node_modules/html-url-attributes/lib/index.js
var urlAttributes = {
  action: ["form"],
  cite: ["blockquote", "del", "ins", "q"],
  data: ["object"],
  formAction: ["button", "input"],
  href: ["a", "area", "base", "link"],
  icon: ["menuitem"],
  itemId: null,
  manifest: ["html"],
  ping: ["a", "area"],
  poster: ["video"],
  src: [
    "audio",
    "embed",
    "iframe",
    "img",
    "input",
    "script",
    "source",
    "track",
    "video"
  ]
};

// node_modules/.pnpm/react-markdown@10.1.0_@types+react@18.3.28_react@18.3.1/node_modules/react-markdown/lib/index.js
init_neon_pilot_shared_react();

// node_modules/.pnpm/mdast-util-to-string@4.0.0/node_modules/mdast-util-to-string/lib/index.js
var emptyOptions2 = {};
function toString(value, options) {
  const settings = options || emptyOptions2;
  const includeImageAlt = typeof settings.includeImageAlt === "boolean" ? settings.includeImageAlt : true;
  const includeHtml = typeof settings.includeHtml === "boolean" ? settings.includeHtml : true;
  return one2(value, includeImageAlt, includeHtml);
}
function one2(value, includeImageAlt, includeHtml) {
  if (node(value)) {
    if ("value" in value) {
      return value.type === "html" && !includeHtml ? "" : value.value;
    }
    if (includeImageAlt && "alt" in value && value.alt) {
      return value.alt;
    }
    if ("children" in value) {
      return all(value.children, includeImageAlt, includeHtml);
    }
  }
  if (Array.isArray(value)) {
    return all(value, includeImageAlt, includeHtml);
  }
  return "";
}
function all(values, includeImageAlt, includeHtml) {
  const result = [];
  let index2 = -1;
  while (++index2 < values.length) {
    result[index2] = one2(values[index2], includeImageAlt, includeHtml);
  }
  return result.join("");
}
function node(value) {
  return Boolean(value && typeof value === "object");
}

// node_modules/.pnpm/decode-named-character-reference@1.3.0/node_modules/decode-named-character-reference/index.dom.js
var element2 = document.createElement("i");
function decodeNamedCharacterReference(value) {
  const characterReference2 = "&" + value + ";";
  element2.innerHTML = characterReference2;
  const character = element2.textContent;
  if (character.charCodeAt(character.length - 1) === 59 && value !== "semi") {
    return false;
  }
  return character === characterReference2 ? false : character;
}

// node_modules/.pnpm/micromark-util-chunked@2.0.1/node_modules/micromark-util-chunked/index.js
function splice(list4, start2, remove, items) {
  const end = list4.length;
  let chunkStart = 0;
  let parameters;
  if (start2 < 0) {
    start2 = -start2 > end ? 0 : end + start2;
  } else {
    start2 = start2 > end ? end : start2;
  }
  remove = remove > 0 ? remove : 0;
  if (items.length < 1e4) {
    parameters = Array.from(items);
    parameters.unshift(start2, remove);
    list4.splice(...parameters);
  } else {
    if (remove) list4.splice(start2, remove);
    while (chunkStart < items.length) {
      parameters = items.slice(chunkStart, chunkStart + 1e4);
      parameters.unshift(start2, 0);
      list4.splice(...parameters);
      chunkStart += 1e4;
      start2 += 1e4;
    }
  }
}
function push(list4, items) {
  if (list4.length > 0) {
    splice(list4, list4.length, 0, items);
    return list4;
  }
  return items;
}

// node_modules/.pnpm/micromark-util-combine-extensions@2.0.1/node_modules/micromark-util-combine-extensions/index.js
var hasOwnProperty = {}.hasOwnProperty;
function combineExtensions(extensions) {
  const all2 = {};
  let index2 = -1;
  while (++index2 < extensions.length) {
    syntaxExtension(all2, extensions[index2]);
  }
  return all2;
}
function syntaxExtension(all2, extension2) {
  let hook;
  for (hook in extension2) {
    const maybe = hasOwnProperty.call(all2, hook) ? all2[hook] : void 0;
    const left = maybe || (all2[hook] = {});
    const right = extension2[hook];
    let code4;
    if (right) {
      for (code4 in right) {
        if (!hasOwnProperty.call(left, code4)) left[code4] = [];
        const value = right[code4];
        constructs(
          // @ts-expect-error Looks like a list.
          left[code4],
          Array.isArray(value) ? value : value ? [value] : []
        );
      }
    }
  }
}
function constructs(existing, list4) {
  let index2 = -1;
  const before = [];
  while (++index2 < list4.length) {
    ;
    (list4[index2].add === "after" ? existing : before).push(list4[index2]);
  }
  splice(existing, 0, 0, before);
}

// node_modules/.pnpm/micromark-util-decode-numeric-character-reference@2.0.2/node_modules/micromark-util-decode-numeric-character-reference/index.js
function decodeNumericCharacterReference(value, base) {
  const code4 = Number.parseInt(value, base);
  if (
    // C0 except for HT, LF, FF, CR, space.
    code4 < 9 || code4 === 11 || code4 > 13 && code4 < 32 || // Control character (DEL) of C0, and C1 controls.
    code4 > 126 && code4 < 160 || // Lone high surrogates and low surrogates.
    code4 > 55295 && code4 < 57344 || // Noncharacters.
    code4 > 64975 && code4 < 65008 || /* eslint-disable no-bitwise */
    (code4 & 65535) === 65535 || (code4 & 65535) === 65534 || /* eslint-enable no-bitwise */
    // Out of range
    code4 > 1114111
  ) {
    return "\uFFFD";
  }
  return String.fromCodePoint(code4);
}

// node_modules/.pnpm/micromark-util-normalize-identifier@2.0.1/node_modules/micromark-util-normalize-identifier/index.js
function normalizeIdentifier(value) {
  return value.replace(/[\t\n\r ]+/g, " ").replace(/^ | $/g, "").toLowerCase().toUpperCase();
}

// node_modules/.pnpm/micromark-util-character@2.1.1/node_modules/micromark-util-character/index.js
var asciiAlpha = regexCheck(/[A-Za-z]/);
var asciiAlphanumeric = regexCheck(/[\dA-Za-z]/);
var asciiAtext = regexCheck(/[#-'*+\--9=?A-Z^-~]/);
function asciiControl(code4) {
  return (
    // Special whitespace codes (which have negative values), C0 and Control
    // character DEL
    code4 !== null && (code4 < 32 || code4 === 127)
  );
}
var asciiDigit = regexCheck(/\d/);
var asciiHexDigit = regexCheck(/[\dA-Fa-f]/);
var asciiPunctuation = regexCheck(/[!-/:-@[-`{-~]/);
function markdownLineEnding(code4) {
  return code4 !== null && code4 < -2;
}
function markdownLineEndingOrSpace(code4) {
  return code4 !== null && (code4 < 0 || code4 === 32);
}
function markdownSpace(code4) {
  return code4 === -2 || code4 === -1 || code4 === 32;
}
var unicodePunctuation = regexCheck(/\p{P}|\p{S}/u);
var unicodeWhitespace = regexCheck(/\s/);
function regexCheck(regex) {
  return check;
  function check(code4) {
    return code4 !== null && code4 > -1 && regex.test(String.fromCharCode(code4));
  }
}

// node_modules/.pnpm/micromark-util-sanitize-uri@2.0.1/node_modules/micromark-util-sanitize-uri/index.js
function normalizeUri(value) {
  const result = [];
  let index2 = -1;
  let start2 = 0;
  let skip = 0;
  while (++index2 < value.length) {
    const code4 = value.charCodeAt(index2);
    let replace3 = "";
    if (code4 === 37 && asciiAlphanumeric(value.charCodeAt(index2 + 1)) && asciiAlphanumeric(value.charCodeAt(index2 + 2))) {
      skip = 2;
    } else if (code4 < 128) {
      if (!/[!#$&-;=?-Z_a-z~]/.test(String.fromCharCode(code4))) {
        replace3 = String.fromCharCode(code4);
      }
    } else if (code4 > 55295 && code4 < 57344) {
      const next = value.charCodeAt(index2 + 1);
      if (code4 < 56320 && next > 56319 && next < 57344) {
        replace3 = String.fromCharCode(code4, next);
        skip = 1;
      } else {
        replace3 = "\uFFFD";
      }
    } else {
      replace3 = String.fromCharCode(code4);
    }
    if (replace3) {
      result.push(value.slice(start2, index2), encodeURIComponent(replace3));
      start2 = index2 + skip + 1;
      replace3 = "";
    }
    if (skip) {
      index2 += skip;
      skip = 0;
    }
  }
  return result.join("") + value.slice(start2);
}

// node_modules/.pnpm/micromark-factory-space@2.0.1/node_modules/micromark-factory-space/index.js
function factorySpace(effects, ok3, type, max) {
  const limit = max ? max - 1 : Number.POSITIVE_INFINITY;
  let size = 0;
  return start2;
  function start2(code4) {
    if (markdownSpace(code4)) {
      effects.enter(type);
      return prefix(code4);
    }
    return ok3(code4);
  }
  function prefix(code4) {
    if (markdownSpace(code4) && size++ < limit) {
      effects.consume(code4);
      return prefix;
    }
    effects.exit(type);
    return ok3(code4);
  }
}

// node_modules/.pnpm/micromark@4.0.2/node_modules/micromark/lib/initialize/content.js
var content = {
  tokenize: initializeContent
};
function initializeContent(effects) {
  const contentStart = effects.attempt(this.parser.constructs.contentInitial, afterContentStartConstruct, paragraphInitial);
  let previous3;
  return contentStart;
  function afterContentStartConstruct(code4) {
    if (code4 === null) {
      effects.consume(code4);
      return;
    }
    effects.enter("lineEnding");
    effects.consume(code4);
    effects.exit("lineEnding");
    return factorySpace(effects, contentStart, "linePrefix");
  }
  function paragraphInitial(code4) {
    effects.enter("paragraph");
    return lineStart(code4);
  }
  function lineStart(code4) {
    const token = effects.enter("chunkText", {
      contentType: "text",
      previous: previous3
    });
    if (previous3) {
      previous3.next = token;
    }
    previous3 = token;
    return data(code4);
  }
  function data(code4) {
    if (code4 === null) {
      effects.exit("chunkText");
      effects.exit("paragraph");
      effects.consume(code4);
      return;
    }
    if (markdownLineEnding(code4)) {
      effects.consume(code4);
      effects.exit("chunkText");
      return lineStart;
    }
    effects.consume(code4);
    return data;
  }
}

// node_modules/.pnpm/micromark@4.0.2/node_modules/micromark/lib/initialize/document.js
var document2 = {
  tokenize: initializeDocument
};
var containerConstruct = {
  tokenize: tokenizeContainer
};
function initializeDocument(effects) {
  const self2 = this;
  const stack = [];
  let continued = 0;
  let childFlow;
  let childToken;
  let lineStartOffset;
  return start2;
  function start2(code4) {
    if (continued < stack.length) {
      const item = stack[continued];
      self2.containerState = item[1];
      return effects.attempt(item[0].continuation, documentContinue, checkNewContainers)(code4);
    }
    return checkNewContainers(code4);
  }
  function documentContinue(code4) {
    continued++;
    if (self2.containerState._closeFlow) {
      self2.containerState._closeFlow = void 0;
      if (childFlow) {
        closeFlow();
      }
      const indexBeforeExits = self2.events.length;
      let indexBeforeFlow = indexBeforeExits;
      let point4;
      while (indexBeforeFlow--) {
        if (self2.events[indexBeforeFlow][0] === "exit" && self2.events[indexBeforeFlow][1].type === "chunkFlow") {
          point4 = self2.events[indexBeforeFlow][1].end;
          break;
        }
      }
      exitContainers(continued);
      let index2 = indexBeforeExits;
      while (index2 < self2.events.length) {
        self2.events[index2][1].end = {
          ...point4
        };
        index2++;
      }
      splice(self2.events, indexBeforeFlow + 1, 0, self2.events.slice(indexBeforeExits));
      self2.events.length = index2;
      return checkNewContainers(code4);
    }
    return start2(code4);
  }
  function checkNewContainers(code4) {
    if (continued === stack.length) {
      if (!childFlow) {
        return documentContinued(code4);
      }
      if (childFlow.currentConstruct && childFlow.currentConstruct.concrete) {
        return flowStart(code4);
      }
      self2.interrupt = Boolean(childFlow.currentConstruct && !childFlow._gfmTableDynamicInterruptHack);
    }
    self2.containerState = {};
    return effects.check(containerConstruct, thereIsANewContainer, thereIsNoNewContainer)(code4);
  }
  function thereIsANewContainer(code4) {
    if (childFlow) closeFlow();
    exitContainers(continued);
    return documentContinued(code4);
  }
  function thereIsNoNewContainer(code4) {
    self2.parser.lazy[self2.now().line] = continued !== stack.length;
    lineStartOffset = self2.now().offset;
    return flowStart(code4);
  }
  function documentContinued(code4) {
    self2.containerState = {};
    return effects.attempt(containerConstruct, containerContinue, flowStart)(code4);
  }
  function containerContinue(code4) {
    continued++;
    stack.push([self2.currentConstruct, self2.containerState]);
    return documentContinued(code4);
  }
  function flowStart(code4) {
    if (code4 === null) {
      if (childFlow) closeFlow();
      exitContainers(0);
      effects.consume(code4);
      return;
    }
    childFlow = childFlow || self2.parser.flow(self2.now());
    effects.enter("chunkFlow", {
      _tokenizer: childFlow,
      contentType: "flow",
      previous: childToken
    });
    return flowContinue(code4);
  }
  function flowContinue(code4) {
    if (code4 === null) {
      writeToChild(effects.exit("chunkFlow"), true);
      exitContainers(0);
      effects.consume(code4);
      return;
    }
    if (markdownLineEnding(code4)) {
      effects.consume(code4);
      writeToChild(effects.exit("chunkFlow"));
      continued = 0;
      self2.interrupt = void 0;
      return start2;
    }
    effects.consume(code4);
    return flowContinue;
  }
  function writeToChild(token, endOfFile) {
    const stream = self2.sliceStream(token);
    if (endOfFile) stream.push(null);
    token.previous = childToken;
    if (childToken) childToken.next = token;
    childToken = token;
    childFlow.defineSkip(token.start);
    childFlow.write(stream);
    if (self2.parser.lazy[token.start.line]) {
      let index2 = childFlow.events.length;
      while (index2--) {
        if (
          // The token starts before the line ending…
          childFlow.events[index2][1].start.offset < lineStartOffset && // …and either is not ended yet…
          (!childFlow.events[index2][1].end || // …or ends after it.
          childFlow.events[index2][1].end.offset > lineStartOffset)
        ) {
          return;
        }
      }
      const indexBeforeExits = self2.events.length;
      let indexBeforeFlow = indexBeforeExits;
      let seen;
      let point4;
      while (indexBeforeFlow--) {
        if (self2.events[indexBeforeFlow][0] === "exit" && self2.events[indexBeforeFlow][1].type === "chunkFlow") {
          if (seen) {
            point4 = self2.events[indexBeforeFlow][1].end;
            break;
          }
          seen = true;
        }
      }
      exitContainers(continued);
      index2 = indexBeforeExits;
      while (index2 < self2.events.length) {
        self2.events[index2][1].end = {
          ...point4
        };
        index2++;
      }
      splice(self2.events, indexBeforeFlow + 1, 0, self2.events.slice(indexBeforeExits));
      self2.events.length = index2;
    }
  }
  function exitContainers(size) {
    let index2 = stack.length;
    while (index2-- > size) {
      const entry = stack[index2];
      self2.containerState = entry[1];
      entry[0].exit.call(self2, effects);
    }
    stack.length = size;
  }
  function closeFlow() {
    childFlow.write([null]);
    childToken = void 0;
    childFlow = void 0;
    self2.containerState._closeFlow = void 0;
  }
}
function tokenizeContainer(effects, ok3, nok) {
  return factorySpace(effects, effects.attempt(this.parser.constructs.document, ok3, nok), "linePrefix", this.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4);
}

// node_modules/.pnpm/micromark-util-classify-character@2.0.1/node_modules/micromark-util-classify-character/index.js
function classifyCharacter(code4) {
  if (code4 === null || markdownLineEndingOrSpace(code4) || unicodeWhitespace(code4)) {
    return 1;
  }
  if (unicodePunctuation(code4)) {
    return 2;
  }
}

// node_modules/.pnpm/micromark-util-resolve-all@2.0.1/node_modules/micromark-util-resolve-all/index.js
function resolveAll(constructs2, events, context) {
  const called = [];
  let index2 = -1;
  while (++index2 < constructs2.length) {
    const resolve = constructs2[index2].resolveAll;
    if (resolve && !called.includes(resolve)) {
      events = resolve(events, context);
      called.push(resolve);
    }
  }
  return events;
}

// node_modules/.pnpm/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/lib/attention.js
var attention = {
  name: "attention",
  resolveAll: resolveAllAttention,
  tokenize: tokenizeAttention
};
function resolveAllAttention(events, context) {
  let index2 = -1;
  let open;
  let group;
  let text7;
  let openingSequence;
  let closingSequence;
  let use;
  let nextEvents;
  let offset;
  while (++index2 < events.length) {
    if (events[index2][0] === "enter" && events[index2][1].type === "attentionSequence" && events[index2][1]._close) {
      open = index2;
      while (open--) {
        if (events[open][0] === "exit" && events[open][1].type === "attentionSequence" && events[open][1]._open && // If the markers are the same:
        context.sliceSerialize(events[open][1]).charCodeAt(0) === context.sliceSerialize(events[index2][1]).charCodeAt(0)) {
          if ((events[open][1]._close || events[index2][1]._open) && (events[index2][1].end.offset - events[index2][1].start.offset) % 3 && !((events[open][1].end.offset - events[open][1].start.offset + events[index2][1].end.offset - events[index2][1].start.offset) % 3)) {
            continue;
          }
          use = events[open][1].end.offset - events[open][1].start.offset > 1 && events[index2][1].end.offset - events[index2][1].start.offset > 1 ? 2 : 1;
          const start2 = {
            ...events[open][1].end
          };
          const end = {
            ...events[index2][1].start
          };
          movePoint(start2, -use);
          movePoint(end, use);
          openingSequence = {
            type: use > 1 ? "strongSequence" : "emphasisSequence",
            start: start2,
            end: {
              ...events[open][1].end
            }
          };
          closingSequence = {
            type: use > 1 ? "strongSequence" : "emphasisSequence",
            start: {
              ...events[index2][1].start
            },
            end
          };
          text7 = {
            type: use > 1 ? "strongText" : "emphasisText",
            start: {
              ...events[open][1].end
            },
            end: {
              ...events[index2][1].start
            }
          };
          group = {
            type: use > 1 ? "strong" : "emphasis",
            start: {
              ...openingSequence.start
            },
            end: {
              ...closingSequence.end
            }
          };
          events[open][1].end = {
            ...openingSequence.start
          };
          events[index2][1].start = {
            ...closingSequence.end
          };
          nextEvents = [];
          if (events[open][1].end.offset - events[open][1].start.offset) {
            nextEvents = push(nextEvents, [["enter", events[open][1], context], ["exit", events[open][1], context]]);
          }
          nextEvents = push(nextEvents, [["enter", group, context], ["enter", openingSequence, context], ["exit", openingSequence, context], ["enter", text7, context]]);
          nextEvents = push(nextEvents, resolveAll(context.parser.constructs.insideSpan.null, events.slice(open + 1, index2), context));
          nextEvents = push(nextEvents, [["exit", text7, context], ["enter", closingSequence, context], ["exit", closingSequence, context], ["exit", group, context]]);
          if (events[index2][1].end.offset - events[index2][1].start.offset) {
            offset = 2;
            nextEvents = push(nextEvents, [["enter", events[index2][1], context], ["exit", events[index2][1], context]]);
          } else {
            offset = 0;
          }
          splice(events, open - 1, index2 - open + 3, nextEvents);
          index2 = open + nextEvents.length - offset - 2;
          break;
        }
      }
    }
  }
  index2 = -1;
  while (++index2 < events.length) {
    if (events[index2][1].type === "attentionSequence") {
      events[index2][1].type = "data";
    }
  }
  return events;
}
function tokenizeAttention(effects, ok3) {
  const attentionMarkers2 = this.parser.constructs.attentionMarkers.null;
  const previous3 = this.previous;
  const before = classifyCharacter(previous3);
  let marker;
  return start2;
  function start2(code4) {
    marker = code4;
    effects.enter("attentionSequence");
    return inside(code4);
  }
  function inside(code4) {
    if (code4 === marker) {
      effects.consume(code4);
      return inside;
    }
    const token = effects.exit("attentionSequence");
    const after = classifyCharacter(code4);
    const open = !after || after === 2 && before || attentionMarkers2.includes(code4);
    const close = !before || before === 2 && after || attentionMarkers2.includes(previous3);
    token._open = Boolean(marker === 42 ? open : open && (before || !close));
    token._close = Boolean(marker === 42 ? close : close && (after || !open));
    return ok3(code4);
  }
}
function movePoint(point4, offset) {
  point4.column += offset;
  point4.offset += offset;
  point4._bufferIndex += offset;
}

// node_modules/.pnpm/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/lib/autolink.js
var autolink = {
  name: "autolink",
  tokenize: tokenizeAutolink
};
function tokenizeAutolink(effects, ok3, nok) {
  let size = 0;
  return start2;
  function start2(code4) {
    effects.enter("autolink");
    effects.enter("autolinkMarker");
    effects.consume(code4);
    effects.exit("autolinkMarker");
    effects.enter("autolinkProtocol");
    return open;
  }
  function open(code4) {
    if (asciiAlpha(code4)) {
      effects.consume(code4);
      return schemeOrEmailAtext;
    }
    if (code4 === 64) {
      return nok(code4);
    }
    return emailAtext(code4);
  }
  function schemeOrEmailAtext(code4) {
    if (code4 === 43 || code4 === 45 || code4 === 46 || asciiAlphanumeric(code4)) {
      size = 1;
      return schemeInsideOrEmailAtext(code4);
    }
    return emailAtext(code4);
  }
  function schemeInsideOrEmailAtext(code4) {
    if (code4 === 58) {
      effects.consume(code4);
      size = 0;
      return urlInside;
    }
    if ((code4 === 43 || code4 === 45 || code4 === 46 || asciiAlphanumeric(code4)) && size++ < 32) {
      effects.consume(code4);
      return schemeInsideOrEmailAtext;
    }
    size = 0;
    return emailAtext(code4);
  }
  function urlInside(code4) {
    if (code4 === 62) {
      effects.exit("autolinkProtocol");
      effects.enter("autolinkMarker");
      effects.consume(code4);
      effects.exit("autolinkMarker");
      effects.exit("autolink");
      return ok3;
    }
    if (code4 === null || code4 === 32 || code4 === 60 || asciiControl(code4)) {
      return nok(code4);
    }
    effects.consume(code4);
    return urlInside;
  }
  function emailAtext(code4) {
    if (code4 === 64) {
      effects.consume(code4);
      return emailAtSignOrDot;
    }
    if (asciiAtext(code4)) {
      effects.consume(code4);
      return emailAtext;
    }
    return nok(code4);
  }
  function emailAtSignOrDot(code4) {
    return asciiAlphanumeric(code4) ? emailLabel(code4) : nok(code4);
  }
  function emailLabel(code4) {
    if (code4 === 46) {
      effects.consume(code4);
      size = 0;
      return emailAtSignOrDot;
    }
    if (code4 === 62) {
      effects.exit("autolinkProtocol").type = "autolinkEmail";
      effects.enter("autolinkMarker");
      effects.consume(code4);
      effects.exit("autolinkMarker");
      effects.exit("autolink");
      return ok3;
    }
    return emailValue(code4);
  }
  function emailValue(code4) {
    if ((code4 === 45 || asciiAlphanumeric(code4)) && size++ < 63) {
      const next = code4 === 45 ? emailValue : emailLabel;
      effects.consume(code4);
      return next;
    }
    return nok(code4);
  }
}

// node_modules/.pnpm/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/lib/blank-line.js
var blankLine = {
  partial: true,
  tokenize: tokenizeBlankLine
};
function tokenizeBlankLine(effects, ok3, nok) {
  return start2;
  function start2(code4) {
    return markdownSpace(code4) ? factorySpace(effects, after, "linePrefix")(code4) : after(code4);
  }
  function after(code4) {
    return code4 === null || markdownLineEnding(code4) ? ok3(code4) : nok(code4);
  }
}

// node_modules/.pnpm/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/lib/block-quote.js
var blockQuote = {
  continuation: {
    tokenize: tokenizeBlockQuoteContinuation
  },
  exit,
  name: "blockQuote",
  tokenize: tokenizeBlockQuoteStart
};
function tokenizeBlockQuoteStart(effects, ok3, nok) {
  const self2 = this;
  return start2;
  function start2(code4) {
    if (code4 === 62) {
      const state = self2.containerState;
      if (!state.open) {
        effects.enter("blockQuote", {
          _container: true
        });
        state.open = true;
      }
      effects.enter("blockQuotePrefix");
      effects.enter("blockQuoteMarker");
      effects.consume(code4);
      effects.exit("blockQuoteMarker");
      return after;
    }
    return nok(code4);
  }
  function after(code4) {
    if (markdownSpace(code4)) {
      effects.enter("blockQuotePrefixWhitespace");
      effects.consume(code4);
      effects.exit("blockQuotePrefixWhitespace");
      effects.exit("blockQuotePrefix");
      return ok3;
    }
    effects.exit("blockQuotePrefix");
    return ok3(code4);
  }
}
function tokenizeBlockQuoteContinuation(effects, ok3, nok) {
  const self2 = this;
  return contStart;
  function contStart(code4) {
    if (markdownSpace(code4)) {
      return factorySpace(effects, contBefore, "linePrefix", self2.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(code4);
    }
    return contBefore(code4);
  }
  function contBefore(code4) {
    return effects.attempt(blockQuote, ok3, nok)(code4);
  }
}
function exit(effects) {
  effects.exit("blockQuote");
}

// node_modules/.pnpm/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/lib/character-escape.js
var characterEscape = {
  name: "characterEscape",
  tokenize: tokenizeCharacterEscape
};
function tokenizeCharacterEscape(effects, ok3, nok) {
  return start2;
  function start2(code4) {
    effects.enter("characterEscape");
    effects.enter("escapeMarker");
    effects.consume(code4);
    effects.exit("escapeMarker");
    return inside;
  }
  function inside(code4) {
    if (asciiPunctuation(code4)) {
      effects.enter("characterEscapeValue");
      effects.consume(code4);
      effects.exit("characterEscapeValue");
      effects.exit("characterEscape");
      return ok3;
    }
    return nok(code4);
  }
}

// node_modules/.pnpm/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/lib/character-reference.js
var characterReference = {
  name: "characterReference",
  tokenize: tokenizeCharacterReference
};
function tokenizeCharacterReference(effects, ok3, nok) {
  const self2 = this;
  let size = 0;
  let max;
  let test;
  return start2;
  function start2(code4) {
    effects.enter("characterReference");
    effects.enter("characterReferenceMarker");
    effects.consume(code4);
    effects.exit("characterReferenceMarker");
    return open;
  }
  function open(code4) {
    if (code4 === 35) {
      effects.enter("characterReferenceMarkerNumeric");
      effects.consume(code4);
      effects.exit("characterReferenceMarkerNumeric");
      return numeric;
    }
    effects.enter("characterReferenceValue");
    max = 31;
    test = asciiAlphanumeric;
    return value(code4);
  }
  function numeric(code4) {
    if (code4 === 88 || code4 === 120) {
      effects.enter("characterReferenceMarkerHexadecimal");
      effects.consume(code4);
      effects.exit("characterReferenceMarkerHexadecimal");
      effects.enter("characterReferenceValue");
      max = 6;
      test = asciiHexDigit;
      return value;
    }
    effects.enter("characterReferenceValue");
    max = 7;
    test = asciiDigit;
    return value(code4);
  }
  function value(code4) {
    if (code4 === 59 && size) {
      const token = effects.exit("characterReferenceValue");
      if (test === asciiAlphanumeric && !decodeNamedCharacterReference(self2.sliceSerialize(token))) {
        return nok(code4);
      }
      effects.enter("characterReferenceMarker");
      effects.consume(code4);
      effects.exit("characterReferenceMarker");
      effects.exit("characterReference");
      return ok3;
    }
    if (test(code4) && size++ < max) {
      effects.consume(code4);
      return value;
    }
    return nok(code4);
  }
}

// node_modules/.pnpm/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/lib/code-fenced.js
var nonLazyContinuation = {
  partial: true,
  tokenize: tokenizeNonLazyContinuation
};
var codeFenced = {
  concrete: true,
  name: "codeFenced",
  tokenize: tokenizeCodeFenced
};
function tokenizeCodeFenced(effects, ok3, nok) {
  const self2 = this;
  const closeStart = {
    partial: true,
    tokenize: tokenizeCloseStart
  };
  let initialPrefix = 0;
  let sizeOpen = 0;
  let marker;
  return start2;
  function start2(code4) {
    return beforeSequenceOpen(code4);
  }
  function beforeSequenceOpen(code4) {
    const tail = self2.events[self2.events.length - 1];
    initialPrefix = tail && tail[1].type === "linePrefix" ? tail[2].sliceSerialize(tail[1], true).length : 0;
    marker = code4;
    effects.enter("codeFenced");
    effects.enter("codeFencedFence");
    effects.enter("codeFencedFenceSequence");
    return sequenceOpen(code4);
  }
  function sequenceOpen(code4) {
    if (code4 === marker) {
      sizeOpen++;
      effects.consume(code4);
      return sequenceOpen;
    }
    if (sizeOpen < 3) {
      return nok(code4);
    }
    effects.exit("codeFencedFenceSequence");
    return markdownSpace(code4) ? factorySpace(effects, infoBefore, "whitespace")(code4) : infoBefore(code4);
  }
  function infoBefore(code4) {
    if (code4 === null || markdownLineEnding(code4)) {
      effects.exit("codeFencedFence");
      return self2.interrupt ? ok3(code4) : effects.check(nonLazyContinuation, atNonLazyBreak, after)(code4);
    }
    effects.enter("codeFencedFenceInfo");
    effects.enter("chunkString", {
      contentType: "string"
    });
    return info(code4);
  }
  function info(code4) {
    if (code4 === null || markdownLineEnding(code4)) {
      effects.exit("chunkString");
      effects.exit("codeFencedFenceInfo");
      return infoBefore(code4);
    }
    if (markdownSpace(code4)) {
      effects.exit("chunkString");
      effects.exit("codeFencedFenceInfo");
      return factorySpace(effects, metaBefore, "whitespace")(code4);
    }
    if (code4 === 96 && code4 === marker) {
      return nok(code4);
    }
    effects.consume(code4);
    return info;
  }
  function metaBefore(code4) {
    if (code4 === null || markdownLineEnding(code4)) {
      return infoBefore(code4);
    }
    effects.enter("codeFencedFenceMeta");
    effects.enter("chunkString", {
      contentType: "string"
    });
    return meta(code4);
  }
  function meta(code4) {
    if (code4 === null || markdownLineEnding(code4)) {
      effects.exit("chunkString");
      effects.exit("codeFencedFenceMeta");
      return infoBefore(code4);
    }
    if (code4 === 96 && code4 === marker) {
      return nok(code4);
    }
    effects.consume(code4);
    return meta;
  }
  function atNonLazyBreak(code4) {
    return effects.attempt(closeStart, after, contentBefore)(code4);
  }
  function contentBefore(code4) {
    effects.enter("lineEnding");
    effects.consume(code4);
    effects.exit("lineEnding");
    return contentStart;
  }
  function contentStart(code4) {
    return initialPrefix > 0 && markdownSpace(code4) ? factorySpace(effects, beforeContentChunk, "linePrefix", initialPrefix + 1)(code4) : beforeContentChunk(code4);
  }
  function beforeContentChunk(code4) {
    if (code4 === null || markdownLineEnding(code4)) {
      return effects.check(nonLazyContinuation, atNonLazyBreak, after)(code4);
    }
    effects.enter("codeFlowValue");
    return contentChunk(code4);
  }
  function contentChunk(code4) {
    if (code4 === null || markdownLineEnding(code4)) {
      effects.exit("codeFlowValue");
      return beforeContentChunk(code4);
    }
    effects.consume(code4);
    return contentChunk;
  }
  function after(code4) {
    effects.exit("codeFenced");
    return ok3(code4);
  }
  function tokenizeCloseStart(effects2, ok4, nok2) {
    let size = 0;
    return startBefore;
    function startBefore(code4) {
      effects2.enter("lineEnding");
      effects2.consume(code4);
      effects2.exit("lineEnding");
      return start3;
    }
    function start3(code4) {
      effects2.enter("codeFencedFence");
      return markdownSpace(code4) ? factorySpace(effects2, beforeSequenceClose, "linePrefix", self2.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(code4) : beforeSequenceClose(code4);
    }
    function beforeSequenceClose(code4) {
      if (code4 === marker) {
        effects2.enter("codeFencedFenceSequence");
        return sequenceClose(code4);
      }
      return nok2(code4);
    }
    function sequenceClose(code4) {
      if (code4 === marker) {
        size++;
        effects2.consume(code4);
        return sequenceClose;
      }
      if (size >= sizeOpen) {
        effects2.exit("codeFencedFenceSequence");
        return markdownSpace(code4) ? factorySpace(effects2, sequenceCloseAfter, "whitespace")(code4) : sequenceCloseAfter(code4);
      }
      return nok2(code4);
    }
    function sequenceCloseAfter(code4) {
      if (code4 === null || markdownLineEnding(code4)) {
        effects2.exit("codeFencedFence");
        return ok4(code4);
      }
      return nok2(code4);
    }
  }
}
function tokenizeNonLazyContinuation(effects, ok3, nok) {
  const self2 = this;
  return start2;
  function start2(code4) {
    if (code4 === null) {
      return nok(code4);
    }
    effects.enter("lineEnding");
    effects.consume(code4);
    effects.exit("lineEnding");
    return lineStart;
  }
  function lineStart(code4) {
    return self2.parser.lazy[self2.now().line] ? nok(code4) : ok3(code4);
  }
}

// node_modules/.pnpm/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/lib/code-indented.js
var codeIndented = {
  name: "codeIndented",
  tokenize: tokenizeCodeIndented
};
var furtherStart = {
  partial: true,
  tokenize: tokenizeFurtherStart
};
function tokenizeCodeIndented(effects, ok3, nok) {
  const self2 = this;
  return start2;
  function start2(code4) {
    effects.enter("codeIndented");
    return factorySpace(effects, afterPrefix, "linePrefix", 4 + 1)(code4);
  }
  function afterPrefix(code4) {
    const tail = self2.events[self2.events.length - 1];
    return tail && tail[1].type === "linePrefix" && tail[2].sliceSerialize(tail[1], true).length >= 4 ? atBreak(code4) : nok(code4);
  }
  function atBreak(code4) {
    if (code4 === null) {
      return after(code4);
    }
    if (markdownLineEnding(code4)) {
      return effects.attempt(furtherStart, atBreak, after)(code4);
    }
    effects.enter("codeFlowValue");
    return inside(code4);
  }
  function inside(code4) {
    if (code4 === null || markdownLineEnding(code4)) {
      effects.exit("codeFlowValue");
      return atBreak(code4);
    }
    effects.consume(code4);
    return inside;
  }
  function after(code4) {
    effects.exit("codeIndented");
    return ok3(code4);
  }
}
function tokenizeFurtherStart(effects, ok3, nok) {
  const self2 = this;
  return furtherStart2;
  function furtherStart2(code4) {
    if (self2.parser.lazy[self2.now().line]) {
      return nok(code4);
    }
    if (markdownLineEnding(code4)) {
      effects.enter("lineEnding");
      effects.consume(code4);
      effects.exit("lineEnding");
      return furtherStart2;
    }
    return factorySpace(effects, afterPrefix, "linePrefix", 4 + 1)(code4);
  }
  function afterPrefix(code4) {
    const tail = self2.events[self2.events.length - 1];
    return tail && tail[1].type === "linePrefix" && tail[2].sliceSerialize(tail[1], true).length >= 4 ? ok3(code4) : markdownLineEnding(code4) ? furtherStart2(code4) : nok(code4);
  }
}

// node_modules/.pnpm/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/lib/code-text.js
var codeText = {
  name: "codeText",
  previous,
  resolve: resolveCodeText,
  tokenize: tokenizeCodeText
};
function resolveCodeText(events) {
  let tailExitIndex = events.length - 4;
  let headEnterIndex = 3;
  let index2;
  let enter;
  if ((events[headEnterIndex][1].type === "lineEnding" || events[headEnterIndex][1].type === "space") && (events[tailExitIndex][1].type === "lineEnding" || events[tailExitIndex][1].type === "space")) {
    index2 = headEnterIndex;
    while (++index2 < tailExitIndex) {
      if (events[index2][1].type === "codeTextData") {
        events[headEnterIndex][1].type = "codeTextPadding";
        events[tailExitIndex][1].type = "codeTextPadding";
        headEnterIndex += 2;
        tailExitIndex -= 2;
        break;
      }
    }
  }
  index2 = headEnterIndex - 1;
  tailExitIndex++;
  while (++index2 <= tailExitIndex) {
    if (enter === void 0) {
      if (index2 !== tailExitIndex && events[index2][1].type !== "lineEnding") {
        enter = index2;
      }
    } else if (index2 === tailExitIndex || events[index2][1].type === "lineEnding") {
      events[enter][1].type = "codeTextData";
      if (index2 !== enter + 2) {
        events[enter][1].end = events[index2 - 1][1].end;
        events.splice(enter + 2, index2 - enter - 2);
        tailExitIndex -= index2 - enter - 2;
        index2 = enter + 2;
      }
      enter = void 0;
    }
  }
  return events;
}
function previous(code4) {
  return code4 !== 96 || this.events[this.events.length - 1][1].type === "characterEscape";
}
function tokenizeCodeText(effects, ok3, nok) {
  const self2 = this;
  let sizeOpen = 0;
  let size;
  let token;
  return start2;
  function start2(code4) {
    effects.enter("codeText");
    effects.enter("codeTextSequence");
    return sequenceOpen(code4);
  }
  function sequenceOpen(code4) {
    if (code4 === 96) {
      effects.consume(code4);
      sizeOpen++;
      return sequenceOpen;
    }
    effects.exit("codeTextSequence");
    return between(code4);
  }
  function between(code4) {
    if (code4 === null) {
      return nok(code4);
    }
    if (code4 === 32) {
      effects.enter("space");
      effects.consume(code4);
      effects.exit("space");
      return between;
    }
    if (code4 === 96) {
      token = effects.enter("codeTextSequence");
      size = 0;
      return sequenceClose(code4);
    }
    if (markdownLineEnding(code4)) {
      effects.enter("lineEnding");
      effects.consume(code4);
      effects.exit("lineEnding");
      return between;
    }
    effects.enter("codeTextData");
    return data(code4);
  }
  function data(code4) {
    if (code4 === null || code4 === 32 || code4 === 96 || markdownLineEnding(code4)) {
      effects.exit("codeTextData");
      return between(code4);
    }
    effects.consume(code4);
    return data;
  }
  function sequenceClose(code4) {
    if (code4 === 96) {
      effects.consume(code4);
      size++;
      return sequenceClose;
    }
    if (size === sizeOpen) {
      effects.exit("codeTextSequence");
      effects.exit("codeText");
      return ok3(code4);
    }
    token.type = "codeTextData";
    return data(code4);
  }
}

// node_modules/.pnpm/micromark-util-subtokenize@2.1.0/node_modules/micromark-util-subtokenize/lib/splice-buffer.js
var SpliceBuffer = class {
  /**
   * @param {ReadonlyArray<T> | null | undefined} [initial]
   *   Initial items (optional).
   * @returns
   *   Splice buffer.
   */
  constructor(initial) {
    this.left = initial ? [...initial] : [];
    this.right = [];
  }
  /**
   * Array access;
   * does not move the cursor.
   *
   * @param {number} index
   *   Index.
   * @return {T}
   *   Item.
   */
  get(index2) {
    if (index2 < 0 || index2 >= this.left.length + this.right.length) {
      throw new RangeError("Cannot access index `" + index2 + "` in a splice buffer of size `" + (this.left.length + this.right.length) + "`");
    }
    if (index2 < this.left.length) return this.left[index2];
    return this.right[this.right.length - index2 + this.left.length - 1];
  }
  /**
   * The length of the splice buffer, one greater than the largest index in the
   * array.
   */
  get length() {
    return this.left.length + this.right.length;
  }
  /**
   * Remove and return `list[0]`;
   * moves the cursor to `0`.
   *
   * @returns {T | undefined}
   *   Item, optional.
   */
  shift() {
    this.setCursor(0);
    return this.right.pop();
  }
  /**
   * Slice the buffer to get an array;
   * does not move the cursor.
   *
   * @param {number} start
   *   Start.
   * @param {number | null | undefined} [end]
   *   End (optional).
   * @returns {Array<T>}
   *   Array of items.
   */
  slice(start2, end) {
    const stop = end === null || end === void 0 ? Number.POSITIVE_INFINITY : end;
    if (stop < this.left.length) {
      return this.left.slice(start2, stop);
    }
    if (start2 > this.left.length) {
      return this.right.slice(this.right.length - stop + this.left.length, this.right.length - start2 + this.left.length).reverse();
    }
    return this.left.slice(start2).concat(this.right.slice(this.right.length - stop + this.left.length).reverse());
  }
  /**
   * Mimics the behavior of Array.prototype.splice() except for the change of
   * interface necessary to avoid segfaults when patching in very large arrays.
   *
   * This operation moves cursor is moved to `start` and results in the cursor
   * placed after any inserted items.
   *
   * @param {number} start
   *   Start;
   *   zero-based index at which to start changing the array;
   *   negative numbers count backwards from the end of the array and values
   *   that are out-of bounds are clamped to the appropriate end of the array.
   * @param {number | null | undefined} [deleteCount=0]
   *   Delete count (default: `0`);
   *   maximum number of elements to delete, starting from start.
   * @param {Array<T> | null | undefined} [items=[]]
   *   Items to include in place of the deleted items (default: `[]`).
   * @return {Array<T>}
   *   Any removed items.
   */
  splice(start2, deleteCount, items) {
    const count = deleteCount || 0;
    this.setCursor(Math.trunc(start2));
    const removed = this.right.splice(this.right.length - count, Number.POSITIVE_INFINITY);
    if (items) chunkedPush(this.left, items);
    return removed.reverse();
  }
  /**
   * Remove and return the highest-numbered item in the array, so
   * `list[list.length - 1]`;
   * Moves the cursor to `length`.
   *
   * @returns {T | undefined}
   *   Item, optional.
   */
  pop() {
    this.setCursor(Number.POSITIVE_INFINITY);
    return this.left.pop();
  }
  /**
   * Inserts a single item to the high-numbered side of the array;
   * moves the cursor to `length`.
   *
   * @param {T} item
   *   Item.
   * @returns {undefined}
   *   Nothing.
   */
  push(item) {
    this.setCursor(Number.POSITIVE_INFINITY);
    this.left.push(item);
  }
  /**
   * Inserts many items to the high-numbered side of the array.
   * Moves the cursor to `length`.
   *
   * @param {Array<T>} items
   *   Items.
   * @returns {undefined}
   *   Nothing.
   */
  pushMany(items) {
    this.setCursor(Number.POSITIVE_INFINITY);
    chunkedPush(this.left, items);
  }
  /**
   * Inserts a single item to the low-numbered side of the array;
   * Moves the cursor to `0`.
   *
   * @param {T} item
   *   Item.
   * @returns {undefined}
   *   Nothing.
   */
  unshift(item) {
    this.setCursor(0);
    this.right.push(item);
  }
  /**
   * Inserts many items to the low-numbered side of the array;
   * moves the cursor to `0`.
   *
   * @param {Array<T>} items
   *   Items.
   * @returns {undefined}
   *   Nothing.
   */
  unshiftMany(items) {
    this.setCursor(0);
    chunkedPush(this.right, items.reverse());
  }
  /**
   * Move the cursor to a specific position in the array. Requires
   * time proportional to the distance moved.
   *
   * If `n < 0`, the cursor will end up at the beginning.
   * If `n > length`, the cursor will end up at the end.
   *
   * @param {number} n
   *   Position.
   * @return {undefined}
   *   Nothing.
   */
  setCursor(n) {
    if (n === this.left.length || n > this.left.length && this.right.length === 0 || n < 0 && this.left.length === 0) return;
    if (n < this.left.length) {
      const removed = this.left.splice(n, Number.POSITIVE_INFINITY);
      chunkedPush(this.right, removed.reverse());
    } else {
      const removed = this.right.splice(this.left.length + this.right.length - n, Number.POSITIVE_INFINITY);
      chunkedPush(this.left, removed.reverse());
    }
  }
};
function chunkedPush(list4, right) {
  let chunkStart = 0;
  if (right.length < 1e4) {
    list4.push(...right);
  } else {
    while (chunkStart < right.length) {
      list4.push(...right.slice(chunkStart, chunkStart + 1e4));
      chunkStart += 1e4;
    }
  }
}

// node_modules/.pnpm/micromark-util-subtokenize@2.1.0/node_modules/micromark-util-subtokenize/index.js
function subtokenize(eventsArray) {
  const jumps = {};
  let index2 = -1;
  let event;
  let lineIndex;
  let otherIndex;
  let otherEvent;
  let parameters;
  let subevents;
  let more;
  const events = new SpliceBuffer(eventsArray);
  while (++index2 < events.length) {
    while (index2 in jumps) {
      index2 = jumps[index2];
    }
    event = events.get(index2);
    if (index2 && event[1].type === "chunkFlow" && events.get(index2 - 1)[1].type === "listItemPrefix") {
      subevents = event[1]._tokenizer.events;
      otherIndex = 0;
      if (otherIndex < subevents.length && subevents[otherIndex][1].type === "lineEndingBlank") {
        otherIndex += 2;
      }
      if (otherIndex < subevents.length && subevents[otherIndex][1].type === "content") {
        while (++otherIndex < subevents.length) {
          if (subevents[otherIndex][1].type === "content") {
            break;
          }
          if (subevents[otherIndex][1].type === "chunkText") {
            subevents[otherIndex][1]._isInFirstContentOfListItem = true;
            otherIndex++;
          }
        }
      }
    }
    if (event[0] === "enter") {
      if (event[1].contentType) {
        Object.assign(jumps, subcontent(events, index2));
        index2 = jumps[index2];
        more = true;
      }
    } else if (event[1]._container) {
      otherIndex = index2;
      lineIndex = void 0;
      while (otherIndex--) {
        otherEvent = events.get(otherIndex);
        if (otherEvent[1].type === "lineEnding" || otherEvent[1].type === "lineEndingBlank") {
          if (otherEvent[0] === "enter") {
            if (lineIndex) {
              events.get(lineIndex)[1].type = "lineEndingBlank";
            }
            otherEvent[1].type = "lineEnding";
            lineIndex = otherIndex;
          }
        } else if (otherEvent[1].type === "linePrefix" || otherEvent[1].type === "listItemIndent") {
        } else {
          break;
        }
      }
      if (lineIndex) {
        event[1].end = {
          ...events.get(lineIndex)[1].start
        };
        parameters = events.slice(lineIndex, index2);
        parameters.unshift(event);
        events.splice(lineIndex, index2 - lineIndex + 1, parameters);
      }
    }
  }
  splice(eventsArray, 0, Number.POSITIVE_INFINITY, events.slice(0));
  return !more;
}
function subcontent(events, eventIndex) {
  const token = events.get(eventIndex)[1];
  const context = events.get(eventIndex)[2];
  let startPosition = eventIndex - 1;
  const startPositions = [];
  let tokenizer = token._tokenizer;
  if (!tokenizer) {
    tokenizer = context.parser[token.contentType](token.start);
    if (token._contentTypeTextTrailing) {
      tokenizer._contentTypeTextTrailing = true;
    }
  }
  const childEvents = tokenizer.events;
  const jumps = [];
  const gaps = {};
  let stream;
  let previous3;
  let index2 = -1;
  let current = token;
  let adjust = 0;
  let start2 = 0;
  const breaks = [start2];
  while (current) {
    while (events.get(++startPosition)[1] !== current) {
    }
    startPositions.push(startPosition);
    if (!current._tokenizer) {
      stream = context.sliceStream(current);
      if (!current.next) {
        stream.push(null);
      }
      if (previous3) {
        tokenizer.defineSkip(current.start);
      }
      if (current._isInFirstContentOfListItem) {
        tokenizer._gfmTasklistFirstContentOfListItem = true;
      }
      tokenizer.write(stream);
      if (current._isInFirstContentOfListItem) {
        tokenizer._gfmTasklistFirstContentOfListItem = void 0;
      }
    }
    previous3 = current;
    current = current.next;
  }
  current = token;
  while (++index2 < childEvents.length) {
    if (
      // Find a void token that includes a break.
      childEvents[index2][0] === "exit" && childEvents[index2 - 1][0] === "enter" && childEvents[index2][1].type === childEvents[index2 - 1][1].type && childEvents[index2][1].start.line !== childEvents[index2][1].end.line
    ) {
      start2 = index2 + 1;
      breaks.push(start2);
      current._tokenizer = void 0;
      current.previous = void 0;
      current = current.next;
    }
  }
  tokenizer.events = [];
  if (current) {
    current._tokenizer = void 0;
    current.previous = void 0;
  } else {
    breaks.pop();
  }
  index2 = breaks.length;
  while (index2--) {
    const slice = childEvents.slice(breaks[index2], breaks[index2 + 1]);
    const start3 = startPositions.pop();
    jumps.push([start3, start3 + slice.length - 1]);
    events.splice(start3, 2, slice);
  }
  jumps.reverse();
  index2 = -1;
  while (++index2 < jumps.length) {
    gaps[adjust + jumps[index2][0]] = adjust + jumps[index2][1];
    adjust += jumps[index2][1] - jumps[index2][0] - 1;
  }
  return gaps;
}

// node_modules/.pnpm/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/lib/content.js
var content2 = {
  resolve: resolveContent,
  tokenize: tokenizeContent
};
var continuationConstruct = {
  partial: true,
  tokenize: tokenizeContinuation
};
function resolveContent(events) {
  subtokenize(events);
  return events;
}
function tokenizeContent(effects, ok3) {
  let previous3;
  return chunkStart;
  function chunkStart(code4) {
    effects.enter("content");
    previous3 = effects.enter("chunkContent", {
      contentType: "content"
    });
    return chunkInside(code4);
  }
  function chunkInside(code4) {
    if (code4 === null) {
      return contentEnd(code4);
    }
    if (markdownLineEnding(code4)) {
      return effects.check(continuationConstruct, contentContinue, contentEnd)(code4);
    }
    effects.consume(code4);
    return chunkInside;
  }
  function contentEnd(code4) {
    effects.exit("chunkContent");
    effects.exit("content");
    return ok3(code4);
  }
  function contentContinue(code4) {
    effects.consume(code4);
    effects.exit("chunkContent");
    previous3.next = effects.enter("chunkContent", {
      contentType: "content",
      previous: previous3
    });
    previous3 = previous3.next;
    return chunkInside;
  }
}
function tokenizeContinuation(effects, ok3, nok) {
  const self2 = this;
  return startLookahead;
  function startLookahead(code4) {
    effects.exit("chunkContent");
    effects.enter("lineEnding");
    effects.consume(code4);
    effects.exit("lineEnding");
    return factorySpace(effects, prefixed, "linePrefix");
  }
  function prefixed(code4) {
    if (code4 === null || markdownLineEnding(code4)) {
      return nok(code4);
    }
    const tail = self2.events[self2.events.length - 1];
    if (!self2.parser.constructs.disable.null.includes("codeIndented") && tail && tail[1].type === "linePrefix" && tail[2].sliceSerialize(tail[1], true).length >= 4) {
      return ok3(code4);
    }
    return effects.interrupt(self2.parser.constructs.flow, nok, ok3)(code4);
  }
}

// node_modules/.pnpm/micromark-factory-destination@2.0.1/node_modules/micromark-factory-destination/index.js
function factoryDestination(effects, ok3, nok, type, literalType, literalMarkerType, rawType, stringType, max) {
  const limit = max || Number.POSITIVE_INFINITY;
  let balance = 0;
  return start2;
  function start2(code4) {
    if (code4 === 60) {
      effects.enter(type);
      effects.enter(literalType);
      effects.enter(literalMarkerType);
      effects.consume(code4);
      effects.exit(literalMarkerType);
      return enclosedBefore;
    }
    if (code4 === null || code4 === 32 || code4 === 41 || asciiControl(code4)) {
      return nok(code4);
    }
    effects.enter(type);
    effects.enter(rawType);
    effects.enter(stringType);
    effects.enter("chunkString", {
      contentType: "string"
    });
    return raw(code4);
  }
  function enclosedBefore(code4) {
    if (code4 === 62) {
      effects.enter(literalMarkerType);
      effects.consume(code4);
      effects.exit(literalMarkerType);
      effects.exit(literalType);
      effects.exit(type);
      return ok3;
    }
    effects.enter(stringType);
    effects.enter("chunkString", {
      contentType: "string"
    });
    return enclosed(code4);
  }
  function enclosed(code4) {
    if (code4 === 62) {
      effects.exit("chunkString");
      effects.exit(stringType);
      return enclosedBefore(code4);
    }
    if (code4 === null || code4 === 60 || markdownLineEnding(code4)) {
      return nok(code4);
    }
    effects.consume(code4);
    return code4 === 92 ? enclosedEscape : enclosed;
  }
  function enclosedEscape(code4) {
    if (code4 === 60 || code4 === 62 || code4 === 92) {
      effects.consume(code4);
      return enclosed;
    }
    return enclosed(code4);
  }
  function raw(code4) {
    if (!balance && (code4 === null || code4 === 41 || markdownLineEndingOrSpace(code4))) {
      effects.exit("chunkString");
      effects.exit(stringType);
      effects.exit(rawType);
      effects.exit(type);
      return ok3(code4);
    }
    if (balance < limit && code4 === 40) {
      effects.consume(code4);
      balance++;
      return raw;
    }
    if (code4 === 41) {
      effects.consume(code4);
      balance--;
      return raw;
    }
    if (code4 === null || code4 === 32 || code4 === 40 || asciiControl(code4)) {
      return nok(code4);
    }
    effects.consume(code4);
    return code4 === 92 ? rawEscape : raw;
  }
  function rawEscape(code4) {
    if (code4 === 40 || code4 === 41 || code4 === 92) {
      effects.consume(code4);
      return raw;
    }
    return raw(code4);
  }
}

// node_modules/.pnpm/micromark-factory-label@2.0.1/node_modules/micromark-factory-label/index.js
function factoryLabel(effects, ok3, nok, type, markerType, stringType) {
  const self2 = this;
  let size = 0;
  let seen;
  return start2;
  function start2(code4) {
    effects.enter(type);
    effects.enter(markerType);
    effects.consume(code4);
    effects.exit(markerType);
    effects.enter(stringType);
    return atBreak;
  }
  function atBreak(code4) {
    if (size > 999 || code4 === null || code4 === 91 || code4 === 93 && !seen || // To do: remove in the future once we’ve switched from
    // `micromark-extension-footnote` to `micromark-extension-gfm-footnote`,
    // which doesn’t need this.
    // Hidden footnotes hook.
    /* c8 ignore next 3 */
    code4 === 94 && !size && "_hiddenFootnoteSupport" in self2.parser.constructs) {
      return nok(code4);
    }
    if (code4 === 93) {
      effects.exit(stringType);
      effects.enter(markerType);
      effects.consume(code4);
      effects.exit(markerType);
      effects.exit(type);
      return ok3;
    }
    if (markdownLineEnding(code4)) {
      effects.enter("lineEnding");
      effects.consume(code4);
      effects.exit("lineEnding");
      return atBreak;
    }
    effects.enter("chunkString", {
      contentType: "string"
    });
    return labelInside(code4);
  }
  function labelInside(code4) {
    if (code4 === null || code4 === 91 || code4 === 93 || markdownLineEnding(code4) || size++ > 999) {
      effects.exit("chunkString");
      return atBreak(code4);
    }
    effects.consume(code4);
    if (!seen) seen = !markdownSpace(code4);
    return code4 === 92 ? labelEscape : labelInside;
  }
  function labelEscape(code4) {
    if (code4 === 91 || code4 === 92 || code4 === 93) {
      effects.consume(code4);
      size++;
      return labelInside;
    }
    return labelInside(code4);
  }
}

// node_modules/.pnpm/micromark-factory-title@2.0.1/node_modules/micromark-factory-title/index.js
function factoryTitle(effects, ok3, nok, type, markerType, stringType) {
  let marker;
  return start2;
  function start2(code4) {
    if (code4 === 34 || code4 === 39 || code4 === 40) {
      effects.enter(type);
      effects.enter(markerType);
      effects.consume(code4);
      effects.exit(markerType);
      marker = code4 === 40 ? 41 : code4;
      return begin;
    }
    return nok(code4);
  }
  function begin(code4) {
    if (code4 === marker) {
      effects.enter(markerType);
      effects.consume(code4);
      effects.exit(markerType);
      effects.exit(type);
      return ok3;
    }
    effects.enter(stringType);
    return atBreak(code4);
  }
  function atBreak(code4) {
    if (code4 === marker) {
      effects.exit(stringType);
      return begin(marker);
    }
    if (code4 === null) {
      return nok(code4);
    }
    if (markdownLineEnding(code4)) {
      effects.enter("lineEnding");
      effects.consume(code4);
      effects.exit("lineEnding");
      return factorySpace(effects, atBreak, "linePrefix");
    }
    effects.enter("chunkString", {
      contentType: "string"
    });
    return inside(code4);
  }
  function inside(code4) {
    if (code4 === marker || code4 === null || markdownLineEnding(code4)) {
      effects.exit("chunkString");
      return atBreak(code4);
    }
    effects.consume(code4);
    return code4 === 92 ? escape : inside;
  }
  function escape(code4) {
    if (code4 === marker || code4 === 92) {
      effects.consume(code4);
      return inside;
    }
    return inside(code4);
  }
}

// node_modules/.pnpm/micromark-factory-whitespace@2.0.1/node_modules/micromark-factory-whitespace/index.js
function factoryWhitespace(effects, ok3) {
  let seen;
  return start2;
  function start2(code4) {
    if (markdownLineEnding(code4)) {
      effects.enter("lineEnding");
      effects.consume(code4);
      effects.exit("lineEnding");
      seen = true;
      return start2;
    }
    if (markdownSpace(code4)) {
      return factorySpace(effects, start2, seen ? "linePrefix" : "lineSuffix")(code4);
    }
    return ok3(code4);
  }
}

// node_modules/.pnpm/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/lib/definition.js
var definition = {
  name: "definition",
  tokenize: tokenizeDefinition
};
var titleBefore = {
  partial: true,
  tokenize: tokenizeTitleBefore
};
function tokenizeDefinition(effects, ok3, nok) {
  const self2 = this;
  let identifier;
  return start2;
  function start2(code4) {
    effects.enter("definition");
    return before(code4);
  }
  function before(code4) {
    return factoryLabel.call(
      self2,
      effects,
      labelAfter,
      // Note: we don’t need to reset the way `markdown-rs` does.
      nok,
      "definitionLabel",
      "definitionLabelMarker",
      "definitionLabelString"
    )(code4);
  }
  function labelAfter(code4) {
    identifier = normalizeIdentifier(self2.sliceSerialize(self2.events[self2.events.length - 1][1]).slice(1, -1));
    if (code4 === 58) {
      effects.enter("definitionMarker");
      effects.consume(code4);
      effects.exit("definitionMarker");
      return markerAfter;
    }
    return nok(code4);
  }
  function markerAfter(code4) {
    return markdownLineEndingOrSpace(code4) ? factoryWhitespace(effects, destinationBefore)(code4) : destinationBefore(code4);
  }
  function destinationBefore(code4) {
    return factoryDestination(
      effects,
      destinationAfter,
      // Note: we don’t need to reset the way `markdown-rs` does.
      nok,
      "definitionDestination",
      "definitionDestinationLiteral",
      "definitionDestinationLiteralMarker",
      "definitionDestinationRaw",
      "definitionDestinationString"
    )(code4);
  }
  function destinationAfter(code4) {
    return effects.attempt(titleBefore, after, after)(code4);
  }
  function after(code4) {
    return markdownSpace(code4) ? factorySpace(effects, afterWhitespace, "whitespace")(code4) : afterWhitespace(code4);
  }
  function afterWhitespace(code4) {
    if (code4 === null || markdownLineEnding(code4)) {
      effects.exit("definition");
      self2.parser.defined.push(identifier);
      return ok3(code4);
    }
    return nok(code4);
  }
}
function tokenizeTitleBefore(effects, ok3, nok) {
  return titleBefore2;
  function titleBefore2(code4) {
    return markdownLineEndingOrSpace(code4) ? factoryWhitespace(effects, beforeMarker)(code4) : nok(code4);
  }
  function beforeMarker(code4) {
    return factoryTitle(effects, titleAfter, nok, "definitionTitle", "definitionTitleMarker", "definitionTitleString")(code4);
  }
  function titleAfter(code4) {
    return markdownSpace(code4) ? factorySpace(effects, titleAfterOptionalWhitespace, "whitespace")(code4) : titleAfterOptionalWhitespace(code4);
  }
  function titleAfterOptionalWhitespace(code4) {
    return code4 === null || markdownLineEnding(code4) ? ok3(code4) : nok(code4);
  }
}

// node_modules/.pnpm/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/lib/hard-break-escape.js
var hardBreakEscape = {
  name: "hardBreakEscape",
  tokenize: tokenizeHardBreakEscape
};
function tokenizeHardBreakEscape(effects, ok3, nok) {
  return start2;
  function start2(code4) {
    effects.enter("hardBreakEscape");
    effects.consume(code4);
    return after;
  }
  function after(code4) {
    if (markdownLineEnding(code4)) {
      effects.exit("hardBreakEscape");
      return ok3(code4);
    }
    return nok(code4);
  }
}

// node_modules/.pnpm/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/lib/heading-atx.js
var headingAtx = {
  name: "headingAtx",
  resolve: resolveHeadingAtx,
  tokenize: tokenizeHeadingAtx
};
function resolveHeadingAtx(events, context) {
  let contentEnd = events.length - 2;
  let contentStart = 3;
  let content3;
  let text7;
  if (events[contentStart][1].type === "whitespace") {
    contentStart += 2;
  }
  if (contentEnd - 2 > contentStart && events[contentEnd][1].type === "whitespace") {
    contentEnd -= 2;
  }
  if (events[contentEnd][1].type === "atxHeadingSequence" && (contentStart === contentEnd - 1 || contentEnd - 4 > contentStart && events[contentEnd - 2][1].type === "whitespace")) {
    contentEnd -= contentStart + 1 === contentEnd ? 2 : 4;
  }
  if (contentEnd > contentStart) {
    content3 = {
      type: "atxHeadingText",
      start: events[contentStart][1].start,
      end: events[contentEnd][1].end
    };
    text7 = {
      type: "chunkText",
      start: events[contentStart][1].start,
      end: events[contentEnd][1].end,
      contentType: "text"
    };
    splice(events, contentStart, contentEnd - contentStart + 1, [["enter", content3, context], ["enter", text7, context], ["exit", text7, context], ["exit", content3, context]]);
  }
  return events;
}
function tokenizeHeadingAtx(effects, ok3, nok) {
  let size = 0;
  return start2;
  function start2(code4) {
    effects.enter("atxHeading");
    return before(code4);
  }
  function before(code4) {
    effects.enter("atxHeadingSequence");
    return sequenceOpen(code4);
  }
  function sequenceOpen(code4) {
    if (code4 === 35 && size++ < 6) {
      effects.consume(code4);
      return sequenceOpen;
    }
    if (code4 === null || markdownLineEndingOrSpace(code4)) {
      effects.exit("atxHeadingSequence");
      return atBreak(code4);
    }
    return nok(code4);
  }
  function atBreak(code4) {
    if (code4 === 35) {
      effects.enter("atxHeadingSequence");
      return sequenceFurther(code4);
    }
    if (code4 === null || markdownLineEnding(code4)) {
      effects.exit("atxHeading");
      return ok3(code4);
    }
    if (markdownSpace(code4)) {
      return factorySpace(effects, atBreak, "whitespace")(code4);
    }
    effects.enter("atxHeadingText");
    return data(code4);
  }
  function sequenceFurther(code4) {
    if (code4 === 35) {
      effects.consume(code4);
      return sequenceFurther;
    }
    effects.exit("atxHeadingSequence");
    return atBreak(code4);
  }
  function data(code4) {
    if (code4 === null || code4 === 35 || markdownLineEndingOrSpace(code4)) {
      effects.exit("atxHeadingText");
      return atBreak(code4);
    }
    effects.consume(code4);
    return data;
  }
}

// node_modules/.pnpm/micromark-util-html-tag-name@2.0.1/node_modules/micromark-util-html-tag-name/index.js
var htmlBlockNames = [
  "address",
  "article",
  "aside",
  "base",
  "basefont",
  "blockquote",
  "body",
  "caption",
  "center",
  "col",
  "colgroup",
  "dd",
  "details",
  "dialog",
  "dir",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "frame",
  "frameset",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hr",
  "html",
  "iframe",
  "legend",
  "li",
  "link",
  "main",
  "menu",
  "menuitem",
  "nav",
  "noframes",
  "ol",
  "optgroup",
  "option",
  "p",
  "param",
  "search",
  "section",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "title",
  "tr",
  "track",
  "ul"
];
var htmlRawNames = ["pre", "script", "style", "textarea"];

// node_modules/.pnpm/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/lib/html-flow.js
var htmlFlow = {
  concrete: true,
  name: "htmlFlow",
  resolveTo: resolveToHtmlFlow,
  tokenize: tokenizeHtmlFlow
};
var blankLineBefore = {
  partial: true,
  tokenize: tokenizeBlankLineBefore
};
var nonLazyContinuationStart = {
  partial: true,
  tokenize: tokenizeNonLazyContinuationStart
};
function resolveToHtmlFlow(events) {
  let index2 = events.length;
  while (index2--) {
    if (events[index2][0] === "enter" && events[index2][1].type === "htmlFlow") {
      break;
    }
  }
  if (index2 > 1 && events[index2 - 2][1].type === "linePrefix") {
    events[index2][1].start = events[index2 - 2][1].start;
    events[index2 + 1][1].start = events[index2 - 2][1].start;
    events.splice(index2 - 2, 2);
  }
  return events;
}
function tokenizeHtmlFlow(effects, ok3, nok) {
  const self2 = this;
  let marker;
  let closingTag;
  let buffer;
  let index2;
  let markerB;
  return start2;
  function start2(code4) {
    return before(code4);
  }
  function before(code4) {
    effects.enter("htmlFlow");
    effects.enter("htmlFlowData");
    effects.consume(code4);
    return open;
  }
  function open(code4) {
    if (code4 === 33) {
      effects.consume(code4);
      return declarationOpen;
    }
    if (code4 === 47) {
      effects.consume(code4);
      closingTag = true;
      return tagCloseStart;
    }
    if (code4 === 63) {
      effects.consume(code4);
      marker = 3;
      return self2.interrupt ? ok3 : continuationDeclarationInside;
    }
    if (asciiAlpha(code4)) {
      effects.consume(code4);
      buffer = String.fromCharCode(code4);
      return tagName;
    }
    return nok(code4);
  }
  function declarationOpen(code4) {
    if (code4 === 45) {
      effects.consume(code4);
      marker = 2;
      return commentOpenInside;
    }
    if (code4 === 91) {
      effects.consume(code4);
      marker = 5;
      index2 = 0;
      return cdataOpenInside;
    }
    if (asciiAlpha(code4)) {
      effects.consume(code4);
      marker = 4;
      return self2.interrupt ? ok3 : continuationDeclarationInside;
    }
    return nok(code4);
  }
  function commentOpenInside(code4) {
    if (code4 === 45) {
      effects.consume(code4);
      return self2.interrupt ? ok3 : continuationDeclarationInside;
    }
    return nok(code4);
  }
  function cdataOpenInside(code4) {
    const value = "CDATA[";
    if (code4 === value.charCodeAt(index2++)) {
      effects.consume(code4);
      if (index2 === value.length) {
        return self2.interrupt ? ok3 : continuation;
      }
      return cdataOpenInside;
    }
    return nok(code4);
  }
  function tagCloseStart(code4) {
    if (asciiAlpha(code4)) {
      effects.consume(code4);
      buffer = String.fromCharCode(code4);
      return tagName;
    }
    return nok(code4);
  }
  function tagName(code4) {
    if (code4 === null || code4 === 47 || code4 === 62 || markdownLineEndingOrSpace(code4)) {
      const slash = code4 === 47;
      const name2 = buffer.toLowerCase();
      if (!slash && !closingTag && htmlRawNames.includes(name2)) {
        marker = 1;
        return self2.interrupt ? ok3(code4) : continuation(code4);
      }
      if (htmlBlockNames.includes(buffer.toLowerCase())) {
        marker = 6;
        if (slash) {
          effects.consume(code4);
          return basicSelfClosing;
        }
        return self2.interrupt ? ok3(code4) : continuation(code4);
      }
      marker = 7;
      return self2.interrupt && !self2.parser.lazy[self2.now().line] ? nok(code4) : closingTag ? completeClosingTagAfter(code4) : completeAttributeNameBefore(code4);
    }
    if (code4 === 45 || asciiAlphanumeric(code4)) {
      effects.consume(code4);
      buffer += String.fromCharCode(code4);
      return tagName;
    }
    return nok(code4);
  }
  function basicSelfClosing(code4) {
    if (code4 === 62) {
      effects.consume(code4);
      return self2.interrupt ? ok3 : continuation;
    }
    return nok(code4);
  }
  function completeClosingTagAfter(code4) {
    if (markdownSpace(code4)) {
      effects.consume(code4);
      return completeClosingTagAfter;
    }
    return completeEnd(code4);
  }
  function completeAttributeNameBefore(code4) {
    if (code4 === 47) {
      effects.consume(code4);
      return completeEnd;
    }
    if (code4 === 58 || code4 === 95 || asciiAlpha(code4)) {
      effects.consume(code4);
      return completeAttributeName;
    }
    if (markdownSpace(code4)) {
      effects.consume(code4);
      return completeAttributeNameBefore;
    }
    return completeEnd(code4);
  }
  function completeAttributeName(code4) {
    if (code4 === 45 || code4 === 46 || code4 === 58 || code4 === 95 || asciiAlphanumeric(code4)) {
      effects.consume(code4);
      return completeAttributeName;
    }
    return completeAttributeNameAfter(code4);
  }
  function completeAttributeNameAfter(code4) {
    if (code4 === 61) {
      effects.consume(code4);
      return completeAttributeValueBefore;
    }
    if (markdownSpace(code4)) {
      effects.consume(code4);
      return completeAttributeNameAfter;
    }
    return completeAttributeNameBefore(code4);
  }
  function completeAttributeValueBefore(code4) {
    if (code4 === null || code4 === 60 || code4 === 61 || code4 === 62 || code4 === 96) {
      return nok(code4);
    }
    if (code4 === 34 || code4 === 39) {
      effects.consume(code4);
      markerB = code4;
      return completeAttributeValueQuoted;
    }
    if (markdownSpace(code4)) {
      effects.consume(code4);
      return completeAttributeValueBefore;
    }
    return completeAttributeValueUnquoted(code4);
  }
  function completeAttributeValueQuoted(code4) {
    if (code4 === markerB) {
      effects.consume(code4);
      markerB = null;
      return completeAttributeValueQuotedAfter;
    }
    if (code4 === null || markdownLineEnding(code4)) {
      return nok(code4);
    }
    effects.consume(code4);
    return completeAttributeValueQuoted;
  }
  function completeAttributeValueUnquoted(code4) {
    if (code4 === null || code4 === 34 || code4 === 39 || code4 === 47 || code4 === 60 || code4 === 61 || code4 === 62 || code4 === 96 || markdownLineEndingOrSpace(code4)) {
      return completeAttributeNameAfter(code4);
    }
    effects.consume(code4);
    return completeAttributeValueUnquoted;
  }
  function completeAttributeValueQuotedAfter(code4) {
    if (code4 === 47 || code4 === 62 || markdownSpace(code4)) {
      return completeAttributeNameBefore(code4);
    }
    return nok(code4);
  }
  function completeEnd(code4) {
    if (code4 === 62) {
      effects.consume(code4);
      return completeAfter;
    }
    return nok(code4);
  }
  function completeAfter(code4) {
    if (code4 === null || markdownLineEnding(code4)) {
      return continuation(code4);
    }
    if (markdownSpace(code4)) {
      effects.consume(code4);
      return completeAfter;
    }
    return nok(code4);
  }
  function continuation(code4) {
    if (code4 === 45 && marker === 2) {
      effects.consume(code4);
      return continuationCommentInside;
    }
    if (code4 === 60 && marker === 1) {
      effects.consume(code4);
      return continuationRawTagOpen;
    }
    if (code4 === 62 && marker === 4) {
      effects.consume(code4);
      return continuationClose;
    }
    if (code4 === 63 && marker === 3) {
      effects.consume(code4);
      return continuationDeclarationInside;
    }
    if (code4 === 93 && marker === 5) {
      effects.consume(code4);
      return continuationCdataInside;
    }
    if (markdownLineEnding(code4) && (marker === 6 || marker === 7)) {
      effects.exit("htmlFlowData");
      return effects.check(blankLineBefore, continuationAfter, continuationStart)(code4);
    }
    if (code4 === null || markdownLineEnding(code4)) {
      effects.exit("htmlFlowData");
      return continuationStart(code4);
    }
    effects.consume(code4);
    return continuation;
  }
  function continuationStart(code4) {
    return effects.check(nonLazyContinuationStart, continuationStartNonLazy, continuationAfter)(code4);
  }
  function continuationStartNonLazy(code4) {
    effects.enter("lineEnding");
    effects.consume(code4);
    effects.exit("lineEnding");
    return continuationBefore;
  }
  function continuationBefore(code4) {
    if (code4 === null || markdownLineEnding(code4)) {
      return continuationStart(code4);
    }
    effects.enter("htmlFlowData");
    return continuation(code4);
  }
  function continuationCommentInside(code4) {
    if (code4 === 45) {
      effects.consume(code4);
      return continuationDeclarationInside;
    }
    return continuation(code4);
  }
  function continuationRawTagOpen(code4) {
    if (code4 === 47) {
      effects.consume(code4);
      buffer = "";
      return continuationRawEndTag;
    }
    return continuation(code4);
  }
  function continuationRawEndTag(code4) {
    if (code4 === 62) {
      const name2 = buffer.toLowerCase();
      if (htmlRawNames.includes(name2)) {
        effects.consume(code4);
        return continuationClose;
      }
      return continuation(code4);
    }
    if (asciiAlpha(code4) && buffer.length < 8) {
      effects.consume(code4);
      buffer += String.fromCharCode(code4);
      return continuationRawEndTag;
    }
    return continuation(code4);
  }
  function continuationCdataInside(code4) {
    if (code4 === 93) {
      effects.consume(code4);
      return continuationDeclarationInside;
    }
    return continuation(code4);
  }
  function continuationDeclarationInside(code4) {
    if (code4 === 62) {
      effects.consume(code4);
      return continuationClose;
    }
    if (code4 === 45 && marker === 2) {
      effects.consume(code4);
      return continuationDeclarationInside;
    }
    return continuation(code4);
  }
  function continuationClose(code4) {
    if (code4 === null || markdownLineEnding(code4)) {
      effects.exit("htmlFlowData");
      return continuationAfter(code4);
    }
    effects.consume(code4);
    return continuationClose;
  }
  function continuationAfter(code4) {
    effects.exit("htmlFlow");
    return ok3(code4);
  }
}
function tokenizeNonLazyContinuationStart(effects, ok3, nok) {
  const self2 = this;
  return start2;
  function start2(code4) {
    if (markdownLineEnding(code4)) {
      effects.enter("lineEnding");
      effects.consume(code4);
      effects.exit("lineEnding");
      return after;
    }
    return nok(code4);
  }
  function after(code4) {
    return self2.parser.lazy[self2.now().line] ? nok(code4) : ok3(code4);
  }
}
function tokenizeBlankLineBefore(effects, ok3, nok) {
  return start2;
  function start2(code4) {
    effects.enter("lineEnding");
    effects.consume(code4);
    effects.exit("lineEnding");
    return effects.attempt(blankLine, ok3, nok);
  }
}

// node_modules/.pnpm/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/lib/html-text.js
var htmlText = {
  name: "htmlText",
  tokenize: tokenizeHtmlText
};
function tokenizeHtmlText(effects, ok3, nok) {
  const self2 = this;
  let marker;
  let index2;
  let returnState;
  return start2;
  function start2(code4) {
    effects.enter("htmlText");
    effects.enter("htmlTextData");
    effects.consume(code4);
    return open;
  }
  function open(code4) {
    if (code4 === 33) {
      effects.consume(code4);
      return declarationOpen;
    }
    if (code4 === 47) {
      effects.consume(code4);
      return tagCloseStart;
    }
    if (code4 === 63) {
      effects.consume(code4);
      return instruction;
    }
    if (asciiAlpha(code4)) {
      effects.consume(code4);
      return tagOpen;
    }
    return nok(code4);
  }
  function declarationOpen(code4) {
    if (code4 === 45) {
      effects.consume(code4);
      return commentOpenInside;
    }
    if (code4 === 91) {
      effects.consume(code4);
      index2 = 0;
      return cdataOpenInside;
    }
    if (asciiAlpha(code4)) {
      effects.consume(code4);
      return declaration;
    }
    return nok(code4);
  }
  function commentOpenInside(code4) {
    if (code4 === 45) {
      effects.consume(code4);
      return commentEnd;
    }
    return nok(code4);
  }
  function comment(code4) {
    if (code4 === null) {
      return nok(code4);
    }
    if (code4 === 45) {
      effects.consume(code4);
      return commentClose;
    }
    if (markdownLineEnding(code4)) {
      returnState = comment;
      return lineEndingBefore(code4);
    }
    effects.consume(code4);
    return comment;
  }
  function commentClose(code4) {
    if (code4 === 45) {
      effects.consume(code4);
      return commentEnd;
    }
    return comment(code4);
  }
  function commentEnd(code4) {
    return code4 === 62 ? end(code4) : code4 === 45 ? commentClose(code4) : comment(code4);
  }
  function cdataOpenInside(code4) {
    const value = "CDATA[";
    if (code4 === value.charCodeAt(index2++)) {
      effects.consume(code4);
      return index2 === value.length ? cdata : cdataOpenInside;
    }
    return nok(code4);
  }
  function cdata(code4) {
    if (code4 === null) {
      return nok(code4);
    }
    if (code4 === 93) {
      effects.consume(code4);
      return cdataClose;
    }
    if (markdownLineEnding(code4)) {
      returnState = cdata;
      return lineEndingBefore(code4);
    }
    effects.consume(code4);
    return cdata;
  }
  function cdataClose(code4) {
    if (code4 === 93) {
      effects.consume(code4);
      return cdataEnd;
    }
    return cdata(code4);
  }
  function cdataEnd(code4) {
    if (code4 === 62) {
      return end(code4);
    }
    if (code4 === 93) {
      effects.consume(code4);
      return cdataEnd;
    }
    return cdata(code4);
  }
  function declaration(code4) {
    if (code4 === null || code4 === 62) {
      return end(code4);
    }
    if (markdownLineEnding(code4)) {
      returnState = declaration;
      return lineEndingBefore(code4);
    }
    effects.consume(code4);
    return declaration;
  }
  function instruction(code4) {
    if (code4 === null) {
      return nok(code4);
    }
    if (code4 === 63) {
      effects.consume(code4);
      return instructionClose;
    }
    if (markdownLineEnding(code4)) {
      returnState = instruction;
      return lineEndingBefore(code4);
    }
    effects.consume(code4);
    return instruction;
  }
  function instructionClose(code4) {
    return code4 === 62 ? end(code4) : instruction(code4);
  }
  function tagCloseStart(code4) {
    if (asciiAlpha(code4)) {
      effects.consume(code4);
      return tagClose;
    }
    return nok(code4);
  }
  function tagClose(code4) {
    if (code4 === 45 || asciiAlphanumeric(code4)) {
      effects.consume(code4);
      return tagClose;
    }
    return tagCloseBetween(code4);
  }
  function tagCloseBetween(code4) {
    if (markdownLineEnding(code4)) {
      returnState = tagCloseBetween;
      return lineEndingBefore(code4);
    }
    if (markdownSpace(code4)) {
      effects.consume(code4);
      return tagCloseBetween;
    }
    return end(code4);
  }
  function tagOpen(code4) {
    if (code4 === 45 || asciiAlphanumeric(code4)) {
      effects.consume(code4);
      return tagOpen;
    }
    if (code4 === 47 || code4 === 62 || markdownLineEndingOrSpace(code4)) {
      return tagOpenBetween(code4);
    }
    return nok(code4);
  }
  function tagOpenBetween(code4) {
    if (code4 === 47) {
      effects.consume(code4);
      return end;
    }
    if (code4 === 58 || code4 === 95 || asciiAlpha(code4)) {
      effects.consume(code4);
      return tagOpenAttributeName;
    }
    if (markdownLineEnding(code4)) {
      returnState = tagOpenBetween;
      return lineEndingBefore(code4);
    }
    if (markdownSpace(code4)) {
      effects.consume(code4);
      return tagOpenBetween;
    }
    return end(code4);
  }
  function tagOpenAttributeName(code4) {
    if (code4 === 45 || code4 === 46 || code4 === 58 || code4 === 95 || asciiAlphanumeric(code4)) {
      effects.consume(code4);
      return tagOpenAttributeName;
    }
    return tagOpenAttributeNameAfter(code4);
  }
  function tagOpenAttributeNameAfter(code4) {
    if (code4 === 61) {
      effects.consume(code4);
      return tagOpenAttributeValueBefore;
    }
    if (markdownLineEnding(code4)) {
      returnState = tagOpenAttributeNameAfter;
      return lineEndingBefore(code4);
    }
    if (markdownSpace(code4)) {
      effects.consume(code4);
      return tagOpenAttributeNameAfter;
    }
    return tagOpenBetween(code4);
  }
  function tagOpenAttributeValueBefore(code4) {
    if (code4 === null || code4 === 60 || code4 === 61 || code4 === 62 || code4 === 96) {
      return nok(code4);
    }
    if (code4 === 34 || code4 === 39) {
      effects.consume(code4);
      marker = code4;
      return tagOpenAttributeValueQuoted;
    }
    if (markdownLineEnding(code4)) {
      returnState = tagOpenAttributeValueBefore;
      return lineEndingBefore(code4);
    }
    if (markdownSpace(code4)) {
      effects.consume(code4);
      return tagOpenAttributeValueBefore;
    }
    effects.consume(code4);
    return tagOpenAttributeValueUnquoted;
  }
  function tagOpenAttributeValueQuoted(code4) {
    if (code4 === marker) {
      effects.consume(code4);
      marker = void 0;
      return tagOpenAttributeValueQuotedAfter;
    }
    if (code4 === null) {
      return nok(code4);
    }
    if (markdownLineEnding(code4)) {
      returnState = tagOpenAttributeValueQuoted;
      return lineEndingBefore(code4);
    }
    effects.consume(code4);
    return tagOpenAttributeValueQuoted;
  }
  function tagOpenAttributeValueUnquoted(code4) {
    if (code4 === null || code4 === 34 || code4 === 39 || code4 === 60 || code4 === 61 || code4 === 96) {
      return nok(code4);
    }
    if (code4 === 47 || code4 === 62 || markdownLineEndingOrSpace(code4)) {
      return tagOpenBetween(code4);
    }
    effects.consume(code4);
    return tagOpenAttributeValueUnquoted;
  }
  function tagOpenAttributeValueQuotedAfter(code4) {
    if (code4 === 47 || code4 === 62 || markdownLineEndingOrSpace(code4)) {
      return tagOpenBetween(code4);
    }
    return nok(code4);
  }
  function end(code4) {
    if (code4 === 62) {
      effects.consume(code4);
      effects.exit("htmlTextData");
      effects.exit("htmlText");
      return ok3;
    }
    return nok(code4);
  }
  function lineEndingBefore(code4) {
    effects.exit("htmlTextData");
    effects.enter("lineEnding");
    effects.consume(code4);
    effects.exit("lineEnding");
    return lineEndingAfter;
  }
  function lineEndingAfter(code4) {
    return markdownSpace(code4) ? factorySpace(effects, lineEndingAfterPrefix, "linePrefix", self2.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(code4) : lineEndingAfterPrefix(code4);
  }
  function lineEndingAfterPrefix(code4) {
    effects.enter("htmlTextData");
    return returnState(code4);
  }
}

// node_modules/.pnpm/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/lib/label-end.js
var labelEnd = {
  name: "labelEnd",
  resolveAll: resolveAllLabelEnd,
  resolveTo: resolveToLabelEnd,
  tokenize: tokenizeLabelEnd
};
var resourceConstruct = {
  tokenize: tokenizeResource
};
var referenceFullConstruct = {
  tokenize: tokenizeReferenceFull
};
var referenceCollapsedConstruct = {
  tokenize: tokenizeReferenceCollapsed
};
function resolveAllLabelEnd(events) {
  let index2 = -1;
  const newEvents = [];
  while (++index2 < events.length) {
    const token = events[index2][1];
    newEvents.push(events[index2]);
    if (token.type === "labelImage" || token.type === "labelLink" || token.type === "labelEnd") {
      const offset = token.type === "labelImage" ? 4 : 2;
      token.type = "data";
      index2 += offset;
    }
  }
  if (events.length !== newEvents.length) {
    splice(events, 0, events.length, newEvents);
  }
  return events;
}
function resolveToLabelEnd(events, context) {
  let index2 = events.length;
  let offset = 0;
  let token;
  let open;
  let close;
  let media;
  while (index2--) {
    token = events[index2][1];
    if (open) {
      if (token.type === "link" || token.type === "labelLink" && token._inactive) {
        break;
      }
      if (events[index2][0] === "enter" && token.type === "labelLink") {
        token._inactive = true;
      }
    } else if (close) {
      if (events[index2][0] === "enter" && (token.type === "labelImage" || token.type === "labelLink") && !token._balanced) {
        open = index2;
        if (token.type !== "labelLink") {
          offset = 2;
          break;
        }
      }
    } else if (token.type === "labelEnd") {
      close = index2;
    }
  }
  const group = {
    type: events[open][1].type === "labelLink" ? "link" : "image",
    start: {
      ...events[open][1].start
    },
    end: {
      ...events[events.length - 1][1].end
    }
  };
  const label = {
    type: "label",
    start: {
      ...events[open][1].start
    },
    end: {
      ...events[close][1].end
    }
  };
  const text7 = {
    type: "labelText",
    start: {
      ...events[open + offset + 2][1].end
    },
    end: {
      ...events[close - 2][1].start
    }
  };
  media = [["enter", group, context], ["enter", label, context]];
  media = push(media, events.slice(open + 1, open + offset + 3));
  media = push(media, [["enter", text7, context]]);
  media = push(media, resolveAll(context.parser.constructs.insideSpan.null, events.slice(open + offset + 4, close - 3), context));
  media = push(media, [["exit", text7, context], events[close - 2], events[close - 1], ["exit", label, context]]);
  media = push(media, events.slice(close + 1));
  media = push(media, [["exit", group, context]]);
  splice(events, open, events.length, media);
  return events;
}
function tokenizeLabelEnd(effects, ok3, nok) {
  const self2 = this;
  let index2 = self2.events.length;
  let labelStart;
  let defined;
  while (index2--) {
    if ((self2.events[index2][1].type === "labelImage" || self2.events[index2][1].type === "labelLink") && !self2.events[index2][1]._balanced) {
      labelStart = self2.events[index2][1];
      break;
    }
  }
  return start2;
  function start2(code4) {
    if (!labelStart) {
      return nok(code4);
    }
    if (labelStart._inactive) {
      return labelEndNok(code4);
    }
    defined = self2.parser.defined.includes(normalizeIdentifier(self2.sliceSerialize({
      start: labelStart.end,
      end: self2.now()
    })));
    effects.enter("labelEnd");
    effects.enter("labelMarker");
    effects.consume(code4);
    effects.exit("labelMarker");
    effects.exit("labelEnd");
    return after;
  }
  function after(code4) {
    if (code4 === 40) {
      return effects.attempt(resourceConstruct, labelEndOk, defined ? labelEndOk : labelEndNok)(code4);
    }
    if (code4 === 91) {
      return effects.attempt(referenceFullConstruct, labelEndOk, defined ? referenceNotFull : labelEndNok)(code4);
    }
    return defined ? labelEndOk(code4) : labelEndNok(code4);
  }
  function referenceNotFull(code4) {
    return effects.attempt(referenceCollapsedConstruct, labelEndOk, labelEndNok)(code4);
  }
  function labelEndOk(code4) {
    return ok3(code4);
  }
  function labelEndNok(code4) {
    labelStart._balanced = true;
    return nok(code4);
  }
}
function tokenizeResource(effects, ok3, nok) {
  return resourceStart;
  function resourceStart(code4) {
    effects.enter("resource");
    effects.enter("resourceMarker");
    effects.consume(code4);
    effects.exit("resourceMarker");
    return resourceBefore;
  }
  function resourceBefore(code4) {
    return markdownLineEndingOrSpace(code4) ? factoryWhitespace(effects, resourceOpen)(code4) : resourceOpen(code4);
  }
  function resourceOpen(code4) {
    if (code4 === 41) {
      return resourceEnd(code4);
    }
    return factoryDestination(effects, resourceDestinationAfter, resourceDestinationMissing, "resourceDestination", "resourceDestinationLiteral", "resourceDestinationLiteralMarker", "resourceDestinationRaw", "resourceDestinationString", 32)(code4);
  }
  function resourceDestinationAfter(code4) {
    return markdownLineEndingOrSpace(code4) ? factoryWhitespace(effects, resourceBetween)(code4) : resourceEnd(code4);
  }
  function resourceDestinationMissing(code4) {
    return nok(code4);
  }
  function resourceBetween(code4) {
    if (code4 === 34 || code4 === 39 || code4 === 40) {
      return factoryTitle(effects, resourceTitleAfter, nok, "resourceTitle", "resourceTitleMarker", "resourceTitleString")(code4);
    }
    return resourceEnd(code4);
  }
  function resourceTitleAfter(code4) {
    return markdownLineEndingOrSpace(code4) ? factoryWhitespace(effects, resourceEnd)(code4) : resourceEnd(code4);
  }
  function resourceEnd(code4) {
    if (code4 === 41) {
      effects.enter("resourceMarker");
      effects.consume(code4);
      effects.exit("resourceMarker");
      effects.exit("resource");
      return ok3;
    }
    return nok(code4);
  }
}
function tokenizeReferenceFull(effects, ok3, nok) {
  const self2 = this;
  return referenceFull;
  function referenceFull(code4) {
    return factoryLabel.call(self2, effects, referenceFullAfter, referenceFullMissing, "reference", "referenceMarker", "referenceString")(code4);
  }
  function referenceFullAfter(code4) {
    return self2.parser.defined.includes(normalizeIdentifier(self2.sliceSerialize(self2.events[self2.events.length - 1][1]).slice(1, -1))) ? ok3(code4) : nok(code4);
  }
  function referenceFullMissing(code4) {
    return nok(code4);
  }
}
function tokenizeReferenceCollapsed(effects, ok3, nok) {
  return referenceCollapsedStart;
  function referenceCollapsedStart(code4) {
    effects.enter("reference");
    effects.enter("referenceMarker");
    effects.consume(code4);
    effects.exit("referenceMarker");
    return referenceCollapsedOpen;
  }
  function referenceCollapsedOpen(code4) {
    if (code4 === 93) {
      effects.enter("referenceMarker");
      effects.consume(code4);
      effects.exit("referenceMarker");
      effects.exit("reference");
      return ok3;
    }
    return nok(code4);
  }
}

// node_modules/.pnpm/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/lib/label-start-image.js
var labelStartImage = {
  name: "labelStartImage",
  resolveAll: labelEnd.resolveAll,
  tokenize: tokenizeLabelStartImage
};
function tokenizeLabelStartImage(effects, ok3, nok) {
  const self2 = this;
  return start2;
  function start2(code4) {
    effects.enter("labelImage");
    effects.enter("labelImageMarker");
    effects.consume(code4);
    effects.exit("labelImageMarker");
    return open;
  }
  function open(code4) {
    if (code4 === 91) {
      effects.enter("labelMarker");
      effects.consume(code4);
      effects.exit("labelMarker");
      effects.exit("labelImage");
      return after;
    }
    return nok(code4);
  }
  function after(code4) {
    return code4 === 94 && "_hiddenFootnoteSupport" in self2.parser.constructs ? nok(code4) : ok3(code4);
  }
}

// node_modules/.pnpm/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/lib/label-start-link.js
var labelStartLink = {
  name: "labelStartLink",
  resolveAll: labelEnd.resolveAll,
  tokenize: tokenizeLabelStartLink
};
function tokenizeLabelStartLink(effects, ok3, nok) {
  const self2 = this;
  return start2;
  function start2(code4) {
    effects.enter("labelLink");
    effects.enter("labelMarker");
    effects.consume(code4);
    effects.exit("labelMarker");
    effects.exit("labelLink");
    return after;
  }
  function after(code4) {
    return code4 === 94 && "_hiddenFootnoteSupport" in self2.parser.constructs ? nok(code4) : ok3(code4);
  }
}

// node_modules/.pnpm/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/lib/line-ending.js
var lineEnding = {
  name: "lineEnding",
  tokenize: tokenizeLineEnding
};
function tokenizeLineEnding(effects, ok3) {
  return start2;
  function start2(code4) {
    effects.enter("lineEnding");
    effects.consume(code4);
    effects.exit("lineEnding");
    return factorySpace(effects, ok3, "linePrefix");
  }
}

// node_modules/.pnpm/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/lib/thematic-break.js
var thematicBreak = {
  name: "thematicBreak",
  tokenize: tokenizeThematicBreak
};
function tokenizeThematicBreak(effects, ok3, nok) {
  let size = 0;
  let marker;
  return start2;
  function start2(code4) {
    effects.enter("thematicBreak");
    return before(code4);
  }
  function before(code4) {
    marker = code4;
    return atBreak(code4);
  }
  function atBreak(code4) {
    if (code4 === marker) {
      effects.enter("thematicBreakSequence");
      return sequence(code4);
    }
    if (size >= 3 && (code4 === null || markdownLineEnding(code4))) {
      effects.exit("thematicBreak");
      return ok3(code4);
    }
    return nok(code4);
  }
  function sequence(code4) {
    if (code4 === marker) {
      effects.consume(code4);
      size++;
      return sequence;
    }
    effects.exit("thematicBreakSequence");
    return markdownSpace(code4) ? factorySpace(effects, atBreak, "whitespace")(code4) : atBreak(code4);
  }
}

// node_modules/.pnpm/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/lib/list.js
var list = {
  continuation: {
    tokenize: tokenizeListContinuation
  },
  exit: tokenizeListEnd,
  name: "list",
  tokenize: tokenizeListStart
};
var listItemPrefixWhitespaceConstruct = {
  partial: true,
  tokenize: tokenizeListItemPrefixWhitespace
};
var indentConstruct = {
  partial: true,
  tokenize: tokenizeIndent
};
function tokenizeListStart(effects, ok3, nok) {
  const self2 = this;
  const tail = self2.events[self2.events.length - 1];
  let initialSize = tail && tail[1].type === "linePrefix" ? tail[2].sliceSerialize(tail[1], true).length : 0;
  let size = 0;
  return start2;
  function start2(code4) {
    const kind = self2.containerState.type || (code4 === 42 || code4 === 43 || code4 === 45 ? "listUnordered" : "listOrdered");
    if (kind === "listUnordered" ? !self2.containerState.marker || code4 === self2.containerState.marker : asciiDigit(code4)) {
      if (!self2.containerState.type) {
        self2.containerState.type = kind;
        effects.enter(kind, {
          _container: true
        });
      }
      if (kind === "listUnordered") {
        effects.enter("listItemPrefix");
        return code4 === 42 || code4 === 45 ? effects.check(thematicBreak, nok, atMarker)(code4) : atMarker(code4);
      }
      if (!self2.interrupt || code4 === 49) {
        effects.enter("listItemPrefix");
        effects.enter("listItemValue");
        return inside(code4);
      }
    }
    return nok(code4);
  }
  function inside(code4) {
    if (asciiDigit(code4) && ++size < 10) {
      effects.consume(code4);
      return inside;
    }
    if ((!self2.interrupt || size < 2) && (self2.containerState.marker ? code4 === self2.containerState.marker : code4 === 41 || code4 === 46)) {
      effects.exit("listItemValue");
      return atMarker(code4);
    }
    return nok(code4);
  }
  function atMarker(code4) {
    effects.enter("listItemMarker");
    effects.consume(code4);
    effects.exit("listItemMarker");
    self2.containerState.marker = self2.containerState.marker || code4;
    return effects.check(
      blankLine,
      // Can’t be empty when interrupting.
      self2.interrupt ? nok : onBlank,
      effects.attempt(listItemPrefixWhitespaceConstruct, endOfPrefix, otherPrefix)
    );
  }
  function onBlank(code4) {
    self2.containerState.initialBlankLine = true;
    initialSize++;
    return endOfPrefix(code4);
  }
  function otherPrefix(code4) {
    if (markdownSpace(code4)) {
      effects.enter("listItemPrefixWhitespace");
      effects.consume(code4);
      effects.exit("listItemPrefixWhitespace");
      return endOfPrefix;
    }
    return nok(code4);
  }
  function endOfPrefix(code4) {
    self2.containerState.size = initialSize + self2.sliceSerialize(effects.exit("listItemPrefix"), true).length;
    return ok3(code4);
  }
}
function tokenizeListContinuation(effects, ok3, nok) {
  const self2 = this;
  self2.containerState._closeFlow = void 0;
  return effects.check(blankLine, onBlank, notBlank);
  function onBlank(code4) {
    self2.containerState.furtherBlankLines = self2.containerState.furtherBlankLines || self2.containerState.initialBlankLine;
    return factorySpace(effects, ok3, "listItemIndent", self2.containerState.size + 1)(code4);
  }
  function notBlank(code4) {
    if (self2.containerState.furtherBlankLines || !markdownSpace(code4)) {
      self2.containerState.furtherBlankLines = void 0;
      self2.containerState.initialBlankLine = void 0;
      return notInCurrentItem(code4);
    }
    self2.containerState.furtherBlankLines = void 0;
    self2.containerState.initialBlankLine = void 0;
    return effects.attempt(indentConstruct, ok3, notInCurrentItem)(code4);
  }
  function notInCurrentItem(code4) {
    self2.containerState._closeFlow = true;
    self2.interrupt = void 0;
    return factorySpace(effects, effects.attempt(list, ok3, nok), "linePrefix", self2.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(code4);
  }
}
function tokenizeIndent(effects, ok3, nok) {
  const self2 = this;
  return factorySpace(effects, afterPrefix, "listItemIndent", self2.containerState.size + 1);
  function afterPrefix(code4) {
    const tail = self2.events[self2.events.length - 1];
    return tail && tail[1].type === "listItemIndent" && tail[2].sliceSerialize(tail[1], true).length === self2.containerState.size ? ok3(code4) : nok(code4);
  }
}
function tokenizeListEnd(effects) {
  effects.exit(this.containerState.type);
}
function tokenizeListItemPrefixWhitespace(effects, ok3, nok) {
  const self2 = this;
  return factorySpace(effects, afterPrefix, "listItemPrefixWhitespace", self2.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4 + 1);
  function afterPrefix(code4) {
    const tail = self2.events[self2.events.length - 1];
    return !markdownSpace(code4) && tail && tail[1].type === "listItemPrefixWhitespace" ? ok3(code4) : nok(code4);
  }
}

// node_modules/.pnpm/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/lib/setext-underline.js
var setextUnderline = {
  name: "setextUnderline",
  resolveTo: resolveToSetextUnderline,
  tokenize: tokenizeSetextUnderline
};
function resolveToSetextUnderline(events, context) {
  let index2 = events.length;
  let content3;
  let text7;
  let definition3;
  while (index2--) {
    if (events[index2][0] === "enter") {
      if (events[index2][1].type === "content") {
        content3 = index2;
        break;
      }
      if (events[index2][1].type === "paragraph") {
        text7 = index2;
      }
    } else {
      if (events[index2][1].type === "content") {
        events.splice(index2, 1);
      }
      if (!definition3 && events[index2][1].type === "definition") {
        definition3 = index2;
      }
    }
  }
  const heading3 = {
    type: "setextHeading",
    start: {
      ...events[content3][1].start
    },
    end: {
      ...events[events.length - 1][1].end
    }
  };
  events[text7][1].type = "setextHeadingText";
  if (definition3) {
    events.splice(text7, 0, ["enter", heading3, context]);
    events.splice(definition3 + 1, 0, ["exit", events[content3][1], context]);
    events[content3][1].end = {
      ...events[definition3][1].end
    };
  } else {
    events[content3][1] = heading3;
  }
  events.push(["exit", heading3, context]);
  return events;
}
function tokenizeSetextUnderline(effects, ok3, nok) {
  const self2 = this;
  let marker;
  return start2;
  function start2(code4) {
    let index2 = self2.events.length;
    let paragraph3;
    while (index2--) {
      if (self2.events[index2][1].type !== "lineEnding" && self2.events[index2][1].type !== "linePrefix" && self2.events[index2][1].type !== "content") {
        paragraph3 = self2.events[index2][1].type === "paragraph";
        break;
      }
    }
    if (!self2.parser.lazy[self2.now().line] && (self2.interrupt || paragraph3)) {
      effects.enter("setextHeadingLine");
      marker = code4;
      return before(code4);
    }
    return nok(code4);
  }
  function before(code4) {
    effects.enter("setextHeadingLineSequence");
    return inside(code4);
  }
  function inside(code4) {
    if (code4 === marker) {
      effects.consume(code4);
      return inside;
    }
    effects.exit("setextHeadingLineSequence");
    return markdownSpace(code4) ? factorySpace(effects, after, "lineSuffix")(code4) : after(code4);
  }
  function after(code4) {
    if (code4 === null || markdownLineEnding(code4)) {
      effects.exit("setextHeadingLine");
      return ok3(code4);
    }
    return nok(code4);
  }
}

// node_modules/.pnpm/micromark@4.0.2/node_modules/micromark/lib/initialize/flow.js
var flow = {
  tokenize: initializeFlow
};
function initializeFlow(effects) {
  const self2 = this;
  const initial = effects.attempt(
    // Try to parse a blank line.
    blankLine,
    atBlankEnding,
    // Try to parse initial flow (essentially, only code).
    effects.attempt(this.parser.constructs.flowInitial, afterConstruct, factorySpace(effects, effects.attempt(this.parser.constructs.flow, afterConstruct, effects.attempt(content2, afterConstruct)), "linePrefix"))
  );
  return initial;
  function atBlankEnding(code4) {
    if (code4 === null) {
      effects.consume(code4);
      return;
    }
    effects.enter("lineEndingBlank");
    effects.consume(code4);
    effects.exit("lineEndingBlank");
    self2.currentConstruct = void 0;
    return initial;
  }
  function afterConstruct(code4) {
    if (code4 === null) {
      effects.consume(code4);
      return;
    }
    effects.enter("lineEnding");
    effects.consume(code4);
    effects.exit("lineEnding");
    self2.currentConstruct = void 0;
    return initial;
  }
}

// node_modules/.pnpm/micromark@4.0.2/node_modules/micromark/lib/initialize/text.js
var resolver = {
  resolveAll: createResolver()
};
var string = initializeFactory("string");
var text2 = initializeFactory("text");
function initializeFactory(field) {
  return {
    resolveAll: createResolver(field === "text" ? resolveAllLineSuffixes : void 0),
    tokenize: initializeText
  };
  function initializeText(effects) {
    const self2 = this;
    const constructs2 = this.parser.constructs[field];
    const text7 = effects.attempt(constructs2, start2, notText);
    return start2;
    function start2(code4) {
      return atBreak(code4) ? text7(code4) : notText(code4);
    }
    function notText(code4) {
      if (code4 === null) {
        effects.consume(code4);
        return;
      }
      effects.enter("data");
      effects.consume(code4);
      return data;
    }
    function data(code4) {
      if (atBreak(code4)) {
        effects.exit("data");
        return text7(code4);
      }
      effects.consume(code4);
      return data;
    }
    function atBreak(code4) {
      if (code4 === null) {
        return true;
      }
      const list4 = constructs2[code4];
      let index2 = -1;
      if (list4) {
        while (++index2 < list4.length) {
          const item = list4[index2];
          if (!item.previous || item.previous.call(self2, self2.previous)) {
            return true;
          }
        }
      }
      return false;
    }
  }
}
function createResolver(extraResolver) {
  return resolveAllText;
  function resolveAllText(events, context) {
    let index2 = -1;
    let enter;
    while (++index2 <= events.length) {
      if (enter === void 0) {
        if (events[index2] && events[index2][1].type === "data") {
          enter = index2;
          index2++;
        }
      } else if (!events[index2] || events[index2][1].type !== "data") {
        if (index2 !== enter + 2) {
          events[enter][1].end = events[index2 - 1][1].end;
          events.splice(enter + 2, index2 - enter - 2);
          index2 = enter + 2;
        }
        enter = void 0;
      }
    }
    return extraResolver ? extraResolver(events, context) : events;
  }
}
function resolveAllLineSuffixes(events, context) {
  let eventIndex = 0;
  while (++eventIndex <= events.length) {
    if ((eventIndex === events.length || events[eventIndex][1].type === "lineEnding") && events[eventIndex - 1][1].type === "data") {
      const data = events[eventIndex - 1][1];
      const chunks = context.sliceStream(data);
      let index2 = chunks.length;
      let bufferIndex = -1;
      let size = 0;
      let tabs;
      while (index2--) {
        const chunk = chunks[index2];
        if (typeof chunk === "string") {
          bufferIndex = chunk.length;
          while (chunk.charCodeAt(bufferIndex - 1) === 32) {
            size++;
            bufferIndex--;
          }
          if (bufferIndex) break;
          bufferIndex = -1;
        } else if (chunk === -2) {
          tabs = true;
          size++;
        } else if (chunk === -1) {
        } else {
          index2++;
          break;
        }
      }
      if (context._contentTypeTextTrailing && eventIndex === events.length) {
        size = 0;
      }
      if (size) {
        const token = {
          type: eventIndex === events.length || tabs || size < 2 ? "lineSuffix" : "hardBreakTrailing",
          start: {
            _bufferIndex: index2 ? bufferIndex : data.start._bufferIndex + bufferIndex,
            _index: data.start._index + index2,
            line: data.end.line,
            column: data.end.column - size,
            offset: data.end.offset - size
          },
          end: {
            ...data.end
          }
        };
        data.end = {
          ...token.start
        };
        if (data.start.offset === data.end.offset) {
          Object.assign(data, token);
        } else {
          events.splice(eventIndex, 0, ["enter", token, context], ["exit", token, context]);
          eventIndex += 2;
        }
      }
      eventIndex++;
    }
  }
  return events;
}

// node_modules/.pnpm/micromark@4.0.2/node_modules/micromark/lib/constructs.js
var constructs_exports = {};
__export(constructs_exports, {
  attentionMarkers: () => attentionMarkers,
  contentInitial: () => contentInitial,
  disable: () => disable,
  document: () => document3,
  flow: () => flow2,
  flowInitial: () => flowInitial,
  insideSpan: () => insideSpan,
  string: () => string2,
  text: () => text3
});
var document3 = {
  [42]: list,
  [43]: list,
  [45]: list,
  [48]: list,
  [49]: list,
  [50]: list,
  [51]: list,
  [52]: list,
  [53]: list,
  [54]: list,
  [55]: list,
  [56]: list,
  [57]: list,
  [62]: blockQuote
};
var contentInitial = {
  [91]: definition
};
var flowInitial = {
  [-2]: codeIndented,
  [-1]: codeIndented,
  [32]: codeIndented
};
var flow2 = {
  [35]: headingAtx,
  [42]: thematicBreak,
  [45]: [setextUnderline, thematicBreak],
  [60]: htmlFlow,
  [61]: setextUnderline,
  [95]: thematicBreak,
  [96]: codeFenced,
  [126]: codeFenced
};
var string2 = {
  [38]: characterReference,
  [92]: characterEscape
};
var text3 = {
  [-5]: lineEnding,
  [-4]: lineEnding,
  [-3]: lineEnding,
  [33]: labelStartImage,
  [38]: characterReference,
  [42]: attention,
  [60]: [autolink, htmlText],
  [91]: labelStartLink,
  [92]: [hardBreakEscape, characterEscape],
  [93]: labelEnd,
  [95]: attention,
  [96]: codeText
};
var insideSpan = {
  null: [attention, resolver]
};
var attentionMarkers = {
  null: [42, 95]
};
var disable = {
  null: []
};

// node_modules/.pnpm/micromark@4.0.2/node_modules/micromark/lib/create-tokenizer.js
function createTokenizer(parser, initialize, from) {
  let point4 = {
    _bufferIndex: -1,
    _index: 0,
    line: from && from.line || 1,
    column: from && from.column || 1,
    offset: from && from.offset || 0
  };
  const columnStart = {};
  const resolveAllConstructs = [];
  let chunks = [];
  let stack = [];
  let consumed = true;
  const effects = {
    attempt: constructFactory(onsuccessfulconstruct),
    check: constructFactory(onsuccessfulcheck),
    consume,
    enter,
    exit: exit3,
    interrupt: constructFactory(onsuccessfulcheck, {
      interrupt: true
    })
  };
  const context = {
    code: null,
    containerState: {},
    defineSkip,
    events: [],
    now,
    parser,
    previous: null,
    sliceSerialize,
    sliceStream,
    write
  };
  let state = initialize.tokenize.call(context, effects);
  let expectedCode;
  if (initialize.resolveAll) {
    resolveAllConstructs.push(initialize);
  }
  return context;
  function write(slice) {
    chunks = push(chunks, slice);
    main();
    if (chunks[chunks.length - 1] !== null) {
      return [];
    }
    addResult(initialize, 0);
    context.events = resolveAll(resolveAllConstructs, context.events, context);
    return context.events;
  }
  function sliceSerialize(token, expandTabs) {
    return serializeChunks(sliceStream(token), expandTabs);
  }
  function sliceStream(token) {
    return sliceChunks(chunks, token);
  }
  function now() {
    const {
      _bufferIndex,
      _index,
      line,
      column,
      offset
    } = point4;
    return {
      _bufferIndex,
      _index,
      line,
      column,
      offset
    };
  }
  function defineSkip(value) {
    columnStart[value.line] = value.column;
    accountForPotentialSkip();
  }
  function main() {
    let chunkIndex;
    while (point4._index < chunks.length) {
      const chunk = chunks[point4._index];
      if (typeof chunk === "string") {
        chunkIndex = point4._index;
        if (point4._bufferIndex < 0) {
          point4._bufferIndex = 0;
        }
        while (point4._index === chunkIndex && point4._bufferIndex < chunk.length) {
          go(chunk.charCodeAt(point4._bufferIndex));
        }
      } else {
        go(chunk);
      }
    }
  }
  function go(code4) {
    consumed = void 0;
    expectedCode = code4;
    state = state(code4);
  }
  function consume(code4) {
    if (markdownLineEnding(code4)) {
      point4.line++;
      point4.column = 1;
      point4.offset += code4 === -3 ? 2 : 1;
      accountForPotentialSkip();
    } else if (code4 !== -1) {
      point4.column++;
      point4.offset++;
    }
    if (point4._bufferIndex < 0) {
      point4._index++;
    } else {
      point4._bufferIndex++;
      if (point4._bufferIndex === // Points w/ non-negative `_bufferIndex` reference
      // strings.
      /** @type {string} */
      chunks[point4._index].length) {
        point4._bufferIndex = -1;
        point4._index++;
      }
    }
    context.previous = code4;
    consumed = true;
  }
  function enter(type, fields) {
    const token = fields || {};
    token.type = type;
    token.start = now();
    context.events.push(["enter", token, context]);
    stack.push(token);
    return token;
  }
  function exit3(type) {
    const token = stack.pop();
    token.end = now();
    context.events.push(["exit", token, context]);
    return token;
  }
  function onsuccessfulconstruct(construct, info) {
    addResult(construct, info.from);
  }
  function onsuccessfulcheck(_, info) {
    info.restore();
  }
  function constructFactory(onreturn, fields) {
    return hook;
    function hook(constructs2, returnState, bogusState) {
      let listOfConstructs;
      let constructIndex;
      let currentConstruct;
      let info;
      return Array.isArray(constructs2) ? (
        /* c8 ignore next 1 */
        handleListOfConstructs(constructs2)
      ) : "tokenize" in constructs2 ? (
        // Looks like a construct.
        handleListOfConstructs([
          /** @type {Construct} */
          constructs2
        ])
      ) : handleMapOfConstructs(constructs2);
      function handleMapOfConstructs(map3) {
        return start2;
        function start2(code4) {
          const left = code4 !== null && map3[code4];
          const all2 = code4 !== null && map3.null;
          const list4 = [
            // To do: add more extension tests.
            /* c8 ignore next 2 */
            ...Array.isArray(left) ? left : left ? [left] : [],
            ...Array.isArray(all2) ? all2 : all2 ? [all2] : []
          ];
          return handleListOfConstructs(list4)(code4);
        }
      }
      function handleListOfConstructs(list4) {
        listOfConstructs = list4;
        constructIndex = 0;
        if (list4.length === 0) {
          return bogusState;
        }
        return handleConstruct(list4[constructIndex]);
      }
      function handleConstruct(construct) {
        return start2;
        function start2(code4) {
          info = store();
          currentConstruct = construct;
          if (!construct.partial) {
            context.currentConstruct = construct;
          }
          if (construct.name && context.parser.constructs.disable.null.includes(construct.name)) {
            return nok(code4);
          }
          return construct.tokenize.call(
            // If we do have fields, create an object w/ `context` as its
            // prototype.
            // This allows a “live binding”, which is needed for `interrupt`.
            fields ? Object.assign(Object.create(context), fields) : context,
            effects,
            ok3,
            nok
          )(code4);
        }
      }
      function ok3(code4) {
        consumed = true;
        onreturn(currentConstruct, info);
        return returnState;
      }
      function nok(code4) {
        consumed = true;
        info.restore();
        if (++constructIndex < listOfConstructs.length) {
          return handleConstruct(listOfConstructs[constructIndex]);
        }
        return bogusState;
      }
    }
  }
  function addResult(construct, from2) {
    if (construct.resolveAll && !resolveAllConstructs.includes(construct)) {
      resolveAllConstructs.push(construct);
    }
    if (construct.resolve) {
      splice(context.events, from2, context.events.length - from2, construct.resolve(context.events.slice(from2), context));
    }
    if (construct.resolveTo) {
      context.events = construct.resolveTo(context.events, context);
    }
  }
  function store() {
    const startPoint = now();
    const startPrevious = context.previous;
    const startCurrentConstruct = context.currentConstruct;
    const startEventsIndex = context.events.length;
    const startStack = Array.from(stack);
    return {
      from: startEventsIndex,
      restore
    };
    function restore() {
      point4 = startPoint;
      context.previous = startPrevious;
      context.currentConstruct = startCurrentConstruct;
      context.events.length = startEventsIndex;
      stack = startStack;
      accountForPotentialSkip();
    }
  }
  function accountForPotentialSkip() {
    if (point4.line in columnStart && point4.column < 2) {
      point4.column = columnStart[point4.line];
      point4.offset += columnStart[point4.line] - 1;
    }
  }
}
function sliceChunks(chunks, token) {
  const startIndex = token.start._index;
  const startBufferIndex = token.start._bufferIndex;
  const endIndex = token.end._index;
  const endBufferIndex = token.end._bufferIndex;
  let view;
  if (startIndex === endIndex) {
    view = [chunks[startIndex].slice(startBufferIndex, endBufferIndex)];
  } else {
    view = chunks.slice(startIndex, endIndex);
    if (startBufferIndex > -1) {
      const head = view[0];
      if (typeof head === "string") {
        view[0] = head.slice(startBufferIndex);
      } else {
        view.shift();
      }
    }
    if (endBufferIndex > 0) {
      view.push(chunks[endIndex].slice(0, endBufferIndex));
    }
  }
  return view;
}
function serializeChunks(chunks, expandTabs) {
  let index2 = -1;
  const result = [];
  let atTab;
  while (++index2 < chunks.length) {
    const chunk = chunks[index2];
    let value;
    if (typeof chunk === "string") {
      value = chunk;
    } else switch (chunk) {
      case -5: {
        value = "\r";
        break;
      }
      case -4: {
        value = "\n";
        break;
      }
      case -3: {
        value = "\r\n";
        break;
      }
      case -2: {
        value = expandTabs ? " " : "	";
        break;
      }
      case -1: {
        if (!expandTabs && atTab) continue;
        value = " ";
        break;
      }
      default: {
        value = String.fromCharCode(chunk);
      }
    }
    atTab = chunk === -2;
    result.push(value);
  }
  return result.join("");
}

// node_modules/.pnpm/micromark@4.0.2/node_modules/micromark/lib/parse.js
function parse(options) {
  const settings = options || {};
  const constructs2 = (
    /** @type {FullNormalizedExtension} */
    combineExtensions([constructs_exports, ...settings.extensions || []])
  );
  const parser = {
    constructs: constructs2,
    content: create(content),
    defined: [],
    document: create(document2),
    flow: create(flow),
    lazy: {},
    string: create(string),
    text: create(text2)
  };
  return parser;
  function create(initial) {
    return creator;
    function creator(from) {
      return createTokenizer(parser, initial, from);
    }
  }
}

// node_modules/.pnpm/micromark@4.0.2/node_modules/micromark/lib/postprocess.js
function postprocess(events) {
  while (!subtokenize(events)) {
  }
  return events;
}

// node_modules/.pnpm/micromark@4.0.2/node_modules/micromark/lib/preprocess.js
var search = /[\0\t\n\r]/g;
function preprocess() {
  let column = 1;
  let buffer = "";
  let start2 = true;
  let atCarriageReturn;
  return preprocessor;
  function preprocessor(value, encoding, end) {
    const chunks = [];
    let match;
    let next;
    let startPosition;
    let endPosition;
    let code4;
    value = buffer + (typeof value === "string" ? value.toString() : new TextDecoder(encoding || void 0).decode(value));
    startPosition = 0;
    buffer = "";
    if (start2) {
      if (value.charCodeAt(0) === 65279) {
        startPosition++;
      }
      start2 = void 0;
    }
    while (startPosition < value.length) {
      search.lastIndex = startPosition;
      match = search.exec(value);
      endPosition = match && match.index !== void 0 ? match.index : value.length;
      code4 = value.charCodeAt(endPosition);
      if (!match) {
        buffer = value.slice(startPosition);
        break;
      }
      if (code4 === 10 && startPosition === endPosition && atCarriageReturn) {
        chunks.push(-3);
        atCarriageReturn = void 0;
      } else {
        if (atCarriageReturn) {
          chunks.push(-5);
          atCarriageReturn = void 0;
        }
        if (startPosition < endPosition) {
          chunks.push(value.slice(startPosition, endPosition));
          column += endPosition - startPosition;
        }
        switch (code4) {
          case 0: {
            chunks.push(65533);
            column++;
            break;
          }
          case 9: {
            next = Math.ceil(column / 4) * 4;
            chunks.push(-2);
            while (column++ < next) chunks.push(-1);
            break;
          }
          case 10: {
            chunks.push(-4);
            column = 1;
            break;
          }
          default: {
            atCarriageReturn = true;
            column = 1;
          }
        }
      }
      startPosition = endPosition + 1;
    }
    if (end) {
      if (atCarriageReturn) chunks.push(-5);
      if (buffer) chunks.push(buffer);
      chunks.push(null);
    }
    return chunks;
  }
}

// node_modules/.pnpm/micromark-util-decode-string@2.0.1/node_modules/micromark-util-decode-string/index.js
var characterEscapeOrReference = /\\([!-/:-@[-`{-~])|&(#(?:\d{1,7}|x[\da-f]{1,6})|[\da-z]{1,31});/gi;
function decodeString(value) {
  return value.replace(characterEscapeOrReference, decode);
}
function decode($0, $1, $2) {
  if ($1) {
    return $1;
  }
  const head = $2.charCodeAt(0);
  if (head === 35) {
    const head2 = $2.charCodeAt(1);
    const hex = head2 === 120 || head2 === 88;
    return decodeNumericCharacterReference($2.slice(hex ? 2 : 1), hex ? 16 : 10);
  }
  return decodeNamedCharacterReference($2) || $0;
}

// node_modules/.pnpm/mdast-util-from-markdown@2.0.3/node_modules/mdast-util-from-markdown/lib/index.js
var own2 = {}.hasOwnProperty;
function fromMarkdown(value, encoding, options) {
  if (encoding && typeof encoding === "object") {
    options = encoding;
    encoding = void 0;
  }
  return compiler(options)(postprocess(parse(options).document().write(preprocess()(value, encoding, true))));
}
function compiler(options) {
  const config = {
    transforms: [],
    canContainEols: ["emphasis", "fragment", "heading", "paragraph", "strong"],
    enter: {
      autolink: opener(link3),
      autolinkProtocol: onenterdata,
      autolinkEmail: onenterdata,
      atxHeading: opener(heading3),
      blockQuote: opener(blockQuote2),
      characterEscape: onenterdata,
      characterReference: onenterdata,
      codeFenced: opener(codeFlow),
      codeFencedFenceInfo: buffer,
      codeFencedFenceMeta: buffer,
      codeIndented: opener(codeFlow, buffer),
      codeText: opener(codeText2, buffer),
      codeTextData: onenterdata,
      data: onenterdata,
      codeFlowValue: onenterdata,
      definition: opener(definition3),
      definitionDestinationString: buffer,
      definitionLabelString: buffer,
      definitionTitleString: buffer,
      emphasis: opener(emphasis3),
      hardBreakEscape: opener(hardBreak3),
      hardBreakTrailing: opener(hardBreak3),
      htmlFlow: opener(html4, buffer),
      htmlFlowData: onenterdata,
      htmlText: opener(html4, buffer),
      htmlTextData: onenterdata,
      image: opener(image3),
      label: buffer,
      link: opener(link3),
      listItem: opener(listItem3),
      listItemValue: onenterlistitemvalue,
      listOrdered: opener(list4, onenterlistordered),
      listUnordered: opener(list4),
      paragraph: opener(paragraph3),
      reference: onenterreference,
      referenceString: buffer,
      resourceDestinationString: buffer,
      resourceTitleString: buffer,
      setextHeading: opener(heading3),
      strong: opener(strong3),
      thematicBreak: opener(thematicBreak4)
    },
    exit: {
      atxHeading: closer(),
      atxHeadingSequence: onexitatxheadingsequence,
      autolink: closer(),
      autolinkEmail: onexitautolinkemail,
      autolinkProtocol: onexitautolinkprotocol,
      blockQuote: closer(),
      characterEscapeValue: onexitdata,
      characterReferenceMarkerHexadecimal: onexitcharacterreferencemarker,
      characterReferenceMarkerNumeric: onexitcharacterreferencemarker,
      characterReferenceValue: onexitcharacterreferencevalue,
      characterReference: onexitcharacterreference,
      codeFenced: closer(onexitcodefenced),
      codeFencedFence: onexitcodefencedfence,
      codeFencedFenceInfo: onexitcodefencedfenceinfo,
      codeFencedFenceMeta: onexitcodefencedfencemeta,
      codeFlowValue: onexitdata,
      codeIndented: closer(onexitcodeindented),
      codeText: closer(onexitcodetext),
      codeTextData: onexitdata,
      data: onexitdata,
      definition: closer(),
      definitionDestinationString: onexitdefinitiondestinationstring,
      definitionLabelString: onexitdefinitionlabelstring,
      definitionTitleString: onexitdefinitiontitlestring,
      emphasis: closer(),
      hardBreakEscape: closer(onexithardbreak),
      hardBreakTrailing: closer(onexithardbreak),
      htmlFlow: closer(onexithtmlflow),
      htmlFlowData: onexitdata,
      htmlText: closer(onexithtmltext),
      htmlTextData: onexitdata,
      image: closer(onexitimage),
      label: onexitlabel,
      labelText: onexitlabeltext,
      lineEnding: onexitlineending,
      link: closer(onexitlink),
      listItem: closer(),
      listOrdered: closer(),
      listUnordered: closer(),
      paragraph: closer(),
      referenceString: onexitreferencestring,
      resourceDestinationString: onexitresourcedestinationstring,
      resourceTitleString: onexitresourcetitlestring,
      resource: onexitresource,
      setextHeading: closer(onexitsetextheading),
      setextHeadingLineSequence: onexitsetextheadinglinesequence,
      setextHeadingText: onexitsetextheadingtext,
      strong: closer(),
      thematicBreak: closer()
    }
  };
  configure(config, (options || {}).mdastExtensions || []);
  const data = {};
  return compile;
  function compile(events) {
    let tree = {
      type: "root",
      children: []
    };
    const context = {
      stack: [tree],
      tokenStack: [],
      config,
      enter,
      exit: exit3,
      buffer,
      resume,
      data
    };
    const listStack = [];
    let index2 = -1;
    while (++index2 < events.length) {
      if (events[index2][1].type === "listOrdered" || events[index2][1].type === "listUnordered") {
        if (events[index2][0] === "enter") {
          listStack.push(index2);
        } else {
          const tail = listStack.pop();
          index2 = prepareList(events, tail, index2);
        }
      }
    }
    index2 = -1;
    while (++index2 < events.length) {
      const handler = config[events[index2][0]];
      if (own2.call(handler, events[index2][1].type)) {
        handler[events[index2][1].type].call(Object.assign({
          sliceSerialize: events[index2][2].sliceSerialize
        }, context), events[index2][1]);
      }
    }
    if (context.tokenStack.length > 0) {
      const tail = context.tokenStack[context.tokenStack.length - 1];
      const handler = tail[1] || defaultOnError;
      handler.call(context, void 0, tail[0]);
    }
    tree.position = {
      start: point3(events.length > 0 ? events[0][1].start : {
        line: 1,
        column: 1,
        offset: 0
      }),
      end: point3(events.length > 0 ? events[events.length - 2][1].end : {
        line: 1,
        column: 1,
        offset: 0
      })
    };
    index2 = -1;
    while (++index2 < config.transforms.length) {
      tree = config.transforms[index2](tree) || tree;
    }
    return tree;
  }
  function prepareList(events, start2, length) {
    let index2 = start2 - 1;
    let containerBalance = -1;
    let listSpread = false;
    let listItem4;
    let lineIndex;
    let firstBlankLineIndex;
    let atMarker;
    while (++index2 <= length) {
      const event = events[index2];
      switch (event[1].type) {
        case "listUnordered":
        case "listOrdered":
        case "blockQuote": {
          if (event[0] === "enter") {
            containerBalance++;
          } else {
            containerBalance--;
          }
          atMarker = void 0;
          break;
        }
        case "lineEndingBlank": {
          if (event[0] === "enter") {
            if (listItem4 && !atMarker && !containerBalance && !firstBlankLineIndex) {
              firstBlankLineIndex = index2;
            }
            atMarker = void 0;
          }
          break;
        }
        case "linePrefix":
        case "listItemValue":
        case "listItemMarker":
        case "listItemPrefix":
        case "listItemPrefixWhitespace": {
          break;
        }
        default: {
          atMarker = void 0;
        }
      }
      if (!containerBalance && event[0] === "enter" && event[1].type === "listItemPrefix" || containerBalance === -1 && event[0] === "exit" && (event[1].type === "listUnordered" || event[1].type === "listOrdered")) {
        if (listItem4) {
          let tailIndex = index2;
          lineIndex = void 0;
          while (tailIndex--) {
            const tailEvent = events[tailIndex];
            if (tailEvent[1].type === "lineEnding" || tailEvent[1].type === "lineEndingBlank") {
              if (tailEvent[0] === "exit") continue;
              if (lineIndex) {
                events[lineIndex][1].type = "lineEndingBlank";
                listSpread = true;
              }
              tailEvent[1].type = "lineEnding";
              lineIndex = tailIndex;
            } else if (tailEvent[1].type === "linePrefix" || tailEvent[1].type === "blockQuotePrefix" || tailEvent[1].type === "blockQuotePrefixWhitespace" || tailEvent[1].type === "blockQuoteMarker" || tailEvent[1].type === "listItemIndent") {
            } else {
              break;
            }
          }
          if (firstBlankLineIndex && (!lineIndex || firstBlankLineIndex < lineIndex)) {
            listItem4._spread = true;
          }
          listItem4.end = Object.assign({}, lineIndex ? events[lineIndex][1].start : event[1].end);
          events.splice(lineIndex || index2, 0, ["exit", listItem4, event[2]]);
          index2++;
          length++;
        }
        if (event[1].type === "listItemPrefix") {
          const item = {
            type: "listItem",
            _spread: false,
            start: Object.assign({}, event[1].start),
            // @ts-expect-error: we’ll add `end` in a second.
            end: void 0
          };
          listItem4 = item;
          events.splice(index2, 0, ["enter", item, event[2]]);
          index2++;
          length++;
          firstBlankLineIndex = void 0;
          atMarker = true;
        }
      }
    }
    events[start2][1]._spread = listSpread;
    return length;
  }
  function opener(create, and) {
    return open;
    function open(token) {
      enter.call(this, create(token), token);
      if (and) and.call(this, token);
    }
  }
  function buffer() {
    this.stack.push({
      type: "fragment",
      children: []
    });
  }
  function enter(node2, token, errorHandler) {
    const parent = this.stack[this.stack.length - 1];
    const siblings = parent.children;
    siblings.push(node2);
    this.stack.push(node2);
    this.tokenStack.push([token, errorHandler || void 0]);
    node2.position = {
      start: point3(token.start),
      // @ts-expect-error: `end` will be patched later.
      end: void 0
    };
  }
  function closer(and) {
    return close;
    function close(token) {
      if (and) and.call(this, token);
      exit3.call(this, token);
    }
  }
  function exit3(token, onExitError) {
    const node2 = this.stack.pop();
    const open = this.tokenStack.pop();
    if (!open) {
      throw new Error("Cannot close `" + token.type + "` (" + stringifyPosition({
        start: token.start,
        end: token.end
      }) + "): it\u2019s not open");
    } else if (open[0].type !== token.type) {
      if (onExitError) {
        onExitError.call(this, token, open[0]);
      } else {
        const handler = open[1] || defaultOnError;
        handler.call(this, token, open[0]);
      }
    }
    node2.position.end = point3(token.end);
  }
  function resume() {
    return toString(this.stack.pop());
  }
  function onenterlistordered() {
    this.data.expectingFirstListItemValue = true;
  }
  function onenterlistitemvalue(token) {
    if (this.data.expectingFirstListItemValue) {
      const ancestor = this.stack[this.stack.length - 2];
      ancestor.start = Number.parseInt(this.sliceSerialize(token), 10);
      this.data.expectingFirstListItemValue = void 0;
    }
  }
  function onexitcodefencedfenceinfo() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.lang = data2;
  }
  function onexitcodefencedfencemeta() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.meta = data2;
  }
  function onexitcodefencedfence() {
    if (this.data.flowCodeInside) return;
    this.buffer();
    this.data.flowCodeInside = true;
  }
  function onexitcodefenced() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.value = data2.replace(/^(\r?\n|\r)|(\r?\n|\r)$/g, "");
    this.data.flowCodeInside = void 0;
  }
  function onexitcodeindented() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.value = data2.replace(/(\r?\n|\r)$/g, "");
  }
  function onexitdefinitionlabelstring(token) {
    const label = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.label = label;
    node2.identifier = normalizeIdentifier(this.sliceSerialize(token)).toLowerCase();
  }
  function onexitdefinitiontitlestring() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.title = data2;
  }
  function onexitdefinitiondestinationstring() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.url = data2;
  }
  function onexitatxheadingsequence(token) {
    const node2 = this.stack[this.stack.length - 1];
    if (!node2.depth) {
      const depth = this.sliceSerialize(token).length;
      node2.depth = depth;
    }
  }
  function onexitsetextheadingtext() {
    this.data.setextHeadingSlurpLineEnding = true;
  }
  function onexitsetextheadinglinesequence(token) {
    const node2 = this.stack[this.stack.length - 1];
    node2.depth = this.sliceSerialize(token).codePointAt(0) === 61 ? 1 : 2;
  }
  function onexitsetextheading() {
    this.data.setextHeadingSlurpLineEnding = void 0;
  }
  function onenterdata(token) {
    const node2 = this.stack[this.stack.length - 1];
    const siblings = node2.children;
    let tail = siblings[siblings.length - 1];
    if (!tail || tail.type !== "text") {
      tail = text7();
      tail.position = {
        start: point3(token.start),
        // @ts-expect-error: we’ll add `end` later.
        end: void 0
      };
      siblings.push(tail);
    }
    this.stack.push(tail);
  }
  function onexitdata(token) {
    const tail = this.stack.pop();
    tail.value += this.sliceSerialize(token);
    tail.position.end = point3(token.end);
  }
  function onexitlineending(token) {
    const context = this.stack[this.stack.length - 1];
    if (this.data.atHardBreak) {
      const tail = context.children[context.children.length - 1];
      tail.position.end = point3(token.end);
      this.data.atHardBreak = void 0;
      return;
    }
    if (!this.data.setextHeadingSlurpLineEnding && config.canContainEols.includes(context.type)) {
      onenterdata.call(this, token);
      onexitdata.call(this, token);
    }
  }
  function onexithardbreak() {
    this.data.atHardBreak = true;
  }
  function onexithtmlflow() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.value = data2;
  }
  function onexithtmltext() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.value = data2;
  }
  function onexitcodetext() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.value = data2;
  }
  function onexitlink() {
    const node2 = this.stack[this.stack.length - 1];
    if (this.data.inReference) {
      const referenceType = this.data.referenceType || "shortcut";
      node2.type += "Reference";
      node2.referenceType = referenceType;
      delete node2.url;
      delete node2.title;
    } else {
      delete node2.identifier;
      delete node2.label;
    }
    this.data.referenceType = void 0;
  }
  function onexitimage() {
    const node2 = this.stack[this.stack.length - 1];
    if (this.data.inReference) {
      const referenceType = this.data.referenceType || "shortcut";
      node2.type += "Reference";
      node2.referenceType = referenceType;
      delete node2.url;
      delete node2.title;
    } else {
      delete node2.identifier;
      delete node2.label;
    }
    this.data.referenceType = void 0;
  }
  function onexitlabeltext(token) {
    const string3 = this.sliceSerialize(token);
    const ancestor = this.stack[this.stack.length - 2];
    ancestor.label = decodeString(string3);
    ancestor.identifier = normalizeIdentifier(string3).toLowerCase();
  }
  function onexitlabel() {
    const fragment = this.stack[this.stack.length - 1];
    const value = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    this.data.inReference = true;
    if (node2.type === "link") {
      const children = fragment.children;
      node2.children = children;
    } else {
      node2.alt = value;
    }
  }
  function onexitresourcedestinationstring() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.url = data2;
  }
  function onexitresourcetitlestring() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.title = data2;
  }
  function onexitresource() {
    this.data.inReference = void 0;
  }
  function onenterreference() {
    this.data.referenceType = "collapsed";
  }
  function onexitreferencestring(token) {
    const label = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.label = label;
    node2.identifier = normalizeIdentifier(this.sliceSerialize(token)).toLowerCase();
    this.data.referenceType = "full";
  }
  function onexitcharacterreferencemarker(token) {
    this.data.characterReferenceType = token.type;
  }
  function onexitcharacterreferencevalue(token) {
    const data2 = this.sliceSerialize(token);
    const type = this.data.characterReferenceType;
    let value;
    if (type) {
      value = decodeNumericCharacterReference(data2, type === "characterReferenceMarkerNumeric" ? 10 : 16);
      this.data.characterReferenceType = void 0;
    } else {
      const result = decodeNamedCharacterReference(data2);
      value = result;
    }
    const tail = this.stack[this.stack.length - 1];
    tail.value += value;
  }
  function onexitcharacterreference(token) {
    const tail = this.stack.pop();
    tail.position.end = point3(token.end);
  }
  function onexitautolinkprotocol(token) {
    onexitdata.call(this, token);
    const node2 = this.stack[this.stack.length - 1];
    node2.url = this.sliceSerialize(token);
  }
  function onexitautolinkemail(token) {
    onexitdata.call(this, token);
    const node2 = this.stack[this.stack.length - 1];
    node2.url = "mailto:" + this.sliceSerialize(token);
  }
  function blockQuote2() {
    return {
      type: "blockquote",
      children: []
    };
  }
  function codeFlow() {
    return {
      type: "code",
      lang: null,
      meta: null,
      value: ""
    };
  }
  function codeText2() {
    return {
      type: "inlineCode",
      value: ""
    };
  }
  function definition3() {
    return {
      type: "definition",
      identifier: "",
      label: null,
      title: null,
      url: ""
    };
  }
  function emphasis3() {
    return {
      type: "emphasis",
      children: []
    };
  }
  function heading3() {
    return {
      type: "heading",
      // @ts-expect-error `depth` will be set later.
      depth: 0,
      children: []
    };
  }
  function hardBreak3() {
    return {
      type: "break"
    };
  }
  function html4() {
    return {
      type: "html",
      value: ""
    };
  }
  function image3() {
    return {
      type: "image",
      title: null,
      url: "",
      alt: null
    };
  }
  function link3() {
    return {
      type: "link",
      title: null,
      url: "",
      children: []
    };
  }
  function list4(token) {
    return {
      type: "list",
      ordered: token.type === "listOrdered",
      start: null,
      spread: token._spread,
      children: []
    };
  }
  function listItem3(token) {
    return {
      type: "listItem",
      spread: token._spread,
      checked: null,
      children: []
    };
  }
  function paragraph3() {
    return {
      type: "paragraph",
      children: []
    };
  }
  function strong3() {
    return {
      type: "strong",
      children: []
    };
  }
  function text7() {
    return {
      type: "text",
      value: ""
    };
  }
  function thematicBreak4() {
    return {
      type: "thematicBreak"
    };
  }
}
function point3(d) {
  return {
    line: d.line,
    column: d.column,
    offset: d.offset
  };
}
function configure(combined, extensions) {
  let index2 = -1;
  while (++index2 < extensions.length) {
    const value = extensions[index2];
    if (Array.isArray(value)) {
      configure(combined, value);
    } else {
      extension(combined, value);
    }
  }
}
function extension(combined, extension2) {
  let key;
  for (key in extension2) {
    if (own2.call(extension2, key)) {
      switch (key) {
        case "canContainEols": {
          const right = extension2[key];
          if (right) {
            combined[key].push(...right);
          }
          break;
        }
        case "transforms": {
          const right = extension2[key];
          if (right) {
            combined[key].push(...right);
          }
          break;
        }
        case "enter":
        case "exit": {
          const right = extension2[key];
          if (right) {
            Object.assign(combined[key], right);
          }
          break;
        }
      }
    }
  }
}
function defaultOnError(left, right) {
  if (left) {
    throw new Error("Cannot close `" + left.type + "` (" + stringifyPosition({
      start: left.start,
      end: left.end
    }) + "): a different token (`" + right.type + "`, " + stringifyPosition({
      start: right.start,
      end: right.end
    }) + ") is open");
  } else {
    throw new Error("Cannot close document, a token (`" + right.type + "`, " + stringifyPosition({
      start: right.start,
      end: right.end
    }) + ") is still open");
  }
}

// node_modules/.pnpm/remark-parse@11.0.0/node_modules/remark-parse/lib/index.js
function remarkParse(options) {
  const self2 = this;
  self2.parser = parser;
  function parser(doc) {
    return fromMarkdown(doc, {
      ...self2.data("settings"),
      ...options,
      // Note: these options are not in the readme.
      // The goal is for them to be set by plugins on `data` instead of being
      // passed by users.
      extensions: self2.data("micromarkExtensions") || [],
      mdastExtensions: self2.data("fromMarkdownExtensions") || []
    });
  }
}

// node_modules/.pnpm/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/blockquote.js
function blockquote(state, node2) {
  const result = {
    type: "element",
    tagName: "blockquote",
    properties: {},
    children: state.wrap(state.all(node2), true)
  };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// node_modules/.pnpm/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/break.js
function hardBreak(state, node2) {
  const result = { type: "element", tagName: "br", properties: {}, children: [] };
  state.patch(node2, result);
  return [state.applyData(node2, result), { type: "text", value: "\n" }];
}

// node_modules/.pnpm/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/code.js
function code(state, node2) {
  const value = node2.value ? node2.value + "\n" : "";
  const properties = {};
  const language = node2.lang ? node2.lang.split(/\s+/) : [];
  if (language.length > 0) {
    properties.className = ["language-" + language[0]];
  }
  let result = {
    type: "element",
    tagName: "code",
    properties,
    children: [{ type: "text", value }]
  };
  if (node2.meta) {
    result.data = { meta: node2.meta };
  }
  state.patch(node2, result);
  result = state.applyData(node2, result);
  result = { type: "element", tagName: "pre", properties: {}, children: [result] };
  state.patch(node2, result);
  return result;
}

// node_modules/.pnpm/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/delete.js
function strikethrough(state, node2) {
  const result = {
    type: "element",
    tagName: "del",
    properties: {},
    children: state.all(node2)
  };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// node_modules/.pnpm/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/emphasis.js
function emphasis(state, node2) {
  const result = {
    type: "element",
    tagName: "em",
    properties: {},
    children: state.all(node2)
  };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// node_modules/.pnpm/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/footnote-reference.js
function footnoteReference(state, node2) {
  const clobberPrefix = typeof state.options.clobberPrefix === "string" ? state.options.clobberPrefix : "user-content-";
  const id = String(node2.identifier).toUpperCase();
  const safeId = normalizeUri(id.toLowerCase());
  const index2 = state.footnoteOrder.indexOf(id);
  let counter;
  let reuseCounter = state.footnoteCounts.get(id);
  if (reuseCounter === void 0) {
    reuseCounter = 0;
    state.footnoteOrder.push(id);
    counter = state.footnoteOrder.length;
  } else {
    counter = index2 + 1;
  }
  reuseCounter += 1;
  state.footnoteCounts.set(id, reuseCounter);
  const link3 = {
    type: "element",
    tagName: "a",
    properties: {
      href: "#" + clobberPrefix + "fn-" + safeId,
      id: clobberPrefix + "fnref-" + safeId + (reuseCounter > 1 ? "-" + reuseCounter : ""),
      dataFootnoteRef: true,
      ariaDescribedBy: ["footnote-label"]
    },
    children: [{ type: "text", value: String(counter) }]
  };
  state.patch(node2, link3);
  const sup = {
    type: "element",
    tagName: "sup",
    properties: {},
    children: [link3]
  };
  state.patch(node2, sup);
  return state.applyData(node2, sup);
}

// node_modules/.pnpm/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/heading.js
function heading(state, node2) {
  const result = {
    type: "element",
    tagName: "h" + node2.depth,
    properties: {},
    children: state.all(node2)
  };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// node_modules/.pnpm/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/html.js
function html2(state, node2) {
  if (state.options.allowDangerousHtml) {
    const result = { type: "raw", value: node2.value };
    state.patch(node2, result);
    return state.applyData(node2, result);
  }
  return void 0;
}

// node_modules/.pnpm/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/revert.js
function revert(state, node2) {
  const subtype = node2.referenceType;
  let suffix = "]";
  if (subtype === "collapsed") {
    suffix += "[]";
  } else if (subtype === "full") {
    suffix += "[" + (node2.label || node2.identifier) + "]";
  }
  if (node2.type === "imageReference") {
    return [{ type: "text", value: "![" + node2.alt + suffix }];
  }
  const contents = state.all(node2);
  const head = contents[0];
  if (head && head.type === "text") {
    head.value = "[" + head.value;
  } else {
    contents.unshift({ type: "text", value: "[" });
  }
  const tail = contents[contents.length - 1];
  if (tail && tail.type === "text") {
    tail.value += suffix;
  } else {
    contents.push({ type: "text", value: suffix });
  }
  return contents;
}

// node_modules/.pnpm/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/image-reference.js
function imageReference(state, node2) {
  const id = String(node2.identifier).toUpperCase();
  const definition3 = state.definitionById.get(id);
  if (!definition3) {
    return revert(state, node2);
  }
  const properties = { src: normalizeUri(definition3.url || ""), alt: node2.alt };
  if (definition3.title !== null && definition3.title !== void 0) {
    properties.title = definition3.title;
  }
  const result = { type: "element", tagName: "img", properties, children: [] };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// node_modules/.pnpm/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/image.js
function image(state, node2) {
  const properties = { src: normalizeUri(node2.url) };
  if (node2.alt !== null && node2.alt !== void 0) {
    properties.alt = node2.alt;
  }
  if (node2.title !== null && node2.title !== void 0) {
    properties.title = node2.title;
  }
  const result = { type: "element", tagName: "img", properties, children: [] };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// node_modules/.pnpm/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/inline-code.js
function inlineCode(state, node2) {
  const text7 = { type: "text", value: node2.value.replace(/\r?\n|\r/g, " ") };
  state.patch(node2, text7);
  const result = {
    type: "element",
    tagName: "code",
    properties: {},
    children: [text7]
  };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// node_modules/.pnpm/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/link-reference.js
function linkReference(state, node2) {
  const id = String(node2.identifier).toUpperCase();
  const definition3 = state.definitionById.get(id);
  if (!definition3) {
    return revert(state, node2);
  }
  const properties = { href: normalizeUri(definition3.url || "") };
  if (definition3.title !== null && definition3.title !== void 0) {
    properties.title = definition3.title;
  }
  const result = {
    type: "element",
    tagName: "a",
    properties,
    children: state.all(node2)
  };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// node_modules/.pnpm/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/link.js
function link(state, node2) {
  const properties = { href: normalizeUri(node2.url) };
  if (node2.title !== null && node2.title !== void 0) {
    properties.title = node2.title;
  }
  const result = {
    type: "element",
    tagName: "a",
    properties,
    children: state.all(node2)
  };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// node_modules/.pnpm/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/list-item.js
function listItem(state, node2, parent) {
  const results = state.all(node2);
  const loose = parent ? listLoose(parent) : listItemLoose(node2);
  const properties = {};
  const children = [];
  if (typeof node2.checked === "boolean") {
    const head = results[0];
    let paragraph3;
    if (head && head.type === "element" && head.tagName === "p") {
      paragraph3 = head;
    } else {
      paragraph3 = { type: "element", tagName: "p", properties: {}, children: [] };
      results.unshift(paragraph3);
    }
    if (paragraph3.children.length > 0) {
      paragraph3.children.unshift({ type: "text", value: " " });
    }
    paragraph3.children.unshift({
      type: "element",
      tagName: "input",
      properties: { type: "checkbox", checked: node2.checked, disabled: true },
      children: []
    });
    properties.className = ["task-list-item"];
  }
  let index2 = -1;
  while (++index2 < results.length) {
    const child = results[index2];
    if (loose || index2 !== 0 || child.type !== "element" || child.tagName !== "p") {
      children.push({ type: "text", value: "\n" });
    }
    if (child.type === "element" && child.tagName === "p" && !loose) {
      children.push(...child.children);
    } else {
      children.push(child);
    }
  }
  const tail = results[results.length - 1];
  if (tail && (loose || tail.type !== "element" || tail.tagName !== "p")) {
    children.push({ type: "text", value: "\n" });
  }
  const result = { type: "element", tagName: "li", properties, children };
  state.patch(node2, result);
  return state.applyData(node2, result);
}
function listLoose(node2) {
  let loose = false;
  if (node2.type === "list") {
    loose = node2.spread || false;
    const children = node2.children;
    let index2 = -1;
    while (!loose && ++index2 < children.length) {
      loose = listItemLoose(children[index2]);
    }
  }
  return loose;
}
function listItemLoose(node2) {
  const spread = node2.spread;
  return spread === null || spread === void 0 ? node2.children.length > 1 : spread;
}

// node_modules/.pnpm/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/list.js
function list2(state, node2) {
  const properties = {};
  const results = state.all(node2);
  let index2 = -1;
  if (typeof node2.start === "number" && node2.start !== 1) {
    properties.start = node2.start;
  }
  while (++index2 < results.length) {
    const child = results[index2];
    if (child.type === "element" && child.tagName === "li" && child.properties && Array.isArray(child.properties.className) && child.properties.className.includes("task-list-item")) {
      properties.className = ["contains-task-list"];
      break;
    }
  }
  const result = {
    type: "element",
    tagName: node2.ordered ? "ol" : "ul",
    properties,
    children: state.wrap(results, true)
  };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// node_modules/.pnpm/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/paragraph.js
function paragraph(state, node2) {
  const result = {
    type: "element",
    tagName: "p",
    properties: {},
    children: state.all(node2)
  };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// node_modules/.pnpm/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/root.js
function root2(state, node2) {
  const result = { type: "root", children: state.wrap(state.all(node2)) };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// node_modules/.pnpm/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/strong.js
function strong(state, node2) {
  const result = {
    type: "element",
    tagName: "strong",
    properties: {},
    children: state.all(node2)
  };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// node_modules/.pnpm/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/table.js
function table(state, node2) {
  const rows = state.all(node2);
  const firstRow = rows.shift();
  const tableContent = [];
  if (firstRow) {
    const head = {
      type: "element",
      tagName: "thead",
      properties: {},
      children: state.wrap([firstRow], true)
    };
    state.patch(node2.children[0], head);
    tableContent.push(head);
  }
  if (rows.length > 0) {
    const body = {
      type: "element",
      tagName: "tbody",
      properties: {},
      children: state.wrap(rows, true)
    };
    const start2 = pointStart(node2.children[1]);
    const end = pointEnd(node2.children[node2.children.length - 1]);
    if (start2 && end) body.position = { start: start2, end };
    tableContent.push(body);
  }
  const result = {
    type: "element",
    tagName: "table",
    properties: {},
    children: state.wrap(tableContent, true)
  };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// node_modules/.pnpm/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/table-row.js
function tableRow(state, node2, parent) {
  const siblings = parent ? parent.children : void 0;
  const rowIndex = siblings ? siblings.indexOf(node2) : 1;
  const tagName = rowIndex === 0 ? "th" : "td";
  const align = parent && parent.type === "table" ? parent.align : void 0;
  const length = align ? align.length : node2.children.length;
  let cellIndex = -1;
  const cells = [];
  while (++cellIndex < length) {
    const cell = node2.children[cellIndex];
    const properties = {};
    const alignValue = align ? align[cellIndex] : void 0;
    if (alignValue) {
      properties.align = alignValue;
    }
    let result2 = { type: "element", tagName, properties, children: [] };
    if (cell) {
      result2.children = state.all(cell);
      state.patch(cell, result2);
      result2 = state.applyData(cell, result2);
    }
    cells.push(result2);
  }
  const result = {
    type: "element",
    tagName: "tr",
    properties: {},
    children: state.wrap(cells, true)
  };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// node_modules/.pnpm/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/table-cell.js
function tableCell(state, node2) {
  const result = {
    type: "element",
    tagName: "td",
    // Assume body cell.
    properties: {},
    children: state.all(node2)
  };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// node_modules/.pnpm/trim-lines@3.0.1/node_modules/trim-lines/index.js
var tab = 9;
var space = 32;
function trimLines(value) {
  const source = String(value);
  const search2 = /\r?\n|\r/g;
  let match = search2.exec(source);
  let last = 0;
  const lines = [];
  while (match) {
    lines.push(
      trimLine(source.slice(last, match.index), last > 0, true),
      match[0]
    );
    last = match.index + match[0].length;
    match = search2.exec(source);
  }
  lines.push(trimLine(source.slice(last), last > 0, false));
  return lines.join("");
}
function trimLine(value, start2, end) {
  let startIndex = 0;
  let endIndex = value.length;
  if (start2) {
    let code4 = value.codePointAt(startIndex);
    while (code4 === tab || code4 === space) {
      startIndex++;
      code4 = value.codePointAt(startIndex);
    }
  }
  if (end) {
    let code4 = value.codePointAt(endIndex - 1);
    while (code4 === tab || code4 === space) {
      endIndex--;
      code4 = value.codePointAt(endIndex - 1);
    }
  }
  return endIndex > startIndex ? value.slice(startIndex, endIndex) : "";
}

// node_modules/.pnpm/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/text.js
function text4(state, node2) {
  const result = { type: "text", value: trimLines(String(node2.value)) };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// node_modules/.pnpm/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/thematic-break.js
function thematicBreak2(state, node2) {
  const result = {
    type: "element",
    tagName: "hr",
    properties: {},
    children: []
  };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// node_modules/.pnpm/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/index.js
var handlers = {
  blockquote,
  break: hardBreak,
  code,
  delete: strikethrough,
  emphasis,
  footnoteReference,
  heading,
  html: html2,
  imageReference,
  image,
  inlineCode,
  linkReference,
  link,
  listItem,
  list: list2,
  paragraph,
  // @ts-expect-error: root is different, but hard to type.
  root: root2,
  strong,
  table,
  tableCell,
  tableRow,
  text: text4,
  thematicBreak: thematicBreak2,
  toml: ignore,
  yaml: ignore,
  definition: ignore,
  footnoteDefinition: ignore
};
function ignore() {
  return void 0;
}

// node_modules/.pnpm/@ungap+structured-clone@1.3.0/node_modules/@ungap/structured-clone/esm/types.js
var VOID = -1;
var PRIMITIVE = 0;
var ARRAY = 1;
var OBJECT = 2;
var DATE = 3;
var REGEXP = 4;
var MAP = 5;
var SET = 6;
var ERROR = 7;
var BIGINT = 8;

// node_modules/.pnpm/@ungap+structured-clone@1.3.0/node_modules/@ungap/structured-clone/esm/deserialize.js
var env = typeof self === "object" ? self : globalThis;
var deserializer = ($, _) => {
  const as = (out, index2) => {
    $.set(index2, out);
    return out;
  };
  const unpair = (index2) => {
    if ($.has(index2))
      return $.get(index2);
    const [type, value] = _[index2];
    switch (type) {
      case PRIMITIVE:
      case VOID:
        return as(value, index2);
      case ARRAY: {
        const arr = as([], index2);
        for (const index3 of value)
          arr.push(unpair(index3));
        return arr;
      }
      case OBJECT: {
        const object = as({}, index2);
        for (const [key, index3] of value)
          object[unpair(key)] = unpair(index3);
        return object;
      }
      case DATE:
        return as(new Date(value), index2);
      case REGEXP: {
        const { source, flags } = value;
        return as(new RegExp(source, flags), index2);
      }
      case MAP: {
        const map3 = as(/* @__PURE__ */ new Map(), index2);
        for (const [key, index3] of value)
          map3.set(unpair(key), unpair(index3));
        return map3;
      }
      case SET: {
        const set = as(/* @__PURE__ */ new Set(), index2);
        for (const index3 of value)
          set.add(unpair(index3));
        return set;
      }
      case ERROR: {
        const { name: name2, message } = value;
        return as(new env[name2](message), index2);
      }
      case BIGINT:
        return as(BigInt(value), index2);
      case "BigInt":
        return as(Object(BigInt(value)), index2);
      case "ArrayBuffer":
        return as(new Uint8Array(value).buffer, value);
      case "DataView": {
        const { buffer } = new Uint8Array(value);
        return as(new DataView(buffer), value);
      }
    }
    return as(new env[type](value), index2);
  };
  return unpair;
};
var deserialize = (serialized) => deserializer(/* @__PURE__ */ new Map(), serialized)(0);

// node_modules/.pnpm/@ungap+structured-clone@1.3.0/node_modules/@ungap/structured-clone/esm/serialize.js
var EMPTY = "";
var { toString: toString2 } = {};
var { keys } = Object;
var typeOf = (value) => {
  const type = typeof value;
  if (type !== "object" || !value)
    return [PRIMITIVE, type];
  const asString = toString2.call(value).slice(8, -1);
  switch (asString) {
    case "Array":
      return [ARRAY, EMPTY];
    case "Object":
      return [OBJECT, EMPTY];
    case "Date":
      return [DATE, EMPTY];
    case "RegExp":
      return [REGEXP, EMPTY];
    case "Map":
      return [MAP, EMPTY];
    case "Set":
      return [SET, EMPTY];
    case "DataView":
      return [ARRAY, asString];
  }
  if (asString.includes("Array"))
    return [ARRAY, asString];
  if (asString.includes("Error"))
    return [ERROR, asString];
  return [OBJECT, asString];
};
var shouldSkip = ([TYPE, type]) => TYPE === PRIMITIVE && (type === "function" || type === "symbol");
var serializer = (strict, json, $, _) => {
  const as = (out, value) => {
    const index2 = _.push(out) - 1;
    $.set(value, index2);
    return index2;
  };
  const pair = (value) => {
    if ($.has(value))
      return $.get(value);
    let [TYPE, type] = typeOf(value);
    switch (TYPE) {
      case PRIMITIVE: {
        let entry = value;
        switch (type) {
          case "bigint":
            TYPE = BIGINT;
            entry = value.toString();
            break;
          case "function":
          case "symbol":
            if (strict)
              throw new TypeError("unable to serialize " + type);
            entry = null;
            break;
          case "undefined":
            return as([VOID], value);
        }
        return as([TYPE, entry], value);
      }
      case ARRAY: {
        if (type) {
          let spread = value;
          if (type === "DataView") {
            spread = new Uint8Array(value.buffer);
          } else if (type === "ArrayBuffer") {
            spread = new Uint8Array(value);
          }
          return as([type, [...spread]], value);
        }
        const arr = [];
        const index2 = as([TYPE, arr], value);
        for (const entry of value)
          arr.push(pair(entry));
        return index2;
      }
      case OBJECT: {
        if (type) {
          switch (type) {
            case "BigInt":
              return as([type, value.toString()], value);
            case "Boolean":
            case "Number":
            case "String":
              return as([type, value.valueOf()], value);
          }
        }
        if (json && "toJSON" in value)
          return pair(value.toJSON());
        const entries = [];
        const index2 = as([TYPE, entries], value);
        for (const key of keys(value)) {
          if (strict || !shouldSkip(typeOf(value[key])))
            entries.push([pair(key), pair(value[key])]);
        }
        return index2;
      }
      case DATE:
        return as([TYPE, value.toISOString()], value);
      case REGEXP: {
        const { source, flags } = value;
        return as([TYPE, { source, flags }], value);
      }
      case MAP: {
        const entries = [];
        const index2 = as([TYPE, entries], value);
        for (const [key, entry] of value) {
          if (strict || !(shouldSkip(typeOf(key)) || shouldSkip(typeOf(entry))))
            entries.push([pair(key), pair(entry)]);
        }
        return index2;
      }
      case SET: {
        const entries = [];
        const index2 = as([TYPE, entries], value);
        for (const entry of value) {
          if (strict || !shouldSkip(typeOf(entry)))
            entries.push(pair(entry));
        }
        return index2;
      }
    }
    const { message } = value;
    return as([TYPE, { name: type, message }], value);
  };
  return pair;
};
var serialize = (value, { json, lossy } = {}) => {
  const _ = [];
  return serializer(!(json || lossy), !!json, /* @__PURE__ */ new Map(), _)(value), _;
};

// node_modules/.pnpm/@ungap+structured-clone@1.3.0/node_modules/@ungap/structured-clone/esm/index.js
var esm_default = typeof structuredClone === "function" ? (
  /* c8 ignore start */
  (any, options) => options && ("json" in options || "lossy" in options) ? deserialize(serialize(any, options)) : structuredClone(any)
) : (any, options) => deserialize(serialize(any, options));

// node_modules/.pnpm/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/footer.js
function defaultFootnoteBackContent(_, rereferenceIndex) {
  const result = [{ type: "text", value: "\u21A9" }];
  if (rereferenceIndex > 1) {
    result.push({
      type: "element",
      tagName: "sup",
      properties: {},
      children: [{ type: "text", value: String(rereferenceIndex) }]
    });
  }
  return result;
}
function defaultFootnoteBackLabel(referenceIndex, rereferenceIndex) {
  return "Back to reference " + (referenceIndex + 1) + (rereferenceIndex > 1 ? "-" + rereferenceIndex : "");
}
function footer(state) {
  const clobberPrefix = typeof state.options.clobberPrefix === "string" ? state.options.clobberPrefix : "user-content-";
  const footnoteBackContent = state.options.footnoteBackContent || defaultFootnoteBackContent;
  const footnoteBackLabel = state.options.footnoteBackLabel || defaultFootnoteBackLabel;
  const footnoteLabel = state.options.footnoteLabel || "Footnotes";
  const footnoteLabelTagName = state.options.footnoteLabelTagName || "h2";
  const footnoteLabelProperties = state.options.footnoteLabelProperties || {
    className: ["sr-only"]
  };
  const listItems = [];
  let referenceIndex = -1;
  while (++referenceIndex < state.footnoteOrder.length) {
    const definition3 = state.footnoteById.get(
      state.footnoteOrder[referenceIndex]
    );
    if (!definition3) {
      continue;
    }
    const content3 = state.all(definition3);
    const id = String(definition3.identifier).toUpperCase();
    const safeId = normalizeUri(id.toLowerCase());
    let rereferenceIndex = 0;
    const backReferences = [];
    const counts = state.footnoteCounts.get(id);
    while (counts !== void 0 && ++rereferenceIndex <= counts) {
      if (backReferences.length > 0) {
        backReferences.push({ type: "text", value: " " });
      }
      let children = typeof footnoteBackContent === "string" ? footnoteBackContent : footnoteBackContent(referenceIndex, rereferenceIndex);
      if (typeof children === "string") {
        children = { type: "text", value: children };
      }
      backReferences.push({
        type: "element",
        tagName: "a",
        properties: {
          href: "#" + clobberPrefix + "fnref-" + safeId + (rereferenceIndex > 1 ? "-" + rereferenceIndex : ""),
          dataFootnoteBackref: "",
          ariaLabel: typeof footnoteBackLabel === "string" ? footnoteBackLabel : footnoteBackLabel(referenceIndex, rereferenceIndex),
          className: ["data-footnote-backref"]
        },
        children: Array.isArray(children) ? children : [children]
      });
    }
    const tail = content3[content3.length - 1];
    if (tail && tail.type === "element" && tail.tagName === "p") {
      const tailTail = tail.children[tail.children.length - 1];
      if (tailTail && tailTail.type === "text") {
        tailTail.value += " ";
      } else {
        tail.children.push({ type: "text", value: " " });
      }
      tail.children.push(...backReferences);
    } else {
      content3.push(...backReferences);
    }
    const listItem3 = {
      type: "element",
      tagName: "li",
      properties: { id: clobberPrefix + "fn-" + safeId },
      children: state.wrap(content3, true)
    };
    state.patch(definition3, listItem3);
    listItems.push(listItem3);
  }
  if (listItems.length === 0) {
    return;
  }
  return {
    type: "element",
    tagName: "section",
    properties: { dataFootnotes: true, className: ["footnotes"] },
    children: [
      {
        type: "element",
        tagName: footnoteLabelTagName,
        properties: {
          ...esm_default(footnoteLabelProperties),
          id: "footnote-label"
        },
        children: [{ type: "text", value: footnoteLabel }]
      },
      { type: "text", value: "\n" },
      {
        type: "element",
        tagName: "ol",
        properties: {},
        children: state.wrap(listItems, true)
      },
      { type: "text", value: "\n" }
    ]
  };
}

// node_modules/.pnpm/unist-util-is@6.0.1/node_modules/unist-util-is/lib/index.js
var convert = (
  // Note: overloads in JSDoc can’t yet use different `@template`s.
  /**
   * @type {(
   *   (<Condition extends string>(test: Condition) => (node: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node & {type: Condition}) &
   *   (<Condition extends Props>(test: Condition) => (node: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node & Condition) &
   *   (<Condition extends TestFunction>(test: Condition) => (node: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node & Predicate<Condition, Node>) &
   *   ((test?: null | undefined) => (node?: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node) &
   *   ((test?: Test) => Check)
   * )}
   */
  /**
   * @param {Test} [test]
   * @returns {Check}
   */
  function(test) {
    if (test === null || test === void 0) {
      return ok2;
    }
    if (typeof test === "function") {
      return castFactory(test);
    }
    if (typeof test === "object") {
      return Array.isArray(test) ? anyFactory(test) : (
        // Cast because `ReadonlyArray` goes into the above but `isArray`
        // narrows to `Array`.
        propertiesFactory(
          /** @type {Props} */
          test
        )
      );
    }
    if (typeof test === "string") {
      return typeFactory(test);
    }
    throw new Error("Expected function, string, or object as test");
  }
);
function anyFactory(tests) {
  const checks = [];
  let index2 = -1;
  while (++index2 < tests.length) {
    checks[index2] = convert(tests[index2]);
  }
  return castFactory(any);
  function any(...parameters) {
    let index3 = -1;
    while (++index3 < checks.length) {
      if (checks[index3].apply(this, parameters)) return true;
    }
    return false;
  }
}
function propertiesFactory(check) {
  const checkAsRecord = (
    /** @type {Record<string, unknown>} */
    check
  );
  return castFactory(all2);
  function all2(node2) {
    const nodeAsRecord = (
      /** @type {Record<string, unknown>} */
      /** @type {unknown} */
      node2
    );
    let key;
    for (key in check) {
      if (nodeAsRecord[key] !== checkAsRecord[key]) return false;
    }
    return true;
  }
}
function typeFactory(check) {
  return castFactory(type);
  function type(node2) {
    return node2 && node2.type === check;
  }
}
function castFactory(testFunction) {
  return check;
  function check(value, index2, parent) {
    return Boolean(
      looksLikeANode(value) && testFunction.call(
        this,
        value,
        typeof index2 === "number" ? index2 : void 0,
        parent || void 0
      )
    );
  }
}
function ok2() {
  return true;
}
function looksLikeANode(value) {
  return value !== null && typeof value === "object" && "type" in value;
}

// node_modules/.pnpm/unist-util-visit-parents@6.0.2/node_modules/unist-util-visit-parents/lib/color.js
function color(d) {
  return d;
}

// node_modules/.pnpm/unist-util-visit-parents@6.0.2/node_modules/unist-util-visit-parents/lib/index.js
var empty = [];
var CONTINUE = true;
var EXIT = false;
var SKIP = "skip";
function visitParents(tree, test, visitor, reverse) {
  let check;
  if (typeof test === "function" && typeof visitor !== "function") {
    reverse = visitor;
    visitor = test;
  } else {
    check = test;
  }
  const is2 = convert(check);
  const step = reverse ? -1 : 1;
  factory(tree, void 0, [])();
  function factory(node2, index2, parents) {
    const value = (
      /** @type {Record<string, unknown>} */
      node2 && typeof node2 === "object" ? node2 : {}
    );
    if (typeof value.type === "string") {
      const name2 = (
        // `hast`
        typeof value.tagName === "string" ? value.tagName : (
          // `xast`
          typeof value.name === "string" ? value.name : void 0
        )
      );
      Object.defineProperty(visit2, "name", {
        value: "node (" + color(node2.type + (name2 ? "<" + name2 + ">" : "")) + ")"
      });
    }
    return visit2;
    function visit2() {
      let result = empty;
      let subresult;
      let offset;
      let grandparents;
      if (!test || is2(node2, index2, parents[parents.length - 1] || void 0)) {
        result = toResult(visitor(node2, parents));
        if (result[0] === EXIT) {
          return result;
        }
      }
      if ("children" in node2 && node2.children) {
        const nodeAsParent = (
          /** @type {UnistParent} */
          node2
        );
        if (nodeAsParent.children && result[0] !== SKIP) {
          offset = (reverse ? nodeAsParent.children.length : -1) + step;
          grandparents = parents.concat(nodeAsParent);
          while (offset > -1 && offset < nodeAsParent.children.length) {
            const child = nodeAsParent.children[offset];
            subresult = factory(child, offset, grandparents)();
            if (subresult[0] === EXIT) {
              return subresult;
            }
            offset = typeof subresult[1] === "number" ? subresult[1] : offset + step;
          }
        }
      }
      return result;
    }
  }
}
function toResult(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "number") {
    return [CONTINUE, value];
  }
  return value === null || value === void 0 ? empty : [value];
}

// node_modules/.pnpm/unist-util-visit@5.1.0/node_modules/unist-util-visit/lib/index.js
function visit(tree, testOrVisitor, visitorOrReverse, maybeReverse) {
  let reverse;
  let test;
  let visitor;
  if (typeof testOrVisitor === "function" && typeof visitorOrReverse !== "function") {
    test = void 0;
    visitor = testOrVisitor;
    reverse = visitorOrReverse;
  } else {
    test = testOrVisitor;
    visitor = visitorOrReverse;
    reverse = maybeReverse;
  }
  visitParents(tree, test, overload, reverse);
  function overload(node2, parents) {
    const parent = parents[parents.length - 1];
    const index2 = parent ? parent.children.indexOf(node2) : void 0;
    return visitor(node2, index2, parent);
  }
}

// node_modules/.pnpm/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/state.js
var own3 = {}.hasOwnProperty;
var emptyOptions3 = {};
function createState(tree, options) {
  const settings = options || emptyOptions3;
  const definitionById = /* @__PURE__ */ new Map();
  const footnoteById = /* @__PURE__ */ new Map();
  const footnoteCounts = /* @__PURE__ */ new Map();
  const handlers2 = { ...handlers, ...settings.handlers };
  const state = {
    all: all2,
    applyData,
    definitionById,
    footnoteById,
    footnoteCounts,
    footnoteOrder: [],
    handlers: handlers2,
    one: one3,
    options: settings,
    patch,
    wrap
  };
  visit(tree, function(node2) {
    if (node2.type === "definition" || node2.type === "footnoteDefinition") {
      const map3 = node2.type === "definition" ? definitionById : footnoteById;
      const id = String(node2.identifier).toUpperCase();
      if (!map3.has(id)) {
        map3.set(id, node2);
      }
    }
  });
  return state;
  function one3(node2, parent) {
    const type = node2.type;
    const handle2 = state.handlers[type];
    if (own3.call(state.handlers, type) && handle2) {
      return handle2(state, node2, parent);
    }
    if (state.options.passThrough && state.options.passThrough.includes(type)) {
      if ("children" in node2) {
        const { children, ...shallow } = node2;
        const result = esm_default(shallow);
        result.children = state.all(node2);
        return result;
      }
      return esm_default(node2);
    }
    const unknown = state.options.unknownHandler || defaultUnknownHandler;
    return unknown(state, node2, parent);
  }
  function all2(parent) {
    const values = [];
    if ("children" in parent) {
      const nodes = parent.children;
      let index2 = -1;
      while (++index2 < nodes.length) {
        const result = state.one(nodes[index2], parent);
        if (result) {
          if (index2 && nodes[index2 - 1].type === "break") {
            if (!Array.isArray(result) && result.type === "text") {
              result.value = trimMarkdownSpaceStart(result.value);
            }
            if (!Array.isArray(result) && result.type === "element") {
              const head = result.children[0];
              if (head && head.type === "text") {
                head.value = trimMarkdownSpaceStart(head.value);
              }
            }
          }
          if (Array.isArray(result)) {
            values.push(...result);
          } else {
            values.push(result);
          }
        }
      }
    }
    return values;
  }
}
function patch(from, to) {
  if (from.position) to.position = position(from);
}
function applyData(from, to) {
  let result = to;
  if (from && from.data) {
    const hName = from.data.hName;
    const hChildren = from.data.hChildren;
    const hProperties = from.data.hProperties;
    if (typeof hName === "string") {
      if (result.type === "element") {
        result.tagName = hName;
      } else {
        const children = "children" in result ? result.children : [result];
        result = { type: "element", tagName: hName, properties: {}, children };
      }
    }
    if (result.type === "element" && hProperties) {
      Object.assign(result.properties, esm_default(hProperties));
    }
    if ("children" in result && result.children && hChildren !== null && hChildren !== void 0) {
      result.children = hChildren;
    }
  }
  return result;
}
function defaultUnknownHandler(state, node2) {
  const data = node2.data || {};
  const result = "value" in node2 && !(own3.call(data, "hProperties") || own3.call(data, "hChildren")) ? { type: "text", value: node2.value } : {
    type: "element",
    tagName: "div",
    properties: {},
    children: state.all(node2)
  };
  state.patch(node2, result);
  return state.applyData(node2, result);
}
function wrap(nodes, loose) {
  const result = [];
  let index2 = -1;
  if (loose) {
    result.push({ type: "text", value: "\n" });
  }
  while (++index2 < nodes.length) {
    if (index2) result.push({ type: "text", value: "\n" });
    result.push(nodes[index2]);
  }
  if (loose && nodes.length > 0) {
    result.push({ type: "text", value: "\n" });
  }
  return result;
}
function trimMarkdownSpaceStart(value) {
  let index2 = 0;
  let code4 = value.charCodeAt(index2);
  while (code4 === 9 || code4 === 32) {
    index2++;
    code4 = value.charCodeAt(index2);
  }
  return value.slice(index2);
}

// node_modules/.pnpm/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/index.js
function toHast(tree, options) {
  const state = createState(tree, options);
  const node2 = state.one(tree, void 0);
  const foot = footer(state);
  const result = Array.isArray(node2) ? { type: "root", children: node2 } : node2 || { type: "root", children: [] };
  if (foot) {
    ok("children" in result);
    result.children.push({ type: "text", value: "\n" }, foot);
  }
  return result;
}

// node_modules/.pnpm/remark-rehype@11.1.2/node_modules/remark-rehype/lib/index.js
function remarkRehype(destination, options) {
  if (destination && "run" in destination) {
    return async function(tree, file) {
      const hastTree = (
        /** @type {HastRoot} */
        toHast(tree, { file, ...options })
      );
      await destination.run(hastTree, file);
    };
  }
  return function(tree, file) {
    return (
      /** @type {HastRoot} */
      toHast(tree, { file, ...destination || options })
    );
  };
}

// node_modules/.pnpm/bail@2.0.2/node_modules/bail/index.js
function bail(error) {
  if (error) {
    throw error;
  }
}

// node_modules/.pnpm/unified@11.0.5/node_modules/unified/lib/index.js
var import_extend = __toESM(require_extend(), 1);

// node_modules/.pnpm/is-plain-obj@4.1.0/node_modules/is-plain-obj/index.js
function isPlainObject(value) {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return (prototype === null || prototype === Object.prototype || Object.getPrototypeOf(prototype) === null) && !(Symbol.toStringTag in value) && !(Symbol.iterator in value);
}

// node_modules/.pnpm/trough@2.2.0/node_modules/trough/lib/index.js
function trough() {
  const fns = [];
  const pipeline = { run, use };
  return pipeline;
  function run(...values) {
    let middlewareIndex = -1;
    const callback = values.pop();
    if (typeof callback !== "function") {
      throw new TypeError("Expected function as last argument, not " + callback);
    }
    next(null, ...values);
    function next(error, ...output) {
      const fn = fns[++middlewareIndex];
      let index2 = -1;
      if (error) {
        callback(error);
        return;
      }
      while (++index2 < values.length) {
        if (output[index2] === null || output[index2] === void 0) {
          output[index2] = values[index2];
        }
      }
      values = output;
      if (fn) {
        wrap2(fn, next)(...output);
      } else {
        callback(null, ...output);
      }
    }
  }
  function use(middelware) {
    if (typeof middelware !== "function") {
      throw new TypeError(
        "Expected `middelware` to be a function, not " + middelware
      );
    }
    fns.push(middelware);
    return pipeline;
  }
}
function wrap2(middleware, callback) {
  let called;
  return wrapped;
  function wrapped(...parameters) {
    const fnExpectsCallback = middleware.length > parameters.length;
    let result;
    if (fnExpectsCallback) {
      parameters.push(done);
    }
    try {
      result = middleware.apply(this, parameters);
    } catch (error) {
      const exception = (
        /** @type {Error} */
        error
      );
      if (fnExpectsCallback && called) {
        throw exception;
      }
      return done(exception);
    }
    if (!fnExpectsCallback) {
      if (result && result.then && typeof result.then === "function") {
        result.then(then, done);
      } else if (result instanceof Error) {
        done(result);
      } else {
        then(result);
      }
    }
  }
  function done(error, ...output) {
    if (!called) {
      called = true;
      callback(error, ...output);
    }
  }
  function then(value) {
    done(null, value);
  }
}

// node_modules/.pnpm/vfile@6.0.3/node_modules/vfile/lib/minpath.browser.js
var minpath = { basename, dirname, extname, join, sep: "/" };
function basename(path2, extname2) {
  if (extname2 !== void 0 && typeof extname2 !== "string") {
    throw new TypeError('"ext" argument must be a string');
  }
  assertPath(path2);
  let start2 = 0;
  let end = -1;
  let index2 = path2.length;
  let seenNonSlash;
  if (extname2 === void 0 || extname2.length === 0 || extname2.length > path2.length) {
    while (index2--) {
      if (path2.codePointAt(index2) === 47) {
        if (seenNonSlash) {
          start2 = index2 + 1;
          break;
        }
      } else if (end < 0) {
        seenNonSlash = true;
        end = index2 + 1;
      }
    }
    return end < 0 ? "" : path2.slice(start2, end);
  }
  if (extname2 === path2) {
    return "";
  }
  let firstNonSlashEnd = -1;
  let extnameIndex = extname2.length - 1;
  while (index2--) {
    if (path2.codePointAt(index2) === 47) {
      if (seenNonSlash) {
        start2 = index2 + 1;
        break;
      }
    } else {
      if (firstNonSlashEnd < 0) {
        seenNonSlash = true;
        firstNonSlashEnd = index2 + 1;
      }
      if (extnameIndex > -1) {
        if (path2.codePointAt(index2) === extname2.codePointAt(extnameIndex--)) {
          if (extnameIndex < 0) {
            end = index2;
          }
        } else {
          extnameIndex = -1;
          end = firstNonSlashEnd;
        }
      }
    }
  }
  if (start2 === end) {
    end = firstNonSlashEnd;
  } else if (end < 0) {
    end = path2.length;
  }
  return path2.slice(start2, end);
}
function dirname(path2) {
  assertPath(path2);
  if (path2.length === 0) {
    return ".";
  }
  let end = -1;
  let index2 = path2.length;
  let unmatchedSlash;
  while (--index2) {
    if (path2.codePointAt(index2) === 47) {
      if (unmatchedSlash) {
        end = index2;
        break;
      }
    } else if (!unmatchedSlash) {
      unmatchedSlash = true;
    }
  }
  return end < 0 ? path2.codePointAt(0) === 47 ? "/" : "." : end === 1 && path2.codePointAt(0) === 47 ? "//" : path2.slice(0, end);
}
function extname(path2) {
  assertPath(path2);
  let index2 = path2.length;
  let end = -1;
  let startPart = 0;
  let startDot = -1;
  let preDotState = 0;
  let unmatchedSlash;
  while (index2--) {
    const code4 = path2.codePointAt(index2);
    if (code4 === 47) {
      if (unmatchedSlash) {
        startPart = index2 + 1;
        break;
      }
      continue;
    }
    if (end < 0) {
      unmatchedSlash = true;
      end = index2 + 1;
    }
    if (code4 === 46) {
      if (startDot < 0) {
        startDot = index2;
      } else if (preDotState !== 1) {
        preDotState = 1;
      }
    } else if (startDot > -1) {
      preDotState = -1;
    }
  }
  if (startDot < 0 || end < 0 || // We saw a non-dot character immediately before the dot.
  preDotState === 0 || // The (right-most) trimmed path component is exactly `..`.
  preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
    return "";
  }
  return path2.slice(startDot, end);
}
function join(...segments) {
  let index2 = -1;
  let joined;
  while (++index2 < segments.length) {
    assertPath(segments[index2]);
    if (segments[index2]) {
      joined = joined === void 0 ? segments[index2] : joined + "/" + segments[index2];
    }
  }
  return joined === void 0 ? "." : normalize(joined);
}
function normalize(path2) {
  assertPath(path2);
  const absolute = path2.codePointAt(0) === 47;
  let value = normalizeString(path2, !absolute);
  if (value.length === 0 && !absolute) {
    value = ".";
  }
  if (value.length > 0 && path2.codePointAt(path2.length - 1) === 47) {
    value += "/";
  }
  return absolute ? "/" + value : value;
}
function normalizeString(path2, allowAboveRoot) {
  let result = "";
  let lastSegmentLength = 0;
  let lastSlash = -1;
  let dots = 0;
  let index2 = -1;
  let code4;
  let lastSlashIndex;
  while (++index2 <= path2.length) {
    if (index2 < path2.length) {
      code4 = path2.codePointAt(index2);
    } else if (code4 === 47) {
      break;
    } else {
      code4 = 47;
    }
    if (code4 === 47) {
      if (lastSlash === index2 - 1 || dots === 1) {
      } else if (lastSlash !== index2 - 1 && dots === 2) {
        if (result.length < 2 || lastSegmentLength !== 2 || result.codePointAt(result.length - 1) !== 46 || result.codePointAt(result.length - 2) !== 46) {
          if (result.length > 2) {
            lastSlashIndex = result.lastIndexOf("/");
            if (lastSlashIndex !== result.length - 1) {
              if (lastSlashIndex < 0) {
                result = "";
                lastSegmentLength = 0;
              } else {
                result = result.slice(0, lastSlashIndex);
                lastSegmentLength = result.length - 1 - result.lastIndexOf("/");
              }
              lastSlash = index2;
              dots = 0;
              continue;
            }
          } else if (result.length > 0) {
            result = "";
            lastSegmentLength = 0;
            lastSlash = index2;
            dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          result = result.length > 0 ? result + "/.." : "..";
          lastSegmentLength = 2;
        }
      } else {
        if (result.length > 0) {
          result += "/" + path2.slice(lastSlash + 1, index2);
        } else {
          result = path2.slice(lastSlash + 1, index2);
        }
        lastSegmentLength = index2 - lastSlash - 1;
      }
      lastSlash = index2;
      dots = 0;
    } else if (code4 === 46 && dots > -1) {
      dots++;
    } else {
      dots = -1;
    }
  }
  return result;
}
function assertPath(path2) {
  if (typeof path2 !== "string") {
    throw new TypeError(
      "Path must be a string. Received " + JSON.stringify(path2)
    );
  }
}

// node_modules/.pnpm/vfile@6.0.3/node_modules/vfile/lib/minproc.browser.js
var minproc = { cwd };
function cwd() {
  return "/";
}

// node_modules/.pnpm/vfile@6.0.3/node_modules/vfile/lib/minurl.shared.js
function isUrl(fileUrlOrPath) {
  return Boolean(
    fileUrlOrPath !== null && typeof fileUrlOrPath === "object" && "href" in fileUrlOrPath && fileUrlOrPath.href && "protocol" in fileUrlOrPath && fileUrlOrPath.protocol && // @ts-expect-error: indexing is fine.
    fileUrlOrPath.auth === void 0
  );
}

// node_modules/.pnpm/vfile@6.0.3/node_modules/vfile/lib/minurl.browser.js
function urlToPath(path2) {
  if (typeof path2 === "string") {
    path2 = new URL(path2);
  } else if (!isUrl(path2)) {
    const error = new TypeError(
      'The "path" argument must be of type string or an instance of URL. Received `' + path2 + "`"
    );
    error.code = "ERR_INVALID_ARG_TYPE";
    throw error;
  }
  if (path2.protocol !== "file:") {
    const error = new TypeError("The URL must be of scheme file");
    error.code = "ERR_INVALID_URL_SCHEME";
    throw error;
  }
  return getPathFromURLPosix(path2);
}
function getPathFromURLPosix(url) {
  if (url.hostname !== "") {
    const error = new TypeError(
      'File URL host must be "localhost" or empty on darwin'
    );
    error.code = "ERR_INVALID_FILE_URL_HOST";
    throw error;
  }
  const pathname = url.pathname;
  let index2 = -1;
  while (++index2 < pathname.length) {
    if (pathname.codePointAt(index2) === 37 && pathname.codePointAt(index2 + 1) === 50) {
      const third = pathname.codePointAt(index2 + 2);
      if (third === 70 || third === 102) {
        const error = new TypeError(
          "File URL path must not include encoded / characters"
        );
        error.code = "ERR_INVALID_FILE_URL_PATH";
        throw error;
      }
    }
  }
  return decodeURIComponent(pathname);
}

// node_modules/.pnpm/vfile@6.0.3/node_modules/vfile/lib/index.js
var order = (
  /** @type {const} */
  [
    "history",
    "path",
    "basename",
    "stem",
    "extname",
    "dirname"
  ]
);
var VFile = class {
  /**
   * Create a new virtual file.
   *
   * `options` is treated as:
   *
   * *   `string` or `Uint8Array` — `{value: options}`
   * *   `URL` — `{path: options}`
   * *   `VFile` — shallow copies its data over to the new file
   * *   `object` — all fields are shallow copied over to the new file
   *
   * Path related fields are set in the following order (least specific to
   * most specific): `history`, `path`, `basename`, `stem`, `extname`,
   * `dirname`.
   *
   * You cannot set `dirname` or `extname` without setting either `history`,
   * `path`, `basename`, or `stem` too.
   *
   * @param {Compatible | null | undefined} [value]
   *   File value.
   * @returns
   *   New instance.
   */
  constructor(value) {
    let options;
    if (!value) {
      options = {};
    } else if (isUrl(value)) {
      options = { path: value };
    } else if (typeof value === "string" || isUint8Array(value)) {
      options = { value };
    } else {
      options = value;
    }
    this.cwd = "cwd" in options ? "" : minproc.cwd();
    this.data = {};
    this.history = [];
    this.messages = [];
    this.value;
    this.map;
    this.result;
    this.stored;
    let index2 = -1;
    while (++index2 < order.length) {
      const field2 = order[index2];
      if (field2 in options && options[field2] !== void 0 && options[field2] !== null) {
        this[field2] = field2 === "history" ? [...options[field2]] : options[field2];
      }
    }
    let field;
    for (field in options) {
      if (!order.includes(field)) {
        this[field] = options[field];
      }
    }
  }
  /**
   * Get the basename (including extname) (example: `'index.min.js'`).
   *
   * @returns {string | undefined}
   *   Basename.
   */
  get basename() {
    return typeof this.path === "string" ? minpath.basename(this.path) : void 0;
  }
  /**
   * Set basename (including extname) (`'index.min.js'`).
   *
   * Cannot contain path separators (`'/'` on unix, macOS, and browsers, `'\'`
   * on windows).
   * Cannot be nullified (use `file.path = file.dirname` instead).
   *
   * @param {string} basename
   *   Basename.
   * @returns {undefined}
   *   Nothing.
   */
  set basename(basename2) {
    assertNonEmpty(basename2, "basename");
    assertPart(basename2, "basename");
    this.path = minpath.join(this.dirname || "", basename2);
  }
  /**
   * Get the parent path (example: `'~'`).
   *
   * @returns {string | undefined}
   *   Dirname.
   */
  get dirname() {
    return typeof this.path === "string" ? minpath.dirname(this.path) : void 0;
  }
  /**
   * Set the parent path (example: `'~'`).
   *
   * Cannot be set if there’s no `path` yet.
   *
   * @param {string | undefined} dirname
   *   Dirname.
   * @returns {undefined}
   *   Nothing.
   */
  set dirname(dirname2) {
    assertPath2(this.basename, "dirname");
    this.path = minpath.join(dirname2 || "", this.basename);
  }
  /**
   * Get the extname (including dot) (example: `'.js'`).
   *
   * @returns {string | undefined}
   *   Extname.
   */
  get extname() {
    return typeof this.path === "string" ? minpath.extname(this.path) : void 0;
  }
  /**
   * Set the extname (including dot) (example: `'.js'`).
   *
   * Cannot contain path separators (`'/'` on unix, macOS, and browsers, `'\'`
   * on windows).
   * Cannot be set if there’s no `path` yet.
   *
   * @param {string | undefined} extname
   *   Extname.
   * @returns {undefined}
   *   Nothing.
   */
  set extname(extname2) {
    assertPart(extname2, "extname");
    assertPath2(this.dirname, "extname");
    if (extname2) {
      if (extname2.codePointAt(0) !== 46) {
        throw new Error("`extname` must start with `.`");
      }
      if (extname2.includes(".", 1)) {
        throw new Error("`extname` cannot contain multiple dots");
      }
    }
    this.path = minpath.join(this.dirname, this.stem + (extname2 || ""));
  }
  /**
   * Get the full path (example: `'~/index.min.js'`).
   *
   * @returns {string}
   *   Path.
   */
  get path() {
    return this.history[this.history.length - 1];
  }
  /**
   * Set the full path (example: `'~/index.min.js'`).
   *
   * Cannot be nullified.
   * You can set a file URL (a `URL` object with a `file:` protocol) which will
   * be turned into a path with `url.fileURLToPath`.
   *
   * @param {URL | string} path
   *   Path.
   * @returns {undefined}
   *   Nothing.
   */
  set path(path2) {
    if (isUrl(path2)) {
      path2 = urlToPath(path2);
    }
    assertNonEmpty(path2, "path");
    if (this.path !== path2) {
      this.history.push(path2);
    }
  }
  /**
   * Get the stem (basename w/o extname) (example: `'index.min'`).
   *
   * @returns {string | undefined}
   *   Stem.
   */
  get stem() {
    return typeof this.path === "string" ? minpath.basename(this.path, this.extname) : void 0;
  }
  /**
   * Set the stem (basename w/o extname) (example: `'index.min'`).
   *
   * Cannot contain path separators (`'/'` on unix, macOS, and browsers, `'\'`
   * on windows).
   * Cannot be nullified (use `file.path = file.dirname` instead).
   *
   * @param {string} stem
   *   Stem.
   * @returns {undefined}
   *   Nothing.
   */
  set stem(stem) {
    assertNonEmpty(stem, "stem");
    assertPart(stem, "stem");
    this.path = minpath.join(this.dirname || "", stem + (this.extname || ""));
  }
  // Normal prototypal methods.
  /**
   * Create a fatal message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `true` (error; file not usable)
   * and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {never}
   *   Never.
   * @throws {VFileMessage}
   *   Message.
   */
  fail(causeOrReason, optionsOrParentOrPlace, origin) {
    const message = this.message(causeOrReason, optionsOrParentOrPlace, origin);
    message.fatal = true;
    throw message;
  }
  /**
   * Create an info message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `undefined` (info; change
   * likely not needed) and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {VFileMessage}
   *   Message.
   */
  info(causeOrReason, optionsOrParentOrPlace, origin) {
    const message = this.message(causeOrReason, optionsOrParentOrPlace, origin);
    message.fatal = void 0;
    return message;
  }
  /**
   * Create a message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `false` (warning; change may be
   * needed) and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {VFileMessage}
   *   Message.
   */
  message(causeOrReason, optionsOrParentOrPlace, origin) {
    const message = new VFileMessage(
      // @ts-expect-error: the overloads are fine.
      causeOrReason,
      optionsOrParentOrPlace,
      origin
    );
    if (this.path) {
      message.name = this.path + ":" + message.name;
      message.file = this.path;
    }
    message.fatal = false;
    this.messages.push(message);
    return message;
  }
  /**
   * Serialize the file.
   *
   * > **Note**: which encodings are supported depends on the engine.
   * > For info on Node.js, see:
   * > <https://nodejs.org/api/util.html#whatwg-supported-encodings>.
   *
   * @param {string | null | undefined} [encoding='utf8']
   *   Character encoding to understand `value` as when it’s a `Uint8Array`
   *   (default: `'utf-8'`).
   * @returns {string}
   *   Serialized file.
   */
  toString(encoding) {
    if (this.value === void 0) {
      return "";
    }
    if (typeof this.value === "string") {
      return this.value;
    }
    const decoder = new TextDecoder(encoding || void 0);
    return decoder.decode(this.value);
  }
};
function assertPart(part, name2) {
  if (part && part.includes(minpath.sep)) {
    throw new Error(
      "`" + name2 + "` cannot be a path: did not expect `" + minpath.sep + "`"
    );
  }
}
function assertNonEmpty(part, name2) {
  if (!part) {
    throw new Error("`" + name2 + "` cannot be empty");
  }
}
function assertPath2(path2, name2) {
  if (!path2) {
    throw new Error("Setting `" + name2 + "` requires `path` to be set too");
  }
}
function isUint8Array(value) {
  return Boolean(
    value && typeof value === "object" && "byteLength" in value && "byteOffset" in value
  );
}

// node_modules/.pnpm/unified@11.0.5/node_modules/unified/lib/callable-instance.js
var CallableInstance = (
  /**
   * @type {new <Parameters extends Array<unknown>, Result>(property: string | symbol) => (...parameters: Parameters) => Result}
   */
  /** @type {unknown} */
  /**
   * @this {Function}
   * @param {string | symbol} property
   * @returns {(...parameters: Array<unknown>) => unknown}
   */
  function(property) {
    const self2 = this;
    const constr = self2.constructor;
    const proto = (
      /** @type {Record<string | symbol, Function>} */
      // Prototypes do exist.
      // type-coverage:ignore-next-line
      constr.prototype
    );
    const value = proto[property];
    const apply = function() {
      return value.apply(apply, arguments);
    };
    Object.setPrototypeOf(apply, proto);
    return apply;
  }
);

// node_modules/.pnpm/unified@11.0.5/node_modules/unified/lib/index.js
var own4 = {}.hasOwnProperty;
var Processor = class _Processor extends CallableInstance {
  /**
   * Create a processor.
   */
  constructor() {
    super("copy");
    this.Compiler = void 0;
    this.Parser = void 0;
    this.attachers = [];
    this.compiler = void 0;
    this.freezeIndex = -1;
    this.frozen = void 0;
    this.namespace = {};
    this.parser = void 0;
    this.transformers = trough();
  }
  /**
   * Copy a processor.
   *
   * @deprecated
   *   This is a private internal method and should not be used.
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *   New *unfrozen* processor ({@linkcode Processor}) that is
   *   configured to work the same as its ancestor.
   *   When the descendant processor is configured in the future it does not
   *   affect the ancestral processor.
   */
  copy() {
    const destination = (
      /** @type {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>} */
      new _Processor()
    );
    let index2 = -1;
    while (++index2 < this.attachers.length) {
      const attacher = this.attachers[index2];
      destination.use(...attacher);
    }
    destination.data((0, import_extend.default)(true, {}, this.namespace));
    return destination;
  }
  /**
   * Configure the processor with info available to all plugins.
   * Information is stored in an object.
   *
   * Typically, options can be given to a specific plugin, but sometimes it
   * makes sense to have information shared with several plugins.
   * For example, a list of HTML elements that are self-closing, which is
   * needed during all phases.
   *
   * > **Note**: setting information cannot occur on *frozen* processors.
   * > Call the processor first to create a new unfrozen processor.
   *
   * > **Note**: to register custom data in TypeScript, augment the
   * > {@linkcode Data} interface.
   *
   * @example
   *   This example show how to get and set info:
   *
   *   ```js
   *   import {unified} from 'unified'
   *
   *   const processor = unified().data('alpha', 'bravo')
   *
   *   processor.data('alpha') // => 'bravo'
   *
   *   processor.data() // => {alpha: 'bravo'}
   *
   *   processor.data({charlie: 'delta'})
   *
   *   processor.data() // => {charlie: 'delta'}
   *   ```
   *
   * @template {keyof Data} Key
   *
   * @overload
   * @returns {Data}
   *
   * @overload
   * @param {Data} dataset
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @overload
   * @param {Key} key
   * @returns {Data[Key]}
   *
   * @overload
   * @param {Key} key
   * @param {Data[Key]} value
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @param {Data | Key} [key]
   *   Key to get or set, or entire dataset to set, or nothing to get the
   *   entire dataset (optional).
   * @param {Data[Key]} [value]
   *   Value to set (optional).
   * @returns {unknown}
   *   The current processor when setting, the value at `key` when getting, or
   *   the entire dataset when getting without key.
   */
  data(key, value) {
    if (typeof key === "string") {
      if (arguments.length === 2) {
        assertUnfrozen("data", this.frozen);
        this.namespace[key] = value;
        return this;
      }
      return own4.call(this.namespace, key) && this.namespace[key] || void 0;
    }
    if (key) {
      assertUnfrozen("data", this.frozen);
      this.namespace = key;
      return this;
    }
    return this.namespace;
  }
  /**
   * Freeze a processor.
   *
   * Frozen processors are meant to be extended and not to be configured
   * directly.
   *
   * When a processor is frozen it cannot be unfrozen.
   * New processors working the same way can be created by calling the
   * processor.
   *
   * It’s possible to freeze processors explicitly by calling `.freeze()`.
   * Processors freeze automatically when `.parse()`, `.run()`, `.runSync()`,
   * `.stringify()`, `.process()`, or `.processSync()` are called.
   *
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *   The current processor.
   */
  freeze() {
    if (this.frozen) {
      return this;
    }
    const self2 = (
      /** @type {Processor} */
      /** @type {unknown} */
      this
    );
    while (++this.freezeIndex < this.attachers.length) {
      const [attacher, ...options] = this.attachers[this.freezeIndex];
      if (options[0] === false) {
        continue;
      }
      if (options[0] === true) {
        options[0] = void 0;
      }
      const transformer = attacher.call(self2, ...options);
      if (typeof transformer === "function") {
        this.transformers.use(transformer);
      }
    }
    this.frozen = true;
    this.freezeIndex = Number.POSITIVE_INFINITY;
    return this;
  }
  /**
   * Parse text to a syntax tree.
   *
   * > **Note**: `parse` freezes the processor if not already *frozen*.
   *
   * > **Note**: `parse` performs the parse phase, not the run phase or other
   * > phases.
   *
   * @param {Compatible | undefined} [file]
   *   file to parse (optional); typically `string` or `VFile`; any value
   *   accepted as `x` in `new VFile(x)`.
   * @returns {ParseTree extends undefined ? Node : ParseTree}
   *   Syntax tree representing `file`.
   */
  parse(file) {
    this.freeze();
    const realFile = vfile(file);
    const parser = this.parser || this.Parser;
    assertParser("parse", parser);
    return parser(String(realFile), realFile);
  }
  /**
   * Process the given file as configured on the processor.
   *
   * > **Note**: `process` freezes the processor if not already *frozen*.
   *
   * > **Note**: `process` performs the parse, run, and stringify phases.
   *
   * @overload
   * @param {Compatible | undefined} file
   * @param {ProcessCallback<VFileWithOutput<CompileResult>>} done
   * @returns {undefined}
   *
   * @overload
   * @param {Compatible | undefined} [file]
   * @returns {Promise<VFileWithOutput<CompileResult>>}
   *
   * @param {Compatible | undefined} [file]
   *   File (optional); typically `string` or `VFile`]; any value accepted as
   *   `x` in `new VFile(x)`.
   * @param {ProcessCallback<VFileWithOutput<CompileResult>> | undefined} [done]
   *   Callback (optional).
   * @returns {Promise<VFile> | undefined}
   *   Nothing if `done` is given.
   *   Otherwise a promise, rejected with a fatal error or resolved with the
   *   processed file.
   *
   *   The parsed, transformed, and compiled value is available at
   *   `file.value` (see note).
   *
   *   > **Note**: unified typically compiles by serializing: most
   *   > compilers return `string` (or `Uint8Array`).
   *   > Some compilers, such as the one configured with
   *   > [`rehype-react`][rehype-react], return other values (in this case, a
   *   > React tree).
   *   > If you’re using a compiler that doesn’t serialize, expect different
   *   > result values.
   *   >
   *   > To register custom results in TypeScript, add them to
   *   > {@linkcode CompileResultMap}.
   *
   *   [rehype-react]: https://github.com/rehypejs/rehype-react
   */
  process(file, done) {
    const self2 = this;
    this.freeze();
    assertParser("process", this.parser || this.Parser);
    assertCompiler("process", this.compiler || this.Compiler);
    return done ? executor(void 0, done) : new Promise(executor);
    function executor(resolve, reject) {
      const realFile = vfile(file);
      const parseTree = (
        /** @type {HeadTree extends undefined ? Node : HeadTree} */
        /** @type {unknown} */
        self2.parse(realFile)
      );
      self2.run(parseTree, realFile, function(error, tree, file2) {
        if (error || !tree || !file2) {
          return realDone(error);
        }
        const compileTree = (
          /** @type {CompileTree extends undefined ? Node : CompileTree} */
          /** @type {unknown} */
          tree
        );
        const compileResult = self2.stringify(compileTree, file2);
        if (looksLikeAValue(compileResult)) {
          file2.value = compileResult;
        } else {
          file2.result = compileResult;
        }
        realDone(
          error,
          /** @type {VFileWithOutput<CompileResult>} */
          file2
        );
      });
      function realDone(error, file2) {
        if (error || !file2) {
          reject(error);
        } else if (resolve) {
          resolve(file2);
        } else {
          ok(done, "`done` is defined if `resolve` is not");
          done(void 0, file2);
        }
      }
    }
  }
  /**
   * Process the given file as configured on the processor.
   *
   * An error is thrown if asynchronous transforms are configured.
   *
   * > **Note**: `processSync` freezes the processor if not already *frozen*.
   *
   * > **Note**: `processSync` performs the parse, run, and stringify phases.
   *
   * @param {Compatible | undefined} [file]
   *   File (optional); typically `string` or `VFile`; any value accepted as
   *   `x` in `new VFile(x)`.
   * @returns {VFileWithOutput<CompileResult>}
   *   The processed file.
   *
   *   The parsed, transformed, and compiled value is available at
   *   `file.value` (see note).
   *
   *   > **Note**: unified typically compiles by serializing: most
   *   > compilers return `string` (or `Uint8Array`).
   *   > Some compilers, such as the one configured with
   *   > [`rehype-react`][rehype-react], return other values (in this case, a
   *   > React tree).
   *   > If you’re using a compiler that doesn’t serialize, expect different
   *   > result values.
   *   >
   *   > To register custom results in TypeScript, add them to
   *   > {@linkcode CompileResultMap}.
   *
   *   [rehype-react]: https://github.com/rehypejs/rehype-react
   */
  processSync(file) {
    let complete = false;
    let result;
    this.freeze();
    assertParser("processSync", this.parser || this.Parser);
    assertCompiler("processSync", this.compiler || this.Compiler);
    this.process(file, realDone);
    assertDone("processSync", "process", complete);
    ok(result, "we either bailed on an error or have a tree");
    return result;
    function realDone(error, file2) {
      complete = true;
      bail(error);
      result = file2;
    }
  }
  /**
   * Run *transformers* on a syntax tree.
   *
   * > **Note**: `run` freezes the processor if not already *frozen*.
   *
   * > **Note**: `run` performs the run phase, not other phases.
   *
   * @overload
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   * @param {RunCallback<TailTree extends undefined ? Node : TailTree>} done
   * @returns {undefined}
   *
   * @overload
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   * @param {Compatible | undefined} file
   * @param {RunCallback<TailTree extends undefined ? Node : TailTree>} done
   * @returns {undefined}
   *
   * @overload
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   * @param {Compatible | undefined} [file]
   * @returns {Promise<TailTree extends undefined ? Node : TailTree>}
   *
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   *   Tree to transform and inspect.
   * @param {(
   *   RunCallback<TailTree extends undefined ? Node : TailTree> |
   *   Compatible
   * )} [file]
   *   File associated with `node` (optional); any value accepted as `x` in
   *   `new VFile(x)`.
   * @param {RunCallback<TailTree extends undefined ? Node : TailTree>} [done]
   *   Callback (optional).
   * @returns {Promise<TailTree extends undefined ? Node : TailTree> | undefined}
   *   Nothing if `done` is given.
   *   Otherwise, a promise rejected with a fatal error or resolved with the
   *   transformed tree.
   */
  run(tree, file, done) {
    assertNode(tree);
    this.freeze();
    const transformers = this.transformers;
    if (!done && typeof file === "function") {
      done = file;
      file = void 0;
    }
    return done ? executor(void 0, done) : new Promise(executor);
    function executor(resolve, reject) {
      ok(
        typeof file !== "function",
        "`file` can\u2019t be a `done` anymore, we checked"
      );
      const realFile = vfile(file);
      transformers.run(tree, realFile, realDone);
      function realDone(error, outputTree, file2) {
        const resultingTree = (
          /** @type {TailTree extends undefined ? Node : TailTree} */
          outputTree || tree
        );
        if (error) {
          reject(error);
        } else if (resolve) {
          resolve(resultingTree);
        } else {
          ok(done, "`done` is defined if `resolve` is not");
          done(void 0, resultingTree, file2);
        }
      }
    }
  }
  /**
   * Run *transformers* on a syntax tree.
   *
   * An error is thrown if asynchronous transforms are configured.
   *
   * > **Note**: `runSync` freezes the processor if not already *frozen*.
   *
   * > **Note**: `runSync` performs the run phase, not other phases.
   *
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   *   Tree to transform and inspect.
   * @param {Compatible | undefined} [file]
   *   File associated with `node` (optional); any value accepted as `x` in
   *   `new VFile(x)`.
   * @returns {TailTree extends undefined ? Node : TailTree}
   *   Transformed tree.
   */
  runSync(tree, file) {
    let complete = false;
    let result;
    this.run(tree, file, realDone);
    assertDone("runSync", "run", complete);
    ok(result, "we either bailed on an error or have a tree");
    return result;
    function realDone(error, tree2) {
      bail(error);
      result = tree2;
      complete = true;
    }
  }
  /**
   * Compile a syntax tree.
   *
   * > **Note**: `stringify` freezes the processor if not already *frozen*.
   *
   * > **Note**: `stringify` performs the stringify phase, not the run phase
   * > or other phases.
   *
   * @param {CompileTree extends undefined ? Node : CompileTree} tree
   *   Tree to compile.
   * @param {Compatible | undefined} [file]
   *   File associated with `node` (optional); any value accepted as `x` in
   *   `new VFile(x)`.
   * @returns {CompileResult extends undefined ? Value : CompileResult}
   *   Textual representation of the tree (see note).
   *
   *   > **Note**: unified typically compiles by serializing: most compilers
   *   > return `string` (or `Uint8Array`).
   *   > Some compilers, such as the one configured with
   *   > [`rehype-react`][rehype-react], return other values (in this case, a
   *   > React tree).
   *   > If you’re using a compiler that doesn’t serialize, expect different
   *   > result values.
   *   >
   *   > To register custom results in TypeScript, add them to
   *   > {@linkcode CompileResultMap}.
   *
   *   [rehype-react]: https://github.com/rehypejs/rehype-react
   */
  stringify(tree, file) {
    this.freeze();
    const realFile = vfile(file);
    const compiler2 = this.compiler || this.Compiler;
    assertCompiler("stringify", compiler2);
    assertNode(tree);
    return compiler2(tree, realFile);
  }
  /**
   * Configure the processor to use a plugin, a list of usable values, or a
   * preset.
   *
   * If the processor is already using a plugin, the previous plugin
   * configuration is changed based on the options that are passed in.
   * In other words, the plugin is not added a second time.
   *
   * > **Note**: `use` cannot be called on *frozen* processors.
   * > Call the processor first to create a new unfrozen processor.
   *
   * @example
   *   There are many ways to pass plugins to `.use()`.
   *   This example gives an overview:
   *
   *   ```js
   *   import {unified} from 'unified'
   *
   *   unified()
   *     // Plugin with options:
   *     .use(pluginA, {x: true, y: true})
   *     // Passing the same plugin again merges configuration (to `{x: true, y: false, z: true}`):
   *     .use(pluginA, {y: false, z: true})
   *     // Plugins:
   *     .use([pluginB, pluginC])
   *     // Two plugins, the second with options:
   *     .use([pluginD, [pluginE, {}]])
   *     // Preset with plugins and settings:
   *     .use({plugins: [pluginF, [pluginG, {}]], settings: {position: false}})
   *     // Settings only:
   *     .use({settings: {position: false}})
   *   ```
   *
   * @template {Array<unknown>} [Parameters=[]]
   * @template {Node | string | undefined} [Input=undefined]
   * @template [Output=Input]
   *
   * @overload
   * @param {Preset | null | undefined} [preset]
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @overload
   * @param {PluggableList} list
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @overload
   * @param {Plugin<Parameters, Input, Output>} plugin
   * @param {...(Parameters | [boolean])} parameters
   * @returns {UsePlugin<ParseTree, HeadTree, TailTree, CompileTree, CompileResult, Input, Output>}
   *
   * @param {PluggableList | Plugin | Preset | null | undefined} value
   *   Usable value.
   * @param {...unknown} parameters
   *   Parameters, when a plugin is given as a usable value.
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *   Current processor.
   */
  use(value, ...parameters) {
    const attachers = this.attachers;
    const namespace = this.namespace;
    assertUnfrozen("use", this.frozen);
    if (value === null || value === void 0) {
    } else if (typeof value === "function") {
      addPlugin(value, parameters);
    } else if (typeof value === "object") {
      if (Array.isArray(value)) {
        addList(value);
      } else {
        addPreset(value);
      }
    } else {
      throw new TypeError("Expected usable value, not `" + value + "`");
    }
    return this;
    function add(value2) {
      if (typeof value2 === "function") {
        addPlugin(value2, []);
      } else if (typeof value2 === "object") {
        if (Array.isArray(value2)) {
          const [plugin, ...parameters2] = (
            /** @type {PluginTuple<Array<unknown>>} */
            value2
          );
          addPlugin(plugin, parameters2);
        } else {
          addPreset(value2);
        }
      } else {
        throw new TypeError("Expected usable value, not `" + value2 + "`");
      }
    }
    function addPreset(result) {
      if (!("plugins" in result) && !("settings" in result)) {
        throw new Error(
          "Expected usable value but received an empty preset, which is probably a mistake: presets typically come with `plugins` and sometimes with `settings`, but this has neither"
        );
      }
      addList(result.plugins);
      if (result.settings) {
        namespace.settings = (0, import_extend.default)(true, namespace.settings, result.settings);
      }
    }
    function addList(plugins) {
      let index2 = -1;
      if (plugins === null || plugins === void 0) {
      } else if (Array.isArray(plugins)) {
        while (++index2 < plugins.length) {
          const thing = plugins[index2];
          add(thing);
        }
      } else {
        throw new TypeError("Expected a list of plugins, not `" + plugins + "`");
      }
    }
    function addPlugin(plugin, parameters2) {
      let index2 = -1;
      let entryIndex = -1;
      while (++index2 < attachers.length) {
        if (attachers[index2][0] === plugin) {
          entryIndex = index2;
          break;
        }
      }
      if (entryIndex === -1) {
        attachers.push([plugin, ...parameters2]);
      } else if (parameters2.length > 0) {
        let [primary, ...rest] = parameters2;
        const currentPrimary = attachers[entryIndex][1];
        if (isPlainObject(currentPrimary) && isPlainObject(primary)) {
          primary = (0, import_extend.default)(true, currentPrimary, primary);
        }
        attachers[entryIndex] = [plugin, primary, ...rest];
      }
    }
  }
};
var unified = new Processor().freeze();
function assertParser(name2, value) {
  if (typeof value !== "function") {
    throw new TypeError("Cannot `" + name2 + "` without `parser`");
  }
}
function assertCompiler(name2, value) {
  if (typeof value !== "function") {
    throw new TypeError("Cannot `" + name2 + "` without `compiler`");
  }
}
function assertUnfrozen(name2, frozen) {
  if (frozen) {
    throw new Error(
      "Cannot call `" + name2 + "` on a frozen processor.\nCreate a new processor first, by calling it: use `processor()` instead of `processor`."
    );
  }
}
function assertNode(node2) {
  if (!isPlainObject(node2) || typeof node2.type !== "string") {
    throw new TypeError("Expected node, got `" + node2 + "`");
  }
}
function assertDone(name2, asyncName, complete) {
  if (!complete) {
    throw new Error(
      "`" + name2 + "` finished async. Use `" + asyncName + "` instead"
    );
  }
}
function vfile(value) {
  return looksLikeAVFile(value) ? value : new VFile(value);
}
function looksLikeAVFile(value) {
  return Boolean(
    value && typeof value === "object" && "message" in value && "messages" in value
  );
}
function looksLikeAValue(value) {
  return typeof value === "string" || isUint8Array2(value);
}
function isUint8Array2(value) {
  return Boolean(
    value && typeof value === "object" && "byteLength" in value && "byteOffset" in value
  );
}

// node_modules/.pnpm/react-markdown@10.1.0_@types+react@18.3.28_react@18.3.1/node_modules/react-markdown/lib/index.js
var changelog = "https://github.com/remarkjs/react-markdown/blob/main/changelog.md";
var emptyPlugins = [];
var emptyRemarkRehypeOptions = { allowDangerousHtml: true };
var safeProtocol = /^(https?|ircs?|mailto|xmpp)$/i;
var deprecations = [
  { from: "astPlugins", id: "remove-buggy-html-in-markdown-parser" },
  { from: "allowDangerousHtml", id: "remove-buggy-html-in-markdown-parser" },
  {
    from: "allowNode",
    id: "replace-allownode-allowedtypes-and-disallowedtypes",
    to: "allowElement"
  },
  {
    from: "allowedTypes",
    id: "replace-allownode-allowedtypes-and-disallowedtypes",
    to: "allowedElements"
  },
  { from: "className", id: "remove-classname" },
  {
    from: "disallowedTypes",
    id: "replace-allownode-allowedtypes-and-disallowedtypes",
    to: "disallowedElements"
  },
  { from: "escapeHtml", id: "remove-buggy-html-in-markdown-parser" },
  { from: "includeElementIndex", id: "#remove-includeelementindex" },
  {
    from: "includeNodeIndex",
    id: "change-includenodeindex-to-includeelementindex"
  },
  { from: "linkTarget", id: "remove-linktarget" },
  { from: "plugins", id: "change-plugins-to-remarkplugins", to: "remarkPlugins" },
  { from: "rawSourcePos", id: "#remove-rawsourcepos" },
  { from: "renderers", id: "change-renderers-to-components", to: "components" },
  { from: "source", id: "change-source-to-children", to: "children" },
  { from: "sourcePos", id: "#remove-sourcepos" },
  { from: "transformImageUri", id: "#add-urltransform", to: "urlTransform" },
  { from: "transformLinkUri", id: "#add-urltransform", to: "urlTransform" }
];
function Markdown(options) {
  const processor = createProcessor(options);
  const file = createFile(options);
  return post(processor.runSync(processor.parse(file), file), options);
}
function createProcessor(options) {
  const rehypePlugins = options.rehypePlugins || emptyPlugins;
  const remarkPlugins = options.remarkPlugins || emptyPlugins;
  const remarkRehypeOptions = options.remarkRehypeOptions ? { ...options.remarkRehypeOptions, ...emptyRemarkRehypeOptions } : emptyRemarkRehypeOptions;
  const processor = unified().use(remarkParse).use(remarkPlugins).use(remarkRehype, remarkRehypeOptions).use(rehypePlugins);
  return processor;
}
function createFile(options) {
  const children = options.children || "";
  const file = new VFile();
  if (typeof children === "string") {
    file.value = children;
  } else {
    unreachable(
      "Unexpected value `" + children + "` for `children` prop, expected `string`"
    );
  }
  return file;
}
function post(tree, options) {
  const allowedElements = options.allowedElements;
  const allowElement = options.allowElement;
  const components = options.components;
  const disallowedElements = options.disallowedElements;
  const skipHtml = options.skipHtml;
  const unwrapDisallowed = options.unwrapDisallowed;
  const urlTransform = options.urlTransform || defaultUrlTransform;
  for (const deprecation of deprecations) {
    if (Object.hasOwn(options, deprecation.from)) {
      unreachable(
        "Unexpected `" + deprecation.from + "` prop, " + (deprecation.to ? "use `" + deprecation.to + "` instead" : "remove it") + " (see <" + changelog + "#" + deprecation.id + "> for more info)"
      );
    }
  }
  if (allowedElements && disallowedElements) {
    unreachable(
      "Unexpected combined `allowedElements` and `disallowedElements`, expected one or the other"
    );
  }
  visit(tree, transform);
  return toJsxRuntime(tree, {
    Fragment: Fragment2,
    components,
    ignoreInvalidStyle: true,
    jsx,
    jsxs,
    passKeys: true,
    passNode: true
  });
  function transform(node2, index2, parent) {
    if (node2.type === "raw" && parent && typeof index2 === "number") {
      if (skipHtml) {
        parent.children.splice(index2, 1);
      } else {
        parent.children[index2] = { type: "text", value: node2.value };
      }
      return index2;
    }
    if (node2.type === "element") {
      let key;
      for (key in urlAttributes) {
        if (Object.hasOwn(urlAttributes, key) && Object.hasOwn(node2.properties, key)) {
          const value = node2.properties[key];
          const test = urlAttributes[key];
          if (test === null || test.includes(node2.tagName)) {
            node2.properties[key] = urlTransform(String(value || ""), key, node2);
          }
        }
      }
    }
    if (node2.type === "element") {
      let remove = allowedElements ? !allowedElements.includes(node2.tagName) : disallowedElements ? disallowedElements.includes(node2.tagName) : false;
      if (!remove && allowElement && typeof index2 === "number") {
        remove = !allowElement(node2, index2, parent);
      }
      if (remove && parent && typeof index2 === "number") {
        if (unwrapDisallowed && node2.children) {
          parent.children.splice(index2, 1, ...node2.children);
        } else {
          parent.children.splice(index2, 1);
        }
        return index2;
      }
    }
  }
}
function defaultUrlTransform(value) {
  const colon = value.indexOf(":");
  const questionMark = value.indexOf("?");
  const numberSign = value.indexOf("#");
  const slash = value.indexOf("/");
  if (
    // If there is no protocol, it’s relative.
    colon === -1 || // If the first colon is after a `?`, `#`, or `/`, it’s not a protocol.
    slash !== -1 && colon > slash || questionMark !== -1 && colon > questionMark || numberSign !== -1 && colon > numberSign || // It is a protocol, it should be allowed.
    safeProtocol.test(value.slice(0, colon))
  ) {
    return value;
  }
  return "";
}

// node_modules/.pnpm/escape-string-regexp@5.0.0/node_modules/escape-string-regexp/index.js
function escapeStringRegexp(string3) {
  if (typeof string3 !== "string") {
    throw new TypeError("Expected a string");
  }
  return string3.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");
}

// node_modules/.pnpm/mdast-util-find-and-replace@3.0.2/node_modules/mdast-util-find-and-replace/lib/index.js
function findAndReplace(tree, list4, options) {
  const settings = options || {};
  const ignored = convert(settings.ignore || []);
  const pairs = toPairs(list4);
  let pairIndex = -1;
  while (++pairIndex < pairs.length) {
    visitParents(tree, "text", visitor);
  }
  function visitor(node2, parents) {
    let index2 = -1;
    let grandparent;
    while (++index2 < parents.length) {
      const parent = parents[index2];
      const siblings = grandparent ? grandparent.children : void 0;
      if (ignored(
        parent,
        siblings ? siblings.indexOf(parent) : void 0,
        grandparent
      )) {
        return;
      }
      grandparent = parent;
    }
    if (grandparent) {
      return handler(node2, parents);
    }
  }
  function handler(node2, parents) {
    const parent = parents[parents.length - 1];
    const find2 = pairs[pairIndex][0];
    const replace3 = pairs[pairIndex][1];
    let start2 = 0;
    const siblings = parent.children;
    const index2 = siblings.indexOf(node2);
    let change = false;
    let nodes = [];
    find2.lastIndex = 0;
    let match = find2.exec(node2.value);
    while (match) {
      const position3 = match.index;
      const matchObject = {
        index: match.index,
        input: match.input,
        stack: [...parents, node2]
      };
      let value = replace3(...match, matchObject);
      if (typeof value === "string") {
        value = value.length > 0 ? { type: "text", value } : void 0;
      }
      if (value === false) {
        find2.lastIndex = position3 + 1;
      } else {
        if (start2 !== position3) {
          nodes.push({
            type: "text",
            value: node2.value.slice(start2, position3)
          });
        }
        if (Array.isArray(value)) {
          nodes.push(...value);
        } else if (value) {
          nodes.push(value);
        }
        start2 = position3 + match[0].length;
        change = true;
      }
      if (!find2.global) {
        break;
      }
      match = find2.exec(node2.value);
    }
    if (change) {
      if (start2 < node2.value.length) {
        nodes.push({ type: "text", value: node2.value.slice(start2) });
      }
      parent.children.splice(index2, 1, ...nodes);
    } else {
      nodes = [node2];
    }
    return index2 + nodes.length;
  }
}
function toPairs(tupleOrList) {
  const result = [];
  if (!Array.isArray(tupleOrList)) {
    throw new TypeError("Expected find and replace tuple or list of tuples");
  }
  const list4 = !tupleOrList[0] || Array.isArray(tupleOrList[0]) ? tupleOrList : [tupleOrList];
  let index2 = -1;
  while (++index2 < list4.length) {
    const tuple = list4[index2];
    result.push([toExpression(tuple[0]), toFunction(tuple[1])]);
  }
  return result;
}
function toExpression(find2) {
  return typeof find2 === "string" ? new RegExp(escapeStringRegexp(find2), "g") : find2;
}
function toFunction(replace3) {
  return typeof replace3 === "function" ? replace3 : function() {
    return replace3;
  };
}

// node_modules/.pnpm/mdast-util-newline-to-break@2.0.0/node_modules/mdast-util-newline-to-break/lib/index.js
function newlineToBreak(tree) {
  findAndReplace(tree, [/\r?\n|\r/g, replace]);
}
function replace() {
  return { type: "break" };
}

// node_modules/.pnpm/remark-breaks@4.0.0/node_modules/remark-breaks/lib/index.js
function remarkBreaks() {
  return function(tree) {
    newlineToBreak(tree);
  };
}

// node_modules/.pnpm/mdast-util-gfm-autolink-literal@2.0.1/node_modules/mdast-util-gfm-autolink-literal/lib/index.js
var inConstruct = "phrasing";
var notInConstruct = ["autolink", "link", "image", "label"];
function gfmAutolinkLiteralFromMarkdown() {
  return {
    transforms: [transformGfmAutolinkLiterals],
    enter: {
      literalAutolink: enterLiteralAutolink,
      literalAutolinkEmail: enterLiteralAutolinkValue,
      literalAutolinkHttp: enterLiteralAutolinkValue,
      literalAutolinkWww: enterLiteralAutolinkValue
    },
    exit: {
      literalAutolink: exitLiteralAutolink,
      literalAutolinkEmail: exitLiteralAutolinkEmail,
      literalAutolinkHttp: exitLiteralAutolinkHttp,
      literalAutolinkWww: exitLiteralAutolinkWww
    }
  };
}
function gfmAutolinkLiteralToMarkdown() {
  return {
    unsafe: [
      {
        character: "@",
        before: "[+\\-.\\w]",
        after: "[\\-.\\w]",
        inConstruct,
        notInConstruct
      },
      {
        character: ".",
        before: "[Ww]",
        after: "[\\-.\\w]",
        inConstruct,
        notInConstruct
      },
      {
        character: ":",
        before: "[ps]",
        after: "\\/",
        inConstruct,
        notInConstruct
      }
    ]
  };
}
function enterLiteralAutolink(token) {
  this.enter({ type: "link", title: null, url: "", children: [] }, token);
}
function enterLiteralAutolinkValue(token) {
  this.config.enter.autolinkProtocol.call(this, token);
}
function exitLiteralAutolinkHttp(token) {
  this.config.exit.autolinkProtocol.call(this, token);
}
function exitLiteralAutolinkWww(token) {
  this.config.exit.data.call(this, token);
  const node2 = this.stack[this.stack.length - 1];
  ok(node2.type === "link");
  node2.url = "http://" + this.sliceSerialize(token);
}
function exitLiteralAutolinkEmail(token) {
  this.config.exit.autolinkEmail.call(this, token);
}
function exitLiteralAutolink(token) {
  this.exit(token);
}
function transformGfmAutolinkLiterals(tree) {
  findAndReplace(
    tree,
    [
      [/(https?:\/\/|www(?=\.))([-.\w]+)([^ \t\r\n]*)/gi, findUrl],
      [/(?<=^|\s|\p{P}|\p{S})([-.\w+]+)@([-\w]+(?:\.[-\w]+)+)/gu, findEmail]
    ],
    { ignore: ["link", "linkReference"] }
  );
}
function findUrl(_, protocol, domain2, path2, match) {
  let prefix = "";
  if (!previous2(match)) {
    return false;
  }
  if (/^w/i.test(protocol)) {
    domain2 = protocol + domain2;
    protocol = "";
    prefix = "http://";
  }
  if (!isCorrectDomain(domain2)) {
    return false;
  }
  const parts = splitUrl(domain2 + path2);
  if (!parts[0]) return false;
  const result = {
    type: "link",
    title: null,
    url: prefix + protocol + parts[0],
    children: [{ type: "text", value: protocol + parts[0] }]
  };
  if (parts[1]) {
    return [result, { type: "text", value: parts[1] }];
  }
  return result;
}
function findEmail(_, atext, label, match) {
  if (
    // Not an expected previous character.
    !previous2(match, true) || // Label ends in not allowed character.
    /[-\d_]$/.test(label)
  ) {
    return false;
  }
  return {
    type: "link",
    title: null,
    url: "mailto:" + atext + "@" + label,
    children: [{ type: "text", value: atext + "@" + label }]
  };
}
function isCorrectDomain(domain2) {
  const parts = domain2.split(".");
  if (parts.length < 2 || parts[parts.length - 1] && (/_/.test(parts[parts.length - 1]) || !/[a-zA-Z\d]/.test(parts[parts.length - 1])) || parts[parts.length - 2] && (/_/.test(parts[parts.length - 2]) || !/[a-zA-Z\d]/.test(parts[parts.length - 2]))) {
    return false;
  }
  return true;
}
function splitUrl(url) {
  const trailExec = /[!"&'),.:;<>?\]}]+$/.exec(url);
  if (!trailExec) {
    return [url, void 0];
  }
  url = url.slice(0, trailExec.index);
  let trail2 = trailExec[0];
  let closingParenIndex = trail2.indexOf(")");
  const openingParens = ccount(url, "(");
  let closingParens = ccount(url, ")");
  while (closingParenIndex !== -1 && openingParens > closingParens) {
    url += trail2.slice(0, closingParenIndex + 1);
    trail2 = trail2.slice(closingParenIndex + 1);
    closingParenIndex = trail2.indexOf(")");
    closingParens++;
  }
  return [url, trail2];
}
function previous2(match, email) {
  const code4 = match.input.charCodeAt(match.index - 1);
  return (match.index === 0 || unicodeWhitespace(code4) || unicodePunctuation(code4)) && // If it’s an email, the previous character should not be a slash.
  (!email || code4 !== 47);
}

// node_modules/.pnpm/mdast-util-gfm-footnote@2.1.0/node_modules/mdast-util-gfm-footnote/lib/index.js
footnoteReference2.peek = footnoteReferencePeek;
function enterFootnoteCallString() {
  this.buffer();
}
function enterFootnoteCall(token) {
  this.enter({ type: "footnoteReference", identifier: "", label: "" }, token);
}
function enterFootnoteDefinitionLabelString() {
  this.buffer();
}
function enterFootnoteDefinition(token) {
  this.enter(
    { type: "footnoteDefinition", identifier: "", label: "", children: [] },
    token
  );
}
function exitFootnoteCallString(token) {
  const label = this.resume();
  const node2 = this.stack[this.stack.length - 1];
  ok(node2.type === "footnoteReference");
  node2.identifier = normalizeIdentifier(
    this.sliceSerialize(token)
  ).toLowerCase();
  node2.label = label;
}
function exitFootnoteCall(token) {
  this.exit(token);
}
function exitFootnoteDefinitionLabelString(token) {
  const label = this.resume();
  const node2 = this.stack[this.stack.length - 1];
  ok(node2.type === "footnoteDefinition");
  node2.identifier = normalizeIdentifier(
    this.sliceSerialize(token)
  ).toLowerCase();
  node2.label = label;
}
function exitFootnoteDefinition(token) {
  this.exit(token);
}
function footnoteReferencePeek() {
  return "[";
}
function footnoteReference2(node2, _, state, info) {
  const tracker = state.createTracker(info);
  let value = tracker.move("[^");
  const exit3 = state.enter("footnoteReference");
  const subexit = state.enter("reference");
  value += tracker.move(
    state.safe(state.associationId(node2), { after: "]", before: value })
  );
  subexit();
  exit3();
  value += tracker.move("]");
  return value;
}
function gfmFootnoteFromMarkdown() {
  return {
    enter: {
      gfmFootnoteCallString: enterFootnoteCallString,
      gfmFootnoteCall: enterFootnoteCall,
      gfmFootnoteDefinitionLabelString: enterFootnoteDefinitionLabelString,
      gfmFootnoteDefinition: enterFootnoteDefinition
    },
    exit: {
      gfmFootnoteCallString: exitFootnoteCallString,
      gfmFootnoteCall: exitFootnoteCall,
      gfmFootnoteDefinitionLabelString: exitFootnoteDefinitionLabelString,
      gfmFootnoteDefinition: exitFootnoteDefinition
    }
  };
}
function gfmFootnoteToMarkdown(options) {
  let firstLineBlank = false;
  if (options && options.firstLineBlank) {
    firstLineBlank = true;
  }
  return {
    handlers: { footnoteDefinition, footnoteReference: footnoteReference2 },
    // This is on by default already.
    unsafe: [{ character: "[", inConstruct: ["label", "phrasing", "reference"] }]
  };
  function footnoteDefinition(node2, _, state, info) {
    const tracker = state.createTracker(info);
    let value = tracker.move("[^");
    const exit3 = state.enter("footnoteDefinition");
    const subexit = state.enter("label");
    value += tracker.move(
      state.safe(state.associationId(node2), { before: value, after: "]" })
    );
    subexit();
    value += tracker.move("]:");
    if (node2.children && node2.children.length > 0) {
      tracker.shift(4);
      value += tracker.move(
        (firstLineBlank ? "\n" : " ") + state.indentLines(
          state.containerFlow(node2, tracker.current()),
          firstLineBlank ? mapAll : mapExceptFirst
        )
      );
    }
    exit3();
    return value;
  }
}
function mapExceptFirst(line, index2, blank) {
  return index2 === 0 ? line : mapAll(line, index2, blank);
}
function mapAll(line, index2, blank) {
  return (blank ? "" : "    ") + line;
}

// node_modules/.pnpm/mdast-util-gfm-strikethrough@2.0.0/node_modules/mdast-util-gfm-strikethrough/lib/index.js
var constructsWithoutStrikethrough = [
  "autolink",
  "destinationLiteral",
  "destinationRaw",
  "reference",
  "titleQuote",
  "titleApostrophe"
];
handleDelete.peek = peekDelete;
function gfmStrikethroughFromMarkdown() {
  return {
    canContainEols: ["delete"],
    enter: { strikethrough: enterStrikethrough },
    exit: { strikethrough: exitStrikethrough }
  };
}
function gfmStrikethroughToMarkdown() {
  return {
    unsafe: [
      {
        character: "~",
        inConstruct: "phrasing",
        notInConstruct: constructsWithoutStrikethrough
      }
    ],
    handlers: { delete: handleDelete }
  };
}
function enterStrikethrough(token) {
  this.enter({ type: "delete", children: [] }, token);
}
function exitStrikethrough(token) {
  this.exit(token);
}
function handleDelete(node2, _, state, info) {
  const tracker = state.createTracker(info);
  const exit3 = state.enter("strikethrough");
  let value = tracker.move("~~");
  value += state.containerPhrasing(node2, {
    ...tracker.current(),
    before: value,
    after: "~"
  });
  value += tracker.move("~~");
  exit3();
  return value;
}
function peekDelete() {
  return "~";
}

// node_modules/.pnpm/markdown-table@3.0.4/node_modules/markdown-table/index.js
function defaultStringLength(value) {
  return value.length;
}
function markdownTable(table2, options) {
  const settings = options || {};
  const align = (settings.align || []).concat();
  const stringLength = settings.stringLength || defaultStringLength;
  const alignments = [];
  const cellMatrix = [];
  const sizeMatrix = [];
  const longestCellByColumn = [];
  let mostCellsPerRow = 0;
  let rowIndex = -1;
  while (++rowIndex < table2.length) {
    const row2 = [];
    const sizes2 = [];
    let columnIndex2 = -1;
    if (table2[rowIndex].length > mostCellsPerRow) {
      mostCellsPerRow = table2[rowIndex].length;
    }
    while (++columnIndex2 < table2[rowIndex].length) {
      const cell = serialize2(table2[rowIndex][columnIndex2]);
      if (settings.alignDelimiters !== false) {
        const size = stringLength(cell);
        sizes2[columnIndex2] = size;
        if (longestCellByColumn[columnIndex2] === void 0 || size > longestCellByColumn[columnIndex2]) {
          longestCellByColumn[columnIndex2] = size;
        }
      }
      row2.push(cell);
    }
    cellMatrix[rowIndex] = row2;
    sizeMatrix[rowIndex] = sizes2;
  }
  let columnIndex = -1;
  if (typeof align === "object" && "length" in align) {
    while (++columnIndex < mostCellsPerRow) {
      alignments[columnIndex] = toAlignment(align[columnIndex]);
    }
  } else {
    const code4 = toAlignment(align);
    while (++columnIndex < mostCellsPerRow) {
      alignments[columnIndex] = code4;
    }
  }
  columnIndex = -1;
  const row = [];
  const sizes = [];
  while (++columnIndex < mostCellsPerRow) {
    const code4 = alignments[columnIndex];
    let before = "";
    let after = "";
    if (code4 === 99) {
      before = ":";
      after = ":";
    } else if (code4 === 108) {
      before = ":";
    } else if (code4 === 114) {
      after = ":";
    }
    let size = settings.alignDelimiters === false ? 1 : Math.max(
      1,
      longestCellByColumn[columnIndex] - before.length - after.length
    );
    const cell = before + "-".repeat(size) + after;
    if (settings.alignDelimiters !== false) {
      size = before.length + size + after.length;
      if (size > longestCellByColumn[columnIndex]) {
        longestCellByColumn[columnIndex] = size;
      }
      sizes[columnIndex] = size;
    }
    row[columnIndex] = cell;
  }
  cellMatrix.splice(1, 0, row);
  sizeMatrix.splice(1, 0, sizes);
  rowIndex = -1;
  const lines = [];
  while (++rowIndex < cellMatrix.length) {
    const row2 = cellMatrix[rowIndex];
    const sizes2 = sizeMatrix[rowIndex];
    columnIndex = -1;
    const line = [];
    while (++columnIndex < mostCellsPerRow) {
      const cell = row2[columnIndex] || "";
      let before = "";
      let after = "";
      if (settings.alignDelimiters !== false) {
        const size = longestCellByColumn[columnIndex] - (sizes2[columnIndex] || 0);
        const code4 = alignments[columnIndex];
        if (code4 === 114) {
          before = " ".repeat(size);
        } else if (code4 === 99) {
          if (size % 2) {
            before = " ".repeat(size / 2 + 0.5);
            after = " ".repeat(size / 2 - 0.5);
          } else {
            before = " ".repeat(size / 2);
            after = before;
          }
        } else {
          after = " ".repeat(size);
        }
      }
      if (settings.delimiterStart !== false && !columnIndex) {
        line.push("|");
      }
      if (settings.padding !== false && // Don’t add the opening space if we’re not aligning and the cell is
      // empty: there will be a closing space.
      !(settings.alignDelimiters === false && cell === "") && (settings.delimiterStart !== false || columnIndex)) {
        line.push(" ");
      }
      if (settings.alignDelimiters !== false) {
        line.push(before);
      }
      line.push(cell);
      if (settings.alignDelimiters !== false) {
        line.push(after);
      }
      if (settings.padding !== false) {
        line.push(" ");
      }
      if (settings.delimiterEnd !== false || columnIndex !== mostCellsPerRow - 1) {
        line.push("|");
      }
    }
    lines.push(
      settings.delimiterEnd === false ? line.join("").replace(/ +$/, "") : line.join("")
    );
  }
  return lines.join("\n");
}
function serialize2(value) {
  return value === null || value === void 0 ? "" : String(value);
}
function toAlignment(value) {
  const code4 = typeof value === "string" ? value.codePointAt(0) : 0;
  return code4 === 67 || code4 === 99 ? 99 : code4 === 76 || code4 === 108 ? 108 : code4 === 82 || code4 === 114 ? 114 : 0;
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/blockquote.js
function blockquote2(node2, _, state, info) {
  const exit3 = state.enter("blockquote");
  const tracker = state.createTracker(info);
  tracker.move("> ");
  tracker.shift(2);
  const value = state.indentLines(
    state.containerFlow(node2, tracker.current()),
    map
  );
  exit3();
  return value;
}
function map(line, _, blank) {
  return ">" + (blank ? "" : " ") + line;
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/pattern-in-scope.js
function patternInScope(stack, pattern) {
  return listInScope(stack, pattern.inConstruct, true) && !listInScope(stack, pattern.notInConstruct, false);
}
function listInScope(stack, list4, none) {
  if (typeof list4 === "string") {
    list4 = [list4];
  }
  if (!list4 || list4.length === 0) {
    return none;
  }
  let index2 = -1;
  while (++index2 < list4.length) {
    if (stack.includes(list4[index2])) {
      return true;
    }
  }
  return false;
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/break.js
function hardBreak2(_, _1, state, info) {
  let index2 = -1;
  while (++index2 < state.unsafe.length) {
    if (state.unsafe[index2].character === "\n" && patternInScope(state.stack, state.unsafe[index2])) {
      return /[ \t]/.test(info.before) ? "" : " ";
    }
  }
  return "\\\n";
}

// node_modules/.pnpm/longest-streak@3.1.0/node_modules/longest-streak/index.js
function longestStreak(value, substring) {
  const source = String(value);
  let index2 = source.indexOf(substring);
  let expected = index2;
  let count = 0;
  let max = 0;
  if (typeof substring !== "string") {
    throw new TypeError("Expected substring");
  }
  while (index2 !== -1) {
    if (index2 === expected) {
      if (++count > max) {
        max = count;
      }
    } else {
      count = 1;
    }
    expected = index2 + substring.length;
    index2 = source.indexOf(substring, expected);
  }
  return max;
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/format-code-as-indented.js
function formatCodeAsIndented(node2, state) {
  return Boolean(
    state.options.fences === false && node2.value && // If there’s no info…
    !node2.lang && // And there’s a non-whitespace character…
    /[^ \r\n]/.test(node2.value) && // And the value doesn’t start or end in a blank…
    !/^[\t ]*(?:[\r\n]|$)|(?:^|[\r\n])[\t ]*$/.test(node2.value)
  );
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/check-fence.js
function checkFence(state) {
  const marker = state.options.fence || "`";
  if (marker !== "`" && marker !== "~") {
    throw new Error(
      "Cannot serialize code with `" + marker + "` for `options.fence`, expected `` ` `` or `~`"
    );
  }
  return marker;
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/code.js
function code2(node2, _, state, info) {
  const marker = checkFence(state);
  const raw = node2.value || "";
  const suffix = marker === "`" ? "GraveAccent" : "Tilde";
  if (formatCodeAsIndented(node2, state)) {
    const exit4 = state.enter("codeIndented");
    const value2 = state.indentLines(raw, map2);
    exit4();
    return value2;
  }
  const tracker = state.createTracker(info);
  const sequence = marker.repeat(Math.max(longestStreak(raw, marker) + 1, 3));
  const exit3 = state.enter("codeFenced");
  let value = tracker.move(sequence);
  if (node2.lang) {
    const subexit = state.enter(`codeFencedLang${suffix}`);
    value += tracker.move(
      state.safe(node2.lang, {
        before: value,
        after: " ",
        encode: ["`"],
        ...tracker.current()
      })
    );
    subexit();
  }
  if (node2.lang && node2.meta) {
    const subexit = state.enter(`codeFencedMeta${suffix}`);
    value += tracker.move(" ");
    value += tracker.move(
      state.safe(node2.meta, {
        before: value,
        after: "\n",
        encode: ["`"],
        ...tracker.current()
      })
    );
    subexit();
  }
  value += tracker.move("\n");
  if (raw) {
    value += tracker.move(raw + "\n");
  }
  value += tracker.move(sequence);
  exit3();
  return value;
}
function map2(line, _, blank) {
  return (blank ? "" : "    ") + line;
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/check-quote.js
function checkQuote(state) {
  const marker = state.options.quote || '"';
  if (marker !== '"' && marker !== "'") {
    throw new Error(
      "Cannot serialize title with `" + marker + "` for `options.quote`, expected `\"`, or `'`"
    );
  }
  return marker;
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/definition.js
function definition2(node2, _, state, info) {
  const quote = checkQuote(state);
  const suffix = quote === '"' ? "Quote" : "Apostrophe";
  const exit3 = state.enter("definition");
  let subexit = state.enter("label");
  const tracker = state.createTracker(info);
  let value = tracker.move("[");
  value += tracker.move(
    state.safe(state.associationId(node2), {
      before: value,
      after: "]",
      ...tracker.current()
    })
  );
  value += tracker.move("]: ");
  subexit();
  if (
    // If there’s no url, or…
    !node2.url || // If there are control characters or whitespace.
    /[\0- \u007F]/.test(node2.url)
  ) {
    subexit = state.enter("destinationLiteral");
    value += tracker.move("<");
    value += tracker.move(
      state.safe(node2.url, { before: value, after: ">", ...tracker.current() })
    );
    value += tracker.move(">");
  } else {
    subexit = state.enter("destinationRaw");
    value += tracker.move(
      state.safe(node2.url, {
        before: value,
        after: node2.title ? " " : "\n",
        ...tracker.current()
      })
    );
  }
  subexit();
  if (node2.title) {
    subexit = state.enter(`title${suffix}`);
    value += tracker.move(" " + quote);
    value += tracker.move(
      state.safe(node2.title, {
        before: value,
        after: quote,
        ...tracker.current()
      })
    );
    value += tracker.move(quote);
    subexit();
  }
  exit3();
  return value;
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/check-emphasis.js
function checkEmphasis(state) {
  const marker = state.options.emphasis || "*";
  if (marker !== "*" && marker !== "_") {
    throw new Error(
      "Cannot serialize emphasis with `" + marker + "` for `options.emphasis`, expected `*`, or `_`"
    );
  }
  return marker;
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/encode-character-reference.js
function encodeCharacterReference(code4) {
  return "&#x" + code4.toString(16).toUpperCase() + ";";
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/encode-info.js
function encodeInfo(outside, inside, marker) {
  const outsideKind = classifyCharacter(outside);
  const insideKind = classifyCharacter(inside);
  if (outsideKind === void 0) {
    return insideKind === void 0 ? (
      // Letter inside:
      // we have to encode *both* letters for `_` as it is looser.
      // it already forms for `*` (and GFMs `~`).
      marker === "_" ? { inside: true, outside: true } : { inside: false, outside: false }
    ) : insideKind === 1 ? (
      // Whitespace inside: encode both (letter, whitespace).
      { inside: true, outside: true }
    ) : (
      // Punctuation inside: encode outer (letter)
      { inside: false, outside: true }
    );
  }
  if (outsideKind === 1) {
    return insideKind === void 0 ? (
      // Letter inside: already forms.
      { inside: false, outside: false }
    ) : insideKind === 1 ? (
      // Whitespace inside: encode both (whitespace).
      { inside: true, outside: true }
    ) : (
      // Punctuation inside: already forms.
      { inside: false, outside: false }
    );
  }
  return insideKind === void 0 ? (
    // Letter inside: already forms.
    { inside: false, outside: false }
  ) : insideKind === 1 ? (
    // Whitespace inside: encode inner (whitespace).
    { inside: true, outside: false }
  ) : (
    // Punctuation inside: already forms.
    { inside: false, outside: false }
  );
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/emphasis.js
emphasis2.peek = emphasisPeek;
function emphasis2(node2, _, state, info) {
  const marker = checkEmphasis(state);
  const exit3 = state.enter("emphasis");
  const tracker = state.createTracker(info);
  const before = tracker.move(marker);
  let between = tracker.move(
    state.containerPhrasing(node2, {
      after: marker,
      before,
      ...tracker.current()
    })
  );
  const betweenHead = between.charCodeAt(0);
  const open = encodeInfo(
    info.before.charCodeAt(info.before.length - 1),
    betweenHead,
    marker
  );
  if (open.inside) {
    between = encodeCharacterReference(betweenHead) + between.slice(1);
  }
  const betweenTail = between.charCodeAt(between.length - 1);
  const close = encodeInfo(info.after.charCodeAt(0), betweenTail, marker);
  if (close.inside) {
    between = between.slice(0, -1) + encodeCharacterReference(betweenTail);
  }
  const after = tracker.move(marker);
  exit3();
  state.attentionEncodeSurroundingInfo = {
    after: close.outside,
    before: open.outside
  };
  return before + between + after;
}
function emphasisPeek(_, _1, state) {
  return state.options.emphasis || "*";
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/format-heading-as-setext.js
function formatHeadingAsSetext(node2, state) {
  let literalWithBreak = false;
  visit(node2, function(node3) {
    if ("value" in node3 && /\r?\n|\r/.test(node3.value) || node3.type === "break") {
      literalWithBreak = true;
      return EXIT;
    }
  });
  return Boolean(
    (!node2.depth || node2.depth < 3) && toString(node2) && (state.options.setext || literalWithBreak)
  );
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/heading.js
function heading2(node2, _, state, info) {
  const rank = Math.max(Math.min(6, node2.depth || 1), 1);
  const tracker = state.createTracker(info);
  if (formatHeadingAsSetext(node2, state)) {
    const exit4 = state.enter("headingSetext");
    const subexit2 = state.enter("phrasing");
    const value2 = state.containerPhrasing(node2, {
      ...tracker.current(),
      before: "\n",
      after: "\n"
    });
    subexit2();
    exit4();
    return value2 + "\n" + (rank === 1 ? "=" : "-").repeat(
      // The whole size…
      value2.length - // Minus the position of the character after the last EOL (or
      // 0 if there is none)…
      (Math.max(value2.lastIndexOf("\r"), value2.lastIndexOf("\n")) + 1)
    );
  }
  const sequence = "#".repeat(rank);
  const exit3 = state.enter("headingAtx");
  const subexit = state.enter("phrasing");
  tracker.move(sequence + " ");
  let value = state.containerPhrasing(node2, {
    before: "# ",
    after: "\n",
    ...tracker.current()
  });
  if (/^[\t ]/.test(value)) {
    value = encodeCharacterReference(value.charCodeAt(0)) + value.slice(1);
  }
  value = value ? sequence + " " + value : sequence;
  if (state.options.closeAtx) {
    value += " " + sequence;
  }
  subexit();
  exit3();
  return value;
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/html.js
html3.peek = htmlPeek;
function html3(node2) {
  return node2.value || "";
}
function htmlPeek() {
  return "<";
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/image.js
image2.peek = imagePeek;
function image2(node2, _, state, info) {
  const quote = checkQuote(state);
  const suffix = quote === '"' ? "Quote" : "Apostrophe";
  const exit3 = state.enter("image");
  let subexit = state.enter("label");
  const tracker = state.createTracker(info);
  let value = tracker.move("![");
  value += tracker.move(
    state.safe(node2.alt, { before: value, after: "]", ...tracker.current() })
  );
  value += tracker.move("](");
  subexit();
  if (
    // If there’s no url but there is a title…
    !node2.url && node2.title || // If there are control characters or whitespace.
    /[\0- \u007F]/.test(node2.url)
  ) {
    subexit = state.enter("destinationLiteral");
    value += tracker.move("<");
    value += tracker.move(
      state.safe(node2.url, { before: value, after: ">", ...tracker.current() })
    );
    value += tracker.move(">");
  } else {
    subexit = state.enter("destinationRaw");
    value += tracker.move(
      state.safe(node2.url, {
        before: value,
        after: node2.title ? " " : ")",
        ...tracker.current()
      })
    );
  }
  subexit();
  if (node2.title) {
    subexit = state.enter(`title${suffix}`);
    value += tracker.move(" " + quote);
    value += tracker.move(
      state.safe(node2.title, {
        before: value,
        after: quote,
        ...tracker.current()
      })
    );
    value += tracker.move(quote);
    subexit();
  }
  value += tracker.move(")");
  exit3();
  return value;
}
function imagePeek() {
  return "!";
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/image-reference.js
imageReference2.peek = imageReferencePeek;
function imageReference2(node2, _, state, info) {
  const type = node2.referenceType;
  const exit3 = state.enter("imageReference");
  let subexit = state.enter("label");
  const tracker = state.createTracker(info);
  let value = tracker.move("![");
  const alt = state.safe(node2.alt, {
    before: value,
    after: "]",
    ...tracker.current()
  });
  value += tracker.move(alt + "][");
  subexit();
  const stack = state.stack;
  state.stack = [];
  subexit = state.enter("reference");
  const reference = state.safe(state.associationId(node2), {
    before: value,
    after: "]",
    ...tracker.current()
  });
  subexit();
  state.stack = stack;
  exit3();
  if (type === "full" || !alt || alt !== reference) {
    value += tracker.move(reference + "]");
  } else if (type === "shortcut") {
    value = value.slice(0, -1);
  } else {
    value += tracker.move("]");
  }
  return value;
}
function imageReferencePeek() {
  return "!";
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/inline-code.js
inlineCode2.peek = inlineCodePeek;
function inlineCode2(node2, _, state) {
  let value = node2.value || "";
  let sequence = "`";
  let index2 = -1;
  while (new RegExp("(^|[^`])" + sequence + "([^`]|$)").test(value)) {
    sequence += "`";
  }
  if (/[^ \r\n]/.test(value) && (/^[ \r\n]/.test(value) && /[ \r\n]$/.test(value) || /^`|`$/.test(value))) {
    value = " " + value + " ";
  }
  while (++index2 < state.unsafe.length) {
    const pattern = state.unsafe[index2];
    const expression = state.compilePattern(pattern);
    let match;
    if (!pattern.atBreak) continue;
    while (match = expression.exec(value)) {
      let position3 = match.index;
      if (value.charCodeAt(position3) === 10 && value.charCodeAt(position3 - 1) === 13) {
        position3--;
      }
      value = value.slice(0, position3) + " " + value.slice(match.index + 1);
    }
  }
  return sequence + value + sequence;
}
function inlineCodePeek() {
  return "`";
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/format-link-as-autolink.js
function formatLinkAsAutolink(node2, state) {
  const raw = toString(node2);
  return Boolean(
    !state.options.resourceLink && // If there’s a url…
    node2.url && // And there’s a no title…
    !node2.title && // And the content of `node` is a single text node…
    node2.children && node2.children.length === 1 && node2.children[0].type === "text" && // And if the url is the same as the content…
    (raw === node2.url || "mailto:" + raw === node2.url) && // And that starts w/ a protocol…
    /^[a-z][a-z+.-]+:/i.test(node2.url) && // And that doesn’t contain ASCII control codes (character escapes and
    // references don’t work), space, or angle brackets…
    !/[\0- <>\u007F]/.test(node2.url)
  );
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/link.js
link2.peek = linkPeek;
function link2(node2, _, state, info) {
  const quote = checkQuote(state);
  const suffix = quote === '"' ? "Quote" : "Apostrophe";
  const tracker = state.createTracker(info);
  let exit3;
  let subexit;
  if (formatLinkAsAutolink(node2, state)) {
    const stack = state.stack;
    state.stack = [];
    exit3 = state.enter("autolink");
    let value2 = tracker.move("<");
    value2 += tracker.move(
      state.containerPhrasing(node2, {
        before: value2,
        after: ">",
        ...tracker.current()
      })
    );
    value2 += tracker.move(">");
    exit3();
    state.stack = stack;
    return value2;
  }
  exit3 = state.enter("link");
  subexit = state.enter("label");
  let value = tracker.move("[");
  value += tracker.move(
    state.containerPhrasing(node2, {
      before: value,
      after: "](",
      ...tracker.current()
    })
  );
  value += tracker.move("](");
  subexit();
  if (
    // If there’s no url but there is a title…
    !node2.url && node2.title || // If there are control characters or whitespace.
    /[\0- \u007F]/.test(node2.url)
  ) {
    subexit = state.enter("destinationLiteral");
    value += tracker.move("<");
    value += tracker.move(
      state.safe(node2.url, { before: value, after: ">", ...tracker.current() })
    );
    value += tracker.move(">");
  } else {
    subexit = state.enter("destinationRaw");
    value += tracker.move(
      state.safe(node2.url, {
        before: value,
        after: node2.title ? " " : ")",
        ...tracker.current()
      })
    );
  }
  subexit();
  if (node2.title) {
    subexit = state.enter(`title${suffix}`);
    value += tracker.move(" " + quote);
    value += tracker.move(
      state.safe(node2.title, {
        before: value,
        after: quote,
        ...tracker.current()
      })
    );
    value += tracker.move(quote);
    subexit();
  }
  value += tracker.move(")");
  exit3();
  return value;
}
function linkPeek(node2, _, state) {
  return formatLinkAsAutolink(node2, state) ? "<" : "[";
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/link-reference.js
linkReference2.peek = linkReferencePeek;
function linkReference2(node2, _, state, info) {
  const type = node2.referenceType;
  const exit3 = state.enter("linkReference");
  let subexit = state.enter("label");
  const tracker = state.createTracker(info);
  let value = tracker.move("[");
  const text7 = state.containerPhrasing(node2, {
    before: value,
    after: "]",
    ...tracker.current()
  });
  value += tracker.move(text7 + "][");
  subexit();
  const stack = state.stack;
  state.stack = [];
  subexit = state.enter("reference");
  const reference = state.safe(state.associationId(node2), {
    before: value,
    after: "]",
    ...tracker.current()
  });
  subexit();
  state.stack = stack;
  exit3();
  if (type === "full" || !text7 || text7 !== reference) {
    value += tracker.move(reference + "]");
  } else if (type === "shortcut") {
    value = value.slice(0, -1);
  } else {
    value += tracker.move("]");
  }
  return value;
}
function linkReferencePeek() {
  return "[";
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/check-bullet.js
function checkBullet(state) {
  const marker = state.options.bullet || "*";
  if (marker !== "*" && marker !== "+" && marker !== "-") {
    throw new Error(
      "Cannot serialize items with `" + marker + "` for `options.bullet`, expected `*`, `+`, or `-`"
    );
  }
  return marker;
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/check-bullet-other.js
function checkBulletOther(state) {
  const bullet = checkBullet(state);
  const bulletOther = state.options.bulletOther;
  if (!bulletOther) {
    return bullet === "*" ? "-" : "*";
  }
  if (bulletOther !== "*" && bulletOther !== "+" && bulletOther !== "-") {
    throw new Error(
      "Cannot serialize items with `" + bulletOther + "` for `options.bulletOther`, expected `*`, `+`, or `-`"
    );
  }
  if (bulletOther === bullet) {
    throw new Error(
      "Expected `bullet` (`" + bullet + "`) and `bulletOther` (`" + bulletOther + "`) to be different"
    );
  }
  return bulletOther;
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/check-bullet-ordered.js
function checkBulletOrdered(state) {
  const marker = state.options.bulletOrdered || ".";
  if (marker !== "." && marker !== ")") {
    throw new Error(
      "Cannot serialize items with `" + marker + "` for `options.bulletOrdered`, expected `.` or `)`"
    );
  }
  return marker;
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/check-rule.js
function checkRule(state) {
  const marker = state.options.rule || "*";
  if (marker !== "*" && marker !== "-" && marker !== "_") {
    throw new Error(
      "Cannot serialize rules with `" + marker + "` for `options.rule`, expected `*`, `-`, or `_`"
    );
  }
  return marker;
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/list.js
function list3(node2, parent, state, info) {
  const exit3 = state.enter("list");
  const bulletCurrent = state.bulletCurrent;
  let bullet = node2.ordered ? checkBulletOrdered(state) : checkBullet(state);
  const bulletOther = node2.ordered ? bullet === "." ? ")" : "." : checkBulletOther(state);
  let useDifferentMarker = parent && state.bulletLastUsed ? bullet === state.bulletLastUsed : false;
  if (!node2.ordered) {
    const firstListItem = node2.children ? node2.children[0] : void 0;
    if (
      // Bullet could be used as a thematic break marker:
      (bullet === "*" || bullet === "-") && // Empty first list item:
      firstListItem && (!firstListItem.children || !firstListItem.children[0]) && // Directly in two other list items:
      state.stack[state.stack.length - 1] === "list" && state.stack[state.stack.length - 2] === "listItem" && state.stack[state.stack.length - 3] === "list" && state.stack[state.stack.length - 4] === "listItem" && // That are each the first child.
      state.indexStack[state.indexStack.length - 1] === 0 && state.indexStack[state.indexStack.length - 2] === 0 && state.indexStack[state.indexStack.length - 3] === 0
    ) {
      useDifferentMarker = true;
    }
    if (checkRule(state) === bullet && firstListItem) {
      let index2 = -1;
      while (++index2 < node2.children.length) {
        const item = node2.children[index2];
        if (item && item.type === "listItem" && item.children && item.children[0] && item.children[0].type === "thematicBreak") {
          useDifferentMarker = true;
          break;
        }
      }
    }
  }
  if (useDifferentMarker) {
    bullet = bulletOther;
  }
  state.bulletCurrent = bullet;
  const value = state.containerFlow(node2, info);
  state.bulletLastUsed = bullet;
  state.bulletCurrent = bulletCurrent;
  exit3();
  return value;
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/check-list-item-indent.js
function checkListItemIndent(state) {
  const style = state.options.listItemIndent || "one";
  if (style !== "tab" && style !== "one" && style !== "mixed") {
    throw new Error(
      "Cannot serialize items with `" + style + "` for `options.listItemIndent`, expected `tab`, `one`, or `mixed`"
    );
  }
  return style;
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/list-item.js
function listItem2(node2, parent, state, info) {
  const listItemIndent = checkListItemIndent(state);
  let bullet = state.bulletCurrent || checkBullet(state);
  if (parent && parent.type === "list" && parent.ordered) {
    bullet = (typeof parent.start === "number" && parent.start > -1 ? parent.start : 1) + (state.options.incrementListMarker === false ? 0 : parent.children.indexOf(node2)) + bullet;
  }
  let size = bullet.length + 1;
  if (listItemIndent === "tab" || listItemIndent === "mixed" && (parent && parent.type === "list" && parent.spread || node2.spread)) {
    size = Math.ceil(size / 4) * 4;
  }
  const tracker = state.createTracker(info);
  tracker.move(bullet + " ".repeat(size - bullet.length));
  tracker.shift(size);
  const exit3 = state.enter("listItem");
  const value = state.indentLines(
    state.containerFlow(node2, tracker.current()),
    map3
  );
  exit3();
  return value;
  function map3(line, index2, blank) {
    if (index2) {
      return (blank ? "" : " ".repeat(size)) + line;
    }
    return (blank ? bullet : bullet + " ".repeat(size - bullet.length)) + line;
  }
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/paragraph.js
function paragraph2(node2, _, state, info) {
  const exit3 = state.enter("paragraph");
  const subexit = state.enter("phrasing");
  const value = state.containerPhrasing(node2, info);
  subexit();
  exit3();
  return value;
}

// node_modules/.pnpm/mdast-util-phrasing@4.1.0/node_modules/mdast-util-phrasing/lib/index.js
var phrasing = (
  /** @type {(node?: unknown) => node is Exclude<PhrasingContent, Html>} */
  convert([
    "break",
    "delete",
    "emphasis",
    // To do: next major: removed since footnotes were added to GFM.
    "footnote",
    "footnoteReference",
    "image",
    "imageReference",
    "inlineCode",
    // Enabled by `mdast-util-math`:
    "inlineMath",
    "link",
    "linkReference",
    // Enabled by `mdast-util-mdx`:
    "mdxJsxTextElement",
    // Enabled by `mdast-util-mdx`:
    "mdxTextExpression",
    "strong",
    "text",
    // Enabled by `mdast-util-directive`:
    "textDirective"
  ])
);

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/root.js
function root3(node2, _, state, info) {
  const hasPhrasing = node2.children.some(function(d) {
    return phrasing(d);
  });
  const container = hasPhrasing ? state.containerPhrasing : state.containerFlow;
  return container.call(state, node2, info);
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/check-strong.js
function checkStrong(state) {
  const marker = state.options.strong || "*";
  if (marker !== "*" && marker !== "_") {
    throw new Error(
      "Cannot serialize strong with `" + marker + "` for `options.strong`, expected `*`, or `_`"
    );
  }
  return marker;
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/strong.js
strong2.peek = strongPeek;
function strong2(node2, _, state, info) {
  const marker = checkStrong(state);
  const exit3 = state.enter("strong");
  const tracker = state.createTracker(info);
  const before = tracker.move(marker + marker);
  let between = tracker.move(
    state.containerPhrasing(node2, {
      after: marker,
      before,
      ...tracker.current()
    })
  );
  const betweenHead = between.charCodeAt(0);
  const open = encodeInfo(
    info.before.charCodeAt(info.before.length - 1),
    betweenHead,
    marker
  );
  if (open.inside) {
    between = encodeCharacterReference(betweenHead) + between.slice(1);
  }
  const betweenTail = between.charCodeAt(between.length - 1);
  const close = encodeInfo(info.after.charCodeAt(0), betweenTail, marker);
  if (close.inside) {
    between = between.slice(0, -1) + encodeCharacterReference(betweenTail);
  }
  const after = tracker.move(marker + marker);
  exit3();
  state.attentionEncodeSurroundingInfo = {
    after: close.outside,
    before: open.outside
  };
  return before + between + after;
}
function strongPeek(_, _1, state) {
  return state.options.strong || "*";
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/text.js
function text5(node2, _, state, info) {
  return state.safe(node2.value, info);
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/check-rule-repetition.js
function checkRuleRepetition(state) {
  const repetition = state.options.ruleRepetition || 3;
  if (repetition < 3) {
    throw new Error(
      "Cannot serialize rules with repetition `" + repetition + "` for `options.ruleRepetition`, expected `3` or more"
    );
  }
  return repetition;
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/thematic-break.js
function thematicBreak3(_, _1, state) {
  const value = (checkRule(state) + (state.options.ruleSpaces ? " " : "")).repeat(checkRuleRepetition(state));
  return state.options.ruleSpaces ? value.slice(0, -1) : value;
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/index.js
var handle = {
  blockquote: blockquote2,
  break: hardBreak2,
  code: code2,
  definition: definition2,
  emphasis: emphasis2,
  hardBreak: hardBreak2,
  heading: heading2,
  html: html3,
  image: image2,
  imageReference: imageReference2,
  inlineCode: inlineCode2,
  link: link2,
  linkReference: linkReference2,
  list: list3,
  listItem: listItem2,
  paragraph: paragraph2,
  root: root3,
  strong: strong2,
  text: text5,
  thematicBreak: thematicBreak3
};

// node_modules/.pnpm/mdast-util-gfm-table@2.0.0/node_modules/mdast-util-gfm-table/lib/index.js
function gfmTableFromMarkdown() {
  return {
    enter: {
      table: enterTable,
      tableData: enterCell,
      tableHeader: enterCell,
      tableRow: enterRow
    },
    exit: {
      codeText: exitCodeText,
      table: exitTable,
      tableData: exit2,
      tableHeader: exit2,
      tableRow: exit2
    }
  };
}
function enterTable(token) {
  const align = token._align;
  ok(align, "expected `_align` on table");
  this.enter(
    {
      type: "table",
      align: align.map(function(d) {
        return d === "none" ? null : d;
      }),
      children: []
    },
    token
  );
  this.data.inTable = true;
}
function exitTable(token) {
  this.exit(token);
  this.data.inTable = void 0;
}
function enterRow(token) {
  this.enter({ type: "tableRow", children: [] }, token);
}
function exit2(token) {
  this.exit(token);
}
function enterCell(token) {
  this.enter({ type: "tableCell", children: [] }, token);
}
function exitCodeText(token) {
  let value = this.resume();
  if (this.data.inTable) {
    value = value.replace(/\\([\\|])/g, replace2);
  }
  const node2 = this.stack[this.stack.length - 1];
  ok(node2.type === "inlineCode");
  node2.value = value;
  this.exit(token);
}
function replace2($0, $1) {
  return $1 === "|" ? $1 : $0;
}
function gfmTableToMarkdown(options) {
  const settings = options || {};
  const padding = settings.tableCellPadding;
  const alignDelimiters = settings.tablePipeAlign;
  const stringLength = settings.stringLength;
  const around = padding ? " " : "|";
  return {
    unsafe: [
      { character: "\r", inConstruct: "tableCell" },
      { character: "\n", inConstruct: "tableCell" },
      // A pipe, when followed by a tab or space (padding), or a dash or colon
      // (unpadded delimiter row), could result in a table.
      { atBreak: true, character: "|", after: "[	 :-]" },
      // A pipe in a cell must be encoded.
      { character: "|", inConstruct: "tableCell" },
      // A colon must be followed by a dash, in which case it could start a
      // delimiter row.
      { atBreak: true, character: ":", after: "-" },
      // A delimiter row can also start with a dash, when followed by more
      // dashes, a colon, or a pipe.
      // This is a stricter version than the built in check for lists, thematic
      // breaks, and setex heading underlines though:
      // <https://github.com/syntax-tree/mdast-util-to-markdown/blob/51a2038/lib/unsafe.js#L57>
      { atBreak: true, character: "-", after: "[:|-]" }
    ],
    handlers: {
      inlineCode: inlineCodeWithTable,
      table: handleTable,
      tableCell: handleTableCell,
      tableRow: handleTableRow
    }
  };
  function handleTable(node2, _, state, info) {
    return serializeData(handleTableAsData(node2, state, info), node2.align);
  }
  function handleTableRow(node2, _, state, info) {
    const row = handleTableRowAsData(node2, state, info);
    const value = serializeData([row]);
    return value.slice(0, value.indexOf("\n"));
  }
  function handleTableCell(node2, _, state, info) {
    const exit3 = state.enter("tableCell");
    const subexit = state.enter("phrasing");
    const value = state.containerPhrasing(node2, {
      ...info,
      before: around,
      after: around
    });
    subexit();
    exit3();
    return value;
  }
  function serializeData(matrix, align) {
    return markdownTable(matrix, {
      align,
      // @ts-expect-error: `markdown-table` types should support `null`.
      alignDelimiters,
      // @ts-expect-error: `markdown-table` types should support `null`.
      padding,
      // @ts-expect-error: `markdown-table` types should support `null`.
      stringLength
    });
  }
  function handleTableAsData(node2, state, info) {
    const children = node2.children;
    let index2 = -1;
    const result = [];
    const subexit = state.enter("table");
    while (++index2 < children.length) {
      result[index2] = handleTableRowAsData(children[index2], state, info);
    }
    subexit();
    return result;
  }
  function handleTableRowAsData(node2, state, info) {
    const children = node2.children;
    let index2 = -1;
    const result = [];
    const subexit = state.enter("tableRow");
    while (++index2 < children.length) {
      result[index2] = handleTableCell(children[index2], node2, state, info);
    }
    subexit();
    return result;
  }
  function inlineCodeWithTable(node2, parent, state) {
    let value = handle.inlineCode(node2, parent, state);
    if (state.stack.includes("tableCell")) {
      value = value.replace(/\|/g, "\\$&");
    }
    return value;
  }
}

// node_modules/.pnpm/mdast-util-gfm-task-list-item@2.0.0/node_modules/mdast-util-gfm-task-list-item/lib/index.js
function gfmTaskListItemFromMarkdown() {
  return {
    exit: {
      taskListCheckValueChecked: exitCheck,
      taskListCheckValueUnchecked: exitCheck,
      paragraph: exitParagraphWithTaskListItem
    }
  };
}
function gfmTaskListItemToMarkdown() {
  return {
    unsafe: [{ atBreak: true, character: "-", after: "[:|-]" }],
    handlers: { listItem: listItemWithTaskListItem }
  };
}
function exitCheck(token) {
  const node2 = this.stack[this.stack.length - 2];
  ok(node2.type === "listItem");
  node2.checked = token.type === "taskListCheckValueChecked";
}
function exitParagraphWithTaskListItem(token) {
  const parent = this.stack[this.stack.length - 2];
  if (parent && parent.type === "listItem" && typeof parent.checked === "boolean") {
    const node2 = this.stack[this.stack.length - 1];
    ok(node2.type === "paragraph");
    const head = node2.children[0];
    if (head && head.type === "text") {
      const siblings = parent.children;
      let index2 = -1;
      let firstParaghraph;
      while (++index2 < siblings.length) {
        const sibling = siblings[index2];
        if (sibling.type === "paragraph") {
          firstParaghraph = sibling;
          break;
        }
      }
      if (firstParaghraph === node2) {
        head.value = head.value.slice(1);
        if (head.value.length === 0) {
          node2.children.shift();
        } else if (node2.position && head.position && typeof head.position.start.offset === "number") {
          head.position.start.column++;
          head.position.start.offset++;
          node2.position.start = Object.assign({}, head.position.start);
        }
      }
    }
  }
  this.exit(token);
}
function listItemWithTaskListItem(node2, parent, state, info) {
  const head = node2.children[0];
  const checkable = typeof node2.checked === "boolean" && head && head.type === "paragraph";
  const checkbox = "[" + (node2.checked ? "x" : " ") + "] ";
  const tracker = state.createTracker(info);
  if (checkable) {
    tracker.move(checkbox);
  }
  let value = handle.listItem(node2, parent, state, {
    ...info,
    ...tracker.current()
  });
  if (checkable) {
    value = value.replace(/^(?:[*+-]|\d+\.)([\r\n]| {1,3})/, check);
  }
  return value;
  function check($0) {
    return $0 + checkbox;
  }
}

// node_modules/.pnpm/mdast-util-gfm@3.1.0/node_modules/mdast-util-gfm/lib/index.js
function gfmFromMarkdown() {
  return [
    gfmAutolinkLiteralFromMarkdown(),
    gfmFootnoteFromMarkdown(),
    gfmStrikethroughFromMarkdown(),
    gfmTableFromMarkdown(),
    gfmTaskListItemFromMarkdown()
  ];
}
function gfmToMarkdown(options) {
  return {
    extensions: [
      gfmAutolinkLiteralToMarkdown(),
      gfmFootnoteToMarkdown(options),
      gfmStrikethroughToMarkdown(),
      gfmTableToMarkdown(options),
      gfmTaskListItemToMarkdown()
    ]
  };
}

// node_modules/.pnpm/micromark-extension-gfm-autolink-literal@2.1.0/node_modules/micromark-extension-gfm-autolink-literal/lib/syntax.js
var wwwPrefix = {
  tokenize: tokenizeWwwPrefix,
  partial: true
};
var domain = {
  tokenize: tokenizeDomain,
  partial: true
};
var path = {
  tokenize: tokenizePath,
  partial: true
};
var trail = {
  tokenize: tokenizeTrail,
  partial: true
};
var emailDomainDotTrail = {
  tokenize: tokenizeEmailDomainDotTrail,
  partial: true
};
var wwwAutolink = {
  name: "wwwAutolink",
  tokenize: tokenizeWwwAutolink,
  previous: previousWww
};
var protocolAutolink = {
  name: "protocolAutolink",
  tokenize: tokenizeProtocolAutolink,
  previous: previousProtocol
};
var emailAutolink = {
  name: "emailAutolink",
  tokenize: tokenizeEmailAutolink,
  previous: previousEmail
};
var text6 = {};
function gfmAutolinkLiteral() {
  return {
    text: text6
  };
}
var code3 = 48;
while (code3 < 123) {
  text6[code3] = emailAutolink;
  code3++;
  if (code3 === 58) code3 = 65;
  else if (code3 === 91) code3 = 97;
}
text6[43] = emailAutolink;
text6[45] = emailAutolink;
text6[46] = emailAutolink;
text6[95] = emailAutolink;
text6[72] = [emailAutolink, protocolAutolink];
text6[104] = [emailAutolink, protocolAutolink];
text6[87] = [emailAutolink, wwwAutolink];
text6[119] = [emailAutolink, wwwAutolink];
function tokenizeEmailAutolink(effects, ok3, nok) {
  const self2 = this;
  let dot;
  let data;
  return start2;
  function start2(code4) {
    if (!gfmAtext(code4) || !previousEmail.call(self2, self2.previous) || previousUnbalanced(self2.events)) {
      return nok(code4);
    }
    effects.enter("literalAutolink");
    effects.enter("literalAutolinkEmail");
    return atext(code4);
  }
  function atext(code4) {
    if (gfmAtext(code4)) {
      effects.consume(code4);
      return atext;
    }
    if (code4 === 64) {
      effects.consume(code4);
      return emailDomain;
    }
    return nok(code4);
  }
  function emailDomain(code4) {
    if (code4 === 46) {
      return effects.check(emailDomainDotTrail, emailDomainAfter, emailDomainDot)(code4);
    }
    if (code4 === 45 || code4 === 95 || asciiAlphanumeric(code4)) {
      data = true;
      effects.consume(code4);
      return emailDomain;
    }
    return emailDomainAfter(code4);
  }
  function emailDomainDot(code4) {
    effects.consume(code4);
    dot = true;
    return emailDomain;
  }
  function emailDomainAfter(code4) {
    if (data && dot && asciiAlpha(self2.previous)) {
      effects.exit("literalAutolinkEmail");
      effects.exit("literalAutolink");
      return ok3(code4);
    }
    return nok(code4);
  }
}
function tokenizeWwwAutolink(effects, ok3, nok) {
  const self2 = this;
  return wwwStart;
  function wwwStart(code4) {
    if (code4 !== 87 && code4 !== 119 || !previousWww.call(self2, self2.previous) || previousUnbalanced(self2.events)) {
      return nok(code4);
    }
    effects.enter("literalAutolink");
    effects.enter("literalAutolinkWww");
    return effects.check(wwwPrefix, effects.attempt(domain, effects.attempt(path, wwwAfter), nok), nok)(code4);
  }
  function wwwAfter(code4) {
    effects.exit("literalAutolinkWww");
    effects.exit("literalAutolink");
    return ok3(code4);
  }
}
function tokenizeProtocolAutolink(effects, ok3, nok) {
  const self2 = this;
  let buffer = "";
  let seen = false;
  return protocolStart;
  function protocolStart(code4) {
    if ((code4 === 72 || code4 === 104) && previousProtocol.call(self2, self2.previous) && !previousUnbalanced(self2.events)) {
      effects.enter("literalAutolink");
      effects.enter("literalAutolinkHttp");
      buffer += String.fromCodePoint(code4);
      effects.consume(code4);
      return protocolPrefixInside;
    }
    return nok(code4);
  }
  function protocolPrefixInside(code4) {
    if (asciiAlpha(code4) && buffer.length < 5) {
      buffer += String.fromCodePoint(code4);
      effects.consume(code4);
      return protocolPrefixInside;
    }
    if (code4 === 58) {
      const protocol = buffer.toLowerCase();
      if (protocol === "http" || protocol === "https") {
        effects.consume(code4);
        return protocolSlashesInside;
      }
    }
    return nok(code4);
  }
  function protocolSlashesInside(code4) {
    if (code4 === 47) {
      effects.consume(code4);
      if (seen) {
        return afterProtocol;
      }
      seen = true;
      return protocolSlashesInside;
    }
    return nok(code4);
  }
  function afterProtocol(code4) {
    return code4 === null || asciiControl(code4) || markdownLineEndingOrSpace(code4) || unicodeWhitespace(code4) || unicodePunctuation(code4) ? nok(code4) : effects.attempt(domain, effects.attempt(path, protocolAfter), nok)(code4);
  }
  function protocolAfter(code4) {
    effects.exit("literalAutolinkHttp");
    effects.exit("literalAutolink");
    return ok3(code4);
  }
}
function tokenizeWwwPrefix(effects, ok3, nok) {
  let size = 0;
  return wwwPrefixInside;
  function wwwPrefixInside(code4) {
    if ((code4 === 87 || code4 === 119) && size < 3) {
      size++;
      effects.consume(code4);
      return wwwPrefixInside;
    }
    if (code4 === 46 && size === 3) {
      effects.consume(code4);
      return wwwPrefixAfter;
    }
    return nok(code4);
  }
  function wwwPrefixAfter(code4) {
    return code4 === null ? nok(code4) : ok3(code4);
  }
}
function tokenizeDomain(effects, ok3, nok) {
  let underscoreInLastSegment;
  let underscoreInLastLastSegment;
  let seen;
  return domainInside;
  function domainInside(code4) {
    if (code4 === 46 || code4 === 95) {
      return effects.check(trail, domainAfter, domainAtPunctuation)(code4);
    }
    if (code4 === null || markdownLineEndingOrSpace(code4) || unicodeWhitespace(code4) || code4 !== 45 && unicodePunctuation(code4)) {
      return domainAfter(code4);
    }
    seen = true;
    effects.consume(code4);
    return domainInside;
  }
  function domainAtPunctuation(code4) {
    if (code4 === 95) {
      underscoreInLastSegment = true;
    } else {
      underscoreInLastLastSegment = underscoreInLastSegment;
      underscoreInLastSegment = void 0;
    }
    effects.consume(code4);
    return domainInside;
  }
  function domainAfter(code4) {
    if (underscoreInLastLastSegment || underscoreInLastSegment || !seen) {
      return nok(code4);
    }
    return ok3(code4);
  }
}
function tokenizePath(effects, ok3) {
  let sizeOpen = 0;
  let sizeClose = 0;
  return pathInside;
  function pathInside(code4) {
    if (code4 === 40) {
      sizeOpen++;
      effects.consume(code4);
      return pathInside;
    }
    if (code4 === 41 && sizeClose < sizeOpen) {
      return pathAtPunctuation(code4);
    }
    if (code4 === 33 || code4 === 34 || code4 === 38 || code4 === 39 || code4 === 41 || code4 === 42 || code4 === 44 || code4 === 46 || code4 === 58 || code4 === 59 || code4 === 60 || code4 === 63 || code4 === 93 || code4 === 95 || code4 === 126) {
      return effects.check(trail, ok3, pathAtPunctuation)(code4);
    }
    if (code4 === null || markdownLineEndingOrSpace(code4) || unicodeWhitespace(code4)) {
      return ok3(code4);
    }
    effects.consume(code4);
    return pathInside;
  }
  function pathAtPunctuation(code4) {
    if (code4 === 41) {
      sizeClose++;
    }
    effects.consume(code4);
    return pathInside;
  }
}
function tokenizeTrail(effects, ok3, nok) {
  return trail2;
  function trail2(code4) {
    if (code4 === 33 || code4 === 34 || code4 === 39 || code4 === 41 || code4 === 42 || code4 === 44 || code4 === 46 || code4 === 58 || code4 === 59 || code4 === 63 || code4 === 95 || code4 === 126) {
      effects.consume(code4);
      return trail2;
    }
    if (code4 === 38) {
      effects.consume(code4);
      return trailCharacterReferenceStart;
    }
    if (code4 === 93) {
      effects.consume(code4);
      return trailBracketAfter;
    }
    if (
      // `<` is an end.
      code4 === 60 || // So is whitespace.
      code4 === null || markdownLineEndingOrSpace(code4) || unicodeWhitespace(code4)
    ) {
      return ok3(code4);
    }
    return nok(code4);
  }
  function trailBracketAfter(code4) {
    if (code4 === null || code4 === 40 || code4 === 91 || markdownLineEndingOrSpace(code4) || unicodeWhitespace(code4)) {
      return ok3(code4);
    }
    return trail2(code4);
  }
  function trailCharacterReferenceStart(code4) {
    return asciiAlpha(code4) ? trailCharacterReferenceInside(code4) : nok(code4);
  }
  function trailCharacterReferenceInside(code4) {
    if (code4 === 59) {
      effects.consume(code4);
      return trail2;
    }
    if (asciiAlpha(code4)) {
      effects.consume(code4);
      return trailCharacterReferenceInside;
    }
    return nok(code4);
  }
}
function tokenizeEmailDomainDotTrail(effects, ok3, nok) {
  return start2;
  function start2(code4) {
    effects.consume(code4);
    return after;
  }
  function after(code4) {
    return asciiAlphanumeric(code4) ? nok(code4) : ok3(code4);
  }
}
function previousWww(code4) {
  return code4 === null || code4 === 40 || code4 === 42 || code4 === 95 || code4 === 91 || code4 === 93 || code4 === 126 || markdownLineEndingOrSpace(code4);
}
function previousProtocol(code4) {
  return !asciiAlpha(code4);
}
function previousEmail(code4) {
  return !(code4 === 47 || gfmAtext(code4));
}
function gfmAtext(code4) {
  return code4 === 43 || code4 === 45 || code4 === 46 || code4 === 95 || asciiAlphanumeric(code4);
}
function previousUnbalanced(events) {
  let index2 = events.length;
  let result = false;
  while (index2--) {
    const token = events[index2][1];
    if ((token.type === "labelLink" || token.type === "labelImage") && !token._balanced) {
      result = true;
      break;
    }
    if (token._gfmAutolinkLiteralWalkedInto) {
      result = false;
      break;
    }
  }
  if (events.length > 0 && !result) {
    events[events.length - 1][1]._gfmAutolinkLiteralWalkedInto = true;
  }
  return result;
}

// node_modules/.pnpm/micromark-extension-gfm-footnote@2.1.0/node_modules/micromark-extension-gfm-footnote/lib/syntax.js
var indent = {
  tokenize: tokenizeIndent2,
  partial: true
};
function gfmFootnote() {
  return {
    document: {
      [91]: {
        name: "gfmFootnoteDefinition",
        tokenize: tokenizeDefinitionStart,
        continuation: {
          tokenize: tokenizeDefinitionContinuation
        },
        exit: gfmFootnoteDefinitionEnd
      }
    },
    text: {
      [91]: {
        name: "gfmFootnoteCall",
        tokenize: tokenizeGfmFootnoteCall
      },
      [93]: {
        name: "gfmPotentialFootnoteCall",
        add: "after",
        tokenize: tokenizePotentialGfmFootnoteCall,
        resolveTo: resolveToPotentialGfmFootnoteCall
      }
    }
  };
}
function tokenizePotentialGfmFootnoteCall(effects, ok3, nok) {
  const self2 = this;
  let index2 = self2.events.length;
  const defined = self2.parser.gfmFootnotes || (self2.parser.gfmFootnotes = []);
  let labelStart;
  while (index2--) {
    const token = self2.events[index2][1];
    if (token.type === "labelImage") {
      labelStart = token;
      break;
    }
    if (token.type === "gfmFootnoteCall" || token.type === "labelLink" || token.type === "label" || token.type === "image" || token.type === "link") {
      break;
    }
  }
  return start2;
  function start2(code4) {
    if (!labelStart || !labelStart._balanced) {
      return nok(code4);
    }
    const id = normalizeIdentifier(self2.sliceSerialize({
      start: labelStart.end,
      end: self2.now()
    }));
    if (id.codePointAt(0) !== 94 || !defined.includes(id.slice(1))) {
      return nok(code4);
    }
    effects.enter("gfmFootnoteCallLabelMarker");
    effects.consume(code4);
    effects.exit("gfmFootnoteCallLabelMarker");
    return ok3(code4);
  }
}
function resolveToPotentialGfmFootnoteCall(events, context) {
  let index2 = events.length;
  let labelStart;
  while (index2--) {
    if (events[index2][1].type === "labelImage" && events[index2][0] === "enter") {
      labelStart = events[index2][1];
      break;
    }
  }
  events[index2 + 1][1].type = "data";
  events[index2 + 3][1].type = "gfmFootnoteCallLabelMarker";
  const call = {
    type: "gfmFootnoteCall",
    start: Object.assign({}, events[index2 + 3][1].start),
    end: Object.assign({}, events[events.length - 1][1].end)
  };
  const marker = {
    type: "gfmFootnoteCallMarker",
    start: Object.assign({}, events[index2 + 3][1].end),
    end: Object.assign({}, events[index2 + 3][1].end)
  };
  marker.end.column++;
  marker.end.offset++;
  marker.end._bufferIndex++;
  const string3 = {
    type: "gfmFootnoteCallString",
    start: Object.assign({}, marker.end),
    end: Object.assign({}, events[events.length - 1][1].start)
  };
  const chunk = {
    type: "chunkString",
    contentType: "string",
    start: Object.assign({}, string3.start),
    end: Object.assign({}, string3.end)
  };
  const replacement = [
    // Take the `labelImageMarker` (now `data`, the `!`)
    events[index2 + 1],
    events[index2 + 2],
    ["enter", call, context],
    // The `[`
    events[index2 + 3],
    events[index2 + 4],
    // The `^`.
    ["enter", marker, context],
    ["exit", marker, context],
    // Everything in between.
    ["enter", string3, context],
    ["enter", chunk, context],
    ["exit", chunk, context],
    ["exit", string3, context],
    // The ending (`]`, properly parsed and labelled).
    events[events.length - 2],
    events[events.length - 1],
    ["exit", call, context]
  ];
  events.splice(index2, events.length - index2 + 1, ...replacement);
  return events;
}
function tokenizeGfmFootnoteCall(effects, ok3, nok) {
  const self2 = this;
  const defined = self2.parser.gfmFootnotes || (self2.parser.gfmFootnotes = []);
  let size = 0;
  let data;
  return start2;
  function start2(code4) {
    effects.enter("gfmFootnoteCall");
    effects.enter("gfmFootnoteCallLabelMarker");
    effects.consume(code4);
    effects.exit("gfmFootnoteCallLabelMarker");
    return callStart;
  }
  function callStart(code4) {
    if (code4 !== 94) return nok(code4);
    effects.enter("gfmFootnoteCallMarker");
    effects.consume(code4);
    effects.exit("gfmFootnoteCallMarker");
    effects.enter("gfmFootnoteCallString");
    effects.enter("chunkString").contentType = "string";
    return callData;
  }
  function callData(code4) {
    if (
      // Too long.
      size > 999 || // Closing brace with nothing.
      code4 === 93 && !data || // Space or tab is not supported by GFM for some reason.
      // `\n` and `[` not being supported makes sense.
      code4 === null || code4 === 91 || markdownLineEndingOrSpace(code4)
    ) {
      return nok(code4);
    }
    if (code4 === 93) {
      effects.exit("chunkString");
      const token = effects.exit("gfmFootnoteCallString");
      if (!defined.includes(normalizeIdentifier(self2.sliceSerialize(token)))) {
        return nok(code4);
      }
      effects.enter("gfmFootnoteCallLabelMarker");
      effects.consume(code4);
      effects.exit("gfmFootnoteCallLabelMarker");
      effects.exit("gfmFootnoteCall");
      return ok3;
    }
    if (!markdownLineEndingOrSpace(code4)) {
      data = true;
    }
    size++;
    effects.consume(code4);
    return code4 === 92 ? callEscape : callData;
  }
  function callEscape(code4) {
    if (code4 === 91 || code4 === 92 || code4 === 93) {
      effects.consume(code4);
      size++;
      return callData;
    }
    return callData(code4);
  }
}
function tokenizeDefinitionStart(effects, ok3, nok) {
  const self2 = this;
  const defined = self2.parser.gfmFootnotes || (self2.parser.gfmFootnotes = []);
  let identifier;
  let size = 0;
  let data;
  return start2;
  function start2(code4) {
    effects.enter("gfmFootnoteDefinition")._container = true;
    effects.enter("gfmFootnoteDefinitionLabel");
    effects.enter("gfmFootnoteDefinitionLabelMarker");
    effects.consume(code4);
    effects.exit("gfmFootnoteDefinitionLabelMarker");
    return labelAtMarker;
  }
  function labelAtMarker(code4) {
    if (code4 === 94) {
      effects.enter("gfmFootnoteDefinitionMarker");
      effects.consume(code4);
      effects.exit("gfmFootnoteDefinitionMarker");
      effects.enter("gfmFootnoteDefinitionLabelString");
      effects.enter("chunkString").contentType = "string";
      return labelInside;
    }
    return nok(code4);
  }
  function labelInside(code4) {
    if (
      // Too long.
      size > 999 || // Closing brace with nothing.
      code4 === 93 && !data || // Space or tab is not supported by GFM for some reason.
      // `\n` and `[` not being supported makes sense.
      code4 === null || code4 === 91 || markdownLineEndingOrSpace(code4)
    ) {
      return nok(code4);
    }
    if (code4 === 93) {
      effects.exit("chunkString");
      const token = effects.exit("gfmFootnoteDefinitionLabelString");
      identifier = normalizeIdentifier(self2.sliceSerialize(token));
      effects.enter("gfmFootnoteDefinitionLabelMarker");
      effects.consume(code4);
      effects.exit("gfmFootnoteDefinitionLabelMarker");
      effects.exit("gfmFootnoteDefinitionLabel");
      return labelAfter;
    }
    if (!markdownLineEndingOrSpace(code4)) {
      data = true;
    }
    size++;
    effects.consume(code4);
    return code4 === 92 ? labelEscape : labelInside;
  }
  function labelEscape(code4) {
    if (code4 === 91 || code4 === 92 || code4 === 93) {
      effects.consume(code4);
      size++;
      return labelInside;
    }
    return labelInside(code4);
  }
  function labelAfter(code4) {
    if (code4 === 58) {
      effects.enter("definitionMarker");
      effects.consume(code4);
      effects.exit("definitionMarker");
      if (!defined.includes(identifier)) {
        defined.push(identifier);
      }
      return factorySpace(effects, whitespaceAfter, "gfmFootnoteDefinitionWhitespace");
    }
    return nok(code4);
  }
  function whitespaceAfter(code4) {
    return ok3(code4);
  }
}
function tokenizeDefinitionContinuation(effects, ok3, nok) {
  return effects.check(blankLine, ok3, effects.attempt(indent, ok3, nok));
}
function gfmFootnoteDefinitionEnd(effects) {
  effects.exit("gfmFootnoteDefinition");
}
function tokenizeIndent2(effects, ok3, nok) {
  const self2 = this;
  return factorySpace(effects, afterPrefix, "gfmFootnoteDefinitionIndent", 4 + 1);
  function afterPrefix(code4) {
    const tail = self2.events[self2.events.length - 1];
    return tail && tail[1].type === "gfmFootnoteDefinitionIndent" && tail[2].sliceSerialize(tail[1], true).length === 4 ? ok3(code4) : nok(code4);
  }
}

// node_modules/.pnpm/micromark-extension-gfm-strikethrough@2.1.0/node_modules/micromark-extension-gfm-strikethrough/lib/syntax.js
function gfmStrikethrough(options) {
  const options_ = options || {};
  let single = options_.singleTilde;
  const tokenizer = {
    name: "strikethrough",
    tokenize: tokenizeStrikethrough,
    resolveAll: resolveAllStrikethrough
  };
  if (single === null || single === void 0) {
    single = true;
  }
  return {
    text: {
      [126]: tokenizer
    },
    insideSpan: {
      null: [tokenizer]
    },
    attentionMarkers: {
      null: [126]
    }
  };
  function resolveAllStrikethrough(events, context) {
    let index2 = -1;
    while (++index2 < events.length) {
      if (events[index2][0] === "enter" && events[index2][1].type === "strikethroughSequenceTemporary" && events[index2][1]._close) {
        let open = index2;
        while (open--) {
          if (events[open][0] === "exit" && events[open][1].type === "strikethroughSequenceTemporary" && events[open][1]._open && // If the sizes are the same:
          events[index2][1].end.offset - events[index2][1].start.offset === events[open][1].end.offset - events[open][1].start.offset) {
            events[index2][1].type = "strikethroughSequence";
            events[open][1].type = "strikethroughSequence";
            const strikethrough2 = {
              type: "strikethrough",
              start: Object.assign({}, events[open][1].start),
              end: Object.assign({}, events[index2][1].end)
            };
            const text7 = {
              type: "strikethroughText",
              start: Object.assign({}, events[open][1].end),
              end: Object.assign({}, events[index2][1].start)
            };
            const nextEvents = [["enter", strikethrough2, context], ["enter", events[open][1], context], ["exit", events[open][1], context], ["enter", text7, context]];
            const insideSpan2 = context.parser.constructs.insideSpan.null;
            if (insideSpan2) {
              splice(nextEvents, nextEvents.length, 0, resolveAll(insideSpan2, events.slice(open + 1, index2), context));
            }
            splice(nextEvents, nextEvents.length, 0, [["exit", text7, context], ["enter", events[index2][1], context], ["exit", events[index2][1], context], ["exit", strikethrough2, context]]);
            splice(events, open - 1, index2 - open + 3, nextEvents);
            index2 = open + nextEvents.length - 2;
            break;
          }
        }
      }
    }
    index2 = -1;
    while (++index2 < events.length) {
      if (events[index2][1].type === "strikethroughSequenceTemporary") {
        events[index2][1].type = "data";
      }
    }
    return events;
  }
  function tokenizeStrikethrough(effects, ok3, nok) {
    const previous3 = this.previous;
    const events = this.events;
    let size = 0;
    return start2;
    function start2(code4) {
      if (previous3 === 126 && events[events.length - 1][1].type !== "characterEscape") {
        return nok(code4);
      }
      effects.enter("strikethroughSequenceTemporary");
      return more(code4);
    }
    function more(code4) {
      const before = classifyCharacter(previous3);
      if (code4 === 126) {
        if (size > 1) return nok(code4);
        effects.consume(code4);
        size++;
        return more;
      }
      if (size < 2 && !single) return nok(code4);
      const token = effects.exit("strikethroughSequenceTemporary");
      const after = classifyCharacter(code4);
      token._open = !after || after === 2 && Boolean(before);
      token._close = !before || before === 2 && Boolean(after);
      return ok3(code4);
    }
  }
}

// node_modules/.pnpm/micromark-extension-gfm-table@2.1.1/node_modules/micromark-extension-gfm-table/lib/edit-map.js
var EditMap = class {
  /**
   * Create a new edit map.
   */
  constructor() {
    this.map = [];
  }
  /**
   * Create an edit: a remove and/or add at a certain place.
   *
   * @param {number} index
   * @param {number} remove
   * @param {Array<Event>} add
   * @returns {undefined}
   */
  add(index2, remove, add) {
    addImplementation(this, index2, remove, add);
  }
  // To do: add this when moving to `micromark`.
  // /**
  //  * Create an edit: but insert `add` before existing additions.
  //  *
  //  * @param {number} index
  //  * @param {number} remove
  //  * @param {Array<Event>} add
  //  * @returns {undefined}
  //  */
  // addBefore(index, remove, add) {
  //   addImplementation(this, index, remove, add, true)
  // }
  /**
   * Done, change the events.
   *
   * @param {Array<Event>} events
   * @returns {undefined}
   */
  consume(events) {
    this.map.sort(function(a, b) {
      return a[0] - b[0];
    });
    if (this.map.length === 0) {
      return;
    }
    let index2 = this.map.length;
    const vecs = [];
    while (index2 > 0) {
      index2 -= 1;
      vecs.push(events.slice(this.map[index2][0] + this.map[index2][1]), this.map[index2][2]);
      events.length = this.map[index2][0];
    }
    vecs.push(events.slice());
    events.length = 0;
    let slice = vecs.pop();
    while (slice) {
      for (const element3 of slice) {
        events.push(element3);
      }
      slice = vecs.pop();
    }
    this.map.length = 0;
  }
};
function addImplementation(editMap, at, remove, add) {
  let index2 = 0;
  if (remove === 0 && add.length === 0) {
    return;
  }
  while (index2 < editMap.map.length) {
    if (editMap.map[index2][0] === at) {
      editMap.map[index2][1] += remove;
      editMap.map[index2][2].push(...add);
      return;
    }
    index2 += 1;
  }
  editMap.map.push([at, remove, add]);
}

// node_modules/.pnpm/micromark-extension-gfm-table@2.1.1/node_modules/micromark-extension-gfm-table/lib/infer.js
function gfmTableAlign(events, index2) {
  let inDelimiterRow = false;
  const align = [];
  while (index2 < events.length) {
    const event = events[index2];
    if (inDelimiterRow) {
      if (event[0] === "enter") {
        if (event[1].type === "tableContent") {
          align.push(events[index2 + 1][1].type === "tableDelimiterMarker" ? "left" : "none");
        }
      } else if (event[1].type === "tableContent") {
        if (events[index2 - 1][1].type === "tableDelimiterMarker") {
          const alignIndex = align.length - 1;
          align[alignIndex] = align[alignIndex] === "left" ? "center" : "right";
        }
      } else if (event[1].type === "tableDelimiterRow") {
        break;
      }
    } else if (event[0] === "enter" && event[1].type === "tableDelimiterRow") {
      inDelimiterRow = true;
    }
    index2 += 1;
  }
  return align;
}

// node_modules/.pnpm/micromark-extension-gfm-table@2.1.1/node_modules/micromark-extension-gfm-table/lib/syntax.js
function gfmTable() {
  return {
    flow: {
      null: {
        name: "table",
        tokenize: tokenizeTable,
        resolveAll: resolveTable
      }
    }
  };
}
function tokenizeTable(effects, ok3, nok) {
  const self2 = this;
  let size = 0;
  let sizeB = 0;
  let seen;
  return start2;
  function start2(code4) {
    let index2 = self2.events.length - 1;
    while (index2 > -1) {
      const type = self2.events[index2][1].type;
      if (type === "lineEnding" || // Note: markdown-rs uses `whitespace` instead of `linePrefix`
      type === "linePrefix") index2--;
      else break;
    }
    const tail = index2 > -1 ? self2.events[index2][1].type : null;
    const next = tail === "tableHead" || tail === "tableRow" ? bodyRowStart : headRowBefore;
    if (next === bodyRowStart && self2.parser.lazy[self2.now().line]) {
      return nok(code4);
    }
    return next(code4);
  }
  function headRowBefore(code4) {
    effects.enter("tableHead");
    effects.enter("tableRow");
    return headRowStart(code4);
  }
  function headRowStart(code4) {
    if (code4 === 124) {
      return headRowBreak(code4);
    }
    seen = true;
    sizeB += 1;
    return headRowBreak(code4);
  }
  function headRowBreak(code4) {
    if (code4 === null) {
      return nok(code4);
    }
    if (markdownLineEnding(code4)) {
      if (sizeB > 1) {
        sizeB = 0;
        self2.interrupt = true;
        effects.exit("tableRow");
        effects.enter("lineEnding");
        effects.consume(code4);
        effects.exit("lineEnding");
        return headDelimiterStart;
      }
      return nok(code4);
    }
    if (markdownSpace(code4)) {
      return factorySpace(effects, headRowBreak, "whitespace")(code4);
    }
    sizeB += 1;
    if (seen) {
      seen = false;
      size += 1;
    }
    if (code4 === 124) {
      effects.enter("tableCellDivider");
      effects.consume(code4);
      effects.exit("tableCellDivider");
      seen = true;
      return headRowBreak;
    }
    effects.enter("data");
    return headRowData(code4);
  }
  function headRowData(code4) {
    if (code4 === null || code4 === 124 || markdownLineEndingOrSpace(code4)) {
      effects.exit("data");
      return headRowBreak(code4);
    }
    effects.consume(code4);
    return code4 === 92 ? headRowEscape : headRowData;
  }
  function headRowEscape(code4) {
    if (code4 === 92 || code4 === 124) {
      effects.consume(code4);
      return headRowData;
    }
    return headRowData(code4);
  }
  function headDelimiterStart(code4) {
    self2.interrupt = false;
    if (self2.parser.lazy[self2.now().line]) {
      return nok(code4);
    }
    effects.enter("tableDelimiterRow");
    seen = false;
    if (markdownSpace(code4)) {
      return factorySpace(effects, headDelimiterBefore, "linePrefix", self2.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(code4);
    }
    return headDelimiterBefore(code4);
  }
  function headDelimiterBefore(code4) {
    if (code4 === 45 || code4 === 58) {
      return headDelimiterValueBefore(code4);
    }
    if (code4 === 124) {
      seen = true;
      effects.enter("tableCellDivider");
      effects.consume(code4);
      effects.exit("tableCellDivider");
      return headDelimiterCellBefore;
    }
    return headDelimiterNok(code4);
  }
  function headDelimiterCellBefore(code4) {
    if (markdownSpace(code4)) {
      return factorySpace(effects, headDelimiterValueBefore, "whitespace")(code4);
    }
    return headDelimiterValueBefore(code4);
  }
  function headDelimiterValueBefore(code4) {
    if (code4 === 58) {
      sizeB += 1;
      seen = true;
      effects.enter("tableDelimiterMarker");
      effects.consume(code4);
      effects.exit("tableDelimiterMarker");
      return headDelimiterLeftAlignmentAfter;
    }
    if (code4 === 45) {
      sizeB += 1;
      return headDelimiterLeftAlignmentAfter(code4);
    }
    if (code4 === null || markdownLineEnding(code4)) {
      return headDelimiterCellAfter(code4);
    }
    return headDelimiterNok(code4);
  }
  function headDelimiterLeftAlignmentAfter(code4) {
    if (code4 === 45) {
      effects.enter("tableDelimiterFiller");
      return headDelimiterFiller(code4);
    }
    return headDelimiterNok(code4);
  }
  function headDelimiterFiller(code4) {
    if (code4 === 45) {
      effects.consume(code4);
      return headDelimiterFiller;
    }
    if (code4 === 58) {
      seen = true;
      effects.exit("tableDelimiterFiller");
      effects.enter("tableDelimiterMarker");
      effects.consume(code4);
      effects.exit("tableDelimiterMarker");
      return headDelimiterRightAlignmentAfter;
    }
    effects.exit("tableDelimiterFiller");
    return headDelimiterRightAlignmentAfter(code4);
  }
  function headDelimiterRightAlignmentAfter(code4) {
    if (markdownSpace(code4)) {
      return factorySpace(effects, headDelimiterCellAfter, "whitespace")(code4);
    }
    return headDelimiterCellAfter(code4);
  }
  function headDelimiterCellAfter(code4) {
    if (code4 === 124) {
      return headDelimiterBefore(code4);
    }
    if (code4 === null || markdownLineEnding(code4)) {
      if (!seen || size !== sizeB) {
        return headDelimiterNok(code4);
      }
      effects.exit("tableDelimiterRow");
      effects.exit("tableHead");
      return ok3(code4);
    }
    return headDelimiterNok(code4);
  }
  function headDelimiterNok(code4) {
    return nok(code4);
  }
  function bodyRowStart(code4) {
    effects.enter("tableRow");
    return bodyRowBreak(code4);
  }
  function bodyRowBreak(code4) {
    if (code4 === 124) {
      effects.enter("tableCellDivider");
      effects.consume(code4);
      effects.exit("tableCellDivider");
      return bodyRowBreak;
    }
    if (code4 === null || markdownLineEnding(code4)) {
      effects.exit("tableRow");
      return ok3(code4);
    }
    if (markdownSpace(code4)) {
      return factorySpace(effects, bodyRowBreak, "whitespace")(code4);
    }
    effects.enter("data");
    return bodyRowData(code4);
  }
  function bodyRowData(code4) {
    if (code4 === null || code4 === 124 || markdownLineEndingOrSpace(code4)) {
      effects.exit("data");
      return bodyRowBreak(code4);
    }
    effects.consume(code4);
    return code4 === 92 ? bodyRowEscape : bodyRowData;
  }
  function bodyRowEscape(code4) {
    if (code4 === 92 || code4 === 124) {
      effects.consume(code4);
      return bodyRowData;
    }
    return bodyRowData(code4);
  }
}
function resolveTable(events, context) {
  let index2 = -1;
  let inFirstCellAwaitingPipe = true;
  let rowKind = 0;
  let lastCell = [0, 0, 0, 0];
  let cell = [0, 0, 0, 0];
  let afterHeadAwaitingFirstBodyRow = false;
  let lastTableEnd = 0;
  let currentTable;
  let currentBody;
  let currentCell;
  const map3 = new EditMap();
  while (++index2 < events.length) {
    const event = events[index2];
    const token = event[1];
    if (event[0] === "enter") {
      if (token.type === "tableHead") {
        afterHeadAwaitingFirstBodyRow = false;
        if (lastTableEnd !== 0) {
          flushTableEnd(map3, context, lastTableEnd, currentTable, currentBody);
          currentBody = void 0;
          lastTableEnd = 0;
        }
        currentTable = {
          type: "table",
          start: Object.assign({}, token.start),
          // Note: correct end is set later.
          end: Object.assign({}, token.end)
        };
        map3.add(index2, 0, [["enter", currentTable, context]]);
      } else if (token.type === "tableRow" || token.type === "tableDelimiterRow") {
        inFirstCellAwaitingPipe = true;
        currentCell = void 0;
        lastCell = [0, 0, 0, 0];
        cell = [0, index2 + 1, 0, 0];
        if (afterHeadAwaitingFirstBodyRow) {
          afterHeadAwaitingFirstBodyRow = false;
          currentBody = {
            type: "tableBody",
            start: Object.assign({}, token.start),
            // Note: correct end is set later.
            end: Object.assign({}, token.end)
          };
          map3.add(index2, 0, [["enter", currentBody, context]]);
        }
        rowKind = token.type === "tableDelimiterRow" ? 2 : currentBody ? 3 : 1;
      } else if (rowKind && (token.type === "data" || token.type === "tableDelimiterMarker" || token.type === "tableDelimiterFiller")) {
        inFirstCellAwaitingPipe = false;
        if (cell[2] === 0) {
          if (lastCell[1] !== 0) {
            cell[0] = cell[1];
            currentCell = flushCell(map3, context, lastCell, rowKind, void 0, currentCell);
            lastCell = [0, 0, 0, 0];
          }
          cell[2] = index2;
        }
      } else if (token.type === "tableCellDivider") {
        if (inFirstCellAwaitingPipe) {
          inFirstCellAwaitingPipe = false;
        } else {
          if (lastCell[1] !== 0) {
            cell[0] = cell[1];
            currentCell = flushCell(map3, context, lastCell, rowKind, void 0, currentCell);
          }
          lastCell = cell;
          cell = [lastCell[1], index2, 0, 0];
        }
      }
    } else if (token.type === "tableHead") {
      afterHeadAwaitingFirstBodyRow = true;
      lastTableEnd = index2;
    } else if (token.type === "tableRow" || token.type === "tableDelimiterRow") {
      lastTableEnd = index2;
      if (lastCell[1] !== 0) {
        cell[0] = cell[1];
        currentCell = flushCell(map3, context, lastCell, rowKind, index2, currentCell);
      } else if (cell[1] !== 0) {
        currentCell = flushCell(map3, context, cell, rowKind, index2, currentCell);
      }
      rowKind = 0;
    } else if (rowKind && (token.type === "data" || token.type === "tableDelimiterMarker" || token.type === "tableDelimiterFiller")) {
      cell[3] = index2;
    }
  }
  if (lastTableEnd !== 0) {
    flushTableEnd(map3, context, lastTableEnd, currentTable, currentBody);
  }
  map3.consume(context.events);
  index2 = -1;
  while (++index2 < context.events.length) {
    const event = context.events[index2];
    if (event[0] === "enter" && event[1].type === "table") {
      event[1]._align = gfmTableAlign(context.events, index2);
    }
  }
  return events;
}
function flushCell(map3, context, range, rowKind, rowEnd, previousCell) {
  const groupName = rowKind === 1 ? "tableHeader" : rowKind === 2 ? "tableDelimiter" : "tableData";
  const valueName = "tableContent";
  if (range[0] !== 0) {
    previousCell.end = Object.assign({}, getPoint(context.events, range[0]));
    map3.add(range[0], 0, [["exit", previousCell, context]]);
  }
  const now = getPoint(context.events, range[1]);
  previousCell = {
    type: groupName,
    start: Object.assign({}, now),
    // Note: correct end is set later.
    end: Object.assign({}, now)
  };
  map3.add(range[1], 0, [["enter", previousCell, context]]);
  if (range[2] !== 0) {
    const relatedStart = getPoint(context.events, range[2]);
    const relatedEnd = getPoint(context.events, range[3]);
    const valueToken = {
      type: valueName,
      start: Object.assign({}, relatedStart),
      end: Object.assign({}, relatedEnd)
    };
    map3.add(range[2], 0, [["enter", valueToken, context]]);
    if (rowKind !== 2) {
      const start2 = context.events[range[2]];
      const end = context.events[range[3]];
      start2[1].end = Object.assign({}, end[1].end);
      start2[1].type = "chunkText";
      start2[1].contentType = "text";
      if (range[3] > range[2] + 1) {
        const a = range[2] + 1;
        const b = range[3] - range[2] - 1;
        map3.add(a, b, []);
      }
    }
    map3.add(range[3] + 1, 0, [["exit", valueToken, context]]);
  }
  if (rowEnd !== void 0) {
    previousCell.end = Object.assign({}, getPoint(context.events, rowEnd));
    map3.add(rowEnd, 0, [["exit", previousCell, context]]);
    previousCell = void 0;
  }
  return previousCell;
}
function flushTableEnd(map3, context, index2, table2, tableBody) {
  const exits = [];
  const related = getPoint(context.events, index2);
  if (tableBody) {
    tableBody.end = Object.assign({}, related);
    exits.push(["exit", tableBody, context]);
  }
  table2.end = Object.assign({}, related);
  exits.push(["exit", table2, context]);
  map3.add(index2 + 1, 0, exits);
}
function getPoint(events, index2) {
  const event = events[index2];
  const side = event[0] === "enter" ? "start" : "end";
  return event[1][side];
}

// node_modules/.pnpm/micromark-extension-gfm-task-list-item@2.1.0/node_modules/micromark-extension-gfm-task-list-item/lib/syntax.js
var tasklistCheck = {
  name: "tasklistCheck",
  tokenize: tokenizeTasklistCheck
};
function gfmTaskListItem() {
  return {
    text: {
      [91]: tasklistCheck
    }
  };
}
function tokenizeTasklistCheck(effects, ok3, nok) {
  const self2 = this;
  return open;
  function open(code4) {
    if (
      // Exit if there’s stuff before.
      self2.previous !== null || // Exit if not in the first content that is the first child of a list
      // item.
      !self2._gfmTasklistFirstContentOfListItem
    ) {
      return nok(code4);
    }
    effects.enter("taskListCheck");
    effects.enter("taskListCheckMarker");
    effects.consume(code4);
    effects.exit("taskListCheckMarker");
    return inside;
  }
  function inside(code4) {
    if (markdownLineEndingOrSpace(code4)) {
      effects.enter("taskListCheckValueUnchecked");
      effects.consume(code4);
      effects.exit("taskListCheckValueUnchecked");
      return close;
    }
    if (code4 === 88 || code4 === 120) {
      effects.enter("taskListCheckValueChecked");
      effects.consume(code4);
      effects.exit("taskListCheckValueChecked");
      return close;
    }
    return nok(code4);
  }
  function close(code4) {
    if (code4 === 93) {
      effects.enter("taskListCheckMarker");
      effects.consume(code4);
      effects.exit("taskListCheckMarker");
      effects.exit("taskListCheck");
      return after;
    }
    return nok(code4);
  }
  function after(code4) {
    if (markdownLineEnding(code4)) {
      return ok3(code4);
    }
    if (markdownSpace(code4)) {
      return effects.check({
        tokenize: spaceThenNonSpace
      }, ok3, nok)(code4);
    }
    return nok(code4);
  }
}
function spaceThenNonSpace(effects, ok3, nok) {
  return factorySpace(effects, after, "whitespace");
  function after(code4) {
    return code4 === null ? nok(code4) : ok3(code4);
  }
}

// node_modules/.pnpm/micromark-extension-gfm@3.0.0/node_modules/micromark-extension-gfm/index.js
function gfm(options) {
  return combineExtensions([
    gfmAutolinkLiteral(),
    gfmFootnote(),
    gfmStrikethrough(options),
    gfmTable(),
    gfmTaskListItem()
  ]);
}

// node_modules/.pnpm/remark-gfm@4.0.1/node_modules/remark-gfm/lib/index.js
var emptyOptions4 = {};
function remarkGfm(options) {
  const self2 = (
    /** @type {Processor<Root>} */
    this
  );
  const settings = options || emptyOptions4;
  const data = self2.data();
  const micromarkExtensions = data.micromarkExtensions || (data.micromarkExtensions = []);
  const fromMarkdownExtensions = data.fromMarkdownExtensions || (data.fromMarkdownExtensions = []);
  const toMarkdownExtensions = data.toMarkdownExtensions || (data.toMarkdownExtensions = []);
  micromarkExtensions.push(gfm(settings));
  fromMarkdownExtensions.push(gfmFromMarkdown());
  toMarkdownExtensions.push(gfmToMarkdown(settings));
}

// packages/desktop/ui/src/components/MarkdownInlineCode.tsx
init_neon_pilot_shared_react();
function extractMarkdownTextContent(children) {
  let text7 = "";
  Children.forEach(children, (child) => {
    if (typeof child === "string" || typeof child === "number" || typeof child === "bigint") {
      text7 += String(child);
      return;
    }
    if (!isValidElement(child)) {
      return;
    }
    const props = child.props;
    if (props.children !== void 0) {
      text7 += extractMarkdownTextContent(props.children);
    }
  });
  return text7;
}
function InlineMarkdownCode({
  className,
  children,
  inlineCodeClassName
}) {
  const content3 = extractMarkdownTextContent(children).replace(/\n$/, "");
  const isBlock = content3.includes("\n") || Boolean(className?.includes("language-"));
  if (!isBlock) {
    return /* @__PURE__ */ jsx(InlineCode, { className: inlineCodeClassName, children: content3 });
  }
  return /* @__PURE__ */ jsx("code", { className, children: content3 });
}

// packages/desktop/ui/src/components/chat/transcriptPathLinks.ts
var FILE_PATH_TRAILING_PUNCTUATION = /[),.;:!?\]}>]+$/;
var FILE_PATH_WITH_LINE_SUFFIX = /^(.+?)(?::\d+(?::\d+)?)?$/;
function trimTranscriptPathToken(value) {
  return value.trim().replace(FILE_PATH_TRAILING_PUNCTUATION, "");
}
function normalizeTranscriptPathTarget(value) {
  const trimmed = trimTranscriptPathToken(value);
  return trimmed.match(FILE_PATH_WITH_LINE_SUFFIX)?.[1] ?? trimmed;
}
function looksLikeTranscriptPath(value) {
  const normalized = normalizeTranscriptPathTarget(value);
  if (!normalized || normalized.endsWith("/")) {
    return false;
  }
  if (/^(?:https?|file):\/\//i.test(normalized) || normalized.startsWith("//")) {
    return false;
  }
  if (/^(?:\/|~\/|\.{1,2}\/)/.test(normalized)) {
    return normalized.includes("/");
  }
  return /^[A-Za-z0-9_.+-]+(?:\/[A-Za-z0-9_.+-]+)+$/.test(normalized) && /\/[^/\s]+\.[A-Za-z0-9][A-Za-z0-9_-]*$/.test(normalized);
}
function readKnowledgeBaseFileIdFromPath(value) {
  const normalized = trimTranscriptPathToken(value);
  const marker = "/knowledge-base/repo/";
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex < 0 || normalized.endsWith("/")) {
    return null;
  }
  const fileId = normalized.slice(markerIndex + marker.length);
  return fileId && !fileId.endsWith("/") ? fileId : null;
}

// packages/desktop/ui/src/components/chat/MarkdownMessage.tsx
var MARKDOWN_REMARK_PLUGINS = [remarkGfm, remarkBreaks];
function MentionPill({ text: text7 }) {
  return /* @__PURE__ */ jsx("span", { className: "ui-markdown-mention", children: text7 });
}
function looksLikeCommitHash(value) {
  const normalized = value.trim();
  return /^[a-f0-9]{7,64}$/i.test(normalized) && /[a-f]/i.test(normalized);
}
function CommitHashButton({ hash, onOpenCheckpoint }) {
  if (!onOpenCheckpoint) {
    return /* @__PURE__ */ jsx(InlineCode, { children: hash });
  }
  return /* @__PURE__ */ jsx(
    InlineCodeButton,
    {
      onClick: () => onOpenCheckpoint(hash),
      "aria-label": `Open diff for commit ${hash}`,
      title: `Open diff for commit ${hash}`,
      children: hash
    }
  );
}
function KnowledgeFileLink({ path: path2, fileId, onOpenFilePath }) {
  if (!onOpenFilePath) {
    return /* @__PURE__ */ jsx(neon_pilot_shared_react_default.Fragment, { children: path2 });
  }
  const href = `/knowledge?file=${encodeURIComponent(fileId)}`;
  return /* @__PURE__ */ jsx(
    "a",
    {
      href,
      className: "font-mono text-[0.82em] text-accent underline decoration-accent/35 underline-offset-2 transition-colors hover:decoration-accent",
      title: `Open ${fileId} in Knowledge`,
      onClick: (event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
          return;
        }
        event.preventDefault();
        onOpenFilePath(`/knowledge-base/repo/${fileId}`);
      },
      children: path2
    }
  );
}
function FilePathLink({ path: path2, targetPath, onOpenFilePath }) {
  if (!onOpenFilePath) {
    return /* @__PURE__ */ jsx(neon_pilot_shared_react_default.Fragment, { children: path2 });
  }
  return /* @__PURE__ */ jsx(
    "a",
    {
      href: `file://${encodeURI(targetPath)}`,
      className: "font-mono text-[0.82em] text-accent underline decoration-accent/35 underline-offset-2 transition-colors hover:decoration-accent",
      title: `Open ${targetPath}`,
      onClick: (event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
          return;
        }
        event.preventDefault();
        onOpenFilePath(targetPath);
      },
      children: path2
    }
  );
}
function splitEnhancedTextFragments(text7) {
  const fragments = [];
  const tokenRegex = /\/[^\s`<>]*knowledge-base\/repo\/[^\s`<>]+|(?:~?\/|\.{1,2}\/)[^\s`<>]+|[A-Za-z0-9_.+-]+(?:\/[A-Za-z0-9_.+-]+)+(?::\d+(?::\d+)?)?|@[A-Za-z0-9_][A-Za-z0-9_./-]*|[A-Fa-f0-9]{7,64}/g;
  let cursor = 0;
  let match = null;
  while ((match = tokenRegex.exec(text7)) !== null) {
    const rawToken = match[0];
    const start2 = match.index;
    const previous3 = start2 > 0 ? text7[start2 - 1] : "";
    const knowledgeFileId = rawToken.startsWith("/") ? readKnowledgeBaseFileIdFromPath(rawToken) : null;
    if (knowledgeFileId) {
      const path2 = trimTranscriptPathToken(rawToken);
      if (start2 > cursor) {
        fragments.push({ text: text7.slice(cursor, start2), kind: "text" });
      }
      fragments.push({ text: path2, kind: "knowledge-file", fileId: knowledgeFileId });
      cursor = start2 + path2.length;
      continue;
    }
    if (looksLikeTranscriptPath(rawToken)) {
      const path2 = trimTranscriptPathToken(rawToken);
      const targetPath = normalizeTranscriptPathTarget(path2);
      if (start2 > cursor) {
        fragments.push({ text: text7.slice(cursor, start2), kind: "text" });
      }
      fragments.push({ text: path2, kind: "file-path", targetPath });
      cursor = start2 + path2.length;
      continue;
    }
    if (rawToken.startsWith("@")) {
      const mention = trimTranscriptPathToken(rawToken);
      const end2 = start2 + mention.length;
      const shouldSkip3 = start2 > 0 && /[\w./+-]/.test(previous3);
      if (shouldSkip3 || mention === "@") {
        continue;
      }
      if (start2 > cursor) {
        fragments.push({ text: text7.slice(cursor, start2), kind: "text" });
      }
      fragments.push({ text: mention, kind: "mention" });
      cursor = end2;
      continue;
    }
    const end = start2 + rawToken.length;
    const next = end < text7.length ? text7[end] : "";
    const shouldSkip2 = start2 > 0 && /[\w./+-]/.test(previous3) || end < text7.length && /[\w./+-]/.test(next) || !looksLikeCommitHash(rawToken);
    if (shouldSkip2) {
      continue;
    }
    if (start2 > cursor) {
      fragments.push({ text: text7.slice(cursor, start2), kind: "text" });
    }
    fragments.push({ text: rawToken, kind: "commit" });
    cursor = end;
  }
  if (cursor < text7.length) {
    fragments.push({ text: text7.slice(cursor), kind: "text" });
  }
  return fragments;
}
function renderEnhancedTextFragments(text7, options) {
  return splitEnhancedTextFragments(text7).map((fragment, index2) => {
    if (fragment.kind === "mention") {
      return /* @__PURE__ */ jsx(MentionPill, { text: fragment.text }, `${fragment.text}-${index2}`);
    }
    if (fragment.kind === "commit") {
      return /* @__PURE__ */ jsx(CommitHashButton, { hash: fragment.text, onOpenCheckpoint: options?.onOpenCheckpoint }, `${fragment.text}-${index2}`);
    }
    if (fragment.kind === "knowledge-file" && fragment.fileId) {
      return /* @__PURE__ */ jsx(
        KnowledgeFileLink,
        {
          path: fragment.text,
          fileId: fragment.fileId,
          onOpenFilePath: options?.onOpenFilePath
        },
        `${fragment.text}-${index2}`
      );
    }
    if (fragment.kind === "file-path" && fragment.targetPath && options?.validatedFilePathTargets?.has(fragment.targetPath)) {
      return /* @__PURE__ */ jsx(
        FilePathLink,
        {
          path: fragment.text,
          targetPath: fragment.targetPath,
          onOpenFilePath: options?.onOpenFilePath
        },
        `${fragment.text}-${index2}`
      );
    }
    return /* @__PURE__ */ jsx(neon_pilot_shared_react_default.Fragment, { children: fragment.text }, `${index2}-${fragment.text}`);
  });
}
function getMarkdownTagName(node2) {
  if (!isValidElement(node2)) {
    return null;
  }
  const props = node2.props;
  if (typeof props.node?.tagName === "string") {
    return props.node.tagName;
  }
  return typeof node2.type === "string" ? node2.type : null;
}
function findMarkdownCodeElement(node2) {
  if (!isValidElement(node2)) {
    return null;
  }
  if (getMarkdownTagName(node2) === "code") {
    return node2;
  }
  const props = node2.props;
  if (props.children === void 0) {
    return null;
  }
  for (const child of Children.toArray(props.children)) {
    const codeElement = findMarkdownCodeElement(child);
    if (codeElement) {
      return codeElement;
    }
  }
  return null;
}
function extractMarkdownCodeBlock(children) {
  for (const child of Children.toArray(children)) {
    const codeElement = findMarkdownCodeElement(child);
    if (!codeElement) {
      continue;
    }
    const props = codeElement.props;
    return {
      className: props.className,
      content: extractMarkdownTextContent(props.children).replace(/\n$/, "")
    };
  }
  return { content: extractMarkdownTextContent(children).replace(/\n$/, "") };
}
function renderChildrenWithEnhancements(children, options) {
  return Children.map(children, (child, index2) => {
    if (typeof child === "string") {
      return /* @__PURE__ */ jsx(neon_pilot_shared_react_default.Fragment, { children: renderEnhancedTextFragments(child, options) }, index2);
    }
    if (typeof child === "number" || typeof child === "bigint") {
      return child;
    }
    if (!isValidElement(child)) {
      return child;
    }
    const tagName = getMarkdownTagName(child);
    if (tagName && ["a", "code", "pre"].includes(tagName)) {
      return child;
    }
    const props = child.props;
    if (props.children === void 0) {
      return child;
    }
    return cloneElement(
      child,
      void 0,
      renderChildrenWithEnhancements(props.children, options)
    );
  });
}
function MarkdownCodeBlock({ children }) {
  const { content: content3 } = extractMarkdownCodeBlock(children);
  return /* @__PURE__ */ jsx("div", { className: "ui-markdown-code-block", children: /* @__PURE__ */ jsx("pre", { className: "whitespace-pre-wrap break-all", children: /* @__PURE__ */ jsx("code", { children: content3 }) }) });
}
function MarkdownInlineCodeWithCommitHash({
  className,
  children,
  onOpenCheckpoint,
  onOpenFilePath,
  validatedFilePathTargets
}) {
  const content3 = extractMarkdownTextContent(children).replace(/\n$/, "");
  const isBlock = content3.includes("\n") || Boolean(className?.includes("language-"));
  if (!isBlock && looksLikeCommitHash(content3)) {
    return /* @__PURE__ */ jsx(CommitHashButton, { hash: content3, onOpenCheckpoint });
  }
  const knowledgeFileId = !isBlock ? readKnowledgeBaseFileIdFromPath(content3) : null;
  if (knowledgeFileId && onOpenFilePath) {
    return /* @__PURE__ */ jsx(KnowledgeFileLink, { path: content3, fileId: knowledgeFileId, onOpenFilePath });
  }
  if (!isBlock && onOpenFilePath && looksLikeTranscriptPath(content3)) {
    const targetPath = normalizeTranscriptPathTarget(content3);
    if (validatedFilePathTargets?.has(targetPath)) {
      return /* @__PURE__ */ jsx(FilePathLink, { path: content3, targetPath, onOpenFilePath });
    }
  }
  return /* @__PURE__ */ jsx(InlineMarkdownCode, { className, children });
}
var MarkdownText = memo(function MarkdownText2({
  text: text7,
  onOpenFilePath,
  onOpenCheckpoint,
  validatedFilePathTargets
}) {
  const footnoteId = useId();
  const footnotePrefix = `chat-${footnoteId.replace(/[^a-zA-Z0-9_-]+/g, "-")}-`;
  return /* @__PURE__ */ jsx("div", { className: "ui-markdown", children: /* @__PURE__ */ jsx(
    Markdown,
    {
      remarkPlugins: MARKDOWN_REMARK_PLUGINS,
      remarkRehypeOptions: { clobberPrefix: footnotePrefix },
      components: {
        h1: ({ children, node: _node, ...props }) => /* @__PURE__ */ jsx("h1", { ...props, children: renderChildrenWithEnhancements(children, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets }) }),
        h2: ({ children, node: _node, ...props }) => /* @__PURE__ */ jsx("h2", { ...props, children: renderChildrenWithEnhancements(children, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets }) }),
        h3: ({ children, node: _node, ...props }) => /* @__PURE__ */ jsx("h3", { ...props, children: renderChildrenWithEnhancements(children, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets }) }),
        h4: ({ children, node: _node, ...props }) => /* @__PURE__ */ jsx("h4", { ...props, children: renderChildrenWithEnhancements(children, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets }) }),
        h5: ({ children, node: _node, ...props }) => /* @__PURE__ */ jsx("h5", { ...props, children: renderChildrenWithEnhancements(children, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets }) }),
        h6: ({ children, node: _node, ...props }) => /* @__PURE__ */ jsx("h6", { ...props, children: renderChildrenWithEnhancements(children, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets }) }),
        p: ({ children, node: _node, ...props }) => /* @__PURE__ */ jsx("p", { ...props, children: renderChildrenWithEnhancements(children, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets }) }),
        li: ({ children, node: _node, ...props }) => /* @__PURE__ */ jsx("li", { ...props, children: renderChildrenWithEnhancements(children, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets }) }),
        th: ({ children, node: _node, ...props }) => /* @__PURE__ */ jsx("th", { ...props, children: renderChildrenWithEnhancements(children, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets }) }),
        td: ({ children, node: _node, ...props }) => /* @__PURE__ */ jsx("td", { ...props, children: renderChildrenWithEnhancements(children, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets }) }),
        a: ({ href, children, title }) => {
          if (typeof href !== "string" || href.trim().length === 0) {
            return /* @__PURE__ */ jsx("span", { title, children });
          }
          if (href.startsWith("#")) {
            return /* @__PURE__ */ jsx("a", { href, title, children });
          }
          const isExternal = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
          if (!isExternal) {
            return /* @__PURE__ */ jsx("span", { title, children });
          }
          return /* @__PURE__ */ jsx("a", { href, title, target: "_blank", rel: "noreferrer", children });
        },
        table: ({ children }) => /* @__PURE__ */ jsx("div", { className: "my-3 min-w-0 max-w-full overflow-x-auto", children: /* @__PURE__ */ jsx("table", { children }) }),
        pre: ({ children }) => /* @__PURE__ */ jsx(MarkdownCodeBlock, { children }),
        code: ({ className, children }) => /* @__PURE__ */ jsx(
          MarkdownInlineCodeWithCommitHash,
          {
            className,
            onOpenFilePath,
            onOpenCheckpoint,
            validatedFilePathTargets,
            children
          }
        ),
        img: ({ src, alt, title }) => src ? /* @__PURE__ */ jsx("img", { src, alt: alt ?? "", title, loading: "lazy" }) : /* @__PURE__ */ jsx("span", { className: "text-dim", children: alt ?? "image" }),
        input: ({ type, checked }) => {
          if (type === "checkbox") {
            return /* @__PURE__ */ jsx(
              Checkbox,
              {
                checked: Boolean(checked),
                disabled: true,
                readOnly: true,
                className: "mr-2 translate-y-[1px] accent-[rgb(var(--color-accent))]"
              }
            );
          }
          return /* @__PURE__ */ jsx(Fragment2, { children: /* @__PURE__ */ jsx("input", { type, checked, readOnly: true, disabled: true }) });
        }
      },
      children: text7
    }
  ) });
});
function renderMarkdownText(text7, options) {
  return /* @__PURE__ */ jsx(
    MarkdownText,
    {
      text: text7,
      onOpenFilePath: options?.onOpenFilePath,
      onOpenCheckpoint: options?.onOpenCheckpoint,
      validatedFilePathTargets: options?.validatedFilePathTargets
    }
  );
}
var STREAMING_MARKDOWN_UPDATE_INTERVAL_MS = 100;
function useThrottledStreamingMarkdownText(text7) {
  const [renderedText, setRenderedText] = useState(text7);
  const latestTextRef = useRef(text7);
  const lastRenderedAtRef = useRef(0);
  useEffect(() => {
    latestTextRef.current = text7;
    const now = Date.now();
    const elapsed = now - lastRenderedAtRef.current;
    if (elapsed >= STREAMING_MARKDOWN_UPDATE_INTERVAL_MS) {
      lastRenderedAtRef.current = now;
      setRenderedText(text7);
      return void 0;
    }
    const timeout = window.setTimeout(() => {
      lastRenderedAtRef.current = Date.now();
      setRenderedText(latestTextRef.current);
    }, STREAMING_MARKDOWN_UPDATE_INTERVAL_MS - elapsed);
    return () => window.clearTimeout(timeout);
  }, [text7]);
  return renderedText;
}
function StreamingMarkdownText({
  text: text7,
  onOpenFilePath,
  onOpenCheckpoint,
  validatedFilePathTargets
}) {
  const renderedText = useThrottledStreamingMarkdownText(text7);
  return renderMarkdownText(renderedText, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets });
}
function renderStreamingMarkdownText(text7, options) {
  return /* @__PURE__ */ jsx(StreamingMarkdownText, { text: text7, ...options });
}
function parseSkillContentSections(content3) {
  const match = content3.match(/^References are relative to (.+?)\.\n\n([\s\S]*)$/);
  if (!match) {
    return { relativeTo: null, body: content3.trim() };
  }
  return {
    relativeTo: match[1] ?? null,
    body: (match[2] ?? "").trim()
  };
}
function SkillInvocationCard({
  skillBlock,
  className,
  onOpenFilePath,
  validatedFilePathTargets
}) {
  const { relativeTo, body } = parseSkillContentSections(skillBlock.content);
  return /* @__PURE__ */ jsxs(
    Disclosure,
    {
      className: cx("ui-skill-invocation", className),
      summaryClassName: "ui-skill-invocation-summary",
      bodyClassName: "ui-skill-invocation-body",
      summary: /* @__PURE__ */ jsxs(Fragment2, { children: [
        /* @__PURE__ */ jsx("span", { className: "ui-skill-invocation-label", children: "skill" }),
        /* @__PURE__ */ jsx("span", { className: "ui-skill-invocation-name", children: skillBlock.name })
      ] }),
      children: [
        relativeTo && /* @__PURE__ */ jsxs("p", { className: "ui-skill-invocation-meta", children: [
          "References resolve relative to ",
          relativeTo
        ] }),
        renderMarkdownText(`**${skillBlock.name}**

${body}`, { onOpenFilePath, validatedFilePathTargets })
      ]
    }
  );
}
function renderSkillAwareText(text7, options) {
  const skillBlock = parseSkillBlock(text7);
  if (!skillBlock) {
    return renderMarkdownText(text7, options);
  }
  return /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
    /* @__PURE__ */ jsx(
      SkillInvocationCard,
      {
        skillBlock,
        onOpenFilePath: options?.onOpenFilePath,
        validatedFilePathTargets: options?.validatedFilePathTargets
      }
    ),
    skillBlock.userMessage && renderMarkdownText(skillBlock.userMessage, options)
  ] });
}
function renderText(text7, options) {
  return renderSkillAwareText(text7, options);
}

// packages/desktop/ui/src/components/chat/MessageActions.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/extensions/nativeClientWorkbench.ts
function browserSessionKey(tabId) {
  return tabId ? `workbench-browser:${tabId}` : null;
}
function requireDesktopBridge() {
  const bridge = getDesktopBridge();
  if (!bridge) throw new Error("Browser primitives are only available in the Electron desktop app.");
  return bridge;
}
var detailStateByExtensionSurface = /* @__PURE__ */ new Map();
function detailStateKey(extensionId, surfaceId) {
  return `${extensionId}:${surfaceId}`;
}
function createNativeWorkbenchClient(extensionId) {
  return {
    getDetailState(surfaceId) {
      return detailStateByExtensionSurface.get(detailStateKey(extensionId, surfaceId)) ?? null;
    },
    setDetailState(surfaceId, state) {
      detailStateByExtensionSurface.set(detailStateKey(extensionId, surfaceId), state);
      window.dispatchEvent(new CustomEvent("neon-pilot-extension-workbench-detail-state", { detail: { extensionId, surfaceId, state } }));
    },
    closeTab(tabId) {
      window.dispatchEvent(new CustomEvent("pa:workbench-close-tab", { detail: { tabId } }));
    }
  };
}
function createNativeBrowserClient() {
  return {
    isAvailable() {
      return getDesktopBridge() !== null;
    },
    getState(input) {
      return requireDesktopBridge().getWorkbenchBrowserState({ sessionKey: browserSessionKey(input?.tabId) });
    },
    open(input) {
      return requireDesktopBridge().navigateWorkbenchBrowser({ url: input.url, sessionKey: browserSessionKey(input.tabId) });
    },
    goBack(input) {
      return requireDesktopBridge().goBackWorkbenchBrowser({ sessionKey: browserSessionKey(input?.tabId) });
    },
    goForward(input) {
      return requireDesktopBridge().goForwardWorkbenchBrowser({ sessionKey: browserSessionKey(input?.tabId) });
    },
    reload(input) {
      return requireDesktopBridge().reloadWorkbenchBrowser({ sessionKey: browserSessionKey(input?.tabId) });
    },
    stop(input) {
      return requireDesktopBridge().stopWorkbenchBrowser({ sessionKey: browserSessionKey(input?.tabId) });
    },
    snapshot(input) {
      return requireDesktopBridge().snapshotWorkbenchBrowser({ sessionKey: browserSessionKey(input?.tabId) });
    }
  };
}

// packages/desktop/ui/src/extensions/selection.ts
var currentSelection = null;
var listeners = /* @__PURE__ */ new Set();
function readExtensionSelection() {
  return currentSelection;
}
function setExtensionSelection(selection) {
  currentSelection = selection ? { ...selection, updatedAt: (/* @__PURE__ */ new Date()).toISOString() } : null;
  for (const listener of listeners) {
    try {
      listener(currentSelection);
    } catch (error) {
      console.warn("[extension-selection] listener error:", error);
    }
  }
  window.dispatchEvent(new CustomEvent("neon-pilot-extension-selection-change", { detail: currentSelection }));
  window.dispatchEvent(new CustomEvent("pa-ext-event", { detail: { event: "host:selection", payload: currentSelection } }));
}
function subscribeExtensionSelection(listener) {
  listeners.add(listener);
  listener(currentSelection);
  return { unsubscribe: () => listeners.delete(listener) };
}

// packages/desktop/ui/src/extensions/nativePaClient.ts
function matchExtensionEventPattern(pattern, eventName) {
  if (pattern === "*") return true;
  if (pattern.endsWith(":*")) {
    const prefix = pattern.slice(0, -2);
    return eventName === prefix || eventName.startsWith(`${prefix}:`);
  }
  return pattern === eventName;
}
function unwrapExtensionActionResult(response) {
  if (!response.ok) {
    throw new Error(response.error);
  }
  return response.result;
}
function createNativeExtensionClient(extensionId) {
  return {
    extension: {
      async invoke(actionId, input) {
        return unwrapExtensionActionResult(await api.invokeExtensionAction(extensionId, actionId, input ?? {}));
      },
      async getManifest() {
        return api.extensionManifest(extensionId);
      },
      async listSurfaces() {
        return api.extensionSurfacesForExtension(extensionId);
      }
    },
    automations: api.automations,
    conversations: {
      list() {
        return api.sessions();
      },
      attachments(conversationId) {
        return api.conversationAttachments(conversationId);
      },
      attachment(conversationId, attachmentId) {
        return api.conversationAttachment(conversationId, attachmentId);
      },
      attachmentAsset(conversationId, attachmentId, asset, revision) {
        return api.conversationAttachmentAsset(conversationId, attachmentId, asset, revision);
      },
      createAttachment(conversationId, input) {
        return api.createConversationAttachment(conversationId, input);
      },
      updateAttachment(conversationId, attachmentId, input) {
        return api.updateConversationAttachment(conversationId, attachmentId, input);
      }
    },
    models() {
      return api.models();
    },
    pickFolder(input) {
      return api.pickFolder(input);
    },
    executions: {
      start(input) {
        return api.startExtensionRun(extensionId, input);
      },
      get(executionId) {
        return api.execution(executionId);
      },
      list(input) {
        return input?.conversationId ? api.conversationExecutions(input.conversationId) : api.executions();
      },
      readLog(executionId, tail) {
        return api.executionLog(executionId, tail);
      },
      cancel(executionId) {
        return api.cancelExecution(executionId);
      }
    },
    storage: {
      async get(key) {
        try {
          const document4 = await api.extensionState(extensionId, key);
          return document4.value;
        } catch (error) {
          if (error instanceof Error && /404|not found/i.test(error.message)) return null;
          throw error;
        }
      },
      put(key, value, opts) {
        return api.putExtensionState(extensionId, key, value, opts);
      },
      delete(key) {
        return api.deleteExtensionState(extensionId, key);
      },
      async list(prefix = "") {
        const documents = await api.extensionStateList(extensionId, prefix);
        return documents.map((document4) => ({ key: document4.key, value: document4.value }));
      }
    },
    workspace: {
      tree(cwd2, path2) {
        return api.workspaceTree(cwd2, path2);
      },
      readFile(cwd2, path2, opts) {
        return api.workspaceFile(cwd2, path2, opts);
      },
      writeFile(cwd2, path2, content3) {
        return api.writeWorkspaceFile(cwd2, path2, content3);
      },
      createFile(cwd2, path2, content3) {
        return api.createWorkspaceFile(cwd2, path2, content3);
      },
      createFolder(cwd2, path2) {
        return api.createWorkspaceFolder(cwd2, path2);
      },
      deletePath(cwd2, path2) {
        return api.deleteWorkspacePath(cwd2, path2);
      },
      renamePath(cwd2, path2, newName) {
        return api.renameWorkspacePath(cwd2, path2, newName);
      },
      movePath(cwd2, path2, targetDir) {
        return api.moveWorkspacePath(cwd2, path2, targetDir);
      },
      diff(cwd2, path2) {
        return api.workspaceDiff(cwd2, path2);
      },
      uncommittedDiff(cwd2) {
        return api.workspaceUncommittedDiff(cwd2);
      }
    },
    workbench: createNativeWorkbenchClient(extensionId),
    browser: createNativeBrowserClient(),
    commands: {
      execute(command, args) {
        return new Promise((resolve) => {
          window.dispatchEvent(new CustomEvent("neon-pilot-extension-command-execute", { detail: { command, args, resolve } }));
        });
      },
      async list() {
        return [...listHostCommands(), ...await api.extensionCommands()];
      },
      setContext(key, value) {
        setExtensionCommandContext(`${extensionId}.${key}`, value);
      }
    },
    events: {
      publish(event, payload) {
        window.dispatchEvent(
          new CustomEvent("pa-ext-event", {
            detail: { sourceExtensionId: extensionId, event, payload, publishedAt: (/* @__PURE__ */ new Date()).toISOString() }
          })
        );
      },
      subscribe(pattern, handler) {
        function listener(raw) {
          const detail = raw.detail;
          if (!matchExtensionEventPattern(pattern, detail.event)) return;
          handler(detail);
        }
        window.addEventListener("pa-ext-event", listener);
        return { unsubscribe: () => window.removeEventListener("pa-ext-event", listener) };
      }
    },
    extensions: {
      async callAction(targetExtensionId, actionId, input) {
        return unwrapExtensionActionResult(await api.invokeExtensionAction(targetExtensionId, actionId, input ?? {}));
      },
      async listActions() {
        return api.listExtensionActions();
      },
      async getStatus(targetExtensionId) {
        return api.extensionStatus(targetExtensionId);
      }
    },
    selection: {
      get: readExtensionSelection,
      set: setExtensionSelection,
      subscribe: subscribeExtensionSelection
    },
    transcript: {
      spotlight(target) {
        dispatchTranscriptSpotlight(target);
      },
      targetProps(target) {
        return transcriptTargetAttributes(target);
      }
    },
    ui: {
      toast(message, type) {
        window.dispatchEvent(new CustomEvent("neon-pilot-extension-toast", { detail: { extensionId, message, type: type ?? "info" } }));
      },
      notify(options) {
        window.dispatchEvent(
          new CustomEvent("neon-pilot-notification", {
            detail: {
              message: options.message,
              type: options.type ?? "info",
              details: options.details,
              source: options.source ?? extensionId
            }
          })
        );
      },
      async confirm(options) {
        return new Promise((resolve) => {
          window.dispatchEvent(new CustomEvent("neon-pilot-extension-confirm", { detail: { ...options, resolve } }));
        });
      },
      subscribeInvalidations(handler) {
        function listener(raw) {
          const detail = raw.detail;
          handler({
            topics: Array.isArray(detail?.topics) ? detail.topics.filter((topic) => typeof topic === "string") : []
          });
        }
        window.addEventListener("neon-pilot-app-invalidate", listener);
        return { unsubscribe: () => window.removeEventListener("neon-pilot-app-invalidate", listener) };
      },
      openModal(options) {
        return new Promise((resolve, reject) => {
          window.dispatchEvent(new CustomEvent("neon-pilot-extension-modal", { detail: { extensionId, ...options, resolve, reject } }));
        });
      }
    }
  };
}

// packages/desktop/ui/src/components/chat/messageActionCommands.ts
var MESSAGE_ACTION_COMMAND_EVENT = "neon-pilot:message-action-command";
var messageActionContextKeys = {
  copy: "messageAction.canCopyFirst",
  edit: "messageAction.canEditFirst",
  rewind: "messageAction.canRewindFirst",
  fork: "messageAction.canForkFirst"
};
var messageActionCapabilityCounts = /* @__PURE__ */ new Map();
function registerMessageActionCapability(capability) {
  const nextCount = (messageActionCapabilityCounts.get(capability) ?? 0) + 1;
  messageActionCapabilityCounts.set(capability, nextCount);
  setExtensionCommandContext(messageActionContextKeys[capability], true);
  return () => {
    const currentCount = messageActionCapabilityCounts.get(capability) ?? 0;
    const remainingCount = Math.max(0, currentCount - 1);
    if (remainingCount === 0) {
      messageActionCapabilityCounts.delete(capability);
      setExtensionCommandContext(messageActionContextKeys[capability], null);
      return;
    }
    messageActionCapabilityCounts.set(capability, remainingCount);
  };
}

// packages/desktop/ui/src/components/chat/MessageActions.tsx
function matchMessageActionWhen(action, isUser, blockText) {
  const expr = action.when;
  if (!expr) return true;
  const role = isUser ? "user" : "assistant";
  const hasText = typeof blockText === "string" && blockText.length > 0;
  const clauses = expr.split(/\s*&&\s*/).filter(Boolean);
  for (const clause of clauses) {
    const trimmed = clause.trim();
    if (trimmed === "hasText") {
      if (!hasText) return false;
    } else if (trimmed.startsWith("role:")) {
      const expectedRole = trimmed.slice(5);
      if (role !== expectedRole) return false;
    } else {
    }
  }
  return true;
}
function MessageActions({
  isUser,
  blockText,
  blockId,
  conversationId,
  copyText,
  onFork,
  onRewind,
  onEdit
}) {
  const [isForking, setIsForking] = useState(false);
  const [isRewinding, setIsRewinding] = useState(false);
  const [busyActionIds, setBusyActionIds] = useState(/* @__PURE__ */ new Set());
  const [copyState, setCopyState] = useState("idle");
  const copyResetTimeoutRef = useRef(null);
  const canCopy = typeof copyText === "string" && copyText.length > 0;
  const copyTitle = isUser ? "Copy this prompt to the clipboard" : "Copy this assistant message to the clipboard";
  const { messageActions } = useExtensionRegistry();
  const extensionActionInvocations = useRef(/* @__PURE__ */ new Map());
  function getPaClient(extensionId) {
    let client = extensionActionInvocations.current.get(extensionId);
    if (!client) {
      client = createNativeExtensionClient(extensionId);
      extensionActionInvocations.current.set(extensionId, client);
    }
    return client;
  }
  useEffect(
    () => () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    },
    []
  );
  useEffect(() => {
    if (!canCopy) return void 0;
    return registerMessageActionCapability("copy");
  }, [canCopy]);
  useEffect(() => {
    if (!onEdit) return void 0;
    return registerMessageActionCapability("edit");
  }, [onEdit]);
  useEffect(() => {
    if (!onRewind) return void 0;
    return registerMessageActionCapability("rewind");
  }, [onRewind]);
  useEffect(() => {
    if (!onFork) return void 0;
    return registerMessageActionCapability("fork");
  }, [onFork]);
  useEffect(() => {
    function handleMessageActionCommand(event) {
      const detail = event.detail;
      if (!detail || detail.handled) return;
      if (detail.command === "copyFirst" && canCopy) {
        detail.handled = true;
        void handleCopy();
      } else if (detail.command === "editFirst" && onEdit) {
        detail.handled = true;
        onEdit();
      } else if (detail.command === "rewindFirst" && onRewind && !isRewinding) {
        detail.handled = true;
        void handleRewind();
      } else if (detail.command === "forkFirst" && onFork && !isForking) {
        detail.handled = true;
        void handleFork();
      }
    }
    window.addEventListener(MESSAGE_ACTION_COMMAND_EVENT, handleMessageActionCommand);
    return () => window.removeEventListener(MESSAGE_ACTION_COMMAND_EVENT, handleMessageActionCommand);
  }, [canCopy, isForking, isRewinding, onEdit, onFork, onRewind, copyText]);
  function setTransientCopyState(nextState) {
    if (copyResetTimeoutRef.current !== null) {
      window.clearTimeout(copyResetTimeoutRef.current);
    }
    setCopyState(nextState);
    copyResetTimeoutRef.current = window.setTimeout(() => {
      setCopyState("idle");
      copyResetTimeoutRef.current = null;
    }, 1200);
  }
  async function handleFork() {
    if (!onFork || isForking) {
      return;
    }
    try {
      setIsForking(true);
      await onFork();
    } finally {
      setIsForking(false);
    }
  }
  async function handleRewind() {
    if (!onRewind || isRewinding) {
      return;
    }
    try {
      setIsRewinding(true);
      await onRewind();
    } finally {
      setIsRewinding(false);
    }
  }
  async function handleCopy() {
    if (!canCopy) {
      return;
    }
    try {
      await writeClipboardText(copyText);
      setTransientCopyState("copied");
    } catch {
      setTransientCopyState("failed");
    }
  }
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: `flex items-center gap-0 opacity-0 transition-opacity motion-reduce:transition-none group-hover:opacity-100 group-focus-within:opacity-100 ${isUser ? "justify-start" : "justify-end"}`,
      children: [
        canCopy && /* @__PURE__ */ jsx(
          MessageActionButton,
          {
            type: "button",
            onClick: () => {
              void handleCopy();
            },
            tone: copyState === "copied" ? "accent" : copyState === "failed" ? "danger" : "default",
            title: copyState === "failed" ? "Copy to clipboard failed" : copyTitle,
            children: copyState === "copied" ? "\u2398 copied" : copyState === "failed" ? "\u2398 copy failed" : "\u2398 copy"
          }
        ),
        onEdit && /* @__PURE__ */ jsx(MessageActionButton, { type: "button", onClick: onEdit, title: "Edit this prompt and rerun the conversation from here", children: "\u270E edit" }),
        onRewind && /* @__PURE__ */ jsx(
          MessageActionButton,
          {
            type: "button",
            onClick: () => {
              void handleRewind();
            },
            tone: isRewinding ? "accent" : "default",
            title: isUser ? "Rewind into a new conversation from this prompt" : "Rewind into a new conversation from the prompt that led here",
            disabled: isRewinding,
            children: isRewinding ? "\u21A9 rewinding\u2026" : "\u21A9 rewind"
          }
        ),
        onFork && /* @__PURE__ */ jsx(
          MessageActionButton,
          {
            type: "button",
            onClick: () => {
              void handleFork();
            },
            tone: isForking ? "accent" : "default",
            title: isUser ? "Fork into a new conversation with this prompt in the input" : "Fork into a new conversation from here",
            disabled: isForking,
            children: isForking ? "\u2442 forking\u2026" : "\u2442 fork"
          }
        ),
        messageActions.map((action) => {
          if (!matchMessageActionWhen(action, isUser, blockText)) return null;
          const busy = busyActionIds.has(action.id);
          return /* @__PURE__ */ jsx(
            MessageActionButton,
            {
              type: "button",
              onClick: () => {
                void (async () => {
                  setBusyActionIds((prev) => new Set(prev).add(action.id));
                  try {
                    await getPaClient(action.extensionId).extension.invoke(action.action, {
                      messageText: blockText ?? "",
                      messageRole: isUser ? "user" : "assistant",
                      blockId: blockId ?? "",
                      conversationId: conversationId ?? ""
                    });
                  } finally {
                    setBusyActionIds((prev) => {
                      const next = new Set(prev);
                      next.delete(action.id);
                      return next;
                    });
                  }
                })();
              },
              tone: busy ? "accent" : "default",
              title: action.title,
              disabled: busy,
              children: action.title
            },
            action.id
          );
        })
      ]
    }
  );
}

// packages/desktop/ui/src/components/chat/messageEditCommands.ts
var MESSAGE_EDIT_COMMAND_EVENT = "neon-pilot-message-edit-command";

// packages/desktop/ui/src/conversation/conversationReplyQuote.ts
function normalizeReplyQuoteSelection(text7) {
  return text7.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").split("\n").map((line) => line.replace(/[\t ]+$/g, "")).join("\n").trim();
}

// packages/desktop/ui/src/components/chat/replySelection.ts
function getElementFromNode(node2) {
  if (!node2) {
    return null;
  }
  if (node2 instanceof HTMLElement) {
    return node2;
  }
  return node2.parentElement;
}
function findSelectionReplyScopeElement(node2) {
  return getElementFromNode(node2)?.closest('[data-selection-reply-scope="assistant-message"]') ?? null;
}
function findSelectionReplyScopeElements(selection, range) {
  const anchorScope = findSelectionReplyScopeElement(selection.anchorNode);
  const focusScope = findSelectionReplyScopeElement(selection.focusNode);
  return {
    startScope: anchorScope ?? findSelectionReplyScopeElement(range.startContainer),
    endScope: focusScope ?? findSelectionReplyScopeElement(range.endContainer)
  };
}
function getRangeBoundaryDocument(node2) {
  return node2.nodeType === Node.DOCUMENT_NODE ? node2 : node2.ownerDocument;
}
function isRangeInDocument(range, ownerDocument) {
  return getRangeBoundaryDocument(range.commonAncestorContainer) === ownerDocument && getRangeBoundaryDocument(range.startContainer) === ownerDocument && getRangeBoundaryDocument(range.endContainer) === ownerDocument;
}
function readSelectedTextWithinElement(element3, selectionRange) {
  if (!element3 || typeof window === "undefined") {
    return "";
  }
  const ownerDocument = element3.ownerDocument;
  const range = selectionRange ?? (() => {
    const selection = ownerDocument.defaultView?.getSelection() ?? window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return null;
    }
    return selection.getRangeAt(0);
  })();
  if (!range || !isRangeInDocument(range, ownerDocument)) {
    return "";
  }
  const scopeRange = ownerDocument.createRange();
  scopeRange.selectNodeContents(element3);
  try {
    if (range.compareBoundaryPoints(Range.START_TO_END, scopeRange) <= 0 || range.compareBoundaryPoints(Range.END_TO_START, scopeRange) >= 0) {
      return "";
    }
    const intersection = ownerDocument.createRange();
    if (range.compareBoundaryPoints(Range.START_TO_START, scopeRange) <= 0) {
      intersection.setStart(scopeRange.startContainer, scopeRange.startOffset);
    } else {
      intersection.setStart(range.startContainer, range.startOffset);
    }
    if (range.compareBoundaryPoints(Range.END_TO_END, scopeRange) >= 0) {
      intersection.setEnd(scopeRange.endContainer, scopeRange.endOffset);
    } else {
      intersection.setEnd(range.endContainer, range.endOffset);
    }
    return normalizeReplyQuoteSelection(intersection.toString());
  } catch (error) {
    if (error instanceof DOMException && error.name === "WrongDocumentError") {
      return "";
    }
    throw error;
  }
}
function buildReplySelectionScopeProps(messageIndex, blockId, onSelectionGesture) {
  const handleSelectionGesture = onSelectionGesture ? (event) => {
    onSelectionGesture(event.currentTarget);
  } : void 0;
  return {
    "data-selection-reply-scope": "assistant-message",
    "data-message-index": typeof messageIndex === "number" ? String(messageIndex) : void 0,
    "data-block-id": blockId,
    onMouseUp: handleSelectionGesture,
    onPointerUp: handleSelectionGesture,
    onKeyUp: handleSelectionGesture,
    onTouchEnd: handleSelectionGesture
  };
}

// packages/desktop/ui/src/transcript/toolExecutionWrappers.ts
function isRecord4(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function readTrimmedString(value, key) {
  const candidate = value[key];
  return typeof candidate === "string" && candidate.trim().length > 0 ? candidate.trim() : void 0;
}
function readExecutionWrappersFromRecord(value) {
  const candidate = value?.executionWrappers;
  if (!Array.isArray(candidate)) return [];
  return candidate.flatMap((item) => {
    if (!isRecord4(item)) return [];
    const id = readTrimmedString(item, "id");
    if (!id) return [];
    const label = readTrimmedString(item, "label");
    return [{ id, ...label ? { label } : {} }];
  });
}
function readToolExecutionWrappers(block) {
  const details = isRecord4(block.details) ? block.details : null;
  const input = isRecord4(block.input) ? block.input : null;
  const wrappers = readExecutionWrappersFromRecord(details);
  for (const wrapper of readExecutionWrappersFromRecord(input)) {
    if (!wrappers.some((item) => item.id === wrapper.id)) {
      wrappers.push(wrapper);
    }
  }
  return wrappers;
}
function formatToolExecutionWrapperChain(wrappers) {
  if (wrappers.length === 0) return null;
  return wrappers.map((wrapper) => wrapper.label ?? wrapper.id).join(" \u2192 ");
}

// packages/desktop/ui/src/transcript/terminalBashBlock.ts
var TERMINAL_BASH_DISPLAY_MODE = "terminal";
function isRecord5(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasTerminalDisplayMode(value) {
  return value?.displayMode === TERMINAL_BASH_DISPLAY_MODE;
}
function readTrimmedString2(value, key) {
  const candidate = value?.[key];
  return typeof candidate === "string" && candidate.trim().length > 0 ? candidate.trim() : void 0;
}
function readInteger(value, key) {
  const candidate = value?.[key];
  return typeof candidate === "number" && Number.isSafeInteger(candidate) ? candidate : void 0;
}
function readBoolean(value, key) {
  return value?.[key] === true;
}
function readTerminalBashToolPresentation(block) {
  if (!block || block.type !== "tool_use" || block.tool !== "bash") {
    return null;
  }
  const input = isRecord5(block.input) ? block.input : null;
  const details = isRecord5(block.details) ? block.details : null;
  const isBackgroundStart = input?.background === true || details?.background === true || input?.action === "start" || details?.action === "start";
  if (isBackgroundStart) {
    return null;
  }
  if (!hasTerminalDisplayMode(details) && !hasTerminalDisplayMode(input)) {
    return null;
  }
  const command = readTrimmedString2(input, "command") ?? readTrimmedString2(details, "command");
  if (!command) {
    return null;
  }
  return {
    command,
    exitCode: readInteger(details, "exitCode"),
    cancelled: readBoolean(details, "cancelled"),
    truncated: readBoolean(details, "truncated"),
    fullOutputPath: readTrimmedString2(details, "fullOutputPath"),
    excludeFromContext: readBoolean(details, "excludeFromContext") || readBoolean(input, "excludeFromContext"),
    executionWrappers: readToolExecutionWrappers(block)
  };
}
function isTerminalBashToolBlock(block) {
  return readTerminalBashToolPresentation(block) !== null;
}

// packages/desktop/ui/src/components/chat/transcriptItems.ts
var TOPOLOGY_CUSTOM_TYPES = /* @__PURE__ */ new Set(["child_conversation_topology", "parent_conversation_backlink"]);
function isTopologyBlock(block) {
  return block.type === "context" && TOPOLOGY_CUSTOM_TYPES.has(block.customType ?? "");
}
function isContextConversationBlock(block) {
  return (block.type === "context" || block.type === "summary" && block.kind !== "compaction") && !isTopologyBlock(block);
}
function addSummaryCategory(categories, category) {
  const current = categories.get(category.key);
  if (current) {
    current.count += 1;
    return;
  }
  categories.set(category.key, { ...category, count: 1 });
}
function isTraceConversationBlock(block, _standaloneTools) {
  switch (block.type) {
    case "thinking":
    case "subagent":
    case "error":
      return true;
    case "tool_use":
      return !isTerminalBashToolBlock(block);
    default:
      return false;
  }
}
function summarizeTraceCluster(blocks) {
  const categories = /* @__PURE__ */ new Map();
  let durationMs = 0;
  let hasDuration = false;
  let hasError = false;
  let hasRunning = false;
  for (const block of blocks) {
    switch (block.type) {
      case "thinking":
        addSummaryCategory(categories, { key: "thinking", kind: "thinking", label: "thinking" });
        break;
      case "subagent":
        addSummaryCategory(categories, { key: "subagent", kind: "subagent", label: "subagent" });
        if (block.status === "running") {
          hasRunning = true;
        }
        if (block.status === "failed") {
          hasError = true;
        }
        break;
      case "error":
        addSummaryCategory(categories, { key: "error", kind: "error", label: "error" });
        hasError = true;
        break;
      case "context":
      case "summary":
        addSummaryCategory(categories, { key: "context", kind: "context", label: "context" });
        break;
      case "tool_use": {
        const backgroundShellStart = isBackgroundShellStart(block);
        const wrapperChain = formatToolExecutionWrapperChain(readToolExecutionWrappers(block));
        const toolLabel = backgroundShellStart ? "bash \xB7 background task" : block.tool;
        const label = wrapperChain ? `${wrapperChain} \xB7 ${toolLabel}` : toolLabel;
        const key = `${backgroundShellStart ? "tool:bash:background" : `tool:${block.tool}`}${wrapperChain ? `:wrappers:${wrapperChain}` : ""}`;
        addSummaryCategory(categories, {
          key,
          kind: "tool",
          label,
          tool: backgroundShellStart ? "bash" : block.tool
        });
        if (block.status === "running" || block.running) {
          hasRunning = true;
        }
        if (block.status === "error" || block.error) {
          hasError = true;
        }
        if (typeof block.durationMs === "number" && Number.isFinite(block.durationMs) && block.durationMs > 0) {
          durationMs += block.durationMs;
          hasDuration = true;
        }
        break;
      }
    }
  }
  return {
    stepCount: blocks.length,
    categories: [...categories.values()],
    durationMs: hasDuration ? durationMs : null,
    hasError,
    hasRunning
  };
}
function getChatRenderItemStartIndex(item) {
  return item.type === "message" ? item.index : item.startIndex;
}
function getChatRenderItemEndIndex(item) {
  return item.type === "message" ? item.index : item.endIndex;
}
function shiftChatRenderItemIndex(item, offset) {
  if (offset === 0) {
    return item;
  }
  if (item.type === "message") {
    return { ...item, index: item.index + offset };
  }
  return { ...item, startIndex: item.startIndex + offset, endIndex: item.endIndex + offset };
}
function shouldRebuildPreviousClusterForAppend(previousLastItem, nextBlock, standaloneTools) {
  if (!previousLastItem || !nextBlock) {
    return false;
  }
  if (previousLastItem.type !== "trace_cluster" && previousLastItem.type !== "context_cluster") {
    return false;
  }
  return isTraceConversationBlock(nextBlock, standaloneTools) || isContextConversationBlock(nextBlock);
}
function buildChatRenderItems(messages, standaloneTools = /* @__PURE__ */ new Set()) {
  const items = [];
  let pendingTraceBlocks = [];
  let traceStartIndex = -1;
  let pendingContextBlocks = [];
  let contextStartIndex = -1;
  function flushTraceBlocks() {
    if (pendingTraceBlocks.length === 0 || traceStartIndex < 0) {
      pendingTraceBlocks = [];
      traceStartIndex = -1;
      return;
    }
    items.push({
      type: "trace_cluster",
      blocks: pendingTraceBlocks,
      startIndex: traceStartIndex,
      endIndex: traceStartIndex + pendingTraceBlocks.length - 1,
      summary: summarizeTraceCluster(pendingTraceBlocks)
    });
    pendingTraceBlocks = [];
    traceStartIndex = -1;
  }
  function flushContextBlocks() {
    if (pendingContextBlocks.length === 0 || contextStartIndex < 0) {
      pendingContextBlocks = [];
      contextStartIndex = -1;
      return;
    }
    items.push({
      type: "context_cluster",
      blocks: pendingContextBlocks,
      startIndex: contextStartIndex,
      endIndex: contextStartIndex + pendingContextBlocks.length - 1
    });
    pendingContextBlocks = [];
    contextStartIndex = -1;
  }
  for (const [index2, block] of messages.entries()) {
    if (isTraceConversationBlock(block, standaloneTools)) {
      if (pendingTraceBlocks.length === 0) {
        if (pendingContextBlocks.length > 0 && contextStartIndex >= 0) {
          traceStartIndex = contextStartIndex;
          pendingTraceBlocks.push(...pendingContextBlocks);
          pendingContextBlocks = [];
          contextStartIndex = -1;
        } else {
          traceStartIndex = index2;
        }
      }
      pendingTraceBlocks.push(block);
      continue;
    }
    if (isContextConversationBlock(block)) {
      if (pendingTraceBlocks.length > 0) {
        pendingTraceBlocks.push(block);
      } else if (pendingContextBlocks.length === 0) {
        contextStartIndex = index2;
        pendingContextBlocks.push(block);
      } else {
        pendingContextBlocks.push(block);
      }
      continue;
    }
    flushTraceBlocks();
    flushContextBlocks();
    items.push({ type: "message", block, index: index2 });
  }
  flushTraceBlocks();
  flushContextBlocks();
  return items;
}
function buildChatRenderItemsIncremental(input) {
  const standaloneTools = input.standaloneTools ?? /* @__PURE__ */ new Set();
  const previousMessages = input.previousMessages;
  const previousRenderItems = input.previousRenderItems;
  if (!previousMessages || !previousRenderItems || input.messages.length < previousMessages.length) {
    return buildChatRenderItems(input.messages, standaloneTools);
  }
  let firstChangedIndex = -1;
  const comparableLength = Math.min(previousMessages.length, input.messages.length);
  for (let index2 = 0; index2 < comparableLength; index2 += 1) {
    if (previousMessages[index2] !== input.messages[index2]) {
      firstChangedIndex = index2;
      break;
    }
  }
  if (firstChangedIndex < 0) {
    firstChangedIndex = previousMessages.length;
  }
  if (firstChangedIndex === input.messages.length) {
    return previousRenderItems;
  }
  if (firstChangedIndex === 0) {
    return buildChatRenderItems(input.messages, standaloneTools);
  }
  const previousLastItem = previousRenderItems.at(-1);
  let rebuildStartIndex = firstChangedIndex;
  if (firstChangedIndex === previousMessages.length && shouldRebuildPreviousClusterForAppend(previousLastItem, input.messages[firstChangedIndex], standaloneTools)) {
    rebuildStartIndex = previousLastItem ? getChatRenderItemStartIndex(previousLastItem) : firstChangedIndex;
  } else {
    const containingItem = previousRenderItems.find(
      (item) => getChatRenderItemStartIndex(item) <= firstChangedIndex && getChatRenderItemEndIndex(item) >= firstChangedIndex
    );
    if (containingItem) {
      rebuildStartIndex = getChatRenderItemStartIndex(containingItem);
    }
  }
  if (rebuildStartIndex <= 0) {
    return buildChatRenderItems(input.messages, standaloneTools);
  }
  const keptItems = previousRenderItems.filter((item) => getChatRenderItemEndIndex(item) < rebuildStartIndex);
  const rebuiltItems = buildChatRenderItems(input.messages.slice(rebuildStartIndex), standaloneTools).map(
    (item) => shiftChatRenderItemIndex(item, rebuildStartIndex)
  );
  return [...keptItems, ...rebuiltItems];
}

// packages/desktop/ui/src/components/chat/MessageBlocks.tsx
function formatSystemEventLabel(customType) {
  switch (customType) {
    case "goal-continuation":
      return "Goal auto-resume";
    case "system_prompt":
      return "System prompt";
    case "referenced_context":
      return "Context added";
    case "background_auto_resume":
      return "Auto-resume";
    case "deferred_auto_resume":
      return "Scheduled wakeup";
    case "after_turn_auto_resume":
      return "After-turn wakeup";
    case "remote_control":
      return "Remote control";
    case "browser-comments":
      return "Browser comments";
    case "conversation_workspace_change":
      return "Workspace changed";
    case "child_conversation_topology":
      return "Branch";
    case "parent_conversation_backlink":
      return "Branched from";
    case "parallel_result":
      return "Parallel response imported";
    case "conversation_automation_review":
    case "conversation_automation_item":
    case "conversation_automation_post_turn_review":
    case "automation_run":
      return "Automation run";
    default: {
      const normalized = customType?.replace(/[_-]+/g, " ").trim();
      if (!normalized) {
        return "Context added";
      }
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }
  }
}
function optionalTrimmedString(value) {
  return typeof value === "string" ? value.trim() || void 0 : void 0;
}
var AUTO_RESUME_CONTEXT_TYPES = /* @__PURE__ */ new Set([
  "goal-continuation",
  "background_auto_resume",
  "deferred_auto_resume",
  "after_turn_auto_resume"
]);
var QUIET_LIFECYCLE_CONTEXT_TYPES = /* @__PURE__ */ new Set([...AUTO_RESUME_CONTEXT_TYPES, "conversation_workspace_change"]);
var contextShelfItemClassName = "group/item w-full !overflow-visible !rounded-none !border-0 !bg-transparent text-[12px] text-secondary";
var contextShelfSummaryClassName = "grid w-full cursor-pointer list-none grid-cols-[auto_1fr] items-center gap-2 text-[11px] marker:hidden hover:text-secondary before:!content-none after:!content-none [&::-webkit-details-marker]:hidden";
var contextShelfBodyClassName = "mt-3 max-h-[min(34rem,52vh)] w-full overflow-auto pl-5 pr-2 text-[12px] leading-relaxed text-secondary";
var contextShelfSystemPromptBodyClassName = "mt-3 max-h-[min(34rem,52vh)] w-full overflow-auto pl-5 pr-2 text-[12px] leading-relaxed text-secondary/80";
function isAutoResumeLifecycleContext(block) {
  return block.type === "context" && AUTO_RESUME_CONTEXT_TYPES.has(block.customType ?? "");
}
function isQuietLifecycleContext(block) {
  return block.type === "context" && QUIET_LIFECYCLE_CONTEXT_TYPES.has(block.customType ?? "");
}
function autoResumeLifecycleText(blocks) {
  const goalCount = blocks.filter((block) => block.type === "context" && block.customType === "goal-continuation").length;
  const backgroundCount = blocks.filter((block) => block.type === "context" && block.customType === "background_auto_resume").length;
  const deferredCount = blocks.filter((block) => block.type === "context" && block.customType === "deferred_auto_resume").length;
  const afterTurnCount = blocks.filter((block) => block.type === "context" && block.customType === "after_turn_auto_resume").length;
  const total = goalCount + backgroundCount + deferredCount + afterTurnCount;
  if (total > 1) {
    if (goalCount > 0 && backgroundCount === 0 && deferredCount === 0 && afterTurnCount === 0) {
      return `Goal resumed automatically \xB7 ${total} times`;
    }
    return `Resumed automatically \xB7 ${total} events`;
  }
  if (goalCount === 1) return "Goal resumed automatically";
  if (backgroundCount === 1) return "Background task completed \xB7 resumed automatically";
  if (deferredCount === 1) return "Scheduled wakeup fired";
  if (afterTurnCount === 1) return "After-turn wakeup fired";
  return "Resumed automatically";
}
function quietLifecycleText(blocks) {
  const workspaceCount = blocks.filter((block) => block.type === "context" && block.customType === "conversation_workspace_change").length;
  if (workspaceCount > 0 && workspaceCount === blocks.length) {
    return workspaceCount === 1 ? "Workspace changed" : `Workspace changed \xB7 ${workspaceCount} times`;
  }
  return autoResumeLifecycleText(blocks);
}
function quietLifecycleTooltip(blocks) {
  if (!blocks.every((block) => block.type === "context" && block.customType === "conversation_workspace_change")) {
    return void 0;
  }
  const details = blocks.map((block) => block.type === "context" ? block.text.trim() : "").filter(Boolean).join("\n\n");
  return details || void 0;
}
function QuietLifecycleMarker({ blocks, marker }) {
  const lastTs = blocks[blocks.length - 1]?.ts;
  const tooltip = quietLifecycleTooltip(blocks);
  const backgroundRun = blocks.filter((block) => block.type === "context" && block.customType === "background_auto_resume").flatMap((block) => readMentionedLinkedRunsFromText(block.text)).at(0);
  const content3 = /* @__PURE__ */ jsxs(Fragment2, { children: [
    /* @__PURE__ */ jsx("span", { "aria-hidden": "true", children: "\u21BB" }),
    /* @__PURE__ */ jsx("span", { className: "min-w-0 truncate", children: quietLifecycleText(blocks) }),
    lastTs ? /* @__PURE__ */ jsx("span", { className: "ui-message-meta shrink-0 opacity-60", children: timeAgo(lastTs) }) : null
  ] });
  if (backgroundRun) {
    return /* @__PURE__ */ jsx(
      MessageActionButton,
      {
        className: "flex w-[78%] items-center gap-2 px-2 py-0.5 text-[11px] text-dim/75 hover:text-secondary",
        "data-context-shelf": "1",
        "data-lifecycle-marker": marker,
        title: tooltip ?? backgroundRun.runId,
        "aria-label": `${quietLifecycleText(blocks)}: ${tooltip ?? backgroundRun.runId}`,
        onClick: () => dispatchTranscriptSpotlight({ kind: "background_run", runId: backgroundRun.runId }),
        children: content3
      }
    );
  }
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: "flex w-[78%] items-center gap-2 px-2 py-0.5 text-[11px] text-dim/75",
      "data-context-shelf": "1",
      "data-lifecycle-marker": marker,
      title: tooltip,
      "aria-label": tooltip ? `${quietLifecycleText(blocks)}: ${tooltip}` : quietLifecycleText(blocks),
      children: content3
    }
  );
}
function summarizeSystemEventText(text7) {
  const normalized = text7.replace(/\r\n/g, "\n").split("\n").map((line) => line.trim()).find(Boolean);
  if (!normalized) {
    return "Details available";
  }
  return normalized.length > 140 ? `${normalized.slice(0, 137).trimEnd()}\u2026` : normalized;
}
function automationRunSummary(text7) {
  const firstLine = text7.replace(/\r\n/g, "\n").split("\n").map((line) => line.trim()).find(Boolean) ?? "Automation run";
  const match = firstLine.match(/^Automation\s+([^:]+):\s*(.*)$/i);
  const action = match?.[1]?.trim().toLowerCase() || "run";
  const title = match?.[2]?.trim() || firstLine.replace(/^Automation\s+/i, "").trim() || "Run";
  if (/\bstarted\b/i.test(action)) return { action: "started", title, tone: "running" };
  if (/\bcompleted\b/i.test(action)) return { action: "completed", title, tone: "success" };
  if (/\bfailed\b|cancelled|could not start/i.test(action)) return { action, title, tone: "danger" };
  return { action, title, tone: "muted" };
}
function AutomationRunContextBlock({
  block,
  replySelectionScopeProps,
  onOpenFilePath,
  onOpenCheckpoint,
  validatedFilePathTargets
}) {
  const summary = automationRunSummary(block.text);
  const statusTone = summary.tone === "running" ? "accent" : summary.tone === "success" ? "success" : summary.tone === "danger" ? "danger" : "muted";
  const blockId = optionalTrimmedString(block.id);
  const transcriptTargetAttrs = blockId ? transcriptTargetAttributes({ kind: "block", blockId }) : {};
  const [openedOnce, setOpenedOnce] = useState(false);
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: "group flex w-full flex-col items-end gap-1.5",
      "data-context-type": "automation_run",
      "data-automation-run-block": "1",
      ...transcriptTargetAttrs,
      tabIndex: blockId ? -1 : void 0,
      children: /* @__PURE__ */ jsxs("div", { className: "ml-auto min-w-0 max-w-[86%]", children: [
        /* @__PURE__ */ jsxs(
          "details",
          {
            className: "group/item",
            onToggle: (event) => {
              if (event.currentTarget.open) {
                setOpenedOnce(true);
              }
            },
            children: [
              /* @__PURE__ */ jsx("summary", { className: "block cursor-pointer list-none marker:hidden before:!content-none after:!content-none [&::-webkit-details-marker]:hidden", children: /* @__PURE__ */ jsx(MessageCard, { role: "user", className: "space-y-2", children: /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 items-start gap-2 px-1.5 pb-0.5", children: [
                /* @__PURE__ */ jsx(StatusDot, { tone: statusTone, size: "xs", className: "mt-[0.45rem] shrink-0" }),
                /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
                  /* @__PURE__ */ jsx("div", { className: "flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5", children: /* @__PURE__ */ jsxs("span", { className: "shrink-0 text-[12px] font-medium text-primary/90", children: [
                    "Automation ",
                    summary.action
                  ] }) }),
                  /* @__PURE__ */ jsx("div", { className: "mt-0.5 truncate text-[13px] leading-relaxed text-primary", children: summary.title })
                ] }),
                /* @__PURE__ */ jsx("span", { className: "mt-0.5 shrink-0 text-dim/70 transition-transform group-open/item:rotate-90", "aria-hidden": "true", children: "\u203A" })
              ] }) }) }),
              openedOnce ? /* @__PURE__ */ jsx("div", { ...replySelectionScopeProps, className: "mt-1.5 px-2 pb-1 pr-3 text-[12px] leading-relaxed text-secondary", children: renderText(block.text, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets }) }) : null
            ]
          }
        ),
        block.ts ? /* @__PURE__ */ jsx("div", { className: "flex flex-wrap items-center gap-2 pt-1 pr-1", children: /* @__PURE__ */ jsx(MessageMeta, { children: timeAgo(block.ts) }) }) : null
      ] })
    }
  );
}
function contextShelfLabel(block) {
  if (block.type === "summary") {
    switch (block.kind) {
      case "compaction":
        return resolveCompactionSummaryLabel(block.title);
      case "related":
        return block.title || "Related conversations";
      default:
        return block.title || "Branch summary";
    }
  }
  return formatSystemEventLabel(block.customType);
}
function contextShelfPreview(block) {
  if (block.type === "summary") {
    if (block.kind === "compaction") {
      return resolveCompactionSummaryDetail(block.title, block.detail);
    }
    return block.detail?.trim() || summarizeSystemEventText(block.text);
  }
  return summarizeSystemEventText(block.text);
}
function estimateTextTokens(text7) {
  const normalized = text7.trim();
  return normalized ? Math.ceil(normalized.length / 4) : 0;
}
function formatTokenCount(tokens) {
  return `${tokens.toLocaleString()} token${tokens === 1 ? "" : "s"}`;
}
function formatSystemPromptPreview(toolDefinitionCount, tokenCount) {
  const availability = toolDefinitionCount > 0 ? `Runtime instructions and ${toolDefinitionCount} tool definitions available for inspection.` : "Runtime instructions available for inspection.";
  return `${availability} ${formatTokenCount(tokenCount)}`;
}
function LazyDetails({
  className,
  dataAttrs = {},
  summary,
  summaryClassName,
  bodyClassName = "!border-t-0 !p-0",
  children
}) {
  const [openedOnce, setOpenedOnce] = useState(false);
  return /* @__PURE__ */ jsx(
    Disclosure,
    {
      className,
      summary,
      summaryClassName,
      bodyClassName,
      ...dataAttrs,
      onToggle: (event) => {
        if (event.currentTarget.open) {
          setOpenedOnce(true);
        }
      },
      children: openedOnce ? children : null
    }
  );
}
var ContextShelf = memo(function ContextShelf2({
  blocks,
  messageIndexOffset,
  currentConversationId,
  systemPrompt,
  toolDefinitions = [],
  remoteControlled = false,
  remoteControlStatus,
  onOpenFilePath,
  validatedFilePathTargets,
  onOpenCheckpoint,
  onSelectionGesture
}) {
  const normalizedSystemPrompt = systemPrompt?.trim() ?? "";
  const remoteControlText = remoteControlStatus?.trim() || "You are remotely controlling this agent.";
  const toolDefinitionsText = formatToolDefinitions(toolDefinitions);
  const hasSystemPrompt = normalizedSystemPrompt.length > 0 || toolDefinitionsText.length > 0;
  const systemPromptTokenCount = estimateTextTokens([normalizedSystemPrompt, toolDefinitionsText].filter(Boolean).join("\n\n"));
  if (!hasSystemPrompt && !remoteControlled && blocks.length > 0 && blocks.every(isQuietLifecycleContext)) {
    const marker = blocks.every(isAutoResumeLifecycleContext) ? "auto-resume" : "workspace-change";
    return /* @__PURE__ */ jsx(QuietLifecycleMarker, { blocks, marker });
  }
  const shouldRenderTopologyBlock = (block) => {
    if (!isTopologyBlock(block)) return false;
    if (block.customType !== "child_conversation_topology" || !currentConversationId) return true;
    return parseTopologyBlockText(block.text).conversationId !== currentConversationId;
  };
  return /* @__PURE__ */ jsxs("div", { className: "my-5 w-full max-w-[72rem] space-y-1.5 text-dim", "data-context-shelf": "1", children: [
    hasSystemPrompt ? /* @__PURE__ */ jsx(
      LazyDetails,
      {
        className: contextShelfItemClassName,
        dataAttrs: { "data-context-type": "system_prompt" },
        summaryClassName: contextShelfSummaryClassName,
        summary: /* @__PURE__ */ jsxs(Fragment2, { children: [
          /* @__PURE__ */ jsxs("span", { className: "flex min-w-0 max-w-[78vw] items-center gap-1.5 sm:max-w-[42rem]", children: [
            /* @__PURE__ */ jsx("span", { className: "text-dim/70 transition-transform group-open/item:rotate-90", "aria-hidden": "true", children: "\u203A" }),
            /* @__PURE__ */ jsx("span", { className: "shrink-0 font-medium text-primary/90", children: "System prompt" }),
            /* @__PURE__ */ jsx("span", { className: "min-w-0 truncate text-dim/90", children: formatSystemPromptPreview(toolDefinitions.length, systemPromptTokenCount) })
          ] }),
          /* @__PURE__ */ jsx("span", { className: "h-px bg-border-subtle", "aria-hidden": "true" })
        ] }),
        children: /* @__PURE__ */ jsxs("div", { className: contextShelfSystemPromptBodyClassName, children: [
          normalizedSystemPrompt ? /* @__PURE__ */ jsx("div", { children: renderText(normalizedSystemPrompt, { validatedFilePathTargets }) }) : null,
          toolDefinitionsText ? /* @__PURE__ */ jsxs("div", { className: normalizedSystemPrompt ? "mt-4" : void 0, children: [
            /* @__PURE__ */ jsx("div", { className: "mb-2 font-medium text-primary", children: "Available tool definitions" }),
            renderText(toolDefinitionsText, { validatedFilePathTargets })
          ] }) : null
        ] })
      }
    ) : null,
    remoteControlled ? /* @__PURE__ */ jsx(
      Disclosure,
      {
        className: contextShelfItemClassName,
        "data-context-type": "remote_control",
        summaryClassName: contextShelfSummaryClassName,
        bodyClassName: "!border-t-0 !p-0",
        summary: /* @__PURE__ */ jsxs(Fragment2, { children: [
          /* @__PURE__ */ jsxs("span", { className: "flex min-w-0 max-w-[78vw] items-center gap-1.5 sm:max-w-[42rem]", children: [
            /* @__PURE__ */ jsx("span", { className: "text-dim/70 transition-transform group-open/item:rotate-90", "aria-hidden": "true", children: "\u203A" }),
            /* @__PURE__ */ jsx("span", { className: "shrink-0 font-medium text-primary/90", children: "Remote control" }),
            /* @__PURE__ */ jsx("span", { className: "min-w-0 truncate text-dim/90", children: remoteControlText })
          ] }),
          /* @__PURE__ */ jsx("span", { className: "h-px bg-border-subtle", "aria-hidden": "true" })
        ] }),
        children: /* @__PURE__ */ jsx("div", { className: contextShelfBodyClassName, children: remoteControlText })
      }
    ) : null,
    blocks.map((block, index2) => {
      const blockId = optionalTrimmedString(block.id);
      const replySelectionScopeProps = buildReplySelectionScopeProps(
        typeof messageIndexOffset === "number" ? messageIndexOffset + index2 : void 0,
        blockId,
        onSelectionGesture
      );
      if (isTopologyBlock(block)) {
        if (!shouldRenderTopologyBlock(block)) return null;
        return /* @__PURE__ */ jsx("div", { className: "px-2 py-0.5", children: /* @__PURE__ */ jsx(TopologyBlock, { block }) }, block.id ?? index2);
      }
      if (block.type === "context" && block.customType === "automation_run") {
        return /* @__PURE__ */ jsx(
          AutomationRunContextBlock,
          {
            block,
            replySelectionScopeProps,
            onOpenFilePath,
            onOpenCheckpoint,
            validatedFilePathTargets
          },
          block.id ?? index2
        );
      }
      return /* @__PURE__ */ jsx(
        LazyDetails,
        {
          className: contextShelfItemClassName,
          dataAttrs: {
            "data-context-type": block.type === "context" ? block.customType ?? "injected_context" : `summary:${block.kind}`,
            "data-summary-kind": block.type === "summary" ? block.kind : void 0
          },
          summaryClassName: contextShelfSummaryClassName,
          summary: /* @__PURE__ */ jsxs(Fragment2, { children: [
            /* @__PURE__ */ jsxs("span", { className: "flex min-w-0 max-w-[78vw] items-center gap-1.5 sm:max-w-[42rem]", children: [
              /* @__PURE__ */ jsx("span", { className: "text-dim/70 transition-transform group-open/item:rotate-90", "aria-hidden": "true", children: "\u203A" }),
              /* @__PURE__ */ jsx("span", { className: "shrink-0 font-medium text-primary/90", children: contextShelfLabel(block) }),
              /* @__PURE__ */ jsx("span", { className: "min-w-0 truncate text-dim/90", children: contextShelfPreview(block) }),
              block.ts ? /* @__PURE__ */ jsx("span", { className: "ui-message-meta shrink-0", children: timeAgo(block.ts) }) : null
            ] }),
            /* @__PURE__ */ jsx("span", { className: "h-px bg-border-subtle", "aria-hidden": "true" })
          ] }),
          children: /* @__PURE__ */ jsxs("div", { ...replySelectionScopeProps, className: contextShelfBodyClassName, children: [
            block.type === "summary" && block.kind === "compaction" ? /* @__PURE__ */ jsx("p", { className: "mb-2 text-[12px] leading-relaxed text-secondary", children: resolveCompactionSummaryDetail(block.title, block.detail) }) : null,
            renderText(block.text, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets })
          ] })
        },
        block.id ?? index2
      );
    })
  ] });
});
var UserMessage = memo(function UserMessage2({
  block,
  messageIndex,
  onRewindMessage,
  onForkMessage,
  onEditMessage,
  onHydrateMessage,
  hydratingMessageBlockIds,
  onOpenFilePath,
  validatedFilePathTargets,
  onOpenCheckpoint,
  onInspectImage,
  isInlineRunExpanded,
  onToggleInlineRun,
  layout = "default"
}) {
  const hasText = block.text.trim().length > 0;
  const imageCount = block.images?.length ?? 0;
  const hasImages = imageCount > 0;
  const skillBlock = hasText ? parseSkillBlock(block.text) : null;
  const handleRewind = useCallback(() => {
    if (typeof messageIndex !== "number") {
      return;
    }
    return onRewindMessage?.(messageIndex);
  }, [messageIndex, onRewindMessage]);
  const handleFork = useCallback(() => {
    if (typeof messageIndex !== "number") {
      return;
    }
    return onForkMessage?.(messageIndex);
  }, [messageIndex, onForkMessage]);
  const canAddressMessage = typeof messageIndex === "number";
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(block.text);
  const [editSaving, setEditSaving] = useState(false);
  const rawRunCallbackRuns = useMemo(() => readRawRunCallbackLinkedRuns(block.text), [block.text]);
  const showRawRunCallbackCard = rawRunCallbackRuns.length > 0;
  const beginEdit = useCallback(() => {
    setEditDraft(block.text);
    setEditing(true);
  }, [block.text]);
  const cancelEdit = useCallback(() => {
    setEditDraft(block.text);
    setEditing(false);
  }, [block.text]);
  const saveEdit = useCallback(async () => {
    if (!onEditMessage || typeof messageIndex !== "number" || editSaving) {
      return;
    }
    const nextText = editDraft.trim();
    if (!nextText) {
      return;
    }
    setEditSaving(true);
    try {
      await onEditMessage(messageIndex, nextText);
    } finally {
      setEditSaving(false);
    }
  }, [editDraft, editSaving, messageIndex, onEditMessage]);
  const canSaveEdit = editing && !editSaving && editDraft.trim().length > 0;
  useEffect(() => {
    if (!editing) {
      return;
    }
    setExtensionCommandContext("messageEdit.active", editing);
    setExtensionCommandContext("messageEdit.canSave", canSaveEdit);
    return () => {
      setExtensionCommandContext("messageEdit.active", null);
      setExtensionCommandContext("messageEdit.canSave", null);
    };
  }, [canSaveEdit, editing]);
  useEffect(() => {
    if (!editing) {
      return;
    }
    function handleMessageEditCommand(event) {
      const command = event.detail;
      if (command === "save") {
        void saveEdit();
        return;
      }
      if (command === "cancel") {
        cancelEdit();
      }
    }
    window.addEventListener(MESSAGE_EDIT_COMMAND_EVENT, handleMessageEditCommand);
    return () => window.removeEventListener(MESSAGE_EDIT_COMMAND_EVENT, handleMessageEditCommand);
  }, [cancelEdit, editing, saveEdit]);
  const transcriptTargetAttrs = block.id ? transcriptTargetAttributes({ kind: "block", blockId: block.id }) : {};
  return /* @__PURE__ */ jsx("div", { className: "group flex w-full flex-col items-end gap-1.5", ...transcriptTargetAttrs, tabIndex: block.id ? -1 : void 0, children: /* @__PURE__ */ jsxs("div", { className: layout === "compact" ? "ml-auto min-w-0 max-w-[92%] sm:max-w-[88%]" : "ml-auto min-w-0 max-w-[86%]", children: [
    /* @__PURE__ */ jsxs(MessageCard, { role: "user", className: "space-y-2", children: [
      hasImages && /* @__PURE__ */ jsx("div", { className: "space-y-2", children: block.images?.map((image3, index2) => {
        const blockId = optionalTrimmedString(block.id);
        const loading = Boolean(blockId && hydratingMessageBlockIds?.has(blockId));
        const canHydrate = Boolean(image3.deferred && blockId && onHydrateMessage);
        return /* @__PURE__ */ jsx(
          ImagePreview,
          {
            alt: image3.alt,
            src: image3.src,
            caption: image3.caption,
            width: image3.width,
            height: image3.height,
            maxHeight: 280,
            deferred: image3.deferred,
            loading,
            onLoad: canHydrate ? () => onHydrateMessage?.(blockId) : void 0,
            onInspect: onInspectImage
          },
          `${image3.caption ?? image3.alt}-${index2}`
        );
      }) }),
      editing ? /* @__PURE__ */ jsxs(
        "form",
        {
          className: "space-y-2",
          onSubmit: (event) => {
            event.preventDefault();
            void saveEdit();
          },
          children: [
            /* @__PURE__ */ jsx(
              Textarea,
              {
                value: editDraft,
                onChange: (event) => setEditDraft(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    cancelEdit();
                  }
                },
                disabled: editSaving,
                autoFocus: true,
                className: "min-h-[96px] w-full resize-y leading-relaxed"
              }
            ),
            /* @__PURE__ */ jsxs("div", { className: "flex justify-end gap-2", children: [
              /* @__PURE__ */ jsx(MessageActionButton, { type: "button", onClick: cancelEdit, disabled: editSaving, children: "cancel" }),
              /* @__PURE__ */ jsx(MessageActionButton, { type: "submit", tone: "accent", disabled: editSaving || !editDraft.trim(), children: editSaving ? "rerunning\u2026" : "rerun" })
            ] })
          ]
        }
      ) : showRawRunCallbackCard ? /* @__PURE__ */ jsx("div", { className: "px-1.5 pb-0.5", children: /* @__PURE__ */ jsx(
        RawRunCallbackCard,
        {
          runs: rawRunCallbackRuns,
          messageIndex,
          isInlineRunExpanded,
          onToggleInlineRun
        }
      ) }) : skillBlock ? /* @__PURE__ */ jsxs("div", { className: "space-y-2 px-1.5 pb-0.5", children: [
        /* @__PURE__ */ jsx(
          SkillInvocationCard,
          {
            skillBlock,
            className: "ui-skill-invocation-user",
            onOpenFilePath,
            validatedFilePathTargets
          }
        ),
        skillBlock.userMessage && renderMarkdownText(skillBlock.userMessage, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets })
      ] }) : hasText ? /* @__PURE__ */ jsx("div", { className: "px-1.5 pb-0.5", children: renderMarkdownText(block.text, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets }) }) : hasImages ? /* @__PURE__ */ jsx("div", { className: "px-1.5 pb-0.5 text-sm text-secondary", children: imageCount === 1 ? "Image attachment" : `${imageCount} image attachments` }) : null
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2 pt-1 pr-1", children: [
      /* @__PURE__ */ jsx(MessageMeta, { children: timeAgo(block.ts) }),
      /* @__PURE__ */ jsx("span", { className: "flex-1" }),
      /* @__PURE__ */ jsx(
        MessageActions,
        {
          isUser: true,
          blockText: block.text,
          blockId: block.id,
          copyText: block.text,
          onRewind: !editing && onRewindMessage && canAddressMessage ? handleRewind : void 0,
          onFork: !editing && onForkMessage && canAddressMessage ? handleFork : void 0,
          onEdit: !editing && onEditMessage && canAddressMessage ? beginEdit : void 0
        }
      )
    ] })
  ] }) });
});
var AssistantMessage = memo(function AssistantMessage2({
  block,
  messageIndex,
  onForkMessage,
  onRewindMessage,
  onOpenFilePath,
  validatedFilePathTargets,
  onOpenCheckpoint,
  onSelectionGesture,
  isInlineRunExpanded,
  onToggleInlineRun,
  layout = "default",
  showCursor = false
}) {
  const shouldShowCursor = showCursor || !!block.streaming;
  const blockId = optionalTrimmedString(block.id);
  const replySelectionScopeProps = buildReplySelectionScopeProps(messageIndex, blockId, onSelectionGesture);
  const handleRewind = useCallback(() => {
    if (typeof messageIndex !== "number") {
      return;
    }
    return onRewindMessage?.(messageIndex);
  }, [messageIndex, onRewindMessage]);
  const handleFork = useCallback(() => {
    if (typeof messageIndex !== "number") {
      return;
    }
    return onForkMessage?.(messageIndex);
  }, [messageIndex, onForkMessage]);
  const rawRunCallbackRuns = useMemo(() => readRawRunCallbackLinkedRuns(block.text), [block.text]);
  const showRawRunCallbackCard = rawRunCallbackRuns.length > 0;
  const renderStreamingPlainText = shouldShowCursor && !showRawRunCallbackCard;
  const transcriptTargetAttrs = blockId ? transcriptTargetAttributes({ kind: "block", blockId }) : {};
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: cx("group flex items-start", layout === "compact" ? "gap-2.5 pr-3 sm:pr-6" : "gap-3 pr-8 sm:pr-14"),
      ...transcriptTargetAttrs,
      tabIndex: blockId ? -1 : void 0,
      children: /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1 space-y-1.5", children: [
        /* @__PURE__ */ jsxs(MessageCard, { ...replySelectionScopeProps, className: "space-y-1 text-primary", children: [
          showRawRunCallbackCard ? /* @__PURE__ */ jsx(
            RawRunCallbackCard,
            {
              runs: rawRunCallbackRuns,
              messageIndex,
              isInlineRunExpanded,
              onToggleInlineRun
            }
          ) : renderStreamingPlainText ? renderStreamingMarkdownText(block.text, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets }) : renderText(block.text, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets }),
          shouldShowCursor && /* @__PURE__ */ jsx(
            "span",
            {
              className: "inline-block w-[2px] h-[14px] bg-accent ml-0.5 rounded-sm",
              style: { animation: "cursorBlink 1s step-end infinite", verticalAlign: "text-bottom" }
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2 pt-0.5", children: [
          /* @__PURE__ */ jsx(MessageMeta, { children: timeAgo(block.ts) }),
          /* @__PURE__ */ jsx("span", { className: "flex-1" }),
          /* @__PURE__ */ jsx(
            MessageActions,
            {
              blockText: block.text,
              blockId,
              copyText: block.text,
              onRewind: onRewindMessage && typeof messageIndex === "number" ? handleRewind : void 0,
              onFork: onForkMessage && typeof messageIndex === "number" ? handleFork : void 0
            }
          )
        ] })
      ] })
    }
  );
});
function readRawRunCallbackLinkedRuns(text7) {
  if (!looksLikeRawRunCallback(text7)) {
    return [];
  }
  const mentionedRuns = readMentionedLinkedRunsFromText(text7);
  if (mentionedRuns.length > 0) {
    return mentionedRuns;
  }
  const directRunId = text7.match(/\b(?:Durable run|Background task)\s+([^\s]+)\s+has finished\./)?.[1]?.trim();
  return directRunId ? readMentionedLinkedRunsFromText(`runId=${directRunId}`) : [];
}
function looksLikeRawRunCallback(text7) {
  return /\b(?:Durable run|Background task)\s+\S+\s+has finished\./.test(text7.trim()) && /\btaskSlug=/.test(text7) && /\bstatus=/.test(text7) && /\blog=/.test(text7) && /Recent log tail:/.test(text7);
}
function RawRunCallbackCard({
  runs,
  messageIndex,
  isInlineRunExpanded,
  onToggleInlineRun
}) {
  return /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2 text-[12px] text-secondary", children: [
      /* @__PURE__ */ jsx("span", { className: "font-medium text-primary", children: "Background work finished." }),
      /* @__PURE__ */ jsx("span", { children: "Open the run card for logs and metadata." })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "space-y-1.5", children: runs.map((run) => {
      const inlineRunKey = buildInlineRunExpansionKey(messageIndex ?? 0, run.runId);
      return /* @__PURE__ */ jsx(
        InlineTraceRunCard,
        {
          run,
          expanded: isInlineRunExpanded?.(inlineRunKey) ?? false,
          onToggle: () => onToggleInlineRun?.(inlineRunKey)
        },
        run.runId
      );
    }) })
  ] });
}
function SystemEventFrame({
  label,
  preview,
  ts,
  dataAttributes,
  children
}) {
  return /* @__PURE__ */ jsx(
    Disclosure,
    {
      className: "group w-full !rounded-none !border-0 !bg-transparent text-dim",
      summaryClassName: "grid w-full cursor-pointer grid-cols-[auto_1fr] items-center gap-2 text-[11px] marker:hidden hover:text-secondary before:!content-none after:!content-none [&::-webkit-details-marker]:hidden",
      bodyClassName: "!border-t-0 !p-0",
      summary: /* @__PURE__ */ jsxs(Fragment2, { children: [
        /* @__PURE__ */ jsxs("span", { className: "flex min-w-0 max-w-[78vw] items-center gap-1.5 sm:max-w-[42rem]", children: [
          /* @__PURE__ */ jsx("span", { className: "text-dim/70 transition-transform group-open:rotate-90", "aria-hidden": "true", children: "\u203A" }),
          /* @__PURE__ */ jsx("span", { className: "shrink-0 font-medium text-secondary/80", children: label }),
          /* @__PURE__ */ jsx("span", { className: "min-w-0 truncate text-dim/80", children: preview }),
          ts ? /* @__PURE__ */ jsx("span", { className: "ui-message-meta shrink-0 opacity-70", children: timeAgo(ts) }) : null
        ] }),
        /* @__PURE__ */ jsx("span", { className: "h-px bg-border-subtle", "aria-hidden": "true" })
      ] }),
      ...dataAttributes,
      children: /* @__PURE__ */ jsx("div", { className: "mx-auto mt-3 w-[78%]", children })
    }
  );
}
function formatToolDefinitions(tools) {
  if (tools.length === 0) {
    return "";
  }
  return tools.map((tool) => {
    const parameters = JSON.stringify(tool.parameters, null, 2);
    return [`### ${tool.name}`, tool.description.trim(), "```json", parameters, "```"].filter(Boolean).join("\n");
  }).join("\n\n");
}
var SystemPromptMessage = memo(function SystemPromptMessage2({
  text: text7,
  toolDefinitions = []
}) {
  const normalizedText = text7.trim();
  const toolDefinitionsText = formatToolDefinitions(toolDefinitions);
  if (!normalizedText && !toolDefinitionsText) {
    return null;
  }
  const tokenCount = estimateTextTokens([normalizedText, toolDefinitionsText].filter(Boolean).join("\n\n"));
  return /* @__PURE__ */ jsx(
    SystemEventFrame,
    {
      label: "System prompt",
      preview: formatSystemPromptPreview(toolDefinitions.length, tokenCount),
      dataAttributes: { "data-context-type": "system_prompt" },
      children: /* @__PURE__ */ jsxs("div", { className: "space-y-4 pt-2 pl-5 text-[13px] leading-relaxed text-primary/90", children: [
        normalizedText ? /* @__PURE__ */ jsx("div", { children: renderText(normalizedText) }) : null,
        toolDefinitionsText ? /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("div", { className: "mb-2 font-medium text-primary", children: "Available tool definitions" }),
          renderText(toolDefinitionsText)
        ] }) : null
      ] })
    }
  );
});
var SystemEventMessage = memo(function SystemEventMessage2({
  block,
  messageIndex,
  onOpenFilePath,
  validatedFilePathTargets,
  onOpenCheckpoint,
  onSelectionGesture,
  isInlineRunExpanded,
  onToggleInlineRun
}) {
  const label = formatSystemEventLabel(block.customType);
  const blockId = optionalTrimmedString(block.id);
  const replySelectionScopeProps = buildReplySelectionScopeProps(messageIndex, blockId, onSelectionGesture);
  const rawRunCallbackRuns = useMemo(() => readRawRunCallbackLinkedRuns(block.text), [block.text]);
  const showRawRunCallbackCard = rawRunCallbackRuns.length > 0;
  const preview = summarizeSystemEventText(block.text);
  return /* @__PURE__ */ jsx(
    SystemEventFrame,
    {
      label,
      preview,
      ts: block.ts,
      dataAttributes: { "data-context-type": block.customType ?? "injected_context" },
      children: /* @__PURE__ */ jsx("div", { ...replySelectionScopeProps, className: "pt-2 pl-5 text-[13px] leading-relaxed text-primary/90", children: showRawRunCallbackCard ? /* @__PURE__ */ jsx(
        RawRunCallbackCard,
        {
          runs: rawRunCallbackRuns,
          messageIndex,
          isInlineRunExpanded,
          onToggleInlineRun
        }
      ) : renderText(block.text, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets }) })
    }
  );
});
function resolveCompactionSummaryLabel(title) {
  const normalized = title?.trim();
  if (!normalized || normalized === "Compaction summary") {
    return "Context compacted";
  }
  return normalized;
}
function resolveCompactionMarkerLabel(title) {
  return title?.trim() === "Manual compaction" ? "Context manually compacted" : "Context automatically compacted";
}
function resolveCompactionSummaryDetail(title, extraDetail) {
  const baseDetail = (() => {
    switch (title?.trim()) {
      case "Manual compaction":
        return "You explicitly summarized older turns to shrink the active context window.";
      case "Proactive compaction":
        return "Older turns were summarized because the context window was getting full. The conversation is ready for the next turn.";
      case "Overflow recovery compaction":
        return "Older turns were summarized after a context overflow so the interrupted turn could retry automatically.";
      default:
        return "Older turns were summarized to keep the active context window focused.";
    }
  })();
  const normalizedExtraDetail = extraDetail?.trim();
  return normalizedExtraDetail ? `${baseDetail} ${normalizedExtraDetail}` : baseDetail;
}
function parseTopologyBlockKind(firstLine) {
  const match = firstLine.match(/^(\w+)\s+conversation\s/);
  return match?.[1]?.toLowerCase() ?? "fork";
}
function parseTopologyBlockText(text7) {
  const lines = text7.split("\n");
  const firstLine = lines[0] ?? "";
  const titleMatch = firstLine.match(/^[^:]+:\s*(.+)$/);
  const title = titleMatch?.[1]?.trim() || firstLine.trim();
  const openLine = lines.find((l) => l.startsWith("Open: /conversations/") || l.startsWith("Open parent: /conversations/"));
  const sourceLine = lines.find((l) => l.startsWith("Source message: "));
  const sourcePreviewLine = lines.find((l) => l.startsWith("Source preview: "));
  const conversationId = openLine?.replace(/^Open(?: parent)?: \/conversations\//, "").trim() || null;
  const sourceMessageId = sourceLine?.replace(/^Source message:\s*/, "").trim() || null;
  const sourcePreview = sourcePreviewLine?.replace(/^Source preview:\s*/, "").trim() || null;
  return { title, conversationId, kind: parseTopologyBlockKind(firstLine), sourceMessageId, sourcePreview };
}
var TopologyBlock = memo(function TopologyBlock2({ block }) {
  const isChildTopology = block.customType === "child_conversation_topology";
  const { title, conversationId, kind, sourceMessageId, sourcePreview } = useMemo(() => parseTopologyBlockText(block.text), [block.text]);
  const handleClick = useCallback(() => {
    if (conversationId) {
      window.dispatchEvent(
        new CustomEvent("pa:companion-chat-open", {
          detail: { conversationId, title: title ?? void 0 }
        })
      );
    }
  }, [conversationId, title]);
  const label = (() => {
    if (kind === "rewind") return isChildTopology ? "Rewound to" : "\u2190 Rewound from";
    if (kind === "duplicate") return isChildTopology ? "Duplicated to" : "\u2190 Duplicated from";
    return isChildTopology ? "Forked to" : "\u2190 Forked from";
  })();
  return /* @__PURE__ */ jsxs("div", { className: "grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 text-[11px] text-dim/70", "data-topology-kind": block.customType, children: [
    /* @__PURE__ */ jsx("span", { className: "h-px bg-border-subtle", "aria-hidden": "true" }),
    /* @__PURE__ */ jsxs("span", { className: "flex min-w-0 max-w-[78vw] items-center gap-1.5 sm:max-w-[42rem]", children: [
      /* @__PURE__ */ jsx("span", { className: "shrink-0", children: label }),
      conversationId ? /* @__PURE__ */ jsx(
        TextButton,
        {
          onClick: handleClick,
          className: "min-w-0 truncate text-accent/80 hover:text-accent hover:underline focus-visible:outline-none",
          title: sourceMessageId ? `Source: ${sourcePreview ?? sourceMessageId}` : void 0,
          children: title
        }
      ) : /* @__PURE__ */ jsx("span", { className: "min-w-0 truncate", children: title })
    ] }),
    /* @__PURE__ */ jsx("span", { className: "h-px bg-border-subtle", "aria-hidden": "true" })
  ] });
});
var SummaryMessage = memo(function SummaryMessage2({
  block,
  messageIndex,
  onOpenFilePath,
  validatedFilePathTargets,
  onOpenCheckpoint,
  onSelectionGesture
}) {
  const summaryPresentation = (() => {
    switch (block.kind) {
      case "compaction":
        return {
          label: resolveCompactionSummaryLabel(block.title),
          detail: resolveCompactionSummaryDetail(block.title, block.detail)
        };
      case "related":
        return {
          label: block.title || "Reused conversation summaries",
          detail: block.detail?.trim() || "Selected conversations were summarized and injected before this prompt so this thread could start with reused context."
        };
      default:
        return {
          label: block.title || "Branch summary",
          detail: block.detail?.trim() || "Context from another branch was summarized while preserving the current path."
        };
    }
  })();
  const blockId = optionalTrimmedString(block.id);
  const replySelectionScopeProps = buildReplySelectionScopeProps(messageIndex, blockId, onSelectionGesture);
  if (block.kind === "compaction") {
    const markerLabel = resolveCompactionMarkerLabel(block.title);
    return /* @__PURE__ */ jsx(
      LazyDetails,
      {
        className: "group my-5 block w-full !overflow-visible !rounded-none !border-0 !bg-transparent text-dim",
        dataAttrs: { "data-summary-kind": block.kind, "data-compaction-marker": "1" },
        summaryClassName: "grid w-full cursor-pointer grid-cols-[auto_1fr] items-center gap-2 text-[11px] marker:hidden hover:text-secondary before:!content-none after:!content-none [&::-webkit-details-marker]:hidden",
        summary: /* @__PURE__ */ jsxs(Fragment2, { children: [
          /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1.5 text-dim/85", children: [
            /* @__PURE__ */ jsx("span", { className: "text-dim/70 transition-transform group-open:rotate-90", "aria-hidden": "true", children: "\u203A" }),
            /* @__PURE__ */ jsx("span", { "aria-hidden": "true", children: "\u25A3" }),
            /* @__PURE__ */ jsx("span", { children: markerLabel })
          ] }),
          /* @__PURE__ */ jsx("span", { className: "h-px bg-border-subtle", "aria-hidden": "true" })
        ] }),
        children: /* @__PURE__ */ jsxs("div", { ...replySelectionScopeProps, className: "mx-auto mt-3 w-[78%] space-y-3 text-[13px] leading-relaxed text-primary/90", children: [
          /* @__PURE__ */ jsx("p", { className: "text-[12px] leading-relaxed text-secondary", children: summaryPresentation.detail }),
          renderText(block.text, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets })
        ] })
      }
    );
  }
  return /* @__PURE__ */ jsx(
    SystemEventFrame,
    {
      label: summaryPresentation.label,
      preview: summaryPresentation.detail,
      ts: block.ts,
      dataAttributes: { "data-summary-kind": block.kind },
      children: /* @__PURE__ */ jsxs("div", { ...replySelectionScopeProps, className: "space-y-3 pt-2 pl-5 text-[13px] leading-relaxed text-primary/90", children: [
        block.kind === "compaction" ? /* @__PURE__ */ jsx("p", { className: "text-[12px] leading-relaxed text-secondary", children: summaryPresentation.detail }) : null,
        renderText(block.text, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets })
      ] })
    }
  );
});

// packages/desktop/ui/src/components/chat/ToolBlock.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/extensions/NativeExtensionToolBlockHost.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/extensions/extensionFrontendReactGlobals.ts
init_neon_pilot_shared_react();

// neon-pilot-shared-react:neon-pilot-shared-react-dom-client
var neon_pilot_shared_react_dom_client_exports = {};
__export(neon_pilot_shared_react_dom_client_exports, {
  createRoot: () => createRoot,
  default: () => neon_pilot_shared_react_dom_client_default,
  hydrateRoot: () => hydrateRoot
});
var ReactDomClient = globalThis.__NEON_PILOT_REACT_DOM_CLIENT__;
if (!ReactDomClient) throw new Error("Neon Pilot React DOM client host runtime is unavailable.");
var createRoot = ReactDomClient.createRoot;
var hydrateRoot = ReactDomClient.hydrateRoot;
var neon_pilot_shared_react_dom_client_default = ReactDomClient;

// packages/desktop/ui/src/extensions/extensionFrontendReactGlobals.ts
function ensureExtensionFrontendReactGlobals() {
  globalThis.__NEON_PILOT_REACT__ ??= neon_pilot_shared_react_exports;
  globalThis.__NEON_PILOT_REACT_DOM__ ??= neon_pilot_shared_react_dom_exports;
  globalThis.__NEON_PILOT_REACT_DOM_CLIENT__ ??= neon_pilot_shared_react_dom_client_exports;
  globalThis.__NEON_PILOT_REACT_JSX_RUNTIME__ ??= neon_pilot_shared_react_jsx_runtime_exports;
}

// neon-pilot-extension-sdk:neon-pilot-empty-system-extension-modules
var systemExtensionModules = /* @__PURE__ */ new Map();

// packages/desktop/ui/src/extensions/useExtensionStyles.ts
init_neon_pilot_shared_react();
var loadedStyles = /* @__PURE__ */ new Map();
var RESOLVE_CACHE = /* @__PURE__ */ new Map();
function resolveExtensionStyleUrl(extensionId, stylePath, revision) {
  const cacheKey = `${extensionId}:${stylePath}:${revision ?? ""}`;
  const cached = RESOLVE_CACHE.get(cacheKey);
  if (cached) return cached;
  let url = buildApiPath(`/extensions/${encodeURIComponent(extensionId)}/files/${stylePath.split("/").map(encodeURIComponent).join("/")}`);
  if (revision) url += `?v=${encodeURIComponent(revision)}`;
  RESOLVE_CACHE.set(cacheKey, url);
  return url;
}
function useExtensionStyles(extensionId, styles, revision) {
  useEffect(() => {
    if (systemExtensionModules.has(extensionId)) return;
    if (!styles || styles.length === 0) return;
    const injected = [];
    for (const stylePath of styles) {
      const key = `${extensionId}:${stylePath}`;
      const existing = loadedStyles.get(key);
      if (existing) {
        existing.refCount++;
        injected.push(key);
        continue;
      }
      const url = resolveExtensionStyleUrl(extensionId, stylePath, revision);
      const link3 = document.createElement("link");
      link3.rel = "stylesheet";
      link3.href = url;
      link3.dataset.extensionStyle = key;
      document.head.appendChild(link3);
      loadedStyles.set(key, { link: link3, refCount: 1 });
      injected.push(key);
    }
    return () => {
      for (const key of injected) {
        const entry = loadedStyles.get(key);
        if (!entry) continue;
        entry.refCount--;
        if (entry.refCount <= 0) {
          entry.link.remove();
          loadedStyles.delete(key);
        }
      }
    };
  }, [extensionId, styles, revision]);
}

// packages/desktop/ui/src/extensions/NativeExtensionToolBlockHost.tsx
var BUILTIN_CHECKPOINT_RENDERER = {
  extension: {
    id: "system-diffs",
    name: "Diffs",
    packageType: "system",
    enabled: true,
    status: "enabled",
    manifest: {
      schemaVersion: 2,
      id: "system-diffs",
      name: "Diffs",
      packageType: "system",
      frontend: { entry: "dist/frontend.js" },
      contributes: {}
    },
    permissions: [],
    surfaces: [],
    routes: []
  },
  renderer: {
    id: "checkpoint-tool-block",
    tool: "checkpoint",
    component: "CheckpointTranscriptRenderer",
    standalone: true
  }
};
function loadExtensionModule(extension2, revision) {
  ensureExtensionFrontendReactGlobals();
  const systemLoader = systemExtensionModules.get(extension2.id);
  if (systemLoader) return systemLoader();
  const entry = extension2.manifest.frontend?.entry;
  if (!entry) throw new Error(`Extension ${extension2.id} has no frontend entry.`);
  const source = buildApiPath(
    `/extensions/${encodeURIComponent(extension2.id)}/files/${entry.split("/").map(encodeURIComponent).join("/")}?v=${revision}`
  );
  return import(
    /* @vite-ignore */
    source
  );
}
function extensionModuleKey(extension2) {
  return `${extension2.id}:${extension2.manifest.frontend?.entry ?? ""}:${getExtensionRegistryRevision()}`;
}
function lazyRendererComponent(extension2, renderer, revision) {
  return lazy(async () => {
    const module = await loadExtensionModule(extension2, revision);
    const component = module[renderer.component];
    if (typeof component !== "function") throw new Error(`Extension transcript renderer not found: ${renderer.component}`);
    return { default: component };
  });
}
function MissingExtensionRendererFallback({ block }) {
  const output = stripAnsiForTranscript(block.output ?? "").trim();
  const isError = block.status === "error" || !!block.error;
  return /* @__PURE__ */ jsxs(SurfacePanel, { muted: true, className: cx("px-3 py-2.5 text-[12px]", isError ? "ui-surface-danger-soft" : "border-border/60 bg-panel/80"), children: [
    /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ jsx(Pill, { tone: isError ? "danger" : "muted", mono: true, children: block.tool }),
      /* @__PURE__ */ jsx("span", { className: "text-dim", children: "Extension renderer unavailable." })
    ] }),
    output ? /* @__PURE__ */ jsx("pre", { className: "mt-2 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-secondary", children: output }) : null
  ] });
}
function NativeExtensionToolBlockHost({
  extension: extension2,
  renderer,
  block,
  context
}) {
  if ((!extension2 || !renderer) && block.tool === "checkpoint") {
    return /* @__PURE__ */ jsx(
      NativeExtensionToolBlockHostInner,
      {
        extension: BUILTIN_CHECKPOINT_RENDERER.extension,
        renderer: BUILTIN_CHECKPOINT_RENDERER.renderer,
        block,
        context
      }
    );
  }
  if (!extension2 || !renderer) {
    return /* @__PURE__ */ jsx(MissingExtensionRendererFallback, { block });
  }
  return /* @__PURE__ */ jsx(NativeExtensionToolBlockHostInner, { extension: extension2, renderer, block, context });
}
function NativeExtensionToolBlockHostInner({
  extension: extension2,
  renderer,
  block,
  context
}) {
  useExtensionStyles(extension2.id, extension2.manifest.frontend?.styles);
  const moduleKey = extensionModuleKey(extension2);
  const Component = useMemo(
    () => lazyRendererComponent(extension2, renderer, getExtensionRegistryRevision()),
    [extension2, renderer, moduleKey]
  );
  return /* @__PURE__ */ jsx(Suspense, { fallback: /* @__PURE__ */ jsx(LoadingState, { label: "Loading tool\u2026", className: "py-3" }), children: /* @__PURE__ */ jsx(ExtensionToolBlockErrorBoundary, { extensionId: extension2.id, children: /* @__PURE__ */ jsx(Component, { block, renderer, context }) }) });
}
var ExtensionToolBlockErrorBoundary = class extends neon_pilot_shared_react_default.Component {
  state = { message: null };
  static getDerivedStateFromError(error) {
    return { message: error instanceof Error ? error.message : String(error) };
  }
  componentDidCatch(error, _errorInfo) {
    const message = error instanceof Error ? error.message : String(error);
    addNotification({
      type: "error",
      message: `Extension tool block error: ${message}`,
      details: error instanceof Error ? error.stack : void 0,
      source: this.props.extensionId
    });
  }
  render() {
    return this.state.message ? /* @__PURE__ */ jsx(ErrorState, { message: this.state.message }) : this.props.children;
  }
};

// packages/desktop/ui/src/components/chat/FileChangesToolDiff.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/ui-state/theme.ts
init_neon_pilot_shared_react();

// packages/desktop/ui/src/local/localSettings.ts
var THEME_STORAGE_KEY = "pa-theme";
var LIGHT_THEME_STORAGE_KEY = "pa-theme-light-default";
var DARK_THEME_STORAGE_KEY = "pa-theme-dark-default";
var ACCENT_STORAGE_KEY = "pa-theme-accent";

// packages/desktop/ui/src/ui-state/theme.ts
var THEME_ACCENTS = [
  {
    id: "lime",
    label: "Lime",
    light: {
      accent: "62 184 0",
      accentBg: "226 246 215",
      selection: "202 255 51",
      warning: "184 115 10",
      base: "247 246 241",
      surface: "255 255 255",
      elevated: "251 250 245",
      panel: "240 238 229",
      borderSubtle: "227 224 212",
      borderDefault: "211 207 190",
      hover: "240 238 229",
      active: "232 229 216"
    },
    dark: {
      accent: "202 255 51",
      accentBg: "45 56 14",
      selection: "71 88 24",
      warning: "255 180 73",
      base: "12 12 8",
      surface: "26 26 19",
      elevated: "36 36 28",
      panel: "20 20 15",
      borderSubtle: "44 44 36",
      borderDefault: "61 61 49",
      hover: "36 36 28",
      active: "46 46 36"
    }
  },
  {
    id: "forest",
    label: "Forest",
    light: {
      accent: "47 122 58",
      accentBg: "226 240 228",
      selection: "108 229 138",
      warning: "47 122 58",
      base: "246 247 243",
      surface: "255 255 252",
      elevated: "249 251 246",
      panel: "238 242 234",
      borderSubtle: "224 230 220",
      borderDefault: "208 216 202",
      hover: "238 242 234",
      active: "229 235 224"
    },
    dark: {
      accent: "108 229 138",
      accentBg: "22 52 31",
      selection: "34 82 49",
      warning: "108 229 138",
      base: "8 12 9",
      surface: "18 25 19",
      elevated: "27 37 29",
      panel: "13 19 14",
      borderSubtle: "33 45 35",
      borderDefault: "48 65 51",
      hover: "25 34 27",
      active: "34 47 36"
    }
  },
  {
    id: "cobalt",
    label: "Cobalt",
    light: {
      accent: "31 95 200",
      accentBg: "225 234 251",
      selection: "116 168 255",
      warning: "31 95 200",
      base: "245 246 249",
      surface: "252 253 255",
      elevated: "247 249 253",
      panel: "235 239 246",
      borderSubtle: "220 226 237",
      borderDefault: "202 211 227",
      hover: "235 239 246",
      active: "225 231 242"
    },
    dark: {
      accent: "116 168 255",
      accentBg: "24 41 74",
      selection: "37 64 115",
      warning: "116 168 255",
      base: "7 9 13",
      surface: "15 18 24",
      elevated: "25 30 40",
      panel: "11 14 19",
      borderSubtle: "31 38 52",
      borderDefault: "45 55 76",
      hover: "23 28 38",
      active: "33 40 55"
    }
  },
  {
    id: "ember",
    label: "Ember",
    light: {
      accent: "196 77 18",
      accentBg: "249 231 220",
      selection: "255 147 82",
      warning: "196 77 18",
      base: "249 246 243",
      surface: "255 253 250",
      elevated: "252 248 244",
      panel: "244 236 229",
      borderSubtle: "232 222 214",
      borderDefault: "218 205 194",
      hover: "244 236 229",
      active: "235 225 216"
    },
    dark: {
      accent: "255 147 82",
      accentBg: "72 36 20",
      selection: "113 57 32",
      warning: "255 147 82",
      base: "13 9 7",
      surface: "25 18 14",
      elevated: "39 28 22",
      panel: "19 13 10",
      borderSubtle: "52 38 30",
      borderDefault: "76 55 43",
      hover: "36 26 20",
      active: "51 37 29"
    }
  },
  {
    id: "violet",
    label: "Violet",
    light: {
      accent: "106 61 209",
      accentBg: "235 228 251",
      selection: "182 156 255",
      warning: "106 61 209",
      base: "247 245 250",
      surface: "254 252 255",
      elevated: "250 247 254",
      panel: "239 235 247",
      borderSubtle: "226 220 237",
      borderDefault: "211 202 228",
      hover: "239 235 247",
      active: "230 224 242"
    },
    dark: {
      accent: "182 156 255",
      accentBg: "47 36 82",
      selection: "74 56 128",
      warning: "182 156 255",
      base: "10 8 13",
      surface: "20 16 26",
      elevated: "32 26 43",
      panel: "15 12 20",
      borderSubtle: "41 34 55",
      borderDefault: "60 49 82",
      hover: "29 24 39",
      active: "42 34 57"
    }
  },
  {
    id: "ink",
    label: "Ink",
    light: {
      accent: "20 20 15",
      accentBg: "235 234 229",
      selection: "20 20 15",
      warning: "20 20 15",
      base: "247 246 243",
      surface: "255 255 252",
      elevated: "249 248 245",
      panel: "239 238 233",
      borderSubtle: "226 224 218",
      borderDefault: "210 207 199",
      hover: "239 238 233",
      active: "230 228 221"
    },
    dark: {
      accent: "245 243 232",
      accentBg: "46 46 36",
      selection: "82 80 66",
      warning: "245 243 232",
      base: "10 10 10",
      surface: "22 22 21",
      elevated: "34 34 32",
      panel: "16 16 15",
      borderSubtle: "40 40 37",
      borderDefault: "58 57 52",
      hover: "32 32 30",
      active: "44 43 39"
    }
  }
];
var BUILT_IN_THEMES = [
  { id: "studio-light", label: "Light", appearance: "light" },
  { id: "studio-dark", label: "Dark", appearance: "dark" }
];
var DEFAULT_THEME_PREFERENCE = "system";
var DEFAULT_LIGHT_THEME = "studio-light";
var DEFAULT_DARK_THEME = "studio-dark";
var DEFAULT_ACCENT = "cobalt";
var SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";
var ThemeContext = createContext(null);
function setStoredThemeValue(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
  }
}
function normalizeThemeId(theme) {
  if (theme === "light" || theme === "tokyo-night-light") return "studio-light";
  if (theme === "dark" || theme === "tokyo-night-dark") return "studio-dark";
  return theme;
}
function findTheme(themes, theme) {
  const normalizedTheme = normalizeThemeId(theme);
  return themes.find((candidate) => candidate.id === normalizedTheme) ?? BUILT_IN_THEMES[0];
}
function normalizeAccent(value) {
  return THEME_ACCENTS.some((accent) => accent.id === value) ? value : DEFAULT_ACCENT;
}
function accentTokensFor(accent, appearance) {
  const entry = THEME_ACCENTS.find((candidate) => candidate.id === accent) ?? THEME_ACCENTS[0];
  return appearance === "dark" ? entry.dark : entry.light;
}
function applyAccent(accent, appearance) {
  if (typeof document === "undefined") return;
  const tokens = accentTokensFor(accent, appearance);
  document.documentElement.setAttribute("data-accent", accent);
  document.documentElement.style.setProperty("--color-base", tokens.base);
  document.documentElement.style.setProperty("--color-surface", tokens.surface);
  document.documentElement.style.setProperty("--color-elevated", tokens.elevated);
  document.documentElement.style.setProperty("--color-panel", tokens.panel);
  document.documentElement.style.setProperty("--color-border-subtle", tokens.borderSubtle);
  document.documentElement.style.setProperty("--color-border-default", tokens.borderDefault);
  document.documentElement.style.setProperty("--color-hover", tokens.hover);
  document.documentElement.style.setProperty("--color-active", tokens.active);
  document.documentElement.style.setProperty("--color-accent", tokens.accent);
  document.documentElement.style.setProperty("--color-teal", tokens.accent);
  document.documentElement.style.setProperty("--color-steel", tokens.accent);
  document.documentElement.style.setProperty("--color-mission-glow", tokens.accent);
  document.documentElement.style.setProperty("--color-streaming-glow", tokens.accent);
  document.documentElement.style.setProperty("--color-accent-bg", tokens.accentBg);
  document.documentElement.style.setProperty("--color-selection", tokens.selection);
  document.documentElement.style.setProperty("--color-warning", tokens.warning);
  document.documentElement.style.setProperty("--pa-accent", "rgb(var(--color-accent))");
  document.documentElement.style.setProperty("--pa-accent-hover", "rgb(var(--color-accent))");
}
function applyTheme(theme, accent = DEFAULT_ACCENT) {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.setAttribute("data-theme", theme.id);
  document.documentElement.setAttribute("data-theme-appearance", theme.appearance);
  document.documentElement.style.colorScheme = theme.appearance;
  for (const property of Array.from(document.documentElement.style)) {
    if (property.startsWith("--color-")) {
      document.documentElement.style.removeProperty(property);
    }
  }
  for (const [property, value] of Object.entries(theme.tokens ?? {})) {
    document.documentElement.style.setProperty(property, value);
  }
  applyAccent(accent, theme.appearance);
  document.documentElement.style.setProperty("--pa-bg", "rgb(var(--color-base))");
  document.documentElement.style.setProperty("--pa-surface", "rgb(var(--color-surface))");
  document.documentElement.style.setProperty("--pa-surface-hover", "rgb(var(--color-elevated))");
  document.documentElement.style.setProperty("--pa-border", "rgb(var(--color-border-default))");
  document.documentElement.style.setProperty("--pa-border-subtle", "rgb(var(--color-border-subtle))");
  document.documentElement.style.setProperty("--pa-text", "rgb(var(--color-primary))");
  document.documentElement.style.setProperty("--pa-text-secondary", "rgb(var(--color-secondary))");
  document.documentElement.style.setProperty("--pa-text-dim", "rgb(var(--color-dim))");
  document.documentElement.style.setProperty("--pa-accent", "rgb(var(--color-accent))");
  document.documentElement.style.setProperty("--pa-accent-hover", "rgb(var(--color-accent))");
  document.documentElement.style.setProperty("--pa-danger", "rgb(var(--color-danger))");
  document.documentElement.style.setProperty("--pa-success", "rgb(var(--color-success))");
  document.documentElement.style.setProperty("--pa-warning", "rgb(var(--color-warning))");
}
function readSystemTheme() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }
  return window.matchMedia(SYSTEM_THEME_QUERY).matches ? "dark" : "light";
}
function resolveThemePreference(preference, systemTheme, lightTheme, darkTheme) {
  const appearance = preference === "system" ? systemTheme : preference;
  return appearance === "dark" ? darkTheme : lightTheme;
}
function readStoredThemePreference() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "system") return "system";
    if (stored === "light" || stored === "studio-light") return "light";
    if (stored === "dark" || stored === "studio-dark") return "dark";
  } catch {
  }
  return DEFAULT_THEME_PREFERENCE;
}
function readStoredThemeId(storageKey, fallback) {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored && stored.trim().length > 0) return normalizeThemeId(stored);
  } catch {
  }
  return fallback;
}
function readStoredAccent() {
  try {
    return normalizeAccent(localStorage.getItem(ACCENT_STORAGE_KEY));
  } catch {
    return DEFAULT_ACCENT;
  }
}
function useTheme() {
  const value = useContext(ThemeContext);
  if (value) return value;
  const themePreference = readStoredThemePreference();
  const lightTheme = readStoredThemeId(LIGHT_THEME_STORAGE_KEY, DEFAULT_LIGHT_THEME);
  const darkTheme = readStoredThemeId(DARK_THEME_STORAGE_KEY, DEFAULT_DARK_THEME);
  const theme = findTheme(BUILT_IN_THEMES, resolveThemePreference(themePreference, readSystemTheme(), lightTheme, darkTheme)).id;
  return {
    theme,
    themePreference,
    lightTheme,
    darkTheme,
    availableThemes: BUILT_IN_THEMES,
    setThemePreference: (nextThemePreference) => {
      setStoredThemeValue(THEME_STORAGE_KEY, nextThemePreference);
      applyTheme(
        findTheme(BUILT_IN_THEMES, resolveThemePreference(nextThemePreference, readSystemTheme(), lightTheme, darkTheme)),
        readStoredAccent()
      );
    },
    setLightTheme: (nextTheme) => setStoredThemeValue(LIGHT_THEME_STORAGE_KEY, normalizeThemeId(nextTheme)),
    setDarkTheme: (nextTheme) => setStoredThemeValue(DARK_THEME_STORAGE_KEY, normalizeThemeId(nextTheme)),
    accent: readStoredAccent(),
    availableAccents: THEME_ACCENTS,
    setAccent: (nextAccent) => {
      const normalizedAccent = normalizeAccent(nextAccent);
      setStoredThemeValue(ACCENT_STORAGE_KEY, normalizedAccent);
      applyAccent(normalizedAccent, findTheme(BUILT_IN_THEMES, theme).appearance);
    },
    toggle: () => {
      const currentTheme = findTheme(BUILT_IN_THEMES, theme);
      setStoredThemeValue(THEME_STORAGE_KEY, currentTheme.appearance === "light" ? "dark" : "light");
    }
  };
}

// packages/desktop/ui/src/components/chat/fileChangeCommands.ts
var FILE_CHANGE_TOGGLE_FIRST_COMMAND_EVENT = "neon-pilot:file-change-toggle-first";
var FILE_CHANGE_CAN_TOGGLE_FIRST_CONTEXT = "fileChange.canToggleFirst";
var fileChangeToggleCapabilityCount = 0;
function registerFileChangeToggleCapability() {
  fileChangeToggleCapabilityCount += 1;
  setExtensionCommandContext(FILE_CHANGE_CAN_TOGGLE_FIRST_CONTEXT, true);
  return () => {
    fileChangeToggleCapabilityCount = Math.max(0, fileChangeToggleCapabilityCount - 1);
    if (fileChangeToggleCapabilityCount === 0) {
      setExtensionCommandContext(FILE_CHANGE_CAN_TOGGLE_FIRST_CONTEXT, null);
    }
  };
}

// packages/desktop/ui/src/components/chat/FileChangesToolDiff.tsx
var fileChangeDiffStyle = {
  "--diffs-font-family": 'var(--font-mono, "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace)',
  "--diffs-header-font-family": "var(--font-sans, Inter, ui-sans-serif, system-ui, sans-serif)",
  "--diffs-font-size": "11px",
  "--diffs-line-height": "1.45",
  "--diffs-tab-size": "2",
  "--diffs-bg-context-override": "rgb(var(--color-terminal-surface))",
  "--diffs-bg-separator-override": "rgb(var(--color-surface))",
  "--diffs-bg-buffer-override": "rgb(var(--color-elevated) / 0.45)",
  "--diffs-bg-hover-override": "rgb(var(--color-hover))",
  "--diffs-fg-number-override": "rgb(var(--color-dim))",
  "--diffs-addition-color-override": "rgb(var(--color-success))",
  "--diffs-deletion-color-override": "rgb(var(--color-danger))",
  "--diffs-modified-color-override": "rgb(var(--color-steel))",
  "--diffs-bg-addition-override": "rgb(var(--color-success) / 0.16)",
  "--diffs-bg-addition-number-override": "rgb(var(--color-success) / 0.10)",
  "--diffs-bg-deletion-override": "rgb(var(--color-danger) / 0.16)",
  "--diffs-bg-deletion-number-override": "rgb(var(--color-danger) / 0.10)",
  "--diffs-bg-addition-emphasis-override": "rgb(var(--color-success) / 0.24)",
  "--diffs-bg-deletion-emphasis-override": "rgb(var(--color-danger) / 0.24)"
};
var PatchDiff = lazy(() => import("./react-7EMEGVFJ.js").then((module) => ({ default: module.PatchDiff })));
function isRecord6(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function readString2(record, key) {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : void 0;
}
function readNumber(record, key) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function readStatus(value) {
  return value === "added" || value === "modified" || value === "deleted" || value === "renamed" || value === "copied" || value === "typechange" || value === "unmerged" || value === "changed" ? value : void 0;
}
function readFileChanges(details) {
  if (!isRecord6(details)) return [];
  const rawFileChanges = Array.isArray(details.fileChanges) ? details.fileChanges : isRecord6(details.result) && Array.isArray(details.result.fileChanges) ? details.result.fileChanges : [];
  return rawFileChanges.flatMap((candidate) => {
    if (!isRecord6(candidate)) return [];
    const path2 = readString2(candidate, "path");
    const status = readStatus(candidate.status);
    if (!path2 || !status) return [];
    return [
      {
        path: path2,
        previousPath: readString2(candidate, "previousPath"),
        status,
        additions: readNumber(candidate, "additions") ?? 0,
        deletions: readNumber(candidate, "deletions") ?? 0,
        patch: readString2(candidate, "patch"),
        truncated: candidate.truncated === true
      }
    ];
  });
}
function readFileChangesForToolBlock(block) {
  const fileChanges = readFileChanges(block.details);
  if (fileChanges.length > 0) return fileChanges;
  return readEditToolFileChanges(block);
}
function readEditToolFileChanges(block) {
  if (block.tool !== "edit" || !isRecord6(block.input)) return [];
  const path2 = readString2(block.input, "path");
  const edits = Array.isArray(block.input.edits) ? block.input.edits : [];
  if (!path2 || edits.length === 0) return [];
  const hunks = [];
  let additions = 0;
  let deletions = 0;
  edits.forEach((candidate, index2) => {
    if (!isRecord6(candidate)) return;
    const oldText = typeof candidate.oldText === "string" ? candidate.oldText : void 0;
    const newText = typeof candidate.newText === "string" ? candidate.newText : void 0;
    if (oldText === void 0 || newText === void 0 || oldText === newText) return;
    const oldLines = splitPatchLines(oldText);
    const newLines = splitPatchLines(newText);
    deletions += oldLines.length;
    additions += newLines.length;
    hunks.push(
      [
        `@@ -${index2 + 1},${Math.max(1, oldLines.length)} +${index2 + 1},${Math.max(1, newLines.length)} @@`,
        ...oldLines.map((line) => `-${line}`),
        ...newLines.map((line) => `+${line}`)
      ].join("\n")
    );
  });
  if (hunks.length === 0) return [];
  const patch2 = [`diff --git a/${path2} b/${path2}`, `--- a/${path2}`, `+++ b/${path2}`, ...hunks].join("\n");
  return [{ path: path2, status: "modified", additions, deletions, patch: patch2, truncated: false }];
}
function splitPatchLines(text7) {
  const normalized = text7.endsWith("\n") ? text7.slice(0, -1) : text7;
  return normalized.length === 0 ? [""] : normalized.split("\n");
}
function resolveDiffThemeType(theme, availableThemes) {
  const appearance = availableThemes.find((candidate) => candidate.id === theme)?.appearance;
  if (appearance === "light" || appearance === "dark") return appearance;
  return theme.toLowerCase().includes("dark") ? "dark" : "light";
}
function statusLabel(status) {
  switch (status) {
    case "added":
      return "Added";
    case "deleted":
      return "Deleted";
    case "renamed":
      return "Renamed";
    case "copied":
      return "Copied";
    case "typechange":
      return "Type change";
    case "unmerged":
      return "Unmerged";
    case "modified":
      return "Modified";
    default:
      return "Changed";
  }
}
function displayPath(change) {
  return change.previousPath && change.previousPath !== change.path ? `${change.previousPath} \u2192 ${change.path}` : change.path;
}
function FileChangesToolDiff({ fileChanges }) {
  const { theme, availableThemes } = useTheme();
  const [expanded, setExpanded] = useState(() => new Set(fileChanges.slice(0, 3).map((change) => displayPath(change))));
  const themeType = resolveDiffThemeType(theme, availableThemes);
  const diffOptions = useMemo(
    () => ({
      theme: { dark: "tokyo-night", light: "github-light" },
      themeType,
      diffStyle: "split",
      diffIndicators: "classic",
      disableFileHeader: true,
      hunkSeparators: "metadata",
      lineDiffType: "word-alt",
      overflow: "wrap"
    }),
    [themeType]
  );
  const firstFileChangeKey = fileChanges[0] ? displayPath(fileChanges[0]) : null;
  useEffect(() => {
    if (!firstFileChangeKey) return void 0;
    return registerFileChangeToggleCapability();
  }, [firstFileChangeKey]);
  useEffect(() => {
    function handleToggleFirstFileChange(event) {
      const detail = event.detail;
      if (detail?.handled || !firstFileChangeKey) return;
      if (detail) detail.handled = true;
      setExpanded((current) => {
        const next = new Set(current);
        if (next.has(firstFileChangeKey)) next.delete(firstFileChangeKey);
        else next.add(firstFileChangeKey);
        return next;
      });
    }
    window.addEventListener(FILE_CHANGE_TOGGLE_FIRST_COMMAND_EVENT, handleToggleFirstFileChange);
    return () => window.removeEventListener(FILE_CHANGE_TOGGLE_FIRST_COMMAND_EVENT, handleToggleFirstFileChange);
  }, [firstFileChangeKey]);
  if (fileChanges.length === 0) return null;
  return /* @__PURE__ */ jsx("div", { className: "border-t border-border-subtle/70 bg-surface/45 px-2.5 py-2 font-sans text-[11px]", children: /* @__PURE__ */ jsx("div", { className: "space-y-2", children: fileChanges.map((change) => {
    const key = displayPath(change);
    const open = expanded.has(key);
    return /* @__PURE__ */ jsxs("section", { className: "ui-panel-muted overflow-hidden", children: [
      /* @__PURE__ */ jsxs(
        RowButton,
        {
          onClick: () => {
            setExpanded((current) => {
              const next = new Set(current);
              if (next.has(key)) next.delete(key);
              else next.add(key);
              return next;
            });
          },
          className: "px-2.5 py-2",
          children: [
            /* @__PURE__ */ jsx("span", { className: cx("shrink-0 text-dim transition-transform", open && "rotate-90"), "aria-hidden": "true", children: "\u203A" }),
            /* @__PURE__ */ jsx("span", { className: "min-w-0 flex-1 truncate font-mono text-[11px] text-primary", title: key, children: key }),
            /* @__PURE__ */ jsx(MetaLabel, { tone: "muted", children: statusLabel(change.status) }),
            /* @__PURE__ */ jsxs("span", { className: "shrink-0 font-mono tabular-nums", children: [
              /* @__PURE__ */ jsxs("span", { className: "text-success", children: [
                "+",
                change.additions
              ] }),
              " ",
              /* @__PURE__ */ jsxs("span", { className: "text-danger", children: [
                "-",
                change.deletions
              ] })
            ] })
          ]
        }
      ),
      open ? change.patch ? /* @__PURE__ */ jsx("div", { className: "overflow-hidden bg-surface", children: /* @__PURE__ */ jsx(Suspense, { fallback: /* @__PURE__ */ jsx("div", { className: "px-3 py-2 text-dim", children: "Loading diff..." }), children: /* @__PURE__ */ jsx(PatchDiff, { patch: change.patch, options: diffOptions, style: fileChangeDiffStyle }) }) }) : /* @__PURE__ */ jsx("div", { className: "px-3 py-2 text-dim", children: change.truncated ? "Diff too large to show inline." : "Diff unavailable for this file change." }) : null
    ] }, key);
  }) }) });
}

// packages/desktop/ui/src/components/chat/TerminalToolBlock.tsx
init_neon_pilot_shared_react();
var TerminalToolBlock = memo(function TerminalToolBlock2({
  block,
  onHydrateMessage,
  hydratingMessageBlockIds
}) {
  const presentation = readTerminalBashToolPresentation(block);
  if (!presentation) {
    return null;
  }
  const isRunning = block.status === "running" || !!block.running;
  const isError = block.status === "error" || !!block.error || (presentation.exitCode ?? 0) !== 0 && presentation.exitCode !== void 0;
  const blockId = typeof block.id === "string" ? block.id.trim() : "";
  const outputDeferred = Boolean(block.outputDeferred && blockId && onHydrateMessage);
  const hydratingDeferredOutput = Boolean(blockId && hydratingMessageBlockIds?.has(blockId));
  const prefetchDeferredOutput = () => {
    if (!outputDeferred || !blockId || hydratingDeferredOutput) {
      return;
    }
    void onHydrateMessage?.(blockId);
  };
  const hasBody = isRunning || block.output || outputDeferred;
  const copyText = block.output ? `$ ${presentation.command}
${block.output}` : `$ ${presentation.command}`;
  const footerBits = [];
  const runs = useAllRuns();
  const tasks = useAllTasks();
  const sessions = useAllSessions();
  const runLookups = { tasks, sessions };
  const linkedRuns = block.output ? readMentionedLinkedRunsFromText(block.output).filter((run) => Boolean(resolveLinkedRunRecord(run, runs, runLookups))) : [];
  const [expandedRunKeys, setExpandedRunKeys] = useState(() => /* @__PURE__ */ new Set());
  if (presentation.cancelled) {
    footerBits.push("cancelled");
  } else if (presentation.exitCode !== void 0) {
    footerBits.push(`exit ${presentation.exitCode}`);
  } else if (isRunning) {
    footerBits.push("running");
  }
  if (presentation.truncated) {
    footerBits.push("truncated");
  }
  if (block.durationMs && !isRunning) {
    footerBits.push(`${(block.durationMs / 1e3).toFixed(1)}s`);
  }
  return /* @__PURE__ */ jsxs("div", { className: "group space-y-1.5", onMouseEnter: prefetchDeferredOutput, onFocus: prefetchDeferredOutput, children: [
    /* @__PURE__ */ jsxs("div", { className: cx("ui-terminal-block", isError ? "text-danger" : null), children: [
      /* @__PURE__ */ jsxs("div", { className: "ui-terminal-block__chrome flex items-center gap-2 border-b px-3 py-2 text-[11px]", children: [
        /* @__PURE__ */ jsx("span", { className: "ui-terminal-block__command min-w-0 flex-1 break-all", children: presentation.command }),
        presentation.executionWrappers.map((wrapper) => /* @__PURE__ */ jsx(Pill, { tone: "accent", mono: true, children: wrapper.label ?? wrapper.id }, wrapper.id)),
        presentation.excludeFromContext && /* @__PURE__ */ jsx(Pill, { tone: "warning", mono: true, children: "no context" })
      ] }),
      hasBody && /* @__PURE__ */ jsx("div", { className: "px-3 py-2.5 max-h-96 overflow-y-auto", children: block.output ? /* @__PURE__ */ jsx(
        "pre",
        {
          className: cx(
            "whitespace-pre-wrap break-all text-[11px] leading-relaxed",
            isError ? "text-danger/85" : "ui-terminal-block__output"
          ),
          children: block.output
        }
      ) : isRunning ? /* @__PURE__ */ jsx("p", { className: "ui-terminal-block__muted text-[11px] italic leading-relaxed", children: "Waiting for output\u2026" }) : outputDeferred ? /* @__PURE__ */ jsx("p", { className: "ui-terminal-block__muted text-[11px] italic leading-relaxed", children: "Older terminal output is available on demand." }) : null }),
      /* @__PURE__ */ jsxs("div", { className: "ui-terminal-block__chrome ui-terminal-block__muted flex flex-wrap items-center gap-2 border-t px-3 py-2 text-[10px]", children: [
        footerBits.map((bit) => /* @__PURE__ */ jsx("span", { children: bit }, bit)),
        presentation.fullOutputPath && /* @__PURE__ */ jsx("span", { children: "full output saved" }),
        outputDeferred && blockId && /* @__PURE__ */ jsx(
          Button,
          {
            variant: "action",
            onClick: () => {
              void onHydrateMessage?.(blockId);
            },
            disabled: hydratingDeferredOutput,
            className: "text-[10px]",
            children: hydratingDeferredOutput ? "Loading full output\u2026" : "Load full output"
          }
        ),
        /* @__PURE__ */ jsx("span", { className: "ml-auto", children: timeAgo(block.ts) })
      ] })
    ] }),
    linkedRuns.length > 0 && /* @__PURE__ */ jsx("div", { className: "space-y-1.5", children: linkedRuns.map((run) => {
      const inlineRunKey = buildInlineRunExpansionKey(0, `${blockId ?? "terminal"}:${run.runId}`);
      const expanded = expandedRunKeys.has(inlineRunKey);
      return /* @__PURE__ */ jsx(
        InlineTraceRunCard,
        {
          run,
          expanded,
          onToggle: () => setExpandedRunKeys((current) => {
            const next = new Set(current);
            if (next.has(inlineRunKey)) {
              next.delete(inlineRunKey);
            } else {
              next.add(inlineRunKey);
            }
            return next;
          })
        },
        inlineRunKey
      );
    }) }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ jsx("span", { className: "flex-1" }),
      /* @__PURE__ */ jsx(MessageActions, { blockText: block.output ?? "", blockId, copyText })
    ] })
  ] });
});

// packages/desktop/ui/src/components/chat/toolBlockCommands.ts
var TOOL_BLOCK_TOGGLE_FIRST_COMMAND_EVENT = "neon-pilot:tool-block-toggle-first";
var TOOL_BLOCK_TOGGLE_FIRST_LINKED_RUNS_COMMAND_EVENT = "neon-pilot:tool-block-toggle-first-linked-runs";
var TOOL_BLOCK_CAN_TOGGLE_FIRST_CONTEXT = "toolBlock.canToggleFirst";
var TOOL_BLOCK_CAN_TOGGLE_FIRST_LINKED_RUNS_CONTEXT = "toolBlock.canToggleFirstLinkedRuns";
var toolBlockToggleCapabilityCount = 0;
var toolBlockLinkedRunsToggleCapabilityCount = 0;
function registerToolBlockToggleCapability() {
  toolBlockToggleCapabilityCount += 1;
  setExtensionCommandContext(TOOL_BLOCK_CAN_TOGGLE_FIRST_CONTEXT, true);
  return () => {
    toolBlockToggleCapabilityCount = Math.max(0, toolBlockToggleCapabilityCount - 1);
    if (toolBlockToggleCapabilityCount === 0) {
      setExtensionCommandContext(TOOL_BLOCK_CAN_TOGGLE_FIRST_CONTEXT, null);
    }
  };
}
function registerToolBlockLinkedRunsToggleCapability() {
  toolBlockLinkedRunsToggleCapabilityCount += 1;
  setExtensionCommandContext(TOOL_BLOCK_CAN_TOGGLE_FIRST_LINKED_RUNS_CONTEXT, true);
  return () => {
    toolBlockLinkedRunsToggleCapabilityCount = Math.max(0, toolBlockLinkedRunsToggleCapabilityCount - 1);
    if (toolBlockLinkedRunsToggleCapabilityCount === 0) {
      setExtensionCommandContext(TOOL_BLOCK_CAN_TOGGLE_FIRST_LINKED_RUNS_CONTEXT, null);
    }
  };
}

// packages/desktop/ui/src/components/chat/ToolBlock.tsx
var MAX_VISIBLE_LINKED_RUNS = 5;
var BUILTIN_CHECKPOINT_RENDERER2 = {
  extension: {
    id: "system-diffs",
    name: "Diffs",
    packageType: "system",
    enabled: true,
    status: "enabled",
    manifest: {
      schemaVersion: 2,
      id: "system-diffs",
      name: "Diffs",
      packageType: "system",
      frontend: { entry: "dist/frontend.js" },
      contributes: {}
    },
    permissions: [],
    surfaces: [],
    routes: []
  },
  renderer: {
    id: "checkpoint-tool-block",
    tool: "checkpoint",
    component: "CheckpointTranscriptRenderer",
    standalone: true
  }
};
function BackgroundBashInlineOutput({
  runId,
  command,
  run,
  streaming
}) {
  const pollEnabled = shouldPollInlineRunSnapshot({
    run,
    visible: true,
    open: true,
    streaming
  });
  const snapshot = usePolledDurableRunSnapshot(pollEnabled ? runId : null, pollEnabled, {
    tail: INLINE_RUN_LOG_TAIL_LINES,
    pollIntervalMs: INLINE_RUN_POLL_INTERVAL_MS
  });
  const running = isRunActive(snapshot.detail?.run ?? run ?? null) || streaming;
  const log = stripAnsiForTranscript(snapshot.log?.log ?? "");
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: "border-t border-border-subtle/70 bg-black/10 px-2.5 py-2 max-h-96 overflow-y-auto",
      tabIndex: -1,
      ...transcriptTargetAttributes({ kind: "background_run", runId }),
      children: [
        /* @__PURE__ */ jsx("span", { className: "sr-only", children: "input" }),
        /* @__PURE__ */ jsxs("pre", { className: "whitespace-pre-wrap break-words text-[11px] leading-relaxed opacity-80", children: [
          /* @__PURE__ */ jsx("span", { className: "opacity-60", children: "$ " }),
          command,
          log ? `
${log}` : running || snapshot.loading ? "\nWaiting for output\u2026" : "\n(no output)"
        ] })
      ]
    }
  );
}
function getLinkedRunConversationRoute(linkedRun, runRecords, runLookups) {
  const run = resolveLinkedRunRecord(linkedRun, runRecords, runLookups ?? {}) ?? runRecords.find((candidate) => candidate.runId === linkedRun.runId);
  if (!run) {
    return void 0;
  }
  return getRunConnections(run, runLookups).find((connection) => connection.label === "Conversation transcript" && connection.to)?.to;
}
function readToolDetailString(details, key) {
  if (!details || typeof details !== "object") return void 0;
  const value = details[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : void 0;
}
function readToolInputString(input, key) {
  const value = input[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : void 0;
}
function readArtifactId(block) {
  return readToolInputString(block.input, "artifactId") ?? readToolDetailString(block.details, "artifactId") ?? (/\bartifact\s+([A-Za-z0-9_.:-]+)\b/i.exec(block.output ?? "")?.[1]?.trim() || void 0);
}
function readArtifactTitle(block) {
  return readToolInputString(block.input, "title") ?? readToolDetailString(block.details, "title") ?? readArtifactId(block);
}
function isDurableArtifactTool(block) {
  if (block.tool !== "artifact") return false;
  const action = readToolInputString(block.input, "action") ?? readToolDetailString(block.details, "action");
  return action !== "list" && action !== "delete" && Boolean(readArtifactTitle(block));
}
function isPinnedVisualTool(block) {
  return block.tool === "image" || block.tool === "browser_screenshot" || block.tool === "screenshot";
}
function isFileChangingTool(block, fileChanges) {
  return fileChanges.length > 0 || block.tool === "write" || block.tool === "edit" || block.tool === "apply_patch";
}
function isCheckpointFailureOutput(block) {
  if (block.tool !== "checkpoint") return false;
  const output = stripAnsiForTranscript(block.output ?? "");
  return /\b(refusing to checkpoint|failed to push|rejected|non-fast-forward|error:)\b/i.test(output);
}
function ToolBlock({
  block,
  autoOpen,
  onOpenArtifact,
  activeArtifactId,
  onOpenCheckpoint,
  activeCheckpointId,
  onOpenBrowser,
  onOpenFilePath: _onOpenFilePath,
  validatedFilePathTargets: _validatedFilePathTargets,
  onHydrateMessage,
  hydratingMessageBlockIds,
  messages,
  messageIndex,
  onSubmitAskUserQuestion,
  askUserQuestionDisplayMode = "inline",
  diffDisclosureMode = "collapsed"
}) {
  const [preference, setPreference] = useState("auto");
  const [showAllRuns, setShowAllRuns] = useState(false);
  const [expandedMentionedRunKeys, setExpandedMentionedRunKeys] = useState(() => /* @__PURE__ */ new Set());
  const [pinnedDiffOpen, setPinnedDiffOpen] = useState(() => diffDisclosureMode === "expanded");
  useEffect(() => {
    setPinnedDiffOpen(diffDisclosureMode === "expanded");
  }, [diffDisclosureMode]);
  const backgroundShellStart = isBackgroundShellStart(block);
  const open = resolveDisclosureOpen(autoOpen, preference);
  const terminalBashBlock = isTerminalBashToolBlock(block);
  const extensionRegistry = useExtensionRegistry();
  const tasks = useAllTasks();
  const sessions = useAllSessions();
  const runRecords = useAllRuns();
  const runLookups = useMemo(() => ({ tasks, sessions }), [tasks, sessions]);
  const extensionRenderer = useMemo(() => {
    if (block.tool === "bash") {
      return null;
    }
    for (const extension2 of extensionRegistry.extensions) {
      const renderer = extension2.manifest?.contributes?.transcriptRenderers?.find((candidate) => candidate.tool === block.tool);
      if (renderer && extension2.enabled) return { extension: extension2, renderer };
    }
    if (block.tool === "checkpoint") return BUILTIN_CHECKPOINT_RENDERER2;
    return null;
  }, [block.tool, extensionRegistry.extensions]);
  const agentBashTool = block.tool === "bash" && !backgroundShellStart;
  const meta = backgroundShellStart ? toolMeta("bash") : toolMeta(block.tool);
  const executionWrappers = useMemo(() => readToolExecutionWrappers(block), [block]);
  const linkedRuns = useMemo(() => readLinkedRuns(block), [block]);
  const fileChanges = useMemo(() => readFileChangesForToolBlock(block), [block]);
  const isRunning = block.status === "running" || !!block.running;
  const isError = block.status === "error" || !!block.error || isCheckpointFailureOutput(block);
  const subagentPrompt = block.tool === "subagent" ? readToolInputString(block.input, "prompt") : void 0;
  const subagentTask = block.tool === "subagent" ? readToolInputString(block.input, "taskSlug") : void 0;
  const subagentConversationId = block.tool === "subagent" ? readToolDetailString(block.details, "childConversationId") : void 0;
  const subagentLinkedConversationRoute = block.tool === "subagent" ? linkedRuns.runs.map((linkedRun) => getLinkedRunConversationRoute(linkedRun, runRecords, runLookups)).find((route) => Boolean(route)) : void 0;
  const subagentConversationRoute = subagentConversationId ? `/conversations/${encodeURIComponent(subagentConversationId)}` : subagentLinkedConversationRoute;
  const subagentTitle = block.tool === "subagent" ? readToolDetailString(block.details, "branchTitle") ?? subagentTask : void 0;
  const artifactId = block.tool === "artifact" ? readArtifactId(block) : void 0;
  const artifactTitle = block.tool === "artifact" ? readArtifactTitle(block) : void 0;
  const artifactAction = block.tool === "artifact" ? readToolInputString(block.input, "action") ?? readToolDetailString(block.details, "action") : void 0;
  const pinnedSubagent = block.tool === "subagent" && Boolean(subagentConversationRoute);
  const checkpointAction = block.tool === "checkpoint" ? readToolInputString(block.input, "action") ?? readToolDetailString(block.details, "action") : void 0;
  const useExtensionRenderer = extensionRenderer && !(block.tool === "checkpoint" && checkpointAction === "list") && !(block.tool === "artifact" && (artifactAction === "list" || artifactAction === "delete"));
  const pinnedCheckpoint = block.tool === "checkpoint" && checkpointAction === "save" && !isRunning && !isError;
  const pinnedArtifact = isDurableArtifactTool(block);
  const pinnedVisual = isPinnedVisualTool(block);
  const fileChangingTool = isFileChangingTool(block, fileChanges);
  const pinnedTool = pinnedSubagent || pinnedCheckpoint || pinnedArtifact || pinnedVisual;
  const output = stripAnsiForTranscript(block.output ?? "");
  const blockId = typeof block.id === "string" ? block.id.trim() : "";
  const outputDeferred = Boolean(block.outputDeferred && blockId && onHydrateMessage);
  const hydratingDeferredOutput = Boolean(blockId && hydratingMessageBlockIds?.has(blockId));
  const prefetchDeferredOutput = () => {
    if (!outputDeferred || !blockId || hydratingDeferredOutput) {
      return;
    }
    void onHydrateMessage?.(blockId);
  };
  const preview = buildToolPreview(block);
  const bareLinkedRunOnly = agentBashTool && linkedRuns.scope === "mentioned" && linkedRuns.runs.length === 1 && preview === "" && output.trim() === linkedRuns.runs[0]?.runId;
  const visualPreview = readToolInputString(block.input, "prompt") ?? readToolInputString(block.input, "tabId") ?? preview;
  const displayPreview = bareLinkedRunOnly ? linkedRuns.runs[0]?.title : block.tool === "subagent" ? subagentTitle ?? subagentPrompt ?? preview : block.tool === "artifact" ? artifactTitle ?? preview : pinnedVisual ? visualPreview : preview;
  const displayedLinkedRuns = linkedRuns.scope === "listed" ? linkedRuns.runs : [];
  const hiddenRunCount = Math.max(0, displayedLinkedRuns.length - MAX_VISIBLE_LINKED_RUNS);
  const toggleLinkedRuns = useCallback(() => {
    setShowAllRuns((current) => !current);
  }, []);
  const canToggleLinkedRuns = hiddenRunCount > 0 && !pinnedTool && !backgroundShellStart;
  const mentionedInlineRuns = bareLinkedRunOnly ? linkedRuns.runs : [];
  const visibleRuns = showAllRuns || hiddenRunCount === 0 ? displayedLinkedRuns : displayedLinkedRuns.slice(0, MAX_VISIBLE_LINKED_RUNS);
  const backgroundRunId = backgroundShellStart ? linkedRuns.runs[0]?.runId : void 0;
  const backgroundRun = backgroundRunId ? runRecords.find((candidate) => candidate.runId === backgroundRunId) : null;
  const bashCommand = readToolInputString(block.input, "command") ?? preview;
  const headerDisclosureLabel = subagentConversationRoute ? "open" : fileChangingTool && fileChanges.length > 0 && !isRunning && !isError ? pinnedDiffOpen ? "Hide diff" : "View diff" : open ? "hide" : "show";
  const canToggleHeaderDisclosure = !terminalBashBlock && !useExtensionRenderer && !subagentConversationRoute;
  const toggleHeaderDisclosure = useCallback(() => {
    if (fileChangingTool && fileChanges.length > 0 && !isRunning && !isError) {
      setPinnedDiffOpen((current) => !current);
      return;
    }
    setPreference((current) => toggleDisclosurePreference(autoOpen, current));
  }, [autoOpen, fileChanges.length, fileChangingTool, isError, isRunning]);
  useEffect(() => {
    if (!canToggleHeaderDisclosure) return void 0;
    return registerToolBlockToggleCapability();
  }, [canToggleHeaderDisclosure]);
  useEffect(() => {
    function handleToggleFirstToolBlock(event) {
      const detail = event.detail;
      if (detail?.handled || !canToggleHeaderDisclosure) return;
      if (detail) detail.handled = true;
      toggleHeaderDisclosure();
    }
    window.addEventListener(TOOL_BLOCK_TOGGLE_FIRST_COMMAND_EVENT, handleToggleFirstToolBlock);
    return () => window.removeEventListener(TOOL_BLOCK_TOGGLE_FIRST_COMMAND_EVENT, handleToggleFirstToolBlock);
  }, [canToggleHeaderDisclosure, toggleHeaderDisclosure]);
  useEffect(() => {
    if (!canToggleLinkedRuns) return void 0;
    return registerToolBlockLinkedRunsToggleCapability();
  }, [canToggleLinkedRuns]);
  useEffect(() => {
    function handleToggleFirstToolBlockLinkedRuns(event) {
      const detail = event.detail;
      if (detail?.handled || !canToggleLinkedRuns) return;
      if (detail) detail.handled = true;
      toggleLinkedRuns();
    }
    window.addEventListener(TOOL_BLOCK_TOGGLE_FIRST_LINKED_RUNS_COMMAND_EVENT, handleToggleFirstToolBlockLinkedRuns);
    return () => window.removeEventListener(TOOL_BLOCK_TOGGLE_FIRST_LINKED_RUNS_COMMAND_EVENT, handleToggleFirstToolBlockLinkedRuns);
  }, [canToggleLinkedRuns, toggleLinkedRuns]);
  if (terminalBashBlock) {
    return /* @__PURE__ */ jsx(TerminalToolBlock, { block, onHydrateMessage, hydratingMessageBlockIds });
  }
  if (useExtensionRenderer && pinnedCheckpoint) {
    return /* @__PURE__ */ jsx(
      NativeExtensionToolBlockHost,
      {
        extension: useExtensionRenderer.extension,
        renderer: useExtensionRenderer.renderer,
        block,
        context: {
          onOpenCheckpoint,
          activeCheckpointId,
          messages,
          messageIndex,
          onHydrateMessage,
          hydratingMessageBlockIds
        }
      }
    );
  }
  if (useExtensionRenderer && !pinnedTool) {
    return /* @__PURE__ */ jsxs(Fragment2, { children: [
      /* @__PURE__ */ jsx(
        NativeExtensionToolBlockHost,
        {
          extension: useExtensionRenderer.extension,
          renderer: useExtensionRenderer.renderer,
          block,
          context: {
            onOpenArtifact,
            activeArtifactId,
            onOpenCheckpoint,
            activeCheckpointId,
            onOpenBrowser,
            messages,
            messageIndex,
            onSubmitAskUserQuestion,
            askUserQuestionDisplayMode,
            onHydrateMessage,
            hydratingMessageBlockIds
          }
        }
      ),
      fileChanges.length > 0 && !isRunning && !isError ? /* @__PURE__ */ jsx(FileChangesToolDiff, { fileChanges }) : null
    ] });
  }
  const headerClassName = cx(
    "ui-row-button w-full flex items-center gap-2 px-2.5 py-2 text-left",
    (subagentConversationRoute || fileChangingTool && fileChanges.length > 0 && !isRunning && !isError) && "cursor-pointer"
  );
  const headerContent = /* @__PURE__ */ jsxs(Fragment2, { children: [
    /* @__PURE__ */ jsx(Pill, { tone: isError ? "danger" : meta.tone, mono: true, className: "shrink-0", children: meta.label }),
    backgroundShellStart && /* @__PURE__ */ jsx(Pill, { tone: "accent", mono: true, className: "shrink-0", children: "background task" }),
    executionWrappers.map((wrapper) => /* @__PURE__ */ jsx(Pill, { tone: "accent", mono: true, className: "shrink-0", children: wrapper.label ?? wrapper.id }, wrapper.id)),
    /* @__PURE__ */ jsx("span", { className: cx("flex-1 opacity-70 font-normal", agentBashTool ? "whitespace-normal break-words" : "truncate"), children: displayPreview }),
    pinnedTool ? /* @__PURE__ */ jsx("span", { className: "shrink-0 text-[10px] text-dim font-sans", children: timeAgo(block.ts) }) : null,
    pinnedArtifact && artifactId && onOpenArtifact ? /* @__PURE__ */ jsx(
      Button,
      {
        variant: "action",
        className: "shrink-0 text-[10px] font-sans",
        onClick: (event) => {
          event.stopPropagation();
          onOpenArtifact(artifactId);
        },
        children: "View"
      }
    ) : null,
    block.durationMs && !isRunning && !pinnedTool && /* @__PURE__ */ jsxs("span", { className: "shrink-0 opacity-40 ml-2", children: [
      (block.durationMs / 1e3).toFixed(1),
      "s"
    ] }),
    isRunning ? /* @__PURE__ */ jsxs(Fragment2, { children: [
      /* @__PURE__ */ jsx("span", { className: "shrink-0 text-[10px] opacity-60 ml-2", children: "running\u2026" }),
      /* @__PURE__ */ jsx("span", { className: "shrink-0 opacity-50 text-[10px]", children: headerDisclosureLabel })
    ] }) : /* @__PURE__ */ jsx("span", { className: "shrink-0 opacity-50 text-[10px]", children: headerDisclosureLabel })
  ] });
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: cx(
        "rounded-lg text-[12px] font-mono overflow-hidden transition-colors",
        meta.color,
        isError && "border border-border-subtle/70 bg-elevated/25 text-danger"
      ),
      children: [
        subagentConversationRoute ? /* @__PURE__ */ jsx(
          Link,
          {
            to: subagentConversationRoute,
            "data-background-run-id": backgroundRunId,
            ...backgroundRunId ? transcriptTargetAttributes({ kind: "background_run", runId: backgroundRunId }) : {},
            onMouseEnter: prefetchDeferredOutput,
            onFocus: prefetchDeferredOutput,
            className: headerClassName,
            children: headerContent
          }
        ) : /* @__PURE__ */ jsx(
          "div",
          {
            role: "button",
            tabIndex: 0,
            "data-background-run-id": backgroundRunId,
            ...backgroundRunId ? transcriptTargetAttributes({ kind: "background_run", runId: backgroundRunId }) : {},
            onMouseEnter: prefetchDeferredOutput,
            onFocus: prefetchDeferredOutput,
            onClick: toggleHeaderDisclosure,
            onKeyDown: (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleHeaderDisclosure();
              }
            },
            className: headerClassName,
            children: headerContent
          }
        ),
        displayedLinkedRuns.length > 0 && !pinnedTool && !backgroundShellStart && /* @__PURE__ */ jsxs("div", { className: "border-t border-border-subtle/70 bg-black/5 px-2.5 py-2 text-[11px] font-sans", children: [
          /* @__PURE__ */ jsx(SectionLabel, { tone: "muted", className: "mb-1.5 block opacity-70", children: displayedLinkedRuns.length === 1 ? "listed execution" : "listed executions" }),
          hiddenRunCount > 0 && /* @__PURE__ */ jsxs("div", { className: "mb-2 flex flex-wrap items-center gap-2 rounded-md bg-black/5 px-2 py-1.5 text-[10px] text-secondary/80", children: [
            /* @__PURE__ */ jsx("span", { children: showAllRuns ? `Showing all ${displayedLinkedRuns.length} executions returned by the tool.` : `Showing ${MAX_VISIBLE_LINKED_RUNS} of ${displayedLinkedRuns.length} executions returned by the tool.` }),
            /* @__PURE__ */ jsx("span", { className: "flex-1" }),
            /* @__PURE__ */ jsx(Button, { variant: "action", onClick: toggleLinkedRuns, className: "text-[10px]", children: showAllRuns ? "Show fewer" : "Show all" })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "space-y-1.5", children: visibleRuns.map((linkedRun) => {
            const conversationRoute = getLinkedRunConversationRoute(linkedRun, runRecords, runLookups);
            return /* @__PURE__ */ jsx("div", { className: "w-full rounded-md px-2 py-1.5 text-left text-dim", children: /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-3", children: [
              /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
                /* @__PURE__ */ jsx("p", { className: "truncate font-medium leading-4 text-primary", children: linkedRun.title }),
                linkedRun.detail && /* @__PURE__ */ jsx("p", { className: "mt-1 truncate text-[10px] leading-4 text-secondary/80", children: linkedRun.detail })
              ] }),
              conversationRoute ? /* @__PURE__ */ jsx(
                Link,
                {
                  to: conversationRoute,
                  className: "ui-action-button shrink-0 text-[10px]",
                  onClick: (event) => event.stopPropagation(),
                  children: "Open conversation"
                }
              ) : /* @__PURE__ */ jsx(MetaLabel, { tone: "muted", className: "opacity-70", children: "linked" })
            ] }) }, linkedRun.runId);
          }) })
        ] }),
        mentionedInlineRuns.length > 0 && !pinnedTool && !backgroundShellStart && /* @__PURE__ */ jsx("div", { className: "space-y-1.5 border-t border-border-subtle/70 bg-black/5 px-2.5 py-2 font-sans", children: mentionedInlineRuns.map((run) => {
          const inlineRunKey = buildInlineRunExpansionKey(messageIndex ?? 0, `${blockId || block.ts}:${run.runId}`);
          const expanded = expandedMentionedRunKeys.has(inlineRunKey);
          return /* @__PURE__ */ jsx(
            InlineTraceRunCard,
            {
              run,
              expanded,
              onToggle: () => setExpandedMentionedRunKeys((current) => {
                const next = new Set(current);
                if (next.has(inlineRunKey)) {
                  next.delete(inlineRunKey);
                } else {
                  next.add(inlineRunKey);
                }
                return next;
              })
            },
            inlineRunKey
          );
        }) }),
        fileChanges.length > 0 && !isRunning && !isError && (!fileChangingTool || pinnedDiffOpen) ? /* @__PURE__ */ jsx(FileChangesToolDiff, { fileChanges }) : null,
        open && !pinnedTool && agentBashTool && !bareLinkedRunOnly && /* @__PURE__ */ jsxs("div", { className: "border-t border-border-subtle/70 bg-black/10 px-2.5 py-2 max-h-96 overflow-y-auto", children: [
          /* @__PURE__ */ jsx("span", { className: "sr-only", children: "input" }),
          /* @__PURE__ */ jsxs("pre", { className: "whitespace-pre-wrap break-words text-[11px] leading-relaxed opacity-80", children: [
            /* @__PURE__ */ jsx("span", { className: "opacity-60", children: "$ " }),
            bashCommand,
            output ? `
${output}` : isRunning ? "\nWaiting for output\u2026" : outputDeferred ? "\nOlder tool output is available on demand." : ""
          ] }),
          outputDeferred && blockId && /* @__PURE__ */ jsx(
            Button,
            {
              variant: "action",
              onClick: () => {
                void onHydrateMessage?.(blockId);
              },
              disabled: hydratingDeferredOutput,
              className: "mt-2 text-[10px]",
              children: hydratingDeferredOutput ? "Loading full output\u2026" : "Load full output"
            }
          )
        ] }),
        open && !pinnedTool && backgroundShellStart && backgroundRunId && /* @__PURE__ */ jsx(BackgroundBashInlineOutput, { runId: backgroundRunId, command: bashCommand, run: backgroundRun, streaming: isRunning }),
        open && !pinnedTool && !agentBashTool && !backgroundShellStart && /* @__PURE__ */ jsx("div", { className: "border-t border-border-subtle/70", children: (isRunning || output || outputDeferred) && /* @__PURE__ */ jsxs("div", { className: "px-2.5 py-2 max-h-96 overflow-y-auto", children: [
          output ? /* @__PURE__ */ jsx("pre", { className: "whitespace-pre-wrap break-all text-[11px] leading-relaxed opacity-75", children: output }) : isRunning ? /* @__PURE__ */ jsx("p", { className: "text-[11px] italic leading-relaxed opacity-55", children: "Waiting for output\u2026" }) : outputDeferred ? /* @__PURE__ */ jsx("p", { className: "text-[11px] italic leading-relaxed opacity-55", children: "Older tool output is available on demand." }) : null,
          outputDeferred && blockId && /* @__PURE__ */ jsx(
            Button,
            {
              variant: "action",
              onClick: () => {
                void onHydrateMessage?.(blockId);
              },
              disabled: hydratingDeferredOutput,
              className: "mt-2 text-[10px]",
              children: hydratingDeferredOutput ? "Loading full output\u2026" : "Load full output"
            }
          )
        ] }) })
      ]
    }
  );
}

// packages/desktop/ui/src/components/chat/TraceBlocks.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/transcript/streamingThroughput.ts
var MIN_VISIBLE_ELAPSED_MS = 500;
var MIN_RATE_WINDOW_MS = 1e3;
function estimateStreamedTextTokens(text7) {
  if (!text7) {
    return 0;
  }
  return Math.ceil(text7.length / 4);
}
function findStreamingTailBlock(blocks) {
  const tail = blocks[blocks.length - 1];
  if (!tail || tail.type !== "text" && tail.type !== "thinking") {
    return null;
  }
  return tail;
}
function parseIsoTimestamp(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return Number.NaN;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : Number.NaN;
}
function readStreamingThroughput(blocks, isStreaming, nowMs = Date.now()) {
  if (!isStreaming || !Number.isSafeInteger(nowMs)) {
    return null;
  }
  const tail = findStreamingTailBlock(blocks);
  if (!tail || typeof tail.text !== "string") {
    return null;
  }
  const estimatedTokens = estimateStreamedTextTokens(tail.text);
  if (estimatedTokens <= 0) {
    return null;
  }
  const startedAtMs = parseIsoTimestamp(tail.ts);
  if (!Number.isFinite(startedAtMs)) {
    return null;
  }
  const elapsedMs = Math.max(0, nowMs - startedAtMs);
  if (elapsedMs < MIN_VISIBLE_ELAPSED_MS) {
    return null;
  }
  const rateWindowSeconds = Math.max(elapsedMs / 1e3, MIN_RATE_WINDOW_MS / 1e3);
  const tokensPerSecond = estimatedTokens / rateWindowSeconds;
  if (!Number.isFinite(tokensPerSecond) || tokensPerSecond <= 0) {
    return null;
  }
  return {
    kind: tail.type,
    estimatedTokens,
    elapsedMs,
    tokensPerSecond
  };
}
function formatStreamingThroughputLabel(sample) {
  if (!sample) {
    return null;
  }
  const formatted = sample.tokensPerSecond >= 10 ? sample.tokensPerSecond.toFixed(0) : sample.tokensPerSecond.toFixed(1);
  return `~${formatted} tok/s`;
}
function getStreamingThroughputLabel(blocks, isStreaming, nowMs = Date.now()) {
  return formatStreamingThroughputLabel(readStreamingThroughput(blocks, isStreaming, nowMs));
}

// packages/desktop/ui/src/components/chat/subagentBlockCommands.ts
var SUBAGENT_BLOCK_TOGGLE_FIRST_COMMAND_EVENT = "neon-pilot:subagent-block-toggle-first";
var SUBAGENT_BLOCK_CAN_TOGGLE_FIRST_CONTEXT = "subagentBlock.canToggleFirst";
var subagentBlockToggleCapabilityCount = 0;
function registerSubagentBlockToggleCapability() {
  subagentBlockToggleCapabilityCount += 1;
  setExtensionCommandContext(SUBAGENT_BLOCK_CAN_TOGGLE_FIRST_CONTEXT, true);
  return () => {
    subagentBlockToggleCapabilityCount = Math.max(0, subagentBlockToggleCapabilityCount - 1);
    if (subagentBlockToggleCapabilityCount === 0) {
      setExtensionCommandContext(SUBAGENT_BLOCK_CAN_TOGGLE_FIRST_CONTEXT, null);
    }
  };
}

// packages/desktop/ui/src/components/chat/thinkingBlockCommands.ts
var THINKING_BLOCK_TOGGLE_FIRST_COMMAND_EVENT = "neon-pilot:thinking-block-toggle-first";
var THINKING_BLOCK_CAN_TOGGLE_FIRST_CONTEXT = "thinkingBlock.canToggleFirst";
var thinkingBlockToggleCapabilityCount = 0;
function registerThinkingBlockToggleCapability() {
  thinkingBlockToggleCapabilityCount += 1;
  setExtensionCommandContext(THINKING_BLOCK_CAN_TOGGLE_FIRST_CONTEXT, true);
  return () => {
    thinkingBlockToggleCapabilityCount = Math.max(0, thinkingBlockToggleCapabilityCount - 1);
    if (thinkingBlockToggleCapabilityCount === 0) {
      setExtensionCommandContext(THINKING_BLOCK_CAN_TOGGLE_FIRST_CONTEXT, null);
    }
  };
}

// packages/desktop/ui/src/components/chat/traceClusterCommands.ts
var TRACE_CLUSTER_TOGGLE_FIRST_COMMAND_EVENT = "neon-pilot:trace-cluster-toggle-first";
var TRACE_CLUSTER_TOGGLE_FIRST_OVERFLOW_COMMAND_EVENT = "neon-pilot:trace-cluster-toggle-first-overflow";
var TRACE_CLUSTER_CAN_TOGGLE_FIRST_CONTEXT = "traceCluster.canToggleFirst";
var TRACE_CLUSTER_CAN_TOGGLE_FIRST_OVERFLOW_CONTEXT = "traceCluster.canToggleFirstOverflow";
var traceClusterToggleCapabilityCount = 0;
var traceClusterOverflowToggleCapabilityCount = 0;
function registerTraceClusterToggleCapability() {
  traceClusterToggleCapabilityCount += 1;
  setExtensionCommandContext(TRACE_CLUSTER_CAN_TOGGLE_FIRST_CONTEXT, true);
  return () => {
    traceClusterToggleCapabilityCount = Math.max(0, traceClusterToggleCapabilityCount - 1);
    if (traceClusterToggleCapabilityCount === 0) {
      setExtensionCommandContext(TRACE_CLUSTER_CAN_TOGGLE_FIRST_CONTEXT, null);
    }
  };
}
function registerTraceClusterOverflowToggleCapability() {
  traceClusterOverflowToggleCapabilityCount += 1;
  setExtensionCommandContext(TRACE_CLUSTER_CAN_TOGGLE_FIRST_OVERFLOW_CONTEXT, true);
  return () => {
    traceClusterOverflowToggleCapabilityCount = Math.max(0, traceClusterOverflowToggleCapabilityCount - 1);
    if (traceClusterOverflowToggleCapabilityCount === 0) {
      setExtensionCommandContext(TRACE_CLUSTER_CAN_TOGGLE_FIRST_OVERFLOW_CONTEXT, null);
    }
  };
}

// packages/desktop/ui/src/components/chat/TraceBlocks.tsx
var ThinkingBlock = memo(function ThinkingBlock2({
  block,
  autoOpen,
  live
}) {
  const [preference, setPreference] = useState("auto");
  const open = resolveDisclosureOpen(autoOpen, preference);
  const preview = useMemo(() => buildSummaryPreview(block.text, 1), [block.text]);
  const toggleThinkingBlock = useCallback(() => {
    setPreference((current) => toggleDisclosurePreference(autoOpen, current));
  }, [autoOpen]);
  useEffect(() => registerThinkingBlockToggleCapability(), []);
  useEffect(() => {
    function handleToggleFirstThinkingBlock(event) {
      const detail = event.detail;
      if (detail?.handled) return;
      if (detail) detail.handled = true;
      toggleThinkingBlock();
    }
    window.addEventListener(THINKING_BLOCK_TOGGLE_FIRST_COMMAND_EVENT, handleToggleFirstThinkingBlock);
    return () => window.removeEventListener(THINKING_BLOCK_TOGGLE_FIRST_COMMAND_EVENT, handleToggleFirstThinkingBlock);
  }, [toggleThinkingBlock]);
  return /* @__PURE__ */ jsxs(SurfacePanel, { muted: true, className: "overflow-hidden border-transparent bg-elevated/35 text-[12px]", children: [
    /* @__PURE__ */ jsxs(RowButton, { onClick: toggleThinkingBlock, className: "px-2.5 py-2", children: [
      /* @__PURE__ */ jsx(Pill, { tone: "muted", children: "Thinking" }),
      !open && preview ? /* @__PURE__ */ jsx("span", { className: "min-w-0 flex-1 truncate text-secondary italic", children: preview }) : /* @__PURE__ */ jsx("span", { className: "flex-1" }),
      live && /* @__PURE__ */ jsx(MetaLabel, { tone: "muted", children: "live" }),
      /* @__PURE__ */ jsx("span", { className: "text-dim text-[10px]", children: open ? "hide" : "show" })
    ] }),
    open && /* @__PURE__ */ jsx("div", { className: "border-t border-border-subtle/70 px-2.5 pb-2.5 pt-1.5 text-secondary italic leading-relaxed space-y-1", children: block.text.split("\n").map((l, i) => /* @__PURE__ */ jsx("p", { className: "text-[12px]", children: l || /* @__PURE__ */ jsx("br", {}) }, i)) })
  ] });
});
var SubagentBlock = memo(function SubagentBlock2({ block }) {
  const [open, setOpen] = useState(false);
  const toggleSubagentBlock = useCallback(() => {
    setOpen((current) => !current);
  }, []);
  const colorClassName = {
    running: "text-steel",
    complete: "text-success",
    failed: "text-danger"
  }[block.status];
  const tone = { running: "steel", complete: "success", failed: "danger" }[block.status];
  useEffect(() => registerSubagentBlockToggleCapability(), []);
  useEffect(() => {
    function handleToggleFirstSubagentBlock(event) {
      const detail = event.detail;
      if (detail?.handled) return;
      if (detail) detail.handled = true;
      toggleSubagentBlock();
    }
    window.addEventListener(SUBAGENT_BLOCK_TOGGLE_FIRST_COMMAND_EVENT, handleToggleFirstSubagentBlock);
    return () => window.removeEventListener(SUBAGENT_BLOCK_TOGGLE_FIRST_COMMAND_EVENT, handleToggleFirstSubagentBlock);
  }, [toggleSubagentBlock]);
  return /* @__PURE__ */ jsxs(SurfacePanel, { muted: true, className: `overflow-hidden text-[12px] ${colorClassName}`, children: [
    /* @__PURE__ */ jsxs(RowButton, { onClick: toggleSubagentBlock, className: "px-2.5 py-2", children: [
      /* @__PURE__ */ jsx(Pill, { tone, mono: true, children: "subagent" }),
      /* @__PURE__ */ jsx("span", { className: "flex-1 truncate opacity-70 font-normal", children: block.name }),
      /* @__PURE__ */ jsx(Pill, { tone, children: block.status }),
      /* @__PURE__ */ jsx("span", { className: "shrink-0 ml-1 opacity-50 text-[10px]", children: open ? "hide" : "show" })
    ] }),
    open && /* @__PURE__ */ jsxs("div", { className: "border-t border-border-subtle/70 px-2.5 py-2 space-y-2 bg-black/5", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx(SectionLabel, { tone: "muted", className: "mb-1 block opacity-70", children: "prompt" }),
        /* @__PURE__ */ jsx("p", { className: "opacity-70 leading-relaxed", children: block.prompt })
      ] }),
      block.summary && /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx(SectionLabel, { tone: "muted", className: "mb-1 block opacity-70", children: "result" }),
        /* @__PURE__ */ jsx("p", { className: "opacity-80 leading-relaxed", children: block.summary })
      ] })
    ] })
  ] });
});
function traceSummaryTone(category) {
  switch (category.kind) {
    case "thinking":
      return "muted";
    case "subagent":
      return "steel";
    case "error":
      return "danger";
    case "context":
      return "muted";
    case "tool":
      return toolMeta(category.tool ?? category.label).tone;
  }
}
var MAX_VISIBLE_TRACE_BLOCKS = 5;
var MAX_DEFERRED_TRACE_PREFETCH_BLOCKS = MAX_VISIBLE_TRACE_BLOCKS;
var TRACE_CLUSTER_INACTIVE_GRACE_MS = 900;
function readToolRecordString(source, key) {
  if (!source || typeof source !== "object") return void 0;
  const value = source[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : void 0;
}
function isCheckpointSaveBlock(block) {
  return block.tool === "checkpoint" && (readToolRecordString(block.input, "action") ?? readToolRecordString(block.details, "action")) === "save";
}
function readCheckpointCollapseKey(block) {
  if (!isCheckpointSaveBlock(block)) return null;
  const message = readToolRecordString(block.input, "message");
  const subject = message?.split(/\r?\n/)[0]?.trim();
  if (subject) return `message:${subject.toLowerCase()}`;
  const commitId = readToolRecordString(block.details, "commitSha") ?? readToolRecordString(block.details, "checkpointId") ?? /^Saved checkpoint\s+([a-f0-9]{7,40})\b/im.exec(block.output ?? "")?.[1];
  if (commitId) return `commit:${commitId.toLowerCase()}`;
  const paths = Array.isArray(block.input?.paths) ? block.input.paths.filter((path2) => typeof path2 === "string" && path2.trim().length > 0).map((path2) => path2.trim()).sort().join("\n") : "";
  return paths ? `paths:${paths}` : null;
}
function collapseRepeatedCheckpointBlocks(blocks) {
  const latestByKey = /* @__PURE__ */ new Map();
  blocks.forEach((block, index2) => {
    const key = readCheckpointCollapseKey(block);
    if (key) latestByKey.set(key, index2);
  });
  return blocks.filter((block, index2) => {
    const key = readCheckpointCollapseKey(block);
    return !key || latestByKey.get(key) === index2;
  });
}
function hasArtifactPresentation(block) {
  if (block.tool !== "artifact") return false;
  const action = readToolRecordString(block.input, "action") ?? readToolRecordString(block.details, "action");
  const artifactId = readToolRecordString(block.input, "artifactId") ?? readToolRecordString(block.details, "artifactId");
  const title = readToolRecordString(block.input, "title") ?? readToolRecordString(block.details, "title");
  return action !== "list" && action !== "delete" && Boolean(artifactId || title);
}
function hasPinnedToolBlock(block) {
  return block.type === "tool_use" && (isCheckpointSaveBlock(block) || block.tool === "ask_user" || block.tool === "image" || block.tool === "browser_screenshot" || block.tool === "screenshot" || hasArtifactPresentation(block) || block.tool === "subagent" && (!!block.details && typeof block.details === "object" && typeof block.details.childConversationId === "string" || readLinkedRuns(block).runs.length > 0));
}
function PinnedToolBlocks({
  blocks,
  onOpenArtifact,
  activeArtifactId,
  onOpenCheckpoint,
  activeCheckpointId,
  onOpenBrowser,
  onOpenFilePath,
  validatedFilePathTargets,
  showPinnedToolCalls,
  diffDisclosureMode
}) {
  if (!showPinnedToolCalls) return null;
  const pinned = collapseRepeatedCheckpointBlocks(blocks.filter(hasPinnedToolBlock));
  if (pinned.length === 0) return null;
  return /* @__PURE__ */ jsx("div", { className: "ml-2.5 mt-1.5 space-y-1.5 border-l border-border-subtle pl-2.5", children: pinned.map((block, index2) => /* @__PURE__ */ jsx(
    ToolBlock,
    {
      block,
      autoOpen: false,
      onOpenArtifact,
      activeArtifactId,
      onOpenCheckpoint,
      activeCheckpointId,
      onOpenBrowser,
      onOpenFilePath,
      validatedFilePathTargets,
      diffDisclosureMode
    },
    `pinned-tool-${block.id ?? index2}`
  )) });
}
function useGracefulTraceClusterActive(active, immediateInactive) {
  const [stableActive, setStableActive] = useState(active);
  const inactiveTimeoutRef = useRef(null);
  useEffect(() => {
    if (inactiveTimeoutRef.current !== null) {
      window.clearTimeout(inactiveTimeoutRef.current);
      inactiveTimeoutRef.current = null;
    }
    if (active) {
      setStableActive(true);
      return void 0;
    }
    if (immediateInactive) {
      setStableActive(false);
      return void 0;
    }
    inactiveTimeoutRef.current = window.setTimeout(() => {
      setStableActive(false);
      inactiveTimeoutRef.current = null;
    }, TRACE_CLUSTER_INACTIVE_GRACE_MS);
    return () => {
      if (inactiveTimeoutRef.current !== null) {
        window.clearTimeout(inactiveTimeoutRef.current);
        inactiveTimeoutRef.current = null;
      }
    };
  }, [active, immediateInactive]);
  return stableActive;
}
function TraceClusterBlock({
  blocks,
  deferredBlockIds = [],
  summary,
  live,
  keepOpenUntilFollowed = false,
  followedByTranscriptContent = false,
  onOpenArtifact,
  activeArtifactId,
  onOpenCheckpoint,
  activeCheckpointId,
  onOpenBrowser,
  onOpenFilePath,
  validatedFilePathTargets,
  onHydrateMessage,
  hydratingMessageBlockIds,
  onResume,
  resumeBusy,
  resumeTitle,
  resumeLabel,
  layout = "default",
  transcriptDisclosureMode,
  diffDisclosureMode,
  showPinnedToolCalls
}) {
  const [preference, setPreference] = useState("auto");
  const [showAllBlocks, setShowAllBlocks] = useState(false);
  const requestedDeferredBlockIdsRef = useRef(/* @__PURE__ */ new Set());
  const expandedCategories = summary.categories.slice(0, 3);
  const remainingCategoryCount = Math.max(0, summary.categories.length - expandedCategories.length);
  const durationLabel = summary.durationMs && summary.durationMs > 0 ? `${(summary.durationMs / 1e3).toFixed(1)}s` : null;
  const isActive = live || summary.hasRunning;
  const stableActive = useGracefulTraceClusterActive(isActive, followedByTranscriptContent);
  const throughputLabel = useMemo(() => getStreamingThroughputLabel(blocks, stableActive), [blocks, stableActive]);
  const compact = layout === "compact";
  const title = stableActive ? "Working" : "Internal work";
  const autoOpen = keepOpenUntilFollowed && shouldAutoOpenTraceCluster(stableActive, false);
  const open = resolveDisclosureOpen(autoOpen, preference);
  const toggleTraceCluster = useCallback(() => {
    setPreference((current) => toggleDisclosurePreference(autoOpen, current));
  }, [autoOpen]);
  const toggleTraceClusterOverflow = useCallback(() => {
    setShowAllBlocks((current) => !current);
  }, []);
  const hydrateDeferredBlocks = () => {
    if (!onHydrateMessage || deferredBlockIds.length === 0) {
      return;
    }
    const blockIds = deferredBlockIds.slice(-MAX_DEFERRED_TRACE_PREFETCH_BLOCKS);
    for (const blockId of blockIds) {
      if (!hydratingMessageBlockIds?.has(blockId) && !requestedDeferredBlockIdsRef.current.has(blockId)) {
        requestedDeferredBlockIdsRef.current.add(blockId);
        void onHydrateMessage(blockId);
      }
    }
  };
  useEffect(() => {
    if (open) {
      hydrateDeferredBlocks();
    }
  }, [open]);
  useEffect(() => registerTraceClusterToggleCapability(), []);
  useEffect(() => {
    function handleToggleFirstTraceCluster(event) {
      const detail = event.detail;
      if (detail?.handled) return;
      if (detail) detail.handled = true;
      toggleTraceCluster();
    }
    window.addEventListener(TRACE_CLUSTER_TOGGLE_FIRST_COMMAND_EVENT, handleToggleFirstTraceCluster);
    return () => window.removeEventListener(TRACE_CLUSTER_TOGGLE_FIRST_COMMAND_EVENT, handleToggleFirstTraceCluster);
  }, [toggleTraceCluster]);
  const runningBlockIndex = useMemo(
    () => blocks.findIndex((block) => block.type === "tool_use" && (block.status === "running" || !!block.running)),
    [blocks]
  );
  const visibleBlocks = useMemo(() => {
    if (!open) {
      return runningBlockIndex >= 0 ? [blocks[runningBlockIndex]] : [];
    }
    if (showAllBlocks || blocks.length <= MAX_VISIBLE_TRACE_BLOCKS) {
      return blocks;
    }
    return blocks.slice(-MAX_VISIBLE_TRACE_BLOCKS);
  }, [blocks, open, runningBlockIndex, showAllBlocks]);
  const overflowBlockCount = Math.max(0, blocks.length - MAX_VISIBLE_TRACE_BLOCKS);
  const canToggleTraceClusterOverflow = open && overflowBlockCount > 0;
  useEffect(() => {
    if (!canToggleTraceClusterOverflow) return void 0;
    return registerTraceClusterOverflowToggleCapability();
  }, [canToggleTraceClusterOverflow]);
  useEffect(() => {
    function handleToggleFirstTraceClusterOverflow(event) {
      const detail = event.detail;
      if (detail?.handled || !canToggleTraceClusterOverflow) return;
      if (detail) detail.handled = true;
      toggleTraceClusterOverflow();
    }
    window.addEventListener(TRACE_CLUSTER_TOGGLE_FIRST_OVERFLOW_COMMAND_EVENT, handleToggleFirstTraceClusterOverflow);
    return () => window.removeEventListener(TRACE_CLUSTER_TOGGLE_FIRST_OVERFLOW_COMMAND_EVENT, handleToggleFirstTraceClusterOverflow);
  }, [canToggleTraceClusterOverflow, toggleTraceClusterOverflow]);
  const visibleStartIndex = blocks.length - visibleBlocks.length;
  return /* @__PURE__ */ jsxs("div", { className: "space-y-1.5", children: [
    /* @__PURE__ */ jsxs(
      "div",
      {
        className: compact ? "flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-dim/70" : "grid w-full grid-cols-[auto_1fr] items-center gap-2 text-[11px] text-dim/70",
        children: [
          /* @__PURE__ */ jsxs(
            RowButton,
            {
              compact: true,
              onMouseEnter: hydrateDeferredBlocks,
              onFocus: hydrateDeferredBlocks,
              onClick: toggleTraceCluster,
              "aria-expanded": open,
              className: compact ? "flex min-w-0 max-w-full flex-1 flex-wrap items-center gap-1.5 bg-transparent p-0 text-dim/70" : "flex min-w-0 max-w-[78vw] items-center gap-1.5 bg-transparent p-0 text-dim/70 sm:max-w-[42rem]",
              children: [
                /* @__PURE__ */ jsx("span", { className: "shrink-0 font-medium text-primary", children: title }),
                /* @__PURE__ */ jsxs("span", { className: "shrink-0 text-secondary", children: [
                  "\xB7 ",
                  summary.stepCount,
                  " step",
                  summary.stepCount === 1 ? "" : "s"
                ] }),
                summary.categories.length > 0 && /* @__PURE__ */ jsxs("span", { className: "flex min-w-0 flex-wrap items-center gap-1", children: [
                  expandedCategories.map((category) => /* @__PURE__ */ jsxs(Pill, { tone: traceSummaryTone(category), mono: category.kind === "tool", children: [
                    category.label,
                    category.count > 1 ? ` \xD7${category.count}` : ""
                  ] }, category.key)),
                  remainingCategoryCount > 0 && /* @__PURE__ */ jsxs("span", { className: "text-dim", children: [
                    "+",
                    remainingCategoryCount
                  ] })
                ] }),
                /* @__PURE__ */ jsx("span", { className: "flex-1" }),
                stableActive && /* @__PURE__ */ jsx(MetaLabel, { tone: "accent", children: "live" }),
                throughputLabel && /* @__PURE__ */ jsx(
                  "span",
                  {
                    className: "font-mono text-accent/80",
                    title: "Estimated from streamed output using the same chars/4 token heuristic used elsewhere in Pi.",
                    children: throughputLabel
                  }
                ),
                durationLabel && !isActive && /* @__PURE__ */ jsx("span", { className: "text-dim", children: durationLabel }),
                /* @__PURE__ */ jsx("span", { className: "text-dim", children: open ? "hide" : "show" })
              ]
            }
          ),
          /* @__PURE__ */ jsx("span", { className: compact ? "h-px min-w-8 flex-1 bg-border-subtle" : "h-px bg-border-subtle", "aria-hidden": "true" })
        ]
      }
    ),
    /* @__PURE__ */ jsx(ResumeConversationAction, { onResume, busy: resumeBusy, title: resumeTitle, label: resumeLabel, variant: "inline" }),
    !open && /* @__PURE__ */ jsx(
      PinnedToolBlocks,
      {
        blocks,
        onOpenArtifact,
        activeArtifactId,
        onOpenCheckpoint,
        activeCheckpointId,
        onOpenBrowser,
        onOpenFilePath,
        validatedFilePathTargets,
        showPinnedToolCalls,
        diffDisclosureMode
      }
    ),
    open && /* @__PURE__ */ jsxs("div", { className: "ml-2.5 space-y-1.5 border-l border-border-subtle pl-2.5", children: [
      overflowBlockCount > 0 && /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2 rounded-md bg-elevated/35 px-2.5 py-1.5 text-[11px] text-secondary", children: [
        /* @__PURE__ */ jsx("span", { children: showAllBlocks ? `Showing all ${blocks.length} steps.` : `${overflowBlockCount} earlier step${overflowBlockCount === 1 ? "" : "s"} summarized above.` }),
        /* @__PURE__ */ jsx("span", { className: "flex-1" }),
        /* @__PURE__ */ jsx(Button, { variant: "action", onClick: toggleTraceClusterOverflow, className: "text-[10px]", children: showAllBlocks ? `Show latest ${MAX_VISIBLE_TRACE_BLOCKS}` : "Show all" })
      ] }),
      visibleBlocks.map((block, index2) => {
        const blockIndex = open ? visibleStartIndex + index2 : runningBlockIndex;
        const autoOpen2 = resolveConversationBlockAutoOpen(block, blockIndex, blocks.length, stableActive, transcriptDisclosureMode);
        const blockLive = stableActive && blockIndex === blocks.length - 1;
        switch (block.type) {
          case "thinking":
            return /* @__PURE__ */ jsx(ThinkingBlock, { block, autoOpen: autoOpen2, live: blockLive }, `thinking-${blockIndex}`);
          case "tool_use":
            return /* @__PURE__ */ jsx(
              ToolBlock,
              {
                block,
                autoOpen: autoOpen2,
                onOpenArtifact,
                activeArtifactId,
                onOpenCheckpoint,
                activeCheckpointId,
                onOpenBrowser,
                onOpenFilePath,
                validatedFilePathTargets,
                onHydrateMessage,
                hydratingMessageBlockIds,
                diffDisclosureMode
              },
              `tool-${blockIndex}`
            );
          case "subagent":
            return /* @__PURE__ */ jsx(SubagentBlock, { block }, `subagent-${blockIndex}`);
          case "error":
            return /* @__PURE__ */ jsx(
              ErrorBlock,
              {
                block,
                onOpenFilePath,
                validatedFilePathTargets
              },
              `error-${blockIndex}`
            );
          case "context":
          case "summary":
            return /* @__PURE__ */ jsx(
              ContextShelf,
              {
                blocks: [block],
                messageIndexOffset: blockIndex,
                onOpenFilePath,
                onOpenCheckpoint,
                validatedFilePathTargets
              },
              `context-${blockIndex}`
            );
          default:
            return null;
        }
      })
    ] })
  ] });
}
function ResumeConversationAction({
  onResume,
  busy = false,
  title,
  label = "continue",
  variant = "compact"
}) {
  if (!onResume) {
    return null;
  }
  const compactClassName = "shrink-0 text-[11px] font-medium text-secondary transition-colors hover:text-primary disabled:cursor-default disabled:text-dim";
  const inlineClassName = "group inline-flex shrink-0 items-center gap-1.5 self-start px-2 py-1 text-[11px] font-medium text-secondary disabled:cursor-default disabled:text-dim sm:self-center";
  return /* @__PURE__ */ jsx(
    TextButton,
    {
      onClick: () => {
        void onResume();
      },
      disabled: busy,
      title: title ?? "Resume this conversation",
      className: variant === "inline" ? inlineClassName : compactClassName,
      children: busy ? "opening\u2026" : label
    }
  );
}
function presentTraceErrorMessage(message) {
  const normalized = message.trim();
  if (normalized.toLowerCase() === "terminated") {
    return "Stopped before finishing. The agent run was interrupted or cancelled.";
  }
  const extensionModuleLoadFailure = /^Extension "([^"]+)" action "([^"]+)" failed: Cannot find module\b/.exec(normalized);
  if (extensionModuleLoadFailure) {
    return `Extension "${extensionModuleLoadFailure[1]}" action "${extensionModuleLoadFailure[2]}" could not start because a required app module was unavailable. Rebuild or restart Neon Pilot and try again.`;
  }
  if (/^Cannot find module\b/.test(normalized)) {
    return "A required app module was unavailable. Rebuild or restart Neon Pilot and try again.";
  }
  return message;
}
var ErrorBlock = memo(function ErrorBlock2({
  block,
  messageIndex,
  onResume,
  resumeBusy,
  resumeTitle,
  resumeLabel,
  onOpenFilePath: _onOpenFilePath,
  validatedFilePathTargets: _validatedFilePathTargets,
  onSelectionGesture
}) {
  const blockId = typeof block.id === "string" ? block.id.trim() || void 0 : void 0;
  const replySelectionScopeProps = buildReplySelectionScopeProps(messageIndex, blockId, onSelectionGesture);
  const message = presentTraceErrorMessage(block.message);
  return /* @__PURE__ */ jsx(Notice, { tone: "danger", className: "text-[12px] font-mono", children: /* @__PURE__ */ jsxs("div", { className: "min-w-0 space-y-2", children: [
    /* @__PURE__ */ jsxs("div", { ...replySelectionScopeProps, children: [
      block.tool && /* @__PURE__ */ jsxs("span", { className: "text-danger/70 font-semibold", children: [
        block.tool,
        " \xB7"
      ] }),
      /* @__PURE__ */ jsx("span", { className: "text-danger/85 leading-relaxed", children: message })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ jsx("span", { className: "flex-1" }),
      /* @__PURE__ */ jsx(ResumeConversationAction, { onResume, busy: resumeBusy, title: resumeTitle, label: resumeLabel, variant: "inline" })
    ] })
  ] }) });
});

// packages/desktop/ui/src/components/chat/ChatRenderItemView.tsx
function ChatRenderItemView({
  item,
  itemIndex,
  renderItemsLength,
  conversationId,
  messageIndexOffset,
  messages,
  isStreaming,
  contentVisibilityStyle,
  layout,
  onForkMessage,
  onRewindMessage,
  onEditUserMessage,
  onReplyToSelection,
  onHydrateMessage,
  hydratingMessageBlockIds,
  onOpenArtifact,
  activeArtifactId,
  onOpenCheckpoint,
  activeCheckpointId,
  onOpenBrowser,
  onOpenFilePath,
  validatedFilePathTargets,
  onSubmitAskUserQuestion,
  askUserQuestionDisplayMode,
  onResumeConversation,
  resumeConversationBusy,
  resumeConversationTitle,
  resumeConversationLabel,
  isInlineRunExpanded,
  onToggleInlineRun,
  onInspectImage,
  onSelectionGesture,
  transcriptDisclosureMode,
  diffDisclosureMode,
  showPinnedToolCalls
}) {
  const isTailItem = itemIndex === renderItemsLength - 1;
  if (item.type === "trace_cluster") {
    const live = isStreaming && isTailItem;
    const followedByTranscriptContent = !isTailItem;
    const deferredEntryHydrationId = item.blocks.length === 0 && item.deferredEntryIds ? buildDeferredEntryHydrationId(item.deferredEntryIds) : null;
    return /* @__PURE__ */ jsxs(
      "div",
      {
        "data-trace-cluster-start-index": messageIndexOffset + item.startIndex,
        "data-chat-tail": isTailItem ? "1" : void 0,
        style: contentVisibilityStyle,
        children: [
          item.blocks.map((_, offset) => {
            const absoluteIndex2 = messageIndexOffset + item.startIndex + offset;
            return /* @__PURE__ */ jsx("span", { id: `msg-${absoluteIndex2}`, className: "block h-0 overflow-hidden", "aria-hidden": true }, `anchor-${absoluteIndex2}`);
          }),
          /* @__PURE__ */ jsx(
            TraceClusterBlock,
            {
              blocks: item.blocks,
              deferredBlockIds: item.blocks.length === 0 ? deferredEntryHydrationId ? [deferredEntryHydrationId] : item.deferredBlockIds : void 0,
              summary: item.summary,
              live,
              keepOpenUntilFollowed: live,
              followedByTranscriptContent,
              onOpenArtifact,
              activeArtifactId,
              onOpenCheckpoint,
              activeCheckpointId,
              onOpenBrowser,
              onOpenFilePath,
              validatedFilePathTargets,
              onHydrateMessage,
              hydratingMessageBlockIds,
              onResume: isTailItem ? onResumeConversation : void 0,
              resumeBusy: resumeConversationBusy,
              resumeTitle: resumeConversationTitle,
              resumeLabel: resumeConversationLabel,
              layout,
              transcriptDisclosureMode,
              diffDisclosureMode,
              showPinnedToolCalls
            }
          )
        ]
      },
      `trace-${messageIndexOffset + item.startIndex}`
    );
  }
  if (item.type === "context_cluster") {
    const isTailContextItem = itemIndex === renderItemsLength - 1;
    return /* @__PURE__ */ jsxs(
      "div",
      {
        "data-chat-tail": isTailContextItem ? "1" : void 0,
        style: contentVisibilityStyle,
        children: [
          item.blocks.map((_, offset) => {
            const absoluteIndex2 = messageIndexOffset + item.startIndex + offset;
            return /* @__PURE__ */ jsx("span", { id: `msg-${absoluteIndex2}`, className: "block h-0 overflow-hidden", "aria-hidden": true }, `anchor-${absoluteIndex2}`);
          }),
          /* @__PURE__ */ jsx(
            ContextShelf,
            {
              blocks: item.blocks,
              messageIndexOffset: messageIndexOffset + item.startIndex,
              currentConversationId: conversationId,
              onOpenFilePath,
              validatedFilePathTargets,
              onOpenCheckpoint,
              onSelectionGesture: onReplyToSelection ? onSelectionGesture : void 0
            }
          )
        ]
      },
      `context-${messageIndexOffset + item.startIndex}`
    );
  }
  const block = item.block;
  const absoluteIndex = messageIndexOffset + item.index;
  const autoOpen = resolveConversationBlockAutoOpen(block, item.index, messages.length, isStreaming, transcriptDisclosureMode);
  const showStreamingCursor = isStreaming && block.type === "text" && item.index === messages.length - 1;
  const el = (() => {
    switch (block.type) {
      case "user":
        return /* @__PURE__ */ jsx(
          UserMessage,
          {
            block,
            messageIndex: absoluteIndex,
            onRewindMessage,
            onForkMessage,
            onEditMessage: onEditUserMessage,
            onHydrateMessage,
            hydratingMessageBlockIds,
            onOpenFilePath,
            validatedFilePathTargets,
            onOpenCheckpoint,
            onInspectImage,
            isInlineRunExpanded,
            onToggleInlineRun,
            layout
          }
        );
      case "text":
        return /* @__PURE__ */ jsx(
          AssistantMessage,
          {
            block,
            messageIndex: absoluteIndex,
            showCursor: showStreamingCursor,
            onRewindMessage,
            onForkMessage,
            onOpenFilePath,
            validatedFilePathTargets,
            onOpenCheckpoint,
            onSelectionGesture: onReplyToSelection ? onSelectionGesture : void 0,
            isInlineRunExpanded,
            onToggleInlineRun,
            layout
          }
        );
      case "context":
        if (isTopologyBlock(block)) {
          return /* @__PURE__ */ jsx(TopologyBlock, { block });
        }
        return /* @__PURE__ */ jsx(
          SystemEventMessage,
          {
            block,
            messageIndex: absoluteIndex,
            onOpenFilePath,
            validatedFilePathTargets,
            onOpenCheckpoint,
            onSelectionGesture: onReplyToSelection ? onSelectionGesture : void 0,
            isInlineRunExpanded,
            onToggleInlineRun
          }
        );
      case "summary":
        return /* @__PURE__ */ jsx(
          SummaryMessage,
          {
            block,
            messageIndex: absoluteIndex,
            onOpenFilePath,
            validatedFilePathTargets,
            onOpenCheckpoint,
            onSelectionGesture: onReplyToSelection ? onSelectionGesture : void 0
          }
        );
      case "thinking":
        return /* @__PURE__ */ jsx(ThinkingBlock, { block, autoOpen });
      case "tool_use":
        return /* @__PURE__ */ jsx(
          ToolBlock,
          {
            block,
            autoOpen,
            onOpenArtifact,
            activeArtifactId,
            onOpenCheckpoint,
            activeCheckpointId,
            onOpenBrowser,
            onOpenFilePath,
            validatedFilePathTargets,
            onHydrateMessage,
            hydratingMessageBlockIds,
            messages,
            messageIndex: item.index,
            onSubmitAskUserQuestion,
            askUserQuestionDisplayMode,
            diffDisclosureMode
          }
        );
      case "subagent":
        return /* @__PURE__ */ jsx(SubagentBlock, { block });
      case "image":
        return /* @__PURE__ */ jsx(
          ImageBlock,
          {
            block,
            onHydrateMessage,
            hydratingMessageBlockIds,
            onInspectImage
          }
        );
      case "error":
        return /* @__PURE__ */ jsx(
          ErrorBlock,
          {
            block,
            messageIndex: absoluteIndex,
            onResume: isTailItem ? onResumeConversation : void 0,
            resumeBusy: resumeConversationBusy,
            resumeTitle: resumeConversationTitle,
            resumeLabel: resumeConversationLabel,
            onOpenFilePath,
            onSelectionGesture: onReplyToSelection ? onSelectionGesture : void 0
          }
        );
      default:
        return null;
    }
  })();
  return el ? /* @__PURE__ */ jsx(
    "div",
    {
      id: `msg-${absoluteIndex}`,
      "data-message-index": absoluteIndex,
      "data-chat-tail": isTailItem ? "1" : void 0,
      style: contentVisibilityStyle,
      children: el
    },
    absoluteIndex
  ) : null;
}

// packages/desktop/ui/src/components/chat/ChatTranscriptChrome.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/components/shared/ContextMenu.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/components/shared/contextMenuPosition.ts
var CONTEXT_MENU_EDGE_PADDING_PX = 12;
var CONTEXT_MENU_ITEM_HEIGHT_PX = 28;
var CONTEXT_MENU_SHELL_PADDING_PX = 6;
var CONTEXT_MENU_SEPARATOR_HEIGHT_PX = 5;
function readSafeGeometryNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}
function estimateContextMenuHeight(input) {
  const itemCount = Math.max(1, input.itemCount);
  const separatorCount = Math.max(0, input.separatorCount ?? 0);
  return itemCount * CONTEXT_MENU_ITEM_HEIGHT_PX + separatorCount * CONTEXT_MENU_SEPARATOR_HEIGHT_PX + CONTEXT_MENU_SHELL_PADDING_PX;
}
function clampViewportMenuPosition(position3, dimensions, viewport, edgePadding = CONTEXT_MENU_EDGE_PADDING_PX) {
  const menuWidth = readSafeGeometryNumber(dimensions.width, edgePadding * 2);
  const menuHeight = readSafeGeometryNumber(dimensions.height, edgePadding * 2);
  const viewportWidth = readSafeGeometryNumber(viewport.width, menuWidth + edgePadding * 2);
  const viewportHeight = readSafeGeometryNumber(viewport.height, menuHeight + edgePadding * 2);
  const x = readSafeGeometryNumber(position3.x, edgePadding);
  const y = readSafeGeometryNumber(position3.y, edgePadding);
  return {
    x: Math.max(edgePadding, Math.min(x, viewportWidth - menuWidth - edgePadding)),
    y: Math.max(edgePadding, Math.min(y, viewportHeight - menuHeight - edgePadding))
  };
}

// packages/desktop/ui/src/components/shared/ContextMenu.tsx
var useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
function ContextMenuSections({ children }) {
  const sections = Children.toArray(children).filter(Boolean);
  return /* @__PURE__ */ jsx("div", { className: "space-y-px", children: sections.map((section, index2) => /* @__PURE__ */ jsxs(Fragment, { children: [
    index2 > 0 ? /* @__PURE__ */ jsx(MenuSeparator, {}) : null,
    section
  ] }, typeof section === "object" && section && "key" in section ? section.key : index2)) });
}
function ContextMenuSection({ children, label }) {
  return /* @__PURE__ */ jsxs("div", { className: "space-y-px", children: [
    label ? /* @__PURE__ */ jsx(MenuGroupLabel, { children: label }) : null,
    children
  ] });
}
function assignRef(ref, value) {
  if (!ref) return;
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  ref.current = value;
}
function readViewport() {
  if (typeof window === "undefined") {
    return { width: Number.POSITIVE_INFINITY, height: Number.POSITIVE_INFINITY };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}
var ContextMenu = forwardRef(function ContextMenu2({
  children,
  className,
  estimatedHeight,
  ignoreRefs = [],
  minWidth,
  onClose,
  portal = true,
  position: position3,
  role = "menu",
  shell = true,
  style,
  ...props
}, forwardedRef) {
  const menuRef = useRef(null);
  const [resolvedPosition, setResolvedPosition] = useState(position3);
  useBrowserLayoutEffect(() => {
    const node2 = menuRef.current;
    const rect = node2?.getBoundingClientRect();
    const width = rect?.width || minWidth || 1;
    const height = rect?.height || estimatedHeight || 1;
    const nextPosition = clampViewportMenuPosition(position3, { width, height }, readViewport());
    setResolvedPosition((current) => current.x === nextPosition.x && current.y === nextPosition.y ? current : nextPosition);
  });
  useEffect(() => {
    if (!onClose || typeof document === "undefined") return;
    function isInsideMenu(target) {
      if (!(target instanceof Node)) return false;
      if (menuRef.current?.contains(target)) return true;
      return ignoreRefs.some((ref) => ref.current?.contains(target));
    }
    function handleOutsidePointer(event) {
      if (isInsideMenu(event.target)) return;
      onClose();
    }
    function handleKeyDown(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener("pointerdown", handleOutsidePointer, true);
    document.addEventListener("contextmenu", handleOutsidePointer, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointer, true);
      document.removeEventListener("contextmenu", handleOutsidePointer, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [ignoreRefs, onClose]);
  const menuStyle = {
    bottom: "auto",
    left: resolvedPosition.x,
    marginBottom: 0,
    minWidth,
    overflow: "visible",
    position: "fixed",
    right: "auto",
    top: resolvedPosition.y,
    ...style
  };
  const handleRef = (node2) => {
    menuRef.current = node2;
    assignRef(forwardedRef, node2);
  };
  const menu = shell ? /* @__PURE__ */ jsx(MenuShell, { ref: handleRef, className, role, style: menuStyle, ...props, children }) : /* @__PURE__ */ jsx("div", { ref: handleRef, className, role, style: menuStyle, ...props, children });
  if (!portal || typeof document === "undefined") {
    return menu;
  }
  return createPortal(menu, document.body);
});

// packages/desktop/ui/src/components/chat/ChatTranscriptChrome.tsx
function StreamingIndicator({ label }) {
  return /* @__PURE__ */ jsx("div", { className: "flex gap-2 items-start", role: "status", "aria-live": "polite", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 pt-1 text-[12px] text-secondary italic", children: [
    /* @__PURE__ */ jsx(StatusDot, { tone: "accent", size: "xs", className: "animate-pulse not-italic" }),
    /* @__PURE__ */ jsx("span", { children: label })
  ] }) });
}
function estimateSelectionContextMenuHeight({
  hasReplySelection,
  selectionActionCount
}) {
  const hasReplyStarters = hasReplySelection && selectionActionCount > 0;
  const itemCount = 1 + Number(hasReplySelection) + Number(hasReplyStarters);
  const separatorCount = Math.max(0, itemCount - 1);
  return estimateContextMenuHeight({ itemCount, separatorCount });
}
function SelectionContextMenu({
  menuState,
  menuRef,
  selectionActions = [],
  onAction
}) {
  const estimatedMenuHeight = estimateSelectionContextMenuHeight({
    hasReplySelection: Boolean(menuState.replySelection),
    selectionActionCount: selectionActions.length
  });
  return /* @__PURE__ */ jsx(
    ContextMenu,
    {
      ref: menuRef,
      "aria-label": "Selected transcript text actions",
      "data-selection-context-menu": "true",
      estimatedHeight: estimatedMenuHeight,
      minWidth: 224,
      position: menuState,
      children: /* @__PURE__ */ jsxs(ContextMenuSections, { children: [
        menuState.replySelection && selectionActions.length > 0 ? /* @__PURE__ */ jsx(ContextMenuSection, { children: /* @__PURE__ */ jsx("div", { className: "flex items-center gap-1 px-2 py-1", role: "group", "aria-label": "Selection reply starters", children: selectionActions.map((action) => /* @__PURE__ */ jsx(
          IconButton,
          {
            compact: true,
            title: action.title,
            "aria-label": action.title,
            onPointerDown: (event) => {
              event.preventDefault();
              event.stopPropagation();
            },
            onMouseDown: (event) => {
              event.preventDefault();
              event.stopPropagation();
            },
            onClick: () => {
              void onAction(action);
            },
            className: "text-base",
            role: "menuitem",
            children: action.icon ?? action.title
          },
          `${action.extensionId}:${action.id}`
        )) }) }) : null,
        menuState.replySelection ? /* @__PURE__ */ jsx(ContextMenuSection, { children: /* @__PURE__ */ jsx(
          MenuItem,
          {
            onClick: () => {
              void onAction("reply");
            },
            children: "Reply with Selection"
          }
        ) }) : null,
        /* @__PURE__ */ jsx(ContextMenuSection, { children: /* @__PURE__ */ jsx(
          MenuItem,
          {
            onClick: () => {
              void onAction("copy");
            },
            children: "Copy"
          }
        ) })
      ] })
    }
  );
}

// packages/desktop/ui/src/components/chat/chatWindowing.tsx
init_neon_pilot_shared_react();
var CHAT_VIEW_RENDERING_PROFILE = {
  default: {
    contentVisibilityThreshold: 160,
    windowingThreshold: 48,
    windowingChunkSize: 24,
    windowingOverscanChunks: 0
  },
  aggressive: {
    contentVisibilityThreshold: 96,
    windowingThreshold: 120,
    windowingChunkSize: 24,
    windowingOverscanChunks: 0
  }
};
var CHAT_WINDOWING_FALLBACK_SPAN_HEIGHT = 96;
function getChatRenderItemAbsoluteRange(item, messageIndexOffset) {
  if (item.type === "trace_cluster") {
    return {
      start: messageIndexOffset + item.startIndex,
      end: messageIndexOffset + item.endIndex
    };
  }
  return {
    start: messageIndexOffset + item.index,
    end: messageIndexOffset + item.index
  };
}
function getChatRenderItemSpanCount(item, messageIndexOffset) {
  const range = getChatRenderItemAbsoluteRange(item, messageIndexOffset);
  return range.end - range.start + 1;
}
function getChatRenderItemsSpanCount(renderItems, messageIndexOffset) {
  return renderItems.reduce((count, item) => count + getChatRenderItemSpanCount(item, messageIndexOffset), 0);
}
function buildChatRenderChunks(renderItems, messageIndexOffset, chunkSize) {
  const chunks = [];
  const normalizedChunkSize = Number.isSafeInteger(chunkSize) && chunkSize > 0 ? chunkSize : 1;
  for (let startItemIndex = 0; startItemIndex < renderItems.length; ) {
    const items = [];
    let spanCount = 0;
    let endItemIndex = startItemIndex;
    while (endItemIndex < renderItems.length && (items.length === 0 || spanCount < normalizedChunkSize)) {
      const item = renderItems[endItemIndex];
      items.push(item);
      spanCount += getChatRenderItemSpanCount(item, messageIndexOffset);
      endItemIndex += 1;
    }
    const startRange = getChatRenderItemAbsoluteRange(items[0], messageIndexOffset);
    const endRange = getChatRenderItemAbsoluteRange(items[items.length - 1], messageIndexOffset);
    chunks.push({
      // Use only the first item's start message index as the chunk key so it
      // stays stable when the last trace cluster grows during streaming. Using
      // endRange.end would change the key on every append, unmounting the
      // WindowedChatChunk and losing all child ToolBlock state.
      key: `chunk-${startRange.start}`,
      items,
      startItemIndex,
      endItemIndex: endItemIndex - 1,
      startMessageIndex: startRange.start,
      endMessageIndex: endRange.end,
      spanCount
    });
    startItemIndex = endItemIndex;
  }
  return chunks;
}
function resolveChunkIndexForOffset(offset, chunkTops, chunkHeights) {
  for (let index2 = 0; index2 < chunkTops.length; index2 += 1) {
    if (offset < chunkTops[index2] + chunkHeights[index2]) {
      return index2;
    }
  }
  return Math.max(0, chunkTops.length - 1);
}
function WindowedChatChunk({
  chunk,
  renderItem,
  onHeightChange,
  includeTrailingGap
}) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const element3 = ref.current;
    if (!element3) {
      return;
    }
    const measure = () => {
      onHeightChange(chunk.key, element3.getBoundingClientRect().height);
    };
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => measure()) : null;
    observer?.observe(element3);
    return () => {
      observer?.disconnect();
    };
  }, [chunk.key, includeTrailingGap, onHeightChange]);
  return /* @__PURE__ */ jsx("div", { ref, className: includeTrailingGap ? "space-y-4 pb-4" : "space-y-4", children: chunk.items.map((item, itemIndex) => renderItem(item, chunk.startItemIndex + itemIndex)) });
}

// packages/desktop/ui/src/components/chat/inlineTraceRunCommands.ts
var INLINE_TRACE_RUN_TOGGLE_FIRST_COMMAND_EVENT = "neon-pilot:inline-trace-run-toggle-first";
var INLINE_TRACE_RUN_CAN_TOGGLE_FIRST_CONTEXT = "inlineTraceRun.canToggleFirst";
var inlineTraceRunToggleCapabilityCount = 0;
function registerInlineTraceRunToggleCapability() {
  inlineTraceRunToggleCapabilityCount += 1;
  setExtensionCommandContext(INLINE_TRACE_RUN_CAN_TOGGLE_FIRST_CONTEXT, true);
  return () => {
    inlineTraceRunToggleCapabilityCount = Math.max(0, inlineTraceRunToggleCapabilityCount - 1);
    if (inlineTraceRunToggleCapabilityCount === 0) {
      setExtensionCommandContext(INLINE_TRACE_RUN_CAN_TOGGLE_FIRST_CONTEXT, null);
    }
  };
}

// packages/desktop/ui/src/components/chat/useChatReplySelection.ts
init_neon_pilot_shared_react();
function clearWindowSelection() {
  if (typeof window === "undefined") {
    return;
  }
  window.getSelection()?.removeAllRanges();
}
function parseReplySelectionMessageIndex(value) {
  const normalized = value?.trim() ?? "";
  if (!/^\d+$/.test(normalized)) {
    return null;
  }
  const parsed = Number.parseInt(normalized, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
function useChatReplySelection({
  onReplyToSelection,
  scrollContainerRef
}) {
  const [replySelection, setReplySelection] = useState(null);
  const [selectionContextMenu, setSelectionContextMenu] = useState(null);
  const replySelectionSyncFrameRef = useRef(null);
  const replySelectionSyncTimeoutRefs = useRef([]);
  const replySelectionClearTimeoutRef = useRef(null);
  const selectionContextMenuRef = useRef(null);
  const selectionContextMenuOpenedAtRef = useRef(0);
  const lastReplySelectionScopeRef = useRef(null);
  const clearScheduledReplySelectionSync = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (replySelectionSyncFrameRef.current !== null) {
      window.cancelAnimationFrame(replySelectionSyncFrameRef.current);
      replySelectionSyncFrameRef.current = null;
    }
    if (replySelectionSyncTimeoutRefs.current.length > 0) {
      for (const timeoutId of replySelectionSyncTimeoutRefs.current) {
        window.clearTimeout(timeoutId);
      }
      replySelectionSyncTimeoutRefs.current = [];
    }
  }, []);
  const cancelReplySelectionClear = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (replySelectionClearTimeoutRef.current !== null) {
      window.clearTimeout(replySelectionClearTimeoutRef.current);
      replySelectionClearTimeoutRef.current = null;
    }
  }, []);
  const closeSelectionContextMenu = useCallback(() => {
    setSelectionContextMenu((current) => current ? null : current);
  }, []);
  const clearReplySelection = useCallback(() => {
    lastReplySelectionScopeRef.current = null;
    setReplySelection((current) => current ? null : current);
  }, []);
  const scheduleReplySelectionClear = useCallback(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      clearReplySelection();
      return;
    }
    if (document.visibilityState !== "visible" || !document.hasFocus()) {
      return;
    }
    cancelReplySelectionClear();
    replySelectionClearTimeoutRef.current = window.setTimeout(() => {
      replySelectionClearTimeoutRef.current = null;
      clearReplySelection();
    }, 140);
  }, [cancelReplySelectionClear, clearReplySelection]);
  const resolveReplySelectionFromSelection = useCallback(
    (scopeHint) => {
      if (typeof window === "undefined") {
        return null;
      }
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        return null;
      }
      const range = selection.getRangeAt(0);
      const { startScope, endScope } = findSelectionReplyScopeElements(selection, range);
      const commonScope = findSelectionReplyScopeElement(range.commonAncestorContainer);
      const candidates = [scopeHint ?? null, startScope, endScope, commonScope, lastReplySelectionScopeRef.current].filter((scope) => Boolean(scope)).filter((scope, index2, list4) => list4.indexOf(scope) === index2);
      const matches = candidates.filter((scope) => readSelectedTextWithinElement(scope, range).length > 0);
      if (matches.length !== 1) {
        return null;
      }
      const scopeElement = matches[0];
      const text7 = readSelectedTextWithinElement(scopeElement, range);
      if (!text7) {
        return null;
      }
      const messageIndex = parseReplySelectionMessageIndex(scopeElement.dataset.messageIndex);
      if (messageIndex === null) {
        return null;
      }
      return {
        scopeElement,
        selection: {
          text: text7,
          messageIndex,
          blockId: scopeElement.dataset.blockId?.trim() || void 0
        }
      };
    },
    []
  );
  const applyResolvedReplySelection = useCallback(
    (resolvedSelection) => {
      if (!resolvedSelection) {
        scheduleReplySelectionClear();
        return;
      }
      cancelReplySelectionClear();
      lastReplySelectionScopeRef.current = resolvedSelection.scopeElement;
      setReplySelection((current) => {
        if (current && current.text === resolvedSelection.selection.text && current.messageIndex === resolvedSelection.selection.messageIndex && current.blockId === resolvedSelection.selection.blockId) {
          return current;
        }
        return resolvedSelection.selection;
      });
    },
    [cancelReplySelectionClear, scheduleReplySelectionClear]
  );
  const syncReplySelectionFromSelection = useCallback(
    (scopeHint) => {
      applyResolvedReplySelection(resolveReplySelectionFromSelection(scopeHint));
    },
    [applyResolvedReplySelection, resolveReplySelectionFromSelection]
  );
  const scheduleReplySelectionSync = useCallback(
    (scopeElement) => {
      if (typeof window === "undefined" || !onReplyToSelection) {
        clearScheduledReplySelectionSync();
        cancelReplySelectionClear();
        clearReplySelection();
        return;
      }
      const sync = () => {
        syncReplySelectionFromSelection(scopeElement);
      };
      clearScheduledReplySelectionSync();
      replySelectionSyncFrameRef.current = window.requestAnimationFrame(() => {
        replySelectionSyncFrameRef.current = null;
        sync();
      });
      for (const delayMs of [40, 120, 240, 480]) {
        const timeoutId = window.setTimeout(() => {
          replySelectionSyncTimeoutRefs.current = replySelectionSyncTimeoutRefs.current.filter((currentId) => currentId !== timeoutId);
          sync();
        }, delayMs);
        replySelectionSyncTimeoutRefs.current.push(timeoutId);
      }
    },
    [cancelReplySelectionClear, clearReplySelection, clearScheduledReplySelectionSync, onReplyToSelection, syncReplySelectionFromSelection]
  );
  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined" || !onReplyToSelection) {
      clearScheduledReplySelectionSync();
      cancelReplySelectionClear();
      clearReplySelection();
      return;
    }
    const handleDocumentReplySelectionSync = () => {
      scheduleReplySelectionSync();
    };
    const handleFocus = () => {
      scheduleReplySelectionSync();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        scheduleReplySelectionSync();
      }
    };
    document.addEventListener("selectionchange", handleDocumentReplySelectionSync);
    document.addEventListener("mouseup", handleDocumentReplySelectionSync);
    document.addEventListener("pointerup", handleDocumentReplySelectionSync);
    document.addEventListener("keyup", handleDocumentReplySelectionSync);
    document.addEventListener("touchend", handleDocumentReplySelectionSync);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handleFocus);
    return () => {
      document.removeEventListener("selectionchange", handleDocumentReplySelectionSync);
      document.removeEventListener("mouseup", handleDocumentReplySelectionSync);
      document.removeEventListener("pointerup", handleDocumentReplySelectionSync);
      document.removeEventListener("keyup", handleDocumentReplySelectionSync);
      document.removeEventListener("touchend", handleDocumentReplySelectionSync);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handleFocus);
      clearScheduledReplySelectionSync();
      cancelReplySelectionClear();
    };
  }, [cancelReplySelectionClear, clearReplySelection, clearScheduledReplySelectionSync, onReplyToSelection, scheduleReplySelectionSync]);
  useEffect(() => {
    if (!replySelection || typeof document === "undefined" || typeof window === "undefined") {
      return;
    }
    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      const element3 = target instanceof HTMLElement ? target : target.parentElement;
      if (element3?.closest('[data-selection-context-menu="true"]') || element3?.closest('[data-selection-reply-scope="assistant-message"]')) {
        return;
      }
      cancelReplySelectionClear();
      clearReplySelection();
    };
    const handleKeyDown = (event) => {
      if (event.key !== "Escape") {
        return;
      }
      cancelReplySelectionClear();
      clearReplySelection();
      clearWindowSelection();
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [cancelReplySelectionClear, clearReplySelection, replySelection]);
  useEffect(() => {
    if (!selectionContextMenu || typeof document === "undefined" || typeof window === "undefined") {
      return;
    }
    const closeMenu = () => {
      closeSelectionContextMenu();
    };
    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        closeMenu();
        return;
      }
      const element3 = target instanceof HTMLElement ? target : target.parentElement;
      if (element3?.closest('[data-selection-context-menu="true"]')) {
        return;
      }
      closeMenu();
    };
    const handleSelectionChange = () => {
      const selectionText = window.getSelection()?.toString().trim() ?? "";
      const now = typeof performance === "undefined" ? Date.now() : performance.now();
      const menuJustOpened = now - selectionContextMenuOpenedAtRef.current < 350;
      if (!selectionText && !menuJustOpened) {
        closeMenu();
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };
    const scrollEl = scrollContainerRef?.current;
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("selectionchange", handleSelectionChange);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", closeMenu);
    window.addEventListener("resize", closeMenu);
    scrollEl?.addEventListener("scroll", closeMenu, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("selectionchange", handleSelectionChange);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", closeMenu);
      window.removeEventListener("resize", closeMenu);
      scrollEl?.removeEventListener("scroll", closeMenu);
    };
  }, [closeSelectionContextMenu, scrollContainerRef, selectionContextMenu]);
  const handleReplySelection = useCallback(
    async (selectionOverride, action) => {
      const activeSelection = selectionOverride ?? replySelection;
      if (!activeSelection || !onReplyToSelection) {
        return;
      }
      closeSelectionContextMenu();
      clearReplySelection();
      clearWindowSelection();
      await onReplyToSelection({
        text: activeSelection.text,
        messageIndex: activeSelection.messageIndex,
        blockId: activeSelection.blockId,
        ...action ? { action } : {}
      });
    },
    [clearReplySelection, closeSelectionContextMenu, onReplyToSelection, replySelection]
  );
  const copySelectedTranscriptText = useCallback(
    async (text7) => {
      const nextText = typeof text7 === "string" ? text7 : "";
      closeSelectionContextMenu();
      if (!nextText) {
        clearReplySelection();
        clearWindowSelection();
        return;
      }
      try {
        await writeClipboardText(nextText);
      } catch {
      } finally {
        clearWindowSelection();
        clearReplySelection();
      }
    },
    [clearReplySelection, closeSelectionContextMenu]
  );
  const openDomSelectionContextMenu = useCallback((menuState) => {
    selectionContextMenuOpenedAtRef.current = typeof performance === "undefined" ? Date.now() : performance.now();
    setSelectionContextMenu(menuState);
  }, []);
  const runSelectionContextMenuAction = useCallback(
    async (action, menuState) => {
      const activeMenuState = menuState ?? selectionContextMenu;
      if (!action || !activeMenuState) {
        closeSelectionContextMenu();
        return;
      }
      if (typeof action === "object") {
        await handleReplySelection(activeMenuState.replySelection, action);
        return;
      }
      switch (action) {
        case "reply":
          await handleReplySelection(activeMenuState.replySelection);
          return;
        case "copy":
          await copySelectedTranscriptText(activeMenuState.copyText ?? activeMenuState.text);
          return;
      }
    },
    [closeSelectionContextMenu, copySelectedTranscriptText, handleReplySelection, selectionContextMenu]
  );
  const handleTranscriptContextMenu = useCallback(
    (event) => {
      if (typeof window === "undefined") {
        return;
      }
      const scopeHint = event.target instanceof Node ? findSelectionReplyScopeElement(event.target) : null;
      const resolvedReplySelection = onReplyToSelection ? resolveReplySelectionFromSelection(scopeHint) : null;
      if (onReplyToSelection) {
        applyResolvedReplySelection(resolvedReplySelection);
      }
      const rawSelectionText = window.getSelection()?.toString() ?? "";
      const selectionText = resolvedReplySelection?.selection.text ?? rawSelectionText.trim();
      if (!selectionText) {
        closeSelectionContextMenu();
        return;
      }
      event.preventDefault();
      const menuState = {
        x: event.clientX,
        y: event.clientY,
        text: selectionText,
        copyText: rawSelectionText || selectionText,
        replySelection: resolvedReplySelection?.selection ?? null
      };
      openDomSelectionContextMenu(menuState);
    },
    [
      applyResolvedReplySelection,
      closeSelectionContextMenu,
      onReplyToSelection,
      openDomSelectionContextMenu,
      resolveReplySelectionFromSelection,
      runSelectionContextMenuAction
    ]
  );
  return {
    replySelection,
    selectionContextMenu,
    selectionContextMenuRef,
    scheduleReplySelectionSync,
    runSelectionContextMenuAction,
    handleTranscriptContextMenu
  };
}

// packages/desktop/ui/src/components/chat/useChatWindowing.ts
init_neon_pilot_shared_react();
var MAX_OVERSCAN_CHUNKS = 10;
function normalizeChunkHeight(height) {
  if (!Number.isFinite(height) || height <= 0) {
    return null;
  }
  return Math.ceil(height);
}
function mergeChunkHeightMeasurements(current, measurements) {
  let changed = false;
  const next = { ...current };
  for (const [chunkKey, measuredHeight] of Object.entries(measurements)) {
    const height = normalizeChunkHeight(measuredHeight);
    if (height === null || current[chunkKey] === height) {
      continue;
    }
    next[chunkKey] = height;
    changed = true;
  }
  return changed ? next : current;
}
function calculateAverageSpanHeight(renderChunks, chunkHeights) {
  const measurements = renderChunks.map((chunk) => ({ height: chunkHeights[chunk.key], spanCount: chunk.spanCount })).filter(
    (entry) => typeof entry.height === "number" && entry.height > 0 && entry.spanCount > 0
  );
  if (measurements.length === 0) {
    return CHAT_WINDOWING_FALLBACK_SPAN_HEIGHT;
  }
  const totalHeight = measurements.reduce((sum, entry) => sum + entry.height, 0);
  const totalSpans = measurements.reduce((sum, entry) => sum + entry.spanCount, 0);
  return totalSpans > 0 ? totalHeight / totalSpans : CHAT_WINDOWING_FALLBACK_SPAN_HEIGHT;
}
function buildChatRenderChunkLayouts(renderChunks, chunkHeights, averageSpanHeight) {
  let top = 0;
  return renderChunks.map((chunk) => {
    const estimatedHeight = Math.max(1, chunk.spanCount * averageSpanHeight);
    const height = chunkHeights[chunk.key] ?? estimatedHeight;
    const layout = {
      ...chunk,
      top,
      height,
      bottom: top + height
    };
    top += height;
    return layout;
  });
}
function resolveVisibleChunkRange({
  chunkLayouts,
  focusMessageIndex,
  anchorToTail,
  overscanChunks,
  viewport
}) {
  if (chunkLayouts.length === 0) {
    return null;
  }
  const normalizedOverscanChunks = Number.isSafeInteger(overscanChunks) && overscanChunks >= 0 ? Math.min(MAX_OVERSCAN_CHUNKS, overscanChunks) : 0;
  const totalHeight = chunkLayouts[chunkLayouts.length - 1]?.bottom ?? 0;
  const tops = chunkLayouts.map((chunk) => chunk.top);
  const heights = chunkLayouts.map((chunk) => chunk.height);
  const focusChunkIndex = focusMessageIndex === null ? -1 : chunkLayouts.findIndex((chunk) => focusMessageIndex >= chunk.startMessageIndex && focusMessageIndex <= chunk.endMessageIndex);
  let startChunkIndex;
  let endChunkIndex;
  if (viewport === null) {
    const anchorChunkIndex = focusChunkIndex >= 0 ? focusChunkIndex : chunkLayouts.length - 1;
    startChunkIndex = Math.max(0, anchorChunkIndex - normalizedOverscanChunks);
    endChunkIndex = Math.min(chunkLayouts.length - 1, anchorChunkIndex + normalizedOverscanChunks);
  } else {
    const viewportHeight = Math.max(1, viewport.clientHeight);
    const maxViewportTop = Math.max(0, totalHeight - viewportHeight);
    const viewportTop = anchorToTail && focusChunkIndex < 0 ? maxViewportTop : Math.min(maxViewportTop, Math.max(0, viewport.scrollTop));
    const viewportBottom = Math.min(totalHeight, viewportTop + viewportHeight);
    const firstVisibleChunkIndex = resolveChunkIndexForOffset(viewportTop, tops, heights);
    const lastVisibleChunkIndex = resolveChunkIndexForOffset(viewportBottom, tops, heights);
    startChunkIndex = Math.max(0, firstVisibleChunkIndex - normalizedOverscanChunks);
    endChunkIndex = Math.min(chunkLayouts.length - 1, lastVisibleChunkIndex + normalizedOverscanChunks);
    if (focusChunkIndex >= 0 && (focusChunkIndex < startChunkIndex || focusChunkIndex > endChunkIndex)) {
      startChunkIndex = Math.max(0, focusChunkIndex - normalizedOverscanChunks);
      endChunkIndex = Math.min(chunkLayouts.length - 1, focusChunkIndex + normalizedOverscanChunks);
    }
  }
  const topSpacerHeight = startChunkIndex > 0 ? chunkLayouts[startChunkIndex].top : 0;
  const bottomSpacerHeight = endChunkIndex < chunkLayouts.length - 1 ? Math.max(0, totalHeight - chunkLayouts[endChunkIndex].bottom) : 0;
  return {
    chunks: chunkLayouts.slice(startChunkIndex, endChunkIndex + 1),
    topSpacerHeight,
    bottomSpacerHeight
  };
}
function useChatWindowing({
  scrollContainerRef,
  renderItems,
  messageIndexOffset,
  renderingProfile,
  focusMessageIndex,
  anchorToTail
}) {
  const renderItemSpanCount = useMemo(
    () => getChatRenderItemsSpanCount(renderItems, messageIndexOffset),
    [messageIndexOffset, renderItems]
  );
  const shouldWindowTranscript = Boolean(scrollContainerRef) && renderItemSpanCount >= renderingProfile.windowingThreshold;
  const renderChunks = useMemo(
    () => shouldWindowTranscript ? buildChatRenderChunks(renderItems, messageIndexOffset, renderingProfile.windowingChunkSize) : [],
    [messageIndexOffset, renderItems, renderingProfile.windowingChunkSize, shouldWindowTranscript]
  );
  const [viewport, setViewport] = useState(null);
  const [chunkHeights, setChunkHeights] = useState({});
  const pendingChunkHeightsRef = useRef({});
  const chunkHeightFrameRef = useRef(0);
  useEffect(() => {
    if (!shouldWindowTranscript) {
      setViewport(null);
      return;
    }
    const scrollEl = scrollContainerRef?.current;
    if (!scrollEl) {
      return;
    }
    let frame = 0;
    const sync = () => {
      frame = 0;
      const next = {
        scrollTop: scrollEl.scrollTop,
        clientHeight: scrollEl.clientHeight
      };
      setViewport(
        (current) => current && current.scrollTop === next.scrollTop && current.clientHeight === next.clientHeight ? current : next
      );
    };
    const scheduleSync = () => {
      if (frame !== 0) {
        return;
      }
      frame = window.requestAnimationFrame(sync);
    };
    scheduleSync();
    scrollEl.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync);
    return () => {
      scrollEl.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [shouldWindowTranscript, scrollContainerRef]);
  const averageSpanHeight = useMemo(() => calculateAverageSpanHeight(renderChunks, chunkHeights), [chunkHeights, renderChunks]);
  const chunkLayouts = useMemo(
    () => buildChatRenderChunkLayouts(renderChunks, chunkHeights, averageSpanHeight),
    [averageSpanHeight, chunkHeights, renderChunks]
  );
  const flushChunkHeightMeasurements = useCallback(() => {
    chunkHeightFrameRef.current = 0;
    const measurements = pendingChunkHeightsRef.current;
    pendingChunkHeightsRef.current = {};
    if (Object.keys(measurements).length === 0) {
      return;
    }
    setChunkHeights((current) => mergeChunkHeightMeasurements(current, measurements));
  }, []);
  const updateChunkHeight = useCallback(
    (chunkKey, height) => {
      pendingChunkHeightsRef.current[chunkKey] = height;
      if (chunkHeightFrameRef.current !== 0) {
        return;
      }
      chunkHeightFrameRef.current = window.requestAnimationFrame(flushChunkHeightMeasurements);
    },
    [flushChunkHeightMeasurements]
  );
  useEffect(
    () => () => {
      if (chunkHeightFrameRef.current !== 0) {
        window.cancelAnimationFrame(chunkHeightFrameRef.current);
        chunkHeightFrameRef.current = 0;
      }
      pendingChunkHeightsRef.current = {};
    },
    []
  );
  const visibleChunkRange = useMemo(
    () => shouldWindowTranscript ? resolveVisibleChunkRange({
      chunkLayouts,
      focusMessageIndex,
      anchorToTail,
      overscanChunks: renderingProfile.windowingOverscanChunks,
      viewport
    }) : null,
    [anchorToTail, chunkLayouts, focusMessageIndex, renderingProfile.windowingOverscanChunks, shouldWindowTranscript, viewport]
  );
  return {
    shouldWindowTranscript,
    renderChunks,
    visibleChunkRange,
    updateChunkHeight,
    renderItemSpanCount
  };
}

// packages/desktop/ui/src/components/chat/useInlineTraceRunExpansion.ts
init_neon_pilot_shared_react();
function readRawRunCallbackLinkedRunIds(text7) {
  if (!/\b(?:Durable run|Background task)\s+\S+\s+has finished\./.test(text7.trim()) || !/\btaskSlug=/.test(text7) || !/\bstatus=/.test(text7) || !/\blog=/.test(text7) || !/Recent log tail:/.test(text7)) {
    return [];
  }
  const mentionedRuns = readMentionedLinkedRunsFromText(text7);
  if (mentionedRuns.length > 0) {
    return mentionedRuns.map((run) => run.runId);
  }
  const directRunId = text7.match(/\b(?:Durable run|Background task)\s+([^\s]+)\s+has finished\./)?.[1]?.trim();
  return directRunId ? readMentionedLinkedRunsFromText(`runId=${directRunId}`).map((run) => run.runId) : [];
}
function collectVisibleInlineRunKeys(renderItems) {
  const next = /* @__PURE__ */ new Set();
  for (const item of renderItems) {
    if (item.type === "message" && "text" in item.block && typeof item.block.text === "string") {
      for (const runId of readRawRunCallbackLinkedRunIds(item.block.text)) {
        next.add(buildInlineRunExpansionKey(item.index, runId));
      }
      continue;
    }
    if (item.type === "trace_cluster") {
      for (const run of collectTraceClusterLinkedRuns(item.blocks)) {
        next.add(buildInlineRunExpansionKey(item.startIndex, run.runId));
      }
    }
  }
  return next;
}
function readFirstVisibleInlineRunKey(renderItems) {
  return collectVisibleInlineRunKeys(renderItems).values().next().value ?? null;
}
function filterInlineRunKeys(current, visibleInlineRunKeySet) {
  if (current.size === 0) {
    return current;
  }
  let changed = false;
  const next = /* @__PURE__ */ new Set();
  for (const inlineRunKey of current) {
    if (visibleInlineRunKeySet.has(inlineRunKey)) {
      next.add(inlineRunKey);
    } else {
      changed = true;
    }
  }
  return changed ? next : current;
}
function toggleInlineRunKey(current, inlineRunKey) {
  const next = new Set(current);
  if (next.has(inlineRunKey)) {
    next.delete(inlineRunKey);
  } else {
    next.add(inlineRunKey);
  }
  return next;
}
function useInlineTraceRunExpansion(renderItems) {
  const [expandedInlineRunKeys, setExpandedInlineRunKeys] = useState(() => /* @__PURE__ */ new Set());
  const firstVisibleInlineRunKey = useMemo(() => readFirstVisibleInlineRunKey(renderItems), [renderItems]);
  useEffect(() => {
    setExpandedInlineRunKeys((current) => {
      if (current.size === 0) {
        return current;
      }
      return filterInlineRunKeys(current, collectVisibleInlineRunKeys(renderItems));
    });
  }, [renderItems]);
  const isInlineRunExpanded = useCallback((inlineRunKey) => expandedInlineRunKeys.has(inlineRunKey), [expandedInlineRunKeys]);
  const toggleInlineRun = useCallback((inlineRunKey) => {
    setExpandedInlineRunKeys((current) => toggleInlineRunKey(current, inlineRunKey));
  }, []);
  const toggleFirstInlineRun = useCallback(() => {
    if (!firstVisibleInlineRunKey) {
      return false;
    }
    setExpandedInlineRunKeys((current) => toggleInlineRunKey(current, firstVisibleInlineRunKey));
    return true;
  }, [firstVisibleInlineRunKey]);
  const expandInlineRun = useCallback((inlineRunKey) => {
    setExpandedInlineRunKeys((current) => current.has(inlineRunKey) ? current : new Set(current).add(inlineRunKey));
  }, []);
  return {
    isInlineRunExpanded,
    toggleInlineRun,
    toggleFirstInlineRun,
    hasVisibleInlineRuns: Boolean(firstVisibleInlineRunKey),
    expandInlineRun
  };
}

// packages/desktop/ui/src/components/chat/ChatView.tsx
function filterTranscriptReplyStarterActions(selectionActions) {
  return (selectionActions ?? []).filter(
    (action) => action.action === "composer.replyToSelection" && (action.kinds.includes("text") || action.kinds.includes("transcriptRange"))
  );
}
function shouldFocusComposerFromTranscriptPointerDown(event) {
  if (event.defaultPrevented || event.button !== 0) {
    return false;
  }
  const target = event.target;
  if (!(target instanceof Element)) {
    return false;
  }
  const selection = window.getSelection?.();
  if (selection && !selection.isCollapsed) {
    return false;
  }
  return !target.closest(
    [
      "[data-message-index]",
      "[data-selection-reply-scope]",
      "a",
      "button",
      "input",
      "textarea",
      "select",
      '[contenteditable="true"]',
      '[role="button"]',
      '[role="menu"]'
    ].join(",")
  );
}
function isLeadingContextItem(item) {
  return item.type === "context_cluster" || item.type === "message" && (item.block.type === "context" || item.block.type === "summary" && item.block.kind !== "compaction");
}
function areChatViewPropsEqual(previous3, next) {
  return previous3.messages === next.messages && previous3.conversationId === next.conversationId && (previous3.messageIndexOffset ?? 0) === (next.messageIndexOffset ?? 0) && previous3.scrollContainerRef === next.scrollContainerRef && (previous3.focusMessageIndex ?? null) === (next.focusMessageIndex ?? null) && (previous3.isStreaming ?? false) === (next.isStreaming ?? false) && (previous3.isCompacting ?? false) === (next.isCompacting ?? false) && (previous3.pendingStatusLabel ?? null) === (next.pendingStatusLabel ?? null) && (previous3.performanceMode ?? "default") === (next.performanceMode ?? "default") && (previous3.layout ?? "default") === (next.layout ?? "default") && previous3.selectionActions === next.selectionActions && previous3.hydratingMessageBlockIds === next.hydratingMessageBlockIds && (previous3.activeArtifactId ?? null) === (next.activeArtifactId ?? null) && (previous3.activeCheckpointId ?? null) === (next.activeCheckpointId ?? null) && (previous3.askUserQuestionDisplayMode ?? "inline") === (next.askUserQuestionDisplayMode ?? "inline") && (previous3.resumeConversationBusy ?? false) === (next.resumeConversationBusy ?? false) && (previous3.resumeConversationTitle ?? null) === (next.resumeConversationTitle ?? null) && (previous3.resumeConversationLabel ?? "continue") === (next.resumeConversationLabel ?? "continue") && previous3.windowingHeaderContent === next.windowingHeaderContent && (previous3.anchorWindowingToTail ?? false) === (next.anchorWindowingToTail ?? false) && (previous3.bottomPaddingPx ?? 96) === (next.bottomPaddingPx ?? 96) && (previous3.systemPrompt ?? null) === (next.systemPrompt ?? null) && previous3.toolDefinitions === next.toolDefinitions && (previous3.remoteControlled ?? false) === (next.remoteControlled ?? false) && (previous3.remoteControlStatus ?? null) === (next.remoteControlStatus ?? null) && previous3.precomputedRenderItems === next.precomputedRenderItems && previous3.onOpenFilePath === next.onOpenFilePath && previous3.validatedFilePathTargets === next.validatedFilePathTargets;
}
var ChatView = memo(function ChatView2({
  messages,
  conversationId = null,
  messageIndexOffset = 0,
  scrollContainerRef,
  focusMessageIndex = null,
  isStreaming = false,
  isCompacting = false,
  pendingStatusLabel = null,
  performanceMode = "default",
  layout = "default",
  onForkMessage,
  onRewindMessage,
  onEditUserMessage,
  onReplyToSelection,
  selectionActions,
  onHydrateMessage,
  hydratingMessageBlockIds,
  onOpenArtifact,
  activeArtifactId,
  onOpenCheckpoint,
  activeCheckpointId,
  onOpenBrowser,
  onOpenFilePath,
  validatedFilePathTargets,
  onSubmitAskUserQuestion,
  askUserQuestionDisplayMode = "inline",
  onResumeConversation,
  onFocusComposerRequest,
  resumeConversationBusy = false,
  resumeConversationTitle,
  resumeConversationLabel = "continue",
  windowingHeaderContent,
  anchorWindowingToTail = false,
  bottomPaddingPx = 96,
  systemPrompt = null,
  toolDefinitions = [],
  showSystemPromptDisclosure = false,
  remoteControlled = false,
  remoteControlStatus = null,
  precomputedRenderItems
}) {
  const renderStartedAtRef = useRef(performance.now());
  renderStartedAtRef.current = performance.now();
  const extensionRegistry = useExtensionRegistry();
  const tasks = useAllTasks();
  const sessions = useAllSessions();
  const runRecords = useAllRuns();
  const runLookups = useMemo(() => ({ tasks, sessions }), [tasks, sessions]);
  const { data: settingsValues } = useApi(api.settings, void 0, { notifyOnError: false });
  const transcriptDisclosureMode = normalizeConversationTranscriptDisclosureMode(
    settingsValues?.[CONVERSATION_TRANSCRIPT_DISCLOSURE_SETTING_KEY]
  );
  const diffDisclosureMode = normalizeConversationDiffDisclosureMode(settingsValues?.[CONVERSATION_DIFF_DISCLOSURE_SETTING_KEY]);
  const showPinnedToolCalls = settingsValues?.[CONVERSATION_PINNED_TOOL_CALLS_SETTING_KEY] !== false;
  const standaloneTools = useMemo(() => {
    const tools = /* @__PURE__ */ new Set();
    for (const extension2 of extensionRegistry.extensions) {
      if (!extension2.enabled) continue;
      for (const renderer of extension2.manifest?.contributes?.transcriptRenderers ?? []) {
        if (renderer.standalone) {
          tools.add(renderer.tool);
        }
      }
    }
    return tools;
  }, [extensionRegistry.extensions]);
  const renderItemsCacheRef = useRef(null);
  const renderItems = useMemo(() => {
    if (precomputedRenderItems) {
      const nextRenderItems = precomputedRenderItems;
      renderItemsCacheRef.current = { conversationId, messages, standaloneTools, renderItems: nextRenderItems };
      return nextRenderItems;
    }
    return measureClientPerfTiming(
      {
        name: "chat.buildRenderItems",
        minDurationMs: 8,
        meta: { conversationId, messageCount: messages.length, standaloneToolCount: standaloneTools.size }
      },
      () => {
        const previous3 = renderItemsCacheRef.current;
        const nextRenderItems = buildChatRenderItemsIncremental({
          messages,
          standaloneTools,
          previousMessages: previous3?.conversationId === conversationId && previous3.standaloneTools === standaloneTools ? previous3.messages : void 0,
          previousRenderItems: previous3?.conversationId === conversationId && previous3.standaloneTools === standaloneTools ? previous3.renderItems : void 0
        });
        renderItemsCacheRef.current = { conversationId, messages, standaloneTools, renderItems: nextRenderItems };
        return nextRenderItems;
      }
    );
  }, [conversationId, messages, precomputedRenderItems, standaloneTools]);
  const renderItemStats = useMemo(() => {
    return measureClientPerfTiming(
      {
        name: "chat.computeRenderItemStats",
        minDurationMs: 8,
        meta: { conversationId, renderItemCount: renderItems.length }
      },
      () => {
        let messageItems = 0;
        let traceClusters = 0;
        let traceBlocks = 0;
        let toolBlocks = 0;
        let standaloneToolBlocks = 0;
        let markdownBlocks = 0;
        for (const item of renderItems) {
          if (item.type === "trace_cluster") {
            traceClusters += 1;
            traceBlocks += item.blocks.length;
            toolBlocks += item.blocks.filter((block2) => block2.type === "tool_use").length;
            continue;
          }
          if (item.type === "context_cluster") {
            messageItems += item.blocks.length;
            continue;
          }
          messageItems += 1;
          const block = item.block;
          if (block.type === "tool_use") {
            toolBlocks += 1;
            standaloneToolBlocks += 1;
          } else if (block.type === "assistant" || block.type === "user") {
            markdownBlocks += 1;
          }
        }
        return { messageItems, traceClusters, traceBlocks, toolBlocks, standaloneToolBlocks, markdownBlocks };
      }
    );
  }, [conversationId, renderItems]);
  const { isInlineRunExpanded, toggleInlineRun, toggleFirstInlineRun, hasVisibleInlineRuns, expandInlineRun } = useInlineTraceRunExpansion(renderItems);
  useEffect(() => {
    if (!hasVisibleInlineRuns) return void 0;
    return registerInlineTraceRunToggleCapability();
  }, [hasVisibleInlineRuns]);
  useEffect(() => {
    function handleToggleFirstInlineTraceRun(event) {
      const detail = event.detail;
      if (detail?.handled || !hasVisibleInlineRuns) return;
      if (toggleFirstInlineRun() && detail) detail.handled = true;
    }
    window.addEventListener(INLINE_TRACE_RUN_TOGGLE_FIRST_COMMAND_EVENT, handleToggleFirstInlineTraceRun);
    return () => window.removeEventListener(INLINE_TRACE_RUN_TOGGLE_FIRST_COMMAND_EVENT, handleToggleFirstInlineTraceRun);
  }, [hasVisibleInlineRuns, toggleFirstInlineRun]);
  useEffect(() => {
    function handleTranscriptSpotlight(event) {
      const detail = "detail" in event && event.detail && typeof event.detail === "object" ? event.detail : null;
      const target = detail?.target;
      if (!target || typeof target !== "object" || !("kind" in target)) return;
      if (spotlightTranscriptTarget(target)) return;
      if (target.kind === "background_run") {
        window.dispatchEvent(new CustomEvent("pa:focus-background-run", { detail: { runId: target.runId } }));
      }
    }
    function handleFocusBackgroundRun(event) {
      const detail = "detail" in event && event.detail && typeof event.detail === "object" ? event.detail : null;
      const runId = typeof detail?.runId === "string" ? detail.runId.trim() : "";
      if (!runId) return;
      let focusRunId = runId;
      const item = renderItems.find((candidate) => {
        if (candidate.type !== "trace_cluster") return false;
        return collectTraceClusterLinkedRuns(candidate.blocks).some((run) => {
          const resolvedRunId = resolveLinkedRunRecord(run, runRecords, runLookups)?.runId ?? run.runId;
          if (run.runId !== runId && resolvedRunId !== runId) return false;
          focusRunId = resolvedRunId;
          return true;
        });
      });
      if (!item || item.type !== "trace_cluster") return;
      expandInlineRun(buildInlineRunExpansionKey(item.startIndex, focusRunId));
      window.requestAnimationFrame(() => {
        const node2 = document.querySelector(`[data-trace-cluster-start-index="${messageIndexOffset + item.startIndex}"]`);
        node2?.scrollIntoView({ behavior: "smooth", block: "center" });
        node2?.querySelector('button[aria-expanded="false"]')?.click();
        window.setTimeout(() => {
          spotlightTranscriptTarget({ kind: "background_run", runId: focusRunId });
        }, 0);
      });
    }
    window.addEventListener("pa:transcript-spotlight", handleTranscriptSpotlight);
    window.addEventListener("pa:focus-background-run", handleFocusBackgroundRun);
    return () => {
      window.removeEventListener("pa:transcript-spotlight", handleTranscriptSpotlight);
      window.removeEventListener("pa:focus-background-run", handleFocusBackgroundRun);
    };
  }, [expandInlineRun, messageIndexOffset, renderItems, runLookups, runRecords]);
  const streamingStatusLabel = isCompacting ? "Compacting context\u2026" : pendingStatusLabel ?? getStreamingStatusLabel(messages, isStreaming);
  const renderingProfile = CHAT_VIEW_RENDERING_PROFILE[performanceMode];
  const lastBlock = messages[messages.length - 1];
  const showStreamingIndicator = !!streamingStatusLabel && (isCompacting || lastBlock?.type !== "error") && (isCompacting || Boolean(pendingStatusLabel) || !lastBlock || lastBlock.type === "user");
  const contentVisibilityStyle = void 0;
  const { shouldWindowTranscript, renderChunks, visibleChunkRange, updateChunkHeight, renderItemSpanCount } = useChatWindowing({
    scrollContainerRef,
    renderItems,
    messageIndexOffset,
    renderingProfile,
    focusMessageIndex,
    anchorToTail: anchorWindowingToTail
  });
  const [selectedImage, setSelectedImage] = useState(null);
  const transcriptSelectionActions = filterTranscriptReplyStarterActions(selectionActions);
  const {
    selectionContextMenu,
    selectionContextMenuRef,
    scheduleReplySelectionSync,
    runSelectionContextMenuAction,
    handleTranscriptContextMenu
  } = useChatReplySelection({ onReplyToSelection, scrollContainerRef });
  useEffect(() => {
    if (!selectedImage || typeof document === "undefined") {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setSelectedImage(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedImage]);
  const renderChatItem = (item, itemIndex, renderItemsLength = renderItems.length) => /* @__PURE__ */ jsx(
    ChatRenderItemView,
    {
      item,
      itemIndex,
      renderItemsLength,
      conversationId,
      messageIndexOffset,
      messages,
      isStreaming,
      contentVisibilityStyle,
      layout,
      onForkMessage,
      onRewindMessage,
      onEditUserMessage,
      onReplyToSelection,
      onHydrateMessage,
      hydratingMessageBlockIds,
      onOpenArtifact,
      activeArtifactId,
      onOpenCheckpoint,
      activeCheckpointId,
      onOpenBrowser,
      onOpenFilePath,
      validatedFilePathTargets,
      onSubmitAskUserQuestion,
      askUserQuestionDisplayMode,
      onResumeConversation,
      resumeConversationBusy,
      resumeConversationTitle,
      resumeConversationLabel,
      isInlineRunExpanded,
      onToggleInlineRun: toggleInlineRun,
      onInspectImage: setSelectedImage,
      onSelectionGesture: scheduleReplySelectionSync,
      transcriptDisclosureMode,
      diffDisclosureMode,
      showPinnedToolCalls
    },
    item.type === "trace_cluster" ? (
      // Use only startIndex so the component stays mounted when new blocks
      // append to the cluster during streaming. Using endIndex would change
      // the key on every append, unmounting all child ToolBlocks and losing
      // their expansion (preference) state.
      `trace-${messageIndexOffset + item.startIndex}`
    ) : messageIndexOffset + item.index
  );
  const leadingContextItemCount = (() => {
    let count = 0;
    for (const item of renderItems) {
      if (!isLeadingContextItem(item)) {
        break;
      }
      count += 1;
    }
    return count;
  })();
  const hasSystemPromptContext = showSystemPromptDisclosure && (Boolean(systemPrompt?.trim()) || toolDefinitions.length > 0);
  const shouldGroupIntroContext = !shouldWindowTranscript && (hasSystemPromptContext || leadingContextItemCount > 0 || remoteControlled);
  const introContextItems = shouldGroupIntroContext ? renderItems.slice(0, leadingContextItemCount) : [];
  const transcriptItems = shouldGroupIntroContext ? renderItems.slice(leadingContextItemCount) : renderItems;
  const introContextBlocks = introContextItems.flatMap((item) => {
    if (item.type === "context_cluster") return item.blocks;
    if (item.type === "message" && (item.block.type === "context" || item.block.type === "summary" && item.block.kind !== "compaction")) {
      return [item.block];
    }
    return [];
  });
  const fullTranscript = /* @__PURE__ */ jsx("div", { className: "space-y-4", children: transcriptItems.map((item, itemIndex) => renderChatItem(item, itemIndex + leadingContextItemCount)) });
  const windowedTranscript = visibleChunkRange ? /* @__PURE__ */ jsxs(Fragment2, { children: [
    visibleChunkRange.topSpacerHeight > 0 && /* @__PURE__ */ jsx("div", { style: { height: visibleChunkRange.topSpacerHeight }, "aria-hidden": true }),
    visibleChunkRange.chunks.map((chunk) => /* @__PURE__ */ jsx(
      WindowedChatChunk,
      {
        chunk,
        renderItem: renderChatItem,
        onHeightChange: updateChunkHeight,
        includeTrailingGap: chunk.endItemIndex < renderItems.length - 1 || showStreamingIndicator
      },
      chunk.key
    )),
    visibleChunkRange.bottomSpacerHeight > 0 && /* @__PURE__ */ jsx("div", { style: { height: visibleChunkRange.bottomSpacerHeight }, "aria-hidden": true })
  ] }) : fullTranscript;
  const mountedMessageCount = visibleChunkRange ? visibleChunkRange.chunks.reduce((sum, chunk) => sum + chunk.spanCount, 0) : messages.length;
  const mountedChunkCount = visibleChunkRange?.chunks.length ?? renderChunks.length;
  const transcriptBoundary = windowingHeaderContent ? /* @__PURE__ */ jsx("div", { className: "mb-5", children: windowingHeaderContent }) : null;
  useEffect(() => {
    const startedAtMs = renderStartedAtRef.current;
    const timeout = window.setTimeout(() => {
      recordChatRenderTiming({
        conversationId,
        route: `${window.location.pathname}${window.location.search}`,
        startedAtMs,
        meta: {
          messageCount: messages.length,
          renderItemCount: renderItems.length,
          renderItemSpanCount,
          mountedMessageCount,
          mountedChunkCount,
          totalChunkCount: renderChunks.length,
          shouldWindowTranscript,
          performanceMode,
          layout,
          isStreaming,
          ...renderItemStats
        }
      });
    });
    return () => window.clearTimeout(timeout);
  }, [
    conversationId,
    isStreaming,
    layout,
    messages.length,
    mountedChunkCount,
    mountedMessageCount,
    performanceMode,
    renderChunks.length,
    renderItemSpanCount,
    renderItemStats,
    renderItems.length,
    shouldWindowTranscript
  ]);
  return /* @__PURE__ */ jsxs(Fragment2, { children: [
    /* @__PURE__ */ jsx("style", { children: `@keyframes cursorBlink { 0%,100%{opacity:1} 50%{opacity:0} }` }),
    /* @__PURE__ */ jsxs(
      "div",
      {
        "data-chat-transcript-panel": "1",
        onContextMenu: handleTranscriptContextMenu,
        onPointerDown: (event) => {
          if (shouldFocusComposerFromTranscriptPointerDown(event)) {
            onFocusComposerRequest?.();
          }
        },
        className: layout === "compact" ? "px-2.5 py-3 sm:px-4 sm:py-4" : "mx-auto w-full max-w-6xl px-4 pt-4 pb-24 sm:px-6 lg:px-10 lg:pt-5",
        style: layout === "compact" ? void 0 : { paddingBottom: `${Math.max(96, bottomPaddingPx)}px` },
        children: [
          shouldGroupIntroContext ? /* @__PURE__ */ jsx("div", { className: transcriptItems.length > 0 || transcriptBoundary ? "mb-7 space-y-1.5" : "space-y-1.5", children: /* @__PURE__ */ jsx(
            ContextShelf,
            {
              blocks: introContextBlocks,
              messageIndexOffset: 0,
              currentConversationId: conversationId,
              systemPrompt: systemPrompt ?? "",
              toolDefinitions,
              remoteControlled,
              remoteControlStatus,
              onOpenFilePath,
              validatedFilePathTargets,
              onOpenCheckpoint,
              onSelectionGesture: onReplyToSelection ? scheduleReplySelectionSync : void 0
            }
          ) }) : hasSystemPromptContext ? /* @__PURE__ */ jsx("div", { className: "mb-1.5", children: /* @__PURE__ */ jsx(SystemPromptMessage, { text: systemPrompt ?? "", toolDefinitions }) }) : null,
          transcriptBoundary,
          shouldWindowTranscript ? windowedTranscript : fullTranscript,
          showStreamingIndicator && /* @__PURE__ */ jsx("div", { className: shouldWindowTranscript && visibleChunkRange?.chunks.length ? "" : "mt-4", children: /* @__PURE__ */ jsx(StreamingIndicator, { label: streamingStatusLabel ?? "Working\u2026" }) })
        ]
      }
    ),
    selectionContextMenu ? /* @__PURE__ */ jsx(
      SelectionContextMenu,
      {
        menuState: selectionContextMenu,
        menuRef: selectionContextMenuRef,
        selectionActions: transcriptSelectionActions,
        onAction: runSelectionContextMenuAction
      }
    ) : null,
    selectedImage && /* @__PURE__ */ jsx(ImageInspectModal, { image: selectedImage, onClose: () => setSelectedImage(null) })
  ] });
}, areChatViewPropsEqual);

export {
  ContextMenu,
  ensureExtensionFrontendReactGlobals,
  getExtensionRegistryRevision,
  createNativeExtensionClient,
  systemExtensionModules,
  useExtensionRegistry,
  filterTranscriptReplyStarterActions,
  ChatView
};
