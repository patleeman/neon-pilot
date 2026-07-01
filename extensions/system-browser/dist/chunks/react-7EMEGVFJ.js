import {
  ccount,
  find,
  html,
  stringify,
  stringify2,
  svg,
  whitespace
} from "./chunk-4YPGCSK5.js";
import {
  Fragment2 as Fragment,
  createContext,
  init_neon_pilot_shared_react,
  jsx,
  jsxs,
  useCallback,
  useContext,
  useEffect,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "./chunk-TTFLGCWD.js";
import {
  __commonJS,
  __toESM
} from "./chunk-MZHE4QUL.js";

// node_modules/.pnpm/lru_map@0.4.1/node_modules/lru_map/dist/lru.js
var require_lru = __commonJS({
  "node_modules/.pnpm/lru_map@0.4.1/node_modules/lru_map/dist/lru.js"(exports, module) {
    !function(g, c) {
      typeof exports == "object" && typeof module != "undefined" ? c(exports) : typeof define == "function" && define.amd ? define(["exports"], c) : c((g = g || self).lru_map = g.lru_map || {});
    }(exports, function(g) {
      const c = Symbol("newer"), e = Symbol("older");
      class n {
        constructor(a2, b3) {
          typeof a2 !== "number" && (b3 = a2, a2 = 0), this.size = 0, this.limit = a2, this.oldest = this.newest = void 0, this._keymap = /* @__PURE__ */ new Map(), b3 && (this.assign(b3), a2 < 1 && (this.limit = this.size));
        }
        _markEntryAsUsed(a2) {
          if (a2 === this.newest) return;
          a2[c] && (a2 === this.oldest && (this.oldest = a2[c]), a2[c][e] = a2[e]), a2[e] && (a2[e][c] = a2[c]), a2[c] = void 0, a2[e] = this.newest, this.newest && (this.newest[c] = a2), this.newest = a2;
        }
        assign(a2) {
          let b3, d2 = this.limit || Number.MAX_VALUE;
          this._keymap.clear();
          let m3 = a2[Symbol.iterator]();
          for (let h2 = m3.next(); !h2.done; h2 = m3.next()) {
            let f2 = new l3(h2.value[0], h2.value[1]);
            this._keymap.set(f2.key, f2), b3 ? (b3[c] = f2, f2[e] = b3) : this.oldest = f2, b3 = f2;
            if (d2-- == 0) throw new Error("overflow");
          }
          this.newest = b3, this.size = this._keymap.size;
        }
        get(a2) {
          var b3 = this._keymap.get(a2);
          return b3 ? (this._markEntryAsUsed(b3), b3.value) : void 0;
        }
        set(a2, b3) {
          var d2 = this._keymap.get(a2);
          return d2 ? (d2.value = b3, this._markEntryAsUsed(d2), this) : (this._keymap.set(a2, d2 = new l3(a2, b3)), this.newest ? (this.newest[c] = d2, d2[e] = this.newest) : this.oldest = d2, this.newest = d2, ++this.size, this.size > this.limit && this.shift(), this);
        }
        shift() {
          var a2 = this.oldest;
          if (a2) return this.oldest[c] ? (this.oldest = this.oldest[c], this.oldest[e] = void 0) : (this.oldest = void 0, this.newest = void 0), a2[c] = a2[e] = void 0, this._keymap.delete(a2.key), --this.size, [a2.key, a2.value];
        }
        find(a2) {
          let b3 = this._keymap.get(a2);
          return b3 ? b3.value : void 0;
        }
        has(a2) {
          return this._keymap.has(a2);
        }
        delete(a2) {
          var b3 = this._keymap.get(a2);
          return b3 ? (this._keymap.delete(b3.key), b3[c] && b3[e] ? (b3[e][c] = b3[c], b3[c][e] = b3[e]) : b3[c] ? (b3[c][e] = void 0, this.oldest = b3[c]) : b3[e] ? (b3[e][c] = void 0, this.newest = b3[e]) : this.oldest = this.newest = void 0, this.size--, b3.value) : void 0;
        }
        clear() {
          this.oldest = this.newest = void 0, this.size = 0, this._keymap.clear();
        }
        keys() {
          return new j2(this.oldest);
        }
        values() {
          return new k3(this.oldest);
        }
        entries() {
          return this;
        }
        [Symbol.iterator]() {
          return new i2(this.oldest);
        }
        forEach(a2, b3) {
          typeof b3 !== "object" && (b3 = this);
          let d2 = this.oldest;
          for (; d2; ) a2.call(b3, d2.value, d2.key, this), d2 = d2[c];
        }
        toJSON() {
          for (var a2 = new Array(this.size), b3 = 0, d2 = this.oldest; d2; ) a2[b3++] = { key: d2.key, value: d2.value }, d2 = d2[c];
          return a2;
        }
        toString() {
          for (var a2 = "", b3 = this.oldest; b3; ) a2 += String(b3.key) + ":" + b3.value, b3 = b3[c], b3 && (a2 += " < ");
          return a2;
        }
      }
      g.LRUMap = n;
      function l3(a2, b3) {
        this.key = a2, this.value = b3, this[c] = void 0, this[e] = void 0;
      }
      function i2(a2) {
        this.entry = a2;
      }
      i2.prototype[Symbol.iterator] = function() {
        return this;
      }, i2.prototype.next = function() {
        let a2 = this.entry;
        return a2 ? (this.entry = a2[c], { done: false, value: [a2.key, a2.value] }) : { done: true, value: void 0 };
      };
      function j2(a2) {
        this.entry = a2;
      }
      j2.prototype[Symbol.iterator] = function() {
        return this;
      }, j2.prototype.next = function() {
        let a2 = this.entry;
        return a2 ? (this.entry = a2[c], { done: false, value: a2.key }) : { done: true, value: void 0 };
      };
      function k3(a2) {
        this.entry = a2;
      }
      k3.prototype[Symbol.iterator] = function() {
        return this;
      }, k3.prototype.next = function() {
        let a2 = this.entry;
        return a2 ? (this.entry = a2[c], { done: false, value: a2.value }) : { done: true, value: void 0 };
      };
    });
  }
});

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/react/constants.js
var GutterUtilitySlotStyles = {
  position: "absolute",
  top: 0,
  bottom: 0,
  textAlign: "center"
};
var MergeConflictSlotStyles = { display: "contents" };
function noopRender() {
  return null;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/constants.js
var DIFFS_TAG_NAME = "diffs-container";
var COMMIT_METADATA_SPLIT = /(?=^From [a-f0-9]+ .+$)/m;
var GIT_DIFF_FILE_BREAK_REGEX = /(?=^diff --git)/gm;
var UNIFIED_DIFF_FILE_BREAK_REGEX = /(?=^---\s+\S)/gm;
var FILE_CONTEXT_BLOB = /(?=^@@ )/gm;
var HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?: (.*))?/m;
var SPLIT_WITH_NEWLINES = /(?<=\n)/;
var FILENAME_HEADER_REGEX = /^(---|\+\+\+)\s+([^\t\r\n]+)/;
var FILENAME_HEADER_REGEX_GIT = /^(---|\+\+\+)\s+[ab]\/([^\t\r\n]+)/;
var ALTERNATE_FILE_NAMES_GIT = /^diff --git (?:"a\/(.+?)"|a\/(.+?)) (?:"b\/(.+?)"|b\/(.+?))$/;
var INDEX_LINE_METADATA = /^index ([0-9a-f]+)\.\.([0-9a-f]+)(?: (\d+))?$/i;
var HEADER_PREFIX_SLOT_ID = "header-prefix";
var HEADER_METADATA_SLOT_ID = "header-metadata";
var CUSTOM_HEADER_SLOT_ID = "header-custom";
var DEFAULT_THEMES = {
  dark: "pierre-dark",
  light: "pierre-light"
};
var THEME_CSS_ATTRIBUTE = "data-theme-css";
var UNSAFE_CSS_ATTRIBUTE = "data-unsafe-css";
var DEFAULT_COLLAPSED_CONTEXT_THRESHOLD = 1;
var DEFAULT_VIRTUAL_FILE_METRICS = {
  hunkLineCount: 50,
  lineHeight: 20,
  diffHeaderHeight: 44,
  hunkSeparatorHeight: 32,
  fileGap: 8
};
var DEFAULT_EXPANDED_REGION = Object.freeze({
  fromStart: 0,
  fromEnd: 0
});
var DEFAULT_RENDER_RANGE = {
  startingLine: 0,
  totalLines: Infinity,
  bufferBefore: 0,
  bufferAfter: 0
};
var EMPTY_RENDER_RANGE = {
  startingLine: 0,
  totalLines: 0,
  bufferBefore: 0,
  bufferAfter: 0
};

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/getLineAnnotationName.js
function getLineAnnotationName(annotation) {
  return `annotation-${"side" in annotation ? `${annotation.side}-` : ""}${annotation.lineNumber}`;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/react/utils/renderFileChildren.js
function renderFileChildren({ file, renderCustomHeader, renderHeaderPrefix, renderHeaderMetadata, renderAnnotation, lineAnnotations, renderGutterUtility, renderHoverUtility, getHoveredLine }) {
  const gutterUtility = renderGutterUtility ?? renderHoverUtility;
  const customHeader = renderCustomHeader?.(file);
  const prefix = renderHeaderPrefix?.(file);
  const metadata = renderHeaderMetadata?.(file);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    customHeader != null ? /* @__PURE__ */ jsx("div", {
      slot: CUSTOM_HEADER_SLOT_ID,
      children: customHeader
    }) : /* @__PURE__ */ jsxs(Fragment, { children: [prefix != null && /* @__PURE__ */ jsx("div", {
      slot: HEADER_PREFIX_SLOT_ID,
      children: prefix
    }), metadata != null && /* @__PURE__ */ jsx("div", {
      slot: HEADER_METADATA_SLOT_ID,
      children: metadata
    })] }),
    renderAnnotation != null && lineAnnotations?.map((annotation, index) => /* @__PURE__ */ jsx("div", {
      slot: getLineAnnotationName(annotation),
      children: renderAnnotation(annotation)
    }, index)),
    gutterUtility != null && /* @__PURE__ */ jsx("div", {
      slot: "gutter-utility-slot",
      style: GutterUtilitySlotStyles,
      children: gutterUtility(getHoveredLine)
    })
  ] });
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/react/utils/templateRender.js
function templateRender(children, __html) {
  if (typeof window === "undefined" && __html != null) return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("template", {
    shadowrootmode: "open",
    dangerouslySetInnerHTML: { __html }
  }), children] });
  return /* @__PURE__ */ jsx(Fragment, { children });
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/managers/UniversalRenderingManager.js
var queuedCallbacks = /* @__PURE__ */ new Set();
var callbacks = /* @__PURE__ */ new Set();
var frameId = null;
var isRendering = false;
function queueRender(callback) {
  if (isRendering) {
    queuedCallbacks.add(callback);
    return;
  }
  callbacks.add(callback);
  frameId ??= requestAnimationFrame(render);
}
function render(time) {
  isRendering = true;
  for (const callback of callbacks) try {
    callback(time);
  } catch (error) {
    console.error(error);
  }
  callbacks.clear();
  if (queuedCallbacks.size > 0) {
    callbacks = new Set(queuedCallbacks);
    queuedCallbacks.clear();
    frameId = requestAnimationFrame(render);
  } else frameId = null;
  isRendering = false;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/areVirtualWindowSpecsEqual.js
function areVirtualWindowSpecsEqual(windowSpecsA, windowSpecsB) {
  if (windowSpecsA == null || windowSpecsB == null) return windowSpecsA === windowSpecsB;
  return windowSpecsA.top === windowSpecsB.top && windowSpecsA.bottom === windowSpecsB.bottom;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/createWindowFromScrollPosition.js
function createWindowFromScrollPosition({ scrollTop, scrollHeight, height, containerOffset = 0, fitPerfectly, overscrollSize }) {
  const windowHeight = height + overscrollSize * 2;
  const effectiveHeight = fitPerfectly ? height : windowHeight;
  scrollHeight = Math.max(scrollHeight, effectiveHeight);
  if (windowHeight >= scrollHeight || fitPerfectly) {
    const top$1 = Math.max(scrollTop - containerOffset, 0);
    const bottom$1 = Math.min(scrollTop + effectiveHeight, scrollHeight) - containerOffset;
    return {
      top: top$1,
      bottom: Math.max(bottom$1, top$1)
    };
  }
  let top = scrollTop + height / 2 - windowHeight / 2;
  let bottom = top + windowHeight;
  if (top < 0) top = 0;
  if (bottom > scrollHeight) bottom = scrollHeight;
  top = Math.floor(Math.max(top - containerOffset, 0));
  return {
    top,
    bottom: Math.ceil(Math.max(Math.min(bottom, scrollHeight) - containerOffset, top))
  };
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/components/Virtualizer.js
var DEFAULT_OVERSCROLL_SIZE = 1e3;
var INTERSECTION_OBSERVER_MARGIN = DEFAULT_OVERSCROLL_SIZE * 4;
var INTERSECTION_OBSERVER_THRESHOLD = [
  0,
  1e-6,
  0.99999,
  1
];
var DEFAULT_VIRTUALIZER_CONFIG = {
  overscrollSize: DEFAULT_OVERSCROLL_SIZE,
  intersectionObserverMargin: INTERSECTION_OBSERVER_MARGIN,
  resizeDebugging: false
};
var lastSize = 0;
var instance = -1;
var Virtualizer = class Virtualizer2 {
  static __STOP = false;
  static __lastScrollPosition = 0;
  __id = `virtualizer-${++instance}`;
  config;
  type = "basic";
  intersectionObserver;
  scrollTop = 0;
  height = 0;
  scrollHeight = 0;
  windowSpecs = {
    top: 0,
    bottom: 0
  };
  root;
  contentContainer;
  resizeObserver;
  observers = /* @__PURE__ */ new Map();
  visibleInstances = /* @__PURE__ */ new Map();
  visibleInstancesDirty = false;
  instancesChanged = /* @__PURE__ */ new Set();
  scrollDirty = true;
  heightDirty = true;
  scrollHeightDirty = true;
  renderedObservers = 0;
  connectQueue = /* @__PURE__ */ new Map();
  constructor(config) {
    this.config = {
      ...DEFAULT_VIRTUALIZER_CONFIG,
      ...config
    };
  }
  setup(root2, contentContainer) {
    if (this.root != null) return;
    this.root = root2;
    this.resizeObserver = new ResizeObserver(this.handleContainerResize);
    this.intersectionObserver = new IntersectionObserver(this.handleIntersectionChange, {
      root: this.root,
      threshold: INTERSECTION_OBSERVER_THRESHOLD,
      rootMargin: `${this.config.intersectionObserverMargin}px 0px ${this.config.intersectionObserverMargin}px 0px`
    });
    if (root2 instanceof Document) this.setupWindow();
    else this.setupElement(contentContainer);
    window.__INSTANCE = this;
    window.__TOGGLE = () => {
      if (Virtualizer2.__STOP) {
        Virtualizer2.__STOP = false;
        (this.getScrollContainerElement() ?? window).scrollTo({ top: Virtualizer2.__lastScrollPosition });
        queueRender(this.computeRenderRangeAndEmit);
      } else {
        Virtualizer2.__lastScrollPosition = this.getScrollTop();
        Virtualizer2.__STOP = true;
      }
    };
    for (const [container, instance$1] of this.connectQueue.entries()) this.connect(container, instance$1);
    this.connectQueue.clear();
    this.markDOMDirty();
    queueRender(this.computeRenderRangeAndEmit);
  }
  instanceChanged(instance$1) {
    this.instancesChanged.add(instance$1);
    this.markDOMDirty();
    queueRender(this.computeRenderRangeAndEmit);
  }
  getWindowSpecs() {
    if (this.windowSpecs.top === 0 && this.windowSpecs.bottom === 0) this.windowSpecs = createWindowFromScrollPosition({
      scrollTop: this.getScrollTop(),
      height: this.getHeight(),
      scrollHeight: this.getScrollHeight(),
      fitPerfectly: false,
      overscrollSize: this.config.overscrollSize
    });
    return this.windowSpecs;
  }
  isInstanceVisible(elementTop, elementHeight) {
    const scrollTop = this.getScrollTop();
    const height = this.getHeight();
    const margin = this.config.intersectionObserverMargin;
    const top = scrollTop - margin;
    const bottom = scrollTop + height + margin;
    return !(elementTop < top - elementHeight || elementTop > bottom);
  }
  handleContainerResize = (entries) => {
    if (this.root == null) return;
    let shouldQueueUpdate = false;
    for (const entry of entries) {
      const blockSize = entry.borderBoxSize[0].blockSize;
      if (this.root instanceof Document) {
        if (blockSize !== this.scrollHeight) {
          this.scrollHeightDirty = true;
          shouldQueueUpdate = true;
          if (this.config.resizeDebugging) {
            console.log("Virtualizer: content size change", this.__id, {
              sizeChange: blockSize - lastSize,
              newSize: blockSize
            });
            lastSize = blockSize;
          }
        }
      } else if (entry.target === this.root) {
        if (blockSize !== this.height) {
          this.heightDirty = true;
          shouldQueueUpdate = true;
        }
      } else if (entry.target === this.contentContainer) {
        this.scrollHeightDirty = true;
        shouldQueueUpdate = true;
        if (this.config.resizeDebugging) {
          console.log("Virtualizer: scroller size change", this.__id, {
            sizeChange: blockSize - lastSize,
            newSize: blockSize
          });
          lastSize = blockSize;
        }
      }
    }
    if (shouldQueueUpdate) queueRender(this.computeRenderRangeAndEmit);
  };
  setupWindow() {
    if (this.root == null || !(this.root instanceof Document)) throw new Error("Virtualizer.setupWindow: Invalid setup method");
    window.addEventListener("scroll", this.handleWindowScroll, { passive: true });
    window.addEventListener("resize", this.handleWindowResize, { passive: true });
    this.resizeObserver?.observe(this.root.documentElement);
  }
  setupElement(contentContainer) {
    if (this.root == null || this.root instanceof Document) throw new Error("Virtualizer.setupElement: Invalid setup method");
    this.root.addEventListener("scroll", this.handleElementScroll, { passive: true });
    this.resizeObserver?.observe(this.root);
    contentContainer ??= this.root.firstElementChild ?? void 0;
    if (contentContainer instanceof HTMLElement) {
      this.contentContainer = contentContainer;
      this.resizeObserver?.observe(contentContainer);
    }
  }
  cleanUp() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = void 0;
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = void 0;
    this.root?.removeEventListener("scroll", this.handleElementScroll);
    window.removeEventListener("scroll", this.handleWindowScroll);
    window.removeEventListener("resize", this.handleWindowResize);
    this.root = void 0;
    this.contentContainer = void 0;
    this.observers.clear();
    this.visibleInstances.clear();
    this.instancesChanged.clear();
    this.connectQueue.clear();
    this.visibleInstancesDirty = false;
    this.windowSpecs = {
      top: 0,
      bottom: 0
    };
    this.scrollTop = 0;
    this.height = 0;
    this.scrollHeight = 0;
  }
  getOffsetInScrollContainer(element2) {
    return this.getScrollTop() + getRelativeBoundingTop(element2, this.getScrollContainerElement());
  }
  connect(container, instance$1) {
    if (this.observers.has(container)) throw new Error("Virtualizer.connect: instance is already connected...");
    if (this.intersectionObserver == null) this.connectQueue.set(container, instance$1);
    else {
      this.intersectionObserver.observe(container);
      this.observers.set(container, instance$1);
      this.instancesChanged.add(instance$1);
      this.markDOMDirty();
      queueRender(this.computeRenderRangeAndEmit);
    }
    return () => this.disconnect(container);
  }
  disconnect(container) {
    const instance$1 = this.observers.get(container);
    this.connectQueue.delete(container);
    if (instance$1 == null) return;
    this.intersectionObserver?.unobserve(container);
    this.observers.delete(container);
    if (this.visibleInstances.delete(container)) this.visibleInstancesDirty = true;
    this.markDOMDirty();
    queueRender(this.computeRenderRangeAndEmit);
  }
  handleWindowResize = () => {
    if (Virtualizer2.__STOP || window.innerHeight === this.height) return;
    this.heightDirty = true;
    queueRender(this.computeRenderRangeAndEmit);
  };
  handleWindowScroll = () => {
    if (Virtualizer2.__STOP || this.root == null || !(this.root instanceof Document)) return;
    this.scrollDirty = true;
    queueRender(this.computeRenderRangeAndEmit);
  };
  handleElementScroll = () => {
    if (Virtualizer2.__STOP || this.root == null || this.root instanceof Document) return;
    this.scrollDirty = true;
    queueRender(this.computeRenderRangeAndEmit);
  };
  computeRenderRangeAndEmit = () => {
    if (Virtualizer2.__STOP) return;
    const wrapperDirty = this.heightDirty || this.scrollHeightDirty;
    if (!this.scrollDirty && !this.scrollHeightDirty && !this.heightDirty && this.renderedObservers === this.observers.size && !this.visibleInstancesDirty && this.instancesChanged.size === 0) return;
    if (this.instancesChanged.size === 0) {
      const windowSpecs = createWindowFromScrollPosition({
        scrollTop: this.getScrollTop(),
        height: this.getHeight(),
        scrollHeight: this.getScrollHeight(),
        fitPerfectly: false,
        overscrollSize: this.config.overscrollSize
      });
      if (areVirtualWindowSpecsEqual(this.windowSpecs, windowSpecs) && this.renderedObservers === this.observers.size && !this.visibleInstancesDirty && this.instancesChanged.size === 0) return;
      this.windowSpecs = windowSpecs;
    }
    this.visibleInstancesDirty = false;
    this.renderedObservers = this.observers.size;
    const anchor = this.getScrollAnchor(this.height);
    const updatedInstances = /* @__PURE__ */ new Set();
    for (const instance$1 of wrapperDirty ? this.observers.values() : this.visibleInstances.values()) if (instance$1.onRender(wrapperDirty)) updatedInstances.add(instance$1);
    for (const instance$1 of this.instancesChanged) {
      if (updatedInstances.has(instance$1)) continue;
      if (instance$1.onRender(wrapperDirty)) updatedInstances.add(instance$1);
    }
    this.scrollFix(anchor);
    if (this.instancesChanged.size > 0) this.markDOMDirty();
    for (const instance$1 of updatedInstances) instance$1.reconcileHeights();
    if (this.instancesChanged.size > 0 || wrapperDirty) queueRender(this.computeRenderRangeAndEmit);
    updatedInstances.clear();
    this.instancesChanged.clear();
  };
  scrollFix(anchor) {
    if (anchor == null) return;
    const scrollContainer = this.getScrollContainerElement();
    const { lineIndex, lineOffset, fileElement, fileOffset, fileTypeOffset } = anchor;
    if (lineIndex != null && lineOffset != null) {
      const element2 = fileElement.shadowRoot?.querySelector(`[data-line][data-line-index="${lineIndex}"]`);
      if (element2 instanceof HTMLElement) {
        const top$1 = getRelativeBoundingTop(element2, scrollContainer);
        if (top$1 !== lineOffset) {
          const scrollOffset = top$1 - lineOffset;
          this.applyScrollFix(scrollOffset);
        }
        return;
      }
    }
    const top = getRelativeBoundingTop(fileElement, scrollContainer);
    if (fileTypeOffset === "top") {
      if (top !== fileOffset) this.applyScrollFix(top - fileOffset);
    } else {
      const bottom = top + fileElement.getBoundingClientRect().height;
      if (bottom !== fileOffset) this.applyScrollFix(bottom - fileOffset);
    }
  }
  applyScrollFix(scrollOffset) {
    if (this.root == null || this.root instanceof Document) window.scrollTo({
      top: window.scrollY + scrollOffset,
      behavior: "instant"
    });
    else this.root.scrollTo({
      top: this.root.scrollTop + scrollOffset,
      behavior: "instant"
    });
    this.markDOMDirty();
  }
  getScrollAnchor(viewportHeight) {
    const scrollContainer = this.getScrollContainerElement();
    let bestAnchor;
    for (const [fileElement] of this.visibleInstances.entries()) {
      const fileTop = getRelativeBoundingTop(fileElement, scrollContainer);
      const fileBottom = fileTop + fileElement.offsetHeight;
      let fileOffset;
      let fileTypeOffset;
      if (fileBottom <= 0) {
        fileOffset = fileBottom;
        fileTypeOffset = "bottom";
      } else {
        fileOffset = fileTop;
        fileTypeOffset = "top";
      }
      let bestLineIndex;
      let bestLineOffset;
      if (fileBottom > 0 && fileTop < viewportHeight) for (const line of fileElement.shadowRoot?.querySelectorAll("[data-line][data-line-index]") ?? []) {
        if (!(line instanceof HTMLElement)) continue;
        const lineIndex = line.dataset.lineIndex;
        if (lineIndex == null) continue;
        const lineOffset = getRelativeBoundingTop(line, scrollContainer);
        if (lineOffset < 0) continue;
        bestLineIndex = lineIndex;
        bestLineOffset = lineOffset;
        break;
      }
      if (bestAnchor?.lineOffset != null && bestLineOffset == null) continue;
      let shouldReplace = false;
      if (bestAnchor == null) shouldReplace = true;
      else if (bestLineOffset != null && (bestAnchor.lineOffset == null || bestLineOffset < bestAnchor.lineOffset)) shouldReplace = true;
      else if (bestLineOffset == null && bestAnchor.lineOffset == null) {
        if (fileOffset >= 0 && (bestAnchor.fileOffset < 0 || fileOffset < bestAnchor.fileOffset)) shouldReplace = true;
        else if (fileOffset < 0 && bestAnchor.fileOffset < 0 && fileOffset > bestAnchor.fileOffset) shouldReplace = true;
      }
      if (shouldReplace) bestAnchor = {
        fileElement,
        fileTypeOffset,
        fileOffset,
        lineIndex: bestLineIndex,
        lineOffset: bestLineOffset
      };
    }
    return bestAnchor;
  }
  handleIntersectionChange = (entries) => {
    this.scrollDirty = true;
    for (const { target, isIntersecting } of entries) {
      if (!(target instanceof HTMLElement)) throw new Error("Virtualizer.handleIntersectionChange: target not an HTMLElement");
      const instance$1 = this.observers.get(target);
      if (instance$1 == null) throw new Error("Virtualizer.handleIntersectionChange: no instance for target");
      if (isIntersecting && !this.visibleInstances.has(target)) {
        instance$1.setVisibility(true);
        this.visibleInstances.set(target, instance$1);
        this.visibleInstancesDirty = true;
      } else if (!isIntersecting && this.visibleInstances.has(target)) {
        instance$1.setVisibility(false);
        this.visibleInstances.delete(target);
        this.visibleInstancesDirty = true;
      }
    }
    if (this.visibleInstancesDirty) queueRender(this.computeRenderRangeAndEmit);
  };
  getScrollTop() {
    if (!this.scrollDirty) return this.scrollTop;
    this.scrollDirty = false;
    let scrollTop = (() => {
      if (this.root == null) return 0;
      if (this.root instanceof Document) return window.scrollY;
      return this.root.scrollTop;
    })();
    scrollTop = Math.max(0, Math.min(scrollTop, this.getScrollHeight() - this.getHeight()));
    this.scrollTop = scrollTop;
    return scrollTop;
  }
  getScrollHeight() {
    if (!this.scrollHeightDirty) return this.scrollHeight;
    this.scrollHeightDirty = false;
    this.scrollHeight = (() => {
      if (this.root == null) return 0;
      if (this.root instanceof Document) return this.root.documentElement.scrollHeight;
      return this.root.scrollHeight;
    })();
    return this.scrollHeight;
  }
  getHeight() {
    if (!this.heightDirty) return this.height;
    this.heightDirty = false;
    this.height = (() => {
      if (this.root == null) return 0;
      if (this.root instanceof Document) return globalThis.innerHeight;
      return this.root.getBoundingClientRect().height;
    })();
    return this.height;
  }
  markDOMDirty() {
    this.scrollDirty = true;
    this.scrollHeightDirty = true;
    this.heightDirty = true;
  }
  getScrollContainerElement() {
    return this.root == null || this.root instanceof Document ? void 0 : this.root;
  }
};
function getRelativeBoundingTop(element2, scrollContainer) {
  const rect = element2.getBoundingClientRect();
  const scrollContainerTop = scrollContainer?.getBoundingClientRect().top ?? 0;
  return rect.top - scrollContainerTop;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/react/Virtualizer.js
init_neon_pilot_shared_react();
var VirtualizerContext = createContext(void 0);
function Virtualizer3({ children, config, className, style, contentClassName, contentStyle }) {
  const [instance2] = useState(() => {
    return typeof window !== "undefined" ? new Virtualizer(config) : void 0;
  });
  const ref = useCallback((node) => {
    if (node != null) instance2?.setup(node);
    else instance2?.cleanUp();
  }, [instance2]);
  return /* @__PURE__ */ jsx(VirtualizerContext.Provider, {
    value: instance2,
    children: /* @__PURE__ */ jsx("div", {
      className,
      style,
      ref,
      children: /* @__PURE__ */ jsx("div", {
        className: contentClassName,
        style: contentStyle,
        children
      })
    })
  });
}
function useVirtualizer() {
  return useContext(VirtualizerContext);
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/highlighter/themes/constants.js
var ResolvedThemes = /* @__PURE__ */ new Map();
var ResolvingThemes = /* @__PURE__ */ new Map();
var RegisteredCustomThemes = /* @__PURE__ */ new Map();
var AttachedThemes = /* @__PURE__ */ new Set();

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/highlighter/themes/attachResolvedThemes.js
function attachResolvedThemes(themes, highlighter2) {
  themes = Array.isArray(themes) ? themes : [themes];
  for (let themeRef of themes) {
    let resolvedTheme;
    if (typeof themeRef === "string") {
      resolvedTheme = ResolvedThemes.get(themeRef);
      if (resolvedTheme == null) throw new Error(`loadResolvedThemes: ${themeRef} is not resolved, you must resolve it before calling loadResolvedThemes`);
    } else {
      resolvedTheme = themeRef;
      themeRef = themeRef.name;
      if (!ResolvedThemes.has(themeRef)) ResolvedThemes.set(themeRef, resolvedTheme);
    }
    if (AttachedThemes.has(themeRef)) continue;
    AttachedThemes.add(themeRef);
    highlighter2.loadThemeSync(resolvedTheme);
  }
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/highlighter/languages/constants.js
var ResolvedLanguages = /* @__PURE__ */ new Map();
var ResolvingLanguages = /* @__PURE__ */ new Map();
var RegisteredCustomLanguages = /* @__PURE__ */ new Map();
var AttachedLanguages = /* @__PURE__ */ new Set();

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/highlighter/languages/attachResolvedLanguages.js
function attachResolvedLanguages(resolvedLanguages, highlighter2) {
  resolvedLanguages = Array.isArray(resolvedLanguages) ? resolvedLanguages : [resolvedLanguages];
  for (const resolvedLang of resolvedLanguages) {
    if (AttachedLanguages.has(resolvedLang.name)) continue;
    let lang = ResolvedLanguages.get(resolvedLang.name);
    if (lang == null) {
      lang = resolvedLang;
      ResolvedLanguages.set(resolvedLang.name, lang);
    }
    AttachedLanguages.add(lang.name);
    highlighter2.loadLanguageSync(lang.data);
  }
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/isWorkerContext.js
function isWorkerContext() {
  return typeof WorkerGlobalScope !== "undefined" && typeof self !== "undefined" && self instanceof WorkerGlobalScope;
}

// node_modules/.pnpm/@shikijs+types@3.23.0/node_modules/@shikijs/types/dist/index.mjs
var ShikiError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ShikiError";
  }
};

// node_modules/.pnpm/@shikijs+vscode-textmate@10.0.2/node_modules/@shikijs/vscode-textmate/dist/index.js
function clone(something) {
  return doClone(something);
}
function doClone(something) {
  if (Array.isArray(something)) {
    return cloneArray(something);
  }
  if (something instanceof RegExp) {
    return something;
  }
  if (typeof something === "object") {
    return cloneObj(something);
  }
  return something;
}
function cloneArray(arr) {
  let r4 = [];
  for (let i2 = 0, len = arr.length; i2 < len; i2++) {
    r4[i2] = doClone(arr[i2]);
  }
  return r4;
}
function cloneObj(obj) {
  let r4 = {};
  for (let key2 in obj) {
    r4[key2] = doClone(obj[key2]);
  }
  return r4;
}
function mergeObjects(target, ...sources) {
  sources.forEach((source) => {
    for (let key2 in source) {
      target[key2] = source[key2];
    }
  });
  return target;
}
function basename(path) {
  const idx = ~path.lastIndexOf("/") || ~path.lastIndexOf("\\");
  if (idx === 0) {
    return path;
  } else if (~idx === path.length - 1) {
    return basename(path.substring(0, path.length - 1));
  } else {
    return path.substr(~idx + 1);
  }
}
var CAPTURING_REGEX_SOURCE = /\$(\d+)|\${(\d+):\/(downcase|upcase)}/g;
var RegexSource = class {
  static hasCaptures(regexSource) {
    if (regexSource === null) {
      return false;
    }
    CAPTURING_REGEX_SOURCE.lastIndex = 0;
    return CAPTURING_REGEX_SOURCE.test(regexSource);
  }
  static replaceCaptures(regexSource, captureSource, captureIndices) {
    return regexSource.replace(CAPTURING_REGEX_SOURCE, (match, index, commandIndex, command) => {
      let capture = captureIndices[parseInt(index || commandIndex, 10)];
      if (capture) {
        let result = captureSource.substring(capture.start, capture.end);
        while (result[0] === ".") {
          result = result.substring(1);
        }
        switch (command) {
          case "downcase":
            return result.toLowerCase();
          case "upcase":
            return result.toUpperCase();
          default:
            return result;
        }
      } else {
        return match;
      }
    });
  }
};
function strcmp(a2, b3) {
  if (a2 < b3) {
    return -1;
  }
  if (a2 > b3) {
    return 1;
  }
  return 0;
}
function strArrCmp(a2, b3) {
  if (a2 === null && b3 === null) {
    return 0;
  }
  if (!a2) {
    return -1;
  }
  if (!b3) {
    return 1;
  }
  let len1 = a2.length;
  let len2 = b3.length;
  if (len1 === len2) {
    for (let i2 = 0; i2 < len1; i2++) {
      let res = strcmp(a2[i2], b3[i2]);
      if (res !== 0) {
        return res;
      }
    }
    return 0;
  }
  return len1 - len2;
}
function isValidHexColor(hex) {
  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    return true;
  }
  if (/^#[0-9a-f]{8}$/i.test(hex)) {
    return true;
  }
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    return true;
  }
  if (/^#[0-9a-f]{4}$/i.test(hex)) {
    return true;
  }
  return false;
}
function escapeRegExpCharacters(value) {
  return value.replace(/[\-\\\{\}\*\+\?\|\^\$\.\,\[\]\(\)\#\s]/g, "\\$&");
}
var CachedFn = class {
  constructor(fn) {
    this.fn = fn;
  }
  cache = /* @__PURE__ */ new Map();
  get(key2) {
    if (this.cache.has(key2)) {
      return this.cache.get(key2);
    }
    const value = this.fn(key2);
    this.cache.set(key2, value);
    return value;
  }
};
var Theme = class {
  constructor(_colorMap, _defaults, _root) {
    this._colorMap = _colorMap;
    this._defaults = _defaults;
    this._root = _root;
  }
  static createFromRawTheme(source, colorMap) {
    return this.createFromParsedTheme(parseTheme(source), colorMap);
  }
  static createFromParsedTheme(source, colorMap) {
    return resolveParsedThemeRules(source, colorMap);
  }
  _cachedMatchRoot = new CachedFn(
    (scopeName) => this._root.match(scopeName)
  );
  getColorMap() {
    return this._colorMap.getColorMap();
  }
  getDefaults() {
    return this._defaults;
  }
  match(scopePath) {
    if (scopePath === null) {
      return this._defaults;
    }
    const scopeName = scopePath.scopeName;
    const matchingTrieElements = this._cachedMatchRoot.get(scopeName);
    const effectiveRule = matchingTrieElements.find(
      (v2) => _scopePathMatchesParentScopes(scopePath.parent, v2.parentScopes)
    );
    if (!effectiveRule) {
      return null;
    }
    return new StyleAttributes(
      effectiveRule.fontStyle,
      effectiveRule.foreground,
      effectiveRule.background
    );
  }
};
var ScopeStack = class _ScopeStack {
  constructor(parent, scopeName) {
    this.parent = parent;
    this.scopeName = scopeName;
  }
  static push(path, scopeNames) {
    for (const name of scopeNames) {
      path = new _ScopeStack(path, name);
    }
    return path;
  }
  static from(...segments) {
    let result = null;
    for (let i2 = 0; i2 < segments.length; i2++) {
      result = new _ScopeStack(result, segments[i2]);
    }
    return result;
  }
  push(scopeName) {
    return new _ScopeStack(this, scopeName);
  }
  getSegments() {
    let item = this;
    const result = [];
    while (item) {
      result.push(item.scopeName);
      item = item.parent;
    }
    result.reverse();
    return result;
  }
  toString() {
    return this.getSegments().join(" ");
  }
  extends(other) {
    if (this === other) {
      return true;
    }
    if (this.parent === null) {
      return false;
    }
    return this.parent.extends(other);
  }
  getExtensionIfDefined(base) {
    const result = [];
    let item = this;
    while (item && item !== base) {
      result.push(item.scopeName);
      item = item.parent;
    }
    return item === base ? result.reverse() : void 0;
  }
};
function _scopePathMatchesParentScopes(scopePath, parentScopes) {
  if (parentScopes.length === 0) {
    return true;
  }
  for (let index = 0; index < parentScopes.length; index++) {
    let scopePattern = parentScopes[index];
    let scopeMustMatch = false;
    if (scopePattern === ">") {
      if (index === parentScopes.length - 1) {
        return false;
      }
      scopePattern = parentScopes[++index];
      scopeMustMatch = true;
    }
    while (scopePath) {
      if (_matchesScope(scopePath.scopeName, scopePattern)) {
        break;
      }
      if (scopeMustMatch) {
        return false;
      }
      scopePath = scopePath.parent;
    }
    if (!scopePath) {
      return false;
    }
    scopePath = scopePath.parent;
  }
  return true;
}
function _matchesScope(scopeName, scopePattern) {
  return scopePattern === scopeName || scopeName.startsWith(scopePattern) && scopeName[scopePattern.length] === ".";
}
var StyleAttributes = class {
  constructor(fontStyle, foregroundId, backgroundId) {
    this.fontStyle = fontStyle;
    this.foregroundId = foregroundId;
    this.backgroundId = backgroundId;
  }
};
function parseTheme(source) {
  if (!source) {
    return [];
  }
  if (!source.settings || !Array.isArray(source.settings)) {
    return [];
  }
  let settings = source.settings;
  let result = [], resultLen = 0;
  for (let i2 = 0, len = settings.length; i2 < len; i2++) {
    let entry = settings[i2];
    if (!entry.settings) {
      continue;
    }
    let scopes;
    if (typeof entry.scope === "string") {
      let _scope = entry.scope;
      _scope = _scope.replace(/^[,]+/, "");
      _scope = _scope.replace(/[,]+$/, "");
      scopes = _scope.split(",");
    } else if (Array.isArray(entry.scope)) {
      scopes = entry.scope;
    } else {
      scopes = [""];
    }
    let fontStyle = -1;
    if (typeof entry.settings.fontStyle === "string") {
      fontStyle = 0;
      let segments = entry.settings.fontStyle.split(" ");
      for (let j2 = 0, lenJ = segments.length; j2 < lenJ; j2++) {
        let segment = segments[j2];
        switch (segment) {
          case "italic":
            fontStyle = fontStyle | 1;
            break;
          case "bold":
            fontStyle = fontStyle | 2;
            break;
          case "underline":
            fontStyle = fontStyle | 4;
            break;
          case "strikethrough":
            fontStyle = fontStyle | 8;
            break;
        }
      }
    }
    let foreground = null;
    if (typeof entry.settings.foreground === "string" && isValidHexColor(entry.settings.foreground)) {
      foreground = entry.settings.foreground;
    }
    let background = null;
    if (typeof entry.settings.background === "string" && isValidHexColor(entry.settings.background)) {
      background = entry.settings.background;
    }
    for (let j2 = 0, lenJ = scopes.length; j2 < lenJ; j2++) {
      let _scope = scopes[j2].trim();
      let segments = _scope.split(" ");
      let scope = segments[segments.length - 1];
      let parentScopes = null;
      if (segments.length > 1) {
        parentScopes = segments.slice(0, segments.length - 1);
        parentScopes.reverse();
      }
      result[resultLen++] = new ParsedThemeRule(
        scope,
        parentScopes,
        i2,
        fontStyle,
        foreground,
        background
      );
    }
  }
  return result;
}
var ParsedThemeRule = class {
  constructor(scope, parentScopes, index, fontStyle, foreground, background) {
    this.scope = scope;
    this.parentScopes = parentScopes;
    this.index = index;
    this.fontStyle = fontStyle;
    this.foreground = foreground;
    this.background = background;
  }
};
var FontStyle = /* @__PURE__ */ ((FontStyle2) => {
  FontStyle2[FontStyle2["NotSet"] = -1] = "NotSet";
  FontStyle2[FontStyle2["None"] = 0] = "None";
  FontStyle2[FontStyle2["Italic"] = 1] = "Italic";
  FontStyle2[FontStyle2["Bold"] = 2] = "Bold";
  FontStyle2[FontStyle2["Underline"] = 4] = "Underline";
  FontStyle2[FontStyle2["Strikethrough"] = 8] = "Strikethrough";
  return FontStyle2;
})(FontStyle || {});
function resolveParsedThemeRules(parsedThemeRules, _colorMap) {
  parsedThemeRules.sort((a2, b3) => {
    let r4 = strcmp(a2.scope, b3.scope);
    if (r4 !== 0) {
      return r4;
    }
    r4 = strArrCmp(a2.parentScopes, b3.parentScopes);
    if (r4 !== 0) {
      return r4;
    }
    return a2.index - b3.index;
  });
  let defaultFontStyle = 0;
  let defaultForeground = "#000000";
  let defaultBackground = "#ffffff";
  while (parsedThemeRules.length >= 1 && parsedThemeRules[0].scope === "") {
    let incomingDefaults = parsedThemeRules.shift();
    if (incomingDefaults.fontStyle !== -1) {
      defaultFontStyle = incomingDefaults.fontStyle;
    }
    if (incomingDefaults.foreground !== null) {
      defaultForeground = incomingDefaults.foreground;
    }
    if (incomingDefaults.background !== null) {
      defaultBackground = incomingDefaults.background;
    }
  }
  let colorMap = new ColorMap(_colorMap);
  let defaults = new StyleAttributes(defaultFontStyle, colorMap.getId(defaultForeground), colorMap.getId(defaultBackground));
  let root2 = new ThemeTrieElement(new ThemeTrieElementRule(0, null, -1, 0, 0), []);
  for (let i2 = 0, len = parsedThemeRules.length; i2 < len; i2++) {
    let rule = parsedThemeRules[i2];
    root2.insert(0, rule.scope, rule.parentScopes, rule.fontStyle, colorMap.getId(rule.foreground), colorMap.getId(rule.background));
  }
  return new Theme(colorMap, defaults, root2);
}
var ColorMap = class {
  _isFrozen;
  _lastColorId;
  _id2color;
  _color2id;
  constructor(_colorMap) {
    this._lastColorId = 0;
    this._id2color = [];
    this._color2id = /* @__PURE__ */ Object.create(null);
    if (Array.isArray(_colorMap)) {
      this._isFrozen = true;
      for (let i2 = 0, len = _colorMap.length; i2 < len; i2++) {
        this._color2id[_colorMap[i2]] = i2;
        this._id2color[i2] = _colorMap[i2];
      }
    } else {
      this._isFrozen = false;
    }
  }
  getId(color) {
    if (color === null) {
      return 0;
    }
    color = color.toUpperCase();
    let value = this._color2id[color];
    if (value) {
      return value;
    }
    if (this._isFrozen) {
      throw new Error(`Missing color in color map - ${color}`);
    }
    value = ++this._lastColorId;
    this._color2id[color] = value;
    this._id2color[value] = color;
    return value;
  }
  getColorMap() {
    return this._id2color.slice(0);
  }
};
var emptyParentScopes = Object.freeze([]);
var ThemeTrieElementRule = class _ThemeTrieElementRule {
  scopeDepth;
  parentScopes;
  fontStyle;
  foreground;
  background;
  constructor(scopeDepth, parentScopes, fontStyle, foreground, background) {
    this.scopeDepth = scopeDepth;
    this.parentScopes = parentScopes || emptyParentScopes;
    this.fontStyle = fontStyle;
    this.foreground = foreground;
    this.background = background;
  }
  clone() {
    return new _ThemeTrieElementRule(this.scopeDepth, this.parentScopes, this.fontStyle, this.foreground, this.background);
  }
  static cloneArr(arr) {
    let r4 = [];
    for (let i2 = 0, len = arr.length; i2 < len; i2++) {
      r4[i2] = arr[i2].clone();
    }
    return r4;
  }
  acceptOverwrite(scopeDepth, fontStyle, foreground, background) {
    if (this.scopeDepth > scopeDepth) {
      console.log("how did this happen?");
    } else {
      this.scopeDepth = scopeDepth;
    }
    if (fontStyle !== -1) {
      this.fontStyle = fontStyle;
    }
    if (foreground !== 0) {
      this.foreground = foreground;
    }
    if (background !== 0) {
      this.background = background;
    }
  }
};
var ThemeTrieElement = class _ThemeTrieElement {
  constructor(_mainRule, rulesWithParentScopes = [], _children = {}) {
    this._mainRule = _mainRule;
    this._children = _children;
    this._rulesWithParentScopes = rulesWithParentScopes;
  }
  _rulesWithParentScopes;
  static _cmpBySpecificity(a2, b3) {
    if (a2.scopeDepth !== b3.scopeDepth) {
      return b3.scopeDepth - a2.scopeDepth;
    }
    let aParentIndex = 0;
    let bParentIndex = 0;
    while (true) {
      if (a2.parentScopes[aParentIndex] === ">") {
        aParentIndex++;
      }
      if (b3.parentScopes[bParentIndex] === ">") {
        bParentIndex++;
      }
      if (aParentIndex >= a2.parentScopes.length || bParentIndex >= b3.parentScopes.length) {
        break;
      }
      const parentScopeLengthDiff = b3.parentScopes[bParentIndex].length - a2.parentScopes[aParentIndex].length;
      if (parentScopeLengthDiff !== 0) {
        return parentScopeLengthDiff;
      }
      aParentIndex++;
      bParentIndex++;
    }
    return b3.parentScopes.length - a2.parentScopes.length;
  }
  match(scope) {
    if (scope !== "") {
      let dotIndex = scope.indexOf(".");
      let head2;
      let tail;
      if (dotIndex === -1) {
        head2 = scope;
        tail = "";
      } else {
        head2 = scope.substring(0, dotIndex);
        tail = scope.substring(dotIndex + 1);
      }
      if (this._children.hasOwnProperty(head2)) {
        return this._children[head2].match(tail);
      }
    }
    const rules = this._rulesWithParentScopes.concat(this._mainRule);
    rules.sort(_ThemeTrieElement._cmpBySpecificity);
    return rules;
  }
  insert(scopeDepth, scope, parentScopes, fontStyle, foreground, background) {
    if (scope === "") {
      this._doInsertHere(scopeDepth, parentScopes, fontStyle, foreground, background);
      return;
    }
    let dotIndex = scope.indexOf(".");
    let head2;
    let tail;
    if (dotIndex === -1) {
      head2 = scope;
      tail = "";
    } else {
      head2 = scope.substring(0, dotIndex);
      tail = scope.substring(dotIndex + 1);
    }
    let child;
    if (this._children.hasOwnProperty(head2)) {
      child = this._children[head2];
    } else {
      child = new _ThemeTrieElement(this._mainRule.clone(), ThemeTrieElementRule.cloneArr(this._rulesWithParentScopes));
      this._children[head2] = child;
    }
    child.insert(scopeDepth + 1, tail, parentScopes, fontStyle, foreground, background);
  }
  _doInsertHere(scopeDepth, parentScopes, fontStyle, foreground, background) {
    if (parentScopes === null) {
      this._mainRule.acceptOverwrite(scopeDepth, fontStyle, foreground, background);
      return;
    }
    for (let i2 = 0, len = this._rulesWithParentScopes.length; i2 < len; i2++) {
      let rule = this._rulesWithParentScopes[i2];
      if (strArrCmp(rule.parentScopes, parentScopes) === 0) {
        rule.acceptOverwrite(scopeDepth, fontStyle, foreground, background);
        return;
      }
    }
    if (fontStyle === -1) {
      fontStyle = this._mainRule.fontStyle;
    }
    if (foreground === 0) {
      foreground = this._mainRule.foreground;
    }
    if (background === 0) {
      background = this._mainRule.background;
    }
    this._rulesWithParentScopes.push(new ThemeTrieElementRule(scopeDepth, parentScopes, fontStyle, foreground, background));
  }
};
var EncodedTokenMetadata = class _EncodedTokenMetadata {
  static toBinaryStr(encodedTokenAttributes) {
    return encodedTokenAttributes.toString(2).padStart(32, "0");
  }
  static print(encodedTokenAttributes) {
    const languageId = _EncodedTokenMetadata.getLanguageId(encodedTokenAttributes);
    const tokenType = _EncodedTokenMetadata.getTokenType(encodedTokenAttributes);
    const fontStyle = _EncodedTokenMetadata.getFontStyle(encodedTokenAttributes);
    const foreground = _EncodedTokenMetadata.getForeground(encodedTokenAttributes);
    const background = _EncodedTokenMetadata.getBackground(encodedTokenAttributes);
    console.log({
      languageId,
      tokenType,
      fontStyle,
      foreground,
      background
    });
  }
  static getLanguageId(encodedTokenAttributes) {
    return (encodedTokenAttributes & 255) >>> 0;
  }
  static getTokenType(encodedTokenAttributes) {
    return (encodedTokenAttributes & 768) >>> 8;
  }
  static containsBalancedBrackets(encodedTokenAttributes) {
    return (encodedTokenAttributes & 1024) !== 0;
  }
  static getFontStyle(encodedTokenAttributes) {
    return (encodedTokenAttributes & 30720) >>> 11;
  }
  static getForeground(encodedTokenAttributes) {
    return (encodedTokenAttributes & 16744448) >>> 15;
  }
  static getBackground(encodedTokenAttributes) {
    return (encodedTokenAttributes & 4278190080) >>> 24;
  }
  /**
   * Updates the fields in `metadata`.
   * A value of `0`, `NotSet` or `null` indicates that the corresponding field should be left as is.
   */
  static set(encodedTokenAttributes, languageId, tokenType, containsBalancedBrackets, fontStyle, foreground, background) {
    let _languageId = _EncodedTokenMetadata.getLanguageId(encodedTokenAttributes);
    let _tokenType = _EncodedTokenMetadata.getTokenType(encodedTokenAttributes);
    let _containsBalancedBracketsBit = _EncodedTokenMetadata.containsBalancedBrackets(encodedTokenAttributes) ? 1 : 0;
    let _fontStyle = _EncodedTokenMetadata.getFontStyle(encodedTokenAttributes);
    let _foreground = _EncodedTokenMetadata.getForeground(encodedTokenAttributes);
    let _background = _EncodedTokenMetadata.getBackground(encodedTokenAttributes);
    if (languageId !== 0) {
      _languageId = languageId;
    }
    if (tokenType !== 8) {
      _tokenType = fromOptionalTokenType(tokenType);
    }
    if (containsBalancedBrackets !== null) {
      _containsBalancedBracketsBit = containsBalancedBrackets ? 1 : 0;
    }
    if (fontStyle !== -1) {
      _fontStyle = fontStyle;
    }
    if (foreground !== 0) {
      _foreground = foreground;
    }
    if (background !== 0) {
      _background = background;
    }
    return (_languageId << 0 | _tokenType << 8 | _containsBalancedBracketsBit << 10 | _fontStyle << 11 | _foreground << 15 | _background << 24) >>> 0;
  }
};
function toOptionalTokenType(standardType) {
  return standardType;
}
function fromOptionalTokenType(standardType) {
  return standardType;
}
function createMatchers(selector, matchesName) {
  const results = [];
  const tokenizer = newTokenizer(selector);
  let token2 = tokenizer.next();
  while (token2 !== null) {
    let priority = 0;
    if (token2.length === 2 && token2.charAt(1) === ":") {
      switch (token2.charAt(0)) {
        case "R":
          priority = 1;
          break;
        case "L":
          priority = -1;
          break;
        default:
          console.log(`Unknown priority ${token2} in scope selector`);
      }
      token2 = tokenizer.next();
    }
    let matcher = parseConjunction();
    results.push({ matcher, priority });
    if (token2 !== ",") {
      break;
    }
    token2 = tokenizer.next();
  }
  return results;
  function parseOperand() {
    if (token2 === "-") {
      token2 = tokenizer.next();
      const expressionToNegate = parseOperand();
      return (matcherInput) => !!expressionToNegate && !expressionToNegate(matcherInput);
    }
    if (token2 === "(") {
      token2 = tokenizer.next();
      const expressionInParents = parseInnerExpression();
      if (token2 === ")") {
        token2 = tokenizer.next();
      }
      return expressionInParents;
    }
    if (isIdentifier(token2)) {
      const identifiers = [];
      do {
        identifiers.push(token2);
        token2 = tokenizer.next();
      } while (isIdentifier(token2));
      return (matcherInput) => matchesName(identifiers, matcherInput);
    }
    return null;
  }
  function parseConjunction() {
    const matchers = [];
    let matcher = parseOperand();
    while (matcher) {
      matchers.push(matcher);
      matcher = parseOperand();
    }
    return (matcherInput) => matchers.every((matcher2) => matcher2(matcherInput));
  }
  function parseInnerExpression() {
    const matchers = [];
    let matcher = parseConjunction();
    while (matcher) {
      matchers.push(matcher);
      if (token2 === "|" || token2 === ",") {
        do {
          token2 = tokenizer.next();
        } while (token2 === "|" || token2 === ",");
      } else {
        break;
      }
      matcher = parseConjunction();
    }
    return (matcherInput) => matchers.some((matcher2) => matcher2(matcherInput));
  }
}
function isIdentifier(token2) {
  return !!token2 && !!token2.match(/[\w\.:]+/);
}
function newTokenizer(input) {
  let regex = /([LR]:|[\w\.:][\w\.:\-]*|[\,\|\-\(\)])/g;
  let match = regex.exec(input);
  return {
    next: () => {
      if (!match) {
        return null;
      }
      const res = match[0];
      match = regex.exec(input);
      return res;
    }
  };
}
function disposeOnigString(str) {
  if (typeof str.dispose === "function") {
    str.dispose();
  }
}
var TopLevelRuleReference = class {
  constructor(scopeName) {
    this.scopeName = scopeName;
  }
  toKey() {
    return this.scopeName;
  }
};
var TopLevelRepositoryRuleReference = class {
  constructor(scopeName, ruleName) {
    this.scopeName = scopeName;
    this.ruleName = ruleName;
  }
  toKey() {
    return `${this.scopeName}#${this.ruleName}`;
  }
};
var ExternalReferenceCollector = class {
  _references = [];
  _seenReferenceKeys = /* @__PURE__ */ new Set();
  get references() {
    return this._references;
  }
  visitedRule = /* @__PURE__ */ new Set();
  add(reference) {
    const key2 = reference.toKey();
    if (this._seenReferenceKeys.has(key2)) {
      return;
    }
    this._seenReferenceKeys.add(key2);
    this._references.push(reference);
  }
};
var ScopeDependencyProcessor = class {
  constructor(repo, initialScopeName) {
    this.repo = repo;
    this.initialScopeName = initialScopeName;
    this.seenFullScopeRequests.add(this.initialScopeName);
    this.Q = [new TopLevelRuleReference(this.initialScopeName)];
  }
  seenFullScopeRequests = /* @__PURE__ */ new Set();
  seenPartialScopeRequests = /* @__PURE__ */ new Set();
  Q;
  processQueue() {
    const q2 = this.Q;
    this.Q = [];
    const deps = new ExternalReferenceCollector();
    for (const dep of q2) {
      collectReferencesOfReference(dep, this.initialScopeName, this.repo, deps);
    }
    for (const dep of deps.references) {
      if (dep instanceof TopLevelRuleReference) {
        if (this.seenFullScopeRequests.has(dep.scopeName)) {
          continue;
        }
        this.seenFullScopeRequests.add(dep.scopeName);
        this.Q.push(dep);
      } else {
        if (this.seenFullScopeRequests.has(dep.scopeName)) {
          continue;
        }
        if (this.seenPartialScopeRequests.has(dep.toKey())) {
          continue;
        }
        this.seenPartialScopeRequests.add(dep.toKey());
        this.Q.push(dep);
      }
    }
  }
};
function collectReferencesOfReference(reference, baseGrammarScopeName, repo, result) {
  const selfGrammar = repo.lookup(reference.scopeName);
  if (!selfGrammar) {
    if (reference.scopeName === baseGrammarScopeName) {
      throw new Error(`No grammar provided for <${baseGrammarScopeName}>`);
    }
    return;
  }
  const baseGrammar = repo.lookup(baseGrammarScopeName);
  if (reference instanceof TopLevelRuleReference) {
    collectExternalReferencesInTopLevelRule({ baseGrammar, selfGrammar }, result);
  } else {
    collectExternalReferencesInTopLevelRepositoryRule(
      reference.ruleName,
      { baseGrammar, selfGrammar, repository: selfGrammar.repository },
      result
    );
  }
  const injections = repo.injections(reference.scopeName);
  if (injections) {
    for (const injection of injections) {
      result.add(new TopLevelRuleReference(injection));
    }
  }
}
function collectExternalReferencesInTopLevelRepositoryRule(ruleName, context, result) {
  if (context.repository && context.repository[ruleName]) {
    const rule = context.repository[ruleName];
    collectExternalReferencesInRules([rule], context, result);
  }
}
function collectExternalReferencesInTopLevelRule(context, result) {
  if (context.selfGrammar.patterns && Array.isArray(context.selfGrammar.patterns)) {
    collectExternalReferencesInRules(
      context.selfGrammar.patterns,
      { ...context, repository: context.selfGrammar.repository },
      result
    );
  }
  if (context.selfGrammar.injections) {
    collectExternalReferencesInRules(
      Object.values(context.selfGrammar.injections),
      { ...context, repository: context.selfGrammar.repository },
      result
    );
  }
}
function collectExternalReferencesInRules(rules, context, result) {
  for (const rule of rules) {
    if (result.visitedRule.has(rule)) {
      continue;
    }
    result.visitedRule.add(rule);
    const patternRepository = rule.repository ? mergeObjects({}, context.repository, rule.repository) : context.repository;
    if (Array.isArray(rule.patterns)) {
      collectExternalReferencesInRules(rule.patterns, { ...context, repository: patternRepository }, result);
    }
    const include = rule.include;
    if (!include) {
      continue;
    }
    const reference = parseInclude(include);
    switch (reference.kind) {
      case 0:
        collectExternalReferencesInTopLevelRule({ ...context, selfGrammar: context.baseGrammar }, result);
        break;
      case 1:
        collectExternalReferencesInTopLevelRule(context, result);
        break;
      case 2:
        collectExternalReferencesInTopLevelRepositoryRule(reference.ruleName, { ...context, repository: patternRepository }, result);
        break;
      case 3:
      case 4:
        const selfGrammar = reference.scopeName === context.selfGrammar.scopeName ? context.selfGrammar : reference.scopeName === context.baseGrammar.scopeName ? context.baseGrammar : void 0;
        if (selfGrammar) {
          const newContext = { baseGrammar: context.baseGrammar, selfGrammar, repository: patternRepository };
          if (reference.kind === 4) {
            collectExternalReferencesInTopLevelRepositoryRule(reference.ruleName, newContext, result);
          } else {
            collectExternalReferencesInTopLevelRule(newContext, result);
          }
        } else {
          if (reference.kind === 4) {
            result.add(new TopLevelRepositoryRuleReference(reference.scopeName, reference.ruleName));
          } else {
            result.add(new TopLevelRuleReference(reference.scopeName));
          }
        }
        break;
    }
  }
}
var BaseReference = class {
  kind = 0;
};
var SelfReference = class {
  kind = 1;
};
var RelativeReference = class {
  constructor(ruleName) {
    this.ruleName = ruleName;
  }
  kind = 2;
};
var TopLevelReference = class {
  constructor(scopeName) {
    this.scopeName = scopeName;
  }
  kind = 3;
};
var TopLevelRepositoryReference = class {
  constructor(scopeName, ruleName) {
    this.scopeName = scopeName;
    this.ruleName = ruleName;
  }
  kind = 4;
};
function parseInclude(include) {
  if (include === "$base") {
    return new BaseReference();
  } else if (include === "$self") {
    return new SelfReference();
  }
  const indexOfSharp = include.indexOf("#");
  if (indexOfSharp === -1) {
    return new TopLevelReference(include);
  } else if (indexOfSharp === 0) {
    return new RelativeReference(include.substring(1));
  } else {
    const scopeName = include.substring(0, indexOfSharp);
    const ruleName = include.substring(indexOfSharp + 1);
    return new TopLevelRepositoryReference(scopeName, ruleName);
  }
}
var HAS_BACK_REFERENCES = /\\(\d+)/;
var BACK_REFERENCING_END = /\\(\d+)/g;
var ruleIdSymbol = Symbol("RuleId");
var endRuleId = -1;
var whileRuleId = -2;
function ruleIdFromNumber(id) {
  return id;
}
function ruleIdToNumber(id) {
  return id;
}
var Rule = class {
  $location;
  id;
  _nameIsCapturing;
  _name;
  _contentNameIsCapturing;
  _contentName;
  constructor($location, id, name, contentName) {
    this.$location = $location;
    this.id = id;
    this._name = name || null;
    this._nameIsCapturing = RegexSource.hasCaptures(this._name);
    this._contentName = contentName || null;
    this._contentNameIsCapturing = RegexSource.hasCaptures(this._contentName);
  }
  get debugName() {
    const location = this.$location ? `${basename(this.$location.filename)}:${this.$location.line}` : "unknown";
    return `${this.constructor.name}#${this.id} @ ${location}`;
  }
  getName(lineText, captureIndices) {
    if (!this._nameIsCapturing || this._name === null || lineText === null || captureIndices === null) {
      return this._name;
    }
    return RegexSource.replaceCaptures(this._name, lineText, captureIndices);
  }
  getContentName(lineText, captureIndices) {
    if (!this._contentNameIsCapturing || this._contentName === null) {
      return this._contentName;
    }
    return RegexSource.replaceCaptures(this._contentName, lineText, captureIndices);
  }
};
var CaptureRule = class extends Rule {
  retokenizeCapturedWithRuleId;
  constructor($location, id, name, contentName, retokenizeCapturedWithRuleId) {
    super($location, id, name, contentName);
    this.retokenizeCapturedWithRuleId = retokenizeCapturedWithRuleId;
  }
  dispose() {
  }
  collectPatterns(grammar, out) {
    throw new Error("Not supported!");
  }
  compile(grammar, endRegexSource) {
    throw new Error("Not supported!");
  }
  compileAG(grammar, endRegexSource, allowA, allowG) {
    throw new Error("Not supported!");
  }
};
var MatchRule = class extends Rule {
  _match;
  captures;
  _cachedCompiledPatterns;
  constructor($location, id, name, match, captures) {
    super($location, id, name, null);
    this._match = new RegExpSource(match, this.id);
    this.captures = captures;
    this._cachedCompiledPatterns = null;
  }
  dispose() {
    if (this._cachedCompiledPatterns) {
      this._cachedCompiledPatterns.dispose();
      this._cachedCompiledPatterns = null;
    }
  }
  get debugMatchRegExp() {
    return `${this._match.source}`;
  }
  collectPatterns(grammar, out) {
    out.push(this._match);
  }
  compile(grammar, endRegexSource) {
    return this._getCachedCompiledPatterns(grammar).compile(grammar);
  }
  compileAG(grammar, endRegexSource, allowA, allowG) {
    return this._getCachedCompiledPatterns(grammar).compileAG(grammar, allowA, allowG);
  }
  _getCachedCompiledPatterns(grammar) {
    if (!this._cachedCompiledPatterns) {
      this._cachedCompiledPatterns = new RegExpSourceList();
      this.collectPatterns(grammar, this._cachedCompiledPatterns);
    }
    return this._cachedCompiledPatterns;
  }
};
var IncludeOnlyRule = class extends Rule {
  hasMissingPatterns;
  patterns;
  _cachedCompiledPatterns;
  constructor($location, id, name, contentName, patterns) {
    super($location, id, name, contentName);
    this.patterns = patterns.patterns;
    this.hasMissingPatterns = patterns.hasMissingPatterns;
    this._cachedCompiledPatterns = null;
  }
  dispose() {
    if (this._cachedCompiledPatterns) {
      this._cachedCompiledPatterns.dispose();
      this._cachedCompiledPatterns = null;
    }
  }
  collectPatterns(grammar, out) {
    for (const pattern of this.patterns) {
      const rule = grammar.getRule(pattern);
      rule.collectPatterns(grammar, out);
    }
  }
  compile(grammar, endRegexSource) {
    return this._getCachedCompiledPatterns(grammar).compile(grammar);
  }
  compileAG(grammar, endRegexSource, allowA, allowG) {
    return this._getCachedCompiledPatterns(grammar).compileAG(grammar, allowA, allowG);
  }
  _getCachedCompiledPatterns(grammar) {
    if (!this._cachedCompiledPatterns) {
      this._cachedCompiledPatterns = new RegExpSourceList();
      this.collectPatterns(grammar, this._cachedCompiledPatterns);
    }
    return this._cachedCompiledPatterns;
  }
};
var BeginEndRule = class extends Rule {
  _begin;
  beginCaptures;
  _end;
  endHasBackReferences;
  endCaptures;
  applyEndPatternLast;
  hasMissingPatterns;
  patterns;
  _cachedCompiledPatterns;
  constructor($location, id, name, contentName, begin, beginCaptures, end, endCaptures, applyEndPatternLast, patterns) {
    super($location, id, name, contentName);
    this._begin = new RegExpSource(begin, this.id);
    this.beginCaptures = beginCaptures;
    this._end = new RegExpSource(end ? end : "\uFFFF", -1);
    this.endHasBackReferences = this._end.hasBackReferences;
    this.endCaptures = endCaptures;
    this.applyEndPatternLast = applyEndPatternLast || false;
    this.patterns = patterns.patterns;
    this.hasMissingPatterns = patterns.hasMissingPatterns;
    this._cachedCompiledPatterns = null;
  }
  dispose() {
    if (this._cachedCompiledPatterns) {
      this._cachedCompiledPatterns.dispose();
      this._cachedCompiledPatterns = null;
    }
  }
  get debugBeginRegExp() {
    return `${this._begin.source}`;
  }
  get debugEndRegExp() {
    return `${this._end.source}`;
  }
  getEndWithResolvedBackReferences(lineText, captureIndices) {
    return this._end.resolveBackReferences(lineText, captureIndices);
  }
  collectPatterns(grammar, out) {
    out.push(this._begin);
  }
  compile(grammar, endRegexSource) {
    return this._getCachedCompiledPatterns(grammar, endRegexSource).compile(grammar);
  }
  compileAG(grammar, endRegexSource, allowA, allowG) {
    return this._getCachedCompiledPatterns(grammar, endRegexSource).compileAG(grammar, allowA, allowG);
  }
  _getCachedCompiledPatterns(grammar, endRegexSource) {
    if (!this._cachedCompiledPatterns) {
      this._cachedCompiledPatterns = new RegExpSourceList();
      for (const pattern of this.patterns) {
        const rule = grammar.getRule(pattern);
        rule.collectPatterns(grammar, this._cachedCompiledPatterns);
      }
      if (this.applyEndPatternLast) {
        this._cachedCompiledPatterns.push(this._end.hasBackReferences ? this._end.clone() : this._end);
      } else {
        this._cachedCompiledPatterns.unshift(this._end.hasBackReferences ? this._end.clone() : this._end);
      }
    }
    if (this._end.hasBackReferences) {
      if (this.applyEndPatternLast) {
        this._cachedCompiledPatterns.setSource(this._cachedCompiledPatterns.length() - 1, endRegexSource);
      } else {
        this._cachedCompiledPatterns.setSource(0, endRegexSource);
      }
    }
    return this._cachedCompiledPatterns;
  }
};
var BeginWhileRule = class extends Rule {
  _begin;
  beginCaptures;
  whileCaptures;
  _while;
  whileHasBackReferences;
  hasMissingPatterns;
  patterns;
  _cachedCompiledPatterns;
  _cachedCompiledWhilePatterns;
  constructor($location, id, name, contentName, begin, beginCaptures, _while, whileCaptures, patterns) {
    super($location, id, name, contentName);
    this._begin = new RegExpSource(begin, this.id);
    this.beginCaptures = beginCaptures;
    this.whileCaptures = whileCaptures;
    this._while = new RegExpSource(_while, whileRuleId);
    this.whileHasBackReferences = this._while.hasBackReferences;
    this.patterns = patterns.patterns;
    this.hasMissingPatterns = patterns.hasMissingPatterns;
    this._cachedCompiledPatterns = null;
    this._cachedCompiledWhilePatterns = null;
  }
  dispose() {
    if (this._cachedCompiledPatterns) {
      this._cachedCompiledPatterns.dispose();
      this._cachedCompiledPatterns = null;
    }
    if (this._cachedCompiledWhilePatterns) {
      this._cachedCompiledWhilePatterns.dispose();
      this._cachedCompiledWhilePatterns = null;
    }
  }
  get debugBeginRegExp() {
    return `${this._begin.source}`;
  }
  get debugWhileRegExp() {
    return `${this._while.source}`;
  }
  getWhileWithResolvedBackReferences(lineText, captureIndices) {
    return this._while.resolveBackReferences(lineText, captureIndices);
  }
  collectPatterns(grammar, out) {
    out.push(this._begin);
  }
  compile(grammar, endRegexSource) {
    return this._getCachedCompiledPatterns(grammar).compile(grammar);
  }
  compileAG(grammar, endRegexSource, allowA, allowG) {
    return this._getCachedCompiledPatterns(grammar).compileAG(grammar, allowA, allowG);
  }
  _getCachedCompiledPatterns(grammar) {
    if (!this._cachedCompiledPatterns) {
      this._cachedCompiledPatterns = new RegExpSourceList();
      for (const pattern of this.patterns) {
        const rule = grammar.getRule(pattern);
        rule.collectPatterns(grammar, this._cachedCompiledPatterns);
      }
    }
    return this._cachedCompiledPatterns;
  }
  compileWhile(grammar, endRegexSource) {
    return this._getCachedCompiledWhilePatterns(grammar, endRegexSource).compile(grammar);
  }
  compileWhileAG(grammar, endRegexSource, allowA, allowG) {
    return this._getCachedCompiledWhilePatterns(grammar, endRegexSource).compileAG(grammar, allowA, allowG);
  }
  _getCachedCompiledWhilePatterns(grammar, endRegexSource) {
    if (!this._cachedCompiledWhilePatterns) {
      this._cachedCompiledWhilePatterns = new RegExpSourceList();
      this._cachedCompiledWhilePatterns.push(this._while.hasBackReferences ? this._while.clone() : this._while);
    }
    if (this._while.hasBackReferences) {
      this._cachedCompiledWhilePatterns.setSource(0, endRegexSource ? endRegexSource : "\uFFFF");
    }
    return this._cachedCompiledWhilePatterns;
  }
};
var RuleFactory = class _RuleFactory {
  static createCaptureRule(helper, $location, name, contentName, retokenizeCapturedWithRuleId) {
    return helper.registerRule((id) => {
      return new CaptureRule($location, id, name, contentName, retokenizeCapturedWithRuleId);
    });
  }
  static getCompiledRuleId(desc, helper, repository) {
    if (!desc.id) {
      helper.registerRule((id) => {
        desc.id = id;
        if (desc.match) {
          return new MatchRule(
            desc.$vscodeTextmateLocation,
            desc.id,
            desc.name,
            desc.match,
            _RuleFactory._compileCaptures(desc.captures, helper, repository)
          );
        }
        if (typeof desc.begin === "undefined") {
          if (desc.repository) {
            repository = mergeObjects({}, repository, desc.repository);
          }
          let patterns = desc.patterns;
          if (typeof patterns === "undefined" && desc.include) {
            patterns = [{ include: desc.include }];
          }
          return new IncludeOnlyRule(
            desc.$vscodeTextmateLocation,
            desc.id,
            desc.name,
            desc.contentName,
            _RuleFactory._compilePatterns(patterns, helper, repository)
          );
        }
        if (desc.while) {
          return new BeginWhileRule(
            desc.$vscodeTextmateLocation,
            desc.id,
            desc.name,
            desc.contentName,
            desc.begin,
            _RuleFactory._compileCaptures(desc.beginCaptures || desc.captures, helper, repository),
            desc.while,
            _RuleFactory._compileCaptures(desc.whileCaptures || desc.captures, helper, repository),
            _RuleFactory._compilePatterns(desc.patterns, helper, repository)
          );
        }
        return new BeginEndRule(
          desc.$vscodeTextmateLocation,
          desc.id,
          desc.name,
          desc.contentName,
          desc.begin,
          _RuleFactory._compileCaptures(desc.beginCaptures || desc.captures, helper, repository),
          desc.end,
          _RuleFactory._compileCaptures(desc.endCaptures || desc.captures, helper, repository),
          desc.applyEndPatternLast,
          _RuleFactory._compilePatterns(desc.patterns, helper, repository)
        );
      });
    }
    return desc.id;
  }
  static _compileCaptures(captures, helper, repository) {
    let r4 = [];
    if (captures) {
      let maximumCaptureId = 0;
      for (const captureId in captures) {
        if (captureId === "$vscodeTextmateLocation") {
          continue;
        }
        const numericCaptureId = parseInt(captureId, 10);
        if (numericCaptureId > maximumCaptureId) {
          maximumCaptureId = numericCaptureId;
        }
      }
      for (let i2 = 0; i2 <= maximumCaptureId; i2++) {
        r4[i2] = null;
      }
      for (const captureId in captures) {
        if (captureId === "$vscodeTextmateLocation") {
          continue;
        }
        const numericCaptureId = parseInt(captureId, 10);
        let retokenizeCapturedWithRuleId = 0;
        if (captures[captureId].patterns) {
          retokenizeCapturedWithRuleId = _RuleFactory.getCompiledRuleId(captures[captureId], helper, repository);
        }
        r4[numericCaptureId] = _RuleFactory.createCaptureRule(helper, captures[captureId].$vscodeTextmateLocation, captures[captureId].name, captures[captureId].contentName, retokenizeCapturedWithRuleId);
      }
    }
    return r4;
  }
  static _compilePatterns(patterns, helper, repository) {
    let r4 = [];
    if (patterns) {
      for (let i2 = 0, len = patterns.length; i2 < len; i2++) {
        const pattern = patterns[i2];
        let ruleId = -1;
        if (pattern.include) {
          const reference = parseInclude(pattern.include);
          switch (reference.kind) {
            case 0:
            case 1:
              ruleId = _RuleFactory.getCompiledRuleId(repository[pattern.include], helper, repository);
              break;
            case 2:
              let localIncludedRule = repository[reference.ruleName];
              if (localIncludedRule) {
                ruleId = _RuleFactory.getCompiledRuleId(localIncludedRule, helper, repository);
              } else {
              }
              break;
            case 3:
            case 4:
              const externalGrammarName = reference.scopeName;
              const externalGrammarInclude = reference.kind === 4 ? reference.ruleName : null;
              const externalGrammar = helper.getExternalGrammar(externalGrammarName, repository);
              if (externalGrammar) {
                if (externalGrammarInclude) {
                  let externalIncludedRule = externalGrammar.repository[externalGrammarInclude];
                  if (externalIncludedRule) {
                    ruleId = _RuleFactory.getCompiledRuleId(externalIncludedRule, helper, externalGrammar.repository);
                  } else {
                  }
                } else {
                  ruleId = _RuleFactory.getCompiledRuleId(externalGrammar.repository.$self, helper, externalGrammar.repository);
                }
              } else {
              }
              break;
          }
        } else {
          ruleId = _RuleFactory.getCompiledRuleId(pattern, helper, repository);
        }
        if (ruleId !== -1) {
          const rule = helper.getRule(ruleId);
          let skipRule = false;
          if (rule instanceof IncludeOnlyRule || rule instanceof BeginEndRule || rule instanceof BeginWhileRule) {
            if (rule.hasMissingPatterns && rule.patterns.length === 0) {
              skipRule = true;
            }
          }
          if (skipRule) {
            continue;
          }
          r4.push(ruleId);
        }
      }
    }
    return {
      patterns: r4,
      hasMissingPatterns: (patterns ? patterns.length : 0) !== r4.length
    };
  }
};
var RegExpSource = class _RegExpSource {
  source;
  ruleId;
  hasAnchor;
  hasBackReferences;
  _anchorCache;
  constructor(regExpSource, ruleId) {
    if (regExpSource && typeof regExpSource === "string") {
      const len = regExpSource.length;
      let lastPushedPos = 0;
      let output = [];
      let hasAnchor = false;
      for (let pos = 0; pos < len; pos++) {
        const ch = regExpSource.charAt(pos);
        if (ch === "\\") {
          if (pos + 1 < len) {
            const nextCh = regExpSource.charAt(pos + 1);
            if (nextCh === "z") {
              output.push(regExpSource.substring(lastPushedPos, pos));
              output.push("$(?!\\n)(?<!\\n)");
              lastPushedPos = pos + 2;
            } else if (nextCh === "A" || nextCh === "G") {
              hasAnchor = true;
            }
            pos++;
          }
        }
      }
      this.hasAnchor = hasAnchor;
      if (lastPushedPos === 0) {
        this.source = regExpSource;
      } else {
        output.push(regExpSource.substring(lastPushedPos, len));
        this.source = output.join("");
      }
    } else {
      this.hasAnchor = false;
      this.source = regExpSource;
    }
    if (this.hasAnchor) {
      this._anchorCache = this._buildAnchorCache();
    } else {
      this._anchorCache = null;
    }
    this.ruleId = ruleId;
    if (typeof this.source === "string") {
      this.hasBackReferences = HAS_BACK_REFERENCES.test(this.source);
    } else {
      this.hasBackReferences = false;
    }
  }
  clone() {
    return new _RegExpSource(this.source, this.ruleId);
  }
  setSource(newSource) {
    if (this.source === newSource) {
      return;
    }
    this.source = newSource;
    if (this.hasAnchor) {
      this._anchorCache = this._buildAnchorCache();
    }
  }
  resolveBackReferences(lineText, captureIndices) {
    if (typeof this.source !== "string") {
      throw new Error("This method should only be called if the source is a string");
    }
    let capturedValues = captureIndices.map((capture) => {
      return lineText.substring(capture.start, capture.end);
    });
    BACK_REFERENCING_END.lastIndex = 0;
    return this.source.replace(BACK_REFERENCING_END, (match, g1) => {
      return escapeRegExpCharacters(capturedValues[parseInt(g1, 10)] || "");
    });
  }
  _buildAnchorCache() {
    if (typeof this.source !== "string") {
      throw new Error("This method should only be called if the source is a string");
    }
    let A0_G0_result = [];
    let A0_G1_result = [];
    let A1_G0_result = [];
    let A1_G1_result = [];
    let pos, len, ch, nextCh;
    for (pos = 0, len = this.source.length; pos < len; pos++) {
      ch = this.source.charAt(pos);
      A0_G0_result[pos] = ch;
      A0_G1_result[pos] = ch;
      A1_G0_result[pos] = ch;
      A1_G1_result[pos] = ch;
      if (ch === "\\") {
        if (pos + 1 < len) {
          nextCh = this.source.charAt(pos + 1);
          if (nextCh === "A") {
            A0_G0_result[pos + 1] = "\uFFFF";
            A0_G1_result[pos + 1] = "\uFFFF";
            A1_G0_result[pos + 1] = "A";
            A1_G1_result[pos + 1] = "A";
          } else if (nextCh === "G") {
            A0_G0_result[pos + 1] = "\uFFFF";
            A0_G1_result[pos + 1] = "G";
            A1_G0_result[pos + 1] = "\uFFFF";
            A1_G1_result[pos + 1] = "G";
          } else {
            A0_G0_result[pos + 1] = nextCh;
            A0_G1_result[pos + 1] = nextCh;
            A1_G0_result[pos + 1] = nextCh;
            A1_G1_result[pos + 1] = nextCh;
          }
          pos++;
        }
      }
    }
    return {
      A0_G0: A0_G0_result.join(""),
      A0_G1: A0_G1_result.join(""),
      A1_G0: A1_G0_result.join(""),
      A1_G1: A1_G1_result.join("")
    };
  }
  resolveAnchors(allowA, allowG) {
    if (!this.hasAnchor || !this._anchorCache || typeof this.source !== "string") {
      return this.source;
    }
    if (allowA) {
      if (allowG) {
        return this._anchorCache.A1_G1;
      } else {
        return this._anchorCache.A1_G0;
      }
    } else {
      if (allowG) {
        return this._anchorCache.A0_G1;
      } else {
        return this._anchorCache.A0_G0;
      }
    }
  }
};
var RegExpSourceList = class {
  _items;
  _hasAnchors;
  _cached;
  _anchorCache;
  constructor() {
    this._items = [];
    this._hasAnchors = false;
    this._cached = null;
    this._anchorCache = {
      A0_G0: null,
      A0_G1: null,
      A1_G0: null,
      A1_G1: null
    };
  }
  dispose() {
    this._disposeCaches();
  }
  _disposeCaches() {
    if (this._cached) {
      this._cached.dispose();
      this._cached = null;
    }
    if (this._anchorCache.A0_G0) {
      this._anchorCache.A0_G0.dispose();
      this._anchorCache.A0_G0 = null;
    }
    if (this._anchorCache.A0_G1) {
      this._anchorCache.A0_G1.dispose();
      this._anchorCache.A0_G1 = null;
    }
    if (this._anchorCache.A1_G0) {
      this._anchorCache.A1_G0.dispose();
      this._anchorCache.A1_G0 = null;
    }
    if (this._anchorCache.A1_G1) {
      this._anchorCache.A1_G1.dispose();
      this._anchorCache.A1_G1 = null;
    }
  }
  push(item) {
    this._items.push(item);
    this._hasAnchors = this._hasAnchors || item.hasAnchor;
  }
  unshift(item) {
    this._items.unshift(item);
    this._hasAnchors = this._hasAnchors || item.hasAnchor;
  }
  length() {
    return this._items.length;
  }
  setSource(index, newSource) {
    if (this._items[index].source !== newSource) {
      this._disposeCaches();
      this._items[index].setSource(newSource);
    }
  }
  compile(onigLib) {
    if (!this._cached) {
      let regExps = this._items.map((e) => e.source);
      this._cached = new CompiledRule(onigLib, regExps, this._items.map((e) => e.ruleId));
    }
    return this._cached;
  }
  compileAG(onigLib, allowA, allowG) {
    if (!this._hasAnchors) {
      return this.compile(onigLib);
    } else {
      if (allowA) {
        if (allowG) {
          if (!this._anchorCache.A1_G1) {
            this._anchorCache.A1_G1 = this._resolveAnchors(onigLib, allowA, allowG);
          }
          return this._anchorCache.A1_G1;
        } else {
          if (!this._anchorCache.A1_G0) {
            this._anchorCache.A1_G0 = this._resolveAnchors(onigLib, allowA, allowG);
          }
          return this._anchorCache.A1_G0;
        }
      } else {
        if (allowG) {
          if (!this._anchorCache.A0_G1) {
            this._anchorCache.A0_G1 = this._resolveAnchors(onigLib, allowA, allowG);
          }
          return this._anchorCache.A0_G1;
        } else {
          if (!this._anchorCache.A0_G0) {
            this._anchorCache.A0_G0 = this._resolveAnchors(onigLib, allowA, allowG);
          }
          return this._anchorCache.A0_G0;
        }
      }
    }
  }
  _resolveAnchors(onigLib, allowA, allowG) {
    let regExps = this._items.map((e) => e.resolveAnchors(allowA, allowG));
    return new CompiledRule(onigLib, regExps, this._items.map((e) => e.ruleId));
  }
};
var CompiledRule = class {
  constructor(onigLib, regExps, rules) {
    this.regExps = regExps;
    this.rules = rules;
    this.scanner = onigLib.createOnigScanner(regExps);
  }
  scanner;
  dispose() {
    if (typeof this.scanner.dispose === "function") {
      this.scanner.dispose();
    }
  }
  toString() {
    const r4 = [];
    for (let i2 = 0, len = this.rules.length; i2 < len; i2++) {
      r4.push("   - " + this.rules[i2] + ": " + this.regExps[i2]);
    }
    return r4.join("\n");
  }
  findNextMatchSync(string, startPosition, options) {
    const result = this.scanner.findNextMatchSync(string, startPosition, options);
    if (!result) {
      return null;
    }
    return {
      ruleId: this.rules[result.index],
      captureIndices: result.captureIndices
    };
  }
};
var BasicScopeAttributes = class {
  constructor(languageId, tokenType) {
    this.languageId = languageId;
    this.tokenType = tokenType;
  }
};
var BasicScopeAttributesProvider = class _BasicScopeAttributesProvider {
  _defaultAttributes;
  _embeddedLanguagesMatcher;
  constructor(initialLanguageId, embeddedLanguages) {
    this._defaultAttributes = new BasicScopeAttributes(
      initialLanguageId,
      8
      /* NotSet */
    );
    this._embeddedLanguagesMatcher = new ScopeMatcher(Object.entries(embeddedLanguages || {}));
  }
  getDefaultAttributes() {
    return this._defaultAttributes;
  }
  getBasicScopeAttributes(scopeName) {
    if (scopeName === null) {
      return _BasicScopeAttributesProvider._NULL_SCOPE_METADATA;
    }
    return this._getBasicScopeAttributes.get(scopeName);
  }
  static _NULL_SCOPE_METADATA = new BasicScopeAttributes(0, 0);
  _getBasicScopeAttributes = new CachedFn((scopeName) => {
    const languageId = this._scopeToLanguage(scopeName);
    const standardTokenType = this._toStandardTokenType(scopeName);
    return new BasicScopeAttributes(languageId, standardTokenType);
  });
  /**
   * Given a produced TM scope, return the language that token describes or null if unknown.
   * e.g. source.html => html, source.css.embedded.html => css, punctuation.definition.tag.html => null
   */
  _scopeToLanguage(scope) {
    return this._embeddedLanguagesMatcher.match(scope) || 0;
  }
  _toStandardTokenType(scopeName) {
    const m3 = scopeName.match(_BasicScopeAttributesProvider.STANDARD_TOKEN_TYPE_REGEXP);
    if (!m3) {
      return 8;
    }
    switch (m3[1]) {
      case "comment":
        return 1;
      case "string":
        return 2;
      case "regex":
        return 3;
      case "meta.embedded":
        return 0;
    }
    throw new Error("Unexpected match for standard token type!");
  }
  static STANDARD_TOKEN_TYPE_REGEXP = /\b(comment|string|regex|meta\.embedded)\b/;
};
var ScopeMatcher = class {
  values;
  scopesRegExp;
  constructor(values) {
    if (values.length === 0) {
      this.values = null;
      this.scopesRegExp = null;
    } else {
      this.values = new Map(values);
      const escapedScopes = values.map(
        ([scopeName, value]) => escapeRegExpCharacters(scopeName)
      );
      escapedScopes.sort();
      escapedScopes.reverse();
      this.scopesRegExp = new RegExp(
        `^((${escapedScopes.join(")|(")}))($|\\.)`,
        ""
      );
    }
  }
  match(scope) {
    if (!this.scopesRegExp) {
      return void 0;
    }
    const m3 = scope.match(this.scopesRegExp);
    if (!m3) {
      return void 0;
    }
    return this.values.get(m3[1]);
  }
};
var DebugFlags = {
  InDebugMode: typeof process !== "undefined" && !!process.env["VSCODE_TEXTMATE_DEBUG"]
};
var UseOnigurumaFindOptions = false;
var TokenizeStringResult = class {
  constructor(stack, stoppedEarly) {
    this.stack = stack;
    this.stoppedEarly = stoppedEarly;
  }
};
function _tokenizeString(grammar, lineText, isFirstLine, linePos, stack, lineTokens, checkWhileConditions, timeLimit) {
  const lineLength = lineText.content.length;
  let STOP = false;
  let anchorPosition = -1;
  if (checkWhileConditions) {
    const whileCheckResult = _checkWhileConditions(
      grammar,
      lineText,
      isFirstLine,
      linePos,
      stack,
      lineTokens
    );
    stack = whileCheckResult.stack;
    linePos = whileCheckResult.linePos;
    isFirstLine = whileCheckResult.isFirstLine;
    anchorPosition = whileCheckResult.anchorPosition;
  }
  const startTime = Date.now();
  while (!STOP) {
    if (timeLimit !== 0) {
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime > timeLimit) {
        return new TokenizeStringResult(stack, true);
      }
    }
    scanNext();
  }
  return new TokenizeStringResult(stack, false);
  function scanNext() {
    if (false) {
      console.log("");
      console.log(
        `@@scanNext ${linePos}: |${lineText.content.substr(linePos).replace(/\n$/, "\\n")}|`
      );
    }
    const r4 = matchRuleOrInjections(
      grammar,
      lineText,
      isFirstLine,
      linePos,
      stack,
      anchorPosition
    );
    if (!r4) {
      lineTokens.produce(stack, lineLength);
      STOP = true;
      return;
    }
    const captureIndices = r4.captureIndices;
    const matchedRuleId = r4.matchedRuleId;
    const hasAdvanced = captureIndices && captureIndices.length > 0 ? captureIndices[0].end > linePos : false;
    if (matchedRuleId === endRuleId) {
      const poppedRule = stack.getRule(grammar);
      if (false) {
        console.log(
          "  popping " + poppedRule.debugName + " - " + poppedRule.debugEndRegExp
        );
      }
      lineTokens.produce(stack, captureIndices[0].start);
      stack = stack.withContentNameScopesList(stack.nameScopesList);
      handleCaptures(
        grammar,
        lineText,
        isFirstLine,
        stack,
        lineTokens,
        poppedRule.endCaptures,
        captureIndices
      );
      lineTokens.produce(stack, captureIndices[0].end);
      const popped = stack;
      stack = stack.parent;
      anchorPosition = popped.getAnchorPos();
      if (!hasAdvanced && popped.getEnterPos() === linePos) {
        if (false) {
          console.error(
            "[1] - Grammar is in an endless loop - Grammar pushed & popped a rule without advancing"
          );
        }
        stack = popped;
        lineTokens.produce(stack, lineLength);
        STOP = true;
        return;
      }
    } else {
      const _rule = grammar.getRule(matchedRuleId);
      lineTokens.produce(stack, captureIndices[0].start);
      const beforePush = stack;
      const scopeName = _rule.getName(lineText.content, captureIndices);
      const nameScopesList = stack.contentNameScopesList.pushAttributed(
        scopeName,
        grammar
      );
      stack = stack.push(
        matchedRuleId,
        linePos,
        anchorPosition,
        captureIndices[0].end === lineLength,
        null,
        nameScopesList,
        nameScopesList
      );
      if (_rule instanceof BeginEndRule) {
        const pushedRule = _rule;
        if (false) {
          console.log(
            "  pushing " + pushedRule.debugName + " - " + pushedRule.debugBeginRegExp
          );
        }
        handleCaptures(
          grammar,
          lineText,
          isFirstLine,
          stack,
          lineTokens,
          pushedRule.beginCaptures,
          captureIndices
        );
        lineTokens.produce(stack, captureIndices[0].end);
        anchorPosition = captureIndices[0].end;
        const contentName = pushedRule.getContentName(
          lineText.content,
          captureIndices
        );
        const contentNameScopesList = nameScopesList.pushAttributed(
          contentName,
          grammar
        );
        stack = stack.withContentNameScopesList(contentNameScopesList);
        if (pushedRule.endHasBackReferences) {
          stack = stack.withEndRule(
            pushedRule.getEndWithResolvedBackReferences(
              lineText.content,
              captureIndices
            )
          );
        }
        if (!hasAdvanced && beforePush.hasSameRuleAs(stack)) {
          if (false) {
            console.error(
              "[2] - Grammar is in an endless loop - Grammar pushed the same rule without advancing"
            );
          }
          stack = stack.pop();
          lineTokens.produce(stack, lineLength);
          STOP = true;
          return;
        }
      } else if (_rule instanceof BeginWhileRule) {
        const pushedRule = _rule;
        if (false) {
          console.log("  pushing " + pushedRule.debugName);
        }
        handleCaptures(
          grammar,
          lineText,
          isFirstLine,
          stack,
          lineTokens,
          pushedRule.beginCaptures,
          captureIndices
        );
        lineTokens.produce(stack, captureIndices[0].end);
        anchorPosition = captureIndices[0].end;
        const contentName = pushedRule.getContentName(
          lineText.content,
          captureIndices
        );
        const contentNameScopesList = nameScopesList.pushAttributed(
          contentName,
          grammar
        );
        stack = stack.withContentNameScopesList(contentNameScopesList);
        if (pushedRule.whileHasBackReferences) {
          stack = stack.withEndRule(
            pushedRule.getWhileWithResolvedBackReferences(
              lineText.content,
              captureIndices
            )
          );
        }
        if (!hasAdvanced && beforePush.hasSameRuleAs(stack)) {
          if (false) {
            console.error(
              "[3] - Grammar is in an endless loop - Grammar pushed the same rule without advancing"
            );
          }
          stack = stack.pop();
          lineTokens.produce(stack, lineLength);
          STOP = true;
          return;
        }
      } else {
        const matchingRule = _rule;
        if (false) {
          console.log(
            "  matched " + matchingRule.debugName + " - " + matchingRule.debugMatchRegExp
          );
        }
        handleCaptures(
          grammar,
          lineText,
          isFirstLine,
          stack,
          lineTokens,
          matchingRule.captures,
          captureIndices
        );
        lineTokens.produce(stack, captureIndices[0].end);
        stack = stack.pop();
        if (!hasAdvanced) {
          if (false) {
            console.error(
              "[4] - Grammar is in an endless loop - Grammar is not advancing, nor is it pushing/popping"
            );
          }
          stack = stack.safePop();
          lineTokens.produce(stack, lineLength);
          STOP = true;
          return;
        }
      }
    }
    if (captureIndices[0].end > linePos) {
      linePos = captureIndices[0].end;
      isFirstLine = false;
    }
  }
}
function _checkWhileConditions(grammar, lineText, isFirstLine, linePos, stack, lineTokens) {
  let anchorPosition = stack.beginRuleCapturedEOL ? 0 : -1;
  const whileRules = [];
  for (let node = stack; node; node = node.pop()) {
    const nodeRule = node.getRule(grammar);
    if (nodeRule instanceof BeginWhileRule) {
      whileRules.push({
        rule: nodeRule,
        stack: node
      });
    }
  }
  for (let whileRule = whileRules.pop(); whileRule; whileRule = whileRules.pop()) {
    const { ruleScanner, findOptions } = prepareRuleWhileSearch(whileRule.rule, grammar, whileRule.stack.endRule, isFirstLine, linePos === anchorPosition);
    const r4 = ruleScanner.findNextMatchSync(lineText, linePos, findOptions);
    if (false) {
      console.log("  scanning for while rule");
      console.log(ruleScanner.toString());
    }
    if (r4) {
      const matchedRuleId = r4.ruleId;
      if (matchedRuleId !== whileRuleId) {
        stack = whileRule.stack.pop();
        break;
      }
      if (r4.captureIndices && r4.captureIndices.length) {
        lineTokens.produce(whileRule.stack, r4.captureIndices[0].start);
        handleCaptures(grammar, lineText, isFirstLine, whileRule.stack, lineTokens, whileRule.rule.whileCaptures, r4.captureIndices);
        lineTokens.produce(whileRule.stack, r4.captureIndices[0].end);
        anchorPosition = r4.captureIndices[0].end;
        if (r4.captureIndices[0].end > linePos) {
          linePos = r4.captureIndices[0].end;
          isFirstLine = false;
        }
      }
    } else {
      if (false) {
        console.log("  popping " + whileRule.rule.debugName + " - " + whileRule.rule.debugWhileRegExp);
      }
      stack = whileRule.stack.pop();
      break;
    }
  }
  return { stack, linePos, anchorPosition, isFirstLine };
}
function matchRuleOrInjections(grammar, lineText, isFirstLine, linePos, stack, anchorPosition) {
  const matchResult = matchRule(grammar, lineText, isFirstLine, linePos, stack, anchorPosition);
  const injections = grammar.getInjections();
  if (injections.length === 0) {
    return matchResult;
  }
  const injectionResult = matchInjections(injections, grammar, lineText, isFirstLine, linePos, stack, anchorPosition);
  if (!injectionResult) {
    return matchResult;
  }
  if (!matchResult) {
    return injectionResult;
  }
  const matchResultScore = matchResult.captureIndices[0].start;
  const injectionResultScore = injectionResult.captureIndices[0].start;
  if (injectionResultScore < matchResultScore || injectionResult.priorityMatch && injectionResultScore === matchResultScore) {
    return injectionResult;
  }
  return matchResult;
}
function matchRule(grammar, lineText, isFirstLine, linePos, stack, anchorPosition) {
  const rule = stack.getRule(grammar);
  const { ruleScanner, findOptions } = prepareRuleSearch(rule, grammar, stack.endRule, isFirstLine, linePos === anchorPosition);
  const r4 = ruleScanner.findNextMatchSync(lineText, linePos, findOptions);
  if (r4) {
    return {
      captureIndices: r4.captureIndices,
      matchedRuleId: r4.ruleId
    };
  }
  return null;
}
function matchInjections(injections, grammar, lineText, isFirstLine, linePos, stack, anchorPosition) {
  let bestMatchRating = Number.MAX_VALUE;
  let bestMatchCaptureIndices = null;
  let bestMatchRuleId;
  let bestMatchResultPriority = 0;
  const scopes = stack.contentNameScopesList.getScopeNames();
  for (let i2 = 0, len = injections.length; i2 < len; i2++) {
    const injection = injections[i2];
    if (!injection.matcher(scopes)) {
      continue;
    }
    const rule = grammar.getRule(injection.ruleId);
    const { ruleScanner, findOptions } = prepareRuleSearch(rule, grammar, null, isFirstLine, linePos === anchorPosition);
    const matchResult = ruleScanner.findNextMatchSync(lineText, linePos, findOptions);
    if (!matchResult) {
      continue;
    }
    if (false) {
      console.log(`  matched injection: ${injection.debugSelector}`);
      console.log(ruleScanner.toString());
    }
    const matchRating = matchResult.captureIndices[0].start;
    if (matchRating >= bestMatchRating) {
      continue;
    }
    bestMatchRating = matchRating;
    bestMatchCaptureIndices = matchResult.captureIndices;
    bestMatchRuleId = matchResult.ruleId;
    bestMatchResultPriority = injection.priority;
    if (bestMatchRating === linePos) {
      break;
    }
  }
  if (bestMatchCaptureIndices) {
    return {
      priorityMatch: bestMatchResultPriority === -1,
      captureIndices: bestMatchCaptureIndices,
      matchedRuleId: bestMatchRuleId
    };
  }
  return null;
}
function prepareRuleSearch(rule, grammar, endRegexSource, allowA, allowG) {
  if (UseOnigurumaFindOptions) {
    const ruleScanner2 = rule.compile(grammar, endRegexSource);
    const findOptions = getFindOptions(allowA, allowG);
    return { ruleScanner: ruleScanner2, findOptions };
  }
  const ruleScanner = rule.compileAG(grammar, endRegexSource, allowA, allowG);
  return {
    ruleScanner,
    findOptions: 0
    /* None */
  };
}
function prepareRuleWhileSearch(rule, grammar, endRegexSource, allowA, allowG) {
  if (UseOnigurumaFindOptions) {
    const ruleScanner2 = rule.compileWhile(grammar, endRegexSource);
    const findOptions = getFindOptions(allowA, allowG);
    return { ruleScanner: ruleScanner2, findOptions };
  }
  const ruleScanner = rule.compileWhileAG(grammar, endRegexSource, allowA, allowG);
  return {
    ruleScanner,
    findOptions: 0
    /* None */
  };
}
function getFindOptions(allowA, allowG) {
  let options = 0;
  if (!allowA) {
    options |= 1;
  }
  if (!allowG) {
    options |= 4;
  }
  return options;
}
function handleCaptures(grammar, lineText, isFirstLine, stack, lineTokens, captures, captureIndices) {
  if (captures.length === 0) {
    return;
  }
  const lineTextContent = lineText.content;
  const len = Math.min(captures.length, captureIndices.length);
  const localStack = [];
  const maxEnd = captureIndices[0].end;
  for (let i2 = 0; i2 < len; i2++) {
    const captureRule = captures[i2];
    if (captureRule === null) {
      continue;
    }
    const captureIndex = captureIndices[i2];
    if (captureIndex.length === 0) {
      continue;
    }
    if (captureIndex.start > maxEnd) {
      break;
    }
    while (localStack.length > 0 && localStack[localStack.length - 1].endPos <= captureIndex.start) {
      lineTokens.produceFromScopes(localStack[localStack.length - 1].scopes, localStack[localStack.length - 1].endPos);
      localStack.pop();
    }
    if (localStack.length > 0) {
      lineTokens.produceFromScopes(localStack[localStack.length - 1].scopes, captureIndex.start);
    } else {
      lineTokens.produce(stack, captureIndex.start);
    }
    if (captureRule.retokenizeCapturedWithRuleId) {
      const scopeName = captureRule.getName(lineTextContent, captureIndices);
      const nameScopesList = stack.contentNameScopesList.pushAttributed(scopeName, grammar);
      const contentName = captureRule.getContentName(lineTextContent, captureIndices);
      const contentNameScopesList = nameScopesList.pushAttributed(contentName, grammar);
      const stackClone = stack.push(captureRule.retokenizeCapturedWithRuleId, captureIndex.start, -1, false, null, nameScopesList, contentNameScopesList);
      const onigSubStr = grammar.createOnigString(lineTextContent.substring(0, captureIndex.end));
      _tokenizeString(
        grammar,
        onigSubStr,
        isFirstLine && captureIndex.start === 0,
        captureIndex.start,
        stackClone,
        lineTokens,
        false,
        /* no time limit */
        0
      );
      disposeOnigString(onigSubStr);
      continue;
    }
    const captureRuleScopeName = captureRule.getName(lineTextContent, captureIndices);
    if (captureRuleScopeName !== null) {
      const base = localStack.length > 0 ? localStack[localStack.length - 1].scopes : stack.contentNameScopesList;
      const captureRuleScopesList = base.pushAttributed(captureRuleScopeName, grammar);
      localStack.push(new LocalStackElement(captureRuleScopesList, captureIndex.end));
    }
  }
  while (localStack.length > 0) {
    lineTokens.produceFromScopes(localStack[localStack.length - 1].scopes, localStack[localStack.length - 1].endPos);
    localStack.pop();
  }
}
var LocalStackElement = class {
  scopes;
  endPos;
  constructor(scopes, endPos) {
    this.scopes = scopes;
    this.endPos = endPos;
  }
};
function createGrammar(scopeName, grammar, initialLanguage, embeddedLanguages, tokenTypes, balancedBracketSelectors, grammarRepository, onigLib) {
  return new Grammar(
    scopeName,
    grammar,
    initialLanguage,
    embeddedLanguages,
    tokenTypes,
    balancedBracketSelectors,
    grammarRepository,
    onigLib
  );
}
function collectInjections(result, selector, rule, ruleFactoryHelper, grammar) {
  const matchers = createMatchers(selector, nameMatcher);
  const ruleId = RuleFactory.getCompiledRuleId(rule, ruleFactoryHelper, grammar.repository);
  for (const matcher of matchers) {
    result.push({
      debugSelector: selector,
      matcher: matcher.matcher,
      ruleId,
      grammar,
      priority: matcher.priority
    });
  }
}
function nameMatcher(identifers, scopes) {
  if (scopes.length < identifers.length) {
    return false;
  }
  let lastIndex = 0;
  return identifers.every((identifier) => {
    for (let i2 = lastIndex; i2 < scopes.length; i2++) {
      if (scopesAreMatching(scopes[i2], identifier)) {
        lastIndex = i2 + 1;
        return true;
      }
    }
    return false;
  });
}
function scopesAreMatching(thisScopeName, scopeName) {
  if (!thisScopeName) {
    return false;
  }
  if (thisScopeName === scopeName) {
    return true;
  }
  const len = scopeName.length;
  return thisScopeName.length > len && thisScopeName.substr(0, len) === scopeName && thisScopeName[len] === ".";
}
var Grammar = class {
  constructor(_rootScopeName, grammar, initialLanguage, embeddedLanguages, tokenTypes, balancedBracketSelectors, grammarRepository, _onigLib) {
    this._rootScopeName = _rootScopeName;
    this.balancedBracketSelectors = balancedBracketSelectors;
    this._onigLib = _onigLib;
    this._basicScopeAttributesProvider = new BasicScopeAttributesProvider(
      initialLanguage,
      embeddedLanguages
    );
    this._rootId = -1;
    this._lastRuleId = 0;
    this._ruleId2desc = [null];
    this._includedGrammars = {};
    this._grammarRepository = grammarRepository;
    this._grammar = initGrammar(grammar, null);
    this._injections = null;
    this._tokenTypeMatchers = [];
    if (tokenTypes) {
      for (const selector of Object.keys(tokenTypes)) {
        const matchers = createMatchers(selector, nameMatcher);
        for (const matcher of matchers) {
          this._tokenTypeMatchers.push({
            matcher: matcher.matcher,
            type: tokenTypes[selector]
          });
        }
      }
    }
  }
  _rootId;
  _lastRuleId;
  _ruleId2desc;
  _includedGrammars;
  _grammarRepository;
  _grammar;
  _injections;
  _basicScopeAttributesProvider;
  _tokenTypeMatchers;
  get themeProvider() {
    return this._grammarRepository;
  }
  dispose() {
    for (const rule of this._ruleId2desc) {
      if (rule) {
        rule.dispose();
      }
    }
  }
  createOnigScanner(sources) {
    return this._onigLib.createOnigScanner(sources);
  }
  createOnigString(sources) {
    return this._onigLib.createOnigString(sources);
  }
  getMetadataForScope(scope) {
    return this._basicScopeAttributesProvider.getBasicScopeAttributes(scope);
  }
  _collectInjections() {
    const grammarRepository = {
      lookup: (scopeName2) => {
        if (scopeName2 === this._rootScopeName) {
          return this._grammar;
        }
        return this.getExternalGrammar(scopeName2);
      },
      injections: (scopeName2) => {
        return this._grammarRepository.injections(scopeName2);
      }
    };
    const result = [];
    const scopeName = this._rootScopeName;
    const grammar = grammarRepository.lookup(scopeName);
    if (grammar) {
      const rawInjections = grammar.injections;
      if (rawInjections) {
        for (let expression in rawInjections) {
          collectInjections(
            result,
            expression,
            rawInjections[expression],
            this,
            grammar
          );
        }
      }
      const injectionScopeNames = this._grammarRepository.injections(scopeName);
      if (injectionScopeNames) {
        injectionScopeNames.forEach((injectionScopeName) => {
          const injectionGrammar = this.getExternalGrammar(injectionScopeName);
          if (injectionGrammar) {
            const selector = injectionGrammar.injectionSelector;
            if (selector) {
              collectInjections(
                result,
                selector,
                injectionGrammar,
                this,
                injectionGrammar
              );
            }
          }
        });
      }
    }
    result.sort((i1, i2) => i1.priority - i2.priority);
    return result;
  }
  getInjections() {
    if (this._injections === null) {
      this._injections = this._collectInjections();
    }
    return this._injections;
  }
  registerRule(factory) {
    const id = ++this._lastRuleId;
    const result = factory(ruleIdFromNumber(id));
    this._ruleId2desc[id] = result;
    return result;
  }
  getRule(ruleId) {
    return this._ruleId2desc[ruleIdToNumber(ruleId)];
  }
  getExternalGrammar(scopeName, repository) {
    if (this._includedGrammars[scopeName]) {
      return this._includedGrammars[scopeName];
    } else if (this._grammarRepository) {
      const rawIncludedGrammar = this._grammarRepository.lookup(scopeName);
      if (rawIncludedGrammar) {
        this._includedGrammars[scopeName] = initGrammar(
          rawIncludedGrammar,
          repository && repository.$base
        );
        return this._includedGrammars[scopeName];
      }
    }
    return void 0;
  }
  tokenizeLine(lineText, prevState, timeLimit = 0) {
    const r4 = this._tokenize(lineText, prevState, false, timeLimit);
    return {
      tokens: r4.lineTokens.getResult(r4.ruleStack, r4.lineLength),
      ruleStack: r4.ruleStack,
      stoppedEarly: r4.stoppedEarly
    };
  }
  tokenizeLine2(lineText, prevState, timeLimit = 0) {
    const r4 = this._tokenize(lineText, prevState, true, timeLimit);
    return {
      tokens: r4.lineTokens.getBinaryResult(r4.ruleStack, r4.lineLength),
      ruleStack: r4.ruleStack,
      stoppedEarly: r4.stoppedEarly
    };
  }
  _tokenize(lineText, prevState, emitBinaryTokens, timeLimit) {
    if (this._rootId === -1) {
      this._rootId = RuleFactory.getCompiledRuleId(
        this._grammar.repository.$self,
        this,
        this._grammar.repository
      );
      this.getInjections();
    }
    let isFirstLine;
    if (!prevState || prevState === StateStackImpl.NULL) {
      isFirstLine = true;
      const rawDefaultMetadata = this._basicScopeAttributesProvider.getDefaultAttributes();
      const defaultStyle = this.themeProvider.getDefaults();
      const defaultMetadata = EncodedTokenMetadata.set(
        0,
        rawDefaultMetadata.languageId,
        rawDefaultMetadata.tokenType,
        null,
        defaultStyle.fontStyle,
        defaultStyle.foregroundId,
        defaultStyle.backgroundId
      );
      const rootScopeName = this.getRule(this._rootId).getName(
        null,
        null
      );
      let scopeList;
      if (rootScopeName) {
        scopeList = AttributedScopeStack.createRootAndLookUpScopeName(
          rootScopeName,
          defaultMetadata,
          this
        );
      } else {
        scopeList = AttributedScopeStack.createRoot(
          "unknown",
          defaultMetadata
        );
      }
      prevState = new StateStackImpl(
        null,
        this._rootId,
        -1,
        -1,
        false,
        null,
        scopeList,
        scopeList
      );
    } else {
      isFirstLine = false;
      prevState.reset();
    }
    lineText = lineText + "\n";
    const onigLineText = this.createOnigString(lineText);
    const lineLength = onigLineText.content.length;
    const lineTokens = new LineTokens(
      emitBinaryTokens,
      lineText,
      this._tokenTypeMatchers,
      this.balancedBracketSelectors
    );
    const r4 = _tokenizeString(
      this,
      onigLineText,
      isFirstLine,
      0,
      prevState,
      lineTokens,
      true,
      timeLimit
    );
    disposeOnigString(onigLineText);
    return {
      lineLength,
      lineTokens,
      ruleStack: r4.stack,
      stoppedEarly: r4.stoppedEarly
    };
  }
};
function initGrammar(grammar, base) {
  grammar = clone(grammar);
  grammar.repository = grammar.repository || {};
  grammar.repository.$self = {
    $vscodeTextmateLocation: grammar.$vscodeTextmateLocation,
    patterns: grammar.patterns,
    name: grammar.scopeName
  };
  grammar.repository.$base = base || grammar.repository.$self;
  return grammar;
}
var AttributedScopeStack = class _AttributedScopeStack {
  /**
   * Invariant:
   * ```
   * if (parent && !scopePath.extends(parent.scopePath)) {
   * 	throw new Error();
   * }
   * ```
   */
  constructor(parent, scopePath, tokenAttributes) {
    this.parent = parent;
    this.scopePath = scopePath;
    this.tokenAttributes = tokenAttributes;
  }
  static fromExtension(namesScopeList, contentNameScopesList) {
    let current = namesScopeList;
    let scopeNames = namesScopeList?.scopePath ?? null;
    for (const frame of contentNameScopesList) {
      scopeNames = ScopeStack.push(scopeNames, frame.scopeNames);
      current = new _AttributedScopeStack(current, scopeNames, frame.encodedTokenAttributes);
    }
    return current;
  }
  static createRoot(scopeName, tokenAttributes) {
    return new _AttributedScopeStack(null, new ScopeStack(null, scopeName), tokenAttributes);
  }
  static createRootAndLookUpScopeName(scopeName, tokenAttributes, grammar) {
    const rawRootMetadata = grammar.getMetadataForScope(scopeName);
    const scopePath = new ScopeStack(null, scopeName);
    const rootStyle = grammar.themeProvider.themeMatch(scopePath);
    const resolvedTokenAttributes = _AttributedScopeStack.mergeAttributes(
      tokenAttributes,
      rawRootMetadata,
      rootStyle
    );
    return new _AttributedScopeStack(null, scopePath, resolvedTokenAttributes);
  }
  get scopeName() {
    return this.scopePath.scopeName;
  }
  toString() {
    return this.getScopeNames().join(" ");
  }
  equals(other) {
    return _AttributedScopeStack.equals(this, other);
  }
  static equals(a2, b3) {
    do {
      if (a2 === b3) {
        return true;
      }
      if (!a2 && !b3) {
        return true;
      }
      if (!a2 || !b3) {
        return false;
      }
      if (a2.scopeName !== b3.scopeName || a2.tokenAttributes !== b3.tokenAttributes) {
        return false;
      }
      a2 = a2.parent;
      b3 = b3.parent;
    } while (true);
  }
  static mergeAttributes(existingTokenAttributes, basicScopeAttributes, styleAttributes) {
    let fontStyle = -1;
    let foreground = 0;
    let background = 0;
    if (styleAttributes !== null) {
      fontStyle = styleAttributes.fontStyle;
      foreground = styleAttributes.foregroundId;
      background = styleAttributes.backgroundId;
    }
    return EncodedTokenMetadata.set(
      existingTokenAttributes,
      basicScopeAttributes.languageId,
      basicScopeAttributes.tokenType,
      null,
      fontStyle,
      foreground,
      background
    );
  }
  pushAttributed(scopePath, grammar) {
    if (scopePath === null) {
      return this;
    }
    if (scopePath.indexOf(" ") === -1) {
      return _AttributedScopeStack._pushAttributed(this, scopePath, grammar);
    }
    const scopes = scopePath.split(/ /g);
    let result = this;
    for (const scope of scopes) {
      result = _AttributedScopeStack._pushAttributed(result, scope, grammar);
    }
    return result;
  }
  static _pushAttributed(target, scopeName, grammar) {
    const rawMetadata = grammar.getMetadataForScope(scopeName);
    const newPath = target.scopePath.push(scopeName);
    const scopeThemeMatchResult = grammar.themeProvider.themeMatch(newPath);
    const metadata = _AttributedScopeStack.mergeAttributes(
      target.tokenAttributes,
      rawMetadata,
      scopeThemeMatchResult
    );
    return new _AttributedScopeStack(target, newPath, metadata);
  }
  getScopeNames() {
    return this.scopePath.getSegments();
  }
  getExtensionIfDefined(base) {
    const result = [];
    let self2 = this;
    while (self2 && self2 !== base) {
      result.push({
        encodedTokenAttributes: self2.tokenAttributes,
        scopeNames: self2.scopePath.getExtensionIfDefined(self2.parent?.scopePath ?? null)
      });
      self2 = self2.parent;
    }
    return self2 === base ? result.reverse() : void 0;
  }
};
var StateStackImpl = class _StateStackImpl {
  /**
   * Invariant:
   * ```
   * if (contentNameScopesList !== nameScopesList && contentNameScopesList?.parent !== nameScopesList) {
   * 	throw new Error();
   * }
   * if (this.parent && !nameScopesList.extends(this.parent.contentNameScopesList)) {
   * 	throw new Error();
   * }
   * ```
   */
  constructor(parent, ruleId, enterPos, anchorPos, beginRuleCapturedEOL, endRule, nameScopesList, contentNameScopesList) {
    this.parent = parent;
    this.ruleId = ruleId;
    this.beginRuleCapturedEOL = beginRuleCapturedEOL;
    this.endRule = endRule;
    this.nameScopesList = nameScopesList;
    this.contentNameScopesList = contentNameScopesList;
    this.depth = this.parent ? this.parent.depth + 1 : 1;
    this._enterPos = enterPos;
    this._anchorPos = anchorPos;
  }
  _stackElementBrand = void 0;
  // TODO remove me
  static NULL = new _StateStackImpl(
    null,
    0,
    0,
    0,
    false,
    null,
    null,
    null
  );
  /**
   * The position on the current line where this state was pushed.
   * This is relevant only while tokenizing a line, to detect endless loops.
   * Its value is meaningless across lines.
   */
  _enterPos;
  /**
   * The captured anchor position when this stack element was pushed.
   * This is relevant only while tokenizing a line, to restore the anchor position when popping.
   * Its value is meaningless across lines.
   */
  _anchorPos;
  /**
   * The depth of the stack.
   */
  depth;
  equals(other) {
    if (other === null) {
      return false;
    }
    return _StateStackImpl._equals(this, other);
  }
  static _equals(a2, b3) {
    if (a2 === b3) {
      return true;
    }
    if (!this._structuralEquals(a2, b3)) {
      return false;
    }
    return AttributedScopeStack.equals(a2.contentNameScopesList, b3.contentNameScopesList);
  }
  /**
   * A structural equals check. Does not take into account `scopes`.
   */
  static _structuralEquals(a2, b3) {
    do {
      if (a2 === b3) {
        return true;
      }
      if (!a2 && !b3) {
        return true;
      }
      if (!a2 || !b3) {
        return false;
      }
      if (a2.depth !== b3.depth || a2.ruleId !== b3.ruleId || a2.endRule !== b3.endRule) {
        return false;
      }
      a2 = a2.parent;
      b3 = b3.parent;
    } while (true);
  }
  clone() {
    return this;
  }
  static _reset(el) {
    while (el) {
      el._enterPos = -1;
      el._anchorPos = -1;
      el = el.parent;
    }
  }
  reset() {
    _StateStackImpl._reset(this);
  }
  pop() {
    return this.parent;
  }
  safePop() {
    if (this.parent) {
      return this.parent;
    }
    return this;
  }
  push(ruleId, enterPos, anchorPos, beginRuleCapturedEOL, endRule, nameScopesList, contentNameScopesList) {
    return new _StateStackImpl(
      this,
      ruleId,
      enterPos,
      anchorPos,
      beginRuleCapturedEOL,
      endRule,
      nameScopesList,
      contentNameScopesList
    );
  }
  getEnterPos() {
    return this._enterPos;
  }
  getAnchorPos() {
    return this._anchorPos;
  }
  getRule(grammar) {
    return grammar.getRule(this.ruleId);
  }
  toString() {
    const r4 = [];
    this._writeString(r4, 0);
    return "[" + r4.join(",") + "]";
  }
  _writeString(res, outIndex) {
    if (this.parent) {
      outIndex = this.parent._writeString(res, outIndex);
    }
    res[outIndex++] = `(${this.ruleId}, ${this.nameScopesList?.toString()}, ${this.contentNameScopesList?.toString()})`;
    return outIndex;
  }
  withContentNameScopesList(contentNameScopeStack) {
    if (this.contentNameScopesList === contentNameScopeStack) {
      return this;
    }
    return this.parent.push(
      this.ruleId,
      this._enterPos,
      this._anchorPos,
      this.beginRuleCapturedEOL,
      this.endRule,
      this.nameScopesList,
      contentNameScopeStack
    );
  }
  withEndRule(endRule) {
    if (this.endRule === endRule) {
      return this;
    }
    return new _StateStackImpl(
      this.parent,
      this.ruleId,
      this._enterPos,
      this._anchorPos,
      this.beginRuleCapturedEOL,
      endRule,
      this.nameScopesList,
      this.contentNameScopesList
    );
  }
  // Used to warn of endless loops
  hasSameRuleAs(other) {
    let el = this;
    while (el && el._enterPos === other._enterPos) {
      if (el.ruleId === other.ruleId) {
        return true;
      }
      el = el.parent;
    }
    return false;
  }
  toStateStackFrame() {
    return {
      ruleId: ruleIdToNumber(this.ruleId),
      beginRuleCapturedEOL: this.beginRuleCapturedEOL,
      endRule: this.endRule,
      nameScopesList: this.nameScopesList?.getExtensionIfDefined(this.parent?.nameScopesList ?? null) ?? [],
      contentNameScopesList: this.contentNameScopesList?.getExtensionIfDefined(this.nameScopesList) ?? []
    };
  }
  static pushFrame(self2, frame) {
    const namesScopeList = AttributedScopeStack.fromExtension(self2?.nameScopesList ?? null, frame.nameScopesList);
    return new _StateStackImpl(
      self2,
      ruleIdFromNumber(frame.ruleId),
      frame.enterPos ?? -1,
      frame.anchorPos ?? -1,
      frame.beginRuleCapturedEOL,
      frame.endRule,
      namesScopeList,
      AttributedScopeStack.fromExtension(namesScopeList, frame.contentNameScopesList)
    );
  }
};
var BalancedBracketSelectors = class {
  balancedBracketScopes;
  unbalancedBracketScopes;
  allowAny = false;
  constructor(balancedBracketScopes, unbalancedBracketScopes) {
    this.balancedBracketScopes = balancedBracketScopes.flatMap(
      (selector) => {
        if (selector === "*") {
          this.allowAny = true;
          return [];
        }
        return createMatchers(selector, nameMatcher).map((m3) => m3.matcher);
      }
    );
    this.unbalancedBracketScopes = unbalancedBracketScopes.flatMap(
      (selector) => createMatchers(selector, nameMatcher).map((m3) => m3.matcher)
    );
  }
  get matchesAlways() {
    return this.allowAny && this.unbalancedBracketScopes.length === 0;
  }
  get matchesNever() {
    return this.balancedBracketScopes.length === 0 && !this.allowAny;
  }
  match(scopes) {
    for (const excluder of this.unbalancedBracketScopes) {
      if (excluder(scopes)) {
        return false;
      }
    }
    for (const includer of this.balancedBracketScopes) {
      if (includer(scopes)) {
        return true;
      }
    }
    return this.allowAny;
  }
};
var LineTokens = class {
  constructor(emitBinaryTokens, lineText, tokenTypeOverrides, balancedBracketSelectors) {
    this.balancedBracketSelectors = balancedBracketSelectors;
    this._emitBinaryTokens = emitBinaryTokens;
    this._tokenTypeOverrides = tokenTypeOverrides;
    if (false) {
      this._lineText = lineText;
    } else {
      this._lineText = null;
    }
    this._tokens = [];
    this._binaryTokens = [];
    this._lastTokenEndIndex = 0;
  }
  _emitBinaryTokens;
  /**
   * defined only if `false`.
   */
  _lineText;
  /**
   * used only if `_emitBinaryTokens` is false.
   */
  _tokens;
  /**
   * used only if `_emitBinaryTokens` is true.
   */
  _binaryTokens;
  _lastTokenEndIndex;
  _tokenTypeOverrides;
  produce(stack, endIndex) {
    this.produceFromScopes(stack.contentNameScopesList, endIndex);
  }
  produceFromScopes(scopesList, endIndex) {
    if (this._lastTokenEndIndex >= endIndex) {
      return;
    }
    if (this._emitBinaryTokens) {
      let metadata = scopesList?.tokenAttributes ?? 0;
      let containsBalancedBrackets = false;
      if (this.balancedBracketSelectors?.matchesAlways) {
        containsBalancedBrackets = true;
      }
      if (this._tokenTypeOverrides.length > 0 || this.balancedBracketSelectors && !this.balancedBracketSelectors.matchesAlways && !this.balancedBracketSelectors.matchesNever) {
        const scopes2 = scopesList?.getScopeNames() ?? [];
        for (const tokenType of this._tokenTypeOverrides) {
          if (tokenType.matcher(scopes2)) {
            metadata = EncodedTokenMetadata.set(
              metadata,
              0,
              toOptionalTokenType(tokenType.type),
              null,
              -1,
              0,
              0
            );
          }
        }
        if (this.balancedBracketSelectors) {
          containsBalancedBrackets = this.balancedBracketSelectors.match(scopes2);
        }
      }
      if (containsBalancedBrackets) {
        metadata = EncodedTokenMetadata.set(
          metadata,
          0,
          8,
          containsBalancedBrackets,
          -1,
          0,
          0
        );
      }
      if (this._binaryTokens.length > 0 && this._binaryTokens[this._binaryTokens.length - 1] === metadata) {
        this._lastTokenEndIndex = endIndex;
        return;
      }
      this._binaryTokens.push(this._lastTokenEndIndex);
      this._binaryTokens.push(metadata);
      this._lastTokenEndIndex = endIndex;
      return;
    }
    const scopes = scopesList?.getScopeNames() ?? [];
    this._tokens.push({
      startIndex: this._lastTokenEndIndex,
      endIndex,
      // value: lineText.substring(lastTokenEndIndex, endIndex),
      scopes
    });
    this._lastTokenEndIndex = endIndex;
  }
  getResult(stack, lineLength) {
    if (this._tokens.length > 0 && this._tokens[this._tokens.length - 1].startIndex === lineLength - 1) {
      this._tokens.pop();
    }
    if (this._tokens.length === 0) {
      this._lastTokenEndIndex = -1;
      this.produce(stack, lineLength);
      this._tokens[this._tokens.length - 1].startIndex = 0;
    }
    return this._tokens;
  }
  getBinaryResult(stack, lineLength) {
    if (this._binaryTokens.length > 0 && this._binaryTokens[this._binaryTokens.length - 2] === lineLength - 1) {
      this._binaryTokens.pop();
      this._binaryTokens.pop();
    }
    if (this._binaryTokens.length === 0) {
      this._lastTokenEndIndex = -1;
      this.produce(stack, lineLength);
      this._binaryTokens[this._binaryTokens.length - 2] = 0;
    }
    const result = new Uint32Array(this._binaryTokens.length);
    for (let i2 = 0, len = this._binaryTokens.length; i2 < len; i2++) {
      result[i2] = this._binaryTokens[i2];
    }
    return result;
  }
};
var SyncRegistry = class {
  constructor(theme, _onigLib) {
    this._onigLib = _onigLib;
    this._theme = theme;
  }
  _grammars = /* @__PURE__ */ new Map();
  _rawGrammars = /* @__PURE__ */ new Map();
  _injectionGrammars = /* @__PURE__ */ new Map();
  _theme;
  dispose() {
    for (const grammar of this._grammars.values()) {
      grammar.dispose();
    }
  }
  setTheme(theme) {
    this._theme = theme;
  }
  getColorMap() {
    return this._theme.getColorMap();
  }
  /**
   * Add `grammar` to registry and return a list of referenced scope names
   */
  addGrammar(grammar, injectionScopeNames) {
    this._rawGrammars.set(grammar.scopeName, grammar);
    if (injectionScopeNames) {
      this._injectionGrammars.set(grammar.scopeName, injectionScopeNames);
    }
  }
  /**
   * Lookup a raw grammar.
   */
  lookup(scopeName) {
    return this._rawGrammars.get(scopeName);
  }
  /**
   * Returns the injections for the given grammar
   */
  injections(targetScope) {
    return this._injectionGrammars.get(targetScope);
  }
  /**
   * Get the default theme settings
   */
  getDefaults() {
    return this._theme.getDefaults();
  }
  /**
   * Match a scope in the theme.
   */
  themeMatch(scopePath) {
    return this._theme.match(scopePath);
  }
  /**
   * Lookup a grammar.
   */
  grammarForScopeName(scopeName, initialLanguage, embeddedLanguages, tokenTypes, balancedBracketSelectors) {
    if (!this._grammars.has(scopeName)) {
      let rawGrammar = this._rawGrammars.get(scopeName);
      if (!rawGrammar) {
        return null;
      }
      this._grammars.set(scopeName, createGrammar(
        scopeName,
        rawGrammar,
        initialLanguage,
        embeddedLanguages,
        tokenTypes,
        balancedBracketSelectors,
        this,
        this._onigLib
      ));
    }
    return this._grammars.get(scopeName);
  }
};
var Registry = class {
  _options;
  _syncRegistry;
  _ensureGrammarCache;
  constructor(options) {
    this._options = options;
    this._syncRegistry = new SyncRegistry(
      Theme.createFromRawTheme(options.theme, options.colorMap),
      options.onigLib
    );
    this._ensureGrammarCache = /* @__PURE__ */ new Map();
  }
  dispose() {
    this._syncRegistry.dispose();
  }
  /**
   * Change the theme. Once called, no previous `ruleStack` should be used anymore.
   */
  setTheme(theme, colorMap) {
    this._syncRegistry.setTheme(Theme.createFromRawTheme(theme, colorMap));
  }
  /**
   * Returns a lookup array for color ids.
   */
  getColorMap() {
    return this._syncRegistry.getColorMap();
  }
  /**
   * Load the grammar for `scopeName` and all referenced included grammars asynchronously.
   * Please do not use language id 0.
   */
  loadGrammarWithEmbeddedLanguages(initialScopeName, initialLanguage, embeddedLanguages) {
    return this.loadGrammarWithConfiguration(initialScopeName, initialLanguage, { embeddedLanguages });
  }
  /**
   * Load the grammar for `scopeName` and all referenced included grammars asynchronously.
   * Please do not use language id 0.
   */
  loadGrammarWithConfiguration(initialScopeName, initialLanguage, configuration) {
    return this._loadGrammar(
      initialScopeName,
      initialLanguage,
      configuration.embeddedLanguages,
      configuration.tokenTypes,
      new BalancedBracketSelectors(
        configuration.balancedBracketSelectors || [],
        configuration.unbalancedBracketSelectors || []
      )
    );
  }
  /**
   * Load the grammar for `scopeName` and all referenced included grammars asynchronously.
   */
  loadGrammar(initialScopeName) {
    return this._loadGrammar(initialScopeName, 0, null, null, null);
  }
  _loadGrammar(initialScopeName, initialLanguage, embeddedLanguages, tokenTypes, balancedBracketSelectors) {
    const dependencyProcessor = new ScopeDependencyProcessor(this._syncRegistry, initialScopeName);
    while (dependencyProcessor.Q.length > 0) {
      dependencyProcessor.Q.map((request) => this._loadSingleGrammar(request.scopeName));
      dependencyProcessor.processQueue();
    }
    return this._grammarForScopeName(
      initialScopeName,
      initialLanguage,
      embeddedLanguages,
      tokenTypes,
      balancedBracketSelectors
    );
  }
  _loadSingleGrammar(scopeName) {
    if (!this._ensureGrammarCache.has(scopeName)) {
      this._doLoadSingleGrammar(scopeName);
      this._ensureGrammarCache.set(scopeName, true);
    }
  }
  _doLoadSingleGrammar(scopeName) {
    const grammar = this._options.loadGrammar(scopeName);
    if (grammar) {
      const injections = typeof this._options.getInjections === "function" ? this._options.getInjections(scopeName) : void 0;
      this._syncRegistry.addGrammar(grammar, injections);
    }
  }
  /**
   * Adds a rawGrammar.
   */
  addGrammar(rawGrammar, injections = [], initialLanguage = 0, embeddedLanguages = null) {
    this._syncRegistry.addGrammar(rawGrammar, injections);
    return this._grammarForScopeName(rawGrammar.scopeName, initialLanguage, embeddedLanguages);
  }
  /**
   * Get the grammar for `scopeName`. The grammar must first be created via `loadGrammar` or `addGrammar`.
   */
  _grammarForScopeName(scopeName, initialLanguage = 0, embeddedLanguages = null, tokenTypes = null, balancedBracketSelectors = null) {
    return this._syncRegistry.grammarForScopeName(
      scopeName,
      initialLanguage,
      embeddedLanguages,
      tokenTypes,
      balancedBracketSelectors
    );
  }
};
var INITIAL = StateStackImpl.NULL;

// node_modules/.pnpm/html-void-elements@3.0.0/node_modules/html-void-elements/index.js
var htmlVoidElements = [
  "area",
  "base",
  "basefont",
  "bgsound",
  "br",
  "col",
  "command",
  "embed",
  "frame",
  "hr",
  "image",
  "img",
  "input",
  "keygen",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
];

// node_modules/.pnpm/zwitch@2.0.4/node_modules/zwitch/index.js
var own = {}.hasOwnProperty;
function zwitch(key2, options) {
  const settings = options || {};
  function one2(value, ...parameters) {
    let fn = one2.invalid;
    const handlers = one2.handlers;
    if (value && own.call(value, key2)) {
      const id = String(value[key2]);
      fn = own.call(handlers, id) ? handlers[id] : one2.unknown;
    }
    if (fn) {
      return fn.call(this, value, ...parameters);
    }
  }
  one2.handlers = settings.handlers || {};
  one2.invalid = settings.invalid;
  one2.unknown = settings.unknown;
  return one2;
}

// node_modules/.pnpm/stringify-entities@4.0.4/node_modules/stringify-entities/lib/core.js
var defaultSubsetRegex = /["&'<>`]/g;
var surrogatePairsRegex = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
var controlCharactersRegex = (
  // eslint-disable-next-line no-control-regex, unicorn/no-hex-escape
  /[\x01-\t\v\f\x0E-\x1F\x7F\x81\x8D\x8F\x90\x9D\xA0-\uFFFF]/g
);
var regexEscapeRegex = /[|\\{}()[\]^$+*?.]/g;
var subsetToRegexCache = /* @__PURE__ */ new WeakMap();
function core(value, options) {
  value = value.replace(
    options.subset ? charactersToExpressionCached(options.subset) : defaultSubsetRegex,
    basic
  );
  if (options.subset || options.escapeOnly) {
    return value;
  }
  return value.replace(surrogatePairsRegex, surrogate).replace(controlCharactersRegex, basic);
  function surrogate(pair, index, all2) {
    return options.format(
      (pair.charCodeAt(0) - 55296) * 1024 + pair.charCodeAt(1) - 56320 + 65536,
      all2.charCodeAt(index + 2),
      options
    );
  }
  function basic(character, index, all2) {
    return options.format(
      character.charCodeAt(0),
      all2.charCodeAt(index + 1),
      options
    );
  }
}
function charactersToExpressionCached(subset) {
  let cached = subsetToRegexCache.get(subset);
  if (!cached) {
    cached = charactersToExpression(subset);
    subsetToRegexCache.set(subset, cached);
  }
  return cached;
}
function charactersToExpression(subset) {
  const groups = [];
  let index = -1;
  while (++index < subset.length) {
    groups.push(subset[index].replace(regexEscapeRegex, "\\$&"));
  }
  return new RegExp("(?:" + groups.join("|") + ")", "g");
}

// node_modules/.pnpm/stringify-entities@4.0.4/node_modules/stringify-entities/lib/util/to-hexadecimal.js
var hexadecimalRegex = /[\dA-Fa-f]/;
function toHexadecimal(code, next, omit) {
  const value = "&#x" + code.toString(16).toUpperCase();
  return omit && next && !hexadecimalRegex.test(String.fromCharCode(next)) ? value : value + ";";
}

// node_modules/.pnpm/stringify-entities@4.0.4/node_modules/stringify-entities/lib/util/to-decimal.js
var decimalRegex = /\d/;
function toDecimal(code, next, omit) {
  const value = "&#" + String(code);
  return omit && next && !decimalRegex.test(String.fromCharCode(next)) ? value : value + ";";
}

// node_modules/.pnpm/character-entities-legacy@3.0.0/node_modules/character-entities-legacy/index.js
var characterEntitiesLegacy = [
  "AElig",
  "AMP",
  "Aacute",
  "Acirc",
  "Agrave",
  "Aring",
  "Atilde",
  "Auml",
  "COPY",
  "Ccedil",
  "ETH",
  "Eacute",
  "Ecirc",
  "Egrave",
  "Euml",
  "GT",
  "Iacute",
  "Icirc",
  "Igrave",
  "Iuml",
  "LT",
  "Ntilde",
  "Oacute",
  "Ocirc",
  "Ograve",
  "Oslash",
  "Otilde",
  "Ouml",
  "QUOT",
  "REG",
  "THORN",
  "Uacute",
  "Ucirc",
  "Ugrave",
  "Uuml",
  "Yacute",
  "aacute",
  "acirc",
  "acute",
  "aelig",
  "agrave",
  "amp",
  "aring",
  "atilde",
  "auml",
  "brvbar",
  "ccedil",
  "cedil",
  "cent",
  "copy",
  "curren",
  "deg",
  "divide",
  "eacute",
  "ecirc",
  "egrave",
  "eth",
  "euml",
  "frac12",
  "frac14",
  "frac34",
  "gt",
  "iacute",
  "icirc",
  "iexcl",
  "igrave",
  "iquest",
  "iuml",
  "laquo",
  "lt",
  "macr",
  "micro",
  "middot",
  "nbsp",
  "not",
  "ntilde",
  "oacute",
  "ocirc",
  "ograve",
  "ordf",
  "ordm",
  "oslash",
  "otilde",
  "ouml",
  "para",
  "plusmn",
  "pound",
  "quot",
  "raquo",
  "reg",
  "sect",
  "shy",
  "sup1",
  "sup2",
  "sup3",
  "szlig",
  "thorn",
  "times",
  "uacute",
  "ucirc",
  "ugrave",
  "uml",
  "uuml",
  "yacute",
  "yen",
  "yuml"
];

// node_modules/.pnpm/character-entities-html4@2.1.0/node_modules/character-entities-html4/index.js
var characterEntitiesHtml4 = {
  nbsp: "\xA0",
  iexcl: "\xA1",
  cent: "\xA2",
  pound: "\xA3",
  curren: "\xA4",
  yen: "\xA5",
  brvbar: "\xA6",
  sect: "\xA7",
  uml: "\xA8",
  copy: "\xA9",
  ordf: "\xAA",
  laquo: "\xAB",
  not: "\xAC",
  shy: "\xAD",
  reg: "\xAE",
  macr: "\xAF",
  deg: "\xB0",
  plusmn: "\xB1",
  sup2: "\xB2",
  sup3: "\xB3",
  acute: "\xB4",
  micro: "\xB5",
  para: "\xB6",
  middot: "\xB7",
  cedil: "\xB8",
  sup1: "\xB9",
  ordm: "\xBA",
  raquo: "\xBB",
  frac14: "\xBC",
  frac12: "\xBD",
  frac34: "\xBE",
  iquest: "\xBF",
  Agrave: "\xC0",
  Aacute: "\xC1",
  Acirc: "\xC2",
  Atilde: "\xC3",
  Auml: "\xC4",
  Aring: "\xC5",
  AElig: "\xC6",
  Ccedil: "\xC7",
  Egrave: "\xC8",
  Eacute: "\xC9",
  Ecirc: "\xCA",
  Euml: "\xCB",
  Igrave: "\xCC",
  Iacute: "\xCD",
  Icirc: "\xCE",
  Iuml: "\xCF",
  ETH: "\xD0",
  Ntilde: "\xD1",
  Ograve: "\xD2",
  Oacute: "\xD3",
  Ocirc: "\xD4",
  Otilde: "\xD5",
  Ouml: "\xD6",
  times: "\xD7",
  Oslash: "\xD8",
  Ugrave: "\xD9",
  Uacute: "\xDA",
  Ucirc: "\xDB",
  Uuml: "\xDC",
  Yacute: "\xDD",
  THORN: "\xDE",
  szlig: "\xDF",
  agrave: "\xE0",
  aacute: "\xE1",
  acirc: "\xE2",
  atilde: "\xE3",
  auml: "\xE4",
  aring: "\xE5",
  aelig: "\xE6",
  ccedil: "\xE7",
  egrave: "\xE8",
  eacute: "\xE9",
  ecirc: "\xEA",
  euml: "\xEB",
  igrave: "\xEC",
  iacute: "\xED",
  icirc: "\xEE",
  iuml: "\xEF",
  eth: "\xF0",
  ntilde: "\xF1",
  ograve: "\xF2",
  oacute: "\xF3",
  ocirc: "\xF4",
  otilde: "\xF5",
  ouml: "\xF6",
  divide: "\xF7",
  oslash: "\xF8",
  ugrave: "\xF9",
  uacute: "\xFA",
  ucirc: "\xFB",
  uuml: "\xFC",
  yacute: "\xFD",
  thorn: "\xFE",
  yuml: "\xFF",
  fnof: "\u0192",
  Alpha: "\u0391",
  Beta: "\u0392",
  Gamma: "\u0393",
  Delta: "\u0394",
  Epsilon: "\u0395",
  Zeta: "\u0396",
  Eta: "\u0397",
  Theta: "\u0398",
  Iota: "\u0399",
  Kappa: "\u039A",
  Lambda: "\u039B",
  Mu: "\u039C",
  Nu: "\u039D",
  Xi: "\u039E",
  Omicron: "\u039F",
  Pi: "\u03A0",
  Rho: "\u03A1",
  Sigma: "\u03A3",
  Tau: "\u03A4",
  Upsilon: "\u03A5",
  Phi: "\u03A6",
  Chi: "\u03A7",
  Psi: "\u03A8",
  Omega: "\u03A9",
  alpha: "\u03B1",
  beta: "\u03B2",
  gamma: "\u03B3",
  delta: "\u03B4",
  epsilon: "\u03B5",
  zeta: "\u03B6",
  eta: "\u03B7",
  theta: "\u03B8",
  iota: "\u03B9",
  kappa: "\u03BA",
  lambda: "\u03BB",
  mu: "\u03BC",
  nu: "\u03BD",
  xi: "\u03BE",
  omicron: "\u03BF",
  pi: "\u03C0",
  rho: "\u03C1",
  sigmaf: "\u03C2",
  sigma: "\u03C3",
  tau: "\u03C4",
  upsilon: "\u03C5",
  phi: "\u03C6",
  chi: "\u03C7",
  psi: "\u03C8",
  omega: "\u03C9",
  thetasym: "\u03D1",
  upsih: "\u03D2",
  piv: "\u03D6",
  bull: "\u2022",
  hellip: "\u2026",
  prime: "\u2032",
  Prime: "\u2033",
  oline: "\u203E",
  frasl: "\u2044",
  weierp: "\u2118",
  image: "\u2111",
  real: "\u211C",
  trade: "\u2122",
  alefsym: "\u2135",
  larr: "\u2190",
  uarr: "\u2191",
  rarr: "\u2192",
  darr: "\u2193",
  harr: "\u2194",
  crarr: "\u21B5",
  lArr: "\u21D0",
  uArr: "\u21D1",
  rArr: "\u21D2",
  dArr: "\u21D3",
  hArr: "\u21D4",
  forall: "\u2200",
  part: "\u2202",
  exist: "\u2203",
  empty: "\u2205",
  nabla: "\u2207",
  isin: "\u2208",
  notin: "\u2209",
  ni: "\u220B",
  prod: "\u220F",
  sum: "\u2211",
  minus: "\u2212",
  lowast: "\u2217",
  radic: "\u221A",
  prop: "\u221D",
  infin: "\u221E",
  ang: "\u2220",
  and: "\u2227",
  or: "\u2228",
  cap: "\u2229",
  cup: "\u222A",
  int: "\u222B",
  there4: "\u2234",
  sim: "\u223C",
  cong: "\u2245",
  asymp: "\u2248",
  ne: "\u2260",
  equiv: "\u2261",
  le: "\u2264",
  ge: "\u2265",
  sub: "\u2282",
  sup: "\u2283",
  nsub: "\u2284",
  sube: "\u2286",
  supe: "\u2287",
  oplus: "\u2295",
  otimes: "\u2297",
  perp: "\u22A5",
  sdot: "\u22C5",
  lceil: "\u2308",
  rceil: "\u2309",
  lfloor: "\u230A",
  rfloor: "\u230B",
  lang: "\u2329",
  rang: "\u232A",
  loz: "\u25CA",
  spades: "\u2660",
  clubs: "\u2663",
  hearts: "\u2665",
  diams: "\u2666",
  quot: '"',
  amp: "&",
  lt: "<",
  gt: ">",
  OElig: "\u0152",
  oelig: "\u0153",
  Scaron: "\u0160",
  scaron: "\u0161",
  Yuml: "\u0178",
  circ: "\u02C6",
  tilde: "\u02DC",
  ensp: "\u2002",
  emsp: "\u2003",
  thinsp: "\u2009",
  zwnj: "\u200C",
  zwj: "\u200D",
  lrm: "\u200E",
  rlm: "\u200F",
  ndash: "\u2013",
  mdash: "\u2014",
  lsquo: "\u2018",
  rsquo: "\u2019",
  sbquo: "\u201A",
  ldquo: "\u201C",
  rdquo: "\u201D",
  bdquo: "\u201E",
  dagger: "\u2020",
  Dagger: "\u2021",
  permil: "\u2030",
  lsaquo: "\u2039",
  rsaquo: "\u203A",
  euro: "\u20AC"
};

// node_modules/.pnpm/stringify-entities@4.0.4/node_modules/stringify-entities/lib/constant/dangerous.js
var dangerous = [
  "cent",
  "copy",
  "divide",
  "gt",
  "lt",
  "not",
  "para",
  "times"
];

// node_modules/.pnpm/stringify-entities@4.0.4/node_modules/stringify-entities/lib/util/to-named.js
var own2 = {}.hasOwnProperty;
var characters = {};
var key;
for (key in characterEntitiesHtml4) {
  if (own2.call(characterEntitiesHtml4, key)) {
    characters[characterEntitiesHtml4[key]] = key;
  }
}
var notAlphanumericRegex = /[^\dA-Za-z]/;
function toNamed(code, next, omit, attribute) {
  const character = String.fromCharCode(code);
  if (own2.call(characters, character)) {
    const name = characters[character];
    const value = "&" + name;
    if (omit && characterEntitiesLegacy.includes(name) && !dangerous.includes(name) && (!attribute || next && next !== 61 && notAlphanumericRegex.test(String.fromCharCode(next)))) {
      return value;
    }
    return value + ";";
  }
  return "";
}

// node_modules/.pnpm/stringify-entities@4.0.4/node_modules/stringify-entities/lib/util/format-smart.js
function formatSmart(code, next, options) {
  let numeric = toHexadecimal(code, next, options.omitOptionalSemicolons);
  let named;
  if (options.useNamedReferences || options.useShortestReferences) {
    named = toNamed(
      code,
      next,
      options.omitOptionalSemicolons,
      options.attribute
    );
  }
  if ((options.useShortestReferences || !named) && options.useShortestReferences) {
    const decimal = toDecimal(code, next, options.omitOptionalSemicolons);
    if (decimal.length < numeric.length) {
      numeric = decimal;
    }
  }
  return named && (!options.useShortestReferences || named.length < numeric.length) ? named : numeric;
}

// node_modules/.pnpm/stringify-entities@4.0.4/node_modules/stringify-entities/lib/index.js
function stringifyEntities(value, options) {
  return core(value, Object.assign({ format: formatSmart }, options));
}

// node_modules/.pnpm/hast-util-to-html@9.0.5/node_modules/hast-util-to-html/lib/handle/comment.js
var htmlCommentRegex = /^>|^->|<!--|-->|--!>|<!-$/g;
var bogusCommentEntitySubset = [">"];
var commentEntitySubset = ["<", ">"];
function comment(node, _1, _22, state) {
  return state.settings.bogusComments ? "<?" + stringifyEntities(
    node.value,
    Object.assign({}, state.settings.characterReferences, {
      subset: bogusCommentEntitySubset
    })
  ) + ">" : "<!--" + node.value.replace(htmlCommentRegex, encode) + "-->";
  function encode($0) {
    return stringifyEntities(
      $0,
      Object.assign({}, state.settings.characterReferences, {
        subset: commentEntitySubset
      })
    );
  }
}

// node_modules/.pnpm/hast-util-to-html@9.0.5/node_modules/hast-util-to-html/lib/handle/doctype.js
function doctype(_1, _22, _3, state) {
  return "<!" + (state.settings.upperDoctype ? "DOCTYPE" : "doctype") + (state.settings.tightDoctype ? "" : " ") + "html>";
}

// node_modules/.pnpm/hast-util-to-html@9.0.5/node_modules/hast-util-to-html/lib/omission/util/siblings.js
var siblingAfter = siblings(1);
var siblingBefore = siblings(-1);
var emptyChildren = [];
function siblings(increment) {
  return sibling;
  function sibling(parent, index, includeWhitespace) {
    const siblings2 = parent ? parent.children : emptyChildren;
    let offset = (index || 0) + increment;
    let next = siblings2[offset];
    if (!includeWhitespace) {
      while (next && whitespace(next)) {
        offset += increment;
        next = siblings2[offset];
      }
    }
    return next;
  }
}

// node_modules/.pnpm/hast-util-to-html@9.0.5/node_modules/hast-util-to-html/lib/omission/omission.js
var own3 = {}.hasOwnProperty;
function omission(handlers) {
  return omit;
  function omit(node, index, parent) {
    return own3.call(handlers, node.tagName) && handlers[node.tagName](node, index, parent);
  }
}

// node_modules/.pnpm/hast-util-to-html@9.0.5/node_modules/hast-util-to-html/lib/omission/closing.js
var closing = omission({
  body,
  caption: headOrColgroupOrCaption,
  colgroup: headOrColgroupOrCaption,
  dd,
  dt,
  head: headOrColgroupOrCaption,
  html: html2,
  li,
  optgroup,
  option,
  p,
  rp: rubyElement,
  rt: rubyElement,
  tbody,
  td: cells,
  tfoot,
  th: cells,
  thead,
  tr
});
function headOrColgroupOrCaption(_3, index, parent) {
  const next = siblingAfter(parent, index, true);
  return !next || next.type !== "comment" && !(next.type === "text" && whitespace(next.value.charAt(0)));
}
function html2(_3, index, parent) {
  const next = siblingAfter(parent, index);
  return !next || next.type !== "comment";
}
function body(_3, index, parent) {
  const next = siblingAfter(parent, index);
  return !next || next.type !== "comment";
}
function p(_3, index, parent) {
  const next = siblingAfter(parent, index);
  return next ? next.type === "element" && (next.tagName === "address" || next.tagName === "article" || next.tagName === "aside" || next.tagName === "blockquote" || next.tagName === "details" || next.tagName === "div" || next.tagName === "dl" || next.tagName === "fieldset" || next.tagName === "figcaption" || next.tagName === "figure" || next.tagName === "footer" || next.tagName === "form" || next.tagName === "h1" || next.tagName === "h2" || next.tagName === "h3" || next.tagName === "h4" || next.tagName === "h5" || next.tagName === "h6" || next.tagName === "header" || next.tagName === "hgroup" || next.tagName === "hr" || next.tagName === "main" || next.tagName === "menu" || next.tagName === "nav" || next.tagName === "ol" || next.tagName === "p" || next.tagName === "pre" || next.tagName === "section" || next.tagName === "table" || next.tagName === "ul") : !parent || // Confusing parent.
  !(parent.type === "element" && (parent.tagName === "a" || parent.tagName === "audio" || parent.tagName === "del" || parent.tagName === "ins" || parent.tagName === "map" || parent.tagName === "noscript" || parent.tagName === "video"));
}
function li(_3, index, parent) {
  const next = siblingAfter(parent, index);
  return !next || next.type === "element" && next.tagName === "li";
}
function dt(_3, index, parent) {
  const next = siblingAfter(parent, index);
  return Boolean(
    next && next.type === "element" && (next.tagName === "dt" || next.tagName === "dd")
  );
}
function dd(_3, index, parent) {
  const next = siblingAfter(parent, index);
  return !next || next.type === "element" && (next.tagName === "dt" || next.tagName === "dd");
}
function rubyElement(_3, index, parent) {
  const next = siblingAfter(parent, index);
  return !next || next.type === "element" && (next.tagName === "rp" || next.tagName === "rt");
}
function optgroup(_3, index, parent) {
  const next = siblingAfter(parent, index);
  return !next || next.type === "element" && next.tagName === "optgroup";
}
function option(_3, index, parent) {
  const next = siblingAfter(parent, index);
  return !next || next.type === "element" && (next.tagName === "option" || next.tagName === "optgroup");
}
function thead(_3, index, parent) {
  const next = siblingAfter(parent, index);
  return Boolean(
    next && next.type === "element" && (next.tagName === "tbody" || next.tagName === "tfoot")
  );
}
function tbody(_3, index, parent) {
  const next = siblingAfter(parent, index);
  return !next || next.type === "element" && (next.tagName === "tbody" || next.tagName === "tfoot");
}
function tfoot(_3, index, parent) {
  return !siblingAfter(parent, index);
}
function tr(_3, index, parent) {
  const next = siblingAfter(parent, index);
  return !next || next.type === "element" && next.tagName === "tr";
}
function cells(_3, index, parent) {
  const next = siblingAfter(parent, index);
  return !next || next.type === "element" && (next.tagName === "td" || next.tagName === "th");
}

// node_modules/.pnpm/hast-util-to-html@9.0.5/node_modules/hast-util-to-html/lib/omission/opening.js
var opening = omission({
  body: body2,
  colgroup,
  head,
  html: html3,
  tbody: tbody2
});
function html3(node) {
  const head2 = siblingAfter(node, -1);
  return !head2 || head2.type !== "comment";
}
function head(node) {
  const seen = /* @__PURE__ */ new Set();
  for (const child2 of node.children) {
    if (child2.type === "element" && (child2.tagName === "base" || child2.tagName === "title")) {
      if (seen.has(child2.tagName)) return false;
      seen.add(child2.tagName);
    }
  }
  const child = node.children[0];
  return !child || child.type === "element";
}
function body2(node) {
  const head2 = siblingAfter(node, -1, true);
  return !head2 || head2.type !== "comment" && !(head2.type === "text" && whitespace(head2.value.charAt(0))) && !(head2.type === "element" && (head2.tagName === "meta" || head2.tagName === "link" || head2.tagName === "script" || head2.tagName === "style" || head2.tagName === "template"));
}
function colgroup(node, index, parent) {
  const previous = siblingBefore(parent, index);
  const head2 = siblingAfter(node, -1, true);
  if (parent && previous && previous.type === "element" && previous.tagName === "colgroup" && closing(previous, parent.children.indexOf(previous), parent)) {
    return false;
  }
  return Boolean(head2 && head2.type === "element" && head2.tagName === "col");
}
function tbody2(node, index, parent) {
  const previous = siblingBefore(parent, index);
  const head2 = siblingAfter(node, -1);
  if (parent && previous && previous.type === "element" && (previous.tagName === "thead" || previous.tagName === "tbody") && closing(previous, parent.children.indexOf(previous), parent)) {
    return false;
  }
  return Boolean(head2 && head2.type === "element" && head2.tagName === "tr");
}

// node_modules/.pnpm/hast-util-to-html@9.0.5/node_modules/hast-util-to-html/lib/handle/element.js
var constants = {
  // See: <https://html.spec.whatwg.org/#attribute-name-state>.
  name: [
    ["	\n\f\r &/=>".split(""), "	\n\f\r \"&'/=>`".split("")],
    [`\0	
\f\r "&'/<=>`.split(""), "\0	\n\f\r \"&'/<=>`".split("")]
  ],
  // See: <https://html.spec.whatwg.org/#attribute-value-(unquoted)-state>.
  unquoted: [
    ["	\n\f\r &>".split(""), "\0	\n\f\r \"&'<=>`".split("")],
    ["\0	\n\f\r \"&'<=>`".split(""), "\0	\n\f\r \"&'<=>`".split("")]
  ],
  // See: <https://html.spec.whatwg.org/#attribute-value-(single-quoted)-state>.
  single: [
    ["&'".split(""), "\"&'`".split("")],
    ["\0&'".split(""), "\0\"&'`".split("")]
  ],
  // See: <https://html.spec.whatwg.org/#attribute-value-(double-quoted)-state>.
  double: [
    ['"&'.split(""), "\"&'`".split("")],
    ['\0"&'.split(""), "\0\"&'`".split("")]
  ]
};
function element(node, index, parent, state) {
  const schema = state.schema;
  const omit = schema.space === "svg" ? false : state.settings.omitOptionalTags;
  let selfClosing = schema.space === "svg" ? state.settings.closeEmptyElements : state.settings.voids.includes(node.tagName.toLowerCase());
  const parts = [];
  let last;
  if (schema.space === "html" && node.tagName === "svg") {
    state.schema = svg;
  }
  const attributes = serializeAttributes(state, node.properties);
  const content = state.all(
    schema.space === "html" && node.tagName === "template" ? node.content : node
  );
  state.schema = schema;
  if (content) selfClosing = false;
  if (attributes || !omit || !opening(node, index, parent)) {
    parts.push("<", node.tagName, attributes ? " " + attributes : "");
    if (selfClosing && (schema.space === "svg" || state.settings.closeSelfClosing)) {
      last = attributes.charAt(attributes.length - 1);
      if (!state.settings.tightSelfClosing || last === "/" || last && last !== '"' && last !== "'") {
        parts.push(" ");
      }
      parts.push("/");
    }
    parts.push(">");
  }
  parts.push(content);
  if (!selfClosing && (!omit || !closing(node, index, parent))) {
    parts.push("</" + node.tagName + ">");
  }
  return parts.join("");
}
function serializeAttributes(state, properties) {
  const values = [];
  let index = -1;
  let key2;
  if (properties) {
    for (key2 in properties) {
      if (properties[key2] !== null && properties[key2] !== void 0) {
        const value = serializeAttribute(state, key2, properties[key2]);
        if (value) values.push(value);
      }
    }
  }
  while (++index < values.length) {
    const last = state.settings.tightAttributes ? values[index].charAt(values[index].length - 1) : void 0;
    if (index !== values.length - 1 && last !== '"' && last !== "'") {
      values[index] += " ";
    }
  }
  return values.join("");
}
function serializeAttribute(state, key2, value) {
  const info = find(state.schema, key2);
  const x3 = state.settings.allowParseErrors && state.schema.space === "html" ? 0 : 1;
  const y3 = state.settings.allowDangerousCharacters ? 0 : 1;
  let quote = state.quote;
  let result;
  if (info.overloadedBoolean && (value === info.attribute || value === "")) {
    value = true;
  } else if ((info.boolean || info.overloadedBoolean) && (typeof value !== "string" || value === info.attribute || value === "")) {
    value = Boolean(value);
  }
  if (value === null || value === void 0 || value === false || typeof value === "number" && Number.isNaN(value)) {
    return "";
  }
  const name = stringifyEntities(
    info.attribute,
    Object.assign({}, state.settings.characterReferences, {
      // Always encode without parse errors in non-HTML.
      subset: constants.name[x3][y3]
    })
  );
  if (value === true) return name;
  value = Array.isArray(value) ? (info.commaSeparated ? stringify : stringify2)(value, {
    padLeft: !state.settings.tightCommaSeparatedLists
  }) : String(value);
  if (state.settings.collapseEmptyAttributes && !value) return name;
  if (state.settings.preferUnquoted) {
    result = stringifyEntities(
      value,
      Object.assign({}, state.settings.characterReferences, {
        attribute: true,
        subset: constants.unquoted[x3][y3]
      })
    );
  }
  if (result !== value) {
    if (state.settings.quoteSmart && ccount(value, quote) > ccount(value, state.alternative)) {
      quote = state.alternative;
    }
    result = quote + stringifyEntities(
      value,
      Object.assign({}, state.settings.characterReferences, {
        // Always encode without parse errors in non-HTML.
        subset: (quote === "'" ? constants.single : constants.double)[x3][y3],
        attribute: true
      })
    ) + quote;
  }
  return name + (result ? "=" + result : result);
}

// node_modules/.pnpm/hast-util-to-html@9.0.5/node_modules/hast-util-to-html/lib/handle/text.js
var textEntitySubset = ["<", "&"];
function text(node, _3, parent, state) {
  return parent && parent.type === "element" && (parent.tagName === "script" || parent.tagName === "style") ? node.value : stringifyEntities(
    node.value,
    Object.assign({}, state.settings.characterReferences, {
      subset: textEntitySubset
    })
  );
}

// node_modules/.pnpm/hast-util-to-html@9.0.5/node_modules/hast-util-to-html/lib/handle/raw.js
function raw(node, index, parent, state) {
  return state.settings.allowDangerousHtml ? node.value : text(node, index, parent, state);
}

// node_modules/.pnpm/hast-util-to-html@9.0.5/node_modules/hast-util-to-html/lib/handle/root.js
function root(node, _1, _22, state) {
  return state.all(node);
}

// node_modules/.pnpm/hast-util-to-html@9.0.5/node_modules/hast-util-to-html/lib/handle/index.js
var handle = zwitch("type", {
  invalid,
  unknown,
  handlers: { comment, doctype, element, raw, root, text }
});
function invalid(node) {
  throw new Error("Expected node, not `" + node + "`");
}
function unknown(node_) {
  const node = (
    /** @type {Nodes} */
    node_
  );
  throw new Error("Cannot compile unknown node `" + node.type + "`");
}

// node_modules/.pnpm/hast-util-to-html@9.0.5/node_modules/hast-util-to-html/lib/index.js
var emptyOptions = {};
var emptyCharacterReferences = {};
var emptyChildren2 = [];
function toHtml(tree, options) {
  const options_ = options || emptyOptions;
  const quote = options_.quote || '"';
  const alternative = quote === '"' ? "'" : '"';
  if (quote !== '"' && quote !== "'") {
    throw new Error("Invalid quote `" + quote + "`, expected `'` or `\"`");
  }
  const state = {
    one,
    all,
    settings: {
      omitOptionalTags: options_.omitOptionalTags || false,
      allowParseErrors: options_.allowParseErrors || false,
      allowDangerousCharacters: options_.allowDangerousCharacters || false,
      quoteSmart: options_.quoteSmart || false,
      preferUnquoted: options_.preferUnquoted || false,
      tightAttributes: options_.tightAttributes || false,
      upperDoctype: options_.upperDoctype || false,
      tightDoctype: options_.tightDoctype || false,
      bogusComments: options_.bogusComments || false,
      tightCommaSeparatedLists: options_.tightCommaSeparatedLists || false,
      tightSelfClosing: options_.tightSelfClosing || false,
      collapseEmptyAttributes: options_.collapseEmptyAttributes || false,
      allowDangerousHtml: options_.allowDangerousHtml || false,
      voids: options_.voids || htmlVoidElements,
      characterReferences: options_.characterReferences || emptyCharacterReferences,
      closeSelfClosing: options_.closeSelfClosing || false,
      closeEmptyElements: options_.closeEmptyElements || false
    },
    schema: options_.space === "svg" ? svg : html,
    quote,
    alternative
  };
  return state.one(
    Array.isArray(tree) ? { type: "root", children: tree } : tree,
    void 0,
    void 0
  );
}
function one(node, index, parent) {
  return handle(node, index, parent, this);
}
function all(parent) {
  const results = [];
  const children = parent && parent.children || emptyChildren2;
  let index = -1;
  while (++index < children.length) {
    results[index] = this.one(children[index], index, parent);
  }
  return results.join("");
}

// node_modules/.pnpm/@shikijs+core@3.23.0/node_modules/@shikijs/core/dist/index.mjs
function resolveColorReplacements(theme, options) {
  const replacements = typeof theme === "string" ? {} : { ...theme.colorReplacements };
  const themeName = typeof theme === "string" ? theme : theme.name;
  for (const [key2, value] of Object.entries(options?.colorReplacements || {})) {
    if (typeof value === "string")
      replacements[key2] = value;
    else if (key2 === themeName)
      Object.assign(replacements, value);
  }
  return replacements;
}
function applyColorReplacements(color, replacements) {
  if (!color)
    return color;
  return replacements?.[color?.toLowerCase()] || color;
}
function toArray(x3) {
  return Array.isArray(x3) ? x3 : [x3];
}
async function normalizeGetter(p2) {
  return Promise.resolve(typeof p2 === "function" ? p2() : p2).then((r4) => r4.default || r4);
}
function isPlainLang(lang) {
  return !lang || ["plaintext", "txt", "text", "plain"].includes(lang);
}
function isSpecialLang(lang) {
  return lang === "ansi" || isPlainLang(lang);
}
function isNoneTheme(theme) {
  return theme === "none";
}
function isSpecialTheme(theme) {
  return isNoneTheme(theme);
}
function addClassToHast(node, className) {
  if (!className)
    return node;
  node.properties ||= {};
  node.properties.class ||= [];
  if (typeof node.properties.class === "string")
    node.properties.class = node.properties.class.split(/\s+/g);
  if (!Array.isArray(node.properties.class))
    node.properties.class = [];
  const targets = Array.isArray(className) ? className : className.split(/\s+/g);
  for (const c of targets) {
    if (c && !node.properties.class.includes(c))
      node.properties.class.push(c);
  }
  return node;
}
function splitLines(code, preserveEnding = false) {
  if (code.length === 0) {
    return [["", 0]];
  }
  const parts = code.split(/(\r?\n)/g);
  let index = 0;
  const lines = [];
  for (let i2 = 0; i2 < parts.length; i2 += 2) {
    const line = preserveEnding ? parts[i2] + (parts[i2 + 1] || "") : parts[i2];
    lines.push([line, index]);
    index += parts[i2].length;
    index += parts[i2 + 1]?.length || 0;
  }
  return lines;
}
function createPositionConverter(code) {
  const lines = splitLines(code, true).map(([line]) => line);
  function indexToPos(index) {
    if (index === code.length) {
      return {
        line: lines.length - 1,
        character: lines[lines.length - 1].length
      };
    }
    let character = index;
    let line = 0;
    for (const lineText of lines) {
      if (character < lineText.length)
        break;
      character -= lineText.length;
      line++;
    }
    return { line, character };
  }
  function posToIndex(line, character) {
    let index = 0;
    for (let i2 = 0; i2 < line; i2++)
      index += lines[i2].length;
    index += character;
    return index;
  }
  return {
    lines,
    indexToPos,
    posToIndex
  };
}
function guessEmbeddedLanguages(code, _lang, highlighter2) {
  const langs = /* @__PURE__ */ new Set();
  for (const match of code.matchAll(/:?lang=["']([^"']+)["']/g)) {
    const lang = match[1].toLowerCase().trim();
    if (lang)
      langs.add(lang);
  }
  for (const match of code.matchAll(/(?:```|~~~)([\w-]+)/g)) {
    const lang = match[1].toLowerCase().trim();
    if (lang)
      langs.add(lang);
  }
  for (const match of code.matchAll(/\\begin\{([\w-]+)\}/g)) {
    const lang = match[1].toLowerCase().trim();
    if (lang)
      langs.add(lang);
  }
  for (const match of code.matchAll(/<script\s+(?:type|lang)=["']([^"']+)["']/gi)) {
    const fullType = match[1].toLowerCase().trim();
    const lang = fullType.includes("/") ? fullType.split("/").pop() : fullType;
    if (lang)
      langs.add(lang);
  }
  if (!highlighter2)
    return Array.from(langs);
  const bundle = highlighter2.getBundledLanguages();
  return Array.from(langs).filter((l3) => l3 && bundle[l3]);
}
var DEFAULT_COLOR_LIGHT_DARK = "light-dark()";
var COLOR_KEYS = ["color", "background-color"];
function splitToken(token2, offsets) {
  let lastOffset = 0;
  const tokens = [];
  for (const offset of offsets) {
    if (offset > lastOffset) {
      tokens.push({
        ...token2,
        content: token2.content.slice(lastOffset, offset),
        offset: token2.offset + lastOffset
      });
    }
    lastOffset = offset;
  }
  if (lastOffset < token2.content.length) {
    tokens.push({
      ...token2,
      content: token2.content.slice(lastOffset),
      offset: token2.offset + lastOffset
    });
  }
  return tokens;
}
function splitTokens(tokens, breakpoints) {
  const sorted = Array.from(breakpoints instanceof Set ? breakpoints : new Set(breakpoints)).sort((a2, b3) => a2 - b3);
  if (!sorted.length)
    return tokens;
  return tokens.map((line) => {
    return line.flatMap((token2) => {
      const breakpointsInToken = sorted.filter((i2) => token2.offset < i2 && i2 < token2.offset + token2.content.length).map((i2) => i2 - token2.offset).sort((a2, b3) => a2 - b3);
      if (!breakpointsInToken.length)
        return token2;
      return splitToken(token2, breakpointsInToken);
    });
  });
}
function flatTokenVariants(merged, variantsOrder, cssVariablePrefix, defaultColor, colorsRendering = "css-vars") {
  const token2 = {
    content: merged.content,
    explanation: merged.explanation,
    offset: merged.offset
  };
  const styles = variantsOrder.map((t) => getTokenStyleObject(merged.variants[t]));
  const styleKeys = new Set(styles.flatMap((t) => Object.keys(t)));
  const mergedStyles = {};
  const varKey = (idx, key2) => {
    const keyName = key2 === "color" ? "" : key2 === "background-color" ? "-bg" : `-${key2}`;
    return cssVariablePrefix + variantsOrder[idx] + (key2 === "color" ? "" : keyName);
  };
  styles.forEach((cur, idx) => {
    for (const key2 of styleKeys) {
      const value = cur[key2] || "inherit";
      if (idx === 0 && defaultColor && COLOR_KEYS.includes(key2)) {
        if (defaultColor === DEFAULT_COLOR_LIGHT_DARK && styles.length > 1) {
          const lightIndex = variantsOrder.findIndex((t) => t === "light");
          const darkIndex = variantsOrder.findIndex((t) => t === "dark");
          if (lightIndex === -1 || darkIndex === -1)
            throw new ShikiError('When using `defaultColor: "light-dark()"`, you must provide both `light` and `dark` themes');
          const lightValue = styles[lightIndex][key2] || "inherit";
          const darkValue = styles[darkIndex][key2] || "inherit";
          mergedStyles[key2] = `light-dark(${lightValue}, ${darkValue})`;
          if (colorsRendering === "css-vars")
            mergedStyles[varKey(idx, key2)] = value;
        } else {
          mergedStyles[key2] = value;
        }
      } else {
        if (colorsRendering === "css-vars")
          mergedStyles[varKey(idx, key2)] = value;
      }
    }
  });
  token2.htmlStyle = mergedStyles;
  return token2;
}
function getTokenStyleObject(token2) {
  const styles = {};
  if (token2.color)
    styles.color = token2.color;
  if (token2.bgColor)
    styles["background-color"] = token2.bgColor;
  if (token2.fontStyle) {
    if (token2.fontStyle & FontStyle.Italic)
      styles["font-style"] = "italic";
    if (token2.fontStyle & FontStyle.Bold)
      styles["font-weight"] = "bold";
    const decorations2 = [];
    if (token2.fontStyle & FontStyle.Underline)
      decorations2.push("underline");
    if (token2.fontStyle & FontStyle.Strikethrough)
      decorations2.push("line-through");
    if (decorations2.length)
      styles["text-decoration"] = decorations2.join(" ");
  }
  return styles;
}
function stringifyTokenStyle(token2) {
  if (typeof token2 === "string")
    return token2;
  return Object.entries(token2).map(([key2, value]) => `${key2}:${value}`).join(";");
}
var _grammarStateMap = /* @__PURE__ */ new WeakMap();
function setLastGrammarStateToMap(keys, state) {
  _grammarStateMap.set(keys, state);
}
function getLastGrammarStateFromMap(keys) {
  return _grammarStateMap.get(keys);
}
var GrammarState = class _GrammarState {
  /**
   * Theme to Stack mapping
   */
  _stacks = {};
  lang;
  get themes() {
    return Object.keys(this._stacks);
  }
  get theme() {
    return this.themes[0];
  }
  get _stack() {
    return this._stacks[this.theme];
  }
  /**
   * Static method to create a initial grammar state.
   */
  static initial(lang, themes) {
    return new _GrammarState(
      Object.fromEntries(toArray(themes).map((theme) => [theme, INITIAL])),
      lang
    );
  }
  constructor(...args) {
    if (args.length === 2) {
      const [stacksMap, lang] = args;
      this.lang = lang;
      this._stacks = stacksMap;
    } else {
      const [stack, lang, theme] = args;
      this.lang = lang;
      this._stacks = { [theme]: stack };
    }
  }
  /**
   * Get the internal stack object.
   * @internal
   */
  getInternalStack(theme = this.theme) {
    return this._stacks[theme];
  }
  getScopes(theme = this.theme) {
    return getScopes(this._stacks[theme]);
  }
  toJSON() {
    return {
      lang: this.lang,
      theme: this.theme,
      themes: this.themes,
      scopes: this.getScopes()
    };
  }
};
function getScopes(stack) {
  const scopes = [];
  const visited = /* @__PURE__ */ new Set();
  function pushScope(stack2) {
    if (visited.has(stack2))
      return;
    visited.add(stack2);
    const name = stack2?.nameScopesList?.scopeName;
    if (name)
      scopes.push(name);
    if (stack2.parent)
      pushScope(stack2.parent);
  }
  pushScope(stack);
  return scopes;
}
function getGrammarStack(state, theme) {
  if (!(state instanceof GrammarState))
    throw new ShikiError("Invalid grammar state");
  return state.getInternalStack(theme);
}
function transformerDecorations() {
  const map = /* @__PURE__ */ new WeakMap();
  function getContext(shiki) {
    if (!map.has(shiki.meta)) {
      let normalizePosition = function(p2) {
        if (typeof p2 === "number") {
          if (p2 < 0 || p2 > shiki.source.length)
            throw new ShikiError(`Invalid decoration offset: ${p2}. Code length: ${shiki.source.length}`);
          return {
            ...converter.indexToPos(p2),
            offset: p2
          };
        } else {
          const line = converter.lines[p2.line];
          if (line === void 0)
            throw new ShikiError(`Invalid decoration position ${JSON.stringify(p2)}. Lines length: ${converter.lines.length}`);
          let character = p2.character;
          if (character < 0)
            character = line.length + character;
          if (character < 0 || character > line.length)
            throw new ShikiError(`Invalid decoration position ${JSON.stringify(p2)}. Line ${p2.line} length: ${line.length}`);
          return {
            ...p2,
            character,
            offset: converter.posToIndex(p2.line, character)
          };
        }
      };
      const converter = createPositionConverter(shiki.source);
      const decorations2 = (shiki.options.decorations || []).map((d2) => ({
        ...d2,
        start: normalizePosition(d2.start),
        end: normalizePosition(d2.end)
      }));
      verifyIntersections(decorations2);
      map.set(shiki.meta, {
        decorations: decorations2,
        converter,
        source: shiki.source
      });
    }
    return map.get(shiki.meta);
  }
  return {
    name: "shiki:decorations",
    tokens(tokens) {
      if (!this.options.decorations?.length)
        return;
      const ctx = getContext(this);
      const breakpoints = ctx.decorations.flatMap((d2) => [d2.start.offset, d2.end.offset]);
      const splitted = splitTokens(tokens, breakpoints);
      return splitted;
    },
    code(codeEl) {
      if (!this.options.decorations?.length)
        return;
      const ctx = getContext(this);
      const lines = Array.from(codeEl.children).filter((i2) => i2.type === "element" && i2.tagName === "span");
      if (lines.length !== ctx.converter.lines.length)
        throw new ShikiError(`Number of lines in code element (${lines.length}) does not match the number of lines in the source (${ctx.converter.lines.length}). Failed to apply decorations.`);
      function applyLineSection(line, start, end, decoration) {
        const lineEl = lines[line];
        let text2 = "";
        let startIndex = -1;
        let endIndex = -1;
        if (start === 0)
          startIndex = 0;
        if (end === 0)
          endIndex = 0;
        if (end === Number.POSITIVE_INFINITY)
          endIndex = lineEl.children.length;
        if (startIndex === -1 || endIndex === -1) {
          for (let i2 = 0; i2 < lineEl.children.length; i2++) {
            text2 += stringify3(lineEl.children[i2]);
            if (startIndex === -1 && text2.length === start)
              startIndex = i2 + 1;
            if (endIndex === -1 && text2.length === end)
              endIndex = i2 + 1;
          }
        }
        if (startIndex === -1)
          throw new ShikiError(`Failed to find start index for decoration ${JSON.stringify(decoration.start)}`);
        if (endIndex === -1)
          throw new ShikiError(`Failed to find end index for decoration ${JSON.stringify(decoration.end)}`);
        const children = lineEl.children.slice(startIndex, endIndex);
        if (!decoration.alwaysWrap && children.length === lineEl.children.length) {
          applyDecoration(lineEl, decoration, "line");
        } else if (!decoration.alwaysWrap && children.length === 1 && children[0].type === "element") {
          applyDecoration(children[0], decoration, "token");
        } else {
          const wrapper = {
            type: "element",
            tagName: "span",
            properties: {},
            children
          };
          applyDecoration(wrapper, decoration, "wrapper");
          lineEl.children.splice(startIndex, children.length, wrapper);
        }
      }
      function applyLine(line, decoration) {
        lines[line] = applyDecoration(lines[line], decoration, "line");
      }
      function applyDecoration(el, decoration, type) {
        const properties = decoration.properties || {};
        const transform2 = decoration.transform || ((i2) => i2);
        el.tagName = decoration.tagName || "span";
        el.properties = {
          ...el.properties,
          ...properties,
          class: el.properties.class
        };
        if (decoration.properties?.class)
          addClassToHast(el, decoration.properties.class);
        el = transform2(el, type) || el;
        return el;
      }
      const lineApplies = [];
      const sorted = ctx.decorations.sort((a2, b3) => b3.start.offset - a2.start.offset || a2.end.offset - b3.end.offset);
      for (const decoration of sorted) {
        const { start, end } = decoration;
        if (start.line === end.line) {
          applyLineSection(start.line, start.character, end.character, decoration);
        } else if (start.line < end.line) {
          applyLineSection(start.line, start.character, Number.POSITIVE_INFINITY, decoration);
          for (let i2 = start.line + 1; i2 < end.line; i2++)
            lineApplies.unshift(() => applyLine(i2, decoration));
          applyLineSection(end.line, 0, end.character, decoration);
        }
      }
      lineApplies.forEach((i2) => i2());
    }
  };
}
function verifyIntersections(items) {
  for (let i2 = 0; i2 < items.length; i2++) {
    const foo = items[i2];
    if (foo.start.offset > foo.end.offset)
      throw new ShikiError(`Invalid decoration range: ${JSON.stringify(foo.start)} - ${JSON.stringify(foo.end)}`);
    for (let j2 = i2 + 1; j2 < items.length; j2++) {
      const bar = items[j2];
      const isFooHasBarStart = foo.start.offset <= bar.start.offset && bar.start.offset < foo.end.offset;
      const isFooHasBarEnd = foo.start.offset < bar.end.offset && bar.end.offset <= foo.end.offset;
      const isBarHasFooStart = bar.start.offset <= foo.start.offset && foo.start.offset < bar.end.offset;
      const isBarHasFooEnd = bar.start.offset < foo.end.offset && foo.end.offset <= bar.end.offset;
      if (isFooHasBarStart || isFooHasBarEnd || isBarHasFooStart || isBarHasFooEnd) {
        if (isFooHasBarStart && isFooHasBarEnd)
          continue;
        if (isBarHasFooStart && isBarHasFooEnd)
          continue;
        if (isBarHasFooStart && foo.start.offset === foo.end.offset)
          continue;
        if (isFooHasBarEnd && bar.start.offset === bar.end.offset)
          continue;
        throw new ShikiError(`Decorations ${JSON.stringify(foo.start)} and ${JSON.stringify(bar.start)} intersect.`);
      }
    }
  }
}
function stringify3(el) {
  if (el.type === "text")
    return el.value;
  if (el.type === "element")
    return el.children.map(stringify3).join("");
  return "";
}
var builtInTransformers = [
  /* @__PURE__ */ transformerDecorations()
];
function getTransformers(options) {
  const transformers = sortTransformersByEnforcement(options.transformers || []);
  return [
    ...transformers.pre,
    ...transformers.normal,
    ...transformers.post,
    ...builtInTransformers
  ];
}
function sortTransformersByEnforcement(transformers) {
  const pre = [];
  const post = [];
  const normal = [];
  for (const transformer of transformers) {
    switch (transformer.enforce) {
      case "pre":
        pre.push(transformer);
        break;
      case "post":
        post.push(transformer);
        break;
      default:
        normal.push(transformer);
    }
  }
  return { pre, post, normal };
}
var namedColors = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
  "brightBlack",
  "brightRed",
  "brightGreen",
  "brightYellow",
  "brightBlue",
  "brightMagenta",
  "brightCyan",
  "brightWhite"
];
var decorations = {
  1: "bold",
  2: "dim",
  3: "italic",
  4: "underline",
  7: "reverse",
  8: "hidden",
  9: "strikethrough"
};
function findSequence(value, position) {
  const nextEscape = value.indexOf("\x1B", position);
  if (nextEscape !== -1) {
    if (value[nextEscape + 1] === "[") {
      const nextClose = value.indexOf("m", nextEscape);
      if (nextClose !== -1) {
        return {
          sequence: value.substring(nextEscape + 2, nextClose).split(";"),
          startPosition: nextEscape,
          position: nextClose + 1
        };
      }
    }
  }
  return {
    position: value.length
  };
}
function parseColor(sequence) {
  const colorMode = sequence.shift();
  if (colorMode === "2") {
    const rgb = sequence.splice(0, 3).map((x3) => Number.parseInt(x3));
    if (rgb.length !== 3 || rgb.some((x3) => Number.isNaN(x3)))
      return;
    return {
      type: "rgb",
      rgb
    };
  } else if (colorMode === "5") {
    const index = sequence.shift();
    if (index) {
      return { type: "table", index: Number(index) };
    }
  }
}
function parseSequence(sequence) {
  const commands = [];
  while (sequence.length > 0) {
    const code = sequence.shift();
    if (!code)
      continue;
    const codeInt = Number.parseInt(code);
    if (Number.isNaN(codeInt))
      continue;
    if (codeInt === 0) {
      commands.push({ type: "resetAll" });
    } else if (codeInt <= 9) {
      const decoration = decorations[codeInt];
      if (decoration) {
        commands.push({
          type: "setDecoration",
          value: decorations[codeInt]
        });
      }
    } else if (codeInt <= 29) {
      const decoration = decorations[codeInt - 20];
      if (decoration) {
        commands.push({
          type: "resetDecoration",
          value: decoration
        });
        if (decoration === "dim") {
          commands.push({
            type: "resetDecoration",
            value: "bold"
          });
        }
      }
    } else if (codeInt <= 37) {
      commands.push({
        type: "setForegroundColor",
        value: { type: "named", name: namedColors[codeInt - 30] }
      });
    } else if (codeInt === 38) {
      const color = parseColor(sequence);
      if (color) {
        commands.push({
          type: "setForegroundColor",
          value: color
        });
      }
    } else if (codeInt === 39) {
      commands.push({
        type: "resetForegroundColor"
      });
    } else if (codeInt <= 47) {
      commands.push({
        type: "setBackgroundColor",
        value: { type: "named", name: namedColors[codeInt - 40] }
      });
    } else if (codeInt === 48) {
      const color = parseColor(sequence);
      if (color) {
        commands.push({
          type: "setBackgroundColor",
          value: color
        });
      }
    } else if (codeInt === 49) {
      commands.push({
        type: "resetBackgroundColor"
      });
    } else if (codeInt === 53) {
      commands.push({
        type: "setDecoration",
        value: "overline"
      });
    } else if (codeInt === 55) {
      commands.push({
        type: "resetDecoration",
        value: "overline"
      });
    } else if (codeInt >= 90 && codeInt <= 97) {
      commands.push({
        type: "setForegroundColor",
        value: { type: "named", name: namedColors[codeInt - 90 + 8] }
      });
    } else if (codeInt >= 100 && codeInt <= 107) {
      commands.push({
        type: "setBackgroundColor",
        value: { type: "named", name: namedColors[codeInt - 100 + 8] }
      });
    }
  }
  return commands;
}
function createAnsiSequenceParser() {
  let foreground = null;
  let background = null;
  let decorations2 = /* @__PURE__ */ new Set();
  return {
    parse(value) {
      const tokens = [];
      let position = 0;
      do {
        const findResult = findSequence(value, position);
        const text2 = findResult.sequence ? value.substring(position, findResult.startPosition) : value.substring(position);
        if (text2.length > 0) {
          tokens.push({
            value: text2,
            foreground,
            background,
            decorations: new Set(decorations2)
          });
        }
        if (findResult.sequence) {
          const commands = parseSequence(findResult.sequence);
          for (const styleToken of commands) {
            if (styleToken.type === "resetAll") {
              foreground = null;
              background = null;
              decorations2.clear();
            } else if (styleToken.type === "resetForegroundColor") {
              foreground = null;
            } else if (styleToken.type === "resetBackgroundColor") {
              background = null;
            } else if (styleToken.type === "resetDecoration") {
              decorations2.delete(styleToken.value);
            }
          }
          for (const styleToken of commands) {
            if (styleToken.type === "setForegroundColor") {
              foreground = styleToken.value;
            } else if (styleToken.type === "setBackgroundColor") {
              background = styleToken.value;
            } else if (styleToken.type === "setDecoration") {
              decorations2.add(styleToken.value);
            }
          }
        }
        position = findResult.position;
      } while (position < value.length);
      return tokens;
    }
  };
}
var defaultNamedColorsMap = {
  black: "#000000",
  red: "#bb0000",
  green: "#00bb00",
  yellow: "#bbbb00",
  blue: "#0000bb",
  magenta: "#ff00ff",
  cyan: "#00bbbb",
  white: "#eeeeee",
  brightBlack: "#555555",
  brightRed: "#ff5555",
  brightGreen: "#00ff00",
  brightYellow: "#ffff55",
  brightBlue: "#5555ff",
  brightMagenta: "#ff55ff",
  brightCyan: "#55ffff",
  brightWhite: "#ffffff"
};
function createColorPalette(namedColorsMap = defaultNamedColorsMap) {
  function namedColor(name) {
    return namedColorsMap[name];
  }
  function rgbColor(rgb) {
    return `#${rgb.map((x3) => Math.max(0, Math.min(x3, 255)).toString(16).padStart(2, "0")).join("")}`;
  }
  let colorTable;
  function getColorTable() {
    if (colorTable) {
      return colorTable;
    }
    colorTable = [];
    for (let i2 = 0; i2 < namedColors.length; i2++) {
      colorTable.push(namedColor(namedColors[i2]));
    }
    let levels = [0, 95, 135, 175, 215, 255];
    for (let r4 = 0; r4 < 6; r4++) {
      for (let g = 0; g < 6; g++) {
        for (let b3 = 0; b3 < 6; b3++) {
          colorTable.push(rgbColor([levels[r4], levels[g], levels[b3]]));
        }
      }
    }
    let level = 8;
    for (let i2 = 0; i2 < 24; i2++, level += 10) {
      colorTable.push(rgbColor([level, level, level]));
    }
    return colorTable;
  }
  function tableColor(index) {
    return getColorTable()[index];
  }
  function value(color) {
    switch (color.type) {
      case "named":
        return namedColor(color.name);
      case "rgb":
        return rgbColor(color.rgb);
      case "table":
        return tableColor(color.index);
    }
  }
  return {
    value
  };
}
var defaultAnsiColors = {
  black: "#000000",
  red: "#cd3131",
  green: "#0DBC79",
  yellow: "#E5E510",
  blue: "#2472C8",
  magenta: "#BC3FBC",
  cyan: "#11A8CD",
  white: "#E5E5E5",
  brightBlack: "#666666",
  brightRed: "#F14C4C",
  brightGreen: "#23D18B",
  brightYellow: "#F5F543",
  brightBlue: "#3B8EEA",
  brightMagenta: "#D670D6",
  brightCyan: "#29B8DB",
  brightWhite: "#FFFFFF"
};
function tokenizeAnsiWithTheme(theme, fileContents, options) {
  const colorReplacements = resolveColorReplacements(theme, options);
  const lines = splitLines(fileContents);
  const ansiPalette = Object.fromEntries(
    namedColors.map((name) => {
      const key2 = `terminal.ansi${name[0].toUpperCase()}${name.substring(1)}`;
      const themeColor = theme.colors?.[key2];
      return [name, themeColor || defaultAnsiColors[name]];
    })
  );
  const colorPalette = createColorPalette(ansiPalette);
  const parser = createAnsiSequenceParser();
  return lines.map(
    (line) => parser.parse(line[0]).map((token2) => {
      let color;
      let bgColor;
      if (token2.decorations.has("reverse")) {
        color = token2.background ? colorPalette.value(token2.background) : theme.bg;
        bgColor = token2.foreground ? colorPalette.value(token2.foreground) : theme.fg;
      } else {
        color = token2.foreground ? colorPalette.value(token2.foreground) : theme.fg;
        bgColor = token2.background ? colorPalette.value(token2.background) : void 0;
      }
      color = applyColorReplacements(color, colorReplacements);
      bgColor = applyColorReplacements(bgColor, colorReplacements);
      if (token2.decorations.has("dim"))
        color = dimColor(color);
      let fontStyle = FontStyle.None;
      if (token2.decorations.has("bold"))
        fontStyle |= FontStyle.Bold;
      if (token2.decorations.has("italic"))
        fontStyle |= FontStyle.Italic;
      if (token2.decorations.has("underline"))
        fontStyle |= FontStyle.Underline;
      if (token2.decorations.has("strikethrough"))
        fontStyle |= FontStyle.Strikethrough;
      return {
        content: token2.value,
        offset: line[1],
        // TODO: more accurate offset? might need to fork ansi-sequence-parser
        color,
        bgColor,
        fontStyle
      };
    })
  );
}
function dimColor(color) {
  const hexMatch = color.match(/#([0-9a-f]{3,8})/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 8) {
      const alpha = Math.round(Number.parseInt(hex.slice(6, 8), 16) / 2).toString(16).padStart(2, "0");
      return `#${hex.slice(0, 6)}${alpha}`;
    } else if (hex.length === 6) {
      return `#${hex}80`;
    } else if (hex.length === 4) {
      const r4 = hex[0];
      const g = hex[1];
      const b3 = hex[2];
      const a2 = hex[3];
      const alpha = Math.round(Number.parseInt(`${a2}${a2}`, 16) / 2).toString(16).padStart(2, "0");
      return `#${r4}${r4}${g}${g}${b3}${b3}${alpha}`;
    } else if (hex.length === 3) {
      const r4 = hex[0];
      const g = hex[1];
      const b3 = hex[2];
      return `#${r4}${r4}${g}${g}${b3}${b3}80`;
    }
  }
  const cssVarMatch = color.match(/var\((--[\w-]+-ansi-[\w-]+)\)/);
  if (cssVarMatch)
    return `var(${cssVarMatch[1]}-dim)`;
  return color;
}
function codeToTokensBase(internal, code, options = {}) {
  const {
    theme: themeName = internal.getLoadedThemes()[0]
  } = options;
  const lang = internal.resolveLangAlias(options.lang || "text");
  if (isPlainLang(lang) || isNoneTheme(themeName))
    return splitLines(code).map((line) => [{ content: line[0], offset: line[1] }]);
  const { theme, colorMap } = internal.setTheme(themeName);
  if (lang === "ansi")
    return tokenizeAnsiWithTheme(theme, code, options);
  const _grammar = internal.getLanguage(options.lang || "text");
  if (options.grammarState) {
    if (options.grammarState.lang !== _grammar.name) {
      throw new ShikiError(`Grammar state language "${options.grammarState.lang}" does not match highlight language "${_grammar.name}"`);
    }
    if (!options.grammarState.themes.includes(theme.name)) {
      throw new ShikiError(`Grammar state themes "${options.grammarState.themes}" do not contain highlight theme "${theme.name}"`);
    }
  }
  return tokenizeWithTheme(code, _grammar, theme, colorMap, options);
}
function getLastGrammarState(...args) {
  if (args.length === 2) {
    return getLastGrammarStateFromMap(args[1]);
  }
  const [internal, code, options = {}] = args;
  const {
    lang = "text",
    theme: themeName = internal.getLoadedThemes()[0]
  } = options;
  if (isPlainLang(lang) || isNoneTheme(themeName))
    throw new ShikiError("Plain language does not have grammar state");
  if (lang === "ansi")
    throw new ShikiError("ANSI language does not have grammar state");
  const { theme, colorMap } = internal.setTheme(themeName);
  const _grammar = internal.getLanguage(lang);
  return new GrammarState(
    _tokenizeWithTheme(code, _grammar, theme, colorMap, options).stateStack,
    _grammar.name,
    theme.name
  );
}
function tokenizeWithTheme(code, grammar, theme, colorMap, options) {
  const result = _tokenizeWithTheme(code, grammar, theme, colorMap, options);
  const grammarState = new GrammarState(
    result.stateStack,
    grammar.name,
    theme.name
  );
  setLastGrammarStateToMap(result.tokens, grammarState);
  return result.tokens;
}
function _tokenizeWithTheme(code, grammar, theme, colorMap, options) {
  const colorReplacements = resolveColorReplacements(theme, options);
  const {
    tokenizeMaxLineLength = 0,
    tokenizeTimeLimit = 500
  } = options;
  const lines = splitLines(code);
  let stateStack = options.grammarState ? getGrammarStack(options.grammarState, theme.name) ?? INITIAL : options.grammarContextCode != null ? _tokenizeWithTheme(
    options.grammarContextCode,
    grammar,
    theme,
    colorMap,
    {
      ...options,
      grammarState: void 0,
      grammarContextCode: void 0
    }
  ).stateStack : INITIAL;
  let actual = [];
  const final = [];
  for (let i2 = 0, len = lines.length; i2 < len; i2++) {
    const [line, lineOffset] = lines[i2];
    if (line === "") {
      actual = [];
      final.push([]);
      continue;
    }
    if (tokenizeMaxLineLength > 0 && line.length >= tokenizeMaxLineLength) {
      actual = [];
      final.push([{
        content: line,
        offset: lineOffset,
        color: "",
        fontStyle: 0
      }]);
      continue;
    }
    let resultWithScopes;
    let tokensWithScopes;
    let tokensWithScopesIndex;
    if (options.includeExplanation) {
      resultWithScopes = grammar.tokenizeLine(line, stateStack, tokenizeTimeLimit);
      tokensWithScopes = resultWithScopes.tokens;
      tokensWithScopesIndex = 0;
    }
    const result = grammar.tokenizeLine2(line, stateStack, tokenizeTimeLimit);
    const tokensLength = result.tokens.length / 2;
    for (let j2 = 0; j2 < tokensLength; j2++) {
      const startIndex = result.tokens[2 * j2];
      const nextStartIndex = j2 + 1 < tokensLength ? result.tokens[2 * j2 + 2] : line.length;
      if (startIndex === nextStartIndex)
        continue;
      const metadata = result.tokens[2 * j2 + 1];
      const color = applyColorReplacements(
        colorMap[EncodedTokenMetadata.getForeground(metadata)],
        colorReplacements
      );
      const fontStyle = EncodedTokenMetadata.getFontStyle(metadata);
      const token2 = {
        content: line.substring(startIndex, nextStartIndex),
        offset: lineOffset + startIndex,
        color,
        fontStyle
      };
      if (options.includeExplanation) {
        const themeSettingsSelectors = [];
        if (options.includeExplanation !== "scopeName") {
          for (const setting of theme.settings) {
            let selectors;
            switch (typeof setting.scope) {
              case "string":
                selectors = setting.scope.split(/,/).map((scope) => scope.trim());
                break;
              case "object":
                selectors = setting.scope;
                break;
              default:
                continue;
            }
            themeSettingsSelectors.push({
              settings: setting,
              selectors: selectors.map((selector) => selector.split(/ /))
            });
          }
        }
        token2.explanation = [];
        let offset = 0;
        while (startIndex + offset < nextStartIndex) {
          const tokenWithScopes = tokensWithScopes[tokensWithScopesIndex];
          const tokenWithScopesText = line.substring(
            tokenWithScopes.startIndex,
            tokenWithScopes.endIndex
          );
          offset += tokenWithScopesText.length;
          token2.explanation.push({
            content: tokenWithScopesText,
            scopes: options.includeExplanation === "scopeName" ? explainThemeScopesNameOnly(
              tokenWithScopes.scopes
            ) : explainThemeScopesFull(
              themeSettingsSelectors,
              tokenWithScopes.scopes
            )
          });
          tokensWithScopesIndex += 1;
        }
      }
      actual.push(token2);
    }
    final.push(actual);
    actual = [];
    stateStack = result.ruleStack;
  }
  return {
    tokens: final,
    stateStack
  };
}
function explainThemeScopesNameOnly(scopes) {
  return scopes.map((scope) => ({ scopeName: scope }));
}
function explainThemeScopesFull(themeSelectors, scopes) {
  const result = [];
  for (let i2 = 0, len = scopes.length; i2 < len; i2++) {
    const scope = scopes[i2];
    result[i2] = {
      scopeName: scope,
      themeMatches: explainThemeScope(themeSelectors, scope, scopes.slice(0, i2))
    };
  }
  return result;
}
function matchesOne(selector, scope) {
  return selector === scope || scope.substring(0, selector.length) === selector && scope[selector.length] === ".";
}
function matches(selectors, scope, parentScopes) {
  if (!matchesOne(selectors[selectors.length - 1], scope))
    return false;
  let selectorParentIndex = selectors.length - 2;
  let parentIndex = parentScopes.length - 1;
  while (selectorParentIndex >= 0 && parentIndex >= 0) {
    if (matchesOne(selectors[selectorParentIndex], parentScopes[parentIndex]))
      selectorParentIndex -= 1;
    parentIndex -= 1;
  }
  if (selectorParentIndex === -1)
    return true;
  return false;
}
function explainThemeScope(themeSettingsSelectors, scope, parentScopes) {
  const result = [];
  for (const { selectors, settings } of themeSettingsSelectors) {
    for (const selectorPieces of selectors) {
      if (matches(selectorPieces, scope, parentScopes)) {
        result.push(settings);
        break;
      }
    }
  }
  return result;
}
function codeToTokensWithThemes(internal, code, options) {
  const themes = Object.entries(options.themes).filter((i2) => i2[1]).map((i2) => ({ color: i2[0], theme: i2[1] }));
  const themedTokens = themes.map((t) => {
    const tokens2 = codeToTokensBase(internal, code, {
      ...options,
      theme: t.theme
    });
    const state = getLastGrammarStateFromMap(tokens2);
    const theme = typeof t.theme === "string" ? t.theme : t.theme.name;
    return {
      tokens: tokens2,
      state,
      theme
    };
  });
  const tokens = syncThemesTokenization(
    ...themedTokens.map((i2) => i2.tokens)
  );
  const mergedTokens = tokens[0].map(
    (line, lineIdx) => line.map((_token, tokenIdx) => {
      const mergedToken = {
        content: _token.content,
        variants: {},
        offset: _token.offset
      };
      if ("includeExplanation" in options && options.includeExplanation) {
        mergedToken.explanation = _token.explanation;
      }
      tokens.forEach((t, themeIdx) => {
        const {
          content: _3,
          explanation: __,
          offset: ___,
          ...styles
        } = t[lineIdx][tokenIdx];
        mergedToken.variants[themes[themeIdx].color] = styles;
      });
      return mergedToken;
    })
  );
  const mergedGrammarState = themedTokens[0].state ? new GrammarState(
    Object.fromEntries(themedTokens.map((s2) => [s2.theme, s2.state?.getInternalStack(s2.theme)])),
    themedTokens[0].state.lang
  ) : void 0;
  if (mergedGrammarState)
    setLastGrammarStateToMap(mergedTokens, mergedGrammarState);
  return mergedTokens;
}
function syncThemesTokenization(...themes) {
  const outThemes = themes.map(() => []);
  const count = themes.length;
  for (let i2 = 0; i2 < themes[0].length; i2++) {
    const lines = themes.map((t) => t[i2]);
    const outLines = outThemes.map(() => []);
    outThemes.forEach((t, i22) => t.push(outLines[i22]));
    const indexes = lines.map(() => 0);
    const current = lines.map((l3) => l3[0]);
    while (current.every((t) => t)) {
      const minLength = Math.min(...current.map((t) => t.content.length));
      for (let n = 0; n < count; n++) {
        const token2 = current[n];
        if (token2.content.length === minLength) {
          outLines[n].push(token2);
          indexes[n] += 1;
          current[n] = lines[n][indexes[n]];
        } else {
          outLines[n].push({
            ...token2,
            content: token2.content.slice(0, minLength)
          });
          current[n] = {
            ...token2,
            content: token2.content.slice(minLength),
            offset: token2.offset + minLength
          };
        }
      }
    }
  }
  return outThemes;
}
function codeToTokens(internal, code, options) {
  let bg;
  let fg;
  let tokens;
  let themeName;
  let rootStyle;
  let grammarState;
  if ("themes" in options) {
    const {
      defaultColor = "light",
      cssVariablePrefix = "--shiki-",
      colorsRendering = "css-vars"
    } = options;
    const themes = Object.entries(options.themes).filter((i2) => i2[1]).map((i2) => ({ color: i2[0], theme: i2[1] })).sort((a2, b3) => a2.color === defaultColor ? -1 : b3.color === defaultColor ? 1 : 0);
    if (themes.length === 0)
      throw new ShikiError("`themes` option must not be empty");
    const themeTokens = codeToTokensWithThemes(
      internal,
      code,
      options
    );
    grammarState = getLastGrammarStateFromMap(themeTokens);
    if (defaultColor && DEFAULT_COLOR_LIGHT_DARK !== defaultColor && !themes.find((t) => t.color === defaultColor))
      throw new ShikiError(`\`themes\` option must contain the defaultColor key \`${defaultColor}\``);
    const themeRegs = themes.map((t) => internal.getTheme(t.theme));
    const themesOrder = themes.map((t) => t.color);
    tokens = themeTokens.map((line) => line.map((token2) => flatTokenVariants(token2, themesOrder, cssVariablePrefix, defaultColor, colorsRendering)));
    if (grammarState)
      setLastGrammarStateToMap(tokens, grammarState);
    const themeColorReplacements = themes.map((t) => resolveColorReplacements(t.theme, options));
    fg = mapThemeColors(themes, themeRegs, themeColorReplacements, cssVariablePrefix, defaultColor, "fg", colorsRendering);
    bg = mapThemeColors(themes, themeRegs, themeColorReplacements, cssVariablePrefix, defaultColor, "bg", colorsRendering);
    themeName = `shiki-themes ${themeRegs.map((t) => t.name).join(" ")}`;
    rootStyle = defaultColor ? void 0 : [fg, bg].join(";");
  } else if ("theme" in options) {
    const colorReplacements = resolveColorReplacements(options.theme, options);
    tokens = codeToTokensBase(
      internal,
      code,
      options
    );
    const _theme = internal.getTheme(options.theme);
    bg = applyColorReplacements(_theme.bg, colorReplacements);
    fg = applyColorReplacements(_theme.fg, colorReplacements);
    themeName = _theme.name;
    grammarState = getLastGrammarStateFromMap(tokens);
  } else {
    throw new ShikiError("Invalid options, either `theme` or `themes` must be provided");
  }
  return {
    tokens,
    fg,
    bg,
    themeName,
    rootStyle,
    grammarState
  };
}
function mapThemeColors(themes, themeRegs, themeColorReplacements, cssVariablePrefix, defaultColor, property, colorsRendering) {
  return themes.map((t, idx) => {
    const value = applyColorReplacements(themeRegs[idx][property], themeColorReplacements[idx]) || "inherit";
    const cssVar = `${cssVariablePrefix + t.color}${property === "bg" ? "-bg" : ""}:${value}`;
    if (idx === 0 && defaultColor) {
      if (defaultColor === DEFAULT_COLOR_LIGHT_DARK && themes.length > 1) {
        const lightIndex = themes.findIndex((t2) => t2.color === "light");
        const darkIndex = themes.findIndex((t2) => t2.color === "dark");
        if (lightIndex === -1 || darkIndex === -1)
          throw new ShikiError('When using `defaultColor: "light-dark()"`, you must provide both `light` and `dark` themes');
        const lightValue = applyColorReplacements(themeRegs[lightIndex][property], themeColorReplacements[lightIndex]) || "inherit";
        const darkValue = applyColorReplacements(themeRegs[darkIndex][property], themeColorReplacements[darkIndex]) || "inherit";
        return `light-dark(${lightValue}, ${darkValue});${cssVar}`;
      }
      return value;
    }
    if (colorsRendering === "css-vars") {
      return cssVar;
    }
    return null;
  }).filter((i2) => !!i2).join(";");
}
function codeToHast(internal, code, options, transformerContext = {
  meta: {},
  options,
  codeToHast: (_code, _options) => codeToHast(internal, _code, _options),
  codeToTokens: (_code, _options) => codeToTokens(internal, _code, _options)
}) {
  let input = code;
  for (const transformer of getTransformers(options))
    input = transformer.preprocess?.call(transformerContext, input, options) || input;
  let {
    tokens,
    fg,
    bg,
    themeName,
    rootStyle,
    grammarState
  } = codeToTokens(internal, input, options);
  const {
    mergeWhitespaces = true,
    mergeSameStyleTokens = false
  } = options;
  if (mergeWhitespaces === true)
    tokens = mergeWhitespaceTokens(tokens);
  else if (mergeWhitespaces === "never")
    tokens = splitWhitespaceTokens(tokens);
  if (mergeSameStyleTokens) {
    tokens = mergeAdjacentStyledTokens(tokens);
  }
  const contextSource = {
    ...transformerContext,
    get source() {
      return input;
    }
  };
  for (const transformer of getTransformers(options))
    tokens = transformer.tokens?.call(contextSource, tokens) || tokens;
  return tokensToHast(
    tokens,
    {
      ...options,
      fg,
      bg,
      themeName,
      rootStyle: options.rootStyle === false ? false : options.rootStyle ?? rootStyle
    },
    contextSource,
    grammarState
  );
}
function tokensToHast(tokens, options, transformerContext, grammarState = getLastGrammarStateFromMap(tokens)) {
  const transformers = getTransformers(options);
  const lines = [];
  const root2 = {
    type: "root",
    children: []
  };
  const {
    structure = "classic",
    tabindex = "0"
  } = options;
  const properties = {
    class: `shiki ${options.themeName || ""}`
  };
  if (options.rootStyle !== false) {
    if (options.rootStyle != null)
      properties.style = options.rootStyle;
    else
      properties.style = `background-color:${options.bg};color:${options.fg}`;
  }
  if (tabindex !== false && tabindex != null)
    properties.tabindex = tabindex.toString();
  for (const [key2, value] of Object.entries(options.meta || {})) {
    if (!key2.startsWith("_"))
      properties[key2] = value;
  }
  let preNode = {
    type: "element",
    tagName: "pre",
    properties,
    children: [],
    data: options.data
  };
  let codeNode = {
    type: "element",
    tagName: "code",
    properties: {},
    children: lines
  };
  const lineNodes = [];
  const context = {
    ...transformerContext,
    structure,
    addClassToHast,
    get source() {
      return transformerContext.source;
    },
    get tokens() {
      return tokens;
    },
    get options() {
      return options;
    },
    get root() {
      return root2;
    },
    get pre() {
      return preNode;
    },
    get code() {
      return codeNode;
    },
    get lines() {
      return lineNodes;
    }
  };
  tokens.forEach((line, idx) => {
    if (idx) {
      if (structure === "inline")
        root2.children.push({ type: "element", tagName: "br", properties: {}, children: [] });
      else if (structure === "classic")
        lines.push({ type: "text", value: "\n" });
    }
    let lineNode = {
      type: "element",
      tagName: "span",
      properties: { class: "line" },
      children: []
    };
    let col = 0;
    for (const token2 of line) {
      let tokenNode = {
        type: "element",
        tagName: "span",
        properties: {
          ...token2.htmlAttrs
        },
        children: [{ type: "text", value: token2.content }]
      };
      const style = stringifyTokenStyle(token2.htmlStyle || getTokenStyleObject(token2));
      if (style)
        tokenNode.properties.style = style;
      for (const transformer of transformers)
        tokenNode = transformer?.span?.call(context, tokenNode, idx + 1, col, lineNode, token2) || tokenNode;
      if (structure === "inline")
        root2.children.push(tokenNode);
      else if (structure === "classic")
        lineNode.children.push(tokenNode);
      col += token2.content.length;
    }
    if (structure === "classic") {
      for (const transformer of transformers)
        lineNode = transformer?.line?.call(context, lineNode, idx + 1) || lineNode;
      lineNodes.push(lineNode);
      lines.push(lineNode);
    } else if (structure === "inline") {
      lineNodes.push(lineNode);
    }
  });
  if (structure === "classic") {
    for (const transformer of transformers)
      codeNode = transformer?.code?.call(context, codeNode) || codeNode;
    preNode.children.push(codeNode);
    for (const transformer of transformers)
      preNode = transformer?.pre?.call(context, preNode) || preNode;
    root2.children.push(preNode);
  } else if (structure === "inline") {
    const syntheticLines = [];
    let currentLine = {
      type: "element",
      tagName: "span",
      properties: { class: "line" },
      children: []
    };
    for (const child of root2.children) {
      if (child.type === "element" && child.tagName === "br") {
        syntheticLines.push(currentLine);
        currentLine = {
          type: "element",
          tagName: "span",
          properties: { class: "line" },
          children: []
        };
      } else if (child.type === "element" || child.type === "text") {
        currentLine.children.push(child);
      }
    }
    syntheticLines.push(currentLine);
    const syntheticCode = {
      type: "element",
      tagName: "code",
      properties: {},
      children: syntheticLines
    };
    let transformedCode = syntheticCode;
    for (const transformer of transformers)
      transformedCode = transformer?.code?.call(context, transformedCode) || transformedCode;
    root2.children = [];
    for (let i2 = 0; i2 < transformedCode.children.length; i2++) {
      if (i2 > 0)
        root2.children.push({ type: "element", tagName: "br", properties: {}, children: [] });
      const line = transformedCode.children[i2];
      if (line.type === "element")
        root2.children.push(...line.children);
    }
  }
  let result = root2;
  for (const transformer of transformers)
    result = transformer?.root?.call(context, result) || result;
  if (grammarState)
    setLastGrammarStateToMap(result, grammarState);
  return result;
}
function mergeWhitespaceTokens(tokens) {
  return tokens.map((line) => {
    const newLine = [];
    let carryOnContent = "";
    let firstOffset;
    line.forEach((token2, idx) => {
      const isDecorated = token2.fontStyle && (token2.fontStyle & FontStyle.Underline || token2.fontStyle & FontStyle.Strikethrough);
      const couldMerge = !isDecorated;
      if (couldMerge && token2.content.match(/^\s+$/) && line[idx + 1]) {
        if (firstOffset === void 0)
          firstOffset = token2.offset;
        carryOnContent += token2.content;
      } else {
        if (carryOnContent) {
          if (couldMerge) {
            newLine.push({
              ...token2,
              offset: firstOffset,
              content: carryOnContent + token2.content
            });
          } else {
            newLine.push(
              {
                content: carryOnContent,
                offset: firstOffset
              },
              token2
            );
          }
          firstOffset = void 0;
          carryOnContent = "";
        } else {
          newLine.push(token2);
        }
      }
    });
    return newLine;
  });
}
function splitWhitespaceTokens(tokens) {
  return tokens.map((line) => {
    return line.flatMap((token2) => {
      if (token2.content.match(/^\s+$/))
        return token2;
      const match = token2.content.match(/^(\s*)(.*?)(\s*)$/);
      if (!match)
        return token2;
      const [, leading, content, trailing] = match;
      if (!leading && !trailing)
        return token2;
      const expanded = [{
        ...token2,
        offset: token2.offset + leading.length,
        content
      }];
      if (leading) {
        expanded.unshift({
          content: leading,
          offset: token2.offset
        });
      }
      if (trailing) {
        expanded.push({
          content: trailing,
          offset: token2.offset + leading.length + content.length
        });
      }
      return expanded;
    });
  });
}
function mergeAdjacentStyledTokens(tokens) {
  return tokens.map((line) => {
    const newLine = [];
    for (const token2 of line) {
      if (newLine.length === 0) {
        newLine.push({ ...token2 });
        continue;
      }
      const prevToken = newLine[newLine.length - 1];
      const prevStyle = stringifyTokenStyle(prevToken.htmlStyle || getTokenStyleObject(prevToken));
      const currentStyle = stringifyTokenStyle(token2.htmlStyle || getTokenStyleObject(token2));
      const isPrevDecorated = prevToken.fontStyle && (prevToken.fontStyle & FontStyle.Underline || prevToken.fontStyle & FontStyle.Strikethrough);
      const isDecorated = token2.fontStyle && (token2.fontStyle & FontStyle.Underline || token2.fontStyle & FontStyle.Strikethrough);
      if (!isPrevDecorated && !isDecorated && prevStyle === currentStyle) {
        prevToken.content += token2.content;
      } else {
        newLine.push({ ...token2 });
      }
    }
    return newLine;
  });
}
var hastToHtml = toHtml;
function codeToHtml(internal, code, options) {
  const context = {
    meta: {},
    options,
    codeToHast: (_code, _options) => codeToHast(internal, _code, _options),
    codeToTokens: (_code, _options) => codeToTokens(internal, _code, _options)
  };
  let result = hastToHtml(codeToHast(internal, code, options, context));
  for (const transformer of getTransformers(options))
    result = transformer.postprocess?.call(context, result, options) || result;
  return result;
}
var VSCODE_FALLBACK_EDITOR_FG = { light: "#333333", dark: "#bbbbbb" };
var VSCODE_FALLBACK_EDITOR_BG = { light: "#fffffe", dark: "#1e1e1e" };
var RESOLVED_KEY = "__shiki_resolved";
function normalizeTheme(rawTheme) {
  if (rawTheme?.[RESOLVED_KEY])
    return rawTheme;
  const theme = {
    ...rawTheme
  };
  if (theme.tokenColors && !theme.settings) {
    theme.settings = theme.tokenColors;
    delete theme.tokenColors;
  }
  theme.type ||= "dark";
  theme.colorReplacements = { ...theme.colorReplacements };
  theme.settings ||= [];
  let { bg, fg } = theme;
  if (!bg || !fg) {
    const globalSetting = theme.settings ? theme.settings.find((s2) => !s2.name && !s2.scope) : void 0;
    if (globalSetting?.settings?.foreground)
      fg = globalSetting.settings.foreground;
    if (globalSetting?.settings?.background)
      bg = globalSetting.settings.background;
    if (!fg && theme?.colors?.["editor.foreground"])
      fg = theme.colors["editor.foreground"];
    if (!bg && theme?.colors?.["editor.background"])
      bg = theme.colors["editor.background"];
    if (!fg)
      fg = theme.type === "light" ? VSCODE_FALLBACK_EDITOR_FG.light : VSCODE_FALLBACK_EDITOR_FG.dark;
    if (!bg)
      bg = theme.type === "light" ? VSCODE_FALLBACK_EDITOR_BG.light : VSCODE_FALLBACK_EDITOR_BG.dark;
    theme.fg = fg;
    theme.bg = bg;
  }
  if (!(theme.settings[0] && theme.settings[0].settings && !theme.settings[0].scope)) {
    theme.settings.unshift({
      settings: {
        foreground: theme.fg,
        background: theme.bg
      }
    });
  }
  let replacementCount = 0;
  const replacementMap = /* @__PURE__ */ new Map();
  function getReplacementColor(value) {
    if (replacementMap.has(value))
      return replacementMap.get(value);
    replacementCount += 1;
    const hex = `#${replacementCount.toString(16).padStart(8, "0").toLowerCase()}`;
    if (theme.colorReplacements?.[`#${hex}`])
      return getReplacementColor(value);
    replacementMap.set(value, hex);
    return hex;
  }
  theme.settings = theme.settings.map((setting) => {
    const replaceFg = setting.settings?.foreground && !setting.settings.foreground.startsWith("#");
    const replaceBg = setting.settings?.background && !setting.settings.background.startsWith("#");
    if (!replaceFg && !replaceBg)
      return setting;
    const clone2 = {
      ...setting,
      settings: {
        ...setting.settings
      }
    };
    if (replaceFg) {
      const replacement = getReplacementColor(setting.settings.foreground);
      theme.colorReplacements[replacement] = setting.settings.foreground;
      clone2.settings.foreground = replacement;
    }
    if (replaceBg) {
      const replacement = getReplacementColor(setting.settings.background);
      theme.colorReplacements[replacement] = setting.settings.background;
      clone2.settings.background = replacement;
    }
    return clone2;
  });
  for (const key2 of Object.keys(theme.colors || {})) {
    if (key2 === "editor.foreground" || key2 === "editor.background" || key2.startsWith("terminal.ansi")) {
      if (!theme.colors[key2]?.startsWith("#")) {
        const replacement = getReplacementColor(theme.colors[key2]);
        theme.colorReplacements[replacement] = theme.colors[key2];
        theme.colors[key2] = replacement;
      }
    }
  }
  Object.defineProperty(theme, RESOLVED_KEY, {
    enumerable: false,
    writable: false,
    value: true
  });
  return theme;
}
async function resolveLangs(langs) {
  return Array.from(new Set((await Promise.all(
    langs.filter((l3) => !isSpecialLang(l3)).map(async (lang) => await normalizeGetter(lang).then((r4) => Array.isArray(r4) ? r4 : [r4]))
  )).flat()));
}
async function resolveThemes(themes) {
  const resolved = await Promise.all(
    themes.map(
      async (theme) => isSpecialTheme(theme) ? null : normalizeTheme(await normalizeGetter(theme))
    )
  );
  return resolved.filter((i2) => !!i2);
}
var _emitDeprecation = 3;
var _emitError = false;
function warnDeprecated(message, version = 3) {
  if (!_emitDeprecation)
    return;
  if (typeof _emitDeprecation === "number" && version > _emitDeprecation)
    return;
  if (_emitError) {
    throw new Error(`[SHIKI DEPRECATE]: ${message}`);
  } else {
    console.trace(`[SHIKI DEPRECATE]: ${message}`);
  }
}
var ShikiError2 = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ShikiError";
  }
};
function resolveLangAlias(name, alias) {
  if (!alias)
    return name;
  if (alias[name]) {
    const resolved = /* @__PURE__ */ new Set([name]);
    while (alias[name]) {
      name = alias[name];
      if (resolved.has(name))
        throw new ShikiError2(`Circular alias \`${Array.from(resolved).join(" -> ")} -> ${name}\``);
      resolved.add(name);
    }
  }
  return name;
}
var Registry2 = class extends Registry {
  constructor(_resolver, _themes, _langs, _alias = {}) {
    super(_resolver);
    this._resolver = _resolver;
    this._themes = _themes;
    this._langs = _langs;
    this._alias = _alias;
    this._themes.map((t) => this.loadTheme(t));
    this.loadLanguages(this._langs);
  }
  _resolvedThemes = /* @__PURE__ */ new Map();
  _resolvedGrammars = /* @__PURE__ */ new Map();
  _langMap = /* @__PURE__ */ new Map();
  _langGraph = /* @__PURE__ */ new Map();
  _textmateThemeCache = /* @__PURE__ */ new WeakMap();
  _loadedThemesCache = null;
  _loadedLanguagesCache = null;
  getTheme(theme) {
    if (typeof theme === "string")
      return this._resolvedThemes.get(theme);
    else
      return this.loadTheme(theme);
  }
  loadTheme(theme) {
    const _theme = normalizeTheme(theme);
    if (_theme.name) {
      this._resolvedThemes.set(_theme.name, _theme);
      this._loadedThemesCache = null;
    }
    return _theme;
  }
  getLoadedThemes() {
    if (!this._loadedThemesCache)
      this._loadedThemesCache = [...this._resolvedThemes.keys()];
    return this._loadedThemesCache;
  }
  // Override and re-implement this method to cache the textmate themes as `TextMateTheme.createFromRawTheme`
  // is expensive. Themes can switch often especially for dual-theme support.
  //
  // The parent class also accepts `colorMap` as the second parameter, but since we don't use that,
  // we omit here so it's easier to cache the themes.
  setTheme(theme) {
    let textmateTheme = this._textmateThemeCache.get(theme);
    if (!textmateTheme) {
      textmateTheme = Theme.createFromRawTheme(theme);
      this._textmateThemeCache.set(theme, textmateTheme);
    }
    this._syncRegistry.setTheme(textmateTheme);
  }
  getGrammar(name) {
    name = resolveLangAlias(name, this._alias);
    return this._resolvedGrammars.get(name);
  }
  loadLanguage(lang) {
    if (this.getGrammar(lang.name))
      return;
    const embeddedLazilyBy = new Set(
      [...this._langMap.values()].filter((i2) => i2.embeddedLangsLazy?.includes(lang.name))
    );
    this._resolver.addLanguage(lang);
    const grammarConfig = {
      balancedBracketSelectors: lang.balancedBracketSelectors || ["*"],
      unbalancedBracketSelectors: lang.unbalancedBracketSelectors || []
    };
    this._syncRegistry._rawGrammars.set(lang.scopeName, lang);
    const g = this.loadGrammarWithConfiguration(lang.scopeName, 1, grammarConfig);
    g.name = lang.name;
    this._resolvedGrammars.set(lang.name, g);
    if (lang.aliases) {
      lang.aliases.forEach((alias) => {
        this._alias[alias] = lang.name;
      });
    }
    this._loadedLanguagesCache = null;
    if (embeddedLazilyBy.size) {
      for (const e of embeddedLazilyBy) {
        this._resolvedGrammars.delete(e.name);
        this._loadedLanguagesCache = null;
        this._syncRegistry?._injectionGrammars?.delete(e.scopeName);
        this._syncRegistry?._grammars?.delete(e.scopeName);
        this.loadLanguage(this._langMap.get(e.name));
      }
    }
  }
  dispose() {
    super.dispose();
    this._resolvedThemes.clear();
    this._resolvedGrammars.clear();
    this._langMap.clear();
    this._langGraph.clear();
    this._loadedThemesCache = null;
  }
  loadLanguages(langs) {
    for (const lang of langs)
      this.resolveEmbeddedLanguages(lang);
    const langsGraphArray = Array.from(this._langGraph.entries());
    const missingLangs = langsGraphArray.filter(([_3, lang]) => !lang);
    if (missingLangs.length) {
      const dependents = langsGraphArray.filter(([_3, lang]) => {
        if (!lang)
          return false;
        const embedded = lang.embeddedLanguages || lang.embeddedLangs;
        return embedded?.some((l3) => missingLangs.map(([name]) => name).includes(l3));
      }).filter((lang) => !missingLangs.includes(lang));
      throw new ShikiError2(`Missing languages ${missingLangs.map(([name]) => `\`${name}\``).join(", ")}, required by ${dependents.map(([name]) => `\`${name}\``).join(", ")}`);
    }
    for (const [_3, lang] of langsGraphArray)
      this._resolver.addLanguage(lang);
    for (const [_3, lang] of langsGraphArray)
      this.loadLanguage(lang);
  }
  getLoadedLanguages() {
    if (!this._loadedLanguagesCache) {
      this._loadedLanguagesCache = [
        .../* @__PURE__ */ new Set([...this._resolvedGrammars.keys(), ...Object.keys(this._alias)])
      ];
    }
    return this._loadedLanguagesCache;
  }
  resolveEmbeddedLanguages(lang) {
    this._langMap.set(lang.name, lang);
    this._langGraph.set(lang.name, lang);
    const embedded = lang.embeddedLanguages ?? lang.embeddedLangs;
    if (embedded) {
      for (const embeddedLang of embedded)
        this._langGraph.set(embeddedLang, this._langMap.get(embeddedLang));
    }
  }
};
var Resolver = class {
  _langs = /* @__PURE__ */ new Map();
  _scopeToLang = /* @__PURE__ */ new Map();
  _injections = /* @__PURE__ */ new Map();
  _onigLib;
  constructor(engine, langs) {
    this._onigLib = {
      createOnigScanner: (patterns) => engine.createScanner(patterns),
      createOnigString: (s2) => engine.createString(s2)
    };
    langs.forEach((i2) => this.addLanguage(i2));
  }
  get onigLib() {
    return this._onigLib;
  }
  getLangRegistration(langIdOrAlias) {
    return this._langs.get(langIdOrAlias);
  }
  loadGrammar(scopeName) {
    return this._scopeToLang.get(scopeName);
  }
  addLanguage(l3) {
    this._langs.set(l3.name, l3);
    if (l3.aliases) {
      l3.aliases.forEach((a2) => {
        this._langs.set(a2, l3);
      });
    }
    this._scopeToLang.set(l3.scopeName, l3);
    if (l3.injectTo) {
      l3.injectTo.forEach((i2) => {
        if (!this._injections.get(i2))
          this._injections.set(i2, []);
        this._injections.get(i2).push(l3.scopeName);
      });
    }
  }
  getInjections(scopeName) {
    const scopeParts = scopeName.split(".");
    let injections = [];
    for (let i2 = 1; i2 <= scopeParts.length; i2++) {
      const subScopeName = scopeParts.slice(0, i2).join(".");
      injections = [...injections, ...this._injections.get(subScopeName) || []];
    }
    return injections;
  }
};
var instancesCount = 0;
function createShikiInternalSync(options) {
  instancesCount += 1;
  if (options.warnings !== false && instancesCount >= 10 && instancesCount % 10 === 0)
    console.warn(`[Shiki] ${instancesCount} instances have been created. Shiki is supposed to be used as a singleton, consider refactoring your code to cache your highlighter instance; Or call \`highlighter.dispose()\` to release unused instances.`);
  let isDisposed = false;
  if (!options.engine)
    throw new ShikiError2("`engine` option is required for synchronous mode");
  const langs = (options.langs || []).flat(1);
  const themes = (options.themes || []).flat(1).map(normalizeTheme);
  const resolver = new Resolver(options.engine, langs);
  const _registry = new Registry2(resolver, themes, langs, options.langAlias);
  let _lastTheme;
  function resolveLangAlias$1(name) {
    return resolveLangAlias(name, options.langAlias);
  }
  function getLanguage(name) {
    ensureNotDisposed();
    const _lang = _registry.getGrammar(typeof name === "string" ? name : name.name);
    if (!_lang)
      throw new ShikiError2(`Language \`${name}\` not found, you may need to load it first`);
    return _lang;
  }
  function getTheme(name) {
    if (name === "none")
      return { bg: "", fg: "", name: "none", settings: [], type: "dark" };
    ensureNotDisposed();
    const _theme = _registry.getTheme(name);
    if (!_theme)
      throw new ShikiError2(`Theme \`${name}\` not found, you may need to load it first`);
    return _theme;
  }
  function setTheme(name) {
    ensureNotDisposed();
    const theme = getTheme(name);
    if (_lastTheme !== name) {
      _registry.setTheme(theme);
      _lastTheme = name;
    }
    const colorMap = _registry.getColorMap();
    return {
      theme,
      colorMap
    };
  }
  function getLoadedThemes() {
    ensureNotDisposed();
    return _registry.getLoadedThemes();
  }
  function getLoadedLanguages() {
    ensureNotDisposed();
    return _registry.getLoadedLanguages();
  }
  function loadLanguageSync(...langs2) {
    ensureNotDisposed();
    _registry.loadLanguages(langs2.flat(1));
  }
  async function loadLanguage(...langs2) {
    return loadLanguageSync(await resolveLangs(langs2));
  }
  function loadThemeSync(...themes2) {
    ensureNotDisposed();
    for (const theme of themes2.flat(1)) {
      _registry.loadTheme(theme);
    }
  }
  async function loadTheme(...themes2) {
    ensureNotDisposed();
    return loadThemeSync(await resolveThemes(themes2));
  }
  function ensureNotDisposed() {
    if (isDisposed)
      throw new ShikiError2("Shiki instance has been disposed");
  }
  function dispose() {
    if (isDisposed)
      return;
    isDisposed = true;
    _registry.dispose();
    instancesCount -= 1;
  }
  return {
    setTheme,
    getTheme,
    getLanguage,
    getLoadedThemes,
    getLoadedLanguages,
    resolveLangAlias: resolveLangAlias$1,
    loadLanguage,
    loadLanguageSync,
    loadTheme,
    loadThemeSync,
    dispose,
    [Symbol.dispose]: dispose
  };
}
async function createShikiInternal(options) {
  if (!options.engine) {
    warnDeprecated("`engine` option is required. Use `createOnigurumaEngine` or `createJavaScriptRegexEngine` to create an engine.");
  }
  const [
    themes,
    langs,
    engine
  ] = await Promise.all([
    resolveThemes(options.themes || []),
    resolveLangs(options.langs || []),
    options.engine
  ]);
  return createShikiInternalSync({
    ...options,
    themes,
    langs,
    engine
  });
}
async function createHighlighterCore(options) {
  const internal = await createShikiInternal(options);
  return {
    getLastGrammarState: (...args) => getLastGrammarState(internal, ...args),
    codeToTokensBase: (code, options2) => codeToTokensBase(internal, code, options2),
    codeToTokensWithThemes: (code, options2) => codeToTokensWithThemes(internal, code, options2),
    codeToTokens: (code, options2) => codeToTokens(internal, code, options2),
    codeToHast: (code, options2) => codeToHast(internal, code, options2),
    codeToHtml: (code, options2) => codeToHtml(internal, code, options2),
    getBundledLanguages: () => ({}),
    getBundledThemes: () => ({}),
    ...internal,
    getInternalContext: () => internal
  };
}
function createBundledHighlighter(options) {
  const bundledLanguages2 = options.langs;
  const bundledThemes2 = options.themes;
  const engine = options.engine;
  async function createHighlighter2(options2) {
    function resolveLang(lang) {
      if (typeof lang === "string") {
        lang = options2.langAlias?.[lang] || lang;
        if (isSpecialLang(lang))
          return [];
        const bundle = bundledLanguages2[lang];
        if (!bundle)
          throw new ShikiError(`Language \`${lang}\` is not included in this bundle. You may want to load it from external source.`);
        return bundle;
      }
      return lang;
    }
    function resolveTheme2(theme) {
      if (isSpecialTheme(theme))
        return "none";
      if (typeof theme === "string") {
        const bundle = bundledThemes2[theme];
        if (!bundle)
          throw new ShikiError(`Theme \`${theme}\` is not included in this bundle. You may want to load it from external source.`);
        return bundle;
      }
      return theme;
    }
    const _themes = (options2.themes ?? []).map((i2) => resolveTheme2(i2));
    const langs = (options2.langs ?? []).map((i2) => resolveLang(i2));
    const core2 = await createHighlighterCore({
      engine: options2.engine ?? engine(),
      ...options2,
      themes: _themes,
      langs
    });
    return {
      ...core2,
      loadLanguage(...langs2) {
        return core2.loadLanguage(...langs2.map(resolveLang));
      },
      loadTheme(...themes) {
        return core2.loadTheme(...themes.map(resolveTheme2));
      },
      getBundledLanguages() {
        return bundledLanguages2;
      },
      getBundledThemes() {
        return bundledThemes2;
      }
    };
  }
  return createHighlighter2;
}
function makeSingletonHighlighter(createHighlighter2) {
  let _shiki;
  async function getSingletonHighlighter2(options = {}) {
    if (!_shiki) {
      _shiki = createHighlighter2({
        ...options,
        themes: [],
        langs: []
      });
      const s2 = await _shiki;
      await Promise.all([
        s2.loadTheme(...options.themes || []),
        s2.loadLanguage(...options.langs || [])
      ]);
      return s2;
    } else {
      const s2 = await _shiki;
      await Promise.all([
        s2.loadTheme(...options.themes || []),
        s2.loadLanguage(...options.langs || [])
      ]);
      return s2;
    }
  }
  return getSingletonHighlighter2;
}
function createSingletonShorthands(createHighlighter2, config) {
  const getSingletonHighlighter2 = makeSingletonHighlighter(createHighlighter2);
  async function get(code, options) {
    const shiki = await getSingletonHighlighter2({
      langs: [options.lang],
      themes: "theme" in options ? [options.theme] : Object.values(options.themes)
    });
    const langs = await config?.guessEmbeddedLanguages?.(code, options.lang, shiki);
    if (langs) {
      await shiki.loadLanguage(...langs);
    }
    return shiki;
  }
  return {
    getSingletonHighlighter(options) {
      return getSingletonHighlighter2(options);
    },
    async codeToHtml(code, options) {
      const shiki = await get(code, options);
      return shiki.codeToHtml(code, options);
    },
    async codeToHast(code, options) {
      const shiki = await get(code, options);
      return shiki.codeToHast(code, options);
    },
    async codeToTokens(code, options) {
      const shiki = await get(code, options);
      return shiki.codeToTokens(code, options);
    },
    async codeToTokensBase(code, options) {
      const shiki = await get(code, options);
      return shiki.codeToTokensBase(code, options);
    },
    async codeToTokensWithThemes(code, options) {
      const shiki = await get(code, options);
      return shiki.codeToTokensWithThemes(code, options);
    },
    async getLastGrammarState(code, options) {
      const shiki = await getSingletonHighlighter2({
        langs: [options.lang],
        themes: [options.theme]
      });
      return shiki.getLastGrammarState(code, options);
    }
  };
}

// node_modules/.pnpm/shiki@3.23.0/node_modules/shiki/dist/langs.mjs
var bundledLanguagesInfo = [
  {
    "id": "abap",
    "name": "ABAP",
    "import": () => import("./abap-OHQTJU7B.js")
  },
  {
    "id": "actionscript-3",
    "name": "ActionScript",
    "import": () => import("./actionscript-3-CT66QMY5.js")
  },
  {
    "id": "ada",
    "name": "Ada",
    "import": () => import("./ada-ZNLIB6XY.js")
  },
  {
    "id": "angular-html",
    "name": "Angular HTML",
    "import": () => import("./angular-html-C4EULZQW.js")
  },
  {
    "id": "angular-ts",
    "name": "Angular TypeScript",
    "import": () => import("./angular-ts-GQTRTHIR.js")
  },
  {
    "id": "apache",
    "name": "Apache Conf",
    "import": () => import("./apache-GXLKEIH3.js")
  },
  {
    "id": "apex",
    "name": "Apex",
    "import": () => import("./apex-DNI25W2I.js")
  },
  {
    "id": "apl",
    "name": "APL",
    "import": () => import("./apl-25KIEKWU.js")
  },
  {
    "id": "applescript",
    "name": "AppleScript",
    "import": () => import("./applescript-B2ODZMKL.js")
  },
  {
    "id": "ara",
    "name": "Ara",
    "import": () => import("./ara-SUCQ54JY.js")
  },
  {
    "id": "asciidoc",
    "name": "AsciiDoc",
    "aliases": [
      "adoc"
    ],
    "import": () => import("./asciidoc-66NJFIEQ.js")
  },
  {
    "id": "asm",
    "name": "Assembly",
    "import": () => import("./asm-ULNQXREA.js")
  },
  {
    "id": "astro",
    "name": "Astro",
    "import": () => import("./astro-O5RLMC4J.js")
  },
  {
    "id": "awk",
    "name": "AWK",
    "import": () => import("./awk-EOTQ3D6Z.js")
  },
  {
    "id": "ballerina",
    "name": "Ballerina",
    "import": () => import("./ballerina-TJ5HAXPJ.js")
  },
  {
    "id": "bat",
    "name": "Batch File",
    "aliases": [
      "batch"
    ],
    "import": () => import("./bat-F52HCYDV.js")
  },
  {
    "id": "beancount",
    "name": "Beancount",
    "import": () => import("./beancount-UVWL5VVX.js")
  },
  {
    "id": "berry",
    "name": "Berry",
    "aliases": [
      "be"
    ],
    "import": () => import("./berry-74SPLXBN.js")
  },
  {
    "id": "bibtex",
    "name": "BibTeX",
    "import": () => import("./bibtex-QGQDEIEC.js")
  },
  {
    "id": "bicep",
    "name": "Bicep",
    "import": () => import("./bicep-IUI6BHJ5.js")
  },
  {
    "id": "bird2",
    "name": "BIRD2 Configuration",
    "aliases": [
      "bird"
    ],
    "import": () => import("./bird2-ZKB6YZHE.js")
  },
  {
    "id": "blade",
    "name": "Blade",
    "import": () => import("./blade-LJDU3L7O.js")
  },
  {
    "id": "bsl",
    "name": "1C (Enterprise)",
    "aliases": [
      "1c"
    ],
    "import": () => import("./bsl-6CBHT6OK.js")
  },
  {
    "id": "c",
    "name": "C",
    "import": () => import("./c-QTRA3TP2.js")
  },
  {
    "id": "c3",
    "name": "C3",
    "import": () => import("./c3-IQNUGSDF.js")
  },
  {
    "id": "cadence",
    "name": "Cadence",
    "aliases": [
      "cdc"
    ],
    "import": () => import("./cadence-NKZMNOF5.js")
  },
  {
    "id": "cairo",
    "name": "Cairo",
    "import": () => import("./cairo-S2E7N2VR.js")
  },
  {
    "id": "clarity",
    "name": "Clarity",
    "import": () => import("./clarity-XO3UD5DK.js")
  },
  {
    "id": "clojure",
    "name": "Clojure",
    "aliases": [
      "clj"
    ],
    "import": () => import("./clojure-JOB32SDM.js")
  },
  {
    "id": "cmake",
    "name": "CMake",
    "import": () => import("./cmake-WU423L5G.js")
  },
  {
    "id": "cobol",
    "name": "COBOL",
    "import": () => import("./cobol-HHOZNFAH.js")
  },
  {
    "id": "codeowners",
    "name": "CODEOWNERS",
    "import": () => import("./codeowners-SM4RM4B2.js")
  },
  {
    "id": "codeql",
    "name": "CodeQL",
    "aliases": [
      "ql"
    ],
    "import": () => import("./codeql-5LIXIB4F.js")
  },
  {
    "id": "coffee",
    "name": "CoffeeScript",
    "aliases": [
      "coffeescript"
    ],
    "import": () => import("./coffee-JIS2EX4O.js")
  },
  {
    "id": "common-lisp",
    "name": "Common Lisp",
    "aliases": [
      "lisp"
    ],
    "import": () => import("./common-lisp-6MEVRLIX.js")
  },
  {
    "id": "coq",
    "name": "Coq",
    "import": () => import("./coq-OUORN4I4.js")
  },
  {
    "id": "cpp",
    "name": "C++",
    "aliases": [
      "c++"
    ],
    "import": () => import("./cpp-PLFEIKAY.js")
  },
  {
    "id": "crystal",
    "name": "Crystal",
    "import": () => import("./crystal-Q46O5C6O.js")
  },
  {
    "id": "csharp",
    "name": "C#",
    "aliases": [
      "c#",
      "cs"
    ],
    "import": () => import("./csharp-NPLDLB7R.js")
  },
  {
    "id": "css",
    "name": "CSS",
    "import": () => import("./css-KIBRYR6M.js")
  },
  {
    "id": "csv",
    "name": "CSV",
    "import": () => import("./csv-AX7GV7XH.js")
  },
  {
    "id": "cue",
    "name": "CUE",
    "import": () => import("./cue-6UGL7NGN.js")
  },
  {
    "id": "cypher",
    "name": "Cypher",
    "aliases": [
      "cql"
    ],
    "import": () => import("./cypher-HJSVG2T7.js")
  },
  {
    "id": "d",
    "name": "D",
    "import": () => import("./d-X6KHDP7Y.js")
  },
  {
    "id": "dart",
    "name": "Dart",
    "import": () => import("./dart-LJTBUPI6.js")
  },
  {
    "id": "dax",
    "name": "DAX",
    "import": () => import("./dax-5OLLL7VL.js")
  },
  {
    "id": "desktop",
    "name": "Desktop",
    "import": () => import("./desktop-RMP4V57G.js")
  },
  {
    "id": "diff",
    "name": "Diff",
    "import": () => import("./diff-E25YWEXQ.js")
  },
  {
    "id": "docker",
    "name": "Dockerfile",
    "aliases": [
      "dockerfile"
    ],
    "import": () => import("./docker-WEGPKJR7.js")
  },
  {
    "id": "dotenv",
    "name": "dotEnv",
    "import": () => import("./dotenv-BPGDIBRD.js")
  },
  {
    "id": "dream-maker",
    "name": "Dream Maker",
    "import": () => import("./dream-maker-7SWYMS7K.js")
  },
  {
    "id": "edge",
    "name": "Edge",
    "import": () => import("./edge-AWYPRJTH.js")
  },
  {
    "id": "elixir",
    "name": "Elixir",
    "import": () => import("./elixir-FORRHJPY.js")
  },
  {
    "id": "elm",
    "name": "Elm",
    "import": () => import("./elm-HQJZNZGZ.js")
  },
  {
    "id": "emacs-lisp",
    "name": "Emacs Lisp",
    "aliases": [
      "elisp"
    ],
    "import": () => import("./emacs-lisp-LUKPSKXO.js")
  },
  {
    "id": "erb",
    "name": "ERB",
    "import": () => import("./erb-GQYRP5QQ.js")
  },
  {
    "id": "erlang",
    "name": "Erlang",
    "aliases": [
      "erl"
    ],
    "import": () => import("./erlang-E5QMKSMJ.js")
  },
  {
    "id": "fennel",
    "name": "Fennel",
    "import": () => import("./fennel-ZQ3YNGUP.js")
  },
  {
    "id": "fish",
    "name": "Fish",
    "import": () => import("./fish-MXS4LZQC.js")
  },
  {
    "id": "fluent",
    "name": "Fluent",
    "aliases": [
      "ftl"
    ],
    "import": () => import("./fluent-ECFKRKLV.js")
  },
  {
    "id": "fortran-fixed-form",
    "name": "Fortran (Fixed Form)",
    "aliases": [
      "f",
      "for",
      "f77"
    ],
    "import": () => import("./fortran-fixed-form-GW5PN37L.js")
  },
  {
    "id": "fortran-free-form",
    "name": "Fortran (Free Form)",
    "aliases": [
      "f90",
      "f95",
      "f03",
      "f08",
      "f18"
    ],
    "import": () => import("./fortran-free-form-XC2WQ33Y.js")
  },
  {
    "id": "fsharp",
    "name": "F#",
    "aliases": [
      "f#",
      "fs"
    ],
    "import": () => import("./fsharp-3LI2DG3T.js")
  },
  {
    "id": "gdresource",
    "name": "GDResource",
    "aliases": [
      "tscn",
      "tres"
    ],
    "import": () => import("./gdresource-GDLNDXDF.js")
  },
  {
    "id": "gdscript",
    "name": "GDScript",
    "aliases": [
      "gd"
    ],
    "import": () => import("./gdscript-WX7AZ3IR.js")
  },
  {
    "id": "gdshader",
    "name": "GDShader",
    "import": () => import("./gdshader-H6AAYLVX.js")
  },
  {
    "id": "genie",
    "name": "Genie",
    "import": () => import("./genie-RKEGM4ZU.js")
  },
  {
    "id": "gherkin",
    "name": "Gherkin",
    "import": () => import("./gherkin-2J5BAVA7.js")
  },
  {
    "id": "git-commit",
    "name": "Git Commit Message",
    "import": () => import("./git-commit-M5ISJGDZ.js")
  },
  {
    "id": "git-rebase",
    "name": "Git Rebase Message",
    "import": () => import("./git-rebase-WIBXBFOZ.js")
  },
  {
    "id": "gleam",
    "name": "Gleam",
    "import": () => import("./gleam-SRTMXZ2W.js")
  },
  {
    "id": "glimmer-js",
    "name": "Glimmer JS",
    "aliases": [
      "gjs"
    ],
    "import": () => import("./glimmer-js-YM7YEQPS.js")
  },
  {
    "id": "glimmer-ts",
    "name": "Glimmer TS",
    "aliases": [
      "gts"
    ],
    "import": () => import("./glimmer-ts-URPW6TAH.js")
  },
  {
    "id": "glsl",
    "name": "GLSL",
    "import": () => import("./glsl-22ZWMID5.js")
  },
  {
    "id": "gn",
    "name": "GN",
    "import": () => import("./gn-ILIEBDEV.js")
  },
  {
    "id": "gnuplot",
    "name": "Gnuplot",
    "import": () => import("./gnuplot-HO6I637C.js")
  },
  {
    "id": "go",
    "name": "Go",
    "import": () => import("./go-NPGKNT7P.js")
  },
  {
    "id": "graphql",
    "name": "GraphQL",
    "aliases": [
      "gql"
    ],
    "import": () => import("./graphql-QJ5BPUJH.js")
  },
  {
    "id": "groovy",
    "name": "Groovy",
    "import": () => import("./groovy-G4VHHG46.js")
  },
  {
    "id": "hack",
    "name": "Hack",
    "import": () => import("./hack-46GK32VS.js")
  },
  {
    "id": "haml",
    "name": "Ruby Haml",
    "import": () => import("./haml-WT2VFWD2.js")
  },
  {
    "id": "handlebars",
    "name": "Handlebars",
    "aliases": [
      "hbs"
    ],
    "import": () => import("./handlebars-K6E7UL6S.js")
  },
  {
    "id": "haskell",
    "name": "Haskell",
    "aliases": [
      "hs"
    ],
    "import": () => import("./haskell-SPW53RHQ.js")
  },
  {
    "id": "haxe",
    "name": "Haxe",
    "import": () => import("./haxe-TQUC4CIV.js")
  },
  {
    "id": "hcl",
    "name": "HashiCorp HCL",
    "import": () => import("./hcl-S3JD3UKK.js")
  },
  {
    "id": "hjson",
    "name": "Hjson",
    "import": () => import("./hjson-QMGEOTRR.js")
  },
  {
    "id": "hlsl",
    "name": "HLSL",
    "import": () => import("./hlsl-3LD53PDL.js")
  },
  {
    "id": "html",
    "name": "HTML",
    "import": () => import("./html-W4EVLQOH.js")
  },
  {
    "id": "html-derivative",
    "name": "HTML (Derivative)",
    "import": () => import("./html-derivative-ZE753MIT.js")
  },
  {
    "id": "http",
    "name": "HTTP",
    "import": () => import("./http-3Z5I2UK4.js")
  },
  {
    "id": "hurl",
    "name": "Hurl",
    "import": () => import("./hurl-VTM2TERI.js")
  },
  {
    "id": "hxml",
    "name": "HXML",
    "import": () => import("./hxml-WK2UW2DS.js")
  },
  {
    "id": "hy",
    "name": "Hy",
    "import": () => import("./hy-JZ36YGEZ.js")
  },
  {
    "id": "imba",
    "name": "Imba",
    "import": () => import("./imba-JX7HGT4X.js")
  },
  {
    "id": "ini",
    "name": "INI",
    "aliases": [
      "properties"
    ],
    "import": () => import("./ini-PWPFHXAQ.js")
  },
  {
    "id": "java",
    "name": "Java",
    "import": () => import("./java-24GU4JL7.js")
  },
  {
    "id": "javascript",
    "name": "JavaScript",
    "aliases": [
      "js",
      "cjs",
      "mjs"
    ],
    "import": () => import("./javascript-MA633AEN.js")
  },
  {
    "id": "jinja",
    "name": "Jinja",
    "import": () => import("./jinja-PQ4CKPP6.js")
  },
  {
    "id": "jison",
    "name": "Jison",
    "import": () => import("./jison-RM5AOQTM.js")
  },
  {
    "id": "json",
    "name": "JSON",
    "import": () => import("./json-4VIEIDSM.js")
  },
  {
    "id": "json5",
    "name": "JSON5",
    "import": () => import("./json5-EYPVSUPL.js")
  },
  {
    "id": "jsonc",
    "name": "JSON with Comments",
    "import": () => import("./jsonc-PMGJPPI2.js")
  },
  {
    "id": "jsonl",
    "name": "JSON Lines",
    "import": () => import("./jsonl-ATAUCABW.js")
  },
  {
    "id": "jsonnet",
    "name": "Jsonnet",
    "import": () => import("./jsonnet-QA2NSSIK.js")
  },
  {
    "id": "jssm",
    "name": "JSSM",
    "aliases": [
      "fsl"
    ],
    "import": () => import("./jssm-TIAQQMW3.js")
  },
  {
    "id": "jsx",
    "name": "JSX",
    "import": () => import("./jsx-OQYMYFHN.js")
  },
  {
    "id": "julia",
    "name": "Julia",
    "aliases": [
      "jl"
    ],
    "import": () => import("./julia-S46UZDYA.js")
  },
  {
    "id": "just",
    "name": "Just",
    "import": () => import("./just-BUVKT7GV.js")
  },
  {
    "id": "kdl",
    "name": "KDL",
    "import": () => import("./kdl-7TT25JY6.js")
  },
  {
    "id": "kotlin",
    "name": "Kotlin",
    "aliases": [
      "kt",
      "kts"
    ],
    "import": () => import("./kotlin-6J6OGQLK.js")
  },
  {
    "id": "kusto",
    "name": "Kusto",
    "aliases": [
      "kql"
    ],
    "import": () => import("./kusto-EOQH2S3P.js")
  },
  {
    "id": "latex",
    "name": "LaTeX",
    "import": () => import("./latex-FNQQ6NYA.js")
  },
  {
    "id": "lean",
    "name": "Lean 4",
    "aliases": [
      "lean4"
    ],
    "import": () => import("./lean-44PEE2GE.js")
  },
  {
    "id": "less",
    "name": "Less",
    "import": () => import("./less-DGPG4GTL.js")
  },
  {
    "id": "liquid",
    "name": "Liquid",
    "import": () => import("./liquid-YE2MZX4X.js")
  },
  {
    "id": "llvm",
    "name": "LLVM IR",
    "import": () => import("./llvm-FNGAUZQ4.js")
  },
  {
    "id": "log",
    "name": "Log file",
    "import": () => import("./log-PAJCCNO5.js")
  },
  {
    "id": "logo",
    "name": "Logo",
    "import": () => import("./logo-KTKXVC74.js")
  },
  {
    "id": "lua",
    "name": "Lua",
    "import": () => import("./lua-IHORMBFJ.js")
  },
  {
    "id": "luau",
    "name": "Luau",
    "import": () => import("./luau-Y4KIEJBV.js")
  },
  {
    "id": "make",
    "name": "Makefile",
    "aliases": [
      "makefile"
    ],
    "import": () => import("./make-622QY4UK.js")
  },
  {
    "id": "markdown",
    "name": "Markdown",
    "aliases": [
      "md"
    ],
    "import": () => import("./markdown-MGOGZRCK.js")
  },
  {
    "id": "marko",
    "name": "Marko",
    "import": () => import("./marko-7Y37U7VC.js")
  },
  {
    "id": "matlab",
    "name": "MATLAB",
    "import": () => import("./matlab-BKBIWEDJ.js")
  },
  {
    "id": "mdc",
    "name": "MDC",
    "import": () => import("./mdc-UHPDZSVU.js")
  },
  {
    "id": "mdx",
    "name": "MDX",
    "import": () => import("./mdx-XHIX35VA.js")
  },
  {
    "id": "mermaid",
    "name": "Mermaid",
    "aliases": [
      "mmd"
    ],
    "import": () => import("./mermaid-EB4GS4J7.js")
  },
  {
    "id": "mipsasm",
    "name": "MIPS Assembly",
    "aliases": [
      "mips"
    ],
    "import": () => import("./mipsasm-R3TCDBSR.js")
  },
  {
    "id": "mojo",
    "name": "Mojo",
    "import": () => import("./mojo-5QG43DJW.js")
  },
  {
    "id": "moonbit",
    "name": "MoonBit",
    "aliases": [
      "mbt",
      "mbti"
    ],
    "import": () => import("./moonbit-WPIERME2.js")
  },
  {
    "id": "move",
    "name": "Move",
    "import": () => import("./move-U3WM3MPE.js")
  },
  {
    "id": "narrat",
    "name": "Narrat Language",
    "aliases": [
      "nar"
    ],
    "import": () => import("./narrat-PKSUNAHT.js")
  },
  {
    "id": "nextflow",
    "name": "Nextflow",
    "aliases": [
      "nf"
    ],
    "import": () => import("./nextflow-GIS7XM3Z.js")
  },
  {
    "id": "nextflow-groovy",
    "name": "nextflow-groovy",
    "import": () => import("./nextflow-groovy-OREJPXCK.js")
  },
  {
    "id": "nginx",
    "name": "Nginx",
    "import": () => import("./nginx-43FFYM23.js")
  },
  {
    "id": "nim",
    "name": "Nim",
    "import": () => import("./nim-Z4CXXVBP.js")
  },
  {
    "id": "nix",
    "name": "Nix",
    "import": () => import("./nix-ZY7RPXUC.js")
  },
  {
    "id": "nushell",
    "name": "nushell",
    "aliases": [
      "nu"
    ],
    "import": () => import("./nushell-J4TZIVCD.js")
  },
  {
    "id": "objective-c",
    "name": "Objective-C",
    "aliases": [
      "objc"
    ],
    "import": () => import("./objective-c-BJ7PEIGX.js")
  },
  {
    "id": "objective-cpp",
    "name": "Objective-C++",
    "import": () => import("./objective-cpp-3NTFLSJI.js")
  },
  {
    "id": "ocaml",
    "name": "OCaml",
    "import": () => import("./ocaml-XQN3BR4Q.js")
  },
  {
    "id": "odin",
    "name": "Odin",
    "import": () => import("./odin-SAFWKJWZ.js")
  },
  {
    "id": "openscad",
    "name": "OpenSCAD",
    "aliases": [
      "scad"
    ],
    "import": () => import("./openscad-WVATIZPI.js")
  },
  {
    "id": "pascal",
    "name": "Pascal",
    "import": () => import("./pascal-TFREQ4CX.js")
  },
  {
    "id": "perl",
    "name": "Perl",
    "import": () => import("./perl-RXQE35PD.js")
  },
  {
    "id": "php",
    "name": "PHP",
    "import": () => import("./php-NT7VDYW6.js")
  },
  {
    "id": "pkl",
    "name": "Pkl",
    "import": () => import("./pkl-IBC6IQIN.js")
  },
  {
    "id": "plsql",
    "name": "PL/SQL",
    "import": () => import("./plsql-UFFPUEIT.js")
  },
  {
    "id": "po",
    "name": "Gettext PO",
    "aliases": [
      "pot",
      "potx"
    ],
    "import": () => import("./po-GMKCZ3TH.js")
  },
  {
    "id": "polar",
    "name": "Polar",
    "import": () => import("./polar-XGXDSLI5.js")
  },
  {
    "id": "postcss",
    "name": "PostCSS",
    "import": () => import("./postcss-CEPZIBDD.js")
  },
  {
    "id": "powerquery",
    "name": "PowerQuery",
    "import": () => import("./powerquery-PMWPSTGT.js")
  },
  {
    "id": "powershell",
    "name": "PowerShell",
    "aliases": [
      "ps",
      "ps1"
    ],
    "import": () => import("./powershell-RIT2N7KL.js")
  },
  {
    "id": "prisma",
    "name": "Prisma",
    "import": () => import("./prisma-F3RQJSEX.js")
  },
  {
    "id": "prolog",
    "name": "Prolog",
    "import": () => import("./prolog-I7PRW5LP.js")
  },
  {
    "id": "proto",
    "name": "Protocol Buffer 3",
    "aliases": [
      "protobuf"
    ],
    "import": () => import("./proto-UYNAAFMR.js")
  },
  {
    "id": "pug",
    "name": "Pug",
    "aliases": [
      "jade"
    ],
    "import": () => import("./pug-LFQYC2L2.js")
  },
  {
    "id": "puppet",
    "name": "Puppet",
    "import": () => import("./puppet-U23UKOFY.js")
  },
  {
    "id": "purescript",
    "name": "PureScript",
    "import": () => import("./purescript-YH2PSIZX.js")
  },
  {
    "id": "python",
    "name": "Python",
    "aliases": [
      "py"
    ],
    "import": () => import("./python-A3J2K2GP.js")
  },
  {
    "id": "qml",
    "name": "QML",
    "import": () => import("./qml-23CXGX6S.js")
  },
  {
    "id": "qmldir",
    "name": "QML Directory",
    "import": () => import("./qmldir-ET62AGJA.js")
  },
  {
    "id": "qss",
    "name": "Qt Style Sheets",
    "import": () => import("./qss-SJBPAE3Q.js")
  },
  {
    "id": "r",
    "name": "R",
    "import": () => import("./r-UKVA4EJO.js")
  },
  {
    "id": "racket",
    "name": "Racket",
    "import": () => import("./racket-LOGEQANN.js")
  },
  {
    "id": "raku",
    "name": "Raku",
    "aliases": [
      "perl6"
    ],
    "import": () => import("./raku-BTF65KJU.js")
  },
  {
    "id": "razor",
    "name": "ASP.NET Razor",
    "import": () => import("./razor-OMD42AY7.js")
  },
  {
    "id": "reg",
    "name": "Windows Registry Script",
    "import": () => import("./reg-3CAHDTY5.js")
  },
  {
    "id": "regexp",
    "name": "RegExp",
    "aliases": [
      "regex"
    ],
    "import": () => import("./regexp-QSGTTN4V.js")
  },
  {
    "id": "rel",
    "name": "Rel",
    "import": () => import("./rel-WHJEKFNC.js")
  },
  {
    "id": "riscv",
    "name": "RISC-V",
    "import": () => import("./riscv-GCOSTRJW.js")
  },
  {
    "id": "ron",
    "name": "RON",
    "import": () => import("./ron-GPHDO7TN.js")
  },
  {
    "id": "rosmsg",
    "name": "ROS Interface",
    "import": () => import("./rosmsg-HHH4OXCA.js")
  },
  {
    "id": "rst",
    "name": "reStructuredText",
    "import": () => import("./rst-OE42B4NY.js")
  },
  {
    "id": "ruby",
    "name": "Ruby",
    "aliases": [
      "rb"
    ],
    "import": () => import("./ruby-W2XSAEOH.js")
  },
  {
    "id": "rust",
    "name": "Rust",
    "aliases": [
      "rs"
    ],
    "import": () => import("./rust-W74QJA7V.js")
  },
  {
    "id": "sas",
    "name": "SAS",
    "import": () => import("./sas-ONM24GKT.js")
  },
  {
    "id": "sass",
    "name": "Sass",
    "import": () => import("./sass-WUL7Y7K5.js")
  },
  {
    "id": "scala",
    "name": "Scala",
    "import": () => import("./scala-HAX5DCI2.js")
  },
  {
    "id": "scheme",
    "name": "Scheme",
    "import": () => import("./scheme-VVS4HKQ4.js")
  },
  {
    "id": "scss",
    "name": "SCSS",
    "import": () => import("./scss-RNERKSV2.js")
  },
  {
    "id": "sdbl",
    "name": "1C (Query)",
    "aliases": [
      "1c-query"
    ],
    "import": () => import("./sdbl-OCNJIHST.js")
  },
  {
    "id": "shaderlab",
    "name": "ShaderLab",
    "aliases": [
      "shader"
    ],
    "import": () => import("./shaderlab-MBNRTDEP.js")
  },
  {
    "id": "shellscript",
    "name": "Shell",
    "aliases": [
      "bash",
      "sh",
      "shell",
      "zsh"
    ],
    "import": () => import("./shellscript-V377NIOJ.js")
  },
  {
    "id": "shellsession",
    "name": "Shell Session",
    "aliases": [
      "console"
    ],
    "import": () => import("./shellsession-FZA3PSCI.js")
  },
  {
    "id": "smalltalk",
    "name": "Smalltalk",
    "import": () => import("./smalltalk-BPITXFQT.js")
  },
  {
    "id": "solidity",
    "name": "Solidity",
    "import": () => import("./solidity-AK5ZZQHF.js")
  },
  {
    "id": "soy",
    "name": "Closure Templates",
    "aliases": [
      "closure-templates"
    ],
    "import": () => import("./soy-PKEBG4S4.js")
  },
  {
    "id": "sparql",
    "name": "SPARQL",
    "import": () => import("./sparql-LDXLEIZ2.js")
  },
  {
    "id": "splunk",
    "name": "Splunk Query Language",
    "aliases": [
      "spl"
    ],
    "import": () => import("./splunk-TXFIPDMU.js")
  },
  {
    "id": "sql",
    "name": "SQL",
    "import": () => import("./sql-25J6PYXS.js")
  },
  {
    "id": "ssh-config",
    "name": "SSH Config",
    "import": () => import("./ssh-config-L6PE4KZO.js")
  },
  {
    "id": "stata",
    "name": "Stata",
    "import": () => import("./stata-4M6O77K6.js")
  },
  {
    "id": "stylus",
    "name": "Stylus",
    "aliases": [
      "styl"
    ],
    "import": () => import("./stylus-NUNX232Q.js")
  },
  {
    "id": "surrealql",
    "name": "SurrealQL",
    "aliases": [
      "surql"
    ],
    "import": () => import("./surrealql-X7AIDX4Z.js")
  },
  {
    "id": "svelte",
    "name": "Svelte",
    "import": () => import("./svelte-UR4AZWPE.js")
  },
  {
    "id": "swift",
    "name": "Swift",
    "import": () => import("./swift-DU6CYVS2.js")
  },
  {
    "id": "system-verilog",
    "name": "SystemVerilog",
    "import": () => import("./system-verilog-CJ3LFGML.js")
  },
  {
    "id": "systemd",
    "name": "Systemd Units",
    "import": () => import("./systemd-TEWK4CTK.js")
  },
  {
    "id": "talonscript",
    "name": "TalonScript",
    "aliases": [
      "talon"
    ],
    "import": () => import("./talonscript-FSHJYGEM.js")
  },
  {
    "id": "tasl",
    "name": "Tasl",
    "import": () => import("./tasl-4456SWDY.js")
  },
  {
    "id": "tcl",
    "name": "Tcl",
    "import": () => import("./tcl-CIBSLL6V.js")
  },
  {
    "id": "templ",
    "name": "Templ",
    "import": () => import("./templ-GMM4QYHF.js")
  },
  {
    "id": "terraform",
    "name": "Terraform",
    "aliases": [
      "tf",
      "tfvars"
    ],
    "import": () => import("./terraform-6VPJWXFV.js")
  },
  {
    "id": "tex",
    "name": "TeX",
    "import": () => import("./tex-6PEYRDIZ.js")
  },
  {
    "id": "toml",
    "name": "TOML",
    "import": () => import("./toml-HYC6Z7BT.js")
  },
  {
    "id": "ts-tags",
    "name": "TypeScript with Tags",
    "aliases": [
      "lit"
    ],
    "import": () => import("./ts-tags-QV6MYIW3.js")
  },
  {
    "id": "tsv",
    "name": "TSV",
    "import": () => import("./tsv-2ONJHPDK.js")
  },
  {
    "id": "tsx",
    "name": "TSX",
    "import": () => import("./tsx-H4RGMGPJ.js")
  },
  {
    "id": "turtle",
    "name": "Turtle",
    "import": () => import("./turtle-KBUAEWQC.js")
  },
  {
    "id": "twig",
    "name": "Twig",
    "import": () => import("./twig-LQGS3N5C.js")
  },
  {
    "id": "typescript",
    "name": "TypeScript",
    "aliases": [
      "ts",
      "cts",
      "mts"
    ],
    "import": () => import("./typescript-GP3XKMLU.js")
  },
  {
    "id": "typespec",
    "name": "TypeSpec",
    "aliases": [
      "tsp"
    ],
    "import": () => import("./typespec-6NECOPSP.js")
  },
  {
    "id": "typst",
    "name": "Typst",
    "aliases": [
      "typ"
    ],
    "import": () => import("./typst-PMMY63FA.js")
  },
  {
    "id": "v",
    "name": "V",
    "import": () => import("./v-5F75AUIW.js")
  },
  {
    "id": "vala",
    "name": "Vala",
    "import": () => import("./vala-XCVRFWYW.js")
  },
  {
    "id": "vb",
    "name": "Visual Basic",
    "aliases": [
      "cmd"
    ],
    "import": () => import("./vb-DVGTVZY5.js")
  },
  {
    "id": "verilog",
    "name": "Verilog",
    "import": () => import("./verilog-DZOTGZBQ.js")
  },
  {
    "id": "vhdl",
    "name": "VHDL",
    "import": () => import("./vhdl-IKAAOGS3.js")
  },
  {
    "id": "viml",
    "name": "Vim Script",
    "aliases": [
      "vim",
      "vimscript"
    ],
    "import": () => import("./viml-UVDODSOC.js")
  },
  {
    "id": "vue",
    "name": "Vue",
    "import": () => import("./vue-5TJXF5R3.js")
  },
  {
    "id": "vue-html",
    "name": "Vue HTML",
    "import": () => import("./vue-html-NCZEC3MJ.js")
  },
  {
    "id": "vue-vine",
    "name": "Vue Vine",
    "import": () => import("./vue-vine-PY6DG3N5.js")
  },
  {
    "id": "vyper",
    "name": "Vyper",
    "aliases": [
      "vy"
    ],
    "import": () => import("./vyper-65RFM3IW.js")
  },
  {
    "id": "wasm",
    "name": "WebAssembly",
    "import": () => import("./wasm-Y6O45O3J.js")
  },
  {
    "id": "wenyan",
    "name": "Wenyan",
    "aliases": [
      "\u6587\u8A00"
    ],
    "import": () => import("./wenyan-WJ5HO7FL.js")
  },
  {
    "id": "wgsl",
    "name": "WGSL",
    "import": () => import("./wgsl-TL5J5SAP.js")
  },
  {
    "id": "wikitext",
    "name": "Wikitext",
    "aliases": [
      "mediawiki",
      "wiki"
    ],
    "import": () => import("./wikitext-4VZLZV63.js")
  },
  {
    "id": "wit",
    "name": "WebAssembly Interface Types",
    "import": () => import("./wit-ZR67MPSV.js")
  },
  {
    "id": "wolfram",
    "name": "Wolfram",
    "aliases": [
      "wl"
    ],
    "import": () => import("./wolfram-CPTL45KD.js")
  },
  {
    "id": "xml",
    "name": "XML",
    "import": () => import("./xml-PL65JLVD.js")
  },
  {
    "id": "xsl",
    "name": "XSL",
    "import": () => import("./xsl-2YZIJR52.js")
  },
  {
    "id": "yaml",
    "name": "YAML",
    "aliases": [
      "yml"
    ],
    "import": () => import("./yaml-2O4PZKPU.js")
  },
  {
    "id": "zenscript",
    "name": "ZenScript",
    "import": () => import("./zenscript-ZPMYMKSP.js")
  },
  {
    "id": "zig",
    "name": "Zig",
    "import": () => import("./zig-LULJEU2T.js")
  }
];
var bundledLanguagesBase = Object.fromEntries(bundledLanguagesInfo.map((i2) => [i2.id, i2.import]));
var bundledLanguagesAlias = Object.fromEntries(bundledLanguagesInfo.flatMap((i2) => i2.aliases?.map((a2) => [a2, i2.import]) || []));
var bundledLanguages = {
  ...bundledLanguagesBase,
  ...bundledLanguagesAlias
};

// node_modules/.pnpm/shiki@3.23.0/node_modules/shiki/dist/themes.mjs
var bundledThemesInfo = [
  {
    "id": "andromeeda",
    "displayName": "Andromeeda",
    "type": "dark",
    "import": () => import("./andromeeda-L74BO3SJ.js")
  },
  {
    "id": "aurora-x",
    "displayName": "Aurora X",
    "type": "dark",
    "import": () => import("./aurora-x-KXHOSZG4.js")
  },
  {
    "id": "ayu-dark",
    "displayName": "Ayu Dark",
    "type": "dark",
    "import": () => import("./ayu-dark-Q74NIELL.js")
  },
  {
    "id": "ayu-light",
    "displayName": "Ayu Light",
    "type": "light",
    "import": () => import("./ayu-light-WSG22OQU.js")
  },
  {
    "id": "ayu-mirage",
    "displayName": "Ayu Mirage",
    "type": "dark",
    "import": () => import("./ayu-mirage-5GAQKCT3.js")
  },
  {
    "id": "catppuccin-frappe",
    "displayName": "Catppuccin Frapp\xE9",
    "type": "dark",
    "import": () => import("./catppuccin-frappe-Z2EKF37W.js")
  },
  {
    "id": "catppuccin-latte",
    "displayName": "Catppuccin Latte",
    "type": "light",
    "import": () => import("./catppuccin-latte-6U7I7B7V.js")
  },
  {
    "id": "catppuccin-macchiato",
    "displayName": "Catppuccin Macchiato",
    "type": "dark",
    "import": () => import("./catppuccin-macchiato-GJ7XZ6UI.js")
  },
  {
    "id": "catppuccin-mocha",
    "displayName": "Catppuccin Mocha",
    "type": "dark",
    "import": () => import("./catppuccin-mocha-DSHK7GZG.js")
  },
  {
    "id": "dark-plus",
    "displayName": "Dark Plus",
    "type": "dark",
    "import": () => import("./dark-plus-H7ZMAIBK.js")
  },
  {
    "id": "dracula",
    "displayName": "Dracula Theme",
    "type": "dark",
    "import": () => import("./dracula-DYDWZLHR.js")
  },
  {
    "id": "dracula-soft",
    "displayName": "Dracula Theme Soft",
    "type": "dark",
    "import": () => import("./dracula-soft-IHXHMAID.js")
  },
  {
    "id": "everforest-dark",
    "displayName": "Everforest Dark",
    "type": "dark",
    "import": () => import("./everforest-dark-CZAH2X5E.js")
  },
  {
    "id": "everforest-light",
    "displayName": "Everforest Light",
    "type": "light",
    "import": () => import("./everforest-light-2LYJWQGF.js")
  },
  {
    "id": "github-dark",
    "displayName": "GitHub Dark",
    "type": "dark",
    "import": () => import("./github-dark-MYWJR2XU.js")
  },
  {
    "id": "github-dark-default",
    "displayName": "GitHub Dark Default",
    "type": "dark",
    "import": () => import("./github-dark-default-TQRBOWGQ.js")
  },
  {
    "id": "github-dark-dimmed",
    "displayName": "GitHub Dark Dimmed",
    "type": "dark",
    "import": () => import("./github-dark-dimmed-BRQ4CVK7.js")
  },
  {
    "id": "github-dark-high-contrast",
    "displayName": "GitHub Dark High Contrast",
    "type": "dark",
    "import": () => import("./github-dark-high-contrast-AWQ46RRF.js")
  },
  {
    "id": "github-light",
    "displayName": "GitHub Light",
    "type": "light",
    "import": () => import("./github-light-THRXIWIS.js")
  },
  {
    "id": "github-light-default",
    "displayName": "GitHub Light Default",
    "type": "light",
    "import": () => import("./github-light-default-5C7YXQ6Y.js")
  },
  {
    "id": "github-light-high-contrast",
    "displayName": "GitHub Light High Contrast",
    "type": "light",
    "import": () => import("./github-light-high-contrast-H24XXUHS.js")
  },
  {
    "id": "gruvbox-dark-hard",
    "displayName": "Gruvbox Dark Hard",
    "type": "dark",
    "import": () => import("./gruvbox-dark-hard-2CPZMQZA.js")
  },
  {
    "id": "gruvbox-dark-medium",
    "displayName": "Gruvbox Dark Medium",
    "type": "dark",
    "import": () => import("./gruvbox-dark-medium-TE2FPL2G.js")
  },
  {
    "id": "gruvbox-dark-soft",
    "displayName": "Gruvbox Dark Soft",
    "type": "dark",
    "import": () => import("./gruvbox-dark-soft-JTGDH2QC.js")
  },
  {
    "id": "gruvbox-light-hard",
    "displayName": "Gruvbox Light Hard",
    "type": "light",
    "import": () => import("./gruvbox-light-hard-2KQ63FGT.js")
  },
  {
    "id": "gruvbox-light-medium",
    "displayName": "Gruvbox Light Medium",
    "type": "light",
    "import": () => import("./gruvbox-light-medium-Y6AILFHJ.js")
  },
  {
    "id": "gruvbox-light-soft",
    "displayName": "Gruvbox Light Soft",
    "type": "light",
    "import": () => import("./gruvbox-light-soft-AHP7EIOS.js")
  },
  {
    "id": "horizon",
    "displayName": "Horizon",
    "type": "dark",
    "import": () => import("./horizon-2UGXGGM5.js")
  },
  {
    "id": "horizon-bright",
    "displayName": "Horizon Bright",
    "type": "dark",
    "import": () => import("./horizon-bright-APCVTVPN.js")
  },
  {
    "id": "houston",
    "displayName": "Houston",
    "type": "dark",
    "import": () => import("./houston-MZ3LIXVO.js")
  },
  {
    "id": "kanagawa-dragon",
    "displayName": "Kanagawa Dragon",
    "type": "dark",
    "import": () => import("./kanagawa-dragon-FQ57UUB2.js")
  },
  {
    "id": "kanagawa-lotus",
    "displayName": "Kanagawa Lotus",
    "type": "light",
    "import": () => import("./kanagawa-lotus-MYUUYMQR.js")
  },
  {
    "id": "kanagawa-wave",
    "displayName": "Kanagawa Wave",
    "type": "dark",
    "import": () => import("./kanagawa-wave-DZE6IKDA.js")
  },
  {
    "id": "laserwave",
    "displayName": "LaserWave",
    "type": "dark",
    "import": () => import("./laserwave-HY5O6EJN.js")
  },
  {
    "id": "light-plus",
    "displayName": "Light Plus",
    "type": "light",
    "import": () => import("./light-plus-ZLFXFFR3.js")
  },
  {
    "id": "material-theme",
    "displayName": "Material Theme",
    "type": "dark",
    "import": () => import("./material-theme-HQTGQJ2V.js")
  },
  {
    "id": "material-theme-darker",
    "displayName": "Material Theme Darker",
    "type": "dark",
    "import": () => import("./material-theme-darker-XCUNSDMW.js")
  },
  {
    "id": "material-theme-lighter",
    "displayName": "Material Theme Lighter",
    "type": "light",
    "import": () => import("./material-theme-lighter-E5ZM4SVL.js")
  },
  {
    "id": "material-theme-ocean",
    "displayName": "Material Theme Ocean",
    "type": "dark",
    "import": () => import("./material-theme-ocean-2O4TLBTT.js")
  },
  {
    "id": "material-theme-palenight",
    "displayName": "Material Theme Palenight",
    "type": "dark",
    "import": () => import("./material-theme-palenight-6H6YXBVG.js")
  },
  {
    "id": "min-dark",
    "displayName": "Min Dark",
    "type": "dark",
    "import": () => import("./min-dark-N7RZ6BFP.js")
  },
  {
    "id": "min-light",
    "displayName": "Min Light",
    "type": "light",
    "import": () => import("./min-light-G4BSDPCY.js")
  },
  {
    "id": "monokai",
    "displayName": "Monokai",
    "type": "dark",
    "import": () => import("./monokai-H6OVCK7X.js")
  },
  {
    "id": "night-owl",
    "displayName": "Night Owl",
    "type": "dark",
    "import": () => import("./night-owl-MCUEDN2U.js")
  },
  {
    "id": "night-owl-light",
    "displayName": "Night Owl Light",
    "type": "light",
    "import": () => import("./night-owl-light-GDFRB53C.js")
  },
  {
    "id": "nord",
    "displayName": "Nord",
    "type": "dark",
    "import": () => import("./nord-NPIACNEN.js")
  },
  {
    "id": "one-dark-pro",
    "displayName": "One Dark Pro",
    "type": "dark",
    "import": () => import("./one-dark-pro-QQUHLYRG.js")
  },
  {
    "id": "one-light",
    "displayName": "One Light",
    "type": "light",
    "import": () => import("./one-light-WKKPORCD.js")
  },
  {
    "id": "plastic",
    "displayName": "Plastic",
    "type": "dark",
    "import": () => import("./plastic-3S2JQKEH.js")
  },
  {
    "id": "poimandres",
    "displayName": "Poimandres",
    "type": "dark",
    "import": () => import("./poimandres-QV5SYDV4.js")
  },
  {
    "id": "red",
    "displayName": "Red",
    "type": "dark",
    "import": () => import("./red-FFCCA4KJ.js")
  },
  {
    "id": "rose-pine",
    "displayName": "Ros\xE9 Pine",
    "type": "dark",
    "import": () => import("./rose-pine-5SIWS7X6.js")
  },
  {
    "id": "rose-pine-dawn",
    "displayName": "Ros\xE9 Pine Dawn",
    "type": "light",
    "import": () => import("./rose-pine-dawn-OBFQCHWO.js")
  },
  {
    "id": "rose-pine-moon",
    "displayName": "Ros\xE9 Pine Moon",
    "type": "dark",
    "import": () => import("./rose-pine-moon-5644F56F.js")
  },
  {
    "id": "slack-dark",
    "displayName": "Slack Dark",
    "type": "dark",
    "import": () => import("./slack-dark-REFT5ZUK.js")
  },
  {
    "id": "slack-ochin",
    "displayName": "Slack Ochin",
    "type": "light",
    "import": () => import("./slack-ochin-X5LO3XMF.js")
  },
  {
    "id": "snazzy-light",
    "displayName": "Snazzy Light",
    "type": "light",
    "import": () => import("./snazzy-light-ND7UEAMX.js")
  },
  {
    "id": "solarized-dark",
    "displayName": "Solarized Dark",
    "type": "dark",
    "import": () => import("./solarized-dark-TEFANJGG.js")
  },
  {
    "id": "solarized-light",
    "displayName": "Solarized Light",
    "type": "light",
    "import": () => import("./solarized-light-JCXYKXK4.js")
  },
  {
    "id": "synthwave-84",
    "displayName": "Synthwave '84",
    "type": "dark",
    "import": () => import("./synthwave-84-GAX4ASND.js")
  },
  {
    "id": "tokyo-night",
    "displayName": "Tokyo Night",
    "type": "dark",
    "import": () => import("./tokyo-night-XOCFM5WD.js")
  },
  {
    "id": "vesper",
    "displayName": "Vesper",
    "type": "dark",
    "import": () => import("./vesper-SISMGLFI.js")
  },
  {
    "id": "vitesse-black",
    "displayName": "Vitesse Black",
    "type": "dark",
    "import": () => import("./vitesse-black-KH4YM26P.js")
  },
  {
    "id": "vitesse-dark",
    "displayName": "Vitesse Dark",
    "type": "dark",
    "import": () => import("./vitesse-dark-326Y2LYP.js")
  },
  {
    "id": "vitesse-light",
    "displayName": "Vitesse Light",
    "type": "light",
    "import": () => import("./vitesse-light-G4ANTAWW.js")
  }
];
var bundledThemes = Object.fromEntries(bundledThemesInfo.map((i2) => [i2.id, i2.import]));

// node_modules/.pnpm/@shikijs+engine-oniguruma@3.23.0/node_modules/@shikijs/engine-oniguruma/dist/index.mjs
var ShikiError3 = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ShikiError";
  }
};
function getHeapMax() {
  return 2147483648;
}
function _emscripten_get_now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
var alignUp = (x3, multiple) => x3 + (multiple - x3 % multiple) % multiple;
async function main(init) {
  let wasmMemory;
  let buffer;
  const binding = {};
  function updateGlobalBufferAndViews(buf) {
    buffer = buf;
    binding.HEAPU8 = new Uint8Array(buf);
    binding.HEAPU32 = new Uint32Array(buf);
  }
  function _emscripten_memcpy_big(dest, src, num) {
    binding.HEAPU8.copyWithin(dest, src, src + num);
  }
  function emscripten_realloc_buffer(size) {
    try {
      wasmMemory.grow(size - buffer.byteLength + 65535 >>> 16);
      updateGlobalBufferAndViews(wasmMemory.buffer);
      return 1;
    } catch {
    }
  }
  function _emscripten_resize_heap(requestedSize) {
    const oldSize = binding.HEAPU8.length;
    requestedSize = requestedSize >>> 0;
    const maxHeapSize = getHeapMax();
    if (requestedSize > maxHeapSize)
      return false;
    for (let cutDown = 1; cutDown <= 4; cutDown *= 2) {
      let overGrownHeapSize = oldSize * (1 + 0.2 / cutDown);
      overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
      const newSize = Math.min(maxHeapSize, alignUp(Math.max(requestedSize, overGrownHeapSize), 65536));
      const replacement = emscripten_realloc_buffer(newSize);
      if (replacement)
        return true;
    }
    return false;
  }
  const UTF8Decoder = typeof TextDecoder != "undefined" ? new TextDecoder("utf8") : void 0;
  function UTF8ArrayToString(heapOrArray, idx, maxBytesToRead = 1024) {
    const endIdx = idx + maxBytesToRead;
    let endPtr = idx;
    while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr;
    if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
      return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
    }
    let str = "";
    while (idx < endPtr) {
      let u0 = heapOrArray[idx++];
      if (!(u0 & 128)) {
        str += String.fromCharCode(u0);
        continue;
      }
      const u1 = heapOrArray[idx++] & 63;
      if ((u0 & 224) === 192) {
        str += String.fromCharCode((u0 & 31) << 6 | u1);
        continue;
      }
      const u2 = heapOrArray[idx++] & 63;
      if ((u0 & 240) === 224) {
        u0 = (u0 & 15) << 12 | u1 << 6 | u2;
      } else {
        u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | heapOrArray[idx++] & 63;
      }
      if (u0 < 65536) {
        str += String.fromCharCode(u0);
      } else {
        const ch = u0 - 65536;
        str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
      }
    }
    return str;
  }
  function UTF8ToString(ptr, maxBytesToRead) {
    return ptr ? UTF8ArrayToString(binding.HEAPU8, ptr, maxBytesToRead) : "";
  }
  const asmLibraryArg = {
    emscripten_get_now: _emscripten_get_now,
    emscripten_memcpy_big: _emscripten_memcpy_big,
    emscripten_resize_heap: _emscripten_resize_heap,
    fd_write: () => 0
  };
  async function createWasm() {
    const info = {
      env: asmLibraryArg,
      wasi_snapshot_preview1: asmLibraryArg
    };
    const exports$1 = await init(info);
    wasmMemory = exports$1.memory;
    updateGlobalBufferAndViews(wasmMemory.buffer);
    Object.assign(binding, exports$1);
    binding.UTF8ToString = UTF8ToString;
  }
  await createWasm();
  return binding;
}
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key2, value) => key2 in obj ? __defProp(obj, key2, { enumerable: true, configurable: true, writable: true, value }) : obj[key2] = value;
var __publicField = (obj, key2, value) => __defNormalProp(obj, typeof key2 !== "symbol" ? key2 + "" : key2, value);
var onigBinding = null;
function throwLastOnigError(onigBinding2) {
  throw new ShikiError3(onigBinding2.UTF8ToString(onigBinding2.getLastOnigError()));
}
var UtfString = class _UtfString {
  constructor(str) {
    __publicField(this, "utf16Length");
    __publicField(this, "utf8Length");
    __publicField(this, "utf16Value");
    __publicField(this, "utf8Value");
    __publicField(this, "utf16OffsetToUtf8");
    __publicField(this, "utf8OffsetToUtf16");
    const utf16Length = str.length;
    const utf8Length = _UtfString._utf8ByteLength(str);
    const computeIndicesMapping = utf8Length !== utf16Length;
    const utf16OffsetToUtf8 = computeIndicesMapping ? new Uint32Array(utf16Length + 1) : null;
    if (computeIndicesMapping)
      utf16OffsetToUtf8[utf16Length] = utf8Length;
    const utf8OffsetToUtf16 = computeIndicesMapping ? new Uint32Array(utf8Length + 1) : null;
    if (computeIndicesMapping)
      utf8OffsetToUtf16[utf8Length] = utf16Length;
    const utf8Value = new Uint8Array(utf8Length);
    let i8 = 0;
    for (let i16 = 0; i16 < utf16Length; i16++) {
      const charCode = str.charCodeAt(i16);
      let codePoint = charCode;
      let wasSurrogatePair = false;
      if (charCode >= 55296 && charCode <= 56319) {
        if (i16 + 1 < utf16Length) {
          const nextCharCode = str.charCodeAt(i16 + 1);
          if (nextCharCode >= 56320 && nextCharCode <= 57343) {
            codePoint = (charCode - 55296 << 10) + 65536 | nextCharCode - 56320;
            wasSurrogatePair = true;
          }
        }
      }
      if (computeIndicesMapping) {
        utf16OffsetToUtf8[i16] = i8;
        if (wasSurrogatePair)
          utf16OffsetToUtf8[i16 + 1] = i8;
        if (codePoint <= 127) {
          utf8OffsetToUtf16[i8 + 0] = i16;
        } else if (codePoint <= 2047) {
          utf8OffsetToUtf16[i8 + 0] = i16;
          utf8OffsetToUtf16[i8 + 1] = i16;
        } else if (codePoint <= 65535) {
          utf8OffsetToUtf16[i8 + 0] = i16;
          utf8OffsetToUtf16[i8 + 1] = i16;
          utf8OffsetToUtf16[i8 + 2] = i16;
        } else {
          utf8OffsetToUtf16[i8 + 0] = i16;
          utf8OffsetToUtf16[i8 + 1] = i16;
          utf8OffsetToUtf16[i8 + 2] = i16;
          utf8OffsetToUtf16[i8 + 3] = i16;
        }
      }
      if (codePoint <= 127) {
        utf8Value[i8++] = codePoint;
      } else if (codePoint <= 2047) {
        utf8Value[i8++] = 192 | (codePoint & 1984) >>> 6;
        utf8Value[i8++] = 128 | (codePoint & 63) >>> 0;
      } else if (codePoint <= 65535) {
        utf8Value[i8++] = 224 | (codePoint & 61440) >>> 12;
        utf8Value[i8++] = 128 | (codePoint & 4032) >>> 6;
        utf8Value[i8++] = 128 | (codePoint & 63) >>> 0;
      } else {
        utf8Value[i8++] = 240 | (codePoint & 1835008) >>> 18;
        utf8Value[i8++] = 128 | (codePoint & 258048) >>> 12;
        utf8Value[i8++] = 128 | (codePoint & 4032) >>> 6;
        utf8Value[i8++] = 128 | (codePoint & 63) >>> 0;
      }
      if (wasSurrogatePair)
        i16++;
    }
    this.utf16Length = utf16Length;
    this.utf8Length = utf8Length;
    this.utf16Value = str;
    this.utf8Value = utf8Value;
    this.utf16OffsetToUtf8 = utf16OffsetToUtf8;
    this.utf8OffsetToUtf16 = utf8OffsetToUtf16;
  }
  static _utf8ByteLength(str) {
    let result = 0;
    for (let i2 = 0, len = str.length; i2 < len; i2++) {
      const charCode = str.charCodeAt(i2);
      let codepoint = charCode;
      let wasSurrogatePair = false;
      if (charCode >= 55296 && charCode <= 56319) {
        if (i2 + 1 < len) {
          const nextCharCode = str.charCodeAt(i2 + 1);
          if (nextCharCode >= 56320 && nextCharCode <= 57343) {
            codepoint = (charCode - 55296 << 10) + 65536 | nextCharCode - 56320;
            wasSurrogatePair = true;
          }
        }
      }
      if (codepoint <= 127)
        result += 1;
      else if (codepoint <= 2047)
        result += 2;
      else if (codepoint <= 65535)
        result += 3;
      else
        result += 4;
      if (wasSurrogatePair)
        i2++;
    }
    return result;
  }
  createString(onigBinding2) {
    const result = onigBinding2.omalloc(this.utf8Length);
    onigBinding2.HEAPU8.set(this.utf8Value, result);
    return result;
  }
};
var _OnigString = class _OnigString2 {
  constructor(str) {
    __publicField(this, "id", ++_OnigString2.LAST_ID);
    __publicField(this, "_onigBinding");
    __publicField(this, "content");
    __publicField(this, "utf16Length");
    __publicField(this, "utf8Length");
    __publicField(this, "utf16OffsetToUtf8");
    __publicField(this, "utf8OffsetToUtf16");
    __publicField(this, "ptr");
    if (!onigBinding)
      throw new ShikiError3("Must invoke loadWasm first.");
    this._onigBinding = onigBinding;
    this.content = str;
    const utfString = new UtfString(str);
    this.utf16Length = utfString.utf16Length;
    this.utf8Length = utfString.utf8Length;
    this.utf16OffsetToUtf8 = utfString.utf16OffsetToUtf8;
    this.utf8OffsetToUtf16 = utfString.utf8OffsetToUtf16;
    if (this.utf8Length < 1e4 && !_OnigString2._sharedPtrInUse) {
      if (!_OnigString2._sharedPtr)
        _OnigString2._sharedPtr = onigBinding.omalloc(1e4);
      _OnigString2._sharedPtrInUse = true;
      onigBinding.HEAPU8.set(utfString.utf8Value, _OnigString2._sharedPtr);
      this.ptr = _OnigString2._sharedPtr;
    } else {
      this.ptr = utfString.createString(onigBinding);
    }
  }
  convertUtf8OffsetToUtf16(utf8Offset) {
    if (this.utf8OffsetToUtf16) {
      if (utf8Offset < 0)
        return 0;
      if (utf8Offset > this.utf8Length)
        return this.utf16Length;
      return this.utf8OffsetToUtf16[utf8Offset];
    }
    return utf8Offset;
  }
  convertUtf16OffsetToUtf8(utf16Offset) {
    if (this.utf16OffsetToUtf8) {
      if (utf16Offset < 0)
        return 0;
      if (utf16Offset > this.utf16Length)
        return this.utf8Length;
      return this.utf16OffsetToUtf8[utf16Offset];
    }
    return utf16Offset;
  }
  dispose() {
    if (this.ptr === _OnigString2._sharedPtr)
      _OnigString2._sharedPtrInUse = false;
    else
      this._onigBinding.ofree(this.ptr);
  }
};
__publicField(_OnigString, "LAST_ID", 0);
__publicField(_OnigString, "_sharedPtr", 0);
__publicField(_OnigString, "_sharedPtrInUse", false);
var OnigString = _OnigString;
var OnigScanner = class {
  constructor(patterns) {
    __publicField(this, "_onigBinding");
    __publicField(this, "_ptr");
    if (!onigBinding)
      throw new ShikiError3("Must invoke loadWasm first.");
    const strPtrsArr = [];
    const strLenArr = [];
    for (let i2 = 0, len = patterns.length; i2 < len; i2++) {
      const utfString = new UtfString(patterns[i2]);
      strPtrsArr[i2] = utfString.createString(onigBinding);
      strLenArr[i2] = utfString.utf8Length;
    }
    const strPtrsPtr = onigBinding.omalloc(4 * patterns.length);
    onigBinding.HEAPU32.set(strPtrsArr, strPtrsPtr / 4);
    const strLenPtr = onigBinding.omalloc(4 * patterns.length);
    onigBinding.HEAPU32.set(strLenArr, strLenPtr / 4);
    const scannerPtr = onigBinding.createOnigScanner(strPtrsPtr, strLenPtr, patterns.length);
    for (let i2 = 0, len = patterns.length; i2 < len; i2++)
      onigBinding.ofree(strPtrsArr[i2]);
    onigBinding.ofree(strLenPtr);
    onigBinding.ofree(strPtrsPtr);
    if (scannerPtr === 0)
      throwLastOnigError(onigBinding);
    this._onigBinding = onigBinding;
    this._ptr = scannerPtr;
  }
  dispose() {
    this._onigBinding.freeOnigScanner(this._ptr);
  }
  findNextMatchSync(string, startPosition, arg) {
    let options = 0;
    if (typeof arg === "number") {
      options = arg;
    }
    if (typeof string === "string") {
      string = new OnigString(string);
      const result = this._findNextMatchSync(string, startPosition, false, options);
      string.dispose();
      return result;
    }
    return this._findNextMatchSync(string, startPosition, false, options);
  }
  _findNextMatchSync(string, startPosition, debugCall, options) {
    const onigBinding2 = this._onigBinding;
    const resultPtr = onigBinding2.findNextOnigScannerMatch(this._ptr, string.id, string.ptr, string.utf8Length, string.convertUtf16OffsetToUtf8(startPosition), options);
    if (resultPtr === 0) {
      return null;
    }
    const HEAPU32 = onigBinding2.HEAPU32;
    let offset = resultPtr / 4;
    const index = HEAPU32[offset++];
    const count = HEAPU32[offset++];
    const captureIndices = [];
    for (let i2 = 0; i2 < count; i2++) {
      const beg = string.convertUtf8OffsetToUtf16(HEAPU32[offset++]);
      const end = string.convertUtf8OffsetToUtf16(HEAPU32[offset++]);
      captureIndices[i2] = {
        start: beg,
        end,
        length: end - beg
      };
    }
    return {
      index,
      captureIndices
    };
  }
};
function isInstantiatorOptionsObject(dataOrOptions) {
  return typeof dataOrOptions.instantiator === "function";
}
function isInstantiatorModule(dataOrOptions) {
  return typeof dataOrOptions.default === "function";
}
function isDataOptionsObject(dataOrOptions) {
  return typeof dataOrOptions.data !== "undefined";
}
function isResponse(dataOrOptions) {
  return typeof Response !== "undefined" && dataOrOptions instanceof Response;
}
function isArrayBuffer(data) {
  return typeof ArrayBuffer !== "undefined" && (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) || typeof Buffer !== "undefined" && Buffer.isBuffer?.(data) || typeof SharedArrayBuffer !== "undefined" && data instanceof SharedArrayBuffer || typeof Uint32Array !== "undefined" && data instanceof Uint32Array;
}
var initPromise;
function loadWasm(options) {
  if (initPromise)
    return initPromise;
  async function _load() {
    onigBinding = await main(async (info) => {
      let instance2 = options;
      instance2 = await instance2;
      if (typeof instance2 === "function")
        instance2 = await instance2(info);
      if (typeof instance2 === "function")
        instance2 = await instance2(info);
      if (isInstantiatorOptionsObject(instance2)) {
        instance2 = await instance2.instantiator(info);
      } else if (isInstantiatorModule(instance2)) {
        instance2 = await instance2.default(info);
      } else {
        if (isDataOptionsObject(instance2))
          instance2 = instance2.data;
        if (isResponse(instance2)) {
          if (typeof WebAssembly.instantiateStreaming === "function")
            instance2 = await _makeResponseStreamingLoader(instance2)(info);
          else
            instance2 = await _makeResponseNonStreamingLoader(instance2)(info);
        } else if (isArrayBuffer(instance2)) {
          instance2 = await _makeArrayBufferLoader(instance2)(info);
        } else if (instance2 instanceof WebAssembly.Module) {
          instance2 = await _makeArrayBufferLoader(instance2)(info);
        } else if ("default" in instance2 && instance2.default instanceof WebAssembly.Module) {
          instance2 = await _makeArrayBufferLoader(instance2.default)(info);
        }
      }
      if ("instance" in instance2)
        instance2 = instance2.instance;
      if ("exports" in instance2)
        instance2 = instance2.exports;
      return instance2;
    });
  }
  initPromise = _load();
  return initPromise;
}
function _makeArrayBufferLoader(data) {
  return (importObject) => WebAssembly.instantiate(data, importObject);
}
function _makeResponseStreamingLoader(data) {
  return (importObject) => WebAssembly.instantiateStreaming(data, importObject);
}
function _makeResponseNonStreamingLoader(data) {
  return async (importObject) => {
    const arrayBuffer = await data.arrayBuffer();
    return WebAssembly.instantiate(arrayBuffer, importObject);
  };
}
async function createOnigurumaEngine(options) {
  if (options)
    await loadWasm(options);
  return {
    createScanner(patterns) {
      return new OnigScanner(patterns.map((p2) => typeof p2 === "string" ? p2 : p2.source));
    },
    createString(s2) {
      return new OnigString(s2);
    }
  };
}

// node_modules/.pnpm/shiki@3.23.0/node_modules/shiki/dist/bundle-full.mjs
var createHighlighter = /* @__PURE__ */ createBundledHighlighter({
  langs: bundledLanguages,
  themes: bundledThemes,
  engine: () => createOnigurumaEngine(import("./wasm-ZHXCPA6J.js"))
});
var {
  codeToHtml: codeToHtml2,
  codeToHast: codeToHast2,
  codeToTokens: codeToTokens2,
  codeToTokensBase: codeToTokensBase2,
  codeToTokensWithThemes: codeToTokensWithThemes2,
  getSingletonHighlighter,
  getLastGrammarState: getLastGrammarState2
} = /* @__PURE__ */ createSingletonShorthands(
  createHighlighter,
  { guessEmbeddedLanguages }
);

// node_modules/.pnpm/oniguruma-parser@0.12.2/node_modules/oniguruma-parser/dist/utils.js
function r(e) {
  if ([...e].length !== 1) throw new Error(`Expected "${e}" to be a single code point`);
  return e.codePointAt(0);
}
function l(e, t, n) {
  return e.has(t) || e.set(t, n), e.get(t);
}
var i = /* @__PURE__ */ new Set(["alnum", "alpha", "ascii", "blank", "cntrl", "digit", "graph", "lower", "print", "punct", "space", "upper", "word", "xdigit"]);
var o = String.raw;
function u(e, t) {
  if (e == null) throw new Error(t ?? "Value expected");
  return e;
}

// node_modules/.pnpm/oniguruma-parser@0.12.2/node_modules/oniguruma-parser/dist/tokenizer/tokenize.js
var m = o`\[\^?`;
var b = `c.? | C(?:-.?)?|${o`[pP]\{(?:\^?[-\x20_]*[A-Za-z][-\x20\w]*\})?`}|${o`x[89A-Fa-f]\p{AHex}(?:\\x[89A-Fa-f]\p{AHex})*`}|${o`u(?:\p{AHex}{4})? | x\{[^\}]*\}? | x\p{AHex}{0,2}`}|${o`o\{[^\}]*\}?`}|${o`\d{1,3}`}`;
var y = /[?*+][?+]?|\{(?:\d+(?:,\d*)?|,\d+)\}\??/;
var C = new RegExp(o`
  \\ (?:
    ${b}
    | [gk]<[^>]*>?
    | [gk]'[^']*'?
    | .
  )
  | \( (?:
    \? (?:
      [:=!>({]
      | <[=!]
      | <[^>]*>
      | '[^']*'
      | ~\|?
      | #(?:[^)\\]|\\.?)*
      | [^:)]*[:)]
    )?
    | \*[^\)]*\)?
  )?
  | (?:${y.source})+
  | ${m}
  | .
`.replace(/\s+/g, ""), "gsu");
var T = new RegExp(o`
  \\ (?:
    ${b}
    | .
  )
  | \[:(?:\^?\p{Alpha}+|\^):\]
  | ${m}
  | &&
  | .
`.replace(/\s+/g, ""), "gsu");
function M(e, n = {}) {
  const t = { flags: "", ...n, rules: { captureGroup: false, singleline: false, ...n.rules } };
  if (typeof e != "string") throw new Error("String expected as pattern");
  const o3 = Y(t.flags), s2 = [o3.extended], a2 = { captureGroup: t.rules.captureGroup, getCurrentModX() {
    return s2.at(-1);
  }, numOpenGroups: 0, popModX() {
    s2.pop();
  }, pushModX(u2) {
    s2.push(u2);
  }, replaceCurrentModX(u2) {
    s2[s2.length - 1] = u2;
  }, singleline: t.rules.singleline };
  let r4 = [], i2;
  for (C.lastIndex = 0; i2 = C.exec(e); ) {
    const u2 = F(a2, e, i2[0], C.lastIndex);
    u2.tokens ? r4.push(...u2.tokens) : u2.token && r4.push(u2.token), u2.lastIndex !== void 0 && (C.lastIndex = u2.lastIndex);
  }
  const l3 = [];
  let c = 0;
  r4.filter((u2) => u2.type === "GroupOpen").forEach((u2) => {
    u2.kind === "capturing" ? u2.number = ++c : u2.raw === "(" && l3.push(u2);
  }), c || l3.forEach((u2, S2) => {
    u2.kind = "capturing", u2.number = S2 + 1;
  });
  const g = c || l3.length;
  return { tokens: r4.map((u2) => u2.type === "EscapedNumber" ? ee(u2, g) : u2).flat(), flags: o3 };
}
function F(e, n, t, o3) {
  const [s2, a2] = t;
  if (t === "[" || t === "[^") {
    const r4 = K(n, t, o3);
    return { tokens: r4.tokens, lastIndex: r4.lastIndex };
  }
  if (s2 === "\\") {
    if ("AbBGyYzZ".includes(a2)) return { token: w(t, t) };
    if (/^\\g[<']/.test(t)) {
      if (!/^\\g(?:<[^>]+>|'[^']+')$/.test(t)) throw new Error(`Invalid group name "${t}"`);
      return { token: R(t) };
    }
    if (/^\\k[<']/.test(t)) {
      if (!/^\\k(?:<[^>]+>|'[^']+')$/.test(t)) throw new Error(`Invalid group name "${t}"`);
      return { token: A(t) };
    }
    if (a2 === "K") return { token: I("keep", t) };
    if (a2 === "N" || a2 === "R") return { token: k("newline", t, { negate: a2 === "N" }) };
    if (a2 === "O") return { token: k("any", t) };
    if (a2 === "X") return { token: k("text_segment", t) };
    const r4 = x(t, { inCharClass: false });
    return Array.isArray(r4) ? { tokens: r4 } : { token: r4 };
  }
  if (s2 === "(") {
    if (a2 === "*") return { token: j(t) };
    if (t === "(?{") throw new Error(`Unsupported callout "${t}"`);
    if (t.startsWith("(?#")) {
      if (n[o3] !== ")") throw new Error('Unclosed comment group "(?#"');
      return { lastIndex: o3 + 1 };
    }
    if (/^\(\?[-imx]+[:)]$/.test(t)) return { token: L(t, e) };
    if (e.pushModX(e.getCurrentModX()), e.numOpenGroups++, t === "(" && !e.captureGroup || t === "(?:") return { token: f("group", t) };
    if (t === "(?>") return { token: f("atomic", t) };
    if (t === "(?=" || t === "(?!" || t === "(?<=" || t === "(?<!") return { token: f(t[2] === "<" ? "lookbehind" : "lookahead", t, { negate: t.endsWith("!") }) };
    if (t === "(" && e.captureGroup || t.startsWith("(?<") && t.endsWith(">") || t.startsWith("(?'") && t.endsWith("'")) return { token: f("capturing", t, { ...t !== "(" && { name: t.slice(3, -1) } }) };
    if (t.startsWith("(?~")) {
      if (t === "(?~|") throw new Error(`Unsupported absence function kind "${t}"`);
      return { token: f("absence_repeater", t) };
    }
    throw t === "(?(" ? new Error(`Unsupported conditional "${t}"`) : new Error(`Invalid or unsupported group option "${t}"`);
  }
  if (t === ")") {
    if (e.popModX(), e.numOpenGroups--, e.numOpenGroups < 0) throw new Error('Unmatched ")"');
    return { token: Q(t) };
  }
  if (e.getCurrentModX()) {
    if (t === "#") {
      const r4 = n.indexOf(`
`, o3);
      return { lastIndex: r4 === -1 ? n.length : r4 };
    }
    if (/^\s$/.test(t)) {
      const r4 = /\s+/y;
      return r4.lastIndex = o3, { lastIndex: r4.exec(n) ? r4.lastIndex : o3 };
    }
  }
  if (t === ".") return { token: k("dot", t) };
  if (t === "^" || t === "$") {
    const r4 = e.singleline ? { "^": o`\A`, $: o`\Z` }[t] : t;
    return { token: w(r4, t) };
  }
  return t === "|" ? { token: P(t) } : y.test(t) ? { tokens: te(t) } : { token: d(r(t), t) };
}
function K(e, n, t) {
  const o3 = [E(n[1] === "^", n)];
  let s2 = 1, a2;
  for (T.lastIndex = t; a2 = T.exec(e); ) {
    const r4 = a2[0];
    if (r4[0] === "[" && r4[1] !== ":") s2++, o3.push(E(r4[1] === "^", r4));
    else if (r4 === "]") {
      if (o3.at(-1).type === "CharacterClassOpen") o3.push(d(93, r4));
      else if (s2--, o3.push(z(r4)), !s2) break;
    } else {
      const i2 = X(r4);
      Array.isArray(i2) ? o3.push(...i2) : o3.push(i2);
    }
  }
  return { tokens: o3, lastIndex: T.lastIndex || e.length };
}
function X(e) {
  if (e[0] === "\\") return x(e, { inCharClass: true });
  if (e[0] === "[") {
    const n = /\[:(?<negate>\^?)(?<name>[a-z]+):\]/.exec(e);
    if (!n || !i.has(n.groups.name)) throw new Error(`Invalid POSIX class "${e}"`);
    return k("posix", e, { value: n.groups.name, negate: !!n.groups.negate });
  }
  return e === "-" ? U(e) : e === "&&" ? H(e) : d(r(e), e);
}
function x(e, { inCharClass: n }) {
  const t = e[1];
  if (t === "c" || t === "C") return Z(e);
  if ("dDhHsSwW".includes(t)) return q(e);
  if (e.startsWith(o`\o{`)) throw new Error(`Incomplete, invalid, or unsupported octal code point "${e}"`);
  if (/^\\[pP]\{/.test(e)) {
    if (e.length === 3) throw new Error(`Incomplete or invalid Unicode property "${e}"`);
    return V(e);
  }
  if (/^\\x[89A-Fa-f]\p{AHex}/u.test(e)) try {
    const o3 = e.split(/\\x/).slice(1).map((i2) => parseInt(i2, 16)), s2 = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true }).decode(new Uint8Array(o3)), a2 = new TextEncoder();
    return [...s2].map((i2) => {
      const l3 = [...a2.encode(i2)].map((c) => `\\x${c.toString(16)}`).join("");
      return d(r(i2), l3);
    });
  } catch {
    throw new Error(`Multibyte code "${e}" incomplete or invalid in Oniguruma`);
  }
  if (t === "u" || t === "x") return d(J(e), e);
  if ($.has(t)) return d($.get(t), e);
  if (/\d/.test(t)) return W(n, e);
  if (e === "\\") throw new Error(o`Incomplete escape "\"`);
  if (t === "M") throw new Error(`Unsupported meta "${e}"`);
  if ([...e].length === 2) return d(e.codePointAt(1), e);
  throw new Error(`Unexpected escape "${e}"`);
}
function P(e) {
  return { type: "Alternator", raw: e };
}
function w(e, n) {
  return { type: "Assertion", kind: e, raw: n };
}
function A(e) {
  return { type: "Backreference", raw: e };
}
function d(e, n) {
  return { type: "Character", value: e, raw: n };
}
function z(e) {
  return { type: "CharacterClassClose", raw: e };
}
function U(e) {
  return { type: "CharacterClassHyphen", raw: e };
}
function H(e) {
  return { type: "CharacterClassIntersector", raw: e };
}
function E(e, n) {
  return { type: "CharacterClassOpen", negate: e, raw: n };
}
function k(e, n, t = {}) {
  return { type: "CharacterSet", kind: e, ...t, raw: n };
}
function I(e, n, t = {}) {
  return e === "keep" ? { type: "Directive", kind: e, raw: n } : { type: "Directive", kind: e, flags: u(t.flags), raw: n };
}
function W(e, n) {
  return { type: "EscapedNumber", inCharClass: e, raw: n };
}
function Q(e) {
  return { type: "GroupClose", raw: e };
}
function f(e, n, t = {}) {
  return { type: "GroupOpen", kind: e, ...t, raw: n };
}
function D(e, n, t, o3) {
  return { type: "NamedCallout", kind: e, tag: n, arguments: t, raw: o3 };
}
function _(e, n, t, o3) {
  return { type: "Quantifier", kind: e, min: n, max: t, raw: o3 };
}
function R(e) {
  return { type: "Subroutine", raw: e };
}
var B = /* @__PURE__ */ new Set(["COUNT", "CMP", "ERROR", "FAIL", "MAX", "MISMATCH", "SKIP", "TOTAL_COUNT"]);
var $ = /* @__PURE__ */ new Map([["a", 7], ["b", 8], ["e", 27], ["f", 12], ["n", 10], ["r", 13], ["t", 9], ["v", 11]]);
function Z(e) {
  const n = e[1] === "c" ? e[2] : e[3];
  if (!n || !/[A-Za-z]/.test(n)) throw new Error(`Unsupported control character "${e}"`);
  return d(r(n.toUpperCase()) - 64, e);
}
function L(e, n) {
  let { on: t, off: o3 } = /^\(\?(?<on>[imx]*)(?:-(?<off>[-imx]*))?/.exec(e).groups;
  o3 ??= "";
  const s2 = (n.getCurrentModX() || t.includes("x")) && !o3.includes("x"), a2 = v(t), r4 = v(o3), i2 = {};
  if (a2 && (i2.enable = a2), r4 && (i2.disable = r4), e.endsWith(")")) return n.replaceCurrentModX(s2), I("flags", e, { flags: i2 });
  if (e.endsWith(":")) return n.pushModX(s2), n.numOpenGroups++, f("group", e, { ...(a2 || r4) && { flags: i2 } });
  throw new Error(`Unexpected flag modifier "${e}"`);
}
function j(e) {
  const n = /\(\*(?<name>[A-Za-z_]\w*)?(?:\[(?<tag>(?:[A-Za-z_]\w*)?)\])?(?:\{(?<args>[^}]*)\})?\)/.exec(e);
  if (!n) throw new Error(`Incomplete or invalid named callout "${e}"`);
  const { name: t, tag: o3, args: s2 } = n.groups;
  if (!t) throw new Error(`Invalid named callout "${e}"`);
  if (o3 === "") throw new Error(`Named callout tag with empty value not allowed "${e}"`);
  const a2 = s2 ? s2.split(",").filter((g) => g !== "").map((g) => /^[+-]?\d+$/.test(g) ? +g : g) : [], [r4, i2, l3] = a2, c = B.has(t) ? t.toLowerCase() : "custom";
  switch (c) {
    case "fail":
    case "mismatch":
    case "skip":
      if (a2.length > 0) throw new Error(`Named callout arguments not allowed "${a2}"`);
      break;
    case "error":
      if (a2.length > 1) throw new Error(`Named callout allows only one argument "${a2}"`);
      if (typeof r4 == "string") throw new Error(`Named callout argument must be a number "${r4}"`);
      break;
    case "max":
      if (!a2.length || a2.length > 2) throw new Error(`Named callout must have one or two arguments "${a2}"`);
      if (typeof r4 == "string" && !/^[A-Za-z_]\w*$/.test(r4)) throw new Error(`Named callout argument one must be a tag or number "${r4}"`);
      if (a2.length === 2 && (typeof i2 == "number" || !/^[<>X]$/.test(i2))) throw new Error(`Named callout optional argument two must be '<', '>', or 'X' "${i2}"`);
      break;
    case "count":
    case "total_count":
      if (a2.length > 1) throw new Error(`Named callout allows only one argument "${a2}"`);
      if (a2.length === 1 && (typeof r4 == "number" || !/^[<>X]$/.test(r4))) throw new Error(`Named callout optional argument must be '<', '>', or 'X' "${r4}"`);
      break;
    case "cmp":
      if (a2.length !== 3) throw new Error(`Named callout must have three arguments "${a2}"`);
      if (typeof r4 == "string" && !/^[A-Za-z_]\w*$/.test(r4)) throw new Error(`Named callout argument one must be a tag or number "${r4}"`);
      if (typeof i2 == "number" || !/^(?:[<>!=]=|[<>])$/.test(i2)) throw new Error(`Named callout argument two must be '==', '!=', '>', '<', '>=', or '<=' "${i2}"`);
      if (typeof l3 == "string" && !/^[A-Za-z_]\w*$/.test(l3)) throw new Error(`Named callout argument three must be a tag or number "${l3}"`);
      break;
    case "custom":
      throw new Error(`Undefined callout name "${t}"`);
    default:
      throw new Error(`Unexpected named callout kind "${c}"`);
  }
  return D(c, o3 ?? null, s2?.split(",") ?? null, e);
}
function O(e) {
  let n = null, t, o3;
  if (e[0] === "{") {
    const { minStr: s2, maxStr: a2 } = /^\{(?<minStr>\d*)(?:,(?<maxStr>\d*))?/.exec(e).groups, r4 = 1e5;
    if (+s2 > r4 || a2 && +a2 > r4) throw new Error("Quantifier value unsupported in Oniguruma");
    if (t = +s2, o3 = a2 === void 0 ? +s2 : a2 === "" ? 1 / 0 : +a2, t > o3 && (n = "possessive", [t, o3] = [o3, t]), e.endsWith("?")) {
      if (n === "possessive") throw new Error('Unsupported possessive interval quantifier chain with "?"');
      n = "lazy";
    } else n || (n = "greedy");
  } else t = e[0] === "+" ? 1 : 0, o3 = e[0] === "?" ? 1 : 1 / 0, n = e[1] === "+" ? "possessive" : e[1] === "?" ? "lazy" : "greedy";
  return _(n, t, o3, e);
}
function q(e) {
  const n = e[1].toLowerCase();
  return k({ d: "digit", h: "hex", s: "space", w: "word" }[n], e, { negate: e[1] !== n });
}
function V(e) {
  const { p: n, neg: t, value: o3 } = /^\\(?<p>[pP])\{(?<neg>\^?)(?<value>[^}]+)/.exec(e).groups;
  return k("property", e, { value: o3, negate: n === "P" && !t || n === "p" && !!t });
}
function v(e) {
  const n = {};
  return e.includes("i") && (n.ignoreCase = true), e.includes("m") && (n.dotAll = true), e.includes("x") && (n.extended = true), Object.keys(n).length ? n : null;
}
function Y(e) {
  const n = { ignoreCase: false, dotAll: false, extended: false, digitIsAscii: false, posixIsAscii: false, spaceIsAscii: false, wordIsAscii: false, textSegmentMode: null };
  for (let t = 0; t < e.length; t++) {
    const o3 = e[t];
    if (!"imxDPSWy".includes(o3)) throw new Error(`Invalid flag "${o3}"`);
    if (o3 === "y") {
      if (!/^y{[gw]}/.test(e.slice(t))) throw new Error('Invalid or unspecified flag "y" mode');
      n.textSegmentMode = e[t + 2] === "g" ? "grapheme" : "word", t += 3;
      continue;
    }
    n[{ i: "ignoreCase", m: "dotAll", x: "extended", D: "digitIsAscii", P: "posixIsAscii", S: "spaceIsAscii", W: "wordIsAscii" }[o3]] = true;
  }
  return n;
}
function J(e) {
  if (/^(?:\\u(?!\p{AHex}{4})|\\x(?!\p{AHex}{1,2}|\{\p{AHex}{1,8}\}))/u.test(e)) throw new Error(`Incomplete or invalid escape "${e}"`);
  const n = e[2] === "{" ? /^\\x\{\s*(?<hex>\p{AHex}+)/u.exec(e).groups.hex : e.slice(2);
  return parseInt(n, 16);
}
function ee(e, n) {
  const { raw: t, inCharClass: o3 } = e, s2 = t.slice(1);
  if (!o3 && (s2 !== "0" && s2.length === 1 || s2[0] !== "0" && +s2 <= n)) return [A(t)];
  const a2 = [], r4 = s2.match(/^[0-7]+|\d/g);
  for (let i2 = 0; i2 < r4.length; i2++) {
    const l3 = r4[i2];
    let c;
    if (i2 === 0 && l3 !== "8" && l3 !== "9") {
      if (c = parseInt(l3, 8), c > 127) throw new Error(o`Octal encoded byte above 177 unsupported "${t}"`);
    } else c = r(l3);
    a2.push(d(c, (i2 === 0 ? "\\" : "") + l3));
  }
  return a2;
}
function te(e) {
  const n = [], t = new RegExp(y, "gy");
  let o3;
  for (; o3 = t.exec(e); ) {
    const s2 = o3[0];
    if (s2[0] === "{") {
      const a2 = /^\{(?<min>\d+),(?<max>\d+)\}\??$/.exec(s2);
      if (a2) {
        const { min: r4, max: i2 } = a2.groups;
        if (+r4 > +i2 && s2.endsWith("?")) {
          t.lastIndex--, n.push(O(s2.slice(0, -1)));
          continue;
        }
      }
    }
    n.push(O(s2));
  }
  return n;
}

// node_modules/.pnpm/oniguruma-parser@0.12.2/node_modules/oniguruma-parser/dist/parser/node-utils.js
function o2(e, t) {
  if (!Array.isArray(e.body)) throw new Error("Expected node with body array");
  if (e.body.length !== 1) return false;
  const r4 = e.body[0];
  return !t || Object.keys(t).every((n) => t[n] === r4[n]);
}
function s(e) {
  return y2.has(e.type);
}
var y2 = /* @__PURE__ */ new Set(["AbsenceFunction", "Backreference", "CapturingGroup", "Character", "CharacterClass", "CharacterSet", "Group", "Quantifier", "Subroutine"]);

// node_modules/.pnpm/oniguruma-parser@0.12.2/node_modules/oniguruma-parser/dist/parser/parse.js
function J2(e, r4 = {}) {
  const n = { flags: "", normalizeUnknownPropertyNames: false, skipBackrefValidation: false, skipLookbehindValidation: false, skipPropertyNameValidation: false, unicodePropertyMap: null, ...r4, rules: { captureGroup: false, singleline: false, ...r4.rules } }, o3 = M(e, { flags: n.flags, rules: { captureGroup: n.rules.captureGroup, singleline: n.rules.singleline } }), i2 = (p2, N) => {
    const u2 = o3.tokens[t.nextIndex];
    switch (t.parent = p2, t.nextIndex++, u2.type) {
      case "Alternator":
        return b2();
      case "Assertion":
        return W2(u2);
      case "Backreference":
        return X2(u2, t);
      case "Character":
        return m2(u2.value, { useLastValid: !!N.isCheckingRangeEnd });
      case "CharacterClassHyphen":
        return ee2(u2, t, N);
      case "CharacterClassOpen":
        return re(u2, t, N);
      case "CharacterSet":
        return ne(u2, t);
      case "Directive":
        return I2(u2.kind, { flags: u2.flags });
      case "GroupOpen":
        return te2(u2, t, N);
      case "NamedCallout":
        return U2(u2.kind, u2.tag, u2.arguments);
      case "Quantifier":
        return oe(u2, t);
      case "Subroutine":
        return ae(u2, t);
      default:
        throw new Error(`Unexpected token type "${u2.type}"`);
    }
  }, t = { capturingGroups: [], hasNumberedRef: false, namedGroupsByName: /* @__PURE__ */ new Map(), nextIndex: 0, normalizeUnknownPropertyNames: n.normalizeUnknownPropertyNames, parent: null, skipBackrefValidation: n.skipBackrefValidation, skipLookbehindValidation: n.skipLookbehindValidation, skipPropertyNameValidation: n.skipPropertyNameValidation, subroutines: [], tokens: o3.tokens, unicodePropertyMap: n.unicodePropertyMap, walk: i2 }, d2 = B2(T2(o3.flags));
  let s2 = d2.body[0];
  for (; t.nextIndex < o3.tokens.length; ) {
    const p2 = i2(s2, {});
    p2.type === "Alternative" ? (d2.body.push(p2), s2 = p2) : s2.body.push(p2);
  }
  const { capturingGroups: a2, hasNumberedRef: l3, namedGroupsByName: c, subroutines: f2 } = t;
  if (l3 && c.size && !n.rules.captureGroup) throw new Error("Numbered backref/subroutine not allowed when using named capture");
  for (const { ref: p2 } of f2) if (typeof p2 == "number") {
    if (p2 > a2.length) throw new Error("Subroutine uses a group number that's not defined");
    p2 && (a2[p2 - 1].isSubroutined = true);
  } else if (c.has(p2)) {
    if (c.get(p2).length > 1) throw new Error(o`Subroutine uses a duplicate group name "\g<${p2}>"`);
    c.get(p2)[0].isSubroutined = true;
  } else throw new Error(o`Subroutine uses a group name that's not defined "\g<${p2}>"`);
  return d2;
}
function W2({ kind: e }) {
  return F2(u({ "^": "line_start", $: "line_end", "\\A": "string_start", "\\b": "word_boundary", "\\B": "word_boundary", "\\G": "search_start", "\\y": "text_segment_boundary", "\\Y": "text_segment_boundary", "\\z": "string_end", "\\Z": "string_end_newline" }[e], `Unexpected assertion kind "${e}"`), { negate: e === o`\B` || e === o`\Y` });
}
function X2({ raw: e }, r4) {
  const n = /^\\k[<']/.test(e), o3 = n ? e.slice(3, -1) : e.slice(1), i2 = (t, d2 = false) => {
    const s2 = r4.capturingGroups.length;
    let a2 = false;
    if (t > s2) if (r4.skipBackrefValidation) a2 = true;
    else throw new Error(`Not enough capturing groups defined to the left "${e}"`);
    return r4.hasNumberedRef = true, k2(d2 ? s2 + 1 - t : t, { orphan: a2 });
  };
  if (n) {
    const t = /^(?<sign>-?)0*(?<num>[1-9]\d*)$/.exec(o3);
    if (t) return i2(+t.groups.num, !!t.groups.sign);
    if (/[-+]/.test(o3)) throw new Error(`Invalid backref name "${e}"`);
    if (!r4.namedGroupsByName.has(o3)) throw new Error(`Group name not defined to the left "${e}"`);
    return k2(o3);
  }
  return i2(+o3);
}
function ee2(e, r4, n) {
  const { tokens: o3, walk: i2 } = r4, t = r4.parent, d2 = t.body.at(-1), s2 = o3[r4.nextIndex];
  if (!n.isCheckingRangeEnd && d2 && d2.type !== "CharacterClass" && d2.type !== "CharacterClassRange" && s2 && s2.type !== "CharacterClassOpen" && s2.type !== "CharacterClassClose" && s2.type !== "CharacterClassIntersector") {
    const a2 = i2(t, { ...n, isCheckingRangeEnd: true });
    if (d2.type === "Character" && a2.type === "Character") return t.body.pop(), L2(d2, a2);
    throw new Error("Invalid character class range");
  }
  return m2(r("-"));
}
function re({ negate: e }, r4, n) {
  const { tokens: o3, walk: i2 } = r4, t = [C2()], d2 = o3[r4.nextIndex];
  let s2 = z2(d2);
  for (; s2.type !== "CharacterClassClose"; ) {
    if (s2.type === "CharacterClassIntersector") t.push(C2()), r4.nextIndex++;
    else {
      const l3 = t.at(-1);
      l3.body.push(i2(l3, n));
    }
    s2 = z2(o3[r4.nextIndex], d2);
  }
  const a2 = C2({ negate: e });
  return t.length === 1 ? a2.body = t[0].body : (a2.kind = "intersection", a2.body = t.map((l3) => l3.body.length === 1 ? l3.body[0] : l3)), r4.nextIndex++, a2;
}
function ne({ kind: e, negate: r4, value: n }, o3) {
  const { normalizeUnknownPropertyNames: i2, skipPropertyNameValidation: t, unicodePropertyMap: d2 } = o3;
  if (e === "property") {
    const s2 = w2(n);
    if (i.has(s2) && !d2?.has(s2)) e = "posix", n = s2;
    else return Q2(n, { negate: r4, normalizeUnknownPropertyNames: i2, skipPropertyNameValidation: t, unicodePropertyMap: d2 });
  }
  return e === "posix" ? R2(n, { negate: r4 }) : E2(e, { negate: r4 });
}
function te2(e, r4, n) {
  const { tokens: o3, capturingGroups: i2, namedGroupsByName: t, skipLookbehindValidation: d2, walk: s2 } = r4, a2 = ie(e), l3 = a2.type === "AbsenceFunction", c = $2(a2), f2 = c && a2.negate;
  if (a2.type === "CapturingGroup" && (i2.push(a2), a2.name && l(t, a2.name, []).push(a2)), l3 && n.isInAbsenceFunction) throw new Error("Nested absence function not supported by Oniguruma");
  let p2 = D2(o3[r4.nextIndex]);
  for (; p2.type !== "GroupClose"; ) {
    if (p2.type === "Alternator") a2.body.push(b2()), r4.nextIndex++;
    else {
      const N = a2.body.at(-1), u2 = s2(N, { ...n, isInAbsenceFunction: n.isInAbsenceFunction || l3, isInLookbehind: n.isInLookbehind || c, isInNegLookbehind: n.isInNegLookbehind || f2 });
      if (N.body.push(u2), (c || n.isInLookbehind) && !d2) {
        const v2 = "Lookbehind includes a pattern not allowed by Oniguruma";
        if (f2 || n.isInNegLookbehind) {
          if (M2(u2) || u2.type === "CapturingGroup") throw new Error(v2);
        } else if (M2(u2) || $2(u2) && u2.negate) throw new Error(v2);
      }
    }
    p2 = D2(o3[r4.nextIndex]);
  }
  return r4.nextIndex++, a2;
}
function oe({ kind: e, min: r4, max: n }, o3) {
  const i2 = o3.parent, t = i2.body.at(-1);
  if (!t || !s(t)) throw new Error("Quantifier requires a repeatable token");
  const d2 = _2(e, r4, n, t);
  return i2.body.pop(), d2;
}
function ae({ raw: e }, r4) {
  const { capturingGroups: n, subroutines: o3 } = r4;
  let i2 = e.slice(3, -1);
  const t = /^(?<sign>[-+]?)0*(?<num>[1-9]\d*)$/.exec(i2);
  if (t) {
    const s2 = +t.groups.num, a2 = n.length;
    if (r4.hasNumberedRef = true, i2 = { "": s2, "+": a2 + s2, "-": a2 + 1 - s2 }[t.groups.sign], i2 < 1) throw new Error("Invalid subroutine number");
  } else i2 === "0" && (i2 = 0);
  const d2 = O2(i2);
  return o3.push(d2), d2;
}
function G(e, r4) {
  if (e !== "repeater") throw new Error(`Unexpected absence function kind "${e}"`);
  return { type: "AbsenceFunction", kind: e, body: h(r4?.body) };
}
function b2(e) {
  return { type: "Alternative", body: V2(e?.body) };
}
function F2(e, r4) {
  const n = { type: "Assertion", kind: e };
  return (e === "word_boundary" || e === "text_segment_boundary") && (n.negate = !!r4?.negate), n;
}
function k2(e, r4) {
  const n = !!r4?.orphan;
  return { type: "Backreference", ref: e, ...n && { orphan: n } };
}
function P2(e, r4) {
  const n = { name: void 0, isSubroutined: false, ...r4 };
  if (n.name !== void 0 && !se(n.name)) throw new Error(`Group name "${n.name}" invalid in Oniguruma`);
  return { type: "CapturingGroup", number: e, ...n.name && { name: n.name }, ...n.isSubroutined && { isSubroutined: n.isSubroutined }, body: h(r4?.body) };
}
function m2(e, r4) {
  const n = { useLastValid: false, ...r4 };
  if (e > 1114111) {
    const o3 = e.toString(16);
    if (n.useLastValid) e = 1114111;
    else throw e > 1310719 ? new Error(`Invalid code point out of range "\\x{${o3}}"`) : new Error(`Invalid code point out of range in JS "\\x{${o3}}"`);
  }
  return { type: "Character", value: e };
}
function C2(e) {
  const r4 = { kind: "union", negate: false, ...e };
  return { type: "CharacterClass", kind: r4.kind, negate: r4.negate, body: V2(e?.body) };
}
function L2(e, r4) {
  if (r4.value < e.value) throw new Error("Character class range out of order");
  return { type: "CharacterClassRange", min: e, max: r4 };
}
function E2(e, r4) {
  const n = !!r4?.negate, o3 = { type: "CharacterSet", kind: e };
  return (e === "digit" || e === "hex" || e === "newline" || e === "space" || e === "word") && (o3.negate = n), (e === "text_segment" || e === "newline" && !n) && (o3.variableLength = true), o3;
}
function I2(e, r4 = {}) {
  if (e === "keep") return { type: "Directive", kind: e };
  if (e === "flags") return { type: "Directive", kind: e, flags: u(r4.flags) };
  throw new Error(`Unexpected directive kind "${e}"`);
}
function T2(e) {
  return { type: "Flags", ...e };
}
function A2(e) {
  const r4 = e?.atomic, n = e?.flags;
  if (r4 && n) throw new Error("Atomic group cannot have flags");
  return { type: "Group", ...r4 && { atomic: r4 }, ...n && { flags: n }, body: h(e?.body) };
}
function K2(e) {
  const r4 = { behind: false, negate: false, ...e };
  return { type: "LookaroundAssertion", kind: r4.behind ? "lookbehind" : "lookahead", negate: r4.negate, body: h(e?.body) };
}
function U2(e, r4, n) {
  return { type: "NamedCallout", kind: e, tag: r4, arguments: n };
}
function R2(e, r4) {
  const n = !!r4?.negate;
  if (!i.has(e)) throw new Error(`Invalid POSIX class "${e}"`);
  return { type: "CharacterSet", kind: "posix", value: e, negate: n };
}
function _2(e, r4, n, o3) {
  if (r4 > n) throw new Error("Invalid reversed quantifier range");
  return { type: "Quantifier", kind: e, min: r4, max: n, body: o3 };
}
function B2(e, r4) {
  return { type: "Regex", body: h(r4?.body), flags: e };
}
function O2(e) {
  return { type: "Subroutine", ref: e };
}
function Q2(e, r4) {
  const n = { negate: false, normalizeUnknownPropertyNames: false, skipPropertyNameValidation: false, unicodePropertyMap: null, ...r4 };
  let o3 = n.unicodePropertyMap?.get(w2(e));
  if (!o3) {
    if (n.normalizeUnknownPropertyNames) o3 = de(e);
    else if (n.unicodePropertyMap && !n.skipPropertyNameValidation) throw new Error(o`Invalid Unicode property "\p{${e}}"`);
  }
  return { type: "CharacterSet", kind: "property", value: o3 ?? e, negate: n.negate };
}
function ie({ flags: e, kind: r4, name: n, negate: o3, number: i2 }) {
  switch (r4) {
    case "absence_repeater":
      return G("repeater");
    case "atomic":
      return A2({ atomic: true });
    case "capturing":
      return P2(i2, { name: n });
    case "group":
      return A2({ flags: e });
    case "lookahead":
    case "lookbehind":
      return K2({ behind: r4 === "lookbehind", negate: o3 });
    default:
      throw new Error(`Unexpected group kind "${r4}"`);
  }
}
function h(e) {
  if (e === void 0) e = [b2()];
  else if (!Array.isArray(e) || !e.length || !e.every((r4) => r4.type === "Alternative")) throw new Error("Invalid body; expected array of one or more Alternative nodes");
  return e;
}
function V2(e) {
  if (e === void 0) e = [];
  else if (!Array.isArray(e) || !e.every((r4) => !!r4.type)) throw new Error("Invalid body; expected array of nodes");
  return e;
}
function M2(e) {
  return e.type === "LookaroundAssertion" && e.kind === "lookahead";
}
function $2(e) {
  return e.type === "LookaroundAssertion" && e.kind === "lookbehind";
}
function se(e) {
  return /^[\p{Alpha}\p{Pc}][^)]*$/u.test(e);
}
function de(e) {
  return e.trim().replace(/[- _]+/g, "_").replace(/[A-Z][a-z]+(?=[A-Z])/g, "$&_").replace(/[A-Za-z]+/g, (r4) => r4[0].toUpperCase() + r4.slice(1).toLowerCase());
}
function w2(e) {
  return e.replace(/[- _]+/g, "").toLowerCase();
}
function z2(e, r4) {
  const n = r4;
  return u(e, `Unclosed character class${n?.type === "Character" && n.value === 93 && n.raw === "]" ? ' (started with "]")' : ""}`);
}
function D2(e) {
  return u(e, "Unclosed group");
}

// node_modules/.pnpm/oniguruma-parser@0.12.2/node_modules/oniguruma-parser/dist/traverser/traverse.js
function S(a2, v2, N = null) {
  function b3(e, s2) {
    for (let t = 0; t < e.length; t++) {
      const r4 = n(e[t], s2, t, e);
      t = Math.max(-1, t + r4);
    }
  }
  function n(e, s2 = null, t = null, r4 = null) {
    let i2 = 0, c = false;
    const d2 = { node: e, parent: s2, key: t, container: r4, root: a2, remove() {
      x2(r4).splice(Math.max(0, l2(t) + i2), 1), i2--, c = true;
    }, removeAllNextSiblings() {
      return x2(r4).splice(l2(t) + 1);
    }, removeAllPrevSiblings() {
      const o3 = l2(t) + i2;
      return i2 -= o3, x2(r4).splice(0, Math.max(0, o3));
    }, replaceWith(o3, m3 = {}) {
      const y3 = !!m3.traverse;
      r4 ? r4[Math.max(0, l2(t) + i2)] = o3 : u(s2, "Can't replace root node")[t] = o3, y3 && n(o3, s2, t, r4), c = true;
    }, replaceWithMultiple(o3, m3 = {}) {
      const y3 = !!m3.traverse;
      if (x2(r4).splice(Math.max(0, l2(t) + i2), 1, ...o3), i2 += o3.length - 1, y3) {
        let g = 0;
        for (let p2 = 0; p2 < o3.length; p2++) g += n(o3[p2], s2, l2(t) + p2 + g, r4);
      }
      c = true;
    }, skip() {
      c = true;
    } }, { type: f2 } = e, u2 = v2["*"], h2 = v2[f2], R3 = typeof u2 == "function" ? u2 : u2?.enter, P3 = typeof h2 == "function" ? h2 : h2?.enter;
    if (R3?.(d2, N), P3?.(d2, N), !c) switch (f2) {
      case "AbsenceFunction":
      case "Alternative":
      case "CapturingGroup":
      case "CharacterClass":
      case "Group":
      case "LookaroundAssertion":
        b3(e.body, e);
        break;
      case "Assertion":
      case "Backreference":
      case "Character":
      case "CharacterSet":
      case "Directive":
      case "Flags":
      case "NamedCallout":
      case "Subroutine":
        break;
      case "CharacterClassRange":
        n(e.min, e, "min"), n(e.max, e, "max");
        break;
      case "Quantifier":
        n(e.body, e, "body");
        break;
      case "Regex":
        b3(e.body, e), n(e.flags, e, "flags");
        break;
      default:
        throw new Error(`Unexpected node type "${f2}"`);
    }
    return h2?.exit?.(d2, N), u2?.exit?.(d2, N), i2;
  }
  return n(a2), a2;
}
function x2(a2) {
  if (!Array.isArray(a2)) throw new Error("Container expected");
  return a2;
}
function l2(a2) {
  if (typeof a2 != "number") throw new Error("Numeric key expected");
  return a2;
}

// node_modules/.pnpm/regex@6.1.0/node_modules/regex/src/utils-internals.js
var noncapturingDelim = String.raw`\(\?(?:[:=!>A-Za-z\-]|<[=!]|\(DEFINE\))`;
function incrementIfAtLeast(arr, threshold) {
  for (let i2 = 0; i2 < arr.length; i2++) {
    if (arr[i2] >= threshold) {
      arr[i2]++;
    }
  }
}
function spliceStr(str, pos, oldValue, newValue) {
  return str.slice(0, pos) + newValue + str.slice(pos + oldValue.length);
}

// node_modules/.pnpm/regex-utilities@2.3.0/node_modules/regex-utilities/src/index.js
var Context = Object.freeze({
  DEFAULT: "DEFAULT",
  CHAR_CLASS: "CHAR_CLASS"
});
function replaceUnescaped(expression, needle, replacement, context) {
  const re2 = new RegExp(String.raw`${needle}|(?<$skip>\[\^?|\\?.)`, "gsu");
  const negated = [false];
  let numCharClassesOpen = 0;
  let result = "";
  for (const match of expression.matchAll(re2)) {
    const { 0: m3, groups: { $skip } } = match;
    if (!$skip && (!context || context === Context.DEFAULT === !numCharClassesOpen)) {
      if (replacement instanceof Function) {
        result += replacement(match, {
          context: numCharClassesOpen ? Context.CHAR_CLASS : Context.DEFAULT,
          negated: negated[negated.length - 1]
        });
      } else {
        result += replacement;
      }
      continue;
    }
    if (m3[0] === "[") {
      numCharClassesOpen++;
      negated.push(m3[1] === "^");
    } else if (m3 === "]" && numCharClassesOpen) {
      numCharClassesOpen--;
      negated.pop();
    }
    result += m3;
  }
  return result;
}
function forEachUnescaped(expression, needle, callback, context) {
  replaceUnescaped(expression, needle, callback, context);
}
function execUnescaped(expression, needle, pos = 0, context) {
  if (!new RegExp(needle, "su").test(expression)) {
    return null;
  }
  const re2 = new RegExp(`${needle}|(?<$skip>\\\\?.)`, "gsu");
  re2.lastIndex = pos;
  let numCharClassesOpen = 0;
  let match;
  while (match = re2.exec(expression)) {
    const { 0: m3, groups: { $skip } } = match;
    if (!$skip && (!context || context === Context.DEFAULT === !numCharClassesOpen)) {
      return match;
    }
    if (m3 === "[") {
      numCharClassesOpen++;
    } else if (m3 === "]" && numCharClassesOpen) {
      numCharClassesOpen--;
    }
    if (re2.lastIndex == match.index) {
      re2.lastIndex++;
    }
  }
  return null;
}
function hasUnescaped(expression, needle, context) {
  return !!execUnescaped(expression, needle, 0, context);
}
function getGroupContents(expression, contentsStartPos) {
  const token2 = /\\?./gsu;
  token2.lastIndex = contentsStartPos;
  let contentsEndPos = expression.length;
  let numCharClassesOpen = 0;
  let numGroupsOpen = 1;
  let match;
  while (match = token2.exec(expression)) {
    const [m3] = match;
    if (m3 === "[") {
      numCharClassesOpen++;
    } else if (!numCharClassesOpen) {
      if (m3 === "(") {
        numGroupsOpen++;
      } else if (m3 === ")") {
        numGroupsOpen--;
        if (!numGroupsOpen) {
          contentsEndPos = match.index;
          break;
        }
      }
    } else if (m3 === "]") {
      numCharClassesOpen--;
    }
  }
  return expression.slice(contentsStartPos, contentsEndPos);
}

// node_modules/.pnpm/regex@6.1.0/node_modules/regex/src/atomic.js
var atomicPluginToken = new RegExp(String.raw`(?<noncapturingStart>${noncapturingDelim})|(?<capturingStart>\((?:\?<[^>]+>)?)|\\?.`, "gsu");
function atomic(expression, data) {
  const hiddenCaptures = data?.hiddenCaptures ?? [];
  let captureTransfers = data?.captureTransfers ?? /* @__PURE__ */ new Map();
  if (!/\(\?>/.test(expression)) {
    return {
      pattern: expression,
      captureTransfers,
      hiddenCaptures
    };
  }
  const aGDelim = "(?>";
  const emulatedAGDelim = "(?:(?=(";
  const captureNumMap = [0];
  const addedHiddenCaptures = [];
  let numCapturesBeforeAG = 0;
  let numAGs = 0;
  let aGPos = NaN;
  let hasProcessedAG;
  do {
    hasProcessedAG = false;
    let numCharClassesOpen = 0;
    let numGroupsOpenInAG = 0;
    let inAG = false;
    let match;
    atomicPluginToken.lastIndex = Number.isNaN(aGPos) ? 0 : aGPos + emulatedAGDelim.length;
    while (match = atomicPluginToken.exec(expression)) {
      const { 0: m3, index, groups: { capturingStart, noncapturingStart } } = match;
      if (m3 === "[") {
        numCharClassesOpen++;
      } else if (!numCharClassesOpen) {
        if (m3 === aGDelim && !inAG) {
          aGPos = index;
          inAG = true;
        } else if (inAG && noncapturingStart) {
          numGroupsOpenInAG++;
        } else if (capturingStart) {
          if (inAG) {
            numGroupsOpenInAG++;
          } else {
            numCapturesBeforeAG++;
            captureNumMap.push(numCapturesBeforeAG + numAGs);
          }
        } else if (m3 === ")" && inAG) {
          if (!numGroupsOpenInAG) {
            numAGs++;
            const addedCaptureNum = numCapturesBeforeAG + numAGs;
            expression = `${expression.slice(0, aGPos)}${emulatedAGDelim}${expression.slice(aGPos + aGDelim.length, index)}))<$$${addedCaptureNum}>)${expression.slice(index + 1)}`;
            hasProcessedAG = true;
            addedHiddenCaptures.push(addedCaptureNum);
            incrementIfAtLeast(hiddenCaptures, addedCaptureNum);
            if (captureTransfers.size) {
              const newCaptureTransfers = /* @__PURE__ */ new Map();
              captureTransfers.forEach((from, to) => {
                newCaptureTransfers.set(
                  to >= addedCaptureNum ? to + 1 : to,
                  from.map((f2) => f2 >= addedCaptureNum ? f2 + 1 : f2)
                );
              });
              captureTransfers = newCaptureTransfers;
            }
            break;
          }
          numGroupsOpenInAG--;
        }
      } else if (m3 === "]") {
        numCharClassesOpen--;
      }
    }
  } while (hasProcessedAG);
  hiddenCaptures.push(...addedHiddenCaptures);
  expression = replaceUnescaped(
    expression,
    String.raw`\\(?<backrefNum>[1-9]\d*)|<\$\$(?<wrappedBackrefNum>\d+)>`,
    ({ 0: m3, groups: { backrefNum, wrappedBackrefNum } }) => {
      if (backrefNum) {
        const bNum = +backrefNum;
        if (bNum > captureNumMap.length - 1) {
          throw new Error(`Backref "${m3}" greater than number of captures`);
        }
        return `\\${captureNumMap[bNum]}`;
      }
      return `\\${wrappedBackrefNum}`;
    },
    Context.DEFAULT
  );
  return {
    pattern: expression,
    captureTransfers,
    hiddenCaptures
  };
}
var baseQuantifier = String.raw`(?:[?*+]|\{\d+(?:,\d*)?\})`;
var possessivePluginToken = new RegExp(String.raw`
\\(?: \d+
  | c[A-Za-z]
  | [gk]<[^>]+>
  | [pPu]\{[^\}]+\}
  | u[A-Fa-f\d]{4}
  | x[A-Fa-f\d]{2}
  )
| \((?: \? (?: [:=!>]
  | <(?:[=!]|[^>]+>)
  | [A-Za-z\-]+:
  | \(DEFINE\)
  ))?
| (?<qBase>${baseQuantifier})(?<qMod>[?+]?)(?<invalidQ>[?*+\{]?)
| \\?.
`.replace(/\s+/g, ""), "gsu");
function possessive(expression) {
  if (!new RegExp(`${baseQuantifier}\\+`).test(expression)) {
    return {
      pattern: expression
    };
  }
  const openGroupIndices = [];
  let lastGroupIndex = null;
  let lastCharClassIndex = null;
  let lastToken = "";
  let numCharClassesOpen = 0;
  let match;
  possessivePluginToken.lastIndex = 0;
  while (match = possessivePluginToken.exec(expression)) {
    const { 0: m3, index, groups: { qBase, qMod, invalidQ } } = match;
    if (m3 === "[") {
      if (!numCharClassesOpen) {
        lastCharClassIndex = index;
      }
      numCharClassesOpen++;
    } else if (m3 === "]") {
      if (numCharClassesOpen) {
        numCharClassesOpen--;
      } else {
        lastCharClassIndex = null;
      }
    } else if (!numCharClassesOpen) {
      if (qMod === "+" && lastToken && !lastToken.startsWith("(")) {
        if (invalidQ) {
          throw new Error(`Invalid quantifier "${m3}"`);
        }
        let charsAdded = -1;
        if (/^\{\d+\}$/.test(qBase)) {
          expression = spliceStr(expression, index + qBase.length, qMod, "");
        } else {
          if (lastToken === ")" || lastToken === "]") {
            const nodeIndex = lastToken === ")" ? lastGroupIndex : lastCharClassIndex;
            if (nodeIndex === null) {
              throw new Error(`Invalid unmatched "${lastToken}"`);
            }
            expression = `${expression.slice(0, nodeIndex)}(?>${expression.slice(nodeIndex, index)}${qBase})${expression.slice(index + m3.length)}`;
          } else {
            expression = `${expression.slice(0, index - lastToken.length)}(?>${lastToken}${qBase})${expression.slice(index + m3.length)}`;
          }
          charsAdded += 4;
        }
        possessivePluginToken.lastIndex += charsAdded;
      } else if (m3[0] === "(") {
        openGroupIndices.push(index);
      } else if (m3 === ")") {
        lastGroupIndex = openGroupIndices.length ? openGroupIndices.pop() : null;
      }
    }
    lastToken = m3;
  }
  return {
    pattern: expression
  };
}

// node_modules/.pnpm/regex-recursion@6.0.2/node_modules/regex-recursion/src/index.js
var r2 = String.raw;
var gRToken = r2`\\g<(?<gRNameOrNum>[^>&]+)&R=(?<gRDepth>[^>]+)>`;
var recursiveToken = r2`\(\?R=(?<rDepth>[^\)]+)\)|${gRToken}`;
var namedCaptureDelim = r2`\(\?<(?![=!])(?<captureName>[^>]+)>`;
var captureDelim = r2`${namedCaptureDelim}|(?<unnamed>\()(?!\?)`;
var token = new RegExp(r2`${namedCaptureDelim}|${recursiveToken}|\(\?|\\?.`, "gsu");
var overlappingRecursionMsg = "Cannot use multiple overlapping recursions";
function recursion(pattern, data) {
  const { hiddenCaptures, mode } = {
    hiddenCaptures: [],
    mode: "plugin",
    ...data
  };
  let captureTransfers = data?.captureTransfers ?? /* @__PURE__ */ new Map();
  if (!new RegExp(recursiveToken, "su").test(pattern)) {
    return {
      pattern,
      captureTransfers,
      hiddenCaptures
    };
  }
  if (mode === "plugin" && hasUnescaped(pattern, r2`\(\?\(DEFINE\)`, Context.DEFAULT)) {
    throw new Error("DEFINE groups cannot be used with recursion");
  }
  const addedHiddenCaptures = [];
  const hasNumberedBackref = hasUnescaped(pattern, r2`\\[1-9]`, Context.DEFAULT);
  const groupContentsStartPos = /* @__PURE__ */ new Map();
  const openGroups = [];
  let hasRecursed = false;
  let numCharClassesOpen = 0;
  let numCapturesPassed = 0;
  let match;
  token.lastIndex = 0;
  while (match = token.exec(pattern)) {
    const { 0: m3, groups: { captureName, rDepth, gRNameOrNum, gRDepth } } = match;
    if (m3 === "[") {
      numCharClassesOpen++;
    } else if (!numCharClassesOpen) {
      if (rDepth) {
        assertMaxInBounds(rDepth);
        if (hasRecursed) {
          throw new Error(overlappingRecursionMsg);
        }
        if (hasNumberedBackref) {
          throw new Error(
            // When used in `external` mode by transpilers other than Regex+, backrefs might have
            // gone through conversion from named to numbered, so avoid a misleading error
            `${mode === "external" ? "Backrefs" : "Numbered backrefs"} cannot be used with global recursion`
          );
        }
        const left = pattern.slice(0, match.index);
        const right = pattern.slice(token.lastIndex);
        if (hasUnescaped(right, recursiveToken, Context.DEFAULT)) {
          throw new Error(overlappingRecursionMsg);
        }
        const reps = +rDepth - 1;
        pattern = makeRecursive(
          left,
          right,
          reps,
          false,
          hiddenCaptures,
          addedHiddenCaptures,
          numCapturesPassed
        );
        captureTransfers = mapCaptureTransfers(
          captureTransfers,
          left,
          reps,
          addedHiddenCaptures.length,
          0,
          numCapturesPassed
        );
        break;
      } else if (gRNameOrNum) {
        assertMaxInBounds(gRDepth);
        let isWithinReffedGroup = false;
        for (const g of openGroups) {
          if (g.name === gRNameOrNum || g.num === +gRNameOrNum) {
            isWithinReffedGroup = true;
            if (g.hasRecursedWithin) {
              throw new Error(overlappingRecursionMsg);
            }
            break;
          }
        }
        if (!isWithinReffedGroup) {
          throw new Error(r2`Recursive \g cannot be used outside the referenced group "${mode === "external" ? gRNameOrNum : r2`\g<${gRNameOrNum}&R=${gRDepth}>`}"`);
        }
        const startPos = groupContentsStartPos.get(gRNameOrNum);
        const groupContents = getGroupContents(pattern, startPos);
        if (hasNumberedBackref && hasUnescaped(groupContents, r2`${namedCaptureDelim}|\((?!\?)`, Context.DEFAULT)) {
          throw new Error(
            // When used in `external` mode by transpilers other than Regex+, backrefs might have
            // gone through conversion from named to numbered, so avoid a misleading error
            `${mode === "external" ? "Backrefs" : "Numbered backrefs"} cannot be used with recursion of capturing groups`
          );
        }
        const groupContentsLeft = pattern.slice(startPos, match.index);
        const groupContentsRight = groupContents.slice(groupContentsLeft.length + m3.length);
        const numAddedHiddenCapturesPreExpansion = addedHiddenCaptures.length;
        const reps = +gRDepth - 1;
        const expansion = makeRecursive(
          groupContentsLeft,
          groupContentsRight,
          reps,
          true,
          hiddenCaptures,
          addedHiddenCaptures,
          numCapturesPassed
        );
        captureTransfers = mapCaptureTransfers(
          captureTransfers,
          groupContentsLeft,
          reps,
          addedHiddenCaptures.length - numAddedHiddenCapturesPreExpansion,
          numAddedHiddenCapturesPreExpansion,
          numCapturesPassed
        );
        const pre = pattern.slice(0, startPos);
        const post = pattern.slice(startPos + groupContents.length);
        pattern = `${pre}${expansion}${post}`;
        token.lastIndex += expansion.length - m3.length - groupContentsLeft.length - groupContentsRight.length;
        openGroups.forEach((g) => g.hasRecursedWithin = true);
        hasRecursed = true;
      } else if (captureName) {
        numCapturesPassed++;
        groupContentsStartPos.set(String(numCapturesPassed), token.lastIndex);
        groupContentsStartPos.set(captureName, token.lastIndex);
        openGroups.push({
          num: numCapturesPassed,
          name: captureName
        });
      } else if (m3[0] === "(") {
        const isUnnamedCapture = m3 === "(";
        if (isUnnamedCapture) {
          numCapturesPassed++;
          groupContentsStartPos.set(String(numCapturesPassed), token.lastIndex);
        }
        openGroups.push(isUnnamedCapture ? { num: numCapturesPassed } : {});
      } else if (m3 === ")") {
        openGroups.pop();
      }
    } else if (m3 === "]") {
      numCharClassesOpen--;
    }
  }
  hiddenCaptures.push(...addedHiddenCaptures);
  return {
    pattern,
    captureTransfers,
    hiddenCaptures
  };
}
function assertMaxInBounds(max) {
  const errMsg = `Max depth must be integer between 2 and 100; used ${max}`;
  if (!/^[1-9]\d*$/.test(max)) {
    throw new Error(errMsg);
  }
  max = +max;
  if (max < 2 || max > 100) {
    throw new Error(errMsg);
  }
}
function makeRecursive(left, right, reps, isSubpattern, hiddenCaptures, addedHiddenCaptures, numCapturesPassed) {
  const namesInRecursed = /* @__PURE__ */ new Set();
  if (isSubpattern) {
    forEachUnescaped(left + right, namedCaptureDelim, ({ groups: { captureName } }) => {
      namesInRecursed.add(captureName);
    }, Context.DEFAULT);
  }
  const rest = [
    reps,
    isSubpattern ? namesInRecursed : null,
    hiddenCaptures,
    addedHiddenCaptures,
    numCapturesPassed
  ];
  return `${left}${repeatWithDepth(`(?:${left}`, "forward", ...rest)}(?:)${repeatWithDepth(`${right})`, "backward", ...rest)}${right}`;
}
function repeatWithDepth(pattern, direction, reps, namesInRecursed, hiddenCaptures, addedHiddenCaptures, numCapturesPassed) {
  const startNum = 2;
  const getDepthNum = (i2) => direction === "forward" ? i2 + startNum : reps - i2 + startNum - 1;
  let result = "";
  for (let i2 = 0; i2 < reps; i2++) {
    const depthNum = getDepthNum(i2);
    result += replaceUnescaped(
      pattern,
      r2`${captureDelim}|\\k<(?<backref>[^>]+)>`,
      ({ 0: m3, groups: { captureName, unnamed, backref } }) => {
        if (backref && namesInRecursed && !namesInRecursed.has(backref)) {
          return m3;
        }
        const suffix = `_$${depthNum}`;
        if (unnamed || captureName) {
          const addedCaptureNum = numCapturesPassed + addedHiddenCaptures.length + 1;
          addedHiddenCaptures.push(addedCaptureNum);
          incrementIfAtLeast2(hiddenCaptures, addedCaptureNum);
          return unnamed ? m3 : `(?<${captureName}${suffix}>`;
        }
        return r2`\k<${backref}${suffix}>`;
      },
      Context.DEFAULT
    );
  }
  return result;
}
function incrementIfAtLeast2(arr, threshold) {
  for (let i2 = 0; i2 < arr.length; i2++) {
    if (arr[i2] >= threshold) {
      arr[i2]++;
    }
  }
}
function mapCaptureTransfers(captureTransfers, left, reps, numCapturesAddedInExpansion, numAddedHiddenCapturesPreExpansion, numCapturesPassed) {
  if (captureTransfers.size && numCapturesAddedInExpansion) {
    let numCapturesInLeft = 0;
    forEachUnescaped(left, captureDelim, () => numCapturesInLeft++, Context.DEFAULT);
    const recursionDelimCaptureNum = numCapturesPassed - numCapturesInLeft + numAddedHiddenCapturesPreExpansion;
    const newCaptureTransfers = /* @__PURE__ */ new Map();
    captureTransfers.forEach((from, to) => {
      const numCapturesInRight = (numCapturesAddedInExpansion - numCapturesInLeft * reps) / reps;
      const numCapturesAddedInLeft = numCapturesInLeft * reps;
      const newTo = to > recursionDelimCaptureNum + numCapturesInLeft ? to + numCapturesAddedInExpansion : to;
      const newFrom = [];
      for (const f2 of from) {
        if (f2 <= recursionDelimCaptureNum) {
          newFrom.push(f2);
        } else if (f2 > recursionDelimCaptureNum + numCapturesInLeft + numCapturesInRight) {
          newFrom.push(f2 + numCapturesAddedInExpansion);
        } else if (f2 <= recursionDelimCaptureNum + numCapturesInLeft) {
          for (let i2 = 0; i2 <= reps; i2++) {
            newFrom.push(f2 + numCapturesInLeft * i2);
          }
        } else {
          for (let i2 = 0; i2 <= reps; i2++) {
            newFrom.push(f2 + numCapturesAddedInLeft + numCapturesInRight * i2);
          }
        }
      }
      newCaptureTransfers.set(newTo, newFrom);
    });
    return newCaptureTransfers;
  }
  return captureTransfers;
}

// node_modules/.pnpm/oniguruma-to-es@4.3.6/node_modules/oniguruma-to-es/dist/esm/index.js
var cp = String.fromCodePoint;
var r3 = String.raw;
var envFlags = {};
var globalRegExp = globalThis.RegExp;
envFlags.flagGroups = (() => {
  try {
    new globalRegExp("(?i:)");
  } catch {
    return false;
  }
  return true;
})();
envFlags.unicodeSets = (() => {
  try {
    new globalRegExp("[[]]", "v");
  } catch {
    return false;
  }
  return true;
})();
envFlags.bugFlagVLiteralHyphenIsRange = envFlags.unicodeSets ? (() => {
  try {
    new globalRegExp(r3`[\d\-a]`, "v");
  } catch {
    return true;
  }
  return false;
})() : false;
envFlags.bugNestedClassIgnoresNegation = envFlags.unicodeSets && new globalRegExp("[[^a]]", "v").test("a");
function getNewCurrentFlags(current, { enable, disable }) {
  return {
    dotAll: !disable?.dotAll && !!(enable?.dotAll || current.dotAll),
    ignoreCase: !disable?.ignoreCase && !!(enable?.ignoreCase || current.ignoreCase)
  };
}
function getOrInsert(map, key2, defaultValue) {
  if (!map.has(key2)) {
    map.set(key2, defaultValue);
  }
  return map.get(key2);
}
function isMinTarget(target, min) {
  return EsVersion[target] >= EsVersion[min];
}
function throwIfNullish(value, msg) {
  if (value == null) {
    throw new Error(msg ?? "Value expected");
  }
  return value;
}
var EsVersion = {
  ES2025: 2025,
  ES2024: 2024,
  ES2018: 2018
};
var Target = (
  /** @type {const} */
  {
    auto: "auto",
    ES2025: "ES2025",
    ES2024: "ES2024",
    ES2018: "ES2018"
  }
);
function getOptions(options = {}) {
  if ({}.toString.call(options) !== "[object Object]") {
    throw new Error("Unexpected options");
  }
  if (options.target !== void 0 && !Target[options.target]) {
    throw new Error(`Unexpected target "${options.target}"`);
  }
  const opts = {
    // Sets the level of emulation rigor/strictness.
    accuracy: "default",
    // Disables advanced emulation that relies on returning a `RegExp` subclass, resulting in
    // certain patterns not being emulatable.
    avoidSubclass: false,
    // Oniguruma flags; a string with `i`, `m`, `x`, `D`, `S`, `W`, `y{g}` in any order (all
    // optional). Oniguruma's `m` is equivalent to JavaScript's `s` (`dotAll`).
    flags: "",
    // Include JavaScript flag `g` (`global`) in the result.
    global: false,
    // Include JavaScript flag `d` (`hasIndices`) in the result.
    hasIndices: false,
    // Delay regex construction until first use if the transpiled pattern is at least this length.
    lazyCompileLength: Infinity,
    // JavaScript version used for generated regexes. Using `auto` detects the best value based on
    // your environment. Later targets allow faster processing, simpler generated source, and
    // support for additional features.
    target: "auto",
    // Disables minifications that simplify the pattern without changing the meaning.
    verbose: false,
    ...options,
    // Advanced options that override standard behavior, error checking, and flags when enabled.
    rules: {
      // Useful with TextMate grammars that merge backreferences across patterns.
      allowOrphanBackrefs: false,
      // Use ASCII `\b` and `\B`, which increases search performance of generated regexes.
      asciiWordBoundaries: false,
      // Allow unnamed captures and numbered calls (backreferences and subroutines) when using
      // named capture. This is Oniguruma option `ONIG_OPTION_CAPTURE_GROUP`; on by default in
      // `vscode-oniguruma`.
      captureGroup: false,
      // Change the recursion depth limit from Oniguruma's `20` to an integer `2`–`20`.
      recursionLimit: 20,
      // `^` as `\A`; `$` as`\Z`. Improves search performance of generated regexes without changing
      // the meaning if searching line by line. This is Oniguruma option `ONIG_OPTION_SINGLELINE`.
      singleline: false,
      ...options.rules
    }
  };
  if (opts.target === "auto") {
    opts.target = envFlags.flagGroups ? "ES2025" : envFlags.unicodeSets ? "ES2024" : "ES2018";
  }
  return opts;
}
var asciiSpaceChar = "[	-\r ]";
var CharsWithoutIgnoreCaseExpansion = /* @__PURE__ */ new Set([
  cp(304),
  // İ
  cp(305)
  // ı
]);
var defaultWordChar = r3`[\p{L}\p{M}\p{N}\p{Pc}]`;
function getIgnoreCaseMatchChars(char) {
  if (CharsWithoutIgnoreCaseExpansion.has(char)) {
    return [char];
  }
  const set = /* @__PURE__ */ new Set();
  const lower = char.toLowerCase();
  const upper = lower.toUpperCase();
  const title = LowerToTitleCaseMap.get(lower);
  const altLower = LowerToAlternativeLowerCaseMap.get(lower);
  const altUpper = LowerToAlternativeUpperCaseMap.get(lower);
  if ([...upper].length === 1) {
    set.add(upper);
  }
  altUpper && set.add(altUpper);
  title && set.add(title);
  set.add(lower);
  altLower && set.add(altLower);
  return [...set];
}
var JsUnicodePropertyMap = /* @__PURE__ */ new Map(
  `C Other
Cc Control cntrl
Cf Format
Cn Unassigned
Co Private_Use
Cs Surrogate
L Letter
LC Cased_Letter
Ll Lowercase_Letter
Lm Modifier_Letter
Lo Other_Letter
Lt Titlecase_Letter
Lu Uppercase_Letter
M Mark Combining_Mark
Mc Spacing_Mark
Me Enclosing_Mark
Mn Nonspacing_Mark
N Number
Nd Decimal_Number digit
Nl Letter_Number
No Other_Number
P Punctuation punct
Pc Connector_Punctuation
Pd Dash_Punctuation
Pe Close_Punctuation
Pf Final_Punctuation
Pi Initial_Punctuation
Po Other_Punctuation
Ps Open_Punctuation
S Symbol
Sc Currency_Symbol
Sk Modifier_Symbol
Sm Math_Symbol
So Other_Symbol
Z Separator
Zl Line_Separator
Zp Paragraph_Separator
Zs Space_Separator
ASCII
ASCII_Hex_Digit AHex
Alphabetic Alpha
Any
Assigned
Bidi_Control Bidi_C
Bidi_Mirrored Bidi_M
Case_Ignorable CI
Cased
Changes_When_Casefolded CWCF
Changes_When_Casemapped CWCM
Changes_When_Lowercased CWL
Changes_When_NFKC_Casefolded CWKCF
Changes_When_Titlecased CWT
Changes_When_Uppercased CWU
Dash
Default_Ignorable_Code_Point DI
Deprecated Dep
Diacritic Dia
Emoji
Emoji_Component EComp
Emoji_Modifier EMod
Emoji_Modifier_Base EBase
Emoji_Presentation EPres
Extended_Pictographic ExtPict
Extender Ext
Grapheme_Base Gr_Base
Grapheme_Extend Gr_Ext
Hex_Digit Hex
IDS_Binary_Operator IDSB
IDS_Trinary_Operator IDST
ID_Continue IDC
ID_Start IDS
Ideographic Ideo
Join_Control Join_C
Logical_Order_Exception LOE
Lowercase Lower
Math
Noncharacter_Code_Point NChar
Pattern_Syntax Pat_Syn
Pattern_White_Space Pat_WS
Quotation_Mark QMark
Radical
Regional_Indicator RI
Sentence_Terminal STerm
Soft_Dotted SD
Terminal_Punctuation Term
Unified_Ideograph UIdeo
Uppercase Upper
Variation_Selector VS
White_Space space
XID_Continue XIDC
XID_Start XIDS`.split(/\s/).map((p2) => [w2(p2), p2])
);
var LowerToAlternativeLowerCaseMap = /* @__PURE__ */ new Map([
  ["s", cp(383)],
  // s, ſ
  [cp(383), "s"]
  // ſ, s
]);
var LowerToAlternativeUpperCaseMap = /* @__PURE__ */ new Map([
  [cp(223), cp(7838)],
  // ß, ẞ
  [cp(107), cp(8490)],
  // k, K (Kelvin)
  [cp(229), cp(8491)],
  // å, Å (Angstrom)
  [cp(969), cp(8486)]
  // ω, Ω (Ohm)
]);
var LowerToTitleCaseMap = new Map([
  titleEntry(453),
  titleEntry(456),
  titleEntry(459),
  titleEntry(498),
  ...titleRange(8072, 8079),
  ...titleRange(8088, 8095),
  ...titleRange(8104, 8111),
  titleEntry(8124),
  titleEntry(8140),
  titleEntry(8188)
]);
var PosixClassMap = /* @__PURE__ */ new Map([
  ["alnum", r3`[\p{Alpha}\p{Nd}]`],
  ["alpha", r3`\p{Alpha}`],
  ["ascii", r3`\p{ASCII}`],
  ["blank", r3`[\p{Zs}\t]`],
  ["cntrl", r3`\p{Cc}`],
  ["digit", r3`\p{Nd}`],
  ["graph", r3`[\P{space}&&\P{Cc}&&\P{Cn}&&\P{Cs}]`],
  ["lower", r3`\p{Lower}`],
  ["print", r3`[[\P{space}&&\P{Cc}&&\P{Cn}&&\P{Cs}]\p{Zs}]`],
  ["punct", r3`[\p{P}\p{S}]`],
  // Updated value from Onig 6.9.9; changed from Unicode `\p{punct}`
  ["space", r3`\p{space}`],
  ["upper", r3`\p{Upper}`],
  ["word", r3`[\p{Alpha}\p{M}\p{Nd}\p{Pc}]`],
  ["xdigit", r3`\p{AHex}`]
]);
function range(start, end) {
  const range2 = [];
  for (let i2 = start; i2 <= end; i2++) {
    range2.push(i2);
  }
  return range2;
}
function titleEntry(codePoint) {
  const char = cp(codePoint);
  return [char.toLowerCase(), char];
}
function titleRange(start, end) {
  return range(start, end).map((codePoint) => titleEntry(codePoint));
}
var UnicodePropertiesWithSpecificCase = /* @__PURE__ */ new Set([
  "Lower",
  "Lowercase",
  "Upper",
  "Uppercase",
  "Ll",
  "Lowercase_Letter",
  "Lt",
  "Titlecase_Letter",
  "Lu",
  "Uppercase_Letter"
  // The `Changes_When_*` properties (and their aliases) could be included, but they're very rare.
  // Some other properties include a handful of chars with specific cases only, but these chars are
  // generally extreme edge cases and using such properties case insensitively generally produces
  // undesired behavior anyway
]);
function transform(ast, options) {
  const opts = {
    // A couple edge cases exist where options `accuracy` and `bestEffortTarget` are used:
    // - `CharacterSet` kind `text_segment` (`\X`): An exact representation would require heavy
    //   Unicode data; a best-effort approximation requires knowing the target.
    // - `CharacterSet` kind `posix` with values `graph` and `print`: Their complex Unicode
    //   representations would be hard to change to ASCII versions after the fact in the generator
    //   based on `target`/`accuracy`, so produce the appropriate structure here.
    accuracy: "default",
    asciiWordBoundaries: false,
    avoidSubclass: false,
    bestEffortTarget: "ES2025",
    ...options
  };
  addParentProperties(ast);
  const firstPassState = {
    accuracy: opts.accuracy,
    asciiWordBoundaries: opts.asciiWordBoundaries,
    avoidSubclass: opts.avoidSubclass,
    flagDirectivesByAlt: /* @__PURE__ */ new Map(),
    jsGroupNameMap: /* @__PURE__ */ new Map(),
    minTargetEs2024: isMinTarget(opts.bestEffortTarget, "ES2024"),
    passedLookbehind: false,
    strategy: null,
    // Subroutines can appear before the groups they ref, so collect reffed nodes for a second pass 
    subroutineRefMap: /* @__PURE__ */ new Map(),
    supportedGNodes: /* @__PURE__ */ new Set(),
    digitIsAscii: ast.flags.digitIsAscii,
    spaceIsAscii: ast.flags.spaceIsAscii,
    wordIsAscii: ast.flags.wordIsAscii
  };
  S(ast, FirstPassVisitor, firstPassState);
  const globalFlags = {
    dotAll: ast.flags.dotAll,
    ignoreCase: ast.flags.ignoreCase
  };
  const secondPassState = {
    currentFlags: globalFlags,
    prevFlags: null,
    globalFlags,
    groupOriginByCopy: /* @__PURE__ */ new Map(),
    groupsByName: /* @__PURE__ */ new Map(),
    multiplexCapturesToLeftByRef: /* @__PURE__ */ new Map(),
    openRefs: /* @__PURE__ */ new Map(),
    reffedNodesByReferencer: /* @__PURE__ */ new Map(),
    subroutineRefMap: firstPassState.subroutineRefMap
  };
  S(ast, SecondPassVisitor, secondPassState);
  const thirdPassState = {
    groupsByName: secondPassState.groupsByName,
    highestOrphanBackref: 0,
    numCapturesToLeft: 0,
    reffedNodesByReferencer: secondPassState.reffedNodesByReferencer
  };
  S(ast, ThirdPassVisitor, thirdPassState);
  ast._originMap = secondPassState.groupOriginByCopy;
  ast._strategy = firstPassState.strategy;
  return ast;
}
var FirstPassVisitor = {
  AbsenceFunction({ node, parent, replaceWith }) {
    const { body: body3, kind } = node;
    if (kind === "repeater") {
      const innerGroup = A2();
      innerGroup.body[0].body.push(
        // Insert own alts as `body`
        K2({ negate: true, body: body3 }),
        Q2("Any")
      );
      const outerGroup = A2();
      outerGroup.body[0].body.push(
        _2("greedy", 0, Infinity, innerGroup)
      );
      replaceWith(setParentDeep(outerGroup, parent), { traverse: true });
    } else {
      throw new Error(`Unsupported absence function "(?~|"`);
    }
  },
  Alternative: {
    enter({ node, parent, key: key2 }, { flagDirectivesByAlt }) {
      const flagDirectives = node.body.filter((el) => el.kind === "flags");
      for (let i2 = key2 + 1; i2 < parent.body.length; i2++) {
        const forwardSiblingAlt = parent.body[i2];
        getOrInsert(flagDirectivesByAlt, forwardSiblingAlt, []).push(...flagDirectives);
      }
    },
    exit({ node }, { flagDirectivesByAlt }) {
      if (flagDirectivesByAlt.get(node)?.length) {
        const flags = getCombinedFlagModsFromFlagNodes(flagDirectivesByAlt.get(node));
        if (flags) {
          const flagGroup = A2({ flags });
          flagGroup.body[0].body = node.body;
          node.body = [setParentDeep(flagGroup, node)];
        }
      }
    }
  },
  Assertion({ node, parent, key: key2, container, root: root2, remove, replaceWith }, state) {
    const { kind, negate } = node;
    const { asciiWordBoundaries, avoidSubclass, supportedGNodes, wordIsAscii } = state;
    if (kind === "text_segment_boundary") {
      throw new Error(`Unsupported text segment boundary "\\${negate ? "Y" : "y"}"`);
    } else if (kind === "line_end") {
      replaceWith(setParentDeep(K2({ body: [
        b2({ body: [F2("string_end")] }),
        b2({ body: [m2(10)] })
        // `\n`
      ] }), parent));
    } else if (kind === "line_start") {
      replaceWith(setParentDeep(parseFragment(r3`(?<=\A|\n(?!\z))`, { skipLookbehindValidation: true }), parent));
    } else if (kind === "search_start") {
      if (supportedGNodes.has(node)) {
        root2.flags.sticky = true;
        remove();
      } else {
        const prev = container[key2 - 1];
        if (prev && isAlwaysNonZeroLength(prev)) {
          replaceWith(setParentDeep(K2({ negate: true }), parent));
        } else if (avoidSubclass) {
          throw new Error(r3`Uses "\G" in a way that requires a subclass`);
        } else {
          replaceWith(setParent(F2("string_start"), parent));
          state.strategy = "clip_search";
        }
      }
    } else if (kind === "string_end" || kind === "string_start") {
    } else if (kind === "string_end_newline") {
      replaceWith(setParentDeep(parseFragment(r3`(?=\n?\z)`), parent));
    } else if (kind === "word_boundary") {
      if (!wordIsAscii && !asciiWordBoundaries) {
        const b3 = `(?:(?<=${defaultWordChar})(?!${defaultWordChar})|(?<!${defaultWordChar})(?=${defaultWordChar}))`;
        const B3 = `(?:(?<=${defaultWordChar})(?=${defaultWordChar})|(?<!${defaultWordChar})(?!${defaultWordChar}))`;
        replaceWith(setParentDeep(parseFragment(negate ? B3 : b3), parent));
      }
    } else {
      throw new Error(`Unexpected assertion kind "${kind}"`);
    }
  },
  Backreference({ node }, { jsGroupNameMap }) {
    let { ref } = node;
    if (typeof ref === "string" && !isValidJsGroupName(ref)) {
      ref = getAndStoreJsGroupName(ref, jsGroupNameMap);
      node.ref = ref;
    }
  },
  CapturingGroup({ node }, { jsGroupNameMap, subroutineRefMap }) {
    let { name } = node;
    if (name && !isValidJsGroupName(name)) {
      name = getAndStoreJsGroupName(name, jsGroupNameMap);
      node.name = name;
    }
    subroutineRefMap.set(node.number, node);
    if (name) {
      subroutineRefMap.set(name, node);
    }
  },
  CharacterClassRange({ node, parent, replaceWith }) {
    if (parent.kind === "intersection") {
      const cc = C2({ body: [node] });
      replaceWith(setParentDeep(cc, parent), { traverse: true });
    }
  },
  CharacterSet({ node, parent, replaceWith }, { accuracy, minTargetEs2024, digitIsAscii, spaceIsAscii, wordIsAscii }) {
    const { kind, negate, value } = node;
    if (digitIsAscii && (kind === "digit" || value === "digit")) {
      replaceWith(setParent(E2("digit", { negate }), parent));
      return;
    }
    if (spaceIsAscii && (kind === "space" || value === "space")) {
      replaceWith(setParentDeep(setNegate(parseFragment(asciiSpaceChar), negate), parent));
      return;
    }
    if (wordIsAscii && (kind === "word" || value === "word")) {
      replaceWith(setParent(E2("word", { negate }), parent));
      return;
    }
    if (kind === "any") {
      replaceWith(setParent(Q2("Any"), parent));
    } else if (kind === "digit") {
      replaceWith(setParent(Q2("Nd", { negate }), parent));
    } else if (kind === "dot") {
    } else if (kind === "text_segment") {
      if (accuracy === "strict") {
        throw new Error(r3`Use of "\X" requires non-strict accuracy`);
      }
      const eBase = "\\p{Emoji}(?:\\p{EMod}|\\uFE0F\\u20E3?|[\\x{E0020}-\\x{E007E}]+\\x{E007F})?";
      const emoji = r3`\p{RI}{2}|${eBase}(?:\u200D${eBase})*`;
      replaceWith(setParentDeep(parseFragment(
        // Close approximation of an extended grapheme cluster; see <unicode.org/reports/tr29/>
        r3`(?>\r\n|${minTargetEs2024 ? r3`\p{RGI_Emoji}` : emoji}|\P{M}\p{M}*)`,
        // Allow JS property `RGI_Emoji` through
        { skipPropertyNameValidation: true }
      ), parent));
    } else if (kind === "hex") {
      replaceWith(setParent(Q2("AHex", { negate }), parent));
    } else if (kind === "newline") {
      replaceWith(setParentDeep(parseFragment(negate ? "[^\n]" : "(?>\r\n?|[\n\v\f\x85\u2028\u2029])"), parent));
    } else if (kind === "posix") {
      if (!minTargetEs2024 && (value === "graph" || value === "print")) {
        if (accuracy === "strict") {
          throw new Error(`POSIX class "${value}" requires min target ES2024 or non-strict accuracy`);
        }
        let ascii = {
          graph: "!-~",
          print: " -~"
        }[value];
        if (negate) {
          ascii = `\0-${cp(ascii.codePointAt(0) - 1)}${cp(ascii.codePointAt(2) + 1)}-\u{10FFFF}`;
        }
        replaceWith(setParentDeep(parseFragment(`[${ascii}]`), parent));
      } else {
        replaceWith(setParentDeep(setNegate(parseFragment(PosixClassMap.get(value)), negate), parent));
      }
    } else if (kind === "property") {
      if (!JsUnicodePropertyMap.has(w2(value))) {
        node.key = "sc";
      }
    } else if (kind === "space") {
      replaceWith(setParent(Q2("space", { negate }), parent));
    } else if (kind === "word") {
      replaceWith(setParentDeep(setNegate(parseFragment(defaultWordChar), negate), parent));
    } else {
      throw new Error(`Unexpected character set kind "${kind}"`);
    }
  },
  Directive({ node, parent, root: root2, remove, replaceWith, removeAllPrevSiblings, removeAllNextSiblings }) {
    const { kind, flags } = node;
    if (kind === "flags") {
      if (!flags.enable && !flags.disable) {
        remove();
      } else {
        const flagGroup = A2({ flags });
        flagGroup.body[0].body = removeAllNextSiblings();
        replaceWith(setParentDeep(flagGroup, parent), { traverse: true });
      }
    } else if (kind === "keep") {
      const firstAlt = root2.body[0];
      const hasWrapperGroup = root2.body.length === 1 && // Not emulatable if within a `CapturingGroup`
      o2(firstAlt, { type: "Group" }) && firstAlt.body[0].body.length === 1;
      const topLevel = hasWrapperGroup ? firstAlt.body[0] : root2;
      if (parent.parent !== topLevel || topLevel.body.length > 1) {
        throw new Error(r3`Uses "\K" in a way that's unsupported`);
      }
      const lookbehind = K2({ behind: true });
      lookbehind.body[0].body = removeAllPrevSiblings();
      replaceWith(setParentDeep(lookbehind, parent));
    } else {
      throw new Error(`Unexpected directive kind "${kind}"`);
    }
  },
  Flags({ node, parent }) {
    if (node.posixIsAscii) {
      throw new Error('Unsupported flag "P"');
    }
    if (node.textSegmentMode === "word") {
      throw new Error('Unsupported flag "y{w}"');
    }
    [
      "digitIsAscii",
      // Flag D
      "extended",
      // Flag x
      "posixIsAscii",
      // Flag P
      "spaceIsAscii",
      // Flag S
      "wordIsAscii",
      // Flag W
      "textSegmentMode"
      // Flag y{g} or y{w}
    ].forEach((f2) => delete node[f2]);
    Object.assign(node, {
      // JS flag g; no Onig equiv
      global: false,
      // JS flag d; no Onig equiv
      hasIndices: false,
      // JS flag m; no Onig equiv but its behavior is always on in Onig. Onig's only line break
      // char is line feed, unlike JS, so this flag isn't used since it would produce inaccurate
      // results (also allows `^` and `$` to be used in the generator for string start and end)
      multiline: false,
      // JS flag y; no Onig equiv, but used for `\G` emulation
      sticky: node.sticky ?? false
      // Note: Regex+ doesn't allow explicitly adding flags it handles implicitly, so leave out
      // properties `unicode` (JS flag u) and `unicodeSets` (JS flag v). Keep the existing values
      // for `ignoreCase` (flag i) and `dotAll` (JS flag s, but Onig flag m)
    });
    parent.options = {
      disable: {
        // Onig uses different rules for flag x than Regex+, so disable the implicit flag
        x: true,
        // Onig has no flag to control "named capture only" mode but contextually applies its
        // behavior when named capturing is used, so disable Regex+'s implicit flag for it
        n: true
      },
      force: {
        // Always add flag v because we're generating an AST that relies on it (it enables JS
        // support for Onig features nested classes, intersection, Unicode properties, etc.).
        // However, the generator might disable flag v based on its `target` option
        v: true
      }
    };
  },
  Group({ node }) {
    if (!node.flags) {
      return;
    }
    const { enable, disable } = node.flags;
    enable?.extended && delete enable.extended;
    disable?.extended && delete disable.extended;
    enable?.dotAll && disable?.dotAll && delete enable.dotAll;
    enable?.ignoreCase && disable?.ignoreCase && delete enable.ignoreCase;
    enable && !Object.keys(enable).length && delete node.flags.enable;
    disable && !Object.keys(disable).length && delete node.flags.disable;
    !node.flags.enable && !node.flags.disable && delete node.flags;
  },
  LookaroundAssertion({ node }, state) {
    const { kind } = node;
    if (kind === "lookbehind") {
      state.passedLookbehind = true;
    }
  },
  NamedCallout({ node, parent, replaceWith }) {
    const { kind } = node;
    if (kind === "fail") {
      replaceWith(setParentDeep(K2({ negate: true }), parent));
    } else {
      throw new Error(`Unsupported named callout "(*${kind.toUpperCase()}"`);
    }
  },
  Quantifier({ node }) {
    if (node.body.type === "Quantifier") {
      const group = A2();
      group.body[0].body.push(node.body);
      node.body = setParentDeep(group, node);
    }
  },
  Regex: {
    enter({ node }, { supportedGNodes }) {
      const leadingGs = [];
      let hasAltWithLeadG = false;
      let hasAltWithoutLeadG = false;
      for (const alt of node.body) {
        if (alt.body.length === 1 && alt.body[0].kind === "search_start") {
          alt.body.pop();
        } else {
          const leadingG = getLeadingG(alt.body);
          if (leadingG) {
            hasAltWithLeadG = true;
            Array.isArray(leadingG) ? leadingGs.push(...leadingG) : leadingGs.push(leadingG);
          } else {
            hasAltWithoutLeadG = true;
          }
        }
      }
      if (hasAltWithLeadG && !hasAltWithoutLeadG) {
        leadingGs.forEach((g) => supportedGNodes.add(g));
      }
    },
    exit(_3, { accuracy, passedLookbehind, strategy }) {
      if (accuracy === "strict" && passedLookbehind && strategy) {
        throw new Error(r3`Uses "\G" in a way that requires non-strict accuracy`);
      }
    }
  },
  Subroutine({ node }, { jsGroupNameMap }) {
    let { ref } = node;
    if (typeof ref === "string" && !isValidJsGroupName(ref)) {
      ref = getAndStoreJsGroupName(ref, jsGroupNameMap);
      node.ref = ref;
    }
  }
};
var SecondPassVisitor = {
  Backreference({ node }, { multiplexCapturesToLeftByRef, reffedNodesByReferencer }) {
    const { orphan, ref } = node;
    if (!orphan) {
      reffedNodesByReferencer.set(node, [...multiplexCapturesToLeftByRef.get(ref).map(({ node: node2 }) => node2)]);
    }
  },
  CapturingGroup: {
    enter({
      node,
      parent,
      replaceWith,
      skip
    }, {
      groupOriginByCopy,
      groupsByName,
      multiplexCapturesToLeftByRef,
      openRefs,
      reffedNodesByReferencer
    }) {
      const origin = groupOriginByCopy.get(node);
      if (origin && openRefs.has(node.number)) {
        const recursion2 = setParent(createRecursion(node.number), parent);
        reffedNodesByReferencer.set(recursion2, openRefs.get(node.number));
        replaceWith(recursion2);
        return;
      }
      openRefs.set(node.number, node);
      multiplexCapturesToLeftByRef.set(node.number, []);
      if (node.name) {
        getOrInsert(multiplexCapturesToLeftByRef, node.name, []);
      }
      const multiplexNodes = multiplexCapturesToLeftByRef.get(node.name ?? node.number);
      for (let i2 = 0; i2 < multiplexNodes.length; i2++) {
        const multiplex = multiplexNodes[i2];
        if (
          // This group is from subroutine expansion, and there's a multiplex value from either the
          // origin node or a prior subroutine expansion group with the same origin
          origin === multiplex.node || origin && origin === multiplex.origin || // This group is not from subroutine expansion, and it comes after a subroutine expansion
          // group that refers to this group
          node === multiplex.origin
        ) {
          multiplexNodes.splice(i2, 1);
          break;
        }
      }
      multiplexCapturesToLeftByRef.get(node.number).push({ node, origin });
      if (node.name) {
        multiplexCapturesToLeftByRef.get(node.name).push({ node, origin });
      }
      if (node.name) {
        const groupsWithSameName = getOrInsert(groupsByName, node.name, /* @__PURE__ */ new Map());
        let hasDuplicateNameToRemove = false;
        if (origin) {
          hasDuplicateNameToRemove = true;
        } else {
          for (const groupInfo of groupsWithSameName.values()) {
            if (!groupInfo.hasDuplicateNameToRemove) {
              hasDuplicateNameToRemove = true;
              break;
            }
          }
        }
        groupsByName.get(node.name).set(node, { node, hasDuplicateNameToRemove });
      }
    },
    exit({ node }, { openRefs }) {
      if (openRefs.get(node.number) === node) {
        openRefs.delete(node.number);
      }
    }
  },
  Group: {
    enter({ node }, state) {
      state.prevFlags = state.currentFlags;
      if (node.flags) {
        state.currentFlags = getNewCurrentFlags(state.currentFlags, node.flags);
      }
    },
    exit(_3, state) {
      state.currentFlags = state.prevFlags;
    }
  },
  Subroutine({ node, parent, replaceWith }, state) {
    const { isRecursive, ref } = node;
    if (isRecursive) {
      let reffed = parent;
      while (reffed = reffed.parent) {
        if (reffed.type === "CapturingGroup" && (reffed.name === ref || reffed.number === ref)) {
          break;
        }
      }
      state.reffedNodesByReferencer.set(node, reffed);
      return;
    }
    const reffedGroupNode = state.subroutineRefMap.get(ref);
    const isGlobalRecursion = ref === 0;
    const expandedSubroutine = isGlobalRecursion ? createRecursion(0) : (
      // The reffed group might itself contain subroutines, which are expanded during sub-traversal
      cloneCapturingGroup(reffedGroupNode, state.groupOriginByCopy, null)
    );
    let replacement = expandedSubroutine;
    if (!isGlobalRecursion) {
      const reffedGroupFlagMods = getCombinedFlagModsFromFlagNodes(getAllParents(
        reffedGroupNode,
        (p2) => p2.type === "Group" && !!p2.flags
      ));
      const reffedGroupFlags = reffedGroupFlagMods ? getNewCurrentFlags(state.globalFlags, reffedGroupFlagMods) : state.globalFlags;
      if (!areFlagsEqual(reffedGroupFlags, state.currentFlags)) {
        replacement = A2({
          flags: getFlagModsFromFlags(reffedGroupFlags)
        });
        replacement.body[0].body.push(expandedSubroutine);
      }
    }
    replaceWith(setParentDeep(replacement, parent), { traverse: !isGlobalRecursion });
  }
};
var ThirdPassVisitor = {
  Backreference({ node, parent, replaceWith }, state) {
    if (node.orphan) {
      state.highestOrphanBackref = Math.max(state.highestOrphanBackref, node.ref);
      return;
    }
    const reffedNodes = state.reffedNodesByReferencer.get(node);
    const participants = reffedNodes.filter((reffed) => canParticipateWithNode(reffed, node));
    if (!participants.length) {
      replaceWith(setParentDeep(K2({ negate: true }), parent));
    } else if (participants.length > 1) {
      const group = A2({
        atomic: true,
        body: participants.reverse().map((reffed) => b2({
          body: [k2(reffed.number)]
        }))
      });
      replaceWith(setParentDeep(group, parent));
    } else {
      node.ref = participants[0].number;
    }
  },
  CapturingGroup({ node }, state) {
    node.number = ++state.numCapturesToLeft;
    if (node.name) {
      if (state.groupsByName.get(node.name).get(node).hasDuplicateNameToRemove) {
        delete node.name;
      }
    }
  },
  Regex: {
    exit({ node }, state) {
      const numCapsNeeded = Math.max(state.highestOrphanBackref - state.numCapturesToLeft, 0);
      for (let i2 = 0; i2 < numCapsNeeded; i2++) {
        const emptyCapture = P2();
        node.body.at(-1).body.push(emptyCapture);
      }
    }
  },
  Subroutine({ node }, state) {
    if (!node.isRecursive || node.ref === 0) {
      return;
    }
    node.ref = state.reffedNodesByReferencer.get(node).number;
  }
};
function addParentProperties(root2) {
  S(root2, {
    "*"({ node, parent }) {
      node.parent = parent;
    }
  });
}
function areFlagsEqual(a2, b3) {
  return a2.dotAll === b3.dotAll && a2.ignoreCase === b3.ignoreCase;
}
function canParticipateWithNode(capture, node) {
  let rightmostPoint = node;
  do {
    if (rightmostPoint.type === "Regex") {
      return false;
    }
    if (rightmostPoint.type === "Alternative") {
      continue;
    }
    if (rightmostPoint === capture) {
      return false;
    }
    const kidsOfParent = getKids(rightmostPoint.parent);
    for (const kid of kidsOfParent) {
      if (kid === rightmostPoint) {
        break;
      }
      if (kid === capture || isAncestorOf(kid, capture)) {
        return true;
      }
    }
  } while (rightmostPoint = rightmostPoint.parent);
  throw new Error("Unexpected path");
}
function cloneCapturingGroup(obj, originMap, up, up2) {
  const store = Array.isArray(obj) ? [] : {};
  for (const [key2, value] of Object.entries(obj)) {
    if (key2 === "parent") {
      store.parent = Array.isArray(up) ? up2 : up;
    } else if (value && typeof value === "object") {
      store[key2] = cloneCapturingGroup(value, originMap, store, up);
    } else {
      if (key2 === "type" && value === "CapturingGroup") {
        originMap.set(store, originMap.get(obj) ?? obj);
      }
      store[key2] = value;
    }
  }
  return store;
}
function createRecursion(ref) {
  const node = O2(ref);
  node.isRecursive = true;
  return node;
}
function getAllParents(node, filterFn) {
  const results = [];
  while (node = node.parent) {
    if (!filterFn || filterFn(node)) {
      results.push(node);
    }
  }
  return results;
}
function getAndStoreJsGroupName(name, map) {
  if (map.has(name)) {
    return map.get(name);
  }
  const jsName = `$${map.size}_${name.replace(/^[^$_\p{IDS}]|[^$\u200C\u200D\p{IDC}]/ug, "_")}`;
  map.set(name, jsName);
  return jsName;
}
function getCombinedFlagModsFromFlagNodes(flagNodes) {
  const flagProps = ["dotAll", "ignoreCase"];
  const combinedFlags = { enable: {}, disable: {} };
  flagNodes.forEach(({ flags }) => {
    flagProps.forEach((prop) => {
      if (flags.enable?.[prop]) {
        delete combinedFlags.disable[prop];
        combinedFlags.enable[prop] = true;
      }
      if (flags.disable?.[prop]) {
        combinedFlags.disable[prop] = true;
      }
    });
  });
  if (!Object.keys(combinedFlags.enable).length) {
    delete combinedFlags.enable;
  }
  if (!Object.keys(combinedFlags.disable).length) {
    delete combinedFlags.disable;
  }
  if (combinedFlags.enable || combinedFlags.disable) {
    return combinedFlags;
  }
  return null;
}
function getFlagModsFromFlags({ dotAll, ignoreCase }) {
  const mods = {};
  if (dotAll || ignoreCase) {
    mods.enable = {};
    dotAll && (mods.enable.dotAll = true);
    ignoreCase && (mods.enable.ignoreCase = true);
  }
  if (!dotAll || !ignoreCase) {
    mods.disable = {};
    !dotAll && (mods.disable.dotAll = true);
    !ignoreCase && (mods.disable.ignoreCase = true);
  }
  return mods;
}
function getKids(node) {
  if (!node) {
    throw new Error("Node expected");
  }
  const { body: body3 } = node;
  return Array.isArray(body3) ? body3 : body3 ? [body3] : null;
}
function getLeadingG(els) {
  const firstToConsider = els.find((el) => el.kind === "search_start" || isLoneGLookaround(el, { negate: false }) || !isAlwaysZeroLength(el));
  if (!firstToConsider) {
    return null;
  }
  if (firstToConsider.kind === "search_start") {
    return firstToConsider;
  }
  if (firstToConsider.type === "LookaroundAssertion") {
    return firstToConsider.body[0].body[0];
  }
  if (firstToConsider.type === "CapturingGroup" || firstToConsider.type === "Group") {
    const gNodesForGroup = [];
    for (const alt of firstToConsider.body) {
      const leadingG = getLeadingG(alt.body);
      if (!leadingG) {
        return null;
      }
      Array.isArray(leadingG) ? gNodesForGroup.push(...leadingG) : gNodesForGroup.push(leadingG);
    }
    return gNodesForGroup;
  }
  return null;
}
function isAncestorOf(node, descendant) {
  const kids = getKids(node) ?? [];
  for (const kid of kids) {
    if (kid === descendant || isAncestorOf(kid, descendant)) {
      return true;
    }
  }
  return false;
}
function isAlwaysZeroLength({ type }) {
  return type === "Assertion" || type === "Directive" || type === "LookaroundAssertion";
}
function isAlwaysNonZeroLength(node) {
  const types = [
    "Character",
    "CharacterClass",
    "CharacterSet"
  ];
  return types.includes(node.type) || node.type === "Quantifier" && node.min && types.includes(node.body.type);
}
function isLoneGLookaround(node, options) {
  const opts = {
    negate: null,
    ...options
  };
  return node.type === "LookaroundAssertion" && (opts.negate === null || node.negate === opts.negate) && node.body.length === 1 && o2(node.body[0], {
    type: "Assertion",
    kind: "search_start"
  });
}
function isValidJsGroupName(name) {
  return /^[$_\p{IDS}][$\u200C\u200D\p{IDC}]*$/u.test(name);
}
function parseFragment(pattern, options) {
  const ast = J2(pattern, {
    ...options,
    // Providing a custom set of Unicode property names avoids converting some JS Unicode
    // properties (ex: `\p{Alpha}`) to Onig POSIX classes
    unicodePropertyMap: JsUnicodePropertyMap
  });
  const alts = ast.body;
  if (alts.length > 1 || alts[0].body.length > 1) {
    return A2({ body: alts });
  }
  return alts[0].body[0];
}
function setNegate(node, negate) {
  node.negate = negate;
  return node;
}
function setParent(node, parent) {
  node.parent = parent;
  return node;
}
function setParentDeep(node, parent) {
  addParentProperties(node);
  node.parent = parent;
  return node;
}
function generate(ast, options) {
  const opts = getOptions(options);
  const minTargetEs2024 = isMinTarget(opts.target, "ES2024");
  const minTargetEs2025 = isMinTarget(opts.target, "ES2025");
  const recursionLimit = opts.rules.recursionLimit;
  if (!Number.isInteger(recursionLimit) || recursionLimit < 2 || recursionLimit > 20) {
    throw new Error("Invalid recursionLimit; use 2-20");
  }
  let hasCaseInsensitiveNode = null;
  let hasCaseSensitiveNode = null;
  if (!minTargetEs2025) {
    const iStack = [ast.flags.ignoreCase];
    S(ast, FlagModifierVisitor, {
      getCurrentModI: () => iStack.at(-1),
      popModI() {
        iStack.pop();
      },
      pushModI(isIOn) {
        iStack.push(isIOn);
      },
      setHasCasedChar() {
        if (iStack.at(-1)) {
          hasCaseInsensitiveNode = true;
        } else {
          hasCaseSensitiveNode = true;
        }
      }
    });
  }
  const appliedGlobalFlags = {
    dotAll: ast.flags.dotAll,
    // - Turn global flag i on if a case insensitive node was used and no case sensitive nodes were
    //   used (to avoid unnecessary node expansion).
    // - Turn global flag i off if a case sensitive node was used (since case sensitivity can't be
    //   forced without the use of ES2025 flag groups)
    ignoreCase: !!((ast.flags.ignoreCase || hasCaseInsensitiveNode) && !hasCaseSensitiveNode)
  };
  let lastNode = ast;
  const state = {
    accuracy: opts.accuracy,
    appliedGlobalFlags,
    captureMap: /* @__PURE__ */ new Map(),
    currentFlags: {
      dotAll: ast.flags.dotAll,
      ignoreCase: ast.flags.ignoreCase
    },
    inCharClass: false,
    lastNode,
    originMap: ast._originMap,
    recursionLimit,
    useAppliedIgnoreCase: !!(!minTargetEs2025 && hasCaseInsensitiveNode && hasCaseSensitiveNode),
    useFlagMods: minTargetEs2025,
    useFlagV: minTargetEs2024,
    verbose: opts.verbose
  };
  function gen(node) {
    state.lastNode = lastNode;
    lastNode = node;
    const fn = throwIfNullish(generator[node.type], `Unexpected node type "${node.type}"`);
    return fn(node, state, gen);
  }
  const result = {
    pattern: ast.body.map(gen).join("|"),
    // Could reset `lastNode` at this point via `lastNode = ast`, but it isn't needed by flags
    flags: gen(ast.flags),
    options: { ...ast.options }
  };
  if (!minTargetEs2024) {
    delete result.options.force.v;
    result.options.disable.v = true;
    result.options.unicodeSetsPlugin = null;
  }
  result._captureTransfers = /* @__PURE__ */ new Map();
  result._hiddenCaptures = [];
  state.captureMap.forEach((value, key2) => {
    if (value.hidden) {
      result._hiddenCaptures.push(key2);
    }
    if (value.transferTo) {
      getOrInsert(result._captureTransfers, value.transferTo, []).push(key2);
    }
  });
  return result;
}
var FlagModifierVisitor = {
  "*": {
    enter({ node }, state) {
      if (isAnyGroup(node)) {
        const currentModI = state.getCurrentModI();
        state.pushModI(
          node.flags ? getNewCurrentFlags({ ignoreCase: currentModI }, node.flags).ignoreCase : currentModI
        );
      }
    },
    exit({ node }, state) {
      if (isAnyGroup(node)) {
        state.popModI();
      }
    }
  },
  Backreference(_3, state) {
    state.setHasCasedChar();
  },
  Character({ node }, state) {
    if (charHasCase(cp(node.value))) {
      state.setHasCasedChar();
    }
  },
  CharacterClassRange({ node, skip }, state) {
    skip();
    if (getCasesOutsideCharClassRange(node, { firstOnly: true }).length) {
      state.setHasCasedChar();
    }
  },
  CharacterSet({ node }, state) {
    if (node.kind === "property" && UnicodePropertiesWithSpecificCase.has(node.value)) {
      state.setHasCasedChar();
    }
  }
};
var generator = {
  /**
  @param {AlternativeNode} node
  */
  Alternative({ body: body3 }, _3, gen) {
    return body3.map(gen).join("");
  },
  /**
  @param {AssertionNode} node
  */
  Assertion({ kind, negate }) {
    if (kind === "string_end") {
      return "$";
    }
    if (kind === "string_start") {
      return "^";
    }
    if (kind === "word_boundary") {
      return negate ? r3`\B` : r3`\b`;
    }
    throw new Error(`Unexpected assertion kind "${kind}"`);
  },
  /**
  @param {BackreferenceNode} node
  */
  Backreference({ ref }, state) {
    if (typeof ref !== "number") {
      throw new Error("Unexpected named backref in transformed AST");
    }
    if (!state.useFlagMods && state.accuracy === "strict" && state.currentFlags.ignoreCase && !state.captureMap.get(ref).ignoreCase) {
      throw new Error("Use of case-insensitive backref to case-sensitive group requires target ES2025 or non-strict accuracy");
    }
    return "\\" + ref;
  },
  /**
  @param {CapturingGroupNode} node
  */
  CapturingGroup(node, state, gen) {
    const { body: body3, name, number } = node;
    const data = { ignoreCase: state.currentFlags.ignoreCase };
    const origin = state.originMap.get(node);
    if (origin) {
      data.hidden = true;
      if (number > origin.number) {
        data.transferTo = origin.number;
      }
    }
    state.captureMap.set(number, data);
    return `(${name ? `?<${name}>` : ""}${body3.map(gen).join("|")})`;
  },
  /**
  @param {CharacterNode} node
  */
  Character({ value }, state) {
    const char = cp(value);
    const escaped = getCharEscape(value, {
      escDigit: state.lastNode.type === "Backreference",
      inCharClass: state.inCharClass,
      useFlagV: state.useFlagV
    });
    if (escaped !== char) {
      return escaped;
    }
    if (state.useAppliedIgnoreCase && state.currentFlags.ignoreCase && charHasCase(char)) {
      const cases = getIgnoreCaseMatchChars(char);
      return state.inCharClass ? cases.join("") : cases.length > 1 ? `[${cases.join("")}]` : cases[0];
    }
    return char;
  },
  /**
  @param {CharacterClassNode} node
  */
  CharacterClass(node, state, gen) {
    const { kind, negate, parent } = node;
    let { body: body3 } = node;
    if (kind === "intersection" && !state.useFlagV) {
      throw new Error("Use of character class intersection requires min target ES2024");
    }
    if (envFlags.bugFlagVLiteralHyphenIsRange && state.useFlagV && body3.some(isLiteralHyphen)) {
      body3 = [m2(45), ...body3.filter((kid) => !isLiteralHyphen(kid))];
    }
    const genClass = () => `[${negate ? "^" : ""}${body3.map(gen).join(kind === "intersection" ? "&&" : "")}]`;
    if (!state.inCharClass) {
      if (
        // Already established `kind !== 'intersection'` if `!state.useFlagV`; don't check again
        (!state.useFlagV || envFlags.bugNestedClassIgnoresNegation) && !negate
      ) {
        const negatedChildClasses = body3.filter(
          (kid) => kid.type === "CharacterClass" && kid.kind === "union" && kid.negate
        );
        if (negatedChildClasses.length) {
          const group = A2();
          const groupFirstAlt = group.body[0];
          group.parent = parent;
          groupFirstAlt.parent = group;
          body3 = body3.filter((kid) => !negatedChildClasses.includes(kid));
          node.body = body3;
          if (body3.length) {
            node.parent = groupFirstAlt;
            groupFirstAlt.body.push(node);
          } else {
            group.body.pop();
          }
          negatedChildClasses.forEach((cc) => {
            const newAlt = b2({ body: [cc] });
            cc.parent = newAlt;
            newAlt.parent = group;
            group.body.push(newAlt);
          });
          return gen(group);
        }
      }
      state.inCharClass = true;
      const result = genClass();
      state.inCharClass = false;
      return result;
    }
    const firstEl = body3[0];
    if (
      // Already established that the parent is a char class via `inCharClass`; don't check again
      kind === "union" && !negate && firstEl && // Allows many nested classes to work with `target` ES2018 which doesn't support nesting
      ((!state.useFlagV || !state.verbose) && parent.kind === "union" && !(envFlags.bugFlagVLiteralHyphenIsRange && state.useFlagV) || !state.verbose && parent.kind === "intersection" && // JS doesn't allow intersection with union or ranges
      body3.length === 1 && firstEl.type !== "CharacterClassRange")
    ) {
      return body3.map(gen).join("");
    }
    if (!state.useFlagV && parent.type === "CharacterClass") {
      throw new Error("Uses nested character class in a way that requires min target ES2024");
    }
    return genClass();
  },
  /**
  @param {CharacterClassRangeNode} node
  */
  CharacterClassRange(node, state) {
    const min = node.min.value;
    const max = node.max.value;
    const escOpts = {
      escDigit: false,
      inCharClass: true,
      useFlagV: state.useFlagV
    };
    const minStr = getCharEscape(min, escOpts);
    const maxStr = getCharEscape(max, escOpts);
    const extraChars = /* @__PURE__ */ new Set();
    if (state.useAppliedIgnoreCase && state.currentFlags.ignoreCase) {
      const charsOutsideRange = getCasesOutsideCharClassRange(node);
      const ranges = getCodePointRangesFromChars(charsOutsideRange);
      ranges.forEach((value) => {
        extraChars.add(
          Array.isArray(value) ? `${getCharEscape(value[0], escOpts)}-${getCharEscape(value[1], escOpts)}` : getCharEscape(value, escOpts)
        );
      });
    }
    return `${minStr}-${maxStr}${[...extraChars].join("")}`;
  },
  /**
  @param {CharacterSetNode} node
  */
  CharacterSet({ kind, negate, value, key: key2 }, state) {
    if (kind === "dot") {
      return state.currentFlags.dotAll ? state.appliedGlobalFlags.dotAll || state.useFlagMods ? "." : "[^]" : (
        // Onig's only line break char is line feed, unlike JS
        r3`[^\n]`
      );
    }
    if (kind === "digit") {
      return negate ? r3`\D` : r3`\d`;
    }
    if (kind === "property") {
      if (state.useAppliedIgnoreCase && state.currentFlags.ignoreCase && UnicodePropertiesWithSpecificCase.has(value)) {
        throw new Error(`Unicode property "${value}" can't be case-insensitive when other chars have specific case`);
      }
      return `${negate ? r3`\P` : r3`\p`}{${key2 ? `${key2}=` : ""}${value}}`;
    }
    if (kind === "word") {
      return negate ? r3`\W` : r3`\w`;
    }
    throw new Error(`Unexpected character set kind "${kind}"`);
  },
  /**
  @param {FlagsNode} node
  */
  Flags(node, state) {
    return (
      // The transformer should never turn on the properties for flags d, g, m since Onig doesn't
      // have equivs. Flag m is never used since Onig uses different line break chars than JS
      // (node.hasIndices ? 'd' : '') +
      // (node.global ? 'g' : '') +
      // (node.multiline ? 'm' : '') +
      (state.appliedGlobalFlags.ignoreCase ? "i" : "") + (node.dotAll ? "s" : "") + (node.sticky ? "y" : "")
    );
  },
  /**
  @param {GroupNode} node
  */
  Group({ atomic: atomic2, body: body3, flags, parent }, state, gen) {
    const currentFlags = state.currentFlags;
    if (flags) {
      state.currentFlags = getNewCurrentFlags(currentFlags, flags);
    }
    const contents = body3.map(gen).join("|");
    const result = !state.verbose && body3.length === 1 && // Single alt
    parent.type !== "Quantifier" && !atomic2 && (!state.useFlagMods || !flags) ? contents : `(?${getGroupPrefix(atomic2, flags, state.useFlagMods)}${contents})`;
    state.currentFlags = currentFlags;
    return result;
  },
  /**
  @param {LookaroundAssertionNode} node
  */
  LookaroundAssertion({ body: body3, kind, negate }, _3, gen) {
    const prefix = `${kind === "lookahead" ? "" : "<"}${negate ? "!" : "="}`;
    return `(?${prefix}${body3.map(gen).join("|")})`;
  },
  /**
  @param {QuantifierNode} node
  */
  Quantifier(node, _3, gen) {
    return gen(node.body) + getQuantifierStr(node);
  },
  /**
  @param {SubroutineNode & {isRecursive: true}} node
  */
  Subroutine({ isRecursive, ref }, state) {
    if (!isRecursive) {
      throw new Error("Unexpected non-recursive subroutine in transformed AST");
    }
    const limit = state.recursionLimit;
    return ref === 0 ? `(?R=${limit})` : r3`\g<${ref}&R=${limit}>`;
  }
};
var BaseEscapeChars = /* @__PURE__ */ new Set([
  "$",
  "(",
  ")",
  "*",
  "+",
  ".",
  "?",
  "[",
  "\\",
  "]",
  "^",
  "{",
  "|",
  "}"
]);
var CharClassEscapeChars = /* @__PURE__ */ new Set([
  "-",
  "\\",
  "]",
  "^",
  // Literal `[` doesn't require escaping with flag u, but this can help work around regex source
  // linters and regex syntax processors that expect unescaped `[` to create a nested class
  "["
]);
var CharClassEscapeCharsFlagV = /* @__PURE__ */ new Set([
  "(",
  ")",
  "-",
  "/",
  "[",
  "\\",
  "]",
  "^",
  "{",
  "|",
  "}",
  // Double punctuators; also includes already-listed `-` and `^`
  "!",
  "#",
  "$",
  "%",
  "&",
  "*",
  "+",
  ",",
  ".",
  ":",
  ";",
  "<",
  "=",
  ">",
  "?",
  "@",
  "`",
  "~"
]);
var CharCodeEscapeMap = /* @__PURE__ */ new Map([
  [9, r3`\t`],
  // horizontal tab
  [10, r3`\n`],
  // line feed
  [11, r3`\v`],
  // vertical tab
  [12, r3`\f`],
  // form feed
  [13, r3`\r`],
  // carriage return
  [8232, r3`\u2028`],
  // line separator
  [8233, r3`\u2029`],
  // paragraph separator
  [65279, r3`\uFEFF`]
  // ZWNBSP/BOM
]);
var casedRe = /^\p{Cased}$/u;
function charHasCase(char) {
  return casedRe.test(char);
}
function getCasesOutsideCharClassRange(node, options) {
  const firstOnly = !!options?.firstOnly;
  const min = node.min.value;
  const max = node.max.value;
  const found = [];
  if (min < 65 && (max === 65535 || max >= 131071) || min === 65536 && max >= 131071) {
    return found;
  }
  for (let i2 = min; i2 <= max; i2++) {
    const char = cp(i2);
    if (!charHasCase(char)) {
      continue;
    }
    const charsOutsideRange = getIgnoreCaseMatchChars(char).filter((caseOfChar) => {
      const num = caseOfChar.codePointAt(0);
      return num < min || num > max;
    });
    if (charsOutsideRange.length) {
      found.push(...charsOutsideRange);
      if (firstOnly) {
        break;
      }
    }
  }
  return found;
}
function getCharEscape(codePoint, { escDigit, inCharClass, useFlagV }) {
  if (CharCodeEscapeMap.has(codePoint)) {
    return CharCodeEscapeMap.get(codePoint);
  }
  if (
    // Control chars, etc.; condition modeled on the Chrome developer console's display for strings
    codePoint < 32 || codePoint > 126 && codePoint < 160 || // Unicode planes 4-16; unassigned, special purpose, and private use area
    codePoint > 262143 || // Avoid corrupting a preceding backref by immediately following it with a literal digit
    escDigit && isDigitCharCode(codePoint)
  ) {
    return codePoint > 255 ? `\\u{${codePoint.toString(16).toUpperCase()}}` : `\\x${codePoint.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  const escapeChars = inCharClass ? useFlagV ? CharClassEscapeCharsFlagV : CharClassEscapeChars : BaseEscapeChars;
  const char = cp(codePoint);
  return (escapeChars.has(char) ? "\\" : "") + char;
}
function getCodePointRangesFromChars(chars) {
  const codePoints = chars.map((char) => char.codePointAt(0)).sort((a2, b3) => a2 - b3);
  const values = [];
  let start = null;
  for (let i2 = 0; i2 < codePoints.length; i2++) {
    if (codePoints[i2 + 1] === codePoints[i2] + 1) {
      start ??= codePoints[i2];
    } else if (start === null) {
      values.push(codePoints[i2]);
    } else {
      values.push([start, codePoints[i2]]);
      start = null;
    }
  }
  return values;
}
function getGroupPrefix(atomic2, flagMods, useFlagMods) {
  if (atomic2) {
    return ">";
  }
  let mods = "";
  if (flagMods && useFlagMods) {
    const { enable, disable } = flagMods;
    mods = (enable?.ignoreCase ? "i" : "") + (enable?.dotAll ? "s" : "") + (disable ? "-" : "") + (disable?.ignoreCase ? "i" : "") + (disable?.dotAll ? "s" : "");
  }
  return `${mods}:`;
}
function getQuantifierStr({ kind, max, min }) {
  let base;
  if (!min && max === 1) {
    base = "?";
  } else if (!min && max === Infinity) {
    base = "*";
  } else if (min === 1 && max === Infinity) {
    base = "+";
  } else if (min === max) {
    base = `{${min}}`;
  } else {
    base = `{${min},${max === Infinity ? "" : max}}`;
  }
  return base + {
    greedy: "",
    lazy: "?",
    possessive: "+"
  }[kind];
}
function isAnyGroup({ type }) {
  return type === "CapturingGroup" || type === "Group" || type === "LookaroundAssertion";
}
function isDigitCharCode(value) {
  return value > 47 && value < 58;
}
function isLiteralHyphen({ type, value }) {
  return type === "Character" && value === 45;
}
var EmulatedRegExp = class _EmulatedRegExp extends RegExp {
  /**
  @type {Map<number, {
    hidden?: true;
    transferTo?: number;
  }>}
  */
  #captureMap = /* @__PURE__ */ new Map();
  /**
  @type {RegExp | EmulatedRegExp | null}
  */
  #compiled = null;
  /**
  @type {string}
  */
  #pattern;
  /**
  @type {Map<number, string>?}
  */
  #nameMap = null;
  /**
  @type {string?}
  */
  #strategy = null;
  /**
  Can be used to serialize the instance.
  @type {EmulatedRegExpOptions}
  */
  rawOptions = {};
  // Override the getter with one that works with lazy-compiled regexes
  get source() {
    return this.#pattern || "(?:)";
  }
  /**
  @overload
  @param {string} pattern
  @param {string} [flags]
  @param {EmulatedRegExpOptions} [options]
  */
  /**
  @overload
  @param {EmulatedRegExp} pattern
  @param {string} [flags]
  */
  constructor(pattern, flags, options) {
    const lazyCompile = !!options?.lazyCompile;
    if (pattern instanceof RegExp) {
      if (options) {
        throw new Error("Cannot provide options when copying a regexp");
      }
      const re2 = pattern;
      super(re2, flags);
      this.#pattern = re2.source;
      if (re2 instanceof _EmulatedRegExp) {
        this.#captureMap = re2.#captureMap;
        this.#nameMap = re2.#nameMap;
        this.#strategy = re2.#strategy;
        this.rawOptions = re2.rawOptions;
      }
    } else {
      const opts = {
        hiddenCaptures: [],
        strategy: null,
        transfers: [],
        ...options
      };
      super(lazyCompile ? "" : pattern, flags);
      this.#pattern = pattern;
      this.#captureMap = createCaptureMap(opts.hiddenCaptures, opts.transfers);
      this.#strategy = opts.strategy;
      this.rawOptions = options ?? {};
    }
    if (!lazyCompile) {
      this.#compiled = this;
    }
  }
  /**
  Called internally by all String/RegExp methods that use regexes.
  @override
  @param {string} str
  @returns {RegExpExecArray?}
  */
  exec(str) {
    if (!this.#compiled) {
      const { lazyCompile, ...rest } = this.rawOptions;
      this.#compiled = new _EmulatedRegExp(this.#pattern, this.flags, rest);
    }
    const useLastIndex = this.global || this.sticky;
    const pos = this.lastIndex;
    if (this.#strategy === "clip_search" && useLastIndex && pos) {
      this.lastIndex = 0;
      const match = this.#execCore(str.slice(pos));
      if (match) {
        adjustMatchDetailsForOffset(match, pos, str, this.hasIndices);
        this.lastIndex += pos;
      }
      return match;
    }
    return this.#execCore(str);
  }
  /**
  Adds support for hidden and transfer captures.
  @param {string} str
  @returns
  */
  #execCore(str) {
    this.#compiled.lastIndex = this.lastIndex;
    const match = super.exec.call(this.#compiled, str);
    this.lastIndex = this.#compiled.lastIndex;
    if (!match || !this.#captureMap.size) {
      return match;
    }
    const matchCopy = [...match];
    match.length = 1;
    let indicesCopy;
    if (this.hasIndices) {
      indicesCopy = [...match.indices];
      match.indices.length = 1;
    }
    const mappedNums = [0];
    for (let i2 = 1; i2 < matchCopy.length; i2++) {
      const { hidden, transferTo } = this.#captureMap.get(i2) ?? {};
      if (hidden) {
        mappedNums.push(null);
      } else {
        mappedNums.push(match.length);
        match.push(matchCopy[i2]);
        if (this.hasIndices) {
          match.indices.push(indicesCopy[i2]);
        }
      }
      if (transferTo && matchCopy[i2] !== void 0) {
        const to = mappedNums[transferTo];
        if (!to) {
          throw new Error(`Invalid capture transfer to "${to}"`);
        }
        match[to] = matchCopy[i2];
        if (this.hasIndices) {
          match.indices[to] = indicesCopy[i2];
        }
        if (match.groups) {
          if (!this.#nameMap) {
            this.#nameMap = createNameMap(this.source);
          }
          const name = this.#nameMap.get(transferTo);
          if (name) {
            match.groups[name] = matchCopy[i2];
            if (this.hasIndices) {
              match.indices.groups[name] = indicesCopy[i2];
            }
          }
        }
      }
    }
    return match;
  }
};
function adjustMatchDetailsForOffset(match, offset, input, hasIndices) {
  match.index += offset;
  match.input = input;
  if (hasIndices) {
    const indices = match.indices;
    for (let i2 = 0; i2 < indices.length; i2++) {
      const arr = indices[i2];
      if (arr) {
        indices[i2] = [arr[0] + offset, arr[1] + offset];
      }
    }
    const groupIndices = indices.groups;
    if (groupIndices) {
      Object.keys(groupIndices).forEach((key2) => {
        const arr = groupIndices[key2];
        if (arr) {
          groupIndices[key2] = [arr[0] + offset, arr[1] + offset];
        }
      });
    }
  }
}
function createCaptureMap(hiddenCaptures, transfers) {
  const captureMap = /* @__PURE__ */ new Map();
  for (const num of hiddenCaptures) {
    captureMap.set(num, {
      hidden: true
    });
  }
  for (const [to, from] of transfers) {
    for (const num of from) {
      getOrInsert(captureMap, num, {}).transferTo = to;
    }
  }
  return captureMap;
}
function createNameMap(pattern) {
  const re2 = /(?<capture>\((?:\?<(?![=!])(?<name>[^>]+)>|(?!\?)))|\\?./gsu;
  const map = /* @__PURE__ */ new Map();
  let numCharClassesOpen = 0;
  let numCaptures = 0;
  let match;
  while (match = re2.exec(pattern)) {
    const { 0: m3, groups: { capture, name } } = match;
    if (m3 === "[") {
      numCharClassesOpen++;
    } else if (!numCharClassesOpen) {
      if (capture) {
        numCaptures++;
        if (name) {
          map.set(numCaptures, name);
        }
      }
    } else if (m3 === "]") {
      numCharClassesOpen--;
    }
  }
  return map;
}
function toRegExp(pattern, options) {
  const d2 = toRegExpDetails(pattern, options);
  if (d2.options) {
    return new EmulatedRegExp(d2.pattern, d2.flags, d2.options);
  }
  return new RegExp(d2.pattern, d2.flags);
}
function toRegExpDetails(pattern, options) {
  const opts = getOptions(options);
  const onigurumaAst = J2(pattern, {
    flags: opts.flags,
    normalizeUnknownPropertyNames: true,
    rules: {
      captureGroup: opts.rules.captureGroup,
      singleline: opts.rules.singleline
    },
    skipBackrefValidation: opts.rules.allowOrphanBackrefs,
    unicodePropertyMap: JsUnicodePropertyMap
  });
  const regexPlusAst = transform(onigurumaAst, {
    accuracy: opts.accuracy,
    asciiWordBoundaries: opts.rules.asciiWordBoundaries,
    avoidSubclass: opts.avoidSubclass,
    bestEffortTarget: opts.target
  });
  const generated = generate(regexPlusAst, opts);
  const recursionResult = recursion(generated.pattern, {
    captureTransfers: generated._captureTransfers,
    hiddenCaptures: generated._hiddenCaptures,
    mode: "external"
  });
  const possessiveResult = possessive(recursionResult.pattern);
  const atomicResult = atomic(possessiveResult.pattern, {
    captureTransfers: recursionResult.captureTransfers,
    hiddenCaptures: recursionResult.hiddenCaptures
  });
  const details = {
    pattern: atomicResult.pattern,
    flags: `${opts.hasIndices ? "d" : ""}${opts.global ? "g" : ""}${generated.flags}${generated.options.disable.v ? "u" : "v"}`
  };
  if (opts.avoidSubclass) {
    if (opts.lazyCompileLength !== Infinity) {
      throw new Error("Lazy compilation requires subclass");
    }
  } else {
    const hiddenCaptures = atomicResult.hiddenCaptures.sort((a2, b3) => a2 - b3);
    const transfers = Array.from(atomicResult.captureTransfers);
    const strategy = regexPlusAst._strategy;
    const lazyCompile = details.pattern.length >= opts.lazyCompileLength;
    if (hiddenCaptures.length || transfers.length || strategy || lazyCompile) {
      details.options = {
        ...hiddenCaptures.length && { hiddenCaptures },
        ...transfers.length && { transfers },
        ...strategy && { strategy },
        ...lazyCompile && { lazyCompile }
      };
    }
  }
  return details;
}

// node_modules/.pnpm/@shikijs+engine-javascript@3.23.0/node_modules/@shikijs/engine-javascript/dist/shared/engine-javascript.hzpS1_41.mjs
var MAX = 4294967295;
var JavaScriptScanner = class {
  constructor(patterns, options = {}) {
    this.patterns = patterns;
    this.options = options;
    const {
      forgiving = false,
      cache,
      regexConstructor
    } = options;
    if (!regexConstructor) {
      throw new Error("Option `regexConstructor` is not provided");
    }
    this.regexps = patterns.map((p2) => {
      if (typeof p2 !== "string") {
        return p2;
      }
      const cached = cache?.get(p2);
      if (cached) {
        if (cached instanceof RegExp) {
          return cached;
        }
        if (forgiving)
          return null;
        throw cached;
      }
      try {
        const regex = regexConstructor(p2);
        cache?.set(p2, regex);
        return regex;
      } catch (e) {
        cache?.set(p2, e);
        if (forgiving)
          return null;
        throw e;
      }
    });
  }
  regexps;
  findNextMatchSync(string, startPosition, _options) {
    const str = typeof string === "string" ? string : string.content;
    const pending = [];
    function toResult(index, match, offset = 0) {
      return {
        index,
        captureIndices: match.indices.map((indice) => {
          if (indice == null) {
            return {
              start: MAX,
              end: MAX,
              length: 0
            };
          }
          return {
            start: indice[0] + offset,
            end: indice[1] + offset,
            length: indice[1] - indice[0]
          };
        })
      };
    }
    for (let i2 = 0; i2 < this.regexps.length; i2++) {
      const regexp = this.regexps[i2];
      if (!regexp)
        continue;
      try {
        regexp.lastIndex = startPosition;
        const match = regexp.exec(str);
        if (!match)
          continue;
        if (match.index === startPosition) {
          return toResult(i2, match, 0);
        }
        pending.push([i2, match, 0]);
      } catch (e) {
        if (this.options.forgiving)
          continue;
        throw e;
      }
    }
    if (pending.length) {
      const minIndex = Math.min(...pending.map((m3) => m3[1].index));
      for (const [i2, match, offset] of pending) {
        if (match.index === minIndex) {
          return toResult(i2, match, offset);
        }
      }
    }
    return null;
  }
};

// node_modules/.pnpm/@shikijs+engine-javascript@3.23.0/node_modules/@shikijs/engine-javascript/dist/engine-compile.mjs
function defaultJavaScriptRegexConstructor(pattern, options) {
  return toRegExp(
    pattern,
    {
      global: true,
      hasIndices: true,
      // This has no benefit for the standard JS engine, but it avoids a perf penalty for
      // precompiled grammars when constructing extremely long patterns that aren't always used
      lazyCompileLength: 3e3,
      rules: {
        // Needed since TextMate grammars merge backrefs across patterns
        allowOrphanBackrefs: true,
        // Improves search performance for generated regexes
        asciiWordBoundaries: true,
        // Follow `vscode-oniguruma` which enables this Oniguruma option by default
        captureGroup: true,
        // Oniguruma uses depth limit `20`; lowered here to keep regexes shorter and maybe
        // sometimes faster, but can be increased if issues reported due to low limit
        recursionLimit: 5,
        // Oniguruma option for `^`->`\A`, `$`->`\Z`; improves search performance without any
        // change in meaning since TM grammars search line by line
        singleline: true
      },
      ...options
    }
  );
}
function createJavaScriptRegexEngine(options = {}) {
  const _options = Object.assign(
    {
      target: "auto",
      cache: /* @__PURE__ */ new Map()
    },
    options
  );
  _options.regexConstructor ||= (pattern) => defaultJavaScriptRegexConstructor(pattern, { target: _options.target });
  return {
    createScanner(patterns) {
      return new JavaScriptScanner(patterns, _options);
    },
    createString(s2) {
      return {
        content: s2
      };
    }
  };
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/highlighter/languages/resolveLanguage.js
async function resolveLanguage(lang) {
  if (isWorkerContext()) throw new Error(`resolveLanguage("${lang}") cannot be called from a worker context. Languages must be pre-resolved on the main thread and passed to the worker via the resolvedLanguages parameter.`);
  const resolver = ResolvingLanguages.get(lang);
  if (resolver != null) return resolver;
  try {
    let loader = RegisteredCustomLanguages.get(lang);
    if (loader == null && Object.prototype.hasOwnProperty.call(bundledLanguages, lang)) loader = bundledLanguages[lang];
    if (loader == null) throw new Error(`resolveLanguage: "${lang}" not found in bundled or custom languages`);
    const resolver$1 = loader().then(({ default: data }) => {
      const resolvedLang = {
        name: lang,
        data
      };
      if (!ResolvedLanguages.has(lang)) ResolvedLanguages.set(lang, resolvedLang);
      return resolvedLang;
    });
    ResolvingLanguages.set(lang, resolver$1);
    return await resolver$1;
  } finally {
    ResolvingLanguages.delete(lang);
  }
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/highlighter/languages/getResolvedOrResolveLanguage.js
function getResolvedOrResolveLanguage(language) {
  return ResolvedLanguages.get(language) ?? resolveLanguage(language);
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/highlighter/themes/resolveTheme.js
async function resolveTheme(themeName) {
  if (isWorkerContext()) throw new Error(`resolveTheme("${themeName}") cannot be called from a worker context. Themes must be pre-resolved on the main thread and passed to the worker via the resolvedLanguages parameter.`);
  const resolver = ResolvingThemes.get(themeName);
  if (resolver != null) return resolver;
  try {
    const loader = RegisteredCustomThemes.get(themeName) ?? bundledThemes[themeName];
    if (loader == null) throw new Error(`resolveTheme: No valid loader for ${themeName}`);
    const resolver$1 = loader().then((result) => {
      return normalizeAndCacheResolvedTheme(themeName, "default" in result ? result.default : result);
    });
    ResolvingThemes.set(themeName, resolver$1);
    const theme = await resolver$1;
    if (theme.name !== themeName) throw new Error(`resolvedTheme: themeName: ${themeName} does not match theme.name: ${theme.name}`);
    ResolvedThemes.set(theme.name, theme);
    return theme;
  } finally {
    ResolvingThemes.delete(themeName);
  }
}
function normalizeAndCacheResolvedTheme(themeName, themeData) {
  const resolvedTheme = ResolvedThemes.get(themeName);
  if (resolvedTheme != null) return resolvedTheme;
  themeData = normalizeTheme(themeData);
  ResolvedThemes.set(themeName, themeData);
  return themeData;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/highlighter/themes/getResolvedOrResolveTheme.js
function getResolvedOrResolveTheme(themeName) {
  return ResolvedThemes.get(themeName) ?? resolveTheme(themeName);
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/highlighter/themes/registerCustomTheme.js
function registerCustomTheme(themeName, loader) {
  if (RegisteredCustomThemes.has(themeName)) {
    console.error("SharedHighlight.registerCustomTheme: theme name already registered", themeName);
    return;
  }
  RegisteredCustomThemes.set(themeName, loader);
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/highlighter/shared_highlighter.js
var highlighter;
async function getSharedHighlighter({ themes, langs, preferredHighlighter = "shiki-js" }) {
  highlighter ??= createHighlighter({
    themes: [],
    langs: ["text"],
    engine: preferredHighlighter === "shiki-wasm" ? createOnigurumaEngine(import("./wasm-ZHXCPA6J.js")) : createJavaScriptRegexEngine()
  });
  const instance2 = isHighlighterLoading(highlighter) ? await highlighter : highlighter;
  highlighter = instance2;
  const languageLoaders = [];
  for (const language of langs) {
    if (language === "text" || language === "ansi") continue;
    const maybeResolvedLanguage = getResolvedOrResolveLanguage(language);
    if ("then" in maybeResolvedLanguage) languageLoaders.push(maybeResolvedLanguage);
    else attachResolvedLanguages(maybeResolvedLanguage, instance2);
  }
  const themeLoaders = [];
  for (const themeName of themes) {
    const maybeResolvedTheme = getResolvedOrResolveTheme(themeName);
    if ("then" in maybeResolvedTheme) themeLoaders.push(maybeResolvedTheme);
    else attachResolvedThemes(maybeResolvedTheme, highlighter);
  }
  if (languageLoaders.length > 0 || themeLoaders.length > 0) await Promise.all([Promise.all(languageLoaders).then((languages) => {
    attachResolvedLanguages(languages, instance2);
  }), Promise.all(themeLoaders).then((themes$1) => {
    attachResolvedThemes(themes$1, instance2);
  })]);
  return instance2;
}
function getHighlighterIfLoaded() {
  if (highlighter != null && !("then" in highlighter)) return highlighter;
}
function isHighlighterLoading(h2 = highlighter) {
  return h2 != null && "then" in h2;
}
registerCustomTheme("pierre-dark", async () => {
  const { default: theme } = await import("./pierre-dark-YUMA6KAZ.js");
  return {
    ...theme,
    name: "pierre-dark"
  };
});
registerCustomTheme("pierre-light", async () => {
  const { default: theme } = await import("./pierre-light-PJFS4NSO.js");
  return {
    ...theme,
    name: "pierre-light"
  };
});

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/getThemes.js
function getThemes(theme = DEFAULT_THEMES) {
  const themesArr = [];
  if (typeof theme === "string") themesArr.push(theme);
  else {
    themesArr.push(theme.dark);
    themesArr.push(theme.light);
  }
  return themesArr;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/highlighter/themes/hasResolvedThemes.js
function hasResolvedThemes(themeNames) {
  for (const themeName of themeNames) if (!ResolvedThemes.has(themeName)) return false;
  return true;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/areThemesEqual.js
function areThemesEqual(themeA, themeB) {
  if (themeA == null || themeB == null || typeof themeA === "string" || typeof themeB === "string") return themeA === themeB;
  return themeA.dark === themeB.dark && themeA.light === themeB.light;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/getFiletypeFromFileName.js
var CUSTOM_EXTENSION_TO_FILE_FORMAT = /* @__PURE__ */ new Map();
var customExtensionsVersion = 0;
var EXTENSION_TO_FILE_FORMAT = {
  "1c": "1c",
  abap: "abap",
  as: "actionscript-3",
  ada: "ada",
  adb: "ada",
  ads: "ada",
  adoc: "asciidoc",
  asciidoc: "asciidoc",
  "component.html": "angular-html",
  "component.ts": "angular-ts",
  conf: "nginx",
  htaccess: "apache",
  cls: "tex",
  trigger: "apex",
  apl: "apl",
  applescript: "applescript",
  scpt: "applescript",
  ara: "ara",
  asm: "asm",
  s: "riscv",
  astro: "astro",
  awk: "awk",
  bal: "ballerina",
  sh: "zsh",
  bash: "zsh",
  bat: "cmd",
  cmd: "cmd",
  be: "berry",
  beancount: "beancount",
  bib: "bibtex",
  bicep: "bicep",
  "blade.php": "blade",
  bsl: "bsl",
  c: "c",
  h: "objective-cpp",
  cs: "csharp",
  cpp: "cpp",
  hpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hh: "cpp",
  cdc: "cdc",
  cairo: "cairo",
  clar: "clarity",
  clj: "clojure",
  cljs: "clojure",
  cljc: "clojure",
  soy: "soy",
  cmake: "cmake",
  "CMakeLists.txt": "cmake",
  cob: "cobol",
  cbl: "cobol",
  cobol: "cobol",
  CODEOWNERS: "codeowners",
  ql: "ql",
  coffee: "coffeescript",
  lisp: "lisp",
  cl: "lisp",
  lsp: "lisp",
  log: "log",
  v: "verilog",
  cql: "cql",
  cr: "crystal",
  css: "css",
  csv: "csv",
  cue: "cue",
  cypher: "cypher",
  cyp: "cypher",
  d: "d",
  dart: "dart",
  dax: "dax",
  desktop: "desktop",
  diff: "diff",
  patch: "diff",
  Dockerfile: "dockerfile",
  dockerfile: "dockerfile",
  env: "dotenv",
  dm: "dream-maker",
  edge: "edge",
  el: "emacs-lisp",
  ex: "elixir",
  exs: "elixir",
  elm: "elm",
  erb: "erb",
  erl: "erlang",
  hrl: "erlang",
  f: "fortran-fixed-form",
  for: "fortran-fixed-form",
  fs: "fsharp",
  fsi: "fsharp",
  fsx: "fsharp",
  f03: "f03",
  f08: "f08",
  f18: "f18",
  f77: "f77",
  f90: "fortran-free-form",
  f95: "fortran-free-form",
  fnl: "fennel",
  fish: "fish",
  ftl: "ftl",
  tres: "gdresource",
  res: "gdresource",
  gd: "gdscript",
  gdshader: "gdshader",
  gs: "genie",
  feature: "gherkin",
  COMMIT_EDITMSG: "git-commit",
  "git-rebase-todo": "git-rebase",
  gjs: "glimmer-js",
  gleam: "gleam",
  gts: "glimmer-ts",
  glsl: "glsl",
  vert: "glsl",
  frag: "glsl",
  shader: "shaderlab",
  gp: "gnuplot",
  plt: "gnuplot",
  gnuplot: "gnuplot",
  go: "go",
  graphql: "graphql",
  gql: "graphql",
  groovy: "groovy",
  gvy: "groovy",
  hack: "hack",
  haml: "haml",
  hbs: "handlebars",
  handlebars: "handlebars",
  hs: "haskell",
  lhs: "haskell",
  hx: "haxe",
  hcl: "hcl",
  hjson: "hjson",
  hlsl: "hlsl",
  fx: "hlsl",
  html: "html",
  htm: "html",
  http: "http",
  rest: "http",
  hxml: "hxml",
  hy: "hy",
  imba: "imba",
  ini: "ini",
  cfg: "ini",
  jade: "pug",
  pug: "pug",
  java: "java",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jinja: "jinja",
  jinja2: "jinja",
  j2: "jinja",
  jison: "jison",
  jl: "julia",
  json: "json",
  json5: "json5",
  jsonc: "jsonc",
  jsonl: "jsonl",
  jsonnet: "jsonnet",
  libsonnet: "jsonnet",
  jssm: "jssm",
  jsx: "jsx",
  kt: "kotlin",
  kts: "kts",
  kql: "kusto",
  tex: "tex",
  ltx: "tex",
  lean: "lean4",
  less: "less",
  liquid: "liquid",
  lit: "lit",
  ll: "llvm",
  logo: "logo",
  lua: "lua",
  luau: "luau",
  Makefile: "makefile",
  mk: "makefile",
  makefile: "makefile",
  md: "markdown",
  markdown: "markdown",
  marko: "marko",
  m: "wolfram",
  mat: "matlab",
  mdc: "mdc",
  mdx: "mdx",
  wiki: "wikitext",
  mediawiki: "wikitext",
  mmd: "mermaid",
  mermaid: "mermaid",
  mips: "mipsasm",
  mojo: "mojo",
  "\u{1F525}": "mojo",
  move: "move",
  nar: "narrat",
  nf: "nextflow",
  nim: "nim",
  nims: "nim",
  nimble: "nim",
  nix: "nix",
  nu: "nushell",
  mm: "objective-cpp",
  ml: "ocaml",
  mli: "ocaml",
  mll: "ocaml",
  mly: "ocaml",
  pas: "pascal",
  p: "pascal",
  pl: "prolog",
  pm: "perl",
  t: "perl",
  raku: "raku",
  p6: "raku",
  pl6: "raku",
  php: "php",
  phtml: "php",
  pls: "plsql",
  sql: "sql",
  po: "po",
  polar: "polar",
  pcss: "postcss",
  pot: "pot",
  potx: "potx",
  pq: "powerquery",
  pqm: "powerquery",
  ps1: "powershell",
  psm1: "powershell",
  psd1: "powershell",
  prisma: "prisma",
  pro: "prolog",
  P: "prolog",
  properties: "properties",
  proto: "protobuf",
  pp: "puppet",
  purs: "purescript",
  py: "python",
  pyw: "python",
  pyi: "python",
  qml: "qml",
  qmldir: "qmldir",
  qss: "qss",
  r: "r",
  R: "r",
  rkt: "racket",
  rktl: "racket",
  razor: "razor",
  cshtml: "razor",
  rb: "ruby",
  rbw: "ruby",
  reg: "reg",
  regex: "regexp",
  rel: "rel",
  rs: "rust",
  rst: "rst",
  rake: "ruby",
  gemspec: "ruby",
  sas: "sas",
  sass: "sass",
  scala: "scala",
  sc: "scala",
  scm: "scheme",
  ss: "scheme",
  sld: "scheme",
  scss: "scss",
  sdbl: "sdbl",
  shadergraph: "shader",
  st: "smalltalk",
  sol: "solidity",
  sparql: "sparql",
  rq: "sparql",
  spl: "splunk",
  config: "ssh-config",
  do: "stata",
  ado: "stata",
  dta: "stata",
  styl: "stylus",
  stylus: "stylus",
  svelte: "svelte",
  swift: "swift",
  sv: "system-verilog",
  svh: "system-verilog",
  service: "systemd",
  socket: "systemd",
  device: "systemd",
  timer: "systemd",
  talon: "talonscript",
  tasl: "tasl",
  tcl: "tcl",
  templ: "templ",
  tf: "tf",
  tfvars: "tfvars",
  toml: "toml",
  ts: "typescript",
  tsp: "typespec",
  tsv: "tsv",
  tsx: "tsx",
  ttl: "turtle",
  twig: "twig",
  typ: "typst",
  vv: "v",
  vala: "vala",
  vapi: "vala",
  vb: "vb",
  vbs: "vb",
  bas: "vb",
  vh: "verilog",
  vhd: "vhdl",
  vhdl: "vhdl",
  vim: "vimscript",
  vue: "vue",
  "vine.ts": "vue-vine",
  vy: "vyper",
  wasm: "wasm",
  wat: "wasm",
  wy: "\u6587\u8A00",
  wgsl: "wgsl",
  wit: "wit",
  wl: "wolfram",
  nb: "wolfram",
  xml: "xml",
  xsl: "xsl",
  xslt: "xsl",
  yaml: "yaml",
  yml: "yml",
  zs: "zenscript",
  zig: "zig",
  zsh: "zsh",
  sty: "tex"
};
function getFiletypeFromFileName(fileName) {
  if (CUSTOM_EXTENSION_TO_FILE_FORMAT.has(fileName)) return CUSTOM_EXTENSION_TO_FILE_FORMAT.get(fileName) ?? "text";
  if (EXTENSION_TO_FILE_FORMAT[fileName] != null) return EXTENSION_TO_FILE_FORMAT[fileName];
  const compoundMatch = fileName.match(/\.([^/\\]+\.[^/\\]+)$/);
  if (compoundMatch != null) {
    if (CUSTOM_EXTENSION_TO_FILE_FORMAT.has(compoundMatch[1])) return CUSTOM_EXTENSION_TO_FILE_FORMAT.get(compoundMatch[1]) ?? "text";
    if (EXTENSION_TO_FILE_FORMAT[compoundMatch[1]] != null) return EXTENSION_TO_FILE_FORMAT[compoundMatch[1]] ?? "text";
  }
  const simpleMatch = fileName.match(/\.([^.]+)$/)?.[1] ?? "";
  if (CUSTOM_EXTENSION_TO_FILE_FORMAT.has(simpleMatch)) return CUSTOM_EXTENSION_TO_FILE_FORMAT.get(simpleMatch) ?? "text";
  return EXTENSION_TO_FILE_FORMAT[simpleMatch] ?? "text";
}
function getCustomExtensionsVersion() {
  return customExtensionsVersion;
}
function getCustomExtensionsMap() {
  return Object.fromEntries(CUSTOM_EXTENSION_TO_FILE_FORMAT);
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/isFilePlainText.js
function isFilePlainText(file) {
  return (file.lang ?? getFiletypeFromFileName(file.name)) === "text";
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/iterateOverFile.js
function iterateOverFile({ lines, startingLine = 0, totalLines = Infinity, callback }) {
  const len = Math.min(startingLine + totalLines, lines.length);
  const lastLineIndex = (() => {
    const lastLine = lines.at(-1);
    if (lastLine === "" || lastLine === "\n" || lastLine === "\r\n" || lastLine === "\r") return Math.max(0, lines.length - 2);
    return lines.length - 1;
  })();
  for (let lineIndex = startingLine; lineIndex < len; lineIndex++) {
    const isLastLine = lineIndex === lastLineIndex;
    if (callback({
      lineIndex,
      lineNumber: lineIndex + 1,
      content: lines[lineIndex],
      isLastLine
    }) === true || isLastLine) break;
  }
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/cleanLastNewline.js
function cleanLastNewline(contents) {
  return contents.replace(/\n$|\r\n$/, "");
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/hast_utils.js
function createTextNodeElement(value) {
  return {
    type: "text",
    value
  };
}
function createHastElement({ tagName, children = [], properties = {} }) {
  return {
    type: "element",
    tagName,
    properties,
    children
  };
}
function createIconElement({ name, width = 16, height = 16, properties }) {
  return createHastElement({
    tagName: "svg",
    properties: {
      width,
      height,
      viewBox: "0 0 16 16",
      ...properties
    },
    children: [createHastElement({
      tagName: "use",
      properties: { href: `#${name.replace(/^#/, "")}` }
    })]
  });
}
function findCodeElement(nodes) {
  let firstChild = nodes.children[0];
  while (firstChild != null) {
    if (firstChild.type === "element" && firstChild.tagName === "code") return firstChild;
    if ("children" in firstChild) firstChild = firstChild.children[0];
    else firstChild = null;
  }
}
function createGutterWrapper(children) {
  return createHastElement({
    tagName: "div",
    properties: { "data-gutter": "" },
    children
  });
}
function createGutterItem(lineType, lineNumber, lineIndex, properties = {}) {
  return createHastElement({
    tagName: "div",
    properties: {
      "data-line-type": lineType,
      "data-column-number": lineNumber,
      "data-line-index": lineIndex,
      ...properties
    },
    children: lineNumber != null ? [createHastElement({
      tagName: "span",
      properties: { "data-line-number-content": "" },
      children: [createTextNodeElement(`${lineNumber}`)]
    })] : void 0
  });
}
function createGutterGap(type, bufferType, size) {
  return createHastElement({
    tagName: "div",
    properties: {
      "data-gutter-buffer": bufferType,
      "data-buffer-size": size,
      "data-line-type": bufferType === "annotation" ? void 0 : type,
      style: bufferType === "annotation" ? `grid-row: span ${size};` : `grid-row: span ${size};min-height:calc(${size} * 1lh);`
    }
  });
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/processLine.js
function processLine(node, line, state) {
  const lineInfo = typeof state.lineInfo === "function" ? state.lineInfo(line) : state.lineInfo[line - 1];
  if (lineInfo == null) {
    const errorMessage = `processLine: line ${line}, contains no state.lineInfo`;
    console.error(errorMessage, {
      node,
      line,
      state
    });
    throw new Error(errorMessage);
  }
  node.tagName = "div";
  node.properties["data-line"] = lineInfo.lineNumber;
  node.properties["data-alt-line"] = lineInfo.altLineNumber;
  node.properties["data-line-type"] = lineInfo.type;
  node.properties["data-line-index"] = lineInfo.lineIndex;
  if (node.children.length === 0) node.children.push(createTextNodeElement("\n"));
  return node;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/wrapTokenFragments.js
var NO_TOKEN = Symbol("no-token");
var MULTIPLE_TOKENS = Symbol("multiple-tokens");
function wrapTokenFragments(container) {
  const ownTokenChar = getTokenChar(container);
  if (ownTokenChar != null) return ownTokenChar;
  let containerTokenState = NO_TOKEN;
  const wrappedChildren = [];
  let currentTokenChildren = [];
  let currentTokenChar;
  const flushTokenChildren = () => {
    if (currentTokenChildren.length === 0 || currentTokenChar == null) {
      currentTokenChildren = [];
      currentTokenChar = void 0;
      return;
    }
    if (currentTokenChildren.length === 1) {
      const child = currentTokenChildren[0];
      if (child?.type === "element") {
        setTokenChar(child, currentTokenChar);
        for (const grandChild of child.children) stripTokenChar(grandChild);
      } else stripTokenChar(child);
      wrappedChildren.push(child);
      currentTokenChildren = [];
      currentTokenChar = void 0;
      return;
    }
    for (const child of currentTokenChildren) stripTokenChar(child);
    wrappedChildren.push(createHastElement({
      tagName: "span",
      properties: { "data-char": currentTokenChar },
      children: currentTokenChildren
    }));
    currentTokenChildren = [];
    currentTokenChar = void 0;
  };
  const mergeContainerTokenState = (childTokenState) => {
    if (childTokenState === NO_TOKEN) return;
    if (childTokenState === MULTIPLE_TOKENS) {
      containerTokenState = MULTIPLE_TOKENS;
      return;
    }
    if (containerTokenState === NO_TOKEN) {
      containerTokenState = childTokenState;
      return;
    }
    if (containerTokenState !== childTokenState) containerTokenState = MULTIPLE_TOKENS;
  };
  for (const child of container.children) {
    const childTokenState = child.type === "element" ? wrapTokenFragments(child) : NO_TOKEN;
    mergeContainerTokenState(childTokenState);
    if (typeof childTokenState !== "number") {
      flushTokenChildren();
      wrappedChildren.push(child);
      continue;
    }
    if (currentTokenChar != null && currentTokenChar !== childTokenState) flushTokenChildren();
    currentTokenChar ??= childTokenState;
    currentTokenChildren.push(child);
  }
  flushTokenChildren();
  container.children = wrappedChildren;
  return containerTokenState;
}
function getTokenChar(node) {
  const value = node.properties["data-char"];
  if (typeof value === "number") return value;
}
function stripTokenChar(node) {
  if (node.type !== "element") return;
  node.properties["data-char"] = void 0;
  for (const child of node.children) stripTokenChar(child);
}
function setTokenChar(node, char) {
  node.properties["data-char"] = char;
}

// node_modules/.pnpm/@shikijs+transformers@3.23.0/node_modules/@shikijs/transformers/dist/index.mjs
function transformerStyleToClass(options = {}) {
  const {
    classPrefix = "__shiki_",
    classSuffix = "",
    classReplacer = (className) => className
  } = options;
  const classToStyle = /* @__PURE__ */ new Map();
  function stringifyStyle(style) {
    return Object.entries(style).map(([key2, value]) => `${key2}:${value}`).join(";");
  }
  function registerStyle(style) {
    const str = typeof style === "string" ? style : stringifyStyle(style);
    let className = classPrefix + cyrb53(str) + classSuffix;
    className = classReplacer(className);
    if (!classToStyle.has(className)) {
      classToStyle.set(
        className,
        typeof style === "string" ? style : { ...style }
      );
    }
    return className;
  }
  return {
    name: "@shikijs/transformers:style-to-class",
    pre(t) {
      if (!t.properties.style)
        return;
      const className = registerStyle(t.properties.style);
      delete t.properties.style;
      this.addClassToHast(t, className);
    },
    tokens(lines) {
      for (const line of lines) {
        for (const token2 of line) {
          if (!token2.htmlStyle)
            continue;
          const className = registerStyle(token2.htmlStyle);
          token2.htmlStyle = {};
          token2.htmlAttrs ||= {};
          if (!token2.htmlAttrs.class)
            token2.htmlAttrs.class = className;
          else
            token2.htmlAttrs.class += ` ${className}`;
        }
      }
    },
    getClassRegistry() {
      return classToStyle;
    },
    getCSS() {
      let css = "";
      for (const [className, style] of classToStyle.entries()) {
        css += `.${className}{${typeof style === "string" ? style : stringifyStyle(style)}}`;
      }
      return css;
    },
    clearRegistry() {
      classToStyle.clear();
    }
  };
}
function cyrb53(str, seed = 0) {
  let h1 = 3735928559 ^ seed;
  let h2 = 1103547991 ^ seed;
  for (let i2 = 0, ch; i2 < str.length; i2++) {
    ch = str.charCodeAt(i2);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507);
  h1 ^= Math.imul(h2 ^ h2 >>> 13, 3266489909);
  h2 = Math.imul(h2 ^ h2 >>> 16, 2246822507);
  h2 ^= Math.imul(h1 ^ h1 >>> 13, 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36).slice(0, 6);
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/createTransformerWithState.js
function createTransformerWithState(useTokenTransformer = false, useCSSClasses = false) {
  const state = { lineInfo: [] };
  const transformers = [{
    line(node) {
      delete node.properties.class;
      return node;
    },
    pre(pre) {
      const code = findCodeElement(pre);
      const children = [];
      if (code != null) {
        let index = 1;
        for (const node of code.children) {
          if (node.type !== "element") continue;
          if (useTokenTransformer) wrapTokenFragments(node);
          children.push(processLine(node, index, state));
          index++;
        }
        code.children = children;
      }
      return pre;
    },
    ...useTokenTransformer ? {
      tokens(lines) {
        for (const line of lines) {
          let col = 0;
          for (const token2 of line) {
            const tokenWithOriginalRange = token2;
            tokenWithOriginalRange.__lineChar ??= col;
            col += token2.content.length;
          }
        }
      },
      preprocess(_code, options) {
        options.mergeWhitespaces = "never";
      },
      span(hast, _line, _char, _lineElement, token2) {
        if (token2?.offset != null && token2.content != null) {
          const tokenChar = token2.__lineChar;
          if (tokenChar != null) hast.properties["data-char"] = tokenChar;
          return hast;
        }
        return hast;
      }
    } : null
  }];
  if (useCSSClasses) transformers.push(tokenStyleNormalizer, toClass);
  return {
    state,
    transformers,
    toClass
  };
}
var toClass = transformerStyleToClass({ classPrefix: "hl-" });
var tokenStyleNormalizer = {
  name: "token-style-normalizer",
  tokens(lines) {
    for (const line of lines) for (const token2 of line) {
      if (token2.htmlStyle != null) continue;
      const style = {};
      if (token2.color != null) style.color = token2.color;
      if (token2.bgColor != null) style["background-color"] = token2.bgColor;
      if (token2.fontStyle != null && token2.fontStyle !== 0) {
        if ((token2.fontStyle & 1) !== 0) style["font-style"] = "italic";
        if ((token2.fontStyle & 2) !== 0) style["font-weight"] = "bold";
        if ((token2.fontStyle & 4) !== 0) style["text-decoration"] = "underline";
      }
      if (Object.keys(style).length > 0) token2.htmlStyle = style;
    }
  }
};

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/formatCSSVariablePrefix.js
function formatCSSVariablePrefix(type) {
  return `--${type === "token" ? "diffs-token" : "diffs"}-`;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/getHighlighterThemeStyles.js
function getHighlighterThemeStyles({ theme = DEFAULT_THEMES, highlighter: highlighter2, prefix }) {
  let styles = "";
  if (typeof theme === "string") {
    const themeData = highlighter2.getTheme(theme);
    styles += `color:${themeData.fg};`;
    styles += `background-color:${themeData.bg};`;
    styles += `${formatCSSVariablePrefix("global")}fg:${themeData.fg};`;
    styles += `${formatCSSVariablePrefix("global")}bg:${themeData.bg};`;
    styles += getThemeVariables(themeData, prefix);
  } else {
    let themeData = highlighter2.getTheme(theme.dark);
    styles += `${formatCSSVariablePrefix("global")}dark:${themeData.fg};`;
    styles += `${formatCSSVariablePrefix("global")}dark-bg:${themeData.bg};`;
    styles += getThemeVariables(themeData, "dark");
    themeData = highlighter2.getTheme(theme.light);
    styles += `${formatCSSVariablePrefix("global")}light:${themeData.fg};`;
    styles += `${formatCSSVariablePrefix("global")}light-bg:${themeData.bg};`;
    styles += getThemeVariables(themeData, "light");
  }
  return styles;
}
function getThemeVariables(themeData, modePrefix) {
  modePrefix = modePrefix != null ? `${modePrefix}-` : "";
  let styles = "";
  const additionGreen = themeData.colors?.["gitDecoration.addedResourceForeground"] ?? themeData.colors?.["terminal.ansiGreen"];
  if (additionGreen != null) styles += `${formatCSSVariablePrefix("global")}${modePrefix}addition-color:${additionGreen};`;
  const deletionRed = themeData.colors?.["gitDecoration.deletedResourceForeground"] ?? themeData.colors?.["terminal.ansiRed"];
  if (deletionRed != null) styles += `${formatCSSVariablePrefix("global")}${modePrefix}deletion-color:${deletionRed};`;
  const modifiedBlue = themeData.colors?.["gitDecoration.modifiedResourceForeground"] ?? themeData.colors?.["terminal.ansiBlue"];
  if (modifiedBlue != null) styles += `${formatCSSVariablePrefix("global")}${modePrefix}modified-color:${modifiedBlue};`;
  return styles;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/getLineNodes.js
function getLineNodes(nodes) {
  let firstChild = nodes.children[0];
  while (firstChild != null) {
    if (firstChild.type === "element" && firstChild.tagName === "code") return firstChild.children;
    if ("children" in firstChild) firstChild = firstChild.children[0];
    else firstChild = null;
  }
  console.error(nodes);
  throw new Error("getLineNodes: Unable to find children");
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/splitFileContents.js
function splitFileContents(contents) {
  return contents !== "" ? contents.split(SPLIT_WITH_NEWLINES) : [];
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/renderFileWithHighlighter.js
var DEFAULT_PLAIN_TEXT_OPTIONS = { forcePlainText: false };
function renderFileWithHighlighter(file, highlighter2, { theme = DEFAULT_THEMES, tokenizeMaxLineLength, useTokenTransformer }, { forcePlainText, startingLine, totalLines, lines } = DEFAULT_PLAIN_TEXT_OPTIONS) {
  if (forcePlainText) {
    startingLine ??= 0;
    totalLines ??= Infinity;
  } else {
    startingLine = 0;
    totalLines = Infinity;
  }
  const isWindowedHighlight = startingLine > 0 || totalLines < Infinity;
  const { state, transformers } = createTransformerWithState(useTokenTransformer);
  const lang = forcePlainText ? "text" : file.lang ?? getFiletypeFromFileName(file.name);
  const baseThemeType = typeof theme === "string" ? highlighter2.getTheme(theme).type : void 0;
  const themeStyles = getHighlighterThemeStyles({
    theme,
    highlighter: highlighter2
  });
  state.lineInfo = (shikiLineNumber) => ({
    type: "context",
    lineIndex: shikiLineNumber - 1 + startingLine,
    lineNumber: shikiLineNumber + startingLine
  });
  const hastConfig = (() => {
    if (typeof theme === "string") return {
      lang,
      theme,
      transformers,
      defaultColor: false,
      cssVariablePrefix: formatCSSVariablePrefix("token"),
      tokenizeMaxLineLength
    };
    return {
      lang,
      themes: theme,
      transformers,
      defaultColor: false,
      cssVariablePrefix: formatCSSVariablePrefix("token"),
      tokenizeMaxLineLength
    };
  })();
  const highlightedLines = getLineNodes(highlighter2.codeToHast(isWindowedHighlight ? extractWindowedFileContent(lines ?? splitFileContents(file.contents), startingLine, totalLines) : cleanLastNewline(file.contents), hastConfig));
  const code = isWindowedHighlight ? new Array(startingLine) : highlightedLines;
  if (isWindowedHighlight) code.push(...highlightedLines);
  return {
    code,
    themeStyles,
    baseThemeType
  };
}
function extractWindowedFileContent(lines, startingLine, totalLines) {
  let windowContent = "";
  iterateOverFile({
    lines,
    startingLine,
    totalLines,
    callback({ content }) {
      windowContent += content;
    }
  });
  return windowContent;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/areFilesEqual.js
function areFilesEqual(fileA, fileB) {
  return fileA?.cacheKey === fileB?.cacheKey && fileA?.contents === fileB?.contents && fileA?.name === fileB?.name && fileA?.lang === fileB?.lang;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/areDiffRenderOptionsEqual.js
function areDiffRenderOptionsEqual(optionsA, optionsB) {
  return areThemesEqual(optionsA.theme, optionsB.theme) && optionsA.useTokenTransformer === optionsB.useTokenTransformer && optionsA.tokenizeMaxLineLength === optionsB.tokenizeMaxLineLength && optionsA.lineDiffType === optionsB.lineDiffType && optionsA.maxLineDiffLength === optionsB.maxLineDiffLength;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/isDiffPlainText.js
function isDiffPlainText(diff) {
  const computedLang = diff.lang ?? getFiletypeFromFileName(diff.name);
  const computedPreviousLang = diff.lang ?? (diff.prevName != null ? getFiletypeFromFileName(diff.prevName) : "text");
  return computedLang === "text" && computedPreviousLang === "text";
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/iterateOverDiff.js
function iterateOverDiff({ diff, diffStyle, startingLine = 0, totalLines = Infinity, expandedHunks, collapsedContextThreshold = DEFAULT_COLLAPSED_CONTEXT_THRESHOLD, callback }) {
  const state = {
    finalHunk: diff.hunks.at(-1),
    viewportStart: startingLine,
    viewportEnd: startingLine + totalLines,
    isWindowedHighlight: startingLine > 0 || totalLines < Infinity,
    splitCount: 0,
    unifiedCount: 0,
    shouldBreak() {
      if (!state.isWindowedHighlight) return false;
      const breakUnified = state.unifiedCount >= startingLine + totalLines;
      const breakSplit = state.splitCount >= startingLine + totalLines;
      if (diffStyle === "unified") return breakUnified;
      else if (diffStyle === "split") return breakSplit;
      else return breakUnified && breakSplit;
    },
    shouldSkip(unifiedHeight, splitHeight) {
      if (!state.isWindowedHighlight) return false;
      const skipUnified = state.unifiedCount + unifiedHeight < startingLine;
      const skipSplit = state.splitCount + splitHeight < startingLine;
      if (diffStyle === "unified") return skipUnified;
      else if (diffStyle === "split") return skipSplit;
      else return skipUnified && skipSplit;
    },
    incrementCounts(unifiedValue, splitValue) {
      if (diffStyle === "unified" || diffStyle === "both") state.unifiedCount += unifiedValue;
      if (diffStyle === "split" || diffStyle === "both") state.splitCount += splitValue;
    },
    isInWindow(unifiedHeight, splitHeight) {
      if (!state.isWindowedHighlight) return true;
      const unifiedInWindow = state.isInUnifiedWindow(unifiedHeight);
      const splitInWindow = state.isInSplitWindow(splitHeight);
      if (diffStyle === "unified") return unifiedInWindow;
      else if (diffStyle === "split") return splitInWindow;
      else return unifiedInWindow || splitInWindow;
    },
    isInUnifiedWindow(unifiedHeight) {
      return !state.isWindowedHighlight || state.unifiedCount >= startingLine - unifiedHeight && state.unifiedCount < startingLine + totalLines;
    },
    isInSplitWindow(splitHeight) {
      return !state.isWindowedHighlight || state.splitCount >= startingLine - splitHeight && state.splitCount < startingLine + totalLines;
    },
    emit(props, silent = false) {
      if (!silent) if (diffStyle === "unified") state.incrementCounts(1, 0);
      else if (diffStyle === "split") state.incrementCounts(0, 1);
      else state.incrementCounts(1, 1);
      return callback(props) ?? false;
    }
  };
  hunkIterator: for (const [hunkIndex, hunk] of diff.hunks.entries()) {
    let getTrailingCollapsedAfter = function(unifiedLineIndex$1, splitLineIndex$1) {
      if (trailingRegion == null || trailingRegion.collapsedLines <= 0 || trailingRegion.fromStart + trailingRegion.fromEnd > 0) return 0;
      if (diffStyle === "unified") return unifiedLineIndex$1 === hunk.unifiedLineStart + hunk.unifiedLineCount - 1 ? trailingRegion.collapsedLines : 0;
      return splitLineIndex$1 === hunk.splitLineStart + hunk.splitLineCount - 1 ? trailingRegion.collapsedLines : 0;
    }, getPendingCollapsed = function() {
      if (leadingRegion.collapsedLines === 0) return 0;
      const value = leadingRegion.collapsedLines;
      leadingRegion.collapsedLines = 0;
      return value;
    };
    if (state.shouldBreak()) break;
    const leadingRegion = getExpandedRegion(diff.isPartial, hunk.collapsedBefore, expandedHunks, hunkIndex, collapsedContextThreshold);
    const trailingRegion = (() => {
      if (hunk !== state.finalHunk || !hasFinalCollapsedHunk(diff)) return;
      const additionRemaining = diff.additionLines.length - (hunk.additionLineIndex + hunk.additionCount);
      const deletionRemaining = diff.deletionLines.length - (hunk.deletionLineIndex + hunk.deletionCount);
      if (additionRemaining !== deletionRemaining) throw new Error(`iterateOverDiff: trailing context mismatch (additions=${additionRemaining}, deletions=${deletionRemaining}) for ${diff.name}`);
      const trailingRangeSize = Math.min(additionRemaining, deletionRemaining);
      return getExpandedRegion(diff.isPartial, trailingRangeSize, expandedHunks, diff.hunks.length, collapsedContextThreshold);
    })();
    const expandedLineCount = leadingRegion.fromStart + leadingRegion.fromEnd;
    if (!state.shouldSkip(expandedLineCount, expandedLineCount)) {
      let unifiedLineIndex$1 = hunk.unifiedLineStart - leadingRegion.rangeSize;
      let splitLineIndex$1 = hunk.splitLineStart - leadingRegion.rangeSize;
      let deletionLineIndex$1 = hunk.deletionLineIndex - leadingRegion.rangeSize;
      let additionLineIndex$1 = hunk.additionLineIndex - leadingRegion.rangeSize;
      let deletionLineNumber$1 = hunk.deletionStart - leadingRegion.rangeSize;
      let additionLineNumber$1 = hunk.additionStart - leadingRegion.rangeSize;
      let index = 0;
      while (index < leadingRegion.fromStart) {
        if (state.isInWindow(0, 0)) {
          if (state.emit({
            hunkIndex,
            hunk,
            collapsedBefore: 0,
            collapsedAfter: 0,
            type: "context-expanded",
            deletionLine: {
              lineNumber: deletionLineNumber$1 + index,
              lineIndex: deletionLineIndex$1 + index,
              noEOFCR: false,
              unifiedLineIndex: unifiedLineIndex$1 + index,
              splitLineIndex: splitLineIndex$1 + index
            },
            additionLine: {
              unifiedLineIndex: unifiedLineIndex$1 + index,
              splitLineIndex: splitLineIndex$1 + index,
              lineIndex: additionLineIndex$1 + index,
              lineNumber: additionLineNumber$1 + index,
              noEOFCR: false
            }
          })) break hunkIterator;
        } else state.incrementCounts(1, 1);
        index++;
      }
      unifiedLineIndex$1 = hunk.unifiedLineStart - leadingRegion.fromEnd;
      splitLineIndex$1 = hunk.splitLineStart - leadingRegion.fromEnd;
      deletionLineIndex$1 = hunk.deletionLineIndex - leadingRegion.fromEnd;
      additionLineIndex$1 = hunk.additionLineIndex - leadingRegion.fromEnd;
      deletionLineNumber$1 = hunk.deletionStart - leadingRegion.fromEnd;
      additionLineNumber$1 = hunk.additionStart - leadingRegion.fromEnd;
      index = 0;
      while (index < leadingRegion.fromEnd) {
        if (state.isInWindow(0, 0)) {
          if (state.emit({
            hunkIndex,
            hunk,
            collapsedBefore: getPendingCollapsed(),
            collapsedAfter: 0,
            type: "context-expanded",
            deletionLine: {
              lineNumber: deletionLineNumber$1 + index,
              lineIndex: deletionLineIndex$1 + index,
              noEOFCR: false,
              unifiedLineIndex: unifiedLineIndex$1 + index,
              splitLineIndex: splitLineIndex$1 + index
            },
            additionLine: {
              unifiedLineIndex: unifiedLineIndex$1 + index,
              splitLineIndex: splitLineIndex$1 + index,
              lineIndex: additionLineIndex$1 + index,
              lineNumber: additionLineNumber$1 + index,
              noEOFCR: false
            }
          })) break hunkIterator;
        } else state.incrementCounts(1, 1);
        index++;
      }
    } else {
      state.incrementCounts(expandedLineCount, expandedLineCount);
      getPendingCollapsed();
    }
    let unifiedLineIndex = hunk.unifiedLineStart;
    let splitLineIndex = hunk.splitLineStart;
    let deletionLineIndex = hunk.deletionLineIndex;
    let additionLineIndex = hunk.additionLineIndex;
    let deletionLineNumber = hunk.deletionStart;
    let additionLineNumber = hunk.additionStart;
    const lastContent = hunk.hunkContent.at(-1);
    for (const content of hunk.hunkContent) {
      if (state.shouldBreak()) break hunkIterator;
      const isLastContent = content === lastContent;
      if (content.type === "context") {
        if (!state.shouldSkip(content.lines, content.lines)) {
          let index = 0;
          while (index < content.lines) {
            if (state.isInWindow(0, 0)) {
              const isLastLine = isLastContent && index === content.lines - 1;
              const unifiedRowIndex = unifiedLineIndex + index;
              const splitRowIndex = splitLineIndex + index;
              if (state.emit({
                hunkIndex,
                hunk,
                collapsedBefore: getPendingCollapsed(),
                collapsedAfter: getTrailingCollapsedAfter(unifiedRowIndex, splitRowIndex),
                type: "context",
                deletionLine: {
                  lineNumber: deletionLineNumber + index,
                  lineIndex: deletionLineIndex + index,
                  noEOFCR: isLastLine && hunk.noEOFCRDeletions,
                  unifiedLineIndex: unifiedRowIndex,
                  splitLineIndex: splitRowIndex
                },
                additionLine: {
                  unifiedLineIndex: unifiedRowIndex,
                  splitLineIndex: splitRowIndex,
                  lineIndex: additionLineIndex + index,
                  lineNumber: additionLineNumber + index,
                  noEOFCR: isLastLine && hunk.noEOFCRAdditions
                }
              })) break hunkIterator;
            } else state.incrementCounts(1, 1);
            index++;
          }
        } else {
          state.incrementCounts(content.lines, content.lines);
          getPendingCollapsed();
        }
        unifiedLineIndex += content.lines;
        splitLineIndex += content.lines;
        deletionLineIndex += content.lines;
        additionLineIndex += content.lines;
        deletionLineNumber += content.lines;
        additionLineNumber += content.lines;
      } else {
        const splitCount = Math.max(content.deletions, content.additions);
        const unifiedCount = content.deletions + content.additions;
        if (!state.shouldSkip(unifiedCount, splitCount)) {
          const iterationRanges = getChangeIterationRanges(state, content, diffStyle);
          for (const [rangeStart, rangeEnd] of iterationRanges) for (let index = rangeStart; index < rangeEnd; index++) {
            const collapsedAfter = getTrailingCollapsedAfter(unifiedLineIndex + index, diffStyle === "unified" ? splitLineIndex + (index < content.deletions ? index : index - content.deletions) : splitLineIndex + index);
            if (state.emit(getChangeLineData({
              hunkIndex,
              hunk,
              collapsedBefore: getPendingCollapsed(),
              collapsedAfter,
              diffStyle,
              index,
              unifiedLineIndex,
              splitLineIndex,
              additionLineIndex,
              deletionLineIndex,
              additionLineNumber,
              deletionLineNumber,
              content,
              isLastContent,
              unifiedCount,
              splitCount
            }), true)) break hunkIterator;
          }
        }
        getPendingCollapsed();
        state.incrementCounts(unifiedCount, splitCount);
        unifiedLineIndex += unifiedCount;
        splitLineIndex += splitCount;
        deletionLineIndex += content.deletions;
        additionLineIndex += content.additions;
        deletionLineNumber += content.deletions;
        additionLineNumber += content.additions;
      }
    }
    if (trailingRegion != null) {
      const { collapsedLines, fromStart, fromEnd } = trailingRegion;
      const len = fromStart + fromEnd;
      let index = 0;
      while (index < len) {
        if (state.shouldBreak()) break hunkIterator;
        if (state.isInWindow(0, 0)) {
          const isLastLine = index === len - 1;
          if (state.emit({
            hunkIndex: diff.hunks.length,
            hunk: void 0,
            collapsedBefore: 0,
            collapsedAfter: isLastLine ? collapsedLines : 0,
            type: "context-expanded",
            deletionLine: {
              lineNumber: deletionLineNumber + index,
              lineIndex: deletionLineIndex + index,
              noEOFCR: false,
              unifiedLineIndex: unifiedLineIndex + index,
              splitLineIndex: splitLineIndex + index
            },
            additionLine: {
              unifiedLineIndex: unifiedLineIndex + index,
              splitLineIndex: splitLineIndex + index,
              lineIndex: additionLineIndex + index,
              lineNumber: additionLineNumber + index,
              noEOFCR: false
            }
          })) break hunkIterator;
        } else state.incrementCounts(1, 1);
        index++;
      }
    }
  }
}
function getExpandedRegion(isPartial, rangeSize, expandedHunks, hunkIndex, collapsedContextThreshold) {
  rangeSize = Math.max(rangeSize, 0);
  if (rangeSize === 0 || isPartial) return {
    fromStart: 0,
    fromEnd: 0,
    rangeSize,
    collapsedLines: Math.max(rangeSize, 0)
  };
  if (expandedHunks === true || rangeSize <= collapsedContextThreshold) return {
    fromStart: rangeSize,
    fromEnd: 0,
    rangeSize,
    collapsedLines: 0
  };
  const region = expandedHunks?.get(hunkIndex);
  const fromStart = Math.min(Math.max(region?.fromStart ?? 0, 0), rangeSize);
  const fromEnd = Math.min(Math.max(region?.fromEnd ?? 0, 0), rangeSize);
  const expandedCount = fromStart + fromEnd;
  const renderAll = expandedCount >= rangeSize;
  return {
    fromStart: renderAll ? rangeSize : fromStart,
    fromEnd: renderAll ? 0 : fromEnd,
    rangeSize,
    collapsedLines: Math.max(rangeSize - expandedCount, 0)
  };
}
function hasFinalCollapsedHunk(diff) {
  const lastHunk = diff.hunks.at(-1);
  if (lastHunk == null || diff.isPartial || diff.additionLines.length === 0 || diff.deletionLines.length === 0) return false;
  return lastHunk.additionLineIndex + lastHunk.additionCount < diff.additionLines.length || lastHunk.deletionLineIndex + lastHunk.deletionCount < diff.deletionLines.length;
}
function getChangeIterationRanges(state, content, diffStyle) {
  if (!state.isWindowedHighlight) return [[0, diffStyle === "unified" ? content.deletions + content.additions : Math.max(content.deletions, content.additions)]];
  const useUnified = diffStyle !== "split";
  const useSplit = diffStyle !== "unified";
  const iterationSpace = diffStyle === "unified" ? "unified" : "split";
  const iterationRanges = [];
  function getVisibleRange(start, count) {
    if (start + count <= state.viewportStart || start >= state.viewportEnd) return;
    const visibleStart = Math.max(0, state.viewportStart - start);
    const visibleEnd = Math.min(count, state.viewportEnd - start);
    return visibleEnd > visibleStart ? [visibleStart, visibleEnd] : void 0;
  }
  function mapRangeToIteration(range2, kind) {
    if (iterationSpace === "split") return range2;
    return kind === "additions" ? [range2[0] + content.deletions, range2[1] + content.deletions] : range2;
  }
  function pushRange(range2, kind) {
    if (range2 == null) return;
    const [start, end] = mapRangeToIteration(range2, kind);
    if (end > start) iterationRanges.push([start, end]);
  }
  if (useUnified) {
    pushRange(getVisibleRange(state.unifiedCount, content.deletions), "deletions");
    pushRange(getVisibleRange(state.unifiedCount + content.deletions, content.additions), "additions");
  }
  if (useSplit) {
    pushRange(getVisibleRange(state.splitCount, content.deletions), "deletions");
    pushRange(getVisibleRange(state.splitCount, content.additions), "additions");
  }
  if (iterationRanges.length === 0) return iterationRanges;
  iterationRanges.sort((a2, b3) => a2[0] - b3[0]);
  const merged = [iterationRanges[0]];
  for (const [start, end] of iterationRanges.slice(1)) {
    const last = merged[merged.length - 1];
    if (start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}
function getChangeLineData({ hunkIndex, hunk, collapsedAfter, collapsedBefore, diffStyle, index, unifiedLineIndex, splitLineIndex, additionLineIndex, deletionLineIndex, additionLineNumber, deletionLineNumber, content, isLastContent, unifiedCount, splitCount }) {
  const unifiedDeletionLineIndex = index < content.deletions ? unifiedLineIndex + index : void 0;
  const unifiedAdditionLineIndex = diffStyle === "unified" ? index >= content.deletions ? unifiedLineIndex + index : void 0 : index < content.additions ? unifiedLineIndex + content.deletions + index : void 0;
  const resolvedSplitLineIndex = diffStyle === "unified" ? splitLineIndex + (index < content.deletions ? index : index - content.deletions) : splitLineIndex + index;
  const deletionLineIndexValue = index < content.deletions ? deletionLineIndex + index : void 0;
  const deletionLineNumberValue = index < content.deletions ? deletionLineNumber + index : void 0;
  const additionLineIndexValue = diffStyle === "unified" ? index >= content.deletions ? additionLineIndex + (index - content.deletions) : void 0 : index < content.additions ? additionLineIndex + index : void 0;
  const additionLineNumberValue = diffStyle === "unified" ? index >= content.deletions ? additionLineNumber + (index - content.deletions) : void 0 : index < content.additions ? additionLineNumber + index : void 0;
  const noEOFCRDeletion = diffStyle === "unified" ? isLastContent && index === content.deletions - 1 && hunk.noEOFCRDeletions : isLastContent && index === splitCount - 1 && hunk.noEOFCRDeletions;
  const noEOFCRAddition = diffStyle === "unified" ? isLastContent && index === unifiedCount - 1 && hunk.noEOFCRAdditions : isLastContent && index === splitCount - 1 && hunk.noEOFCRAdditions;
  const deletionLine = deletionLineIndexValue != null && deletionLineNumberValue != null && unifiedDeletionLineIndex != null ? {
    lineNumber: deletionLineNumberValue,
    lineIndex: deletionLineIndexValue,
    noEOFCR: noEOFCRDeletion,
    unifiedLineIndex: unifiedDeletionLineIndex,
    splitLineIndex: resolvedSplitLineIndex
  } : void 0;
  const additionLine = additionLineIndexValue != null && additionLineNumberValue != null && unifiedAdditionLineIndex != null ? {
    unifiedLineIndex: unifiedAdditionLineIndex,
    splitLineIndex: resolvedSplitLineIndex,
    lineIndex: additionLineIndexValue,
    lineNumber: additionLineNumberValue,
    noEOFCR: noEOFCRAddition
  } : void 0;
  if (deletionLine == null && additionLine != null) return {
    type: "change",
    hunkIndex,
    hunk,
    collapsedAfter,
    collapsedBefore,
    deletionLine: void 0,
    additionLine
  };
  else if (deletionLine != null && additionLine == null) return {
    type: "change",
    hunkIndex,
    hunk,
    collapsedAfter,
    collapsedBefore,
    deletionLine,
    additionLine: void 0
  };
  if (deletionLine == null || additionLine == null) throw new Error("iterateOverDiff: missing change line data");
  return {
    type: "change",
    hunkIndex,
    hunk,
    collapsedAfter,
    collapsedBefore,
    deletionLine,
    additionLine
  };
}

// node_modules/.pnpm/diff@8.0.3/node_modules/diff/libesm/diff/base.js
var Diff = class {
  diff(oldStr, newStr, options = {}) {
    let callback;
    if (typeof options === "function") {
      callback = options;
      options = {};
    } else if ("callback" in options) {
      callback = options.callback;
    }
    const oldString = this.castInput(oldStr, options);
    const newString = this.castInput(newStr, options);
    const oldTokens = this.removeEmpty(this.tokenize(oldString, options));
    const newTokens = this.removeEmpty(this.tokenize(newString, options));
    return this.diffWithOptionsObj(oldTokens, newTokens, options, callback);
  }
  diffWithOptionsObj(oldTokens, newTokens, options, callback) {
    var _a;
    const done = (value) => {
      value = this.postProcess(value, options);
      if (callback) {
        setTimeout(function() {
          callback(value);
        }, 0);
        return void 0;
      } else {
        return value;
      }
    };
    const newLen = newTokens.length, oldLen = oldTokens.length;
    let editLength = 1;
    let maxEditLength = newLen + oldLen;
    if (options.maxEditLength != null) {
      maxEditLength = Math.min(maxEditLength, options.maxEditLength);
    }
    const maxExecutionTime = (_a = options.timeout) !== null && _a !== void 0 ? _a : Infinity;
    const abortAfterTimestamp = Date.now() + maxExecutionTime;
    const bestPath = [{ oldPos: -1, lastComponent: void 0 }];
    let newPos = this.extractCommon(bestPath[0], newTokens, oldTokens, 0, options);
    if (bestPath[0].oldPos + 1 >= oldLen && newPos + 1 >= newLen) {
      return done(this.buildValues(bestPath[0].lastComponent, newTokens, oldTokens));
    }
    let minDiagonalToConsider = -Infinity, maxDiagonalToConsider = Infinity;
    const execEditLength = () => {
      for (let diagonalPath = Math.max(minDiagonalToConsider, -editLength); diagonalPath <= Math.min(maxDiagonalToConsider, editLength); diagonalPath += 2) {
        let basePath;
        const removePath = bestPath[diagonalPath - 1], addPath = bestPath[diagonalPath + 1];
        if (removePath) {
          bestPath[diagonalPath - 1] = void 0;
        }
        let canAdd = false;
        if (addPath) {
          const addPathNewPos = addPath.oldPos - diagonalPath;
          canAdd = addPath && 0 <= addPathNewPos && addPathNewPos < newLen;
        }
        const canRemove = removePath && removePath.oldPos + 1 < oldLen;
        if (!canAdd && !canRemove) {
          bestPath[diagonalPath] = void 0;
          continue;
        }
        if (!canRemove || canAdd && removePath.oldPos < addPath.oldPos) {
          basePath = this.addToPath(addPath, true, false, 0, options);
        } else {
          basePath = this.addToPath(removePath, false, true, 1, options);
        }
        newPos = this.extractCommon(basePath, newTokens, oldTokens, diagonalPath, options);
        if (basePath.oldPos + 1 >= oldLen && newPos + 1 >= newLen) {
          return done(this.buildValues(basePath.lastComponent, newTokens, oldTokens)) || true;
        } else {
          bestPath[diagonalPath] = basePath;
          if (basePath.oldPos + 1 >= oldLen) {
            maxDiagonalToConsider = Math.min(maxDiagonalToConsider, diagonalPath - 1);
          }
          if (newPos + 1 >= newLen) {
            minDiagonalToConsider = Math.max(minDiagonalToConsider, diagonalPath + 1);
          }
        }
      }
      editLength++;
    };
    if (callback) {
      (function exec() {
        setTimeout(function() {
          if (editLength > maxEditLength || Date.now() > abortAfterTimestamp) {
            return callback(void 0);
          }
          if (!execEditLength()) {
            exec();
          }
        }, 0);
      })();
    } else {
      while (editLength <= maxEditLength && Date.now() <= abortAfterTimestamp) {
        const ret = execEditLength();
        if (ret) {
          return ret;
        }
      }
    }
  }
  addToPath(path, added, removed, oldPosInc, options) {
    const last = path.lastComponent;
    if (last && !options.oneChangePerToken && last.added === added && last.removed === removed) {
      return {
        oldPos: path.oldPos + oldPosInc,
        lastComponent: { count: last.count + 1, added, removed, previousComponent: last.previousComponent }
      };
    } else {
      return {
        oldPos: path.oldPos + oldPosInc,
        lastComponent: { count: 1, added, removed, previousComponent: last }
      };
    }
  }
  extractCommon(basePath, newTokens, oldTokens, diagonalPath, options) {
    const newLen = newTokens.length, oldLen = oldTokens.length;
    let oldPos = basePath.oldPos, newPos = oldPos - diagonalPath, commonCount = 0;
    while (newPos + 1 < newLen && oldPos + 1 < oldLen && this.equals(oldTokens[oldPos + 1], newTokens[newPos + 1], options)) {
      newPos++;
      oldPos++;
      commonCount++;
      if (options.oneChangePerToken) {
        basePath.lastComponent = { count: 1, previousComponent: basePath.lastComponent, added: false, removed: false };
      }
    }
    if (commonCount && !options.oneChangePerToken) {
      basePath.lastComponent = { count: commonCount, previousComponent: basePath.lastComponent, added: false, removed: false };
    }
    basePath.oldPos = oldPos;
    return newPos;
  }
  equals(left, right, options) {
    if (options.comparator) {
      return options.comparator(left, right);
    } else {
      return left === right || !!options.ignoreCase && left.toLowerCase() === right.toLowerCase();
    }
  }
  removeEmpty(array) {
    const ret = [];
    for (let i2 = 0; i2 < array.length; i2++) {
      if (array[i2]) {
        ret.push(array[i2]);
      }
    }
    return ret;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  castInput(value, options) {
    return value;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  tokenize(value, options) {
    return Array.from(value);
  }
  join(chars) {
    return chars.join("");
  }
  postProcess(changeObjects, options) {
    return changeObjects;
  }
  get useLongestToken() {
    return false;
  }
  buildValues(lastComponent, newTokens, oldTokens) {
    const components = [];
    let nextComponent;
    while (lastComponent) {
      components.push(lastComponent);
      nextComponent = lastComponent.previousComponent;
      delete lastComponent.previousComponent;
      lastComponent = nextComponent;
    }
    components.reverse();
    const componentLen = components.length;
    let componentPos = 0, newPos = 0, oldPos = 0;
    for (; componentPos < componentLen; componentPos++) {
      const component = components[componentPos];
      if (!component.removed) {
        if (!component.added && this.useLongestToken) {
          let value = newTokens.slice(newPos, newPos + component.count);
          value = value.map(function(value2, i2) {
            const oldValue = oldTokens[oldPos + i2];
            return oldValue.length > value2.length ? oldValue : value2;
          });
          component.value = this.join(value);
        } else {
          component.value = this.join(newTokens.slice(newPos, newPos + component.count));
        }
        newPos += component.count;
        if (!component.added) {
          oldPos += component.count;
        }
      } else {
        component.value = this.join(oldTokens.slice(oldPos, oldPos + component.count));
        oldPos += component.count;
      }
    }
    return components;
  }
};

// node_modules/.pnpm/diff@8.0.3/node_modules/diff/libesm/diff/character.js
var CharacterDiff = class extends Diff {
};
var characterDiff = new CharacterDiff();
function diffChars(oldStr, newStr, options) {
  return characterDiff.diff(oldStr, newStr, options);
}

// node_modules/.pnpm/diff@8.0.3/node_modules/diff/libesm/util/string.js
function longestCommonPrefix(str1, str2) {
  let i2;
  for (i2 = 0; i2 < str1.length && i2 < str2.length; i2++) {
    if (str1[i2] != str2[i2]) {
      return str1.slice(0, i2);
    }
  }
  return str1.slice(0, i2);
}
function longestCommonSuffix(str1, str2) {
  let i2;
  if (!str1 || !str2 || str1[str1.length - 1] != str2[str2.length - 1]) {
    return "";
  }
  for (i2 = 0; i2 < str1.length && i2 < str2.length; i2++) {
    if (str1[str1.length - (i2 + 1)] != str2[str2.length - (i2 + 1)]) {
      return str1.slice(-i2);
    }
  }
  return str1.slice(-i2);
}
function replacePrefix(string, oldPrefix, newPrefix) {
  if (string.slice(0, oldPrefix.length) != oldPrefix) {
    throw Error(`string ${JSON.stringify(string)} doesn't start with prefix ${JSON.stringify(oldPrefix)}; this is a bug`);
  }
  return newPrefix + string.slice(oldPrefix.length);
}
function replaceSuffix(string, oldSuffix, newSuffix) {
  if (!oldSuffix) {
    return string + newSuffix;
  }
  if (string.slice(-oldSuffix.length) != oldSuffix) {
    throw Error(`string ${JSON.stringify(string)} doesn't end with suffix ${JSON.stringify(oldSuffix)}; this is a bug`);
  }
  return string.slice(0, -oldSuffix.length) + newSuffix;
}
function removePrefix(string, oldPrefix) {
  return replacePrefix(string, oldPrefix, "");
}
function removeSuffix(string, oldSuffix) {
  return replaceSuffix(string, oldSuffix, "");
}
function maximumOverlap(string1, string2) {
  return string2.slice(0, overlapCount(string1, string2));
}
function overlapCount(a2, b3) {
  let startA = 0;
  if (a2.length > b3.length) {
    startA = a2.length - b3.length;
  }
  let endB = b3.length;
  if (a2.length < b3.length) {
    endB = a2.length;
  }
  const map = Array(endB);
  let k3 = 0;
  map[0] = 0;
  for (let j2 = 1; j2 < endB; j2++) {
    if (b3[j2] == b3[k3]) {
      map[j2] = map[k3];
    } else {
      map[j2] = k3;
    }
    while (k3 > 0 && b3[j2] != b3[k3]) {
      k3 = map[k3];
    }
    if (b3[j2] == b3[k3]) {
      k3++;
    }
  }
  k3 = 0;
  for (let i2 = startA; i2 < a2.length; i2++) {
    while (k3 > 0 && a2[i2] != b3[k3]) {
      k3 = map[k3];
    }
    if (a2[i2] == b3[k3]) {
      k3++;
    }
  }
  return k3;
}
function trailingWs(string) {
  let i2;
  for (i2 = string.length - 1; i2 >= 0; i2--) {
    if (!string[i2].match(/\s/)) {
      break;
    }
  }
  return string.substring(i2 + 1);
}
function leadingWs(string) {
  const match = string.match(/^\s*/);
  return match ? match[0] : "";
}

// node_modules/.pnpm/diff@8.0.3/node_modules/diff/libesm/diff/word.js
var extendedWordChars = "a-zA-Z0-9_\\u{AD}\\u{C0}-\\u{D6}\\u{D8}-\\u{F6}\\u{F8}-\\u{2C6}\\u{2C8}-\\u{2D7}\\u{2DE}-\\u{2FF}\\u{1E00}-\\u{1EFF}";
var tokenizeIncludingWhitespace = new RegExp(`[${extendedWordChars}]+|\\s+|[^${extendedWordChars}]`, "ug");
var WordDiff = class extends Diff {
  equals(left, right, options) {
    if (options.ignoreCase) {
      left = left.toLowerCase();
      right = right.toLowerCase();
    }
    return left.trim() === right.trim();
  }
  tokenize(value, options = {}) {
    let parts;
    if (options.intlSegmenter) {
      const segmenter = options.intlSegmenter;
      if (segmenter.resolvedOptions().granularity != "word") {
        throw new Error('The segmenter passed must have a granularity of "word"');
      }
      parts = [];
      for (const segmentObj of Array.from(segmenter.segment(value))) {
        const segment = segmentObj.segment;
        if (parts.length && /\s/.test(parts[parts.length - 1]) && /\s/.test(segment)) {
          parts[parts.length - 1] += segment;
        } else {
          parts.push(segment);
        }
      }
    } else {
      parts = value.match(tokenizeIncludingWhitespace) || [];
    }
    const tokens = [];
    let prevPart = null;
    parts.forEach((part) => {
      if (/\s/.test(part)) {
        if (prevPart == null) {
          tokens.push(part);
        } else {
          tokens.push(tokens.pop() + part);
        }
      } else if (prevPart != null && /\s/.test(prevPart)) {
        if (tokens[tokens.length - 1] == prevPart) {
          tokens.push(tokens.pop() + part);
        } else {
          tokens.push(prevPart + part);
        }
      } else {
        tokens.push(part);
      }
      prevPart = part;
    });
    return tokens;
  }
  join(tokens) {
    return tokens.map((token2, i2) => {
      if (i2 == 0) {
        return token2;
      } else {
        return token2.replace(/^\s+/, "");
      }
    }).join("");
  }
  postProcess(changes, options) {
    if (!changes || options.oneChangePerToken) {
      return changes;
    }
    let lastKeep = null;
    let insertion = null;
    let deletion = null;
    changes.forEach((change) => {
      if (change.added) {
        insertion = change;
      } else if (change.removed) {
        deletion = change;
      } else {
        if (insertion || deletion) {
          dedupeWhitespaceInChangeObjects(lastKeep, deletion, insertion, change);
        }
        lastKeep = change;
        insertion = null;
        deletion = null;
      }
    });
    if (insertion || deletion) {
      dedupeWhitespaceInChangeObjects(lastKeep, deletion, insertion, null);
    }
    return changes;
  }
};
var wordDiff = new WordDiff();
function dedupeWhitespaceInChangeObjects(startKeep, deletion, insertion, endKeep) {
  if (deletion && insertion) {
    const oldWsPrefix = leadingWs(deletion.value);
    const oldWsSuffix = trailingWs(deletion.value);
    const newWsPrefix = leadingWs(insertion.value);
    const newWsSuffix = trailingWs(insertion.value);
    if (startKeep) {
      const commonWsPrefix = longestCommonPrefix(oldWsPrefix, newWsPrefix);
      startKeep.value = replaceSuffix(startKeep.value, newWsPrefix, commonWsPrefix);
      deletion.value = removePrefix(deletion.value, commonWsPrefix);
      insertion.value = removePrefix(insertion.value, commonWsPrefix);
    }
    if (endKeep) {
      const commonWsSuffix = longestCommonSuffix(oldWsSuffix, newWsSuffix);
      endKeep.value = replacePrefix(endKeep.value, newWsSuffix, commonWsSuffix);
      deletion.value = removeSuffix(deletion.value, commonWsSuffix);
      insertion.value = removeSuffix(insertion.value, commonWsSuffix);
    }
  } else if (insertion) {
    if (startKeep) {
      const ws = leadingWs(insertion.value);
      insertion.value = insertion.value.substring(ws.length);
    }
    if (endKeep) {
      const ws = leadingWs(endKeep.value);
      endKeep.value = endKeep.value.substring(ws.length);
    }
  } else if (startKeep && endKeep) {
    const newWsFull = leadingWs(endKeep.value), delWsStart = leadingWs(deletion.value), delWsEnd = trailingWs(deletion.value);
    const newWsStart = longestCommonPrefix(newWsFull, delWsStart);
    deletion.value = removePrefix(deletion.value, newWsStart);
    const newWsEnd = longestCommonSuffix(removePrefix(newWsFull, newWsStart), delWsEnd);
    deletion.value = removeSuffix(deletion.value, newWsEnd);
    endKeep.value = replacePrefix(endKeep.value, newWsFull, newWsEnd);
    startKeep.value = replaceSuffix(startKeep.value, newWsFull, newWsFull.slice(0, newWsFull.length - newWsEnd.length));
  } else if (endKeep) {
    const endKeepWsPrefix = leadingWs(endKeep.value);
    const deletionWsSuffix = trailingWs(deletion.value);
    const overlap = maximumOverlap(deletionWsSuffix, endKeepWsPrefix);
    deletion.value = removeSuffix(deletion.value, overlap);
  } else if (startKeep) {
    const startKeepWsSuffix = trailingWs(startKeep.value);
    const deletionWsPrefix = leadingWs(deletion.value);
    const overlap = maximumOverlap(startKeepWsSuffix, deletionWsPrefix);
    deletion.value = removePrefix(deletion.value, overlap);
  }
}
var WordsWithSpaceDiff = class extends Diff {
  tokenize(value) {
    const regex = new RegExp(`(\\r?\\n)|[${extendedWordChars}]+|[^\\S\\n\\r]+|[^${extendedWordChars}]`, "ug");
    return value.match(regex) || [];
  }
};
var wordsWithSpaceDiff = new WordsWithSpaceDiff();
function diffWordsWithSpace(oldStr, newStr, options) {
  return wordsWithSpaceDiff.diff(oldStr, newStr, options);
}

// node_modules/.pnpm/diff@8.0.3/node_modules/diff/libesm/diff/line.js
var LineDiff = class extends Diff {
  constructor() {
    super(...arguments);
    this.tokenize = tokenize;
  }
  equals(left, right, options) {
    if (options.ignoreWhitespace) {
      if (!options.newlineIsToken || !left.includes("\n")) {
        left = left.trim();
      }
      if (!options.newlineIsToken || !right.includes("\n")) {
        right = right.trim();
      }
    } else if (options.ignoreNewlineAtEof && !options.newlineIsToken) {
      if (left.endsWith("\n")) {
        left = left.slice(0, -1);
      }
      if (right.endsWith("\n")) {
        right = right.slice(0, -1);
      }
    }
    return super.equals(left, right, options);
  }
};
var lineDiff = new LineDiff();
function diffLines(oldStr, newStr, options) {
  return lineDiff.diff(oldStr, newStr, options);
}
function tokenize(value, options) {
  if (options.stripTrailingCr) {
    value = value.replace(/\r\n/g, "\n");
  }
  const retLines = [], linesAndNewlines = value.split(/(\n|\r\n)/);
  if (!linesAndNewlines[linesAndNewlines.length - 1]) {
    linesAndNewlines.pop();
  }
  for (let i2 = 0; i2 < linesAndNewlines.length; i2++) {
    const line = linesAndNewlines[i2];
    if (i2 % 2 && !options.newlineIsToken) {
      retLines[retLines.length - 1] += line;
    } else {
      retLines.push(line);
    }
  }
  return retLines;
}

// node_modules/.pnpm/diff@8.0.3/node_modules/diff/libesm/patch/create.js
var INCLUDE_HEADERS = {
  includeIndex: true,
  includeUnderline: true,
  includeFileHeaders: true
};
function structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options) {
  let optionsObj;
  if (!options) {
    optionsObj = {};
  } else if (typeof options === "function") {
    optionsObj = { callback: options };
  } else {
    optionsObj = options;
  }
  if (typeof optionsObj.context === "undefined") {
    optionsObj.context = 4;
  }
  const context = optionsObj.context;
  if (optionsObj.newlineIsToken) {
    throw new Error("newlineIsToken may not be used with patch-generation functions, only with diffing functions");
  }
  if (!optionsObj.callback) {
    return diffLinesResultToPatch(diffLines(oldStr, newStr, optionsObj));
  } else {
    const { callback } = optionsObj;
    diffLines(oldStr, newStr, Object.assign(Object.assign({}, optionsObj), { callback: (diff) => {
      const patch = diffLinesResultToPatch(diff);
      callback(patch);
    } }));
  }
  function diffLinesResultToPatch(diff) {
    if (!diff) {
      return;
    }
    diff.push({ value: "", lines: [] });
    function contextLines(lines) {
      return lines.map(function(entry) {
        return " " + entry;
      });
    }
    const hunks = [];
    let oldRangeStart = 0, newRangeStart = 0, curRange = [], oldLine = 1, newLine = 1;
    for (let i2 = 0; i2 < diff.length; i2++) {
      const current = diff[i2], lines = current.lines || splitLines2(current.value);
      current.lines = lines;
      if (current.added || current.removed) {
        if (!oldRangeStart) {
          const prev = diff[i2 - 1];
          oldRangeStart = oldLine;
          newRangeStart = newLine;
          if (prev) {
            curRange = context > 0 ? contextLines(prev.lines.slice(-context)) : [];
            oldRangeStart -= curRange.length;
            newRangeStart -= curRange.length;
          }
        }
        for (const line of lines) {
          curRange.push((current.added ? "+" : "-") + line);
        }
        if (current.added) {
          newLine += lines.length;
        } else {
          oldLine += lines.length;
        }
      } else {
        if (oldRangeStart) {
          if (lines.length <= context * 2 && i2 < diff.length - 2) {
            for (const line of contextLines(lines)) {
              curRange.push(line);
            }
          } else {
            const contextSize = Math.min(lines.length, context);
            for (const line of contextLines(lines.slice(0, contextSize))) {
              curRange.push(line);
            }
            const hunk = {
              oldStart: oldRangeStart,
              oldLines: oldLine - oldRangeStart + contextSize,
              newStart: newRangeStart,
              newLines: newLine - newRangeStart + contextSize,
              lines: curRange
            };
            hunks.push(hunk);
            oldRangeStart = 0;
            newRangeStart = 0;
            curRange = [];
          }
        }
        oldLine += lines.length;
        newLine += lines.length;
      }
    }
    for (const hunk of hunks) {
      for (let i2 = 0; i2 < hunk.lines.length; i2++) {
        if (hunk.lines[i2].endsWith("\n")) {
          hunk.lines[i2] = hunk.lines[i2].slice(0, -1);
        } else {
          hunk.lines.splice(i2 + 1, 0, "\\ No newline at end of file");
          i2++;
        }
      }
    }
    return {
      oldFileName,
      newFileName,
      oldHeader,
      newHeader,
      hunks
    };
  }
}
function formatPatch(patch, headerOptions) {
  if (!headerOptions) {
    headerOptions = INCLUDE_HEADERS;
  }
  if (Array.isArray(patch)) {
    if (patch.length > 1 && !headerOptions.includeFileHeaders) {
      throw new Error("Cannot omit file headers on a multi-file patch. (The result would be unparseable; how would a tool trying to apply the patch know which changes are to which file?)");
    }
    return patch.map((p2) => formatPatch(p2, headerOptions)).join("\n");
  }
  const ret = [];
  if (headerOptions.includeIndex && patch.oldFileName == patch.newFileName) {
    ret.push("Index: " + patch.oldFileName);
  }
  if (headerOptions.includeUnderline) {
    ret.push("===================================================================");
  }
  if (headerOptions.includeFileHeaders) {
    ret.push("--- " + patch.oldFileName + (typeof patch.oldHeader === "undefined" ? "" : "	" + patch.oldHeader));
    ret.push("+++ " + patch.newFileName + (typeof patch.newHeader === "undefined" ? "" : "	" + patch.newHeader));
  }
  for (let i2 = 0; i2 < patch.hunks.length; i2++) {
    const hunk = patch.hunks[i2];
    if (hunk.oldLines === 0) {
      hunk.oldStart -= 1;
    }
    if (hunk.newLines === 0) {
      hunk.newStart -= 1;
    }
    ret.push("@@ -" + hunk.oldStart + "," + hunk.oldLines + " +" + hunk.newStart + "," + hunk.newLines + " @@");
    for (const line of hunk.lines) {
      ret.push(line);
    }
  }
  return ret.join("\n") + "\n";
}
function createTwoFilesPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options) {
  if (typeof options === "function") {
    options = { callback: options };
  }
  if (!(options === null || options === void 0 ? void 0 : options.callback)) {
    const patchObj = structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options);
    if (!patchObj) {
      return;
    }
    return formatPatch(patchObj, options === null || options === void 0 ? void 0 : options.headerOptions);
  } else {
    const { callback } = options;
    structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, Object.assign(Object.assign({}, options), { callback: (patchObj) => {
      if (!patchObj) {
        callback(void 0);
      } else {
        callback(formatPatch(patchObj, options.headerOptions));
      }
    } }));
  }
}
function splitLines2(text2) {
  const hasTrailingNl = text2.endsWith("\n");
  const result = text2.split("\n").map((line) => line + "\n");
  if (hasTrailingNl) {
    result.pop();
  } else {
    result.push(result.pop().slice(0, -1));
  }
  return result;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/parseDiffDecorations.js
function createDiffSpanDecoration({ line, spanStart, spanLength }) {
  return {
    start: {
      line,
      character: spanStart
    },
    end: {
      line,
      character: spanStart + spanLength
    },
    properties: { "data-diff-span": "" },
    alwaysWrap: true
  };
}
function pushOrJoinSpan({ item, arr, enableJoin, isNeutral = false, isLastItem = false }) {
  const lastItem = arr[arr.length - 1];
  if (lastItem == null || isLastItem || !enableJoin) {
    arr.push([isNeutral ? 0 : 1, item.value]);
    return;
  }
  const isLastItemNeutral = lastItem[0] === 0;
  if (isNeutral === isLastItemNeutral || isNeutral && item.value.length === 1 && !isLastItemNeutral) {
    lastItem[1] += item.value;
    return;
  }
  arr.push([isNeutral ? 0 : 1, item.value]);
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/renderDiffWithHighlighter.js
var DEFAULT_PLAIN_TEXT_OPTIONS2 = { forcePlainText: false };
function renderDiffWithHighlighter(diff, highlighter2, options, { forcePlainText, startingLine, totalLines, expandedHunks, collapsedContextThreshold = DEFAULT_COLLAPSED_CONTEXT_THRESHOLD } = DEFAULT_PLAIN_TEXT_OPTIONS2) {
  if (forcePlainText) {
    startingLine ??= 0;
    totalLines ??= Infinity;
  } else {
    startingLine = 0;
    totalLines = Infinity;
  }
  const isWindowedHighlight = startingLine > 0 || totalLines < Infinity;
  const baseThemeType = typeof options.theme === "string" ? highlighter2.getTheme(options.theme).type : void 0;
  const themeStyles = getHighlighterThemeStyles({
    theme: options.theme,
    highlighter: highlighter2
  });
  const lineDiffType = forcePlainText && !isWindowedHighlight && (diff.unifiedLineCount > 1e3 || diff.splitLineCount > 1e3) ? "none" : options.lineDiffType;
  const code = {
    deletionLines: [],
    additionLines: []
  };
  const { maxLineDiffLength } = options;
  const shouldGroupAll = !forcePlainText && !diff.isPartial;
  const expandedHunksForIteration = forcePlainText ? expandedHunks : void 0;
  const buckets = /* @__PURE__ */ new Map();
  function getBucketForHunk(hunkIndex) {
    const index = shouldGroupAll ? 0 : hunkIndex;
    const bucket = buckets.get(index) ?? createBucket();
    buckets.set(index, bucket);
    return bucket;
  }
  function appendContent(lineContent, lineIndex, segments, contentWrapper) {
    if (isWindowedHighlight) {
      let segment = segments.at(-1);
      if (segment == null || segment.targetIndex + segment.count !== lineIndex) {
        segment = {
          targetIndex: lineIndex,
          originalOffset: contentWrapper.length,
          count: 0
        };
        segments.push(segment);
      }
      segment.count++;
    }
    contentWrapper.push(lineContent);
  }
  iterateOverDiff({
    diff,
    diffStyle: "both",
    startingLine,
    totalLines,
    expandedHunks: isWindowedHighlight ? expandedHunksForIteration : true,
    collapsedContextThreshold,
    callback: ({ hunkIndex, additionLine, deletionLine, type }) => {
      const bucket = getBucketForHunk(hunkIndex);
      const splitLineIndex = additionLine != null ? additionLine.splitLineIndex : deletionLine.splitLineIndex;
      if (type === "change" && additionLine != null && deletionLine != null) computeLineDiffDecorations({
        additionLine: diff.additionLines[additionLine.lineIndex],
        deletionLine: diff.deletionLines[deletionLine.lineIndex],
        deletionLineIndex: bucket.deletionContent.length,
        additionLineIndex: bucket.additionContent.length,
        deletionDecorations: bucket.deletionDecorations,
        additionDecorations: bucket.additionDecorations,
        lineDiffType,
        maxLineDiffLength
      });
      if (deletionLine != null) {
        appendContent(diff.deletionLines[deletionLine.lineIndex], deletionLine.lineIndex, bucket.deletionSegments, bucket.deletionContent);
        bucket.deletionInfo.push({
          type: type === "change" ? "change-deletion" : type,
          lineNumber: deletionLine.lineNumber,
          altLineNumber: type === "change" ? void 0 : additionLine.lineNumber ?? void 0,
          lineIndex: `${deletionLine.unifiedLineIndex},${splitLineIndex}`
        });
      }
      if (additionLine != null) {
        appendContent(diff.additionLines[additionLine.lineIndex], additionLine.lineIndex, bucket.additionSegments, bucket.additionContent);
        bucket.additionInfo.push({
          type: type === "change" ? "change-addition" : type,
          lineNumber: additionLine.lineNumber,
          altLineNumber: type === "change" ? void 0 : deletionLine.lineNumber ?? void 0,
          lineIndex: `${additionLine.unifiedLineIndex},${splitLineIndex}`
        });
      }
    }
  });
  for (const bucket of buckets.values()) {
    if (bucket.deletionContent.length === 0 && bucket.additionContent.length === 0) continue;
    const deletionFile = {
      name: diff.prevName ?? diff.name,
      contents: bucket.deletionContent.value
    };
    const additionFile = {
      name: diff.name,
      contents: bucket.additionContent.value
    };
    const { deletionLines, additionLines } = renderTwoFiles({
      deletionFile,
      deletionInfo: bucket.deletionInfo,
      deletionDecorations: bucket.deletionDecorations,
      additionFile,
      additionInfo: bucket.additionInfo,
      additionDecorations: bucket.additionDecorations,
      highlighter: highlighter2,
      options,
      languageOverride: forcePlainText ? "text" : diff.lang
    });
    if (shouldGroupAll) {
      code.deletionLines = deletionLines;
      code.additionLines = additionLines;
      continue;
    }
    if (bucket.deletionSegments.length > 0) for (const seg of bucket.deletionSegments) for (let i2 = 0; i2 < seg.count; i2++) code.deletionLines[seg.targetIndex + i2] = deletionLines[seg.originalOffset + i2];
    else code.deletionLines.push(...deletionLines);
    if (bucket.additionSegments.length > 0) for (const seg of bucket.additionSegments) for (let i2 = 0; i2 < seg.count; i2++) code.additionLines[seg.targetIndex + i2] = additionLines[seg.originalOffset + i2];
    else code.additionLines.push(...additionLines);
  }
  return {
    code,
    themeStyles,
    baseThemeType
  };
}
function computeLineDiffDecorations({ deletionLine, additionLine, deletionLineIndex, additionLineIndex, deletionDecorations, additionDecorations, lineDiffType, maxLineDiffLength }) {
  if (deletionLine == null || additionLine == null || lineDiffType === "none") return;
  deletionLine = cleanLastNewline(deletionLine);
  additionLine = cleanLastNewline(additionLine);
  if (deletionLine.length > maxLineDiffLength || additionLine.length > maxLineDiffLength) return;
  const lineDiff2 = lineDiffType === "char" ? diffChars(deletionLine, additionLine) : diffWordsWithSpace(deletionLine, additionLine);
  const deletionSpans = [];
  const additionSpans = [];
  const enableJoin = lineDiffType === "word-alt";
  const lastItem = lineDiff2.at(-1);
  for (const item of lineDiff2) {
    const isLastItem = item === lastItem;
    if (!item.added && !item.removed) {
      pushOrJoinSpan({
        item,
        arr: deletionSpans,
        enableJoin,
        isNeutral: true,
        isLastItem
      });
      pushOrJoinSpan({
        item,
        arr: additionSpans,
        enableJoin,
        isNeutral: true,
        isLastItem
      });
    } else if (item.removed) pushOrJoinSpan({
      item,
      arr: deletionSpans,
      enableJoin,
      isLastItem
    });
    else pushOrJoinSpan({
      item,
      arr: additionSpans,
      enableJoin,
      isLastItem
    });
  }
  let spanIndex = 0;
  for (const span of deletionSpans) {
    if (span[0] === 1) deletionDecorations.push(createDiffSpanDecoration({
      line: deletionLineIndex,
      spanStart: spanIndex,
      spanLength: span[1].length
    }));
    spanIndex += span[1].length;
  }
  spanIndex = 0;
  for (const span of additionSpans) {
    if (span[0] === 1) additionDecorations.push(createDiffSpanDecoration({
      line: additionLineIndex,
      spanStart: spanIndex,
      spanLength: span[1].length
    }));
    spanIndex += span[1].length;
  }
}
function createBucket() {
  return {
    deletionContent: {
      push(value) {
        this.value += value;
        this.length++;
      },
      value: "",
      length: 0
    },
    additionContent: {
      push(value) {
        this.value += value;
        this.length++;
      },
      value: "",
      length: 0
    },
    deletionInfo: [],
    additionInfo: [],
    deletionDecorations: [],
    additionDecorations: [],
    deletionSegments: [],
    additionSegments: []
  };
}
function renderTwoFiles({ deletionFile, additionFile, deletionInfo, additionInfo, highlighter: highlighter2, deletionDecorations, additionDecorations, languageOverride, options: { theme: themeOrThemes = DEFAULT_THEMES, ...options } }) {
  const deletionLang = languageOverride ?? getFiletypeFromFileName(deletionFile.name);
  const additionLang = languageOverride ?? getFiletypeFromFileName(additionFile.name);
  const { state, transformers } = createTransformerWithState(options.useTokenTransformer);
  const hastConfig = (() => {
    return typeof themeOrThemes === "string" ? {
      ...options,
      lang: "text",
      theme: themeOrThemes,
      transformers,
      decorations: void 0,
      defaultColor: false,
      cssVariablePrefix: formatCSSVariablePrefix("token")
    } : {
      ...options,
      lang: "text",
      themes: themeOrThemes,
      transformers,
      decorations: void 0,
      defaultColor: false,
      cssVariablePrefix: formatCSSVariablePrefix("token")
    };
  })();
  return {
    deletionLines: (() => {
      if (deletionFile.contents === "") return [];
      hastConfig.lang = deletionLang;
      state.lineInfo = deletionInfo;
      hastConfig.decorations = deletionDecorations;
      return getLineNodes(highlighter2.codeToHast(cleanLastNewline(deletionFile.contents), hastConfig));
    })(),
    additionLines: (() => {
      if (additionFile.contents === "") return [];
      hastConfig.lang = additionLang;
      hastConfig.decorations = additionDecorations;
      state.lineInfo = additionInfo;
      return getLineNodes(highlighter2.codeToHast(cleanLastNewline(additionFile.contents), hastConfig));
    })()
  };
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/highlighter/languages/getResolvedLanguages.js
function getResolvedLanguages(languages) {
  const resolvedLanguages = [];
  for (const language of languages) {
    const resolvedLanguage = ResolvedLanguages.get(language);
    if (resolvedLanguage == null) throw new Error(`getResolvedLanguages: ${language} is not resolved. Please resolve languages before calling getResolvedLanguages`);
    resolvedLanguages.push(resolvedLanguage);
  }
  return resolvedLanguages;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/highlighter/languages/hasResolvedLanguages.js
function hasResolvedLanguages(languages) {
  for (const language of Array.isArray(languages) ? languages : [languages]) if (!ResolvedLanguages.has(language)) return false;
  return true;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/highlighter/languages/resolveLanguages.js
async function resolveLanguages(languages) {
  const resolvedLanguages = [];
  const languagesToResolve = [];
  for (const language of languages) {
    if (language === "text" || language === "ansi") continue;
    const maybeResolvedLanguage = getResolvedOrResolveLanguage(language) ?? resolveLanguage(language);
    if ("then" in maybeResolvedLanguage) languagesToResolve.push(maybeResolvedLanguage);
    else resolvedLanguages.push(maybeResolvedLanguage);
  }
  if (languagesToResolve.length > 0) await Promise.all(languagesToResolve).then((_resolvedLanguages) => {
    for (const resolvedLanguage of _resolvedLanguages) {
      if (resolvedLanguage == null) throw new Error("resolvedLanguages: unable to resolve language");
      resolvedLanguages.push(resolvedLanguage);
    }
  });
  return resolvedLanguages;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/highlighter/themes/getResolvedThemes.js
function getResolvedThemes(themeNames) {
  const resolvedThemes = [];
  for (const themeName of themeNames) {
    const theme = ResolvedThemes.get(themeName);
    if (theme == null) throw new Error(`getAllResolvedThemes: ${themeName} is unresolved, you must resolve all necessary themes before calling this function`);
    resolvedThemes.push(theme);
  }
  return resolvedThemes;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/highlighter/themes/resolveThemes.js
async function resolveThemes2(themes) {
  const resolvedThemes = [];
  const themesToResolve = [];
  for (const themeName of themes) {
    const themeData = getResolvedOrResolveTheme(themeName) ?? resolveTheme(themeName);
    if ("then" in themeData) themesToResolve.push(themeData);
    else resolvedThemes.push(themeData);
  }
  if (themesToResolve.length > 0) await Promise.all(themesToResolve).then((resolved) => {
    for (const theme of resolved) if (theme != null) resolvedThemes.push(theme);
  });
  return resolvedThemes;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/worker/WorkerPoolManager.js
var import_lru_map = __toESM(require_lru(), 1);
var IGNORE_RESPONSE = Symbol("IGNORE_RESPONSE");
var WorkerPoolTerminatedError = class extends Error {
  constructor() {
    super("WorkerPoolManager: operation canceled because the pool terminated");
  }
};
var WorkerPoolManager = class {
  highlighter;
  preferredHighlighter;
  renderOptions;
  initialized = false;
  workers = [];
  taskQueue = /* @__PURE__ */ new Map();
  pendingTasks = /* @__PURE__ */ new Map();
  nextRequestId = 0;
  themeSubscribers = /* @__PURE__ */ new Set();
  workersFailed = false;
  instanceRequestMap = /* @__PURE__ */ new Map();
  statSubscribers = /* @__PURE__ */ new Set();
  fileCache;
  diffCache;
  _queuedBroadcast;
  lifecycleGeneration = 0;
  constructor(options, { langs, theme = DEFAULT_THEMES, useTokenTransformer = false, lineDiffType = "word-alt", maxLineDiffLength = 1e3, tokenizeMaxLineLength = 1e3, preferredHighlighter = "shiki-js" }) {
    this.options = options;
    this.preferredHighlighter = preferredHighlighter;
    this.renderOptions = {
      theme,
      useTokenTransformer,
      lineDiffType,
      maxLineDiffLength,
      tokenizeMaxLineLength
    };
    this.fileCache = new import_lru_map.default.LRUMap(options.totalASTLRUCacheSize ?? 100);
    this.diffCache = new import_lru_map.default.LRUMap(options.totalASTLRUCacheSize ?? 100);
    this.queueInitialization(langs);
  }
  isWorkingPool() {
    return !this.workersFailed;
  }
  getFileResultCache(file) {
    return file.cacheKey != null ? this.fileCache.get(file.cacheKey) : void 0;
  }
  getDiffResultCache(diff) {
    return diff.cacheKey != null ? this.diffCache.get(diff.cacheKey) : void 0;
  }
  inspectCaches() {
    const { fileCache, diffCache } = this;
    return {
      fileCache,
      diffCache
    };
  }
  evictFileFromCache(cacheKey) {
    try {
      return this.fileCache.delete(cacheKey) !== void 0;
    } finally {
      this.queueBroadcastStateChanges();
    }
  }
  evictDiffFromCache(cacheKey) {
    try {
      return this.diffCache.delete(cacheKey) !== void 0;
    } finally {
      this.queueBroadcastStateChanges();
    }
  }
  async setRenderOptions({ theme = DEFAULT_THEMES, useTokenTransformer = false, lineDiffType = "word-alt", maxLineDiffLength = 1e3, tokenizeMaxLineLength = 1e3 }) {
    const { lifecycleGeneration } = this;
    try {
      const newRenderOptions = {
        theme,
        useTokenTransformer,
        lineDiffType,
        maxLineDiffLength,
        tokenizeMaxLineLength
      };
      if (!this.isInitialized()) await this.initialize();
      if (!this.isCurrentLifecycle(lifecycleGeneration) || areDiffRenderOptionsEqual(newRenderOptions, this.renderOptions)) return;
      const themeNames = getThemes(theme);
      let resolvedThemes = [];
      if (!areThemesEqual(newRenderOptions.theme, this.renderOptions.theme)) if (hasResolvedThemes(themeNames)) resolvedThemes = getResolvedThemes(themeNames);
      else resolvedThemes = await resolveThemes2(themeNames);
      if (!this.isCurrentLifecycle(lifecycleGeneration)) return;
      if (this.highlighter != null) {
        attachResolvedThemes(resolvedThemes, this.highlighter);
        await this.setRenderOptionsOnWorkers(newRenderOptions, resolvedThemes);
      } else {
        const [highlighter2] = await Promise.all([getSharedHighlighter({
          themes: themeNames,
          langs: ["text"],
          preferredHighlighter: this.preferredHighlighter
        }), this.setRenderOptionsOnWorkers(newRenderOptions, resolvedThemes)]);
        if (!this.isCurrentLifecycle(lifecycleGeneration)) return;
        this.highlighter = highlighter2;
      }
      if (!this.isCurrentLifecycle(lifecycleGeneration)) return;
      this.renderOptions = newRenderOptions;
      this.diffCache.clear();
      this.fileCache.clear();
      for (const instance2 of this.themeSubscribers) instance2.rerender();
    } catch (error) {
      if (error instanceof WorkerPoolTerminatedError || !this.isCurrentLifecycle(lifecycleGeneration)) return;
      throw error;
    }
  }
  getFileRenderOptions() {
    const { tokenizeMaxLineLength, theme, useTokenTransformer } = this.renderOptions;
    return {
      theme,
      useTokenTransformer,
      tokenizeMaxLineLength
    };
  }
  getDiffRenderOptions() {
    return { ...this.renderOptions };
  }
  async setRenderOptionsOnWorkers(renderOptions, resolvedThemes) {
    if (this.workersFailed) return;
    if (!this.isInitialized()) await this.initialize();
    const taskPromises = [];
    for (const managedWorker of this.workers) {
      if (!managedWorker.initialized) {
        console.log({ managedWorker });
        throw new Error("setRenderOptionsOnWorkers: Somehow we have an uninitialized worker");
      }
      taskPromises.push(new Promise((resolve, reject) => {
        const id = this.generateRequestId();
        const task = {
          type: "set-render-options",
          id,
          request: {
            type: "set-render-options",
            id,
            renderOptions,
            resolvedThemes
          },
          resolve,
          reject,
          requestStart: Date.now()
        };
        this.pendingTasks.set(id, task);
        managedWorker.worker.postMessage(task.request);
      }));
    }
    await Promise.all(taskPromises);
  }
  subscribeToThemeChanges(instance2) {
    this.themeSubscribers.add(instance2);
    this.queueBroadcastStateChanges();
    return () => {
      this.unsubscribeToThemeChanges(instance2);
      this.queueBroadcastStateChanges();
    };
  }
  unsubscribeToThemeChanges(instance2) {
    this.themeSubscribers.delete(instance2);
    this.queueBroadcastStateChanges();
  }
  subscribeToStatChanges(callback) {
    this.statSubscribers.add(callback);
    callback(this.getStats());
    return () => {
      this.statSubscribers.delete(callback);
    };
  }
  queueBroadcastStateChanges() {
    if (this._queuedBroadcast != null) return;
    this._queuedBroadcast = requestAnimationFrame(this._broadcastStateChanges);
  }
  _broadcastStateChanges = () => {
    if (this._queuedBroadcast != null) {
      cancelAnimationFrame(this._queuedBroadcast);
      this._queuedBroadcast = void 0;
    }
    const stats = this.getStats();
    for (const callback of this.statSubscribers) callback(stats);
  };
  cleanUpPendingTasks(instance2) {
    this.taskQueue.delete(instance2);
    const requestId = this.instanceRequestMap.get(instance2);
    if (requestId != null) {
      this.pendingTasks.delete(requestId);
      this.instanceRequestMap.delete(instance2);
    }
    this.queueBroadcastStateChanges();
  }
  isInitialized() {
    return this.initialized === true;
  }
  async initialize(languages = []) {
    if (this.initialized === true) return;
    else if (this.initialized === false) {
      const { lifecycleGeneration } = this;
      this.initialized = new Promise((resolve, reject) => {
        (async () => {
          try {
            const themes = getThemes(this.renderOptions.theme);
            let resolvedThemes = [];
            if (hasResolvedThemes(themes)) resolvedThemes = getResolvedThemes(themes);
            else resolvedThemes = await resolveThemes2(themes);
            if (!this.isCurrentLifecycle(lifecycleGeneration)) {
              resolve();
              return;
            }
            let resolvedLanguages = [];
            if (hasResolvedLanguages(languages)) resolvedLanguages = getResolvedLanguages(languages);
            else resolvedLanguages = await resolveLanguages(languages);
            if (!this.isCurrentLifecycle(lifecycleGeneration)) {
              resolve();
              return;
            }
            const [highlighter2] = await Promise.all([getSharedHighlighter({
              themes,
              langs: ["text", ...languages],
              preferredHighlighter: this.preferredHighlighter
            }), this.initializeWorkers(resolvedThemes, resolvedLanguages)]);
            if (!this.isCurrentLifecycle(lifecycleGeneration)) {
              this.terminateWorkers();
              resolve();
              return;
            }
            this.highlighter = highlighter2;
            this.initialized = true;
            this.diffCache.clear();
            this.fileCache.clear();
            this.drainQueue();
            this.queueBroadcastStateChanges();
            resolve();
          } catch (e) {
            if (e instanceof WorkerPoolTerminatedError || !this.isCurrentLifecycle(lifecycleGeneration)) {
              resolve();
              return;
            }
            this.initialized = false;
            this.workersFailed = true;
            this.queueBroadcastStateChanges();
            reject(e);
          }
        })();
      });
      this.queueBroadcastStateChanges();
    } else return this.initialized;
  }
  async initializeWorkers(resolvedThemes, resolvedLanguages) {
    this.workersFailed = false;
    const initPromises = [];
    const customExtensionVersion = getCustomExtensionsVersion();
    const customExtensionMap = customExtensionVersion > 0 ? getCustomExtensionsMap() : void 0;
    if (this.workers.length > 0) this.terminateWorkers();
    for (let i2 = 0; i2 < (this.options.poolSize ?? 8); i2++) {
      const worker = this.options.workerFactory();
      const managedWorker = {
        worker,
        request_id: void 0,
        initialized: false,
        langs: /* @__PURE__ */ new Set(["text", ...resolvedLanguages.map(({ name }) => name)]),
        customExtensionsVersion: 0
      };
      worker.addEventListener("message", (event) => {
        this.handleWorkerMessage(managedWorker, event.data);
      });
      worker.addEventListener("error", (error) => console.error("Worker error:", error, managedWorker));
      this.workers.push(managedWorker);
      initPromises.push(new Promise((resolve, reject) => {
        const id = this.generateRequestId();
        const task = {
          type: "initialize",
          id,
          request: {
            type: "initialize",
            id,
            renderOptions: this.renderOptions,
            preferredHighlighter: this.preferredHighlighter,
            resolvedThemes,
            resolvedLanguages,
            customExtensionsVersion: customExtensionMap != null ? customExtensionVersion : void 0,
            customExtensionMap
          },
          resolve() {
            managedWorker.initialized = true;
            resolve();
          },
          reject,
          requestStart: Date.now()
        };
        this.pendingTasks.set(id, task);
        this.executeTask(managedWorker, task);
      }));
    }
    await Promise.all(initPromises);
  }
  drainQueue = () => {
    this._queuedDrain = void 0;
    if (this.initialized !== true || this.taskQueue.size === 0) return;
    for (const [instance2, task] of this.taskQueue) {
      if (this.instanceRequestMap.has(instance2)) continue;
      const langs = getLangsFromTask(task);
      const availableWorker = this.getAvailableWorker(langs);
      if (availableWorker == null) break;
      this.assignWorkerToTask(task, availableWorker);
      this.resolveLanguagesAndExecuteTask(availableWorker, task, langs);
    }
    this.queueBroadcastStateChanges();
  };
  highlightFileAST(instance2, file) {
    if (isFilePlainText(file)) return;
    for (const tasks of [this.taskQueue, this.pendingTasks.values()]) for (const task of tasks) if ("instance" in task && task.instance === instance2 && task.request.type === "file" && areFilesEqual(file, task.request.file)) return;
    this.submitTask(instance2, {
      type: "file",
      file
    });
  }
  getPlainFileAST(file, startingLine, totalLines, lines) {
    if (this.highlighter == null) {
      this.queueInitialization();
      return;
    }
    return renderFileWithHighlighter(file, this.highlighter, this.renderOptions, {
      forcePlainText: true,
      startingLine,
      totalLines,
      lines
    });
  }
  highlightDiffAST(instance2, diff) {
    if (isDiffPlainText(diff)) return;
    for (const tasks of [this.taskQueue, this.pendingTasks.values()]) for (const task of tasks) if ("instance" in task && task.instance === instance2 && task.request.type === "diff" && task.request.diff === diff) return;
    this.submitTask(instance2, {
      type: "diff",
      diff
    });
  }
  getPlainDiffAST(diff, startingLine, totalLines, expandedHunks, collapsedContextThreshold) {
    return this.highlighter != null ? renderDiffWithHighlighter(diff, this.highlighter, this.renderOptions, {
      forcePlainText: true,
      startingLine,
      totalLines,
      expandedHunks,
      collapsedContextThreshold
    }) : void 0;
  }
  terminate() {
    this.lifecycleGeneration++;
    this.cancelPendingAsyncWorkerTasks();
    this.terminateWorkers();
    this.fileCache.clear();
    this.diffCache.clear();
    this.instanceRequestMap.clear();
    this.taskQueue.clear();
    this.pendingTasks.clear();
    this.highlighter = void 0;
    this.initialized = false;
    this.workersFailed = false;
    this.queueBroadcastStateChanges();
  }
  isCurrentLifecycle(lifecycleGeneration) {
    return this.lifecycleGeneration === lifecycleGeneration;
  }
  queueInitialization(languages) {
    this.initialize(languages).catch((error) => {
      console.error(error);
    });
  }
  cancelPendingAsyncWorkerTasks() {
    const error = new WorkerPoolTerminatedError();
    for (const task of this.pendingTasks.values()) if ("reject" in task) task.reject(error);
  }
  terminateWorkers() {
    for (const managedWorker of this.workers) managedWorker.worker.terminate();
    this.workers.length = 0;
  }
  getStats() {
    return {
      managerState: (() => {
        if (this.initialized === false) return "waiting";
        if (this.initialized !== true) return "initializing";
        return "initialized";
      })(),
      totalWorkers: this.workers.length,
      workersFailed: this.workersFailed,
      busyWorkers: this.workers.filter((w3) => w3.request_id != null).length,
      queuedTasks: this.taskQueue.size,
      pendingTasks: this.pendingTasks.size,
      themeSubscribers: this.themeSubscribers.size,
      fileCacheSize: this.fileCache.size,
      diffCacheSize: this.diffCache.size
    };
  }
  submitTask(instance2, request) {
    if (this.initialized === false) this.queueInitialization();
    const id = this.generateRequestId();
    const requestStart = Date.now();
    const task = (() => {
      switch (request.type) {
        case "file":
          return {
            type: "file",
            id,
            request: {
              ...request,
              id
            },
            instance: instance2,
            requestStart
          };
        case "diff":
          return {
            type: "diff",
            id,
            request: {
              ...request,
              id
            },
            instance: instance2,
            requestStart
          };
      }
    })();
    this.taskQueue.set(instance2, task);
    this.queueDrain();
  }
  async resolveLanguagesAndExecuteTask(availableWorker, task, langs) {
    try {
      const workerMissingLangs = langs.filter((lang) => !availableWorker.langs.has(lang));
      if (workerMissingLangs.length > 0) if (hasResolvedLanguages(workerMissingLangs)) task.request.resolvedLanguages = getResolvedLanguages(workerMissingLangs);
      else task.request.resolvedLanguages = await resolveLanguages(workerMissingLangs);
      this.executeTask(availableWorker, task);
    } catch {
      this.cleanWorkerAndTask(availableWorker, task);
    }
  }
  handleWorkerMessage(managedWorker, response) {
    const task = this.pendingTasks.get(response.id);
    try {
      if (task == null) throw IGNORE_RESPONSE;
      else if (response.type === "error") {
        const error = new Error(response.error);
        if (response.stack) error.stack = response.stack;
        if ("reject" in task) task.reject(error);
        else task.instance.onHighlightError(error);
        throw error;
      } else {
        if ("instance" in task && this.instanceRequestMap.get(task.instance) !== response.id) throw IGNORE_RESPONSE;
        switch (response.requestType) {
          case "initialize":
            if (task.type !== "initialize") throw new Error("handleWorkerMessage: task/response dont match");
            this.syncCustomExtensionVersion(managedWorker, task.request);
            task.resolve();
            break;
          case "set-render-options":
            if (task.type !== "set-render-options") throw new Error("handleWorkerMessage: task/response dont match");
            task.resolve();
            break;
          case "file": {
            if (task.type !== "file") throw new Error("handleWorkerMessage: task/response dont match");
            const { result, options } = response;
            const { instance: instance2, request } = task;
            this.syncCustomExtensionVersion(managedWorker, request);
            if (request.file.cacheKey != null) this.fileCache.set(request.file.cacheKey, {
              result,
              options
            });
            instance2.onHighlightSuccess(request.file, result, options);
            break;
          }
          case "diff": {
            if (task.type !== "diff") throw new Error("handleWorkerMessage: task/response dont match");
            const { result, options } = response;
            const { instance: instance2, request } = task;
            this.syncCustomExtensionVersion(managedWorker, request);
            if (request.diff.cacheKey != null) this.diffCache.set(request.diff.cacheKey, {
              result,
              options
            });
            instance2.onHighlightSuccess(request.diff, result, options);
            break;
          }
        }
      }
    } catch (error) {
      if (error !== IGNORE_RESPONSE) console.error(error, task, response);
    }
    this.cleanWorkerAndTask(managedWorker, task);
    this.queueBroadcastStateChanges();
    if (this.taskQueue.size > 0) this.queueDrain();
  }
  _queuedDrain;
  queueDrain() {
    if (this._queuedDrain != null) return;
    this._queuedDrain = Promise.resolve().then(this.drainQueue);
    this.queueBroadcastStateChanges();
  }
  assignWorkerToTask(task, managedWorker) {
    managedWorker.request_id = task.id;
    if ("instance" in task) {
      this.taskQueue.delete(task.instance);
      this.instanceRequestMap.set(task.instance, task.id);
    }
    this.pendingTasks.set(task.id, task);
  }
  cleanWorkerAndTask(managedWorker, task) {
    managedWorker.request_id = void 0;
    if (task != null) {
      if ("instance" in task) this.instanceRequestMap.delete(task.instance);
      this.pendingTasks.delete(task.id);
    }
  }
  executeTask(managedWorker, task) {
    if (shouldSyncCustomExtensions(task.request)) this.maybeAttachCustomExtensions(managedWorker, task.request);
    this.assignWorkerToTask(task, managedWorker);
    for (const lang of getLangsFromTask(task)) managedWorker.langs.add(lang);
    try {
      managedWorker.worker.postMessage(task.request);
    } catch (error) {
      this.cleanWorkerAndTask(managedWorker, task);
      console.error("Failed to post message to worker:", error);
      if ("instance" in task) task.instance.onHighlightError(error);
      else if ("reject" in task) task.reject(error);
    }
    this.queueBroadcastStateChanges();
  }
  maybeAttachCustomExtensions(managedWorker, request) {
    if (request.customExtensionsVersion != null) return;
    const version = getCustomExtensionsVersion();
    if (managedWorker.customExtensionsVersion >= version) return;
    request.customExtensionsVersion = version;
    request.customExtensionMap = getCustomExtensionsMap();
  }
  syncCustomExtensionVersion(managedWorker, request) {
    if (request.customExtensionsVersion == null) return;
    managedWorker.customExtensionsVersion = request.customExtensionsVersion;
  }
  getAvailableWorker(langs) {
    let worker;
    for (const managedWorker of this.workers) {
      if (managedWorker.request_id != null || !managedWorker.initialized) continue;
      worker = managedWorker;
      if (langs.length === 0) break;
      let hasEveryLang = true;
      for (const lang of langs) if (!managedWorker.langs.has(lang)) {
        hasEveryLang = false;
        break;
      }
      if (hasEveryLang) break;
    }
    return worker;
  }
  generateRequestId() {
    return `req_${++this.nextRequestId}`;
  }
};
function shouldSyncCustomExtensions(request) {
  return request.type === "initialize" || request.type === "file" || request.type === "diff";
}
function getLangsFromTask(task) {
  const langs = /* @__PURE__ */ new Set();
  if (task.type === "initialize" || task.type === "set-render-options") return [];
  switch (task.type) {
    case "file":
      langs.add(task.request.file.lang ?? getFiletypeFromFileName(task.request.file.name));
      break;
    case "diff":
      langs.add(task.request.diff.lang ?? getFiletypeFromFileName(task.request.diff.name));
      langs.add(task.request.diff.lang ?? getFiletypeFromFileName(task.request.diff.prevName ?? "-"));
      break;
  }
  langs.delete("text");
  return Array.from(langs);
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/worker/getOrCreateWorkerPoolSingleton.js
var workerPoolSingleton;
function getOrCreateWorkerPoolSingleton({ poolOptions, highlighterOptions }) {
  workerPoolSingleton ??= new WorkerPoolManager(poolOptions, highlighterOptions);
  return workerPoolSingleton;
}
function terminateWorkerPoolSingleton() {
  if (workerPoolSingleton == null) return;
  workerPoolSingleton.terminate();
  workerPoolSingleton = void 0;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/react/WorkerPoolContext.js
init_neon_pilot_shared_react();
var WorkerPoolContext = createContext(void 0);
var instanceCount = 0;
function WorkerPoolContextProvider({ children, poolOptions, highlighterOptions }) {
  const [poolManager] = useState(() => {
    if (typeof window === "undefined") return;
    return getOrCreateWorkerPoolSingleton({
      poolOptions,
      highlighterOptions
    });
  });
  useInsertionEffect(() => {
    if (poolManager != null) {
      instanceCount++;
      return () => {
        instanceCount--;
      };
    }
  }, [poolManager]);
  useEffect(() => {
    return () => {
      if (instanceCount === 0) terminateWorkerPoolSingleton();
    };
  }, []);
  return /* @__PURE__ */ jsx(WorkerPoolContext.Provider, {
    value: poolManager,
    children
  });
}
function useWorkerPool() {
  return useContext(WorkerPoolContext);
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/react/utils/useStableCallback.js
init_neon_pilot_shared_react();
function useStableCallback(callback) {
  const callbackRef = useRef(callback);
  useInsertionEffect(() => void (callbackRef.current = callback));
  return useCallback((...args) => {
    return callbackRef.current(...args);
  }, []);
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/areSelectionPointsEqual.js
function areSelectionPointsEqual(a2, b3) {
  return a2.lineNumber === b3.lineNumber && a2.side === b3.side;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/areSelectionsEqual.js
function areSelectionsEqual(selectionA, selectionB) {
  return selectionA?.start === selectionB?.start && selectionA?.end === selectionB?.end && selectionA?.side === selectionB?.side && selectionA?.endSide === selectionB?.endSide;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/createGutterUtilityElement.js
function createGutterUtilityElement() {
  return createHastElement({
    tagName: "button",
    properties: {
      "data-utility-button": "",
      type: "button"
    },
    children: [createIconElement({
      name: "diffs-icon-plus",
      properties: { "data-icon": "" }
    })]
  });
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/managers/InteractionManager.js
var InteractionManager = class {
  hoveredLine;
  hoveredToken;
  pre;
  gutterUtilityContainer;
  gutterUtilityButton;
  gutterUtilitySlot;
  interactiveLinesAttr = false;
  interactiveLineNumbersAttr = false;
  hasPointerListeners = false;
  hasDocumentPointerListeners = false;
  selectedRange = null;
  renderedSelectionRange;
  selectionAnchor;
  queuedSelectionRender;
  pointerSession = { mode: "idle" };
  constructor(mode, options) {
    this.mode = mode;
    this.options = options;
  }
  setOptions(options) {
    this.options = options;
  }
  cleanUp() {
    this.pre?.removeEventListener("click", this.handlePointerClick);
    this.pre?.removeEventListener("pointerdown", this.handlePointerDown);
    this.pre?.removeEventListener("pointermove", this.handlePointerMove);
    this.pre?.removeEventListener("pointerleave", this.handlePointerLeave);
    this.pre?.removeAttribute("data-interactive-lines");
    this.pre?.removeAttribute("data-interactive-line-numbers");
    this.pre = void 0;
    this.gutterUtilityContainer?.remove();
    this.gutterUtilityContainer = void 0;
    this.gutterUtilityButton = void 0;
    this.gutterUtilitySlot = void 0;
    this.clearHoveredLine();
    this.clearHoveredToken();
    this.detachDocumentPointerListeners();
    this.clearPointerSession();
    if (this.queuedSelectionRender != null) {
      cancelAnimationFrame(this.queuedSelectionRender);
      this.queuedSelectionRender = void 0;
    }
    this.interactiveLinesAttr = false;
    this.interactiveLineNumbersAttr = false;
    this.hasPointerListeners = false;
  }
  setup(pre) {
    this.setSelectionDirty();
    const { usesCustomGutterUtility = false, enableGutterUtility = false } = this.options;
    if (this.pre !== pre) {
      this.cleanUp();
      this.pre = pre;
    }
    if (enableGutterUtility) this.ensureGutterUtilityNode(usesCustomGutterUtility);
    else if (this.gutterUtilityContainer != null) {
      this.gutterUtilityContainer.remove();
      this.gutterUtilityContainer = void 0;
      this.gutterUtilityButton = void 0;
      this.gutterUtilitySlot = void 0;
      if (this.pointerSession.mode === "gutterSelecting") {
        this.clearPointerSession();
        this.detachDocumentPointerListeners();
      }
    }
    this.syncPointerListeners(pre);
    this.updateInteractiveLineAttributes();
    this.renderSelection();
  }
  setSelectionDirty() {
    this.renderedSelectionRange = void 0;
  }
  isSelectionDirty() {
    return this.renderedSelectionRange === null;
  }
  setSelection(range2) {
    const isRangeChange = !(range2 === this.selectedRange || areSelectionsEqual(range2 ?? void 0, this.selectedRange ?? void 0));
    if (!this.isSelectionDirty() && !isRangeChange) return;
    this.selectedRange = range2;
    this.renderSelection();
    if (isRangeChange) this.notifySelectionCommitted();
  }
  getSelection() {
    return this.selectedRange;
  }
  getHoveredLine = () => {
    if (this.hoveredLine != null) {
      if (this.mode === "diff" && this.hoveredLine.type === "diff-line") return {
        lineNumber: this.hoveredLine.lineNumber,
        side: this.hoveredLine.annotationSide
      };
      if (this.mode === "file" && this.hoveredLine.type === "line") return { lineNumber: this.hoveredLine.lineNumber };
    }
  };
  handlePointerClick = (event) => {
    const { onHunkExpand, onLineClick, onLineNumberClick, onTokenClick, onMergeConflictActionClick } = this.options;
    if (onHunkExpand == null && onLineClick == null && onLineNumberClick == null && onMergeConflictActionClick == null && onTokenClick == null) return;
    if (this.options.onGutterUtilityClick != null && isGutterUtilityPointerPath(event.composedPath())) return;
    debugLogIfEnabled(this.options.__debugPointerEvents, "click", "FileDiff.DEBUG.handlePointerClick:", event);
    this.handlePointerEvent({
      eventType: "click",
      event
    });
  };
  handlePointerMove = (event) => {
    const { lineHoverHighlight = "disabled", onLineEnter, onLineLeave, onTokenEnter, onTokenLeave, enableGutterUtility = false } = this.options;
    if (lineHoverHighlight === "disabled" && !enableGutterUtility && onLineEnter == null && onLineLeave == null && onTokenEnter == null && onTokenLeave == null) return;
    debugLogIfEnabled(this.options.__debugPointerEvents, "move", "FileDiff.DEBUG.handlePointerMove:", event);
    this.handlePointerEvent({
      eventType: "move",
      event
    });
  };
  handlePointerLeave = (event) => {
    const { __debugPointerEvents } = this.options;
    debugLogIfEnabled(__debugPointerEvents, "move", "FileDiff.DEBUG.handlePointerLeave: no event");
    if (this.hoveredLine == null && this.hoveredToken == null) {
      debugLogIfEnabled(__debugPointerEvents, "move", "FileDiff.DEBUG.handlePointerLeave: returned early, no hovered line or token");
      return;
    }
    this.gutterUtilityContainer?.remove();
    if (this.hoveredToken != null) {
      this.options.onTokenLeave?.(this.hoveredToken, event);
      this.clearHoveredToken();
    }
    if (this.hoveredLine != null) {
      this.options.onLineLeave?.({
        ...this.hoveredLine,
        event
      });
      this.clearHoveredLine();
    }
  };
  handlePointerEvent({ eventType, event }) {
    const { __debugPointerEvents } = this.options;
    const composedPath = event.composedPath();
    debugLogIfEnabled(__debugPointerEvents, eventType, "FileDiff.DEBUG.handlePointerEvent:", {
      eventType,
      composedPath
    });
    const target = this.resolvePointerTarget(composedPath);
    debugLogIfEnabled(__debugPointerEvents, eventType, "FileDiff.DEBUG.handlePointerEvent: resolvePointerTarget result:", target);
    const { onLineClick, onLineNumberClick, onLineEnter, onLineLeave, onTokenClick, onTokenEnter, onTokenLeave, onHunkExpand, onMergeConflictActionClick } = this.options;
    switch (eventType) {
      case "move": {
        const sameLine = isHoverableLinePointerTarget(target) && this.hoveredLine?.lineElement === target.lineElement;
        if (!(isTokenPointerTarget(target) && this.hoveredToken?.tokenElement === target.tokenElement)) {
          if (this.hoveredToken != null) {
            onTokenLeave?.(this.hoveredToken, event);
            this.clearHoveredToken();
          }
          if (isTokenPointerTarget(target)) {
            this.setHoveredToken(this.toTokenEventBaseProps(target));
            onTokenEnter?.(this.hoveredToken, event);
          }
        }
        if (!sameLine) {
          if (this.hoveredLine != null) {
            this.gutterUtilityContainer?.remove();
            onLineLeave?.({
              ...this.hoveredLine,
              event
            });
            this.clearHoveredLine();
          }
          if (isHoverableLinePointerTarget(target)) {
            this.setHoveredLine(this.toEventBaseProps(target));
            if (this.gutterUtilityContainer != null) target.numberElement.appendChild(this.gutterUtilityContainer);
            onLineEnter?.({
              ...this.hoveredLine,
              event
            });
          }
        }
        break;
      }
      case "click": {
        if (target == null) break;
        if (isMergeConflictActionPointerTarget(target) && onMergeConflictActionClick != null) {
          onMergeConflictActionClick(target);
          break;
        }
        if (isExpandoPointerTarget(target) && onHunkExpand != null) {
          onHunkExpand(target.hunkIndex, target.all || event.shiftKey ? "both" : target.direction, target.all || event.shiftKey ? Number.POSITIVE_INFINITY : void 0);
          break;
        }
        if (!isHoverableLinePointerTarget(target)) break;
        if (isTokenPointerTarget(target) && onTokenClick != null) onTokenClick(this.toTokenEventBaseProps(target), event);
        const eventBase = this.toEventBaseProps(target);
        if (onLineNumberClick != null && target.numberColumn) onLineNumberClick({
          ...eventBase,
          event
        });
        else if (onLineClick != null) onLineClick({
          ...eventBase,
          event
        });
        break;
      }
    }
  }
  syncPointerListeners(pre) {
    const { __debugPointerEvents, lineHoverHighlight = "disabled", onLineClick, onLineNumberClick, onLineEnter, onLineLeave, onTokenClick, onTokenEnter, onTokenLeave, onHunkExpand, onMergeConflictActionClick, enableGutterUtility = false, enableLineSelection = false, onGutterUtilityClick } = this.options;
    const enableGutterSelection = onGutterUtilityClick != null;
    const shouldAttachPointerListeners = lineHoverHighlight !== "disabled" || onLineClick != null || onLineNumberClick != null || onLineEnter != null || onLineLeave != null || onTokenClick != null || onTokenEnter != null || onTokenLeave != null || onHunkExpand != null || onMergeConflictActionClick != null || enableGutterUtility || enableLineSelection || enableGutterSelection;
    if (shouldAttachPointerListeners && !this.hasPointerListeners) {
      pre.addEventListener("click", this.handlePointerClick);
      pre.addEventListener("pointerdown", this.handlePointerDown);
      pre.addEventListener("pointermove", this.handlePointerMove);
      pre.addEventListener("pointerleave", this.handlePointerLeave);
      this.hasPointerListeners = true;
      debugLogIfEnabled(__debugPointerEvents, "click", "FileDiff.DEBUG.attachEventListeners: Attaching click events for:", (() => {
        const reasons = [];
        if (__debugPointerEvents === "both" || __debugPointerEvents === "click") {
          if (onLineClick != null) reasons.push("onLineClick");
          if (onLineNumberClick != null) reasons.push("onLineNumberClick");
          if (onHunkExpand != null) reasons.push("expandable hunk separators");
          if (onMergeConflictActionClick != null) reasons.push("merge conflict actions");
        }
        return reasons;
      })());
      debugLogIfEnabled(__debugPointerEvents, "move", "FileDiff.DEBUG.attachEventListeners: Attaching pointer move event");
      debugLogIfEnabled(__debugPointerEvents, "move", "FileDiff.DEBUG.attachEventListeners: Attaching pointer leave event");
    } else if (!shouldAttachPointerListeners && this.hasPointerListeners) {
      pre.removeEventListener("click", this.handlePointerClick);
      pre.removeEventListener("pointerdown", this.handlePointerDown);
      pre.removeEventListener("pointermove", this.handlePointerMove);
      pre.removeEventListener("pointerleave", this.handlePointerLeave);
      this.hasPointerListeners = false;
    }
    const hasActiveLineSelectionSession = this.pointerSession.mode === "selecting" || this.pointerSession.mode === "pendingSingleLineUnselect";
    const hasActiveGutterSelectionSession = this.pointerSession.mode === "gutterSelecting";
    if (!enableLineSelection && hasActiveLineSelectionSession || !enableGutterSelection && hasActiveGutterSelectionSession) {
      this.clearPointerSession();
      this.detachDocumentPointerListeners();
      this.selectionAnchor = void 0;
      this.clearPendingSingleLineState();
    }
  }
  updateInteractiveLineAttributes() {
    if (this.pre == null) return;
    const { onLineClick, onLineNumberClick, enableLineSelection = false } = this.options;
    const shouldHaveInteractiveLines = onLineClick != null;
    const shouldHaveInteractiveLineNumbers = onLineNumberClick != null || enableLineSelection;
    if (shouldHaveInteractiveLines && !this.interactiveLinesAttr) {
      this.pre.setAttribute("data-interactive-lines", "");
      this.interactiveLinesAttr = true;
    } else if (!shouldHaveInteractiveLines && this.interactiveLinesAttr) {
      this.pre.removeAttribute("data-interactive-lines");
      this.interactiveLinesAttr = false;
    }
    if (shouldHaveInteractiveLineNumbers && !this.interactiveLineNumbersAttr) {
      this.pre.setAttribute("data-interactive-line-numbers", "");
      this.interactiveLineNumbersAttr = true;
    } else if (!shouldHaveInteractiveLineNumbers && this.interactiveLineNumbersAttr) {
      this.pre.removeAttribute("data-interactive-line-numbers");
      this.interactiveLineNumbersAttr = false;
    }
  }
  handlePointerDown = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0 || this.pre == null || this.pointerSession.mode !== "idle") return;
    const path = event.composedPath();
    if (isGutterUtilityPointerPath(path) && this.options.onGutterUtilityClick != null) this.startGutterSelectionFromPointerDown(event, path);
    else this.startLineSelectionFromPointerDown(event, path);
  };
  startLineSelectionFromPointerDown(event, path) {
    const { enableLineSelection = false } = this.options;
    if (!enableLineSelection) return;
    const pointerInfo = this.getSelectionPointerInfo(path, true);
    if (pointerInfo == null) return;
    const { pre } = this;
    if (pre == null) return;
    event.preventDefault();
    const { lineNumber, eventSide, lineIndex } = pointerInfo;
    if (event.shiftKey && this.selectedRange != null) {
      const rowRange = this.getIndexesFromSelection(this.selectedRange, pre.getAttribute("data-diff-type") === "split");
      if (rowRange == null) return;
      const useStart = rowRange.start <= rowRange.end ? lineIndex >= rowRange.start : lineIndex <= rowRange.end;
      this.selectionAnchor = {
        lineNumber: useStart ? this.selectedRange.start : this.selectedRange.end,
        side: useStart ? this.selectedRange.side : this.selectedRange.endSide ?? this.selectedRange.side
      };
      this.updateSelection(lineNumber, eventSide, false);
      this.notifySelectionStart(this.selectedRange);
      this.pointerSession = {
        mode: "selecting",
        pointerId: event.pointerId
      };
      this.attachDocumentPointerListeners();
      return;
    }
    if (this.selectedRange?.start === lineNumber && this.selectedRange?.end === lineNumber) {
      const point = {
        lineNumber,
        side: eventSide
      };
      this.selectionAnchor = point;
      this.pointerSession = {
        mode: "pendingSingleLineUnselect",
        pointerId: event.pointerId,
        anchor: point,
        pending: point
      };
      this.attachDocumentPointerListeners();
      return;
    }
    this.selectedRange = null;
    this.selectionAnchor = {
      lineNumber,
      side: eventSide
    };
    this.updateSelection(lineNumber, eventSide, false);
    this.notifySelectionStart(this.selectedRange);
    this.pointerSession = {
      mode: "selecting",
      pointerId: event.pointerId
    };
    this.attachDocumentPointerListeners();
  }
  startGutterSelectionFromPointerDown(event, path) {
    const { enableLineSelection = false, onGutterUtilityClick } = this.options;
    if (onGutterUtilityClick == null) return;
    const point = this.getSelectionPointFromPath(path);
    if (point == null) return;
    event.preventDefault();
    event.stopPropagation();
    this.pointerSession = {
      mode: "gutterSelecting",
      pointerId: event.pointerId,
      anchor: point,
      current: point
    };
    if (enableLineSelection) {
      this.selectionAnchor = {
        lineNumber: point.lineNumber,
        side: point.side
      };
      this.updateSelection(point.lineNumber, point.side, false);
      this.notifySelectionStart(this.selectedRange);
    }
    this.attachDocumentPointerListeners();
  }
  handleDocumentPointerMove = (event) => {
    const { enableLineSelection = false } = this.options;
    switch (this.pointerSession.mode) {
      case "idle":
        return;
      case "gutterSelecting": {
        if (event.pointerId !== this.pointerSession.pointerId) return;
        const point = this.getSelectionPointFromPath(event.composedPath());
        if (point == null) return;
        this.pointerSession.current = point;
        if (enableLineSelection === true) this.updateSelection(point.lineNumber, point.side);
        return;
      }
      case "selecting": {
        if (event.pointerId !== this.pointerSession.pointerId) return;
        const pointerInfo = this.getSelectionPointerInfo(event.composedPath(), false);
        if (pointerInfo == null || this.selectionAnchor == null) return;
        this.updateSelection(pointerInfo.lineNumber, pointerInfo.eventSide);
        return;
      }
      case "pendingSingleLineUnselect": {
        if (event.pointerId !== this.pointerSession.pointerId) return;
        const pointerInfo = this.getSelectionPointerInfo(event.composedPath(), false);
        if (pointerInfo == null || this.selectionAnchor == null) return;
        const point = {
          lineNumber: pointerInfo.lineNumber,
          side: pointerInfo.eventSide
        };
        if (areSelectionPointsEqual(this.pointerSession.pending, point)) return;
        this.updateSelection(pointerInfo.lineNumber, pointerInfo.eventSide, false);
        this.notifySelectionStart(this.selectedRange);
        this.notifySelectionChangeDelta();
        this.pointerSession = {
          mode: "selecting",
          pointerId: event.pointerId
        };
        return;
      }
    }
  };
  handleDocumentPointerUp = (event) => {
    const { enableLineSelection = false, onGutterUtilityClick } = this.options;
    switch (this.pointerSession.mode) {
      case "idle":
        return;
      case "gutterSelecting": {
        if (event.pointerId !== this.pointerSession.pointerId) return;
        const point = this.getSelectionPointFromPath(event.composedPath());
        if (point != null) {
          this.pointerSession.current = point;
          if (enableLineSelection) this.updateSelection(point.lineNumber, point.side);
        }
        onGutterUtilityClick?.(this.buildSelectedLineRange(this.pointerSession.anchor, this.pointerSession.current));
        this.selectionAnchor = void 0;
        if (enableLineSelection) {
          this.notifySelectionEnd(this.selectedRange);
          this.notifySelectionCommitted();
        }
        this.clearPointerSession();
        this.detachDocumentPointerListeners();
        return;
      }
      case "pendingSingleLineUnselect":
        if (event.pointerId !== this.pointerSession.pointerId) return;
        this.updateSelection(null, void 0, false);
        this.selectionAnchor = void 0;
        this.clearPendingSingleLineState();
        this.detachDocumentPointerListeners();
        this.notifySelectionEnd(this.selectedRange);
        this.notifySelectionCommitted();
        return;
      case "selecting":
        if (event.pointerId !== this.pointerSession.pointerId) return;
        this.selectionAnchor = void 0;
        this.detachDocumentPointerListeners();
        this.clearPointerSession();
        this.notifySelectionEnd(this.selectedRange);
        this.notifySelectionCommitted();
    }
  };
  handleDocumentPointerCancel = (event) => {
    switch (this.pointerSession.mode) {
      case "idle":
        return;
      case "gutterSelecting":
      case "selecting":
      case "pendingSingleLineUnselect":
        if ("pointerId" in this.pointerSession) {
          if (event.pointerId !== this.pointerSession.pointerId) return;
        }
        this.selectionAnchor = void 0;
        this.clearPendingSingleLineState();
        this.clearPointerSession();
        this.detachDocumentPointerListeners();
    }
  };
  clearHoveredLine() {
    if (this.hoveredLine == null) return;
    this.hoveredLine.lineElement.removeAttribute("data-hovered");
    this.hoveredLine.numberElement.removeAttribute("data-hovered");
    this.hoveredLine = void 0;
  }
  setHoveredLine(hoveredLine) {
    const { lineHoverHighlight = "disabled" } = this.options;
    if (this.hoveredLine != null) this.clearHoveredLine();
    this.hoveredLine = hoveredLine;
    if (lineHoverHighlight !== "disabled") {
      if (lineHoverHighlight === "both" || lineHoverHighlight === "line") this.hoveredLine.lineElement.setAttribute("data-hovered", "");
      if (lineHoverHighlight === "both" || lineHoverHighlight === "number") this.hoveredLine.numberElement.setAttribute("data-hovered", "");
    }
  }
  clearHoveredToken() {
    if (this.hoveredToken == null) return;
    this.hoveredToken = void 0;
  }
  setHoveredToken(hoveredToken) {
    if (this.hoveredToken != null) this.clearHoveredToken();
    this.hoveredToken = hoveredToken;
  }
  ensureGutterUtilityNode(useCustomGutterUtility) {
    if (this.gutterUtilityContainer == null) {
      this.gutterUtilityContainer = document.createElement("div");
      this.gutterUtilityContainer.setAttribute("data-gutter-utility-slot", "");
    }
    if (useCustomGutterUtility) {
      if (this.gutterUtilityButton != null) {
        this.gutterUtilityButton.remove();
        this.gutterUtilityButton = void 0;
      }
      if (this.gutterUtilitySlot == null) {
        this.gutterUtilitySlot = document.createElement("slot");
        this.gutterUtilitySlot.name = "gutter-utility-slot";
      }
      if (this.gutterUtilitySlot.parentNode !== this.gutterUtilityContainer) this.gutterUtilityContainer.replaceChildren(this.gutterUtilitySlot);
    } else {
      this.gutterUtilitySlot?.remove();
      this.gutterUtilitySlot = void 0;
      if (this.gutterUtilityButton == null) {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = toHtml(createGutterUtilityElement());
        const utilityButton = tempDiv.firstElementChild;
        if (!(utilityButton instanceof HTMLButtonElement)) throw new Error("InteractionManager.ensureGutterUtilityNode: Node element should be a button");
        utilityButton.remove();
        this.gutterUtilityButton = utilityButton;
      }
      if (this.gutterUtilityButton.parentNode !== this.gutterUtilityContainer) this.gutterUtilityContainer.replaceChildren(this.gutterUtilityButton);
    }
  }
  attachDocumentPointerListeners() {
    if (this.hasDocumentPointerListeners) return;
    document.addEventListener("pointermove", this.handleDocumentPointerMove);
    document.addEventListener("pointerup", this.handleDocumentPointerUp);
    document.addEventListener("pointercancel", this.handleDocumentPointerCancel);
    this.hasDocumentPointerListeners = true;
  }
  detachDocumentPointerListeners() {
    if (!this.hasDocumentPointerListeners) return;
    document.removeEventListener("pointermove", this.handleDocumentPointerMove);
    document.removeEventListener("pointerup", this.handleDocumentPointerUp);
    document.removeEventListener("pointercancel", this.handleDocumentPointerCancel);
    this.hasDocumentPointerListeners = false;
  }
  clearPointerSession() {
    this.pointerSession = { mode: "idle" };
  }
  clearPendingSingleLineState() {
    if (this.pointerSession.mode === "pendingSingleLineUnselect") this.pointerSession = { mode: "idle" };
  }
  getSelectionPointerInfo(path, requireNumberColumn) {
    const target = this.resolvePointerTarget(path);
    if (!isLinePointerTarget(target)) return;
    if (requireNumberColumn && !target.numberColumn) return;
    if (target.splitLineIndex == null) return;
    return {
      lineIndex: target.splitLineIndex,
      lineNumber: target.lineNumber,
      eventSide: this.mode === "diff" ? target.side : void 0
    };
  }
  getSelectionPointFromPath(path) {
    const target = this.resolvePointerTarget(path);
    if (!isLinePointerTarget(target)) return;
    return {
      lineNumber: target.lineNumber,
      side: this.mode === "diff" ? target.side : void 0
    };
  }
  getLineIndex(lineNumber, side) {
    const { getLineIndex } = this.options;
    return getLineIndex != null ? getLineIndex(lineNumber, side) : [lineNumber - 1, lineNumber - 1];
  }
  updateSelection(currentLine, side, emitChange = true) {
    const { selectedRange: previousRange } = this;
    let nextRange;
    if (currentLine == null) nextRange = null;
    else {
      const anchorSide = this.selectionAnchor?.side ?? side;
      const anchorLine = this.selectionAnchor?.lineNumber ?? currentLine;
      nextRange = this.buildSelectionRange(anchorLine, currentLine, anchorSide, side);
    }
    if (areSelectionsEqual(previousRange ?? void 0, nextRange ?? void 0)) return;
    this.selectedRange = nextRange;
    if (emitChange) this.notifySelectionChangeDelta();
    this.queuedSelectionRender ??= requestAnimationFrame(this.renderSelection);
  }
  getIndexesFromSelection(selectedRange, split) {
    if (this.pre == null) return;
    const startIndexes = this.getLineIndex(selectedRange.start, selectedRange.side);
    const finalIndexes = this.getLineIndex(selectedRange.end, selectedRange.endSide ?? selectedRange.side);
    return startIndexes != null && finalIndexes != null ? {
      start: split ? startIndexes[1] : startIndexes[0],
      end: split ? finalIndexes[1] : finalIndexes[0]
    } : void 0;
  }
  renderSelection = () => {
    if (this.queuedSelectionRender != null) {
      cancelAnimationFrame(this.queuedSelectionRender);
      this.queuedSelectionRender = void 0;
    }
    if (this.pre == null || this.renderedSelectionRange === this.selectedRange) return;
    const allSelected = this.pre.querySelectorAll("[data-selected-line]");
    for (const element2 of allSelected) element2.removeAttribute("data-selected-line");
    this.renderedSelectionRange = this.selectedRange;
    if (this.selectedRange == null) return;
    const { children: codeElements } = this.pre;
    if (codeElements.length === 0) return;
    if (codeElements.length > 2) {
      console.error(codeElements);
      throw new Error("InteractionManager.renderSelection: Somehow there are more than 2 code elements...");
    }
    const split = this.pre.getAttribute("data-diff-type") === "split";
    const rowRange = this.getIndexesFromSelection(this.selectedRange, split);
    if (rowRange == null) {
      console.error({
        rowRange,
        selectedRange: this.selectedRange
      });
      throw new Error("InteractionManager.renderSelection: No valid rowRange");
    }
    const isSingle = rowRange.start === rowRange.end;
    const first = Math.min(rowRange.start, rowRange.end);
    const last = Math.max(rowRange.start, rowRange.end);
    for (const code of codeElements) {
      const [gutter, content] = code.children;
      const len = content.children.length;
      if (len !== gutter.children.length) throw new Error("InteractionManager.renderSelection: gutter and content children dont match, something is wrong");
      for (let i2 = 0; i2 < len; i2++) {
        const contentElement = content.children[i2];
        const gutterElement = gutter.children[i2];
        if (!(contentElement instanceof HTMLElement) || !(gutterElement instanceof HTMLElement)) continue;
        const lineIndex = this.parseLineIndex(contentElement, split);
        if ((lineIndex ?? 0) > last) break;
        if (lineIndex == null || lineIndex < first) continue;
        let attributeValue = isSingle ? "single" : lineIndex === first ? "first" : lineIndex === last ? "last" : "";
        contentElement.setAttribute("data-selected-line", attributeValue);
        gutterElement.setAttribute("data-selected-line", attributeValue);
        if (gutterElement.nextSibling instanceof HTMLElement && contentElement.nextSibling instanceof HTMLElement && (contentElement.nextSibling.hasAttribute("data-line-annotation") || contentElement.nextSibling.hasAttribute("data-merge-conflict-actions"))) {
          if (isSingle) {
            attributeValue = "last";
            contentElement.setAttribute("data-selected-line", "first");
          } else if (lineIndex === first) attributeValue = "";
          else if (lineIndex === last) contentElement.setAttribute("data-selected-line", "");
          contentElement.nextSibling.setAttribute("data-selected-line", attributeValue);
          gutterElement.nextSibling.setAttribute("data-selected-line", attributeValue);
        }
      }
    }
  };
  notifySelectionCommitted() {
    this.options.onLineSelected?.(this.selectedRange ?? null);
  }
  notifySelectionChangeDelta() {
    this.options.onLineSelectionChange?.(this.selectedRange ?? null);
  }
  notifySelectionStart(range2) {
    this.options.onLineSelectionStart?.(range2);
  }
  notifySelectionEnd(range2) {
    this.options.onLineSelectionEnd?.(range2);
  }
  toEventBaseProps(target) {
    if (this.mode === "file") return {
      type: "line",
      lineElement: target.lineElement,
      lineNumber: target.lineNumber,
      numberColumn: target.numberColumn,
      numberElement: target.numberElement
    };
    return {
      type: "diff-line",
      annotationSide: target.side,
      lineType: target.lineType,
      lineElement: target.lineElement,
      numberElement: target.numberElement,
      lineNumber: target.lineNumber,
      numberColumn: target.numberColumn
    };
  }
  toTokenEventBaseProps({ lineCharEnd, lineCharStart, lineNumber, side, tokenElement, tokenText }) {
    if (this.mode === "file") return {
      type: "token",
      lineCharEnd,
      lineCharStart,
      lineNumber,
      tokenElement,
      tokenText
    };
    return {
      type: "token",
      lineCharEnd,
      lineCharStart,
      lineNumber,
      side,
      tokenElement,
      tokenText
    };
  }
  buildSelectedLineRange(anchor, current) {
    return this.buildSelectionRange(anchor.lineNumber, current.lineNumber, anchor.side, current.side);
  }
  buildSelectionRange(start, end, side, endSide) {
    return {
      start,
      end,
      ...side != null ? { side } : {},
      ...side !== endSide && endSide != null ? { endSide } : {}
    };
  }
  resolvePointerTarget(path) {
    let numberColumn = false;
    let lineType;
    let codeElement;
    let lineElement;
    let lineIndexValue;
    let numberElement;
    let tokenElement;
    let tokenInfo;
    let expandInfo;
    let lineNumber;
    let mergeConflictActionTarget;
    for (const element2 of path) {
      if (!(element2 instanceof HTMLElement)) continue;
      if (mergeConflictActionTarget == null && element2.hasAttribute("data-merge-conflict-action")) {
        const resolutionValue = element2.getAttribute("data-merge-conflict-action") ?? void 0;
        const conflictIndexValue = element2.getAttribute("data-merge-conflict-conflict-index") ?? void 0;
        const conflictIndex = conflictIndexValue != null ? Number.parseInt(conflictIndexValue, 10) : NaN;
        if (isMergeConflictResolution(resolutionValue) && Number.isFinite(conflictIndex)) mergeConflictActionTarget = {
          kind: "merge-conflict-action",
          resolution: resolutionValue,
          conflictIndex
        };
      }
      if (tokenElement == null && element2.hasAttribute("data-char")) {
        tokenElement = element2;
        const startAttr = element2.getAttribute("data-char");
        if (startAttr != null) {
          const lineCharStart = Number.parseInt(startAttr, 10);
          if (!Number.isNaN(lineCharStart)) {
            const tokenText = element2.textContent ?? "";
            const lineCharEnd = lineCharStart + tokenText.length;
            if (tokenText.trim() !== "" || this.options.enableTokenInteractionsOnWhitespace === true) tokenInfo = {
              tokenElement,
              lineCharStart,
              lineCharEnd,
              tokenText
            };
            continue;
          }
        }
      }
      const columnNumber = numberElement == null ? element2.getAttribute("data-column-number") ?? void 0 : void 0;
      if (columnNumber != null) {
        numberElement = element2;
        lineNumber = Number.parseInt(columnNumber, 10);
        numberColumn = true;
        lineType = getLineTypeFromElement(element2);
        lineIndexValue = element2.getAttribute("data-line-index") ?? void 0;
        continue;
      }
      const lineAttr = lineElement == null ? element2.getAttribute("data-line") ?? void 0 : void 0;
      if (lineAttr != null) {
        lineElement = element2;
        lineNumber = Number.parseInt(lineAttr, 10);
        lineType = getLineTypeFromElement(element2);
        lineIndexValue = element2.getAttribute("data-line-index") ?? void 0;
        continue;
      }
      if (expandInfo == null && (element2.hasAttribute("data-expand-button") || element2.hasAttribute("data-unmodified-lines"))) {
        expandInfo = {
          hunkIndex: void 0,
          direction: (() => {
            if (element2.hasAttribute("data-expand-up")) return "up";
            if (element2.hasAttribute("data-expand-down")) return "down";
            return "both";
          })(),
          all: element2.hasAttribute("data-expand-all-button")
        };
        continue;
      }
      const expandIndexValue = expandInfo != null ? element2.getAttribute("data-expand-index") ?? void 0 : void 0;
      if (expandInfo != null && expandIndexValue != null) {
        const expandIndex = Number.parseInt(expandIndexValue, 10);
        if (!Number.isNaN(expandIndex)) expandInfo.hunkIndex = expandIndex;
        continue;
      }
      if (codeElement == null && element2.hasAttribute("data-code")) {
        codeElement = element2;
        break;
      }
    }
    if (mergeConflictActionTarget != null) return mergeConflictActionTarget;
    if (expandInfo?.hunkIndex != null) return {
      type: "line-info",
      hunkIndex: expandInfo.hunkIndex,
      direction: expandInfo.direction,
      all: expandInfo.all
    };
    lineElement ??= lineIndexValue != null ? queryHTMLElement(codeElement, `[data-line][data-line-index="${lineIndexValue}"]`) : void 0;
    numberElement ??= lineIndexValue != null ? queryHTMLElement(codeElement, `[data-column-number][data-line-index="${lineIndexValue}"]`) : void 0;
    if (codeElement == null || lineElement == null || numberElement == null || lineType == null || lineNumber == null || Number.isNaN(lineNumber)) return;
    const splitLineIndex = this.parseLineIndex(lineElement, this.isSplitDiff());
    if (tokenInfo != null) {
      if (this.mode === "file") return {
        kind: "token",
        lineType,
        lineElement,
        lineNumber,
        numberColumn,
        numberElement,
        side: void 0,
        splitLineIndex,
        ...tokenInfo
      };
      return {
        kind: "token",
        lineType,
        lineElement,
        lineNumber,
        numberColumn,
        numberElement,
        side: getAnnotationSide(lineType, codeElement),
        splitLineIndex,
        ...tokenInfo
      };
    }
    if (this.mode === "file") return {
      kind: "line",
      lineType,
      lineElement,
      lineNumber,
      numberColumn,
      numberElement,
      side: void 0,
      splitLineIndex
    };
    return {
      kind: "line",
      lineType,
      lineElement,
      lineNumber,
      numberColumn,
      numberElement,
      side: getAnnotationSide(lineType, codeElement),
      splitLineIndex
    };
  }
  isSplitDiff() {
    return this.pre?.getAttribute("data-diff-type") === "split";
  }
  parseLineIndex(element2, split) {
    const lineIndexes = (element2.getAttribute("data-line-index") ?? "").split(",").map((value) => Number.parseInt(value, 10)).filter((value) => !Number.isNaN(value));
    if (split && lineIndexes.length === 2) return lineIndexes[1];
    if (!split) return lineIndexes[0];
  }
};
function pluckInteractionOptions({ enableTokenInteractionsOnWhitespace, enableGutterUtility, enableHoverUtility, lineHoverHighlight, onGutterUtilityClick, onLineClick, onLineEnter, onLineLeave, onLineNumberClick, onTokenClick, onTokenEnter, onTokenLeave, renderGutterUtility, renderHoverUtility, __debugPointerEvents, enableLineSelection, onLineSelected, onLineSelectionStart, onLineSelectionChange, onLineSelectionEnd }, onHunkExpand, getLineIndex, onMergeConflictActionClick) {
  return {
    enableTokenInteractionsOnWhitespace,
    enableGutterUtility: resolveEnableGutterUtilityOption({
      enableGutterUtility,
      enableHoverUtility,
      renderGutterUtility,
      renderHoverUtility,
      onGutterUtilityClick
    }),
    usesCustomGutterUtility: renderGutterUtility != null || renderHoverUtility != null,
    lineHoverHighlight,
    onGutterUtilityClick,
    onHunkExpand,
    onMergeConflictActionClick,
    onLineClick,
    onLineEnter,
    onLineLeave,
    onLineNumberClick,
    onTokenClick,
    onTokenEnter,
    onTokenLeave,
    __debugPointerEvents,
    enableLineSelection,
    onLineSelected,
    onLineSelectionStart,
    onLineSelectionChange,
    onLineSelectionEnd,
    getLineIndex
  };
}
function resolveEnableGutterUtilityOption({ enableGutterUtility, enableHoverUtility, renderGutterUtility, renderHoverUtility, onGutterUtilityClick }) {
  if (enableGutterUtility !== void 0 && enableHoverUtility !== void 0) throw new Error("Cannot use both 'enableGutterUtility' and deprecated 'enableHoverUtility'. Use only 'enableGutterUtility'.");
  if (renderGutterUtility != null && renderHoverUtility != null) throw new Error("Cannot use both 'renderGutterUtility' and deprecated 'renderHoverUtility'. Use only 'renderGutterUtility'.");
  if (onGutterUtilityClick != null && (renderGutterUtility != null || renderHoverUtility != null)) throw new Error("Cannot use both 'onGutterUtilityClick' and render utility callbacks ('renderGutterUtility'/'renderHoverUtility'). Use only one gutter utility API.");
  return enableGutterUtility ?? enableHoverUtility ?? false;
}
function isLinePointerTarget(target) {
  return target != null && "kind" in target && target.kind === "line";
}
function isTokenPointerTarget(target) {
  return target != null && "kind" in target && target.kind === "token";
}
function isHoverableLinePointerTarget(target) {
  return isLinePointerTarget(target) || isTokenPointerTarget(target);
}
function isExpandoPointerTarget(target) {
  return "type" in target && target.type === "line-info";
}
function isMergeConflictActionPointerTarget(target) {
  return "kind" in target && target.kind === "merge-conflict-action";
}
function isMergeConflictResolution(value) {
  return value === "current" || value === "incoming" || value === "both";
}
function queryHTMLElement(parent, query) {
  const element2 = parent?.querySelector(query);
  return element2 instanceof HTMLElement ? element2 : void 0;
}
function getAnnotationSide(lineType, codeElement) {
  switch (lineType) {
    case "change-deletion":
      return "deletions";
    case "change-addition":
      return "additions";
    default:
      return codeElement.hasAttribute("data-deletions") ? "deletions" : "additions";
  }
}
function getLineTypeFromElement(element2) {
  const lineType = element2.getAttribute("data-line-type");
  if (lineType == null) return;
  switch (lineType) {
    case "change-deletion":
    case "change-addition":
    case "context":
    case "context-expanded":
      return lineType;
    default:
      return;
  }
}
function isGutterUtilityPointerPath(path) {
  for (const element2 of path) if (element2 instanceof HTMLElement && element2.hasAttribute("data-utility-button")) return true;
  return false;
}
function debugLogIfEnabled(debugLogType = "none", logIfType, ...args) {
  switch (debugLogType) {
    case "none":
      return;
    case "both":
      break;
    case "click":
      if (logIfType !== "click") return;
      break;
    case "move":
      if (logIfType !== "move") return;
      break;
  }
  console.log(...args);
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/managers/ResizeManager.js
var ResizeManager = class {
  observedNodes = /* @__PURE__ */ new Map();
  queuedUpdates = /* @__PURE__ */ new Map();
  cleanUp() {
    this.resizeObserver?.disconnect();
    this.observedNodes.clear();
    this.queuedUpdates.clear();
  }
  resizeObserver;
  setup(pre, disableAnnotations) {
    this.resizeObserver ??= new ResizeObserver(this.handleResizeObserver);
    const codeElements = pre.querySelectorAll("code");
    const observedNodes = new Map(this.observedNodes);
    this.observedNodes.clear();
    for (const codeElement of codeElements) {
      let item = observedNodes.get(codeElement);
      if (item != null && item.type !== "code") throw new Error("ResizeManager.setup: somehow a code node is being used for an annotation, should be impossible");
      let numberElement = codeElement.firstElementChild;
      if (!(numberElement instanceof HTMLElement)) numberElement = null;
      if (item != null) {
        this.observedNodes.set(codeElement, item);
        observedNodes.delete(codeElement);
        if (item.numberElement !== numberElement) {
          if (item.numberElement != null) this.resizeObserver.unobserve(item.numberElement);
          if (numberElement != null) {
            this.resizeObserver.observe(numberElement);
            observedNodes.delete(numberElement);
            this.observedNodes.set(numberElement, item);
          }
          item.numberElement = numberElement;
        } else if (item.numberElement != null) {
          observedNodes.delete(item.numberElement);
          this.observedNodes.set(item.numberElement, item);
        }
      } else {
        item = {
          type: "code",
          codeElement,
          numberElement,
          codeWidth: "auto",
          numberWidth: 0
        };
        this.observedNodes.set(codeElement, item);
        this.resizeObserver.observe(codeElement);
        if (numberElement != null) {
          this.observedNodes.set(numberElement, item);
          this.resizeObserver.observe(numberElement);
        }
      }
    }
    if (codeElements.length > 1 && !disableAnnotations) {
      const annotationElements = pre.querySelectorAll('[data-line-annotation*=","]');
      const elementMap = /* @__PURE__ */ new Map();
      for (const element2 of annotationElements) {
        if (!(element2 instanceof HTMLElement)) continue;
        const { lineAnnotation = "" } = element2.dataset;
        if (!/^\d+,\d+$/.test(lineAnnotation)) {
          console.error("DiffFileRenderer.setupResizeObserver: Invalid element or annotation", {
            lineAnnotation,
            element: element2
          });
          continue;
        }
        let pairs = elementMap.get(lineAnnotation);
        if (pairs == null) {
          pairs = [];
          elementMap.set(lineAnnotation, pairs);
        }
        pairs.push(element2);
      }
      for (const [key2, pair] of elementMap) {
        if (pair.length !== 2) {
          console.error("DiffFileRenderer.setupResizeObserver: Bad Pair", key2, pair);
          continue;
        }
        const [container1, container2] = pair;
        const child1 = container1.firstElementChild;
        const child2 = container2.firstElementChild;
        if (!(container1 instanceof HTMLElement) || !(container2 instanceof HTMLElement) || !(child1 instanceof HTMLElement) || !(child2 instanceof HTMLElement)) continue;
        let item = observedNodes.get(child1);
        if (item != null) {
          this.observedNodes.set(child1, item);
          this.observedNodes.set(child2, item);
          observedNodes.delete(child1);
          observedNodes.delete(child2);
          continue;
        }
        item = {
          type: "annotations",
          column1: {
            container: container1,
            child: child1,
            childHeight: child1.getBoundingClientRect().height
          },
          column2: {
            container: container2,
            child: child2,
            childHeight: child2.getBoundingClientRect().height
          },
          currentHeight: "auto"
        };
        const newHeight = Math.max(item.column1.childHeight, item.column2.childHeight);
        this.applyNewHeight(item, newHeight);
        this.observedNodes.set(child1, item);
        this.observedNodes.set(child2, item);
        this.resizeObserver.observe(child1);
        this.resizeObserver.observe(child2);
      }
    }
    for (const element2 of observedNodes.keys()) {
      if (element2.isConnected) {
        element2.style.removeProperty("--diffs-column-content-width");
        element2.style.removeProperty("--diffs-column-number-width");
        element2.style.removeProperty("--diffs-column-width");
        if (element2.parentElement instanceof HTMLElement) element2.parentElement.style.removeProperty("--diffs-annotation-min-height");
      }
      this.resizeObserver.unobserve(element2);
    }
    observedNodes.clear();
  }
  handleResizeObserver = (entries) => {
    for (const entry of entries) {
      const { target, borderBoxSize, contentBoxSize } = entry;
      if (!(target instanceof HTMLElement)) {
        console.error("FileDiff.handleResizeObserver: Invalid element for ResizeObserver", entry);
        continue;
      }
      const item = this.observedNodes.get(target);
      if (item == null) {
        console.error("FileDiff.handleResizeObserver: Not a valid observed node", entry);
        continue;
      }
      if (item.type === "annotations") {
        const column = (() => {
          if (target === item.column1.child) return item.column1;
          if (target === item.column2.child) return item.column2;
        })();
        if (column == null) {
          console.error(`FileDiff.handleResizeObserver: Couldn't find a column for`, {
            item,
            target
          });
          continue;
        }
        column.childHeight = borderBoxSize[0].blockSize;
        const newHeight = Math.max(item.column1.childHeight, item.column2.childHeight);
        this.applyNewHeight(item, newHeight);
      } else if (item.type === "code") {
        const update = [target, contentBoxSize[0].inlineSize];
        const updates = this.queuedUpdates.get(item) ?? [];
        updates.push(update);
        this.queuedUpdates.set(item, updates);
      }
    }
    this.handleColumnChange();
  };
  handleColumnChange = () => {
    for (const [item, updates] of this.queuedUpdates) for (const [target, targetInlineSize] of updates) if (target === item.codeElement) {
      const inlineSize = Math.max(Math.floor(targetInlineSize), 0);
      if (inlineSize !== item.codeWidth) {
        const targetWidth = Math.max(inlineSize - item.numberWidth, 0);
        item.codeWidth = inlineSize === 0 ? "auto" : inlineSize;
        item.codeElement.style.setProperty("--diffs-column-content-width", `${targetWidth > 0 ? `${targetWidth}px` : "auto"}`);
        item.codeElement.style.setProperty("--diffs-column-width", `${typeof item.codeWidth === "number" ? `${item.codeWidth}px` : "auto"}`);
      }
      if (item.numberElement != null && typeof item.codeWidth === "number" && item.numberWidth === 0) updates.push([item.numberElement, item.numberElement.getBoundingClientRect().width]);
    } else if (target === item.numberElement) {
      const inlineSize = Math.max(Math.ceil(targetInlineSize), 0);
      if (inlineSize !== item.numberWidth) {
        item.numberWidth = inlineSize;
        item.codeElement.style.setProperty("--diffs-column-number-width", `${item.numberWidth === 0 ? "auto" : `${item.numberWidth}px`}`);
        if (item.codeWidth !== "auto") {
          const targetWidth = Math.max(item.codeWidth - item.numberWidth, 0);
          item.codeElement.style.setProperty("--diffs-column-content-width", `${targetWidth === 0 ? "auto" : `${targetWidth}px`}`);
        }
      }
    }
    this.queuedUpdates.clear();
  };
  applyNewHeight(item, newHeight) {
    if (newHeight !== item.currentHeight) {
      item.currentHeight = Math.max(newHeight, 0);
      item.column1.container.style.setProperty("--diffs-annotation-min-height", `${item.currentHeight}px`);
      item.column2.container.style.setProperty("--diffs-annotation-min-height", `${item.currentHeight}px`);
    }
  }
};

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/areRenderRangesEqual.js
function areRenderRangesEqual(renderRangeA, renderRangeB) {
  if (renderRangeA == null || renderRangeB == null) return renderRangeA === renderRangeB;
  return renderRangeA.startingLine === renderRangeB.startingLine && renderRangeA.totalLines === renderRangeB.totalLines && renderRangeA.bufferBefore === renderRangeB.bufferBefore && renderRangeA.bufferAfter === renderRangeB.bufferAfter;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/highlighter/languages/areLanguagesAttached.js
function areLanguagesAttached(languages) {
  for (const language of Array.isArray(languages) ? languages : [languages]) {
    if (language === "text" || language === "ansi") continue;
    if (!AttachedLanguages.has(language)) return false;
  }
  return true;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/highlighter/themes/areThemesAttached.js
function areThemesAttached(themes) {
  for (const theme of getThemes(themes)) if (!AttachedThemes.has(theme)) return false;
  return true;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/createAnnotationElement.js
function createAnnotationElement(span) {
  return createHastElement({
    tagName: "div",
    children: [createHastElement({
      tagName: "div",
      children: span.annotations?.map((slotId) => createHastElement({
        tagName: "slot",
        properties: { name: slotId }
      })),
      properties: { "data-annotation-content": "" }
    })],
    properties: { "data-line-annotation": `${span.hunkIndex},${span.lineIndex}` }
  });
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/createContentColumn.js
function createContentColumn(children, rowCount) {
  return createHastElement({
    tagName: "div",
    children,
    properties: {
      "data-content": "",
      style: `grid-row: span ${rowCount}`
    }
  });
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/getIconForType.js
function getIconForType(type) {
  switch (type) {
    case "file":
      return "diffs-icon-file-code";
    case "change":
      return "diffs-icon-symbol-modified";
    case "new":
      return "diffs-icon-symbol-added";
    case "deleted":
      return "diffs-icon-symbol-deleted";
    case "rename-pure":
    case "rename-changed":
      return "diffs-icon-symbol-moved";
  }
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/createFileHeaderElement.js
function createFileHeaderElement({ fileOrDiff, mode }) {
  const fileDiff = "type" in fileOrDiff ? fileOrDiff : void 0;
  const properties = {
    "data-diffs-header": mode,
    "data-change-type": fileDiff?.type
  };
  return createHastElement({
    tagName: "div",
    children: [mode === "custom" ? createHastElement({
      tagName: "slot",
      properties: { name: CUSTOM_HEADER_SLOT_ID }
    }) : createHeaderElement({
      name: fileOrDiff.name,
      prevName: "prevName" in fileOrDiff ? fileOrDiff.prevName : void 0,
      iconType: fileDiff?.type ?? "file"
    }), ...mode === "custom" ? [] : [createMetadataElement(fileDiff)]],
    properties
  });
}
function createHeaderElement({ name, prevName, iconType }) {
  const children = [createHastElement({
    tagName: "slot",
    properties: { name: HEADER_PREFIX_SLOT_ID }
  }), createIconElement({
    name: getIconForType(iconType),
    properties: { "data-change-icon": iconType }
  })];
  if (prevName != null) {
    children.push(createHastElement({
      tagName: "div",
      children: [createHastElement({
        tagName: "bdi",
        children: [createTextNodeElement(prevName)]
      })],
      properties: { "data-prev-name": "" }
    }));
    children.push(createIconElement({
      name: "diffs-icon-arrow-right-short",
      properties: { "data-rename-icon": "" }
    }));
  }
  children.push(createHastElement({
    tagName: "div",
    children: [createHastElement({
      tagName: "bdi",
      children: [createTextNodeElement(name)]
    })],
    properties: { "data-title": "" }
  }));
  return createHastElement({
    tagName: "div",
    children,
    properties: { "data-header-content": "" }
  });
}
function createMetadataElement(fileDiff) {
  const children = [];
  if (fileDiff != null) {
    let additions = 0;
    let deletions = 0;
    for (const hunk of fileDiff.hunks) {
      additions += hunk.additionLines;
      deletions += hunk.deletionLines;
    }
    if (deletions > 0 || additions === 0) children.push(createHastElement({
      tagName: "span",
      children: [createTextNodeElement(`-${deletions}`)],
      properties: { "data-deletions-count": "" }
    }));
    if (additions > 0 || deletions === 0) children.push(createHastElement({
      tagName: "span",
      children: [createTextNodeElement(`+${additions}`)],
      properties: { "data-additions-count": "" }
    }));
  }
  children.push(createHastElement({
    tagName: "slot",
    properties: { name: HEADER_METADATA_SLOT_ID }
  }));
  return createHastElement({
    tagName: "div",
    children,
    properties: { "data-metadata": "" }
  });
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/createPreElement.js
function createPreElement(options) {
  return createHastElement({
    tagName: "pre",
    properties: createPreWrapperProperties(options)
  });
}
function createPreWrapperProperties({ diffIndicators, disableBackground, disableLineNumbers, overflow, split, totalLines, type, customProperties }) {
  return {
    ...customProperties,
    "data-diff": type === "diff" ? "" : void 0,
    "data-file": type === "file" ? "" : void 0,
    "data-diff-type": type === "diff" ? split ? "split" : "single" : void 0,
    "data-overflow": overflow,
    "data-disable-line-numbers": disableLineNumbers ? "" : void 0,
    "data-background": !disableBackground ? "" : void 0,
    "data-indicators": diffIndicators === "bars" || diffIndicators === "classic" ? diffIndicators : void 0,
    tabIndex: 0,
    style: `--diffs-min-number-column-width-default:${`${totalLines}`.length}ch;`
  };
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/getHighlighterOptions.js
function getHighlighterOptions(lang, { theme, preferredHighlighter = "shiki-js" }) {
  return {
    langs: [lang ?? "text"],
    themes: getThemes(theme),
    preferredHighlighter
  };
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/shouldUseTokenTransformer.js
function shouldUseTokenTransformer(options) {
  return options.useTokenTransformer === true || options.onTokenClick != null || options.onTokenEnter != null || options.onTokenLeave != null;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/renderers/FileRenderer.js
var instanceId = -1;
var FileRenderer = class {
  __id = `file-renderer:${++instanceId}`;
  highlighter;
  renderCache;
  computedLang = "text";
  lineAnnotations = {};
  lineCache;
  constructor(options = { theme: DEFAULT_THEMES }, onRenderUpdate, workerManager) {
    this.options = options;
    this.onRenderUpdate = onRenderUpdate;
    this.workerManager = workerManager;
    if (workerManager?.isWorkingPool() !== true) this.highlighter = areThemesAttached(options.theme ?? DEFAULT_THEMES) ? getHighlighterIfLoaded() : void 0;
  }
  setOptions(options) {
    this.options = options;
  }
  mergeOptions(options) {
    this.options = {
      ...this.options,
      ...options
    };
  }
  setLineAnnotations(lineAnnotations) {
    this.lineAnnotations = {};
    for (const annotation of lineAnnotations) {
      const arr = this.lineAnnotations[annotation.lineNumber] ?? [];
      this.lineAnnotations[annotation.lineNumber] = arr;
      arr.push(annotation);
    }
  }
  cleanUp() {
    this.renderCache = void 0;
    this.highlighter = void 0;
    this.workerManager = void 0;
    this.onRenderUpdate = void 0;
    this.lineCache = void 0;
  }
  hydrate(file) {
    const { options } = this.getRenderOptions(file);
    let cache = this.workerManager?.getFileResultCache(file);
    if (cache != null && !areRenderOptionsEqual(options, cache.options)) cache = void 0;
    this.renderCache ??= {
      file,
      options,
      highlighted: !isFilePlainText(file),
      result: cache?.result,
      renderRange: void 0
    };
    if (this.workerManager?.isWorkingPool() === true) {
      if (this.renderCache.result == null) this.workerManager.highlightFileAST(this, file);
    } else if (this.highlighter == null) {
      this.computedLang = file.lang ?? getFiletypeFromFileName(file.name);
      this.initializeHighlighter();
    }
  }
  getRenderOptions(file) {
    const options = (() => {
      if (this.workerManager?.isWorkingPool() === true) return this.workerManager.getFileRenderOptions();
      const { theme = DEFAULT_THEMES, tokenizeMaxLineLength = 1e3 } = this.options;
      return {
        theme,
        useTokenTransformer: shouldUseTokenTransformer(this.options),
        tokenizeMaxLineLength
      };
    })();
    const { renderCache } = this;
    if (renderCache?.result == null) return {
      options,
      forceRender: true
    };
    if (file !== renderCache.file || !areRenderOptionsEqual(options, renderCache.options)) return {
      options,
      forceRender: true
    };
    return {
      options,
      forceRender: false
    };
  }
  getOrCreateLineCache(file) {
    if (file.cacheKey == null) {
      this.lineCache = void 0;
      return splitFileContents(file.contents);
    }
    let { lineCache } = this;
    if (lineCache == null || lineCache.cacheKey !== file.cacheKey) lineCache = {
      cacheKey: file.cacheKey,
      lines: splitFileContents(file.contents)
    };
    this.lineCache = lineCache;
    return lineCache.lines;
  }
  renderFile(file = this.renderCache?.file, renderRange = DEFAULT_RENDER_RANGE) {
    if (file == null) return;
    const cache = this.workerManager?.getFileResultCache(file);
    if (cache != null && this.renderCache == null) this.renderCache = {
      file,
      highlighted: true,
      renderRange: void 0,
      ...cache
    };
    const { options, forceRender } = this.getRenderOptions(file);
    this.renderCache ??= {
      file,
      highlighted: false,
      options,
      result: void 0,
      renderRange: void 0
    };
    if (this.workerManager?.isWorkingPool() === true) {
      if (this.renderCache.result == null || !this.renderCache.highlighted && (file !== this.renderCache.file || !areRenderRangesEqual(this.renderCache.renderRange, renderRange))) {
        this.renderCache.file = file;
        this.renderCache.result = this.workerManager.getPlainFileAST(file, renderRange.startingLine, renderRange.totalLines, this.getOrCreateLineCache(file));
        this.renderCache.renderRange = renderRange;
      }
      if (renderRange.totalLines > 0 && (!this.renderCache.highlighted || forceRender)) this.workerManager.highlightFileAST(this, file);
    } else {
      this.computedLang = file.lang ?? getFiletypeFromFileName(file.name);
      const hasThemes = this.highlighter != null && areThemesAttached(options.theme);
      const hasLangs = this.highlighter != null && areLanguagesAttached(this.computedLang);
      if (this.highlighter != null && hasThemes && (forceRender || !this.renderCache.highlighted && hasLangs || this.renderCache.result == null)) {
        const { result, options: options$1 } = this.renderFileWithHighlighter(file, this.highlighter, !hasLangs);
        this.renderCache = {
          file,
          options: options$1,
          highlighted: hasLangs,
          result,
          renderRange: void 0
        };
      }
      if (!hasThemes || !hasLangs) this.asyncHighlight(file).then(({ result, options: options$1 }) => {
        if (this.renderCache != null) this.renderCache.highlighted = false;
        this.onHighlightSuccess(file, result, options$1);
      });
    }
    return this.renderCache.result != null ? this.processFileResult(this.renderCache.file, renderRange, this.renderCache.result) : void 0;
  }
  async asyncRender(file, renderRange = DEFAULT_RENDER_RANGE) {
    const { result } = await this.asyncHighlight(file);
    return this.processFileResult(file, renderRange, result);
  }
  async asyncHighlight(file) {
    this.computedLang = file.lang ?? getFiletypeFromFileName(file.name);
    const hasThemes = this.highlighter != null && hasResolvedThemes(getThemes(this.options.theme));
    const hasLangs = this.highlighter != null && areLanguagesAttached(this.computedLang);
    if (this.highlighter == null || !hasThemes || !hasLangs) this.highlighter = await this.initializeHighlighter();
    return this.renderFileWithHighlighter(file, this.highlighter);
  }
  renderFileWithHighlighter(file, highlighter2, forcePlainText = false) {
    const { options } = this.getRenderOptions(file);
    return {
      result: renderFileWithHighlighter(file, highlighter2, options, { forcePlainText }),
      options
    };
  }
  processFileResult(file, renderRange, { code, themeStyles, baseThemeType }) {
    const { disableFileHeader = false } = this.options;
    const contentArray = [];
    const gutter = createGutterWrapper();
    const lines = this.getOrCreateLineCache(file);
    let rowCount = 0;
    iterateOverFile({
      lines,
      startingLine: renderRange.startingLine,
      totalLines: renderRange.totalLines,
      callback: ({ lineIndex, lineNumber }) => {
        const line = code[lineIndex];
        if (line == null) {
          const message = "FileRenderer.processFileResult: Line doesnt exist";
          console.error(message, {
            name: file.name,
            lineIndex,
            lineNumber,
            lines
          });
          throw new Error(message);
        }
        if (line != null) {
          gutter.children.push(createGutterItem("context", lineNumber, `${lineIndex}`));
          contentArray.push(line);
          rowCount++;
          const annotations = this.lineAnnotations[lineNumber];
          if (annotations != null) {
            gutter.children.push(createGutterGap("context", "annotation", 1));
            contentArray.push(createAnnotationElement({
              type: "annotation",
              hunkIndex: 0,
              lineIndex: lineNumber,
              annotations: annotations.map((annotation) => getLineAnnotationName(annotation))
            }));
            rowCount++;
          }
        }
      }
    });
    gutter.properties.style = `grid-row: span ${rowCount}`;
    return {
      gutterAST: gutter.children ?? [],
      contentAST: contentArray,
      preAST: this.createPreElement(lines.length),
      headerAST: !disableFileHeader ? this.renderHeader(file) : void 0,
      totalLines: lines.length,
      rowCount,
      themeStyles,
      baseThemeType,
      bufferBefore: renderRange.bufferBefore,
      bufferAfter: renderRange.bufferAfter,
      css: ""
    };
  }
  renderHeader(file) {
    const { headerRenderMode = "default" } = this.options;
    return createFileHeaderElement({
      fileOrDiff: file,
      mode: headerRenderMode
    });
  }
  renderFullHTML(result) {
    return toHtml(this.renderFullAST(result));
  }
  renderFullAST(result, children = []) {
    children.push(createHastElement({
      tagName: "code",
      children: this.renderCodeAST(result),
      properties: { "data-code": "" }
    }));
    return {
      ...result.preAST,
      children
    };
  }
  renderCodeAST(result) {
    const gutter = createGutterWrapper();
    gutter.children = result.gutterAST;
    gutter.properties.style = `grid-row: span ${result.rowCount}`;
    return [gutter, createContentColumn(result.contentAST, result.rowCount)];
  }
  renderPartialHTML(children, includeCodeNode = false) {
    if (!includeCodeNode) return toHtml(children);
    return toHtml(createHastElement({
      tagName: "code",
      children,
      properties: { "data-code": "" }
    }));
  }
  async initializeHighlighter() {
    this.highlighter = await getSharedHighlighter(getHighlighterOptions(this.computedLang, this.options));
    return this.highlighter;
  }
  onHighlightSuccess(file, result, options) {
    if (this.renderCache == null) return;
    const triggerRenderUpdate = this.renderCache.file !== file || !this.renderCache.highlighted || !areRenderOptionsEqual(options, this.renderCache.options);
    this.renderCache = {
      file,
      options,
      highlighted: true,
      result,
      renderRange: void 0
    };
    if (triggerRenderUpdate) this.onRenderUpdate?.();
  }
  onHighlightError(error) {
    console.error(error);
  }
  createPreElement(totalLines) {
    const { disableLineNumbers = false, overflow = "scroll" } = this.options;
    return createPreElement({
      type: "file",
      diffIndicators: "none",
      disableBackground: true,
      disableLineNumbers,
      overflow,
      split: false,
      totalLines
    });
  }
};
function areRenderOptionsEqual(optionsA, optionsB) {
  return areThemesEqual(optionsA.theme, optionsB.theme) && optionsA.useTokenTransformer === optionsB.useTokenTransformer && optionsA.tokenizeMaxLineLength === optionsB.tokenizeMaxLineLength;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/sprite.js
var SVGSpriteSheet = `<svg data-icon-sprite aria-hidden="true" width="0" height="0">
  <symbol id="diffs-icon-arrow-right-short" viewBox="0 0 16 16">
    <path d="M8.47 4.22a.75.75 0 0 0 0 1.06l1.97 1.97H3.75a.75.75 0 0 0 0 1.5h6.69l-1.97 1.97a.75.75 0 1 0 1.06 1.06l3.25-3.25a.75.75 0 0 0 0-1.06L9.53 4.22a.75.75 0 0 0-1.06 0"/>
  </symbol>
  <symbol id="diffs-icon-brand-github" viewBox="0 0 16 16">
    <path d="M8 0c4.42 0 8 3.58 8 8a8.01 8.01 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27s-1.36.09-2 .27c-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8"/>
  </symbol>
  <symbol id="diffs-icon-chevron" viewBox="0 0 16 16">
    <path d="M1.47 4.47a.75.75 0 0 1 1.06 0L8 9.94l5.47-5.47a.75.75 0 1 1 1.06 1.06l-6 6a.75.75 0 0 1-1.06 0l-6-6a.75.75 0 0 1 0-1.06"/>
  </symbol>
  <symbol id="diffs-icon-chevrons-narrow" viewBox="0 0 10 16">
    <path d="M4.47 2.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1-1.06 1.06L5 3.81 2.28 6.53a.75.75 0 0 1-1.06-1.06zM1.22 9.47a.75.75 0 0 1 1.06 0L5 12.19l2.72-2.72a.75.75 0 0 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0l-3.25-3.25a.75.75 0 0 1 0-1.06"/>
  </symbol>
  <symbol id="diffs-icon-diff-split" viewBox="0 0 16 16">
    <path d="M14 0H8.5v16H14a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2m-1.5 6.5v1h1a.5.5 0 0 1 0 1h-1v1a.5.5 0 0 1-1 0v-1h-1a.5.5 0 0 1 0-1h1v-1a.5.5 0 0 1 1 0"/><path d="M2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5.5V0zm.5 7.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1 0-1" opacity=".3"/>
  </symbol>
  <symbol id="diffs-icon-diff-unified" viewBox="0 0 16 16">
    <path fill-rule="evenodd" d="M16 14a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V8.5h16zm-8-4a.5.5 0 0 0-.5.5v1h-1a.5.5 0 0 0 0 1h1v1a.5.5 0 0 0 1 0v-1h1a.5.5 0 0 0 0-1h-1v-1A.5.5 0 0 0 8 10" clip-rule="evenodd"/><path fill-rule="evenodd" d="M14 0a2 2 0 0 1 2 2v5.5H0V2a2 2 0 0 1 2-2zM6.5 3.5a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1z" clip-rule="evenodd" opacity=".4"/>
  </symbol>
  <symbol id="diffs-icon-expand" viewBox="0 0 16 16">
    <path d="M3.47 5.47a.75.75 0 0 1 1.06 0L8 8.94l3.47-3.47a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 0 1 0-1.06"/>
  </symbol>
  <symbol id="diffs-icon-expand-all" viewBox="0 0 16 16">
    <path d="M11.47 9.47a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 1 1 1.06-1.06L8 12.94zM7.526 1.418a.75.75 0 0 1 1.004.052l4 4a.75.75 0 1 1-1.06 1.06L8 3.06 4.53 6.53a.75.75 0 1 1-1.06-1.06l4-4z"/>
  </symbol>
  <symbol id="diffs-icon-file-code" viewBox="0 0 16 16">
    <path d="M10.75 0c.199 0 .39.08.53.22l3.5 3.5c.14.14.22.331.22.53v9A2.75 2.75 0 0 1 12.25 16h-8.5A2.75 2.75 0 0 1 1 13.25V2.75A2.75 2.75 0 0 1 3.75 0zm-7 1.5c-.69 0-1.25.56-1.25 1.25v10.5c0 .69.56 1.25 1.25 1.25h8.5c.69 0 1.25-.56 1.25-1.25V5h-1.25A2.25 2.25 0 0 1 10 2.75V1.5z"/><path d="M7.248 6.19a.75.75 0 0 1 .063 1.058L5.753 9l1.558 1.752a.75.75 0 0 1-1.122.996l-2-2.25a.75.75 0 0 1 0-.996l2-2.25a.75.75 0 0 1 1.06-.063M8.69 7.248a.75.75 0 1 1 1.12-.996l2 2.25a.75.75 0 0 1 0 .996l-2 2.25a.75.75 0 1 1-1.12-.996L10.245 9z"/>
  </symbol>
  <symbol id="diffs-icon-plus" viewBox="0 0 16 16">
    <path d="M8 3a.75.75 0 0 1 .75.75v3.5h3.5a.75.75 0 0 1 0 1.5h-3.5v3.5a.75.75 0 0 1-1.5 0v-3.5h-3.5a.75.75 0 0 1 0-1.5h3.5v-3.5A.75.75 0 0 1 8 3"/>
  </symbol>
  <symbol id="diffs-icon-symbol-added" viewBox="0 0 16 16">
    <path d="M8 4a.75.75 0 0 1 .75.75v2.5h2.5a.75.75 0 0 1 0 1.5h-2.5v2.5a.75.75 0 0 1-1.5 0v-2.5h-2.5a.75.75 0 0 1 0-1.5h2.5v-2.5A.75.75 0 0 1 8 4"/><path d="M1.788 4.296c.196-.88.478-1.381.802-1.706s.826-.606 1.706-.802C5.194 1.588 6.387 1.5 8 1.5s2.806.088 3.704.288c.88.196 1.381.478 1.706.802s.607.826.802 1.706c.2.898.288 2.091.288 3.704s-.088 2.806-.288 3.704c-.195.88-.478 1.381-.802 1.706s-.826.607-1.706.802c-.898.2-2.091.288-3.704.288s-2.806-.088-3.704-.288c-.88-.195-1.381-.478-1.706-.802s-.606-.826-.802-1.706C1.588 10.806 1.5 9.613 1.5 8s.088-2.806.288-3.704M8 0C1.412 0 0 1.412 0 8s1.412 8 8 8 8-1.412 8-8-1.412-8-8-8"/>
  </symbol>
  <symbol id="diffs-icon-symbol-deleted" viewBox="0 0 16 16">
    <path d="M4 8a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5A.75.75 0 0 1 4 8"/><path d="M1.788 4.296c.196-.88.478-1.381.802-1.706s.826-.606 1.706-.802C5.194 1.588 6.387 1.5 8 1.5s2.806.088 3.704.288c.88.196 1.381.478 1.706.802s.607.826.802 1.706c.2.898.288 2.091.288 3.704s-.088 2.806-.288 3.704c-.195.88-.478 1.381-.802 1.706s-.826.607-1.706.802c-.898.2-2.091.288-3.704.288s-2.806-.088-3.704-.288c-.88-.195-1.381-.478-1.706-.802s-.606-.826-.802-1.706C1.588 10.806 1.5 9.613 1.5 8s.088-2.806.288-3.704M8 0C1.412 0 0 1.412 0 8s1.412 8 8 8 8-1.412 8-8-1.412-8-8-8"/>
  </symbol>
  <symbol id="diffs-icon-symbol-diffstat" viewBox="0 0 16 16">
    <path d="M1.788 4.296c.196-.88.478-1.381.802-1.706s.826-.606 1.706-.802C5.194 1.588 6.387 1.5 8 1.5s2.806.088 3.704.288c.88.196 1.381.478 1.706.802s.607.826.802 1.706c.2.898.288 2.091.288 3.704s-.088 2.806-.288 3.704c-.195.88-.478 1.381-.802 1.706s-.826.607-1.706.802c-.898.2-2.091.288-3.704.288s-2.806-.088-3.704-.288c-.88-.195-1.381-.478-1.706-.802s-.606-.826-.802-1.706C1.588 10.806 1.5 9.613 1.5 8s.088-2.806.288-3.704M8 0C1.412 0 0 1.412 0 8s1.412 8 8 8 8-1.412 8-8-1.412-8-8-8"/><path d="M8.75 4.296a.75.75 0 0 0-1.5 0V6.25h-2a.75.75 0 0 0 0 1.5h2v1.5h1.5v-1.5h2a.75.75 0 0 0 0-1.5h-2zM5.25 10a.75.75 0 0 0 0 1.5h5.5a.75.75 0 0 0 0-1.5z"/>
  </symbol>
  <symbol id="diffs-icon-symbol-ignored" viewBox="0 0 16 16">
    <path d="M1.5 8c0 1.613.088 2.806.288 3.704.196.88.478 1.381.802 1.706s.826.607 1.706.802c.898.2 2.091.288 3.704.288s2.806-.088 3.704-.288c.88-.195 1.381-.478 1.706-.802s.607-.826.802-1.706c.2-.898.288-2.091.288-3.704s-.088-2.806-.288-3.704c-.195-.88-.478-1.381-.802-1.706s-.826-.606-1.706-.802C10.806 1.588 9.613 1.5 8 1.5s-2.806.088-3.704.288c-.88.196-1.381.478-1.706.802s-.606.826-.802 1.706C1.588 5.194 1.5 6.387 1.5 8M0 8c0-6.588 1.412-8 8-8s8 1.412 8 8-1.412 8-8 8-8-1.412-8-8m11.53-2.47a.75.75 0 0 0-1.06-1.06l-6 6a.75.75 0 1 0 1.06 1.06z"/>
  </symbol>
  <symbol id="diffs-icon-symbol-modified" viewBox="0 0 16 16">
    <path d="M1.5 8c0 1.613.088 2.806.288 3.704.196.88.478 1.381.802 1.706s.826.607 1.706.802c.898.2 2.091.288 3.704.288s2.806-.088 3.704-.288c.88-.195 1.381-.478 1.706-.802s.607-.826.802-1.706c.2-.898.288-2.091.288-3.704s-.088-2.806-.288-3.704c-.195-.88-.478-1.381-.802-1.706s-.826-.606-1.706-.802C10.806 1.588 9.613 1.5 8 1.5s-2.806.088-3.704.288c-.88.196-1.381.478-1.706.802s-.606.826-.802 1.706C1.588 5.194 1.5 6.387 1.5 8M0 8c0-6.588 1.412-8 8-8s8 1.412 8 8-1.412 8-8 8-8-1.412-8-8m8 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6"/>
  </symbol>
  <symbol id="diffs-icon-symbol-moved" viewBox="0 0 16 16">
    <path d="M1.788 4.296c.196-.88.478-1.381.802-1.706s.826-.606 1.706-.802C5.194 1.588 6.387 1.5 8 1.5s2.806.088 3.704.288c.88.196 1.381.478 1.706.802s.607.826.802 1.706c.2.898.288 2.091.288 3.704s-.088 2.806-.288 3.704c-.195.88-.478 1.381-.802 1.706s-.826.607-1.706.802c-.898.2-2.091.288-3.704.288s-2.806-.088-3.704-.288c-.88-.195-1.381-.478-1.706-.802s-.606-.826-.802-1.706C1.588 10.806 1.5 9.613 1.5 8s.088-2.806.288-3.704M8 0C1.412 0 0 1.412 0 8s1.412 8 8 8 8-1.412 8-8-1.412-8-8-8"/><path d="M8.495 4.695a.75.75 0 0 0-.05 1.06L10.486 8l-2.041 2.246a.75.75 0 0 0 1.11 1.008l2.5-2.75a.75.75 0 0 0 0-1.008l-2.5-2.75a.75.75 0 0 0-1.06-.051m-4 0a.75.75 0 0 0-.05 1.06l2.044 2.248-1.796 1.995a.75.75 0 0 0 1.114 1.004l2.25-2.5a.75.75 0 0 0-.002-1.007l-2.5-2.75a.75.75 0 0 0-1.06-.05"/>
  </symbol>
  <symbol id="diffs-icon-symbol-ref" viewBox="0 0 16 16">
    <path d="M1.5 8c0 1.613.088 2.806.288 3.704.196.88.478 1.381.802 1.706.286.286.71.54 1.41.73V1.86c-.7.19-1.124.444-1.41.73-.324.325-.606.826-.802 1.706C1.588 5.194 1.5 6.387 1.5 8m4 6.397c.697.07 1.522.103 2.5.103 1.613 0 2.806-.088 3.704-.288.88-.195 1.381-.478 1.706-.802s.607-.826.802-1.706c.2-.898.288-2.091.288-3.704s-.088-2.806-.288-3.704c-.195-.88-.478-1.381-.802-1.706s-.826-.606-1.706-.802C10.806 1.588 9.613 1.5 8 1.5c-.978 0-1.803.033-2.5.103zM0 8c0-6.588 1.412-8 8-8s8 1.412 8 8-1.412 8-8 8-8-1.412-8-8m7-2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z"/>
  </symbol>
</svg>`;

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/areLineAnnotationsEqual.js
function areLineAnnotationsEqual(annotationA, annotationB) {
  return annotationA.lineNumber === annotationB.lineNumber && annotationA.metadata === annotationB.metadata;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/arePrePropertiesEqual.js
function arePrePropertiesEqual(propsA, propsB) {
  if (propsA == null || propsB == null) return propsA === propsB;
  return areCustomPropertiesEqual(propsA.customProperties, propsB.customProperties) && propsA.type === propsB.type && propsA.diffIndicators === propsB.diffIndicators && propsA.disableBackground === propsB.disableBackground && propsA.disableLineNumbers === propsB.disableLineNumbers && propsA.overflow === propsB.overflow && propsA.split === propsB.split && propsA.totalLines === propsB.totalLines;
}
var EMPTY_CUSTOM_PROPERTIES = {};
function areCustomPropertiesEqual(customPropertiesA = EMPTY_CUSTOM_PROPERTIES, customPropertiesB = EMPTY_CUSTOM_PROPERTIES) {
  if (customPropertiesA === customPropertiesB) return true;
  const keysA = Object.keys(customPropertiesA);
  const keysB = Object.keys(customPropertiesB);
  if (keysA.length !== keysB.length) return false;
  for (const key2 of keysA) if (customPropertiesA[key2] !== customPropertiesB[key2]) return false;
  return true;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/createAnnotationWrapperNode.js
function createAnnotationWrapperNode(slot) {
  const wrapper = document.createElement("div");
  wrapper.dataset.annotationSlot = "";
  wrapper.slot = slot;
  wrapper.style.whiteSpace = "normal";
  return wrapper;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/createGutterUtilityContentNode.js
function createGutterUtilityContentNode() {
  const gutterUtilityContent = document.createElement("div");
  gutterUtilityContent.slot = "gutter-utility-slot";
  gutterUtilityContent.style.position = "absolute";
  gutterUtilityContent.style.top = "0";
  gutterUtilityContent.style.bottom = "0";
  gutterUtilityContent.style.textAlign = "center";
  gutterUtilityContent.style.whiteSpace = "normal";
  return gutterUtilityContent;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/createUnsafeCSSStyleNode.js
function createUnsafeCSSStyleNode() {
  const node = document.createElement("style");
  node.setAttribute(UNSAFE_CSS_ATTRIBUTE, "");
  return node;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/style.js
var style_default = "@layer base, theme, rendered, unsafe;\n\n@layer base {\n  :host {\n    --diffs-font-fallback:\n      'SF Mono', Monaco, Consolas, 'Ubuntu Mono', 'Liberation Mono',\n      'Courier New', monospace;\n    --diffs-header-font-fallback:\n      system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue',\n      'Noto Sans', 'Liberation Sans', Arial, sans-serif;\n\n    --diffs-mixer: light-dark(black, white);\n    --diffs-gap-fallback: 8px;\n\n    --diffs-added-light: #0dbe4e;\n    --diffs-added-dark: #5ecc71;\n    --diffs-modified-light: #009fff;\n    --diffs-modified-dark: #69b1ff;\n    --diffs-deleted-light: #ff2e3f;\n    --diffs-deleted-dark: #ff6762;\n\n    /*\n    // Available CSS Color Overrides\n    --diffs-bg-buffer-override\n    --diffs-bg-hover-override\n    --diffs-bg-context-override\n    --diffs-bg-separator-override\n\n    --diffs-fg-number-override\n    --diffs-fg-number-addition-override\n    --diffs-fg-number-deletion-override\n    --diffs-fg-conflict-marker-override\n\n    --diffs-deletion-color-override\n    --diffs-addition-color-override\n    --diffs-modified-color-override\n\n    --diffs-bg-deletion-override\n    --diffs-bg-deletion-number-override\n    --diffs-bg-deletion-hover-override\n    --diffs-bg-deletion-emphasis-override\n\n    --diffs-bg-addition-override\n    --diffs-bg-addition-number-override\n    --diffs-bg-addition-hover-override\n    --diffs-bg-addition-emphasis-override\n\n    // Line Selection Color Overrides (for enableLineSelection)\n    --diffs-selection-color-override\n    --diffs-bg-selection-override\n    --diffs-bg-selection-number-override\n    --diffs-bg-selection-background-override\n    --diffs-bg-selection-number-background-override\n\n    // Available CSS Layout Overrides\n    --diffs-gap-inline\n    --diffs-gap-block\n    --diffs-gap-style\n    --diffs-tab-size\n  */\n\n    color-scheme: light dark;\n    display: block;\n    font-family: var(\n      --diffs-header-font-family,\n      var(--diffs-header-font-fallback)\n    );\n    font-size: var(--diffs-font-size, 13px);\n    line-height: var(--diffs-line-height, 20px);\n    font-feature-settings: var(--diffs-font-features);\n\n    /* NOTE(amadeus): we cannot use 'in oklch' because current versions of cursor\n     * and vscode use an older build of chrome that appears to have a bug with\n     * color-mix and 'in oklch', so use 'in lab' instead */\n    --diffs-bg: light-dark(\n      var(--diffs-light-bg, #fff),\n      var(--diffs-dark-bg, #000)\n    );\n    --diffs-bg-buffer: var(\n      --diffs-bg-buffer-override,\n      light-dark(\n        color-mix(in lab, var(--diffs-bg) 92%, var(--diffs-mixer)),\n        color-mix(in lab, var(--diffs-bg) 92%, var(--diffs-mixer))\n      )\n    );\n    --diffs-bg-hover: var(\n      --diffs-bg-hover-override,\n      light-dark(\n        color-mix(in lab, var(--diffs-bg) 97%, var(--diffs-mixer)),\n        color-mix(in lab, var(--diffs-bg) 91%, var(--diffs-mixer))\n      )\n    );\n\n    --diffs-bg-context: var(\n      --diffs-bg-context-override,\n      light-dark(\n        color-mix(in lab, var(--diffs-bg) 98.5%, var(--diffs-mixer)),\n        color-mix(in lab, var(--diffs-bg) 92.5%, var(--diffs-mixer))\n      )\n    );\n    --diffs-bg-context-number: var(\n      --diffs-bg-context-number-override,\n      light-dark(\n        color-mix(in lab, var(--diffs-bg-context) 80%, var(--diffs-bg)),\n        color-mix(in lab, var(--diffs-bg-context) 60%, var(--diffs-bg))\n      )\n    );\n    --diffs-bg-conflict-marker: var(\n      --diffs-bg-conflict-marker-override,\n      light-dark(\n        color-mix(\n          in lab,\n          var(--diffs-bg-context) 88%,\n          var(--diffs-modified-base)\n        ),\n        color-mix(\n          in lab,\n          var(--diffs-bg-context) 80%,\n          var(--diffs-modified-base)\n        )\n      )\n    );\n    --diffs-bg-conflict-current: var(\n      --diffs-bg-conflict-current-override,\n      light-dark(#e5f8ea, #274432)\n    );\n    --diffs-bg-conflict-base: var(\n      --diffs-bg-conflict-base-override,\n      light-dark(\n        color-mix(\n          in lab,\n          var(--diffs-bg-context) 90%,\n          var(--diffs-modified-base)\n        ),\n        color-mix(\n          in lab,\n          var(--diffs-bg-context) 82%,\n          var(--diffs-modified-base)\n        )\n      )\n    );\n    --diffs-bg-conflict-incoming: var(\n      --diffs-bg-conflict-incoming-override,\n      light-dark(#e6f1ff, #253b5a)\n    );\n    --diffs-bg-conflict-marker-number: var(\n      --diffs-bg-conflict-marker-number-override,\n      light-dark(\n        color-mix(in lab, var(--diffs-bg-conflict-marker) 72%, var(--diffs-bg)),\n        color-mix(in lab, var(--diffs-bg-conflict-marker) 54%, var(--diffs-bg))\n      )\n    );\n    --diffs-bg-conflict-current-number: var(\n      --diffs-bg-conflict-current-number-override,\n      light-dark(#d7f1de, #30533d)\n    );\n    --diffs-bg-conflict-base-number: var(\n      --diffs-bg-conflict-base-number-override,\n      light-dark(\n        color-mix(in lab, var(--diffs-bg-conflict-base) 72%, var(--diffs-bg)),\n        color-mix(in lab, var(--diffs-bg-conflict-base) 54%, var(--diffs-bg))\n      )\n    );\n    --diffs-bg-conflict-incoming-number: var(\n      --diffs-bg-conflict-incoming-number-override,\n      light-dark(#d8e8ff, #2f4b73)\n    );\n    --conflict-bg-current: var(\n      --conflict-bg-current-override,\n      var(--diffs-bg-addition)\n    );\n    --conflict-bg-incoming: var(\n      --conflict-bg-incoming-override,\n      light-dark(\n        color-mix(in lab, var(--diffs-bg) 88%, var(--diffs-modified-base)),\n        color-mix(in lab, var(--diffs-bg) 80%, var(--diffs-modified-base))\n      )\n    );\n    --conflict-bg-current-number: var(\n      --conflict-bg-current-number-override,\n      var(--diffs-bg-addition-number)\n    );\n    --conflict-bg-incoming-number: var(\n      --conflict-bg-incoming-number-override,\n      light-dark(\n        color-mix(in lab, var(--diffs-bg) 91%, var(--diffs-modified-base)),\n        color-mix(in lab, var(--diffs-bg) 85%, var(--diffs-modified-base))\n      )\n    );\n    --conflict-bg-current-header: var(\n      --conflict-bg-current-header-override,\n      light-dark(\n        color-mix(in lab, var(--diffs-bg) 78%, var(--diffs-addition-base)),\n        color-mix(in lab, var(--diffs-bg) 68%, var(--diffs-addition-base))\n      )\n    );\n    --conflict-bg-incoming-header: var(\n      --conflict-bg-incoming-header-override,\n      light-dark(\n        color-mix(in lab, var(--diffs-bg) 78%, var(--diffs-modified-base)),\n        color-mix(in lab, var(--diffs-bg) 68%, var(--diffs-modified-base))\n      )\n    );\n    --conflict-bg-current-header-number: var(\n      --conflict-bg-current-header-number-override,\n      light-dark(\n        color-mix(in lab, var(--diffs-bg) 72%, var(--diffs-addition-base)),\n        color-mix(in lab, var(--diffs-bg) 62%, var(--diffs-addition-base))\n      )\n    );\n    --conflict-bg-incoming-header-number: var(\n      --conflict-bg-incoming-header-number-override,\n      light-dark(\n        color-mix(in lab, var(--diffs-bg) 72%, var(--diffs-modified-base)),\n        color-mix(in lab, var(--diffs-bg) 62%, var(--diffs-modified-base))\n      )\n    );\n\n    --diffs-bg-separator: var(\n      --diffs-bg-separator-override,\n      light-dark(\n        color-mix(in lab, var(--diffs-bg) 96%, var(--diffs-mixer)),\n        color-mix(in lab, var(--diffs-bg) 85%, var(--diffs-mixer))\n      )\n    );\n\n    --diffs-fg: light-dark(var(--diffs-light, #000), var(--diffs-dark, #fff));\n    --diffs-fg-number: var(\n      --diffs-fg-number-override,\n      light-dark(\n        color-mix(in lab, var(--diffs-fg) 65%, var(--diffs-bg)),\n        color-mix(in lab, var(--diffs-fg) 65%, var(--diffs-bg))\n      )\n    );\n    --diffs-fg-conflict-marker: var(\n      --diffs-fg-conflict-marker-override,\n      var(--diffs-fg-number)\n    );\n\n    --diffs-deletion-base: var(\n      --diffs-deletion-color-override,\n      light-dark(\n        var(\n          --diffs-light-deletion-color,\n          var(--diffs-deletion-color, var(--diffs-deleted-light))\n        ),\n        var(\n          --diffs-dark-deletion-color,\n          var(--diffs-deletion-color, var(--diffs-deleted-dark))\n        )\n      )\n    );\n    --diffs-addition-base: var(\n      --diffs-addition-color-override,\n      light-dark(\n        var(\n          --diffs-light-addition-color,\n          var(--diffs-addition-color, var(--diffs-added-light))\n        ),\n        var(\n          --diffs-dark-addition-color,\n          var(--diffs-addition-color, var(--diffs-added-dark))\n        )\n      )\n    );\n    --diffs-modified-base: var(\n      --diffs-modified-color-override,\n      light-dark(\n        var(\n          --diffs-light-modified-color,\n          var(--diffs-modified-color, var(--diffs-modified-light))\n        ),\n        var(\n          --diffs-dark-modified-color,\n          var(--diffs-modified-color, var(--diffs-modified-dark))\n        )\n      )\n    );\n\n    /* NOTE(amadeus): we cannot use 'in oklch' because current versions of cursor\n   * and vscode use an older build of chrome that appears to have a bug with\n   * color-mix and 'in oklch', so use 'in lab' instead */\n    --diffs-bg-deletion: var(\n      --diffs-bg-deletion-override,\n      light-dark(\n        color-mix(in lab, var(--diffs-bg) 88%, var(--diffs-deletion-base)),\n        color-mix(in lab, var(--diffs-bg) 80%, var(--diffs-deletion-base))\n      )\n    );\n    --diffs-bg-deletion-number: var(\n      --diffs-bg-deletion-number-override,\n      light-dark(\n        color-mix(in lab, var(--diffs-bg) 91%, var(--diffs-deletion-base)),\n        color-mix(in lab, var(--diffs-bg) 85%, var(--diffs-deletion-base))\n      )\n    );\n    --diffs-bg-deletion-hover: var(\n      --diffs-bg-deletion-hover-override,\n      light-dark(\n        color-mix(in lab, var(--diffs-bg) 80%, var(--diffs-deletion-base)),\n        color-mix(in lab, var(--diffs-bg) 75%, var(--diffs-deletion-base))\n      )\n    );\n    --diffs-bg-deletion-emphasis: var(\n      --diffs-bg-deletion-emphasis-override,\n      light-dark(\n        rgb(from var(--diffs-deletion-base) r g b / 0.15),\n        rgb(from var(--diffs-deletion-base) r g b / 0.2)\n      )\n    );\n\n    --diffs-bg-addition: var(\n      --diffs-bg-addition-override,\n      light-dark(\n        color-mix(in lab, var(--diffs-bg) 88%, var(--diffs-addition-base)),\n        color-mix(in lab, var(--diffs-bg) 80%, var(--diffs-addition-base))\n      )\n    );\n    --diffs-bg-addition-number: var(\n      --diffs-bg-addition-number-override,\n      light-dark(\n        color-mix(in lab, var(--diffs-bg) 91%, var(--diffs-addition-base)),\n        color-mix(in lab, var(--diffs-bg) 85%, var(--diffs-addition-base))\n      )\n    );\n    --diffs-bg-addition-hover: var(\n      --diffs-bg-addition-hover-override,\n      light-dark(\n        color-mix(in lab, var(--diffs-bg) 80%, var(--diffs-addition-base)),\n        color-mix(in lab, var(--diffs-bg) 70%, var(--diffs-addition-base))\n      )\n    );\n    --diffs-bg-addition-emphasis: var(\n      --diffs-bg-addition-emphasis-override,\n      light-dark(\n        rgb(from var(--diffs-addition-base) r g b / 0.15),\n        rgb(from var(--diffs-addition-base) r g b / 0.2)\n      )\n    );\n\n    --diffs-selection-base: var(--diffs-modified-base);\n    --diffs-selection-number-fg: light-dark(\n      color-mix(in lab, var(--diffs-selection-base) 65%, var(--diffs-mixer)),\n      color-mix(in lab, var(--diffs-selection-base) 75%, var(--diffs-mixer))\n    );\n    --diffs-bg-selection: var(\n      --diffs-bg-selection-override,\n      light-dark(\n        color-mix(in lab, var(--diffs-bg) 82%, var(--diffs-selection-base)),\n        color-mix(in lab, var(--diffs-bg) 75%, var(--diffs-selection-base))\n      )\n    );\n    --diffs-bg-selection-number: var(\n      --diffs-bg-selection-number-override,\n      light-dark(\n        color-mix(in lab, var(--diffs-bg) 75%, var(--diffs-selection-base)),\n        color-mix(in lab, var(--diffs-bg) 60%, var(--diffs-selection-base))\n      )\n    );\n\n    background-color: var(--diffs-bg);\n    color: var(--diffs-fg);\n  }\n\n  /* NOTE(mdo): Some semantic HTML elements (e.g. `pre`, `code`) have default\n * user-agent styles. These must be overridden to use our custom styles. */\n  pre,\n  code,\n  [data-error-wrapper] {\n    isolation: isolate;\n    margin: 0;\n    padding: 0;\n    display: block;\n    outline: none;\n    font-family: var(--diffs-font-family, var(--diffs-font-fallback));\n  }\n\n  pre,\n  code {\n    background-color: var(--diffs-bg);\n  }\n\n  code {\n    contain: content;\n  }\n\n  *,\n  *::before,\n  *::after {\n    box-sizing: border-box;\n  }\n\n  [data-icon-sprite] {\n    display: none;\n  }\n\n  /* NOTE(mdo): Headers and separators are within pre/code, so we need to reset\n   * their font-family explicitly. */\n  [data-diffs-header],\n  [data-separator] {\n    font-family: var(\n      --diffs-header-font-family,\n      var(--diffs-header-font-fallback)\n    );\n  }\n\n  [data-file-info] {\n    padding: 10px;\n    font-weight: 700;\n    color: var(--fg);\n    /* NOTE(amadeus): we cannot use 'in oklch' because current versions of cursor\n   * and vscode use an older build of chrome that appears to have a bug with\n   * color-mix and 'in oklch', so use 'in lab' instead */\n    background-color: color-mix(in lab, var(--bg) 98%, var(--fg));\n    border-block: 1px solid color-mix(in lab, var(--bg) 95%, var(--fg));\n  }\n\n  [data-diff],\n  [data-file] {\n    /* This feels a bit crazy to me... so I need to think about it a bit more... */\n    --diffs-grid-number-column-width: minmax(min-content, max-content);\n    --diffs-code-grid: var(--diffs-grid-number-column-width) 1fr;\n\n    &[data-dehydrated] {\n      --diffs-code-grid: var(--diffs-grid-number-column-width) minmax(0, 1fr);\n    }\n\n    &:hover [data-code]::-webkit-scrollbar-thumb {\n      background-color: var(--diffs-bg-context);\n    }\n  }\n\n  [data-line] span {\n    color: light-dark(\n      var(--diffs-token-light, var(--diffs-light)),\n      var(--diffs-token-dark, var(--diffs-dark))\n    );\n    background-color: light-dark(\n      var(--diffs-token-light-bg, inherit),\n      var(--diffs-token-dark-bg, inherit)\n    );\n    font-weight: light-dark(\n      var(--diffs-token-light-font-weight, inherit),\n      var(--diffs-token-dark-font-weight, inherit)\n    );\n    font-style: light-dark(\n      var(--diffs-token-light-font-style, inherit),\n      var(--diffs-token-dark-font-style, inherit)\n    );\n    -webkit-text-decoration: light-dark(\n      var(--diffs-token-light-text-decoration, inherit),\n      var(--diffs-token-dark-text-decoration, inherit)\n    );\n            text-decoration: light-dark(\n      var(--diffs-token-light-text-decoration, inherit),\n      var(--diffs-token-dark-text-decoration, inherit)\n    );\n  }\n\n  [data-line],\n  [data-gutter-buffer],\n  [data-line-annotation],\n  [data-no-newline] {\n    color: var(--diffs-fg);\n    background-color: var(--diffs-line-bg, var(--diffs-bg));\n  }\n\n  [data-no-newline] {\n    -webkit-user-select: none;\n            user-select: none;\n\n    span {\n      opacity: 0.6;\n    }\n  }\n\n  [data-diff-type='split'][data-overflow='scroll'] {\n    display: grid;\n    grid-template-columns: 1fr 1fr;\n\n    [data-additions] {\n      border-left: 1px solid var(--diffs-bg);\n    }\n\n    [data-deletions] {\n      border-right: 1px solid var(--diffs-bg);\n    }\n  }\n\n  [data-code] {\n    display: grid;\n    grid-auto-flow: dense;\n    grid-template-columns: var(--diffs-code-grid);\n    overflow: scroll clip;\n    overscroll-behavior-x: none;\n    tab-size: var(--diffs-tab-size, 2);\n    align-self: flex-start;\n    padding-top: var(--diffs-gap-block, var(--diffs-gap-fallback));\n    padding-bottom: max(\n      0px,\n      calc(var(--diffs-gap-block, var(--diffs-gap-fallback)) - 6px)\n    );\n  }\n\n  [data-container-size] {\n    container-type: inline-size;\n  }\n\n  [data-code]::-webkit-scrollbar {\n    width: 0;\n    height: 6px;\n  }\n\n  [data-code]::-webkit-scrollbar-track {\n    background: transparent;\n  }\n\n  [data-code]::-webkit-scrollbar-thumb {\n    background-color: transparent;\n    border: 1px solid transparent;\n    background-clip: content-box;\n    border-radius: 3px;\n  }\n\n  [data-code]::-webkit-scrollbar-corner {\n    background-color: transparent;\n  }\n\n  /*\n   * If we apply these rules globally it will mean that webkit will opt into the\n   * standards compliant version of custom css scrollbars, which we do not want\n   * because the custom stuff will look better\n  */\n  @supports (-moz-appearance: none) {\n    [data-code] {\n      scrollbar-width: thin;\n      scrollbar-color: var(--diffs-bg-context) transparent;\n      padding-bottom: var(--diffs-gap-block, var(--diffs-gap-fallback));\n    }\n  }\n\n  [data-diffs-header] ~ [data-diff],\n  [data-diffs-header] ~ [data-file] {\n    [data-code],\n    &[data-overflow='wrap'] {\n      padding-top: 0;\n    }\n  }\n\n  [data-gutter] {\n    display: grid;\n    grid-template-rows: subgrid;\n    grid-template-columns: subgrid;\n    grid-column: 1;\n    z-index: 3;\n    position: relative;\n    background-color: var(--diffs-bg);\n\n    [data-gutter-buffer],\n    [data-column-number] {\n      border-right: var(--diffs-gap-style, 2px solid var(--diffs-bg));\n    }\n  }\n\n  [data-content] {\n    display: grid;\n    grid-template-rows: subgrid;\n    grid-template-columns: subgrid;\n    grid-column: 2;\n    min-width: 0;\n  }\n\n  [data-diff-type='split'][data-overflow='wrap'] {\n    display: grid;\n    grid-auto-flow: dense;\n    grid-template-columns: repeat(2, var(--diffs-code-grid));\n    padding-block: var(--diffs-gap-block, var(--diffs-gap-fallback));\n\n    [data-deletions] {\n      display: contents;\n\n      [data-gutter] {\n        grid-column: 1;\n      }\n\n      [data-content] {\n        grid-column: 2;\n        border-right: 1px solid var(--diffs-bg);\n      }\n    }\n\n    [data-additions] {\n      display: contents;\n\n      [data-gutter] {\n        grid-column: 3;\n        border-left: 1px solid var(--diffs-bg);\n      }\n\n      [data-content] {\n        grid-column: 4;\n      }\n    }\n  }\n\n  [data-overflow='scroll'] [data-gutter] {\n    position: sticky;\n    left: 0;\n  }\n\n  [data-line-annotation][data-selected-line] {\n    background-color: unset;\n\n    &::before {\n      content: '';\n      /* FIXME(amadeus): This needs to be audited ... */\n      position: sticky;\n      top: 0;\n      left: 0;\n      display: block;\n      border-right: var(--diffs-gap-style, 1px solid var(--diffs-bg));\n      background-color: var(--diffs-bg-selection-number);\n    }\n\n    [data-annotation-content] {\n      background-color: var(--diffs-bg-selection);\n    }\n  }\n\n  [data-interactive-lines] [data-line] {\n    cursor: pointer;\n  }\n\n  [data-content-buffer],\n  [data-gutter-buffer] {\n    position: relative;\n    -webkit-user-select: none;\n            user-select: none;\n    min-height: 1lh;\n  }\n\n  [data-gutter-buffer='annotation'] {\n    min-height: 0;\n  }\n\n  [data-gutter-buffer='buffer'] {\n    background-size: 8px 8px;\n    background-position: 0 0;\n    background-origin: border-box;\n    background-color: var(--diffs-bg);\n    /* This is incredibley expensive... */\n    background-image: repeating-linear-gradient(\n      -45deg,\n      transparent,\n      transparent calc(3px * 1.414),\n      rgb(from var(--diffs-bg-buffer) r g b / 0.8) calc(3px * 1.414),\n      rgb(from var(--diffs-bg-buffer) r g b / 0.8) calc(4px * 1.414)\n    );\n  }\n\n  [data-content-buffer] {\n    grid-column: 1;\n    /* We multiply by 1.414 (\u221A2) to better approximate the diagonal repeat distance */\n    background-size: 8px 8px;\n    background-position: 5px 0;\n    background-origin: border-box;\n    background-color: var(--diffs-bg);\n    /* This is incredibley expensive... */\n    background-image: repeating-linear-gradient(\n      -45deg,\n      transparent,\n      transparent calc(3px * 1.414),\n      var(--diffs-bg-buffer) calc(3px * 1.414),\n      var(--diffs-bg-buffer) calc(4px * 1.414)\n    );\n  }\n\n  [data-separator] {\n    box-sizing: content-box;\n    background-color: var(--diffs-bg);\n  }\n\n  [data-separator='simple'] {\n    min-height: 4px;\n  }\n\n  [data-separator='line-info'],\n  [data-separator='line-info-basic'],\n  [data-separator='metadata'],\n  [data-separator='simple'] {\n    background-color: var(--diffs-bg-separator);\n  }\n\n  [data-separator='line-info'],\n  [data-separator='line-info-basic'],\n  [data-separator='metadata'] {\n    height: 32px;\n    position: relative;\n  }\n\n  [data-separator-wrapper] {\n    -webkit-user-select: none;\n            user-select: none;\n    fill: currentColor;\n    position: absolute;\n    inset-inline: 0;\n    display: flex;\n    align-items: center;\n    background-color: var(--diffs-bg);\n    height: 100%;\n  }\n\n  [data-content] [data-separator-wrapper] {\n    display: none;\n  }\n\n  [data-separator='metadata'] [data-separator-wrapper] {\n    inset-inline: 100% auto;\n    padding-inline: 1ch;\n    height: 100%;\n    background-color: var(--diffs-bg-separator);\n    color: var(--diffs-fg-number);\n    white-space: nowrap;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    min-width: min-content;\n  }\n\n  [data-separator='line-info'] {\n    margin-block: var(--diffs-gap-block, var(--diffs-gap-fallback));\n  }\n\n  [data-separator='line-info-basic'],\n  [data-separator='metadata'] {\n    margin-block: 0;\n  }\n\n  [data-separator='line-info'][data-separator-first] {\n    margin-top: 0;\n  }\n\n  [data-separator='line-info'][data-separator-last] {\n    margin-bottom: 0;\n  }\n\n  [data-expand-index] [data-separator-wrapper] {\n    display: grid;\n    grid-template-columns: 32px auto;\n  }\n\n  [data-expand-index] [data-separator-wrapper][data-separator-multi-button] {\n    grid-template-columns: 32px 32px auto;\n  }\n\n  [data-expand-button],\n  [data-separator-content] {\n    display: flex;\n    flex: 0 0 auto;\n    align-items: center;\n    background-color: var(--diffs-bg-separator);\n  }\n\n  [data-expand-index] [data-separator-content]:hover {\n    text-decoration: underline;\n    cursor: pointer;\n  }\n\n  [data-expand-button] {\n    justify-content: center;\n    flex-shrink: 0;\n    cursor: pointer;\n    min-width: 32px;\n    align-self: stretch;\n    color: var(--diffs-fg-number);\n    border-right: 2px solid var(--diffs-bg);\n\n    &:hover {\n      color: var(--diffs-fg);\n    }\n\n    &[data-expand-all-button] {\n      display: none;\n    }\n  }\n\n  [data-expand-down] [data-icon] {\n    transform: scaleY(-1);\n  }\n\n  [data-separator-content] {\n    flex: 1 1 auto;\n    padding: 0 1ch;\n    height: 100%;\n    color: var(--diffs-fg-number);\n\n    overflow: hidden;\n    justify-content: flex-start;\n  }\n\n  [data-separator='line-info'],\n  [data-separator='line-info-basic'] {\n    [data-separator-content] {\n      height: 100%;\n      -webkit-user-select: none;\n              user-select: none;\n      overflow: clip;\n    }\n  }\n\n  @supports (width: 1cqi) {\n    [data-unified] {\n      [data-separator='line-info'] [data-separator-wrapper] {\n        padding-inline: var(--diffs-gap-inline, var(--diffs-gap-fallback));\n        width: 100cqi;\n\n        [data-separator-content] {\n          border-radius: 6px;\n        }\n      }\n\n      [data-separator='line-info'][data-expand-index]\n        [data-separator-wrapper]\n        [data-separator-content] {\n        border-top-left-radius: unset;\n        border-bottom-left-radius: unset;\n      }\n    }\n\n    [data-gutter] {\n      [data-separator='line-info'] [data-separator-wrapper] {\n        padding-left: var(--diffs-gap-inline, var(--diffs-gap-fallback));\n      }\n\n      [data-separator='line-info'] [data-separator-content] {\n        border-top-left-radius: 6px;\n        border-bottom-left-radius: 6px;\n      }\n\n      [data-separator='line-info'][data-expand-index] [data-separator-content] {\n        border-top-left-radius: unset;\n        border-bottom-left-radius: unset;\n      }\n    }\n\n    [data-additions] {\n      [data-content] [data-separator='line-info'] {\n        background-color: var(--diffs-bg);\n\n        [data-separator-wrapper] {\n          display: none;\n        }\n      }\n\n      [data-gutter] [data-separator='line-info'] [data-separator-wrapper] {\n        display: block;\n        height: 100%;\n        background-color: var(--diffs-bg-separator);\n        border-top-right-radius: 6px;\n        border-bottom-right-radius: 6px;\n\n        [data-separator-content],\n        [data-expand-button] {\n          display: none;\n        }\n      }\n    }\n\n    [data-overflow='scroll']\n      [data-additions]\n      [data-gutter]\n      [data-separator='line-info']\n      [data-separator-wrapper] {\n      width: calc(100cqi - var(--diffs-gap-inline, var(--diffs-gap-fallback)));\n    }\n\n    [data-overflow='wrap']\n      [data-additions]\n      [data-content]\n      [data-separator='line-info']\n      [data-separator-wrapper] {\n      background-color: var(--diffs-bg-separator);\n      display: block;\n      height: 100%;\n      margin-right: var(--diffs-gap-inline, var(--diffs-gap-fallback));\n      border-top-right-radius: 6px;\n      border-bottom-right-radius: 6px;\n\n      [data-separator-content],\n      [data-expand-button] {\n        display: none;\n      }\n    }\n\n    [data-separator='line-info'] [data-separator-wrapper] {\n      [data-expand-both],\n      [data-expand-down],\n      [data-expand-up] {\n        border-top-left-radius: 6px;\n        border-bottom-left-radius: 6px;\n      }\n    }\n\n    @media (pointer: fine) {\n      [data-separator='line-info'] [data-separator-wrapper] {\n        &[data-separator-multi-button] {\n          [data-expand-up] {\n            border-top-left-radius: 6px;\n            border-bottom-left-radius: unset;\n          }\n\n          [data-expand-down] {\n            border-bottom-left-radius: 6px;\n            border-top-left-radius: unset;\n          }\n        }\n      }\n    }\n  }\n\n  @media (pointer: coarse) {\n    [data-separator='line-info-basic']\n      [data-separator-wrapper][data-separator-multi-button] {\n      grid-template-columns: 34px 34px auto;\n\n      [data-separator-content] {\n        grid-column: unset;\n        grid-row: unset;\n      }\n    }\n\n    @supports (width: 1cqi) {\n      [data-separator='line-info'] [data-separator-wrapper] {\n        [data-expand-both],\n        [data-expand-down],\n        [data-expand-up] {\n          border-top-left-radius: 6px;\n          border-bottom-left-radius: 6px;\n        }\n\n        &[data-separator-multi-button] {\n          [data-expand-up] {\n            border-top-left-radius: 6px;\n            border-bottom-left-radius: 6px;\n          }\n\n          [data-expand-down] {\n            border-bottom-left-radius: unset;\n            border-top-left-radius: unset;\n          }\n        }\n      }\n    }\n  }\n\n  @media (pointer: fine) {\n    [data-separator-wrapper][data-separator-multi-button] {\n      display: grid;\n      grid-template-rows: 50% 50%;\n\n      [data-separator-content] {\n        grid-column: 2;\n        grid-row: 1 / -1;\n        min-width: min-content;\n      }\n\n      [data-expand-button] {\n        grid-column: 1;\n      }\n    }\n\n    [data-separator='line-info'] [data-separator-wrapper],\n    [data-separator='line-info']\n      [data-separator-wrapper][data-separator-multi-button] {\n      grid-template-columns: 34px auto;\n    }\n\n    [data-separator='line-info-basic'][data-expand-index]\n      [data-separator-wrapper] {\n      grid-template-columns: 100% auto;\n    }\n\n    [data-separator='line-info'],\n    [data-separator='line-info-basic'] {\n      [data-separator-multi-button] {\n        [data-expand-up] {\n          border-bottom: 1px solid var(--diffs-bg);\n          border-right: 2px solid var(--diffs-bg);\n        }\n        [data-expand-down] {\n          border-top: 1px solid var(--diffs-bg);\n          border-right: 2px solid var(--diffs-bg);\n        }\n      }\n    }\n  }\n\n  [data-additions] [data-gutter] [data-separator-wrapper],\n  [data-additions] [data-separator='line-info-basic'] [data-separator-wrapper],\n  [data-content] [data-separator-wrapper] {\n    display: none;\n  }\n\n  [data-line-annotation],\n  [data-gutter-buffer='annotation'] {\n    --diffs-line-bg: var(--diffs-bg-context);\n  }\n\n  [data-merge-conflict-actions],\n  [data-gutter-buffer='merge-conflict-action'] {\n    --diffs-line-bg: var(--diffs-bg-context);\n  }\n\n  [data-has-merge-conflict] [data-line-annotation],\n  [data-has-merge-conflict] [data-gutter-buffer='annotation'] {\n    --diffs-line-bg: var(--diffs-bg);\n  }\n\n  [data-has-merge-conflict] [data-gutter-buffer='merge-conflict-action'] {\n    --diffs-line-bg: var(--diffs-bg);\n  }\n\n  [data-line-annotation] {\n    min-height: var(--diffs-annotation-min-height, 0);\n    z-index: 2;\n  }\n\n  [data-merge-conflict-actions] {\n    z-index: 2;\n  }\n\n  [data-separator='custom'] {\n    display: grid;\n    grid-template-columns: subgrid;\n  }\n\n  [data-line],\n  [data-column-number],\n  [data-no-newline] {\n    position: relative;\n    padding-inline: 1ch;\n  }\n\n  [data-indicators='classic'] [data-line] {\n    padding-inline-start: 2ch;\n  }\n\n  [data-indicators='classic'] {\n    [data-line-type='change-addition'],\n    [data-line-type='change-deletion'] {\n      &[data-no-newline],\n      &[data-line] {\n        &::before {\n          display: inline-block;\n          width: 1ch;\n          height: 1lh;\n          position: absolute;\n          top: 0;\n          left: 0;\n          -webkit-user-select: none;\n                  user-select: none;\n        }\n      }\n    }\n\n    [data-line-type='change-addition'] {\n      &[data-line],\n      &[data-no-newline] {\n        &::before {\n          content: '+';\n          color: var(--diffs-addition-base);\n        }\n      }\n    }\n\n    [data-line-type='change-deletion'] {\n      &[data-line],\n      &[data-no-newline] {\n        &::before {\n          content: '-';\n          color: var(--diffs-deletion-base);\n        }\n      }\n    }\n  }\n\n  [data-indicators='bars'] {\n    [data-line-type='change-deletion'],\n    [data-line-type='change-addition'] {\n      &[data-column-number] {\n        &::before {\n          content: '';\n          display: block;\n          width: 4px;\n          height: 100%;\n          position: absolute;\n          top: 0;\n          left: 0;\n          -webkit-user-select: none;\n                  user-select: none;\n          contain: strict;\n        }\n      }\n    }\n\n    [data-line-type='change-deletion'] {\n      &[data-column-number] {\n        &::before {\n          background-image: linear-gradient(\n            0deg,\n            var(--diffs-bg-deletion) 50%,\n            var(--diffs-deletion-base) 50%\n          );\n          background-repeat: repeat;\n          background-size: 2px 2px;\n          background-size: calc(1lh / round(1lh / 2px))\n            calc(1lh / round(1lh / 2px));\n        }\n      }\n    }\n\n    [data-line-type='change-addition'] {\n      &[data-column-number] {\n        &::before {\n          background-color: var(--diffs-addition-base);\n        }\n      }\n    }\n  }\n\n  [data-overflow='wrap'] {\n    [data-line],\n    [data-annotation-content] {\n      white-space: pre-wrap;\n      word-break: break-word;\n    }\n  }\n\n  [data-overflow='scroll'] [data-line] {\n    white-space: pre;\n    min-height: 1lh;\n  }\n\n  [data-column-number] {\n    box-sizing: content-box;\n    text-align: right;\n    -webkit-user-select: none;\n            user-select: none;\n    background-color: var(--diffs-bg);\n    color: var(--diffs-fg-number);\n    padding-left: 2ch;\n  }\n\n  [data-line-number-content] {\n    display: inline-block;\n    min-width: var(\n      --diffs-min-number-column-width,\n      var(--diffs-min-number-column-width-default, 3ch)\n    );\n  }\n\n  [data-disable-line-numbers] {\n    [data-column-number] {\n      min-width: 4px;\n      padding: 0;\n    }\n\n    [data-line-number-content] {\n      display: none;\n    }\n\n    [data-gutter-utility-slot] {\n      right: unset;\n      left: 0;\n      justify-content: flex-start;\n    }\n\n    &[data-indicators='bars'] [data-gutter-utility-slot] {\n      /* Using 5px here because theres a 1px separator after the bar */\n      left: 5px;\n    }\n  }\n\n  [data-file][data-disable-line-numbers] {\n    [data-gutter-buffer],\n    [data-column-number] {\n      min-width: 0;\n      border-right: 0;\n    }\n  }\n\n  [data-interactive-line-numbers] [data-column-number] {\n    cursor: pointer;\n  }\n\n  [data-diff-span] {\n    border-radius: 3px;\n    -webkit-box-decoration-break: clone;\n            box-decoration-break: clone;\n  }\n\n  [data-line-type='change-addition'] {\n    &[data-column-number] {\n      color: var(\n        --diffs-fg-number-addition-override,\n        var(--diffs-addition-base)\n      );\n    }\n\n    [data-diff-span] {\n      background-color: var(--diffs-bg-addition-emphasis);\n    }\n  }\n\n  [data-line-type='change-deletion'] {\n    &[data-column-number] {\n      color: var(\n        --diffs-fg-number-deletion-override,\n        var(--diffs-deletion-base)\n      );\n    }\n\n    [data-diff-span] {\n      background-color: var(--diffs-bg-deletion-emphasis);\n    }\n  }\n\n  [data-background] [data-line-type='change-addition'] {\n    --diffs-line-bg: var(--diffs-bg-addition);\n\n    &[data-column-number] {\n      background-color: var(--diffs-bg-addition-number);\n    }\n  }\n\n  [data-background] [data-line-type='change-deletion'] {\n    --diffs-line-bg: var(--diffs-bg-deletion);\n\n    &[data-column-number] {\n      background-color: var(--diffs-bg-deletion-number);\n    }\n  }\n\n  [data-merge-conflict='marker-start'],\n  [data-merge-conflict='marker-base'],\n  [data-merge-conflict='marker-separator'],\n  [data-merge-conflict='marker-end'] {\n    padding-left: 1ch;\n    color: var(--diffs-fg);\n  }\n\n  [data-merge-conflict='marker-start'],\n  [data-merge-conflict='marker-end'] {\n    display: flex;\n    align-items: center;\n\n    &::after {\n      color: var(--diffs-fg-conflict-marker);\n      font-style: normal;\n      font-size: 0.75rem;\n      line-height: 1.25rem;\n      padding-left: 1ch;\n      font-family: var(\n        --diffs-header-font-family,\n        var(--diffs-header-font-fallback)\n      );\n    }\n  }\n\n  [data-merge-conflict='marker-start']::after {\n    content: '(Current Change)';\n  }\n\n  [data-merge-conflict='marker-end']::after {\n    content: '(Incoming Change)';\n  }\n\n  [data-merge-conflict='marker-base'],\n  [data-merge-conflict='marker-end'] {\n    &[data-line],\n    &[data-no-newline] {\n      background-color: var(--diffs-bg-conflict-marker);\n    }\n\n    &[data-column-number] {\n      background-color: var(--diffs-bg-conflict-marker-number);\n      color: var(--diffs-fg-conflict-marker);\n\n      [data-line-number-content] {\n        color: var(--diffs-fg-conflict-marker);\n      }\n    }\n  }\n\n  [data-merge-conflict='current'] {\n    &[data-line],\n    &[data-no-newline] {\n      background-color: var(--conflict-bg-current);\n    }\n\n    &[data-column-number] {\n      background-color: var(--conflict-bg-current-number);\n      color: var(--diffs-addition-base);\n    }\n  }\n\n  [data-gutter-buffer='merge-conflict-marker-start'],\n  [data-merge-conflict='marker-start'] {\n    background-color: var(--conflict-bg-current-header);\n  }\n\n  [data-gutter-buffer='merge-conflict-marker-end'],\n  [data-merge-conflict='marker-end'] {\n    background-color: var(--conflict-bg-incoming-header);\n  }\n\n  [data-merge-conflict='marker-separator'] {\n    &[data-line],\n    &[data-no-newline] {\n      background-color: var(--diffs-bg);\n    }\n\n    &[data-column-number] {\n      background-color: var(--diffs-bg);\n    }\n  }\n\n  [data-merge-conflict='base'] {\n    &[data-line],\n    &[data-no-newline] {\n      background-color: var(--diffs-bg-conflict-base);\n    }\n\n    &[data-column-number] {\n      background-color: var(--diffs-bg-conflict-base-number);\n      color: var(--diffs-modified-base);\n    }\n  }\n\n  [data-merge-conflict='incoming'] {\n    &[data-line],\n    &[data-no-newline] {\n      background-color: var(--conflict-bg-incoming);\n    }\n\n    &[data-column-number] {\n      background-color: var(--conflict-bg-incoming-number);\n      color: var(--diffs-modified-base);\n    }\n  }\n\n  @media (pointer: fine) {\n    [data-column-number],\n    [data-line] {\n      &[data-hovered] {\n        background-color: var(--diffs-bg-hover);\n      }\n    }\n\n    [data-background] {\n      [data-column-number],\n      [data-line] {\n        &[data-hovered] {\n          &[data-line-type='change-deletion'] {\n            background-color: var(--diffs-bg-deletion-hover);\n          }\n\n          &[data-line-type='change-addition'] {\n            background-color: var(--diffs-bg-addition-hover);\n          }\n        }\n      }\n    }\n  }\n\n  [data-diffs-header='default'] {\n    position: relative;\n    background-color: var(--diffs-bg);\n    display: flex;\n    flex-direction: row;\n    justify-content: space-between;\n    align-items: center;\n    gap: var(--diffs-gap-inline, var(--diffs-gap-fallback));\n    min-height: calc(\n      1lh + (var(--diffs-gap-block, var(--diffs-gap-fallback)) * 3)\n    );\n    padding-inline: 16px;\n    top: 0;\n    z-index: 2;\n  }\n\n  [data-header-content] {\n    display: flex;\n    flex-direction: row;\n    align-items: center;\n    gap: var(--diffs-gap-inline, var(--diffs-gap-fallback));\n    min-width: 0;\n    white-space: nowrap;\n  }\n\n  [data-header-content] [data-prev-name],\n  [data-header-content] [data-title] {\n    direction: rtl;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    min-width: 0;\n    white-space: nowrap;\n  }\n\n  [data-prev-name] {\n    opacity: 0.7;\n  }\n\n  [data-rename-icon] {\n    fill: currentColor;\n    flex-shrink: 0;\n    flex-grow: 0;\n  }\n\n  [data-diffs-header='default'] [data-metadata] {\n    display: flex;\n    align-items: center;\n    gap: 1ch;\n    white-space: nowrap;\n  }\n\n  [data-diffs-header='default'] [data-additions-count] {\n    font-family: var(--diffs-font-family, var(--diffs-font-fallback));\n    color: var(--diffs-addition-base);\n  }\n\n  [data-diffs-header='default'] [data-deletions-count] {\n    font-family: var(--diffs-font-family, var(--diffs-font-fallback));\n    color: var(--diffs-deletion-base);\n  }\n\n  [data-annotation-content] {\n    position: relative;\n    display: flow-root;\n    align-self: flex-start;\n    z-index: 2;\n    min-width: 0;\n    isolation: isolate;\n  }\n\n  [data-merge-conflict-actions-content] {\n    display: flex;\n    align-items: center;\n    gap: 0.25rem;\n    padding-inline: 0.5rem;\n    min-height: 1.75rem;\n    font-family: var(\n      --diffs-header-font-family,\n      var(--diffs-header-font-fallback)\n    );\n    font-size: 0.75rem;\n    line-height: 1.2;\n    color: var(--diffs-fg);\n  }\n\n  [data-merge-conflict-action] {\n    appearance: none;\n    border: 0;\n    background: transparent;\n    color: var(--diffs-fg-number);\n    font: inherit;\n    font-style: normal;\n    cursor: pointer;\n    padding: 0;\n  }\n\n  [data-merge-conflict-action]:hover {\n    color: var(--diffs-fg);\n  }\n\n  [data-merge-conflict-action='current']:hover {\n    color: var(--diffs-addition-base);\n  }\n\n  [data-merge-conflict-action='incoming']:hover {\n    color: var(--diffs-modified-base);\n  }\n\n  [data-merge-conflict-action-separator] {\n    color: var(--diffs-fg-number);\n    opacity: 0.6;\n    -webkit-user-select: none;\n            user-select: none;\n  }\n\n  /* Sticky positioning has a composite costs, so we should _only_ pay it if we\n   * need to */\n  [data-overflow='scroll'] [data-annotation-content] {\n    position: sticky;\n    width: var(--diffs-column-content-width, auto);\n    left: var(--diffs-column-number-width, 0);\n  }\n\n  [data-overflow='scroll'] [data-merge-conflict-actions-content] {\n    position: sticky;\n    width: var(--diffs-column-content-width, auto);\n    left: var(--diffs-column-number-width, 0);\n  }\n\n  /* Undo some of the stuff that the 'pre' tag does */\n  [data-annotation-slot] {\n    text-wrap-mode: wrap;\n    word-break: normal;\n    white-space-collapse: collapse;\n  }\n\n  [data-change-icon] {\n    fill: currentColor;\n    flex-shrink: 0;\n  }\n\n  [data-change-icon='change'],\n  [data-change-icon='rename-pure'],\n  [data-change-icon='rename-changed'] {\n    color: var(--diffs-modified-base);\n  }\n\n  [data-change-icon='new'] {\n    color: var(--diffs-addition-base);\n  }\n\n  [data-change-icon='deleted'] {\n    color: var(--diffs-deletion-base);\n  }\n\n  [data-change-icon='file'] {\n    opacity: 0.6;\n  }\n\n  /* Line selection highlighting */\n  [data-selected-line] {\n    &[data-gutter-buffer='annotation'],\n    &[data-column-number] {\n      color: var(--diffs-selection-number-fg);\n      background-color: var(--diffs-bg-selection-number);\n    }\n\n    &[data-line] {\n      background-color: var(--diffs-bg-selection);\n    }\n  }\n\n  [data-line-type='change-addition'],\n  [data-line-type='change-deletion'] {\n    &[data-selected-line] {\n      &[data-line],\n      &[data-line][data-hovered] {\n        background-color: light-dark(\n          color-mix(\n            in lab,\n            var(--diffs-line-bg, var(--diffs-bg)) 82%,\n            var(--diffs-selection-base)\n          ),\n          color-mix(\n            in lab,\n            var(--diffs-line-bg, var(--diffs-bg)) 75%,\n            var(--diffs-selection-base)\n          )\n        );\n      }\n\n      &[data-column-number],\n      &[data-column-number][data-hovered] {\n        color: var(--diffs-selection-number-fg);\n        background-color: light-dark(\n          color-mix(\n            in lab,\n            var(--diffs-line-bg, var(--diffs-bg)) 75%,\n            var(--diffs-selection-base)\n          ),\n          color-mix(\n            in lab,\n            var(--diffs-line-bg, var(--diffs-bg)) 60%,\n            var(--diffs-selection-base)\n          )\n        );\n      }\n    }\n  }\n\n  [data-gutter-utility-slot] {\n    position: absolute;\n    top: 0;\n    bottom: 0;\n    right: 0;\n    display: flex;\n    justify-content: flex-end;\n  }\n\n  [data-unmodified-lines] {\n    display: block;\n    overflow: hidden;\n    min-width: 0;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n    flex: 0 1 auto;\n  }\n\n  [data-error-wrapper] {\n    overflow: auto;\n    padding: var(--diffs-gap-block, var(--diffs-gap-fallback))\n      var(--diffs-gap-inline, var(--diffs-gap-fallback));\n    max-height: 400px;\n    scrollbar-width: none;\n\n    [data-error-message] {\n      font-weight: bold;\n      font-size: 18px;\n      color: var(--diffs-deletion-base);\n    }\n\n    [data-error-stack] {\n      color: var(--diffs-fg-number);\n    }\n  }\n\n  [data-placeholder] {\n    contain: strict;\n  }\n\n  [data-utility-button] {\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    border: none;\n    appearance: none;\n    width: 1lh;\n    height: 1lh;\n    margin-right: calc((1lh - 1ch) * -1);\n    padding: 0;\n    cursor: pointer;\n    font-size: var(--diffs-font-size, 13px);\n    line-height: var(--diffs-line-height, 20px);\n    border-radius: 4px;\n    background-color: var(--diffs-modified-base);\n    color: var(--diffs-bg);\n    fill: currentColor;\n    position: relative;\n    z-index: 4;\n  }\n}\n";

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/cssWrappers.js
var LAYER_ORDER = `@layer base, theme, rendered, unsafe;`;
function wrapUnsafeCSS(unsafeCSS) {
  return `${LAYER_ORDER}
@layer unsafe {
  ${unsafeCSS}
}`;
}
function wrapThemeCSS(themeCSS, themeType = "system") {
  return `${LAYER_ORDER}
@layer rendered {
  :host {${themeType === "system" ? "" : `
  color-scheme: ${themeType};`}
  ${themeCSS}
  }
}`;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/getOrCreateCodeNode.js
function getOrCreateCodeNode({ code, pre, columnType, rowSpan, containerSize = false } = {}) {
  if (code == null) {
    code = document.createElement("code");
    code.setAttribute("data-code", "");
    if (columnType != null) code.setAttribute(`data-${columnType}`, "");
    pre?.appendChild(code);
  }
  if (rowSpan != null) code.style.setProperty("grid-row", `span ${rowSpan}`);
  else code.style.removeProperty("grid-row");
  if (containerSize) code.setAttribute("data-container-size", "");
  else code.removeAttribute("data-container-size");
  return code;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/hostTheme.js
function upsertHostThemeStyle({ shadowRoot, currentNode, themeCSS }) {
  if (themeCSS.trim() === "") {
    currentNode?.remove();
    return;
  }
  currentNode ??= createHostThemeStyleNode();
  currentNode.textContent = themeCSS;
  if (currentNode.parentNode !== shadowRoot) shadowRoot.appendChild(currentNode);
  return currentNode;
}
function createHostThemeStyleNode() {
  const node = document.createElement("style");
  node.setAttribute(THEME_CSS_ATTRIBUTE, "");
  return node;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/prerenderHTMLIfNecessary.js
function prerenderHTMLIfNecessary(element2, html4) {
  if (html4 == null) return;
  const shadowRoot = element2.shadowRoot ?? element2.attachShadow({ mode: "open" });
  if (shadowRoot.innerHTML === "") shadowRoot.innerHTML = html4;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/setWrapperNodeProps.js
function setPreNodeProperties(pre, { type, diffIndicators, disableBackground, disableLineNumbers, overflow, split, totalLines, customProperties }) {
  if (customProperties != null) for (const key2 in customProperties) {
    const value = customProperties[key2];
    if (value != null) pre.setAttribute(key2, `${value}`);
  }
  if (type === "diff") {
    pre.setAttribute("data-diff", "");
    pre.removeAttribute("data-file");
  } else {
    pre.setAttribute("data-file", "");
    pre.removeAttribute("data-diff");
  }
  switch (diffIndicators) {
    case "bars":
    case "classic":
      pre.setAttribute("data-indicators", diffIndicators);
      break;
    case "none":
      pre.removeAttribute("data-indicators");
      break;
  }
  if (disableLineNumbers) pre.setAttribute("data-disable-line-numbers", "");
  else pre.removeAttribute("data-disable-line-numbers");
  if (disableBackground) pre.removeAttribute("data-background");
  else pre.setAttribute("data-background", "");
  if (type === "diff") pre.setAttribute("data-diff-type", split ? "split" : "single");
  else pre.removeAttribute("data-diff-type");
  pre.setAttribute("data-overflow", overflow);
  pre.tabIndex = 0;
  pre.style.setProperty("--diffs-min-number-column-width-default", `${`${totalLines}`.length}ch`);
  return pre;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/components/web-components.js
if (typeof HTMLElement !== "undefined" && customElements.get(DIFFS_TAG_NAME) == null) {
  let sheet;
  class FileDiffContainer extends HTMLElement {
    constructor() {
      super();
      if (this.shadowRoot != null) return;
      const shadowRoot = this.attachShadow({ mode: "open" });
      if (sheet == null) {
        sheet = new CSSStyleSheet();
        sheet.replaceSync(style_default);
      }
      shadowRoot.adoptedStyleSheets = [sheet];
    }
  }
  customElements.define(DIFFS_TAG_NAME, FileDiffContainer);
}
var DiffsContainerLoaded = true;

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/components/File.js
var EMPTY_STRINGS = [];
var instanceId2 = -1;
var File = class {
  static LoadedCustomComponent = DiffsContainerLoaded;
  __id = `file:${++instanceId2}`;
  fileContainer;
  spriteSVG;
  pre;
  code;
  bufferBefore;
  bufferAfter;
  themeCSSStyle;
  appliedThemeCSS;
  unsafeCSSStyle;
  appliedUnsafeCSS;
  gutterUtilityContent;
  errorWrapper;
  placeHolder;
  lastRenderedHeaderHTML;
  appliedPreAttributes;
  lastRowCount;
  headerElement;
  headerCustom;
  headerPrefix;
  headerMetadata;
  fileRenderer;
  resizeManager;
  interactionManager;
  annotationCache = /* @__PURE__ */ new Map();
  lineAnnotations = [];
  file;
  renderRange;
  constructor(options = { theme: DEFAULT_THEMES }, workerManager, isContainerManaged = false) {
    this.options = options;
    this.workerManager = workerManager;
    this.isContainerManaged = isContainerManaged;
    this.fileRenderer = new FileRenderer(options, this.handleHighlightRender, this.workerManager);
    this.resizeManager = new ResizeManager();
    this.interactionManager = new InteractionManager("file", pluckInteractionOptions(options));
    this.workerManager?.subscribeToThemeChanges(this);
  }
  handleHighlightRender = () => {
    this.rerender();
  };
  rerender() {
    if (this.file == null) return;
    this.render({
      file: this.file,
      forceRender: true,
      renderRange: this.renderRange
    });
  }
  setOptions(options) {
    if (options == null) return;
    this.options = options;
    this.interactionManager.setOptions(pluckInteractionOptions(options));
  }
  mergeOptions(options) {
    this.options = {
      ...this.options,
      ...options
    };
  }
  setThemeType(themeType) {
    if ((this.options.themeType ?? "system") === themeType) return;
    this.mergeOptions({ themeType });
    if (typeof this.options.theme === "string" || this.fileContainer == null || this.appliedThemeCSS == null) return;
    this.applyThemeState(this.fileContainer, this.appliedThemeCSS.themeStyles, themeType, this.appliedThemeCSS.baseThemeType);
  }
  getHoveredLine = () => {
    return this.interactionManager.getHoveredLine();
  };
  setLineAnnotations(lineAnnotations) {
    this.lineAnnotations = lineAnnotations;
  }
  setSelectedLines(range2) {
    this.interactionManager.setSelection(range2);
  }
  cleanUp() {
    this.fileRenderer.cleanUp();
    this.resizeManager.cleanUp();
    this.interactionManager.cleanUp();
    this.workerManager?.unsubscribeToThemeChanges(this);
    this.workerManager = void 0;
    this.renderRange = void 0;
    this.file = void 0;
    if (!this.isContainerManaged) this.fileContainer?.remove();
    if (this.fileContainer?.shadowRoot != null) this.fileContainer.shadowRoot.innerHTML = "";
    this.fileContainer = void 0;
    this.pre = void 0;
    this.bufferBefore = void 0;
    this.bufferAfter = void 0;
    this.appliedPreAttributes = void 0;
    this.lastRowCount = void 0;
    this.headerElement = void 0;
    this.headerPrefix = void 0;
    this.headerMetadata = void 0;
    this.headerCustom = void 0;
    this.lastRenderedHeaderHTML = void 0;
    this.errorWrapper = void 0;
    this.themeCSSStyle = void 0;
    this.appliedThemeCSS = void 0;
    this.unsafeCSSStyle = void 0;
    this.appliedUnsafeCSS = void 0;
    this.placeHolder = void 0;
  }
  hydrate(props) {
    const { fileContainer, prerenderedHTML, preventEmit = false, file, lineAnnotations } = props;
    this.hydrateElements(fileContainer, prerenderedHTML);
    if (shouldRenderCode(this.pre, file, this.options.collapsed) || shouldRenderHeader(this.headerElement, file, this.options.disableFileHeader)) this.render({
      ...props,
      preventEmit: true
    });
    else this.hydrationSetup({
      file,
      lineAnnotations
    });
    if (!preventEmit) this.emitPostRender();
  }
  hydrateElements(fileContainer, prerenderedHTML) {
    prerenderHTMLIfNecessary(fileContainer, prerenderedHTML);
    for (const element2 of Array.from(fileContainer.shadowRoot?.children ?? [])) {
      if (element2 instanceof SVGElement) {
        this.spriteSVG = element2;
        continue;
      }
      if (!(element2 instanceof HTMLElement)) continue;
      if (element2 instanceof HTMLPreElement) {
        this.pre = element2;
        this.appliedPreAttributes = void 0;
        continue;
      }
      if (element2 instanceof HTMLStyleElement && element2.hasAttribute(THEME_CSS_ATTRIBUTE)) {
        this.themeCSSStyle = element2;
        continue;
      }
      if (element2 instanceof HTMLStyleElement && element2.hasAttribute(UNSAFE_CSS_ATTRIBUTE)) {
        this.unsafeCSSStyle = element2;
        this.appliedUnsafeCSS = element2.textContent;
        continue;
      }
      if ("diffsHeader" in element2.dataset) {
        this.headerElement = element2;
        this.lastRenderedHeaderHTML = void 0;
        continue;
      }
    }
    if (this.pre != null) {
      this.syncCodeNodeFromPre(this.pre);
      this.pre.removeAttribute("data-dehydrated");
    }
    this.fileContainer = fileContainer;
  }
  hydrationSetup({ file, lineAnnotations }) {
    const { overflow = "scroll" } = this.options;
    this.lineAnnotations = lineAnnotations ?? this.lineAnnotations;
    this.file = file;
    this.fileRenderer.setOptions({
      ...this.options,
      headerRenderMode: this.options.renderCustomHeader != null ? "custom" : "default"
    });
    if (this.pre == null) return;
    this.fileRenderer.hydrate(file);
    this.renderAnnotations();
    this.renderGutterUtility();
    this.injectUnsafeCSS();
    this.interactionManager.setup(this.pre);
    this.resizeManager.setup(this.pre, overflow === "wrap");
  }
  getOrCreateLineCache(file = this.file) {
    return file != null ? this.fileRenderer.getOrCreateLineCache(file) : EMPTY_STRINGS;
  }
  render({ file, fileContainer, forceRender = false, preventEmit = false, containerWrapper, lineAnnotations, renderRange }) {
    const { collapsed = false, themeType = "system" } = this.options;
    const nextRenderRange = collapsed ? void 0 : renderRange;
    const previousRenderRange = this.renderRange;
    const annotationsChanged = lineAnnotations != null && (lineAnnotations.length > 0 || this.lineAnnotations.length > 0) ? lineAnnotations !== this.lineAnnotations : false;
    const didFileChange = !areFilesEqual(this.file, file);
    if (!collapsed && !forceRender && areRenderRangesEqual(nextRenderRange, this.renderRange) && !didFileChange && !annotationsChanged) return false;
    this.renderRange = nextRenderRange;
    this.file = file;
    this.fileRenderer.setOptions({
      ...this.options,
      headerRenderMode: this.options.renderCustomHeader != null ? "custom" : "default"
    });
    if (lineAnnotations != null) this.setLineAnnotations(lineAnnotations);
    this.fileRenderer.setLineAnnotations(this.lineAnnotations);
    const { disableErrorHandling = false, disableFileHeader = false, overflow = "scroll" } = this.options;
    if (disableFileHeader) {
      if (this.headerElement != null) {
        this.headerElement.remove();
        this.headerElement = void 0;
        this.lastRenderedHeaderHTML = void 0;
      }
      this.clearHeaderSlots();
    }
    fileContainer = this.getOrCreateFileContainerNode(fileContainer, containerWrapper);
    if (collapsed) {
      this.removeRenderedCode();
      this.clearAuxiliaryNodes();
      try {
        const fileResult = this.fileRenderer.renderFile(file, EMPTY_RENDER_RANGE);
        if (fileResult != null) this.applyThemeState(fileContainer, fileResult.themeStyles, themeType, fileResult.baseThemeType);
        if (fileResult?.headerAST != null) this.applyHeaderToDOM(fileResult.headerAST, fileContainer);
        this.injectUnsafeCSS();
      } catch (error) {
        if (disableErrorHandling) throw error;
        console.error(error);
        if (error instanceof Error) this.applyErrorToDOM(error, fileContainer);
      }
      if (!preventEmit) this.emitPostRender();
      return true;
    }
    try {
      const pre = this.getOrCreatePreNode(fileContainer);
      if (!this.canPartiallyRender(forceRender, annotationsChanged, didFileChange) || !this.applyPartialRender(previousRenderRange, nextRenderRange)) {
        const fileResult = this.fileRenderer.renderFile(file, nextRenderRange);
        if (fileResult == null) {
          if (this.workerManager?.isInitialized() === false) this.workerManager.initialize().then(() => this.rerender());
          return false;
        }
        this.applyThemeState(fileContainer, fileResult.themeStyles, themeType, fileResult.baseThemeType);
        if (fileResult.headerAST != null) this.applyHeaderToDOM(fileResult.headerAST, fileContainer);
        this.applyFullRender(fileResult, pre);
      }
      this.applyBuffers(pre, nextRenderRange);
      this.injectUnsafeCSS();
      this.interactionManager.setup(pre);
      this.resizeManager.setup(pre, overflow === "wrap");
      this.renderAnnotations();
      this.renderGutterUtility();
    } catch (error) {
      if (disableErrorHandling) throw error;
      console.error(error);
      if (error instanceof Error) this.applyErrorToDOM(error, fileContainer);
    }
    if (!preventEmit) this.emitPostRender();
    return true;
  }
  emitPostRender() {
    if (this.fileContainer != null) this.options.onPostRender?.(this.fileContainer, this);
  }
  removeRenderedCode() {
    this.resizeManager.cleanUp();
    this.interactionManager.cleanUp();
    this.bufferBefore?.remove();
    this.bufferBefore = void 0;
    this.bufferAfter?.remove();
    this.bufferAfter = void 0;
    this.code?.remove();
    this.code = void 0;
    this.pre?.remove();
    this.pre = void 0;
    this.appliedPreAttributes = void 0;
    this.lastRowCount = void 0;
  }
  clearAuxiliaryNodes() {
    for (const { element: element2 } of this.annotationCache.values()) element2.remove();
    this.annotationCache.clear();
    this.gutterUtilityContent?.remove();
    this.gutterUtilityContent = void 0;
  }
  canPartiallyRender(forceRender, annotationsChanged, didContentChange) {
    if (forceRender || annotationsChanged || didContentChange) return false;
    return true;
  }
  renderPlaceholder(height) {
    if (this.fileContainer == null) return false;
    this.cleanChildNodes();
    if (this.placeHolder == null) {
      const shadowRoot = this.fileContainer.shadowRoot ?? this.fileContainer.attachShadow({ mode: "open" });
      this.placeHolder = document.createElement("div");
      this.placeHolder.dataset.placeholder = "";
      shadowRoot.appendChild(this.placeHolder);
    }
    this.placeHolder.style.setProperty("height", `${height}px`);
    return true;
  }
  cleanChildNodes() {
    this.resizeManager.cleanUp();
    this.interactionManager.cleanUp();
    this.bufferAfter?.remove();
    this.bufferBefore?.remove();
    this.code?.remove();
    this.errorWrapper?.remove();
    this.headerElement?.remove();
    this.gutterUtilityContent?.remove();
    this.headerPrefix?.remove();
    this.headerMetadata?.remove();
    this.headerCustom?.remove();
    this.pre?.remove();
    this.spriteSVG?.remove();
    this.themeCSSStyle?.remove();
    this.unsafeCSSStyle?.remove();
    this.bufferAfter = void 0;
    this.bufferBefore = void 0;
    this.code = void 0;
    this.errorWrapper = void 0;
    this.headerElement = void 0;
    this.gutterUtilityContent = void 0;
    this.headerPrefix = void 0;
    this.headerMetadata = void 0;
    this.headerCustom = void 0;
    this.pre = void 0;
    this.spriteSVG = void 0;
    this.themeCSSStyle = void 0;
    this.appliedThemeCSS = void 0;
    this.unsafeCSSStyle = void 0;
    this.appliedUnsafeCSS = void 0;
    this.lastRenderedHeaderHTML = void 0;
    this.lastRowCount = void 0;
  }
  renderAnnotations() {
    if (this.isContainerManaged || this.fileContainer == null) {
      for (const { element: element2 } of this.annotationCache.values()) element2.remove();
      this.annotationCache.clear();
      return;
    }
    const staleAnnotations = new Map(this.annotationCache);
    const { renderAnnotation } = this.options;
    if (renderAnnotation != null && this.lineAnnotations.length > 0) for (const [index, annotation] of this.lineAnnotations.entries()) {
      const id = `${index}-${getLineAnnotationName(annotation)}`;
      let cache = this.annotationCache.get(id);
      if (cache == null || !areLineAnnotationsEqual(annotation, cache.annotation)) {
        cache?.element.remove();
        const content = renderAnnotation(annotation);
        if (content == null) continue;
        cache = {
          element: createAnnotationWrapperNode(getLineAnnotationName(annotation)),
          annotation
        };
        cache.element.appendChild(content);
        this.fileContainer.appendChild(cache.element);
        this.annotationCache.set(id, cache);
      }
      staleAnnotations.delete(id);
    }
    for (const [id, { element: element2 }] of staleAnnotations.entries()) {
      this.annotationCache.delete(id);
      element2.remove();
    }
  }
  renderGutterUtility() {
    const renderGutterUtility = this.options.renderGutterUtility ?? this.options.renderHoverUtility;
    if (this.fileContainer == null || renderGutterUtility == null) {
      this.gutterUtilityContent?.remove();
      this.gutterUtilityContent = void 0;
      return;
    }
    const element2 = renderGutterUtility(this.interactionManager.getHoveredLine);
    if (element2 != null && this.gutterUtilityContent != null) return;
    else if (element2 == null) {
      this.gutterUtilityContent?.remove();
      this.gutterUtilityContent = void 0;
      return;
    }
    const gutterUtilityContent = createGutterUtilityContentNode();
    gutterUtilityContent.appendChild(element2);
    this.fileContainer.appendChild(gutterUtilityContent);
    this.gutterUtilityContent = gutterUtilityContent;
  }
  injectUnsafeCSS() {
    const { unsafeCSS } = this.options;
    const shadowRoot = this.fileContainer?.shadowRoot;
    if (shadowRoot == null) return;
    if (unsafeCSS == null || unsafeCSS === "") {
      if (this.unsafeCSSStyle != null) {
        this.unsafeCSSStyle.remove();
        this.unsafeCSSStyle = void 0;
      }
      this.appliedUnsafeCSS = void 0;
      return;
    }
    if (this.unsafeCSSStyle?.parentNode === shadowRoot && this.appliedUnsafeCSS === unsafeCSS) return;
    this.unsafeCSSStyle ??= createUnsafeCSSStyleNode();
    if (this.unsafeCSSStyle.parentNode !== shadowRoot) shadowRoot.appendChild(this.unsafeCSSStyle);
    this.unsafeCSSStyle.textContent = wrapUnsafeCSS(unsafeCSS);
    this.appliedUnsafeCSS = unsafeCSS;
  }
  applyThemeState(container, themeStyles, themeType, baseThemeType) {
    const shadowRoot = container.shadowRoot ?? container.attachShadow({ mode: "open" });
    const effectiveThemeType = baseThemeType ?? themeType;
    if (this.themeCSSStyle?.parentNode === shadowRoot && this.appliedThemeCSS?.themeStyles === themeStyles && this.appliedThemeCSS.themeType === effectiveThemeType) return;
    this.themeCSSStyle = upsertHostThemeStyle({
      shadowRoot,
      currentNode: this.themeCSSStyle,
      themeCSS: wrapThemeCSS(themeStyles, effectiveThemeType)
    });
    this.appliedThemeCSS = this.themeCSSStyle != null ? {
      themeStyles,
      themeType: effectiveThemeType,
      baseThemeType
    } : void 0;
  }
  applyFullRender(result, pre) {
    this.cleanupErrorWrapper();
    this.applyPreNodeAttributes(pre, result);
    this.code = getOrCreateCodeNode({ code: this.code });
    this.code.innerHTML = this.fileRenderer.renderPartialHTML(this.fileRenderer.renderCodeAST(result));
    pre.replaceChildren(this.code);
    this.lastRowCount = result.rowCount;
  }
  applyPartialRender(previousRenderRange, renderRange) {
    if (previousRenderRange == null || renderRange == null) return false;
    const { file, code } = this;
    const columns = code != null ? this.getColumns(code) : void 0;
    if (file == null || code == null || columns == null) return false;
    const previousStart = previousRenderRange.startingLine;
    const nextStart = renderRange.startingLine;
    const previousEnd = previousRenderRange.totalLines === Infinity ? Number.POSITIVE_INFINITY : previousStart + previousRenderRange.totalLines;
    const nextEnd = renderRange.totalLines === Infinity ? Number.POSITIVE_INFINITY : nextStart + renderRange.totalLines;
    const overlapStart = Math.max(previousStart, nextStart);
    const overlapEnd = Math.min(previousEnd, nextEnd);
    if (overlapEnd <= overlapStart) return false;
    if (!this.trimDOMToOverlap(columns.gutter, overlapStart, overlapEnd) || !this.trimDOMToOverlap(columns.content, overlapStart, overlapEnd)) return false;
    let { length: rowCount } = columns.content.children;
    const renderChunk = (startingLine, totalLines) => {
      if (totalLines <= 0) return;
      return this.fileRenderer.renderFile(file, {
        startingLine,
        totalLines,
        bufferBefore: 0,
        bufferAfter: 0
      });
    };
    const prependResult = nextStart < overlapStart ? renderChunk(nextStart, overlapStart - nextStart) : void 0;
    if (prependResult === void 0 && nextStart < overlapStart) return false;
    const appendTotalLines = nextEnd === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : Math.max(0, nextEnd - overlapEnd);
    const appendResult = nextEnd > overlapEnd ? renderChunk(overlapEnd, appendTotalLines) : void 0;
    if (appendResult === void 0 && nextEnd > overlapEnd) return false;
    this.cleanupErrorWrapper();
    if (prependResult != null) {
      columns.gutter.insertAdjacentHTML("afterbegin", this.fileRenderer.renderPartialHTML(prependResult.gutterAST));
      columns.content.insertAdjacentHTML("afterbegin", this.fileRenderer.renderPartialHTML(prependResult.contentAST));
      rowCount += prependResult.rowCount;
    }
    if (appendResult != null) {
      columns.gutter.insertAdjacentHTML("beforeend", this.fileRenderer.renderPartialHTML(appendResult.gutterAST));
      columns.content.insertAdjacentHTML("beforeend", this.fileRenderer.renderPartialHTML(appendResult.contentAST));
      rowCount += appendResult.rowCount;
    }
    if (this.lastRowCount !== rowCount) {
      columns.gutter.style.setProperty("grid-row", `span ${rowCount}`);
      columns.content.style.setProperty("grid-row", `span ${rowCount}`);
      this.lastRowCount = rowCount;
    }
    return true;
  }
  getColumns(code) {
    const gutter = code.children[0];
    const content = code.children[1];
    if (!(gutter instanceof HTMLElement) || !(content instanceof HTMLElement) || gutter.dataset.gutter == null || content.dataset.content == null) return;
    return {
      gutter,
      content
    };
  }
  trimDOMToOverlap(container, overlapStart, overlapEnd) {
    const boundaryIndices = this.getDOMBoundaryIndices(container, [overlapStart, overlapEnd]);
    const startIndex = boundaryIndices.get(overlapStart) ?? container.children.length;
    const endIndex = boundaryIndices.get(overlapEnd) ?? container.children.length;
    if (startIndex > endIndex) return false;
    for (let i2 = container.children.length - 1; i2 >= endIndex; i2 -= 1) container.children[i2]?.remove();
    for (let i2 = startIndex - 1; i2 >= 0; i2 -= 1) container.children[i2]?.remove();
    return true;
  }
  getDOMBoundaryIndices(container, boundaries) {
    const sortedBoundaries = [...new Set(boundaries)].sort((a2, b3) => a2 - b3);
    const boundaryIndices = /* @__PURE__ */ new Map();
    if (sortedBoundaries.length === 0) return boundaryIndices;
    let boundaryIndex = 0;
    let nextBoundary = sortedBoundaries[boundaryIndex];
    const { children } = container;
    for (let i2 = 0; i2 < children.length; i2 += 1) {
      const child = children[i2];
      if (!(child instanceof HTMLElement)) continue;
      const lineIndex = this.getLineIndexFromDOMNode(child);
      if (lineIndex == null) continue;
      while (nextBoundary != null && lineIndex >= nextBoundary) {
        boundaryIndices.set(nextBoundary, i2);
        boundaryIndex += 1;
        nextBoundary = sortedBoundaries[boundaryIndex];
      }
      if (boundaryIndex >= sortedBoundaries.length) break;
    }
    for (const boundary of sortedBoundaries) if (!boundaryIndices.has(boundary)) boundaryIndices.set(boundary, children.length);
    return boundaryIndices;
  }
  getLineIndexFromDOMNode(node) {
    const lineIndexAttr = node.dataset.lineIndex;
    if (lineIndexAttr == null) return;
    const parsed = Number(lineIndexAttr);
    return Number.isNaN(parsed) ? void 0 : parsed;
  }
  applyBuffers(pre, renderRange) {
    const { disableVirtualizationBuffers = false } = this.options;
    if (disableVirtualizationBuffers || renderRange == null) {
      if (this.bufferBefore != null) {
        this.bufferBefore.remove();
        this.bufferBefore = void 0;
      }
      if (this.bufferAfter != null) {
        this.bufferAfter.remove();
        this.bufferAfter = void 0;
      }
      return;
    }
    if (renderRange.bufferBefore > 0) {
      if (this.bufferBefore == null) {
        this.bufferBefore = document.createElement("div");
        this.bufferBefore.dataset.virtualizerBuffer = "before";
        pre.before(this.bufferBefore);
      }
      this.bufferBefore.style.setProperty("height", `${renderRange.bufferBefore}px`);
      this.bufferBefore.style.setProperty("contain", "strict");
    } else if (this.bufferBefore != null) {
      this.bufferBefore.remove();
      this.bufferBefore = void 0;
    }
    if (renderRange.bufferAfter > 0) {
      if (this.bufferAfter == null) {
        this.bufferAfter = document.createElement("div");
        this.bufferAfter.dataset.virtualizerBuffer = "after";
        pre.after(this.bufferAfter);
      }
      this.bufferAfter.style.setProperty("height", `${renderRange.bufferAfter}px`);
      this.bufferAfter.style.setProperty("contain", "strict");
    } else if (this.bufferAfter != null) {
      this.bufferAfter.remove();
      this.bufferAfter = void 0;
    }
  }
  applyHeaderToDOM(headerAST, container) {
    const { file } = this;
    if (file == null) return;
    this.cleanupErrorWrapper();
    this.placeHolder?.remove();
    this.placeHolder = void 0;
    const headerHTML = toHtml(headerAST);
    if (headerHTML !== this.lastRenderedHeaderHTML) {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = headerHTML;
      const newHeader = tempDiv.firstElementChild;
      if (!(newHeader instanceof HTMLElement)) return;
      if (this.headerElement != null) container.shadowRoot?.replaceChild(newHeader, this.headerElement);
      else container.shadowRoot?.prepend(newHeader);
      this.headerElement = newHeader;
      this.lastRenderedHeaderHTML = headerHTML;
    }
    if (this.isContainerManaged) return;
    const { renderHeaderPrefix, renderCustomHeader, renderCustomMetadata } = this.options;
    if (renderCustomHeader != null) {
      const content = renderCustomHeader(file) ?? void 0;
      this.headerCustom = this.upsertHeaderSlotElement(container, this.headerCustom, CUSTOM_HEADER_SLOT_ID, content);
      this.headerPrefix?.remove();
      this.headerMetadata?.remove();
      this.headerPrefix = void 0;
      this.headerMetadata = void 0;
    } else {
      const prefix = renderHeaderPrefix?.(file) ?? void 0;
      const content = renderCustomMetadata?.(file) ?? void 0;
      this.headerPrefix = this.upsertHeaderSlotElement(container, this.headerPrefix, HEADER_PREFIX_SLOT_ID, prefix);
      this.headerMetadata = this.upsertHeaderSlotElement(container, this.headerMetadata, HEADER_METADATA_SLOT_ID, content);
      this.headerCustom?.remove();
      this.headerCustom = void 0;
    }
  }
  clearHeaderSlots() {
    this.headerPrefix?.remove();
    this.headerMetadata?.remove();
    this.headerCustom?.remove();
    this.headerPrefix = void 0;
    this.headerMetadata = void 0;
    this.headerCustom = void 0;
  }
  upsertHeaderSlotElement(container, current, slot, content) {
    if (content == null) {
      current?.remove();
      return;
    }
    const element2 = current ?? this.createHeaderSlotElement(slot);
    if (current == null) container.appendChild(element2);
    this.replaceHeaderSlotContent(element2, content);
    return element2;
  }
  replaceHeaderSlotContent(element2, content) {
    element2.replaceChildren();
    if (content instanceof Element) element2.appendChild(content);
    else element2.innerText = `${content}`;
  }
  createHeaderSlotElement(slot) {
    const element2 = document.createElement("div");
    element2.slot = slot;
    return element2;
  }
  getOrCreateFileContainerNode(fileContainer, parentNode) {
    const previousContainer = this.fileContainer;
    this.fileContainer = fileContainer ?? this.fileContainer ?? document.createElement(DIFFS_TAG_NAME);
    if (previousContainer != null && previousContainer !== this.fileContainer) {
      this.lastRenderedHeaderHTML = void 0;
      this.headerElement = void 0;
    }
    if (parentNode != null && this.fileContainer.parentNode !== parentNode) parentNode.appendChild(this.fileContainer);
    if (this.spriteSVG == null) {
      const fragment = document.createElement("div");
      fragment.innerHTML = SVGSpriteSheet;
      const firstChild = fragment.firstChild;
      if (firstChild instanceof SVGElement) {
        this.spriteSVG = firstChild;
        this.fileContainer.shadowRoot?.appendChild(this.spriteSVG);
      }
    }
    return this.fileContainer;
  }
  getOrCreatePreNode(container) {
    const shadowRoot = container.shadowRoot ?? container.attachShadow({ mode: "open" });
    if (this.pre == null) {
      this.pre = document.createElement("pre");
      this.appliedPreAttributes = void 0;
      this.code = void 0;
      shadowRoot.appendChild(this.pre);
    } else if (this.pre.parentNode !== shadowRoot) {
      container.shadowRoot?.appendChild(this.pre);
      this.appliedPreAttributes = void 0;
    }
    this.placeHolder?.remove();
    this.placeHolder = void 0;
    return this.pre;
  }
  syncCodeNodeFromPre(pre) {
    this.code = void 0;
    for (const child of Array.from(pre.children)) {
      if (!(child instanceof HTMLElement)) continue;
      if (child.hasAttribute("data-code")) {
        this.code = child;
        return;
      }
    }
  }
  applyPreNodeAttributes(pre, { totalLines }) {
    const { overflow = "scroll", disableLineNumbers = false } = this.options;
    const preProperties = {
      type: "file",
      split: false,
      overflow,
      disableLineNumbers,
      diffIndicators: "none",
      disableBackground: true,
      totalLines
    };
    if (arePrePropertiesEqual(preProperties, this.appliedPreAttributes)) return;
    setPreNodeProperties(pre, preProperties);
    this.appliedPreAttributes = preProperties;
  }
  applyErrorToDOM(error, container) {
    this.cleanupErrorWrapper();
    const pre = this.getOrCreatePreNode(container);
    pre.innerHTML = "";
    pre.remove();
    this.pre = void 0;
    this.appliedPreAttributes = void 0;
    const shadowRoot = container.shadowRoot ?? container.attachShadow({ mode: "open" });
    this.errorWrapper ??= document.createElement("div");
    this.errorWrapper.dataset.errorWrapper = "";
    this.errorWrapper.innerHTML = "";
    shadowRoot.appendChild(this.errorWrapper);
    const errorMessage = document.createElement("div");
    errorMessage.dataset.errorMessage = "";
    errorMessage.innerText = error.message;
    this.errorWrapper.appendChild(errorMessage);
    const errorStack = document.createElement("pre");
    errorStack.dataset.errorStack = "";
    errorStack.innerText = error.stack ?? "No Error Stack";
    this.errorWrapper.appendChild(errorStack);
  }
  cleanupErrorWrapper() {
    this.errorWrapper?.remove();
    this.errorWrapper = void 0;
  }
};
function shouldRenderCode(pre, file, collapsed = false) {
  return !collapsed && pre == null && file != null;
}
function shouldRenderHeader(headerElement, file, disableFileHeader = false) {
  return headerElement == null && file != null && !disableFileHeader;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/components/VirtualizedFile.js
var instanceId3 = -1;
var VirtualizedFile = class extends File {
  __id = `virtualized-file:${++instanceId3}`;
  top;
  height = 0;
  heightCache = /* @__PURE__ */ new Map();
  isVisible = false;
  isSetup = false;
  constructor(options, virtualizer, metrics = DEFAULT_VIRTUAL_FILE_METRICS, workerManager, isContainerManaged = false) {
    super(options, workerManager, isContainerManaged);
    this.virtualizer = virtualizer;
    this.metrics = metrics;
  }
  getLineHeight(lineIndex, hasMetadataLine = false) {
    const cached = this.heightCache.get(lineIndex);
    if (cached != null) return cached;
    const multiplier = hasMetadataLine ? 2 : 1;
    return this.metrics.lineHeight * multiplier;
  }
  setOptions(options) {
    if (options == null) return;
    const previousOverflow = this.options.overflow;
    const previousCollapsed = this.options.collapsed;
    super.setOptions(options);
    if (previousOverflow !== this.options.overflow || previousCollapsed !== this.options.collapsed) {
      this.heightCache.clear();
      this.computeApproximateSize();
      this.renderRange = void 0;
    }
    this.virtualizer.instanceChanged(this);
  }
  reconcileHeights() {
    if (this.fileContainer == null || this.file == null) {
      this.height = 0;
      return;
    }
    const { overflow = "scroll" } = this.options;
    this.top = this.virtualizer.getOffsetInScrollContainer(this.fileContainer);
    if (overflow === "scroll" && this.lineAnnotations.length === 0 && !this.virtualizer.config.resizeDebugging) return;
    let hasLineHeightChange = false;
    if (this.code == null) return;
    const content = this.code.children[1];
    if (!(content instanceof HTMLElement)) return;
    for (const line of content.children) {
      if (!(line instanceof HTMLElement)) continue;
      const lineIndexAttr = line.dataset.lineIndex;
      if (lineIndexAttr == null) continue;
      const lineIndex = Number(lineIndexAttr);
      let measuredHeight = line.getBoundingClientRect().height;
      let hasMetadata = false;
      if (line.nextElementSibling instanceof HTMLElement && ("lineAnnotation" in line.nextElementSibling.dataset || "noNewline" in line.nextElementSibling.dataset)) {
        if ("noNewline" in line.nextElementSibling.dataset) hasMetadata = true;
        measuredHeight += line.nextElementSibling.getBoundingClientRect().height;
      }
      const expectedHeight = this.getLineHeight(lineIndex, hasMetadata);
      if (measuredHeight === expectedHeight) continue;
      hasLineHeightChange = true;
      if (measuredHeight === this.metrics.lineHeight * (hasMetadata ? 2 : 1)) this.heightCache.delete(lineIndex);
      else this.heightCache.set(lineIndex, measuredHeight);
    }
    if (hasLineHeightChange || this.virtualizer.config.resizeDebugging) this.computeApproximateSize();
  }
  onRender = (dirty) => {
    if (this.fileContainer == null || this.file == null) return false;
    if (dirty) this.top = this.virtualizer.getOffsetInScrollContainer(this.fileContainer);
    return this.render({ file: this.file });
  };
  cleanUp() {
    if (this.fileContainer != null) this.virtualizer.disconnect(this.fileContainer);
    this.isSetup = false;
    super.cleanUp();
  }
  computeApproximateSize() {
    const isFirstCompute = this.height === 0;
    this.height = 0;
    if (this.file == null) return;
    const { disableFileHeader = false, collapsed = false, overflow = "scroll" } = this.options;
    const { diffHeaderHeight, fileGap, lineHeight } = this.metrics;
    const lines = this.getOrCreateLineCache(this.file);
    if (!disableFileHeader) this.height += diffHeaderHeight;
    else this.height += fileGap;
    if (collapsed) return;
    if (overflow === "scroll" && this.lineAnnotations.length === 0) this.height += this.getOrCreateLineCache(this.file).length * lineHeight;
    else iterateOverFile({
      lines,
      callback: ({ lineIndex }) => {
        this.height += this.getLineHeight(lineIndex, false);
      }
    });
    if (lines.length > 0) this.height += fileGap;
    if (this.fileContainer != null && this.virtualizer.config.resizeDebugging && !isFirstCompute) {
      const rect = this.fileContainer.getBoundingClientRect();
      if (rect.height !== this.height) console.log("VirtualizedFile.computeApproximateSize: computed height doesnt match", {
        name: this.file.name,
        elementHeight: rect.height,
        computedHeight: this.height
      });
      else console.log("VirtualizedFile.computeApproximateSize: computed height IS CORRECT");
    }
  }
  setVisibility(visible) {
    if (this.fileContainer == null) return;
    if (visible && !this.isVisible) {
      this.top = this.virtualizer.getOffsetInScrollContainer(this.fileContainer);
      this.isVisible = true;
    } else if (!visible && this.isVisible) {
      this.isVisible = false;
      this.rerender();
    }
  }
  render({ fileContainer, file, ...props }) {
    const { isSetup } = this;
    this.file ??= file;
    fileContainer = this.getOrCreateFileContainerNode(fileContainer);
    if (this.file == null) {
      console.error("VirtualizedFile.render: attempting to virtually render when we dont have file");
      return false;
    }
    if (!isSetup) {
      this.computeApproximateSize();
      this.virtualizer.connect(fileContainer, this);
      this.top ??= this.virtualizer.getOffsetInScrollContainer(fileContainer);
      this.isVisible = this.virtualizer.isInstanceVisible(this.top, this.height);
      this.isSetup = true;
    } else this.top ??= this.virtualizer.getOffsetInScrollContainer(fileContainer);
    if (!this.isVisible) return this.renderPlaceholder(this.height);
    const windowSpecs = this.virtualizer.getWindowSpecs();
    const renderRange = this.computeRenderRangeFromWindow(this.file, this.top, windowSpecs);
    return super.render({
      file: this.file,
      fileContainer,
      renderRange,
      ...props
    });
  }
  computeRenderRangeFromWindow(file, fileTop, { top, bottom }) {
    const { disableFileHeader = false, overflow = "scroll" } = this.options;
    const { diffHeaderHeight, fileGap, hunkLineCount, lineHeight } = this.metrics;
    const lines = this.getOrCreateLineCache(file);
    const lineCount = lines.length;
    const fileHeight = this.height;
    const headerRegion = disableFileHeader ? fileGap : diffHeaderHeight;
    if (fileTop < top - fileHeight || fileTop > bottom) return {
      startingLine: 0,
      totalLines: 0,
      bufferBefore: 0,
      bufferAfter: fileHeight - headerRegion - fileGap
    };
    if (lineCount <= hunkLineCount) return {
      startingLine: 0,
      totalLines: hunkLineCount,
      bufferBefore: 0,
      bufferAfter: 0
    };
    const estimatedTargetLines = Math.ceil(Math.max(bottom - top, 0) / lineHeight);
    const totalLines = Math.ceil(estimatedTargetLines / hunkLineCount) * hunkLineCount + hunkLineCount * 2;
    const totalHunks = totalLines / hunkLineCount;
    const viewportCenter = (top + bottom) / 2;
    if (overflow === "scroll" && this.lineAnnotations.length === 0) {
      const centerLine = Math.floor((viewportCenter - (fileTop + headerRegion)) / lineHeight);
      const idealStartHunk$1 = Math.floor(centerLine / hunkLineCount) - Math.floor(totalHunks / 2);
      const totalHunksInFile = Math.ceil(lineCount / hunkLineCount);
      const startingLine$1 = Math.max(0, Math.min(idealStartHunk$1, totalHunksInFile)) * hunkLineCount;
      const clampedTotalLines$1 = idealStartHunk$1 < 0 ? totalLines + idealStartHunk$1 * hunkLineCount : totalLines;
      const bufferBefore$1 = startingLine$1 * lineHeight;
      const renderedLines = Math.min(clampedTotalLines$1, lineCount - startingLine$1);
      return {
        startingLine: startingLine$1,
        totalLines: clampedTotalLines$1,
        bufferBefore: bufferBefore$1,
        bufferAfter: Math.max(0, (lineCount - startingLine$1 - renderedLines) * lineHeight)
      };
    }
    const overflowHunks = totalHunks;
    const hunkOffsets = [];
    let absoluteLineTop = fileTop + headerRegion;
    let currentLine = 0;
    let firstVisibleHunk;
    let centerHunk;
    let overflowCounter;
    iterateOverFile({
      lines,
      callback: ({ lineIndex }) => {
        const isAtHunkBoundary = currentLine % hunkLineCount === 0;
        if (isAtHunkBoundary) {
          hunkOffsets.push(absoluteLineTop - (fileTop + headerRegion));
          if (overflowCounter != null) {
            if (overflowCounter <= 0) return true;
            overflowCounter--;
          }
        }
        const lineHeight$1 = this.getLineHeight(lineIndex, false);
        const currentHunk = Math.floor(currentLine / hunkLineCount);
        if (absoluteLineTop > top - lineHeight$1 && absoluteLineTop < bottom) firstVisibleHunk ??= currentHunk;
        if (absoluteLineTop + lineHeight$1 > viewportCenter) centerHunk ??= currentHunk;
        if (overflowCounter == null && absoluteLineTop >= bottom && isAtHunkBoundary) overflowCounter = overflowHunks;
        currentLine++;
        absoluteLineTop += lineHeight$1;
        return false;
      }
    });
    if (firstVisibleHunk == null) return {
      startingLine: 0,
      totalLines: 0,
      bufferBefore: 0,
      bufferAfter: fileHeight - headerRegion - fileGap
    };
    const collectedHunks = hunkOffsets.length;
    centerHunk ??= firstVisibleHunk;
    const idealStartHunk = Math.round(centerHunk - totalHunks / 2);
    const maxStartHunk = Math.max(0, collectedHunks - totalHunks);
    const startHunk = Math.max(0, Math.min(idealStartHunk, maxStartHunk));
    const startingLine = startHunk * hunkLineCount;
    const clampedTotalLines = idealStartHunk < 0 ? totalLines + idealStartHunk * hunkLineCount : totalLines;
    const bufferBefore = hunkOffsets[startHunk] ?? 0;
    const finalHunkIndex = startHunk + clampedTotalLines / hunkLineCount;
    return {
      startingLine,
      totalLines: clampedTotalLines,
      bufferBefore,
      bufferAfter: finalHunkIndex < hunkOffsets.length ? fileHeight - headerRegion - hunkOffsets[finalHunkIndex] - fileGap : fileHeight - (absoluteLineTop - fileTop) - fileGap
    };
  }
};

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/areObjectsEqual.js
function areObjectsEqual(objA, objB, omitKeys) {
  if (objA === objB || objA == null || objB == null) return objA === objB;
  const omitSet = new Set(omitKeys);
  const keysA = Object.keys(objA);
  const keysBSet = new Set(Object.keys(objB));
  for (const key2 of keysA) {
    keysBSet.delete(key2);
    if (omitSet.has(key2)) continue;
    if (!(key2 in objB) || objA[key2] !== objB[key2]) return false;
  }
  for (const key2 of Array.from(keysBSet)) if (!omitSet.has(key2)) return false;
  return true;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/areOptionsEqual.js
function areOptionsEqual(optionsA, optionsB) {
  const themeA = optionsA?.theme ?? DEFAULT_THEMES;
  const themeB = optionsB?.theme ?? DEFAULT_THEMES;
  const diffOptsA = getParseDiffOptions(optionsA);
  const diffOptsB = getParseDiffOptions(optionsB);
  return areThemesEqual(themeA, themeB) && areObjectsEqual(optionsA, optionsB, ["theme", "parseDiffOptions"]) && areObjectsEqual(diffOptsA, diffOptsB);
}
function getParseDiffOptions(options) {
  if (options != null && "parseDiffOptions" in options) return options.parseDiffOptions;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/react/utils/useFileInstance.js
init_neon_pilot_shared_react();
var useIsometricEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
function useFileInstance({ file, options, lineAnnotations, selectedLines, prerenderedHTML, metrics, hasGutterRenderUtility, hasCustomHeader, disableWorkerPool }) {
  const simpleVirtualizer = useVirtualizer();
  const poolManager = useContext(WorkerPoolContext);
  const instanceRef = useRef(null);
  const ref = useStableCallback((node) => {
    if (node != null) {
      if (instanceRef.current != null) throw new Error("File: An instance should not already exist when a node is created");
      if (simpleVirtualizer != null) instanceRef.current = new VirtualizedFile(mergeFileOptions({
        hasCustomHeader,
        hasGutterRenderUtility,
        options
      }), simpleVirtualizer, metrics, !disableWorkerPool ? poolManager : void 0, true);
      else instanceRef.current = new File(mergeFileOptions({
        hasCustomHeader,
        hasGutterRenderUtility,
        options
      }), !disableWorkerPool ? poolManager : void 0, true);
      instanceRef.current.hydrate({
        file,
        fileContainer: node,
        lineAnnotations,
        prerenderedHTML
      });
    } else {
      if (instanceRef.current == null) throw new Error("File: A File instance should exist when unmounting");
      instanceRef.current.cleanUp();
      instanceRef.current = null;
    }
  });
  useIsometricEffect(() => {
    if (instanceRef.current == null) return;
    const newOptions = mergeFileOptions({
      hasCustomHeader,
      hasGutterRenderUtility,
      options
    });
    const forceRender = !areOptionsEqual(instanceRef.current.options, newOptions);
    instanceRef.current.setOptions(newOptions);
    instanceRef.current.render({
      file,
      lineAnnotations,
      forceRender
    });
    if (selectedLines !== void 0) instanceRef.current.setSelectedLines(selectedLines);
  });
  return {
    ref,
    getHoveredLine: useCallback(() => {
      return instanceRef.current?.getHoveredLine();
    }, [])
  };
}
function mergeFileOptions({ options, hasCustomHeader, hasGutterRenderUtility }) {
  if (hasGutterRenderUtility || hasCustomHeader) return {
    ...options,
    renderCustomHeader: hasCustomHeader ? noopRender : void 0,
    renderGutterUtility: hasGutterRenderUtility ? noopRender : void 0
  };
  return options;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/react/File.js
function File2({ file, lineAnnotations, selectedLines, options, metrics, className, style, renderAnnotation, renderCustomHeader, renderHeaderPrefix, renderHeaderMetadata, prerenderedHTML, renderGutterUtility, renderHoverUtility, disableWorkerPool = false }) {
  const { ref, getHoveredLine } = useFileInstance({
    file,
    options,
    metrics,
    lineAnnotations,
    selectedLines,
    prerenderedHTML,
    hasGutterRenderUtility: renderGutterUtility != null || renderHoverUtility != null,
    hasCustomHeader: renderCustomHeader != null,
    disableWorkerPool
  });
  return /* @__PURE__ */ jsx(DIFFS_TAG_NAME, {
    ref,
    className,
    style,
    children: templateRender(renderFileChildren({
      file,
      renderAnnotation,
      renderCustomHeader,
      renderHeaderPrefix,
      renderHeaderMetadata,
      renderGutterUtility,
      renderHoverUtility,
      lineAnnotations,
      getHoveredLine
    }), prerenderedHTML)
  });
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/getMergeConflictActionSlotName.js
function getMergeConflictActionSlotName({ hunkIndex, lineIndex, conflictIndex }) {
  return `merge-conflict-action-${hunkIndex}-${lineIndex}-${conflictIndex}`;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/parseMergeConflictDiffFromFile.js
function getMergeConflictActionAnchor(action, fileDiff) {
  const hunk = fileDiff.hunks[action.hunkIndex];
  if (hunk == null) return;
  return {
    hunkIndex: action.hunkIndex,
    lineIndex: getUnifiedLineStartForContent(hunk, action.startContentIndex)
  };
}
function parseMergeConflictDiffFromFile(file, maxContextLines = 6) {
  maxContextLines = Math.max(maxContextLines, 1);
  const s2 = {
    deletionLines: [],
    additionLines: [],
    conflictStack: [],
    conflictBuilders: [],
    actions: [],
    hunks: [],
    nextConflictIndex: 0,
    splitLineCount: 0,
    unifiedLineCount: 0,
    lastHunkEnd: 0,
    activeHunk: void 0,
    maxContextLines,
    maxContextLines2: maxContextLines * 2
  };
  const contents = file.contents;
  const contentLength = contents.length;
  if (contentLength > 0) {
    let lineStart = 0;
    let lineIndex = 0;
    let newlinePos = contents.indexOf("\n", lineStart);
    while (newlinePos !== -1) {
      processLine2(s2, contents.slice(lineStart, newlinePos + 1), lineIndex);
      lineStart = newlinePos + 1;
      lineIndex++;
      newlinePos = contents.indexOf("\n", lineStart);
    }
    if (lineStart < contentLength) processLine2(s2, contents.slice(lineStart), lineIndex);
  }
  if (s2.conflictStack.length > 0) throw new Error("parseMergeConflictDiffFromFile: unfinished merge conflict marker stack");
  if (s2.activeHunk != null && s2.activeHunk.hunkContent.length > 0) {
    flushBufferedContext(s2, s2.activeHunk, "trailing");
    finalizeActiveHunk(s2);
  }
  for (let conflictIndex = 0; conflictIndex < s2.conflictBuilders.length; conflictIndex++) {
    const builder = s2.conflictBuilders[conflictIndex];
    if (builder == null || !builder.completed) throw new Error(`parseMergeConflictDiffFromFile: failed to build merge conflict action ${conflictIndex}`);
  }
  if (s2.hunks.length > 0 && s2.additionLines.length > 0 && s2.deletionLines.length > 0) {
    const lastHunk = s2.hunks[s2.hunks.length - 1];
    const collapsedAfter = Math.max(s2.additionLines.length - (lastHunk.additionStart + lastHunk.additionCount - 1), 0);
    s2.splitLineCount += collapsedAfter;
    s2.unifiedLineCount += collapsedAfter;
  }
  const currentContents = s2.deletionLines.join("");
  const incomingContents = s2.additionLines.join("");
  const currentFile = createResolvedConflictFile(file, "current", currentContents);
  const incomingFile = createResolvedConflictFile(file, "incoming", incomingContents);
  let type = "change";
  if (incomingContents === "") type = "deleted";
  else if (currentContents === "") type = "new";
  const fileDiff = {
    name: file.name,
    prevName: void 0,
    type,
    hunks: s2.hunks,
    splitLineCount: s2.splitLineCount,
    unifiedLineCount: s2.unifiedLineCount,
    isPartial: false,
    deletionLines: s2.deletionLines,
    additionLines: s2.additionLines,
    cacheKey: file.cacheKey != null ? `${file.cacheKey}:merge-conflict-diff` : void 0
  };
  return {
    fileDiff,
    currentFile,
    incomingFile,
    actions: s2.actions,
    markerRows: buildMergeConflictMarkerRows(fileDiff, s2.actions)
  };
}
function processLine2(s2, line, index) {
  const frame = s2.conflictStack[s2.conflictStack.length - 1];
  if (frame == null) {
    if (line.length >= 7 && line.charCodeAt(0) === 60 && getMergeConflictMarkerType(line) === "start") {
      handleStartMarker(s2, line, index);
      return;
    }
    emitContextLine(s2, line);
    return;
  }
  const markerType = getMergeConflictMarkerType(line);
  if (markerType === "start") {
    handleStartMarker(s2, line, index);
    return;
  }
  if (markerType === "base") {
    frame.stage = "base";
    frame.baseMarkerLineIndex = index;
    frame.markerLines.base = line;
    return;
  }
  if (markerType === "separator") {
    frame.stage = "incoming";
    frame.separatorLineIndex = index;
    frame.markerLines.separator = line;
    return;
  }
  if (markerType === "end") {
    const completedFrame = s2.conflictStack.pop();
    if (completedFrame == null) throw new Error("parseMergeConflictDiffFromFile: encountered end marker before start marker");
    finalizeConflict(s2, completedFrame, index, line);
    return;
  }
  if (frame.stage === "current") emitChangeLine(s2, "deletion", line, frame.conflictIndex, "current");
  else if (frame.stage === "base") emitContextLine(s2, line, frame.conflictIndex);
  else emitChangeLine(s2, "addition", line, frame.conflictIndex, "incoming");
}
function ensureActiveHunk(s2) {
  s2.activeHunk ??= createHunkBuilder(s2.additionLines.length + 1, s2.deletionLines.length + 1);
  return s2.activeHunk;
}
function assignConflictContent(s2, conflictIndex, role, contentIndex) {
  const builder = s2.conflictBuilders[conflictIndex];
  if (builder == null) throw new Error(`parseMergeConflictDiffFromFile: failed to locate conflict action ${conflictIndex}`);
  const action = builder.action;
  const hunkIndex = s2.hunks.length;
  if (action.hunkIndex < 0) action.hunkIndex = hunkIndex;
  else if (action.hunkIndex !== hunkIndex) throw new Error(`parseMergeConflictDiffFromFile: conflict ${conflictIndex} spans multiple hunks and cannot be anchored`);
  if (action.startContentIndex < 0) action.startContentIndex = contentIndex;
  action.endContentIndex = contentIndex;
  action.endMarkerContentIndex = contentIndex;
  if (role === "current") {
    action.currentContentIndex ??= contentIndex;
    return;
  }
  if (role === "base") {
    action.baseContentIndex ??= contentIndex;
    return;
  }
  action.incomingContentIndex = contentIndex;
}
function appendChangeLine(hunk, lineType, additionLineIndex, deletionLineIndex) {
  const hunkContent = hunk.hunkContent;
  const lastContent = hunkContent[hunkContent.length - 1];
  if (lastContent?.type === "change") {
    if (lineType === "addition") lastContent.additions++;
    else lastContent.deletions++;
    return hunkContent.length - 1;
  }
  hunkContent.push({
    type: "change",
    additions: lineType === "addition" ? 1 : 0,
    deletions: lineType === "deletion" ? 1 : 0,
    additionLineIndex,
    deletionLineIndex
  });
  return hunkContent.length - 1;
}
function flushBufferedContext(s2, hunk, mode) {
  let count = hunk.contextBufferCount;
  let addStart = hunk.contextBufferAdditionStart;
  let delStart = hunk.contextBufferDeletionStart;
  if (mode === "leading" && count > s2.maxContextLines) {
    const difference = count - s2.maxContextLines;
    addStart += difference;
    delStart += difference;
    count = s2.maxContextLines;
    hunk.additionStart += difference;
    hunk.deletionStart += difference;
    hunk.additionLineIndex += difference;
    hunk.deletionLineIndex += difference;
  }
  if (mode === "trailing" && count > s2.maxContextLines) count = s2.maxContextLines;
  if (count === 0) {
    hunk.contextBufferCount = 0;
    hunk.contextBufferBaseConflicts = void 0;
    return;
  }
  const hunkContent = hunk.hunkContent;
  const lastContent = hunkContent[hunkContent.length - 1];
  let contentIndex;
  if (lastContent?.type === "context") {
    lastContent.lines += count;
    contentIndex = hunkContent.length - 1;
  } else {
    hunkContent.push({
      type: "context",
      lines: count,
      additionLineIndex: addStart,
      deletionLineIndex: delStart
    });
    contentIndex = hunkContent.length - 1;
  }
  hunk.additionCount += count;
  hunk.deletionCount += count;
  const baseConflicts = hunk.contextBufferBaseConflicts;
  if (baseConflicts != null) {
    const bufferStartOffset = addStart - hunk.contextBufferAdditionStart;
    for (const [offset, conflictIndex] of baseConflicts) if (offset >= bufferStartOffset && offset < bufferStartOffset + count) assignConflictContent(s2, conflictIndex, "base", contentIndex);
  }
  hunk.contextBufferCount = 0;
  hunk.contextBufferBaseConflicts = void 0;
}
function finalizeActiveHunk(s2) {
  if (s2.activeHunk == null) return;
  const hunk = s2.activeHunk;
  s2.activeHunk = void 0;
  if (hunk.hunkContent.length === 0) return;
  let hunkSplitLineCount = 0;
  let hunkUnifiedLineCount = 0;
  for (const content of hunk.hunkContent) if (content.type === "context") {
    hunkSplitLineCount += content.lines;
    hunkUnifiedLineCount += content.lines;
  } else {
    hunkSplitLineCount += Math.max(content.additions, content.deletions);
    hunkUnifiedLineCount += content.additions + content.deletions;
  }
  const collapsedBefore = Math.max(hunk.additionStart - 1 - s2.lastHunkEnd, 0);
  const finalizedHunk = {
    collapsedBefore,
    additionStart: hunk.additionStart,
    additionCount: hunk.additionCount,
    additionLines: hunk.additionLines,
    additionLineIndex: hunk.additionLineIndex,
    deletionStart: hunk.deletionStart,
    deletionCount: hunk.deletionCount,
    deletionLines: hunk.deletionLines,
    deletionLineIndex: hunk.deletionLineIndex,
    hunkContent: hunk.hunkContent,
    hunkContext: void 0,
    hunkSpecs: `@@ -${formatHunkRange(hunk.deletionStart, hunk.deletionCount)} +${formatHunkRange(hunk.additionStart, hunk.additionCount)} @@
`,
    splitLineStart: s2.splitLineCount + collapsedBefore,
    splitLineCount: hunkSplitLineCount,
    unifiedLineStart: s2.unifiedLineCount + collapsedBefore,
    unifiedLineCount: hunkUnifiedLineCount,
    noEOFCRAdditions: false,
    noEOFCRDeletions: false
  };
  s2.hunks.push(finalizedHunk);
  s2.splitLineCount += collapsedBefore + hunkSplitLineCount;
  s2.unifiedLineCount += collapsedBefore + hunkUnifiedLineCount;
  s2.lastHunkEnd = hunk.additionStart + hunk.additionCount - 1;
}
function splitHunkWithBufferedContext(s2) {
  if (s2.activeHunk == null) return;
  const hunk = s2.activeHunk;
  const count = hunk.contextBufferCount;
  const omittedContextLineCount = count - s2.maxContextLines2;
  const nextAddStart = hunk.contextBufferAdditionStart + count - s2.maxContextLines;
  const nextDelStart = hunk.contextBufferDeletionStart + count - s2.maxContextLines;
  let nextBaseConflicts;
  if (hunk.contextBufferBaseConflicts != null) {
    const tailOffset = count - s2.maxContextLines;
    for (const [offset, ci] of hunk.contextBufferBaseConflicts) if (offset >= tailOffset) {
      nextBaseConflicts ??= /* @__PURE__ */ new Map();
      nextBaseConflicts.set(offset - tailOffset, ci);
    }
  }
  flushBufferedContext(s2, hunk, "trailing");
  const emittedAdditionCount = hunk.additionCount;
  const emittedDeletionCount = hunk.deletionCount;
  finalizeActiveHunk(s2);
  s2.activeHunk = createHunkBuilder(hunk.additionStart + emittedAdditionCount + omittedContextLineCount, hunk.deletionStart + emittedDeletionCount + omittedContextLineCount);
  s2.activeHunk.contextBufferAdditionStart = nextAddStart;
  s2.activeHunk.contextBufferDeletionStart = nextDelStart;
  s2.activeHunk.contextBufferCount = s2.maxContextLines;
  s2.activeHunk.contextBufferBaseConflicts = nextBaseConflicts;
}
function emitContextLine(s2, line, baseConflictIndex = -1) {
  const hunk = ensureActiveHunk(s2);
  if (hunk.contextBufferCount === 0) {
    hunk.contextBufferAdditionStart = s2.additionLines.length;
    hunk.contextBufferDeletionStart = s2.deletionLines.length;
  }
  s2.additionLines.push(line);
  s2.deletionLines.push(line);
  if (baseConflictIndex >= 0) {
    hunk.contextBufferBaseConflicts ??= /* @__PURE__ */ new Map();
    hunk.contextBufferBaseConflicts.set(hunk.contextBufferCount, baseConflictIndex);
  }
  hunk.contextBufferCount++;
}
function emitChangeLine(s2, lineType, line, conflictIndex, role) {
  let hunk = ensureActiveHunk(s2);
  if (hunk.hunkContent.length > 0 && hunk.contextBufferCount > s2.maxContextLines2) {
    splitHunkWithBufferedContext(s2);
    hunk = s2.activeHunk;
  }
  flushBufferedContext(s2, hunk, hunk.hunkContent.length === 0 ? "leading" : "before-change");
  const additionLineIndex = s2.additionLines.length;
  const deletionLineIndex = s2.deletionLines.length;
  if (lineType === "addition") s2.additionLines.push(line);
  else s2.deletionLines.push(line);
  const contentIndex = appendChangeLine(hunk, lineType, additionLineIndex, deletionLineIndex);
  if (lineType === "addition") {
    hunk.additionCount++;
    hunk.additionLines++;
  } else {
    hunk.deletionCount++;
    hunk.deletionLines++;
  }
  assignConflictContent(s2, conflictIndex, role, contentIndex);
}
function finalizeConflict(s2, frame, endLineIndex, endMarkerLine) {
  if (frame.separatorLineIndex == null || frame.markerLines.separator == null) throw new Error(`parseMergeConflictDiffFromFile: conflict ${frame.conflictIndex} is missing a separator marker`);
  const builder = s2.conflictBuilders[frame.conflictIndex];
  if (builder == null) throw new Error(`parseMergeConflictDiffFromFile: failed to finalize conflict ${frame.conflictIndex}`);
  const action = builder.action;
  action.markerLines.separator = frame.markerLines.separator;
  action.markerLines.end = endMarkerLine;
  if (frame.markerLines.base != null) action.markerLines.base = frame.markerLines.base;
  action.conflict = {
    conflictIndex: frame.conflictIndex,
    startLineIndex: frame.startLineIndex,
    startLineNumber: frame.startLineIndex + 1,
    separatorLineIndex: frame.separatorLineIndex,
    separatorLineNumber: frame.separatorLineIndex + 1,
    endLineIndex,
    endLineNumber: endLineIndex + 1,
    baseMarkerLineIndex: frame.baseMarkerLineIndex,
    baseMarkerLineNumber: frame.baseMarkerLineIndex != null ? frame.baseMarkerLineIndex + 1 : void 0
  };
  const fallbackContentIndex = action.currentContentIndex ?? action.incomingContentIndex;
  action.currentContentIndex ??= fallbackContentIndex;
  action.incomingContentIndex ??= fallbackContentIndex;
  if (action.startContentIndex < 0 && fallbackContentIndex != null) action.startContentIndex = fallbackContentIndex;
  if (action.endContentIndex < 0 && fallbackContentIndex != null) action.endContentIndex = fallbackContentIndex;
  if (action.endMarkerContentIndex < 0 && fallbackContentIndex != null) action.endMarkerContentIndex = fallbackContentIndex;
  if (action.hunkIndex < 0 || action.startContentIndex < 0 || action.endContentIndex < 0 || action.endMarkerContentIndex < 0) throw new Error(`parseMergeConflictDiffFromFile: failed to anchor merge conflict ${frame.conflictIndex}`);
  s2.actions[action.conflictIndex] = action;
  builder.completed = true;
}
function handleStartMarker(s2, line, lineIndex) {
  const conflictIndex = s2.nextConflictIndex;
  s2.nextConflictIndex++;
  s2.conflictStack.push({
    conflictIndex,
    stage: "current",
    startLineIndex: lineIndex,
    markerLines: { start: line }
  });
  s2.conflictBuilders[conflictIndex] = {
    completed: false,
    action: {
      conflict: {
        conflictIndex,
        startLineIndex: lineIndex,
        startLineNumber: lineIndex + 1,
        separatorLineIndex: lineIndex,
        separatorLineNumber: lineIndex + 1,
        endLineIndex: lineIndex,
        endLineNumber: lineIndex + 1,
        baseMarkerLineIndex: void 0,
        baseMarkerLineNumber: void 0
      },
      conflictIndex,
      hunkIndex: -1,
      startContentIndex: -1,
      endContentIndex: -1,
      endMarkerContentIndex: -1,
      markerLines: {
        start: line,
        separator: "",
        end: ""
      }
    }
  };
}
function createHunkBuilder(additionStart, deletionStart) {
  return {
    additionStart,
    deletionStart,
    additionCount: 0,
    deletionCount: 0,
    additionLines: 0,
    deletionLines: 0,
    additionLineIndex: Math.max(additionStart - 1, 0),
    deletionLineIndex: Math.max(deletionStart - 1, 0),
    hunkContent: [],
    contextBufferAdditionStart: Math.max(additionStart - 1, 0),
    contextBufferDeletionStart: Math.max(deletionStart - 1, 0),
    contextBufferCount: 0,
    contextBufferBaseConflicts: void 0
  };
}
function formatHunkRange(start, count) {
  return count === 1 ? `${start}` : `${start},${count}`;
}
function getMergeConflictMarkerType(line) {
  if (line.length < 7) return;
  const markerCode = line.charCodeAt(0);
  if (markerCode !== 60 && markerCode !== 62 && markerCode !== 61 && markerCode !== 124) return;
  const lineEnd = getLineContentEndIndex(line);
  if (lineEnd < 7) return;
  let markerLength = 1;
  while (markerLength < lineEnd && line.charCodeAt(markerLength) === markerCode) markerLength++;
  if (markerLength < 7) return;
  if (markerCode === 61) return markerLength === lineEnd ? "separator" : void 0;
  if (markerLength !== lineEnd && !isWhitespaceCode(line.charCodeAt(markerLength))) return;
  if (markerCode === 60) return "start";
  if (markerCode === 62) return "end";
  return "base";
}
function getLineContentEndIndex(line) {
  let end = line.length;
  if (end > 0 && line.charCodeAt(end - 1) === 10) end--;
  if (end > 0 && line.charCodeAt(end - 1) === 13) end--;
  return end;
}
function isWhitespaceCode(code) {
  return code === 9 || code === 10 || code === 11 || code === 12 || code === 13 || code === 32;
}
function createResolvedConflictFile(file, side, contents) {
  return {
    ...file,
    contents,
    cacheKey: file.cacheKey != null ? `${file.cacheKey}:merge-conflict-${side}` : void 0
  };
}
function buildMergeConflictMarkerRows(fileDiff, actions) {
  const markerRows = [];
  const hunkLineStartCache = new Array(fileDiff.hunks.length);
  const getLineStart = (hunkIndex, contentIndex) => {
    const hunk = fileDiff.hunks[hunkIndex];
    if (hunk == null) return 0;
    let starts = hunkLineStartCache[hunkIndex];
    if (starts == null) {
      starts = new Array(hunk.hunkContent.length + 1);
      let lineIndex = hunk.unifiedLineStart;
      starts[0] = lineIndex;
      for (let index = 0; index < hunk.hunkContent.length; index++) {
        const content = hunk.hunkContent[index];
        lineIndex += content.type === "context" ? content.lines : content.deletions + content.additions;
        starts[index + 1] = lineIndex;
      }
      hunkLineStartCache[hunkIndex] = starts;
    }
    return starts[Math.max(contentIndex, 0)] ?? hunk.unifiedLineStart;
  };
  const getLineEnd = (hunkIndex, contentIndex) => {
    const lineStart = getLineStart(hunkIndex, contentIndex);
    const lineEndExclusive = hunkLineStartCache[hunkIndex]?.[Math.max(contentIndex + 1, 0)] ?? getLineStart(hunkIndex, contentIndex + 1);
    return Math.max(lineStart, lineEndExclusive - 1);
  };
  for (const action of actions) {
    if (action == null) continue;
    const hunk = fileDiff.hunks[action.hunkIndex];
    if (hunk == null) continue;
    const actionLineIndex = getLineStart(action.hunkIndex, action.startContentIndex);
    markerRows.push(createMergeConflictMarkerRow(action, "marker-start", action.startContentIndex, action.markerLines.start, actionLineIndex));
    if (action.baseContentIndex != null) {
      const currentContentIndex$1 = action.currentContentIndex;
      const incomingContentIndex = action.incomingContentIndex;
      if (currentContentIndex$1 == null || incomingContentIndex == null) continue;
      const baseMarkerLine = action.markerLines.base;
      if (baseMarkerLine == null) continue;
      const currentChange = hunk.hunkContent[currentContentIndex$1];
      const baseContext = hunk.hunkContent[action.baseContentIndex];
      const incomingChange = hunk.hunkContent[incomingContentIndex];
      if (currentChange?.type !== "change" || baseContext?.type !== "context" || incomingChange?.type !== "change") continue;
      const currentStart = getLineStart(action.hunkIndex, currentContentIndex$1);
      const incomingStart = getLineStart(action.hunkIndex, incomingContentIndex);
      markerRows.push(createMergeConflictMarkerRow(action, "marker-base", action.baseContentIndex, baseMarkerLine, currentStart + currentChange.deletions));
      markerRows.push(createMergeConflictMarkerRow(action, "marker-separator", action.baseContentIndex, action.markerLines.separator, incomingStart), createMergeConflictMarkerRow(action, "marker-end", action.endMarkerContentIndex, action.markerLines.end, getLineEnd(action.hunkIndex, action.endMarkerContentIndex)));
      continue;
    }
    const currentContentIndex = action.currentContentIndex;
    if (currentContentIndex == null) continue;
    const content = hunk.hunkContent[currentContentIndex];
    if (content?.type !== "change") continue;
    const contentStart = getLineStart(action.hunkIndex, currentContentIndex);
    const separatorLineIndex = content.deletions > 0 ? contentStart + content.deletions : actionLineIndex;
    markerRows.push(createMergeConflictMarkerRow(action, "marker-separator", currentContentIndex, action.markerLines.separator, separatorLineIndex), createMergeConflictMarkerRow(action, "marker-end", action.endMarkerContentIndex, action.markerLines.end, getLineEnd(action.hunkIndex, action.endMarkerContentIndex)));
  }
  return markerRows;
}
function createMergeConflictMarkerRow(action, type, contentIndex, lineText, lineIndex) {
  return {
    type,
    hunkIndex: action.hunkIndex,
    contentIndex,
    conflictIndex: action.conflictIndex,
    lineText,
    lineIndex
  };
}
function getUnifiedLineStartForContent(hunk, contentIndex) {
  let lineIndex = hunk.unifiedLineStart;
  for (let index = 0; index < contentIndex; index++) {
    const content = hunk.hunkContent[index];
    lineIndex += content.type === "context" ? content.lines : content.deletions + content.additions;
  }
  return lineIndex;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/react/utils/renderDiffChildren.js
function renderDiffChildren({ fileDiff, actions, renderCustomHeader, renderHeaderPrefix, renderHeaderMetadata, renderAnnotation, renderGutterUtility, renderHoverUtility, renderMergeConflictUtility, lineAnnotations, getHoveredLine, getInstance }) {
  const gutterUtility = renderGutterUtility ?? renderHoverUtility;
  const customHeader = renderCustomHeader?.(fileDiff);
  const prefix = renderHeaderPrefix?.(fileDiff);
  const metadata = renderHeaderMetadata?.(fileDiff);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    customHeader != null ? /* @__PURE__ */ jsx("div", {
      slot: CUSTOM_HEADER_SLOT_ID,
      children: customHeader
    }) : /* @__PURE__ */ jsxs(Fragment, { children: [prefix != null && /* @__PURE__ */ jsx("div", {
      slot: HEADER_PREFIX_SLOT_ID,
      children: prefix
    }), metadata != null && /* @__PURE__ */ jsx("div", {
      slot: HEADER_METADATA_SLOT_ID,
      children: metadata
    })] }),
    renderAnnotation != null && lineAnnotations?.map((annotation, index) => /* @__PURE__ */ jsx("div", {
      slot: getLineAnnotationName(annotation),
      children: renderAnnotation(annotation)
    }, index)),
    actions != null && renderMergeConflictUtility != null && getInstance != null && actions.map((action) => {
      if (action == null) return;
      const slot = getSlotName(action, fileDiff);
      return /* @__PURE__ */ jsx("div", {
        slot,
        style: MergeConflictSlotStyles,
        children: renderMergeConflictUtility(action, getInstance)
      }, slot);
    }),
    gutterUtility != null && /* @__PURE__ */ jsx("div", {
      slot: "gutter-utility-slot",
      style: GutterUtilitySlotStyles,
      children: gutterUtility(getHoveredLine)
    })
  ] });
}
function getSlotName(action, fileDiff) {
  const anchor = getMergeConflictActionAnchor(action, fileDiff);
  return anchor != null ? getMergeConflictActionSlotName({
    hunkIndex: anchor.hunkIndex,
    lineIndex: anchor.lineIndex,
    conflictIndex: action.conflictIndex
  }) : void 0;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/managers/ScrollSyncManager.js
var ScrollSyncManager = class {
  isDeletionsScrolling = false;
  isAdditionsScrolling = false;
  timeoutId = -1;
  codeDeletions;
  codeAdditions;
  enabled = false;
  cleanUp() {
    if (!this.enabled) return;
    this.codeDeletions?.removeEventListener("scroll", this.handleDeletionsScroll);
    this.codeAdditions?.removeEventListener("scroll", this.handleAdditionsScroll);
    clearTimeout(this.timeoutId);
    this.codeDeletions = void 0;
    this.codeAdditions = void 0;
    this.enabled = false;
  }
  setup(pre, codeDeletions, codeAdditions) {
    if (codeDeletions == null || codeAdditions == null) for (const element2 of pre.children ?? []) {
      if (!(element2 instanceof HTMLElement)) continue;
      if ("deletions" in element2.dataset) codeDeletions = element2;
      else if ("additions" in element2.dataset) codeAdditions = element2;
    }
    if (codeAdditions == null || codeDeletions == null) {
      this.cleanUp();
      return;
    }
    if (this.codeDeletions !== codeDeletions) {
      this.codeDeletions?.removeEventListener("scroll", this.handleDeletionsScroll);
      this.codeDeletions = codeDeletions;
      codeDeletions.addEventListener("scroll", this.handleDeletionsScroll, { passive: true });
    }
    if (this.codeAdditions !== codeAdditions) {
      this.codeAdditions?.removeEventListener("scroll", this.handleAdditionsScroll);
      this.codeAdditions = codeAdditions;
      codeAdditions.addEventListener("scroll", this.handleAdditionsScroll, { passive: true });
    }
    this.enabled = true;
  }
  handleDeletionsScroll = () => {
    if (this.isAdditionsScrolling) return;
    this.isDeletionsScrolling = true;
    clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(() => {
      this.isDeletionsScrolling = false;
    }, 300);
    this.codeAdditions?.scrollTo({ left: this.codeDeletions?.scrollLeft });
  };
  handleAdditionsScroll = () => {
    if (this.isDeletionsScrolling) return;
    this.isAdditionsScrolling = true;
    clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(() => {
      this.isAdditionsScrolling = false;
    }, 300);
    this.codeDeletions?.scrollTo({ left: this.codeAdditions?.scrollLeft });
  };
};

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/createEmptyRowBuffer.js
function createEmptyRowBuffer(size) {
  return createHastElement({
    tagName: "div",
    properties: {
      "data-content-buffer": "",
      "data-buffer-size": size,
      style: `grid-row: span ${size};min-height:calc(${size} * 1lh)`
    }
  });
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/createNoNewlineElement.js
function createNoNewlineElement(type) {
  return createHastElement({
    tagName: "div",
    children: [createHastElement({
      tagName: "span",
      children: [createTextNodeElement("No newline at end of file")]
    })],
    properties: {
      "data-no-newline": "",
      "data-line-type": type,
      "data-column-content": ""
    }
  });
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/createSeparator.js
function createExpandButton(type) {
  return createHastElement({
    tagName: "div",
    children: [createIconElement({
      name: type === "both" ? "diffs-icon-expand-all" : "diffs-icon-expand",
      properties: { "data-icon": "" }
    })],
    properties: {
      role: "button",
      "data-expand-button": "",
      "data-expand-both": type === "both" ? "" : void 0,
      "data-expand-up": type === "up" ? "" : void 0,
      "data-expand-down": type === "down" ? "" : void 0
    }
  });
}
function createSeparator({ type, content, expandIndex, chunked = false, slotName, isFirstHunk, isLastHunk }) {
  let buttonCount = 0;
  const children = [];
  if (type === "metadata" && content != null) children.push(createHastElement({
    tagName: "div",
    children: [createTextNodeElement(content)],
    properties: { "data-separator-wrapper": "" }
  }));
  if ((type === "line-info" || type === "line-info-basic") && content != null) {
    const contentChildren = [];
    if (expandIndex != null) if (!chunked) {
      contentChildren.push(createExpandButton(!isFirstHunk && !isLastHunk ? "both" : isFirstHunk ? "down" : "up"));
      buttonCount++;
    } else {
      if (!isFirstHunk) {
        contentChildren.push(createExpandButton("up"));
        buttonCount++;
      }
      if (!isLastHunk) {
        contentChildren.push(createExpandButton("down"));
        buttonCount++;
      }
    }
    contentChildren.push(createHastElement({
      tagName: "div",
      children: [createHastElement({
        tagName: "span",
        children: [createTextNodeElement(content)],
        properties: { "data-unmodified-lines": "" }
      })],
      properties: { "data-separator-content": "" }
    }));
    if (chunked && expandIndex != null) contentChildren.push(createHastElement({
      tagName: "div",
      children: [createTextNodeElement("Expand all")],
      properties: {
        role: "button",
        "data-expand-button": "",
        "data-expand-all-button": ""
      }
    }));
    children.push(createHastElement({
      tagName: "div",
      children: contentChildren,
      properties: {
        "data-separator-wrapper": "",
        "data-separator-multi-button": buttonCount > 1 ? "" : void 0
      }
    }));
  }
  if (type === "custom" && slotName != null) children.push(createHastElement({
    tagName: "slot",
    properties: { name: slotName }
  }));
  return createHastElement({
    tagName: "div",
    children,
    properties: {
      "data-separator": children.length === 0 ? "simple" : type,
      "data-expand-index": expandIndex,
      "data-separator-first": isFirstHunk ? "" : void 0,
      "data-separator-last": isLastHunk ? "" : void 0
    }
  });
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/getHunkSeparatorSlotName.js
function getHunkSeparatorSlotName(type, hunkIndex) {
  return `hunk-separator-${type}-${hunkIndex}`;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/getTotalLineCountFromHunks.js
function getTotalLineCountFromHunks(hunks) {
  const lastHunk = hunks.at(-1);
  if (lastHunk == null) return 0;
  return Math.max(lastHunk.additionStart + lastHunk.additionCount, lastHunk.deletionStart + lastHunk.deletionCount);
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/isDefaultRenderRange.js
function isDefaultRenderRange(renderRange) {
  return renderRange.startingLine === 0 && renderRange.totalLines === Infinity && renderRange.bufferBefore === 0 && renderRange.bufferAfter === 0;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/renderers/DiffHunksRenderer.js
var instanceId4 = -1;
var DiffHunksRenderer = class {
  __id = `diff-hunks-renderer:${++instanceId4}`;
  highlighter;
  diff;
  expandedHunks = /* @__PURE__ */ new Map();
  deletionAnnotations = {};
  additionAnnotations = {};
  computedLang = "text";
  renderCache;
  constructor(options = { theme: DEFAULT_THEMES }, onRenderUpdate, workerManager) {
    this.options = options;
    this.onRenderUpdate = onRenderUpdate;
    this.workerManager = workerManager;
    if (workerManager?.isWorkingPool() !== true) this.highlighter = areThemesAttached(options.theme ?? DEFAULT_THEMES) ? getHighlighterIfLoaded() : void 0;
  }
  cleanUp() {
    this.highlighter = void 0;
    this.diff = void 0;
    this.renderCache = void 0;
    this.workerManager?.cleanUpPendingTasks(this);
    this.workerManager = void 0;
    this.onRenderUpdate = void 0;
  }
  recycle() {
    this.highlighter = void 0;
    this.diff = void 0;
    this.renderCache = void 0;
    this.workerManager?.cleanUpPendingTasks(this);
  }
  setOptions(options) {
    this.options = options;
  }
  mergeOptions(options) {
    this.options = {
      ...this.options,
      ...options
    };
  }
  expandHunk(index, direction, expansionLineCount = this.getOptionsWithDefaults().expansionLineCount) {
    const region = { ...this.expandedHunks.get(index) ?? {
      fromStart: 0,
      fromEnd: 0
    } };
    if (direction === "up" || direction === "both") region.fromStart += expansionLineCount;
    if (direction === "down" || direction === "both") region.fromEnd += expansionLineCount;
    if (this.renderCache?.highlighted !== true) this.renderCache = void 0;
    this.expandedHunks.set(index, region);
  }
  getExpandedHunk(hunkIndex) {
    return this.expandedHunks.get(hunkIndex) ?? DEFAULT_EXPANDED_REGION;
  }
  getExpandedHunksMap() {
    return this.expandedHunks;
  }
  setLineAnnotations(lineAnnotations) {
    this.additionAnnotations = {};
    this.deletionAnnotations = {};
    for (const annotation of lineAnnotations) {
      const map = (() => {
        switch (annotation.side) {
          case "deletions":
            return this.deletionAnnotations;
          case "additions":
            return this.additionAnnotations;
        }
      })();
      const arr = map[annotation.lineNumber] ?? [];
      map[annotation.lineNumber] = arr;
      arr.push(annotation);
    }
  }
  getUnifiedLineDecoration({ lineType }) {
    return { gutterLineType: lineType };
  }
  getSplitLineDecoration({ side, type }) {
    if (type !== "change") return { gutterLineType: type };
    return { gutterLineType: side === "deletions" ? "change-deletion" : "change-addition" };
  }
  createAnnotationElement(span) {
    return createAnnotationElement(span);
  }
  getOptionsWithDefaults() {
    const { diffIndicators = "bars", diffStyle = "split", disableBackground = false, disableFileHeader = false, disableLineNumbers = false, disableVirtualizationBuffers = false, collapsed = false, expandUnchanged = false, collapsedContextThreshold = DEFAULT_COLLAPSED_CONTEXT_THRESHOLD, expansionLineCount = 100, hunkSeparators = "line-info", lineDiffType = "word-alt", maxLineDiffLength = 1e3, overflow = "scroll", theme = DEFAULT_THEMES, headerRenderMode = "default", tokenizeMaxLineLength = 1e3, useTokenTransformer = false, useCSSClasses = false } = this.options;
    return {
      diffIndicators,
      diffStyle,
      disableBackground,
      disableFileHeader,
      disableLineNumbers,
      disableVirtualizationBuffers,
      collapsed,
      expandUnchanged,
      collapsedContextThreshold,
      expansionLineCount,
      hunkSeparators,
      lineDiffType,
      maxLineDiffLength,
      overflow,
      theme: this.workerManager?.getDiffRenderOptions().theme ?? theme,
      headerRenderMode,
      tokenizeMaxLineLength,
      useTokenTransformer,
      useCSSClasses
    };
  }
  async initializeHighlighter() {
    this.highlighter = await getSharedHighlighter(getHighlighterOptions(this.computedLang, this.options));
    return this.highlighter;
  }
  hydrate(diff) {
    if (diff == null) return;
    this.diff = diff;
    const { options } = this.getRenderOptions(diff);
    let cache = this.workerManager?.getDiffResultCache(diff);
    if (cache != null && !areDiffRenderOptionsEqual(options, cache.options)) cache = void 0;
    this.renderCache ??= {
      diff,
      highlighted: !isDiffPlainText(diff),
      options,
      result: cache?.result,
      renderRange: void 0
    };
    if (this.workerManager?.isWorkingPool() === true) {
      if (this.renderCache.result == null) this.workerManager.highlightDiffAST(this, this.diff);
    } else if (this.highlighter == null) {
      this.computedLang = diff.lang ?? getFiletypeFromFileName(diff.name);
      this.initializeHighlighter();
    }
  }
  getRenderOptions(diff) {
    const options = (() => {
      if (this.workerManager?.isWorkingPool() === true) return this.workerManager.getDiffRenderOptions();
      const { theme, tokenizeMaxLineLength, lineDiffType, maxLineDiffLength } = this.getOptionsWithDefaults();
      return {
        theme,
        useTokenTransformer: shouldUseTokenTransformer(this.options),
        tokenizeMaxLineLength,
        lineDiffType,
        maxLineDiffLength
      };
    })();
    this.getOptionsWithDefaults();
    const { renderCache } = this;
    if (renderCache?.result == null) return {
      options,
      forceRender: true
    };
    if (diff !== renderCache.diff || !areDiffRenderOptionsEqual(options, renderCache.options)) return {
      options,
      forceRender: true
    };
    return {
      options,
      forceRender: false
    };
  }
  renderDiff(diff = this.renderCache?.diff, renderRange = DEFAULT_RENDER_RANGE) {
    if (diff == null) return;
    const { expandUnchanged = false, collapsedContextThreshold } = this.getOptionsWithDefaults();
    const cache = this.workerManager?.getDiffResultCache(diff);
    if (cache != null && this.renderCache == null) this.renderCache = {
      diff,
      highlighted: true,
      renderRange: void 0,
      ...cache
    };
    const { options, forceRender } = this.getRenderOptions(diff);
    this.renderCache ??= {
      diff,
      highlighted: false,
      options,
      result: void 0,
      renderRange: void 0
    };
    if (this.workerManager?.isWorkingPool() === true) {
      if (this.renderCache.result == null || !this.renderCache.highlighted && (diff !== this.renderCache.diff || !areRenderRangesEqual(this.renderCache.renderRange, renderRange))) {
        this.renderCache.diff = diff;
        this.renderCache.result = this.workerManager.getPlainDiffAST(diff, renderRange.startingLine, renderRange.totalLines, isDefaultRenderRange(renderRange) ? true : expandUnchanged ? true : this.expandedHunks, collapsedContextThreshold);
        this.renderCache.renderRange = renderRange;
      }
      if (renderRange.totalLines > 0 && (!this.renderCache.highlighted || forceRender)) this.workerManager.highlightDiffAST(this, diff);
    } else {
      this.computedLang = diff.lang ?? getFiletypeFromFileName(diff.name);
      const hasThemes = this.highlighter != null && areThemesAttached(options.theme);
      const hasLangs = this.highlighter != null && areLanguagesAttached(this.computedLang);
      if (this.highlighter != null && hasThemes && (forceRender || !this.renderCache.highlighted && hasLangs || this.renderCache.result == null)) {
        const { result, options: options$1 } = this.renderDiffWithHighlighter(diff, this.highlighter, !hasLangs);
        this.renderCache = {
          diff,
          options: options$1,
          highlighted: hasLangs,
          result,
          renderRange: void 0
        };
      }
      if (!hasThemes || !hasLangs) this.asyncHighlight(diff).then(({ result, options: options$1 }) => {
        if (this.renderCache != null) this.renderCache.highlighted = false;
        this.onHighlightSuccess(diff, result, options$1);
      });
    }
    return this.renderCache.result != null ? this.processDiffResult(this.renderCache.diff, renderRange, this.renderCache.result) : void 0;
  }
  async asyncRender(diff, renderRange = DEFAULT_RENDER_RANGE) {
    const { result } = await this.asyncHighlight(diff);
    return this.processDiffResult(diff, renderRange, result);
  }
  createPreElement(split, totalLines, customProperties) {
    const { diffIndicators, disableBackground, disableLineNumbers, overflow } = this.getOptionsWithDefaults();
    return createPreElement({
      type: "diff",
      diffIndicators,
      disableBackground,
      disableLineNumbers,
      overflow,
      split,
      totalLines,
      customProperties
    });
  }
  async asyncHighlight(diff) {
    this.computedLang = diff.lang ?? getFiletypeFromFileName(diff.name);
    const hasThemes = this.highlighter != null && areThemesAttached(this.options.theme ?? DEFAULT_THEMES);
    const hasLangs = this.highlighter != null && areLanguagesAttached(this.computedLang);
    if (this.highlighter == null || !hasThemes || !hasLangs) this.highlighter = await this.initializeHighlighter();
    return this.renderDiffWithHighlighter(diff, this.highlighter);
  }
  renderDiffWithHighlighter(diff, highlighter2, forcePlainText = false) {
    const { options } = this.getRenderOptions(diff);
    const { collapsedContextThreshold } = this.getOptionsWithDefaults();
    return {
      result: renderDiffWithHighlighter(diff, highlighter2, options, {
        forcePlainText,
        expandedHunks: forcePlainText ? true : void 0,
        collapsedContextThreshold
      }),
      options
    };
  }
  onHighlightSuccess(diff, result, options) {
    if (this.renderCache == null) return;
    const triggerRenderUpdate = !this.renderCache.highlighted || !areDiffRenderOptionsEqual(this.renderCache.options, options) || this.renderCache.diff !== diff;
    this.renderCache = {
      diff,
      options,
      highlighted: true,
      result,
      renderRange: void 0
    };
    if (triggerRenderUpdate) this.onRenderUpdate?.();
  }
  onHighlightError(error) {
    console.error(error);
  }
  processDiffResult(fileDiff, renderRange, { code, themeStyles, baseThemeType }) {
    const { diffStyle, disableFileHeader, expandUnchanged, expansionLineCount, collapsedContextThreshold, hunkSeparators } = this.getOptionsWithDefaults();
    this.diff = fileDiff;
    const unified = diffStyle === "unified";
    let additionsContentAST = [];
    let deletionsContentAST = [];
    let unifiedContentAST = [];
    const hunkData = [];
    const { additionLines, deletionLines } = code;
    const context = {
      rowCount: 0,
      hunkSeparators,
      additionsContentAST,
      deletionsContentAST,
      unifiedContentAST,
      unifiedGutterAST: createGutterWrapper(),
      deletionsGutterAST: createGutterWrapper(),
      additionsGutterAST: createGutterWrapper(),
      expansionLineCount,
      hunkData,
      incrementRowCount(count = 1) {
        context.rowCount += count;
      },
      pushToGutter(type, element2) {
        switch (type) {
          case "unified":
            context.unifiedGutterAST.children.push(element2);
            break;
          case "deletions":
            context.deletionsGutterAST.children.push(element2);
            break;
          case "additions":
            context.additionsGutterAST.children.push(element2);
            break;
        }
      }
    };
    const trailingRangeSize = calculateTrailingRangeSize(fileDiff);
    const pendingSplitContext = {
      size: 0,
      side: void 0,
      increment() {
        this.size += 1;
      },
      flush() {
        if (diffStyle === "unified") return;
        if (this.size <= 0 || this.side == null) {
          this.side = void 0;
          this.size = 0;
          return;
        }
        if (this.side === "additions") {
          context.pushToGutter("additions", createGutterGap(void 0, "buffer", this.size));
          additionsContentAST?.push(createEmptyRowBuffer(this.size));
        } else {
          context.pushToGutter("deletions", createGutterGap(void 0, "buffer", this.size));
          deletionsContentAST?.push(createEmptyRowBuffer(this.size));
        }
        this.size = 0;
        this.side = void 0;
      }
    };
    const pushGutterLineNumber = (type, lineType, lineNumber, lineIndex, gutterProperties) => {
      context.pushToGutter(type, createGutterItem(lineType, lineNumber, lineIndex, gutterProperties));
    };
    function pushSeparators(props) {
      pendingSplitContext.flush();
      if (diffStyle === "unified") pushSeparator("unified", props, context);
      else {
        pushSeparator("deletions", props, context);
        pushSeparator("additions", props, context);
      }
    }
    iterateOverDiff({
      diff: fileDiff,
      diffStyle,
      startingLine: renderRange.startingLine,
      totalLines: renderRange.totalLines,
      expandedHunks: expandUnchanged ? true : this.expandedHunks,
      collapsedContextThreshold,
      callback: ({ hunkIndex, hunk, collapsedBefore, collapsedAfter, additionLine, deletionLine, type }) => {
        const splitLineIndex = deletionLine != null ? deletionLine.splitLineIndex : additionLine.splitLineIndex;
        const unifiedLineIndex = additionLine != null ? additionLine.unifiedLineIndex : deletionLine.unifiedLineIndex;
        if (diffStyle === "split" && type !== "change") pendingSplitContext.flush();
        if (collapsedBefore > 0) pushSeparators({
          hunkIndex,
          collapsedLines: collapsedBefore,
          rangeSize: Math.max(hunk?.collapsedBefore ?? 0, 0),
          hunkSpecs: hunk?.hunkSpecs,
          isFirstHunk: hunkIndex === 0,
          isLastHunk: false,
          isExpandable: !fileDiff.isPartial
        });
        const lineIndex = diffStyle === "unified" ? unifiedLineIndex : splitLineIndex;
        const renderedLineContext = {
          type,
          hunkIndex,
          lineIndex,
          unifiedLineIndex,
          splitLineIndex,
          deletionLine,
          additionLine
        };
        if (diffStyle === "unified") {
          const injectedRows = this.getUnifiedInjectedRowsForLine?.(renderedLineContext);
          if (injectedRows?.before != null) pushUnifiedInjectedRows(injectedRows.before, context);
          let deletionLineContent = deletionLine != null ? deletionLines[deletionLine.lineIndex] : void 0;
          let additionLineContent = additionLine != null ? additionLines[additionLine.lineIndex] : void 0;
          if (deletionLineContent == null && additionLineContent == null) {
            const errorMessage = "DiffHunksRenderer.processDiffResult: deletionLine and additionLine are null, something is wrong";
            console.error(errorMessage, { file: fileDiff.name });
            throw new Error(errorMessage);
          }
          const lineType = type === "change" ? additionLine != null ? "change-addition" : "change-deletion" : type;
          const lineDecoration = this.getUnifiedLineDecoration({
            type,
            lineType,
            additionLineIndex: additionLine?.lineIndex,
            deletionLineIndex: deletionLine?.lineIndex
          });
          pushGutterLineNumber("unified", lineDecoration.gutterLineType, additionLine != null ? additionLine.lineNumber : deletionLine.lineNumber, `${unifiedLineIndex},${splitLineIndex}`, lineDecoration.gutterProperties);
          if (additionLineContent != null) additionLineContent = withContentProperties(additionLineContent, lineDecoration.contentProperties);
          else if (deletionLineContent != null) deletionLineContent = withContentProperties(deletionLineContent, lineDecoration.contentProperties);
          pushLineWithAnnotation({
            diffStyle: "unified",
            type,
            deletionLine: deletionLineContent,
            additionLine: additionLineContent,
            unifiedSpan: this.getAnnotations("unified", deletionLine?.lineNumber, additionLine?.lineNumber, hunkIndex, lineIndex),
            createAnnotationElement: (span) => this.createAnnotationElement(span),
            context
          });
          if (injectedRows?.after != null) pushUnifiedInjectedRows(injectedRows.after, context);
        } else {
          const injectedRows = this.getSplitInjectedRowsForLine?.(renderedLineContext);
          if (injectedRows?.before != null) pushSplitInjectedRows(injectedRows.before, context, pendingSplitContext);
          let deletionLineContent = deletionLine != null ? deletionLines[deletionLine.lineIndex] : void 0;
          let additionLineContent = additionLine != null ? additionLines[additionLine.lineIndex] : void 0;
          const deletionLineDecoration = this.getSplitLineDecoration({
            side: "deletions",
            type,
            lineIndex: deletionLine?.lineIndex
          });
          const additionLineDecoration = this.getSplitLineDecoration({
            side: "additions",
            type,
            lineIndex: additionLine?.lineIndex
          });
          if (deletionLineContent == null && additionLineContent == null) {
            const errorMessage = "DiffHunksRenderer.processDiffResult: deletionLine and additionLine are null, something is wrong";
            console.error(errorMessage, { file: fileDiff.name });
            throw new Error(errorMessage);
          }
          const missingSide = (() => {
            if (type === "change") {
              if (additionLineContent == null) return "additions";
              else if (deletionLineContent == null) return "deletions";
            }
          })();
          if (missingSide != null) {
            if (pendingSplitContext.side != null && pendingSplitContext.side !== missingSide) throw new Error("DiffHunksRenderer.processDiffResult: iterateOverDiff, invalid pending splits");
            pendingSplitContext.side = missingSide;
            pendingSplitContext.increment();
          }
          const annotationSpans = this.getAnnotations("split", deletionLine?.lineNumber, additionLine?.lineNumber, hunkIndex, lineIndex);
          if (annotationSpans != null && pendingSplitContext.size > 0) pendingSplitContext.flush();
          if (deletionLine != null) {
            const deletionLineDecorated = withContentProperties(deletionLineContent, deletionLineDecoration.contentProperties);
            pushGutterLineNumber("deletions", deletionLineDecoration.gutterLineType, deletionLine.lineNumber, `${deletionLine.unifiedLineIndex},${splitLineIndex}`, deletionLineDecoration.gutterProperties);
            if (deletionLineDecorated != null) deletionLineContent = deletionLineDecorated;
          }
          if (additionLine != null) {
            const additionLineDecorated = withContentProperties(additionLineContent, additionLineDecoration.contentProperties);
            pushGutterLineNumber("additions", additionLineDecoration.gutterLineType, additionLine.lineNumber, `${additionLine.unifiedLineIndex},${splitLineIndex}`, additionLineDecoration.gutterProperties);
            if (additionLineDecorated != null) additionLineContent = additionLineDecorated;
          }
          pushLineWithAnnotation({
            diffStyle: "split",
            type,
            additionLine: additionLineContent,
            deletionLine: deletionLineContent,
            ...annotationSpans,
            createAnnotationElement: (span) => this.createAnnotationElement(span),
            context
          });
          if (injectedRows?.after != null) pushSplitInjectedRows(injectedRows.after, context, pendingSplitContext);
        }
        const noEOFCRDeletion = deletionLine?.noEOFCR ?? false;
        const noEOFCRAddition = additionLine?.noEOFCR ?? false;
        if (noEOFCRAddition || noEOFCRDeletion) {
          if (noEOFCRDeletion) {
            const noEOFType = type === "context" || type === "context-expanded" ? type : "change-deletion";
            if (diffStyle === "unified") {
              context.unifiedContentAST.push(createNoNewlineElement(noEOFType));
              context.pushToGutter("unified", createGutterGap(noEOFType, "metadata", 1));
            } else {
              context.deletionsContentAST.push(createNoNewlineElement(noEOFType));
              context.pushToGutter("deletions", createGutterGap(noEOFType, "metadata", 1));
              if (!noEOFCRAddition) {
                context.pushToGutter("additions", createGutterGap(void 0, "buffer", 1));
                context.additionsContentAST.push(createEmptyRowBuffer(1));
              }
            }
          }
          if (noEOFCRAddition) {
            const noEOFType = type === "context" || type === "context-expanded" ? type : "change-addition";
            if (diffStyle === "unified") {
              context.unifiedContentAST.push(createNoNewlineElement(noEOFType));
              context.pushToGutter("unified", createGutterGap(noEOFType, "metadata", 1));
            } else {
              context.additionsContentAST.push(createNoNewlineElement(noEOFType));
              context.pushToGutter("additions", createGutterGap(noEOFType, "metadata", 1));
              if (!noEOFCRDeletion) {
                context.pushToGutter("deletions", createGutterGap(void 0, "buffer", 1));
                context.deletionsContentAST.push(createEmptyRowBuffer(1));
              }
            }
          }
          context.incrementRowCount(1);
        }
        if (collapsedAfter > 0 && hunkSeparators !== "simple") pushSeparators({
          hunkIndex: type === "context-expanded" ? hunkIndex : hunkIndex + 1,
          collapsedLines: collapsedAfter,
          rangeSize: trailingRangeSize,
          hunkSpecs: void 0,
          isFirstHunk: false,
          isLastHunk: true,
          isExpandable: !fileDiff.isPartial
        });
        context.incrementRowCount(1);
      }
    });
    if (diffStyle === "split") pendingSplitContext.flush();
    const totalLines = Math.max(getTotalLineCountFromHunks(fileDiff.hunks), fileDiff.additionLines.length ?? 0, fileDiff.deletionLines.length ?? 0);
    const hasBuffer = renderRange.bufferBefore > 0 || renderRange.bufferAfter > 0;
    const shouldIncludeAdditions = !unified && fileDiff.type !== "deleted";
    const shouldIncludeDeletions = !unified && fileDiff.type !== "new";
    const hasContent = context.rowCount > 0 || hasBuffer;
    additionsContentAST = shouldIncludeAdditions && hasContent ? additionsContentAST : void 0;
    deletionsContentAST = shouldIncludeDeletions && hasContent ? deletionsContentAST : void 0;
    unifiedContentAST = unified && hasContent ? unifiedContentAST : void 0;
    const preNode = this.createPreElement(deletionsContentAST != null && additionsContentAST != null, totalLines);
    return {
      unifiedGutterAST: unified && hasContent ? context.unifiedGutterAST.children : void 0,
      unifiedContentAST,
      deletionsGutterAST: shouldIncludeDeletions && hasContent ? context.deletionsGutterAST.children : void 0,
      deletionsContentAST,
      additionsGutterAST: shouldIncludeAdditions && hasContent ? context.additionsGutterAST.children : void 0,
      additionsContentAST,
      hunkData,
      preNode,
      themeStyles,
      baseThemeType,
      headerElement: !disableFileHeader ? this.renderHeader(this.diff) : void 0,
      totalLines,
      rowCount: context.rowCount,
      bufferBefore: renderRange.bufferBefore,
      bufferAfter: renderRange.bufferAfter,
      css: ""
    };
  }
  renderCodeAST(type, result) {
    const gutterAST = type === "unified" ? result.unifiedGutterAST : type === "deletions" ? result.deletionsGutterAST : result.additionsGutterAST;
    const contentAST = type === "unified" ? result.unifiedContentAST : type === "deletions" ? result.deletionsContentAST : result.additionsContentAST;
    if (gutterAST == null || contentAST == null) return;
    const gutter = createGutterWrapper(gutterAST);
    gutter.properties.style = `grid-row: span ${result.rowCount}`;
    return [gutter, createContentColumn(contentAST, result.rowCount)];
  }
  renderFullAST(result, children = []) {
    const containerSize = this.getOptionsWithDefaults().hunkSeparators === "line-info";
    const unifiedAST = this.renderCodeAST("unified", result);
    if (unifiedAST != null) {
      children.push(createHastElement({
        tagName: "code",
        children: unifiedAST,
        properties: {
          "data-code": "",
          "data-container-size": containerSize ? "" : void 0,
          "data-unified": ""
        }
      }));
      return {
        ...result.preNode,
        children
      };
    }
    const deletionsAST = this.renderCodeAST("deletions", result);
    if (deletionsAST != null) children.push(createHastElement({
      tagName: "code",
      children: deletionsAST,
      properties: {
        "data-code": "",
        "data-container-size": containerSize ? "" : void 0,
        "data-deletions": ""
      }
    }));
    const additionsAST = this.renderCodeAST("additions", result);
    if (additionsAST != null) children.push(createHastElement({
      tagName: "code",
      children: additionsAST,
      properties: {
        "data-code": "",
        "data-container-size": containerSize ? "" : void 0,
        "data-additions": ""
      }
    }));
    return {
      ...result.preNode,
      children
    };
  }
  renderFullHTML(result, tempChildren = []) {
    return toHtml(this.renderFullAST(result, tempChildren));
  }
  renderPartialHTML(children, columnType) {
    if (columnType == null) return toHtml(children);
    return toHtml(createHastElement({
      tagName: "code",
      children,
      properties: {
        "data-code": "",
        "data-container-size": this.getOptionsWithDefaults().hunkSeparators === "line-info" ? "" : void 0,
        [`data-${columnType}`]: ""
      }
    }));
  }
  getAnnotations(type, deletionLineNumber, additionLineNumber, hunkIndex, lineIndex) {
    const deletionSpan = {
      type: "annotation",
      hunkIndex,
      lineIndex,
      annotations: []
    };
    if (deletionLineNumber != null) for (const anno of this.deletionAnnotations[deletionLineNumber] ?? []) deletionSpan.annotations.push(getLineAnnotationName(anno));
    const additionSpan = {
      type: "annotation",
      hunkIndex,
      lineIndex,
      annotations: []
    };
    if (additionLineNumber != null) for (const anno of this.additionAnnotations[additionLineNumber] ?? []) (type === "unified" ? deletionSpan : additionSpan).annotations.push(getLineAnnotationName(anno));
    if (type === "unified") {
      if (deletionSpan.annotations.length > 0) return deletionSpan;
      return;
    }
    if (additionSpan.annotations.length === 0 && deletionSpan.annotations.length === 0) return;
    return {
      deletionSpan,
      additionSpan
    };
  }
  renderHeader(diff) {
    const { headerRenderMode } = this.getOptionsWithDefaults();
    return createFileHeaderElement({
      fileOrDiff: diff,
      mode: headerRenderMode
    });
  }
};
function getModifiedLinesString(lines) {
  return `${lines} unmodified line${lines > 1 ? "s" : ""}`;
}
function pushUnifiedInjectedRows(rows, context) {
  for (const row of rows) {
    context.unifiedContentAST.push(row.content);
    context.pushToGutter("unified", row.gutter);
    context.incrementRowCount(1);
  }
}
function pushSplitInjectedRows(rows, context, pendingSplitContext) {
  for (const { deletion, addition } of rows) {
    if (deletion == null && addition == null) continue;
    const missingSide = deletion != null && addition != null ? void 0 : deletion == null ? "deletions" : "additions";
    if (missingSide == null || pendingSplitContext.side !== missingSide) pendingSplitContext.flush();
    if (deletion != null) {
      context.deletionsContentAST.push(deletion.content);
      context.pushToGutter("deletions", deletion.gutter);
    }
    if (addition != null) {
      context.additionsContentAST.push(addition.content);
      context.pushToGutter("additions", addition.gutter);
    }
    if (missingSide != null) {
      pendingSplitContext.side = missingSide;
      pendingSplitContext.increment();
    }
    context.incrementRowCount(1);
  }
}
function pushLineWithAnnotation({ diffStyle, type, deletionLine, additionLine, unifiedSpan, deletionSpan, additionSpan, createAnnotationElement: createAnnotationElement$1, context }) {
  let hasAnnotationRow = false;
  if (diffStyle === "unified") {
    if (additionLine != null) context.unifiedContentAST.push(additionLine);
    else if (deletionLine != null) context.unifiedContentAST.push(deletionLine);
    if (unifiedSpan != null) {
      const lineType = type === "change" ? deletionLine != null ? "change-deletion" : "change-addition" : type;
      context.unifiedContentAST.push(createAnnotationElement$1(unifiedSpan));
      context.pushToGutter("unified", createGutterGap(lineType, "annotation", 1));
      hasAnnotationRow = true;
    }
  } else if (diffStyle === "split") {
    if (deletionLine != null) context.deletionsContentAST.push(deletionLine);
    if (additionLine != null) context.additionsContentAST.push(additionLine);
    if (deletionSpan != null) {
      const lineType = type === "change" ? deletionLine != null ? "change-deletion" : "context" : type;
      context.deletionsContentAST.push(createAnnotationElement$1(deletionSpan));
      context.pushToGutter("deletions", createGutterGap(lineType, "annotation", 1));
      hasAnnotationRow = true;
    }
    if (additionSpan != null) {
      const lineType = type === "change" ? additionLine != null ? "change-addition" : "context" : type;
      context.additionsContentAST.push(createAnnotationElement$1(additionSpan));
      context.pushToGutter("additions", createGutterGap(lineType, "annotation", 1));
      hasAnnotationRow = true;
    }
  }
  if (hasAnnotationRow) context.incrementRowCount(1);
}
function pushSeparator(type, { hunkIndex, collapsedLines, rangeSize, hunkSpecs, isFirstHunk, isLastHunk, isExpandable }, context) {
  if (collapsedLines <= 0) return;
  const linesAST = type === "unified" ? context.unifiedContentAST : type === "deletions" ? context.deletionsContentAST : context.additionsContentAST;
  if (context.hunkSeparators === "metadata") {
    if (hunkSpecs != null) {
      context.pushToGutter(type, createSeparator({
        type: "metadata",
        content: hunkSpecs,
        isFirstHunk,
        isLastHunk
      }));
      linesAST.push(createSeparator({
        type: "metadata",
        content: hunkSpecs,
        isFirstHunk,
        isLastHunk
      }));
      if (type !== "additions") context.incrementRowCount(1);
    }
    return;
  }
  if (context.hunkSeparators === "simple") {
    if (hunkIndex > 0) {
      context.pushToGutter(type, createSeparator({
        type: "simple",
        isFirstHunk,
        isLastHunk: false
      }));
      linesAST.push(createSeparator({
        type: "simple",
        isFirstHunk,
        isLastHunk: false
      }));
      if (type !== "additions") context.incrementRowCount(1);
    }
    return;
  }
  const slotName = getHunkSeparatorSlotName(type, hunkIndex);
  const chunked = rangeSize > context.expansionLineCount;
  const expandIndex = isExpandable ? hunkIndex : void 0;
  context.pushToGutter(type, createSeparator({
    type: context.hunkSeparators,
    content: getModifiedLinesString(collapsedLines),
    expandIndex,
    chunked,
    slotName,
    isFirstHunk,
    isLastHunk
  }));
  linesAST.push(createSeparator({
    type: context.hunkSeparators,
    content: getModifiedLinesString(collapsedLines),
    expandIndex,
    chunked,
    slotName,
    isFirstHunk,
    isLastHunk
  }));
  if (type !== "additions") context.incrementRowCount(1);
  context.hunkData.push({
    slotName,
    hunkIndex,
    lines: collapsedLines,
    type,
    expandable: isExpandable ? {
      up: !isFirstHunk,
      down: !isLastHunk,
      chunked
    } : void 0
  });
}
function withContentProperties(lineNode, contentProperties) {
  if (lineNode == null || lineNode.type !== "element" || contentProperties == null) return lineNode;
  return {
    ...lineNode,
    properties: {
      ...lineNode.properties,
      ...contentProperties
    }
  };
}
function calculateTrailingRangeSize(fileDiff) {
  const lastHunk = fileDiff.hunks.at(-1);
  if (lastHunk == null || fileDiff.isPartial || fileDiff.additionLines.length === 0 || fileDiff.deletionLines.length === 0) return 0;
  const additionRemaining = fileDiff.additionLines.length - (lastHunk.additionLineIndex + lastHunk.additionCount);
  const deletionRemaining = fileDiff.deletionLines.length - (lastHunk.deletionLineIndex + lastHunk.deletionCount);
  if (additionRemaining !== deletionRemaining) throw new Error(`DiffHunksRenderer.processDiffResult: trailing context mismatch (additions=${additionRemaining}, deletions=${deletionRemaining}) for ${fileDiff.name}`);
  return Math.min(additionRemaining, deletionRemaining);
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/areDiffLineAnnotationsEqual.js
function areDiffLineAnnotationsEqual(annotationA, annotationB) {
  return annotationA.lineNumber === annotationB.lineNumber && annotationA.side === annotationB.side && annotationA.metadata === annotationB.metadata;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/areHunkDataEqual.js
function areHunkDataEqual(hunkA, hunkB) {
  return hunkA.slotName === hunkB.slotName && hunkA.hunkIndex === hunkB.hunkIndex && hunkA.lines === hunkB.lines && hunkA.type === hunkB.type && hunkA.expandable?.chunked === hunkB.expandable?.chunked && hunkA.expandable?.up === hunkB.expandable?.up && hunkA.expandable?.down === hunkB.expandable?.down;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/parseLineType.js
function parseLineType(line) {
  const firstChar = line[0];
  if (firstChar !== "+" && firstChar !== "-" && firstChar !== " " && firstChar !== "\\") {
    console.error(`parseLineType: Invalid firstChar: "${firstChar}", full line: "${line}"`);
    return;
  }
  const processedLine = line.substring(1);
  return {
    line: processedLine === "" ? "\n" : processedLine,
    type: firstChar === " " ? "context" : firstChar === "\\" ? "metadata" : firstChar === "+" ? "addition" : "deletion"
  };
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/parsePatchFiles.js
function processPatch(data, cacheKeyPrefix, throwOnError = false) {
  const isGitDiff = GIT_DIFF_FILE_BREAK_REGEX.test(data);
  const rawFiles = data.split(isGitDiff ? GIT_DIFF_FILE_BREAK_REGEX : UNIFIED_DIFF_FILE_BREAK_REGEX);
  let patchMetadata;
  const files = [];
  for (const fileOrPatchMetadata of rawFiles) {
    if (isGitDiff && !GIT_DIFF_FILE_BREAK_REGEX.test(fileOrPatchMetadata)) {
      if (patchMetadata == null) patchMetadata = fileOrPatchMetadata;
      else if (throwOnError) throw Error("parsePatchContent: unknown file blob");
      else console.error("parsePatchContent: unknown file blob:", fileOrPatchMetadata);
      continue;
    } else if (!isGitDiff && !UNIFIED_DIFF_FILE_BREAK_REGEX.test(fileOrPatchMetadata)) {
      if (patchMetadata == null) patchMetadata = fileOrPatchMetadata;
      else if (throwOnError) throw Error("parsePatchContent: unknown file blob");
      else console.error("parsePatchContent: unknown file blob:", fileOrPatchMetadata);
      continue;
    }
    const currentFile = processFile(fileOrPatchMetadata, {
      cacheKey: cacheKeyPrefix != null ? `${cacheKeyPrefix}-${files.length}` : void 0,
      isGitDiff,
      throwOnError
    });
    if (currentFile != null) files.push(currentFile);
  }
  return {
    patchMetadata,
    files
  };
}
function processFile(fileDiffString, { cacheKey, isGitDiff = GIT_DIFF_FILE_BREAK_REGEX.test(fileDiffString), oldFile, newFile, throwOnError = false } = {}) {
  let lastHunkEnd = 0;
  const hunks = fileDiffString.split(FILE_CONTEXT_BLOB);
  let currentFile;
  const isPartial = oldFile == null || newFile == null;
  let deletionLineIndex = 0;
  let additionLineIndex = 0;
  for (const hunk of hunks) {
    const lines = hunk.split(SPLIT_WITH_NEWLINES);
    const firstLine = lines.shift();
    if (firstLine == null) {
      if (throwOnError) throw Error("parsePatchContent: invalid hunk");
      else console.error("parsePatchContent: invalid hunk", hunk);
      continue;
    }
    const fileHeaderMatch = firstLine.match(HUNK_HEADER);
    let additionLines = 0;
    let deletionLines = 0;
    if (fileHeaderMatch == null || currentFile == null) {
      if (currentFile != null) {
        if (throwOnError) throw Error("parsePatchContent: Invalid hunk");
        else console.error("parsePatchContent: Invalid hunk", hunk);
        continue;
      }
      currentFile = {
        name: "",
        type: "change",
        hunks: [],
        splitLineCount: 0,
        unifiedLineCount: 0,
        isPartial,
        additionLines: !isPartial && oldFile != null && newFile != null ? newFile.contents.split(SPLIT_WITH_NEWLINES) : [],
        deletionLines: !isPartial && oldFile != null && newFile != null ? oldFile.contents.split(SPLIT_WITH_NEWLINES) : [],
        cacheKey
      };
      if (currentFile.additionLines.length === 1 && newFile?.contents === "") currentFile.additionLines.length = 0;
      if (currentFile.deletionLines.length === 1 && oldFile?.contents === "") currentFile.deletionLines.length = 0;
      lines.unshift(firstLine);
      for (const line of lines) {
        const filenameMatch = line.match(isGitDiff ? FILENAME_HEADER_REGEX_GIT : FILENAME_HEADER_REGEX);
        if (line.startsWith("diff --git")) {
          const [, , prevName, , name] = line.trim().match(ALTERNATE_FILE_NAMES_GIT) ?? [];
          currentFile.name = name.trim();
          if (prevName !== name) currentFile.prevName = prevName.trim();
        } else if (filenameMatch != null) {
          const [, type, fileName] = filenameMatch;
          if (type === "---" && fileName !== "/dev/null") {
            currentFile.prevName = fileName.trim();
            currentFile.name = fileName.trim();
          } else if (type === "+++" && fileName !== "/dev/null") currentFile.name = fileName.trim();
        } else if (isGitDiff) {
          if (line.startsWith("new mode ")) currentFile.mode = line.replace("new mode", "").trim();
          if (line.startsWith("old mode ")) currentFile.prevMode = line.replace("old mode", "").trim();
          if (line.startsWith("new file mode")) {
            currentFile.type = "new";
            currentFile.mode = line.replace("new file mode", "").trim();
          }
          if (line.startsWith("deleted file mode")) {
            currentFile.type = "deleted";
            currentFile.mode = line.replace("deleted file mode", "").trim();
          }
          if (line.startsWith("similarity index")) if (line.startsWith("similarity index 100%")) currentFile.type = "rename-pure";
          else currentFile.type = "rename-changed";
          if (line.startsWith("index ")) {
            const [, prevObjectId, newObjectId, mode] = line.trim().match(INDEX_LINE_METADATA) ?? [];
            if (prevObjectId != null) currentFile.prevObjectId = prevObjectId;
            if (newObjectId != null) currentFile.newObjectId = newObjectId;
            if (mode != null) currentFile.mode = mode;
          }
          if (line.startsWith("rename from ")) currentFile.prevName = line.replace("rename from ", "").trim();
          if (line.startsWith("rename to ")) currentFile.name = line.replace("rename to ", "").trim();
        }
      }
      continue;
    }
    let currentContent;
    let lastLineType;
    while (lines.length > 0 && (lines[lines.length - 1] === "\n" || lines[lines.length - 1] === "\r" || lines[lines.length - 1] === "\r\n" || lines[lines.length - 1] === "")) lines.pop();
    const additionStart = parseInt(fileHeaderMatch[3]);
    const deletionStart = parseInt(fileHeaderMatch[1]);
    deletionLineIndex = isPartial ? deletionLineIndex : deletionStart - 1;
    additionLineIndex = isPartial ? additionLineIndex : additionStart - 1;
    const hunkData = {
      collapsedBefore: 0,
      splitLineCount: 0,
      splitLineStart: 0,
      unifiedLineCount: 0,
      unifiedLineStart: 0,
      additionCount: parseInt(fileHeaderMatch[4] ?? "1"),
      additionStart,
      additionLines,
      deletionCount: parseInt(fileHeaderMatch[2] ?? "1"),
      deletionStart,
      deletionLines,
      deletionLineIndex,
      additionLineIndex,
      hunkContent: [],
      hunkContext: fileHeaderMatch[5],
      hunkSpecs: firstLine,
      noEOFCRAdditions: false,
      noEOFCRDeletions: false
    };
    if (isNaN(hunkData.additionCount) || isNaN(hunkData.deletionCount) || isNaN(hunkData.additionStart) || isNaN(hunkData.deletionStart)) {
      if (throwOnError) throw Error("parsePatchContent: invalid hunk metadata");
      else console.error("parsePatchContent: invalid hunk metadata", hunkData);
      continue;
    }
    for (const rawLine of lines) {
      const parsedLine = parseLineType(rawLine);
      if (parsedLine == null) {
        console.error("processFile: invalid rawLine:", rawLine);
        continue;
      }
      const { type, line } = parsedLine;
      if (type === "addition") {
        if (currentContent == null || currentContent.type !== "change") {
          currentContent = createContentGroup("change", deletionLineIndex, additionLineIndex);
          hunkData.hunkContent.push(currentContent);
        }
        additionLineIndex++;
        if (isPartial) currentFile.additionLines.push(line);
        currentContent.additions++;
        additionLines++;
        lastLineType = "addition";
      } else if (type === "deletion") {
        if (currentContent == null || currentContent.type !== "change") {
          currentContent = createContentGroup("change", deletionLineIndex, additionLineIndex);
          hunkData.hunkContent.push(currentContent);
        }
        deletionLineIndex++;
        if (isPartial) currentFile.deletionLines.push(line);
        currentContent.deletions++;
        deletionLines++;
        lastLineType = "deletion";
      } else if (type === "context") {
        if (currentContent == null || currentContent.type !== "context") {
          currentContent = createContentGroup("context", deletionLineIndex, additionLineIndex);
          hunkData.hunkContent.push(currentContent);
        }
        additionLineIndex++;
        deletionLineIndex++;
        if (isPartial) {
          currentFile.deletionLines.push(line);
          currentFile.additionLines.push(line);
        }
        currentContent.lines++;
        lastLineType = "context";
      } else if (type === "metadata" && currentContent != null) {
        if (currentContent.type === "context") {
          hunkData.noEOFCRAdditions = true;
          hunkData.noEOFCRDeletions = true;
        } else if (lastLineType === "deletion") hunkData.noEOFCRDeletions = true;
        else if (lastLineType === "addition") hunkData.noEOFCRAdditions = true;
        if (isPartial && (lastLineType === "addition" || lastLineType === "context")) {
          const lastIndex = currentFile.additionLines.length - 1;
          if (lastIndex >= 0) currentFile.additionLines[lastIndex] = cleanLastNewline(currentFile.additionLines[lastIndex]);
        }
        if (isPartial && (lastLineType === "deletion" || lastLineType === "context")) {
          const lastIndex = currentFile.deletionLines.length - 1;
          if (lastIndex >= 0) currentFile.deletionLines[lastIndex] = cleanLastNewline(currentFile.deletionLines[lastIndex]);
        }
      }
    }
    hunkData.additionLines = additionLines;
    hunkData.deletionLines = deletionLines;
    hunkData.collapsedBefore = Math.max(hunkData.additionStart - 1 - lastHunkEnd, 0);
    currentFile.hunks.push(hunkData);
    lastHunkEnd = hunkData.additionStart + hunkData.additionCount - 1;
    for (const content of hunkData.hunkContent) if (content.type === "context") {
      hunkData.splitLineCount += content.lines;
      hunkData.unifiedLineCount += content.lines;
    } else {
      hunkData.splitLineCount += Math.max(content.additions, content.deletions);
      hunkData.unifiedLineCount += content.deletions + content.additions;
    }
    hunkData.splitLineStart = currentFile.splitLineCount + hunkData.collapsedBefore;
    hunkData.unifiedLineStart = currentFile.unifiedLineCount + hunkData.collapsedBefore;
    currentFile.splitLineCount += hunkData.collapsedBefore + hunkData.splitLineCount;
    currentFile.unifiedLineCount += hunkData.collapsedBefore + hunkData.unifiedLineCount;
  }
  if (currentFile == null) return;
  if (currentFile.hunks.length > 0 && !isPartial && currentFile.additionLines.length > 0 && currentFile.deletionLines.length > 0) {
    const lastHunk = currentFile.hunks[currentFile.hunks.length - 1];
    const lastHunkEnd$1 = lastHunk.additionStart + lastHunk.additionCount - 1;
    const totalFileLines = currentFile.additionLines.length;
    const collapsedAfter = Math.max(totalFileLines - lastHunkEnd$1, 0);
    currentFile.splitLineCount += collapsedAfter;
    currentFile.unifiedLineCount += collapsedAfter;
  }
  if (!isGitDiff) {
    if (currentFile.prevName != null && currentFile.name !== currentFile.prevName) if (currentFile.hunks.length > 0) currentFile.type = "rename-changed";
    else currentFile.type = "rename-pure";
    else if (newFile != null && newFile.contents === "") currentFile.type = "deleted";
    else if (oldFile != null && oldFile.contents === "") currentFile.type = "new";
  }
  if (currentFile.type !== "rename-pure" && currentFile.type !== "rename-changed") currentFile.prevName = void 0;
  return currentFile;
}
function parsePatchFiles(data, cacheKeyPrefix, throwOnError = false) {
  const patches = [];
  for (const patch of data.split(COMMIT_METADATA_SPLIT)) try {
    patches.push(processPatch(patch, cacheKeyPrefix != null ? `${cacheKeyPrefix}-${patches.length}` : void 0, throwOnError));
  } catch (error) {
    if (throwOnError) throw error;
    else console.error(error);
  }
  return patches;
}
function createContentGroup(type, deletionLineIndex, additionLineIndex) {
  if (type === "change") return {
    type: "change",
    additions: 0,
    deletions: 0,
    additionLineIndex,
    deletionLineIndex
  };
  return {
    type: "context",
    lines: 0,
    additionLineIndex,
    deletionLineIndex
  };
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/parseDiffFromFile.js
function parseDiffFromFile(oldFile, newFile, options, throwOnError = false) {
  const fileData = processFile(createTwoFilesPatch(oldFile.name, newFile.name, oldFile.contents, newFile.contents, oldFile.header, newFile.header, options), {
    cacheKey: (() => {
      if (oldFile.cacheKey != null && newFile.cacheKey != null) return `${oldFile.cacheKey}:${newFile.cacheKey}`;
    })(),
    oldFile,
    newFile,
    throwOnError
  });
  if (fileData == null) throw new Error("parseDiffFrom: FileInvalid diff -- probably need to fix something -- if the files are the same maybe?");
  if (newFile.lang != null) fileData.lang = newFile.lang;
  return fileData;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/components/FileDiff.js
var instanceId5 = -1;
var FileDiff = class {
  static LoadedCustomComponent = DiffsContainerLoaded;
  __id = `file-diff:${++instanceId5}`;
  fileContainer;
  spriteSVG;
  pre;
  codeUnified;
  codeDeletions;
  codeAdditions;
  bufferBefore;
  bufferAfter;
  themeCSSStyle;
  appliedThemeCSS;
  unsafeCSSStyle;
  appliedUnsafeCSS;
  gutterUtilityContent;
  headerElement;
  headerPrefix;
  headerMetadata;
  headerCustom;
  separatorCache = /* @__PURE__ */ new Map();
  errorWrapper;
  placeHolder;
  hunksRenderer;
  resizeManager;
  scrollSyncManager;
  interactionManager;
  annotationCache = /* @__PURE__ */ new Map();
  lineAnnotations = [];
  deletionFile;
  additionFile;
  fileDiff;
  renderRange;
  appliedPreAttributes;
  lastRenderedHeaderHTML;
  lastRowCount;
  enabled = true;
  constructor(options = { theme: DEFAULT_THEMES }, workerManager, isContainerManaged = false) {
    this.options = options;
    this.workerManager = workerManager;
    this.isContainerManaged = isContainerManaged;
    this.hunksRenderer = this.createHunksRenderer(options);
    this.resizeManager = new ResizeManager();
    this.scrollSyncManager = new ScrollSyncManager();
    this.interactionManager = new InteractionManager("diff", pluckInteractionOptions(options, typeof options.hunkSeparators === "function" || (options.hunkSeparators ?? "line-info") === "line-info" || options.hunkSeparators === "line-info-basic" ? this.handleExpandHunk : void 0, this.getLineIndex));
    this.workerManager?.subscribeToThemeChanges(this);
    this.enabled = true;
  }
  handleHighlightRender = () => {
    this.rerender();
  };
  getHunksRendererOptions(options) {
    return {
      ...options,
      headerRenderMode: options.renderCustomHeader != null ? "custom" : "default",
      hunkSeparators: typeof options.hunkSeparators === "function" ? "custom" : options.hunkSeparators
    };
  }
  createHunksRenderer(options) {
    return new DiffHunksRenderer(this.getHunksRendererOptions(options), this.handleHighlightRender, this.workerManager);
  }
  getLineIndex = (lineNumber, side = "additions") => {
    if (this.fileDiff == null) return;
    const lastHunk = this.fileDiff.hunks.at(-1);
    let targetUnifiedIndex;
    let targetSplitIndex;
    hunkIterator: for (const hunk of this.fileDiff.hunks) {
      let currentLineNumber = side === "deletions" ? hunk.deletionStart : hunk.additionStart;
      const hunkCount = side === "deletions" ? hunk.deletionCount : hunk.additionCount;
      let splitIndex = hunk.splitLineStart;
      let unifiedIndex = hunk.unifiedLineStart;
      if (lineNumber < currentLineNumber) {
        const difference = currentLineNumber - lineNumber;
        targetUnifiedIndex = Math.max(unifiedIndex - difference, 0);
        targetSplitIndex = Math.max(splitIndex - difference, 0);
        break hunkIterator;
      }
      if (lineNumber >= currentLineNumber + hunkCount) {
        if (hunk === lastHunk) {
          const difference = lineNumber - (currentLineNumber + hunkCount);
          targetUnifiedIndex = unifiedIndex + hunk.unifiedLineCount + difference;
          targetSplitIndex = splitIndex + hunk.splitLineCount + difference;
          break hunkIterator;
        }
        continue;
      }
      for (const content of hunk.hunkContent) if (content.type === "context") if (lineNumber < currentLineNumber + content.lines) {
        const difference = lineNumber - currentLineNumber;
        targetSplitIndex = splitIndex + difference;
        targetUnifiedIndex = unifiedIndex + difference;
        break hunkIterator;
      } else {
        currentLineNumber += content.lines;
        splitIndex += content.lines;
        unifiedIndex += content.lines;
      }
      else {
        const sideCount = side === "deletions" ? content.deletions : content.additions;
        if (lineNumber < currentLineNumber + sideCount) {
          const indexDifference = lineNumber - currentLineNumber;
          targetUnifiedIndex = unifiedIndex + (side === "additions" ? content.deletions : 0) + indexDifference;
          targetSplitIndex = splitIndex + indexDifference;
          break hunkIterator;
        } else {
          currentLineNumber += sideCount;
          splitIndex += Math.max(content.deletions, content.additions);
          unifiedIndex += content.deletions + content.additions;
        }
      }
      break hunkIterator;
    }
    if (targetUnifiedIndex == null || targetSplitIndex == null) return;
    return [targetUnifiedIndex, targetSplitIndex];
  };
  setOptions(options) {
    if (options == null) return;
    this.options = options;
    this.hunksRenderer.setOptions(this.getHunksRendererOptions(options));
    this.interactionManager.setOptions(pluckInteractionOptions(options, typeof options.hunkSeparators === "function" || (options.hunkSeparators ?? "line-info") === "line-info" || options.hunkSeparators === "line-info-basic" ? this.handleExpandHunk : void 0, this.getLineIndex));
  }
  mergeOptions(options) {
    this.options = {
      ...this.options,
      ...options
    };
  }
  setThemeType(themeType) {
    if ((this.options.themeType ?? "system") === themeType) return;
    this.mergeOptions({ themeType });
    if (typeof this.options.theme === "string" || this.fileContainer == null || this.appliedThemeCSS == null) return;
    this.applyThemeState(this.fileContainer, this.appliedThemeCSS.themeStyles, themeType, this.appliedThemeCSS.baseThemeType);
  }
  getHoveredLine = () => {
    return this.interactionManager.getHoveredLine();
  };
  setLineAnnotations(lineAnnotations) {
    this.lineAnnotations = lineAnnotations;
  }
  canPartiallyRender(forceRender, annotationsChanged, didContentChange) {
    if (forceRender || annotationsChanged || didContentChange || typeof this.options.hunkSeparators === "function") return false;
    return true;
  }
  setSelectedLines(range2) {
    this.interactionManager.setSelection(range2);
  }
  cleanUp(recycle = false) {
    this.resizeManager.cleanUp();
    this.interactionManager.cleanUp();
    this.scrollSyncManager.cleanUp();
    this.workerManager?.unsubscribeToThemeChanges(this);
    this.renderRange = void 0;
    if (!this.isContainerManaged) this.fileContainer?.remove();
    if (this.fileContainer?.shadowRoot != null) this.fileContainer.shadowRoot.innerHTML = "";
    this.fileContainer = void 0;
    if (this.pre != null) {
      this.pre.innerHTML = "";
      this.pre = void 0;
    }
    this.codeUnified = void 0;
    this.codeDeletions = void 0;
    this.codeAdditions = void 0;
    this.bufferBefore = void 0;
    this.bufferAfter = void 0;
    this.appliedPreAttributes = void 0;
    this.headerElement = void 0;
    this.headerPrefix = void 0;
    this.headerMetadata = void 0;
    this.headerCustom = void 0;
    this.lastRenderedHeaderHTML = void 0;
    this.errorWrapper = void 0;
    this.spriteSVG = void 0;
    this.lastRowCount = void 0;
    this.themeCSSStyle = void 0;
    this.appliedThemeCSS = void 0;
    this.unsafeCSSStyle = void 0;
    this.appliedUnsafeCSS = void 0;
    if (recycle) this.hunksRenderer.recycle();
    else {
      this.hunksRenderer.cleanUp();
      this.workerManager = void 0;
      this.fileDiff = void 0;
      this.deletionFile = void 0;
      this.additionFile = void 0;
    }
    this.enabled = false;
  }
  virtualizedSetup() {
    this.enabled = true;
    this.workerManager?.subscribeToThemeChanges(this);
  }
  hydrate(props) {
    const { fileContainer, prerenderedHTML, preventEmit = false, lineAnnotations, oldFile, newFile, fileDiff } = props;
    this.hydrateElements(fileContainer, prerenderedHTML);
    if (shouldRenderCode2(this.pre, hasDiffContent({
      fileDiff,
      oldFile,
      newFile
    }), this.options.collapsed) || shouldRenderHeader2(this.headerElement, hasDiffHeaderContent({
      fileDiff,
      oldFile,
      newFile
    }), this.options.disableFileHeader)) this.render({
      ...props,
      preventEmit: true
    });
    else this.hydrationSetup({
      fileDiff,
      oldFile,
      newFile,
      lineAnnotations
    });
    if (!preventEmit) this.emitPostRender();
  }
  hydrateElements(fileContainer, prerenderedHTML) {
    prerenderHTMLIfNecessary(fileContainer, prerenderedHTML);
    for (const element2 of fileContainer.shadowRoot?.children ?? []) {
      if (element2 instanceof SVGElement) {
        this.spriteSVG = element2;
        continue;
      }
      if (!(element2 instanceof HTMLElement)) continue;
      if (element2 instanceof HTMLPreElement) {
        this.pre = element2;
        for (const code of element2.children) {
          if (!(code instanceof HTMLElement) || code.tagName.toLowerCase() !== "code") continue;
          if ("deletions" in code.dataset) this.codeDeletions = code;
          if ("additions" in code.dataset) this.codeAdditions = code;
          if ("unified" in code.dataset) this.codeUnified = code;
        }
        continue;
      }
      if ("diffsHeader" in element2.dataset) {
        this.headerElement = element2;
        continue;
      }
      if (element2 instanceof HTMLStyleElement && element2.hasAttribute(THEME_CSS_ATTRIBUTE)) {
        this.themeCSSStyle = element2;
        continue;
      }
      if (element2 instanceof HTMLStyleElement && element2.hasAttribute(UNSAFE_CSS_ATTRIBUTE)) {
        this.unsafeCSSStyle = element2;
        this.appliedUnsafeCSS = element2.textContent;
        continue;
      }
    }
    if (this.pre != null) {
      this.syncCodeNodesFromPre(this.pre);
      this.pre.removeAttribute("data-dehydrated");
    }
    this.fileContainer = fileContainer;
  }
  hydrationSetup({ fileDiff, oldFile, newFile, lineAnnotations }) {
    const { diffStyle = "split", overflow = "scroll" } = this.options;
    this.lineAnnotations = lineAnnotations ?? this.lineAnnotations;
    this.additionFile = newFile;
    this.deletionFile = oldFile;
    this.fileDiff = fileDiff ?? (oldFile != null && newFile != null ? parseDiffFromFile(oldFile, newFile, this.options.parseDiffOptions) : void 0);
    if (this.pre == null) return;
    this.hunksRenderer.hydrate(this.fileDiff);
    this.renderAnnotations();
    this.renderGutterUtility();
    this.injectUnsafeCSS();
    this.interactionManager.setup(this.pre);
    this.resizeManager.setup(this.pre, overflow === "wrap");
    if (overflow === "scroll" && diffStyle === "split") this.scrollSyncManager.setup(this.pre, this.codeDeletions, this.codeAdditions);
  }
  rerender() {
    if (!this.enabled || this.fileDiff == null && this.additionFile == null && this.deletionFile == null) return;
    this.render({
      forceRender: true,
      renderRange: this.renderRange
    });
  }
  handleExpandHunk = (hunkIndex, direction, expansionLineCountOverride) => {
    this.expandHunk(hunkIndex, direction, expansionLineCountOverride);
  };
  expandHunk = (hunkIndex, direction, expansionLineCountOverride) => {
    this.hunksRenderer.expandHunk(hunkIndex, direction, expansionLineCountOverride);
    this.rerender();
  };
  render({ oldFile, newFile, fileDiff, forceRender = false, preventEmit = false, lineAnnotations, fileContainer, containerWrapper, renderRange }) {
    if (!this.enabled) throw new Error("FileDiff.render: attempting to call render after cleaned up");
    const { collapsed = false } = this.options;
    const nextRenderRange = collapsed ? void 0 : renderRange;
    const filesDidChange = oldFile != null && newFile != null && (!areFilesEqual(oldFile, this.deletionFile) || !areFilesEqual(newFile, this.additionFile));
    let diffDidChange = fileDiff != null && fileDiff !== this.fileDiff;
    const annotationsChanged = lineAnnotations != null && (lineAnnotations.length > 0 || this.lineAnnotations.length > 0) ? lineAnnotations !== this.lineAnnotations : false;
    if (!collapsed && areRenderRangesEqual(nextRenderRange, this.renderRange) && !forceRender && !annotationsChanged && (fileDiff != null && fileDiff === this.fileDiff || fileDiff == null && !filesDidChange)) return false;
    const { renderRange: previousRenderRange } = this;
    this.renderRange = nextRenderRange;
    this.deletionFile = oldFile;
    this.additionFile = newFile;
    if (fileDiff != null) this.fileDiff = fileDiff;
    else if (oldFile != null && newFile != null && filesDidChange) {
      diffDidChange = true;
      this.fileDiff = parseDiffFromFile(oldFile, newFile, this.options.parseDiffOptions);
    }
    if (lineAnnotations != null) this.setLineAnnotations(lineAnnotations);
    if (this.fileDiff == null) return false;
    this.hunksRenderer.setOptions(this.getHunksRendererOptions(this.options));
    this.hunksRenderer.setLineAnnotations(this.lineAnnotations);
    const { diffStyle = "split", disableErrorHandling = false, disableFileHeader = false, overflow = "scroll", themeType = "system" } = this.options;
    if (disableFileHeader) {
      if (this.headerElement != null) {
        this.headerElement.remove();
        this.headerElement = void 0;
        this.lastRenderedHeaderHTML = void 0;
      }
      this.clearHeaderSlots();
    }
    fileContainer = this.getOrCreateFileContainer(fileContainer, containerWrapper);
    if (collapsed) {
      this.removeRenderedCode();
      this.clearAuxiliaryNodes();
      try {
        const hunksResult = this.hunksRenderer.renderDiff(this.fileDiff, EMPTY_RENDER_RANGE);
        if (hunksResult != null) this.applyThemeState(fileContainer, hunksResult.themeStyles, themeType, hunksResult.baseThemeType);
        if (hunksResult?.headerElement != null) this.applyHeaderToDOM(hunksResult.headerElement, fileContainer);
        this.renderSeparators([]);
        this.injectUnsafeCSS();
      } catch (error) {
        if (disableErrorHandling) throw error;
        console.error(error);
        if (error instanceof Error) this.applyErrorToDOM(error, fileContainer);
      }
      if (!preventEmit) this.emitPostRender();
      return true;
    }
    try {
      const pre = this.getOrCreatePreNode(fileContainer);
      if (!(this.canPartiallyRender(forceRender, annotationsChanged, filesDidChange || diffDidChange) && this.applyPartialRender({
        previousRenderRange,
        renderRange: nextRenderRange
      }))) {
        const hunksResult = this.hunksRenderer.renderDiff(this.fileDiff, nextRenderRange);
        if (hunksResult == null) {
          if (this.workerManager?.isInitialized() === false) this.workerManager.initialize().then(() => this.rerender());
          return false;
        }
        this.applyThemeState(fileContainer, hunksResult.themeStyles, themeType, hunksResult.baseThemeType);
        if (hunksResult.headerElement != null) this.applyHeaderToDOM(hunksResult.headerElement, fileContainer);
        if (hunksResult.additionsContentAST != null || hunksResult.deletionsContentAST != null || hunksResult.unifiedContentAST != null) this.applyHunksToDOM(pre, hunksResult);
        else if (this.pre != null) {
          this.pre.remove();
          this.pre = void 0;
        }
        this.renderSeparators(hunksResult.hunkData);
      }
      this.applyBuffers(pre, nextRenderRange);
      this.injectUnsafeCSS();
      this.renderAnnotations();
      this.renderGutterUtility();
      this.interactionManager.setup(pre);
      this.resizeManager.setup(pre, overflow === "wrap");
      if (overflow === "scroll" && diffStyle === "split") this.scrollSyncManager.setup(pre, this.codeDeletions, this.codeAdditions);
      else this.scrollSyncManager.cleanUp();
    } catch (error) {
      if (disableErrorHandling) throw error;
      console.error(error);
      if (error instanceof Error) this.applyErrorToDOM(error, fileContainer);
    }
    if (!preventEmit) this.emitPostRender();
    return true;
  }
  emitPostRender() {
    if (this.fileContainer != null) this.options.onPostRender?.(this.fileContainer, this);
  }
  removeRenderedCode() {
    this.resizeManager.cleanUp();
    this.scrollSyncManager.cleanUp();
    this.interactionManager.cleanUp();
    this.bufferBefore?.remove();
    this.bufferBefore = void 0;
    this.bufferAfter?.remove();
    this.bufferAfter = void 0;
    this.codeUnified?.remove();
    this.codeUnified = void 0;
    this.codeDeletions?.remove();
    this.codeDeletions = void 0;
    this.codeAdditions?.remove();
    this.codeAdditions = void 0;
    this.pre?.remove();
    this.pre = void 0;
    this.appliedPreAttributes = void 0;
    this.lastRowCount = void 0;
  }
  clearAuxiliaryNodes() {
    for (const { element: element2 } of this.separatorCache.values()) element2.remove();
    this.separatorCache.clear();
    for (const { element: element2 } of this.annotationCache.values()) element2.remove();
    this.annotationCache.clear();
    this.gutterUtilityContent?.remove();
    this.gutterUtilityContent = void 0;
  }
  renderPlaceholder(height) {
    if (this.fileContainer == null) return false;
    this.cleanChildNodes();
    if (this.placeHolder == null) {
      const shadowRoot = this.fileContainer.shadowRoot ?? this.fileContainer.attachShadow({ mode: "open" });
      this.placeHolder = document.createElement("div");
      this.placeHolder.dataset.placeholder = "";
      shadowRoot.appendChild(this.placeHolder);
    }
    this.placeHolder.style.setProperty("height", `${height}px`);
    return true;
  }
  cleanChildNodes() {
    this.resizeManager.cleanUp();
    this.scrollSyncManager.cleanUp();
    this.interactionManager.cleanUp();
    this.bufferAfter?.remove();
    this.bufferBefore?.remove();
    this.codeAdditions?.remove();
    this.codeDeletions?.remove();
    this.codeUnified?.remove();
    this.errorWrapper?.remove();
    this.headerElement?.remove();
    this.gutterUtilityContent?.remove();
    this.headerPrefix?.remove();
    this.headerMetadata?.remove();
    this.headerCustom?.remove();
    this.pre?.remove();
    this.spriteSVG?.remove();
    this.themeCSSStyle?.remove();
    this.unsafeCSSStyle?.remove();
    this.bufferAfter = void 0;
    this.bufferBefore = void 0;
    this.codeAdditions = void 0;
    this.codeDeletions = void 0;
    this.codeUnified = void 0;
    this.errorWrapper = void 0;
    this.headerElement = void 0;
    this.gutterUtilityContent = void 0;
    this.headerPrefix = void 0;
    this.headerMetadata = void 0;
    this.headerCustom = void 0;
    this.pre = void 0;
    this.spriteSVG = void 0;
    this.themeCSSStyle = void 0;
    this.appliedThemeCSS = void 0;
    this.unsafeCSSStyle = void 0;
    this.appliedUnsafeCSS = void 0;
    this.lastRenderedHeaderHTML = void 0;
    this.lastRowCount = void 0;
  }
  renderSeparators(hunkData) {
    const { hunkSeparators } = this.options;
    if (this.isContainerManaged || this.fileContainer == null || typeof hunkSeparators !== "function") {
      for (const { element: element2 } of this.separatorCache.values()) element2.remove();
      this.separatorCache.clear();
      return;
    }
    const staleSeparators = new Map(this.separatorCache);
    for (const hunk of hunkData) {
      const id = hunk.slotName;
      let cache = this.separatorCache.get(id);
      if (cache == null || !areHunkDataEqual(hunk, cache.hunkData)) {
        cache?.element.remove();
        const element2 = document.createElement("div");
        element2.style.display = "contents";
        element2.slot = hunk.slotName;
        const child = hunkSeparators(hunk, this);
        if (child != null) element2.appendChild(child);
        this.fileContainer.appendChild(element2);
        cache = {
          element: element2,
          hunkData: hunk
        };
        this.separatorCache.set(id, cache);
      }
      staleSeparators.delete(id);
    }
    for (const [id, { element: element2 }] of staleSeparators.entries()) {
      this.separatorCache.delete(id);
      element2.remove();
    }
  }
  renderAnnotations() {
    if (this.isContainerManaged || this.fileContainer == null) {
      for (const { element: element2 } of this.annotationCache.values()) element2.remove();
      this.annotationCache.clear();
      return;
    }
    const staleAnnotations = new Map(this.annotationCache);
    const { renderAnnotation } = this.options;
    if (renderAnnotation != null && this.lineAnnotations.length > 0) for (const [index, annotation] of this.lineAnnotations.entries()) {
      const id = `${index}-${getLineAnnotationName(annotation)}`;
      let cache = this.annotationCache.get(id);
      if (cache == null || !areDiffLineAnnotationsEqual(annotation, cache.annotation)) {
        cache?.element.remove();
        const content = renderAnnotation(annotation);
        if (content == null) continue;
        cache = {
          element: createAnnotationWrapperNode(getLineAnnotationName(annotation)),
          annotation
        };
        cache.element.appendChild(content);
        this.fileContainer.appendChild(cache.element);
        this.annotationCache.set(id, cache);
      }
      staleAnnotations.delete(id);
    }
    for (const [id, { element: element2 }] of staleAnnotations.entries()) {
      this.annotationCache.delete(id);
      element2.remove();
    }
  }
  renderGutterUtility() {
    const renderGutterUtility = this.options.renderGutterUtility ?? this.options.renderHoverUtility;
    if (this.fileContainer == null || renderGutterUtility == null) {
      this.gutterUtilityContent?.remove();
      this.gutterUtilityContent = void 0;
      return;
    }
    const element2 = renderGutterUtility(this.interactionManager.getHoveredLine);
    if (element2 != null && this.gutterUtilityContent != null) return;
    else if (element2 == null) {
      this.gutterUtilityContent?.remove();
      this.gutterUtilityContent = void 0;
      return;
    }
    const gutterUtilityContent = createGutterUtilityContentNode();
    gutterUtilityContent.appendChild(element2);
    this.fileContainer.appendChild(gutterUtilityContent);
    this.gutterUtilityContent = gutterUtilityContent;
  }
  getOrCreateFileContainer(fileContainer, parentNode) {
    const previousContainer = this.fileContainer;
    this.fileContainer = fileContainer ?? this.fileContainer ?? document.createElement(DIFFS_TAG_NAME);
    if (previousContainer != null && previousContainer !== this.fileContainer) {
      this.lastRenderedHeaderHTML = void 0;
      this.headerElement = void 0;
    }
    if (parentNode != null && this.fileContainer.parentNode !== parentNode) parentNode.appendChild(this.fileContainer);
    if (this.spriteSVG == null) {
      const fragment = document.createElement("div");
      fragment.innerHTML = SVGSpriteSheet;
      const firstChild = fragment.firstChild;
      if (firstChild instanceof SVGElement) {
        this.spriteSVG = firstChild;
        this.fileContainer.shadowRoot?.appendChild(this.spriteSVG);
      }
    }
    return this.fileContainer;
  }
  getFileContainer() {
    return this.fileContainer;
  }
  getOrCreatePreNode(container) {
    const shadowRoot = container.shadowRoot ?? container.attachShadow({ mode: "open" });
    if (this.pre == null) {
      this.pre = document.createElement("pre");
      this.appliedPreAttributes = void 0;
      this.codeUnified = void 0;
      this.codeDeletions = void 0;
      this.codeAdditions = void 0;
      shadowRoot.appendChild(this.pre);
    } else if (this.pre.parentNode !== shadowRoot) {
      shadowRoot.appendChild(this.pre);
      this.appliedPreAttributes = void 0;
    }
    this.placeHolder?.remove();
    this.placeHolder = void 0;
    return this.pre;
  }
  syncCodeNodesFromPre(pre) {
    this.codeUnified = void 0;
    this.codeDeletions = void 0;
    this.codeAdditions = void 0;
    for (const child of Array.from(pre.children)) {
      if (!(child instanceof HTMLElement)) continue;
      if (child.hasAttribute("data-unified")) this.codeUnified = child;
      else if (child.hasAttribute("data-deletions")) this.codeDeletions = child;
      else if (child.hasAttribute("data-additions")) this.codeAdditions = child;
    }
  }
  applyHeaderToDOM(headerAST, container) {
    this.cleanupErrorWrapper();
    this.placeHolder?.remove();
    this.placeHolder = void 0;
    const { fileDiff } = this;
    const headerHTML = toHtml(headerAST);
    if (headerHTML !== this.lastRenderedHeaderHTML) {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = headerHTML;
      const newHeader = tempDiv.firstElementChild;
      if (!(newHeader instanceof HTMLElement)) return;
      if (this.headerElement != null) container.shadowRoot?.replaceChild(newHeader, this.headerElement);
      else container.shadowRoot?.prepend(newHeader);
      this.headerElement = newHeader;
      this.lastRenderedHeaderHTML = headerHTML;
    }
    if (this.isContainerManaged || fileDiff == null) return;
    const { renderCustomHeader, renderHeaderPrefix, renderHeaderMetadata } = this.options;
    if (renderCustomHeader != null) {
      const content$1 = renderCustomHeader(fileDiff) ?? void 0;
      this.headerCustom = this.upsertHeaderSlotElement(container, this.headerCustom, CUSTOM_HEADER_SLOT_ID, content$1);
      this.headerPrefix?.remove();
      this.headerMetadata?.remove();
      this.headerPrefix = void 0;
      this.headerMetadata = void 0;
      return;
    }
    const prefix = renderHeaderPrefix?.(fileDiff) ?? void 0;
    const content = renderHeaderMetadata?.(fileDiff) ?? void 0;
    this.headerPrefix = this.upsertHeaderSlotElement(container, this.headerPrefix, HEADER_PREFIX_SLOT_ID, prefix);
    this.headerMetadata = this.upsertHeaderSlotElement(container, this.headerMetadata, HEADER_METADATA_SLOT_ID, content);
    this.headerCustom?.remove();
    this.headerCustom = void 0;
  }
  clearHeaderSlots() {
    this.headerPrefix?.remove();
    this.headerMetadata?.remove();
    this.headerCustom?.remove();
    this.headerPrefix = void 0;
    this.headerMetadata = void 0;
    this.headerCustom = void 0;
  }
  upsertHeaderSlotElement(container, current, slot, content) {
    if (content == null) {
      current?.remove();
      return;
    }
    const element2 = current ?? this.createHeaderSlotElement(slot);
    if (current == null) container.appendChild(element2);
    this.replaceHeaderSlotContent(element2, content);
    return element2;
  }
  replaceHeaderSlotContent(element2, content) {
    element2.replaceChildren();
    if (content instanceof Element) element2.appendChild(content);
    else element2.innerText = `${content}`;
  }
  createHeaderSlotElement(slot) {
    const element2 = document.createElement("div");
    element2.slot = slot;
    return element2;
  }
  injectUnsafeCSS() {
    const { unsafeCSS } = this.options;
    const shadowRoot = this.fileContainer?.shadowRoot;
    if (shadowRoot == null) return;
    if (unsafeCSS == null || unsafeCSS === "") {
      if (this.unsafeCSSStyle != null) {
        this.unsafeCSSStyle.remove();
        this.unsafeCSSStyle = void 0;
      }
      this.appliedUnsafeCSS = void 0;
      return;
    }
    if (this.unsafeCSSStyle?.parentNode === shadowRoot && this.appliedUnsafeCSS === unsafeCSS) return;
    this.unsafeCSSStyle ??= createUnsafeCSSStyleNode();
    if (this.unsafeCSSStyle.parentNode !== shadowRoot) shadowRoot.appendChild(this.unsafeCSSStyle);
    this.unsafeCSSStyle.textContent = wrapUnsafeCSS(unsafeCSS);
    this.appliedUnsafeCSS = unsafeCSS;
  }
  applyThemeState(container, themeStyles, themeType, baseThemeType) {
    const shadowRoot = container.shadowRoot ?? container.attachShadow({ mode: "open" });
    const effectiveThemeType = baseThemeType ?? themeType;
    if (this.themeCSSStyle?.parentNode === shadowRoot && this.appliedThemeCSS?.themeStyles === themeStyles && this.appliedThemeCSS.themeType === effectiveThemeType) return;
    this.themeCSSStyle = upsertHostThemeStyle({
      shadowRoot,
      currentNode: this.themeCSSStyle,
      themeCSS: wrapThemeCSS(themeStyles, effectiveThemeType)
    });
    this.appliedThemeCSS = this.themeCSSStyle != null ? {
      themeStyles,
      themeType: effectiveThemeType,
      baseThemeType
    } : void 0;
  }
  applyHunksToDOM(pre, result) {
    const { overflow = "scroll" } = this.options;
    const containerSize = (this.options.hunkSeparators ?? "line-info") === "line-info";
    const rowSpan = overflow === "wrap" ? result.rowCount : void 0;
    this.cleanupErrorWrapper();
    this.applyPreNodeAttributes(pre, result);
    let shouldReplace = false;
    const codeElements = [];
    const unifiedAST = this.hunksRenderer.renderCodeAST("unified", result);
    const deletionsAST = this.hunksRenderer.renderCodeAST("deletions", result);
    const additionsAST = this.hunksRenderer.renderCodeAST("additions", result);
    if (unifiedAST != null) {
      shouldReplace = this.codeUnified == null || this.codeAdditions != null || this.codeDeletions != null;
      this.codeDeletions?.remove();
      this.codeDeletions = void 0;
      this.codeAdditions?.remove();
      this.codeAdditions = void 0;
      this.codeUnified = getOrCreateCodeNode({
        code: this.codeUnified,
        columnType: "unified",
        rowSpan,
        containerSize
      });
      this.codeUnified.innerHTML = this.hunksRenderer.renderPartialHTML(unifiedAST);
      codeElements.push(this.codeUnified);
    } else if (deletionsAST != null || additionsAST != null) {
      if (deletionsAST != null) {
        shouldReplace = this.codeDeletions == null || this.codeUnified != null;
        this.codeUnified?.remove();
        this.codeUnified = void 0;
        this.codeDeletions = getOrCreateCodeNode({
          code: this.codeDeletions,
          columnType: "deletions",
          rowSpan,
          containerSize
        });
        this.codeDeletions.innerHTML = this.hunksRenderer.renderPartialHTML(deletionsAST);
        codeElements.push(this.codeDeletions);
      } else {
        this.codeDeletions?.remove();
        this.codeDeletions = void 0;
      }
      if (additionsAST != null) {
        shouldReplace = shouldReplace || this.codeAdditions == null || this.codeUnified != null;
        this.codeUnified?.remove();
        this.codeUnified = void 0;
        this.codeAdditions = getOrCreateCodeNode({
          code: this.codeAdditions,
          columnType: "additions",
          rowSpan,
          containerSize
        });
        this.codeAdditions.innerHTML = this.hunksRenderer.renderPartialHTML(additionsAST);
        codeElements.push(this.codeAdditions);
      } else {
        this.codeAdditions?.remove();
        this.codeAdditions = void 0;
      }
    } else {
      this.codeUnified?.remove();
      this.codeUnified = void 0;
      this.codeDeletions?.remove();
      this.codeDeletions = void 0;
      this.codeAdditions?.remove();
      this.codeAdditions = void 0;
    }
    if (codeElements.length === 0) pre.textContent = "";
    else if (shouldReplace) pre.replaceChildren(...codeElements);
    this.lastRowCount = result.rowCount;
  }
  applyPartialRender({ previousRenderRange, renderRange }) {
    const { pre, codeUnified, codeAdditions, codeDeletions, options: { diffStyle = "split" } } = this;
    if (pre == null || previousRenderRange == null || renderRange == null || !Number.isFinite(previousRenderRange.totalLines) || !Number.isFinite(renderRange.totalLines) || this.lastRowCount == null) return false;
    const codeElements = this.getCodeColumns(diffStyle, codeUnified, codeDeletions, codeAdditions);
    if (codeElements == null) return false;
    const previousStart = previousRenderRange.startingLine;
    const nextStart = renderRange.startingLine;
    const previousEnd = previousStart + previousRenderRange.totalLines;
    const nextEnd = nextStart + renderRange.totalLines;
    const overlapStart = Math.max(previousStart, nextStart);
    const overlapEnd = Math.min(previousEnd, nextEnd);
    if (overlapEnd <= overlapStart) return false;
    const trimStart = Math.max(0, overlapStart - previousStart);
    const trimEnd = Math.max(0, previousEnd - overlapEnd);
    const trimResult = this.trimColumns({
      columns: codeElements,
      trimStart,
      trimEnd,
      previousStart,
      overlapStart,
      overlapEnd,
      diffStyle
    });
    if (trimResult < 0) throw new Error("applyPartialRender: failed to trim to overlap");
    if (this.lastRowCount < trimResult) throw new Error("applyPartialRender: trimmed beyond DOM row count");
    let rowCount = this.lastRowCount - trimResult;
    const renderChunk = (startingLine, totalLines) => {
      if (totalLines <= 0 || this.fileDiff == null) return;
      return this.hunksRenderer.renderDiff(this.fileDiff, {
        startingLine,
        totalLines,
        bufferBefore: 0,
        bufferAfter: 0
      });
    };
    const prependResult = renderChunk(nextStart, Math.max(overlapStart - nextStart, 0));
    if (prependResult == null && nextStart < overlapStart) return false;
    const appendResult = renderChunk(overlapEnd, Math.max(nextEnd - overlapEnd, 0));
    if (appendResult == null && nextEnd > overlapEnd) return false;
    const applyChunk = (result, insertPosition) => {
      if (result == null) return;
      if (diffStyle === "unified" && !Array.isArray(codeElements)) this.insertPartialHTML(diffStyle, codeElements, result, insertPosition);
      else if (diffStyle === "split" && Array.isArray(codeElements)) this.insertPartialHTML(diffStyle, codeElements, result, insertPosition);
      else throw new Error("FileDiff.applyPartialRender.applyChunk: invalid chunk application");
      rowCount += result.rowCount;
    };
    this.cleanupErrorWrapper();
    applyChunk(prependResult, "afterbegin");
    applyChunk(appendResult, "beforeend");
    if (this.lastRowCount !== rowCount) {
      this.applyRowSpan(diffStyle, codeElements, rowCount);
      this.lastRowCount = rowCount;
    }
    return true;
  }
  insertPartialHTML(diffStyle, columns, result, insertPosition) {
    if (diffStyle === "unified" && !Array.isArray(columns)) {
      const unifiedAST = this.hunksRenderer.renderCodeAST("unified", result);
      this.renderPartialColumn(columns, unifiedAST, insertPosition);
    } else if (diffStyle === "split" && Array.isArray(columns)) {
      const deletionsAST = this.hunksRenderer.renderCodeAST("deletions", result);
      const additionsAST = this.hunksRenderer.renderCodeAST("additions", result);
      this.renderPartialColumn(columns[0], deletionsAST, insertPosition);
      this.renderPartialColumn(columns[1], additionsAST, insertPosition);
    } else throw new Error("FileDiff.insertPartialHTML: Invalid argument composition");
  }
  renderPartialColumn(column, ast, insertPosition) {
    if (column == null || ast == null) return;
    const gutterChildren = getElementChildren(ast[0]);
    const contentChildren = getElementChildren(ast[1]);
    if (gutterChildren == null || contentChildren == null) throw new Error("FileDiff.insertPartialHTML: Unexpected AST structure");
    const firstHASTElement = contentChildren.at(0);
    if (insertPosition === "beforeend" && firstHASTElement?.type === "element" && typeof firstHASTElement.properties["data-buffer-size"] === "number") this.mergeBuffersIfNecessary(firstHASTElement.properties["data-buffer-size"], column.content.children[column.content.children.length - 1], column.gutter.children[column.gutter.children.length - 1], gutterChildren, contentChildren, true);
    const lastHASTElement = contentChildren.at(-1);
    if (insertPosition === "afterbegin" && lastHASTElement?.type === "element" && typeof lastHASTElement.properties["data-buffer-size"] === "number") this.mergeBuffersIfNecessary(lastHASTElement.properties["data-buffer-size"], column.content.children[0], column.gutter.children[0], gutterChildren, contentChildren, false);
    column.gutter.insertAdjacentHTML(insertPosition, this.hunksRenderer.renderPartialHTML(gutterChildren));
    column.content.insertAdjacentHTML(insertPosition, this.hunksRenderer.renderPartialHTML(contentChildren));
  }
  mergeBuffersIfNecessary(adjustmentSize, contentElement, gutterElement, gutterChildren, contentChildren, fromStart) {
    if (!(contentElement instanceof HTMLElement) || !(gutterElement instanceof HTMLElement)) return;
    const currentSize = this.getBufferSize(contentElement.dataset);
    if (currentSize == null) return;
    if (fromStart) {
      gutterChildren.shift();
      contentChildren.shift();
    } else {
      gutterChildren.pop();
      contentChildren.pop();
    }
    this.updateBufferSize(contentElement, currentSize + adjustmentSize);
    this.updateBufferSize(gutterElement, currentSize + adjustmentSize);
  }
  applyRowSpan(diffStyle, columns, rowCount) {
    const applySpan = (column) => {
      if (column == null) return;
      column.gutter.style.setProperty("grid-row", `span ${rowCount}`);
      column.content.style.setProperty("grid-row", `span ${rowCount}`);
    };
    if (diffStyle === "unified" && !Array.isArray(columns)) applySpan(columns);
    else if (diffStyle === "split" && Array.isArray(columns)) {
      applySpan(columns[0]);
      applySpan(columns[1]);
    } else throw new Error("dun fuuuuked up");
  }
  trimColumnRows(columns, preTrimCount, postTrimStart) {
    let visibleLineIndex = 0;
    let rowCount = 0;
    let rowIndex = 0;
    let pendingMetadataTrim = false;
    const hasPostTrim = postTrimStart >= 0;
    if (columns == null) return 0;
    const contentChildren = Array.from(columns.content.children);
    const gutterChildren = Array.from(columns.gutter.children);
    if (contentChildren.length !== gutterChildren.length) throw new Error("FileDiff.trimColumnRows: columns do not match");
    while (rowIndex < contentChildren.length) {
      if (preTrimCount <= 0 && !hasPostTrim && !pendingMetadataTrim) break;
      const gutterElement = gutterChildren[rowIndex];
      const contentElement = contentChildren[rowIndex];
      rowIndex++;
      if (!(gutterElement instanceof HTMLElement) || !(contentElement instanceof HTMLElement)) {
        console.error({
          gutterElement,
          contentElement
        });
        throw new Error("FileDiff.trimColumnRows: invalid row elements");
      }
      if (pendingMetadataTrim) {
        pendingMetadataTrim = false;
        if (gutterElement.dataset.gutterBuffer === "annotation" && "lineAnnotation" in contentElement.dataset || gutterElement.dataset.gutterBuffer === "metadata" && "noNewline" in contentElement.dataset) {
          gutterElement.remove();
          contentElement.remove();
          rowCount++;
          continue;
        }
      }
      if ("lineIndex" in gutterElement.dataset && "lineIndex" in contentElement.dataset) {
        if (preTrimCount > 0 || hasPostTrim && visibleLineIndex >= postTrimStart) {
          gutterElement.remove();
          contentElement.remove();
          if (preTrimCount > 0) {
            preTrimCount--;
            if (preTrimCount === 0) pendingMetadataTrim = true;
          }
          rowCount++;
        }
        visibleLineIndex++;
        continue;
      }
      if ("separator" in gutterElement.dataset && "separator" in contentElement.dataset) {
        if (preTrimCount > 0 || hasPostTrim && visibleLineIndex >= postTrimStart) {
          gutterElement.remove();
          contentElement.remove();
          rowCount++;
        }
        continue;
      }
      if (gutterElement.dataset.gutterBuffer === "annotation" && "lineAnnotation" in contentElement.dataset) {
        if (preTrimCount > 0 || hasPostTrim && visibleLineIndex >= postTrimStart) {
          gutterElement.remove();
          contentElement.remove();
          rowCount++;
        }
        continue;
      }
      if (gutterElement.dataset.gutterBuffer === "metadata" && "noNewline" in contentElement.dataset) {
        if (preTrimCount > 0 || hasPostTrim && visibleLineIndex >= postTrimStart) {
          gutterElement.remove();
          contentElement.remove();
          rowCount++;
        }
        continue;
      }
      if (gutterElement.dataset.gutterBuffer === "buffer" && "contentBuffer" in contentElement.dataset) {
        const totalRows = this.getBufferSize(contentElement.dataset);
        if (totalRows == null) throw new Error("FileDiff.trimColumnRows: invalid element");
        if (preTrimCount > 0) {
          const rowsToRemove = Math.min(preTrimCount, totalRows);
          const newSize = totalRows - rowsToRemove;
          if (newSize > 0) {
            this.updateBufferSize(gutterElement, newSize);
            this.updateBufferSize(contentElement, newSize);
            rowCount += rowsToRemove;
          } else {
            gutterElement.remove();
            contentElement.remove();
            rowCount += totalRows;
          }
          preTrimCount -= rowsToRemove;
        } else if (hasPostTrim) {
          const bufferStart = visibleLineIndex;
          const bufferEnd = visibleLineIndex + totalRows - 1;
          if (postTrimStart <= bufferStart) {
            gutterElement.remove();
            contentElement.remove();
            rowCount += totalRows;
          } else if (postTrimStart <= bufferEnd) {
            const rowsToRemove = bufferEnd - postTrimStart + 1;
            const newSize = totalRows - rowsToRemove;
            this.updateBufferSize(gutterElement, newSize);
            this.updateBufferSize(contentElement, newSize);
            rowCount += rowsToRemove;
          }
        }
        visibleLineIndex += totalRows;
        continue;
      }
      console.error({
        gutterElement,
        contentElement
      });
      throw new Error("FileDiff.trimColumnRows: unknown row elements");
    }
    return rowCount;
  }
  trimColumns({ columns, diffStyle, overlapEnd, overlapStart, previousStart, trimEnd, trimStart }) {
    const preTrimCount = Math.max(0, overlapStart - previousStart);
    const postTrimStart = overlapEnd - previousStart;
    if (postTrimStart < 0) throw new Error("FileDiff.trimColumns: overlap ends before previous");
    const shouldTrimStart = trimStart > 0;
    const shouldTrimEnd = trimEnd > 0;
    if (!shouldTrimStart && !shouldTrimEnd) return 0;
    const effectivePreTrimCount = shouldTrimStart ? preTrimCount : 0;
    const effectivePostTrimStart = shouldTrimEnd ? postTrimStart : -1;
    if (diffStyle === "unified" && !Array.isArray(columns)) return this.trimColumnRows(columns, effectivePreTrimCount, effectivePostTrimStart);
    else if (diffStyle === "split" && Array.isArray(columns)) {
      const deletionsTrim = this.trimColumnRows(columns[0], effectivePreTrimCount, effectivePostTrimStart);
      const additionsTrim = this.trimColumnRows(columns[1], effectivePreTrimCount, effectivePostTrimStart);
      if (columns[0] != null && columns[1] != null && deletionsTrim !== additionsTrim) throw new Error("FileDiff.trimColumns: split columns out of sync");
      return columns[0] != null ? deletionsTrim : additionsTrim;
    } else {
      console.error({
        diffStyle,
        columns
      });
      throw new Error("FileDiff.trimColumns: Invalid columns for diffType");
    }
  }
  getBufferSize(properties) {
    const parsed = Number.parseInt(properties?.bufferSize ?? "", 10);
    return Number.isNaN(parsed) ? void 0 : parsed;
  }
  updateBufferSize(element2, size) {
    element2.dataset.bufferSize = `${size}`;
    element2.style.setProperty("grid-row", `span ${size}`);
    element2.style.setProperty("min-height", `calc(${size} * 1lh)`);
  }
  getCodeColumns(diffStyle, codeUnified, codeDeletions, codeAdditions) {
    function getColumns(code) {
      if (code == null) return;
      const gutter = code.children[0];
      const content = code.children[1];
      if (!(gutter instanceof HTMLElement) || !(content instanceof HTMLElement) || gutter.dataset.gutter == null || content.dataset.content == null) return;
      return {
        gutter,
        content
      };
    }
    if (diffStyle === "unified") return getColumns(codeUnified);
    else {
      const deletions = getColumns(codeDeletions);
      const additions = getColumns(codeAdditions);
      return deletions != null || additions != null ? [deletions, additions] : void 0;
    }
  }
  applyBuffers(pre, renderRange) {
    const { disableVirtualizationBuffers = false } = this.options;
    if (disableVirtualizationBuffers || renderRange == null) {
      if (this.bufferBefore != null) {
        this.bufferBefore.remove();
        this.bufferBefore = void 0;
      }
      if (this.bufferAfter != null) {
        this.bufferAfter.remove();
        this.bufferAfter = void 0;
      }
      return;
    }
    if (renderRange.bufferBefore > 0) {
      if (this.bufferBefore == null) {
        this.bufferBefore = document.createElement("div");
        this.bufferBefore.dataset.virtualizerBuffer = "before";
        pre.before(this.bufferBefore);
      }
      this.bufferBefore.style.setProperty("height", `${renderRange.bufferBefore}px`);
      this.bufferBefore.style.setProperty("contain", "strict");
    } else if (this.bufferBefore != null) {
      this.bufferBefore.remove();
      this.bufferBefore = void 0;
    }
    if (renderRange.bufferAfter > 0) {
      if (this.bufferAfter == null) {
        this.bufferAfter = document.createElement("div");
        this.bufferAfter.dataset.virtualizerBuffer = "after";
        pre.after(this.bufferAfter);
      }
      this.bufferAfter.style.setProperty("height", `${renderRange.bufferAfter}px`);
      this.bufferAfter.style.setProperty("contain", "strict");
    } else if (this.bufferAfter != null) {
      this.bufferAfter.remove();
      this.bufferAfter = void 0;
    }
  }
  applyPreNodeAttributes(pre, { additionsContentAST, deletionsContentAST, totalLines }, customProperties) {
    const { diffIndicators = "bars", disableBackground = false, disableLineNumbers = false, overflow = "scroll", diffStyle = "split" } = this.options;
    const preProperties = {
      type: "diff",
      diffIndicators,
      disableBackground,
      disableLineNumbers,
      overflow,
      split: diffStyle === "unified" ? false : additionsContentAST != null && deletionsContentAST != null,
      totalLines,
      customProperties
    };
    if (arePrePropertiesEqual(preProperties, this.appliedPreAttributes)) return;
    setPreNodeProperties(pre, preProperties);
    this.appliedPreAttributes = preProperties;
  }
  applyErrorToDOM(error, container) {
    this.cleanupErrorWrapper();
    const pre = this.getOrCreatePreNode(container);
    pre.innerHTML = "";
    pre.remove();
    this.pre = void 0;
    this.appliedPreAttributes = void 0;
    const shadowRoot = container.shadowRoot ?? container.attachShadow({ mode: "open" });
    this.errorWrapper ??= document.createElement("div");
    this.errorWrapper.dataset.errorWrapper = "";
    this.errorWrapper.innerHTML = "";
    shadowRoot.appendChild(this.errorWrapper);
    const errorMessage = document.createElement("div");
    errorMessage.dataset.errorMessage = "";
    errorMessage.innerText = error.message;
    this.errorWrapper.appendChild(errorMessage);
    const errorStack = document.createElement("pre");
    errorStack.dataset.errorStack = "";
    errorStack.innerText = error.stack ?? "No Error Stack";
    this.errorWrapper.appendChild(errorStack);
  }
  cleanupErrorWrapper() {
    this.errorWrapper?.remove();
    this.errorWrapper = void 0;
  }
};
function hasDiffContent({ fileDiff, oldFile, newFile }) {
  return fileDiff != null && fileDiff.hunks.length > 0 || oldFile != null || newFile != null;
}
function hasDiffHeaderContent({ fileDiff, oldFile, newFile }) {
  return fileDiff != null || oldFile != null || newFile != null;
}
function shouldRenderCode2(pre, hasContent, collapsed = false) {
  return !collapsed && pre == null && hasContent;
}
function shouldRenderHeader2(headerElement, hasContent, disableFileHeader = false) {
  return headerElement == null && hasContent && !disableFileHeader;
}
function getElementChildren(node) {
  if (node == null || node.type !== "element") return;
  return node.children ?? [];
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/resolveVirtualFileMetrics.js
function resolveVirtualFileMetrics(hunkSeparators, metricsOverride) {
  const metrics = {
    ...DEFAULT_VIRTUAL_FILE_METRICS,
    ...metricsOverride
  };
  metrics.hunkSeparatorHeight = getHunkSeparatorHeight(hunkSeparators, metricsOverride?.hunkSeparatorHeight);
  return metrics;
}
function getHunkSeparatorHeight(type, customHeight) {
  if (customHeight != null) return customHeight;
  switch (type) {
    case "simple":
      return 4;
    case "metadata":
    case "line-info":
    case "line-info-basic":
    case "custom":
      return 32;
  }
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/components/VirtualizedFileDiff.js
var instanceId6 = -1;
var VirtualizedFileDiff = class extends FileDiff {
  __id = `little-virtualized-file-diff:${++instanceId6}`;
  top;
  height = 0;
  metrics;
  heightCache = /* @__PURE__ */ new Map();
  isVisible = false;
  isSetup = false;
  virtualizer;
  constructor(options, virtualizer, metrics, workerManager, isContainerManaged = false) {
    super(options, workerManager, isContainerManaged);
    const { hunkSeparators = "line-info" } = this.options;
    this.virtualizer = virtualizer;
    this.metrics = resolveVirtualFileMetrics(typeof hunkSeparators === "function" ? "custom" : hunkSeparators, metrics);
  }
  getLineHeight(lineIndex, hasMetadataLine = false) {
    const cached = this.heightCache.get(lineIndex);
    if (cached != null) return cached;
    const multiplier = hasMetadataLine ? 2 : 1;
    return this.metrics.lineHeight * multiplier;
  }
  setOptions(options) {
    if (options == null) return;
    const previousDiffStyle = this.options.diffStyle;
    const previousOverflow = this.options.overflow;
    const previousCollapsed = this.options.collapsed;
    super.setOptions(options);
    if (previousDiffStyle !== this.options.diffStyle || previousOverflow !== this.options.overflow || previousCollapsed !== this.options.collapsed) {
      this.heightCache.clear();
      this.computeApproximateSize();
      this.renderRange = void 0;
    }
    this.virtualizer.instanceChanged(this);
  }
  reconcileHeights() {
    const { overflow = "scroll" } = this.options;
    if (this.fileContainer != null) this.top = this.virtualizer.getOffsetInScrollContainer(this.fileContainer);
    if (this.fileContainer == null || this.fileDiff == null) {
      this.height = 0;
      return;
    }
    if (overflow === "scroll" && this.lineAnnotations.length === 0 && !this.virtualizer.config.resizeDebugging) return;
    const diffStyle = this.getDiffStyle();
    let hasLineHeightChange = false;
    const codeGroups = diffStyle === "split" ? [this.codeDeletions, this.codeAdditions] : [this.codeUnified];
    for (const codeGroup of codeGroups) {
      if (codeGroup == null) continue;
      const content = codeGroup.children[1];
      if (!(content instanceof HTMLElement)) continue;
      for (const line of content.children) {
        if (!(line instanceof HTMLElement)) continue;
        const lineIndexAttr = line.dataset.lineIndex;
        if (lineIndexAttr == null) continue;
        const lineIndex = parseLineIndex(lineIndexAttr, diffStyle);
        let measuredHeight = line.getBoundingClientRect().height;
        let hasMetadata = false;
        if (line.nextElementSibling instanceof HTMLElement && ("lineAnnotation" in line.nextElementSibling.dataset || "noNewline" in line.nextElementSibling.dataset)) {
          if ("noNewline" in line.nextElementSibling.dataset) hasMetadata = true;
          measuredHeight += line.nextElementSibling.getBoundingClientRect().height;
        }
        const expectedHeight = this.getLineHeight(lineIndex, hasMetadata);
        if (measuredHeight === expectedHeight) continue;
        hasLineHeightChange = true;
        if (measuredHeight === this.metrics.lineHeight * (hasMetadata ? 2 : 1)) this.heightCache.delete(lineIndex);
        else this.heightCache.set(lineIndex, measuredHeight);
      }
    }
    if (hasLineHeightChange || this.virtualizer.config.resizeDebugging) this.computeApproximateSize();
  }
  onRender = (dirty) => {
    if (this.fileContainer == null) return false;
    if (dirty) this.top = this.virtualizer.getOffsetInScrollContainer(this.fileContainer);
    return this.render();
  };
  cleanUp() {
    if (this.fileContainer != null) this.virtualizer.disconnect(this.fileContainer);
    this.isSetup = false;
    super.cleanUp();
  }
  expandHunk = (hunkIndex, direction, expansionLineCountOverride) => {
    this.hunksRenderer.expandHunk(hunkIndex, direction, expansionLineCountOverride);
    this.computeApproximateSize();
    this.renderRange = void 0;
    this.virtualizer.instanceChanged(this);
  };
  setVisibility(visible) {
    if (this.fileContainer == null) return;
    this.renderRange = void 0;
    if (visible && !this.isVisible) {
      this.top = this.virtualizer.getOffsetInScrollContainer(this.fileContainer);
      this.isVisible = true;
    } else if (!visible && this.isVisible) {
      this.isVisible = false;
      this.rerender();
    }
  }
  computeApproximateSize() {
    const isFirstCompute = this.height === 0;
    this.height = 0;
    if (this.fileDiff == null) return;
    const { disableFileHeader = false, expandUnchanged = false, collapsed = false, collapsedContextThreshold = DEFAULT_COLLAPSED_CONTEXT_THRESHOLD, hunkSeparators = "line-info" } = this.options;
    const { diffHeaderHeight, fileGap, hunkSeparatorHeight } = this.metrics;
    const diffStyle = this.getDiffStyle();
    const separatorGap = hunkSeparators !== "simple" && hunkSeparators !== "metadata" && hunkSeparators !== "line-info-basic" ? fileGap : 0;
    if (!disableFileHeader) this.height += diffHeaderHeight;
    else if (hunkSeparators !== "simple" && hunkSeparators !== "metadata") this.height += fileGap;
    if (collapsed) return;
    iterateOverDiff({
      diff: this.fileDiff,
      diffStyle,
      expandedHunks: expandUnchanged ? true : this.hunksRenderer.getExpandedHunksMap(),
      collapsedContextThreshold,
      callback: ({ hunkIndex, collapsedBefore, collapsedAfter, deletionLine, additionLine }) => {
        const splitLineIndex = additionLine != null ? additionLine.splitLineIndex : deletionLine.splitLineIndex;
        const unifiedLineIndex = additionLine != null ? additionLine.unifiedLineIndex : deletionLine.unifiedLineIndex;
        const hasMetadata = (additionLine?.noEOFCR ?? false) || (deletionLine?.noEOFCR ?? false);
        if (collapsedBefore > 0) {
          if (hunkIndex > 0) this.height += separatorGap;
          this.height += hunkSeparatorHeight + separatorGap;
        }
        this.height += this.getLineHeight(diffStyle === "split" ? splitLineIndex : unifiedLineIndex, hasMetadata);
        if (collapsedAfter > 0 && hunkSeparators !== "simple") this.height += separatorGap + hunkSeparatorHeight;
      }
    });
    if (this.fileDiff.hunks.length > 0) this.height += fileGap;
    if (this.fileContainer != null && this.virtualizer.config.resizeDebugging && !isFirstCompute) {
      const rect = this.fileContainer.getBoundingClientRect();
      if (rect.height !== this.height) console.log("VirtualizedFileDiff.computeApproximateSize: computed height doesnt match", {
        name: this.fileDiff.name,
        elementHeight: rect.height,
        computedHeight: this.height
      });
      else console.log("VirtualizedFileDiff.computeApproximateSize: computed height IS CORRECT");
    }
  }
  render({ fileContainer, oldFile, newFile, fileDiff, ...props } = {}) {
    const { isSetup } = this;
    this.fileDiff ??= fileDiff ?? (oldFile != null && newFile != null ? parseDiffFromFile(oldFile, newFile, this.options.parseDiffOptions) : void 0);
    fileContainer = this.getOrCreateFileContainer(fileContainer);
    if (this.fileDiff == null) {
      console.error("VirtualizedFileDiff.render: attempting to virtually render when we dont have the correct data");
      return false;
    }
    if (!isSetup) {
      this.computeApproximateSize();
      this.virtualizer.connect(fileContainer, this);
      this.top ??= this.virtualizer.getOffsetInScrollContainer(fileContainer);
      this.isVisible = this.virtualizer.isInstanceVisible(this.top, this.height);
      this.isSetup = true;
    } else this.top ??= this.virtualizer.getOffsetInScrollContainer(fileContainer);
    if (!this.isVisible) return this.renderPlaceholder(this.height);
    const windowSpecs = this.virtualizer.getWindowSpecs();
    const renderRange = this.computeRenderRangeFromWindow(this.fileDiff, this.top, windowSpecs);
    return super.render({
      fileDiff: this.fileDiff,
      fileContainer,
      renderRange,
      oldFile,
      newFile,
      ...props
    });
  }
  getDiffStyle() {
    return this.options.diffStyle ?? "split";
  }
  getExpandedRegion(isPartial, hunkIndex, rangeSize) {
    if (rangeSize <= 0 || isPartial) return {
      fromStart: 0,
      fromEnd: 0,
      collapsedLines: Math.max(rangeSize, 0),
      renderAll: false
    };
    const { expandUnchanged = false, collapsedContextThreshold = DEFAULT_COLLAPSED_CONTEXT_THRESHOLD } = this.options;
    if (expandUnchanged || rangeSize <= collapsedContextThreshold) return {
      fromStart: rangeSize,
      fromEnd: 0,
      collapsedLines: 0,
      renderAll: true
    };
    const region = this.hunksRenderer.getExpandedHunk(hunkIndex);
    const fromStart = Math.min(Math.max(region.fromStart, 0), rangeSize);
    const fromEnd = Math.min(Math.max(region.fromEnd, 0), rangeSize);
    const expandedCount = fromStart + fromEnd;
    const renderAll = expandedCount >= rangeSize;
    return {
      fromStart,
      fromEnd,
      collapsedLines: Math.max(rangeSize - expandedCount, 0),
      renderAll
    };
  }
  getExpandedLineCount(fileDiff, diffStyle) {
    let count = 0;
    if (fileDiff.isPartial) {
      for (const hunk of fileDiff.hunks) count += diffStyle === "split" ? hunk.splitLineCount : hunk.unifiedLineCount;
      return count;
    }
    for (const [hunkIndex, hunk] of fileDiff.hunks.entries()) {
      const hunkCount = diffStyle === "split" ? hunk.splitLineCount : hunk.unifiedLineCount;
      count += hunkCount;
      const collapsedBefore = Math.max(hunk.collapsedBefore, 0);
      const { fromStart, fromEnd, renderAll } = this.getExpandedRegion(fileDiff.isPartial, hunkIndex, collapsedBefore);
      if (collapsedBefore > 0) count += renderAll ? collapsedBefore : fromStart + fromEnd;
    }
    const lastHunk = fileDiff.hunks.at(-1);
    if (lastHunk != null && hasFinalHunk(fileDiff)) {
      const additionRemaining = fileDiff.additionLines.length - (lastHunk.additionLineIndex + lastHunk.additionCount);
      const deletionRemaining = fileDiff.deletionLines.length - (lastHunk.deletionLineIndex + lastHunk.deletionCount);
      if (lastHunk != null && additionRemaining !== deletionRemaining) throw new Error(`VirtualizedFileDiff: trailing context mismatch (additions=${additionRemaining}, deletions=${deletionRemaining}) for ${fileDiff.name}`);
      const trailingRangeSize = Math.min(additionRemaining, deletionRemaining);
      if (lastHunk != null && trailingRangeSize > 0) {
        const { fromStart, renderAll } = this.getExpandedRegion(fileDiff.isPartial, fileDiff.hunks.length, trailingRangeSize);
        count += renderAll ? trailingRangeSize : fromStart;
      }
    }
    return count;
  }
  computeRenderRangeFromWindow(fileDiff, fileTop, { top, bottom }) {
    const { disableFileHeader = false, expandUnchanged = false, collapsedContextThreshold = DEFAULT_COLLAPSED_CONTEXT_THRESHOLD, hunkSeparators = "line-info" } = this.options;
    const { diffHeaderHeight, fileGap, hunkLineCount, hunkSeparatorHeight, lineHeight } = this.metrics;
    const diffStyle = this.getDiffStyle();
    const fileHeight = this.height;
    const lineCount = this.getExpandedLineCount(fileDiff, diffStyle);
    const headerRegion = disableFileHeader ? fileGap : diffHeaderHeight;
    if (fileTop < top - fileHeight || fileTop > bottom) return {
      startingLine: 0,
      totalLines: 0,
      bufferBefore: 0,
      bufferAfter: fileHeight - headerRegion - fileGap
    };
    if (lineCount <= hunkLineCount || fileDiff.hunks.length === 0) return {
      startingLine: 0,
      totalLines: hunkLineCount,
      bufferBefore: 0,
      bufferAfter: 0
    };
    const estimatedTargetLines = Math.ceil(Math.max(bottom - top, 0) / lineHeight);
    const totalLines = Math.ceil(estimatedTargetLines / hunkLineCount) * hunkLineCount + hunkLineCount;
    const totalHunks = totalLines / hunkLineCount;
    const overflowHunks = totalHunks;
    const hunkOffsets = [];
    const viewportCenter = (top + bottom) / 2;
    const separatorGap = hunkSeparators === "simple" || hunkSeparators === "metadata" || hunkSeparators === "line-info-basic" ? 0 : fileGap;
    let absoluteLineTop = fileTop + headerRegion;
    let currentLine = 0;
    let firstVisibleHunk;
    let centerHunk;
    let overflowCounter;
    iterateOverDiff({
      diff: fileDiff,
      diffStyle,
      expandedHunks: expandUnchanged ? true : this.hunksRenderer.getExpandedHunksMap(),
      collapsedContextThreshold,
      callback: ({ hunkIndex, collapsedBefore, collapsedAfter, deletionLine, additionLine }) => {
        const splitLineIndex = additionLine != null ? additionLine.splitLineIndex : deletionLine.splitLineIndex;
        const unifiedLineIndex = additionLine != null ? additionLine.unifiedLineIndex : deletionLine.unifiedLineIndex;
        const hasMetadata = (additionLine?.noEOFCR ?? false) || (deletionLine?.noEOFCR ?? false);
        let gapAdjustment = collapsedBefore > 0 ? hunkSeparatorHeight + separatorGap + (hunkIndex > 0 ? separatorGap : 0) : 0;
        if (hunkIndex === 0 && hunkSeparators === "simple") gapAdjustment = 0;
        absoluteLineTop += gapAdjustment;
        const isAtHunkBoundary = currentLine % hunkLineCount === 0;
        if (isAtHunkBoundary) {
          hunkOffsets.push(absoluteLineTop - (fileTop + headerRegion + gapAdjustment));
          if (overflowCounter != null) {
            if (overflowCounter <= 0) return true;
            overflowCounter--;
          }
        }
        const lineHeight$1 = this.getLineHeight(diffStyle === "split" ? splitLineIndex : unifiedLineIndex, hasMetadata);
        const currentHunk = Math.floor(currentLine / hunkLineCount);
        if (absoluteLineTop > top - lineHeight$1 && absoluteLineTop < bottom) firstVisibleHunk ??= currentHunk;
        if (centerHunk == null && absoluteLineTop + lineHeight$1 > viewportCenter) centerHunk = currentHunk;
        if (overflowCounter == null && absoluteLineTop >= bottom && isAtHunkBoundary) overflowCounter = overflowHunks;
        currentLine++;
        absoluteLineTop += lineHeight$1;
        if (collapsedAfter > 0 && hunkSeparators !== "simple") absoluteLineTop += hunkSeparatorHeight + separatorGap;
        return false;
      }
    });
    if (firstVisibleHunk == null) return {
      startingLine: 0,
      totalLines: 0,
      bufferBefore: 0,
      bufferAfter: fileHeight - headerRegion - fileGap
    };
    const collectedHunks = hunkOffsets.length;
    centerHunk ??= firstVisibleHunk;
    const idealStartHunk = Math.round(centerHunk - totalHunks / 2);
    const maxStartHunk = Math.max(0, collectedHunks - totalHunks);
    const startHunk = Math.max(0, Math.min(idealStartHunk, maxStartHunk));
    const startingLine = startHunk * hunkLineCount;
    const clampedTotalLines = idealStartHunk < 0 ? totalLines + idealStartHunk * hunkLineCount : totalLines;
    const bufferBefore = hunkOffsets[startHunk] ?? 0;
    const finalHunkIndex = startHunk + clampedTotalLines / hunkLineCount;
    return {
      startingLine,
      totalLines: clampedTotalLines,
      bufferBefore,
      bufferAfter: finalHunkIndex < hunkOffsets.length ? fileHeight - headerRegion - hunkOffsets[finalHunkIndex] - fileGap : fileHeight - (absoluteLineTop - fileTop) - fileGap
    };
  }
};
function hasFinalHunk(fileDiff) {
  const lastHunk = fileDiff.hunks.at(-1);
  if (lastHunk == null || fileDiff.isPartial || fileDiff.additionLines.length === 0 || fileDiff.deletionLines.length === 0) return false;
  return lastHunk.additionLineIndex + lastHunk.additionCount < fileDiff.additionLines.length || lastHunk.deletionLineIndex + lastHunk.deletionCount < fileDiff.deletionLines.length;
}
function parseLineIndex(lineIndexAttr, diffStyle) {
  const [unifiedIndex, splitIndex] = lineIndexAttr.split(",").map(Number);
  return diffStyle === "split" ? splitIndex : unifiedIndex;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/react/utils/useFileDiffInstance.js
init_neon_pilot_shared_react();
var useIsometricEffect2 = typeof window === "undefined" ? useEffect : useLayoutEffect;
function useFileDiffInstance({ fileDiff, options, lineAnnotations, selectedLines, prerenderedHTML, metrics, hasGutterRenderUtility, hasCustomHeader, disableWorkerPool }) {
  const simpleVirtualizer = useVirtualizer();
  const poolManager = useContext(WorkerPoolContext);
  const instanceRef = useRef(null);
  const ref = useStableCallback((fileContainer) => {
    if (fileContainer != null) {
      if (instanceRef.current != null) throw new Error("useFileDiffInstance: An instance should not already exist when a node is created");
      if (simpleVirtualizer != null) instanceRef.current = new VirtualizedFileDiff(mergeFileDiffOptions({
        hasCustomHeader,
        hasGutterRenderUtility,
        options
      }), simpleVirtualizer, metrics, !disableWorkerPool ? poolManager : void 0, true);
      else instanceRef.current = new FileDiff(mergeFileDiffOptions({
        hasCustomHeader,
        hasGutterRenderUtility,
        options
      }), !disableWorkerPool ? poolManager : void 0, true);
      instanceRef.current.hydrate({
        fileDiff,
        fileContainer,
        lineAnnotations,
        prerenderedHTML
      });
    } else {
      if (instanceRef.current == null) throw new Error("useFileDiffInstance: A FileDiff instance should exist when unmounting");
      instanceRef.current.cleanUp();
      instanceRef.current = null;
    }
  });
  useIsometricEffect2(() => {
    const { current: instance2 } = instanceRef;
    if (instance2 == null) return;
    const newOptions = mergeFileDiffOptions({
      hasCustomHeader,
      hasGutterRenderUtility,
      options
    });
    const forceRender = !areOptionsEqual(instance2.options, newOptions);
    instance2.setOptions(newOptions);
    instance2.render({
      forceRender,
      fileDiff,
      lineAnnotations
    });
    if (selectedLines !== void 0) instance2.setSelectedLines(selectedLines);
  });
  return {
    ref,
    getHoveredLine: useCallback(() => {
      return instanceRef.current?.getHoveredLine();
    }, [])
  };
}
function mergeFileDiffOptions({ options, hasCustomHeader, hasGutterRenderUtility }) {
  if (hasGutterRenderUtility || hasCustomHeader) return {
    ...options,
    renderCustomHeader: hasCustomHeader ? noopRender : void 0,
    renderGutterUtility: hasGutterRenderUtility ? noopRender : void 0
  };
  return options;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/react/FileDiff.js
function FileDiff2({ fileDiff, options, metrics, lineAnnotations, selectedLines, className, style, prerenderedHTML, renderAnnotation, renderCustomHeader, renderHeaderPrefix, renderHeaderMetadata, renderGutterUtility, renderHoverUtility, disableWorkerPool = false }) {
  const { ref, getHoveredLine } = useFileDiffInstance({
    fileDiff,
    options,
    metrics,
    lineAnnotations,
    selectedLines,
    prerenderedHTML,
    hasGutterRenderUtility: renderGutterUtility != null || renderHoverUtility != null,
    hasCustomHeader: renderCustomHeader != null,
    disableWorkerPool
  });
  return /* @__PURE__ */ jsx(DIFFS_TAG_NAME, {
    ref,
    className,
    style,
    children: templateRender(renderDiffChildren({
      fileDiff,
      renderCustomHeader,
      renderHeaderPrefix,
      renderHeaderMetadata,
      renderAnnotation,
      renderGutterUtility,
      lineAnnotations,
      renderHoverUtility,
      getHoveredLine
    }), prerenderedHTML)
  });
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/react/MultiFileDiff.js
init_neon_pilot_shared_react();
function MultiFileDiff({ oldFile, newFile, options, metrics, lineAnnotations, selectedLines, className, style, prerenderedHTML, renderAnnotation, renderCustomHeader, renderHeaderPrefix, renderHeaderMetadata, renderGutterUtility, renderHoverUtility, disableWorkerPool = false }) {
  const fileDiff = useMemo(() => {
    return parseDiffFromFile(oldFile, newFile, options?.parseDiffOptions);
  }, [
    oldFile,
    newFile,
    options?.parseDiffOptions
  ]);
  const { ref, getHoveredLine } = useFileDiffInstance({
    fileDiff,
    options,
    metrics,
    lineAnnotations,
    selectedLines,
    prerenderedHTML,
    hasGutterRenderUtility: renderGutterUtility != null || renderHoverUtility != null,
    hasCustomHeader: renderCustomHeader != null,
    disableWorkerPool
  });
  return /* @__PURE__ */ jsx(DIFFS_TAG_NAME, {
    ref,
    className,
    style,
    children: templateRender(renderDiffChildren({
      fileDiff,
      renderCustomHeader,
      renderHeaderPrefix,
      renderHeaderMetadata,
      renderAnnotation,
      lineAnnotations,
      renderGutterUtility,
      renderHoverUtility,
      getHoveredLine
    }), prerenderedHTML)
  });
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/getSingularPatch.js
function getSingularPatch(patch) {
  const parsedPatches = parsePatchFiles(patch);
  if (parsedPatches.length !== 1) {
    console.error(parsedPatches);
    throw new Error("PatchDiff: Provided patch must include only 1 patch, with 1 diff");
  }
  const { files } = parsedPatches[0];
  if (files.length !== 1) {
    console.error(files);
    throw new Error("FileDiff: Provided patch must contain exactly 1 file diff");
  }
  return files[0];
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/react/PatchDiff.js
init_neon_pilot_shared_react();
function PatchDiff({ patch, options, metrics, lineAnnotations, selectedLines, className, style, prerenderedHTML, renderAnnotation, renderCustomHeader, renderHeaderPrefix, renderHeaderMetadata, renderGutterUtility, renderHoverUtility, disableWorkerPool = false }) {
  const fileDiff = usePatch(patch);
  const { ref, getHoveredLine } = useFileDiffInstance({
    fileDiff,
    options,
    metrics,
    lineAnnotations,
    selectedLines,
    prerenderedHTML,
    hasGutterRenderUtility: renderGutterUtility != null || renderHoverUtility != null,
    hasCustomHeader: renderCustomHeader != null,
    disableWorkerPool
  });
  return /* @__PURE__ */ jsx(DIFFS_TAG_NAME, {
    ref,
    className,
    style,
    children: templateRender(renderDiffChildren({
      fileDiff,
      renderCustomHeader,
      renderHeaderPrefix,
      renderHeaderMetadata,
      renderAnnotation,
      lineAnnotations,
      renderGutterUtility,
      renderHoverUtility,
      getHoveredLine
    }), prerenderedHTML)
  });
}
function usePatch(patch) {
  return useMemo(() => getSingularPatch(patch), [patch]);
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/renderers/UnresolvedFileHunksRenderer.js
var UnresolvedFileHunksRenderer = class extends DiffHunksRenderer {
  pendingConflictActions = [];
  pendingMarkerRows = [];
  injectedRows = /* @__PURE__ */ new Map();
  options;
  constructor(options = { theme: DEFAULT_THEMES }, onRenderUpdate, workerManager) {
    super(void 0, onRenderUpdate, workerManager);
    this.options = options;
  }
  setConflictState(conflictActions, markerRows, diff) {
    this.pendingConflictActions = conflictActions;
    this.pendingMarkerRows = markerRows;
    this.syncInjectedRows(conflictActions, markerRows, diff);
  }
  syncInjectedRows(conflictActions, markerRows, diff) {
    this.injectedRows.clear();
    for (const action of conflictActions) {
      const anchor = action != null ? getMergeConflictActionAnchor(action, diff) : void 0;
      if (action == null || anchor == null) continue;
      const row = {
        type: "actions",
        hunkIndex: anchor.hunkIndex,
        lineIndex: anchor.lineIndex,
        conflictIndex: action.conflictIndex
      };
      this.addInjectedRow(row);
    }
    for (const row of markerRows) this.addInjectedRow(row);
  }
  addInjectedRow(row) {
    const key2 = `${row.hunkIndex}:${row.lineIndex}`;
    const rows = this.injectedRows.get(key2);
    if (rows == null) this.injectedRows.set(key2, [row]);
    else rows.push(row);
  }
  renderDiff(diff, renderRange = DEFAULT_RENDER_RANGE) {
    if (diff != null) this.syncInjectedRows(this.pendingConflictActions, this.pendingMarkerRows, diff);
    return super.renderDiff(diff, renderRange);
  }
  async asyncRender(diff, renderRange = DEFAULT_RENDER_RANGE) {
    this.syncInjectedRows(this.pendingConflictActions, this.pendingMarkerRows, diff);
    return super.asyncRender(diff, renderRange);
  }
  createPreElement(split, totalLines) {
    return super.createPreElement(split, totalLines, { "data-has-merge-conflict": "" });
  }
  getUnifiedLineDecoration({ type, lineType }) {
    const mergeConflictType = type === "change" ? lineType === "change-deletion" ? "current" : "incoming" : void 0;
    return {
      gutterLineType: type === "change" ? "context" : lineType,
      gutterProperties: getMergeConflictGutterProperties(mergeConflictType),
      contentProperties: getMergeConflictContentProperties(type, mergeConflictType)
    };
  }
  getSplitLineDecoration({ side, type }) {
    const mergeConflictType = type === "change" ? side === "deletions" ? "current" : "incoming" : void 0;
    return {
      gutterLineType: type === "change" ? "context" : type,
      gutterProperties: getMergeConflictGutterProperties(mergeConflictType),
      contentProperties: getMergeConflictContentProperties(type, mergeConflictType)
    };
  }
  getUnifiedInjectedRowsForLine = (ctx) => {
    const rows = this.injectedRows.get(`${ctx.hunkIndex}:${ctx.lineIndex}`);
    if (rows == null || rows.length === 0) return;
    const { mergeConflictActionsType } = this.getOptionsWithDefaults();
    const before = [];
    const after = [];
    for (const row of rows) {
      if (row.type === "actions") {
        before.push({
          content: createMergeConflictActionsRowElement({
            row,
            includeDefaultActions: mergeConflictActionsType === "default",
            includeSlot: true
          }),
          gutter: createMergeConflictGutterGap("action")
        });
        continue;
      }
      (row.type === "marker-end" ? after : before).push({
        content: createMergeConflictMarkerRowElement(row),
        gutter: createMergeConflictGutterGap("marker", row.type)
      });
    }
    return {
      before: before.length > 0 ? before : void 0,
      after: after.length > 0 ? after : void 0
    };
  };
  getOptionsWithDefaults() {
    const options = super.getOptionsWithDefaults();
    options.diffStyle = "unified";
    options.lineDiffType = "none";
    options.mergeConflictActionsType = this.options.mergeConflictActionsType ?? "default";
    return options;
  }
};
function getMergeConflictGutterProperties(mergeConflictType) {
  return mergeConflictType != null ? { "data-merge-conflict": mergeConflictType } : void 0;
}
function getMergeConflictContentProperties(type, mergeConflictType) {
  if (mergeConflictType == null) return;
  if (type === "change") {
    if (mergeConflictType === "current" || mergeConflictType === "incoming") return {
      "data-line-type": "context",
      "data-merge-conflict": mergeConflictType
    };
    return;
  }
  if (mergeConflictType === "marker-start" || mergeConflictType === "marker-base" || mergeConflictType === "marker-separator" || mergeConflictType === "marker-end") return { "data-merge-conflict": mergeConflictType };
}
function createMergeConflictGutterGap(type, markerType) {
  const gap = createGutterGap(void 0, "annotation", 1);
  gap.properties["data-gutter-buffer"] = type === "action" ? "merge-conflict-action" : `merge-conflict-${markerType ?? "marker"}`;
  return gap;
}
function createMergeConflictActionsRowElement({ row, includeDefaultActions, includeSlot }) {
  const contentChildren = includeDefaultActions ? createMergeConflictActionsContent(row.conflictIndex) : [];
  if (includeSlot) contentChildren.push(createHastElement({
    tagName: "slot",
    properties: {
      name: getMergeConflictActionSlotName({
        hunkIndex: row.hunkIndex,
        lineIndex: row.lineIndex,
        conflictIndex: row.conflictIndex
      }),
      "data-merge-conflict-action-slot": ""
    }
  }));
  return createHastElement({
    tagName: "div",
    properties: { "data-merge-conflict-actions": "" },
    children: [createHastElement({
      tagName: "div",
      properties: { "data-merge-conflict-actions-content": "" },
      children: contentChildren
    })]
  });
}
function createMergeConflictMarkerRowElement(row) {
  return createHastElement({
    tagName: "div",
    properties: {
      "data-merge-conflict": row.type,
      "data-merge-conflict-marker-row": ""
    },
    children: [createTextNodeElement(row.lineText.replace(/(?:\r\n|\n|\r)$/, ""))]
  });
}
function createMergeConflictActionsContent(conflictIndex) {
  return [
    createMergeConflictActionButton({
      resolution: "current",
      label: "Accept current change",
      conflictIndex
    }),
    createMergeConflictActionSeparator(),
    createMergeConflictActionButton({
      resolution: "incoming",
      label: "Accept incoming change",
      conflictIndex
    }),
    createMergeConflictActionSeparator(),
    createMergeConflictActionButton({
      resolution: "both",
      label: "Accept both",
      conflictIndex
    })
  ];
}
function createMergeConflictActionButton({ resolution, label, conflictIndex }) {
  return createHastElement({
    tagName: "button",
    properties: {
      type: "button",
      "data-merge-conflict-action": resolution,
      "data-merge-conflict-conflict-index": `${conflictIndex}`
    },
    children: [createTextNodeElement(label)]
  });
}
function createMergeConflictActionSeparator() {
  return createHastElement({
    tagName: "span",
    properties: { "data-merge-conflict-action-separator": "" },
    children: [createTextNodeElement("|")]
  });
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/areMergeConflictActionsEqual.js
function areMergeConflictActionsEqual(a2, b3) {
  return a2.hunkIndex === b3.hunkIndex && a2.startContentIndex === b3.startContentIndex && a2.endContentIndex === b3.endContentIndex && a2.currentContentIndex === b3.currentContentIndex && a2.baseContentIndex === b3.baseContentIndex && a2.incomingContentIndex === b3.incomingContentIndex && a2.endMarkerContentIndex === b3.endMarkerContentIndex && a2.conflictIndex === b3.conflictIndex && areConflictsEqual(a2.conflict, b3.conflict);
}
function areConflictsEqual(a2, b3) {
  return a2.conflictIndex === b3.conflictIndex && a2.startLineIndex === b3.startLineIndex && a2.startLineNumber === b3.startLineNumber && a2.separatorLineIndex === b3.separatorLineIndex && a2.separatorLineNumber === b3.separatorLineNumber && a2.endLineIndex === b3.endLineIndex && a2.endLineNumber === b3.endLineNumber && a2.baseMarkerLineIndex === b3.baseMarkerLineIndex && a2.baseMarkerLineNumber === b3.baseMarkerLineNumber;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/normalizeDiffResolution.js
function normalizeDiffResolution(options) {
  const type = (() => {
    return typeof options === "string" ? options : options.type;
  })();
  return type === "accept" || type === "incoming" ? "additions" : type === "reject" || type === "current" ? "deletions" : "both";
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/resolveRegion.js
function resolveRegion(diff, target) {
  const { resolution, hunkIndex, startContentIndex, endContentIndex, indexesToDelete = /* @__PURE__ */ new Set() } = target;
  const currentHunk = diff.hunks[hunkIndex];
  if (currentHunk == null) {
    console.error({
      diff,
      hunkIndex
    });
    throw new Error(`resolveRegion: Invalid hunk index: ${hunkIndex}`);
  }
  if (startContentIndex < 0 || endContentIndex >= currentHunk.hunkContent.length || startContentIndex > endContentIndex) throw new Error(`resolveRegion: Invalid content range, ${startContentIndex}, ${endContentIndex}`);
  const { hunks, additionLines, deletionLines } = diff;
  const resolvedDiff = {
    ...diff,
    hunks: [],
    deletionLines: [],
    additionLines: [],
    splitLineCount: 0,
    unifiedLineCount: 0,
    cacheKey: diff.cacheKey != null ? `${diff.cacheKey}:${resolution[0]}-${hunkIndex}:${startContentIndex}-${endContentIndex}` : void 0
  };
  const cursor = {
    nextAdditionLineIndex: 0,
    nextDeletionLineIndex: 0,
    nextAdditionStart: 1,
    nextDeletionStart: 1,
    splitLineCount: 0,
    unifiedLineCount: 0
  };
  const updatesEOFState = hunkIndex === hunks.length - 1 && endContentIndex === currentHunk.hunkContent.length - 1;
  const shouldProcessCollapsedContext = !diff.isPartial;
  for (const [index, hunk] of hunks.entries()) {
    processCollapsedContext(diff, resolvedDiff, cursor, hunk.deletionLineIndex - hunk.collapsedBefore, hunk.additionLineIndex - hunk.collapsedBefore, hunk.collapsedBefore, shouldProcessCollapsedContext);
    const newHunk = {
      ...hunk,
      hunkContent: [],
      additionStart: cursor.nextAdditionStart,
      deletionStart: cursor.nextDeletionStart,
      additionLineIndex: cursor.nextAdditionLineIndex,
      deletionLineIndex: cursor.nextDeletionLineIndex,
      additionCount: 0,
      deletionCount: 0,
      deletionLines: 0,
      additionLines: 0,
      splitLineStart: cursor.splitLineCount,
      unifiedLineStart: cursor.unifiedLineCount,
      splitLineCount: 0,
      unifiedLineCount: 0
    };
    for (const [contentIndex, content] of hunk.hunkContent.entries()) if (index !== hunkIndex || contentIndex < startContentIndex || contentIndex > endContentIndex) {
      pushContentLinesToDiff(content, resolvedDiff, deletionLines, additionLines);
      const newContent = {
        ...content,
        additionLineIndex: cursor.nextAdditionLineIndex,
        deletionLineIndex: cursor.nextDeletionLineIndex
      };
      newHunk.hunkContent.push(newContent);
      advanceCursor(newContent, cursor, newHunk);
    } else if (indexesToDelete.has(contentIndex)) newHunk.hunkContent.push({
      type: "context",
      lines: 0,
      deletionLineIndex: cursor.nextDeletionLineIndex,
      additionLineIndex: cursor.nextAdditionLineIndex
    });
    else if (content.type === "context") {
      pushContentLinesToDiff(content, resolvedDiff, deletionLines, additionLines);
      const newContent = {
        ...content,
        deletionLineIndex: cursor.nextDeletionLineIndex,
        additionLineIndex: cursor.nextAdditionLineIndex
      };
      newHunk.hunkContent.push(newContent);
      advanceCursor(newContent, cursor, newHunk);
    } else {
      pushResolveLinesToDiff(resolution, content, resolvedDiff, deletionLines, additionLines);
      const newContent = {
        type: "context",
        lines: resolution === "deletions" ? content.deletions : resolution === "additions" ? content.additions : content.deletions + content.additions,
        deletionLineIndex: cursor.nextDeletionLineIndex,
        additionLineIndex: cursor.nextAdditionLineIndex
      };
      newHunk.hunkContent.push(newContent);
      advanceCursor(newContent, cursor, newHunk);
    }
    if (index === hunkIndex && updatesEOFState) {
      const noEOFCR = resolution === "deletions" ? hunk.noEOFCRDeletions : hunk.noEOFCRAdditions;
      newHunk.noEOFCRAdditions = noEOFCR;
      newHunk.noEOFCRDeletions = noEOFCR;
    }
    resolvedDiff.hunks.push(newHunk);
  }
  const finalHunk = hunks.at(-1);
  if (finalHunk != null && !diff.isPartial) pushCollapsedContextLines(resolvedDiff, deletionLines, additionLines, finalHunk.deletionLineIndex + finalHunk.deletionCount, finalHunk.additionLineIndex + finalHunk.additionCount, Math.min(deletionLines.length - (finalHunk.deletionLineIndex + finalHunk.deletionCount), additionLines.length - (finalHunk.additionLineIndex + finalHunk.additionCount)));
  resolvedDiff.splitLineCount = cursor.splitLineCount;
  resolvedDiff.unifiedLineCount = cursor.unifiedLineCount;
  return resolvedDiff;
}
function pushCollapsedContextLines(diff, deletionLines, additionLines, deletionLineIndex, additionLineIndex, lineCount) {
  for (let index = 0; index < lineCount; index++) {
    const deletionLine = deletionLines[deletionLineIndex + index];
    const additionLine = additionLines[additionLineIndex + index];
    if (deletionLine == null || additionLine == null) throw new Error("pushCollapsedContextLines: missing collapsed context line");
    diff.deletionLines.push(deletionLine);
    diff.additionLines.push(additionLine);
  }
}
function processCollapsedContext(sourceDiff, resolvedDiff, cursor, deletionLineIndex, additionLineIndex, lineCount, shouldProcessContent) {
  if (lineCount <= 0) return;
  if (shouldProcessContent) {
    pushCollapsedContextLines(resolvedDiff, sourceDiff.deletionLines, sourceDiff.additionLines, deletionLineIndex, additionLineIndex, lineCount);
    cursor.nextAdditionLineIndex += lineCount;
    cursor.nextDeletionLineIndex += lineCount;
  }
  cursor.nextAdditionStart += lineCount;
  cursor.nextDeletionStart += lineCount;
  cursor.splitLineCount += lineCount;
  cursor.unifiedLineCount += lineCount;
}
function pushContentLinesToDiff(content, diff, deletionLines, additionLines) {
  if (content.type === "context") for (let i2 = 0; i2 < content.lines; i2++) {
    const line = additionLines[content.additionLineIndex + i2];
    if (line == null) {
      console.error({
        additionLines,
        content,
        i: i2
      });
      throw new Error("pushContentLinesToDiff: Context line does not exist");
    }
    diff.deletionLines.push(line);
    diff.additionLines.push(line);
  }
  else {
    const len = Math.max(content.deletions, content.additions);
    for (let i2 = 0; i2 < len; i2++) {
      if (i2 < content.deletions) {
        const line = deletionLines[content.deletionLineIndex + i2];
        if (line == null) {
          console.error({
            deletionLines,
            content,
            i: i2
          });
          throw new Error("pushContentLinesToDiff: Deletion line does not exist");
        }
        diff.deletionLines.push(line);
      }
      if (i2 < content.additions) {
        const line = additionLines[content.additionLineIndex + i2];
        if (line == null) {
          console.error({
            additionLines,
            content,
            i: i2
          });
          throw new Error("pushContentLinesToDiff: Addition line does not exist");
        }
        diff.additionLines.push(line);
      }
    }
  }
}
function pushResolveLinesToDiff(resolution, content, diff, deletionLines, additionLines) {
  if (resolution === "deletions" || resolution === "both") for (let i2 = 0; i2 < content.deletions; i2++) {
    const line = deletionLines[content.deletionLineIndex + i2];
    if (line == null) {
      console.error({
        deletionLines,
        content,
        i: i2
      });
      throw new Error("pushResolveLinesToDiff: Deletion line does not exist");
    }
    diff.deletionLines.push(line);
    diff.additionLines.push(line);
  }
  if (resolution === "additions" || resolution === "both") for (let i2 = 0; i2 < content.additions; i2++) {
    const line = additionLines[content.additionLineIndex + i2];
    if (line == null) {
      console.error({
        additionLines,
        content,
        i: i2
      });
      throw new Error("pushResolveLinesToDiff: Addition line does not exist");
    }
    diff.deletionLines.push(line);
    diff.additionLines.push(line);
  }
}
function advanceCursor(content, cursor, hunk) {
  if (content.type === "context") {
    cursor.nextAdditionLineIndex += content.lines;
    cursor.nextDeletionLineIndex += content.lines;
    cursor.nextAdditionStart += content.lines;
    cursor.nextDeletionStart += content.lines;
    cursor.splitLineCount += content.lines;
    cursor.unifiedLineCount += content.lines;
    hunk.additionCount += content.lines;
    hunk.deletionCount += content.lines;
    hunk.splitLineCount += content.lines;
    hunk.unifiedLineCount += content.lines;
  } else {
    cursor.nextAdditionLineIndex += content.additions;
    cursor.nextDeletionLineIndex += content.deletions;
    cursor.nextAdditionStart += content.additions;
    cursor.nextDeletionStart += content.deletions;
    cursor.splitLineCount += Math.max(content.deletions, content.additions);
    cursor.unifiedLineCount += content.deletions + content.additions;
    hunk.deletionCount += content.deletions;
    hunk.deletionLines += content.deletions;
    hunk.additionCount += content.additions;
    hunk.additionLines += content.additions;
    hunk.splitLineCount += Math.max(content.deletions, content.additions);
    hunk.unifiedLineCount += content.deletions + content.additions;
  }
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/utils/resolveConflict.js
function resolveConflict(diff, conflict, type) {
  return resolveRegion(diff, {
    resolution: normalizeDiffResolution(type),
    hunkIndex: conflict.hunkIndex,
    startContentIndex: conflict.startContentIndex,
    endContentIndex: conflict.endContentIndex,
    indexesToDelete: getConflictDeleteContentIndexes(conflict)
  });
}
function getConflictDeleteContentIndexes(conflict) {
  const indexes = /* @__PURE__ */ new Set();
  if (conflict.baseContentIndex != null) indexes.add(conflict.baseContentIndex);
  if (conflict.endMarkerContentIndex !== conflict.endContentIndex) indexes.add(conflict.endMarkerContentIndex);
  return indexes;
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/components/UnresolvedFile.js
var instanceId7 = -1;
var UnresolvedFile = class extends FileDiff {
  __id = `unresolved-file:${++instanceId7}`;
  computedCache = {
    file: void 0,
    fileDiff: void 0,
    actions: void 0,
    markerRows: void 0
  };
  conflictActions = [];
  markerRows = [];
  conflictActionCache = /* @__PURE__ */ new Map();
  constructor(options = { theme: DEFAULT_THEMES }, workerManager, isContainerManaged = false) {
    super(void 0, workerManager, isContainerManaged);
    this.options = options;
    this.setOptions(options);
  }
  setOptions(options) {
    if (options == null) return;
    if (options.onMergeConflictAction != null && options.onMergeConflictResolve != null) throw new Error("UnresolvedFile: onMergeConflictAction and onMergeConflictResolve are mutually exclusive. Use only one callback.");
    this.options = options;
    this.hunksRenderer.setOptions(this.getHunksRendererOptions(options));
    const hunkSeparators = this.options.hunkSeparators ?? "line-info";
    this.interactionManager.setOptions(pluckInteractionOptions(this.options, typeof hunkSeparators === "function" || hunkSeparators === "line-info" || hunkSeparators === "line-info-basic" ? this.expandHunk : void 0, this.getLineIndex, this.handleMergeConflictActionClick));
  }
  createHunksRenderer(options) {
    return new UnresolvedFileHunksRenderer(this.getHunksRendererOptions(options), this.handleHighlightRender, this.workerManager);
  }
  getHunksRendererOptions(options) {
    return getUnresolvedDiffHunksRendererOptions(options, this.options);
  }
  applyPreNodeAttributes(pre, result) {
    super.applyPreNodeAttributes(pre, result, { "data-has-merge-conflict": "" });
  }
  cleanUp() {
    this.clearMergeConflictActionCache();
    this.computedCache = {
      file: void 0,
      fileDiff: void 0,
      actions: void 0,
      markerRows: void 0
    };
    this.conflictActions = [];
    super.cleanUp();
  }
  getOrComputeDiff({ file, fileDiff, actions, markerRows }) {
    const { maxContextLines, onMergeConflictAction } = this.options;
    wrapper: if (onMergeConflictAction != null) {
      const hasFileDiff = fileDiff != null;
      if (hasFileDiff !== (actions != null) || hasFileDiff !== (markerRows != null)) throw new Error("UnresolvedFile.getOrComputeDiff: fileDiff, actions, and markerRows must be passed together");
      if (fileDiff != null && actions != null && markerRows != null) {
        this.computedCache = {
          file: file ?? this.computedCache.file,
          fileDiff,
          actions,
          markerRows
        };
        break wrapper;
      } else if (file != null || this.computedCache.file != null) {
        if (file != null && this.computedCache.file != null && !areFilesEqual(file, this.computedCache.file) && this.computedCache.fileDiff != null && this.computedCache.actions != null) throw new Error("UnresolvedFile.getOrComputeDiff: file can only be used to initialize unresolved state once. Pass fileDiff and actions for subsequent updates.");
        file ??= this.computedCache.file;
        if (file == null) throw new Error("UnresolvedFile.getOrComputeDiff: file is null, should be impossible");
        if (!areFilesEqual(file, this.computedCache.file) || this.computedCache.fileDiff == null || this.computedCache.actions == null) {
          const computed = parseMergeConflictDiffFromFile(file, maxContextLines);
          this.computedCache = {
            file,
            fileDiff: computed.fileDiff,
            actions: computed.actions,
            markerRows: computed.markerRows
          };
        }
        fileDiff = this.computedCache.fileDiff;
        actions = this.computedCache.actions;
        markerRows = this.computedCache.markerRows;
        break wrapper;
      } else {
        fileDiff = this.computedCache.fileDiff;
        actions = this.computedCache.actions;
        markerRows = this.computedCache.markerRows;
        break wrapper;
      }
    } else {
      if (fileDiff != null || actions != null || markerRows != null) throw new Error("UnresolvedFile.getOrComputeDiff: fileDiff, actions, and markerRows are only usable in controlled mode, you must pass in `onMergeConflictAction`");
      if (file != null && this.computedCache.file != null && !areFilesEqual(file, this.computedCache.file)) throw new Error("UnresolvedFile.getOrComputeDiff: uncontrolled unresolved files parse the file only once. Later updates must come from the cached diff state.");
      this.computedCache.file ??= file;
      if (this.computedCache.fileDiff == null && this.computedCache.file != null) {
        const computed = parseMergeConflictDiffFromFile(this.computedCache.file, maxContextLines);
        this.computedCache.fileDiff = computed.fileDiff;
        this.computedCache.actions = computed.actions;
        this.computedCache.markerRows = computed.markerRows;
      }
      fileDiff = this.computedCache.fileDiff;
      actions = this.computedCache.actions;
      markerRows = this.computedCache.markerRows;
      break wrapper;
    }
    if (fileDiff == null || actions == null || markerRows == null) return;
    return {
      fileDiff,
      actions,
      markerRows
    };
  }
  hydrate(props) {
    const { file, fileDiff, actions, markerRows, lineAnnotations, fileContainer, prerenderedHTML, preventEmit = false } = props;
    const source = this.getOrComputeDiff({
      file,
      fileDiff,
      actions,
      markerRows
    });
    if (source == null) return;
    this.hydrateElements(fileContainer, prerenderedHTML);
    this.setActiveMergeConflictState(source.actions, source.markerRows);
    if (shouldRenderCode3(this.pre, source.fileDiff, this.options.collapsed) || shouldRenderHeader3(this.headerElement, source.fileDiff, this.options.disableFileHeader)) this.render({
      ...props,
      preventEmit: true
    });
    else {
      this.hydrationSetup({
        fileDiff: source.fileDiff,
        lineAnnotations
      });
      if (this.pre != null) this.renderMergeConflictActionSlots();
    }
    if (!preventEmit) this.emitPostRender();
  }
  rerender() {
    if (!this.enabled || this.fileDiff == null) return;
    this.render({
      forceRender: true,
      renderRange: this.renderRange
    });
  }
  render(props = {}) {
    let { file, fileDiff, actions, markerRows, lineAnnotations, preventEmit = false, ...rest } = props;
    const source = this.getOrComputeDiff({
      file,
      fileDiff,
      actions,
      markerRows
    });
    if (source == null) return false;
    this.setActiveMergeConflictState(source.actions, source.markerRows);
    const didRender = super.render({
      ...rest,
      fileDiff: source.fileDiff,
      lineAnnotations,
      preventEmit: true
    });
    if (didRender) {
      this.renderMergeConflictActionSlots();
      if (!preventEmit) this.emitPostRender();
    }
    return didRender;
  }
  resolveConflict(conflictIndex, resolution, fileDiff = this.computedCache.fileDiff) {
    const action = this.conflictActions[conflictIndex];
    if (fileDiff == null || action == null) return;
    if (action.conflictIndex !== conflictIndex) {
      console.error({
        conflictIndex,
        action
      });
      throw new Error("UnresolvedFile.resolveConflict: conflictIndex and conflictAction don't match");
    }
    const newFileDiff = resolveConflict(fileDiff, action, resolution);
    const previousFile = this.computedCache.file;
    const { file, actions, markerRows } = rebuildFileAndActions({
      fileDiff: newFileDiff,
      previousActions: this.conflictActions,
      resolvedConflictIndex: conflictIndex,
      previousFile,
      resolution
    });
    return {
      file,
      fileDiff: newFileDiff,
      actions,
      markerRows
    };
  }
  resolveConflictAndRender(conflictIndex, resolution) {
    const action = this.conflictActions[conflictIndex];
    if (action == null) return;
    if (action.conflictIndex !== conflictIndex) {
      console.error({
        conflictIndex,
        action
      });
      throw new Error("UnresolvedFile.resolveConflictAndRender: conflictIndex and conflictAction don't match");
    }
    const payload = {
      resolution,
      conflict: action.conflict
    };
    const { file, fileDiff, actions, markerRows } = this.resolveConflict(conflictIndex, resolution) ?? {};
    if (file == null || fileDiff == null || actions == null || markerRows == null) return;
    this.computedCache = {
      file,
      fileDiff,
      actions,
      markerRows
    };
    this.setActiveMergeConflictState(actions, markerRows);
    if (this.workerManager != null) this.hunksRenderer.renderDiff(fileDiff);
    else this.render({ forceRender: true });
    this.options.onMergeConflictResolve?.(file, payload);
  }
  setActiveMergeConflictState(actions = this.conflictActions, markerRows = this.markerRows) {
    this.conflictActions = actions;
    this.markerRows = markerRows;
    if (this.computedCache.fileDiff != null && this.hunksRenderer instanceof UnresolvedFileHunksRenderer) this.hunksRenderer.setConflictState(this.options.mergeConflictActionsType === "none" ? [] : actions, markerRows, this.computedCache.fileDiff);
  }
  handleMergeConflictActionClick = (target) => {
    const action = this.conflictActions[target.conflictIndex];
    if (action == null) return;
    if (action.conflictIndex !== target.conflictIndex) {
      console.error({
        conflictIndex: target.conflictIndex,
        action
      });
      throw new Error("UnresolvedFile.handleMergeConflictActionClick: conflictIndex and conflictAction don't match");
    }
    const payload = {
      resolution: target.resolution,
      conflict: action.conflict
    };
    if (this.options.onMergeConflictAction != null) {
      this.options.onMergeConflictAction(payload, this);
      return;
    }
    this.resolveConflictAndRender(target.conflictIndex, target.resolution);
  };
  renderMergeConflictActionSlots() {
    const { fileDiff } = this.computedCache;
    if (this.isContainerManaged || this.fileContainer == null || typeof this.options.mergeConflictActionsType !== "function" || this.conflictActions.length === 0 || fileDiff == null) {
      this.clearMergeConflictActionCache();
      return;
    }
    const staleActions = new Map(this.conflictActionCache);
    for (let actionIndex = 0; actionIndex < this.conflictActions.length; actionIndex++) {
      const action = this.conflictActions[actionIndex];
      if (action == null) continue;
      if (action.conflictIndex !== actionIndex) {
        console.error({
          conflictIndex: actionIndex,
          action
        });
        throw new Error("UnresolvedFile.renderMergeConflictActionSlots: conflictIndex and conflictAction don't match");
      }
      const anchor = getMergeConflictActionAnchor(action, fileDiff);
      if (anchor == null) continue;
      const conflictIndex = action.conflictIndex;
      const slotName = getMergeConflictActionSlotName({
        hunkIndex: anchor.hunkIndex,
        lineIndex: anchor.lineIndex,
        conflictIndex
      });
      const id = `${actionIndex}-${slotName}`;
      let cache = this.conflictActionCache.get(id);
      if (cache == null || !areMergeConflictActionsEqual(cache.action, action)) {
        cache?.element.remove();
        const rendered = this.renderMergeConflictAction(action);
        if (rendered == null) continue;
        const element2 = createAnnotationWrapperNode(slotName);
        element2.appendChild(rendered);
        this.fileContainer.appendChild(element2);
        cache = {
          element: element2,
          action
        };
        this.conflictActionCache.set(id, cache);
      }
      staleActions.delete(id);
    }
    for (const [id, { element: element2 }] of staleActions.entries()) {
      this.conflictActionCache.delete(id);
      element2.remove();
    }
  }
  renderMergeConflictAction(action) {
    if (typeof this.options.mergeConflictActionsType !== "function") return;
    const rendered = this.options.mergeConflictActionsType(action, this);
    if (rendered == null) return;
    if (rendered instanceof HTMLElement) return rendered;
    if (typeof DocumentFragment !== "undefined" && rendered instanceof DocumentFragment) {
      const wrapper = document.createElement("div");
      wrapper.style.display = "contents";
      wrapper.appendChild(rendered);
      return wrapper;
    }
  }
  clearMergeConflictActionCache() {
    for (const { element: element2 } of this.conflictActionCache.values()) element2.remove();
    this.conflictActionCache.clear();
  }
};
function rebuildFileAndActions({ fileDiff, previousActions, resolvedConflictIndex, previousFile, resolution }) {
  const resolvedAction = previousActions[resolvedConflictIndex];
  if (resolvedAction == null) throw new Error("rebuildFileAndActions: missing resolved action for unresolved file rebuild");
  const actions = updateConflictActionsAfterResolution(previousActions, resolvedConflictIndex, resolvedAction, resolution);
  const markerRows = buildMergeConflictMarkerRows(fileDiff, actions);
  return {
    file: rebuildUnresolvedFile({
      fileDiff,
      resolvedAction,
      resolvedConflictIndex,
      previousFile,
      resolution
    }),
    actions,
    markerRows
  };
}
function rebuildUnresolvedFile({ resolvedAction, resolvedConflictIndex, previousFile, fileDiff, resolution }) {
  const lines = splitFileContents(previousFile?.contents ?? "");
  const { conflict } = resolvedAction;
  const replacementLines = getResolvedConflictReplacementLines(lines, conflict, resolution);
  const contents = [
    ...lines.slice(0, conflict.startLineIndex),
    ...replacementLines,
    ...lines.slice(conflict.endLineIndex + 1)
  ].join("");
  return {
    name: previousFile?.name ?? fileDiff.name,
    contents,
    cacheKey: previousFile?.cacheKey != null ? `${previousFile.cacheKey}:mc-${resolvedConflictIndex}-${resolution}` : void 0
  };
}
function getResolvedConflictReplacementLines(lines, conflict, resolution) {
  const currentLines = lines.slice(conflict.startLineIndex + 1, conflict.baseMarkerLineIndex ?? conflict.separatorLineIndex);
  const incomingLines = lines.slice(conflict.separatorLineIndex + 1, conflict.endLineIndex);
  if (resolution === "current") return currentLines;
  if (resolution === "incoming") return incomingLines;
  return [...currentLines, ...incomingLines];
}
function updateConflictActionsAfterResolution(previousActions, resolvedConflictIndex, resolvedAction, resolution) {
  const lineDelta = getResolvedConflictLineDelta(resolvedAction.conflict, resolution);
  return previousActions.map((action, index) => {
    if (index === resolvedConflictIndex) return;
    if (action == null) return;
    if (action.conflict.startLineIndex > resolvedAction.conflict.endLineIndex) return {
      ...action,
      conflict: shiftMergeConflictRegion(action.conflict, lineDelta)
    };
    return action;
  });
}
function getResolvedConflictLineDelta(conflict, resolution) {
  const currentLineCount = (conflict.baseMarkerLineIndex ?? conflict.separatorLineIndex) - conflict.startLineIndex - 1;
  const incomingLineCount = conflict.endLineIndex - conflict.separatorLineIndex - 1;
  return (resolution === "current" ? currentLineCount : resolution === "incoming" ? incomingLineCount : currentLineCount + incomingLineCount) - (conflict.endLineIndex - conflict.startLineIndex + 1);
}
function shiftMergeConflictRegion(conflict, lineDelta) {
  return {
    ...conflict,
    startLineIndex: conflict.startLineIndex + lineDelta,
    startLineNumber: conflict.startLineNumber + lineDelta,
    separatorLineIndex: conflict.separatorLineIndex + lineDelta,
    separatorLineNumber: conflict.separatorLineNumber + lineDelta,
    endLineIndex: conflict.endLineIndex + lineDelta,
    endLineNumber: conflict.endLineNumber + lineDelta,
    baseMarkerLineIndex: conflict.baseMarkerLineIndex != null ? conflict.baseMarkerLineIndex + lineDelta : void 0,
    baseMarkerLineNumber: conflict.baseMarkerLineNumber != null ? conflict.baseMarkerLineNumber + lineDelta : void 0
  };
}
function shouldRenderCode3(pre, fileDiff, collapsed = false) {
  return !collapsed && pre == null && fileDiff != null;
}
function shouldRenderHeader3(headerElement, fileDiff, disableFileHeader = false) {
  return headerElement == null && fileDiff != null && !disableFileHeader;
}
function getUnresolvedDiffHunksRendererOptions(options, baseOptions) {
  return {
    ...baseOptions,
    ...options,
    hunkSeparators: typeof options?.hunkSeparators === "function" ? "custom" : options?.hunkSeparators,
    mergeConflictActionsType: typeof options?.mergeConflictActionsType === "function" ? "custom" : options?.mergeConflictActionsType
  };
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/react/utils/useUnresolvedFileInstance.js
init_neon_pilot_shared_react();
var useIsometricEffect3 = typeof window === "undefined" ? useEffect : useLayoutEffect;
function useUnresolvedFileInstance({ file, options, lineAnnotations, selectedLines, prerenderedHTML, hasConflictUtility, hasGutterRenderUtility, hasCustomHeader, disableWorkerPool }) {
  const [{ fileDiff, actions, markerRows }, setState] = useState(() => {
    const { fileDiff: fileDiff$1, actions: actions$1, markerRows: markerRows$1 } = parseMergeConflictDiffFromFile(file, options?.maxContextLines);
    return {
      fileDiff: fileDiff$1,
      actions: actions$1,
      markerRows: markerRows$1
    };
  });
  const onMergeConflictAction = useStableCallback((payload, instance2) => {
    setState((prevState) => {
      const { fileDiff: fileDiff$1, actions: actions$1, markerRows: markerRows$1 } = instance2.resolveConflict(payload.conflict.conflictIndex, payload.resolution, prevState.fileDiff) ?? {};
      if (fileDiff$1 == null || actions$1 == null || markerRows$1 == null) return prevState;
      else return {
        fileDiff: fileDiff$1,
        actions: actions$1,
        markerRows: markerRows$1
      };
    });
  });
  const poolManager = useContext(WorkerPoolContext);
  const instanceRef = useRef(null);
  const ref = useStableCallback((fileContainer) => {
    if (fileContainer != null) {
      if (instanceRef.current != null) throw new Error("useUnresolvedFileInstance: An instance should not already exist when a node is created");
      instanceRef.current = new UnresolvedFile(mergeUnresolvedOptions({
        hasConflictUtility,
        hasCustomHeader,
        hasGutterRenderUtility,
        onMergeConflictAction,
        options
      }), !disableWorkerPool ? poolManager : void 0, true);
      instanceRef.current.hydrate({
        fileDiff,
        actions,
        markerRows,
        fileContainer,
        lineAnnotations,
        prerenderedHTML
      });
    } else {
      if (instanceRef.current == null) throw new Error("useUnresolvedFileInstance: A UnresolvedFile instance should exist when unmounting");
      instanceRef.current.cleanUp();
      instanceRef.current = null;
    }
  });
  useIsometricEffect3(() => {
    if (instanceRef.current == null) return;
    const instance2 = instanceRef.current;
    const newOptions = mergeUnresolvedOptions({
      hasConflictUtility,
      hasCustomHeader,
      hasGutterRenderUtility,
      onMergeConflictAction,
      options
    });
    const forceRender = !areOptionsEqual(instance2.options, newOptions);
    instance2.setOptions(newOptions);
    instance2.render({
      fileDiff,
      actions,
      markerRows,
      lineAnnotations,
      forceRender
    });
    if (selectedLines !== void 0) instance2.setSelectedLines(selectedLines);
  });
  return {
    ref,
    getHoveredLine: useCallback(() => {
      return instanceRef.current?.getHoveredLine();
    }, []),
    fileDiff,
    actions,
    markerRows,
    getInstance: useCallback(() => {
      return instanceRef.current ?? void 0;
    }, [])
  };
}
function mergeUnresolvedOptions({ options, onMergeConflictAction, hasConflictUtility, hasCustomHeader, hasGutterRenderUtility }) {
  return {
    ...options,
    onMergeConflictAction,
    hunkSeparators: options?.hunkSeparators === "custom" ? noopRender : options?.hunkSeparators,
    mergeConflictActionsType: hasConflictUtility || options?.mergeConflictActionsType === "custom" ? noopRender : options?.mergeConflictActionsType,
    renderCustomHeader: hasCustomHeader ? noopRender : void 0,
    renderGutterUtility: hasGutterRenderUtility ? noopRender : void 0
  };
}

// node_modules/.pnpm/@pierre+diffs@1.1.19_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@pierre/diffs/dist/react/UnresolvedFile.js
function UnresolvedFile2({ file, options, lineAnnotations, selectedLines, className, style, prerenderedHTML, renderAnnotation, renderCustomHeader, renderHeaderPrefix, renderHeaderMetadata, renderGutterUtility, renderHoverUtility, renderMergeConflictUtility, disableWorkerPool = false }) {
  const { ref, getHoveredLine, fileDiff, actions, getInstance } = useUnresolvedFileInstance({
    file,
    options,
    lineAnnotations,
    selectedLines,
    prerenderedHTML,
    hasConflictUtility: renderMergeConflictUtility != null,
    hasGutterRenderUtility: renderGutterUtility != null || renderHoverUtility != null,
    hasCustomHeader: renderCustomHeader != null,
    disableWorkerPool
  });
  return /* @__PURE__ */ jsx(DIFFS_TAG_NAME, {
    ref,
    className,
    style,
    children: templateRender(renderDiffChildren({
      fileDiff,
      renderCustomHeader,
      renderHeaderPrefix,
      renderHeaderMetadata,
      renderAnnotation,
      renderGutterUtility,
      renderHoverUtility,
      lineAnnotations,
      getHoveredLine,
      actions,
      renderMergeConflictUtility,
      getInstance
    }), prerenderedHTML)
  });
}
export {
  File2 as File,
  FileDiff2 as FileDiff,
  GutterUtilitySlotStyles,
  MergeConflictSlotStyles,
  MultiFileDiff,
  PatchDiff,
  UnresolvedFile2 as UnresolvedFile,
  Virtualizer3 as Virtualizer,
  VirtualizerContext,
  WorkerPoolContext,
  WorkerPoolContextProvider,
  noopRender,
  renderDiffChildren,
  renderFileChildren,
  templateRender,
  useFileDiffInstance,
  useFileInstance,
  useStableCallback,
  useVirtualizer,
  useWorkerPool
};
