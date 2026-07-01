import {
  Fragment2 as Fragment,
  init_neon_pilot_shared_react,
  jsx,
  jsxs,
  neon_pilot_shared_react_default
} from "./chunk-TTFLGCWD.js";
import {
  c
} from "./chunk-ML6OT2ZF.js";
import {
  i
} from "./chunk-LVCRN73N.js";
import {
  __commonJS,
  __toESM
} from "./chunk-MZHE4QUL.js";

// node_modules/.pnpm/lodash.throttle@4.1.1/node_modules/lodash.throttle/index.js
var require_lodash = __commonJS({
  "node_modules/.pnpm/lodash.throttle@4.1.1/node_modules/lodash.throttle/index.js"(exports, module) {
    var FUNC_ERROR_TEXT = "Expected a function";
    var NAN = 0 / 0;
    var symbolTag = "[object Symbol]";
    var reTrim = /^\s+|\s+$/g;
    var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;
    var reIsBinary = /^0b[01]+$/i;
    var reIsOctal = /^0o[0-7]+$/i;
    var freeParseInt = parseInt;
    var freeGlobal = typeof global == "object" && global && global.Object === Object && global;
    var freeSelf = typeof self == "object" && self && self.Object === Object && self;
    var root = freeGlobal || freeSelf || Function("return this")();
    var objectProto = Object.prototype;
    var objectToString = objectProto.toString;
    var nativeMax = Math.max;
    var nativeMin = Math.min;
    var now = function() {
      return root.Date.now();
    };
    function debounce(func, wait, options) {
      var lastArgs, lastThis, maxWait, result, timerId, lastCallTime, lastInvokeTime = 0, leading = false, maxing = false, trailing = true;
      if (typeof func != "function") {
        throw new TypeError(FUNC_ERROR_TEXT);
      }
      wait = toNumber(wait) || 0;
      if (isObject(options)) {
        leading = !!options.leading;
        maxing = "maxWait" in options;
        maxWait = maxing ? nativeMax(toNumber(options.maxWait) || 0, wait) : maxWait;
        trailing = "trailing" in options ? !!options.trailing : trailing;
      }
      function invokeFunc(time) {
        var args = lastArgs, thisArg = lastThis;
        lastArgs = lastThis = void 0;
        lastInvokeTime = time;
        result = func.apply(thisArg, args);
        return result;
      }
      function leadingEdge(time) {
        lastInvokeTime = time;
        timerId = setTimeout(timerExpired, wait);
        return leading ? invokeFunc(time) : result;
      }
      function remainingWait(time) {
        var timeSinceLastCall = time - lastCallTime, timeSinceLastInvoke = time - lastInvokeTime, result2 = wait - timeSinceLastCall;
        return maxing ? nativeMin(result2, maxWait - timeSinceLastInvoke) : result2;
      }
      function shouldInvoke(time) {
        var timeSinceLastCall = time - lastCallTime, timeSinceLastInvoke = time - lastInvokeTime;
        return lastCallTime === void 0 || timeSinceLastCall >= wait || timeSinceLastCall < 0 || maxing && timeSinceLastInvoke >= maxWait;
      }
      function timerExpired() {
        var time = now();
        if (shouldInvoke(time)) {
          return trailingEdge(time);
        }
        timerId = setTimeout(timerExpired, remainingWait(time));
      }
      function trailingEdge(time) {
        timerId = void 0;
        if (trailing && lastArgs) {
          return invokeFunc(time);
        }
        lastArgs = lastThis = void 0;
        return result;
      }
      function cancel() {
        if (timerId !== void 0) {
          clearTimeout(timerId);
        }
        lastInvokeTime = 0;
        lastArgs = lastCallTime = lastThis = timerId = void 0;
      }
      function flush() {
        return timerId === void 0 ? result : trailingEdge(now());
      }
      function debounced() {
        var time = now(), isInvoking = shouldInvoke(time);
        lastArgs = arguments;
        lastThis = this;
        lastCallTime = time;
        if (isInvoking) {
          if (timerId === void 0) {
            return leadingEdge(lastCallTime);
          }
          if (maxing) {
            timerId = setTimeout(timerExpired, wait);
            return invokeFunc(lastCallTime);
          }
        }
        if (timerId === void 0) {
          timerId = setTimeout(timerExpired, wait);
        }
        return result;
      }
      debounced.cancel = cancel;
      debounced.flush = flush;
      return debounced;
    }
    function throttle(func, wait, options) {
      var leading = true, trailing = true;
      if (typeof func != "function") {
        throw new TypeError(FUNC_ERROR_TEXT);
      }
      if (isObject(options)) {
        leading = "leading" in options ? !!options.leading : leading;
        trailing = "trailing" in options ? !!options.trailing : trailing;
      }
      return debounce(func, wait, {
        "leading": leading,
        "maxWait": wait,
        "trailing": trailing
      });
    }
    function isObject(value) {
      var type = typeof value;
      return !!value && (type == "object" || type == "function");
    }
    function isObjectLike(value) {
      return !!value && typeof value == "object";
    }
    function isSymbol(value) {
      return typeof value == "symbol" || isObjectLike(value) && objectToString.call(value) == symbolTag;
    }
    function toNumber(value) {
      if (typeof value == "number") {
        return value;
      }
      if (isSymbol(value)) {
        return NAN;
      }
      if (isObject(value)) {
        var other = typeof value.valueOf == "function" ? value.valueOf() : value;
        value = isObject(other) ? other + "" : other;
      }
      if (typeof value != "string") {
        return value === 0 ? value : +value;
      }
      value = value.replace(reTrim, "");
      var isBinary = reIsBinary.test(value);
      return isBinary || reIsOctal.test(value) ? freeParseInt(value.slice(2), isBinary ? 2 : 8) : reIsBadHex.test(value) ? NAN : +value;
    }
    module.exports = throttle;
  }
});

// node_modules/.pnpm/crc-32@0.3.0/node_modules/crc-32/crc32.js
var require_crc32 = __commonJS({
  "node_modules/.pnpm/crc-32@0.3.0/node_modules/crc-32/crc32.js"(exports) {
    var CRC32;
    (function(factory) {
      if (typeof DO_NOT_EXPORT_CRC === "undefined") {
        if ("object" === typeof exports) {
          factory(exports);
        } else if ("function" === typeof define && define.amd) {
          define(function() {
            var module2 = {};
            factory(module2);
            return module2;
          });
        } else {
          factory(CRC32 = {});
        }
      } else {
        factory(CRC32 = {});
      }
    })(function(CRC322) {
      CRC322.version = "0.3.0";
      function signed_crc_table() {
        var c3 = 0, table2 = new Array(256);
        for (var n3 = 0; n3 != 256; ++n3) {
          c3 = n3;
          c3 = c3 & 1 ? -306674912 ^ c3 >>> 1 : c3 >>> 1;
          c3 = c3 & 1 ? -306674912 ^ c3 >>> 1 : c3 >>> 1;
          c3 = c3 & 1 ? -306674912 ^ c3 >>> 1 : c3 >>> 1;
          c3 = c3 & 1 ? -306674912 ^ c3 >>> 1 : c3 >>> 1;
          c3 = c3 & 1 ? -306674912 ^ c3 >>> 1 : c3 >>> 1;
          c3 = c3 & 1 ? -306674912 ^ c3 >>> 1 : c3 >>> 1;
          c3 = c3 & 1 ? -306674912 ^ c3 >>> 1 : c3 >>> 1;
          c3 = c3 & 1 ? -306674912 ^ c3 >>> 1 : c3 >>> 1;
          table2[n3] = c3;
        }
        return typeof Int32Array !== "undefined" ? new Int32Array(table2) : table2;
      }
      var table = signed_crc_table();
      var use_buffer = typeof Buffer !== "undefined";
      function crc32_bstr(bstr) {
        if (bstr.length > 32768) {
          if (use_buffer) return crc32_buf_8(new Buffer(bstr));
        }
        var crc = -1, L3 = bstr.length - 1;
        for (var i3 = 0; i3 < L3; ) {
          crc = table[(crc ^ bstr.charCodeAt(i3++)) & 255] ^ crc >>> 8;
          crc = table[(crc ^ bstr.charCodeAt(i3++)) & 255] ^ crc >>> 8;
        }
        if (i3 === L3) crc = crc >>> 8 ^ table[(crc ^ bstr.charCodeAt(i3)) & 255];
        return crc ^ -1;
      }
      function crc32_buf(buf) {
        if (buf.length > 1e4) return crc32_buf_8(buf);
        for (var crc = -1, i3 = 0, L3 = buf.length - 3; i3 < L3; ) {
          crc = crc >>> 8 ^ table[(crc ^ buf[i3++]) & 255];
          crc = crc >>> 8 ^ table[(crc ^ buf[i3++]) & 255];
          crc = crc >>> 8 ^ table[(crc ^ buf[i3++]) & 255];
          crc = crc >>> 8 ^ table[(crc ^ buf[i3++]) & 255];
        }
        while (i3 < L3 + 3) crc = crc >>> 8 ^ table[(crc ^ buf[i3++]) & 255];
        return crc ^ -1;
      }
      function crc32_buf_8(buf) {
        for (var crc = -1, i3 = 0, L3 = buf.length - 7; i3 < L3; ) {
          crc = crc >>> 8 ^ table[(crc ^ buf[i3++]) & 255];
          crc = crc >>> 8 ^ table[(crc ^ buf[i3++]) & 255];
          crc = crc >>> 8 ^ table[(crc ^ buf[i3++]) & 255];
          crc = crc >>> 8 ^ table[(crc ^ buf[i3++]) & 255];
          crc = crc >>> 8 ^ table[(crc ^ buf[i3++]) & 255];
          crc = crc >>> 8 ^ table[(crc ^ buf[i3++]) & 255];
          crc = crc >>> 8 ^ table[(crc ^ buf[i3++]) & 255];
          crc = crc >>> 8 ^ table[(crc ^ buf[i3++]) & 255];
        }
        while (i3 < L3 + 7) crc = crc >>> 8 ^ table[(crc ^ buf[i3++]) & 255];
        return crc ^ -1;
      }
      function crc32_str(str) {
        for (var crc = -1, i3 = 0, L3 = str.length, c3, d; i3 < L3; ) {
          c3 = str.charCodeAt(i3++);
          if (c3 < 128) {
            crc = crc >>> 8 ^ table[(crc ^ c3) & 255];
          } else if (c3 < 2048) {
            crc = crc >>> 8 ^ table[(crc ^ (192 | c3 >> 6 & 31)) & 255];
            crc = crc >>> 8 ^ table[(crc ^ (128 | c3 & 63)) & 255];
          } else if (c3 >= 55296 && c3 < 57344) {
            c3 = (c3 & 1023) + 64;
            d = str.charCodeAt(i3++) & 1023;
            crc = crc >>> 8 ^ table[(crc ^ (240 | c3 >> 8 & 7)) & 255];
            crc = crc >>> 8 ^ table[(crc ^ (128 | c3 >> 2 & 63)) & 255];
            crc = crc >>> 8 ^ table[(crc ^ (128 | d >> 6 & 15 | c3 & 3)) & 255];
            crc = crc >>> 8 ^ table[(crc ^ (128 | d & 63)) & 255];
          } else {
            crc = crc >>> 8 ^ table[(crc ^ (224 | c3 >> 12 & 15)) & 255];
            crc = crc >>> 8 ^ table[(crc ^ (128 | c3 >> 6 & 63)) & 255];
            crc = crc >>> 8 ^ table[(crc ^ (128 | c3 & 63)) & 255];
          }
        }
        return crc ^ -1;
      }
      CRC322.table = table;
      CRC322.bstr = crc32_bstr;
      CRC322.buf = crc32_buf;
      CRC322.str = crc32_str;
    });
  }
});

// node_modules/.pnpm/png-chunks-extract@1.0.0/node_modules/png-chunks-extract/index.js
var require_png_chunks_extract = __commonJS({
  "node_modules/.pnpm/png-chunks-extract@1.0.0/node_modules/png-chunks-extract/index.js"(exports, module) {
    var crc322 = require_crc32();
    module.exports = extractChunks;
    var uint8 = new Uint8Array(4);
    var int32 = new Int32Array(uint8.buffer);
    var uint32 = new Uint32Array(uint8.buffer);
    function extractChunks(data) {
      if (data[0] !== 137) throw new Error("Invalid .png file header");
      if (data[1] !== 80) throw new Error("Invalid .png file header");
      if (data[2] !== 78) throw new Error("Invalid .png file header");
      if (data[3] !== 71) throw new Error("Invalid .png file header");
      if (data[4] !== 13) throw new Error("Invalid .png file header: possibly caused by DOS-Unix line ending conversion?");
      if (data[5] !== 10) throw new Error("Invalid .png file header: possibly caused by DOS-Unix line ending conversion?");
      if (data[6] !== 26) throw new Error("Invalid .png file header");
      if (data[7] !== 10) throw new Error("Invalid .png file header: possibly caused by DOS-Unix line ending conversion?");
      var ended = false;
      var chunks = [];
      var idx = 8;
      while (idx < data.length) {
        uint8[3] = data[idx++];
        uint8[2] = data[idx++];
        uint8[1] = data[idx++];
        uint8[0] = data[idx++];
        var length = uint32[0] + 4;
        var chunk = new Uint8Array(length);
        chunk[0] = data[idx++];
        chunk[1] = data[idx++];
        chunk[2] = data[idx++];
        chunk[3] = data[idx++];
        var name = String.fromCharCode(chunk[0]) + String.fromCharCode(chunk[1]) + String.fromCharCode(chunk[2]) + String.fromCharCode(chunk[3]);
        if (!chunks.length && name !== "IHDR") {
          throw new Error("IHDR header missing");
        }
        if (name === "IEND") {
          ended = true;
          chunks.push({
            name,
            data: new Uint8Array(0)
          });
          break;
        }
        for (var i3 = 4; i3 < length; i3++) {
          chunk[i3] = data[idx++];
        }
        uint8[3] = data[idx++];
        uint8[2] = data[idx++];
        uint8[1] = data[idx++];
        uint8[0] = data[idx++];
        var crcActual = int32[0];
        var crcExpect = crc322.buf(chunk);
        if (crcExpect !== crcActual) {
          throw new Error(
            "CRC values for " + name + " header do not match, PNG file is likely corrupted"
          );
        }
        var chunkData = new Uint8Array(chunk.buffer.slice(4));
        chunks.push({
          name,
          data: chunkData
        });
      }
      if (!ended) {
        throw new Error(".png file ended prematurely: no IEND header was found");
      }
      return chunks;
    }
  }
});

// node_modules/.pnpm/png-chunk-text@1.0.0/node_modules/png-chunk-text/encode.js
var require_encode = __commonJS({
  "node_modules/.pnpm/png-chunk-text@1.0.0/node_modules/png-chunk-text/encode.js"(exports, module) {
    module.exports = encode;
    function encode(keyword, content) {
      keyword = String(keyword);
      content = String(content);
      if (!/^[\x00-\xFF]+$/.test(keyword) || !/^[\x00-\xFF]+$/.test(content)) {
        throw new Error("Only Latin-1 characters are permitted in PNG tEXt chunks. You might want to consider base64 encoding and/or zEXt compression");
      }
      if (keyword.length >= 80) {
        throw new Error('Keyword "' + keyword + '" is longer than the 79-character limit imposed by the PNG specification');
      }
      var totalSize = keyword.length + content.length + 1;
      var output = new Uint8Array(totalSize);
      var idx = 0;
      var code;
      for (var i3 = 0; i3 < keyword.length; i3++) {
        if (!(code = keyword.charCodeAt(i3))) {
          throw new Error("0x00 character is not permitted in tEXt keywords");
        }
        output[idx++] = code;
      }
      output[idx++] = 0;
      for (var j = 0; j < content.length; j++) {
        if (!(code = content.charCodeAt(j))) {
          throw new Error("0x00 character is not permitted in tEXt content");
        }
        output[idx++] = code;
      }
      return {
        name: "tEXt",
        data: output
      };
    }
  }
});

// node_modules/.pnpm/png-chunk-text@1.0.0/node_modules/png-chunk-text/decode.js
var require_decode = __commonJS({
  "node_modules/.pnpm/png-chunk-text@1.0.0/node_modules/png-chunk-text/decode.js"(exports, module) {
    module.exports = decode;
    function decode(data) {
      if (data.data && data.name) {
        data = data.data;
      }
      var naming = true;
      var text = "";
      var name = "";
      for (var i3 = 0; i3 < data.length; i3++) {
        var code = data[i3];
        if (naming) {
          if (code) {
            name += String.fromCharCode(code);
          } else {
            naming = false;
          }
        } else {
          if (code) {
            text += String.fromCharCode(code);
          } else {
            throw new Error("Invalid NULL character found. 0x00 character is not permitted in tEXt content");
          }
        }
      }
      return {
        keyword: name,
        text
      };
    }
  }
});

// node_modules/.pnpm/png-chunk-text@1.0.0/node_modules/png-chunk-text/index.js
var require_png_chunk_text = __commonJS({
  "node_modules/.pnpm/png-chunk-text@1.0.0/node_modules/png-chunk-text/index.js"(exports) {
    exports.encode = require_encode();
    exports.decode = require_decode();
  }
});

// node_modules/.pnpm/sliced@1.0.1/node_modules/sliced/index.js
var require_sliced = __commonJS({
  "node_modules/.pnpm/sliced@1.0.1/node_modules/sliced/index.js"(exports, module) {
    module.exports = function(args, slice, sliceEnd) {
      var ret = [];
      var len = args.length;
      if (0 === len) return ret;
      var start = slice < 0 ? Math.max(0, slice + len) : slice || 0;
      if (sliceEnd !== void 0) {
        len = sliceEnd < 0 ? sliceEnd + len : sliceEnd;
      }
      while (len-- > start) {
        ret[len - start] = args[len];
      }
      return ret;
    };
  }
});

// node_modules/.pnpm/png-chunks-encode@1.0.0/node_modules/png-chunks-encode/index.js
var require_png_chunks_encode = __commonJS({
  "node_modules/.pnpm/png-chunks-encode@1.0.0/node_modules/png-chunks-encode/index.js"(exports, module) {
    var sliced = require_sliced();
    var crc322 = require_crc32();
    module.exports = encodeChunks;
    var uint8 = new Uint8Array(4);
    var int32 = new Int32Array(uint8.buffer);
    var uint32 = new Uint32Array(uint8.buffer);
    function encodeChunks(chunks) {
      var totalSize = 8;
      var idx = totalSize;
      var i3;
      for (i3 = 0; i3 < chunks.length; i3++) {
        totalSize += chunks[i3].data.length;
        totalSize += 12;
      }
      var output = new Uint8Array(totalSize);
      output[0] = 137;
      output[1] = 80;
      output[2] = 78;
      output[3] = 71;
      output[4] = 13;
      output[5] = 10;
      output[6] = 26;
      output[7] = 10;
      for (i3 = 0; i3 < chunks.length; i3++) {
        var chunk = chunks[i3];
        var name = chunk.name;
        var data = chunk.data;
        var size = data.length;
        var nameChars = [
          name.charCodeAt(0),
          name.charCodeAt(1),
          name.charCodeAt(2),
          name.charCodeAt(3)
        ];
        uint32[0] = size;
        output[idx++] = uint8[3];
        output[idx++] = uint8[2];
        output[idx++] = uint8[1];
        output[idx++] = uint8[0];
        output[idx++] = nameChars[0];
        output[idx++] = nameChars[1];
        output[idx++] = nameChars[2];
        output[idx++] = nameChars[3];
        for (var j = 0; j < size; ) {
          output[idx++] = data[j++];
        }
        var crcCheck = nameChars.concat(sliced(data));
        var crc = crc322.buf(crcCheck);
        int32[0] = crc;
        output[idx++] = uint8[3];
        output[idx++] = uint8[2];
        output[idx++] = uint8[1];
        output[idx++] = uint8[0];
      }
      return output;
    }
  }
});

// node_modules/.pnpm/es6-promise-pool@2.5.0/node_modules/es6-promise-pool/es6-promise-pool.js
var require_es6_promise_pool = __commonJS({
  "node_modules/.pnpm/es6-promise-pool@2.5.0/node_modules/es6-promise-pool/es6-promise-pool.js"(exports, module) {
    (function(root, factory) {
      if (typeof define === "function" && define.amd) {
        define([], factory);
      } else if (typeof exports === "object") {
        module.exports = factory();
      } else {
        root.PromisePool = factory();
        root.promisePool = root.PromisePool;
      }
    })(exports, function() {
      "use strict";
      var EventTarget = function() {
        this._listeners = {};
      };
      EventTarget.prototype.addEventListener = function(type, listener) {
        this._listeners[type] = this._listeners[type] || [];
        if (this._listeners[type].indexOf(listener) < 0) {
          this._listeners[type].push(listener);
        }
      };
      EventTarget.prototype.removeEventListener = function(type, listener) {
        if (this._listeners[type]) {
          var p = this._listeners[type].indexOf(listener);
          if (p >= 0) {
            this._listeners[type].splice(p, 1);
          }
        }
      };
      EventTarget.prototype.dispatchEvent = function(evt) {
        if (this._listeners[evt.type] && this._listeners[evt.type].length) {
          var listeners = this._listeners[evt.type].slice();
          for (var i3 = 0, l3 = listeners.length; i3 < l3; ++i3) {
            listeners[i3].call(this, evt);
          }
        }
      };
      var isGenerator = function(func) {
        return typeof func.constructor === "function" && func.constructor.name === "GeneratorFunction";
      };
      var functionToIterator = function(func) {
        return {
          next: function() {
            var promise = func();
            return promise ? { value: promise } : { done: true };
          }
        };
      };
      var promiseToIterator = function(promise) {
        var called = false;
        return {
          next: function() {
            if (called) {
              return { done: true };
            }
            called = true;
            return { value: promise };
          }
        };
      };
      var toIterator = function(obj, Promise2) {
        var type = typeof obj;
        if (type === "object") {
          if (typeof obj.next === "function") {
            return obj;
          }
          if (typeof obj.then === "function") {
            return promiseToIterator(obj);
          }
        }
        if (type === "function") {
          return isGenerator(obj) ? obj() : functionToIterator(obj);
        }
        return promiseToIterator(Promise2.resolve(obj));
      };
      var PromisePoolEvent = function(target, type, data) {
        this.target = target;
        this.type = type;
        this.data = data;
      };
      var PromisePool = function(source, concurrency, options) {
        EventTarget.call(this);
        if (typeof concurrency !== "number" || Math.floor(concurrency) !== concurrency || concurrency < 1) {
          throw new Error("Invalid concurrency");
        }
        this._concurrency = concurrency;
        this._options = options || {};
        this._options.promise = this._options.promise || Promise;
        this._iterator = toIterator(source, this._options.promise);
        this._done = false;
        this._size = 0;
        this._promise = null;
        this._callbacks = null;
      };
      PromisePool.prototype = new EventTarget();
      PromisePool.prototype.constructor = PromisePool;
      PromisePool.prototype.concurrency = function(value) {
        if (typeof value !== "undefined") {
          this._concurrency = value;
          if (this.active()) {
            this._proceed();
          }
        }
        return this._concurrency;
      };
      PromisePool.prototype.size = function() {
        return this._size;
      };
      PromisePool.prototype.active = function() {
        return !!this._promise;
      };
      PromisePool.prototype.promise = function() {
        return this._promise;
      };
      PromisePool.prototype.start = function() {
        var that = this;
        var Promise2 = this._options.promise;
        this._promise = new Promise2(function(resolve, reject) {
          that._callbacks = {
            reject,
            resolve
          };
          that._proceed();
        });
        return this._promise;
      };
      PromisePool.prototype._fireEvent = function(type, data) {
        this.dispatchEvent(new PromisePoolEvent(this, type, data));
      };
      PromisePool.prototype._settle = function(error) {
        if (error) {
          this._callbacks.reject(error);
        } else {
          this._callbacks.resolve();
        }
        this._promise = null;
        this._callbacks = null;
      };
      PromisePool.prototype._onPooledPromiseFulfilled = function(promise, result) {
        this._size--;
        if (this.active()) {
          this._fireEvent("fulfilled", {
            promise,
            result
          });
          this._proceed();
        }
      };
      PromisePool.prototype._onPooledPromiseRejected = function(promise, error) {
        this._size--;
        if (this.active()) {
          this._fireEvent("rejected", {
            promise,
            error
          });
          this._settle(error || new Error("Unknown error"));
        }
      };
      PromisePool.prototype._trackPromise = function(promise) {
        var that = this;
        promise.then(function(result) {
          that._onPooledPromiseFulfilled(promise, result);
        }, function(error) {
          that._onPooledPromiseRejected(promise, error);
        })["catch"](function(err2) {
          that._settle(new Error("Promise processing failed: " + err2));
        });
      };
      PromisePool.prototype._proceed = function() {
        if (!this._done) {
          var result = { done: false };
          while (this._size < this._concurrency && !(result = this._iterator.next()).done) {
            this._size++;
            this._trackPromise(result.value);
          }
          this._done = result === null || !!result.done;
        }
        if (this._done && this._size === 0) {
          this._settle();
        }
      };
      PromisePool.PromisePoolEvent = PromisePoolEvent;
      PromisePool.PromisePool = PromisePool;
      return PromisePool;
    });
  }
});

// node_modules/.pnpm/@braintree+sanitize-url@6.0.2/node_modules/@braintree/sanitize-url/dist/index.js
var require_dist = __commonJS({
  "node_modules/.pnpm/@braintree+sanitize-url@6.0.2/node_modules/@braintree/sanitize-url/dist/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.sanitizeUrl = void 0;
    var invalidProtocolRegex = /^([^\w]*)(javascript|data|vbscript)/im;
    var htmlEntitiesRegex = /&#(\w+)(^\w|;)?/g;
    var htmlCtrlEntityRegex = /&(newline|tab);/gi;
    var ctrlCharactersRegex = /[\u0000-\u001F\u007F-\u009F\u2000-\u200D\uFEFF]/gim;
    var urlSchemeRegex = /^.+(:|&colon;)/gim;
    var relativeFirstCharacters = [".", "/"];
    function isRelativeUrlWithoutProtocol(url) {
      return relativeFirstCharacters.indexOf(url[0]) > -1;
    }
    function decodeHtmlCharacters(str) {
      return str.replace(htmlEntitiesRegex, function(match, dec) {
        return String.fromCharCode(dec);
      });
    }
    function sanitizeUrl(url) {
      var sanitizedUrl = decodeHtmlCharacters(url || "").replace(htmlCtrlEntityRegex, "").replace(ctrlCharactersRegex, "").trim();
      if (!sanitizedUrl) {
        return "about:blank";
      }
      if (isRelativeUrlWithoutProtocol(sanitizedUrl)) {
        return sanitizedUrl;
      }
      var urlSchemeParseResults = sanitizedUrl.match(urlSchemeRegex);
      if (!urlSchemeParseResults) {
        return sanitizedUrl;
      }
      var urlScheme = urlSchemeParseResults[0];
      if (invalidProtocolRegex.test(urlScheme)) {
        return "about:blank";
      }
      return sanitizedUrl;
    }
    exports.sanitizeUrl = sanitizeUrl;
  }
});

// node_modules/.pnpm/open-color@1.9.1/node_modules/open-color/open-color.json
var open_color_default = {
  white: "#ffffff",
  black: "#000000",
  gray: [
    "#f8f9fa",
    "#f1f3f5",
    "#e9ecef",
    "#dee2e6",
    "#ced4da",
    "#adb5bd",
    "#868e96",
    "#495057",
    "#343a40",
    "#212529"
  ],
  red: [
    "#fff5f5",
    "#ffe3e3",
    "#ffc9c9",
    "#ffa8a8",
    "#ff8787",
    "#ff6b6b",
    "#fa5252",
    "#f03e3e",
    "#e03131",
    "#c92a2a"
  ],
  pink: [
    "#fff0f6",
    "#ffdeeb",
    "#fcc2d7",
    "#faa2c1",
    "#f783ac",
    "#f06595",
    "#e64980",
    "#d6336c",
    "#c2255c",
    "#a61e4d"
  ],
  grape: [
    "#f8f0fc",
    "#f3d9fa",
    "#eebefa",
    "#e599f7",
    "#da77f2",
    "#cc5de8",
    "#be4bdb",
    "#ae3ec9",
    "#9c36b5",
    "#862e9c"
  ],
  violet: [
    "#f3f0ff",
    "#e5dbff",
    "#d0bfff",
    "#b197fc",
    "#9775fa",
    "#845ef7",
    "#7950f2",
    "#7048e8",
    "#6741d9",
    "#5f3dc4"
  ],
  indigo: [
    "#edf2ff",
    "#dbe4ff",
    "#bac8ff",
    "#91a7ff",
    "#748ffc",
    "#5c7cfa",
    "#4c6ef5",
    "#4263eb",
    "#3b5bdb",
    "#364fc7"
  ],
  blue: [
    "#e7f5ff",
    "#d0ebff",
    "#a5d8ff",
    "#74c0fc",
    "#4dabf7",
    "#339af0",
    "#228be6",
    "#1c7ed6",
    "#1971c2",
    "#1864ab"
  ],
  cyan: [
    "#e3fafc",
    "#c5f6fa",
    "#99e9f2",
    "#66d9e8",
    "#3bc9db",
    "#22b8cf",
    "#15aabf",
    "#1098ad",
    "#0c8599",
    "#0b7285"
  ],
  teal: [
    "#e6fcf5",
    "#c3fae8",
    "#96f2d7",
    "#63e6be",
    "#38d9a9",
    "#20c997",
    "#12b886",
    "#0ca678",
    "#099268",
    "#087f5b"
  ],
  green: [
    "#ebfbee",
    "#d3f9d8",
    "#b2f2bb",
    "#8ce99a",
    "#69db7c",
    "#51cf66",
    "#40c057",
    "#37b24d",
    "#2f9e44",
    "#2b8a3e"
  ],
  lime: [
    "#f4fce3",
    "#e9fac8",
    "#d8f5a2",
    "#c0eb75",
    "#a9e34b",
    "#94d82d",
    "#82c91e",
    "#74b816",
    "#66a80f",
    "#5c940d"
  ],
  yellow: [
    "#fff9db",
    "#fff3bf",
    "#ffec99",
    "#ffe066",
    "#ffd43b",
    "#fcc419",
    "#fab005",
    "#f59f00",
    "#f08c00",
    "#e67700"
  ],
  orange: [
    "#fff4e6",
    "#ffe8cc",
    "#ffd8a8",
    "#ffc078",
    "#ffa94d",
    "#ff922b",
    "#fd7e14",
    "#f76707",
    "#e8590c",
    "#d9480f"
  ]
};

// node_modules/.pnpm/nanoid@3.3.3/node_modules/nanoid/index.browser.js
var nanoid = (size = 21) => crypto.getRandomValues(new Uint8Array(size)).reduce((id2, byte) => {
  byte &= 63;
  if (byte < 36) {
    id2 += byte.toString(36);
  } else if (byte < 62) {
    id2 += (byte - 26).toString(36).toUpperCase();
  } else if (byte > 62) {
    id2 += "-";
  } else {
    id2 += "_";
  }
  return id2;
}, "");

// node_modules/.pnpm/hachure-fill@0.5.2/node_modules/hachure-fill/bin/hachure.js
function rotatePoints(points, center, degrees) {
  if (points && points.length) {
    const [cx, cy2] = center;
    const angle = Math.PI / 180 * degrees;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (const p of points) {
      const [x, y] = p;
      p[0] = (x - cx) * cos - (y - cy2) * sin + cx;
      p[1] = (x - cx) * sin + (y - cy2) * cos + cy2;
    }
  }
}
function rotateLines(lines, center, degrees) {
  const points = [];
  lines.forEach((line2) => points.push(...line2));
  rotatePoints(points, center, degrees);
}
function areSamePoints(p12, p22) {
  return p12[0] === p22[0] && p12[1] === p22[1];
}
function hachureLines(polygons, hachureGap, hachureAngle, hachureStepOffset = 1) {
  const angle = hachureAngle;
  const gap = Math.max(hachureGap, 0.1);
  const polygonList = polygons[0] && polygons[0][0] && typeof polygons[0][0] === "number" ? [polygons] : polygons;
  const rotationCenter = [0, 0];
  if (angle) {
    for (const polygon2 of polygonList) {
      rotatePoints(polygon2, rotationCenter, angle);
    }
  }
  const lines = straightHachureLines(polygonList, gap, hachureStepOffset);
  if (angle) {
    for (const polygon2 of polygonList) {
      rotatePoints(polygon2, rotationCenter, -angle);
    }
    rotateLines(lines, rotationCenter, -angle);
  }
  return lines;
}
function straightHachureLines(polygons, gap, hachureStepOffset) {
  const vertexArray = [];
  for (const polygon2 of polygons) {
    const vertices = [...polygon2];
    if (!areSamePoints(vertices[0], vertices[vertices.length - 1])) {
      vertices.push([vertices[0][0], vertices[0][1]]);
    }
    if (vertices.length > 2) {
      vertexArray.push(vertices);
    }
  }
  const lines = [];
  gap = Math.max(gap, 0.1);
  const edges = [];
  for (const vertices of vertexArray) {
    for (let i3 = 0; i3 < vertices.length - 1; i3++) {
      const p12 = vertices[i3];
      const p22 = vertices[i3 + 1];
      if (p12[1] !== p22[1]) {
        const ymin = Math.min(p12[1], p22[1]);
        edges.push({
          ymin,
          ymax: Math.max(p12[1], p22[1]),
          x: ymin === p12[1] ? p12[0] : p22[0],
          islope: (p22[0] - p12[0]) / (p22[1] - p12[1])
        });
      }
    }
  }
  edges.sort((e12, e23) => {
    if (e12.ymin < e23.ymin) {
      return -1;
    }
    if (e12.ymin > e23.ymin) {
      return 1;
    }
    if (e12.x < e23.x) {
      return -1;
    }
    if (e12.x > e23.x) {
      return 1;
    }
    if (e12.ymax === e23.ymax) {
      return 0;
    }
    return (e12.ymax - e23.ymax) / Math.abs(e12.ymax - e23.ymax);
  });
  if (!edges.length) {
    return lines;
  }
  let activeEdges = [];
  let y = edges[0].ymin;
  let iteration = 0;
  while (activeEdges.length || edges.length) {
    if (edges.length) {
      let ix = -1;
      for (let i3 = 0; i3 < edges.length; i3++) {
        if (edges[i3].ymin > y) {
          break;
        }
        ix = i3;
      }
      const removed = edges.splice(0, ix + 1);
      removed.forEach((edge) => {
        activeEdges.push({ s: y, edge });
      });
    }
    activeEdges = activeEdges.filter((ae3) => {
      if (ae3.edge.ymax <= y) {
        return false;
      }
      return true;
    });
    activeEdges.sort((ae1, ae22) => {
      if (ae1.edge.x === ae22.edge.x) {
        return 0;
      }
      return (ae1.edge.x - ae22.edge.x) / Math.abs(ae1.edge.x - ae22.edge.x);
    });
    if (hachureStepOffset !== 1 || iteration % gap === 0) {
      if (activeEdges.length > 1) {
        for (let i3 = 0; i3 < activeEdges.length; i3 = i3 + 2) {
          const nexti = i3 + 1;
          if (nexti >= activeEdges.length) {
            break;
          }
          const ce2 = activeEdges[i3].edge;
          const ne3 = activeEdges[nexti].edge;
          lines.push([
            [Math.round(ce2.x), y],
            [Math.round(ne3.x), y]
          ]);
        }
      }
    }
    y += hachureStepOffset;
    activeEdges.forEach((ae3) => {
      ae3.edge.x = ae3.edge.x + hachureStepOffset * ae3.edge.islope;
    });
    iteration++;
  }
  return lines;
}

// node_modules/.pnpm/roughjs@4.6.4/node_modules/roughjs/bin/fillers/scan-line-hachure.js
function polygonHachureLines(polygonList, o3) {
  var _a2;
  const angle = o3.hachureAngle + 90;
  let gap = o3.hachureGap;
  if (gap < 0) {
    gap = o3.strokeWidth * 4;
  }
  gap = Math.max(gap, 0.1);
  let skipOffset = 1;
  if (o3.roughness >= 1) {
    if ((((_a2 = o3.randomizer) === null || _a2 === void 0 ? void 0 : _a2.next()) || Math.random()) > 0.7) {
      skipOffset = gap;
    }
  }
  return hachureLines(polygonList, gap, angle, skipOffset || 1);
}

// node_modules/.pnpm/roughjs@4.6.4/node_modules/roughjs/bin/fillers/hachure-filler.js
var HachureFiller = class {
  constructor(helper2) {
    this.helper = helper2;
  }
  fillPolygons(polygonList, o3) {
    return this._fillPolygons(polygonList, o3);
  }
  _fillPolygons(polygonList, o3) {
    const lines = polygonHachureLines(polygonList, o3);
    const ops = this.renderLines(lines, o3);
    return { type: "fillSketch", ops };
  }
  renderLines(lines, o3) {
    const ops = [];
    for (const line2 of lines) {
      ops.push(...this.helper.doubleLineOps(line2[0][0], line2[0][1], line2[1][0], line2[1][1], o3));
    }
    return ops;
  }
};

// node_modules/.pnpm/roughjs@4.6.4/node_modules/roughjs/bin/geometry.js
function lineLength(line2) {
  const p12 = line2[0];
  const p22 = line2[1];
  return Math.sqrt(Math.pow(p12[0] - p22[0], 2) + Math.pow(p12[1] - p22[1], 2));
}

// node_modules/.pnpm/roughjs@4.6.4/node_modules/roughjs/bin/fillers/zigzag-filler.js
var ZigZagFiller = class extends HachureFiller {
  fillPolygons(polygonList, o3) {
    let gap = o3.hachureGap;
    if (gap < 0) {
      gap = o3.strokeWidth * 4;
    }
    gap = Math.max(gap, 0.1);
    const o22 = Object.assign({}, o3, { hachureGap: gap });
    const lines = polygonHachureLines(polygonList, o22);
    const zigZagAngle = Math.PI / 180 * o3.hachureAngle;
    const zigzagLines = [];
    const dgx = gap * 0.5 * Math.cos(zigZagAngle);
    const dgy = gap * 0.5 * Math.sin(zigZagAngle);
    for (const [p12, p22] of lines) {
      if (lineLength([p12, p22])) {
        zigzagLines.push([
          [p12[0] - dgx, p12[1] + dgy],
          [...p22]
        ], [
          [p12[0] + dgx, p12[1] - dgy],
          [...p22]
        ]);
      }
    }
    const ops = this.renderLines(zigzagLines, o3);
    return { type: "fillSketch", ops };
  }
};

// node_modules/.pnpm/roughjs@4.6.4/node_modules/roughjs/bin/fillers/hatch-filler.js
var HatchFiller = class extends HachureFiller {
  fillPolygons(polygonList, o3) {
    const set = this._fillPolygons(polygonList, o3);
    const o22 = Object.assign({}, o3, { hachureAngle: o3.hachureAngle + 90 });
    const set2 = this._fillPolygons(polygonList, o22);
    set.ops = set.ops.concat(set2.ops);
    return set;
  }
};

// node_modules/.pnpm/roughjs@4.6.4/node_modules/roughjs/bin/fillers/dot-filler.js
var DotFiller = class {
  constructor(helper2) {
    this.helper = helper2;
  }
  fillPolygons(polygonList, o3) {
    o3 = Object.assign({}, o3, { hachureAngle: 0 });
    const lines = polygonHachureLines(polygonList, o3);
    return this.dotsOnLines(lines, o3);
  }
  dotsOnLines(lines, o3) {
    const ops = [];
    let gap = o3.hachureGap;
    if (gap < 0) {
      gap = o3.strokeWidth * 4;
    }
    gap = Math.max(gap, 0.1);
    let fweight = o3.fillWeight;
    if (fweight < 0) {
      fweight = o3.strokeWidth / 2;
    }
    const ro2 = gap / 4;
    for (const line2 of lines) {
      const length = lineLength(line2);
      const dl2 = length / gap;
      const count = Math.ceil(dl2) - 1;
      const offset = length - count * gap;
      const x = (line2[0][0] + line2[1][0]) / 2 - gap / 4;
      const minY = Math.min(line2[0][1], line2[1][1]);
      for (let i3 = 0; i3 < count; i3++) {
        const y = minY + offset + i3 * gap;
        const cx = x - ro2 + Math.random() * 2 * ro2;
        const cy2 = y - ro2 + Math.random() * 2 * ro2;
        const el2 = this.helper.ellipse(cx, cy2, fweight, fweight, o3);
        ops.push(...el2.ops);
      }
    }
    return { type: "fillSketch", ops };
  }
};

// node_modules/.pnpm/roughjs@4.6.4/node_modules/roughjs/bin/fillers/dashed-filler.js
var DashedFiller = class {
  constructor(helper2) {
    this.helper = helper2;
  }
  fillPolygons(polygonList, o3) {
    const lines = polygonHachureLines(polygonList, o3);
    return { type: "fillSketch", ops: this.dashedLine(lines, o3) };
  }
  dashedLine(lines, o3) {
    const offset = o3.dashOffset < 0 ? o3.hachureGap < 0 ? o3.strokeWidth * 4 : o3.hachureGap : o3.dashOffset;
    const gap = o3.dashGap < 0 ? o3.hachureGap < 0 ? o3.strokeWidth * 4 : o3.hachureGap : o3.dashGap;
    const ops = [];
    lines.forEach((line2) => {
      const length = lineLength(line2);
      const count = Math.floor(length / (offset + gap));
      const startOffset = (length + gap - count * (offset + gap)) / 2;
      let p12 = line2[0];
      let p22 = line2[1];
      if (p12[0] > p22[0]) {
        p12 = line2[1];
        p22 = line2[0];
      }
      const alpha = Math.atan((p22[1] - p12[1]) / (p22[0] - p12[0]));
      for (let i3 = 0; i3 < count; i3++) {
        const lstart = i3 * (offset + gap);
        const lend = lstart + offset;
        const start = [p12[0] + lstart * Math.cos(alpha) + startOffset * Math.cos(alpha), p12[1] + lstart * Math.sin(alpha) + startOffset * Math.sin(alpha)];
        const end = [p12[0] + lend * Math.cos(alpha) + startOffset * Math.cos(alpha), p12[1] + lend * Math.sin(alpha) + startOffset * Math.sin(alpha)];
        ops.push(...this.helper.doubleLineOps(start[0], start[1], end[0], end[1], o3));
      }
    });
    return ops;
  }
};

// node_modules/.pnpm/roughjs@4.6.4/node_modules/roughjs/bin/fillers/zigzag-line-filler.js
var ZigZagLineFiller = class {
  constructor(helper2) {
    this.helper = helper2;
  }
  fillPolygons(polygonList, o3) {
    const gap = o3.hachureGap < 0 ? o3.strokeWidth * 4 : o3.hachureGap;
    const zo2 = o3.zigzagOffset < 0 ? gap : o3.zigzagOffset;
    o3 = Object.assign({}, o3, { hachureGap: gap + zo2 });
    const lines = polygonHachureLines(polygonList, o3);
    return { type: "fillSketch", ops: this.zigzagLines(lines, zo2, o3) };
  }
  zigzagLines(lines, zo2, o3) {
    const ops = [];
    lines.forEach((line2) => {
      const length = lineLength(line2);
      const count = Math.round(length / (2 * zo2));
      let p12 = line2[0];
      let p22 = line2[1];
      if (p12[0] > p22[0]) {
        p12 = line2[1];
        p22 = line2[0];
      }
      const alpha = Math.atan((p22[1] - p12[1]) / (p22[0] - p12[0]));
      for (let i3 = 0; i3 < count; i3++) {
        const lstart = i3 * 2 * zo2;
        const lend = (i3 + 1) * 2 * zo2;
        const dz = Math.sqrt(2 * Math.pow(zo2, 2));
        const start = [p12[0] + lstart * Math.cos(alpha), p12[1] + lstart * Math.sin(alpha)];
        const end = [p12[0] + lend * Math.cos(alpha), p12[1] + lend * Math.sin(alpha)];
        const middle = [start[0] + dz * Math.cos(alpha + Math.PI / 4), start[1] + dz * Math.sin(alpha + Math.PI / 4)];
        ops.push(...this.helper.doubleLineOps(start[0], start[1], middle[0], middle[1], o3), ...this.helper.doubleLineOps(middle[0], middle[1], end[0], end[1], o3));
      }
    });
    return ops;
  }
};

// node_modules/.pnpm/roughjs@4.6.4/node_modules/roughjs/bin/fillers/filler.js
var fillers = {};
function getFiller(o3, helper2) {
  let fillerName = o3.fillStyle || "hachure";
  if (!fillers[fillerName]) {
    switch (fillerName) {
      case "zigzag":
        if (!fillers[fillerName]) {
          fillers[fillerName] = new ZigZagFiller(helper2);
        }
        break;
      case "cross-hatch":
        if (!fillers[fillerName]) {
          fillers[fillerName] = new HatchFiller(helper2);
        }
        break;
      case "dots":
        if (!fillers[fillerName]) {
          fillers[fillerName] = new DotFiller(helper2);
        }
        break;
      case "dashed":
        if (!fillers[fillerName]) {
          fillers[fillerName] = new DashedFiller(helper2);
        }
        break;
      case "zigzag-line":
        if (!fillers[fillerName]) {
          fillers[fillerName] = new ZigZagLineFiller(helper2);
        }
        break;
      case "hachure":
      default:
        fillerName = "hachure";
        if (!fillers[fillerName]) {
          fillers[fillerName] = new HachureFiller(helper2);
        }
        break;
    }
  }
  return fillers[fillerName];
}

// node_modules/.pnpm/roughjs@4.6.4/node_modules/roughjs/bin/math.js
function randomSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}
var Random = class {
  constructor(seed) {
    this.seed = seed;
  }
  next() {
    if (this.seed) {
      return (2 ** 31 - 1 & (this.seed = Math.imul(48271, this.seed))) / 2 ** 31;
    } else {
      return Math.random();
    }
  }
};

// node_modules/.pnpm/path-data-parser@0.1.0/node_modules/path-data-parser/lib/parser.js
var COMMAND = 0;
var NUMBER = 1;
var EOD = 2;
var PARAMS = { A: 7, a: 7, C: 6, c: 6, H: 1, h: 1, L: 2, l: 2, M: 2, m: 2, Q: 4, q: 4, S: 4, s: 4, T: 2, t: 2, V: 1, v: 1, Z: 0, z: 0 };
function tokenize(d) {
  const tokens = new Array();
  while (d !== "") {
    if (d.match(/^([ \t\r\n,]+)/)) {
      d = d.substr(RegExp.$1.length);
    } else if (d.match(/^([aAcChHlLmMqQsStTvVzZ])/)) {
      tokens[tokens.length] = { type: COMMAND, text: RegExp.$1 };
      d = d.substr(RegExp.$1.length);
    } else if (d.match(/^(([-+]?[0-9]+(\.[0-9]*)?|[-+]?\.[0-9]+)([eE][-+]?[0-9]+)?)/)) {
      tokens[tokens.length] = { type: NUMBER, text: `${parseFloat(RegExp.$1)}` };
      d = d.substr(RegExp.$1.length);
    } else {
      return [];
    }
  }
  tokens[tokens.length] = { type: EOD, text: "" };
  return tokens;
}
function isType(token, type) {
  return token.type === type;
}
function parsePath(d) {
  const segments = [];
  const tokens = tokenize(d);
  let mode = "BOD";
  let index = 0;
  let token = tokens[index];
  while (!isType(token, EOD)) {
    let paramsCount = 0;
    const params = [];
    if (mode === "BOD") {
      if (token.text === "M" || token.text === "m") {
        index++;
        paramsCount = PARAMS[token.text];
        mode = token.text;
      } else {
        return parsePath("M0,0" + d);
      }
    } else if (isType(token, NUMBER)) {
      paramsCount = PARAMS[mode];
    } else {
      index++;
      paramsCount = PARAMS[token.text];
      mode = token.text;
    }
    if (index + paramsCount < tokens.length) {
      for (let i3 = index; i3 < index + paramsCount; i3++) {
        const numbeToken = tokens[i3];
        if (isType(numbeToken, NUMBER)) {
          params[params.length] = +numbeToken.text;
        } else {
          throw new Error("Param not a number: " + mode + "," + numbeToken.text);
        }
      }
      if (typeof PARAMS[mode] === "number") {
        const segment = { key: mode, data: params };
        segments.push(segment);
        index += paramsCount;
        token = tokens[index];
        if (mode === "M")
          mode = "L";
        if (mode === "m")
          mode = "l";
      } else {
        throw new Error("Bad segment: " + mode);
      }
    } else {
      throw new Error("Path data ended short");
    }
  }
  return segments;
}

// node_modules/.pnpm/path-data-parser@0.1.0/node_modules/path-data-parser/lib/absolutize.js
function absolutize(segments) {
  let cx = 0, cy2 = 0;
  let subx = 0, suby = 0;
  const out = [];
  for (const { key, data } of segments) {
    switch (key) {
      case "M":
        out.push({ key: "M", data: [...data] });
        [cx, cy2] = data;
        [subx, suby] = data;
        break;
      case "m":
        cx += data[0];
        cy2 += data[1];
        out.push({ key: "M", data: [cx, cy2] });
        subx = cx;
        suby = cy2;
        break;
      case "L":
        out.push({ key: "L", data: [...data] });
        [cx, cy2] = data;
        break;
      case "l":
        cx += data[0];
        cy2 += data[1];
        out.push({ key: "L", data: [cx, cy2] });
        break;
      case "C":
        out.push({ key: "C", data: [...data] });
        cx = data[4];
        cy2 = data[5];
        break;
      case "c": {
        const newdata = data.map((d, i3) => i3 % 2 ? d + cy2 : d + cx);
        out.push({ key: "C", data: newdata });
        cx = newdata[4];
        cy2 = newdata[5];
        break;
      }
      case "Q":
        out.push({ key: "Q", data: [...data] });
        cx = data[2];
        cy2 = data[3];
        break;
      case "q": {
        const newdata = data.map((d, i3) => i3 % 2 ? d + cy2 : d + cx);
        out.push({ key: "Q", data: newdata });
        cx = newdata[2];
        cy2 = newdata[3];
        break;
      }
      case "A":
        out.push({ key: "A", data: [...data] });
        cx = data[5];
        cy2 = data[6];
        break;
      case "a":
        cx += data[5];
        cy2 += data[6];
        out.push({ key: "A", data: [data[0], data[1], data[2], data[3], data[4], cx, cy2] });
        break;
      case "H":
        out.push({ key: "H", data: [...data] });
        cx = data[0];
        break;
      case "h":
        cx += data[0];
        out.push({ key: "H", data: [cx] });
        break;
      case "V":
        out.push({ key: "V", data: [...data] });
        cy2 = data[0];
        break;
      case "v":
        cy2 += data[0];
        out.push({ key: "V", data: [cy2] });
        break;
      case "S":
        out.push({ key: "S", data: [...data] });
        cx = data[2];
        cy2 = data[3];
        break;
      case "s": {
        const newdata = data.map((d, i3) => i3 % 2 ? d + cy2 : d + cx);
        out.push({ key: "S", data: newdata });
        cx = newdata[2];
        cy2 = newdata[3];
        break;
      }
      case "T":
        out.push({ key: "T", data: [...data] });
        cx = data[0];
        cy2 = data[1];
        break;
      case "t":
        cx += data[0];
        cy2 += data[1];
        out.push({ key: "T", data: [cx, cy2] });
        break;
      case "Z":
      case "z":
        out.push({ key: "Z", data: [] });
        cx = subx;
        cy2 = suby;
        break;
    }
  }
  return out;
}

// node_modules/.pnpm/path-data-parser@0.1.0/node_modules/path-data-parser/lib/normalize.js
function normalize(segments) {
  const out = [];
  let lastType = "";
  let cx = 0, cy2 = 0;
  let subx = 0, suby = 0;
  let lcx = 0, lcy = 0;
  for (const { key, data } of segments) {
    switch (key) {
      case "M":
        out.push({ key: "M", data: [...data] });
        [cx, cy2] = data;
        [subx, suby] = data;
        break;
      case "C":
        out.push({ key: "C", data: [...data] });
        cx = data[4];
        cy2 = data[5];
        lcx = data[2];
        lcy = data[3];
        break;
      case "L":
        out.push({ key: "L", data: [...data] });
        [cx, cy2] = data;
        break;
      case "H":
        cx = data[0];
        out.push({ key: "L", data: [cx, cy2] });
        break;
      case "V":
        cy2 = data[0];
        out.push({ key: "L", data: [cx, cy2] });
        break;
      case "S": {
        let cx1 = 0, cy1 = 0;
        if (lastType === "C" || lastType === "S") {
          cx1 = cx + (cx - lcx);
          cy1 = cy2 + (cy2 - lcy);
        } else {
          cx1 = cx;
          cy1 = cy2;
        }
        out.push({ key: "C", data: [cx1, cy1, ...data] });
        lcx = data[0];
        lcy = data[1];
        cx = data[2];
        cy2 = data[3];
        break;
      }
      case "T": {
        const [x, y] = data;
        let x12 = 0, y12 = 0;
        if (lastType === "Q" || lastType === "T") {
          x12 = cx + (cx - lcx);
          y12 = cy2 + (cy2 - lcy);
        } else {
          x12 = cx;
          y12 = cy2;
        }
        const cx1 = cx + 2 * (x12 - cx) / 3;
        const cy1 = cy2 + 2 * (y12 - cy2) / 3;
        const cx2 = x + 2 * (x12 - x) / 3;
        const cy22 = y + 2 * (y12 - y) / 3;
        out.push({ key: "C", data: [cx1, cy1, cx2, cy22, x, y] });
        lcx = x12;
        lcy = y12;
        cx = x;
        cy2 = y;
        break;
      }
      case "Q": {
        const [x12, y12, x, y] = data;
        const cx1 = cx + 2 * (x12 - cx) / 3;
        const cy1 = cy2 + 2 * (y12 - cy2) / 3;
        const cx2 = x + 2 * (x12 - x) / 3;
        const cy22 = y + 2 * (y12 - y) / 3;
        out.push({ key: "C", data: [cx1, cy1, cx2, cy22, x, y] });
        lcx = x12;
        lcy = y12;
        cx = x;
        cy2 = y;
        break;
      }
      case "A": {
        const r12 = Math.abs(data[0]);
        const r22 = Math.abs(data[1]);
        const angle = data[2];
        const largeArcFlag = data[3];
        const sweepFlag = data[4];
        const x = data[5];
        const y = data[6];
        if (r12 === 0 || r22 === 0) {
          out.push({ key: "C", data: [cx, cy2, x, y, x, y] });
          cx = x;
          cy2 = y;
        } else {
          if (cx !== x || cy2 !== y) {
            const curves = arcToCubicCurves(cx, cy2, x, y, r12, r22, angle, largeArcFlag, sweepFlag);
            curves.forEach(function(curve2) {
              out.push({ key: "C", data: curve2 });
            });
            cx = x;
            cy2 = y;
          }
        }
        break;
      }
      case "Z":
        out.push({ key: "Z", data: [] });
        cx = subx;
        cy2 = suby;
        break;
    }
    lastType = key;
  }
  return out;
}
function degToRad(degrees) {
  return Math.PI * degrees / 180;
}
function rotate(x, y, angleRad) {
  const X3 = x * Math.cos(angleRad) - y * Math.sin(angleRad);
  const Y3 = x * Math.sin(angleRad) + y * Math.cos(angleRad);
  return [X3, Y3];
}
function arcToCubicCurves(x12, y12, x22, y22, r12, r22, angle, largeArcFlag, sweepFlag, recursive) {
  const angleRad = degToRad(angle);
  let params = [];
  let f12 = 0, f22 = 0, cx = 0, cy2 = 0;
  if (recursive) {
    [f12, f22, cx, cy2] = recursive;
  } else {
    [x12, y12] = rotate(x12, y12, -angleRad);
    [x22, y22] = rotate(x22, y22, -angleRad);
    const x = (x12 - x22) / 2;
    const y = (y12 - y22) / 2;
    let h = x * x / (r12 * r12) + y * y / (r22 * r22);
    if (h > 1) {
      h = Math.sqrt(h);
      r12 = h * r12;
      r22 = h * r22;
    }
    const sign = largeArcFlag === sweepFlag ? -1 : 1;
    const r1Pow = r12 * r12;
    const r2Pow = r22 * r22;
    const left = r1Pow * r2Pow - r1Pow * y * y - r2Pow * x * x;
    const right = r1Pow * y * y + r2Pow * x * x;
    const k2 = sign * Math.sqrt(Math.abs(left / right));
    cx = k2 * r12 * y / r22 + (x12 + x22) / 2;
    cy2 = k2 * -r22 * x / r12 + (y12 + y22) / 2;
    f12 = Math.asin(parseFloat(((y12 - cy2) / r22).toFixed(9)));
    f22 = Math.asin(parseFloat(((y22 - cy2) / r22).toFixed(9)));
    if (x12 < cx) {
      f12 = Math.PI - f12;
    }
    if (x22 < cx) {
      f22 = Math.PI - f22;
    }
    if (f12 < 0) {
      f12 = Math.PI * 2 + f12;
    }
    if (f22 < 0) {
      f22 = Math.PI * 2 + f22;
    }
    if (sweepFlag && f12 > f22) {
      f12 = f12 - Math.PI * 2;
    }
    if (!sweepFlag && f22 > f12) {
      f22 = f22 - Math.PI * 2;
    }
  }
  let df2 = f22 - f12;
  if (Math.abs(df2) > Math.PI * 120 / 180) {
    const f2old = f22;
    const x2old = x22;
    const y2old = y22;
    if (sweepFlag && f22 > f12) {
      f22 = f12 + Math.PI * 120 / 180 * 1;
    } else {
      f22 = f12 + Math.PI * 120 / 180 * -1;
    }
    x22 = cx + r12 * Math.cos(f22);
    y22 = cy2 + r22 * Math.sin(f22);
    params = arcToCubicCurves(x22, y22, x2old, y2old, r12, r22, angle, 0, sweepFlag, [f22, f2old, cx, cy2]);
  }
  df2 = f22 - f12;
  const c12 = Math.cos(f12);
  const s12 = Math.sin(f12);
  const c22 = Math.cos(f22);
  const s22 = Math.sin(f22);
  const t3 = Math.tan(df2 / 4);
  const hx2 = 4 / 3 * r12 * t3;
  const hy = 4 / 3 * r22 * t3;
  const m12 = [x12, y12];
  const m22 = [x12 + hx2 * s12, y12 - hy * c12];
  const m3 = [x22 + hx2 * s22, y22 - hy * c22];
  const m42 = [x22, y22];
  m22[0] = 2 * m12[0] - m22[0];
  m22[1] = 2 * m12[1] - m22[1];
  if (recursive) {
    return [m22, m3, m42].concat(params);
  } else {
    params = [m22, m3, m42].concat(params);
    const curves = [];
    for (let i3 = 0; i3 < params.length; i3 += 3) {
      const r13 = rotate(params[i3][0], params[i3][1], angleRad);
      const r23 = rotate(params[i3 + 1][0], params[i3 + 1][1], angleRad);
      const r3 = rotate(params[i3 + 2][0], params[i3 + 2][1], angleRad);
      curves.push([r13[0], r13[1], r23[0], r23[1], r3[0], r3[1]]);
    }
    return curves;
  }
}

// node_modules/.pnpm/roughjs@4.6.4/node_modules/roughjs/bin/renderer.js
var helper = {
  randOffset,
  randOffsetWithRange,
  ellipse,
  doubleLineOps: doubleLineFillOps
};
function line(x12, y12, x22, y22, o3) {
  return { type: "path", ops: _doubleLine(x12, y12, x22, y22, o3) };
}
function linearPath(points, close, o3) {
  const len = (points || []).length;
  if (len > 2) {
    const ops = [];
    for (let i3 = 0; i3 < len - 1; i3++) {
      ops.push(..._doubleLine(points[i3][0], points[i3][1], points[i3 + 1][0], points[i3 + 1][1], o3));
    }
    if (close) {
      ops.push(..._doubleLine(points[len - 1][0], points[len - 1][1], points[0][0], points[0][1], o3));
    }
    return { type: "path", ops };
  } else if (len === 2) {
    return line(points[0][0], points[0][1], points[1][0], points[1][1], o3);
  }
  return { type: "path", ops: [] };
}
function polygon(points, o3) {
  return linearPath(points, true, o3);
}
function rectangle(x, y, width, height, o3) {
  const points = [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height]
  ];
  return polygon(points, o3);
}
function curve(points, o3) {
  let o12 = _curveWithOffset(points, 1 * (1 + o3.roughness * 0.2), o3);
  if (!o3.disableMultiStroke) {
    const o22 = _curveWithOffset(points, 1.5 * (1 + o3.roughness * 0.22), cloneOptionsAlterSeed(o3));
    o12 = o12.concat(o22);
  }
  return { type: "path", ops: o12 };
}
function ellipse(x, y, width, height, o3) {
  const params = generateEllipseParams(width, height, o3);
  return ellipseWithParams(x, y, o3, params).opset;
}
function generateEllipseParams(width, height, o3) {
  const psq = Math.sqrt(Math.PI * 2 * Math.sqrt((Math.pow(width / 2, 2) + Math.pow(height / 2, 2)) / 2));
  const stepCount = Math.ceil(Math.max(o3.curveStepCount, o3.curveStepCount / Math.sqrt(200) * psq));
  const increment = Math.PI * 2 / stepCount;
  let rx = Math.abs(width / 2);
  let ry2 = Math.abs(height / 2);
  const curveFitRandomness = 1 - o3.curveFitting;
  rx += _offsetOpt(rx * curveFitRandomness, o3);
  ry2 += _offsetOpt(ry2 * curveFitRandomness, o3);
  return { increment, rx, ry: ry2 };
}
function ellipseWithParams(x, y, o3, ellipseParams) {
  const [ap1, cp1] = _computeEllipsePoints(ellipseParams.increment, x, y, ellipseParams.rx, ellipseParams.ry, 1, ellipseParams.increment * _offset(0.1, _offset(0.4, 1, o3), o3), o3);
  let o12 = _curve(ap1, null, o3);
  if (!o3.disableMultiStroke && o3.roughness !== 0) {
    const [ap2] = _computeEllipsePoints(ellipseParams.increment, x, y, ellipseParams.rx, ellipseParams.ry, 1.5, 0, o3);
    const o22 = _curve(ap2, null, o3);
    o12 = o12.concat(o22);
  }
  return {
    estimatedPoints: cp1,
    opset: { type: "path", ops: o12 }
  };
}
function arc(x, y, width, height, start, stop, closed, roughClosure, o3) {
  const cx = x;
  const cy2 = y;
  let rx = Math.abs(width / 2);
  let ry2 = Math.abs(height / 2);
  rx += _offsetOpt(rx * 0.01, o3);
  ry2 += _offsetOpt(ry2 * 0.01, o3);
  let strt = start;
  let stp = stop;
  while (strt < 0) {
    strt += Math.PI * 2;
    stp += Math.PI * 2;
  }
  if (stp - strt > Math.PI * 2) {
    strt = 0;
    stp = Math.PI * 2;
  }
  const ellipseInc = Math.PI * 2 / o3.curveStepCount;
  const arcInc = Math.min(ellipseInc / 2, (stp - strt) / 2);
  const ops = _arc(arcInc, cx, cy2, rx, ry2, strt, stp, 1, o3);
  if (!o3.disableMultiStroke) {
    const o22 = _arc(arcInc, cx, cy2, rx, ry2, strt, stp, 1.5, o3);
    ops.push(...o22);
  }
  if (closed) {
    if (roughClosure) {
      ops.push(..._doubleLine(cx, cy2, cx + rx * Math.cos(strt), cy2 + ry2 * Math.sin(strt), o3), ..._doubleLine(cx, cy2, cx + rx * Math.cos(stp), cy2 + ry2 * Math.sin(stp), o3));
    } else {
      ops.push({ op: "lineTo", data: [cx, cy2] }, { op: "lineTo", data: [cx + rx * Math.cos(strt), cy2 + ry2 * Math.sin(strt)] });
    }
  }
  return { type: "path", ops };
}
function svgPath(path, o3) {
  const segments = normalize(absolutize(parsePath(path)));
  const ops = [];
  let first = [0, 0];
  let current = [0, 0];
  for (const { key, data } of segments) {
    switch (key) {
      case "M": {
        current = [data[0], data[1]];
        first = [data[0], data[1]];
        break;
      }
      case "L":
        ops.push(..._doubleLine(current[0], current[1], data[0], data[1], o3));
        current = [data[0], data[1]];
        break;
      case "C": {
        const [x12, y12, x22, y22, x, y] = data;
        ops.push(..._bezierTo(x12, y12, x22, y22, x, y, current, o3));
        current = [x, y];
        break;
      }
      case "Z":
        ops.push(..._doubleLine(current[0], current[1], first[0], first[1], o3));
        current = [first[0], first[1]];
        break;
    }
  }
  return { type: "path", ops };
}
function solidFillPolygon(polygonList, o3) {
  const ops = [];
  for (const points of polygonList) {
    if (points.length) {
      const offset = o3.maxRandomnessOffset || 0;
      const len = points.length;
      if (len > 2) {
        ops.push({ op: "move", data: [points[0][0] + _offsetOpt(offset, o3), points[0][1] + _offsetOpt(offset, o3)] });
        for (let i3 = 1; i3 < len; i3++) {
          ops.push({ op: "lineTo", data: [points[i3][0] + _offsetOpt(offset, o3), points[i3][1] + _offsetOpt(offset, o3)] });
        }
      }
    }
  }
  return { type: "fillPath", ops };
}
function patternFillPolygons(polygonList, o3) {
  return getFiller(o3, helper).fillPolygons(polygonList, o3);
}
function patternFillArc(x, y, width, height, start, stop, o3) {
  const cx = x;
  const cy2 = y;
  let rx = Math.abs(width / 2);
  let ry2 = Math.abs(height / 2);
  rx += _offsetOpt(rx * 0.01, o3);
  ry2 += _offsetOpt(ry2 * 0.01, o3);
  let strt = start;
  let stp = stop;
  while (strt < 0) {
    strt += Math.PI * 2;
    stp += Math.PI * 2;
  }
  if (stp - strt > Math.PI * 2) {
    strt = 0;
    stp = Math.PI * 2;
  }
  const increment = (stp - strt) / o3.curveStepCount;
  const points = [];
  for (let angle = strt; angle <= stp; angle = angle + increment) {
    points.push([cx + rx * Math.cos(angle), cy2 + ry2 * Math.sin(angle)]);
  }
  points.push([cx + rx * Math.cos(stp), cy2 + ry2 * Math.sin(stp)]);
  points.push([cx, cy2]);
  return patternFillPolygons([points], o3);
}
function randOffset(x, o3) {
  return _offsetOpt(x, o3);
}
function randOffsetWithRange(min, max, o3) {
  return _offset(min, max, o3);
}
function doubleLineFillOps(x12, y12, x22, y22, o3) {
  return _doubleLine(x12, y12, x22, y22, o3, true);
}
function cloneOptionsAlterSeed(ops) {
  const result = Object.assign({}, ops);
  result.randomizer = void 0;
  if (ops.seed) {
    result.seed = ops.seed + 1;
  }
  return result;
}
function random(ops) {
  if (!ops.randomizer) {
    ops.randomizer = new Random(ops.seed || 0);
  }
  return ops.randomizer.next();
}
function _offset(min, max, ops, roughnessGain = 1) {
  return ops.roughness * roughnessGain * (random(ops) * (max - min) + min);
}
function _offsetOpt(x, ops, roughnessGain = 1) {
  return _offset(-x, x, ops, roughnessGain);
}
function _doubleLine(x12, y12, x22, y22, o3, filling = false) {
  const singleStroke = filling ? o3.disableMultiStrokeFill : o3.disableMultiStroke;
  const o12 = _line(x12, y12, x22, y22, o3, true, false);
  if (singleStroke) {
    return o12;
  }
  const o22 = _line(x12, y12, x22, y22, o3, true, true);
  return o12.concat(o22);
}
function _line(x12, y12, x22, y22, o3, move, overlay) {
  const lengthSq = Math.pow(x12 - x22, 2) + Math.pow(y12 - y22, 2);
  const length = Math.sqrt(lengthSq);
  let roughnessGain = 1;
  if (length < 200) {
    roughnessGain = 1;
  } else if (length > 500) {
    roughnessGain = 0.4;
  } else {
    roughnessGain = -16668e-7 * length + 1.233334;
  }
  let offset = o3.maxRandomnessOffset || 0;
  if (offset * offset * 100 > lengthSq) {
    offset = length / 10;
  }
  const halfOffset = offset / 2;
  const divergePoint = 0.2 + random(o3) * 0.2;
  let midDispX = o3.bowing * o3.maxRandomnessOffset * (y22 - y12) / 200;
  let midDispY = o3.bowing * o3.maxRandomnessOffset * (x12 - x22) / 200;
  midDispX = _offsetOpt(midDispX, o3, roughnessGain);
  midDispY = _offsetOpt(midDispY, o3, roughnessGain);
  const ops = [];
  const randomHalf = () => _offsetOpt(halfOffset, o3, roughnessGain);
  const randomFull = () => _offsetOpt(offset, o3, roughnessGain);
  const preserveVertices = o3.preserveVertices;
  if (move) {
    if (overlay) {
      ops.push({
        op: "move",
        data: [
          x12 + (preserveVertices ? 0 : randomHalf()),
          y12 + (preserveVertices ? 0 : randomHalf())
        ]
      });
    } else {
      ops.push({
        op: "move",
        data: [
          x12 + (preserveVertices ? 0 : _offsetOpt(offset, o3, roughnessGain)),
          y12 + (preserveVertices ? 0 : _offsetOpt(offset, o3, roughnessGain))
        ]
      });
    }
  }
  if (overlay) {
    ops.push({
      op: "bcurveTo",
      data: [
        midDispX + x12 + (x22 - x12) * divergePoint + randomHalf(),
        midDispY + y12 + (y22 - y12) * divergePoint + randomHalf(),
        midDispX + x12 + 2 * (x22 - x12) * divergePoint + randomHalf(),
        midDispY + y12 + 2 * (y22 - y12) * divergePoint + randomHalf(),
        x22 + (preserveVertices ? 0 : randomHalf()),
        y22 + (preserveVertices ? 0 : randomHalf())
      ]
    });
  } else {
    ops.push({
      op: "bcurveTo",
      data: [
        midDispX + x12 + (x22 - x12) * divergePoint + randomFull(),
        midDispY + y12 + (y22 - y12) * divergePoint + randomFull(),
        midDispX + x12 + 2 * (x22 - x12) * divergePoint + randomFull(),
        midDispY + y12 + 2 * (y22 - y12) * divergePoint + randomFull(),
        x22 + (preserveVertices ? 0 : randomFull()),
        y22 + (preserveVertices ? 0 : randomFull())
      ]
    });
  }
  return ops;
}
function _curveWithOffset(points, offset, o3) {
  const ps2 = [];
  ps2.push([
    points[0][0] + _offsetOpt(offset, o3),
    points[0][1] + _offsetOpt(offset, o3)
  ]);
  ps2.push([
    points[0][0] + _offsetOpt(offset, o3),
    points[0][1] + _offsetOpt(offset, o3)
  ]);
  for (let i3 = 1; i3 < points.length; i3++) {
    ps2.push([
      points[i3][0] + _offsetOpt(offset, o3),
      points[i3][1] + _offsetOpt(offset, o3)
    ]);
    if (i3 === points.length - 1) {
      ps2.push([
        points[i3][0] + _offsetOpt(offset, o3),
        points[i3][1] + _offsetOpt(offset, o3)
      ]);
    }
  }
  return _curve(ps2, null, o3);
}
function _curve(points, closePoint, o3) {
  const len = points.length;
  const ops = [];
  if (len > 3) {
    const b3 = [];
    const s3 = 1 - o3.curveTightness;
    ops.push({ op: "move", data: [points[1][0], points[1][1]] });
    for (let i3 = 1; i3 + 2 < len; i3++) {
      const cachedVertArray = points[i3];
      b3[0] = [cachedVertArray[0], cachedVertArray[1]];
      b3[1] = [cachedVertArray[0] + (s3 * points[i3 + 1][0] - s3 * points[i3 - 1][0]) / 6, cachedVertArray[1] + (s3 * points[i3 + 1][1] - s3 * points[i3 - 1][1]) / 6];
      b3[2] = [points[i3 + 1][0] + (s3 * points[i3][0] - s3 * points[i3 + 2][0]) / 6, points[i3 + 1][1] + (s3 * points[i3][1] - s3 * points[i3 + 2][1]) / 6];
      b3[3] = [points[i3 + 1][0], points[i3 + 1][1]];
      ops.push({ op: "bcurveTo", data: [b3[1][0], b3[1][1], b3[2][0], b3[2][1], b3[3][0], b3[3][1]] });
    }
    if (closePoint && closePoint.length === 2) {
      const ro2 = o3.maxRandomnessOffset;
      ops.push({ op: "lineTo", data: [closePoint[0] + _offsetOpt(ro2, o3), closePoint[1] + _offsetOpt(ro2, o3)] });
    }
  } else if (len === 3) {
    ops.push({ op: "move", data: [points[1][0], points[1][1]] });
    ops.push({
      op: "bcurveTo",
      data: [
        points[1][0],
        points[1][1],
        points[2][0],
        points[2][1],
        points[2][0],
        points[2][1]
      ]
    });
  } else if (len === 2) {
    ops.push(..._doubleLine(points[0][0], points[0][1], points[1][0], points[1][1], o3));
  }
  return ops;
}
function _computeEllipsePoints(increment, cx, cy2, rx, ry2, offset, overlap, o3) {
  const coreOnly = o3.roughness === 0;
  const corePoints = [];
  const allPoints = [];
  if (coreOnly) {
    increment = increment / 4;
    allPoints.push([
      cx + rx * Math.cos(-increment),
      cy2 + ry2 * Math.sin(-increment)
    ]);
    for (let angle = 0; angle <= Math.PI * 2; angle = angle + increment) {
      const p = [
        cx + rx * Math.cos(angle),
        cy2 + ry2 * Math.sin(angle)
      ];
      corePoints.push(p);
      allPoints.push(p);
    }
    allPoints.push([
      cx + rx * Math.cos(0),
      cy2 + ry2 * Math.sin(0)
    ]);
    allPoints.push([
      cx + rx * Math.cos(increment),
      cy2 + ry2 * Math.sin(increment)
    ]);
  } else {
    const radOffset = _offsetOpt(0.5, o3) - Math.PI / 2;
    allPoints.push([
      _offsetOpt(offset, o3) + cx + 0.9 * rx * Math.cos(radOffset - increment),
      _offsetOpt(offset, o3) + cy2 + 0.9 * ry2 * Math.sin(radOffset - increment)
    ]);
    const endAngle = Math.PI * 2 + radOffset - 0.01;
    for (let angle = radOffset; angle < endAngle; angle = angle + increment) {
      const p = [
        _offsetOpt(offset, o3) + cx + rx * Math.cos(angle),
        _offsetOpt(offset, o3) + cy2 + ry2 * Math.sin(angle)
      ];
      corePoints.push(p);
      allPoints.push(p);
    }
    allPoints.push([
      _offsetOpt(offset, o3) + cx + rx * Math.cos(radOffset + Math.PI * 2 + overlap * 0.5),
      _offsetOpt(offset, o3) + cy2 + ry2 * Math.sin(radOffset + Math.PI * 2 + overlap * 0.5)
    ]);
    allPoints.push([
      _offsetOpt(offset, o3) + cx + 0.98 * rx * Math.cos(radOffset + overlap),
      _offsetOpt(offset, o3) + cy2 + 0.98 * ry2 * Math.sin(radOffset + overlap)
    ]);
    allPoints.push([
      _offsetOpt(offset, o3) + cx + 0.9 * rx * Math.cos(radOffset + overlap * 0.5),
      _offsetOpt(offset, o3) + cy2 + 0.9 * ry2 * Math.sin(radOffset + overlap * 0.5)
    ]);
  }
  return [allPoints, corePoints];
}
function _arc(increment, cx, cy2, rx, ry2, strt, stp, offset, o3) {
  const radOffset = strt + _offsetOpt(0.1, o3);
  const points = [];
  points.push([
    _offsetOpt(offset, o3) + cx + 0.9 * rx * Math.cos(radOffset - increment),
    _offsetOpt(offset, o3) + cy2 + 0.9 * ry2 * Math.sin(radOffset - increment)
  ]);
  for (let angle = radOffset; angle <= stp; angle = angle + increment) {
    points.push([
      _offsetOpt(offset, o3) + cx + rx * Math.cos(angle),
      _offsetOpt(offset, o3) + cy2 + ry2 * Math.sin(angle)
    ]);
  }
  points.push([
    cx + rx * Math.cos(stp),
    cy2 + ry2 * Math.sin(stp)
  ]);
  points.push([
    cx + rx * Math.cos(stp),
    cy2 + ry2 * Math.sin(stp)
  ]);
  return _curve(points, null, o3);
}
function _bezierTo(x12, y12, x22, y22, x, y, current, o3) {
  const ops = [];
  const ros = [o3.maxRandomnessOffset || 1, (o3.maxRandomnessOffset || 1) + 0.3];
  let f = [0, 0];
  const iterations = o3.disableMultiStroke ? 1 : 2;
  const preserveVertices = o3.preserveVertices;
  for (let i3 = 0; i3 < iterations; i3++) {
    if (i3 === 0) {
      ops.push({ op: "move", data: [current[0], current[1]] });
    } else {
      ops.push({ op: "move", data: [current[0] + (preserveVertices ? 0 : _offsetOpt(ros[0], o3)), current[1] + (preserveVertices ? 0 : _offsetOpt(ros[0], o3))] });
    }
    f = preserveVertices ? [x, y] : [x + _offsetOpt(ros[i3], o3), y + _offsetOpt(ros[i3], o3)];
    ops.push({
      op: "bcurveTo",
      data: [
        x12 + _offsetOpt(ros[i3], o3),
        y12 + _offsetOpt(ros[i3], o3),
        x22 + _offsetOpt(ros[i3], o3),
        y22 + _offsetOpt(ros[i3], o3),
        f[0],
        f[1]
      ]
    });
  }
  return ops;
}

// node_modules/.pnpm/points-on-curve@0.2.0/node_modules/points-on-curve/lib/curve-to-bezier.js
function clone(p) {
  return [...p];
}
function curveToBezier(pointsIn, curveTightness = 0) {
  const len = pointsIn.length;
  if (len < 3) {
    throw new Error("A curve must have at least three points.");
  }
  const out = [];
  if (len === 3) {
    out.push(clone(pointsIn[0]), clone(pointsIn[1]), clone(pointsIn[2]), clone(pointsIn[2]));
  } else {
    const points = [];
    points.push(pointsIn[0], pointsIn[0]);
    for (let i3 = 1; i3 < pointsIn.length; i3++) {
      points.push(pointsIn[i3]);
      if (i3 === pointsIn.length - 1) {
        points.push(pointsIn[i3]);
      }
    }
    const b3 = [];
    const s3 = 1 - curveTightness;
    out.push(clone(points[0]));
    for (let i3 = 1; i3 + 2 < points.length; i3++) {
      const cachedVertArray = points[i3];
      b3[0] = [cachedVertArray[0], cachedVertArray[1]];
      b3[1] = [cachedVertArray[0] + (s3 * points[i3 + 1][0] - s3 * points[i3 - 1][0]) / 6, cachedVertArray[1] + (s3 * points[i3 + 1][1] - s3 * points[i3 - 1][1]) / 6];
      b3[2] = [points[i3 + 1][0] + (s3 * points[i3][0] - s3 * points[i3 + 2][0]) / 6, points[i3 + 1][1] + (s3 * points[i3][1] - s3 * points[i3 + 2][1]) / 6];
      b3[3] = [points[i3 + 1][0], points[i3 + 1][1]];
      out.push(b3[1], b3[2], b3[3]);
    }
  }
  return out;
}

// node_modules/.pnpm/points-on-curve@0.2.0/node_modules/points-on-curve/lib/index.js
function distance(p12, p22) {
  return Math.sqrt(distanceSq(p12, p22));
}
function distanceSq(p12, p22) {
  return Math.pow(p12[0] - p22[0], 2) + Math.pow(p12[1] - p22[1], 2);
}
function distanceToSegmentSq(p, v, w) {
  const l22 = distanceSq(v, w);
  if (l22 === 0) {
    return distanceSq(p, v);
  }
  let t3 = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l22;
  t3 = Math.max(0, Math.min(1, t3));
  return distanceSq(p, lerp(v, w, t3));
}
function lerp(a3, b3, t3) {
  return [
    a3[0] + (b3[0] - a3[0]) * t3,
    a3[1] + (b3[1] - a3[1]) * t3
  ];
}
function flatness(points, offset) {
  const p12 = points[offset + 0];
  const p22 = points[offset + 1];
  const p3 = points[offset + 2];
  const p42 = points[offset + 3];
  let ux2 = 3 * p22[0] - 2 * p12[0] - p42[0];
  ux2 *= ux2;
  let uy = 3 * p22[1] - 2 * p12[1] - p42[1];
  uy *= uy;
  let vx2 = 3 * p3[0] - 2 * p42[0] - p12[0];
  vx2 *= vx2;
  let vy = 3 * p3[1] - 2 * p42[1] - p12[1];
  vy *= vy;
  if (ux2 < vx2) {
    ux2 = vx2;
  }
  if (uy < vy) {
    uy = vy;
  }
  return ux2 + uy;
}
function getPointsOnBezierCurveWithSplitting(points, offset, tolerance, newPoints) {
  const outPoints = newPoints || [];
  if (flatness(points, offset) < tolerance) {
    const p0 = points[offset + 0];
    if (outPoints.length) {
      const d = distance(outPoints[outPoints.length - 1], p0);
      if (d > 1) {
        outPoints.push(p0);
      }
    } else {
      outPoints.push(p0);
    }
    outPoints.push(points[offset + 3]);
  } else {
    const t3 = 0.5;
    const p12 = points[offset + 0];
    const p22 = points[offset + 1];
    const p3 = points[offset + 2];
    const p42 = points[offset + 3];
    const q12 = lerp(p12, p22, t3);
    const q22 = lerp(p22, p3, t3);
    const q3 = lerp(p3, p42, t3);
    const r12 = lerp(q12, q22, t3);
    const r22 = lerp(q22, q3, t3);
    const red = lerp(r12, r22, t3);
    getPointsOnBezierCurveWithSplitting([p12, q12, r12, red], 0, tolerance, outPoints);
    getPointsOnBezierCurveWithSplitting([red, r22, q3, p42], 0, tolerance, outPoints);
  }
  return outPoints;
}
function simplify(points, distance3) {
  return simplifyPoints(points, 0, points.length, distance3);
}
function simplifyPoints(points, start, end, epsilon, newPoints) {
  const outPoints = newPoints || [];
  const s3 = points[start];
  const e8 = points[end - 1];
  let maxDistSq = 0;
  let maxNdx = 1;
  for (let i3 = start + 1; i3 < end - 1; ++i3) {
    const distSq = distanceToSegmentSq(points[i3], s3, e8);
    if (distSq > maxDistSq) {
      maxDistSq = distSq;
      maxNdx = i3;
    }
  }
  if (Math.sqrt(maxDistSq) > epsilon) {
    simplifyPoints(points, start, maxNdx + 1, epsilon, outPoints);
    simplifyPoints(points, maxNdx, end, epsilon, outPoints);
  } else {
    if (!outPoints.length) {
      outPoints.push(s3);
    }
    outPoints.push(e8);
  }
  return outPoints;
}
function pointsOnBezierCurves(points, tolerance = 0.15, distance3) {
  const newPoints = [];
  const numSegments = (points.length - 1) / 3;
  for (let i3 = 0; i3 < numSegments; i3++) {
    const offset = i3 * 3;
    getPointsOnBezierCurveWithSplitting(points, offset, tolerance, newPoints);
  }
  if (distance3 && distance3 > 0) {
    return simplifyPoints(newPoints, 0, newPoints.length, distance3);
  }
  return newPoints;
}

// node_modules/.pnpm/points-on-path@0.2.1/node_modules/points-on-path/lib/index.js
function pointsOnPath(path, tolerance, distance3) {
  const segments = parsePath(path);
  const normalized = normalize(absolutize(segments));
  const sets = [];
  let currentPoints = [];
  let start = [0, 0];
  let pendingCurve = [];
  const appendPendingCurve = () => {
    if (pendingCurve.length >= 4) {
      currentPoints.push(...pointsOnBezierCurves(pendingCurve, tolerance));
    }
    pendingCurve = [];
  };
  const appendPendingPoints = () => {
    appendPendingCurve();
    if (currentPoints.length) {
      sets.push(currentPoints);
      currentPoints = [];
    }
  };
  for (const { key, data } of normalized) {
    switch (key) {
      case "M":
        appendPendingPoints();
        start = [data[0], data[1]];
        currentPoints.push(start);
        break;
      case "L":
        appendPendingCurve();
        currentPoints.push([data[0], data[1]]);
        break;
      case "C":
        if (!pendingCurve.length) {
          const lastPoint = currentPoints.length ? currentPoints[currentPoints.length - 1] : start;
          pendingCurve.push([lastPoint[0], lastPoint[1]]);
        }
        pendingCurve.push([data[0], data[1]]);
        pendingCurve.push([data[2], data[3]]);
        pendingCurve.push([data[4], data[5]]);
        break;
      case "Z":
        appendPendingCurve();
        currentPoints.push([start[0], start[1]]);
        break;
    }
  }
  appendPendingPoints();
  if (!distance3) {
    return sets;
  }
  const out = [];
  for (const set of sets) {
    const simplifiedSet = simplify(set, distance3);
    if (simplifiedSet.length) {
      out.push(simplifiedSet);
    }
  }
  return out;
}

// node_modules/.pnpm/roughjs@4.6.4/node_modules/roughjs/bin/generator.js
var NOS = "none";
var RoughGenerator = class {
  constructor(config) {
    this.defaultOptions = {
      maxRandomnessOffset: 2,
      roughness: 1,
      bowing: 1,
      stroke: "#000",
      strokeWidth: 1,
      curveTightness: 0,
      curveFitting: 0.95,
      curveStepCount: 9,
      fillStyle: "hachure",
      fillWeight: -1,
      hachureAngle: -41,
      hachureGap: -1,
      dashOffset: -1,
      dashGap: -1,
      zigzagOffset: -1,
      seed: 0,
      disableMultiStroke: false,
      disableMultiStrokeFill: false,
      preserveVertices: false,
      fillShapeRoughnessGain: 0.8
    };
    this.config = config || {};
    if (this.config.options) {
      this.defaultOptions = this._o(this.config.options);
    }
  }
  static newSeed() {
    return randomSeed();
  }
  _o(options) {
    return options ? Object.assign({}, this.defaultOptions, options) : this.defaultOptions;
  }
  _d(shape, sets, options) {
    return { shape, sets: sets || [], options: options || this.defaultOptions };
  }
  line(x12, y12, x22, y22, options) {
    const o3 = this._o(options);
    return this._d("line", [line(x12, y12, x22, y22, o3)], o3);
  }
  rectangle(x, y, width, height, options) {
    const o3 = this._o(options);
    const paths = [];
    const outline = rectangle(x, y, width, height, o3);
    if (o3.fill) {
      const points = [[x, y], [x + width, y], [x + width, y + height], [x, y + height]];
      if (o3.fillStyle === "solid") {
        paths.push(solidFillPolygon([points], o3));
      } else {
        paths.push(patternFillPolygons([points], o3));
      }
    }
    if (o3.stroke !== NOS) {
      paths.push(outline);
    }
    return this._d("rectangle", paths, o3);
  }
  ellipse(x, y, width, height, options) {
    const o3 = this._o(options);
    const paths = [];
    const ellipseParams = generateEllipseParams(width, height, o3);
    const ellipseResponse = ellipseWithParams(x, y, o3, ellipseParams);
    if (o3.fill) {
      if (o3.fillStyle === "solid") {
        const shape = ellipseWithParams(x, y, o3, ellipseParams).opset;
        shape.type = "fillPath";
        paths.push(shape);
      } else {
        paths.push(patternFillPolygons([ellipseResponse.estimatedPoints], o3));
      }
    }
    if (o3.stroke !== NOS) {
      paths.push(ellipseResponse.opset);
    }
    return this._d("ellipse", paths, o3);
  }
  circle(x, y, diameter, options) {
    const ret = this.ellipse(x, y, diameter, diameter, options);
    ret.shape = "circle";
    return ret;
  }
  linearPath(points, options) {
    const o3 = this._o(options);
    return this._d("linearPath", [linearPath(points, false, o3)], o3);
  }
  arc(x, y, width, height, start, stop, closed = false, options) {
    const o3 = this._o(options);
    const paths = [];
    const outline = arc(x, y, width, height, start, stop, closed, true, o3);
    if (closed && o3.fill) {
      if (o3.fillStyle === "solid") {
        const fillOptions = Object.assign({}, o3);
        fillOptions.disableMultiStroke = true;
        const shape = arc(x, y, width, height, start, stop, true, false, fillOptions);
        shape.type = "fillPath";
        paths.push(shape);
      } else {
        paths.push(patternFillArc(x, y, width, height, start, stop, o3));
      }
    }
    if (o3.stroke !== NOS) {
      paths.push(outline);
    }
    return this._d("arc", paths, o3);
  }
  curve(points, options) {
    const o3 = this._o(options);
    const paths = [];
    const outline = curve(points, o3);
    if (o3.fill && o3.fill !== NOS && points.length >= 3) {
      if (o3.fillStyle === "solid") {
        const fillShape = curve(points, Object.assign(Object.assign({}, o3), { disableMultiStroke: true, roughness: o3.roughness ? o3.roughness + o3.fillShapeRoughnessGain : 0 }));
        paths.push({
          type: "fillPath",
          ops: this._mergedShape(fillShape.ops)
        });
      } else {
        const bcurve = curveToBezier(points);
        const polyPoints = pointsOnBezierCurves(bcurve, 10, (1 + o3.roughness) / 2);
        paths.push(patternFillPolygons([polyPoints], o3));
      }
    }
    if (o3.stroke !== NOS) {
      paths.push(outline);
    }
    return this._d("curve", paths, o3);
  }
  polygon(points, options) {
    const o3 = this._o(options);
    const paths = [];
    const outline = linearPath(points, true, o3);
    if (o3.fill) {
      if (o3.fillStyle === "solid") {
        paths.push(solidFillPolygon([points], o3));
      } else {
        paths.push(patternFillPolygons([points], o3));
      }
    }
    if (o3.stroke !== NOS) {
      paths.push(outline);
    }
    return this._d("polygon", paths, o3);
  }
  path(d, options) {
    const o3 = this._o(options);
    const paths = [];
    if (!d) {
      return this._d("path", paths, o3);
    }
    d = (d || "").replace(/\n/g, " ").replace(/(-\s)/g, "-").replace("/(ss)/g", " ");
    const hasFill = o3.fill && o3.fill !== "transparent" && o3.fill !== NOS;
    const hasStroke = o3.stroke !== NOS;
    const simplified = !!(o3.simplification && o3.simplification < 1);
    const distance3 = simplified ? 4 - 4 * (o3.simplification || 1) : (1 + o3.roughness) / 2;
    const sets = pointsOnPath(d, 1, distance3);
    const shape = svgPath(d, o3);
    if (hasFill) {
      if (o3.fillStyle === "solid") {
        if (sets.length === 1) {
          const fillShape = svgPath(d, Object.assign(Object.assign({}, o3), { disableMultiStroke: true, roughness: o3.roughness ? o3.roughness + o3.fillShapeRoughnessGain : 0 }));
          paths.push({
            type: "fillPath",
            ops: this._mergedShape(fillShape.ops)
          });
        } else {
          paths.push(solidFillPolygon(sets, o3));
        }
      } else {
        paths.push(patternFillPolygons(sets, o3));
      }
    }
    if (hasStroke) {
      if (simplified) {
        sets.forEach((set) => {
          paths.push(linearPath(set, false, o3));
        });
      } else {
        paths.push(shape);
      }
    }
    return this._d("path", paths, o3);
  }
  opsToPath(drawing, fixedDecimals) {
    let path = "";
    for (const item of drawing.ops) {
      const data = typeof fixedDecimals === "number" && fixedDecimals >= 0 ? item.data.map((d) => +d.toFixed(fixedDecimals)) : item.data;
      switch (item.op) {
        case "move":
          path += `M${data[0]} ${data[1]} `;
          break;
        case "bcurveTo":
          path += `C${data[0]} ${data[1]}, ${data[2]} ${data[3]}, ${data[4]} ${data[5]} `;
          break;
        case "lineTo":
          path += `L${data[0]} ${data[1]} `;
          break;
      }
    }
    return path.trim();
  }
  toPaths(drawable) {
    const sets = drawable.sets || [];
    const o3 = drawable.options || this.defaultOptions;
    const paths = [];
    for (const drawing of sets) {
      let path = null;
      switch (drawing.type) {
        case "path":
          path = {
            d: this.opsToPath(drawing),
            stroke: o3.stroke,
            strokeWidth: o3.strokeWidth,
            fill: NOS
          };
          break;
        case "fillPath":
          path = {
            d: this.opsToPath(drawing),
            stroke: NOS,
            strokeWidth: 0,
            fill: o3.fill || NOS
          };
          break;
        case "fillSketch":
          path = this.fillSketch(drawing, o3);
          break;
      }
      if (path) {
        paths.push(path);
      }
    }
    return paths;
  }
  fillSketch(drawing, o3) {
    let fweight = o3.fillWeight;
    if (fweight < 0) {
      fweight = o3.strokeWidth / 2;
    }
    return {
      d: this.opsToPath(drawing),
      stroke: o3.fill || NOS,
      strokeWidth: fweight,
      fill: NOS
    };
  }
  _mergedShape(input) {
    return input.filter((d, i3) => {
      if (i3 === 0) {
        return true;
      }
      if (d.op === "move") {
        return false;
      }
      return true;
    });
  }
};

// node_modules/.pnpm/roughjs@4.6.4/node_modules/roughjs/bin/canvas.js
var RoughCanvas = class {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.ctx = this.canvas.getContext("2d");
    this.gen = new RoughGenerator(config);
  }
  draw(drawable) {
    const sets = drawable.sets || [];
    const o3 = drawable.options || this.getDefaultOptions();
    const ctx = this.ctx;
    const precision = drawable.options.fixedDecimalPlaceDigits;
    for (const drawing of sets) {
      switch (drawing.type) {
        case "path":
          ctx.save();
          ctx.strokeStyle = o3.stroke === "none" ? "transparent" : o3.stroke;
          ctx.lineWidth = o3.strokeWidth;
          if (o3.strokeLineDash) {
            ctx.setLineDash(o3.strokeLineDash);
          }
          if (o3.strokeLineDashOffset) {
            ctx.lineDashOffset = o3.strokeLineDashOffset;
          }
          this._drawToContext(ctx, drawing, precision);
          ctx.restore();
          break;
        case "fillPath": {
          ctx.save();
          ctx.fillStyle = o3.fill || "";
          const fillRule = drawable.shape === "curve" || drawable.shape === "polygon" || drawable.shape === "path" ? "evenodd" : "nonzero";
          this._drawToContext(ctx, drawing, precision, fillRule);
          ctx.restore();
          break;
        }
        case "fillSketch":
          this.fillSketch(ctx, drawing, o3);
          break;
      }
    }
  }
  fillSketch(ctx, drawing, o3) {
    let fweight = o3.fillWeight;
    if (fweight < 0) {
      fweight = o3.strokeWidth / 2;
    }
    ctx.save();
    if (o3.fillLineDash) {
      ctx.setLineDash(o3.fillLineDash);
    }
    if (o3.fillLineDashOffset) {
      ctx.lineDashOffset = o3.fillLineDashOffset;
    }
    ctx.strokeStyle = o3.fill || "";
    ctx.lineWidth = fweight;
    this._drawToContext(ctx, drawing, o3.fixedDecimalPlaceDigits);
    ctx.restore();
  }
  _drawToContext(ctx, drawing, fixedDecimals, rule = "nonzero") {
    ctx.beginPath();
    for (const item of drawing.ops) {
      const data = typeof fixedDecimals === "number" && fixedDecimals >= 0 ? item.data.map((d) => +d.toFixed(fixedDecimals)) : item.data;
      switch (item.op) {
        case "move":
          ctx.moveTo(data[0], data[1]);
          break;
        case "bcurveTo":
          ctx.bezierCurveTo(data[0], data[1], data[2], data[3], data[4], data[5]);
          break;
        case "lineTo":
          ctx.lineTo(data[0], data[1]);
          break;
      }
    }
    if (drawing.type === "fillPath") {
      ctx.fill(rule);
    } else {
      ctx.stroke();
    }
  }
  get generator() {
    return this.gen;
  }
  getDefaultOptions() {
    return this.gen.defaultOptions;
  }
  line(x12, y12, x22, y22, options) {
    const d = this.gen.line(x12, y12, x22, y22, options);
    this.draw(d);
    return d;
  }
  rectangle(x, y, width, height, options) {
    const d = this.gen.rectangle(x, y, width, height, options);
    this.draw(d);
    return d;
  }
  ellipse(x, y, width, height, options) {
    const d = this.gen.ellipse(x, y, width, height, options);
    this.draw(d);
    return d;
  }
  circle(x, y, diameter, options) {
    const d = this.gen.circle(x, y, diameter, options);
    this.draw(d);
    return d;
  }
  linearPath(points, options) {
    const d = this.gen.linearPath(points, options);
    this.draw(d);
    return d;
  }
  polygon(points, options) {
    const d = this.gen.polygon(points, options);
    this.draw(d);
    return d;
  }
  arc(x, y, width, height, start, stop, closed = false, options) {
    const d = this.gen.arc(x, y, width, height, start, stop, closed, options);
    this.draw(d);
    return d;
  }
  curve(points, options) {
    const d = this.gen.curve(points, options);
    this.draw(d);
    return d;
  }
  path(d, options) {
    const drawing = this.gen.path(d, options);
    this.draw(drawing);
    return drawing;
  }
};

// node_modules/.pnpm/roughjs@4.6.4/node_modules/roughjs/bin/core.js
var SVGNS = "http://www.w3.org/2000/svg";

// node_modules/.pnpm/roughjs@4.6.4/node_modules/roughjs/bin/svg.js
var RoughSVG = class {
  constructor(svg, config) {
    this.svg = svg;
    this.gen = new RoughGenerator(config);
  }
  draw(drawable) {
    const sets = drawable.sets || [];
    const o3 = drawable.options || this.getDefaultOptions();
    const doc = this.svg.ownerDocument || window.document;
    const g = doc.createElementNS(SVGNS, "g");
    const precision = drawable.options.fixedDecimalPlaceDigits;
    for (const drawing of sets) {
      let path = null;
      switch (drawing.type) {
        case "path": {
          path = doc.createElementNS(SVGNS, "path");
          path.setAttribute("d", this.opsToPath(drawing, precision));
          path.setAttribute("stroke", o3.stroke);
          path.setAttribute("stroke-width", o3.strokeWidth + "");
          path.setAttribute("fill", "none");
          if (o3.strokeLineDash) {
            path.setAttribute("stroke-dasharray", o3.strokeLineDash.join(" ").trim());
          }
          if (o3.strokeLineDashOffset) {
            path.setAttribute("stroke-dashoffset", `${o3.strokeLineDashOffset}`);
          }
          break;
        }
        case "fillPath": {
          path = doc.createElementNS(SVGNS, "path");
          path.setAttribute("d", this.opsToPath(drawing, precision));
          path.setAttribute("stroke", "none");
          path.setAttribute("stroke-width", "0");
          path.setAttribute("fill", o3.fill || "");
          if (drawable.shape === "curve" || drawable.shape === "polygon") {
            path.setAttribute("fill-rule", "evenodd");
          }
          break;
        }
        case "fillSketch": {
          path = this.fillSketch(doc, drawing, o3);
          break;
        }
      }
      if (path) {
        g.appendChild(path);
      }
    }
    return g;
  }
  fillSketch(doc, drawing, o3) {
    let fweight = o3.fillWeight;
    if (fweight < 0) {
      fweight = o3.strokeWidth / 2;
    }
    const path = doc.createElementNS(SVGNS, "path");
    path.setAttribute("d", this.opsToPath(drawing, o3.fixedDecimalPlaceDigits));
    path.setAttribute("stroke", o3.fill || "");
    path.setAttribute("stroke-width", fweight + "");
    path.setAttribute("fill", "none");
    if (o3.fillLineDash) {
      path.setAttribute("stroke-dasharray", o3.fillLineDash.join(" ").trim());
    }
    if (o3.fillLineDashOffset) {
      path.setAttribute("stroke-dashoffset", `${o3.fillLineDashOffset}`);
    }
    return path;
  }
  get generator() {
    return this.gen;
  }
  getDefaultOptions() {
    return this.gen.defaultOptions;
  }
  opsToPath(drawing, fixedDecimalPlaceDigits) {
    return this.gen.opsToPath(drawing, fixedDecimalPlaceDigits);
  }
  line(x12, y12, x22, y22, options) {
    const d = this.gen.line(x12, y12, x22, y22, options);
    return this.draw(d);
  }
  rectangle(x, y, width, height, options) {
    const d = this.gen.rectangle(x, y, width, height, options);
    return this.draw(d);
  }
  ellipse(x, y, width, height, options) {
    const d = this.gen.ellipse(x, y, width, height, options);
    return this.draw(d);
  }
  circle(x, y, diameter, options) {
    const d = this.gen.circle(x, y, diameter, options);
    return this.draw(d);
  }
  linearPath(points, options) {
    const d = this.gen.linearPath(points, options);
    return this.draw(d);
  }
  polygon(points, options) {
    const d = this.gen.polygon(points, options);
    return this.draw(d);
  }
  arc(x, y, width, height, start, stop, closed = false, options) {
    const d = this.gen.arc(x, y, width, height, start, stop, closed, options);
    return this.draw(d);
  }
  curve(points, options) {
    const d = this.gen.curve(points, options);
    return this.draw(d);
  }
  path(d, options) {
    const drawing = this.gen.path(d, options);
    return this.draw(drawing);
  }
};

// node_modules/.pnpm/roughjs@4.6.4/node_modules/roughjs/bin/rough.js
var rough_default = {
  canvas(canvas, config) {
    return new RoughCanvas(canvas, config);
  },
  svg(svg, config) {
    return new RoughSVG(svg, config);
  },
  generator(config) {
    return new RoughGenerator(config);
  },
  newSeed() {
    return RoughGenerator.newSeed();
  }
};

// node_modules/.pnpm/clsx@1.1.1/node_modules/clsx/dist/clsx.m.js
function toVal(mix) {
  var k2, y, str = "";
  if (typeof mix === "string" || typeof mix === "number") {
    str += mix;
  } else if (typeof mix === "object") {
    if (Array.isArray(mix)) {
      for (k2 = 0; k2 < mix.length; k2++) {
        if (mix[k2]) {
          if (y = toVal(mix[k2])) {
            str && (str += " ");
            str += y;
          }
        }
      }
    } else {
      for (k2 in mix) {
        if (mix[k2]) {
          str && (str += " ");
          str += k2;
        }
      }
    }
  }
  return str;
}
function clsx_m_default() {
  var i3 = 0, tmp, x, str = "";
  while (i3 < arguments.length) {
    if (tmp = arguments[i3++]) {
      if (x = toVal(tmp)) {
        str && (str += " ");
        str += x;
      }
    }
  }
  return str;
}

// node_modules/.pnpm/browser-fs-access@0.29.1/node_modules/browser-fs-access/dist/index.mjs
var e = (() => {
  if ("undefined" == typeof self) return false;
  if ("top" in self && self !== top) try {
    top;
  } catch (e8) {
    return false;
  }
  else if ("showOpenFilePicker" in self) return "showOpenFilePicker";
  return false;
})();
var t = e ? import("./file-open-002ab408-S5EGOXX5.js") : import("./file-open-7c801643-LR6NXPGZ.js");
async function n(...e8) {
  return (await t).default(...e8);
}
var i2 = e ? import("./directory-open-4ed118d0-IE2BE6EE.js") : import("./directory-open-01563666-COX3TWIV.js");
var o = e ? import("./file-save-745eba88-3C3DZGGL.js") : import("./file-save-3189631c-XIQIRTZT.js");
async function s(...e8) {
  return (await o).default(...e8);
}

// node_modules/.pnpm/@excalidraw+excalidraw@0.18.1_@types+react-dom@18.3.7_@types+react@18.3.28__@types+reac_35ce6435019f999df7993d08bf01f01f/node_modules/@excalidraw/excalidraw/dist/prod/chunk-K2UTITRG.js
var import_png_chunks_extract = __toESM(require_png_chunks_extract(), 1);
var import_png_chunk_text = __toESM(require_png_chunk_text(), 1);
var import_png_chunks_encode = __toESM(require_png_chunks_encode(), 1);

// node_modules/.pnpm/pako@2.0.3/node_modules/pako/dist/pako.esm.mjs
var Z_FIXED = 4;
var Z_BINARY = 0;
var Z_TEXT = 1;
var Z_UNKNOWN = 2;
function zero(buf) {
  let len = buf.length;
  while (--len >= 0) {
    buf[len] = 0;
  }
}
var STORED_BLOCK = 0;
var STATIC_TREES = 1;
var DYN_TREES = 2;
var MIN_MATCH = 3;
var MAX_MATCH = 258;
var LENGTH_CODES = 29;
var LITERALS = 256;
var L_CODES = LITERALS + 1 + LENGTH_CODES;
var D_CODES = 30;
var BL_CODES = 19;
var HEAP_SIZE = 2 * L_CODES + 1;
var MAX_BITS = 15;
var Buf_size = 16;
var MAX_BL_BITS = 7;
var END_BLOCK = 256;
var REP_3_6 = 16;
var REPZ_3_10 = 17;
var REPZ_11_138 = 18;
var extra_lbits = (
  /* extra bits for each length code */
  new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0])
);
var extra_dbits = (
  /* extra bits for each distance code */
  new Uint8Array([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13])
);
var extra_blbits = (
  /* extra bits for each bit length code */
  new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7])
);
var bl_order = new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var DIST_CODE_LEN = 512;
var static_ltree = new Array((L_CODES + 2) * 2);
zero(static_ltree);
var static_dtree = new Array(D_CODES * 2);
zero(static_dtree);
var _dist_code = new Array(DIST_CODE_LEN);
zero(_dist_code);
var _length_code = new Array(MAX_MATCH - MIN_MATCH + 1);
zero(_length_code);
var base_length = new Array(LENGTH_CODES);
zero(base_length);
var base_dist = new Array(D_CODES);
zero(base_dist);
function StaticTreeDesc(static_tree, extra_bits, extra_base, elems, max_length) {
  this.static_tree = static_tree;
  this.extra_bits = extra_bits;
  this.extra_base = extra_base;
  this.elems = elems;
  this.max_length = max_length;
  this.has_stree = static_tree && static_tree.length;
}
var static_l_desc;
var static_d_desc;
var static_bl_desc;
function TreeDesc(dyn_tree, stat_desc) {
  this.dyn_tree = dyn_tree;
  this.max_code = 0;
  this.stat_desc = stat_desc;
}
var d_code = (dist) => {
  return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)];
};
var put_short = (s3, w) => {
  s3.pending_buf[s3.pending++] = w & 255;
  s3.pending_buf[s3.pending++] = w >>> 8 & 255;
};
var send_bits = (s3, value, length) => {
  if (s3.bi_valid > Buf_size - length) {
    s3.bi_buf |= value << s3.bi_valid & 65535;
    put_short(s3, s3.bi_buf);
    s3.bi_buf = value >> Buf_size - s3.bi_valid;
    s3.bi_valid += length - Buf_size;
  } else {
    s3.bi_buf |= value << s3.bi_valid & 65535;
    s3.bi_valid += length;
  }
};
var send_code = (s3, c3, tree) => {
  send_bits(
    s3,
    tree[c3 * 2],
    tree[c3 * 2 + 1]
    /*.Len*/
  );
};
var bi_reverse = (code, len) => {
  let res = 0;
  do {
    res |= code & 1;
    code >>>= 1;
    res <<= 1;
  } while (--len > 0);
  return res >>> 1;
};
var bi_flush = (s3) => {
  if (s3.bi_valid === 16) {
    put_short(s3, s3.bi_buf);
    s3.bi_buf = 0;
    s3.bi_valid = 0;
  } else if (s3.bi_valid >= 8) {
    s3.pending_buf[s3.pending++] = s3.bi_buf & 255;
    s3.bi_buf >>= 8;
    s3.bi_valid -= 8;
  }
};
var gen_bitlen = (s3, desc) => {
  const tree = desc.dyn_tree;
  const max_code = desc.max_code;
  const stree = desc.stat_desc.static_tree;
  const has_stree = desc.stat_desc.has_stree;
  const extra = desc.stat_desc.extra_bits;
  const base = desc.stat_desc.extra_base;
  const max_length = desc.stat_desc.max_length;
  let h;
  let n3, m;
  let bits;
  let xbits;
  let f;
  let overflow = 0;
  for (bits = 0; bits <= MAX_BITS; bits++) {
    s3.bl_count[bits] = 0;
  }
  tree[s3.heap[s3.heap_max] * 2 + 1] = 0;
  for (h = s3.heap_max + 1; h < HEAP_SIZE; h++) {
    n3 = s3.heap[h];
    bits = tree[tree[n3 * 2 + 1] * 2 + 1] + 1;
    if (bits > max_length) {
      bits = max_length;
      overflow++;
    }
    tree[n3 * 2 + 1] = bits;
    if (n3 > max_code) {
      continue;
    }
    s3.bl_count[bits]++;
    xbits = 0;
    if (n3 >= base) {
      xbits = extra[n3 - base];
    }
    f = tree[n3 * 2];
    s3.opt_len += f * (bits + xbits);
    if (has_stree) {
      s3.static_len += f * (stree[n3 * 2 + 1] + xbits);
    }
  }
  if (overflow === 0) {
    return;
  }
  do {
    bits = max_length - 1;
    while (s3.bl_count[bits] === 0) {
      bits--;
    }
    s3.bl_count[bits]--;
    s3.bl_count[bits + 1] += 2;
    s3.bl_count[max_length]--;
    overflow -= 2;
  } while (overflow > 0);
  for (bits = max_length; bits !== 0; bits--) {
    n3 = s3.bl_count[bits];
    while (n3 !== 0) {
      m = s3.heap[--h];
      if (m > max_code) {
        continue;
      }
      if (tree[m * 2 + 1] !== bits) {
        s3.opt_len += (bits - tree[m * 2 + 1]) * tree[m * 2];
        tree[m * 2 + 1] = bits;
      }
      n3--;
    }
  }
};
var gen_codes = (tree, max_code, bl_count) => {
  const next_code = new Array(MAX_BITS + 1);
  let code = 0;
  let bits;
  let n3;
  for (bits = 1; bits <= MAX_BITS; bits++) {
    next_code[bits] = code = code + bl_count[bits - 1] << 1;
  }
  for (n3 = 0; n3 <= max_code; n3++) {
    let len = tree[n3 * 2 + 1];
    if (len === 0) {
      continue;
    }
    tree[n3 * 2] = bi_reverse(next_code[len]++, len);
  }
};
var tr_static_init = () => {
  let n3;
  let bits;
  let length;
  let code;
  let dist;
  const bl_count = new Array(MAX_BITS + 1);
  length = 0;
  for (code = 0; code < LENGTH_CODES - 1; code++) {
    base_length[code] = length;
    for (n3 = 0; n3 < 1 << extra_lbits[code]; n3++) {
      _length_code[length++] = code;
    }
  }
  _length_code[length - 1] = code;
  dist = 0;
  for (code = 0; code < 16; code++) {
    base_dist[code] = dist;
    for (n3 = 0; n3 < 1 << extra_dbits[code]; n3++) {
      _dist_code[dist++] = code;
    }
  }
  dist >>= 7;
  for (; code < D_CODES; code++) {
    base_dist[code] = dist << 7;
    for (n3 = 0; n3 < 1 << extra_dbits[code] - 7; n3++) {
      _dist_code[256 + dist++] = code;
    }
  }
  for (bits = 0; bits <= MAX_BITS; bits++) {
    bl_count[bits] = 0;
  }
  n3 = 0;
  while (n3 <= 143) {
    static_ltree[n3 * 2 + 1] = 8;
    n3++;
    bl_count[8]++;
  }
  while (n3 <= 255) {
    static_ltree[n3 * 2 + 1] = 9;
    n3++;
    bl_count[9]++;
  }
  while (n3 <= 279) {
    static_ltree[n3 * 2 + 1] = 7;
    n3++;
    bl_count[7]++;
  }
  while (n3 <= 287) {
    static_ltree[n3 * 2 + 1] = 8;
    n3++;
    bl_count[8]++;
  }
  gen_codes(static_ltree, L_CODES + 1, bl_count);
  for (n3 = 0; n3 < D_CODES; n3++) {
    static_dtree[n3 * 2 + 1] = 5;
    static_dtree[n3 * 2] = bi_reverse(n3, 5);
  }
  static_l_desc = new StaticTreeDesc(static_ltree, extra_lbits, LITERALS + 1, L_CODES, MAX_BITS);
  static_d_desc = new StaticTreeDesc(static_dtree, extra_dbits, 0, D_CODES, MAX_BITS);
  static_bl_desc = new StaticTreeDesc(new Array(0), extra_blbits, 0, BL_CODES, MAX_BL_BITS);
};
var init_block = (s3) => {
  let n3;
  for (n3 = 0; n3 < L_CODES; n3++) {
    s3.dyn_ltree[n3 * 2] = 0;
  }
  for (n3 = 0; n3 < D_CODES; n3++) {
    s3.dyn_dtree[n3 * 2] = 0;
  }
  for (n3 = 0; n3 < BL_CODES; n3++) {
    s3.bl_tree[n3 * 2] = 0;
  }
  s3.dyn_ltree[END_BLOCK * 2] = 1;
  s3.opt_len = s3.static_len = 0;
  s3.last_lit = s3.matches = 0;
};
var bi_windup = (s3) => {
  if (s3.bi_valid > 8) {
    put_short(s3, s3.bi_buf);
  } else if (s3.bi_valid > 0) {
    s3.pending_buf[s3.pending++] = s3.bi_buf;
  }
  s3.bi_buf = 0;
  s3.bi_valid = 0;
};
var copy_block = (s3, buf, len, header) => {
  bi_windup(s3);
  if (header) {
    put_short(s3, len);
    put_short(s3, ~len);
  }
  s3.pending_buf.set(s3.window.subarray(buf, buf + len), s3.pending);
  s3.pending += len;
};
var smaller = (tree, n3, m, depth) => {
  const _n2 = n3 * 2;
  const _m2 = m * 2;
  return tree[_n2] < tree[_m2] || tree[_n2] === tree[_m2] && depth[n3] <= depth[m];
};
var pqdownheap = (s3, tree, k2) => {
  const v = s3.heap[k2];
  let j = k2 << 1;
  while (j <= s3.heap_len) {
    if (j < s3.heap_len && smaller(tree, s3.heap[j + 1], s3.heap[j], s3.depth)) {
      j++;
    }
    if (smaller(tree, v, s3.heap[j], s3.depth)) {
      break;
    }
    s3.heap[k2] = s3.heap[j];
    k2 = j;
    j <<= 1;
  }
  s3.heap[k2] = v;
};
var compress_block = (s3, ltree, dtree) => {
  let dist;
  let lc2;
  let lx2 = 0;
  let code;
  let extra;
  if (s3.last_lit !== 0) {
    do {
      dist = s3.pending_buf[s3.d_buf + lx2 * 2] << 8 | s3.pending_buf[s3.d_buf + lx2 * 2 + 1];
      lc2 = s3.pending_buf[s3.l_buf + lx2];
      lx2++;
      if (dist === 0) {
        send_code(s3, lc2, ltree);
      } else {
        code = _length_code[lc2];
        send_code(s3, code + LITERALS + 1, ltree);
        extra = extra_lbits[code];
        if (extra !== 0) {
          lc2 -= base_length[code];
          send_bits(s3, lc2, extra);
        }
        dist--;
        code = d_code(dist);
        send_code(s3, code, dtree);
        extra = extra_dbits[code];
        if (extra !== 0) {
          dist -= base_dist[code];
          send_bits(s3, dist, extra);
        }
      }
    } while (lx2 < s3.last_lit);
  }
  send_code(s3, END_BLOCK, ltree);
};
var build_tree = (s3, desc) => {
  const tree = desc.dyn_tree;
  const stree = desc.stat_desc.static_tree;
  const has_stree = desc.stat_desc.has_stree;
  const elems = desc.stat_desc.elems;
  let n3, m;
  let max_code = -1;
  let node;
  s3.heap_len = 0;
  s3.heap_max = HEAP_SIZE;
  for (n3 = 0; n3 < elems; n3++) {
    if (tree[n3 * 2] !== 0) {
      s3.heap[++s3.heap_len] = max_code = n3;
      s3.depth[n3] = 0;
    } else {
      tree[n3 * 2 + 1] = 0;
    }
  }
  while (s3.heap_len < 2) {
    node = s3.heap[++s3.heap_len] = max_code < 2 ? ++max_code : 0;
    tree[node * 2] = 1;
    s3.depth[node] = 0;
    s3.opt_len--;
    if (has_stree) {
      s3.static_len -= stree[node * 2 + 1];
    }
  }
  desc.max_code = max_code;
  for (n3 = s3.heap_len >> 1; n3 >= 1; n3--) {
    pqdownheap(s3, tree, n3);
  }
  node = elems;
  do {
    n3 = s3.heap[
      1
      /*SMALLEST*/
    ];
    s3.heap[
      1
      /*SMALLEST*/
    ] = s3.heap[s3.heap_len--];
    pqdownheap(
      s3,
      tree,
      1
      /*SMALLEST*/
    );
    m = s3.heap[
      1
      /*SMALLEST*/
    ];
    s3.heap[--s3.heap_max] = n3;
    s3.heap[--s3.heap_max] = m;
    tree[node * 2] = tree[n3 * 2] + tree[m * 2];
    s3.depth[node] = (s3.depth[n3] >= s3.depth[m] ? s3.depth[n3] : s3.depth[m]) + 1;
    tree[n3 * 2 + 1] = tree[m * 2 + 1] = node;
    s3.heap[
      1
      /*SMALLEST*/
    ] = node++;
    pqdownheap(
      s3,
      tree,
      1
      /*SMALLEST*/
    );
  } while (s3.heap_len >= 2);
  s3.heap[--s3.heap_max] = s3.heap[
    1
    /*SMALLEST*/
  ];
  gen_bitlen(s3, desc);
  gen_codes(tree, max_code, s3.bl_count);
};
var scan_tree = (s3, tree, max_code) => {
  let n3;
  let prevlen = -1;
  let curlen;
  let nextlen = tree[0 * 2 + 1];
  let count = 0;
  let max_count = 7;
  let min_count = 4;
  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }
  tree[(max_code + 1) * 2 + 1] = 65535;
  for (n3 = 0; n3 <= max_code; n3++) {
    curlen = nextlen;
    nextlen = tree[(n3 + 1) * 2 + 1];
    if (++count < max_count && curlen === nextlen) {
      continue;
    } else if (count < min_count) {
      s3.bl_tree[curlen * 2] += count;
    } else if (curlen !== 0) {
      if (curlen !== prevlen) {
        s3.bl_tree[curlen * 2]++;
      }
      s3.bl_tree[REP_3_6 * 2]++;
    } else if (count <= 10) {
      s3.bl_tree[REPZ_3_10 * 2]++;
    } else {
      s3.bl_tree[REPZ_11_138 * 2]++;
    }
    count = 0;
    prevlen = curlen;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;
    } else {
      max_count = 7;
      min_count = 4;
    }
  }
};
var send_tree = (s3, tree, max_code) => {
  let n3;
  let prevlen = -1;
  let curlen;
  let nextlen = tree[0 * 2 + 1];
  let count = 0;
  let max_count = 7;
  let min_count = 4;
  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }
  for (n3 = 0; n3 <= max_code; n3++) {
    curlen = nextlen;
    nextlen = tree[(n3 + 1) * 2 + 1];
    if (++count < max_count && curlen === nextlen) {
      continue;
    } else if (count < min_count) {
      do {
        send_code(s3, curlen, s3.bl_tree);
      } while (--count !== 0);
    } else if (curlen !== 0) {
      if (curlen !== prevlen) {
        send_code(s3, curlen, s3.bl_tree);
        count--;
      }
      send_code(s3, REP_3_6, s3.bl_tree);
      send_bits(s3, count - 3, 2);
    } else if (count <= 10) {
      send_code(s3, REPZ_3_10, s3.bl_tree);
      send_bits(s3, count - 3, 3);
    } else {
      send_code(s3, REPZ_11_138, s3.bl_tree);
      send_bits(s3, count - 11, 7);
    }
    count = 0;
    prevlen = curlen;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;
    } else {
      max_count = 7;
      min_count = 4;
    }
  }
};
var build_bl_tree = (s3) => {
  let max_blindex;
  scan_tree(s3, s3.dyn_ltree, s3.l_desc.max_code);
  scan_tree(s3, s3.dyn_dtree, s3.d_desc.max_code);
  build_tree(s3, s3.bl_desc);
  for (max_blindex = BL_CODES - 1; max_blindex >= 3; max_blindex--) {
    if (s3.bl_tree[bl_order[max_blindex] * 2 + 1] !== 0) {
      break;
    }
  }
  s3.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;
  return max_blindex;
};
var send_all_trees = (s3, lcodes, dcodes, blcodes) => {
  let rank2;
  send_bits(s3, lcodes - 257, 5);
  send_bits(s3, dcodes - 1, 5);
  send_bits(s3, blcodes - 4, 4);
  for (rank2 = 0; rank2 < blcodes; rank2++) {
    send_bits(s3, s3.bl_tree[bl_order[rank2] * 2 + 1], 3);
  }
  send_tree(s3, s3.dyn_ltree, lcodes - 1);
  send_tree(s3, s3.dyn_dtree, dcodes - 1);
};
var detect_data_type = (s3) => {
  let black_mask = 4093624447;
  let n3;
  for (n3 = 0; n3 <= 31; n3++, black_mask >>>= 1) {
    if (black_mask & 1 && s3.dyn_ltree[n3 * 2] !== 0) {
      return Z_BINARY;
    }
  }
  if (s3.dyn_ltree[9 * 2] !== 0 || s3.dyn_ltree[10 * 2] !== 0 || s3.dyn_ltree[13 * 2] !== 0) {
    return Z_TEXT;
  }
  for (n3 = 32; n3 < LITERALS; n3++) {
    if (s3.dyn_ltree[n3 * 2] !== 0) {
      return Z_TEXT;
    }
  }
  return Z_BINARY;
};
var static_init_done = false;
var _tr_init = (s3) => {
  if (!static_init_done) {
    tr_static_init();
    static_init_done = true;
  }
  s3.l_desc = new TreeDesc(s3.dyn_ltree, static_l_desc);
  s3.d_desc = new TreeDesc(s3.dyn_dtree, static_d_desc);
  s3.bl_desc = new TreeDesc(s3.bl_tree, static_bl_desc);
  s3.bi_buf = 0;
  s3.bi_valid = 0;
  init_block(s3);
};
var _tr_stored_block = (s3, buf, stored_len, last) => {
  send_bits(s3, (STORED_BLOCK << 1) + (last ? 1 : 0), 3);
  copy_block(s3, buf, stored_len, true);
};
var _tr_align = (s3) => {
  send_bits(s3, STATIC_TREES << 1, 3);
  send_code(s3, END_BLOCK, static_ltree);
  bi_flush(s3);
};
var _tr_flush_block = (s3, buf, stored_len, last) => {
  let opt_lenb, static_lenb;
  let max_blindex = 0;
  if (s3.level > 0) {
    if (s3.strm.data_type === Z_UNKNOWN) {
      s3.strm.data_type = detect_data_type(s3);
    }
    build_tree(s3, s3.l_desc);
    build_tree(s3, s3.d_desc);
    max_blindex = build_bl_tree(s3);
    opt_lenb = s3.opt_len + 3 + 7 >>> 3;
    static_lenb = s3.static_len + 3 + 7 >>> 3;
    if (static_lenb <= opt_lenb) {
      opt_lenb = static_lenb;
    }
  } else {
    opt_lenb = static_lenb = stored_len + 5;
  }
  if (stored_len + 4 <= opt_lenb && buf !== -1) {
    _tr_stored_block(s3, buf, stored_len, last);
  } else if (s3.strategy === Z_FIXED || static_lenb === opt_lenb) {
    send_bits(s3, (STATIC_TREES << 1) + (last ? 1 : 0), 3);
    compress_block(s3, static_ltree, static_dtree);
  } else {
    send_bits(s3, (DYN_TREES << 1) + (last ? 1 : 0), 3);
    send_all_trees(s3, s3.l_desc.max_code + 1, s3.d_desc.max_code + 1, max_blindex + 1);
    compress_block(s3, s3.dyn_ltree, s3.dyn_dtree);
  }
  init_block(s3);
  if (last) {
    bi_windup(s3);
  }
};
var _tr_tally = (s3, dist, lc2) => {
  s3.pending_buf[s3.d_buf + s3.last_lit * 2] = dist >>> 8 & 255;
  s3.pending_buf[s3.d_buf + s3.last_lit * 2 + 1] = dist & 255;
  s3.pending_buf[s3.l_buf + s3.last_lit] = lc2 & 255;
  s3.last_lit++;
  if (dist === 0) {
    s3.dyn_ltree[lc2 * 2]++;
  } else {
    s3.matches++;
    dist--;
    s3.dyn_ltree[(_length_code[lc2] + LITERALS + 1) * 2]++;
    s3.dyn_dtree[d_code(dist) * 2]++;
  }
  return s3.last_lit === s3.lit_bufsize - 1;
};
var _tr_init_1 = _tr_init;
var _tr_stored_block_1 = _tr_stored_block;
var _tr_flush_block_1 = _tr_flush_block;
var _tr_tally_1 = _tr_tally;
var _tr_align_1 = _tr_align;
var trees = {
  _tr_init: _tr_init_1,
  _tr_stored_block: _tr_stored_block_1,
  _tr_flush_block: _tr_flush_block_1,
  _tr_tally: _tr_tally_1,
  _tr_align: _tr_align_1
};
var adler32 = (adler, buf, len, pos) => {
  let s12 = adler & 65535 | 0, s22 = adler >>> 16 & 65535 | 0, n3 = 0;
  while (len !== 0) {
    n3 = len > 2e3 ? 2e3 : len;
    len -= n3;
    do {
      s12 = s12 + buf[pos++] | 0;
      s22 = s22 + s12 | 0;
    } while (--n3);
    s12 %= 65521;
    s22 %= 65521;
  }
  return s12 | s22 << 16 | 0;
};
var adler32_1 = adler32;
var makeTable = () => {
  let c3, table = [];
  for (var n3 = 0; n3 < 256; n3++) {
    c3 = n3;
    for (var k2 = 0; k2 < 8; k2++) {
      c3 = c3 & 1 ? 3988292384 ^ c3 >>> 1 : c3 >>> 1;
    }
    table[n3] = c3;
  }
  return table;
};
var crcTable = new Uint32Array(makeTable());
var crc32 = (crc, buf, len, pos) => {
  const t3 = crcTable;
  const end = pos + len;
  crc ^= -1;
  for (let i3 = pos; i3 < end; i3++) {
    crc = crc >>> 8 ^ t3[(crc ^ buf[i3]) & 255];
  }
  return crc ^ -1;
};
var crc32_1 = crc32;
var messages = {
  2: "need dictionary",
  /* Z_NEED_DICT       2  */
  1: "stream end",
  /* Z_STREAM_END      1  */
  0: "",
  /* Z_OK              0  */
  "-1": "file error",
  /* Z_ERRNO         (-1) */
  "-2": "stream error",
  /* Z_STREAM_ERROR  (-2) */
  "-3": "data error",
  /* Z_DATA_ERROR    (-3) */
  "-4": "insufficient memory",
  /* Z_MEM_ERROR     (-4) */
  "-5": "buffer error",
  /* Z_BUF_ERROR     (-5) */
  "-6": "incompatible version"
  /* Z_VERSION_ERROR (-6) */
};
var constants = {
  /* Allowed flush values; see deflate() and inflate() below for details */
  Z_NO_FLUSH: 0,
  Z_PARTIAL_FLUSH: 1,
  Z_SYNC_FLUSH: 2,
  Z_FULL_FLUSH: 3,
  Z_FINISH: 4,
  Z_BLOCK: 5,
  Z_TREES: 6,
  /* Return codes for the compression/decompression functions. Negative values
  * are errors, positive values are used for special but normal events.
  */
  Z_OK: 0,
  Z_STREAM_END: 1,
  Z_NEED_DICT: 2,
  Z_ERRNO: -1,
  Z_STREAM_ERROR: -2,
  Z_DATA_ERROR: -3,
  Z_MEM_ERROR: -4,
  Z_BUF_ERROR: -5,
  //Z_VERSION_ERROR: -6,
  /* compression levels */
  Z_NO_COMPRESSION: 0,
  Z_BEST_SPEED: 1,
  Z_BEST_COMPRESSION: 9,
  Z_DEFAULT_COMPRESSION: -1,
  Z_FILTERED: 1,
  Z_HUFFMAN_ONLY: 2,
  Z_RLE: 3,
  Z_FIXED: 4,
  Z_DEFAULT_STRATEGY: 0,
  /* Possible values of the data_type field (though see inflate()) */
  Z_BINARY: 0,
  Z_TEXT: 1,
  //Z_ASCII:                1, // = Z_TEXT (deprecated)
  Z_UNKNOWN: 2,
  /* The deflate compression method */
  Z_DEFLATED: 8
  //Z_NULL:                 null // Use -1 or null inline, depending on var type
};
var { _tr_init: _tr_init$1, _tr_stored_block: _tr_stored_block$1, _tr_flush_block: _tr_flush_block$1, _tr_tally: _tr_tally$1, _tr_align: _tr_align$1 } = trees;
var {
  Z_NO_FLUSH,
  Z_PARTIAL_FLUSH,
  Z_FULL_FLUSH,
  Z_FINISH,
  Z_BLOCK,
  Z_OK,
  Z_STREAM_END,
  Z_STREAM_ERROR,
  Z_DATA_ERROR,
  Z_BUF_ERROR,
  Z_DEFAULT_COMPRESSION,
  Z_FILTERED,
  Z_HUFFMAN_ONLY,
  Z_RLE,
  Z_FIXED: Z_FIXED$1,
  Z_DEFAULT_STRATEGY,
  Z_UNKNOWN: Z_UNKNOWN$1,
  Z_DEFLATED
} = constants;
var MAX_MEM_LEVEL = 9;
var MAX_WBITS = 15;
var DEF_MEM_LEVEL = 8;
var LENGTH_CODES$1 = 29;
var LITERALS$1 = 256;
var L_CODES$1 = LITERALS$1 + 1 + LENGTH_CODES$1;
var D_CODES$1 = 30;
var BL_CODES$1 = 19;
var HEAP_SIZE$1 = 2 * L_CODES$1 + 1;
var MAX_BITS$1 = 15;
var MIN_MATCH$1 = 3;
var MAX_MATCH$1 = 258;
var MIN_LOOKAHEAD = MAX_MATCH$1 + MIN_MATCH$1 + 1;
var PRESET_DICT = 32;
var INIT_STATE = 42;
var EXTRA_STATE = 69;
var NAME_STATE = 73;
var COMMENT_STATE = 91;
var HCRC_STATE = 103;
var BUSY_STATE = 113;
var FINISH_STATE = 666;
var BS_NEED_MORE = 1;
var BS_BLOCK_DONE = 2;
var BS_FINISH_STARTED = 3;
var BS_FINISH_DONE = 4;
var OS_CODE = 3;
var err = (strm, errorCode) => {
  strm.msg = messages[errorCode];
  return errorCode;
};
var rank = (f) => {
  return (f << 1) - (f > 4 ? 9 : 0);
};
var zero$1 = (buf) => {
  let len = buf.length;
  while (--len >= 0) {
    buf[len] = 0;
  }
};
var HASH_ZLIB = (s3, prev, data) => (prev << s3.hash_shift ^ data) & s3.hash_mask;
var HASH = HASH_ZLIB;
var flush_pending = (strm) => {
  const s3 = strm.state;
  let len = s3.pending;
  if (len > strm.avail_out) {
    len = strm.avail_out;
  }
  if (len === 0) {
    return;
  }
  strm.output.set(s3.pending_buf.subarray(s3.pending_out, s3.pending_out + len), strm.next_out);
  strm.next_out += len;
  s3.pending_out += len;
  strm.total_out += len;
  strm.avail_out -= len;
  s3.pending -= len;
  if (s3.pending === 0) {
    s3.pending_out = 0;
  }
};
var flush_block_only = (s3, last) => {
  _tr_flush_block$1(s3, s3.block_start >= 0 ? s3.block_start : -1, s3.strstart - s3.block_start, last);
  s3.block_start = s3.strstart;
  flush_pending(s3.strm);
};
var put_byte = (s3, b3) => {
  s3.pending_buf[s3.pending++] = b3;
};
var putShortMSB = (s3, b3) => {
  s3.pending_buf[s3.pending++] = b3 >>> 8 & 255;
  s3.pending_buf[s3.pending++] = b3 & 255;
};
var read_buf = (strm, buf, start, size) => {
  let len = strm.avail_in;
  if (len > size) {
    len = size;
  }
  if (len === 0) {
    return 0;
  }
  strm.avail_in -= len;
  buf.set(strm.input.subarray(strm.next_in, strm.next_in + len), start);
  if (strm.state.wrap === 1) {
    strm.adler = adler32_1(strm.adler, buf, len, start);
  } else if (strm.state.wrap === 2) {
    strm.adler = crc32_1(strm.adler, buf, len, start);
  }
  strm.next_in += len;
  strm.total_in += len;
  return len;
};
var longest_match = (s3, cur_match) => {
  let chain_length = s3.max_chain_length;
  let scan = s3.strstart;
  let match;
  let len;
  let best_len = s3.prev_length;
  let nice_match = s3.nice_match;
  const limit = s3.strstart > s3.w_size - MIN_LOOKAHEAD ? s3.strstart - (s3.w_size - MIN_LOOKAHEAD) : 0;
  const _win = s3.window;
  const wmask = s3.w_mask;
  const prev = s3.prev;
  const strend = s3.strstart + MAX_MATCH$1;
  let scan_end1 = _win[scan + best_len - 1];
  let scan_end = _win[scan + best_len];
  if (s3.prev_length >= s3.good_match) {
    chain_length >>= 2;
  }
  if (nice_match > s3.lookahead) {
    nice_match = s3.lookahead;
  }
  do {
    match = cur_match;
    if (_win[match + best_len] !== scan_end || _win[match + best_len - 1] !== scan_end1 || _win[match] !== _win[scan] || _win[++match] !== _win[scan + 1]) {
      continue;
    }
    scan += 2;
    match++;
    do {
    } while (_win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && scan < strend);
    len = MAX_MATCH$1 - (strend - scan);
    scan = strend - MAX_MATCH$1;
    if (len > best_len) {
      s3.match_start = cur_match;
      best_len = len;
      if (len >= nice_match) {
        break;
      }
      scan_end1 = _win[scan + best_len - 1];
      scan_end = _win[scan + best_len];
    }
  } while ((cur_match = prev[cur_match & wmask]) > limit && --chain_length !== 0);
  if (best_len <= s3.lookahead) {
    return best_len;
  }
  return s3.lookahead;
};
var fill_window = (s3) => {
  const _w_size = s3.w_size;
  let p, n3, m, more, str;
  do {
    more = s3.window_size - s3.lookahead - s3.strstart;
    if (s3.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {
      s3.window.set(s3.window.subarray(_w_size, _w_size + _w_size), 0);
      s3.match_start -= _w_size;
      s3.strstart -= _w_size;
      s3.block_start -= _w_size;
      n3 = s3.hash_size;
      p = n3;
      do {
        m = s3.head[--p];
        s3.head[p] = m >= _w_size ? m - _w_size : 0;
      } while (--n3);
      n3 = _w_size;
      p = n3;
      do {
        m = s3.prev[--p];
        s3.prev[p] = m >= _w_size ? m - _w_size : 0;
      } while (--n3);
      more += _w_size;
    }
    if (s3.strm.avail_in === 0) {
      break;
    }
    n3 = read_buf(s3.strm, s3.window, s3.strstart + s3.lookahead, more);
    s3.lookahead += n3;
    if (s3.lookahead + s3.insert >= MIN_MATCH$1) {
      str = s3.strstart - s3.insert;
      s3.ins_h = s3.window[str];
      s3.ins_h = HASH(s3, s3.ins_h, s3.window[str + 1]);
      while (s3.insert) {
        s3.ins_h = HASH(s3, s3.ins_h, s3.window[str + MIN_MATCH$1 - 1]);
        s3.prev[str & s3.w_mask] = s3.head[s3.ins_h];
        s3.head[s3.ins_h] = str;
        str++;
        s3.insert--;
        if (s3.lookahead + s3.insert < MIN_MATCH$1) {
          break;
        }
      }
    }
  } while (s3.lookahead < MIN_LOOKAHEAD && s3.strm.avail_in !== 0);
};
var deflate_stored = (s3, flush) => {
  let max_block_size = 65535;
  if (max_block_size > s3.pending_buf_size - 5) {
    max_block_size = s3.pending_buf_size - 5;
  }
  for (; ; ) {
    if (s3.lookahead <= 1) {
      fill_window(s3);
      if (s3.lookahead === 0 && flush === Z_NO_FLUSH) {
        return BS_NEED_MORE;
      }
      if (s3.lookahead === 0) {
        break;
      }
    }
    s3.strstart += s3.lookahead;
    s3.lookahead = 0;
    const max_start = s3.block_start + max_block_size;
    if (s3.strstart === 0 || s3.strstart >= max_start) {
      s3.lookahead = s3.strstart - max_start;
      s3.strstart = max_start;
      flush_block_only(s3, false);
      if (s3.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
    if (s3.strstart - s3.block_start >= s3.w_size - MIN_LOOKAHEAD) {
      flush_block_only(s3, false);
      if (s3.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
  }
  s3.insert = 0;
  if (flush === Z_FINISH) {
    flush_block_only(s3, true);
    if (s3.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s3.strstart > s3.block_start) {
    flush_block_only(s3, false);
    if (s3.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_NEED_MORE;
};
var deflate_fast = (s3, flush) => {
  let hash_head;
  let bflush;
  for (; ; ) {
    if (s3.lookahead < MIN_LOOKAHEAD) {
      fill_window(s3);
      if (s3.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH) {
        return BS_NEED_MORE;
      }
      if (s3.lookahead === 0) {
        break;
      }
    }
    hash_head = 0;
    if (s3.lookahead >= MIN_MATCH$1) {
      s3.ins_h = HASH(s3, s3.ins_h, s3.window[s3.strstart + MIN_MATCH$1 - 1]);
      hash_head = s3.prev[s3.strstart & s3.w_mask] = s3.head[s3.ins_h];
      s3.head[s3.ins_h] = s3.strstart;
    }
    if (hash_head !== 0 && s3.strstart - hash_head <= s3.w_size - MIN_LOOKAHEAD) {
      s3.match_length = longest_match(s3, hash_head);
    }
    if (s3.match_length >= MIN_MATCH$1) {
      bflush = _tr_tally$1(s3, s3.strstart - s3.match_start, s3.match_length - MIN_MATCH$1);
      s3.lookahead -= s3.match_length;
      if (s3.match_length <= s3.max_lazy_match && s3.lookahead >= MIN_MATCH$1) {
        s3.match_length--;
        do {
          s3.strstart++;
          s3.ins_h = HASH(s3, s3.ins_h, s3.window[s3.strstart + MIN_MATCH$1 - 1]);
          hash_head = s3.prev[s3.strstart & s3.w_mask] = s3.head[s3.ins_h];
          s3.head[s3.ins_h] = s3.strstart;
        } while (--s3.match_length !== 0);
        s3.strstart++;
      } else {
        s3.strstart += s3.match_length;
        s3.match_length = 0;
        s3.ins_h = s3.window[s3.strstart];
        s3.ins_h = HASH(s3, s3.ins_h, s3.window[s3.strstart + 1]);
      }
    } else {
      bflush = _tr_tally$1(s3, 0, s3.window[s3.strstart]);
      s3.lookahead--;
      s3.strstart++;
    }
    if (bflush) {
      flush_block_only(s3, false);
      if (s3.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
  }
  s3.insert = s3.strstart < MIN_MATCH$1 - 1 ? s3.strstart : MIN_MATCH$1 - 1;
  if (flush === Z_FINISH) {
    flush_block_only(s3, true);
    if (s3.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s3.last_lit) {
    flush_block_only(s3, false);
    if (s3.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_BLOCK_DONE;
};
var deflate_slow = (s3, flush) => {
  let hash_head;
  let bflush;
  let max_insert;
  for (; ; ) {
    if (s3.lookahead < MIN_LOOKAHEAD) {
      fill_window(s3);
      if (s3.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH) {
        return BS_NEED_MORE;
      }
      if (s3.lookahead === 0) {
        break;
      }
    }
    hash_head = 0;
    if (s3.lookahead >= MIN_MATCH$1) {
      s3.ins_h = HASH(s3, s3.ins_h, s3.window[s3.strstart + MIN_MATCH$1 - 1]);
      hash_head = s3.prev[s3.strstart & s3.w_mask] = s3.head[s3.ins_h];
      s3.head[s3.ins_h] = s3.strstart;
    }
    s3.prev_length = s3.match_length;
    s3.prev_match = s3.match_start;
    s3.match_length = MIN_MATCH$1 - 1;
    if (hash_head !== 0 && s3.prev_length < s3.max_lazy_match && s3.strstart - hash_head <= s3.w_size - MIN_LOOKAHEAD) {
      s3.match_length = longest_match(s3, hash_head);
      if (s3.match_length <= 5 && (s3.strategy === Z_FILTERED || s3.match_length === MIN_MATCH$1 && s3.strstart - s3.match_start > 4096)) {
        s3.match_length = MIN_MATCH$1 - 1;
      }
    }
    if (s3.prev_length >= MIN_MATCH$1 && s3.match_length <= s3.prev_length) {
      max_insert = s3.strstart + s3.lookahead - MIN_MATCH$1;
      bflush = _tr_tally$1(s3, s3.strstart - 1 - s3.prev_match, s3.prev_length - MIN_MATCH$1);
      s3.lookahead -= s3.prev_length - 1;
      s3.prev_length -= 2;
      do {
        if (++s3.strstart <= max_insert) {
          s3.ins_h = HASH(s3, s3.ins_h, s3.window[s3.strstart + MIN_MATCH$1 - 1]);
          hash_head = s3.prev[s3.strstart & s3.w_mask] = s3.head[s3.ins_h];
          s3.head[s3.ins_h] = s3.strstart;
        }
      } while (--s3.prev_length !== 0);
      s3.match_available = 0;
      s3.match_length = MIN_MATCH$1 - 1;
      s3.strstart++;
      if (bflush) {
        flush_block_only(s3, false);
        if (s3.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
    } else if (s3.match_available) {
      bflush = _tr_tally$1(s3, 0, s3.window[s3.strstart - 1]);
      if (bflush) {
        flush_block_only(s3, false);
      }
      s3.strstart++;
      s3.lookahead--;
      if (s3.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    } else {
      s3.match_available = 1;
      s3.strstart++;
      s3.lookahead--;
    }
  }
  if (s3.match_available) {
    bflush = _tr_tally$1(s3, 0, s3.window[s3.strstart - 1]);
    s3.match_available = 0;
  }
  s3.insert = s3.strstart < MIN_MATCH$1 - 1 ? s3.strstart : MIN_MATCH$1 - 1;
  if (flush === Z_FINISH) {
    flush_block_only(s3, true);
    if (s3.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s3.last_lit) {
    flush_block_only(s3, false);
    if (s3.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_BLOCK_DONE;
};
var deflate_rle = (s3, flush) => {
  let bflush;
  let prev;
  let scan, strend;
  const _win = s3.window;
  for (; ; ) {
    if (s3.lookahead <= MAX_MATCH$1) {
      fill_window(s3);
      if (s3.lookahead <= MAX_MATCH$1 && flush === Z_NO_FLUSH) {
        return BS_NEED_MORE;
      }
      if (s3.lookahead === 0) {
        break;
      }
    }
    s3.match_length = 0;
    if (s3.lookahead >= MIN_MATCH$1 && s3.strstart > 0) {
      scan = s3.strstart - 1;
      prev = _win[scan];
      if (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan]) {
        strend = s3.strstart + MAX_MATCH$1;
        do {
        } while (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && scan < strend);
        s3.match_length = MAX_MATCH$1 - (strend - scan);
        if (s3.match_length > s3.lookahead) {
          s3.match_length = s3.lookahead;
        }
      }
    }
    if (s3.match_length >= MIN_MATCH$1) {
      bflush = _tr_tally$1(s3, 1, s3.match_length - MIN_MATCH$1);
      s3.lookahead -= s3.match_length;
      s3.strstart += s3.match_length;
      s3.match_length = 0;
    } else {
      bflush = _tr_tally$1(s3, 0, s3.window[s3.strstart]);
      s3.lookahead--;
      s3.strstart++;
    }
    if (bflush) {
      flush_block_only(s3, false);
      if (s3.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
  }
  s3.insert = 0;
  if (flush === Z_FINISH) {
    flush_block_only(s3, true);
    if (s3.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s3.last_lit) {
    flush_block_only(s3, false);
    if (s3.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_BLOCK_DONE;
};
var deflate_huff = (s3, flush) => {
  let bflush;
  for (; ; ) {
    if (s3.lookahead === 0) {
      fill_window(s3);
      if (s3.lookahead === 0) {
        if (flush === Z_NO_FLUSH) {
          return BS_NEED_MORE;
        }
        break;
      }
    }
    s3.match_length = 0;
    bflush = _tr_tally$1(s3, 0, s3.window[s3.strstart]);
    s3.lookahead--;
    s3.strstart++;
    if (bflush) {
      flush_block_only(s3, false);
      if (s3.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
  }
  s3.insert = 0;
  if (flush === Z_FINISH) {
    flush_block_only(s3, true);
    if (s3.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s3.last_lit) {
    flush_block_only(s3, false);
    if (s3.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_BLOCK_DONE;
};
function Config(good_length, max_lazy, nice_length, max_chain, func) {
  this.good_length = good_length;
  this.max_lazy = max_lazy;
  this.nice_length = nice_length;
  this.max_chain = max_chain;
  this.func = func;
}
var configuration_table = [
  /*      good lazy nice chain */
  new Config(0, 0, 0, 0, deflate_stored),
  /* 0 store only */
  new Config(4, 4, 8, 4, deflate_fast),
  /* 1 max speed, no lazy matches */
  new Config(4, 5, 16, 8, deflate_fast),
  /* 2 */
  new Config(4, 6, 32, 32, deflate_fast),
  /* 3 */
  new Config(4, 4, 16, 16, deflate_slow),
  /* 4 lazy matches */
  new Config(8, 16, 32, 32, deflate_slow),
  /* 5 */
  new Config(8, 16, 128, 128, deflate_slow),
  /* 6 */
  new Config(8, 32, 128, 256, deflate_slow),
  /* 7 */
  new Config(32, 128, 258, 1024, deflate_slow),
  /* 8 */
  new Config(32, 258, 258, 4096, deflate_slow)
  /* 9 max compression */
];
var lm_init = (s3) => {
  s3.window_size = 2 * s3.w_size;
  zero$1(s3.head);
  s3.max_lazy_match = configuration_table[s3.level].max_lazy;
  s3.good_match = configuration_table[s3.level].good_length;
  s3.nice_match = configuration_table[s3.level].nice_length;
  s3.max_chain_length = configuration_table[s3.level].max_chain;
  s3.strstart = 0;
  s3.block_start = 0;
  s3.lookahead = 0;
  s3.insert = 0;
  s3.match_length = s3.prev_length = MIN_MATCH$1 - 1;
  s3.match_available = 0;
  s3.ins_h = 0;
};
function DeflateState() {
  this.strm = null;
  this.status = 0;
  this.pending_buf = null;
  this.pending_buf_size = 0;
  this.pending_out = 0;
  this.pending = 0;
  this.wrap = 0;
  this.gzhead = null;
  this.gzindex = 0;
  this.method = Z_DEFLATED;
  this.last_flush = -1;
  this.w_size = 0;
  this.w_bits = 0;
  this.w_mask = 0;
  this.window = null;
  this.window_size = 0;
  this.prev = null;
  this.head = null;
  this.ins_h = 0;
  this.hash_size = 0;
  this.hash_bits = 0;
  this.hash_mask = 0;
  this.hash_shift = 0;
  this.block_start = 0;
  this.match_length = 0;
  this.prev_match = 0;
  this.match_available = 0;
  this.strstart = 0;
  this.match_start = 0;
  this.lookahead = 0;
  this.prev_length = 0;
  this.max_chain_length = 0;
  this.max_lazy_match = 0;
  this.level = 0;
  this.strategy = 0;
  this.good_match = 0;
  this.nice_match = 0;
  this.dyn_ltree = new Uint16Array(HEAP_SIZE$1 * 2);
  this.dyn_dtree = new Uint16Array((2 * D_CODES$1 + 1) * 2);
  this.bl_tree = new Uint16Array((2 * BL_CODES$1 + 1) * 2);
  zero$1(this.dyn_ltree);
  zero$1(this.dyn_dtree);
  zero$1(this.bl_tree);
  this.l_desc = null;
  this.d_desc = null;
  this.bl_desc = null;
  this.bl_count = new Uint16Array(MAX_BITS$1 + 1);
  this.heap = new Uint16Array(2 * L_CODES$1 + 1);
  zero$1(this.heap);
  this.heap_len = 0;
  this.heap_max = 0;
  this.depth = new Uint16Array(2 * L_CODES$1 + 1);
  zero$1(this.depth);
  this.l_buf = 0;
  this.lit_bufsize = 0;
  this.last_lit = 0;
  this.d_buf = 0;
  this.opt_len = 0;
  this.static_len = 0;
  this.matches = 0;
  this.insert = 0;
  this.bi_buf = 0;
  this.bi_valid = 0;
}
var deflateResetKeep = (strm) => {
  if (!strm || !strm.state) {
    return err(strm, Z_STREAM_ERROR);
  }
  strm.total_in = strm.total_out = 0;
  strm.data_type = Z_UNKNOWN$1;
  const s3 = strm.state;
  s3.pending = 0;
  s3.pending_out = 0;
  if (s3.wrap < 0) {
    s3.wrap = -s3.wrap;
  }
  s3.status = s3.wrap ? INIT_STATE : BUSY_STATE;
  strm.adler = s3.wrap === 2 ? 0 : 1;
  s3.last_flush = Z_NO_FLUSH;
  _tr_init$1(s3);
  return Z_OK;
};
var deflateReset = (strm) => {
  const ret = deflateResetKeep(strm);
  if (ret === Z_OK) {
    lm_init(strm.state);
  }
  return ret;
};
var deflateSetHeader = (strm, head) => {
  if (!strm || !strm.state) {
    return Z_STREAM_ERROR;
  }
  if (strm.state.wrap !== 2) {
    return Z_STREAM_ERROR;
  }
  strm.state.gzhead = head;
  return Z_OK;
};
var deflateInit2 = (strm, level, method, windowBits, memLevel, strategy) => {
  if (!strm) {
    return Z_STREAM_ERROR;
  }
  let wrap = 1;
  if (level === Z_DEFAULT_COMPRESSION) {
    level = 6;
  }
  if (windowBits < 0) {
    wrap = 0;
    windowBits = -windowBits;
  } else if (windowBits > 15) {
    wrap = 2;
    windowBits -= 16;
  }
  if (memLevel < 1 || memLevel > MAX_MEM_LEVEL || method !== Z_DEFLATED || windowBits < 8 || windowBits > 15 || level < 0 || level > 9 || strategy < 0 || strategy > Z_FIXED$1) {
    return err(strm, Z_STREAM_ERROR);
  }
  if (windowBits === 8) {
    windowBits = 9;
  }
  const s3 = new DeflateState();
  strm.state = s3;
  s3.strm = strm;
  s3.wrap = wrap;
  s3.gzhead = null;
  s3.w_bits = windowBits;
  s3.w_size = 1 << s3.w_bits;
  s3.w_mask = s3.w_size - 1;
  s3.hash_bits = memLevel + 7;
  s3.hash_size = 1 << s3.hash_bits;
  s3.hash_mask = s3.hash_size - 1;
  s3.hash_shift = ~~((s3.hash_bits + MIN_MATCH$1 - 1) / MIN_MATCH$1);
  s3.window = new Uint8Array(s3.w_size * 2);
  s3.head = new Uint16Array(s3.hash_size);
  s3.prev = new Uint16Array(s3.w_size);
  s3.lit_bufsize = 1 << memLevel + 6;
  s3.pending_buf_size = s3.lit_bufsize * 4;
  s3.pending_buf = new Uint8Array(s3.pending_buf_size);
  s3.d_buf = 1 * s3.lit_bufsize;
  s3.l_buf = (1 + 2) * s3.lit_bufsize;
  s3.level = level;
  s3.strategy = strategy;
  s3.method = method;
  return deflateReset(strm);
};
var deflateInit = (strm, level) => {
  return deflateInit2(strm, level, Z_DEFLATED, MAX_WBITS, DEF_MEM_LEVEL, Z_DEFAULT_STRATEGY);
};
var deflate = (strm, flush) => {
  let beg, val;
  if (!strm || !strm.state || flush > Z_BLOCK || flush < 0) {
    return strm ? err(strm, Z_STREAM_ERROR) : Z_STREAM_ERROR;
  }
  const s3 = strm.state;
  if (!strm.output || !strm.input && strm.avail_in !== 0 || s3.status === FINISH_STATE && flush !== Z_FINISH) {
    return err(strm, strm.avail_out === 0 ? Z_BUF_ERROR : Z_STREAM_ERROR);
  }
  s3.strm = strm;
  const old_flush = s3.last_flush;
  s3.last_flush = flush;
  if (s3.status === INIT_STATE) {
    if (s3.wrap === 2) {
      strm.adler = 0;
      put_byte(s3, 31);
      put_byte(s3, 139);
      put_byte(s3, 8);
      if (!s3.gzhead) {
        put_byte(s3, 0);
        put_byte(s3, 0);
        put_byte(s3, 0);
        put_byte(s3, 0);
        put_byte(s3, 0);
        put_byte(s3, s3.level === 9 ? 2 : s3.strategy >= Z_HUFFMAN_ONLY || s3.level < 2 ? 4 : 0);
        put_byte(s3, OS_CODE);
        s3.status = BUSY_STATE;
      } else {
        put_byte(
          s3,
          (s3.gzhead.text ? 1 : 0) + (s3.gzhead.hcrc ? 2 : 0) + (!s3.gzhead.extra ? 0 : 4) + (!s3.gzhead.name ? 0 : 8) + (!s3.gzhead.comment ? 0 : 16)
        );
        put_byte(s3, s3.gzhead.time & 255);
        put_byte(s3, s3.gzhead.time >> 8 & 255);
        put_byte(s3, s3.gzhead.time >> 16 & 255);
        put_byte(s3, s3.gzhead.time >> 24 & 255);
        put_byte(s3, s3.level === 9 ? 2 : s3.strategy >= Z_HUFFMAN_ONLY || s3.level < 2 ? 4 : 0);
        put_byte(s3, s3.gzhead.os & 255);
        if (s3.gzhead.extra && s3.gzhead.extra.length) {
          put_byte(s3, s3.gzhead.extra.length & 255);
          put_byte(s3, s3.gzhead.extra.length >> 8 & 255);
        }
        if (s3.gzhead.hcrc) {
          strm.adler = crc32_1(strm.adler, s3.pending_buf, s3.pending, 0);
        }
        s3.gzindex = 0;
        s3.status = EXTRA_STATE;
      }
    } else {
      let header = Z_DEFLATED + (s3.w_bits - 8 << 4) << 8;
      let level_flags = -1;
      if (s3.strategy >= Z_HUFFMAN_ONLY || s3.level < 2) {
        level_flags = 0;
      } else if (s3.level < 6) {
        level_flags = 1;
      } else if (s3.level === 6) {
        level_flags = 2;
      } else {
        level_flags = 3;
      }
      header |= level_flags << 6;
      if (s3.strstart !== 0) {
        header |= PRESET_DICT;
      }
      header += 31 - header % 31;
      s3.status = BUSY_STATE;
      putShortMSB(s3, header);
      if (s3.strstart !== 0) {
        putShortMSB(s3, strm.adler >>> 16);
        putShortMSB(s3, strm.adler & 65535);
      }
      strm.adler = 1;
    }
  }
  if (s3.status === EXTRA_STATE) {
    if (s3.gzhead.extra) {
      beg = s3.pending;
      while (s3.gzindex < (s3.gzhead.extra.length & 65535)) {
        if (s3.pending === s3.pending_buf_size) {
          if (s3.gzhead.hcrc && s3.pending > beg) {
            strm.adler = crc32_1(strm.adler, s3.pending_buf, s3.pending - beg, beg);
          }
          flush_pending(strm);
          beg = s3.pending;
          if (s3.pending === s3.pending_buf_size) {
            break;
          }
        }
        put_byte(s3, s3.gzhead.extra[s3.gzindex] & 255);
        s3.gzindex++;
      }
      if (s3.gzhead.hcrc && s3.pending > beg) {
        strm.adler = crc32_1(strm.adler, s3.pending_buf, s3.pending - beg, beg);
      }
      if (s3.gzindex === s3.gzhead.extra.length) {
        s3.gzindex = 0;
        s3.status = NAME_STATE;
      }
    } else {
      s3.status = NAME_STATE;
    }
  }
  if (s3.status === NAME_STATE) {
    if (s3.gzhead.name) {
      beg = s3.pending;
      do {
        if (s3.pending === s3.pending_buf_size) {
          if (s3.gzhead.hcrc && s3.pending > beg) {
            strm.adler = crc32_1(strm.adler, s3.pending_buf, s3.pending - beg, beg);
          }
          flush_pending(strm);
          beg = s3.pending;
          if (s3.pending === s3.pending_buf_size) {
            val = 1;
            break;
          }
        }
        if (s3.gzindex < s3.gzhead.name.length) {
          val = s3.gzhead.name.charCodeAt(s3.gzindex++) & 255;
        } else {
          val = 0;
        }
        put_byte(s3, val);
      } while (val !== 0);
      if (s3.gzhead.hcrc && s3.pending > beg) {
        strm.adler = crc32_1(strm.adler, s3.pending_buf, s3.pending - beg, beg);
      }
      if (val === 0) {
        s3.gzindex = 0;
        s3.status = COMMENT_STATE;
      }
    } else {
      s3.status = COMMENT_STATE;
    }
  }
  if (s3.status === COMMENT_STATE) {
    if (s3.gzhead.comment) {
      beg = s3.pending;
      do {
        if (s3.pending === s3.pending_buf_size) {
          if (s3.gzhead.hcrc && s3.pending > beg) {
            strm.adler = crc32_1(strm.adler, s3.pending_buf, s3.pending - beg, beg);
          }
          flush_pending(strm);
          beg = s3.pending;
          if (s3.pending === s3.pending_buf_size) {
            val = 1;
            break;
          }
        }
        if (s3.gzindex < s3.gzhead.comment.length) {
          val = s3.gzhead.comment.charCodeAt(s3.gzindex++) & 255;
        } else {
          val = 0;
        }
        put_byte(s3, val);
      } while (val !== 0);
      if (s3.gzhead.hcrc && s3.pending > beg) {
        strm.adler = crc32_1(strm.adler, s3.pending_buf, s3.pending - beg, beg);
      }
      if (val === 0) {
        s3.status = HCRC_STATE;
      }
    } else {
      s3.status = HCRC_STATE;
    }
  }
  if (s3.status === HCRC_STATE) {
    if (s3.gzhead.hcrc) {
      if (s3.pending + 2 > s3.pending_buf_size) {
        flush_pending(strm);
      }
      if (s3.pending + 2 <= s3.pending_buf_size) {
        put_byte(s3, strm.adler & 255);
        put_byte(s3, strm.adler >> 8 & 255);
        strm.adler = 0;
        s3.status = BUSY_STATE;
      }
    } else {
      s3.status = BUSY_STATE;
    }
  }
  if (s3.pending !== 0) {
    flush_pending(strm);
    if (strm.avail_out === 0) {
      s3.last_flush = -1;
      return Z_OK;
    }
  } else if (strm.avail_in === 0 && rank(flush) <= rank(old_flush) && flush !== Z_FINISH) {
    return err(strm, Z_BUF_ERROR);
  }
  if (s3.status === FINISH_STATE && strm.avail_in !== 0) {
    return err(strm, Z_BUF_ERROR);
  }
  if (strm.avail_in !== 0 || s3.lookahead !== 0 || flush !== Z_NO_FLUSH && s3.status !== FINISH_STATE) {
    let bstate = s3.strategy === Z_HUFFMAN_ONLY ? deflate_huff(s3, flush) : s3.strategy === Z_RLE ? deflate_rle(s3, flush) : configuration_table[s3.level].func(s3, flush);
    if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE) {
      s3.status = FINISH_STATE;
    }
    if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
      if (strm.avail_out === 0) {
        s3.last_flush = -1;
      }
      return Z_OK;
    }
    if (bstate === BS_BLOCK_DONE) {
      if (flush === Z_PARTIAL_FLUSH) {
        _tr_align$1(s3);
      } else if (flush !== Z_BLOCK) {
        _tr_stored_block$1(s3, 0, 0, false);
        if (flush === Z_FULL_FLUSH) {
          zero$1(s3.head);
          if (s3.lookahead === 0) {
            s3.strstart = 0;
            s3.block_start = 0;
            s3.insert = 0;
          }
        }
      }
      flush_pending(strm);
      if (strm.avail_out === 0) {
        s3.last_flush = -1;
        return Z_OK;
      }
    }
  }
  if (flush !== Z_FINISH) {
    return Z_OK;
  }
  if (s3.wrap <= 0) {
    return Z_STREAM_END;
  }
  if (s3.wrap === 2) {
    put_byte(s3, strm.adler & 255);
    put_byte(s3, strm.adler >> 8 & 255);
    put_byte(s3, strm.adler >> 16 & 255);
    put_byte(s3, strm.adler >> 24 & 255);
    put_byte(s3, strm.total_in & 255);
    put_byte(s3, strm.total_in >> 8 & 255);
    put_byte(s3, strm.total_in >> 16 & 255);
    put_byte(s3, strm.total_in >> 24 & 255);
  } else {
    putShortMSB(s3, strm.adler >>> 16);
    putShortMSB(s3, strm.adler & 65535);
  }
  flush_pending(strm);
  if (s3.wrap > 0) {
    s3.wrap = -s3.wrap;
  }
  return s3.pending !== 0 ? Z_OK : Z_STREAM_END;
};
var deflateEnd = (strm) => {
  if (!strm || !strm.state) {
    return Z_STREAM_ERROR;
  }
  const status = strm.state.status;
  if (status !== INIT_STATE && status !== EXTRA_STATE && status !== NAME_STATE && status !== COMMENT_STATE && status !== HCRC_STATE && status !== BUSY_STATE && status !== FINISH_STATE) {
    return err(strm, Z_STREAM_ERROR);
  }
  strm.state = null;
  return status === BUSY_STATE ? err(strm, Z_DATA_ERROR) : Z_OK;
};
var deflateSetDictionary = (strm, dictionary) => {
  let dictLength = dictionary.length;
  if (!strm || !strm.state) {
    return Z_STREAM_ERROR;
  }
  const s3 = strm.state;
  const wrap = s3.wrap;
  if (wrap === 2 || wrap === 1 && s3.status !== INIT_STATE || s3.lookahead) {
    return Z_STREAM_ERROR;
  }
  if (wrap === 1) {
    strm.adler = adler32_1(strm.adler, dictionary, dictLength, 0);
  }
  s3.wrap = 0;
  if (dictLength >= s3.w_size) {
    if (wrap === 0) {
      zero$1(s3.head);
      s3.strstart = 0;
      s3.block_start = 0;
      s3.insert = 0;
    }
    let tmpDict = new Uint8Array(s3.w_size);
    tmpDict.set(dictionary.subarray(dictLength - s3.w_size, dictLength), 0);
    dictionary = tmpDict;
    dictLength = s3.w_size;
  }
  const avail = strm.avail_in;
  const next = strm.next_in;
  const input = strm.input;
  strm.avail_in = dictLength;
  strm.next_in = 0;
  strm.input = dictionary;
  fill_window(s3);
  while (s3.lookahead >= MIN_MATCH$1) {
    let str = s3.strstart;
    let n3 = s3.lookahead - (MIN_MATCH$1 - 1);
    do {
      s3.ins_h = HASH(s3, s3.ins_h, s3.window[str + MIN_MATCH$1 - 1]);
      s3.prev[str & s3.w_mask] = s3.head[s3.ins_h];
      s3.head[s3.ins_h] = str;
      str++;
    } while (--n3);
    s3.strstart = str;
    s3.lookahead = MIN_MATCH$1 - 1;
    fill_window(s3);
  }
  s3.strstart += s3.lookahead;
  s3.block_start = s3.strstart;
  s3.insert = s3.lookahead;
  s3.lookahead = 0;
  s3.match_length = s3.prev_length = MIN_MATCH$1 - 1;
  s3.match_available = 0;
  strm.next_in = next;
  strm.input = input;
  strm.avail_in = avail;
  s3.wrap = wrap;
  return Z_OK;
};
var deflateInit_1 = deflateInit;
var deflateInit2_1 = deflateInit2;
var deflateReset_1 = deflateReset;
var deflateResetKeep_1 = deflateResetKeep;
var deflateSetHeader_1 = deflateSetHeader;
var deflate_2 = deflate;
var deflateEnd_1 = deflateEnd;
var deflateSetDictionary_1 = deflateSetDictionary;
var deflateInfo = "pako deflate (from Nodeca project)";
var deflate_1 = {
  deflateInit: deflateInit_1,
  deflateInit2: deflateInit2_1,
  deflateReset: deflateReset_1,
  deflateResetKeep: deflateResetKeep_1,
  deflateSetHeader: deflateSetHeader_1,
  deflate: deflate_2,
  deflateEnd: deflateEnd_1,
  deflateSetDictionary: deflateSetDictionary_1,
  deflateInfo
};
var _has = (obj, key) => {
  return Object.prototype.hasOwnProperty.call(obj, key);
};
var assign = function(obj) {
  const sources = Array.prototype.slice.call(arguments, 1);
  while (sources.length) {
    const source = sources.shift();
    if (!source) {
      continue;
    }
    if (typeof source !== "object") {
      throw new TypeError(source + "must be non-object");
    }
    for (const p in source) {
      if (_has(source, p)) {
        obj[p] = source[p];
      }
    }
  }
  return obj;
};
var flattenChunks = (chunks) => {
  let len = 0;
  for (let i3 = 0, l3 = chunks.length; i3 < l3; i3++) {
    len += chunks[i3].length;
  }
  const result = new Uint8Array(len);
  for (let i3 = 0, pos = 0, l3 = chunks.length; i3 < l3; i3++) {
    let chunk = chunks[i3];
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result;
};
var common = {
  assign,
  flattenChunks
};
var STR_APPLY_UIA_OK = true;
try {
  String.fromCharCode.apply(null, new Uint8Array(1));
} catch (__) {
  STR_APPLY_UIA_OK = false;
}
var _utf8len = new Uint8Array(256);
for (let q3 = 0; q3 < 256; q3++) {
  _utf8len[q3] = q3 >= 252 ? 6 : q3 >= 248 ? 5 : q3 >= 240 ? 4 : q3 >= 224 ? 3 : q3 >= 192 ? 2 : 1;
}
_utf8len[254] = _utf8len[254] = 1;
var string2buf = (str) => {
  let buf, c3, c22, m_pos, i3, str_len = str.length, buf_len = 0;
  for (m_pos = 0; m_pos < str_len; m_pos++) {
    c3 = str.charCodeAt(m_pos);
    if ((c3 & 64512) === 55296 && m_pos + 1 < str_len) {
      c22 = str.charCodeAt(m_pos + 1);
      if ((c22 & 64512) === 56320) {
        c3 = 65536 + (c3 - 55296 << 10) + (c22 - 56320);
        m_pos++;
      }
    }
    buf_len += c3 < 128 ? 1 : c3 < 2048 ? 2 : c3 < 65536 ? 3 : 4;
  }
  buf = new Uint8Array(buf_len);
  for (i3 = 0, m_pos = 0; i3 < buf_len; m_pos++) {
    c3 = str.charCodeAt(m_pos);
    if ((c3 & 64512) === 55296 && m_pos + 1 < str_len) {
      c22 = str.charCodeAt(m_pos + 1);
      if ((c22 & 64512) === 56320) {
        c3 = 65536 + (c3 - 55296 << 10) + (c22 - 56320);
        m_pos++;
      }
    }
    if (c3 < 128) {
      buf[i3++] = c3;
    } else if (c3 < 2048) {
      buf[i3++] = 192 | c3 >>> 6;
      buf[i3++] = 128 | c3 & 63;
    } else if (c3 < 65536) {
      buf[i3++] = 224 | c3 >>> 12;
      buf[i3++] = 128 | c3 >>> 6 & 63;
      buf[i3++] = 128 | c3 & 63;
    } else {
      buf[i3++] = 240 | c3 >>> 18;
      buf[i3++] = 128 | c3 >>> 12 & 63;
      buf[i3++] = 128 | c3 >>> 6 & 63;
      buf[i3++] = 128 | c3 & 63;
    }
  }
  return buf;
};
var buf2binstring = (buf, len) => {
  if (len < 65534) {
    if (buf.subarray && STR_APPLY_UIA_OK) {
      return String.fromCharCode.apply(null, buf.length === len ? buf : buf.subarray(0, len));
    }
  }
  let result = "";
  for (let i3 = 0; i3 < len; i3++) {
    result += String.fromCharCode(buf[i3]);
  }
  return result;
};
var buf2string = (buf, max) => {
  let i3, out;
  const len = max || buf.length;
  const utf16buf = new Array(len * 2);
  for (out = 0, i3 = 0; i3 < len; ) {
    let c3 = buf[i3++];
    if (c3 < 128) {
      utf16buf[out++] = c3;
      continue;
    }
    let c_len = _utf8len[c3];
    if (c_len > 4) {
      utf16buf[out++] = 65533;
      i3 += c_len - 1;
      continue;
    }
    c3 &= c_len === 2 ? 31 : c_len === 3 ? 15 : 7;
    while (c_len > 1 && i3 < len) {
      c3 = c3 << 6 | buf[i3++] & 63;
      c_len--;
    }
    if (c_len > 1) {
      utf16buf[out++] = 65533;
      continue;
    }
    if (c3 < 65536) {
      utf16buf[out++] = c3;
    } else {
      c3 -= 65536;
      utf16buf[out++] = 55296 | c3 >> 10 & 1023;
      utf16buf[out++] = 56320 | c3 & 1023;
    }
  }
  return buf2binstring(utf16buf, out);
};
var utf8border = (buf, max) => {
  max = max || buf.length;
  if (max > buf.length) {
    max = buf.length;
  }
  let pos = max - 1;
  while (pos >= 0 && (buf[pos] & 192) === 128) {
    pos--;
  }
  if (pos < 0) {
    return max;
  }
  if (pos === 0) {
    return max;
  }
  return pos + _utf8len[buf[pos]] > max ? pos : max;
};
var strings = {
  string2buf,
  buf2string,
  utf8border
};
function ZStream() {
  this.input = null;
  this.next_in = 0;
  this.avail_in = 0;
  this.total_in = 0;
  this.output = null;
  this.next_out = 0;
  this.avail_out = 0;
  this.total_out = 0;
  this.msg = "";
  this.state = null;
  this.data_type = 2;
  this.adler = 0;
}
var zstream = ZStream;
var toString = Object.prototype.toString;
var {
  Z_NO_FLUSH: Z_NO_FLUSH$1,
  Z_SYNC_FLUSH,
  Z_FULL_FLUSH: Z_FULL_FLUSH$1,
  Z_FINISH: Z_FINISH$1,
  Z_OK: Z_OK$1,
  Z_STREAM_END: Z_STREAM_END$1,
  Z_DEFAULT_COMPRESSION: Z_DEFAULT_COMPRESSION$1,
  Z_DEFAULT_STRATEGY: Z_DEFAULT_STRATEGY$1,
  Z_DEFLATED: Z_DEFLATED$1
} = constants;
function Deflate(options) {
  this.options = common.assign({
    level: Z_DEFAULT_COMPRESSION$1,
    method: Z_DEFLATED$1,
    chunkSize: 16384,
    windowBits: 15,
    memLevel: 8,
    strategy: Z_DEFAULT_STRATEGY$1
  }, options || {});
  let opt = this.options;
  if (opt.raw && opt.windowBits > 0) {
    opt.windowBits = -opt.windowBits;
  } else if (opt.gzip && opt.windowBits > 0 && opt.windowBits < 16) {
    opt.windowBits += 16;
  }
  this.err = 0;
  this.msg = "";
  this.ended = false;
  this.chunks = [];
  this.strm = new zstream();
  this.strm.avail_out = 0;
  let status = deflate_1.deflateInit2(
    this.strm,
    opt.level,
    opt.method,
    opt.windowBits,
    opt.memLevel,
    opt.strategy
  );
  if (status !== Z_OK$1) {
    throw new Error(messages[status]);
  }
  if (opt.header) {
    deflate_1.deflateSetHeader(this.strm, opt.header);
  }
  if (opt.dictionary) {
    let dict;
    if (typeof opt.dictionary === "string") {
      dict = strings.string2buf(opt.dictionary);
    } else if (toString.call(opt.dictionary) === "[object ArrayBuffer]") {
      dict = new Uint8Array(opt.dictionary);
    } else {
      dict = opt.dictionary;
    }
    status = deflate_1.deflateSetDictionary(this.strm, dict);
    if (status !== Z_OK$1) {
      throw new Error(messages[status]);
    }
    this._dict_set = true;
  }
}
Deflate.prototype.push = function(data, flush_mode) {
  const strm = this.strm;
  const chunkSize = this.options.chunkSize;
  let status, _flush_mode;
  if (this.ended) {
    return false;
  }
  if (flush_mode === ~~flush_mode) _flush_mode = flush_mode;
  else _flush_mode = flush_mode === true ? Z_FINISH$1 : Z_NO_FLUSH$1;
  if (typeof data === "string") {
    strm.input = strings.string2buf(data);
  } else if (toString.call(data) === "[object ArrayBuffer]") {
    strm.input = new Uint8Array(data);
  } else {
    strm.input = data;
  }
  strm.next_in = 0;
  strm.avail_in = strm.input.length;
  for (; ; ) {
    if (strm.avail_out === 0) {
      strm.output = new Uint8Array(chunkSize);
      strm.next_out = 0;
      strm.avail_out = chunkSize;
    }
    if ((_flush_mode === Z_SYNC_FLUSH || _flush_mode === Z_FULL_FLUSH$1) && strm.avail_out <= 6) {
      this.onData(strm.output.subarray(0, strm.next_out));
      strm.avail_out = 0;
      continue;
    }
    status = deflate_1.deflate(strm, _flush_mode);
    if (status === Z_STREAM_END$1) {
      if (strm.next_out > 0) {
        this.onData(strm.output.subarray(0, strm.next_out));
      }
      status = deflate_1.deflateEnd(this.strm);
      this.onEnd(status);
      this.ended = true;
      return status === Z_OK$1;
    }
    if (strm.avail_out === 0) {
      this.onData(strm.output);
      continue;
    }
    if (_flush_mode > 0 && strm.next_out > 0) {
      this.onData(strm.output.subarray(0, strm.next_out));
      strm.avail_out = 0;
      continue;
    }
    if (strm.avail_in === 0) break;
  }
  return true;
};
Deflate.prototype.onData = function(chunk) {
  this.chunks.push(chunk);
};
Deflate.prototype.onEnd = function(status) {
  if (status === Z_OK$1) {
    this.result = common.flattenChunks(this.chunks);
  }
  this.chunks = [];
  this.err = status;
  this.msg = this.strm.msg;
};
function deflate$1(input, options) {
  const deflator = new Deflate(options);
  deflator.push(input, true);
  if (deflator.err) {
    throw deflator.msg || messages[deflator.err];
  }
  return deflator.result;
}
function deflateRaw(input, options) {
  options = options || {};
  options.raw = true;
  return deflate$1(input, options);
}
function gzip(input, options) {
  options = options || {};
  options.gzip = true;
  return deflate$1(input, options);
}
var Deflate_1 = Deflate;
var deflate_2$1 = deflate$1;
var deflateRaw_1 = deflateRaw;
var gzip_1 = gzip;
var constants$1 = constants;
var deflate_1$1 = {
  Deflate: Deflate_1,
  deflate: deflate_2$1,
  deflateRaw: deflateRaw_1,
  gzip: gzip_1,
  constants: constants$1
};
var BAD = 30;
var TYPE = 12;
var inffast = function inflate_fast(strm, start) {
  let _in;
  let last;
  let _out;
  let beg;
  let end;
  let dmax;
  let wsize;
  let whave;
  let wnext;
  let s_window;
  let hold;
  let bits;
  let lcode;
  let dcode;
  let lmask;
  let dmask;
  let here;
  let op2;
  let len;
  let dist;
  let from;
  let from_source;
  let input, output;
  const state = strm.state;
  _in = strm.next_in;
  input = strm.input;
  last = _in + (strm.avail_in - 5);
  _out = strm.next_out;
  output = strm.output;
  beg = _out - (start - strm.avail_out);
  end = _out + (strm.avail_out - 257);
  dmax = state.dmax;
  wsize = state.wsize;
  whave = state.whave;
  wnext = state.wnext;
  s_window = state.window;
  hold = state.hold;
  bits = state.bits;
  lcode = state.lencode;
  dcode = state.distcode;
  lmask = (1 << state.lenbits) - 1;
  dmask = (1 << state.distbits) - 1;
  top:
    do {
      if (bits < 15) {
        hold += input[_in++] << bits;
        bits += 8;
        hold += input[_in++] << bits;
        bits += 8;
      }
      here = lcode[hold & lmask];
      dolen:
        for (; ; ) {
          op2 = here >>> 24;
          hold >>>= op2;
          bits -= op2;
          op2 = here >>> 16 & 255;
          if (op2 === 0) {
            output[_out++] = here & 65535;
          } else if (op2 & 16) {
            len = here & 65535;
            op2 &= 15;
            if (op2) {
              if (bits < op2) {
                hold += input[_in++] << bits;
                bits += 8;
              }
              len += hold & (1 << op2) - 1;
              hold >>>= op2;
              bits -= op2;
            }
            if (bits < 15) {
              hold += input[_in++] << bits;
              bits += 8;
              hold += input[_in++] << bits;
              bits += 8;
            }
            here = dcode[hold & dmask];
            dodist:
              for (; ; ) {
                op2 = here >>> 24;
                hold >>>= op2;
                bits -= op2;
                op2 = here >>> 16 & 255;
                if (op2 & 16) {
                  dist = here & 65535;
                  op2 &= 15;
                  if (bits < op2) {
                    hold += input[_in++] << bits;
                    bits += 8;
                    if (bits < op2) {
                      hold += input[_in++] << bits;
                      bits += 8;
                    }
                  }
                  dist += hold & (1 << op2) - 1;
                  if (dist > dmax) {
                    strm.msg = "invalid distance too far back";
                    state.mode = BAD;
                    break top;
                  }
                  hold >>>= op2;
                  bits -= op2;
                  op2 = _out - beg;
                  if (dist > op2) {
                    op2 = dist - op2;
                    if (op2 > whave) {
                      if (state.sane) {
                        strm.msg = "invalid distance too far back";
                        state.mode = BAD;
                        break top;
                      }
                    }
                    from = 0;
                    from_source = s_window;
                    if (wnext === 0) {
                      from += wsize - op2;
                      if (op2 < len) {
                        len -= op2;
                        do {
                          output[_out++] = s_window[from++];
                        } while (--op2);
                        from = _out - dist;
                        from_source = output;
                      }
                    } else if (wnext < op2) {
                      from += wsize + wnext - op2;
                      op2 -= wnext;
                      if (op2 < len) {
                        len -= op2;
                        do {
                          output[_out++] = s_window[from++];
                        } while (--op2);
                        from = 0;
                        if (wnext < len) {
                          op2 = wnext;
                          len -= op2;
                          do {
                            output[_out++] = s_window[from++];
                          } while (--op2);
                          from = _out - dist;
                          from_source = output;
                        }
                      }
                    } else {
                      from += wnext - op2;
                      if (op2 < len) {
                        len -= op2;
                        do {
                          output[_out++] = s_window[from++];
                        } while (--op2);
                        from = _out - dist;
                        from_source = output;
                      }
                    }
                    while (len > 2) {
                      output[_out++] = from_source[from++];
                      output[_out++] = from_source[from++];
                      output[_out++] = from_source[from++];
                      len -= 3;
                    }
                    if (len) {
                      output[_out++] = from_source[from++];
                      if (len > 1) {
                        output[_out++] = from_source[from++];
                      }
                    }
                  } else {
                    from = _out - dist;
                    do {
                      output[_out++] = output[from++];
                      output[_out++] = output[from++];
                      output[_out++] = output[from++];
                      len -= 3;
                    } while (len > 2);
                    if (len) {
                      output[_out++] = output[from++];
                      if (len > 1) {
                        output[_out++] = output[from++];
                      }
                    }
                  }
                } else if ((op2 & 64) === 0) {
                  here = dcode[(here & 65535) + (hold & (1 << op2) - 1)];
                  continue dodist;
                } else {
                  strm.msg = "invalid distance code";
                  state.mode = BAD;
                  break top;
                }
                break;
              }
          } else if ((op2 & 64) === 0) {
            here = lcode[(here & 65535) + (hold & (1 << op2) - 1)];
            continue dolen;
          } else if (op2 & 32) {
            state.mode = TYPE;
            break top;
          } else {
            strm.msg = "invalid literal/length code";
            state.mode = BAD;
            break top;
          }
          break;
        }
    } while (_in < last && _out < end);
  len = bits >> 3;
  _in -= len;
  bits -= len << 3;
  hold &= (1 << bits) - 1;
  strm.next_in = _in;
  strm.next_out = _out;
  strm.avail_in = _in < last ? 5 + (last - _in) : 5 - (_in - last);
  strm.avail_out = _out < end ? 257 + (end - _out) : 257 - (_out - end);
  state.hold = hold;
  state.bits = bits;
  return;
};
var MAXBITS = 15;
var ENOUGH_LENS = 852;
var ENOUGH_DISTS = 592;
var CODES = 0;
var LENS = 1;
var DISTS = 2;
var lbase = new Uint16Array([
  /* Length codes 257..285 base */
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  13,
  15,
  17,
  19,
  23,
  27,
  31,
  35,
  43,
  51,
  59,
  67,
  83,
  99,
  115,
  131,
  163,
  195,
  227,
  258,
  0,
  0
]);
var lext = new Uint8Array([
  /* Length codes 257..285 extra */
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  17,
  17,
  17,
  17,
  18,
  18,
  18,
  18,
  19,
  19,
  19,
  19,
  20,
  20,
  20,
  20,
  21,
  21,
  21,
  21,
  16,
  72,
  78
]);
var dbase = new Uint16Array([
  /* Distance codes 0..29 base */
  1,
  2,
  3,
  4,
  5,
  7,
  9,
  13,
  17,
  25,
  33,
  49,
  65,
  97,
  129,
  193,
  257,
  385,
  513,
  769,
  1025,
  1537,
  2049,
  3073,
  4097,
  6145,
  8193,
  12289,
  16385,
  24577,
  0,
  0
]);
var dext = new Uint8Array([
  /* Distance codes 0..29 extra */
  16,
  16,
  16,
  16,
  17,
  17,
  18,
  18,
  19,
  19,
  20,
  20,
  21,
  21,
  22,
  22,
  23,
  23,
  24,
  24,
  25,
  25,
  26,
  26,
  27,
  27,
  28,
  28,
  29,
  29,
  64,
  64
]);
var inflate_table = (type, lens, lens_index, codes, table, table_index, work, opts) => {
  const bits = opts.bits;
  let len = 0;
  let sym = 0;
  let min = 0, max = 0;
  let root = 0;
  let curr = 0;
  let drop = 0;
  let left = 0;
  let used = 0;
  let huff = 0;
  let incr;
  let fill;
  let low;
  let mask;
  let next;
  let base = null;
  let base_index = 0;
  let end;
  const count = new Uint16Array(MAXBITS + 1);
  const offs = new Uint16Array(MAXBITS + 1);
  let extra = null;
  let extra_index = 0;
  let here_bits, here_op, here_val;
  for (len = 0; len <= MAXBITS; len++) {
    count[len] = 0;
  }
  for (sym = 0; sym < codes; sym++) {
    count[lens[lens_index + sym]]++;
  }
  root = bits;
  for (max = MAXBITS; max >= 1; max--) {
    if (count[max] !== 0) {
      break;
    }
  }
  if (root > max) {
    root = max;
  }
  if (max === 0) {
    table[table_index++] = 1 << 24 | 64 << 16 | 0;
    table[table_index++] = 1 << 24 | 64 << 16 | 0;
    opts.bits = 1;
    return 0;
  }
  for (min = 1; min < max; min++) {
    if (count[min] !== 0) {
      break;
    }
  }
  if (root < min) {
    root = min;
  }
  left = 1;
  for (len = 1; len <= MAXBITS; len++) {
    left <<= 1;
    left -= count[len];
    if (left < 0) {
      return -1;
    }
  }
  if (left > 0 && (type === CODES || max !== 1)) {
    return -1;
  }
  offs[1] = 0;
  for (len = 1; len < MAXBITS; len++) {
    offs[len + 1] = offs[len] + count[len];
  }
  for (sym = 0; sym < codes; sym++) {
    if (lens[lens_index + sym] !== 0) {
      work[offs[lens[lens_index + sym]]++] = sym;
    }
  }
  if (type === CODES) {
    base = extra = work;
    end = 19;
  } else if (type === LENS) {
    base = lbase;
    base_index -= 257;
    extra = lext;
    extra_index -= 257;
    end = 256;
  } else {
    base = dbase;
    extra = dext;
    end = -1;
  }
  huff = 0;
  sym = 0;
  len = min;
  next = table_index;
  curr = root;
  drop = 0;
  low = -1;
  used = 1 << root;
  mask = used - 1;
  if (type === LENS && used > ENOUGH_LENS || type === DISTS && used > ENOUGH_DISTS) {
    return 1;
  }
  for (; ; ) {
    here_bits = len - drop;
    if (work[sym] < end) {
      here_op = 0;
      here_val = work[sym];
    } else if (work[sym] > end) {
      here_op = extra[extra_index + work[sym]];
      here_val = base[base_index + work[sym]];
    } else {
      here_op = 32 + 64;
      here_val = 0;
    }
    incr = 1 << len - drop;
    fill = 1 << curr;
    min = fill;
    do {
      fill -= incr;
      table[next + (huff >> drop) + fill] = here_bits << 24 | here_op << 16 | here_val | 0;
    } while (fill !== 0);
    incr = 1 << len - 1;
    while (huff & incr) {
      incr >>= 1;
    }
    if (incr !== 0) {
      huff &= incr - 1;
      huff += incr;
    } else {
      huff = 0;
    }
    sym++;
    if (--count[len] === 0) {
      if (len === max) {
        break;
      }
      len = lens[lens_index + work[sym]];
    }
    if (len > root && (huff & mask) !== low) {
      if (drop === 0) {
        drop = root;
      }
      next += min;
      curr = len - drop;
      left = 1 << curr;
      while (curr + drop < max) {
        left -= count[curr + drop];
        if (left <= 0) {
          break;
        }
        curr++;
        left <<= 1;
      }
      used += 1 << curr;
      if (type === LENS && used > ENOUGH_LENS || type === DISTS && used > ENOUGH_DISTS) {
        return 1;
      }
      low = huff & mask;
      table[low] = root << 24 | curr << 16 | next - table_index | 0;
    }
  }
  if (huff !== 0) {
    table[next + huff] = len - drop << 24 | 64 << 16 | 0;
  }
  opts.bits = root;
  return 0;
};
var inftrees = inflate_table;
var CODES$1 = 0;
var LENS$1 = 1;
var DISTS$1 = 2;
var {
  Z_FINISH: Z_FINISH$2,
  Z_BLOCK: Z_BLOCK$1,
  Z_TREES,
  Z_OK: Z_OK$2,
  Z_STREAM_END: Z_STREAM_END$2,
  Z_NEED_DICT,
  Z_STREAM_ERROR: Z_STREAM_ERROR$1,
  Z_DATA_ERROR: Z_DATA_ERROR$1,
  Z_MEM_ERROR,
  Z_BUF_ERROR: Z_BUF_ERROR$1,
  Z_DEFLATED: Z_DEFLATED$2
} = constants;
var HEAD = 1;
var FLAGS = 2;
var TIME = 3;
var OS = 4;
var EXLEN = 5;
var EXTRA = 6;
var NAME = 7;
var COMMENT = 8;
var HCRC = 9;
var DICTID = 10;
var DICT = 11;
var TYPE$1 = 12;
var TYPEDO = 13;
var STORED = 14;
var COPY_ = 15;
var COPY = 16;
var TABLE = 17;
var LENLENS = 18;
var CODELENS = 19;
var LEN_ = 20;
var LEN = 21;
var LENEXT = 22;
var DIST = 23;
var DISTEXT = 24;
var MATCH = 25;
var LIT = 26;
var CHECK = 27;
var LENGTH = 28;
var DONE = 29;
var BAD$1 = 30;
var MEM = 31;
var SYNC = 32;
var ENOUGH_LENS$1 = 852;
var ENOUGH_DISTS$1 = 592;
var MAX_WBITS$1 = 15;
var DEF_WBITS = MAX_WBITS$1;
var zswap32 = (q3) => {
  return (q3 >>> 24 & 255) + (q3 >>> 8 & 65280) + ((q3 & 65280) << 8) + ((q3 & 255) << 24);
};
function InflateState() {
  this.mode = 0;
  this.last = false;
  this.wrap = 0;
  this.havedict = false;
  this.flags = 0;
  this.dmax = 0;
  this.check = 0;
  this.total = 0;
  this.head = null;
  this.wbits = 0;
  this.wsize = 0;
  this.whave = 0;
  this.wnext = 0;
  this.window = null;
  this.hold = 0;
  this.bits = 0;
  this.length = 0;
  this.offset = 0;
  this.extra = 0;
  this.lencode = null;
  this.distcode = null;
  this.lenbits = 0;
  this.distbits = 0;
  this.ncode = 0;
  this.nlen = 0;
  this.ndist = 0;
  this.have = 0;
  this.next = null;
  this.lens = new Uint16Array(320);
  this.work = new Uint16Array(288);
  this.lendyn = null;
  this.distdyn = null;
  this.sane = 0;
  this.back = 0;
  this.was = 0;
}
var inflateResetKeep = (strm) => {
  if (!strm || !strm.state) {
    return Z_STREAM_ERROR$1;
  }
  const state = strm.state;
  strm.total_in = strm.total_out = state.total = 0;
  strm.msg = "";
  if (state.wrap) {
    strm.adler = state.wrap & 1;
  }
  state.mode = HEAD;
  state.last = 0;
  state.havedict = 0;
  state.dmax = 32768;
  state.head = null;
  state.hold = 0;
  state.bits = 0;
  state.lencode = state.lendyn = new Int32Array(ENOUGH_LENS$1);
  state.distcode = state.distdyn = new Int32Array(ENOUGH_DISTS$1);
  state.sane = 1;
  state.back = -1;
  return Z_OK$2;
};
var inflateReset = (strm) => {
  if (!strm || !strm.state) {
    return Z_STREAM_ERROR$1;
  }
  const state = strm.state;
  state.wsize = 0;
  state.whave = 0;
  state.wnext = 0;
  return inflateResetKeep(strm);
};
var inflateReset2 = (strm, windowBits) => {
  let wrap;
  if (!strm || !strm.state) {
    return Z_STREAM_ERROR$1;
  }
  const state = strm.state;
  if (windowBits < 0) {
    wrap = 0;
    windowBits = -windowBits;
  } else {
    wrap = (windowBits >> 4) + 1;
    if (windowBits < 48) {
      windowBits &= 15;
    }
  }
  if (windowBits && (windowBits < 8 || windowBits > 15)) {
    return Z_STREAM_ERROR$1;
  }
  if (state.window !== null && state.wbits !== windowBits) {
    state.window = null;
  }
  state.wrap = wrap;
  state.wbits = windowBits;
  return inflateReset(strm);
};
var inflateInit2 = (strm, windowBits) => {
  if (!strm) {
    return Z_STREAM_ERROR$1;
  }
  const state = new InflateState();
  strm.state = state;
  state.window = null;
  const ret = inflateReset2(strm, windowBits);
  if (ret !== Z_OK$2) {
    strm.state = null;
  }
  return ret;
};
var inflateInit = (strm) => {
  return inflateInit2(strm, DEF_WBITS);
};
var virgin = true;
var lenfix;
var distfix;
var fixedtables = (state) => {
  if (virgin) {
    lenfix = new Int32Array(512);
    distfix = new Int32Array(32);
    let sym = 0;
    while (sym < 144) {
      state.lens[sym++] = 8;
    }
    while (sym < 256) {
      state.lens[sym++] = 9;
    }
    while (sym < 280) {
      state.lens[sym++] = 7;
    }
    while (sym < 288) {
      state.lens[sym++] = 8;
    }
    inftrees(LENS$1, state.lens, 0, 288, lenfix, 0, state.work, { bits: 9 });
    sym = 0;
    while (sym < 32) {
      state.lens[sym++] = 5;
    }
    inftrees(DISTS$1, state.lens, 0, 32, distfix, 0, state.work, { bits: 5 });
    virgin = false;
  }
  state.lencode = lenfix;
  state.lenbits = 9;
  state.distcode = distfix;
  state.distbits = 5;
};
var updatewindow = (strm, src, end, copy) => {
  let dist;
  const state = strm.state;
  if (state.window === null) {
    state.wsize = 1 << state.wbits;
    state.wnext = 0;
    state.whave = 0;
    state.window = new Uint8Array(state.wsize);
  }
  if (copy >= state.wsize) {
    state.window.set(src.subarray(end - state.wsize, end), 0);
    state.wnext = 0;
    state.whave = state.wsize;
  } else {
    dist = state.wsize - state.wnext;
    if (dist > copy) {
      dist = copy;
    }
    state.window.set(src.subarray(end - copy, end - copy + dist), state.wnext);
    copy -= dist;
    if (copy) {
      state.window.set(src.subarray(end - copy, end), 0);
      state.wnext = copy;
      state.whave = state.wsize;
    } else {
      state.wnext += dist;
      if (state.wnext === state.wsize) {
        state.wnext = 0;
      }
      if (state.whave < state.wsize) {
        state.whave += dist;
      }
    }
  }
  return 0;
};
var inflate = (strm, flush) => {
  let state;
  let input, output;
  let next;
  let put;
  let have, left;
  let hold;
  let bits;
  let _in, _out;
  let copy;
  let from;
  let from_source;
  let here = 0;
  let here_bits, here_op, here_val;
  let last_bits, last_op, last_val;
  let len;
  let ret;
  const hbuf = new Uint8Array(4);
  let opts;
  let n3;
  const order = (
    /* permutation of code lengths */
    new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15])
  );
  if (!strm || !strm.state || !strm.output || !strm.input && strm.avail_in !== 0) {
    return Z_STREAM_ERROR$1;
  }
  state = strm.state;
  if (state.mode === TYPE$1) {
    state.mode = TYPEDO;
  }
  put = strm.next_out;
  output = strm.output;
  left = strm.avail_out;
  next = strm.next_in;
  input = strm.input;
  have = strm.avail_in;
  hold = state.hold;
  bits = state.bits;
  _in = have;
  _out = left;
  ret = Z_OK$2;
  inf_leave:
    for (; ; ) {
      switch (state.mode) {
        case HEAD:
          if (state.wrap === 0) {
            state.mode = TYPEDO;
            break;
          }
          while (bits < 16) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (state.wrap & 2 && hold === 35615) {
            state.check = 0;
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            state.check = crc32_1(state.check, hbuf, 2, 0);
            hold = 0;
            bits = 0;
            state.mode = FLAGS;
            break;
          }
          state.flags = 0;
          if (state.head) {
            state.head.done = false;
          }
          if (!(state.wrap & 1) || /* check if zlib header allowed */
          (((hold & 255) << 8) + (hold >> 8)) % 31) {
            strm.msg = "incorrect header check";
            state.mode = BAD$1;
            break;
          }
          if ((hold & 15) !== Z_DEFLATED$2) {
            strm.msg = "unknown compression method";
            state.mode = BAD$1;
            break;
          }
          hold >>>= 4;
          bits -= 4;
          len = (hold & 15) + 8;
          if (state.wbits === 0) {
            state.wbits = len;
          } else if (len > state.wbits) {
            strm.msg = "invalid window size";
            state.mode = BAD$1;
            break;
          }
          state.dmax = 1 << state.wbits;
          strm.adler = state.check = 1;
          state.mode = hold & 512 ? DICTID : TYPE$1;
          hold = 0;
          bits = 0;
          break;
        case FLAGS:
          while (bits < 16) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state.flags = hold;
          if ((state.flags & 255) !== Z_DEFLATED$2) {
            strm.msg = "unknown compression method";
            state.mode = BAD$1;
            break;
          }
          if (state.flags & 57344) {
            strm.msg = "unknown header flags set";
            state.mode = BAD$1;
            break;
          }
          if (state.head) {
            state.head.text = hold >> 8 & 1;
          }
          if (state.flags & 512) {
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            state.check = crc32_1(state.check, hbuf, 2, 0);
          }
          hold = 0;
          bits = 0;
          state.mode = TIME;
        case TIME:
          while (bits < 32) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (state.head) {
            state.head.time = hold;
          }
          if (state.flags & 512) {
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            hbuf[2] = hold >>> 16 & 255;
            hbuf[3] = hold >>> 24 & 255;
            state.check = crc32_1(state.check, hbuf, 4, 0);
          }
          hold = 0;
          bits = 0;
          state.mode = OS;
        case OS:
          while (bits < 16) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (state.head) {
            state.head.xflags = hold & 255;
            state.head.os = hold >> 8;
          }
          if (state.flags & 512) {
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            state.check = crc32_1(state.check, hbuf, 2, 0);
          }
          hold = 0;
          bits = 0;
          state.mode = EXLEN;
        case EXLEN:
          if (state.flags & 1024) {
            while (bits < 16) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.length = hold;
            if (state.head) {
              state.head.extra_len = hold;
            }
            if (state.flags & 512) {
              hbuf[0] = hold & 255;
              hbuf[1] = hold >>> 8 & 255;
              state.check = crc32_1(state.check, hbuf, 2, 0);
            }
            hold = 0;
            bits = 0;
          } else if (state.head) {
            state.head.extra = null;
          }
          state.mode = EXTRA;
        case EXTRA:
          if (state.flags & 1024) {
            copy = state.length;
            if (copy > have) {
              copy = have;
            }
            if (copy) {
              if (state.head) {
                len = state.head.extra_len - state.length;
                if (!state.head.extra) {
                  state.head.extra = new Uint8Array(state.head.extra_len);
                }
                state.head.extra.set(
                  input.subarray(
                    next,
                    // extra field is limited to 65536 bytes
                    // - no need for additional size check
                    next + copy
                  ),
                  /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
                  len
                );
              }
              if (state.flags & 512) {
                state.check = crc32_1(state.check, input, copy, next);
              }
              have -= copy;
              next += copy;
              state.length -= copy;
            }
            if (state.length) {
              break inf_leave;
            }
          }
          state.length = 0;
          state.mode = NAME;
        case NAME:
          if (state.flags & 2048) {
            if (have === 0) {
              break inf_leave;
            }
            copy = 0;
            do {
              len = input[next + copy++];
              if (state.head && len && state.length < 65536) {
                state.head.name += String.fromCharCode(len);
              }
            } while (len && copy < have);
            if (state.flags & 512) {
              state.check = crc32_1(state.check, input, copy, next);
            }
            have -= copy;
            next += copy;
            if (len) {
              break inf_leave;
            }
          } else if (state.head) {
            state.head.name = null;
          }
          state.length = 0;
          state.mode = COMMENT;
        case COMMENT:
          if (state.flags & 4096) {
            if (have === 0) {
              break inf_leave;
            }
            copy = 0;
            do {
              len = input[next + copy++];
              if (state.head && len && state.length < 65536) {
                state.head.comment += String.fromCharCode(len);
              }
            } while (len && copy < have);
            if (state.flags & 512) {
              state.check = crc32_1(state.check, input, copy, next);
            }
            have -= copy;
            next += copy;
            if (len) {
              break inf_leave;
            }
          } else if (state.head) {
            state.head.comment = null;
          }
          state.mode = HCRC;
        case HCRC:
          if (state.flags & 512) {
            while (bits < 16) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (hold !== (state.check & 65535)) {
              strm.msg = "header crc mismatch";
              state.mode = BAD$1;
              break;
            }
            hold = 0;
            bits = 0;
          }
          if (state.head) {
            state.head.hcrc = state.flags >> 9 & 1;
            state.head.done = true;
          }
          strm.adler = state.check = 0;
          state.mode = TYPE$1;
          break;
        case DICTID:
          while (bits < 32) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          strm.adler = state.check = zswap32(hold);
          hold = 0;
          bits = 0;
          state.mode = DICT;
        case DICT:
          if (state.havedict === 0) {
            strm.next_out = put;
            strm.avail_out = left;
            strm.next_in = next;
            strm.avail_in = have;
            state.hold = hold;
            state.bits = bits;
            return Z_NEED_DICT;
          }
          strm.adler = state.check = 1;
          state.mode = TYPE$1;
        case TYPE$1:
          if (flush === Z_BLOCK$1 || flush === Z_TREES) {
            break inf_leave;
          }
        case TYPEDO:
          if (state.last) {
            hold >>>= bits & 7;
            bits -= bits & 7;
            state.mode = CHECK;
            break;
          }
          while (bits < 3) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state.last = hold & 1;
          hold >>>= 1;
          bits -= 1;
          switch (hold & 3) {
            case 0:
              state.mode = STORED;
              break;
            case 1:
              fixedtables(state);
              state.mode = LEN_;
              if (flush === Z_TREES) {
                hold >>>= 2;
                bits -= 2;
                break inf_leave;
              }
              break;
            case 2:
              state.mode = TABLE;
              break;
            case 3:
              strm.msg = "invalid block type";
              state.mode = BAD$1;
          }
          hold >>>= 2;
          bits -= 2;
          break;
        case STORED:
          hold >>>= bits & 7;
          bits -= bits & 7;
          while (bits < 32) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if ((hold & 65535) !== (hold >>> 16 ^ 65535)) {
            strm.msg = "invalid stored block lengths";
            state.mode = BAD$1;
            break;
          }
          state.length = hold & 65535;
          hold = 0;
          bits = 0;
          state.mode = COPY_;
          if (flush === Z_TREES) {
            break inf_leave;
          }
        case COPY_:
          state.mode = COPY;
        case COPY:
          copy = state.length;
          if (copy) {
            if (copy > have) {
              copy = have;
            }
            if (copy > left) {
              copy = left;
            }
            if (copy === 0) {
              break inf_leave;
            }
            output.set(input.subarray(next, next + copy), put);
            have -= copy;
            next += copy;
            left -= copy;
            put += copy;
            state.length -= copy;
            break;
          }
          state.mode = TYPE$1;
          break;
        case TABLE:
          while (bits < 14) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state.nlen = (hold & 31) + 257;
          hold >>>= 5;
          bits -= 5;
          state.ndist = (hold & 31) + 1;
          hold >>>= 5;
          bits -= 5;
          state.ncode = (hold & 15) + 4;
          hold >>>= 4;
          bits -= 4;
          if (state.nlen > 286 || state.ndist > 30) {
            strm.msg = "too many length or distance symbols";
            state.mode = BAD$1;
            break;
          }
          state.have = 0;
          state.mode = LENLENS;
        case LENLENS:
          while (state.have < state.ncode) {
            while (bits < 3) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.lens[order[state.have++]] = hold & 7;
            hold >>>= 3;
            bits -= 3;
          }
          while (state.have < 19) {
            state.lens[order[state.have++]] = 0;
          }
          state.lencode = state.lendyn;
          state.lenbits = 7;
          opts = { bits: state.lenbits };
          ret = inftrees(CODES$1, state.lens, 0, 19, state.lencode, 0, state.work, opts);
          state.lenbits = opts.bits;
          if (ret) {
            strm.msg = "invalid code lengths set";
            state.mode = BAD$1;
            break;
          }
          state.have = 0;
          state.mode = CODELENS;
        case CODELENS:
          while (state.have < state.nlen + state.ndist) {
            for (; ; ) {
              here = state.lencode[hold & (1 << state.lenbits) - 1];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (here_bits <= bits) {
                break;
              }
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (here_val < 16) {
              hold >>>= here_bits;
              bits -= here_bits;
              state.lens[state.have++] = here_val;
            } else {
              if (here_val === 16) {
                n3 = here_bits + 2;
                while (bits < n3) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                hold >>>= here_bits;
                bits -= here_bits;
                if (state.have === 0) {
                  strm.msg = "invalid bit length repeat";
                  state.mode = BAD$1;
                  break;
                }
                len = state.lens[state.have - 1];
                copy = 3 + (hold & 3);
                hold >>>= 2;
                bits -= 2;
              } else if (here_val === 17) {
                n3 = here_bits + 3;
                while (bits < n3) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                hold >>>= here_bits;
                bits -= here_bits;
                len = 0;
                copy = 3 + (hold & 7);
                hold >>>= 3;
                bits -= 3;
              } else {
                n3 = here_bits + 7;
                while (bits < n3) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                hold >>>= here_bits;
                bits -= here_bits;
                len = 0;
                copy = 11 + (hold & 127);
                hold >>>= 7;
                bits -= 7;
              }
              if (state.have + copy > state.nlen + state.ndist) {
                strm.msg = "invalid bit length repeat";
                state.mode = BAD$1;
                break;
              }
              while (copy--) {
                state.lens[state.have++] = len;
              }
            }
          }
          if (state.mode === BAD$1) {
            break;
          }
          if (state.lens[256] === 0) {
            strm.msg = "invalid code -- missing end-of-block";
            state.mode = BAD$1;
            break;
          }
          state.lenbits = 9;
          opts = { bits: state.lenbits };
          ret = inftrees(LENS$1, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts);
          state.lenbits = opts.bits;
          if (ret) {
            strm.msg = "invalid literal/lengths set";
            state.mode = BAD$1;
            break;
          }
          state.distbits = 6;
          state.distcode = state.distdyn;
          opts = { bits: state.distbits };
          ret = inftrees(DISTS$1, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts);
          state.distbits = opts.bits;
          if (ret) {
            strm.msg = "invalid distances set";
            state.mode = BAD$1;
            break;
          }
          state.mode = LEN_;
          if (flush === Z_TREES) {
            break inf_leave;
          }
        case LEN_:
          state.mode = LEN;
        case LEN:
          if (have >= 6 && left >= 258) {
            strm.next_out = put;
            strm.avail_out = left;
            strm.next_in = next;
            strm.avail_in = have;
            state.hold = hold;
            state.bits = bits;
            inffast(strm, _out);
            put = strm.next_out;
            output = strm.output;
            left = strm.avail_out;
            next = strm.next_in;
            input = strm.input;
            have = strm.avail_in;
            hold = state.hold;
            bits = state.bits;
            if (state.mode === TYPE$1) {
              state.back = -1;
            }
            break;
          }
          state.back = 0;
          for (; ; ) {
            here = state.lencode[hold & (1 << state.lenbits) - 1];
            here_bits = here >>> 24;
            here_op = here >>> 16 & 255;
            here_val = here & 65535;
            if (here_bits <= bits) {
              break;
            }
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (here_op && (here_op & 240) === 0) {
            last_bits = here_bits;
            last_op = here_op;
            last_val = here_val;
            for (; ; ) {
              here = state.lencode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (last_bits + here_bits <= bits) {
                break;
              }
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            hold >>>= last_bits;
            bits -= last_bits;
            state.back += last_bits;
          }
          hold >>>= here_bits;
          bits -= here_bits;
          state.back += here_bits;
          state.length = here_val;
          if (here_op === 0) {
            state.mode = LIT;
            break;
          }
          if (here_op & 32) {
            state.back = -1;
            state.mode = TYPE$1;
            break;
          }
          if (here_op & 64) {
            strm.msg = "invalid literal/length code";
            state.mode = BAD$1;
            break;
          }
          state.extra = here_op & 15;
          state.mode = LENEXT;
        case LENEXT:
          if (state.extra) {
            n3 = state.extra;
            while (bits < n3) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.length += hold & (1 << state.extra) - 1;
            hold >>>= state.extra;
            bits -= state.extra;
            state.back += state.extra;
          }
          state.was = state.length;
          state.mode = DIST;
        case DIST:
          for (; ; ) {
            here = state.distcode[hold & (1 << state.distbits) - 1];
            here_bits = here >>> 24;
            here_op = here >>> 16 & 255;
            here_val = here & 65535;
            if (here_bits <= bits) {
              break;
            }
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if ((here_op & 240) === 0) {
            last_bits = here_bits;
            last_op = here_op;
            last_val = here_val;
            for (; ; ) {
              here = state.distcode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (last_bits + here_bits <= bits) {
                break;
              }
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            hold >>>= last_bits;
            bits -= last_bits;
            state.back += last_bits;
          }
          hold >>>= here_bits;
          bits -= here_bits;
          state.back += here_bits;
          if (here_op & 64) {
            strm.msg = "invalid distance code";
            state.mode = BAD$1;
            break;
          }
          state.offset = here_val;
          state.extra = here_op & 15;
          state.mode = DISTEXT;
        case DISTEXT:
          if (state.extra) {
            n3 = state.extra;
            while (bits < n3) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.offset += hold & (1 << state.extra) - 1;
            hold >>>= state.extra;
            bits -= state.extra;
            state.back += state.extra;
          }
          if (state.offset > state.dmax) {
            strm.msg = "invalid distance too far back";
            state.mode = BAD$1;
            break;
          }
          state.mode = MATCH;
        case MATCH:
          if (left === 0) {
            break inf_leave;
          }
          copy = _out - left;
          if (state.offset > copy) {
            copy = state.offset - copy;
            if (copy > state.whave) {
              if (state.sane) {
                strm.msg = "invalid distance too far back";
                state.mode = BAD$1;
                break;
              }
            }
            if (copy > state.wnext) {
              copy -= state.wnext;
              from = state.wsize - copy;
            } else {
              from = state.wnext - copy;
            }
            if (copy > state.length) {
              copy = state.length;
            }
            from_source = state.window;
          } else {
            from_source = output;
            from = put - state.offset;
            copy = state.length;
          }
          if (copy > left) {
            copy = left;
          }
          left -= copy;
          state.length -= copy;
          do {
            output[put++] = from_source[from++];
          } while (--copy);
          if (state.length === 0) {
            state.mode = LEN;
          }
          break;
        case LIT:
          if (left === 0) {
            break inf_leave;
          }
          output[put++] = state.length;
          left--;
          state.mode = LEN;
          break;
        case CHECK:
          if (state.wrap) {
            while (bits < 32) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold |= input[next++] << bits;
              bits += 8;
            }
            _out -= left;
            strm.total_out += _out;
            state.total += _out;
            if (_out) {
              strm.adler = state.check = /*UPDATE(state.check, put - _out, _out);*/
              state.flags ? crc32_1(state.check, output, _out, put - _out) : adler32_1(state.check, output, _out, put - _out);
            }
            _out = left;
            if ((state.flags ? hold : zswap32(hold)) !== state.check) {
              strm.msg = "incorrect data check";
              state.mode = BAD$1;
              break;
            }
            hold = 0;
            bits = 0;
          }
          state.mode = LENGTH;
        case LENGTH:
          if (state.wrap && state.flags) {
            while (bits < 32) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (hold !== (state.total & 4294967295)) {
              strm.msg = "incorrect length check";
              state.mode = BAD$1;
              break;
            }
            hold = 0;
            bits = 0;
          }
          state.mode = DONE;
        case DONE:
          ret = Z_STREAM_END$2;
          break inf_leave;
        case BAD$1:
          ret = Z_DATA_ERROR$1;
          break inf_leave;
        case MEM:
          return Z_MEM_ERROR;
        case SYNC:
        default:
          return Z_STREAM_ERROR$1;
      }
    }
  strm.next_out = put;
  strm.avail_out = left;
  strm.next_in = next;
  strm.avail_in = have;
  state.hold = hold;
  state.bits = bits;
  if (state.wsize || _out !== strm.avail_out && state.mode < BAD$1 && (state.mode < CHECK || flush !== Z_FINISH$2)) {
    if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out)) ;
  }
  _in -= strm.avail_in;
  _out -= strm.avail_out;
  strm.total_in += _in;
  strm.total_out += _out;
  state.total += _out;
  if (state.wrap && _out) {
    strm.adler = state.check = /*UPDATE(state.check, strm.next_out - _out, _out);*/
    state.flags ? crc32_1(state.check, output, _out, strm.next_out - _out) : adler32_1(state.check, output, _out, strm.next_out - _out);
  }
  strm.data_type = state.bits + (state.last ? 64 : 0) + (state.mode === TYPE$1 ? 128 : 0) + (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0);
  if ((_in === 0 && _out === 0 || flush === Z_FINISH$2) && ret === Z_OK$2) {
    ret = Z_BUF_ERROR$1;
  }
  return ret;
};
var inflateEnd = (strm) => {
  if (!strm || !strm.state) {
    return Z_STREAM_ERROR$1;
  }
  let state = strm.state;
  if (state.window) {
    state.window = null;
  }
  strm.state = null;
  return Z_OK$2;
};
var inflateGetHeader = (strm, head) => {
  if (!strm || !strm.state) {
    return Z_STREAM_ERROR$1;
  }
  const state = strm.state;
  if ((state.wrap & 2) === 0) {
    return Z_STREAM_ERROR$1;
  }
  state.head = head;
  head.done = false;
  return Z_OK$2;
};
var inflateSetDictionary = (strm, dictionary) => {
  const dictLength = dictionary.length;
  let state;
  let dictid;
  let ret;
  if (!strm || !strm.state) {
    return Z_STREAM_ERROR$1;
  }
  state = strm.state;
  if (state.wrap !== 0 && state.mode !== DICT) {
    return Z_STREAM_ERROR$1;
  }
  if (state.mode === DICT) {
    dictid = 1;
    dictid = adler32_1(dictid, dictionary, dictLength, 0);
    if (dictid !== state.check) {
      return Z_DATA_ERROR$1;
    }
  }
  ret = updatewindow(strm, dictionary, dictLength, dictLength);
  if (ret) {
    state.mode = MEM;
    return Z_MEM_ERROR;
  }
  state.havedict = 1;
  return Z_OK$2;
};
var inflateReset_1 = inflateReset;
var inflateReset2_1 = inflateReset2;
var inflateResetKeep_1 = inflateResetKeep;
var inflateInit_1 = inflateInit;
var inflateInit2_1 = inflateInit2;
var inflate_2 = inflate;
var inflateEnd_1 = inflateEnd;
var inflateGetHeader_1 = inflateGetHeader;
var inflateSetDictionary_1 = inflateSetDictionary;
var inflateInfo = "pako inflate (from Nodeca project)";
var inflate_1 = {
  inflateReset: inflateReset_1,
  inflateReset2: inflateReset2_1,
  inflateResetKeep: inflateResetKeep_1,
  inflateInit: inflateInit_1,
  inflateInit2: inflateInit2_1,
  inflate: inflate_2,
  inflateEnd: inflateEnd_1,
  inflateGetHeader: inflateGetHeader_1,
  inflateSetDictionary: inflateSetDictionary_1,
  inflateInfo
};
function GZheader() {
  this.text = 0;
  this.time = 0;
  this.xflags = 0;
  this.os = 0;
  this.extra = null;
  this.extra_len = 0;
  this.name = "";
  this.comment = "";
  this.hcrc = 0;
  this.done = false;
}
var gzheader = GZheader;
var toString$1 = Object.prototype.toString;
var {
  Z_NO_FLUSH: Z_NO_FLUSH$2,
  Z_FINISH: Z_FINISH$3,
  Z_OK: Z_OK$3,
  Z_STREAM_END: Z_STREAM_END$3,
  Z_NEED_DICT: Z_NEED_DICT$1,
  Z_STREAM_ERROR: Z_STREAM_ERROR$2,
  Z_DATA_ERROR: Z_DATA_ERROR$2,
  Z_MEM_ERROR: Z_MEM_ERROR$1
} = constants;
function Inflate(options) {
  this.options = common.assign({
    chunkSize: 1024 * 64,
    windowBits: 15,
    to: ""
  }, options || {});
  const opt = this.options;
  if (opt.raw && opt.windowBits >= 0 && opt.windowBits < 16) {
    opt.windowBits = -opt.windowBits;
    if (opt.windowBits === 0) {
      opt.windowBits = -15;
    }
  }
  if (opt.windowBits >= 0 && opt.windowBits < 16 && !(options && options.windowBits)) {
    opt.windowBits += 32;
  }
  if (opt.windowBits > 15 && opt.windowBits < 48) {
    if ((opt.windowBits & 15) === 0) {
      opt.windowBits |= 15;
    }
  }
  this.err = 0;
  this.msg = "";
  this.ended = false;
  this.chunks = [];
  this.strm = new zstream();
  this.strm.avail_out = 0;
  let status = inflate_1.inflateInit2(
    this.strm,
    opt.windowBits
  );
  if (status !== Z_OK$3) {
    throw new Error(messages[status]);
  }
  this.header = new gzheader();
  inflate_1.inflateGetHeader(this.strm, this.header);
  if (opt.dictionary) {
    if (typeof opt.dictionary === "string") {
      opt.dictionary = strings.string2buf(opt.dictionary);
    } else if (toString$1.call(opt.dictionary) === "[object ArrayBuffer]") {
      opt.dictionary = new Uint8Array(opt.dictionary);
    }
    if (opt.raw) {
      status = inflate_1.inflateSetDictionary(this.strm, opt.dictionary);
      if (status !== Z_OK$3) {
        throw new Error(messages[status]);
      }
    }
  }
}
Inflate.prototype.push = function(data, flush_mode) {
  const strm = this.strm;
  const chunkSize = this.options.chunkSize;
  const dictionary = this.options.dictionary;
  let status, _flush_mode, last_avail_out;
  if (this.ended) return false;
  if (flush_mode === ~~flush_mode) _flush_mode = flush_mode;
  else _flush_mode = flush_mode === true ? Z_FINISH$3 : Z_NO_FLUSH$2;
  if (toString$1.call(data) === "[object ArrayBuffer]") {
    strm.input = new Uint8Array(data);
  } else {
    strm.input = data;
  }
  strm.next_in = 0;
  strm.avail_in = strm.input.length;
  for (; ; ) {
    if (strm.avail_out === 0) {
      strm.output = new Uint8Array(chunkSize);
      strm.next_out = 0;
      strm.avail_out = chunkSize;
    }
    status = inflate_1.inflate(strm, _flush_mode);
    if (status === Z_NEED_DICT$1 && dictionary) {
      status = inflate_1.inflateSetDictionary(strm, dictionary);
      if (status === Z_OK$3) {
        status = inflate_1.inflate(strm, _flush_mode);
      } else if (status === Z_DATA_ERROR$2) {
        status = Z_NEED_DICT$1;
      }
    }
    while (strm.avail_in > 0 && status === Z_STREAM_END$3 && strm.state.wrap > 0 && data[strm.next_in] !== 0) {
      inflate_1.inflateReset(strm);
      status = inflate_1.inflate(strm, _flush_mode);
    }
    switch (status) {
      case Z_STREAM_ERROR$2:
      case Z_DATA_ERROR$2:
      case Z_NEED_DICT$1:
      case Z_MEM_ERROR$1:
        this.onEnd(status);
        this.ended = true;
        return false;
    }
    last_avail_out = strm.avail_out;
    if (strm.next_out) {
      if (strm.avail_out === 0 || status === Z_STREAM_END$3) {
        if (this.options.to === "string") {
          let next_out_utf8 = strings.utf8border(strm.output, strm.next_out);
          let tail = strm.next_out - next_out_utf8;
          let utf8str = strings.buf2string(strm.output, next_out_utf8);
          strm.next_out = tail;
          strm.avail_out = chunkSize - tail;
          if (tail) strm.output.set(strm.output.subarray(next_out_utf8, next_out_utf8 + tail), 0);
          this.onData(utf8str);
        } else {
          this.onData(strm.output.length === strm.next_out ? strm.output : strm.output.subarray(0, strm.next_out));
        }
      }
    }
    if (status === Z_OK$3 && last_avail_out === 0) continue;
    if (status === Z_STREAM_END$3) {
      status = inflate_1.inflateEnd(this.strm);
      this.onEnd(status);
      this.ended = true;
      return true;
    }
    if (strm.avail_in === 0) break;
  }
  return true;
};
Inflate.prototype.onData = function(chunk) {
  this.chunks.push(chunk);
};
Inflate.prototype.onEnd = function(status) {
  if (status === Z_OK$3) {
    if (this.options.to === "string") {
      this.result = this.chunks.join("");
    } else {
      this.result = common.flattenChunks(this.chunks);
    }
  }
  this.chunks = [];
  this.err = status;
  this.msg = this.strm.msg;
};
function inflate$1(input, options) {
  const inflator = new Inflate(options);
  inflator.push(input);
  if (inflator.err) throw inflator.msg || messages[inflator.err];
  return inflator.result;
}
function inflateRaw(input, options) {
  options = options || {};
  options.raw = true;
  return inflate$1(input, options);
}
var Inflate_1 = Inflate;
var inflate_2$1 = inflate$1;
var inflateRaw_1 = inflateRaw;
var ungzip = inflate$1;
var constants$2 = constants;
var inflate_1$1 = {
  Inflate: Inflate_1,
  inflate: inflate_2$1,
  inflateRaw: inflateRaw_1,
  ungzip,
  constants: constants$2
};
var { Deflate: Deflate$1, deflate: deflate$2, deflateRaw: deflateRaw$1, gzip: gzip$1 } = deflate_1$1;
var { Inflate: Inflate$1, inflate: inflate$2, inflateRaw: inflateRaw$1, ungzip: ungzip$1 } = inflate_1$1;
var deflate_1$2 = deflate$2;
var inflate_1$2 = inflate$2;

// node_modules/.pnpm/@excalidraw+excalidraw@0.18.1_@types+react-dom@18.3.7_@types+react@18.3.28__@types+reac_35ce6435019f999df7993d08bf01f01f/node_modules/@excalidraw/excalidraw/dist/prod/chunk-K2UTITRG.js
var import_lodash = __toESM(require_lodash(), 1);
var import_es6_promise_pool = __toESM(require_es6_promise_pool(), 1);

// node_modules/.pnpm/perfect-freehand@1.2.0/node_modules/perfect-freehand/dist/esm/index.js
function $(e8, t3, u3, x = (h) => h) {
  return e8 * x(0.5 - t3 * (0.5 - u3));
}
function se(e8) {
  return [-e8[0], -e8[1]];
}
function l(e8, t3) {
  return [e8[0] + t3[0], e8[1] + t3[1]];
}
function a(e8, t3) {
  return [e8[0] - t3[0], e8[1] - t3[1]];
}
function b(e8, t3) {
  return [e8[0] * t3, e8[1] * t3];
}
function he(e8, t3) {
  return [e8[0] / t3, e8[1] / t3];
}
function R(e8) {
  return [e8[1], -e8[0]];
}
function B(e8, t3) {
  return e8[0] * t3[0] + e8[1] * t3[1];
}
function ue(e8, t3) {
  return e8[0] === t3[0] && e8[1] === t3[1];
}
function ge(e8) {
  return Math.hypot(e8[0], e8[1]);
}
function de(e8) {
  return e8[0] * e8[0] + e8[1] * e8[1];
}
function A(e8, t3) {
  return de(a(e8, t3));
}
function G(e8) {
  return he(e8, ge(e8));
}
function ie(e8, t3) {
  return Math.hypot(e8[1] - t3[1], e8[0] - t3[0]);
}
function L(e8, t3, u3) {
  let x = Math.sin(u3), h = Math.cos(u3), y = e8[0] - t3[0], n3 = e8[1] - t3[1], f = y * h - n3 * x, d = y * x + n3 * h;
  return [f + t3[0], d + t3[1]];
}
function K(e8, t3, u3) {
  return l(e8, b(a(t3, e8), u3));
}
function ee(e8, t3, u3) {
  return l(e8, b(t3, u3));
}
var { min: C, PI: xe } = Math;
var pe = 0.275;
var V = xe + 1e-4;
function ce(e8, t3 = {}) {
  let { size: u3 = 16, smoothing: x = 0.5, thinning: h = 0.5, simulatePressure: y = true, easing: n3 = (r) => r, start: f = {}, end: d = {}, last: D = false } = t3, { cap: S = true, easing: j = (r) => r * (2 - r) } = f, { cap: q3 = true, easing: c3 = (r) => --r * r * r + 1 } = d;
  if (e8.length === 0 || u3 <= 0) return [];
  let p = e8[e8.length - 1].runningLength, g = f.taper === false ? 0 : f.taper === true ? Math.max(u3, p) : f.taper, T3 = d.taper === false ? 0 : d.taper === true ? Math.max(u3, p) : d.taper, te2 = Math.pow(u3 * x, 2), _ = [], M = [], H3 = e8.slice(0, 10).reduce((r, i3) => {
    let o3 = i3.pressure;
    if (y) {
      let s3 = C(1, i3.distance / u3), W = C(1, 1 - s3);
      o3 = C(1, r + (W - r) * (s3 * pe));
    }
    return (r + o3) / 2;
  }, e8[0].pressure), m = $(u3, h, e8[e8.length - 1].pressure, n3), U, X3 = e8[0].vector, z3 = e8[0].point, F3 = z3, O3 = z3, E = F3, J = false;
  for (let r = 0; r < e8.length; r++) {
    let { pressure: i3 } = e8[r], { point: o3, vector: s3, distance: W, runningLength: I } = e8[r];
    if (r < e8.length - 1 && p - I < 3) continue;
    if (h) {
      if (y) {
        let v = C(1, W / u3), Z3 = C(1, 1 - v);
        i3 = C(1, H3 + (Z3 - H3) * (v * pe));
      }
      m = $(u3, h, i3, n3);
    } else m = u3 / 2;
    U === void 0 && (U = m);
    let le2 = I < g ? j(I / g) : 1, fe = p - I < T3 ? c3((p - I) / T3) : 1;
    m = Math.max(0.01, m * Math.min(le2, fe));
    let re2 = (r < e8.length - 1 ? e8[r + 1] : e8[r]).vector, Y3 = r < e8.length - 1 ? B(s3, re2) : 1, be = B(s3, X3) < 0 && !J, ne3 = Y3 !== null && Y3 < 0;
    if (be || ne3) {
      let v = b(R(X3), m);
      for (let Z3 = 1 / 13, w = 0; w <= 1; w += Z3) O3 = L(a(o3, v), o3, V * w), _.push(O3), E = L(l(o3, v), o3, V * -w), M.push(E);
      z3 = O3, F3 = E, ne3 && (J = true);
      continue;
    }
    if (J = false, r === e8.length - 1) {
      let v = b(R(s3), m);
      _.push(a(o3, v)), M.push(l(o3, v));
      continue;
    }
    let oe2 = b(R(K(re2, s3, Y3)), m);
    O3 = a(o3, oe2), (r <= 1 || A(z3, O3) > te2) && (_.push(O3), z3 = O3), E = l(o3, oe2), (r <= 1 || A(F3, E) > te2) && (M.push(E), F3 = E), H3 = i3, X3 = s3;
  }
  let P = e8[0].point.slice(0, 2), k2 = e8.length > 1 ? e8[e8.length - 1].point.slice(0, 2) : l(e8[0].point, [1, 1]), Q3 = [], N = [];
  if (e8.length === 1) {
    if (!(g || T3) || D) {
      let r = ee(P, G(R(a(P, k2))), -(U || m)), i3 = [];
      for (let o3 = 1 / 13, s3 = o3; s3 <= 1; s3 += o3) i3.push(L(r, P, V * 2 * s3));
      return i3;
    }
  } else {
    if (!(g || T3 && e8.length === 1)) if (S) for (let i3 = 1 / 13, o3 = i3; o3 <= 1; o3 += i3) {
      let s3 = L(M[0], P, V * o3);
      Q3.push(s3);
    }
    else {
      let i3 = a(_[0], M[0]), o3 = b(i3, 0.5), s3 = b(i3, 0.51);
      Q3.push(a(P, o3), a(P, s3), l(P, s3), l(P, o3));
    }
    let r = R(se(e8[e8.length - 1].vector));
    if (T3 || g && e8.length === 1) N.push(k2);
    else if (q3) {
      let i3 = ee(k2, r, m);
      for (let o3 = 1 / 29, s3 = o3; s3 < 1; s3 += o3) N.push(L(i3, k2, V * 3 * s3));
    } else N.push(l(k2, b(r, m)), l(k2, b(r, m * 0.99)), a(k2, b(r, m * 0.99)), a(k2, b(r, m)));
  }
  return _.concat(N, M.reverse(), Q3);
}
function me(e8, t3 = {}) {
  var q3;
  let { streamline: u3 = 0.5, size: x = 16, last: h = false } = t3;
  if (e8.length === 0) return [];
  let y = 0.15 + (1 - u3) * 0.85, n3 = Array.isArray(e8[0]) ? e8 : e8.map(({ x: c3, y: p, pressure: g = 0.5 }) => [c3, p, g]);
  if (n3.length === 2) {
    let c3 = n3[1];
    n3 = n3.slice(0, -1);
    for (let p = 1; p < 5; p++) n3.push(K(n3[0], c3, p / 4));
  }
  n3.length === 1 && (n3 = [...n3, [...l(n3[0], [1, 1]), ...n3[0].slice(2)]]);
  let f = [{ point: [n3[0][0], n3[0][1]], pressure: n3[0][2] >= 0 ? n3[0][2] : 0.25, vector: [1, 1], distance: 0, runningLength: 0 }], d = false, D = 0, S = f[0], j = n3.length - 1;
  for (let c3 = 1; c3 < n3.length; c3++) {
    let p = h && c3 === j ? n3[c3].slice(0, 2) : K(S.point, n3[c3], y);
    if (ue(S.point, p)) continue;
    let g = ie(p, S.point);
    if (D += g, c3 < j && !d) {
      if (D < x) continue;
      d = true;
    }
    S = { point: p, pressure: n3[c3][2] >= 0 ? n3[c3][2] : 0.5, vector: G(a(S.point, p)), distance: g, runningLength: D }, f.push(S);
  }
  return f[0].vector = ((q3 = f[1]) == null ? void 0 : q3.vector) || [0, 0], f;
}
function ae(e8, t3 = {}) {
  return ce(me(e8, t3), t3);
}

// node_modules/.pnpm/@excalidraw+excalidraw@0.18.1_@types+react-dom@18.3.7_@types+react@18.3.28__@types+reac_35ce6435019f999df7993d08bf01f01f/node_modules/@excalidraw/excalidraw/dist/prod/chunk-K2UTITRG.js
init_neon_pilot_shared_react();

// node_modules/.pnpm/points-on-curve@1.0.1/node_modules/points-on-curve/lib/index.js
function distance2(p12, p22) {
  return Math.sqrt(distanceSq2(p12, p22));
}
function distanceSq2(p12, p22) {
  return Math.pow(p12[0] - p22[0], 2) + Math.pow(p12[1] - p22[1], 2);
}
function distanceToSegmentSq2(p, v, w) {
  const l22 = distanceSq2(v, w);
  if (l22 === 0) {
    return distanceSq2(p, v);
  }
  let t3 = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l22;
  t3 = Math.max(0, Math.min(1, t3));
  return distanceSq2(p, lerp2(v, w, t3));
}
function lerp2(a3, b3, t3) {
  return [
    a3[0] + (b3[0] - a3[0]) * t3,
    a3[1] + (b3[1] - a3[1]) * t3
  ];
}
function flatness2(points, offset) {
  const p12 = points[offset + 0];
  const p22 = points[offset + 1];
  const p3 = points[offset + 2];
  const p42 = points[offset + 3];
  let ux2 = 3 * p22[0] - 2 * p12[0] - p42[0];
  ux2 *= ux2;
  let uy = 3 * p22[1] - 2 * p12[1] - p42[1];
  uy *= uy;
  let vx2 = 3 * p3[0] - 2 * p42[0] - p12[0];
  vx2 *= vx2;
  let vy = 3 * p3[1] - 2 * p42[1] - p12[1];
  vy *= vy;
  if (ux2 < vx2) {
    ux2 = vx2;
  }
  if (uy < vy) {
    uy = vy;
  }
  return ux2 + uy;
}
function getPointsOnBezierCurveWithSplitting2(points, offset, tolerance, newPoints) {
  const outPoints = newPoints || [];
  if (flatness2(points, offset) < tolerance) {
    const p0 = points[offset + 0];
    if (outPoints.length) {
      const d = distance2(outPoints[outPoints.length - 1], p0);
      if (d > 1) {
        outPoints.push(p0);
      }
    } else {
      outPoints.push(p0);
    }
    outPoints.push(points[offset + 3]);
  } else {
    const t3 = 0.5;
    const p12 = points[offset + 0];
    const p22 = points[offset + 1];
    const p3 = points[offset + 2];
    const p42 = points[offset + 3];
    const q12 = lerp2(p12, p22, t3);
    const q22 = lerp2(p22, p3, t3);
    const q3 = lerp2(p3, p42, t3);
    const r12 = lerp2(q12, q22, t3);
    const r22 = lerp2(q22, q3, t3);
    const red = lerp2(r12, r22, t3);
    getPointsOnBezierCurveWithSplitting2([p12, q12, r12, red], 0, tolerance, outPoints);
    getPointsOnBezierCurveWithSplitting2([red, r22, q3, p42], 0, tolerance, outPoints);
  }
  return outPoints;
}
function simplify2(points, distance3) {
  return simplifyPoints2(points, 0, points.length, distance3);
}
function simplifyPoints2(points, start, end, epsilon, newPoints) {
  const outPoints = newPoints || [];
  const s3 = points[start];
  const e8 = points[end - 1];
  let maxDistSq = 0;
  let maxNdx = 1;
  for (let i3 = start + 1; i3 < end - 1; ++i3) {
    const distSq = distanceToSegmentSq2(points[i3], s3, e8);
    if (distSq > maxDistSq) {
      maxDistSq = distSq;
      maxNdx = i3;
    }
  }
  if (Math.sqrt(maxDistSq) > epsilon) {
    simplifyPoints2(points, start, maxNdx + 1, epsilon, outPoints);
    simplifyPoints2(points, maxNdx, end, epsilon, outPoints);
  } else {
    if (!outPoints.length) {
      outPoints.push(s3);
    }
    outPoints.push(e8);
  }
  return outPoints;
}
function pointsOnBezierCurves2(points, tolerance = 0.15, distance3) {
  const newPoints = [];
  const numSegments = (points.length - 1) / 3;
  for (let i3 = 0; i3 < numSegments; i3++) {
    const offset = i3 * 3;
    getPointsOnBezierCurveWithSplitting2(points, offset, tolerance, newPoints);
  }
  if (distance3 && distance3 > 0) {
    return simplifyPoints2(newPoints, 0, newPoints.length, distance3);
  }
  return newPoints;
}

// node_modules/.pnpm/@excalidraw+excalidraw@0.18.1_@types+react-dom@18.3.7_@types+react@18.3.28__@types+reac_35ce6435019f999df7993d08bf01f01f/node_modules/@excalidraw/excalidraw/dist/prod/chunk-K2UTITRG.js
var import_sanitize_url = __toESM(require_dist(), 1);

// node_modules/.pnpm/fractional-indexing@3.2.0/node_modules/fractional-indexing/src/index.js
var BASE_62_DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
function midpoint(a3, b3, digits) {
  const zero2 = digits[0];
  if (b3 != null && a3 >= b3) {
    throw new Error(a3 + " >= " + b3);
  }
  if (a3.slice(-1) === zero2 || b3 && b3.slice(-1) === zero2) {
    throw new Error("trailing zero");
  }
  if (b3) {
    let n3 = 0;
    while ((a3[n3] || zero2) === b3[n3]) {
      n3++;
    }
    if (n3 > 0) {
      return b3.slice(0, n3) + midpoint(a3.slice(n3), b3.slice(n3), digits);
    }
  }
  const digitA = a3 ? digits.indexOf(a3[0]) : 0;
  const digitB = b3 != null ? digits.indexOf(b3[0]) : digits.length;
  if (digitB - digitA > 1) {
    const midDigit = Math.round(0.5 * (digitA + digitB));
    return digits[midDigit];
  } else {
    if (b3 && b3.length > 1) {
      return b3.slice(0, 1);
    } else {
      return digits[digitA] + midpoint(a3.slice(1), null, digits);
    }
  }
}
function validateInteger(int) {
  if (int.length !== getIntegerLength(int[0])) {
    throw new Error("invalid integer part of order key: " + int);
  }
}
function getIntegerLength(head) {
  if (head >= "a" && head <= "z") {
    return head.charCodeAt(0) - "a".charCodeAt(0) + 2;
  } else if (head >= "A" && head <= "Z") {
    return "Z".charCodeAt(0) - head.charCodeAt(0) + 2;
  } else {
    throw new Error("invalid order key head: " + head);
  }
}
function getIntegerPart(key) {
  const integerPartLength = getIntegerLength(key[0]);
  if (integerPartLength > key.length) {
    throw new Error("invalid order key: " + key);
  }
  return key.slice(0, integerPartLength);
}
function validateOrderKey(key, digits) {
  if (key === "A" + digits[0].repeat(26)) {
    throw new Error("invalid order key: " + key);
  }
  const i3 = getIntegerPart(key);
  const f = key.slice(i3.length);
  if (f.slice(-1) === digits[0]) {
    throw new Error("invalid order key: " + key);
  }
}
function incrementInteger(x, digits) {
  validateInteger(x);
  const [head, ...digs] = x.split("");
  let carry = true;
  for (let i3 = digs.length - 1; carry && i3 >= 0; i3--) {
    const d = digits.indexOf(digs[i3]) + 1;
    if (d === digits.length) {
      digs[i3] = digits[0];
    } else {
      digs[i3] = digits[d];
      carry = false;
    }
  }
  if (carry) {
    if (head === "Z") {
      return "a" + digits[0];
    }
    if (head === "z") {
      return null;
    }
    const h = String.fromCharCode(head.charCodeAt(0) + 1);
    if (h > "a") {
      digs.push(digits[0]);
    } else {
      digs.pop();
    }
    return h + digs.join("");
  } else {
    return head + digs.join("");
  }
}
function decrementInteger(x, digits) {
  validateInteger(x);
  const [head, ...digs] = x.split("");
  let borrow = true;
  for (let i3 = digs.length - 1; borrow && i3 >= 0; i3--) {
    const d = digits.indexOf(digs[i3]) - 1;
    if (d === -1) {
      digs[i3] = digits.slice(-1);
    } else {
      digs[i3] = digits[d];
      borrow = false;
    }
  }
  if (borrow) {
    if (head === "a") {
      return "Z" + digits.slice(-1);
    }
    if (head === "A") {
      return null;
    }
    const h = String.fromCharCode(head.charCodeAt(0) - 1);
    if (h < "Z") {
      digs.push(digits.slice(-1));
    } else {
      digs.pop();
    }
    return h + digs.join("");
  } else {
    return head + digs.join("");
  }
}
function generateKeyBetween(a3, b3, digits = BASE_62_DIGITS) {
  if (a3 != null) {
    validateOrderKey(a3, digits);
  }
  if (b3 != null) {
    validateOrderKey(b3, digits);
  }
  if (a3 != null && b3 != null && a3 >= b3) {
    throw new Error(a3 + " >= " + b3);
  }
  if (a3 == null) {
    if (b3 == null) {
      return "a" + digits[0];
    }
    const ib3 = getIntegerPart(b3);
    const fb3 = b3.slice(ib3.length);
    if (ib3 === "A" + digits[0].repeat(26)) {
      return ib3 + midpoint("", fb3, digits);
    }
    if (ib3 < b3) {
      return ib3;
    }
    const res = decrementInteger(ib3, digits);
    if (res == null) {
      throw new Error("cannot decrement any more");
    }
    return res;
  }
  if (b3 == null) {
    const ia3 = getIntegerPart(a3);
    const fa3 = a3.slice(ia3.length);
    const i5 = incrementInteger(ia3, digits);
    return i5 == null ? ia3 + midpoint(fa3, null, digits) : i5;
  }
  const ia2 = getIntegerPart(a3);
  const fa2 = a3.slice(ia2.length);
  const ib2 = getIntegerPart(b3);
  const fb2 = b3.slice(ib2.length);
  if (ia2 === ib2) {
    return ia2 + midpoint(fa2, fb2, digits);
  }
  const i3 = incrementInteger(ia2, digits);
  if (i3 == null) {
    throw new Error("cannot increment any more");
  }
  if (i3 < b3) {
    return i3;
  }
  return ia2 + midpoint(fa2, null, digits);
}
function generateNKeysBetween(a3, b3, n3, digits = BASE_62_DIGITS) {
  if (n3 === 0) {
    return [];
  }
  if (n3 === 1) {
    return [generateKeyBetween(a3, b3, digits)];
  }
  if (b3 == null) {
    let c5 = generateKeyBetween(a3, b3, digits);
    const result = [c5];
    for (let i3 = 0; i3 < n3 - 1; i3++) {
      c5 = generateKeyBetween(c5, b3, digits);
      result.push(c5);
    }
    return result;
  }
  if (a3 == null) {
    let c5 = generateKeyBetween(a3, b3, digits);
    const result = [c5];
    for (let i3 = 0; i3 < n3 - 1; i3++) {
      c5 = generateKeyBetween(a3, c5, digits);
      result.push(c5);
    }
    result.reverse();
    return result;
  }
  const mid = Math.floor(n3 / 2);
  const c3 = generateKeyBetween(a3, b3, digits);
  return [
    ...generateNKeysBetween(a3, c3, mid, digits),
    c3,
    ...generateNKeysBetween(c3, b3, n3 - mid - 1, digits)
  ];
}

// node_modules/.pnpm/@excalidraw+excalidraw@0.18.1_@types+react-dom@18.3.7_@types+react@18.3.28__@types+reac_35ce6435019f999df7993d08bf01f01f/node_modules/@excalidraw/excalidraw/dist/prod/chunk-K2UTITRG.js
var p6 = (e8, t3) => t3.reduce((n3, r) => (r in e8 && (n3[r] = e8[r]), n3), {});
var k9 = 5;
var Z9 = 5;
var Ps = 4;
var fo = 4;
var po = 1;
var ft = [0, 2, 4, 6, 8];
var pt = (e8, t3) => t3.map((n3) => open_color_default[e8][n3]);
var Z = { transparent: "transparent", black: "#1e1e1e", white: "#ffffff", gray: pt("gray", ft), red: pt("red", ft), pink: pt("pink", ft), grape: pt("grape", ft), violet: pt("violet", ft), blue: pt("blue", ft), cyan: pt("cyan", ft), teal: pt("teal", ft), green: pt("green", ft), yellow: pt("yellow", ft), orange: pt("orange", ft), bronze: ["#f8f1ee", "#eaddd7", "#d2bab0", "#a18072", "#846358"] };
var Ns = p6(Z, ["cyan", "blue", "violet", "grape", "pink", "green", "teal", "yellow", "orange", "red"]);
var W9 = [Z.black, Z.red[fo], Z.green[fo], Z.blue[fo], Z.yellow[fo]];
var z9 = [Z.transparent, Z.red[po], Z.green[po], Z.blue[po], Z.yellow[po]];
var Q9 = [Z.white, "#f8f9fa", "#f5faff", "#fffce8", "#fdf8f6"];
var j9 = { transparent: Z.transparent, white: Z.white, gray: Z.gray, black: Z.black, bronze: Z.bronze, ...Ns };
var eE = { transparent: Z.transparent, white: Z.white, gray: Z.gray, black: Z.black, bronze: Z.bronze, ...Ns };
var Fs = (e8) => [Z.cyan[e8], Z.blue[e8], Z.violet[e8], Z.grape[e8], Z.pink[e8], Z.green[e8], Z.teal[e8], Z.yellow[e8], Z.orange[e8], Z.red[e8]];
var tE = (e8, t3, n3) => `#${((1 << 24) + (e8 << 16) + (t3 << 8) + n3).toString(16).slice(1)}`;
var uo = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
var iE = /^Win/.test(navigator.platform);
var Bs = /\b(android)\b/i.test(navigator.userAgent);
var aE = "netscape" in window && navigator.userAgent.indexOf("rv:") > 1 && navigator.userAgent.indexOf("Gecko") > 1;
var u6 = navigator.userAgent.indexOf("Chrome") !== -1;
var sE = !u6 && navigator.userAgent.indexOf("Safari") !== -1;
var _s = /iPad|iPhone/.test(navigator.platform) || navigator.userAgent.includes("Mac") && "ontouchend" in document;
var dE = () => navigator.brave?.isBrave?.name === "isBrave";
var cE = typeof window < "u" && "ResizeObserver" in window;
var lE = "Excalidraw";
var Os = 36;
var As = 10;
var Ks = 8;
var UE = 5;
var fE = 1;
var pE = 30;
var Nt = Math.PI / 12;
var uE = "red";
var mo = { TEXT: "text", CROSSHAIR: "crosshair", GRABBING: "grabbing", GRAB: "grab", POINTER: "pointer", MOVE: "move", AUTO: "" };
var mE = { MAIN: 0, WHEEL: 1, SECONDARY: 2, TOUCH: -1, ERASER: 5 };
var bE = { enabled: "all", disabled: "none", inheritFromUI: "var(--ui-pointerEvents)" };
var EE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };
var je = { TEST: "test", DEVELOPMENT: "development" };
var gE = { SHAPE_ACTIONS_MENU: "App-menu__left", ZOOM_ACTIONS: "zoom-actions", SEARCH_MENU_INPUT_WRAPPER: "layer-ui__search-inputWrapper" };
var Mn = "Xiaolai";
var Tn = "Segoe UI Emoji";
var Ie = { Virgil: 1, Helvetica: 2, Cascadia: 3, Excalifont: 5, Nunito: 6, "Lilita One": 7, "Comic Shanns": 8, "Liberation Sans": 9 };
var Un = { [Mn]: 100, [Tn]: 1e3 };
var bo = (e8) => {
  switch (e8) {
    case Ie.Excalifont:
      return [Mn, Tn];
    default:
      return [Tn];
  }
};
var ke = { LIGHT: "light", DARK: "dark" };
var Pe = { strokeColor: "#bbb", strokeWidth: 2, strokeStyle: "solid", fillStyle: "solid", roughness: 0, roundness: null, backgroundColor: "transparent", radius: 8, nameOffsetY: 3, nameColorLightTheme: "#999999", nameColorDarkTheme: "#7a7a7a", nameFontSize: 14, nameLineHeight: 1.25 };
var Eo = 1;
var ut = 20;
var Ft = Ie.Excalifont;
var Vn = "left";
var go = "top";
var br = 2;
var Er = 2 * br;
var m6 = 1e-5;
var xE = 2 * Er - m6;
var hE = "#ffffff";
var yE = "#1e1e1e";
var IE = "#a2f1a6";
var xo = 20;
var ho = 5;
var yo = { svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp", ico: "image/x-icon", avif: "image/avif", jfif: "image/jfif" };
var H = { text: "text/plain", html: "text/html", json: "application/json", excalidraw: "application/vnd.excalidraw+json", excalidrawlib: "application/vnd.excalidrawlib+json", "excalidraw.svg": "image/svg+xml", "excalidraw.png": "image/png", binary: "application/octet-stream", ...yo };
var Hs = [H.text, H.html, ...Object.values(yo)];
var wE = { png: "png", svg: "svg", clipboard: "clipboard" };
var Ze = { excalidraw: "excalidraw", excalidrawClipboard: "excalidraw/clipboard", excalidrawLibrary: "excalidrawlib", excalidrawClipboardWithAPI: "excalidraw-api/clipboard" };
var Ci = window.EXCALIDRAW_EXPORT_SOURCE || window.location.origin;
var RE = 500;
var TE = 300;
var ME = 500;
var LE = 100;
var DE = 0.1;
var Js = 0.1;
var Ys = 30;
var SE = 300;
var Io = "invert(93%) hue-rotate(180deg)";
var vE = { addLibrary: "addLibrary" };
var $E = { addLibrary: "addLibrary" };
var PE = { canvasActions: { changeViewBackgroundColor: true, clearCanvas: true, export: { saveFileToDisk: true }, loadScene: true, saveToActiveFile: true, toggleTheme: null, saveAsImage: true }, tools: { image: true } };
var NE = 730;
var FE = 1e3;
var BE = 500;
var _E = 1229;
var qn = 2;
var Cs = [1, 2, 3];
var Vi = 10;
var OE = 1440;
var AE = 4 * 1024 * 1024;
var re = "http://www.w3.org/2000/svg";
var qi = { excalidraw: 2, excalidrawLibrary: 2 };
var Se = 5;
var Vs = 0.7;
var qs = 11;
var kt = { TOP: "top", MIDDLE: "middle", BOTTOM: "bottom" };
var Xi = { LEFT: "left", CENTER: "center", RIGHT: "right" };
var Xs = 20;
var wo = 0.25;
var Gs = 32;
var ot = { LEGACY: 1, PROPORTIONAL_RADIUS: 2, ADAPTIVE_RADIUS: 3 };
var Gi = { architect: 0, artist: 1, cartoonist: 2 };
var KE = { thin: 1, bold: 2, extraBold: 4 };
var we = { strokeColor: Z.black, backgroundColor: Z.transparent, fillStyle: "solid", strokeWidth: 2, strokeStyle: "solid", roughness: Gi.artist, opacity: 100, locked: false };
var b6 = "library";
var HE = "search";
var ks = { name: "default", defaultTab: b6 };
var JE = /* @__PURE__ */ new Set(["iframe", "embeddable", "image"]);
var fn = { selection: "selection", rectangle: "rectangle", diamond: "diamond", ellipse: "ellipse", arrow: "arrow", line: "line", freedraw: "freedraw", text: "text", image: "image", eraser: "eraser", hand: "hand", frame: "frame", magicframe: "magicframe", embeddable: "embeddable", laser: "laser" };
var YE = { OAI_API_KEY: "excalidraw-oai-api-key", MERMAID_TO_EXCALIDRAW: "mermaid-to-excalidraw", PUBLISH_LIBRARY: "publish-library-data" };
var Zs = "Untitled";
var ki = { generalStats: 1, elementProperties: 2 };
var CE = 1;
var Ws = { sharp: "sharp", round: "round", elbow: "elbow" };
var zs = 0.3;
var gr = "element";
var Qs = Symbol.for("__test__originalId__");
var E6 = ((r) => (r.ACTIVE = "active", r.AWAY = "away", r.IDLE = "idle", r))(E6 || {});
var g6 = Cs.includes(devicePixelRatio) ? devicePixelRatio : 1;
var mt = () => ({ showWelcomeScreen: false, theme: ke.LIGHT, collaborators: /* @__PURE__ */ new Map(), currentChartType: "bar", currentItemBackgroundColor: we.backgroundColor, currentItemEndArrowhead: "arrow", currentItemFillStyle: we.fillStyle, currentItemFontFamily: Ft, currentItemFontSize: ut, currentItemOpacity: we.opacity, currentItemRoughness: we.roughness, currentItemStartArrowhead: null, currentItemStrokeColor: we.strokeColor, currentItemRoundness: "round", currentItemArrowType: Ws.round, currentItemStrokeStyle: we.strokeStyle, currentItemStrokeWidth: we.strokeWidth, currentItemTextAlign: Vn, currentHoveredFontFamily: null, cursorButton: "up", activeEmbeddable: null, newElement: null, editingTextElement: null, editingGroupId: null, editingLinearElement: null, activeTool: { type: "selection", customType: null, locked: we.locked, lastActiveTool: null }, penMode: false, penDetected: false, errorMessage: null, exportBackground: true, exportScale: g6, exportEmbedScene: false, exportWithDarkMode: false, fileHandle: null, gridSize: xo, gridStep: ho, gridModeEnabled: false, isBindingEnabled: true, defaultSidebarDockedPreference: false, isLoading: false, isResizing: false, isRotating: false, lastPointerDownWith: "mouse", multiElement: null, name: null, contextMenu: null, openMenu: null, openPopup: null, openSidebar: null, openDialog: null, pasteDialog: { shown: false, data: null }, previousSelectedElementIds: {}, resizingElement: null, scrolledOutside: false, scrollX: 0, scrollY: 0, selectedElementIds: {}, hoveredElementIds: {}, selectedGroupIds: {}, selectedElementsAreBeingDragged: false, selectionElement: null, shouldCacheIgnoreZoom: false, stats: { open: false, panels: ki.generalStats | ki.elementProperties }, startBoundElement: null, suggestedBindings: [], frameRendering: { enabled: true, clip: true, name: true, outline: true }, frameToHighlight: null, editingFrame: null, elementsToHighlight: null, toast: null, viewBackgroundColor: Z.white, zenModeEnabled: false, zoom: { value: 1 }, viewModeEnabled: false, pendingImageElementId: null, showHyperlinkPopup: false, selectedLinearElement: null, snapLines: [], originSnapOffset: { x: 0, y: 0 }, objectsSnapModeEnabled: false, userToFollow: null, followedBy: /* @__PURE__ */ new Set(), isCropping: false, croppingElementId: null, searchMatches: [] });
var x6 = /* @__PURE__ */ ((e8) => e8)({ showWelcomeScreen: { browser: true, export: false, server: false }, theme: { browser: true, export: false, server: false }, collaborators: { browser: false, export: false, server: false }, currentChartType: { browser: true, export: false, server: false }, currentItemBackgroundColor: { browser: true, export: false, server: false }, currentItemEndArrowhead: { browser: true, export: false, server: false }, currentItemFillStyle: { browser: true, export: false, server: false }, currentItemFontFamily: { browser: true, export: false, server: false }, currentItemFontSize: { browser: true, export: false, server: false }, currentItemRoundness: { browser: true, export: false, server: false }, currentItemArrowType: { browser: true, export: false, server: false }, currentItemOpacity: { browser: true, export: false, server: false }, currentItemRoughness: { browser: true, export: false, server: false }, currentItemStartArrowhead: { browser: true, export: false, server: false }, currentItemStrokeColor: { browser: true, export: false, server: false }, currentItemStrokeStyle: { browser: true, export: false, server: false }, currentItemStrokeWidth: { browser: true, export: false, server: false }, currentItemTextAlign: { browser: true, export: false, server: false }, currentHoveredFontFamily: { browser: false, export: false, server: false }, cursorButton: { browser: true, export: false, server: false }, activeEmbeddable: { browser: false, export: false, server: false }, newElement: { browser: false, export: false, server: false }, editingTextElement: { browser: false, export: false, server: false }, editingGroupId: { browser: true, export: false, server: false }, editingLinearElement: { browser: false, export: false, server: false }, activeTool: { browser: true, export: false, server: false }, penMode: { browser: true, export: false, server: false }, penDetected: { browser: true, export: false, server: false }, errorMessage: { browser: false, export: false, server: false }, exportBackground: { browser: true, export: false, server: false }, exportEmbedScene: { browser: true, export: false, server: false }, exportScale: { browser: true, export: false, server: false }, exportWithDarkMode: { browser: true, export: false, server: false }, fileHandle: { browser: false, export: false, server: false }, gridSize: { browser: true, export: true, server: true }, gridStep: { browser: true, export: true, server: true }, gridModeEnabled: { browser: true, export: true, server: true }, height: { browser: false, export: false, server: false }, isBindingEnabled: { browser: false, export: false, server: false }, defaultSidebarDockedPreference: { browser: true, export: false, server: false }, isLoading: { browser: false, export: false, server: false }, isResizing: { browser: false, export: false, server: false }, isRotating: { browser: false, export: false, server: false }, lastPointerDownWith: { browser: true, export: false, server: false }, multiElement: { browser: false, export: false, server: false }, name: { browser: true, export: false, server: false }, offsetLeft: { browser: false, export: false, server: false }, offsetTop: { browser: false, export: false, server: false }, contextMenu: { browser: false, export: false, server: false }, openMenu: { browser: true, export: false, server: false }, openPopup: { browser: false, export: false, server: false }, openSidebar: { browser: true, export: false, server: false }, openDialog: { browser: false, export: false, server: false }, pasteDialog: { browser: false, export: false, server: false }, previousSelectedElementIds: { browser: true, export: false, server: false }, resizingElement: { browser: false, export: false, server: false }, scrolledOutside: { browser: true, export: false, server: false }, scrollX: { browser: true, export: false, server: false }, scrollY: { browser: true, export: false, server: false }, selectedElementIds: { browser: true, export: false, server: false }, hoveredElementIds: { browser: false, export: false, server: false }, selectedGroupIds: { browser: true, export: false, server: false }, selectedElementsAreBeingDragged: { browser: false, export: false, server: false }, selectionElement: { browser: false, export: false, server: false }, shouldCacheIgnoreZoom: { browser: true, export: false, server: false }, stats: { browser: true, export: false, server: false }, startBoundElement: { browser: false, export: false, server: false }, suggestedBindings: { browser: false, export: false, server: false }, frameRendering: { browser: false, export: false, server: false }, frameToHighlight: { browser: false, export: false, server: false }, editingFrame: { browser: false, export: false, server: false }, elementsToHighlight: { browser: false, export: false, server: false }, toast: { browser: false, export: false, server: false }, viewBackgroundColor: { browser: true, export: true, server: true }, width: { browser: false, export: false, server: false }, zenModeEnabled: { browser: true, export: false, server: false }, zoom: { browser: true, export: false, server: false }, viewModeEnabled: { browser: false, export: false, server: false }, pendingImageElementId: { browser: false, export: false, server: false }, showHyperlinkPopup: { browser: false, export: false, server: false }, selectedLinearElement: { browser: true, export: false, server: false }, snapLines: { browser: false, export: false, server: false }, originSnapOffset: { browser: false, export: false, server: false }, objectsSnapModeEnabled: { browser: true, export: false, server: false }, userToFollow: { browser: false, export: false, server: false }, followedBy: { browser: false, export: false, server: false }, isCropping: { browser: false, export: false, server: false }, croppingElementId: { browser: false, export: false, server: false }, searchMatches: { browser: false, export: false, server: false } });
var js = (e8, t3) => {
  let n3 = {};
  for (let r of Object.keys(e8)) if (x6[r]?.[t3]) {
    let i3 = e8[r];
    n3[r] = i3;
  }
  return n3;
};
var Ro = (e8) => js(e8, "export");
var ed = (e8) => js(e8, "server");
var td = ({ activeTool: e8 }) => e8.type === "eraser";
var nd = ({ activeTool: e8 }) => e8.type === "hand";
var se2 = (e8, t3, n3) => Math.min(Math.max(e8, t3), n3);
var To = (e8, t3, n3 = "round") => {
  let r = Math.pow(10, t3);
  return Math[n3]((e8 + Number.EPSILON) * r) / r;
};
var WE = (e8, t3, n3 = "round") => {
  let r = 1 / t3;
  return Math[n3](e8 * r) / r;
};
var xr = (e8, t3) => (e8 + t3) / 2;
var Mo = (e8) => typeof e8 == "number" && Number.isFinite(e8);
var Zi = (e8, t3, n3 = 1e-4) => Math.abs(e8 - t3) < n3;
var hr = (e8) => e8 < 0 ? e8 + 2 * Math.PI : e8 >= 2 * Math.PI ? e8 - 2 * Math.PI : e8;
function yr(e8) {
  return e8 * Math.PI / 180;
}
function rd(e8) {
  return e8 * 180 / Math.PI;
}
function od(e8) {
  return Math.abs(Math.sin(2 * e8)) < 1e-4;
}
function Be(e8, t3, n3 = 0, r = 0) {
  return [e8 - n3, t3 - r];
}
function O(e8, t3 = [0, 0]) {
  return Be(e8[0] - t3[0], e8[1] - t3[1]);
}
function Me(e8, t3) {
  return e8[0] * t3[1] - t3[0] * e8[1];
}
function h6(e8, t3) {
  return e8[0] * t3[0] + e8[1] * t3[1];
}
function st(e8, t3) {
  return [e8[0] + t3[0], e8[1] + t3[1]];
}
function Lo(e8, t3) {
  return [e8[0] - t3[0], e8[1] - t3[1]];
}
function ue2(e8, t3) {
  return Be(e8[0] * t3, e8[1] * t3);
}
function y6(e8) {
  return e8[0] * e8[0] + e8[1] * e8[1];
}
function I6(e8) {
  return Math.sqrt(y6(e8));
}
var Je = (e8) => {
  let t3 = I6(e8);
  return t3 === 0 ? Be(0, 0) : Be(e8[0] / t3, e8[1] / t3);
};
function u(e8, t3) {
  return [e8, t3];
}
function Ir(e8) {
  return e8.length === 2 ? u(e8[0], e8[1]) : void 0;
}
function q(e8, t3 = u(0, 0)) {
  return u(t3[0] + e8[0], t3[1] + e8[1]);
}
function Do(e8) {
  return Array.isArray(e8) && e8.length === 2 && typeof e8[0] == "number" && !isNaN(e8[0]) && typeof e8[1] == "number" && !isNaN(e8[1]);
}
function _e(e8, t3) {
  let n3 = Math.abs;
  return n3(e8[0] - t3[0]) < 1e-4 && n3(e8[1] - t3[1]) < 1e-4;
}
function T([e8, t3], [n3, r], o3) {
  return u((e8 - n3) * Math.cos(o3) - (t3 - r) * Math.sin(o3) + n3, (e8 - n3) * Math.sin(o3) + (t3 - r) * Math.cos(o3) + r);
}
function wr(e8, t3 = [0, 0]) {
  return u(e8[0] + t3[0], e8[1] + t3[1]);
}
function Zt(e8, t3) {
  return u((e8[0] + t3[0]) / 2, (e8[1] + t3[1]) / 2);
}
function ie2(e8, t3) {
  return Math.hypot(t3[0] - e8[0], t3[1] - e8[1]);
}
function Xn(e8, t3) {
  let n3 = t3[0] - e8[0], r = t3[1] - e8[1];
  return n3 * n3 + r * r;
}
var bt = (e8, t3, n3) => wr(t3, ue2(O(e8, t3), n3));
var So = (e8, t3, n3) => t3[0] <= Math.max(e8[0], n3[0]) && t3[0] >= Math.min(e8[0], n3[0]) && t3[1] <= Math.max(e8[1], n3[1]) && t3[1] >= Math.min(e8[1], n3[1]);
function Rr(e8, t3) {
  return [e8, t3];
}
function id(e8, t3) {
  let n3 = e8[1][1] - e8[0][1], r = e8[0][0] - e8[1][0], o3 = t3[1][1] - t3[0][1], i3 = t3[0][0] - t3[1][0], a3 = n3 * i3 - o3 * r;
  if (a3 !== 0) {
    let s3 = n3 * e8[0][0] + r * e8[0][1], d = o3 * t3[0][0] + i3 * t3[0][1];
    return u((s3 * i3 - d * r) / a3, (n3 * d - o3 * s3) / a3);
  }
  return null;
}
function A2(e8, t3) {
  return [e8, t3];
}
var Bt = (e8, t3, n3 = 1e-4) => {
  let r = vo(e8, t3);
  return r === 0 ? true : r < n3;
};
var vo = (e8, t3) => {
  let [n3, r] = e8, [[o3, i3], [a3, s3]] = t3, d = n3 - o3, c3 = r - i3, l3 = a3 - o3, U = s3 - i3, p = d * l3 + c3 * U, m = l3 * l3 + U * U, b3 = -1;
  m !== 0 && (b3 = p / m);
  let E, g;
  b3 < 0 ? (E = o3, g = i3) : b3 > 1 ? (E = a3, g = s3) : (E = o3 + b3 * l3, g = i3 + b3 * U);
  let h = n3 - E, x = r - g;
  return Math.sqrt(h * h + x * x);
};
function pn(e8, t3) {
  let n3 = id(Rr(e8[0], e8[1]), Rr(t3[0], t3[1]));
  return !n3 || !Bt(n3, t3) || !Bt(n3, e8) ? null : n3;
}
function Tr(e8, t3) {
  return [e8, t3];
}
function ad(e8, t3) {
  return [A2(e8[0], u(e8[1][0], e8[0][1])), A2(u(e8[1][0], e8[0][1]), e8[1]), A2(e8[1], u(e8[0][0], e8[1][1])), A2(u(e8[0][0], e8[1][1]), e8[0])].map((n3) => pn(t3, n3)).filter((n3) => !!n3);
}
function Et(e8, t3, n3, r) {
  return [e8, t3, n3, r];
}
function sd(e8, t3, n3, r = 1e-6) {
  return [(e8(t3 + r, n3) - e8(t3 - r, n3)) / (2 * r), (e8(t3, n3 + r) - e8(t3, n3 - r)) / (2 * r)];
}
function w6(e8, t3, n3, r = 1e-3, o3 = 10) {
  let i3 = 1 / 0, a3 = 0;
  for (; i3 >= r; ) {
    if (a3 >= o3) return null;
    let s3 = e8(t3, n3), d = [sd((E, g) => e8(E, g)[0], t3, n3), sd((E, g) => e8(E, g)[1], t3, n3)], c3 = [[-s3[0]], [-s3[1]]], l3 = d[0][0] * d[1][1] - d[0][1] * d[1][0];
    if (l3 === 0) return null;
    let U = [[d[1][1] / l3, -d[0][1] / l3], [-d[1][0] / l3, d[0][0] / l3]], p = [[U[0][0] * c3[0][0] + U[0][1] * c3[1][0]], [U[1][0] * c3[0][0] + U[1][1] * c3[1][0]]];
    t3 = t3 + p[0][0], n3 = n3 + p[1][0];
    let [m, b3] = e8(t3, n3);
    i3 = Math.max(Math.abs(m), Math.abs(b3)), a3 += 1;
  }
  return [t3, n3];
}
var Mr = (e8, t3) => u((1 - t3) ** 3 * e8[0][0] + 3 * (1 - t3) ** 2 * t3 * e8[1][0] + 3 * (1 - t3) * t3 ** 2 * e8[2][0] + t3 ** 3 * e8[3][0], (1 - t3) ** 3 * e8[0][1] + 3 * (1 - t3) ** 2 * t3 * e8[1][1] + 3 * (1 - t3) * t3 ** 2 * e8[2][1] + t3 ** 3 * e8[3][1]);
function Wi(e8, t3) {
  let n3 = T6(e8);
  if (ad(Tr(u(n3[0], n3[1]), u(n3[2], n3[3])), t3).length === 0) return [];
  let r = (s3) => u(t3[0][0] + s3 * (t3[1][0] - t3[0][0]), t3[0][1] + s3 * (t3[1][1] - t3[0][1])), o3 = [[0.5, 0], [0.2, 0], [0.8, 0]], i3 = ([s3, d]) => {
    let c3 = w6((p, m) => {
      let b3 = Mr(e8, p), E = r(m);
      return [b3[0] - E[0], b3[1] - E[1]];
    }, s3, d);
    if (!c3) return null;
    let [l3, U] = c3;
    return l3 < 0 || l3 > 1 || U < 0 || U > 1 ? null : Mr(e8, l3);
  }, a3 = i3(o3[0]);
  return a3 ? [a3] : (a3 = i3(o3[1]), a3 ? [a3] : (a3 = i3(o3[2]), a3 ? [a3] : []));
}
function R6(e8, t3, n3 = 1e-3) {
  let r = (c3, l3, U, p = n3) => {
    let m = c3, b3 = l3, E;
    for (; b3 - m > p; ) E = (b3 + m) / 2, U(E - p) < U(E + p) ? b3 = E : m = E;
    return E;
  }, i3 = 0;
  for (let c3 = 1 / 0, l3 = 0; l3 < 30; l3++) {
    let U = ie2(t3, Mr(e8, l3 / 30));
    U < c3 && (c3 = U, i3 = l3);
  }
  let a3 = Math.max((i3 - 1) / 30, 0), s3 = Math.min((i3 + 1) / 30, 1), d = r(a3, s3, (c3) => ie2(t3, Mr(e8, c3)));
  return d ? Mr(e8, d) : null;
}
function zi(e8, t3) {
  let n3 = R6(e8, t3);
  return n3 ? ie2(t3, n3) : 0;
}
function T6(e8) {
  let [t3, n3, r, o3] = e8, i3 = [t3[0], n3[0], r[0], o3[0]], a3 = [t3[1], n3[1], r[1], o3[1]];
  return [Math.min(...i3), Math.min(...a3), Math.max(...i3), Math.max(...a3)];
}
function Qi(...e8) {
  return cd(e8);
}
function Gn(e8) {
  return cd(e8);
}
var ji = (e8, t3) => {
  let n3 = e8[0], r = e8[1], o3 = false;
  for (let i3 = 0, a3 = t3.length - 1; i3 < t3.length; a3 = i3++) {
    let s3 = t3[i3][0], d = t3[i3][1], c3 = t3[a3][0], l3 = t3[a3][1];
    (d > r && l3 <= r || d <= r && l3 > r) && n3 < (c3 - s3) * (r - d) / (l3 - d) + s3 && (o3 = !o3);
  }
  return o3;
};
var dd = (e8, t3, n3 = 1e-4) => {
  let r = false;
  for (let o3 = 0, i3 = t3.length - 1; o3 < i3; o3++) if (Bt(e8, A2(t3[o3], t3[o3 + 1]), n3)) {
    r = true;
    break;
  }
  return r;
};
function cd(e8) {
  return M6(e8) ? e8 : [...e8, e8[0]];
}
function M6(e8) {
  return _e(e8[0], e8[e8.length - 1]);
}
function Oe(e8, t3) {
  return tt([e8, t3]);
}
var Lr = ([e8, t3], [n3, r]) => e8 <= n3 ? t3 >= n3 : e8 >= n3 ? r >= e8 : false;
var Dr = ([e8, t3], [n3, r]) => {
  let o3 = Math.max(e8, n3), i3 = Math.min(t3, r);
  return o3 <= i3 ? tt([o3, i3]) : null;
};
var Sr = (e8, [t3, n3]) => e8 >= t3 && e8 <= n3;
function Ln([e8, t3, n3], r) {
  let o3 = (l3, U, p) => (l3[0] - p[0]) * (U[1] - p[1]) - (U[0] - p[0]) * (l3[1] - p[1]), i3 = o3(r, e8, t3), a3 = o3(r, t3, n3), s3 = o3(r, n3, e8), d = i3 < 0 || a3 < 0 || s3 < 0, c3 = i3 > 0 || a3 > 0 || s3 > 0;
  return !(d && c3);
}
var ld = null;
var ng = () => {
  if (ld) return ld;
  let e8 = /* @__PURE__ */ new Date(), t3 = e8.getFullYear(), n3 = `${e8.getMonth() + 1}`.padStart(2, "0"), r = `${e8.getDate()}`.padStart(2, "0"), o3 = `${e8.getHours()}`.padStart(2, "0"), i3 = `${e8.getMinutes()}`.padStart(2, "0");
  return `${t3}-${n3}-${r}-${o3}${i3}`;
};
var rg = (e8) => e8.charAt(0).toUpperCase() + e8.slice(1);
var og = (e8) => e8 instanceof HTMLElement && e8.className.includes("ToolIcon");
var D6 = (e8) => e8 instanceof HTMLElement && e8.dataset.type === "wysiwyg" || e8 instanceof HTMLBRElement || e8 instanceof HTMLInputElement || e8 instanceof HTMLTextAreaElement || e8 instanceof HTMLSelectElement;
var ig = (e8) => D6(e8) || e8 instanceof Element && !!e8.closest("label, button");
var ag = (e8) => e8 instanceof HTMLElement && e8.dataset.type === "wysiwyg" || e8 instanceof HTMLBRElement || e8 instanceof HTMLTextAreaElement || e8 instanceof HTMLInputElement && (e8.type === "text" || e8.type === "number" || e8.type === "password");
var ea = ({ fontFamily: e8 }) => {
  for (let [t3, n3] of Object.entries(Ie)) if (n3 === e8) return `${t3}${bo(n3).map((r) => `, ${r}`).join("")}`;
  return Tn;
};
var Ee = ({ fontSize: e8, fontFamily: t3 }) => `${e8}px ${ea({ fontFamily: t3 })}`;
var $o = (e8, t3) => {
  let n3 = 0, r = null, o3 = (...i3) => {
    r = i3, clearTimeout(n3), n3 = window.setTimeout(() => {
      r = null, e8(...i3);
    }, t3);
  };
  return o3.flush = () => {
    if (clearTimeout(n3), r) {
      let i3 = r;
      r = null, e8(...i3);
    }
  }, o3.cancel = () => {
    r = null, clearTimeout(n3);
  }, o3;
};
var pd = (e8, t3) => {
  let n3 = null, r = null, o3 = null, i3 = (s3) => {
    n3 = window.requestAnimationFrame(() => {
      n3 = null, e8(...s3), r = null, o3 && (r = o3, o3 = null, i3(r));
    });
  }, a3 = (...s3) => {
    if (c.MODE === "test") {
      e8(...s3);
      return;
    }
    r = s3, n3 === null ? i3(r) : t3?.trailing && (o3 = s3);
  };
  return a3.flush = () => {
    n3 !== null && (cancelAnimationFrame(n3), n3 = null), r && (e8(...o3 || r), r = o3 = null);
  }, a3.cancel = () => {
    r = o3 = null, n3 !== null && (cancelAnimationFrame(n3), n3 = null);
  }, a3;
};
var ud = (e8) => 1 - Math.pow(1 - e8, 4);
var Ud = (e8, t3, n3) => (t3 - e8) * ud(n3) + e8;
var sg = ({ fromValues: e8, toValues: t3, onStep: n3, duration: r = 250, interpolateValue: o3, onStart: i3, onEnd: a3, onCancel: s3 }) => {
  let d = false, c3 = 0, l3;
  function U(p) {
    if (d) return;
    l3 === void 0 && (l3 = p, i3?.());
    let m = Math.min(p - l3, r), b3 = ud(m / r), E = {};
    if (Object.keys(e8).forEach((g) => {
      let h = g, x = (t3[h] - e8[h]) * b3 + e8[h];
      E[h] = x;
    }), n3(E), m < r) {
      let g = m / r, h = {};
      Object.keys(e8).forEach((x) => {
        let y = x, w = e8[y], I = t3[y], S;
        S = o3 ? o3(w, I, g, y) : Ud(w, I, g), S == null && (S = Ud(w, I, g)), h[y] = S;
      }), n3(h), c3 = window.requestAnimationFrame(U);
    } else n3(t3), a3?.();
  }
  return c3 = window.requestAnimationFrame(U), () => {
    s3?.(), d = true, window.cancelAnimationFrame(c3);
  };
};
var dg = (e8, t3) => {
  if (!e8.length || t3 < 1) return [];
  let n3 = 0, r = 0, o3 = Array(Math.ceil(e8.length / t3));
  for (; n3 < e8.length; ) o3[r++] = e8.slice(n3, n3 += t3);
  return o3;
};
var dt = (e8, t3) => Math.abs(e8 - t3);
var $r = (e8, t3) => t3.type === "custom" ? { ...e8.activeTool, type: "custom", customType: t3.customType, locked: t3.locked ?? e8.activeTool.locked } : { ...e8.activeTool, lastActiveTool: t3.lastActiveToolBeforeEraser === void 0 ? e8.activeTool.lastActiveTool : t3.lastActiveToolBeforeEraser, type: t3.type, customType: null, locked: t3.locked ?? e8.activeTool.locked };
var cg = (e8) => (e8 = e8.replace(/\bAlt\b/i, "Alt").replace(/\bShift\b/i, "Shift").replace(/\b(Enter|Return)\b/i, "Enter"), uo ? e8.replace(/\bCtrlOrCmd\b/gi, "Cmd").replace(/\bAlt\b/i, "Option") : e8.replace(/\bCtrlOrCmd\b/gi, "Ctrl"));
var Dn = ({ clientX: e8, clientY: t3 }, { zoom: n3, offsetLeft: r, offsetTop: o3, scrollX: i3, scrollY: a3 }) => {
  let s3 = (e8 - r) / n3.value - i3, d = (t3 - o3) / n3.value - a3;
  return { x: s3, y: d };
};
var ta = ({ sceneX: e8, sceneY: t3 }, { zoom: n3, offsetLeft: r, offsetTop: o3, scrollX: i3, scrollY: a3 }) => {
  let s3 = (e8 + i3) * n3.value + r, d = (t3 + a3) * n3.value + o3;
  return { x: s3, y: d };
};
var lg = (e8) => getComputedStyle(document.documentElement).getPropertyValue(`--${e8}`);
var S6 = "A-Za-z\xC0-\xD6\xD8-\xF6\xF8-\u02B8\u0300-\u0590\u0800-\u1FFF\u2C00-\uFB1C\uFDFE-\uFE6F\uFEFD-\uFFFF";
var v6 = "\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC";
var $6 = new RegExp(`^[^${S6}]*[${v6}]`);
var Po = (e8) => $6.test(e8);
var un = (e8) => {
  let [t3, n3] = e8;
  return { x: t3, y: n3 };
};
var Ug = (e8) => {
  if (e8?.name === "AbortError") {
    console.warn(e8);
    return;
  }
  throw e8;
};
var fg = (e8, t3, n3 = 0) => {
  n3 < 0 && (n3 = e8.length + n3), n3 = Math.min(e8.length, Math.max(n3, 0));
  let r = n3 - 1;
  for (; ++r < e8.length; ) if (t3(e8[r], r, e8)) return r;
  return -1;
};
var pg = (e8, t3, n3 = e8.length - 1) => {
  n3 < 0 && (n3 = e8.length + n3), n3 = Math.min(e8.length - 1, Math.max(n3, 0));
  let r = n3 + 1;
  for (; --r > -1; ) if (t3(e8[r], r, e8)) return r;
  return -1;
};
var Wt = (e8) => {
  let t3 = e8.length === 5 && e8.substr(4, 1) === "0", n3 = e8.length === 9 && e8.substr(7, 2) === "00";
  return t3 || n3 || e8 === Z.transparent;
};
var No = (e8) => e8.fillStyle !== "solid" || Wt(e8.backgroundColor);
var ug = () => {
  let e8, t3, n3 = new Promise((r, o3) => {
    e8 = r, t3 = o3;
  });
  return n3.resolve = e8, n3.reject = t3, n3;
};
var mg = (e8) => {
  let t3 = e8.parentElement;
  for (; t3; ) {
    if (t3 === document.body) return document;
    let { overflowY: n3 } = window.getComputedStyle(t3);
    if (t3.scrollHeight > t3.clientHeight && (n3 === "auto" || n3 === "scroll" || n3 === "overlay")) return t3;
    t3 = t3.parentElement;
  }
  return document;
};
var bg = (e8) => {
  let t3 = e8.parentElement;
  for (; t3; ) {
    if (t3.tabIndex > -1) {
      t3.focus();
      return;
    }
    t3 = t3.parentElement;
  }
};
var Eg = (e8) => {
  e8.preventDefault(), e8.returnValue = "";
};
var md = (e8) => Array.from(e8).map((t3) => `0${t3.toString(16)}`.slice(-2)).join("");
var zt = () => Ot() ? 1 : Date.now();
var te = (e8) => e8 instanceof Map ? e8 : e8.reduce((t3, n3) => (t3.set(typeof n3 == "string" ? n3 : n3.id, n3), t3), /* @__PURE__ */ new Map());
var gg = (e8) => e8.reduce((t3, n3, r) => (t3.set(n3.id, [n3, r]), t3), /* @__PURE__ */ new Map());
var _t = (e8, t3) => e8.reduce((n3, r) => (n3[t3 ? t3(r) : String(r)] = r, n3), {});
var xg = (e8) => e8.reduce((t3, n3, r) => {
  let o3 = { ...n3, prev: null, next: null };
  if (r !== 0) {
    let i3 = t3[r - 1];
    if (o3.prev = i3, i3.next = o3, r === e8.length - 1) {
      let a3 = t3[0];
      o3.next = a3, a3.prev = o3;
    }
  }
  return t3.push(o3), t3;
}, []);
var Ot = () => c.MODE === "test";
var hg = () => c.MODE === "development";
var bd = () => typeof process < "u" && true;
var yg = (e8, t3) => new CustomEvent(e8, { detail: { nativeEvent: t3 }, cancelable: true });
var Ig = (e8, t3) => {
  let n3 = false;
  for (let r in t3) {
    let o3 = t3[r];
    if (typeof o3 < "u") {
      if (e8[r] === o3 && (typeof o3 != "object" || o3 === null)) continue;
      n3 = true;
    }
  }
  return n3 ? { ...e8, ...t3 } : e8;
};
var wg = () => {
  try {
    return window.self === window.top ? "top" : "iframe";
  } catch {
    return "iframe";
  }
};
var Fo = (e8) => !!e8 && typeof e8 == "object" && "then" in e8 && "catch" in e8 && "finally" in e8;
var Rg = (e8) => {
  let t3 = e8?.querySelectorAll("button, a, input, select, textarea, div[tabindex], label[tabindex]");
  return t3 ? Array.from(t3).filter((n3) => n3.tabIndex > -1 && !n3.disabled) : [];
};
var fd = (e8, t3) => Array.isArray(e8) && Array.isArray(t3) && e8.length === 0 && t3.length === 0 ? true : e8 === t3;
var Qt = (e8, t3, n3, r = false) => {
  let o3 = Object.keys(e8), i3 = Object.keys(t3);
  if (o3.length !== i3.length) return r && console.warn("%cisShallowEqual: objects don't have same properties ->", "color: #8B4000", e8, t3), false;
  if (n3 && Array.isArray(n3)) {
    for (let a3 of n3) if (!(e8[a3] === t3[a3] || fd(e8[a3], t3[a3]))) return r && console.warn(`%cisShallowEqual: ${a3} not equal ->`, "color: #8B4000", e8[a3], t3[a3]), false;
    return true;
  }
  return o3.every((a3) => {
    let s3 = n3?.[a3], d = s3 ? s3(e8[a3], t3[a3]) : e8[a3] === t3[a3] || fd(e8[a3], t3[a3]);
    return !d && r && console.warn(`%cisShallowEqual: ${a3} not equal ->`, "color: #8B4000", e8[a3], t3[a3]), d;
  });
};
var Tg = (e8, t3, { checkForDefaultPrevented: n3 = true } = {}) => function(o3) {
  if (e8?.(o3), !n3 || !o3?.defaultPrevented) return t3?.(o3);
};
var Sn = (e8, t3, n3) => {
  if (!t3) return e8;
  if (n3) return console.error(t3), e8;
  throw new Error(t3);
};
function Ae(e8, t3) {
  if (!e8) throw new Error(t3);
}
var Mg = (e8) => {
  let t3, n3, r = function(o3) {
    let i3 = Object.entries(o3);
    if (t3) {
      let s3 = true;
      for (let [d, c3] of i3) if (t3.get(d) !== c3) {
        s3 = false;
        break;
      }
      if (s3) return n3;
    }
    let a3 = e8(o3);
    return t3 = new Map(i3), n3 = a3, a3;
  };
  return r.clear = () => {
    t3 = void 0, n3 = void 0;
  }, r;
};
var Ed = (e8, t3) => e8 instanceof Set || e8 instanceof Map ? e8.has(t3) : "includes" in e8 ? e8.includes(t3) : e8.hasOwnProperty(t3);
var Lg = (e8) => JSON.parse(JSON.stringify(e8));
var Dg = (e8, t3) => Qt(e8, t3) ? e8 : t3;
function Sg(e8, t3, n3, r) {
  return e8 ? (e8?.addEventListener?.(t3, n3, r), () => {
    e8?.removeEventListener?.(t3, n3, r);
  }) : () => {
  };
}
function vg(e8, t3 = true) {
  let n3 = e8.length;
  if (n3 < 4) return "";
  let r = e8[0], o3 = e8[1], i3 = e8[2], a3 = `M${r[0].toFixed(2)},${r[1].toFixed(2)} Q${o3[0].toFixed(2)},${o3[1].toFixed(2)} ${xr(o3[0], i3[0]).toFixed(2)},${xr(o3[1], i3[1]).toFixed(2)} T`;
  for (let s3 = 2, d = n3 - 1; s3 < d; s3++) r = e8[s3], o3 = e8[s3 + 1], a3 += `${xr(r[0], o3[0]).toFixed(2)},${xr(r[1], o3[1]).toFixed(2)} `;
  return t3 && (a3 += "Z"), a3;
}
var gd = (e8) => e8.replace(/\r?\n|\r/g, `
`);
var tt = (e8) => e8;
var mn = async (e8, ...t3) => new Promise((n3) => {
  n3(e8(...t3));
});
var xd = (...e8) => Math.max(...e8.map((t3) => t3 ? 1 : 0)) > 0;
var vr = class {
  constructor(t3, n3) {
    i(this, "pool");
    i(this, "entries", {});
    this.pool = new import_es6_promise_pool.default(t3, n3);
  }
  all() {
    let t3 = (n3) => {
      if (n3.data.result) {
        let [r, o3] = n3.data.result;
        this.entries[r] = o3;
      }
    };
    return this.pool.addEventListener("fulfilled", t3), this.pool.start().then(() => (setTimeout(() => {
      this.pool.removeEventListener("fulfilled", t3);
    }), Object.values(this.entries)));
  }
};
var kn = (e8) => e8.replace(/"/g, "&quot;");
var $g = (e8) => Array.isArray(e8) ? e8 : [e8];
var At = (e8) => !!e8 && e8.type === "image" && !!e8.fileId;
var Ye = (e8) => !!e8 && e8.type === "image";
var Bo = (e8) => !!e8 && e8.type === "embeddable";
var _o = (e8) => !!e8 && e8.type === "iframe";
var gt = (e8) => !!e8 && (e8.type === "iframe" || e8.type === "embeddable");
var k = (e8) => e8 != null && e8.type === "text";
var hd = (e8) => e8 != null && e8.type === "frame";
var yd = (e8) => e8 != null && e8.type === "magicframe";
var de2 = (e8) => e8 != null && (e8.type === "frame" || e8.type === "magicframe");
var Ce = (e8) => e8 != null && P6(e8.type);
var P6 = (e8) => e8 === "freedraw";
var ae2 = (e8) => e8 != null && na(e8.type);
var ee2 = (e8) => e8 != null && e8.type === "arrow";
var X = (e8) => ee2(e8) && e8.elbowed;
var na = (e8) => e8 === "arrow" || e8 === "line";
var Pr = (e8, t3 = true) => e8 != null && (!e8.locked || t3 === true) && N6(e8.type);
var N6 = (e8) => e8 === "arrow";
var xt = (e8, t3 = true) => e8 != null && (!e8.locked || t3 === true) && (e8.type === "rectangle" || e8.type === "diamond" || e8.type === "ellipse" || e8.type === "image" || e8.type === "iframe" || e8.type === "embeddable" || e8.type === "frame" || e8.type === "magicframe" || e8.type === "text" && !e8.containerId);
var Id = (e8) => e8 != null && (e8.type === "rectangle" || e8.type === "diamond" || e8.type === "image" || e8.type === "iframe" || e8.type === "embeddable" || e8.type === "frame" || e8.type === "magicframe" || e8.type === "text" && !e8.containerId);
var F6 = (e8, t3 = true) => e8 != null && (!e8.locked || t3 === true) && (e8.type === "rectangle" || e8.type === "diamond" || e8.type === "ellipse" || ee2(e8));
var ra = (e8) => {
  let t3 = e8?.type;
  if (!t3) return false;
  switch (t3) {
    case "text":
    case "diamond":
    case "rectangle":
    case "iframe":
    case "embeddable":
    case "ellipse":
    case "arrow":
    case "freedraw":
    case "line":
    case "frame":
    case "magicframe":
    case "image":
    case "selection":
      return true;
    default:
      return Sn(t3, null), false;
  }
};
var Og = (e8) => e8.type === "rectangle" || e8.type === "ellipse" || e8.type === "diamond";
var bn = (e8) => F6(e8) && !!e8.boundElements?.some(({ type: t3 }) => t3 === "text");
var Ne = (e8) => e8 !== null && "containerId" in e8 && e8.containerId !== null && k(e8);
var Oo = (e8) => e8 === "rectangle" || e8 === "embeddable" || e8 === "iframe" || e8 === "image";
var wd = (e8) => e8 === "line" || e8 === "arrow" || e8 === "diamond";
var Ag = (e8, t3) => !!((e8 === ot.ADAPTIVE_RADIUS || e8 === ot.LEGACY) && Oo(t3.type) || e8 === ot.PROPORTIONAL_RADIUS && wd(t3.type));
var Kg = (e8) => wd(e8.type) ? { type: ot.PROPORTIONAL_RADIUS } : Oo(e8.type) ? { type: ot.ADAPTIVE_RADIUS } : null;
var vn = (e8) => Object.hasOwn(e8, "fixedPoint") && e8.fixedPoint != null;
var ht = (e8, t3, n3) => {
  let r = e8.split(`
`).map((s3) => s3 || " ").join(`
`), o3 = parseFloat(t3), i3 = B6(r, o3, n3);
  return { width: Dd(r, t3), height: i3 };
};
var Rd = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".toLocaleUpperCase();
var Td = (e8, t3) => {
  let n3 = _6(e8);
  return n3 === 0 ? ht(Rd.split("").join(`
`), e8, t3).width + Se * 2 : n3 + Se * 2;
};
var Ko = (e8, t3) => ht("", e8, t3).width + Se * 2;
var Vg = () => Dd(Rd, Ee({ fontSize: ut, fontFamily: Ft })) > 0;
var ia = (e8) => gd(e8).replace(/\t/g, "        ");
var aa = (e8) => ia(e8).split(`
`);
var Md = (e8) => {
  let t3 = aa(e8.text).length;
  return e8.height / t3 / e8.fontSize;
};
var Zn = (e8, t3) => e8 * t3;
var Ld = (e8, t3) => Zn(e8, t3) + Se * 2;
var Ao;
var qg = (e8) => {
  Ao = e8;
};
var oa = class {
  constructor() {
    i(this, "canvas");
    this.canvas = document.createElement("canvas");
  }
  getLineWidth(t3, n3) {
    let r = this.canvas.getContext("2d");
    r.font = n3;
    let i3 = r.measureText(t3).width;
    return Ot() ? i3 * 10 : i3;
  }
};
var En = (e8, t3) => (Ao || (Ao = new oa()), Ao.getLineWidth(e8, t3));
var Dd = (e8, t3) => {
  let n3 = aa(e8), r = 0;
  return n3.forEach((o3) => {
    r = Math.max(r, En(o3, t3));
  }), r;
};
var B6 = (e8, t3, n3) => {
  let r = aa(e8).length;
  return Zn(t3, n3) * r;
};
var $n = /* @__PURE__ */ (() => {
  let e8 = {};
  return { calculate: (o3, i3) => {
    let a3 = o3.charCodeAt(0);
    if (e8[i3] || (e8[i3] = []), !e8[i3][a3]) {
      let s3 = En(o3, i3);
      e8[i3][a3] = s3;
    }
    return e8[i3][a3];
  }, getCache: (o3) => e8[o3], clearCache: (o3) => {
    e8[o3] = [];
  } };
})();
var _6 = (e8) => {
  let t3 = $n.getCache(e8);
  if (!t3) return 0;
  let n3 = t3.filter((r) => r !== void 0);
  return Math.max(...n3);
};
var sa;
var Ho;
var da;
var Sd = (e8) => (sa || (sa = le.class(...Object.values(jt))), sa.test(e8));
var O6 = () => {
  if (!Ho) try {
    Ho = K6();
  } catch {
    Ho = A6();
  }
  return Ho;
};
var ca = () => (da || (da = H6()), da);
var ct = { WHITESPACE: /\s/u, HYPHEN: /-/u, OPENING: /<\(\[\{/u, CLOSING: />\)\]\}.,:;!\?…\//u };
var jt = { CHAR: /\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}｀＇＾〃〰〆＃＆＊＋－ー／＼＝｜￤〒￢￣/u, OPENING: /（［｛〈《｟｢「『【〖〔〘〚＜〝/u, CLOSING: /）］｝〉》｠｣」』】〗〕〙〛＞。．，、〟‥？！：；・〜〞/u, CURRENCY: /￥￦￡￠＄/u };
var Pn = { FLAG: /\p{RI}\p{RI}/u, JOINER: /(?:\p{Emoji_Modifier}|\uFE0F\u20E3?|[\u{E0020}-\u{E007E}]+\u{E007F})?/u, ZWJ: /\u200D/u, ANY: /[\p{Emoji}]/u, MOST: /[\p{Extended_Pictographic}\p{Emoji_Presentation}]/u };
var A6 = () => le.or(ca(), De.On(ct.HYPHEN, ct.WHITESPACE, jt.CHAR));
var K6 = () => le.or(ca(), De.Before(ct.WHITESPACE).Build(), De.After(ct.WHITESPACE, ct.HYPHEN).Build(), De.Before(jt.CHAR, jt.CURRENCY).NotPrecededBy(ct.OPENING, jt.OPENING).Build(), De.After(jt.CHAR).NotFollowedBy(ct.HYPHEN, ct.CLOSING, jt.CLOSING).Build(), De.BeforeMany(jt.OPENING).NotPrecededBy(ct.OPENING).Build(), De.AfterMany(jt.CLOSING).NotFollowedBy(ct.CLOSING).Build(), De.AfterMany(ct.CLOSING).FollowedBy(ct.OPENING).Build());
var H6 = () => le.group(le.or(Pn.FLAG, le.and(Pn.MOST, Pn.JOINER, le.build(`(?:${Pn.ZWJ.source}(?:${Pn.FLAG.source}|${Pn.ANY.source}${Pn.JOINER.source}))*`))));
var le = { build: (e8) => new RegExp(e8, "u"), join: (...e8) => e8.map((t3) => t3.source).join(""), and: (...e8) => le.build(le.join(...e8)), or: (...e8) => le.build(e8.map((t3) => t3.source).join("|")), group: (...e8) => le.build(`(${le.join(...e8)})`), class: (...e8) => le.build(`[${le.join(...e8)}]`) };
var De = { On: (...e8) => {
  let t3 = le.join(...e8);
  return le.build(`([${t3}])`);
}, Before: (...e8) => {
  let t3 = le.join(...e8), n3 = () => le.build(`(?=[${t3}])`);
  return De.Chain(n3);
}, After: (...e8) => {
  let t3 = le.join(...e8), n3 = () => le.build(`(?<=[${t3}])`);
  return De.Chain(n3);
}, BeforeMany: (...e8) => {
  let t3 = le.join(...e8), n3 = () => le.build(`(?<![${t3}])(?=[${t3}])`);
  return De.Chain(n3);
}, AfterMany: (...e8) => {
  let t3 = le.join(...e8), n3 = () => le.build(`(?<=[${t3}])(?![${t3}])`);
  return De.Chain(n3);
}, NotBefore: (...e8) => {
  let t3 = le.join(...e8), n3 = () => le.build(`(?![${t3}])`);
  return De.Chain(n3);
}, NotAfter: (...e8) => {
  let t3 = le.join(...e8), n3 = () => le.build(`(?<![${t3}])`);
  return De.Chain(n3);
}, Chain: (e8) => ({ Build: e8, PreceededBy: (...t3) => {
  let n3 = e8(), r = De.After(...t3).Build(), o3 = () => le.and(r, n3);
  return De.Chain(o3);
}, FollowedBy: (...t3) => {
  let n3 = e8(), r = De.Before(...t3).Build(), o3 = () => le.and(n3, r);
  return De.Chain(o3);
}, NotPrecededBy: (...t3) => {
  let n3 = e8(), r = De.NotAfter(...t3).Build(), o3 = () => le.and(r, n3);
  return De.Chain(o3);
}, NotFollowedBy: (...t3) => {
  let n3 = e8(), r = De.NotBefore(...t3).Build(), o3 = () => le.and(n3, r);
  return De.Chain(o3);
} }) };
var J6 = (e8) => {
  let t3 = O6();
  return e8.normalize("NFC").split(t3).filter(Boolean);
};
var en = (e8, t3, n3) => {
  if (!Number.isFinite(n3) || n3 < 0) return e8;
  let r = [], o3 = e8.split(`
`);
  for (let i3 of o3) {
    if (En(i3, t3) <= n3) {
      r.push(i3);
      continue;
    }
    let s3 = Y6(i3, t3, n3);
    r.push(...s3);
  }
  return r.join(`
`);
};
var Y6 = (e8, t3, n3) => {
  let r = [], i3 = J6(e8)[Symbol.iterator](), a3 = "", s3 = 0, d = i3.next();
  for (; !d.done; ) {
    let c3 = d.value, l3 = a3 + c3, U = q6(c3) ? s3 + $n.calculate(c3, t3) : En(l3, t3);
    if (/\s/.test(c3) || U <= n3) {
      a3 = l3, s3 = U, d = i3.next();
      continue;
    }
    if (a3) r.push(a3.trimEnd()), a3 = "", s3 = 0;
    else {
      let p = C6(c3, t3, n3), m = p[p.length - 1] ?? "", b3 = p.slice(0, -1);
      r.push(...b3), a3 = m, s3 = En(m, t3), d = i3.next();
    }
  }
  if (a3) {
    let c3 = V6(a3, t3, n3);
    r.push(c3);
  }
  return r;
};
var C6 = (e8, t3, n3) => {
  if (ca().test(e8)) return [e8];
  X6(e8);
  let r = [], o3 = Array.from(e8), i3 = "", a3 = 0;
  for (let s3 of o3) {
    let d = $n.calculate(s3, t3), c3 = a3 + d;
    if (c3 <= n3) {
      i3 = i3 + s3, a3 = c3;
      continue;
    }
    i3 && r.push(i3), i3 = s3, a3 = d;
  }
  return i3 && r.push(i3), r;
};
var V6 = (e8, t3, n3) => {
  if (!(En(e8, t3) > n3)) return e8;
  let [, o3, i3] = e8.match(/^(.+?)(\s+)$/) ?? [e8, e8.trimEnd(), ""], a3 = En(o3, t3);
  for (let s3 of Array.from(i3)) {
    let d = $n.calculate(s3, t3), c3 = a3 + d;
    if (c3 > n3) break;
    o3 = o3 + s3, a3 = c3;
  }
  return o3;
};
var q6 = (e8) => e8.codePointAt(0) !== void 0 && e8.codePointAt(1) === void 0;
var X6 = (e8) => {
  if ((c.MODE === je.TEST || c.DEV) && /\s/.test(e8)) throw new Error("Word should not contain any whitespaces!");
};
var Xe = class Xe2 {
};
i(Xe, "rg", new RoughGenerator()), i(Xe, "cache", /* @__PURE__ */ new WeakMap()), i(Xe, "get", (t3) => Xe.cache.get(t3)), i(Xe, "set", (t3, n3) => Xe.cache.set(t3, n3)), i(Xe, "delete", (t3) => Xe.cache.delete(t3)), i(Xe, "destroy", () => {
  Xe.cache = /* @__PURE__ */ new WeakMap();
}), i(Xe, "generateElementShape", (t3, n3) => {
  let r = n3?.isExporting ? void 0 : Xe.get(t3);
  if (r !== void 0) return r;
  Jo.delete(t3);
  let o3 = vd(t3, Xe.rg, n3 || { isExporting: false, canvasBackgroundColor: Z.white, embedsValidationStatus: null });
  return Xe.cache.set(t3, o3), o3;
});
var he2 = Xe;
var yt = (e8) => "var(--icon-fill-color)";
var $d = (e8) => e8 === ke.LIGHT ? open_color_default.white : "#1e1e1e";
var R2 = (e8, t3 = 512) => {
  let { width: n3 = 512, height: r = n3, mirror: o3, style: i3, ...a3 } = typeof t3 == "number" ? { width: t3 } : t3;
  return jsx("svg", { "aria-hidden": "true", focusable: "false", role: "img", viewBox: `0 0 ${n3} ${r}`, className: clsx_m_default({ "rtl-mirror": o3 }), style: i3, ...a3, children: typeof e8 == "string" ? jsx("path", { fill: "currentColor", d: e8 }) : e8 });
};
var F = { width: 24, height: 24, fill: "none", strokeWidth: 2, stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" };
var G2 = { width: 20, height: 20, fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" };
var lx = R2(jsxs("g", { strokeWidth: "1.5", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("rect", { x: 3, y: 8, width: 18, height: 4, rx: 1 }), jsx("line", { x1: 12, y1: 8, x2: 12, y2: 21 }), jsx("path", { d: "M19 12v7a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-7" }), jsx("path", { d: "M7.5 8a2.5 2.5 0 0 1 0 -5a4.8 8 0 0 1 4.5 5a4.8 8 0 0 1 4.5 -5a2.5 2.5 0 0 1 0 5" })] }), F);
var Ux = R2(jsxs("g", { strokeWidth: "1.25", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0" }), jsx("path", { d: "M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0" }), jsx("line", { x1: "3", y1: "6", x2: "3", y2: "19" }), jsx("line", { x1: "12", y1: "6", x2: "12", y2: "19" }), jsx("line", { x1: "21", y1: "6", x2: "21", y2: "19" })] }), F);
var fx = R2(jsxs("svg", { strokeWidth: "1.5", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("line", { x1: "12", y1: "5", x2: "12", y2: "19" }), jsx("line", { x1: "5", y1: "12", x2: "19", y2: "12" })] }), F);
var px = R2(jsxs("g", { strokeWidth: "1.5", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("circle", { cx: "12", cy: "12", r: "1" }), jsx("circle", { cx: "12", cy: "19", r: "1" }), jsx("circle", { cx: "12", cy: "5", r: "1" })] }), F);
var ux = R2(jsxs("svg", { strokeWidth: "1.5", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M9 4v6l-2 4v2h10v-2l-2 -4v-6" }), jsx("line", { x1: "12", y1: "16", x2: "12", y2: "21" }), jsx("line", { x1: "8", y1: "4", x2: "16", y2: "4" })] }), F);
var mx = R2(jsxs("g", { children: [jsx("path", { d: "M13.542 8.542H6.458a2.5 2.5 0 0 0-2.5 2.5v3.75a2.5 2.5 0 0 0 2.5 2.5h7.084a2.5 2.5 0 0 0 2.5-2.5v-3.75a2.5 2.5 0 0 0-2.5-2.5Z", stroke: "currentColor", strokeWidth: "1.25" }), jsx("path", { d: "M10 13.958a1.042 1.042 0 1 0 0-2.083 1.042 1.042 0 0 0 0 2.083Z", stroke: "currentColor", strokeWidth: "1.25" }), jsx("mask", { id: "UnlockedIcon", style: { maskType: "alpha" }, maskUnits: "userSpaceOnUse", x: 6, y: 1, width: 9, height: 9, children: jsx("path", { stroke: "none", d: "M6.399 9.561V5.175c0-.93.401-1.823 1.116-2.48a3.981 3.981 0 0 1 2.693-1.028c1.01 0 1.98.37 2.694 1.027.715.658 1.116 1.55 1.116 2.481", fill: "#fff" }) }), jsx("g", { mask: "url(#UnlockedIcon)", children: jsx("path", { stroke: "none", d: "M5.149 9.561v1.25h2.5v-1.25h-2.5Zm5.06-7.894V.417v1.25Zm2.559 3.508v1.25h2.5v-1.25h-2.5ZM7.648 8.51V5.175h-2.5V8.51h2.5Zm0-3.334c0-.564.243-1.128.713-1.561L6.668 1.775c-.959.883-1.52 2.104-1.52 3.4h2.5Zm.713-1.561a2.732 2.732 0 0 1 1.847-.697v-2.5c-1.31 0-2.585.478-3.54 1.358L8.36 3.614Zm1.847-.697c.71 0 1.374.26 1.847.697l1.694-1.839a5.231 5.231 0 0 0-3.54-1.358v2.5Zm1.847.697c.47.433.713.997.713 1.561h2.5c0-1.296-.56-2.517-1.52-3.4l-1.693 1.839Z", fill: "currentColor" }) })] }), G2);
var bx = R2(jsxs("g", { strokeWidth: "1.25", children: [jsx("path", { d: "M13.542 8.542H6.458a2.5 2.5 0 0 0-2.5 2.5v3.75a2.5 2.5 0 0 0 2.5 2.5h7.084a2.5 2.5 0 0 0 2.5-2.5v-3.75a2.5 2.5 0 0 0-2.5-2.5Z" }), jsx("path", { d: "M10 13.958a1.042 1.042 0 1 0 0-2.083 1.042 1.042 0 0 0 0 2.083Z" }), jsx("path", { d: "M6.667 8.333V5.417C6.667 3.806 8.159 2.5 10 2.5c1.841 0 3.333 1.306 3.333 2.917v2.916" })] }), G2);
var Ex = R2(jsxs(Fragment, { children: [jsx("path", { d: "M38.5 83.5c-14-2-17.833-10.473-21-22.5C14.333 48.984 12 22 12 12.5", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" }), jsx("path", { fillRule: "evenodd", clipRule: "evenodd", d: "m12.005 10.478 7.905 14.423L6 25.75l6.005-15.273Z", fill: "currentColor" }), jsx("path", { d: "M12.005 10.478c1.92 3.495 3.838 7 7.905 14.423m-7.905-14.423c3.11 5.683 6.23 11.368 7.905 14.423m0 0c-3.68.226-7.35.455-13.91.85m13.91-.85c-5.279.33-10.566.647-13.91.85m0 0c1.936-4.931 3.882-9.86 6.005-15.273M6 25.75c2.069-5.257 4.135-10.505 6.005-15.272", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" })] }), { width: 41, height: 94, fill: "none" });
var gx = R2(jsxs(Fragment, { children: [jsx("path", { d: "M18.026 1.232c-5.268 13.125-5.548 33.555 3.285 42.311 8.823 8.75 33.31 12.304 42.422 13.523", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" }), jsx("path", { fillRule: "evenodd", clipRule: "evenodd", d: "m72.181 59.247-13.058-10-2.948 13.62 16.006-3.62Z", fill: "currentColor" }), jsx("path", { d: "M72.181 59.247c-3.163-2.429-6.337-4.856-13.058-10m13.058 10c-5.145-3.936-10.292-7.882-13.058-10m0 0c-.78 3.603-1.563 7.196-2.948 13.62m2.948-13.62c-1.126 5.168-2.24 10.346-2.948 13.62m0 0c5.168-1.166 10.334-2.343 16.006-3.62m-16.006 3.62c5.51-1.248 11.01-2.495 16.006-3.62", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" })] }), { width: 85, height: 71, fill: "none" });
var xx = R2(jsxs(Fragment, { children: [jsx("path", { d: "M1 77c14-2 31.833-11.973 35-24 3.167-12.016-6-35-9.5-43.5", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" }), jsx("path", { fillRule: "evenodd", clipRule: "evenodd", d: "m24.165 1.093-2.132 16.309 13.27-4.258-11.138-12.05Z", fill: "currentColor" }), jsx("path", { d: "M24.165 1.093c-.522 3.953-1.037 7.916-2.132 16.309m2.131-16.309c-.835 6.424-1.68 12.854-2.13 16.308m0 0c3.51-1.125 7.013-2.243 13.27-4.257m-13.27 4.257c5.038-1.608 10.08-3.232 13.27-4.257m0 0c-3.595-3.892-7.197-7.777-11.14-12.05m11.14 12.05c-3.837-4.148-7.667-8.287-11.14-12.05", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" })] }), { width: 38, height: 78, fill: "none" });
var hx = R2(jsx("g", { fill: "currentColor", children: jsx("path", { d: "M39.9 32.889a.326.326 0 0 0-.279-.056c-2.094-3.083-4.774-6-7.343-8.833l-.419-.472a.212.212 0 0 0-.056-.139.586.586 0 0 0-.167-.111l-.084-.083-.056-.056c-.084-.167-.28-.278-.475-.167-.782.39-1.507.973-2.206 1.528-.92.722-1.842 1.445-2.708 2.25a8.405 8.405 0 0 0-.977 1.028c-.14.194-.028.361.14.444-.615.611-1.23 1.223-1.843 1.861a.315.315 0 0 0-.084.223c0 .083.056.166.111.194l1.09.833v.028c1.535 1.528 4.244 3.611 7.12 5.861.418.334.865.667 1.284 1 .195.223.39.473.558.695.084.11.28.139.391.055.056.056.14.111.196.167a.398.398 0 0 0 .167.056.255.255 0 0 0 .224-.111.394.394 0 0 0 .055-.167c.029 0 .028.028.056.028a.318.318 0 0 0 .224-.084l5.082-5.528a.309.309 0 0 0 0-.444Zm-14.63-1.917a.485.485 0 0 0 .111.14c.586.5 1.2 1 1.843 1.555l-2.569-1.945-.251-.166c-.056-.028-.112-.084-.168-.111l-.195-.167.056-.056.055-.055.112-.111c.866-.861 2.346-2.306 3.1-3.028-.81.805-2.43 3.167-2.095 3.944Zm8.767 6.89-2.122-1.612a44.713 44.713 0 0 0-2.625-2.5c1.145.861 2.122 1.611 2.262 1.75 1.117.972 1.06.806 1.815 1.445l.921.666a1.06 1.06 0 0 1-.251.25Zm.558.416-.056-.028c.084-.055.168-.111.252-.194l-.196.222ZM1.089 5.75c.055.361.14.722.195 1.056.335 1.833.67 3.5 1.284 4.75l.252.944c.084.361.223.806.363.917 1.424 1.25 3.602 3.11 5.947 4.889a.295.295 0 0 0 .363 0s0 .027.028.027a.254.254 0 0 0 .196.084.318.318 0 0 0 .223-.084c2.988-3.305 5.221-6.027 6.813-8.305.112-.111.14-.278.14-.417.111-.111.195-.25.307-.333.111-.111.111-.306 0-.39l-.028-.027c0-.055-.028-.139-.084-.167-.698-.666-1.2-1.138-1.731-1.638-.922-.862-1.871-1.75-3.881-3.75l-.028-.028c-.028-.028-.056-.056-.112-.056-.558-.194-1.703-.389-3.127-.639C6.087 2.223 3.21 1.723.614.944c0 0-.168 0-.196.028l-.083.084c-.028.027-.056.055-.224.11h.056-.056c.028.167.028.278.084.473 0 .055.112.5.112.555l.782 3.556Zm15.496 3.278-.335-.334c.084.112.196.195.335.334Zm-3.546 4.666-.056.056c0-.028.028-.056.056-.056Zm-2.038-10c.168.167.866.834 1.033.973-.726-.334-2.54-1.167-3.379-1.445.838.167 1.983.334 2.346.472ZM1.424 2.306c.419.722.754 3.222 1.089 5.666-.196-.778-.335-1.555-.503-2.278-.251-1.277-.503-2.416-.838-3.416.056 0 .14 0 .252.028Zm-.168-.584c-.112 0-.223-.028-.307-.028 0-.027 0-.055-.028-.055.14 0 .223.028.335.083Zm-1.089.222c0-.027 0-.027 0 0ZM39.453 1.333c.028-.11-.558-.61-.363-.639.42-.027.42-.666 0-.666-.558.028-1.144.166-1.675.25-.977.194-1.982.389-2.96.61-2.205.473-4.383.973-6.561 1.557-.67.194-1.424.333-2.066.666-.224.111-.196.333-.084.472-.056.028-.084.028-.14.056-.195.028-.363.056-.558.083-.168.028-.252.167-.224.334 0 .027.028.083.028.11-1.173 1.556-2.485 3.195-3.909 4.945-1.396 1.611-2.876 3.306-4.356 5.056-4.719 5.5-10.052 11.75-15.943 17.25a.268.268 0 0 0 0 .389c.028.027.056.055.084.055-.084.084-.168.14-.252.222-.056.056-.084.111-.084.167a.605.605 0 0 0-.111.139c-.112.111-.112.305.028.389.111.11.307.11.39-.028.029-.028.029-.056.056-.056a.44.44 0 0 1 .615 0c.335.362.67.723.977 1.028l-.698-.583c-.112-.111-.307-.083-.39.028-.113.11-.085.305.027.389l7.427 6.194c.056.056.112.056.196.056s.14-.028.195-.084l.168-.166c.028.027.083.027.111.027.084 0 .14-.027.196-.083 10.052-10.055 18.15-17.639 27.42-24.417.083-.055.111-.166.111-.25.112 0 .196-.083.251-.194 1.704-5.194 2.039-9.806 2.15-12.083v-.028c0-.028.028-.056.028-.083.028-.056.028-.084.028-.084a1.626 1.626 0 0 0-.111-1.028ZM21.472 9.5c.446-.5.893-1.028 1.34-1.5-2.876 3.778-7.65 9.583-14.408 16.5 4.607-5.083 9.242-10.333 13.068-15ZM5.193 35.778h.084-.084Zm3.462 3.194c-.027-.028-.027-.028 0-.028v.028Zm4.16-3.583c.224-.25.448-.472.699-.722 0 0 0 .027.028.027-.252.223-.475.445-.726.695Zm1.146-1.111c.14-.14.279-.334.446-.5l.028-.028c1.648-1.694 3.351-3.389 5.082-5.111l.028-.028c.419-.333.921-.694 1.368-1.028a379.003 379.003 0 0 0-6.952 6.695ZM24.794 6.472c-.921 1.195-1.954 2.778-2.82 4.028-2.736 3.944-11.532 13.583-11.727 13.75a1976.983 1976.983 0 0 1-8.042 7.639l-.167.167c-.14-.167-.14-.417.028-.556C14.49 19.861 22.03 10.167 25.074 5.917c-.084.194-.14.36-.28.555Zm4.83 5.695c-1.116-.64-1.646-1.64-1.34-2.611l.084-.334c.028-.083.084-.194.14-.277.307-.5.754-.917 1.257-1.167.027 0 .055 0 .083-.028-.028-.056-.028-.139-.028-.222.028-.167.14-.278.335-.278.335 0 1.369.306 1.76.639.111.083.223.194.335.305.14.167.363.445.474.667.056.028.112.306.196.445.056.222.111.472.084.694-.028.028 0 .194-.028.194a2.668 2.668 0 0 1-.363 1.028c-.028.028-.028.056-.056.084l-.028.027c-.14.223-.335.417-.53.556-.643.444-1.369.583-2.095.389 0 0-.195-.084-.28-.111Zm8.154-.834a39.098 39.098 0 0 1-.893 3.167c0 .028-.028.083 0 .111-.056 0-.084.028-.14.056-2.206 1.61-4.356 3.305-6.506 5.028 1.843-1.64 3.686-3.306 5.613-4.945.558-.5.949-1.139 1.06-1.861l.28-1.667v-.055c.14-.334.67-.195.586.166Z", fill: "currentColor" }) }), { width: 40, height: 40, fill: "none" });
var Pd = R2(jsxs("g", { stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M6 6l4.153 11.793a0.365 .365 0 0 0 .331 .207a0.366 .366 0 0 0 .332 -.207l2.184 -4.793l4.787 -1.994a0.355 .355 0 0 0 .213 -.323a0.355 .355 0 0 0 -.213 -.323l-11.787 -4.36z" }), jsx("path", { d: "M13.5 13.5l4.5 4.5" })] }), { fill: "none", width: 22, height: 22, strokeWidth: 1.25 });
var Nd = R2(jsxs("g", { strokeWidth: "1.5", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("rect", { x: "4", y: "4", width: "16", height: "16", rx: "2" })] }), F);
var Fd = R2(jsxs("g", { strokeWidth: "1.5", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M10.5 20.4l-6.9 -6.9c-.781 -.781 -.781 -2.219 0 -3l6.9 -6.9c.781 -.781 2.219 -.781 3 0l6.9 6.9c.781 .781 .781 2.219 0 3l-6.9 6.9c-.781 .781 -2.219 .781 -3 0z" })] }), F);
var Bd = R2(jsxs("g", { strokeWidth: "1.5", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("circle", { cx: "12", cy: "12", r: "9" })] }), F);
var _d = R2(jsxs("g", { strokeWidth: "1.5", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("line", { x1: "5", y1: "12", x2: "19", y2: "12" }), jsx("line", { x1: "15", y1: "16", x2: "19", y2: "12" }), jsx("line", { x1: "15", y1: "8", x2: "19", y2: "12" })] }), F);
var Od = R2(jsx("path", { d: "M4.167 10h11.666", strokeWidth: "1.5" }), G2);
var yx = R2(jsxs("g", { strokeWidth: "1.25", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M20 17v-12c0 -1.121 -.879 -2 -2 -2s-2 .879 -2 2v12l2 2l2 -2z" }), jsx("path", { d: "M16 7h4" }), jsx("path", { d: "M18 19h-13a2 2 0 1 1 0 -4h4a2 2 0 1 0 0 -4h-3" })] }), F);
var Nr = R2(jsxs("g", { strokeWidth: "1.25", children: [jsx("path", { clipRule: "evenodd", d: "m7.643 15.69 7.774-7.773a2.357 2.357 0 1 0-3.334-3.334L4.31 12.357a3.333 3.333 0 0 0-.977 2.357v1.953h1.953c.884 0 1.732-.352 2.357-.977Z" }), jsx("path", { d: "m11.25 5.417 3.333 3.333" })] }), G2);
var Ad = R2(jsxs("g", { strokeWidth: "1.5", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("line", { x1: "4", y1: "20", x2: "7", y2: "20" }), jsx("line", { x1: "14", y1: "20", x2: "21", y2: "20" }), jsx("line", { x1: "6.9", y1: "15", x2: "13.8", y2: "15" }), jsx("line", { x1: "10.2", y1: "6.3", x2: "16", y2: "20" }), jsx("polyline", { points: "5 20 11 4 13 4 20 20" })] }), F);
var Kd = R2(jsxs("g", { strokeWidth: "1.25", children: [jsx("path", { d: "M12.5 6.667h.01" }), jsx("path", { d: "M4.91 2.625h10.18a2.284 2.284 0 0 1 2.285 2.284v10.182a2.284 2.284 0 0 1-2.284 2.284H4.909a2.284 2.284 0 0 1-2.284-2.284V4.909a2.284 2.284 0 0 1 2.284-2.284Z" }), jsx("path", { d: "m3.333 12.5 3.334-3.333c.773-.745 1.726-.745 2.5 0l4.166 4.166" }), jsx("path", { d: "m11.667 11.667.833-.834c.774-.744 1.726-.744 2.5 0l1.667 1.667" })] }), G2);
var Hd = R2(jsxs("g", { strokeWidth: "1.5", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M19 20h-10.5l-4.21 -4.3a1 1 0 0 1 0 -1.41l10 -10a1 1 0 0 1 1.41 0l5 5a1 1 0 0 1 0 1.41l-9.2 9.3" }), jsx("path", { d: "M18 13.3l-6.3 -6.3" })] }), F);
var Ix = R2(jsx("path", { strokeWidth: "1.25", d: "M10 4.167v11.666M4.167 10h11.666" }), G2);
var wx = R2(jsx("path", { d: "M5 10h10", strokeWidth: "1.25" }), G2);
var Rx = R2(jsxs("g", { strokeWidth: 1.25, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M21 21l-6 -6" }), jsx("path", { d: "M3.268 12.043a7.017 7.017 0 0 0 6.634 4.957a7.012 7.012 0 0 0 7.043 -6.131a7 7 0 0 0 -5.314 -7.672a7.021 7.021 0 0 0 -8.241 4.403" }), jsx("path", { d: "M3 4v4h4" })] }), F);
var Tx = R2(jsx("path", { strokeWidth: "1.25", d: "M3.333 5.833h13.334M8.333 9.167v5M11.667 9.167v5M4.167 5.833l.833 10c0 .92.746 1.667 1.667 1.667h6.666c.92 0 1.667-.746 1.667-1.667l.833-10M7.5 5.833v-2.5c0-.46.373-.833.833-.833h3.334c.46 0 .833.373.833.833v2.5" }), G2);
var Mx = R2(jsxs("g", { strokeWidth: "1.25", children: [jsx("polyline", { points: "12 16 18 10 12 4" }), jsx("polyline", { points: "8 4 2 10 8 16" })] }), G2);
var Lx = R2(jsxs("g", { strokeWidth: "1.25", children: [jsx("path", { d: "M14.375 6.458H8.958a2.5 2.5 0 0 0-2.5 2.5v5.417a2.5 2.5 0 0 0 2.5 2.5h5.417a2.5 2.5 0 0 0 2.5-2.5V8.958a2.5 2.5 0 0 0-2.5-2.5Z" }), jsx("path", { clipRule: "evenodd", d: "M11.667 3.125c.517 0 .986.21 1.325.55.34.338.55.807.55 1.325v1.458H8.333c-.485 0-.927.185-1.26.487-.343.312-.57.75-.609 1.24l-.005 5.357H5a1.87 1.87 0 0 1-1.326-.55 1.87 1.87 0 0 1-.549-1.325V5c0-.518.21-.987.55-1.326.338-.34.807-.549 1.325-.549h6.667Z" })] }), G2);
var Dx = R2(jsx("path", { clipRule: "evenodd", d: "M10 2.5h.328a6.25 6.25 0 0 0 6.6 10.372A7.5 7.5 0 1 1 10 2.493V2.5Z", stroke: "currentColor" }), G2);
var Sx = R2(jsx("g", { stroke: "currentColor", strokeLinejoin: "round", children: jsx("path", { d: "M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM10 4.167V2.5M14.167 5.833l1.166-1.166M15.833 10H17.5M14.167 14.167l1.166 1.166M10 15.833V17.5M5.833 14.167l-1.166 1.166M5 10H3.333M5.833 5.833 4.667 4.667" }) }), { ...G2, strokeWidth: 1.5 });
var vx = R2(jsxs("g", { strokeWidth: "1.5", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("line", { x1: "4", y1: "6", x2: "20", y2: "6" }), jsx("line", { x1: "4", y1: "12", x2: "20", y2: "12" }), jsx("line", { x1: "4", y1: "18", x2: "20", y2: "18" })] }), F);
var $x = R2(jsx("path", { strokeWidth: "1.25", d: "M3.333 14.167v1.666c0 .92.747 1.667 1.667 1.667h10c.92 0 1.667-.746 1.667-1.667v-1.666M5.833 9.167 10 13.333l4.167-4.166M10 3.333v10" }), G2);
var Px = R2(jsxs("g", { strokeWidth: "1.5", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("circle", { cx: "12", cy: "12", r: "9" }), jsx("line", { x1: "12", y1: "17", x2: "12", y2: "17.01" }), jsx("path", { d: "M12 13.5a1.5 1.5 0 0 1 1 -1.5a2.6 2.6 0 1 0 -3 -4" })] }), F);
var Nx = R2(jsxs("g", { strokeWidth: "1.25", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("circle", { cx: "12", cy: "12", r: "9" }), jsx("line", { x1: "12", y1: "17", x2: "12", y2: "17.01" }), jsx("path", { d: "M12 13.5a1.5 1.5 0 0 1 1 -1.5a2.6 2.6 0 1 0 -3 -4" })] }), F);
var Fx = R2(jsx("path", { strokeWidth: "1.25", d: "M9.167 5.833H5.833c-1.254 0-2.5 1.282-2.5 2.5v5.834c0 1.283 1.252 2.5 2.5 2.5h5.834c1.251 0 2.5-1.25 2.5-2.5v-3.334M8.333 11.667l8.334-8.334M12.5 3.333h4.167V7.5" }), G2);
var Bx = R2(jsx("path", { d: "M7.5 15.833c-3.583 1.167-3.583-2.083-5-2.5m10 4.167v-2.917c0-.833.083-1.166-.417-1.666 2.334-.25 4.584-1.167 4.584-5a3.833 3.833 0 0 0-1.084-2.667 3.5 3.5 0 0 0-.083-2.667s-.917-.25-2.917 1.084a10.25 10.25 0 0 0-5.166 0C5.417 2.333 4.5 2.583 4.5 2.583a3.5 3.5 0 0 0-.083 2.667 3.833 3.833 0 0 0-1.084 2.667c0 3.833 2.25 4.75 4.584 5-.5.5-.5 1-.417 1.666V17.5", strokeWidth: "1.25" }), G2);
var _x = R2(jsxs("g", { strokeWidth: "1.25", children: [jsx("path", { d: "M7.5 10.833a.833.833 0 1 0 0-1.666.833.833 0 0 0 0 1.666ZM12.5 10.833a.833.833 0 1 0 0-1.666.833.833 0 0 0 0 1.666ZM6.25 6.25c2.917-.833 4.583-.833 7.5 0M5.833 13.75c2.917.833 5.417.833 8.334 0" }), jsx("path", { d: "M12.917 14.167c0 .833 1.25 2.5 1.666 2.5 1.25 0 2.361-1.39 2.917-2.5.556-1.39.417-4.861-1.25-9.584-1.214-.846-2.5-1.116-3.75-1.25l-.833 2.084M7.083 14.167c0 .833-1.13 2.5-1.526 2.5-1.191 0-2.249-1.39-2.778-2.5-.529-1.39-.397-4.861 1.19-9.584 1.157-.846 2.318-1.116 3.531-1.25l.833 2.084" })] }), G2);
var Ox = R2(jsxs("g", { strokeWidth: "1.25", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M4 4l11.733 16h4.267l-11.733 -16z" }), jsx("path", { d: "M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" })] }), F);
var Ax = R2(jsx("polyline", { fill: "none", stroke: "currentColor", points: "20 6 9 17 4 12" }), { width: 24, height: 24 });
var Kx = R2(jsxs("g", { strokeWidth: "1.25", children: [jsx("path", { d: "M8.333 11.667a2.917 2.917 0 0 0 4.167 0l3.333-3.334a2.946 2.946 0 1 0-4.166-4.166l-.417.416" }), jsx("path", { d: "M11.667 8.333a2.917 2.917 0 0 0-4.167 0l-3.333 3.334a2.946 2.946 0 0 0 4.166 4.166l.417-.416" })] }), G2);
var Hx = R2("M433.941 129.941l-83.882-83.882A48 48 0 0 0 316.118 32H48C21.49 32 0 53.49 0 80v352c0 26.51 21.49 48 48 48h352c26.51 0 48-21.49 48-48V163.882a48 48 0 0 0-14.059-33.941zM224 416c-35.346 0-64-28.654-64-64 0-35.346 28.654-64 64-64s64 28.654 64 64c0 35.346-28.654 64-64 64zm96-304.52V212c0 6.627-5.373 12-12 12H76c-6.627 0-12-5.373-12-12V108c0-6.627 5.373-12 12-12h228.52c3.183 0 6.235 1.264 8.485 3.515l3.48 3.48A11.996 11.996 0 0 1 320 111.48z", { width: 448, height: 512 });
var Jx = R2("M252 54L203 8a28 27 0 00-20-8H28C12 0 0 12 0 27v195c0 15 12 26 28 26h204c15 0 28-11 28-26V73a28 27 0 00-8-19zM130 213c-21 0-37-16-37-36 0-19 16-35 37-35 20 0 37 16 37 35 0 20-17 36-37 36zm56-169v56c0 4-4 6-7 6H44c-4 0-7-2-7-6V42c0-4 3-7 7-7h133l4 2 3 2a7 7 0 012 5z M296 201l87 95-188 205-78 9c-10 1-19-8-18-20l9-84zm141-14l-41-44a31 31 0 00-46 0l-38 41 87 95 38-42c13-14 13-36 0-50z", { width: 448, height: 512 });
var Yx = R2(jsx("path", { d: "m9.257 6.351.183.183H15.819c.34 0 .727.182 1.051.506.323.323.505.708.505 1.05v5.819c0 .316-.183.7-.52 1.035-.337.338-.723.522-1.037.522H4.182c-.352 0-.74-.181-1.058-.5-.318-.318-.499-.705-.499-1.057V5.182c0-.351.181-.736.5-1.054.32-.321.71-.503 1.057-.503H6.53l2.726 2.726Z", strokeWidth: "1.25" }), G2);
var Cx = R2("M384 112v352c0 26.51-21.49 48-48 48H48c-26.51 0-48-21.49-48-48V112c0-26.51 21.49-48 48-48h80c0-35.29 28.71-64 64-64s64 28.71 64 64h80c26.51 0 48 21.49 48 48zM192 40c-13.255 0-24 10.745-24 24s10.745 24 24 24 24-10.745 24-24-10.745-24-24-24m96 114v-20a6 6 0 0 0-6-6H102a6 6 0 0 0-6 6v20a6 6 0 0 0 6 6h180a6 6 0 0 0 6-6z", { width: 384, height: 512 });
var Vx = R2("M204.3 5C104.9 24.4 24.8 104.3 5.2 203.4c-37 187 131.7 326.4 258.8 306.7 41.2-6.4 61.4-54.6 42.5-91.7-23.1-45.4 9.9-98.4 60.9-98.4h79.7c35.8 0 64.8-29.6 64.9-65.3C511.5 97.1 368.1-26.9 204.3 5zM96 320c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32zm32-128c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32zm128-64c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32zm128 64c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32z");
var qx = R2(jsxs("g", { strokeWidth: 1.25, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M5 16l1.465 1.638a2 2 0 1 1 -3.015 .099l1.55 -1.737z" }), jsx("path", { d: "M13.737 9.737c2.299 -2.3 3.23 -5.095 2.081 -6.245c-1.15 -1.15 -3.945 -.217 -6.244 2.082c-2.3 2.299 -3.231 5.095 -2.082 6.244c1.15 1.15 3.946 .218 6.245 -2.081z" }), jsx("path", { d: "M7.492 11.818c.362 .362 .768 .676 1.208 .934l6.895 4.047c1.078 .557 2.255 -.075 3.692 -1.512c1.437 -1.437 2.07 -2.614 1.512 -3.692c-.372 -.718 -1.72 -3.017 -4.047 -6.895a6.015 6.015 0 0 0 -.934 -1.208" })] }), F);
var Xx = R2(jsxs("g", { strokeWidth: "1.25", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M15 8h.01" }), jsx("path", { d: "M12 20h-5a3 3 0 0 1 -3 -3v-10a3 3 0 0 1 3 -3h10a3 3 0 0 1 3 3v5" }), jsx("path", { d: "M4 15l4 -4c.928 -.893 2.072 -.893 3 0l4 4" }), jsx("path", { d: "M14 14l1 -1c.617 -.593 1.328 -.793 2.009 -.598" }), jsx("path", { d: "M19 16v6" }), jsx("path", { d: "M22 19l-3 3l-3 -3" })] }), F);
var Gx = R2("M216 0h80c13.3 0 24 10.7 24 24v168h87.7c17.8 0 26.7 21.5 14.1 34.1L269.7 378.3c-7.5 7.5-19.8 7.5-27.3 0L90.1 226.1c-12.6-12.6-3.7-34.1 14.1-34.1H192V24c0-13.3 10.7-24 24-24zm296 376v112c0 13.3-10.7 24-24 24H24c-13.3 0-24-10.7-24-24V376c0-13.3 10.7-24 24-24h146.7l49 49c20.1 20.1 52.5 20.1 72.6 0l49-49H488c13.3 0 24 10.7 24 24zm-124 88c0-11-9-20-20-20s-20 9-20 20 9 20 20 20 20-9 20-20zm64 0c0-11-9-20-20-20s-20 9-20 20 9 20 20 20 20-9 20-20z", { width: 512, height: 512 });
var kx = R2("M416 208H272V64c0-17.67-14.33-32-32-32h-32c-17.67 0-32 14.33-32 32v144H32c-17.67 0-32 14.33-32 32v32c0 17.67 14.33 32 32 32h144v144c0 17.67 14.33 32 32 32h32c17.67 0 32-14.33 32-32V304h144c17.67 0 32-14.33 32-32v-32c0-17.67-14.33-32-32-32z", { width: 448, height: 512 });
var Zx = R2("M416 208H32c-17.67 0-32 14.33-32 32v32c0 17.67 14.33 32 32 32h384c17.67 0 32-14.33 32-32v-32c0-17.67-14.33-32-32-32z", { width: 448, height: 512 });
var Wx = R2("M173.898 439.404l-166.4-166.4c-9.997-9.997-9.997-26.206 0-36.204l36.203-36.204c9.997-9.998 26.207-9.998 36.204 0L192 312.69 432.095 72.596c9.997-9.997 26.207-9.997 36.204 0l36.203 36.204c9.997 9.997 9.997 26.206 0 36.204l-294.4 294.401c-9.998 9.997-26.207 9.997-36.204-.001z");
var zx = R2("M16 132h416c8.837 0 16-7.163 16-16V76c0-8.837-7.163-16-16-16H16C7.163 60 0 67.163 0 76v40c0 8.837 7.163 16 16 16zm0 160h416c8.837 0 16-7.163 16-16v-40c0-8.837-7.163-16-16-16H16c-8.837 0-16 7.163-16 16v40c0 8.837 7.163 16 16 16zm0 160h416c8.837 0 16-7.163 16-16v-40c0-8.837-7.163-16-16-16H16c-8.837 0-16 7.163-16 16v40c0 8.837 7.163 16 16 16z");
var Qx = R2(jsx("path", { d: "M7.5 10.833 4.167 7.5 7.5 4.167M4.167 7.5h9.166a3.333 3.333 0 0 1 0 6.667H12.5", strokeWidth: "1.25" }), G2);
var jx = R2(jsx("path", { d: "M12.5 10.833 15.833 7.5 12.5 4.167M15.833 7.5H6.667a3.333 3.333 0 1 0 0 6.667H7.5", strokeWidth: "1.25" }), G2);
var eh = R2("M504 256c0 136.997-111.043 248-248 248S8 392.997 8 256C8 119.083 119.043 8 256 8s248 111.083 248 248zM262.655 90c-54.497 0-89.255 22.957-116.549 63.758-3.536 5.286-2.353 12.415 2.715 16.258l34.699 26.31c5.205 3.947 12.621 3.008 16.665-2.122 17.864-22.658 30.113-35.797 57.303-35.797 20.429 0 45.698 13.148 45.698 32.958 0 14.976-12.363 22.667-32.534 33.976C247.128 238.528 216 254.941 216 296v4c0 6.627 5.373 12 12 12h56c6.627 0 12-5.373 12-12v-1.333c0-28.462 83.186-29.647 83.186-106.667 0-58.002-60.165-102-116.531-102zM256 338c-25.365 0-46 20.635-46 46 0 25.364 20.635 46 46 46s46-20.636 46-46c0-25.365-20.635-46-46-46z", { mirror: true });
var th = R2(jsx("path", { d: "M5 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM15 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM15 17.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM7.25 8.917l5.5-2.834M7.25 11.083l5.5 2.834", strokeWidth: "1.5" }), G2);
var nh = R2("M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7 .2 40.1S486.3 480 472 480H40c-14.3 0-27.6-7.7-34.7-20.1s-7-27.8 .2-40.1l216-368C228.7 39.5 241.8 32 256 32zm0 128c-13.3 0-24 10.7-24 24V296c0 13.3 10.7 24 24 24s24-10.7 24-24V184c0-13.3-10.7-24-24-24zm32 224a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z");
var rh = R2("M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z", { width: 24, height: 24 });
var oh = R2(jsxs("g", { strokeWidth: 1.25, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M8 9h-1a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-8a2 2 0 0 0 -2 -2h-1" }), jsx("path", { d: "M12 14v-11" }), jsx("path", { d: "M9 6l3 -3l3 3" })] }), F);
var ih = R2(jsxs(Fragment, { children: [jsx("path", { fill: "currentColor", d: "M40 5.6v6.1l-4.1.7c-8.9 1.4-16.5 6.9-20.6 15C13 32 10.9 43 12.4 43c.4 0 2.4-1.3 4.4-3 5-3.9 12.1-7 18.2-7.7l5-.6v12.8l11.2-11.3L62.5 22 51.2 10.8 40-.5v6.1zm10.2 22.6L44 34.5v-6.8l-6.9.6c-3.9.3-9.8 1.7-13.2 3.1-3.5 1.4-6.5 2.4-6.7 2.2-.9-1 3-7.5 6.4-10.8C28 18.6 34.4 16 40.1 16c3.7 0 3.9-.1 3.9-3.2V9.5l6.2 6.3 6.3 6.2-6.3 6.2z" }), jsx("path", { stroke: "currentColor", fill: "currentColor", d: "M0 36v20h48v-6.2c0-6 0-6.1-2-4.3-1.1 1-2 2.9-2 4.2V52H4V34c0-17.3-.1-18-2-18s-2 .7-2 20z" })] }), { width: 64, height: 64 });
var ah = R2(jsx("path", { stroke: "currentColor", strokeWidth: "40", fill: "currentColor", d: "M148 560a318 318 0 0 0 522 110 316 316 0 0 0 0-450 316 316 0 0 0-450 0c-11 11-21 22-30 34v4h47c25 0 46 21 46 46s-21 45-46 45H90c-13 0-25-6-33-14-9-9-14-20-14-33V156c0-25 20-45 45-45s45 20 45 45v32l1 1a401 401 0 0 1 623 509l212 212a42 42 0 0 1-59 59L698 757A401 401 0 0 1 65 570a42 42 0 0 1 83-10z" }), { width: 1024 });
var Jd = jsxs("g", { strokeWidth: 1.5, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M12 10l0 10" }), jsx("path", { d: "M12 10l4 4" }), jsx("path", { d: "M12 10l-4 4" }), jsx("path", { d: "M4 4l16 0" })] });
var Yd = jsxs("g", { strokeWidth: 1.5, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M12 5l0 14" }), jsx("path", { d: "M16 9l-4 -4" }), jsx("path", { d: "M8 9l4 -4" })] });
var sh = R2(Yd, F);
var dh = R2(Yd, { ...F, style: { transform: "rotate(180deg)" } });
var ch = R2(Jd, F);
var lh = R2(Jd, { ...F, style: { transform: "rotate(180deg)" } });
var Uh = R2(jsxs(Fragment, { children: [jsxs("g", { clipPath: "url(#a)", stroke: "currentColor", strokeWidth: "1.25", children: [jsx("path", { d: "M3.333 3.333h13.334", strokeLinecap: "round", strokeLinejoin: "round" }), jsx("path", { d: "M13.542 6.458h-.417c-.92 0-1.667.747-1.667 1.667v7.083c0 .92.746 1.667 1.667 1.667h.417c.92 0 1.666-.746 1.666-1.667V8.125c0-.92-.746-1.667-1.666-1.667ZM6.875 6.458h-.417c-.92 0-1.666.747-1.666 1.667v3.75c0 .92.746 1.667 1.666 1.667h.417c.92 0 1.667-.746 1.667-1.667v-3.75c0-.92-.747-1.667-1.667-1.667Z" })] }), jsx("defs", { children: jsx("clipPath", { id: "a", children: jsx("path", { fill: "#fff", d: "M0 0h20v20H0z" }) }) })] }), G2);
var fh = R2(jsxs(Fragment, { children: [jsxs("g", { clipPath: "url(#a)", stroke: "currentColor", strokeWidth: "1.25", children: [jsx("path", { d: "M3.333 16.667h13.334", strokeLinecap: "round", strokeLinejoin: "round" }), jsx("path", { d: "M6.875 3.125h-.417c-.92 0-1.666.746-1.666 1.667v7.083c0 .92.746 1.667 1.666 1.667h.417c.92 0 1.667-.746 1.667-1.667V4.792c0-.92-.747-1.667-1.667-1.667ZM13.542 5.817h-.417c-.92 0-1.667.747-1.667 1.667v4.391c0 .92.746 1.667 1.667 1.667h.417c.92 0 1.666-.746 1.666-1.667V7.484c0-.92-.746-1.667-1.666-1.667Z" })] }), jsx("defs", { children: jsx("clipPath", { id: "a", children: jsx("path", { fill: "#fff", d: "M0 0h20v20H0z" }) }) })] }), G2);
var ph = R2(jsxs(Fragment, { children: [jsxs("g", { clipPath: "url(#a)", stroke: "currentColor", strokeWidth: "1.25", children: [jsx("path", { d: "M3.333 3.333v13.334", strokeLinecap: "round", strokeLinejoin: "round" }), jsx("path", { d: "M15.208 4.792H8.125c-.92 0-1.667.746-1.667 1.666v.417c0 .92.747 1.667 1.667 1.667h7.083c.92 0 1.667-.747 1.667-1.667v-.417c0-.92-.746-1.666-1.667-1.666ZM12.516 11.458H8.125c-.92 0-1.667.746-1.667 1.667v.417c0 .92.747 1.666 1.667 1.666h4.391c.92 0 1.667-.746 1.667-1.666v-.417c0-.92-.746-1.667-1.667-1.667Z" })] }), jsx("defs", { children: jsx("clipPath", { id: "a", children: jsx("path", { fill: "#fff", d: "M0 0h20v20H0z" }) }) })] }), G2);
var uh = R2(jsxs(Fragment, { children: [jsxs("g", { clipPath: "url(#a)", stroke: "currentColor", strokeWidth: "1.25", children: [jsx("path", { d: "M16.667 3.333v13.334", strokeLinecap: "round", strokeLinejoin: "round" }), jsx("path", { d: "M11.875 4.792H4.792c-.92 0-1.667.746-1.667 1.666v.417c0 .92.746 1.667 1.667 1.667h7.083c.92 0 1.667-.747 1.667-1.667v-.417c0-.92-.746-1.666-1.667-1.666ZM11.683 11.458H7.292c-.92 0-1.667.746-1.667 1.667v.417c0 .92.746 1.666 1.667 1.666h4.39c.921 0 1.667-.746 1.667-1.666v-.417c0-.92-.746-1.667-1.666-1.667Z" })] }), jsx("defs", { children: jsx("clipPath", { id: "a", children: jsx("path", { fill: "#fff", d: "M0 0h20v20H0z" }) }) })] }), G2);
var mh = R2(jsxs(Fragment, { children: [jsxs("g", { clipPath: "url(#a)", stroke: "currentColor", strokeWidth: "1.25", children: [jsx("path", { d: "M16.667 3.333v13.334M3.333 3.333v13.334", strokeLinecap: "round", strokeLinejoin: "round" }), jsx("path", { d: "M14.375 10.208v-.416c0-.92-.746-1.667-1.667-1.667H7.292c-.92 0-1.667.746-1.667 1.667v.416c0 .92.746 1.667 1.667 1.667h5.416c.92 0 1.667-.746 1.667-1.667Z" })] }), jsx("defs", { children: jsx("clipPath", { id: "a", children: jsx("path", { fill: "#fff", d: "M0 0h20v20H0z" }) }) })] }), G2);
var bh = R2(jsxs(Fragment, { children: [jsxs("g", { clipPath: "url(#a)", stroke: "currentColor", strokeWidth: "1.25", children: [jsx("path", { d: "M3.333 3.333h13.334M3.333 16.667h13.334", strokeLinecap: "round", strokeLinejoin: "round" }), jsx("path", { d: "M10.208 5.625h-.416c-.92 0-1.667.746-1.667 1.667v5.416c0 .92.746 1.667 1.667 1.667h.416c.92 0 1.667-.746 1.667-1.667V7.292c0-.92-.746-1.667-1.667-1.667Z" })] }), jsx("defs", { children: jsx("clipPath", { id: "a", children: jsx("path", { fill: "#fff", d: "M0 0h20v20H0z" }) }) })] }), G2);
var Eh = R2(jsxs("g", { stroke: "currentColor", strokeWidth: "1.25", children: [jsx("path", { d: "M1.667 10h2.916", strokeLinecap: "round", strokeLinejoin: "round" }), jsx("path", { d: "M8.333 10h3.334", strokeLinejoin: "round" }), jsx("path", { d: "M15.417 10h2.916", strokeLinecap: "round", strokeLinejoin: "round" }), jsx("path", { d: "M6.875 4.792h-.417c-.92 0-1.666.746-1.666 1.666v7.084c0 .92.746 1.666 1.666 1.666h.417c.92 0 1.667-.746 1.667-1.666V6.458c0-.92-.747-1.666-1.667-1.666ZM13.542 6.458h-.417c-.92 0-1.667.747-1.667 1.667v3.75c0 .92.746 1.667 1.667 1.667h.417c.92 0 1.666-.746 1.666-1.667v-3.75c0-.92-.746-1.667-1.666-1.667Z" })] }), G2);
var gh = R2(jsxs("g", { stroke: "currentColor", strokeWidth: "1.25", children: [jsx("path", { d: "M10 18.333v-2.916", strokeLinecap: "round", strokeLinejoin: "round" }), jsx("path", { d: "M10 11.667V8.333", strokeLinejoin: "round" }), jsx("path", { d: "M10 4.583V1.667", strokeLinecap: "round", strokeLinejoin: "round" }), jsx("path", { d: "M4.792 13.125v.417c0 .92.746 1.666 1.666 1.666h7.084c.92 0 1.666-.746 1.666-1.666v-.417c0-.92-.746-1.667-1.666-1.667H6.458c-.92 0-1.666.746-1.666 1.667ZM6.458 6.458v.417c0 .92.747 1.667 1.667 1.667h3.75c.92 0 1.667-.747 1.667-1.667v-.417c0-.92-.746-1.666-1.667-1.666h-3.75c-.92 0-1.667.746-1.667 1.666Z" })] }), G2);
var xh = R2(jsxs("g", { strokeWidth: "1.5", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("circle", { cx: "9", cy: "7", r: "4" }), jsx("path", { d: "M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" }), jsx("path", { d: "M16 3.13a4 4 0 0 1 0 7.75" }), jsx("path", { d: "M21 21v-2a4 4 0 0 0 -3 -3.85" })] }), F);
var hh = R2("M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8zm115.7 272l-176 101c-15.8 8.8-35.7-2.5-35.7-21V152c0-18.4 19.8-29.8 35.7-21l176 107c16.4 9.2 16.4 32.9 0 42z");
var yh = R2("M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8zm96 328c0 8.8-7.2 16-16 16H176c-8.8 0-16-7.2-16-16V176c0-8.8 7.2-16 16-16h160c8.8 0 16 7.2 16 16v160z");
var Ih = R2(jsxs(Fragment, { children: [jsx("g", { clipPath: "url(#a)", stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round", strokeLinejoin: "round", children: jsx("path", { d: "M15 5 5 15M5 5l10 10" }) }), jsx("defs", { children: jsx("clipPath", { id: "a", children: jsx("path", { fill: "#fff", d: "M0 0h20v20H0z" }) }) })] }), G2);
var wh = R2("M464 0c26.51 0 48 21.49 48 48v288c0 26.51-21.49 48-48 48H176c-26.51 0-48-21.49-48-48V48c0-26.51 21.49-48 48-48h288M176 416c-44.112 0-80-35.888-80-80V128H48c-26.51 0-48 21.49-48 48v288c0 26.51 21.49 48 48 48h288c26.51 0 48-21.49 48-48v-48H176z", { mirror: true });
var Rh = R2("M11.553 22.894a.998.998 0 00.894 0s3.037-1.516 5.465-4.097C19.616 16.987 21 14.663 21 12V5a1 1 0 00-.649-.936l-8-3a.998.998 0 00-.702 0l-8 3A1 1 0 003 5v7c0 2.663 1.384 4.987 3.088 6.797 2.428 2.581 5.465 4.097 5.465 4.097zm-1.303-8.481l6.644-6.644a.856.856 0 111.212 1.212l-7.25 7.25a.856.856 0 01-1.212 0l-3.75-3.75a.856.856 0 111.212-1.212l3.144 3.144z", { width: 24 });
var Th = R2("M369.9 97.9L286 14C277 5 264.8-.1 252.1-.1H48C21.5 0 0 21.5 0 48v416c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48V131.9c0-12.7-5.1-25-14.1-34zM332.1 128H256V51.9l76.1 76.1zM48 464V48h160v104c0 13.3 10.7 24 24 24h104v288H48zm32-48h224V288l-23.5-23.5c-4.7-4.7-12.3-4.7-17 0L176 352l-39.5-39.5c-4.7-4.7-12.3-4.7-17 0L80 352v64zm48-240c-26.5 0-48 21.5-48 48s21.5 48 48 48 48-21.5 48-48-21.5-48-48-48z", { width: 384, height: 512 });
var Mh = neon_pilot_shared_react_default.memo(({ theme: e8 }) => R2(jsxs(Fragment, { children: [jsx("path", { d: "M25 26H111V111H25", fill: yt(e8) }), jsx("path", { d: "M25 111C25 80.2068 25 49.4135 25 26M25 26C48.6174 26 72.2348 26 111 26H25ZM25 26C53.3671 26 81.7343 26 111 26H25ZM111 26C111 52.303 111 78.606 111 111V26ZM111 26C111 51.2947 111 76.5893 111 111V26ZM111 111C87.0792 111 63.1585 111 25 111H111ZM111 111C87.4646 111 63.9293 111 25 111H111ZM25 111C25 81.1514 25 51.3028 25 26V111Z", stroke: yt(e8), strokeWidth: "2" }), jsx("path", { d: "M100 100H160V160H100", fill: yt(e8) }), jsx("path", { d: "M100 160C100 144.106 100 128.211 100 100M100 100C117.706 100 135.412 100 160 100H100ZM100 100C114.214 100 128.428 100 160 100H100ZM160 100C160 120.184 160 140.369 160 160V100ZM160 100C160 113.219 160 126.437 160 160V100ZM160 160C145.534 160 131.068 160 100 160H160ZM160 160C143.467 160 126.934 160 100 160H160ZM100 160C100 143.661 100 127.321 100 100V160Z", stroke: yt(e8), strokeWidth: "2" }), jsxs("g", { fill: $d(e8), stroke: yt(e8), strokeWidth: "6", children: [jsx("rect", { x: "2.5", y: "2.5", width: "30", height: "30" }), jsx("rect", { x: "2.5", y: "149.5", width: "30", height: "30" }), jsx("rect", { x: "147.5", y: "149.5", width: "30", height: "30" }), jsx("rect", { x: "147.5", y: "2.5", width: "30", height: "30" })] })] }), { width: 182, height: 182, mirror: true }));
var Lh = neon_pilot_shared_react_default.memo(({ theme: e8 }) => R2(jsxs(Fragment, { children: [jsx("path", { d: "M25 26H111V111H25", fill: yt(e8) }), jsx("path", { d: "M25 111C25 80.2068 25 49.4135 25 26M25 26C48.6174 26 72.2348 26 111 26H25ZM25 26C53.3671 26 81.7343 26 111 26H25ZM111 26C111 52.303 111 78.606 111 111V26ZM111 26C111 51.2947 111 76.5893 111 111V26ZM111 111C87.0792 111 63.1585 111 25 111H111ZM111 111C87.4646 111 63.9293 111 25 111H111ZM25 111C25 81.1514 25 51.3028 25 26V111Z", stroke: yt(e8), strokeWidth: "2" }), jsx("path", { d: "M100 100H160V160H100", fill: yt(e8) }), jsx("path", { d: "M100 160C100 144.106 100 128.211 100 100M100 100C117.706 100 135.412 100 160 100H100ZM100 100C114.214 100 128.428 100 160 100H100ZM160 100C160 120.184 160 140.369 160 160V100ZM160 100C160 113.219 160 126.437 160 160V100ZM160 160C145.534 160 131.068 160 100 160H160ZM160 160C143.467 160 126.934 160 100 160H160ZM100 160C100 143.661 100 127.321 100 100V160Z", stroke: yt(e8), strokeWidth: "2" }), jsxs("g", { fill: $d(e8), stroke: yt(e8), strokeWidth: "6", children: [jsx("rect", { x: "2.5", y: "2.5", width: "30", height: "30" }), jsx("rect", { x: "78.5", y: "149.5", width: "30", height: "30" }), jsx("rect", { x: "147.5", y: "149.5", width: "30", height: "30" }), jsx("rect", { x: "147.5", y: "78.5", width: "30", height: "30" }), jsx("rect", { x: "105.5", y: "2.5", width: "30", height: "30" }), jsx("rect", { x: "2.5", y: "102.5", width: "30", height: "30" })] })] }), { width: 182, height: 182, mirror: true }));
var Dh = R2(jsx("g", { strokeWidth: 1.25, children: jsx("path", { d: "M5.879 2.625h8.242a3.27 3.27 0 0 1 3.254 3.254v8.242a3.27 3.27 0 0 1-3.254 3.254H5.88a3.27 3.27 0 0 1-3.254-3.254V5.88A3.27 3.27 0 0 1 5.88 2.626l-.001-.001ZM4.518 16.118l7.608-12.83m.198 13.934 5.051-9.897M2.778 9.675l9.348-6.387m-7.608 12.83 12.857-8.793" }) }), G2);
var Sh = R2(jsxs(Fragment, { children: [jsx("path", { d: "M5.879 2.625h8.242a3.254 3.254 0 0 1 3.254 3.254v8.242a3.254 3.254 0 0 1-3.254 3.254H5.88a3.254 3.254 0 0 1-3.254-3.254V5.88a3.254 3.254 0 0 1 3.254-3.254Z", stroke: "currentColor", strokeWidth: "1.25" }), jsx("mask", { id: "FillHachureIcon", style: { maskType: "alpha" }, maskUnits: "userSpaceOnUse", x: 2, y: 2, width: 16, height: 16, children: jsx("path", { d: "M5.879 2.625h8.242a3.254 3.254 0 0 1 3.254 3.254v8.242a3.254 3.254 0 0 1-3.254 3.254H5.88a3.254 3.254 0 0 1-3.254-3.254V5.88a3.254 3.254 0 0 1 3.254-3.254Z", fill: "currentColor", stroke: "currentColor", strokeWidth: "1.25" }) }), jsx("g", { mask: "url(#FillHachureIcon)", children: jsx("path", { d: "M2.258 15.156 15.156 2.258M7.324 20.222 20.222 7.325m-20.444 5.35L12.675-.222m-8.157 18.34L17.416 5.22", stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round", strokeLinejoin: "round" }) })] }), G2);
var vh = R2(jsxs(Fragment, { children: [jsxs("g", { clipPath: "url(#a)", children: [jsx("path", { d: "M5.879 2.625h8.242a3.254 3.254 0 0 1 3.254 3.254v8.242a3.254 3.254 0 0 1-3.254 3.254H5.88a3.254 3.254 0 0 1-3.254-3.254V5.88a3.254 3.254 0 0 1 3.254-3.254Z", stroke: "currentColor", strokeWidth: "1.25" }), jsx("mask", { id: "FillCrossHatchIcon", style: { maskType: "alpha" }, maskUnits: "userSpaceOnUse", x: -1, y: -1, width: 22, height: 22, children: jsx("path", { d: "M2.426 15.044 15.044 2.426M7.383 20 20 7.383M0 12.617 12.617 0m-7.98 17.941L17.256 5.324m-2.211 12.25L2.426 4.956M20 12.617 7.383 0m5.234 20L0 7.383m17.941 7.98L5.324 2.745", stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round", strokeLinejoin: "round" }) }), jsx("g", { mask: "url(#FillCrossHatchIcon)", children: jsx("path", { d: "M14.121 2H5.88A3.879 3.879 0 0 0 2 5.879v8.242A3.879 3.879 0 0 0 5.879 18h8.242A3.879 3.879 0 0 0 18 14.121V5.88A3.879 3.879 0 0 0 14.121 2Z", fill: "currentColor" }) })] }), jsx("defs", { children: jsx("clipPath", { id: "a", children: jsx("path", { fill: "#fff", d: "M0 0h20v20H0z" }) }) })] }), G2);
var $h = R2(jsxs(Fragment, { children: [jsx("g", { clipPath: "url(#a)", children: jsx("path", { d: "M4.91 2.625h10.18a2.284 2.284 0 0 1 2.285 2.284v10.182a2.284 2.284 0 0 1-2.284 2.284H4.909a2.284 2.284 0 0 1-2.284-2.284V4.909a2.284 2.284 0 0 1 2.284-2.284Z", stroke: "currentColor", strokeWidth: "1.25" }) }), jsx("defs", { children: jsx("clipPath", { id: "a", children: jsx("path", { fill: "#fff", d: "M0 0h20v20H0z" }) }) })] }), { ...G2, fill: "currentColor" });
var Ph = R2(jsx(Fragment, { children: jsx("path", { d: "M4.167 10h11.666", stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round", strokeLinejoin: "round" }) }), G2);
var Nh = R2(jsx("path", { d: "M5 10h10", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" }), G2);
var Fh = R2(jsx("path", { d: "M5 10h10", stroke: "currentColor", strokeWidth: "3.75", strokeLinecap: "round", strokeLinejoin: "round" }), G2);
var Bh = neon_pilot_shared_react_default.memo(({ theme: e8 }) => R2(jsx("path", { d: "M6 10H34", stroke: yt(e8), strokeWidth: 2, fill: "none", strokeLinecap: "round" }), { width: 40, height: 20 }));
var _h = R2(jsxs("g", { strokeWidth: "2", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M5 12h2" }), jsx("path", { d: "M17 12h2" }), jsx("path", { d: "M11 12h2" })] }), F);
var Oh = R2(jsxs("g", { strokeWidth: "2", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M4 12v.01" }), jsx("path", { d: "M8 12v.01" }), jsx("path", { d: "M12 12v.01" }), jsx("path", { d: "M16 12v.01" }), jsx("path", { d: "M20 12v.01" })] }), F);
var Ah = R2(jsx("path", { d: "M2.5 12.038c1.655-.885 5.9-3.292 8.568-4.354 2.668-1.063.101 2.821 1.32 3.104 1.218.283 5.112-1.814 5.112-1.814", strokeWidth: "1.25" }), G2);
var Kh = R2(jsx("path", { d: "M2.5 12.563c1.655-.886 5.9-3.293 8.568-4.355 2.668-1.062.101 2.822 1.32 3.105 1.218.283 5.112-1.814 5.112-1.814m-13.469 2.23c2.963-1.586 6.13-5.62 7.468-4.998 1.338.623-1.153 4.11-.132 5.595 1.02 1.487 6.133-1.43 6.133-1.43", strokeWidth: "1.25" }), G2);
var Hh = R2(jsx("path", { d: "M2.5 11.936c1.737-.879 8.627-5.346 10.42-5.268 1.795.078-.418 5.138.345 5.736.763.598 3.53-1.789 4.235-2.147M2.929 9.788c1.164-.519 5.47-3.28 6.987-3.114 1.519.165 1 3.827 2.121 4.109 1.122.281 3.839-2.016 4.606-2.42", strokeWidth: "1.25" }), G2);
var Jh = R2(jsxs("svg", { strokeWidth: "1.5", children: [jsx("path", { d: "M3.33334 9.99998V6.66665C3.33334 6.04326 3.33403 4.9332 3.33539 3.33646C4.95233 3.33436 6.06276 3.33331 6.66668 3.33331H10" }), jsx("path", { d: "M13.3333 3.33331V3.34331" }), jsx("path", { d: "M16.6667 3.33331V3.34331" }), jsx("path", { d: "M16.6667 6.66669V6.67669" }), jsx("path", { d: "M16.6667 10V10.01" }), jsx("path", { d: "M3.33334 13.3333V13.3433" }), jsx("path", { d: "M16.6667 13.3333V13.3433" }), jsx("path", { d: "M3.33334 16.6667V16.6767" }), jsx("path", { d: "M6.66666 16.6667V16.6767" }), jsx("path", { d: "M10 16.6667V16.6767" }), jsx("path", { d: "M13.3333 16.6667V16.6767" }), jsx("path", { d: "M16.6667 16.6667V16.6767" })] }), G2);
var Yh = R2(jsxs("g", { strokeWidth: "1.5", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M4 12v-4a4 4 0 0 1 4 -4h4" }), jsx("line", { x1: "16", y1: "4", x2: "16", y2: "4.01" }), jsx("line", { x1: "20", y1: "4", x2: "20", y2: "4.01" }), jsx("line", { x1: "20", y1: "8", x2: "20", y2: "8.01" }), jsx("line", { x1: "20", y1: "12", x2: "20", y2: "12.01" }), jsx("line", { x1: "4", y1: "16", x2: "4", y2: "16.01" }), jsx("line", { x1: "20", y1: "16", x2: "20", y2: "16.01" }), jsx("line", { x1: "4", y1: "20", x2: "4", y2: "20.01" }), jsx("line", { x1: "8", y1: "20", x2: "8", y2: "20.01" }), jsx("line", { x1: "12", y1: "20", x2: "12", y2: "20.01" }), jsx("line", { x1: "16", y1: "20", x2: "16", y2: "20.01" }), jsx("line", { x1: "20", y1: "20", x2: "20", y2: "20.01" })] }), F);
var Ch = R2(jsxs("g", { stroke: "currentColor", opacity: 0.3, strokeWidth: 2, children: [jsx("path", { d: "M12 12l9 0" }), jsx("path", { d: "M3 9l6 6" }), jsx("path", { d: "M3 15l6 -6" })] }), F);
var Vh = neon_pilot_shared_react_default.memo(({ flip: e8 = false }) => R2(jsxs("g", { transform: e8 ? "translate(40, 0) scale(-1, 1)" : "", stroke: "currentColor", strokeWidth: 2, fill: "none", children: [jsx("path", { d: "M34 10H6M34 10L27 5M34 10L27 15" }), jsx("path", { d: "M27.5 5L34.5 10L27.5 15" })] }), { width: 40, height: 20 }));
var qh = neon_pilot_shared_react_default.memo(({ flip: e8 = false }) => R2(jsxs("g", { stroke: "currentColor", fill: "currentColor", transform: e8 ? "translate(40, 0) scale(-1, 1)" : "", children: [jsx("path", { d: "M32 10L6 10", strokeWidth: 2 }), jsx("circle", { r: "4", transform: "matrix(-1 0 0 1 30 10)" })] }), { width: 40, height: 20 }));
var Xh = neon_pilot_shared_react_default.memo(({ flip: e8 = false }) => R2(jsxs("g", { stroke: "currentColor", fill: "none", transform: e8 ? "translate(40, 0) scale(-1, 1)" : "", strokeWidth: 2, children: [jsx("path", { d: "M26 10L6 10" }), jsx("circle", { r: "4", transform: "matrix(-1 0 0 1 30 10)" })] }), { width: 40, height: 20 }));
var Gh = neon_pilot_shared_react_default.memo(({ flip: e8 = false }) => R2(jsx("g", { transform: e8 ? "translate(40, 0) scale(-1, 1)" : "", children: jsx("path", { d: "M34 10H5.99996M34 10L34 5M34 10L34 15", stroke: "currentColor", strokeWidth: 2, fill: "none" }) }), { width: 40, height: 20 }));
var kh = neon_pilot_shared_react_default.memo(({ flip: e8 = false }) => R2(jsxs("g", { stroke: "currentColor", fill: "currentColor", transform: e8 ? "translate(40, 0) scale(-1, 1)" : "", children: [jsx("path", { d: "M32 10L6 10", strokeWidth: 2 }), jsx("path", { d: "M27.5 5.5L34.5 10L27.5 14.5L27.5 5.5" })] }), { width: 40, height: 20 }));
var Zh = neon_pilot_shared_react_default.memo(({ flip: e8 = false }) => R2(jsxs("g", { stroke: "currentColor", fill: "none", transform: e8 ? "translate(40, 0) scale(-1, 1)" : "", strokeWidth: 2, strokeLinejoin: "round", children: [jsx("path", { d: "M6,9.5H27" }), jsx("path", { d: "M27,5L34,10L27,14Z", fill: "none" })] }), { width: 40, height: 20 }));
var Wh = neon_pilot_shared_react_default.memo(({ flip: e8 = false }) => R2(jsxs("g", { stroke: "currentColor", fill: "currentColor", transform: e8 ? "translate(40, 0) scale(-1, 1)" : "", strokeLinejoin: "round", strokeWidth: 2, children: [jsx("path", { d: "M6,9.5H20" }), jsx("path", { d: "M27,5L34,10L27,14L20,9.5Z" })] }), { width: 40, height: 20 }));
var zh = neon_pilot_shared_react_default.memo(({ flip: e8 = false }) => R2(jsxs("g", { stroke: "currentColor", fill: "none", transform: e8 ? "translate(40, 0) scale(-1, 1)" : "", strokeLinejoin: "round", strokeWidth: 2, children: [jsx("path", { d: "M6,9.5H20" }), jsx("path", { d: "M27,5L34,10L27,14L20,9.5Z" })] }), { width: 40, height: 20 }));
var Qh = neon_pilot_shared_react_default.memo(({ flip: e8 = false }) => R2(jsx("g", { stroke: "currentColor", fill: "none", transform: e8 ? "" : "translate(40, 0) scale(-1, 1)", strokeLinejoin: "round", strokeWidth: 2, children: jsx("path", { d: "M34,10 H6 M15,10 L7,5 M15,10 L7,15" }) }), { width: 40, height: 20 }));
var jh = neon_pilot_shared_react_default.memo(({ flip: e8 = false }) => R2(jsx("g", { stroke: "currentColor", fill: "none", transform: e8 ? "" : "translate(40, 0) scale(-1, 1)", strokeLinejoin: "round", strokeWidth: 2, children: jsx("path", { d: "M34,10 H6 M15,10 L15,15 L15,5" }) }), { width: 40, height: 20 }));
var e4 = neon_pilot_shared_react_default.memo(({ flip: e8 = false }) => R2(jsx("g", { stroke: "currentColor", fill: "none", transform: e8 ? "" : "translate(40, 0) scale(-1, 1)", strokeLinejoin: "round", strokeWidth: 2, children: jsx("path", { d: "M34,10 H6 M15,10 L15,16 L15,4 M15,10 L7,5 M15,10 L7,15" }) }), { width: 40, height: 20 }));
var t4 = R2(jsxs(Fragment, { children: [jsx("g", { clipPath: "url(#a)", children: jsx("path", { d: "M14.167 6.667a3.333 3.333 0 0 0-3.334-3.334H9.167a3.333 3.333 0 0 0 0 6.667h1.666a3.333 3.333 0 0 1 0 6.667H9.167a3.333 3.333 0 0 1-3.334-3.334", stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round", strokeLinejoin: "round" }) }), jsx("defs", { children: jsx("clipPath", { id: "a", children: jsx("path", { fill: "#fff", d: "M0 0h20v20H0z" }) }) })] }), G2);
var n4 = R2(jsxs(Fragment, { children: [jsx("g", { clipPath: "url(#a)", children: jsx("path", { d: "M5 16.667V3.333L10 15l5-11.667v13.334", stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round", strokeLinejoin: "round" }) }), jsx("defs", { children: jsx("clipPath", { id: "a", children: jsx("path", { fill: "#fff", d: "M0 0h20v20H0z" }) }) })] }), G2);
var r4 = R2(jsxs(Fragment, { children: [jsx("g", { clipPath: "url(#a)", children: jsx("path", { d: "M5.833 3.333v13.334h8.334", stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round", strokeLinejoin: "round" }) }), jsx("defs", { children: jsx("clipPath", { id: "a", children: jsx("path", { fill: "#fff", d: "M0 0h20v20H0z" }) }) })] }), G2);
var o4 = R2(jsx(Fragment, { children: jsx("path", { d: "m1.667 3.333 6.666 13.334M8.333 3.333 1.667 16.667M11.667 3.333v13.334h6.666", stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round", strokeLinejoin: "round" }) }), G2);
var i4 = R2(jsxs("g", { strokeWidth: 1.25, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M3 7v-2h13v2" }), jsx("path", { d: "M10 5v14" }), jsx("path", { d: "M12 19h-4" }), jsx("path", { d: "M15 13v-1h6v1" }), jsx("path", { d: "M18 12v7" }), jsx("path", { d: "M17 19h2" })] }), F);
var Cd = R2(jsx(Fragment, { children: jsxs("g", { stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round", strokeLinejoin: "round", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M7 12h10" }), jsx("path", { d: "M7 5v14" }), jsx("path", { d: "M17 5v14" }), jsx("path", { d: "M15 19h4" }), jsx("path", { d: "M15 5h4" }), jsx("path", { d: "M5 19h4" }), jsx("path", { d: "M5 5h4" })] }) }), F);
var la = R2(jsx(Fragment, { children: jsx("g", { stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round", strokeLinejoin: "round", children: jsx("path", { d: "M5.833 16.667v-10a3.333 3.333 0 0 1 3.334-3.334h1.666a3.333 3.333 0 0 1 3.334 3.334v10M5.833 10.833h8.334" }) }) }), G2);
var Ua = R2(jsxs(Fragment, { children: [jsx("g", { clipPath: "url(#a)", stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round", strokeLinejoin: "round", children: jsx("path", { d: "M5.833 6.667 2.5 10l3.333 3.333M14.167 6.667 17.5 10l-3.333 3.333M11.667 3.333 8.333 16.667" }) }), jsx("defs", { children: jsx("clipPath", { id: "a", children: jsx("path", { fill: "#fff", d: "M0 0h20v20H0z" }) }) })] }), G2);
var a4 = R2(jsxs("g", { stroke: "currentColor", fill: "none", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("line", { x1: "4", y1: "8", x2: "20", y2: "8" }), jsx("line", { x1: "4", y1: "12", x2: "12", y2: "12" }), jsx("line", { x1: "4", y1: "16", x2: "16", y2: "16" })] }), F);
var s4 = R2(jsxs("g", { stroke: "currentColor", fill: "none", strokeLinecap: "round", strokeLinejoin: "round", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("line", { x1: "4", y1: "8", x2: "20", y2: "8" }), jsx("line", { x1: "8", y1: "12", x2: "16", y2: "12" }), jsx("line", { x1: "6", y1: "16", x2: "18", y2: "16" })] }), F);
var d4 = R2(jsxs("g", { stroke: "currentColor", fill: "none", strokeLinecap: "round", strokeLinejoin: "round", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("line", { x1: "4", y1: "8", x2: "20", y2: "8" }), jsx("line", { x1: "10", y1: "12", x2: "20", y2: "12" }), jsx("line", { x1: "8", y1: "16", x2: "20", y2: "16" })] }), F);
var c4 = neon_pilot_shared_react_default.memo(({ theme: e8 }) => R2(jsxs("g", { strokeWidth: "1.5", stroke: "currentColor", fill: "none", strokeLinecap: "round", strokeLinejoin: "round", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("line", { x1: "4", y1: "4", x2: "20", y2: "4" }), jsx("rect", { x: "9", y: "8", width: "6", height: "12", rx: "2" })] }), F));
var l4 = neon_pilot_shared_react_default.memo(({ theme: e8 }) => R2(jsxs("g", { strokeWidth: "2", stroke: "currentColor", fill: "none", strokeLinecap: "round", strokeLinejoin: "round", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("line", { x1: "4", y1: "20", x2: "20", y2: "20" }), jsx("rect", { x: "9", y: "4", width: "6", height: "12", rx: "2" })] }), F));
var U4 = neon_pilot_shared_react_default.memo(({ theme: e8 }) => R2(jsxs("g", { strokeWidth: "1.5", stroke: "currentColor", fill: "none", strokeLinecap: "round", strokeLinejoin: "round", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("line", { x1: "4", y1: "12", x2: "9", y2: "12" }), jsx("line", { x1: "15", y1: "12", x2: "20", y2: "12" }), jsx("rect", { x: "9", y: "6", width: "6", height: "12", rx: "2" })] }), F));
var f4 = R2(jsxs("g", { children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M21 19h-18l9 -15" }), jsx("path", { d: "M20.615 15.171h.015" }), jsx("path", { d: "M19.515 11.771h.015" }), jsx("path", { d: "M17.715 8.671h.015" }), jsx("path", { d: "M15.415 5.971h.015" })] }), F);
var p4 = R2(jsx("path", { d: "M537.6 226.6c4.1-10.7 6.4-22.4 6.4-34.6 0-53-43-96-96-96-19.7 0-38.1 6-53.3 16.2C367 64.2 315.3 32 256 32c-88.4 0-160 71.6-160 160 0 2.7.1 5.4.2 8.1C40.2 219.8 0 273.2 0 336c0 79.5 64.5 144 144 144h368c70.7 0 128-57.3 128-128 0-61.9-44-113.6-102.4-125.4zM393.4 288H328v112c0 8.8-7.2 16-16 16h-48c-8.8 0-16-7.2-16-16V288h-65.4c-14.3 0-21.4-17.2-11.3-27.3l105.4-105.4c6.2-6.2 16.4-6.2 22.6 0l105.4 105.4c10.1 10.1 2.9 27.3-11.3 27.3z", fill: "currentColor" }), { width: 640, height: 512 });
var u4 = R2(jsx("path", { d: "M480 416C497.7 416 512 430.3 512 448C512 465.7 497.7 480 480 480H150.6C133.7 480 117.4 473.3 105.4 461.3L25.37 381.3C.3786 356.3 .3786 315.7 25.37 290.7L258.7 57.37C283.7 32.38 324.3 32.38 349.3 57.37L486.6 194.7C511.6 219.7 511.6 260.3 486.6 285.3L355.9 416H480zM265.4 416L332.7 348.7L195.3 211.3L70.63 336L150.6 416L265.4 416z" }));
var m4 = R2(jsxs("g", { strokeWidth: 1.25, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M8 13v-7.5a1.5 1.5 0 0 1 3 0v6.5" }), jsx("path", { d: "M11 5.5v-2a1.5 1.5 0 1 1 3 0v8.5" }), jsx("path", { d: "M14 5.5a1.5 1.5 0 0 1 3 0v6.5" }), jsx("path", { d: "M17 7.5a1.5 1.5 0 0 1 3 0v8.5a6 6 0 0 1 -6 6h-2h.208a6 6 0 0 1 -5.012 -2.7a69.74 69.74 0 0 1 -.196 -.3c-.312 -.479 -1.407 -2.388 -3.286 -5.728a1.5 1.5 0 0 1 .536 -2.022a1.867 1.867 0 0 1 2.28 .28l1.47 1.47" })] }), F);
var b4 = R2(jsxs(Fragment, { children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" }), jsx("path", { d: "M7 11l5 5l5 -5" }), jsx("path", { d: "M12 4l0 12" })] }), F);
var E4 = R2(jsxs(Fragment, { children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z" }), jsx("path", { d: "M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2" })] }), F);
var g4 = R2(jsxs("g", { strokeWidth: 1.25, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M7 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" }), jsx("path", { d: "M17 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" }), jsx("path", { d: "M9.15 14.85l8.85 -10.85" }), jsx("path", { d: "M6 4l8.85 10.85" })] }), F);
var x4 = R2(jsxs(Fragment, { children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" }), jsx("path", { d: "M12 17l0 .01" }), jsx("path", { d: "M12 13.5a1.5 1.5 0 0 1 1 -1.5a2.6 2.6 0 1 0 -3 -4" })] }), F);
var h4 = R2(jsxs(Fragment, { children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M7 4v16l13 -8z" })] }), F);
var y4 = R2(jsxs(Fragment, { children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M17 4h-10a3 3 0 0 0 -3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3 -3v-10a3 3 0 0 0 -3 -3z", strokeWidth: "0", fill: "currentColor" })] }), F);
var I4 = R2(jsxs(Fragment, { children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M5 12l5 5l10 -10" })] }), F);
var w4 = R2(jsxs(Fragment, { children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M10.24 3.957l-8.422 14.06a1.989 1.989 0 0 0 1.7 2.983h16.845a1.989 1.989 0 0 0 1.7 -2.983l-8.423 -14.06a1.989 1.989 0 0 0 -3.4 0z" }), jsx("path", { d: "M12 9v4" }), jsx("path", { d: "M12 17h.01" })] }), F);
var R4 = R2(jsxs("g", { strokeWidth: 1.25, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M11 7l6 6" }), jsx("path", { d: "M4 16l11.7 -11.7a1 1 0 0 1 1.4 0l2.6 2.6a1 1 0 0 1 0 1.4l-11.7 11.7h-4v-4z" })] }), F);
var T4 = R2(jsxs("g", { strokeWidth: 1.5, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M12 3l-4 7h8z" }), jsx("path", { d: "M17 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" }), jsx("path", { d: "M4 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" })] }), F);
var M4 = R2(jsxs("g", { strokeWidth: 1.5, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M4 7l16 0" }), jsx("path", { d: "M4 17l16 0" }), jsx("path", { d: "M7 4l0 16" }), jsx("path", { d: "M17 4l0 16" })] }), F);
var L4 = R2(jsx("path", { fill: "currentColor", d: "M407.48,111.18C335.587,108.103 269.573,152.338 245.08,220C220.587,152.338 154.573,108.103 82.68,111.18C80.285,168.229 107.577,222.632 154.74,254.82C178.908,271.419 193.35,298.951 193.27,328.27L193.27,379.13L296.9,379.13L296.9,328.27C296.816,298.953 311.255,271.42 335.42,254.82C382.596,222.644 409.892,168.233 407.48,111.18Z" }));
var D4 = R2(jsxs("g", { strokeWidth: "1.25", children: [jsx("path", { d: "M4.16602 10H15.8327" }), jsx("path", { d: "M12.5 13.3333L15.8333 10" }), jsx("path", { d: "M12.5 6.66666L15.8333 9.99999" })] }), G2);
var S4 = R2(jsxs("g", { fill: "none", stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round", strokeLinejoin: "round", transform: "rotate(90 10 10)", children: [jsx("path", { clipRule: "evenodd", d: "m9.644 13.69 7.774-7.773a2.357 2.357 0 0 0-3.334-3.334l-7.773 7.774L8 12l1.643 1.69Z" }), jsx("path", { d: "m13.25 3.417 3.333 3.333M10 10l2-2M5 15l3-3M2.156 17.894l1-1M5.453 19.029l-.144-1.407M2.377 11.887l.866 1.118M8.354 17.273l-1.194-.758M.953 14.652l1.408.13" })] }), 20);
var v4 = R2(jsxs("g", { stroke: "currentColor", fill: "none", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z" }), jsx("path", { d: "M6 21l15 -15l-3 -3l-15 15l3 3" }), jsx("path", { d: "M15 6l3 3" }), jsx("path", { d: "M9 3a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2" }), jsx("path", { d: "M19 13a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2" })] }), F);
var $4 = R2(jsxs("g", { strokeWidth: 1.25, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z" }), jsx("path", { d: "M6 21l15 -15l-3 -3l-15 15l3 3" }), jsx("path", { d: "M15 6l3 3" }), jsx("path", { d: "M9 3a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2" }), jsx("path", { d: "M19 13a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2" })] }), F);
var P4 = R2(jsxs("g", { stroke: "currentColor", fill: "none", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M11.217 19.384a3.501 3.501 0 0 0 6.783 -1.217v-5.167l-6 -3.35" }), jsx("path", { d: "M5.214 15.014a3.501 3.501 0 0 0 4.446 5.266l4.34 -2.534v-6.946" }), jsx("path", { d: "M6 7.63c-1.391 -.236 -2.787 .395 -3.534 1.689a3.474 3.474 0 0 0 1.271 4.745l4.263 2.514l6 -3.348" }), jsx("path", { d: "M12.783 4.616a3.501 3.501 0 0 0 -6.783 1.217v5.067l6 3.45" }), jsx("path", { d: "M18.786 8.986a3.501 3.501 0 0 0 -4.446 -5.266l-4.34 2.534v6.946" }), jsx("path", { d: "M18 16.302c1.391 .236 2.787 -.395 3.534 -1.689a3.474 3.474 0 0 0 -1.271 -4.745l-4.308 -2.514l-5.955 3.42" })] }), F);
var N4 = R2(jsxs("g", { stroke: "currentColor", fill: "none", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M4 8v-2a2 2 0 0 1 2 -2h2" }), jsx("path", { d: "M4 16v2a2 2 0 0 0 2 2h2" }), jsx("path", { d: "M16 4h2a2 2 0 0 1 2 2v2" }), jsx("path", { d: "M16 20h2a2 2 0 0 0 2 -2v-2" })] }), F);
var F4 = R2(jsxs("g", { stroke: "currentColor", fill: "none", strokeWidth: 1.5, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" }), jsx("path", { d: "M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" })] }), F);
var B4 = R2(jsxs("g", { stroke: "currentColor", fill: "none", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M10.585 10.587a2 2 0 0 0 2.829 2.828" }), jsx("path", { d: "M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87" }), jsx("path", { d: "M3 3l18 18" })] }), F);
var _4 = R2(jsxs("g", { stroke: "currentColor", fill: "none", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M15.5 13a3.5 3.5 0 0 0 -3.5 3.5v1a3.5 3.5 0 0 0 7 0v-1.8" }), jsx("path", { d: "M8.5 13a3.5 3.5 0 0 1 3.5 3.5v1a3.5 3.5 0 0 1 -7 0v-1.8" }), jsx("path", { d: "M17.5 16a3.5 3.5 0 0 0 0 -7h-.5" }), jsx("path", { d: "M19 9.3v-2.8a3.5 3.5 0 0 0 -7 0" }), jsx("path", { d: "M6.5 16a3.5 3.5 0 0 1 0 -7h.5" }), jsx("path", { d: "M5 9.3v-2.8a3.5 3.5 0 0 1 7 0v10" })] }), F);
var O4 = R2(jsxs("g", { strokeWidth: 1.25, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M15.5 13a3.5 3.5 0 0 0 -3.5 3.5v1a3.5 3.5 0 0 0 7 0v-1.8" }), jsx("path", { d: "M8.5 13a3.5 3.5 0 0 1 3.5 3.5v1a3.5 3.5 0 0 1 -7 0v-1.8" }), jsx("path", { d: "M17.5 16a3.5 3.5 0 0 0 0 -7h-.5" }), jsx("path", { d: "M19 9.3v-2.8a3.5 3.5 0 0 0 -7 0" }), jsx("path", { d: "M6.5 16a3.5 3.5 0 0 1 0 -7h.5" }), jsx("path", { d: "M5 9.3v-2.8a3.5 3.5 0 0 1 7 0v10" })] }), F);
var A4 = R2(jsxs("g", { strokeWidth: 1.5, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" }), jsx("path", { d: "M21 21l-6 -6" })] }), F);
var K4 = R2(jsxs("g", { strokeWidth: 1.5, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M20.984 12.53a9 9 0 1 0 -7.552 8.355" }), jsx("path", { d: "M12 7v5l3 3" }), jsx("path", { d: "M19 16l-2 3h4l-2 3" })] }), F);
var H4 = R2(jsxs("g", { strokeWidth: 1.5, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M9 2m0 3a3 3 0 0 1 3 -3h0a3 3 0 0 1 3 3v5a3 3 0 0 1 -3 3h0a3 3 0 0 1 -3 -3z" }), jsx("path", { d: "M5 10a7 7 0 0 0 14 0" }), jsx("path", { d: "M8 21l8 0" }), jsx("path", { d: "M12 17l0 4" })] }), F);
var J4 = R2(jsxs("g", { strokeWidth: 1.5, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M3 3l18 18" }), jsx("path", { d: "M9 5a3 3 0 0 1 6 0v5a3 3 0 0 1 -.13 .874m-2 2a3 3 0 0 1 -3.87 -2.872v-1" }), jsx("path", { d: "M5 10a7 7 0 0 0 10.846 5.85m2 -2a6.967 6.967 0 0 0 1.152 -3.85" }), jsx("path", { d: "M8 21l8 0" }), jsx("path", { d: "M12 17l0 4" })] }), F);
var Y4 = R2(jsxs("g", { strokeWidth: 1.25, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11" })] }), F);
var C4 = R2(jsxs("g", { children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M8 8m0 1a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1z" }), jsx("path", { d: "M12 20v.01" }), jsx("path", { d: "M16 20v.01" }), jsx("path", { d: "M8 20v.01" }), jsx("path", { d: "M4 20v.01" }), jsx("path", { d: "M4 16v.01" }), jsx("path", { d: "M4 12v.01" }), jsx("path", { d: "M4 8v.01" }), jsx("path", { d: "M4 4v.01" }), jsx("path", { d: "M8 4v.01" }), jsx("path", { d: "M12 4v.01" }), jsx("path", { d: "M16 4v.01" }), jsx("path", { d: "M20 4v.01" }), jsx("path", { d: "M20 8v.01" }), jsx("path", { d: "M20 12v.01" }), jsx("path", { d: "M20 16v.01" }), jsx("path", { d: "M20 20v.01" })] }), F);
var V4 = R2(jsxs("g", { strokeWidth: 1.25, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M5 3v18" }), jsx("path", { d: "M19 21v-18" }), jsx("path", { d: "M5 7h14" }), jsx("path", { d: "M5 15h14" }), jsx("path", { d: "M8 13v4" }), jsx("path", { d: "M11 13v4" }), jsx("path", { d: "M16 13v4" }), jsx("path", { d: "M14 5v4" }), jsx("path", { d: "M11 5v4" }), jsx("path", { d: "M8 5v4" }), jsx("path", { d: "M3 21h18" })] }), F);
var q4 = R2(jsxs("g", { strokeWidth: 1.25, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M3 12l18 0" }), jsx("path", { d: "M7 16l10 0l-10 5l0 -5" }), jsx("path", { d: "M7 8l10 0l-10 -5l0 5" })] }), F);
var X4 = R2(jsxs("g", { strokeWidth: 1.25, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M12 3l0 18" }), jsx("path", { d: "M16 7l0 10l5 0l-5 -10" }), jsx("path", { d: "M8 7l0 10l-5 0l5 -10" })] }), F);
var G4 = R2(jsxs("g", { strokeWidth: 1.25, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M5 3m0 2a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2z" }), jsx("path", { d: "M19 6h1a2 2 0 0 1 2 2a5 5 0 0 1 -5 5l-5 0v2" }), jsx("path", { d: "M10 15m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z" })] }), F);
var k4 = R2(jsxs("g", { strokeWidth: 1.25, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M15 15m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0" }), jsx("path", { d: "M22 22l-3 -3" }), jsx("path", { d: "M6 18h-1a2 2 0 0 1 -2 -2v-1" }), jsx("path", { d: "M3 11v-1" }), jsx("path", { d: "M3 6v-1a2 2 0 0 1 2 -2h1" }), jsx("path", { d: "M10 3h1" }), jsx("path", { d: "M15 3h1a2 2 0 0 1 2 2v1" })] }), F);
var Z4 = R2(jsxs("g", { strokeWidth: 1.25, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M14 3v4a1 1 0 0 0 1 1h4" }), jsx("path", { d: "M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4" }), jsx("path", { d: "M4 20.25c0 .414 .336 .75 .75 .75h1.25a1 1 0 0 0 1 -1v-1a1 1 0 0 0 -1 -1h-1a1 1 0 0 1 -1 -1v-1a1 1 0 0 1 1 -1h1.25a.75 .75 0 0 1 .75 .75" }), jsx("path", { d: "M10 15l2 6l2 -6" }), jsx("path", { d: "M20 15h-1a2 2 0 0 0 -2 2v2a2 2 0 0 0 2 2h1v-3" })] }), F);
var W4 = R2(jsxs("g", { strokeWidth: 1.25, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M14 3v4a1 1 0 0 0 1 1h4" }), jsx("path", { d: "M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4" }), jsx("path", { d: "M20 15h-1a2 2 0 0 0 -2 2v2a2 2 0 0 0 2 2h1v-3" }), jsx("path", { d: "M5 18h1.5a1.5 1.5 0 0 0 0 -3h-1.5v6" }), jsx("path", { d: "M11 21v-6l3 6v-6" })] }), F);
var z4 = R2(jsxs("g", { strokeWidth: 1.25, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M4 13v-8a2 2 0 0 1 2 -2h1a2 2 0 0 1 2 2v8a2 2 0 0 0 6 0v-8a2 2 0 0 1 2 -2h1a2 2 0 0 1 2 2v8a8 8 0 0 1 -16 0" }), jsx("path", { d: "M4 8l5 0" }), jsx("path", { d: "M15 8l4 0" })] }), F);
var Q4 = R2(jsxs("g", { strokeWidth: 1.25, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M3 14c.83 .642 2.077 1.017 3.5 1c1.423 .017 2.67 -.358 3.5 -1c.83 -.642 2.077 -1.017 3.5 -1c1.423 -.017 2.67 .358 3.5 1" }), jsx("path", { d: "M8 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2" }), jsx("path", { d: "M12 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2" }), jsx("path", { d: "M3 10h14v5a6 6 0 0 1 -6 6h-2a6 6 0 0 1 -6 -6v-5z" }), jsx("path", { d: "M16.746 16.726a3 3 0 1 0 .252 -5.555" })] }), F);
var j4 = R2(jsxs("g", { stroke: "currentColor", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M3 5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-16a1 1 0 0 1-1-1v-10zM7 20h10M9 16v4M15 16v4" })] }), { ...F, strokeWidth: 1.5 });
var ey = R2(jsxs("g", { strokeWidth: 1.5, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M15 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2" }), jsx("path", { d: "M21 12h-13l3 -3" }), jsx("path", { d: "M11 15l-3 -3" })] }), F);
var ty = R2(jsxs("g", { children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M2 8a4 4 0 0 1 4 -4h12a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-12a4 4 0 0 1 -4 -4v-8z" }), jsx("path", { d: "M10 9l5 3l-5 3z" })] }), F);
var ny = R2(jsxs("g", { strokeWidth: 1.5, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M3 6h18" }), jsx("path", { d: "M3 12h18" }), jsx("path", { d: "M3 18h18" }), jsx("path", { d: "M6 3v18" }), jsx("path", { d: "M12 3v18" }), jsx("path", { d: "M18 3v18" })] }), F);
var ry = R2(jsxs("g", { strokeWidth: 1.5, children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M17 3m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z" }), jsx("path", { d: "M3 17m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z" }), jsx("path", { d: "M17 5c-6.627 0 -12 5.373 -12 12" })] }), F);
var oy = R2(jsxs("g", { children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M6 18l12 -12" }), jsx("path", { d: "M18 10v-4h-4" })] }), F);
var iy = R2(jsxs("g", { children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M4,19L10,19C11.097,19 12,18.097 12,17L12,9C12,7.903 12.903,7 14,7L21,7" }), jsx("path", { d: "M18 4l3 3l-3 3" })] }), F);
var ay = R2(jsxs("g", { children: [jsx("path", { d: "M16,12L20,9L16,6" }), jsx("path", { d: "M6 20c0 -6.075 4.925 -11 11 -11h3" })] }), F);
var sy = R2(jsxs("g", { children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M6 9l6 6l6 -6" })] }), F);
var dy = R2(jsxs("g", { children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M6 15l6 -6l6 6" })] }), F);
var cy = R2(jsxs("g", { children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M6 15l6 -6l6 6" })] }), F);
var ly = R2(jsxs("g", { strokeWidth: "1.25", children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M8 5v10a1 1 0 0 0 1 1h10" }), jsx("path", { d: "M5 8h10a1 1 0 0 1 1 1v10" })] }), F);
var Uy = R2(jsxs("g", { children: [jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }), jsx("path", { d: "M5 5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" }), jsx("path", { d: "M19 5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" }), jsx("path", { d: "M5 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" }), jsx("path", { d: "M19 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" }), jsx("path", { d: "M5 7l0 10" }), jsx("path", { d: "M7 5l10 0" }), jsx("path", { d: "M7 19l10 0" }), jsx("path", { d: "M19 7l0 10" })] }), F);
var Fr = { [Ie.Excalifont]: { metrics: { unitsPerEm: 1e3, ascender: 886, descender: -374, lineHeight: 1.25 }, icon: Nr }, [Ie.Nunito]: { metrics: { unitsPerEm: 1e3, ascender: 1011, descender: -353, lineHeight: 1.35 }, icon: la }, [Ie["Lilita One"]]: { metrics: { unitsPerEm: 1e3, ascender: 923, descender: -220, lineHeight: 1.15 }, icon: Cd }, [Ie["Comic Shanns"]]: { metrics: { unitsPerEm: 1e3, ascender: 750, descender: -250, lineHeight: 1.25 }, icon: Ua }, [Ie.Virgil]: { metrics: { unitsPerEm: 1e3, ascender: 886, descender: -374, lineHeight: 1.25 }, icon: Nr, deprecated: true }, [Ie.Helvetica]: { metrics: { unitsPerEm: 2048, ascender: 1577, descender: -471, lineHeight: 1.15 }, icon: la, deprecated: true, local: true }, [Ie.Cascadia]: { metrics: { unitsPerEm: 2048, ascender: 1900, descender: -480, lineHeight: 1.2 }, icon: Ua, deprecated: true }, [Ie["Liberation Sans"]]: { metrics: { unitsPerEm: 2048, ascender: 1854, descender: -434, lineHeight: 1.15 }, serverSide: true }, [Un.Xiaolai]: { metrics: { unitsPerEm: 1e3, ascender: 880, descender: -144, lineHeight: 1.15 }, fallback: true }, [Un["Segoe UI Emoji"]]: { metrics: { unitsPerEm: 1e3, ascender: 886, descender: -374, lineHeight: 1.25 }, local: true, fallback: true } };
var tn = { LATIN: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD", LATIN_EXT: "U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF", CYRILIC_EXT: "U+0460-052F, U+1C80-1C88, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F", CYRILIC: "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116", VIETNAMESE: "U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB" };
var Wn = "local:";
var Yo = class extends Error {
  constructor(t3 = "Couldn't export canvas.", n3 = "CANVAS_ERROR") {
    super(), this.name = n3, this.message = t3;
  }
};
var Co = class extends DOMException {
  constructor(t3 = "Request Aborted") {
    super(t3, "AbortError");
  }
};
var nn = class extends Error {
  constructor(n3 = "Image Scene Data Error", r = "IMAGE_SCENE_DATA_ERROR") {
    super(n3);
    i(this, "code");
    this.name = "EncodingError", this.code = r;
  }
};
var Vo = class extends Error {
  constructor() {
    super(...arguments);
    i(this, "code", "ELEMENT_HAS_INVALID_INDEX");
  }
};
var zn = class extends Error {
  constructor(n3 = "Worker URL is not defined!", r = "WORKER_URL_NOT_DEFINED") {
    super(n3);
    i(this, "code");
    this.name = "WorkerUrlNotDefinedError", this.code = r;
  }
};
var Qn = class extends Error {
  constructor(n3 = "Worker has to be in a separate chunk!", r = "WORKER_IN_THE_MAIN_CHUNK") {
    super(n3);
    i(this, "code");
    this.name = "WorkerInTheMainChunkError", this.code = r;
  }
};
var Br = class extends Error {
  constructor(t3) {
    super(t3), this.name = "ExcalidrawError";
  }
};
var fa = class {
  constructor(t3) {
    i(this, "instance");
    i(this, "debounceTerminate");
    this.instance = new Worker(t3, { type: "module" });
  }
};
var qo = class e2 {
  constructor(t3, n3) {
    i(this, "idleWorkers", /* @__PURE__ */ new Set());
    i(this, "workerUrl");
    i(this, "workerTTL");
    this.workerUrl = t3, this.workerTTL = n3.ttl || 1e3;
  }
  static create(t3, n3 = {}) {
    if (!t3) throw new zn();
    if (!import.meta.url || t3.toString() === import.meta.url) throw new Qn();
    return new e2(t3, n3);
  }
  async postMessage(t3, n3) {
    let r, o3 = Array.from(this.idleWorkers).shift();
    return o3 ? (this.idleWorkers.delete(o3), r = o3) : r = await this.createWorker(), new Promise((i3, a3) => {
      r.instance.onmessage = this.onMessageHandler(r, i3), r.instance.onerror = this.onErrorHandler(r, a3), r.instance.postMessage(t3, n3), r.debounceTerminate(() => a3(new Error(`Active worker did not respond for ${this.workerTTL}ms!`)));
    });
  }
  async clear() {
    for (let t3 of this.idleWorkers) t3.debounceTerminate.cancel(), t3.instance.terminate();
    this.idleWorkers.clear();
  }
  async createWorker() {
    let t3 = new fa(this.workerUrl);
    return t3.debounceTerminate = $o((n3) => {
      t3.instance.terminate(), this.idleWorkers.has(t3) ? (this.idleWorkers.delete(t3), console.debug("Job finished! Idle worker has been released from the pool.")) : n3 ? n3() : console.error("Worker has been terminated!");
    }, this.workerTTL), t3;
  }
  onMessageHandler(t3, n3) {
    return (r) => {
      t3.debounceTerminate(), this.idleWorkers.add(t3), n3(r.data);
    };
  }
  onErrorHandler(t3, n3) {
    return (r) => {
      t3.debounceTerminate(() => n3(r)), t3.debounceTerminate.flush(), this.clear();
    };
  }
};
var Vd = typeof Worker < "u";
var qd = async (e8, t3) => {
  let { Commands: n3, subsetToBase64: r, toBase64: o3 } = await z6();
  return Vd ? mn(async () => {
    try {
      let i3 = await Q6(), a3 = e8.slice(0), s3 = await i3.postMessage({ command: n3.Subset, arrayBuffer: a3, codePoints: t3 }, { transfer: [a3] });
      return o3(s3);
    } catch (i3) {
      return Vd = false, bd() && (i3 instanceof zn || i3 instanceof Qn) || console.error("Failed to use workers for subsetting, falling back to the main thread.", i3), r(e8, t3);
    }
  }) : r(e8, t3);
};
var pa = null;
var ua = null;
var W6 = async () => (pa || (pa = import("./subset-worker.chunk-ZKDSW53Y.js")), pa);
var z6 = async () => (ua || (ua = import("./subset-shared.chunk-3S7XPLOY.js")), ua);
var ma = null;
var Q6 = () => (ma || (ma = mn(async () => {
  let { WorkerUrl: e8 } = await W6();
  return qo.create(e8);
})), ma);
var jn = class jn2 {
  constructor(t3, n3, r) {
    i(this, "urls");
    i(this, "fontFace");
    this.urls = jn2.createUrls(n3);
    let o3 = this.urls.map((i3) => `url(${i3}) ${jn2.getFormat(i3)}`).join(", ");
    this.fontFace = new FontFace(t3, o3, { display: "swap", style: "normal", weight: "400", ...r });
  }
  toCSS(t3) {
    if (!this.getUnicodeRangeRegex().test(t3)) return;
    let n3 = Array.from(t3).map((r) => r.codePointAt(0));
    return this.getContent(n3).then((r) => `@font-face { font-family: ${this.fontFace.family}; src: url(${r}); }`);
  }
  async getContent(t3) {
    let n3 = 0, r = [];
    for (; n3 < this.urls.length; ) {
      let o3 = this.urls[n3];
      try {
        let i3 = await this.fetchFont(o3);
        return await qd(i3, t3);
      } catch (i3) {
        r.push(`"${o3.toString()}" returned error "${i3}"`);
      }
      n3++;
    }
    return console.error(`Failed to fetch font family "${this.fontFace.family}"`, JSON.stringify(r, void 0, 2)), this.urls.length ? this.urls[this.urls.length - 1].toString() : "";
  }
  fetchFont(t3) {
    return mn(async () => {
      let n3 = await fetch(t3, { cache: "force-cache", headers: { Accept: "font/woff2" } });
      if (!n3.ok) {
        let o3 = t3 instanceof URL ? t3.toString() : "dataurl";
        throw new Error(`Failed to fetch "${o3}": ${n3.statusText}`);
      }
      return await n3.arrayBuffer();
    });
  }
  getUnicodeRangeRegex() {
    let t3 = this.fontFace.unicodeRange.split(/,\s*/).map((n3) => {
      let [r, o3] = n3.replace("U+", "").split("-");
      return o3 ? `\\u{${r}}-\\u{${o3}}` : `\\u{${r}}`;
    }).join("");
    return new RegExp(`[${t3}]`, "u");
  }
  static createUrls(t3) {
    if (t3.startsWith("data")) return [t3];
    if (t3.startsWith(Wn)) return [];
    if (t3.startsWith("http")) return [new URL(t3)];
    let n3 = t3.replace(/^\/+/, ""), r = [];
    if (typeof window.EXCALIDRAW_ASSET_PATH == "string") {
      let o3 = this.normalizeBaseUrl(window.EXCALIDRAW_ASSET_PATH);
      r.push(new URL(n3, o3));
    } else Array.isArray(window.EXCALIDRAW_ASSET_PATH) && window.EXCALIDRAW_ASSET_PATH.forEach((o3) => {
      let i3 = this.normalizeBaseUrl(o3);
      r.push(new URL(n3, i3));
    });
    return r.push(new URL(n3, jn2.ASSETS_FALLBACK_URL)), r;
  }
  static getFormat(t3) {
    if (!(t3 instanceof URL)) return "";
    try {
      let n3 = new URL(t3).pathname.split(".");
      return n3.length === 1 ? "" : `format('${n3.pop()}')`;
    } catch {
      return "";
    }
  }
  static normalizeBaseUrl(t3) {
    let n3 = t3;
    return /^\.?\//.test(n3) && (n3 = new URL(n3.replace(/^\.?\/+/, ""), window?.location?.origin).toString()), n3 = `${n3.replace(/\/+$/, "")}/`, n3;
  }
};
i(jn, "ASSETS_FALLBACK_URL", `https://esm.sh/${c.PKG_NAME ? `${c.PKG_NAME}@${c.PKG_VERSION}` : "@excalidraw/excalidraw"}/dist/prod/`);
var Xo = jn;
var Xd = "./fonts/Cascadia/CascadiaCode-Regular.woff2";
var Gd = [{ uri: Xd }];
var kd = "./fonts/ComicShanns/ComicShanns-Regular-279a7b317d12eb88de06167bd672b4b4.woff2";
var Zd = "./fonts/ComicShanns/ComicShanns-Regular-fcb0fc02dcbee4c9846b3e2508668039.woff2";
var Wd = "./fonts/ComicShanns/ComicShanns-Regular-dc6a8806fa96795d7b3be5026f989a17.woff2";
var zd = "./fonts/ComicShanns/ComicShanns-Regular-6e066e8de2ac57ea9283adb9c24d7f0c.woff2";
var Qd = [{ uri: kd, descriptors: { unicodeRange: "U+20-7e,U+a1-a6,U+a8,U+ab-ac,U+af-b1,U+b4,U+b8,U+bb-bc,U+bf-cf,U+d1-d7,U+d9-de,U+e0-ef,U+f1-f7,U+f9-ff,U+131,U+152-153,U+2c6,U+2da,U+2dc,U+2013-2014,U+2018-201a,U+201c-201d,U+2020-2022,U+2026,U+2039-203a,U+2044,U+20ac,U+2191,U+2193,U+2212" } }, { uri: Zd, descriptors: { unicodeRange: "U+100-10f,U+112-125,U+128-130,U+134-137,U+139-13c,U+141-148,U+14c-151,U+154-161,U+164-165,U+168-17f,U+1bf,U+1f7,U+218-21b,U+237,U+1e80-1e85,U+1ef2-1ef3,U+a75b" } }, { uri: Wd, descriptors: { unicodeRange: "U+2c7,U+2d8-2d9,U+2db,U+2dd,U+315,U+2190,U+2192,U+2200,U+2203-2204,U+2264-2265,U+f6c3" } }, { uri: zd, descriptors: { unicodeRange: "U+3bb" } }];
var jd = [{ uri: Wn }];
var ec = "./fonts/Excalifont/Excalifont-Regular-a88b72a24fb54c9f94e3b5fdaa7481c9.woff2";
var tc = "./fonts/Excalifont/Excalifont-Regular-be310b9bcd4f1a43f571c46df7809174.woff2";
var nc = "./fonts/Excalifont/Excalifont-Regular-b9dcf9d2e50a1eaf42fc664b50a3fd0d.woff2";
var rc = "./fonts/Excalifont/Excalifont-Regular-41b173a47b57366892116a575a43e2b6.woff2";
var oc = "./fonts/Excalifont/Excalifont-Regular-3f2c5db56cc93c5a6873b1361d730c16.woff2";
var ic = "./fonts/Excalifont/Excalifont-Regular-349fac6ca4700ffec595a7150a0d1e1d.woff2";
var ac = "./fonts/Excalifont/Excalifont-Regular-623ccf21b21ef6b3a0d87738f77eb071.woff2";
var sc = [{ uri: ec, descriptors: { unicodeRange: "U+20-7e,U+a0-a3,U+a5-a6,U+a8-ab,U+ad-b1,U+b4,U+b6-b8,U+ba-ff,U+131,U+152-153,U+2bc,U+2c6,U+2da,U+2dc,U+304,U+308,U+2013-2014,U+2018-201a,U+201c-201e,U+2020,U+2022,U+2024-2026,U+2030,U+2039-203a,U+20ac,U+2122,U+2212" } }, { uri: tc, descriptors: { unicodeRange: "U+100-130,U+132-137,U+139-149,U+14c-151,U+154-17e,U+192,U+1fc-1ff,U+218-21b,U+237,U+1e80-1e85,U+1ef2-1ef3,U+2113" } }, { uri: nc, descriptors: { unicodeRange: "U+400-45f,U+490-491,U+2116" } }, { uri: rc, descriptors: { unicodeRange: "U+37e,U+384-38a,U+38c,U+38e-393,U+395-3a1,U+3a3-3a8,U+3aa-3cf,U+3d7" } }, { uri: oc, descriptors: { unicodeRange: "U+2c7,U+2d8-2d9,U+2db,U+2dd,U+302,U+306-307,U+30a-30c,U+326-328,U+212e,U+2211,U+fb01-fb02" } }, { uri: ic, descriptors: { unicodeRange: "U+462-463,U+472-475,U+4d8-4d9,U+4e2-4e3,U+4e6-4e9,U+4ee-4ef" } }, { uri: ac, descriptors: { unicodeRange: "U+300-301,U+303" } }];
var dc = [{ uri: Wn }];
var cc = "./fonts/Liberation/LiberationSans-Regular.woff2";
var lc = [{ uri: cc }];
var Uc = "./fonts/Lilita/Lilita-Regular-i7dPIFZ9Zz-WBtRtedDbYEF8RXi4EwQ.woff2";
var fc = "./fonts/Lilita/Lilita-Regular-i7dPIFZ9Zz-WBtRtedDbYE98RXi4EwSsbg.woff2";
var pc = [{ uri: fc, descriptors: { unicodeRange: tn.LATIN_EXT } }, { uri: Uc, descriptors: { unicodeRange: tn.LATIN } }];
var uc = "./fonts/Nunito/Nunito-Regular-XRXI3I6Li01BKofiOc5wtlZ2di8HDIkhdTQ3j6zbXWjgeg.woff2";
var mc = "./fonts/Nunito/Nunito-Regular-XRXI3I6Li01BKofiOc5wtlZ2di8HDIkhdTo3j6zbXWjgevT5.woff2";
var bc = "./fonts/Nunito/Nunito-Regular-XRXI3I6Li01BKofiOc5wtlZ2di8HDIkhdTA3j6zbXWjgevT5.woff2";
var Ec = "./fonts/Nunito/Nunito-Regular-XRXI3I6Li01BKofiOc5wtlZ2di8HDIkhdTk3j6zbXWjgevT5.woff2";
var gc = "./fonts/Nunito/Nunito-Regular-XRXI3I6Li01BKofiOc5wtlZ2di8HDIkhdTs3j6zbXWjgevT5.woff2";
var xc = [{ uri: Ec, descriptors: { unicodeRange: tn.CYRILIC_EXT, weight: "500" } }, { uri: bc, descriptors: { unicodeRange: tn.CYRILIC, weight: "500" } }, { uri: gc, descriptors: { unicodeRange: tn.VIETNAMESE, weight: "500" } }, { uri: mc, descriptors: { unicodeRange: tn.LATIN_EXT, weight: "500" } }, { uri: uc, descriptors: { unicodeRange: tn.LATIN, weight: "500" } }];
var hc = "./fonts/Virgil/Virgil-Regular.woff2";
var yc = [{ uri: hc }];
var Ic = "./fonts/Xiaolai/Xiaolai-Regular-09850c4077f3fffe707905872e0e2460.woff2";
var wc = "./fonts/Xiaolai/Xiaolai-Regular-7eb9fffd1aa890d07d0f88cc82e6cfe4.woff2";
var Rc = "./fonts/Xiaolai/Xiaolai-Regular-60a3089806700d379f11827ee9843b6b.woff2";
var Tc = "./fonts/Xiaolai/Xiaolai-Regular-6fe5c5973cc06f74b2387a631ea36b88.woff2";
var Mc = "./fonts/Xiaolai/Xiaolai-Regular-b96d9226ce77ec94ceca043d712182e6.woff2";
var Lc = "./fonts/Xiaolai/Xiaolai-Regular-6ae5b42180ad70b971c91e7eefb8eba2.woff2";
var Dc = "./fonts/Xiaolai/Xiaolai-Regular-a4c34be6d42152e64b0df90bc4607f64.woff2";
var Sc = "./fonts/Xiaolai/Xiaolai-Regular-c69f61a4ab18d0488c8d1fc12e7028e8.woff2";
var vc = "./fonts/Xiaolai/Xiaolai-Regular-e3fcf5180fd466c8915c4e8069491054.woff2";
var $c = "./fonts/Xiaolai/Xiaolai-Regular-c1f94158256bb1f3bf665b053d895af9.woff2";
var Pc = "./fonts/Xiaolai/Xiaolai-Regular-544fc28abe2c5c30e62383fd4dac255f.woff2";
var Nc = "./fonts/Xiaolai/Xiaolai-Regular-7197d6fda6cba7c3874c53d6381ca239.woff2";
var Fc = "./fonts/Xiaolai/Xiaolai-Regular-70c2eb8d64e71a42a834eb857ea9df51.woff2";
var Bc = "./fonts/Xiaolai/Xiaolai-Regular-069e77aac84590e2e991d0a0176d34f2.woff2";
var _c = "./fonts/Xiaolai/Xiaolai-Regular-41521fade99856108931b4768b1b2648.woff2";
var Oc = "./fonts/Xiaolai/Xiaolai-Regular-a004ddfcb26e67bd6e678c8ed19e25ce.woff2";
var Ac = "./fonts/Xiaolai/Xiaolai-Regular-04b718e5623574919c8b0dea5f301444.woff2";
var Kc = "./fonts/Xiaolai/Xiaolai-Regular-7e4bde7e9c7f84cd34d8a845e384c746.woff2";
var Hc = "./fonts/Xiaolai/Xiaolai-Regular-23686f7f29da6e8008c36dd3a80c83d6.woff2";
var Jc = "./fonts/Xiaolai/Xiaolai-Regular-69c09cc5fa3e55c74fc4821f76909cc3.woff2";
var Yc = "./fonts/Xiaolai/Xiaolai-Regular-25b7f38e18f035f96cb5e547bd2bd08c.woff2";
var Cc = "./fonts/Xiaolai/Xiaolai-Regular-ba3de316d63c7e339987b16f41a0b879.woff2";
var Vc = "./fonts/Xiaolai/Xiaolai-Regular-12b52b58eb3df36804b9a654ec9ee194.woff2";
var qc = "./fonts/Xiaolai/Xiaolai-Regular-b1220a3c61f85cc0408deedb4c5f57a2.woff2";
var Xc = "./fonts/Xiaolai/Xiaolai-Regular-4535823663ad81405188a528d8f2b1a2.woff2";
var Gc = "./fonts/Xiaolai/Xiaolai-Regular-3eaa538115d76932653c21d8dc28f207.woff2";
var kc = "./fonts/Xiaolai/Xiaolai-Regular-7e929f262f30c8ee78bf398150b1a7cd.woff2";
var Zc = "./fonts/Xiaolai/Xiaolai-Regular-73e309718fd16cea44b4d54a33581811.woff2";
var Wc = "./fonts/Xiaolai/Xiaolai-Regular-9eb5a99df4e76ac3363453ac9ca288b1.woff2";
var zc = "./fonts/Xiaolai/Xiaolai-Regular-3e63ed8162808a9e425ed80a8bc79114.woff2";
var Qc = "./fonts/Xiaolai/Xiaolai-Regular-cb17fc3db95f6d139afc9d31a8e93293.woff2";
var jc = "./fonts/Xiaolai/Xiaolai-Regular-c8b71798409ccc126ee264a00aadcf21.woff2";
var el = "./fonts/Xiaolai/Xiaolai-Regular-11c345711937f0ba4b8f7b6b919c8440.woff2";
var tl = "./fonts/Xiaolai/Xiaolai-Regular-e480d9c614742d05f0e78f274f1e69e6.woff2";
var nl = "./fonts/Xiaolai/Xiaolai-Regular-95429962233afd82db1c27df1500a28c.woff2";
var rl = "./fonts/Xiaolai/Xiaolai-Regular-2cf96d082d35ea3d8106851223ad0d16.woff2";
var ol = "./fonts/Xiaolai/Xiaolai-Regular-2d43040e86ff03ba677f6f9c04cd0805.woff2";
var il = "./fonts/Xiaolai/Xiaolai-Regular-2a26d20a23b00898ce82f09d2ee47c3f.woff2";
var al = "./fonts/Xiaolai/Xiaolai-Regular-a365e82ed54697a52f27adcea1315fe8.woff2";
var sl = "./fonts/Xiaolai/Xiaolai-Regular-f5d079153c99a25b9be5b8583c4cc8a7.woff2";
var dl = "./fonts/Xiaolai/Xiaolai-Regular-10a7ae9a371830a80c3d844acf1c02d7.woff2";
var cl = "./fonts/Xiaolai/Xiaolai-Regular-e4bca6cfa53e499cae0a6be4894a90e9.woff2";
var ll = "./fonts/Xiaolai/Xiaolai-Regular-60a41c7e1c68f22424e6d22df544bc82.woff2";
var Ul = "./fonts/Xiaolai/Xiaolai-Regular-7ab2bed91166a9dca83a5ebfbe2a7f38.woff2";
var fl = "./fonts/Xiaolai/Xiaolai-Regular-670ba603758d94268e8606f240a42e12.woff2";
var pl = "./fonts/Xiaolai/Xiaolai-Regular-e656f091b9dc4709722c9f4b84d3c797.woff2";
var ul = "./fonts/Xiaolai/Xiaolai-Regular-15dc6d811c9cd078f9086a740d5a1038.woff2";
var ml = "./fonts/Xiaolai/Xiaolai-Regular-f0f13b5c60e0af5553bd359f5513be1b.woff2";
var bl = "./fonts/Xiaolai/Xiaolai-Regular-8c2f33cee3993174f7e87c28e4bf42ee.woff2";
var El = "./fonts/Xiaolai/Xiaolai-Regular-761d05e3cd968cf574166867998ef06a.woff2";
var gl = "./fonts/Xiaolai/Xiaolai-Regular-642b26e2e5f5fb780b51b593dbc8c851.woff2";
var xl = "./fonts/Xiaolai/Xiaolai-Regular-5572b3513ba8df57a3d5d7303ee6b11b.woff2";
var hl = "./fonts/Xiaolai/Xiaolai-Regular-3c9de2ae0ea4bc91a510942dfa4be8d2.woff2";
var yl = "./fonts/Xiaolai/Xiaolai-Regular-671a2c20b1eb9e4ef8a192833940e319.woff2";
var Il = "./fonts/Xiaolai/Xiaolai-Regular-4dc6d5f188d5c96d44815cd1e81aa885.woff2";
var wl = "./fonts/Xiaolai/Xiaolai-Regular-ce4884f96f11589608b76b726a755803.woff2";
var Rl = "./fonts/Xiaolai/Xiaolai-Regular-8f476c4c99813d57cbe6eca4727388ad.woff2";
var Tl = "./fonts/Xiaolai/Xiaolai-Regular-5935a5775af3d5c6307ac667bd9ae74e.woff2";
var Ml = "./fonts/Xiaolai/Xiaolai-Regular-79f007c1c6d07557120982951ea67998.woff2";
var Ll = "./fonts/Xiaolai/Xiaolai-Regular-bafff7a14c27403dcc6cf1432e8ea836.woff2";
var Dl = "./fonts/Xiaolai/Xiaolai-Regular-543fa46ace099a7099dad69123399400.woff2";
var Sl = "./fonts/Xiaolai/Xiaolai-Regular-4ddc14ed3eb0c3e46364317dfc0144a3.woff2";
var vl = "./fonts/Xiaolai/Xiaolai-Regular-0fa55a080fcd0f9dc2e0b0058b793df8.woff2";
var $l = "./fonts/Xiaolai/Xiaolai-Regular-66493ba5a8367f2928812f446f47b56a.woff2";
var Pl = "./fonts/Xiaolai/Xiaolai-Regular-57862b464a55b18c7bf234ce22907d73.woff2";
var Nl = "./fonts/Xiaolai/Xiaolai-Regular-8d3bcabb847b56243b16afe62adaaf21.woff2";
var Fl = "./fonts/Xiaolai/Xiaolai-Regular-2b77e8ebfb2367ab2662396a60e7d320.woff2";
var Bl = "./fonts/Xiaolai/Xiaolai-Regular-0b5d723fdc4e249c140f0909e87d03b4.woff2";
var _l = "./fonts/Xiaolai/Xiaolai-Regular-cdbce89e82cc1ab53a2decbf5819278f.woff2";
var Ol = "./fonts/Xiaolai/Xiaolai-Regular-739bc1a567439c7cffcd1614644593d2.woff2";
var Al = "./fonts/Xiaolai/Xiaolai-Regular-72252d73220fa3cd856677888cee1635.woff2";
var Kl = "./fonts/Xiaolai/Xiaolai-Regular-08e0dc436ad0ad61ba5558db0674d762.woff2";
var Hl = "./fonts/Xiaolai/Xiaolai-Regular-cf6ff4e0f491ca0cf3038187a997b9b4.woff2";
var Jl = "./fonts/Xiaolai/Xiaolai-Regular-9cfb2a77a4e45025105ad29a1748b90d.woff2";
var Yl = "./fonts/Xiaolai/Xiaolai-Regular-450da755d5bcb70906e1295e559b9602.woff2";
var Cl = "./fonts/Xiaolai/Xiaolai-Regular-0986d134c05864f5025962eef9f994a0.woff2";
var Vl = "./fonts/Xiaolai/Xiaolai-Regular-1ee544f0f1dac422545c505baa788992.woff2";
var ql = "./fonts/Xiaolai/Xiaolai-Regular-4806e761d750087c2d734fc64596eaff.woff2";
var Xl = "./fonts/Xiaolai/Xiaolai-Regular-33432927cd87d40cfe393c7482bf221f.woff2";
var Gl = "./fonts/Xiaolai/Xiaolai-Regular-be549ab72f0719d606a5c01e2c0219b6.woff2";
var kl = "./fonts/Xiaolai/Xiaolai-Regular-019d66dcad46dc156b162d267f981c20.woff2";
var Zl = "./fonts/Xiaolai/Xiaolai-Regular-b5c1596551c256e0e9cf02028595b092.woff2";
var Wl = "./fonts/Xiaolai/Xiaolai-Regular-e5f453bb04da18eed01675eeebd88bf8.woff2";
var zl = "./fonts/Xiaolai/Xiaolai-Regular-cf2cc71752631e579e35b0e423bf2638.woff2";
var Ql = "./fonts/Xiaolai/Xiaolai-Regular-6f3256af8454371776bc46670d33cc65.woff2";
var jl = "./fonts/Xiaolai/Xiaolai-Regular-23f228f3999c01983860012330e4be08.woff2";
var eU = "./fonts/Xiaolai/Xiaolai-Regular-21430ee05a1248901da8d0de08744d47.woff2";
var tU = "./fonts/Xiaolai/Xiaolai-Regular-5330a2119a716e4e7224ed108b085dac.woff2";
var nU = "./fonts/Xiaolai/Xiaolai-Regular-cd145ce4a0ea18469358df53c207bc1b.woff2";
var rU = "./fonts/Xiaolai/Xiaolai-Regular-36925dfe329a45086cbb7fc5c20d45ac.woff2";
var oU = "./fonts/Xiaolai/Xiaolai-Regular-4bfaa8ffa64c5ee560aa2daba7c9cbd3.woff2";
var iU = "./fonts/Xiaolai/Xiaolai-Regular-112c051027b2d766c19a519f6ee1f4f7.woff2";
var aU = "./fonts/Xiaolai/Xiaolai-Regular-5b0ed6971aaab9c8ad563230bd5471a7.woff2";
var sU = "./fonts/Xiaolai/Xiaolai-Regular-98f2ad84457de7f3740d9920b8fa8667.woff2";
var dU = "./fonts/Xiaolai/Xiaolai-Regular-733171b4ffcd17ea1fe1c0ba627173bf.woff2";
var cU = "./fonts/Xiaolai/Xiaolai-Regular-684d65f1793cac449dde5d59cb3c47fb.woff2";
var lU = "./fonts/Xiaolai/Xiaolai-Regular-cbaaefaaf326668277aa24dfa93c4d28.woff2";
var UU = "./fonts/Xiaolai/Xiaolai-Regular-58fd02350d0bc52cf1ca3bb32ce9766e.woff2";
var fU = "./fonts/Xiaolai/Xiaolai-Regular-7ccce86603f80a099ddb0cb21d4ae3e3.woff2";
var pU = "./fonts/Xiaolai/Xiaolai-Regular-3717077e38f98d89eae729b6c14e56dc.woff2";
var uU = "./fonts/Xiaolai/Xiaolai-Regular-dbea1af6dcd9860be40c3d18254338f5.woff2";
var mU = "./fonts/Xiaolai/Xiaolai-Regular-4a0fdb40036e87b40aa08dd30584cb85.woff2";
var bU = "./fonts/Xiaolai/Xiaolai-Regular-0f626226ba1272e832aea87bafd9720e.woff2";
var EU = "./fonts/Xiaolai/Xiaolai-Regular-938d90c10ff8c20386af7f242c05d6b0.woff2";
var gU = "./fonts/Xiaolai/Xiaolai-Regular-b6d128682ee29e471486354d486a1b90.woff2";
var xU = "./fonts/Xiaolai/Xiaolai-Regular-e51ef413167c6e14e0c0fdcc585f2fc9.woff2";
var hU = "./fonts/Xiaolai/Xiaolai-Regular-9d81066dd2b337c938df6e90380a00dc.woff2";
var yU = "./fonts/Xiaolai/Xiaolai-Regular-20e7bf72fa05de9adf7dbcc7bf51dde6.woff2";
var IU = "./fonts/Xiaolai/Xiaolai-Regular-4095eb84ef3874e2600247bee0b04026.woff2";
var wU = "./fonts/Xiaolai/Xiaolai-Regular-4ee10ae43505e2e0bc62656ced49c0fa.woff2";
var RU = "./fonts/Xiaolai/Xiaolai-Regular-7494dc504ae00ee9cd0505f990f88c5d.woff2";
var TU = "./fonts/Xiaolai/Xiaolai-Regular-8de5b863cb50dfefdd07cb11c774d579.woff2";
var MU = "./fonts/Xiaolai/Xiaolai-Regular-3e1f8f654357353bf0e04ba5c34b5f7f.woff2";
var LU = "./fonts/Xiaolai/Xiaolai-Regular-2e33e8dc771ef5e1d9127d60a6b73679.woff2";
var DU = "./fonts/Xiaolai/Xiaolai-Regular-173945821411c09f70c95f98d590e697.woff2";
var SU = "./fonts/Xiaolai/Xiaolai-Regular-b358f7a51ece39a3247942b1feabdb29.woff2";
var vU = "./fonts/Xiaolai/Xiaolai-Regular-23ad2d71b280f00b1363b95b7bea94eb.woff2";
var $U = "./fonts/Xiaolai/Xiaolai-Regular-5882ffa04f32584d26109137e2da4352.woff2";
var PU = "./fonts/Xiaolai/Xiaolai-Regular-a203b91dad570bf05a58c3c3ddb529bf.woff2";
var NU = "./fonts/Xiaolai/Xiaolai-Regular-bd77e3c7f9e0b072d96af37f73d1aa32.woff2";
var FU = "./fonts/Xiaolai/Xiaolai-Regular-5a45d991244d4c7140217e1e5f5ca4f4.woff2";
var BU = "./fonts/Xiaolai/Xiaolai-Regular-f56414bf9bced67990def8660e306759.woff2";
var _U = "./fonts/Xiaolai/Xiaolai-Regular-583d166e56ba0de4b77eabb47ef67839.woff2";
var OU = "./fonts/Xiaolai/Xiaolai-Regular-7f855356ab893b0d2b9c1c83b8116f0e.woff2";
var AU = "./fonts/Xiaolai/Xiaolai-Regular-b57aaedfd8ebdf3931f25119dc6a5eb2.woff2";
var KU = "./fonts/Xiaolai/Xiaolai-Regular-b6fd38ca30869792244804b04bc058da.woff2";
var HU = "./fonts/Xiaolai/Xiaolai-Regular-452225341522a7942f0f6aab1a5c91a3.woff2";
var JU = "./fonts/Xiaolai/Xiaolai-Regular-866fa7613df6b3fd272bcfd4530c0bb9.woff2";
var YU = "./fonts/Xiaolai/Xiaolai-Regular-52a84a22fd1369bffeaf21da2d6158dc.woff2";
var CU = "./fonts/Xiaolai/Xiaolai-Regular-829615148e6357d826b9242eb7fbbd1e.woff2";
var VU = "./fonts/Xiaolai/Xiaolai-Regular-c99eda15fc26a2941579560f76c3a5cf.woff2";
var qU = "./fonts/Xiaolai/Xiaolai-Regular-395c35dd584b56b0789f58a0559beaf1.woff2";
var XU = "./fonts/Xiaolai/Xiaolai-Regular-203b0e569e3b14aac86a003dc3fa523e.woff2";
var GU = "./fonts/Xiaolai/Xiaolai-Regular-51a0e808bbc8361236ac521a119758a3.woff2";
var kU = "./fonts/Xiaolai/Xiaolai-Regular-6e092f71c1e634059ada0e52abadce67.woff2";
var ZU = "./fonts/Xiaolai/Xiaolai-Regular-0f7fb1e0d5015bb1371343153ecf7ce3.woff2";
var WU = "./fonts/Xiaolai/Xiaolai-Regular-d0cf73942fea1c74edbdf0b3011f4656.woff2";
var zU = "./fonts/Xiaolai/Xiaolai-Regular-968cffdc8ee679da094e77ebf50f58ef.woff2";
var QU = "./fonts/Xiaolai/Xiaolai-Regular-7a07ddc0f0c0f5f4a9bad6ee3dda66b5.woff2";
var jU = "./fonts/Xiaolai/Xiaolai-Regular-ec181b795ac1fb5a50d700b6e996d745.woff2";
var ef = "./fonts/Xiaolai/Xiaolai-Regular-cfb211578629b7e8153b37240de6a9d5.woff2";
var tf = "./fonts/Xiaolai/Xiaolai-Regular-59e9ff77b0efaf684bc09274fb6908c9.woff2";
var nf = "./fonts/Xiaolai/Xiaolai-Regular-2adbc89c11e65905393d3dfc468b9d5b.woff2";
var rf = "./fonts/Xiaolai/Xiaolai-Regular-70e811fd7994e61f408c923de6ddd078.woff2";
var of = "./fonts/Xiaolai/Xiaolai-Regular-c4a687ac4f0c2766eefc9f77ed99cddf.woff2";
var af = "./fonts/Xiaolai/Xiaolai-Regular-51502f1206be09c565f1547c406e9558.woff2";
var sf = "./fonts/Xiaolai/Xiaolai-Regular-1fdc0c67ed57263a80fd108c1f6ccf24.woff2";
var df = "./fonts/Xiaolai/Xiaolai-Regular-e11567fd2accf9957cd0d3c2be937d87.woff2";
var cf = "./fonts/Xiaolai/Xiaolai-Regular-20cc1bbf50e7efb442756cb605672c1f.woff2";
var lf = "./fonts/Xiaolai/Xiaolai-Regular-5d2898fbc097a7e24c6f38d80587621e.woff2";
var Uf = "./fonts/Xiaolai/Xiaolai-Regular-ac9ceb44437becc3e9c4dbfebab7fc2d.woff2";
var ff = "./fonts/Xiaolai/Xiaolai-Regular-c16ed9740b85badf16e86ea782a3062f.woff2";
var pf = "./fonts/Xiaolai/Xiaolai-Regular-aa0d470430e6391eca720c7cfa44446f.woff2";
var uf = "./fonts/Xiaolai/Xiaolai-Regular-f2b54d4e7be0eaefe1c2c56836fa5368.woff2";
var mf = "./fonts/Xiaolai/Xiaolai-Regular-99a16ef6a64934d5781933dbd9c46b2e.woff2";
var bf = "./fonts/Xiaolai/Xiaolai-Regular-c40533fdf4cc57177b12803598af7e59.woff2";
var Ef = "./fonts/Xiaolai/Xiaolai-Regular-91ddb2969bf2d31ba02ad82998d1314c.woff2";
var gf = "./fonts/Xiaolai/Xiaolai-Regular-774d4f764a1299da5d28ec2f2ffe0d69.woff2";
var xf = "./fonts/Xiaolai/Xiaolai-Regular-7718fe60986d8b42b1be9c5ace5ccf25.woff2";
var hf = "./fonts/Xiaolai/Xiaolai-Regular-aa5c9ca6cf4fba00433b7aa3fa10671a.woff2";
var yf = "./fonts/Xiaolai/Xiaolai-Regular-4f50e5136e136527280bc902c5817561.woff2";
var If = "./fonts/Xiaolai/Xiaolai-Regular-093b9ef39a46ceae95a1df18a0a3a326.woff2";
var wf = "./fonts/Xiaolai/Xiaolai-Regular-a0ca5df4258213d7fc9fce80f65ce760.woff2";
var Rf = "./fonts/Xiaolai/Xiaolai-Regular-d2666cbed13462c5dc36fa2f15c202ca.woff2";
var Tf = "./fonts/Xiaolai/Xiaolai-Regular-1e6fd68f1f3902ce48ce8c69df385622.woff2";
var Mf = "./fonts/Xiaolai/Xiaolai-Regular-87599f94b6cc129d505b375798d0d751.woff2";
var Lf = "./fonts/Xiaolai/Xiaolai-Regular-06c77b8c66e51ed6c63ccb502dd8b8af.woff2";
var Df = "./fonts/Xiaolai/Xiaolai-Regular-13ae07ed2e272d26d59bc0691cd7117a.woff2";
var Sf = "./fonts/Xiaolai/Xiaolai-Regular-353f33792a8f60dc69323ddf635a269e.woff2";
var vf = "./fonts/Xiaolai/Xiaolai-Regular-0facdf1ea213ba40261022f5d5ed4493.woff2";
var $f = "./fonts/Xiaolai/Xiaolai-Regular-f8ee5d36068a42b51d0e4a1116cfcec1.woff2";
var Pf = "./fonts/Xiaolai/Xiaolai-Regular-79d494361ae093b69e74ee9dbe65bfd4.woff2";
var Nf = "./fonts/Xiaolai/Xiaolai-Regular-74e2263a91439c25b91d5132ce9f4d62.woff2";
var Ff = "./fonts/Xiaolai/Xiaolai-Regular-ee8bae97908d5147b423f77ad0d3c1bb.woff2";
var Bf = "./fonts/Xiaolai/Xiaolai-Regular-56467a5c8840c4d23a60b2f935114848.woff2";
var _f = "./fonts/Xiaolai/Xiaolai-Regular-145aa02cdd91946e67dc934e1acffe75.woff2";
var Of = "./fonts/Xiaolai/Xiaolai-Regular-54acdfc2166ad7fcbd074f75fd4a56ba.woff2";
var Af = "./fonts/Xiaolai/Xiaolai-Regular-29cec36cd205b211da97acabaa62f055.woff2";
var Kf = "./fonts/Xiaolai/Xiaolai-Regular-3756e81d3e149cf6099163ee79944fec.woff2";
var Hf = "./fonts/Xiaolai/Xiaolai-Regular-8e9f97f01034820170065b2921b4fb5e.woff2";
var Jf = "./fonts/Xiaolai/Xiaolai-Regular-13d2887ec8ee73c43acdabc52a05af7b.woff2";
var Yf = "./fonts/Xiaolai/Xiaolai-Regular-72536a3d71b694a0d53dd90ddceae41e.woff2";
var Cf = "./fonts/Xiaolai/Xiaolai-Regular-603aefd23e350ba7eb124273e3c9bcf1.woff2";
var Vf = "./fonts/Xiaolai/Xiaolai-Regular-095c169f3314805276f603a362766abd.woff2";
var qf = "./fonts/Xiaolai/Xiaolai-Regular-9544732d2e62d1a429674f8ee41b5d3a.woff2";
var Xf = "./fonts/Xiaolai/Xiaolai-Regular-d3716376641d615e2995605b29bca7b6.woff2";
var Gf = "./fonts/Xiaolai/Xiaolai-Regular-5a1ce3117cfe90c48e8fb4a9a00f694d.woff2";
var kf = "./fonts/Xiaolai/Xiaolai-Regular-b7d203b051eff504ff59ddca7576b6a9.woff2";
var Zf = "./fonts/Xiaolai/Xiaolai-Regular-4a38cc3e9cf104e69ba246d37f8cf135.woff2";
var Wf = "./fonts/Xiaolai/Xiaolai-Regular-982b630266d87db93d2539affb1275c6.woff2";
var zf = "./fonts/Xiaolai/Xiaolai-Regular-9592bfc861f07bcb8d75c196b370e548.woff2";
var Qf = "./fonts/Xiaolai/Xiaolai-Regular-a7accba310e821da5505f71c03b76bdb.woff2";
var jf = "./fonts/Xiaolai/Xiaolai-Regular-dac48066b5883d8b4551fc584f0c2a3e.woff2";
var e1 = "./fonts/Xiaolai/Xiaolai-Regular-a1f916d6039285c4ffb900cd654e418f.woff2";
var t1 = "./fonts/Xiaolai/Xiaolai-Regular-95bfd249da4902577b4b7d76ebdd0b44.woff2";
var n1 = "./fonts/Xiaolai/Xiaolai-Regular-93fc8f28a33234bcadf1527cafabd502.woff2";
var r1 = "./fonts/Xiaolai/Xiaolai-Regular-903bb6865f3452e2fda42e3a25547bc5.woff2";
var o1 = "./fonts/Xiaolai/Xiaolai-Regular-4aca6a43e59aceee2166b0c7e4e85ef1.woff2";
var i1 = "./fonts/Xiaolai/Xiaolai-Regular-24476a126f129212beb33f66853ea151.woff2";
var a1 = "./fonts/Xiaolai/Xiaolai-Regular-1b611157cd46bb184d4fa4dae2d6a2b8.woff2";
var s1 = "./fonts/Xiaolai/Xiaolai-Regular-56a32a7689abd0326e57c10c6c069bb4.woff2";
var d1 = "./fonts/Xiaolai/Xiaolai-Regular-3cc70dbb64df5b21f1326cc24dee2195.woff2";
var c1 = "./fonts/Xiaolai/Xiaolai-Regular-f6032fc06eb20480f096199713f70885.woff2";
var l1 = "./fonts/Xiaolai/Xiaolai-Regular-e2ead7ea7da0437f085f42ffc05f8d13.woff2";
var U1 = "./fonts/Xiaolai/Xiaolai-Regular-97f7f48ce90c9429bf32ae51469db74d.woff2";
var f1 = "./fonts/Xiaolai/Xiaolai-Regular-24a21c1e4449222e8d1898d69ff3a404.woff2";
var p1 = "./fonts/Xiaolai/Xiaolai-Regular-726303e0774b4e678bff8c2deb6ca603.woff2";
var u1 = "./fonts/Xiaolai/Xiaolai-Regular-5a7fac4b8b23a6e4e5ba0c9bf1756c91.woff2";
var m1 = "./fonts/Xiaolai/Xiaolai-Regular-2b7441d46298788ac94e610ffcc709b6.woff2";
var b1 = [{ uri: Ic, descriptors: { unicodeRange: "U+f9b8-fa6d,U+fe32,U+fe45-fe4f,U+ff02-ff0b,U+ff0d-ff1e,U+ff20-ff2a" } }, { uri: wc, descriptors: { unicodeRange: "U+20dd-20de,U+25ef,U+ff2b-ffbe,U+ffc2-ffc7,U+ffca-ffcf,U+ffd2-ffd7,U+ffda-ffdc,U+ffe0-ffe6,U+ffe8-ffee" } }, { uri: Rc, descriptors: { unicodeRange: "U+d7eb-d7fb,U+f900-f9b7" } }, { uri: Tc, descriptors: { unicodeRange: "U+d6f2-d7a3,U+d7b0-d7c6,U+d7cb-d7ea" } }, { uri: Mc, descriptors: { unicodeRange: "U+d609-d6f1" } }, { uri: Lc, descriptors: { unicodeRange: "U+d520-d608" } }, { uri: Dc, descriptors: { unicodeRange: "U+d437-d51f" } }, { uri: Sc, descriptors: { unicodeRange: "U+d34e-d436" } }, { uri: vc, descriptors: { unicodeRange: "U+d265-d34d" } }, { uri: $c, descriptors: { unicodeRange: "U+d17c-d264" } }, { uri: Pc, descriptors: { unicodeRange: "U+d093-d17b" } }, { uri: Nc, descriptors: { unicodeRange: "U+cfaa-d092" } }, { uri: Fc, descriptors: { unicodeRange: "U+cec1-cfa9" } }, { uri: Bc, descriptors: { unicodeRange: "U+cdd8-cec0" } }, { uri: _c, descriptors: { unicodeRange: "U+ccf1-cdd7" } }, { uri: Oc, descriptors: { unicodeRange: "U+cc08-ccf0" } }, { uri: Ac, descriptors: { unicodeRange: "U+cb43-cc07" } }, { uri: Kc, descriptors: { unicodeRange: "U+ca83-cb42" } }, { uri: Hc, descriptors: { unicodeRange: "U+c9a1-ca82" } }, { uri: Jc, descriptors: { unicodeRange: "U+c8b8-c9a0" } }, { uri: Yc, descriptors: { unicodeRange: "U+c7cf-c8b7" } }, { uri: Cc, descriptors: { unicodeRange: "U+c6e6-c7ce" } }, { uri: Vc, descriptors: { unicodeRange: "U+c5fd-c6e5" } }, { uri: qc, descriptors: { unicodeRange: "U+c514-c5fc" } }, { uri: Xc, descriptors: { unicodeRange: "U+c42b-c513" } }, { uri: Gc, descriptors: { unicodeRange: "U+c341-c34e,U+c350-c42a" } }, { uri: kc, descriptors: { unicodeRange: "U+c258-c340" } }, { uri: Zc, descriptors: { unicodeRange: "U+c16f-c257" } }, { uri: Wc, descriptors: { unicodeRange: "U+c086-c16e" } }, { uri: zc, descriptors: { unicodeRange: "U+bf9d-c085" } }, { uri: Qc, descriptors: { unicodeRange: "U+beb4-bf9c" } }, { uri: jc, descriptors: { unicodeRange: "U+bdcb-beb3" } }, { uri: el, descriptors: { unicodeRange: "U+bce2-bdca" } }, { uri: tl, descriptors: { unicodeRange: "U+bbf9-bce1" } }, { uri: nl, descriptors: { unicodeRange: "U+bb10-bbf8" } }, { uri: rl, descriptors: { unicodeRange: "U+ba27-bb0f" } }, { uri: ol, descriptors: { unicodeRange: "U+b93e-ba26" } }, { uri: il, descriptors: { unicodeRange: "U+b855-b93d" } }, { uri: al, descriptors: { unicodeRange: "U+b76c-b854" } }, { uri: sl, descriptors: { unicodeRange: "U+b683-b76b" } }, { uri: dl, descriptors: { unicodeRange: "U+b59a-b682" } }, { uri: cl, descriptors: { unicodeRange: "U+b4b1-b599" } }, { uri: ll, descriptors: { unicodeRange: "U+11fb-11ff,U+b3cd-b4b0" } }, { uri: Ul, descriptors: { unicodeRange: "U+11e6-11fa,U+b2f9-b3cc" } }, { uri: fl, descriptors: { unicodeRange: "U+11d1-11e5,U+b225-b2f8" } }, { uri: pl, descriptors: { unicodeRange: "U+11bc-11d0,U+b151-b224" } }, { uri: ul, descriptors: { unicodeRange: "U+11a7-11bb,U+b07d-b150" } }, { uri: ml, descriptors: { unicodeRange: "U+1191-11a6,U+afaa-b07c" } }, { uri: bl, descriptors: { unicodeRange: "U+117c-1190,U+aed6-afa9" } }, { uri: El, descriptors: { unicodeRange: "U+1167-117b,U+ae02-aed5" } }, { uri: gl, descriptors: { unicodeRange: "U+1152-115e,U+1160-1166,U+ad2d-ae01" } }, { uri: xl, descriptors: { unicodeRange: "U+113d-1151,U+ac59-ad2c" } }, { uri: hl, descriptors: { unicodeRange: "U+1100-113c,U+9f95-9f98,U+9f9c-9f9e,U+9fa1-9fce,U+9fd0,U+a960-a97c,U+ac00-ac58" } }, { uri: yl, descriptors: { unicodeRange: "U+9771-9772,U+9775,U+9777-977b,U+977d-9784,U+9786-978a,U+978c,U+978e-9790,U+9793,U+9795-9797,U+9799-979f,U+97a1-97a2,U+97a4-97aa,U+97ac,U+97ae,U+97b0-97b1,U+97b3,U+97b5-97e5,U+97e8,U+97ee-97f2,U+97f4,U+97f7-982d" } }, { uri: Il, descriptors: { unicodeRange: "U+9491,U+9496,U+9498,U+94c7,U+94cf,U+94d3-94d4,U+94da,U+94e6,U+94fb,U+951c,U+9520,U+9527,U+9533,U+953d,U+9543,U+9548,U+954b,U+9555,U+955a,U+9560,U+956e,U+9574-9575,U+9577-957e,U+9580-95e7,U+95ec,U+95ff,U+9607,U+9613,U+9618,U+961b,U+961e,U+9620,U+9623-9629,U+962b-962d,U+962f-9630,U+9637-963a,U+963e,U+9641,U+9643,U+964a,U+964e-964f,U+9651-9653,U+9656-965a,U+965c-965e,U+9660,U+9663,U+9665-9666,U+966b,U+966d-9671,U+9673,U+9678-9684,U+9687,U+9689-968a,U+968c,U+968e,U+9691-9693" } }, { uri: wl, descriptors: { unicodeRange: "U+923c-9273,U+9275-928d,U+928f-92ad,U+92af-92c7,U+92c9-92ee" } }, { uri: Rl, descriptors: { unicodeRange: "U+9159,U+915b-915c,U+915f-9160,U+9166-9168,U+916b,U+916d,U+9173,U+917a-917c,U+9180-9184,U+9186,U+9188,U+918a,U+918e-918f,U+9193-9199,U+919c-91a1,U+91a4-91a9,U+91ab-91ac,U+91b0-91b3,U+91b6-91b9,U+91bb-91c6,U+91c8,U+91cb,U+91d0,U+91d2-91db,U+91dd-923b" } }, { uri: Tl, descriptors: { unicodeRange: "U+902b-902c,U+9030-9034,U+9037,U+9039-903a,U+903d,U+903f-9040,U+9043,U+9045-9046,U+9048-904c,U+904e,U+9054-9056,U+9059-905a,U+905c-9061,U+9064,U+9066-9067,U+9069-906c,U+906f-9073,U+9076-907c,U+907e,U+9081,U+9084-9087,U+9089-908a,U+908c-9090,U+9092,U+9094,U+9096,U+9098,U+909a,U+909c,U+909e-90a0,U+90a4-90a5,U+90a7-90a9,U+90ab,U+90ad,U+90b2,U+90b7,U+90bc-90bd,U+90bf-90c0,U+90c2-90c3,U+90c6,U+90c8-90c9,U+90cb-90cd,U+90d2,U+90d4-90d6,U+90d8-90da,U+90de-90e0,U+90e3-90e5,U+90e9-90ea,U+90ec,U+90ee,U+90f0-90f3,U+90f5-90f7,U+90f9-90fc,U+90ff-9101,U+9103,U+9105-9118,U+911a-911d,U+911f-9121,U+9124-912e,U+9130,U+9132-9138,U+913a-9142,U+9144-9145,U+9147-9148,U+9151,U+9153-9156,U+9158" } }, { uri: Ml, descriptors: { unicodeRange: "U+8f03-8f65,U+8f6a,U+8f80,U+8f8c,U+8f92,U+8f9d,U+8fa0-8fa2,U+8fa4-8fa7,U+8faa,U+8fac-8faf,U+8fb2-8fb5,U+8fb7-8fb8,U+8fba-8fbc,U+8fbf-8fc0,U+8fc3,U+8fc6,U+8fc9-8fcd,U+8fcf,U+8fd2,U+8fd6-8fd7,U+8fda,U+8fe0-8fe1,U+8fe3,U+8fe7,U+8fec,U+8fef,U+8ff1-8ff2,U+8ff4-8ff6,U+8ffa-8ffc,U+8ffe-8fff,U+9007-9008,U+900c,U+900e,U+9013,U+9015,U+9018-9019,U+901c,U+9023-9025,U+9027-902a" } }, { uri: Ll, descriptors: { unicodeRange: "U+8d03-8d1c,U+8d20,U+8d51-8d52,U+8d57,U+8d5f,U+8d65,U+8d68-8d6a,U+8d6c,U+8d6e-8d6f,U+8d71-8d72,U+8d78-8d80,U+8d82-8d83,U+8d86-8d89,U+8d8c-8d90,U+8d92-8d93,U+8d95-8d9e,U+8da0-8da2,U+8da4-8db0,U+8db2,U+8db6-8db7,U+8db9,U+8dbb,U+8dbd,U+8dc0-8dc2,U+8dc5,U+8dc7-8dca,U+8dcd,U+8dd0,U+8dd2-8dd5,U+8dd8-8dd9,U+8ddc,U+8de0-8de2,U+8de5-8de7,U+8de9,U+8ded-8dee,U+8df0-8df2,U+8df4,U+8df6,U+8dfc,U+8dfe-8e04,U+8e06-8e08,U+8e0b,U+8e0d-8e0e,U+8e10-8e13,U+8e15-8e1c,U+8e20-8e21,U+8e24-8e28,U+8e2b,U+8e2d,U+8e30,U+8e32-8e34,U+8e36-8e38,U+8e3b-8e3c,U+8e3e-8e3f,U+8e43,U+8e45-8e46" } }, { uri: Dl, descriptors: { unicodeRange: "U+8bea,U+8c09,U+8c1e,U+8c38-8c40,U+8c42-8c45,U+8c48,U+8c4a-8c4b,U+8c4d-8c54,U+8c56-8c59,U+8c5b-8c60,U+8c63-8c69,U+8c6c-8c72,U+8c74-8c77,U+8c7b-8c81,U+8c83-8c84,U+8c86-8c88,U+8c8b,U+8c8d-8c93,U+8c95-8c97,U+8c99-8d02" } }, { uri: Sl, descriptors: { unicodeRange: "U+8a64-8a78,U+8a7a-8a88,U+8a8b-8a92,U+8a94-8b06,U+8b08-8b1b" } }, { uri: vl, descriptors: { unicodeRange: "U+8987-89c0,U+89c3,U+89cd,U+89d3-89d5,U+89d7-89d9,U+89db,U+89dd,U+89df-89e2,U+89e4,U+89e7-89ea,U+89ec-89ee,U+89f0-89f2,U+89f4-89ff,U+8a01-8a06,U+8a08-8a3d,U+8a3f-8a47,U+8a49-8a63" } }, { uri: $l, descriptors: { unicodeRange: "U+87e3-87e4,U+87e6-87e9,U+87eb-87ed,U+87ef-87f8,U+87fa-87fd,U+87ff-8802,U+8804-8809,U+880b-8812,U+8814,U+8817-881a,U+881c-8820,U+8823-8831,U+8833-8838,U+883a-883b,U+883d-883f,U+8841-8843,U+8846-884b,U+884e-8853,U+8855-8856,U+8858,U+885a-8860,U+8866-8867,U+886a,U+886d,U+886f,U+8871,U+8873-8876,U+8878-887c,U+8880,U+8883,U+8886-8887,U+8889-888a,U+888c,U+888e-8891,U+8893-8895,U+8897-889b,U+889d-88a1,U+88a3,U+88a5-88aa,U+88ac,U+88ae-88b0,U+88b2-88b6,U+88b8-88bb" } }, { uri: Pl, descriptors: { unicodeRange: "U+86e7-86e8,U+86ea-86ec,U+86ef,U+86f5-86f7,U+86fa-86fd,U+86ff,U+8701,U+8704-8706,U+870b-870c,U+870e-8711,U+8714,U+8716,U+8719,U+871b,U+871d,U+871f-8720,U+8724,U+8726-8728,U+872a-872d,U+872f-8730,U+8732-8733,U+8735-8736,U+8738-873a,U+873c-873d,U+8740-8746,U+874a-874b,U+874d,U+874f-8752,U+8754-8756,U+8758,U+875a-875f,U+8761-8762,U+8766-876d,U+876f,U+8771-8773,U+8775,U+8777-877a,U+877f-8781,U+8784,U+8786-8787,U+8789-878a,U+878c,U+878e-8792,U+8794-8796,U+8798-879e,U+87a0-87a7,U+87a9-87aa,U+87ae,U+87b0-87b2,U+87b4,U+87b6-87b9,U+87bb-87bc,U+87be-87bf,U+87c1-87c5,U+87c7-87c9,U+87cc-87d0,U+87d4-87da,U+87dc-87df,U+87e1-87e2" } }, { uri: Nl, descriptors: { unicodeRange: "U+8604,U+8606-8610,U+8612-8615,U+8617-8626,U+8628,U+862a-8637,U+8639-863b,U+863d-864c,U+8652-8653,U+8655-8659,U+865b-865d,U+865f-8661,U+8663-866a,U+866d,U+866f-8670,U+8672-8678,U+8683-8689,U+868e-8692,U+8694,U+8696-869b,U+869e-86a2,U+86a5-86a6,U+86ab,U+86ad-86ae,U+86b2-86b3,U+86b7-86b9,U+86bb-86bf,U+86c1-86c3,U+86c5,U+86c8,U+86cc-86cd,U+86d2-86d3,U+86d5-86d7,U+86da,U+86dc-86dd,U+86e0-86e3,U+86e5-86e6" } }, { uri: Fl, descriptors: { unicodeRange: "U+8456,U+8458,U+845d-8460,U+8462,U+8464-8468,U+846a,U+846e-8470,U+8472,U+8474,U+8477,U+8479,U+847b-8481,U+8483-8486,U+848a,U+848d,U+848f-8496,U+8498,U+849a-849b,U+849d-84a0,U+84a2-84ae,U+84b0-84b1,U+84b3,U+84b5-84b7,U+84bb-84bc,U+84be,U+84c0,U+84c2-84c3,U+84c5-84c8,U+84cb-84cc,U+84ce-84cf,U+84d2,U+84d4-84d5,U+84d7-84dc,U+84de,U+84e1-84e2,U+84e4,U+84e7-84eb,U+84ed-84ef,U+84f1-84fb,U+84fd-84fe,U+8500-850b,U+850d-8510,U+8512,U+8514-8516,U+8518-8519,U+851b-851e,U+8520,U+8522-852a,U+852d-8536,U+853e-8542,U+8544-8547,U+854b-854f" } }, { uri: Bl, descriptors: { unicodeRange: "U+82c2-82c3,U+82c5-82c6,U+82c9,U+82d0,U+82d6,U+82d9-82da,U+82dd,U+82e2,U+82e7-82ea,U+82ec-82ee,U+82f0,U+82f2-82f3,U+82f5-82f6,U+82f8,U+82fa,U+82fc-8300,U+830a-830b,U+830d,U+8310,U+8312-8313,U+8316,U+8318-8319,U+831d-8326,U+8329-832a,U+832e,U+8330,U+8332,U+8337,U+833b,U+833d-833f,U+8341-8342,U+8344-8345,U+8348,U+834a-834e,U+8353,U+8355-8359,U+835d,U+8362,U+8370-8376,U+8379-837a,U+837e-8384,U+8387-8388,U+838a-838d,U+838f-8391,U+8394-8397,U+8399-839a,U+839d,U+839f,U+83a1-83a7,U+83ac-83af,U+83b5,U+83bb,U+83be-83bf,U+83c2-83c4,U+83c6,U+83c8-83c9,U+83cb,U+83cd-83ce,U+83d0-83d3,U+83d5,U+83d7,U+83d9-83db,U+83de,U+83e2-83e4,U+83e6-83e8,U+83eb-83ef,U+83f3-83f7,U+83fa-83fc,U+83fe-8400,U+8402,U+8405,U+8407-840a,U+8410,U+8412-8417,U+8419-841b,U+841e-8423,U+8429-8430,U+8432-8437,U+8439-843b,U+843e-8445,U+8447-8450,U+8452-8455" } }, { uri: _l, descriptors: { unicodeRange: "U+81a4-81a5,U+81a7,U+81a9,U+81ab-81b2,U+81b4-81b9,U+81bc-81bf,U+81c4-81c5,U+81c7-81c9,U+81cb,U+81cd-81e2,U+81e4-81e6,U+81e8-81e9,U+81eb,U+81ee-81f2,U+81f5-81fa,U+81fd,U+81ff,U+8203,U+8207-820b,U+820e-820f,U+8211,U+8213,U+8215-821a,U+821d,U+8220,U+8224-8227,U+8229,U+822e,U+8232,U+823a,U+823c-823d,U+823f-8243,U+8245-8246,U+8248,U+824a,U+824c-824e,U+8250-8257,U+8259,U+825b-825e,U+8260-8267,U+8269-826d,U+8271,U+8275-8278,U+827b-827c,U+8280-8281,U+8283,U+8285-8287,U+8289,U+828c,U+8290,U+8293-8296,U+829a-829b,U+829e,U+82a0,U+82a2-82a3,U+82a7,U+82b2,U+82b5-82b6,U+82ba-82bc,U+82bf-82c0" } }, { uri: Ol, descriptors: { unicodeRange: "U+8059,U+805b-8068,U+806b-8070,U+8072-807e,U+8081-8082,U+8085,U+8088,U+808a,U+808d-8092,U+8094-8095,U+8097,U+8099,U+809e,U+80a3,U+80a6-80a8,U+80ac,U+80b0,U+80b3,U+80b5-80b6,U+80b8-80b9,U+80bb,U+80c5,U+80c7-80cb,U+80cf-80d5,U+80d8,U+80df-80e0,U+80e2-80e3,U+80e6,U+80ee,U+80f5,U+80f7,U+80f9,U+80fb,U+80fe-8101,U+8103-8105,U+8107-8108,U+810b-810c,U+8115,U+8117,U+8119,U+811b-811d,U+811f-812b,U+812d-812e,U+8130,U+8133-8135,U+8137,U+8139-813d,U+813f-8145,U+8147,U+8149,U+814d-814f,U+8152,U+8156-8158,U+815b-815f,U+8161-8164,U+8166,U+8168,U+816a-816c,U+816f,U+8172-8173,U+8175-8178,U+8181,U+8183-8187,U+8189,U+818b-818e,U+8190,U+8192-8197,U+8199-819a,U+819e-81a2" } }, { uri: Al, descriptors: { unicodeRange: "U+7f3c-7f41,U+7f43,U+7f46-7f4f,U+7f52-7f53,U+7f56,U+7f59,U+7f5b-7f5e,U+7f60,U+7f63-7f67,U+7f6b-7f6d,U+7f6f-7f70,U+7f73,U+7f75-7f78,U+7f7a-7f7d,U+7f7f-7f80,U+7f82-7f89,U+7f8b,U+7f8d,U+7f8f-7f93,U+7f95-7f99,U+7f9b-7f9c,U+7fa0,U+7fa2-7fa3,U+7fa5-7fa6,U+7fa8-7fae,U+7fb1,U+7fb3-7fb7,U+7fba-7fbb,U+7fbe,U+7fc0,U+7fc2-7fc4,U+7fc6-7fc9,U+7fcb,U+7fcd,U+7fcf-7fd3,U+7fd6-7fd7,U+7fd9-7fde,U+7fe2-7fe4,U+7fe7-7fe8,U+7fea-7fed,U+7fef,U+7ff2,U+7ff4-7ffa,U+7ffd-7fff,U+8002,U+8007-800a,U+800e-800f,U+8011,U+8013,U+801a-801b,U+801d-801f,U+8021,U+8023-8024,U+802b-8030,U+8032,U+8034,U+8039-803a,U+803c,U+803e,U+8040-8041,U+8044-8045,U+8047-8049,U+804e-8051,U+8053,U+8055-8057" } }, { uri: Kl, descriptors: { unicodeRange: "U+7cd8,U+7cda-7cdb,U+7cdd-7cde,U+7ce1-7ce7,U+7ce9-7cee,U+7cf0-7cf7,U+7cf9-7cfa,U+7cfc-7d09,U+7d0b-7d1f,U+7d21,U+7d23-7d26,U+7d28-7d2a,U+7d2c-7d2e,U+7d30-7d6d,U+7d6f-7d76,U+7d78-7d94" } }, { uri: Hl, descriptors: { unicodeRange: "U+7afe,U+7b00-7b02,U+7b05,U+7b07,U+7b09,U+7b0c-7b0e,U+7b10,U+7b12-7b13,U+7b16-7b18,U+7b1a,U+7b1c-7b1d,U+7b1f,U+7b21-7b23,U+7b27,U+7b29,U+7b2d,U+7b2f-7b30,U+7b32,U+7b34-7b37,U+7b39,U+7b3b,U+7b3d,U+7b3f-7b44,U+7b46,U+7b48,U+7b4a,U+7b4d-7b4e,U+7b53,U+7b55,U+7b57,U+7b59,U+7b5c,U+7b5e-7b5f,U+7b61,U+7b63-7b6d,U+7b6f-7b70,U+7b73-7b74,U+7b76,U+7b78,U+7b7a,U+7b7c-7b7d,U+7b7f,U+7b81-7b84,U+7b86-7b8c,U+7b8e-7b8f,U+7b91-7b93,U+7b96,U+7b98-7b9b,U+7b9e-7ba0,U+7ba3-7ba5,U+7bae-7bb0,U+7bb2-7bb3,U+7bb5-7bb7,U+7bb9-7bc0,U+7bc2-7bc5,U+7bc8-7bcb,U+7bcd-7bd0,U+7bd2,U+7bd4-7bd8,U+7bdb-7bdc,U+7bde-7be0,U+7be2-7be4,U+7be7-7be9,U+7beb-7bed,U+7bef-7bf0,U+7bf2-7bf6,U+7bf8-7bfb,U+7bfd,U+7bff-7c06,U+7c08-7c0a,U+7c0d-7c0e,U+7c10-7c13" } }, { uri: Jl, descriptors: { unicodeRange: "U+7a10-7a13,U+7a15-7a16,U+7a18-7a19,U+7a1b-7a1d,U+7a1f,U+7a21-7a22,U+7a24-7a32,U+7a34-7a36,U+7a38,U+7a3a,U+7a3e,U+7a40-7a45,U+7a47-7a50,U+7a52-7a56,U+7a58-7a6f,U+7a71-7a73,U+7a75,U+7a7b-7a7e,U+7a82,U+7a85,U+7a87,U+7a89-7a8c,U+7a8e-7a90,U+7a93-7a94,U+7a99-7a9b,U+7a9e,U+7aa1-7aa4,U+7aa7,U+7aa9-7aab,U+7aae-7ab2,U+7ab4-7abe,U+7ac0-7aca,U+7acc-7ad5,U+7ad7-7ad8,U+7ada-7add,U+7ae1-7ae2,U+7ae4,U+7ae7-7aec,U+7aee,U+7af0-7af8,U+7afb-7afc" } }, { uri: Yl, descriptors: { unicodeRange: "U+790d-7912,U+7914-791d,U+791f-7923,U+7925-7933,U+7935-7939,U+793d,U+793f,U+7942-7945,U+7947,U+794a-7952,U+7954-7955,U+7958-7959,U+7961,U+7963-7964,U+7966,U+7969-796c,U+796e,U+7970-7976,U+7979,U+797b-797f,U+7982-7983,U+7986-7989,U+798b-798e,U+7990-7999,U+799b-79a6,U+79a8-79b2,U+79b4-79b8,U+79bc,U+79bf,U+79c2,U+79c4-79c5,U+79c7-79c8,U+79ca,U+79cc,U+79ce-79d0,U+79d3-79d4,U+79d6-79d7,U+79d9-79de,U+79e0-79e2,U+79e5,U+79e8,U+79ea,U+79ec,U+79ee,U+79f1-79f7,U+79f9-79fa,U+79fc,U+79fe-79ff,U+7a01,U+7a04-7a05,U+7a07-7a0a,U+7a0c,U+7a0f" } }, { uri: Cl, descriptors: { unicodeRange: "U+77d8-77da,U+77dd-77e1,U+77e4,U+77e6,U+77e8,U+77ea,U+77ef-77f2,U+77f4-77f5,U+77f7,U+77f9-77fc,U+7803-7808,U+780a-780b,U+780e-7810,U+7813,U+7815,U+7819,U+781b,U+781e,U+7820-7822,U+7824,U+7828,U+782a-782b,U+782e-782f,U+7831-7833,U+7835-7836,U+783d,U+783f,U+7841-7844,U+7846,U+7848-784b,U+784d,U+784f,U+7851,U+7853-7854,U+7858-785c,U+785e-7869,U+786f-7876,U+7878-787b,U+787d-7886,U+7888,U+788a-788b,U+788f-7890,U+7892,U+7894-7896,U+7899,U+789d-789e,U+78a0,U+78a2,U+78a4,U+78a6,U+78a8-78af,U+78b5-78b8,U+78ba-78bd,U+78bf-78c0,U+78c2-78c4,U+78c6-78c8,U+78cc-78cf,U+78d1-78d3,U+78d6-78d8,U+78da-78e7,U+78e9-78eb,U+78ed-78f1,U+78f3,U+78f5-78f6,U+78f8-78f9,U+78fb-7900,U+7902-7904,U+7906-790c" } }, { uri: Vl, descriptors: { unicodeRange: "U+76af-76b0,U+76b3,U+76b5-76be,U+76c0-76c1,U+76c3-76c4,U+76c7,U+76c9,U+76cb-76cc,U+76d3,U+76d5,U+76d9-76da,U+76dc-76de,U+76e0-76e4,U+76e6-76ed,U+76f0,U+76f3,U+76f5-76f7,U+76fa-76fb,U+76fd,U+76ff-7703,U+7705-7706,U+770a,U+770c,U+770e-7718,U+771b-771e,U+7721,U+7723-7725,U+7727,U+772a-772c,U+772e,U+7730-7734,U+7739,U+773b,U+773d-773f,U+7742,U+7744-7746,U+7748-774f,U+7752-7759,U+775c-7760,U+7764,U+7767,U+7769-776a,U+776d-7778,U+777a-777c,U+7781-7783,U+7786-778b,U+778f-7790,U+7793-779e,U+77a1,U+77a3-77a4,U+77a6,U+77a8,U+77ab,U+77ad-77af,U+77b1-77b2,U+77b4,U+77b6-77ba,U+77bc,U+77be,U+77c0-77cc,U+77ce-77d6" } }, { uri: ql, descriptors: { unicodeRange: "U+7589-758a,U+758c-758e,U+7590,U+7593,U+7595,U+7598,U+759b-759c,U+759e,U+75a2,U+75a6-75aa,U+75ad,U+75b6-75b7,U+75ba-75bb,U+75bf-75c1,U+75c6,U+75cb-75cc,U+75ce-75d1,U+75d3,U+75d7,U+75d9-75da,U+75dc-75dd,U+75df-75e1,U+75e5,U+75e9,U+75ec-75ef,U+75f2-75f3,U+75f5-75f8,U+75fa-75fb,U+75fd-75fe,U+7602,U+7604,U+7606-7609,U+760b,U+760d-760f,U+7611-7614,U+7616,U+761a,U+761c-761e,U+7621,U+7623,U+7627-7628,U+762c,U+762e-762f,U+7631-7632,U+7636-7637,U+7639-763b,U+763d,U+7641-7642,U+7644-764b,U+764e-7653,U+7655,U+7657-765b,U+765d,U+765f-7662,U+7664-766a,U+766c-766e,U+7670-7677,U+7679-767a,U+767c,U+767f-7681,U+7683,U+7685,U+7689-768a,U+768c-768d,U+768f-7690,U+7692,U+7694-7695,U+7697-7698,U+769a-76a3,U+76a5-76ad" } }, { uri: Xl, descriptors: { unicodeRange: "U+7492-749b,U+749d,U+749f-74a6,U+74aa-74b9,U+74bb-74d1,U+74d3-74db,U+74dd,U+74df,U+74e1,U+74e5,U+74e7-74ed,U+74f0-74f3,U+74f5,U+74f8-74fe,U+7500-7503,U+7505-750c,U+750e,U+7510,U+7512,U+7514-7517,U+751b,U+751d-751e,U+7520-7524,U+7526-7527,U+752a,U+752e,U+7534,U+7536,U+7539,U+753c-753d,U+753f,U+7541-7544,U+7546-7547,U+7549-754a,U+754d,U+7550-7553,U+7555-7558,U+755d-7564,U+7567-7569,U+756b-7571,U+7573,U+7575-7577,U+757a-757e,U+7580-7582,U+7584-7585,U+7587-7588" } }, { uri: Gl, descriptors: { unicodeRange: "U+7372-737d,U+737f-7383,U+7385-7386,U+7388,U+738a,U+738c-738d,U+738f-7390,U+7392-7395,U+7397-739a,U+739c-739e,U+73a0-73a1,U+73a3-73a8,U+73aa,U+73ac-73ad,U+73b1,U+73b4-73b6,U+73b8-73b9,U+73bc-73bf,U+73c1,U+73c3-73c7,U+73cb-73cc,U+73ce,U+73d2-73d8,U+73da-73dd,U+73df,U+73e1-73e4,U+73e6,U+73e8,U+73ea-73ec,U+73ee-73f1,U+73f3-7402,U+7404,U+7407-7408,U+740b-740e,U+7411-7419,U+741c-7421,U+7423-7424,U+7427,U+7429,U+742b,U+742d,U+742f,U+7431-7432,U+7437-743b,U+743d-7440,U+7442-7454,U+7456,U+7458,U+745d,U+7460-746c,U+746e-746f,U+7471-7475,U+7478-747d,U+747f,U+7482,U+7484-7486,U+7488-748a,U+748c-748d,U+748f,U+7491" } }, { uri: kl, descriptors: { unicodeRange: "U+7054-705d,U+705f-706a,U+706e,U+7071-7074,U+7077,U+7079-707b,U+707d,U+7081-7084,U+7086-7088,U+708b-708d,U+708f-7091,U+7093,U+7097-7098,U+709a-709b,U+709e-70aa,U+70b0,U+70b2,U+70b4-70b6,U+70ba,U+70be-70bf,U+70c4-70c7,U+70c9,U+70cb-70d7,U+70da,U+70dc-70de,U+70e0-70e3,U+70e5,U+70ea,U+70ee,U+70f0-70f6,U+70f8,U+70fa-70fc,U+70fe-7108,U+710b-710f,U+7111-7112,U+7114,U+7117,U+711b-7125,U+7127-712e,U+7132-7135,U+7137-7144,U+7146-7149,U+714b,U+714d,U+714f-715b,U+715d,U+715f-7163,U+7165,U+7169-716d,U+716f-7171,U+7174-7177" } }, { uri: Zl, descriptors: { unicodeRange: "U+722e-722f,U+7232-7234,U+723a,U+723c,U+723e,U+7240-7246,U+7249-724b,U+724e-7251,U+7253-7255,U+7257-7258,U+725a,U+725c,U+725e,U+7260,U+7263-7265,U+7268,U+726a-726d,U+7270-7271,U+7273-7274,U+7276-7278,U+727b-727d,U+7282-7283,U+7285-7289,U+728c,U+728e,U+7290-7291,U+7293-729e,U+72a0-72ab,U+72ae,U+72b1-72b3,U+72b5,U+72ba-72c0,U+72c5-72c7,U+72c9-72cc,U+72cf,U+72d1,U+72d3-72d6,U+72d8,U+72da-72dd,U+72df,U+72e2-72e7,U+72ea-72eb,U+72f5-72f6,U+72f9,U+72fd-7300,U+7302,U+7304-7309,U+730b-730d,U+730f-7312,U+7314,U+7318-731a,U+731f-7320,U+7323-7324,U+7326-7328,U+732d,U+732f-7330,U+7332-7333,U+7335-7336,U+733a-733d,U+7340-734c,U+734e-734f,U+7351,U+7353-7356,U+7358-735f,U+7361-736b,U+736e,U+7370-7371" } }, { uri: Wl, descriptors: { unicodeRange: "U+6ec5-6ec6,U+6ec8-6eca,U+6ecc-6ece,U+6ed0,U+6ed2,U+6ed6,U+6ed8-6ed9,U+6edb-6edd,U+6ee3,U+6ee7,U+6eea-6ef3,U+6ef5-6ef8,U+6efa-6f01,U+6f03-6f05,U+6f07-6f08,U+6f0a-6f0e,U+6f10-6f12,U+6f16-6f1f,U+6f21-6f23,U+6f25-6f28,U+6f2c,U+6f2e,U+6f30,U+6f32,U+6f34-6f35,U+6f37-6f3d,U+6f3f-6f45,U+6f48-6f4a,U+6f4c,U+6f4e-6f57,U+6f59-6f5b,U+6f5d,U+6f5f-6f61,U+6f63-6f65,U+6f67-6f6c,U+6f6f-6f71,U+6f73,U+6f75-6f77,U+6f79,U+6f7b,U+6f7d-6f83,U+6f85-6f87,U+6f8a-6f8b,U+6f8f-6f9b,U+6f9d-6fa0,U+6fa2-6fa6,U+6fa8-6fb1" } }, { uri: zl, descriptors: { unicodeRange: "U+6d73,U+6d75-6d76,U+6d79-6d7b,U+6d7d-6d81,U+6d83-6d84,U+6d86-6d87,U+6d8a-6d8b,U+6d8d,U+6d8f-6d90,U+6d92,U+6d96-6d9a,U+6d9c,U+6da2,U+6da5,U+6dac-6dad,U+6db0-6db1,U+6db3-6db4,U+6db6-6db7,U+6db9-6dbe,U+6dc1-6dc3,U+6dc8-6dca,U+6dcd-6dd0,U+6dd2-6dd5,U+6dd7,U+6dda-6ddc,U+6ddf,U+6de2-6de3,U+6de5,U+6de7-6dea,U+6ded,U+6def-6df0,U+6df2,U+6df4-6df6,U+6df8,U+6dfa,U+6dfd-6e04,U+6e06-6e09,U+6e0b,U+6e0f,U+6e12-6e13,U+6e15,U+6e18-6e19,U+6e1b-6e1c,U+6e1e-6e1f,U+6e22,U+6e26-6e28,U+6e2a,U+6e2c,U+6e2e,U+6e30-6e31,U+6e33,U+6e35-6e37,U+6e39,U+6e3b-6e42,U+6e45-6e4c,U+6e4f-6e52,U+6e55,U+6e57,U+6e59-6e5a,U+6e5c-6e5e,U+6e60-6e6a,U+6e6c-6e6d,U+6e6f-6e7d,U+6e80-6e82,U+6e84,U+6e87-6e88,U+6e8a-6e8e,U+6e91-6e97,U+6e99-6e9b,U+6e9d-6e9e,U+6ea0-6ea1,U+6ea3-6ea4,U+6ea6,U+6ea8-6ea9,U+6eab-6eae,U+6eb0,U+6eb3,U+6eb5,U+6eb8-6eb9,U+6ebc,U+6ebe-6ec0,U+6ec3-6ec4" } }, { uri: Ql, descriptors: { unicodeRange: "U+6bbb-6bbe,U+6bc0,U+6bc3-6bc4,U+6bc6-6bca,U+6bcc,U+6bce,U+6bd0-6bd1,U+6bd8,U+6bda,U+6bdc-6be0,U+6be2-6be9,U+6bec-6bee,U+6bf0-6bf2,U+6bf4,U+6bf6-6bf8,U+6bfa-6bfc,U+6bfe-6c04,U+6c08-6c0c,U+6c0e,U+6c12,U+6c17,U+6c1c-6c1e,U+6c20,U+6c23,U+6c25,U+6c2b-6c2d,U+6c31,U+6c33,U+6c36-6c37,U+6c39-6c3c,U+6c3e-6c3f,U+6c43-6c45,U+6c48,U+6c4b-6c4f,U+6c51-6c53,U+6c56,U+6c58-6c5a,U+6c62-6c63,U+6c65-6c67,U+6c6b-6c6f,U+6c71,U+6c73,U+6c75,U+6c77-6c78,U+6c7a-6c7c,U+6c7f-6c80,U+6c84,U+6c87,U+6c8a-6c8b,U+6c8d-6c8e,U+6c91-6c92,U+6c95-6c98,U+6c9a,U+6c9c-6c9e,U+6ca0,U+6ca2,U+6ca8,U+6cac,U+6caf-6cb0,U+6cb4-6cb7,U+6cba,U+6cc0-6cc3,U+6cc6-6cc8,U+6ccb,U+6ccd-6ccf,U+6cd1-6cd2,U+6cd8-6cda,U+6cdc-6cdd,U+6cdf,U+6ce4,U+6ce6-6ce7,U+6ce9,U+6cec-6ced,U+6cf2,U+6cf4,U+6cf9,U+6cff-6d00,U+6d02-6d03,U+6d05-6d06,U+6d08-6d0a,U+6d0d,U+6d0f-6d11,U+6d13-6d16,U+6d18,U+6d1c-6d1d,U+6d1f-6d24,U+6d26,U+6d28-6d29,U+6d2c-6d2d,U+6d2f-6d30,U+6d34,U+6d36-6d38,U+6d3a,U+6d3f-6d40,U+6d42,U+6d44,U+6d49,U+6d4c,U+6d50,U+6d55-6d58,U+6d5b,U+6d5d,U+6d5f,U+6d61-6d62,U+6d64-6d65,U+6d67-6d68,U+6d6b-6d6d,U+6d70-6d72" } }, { uri: jl, descriptors: { unicodeRange: "U+6967-696a,U+696c-696d,U+696f-6970,U+6972-6976,U+697a-697b,U+697d-697f,U+6981,U+6983,U+6985,U+698a-698c,U+698e-6993,U+6996-6997,U+6999-699a,U+699d-69a6,U+69a9-69aa,U+69ac,U+69ae-69b0,U+69b2-69b3,U+69b5-69b6,U+69b8-69ba,U+69bc-69c0,U+69c2-69c9,U+69cb,U+69cd,U+69cf,U+69d1-69d3,U+69d5-69da,U+69dc-69de,U+69e1-69ec,U+69ee-69f1,U+69f3-69fc,U+69fe,U+6a00-6a09,U+6a0b-6a16,U+6a19-6a1e,U+6a20,U+6a22-6a27,U+6a29,U+6a2b-6a2e,U+6a30,U+6a32-6a34,U+6a36-6a3c,U+6a3f-6a43,U+6a45-6a46,U+6a48-6a4a" } }, { uri: eU, descriptors: { unicodeRange: "U+6830-6831,U+6834-6836,U+683a-683b,U+683f,U+6847,U+684b,U+684d,U+684f,U+6852,U+6856-685f,U+686a,U+686c-6873,U+6875,U+6878-6880,U+6882,U+6884,U+6887-688e,U+6890-6892,U+6894-6896,U+6898-68a1,U+68a3-68a5,U+68a9-68ac,U+68ae,U+68b1-68b2,U+68b4,U+68b6-68bf,U+68c1,U+68c3-68c8,U+68ca,U+68cc,U+68ce-68d1,U+68d3-68d4,U+68d6-68d7,U+68d9,U+68db-68df,U+68e1-68e2,U+68e4-68ed,U+68ef,U+68f2-68f4,U+68f6-68f8,U+68fb,U+68fd-6900,U+6902-6904,U+6906-690a,U+690c,U+690f,U+6911,U+6913-691e,U+6921-6923,U+6925-692c,U+692e-692f,U+6931-6933,U+6935-6938,U+693a-693c,U+693e,U+6940-6941,U+6943-6953,U+6955-6956,U+6958-6959,U+695b-695c,U+695f,U+6961-6962,U+6964-6965" } }, { uri: tU, descriptors: { unicodeRange: "U+66b8,U+66ba-66bd,U+66bf-66d8,U+66da,U+66de-66e5,U+66e7-66e8,U+66ea-66ef,U+66f1,U+66f5-66f6,U+66f8,U+66fa-66fb,U+66fd,U+6701-6707,U+670c,U+670e-670f,U+6711-6713,U+6716,U+6718-671a,U+671c,U+671e,U+6720-6725,U+6727,U+6729,U+672e,U+6730,U+6732-6733,U+6736-6739,U+673b-673c,U+673e-673f,U+6741,U+6744-6745,U+6747,U+674a-674b,U+674d,U+6752,U+6754-6755,U+6757-675b,U+675d,U+6762-6764,U+6766-6767,U+676b-676c,U+676e,U+6771,U+6774,U+6776,U+6778-677b,U+677d,U+6780,U+6782-6783,U+6785-6786,U+6788,U+678a,U+678c-678f,U+6791-6794,U+6796,U+6799,U+679b,U+679f-67a1,U+67a4,U+67a6,U+67a9,U+67ac,U+67ae,U+67b1-67b2,U+67b4,U+67b9-67c0,U+67c2,U+67c5-67ce,U+67d5-67d7,U+67db,U+67df,U+67e1,U+67e3-67e4,U+67e6-67e8,U+67ea-67eb,U+67ed-67ee,U+67f2,U+67f5-67fc,U+67fe,U+6801-6804,U+6806,U+680d,U+6810,U+6812,U+6814-6815,U+6818-681c,U+681e-6820,U+6822-6828,U+682b-682f" } }, { uri: nU, descriptors: { unicodeRange: "U+6569-656a,U+656d-656f,U+6571,U+6573,U+6575-6576,U+6578-6586,U+6588-658a,U+658d-658f,U+6592,U+6594-6596,U+6598,U+659a,U+659d-659e,U+65a0,U+65a2-65a3,U+65a6,U+65a8,U+65aa,U+65ac,U+65ae,U+65b1-65b8,U+65ba-65bb,U+65be-65c0,U+65c2,U+65c7-65ca,U+65cd,U+65d0-65d1,U+65d3-65d5,U+65d8-65df,U+65e1,U+65e3-65e4,U+65ea-65eb,U+65f2-65f5,U+65f8-65f9,U+65fb-65ff,U+6601,U+6604-6605,U+6607-6609,U+660b,U+660d,U+6610-6612,U+6616-6618,U+661a-661c,U+661e,U+6621-6624,U+6626,U+6629-662c,U+662e,U+6630,U+6632-6633,U+6637-663b,U+663d,U+663f-6640,U+6642,U+6644-664a,U+664d-664e,U+6650-6651,U+6658-6659,U+665b-665e,U+6660,U+6662-6663,U+6665,U+6667,U+6669-666d,U+6671-6673,U+6675,U+6678-6679,U+667b-667d,U+667f-6681,U+6683,U+6685-6686,U+6688-668b,U+668d-6690,U+6692-6695,U+6698-669c,U+669e-66a6,U+66a9-66ad,U+66af-66b3,U+66b5-66b7" } }, { uri: rU, descriptors: { unicodeRange: "U+5f30,U+5f32-5f38,U+5f3b,U+5f3d-5f3f,U+5f41-5f4f,U+5f51,U+5f54,U+5f59-5f5c,U+5f5e-5f60,U+5f63,U+5f65,U+5f67-5f68,U+5f6b,U+5f6e-5f6f,U+5f72,U+5f74-5f76,U+5f78,U+5f7a,U+5f7d-5f7f,U+5f83,U+5f86,U+5f8d-5f8f,U+5f91,U+5f93-5f94,U+5f96,U+5f9a-5f9b,U+5f9d-5fa0,U+5fa2-5fa7,U+5fa9,U+5fab-5fac,U+5faf-5fb4,U+5fb6,U+5fb8-5fbb,U+5fbe-5fc2,U+5fc7-5fc8,U+5fca-5fcb,U+5fce,U+5fd3-5fd5,U+5fda-5fdc,U+5fde-5fdf,U+5fe2-5fe3,U+5fe5-5fe6,U+5fe8-5fe9,U+5fec,U+5fef-5ff0,U+5ff2-5ff4,U+5ff6-5ff7,U+5ff9-5ffa,U+5ffc,U+6007-6009,U+600b-600c,U+6010-6011,U+6013,U+6017-6018,U+601a,U+601e-601f,U+6022-6024,U+602c-602e,U+6030-6034,U+6036-603a,U+603d-603e,U+6040,U+6044-604a,U+604c,U+604e-604f,U+6051,U+6053-6054,U+6056-6058,U+605b-605c,U+605e-6061,U+6065-6066,U+606e,U+6071-6072,U+6074-6075,U+6077,U+607e,U+6080-6082,U+6085-6088,U+608a-608b,U+608e-6091,U+6093,U+6095,U+6097-6099,U+609c,U+609e,U+60a1-60a2,U+60a4-60a5,U+60a7,U+60a9-60aa,U+60ae,U+60b0,U+60b3,U+60b5-60b7,U+60b9-60ba,U+60bd-60c4,U+60c7-60c9,U+60cc" } }, { uri: oU, descriptors: { unicodeRange: "U+635a-635d,U+6360,U+6364-6366,U+6368,U+636a-636c,U+636f-6370,U+6372-6375,U+6378-6379,U+637c-637f,U+6381,U+6383-6386,U+638b,U+638d,U+6391,U+6393-6395,U+6397,U+6399-639f,U+63a1,U+63a4,U+63a6,U+63ab,U+63af,U+63b1-63b2,U+63b5-63b6,U+63b9,U+63bb,U+63bd,U+63bf-63c3,U+63c5,U+63c7-63c8,U+63ca-63cc,U+63d1,U+63d3-63d5,U+63d7-63dd,U+63df,U+63e2,U+63e4-63e8,U+63eb-63ec,U+63ee-63f1,U+63f3,U+63f5,U+63f7,U+63f9-63fc,U+63fe,U+6403-6404,U+6406-640a,U+640d-640e,U+6411-6412,U+6415-641a,U+641d,U+641f,U+6422-6425,U+6427-6429,U+642b,U+642e-6433,U+6435-6439,U+643b-643c,U+643e,U+6440,U+6442-6443,U+6449,U+644b-6451,U+6453,U+6455-6457,U+6459-645d,U+645f-6466,U+6468,U+646a-646c,U+646e-6477,U+647b-6481,U+6483,U+6486,U+6488-648f" } }, { uri: iU, descriptors: { unicodeRange: "U+61c5-61c7,U+61c9,U+61cc-61d0,U+61d3,U+61d5-61e5,U+61e7-61f4,U+61f6-61fe,U+6200-6205,U+6207,U+6209,U+6213-6214,U+6219,U+621c-621e,U+6220,U+6223,U+6226-6229,U+622b,U+622d,U+622f-6232,U+6235-6236,U+6238-623c,U+6242,U+6244-6246,U+624a,U+624f-6250,U+6255-6257,U+6259-625a,U+625c-6262,U+6264-6265,U+6268,U+6271-6272,U+6274-6275,U+6277-6278,U+627a-627b,U+627d,U+6281-6283,U+6285-6288,U+628b-6290,U+6294,U+6299,U+629c-629e,U+62a3,U+62a6-62a7,U+62a9-62aa,U+62ad-62b0,U+62b2-62b4,U+62b6-62b8,U+62ba,U+62be,U+62c0-62c1,U+62c3,U+62cb,U+62cf,U+62d1,U+62d5,U+62dd-62de,U+62e0-62e1,U+62e4,U+62ea-62eb,U+62f0,U+62f2,U+62f5,U+62f8-62fb,U+6300,U+6303-6306,U+630a-630d,U+630f-6310,U+6312-6315,U+6317-6319,U+631c,U+6326-6327,U+6329,U+632c-632e,U+6330-6331,U+6333-6338,U+633b-633c,U+633e-6341,U+6344,U+6347-6348,U+634a,U+6351-6354,U+6356-6359" } }, { uri: aU, descriptors: { unicodeRange: "U+5dd0-5dda,U+5ddc,U+5ddf-5de0,U+5de3-5de4,U+5dea,U+5dec-5ded,U+5df0,U+5df5-5df6,U+5df8-5dfc,U+5dff-5e00,U+5e04,U+5e07,U+5e09-5e0b,U+5e0d-5e0e,U+5e12-5e13,U+5e17,U+5e1e-5e25,U+5e28-5e2c,U+5e2f-5e30,U+5e32-5e36,U+5e39-5e3a,U+5e3e-5e41,U+5e43,U+5e46-5e4b,U+5e4d-5e53,U+5e56-5e5a,U+5e5c-5e5d,U+5e5f-5e60,U+5e63-5e71,U+5e75,U+5e77,U+5e79,U+5e7e,U+5e81-5e83,U+5e85,U+5e88-5e89,U+5e8c-5e8e,U+5e92,U+5e98,U+5e9b,U+5e9d,U+5ea1-5ea4,U+5ea8-5eac,U+5eae-5eb2,U+5eb4,U+5eba-5ebd,U+5ebf-5ec8,U+5ecb-5ed0,U+5ed4-5ed5,U+5ed7-5eda,U+5edc-5ee7,U+5ee9,U+5eeb-5ef3,U+5ef5,U+5ef8-5ef9,U+5efb-5efd,U+5f05-5f07,U+5f09,U+5f0c-5f0e,U+5f10,U+5f12,U+5f14,U+5f16,U+5f19-5f1a,U+5f1c-5f1e,U+5f21-5f24,U+5f28,U+5f2b-5f2c,U+5f2e" } }, { uri: sU, descriptors: { unicodeRange: "U+60cd-60d0,U+60d2-60d4,U+60d6-60d7,U+60d9,U+60db,U+60de,U+60e1-60e5,U+60ea,U+60f1-60f2,U+60f5,U+60f7-60f8,U+60fb-60ff,U+6102-6105,U+6107,U+610a-610c,U+6110-6114,U+6116-6119,U+611b-611e,U+6121-6122,U+6125,U+6128-612a,U+612c-613e,U+6140-6147,U+6149,U+614b,U+614d,U+614f-6150,U+6152-6154,U+6156-615c,U+615e-6161,U+6163-6166,U+6169-616f,U+6171-6174,U+6176,U+6178-618a,U+618c-618d,U+618f-6193,U+6195-619c,U+619e-61a6,U+61aa-61ab,U+61ad-61b6,U+61b8-61bd,U+61bf-61c1,U+61c3-61c4" } }, { uri: dU, descriptors: { unicodeRange: "U+5cf4-5cfa,U+5cfc-5d01,U+5d04-5d05,U+5d08-5d0d,U+5d0f-5d13,U+5d15,U+5d17-5d1a,U+5d1c-5d1d,U+5d1f-5d23,U+5d25,U+5d28,U+5d2a-5d2c,U+5d2f-5d33,U+5d35-5d3c,U+5d3f-5d46,U+5d48-5d49,U+5d4d-5d57,U+5d59-5d5a,U+5d5c,U+5d5e-5d68,U+5d6a,U+5d6d-5d6e,U+5d70-5d73,U+5d75-5d81,U+5d83-5d98,U+5d9a-5d9c,U+5d9e-5db6,U+5db8-5dc4,U+5dc6-5dcc,U+5dce-5dcf" } }, { uri: cU, descriptors: { unicodeRange: "U+5b52,U+5b56,U+5b5e,U+5b60-5b61,U+5b67-5b68,U+5b6b,U+5b6d-5b6f,U+5b72,U+5b74,U+5b76-5b79,U+5b7b-5b7c,U+5b7e-5b7f,U+5b82,U+5b86,U+5b8a,U+5b8d-5b8e,U+5b90-5b92,U+5b94,U+5b96,U+5b9f,U+5ba7-5ba9,U+5bac-5baf,U+5bb1-5bb2,U+5bb7,U+5bba-5bbc,U+5bc0-5bc1,U+5bc3,U+5bc8-5bcb,U+5bcd-5bcf,U+5bd1,U+5bd4-5bdc,U+5be0,U+5be2-5be3,U+5be6-5be7,U+5be9-5bed,U+5bef,U+5bf1-5bf7,U+5bfd-5bfe,U+5c00,U+5c02-5c03,U+5c05,U+5c07-5c08,U+5c0b-5c0e,U+5c10,U+5c12-5c13,U+5c17,U+5c19,U+5c1b,U+5c1e-5c21,U+5c23,U+5c26,U+5c28-5c2b,U+5c2d-5c30,U+5c32-5c33,U+5c35-5c37,U+5c43-5c44,U+5c46-5c47,U+5c4c-5c4d,U+5c52-5c54,U+5c56-5c58,U+5c5a-5c5d,U+5c5f,U+5c62,U+5c64,U+5c67-5c6d,U+5c70,U+5c72-5c78,U+5c7b-5c7e,U+5c80,U+5c83-5c87,U+5c89-5c8b,U+5c8e-5c8f,U+5c92-5c93,U+5c95,U+5c9d-5ca1,U+5ca4-5ca8,U+5caa,U+5cae-5cb0,U+5cb2,U+5cb4,U+5cb6,U+5cb9-5cbc,U+5cbe,U+5cc0,U+5cc2-5cc3,U+5cc5-5cca,U+5ccc-5cd1,U+5cd3-5cd8,U+5cda-5ce0,U+5ce2-5ce3,U+5ce7,U+5ce9,U+5ceb-5cec,U+5cee-5cef,U+5cf1-5cf3" } }, { uri: lU, descriptors: { unicodeRange: "U+593b,U+593d-5940,U+5943,U+5945-5946,U+594a,U+594c-594d,U+5950,U+5952-5953,U+5959,U+595b-595f,U+5961,U+5963-5964,U+5966-5972,U+5975,U+5977,U+597a-597c,U+597e-5980,U+5985,U+5989,U+598b-598c,U+598e-5991,U+5994-5995,U+5998,U+599a-599d,U+599f-59a2,U+59a6-59a7,U+59ac-59ad,U+59b0-59b1,U+59b3-59b8,U+59ba,U+59bc-59bd,U+59bf-59c5,U+59c7-59c9,U+59cc-59cf,U+59d5-59d6,U+59d9,U+59db,U+59de-59e2,U+59e4,U+59e6-59e7,U+59e9-59eb,U+59ed-59f8,U+59fa,U+59fc-59fe,U+5a00,U+5a02,U+5a0a-5a0b,U+5a0d-5a10,U+5a12,U+5a14-5a17,U+5a19-5a1b,U+5a1d-5a1e,U+5a21-5a22,U+5a24,U+5a26-5a28,U+5a2a-5a30,U+5a33,U+5a35,U+5a37-5a3b,U+5a3d-5a3f,U+5a41-5a45,U+5a47-5a48,U+5a4b-5a54,U+5a56-5a59,U+5a5b-5a61,U+5a63-5a66,U+5a68-5a69,U+5a6b-5a73,U+5a78-5a79,U+5a7b-5a7e,U+5a80-5a90" } }, { uri: UU, descriptors: { unicodeRange: "U+5a91,U+5a93-5a99,U+5a9c-5aa9,U+5aab-5ab1,U+5ab4,U+5ab6-5ab7,U+5ab9-5abd,U+5abf-5ac0,U+5ac3-5ac8,U+5aca-5acb,U+5acd-5ad1,U+5ad3,U+5ad5,U+5ad7,U+5ad9-5adb,U+5add-5adf,U+5ae2,U+5ae4-5ae5,U+5ae7-5ae8,U+5aea,U+5aec-5af0,U+5af2-5b08,U+5b0a-5b15,U+5b18-5b31,U+5b33,U+5b35-5b36,U+5b38-5b3f,U+5b41-5b4f" } }, { uri: fU, descriptors: { unicodeRange: "U+5843,U+5845-584b,U+584e-5850,U+5852-5853,U+5855-5857,U+5859-585d,U+585f-5864,U+5866-586a,U+586d-587d,U+587f,U+5882,U+5884,U+5886-5888,U+588a-5891,U+5894-5898,U+589b-589d,U+58a0-58a7,U+58aa-58bb,U+58bd-58c0,U+58c2-58c4,U+58c6-58d0,U+58d2-58d4,U+58d6-58e3,U+58e5-58ea,U+58ed,U+58ef,U+58f1-58f2,U+58f4-58f5,U+58f7-58f8,U+58fa-5901,U+5903,U+5905-5906,U+5908-590c,U+590e,U+5910-5913,U+5917-5918,U+591b,U+591d-591e,U+5920-5923,U+5926,U+5928,U+592c,U+5930,U+5932-5933,U+5935-5936" } }, { uri: pU, descriptors: { unicodeRange: "U+56d0-56d3,U+56d5-56d6,U+56d8-56d9,U+56dc,U+56e3,U+56e5-56ea,U+56ec,U+56ee-56ef,U+56f2-56f3,U+56f6-56f8,U+56fb-56fc,U+5700-5702,U+5705,U+5707,U+570b-571b,U+571d-571e,U+5720-5722,U+5724-5727,U+572b,U+5731-5732,U+5734-5738,U+573c-573d,U+573f,U+5741,U+5743-5746,U+5748-5749,U+574b,U+5752-5756,U+5758-5759,U+5762-5763,U+5765,U+5767,U+576c,U+576e,U+5770-5772,U+5774-5775,U+5778-577a,U+577d-5781,U+5787-578a,U+578d-5791,U+5794-579a,U+579c-579f,U+57a5,U+57a8,U+57aa,U+57ac,U+57af-57b1,U+57b3,U+57b5-57b7,U+57b9-57c1,U+57c4-57ca,U+57cc-57cd,U+57d0-57d1,U+57d3,U+57d6-57d7,U+57db-57dc,U+57de,U+57e1-57e3,U+57e5-57ec,U+57ee,U+57f0-57f3,U+57f5-57f7,U+57fb-57fc,U+57fe-57ff,U+5801,U+5803-5805,U+5808-580a,U+580c,U+580e-5810,U+5812-5814,U+5816-5818,U+581a-581d,U+581f,U+5822-5823,U+5825-5829,U+582b-582f,U+5831-5834,U+5836-5842" } }, { uri: uU, descriptors: { unicodeRange: "U+55f9-55fc,U+55ff,U+5602-5607,U+560a-560b,U+560d,U+5610-5617,U+5619-561a,U+561c-561d,U+5620-5622,U+5625-5626,U+5628-562b,U+562e-5630,U+5633,U+5635,U+5637-5638,U+563a,U+563c-563e,U+5640-564b,U+564f-5653,U+5655-5656,U+565a-565b,U+565d-5661,U+5663,U+5665-5667,U+566d-5670,U+5672-5675,U+5677-567a,U+567d-5684,U+5687-568d,U+5690-5692,U+5694-56a2,U+56a4-56ae,U+56b0-56b6,U+56b8-56bb,U+56bd-56c9,U+56cb-56cf" } }, { uri: mU, descriptors: { unicodeRange: "U+5286-5287,U+5289-528f,U+5291-5292,U+5294-529a,U+529c,U+52a4-52a7,U+52ae-52b0,U+52b4-52bd,U+52c0-52c2,U+52c4-52c6,U+52c8,U+52ca,U+52cc-52cf,U+52d1,U+52d3-52d5,U+52d7,U+52d9-52de,U+52e0-52e3,U+52e5-52ef,U+52f1-52f8,U+52fb-52fd,U+5301-5304,U+5307,U+5309-530c,U+530e,U+5311-5314,U+5318,U+531b-531c,U+531e-531f,U+5322,U+5324-5325,U+5327-5329,U+532b-532d,U+532f-5338,U+533c-533d,U+5340,U+5342,U+5344,U+5346,U+534b-534d,U+5350,U+5354,U+5358-5359,U+535b,U+535d,U+5365,U+5368,U+536a,U+536c-536d,U+5372,U+5376,U+5379,U+537b-537e,U+5380-5381,U+5383,U+5387-5388,U+538a,U+538e-5394,U+5396-5397,U+5399,U+539b-539c,U+539e,U+53a0-53a1,U+53a4,U+53a7,U+53aa-53ad,U+53af-53b5,U+53b7-53ba,U+53bc-53be,U+53c0,U+53c3-53c7,U+53ce-53d0,U+53d2-53d3,U+53d5,U+53da,U+53dc-53de,U+53e1-53e2,U+53e7,U+53f4,U+53fa,U+53fe-5400,U+5402,U+5405,U+5407,U+540b,U+5414,U+5418-541a,U+541c,U+5422,U+5424-5425,U+542a,U+5430,U+5433,U+5436-5437,U+543a" } }, { uri: bU, descriptors: { unicodeRange: "U+5101-5105,U+5108-510a,U+510c-5111,U+5113-5120,U+5122-513e,U+5142,U+5147,U+514a,U+514c,U+514e-5150,U+5152-5153,U+5157-5159,U+515b,U+515d-5161,U+5163-5164,U+5166-5167,U+5169-516a,U+516f,U+5172,U+517a,U+517e-517f,U+5183-5184,U+5186-5187,U+518a-518b,U+518e-5191,U+5193-5194,U+5198,U+519a,U+519d-519f,U+51a1,U+51a3,U+51a6-51aa,U+51ad-51ae,U+51b4,U+51b8-51ba,U+51be-51bf,U+51c1-51c3,U+51c5,U+51c8,U+51ca,U+51cd-51ce,U+51d0,U+51d2-51da,U+51dc,U+51de-51df,U+51e2-51e3,U+51e5-51ea,U+51ec,U+51ee,U+51f1-51f2,U+51f4,U+51f7,U+51fe,U+5204-5205,U+5209,U+520b-520c,U+520f-5210,U+5213-5215,U+521c,U+521e-521f,U+5221-5223,U+5225-5227,U+522a,U+522c,U+522f,U+5231-5232,U+5234-5235,U+523c,U+523e,U+5244-5249,U+524b,U+524e-524f,U+5252-5253,U+5255,U+5257-525b,U+525d,U+525f-5260,U+5262-5264,U+5266,U+5268,U+526b-526e,U+5270-5271,U+5273-527c,U+527e,U+5280,U+5283-5285" } }, { uri: EU, descriptors: { unicodeRange: "U+543d,U+543f,U+5441-5442,U+5444-5445,U+5447,U+5449,U+544c-544f,U+5451,U+545a,U+545d-5461,U+5463,U+5465,U+5467,U+5469-5470,U+5474,U+5479-547a,U+547e-547f,U+5481,U+5483,U+5485,U+5487-548a,U+548d,U+5491,U+5493,U+5497-5498,U+549c,U+549e-54a2,U+54a5,U+54ae,U+54b0,U+54b2,U+54b5-54b7,U+54b9-54ba,U+54bc,U+54be,U+54c3,U+54c5,U+54ca-54cb,U+54d6,U+54d8,U+54db,U+54e0-54e4,U+54eb-54ec,U+54ef-54f1,U+54f4-54f9,U+54fb,U+54fe,U+5500,U+5502-5505,U+5508,U+550a-550e,U+5512-5513,U+5515-551a,U+551c-551f,U+5521,U+5525-5526,U+5528-5529,U+552b,U+552d,U+5532,U+5534-5536,U+5538-553b,U+553d,U+5540,U+5542,U+5545,U+5547-5548,U+554b-554f,U+5551-5554,U+5557-555b,U+555d-5560,U+5562-5563,U+5568-5569,U+556b,U+556f-5574,U+5579-557a,U+557d,U+557f,U+5585-5586,U+558c-558e,U+5590,U+5592-5593,U+5595-5597,U+559a-559b,U+559e,U+55a0-55a6,U+55a8-55b0,U+55b2,U+55b4,U+55b6,U+55b8,U+55ba,U+55bc,U+55bf-55c3,U+55c6-55c8,U+55ca-55cb,U+55ce-55d0,U+55d5,U+55d7-55db,U+55de,U+55e0,U+55e2,U+55e7,U+55e9,U+55ed-55ee,U+55f0-55f1,U+55f4,U+55f6,U+55f8" } }, { uri: gU, descriptors: { unicodeRange: "U+4fe0,U+4fe2,U+4fe4-4fe5,U+4fe7,U+4feb-4fec,U+4ff0,U+4ff2,U+4ff4-4ff7,U+4ff9,U+4ffb-4ffd,U+4fff-500b,U+500e,U+5010-5011,U+5013,U+5015-5017,U+501b,U+501d-501e,U+5020,U+5022-5024,U+5027,U+502b,U+502f-5039,U+503b,U+503d,U+503f-5042,U+5044-5046,U+5049-504b,U+504d,U+5050-5054,U+5056-5059,U+505b,U+505d-5064,U+5066-506b,U+506d-5075,U+5078-507a,U+507c-507d,U+5081-5084,U+5086-5087,U+5089-508c,U+508e-50a2,U+50a4,U+50a6,U+50aa-50ab,U+50ad-50b1,U+50b3-50b9,U+50bc-50ce,U+50d0-50d5,U+50d7-50d9,U+50db-50e5,U+50e8-50eb,U+50ef-50f2,U+50f4,U+50f6-50fa,U+50fc-5100" } }, { uri: xU, descriptors: { unicodeRange: "U+49d5-4a77" } }, { uri: hU, descriptors: { unicodeRange: "U+4dac-4dad,U+4daf-4db5,U+4e02,U+4e04-4e06,U+4e0f,U+4e12,U+4e17,U+4e1f-4e21,U+4e23,U+4e26,U+4e29,U+4e2e-4e2f,U+4e31,U+4e33,U+4e35,U+4e37,U+4e3c,U+4e40-4e42,U+4e44,U+4e46,U+4e4a,U+4e51,U+4e55,U+4e57,U+4e5a-4e5b,U+4e62-4e65,U+4e67-4e68,U+4e6a-4e6f,U+4e72,U+4e74-4e7d,U+4e7f-4e85,U+4e87,U+4e8a,U+4e90,U+4e96-4e97,U+4e99,U+4e9c-4e9e,U+4ea3,U+4eaa,U+4eaf-4eb1,U+4eb4,U+4eb6-4eb9,U+4ebc-4ebe,U+4ec8,U+4ecc,U+4ecf-4ed0,U+4ed2,U+4eda-4edc,U+4ee0,U+4ee2,U+4ee6-4ee7,U+4ee9,U+4eed-4eef,U+4ef1,U+4ef4,U+4ef8-4efa,U+4efc,U+4efe,U+4f00,U+4f02-4f08,U+4f0b-4f0c,U+4f12-4f16,U+4f1c-4f1d,U+4f21,U+4f23,U+4f28-4f29,U+4f2c-4f2e,U+4f31,U+4f33,U+4f35,U+4f37,U+4f39,U+4f3b,U+4f3e-4f42,U+4f44-4f45,U+4f47-4f4c,U+4f52,U+4f54,U+4f56,U+4f61-4f62,U+4f66,U+4f68,U+4f6a-4f6b,U+4f6d-4f6e,U+4f71-4f72,U+4f75,U+4f77-4f7a,U+4f7d,U+4f80-4f82,U+4f85-4f87,U+4f8a,U+4f8c,U+4f8e,U+4f90,U+4f92-4f93,U+4f95-4f96,U+4f98-4f9a,U+4f9c,U+4f9e-4f9f,U+4fa1-4fa2,U+4fa4,U+4fab,U+4fad,U+4fb0-4fb4,U+4fb6-4fbe,U+4fc0-4fc2,U+4fc6-4fc9,U+4fcb-4fcd,U+4fd2-4fd6,U+4fd9,U+4fdb" } }, { uri: yU, descriptors: { unicodeRange: "U+4933-49d4" } }, { uri: IU, descriptors: { unicodeRange: "U+487a-4932" } }, { uri: wU, descriptors: { unicodeRange: "U+47d2-4879,U+2ce7c,U+2ce88,U+2ce93" } }, { uri: RU, descriptors: { unicodeRange: "U+4756-47d1,U+2ca02,U+2ca0e,U+2ca7d,U+2caa9,U+2cb29,U+2cb2e,U+2cb31,U+2cb38-2cb39,U+2cb3f,U+2cb41,U+2cb4e,U+2cb5a,U+2cb64,U+2cb69,U+2cb6c,U+2cb6f,U+2cb76,U+2cb78,U+2cb7c,U+2cbb1,U+2cbbf-2cbc0,U+2cbce,U+2cc5f,U+2ccf5-2ccf6,U+2ccfd,U+2ccff,U+2cd02-2cd03,U+2cd0a,U+2cd8b,U+2cd8d,U+2cd8f-2cd90,U+2cd9f-2cda0,U+2cda8,U+2cdad-2cdae,U+2cdd5,U+2ce18,U+2ce1a,U+2ce23,U+2ce26,U+2ce2a" } }, { uri: TU, descriptors: { unicodeRange: "U+46c3-4755,U+2c488,U+2c494,U+2c497,U+2c542,U+2c613,U+2c618,U+2c621,U+2c629,U+2c62b-2c62d,U+2c62f,U+2c642,U+2c64a-2c64b,U+2c72c,U+2c72f,U+2c79f,U+2c7c1,U+2c7fd,U+2c8d9,U+2c8de,U+2c8e1,U+2c8f3,U+2c907,U+2c90a,U+2c91d" } }, { uri: MU, descriptors: { unicodeRange: "U+4629-46c2,U+2bdf7,U+2be29,U+2c029-2c02a,U+2c0a9,U+2c0ca,U+2c1d5,U+2c1d9,U+2c1f9,U+2c27c,U+2c288,U+2c2a4,U+2c317,U+2c35b,U+2c361,U+2c364" } }, { uri: LU, descriptors: { unicodeRange: "U+458e-4628,U+2b7a9,U+2b7c5,U+2b7e6,U+2b7f9,U+2b806,U+2b80a,U+2b81c,U+2b8b8,U+2bac7,U+2bb5f,U+2bb62,U+2bb7c,U+2bb83,U+2bc1b,U+2bd77,U+2bd87" } }, { uri: DU, descriptors: { unicodeRange: "U+4449-4511,U+2afa2,U+2b127-2b128,U+2b137-2b138,U+2b1ed" } }, { uri: SU, descriptors: { unicodeRange: "U+439b-4448,U+2a437,U+2a5f1,U+2a602,U+2a61a,U+2a6b2,U+2a7dd,U+2a8fb,U+2a917,U+2aa30,U+2aa36,U+2aa58" } }, { uri: vU, descriptors: { unicodeRange: "U+4275-430d,U+298c6,U+29a72,U+29d98,U+29ddb,U+29e15,U+29e3d,U+29e49" } }, { uri: $U, descriptors: { unicodeRange: "U+4132-41de,U+28bef,U+28c47,U+28c4f,U+28c51,U+28c54,U+28d10,U+28d71,U+28dfb,U+28e1f,U+28e36,U+28e89,U+28e99,U+28eeb,U+28f32,U+28ff8,U+292a0" } }, { uri: PU, descriptors: { unicodeRange: "U+41df-4274,U+292b1,U+29490,U+295cf,U+2967f,U+296f0,U+29719,U+29750" } }, { uri: NU, descriptors: { unicodeRange: "U+408e-4131,U+285c8-285c9,U+28678,U+28695,U+286d7,U+286fa,U+287e0,U+28946,U+28949,U+2896b,U+28987-28988,U+289ba-289bb,U+28a1e,U+28a29,U+28a43,U+28a71,U+28a99,U+28acd,U+28add,U+28ae4,U+28b49,U+28bc1" } }, { uri: FU, descriptors: { unicodeRange: "U+3e83-3f2f,U+27139,U+273da-273db,U+273fe,U+27410,U+27449,U+27614-27615,U+27631,U+27684,U+27693,U+2770e,U+27723,U+27752" } }, { uri: BU, descriptors: { unicodeRange: "U+3f30-3fdb,U+27985,U+27a84,U+27bb3,U+27bbe,U+27bc7,U+27cb8,U+27da0,U+27e10" } }, { uri: _U, descriptors: { unicodeRange: "U+3fdc-408d,U+27fb7,U+27ff9,U+2808a,U+280bb,U+2815d,U+28277,U+28282,U+282e2,U+282f3,U+283cd,U+28408,U+2840c,U+28455,U+28468,U+2856b" } }, { uri: OU, descriptors: { unicodeRange: "U+3dd2-3e82,U+26a58,U+26a8c,U+26ab7,U+26aff,U+26b5c,U+26c21,U+26c29,U+26c73,U+26cdd,U+26e40,U+26e65,U+26f94,U+26ff6-26ff8,U+270f4,U+2710d" } }, { uri: AU, descriptors: { unicodeRange: "U+3d34-3dd1,U+2648d,U+26676,U+2667e,U+266b0,U+2671d,U+2677c,U+267cc,U+268dd,U+268ea,U+26951,U+2696f,U+269dd,U+269fa,U+26a1e" } }, { uri: KU, descriptors: { unicodeRange: "U+3c76-3d33,U+25d0a,U+25da1,U+25e2e,U+25e56,U+25e62,U+25e65,U+25ec2,U+25ed7-25ed8,U+25ee8,U+25f23,U+25f5c,U+25fd4,U+25fe0,U+25ffb,U+2600c,U+26017,U+26060,U+260ed,U+26221,U+26270,U+26286,U+2634c,U+26402" } }, { uri: HU, descriptors: { unicodeRange: "U+3bda-3c75,U+25771,U+257a9,U+257b4,U+259c4,U+259d4,U+25ae3-25ae4,U+25af1,U+25bb2,U+25c14,U+25c4b,U+25c64" } }, { uri: JU, descriptors: { unicodeRange: "U+3b25-3bd9,U+2504a,U+25055,U+25122,U+2512b,U+251a9,U+251cd,U+251e5,U+2521e,U+2524c,U+2542e,U+2548e,U+254d9,U+2550e,U+25532,U+25562,U+255a7-255a8" } }, { uri: YU, descriptors: { unicodeRange: "U+3a6b-3b24,U+24896,U+249db,U+24a4d,U+24a7d,U+24ac9,U+24b56,U+24b6f,U+24c16,U+24d14,U+24dea,U+24e0e,U+24e37,U+24e6a,U+24e8b,U+24eaa" } }, { uri: CU, descriptors: { unicodeRange: "U+39a9-3a6a,U+24096,U+24103,U+241ac,U+241c6,U+241fe,U+243bc,U+243f8,U+244d3,U+24629,U+246a5,U+247f1" } }, { uri: VU, descriptors: { unicodeRange: "U+38e3-39a8,U+23a98,U+23c7f,U+23c97-23c98,U+23cfe,U+23d00,U+23d0e,U+23d40,U+23dd3,U+23df9-23dfa,U+23e23,U+23f7e" } }, { uri: qU, descriptors: { unicodeRange: "U+3760-382a,U+22ab8,U+22b43,U+22b46,U+22b4f-22b50,U+22ba6,U+22bca,U+22c1d,U+22c24,U+22c55,U+22d4c,U+22de1" } }, { uri: XU, descriptors: { unicodeRange: "U+382b-38e2,U+231b6,U+231c3-231c4,U+231f5,U+23350,U+23372,U+233d0,U+233d2-233d3,U+233d5,U+233da,U+233df,U+233e4,U+2344a-2344b,U+23451,U+23465,U+234e4,U+2355a,U+23594,U+235c4,U+235cb,U+23638-2363a,U+23647,U+2370c,U+2371c,U+2373f,U+23763-23764,U+237e7,U+237ff,U+23824,U+2383d" } }, { uri: GU, descriptors: { unicodeRange: "U+3698-375f,U+22218,U+2231e,U+223ad,U+224dc,U+226f3,U+2285b,U+228ab,U+2298f" } }, { uri: kU, descriptors: { unicodeRange: "U+35e6-3697,U+21c56,U+21cde,U+21d2d,U+21d45,U+21d62,U+21d78,U+21d92,U+21d9c,U+21da1,U+21db7,U+21de0,U+21e33-21e34,U+21f1e,U+21f76,U+21ffa,U+2217b" } }, { uri: ZU, descriptors: { unicodeRange: "U+3444-350e,U+20ad3,U+20b1d,U+20b9f,U+20c41,U+20cbf,U+20cd0,U+20d45,U+20de1,U+20e64,U+20e6d,U+20e95,U+20e9d,U+20ea2,U+20f5f,U+210c1,U+21201,U+2123d,U+21255,U+21274,U+2127b" } }, { uri: WU, descriptors: { unicodeRange: "U+350f-35e5,U+212d7,U+212e4,U+212fd,U+2131b,U+21336,U+21344,U+2139a,U+213c4,U+21413,U+2146d-2146e,U+215d7,U+21647,U+216b4,U+21706,U+21742,U+218bd,U+219c3" } }, { uri: zU, descriptors: { unicodeRange: "U+336d-3443,U+2032b,U+20371,U+20381,U+203f9,U+2044a,U+20509,U+20547,U+205d6,U+20628,U+20676,U+2074f,U+20779,U+20807,U+2083a,U+20895,U+208b9,U+2097c,U+2099d" } }, { uri: QU, descriptors: { unicodeRange: "U+328b-336c,U+2000b,U+20089,U+200a2,U+200a4,U+20164,U+201a2,U+20213" } }, { uri: jU, descriptors: { unicodeRange: "U+3192-31ba,U+31c0-31e3,U+31f0-321e,U+3220-328a,U+1f250-1f251" } }, { uri: ef, descriptors: { unicodeRange: "U+2f74-2fd5,U+3000,U+3003-3007,U+3012-3013,U+3018-301c,U+3020-3029,U+302f-303f,U+3041-3096,U+3099-30a1" } }, { uri: tf, descriptors: { unicodeRange: "U+30a2-30ff,U+3105-312f,U+3131-318e,U+3190-3191" } }, { uri: nf, descriptors: { unicodeRange: "U+4e36,U+4ea0,U+4f74,U+4f91,U+4f94,U+4fc5,U+507e,U+50ed,U+5182,U+51f5,U+525e,U+5282,U+52f9,U+5326,U+537a,U+53a3,U+5423,U+5459,U+54b4,U+54d9,U+55c9,U+57f4,U+580b,U+5902,U+5925,U+5a08,U+5ab5,U+5b84,U+5be4,U+5c22,U+5cb5,U+5cbd,U+5d3e,U+5e31,U+5e5e,U+5e80,U+5ee8,U+5f82,U+5fc9,U+5fed,U+600a,U+605d,U+609b,U+609d,U+60dd,U+6243,U+6322,U+63ce,U+640c,U+643f,U+6445,U+64d7,U+6534,U+6549,U+656b,U+6603,U+674c,U+680a,U+6864,U+69d4,U+6a65,U+6c2a,U+6c46,U+6c5c,U+6d0e,U+6d48,U+6e2b,U+6eb2,U+6eb7,U+6f89,U+706c,U+70b1,U+7113,U+71d4,U+727f,U+72f3,U+7303,U+7321,U+736c,U+736f,U+74a9,U+74de,U+750d,U+7513,U+7592,U+75c4,U+7605,U+760a,U+761b,U+7625,U+762d,U+7643,U+7707,U+7747,U+77b5,U+7839,U+784e,U+78a5,U+7924,U+793b,U+798a,U+7a03,U+7a06,U+7a78,U+7a80,U+7aad,U+7ba8,U+7be5,U+7cc8,U+7ec1,U+7f0b,U+7f0f,U+7f12,U+7f68,U+7f9d,U+8025,U+809c,U+80ad,U+80b7,U+80e8,U+811e,U+8204,U+8223,U+822d,U+823b,U+824b,U+825a,U+827d,U+827f,U+828f,U+82c8,U+8307,U+831b,U+8347,U+837d,U+839b,U+83a9,U+83f9,U+84b9,U+8579,U+864d,U+867f,U+86b0,U+86d1,U+86d8,U+86f2,U+8764,U+8770,U+8788,U+8797,U+87ac-87ad,U+87b5,U+881b,U+8844,U+88bc,U+88fc,U+8930,U+89cf,U+89d6,U+8ba0,U+8bd4,U+8c02,U+8c2b,U+8c85,U+8e23,U+8f81-8f82,U+8fd5,U+90b6,U+90db,U+914e,U+9164,U+91ad,U+943e,U+94b7-94b8,U+94eb,U+950d,U+9514,U+9516,U+9518,U+9529,U+9538,U+953f,U+954e,U+955f,U+95fc,U+9667,U+96b3,U+9792,U+97b2,U+98a1,U+9969,U+9987,U+9998,U+9a80,U+9a92,U+9a96,U+9adf,U+9cb4,U+9cbd,U+9cd0,U+9cd4,U+9e31,U+9e3a,U+9e71,U+9ee5,U+9eea,U+9ef9,U+9fa0" } }, { uri: rf, descriptors: { unicodeRange: "U+4e0c,U+4e28,U+4e3f,U+4ec2,U+502e,U+50ba,U+5155,U+5181,U+522d,U+5281,U+5290,U+5369,U+53b6,U+54d5,U+54dc,U+54ff,U+552a,U+553c,U+5588,U+55b5,U+5686,U+570a,U+5776,U+5786,U+57a4,U+5820,U+5865,U+58bc,U+5b32,U+5b65,U+5c1c,U+5c66,U+5c6e,U+5c8d,U+5ddb,U+5f2a,U+5f50,U+5f61,U+6067,U+614a,U+615d,U+619d,U+61d4,U+620b,U+6224-6225,U+6343,U+63ad,U+63f2,U+640b,U+6420,U+6434,U+6496,U+64d0,U+6509,U+652e,U+67a8,U+6833,U+6844,U+684a,U+6920,U+6957,U+6971,U+6a8e,U+6a91,U+6aa0,U+6b43,U+6bea,U+6bf5,U+6c15,U+6cd0,U+6ee0,U+6f24,U+6f2d,U+70c0,U+721d,U+728b,U+72c3,U+72e8,U+730a,U+7338-7339,U+734d,U+746d,U+752f,U+754e,U+770d,U+7735,U+778d,U+77a2,U+77e7,U+7857,U+786d,U+78c9,U+78f2,U+791e,U+7953,U+7b58,U+7b9d,U+7bda,U+7cd7,U+7f32-7f33,U+8022,U+8028-8029,U+8035,U+804d,U+8080,U+80c2,U+80e9,U+80ec,U+80f2,U+810e,U+8221,U+8274,U+82b0,U+82e0,U+83b0,U+8487-8488,U+848e,U+84cd,U+84d0,U+8539,U+857a,U+85a8,U+85b7,U+867c,U+871e,U+8723,U+877e,U+878b,U+8793,U+8803,U+88d2,U+8966,U+89cc,U+89eb,U+8b26,U+8c8a,U+8c98,U+8d33,U+8d47,U+8d55,U+8dbc,U+8e40,U+8e94,U+8f77,U+8f79,U+9058,U+91a2,U+91b5,U+928e,U+9494,U+94b6,U+94de,U+94f4,U+94f9,U+950a,U+950e,U+951e,U+952b,U+953c,U+953e,U+9544,U+9561,U+9564,U+9569,U+95f6,U+9603,U+960d,U+963d,U+9674,U+9794,U+97ab,U+98a5,U+9a9f,U+9ab1,U+9ad1,U+9b0f,U+9b2f,U+9c92,U+9c95,U+9cba,U+9cbc,U+9cc6,U+9ccb,U+9cd8,U+9e32,U+9e38,U+9e5b,U+9e7e,U+9eb4,U+9efb-9efc,U+9f3d" } }, { uri: of, descriptors: { unicodeRange: "U+2e3b,U+2e80-2e99,U+2e9b-2ef3,U+2f00-2f73,U+ffffd" } }, { uri: af, descriptors: { unicodeRange: "U+4e69,U+4f1b,U+4f67,U+4f7e,U+4fdc,U+50e6,U+5196,U+5202,U+5233,U+523f,U+52a2,U+536e,U+5476,U+54ad,U+54cf,U+5537,U+561e,U+56dd,U+56df,U+5709,U+572c,U+57cf,U+57f8,U+580d,U+5881,U+589a,U+5941,U+59b2,U+5c25,U+5d24,U+5d74,U+5e42,U+5e8b,U+5eb3,U+5ed2,U+5fad,U+6003,U+603c,U+6083,U+6100,U+6126,U+6206,U+62ca,U+638e,U+63b4,U+6426,U+646d,U+6535,U+65c4,U+66db,U+6715,U+6769,U+6798,U+67c3,U+6861,U+698d,U+69ca,U+69ed,U+69f2,U+69ff,U+6a18,U+6b39,U+6bb3,U+6c0d,U+6cb2,U+6cd6,U+6cf7,U+6cfa,U+6d33,U+6e16,U+6e53-6e54,U+6ebb,U+6fb6,U+709d,U+72ad,U+72f7,U+72fb,U+7313,U+739f,U+74ba,U+754b,U+755b,U+758b,U+75ac,U+75d6,U+7617,U+7635,U+7640,U+76a4,U+76b2,U+775a,U+77bd,U+781f,U+79b3,U+7b2b,U+7b31,U+7b3e,U+7b6e,U+7b9c,U+7c0b,U+7c9e,U+7cc1,U+7ce8,U+7ea5,U+7f21,U+7f27,U+7f74,U+7fb0,U+8031,U+8071,U+80ea,U+8114,U+8160,U+81a6,U+81c1,U+829f,U+82a4,U+82fb,U+831a,U+8333,U+836c,U+83b6,U+83f8,U+8411,U+841c,U+8489,U+848c,U+85a4,U+8627,U+8629,U+866e,U+86b5,U+872e,U+8731,U+877b,U+877d,U+87ea,U+8813,U+8816,U+8864,U+88ce,U+88e5,U+897b,U+89cb,U+89f3,U+8bfc,U+8c35,U+8d46,U+8d4d,U+8dba,U+8e3a,U+8f75,U+8f7e,U+8fd3,U+9161,U+9179,U+917e,U+91a3,U+94ac,U+94d7,U+94e5,U+952a,U+952c,U+9545,U+9565,U+9568,U+956a,U+961d,U+96e0,U+972a,U+9730,U+989f,U+98e7,U+990d,U+9967,U+9993,U+9aa3,U+9ac0,U+9ae1,U+9aeb,U+9af9,U+9c86,U+9c8b,U+9ca0-9ca1,U+9ca3,U+9ce2,U+9e48,U+9e6a,U+9e87,U+9ee2,U+9ee9,U+9f17,U+9f19,U+9f2c,U+9f80" } }, { uri: sf, descriptors: { unicodeRange: "U+4ef3,U+50d6,U+50ec,U+51ab,U+51b1,U+52d6,U+54a9,U+54da,U+55be,U+55cd,U+564d,U+572f,U+574c,U+576b,U+57d8,U+57fd,U+5844,U+59d2,U+5ae0,U+5b16,U+5b37,U+5b5b,U+5b80,U+5d1e,U+5d6b,U+5efe,U+5f11,U+5f56,U+5f58,U+5f73,U+5f8c,U+5fc4,U+5fe4,U+602b,U+6106,U+610d,U+63de,U+63f8,U+641b,U+64e4,U+6634,U+676a,U+67b5,U+681d,U+6883,U+69b1,U+69e0,U+6b37,U+6b9b,U+6d7c,U+6ed7,U+6f36,U+6f72,U+6f8c,U+7035,U+7039,U+7173,U+7178,U+7228,U+728f,U+72b4,U+72ef,U+72f4,U+7331,U+7481,U+74e0,U+7540,U+75c3,U+75e6,U+763c,U+764d,U+76cd,U+7704,U+7743,U+7780,U+7847,U+786a,U+78b9,U+7962,U+7a02,U+7aac,U+7ab3,U+7b0a,U+7b4c,U+7b7b,U+7bfc,U+7c0f,U+7c16,U+7c40,U+7ca2,U+7cc7,U+7cf8,U+7d77,U+7e3b,U+7ea1,U+7ea9,U+7ef2,U+7f02,U+7f07,U+7f0c,U+7f23,U+7f2f,U+7fbc,U+8016,U+8020,U+812c,U+8136,U+8182,U+822f,U+8233,U+825f,U+8268,U+8284,U+8288,U+8291,U+8308,U+8311,U+835b,U+836d,U+83dd,U+8406,U+840f,U+845c,U+84b4,U+84e3,U+850c,U+855e,U+863c,U+86ba,U+86c4,U+86de,U+86f1,U+873e,U+87bd,U+87db,U+880a,U+883c,U+887f,U+88f0,U+890a,U+892b,U+895e,U+89ef,U+8a48,U+8bdc,U+8c18,U+8c33,U+8c94,U+8db1,U+8dcf,U+8dd6,U+8de3,U+8e6f,U+8e90,U+8f7a,U+8fb6,U+902d,U+90be,U+91af,U+936a,U+948b,U+94d8,U+9513,U+953a,U+956c,U+963c,U+9654,U+966c,U+9688,U+97b4,U+996b,U+9a75,U+9a7a,U+9aba,U+9aed,U+9b08,U+9b43,U+9c8e,U+9c94,U+9c9a,U+9e2b,U+9e36,U+9e4b,U+9e4e,U+9e55,U+9e63,U+9e68-9e69,U+9ebd,U+9ec9,U+9f0d,U+9f37,U+9f51" } }, { uri: df, descriptors: { unicodeRange: "U+50a7,U+5240,U+5261,U+52ac,U+531a,U+5363,U+5432,U+5452,U+5456,U+5472,U+5478,U+553f,U+5575,U+5581,U+55cc,U+55fe,U+5601,U+572e,U+57d2,U+57ef,U+581e,U+5924,U+5981,U+5997,U+59a3,U+5aaa,U+5ab8,U+5b34,U+5d5d,U+5def,U+5e11,U+5e91,U+5ed1,U+5ef4,U+5f40,U+600d,U+6019,U+601b,U+605a,U+6092,U+60ab,U+6217,U+623d,U+6369,U+65d2,U+6661,U+670a,U+6753,U+67a7,U+6855,U+68f9,U+6939,U+696e,U+6980,U+6a7c,U+6aab,U+6b82,U+6bf3,U+6bf9,U+6c05,U+6c19-6c1a,U+6ca9,U+6cf6,U+6d1a,U+6dab,U+6f74,U+7085,U+7198,U+71b5,U+7256,U+725d,U+727e,U+72fa,U+7322,U+738e,U+73e5,U+750f,U+755a,U+7594,U+75b3,U+760c,U+7615,U+7630,U+763f,U+77ec,U+7817,U+78a1,U+78d9,U+7905,U+7b2a,U+7b2e,U+7b62,U+7b85,U+7bcc,U+7bea,U+7c26,U+7c74,U+7c9c-7c9d,U+7e47,U+7e9b,U+7e9f,U+7ee0,U+7ee8,U+7ef1,U+7f01,U+7f11,U+7f17,U+7f36,U+7f7e,U+7fee,U+802a,U+80cd,U+8112,U+8169,U+8234,U+8279,U+8298,U+82ca,U+82d8,U+82e1,U+83c0,U+83d4,U+83df,U+8401,U+8451,U+845a,U+8476,U+8478,U+84ba,U+84bd,U+84e0,U+851f,U+8548,U+8556,U+8585,U+868d,U+86e9,U+86f4,U+86f8,U+8765,U+8785,U+87ab,U+87ee,U+8832,U+8872,U+88b7,U+88e2-88e3,U+89da,U+8bce,U+8bd3,U+8bd6,U+8bf9,U+8c16,U+8c73,U+8d5c,U+8dde,U+8f6d,U+8f94,U+8fe8,U+9011,U+915e,U+9185,U+918c,U+94ab,U+94d1,U+94f3,U+9515,U+951d,U+9558,U+9567,U+96ce,U+96e9,U+9785,U+9878,U+987c,U+9883,U+98d1,U+9954,U+9963,U+9a93,U+9ac1,U+9acc,U+9b1f,U+9b49,U+9b4d,U+9b51,U+9ca7,U+9cae,U+9cce,U+9cd3,U+9e37,U+9e39,U+9e41,U+9e46,U+9f22,U+9f2f,U+9f39,U+9f85" } }, { uri: cf, descriptors: { unicodeRange: "U+4e5c,U+4edf,U+4f25,U+4f32,U+4f5e,U+4f76,U+4faa,U+4fe6,U+5028,U+5048,U+5250,U+535f,U+538d,U+53c1,U+5412,U+5443,U+54d4,U+54dd,U+5541,U+5550,U+5577,U+55dd,U+55f3,U+560f,U+562c,U+5657-5658,U+5664,U+56af,U+575c,U+577c,U+57b2,U+57da,U+5800,U+5a62,U+5aeb,U+5c3b,U+5ca3,U+5d26,U+5d9d,U+5f01,U+5fb5,U+5fdd,U+5ff8,U+6029,U+6041,U+6079,U+60b1,U+6222,U+629f,U+6332,U+63bc,U+63e0,U+6485,U+65ab,U+65c3,U+65c6,U+668c,U+669d,U+66be,U+67fd,U+6800,U+68fc,U+690b,U+6924,U+6978,U+69a7,U+6a3e,U+6a50,U+6a5b,U+6a97,U+6b24,U+6b8d,U+6baa,U+6c10,U+6c54,U+6ceb,U+6d04,U+6d4d,U+6eb1,U+6ebd,U+7110,U+71b3,U+71f9,U+7230,U+728d,U+7292,U+72b8,U+72d2,U+7360,U+73a2,U+7511,U+75a0,U+75c8,U+779f,U+7826,U+7877,U+7a39,U+7aa8,U+7ae6,U+7b04,U+7b0f,U+7baa,U+7bac,U+7c1f,U+7ccd,U+7ecb,U+7ed4,U+7ed7,U+7efb,U+7f0d,U+7f5f,U+7faf,U+7fd5,U+7fe5,U+8027,U+80bc,U+80dd,U+80fc,U+8132,U+815a,U+8167,U+816d,U+81ca,U+8228,U+82a1,U+82a9,U+82ab,U+82cc,U+8351,U+8368,U+83b8,U+83d8,U+83ea,U+83f0,U+8497,U+84c1,U+858f,U+85ff,U+867b,U+86a8-86a9,U+870a,U+8722,U+876e,U+877c,U+87e5,U+8888,U+88df,U+8919,U+8bcc,U+8bdf,U+8be8,U+8bee,U+8c20,U+8c2f,U+8d36,U+8df8,U+8e05,U+8e2f,U+8f9a,U+9021,U+908b,U+90b4,U+90ba,U+90d0,U+90eb,U+90fe,U+91aa,U+933e,U+9486-9487,U+948d,U+9490,U+94ad,U+94bd,U+94d6,U+94d9,U+9507,U+9546,U+955e,U+956b,U+95e9,U+9604,U+960b,U+9612,U+9615,U+9617,U+96b9,U+989a-989b,U+989e,U+9a78,U+9a7d,U+9aa0,U+9aa2,U+9ac2,U+9b23,U+9b3b,U+9c82,U+9cca,U+9cd9,U+9e28,U+9e5a,U+9e5e,U+9e6c,U+9efe,U+9f0b" } }, { uri: lf, descriptors: { unicodeRange: "U+4e47,U+4e8d,U+4f65,U+4f89,U+50ee,U+520e,U+5416,U+5454,U+54bb,U+54c2,U+54d3,U+54de,U+5591,U+55e5,U+560c,U+566b,U+5769,U+578c,U+5793,U+57e4,U+5889,U+593c,U+59ab,U+5ad4,U+5ad8,U+5af1,U+5b53,U+5ba5,U+5c59,U+5c63,U+5d5b,U+5e0f,U+5e14,U+5edb,U+5fbc,U+6004,U+60ad,U+610e,U+61b7,U+624c,U+634c,U+647a,U+64ba,U+65f0,U+6600,U+66f7,U+67e2,U+67f0,U+680c,U+686b,U+6874,U+691f,U+6989,U+6a17,U+6b81,U+6b84,U+6c06-6c07,U+6c3d,U+6d07,U+6d27,U+6d2b,U+6d91,U+6e6b,U+6e8f,U+6fde,U+70bb,U+723b,U+726e,U+72b0,U+72ce,U+72f2,U+7301,U+731e,U+737e,U+7477,U+748e,U+74ff,U+7633,U+7654,U+771a,U+7726,U+7765,U+7768,U+781c,U+7829,U+78d4,U+7913,U+7957,U+79d5,U+79eb,U+7a70,U+7a86,U+7b25,U+7b38,U+7b47,U+7b72,U+7ba6-7ba7,U+7dae,U+7ee1,U+7efe,U+7f26,U+7f31,U+7f35,U+801c,U+8043,U+809f,U+80ab,U+80d7,U+8118,U+8188,U+81cc,U+823e,U+8244,U+824f,U+82b4,U+82c1,U+82e4,U+82f4,U+8306,U+833a,U+835c,U+839c,U+83b3,U+83bc,U+846d,U+867a,U+868b,U+8734,U+87ca,U+886e,U+887e,U+88a2,U+88c9,U+8921,U+8bb5,U+8bf3,U+8c04,U+8c17,U+8c1d,U+8c25,U+8c36,U+8c55,U+8c78,U+8d3d,U+8d40,U+8d59,U+8d67,U+8d91,U+8dbf,U+8deb-8dec,U+8dfd,U+8e14,U+8e41,U+8f8e,U+900b,U+9044,U+9062,U+90cf,U+9123,U+9146,U+9162,U+9172,U+918d,U+9190,U+92c8,U+93ca,U+948c,U+94aa,U+94b2,U+94c8,U+94ca,U+94d5,U+94df,U+94e9-94ea,U+94f7,U+94fc-94fd,U+951b,U+954f,U+9554,U+9559,U+9566,U+9571-9572,U+95f1,U+9608,U+960f,U+97af,U+988f,U+98d5,U+992e,U+9955,U+9ab0,U+9b32,U+9c90,U+9c9e,U+9ca5,U+9ca9,U+9cad,U+9cb1,U+9cc3,U+9e47,U+9ee7,U+9f87" } }, { uri: Uf, descriptors: { unicodeRange: "U+4e93,U+4ec4,U+4ef5,U+4f27,U+4f7b,U+4fe3,U+5080,U+5121,U+51eb,U+5208,U+52f0,U+53f5,U+5453,U+5466,U+54a6,U+54bf,U+54d0,U+5533,U+5549,U+5556,U+556d,U+558f,U+55f2,U+55f5,U+5627,U+567b,U+56d4,U+571c,U+5739,U+57b4,U+5807,U+58c5,U+59a4,U+59af,U+59d8,U+5a09,U+5a0c,U+5a4a,U+5ad2,U+5b6c,U+5ca2,U+5cac,U+5d03,U+5d6c,U+5db7,U+5ebe,U+5f2d,U+5fea,U+6042,U+6120,U+6175,U+6221,U+623e,U+6339,U+638a,U+643d,U+64b8,U+64e2,U+66e9,U+67b3,U+67c1,U+67d2,U+6832,U+6877,U+68f0,U+6934,U+6966,U+6987,U+6998,U+69c1,U+69ce,U+6a3d,U+6a84,U+6aa9,U+6b87,U+6bd6,U+6c16,U+6c18,U+6cd4,U+6cee,U+6de0,U+6e0c,U+6ecf,U+6f4b,U+70b7,U+7168,U+72d9,U+7352,U+73b3,U+73d0,U+7441,U+74d2,U+75a5,U+75e7-75e8,U+7610,U+7619,U+765e,U+772d,U+7812,U+782c,U+784c,U+7850,U+7856,U+789b,U+78f4,U+7a51,U+7b15,U+7b1e,U+7b24,U+7b5a,U+7bb8,U+7bc1,U+7bd9,U+7ed0,U+7ee6,U+7efa,U+7f1b,U+7f1f,U+7f22,U+7f45,U+7f71,U+7fa7,U+7fbf,U+7ff3,U+8052,U+80b1,U+80db,U+80f4,U+81bb,U+81ec,U+8202,U+8210,U+8249,U+828a,U+828e,U+82e3,U+8315,U+8369,U+8378,U+83a8,U+83aa,U+83b4,U+83e1,U+84fc,U+8538,U+853b,U+859c,U+85ae,U+86b4,U+86c9,U+86cf,U+8725,U+879f,U+87b3,U+887d,U+88fe,U+8a8a,U+8ba7,U+8c07,U+8c14,U+8c30,U+8c47,U+8db5,U+8dd7,U+8e1f,U+8e69,U+8e70,U+8e85,U+8f78,U+8f87,U+8f8b,U+8f8f,U+90c4,U+9143,U+917d,U+948f,U+94cd,U+94d2,U+94ef,U+954a,U+9609-960a,U+96d2,U+9708,U+9765,U+97ea,U+9880,U+98a7,U+996c,U+9980,U+9991,U+9a88,U+9ab6,U+9afb,U+9b47,U+9c87,U+9c9b,U+9cb5,U+9cc7,U+9e2c,U+9e42,U+9e58,U+9ecd,U+9ecf,U+9f8a,U+9f8c" } }, { uri: ff, descriptors: { unicodeRange: "U+4ebb,U+4edd,U+4fa9,U+502c,U+50a5,U+51c7,U+51fc,U+523d,U+5241,U+530f,U+5464,U+549d,U+54a3,U+5514,U+5527,U+555c,U+556e,U+5576,U+55b1,U+55b9,U+55eb,U+5624,U+564c,U+5671,U+5685,U+568f,U+56d7,U+56e1,U+57a1,U+57d9,U+5942,U+5a67,U+5c50,U+5c7a,U+5c98,U+5d06,U+5d27,U+5d6f,U+5df3,U+5dfd,U+5e19,U+5ea0,U+5eb9,U+5eea,U+5ffe,U+600f,U+606b,U+6215,U+622c,U+6266,U+62bb,U+62bf,U+6308,U+6387,U+63b8,U+63c4,U+63c6,U+63f6,U+6441,U+6555,U+659b,U+6677,U+66a7,U+6775,U+678b,U+679e,U+6840,U+6849,U+6860,U+68c2,U+6910,U+6a28,U+6a2f,U+6a79,U+6b92-6b93,U+6bc2,U+6bfd,U+6c29,U+6c32,U+6c86,U+6cc5,U+6d0c,U+6d60,U+6da0,U+6ddd,U+6e86,U+6ed3,U+6edf,U+6fb9,U+6fd1,U+6fef,U+7023,U+7080,U+70ca,U+712f,U+7145,U+7284,U+732c,U+73c8,U+73d9,U+740a,U+7457,U+7596,U+759d,U+75a3,U+75d8,U+75e3-75e4,U+75ff,U+7622,U+7688,U+76b4,U+76e5,U+7818,U+7887,U+789a,U+78b2,U+7b08,U+7b33,U+7c2a,U+7ccc,U+7ea8,U+7ec0,U+7fe6,U+8012,U+8084,U+8093,U+80e4,U+80ef,U+8297,U+82a8,U+82be,U+8331,U+8366,U+83c5,U+83fd,U+8473,U+84a1,U+84ca,U+84d1,U+857b,U+85c1,U+85d3,U+8605,U+8662,U+86aa,U+86b1,U+86d4,U+86ed,U+86f3,U+8709,U+8748,U+874c,U+8763,U+89c7,U+89de,U+89e5,U+8a3e,U+8ba6,U+8c00,U+8c21,U+8c49,U+8c7a,U+8d30,U+8df9,U+8e51,U+8e59,U+8f6b,U+8f73,U+8ff3,U+9016,U+9026,U+902f,U+9099,U+909b,U+90c7,U+914a,U+91ae,U+91ba,U+9495,U+94a3,U+94af,U+94ba,U+94bf,U+94cc,U+94e1,U+94f0,U+9531,U+955d,U+95f3,U+9697,U+96bc,U+975b,U+977c,U+98a2,U+998a,U+9994-9995,U+9a9b,U+9ab7,U+9ac5,U+9c91,U+9ccf,U+9cd5,U+9e29,U+9edc,U+9edf,U+9f83,U+9f88-9f89" } }, { uri: pf, descriptors: { unicodeRange: "U+4ee8,U+4f22,U+4f43,U+4f57,U+4f5d,U+4f6f,U+4ff8,U+502d,U+507b,U+5345,U+53df,U+53fb,U+544b,U+5482,U+54a7,U+54cc,U+550f,U+5544,U+5555,U+5594,U+55e8,U+55ec,U+55ef,U+564e,U+56f9,U+5704,U+576d,U+5785,U+57ad,U+5914,U+5958,U+599e,U+59aa,U+59be,U+5a06,U+5abe,U+5ae1,U+5b40,U+5bee,U+5cbf,U+5cc4,U+5ccb,U+5d47,U+603f,U+6078,U+607d,U+607f,U+608c,U+609a,U+60fa,U+61ff,U+621b,U+622e,U+626a,U+6371,U+63ae,U+63cd,U+63d6,U+6410,U+6414,U+6421,U+6448,U+64d8,U+6710,U+6748,U+6772,U+680e,U+6954,U+69ab,U+6c68,U+6c8f,U+6ca4,U+6d2e,U+6e4e,U+6e98,U+6fe0,U+7094,U+70e9,U+7116,U+7119,U+723f,U+73c9,U+74e4,U+753e,U+7548,U+75bd,U+75cd,U+7618,U+7634,U+76c5,U+76f1,U+7708,U+7719,U+777e,U+7791,U+77b3,U+7823,U+7827,U+7830,U+7889,U+7893,U+7949,U+795c,U+79e3,U+7a14,U+7a88,U+7a95,U+7aa0,U+7afd,U+7b90,U+7bd1,U+7bfe,U+7da6,U+7ec2,U+7eef,U+7f03-7f04,U+7f08,U+7f58,U+7f61,U+7f9f,U+8174,U+8200,U+828d,U+82c4,U+82d5,U+82dc,U+82f7,U+832d,U+835a,U+840b,U+8438,U+852b,U+869d,U+86ac,U+86d0,U+86f0,U+8782,U+87a8,U+87d1-87d2,U+87e0,U+8839,U+8913,U+891b,U+8934,U+8941,U+89ca,U+89ce,U+8a07,U+8ba3,U+8bc5,U+8bcb,U+8bdb,U+8c11,U+8c15,U+8c29,U+8c32,U+8dc4,U+8dce,U+8ddb,U+8dfa,U+8e09,U+8e1d,U+8e39,U+8e42,U+8e49,U+8e4b,U+8e8f,U+8f71-8f72,U+9004,U+9036,U+9097,U+90dc,U+90e2,U+90e6,U+90ef,U+9104,U+919a,U+91b4,U+938f,U+9497,U+950f,U+9557,U+9562-9563,U+9573,U+9606,U+9649,U+972d,U+973e,U+97a3,U+97eb,U+988c,U+9894,U+98a6,U+9974,U+9977,U+997d,U+9a90,U+9a9d,U+9aef,U+9ca2,U+9ccd,U+9cdf,U+9e20,U+9e4c,U+9e6b,U+9f3e" } }, { uri: uf, descriptors: { unicodeRange: "U+4ede,U+4ee1,U+4eeb,U+4fda,U+4ffe,U+5025,U+506c,U+50f3,U+5106,U+520d,U+525c,U+52ad,U+530d,U+5310,U+539d,U+53a9,U+53fc,U+5421,U+5477,U+54e7,U+551b,U+5530,U+557e,U+5599,U+55c4,U+55d1,U+55d4,U+55df,U+55e4,U+55ea,U+5623,U+562d,U+5654,U+56eb,U+56f5,U+57a7,U+57d5,U+57dd,U+584d,U+5880,U+58ec,U+59dd,U+5a32,U+5a55,U+5a75,U+5b51,U+5b71,U+5b73,U+5cd2,U+5ce4,U+5e5b,U+5e96,U+5fd2,U+607b,U+61d1,U+634b,U+636d,U+63b3,U+63ff,U+64c0,U+661d,U+6657,U+66dc,U+67a5,U+6841,U+6867,U+6901,U+699b,U+6a47,U+6b46,U+6c21,U+6c24,U+6c35,U+6c4a,U+6c94,U+6ca3,U+6d39,U+6d63,U+6d6f,U+6d94,U+705e,U+71e7,U+726f,U+72cd,U+72de,U+72f0,U+7325,U+7350,U+7391,U+741a,U+757f,U+7583,U+75b1,U+75b4,U+75b8,U+75c2,U+75f1,U+766f,U+7699,U+7751,U+789c,U+7a17,U+7be6,U+7cb2,U+7ea3,U+7eb0,U+7ebe,U+7eeb,U+7f25,U+7f2c,U+7fb8,U+8026,U+8037,U+8153,U+8171,U+8191,U+8214,U+821b,U+8222,U+826e,U+82eb,U+830c,U+8314,U+8334,U+83d6,U+8418,U+843c,U+84ff,U+8564,U+8572,U+8616,U+866c,U+8693,U+86a3,U+86a7,U+86af,U+86b6,U+86c6,U+86ca,U+8708,U+870d,U+8759,U+8760,U+87af,U+87c6,U+8869,U+88c6,U+89d0,U+8b07,U+8baa-8bab,U+8bc2,U+8be4,U+8bf0,U+8c2a,U+8c62,U+8c89,U+8d49,U+8d6d,U+8d84,U+8d94,U+8db8,U+8dc6,U+8e2e,U+8e3d,U+8e47,U+8e7f,U+9005,U+9051,U+907d,U+9082,U+9088,U+90b0,U+90d3,U+9150,U+949c,U+94a4,U+94b9,U+94cb,U+94e0,U+9509,U+9512,U+951f,U+9534,U+9552-9553,U+965f,U+96b0,U+9791,U+9889,U+9990,U+9a9c,U+9aa7,U+9c88,U+9cb2-9cb3,U+9cb6-9cb7,U+9cc5,U+9cdc,U+9e22,U+9e2a,U+9e57,U+9e67,U+9e73,U+9e82,U+9eb8,U+9ee0,U+9f9b" } }, { uri: mf, descriptors: { unicodeRange: "U+4eb5,U+4f09,U+4f5a,U+4f8f,U+4fce,U+4fdf,U+4fea,U+4ff3,U+500c,U+500f,U+504e,U+5088,U+52be,U+5420,U+5457,U+5499,U+549b,U+54c6,U+54d2,U+558b,U+559f,U+55bd,U+55d6,U+565c,U+567c,U+568e,U+5768,U+577b,U+57a9,U+57ed,U+59f9,U+5a11,U+5a40,U+5ae6,U+5b6a,U+5b93,U+5bb8,U+5c15,U+5c99,U+5c9c,U+5cc1,U+5d2e,U+5d4b,U+5d99,U+5e54,U+5e61,U+5fcf-5fd1,U+6002,U+6006,U+6014,U+60af,U+60c6,U+60da,U+60f4,U+621f,U+62c8,U+631b,U+631e,U+63e9,U+64b5,U+655d,U+6619,U+6635,U+6641,U+67ad,U+67b0,U+67b7,U+67e9,U+684e,U+688f,U+695d,U+696b,U+69b7,U+6a58,U+6c26,U+6d35,U+6d43,U+6d9e,U+6dd9,U+6dec,U+6e11,U+6e6e,U+6e9f,U+6ec2,U+6ee2,U+6ef9,U+6f09,U+6f66,U+6f8d,U+6fc2,U+6fc9,U+729f,U+72c8,U+73de,U+7430,U+7566,U+7579,U+75c9,U+75e2,U+75fc,U+762a,U+7638,U+7678,U+76c2,U+76f9,U+778c,U+77cd,U+77dc,U+7800,U+781d,U+782d,U+783b-783c,U+78a3,U+78ec,U+7980,U+7a23,U+7b95,U+7bdd,U+7c0c,U+7c41,U+7c91,U+7cb3,U+7cc5,U+7ecc,U+7f19,U+7fca,U+8006,U+8069,U+807f,U+80bd,U+80ed,U+814b,U+8198,U+82cb,U+82d2,U+834f,U+8360,U+847a,U+84d6,U+84e5,U+8537,U+85d0,U+8671,U+86a4,U+86ce,U+86f9,U+8703,U+8707,U+8737,U+873b,U+8815,U+8936,U+8bc3,U+8bcf,U+8bd2,U+8bd8,U+8be9,U+8c0c,U+8c0f,U+8c4c,U+8d45,U+8d5d,U+8d73,U+8e31,U+8e6d,U+8e76,U+8fe4,U+9041,U+90d7,U+9169,U+92ae,U+94a1,U+94c4,U+94c9,U+94db,U+94e7,U+9503,U+9506,U+9517,U+9528,U+9537,U+9542,U+9549,U+95fe,U+9616,U+961a,U+96c9,U+96f3,U+9701,U+970e,U+9739,U+9753,U+9798,U+98d2-98d3,U+98d9-98da,U+9968,U+996f,U+9984,U+9997,U+9acb,U+9b03,U+9c85,U+9ca8,U+9cab,U+9e49,U+9e51,U+9e66,U+9f10" } }, { uri: bf, descriptors: { unicodeRange: "U+4e15,U+4e1e,U+4e2b,U+4eb3,U+4ec9,U+4f0e,U+4f64,U+501c,U+50a9,U+510b,U+51a2,U+51bc,U+527d,U+52d0,U+53fd,U+5429,U+542e,U+5486,U+54af,U+5506,U+5511,U+5522,U+552c,U+556c,U+55b3,U+55d2,U+55e6,U+55fd,U+561f,U+5639,U+5659,U+5662,U+5693,U+572a,U+5892,U+598a,U+5992,U+59a9,U+5a20,U+5ae3,U+5b17,U+5b7d,U+5d34,U+5d3d,U+5d4a,U+5d82,U+5e1a-5e1b,U+5ea5,U+5f0b,U+5f77,U+5fd6,U+5fff,U+6026,U+6035,U+6063,U+60b4,U+60bb,U+60ee,U+612b,U+6194,U+61ca,U+61e6,U+61f5,U+620a,U+6248,U+62a1,U+62d7,U+6376,U+637b,U+652b,U+65bc,U+65cc,U+65ce,U+65d6,U+664c,U+665f,U+6666,U+6684,U+66b9,U+6773,U+6777,U+6787,U+67de,U+6845,U+693d,U+6994,U+6a35,U+6d54,U+6d5c,U+6d8e,U+6dd6,U+6eb4,U+6f2a,U+6f78,U+704f,U+70ec,U+7118,U+714a,U+7172,U+71b9,U+724d,U+728a,U+7337,U+733e,U+7396,U+73b7,U+73cf,U+7428,U+742c,U+742e,U+74ee,U+74f4,U+7525,U+753a,U+7572,U+75d4,U+765c,U+768e,U+7762,U+777d,U+77fd,U+7825,U+7837,U+78b4,U+795f,U+79ed,U+7a1e,U+7b06,U+7b20,U+7ba9,U+7bab,U+7c7c,U+7cbd,U+7cdc,U+7ec9,U+7ef6,U+7f30,U+7f42,U+7f44,U+7f54,U+7f94,U+8004,U+800b,U+8019,U+809b,U+80ae,U+80c4,U+80f1,U+8146,U+816e,U+817c,U+81c0,U+81fc,U+81fe,U+822b,U+830f,U+832f,U+8340,U+8365,U+8385,U+8392,U+83a0,U+8424,U+84af,U+869c,U+8713,U+8717-8718,U+87c0,U+87cb,U+87fe,U+8821,U+8902,U+89d1,U+8bb9,U+8c12,U+8d32,U+8d53,U+8df7,U+8e7c,U+8f7c,U+8f95,U+8fab,U+9052,U+905b,U+9095,U+909d,U+90c5,U+911e,U+9122,U+916a,U+919b,U+948e,U+9492,U+949a,U+94b5,U+94bc,U+94c6,U+94f1,U+9502,U+9511,U+9536,U+956f-9570,U+9602,U+9621,U+9631,U+998b,U+99a5,U+9a81,U+9a9e,U+9ebe,U+9f8b" } }, { uri: Ef, descriptors: { unicodeRange: "U+4f2b,U+4f3d,U+4fac,U+5043,U+5055,U+5140,U+5156,U+51cb,U+5243,U+531d,U+536f,U+53a5,U+53ae,U+53f1,U+541d,U+5431,U+547b,U+5492,U+5494,U+54a4,U+54aa,U+54ce,U+54fd,U+5509,U+5520,U+553e,U+557b,U+55c5,U+55e1,U+55f7,U+5608,U+5636,U+563b,U+5773,U+57a0,U+5811,U+587e,U+58d5,U+59e3,U+5a29,U+5a6a,U+5a76,U+5a7a,U+5ac9,U+5b62,U+5b95,U+5c49,U+5c8c,U+5cab,U+5cb7,U+5d02,U+5d58,U+5e44,U+5e7a,U+5eff,U+5f29,U+5f89,U+5f9c,U+5fa8,U+6005,U+6043,U+60b8,U+60d8,U+60ec,U+60f0,U+6115,U+618e,U+630e,U+637a,U+6390,U+63ac,U+63b0,U+64de,U+6525,U+6538,U+65ee-65ef,U+6631,U+6636,U+6654,U+677c,U+67b8,U+67d8,U+683e,U+6886,U+68b5,U+692d,U+6963,U+6979,U+6988,U+6b59,U+6b9a,U+6c69,U+6c74,U+6cae,U+6ce0,U+6cef,U+6d95,U+6dc5,U+6dde,U+6de6,U+6dfc,U+6ea7,U+6f15,U+6f29,U+7096,U+70c3,U+7131,U+715c,U+7166,U+7266,U+7317,U+731d,U+7329,U+73e9,U+7425,U+7455,U+7490,U+74ef,U+7519,U+75b5,U+75b9,U+75de,U+7656,U+7663,U+7691,U+7729,U+77fe,U+783e,U+787c,U+795a,U+7a79,U+7abf,U+7b3a,U+7b4f,U+7b60,U+7b75,U+7b8d,U+7bb4,U+7bd3,U+7be1,U+7cbc,U+7edb,U+7f1c,U+7f8c,U+7fb2,U+7fb9,U+7fce,U+7ff1,U+810d,U+81c6,U+82a5,U+82aa,U+82de,U+8317,U+8343,U+835e,U+8364,U+836a,U+853a,U+8543,U+854a,U+8559,U+8568,U+85b0,U+85b9,U+864f,U+86e4,U+8715,U+8845,U+8884,U+88e8,U+88f1,U+8983,U+8be1,U+8c1f,U+8c27,U+8c5a,U+8c82,U+8d58,U+8dbe,U+8f98,U+9035,U+9074,U+90a1,U+9149,U+9157,U+93d6,U+949d,U+94c2,U+94e3-94e4,U+95eb,U+95f0,U+9611,U+9619,U+9642,U+968d,U+9706,U+970f,U+97ed,U+988a,U+9893,U+98e8,U+9a77,U+9a87,U+9aa1,U+9abc,U+9cdd,U+9e2f,U+9e33,U+9e44,U+9e5c,U+9e9d,U+9edd" } }, { uri: gf, descriptors: { unicodeRange: "U+4f58,U+4f6c,U+4f70,U+4fd0,U+5014,U+51bd,U+524c,U+5315,U+5323,U+535e,U+540f,U+542d,U+545b,U+548e,U+549a,U+54ab,U+54fc,U+5567,U+556a,U+5600,U+5618,U+563f,U+5669,U+56f1,U+56ff,U+573b,U+574d,U+579b,U+57b8,U+57c2,U+586c,U+58f9,U+595a,U+598d,U+5993,U+5996,U+59d7,U+5b7a,U+5ba6,U+5c4e,U+5c96,U+5ce5,U+5eb6,U+5f08,U+5f99,U+602f,U+6059,U+606c,U+607a,U+60ed,U+61a9,U+620c,U+6249,U+62a8,U+62c4,U+62ed,U+62fd,U+6342,U+6345,U+6396,U+63a3,U+6402,U+6413,U+642a,U+6487,U+64a9,U+64ac,U+64ae,U+64b7,U+659f,U+65a1,U+667e,U+66f3,U+67e0,U+69db,U+69df,U+6aac,U+6b86,U+6c50,U+6c5e,U+6c76,U+6c85,U+6c8c,U+6cde,U+6d19,U+6d52,U+6da7,U+6db8,U+6e1a,U+6e25,U+6e4d,U+6e5f,U+6ec1,U+6f31,U+6f7a,U+6fa7,U+6fe1,U+701b,U+70ab,U+70f7,U+717d,U+71a8,U+7252,U+72c4,U+72e1,U+7315,U+736d,U+73ae,U+73c0,U+73c2,U+740f,U+75a4,U+7600-7601,U+768b,U+76bf,U+76d4,U+7728,U+772f,U+776c,U+77a0,U+77b0,U+77f8,U+783a,U+78d0,U+78fa,U+7977,U+7a37,U+7a92,U+7afa,U+7b71,U+7b94,U+7cef,U+7f28,U+7fe1,U+808b,U+80e5,U+80eb,U+8110,U+8113,U+812f,U+814c,U+81c3,U+8235,U+82d4,U+8309,U+83c1,U+8431,U+8469,U+84bf,U+84d3,U+84df,U+84e6,U+8511,U+8638,U+86c0,U+86db,U+86fe,U+8757,U+8822,U+8882,U+8885,U+8892,U+88f3,U+892a,U+8ba5,U+8bd9,U+8be0,U+8be7,U+8bfd,U+8c1a,U+8d4a,U+8d4e,U+8d66,U+8dda,U+8e0c,U+8e52,U+8e74,U+8e87,U+8f76,U+8fc2,U+8fe6,U+900d,U+9068,U+90ac,U+90b3,U+90b8,U+90e7,U+9119,U+9131,U+915a,U+916e,U+94b4,U+94d0,U+94e2,U+94ec,U+94ff,U+9522,U+9535,U+9556,U+965b,U+96f9,U+9774,U+9981,U+998d,U+998f,U+9a6e,U+9a7f,U+9a8a,U+9b13,U+9c9f,U+9e3e,U+9e43,U+9e6d,U+9e8b,U+9e92,U+9edb,U+9eef" } }, { uri: xf, descriptors: { unicodeRange: "U+4e10,U+4e56,U+4e98,U+4ec3,U+4f3a,U+4f5f,U+4f88,U+4f97,U+4fa5,U+4fe8,U+504c,U+5197,U+52fa,U+5364,U+53e8,U+5406,U+543c,U+545c,U+5471,U+5480,U+5495,U+54b3,U+54df,U+54e6,U+54ee,U+557c,U+5583,U+55dc,U+55e3,U+566c,U+592f,U+5944,U+5983,U+59ca,U+59e5,U+5a13,U+5a7f,U+5b09,U+5bd0,U+5e4c,U+5eb5,U+5f1b,U+5f3c,U+608d,U+60cb,U+61a7,U+61ac,U+61cb,U+6233,U+62a0,U+62e7,U+62ee,U+62f4,U+62f7,U+634e,U+6382,U+63c9,U+63ea,U+6400,U+645e,U+6482,U+6556,U+6593,U+6615,U+664f,U+66e6,U+672d,U+675e,U+67da,U+6805,U+6808,U+6868,U+68a2,U+695e,U+69ad,U+6a80,U+6a90,U+6b83,U+6be1,U+6c30,U+6cad,U+6cb1,U+6cf1,U+6d31,U+6d93,U+6dae,U+6dbf,U+6dc6-6dc7,U+6e0d,U+6e32,U+6e3a,U+6e85,U+6eba,U+6f3e,U+6f5e,U+6f7c,U+6fee,U+71ee,U+722a,U+72b7,U+72e9,U+73ba,U+73d1,U+7409,U+7435-7436,U+7459-745a,U+747e,U+7487,U+74e2,U+7504,U+752c-752d,U+7599,U+759f,U+75a1,U+75ca,U+75f0,U+761f,U+7629,U+777f,U+7785,U+77a5,U+77bf,U+78d5,U+7934,U+7940,U+79a7,U+7b19,U+7c38,U+7c95,U+7cb1,U+7ce0,U+7eca,U+7ef7,U+7f2b,U+7f81,U+7fcc,U+8046,U+8148,U+8165,U+819b,U+81ba,U+828b,U+82ae,U+82b7,U+82d3,U+8301,U+830e,U+831c,U+8338,U+837c,U+8393,U+8398,U+83ba,U+83e0,U+83e9,U+853c,U+8654,U+86df,U+8712,U+873f,U+874e,U+8783,U+8859,U+88a4,U+8925,U+8bb7,U+8bff,U+8c19,U+8c1b,U+8c24,U+8c2c,U+8d61,U+8db4,U+8e6c,U+8f8a,U+8fe5,U+8ff8,U+901e,U+90f4,U+912f,U+9163,U+9170,U+91dc,U+949b,U+94a8,U+94b3,U+94c0,U+94e8,U+9525,U+9530,U+9539,U+954c-954d,U+9550,U+955b,U+962a,U+9685,U+96cc,U+9776,U+988d,U+9975,U+9985,U+9a6f,U+9aa5,U+9ab8,U+9c7f,U+9ca4,U+9cb8,U+9e25,U+9e35,U+9e4a" } }, { uri: hf, descriptors: { unicodeRange: "U+4ea2,U+4ea5,U+4f36,U+4f84,U+4f8d,U+501a,U+5029,U+516e,U+51a5,U+51c4,U+51f8,U+5201,U+527f,U+5321,U+5352,U+5366,U+53e9,U+54c7,U+5632,U+5676,U+56b7,U+56bc,U+56da,U+56e4,U+5703,U+5729,U+5742,U+57a2-57a3,U+5815,U+58d1,U+5919,U+592d,U+5955,U+5a05,U+5a25,U+5a34,U+5b70,U+5b75,U+5bdd,U+5bf0,U+5c41,U+5c79,U+5c91,U+5c94,U+5ce6,U+5ced,U+5d69,U+5dc5,U+5e16,U+5e27,U+5f27,U+5f95,U+5ffb,U+6020,U+604d,U+6055,U+60e6,U+60eb,U+6123,U+618b,U+61a8,U+620d,U+62c7,U+62ce,U+62d9,U+631f,U+634d,U+6452,U+6479,U+64ce,U+64d2,U+655b,U+660a,U+6726,U+67c4,U+6809,U+6853,U+68e3,U+68f1,U+68fa,U+693f,U+6942,U+6995,U+69a8,U+69b4,U+6a71,U+6b89,U+6bcb,U+6bd3,U+6bd9,U+6c40,U+6cf8,U+6cfe,U+6d85,U+6da3,U+6daa,U+6e0e,U+6e43-6e44,U+6f88,U+7078,U+7099,U+70bd,U+70d9,U+70fd,U+7109,U+7184,U+7239,U+733f,U+73f2,U+748b,U+749c,U+749e,U+759a,U+75d2,U+75eb,U+7620,U+766b,U+7693,U+76cf,U+7738,U+773a,U+776b,U+778e,U+77aa,U+7852,U+78be,U+7948,U+795b,U+7960,U+796f,U+79ba,U+7a20,U+7a96,U+7aa5,U+7b03,U+7b28,U+7b50,U+7b77,U+7bc6,U+7bf1,U+7c27,U+7d0a,U+7ead,U+7ec5,U+7ee2,U+7ef0,U+7efd,U+7f0e,U+7f2e,U+7f79,U+7f9a,U+8098,U+80da,U+80e7,U+80f0,U+80f3,U+80fa,U+818a,U+81e7,U+8237-8238,U+8299,U+82b8,U+82ce,U+837b,U+83bd,U+83cf,U+8426,U+8475,U+85c9,U+85d5,U+85dc,U+85e9,U+871a,U+8747,U+8749,U+888d,U+8910,U+891a,U+8bb4,U+8be3,U+8bec,U+8bf2,U+8c06,U+8c0d,U+8d31,U+8d48,U+8de4,U+8e1e,U+8e4a,U+8e66,U+8f84,U+8f97,U+9083,U+90e1,U+9165,U+91c9,U+94b0,U+94f5,U+9504,U+9532,U+956d,U+95f5,U+95fa,U+9668,U+9698,U+96bd,U+9704,U+9773,U+9890,U+996a,U+997a,U+9a74,U+9a8b,U+9cc4,U+9ccc" } }, { uri: yf, descriptors: { unicodeRange: "U+4ea8,U+4f1e,U+4f51,U+4f63,U+4f7c,U+4f83,U+4fa0,U+4fd1,U+4ffa,U+5018,U+5026,U+508d,U+50bb,U+50f5,U+50fb,U+5162,U+5319,U+5320,U+538c,U+5413,U+541f,U+5475,U+54bd,U+54d1,U+5589,U+5598,U+575f,U+57ae,U+57e0,U+5937,U+5974,U+5978,U+59ae,U+5a1f,U+5a49,U+5ab3,U+5b99,U+5b9b,U+5ba0,U+5be1,U+5be5,U+5c09,U+5c27,U+5de2,U+5e9a,U+5f26,U+5f8a,U+5f98,U+6021,U+606d,U+60bc,U+60d5,U+60e7,U+611a,U+614c,U+6254,U+626f,U+6292,U+6296,U+62b9,U+62e2,U+631a,U+631d,U+6320,U+6346,U+63ba,U+6467,U+64bc,U+658b,U+663c,U+6643,U+6652,U+6656,U+6687,U+66d9,U+66dd,U+66f0,U+673d,U+67ab,U+6816-6817,U+68a7,U+68ad,U+68cd,U+68e0,U+6986,U+69fd,U+6b47,U+6bd7,U+6c1f,U+6c2e-6c2f,U+6cbe,U+6de4,U+6e1d,U+6e83,U+6e9c,U+6ed4-6ed5,U+6f4d,U+70f9,U+7130,U+716e,U+718f,U+71ac,U+71e5,U+72fc,U+731c,U+7334,U+73ca,U+7422,U+7426,U+745f,U+7470,U+75af,U+75f4,U+762b,U+763e,U+7696,U+7737,U+7741,U+77a7,U+77bb,U+77ee,U+785d,U+788c,U+78ca,U+7901,U+796d,U+7985,U+79fd,U+7a3c,U+7a57,U+7a74,U+7b5b,U+7caa,U+7cb9,U+7cd5,U+7eac,U+7eb6,U+7ed1,U+7ee5,U+7f20,U+7f2a,U+7f38,U+7f69,U+7fa1,U+8018,U+8038,U+803f,U+804b,U+80a2,U+80be,U+80d6,U+817a,U+81fb,U+820c,U+82ad,U+82af,U+82bd,U+8327,U+8354,U+835f,U+8367,U+836b,U+840c,U+841d,U+8471,U+849c,U+84b2,U+84c9,U+8517,U+851a,U+8549,U+8681,U+8721,U+8776,U+88d9,U+88f9,U+89c5,U+8c1c,U+8c34,U+8d81,U+8d9f,U+8e0a,U+8e72,U+8eb2,U+8fed,U+901b,U+902e,U+906e,U+9091,U+90aa,U+90af,U+915d,U+9171,U+946b,U+9489,U+9499,U+94a5,U+9508,U+9524,U+952d,U+9551,U+9576,U+95f7,U+9600,U+96b6,U+96c0,U+9756,U+97f6,U+98a0,U+98a4,U+997f,U+9a73,U+9a86,U+9ad3,U+9e3d,U+9ed4" } }, { uri: If, descriptors: { unicodeRange: "U+4e4d,U+4e5e,U+4ec7,U+4ed5,U+50da,U+50e7,U+515c,U+51a4,U+51ff,U+5203,U+5254,U+5300,U+533e,U+5375,U+53ee,U+5435,U+543b,U+5455,U+548b,U+548f,U+54d7,U+54fa,U+5578,U+5587,U+55a7,U+560e,U+5760,U+576f,U+5777,U+5830,U+58a9,U+5962,U+59e8,U+5a07,U+5a23,U+5a3c,U+5b5a,U+5bb5,U+5bc5,U+5bde,U+5c7f,U+5cb1,U+5ce8,U+5cea,U+5d29,U+5d4c,U+5e18,U+5f57,U+5f5d,U+5f87,U+5ff1,U+6016,U+601c,U+6064,U+6177,U+61d2,U+625b,U+62e3,U+62f1,U+634f,U+63a0,U+6401,U+6405,U+6495,U+64c2,U+6512,U+6577,U+6590,U+65a7,U+65a9,U+65f7,U+6627,U+6655,U+6714,U+6795,U+67d1,U+67ff,U+68b3,U+68d5,U+68d8,U+6930,U+6960,U+6977,U+69bb,U+69d0,U+6a31,U+6b7c,U+6bb4,U+6c22,U+6c72,U+6c79,U+6c7e,U+6c81,U+6c93,U+6ca5,U+6cbc,U+6ce3,U+6cfb,U+6d3c,U+6da9,U+6df3,U+6e2d,U+6eaf,U+6ec7,U+6f13,U+6f33,U+6f62,U+6fa1,U+7011,U+707c,U+708a,U+70c1,U+70d8,U+70eb,U+711a,U+7194,U+7281,U+7316,U+7357,U+7384,U+7405,U+742a,U+745b,U+7574,U+7578,U+75ea,U+7682,U+7792,U+77d7,U+77e9,U+77eb,U+77f6,U+780c,U+78c5,U+7941,U+79e4,U+7a1a,U+7a9c,U+7ad6,U+7b5d,U+7bf7,U+7c07,U+7c3f,U+7c9f,U+7ca5,U+7cdf,U+7e82,U+7eab,U+7ece,U+7eda,U+7f09,U+7f15,U+7f9e,U+7fdf,U+7fe9,U+803b,U+803d,U+80aa,U+80b4,U+813e,U+8155,U+817b,U+819d,U+821c,U+82b9,U+82df,U+82ef,U+8304,U+83b9,U+8446,U+853d,U+85af,U+85fb,U+8650,U+865e,U+86d9,U+86ee,U+8700,U+8862,U+889c,U+88d4,U+88f8,U+895f,U+8a79,U+8bb3,U+8bb6,U+8bc0,U+8beb,U+8bf5,U+8c23,U+8c79,U+8d1e,U+8dcb,U+8e29,U+8e44,U+8e81,U+8eac,U+8eaf,U+8f8d,U+9050,U+90f8,U+914b,U+948a,U+94be,U+94ee,U+950c,U+9540,U+962e,U+9647,U+9661,U+9699,U+96cf,U+9716,U+9761,U+97a0,U+97e7,U+9a7c,U+9a8f,U+9ae6,U+9cd6,U+9e26" } }, { uri: wf, descriptors: { unicodeRange: "U+4fa3,U+4fae,U+4fd8,U+4fef,U+50a3,U+5189,U+5195,U+51db,U+51f3,U+51f9,U+5220,U+5228,U+5288,U+52ff,U+532e,U+533f,U+5351,U+53db,U+53ed,U+5450,U+5484,U+5490,U+54c9,U+54e9,U+5501,U+5507,U+5543,U+55d3,U+56a3,U+575e,U+589f,U+5984,U+59ec,U+5a04,U+5a36,U+5a77,U+5a9a-5a9b,U+5ab2,U+5ac2,U+5ad6,U+5bc7,U+5c2c,U+5c34,U+5c51,U+5cd9,U+5d0e,U+5deb,U+5e3c,U+5e87,U+5ed3,U+5f13,U+5f64,U+5fe1,U+606a,U+6096,U+60df,U+60f6,U+60f9,U+6151,U+620e,U+6241,U+6252,U+6273,U+627c,U+6289,U+62c2,U+62cc,U+62ef,U+6361,U+6363,U+63b7,U+63e3,U+6518,U+66ae,U+6756,U+6789,U+6813,U+6829,U+6862,U+6866,U+6893,U+6897,U+690e,U+6984,U+69cc,U+6a1f,U+6a44,U+6a59,U+6ba1,U+6c13,U+6c90,U+6ca6,U+6cbd,U+6ccc,U+6cd3,U+6cd7,U+6d4a,U+6d4f,U+6d5a,U+6d9f,U+6da1,U+6dcc,U+6ea5,U+6ee4,U+6ee6,U+6f2f,U+6f8e,U+701a,U+7095,U+709c,U+70af,U+70db,U+70e8,U+714e,U+715e,U+71a0,U+71ce,U+7235,U+7280,U+72d0,U+72f8,U+73ab,U+7410,U+745c,U+7480,U+74a7-74a8,U+74e3,U+75ae,U+75f9,U+76b1,U+76ce,U+7736,U+77e2-77e3,U+781a,U+789f,U+797a,U+79be,U+79c3,U+79c6,U+79f8,U+7a8d,U+7a98,U+7aa6,U+7aff,U+7b1b,U+7cd9,U+7d6e,U+7ede,U+7eee,U+7f00,U+7f24,U+7f2d,U+7fd8,U+800d,U+8116,U+8151,U+81b3,U+8205,U+82c7,U+82db,U+832c,U+8335,U+8339,U+8386,U+846b,U+8587,U+8611,U+8682,U+868a,U+868c,U+8774,U+88d8,U+88f4,U+8912,U+8b6c,U+8bbd,U+8c0e,U+8c41,U+8d26,U+8d3b-8d3c,U+8d50,U+8dea,U+8e35,U+8f99,U+8fe2,U+8fe9,U+9017,U+914c,U+916f,U+9175-9176,U+918b,U+94a0,U+94ae,U+94ce,U+94f2,U+951a,U+952f,U+9541,U+9640,U+9672,U+968b,U+96cd,U+96ef,U+9713,U+97ec,U+9885,U+9992,U+9a6d,U+9a79,U+9a85,U+9cbb,U+9cd7,U+9cde,U+9e93,U+9f9f" } }, { uri: Rf, descriptors: { unicodeRange: "U+4e11,U+4ed7,U+4fcf,U+4fe9,U+4fed,U+50ac,U+50b2,U+5112,U+5180,U+5188,U+51f6,U+522e,U+5265,U+52cb,U+52df,U+5349,U+5367,U+5378,U+537f,U+5395,U+5398,U+53d4,U+543e,U+5440,U+5446,U+54b8,U+5565-5566,U+5580,U+55bb,U+56ca,U+572d,U+573e,U+574e,U+5782-5784,U+58f3,U+5938-5939,U+5948,U+594e,U+5a1c,U+5a74,U+5ae9,U+5b55,U+5b5c,U+5bb0,U+5bd3,U+5bf8,U+5c3f,U+5d14,U+5d2d,U+5df7,U+5dfe,U+5e05-5e06,U+5e1c,U+5e62,U+5e7b,U+5e7d,U+5ed6,U+5f2f,U+5f66,U+5f6c,U+5fa1,U+604b,U+609f,U+60a6,U+60e8,U+6101,U+6124,U+6127,U+6148,U+61be,U+6247,U+62d8,U+62da,U+633d,U+635e,U+6367,U+6380,U+638f,U+63a9,U+63fd,U+641c,U+64e6,U+655e,U+6572,U+6591,U+65a5,U+6691,U+6735,U+67a2-67a3,U+67ef,U+680b,U+6876,U+6905,U+6a0a,U+6a61,U+6b79,U+6bb7,U+6bbf,U+6c41,U+6c55,U+6c83,U+6c9b,U+6ca7,U+6cfc,U+6d46,U+6d51,U+6d74,U+6d9d,U+6daf,U+6dc0,U+6deb,U+6e17,U+6e24,U+6e89,U+6ea2,U+6ef4,U+6f6d,U+707f,U+70b3,U+70e4,U+70ef,U+710a,U+722c,U+725f,U+7261,U+72ee,U+72f1,U+730e,U+732b,U+7433,U+7538,U+75bc,U+7624,U+7709,U+7750,U+7779,U+7802,U+7898,U+78a7,U+78b1,U+78cb,U+78f7,U+7984,U+7a83,U+7aed,U+7b3c,U+7b4b,U+7c92,U+7c98,U+7ca4,U+7eb9,U+7ee3,U+7ef3,U+7ef5,U+7f05,U+7f55,U+7f62,U+7fc1,U+7fd4,U+7fe0,U+8042,U+806a,U+80a0,U+80a4,U+80c3,U+8102,U+8106,U+814a,U+8154,U+8247,U+8258,U+82cd,U+8328,U+832b,U+8389,U+83ca,U+845b,U+846c,U+84b8,U+8574,U+859b,U+8680,U+8695,U+86c7,U+8702,U+886c,U+8896,U+88b1,U+88e4,U+8bc8,U+8c10,U+8c26,U+8c28,U+8c2d,U+8d4c,U+8d63,U+8f67,U+8f74,U+8fc4,U+9006,U+9063,U+90a2,U+90b1,U+90c1,U+9177,U+9189,U+9493,U+949e,U+94fe,U+9610,U+961c,U+96a7,U+96fe,U+978d,U+97f5,U+9888,U+997c,U+9a84,U+9b3c,U+9b44-9b45,U+9b54,U+9e64,U+9f0e,U+9f9a" } }, { uri: Tf, descriptors: { unicodeRange: "U+4e19,U+4e38,U+4e53,U+4e7e,U+4e9f,U+4ec6,U+4f50,U+4fde,U+502a,U+5154,U+517d,U+51d1,U+51f0,U+5239,U+5256,U+52c9,U+52fe,U+5308,U+532a,U+535c,U+5384,U+53a2,U+53a8,U+53c9,U+53e0,U+5496,U+54ac,U+54c0,U+54c4,U+54e8,U+5561,U+5582,U+561b,U+5631,U+566a,U+5764,U+576a,U+5792,U+57ab,U+584c,U+5885,U+58f6,U+59a8,U+5acc,U+5bc2,U+5c38-5c39,U+5c60,U+5c6f,U+5c82,U+5c90,U+5d16,U+5dcd,U+5e37,U+5e90,U+5eb8,U+5f6a,U+5fcc,U+6012,U+6068,U+6073,U+607c,U+6094,U+6109,U+621a,U+626e,U+6284,U+62d0,U+62e6,U+62fe,U+6321,U+6328,U+632b,U+6349,U+6454,U+65ed,U+660f,U+6674,U+66a8,U+6749,U+674f,U+6760,U+67af,U+6850,U+6854,U+6869,U+68a8,U+68d2,U+68f5,U+6912,U+6b49,U+6b6a,U+6bef,U+6c28,U+6c5d,U+6c82,U+6cab,U+6cb8,U+6cc4,U+6cf5,U+6d47,U+6d78,U+6da4,U+6dc4,U+6dcb,U+6df9,U+6e0a,U+6e23,U+6e5b,U+6eb6,U+6f06,U+6f47,U+6f84,U+6f9c,U+6fd2,U+7076,U+70ac,U+7199,U+723d,U+72ac,U+72ed,U+7476,U+7529,U+752b,U+754f,U+7554,U+75d5,U+7626,U+76ef,U+7720,U+7766,U+7784,U+77ac,U+780d,U+7838,U+7845,U+786b,U+78b3,U+7978,U+79b9,U+79c9,U+79e7,U+7a3d,U+7a84,U+7a9f,U+7b0b,U+7b52,U+7c7d,U+7f1a,U+7fc5,U+7ff0,U+804a,U+8086-8087,U+808c,U+809a,U+80ba,U+810a,U+8180,U+818f,U+81c2,U+81ed,U+8231,U+8292,U+829c,U+82a6,U+82d1,U+8346,U+838e,U+839e,U+83c7,U+83f1,U+8403,U+840e,U+8513,U+857e,U+85e4,U+867e,U+871c,U+87ba,U+87f9,U+884d,U+8944,U+8a93,U+8c05,U+8d2c,U+8d2e,U+8d42-8d43,U+8dfb,U+8e22,U+8eba,U+8f69,U+8f9c,U+8fa3,U+8fa8,U+8fb1,U+900a,U+9038,U+903b,U+9042,U+904f,U+90b5,U+90dd,U+9102,U+9187,U+94a7,U+94c5,U+9523,U+95f8,U+95fd,U+960e,U+964b-964c,U+96c1,U+9709,U+971c,U+97ad,U+9882,U+9965,U+9976,U+9988,U+99a8,U+9a82,U+9a9a,U+9b41,U+9c8d,U+9e45,U+9e70,U+9e9f,U+9f3b,U+9f7f" } }, { uri: Mf, descriptors: { unicodeRange: "U+4e08,U+4e18,U+4e1b,U+4e22,U+4e27,U+4e32,U+4e52,U+4e73,U+4ead,U+4ed4,U+4ed9,U+4ef0,U+4fa6,U+5076,U+5179,U+51bb,U+51c9,U+51ef,U+51fd,U+524a,U+526a,U+529d,U+52ab,U+5306,U+5339,U+53d9,U+540a,U+5410,U+541e,U+5439,U+54b1,U+54ed,U+5564,U+558a,U+55b7,U+5634,U+574a,U+5751,U+57a6,U+57cb,U+57d4,U+5824,U+582a,U+5835,U+5858,U+5893,U+58e4,U+5951,U+5986,U+59da,U+59fb,U+59ff,U+5a03,U+5a46,U+5ac1,U+5b5d,U+5bfa,U+5c18,U+5c3a,U+5c48,U+5c4f,U+5c61,U+5cb3,U+5d1b,U+5e15,U+5e3d,U+5e99,U+5e9e,U+5eca,U+5f0a,U+5f17-5f18,U+5f25,U+5f7c,U+5fcd,U+6028,U+60a0,U+60ac,U+60d1,U+614e,U+6155,U+6168,U+61c8,U+6208,U+6212,U+6251,U+629a-629b,U+62ab-62ac,U+62fc,U+6323,U+632a,U+63d2,U+643a,U+6491-6492,U+649e,U+64b0,U+64c5,U+659c,U+6614,U+662d,U+6664,U+6670,U+6676,U+6746,U+67cf,U+67d4,U+682a,U+6843,U+6846,U+68da,U+6b3a,U+6b67,U+6c27,U+6c5b,U+6c64,U+6c70,U+6caa,U+6cca,U+6ce1,U+6d12,U+6d45,U+6dd1,U+6dd8,U+6e34,U+6e7f,U+6ee5,U+6f02,U+7092,U+70c2,U+70e6,U+7115,U+7237,U+7272,U+727a,U+72c2,U+739b,U+73b2,U+743c,U+751c,U+758f,U+75b2,U+7686,U+76c6,U+76d2,U+76fc,U+775b,U+77a9,U+7816,U+788e,U+7897,U+78b0,U+79bd,U+7a0d,U+7a91,U+7a9d,U+7ae3,U+7bad,U+7cca,U+7d2b,U+7eb1,U+7f06,U+7f14,U+7f1d,U+7f50,U+7ffc,U+8036,U+80bf,U+80c1,U+80ce,U+80f8,U+8109,U+810f,U+8170,U+8179,U+819c,U+821f,U+8230,U+8236,U+8273,U+829d,U+82f9,U+8305,U+8350,U+83b2,U+83cc,U+8404,U+840d,U+8427,U+8482,U+8679,U+8854,U+886b,U+8bbc,U+8be6,U+8c31,U+8c6b,U+8d4b,U+8dcc,U+8e2a,U+8e48,U+8f90,U+8fb0,U+9022,U+903c,U+903e,U+9065,U+916c,U+917f,U+94a9,U+94c3,U+94dd,U+94ed,U+9510,U+953b,U+96c7,U+970d,U+9738,U+9877,U+987d,U+989c,U+98d8,U+9a70,U+9a91,U+9aa4,U+9b42,U+9b4f,U+9e2d,U+9e3f,U+9e7f,U+9f20" } }, { uri: Lf, descriptors: { unicodeRange: "U+4e59,U+4ed3,U+4f0f,U+4f38,U+4f69,U+4fa7,U+4faf,U+4ff1,U+5077,U+5085,U+5144,U+5151,U+51af,U+51b6,U+51cc,U+523a,U+5251,U+5269,U+5272,U+52d8,U+5353,U+5389,U+53f9,U+5401,U+5415,U+541b,U+54f2,U+5524,U+554a,U+559d,U+5609,U+5740,U+575d,U+5806,U+5821,U+586b,U+5915,U+594f,U+5960,U+5999,U+59a5,U+59b9,U+59c6,U+59d1,U+59dc,U+5b5f,U+5b64,U+5b87,U+5bb4,U+5bbf,U+5c16,U+5c1d,U+5c3e,U+5c9a,U+5ca9,U+5cad,U+5cfb,U+5de1,U+5de7,U+5de9,U+5ef7,U+5f04,U+5f70,U+5f79,U+5fc6,U+602a,U+6050,U+6052,U+6070,U+6084,U+60b2,U+60dc,U+60e9,U+6167,U+6170,U+61c2,U+6270,U+6291,U+62b1,U+62bc,U+62dc,U+62df,U+62f3,U+6324,U+633a,U+6377,U+6398,U+63cf,U+640f,U+642c-642d,U+6458,U+6478,U+6500,U+654c,U+6566,U+658c,U+65c1,U+65cb,U+65e8,U+65ec,U+6696-6697,U+6734,U+679a,U+679d,U+67dc,U+67f3-67f4,U+680f,U+683d,U+684c,U+68af,U+699c,U+6bc1,U+6c0f,U+6c1b,U+6c57,U+6c6a,U+6d3d,U+6d6e,U+6d82,U+6db5,U+6dee,U+6e58,U+6eaa,U+6ecb,U+6ede,U+6ee9,U+6f0f,U+6f20,U+6f58,U+704c,U+7070,U+70b8,U+718a,U+7238,U+7262,U+7275,U+72b9,U+72d7,U+72e0,U+741b,U+7434,U+7483,U+74f6-74f7,U+75ab,U+764c,U+7761,U+7855,U+7891,U+78c1,U+79d2,U+7a00,U+7a3b,U+7c97,U+7ea4,U+7eb2,U+7ed2,U+7eea,U+7ef8,U+7f18,U+7fbd,U+8000,U+8010,U+8096,U+809d,U+80a9,U+817f,U+81e3,U+8206,U+8212,U+82ac,U+8302,U+8361,U+8377,U+83f2,U+8461,U+848b,U+84ec,U+8521,U+85aa,U+8870,U+8877,U+8881,U+888b,U+88ad,U+88c2,U+8986,U+8bd1,U+8bf1,U+8d24,U+8d2a,U+8d3e-8d3f,U+8d41,U+8d56,U+8d64,U+8d6b,U+8e0f,U+8f70,U+8f85,U+8f88,U+8fa9,U+9003,U+901d,U+90b9,U+90ce,U+94a6,U+94f8,U+9505,U+95ea,U+95ef,U+95f2,U+95f9,U+9601,U+9605,U+9634,U+966a,U+9677,U+9690,U+9694,U+96d5,U+971e,U+9896-9897,U+9972,U+9a71,U+9a76,U+9a7e,U+9e1f,U+9e23" } }, { uri: Df, descriptors: { unicodeRange: "U+4e01,U+4e43,U+4ea6,U+4ef2,U+4eff,U+4f26,U+4f2a,U+4f2f,U+4f5b,U+4fa8,U+4fca,U+4fd7,U+5021,U+504f,U+5141,U+51c0,U+51dd,U+51e4,U+51ed,U+5200,U+5237,U+5427,U+5448,U+54a8,U+5706,U+5708,U+5723,U+575b,U+57c3,U+5899,U+58a8,U+58c1,U+5976,U+5988,U+59bb,U+59d0,U+59d3,U+5a18,U+5a31,U+5a92,U+5b54,U+5b85,U+5baa-5bab,U+5bc4,U+5bd2,U+5be8,U+5bff,U+5c65,U+5d07,U+5e1d,U+5e78,U+5e7c,U+5f03,U+5f1f,U+5f39,U+5f6d,U+5f92,U+5faa,U+5fbd,U+5fe7,U+5ffd,U+60a8,U+60ef,U+6108,U+6162,U+622a,U+6234,U+626b,U+626d,U+62c6,U+62d2,U+62d4,U+62d6,U+62e8,U+6316,U+6355,U+63ed,U+6447,U+64a4,U+65f1,U+6606,U+6628,U+664b,U+6668,U+6682,U+66f9,U+66fc,U+66ff,U+6717,U+6740,U+676d,U+67aa,U+67ec,U+67f1,U+6842,U+6851,U+695a,U+6982,U+6a2a,U+6b20,U+6b23,U+6b32,U+6b96,U+6bc5,U+6beb,U+6c60,U+6c9f,U+6cea,U+6cf3,U+6d1e,U+6d53,U+6d66,U+6d69,U+6d8c,U+6d9b,U+6db2,U+6de1,U+6dfb,U+6e14,U+6ed1,U+6eda,U+6ee8,U+6f2b,U+706d,U+7089,U+708e,U+70ad-70ae,U+70e7,U+7126,U+714c,U+71c3,U+71d5,U+7206,U+7259,U+731b,U+73a9,U+73bb,U+74dc,U+7532,U+7545,U+755c,U+75c7,U+7687,U+76d7,U+76f2,U+788d,U+78e8,U+79e6,U+79e9,U+7a3f,U+7a46,U+7a97,U+7af9,U+7bee,U+7c4d,U+7c89,U+7cd6,U+7eb5,U+7ebd,U+7ed8,U+8017,U+8033,U+80c0,U+80de,U+80f6,U+8138,U+817e,U+81a8,U+820d,U+827e,U+82b3,U+82d7,U+83b1,U+84c4,U+84dd,U+8584,U+864e,U+865a,U+866b,U+86cb,U+88d5,U+89e6,U+8bca,U+8bde,U+8bfa,U+8c0a,U+8c37,U+8c46,U+8c6a,U+8c8c,U+8d1d,U+8d29,U+8d4f,U+8d54,U+8d5a,U+8d60,U+8d62,U+8f7f,U+8f96,U+8f9e-8f9f,U+8fc1,U+8fdf,U+8fea,U+8ff7,U+9012,U+906d,U+9075,U+90a6,U+90bb,U+90ca,U+9178,U+9192,U+91ca,U+94bb,U+94dc,U+94fa,U+9501,U+950b,U+9521,U+955c,U+963b,U+9655,U+9675-9676,U+9887,U+9891,U+9971,U+9a97,U+9ece,U+9ed8" } }, { uri: Sf, descriptors: { unicodeRange: "U+4e1d,U+4e39,U+4e4c,U+4e4f,U+4e54,U+4e58,U+4e95,U+4ea1,U+4eab,U+4eae,U+4ec1,U+4f10,U+4f19,U+4f30,U+4f34,U+4fb5,U+503e,U+518c,U+5192,U+51a0,U+51ac,U+51b0,U+51e1,U+5211,U+5242,U+52a3,U+52b2,U+52c3,U+52c7,U+52d2,U+52e4,U+5377,U+539a,U+53a6,U+53e5,U+5417,U+5510,U+552f,U+5531,U+574f-5750,U+5761,U+5851,U+5854,U+58ee,U+593a,U+5949,U+5954,U+5a5a,U+5b8b,U+5bbd,U+5c04,U+5c0a,U+5c4b,U+5ce1,U+5cf0,U+5e10,U+5e8a,U+5e9f,U+5ec9,U+5f31,U+5f84,U+5fd8-5fd9,U+5fe0,U+6015,U+6062,U+6069,U+6076,U+6089,U+60a3,U+60ca,U+620f,U+624e,U+6263,U+6298,U+62a2,U+62bd,U+6311,U+6350,U+6389,U+638c,U+63f4,U+6446,U+644a,U+6469,U+64cd,U+654f,U+6562,U+656c,U+65d7,U+65e6,U+65fa,U+660c,U+6653,U+66b4,U+670b,U+672b,U+676f-6770,U+6881,U+6885,U+68a6,U+68cb,U+68ee,U+6b8a,U+6c88-6c89,U+6cc9,U+6ce5,U+6d01,U+6d17,U+6d1b,U+6d59,U+6d6a,U+6da8,U+6df7,U+6e10,U+6e20-6e21,U+6f5c,U+706f,U+70bc,U+719f,U+7267,U+732a,U+73cd,U+7518,U+756a,U+7586,U+7591,U+75db,U+76c8,U+76d0,U+76d6,U+76d8,U+76df,U+76fe,U+77db,U+7801,U+786c,U+795d,U+7965,U+79cb,U+7a77,U+7a7f,U+7aef,U+7b11,U+7bb1,U+7bc7,U+7ea0,U+7eaf,U+7ed5,U+7edc,U+7f13,U+7f29,U+7f34,U+7f8a,U+7ffb,U+8015,U+8058,U+805a,U+8083,U+80af,U+80c6,U+80cc,U+811a,U+8150,U+82e5,U+8336,U+8352,U+83ab,U+8428,U+8463,U+852c,U+8861,U+89c8,U+8bcd,U+8bd7,U+8bda,U+8be2,U+8bef,U+8bf8,U+8c0b,U+8c13,U+8d34,U+8d3a,U+8d74,U+8d76,U+8da3,U+8dd1,U+8ddd,U+8ddf,U+8df3,U+8f68,U+8f6f,U+8f7d,U+8f91,U+8f9b,U+8fbd,U+8fc8,U+8fd4,U+8feb,U+8ff9,U+900f,U+9057,U+907f-9080,U+90d1,U+90ed,U+91ce,U+9519,U+9526,U+95ed,U+9614,U+9635,U+9644,U+9686,U+96c5,U+96ea,U+9707,U+9732,U+9759,U+978b,U+9876,U+9881,U+9910,U+996e,U+9970,U+9c81,U+9e21,U+9ebb,U+9f84" } }, { uri: vf, descriptors: { unicodeRange: "U+4e3d,U+4e4e,U+4e71,U+4e8f,U+4ed8,U+4eea,U+4f0a,U+4f0d,U+4f11,U+4f1f,U+4f24,U+4f3c,U+4f73,U+4fc4,U+500d,U+5012,U+501f,U+503a,U+505c,U+507f,U+50a8,U+514d,U+5178,U+517c,U+51b2,U+51b7,U+520a,U+5238,U+523b,U+52b1,U+535a,U+5371,U+5385,U+53eb-53ec,U+53f3,U+53f6,U+5409,U+542b,U+542f,U+5434,U+5462,U+5473,U+547c,U+54c8,U+54ea,U+56fa,U+5733,U+5757,U+5766,U+5802,U+585e,U+590f,U+591c,U+591f,U+5947,U+594b,U+5987,U+5a01,U+5b59,U+5b63,U+5b88,U+5b97,U+5b9c,U+5bbe,U+5bfb,U+5c01,U+5c1a,U+5c24,U+5c3c,U+5c97,U+5c9b,U+5cb8,U+5de6,U+5e01,U+5e2e,U+5e45,U+5e55,U+5e84,U+5ef6,U+5f02,U+5f52,U+5f69,U+5f7b,U+5f90,U+5fae,U+6000,U+600e,U+6025,U+60e0,U+6276,U+6297,U+62b5,U+62cd,U+62d3,U+62e5,U+62e9,U+62ff,U+6302,U+632f,U+63e1,U+6444,U+64ad,U+653b,U+6551,U+6563,U+65a4,U+65e7,U+6620,U+667a,U+66f2,U+671d,U+6731,U+6742,U+675f,U+6768,U+677e-677f,U+6790,U+67b6,U+67d3,U+6863,U+68b0,U+68c9,U+690d,U+6b8b,U+6bcd,U+6bd2,U+6bd5,U+6c38,U+6c61,U+6cbf,U+6cdb,U+6cf0,U+6d2a,U+6d89,U+6da6,U+6f6e,U+6fb3,U+7075,U+707e,U+70df,U+7164,U+7236,U+725b,U+7389,U+73e0,U+745e,U+74e6,U+751a,U+7537,U+75be,U+76ae,U+76db,U+793c,U+7956,U+7981,U+79d8,U+79df,U+79fb,U+7adf,U+7ae5,U+7b14,U+7b26,U+7b54,U+7b79,U+7d2f,U+7eb8,U+7eba,U+7ec6,U+7ee9,U+7eff,U+7f5a,U+7f6a,U+7f72,U+8089,U+80a5,U+80e1,U+8111,U+8131,U+821e,U+822c,U+8270,U+8499,U+8651,U+867d,U+8840,U+8857,U+8863,U+88c1,U+89c9,U+89d2,U+8a89,U+8bed,U+8bfe,U+8c01,U+8c22,U+8d21,U+8d25,U+8d2f,U+8d5e,U+8d75,U+8d8b,U+8dc3,U+8de8,U+8df5,U+8f6e,U+8f86,U+8f89,U+8fc5,U+8ff0,U+8ffd,U+9014,U+904d,U+90ae,U+9274,U+949f,U+952e,U+969c,U+96c4,U+96e8,U+96f6-96f7,U+97e9,U+987f,U+996d,U+9a7b,U+9aa8,U+9c7c,U+9c9c,U+9e4f,U+9f13,U+9f50" } }, { uri: $f, descriptors: { unicodeRange: "U+4e13,U+4e16,U+4e1c,U+4e24,U+4e3e,U+4e49,U+4e61,U+4e66,U+4e89,U+4e8c,U+4e94,U+4e9b,U+4ea4,U+4eac,U+4ebf,U+4eca,U+4ef6-4ef7,U+4efb,U+4f18,U+4f20,U+4f46,U+4f7f,U+4fe1,U+503c,U+505a,U+5146,U+5148,U+515a,U+5171,U+5177,U+519b,U+51b3,U+51c6,U+51e0,U+5212,U+521b,U+522b,U+529e,U+52bf,U+534e-534f,U+5355,U+5357,U+5382,U+539f,U+53bb,U+53bf,U+53c2,U+53c8,U+53ca,U+53d6-53d8,U+53e3,U+53ea,U+53f0,U+540d,U+5411,U+56db,U+56de,U+56e0,U+56e2,U+578b,U+57ce,U+57fa,U+589e,U+5904,U+5934,U+5982,U+5b89,U+5b8c,U+5bfc,U+5c06,U+5c11,U+5c40,U+5c71,U+5e38,U+5e72,U+5e76,U+5e7f,U+5e94,U+5e9c,U+5f0f,U+5f15,U+5f20,U+5f3a,U+5f62,U+5f88,U+5fc5,U+5fd7,U+5feb,U+601d,U+6027,U+60c5,U+60f3,U+610f,U+6216,U+6218,U+624b,U+624d,U+6279,U+628a,U+6295,U+6301,U+6307,U+636e,U+63a5,U+63a8,U+652f,U+6536,U+653e,U+6548,U+6559,U+6570,U+65bd,U+65e0,U+6602,U+660e,U+6613,U+66f4,U+6700,U+670d,U+671f,U+672f,U+6743,U+674e,U+6751,U+6761,U+6784,U+6797,U+679c,U+67e5,U+6807,U+6837,U+683c,U+6b21,U+6b63-6b65,U+6bcf,U+6bd4,U+6c42,U+6c5f,U+6ca1,U+6cbb,U+6d3b,U+6d41,U+6d88,U+6df1,U+70b9,U+7136,U+7269,U+7279,U+7531,U+754c,U+767e,U+76ca,U+76f8,U+770b,U+7740,U+7814,U+79ef,U+7a0b,U+7a0e,U+7a76,U+7b80,U+7cbe,U+7cfb,U+7e41,U+7ea7,U+7ec4,U+7ec7,U+7ed3,U+7ed9,U+7edf,U+7f8e,U+8001,U+804c,U+8054,U+80b2,U+81f3,U+8425,U+8868,U+88ab,U+897f,U+89c1-89c2,U+89c4,U+89c6,U+89e3,U+8ba1,U+8ba4,U+8bae,U+8bb0,U+8bba,U+8bc1,U+8c03,U+8d28,U+8d39,U+8def,U+8f66,U+8f6c,U+8fd0-8fd1,U+9020,U+9053,U+90a3,U+90fd,U+91cc,U+9500,U+9547,U+95e8,U+95f4,U+961f,U+9645,U+9662,U+96be,U+96c6,U+9700,U+9769,U+97e6,U+9875,U+9879,U+9886,U+9898,U+98ce,U+9996,U+2b5af,U+2cc56,U+2e9f5,U+30edd-30ede" } }, { uri: Pf, descriptors: { unicodeRange: "U+4e03,U+4e30,U+4e34,U+4e45,U+4e60,U+4e70,U+4e88,U+4e91-4e92,U+4ea9,U+4eb2,U+4ec0,U+4ecb,U+4ecd,U+4ee4,U+4fee,U+5019,U+5047,U+50cf,U+5145,U+516d,U+5170,U+5175,U+5199,U+51cf,U+51fb,U+521a,U+5224,U+5267,U+52aa,U+5347-5348,U+534a,U+5356,U+5361,U+536b,U+5370,U+538b,U+53e4,U+53e6,U+5403,U+5426,U+5428,U+542c,U+5438,U+5668,U+56ed,U+56f4,U+56fe,U+57df,U+592a,U+5957,U+5b69,U+5b81,U+5b8f,U+5b98,U+5b9d,U+5ba1,U+5ba4,U+5bb3,U+5bc6,U+5bdf,U+5c3d,U+5c5e,U+5c81,U+5ddd,U+5de8,U+5dee,U+5e0c,U+5e86,U+5e8f,U+5e93,U+5e95,U+5e97,U+5ea7,U+5ead,U+5eb7,U+5f55,U+5f81,U+5f85,U+5ff5,U+6001,U+613f,U+6258,U+6267,U+6269,U+626c,U+627e,U+62db,U+62ec,U+6325,U+635f,U+6362,U+6388,U+6392,U+63a2,U+63a7,U+63aa,U+641e,U+6545,U+6597,U+65e2,U+65e9,U+661f,U+665a,U+666e-666f,U+66fe,U+6728,U+67d0,U+6811,U+6838,U+6865,U+697c,U+6b22,U+6b27,U+6b4c,U+6b62,U+6b66,U+6b7b,U+6bdb,U+6c47,U+6c49,U+6c7d,U+6c99,U+6cfd,U+6d0b,U+6d25,U+6d32,U+6d3e,U+6d4b,U+6e29,U+6e56,U+6e7e,U+6f14,U+6fc0,U+706b,U+70c8,U+7247,U+72af,U+72b6,U+72ec,U+732e,U+73ed,U+7403,U+7533,U+753b,U+7559,U+7565,U+7597,U+767b,U+773c,U+7763,U+77ed,U+77ff,U+7968,U+798f,U+79bb,U+79c0-79c1,U+7ad9,U+7ae0,U+7b51,U+7b7e,U+7cae,U+7d22,U+7ea2,U+7eb3,U+7eb7,U+7ec3,U+7ec8,U+7ecd,U+7edd,U+7efc,U+7f16,U+7f3a,U+7f51,U+7f57,U+7f6e,U+80dc,U+822a,U+8239,U+826f,U+82cf,U+82e6,U+8349,U+8363,U+83dc,U+8457,U+85cf,U+878d,U+8865,U+8a00,U+8b66,U+8ba2,U+8ba8,U+8bad,U+8bb2,U+8bc9,U+8bd5,U+8bfb,U+8d2b,U+8d35,U+8d37,U+8f7b,U+8f93,U+8fce,U+8fdd,U+9000-9002,U+9010,U+9047,U+9093,U+9152,U+9488,U+94a2,U+9633,U+9636,U+963f,U+9646,U+9648,U+964d,U+9664,U+9669,U+9760,U+97f3,U+987a,U+987e,U+9884,U+98de,U+9986,U+9ed1" } }, { uri: Nf, descriptors: { unicodeRange: "U+4e14,U+4e25,U+4e48,U+4e50,U+4e5d,U+4e9a,U+4ec5,U+4efd,U+4f17,U+4f4e-4f4f,U+4f55,U+4f59,U+4f60,U+4f8b,U+4f9b,U+4f9d,U+4fbf,U+4fc3,U+5065,U+513f,U+5149,U+514b,U+516b,U+5174,U+517b,U+518d,U+51b5,U+5207,U+5217-5219,U+521d,U+526f,U+529f,U+52a9,U+52b3,U+5305,U+533b,U+5343,U+5360,U+5373-5374,U+5386,U+53cb-53cd,U+53f2,U+53f7,U+544a,U+5468,U+547d,U+54cd,U+552e,U+5584,U+56f0,U+571f,U+5747,U+575a,U+57f9,U+5883,U+58eb,U+58f0,U+5907,U+590d,U+592e,U+5931,U+5956,U+5965,U+5973,U+5979,U+59cb,U+5b57-5b58,U+5b83,U+5ba2-5ba3,U+5bb9,U+5bcc,U+5c42,U+5c45,U+5c4a,U+5dde,U+5df1,U+5df4,U+5e03,U+5e08,U+5e26,U+5e2d,U+5f71,U+5f80,U+5f8b,U+5fb7,U+606f,U+611f,U+6237,U+623f,U+6253,U+627f,U+6293,U+62a4,U+62c5,U+62c9,U+6309,U+6574,U+6599,U+65ad,U+65af,U+65c5,U+65cf,U+6625,U+663e,U+671b,U+672a,U+6750,U+6781,U+6821,U+6839,U+6848,U+68c0,U+6a21,U+6b3e,U+6bb5,U+6c14,U+6cb3,U+6cb9,U+6ce8,U+6e05,U+6e2f,U+6e38,U+6e90,U+6ee1,U+70ed,U+7167,U+7231,U+7248,U+724c,U+7387,U+738b,U+73af,U+7530,U+75c5,U+767d,U+76d1,U+76f4,U+771f,U+77e5,U+77f3,U+7834,U+7840,U+786e,U+793a,U+795e,U+79f0,U+7a33,U+7a7a,U+7a81,U+7ade,U+7b56,U+7b97,U+7c73,U+7c7b,U+7d20,U+7d27,U+7ea6,U+7eaa,U+7ebf,U+7ee7,U+7eed,U+7ef4,U+7fa4,U+8003,U+80a1,U+81f4,U+8272,U+827a,U+8282,U+82b1,U+82f1,U+8303,U+836f,U+83b7,U+843d,U+88c5,U+8ba9,U+8baf,U+8bb8,U+8bbf,U+8bc4,U+8bc6,U+8bdd,U+8be5,U+8bf7,U+8c08,U+8c61,U+8d1f,U+8d22-8d23,U+8d27,U+8d2d,U+8d38,U+8d5b,U+8d70,U+8d85,U+8d8a,U+8db3,U+8eab,U+8f83,U+8fb9,U+8fdc,U+8fde,U+9009,U+901f,U+914d,U+91c7,U+94b1,U+94c1,U+94f6,U+95fb,U+9632,U+9650,U+968f,U+9752,U+975e,U+987b,U+989d,U+98df,U+9999,U+9a6c,U+9a8c,U+9ec4,U+9feb-9fec" } }, { uri: Ff, descriptors: { unicodeRange: "U+98fb-990c,U+990e-990f,U+9911-992d,U+992f-9953,U+9956-9962,U+9964,U+9966,U+9973,U+9978-9979,U+997b,U+997e,U+9982-9983,U+9989,U+998c,U+998e,U+999a-99a4,U+99a6-99a7,U+99a9-99c8" } }, { uri: Bf, descriptors: { unicodeRange: "U+8e4c-8e50,U+8e53-8e58,U+8e5a-8e65,U+8e67-8e68,U+8e6a-8e6b,U+8e6e,U+8e71,U+8e73,U+8e75,U+8e77-8e7b,U+8e7d-8e7e,U+8e80,U+8e82-8e84,U+8e86,U+8e88-8e8e,U+8e91-8e93,U+8e95-8e9b,U+8e9d,U+8e9f-8eaa,U+8ead-8eae,U+8eb0-8eb1,U+8eb3-8eb9,U+8ebb-8ecd,U+8ecf-8f02" } }, { uri: _f, descriptors: { unicodeRange: "U+2e3a,U+3001-3002,U+3008-3011,U+3014-3017,U+301d-301f,U+4dae,U+4e00,U+4e07,U+4e09-4e0b,U+4e0d-4e0e,U+4e1a,U+4e2a,U+4e2d,U+4e3a-4e3b,U+4e4b,U+4e5f,U+4e86,U+4e8b,U+4e8e,U+4ea7,U+4eba,U+4ece,U+4ed1,U+4ed6,U+4ee3,U+4ee5,U+4eec,U+4f01,U+4f1a,U+4f4d,U+4f53,U+4f5c,U+4fdd,U+5143,U+5165,U+5168,U+516c,U+5173,U+5176,U+5185,U+519c,U+51fa,U+5206,U+5229,U+5230,U+5236,U+524d,U+529b,U+52a0-52a1,U+52a8,U+5316-5317,U+533a,U+5341,U+5362,U+53d1,U+53ef,U+53f8,U+5404,U+5408,U+540c,U+540e,U+5458,U+548c,U+54c1,U+54e5,U+5546,U+559c,U+56fd,U+5728,U+5730,U+573a,U+5916,U+591a,U+5927,U+5929,U+592b,U+597d,U+59d4,U+5b50,U+5b66,U+5b9a,U+5b9e,U+5bb6,U+5bf9,U+5c0f,U+5c14,U+5c31,U+5c55,U+5de5,U+5df2,U+5e02,U+5e73-5e74,U+5ea6,U+5efa,U+5f00,U+5f53,U+5f97,U+5fc3,U+603b,U+6210-6211,U+6240,U+6280,U+62a5,U+63d0,U+6539,U+653f,U+6587,U+65b0,U+65b9,U+65e5,U+65f6,U+662f,U+6708-6709,U+672c,U+673a,U+675c,U+6765,U+6c11,U+6c34,U+6cd5,U+6ce2,U+6d4e,U+6d77,U+73b0,U+7406,U+751f,U+7528,U+7535,U+7684,U+76ee,U+793e,U+79cd,U+79d1,U+7acb,U+7b2c,U+7b49,U+7ba1,U+7ecf,U+8005,U+800c,U+80fd,U+81ea,U+884c,U+8981,U+8bbe,U+8bf4,U+8d44,U+8d77,U+8fbe,U+8fc7,U+8fd8-8fd9,U+8fdb,U+901a,U+90e8,U+91cd,U+91cf,U+91d1,U+9485,U+957f,U+95ee,U+9762,U+9ad8,U+9ea6,U+9f99,U+9fcf,U+9fd4,U+9fed,U+fe10-fe19,U+fe30-fe31,U+fe33-fe44,U+ff01,U+ff0c,U+ff1f,U+2b4e7,U+2b7f7,U+2b7fc,U+2cb2d,U+2cb3b,U+2cb4a,U+2cb5b,U+2cb73" } }, { uri: Of, descriptors: { unicodeRange: "U+6490,U+6493-6494,U+6497-6498,U+649a-649d,U+649f-64a3,U+64a5-64a8,U+64aa-64ab,U+64af,U+64b1-64b4,U+64b6,U+64b9,U+64bb,U+64bd-64bf,U+64c1,U+64c3-64c4,U+64c6-64cc,U+64cf,U+64d1,U+64d3-64d6,U+64d9-64dd,U+64df-64e1,U+64e3,U+64e5,U+64e7-64ff,U+6501-6508,U+650a-6511,U+6513-6517,U+6519-6524,U+6526-652a,U+652c-652d,U+6530-6533,U+6537,U+653a,U+653c-653d,U+6540-6544,U+6546-6547,U+654a-654b,U+654d-654e,U+6550,U+6552-6554,U+6557-6558,U+655a,U+655c,U+655f-6561,U+6564-6565,U+6567-6568" } }, { uri: Af, descriptors: { unicodeRange: "U+9695-9696,U+969a-969b,U+969d-96a6,U+96a8-96af,U+96b1-96b2,U+96b4-96b5,U+96b7-96b8,U+96ba-96bb,U+96bf,U+96c2-96c3,U+96c8,U+96ca-96cb,U+96d0-96d1,U+96d3-96d4,U+96d6-96df,U+96e1-96e7,U+96eb-96ee,U+96f0-96f2,U+96f4-96f5,U+96f8,U+96fa-96fd,U+96ff,U+9702-9703,U+9705,U+970a-970c,U+9710-9712,U+9714-9715,U+9717-971b,U+971d,U+971f-9729,U+972b-972c,U+972e-972f,U+9731,U+9733-9737,U+973a-973d,U+973f-9751,U+9754-9755,U+9757-9758,U+975a,U+975c-975d,U+975f,U+9763-9764,U+9766-9768,U+976a-9770" } }, { uri: Kf, descriptors: { unicodeRange: "U+6af0-6b1f,U+6b25-6b26,U+6b28-6b31,U+6b33-6b36,U+6b38,U+6b3b-6b3d,U+6b3f-6b42,U+6b44-6b45,U+6b48,U+6b4a-6b4b,U+6b4d-6b58,U+6b5a-6b61,U+6b68-6b69,U+6b6b-6b78,U+6b7a,U+6b7d-6b80,U+6b85,U+6b88,U+6b8c,U+6b8e-6b91,U+6b94-6b95,U+6b97-6b99,U+6b9c-6ba0,U+6ba2-6ba9,U+6bab-6bb2,U+6bb6,U+6bb8-6bba" } }, { uri: Hf, descriptors: { unicodeRange: "U+430e-439a,U+29e8a,U+29ec4,U+29edb,U+29ee9,U+29f7e,U+29f83,U+29f8c,U+29fce,U+2a01a,U+2a02f,U+2a082,U+2a0f9,U+2a190,U+2a38c" } }, { uri: Jf, descriptors: { unicodeRange: "U+92ef-933d,U+933f-9369,U+936b-9388" } }, { uri: Yf, descriptors: { unicodeRange: "U+4512-458d,U+2b300,U+2b363,U+2b36f,U+2b372,U+2b37d,U+2b404,U+2b410,U+2b413,U+2b461,U+2b4ef,U+2b4f6,U+2b4f9,U+2b50d-2b50e,U+2b536,U+2b5ae,U+2b5b3,U+2b5e7,U+2b5f4,U+2b61c-2b61d,U+2b626-2b628,U+2b62a,U+2b62c,U+2b695-2b696,U+2b6ad,U+2b6ed" } }, { uri: Cf, descriptors: { unicodeRange: "U+88bd-88c0,U+88c3-88c4,U+88c7-88c8,U+88ca-88cd,U+88cf-88d1,U+88d3,U+88d6-88d7,U+88da-88de,U+88e0-88e1,U+88e6-88e7,U+88e9-88ef,U+88f2,U+88f5-88f7,U+88fa-88fb,U+88fd,U+88ff-8901,U+8903-8909,U+890b-890f,U+8911,U+8914-8918,U+891c-8920,U+8922-8924,U+8926-8929,U+892c-892f,U+8931-8933,U+8935,U+8937-8940,U+8942-8943,U+8945-895d,U+8960-8965,U+8967-897a,U+897c-897e,U+8980,U+8982,U+8984-8985" } }, { uri: Vf, descriptors: { unicodeRange: "U+4b0b-4ba0" } }, { uri: qf, descriptors: { unicodeRange: "U+7179,U+717b-717c,U+717e-7183,U+7185-7189,U+718b-718e,U+7190-7193,U+7195-7197,U+719a-719e,U+71a1-71a7,U+71a9-71ab,U+71ad-71b2,U+71b4,U+71b6-71b8,U+71ba-71c2,U+71c4-71cd,U+71cf-71d3,U+71d6-71df,U+71e1-71e4,U+71e6,U+71e8-71ed,U+71ef-71f8,U+71fa-7205,U+7207-721c,U+721e-7227,U+7229,U+722b,U+722d" } }, { uri: Xf, descriptors: { unicodeRange: "U+982e-9874,U+988b,U+988e,U+9892,U+9895,U+9899,U+98a3,U+98a8-98cd,U+98cf-98d0,U+98d4,U+98d6-98d7,U+98db-98dd,U+98e0-98e6,U+98e9-98fa" } }, { uri: Gf, descriptors: { unicodeRange: "U+7c14-7c15,U+7c17-7c1e,U+7c20-7c25,U+7c28-7c29,U+7c2b-7c37,U+7c39-7c3e,U+7c42-7c4c,U+7c4e-7c72,U+7c75-7c7a,U+7c7e-7c88,U+7c8a-7c90,U+7c93-7c94,U+7c96,U+7c99-7c9b,U+7ca0-7ca1,U+7ca3,U+7ca6-7ca9,U+7cab-7cad,U+7caf-7cb0,U+7cb4-7cb8,U+7cba-7cbb,U+7cbf-7cc0,U+7cc2-7cc4,U+7cc6,U+7cc9,U+7ccb,U+7cce-7cd4" } }, { uri: kf, descriptors: { unicodeRange: "U+7d95-7da5,U+7da7-7dad,U+7daf-7e2a" } }, { uri: Zf, descriptors: { unicodeRange: "U+4a78-4b0a" } }, { uri: Wf, descriptors: { unicodeRange: "U+9b30-9b31,U+9b33-9b3a,U+9b3d-9b40,U+9b46,U+9b4a-9b4c,U+9b4e,U+9b50,U+9b52-9b53,U+9b55-9bcf" } }, { uri: zf, descriptors: { unicodeRange: "U+6a4b-6a4f,U+6a51-6a57,U+6a5a,U+6a5c-6a60,U+6a62-6a64,U+6a66-6a70,U+6a72-6a78,U+6a7a-6a7b,U+6a7d-6a7f,U+6a81-6a83,U+6a85-6a8d,U+6a8f,U+6a92-6a96,U+6a98-6a9f,U+6aa1-6aa8,U+6aaa,U+6aad-6aef" } }, { uri: Qf, descriptors: { unicodeRange: "U+99c9-9a53" } }, { uri: jf, descriptors: { unicodeRange: "U+8550-8555,U+8557-8558,U+855a-855d,U+855f-8563,U+8565-8567,U+8569-8571,U+8573,U+8575-8578,U+857c-857d,U+857f-8583,U+8586,U+8588-858e,U+8590-859a,U+859d-85a3,U+85a5-85a7,U+85a9,U+85ab-85ad,U+85b1-85b6,U+85b8,U+85ba-85c0,U+85c2-85c8,U+85ca-85ce,U+85d1-85d2,U+85d4,U+85d6-85db,U+85dd-85e3,U+85e5-85e8,U+85ea-85fa,U+85fc-85fe,U+8600-8603" } }, { uri: e1, descriptors: { unicodeRange: "U+6fb2,U+6fb4-6fb5,U+6fb7-6fb8,U+6fba-6fbf,U+6fc1,U+6fc3-6fc8,U+6fca-6fd0,U+6fd3-6fdd,U+6fdf,U+6fe2-6fed,U+6ff0-7010,U+7012-7019,U+701c-7022,U+7024-7034,U+7036-7038,U+703a-704b,U+704d-704e,U+7050-7053" } }, { uri: t1, descriptors: { unicodeRange: "U+4ba1-4c2c" } }, { uri: n1, descriptors: { unicodeRange: "U+9a54-9a6b,U+9a72,U+9a83,U+9a89,U+9a8d-9a8e,U+9a94-9a95,U+9a99,U+9aa6,U+9aa9-9aaf,U+9ab2-9ab5,U+9ab9,U+9abb,U+9abd-9abf,U+9ac3-9ac4,U+9ac6-9aca,U+9acd-9ad0,U+9ad2,U+9ad4-9ad7,U+9ad9-9ade,U+9ae0,U+9ae2-9ae5,U+9ae7-9aea,U+9aec,U+9aee,U+9af0-9af8,U+9afa,U+9afc-9b02,U+9b04-9b07,U+9b09-9b0e,U+9b10-9b12,U+9b14-9b1e,U+9b20-9b22,U+9b24-9b2e" } }, { uri: r1, descriptors: { unicodeRange: "U+9d1a-9da1" } }, { uri: o1, descriptors: { unicodeRange: "U+9e13-9e1e,U+9e24,U+9e27,U+9e2e,U+9e30,U+9e34,U+9e3b-9e3c,U+9e40,U+9e4d,U+9e50,U+9e52-9e54,U+9e56,U+9e59,U+9e5d,U+9e5f-9e62,U+9e65,U+9e6e-9e6f,U+9e72,U+9e74-9e7d,U+9e80-9e81,U+9e83-9e86,U+9e89-9e8a,U+9e8c-9e91,U+9e94-9e9c,U+9e9e,U+9ea0-9ea5,U+9ea7-9eb3,U+9eb5-9eb7,U+9eb9-9eba,U+9ebc,U+9ebf-9ec3,U+9ec5-9ec8,U+9eca-9ecc,U+9ed0,U+9ed2-9ed3,U+9ed5-9ed7,U+9ed9-9eda,U+9ede,U+9ee1,U+9ee3-9ee4,U+9ee6,U+9ee8,U+9eeb-9eee,U+9ef0-9ef8" } }, { uri: i1, descriptors: { unicodeRange: "U+8b1c-8b25,U+8b27-8b65,U+8b67-8b6b,U+8b6d-8b9f,U+8bac,U+8bb1,U+8bbb,U+8bc7,U+8bd0" } }, { uri: a1, descriptors: { unicodeRange: "U+4cad-4d2f" } }, { uri: s1, descriptors: { unicodeRange: "U+9c4b-9c7b,U+9c7d-9c7e,U+9c80,U+9c83-9c84,U+9c89-9c8a,U+9c8c,U+9c8f,U+9c93,U+9c96-9c99,U+9c9d,U+9caa,U+9cac,U+9caf,U+9cb9,U+9cbe-9cc2,U+9cc8-9cc9,U+9cd1-9cd2,U+9cda-9cdb,U+9ce0-9ce1,U+9ce3-9d19" } }, { uri: d1, descriptors: { unicodeRange: "U+9389-938e,U+9390-93c9,U+93cb-93d5,U+93d7-9410" } }, { uri: c1, descriptors: { unicodeRange: "U+20a0-20b5,U+20b9-20ba,U+20bc-20bd,U+4e2c,U+5107,U+5216,U+5293,U+54f3,U+5523,U+5819,U+5adc,U+5c88,U+5e3b,U+5fee,U+62f6,U+63be,U+6484,U+6499,U+67d9,U+67dd,U+6d5e,U+6f46,U+717a,U+71e0,U+72c1,U+73e7,U+75b0,U+7603,U+7722,U+7809,U+7811,U+7946,U+7967,U+799a,U+7b45,U+7ba2,U+8014,U+80d9,U+8159,U+817d,U+81a3,U+81aa,U+8201,U+833c,U+836e,U+83e5,U+8459,U+84f0,U+8729,U+8753,U+87d3,U+89dc,U+8bf6,U+8c2e,U+8e2c,U+8e9c,U+8e9e,U+8ece,U+8fee,U+9139,U+914f,U+9174,U+9191,U+960c,U+9622,U+9a98,U+9b48,U+9ca6,U+9cb0,U+9da2-9e12,U+9e88,U+9f44,U+9f86" } }, { uri: l1, descriptors: { unicodeRange: "U+9bd0-9c4a" } }, { uri: U1, descriptors: { unicodeRange: "U+4c2d-4cac" } }, { uri: f1, descriptors: { unicodeRange: "U+4d30-4dab" } }, { uri: p1, descriptors: { unicodeRange: "U+9411-943d,U+943f-946a,U+946c-9484" } }, { uri: u1, descriptors: { unicodeRange: "U+9efa,U+9efd,U+9eff-9f0a,U+9f0c,U+9f0f,U+9f11-9f12,U+9f14-9f16,U+9f18,U+9f1a-9f1f,U+9f21,U+9f23-9f2b,U+9f2d-9f2e,U+9f30-9f36,U+9f38,U+9f3a,U+9f3c,U+9f3f-9f43,U+9f45-9f4f,U+9f52-9f7e,U+9f81-9f82,U+9f8d-9f94" } }, { uri: m1, descriptors: { unicodeRange: "U+7e2b-7e3a,U+7e3c-7e40,U+7e42-7e46,U+7e48-7e81,U+7e83-7e9a,U+7e9c-7e9e,U+7eae,U+7eb4,U+7ebb-7ebc,U+7ed6,U+7ee4,U+7eec,U+7ef9,U+7f0a,U+7f10,U+7f1e,U+7f37,U+7f39,U+7f3b" } }];
var ne = class ne2 {
  constructor(t3) {
    i(this, "scene");
    i(this, "getSceneFamilies", () => ne2.getUniqueFamilies(this.scene.getNonDeletedElements()));
    i(this, "onLoaded", (t5) => {
      let n3 = true;
      for (let i3 of t5) {
        let a3 = `${i3.family}-${i3.style}-${i3.weight}-${i3.unicodeRange}`;
        ne2.loadedFontsCache.has(a3) || (ne2.loadedFontsCache.add(a3), n3 = false);
      }
      if (n3) return;
      let r = false, o3 = this.scene.getNonDeletedElementsMap();
      for (let i3 of this.scene.getNonDeletedElements()) if (k(i3)) {
        r = true, he2.delete(i3), $n.clearCache(Ee(i3));
        let a3 = qe(i3, o3);
        a3 && he2.delete(a3);
      }
      r && this.scene.triggerUpdate();
    });
    i(this, "loadSceneFonts", async () => {
      let t5 = this.getSceneFamilies(), n3 = ne2.getCharsPerFamily(this.scene.getNonDeletedElements());
      return ne2.loadFontFaces(t5, n3);
    });
    this.scene = t3;
  }
  static get registered() {
    return ne2._registered ? ne2._initialized || (ne2._registered = new Map([...ne2.init().entries(), ...ne2._registered.entries()])) : ne2._registered = ne2.init(), ne2._registered;
  }
  get registered() {
    return ne2.registered;
  }
  static async generateFontFaceDeclarations(t3) {
    let n3 = ne2.getUniqueFamilies(t3), r = ne2.getCharsPerFamily(t3), o3 = n3.find((d) => bo(d).includes(Mn));
    if (o3) {
      let d = ne2.getCharacters(r, o3);
      if (Sd(d)) {
        let c3 = Un[Mn];
        r[c3] = new Set(d), n3.unshift(Un[Mn]);
      }
    }
    let i3 = ne2.fontFacesStylesGenerator(n3, r), a3 = 3, s3 = await new vr(i3, a3).all();
    return Array.from(new Set(s3));
  }
  static async loadFontFaces(t3, n3) {
    for (let { fontFaces: a3, metadata: s3 } of ne2.registered.values()) if (!s3.local) for (let { fontFace: d } of a3) window.document.fonts.has(d) || window.document.fonts.add(d);
    let r = ne2.fontFacesLoader(t3, n3), o3 = 10;
    return (await new vr(r, o3).all()).flat().filter(Boolean);
  }
  static *fontFacesLoader(t3, n3) {
    for (let [r, o3] of t3.entries()) {
      let i3 = Ee({ fontFamily: o3, fontSize: 16 }), a3 = ne2.getCharacters(n3, o3);
      window.document.fonts.check(i3, a3) || (yield mn(async () => {
        try {
          let s3 = await window.document.fonts.load(i3, a3);
          return [r, s3];
        } catch (s3) {
          console.error(`Failed to load font "${i3}" from urls "${ne2.registered.get(o3)?.fontFaces.map((d) => d.urls)}"`, s3);
        }
      }));
    }
  }
  static *fontFacesStylesGenerator(t3, n3) {
    for (let [r, o3] of t3.entries()) {
      let { fontFaces: i3, metadata: a3 } = ne2.registered.get(o3) ?? {};
      if (!Array.isArray(i3)) {
        console.error(`Couldn't find registered fonts for font-family "${o3}"`, ne2.registered);
        continue;
      }
      if (!a3?.local) for (let [s3, d] of i3.entries()) yield mn(async () => {
        try {
          let c3 = ne2.getCharacters(n3, o3), l3 = await d.toCSS(c3);
          return l3 ? [r * 1e4 + s3, l3] : void 0;
        } catch (c3) {
          console.error(`Couldn't transform font-face to css for family "${d.fontFace.family}"`, c3);
        }
      });
    }
  }
  static register(t3, n3, ...r) {
    let o3 = Ie[t3] ?? Un[t3];
    return this.registered.get(o3) || this.registered.set(o3, { metadata: n3, fontFaces: r.map(({ uri: a3, descriptors: s3 }) => new Xo(t3, a3, s3)) }), this.registered;
  }
  static init() {
    let t3 = { registered: /* @__PURE__ */ new Map() }, n3 = (r, ...o3) => {
      let i3 = Ie[r] ?? Un[r], a3 = Fr[i3] ?? Fr[Ie.Excalifont];
      ne2.register.call(t3, r, a3, ...o3);
    };
    return n3("Cascadia", ...Gd), n3("Comic Shanns", ...Qd), n3("Excalifont", ...sc), n3("Helvetica", ...dc), n3("Liberation Sans", ...lc), n3("Lilita One", ...pc), n3("Nunito", ...xc), n3("Virgil", ...yc), n3(Mn, ...b1), n3(Tn, ...jd), ne2._initialized = true, t3.registered;
  }
  static getUniqueFamilies(t3) {
    return Array.from(t3.reduce((n3, r) => (k(r) && n3.add(r.fontFamily), n3), /* @__PURE__ */ new Set()));
  }
  static getCharsPerFamily(t3) {
    let n3 = {};
    for (let r of t3) if (k(r)) for (let o3 of r.originalText) n3[r.fontFamily] || (n3[r.fontFamily] = /* @__PURE__ */ new Set()), n3[r.fontFamily].add(o3);
    return n3;
  }
  static getCharacters(t3, n3) {
    return t3[n3] ? Array.from(t3[n3]).join("") : "";
  }
  static getAllFamilies() {
    return Array.from(ne2.registered.keys());
  }
};
i(ne, "loadedFontsCache", /* @__PURE__ */ new Set()), i(ne, "_registered"), i(ne, "_initialized", false), i(ne, "loadElementsFonts", async (t3) => {
  let n3 = ne.getUniqueFamilies(t3), r = ne.getCharsPerFamily(t3);
  return ne.loadFontFaces(n3, r);
});
var Nn = ne;
var Go = (e8, t3, n3) => {
  let { unitsPerEm: r, ascender: o3, descender: i3 } = Nn.registered.get(e8)?.metadata.metrics || Fr[Ie.Virgil].metrics, a3 = t3 / r, s3 = (n3 - a3 * o3 + a3 * i3) / 2;
  return a3 * o3 + s3;
};
var ko = (e8) => {
  let { lineHeight: t3 } = Nn.registered.get(e8)?.metadata.metrics || Fr[Ie.Excalifont].metrics;
  return t3;
};
var Zo = (e8) => {
  let { angle: t3, width: n3, height: r, x: o3, y: i3 } = e8, a3 = o3 + n3 / 2, s3 = i3 + r / 2, d = u(a3, s3), c3;
  return e8.type === "diamond" ? c3 = Qi(T(u(a3, i3), d, t3), T(u(o3 + n3, s3), d, t3), T(u(a3, i3 + r), d, t3), T(u(o3, s3), d, t3)) : c3 = Qi(T(u(o3, i3), d, t3), T(u(o3 + n3, i3), d, t3), T(u(o3 + n3, i3 + r), d, t3), T(u(o3, i3 + r), d, t3)), { type: "polygon", data: c3 };
};
var f$ = (e8, t3, n3 = 10) => {
  let [r, o3, i3, a3, s3, d] = C2(e8, t3, true);
  r -= n3, i3 += n3, o3 -= n3, a3 += n3;
  let c3 = u(s3, d), l3 = T(u(r, o3), c3, e8.angle), U = T(u(i3, o3), c3, e8.angle), p = T(u(r, a3), c3, e8.angle), m = T(u(i3, a3), c3, e8.angle);
  return { type: "polygon", data: [l3, U, m, p] };
};
var E1 = (e8) => {
  let { width: t3, height: n3, angle: r, x: o3, y: i3 } = e8;
  return { type: "ellipse", data: { center: u(o3 + t3 / 2, i3 + n3 / 2), angle: r, halfWidth: t3 / 2, halfHeight: n3 / 2 } };
};
var It = (e8) => {
  if (!e8) return [];
  for (let t3 of e8.sets) if (t3.type === "path") return t3.ops;
  return e8.sets[0].ops;
};
var g1 = (e8, t3 = u(0, 0), n3, r) => {
  let o3 = (d) => T(u(d[0] + t3[0], d[1] + t3[1]), r, n3), i3 = It(e8), a3 = [], s3 = u(0, 0);
  for (let d of i3) {
    if (d.op === "move") {
      let c3 = Ir(d.data);
      Ae(c3 != null, "Ops data is not a point"), s3 = o3(c3);
    }
    if (d.op === "bcurveTo") {
      let c3 = o3(u(d.data[0], d.data[1])), l3 = o3(u(d.data[2], d.data[3])), U = o3(u(d.data[4], d.data[5]));
      a3.push(Et(s3, c3, l3, U)), s3 = U;
    }
  }
  return { type: "polycurve", data: a3 };
};
var um = (e8) => {
  let t3 = e8[0], n3 = [];
  for (let r = 1; r < e8.length; r++) {
    let o3 = e8[r];
    n3.push(A2(t3, o3)), t3 = o3;
  }
  return n3;
};
var x1 = (e8, t3, n3 = false) => {
  let r = (i3) => T(q(st(O(i3), Be(e8.x, e8.y))), t3, e8.angle), o3 = um(e8.points.map((i3) => r(i3)));
  return n3 ? { type: "polygon", data: Gn(o3.flat()) } : { type: "polyline", data: o3 };
};
var h1 = (e8, t3, n3 = u(0, 0), r, o3) => {
  let i3 = (l3) => T(u(l3[0] + n3[0], l3[1] + n3[1]), o3, r);
  if (e8.roundness === null) return { type: "polygon", data: Gn(e8.points.map((l3) => i3(l3))) };
  let a3 = It(t3), s3 = [], d = false;
  for (let l3 of a3) l3.op === "move" ? (d = !d, d && s3.push(u(l3.data[0], l3.data[1]))) : l3.op === "bcurveTo" ? d && (s3.push(u(l3.data[0], l3.data[1])), s3.push(u(l3.data[2], l3.data[3])), s3.push(u(l3.data[4], l3.data[5]))) : l3.op === "lineTo" && d && s3.push(u(l3.data[0], l3.data[1]));
  let c3 = pointsOnBezierCurves2(s3, 10, 5).map((l3) => i3(l3));
  return { type: "polygon", data: Gn(c3) };
};
var mm = (e8, t3) => {
  let { angle: n3, halfWidth: r, halfHeight: o3, center: i3 } = t3, a3 = r, s3 = o3, d = st(O(e8), ue2(O(i3), -1)), [c3, l3] = T(q(d), u(0, 0), -n3), U = Math.abs(c3), p = Math.abs(l3), m = 0.707, b3 = 0.707;
  for (let h = 0; h < 3; h++) {
    let x = a3 * m, y = s3 * b3, w = (a3 * a3 - s3 * s3) * m ** 3 / a3, I = (s3 * s3 - a3 * a3) * b3 ** 3 / s3, S = x - w, v = y - I, D = U - w, $3 = p - I, N = Math.hypot(v, S), B3 = Math.hypot($3, D);
    m = Math.min(1, Math.max(0, (D * N / B3 + w) / a3)), b3 = Math.min(1, Math.max(0, ($3 * N / B3 + I) / s3));
    let _ = Math.hypot(b3, m);
    m /= _, b3 /= _;
  }
  let [E, g] = [a3 * m * Math.sign(c3), s3 * b3 * Math.sign(l3)];
  return ie2(u(c3, l3), u(E, g));
};
var y1 = (e8, t3, n3 = 1e-4) => mm(e8, t3) <= n3;
var I1 = (e8, t3) => {
  let { center: n3, angle: r, halfWidth: o3, halfHeight: i3 } = t3, a3 = st(O(e8), ue2(O(n3), -1)), [s3, d] = T(q(a3), u(0, 0), -r);
  return s3 / o3 * (s3 / o3) + d / i3 * (d / i3) <= 1;
};
var _r = (e8, t3, n3 = 0) => {
  switch (t3.type) {
    case "polygon":
      return dd(e8, t3.data, n3);
    case "ellipse":
      return y1(e8, t3.data, n3);
    case "line":
      return Bt(e8, t3.data, n3);
    case "polyline":
      return R1(e8, t3.data, n3);
    case "curve":
      return w1(e8, t3.data, n3);
    case "polycurve":
      return bm(e8, t3.data, n3);
    default:
      throw Error(`shape ${t3} is not implemented`);
  }
};
var Wo = (e8, t3) => {
  switch (t3.type) {
    case "polygon":
      return ji(e8, t3.data);
    case "line":
      return false;
    case "curve":
      return false;
    case "ellipse":
      return I1(e8, t3.data);
    case "polyline": {
      let n3 = Gn(t3.data.flat());
      return ji(e8, n3);
    }
    case "polycurve":
      return false;
    default:
      throw Error(`shape ${t3} is not implemented`);
  }
};
var bm = (e8, t3, n3) => t3.some((r) => w1(e8, r, n3));
var Em = (e8) => {
  let [t3, n3, r, o3] = e8;
  return (i3, a3) => Math.pow(1 - i3, 3) * o3[a3] + 3 * i3 * Math.pow(1 - i3, 2) * r[a3] + 3 * Math.pow(i3, 2) * (1 - i3) * n3[a3] + t3[a3] * Math.pow(i3, 3);
};
var gm = (e8, t3 = 10) => {
  let n3 = Em(e8), r = [n3(0, 0), n3(0, 1)], o3 = [], i3 = 0, a3 = 1 / t3;
  for (let s3 = 0; s3 < t3; s3++) if (i3 += a3, i3 <= 1) {
    let d = u(n3(i3, 0), n3(i3, 1));
    o3.push(A2(r, d)), r = d;
  }
  return o3;
};
var w1 = (e8, t3, n3) => R1(e8, gm(t3), n3);
var R1 = (e8, t3, n3 = 1e-4) => t3.some((r) => Bt(e8, r, n3));
function zo(e8, t3, n3) {
  return { center: e8, halfWidth: t3, halfHeight: n3 };
}
var T1 = (e8, t3) => {
  let { halfWidth: n3, halfHeight: r, center: o3 } = t3, i3 = n3, a3 = r, s3 = st(O(e8), ue2(O(o3), -1)), d = Math.abs(s3[0]), c3 = Math.abs(s3[1]), l3 = 0.707, U = 0.707;
  for (let b3 = 0; b3 < 3; b3++) {
    let E = i3 * l3, g = a3 * U, h = (i3 * i3 - a3 * a3) * l3 ** 3 / i3, x = (a3 * a3 - i3 * i3) * U ** 3 / a3, y = E - h, w = g - x, I = d - h, S = c3 - x, v = Math.hypot(w, y), D = Math.hypot(S, I);
    l3 = Math.min(1, Math.max(0, (I * v / D + h) / i3)), U = Math.min(1, Math.max(0, (S * v / D + x) / a3));
    let $3 = Math.hypot(U, l3);
    l3 /= $3, U /= $3;
  }
  let [p, m] = [i3 * l3 * Math.sign(s3[0]), a3 * U * Math.sign(s3[1])];
  return ie2(q(s3), u(p, m));
};
function M1({ center: e8, halfWidth: t3, halfHeight: n3 }, [r, o3]) {
  let [i3, a3] = e8, s3 = r[0] - i3, d = r[1] - a3, c3 = o3[0] - i3, l3 = o3[1] - a3, U = Math.pow(c3 - s3, 2) / Math.pow(t3, 2) + Math.pow(l3 - d, 2) / Math.pow(n3, 2), p = 2 * (s3 * (c3 - s3) / Math.pow(t3, 2) + d * (l3 - d) / Math.pow(n3, 2)), m = Math.pow(s3, 2) / Math.pow(t3, 2) + Math.pow(d, 2) / Math.pow(n3, 2) - 1, b3 = (-p + Math.sqrt(Math.pow(p, 2) - 4 * U * m)) / (2 * U), E = (-p - Math.sqrt(Math.pow(p, 2) - 4 * U * m)) / (2 * U), g = [u(s3 + b3 * (c3 - s3) + i3, d + b3 * (l3 - d) + a3), u(s3 + E * (c3 - s3) + i3, d + E * (l3 - d) + a3)].filter((h) => !isNaN(h[0]) && !isNaN(h[1]));
  return g.length === 2 && _e(g[0], g[1]) ? [g[0]] : g;
}
function Qo(e8, t3 = 0) {
  let n3 = it(Math.min(e8.width, e8.height), e8);
  if (n3 <= 0) {
    let p = Tr(u(e8.x - t3, e8.y - t3), u(e8.x + e8.width + t3, e8.y + e8.height + t3)), m = A2(u(p[0][0] + n3, p[0][1]), u(p[1][0] - n3, p[0][1])), b3 = A2(u(p[1][0], p[0][1] + n3), u(p[1][0], p[1][1] - n3)), E = A2(u(p[0][0] + n3, p[1][1]), u(p[1][0] - n3, p[1][1])), g = A2(u(p[0][0], p[1][1] - n3), u(p[0][0], p[0][1] + n3));
    return [[m, b3, E, g], []];
  }
  let r = u(e8.x + e8.width / 2, e8.y + e8.height / 2), o3 = Tr(u(e8.x, e8.y), u(e8.x + e8.width, e8.y + e8.height)), i3 = A2(u(o3[0][0] + n3, o3[0][1]), u(o3[1][0] - n3, o3[0][1])), a3 = A2(u(o3[1][0], o3[0][1] + n3), u(o3[1][0], o3[1][1] - n3)), s3 = A2(u(o3[0][0] + n3, o3[1][1]), u(o3[1][0] - n3, o3[1][1])), d = A2(u(o3[0][0], o3[1][1] - n3), u(o3[0][0], o3[0][1] + n3)), c3 = [ue2(Je(O(u(o3[0][0] - t3, o3[0][1] - t3), r)), t3), ue2(Je(O(u(o3[1][0] + t3, o3[0][1] - t3), r)), t3), ue2(Je(O(u(o3[1][0] + t3, o3[1][1] + t3), r)), t3), ue2(Je(O(u(o3[0][0] - t3, o3[1][1] + t3), r)), t3)], l3 = [Et(q(c3[0], d[1]), q(c3[0], u(d[1][0] + 2 / 3 * (o3[0][0] - d[1][0]), d[1][1] + 2 / 3 * (o3[0][1] - d[1][1]))), q(c3[0], u(i3[0][0] + 2 / 3 * (o3[0][0] - i3[0][0]), i3[0][1] + 2 / 3 * (o3[0][1] - i3[0][1]))), q(c3[0], i3[0])), Et(q(c3[1], i3[1]), q(c3[1], u(i3[1][0] + 2 / 3 * (o3[1][0] - i3[1][0]), i3[1][1] + 2 / 3 * (o3[0][1] - i3[1][1]))), q(c3[1], u(a3[0][0] + 2 / 3 * (o3[1][0] - a3[0][0]), a3[0][1] + 2 / 3 * (o3[0][1] - a3[0][1]))), q(c3[1], a3[0])), Et(q(c3[2], a3[1]), q(c3[2], u(a3[1][0] + 2 / 3 * (o3[1][0] - a3[1][0]), a3[1][1] + 2 / 3 * (o3[1][1] - a3[1][1]))), q(c3[2], u(s3[1][0] + 2 / 3 * (o3[1][0] - s3[1][0]), s3[1][1] + 2 / 3 * (o3[1][1] - s3[1][1]))), q(c3[2], s3[1])), Et(q(c3[3], s3[0]), q(c3[3], u(s3[0][0] + 2 / 3 * (o3[0][0] - s3[0][0]), s3[0][1] + 2 / 3 * (o3[1][1] - s3[0][1]))), q(c3[3], u(d[0][0] + 2 / 3 * (o3[0][0] - d[0][0]), d[0][1] + 2 / 3 * (o3[1][1] - d[0][1]))), q(c3[3], d[0]))];
  return [[A2(l3[0][3], l3[1][0]), A2(l3[1][3], l3[2][0]), A2(l3[2][3], l3[3][0]), A2(l3[3][3], l3[0][0])], l3];
}
function jo(e8, t3 = 0) {
  let [n3, r, o3, i3, a3, s3, d, c3] = Or(e8), l3 = it(Math.abs(n3 - d), e8), U = it(Math.abs(i3 - r), e8);
  if (e8.roundness?.type == null) {
    let [w, I, S, v] = [u(e8.x + n3, e8.y + r - t3), u(e8.x + o3 + t3, e8.y + i3), u(e8.x + a3, e8.y + s3 + t3), u(e8.x + d - t3, e8.y + c3)], D = A2(u(w[0] + l3, w[1] + U), u(I[0] - l3, I[1] - U)), $3 = A2(u(I[0] - l3, I[1] + U), u(S[0] + l3, S[1] - U)), N = A2(u(S[0] - l3, S[1] - U), u(v[0] + l3, v[1] + U)), B3 = A2(u(v[0] + l3, v[1] - U), u(w[0] - l3, w[1] + U));
    return [[D, $3, N, B3], []];
  }
  let p = u(e8.x + e8.width / 2, e8.y + e8.height / 2), [m, b3, E, g] = [u(e8.x + n3, e8.y + r), u(e8.x + o3, e8.y + i3), u(e8.x + a3, e8.y + s3), u(e8.x + d, e8.y + c3)], h = [ue2(Je(O(b3, p)), t3), ue2(Je(O(E, p)), t3), ue2(Je(O(g, p)), t3), ue2(Je(O(m, p)), t3)], x = [Et(q(h[0], u(b3[0] - l3, b3[1] - U)), q(h[0], b3), q(h[0], b3), q(h[0], u(b3[0] - l3, b3[1] + U))), Et(q(h[1], u(E[0] + l3, E[1] - U)), q(h[1], E), q(h[1], E), q(h[1], u(E[0] - l3, E[1] - U))), Et(q(h[2], u(g[0] + l3, g[1] + U)), q(h[2], g), q(h[2], g), q(h[2], u(g[0] + l3, g[1] - U))), Et(q(h[3], u(m[0] - l3, m[1] + U)), q(h[3], m), q(h[3], m), q(h[3], u(m[0] + l3, m[1] + U)))];
  return [[A2(x[0][3], x[1][0]), A2(x[1][3], x[2][0]), A2(x[2][3], x[3][0]), A2(x[3][3], x[0][0])], x];
}
var ei = (e8) => {
  if (e8.type === "arrow") return false;
  let t3 = !Wt(e8.backgroundColor) || bn(e8) || gt(e8) || k(e8);
  return e8.type === "line" ? t3 && Kt(e8.points) : e8.type === "freedraw" ? t3 && Kt(e8.points) : t3 || Ye(e8);
};
var xm = ({ x: e8, y: t3, element: n3, shape: r, threshold: o3 = 10, frameNameBound: i3 = null }) => {
  let a3 = ei(n3) ? Wo(u(e8, t3), r) || _r(u(e8, t3), r, o3) : _r(u(e8, t3), r, o3);
  return !a3 && i3 && (a3 = Wo(u(e8, t3), { type: "polygon", data: Zo(i3).data })), a3;
};
var ba = (e8, t3, n3, r, o3 = 0) => {
  let [i3, a3, s3, d] = Ke(n3, r);
  return i3 -= o3, a3 -= o3, s3 += o3, d += o3, So(u(i3, a3), u(e8, t3), u(s3, d));
};
var A$ = (e8, t3) => !xm(e8) && !hm(e8.x, e8.y, L1(e8.element, t3)) && ba(e8.x, e8.y, e8.element, t3);
var hm = (e8, t3, n3) => !!n3 && Wo(u(e8, t3), n3);
var Ea = (e8, t3, n3 = 0) => {
  switch (e8.type) {
    case "rectangle":
    case "image":
    case "text":
    case "iframe":
    case "embeddable":
    case "frame":
    case "magicframe":
      return ym(e8, t3, n3);
    case "diamond":
      return Im(e8, t3, n3);
    case "ellipse":
      return wm(e8, t3, n3);
    default:
      throw new Error(`Unimplemented element type '${e8.type}'`);
  }
};
var ym = (e8, t3, n3 = 0) => {
  let r = u(e8.x + e8.width / 2, e8.y + e8.height / 2), o3 = T(t3[0], r, -e8.angle), i3 = T(t3[1], r, -e8.angle), [a3, s3] = Qo(e8, n3);
  return [...a3.map((d) => pn(A2(o3, i3), d)).filter((d) => d != null).map((d) => T(d, r, e8.angle)), ...s3.flatMap((d) => Wi(d, A2(o3, i3))).filter((d) => d != null).map((d) => T(d, r, e8.angle))].filter((d, c3, l3) => l3.findIndex((U) => _e(d, U)) === c3);
};
var Im = (e8, t3, n3 = 0) => {
  let r = u(e8.x + e8.width / 2, e8.y + e8.height / 2), o3 = T(t3[0], r, -e8.angle), i3 = T(t3[1], r, -e8.angle), [a3, s3] = jo(e8, n3);
  return [...a3.map((d) => pn(A2(o3, i3), d)).filter((d) => d != null).map((d) => T(d, r, e8.angle)), ...s3.flatMap((d) => Wi(d, A2(o3, i3))).filter((d) => d != null).map((d) => T(d, r, e8.angle))].filter((d, c3, l3) => l3.findIndex((U) => _e(d, U)) === c3);
};
var wm = (e8, t3, n3 = 0) => {
  let r = u(e8.x + e8.width / 2, e8.y + e8.height / 2), o3 = T(t3[0], r, -e8.angle), i3 = T(t3[1], r, -e8.angle);
  return M1(zo(r, e8.width / 2 + n3, e8.height / 2 + n3), Rr(o3, i3)).map((a3) => T(a3, r, e8.angle));
};
var D1 = { EQUAL: "Equal", MINUS: "Minus", NUM_ADD: "NumpadAdd", NUM_SUBTRACT: "NumpadSubtract", NUM_ZERO: "Numpad0", BRACKET_RIGHT: "BracketRight", BRACKET_LEFT: "BracketLeft", ONE: "Digit1", TWO: "Digit2", THREE: "Digit3", NINE: "Digit9", QUOTE: "Quote", ZERO: "Digit0", SLASH: "Slash", C: "KeyC", D: "KeyD", H: "KeyH", V: "KeyV", Z: "KeyZ", Y: "KeyY", R: "KeyR", S: "KeyS" };
var Q = { ARROW_DOWN: "ArrowDown", ARROW_LEFT: "ArrowLeft", ARROW_RIGHT: "ArrowRight", ARROW_UP: "ArrowUp", PAGE_UP: "PageUp", PAGE_DOWN: "PageDown", BACKSPACE: "Backspace", ALT: "Alt", CTRL_OR_CMD: uo ? "metaKey" : "ctrlKey", DELETE: "Delete", ENTER: "Enter", ESCAPE: "Escape", QUESTION_MARK: "?", SPACE: " ", TAB: "Tab", CHEVRON_LEFT: "<", CHEVRON_RIGHT: ">", PERIOD: ".", COMMA: ",", SUBTRACT: "-", SLASH: "/", A: "a", C: "c", D: "d", E: "e", F: "f", G: "g", H: "h", I: "i", L: "l", O: "o", P: "p", Q: "q", R: "r", S: "s", T: "t", V: "v", X: "x", Y: "y", Z: "z", K: "k", W: "w", 0: "0", 1: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9" };
var Rm = /* @__PURE__ */ new Map([[Q.Z, D1.Z], [Q.Y, D1.Y]]);
var Tm = (e8) => /^[a-z]$/.test(e8.toLowerCase());
var Y$ = (e8, t3) => {
  if (t3 === e8.key.toLowerCase()) return true;
  let n3 = Rm.get(t3);
  return !!(n3 && !Tm(e8.key) && e8.code === n3);
};
var C$ = (e8) => e8 === Q.ARROW_LEFT || e8 === Q.ARROW_RIGHT || e8 === Q.ARROW_DOWN || e8 === Q.ARROW_UP;
var V$ = (e8) => e8.altKey;
var q$ = (e8) => e8.shiftKey;
var ga = (e8) => e8.shiftKey;
var Mm = [{ icon: Pd, value: "selection", key: Q.V, numericKey: Q[1], fillable: true }, { icon: Nd, value: "rectangle", key: Q.R, numericKey: Q[2], fillable: true }, { icon: Fd, value: "diamond", key: Q.D, numericKey: Q[3], fillable: true }, { icon: Bd, value: "ellipse", key: Q.O, numericKey: Q[4], fillable: true }, { icon: _d, value: "arrow", key: Q.A, numericKey: Q[5], fillable: true }, { icon: Od, value: "line", key: Q.L, numericKey: Q[6], fillable: true }, { icon: Nr, value: "freedraw", key: [Q.P, Q.X], numericKey: Q[7], fillable: false }, { icon: Ad, value: "text", key: Q.T, numericKey: Q[8], fillable: false }, { icon: Kd, value: "image", key: null, numericKey: Q[9], fillable: false }, { icon: Hd, value: "eraser", key: Q.E, numericKey: Q[0], fillable: false }];
var iP = (e8) => Mm.find((n3, r) => n3.numericKey != null && e8 === n3.numericKey.toString() || n3.key && (typeof n3.key == "string" ? n3.key === e8 : n3.key.includes(e8)))?.value || null;
var ti = (e8, t3) => {
  switch (e8.type) {
    case "rectangle":
    case "diamond":
    case "frame":
    case "magicframe":
    case "embeddable":
    case "image":
    case "iframe":
    case "text":
    case "selection":
      return Zo(e8);
    case "arrow":
    case "line": {
      let n3 = he2.get(e8)?.[0] ?? he2.generateElementShape(e8, null)[0], [, , , , r, o3] = C2(e8, t3);
      return ei(e8) ? h1(e8, n3, u(e8.x, e8.y), e8.angle, u(r, o3)) : g1(n3, u(e8.x, e8.y), e8.angle, u(r, o3));
    }
    case "ellipse":
      return E1(e8);
    case "freedraw": {
      let [, , , , n3, r] = C2(e8, t3);
      return x1(e8, u(n3, r), ei(e8));
    }
  }
};
var L1 = (e8, t3) => {
  let n3 = oe(e8, t3);
  return n3 ? e8.type === "arrow" ? ti({ ...n3, ...z.getBoundTextElementPosition(e8, n3, t3) }, t3) : ti(n3, t3) : null;
};
var xa = (e8, t3) => {
  let n3 = he2.generateElementShape(e8, null);
  if (!n3) return null;
  let r = It(n3[0]), o3 = u(0, 0), i3 = 0, a3 = 1 / 0, s3 = null;
  for (; i3 < r.length; ) {
    let { op: d, data: c3 } = r[i3];
    if (d === "move" && (Ae(Do(c3), "The returned ops is not compatible with a point"), o3 = c3), d === "bcurveTo") {
      let l3 = o3, U = u(c3[0], c3[1]), p = u(c3[2], c3[3]), m = u(c3[4], c3[5]), b3 = ie2(m, t3);
      b3 < a3 && (a3 = b3, s3 = [l3, U, p, m]), o3 = m;
    }
    i3++;
  }
  return s3;
};
var ha = (e8, t3, n3, r, o3) => {
  let i3 = (d, c3) => Math.pow(1 - d, 3) * r[c3] + 3 * d * Math.pow(1 - d, 2) * n3[c3] + 3 * Math.pow(d, 2) * (1 - d) * t3[c3] + e8[c3] * Math.pow(d, 3), a3 = i3(o3, 0), s3 = i3(o3, 1);
  return u(a3, s3);
};
var Lm = (e8, t3) => {
  let n3 = xa(e8, t3);
  if (!n3) return [];
  let r = [], o3 = 1;
  for (; o3 > 0; ) {
    let i3 = ha(n3[0], n3[1], n3[2], n3[3], o3);
    r.push(u(i3[0], i3[1])), o3 -= 0.05;
  }
  return r.length && _e(r.at(-1), t3) && r.push(u(t3[0], t3[1])), r;
};
var v1 = (e8, t3) => {
  let n3 = [];
  n3[0] = 0;
  let r = Lm(e8, t3), o3 = 0, i3 = 0;
  for (; o3 < r.length - 1; ) {
    let a3 = ie2(r[o3], r[o3 + 1]);
    i3 += a3, n3.push(i3), o3++;
  }
  return n3;
};
var $1 = (e8, t3) => v1(e8, t3).at(-1);
var P1 = (e8, t3, n3) => {
  let r = v1(e8, t3), o3 = r.length - 1, i3 = r.at(-1), a3 = n3 * i3, s3 = 0, d = o3, c3 = 0;
  for (; s3 < d; ) c3 = Math.floor(s3 + (d - s3) / 2), r[c3] < a3 ? s3 = c3 + 1 : d = c3;
  return r[c3] > a3 && c3--, r[c3] === a3 ? c3 / o3 : 1 - (c3 + (a3 - r[c3]) / (r[c3 + 1] - r[c3])) / o3;
};
var wt = (e8, t3) => {
  let n3 = { minX: e8.x, minY: e8.y, maxX: e8.x + e8.width, maxY: e8.y + e8.height, midX: e8.x + e8.width / 2, midY: e8.y + e8.height / 2 }, r = u(n3.midX, n3.midY), [o3, i3] = T(u(n3.minX, n3.minY), r, e8.angle), [a3, s3] = T(u(n3.maxX, n3.minY), r, e8.angle), [d, c3] = T(u(n3.maxX, n3.maxY), r, e8.angle), [l3, U] = T(u(n3.minX, n3.maxY), r, e8.angle), p = [Math.min(o3, a3, d, l3), Math.min(i3, s3, c3, U), Math.max(o3, a3, d, l3), Math.max(i3, s3, c3, U)];
  if (t3) {
    let [m, b3, E, g] = t3;
    return [p[0] - g, p[1] - m, p[2] + b3, p[3] + E];
  }
  return p;
};
var gn = (e8, t3) => e8[0] > t3[0] && e8[0] < t3[2] && e8[1] > t3[1] && e8[1] < t3[3];
var it = (e8, t3) => {
  if (t3.roundness?.type === ot.PROPORTIONAL_RADIUS || t3.roundness?.type === ot.LEGACY) return e8 * wo;
  if (t3.roundness?.type === ot.ADAPTIVE_RADIUS) {
    let n3 = t3.roundness?.value ?? Gs, r = n3 / wo;
    return e8 <= r ? e8 * wo : n3;
  }
  return 0;
};
var Kt = (e8, t3 = 1) => {
  if (e8.length >= 3) {
    let [n3, r] = [e8[0], e8[e8.length - 1]];
    return ie2(n3, r) <= Ks / t3;
  }
  return false;
};
var Ge = 10;
var lP = (e8, t3, n3, r, o3, i3, a3) => {
  let { width: s3, height: d } = er(e8), c3 = n3 / s3, l3 = r / d, U = (e8.crop?.x ?? 0) / c3, p = (e8.crop?.y ?? 0) / l3, m = T(u(o3, i3), u(e8.x + e8.width / 2, e8.y + e8.height / 2), -e8.angle);
  o3 = m[0], i3 = m[1];
  let b3 = e8.width, E = e8.height, g = e8.crop ?? { x: 0, y: 0, width: n3, height: r, naturalWidth: n3, naturalHeight: r }, h = g.height, x = g.width, y = e8.scale[0] === -1, w = e8.scale[1] === -1, I = i3 - e8.y, S = o3 - e8.x;
  t3.includes("n") && (E = se2(e8.height - I, Ge, w ? d - p : e8.height + p)), t3.includes("s") && (I = i3 - e8.y - e8.height, E = se2(e8.height + I, Ge, w ? e8.height + p : d - p)), t3.includes("e") && (S = o3 - e8.x - e8.width, b3 = se2(e8.width + S, Ge, y ? e8.width + U : s3 - U)), t3.includes("w") && (b3 = se2(e8.width - S, Ge, y ? s3 - U : e8.width + U));
  let v = (N) => {
    N.height = E * l3, N.width = b3 * c3;
  };
  v(g);
  let D = (N, B3) => {
    v(B3), N.includes("n") && (w || (B3.y += h - B3.height)), N.includes("s") && w && (B3.y += h - B3.height), N.includes("e") && y && (B3.x += x - B3.width), N.includes("w") && (y || (B3.x += x - B3.width));
  };
  switch (t3) {
    case "n": {
      if (a3) {
        let N = U + e8.width / 2, B3 = s3 - U - e8.width / 2, _ = Math.min(N, B3) * 2;
        b3 = se2(E * a3, Ge, _), E = b3 / a3;
      }
      D(t3, g), a3 && (g.x += (x - g.width) / 2);
      break;
    }
    case "s": {
      if (a3) {
        let N = U + e8.width / 2, B3 = s3 - U - e8.width / 2, _ = Math.min(N, B3) * 2;
        b3 = se2(E * a3, Ge, _), E = b3 / a3;
      }
      D(t3, g), a3 && (g.x += (x - g.width) / 2);
      break;
    }
    case "w": {
      if (a3) {
        let N = p + e8.height / 2, B3 = d - p - e8.height / 2, _ = Math.min(N, B3) * 2;
        E = se2(b3 / a3, Ge, _), b3 = E * a3;
      }
      D(t3, g), a3 && (g.y += (h - g.height) / 2);
      break;
    }
    case "e": {
      if (a3) {
        let N = p + e8.height / 2, B3 = d - p - e8.height / 2, _ = Math.min(N, B3) * 2;
        E = se2(b3 / a3, Ge, _), b3 = E * a3;
      }
      D(t3, g), a3 && (g.y += (h - g.height) / 2);
      break;
    }
    case "ne": {
      if (a3) if (S > -I) {
        let N = w ? d - p : p + e8.height;
        E = se2(b3 / a3, Ge, N), b3 = E * a3;
      } else {
        let N = y ? U + e8.width : s3 - U;
        b3 = se2(E * a3, Ge, N), E = b3 / a3;
      }
      D(t3, g);
      break;
    }
    case "nw": {
      if (a3) if (S < I) {
        let N = w ? d - p : p + e8.height;
        E = se2(b3 / a3, Ge, N), b3 = E * a3;
      } else {
        let N = y ? s3 - U : U + e8.width;
        b3 = se2(E * a3, Ge, N), E = b3 / a3;
      }
      D(t3, g);
      break;
    }
    case "se": {
      if (a3) if (S > I) {
        let N = w ? p + e8.height : d - p;
        E = se2(b3 / a3, Ge, N), b3 = E * a3;
      } else {
        let N = y ? U + e8.width : s3 - U;
        b3 = se2(E * a3, Ge, N), E = b3 / a3;
      }
      D(t3, g);
      break;
    }
    case "sw": {
      if (a3) if (-S > I) {
        let N = w ? p + e8.height : d - p;
        E = se2(b3 / a3, Ge, N), b3 = E * a3;
      } else {
        let N = y ? s3 - U : U + e8.width;
        b3 = se2(E * a3, Ge, N), E = b3 / a3;
      }
      D(t3, g);
      break;
    }
    default:
      break;
  }
  let $3 = Dm(e8, t3, b3, E, !!a3);
  return Zi(g.width, g.naturalWidth) && Zi(g.height, g.naturalHeight) && (g = null), { x: $3[0], y: $3[1], width: b3, height: E, crop: g };
};
var Dm = (e8, t3, n3, r, o3) => {
  let [i3, a3, s3, d] = Rt(e8, e8.width, e8.height, true), c3 = u(i3, a3), l3 = u(s3, d), U = Zt(c3, l3), [p, m, b3, E] = Rt(e8, n3, r, true), g = b3 - p, h = E - m, x = [...c3];
  if (["n", "w", "nw"].includes(t3) && (x = [l3[0] - Math.abs(g), l3[1] - Math.abs(h)]), t3 === "ne") {
    let D = [c3[0], l3[1]];
    x = [D[0], D[1] - Math.abs(h)];
  }
  if (t3 === "sw") {
    let D = [l3[0], c3[1]];
    x = [D[0] - Math.abs(g), D[1]];
  }
  o3 && (["s", "n"].includes(t3) && (x[0] = U[0] - g / 2), ["e", "w"].includes(t3) && (x[1] = U[1] - h / 2));
  let y = e8.angle, w = T(x, U, y), I = [x[0] + Math.abs(g) / 2, x[1] + Math.abs(h) / 2], S = T(I, U, y);
  x = T(w, S, -y);
  let v = [...x];
  return v[0] += e8.x - p, v[1] += e8.y - m, v;
};
var N1 = (e8, t3) => {
  if (e8.crop) {
    let { width: n3, height: r } = er(e8), [o3, i3, a3, s3, d, c3] = C2(e8, t3), l3 = O(T(u(o3, i3), u(d, c3), e8.angle)), U = O(T(u(a3, i3), u(d, c3), e8.angle)), p = Je(Lo(U, l3)), m = O(T(u(o3, s3), u(d, c3), e8.angle)), b3 = Lo(m, l3), E = Je(b3), { cropX: g, cropY: h } = Sm(e8.crop, e8.scale), x = st(st(l3, ue2(p, -g * n3 / e8.crop.naturalWidth)), ue2(E, -h * r / e8.crop.naturalHeight)), y = q(st(st(x, ue2(p, n3 / 2)), ue2(E, r / 2))), w = T(q(x), y, -e8.angle);
    return { ...e8, x: w[0], y: w[1], width: n3, height: r, crop: null };
  }
  return e8;
};
var er = (e8) => {
  if (e8.crop) {
    let t3 = e8.width / (e8.crop.width / e8.crop.naturalWidth), n3 = e8.height / (e8.crop.height / e8.crop.naturalHeight);
    return { width: t3, height: n3 };
  }
  return { width: e8.width, height: e8.height };
};
var Sm = (e8, t3) => {
  let n3 = e8.x, r = e8.y, o3 = t3[0] === -1, i3 = t3[1] === -1;
  return o3 && (n3 = e8.naturalWidth - Math.abs(n3) - e8.width), i3 && (r = e8.naturalHeight - Math.abs(r) - e8.height), { cropX: n3, cropY: r };
};
var UP = (e8, t3 = false) => {
  let n3 = e8.crop;
  if (!n3) return null;
  let r = e8.scale[0] === -1, o3 = e8.scale[1] === -1, i3 = n3.x, a3 = n3.y;
  if (r && (i3 = n3.naturalWidth - n3.width - n3.x), o3 && (a3 = n3.naturalHeight - n3.height - n3.y), t3) return { x: i3, y: a3 };
  let { width: s3, height: d } = er(e8);
  return { x: i3 / (n3.naturalWidth / s3), y: a3 / (n3.naturalHeight / d) };
};
var Ia = "invert(100%) hue-rotate(180deg) saturate(1.25)";
var $m = mt();
var O1 = (e8, t3) => At(e8) && !t3.imageCache.has(e8.fileId);
var A1 = (e8, t3, n3) => n3.theme === ke.DARK && At(e8) && !O1(e8, t3) && t3.imageCache.get(e8.fileId)?.mimeType !== H.svg;
var ri = (e8) => {
  switch (e8.type) {
    case "freedraw":
      return e8.strokeWidth * 12;
    case "text":
      return e8.fontSize / 2;
    default:
      return 20;
  }
};
var Pm = (e8, t3, n3, r, o3 = 1) => {
  let i3 = (t3?.opacity ?? 100) * e8.opacity / 1e4 * o3;
  return (n3.has(e8.id) || r && r.some((a3) => a3.id === e8.id) || t3 && n3.has(t3.id)) && (i3 *= Xs / 100), i3;
};
var Nm = (e8, t3, n3) => {
  let i3 = ri(e8), [a3, s3, d, c3] = C2(e8, t3), l3 = ae2(e8) || Ce(e8) ? dt(a3, d) : e8.width, U = ae2(e8) || Ce(e8) ? dt(s3, c3) : e8.height, p = l3 * window.devicePixelRatio + i3 * 2, m = U * window.devicePixelRatio + i3 * 2, b3 = n3.value;
  return (p * b3 > 32767 || m * b3 > 32767) && (b3 = Math.min(32767 / p, 32767 / m)), p * m * b3 * b3 > 16777216 && (b3 = Math.sqrt(16777216 / (p * m))), p = Math.floor(p * b3), m = Math.floor(m * b3), { width: p, height: m, scale: b3 };
};
var K1 = (e8, t3, n3, r, o3) => {
  let i3 = document.createElement("canvas"), a3 = i3.getContext("2d"), s3 = ri(e8), { width: d, height: c3, scale: l3 } = Nm(e8, t3, n3);
  if (!d || !c3) return null;
  i3.width = d, i3.height = c3;
  let U = -100, p = 0;
  if (ae2(e8) || Ce(e8)) {
    let [h, x] = C2(e8, t3);
    U = e8.x > h ? dt(e8.x, h) * window.devicePixelRatio * l3 : 0, p = e8.y > x ? dt(e8.y, x) * window.devicePixelRatio * l3 : 0, a3.translate(U, p);
  }
  a3.save(), a3.translate(s3 * l3, s3 * l3), a3.scale(window.devicePixelRatio * l3, window.devicePixelRatio * l3);
  let m = rough_default.canvas(i3);
  A1(e8, r, o3) && (a3.filter = Ia), ni(e8, m, a3, r, o3), a3.restore();
  let b3 = oe(e8, t3), E = document.createElement("canvas"), g = E.getContext("2d");
  if (ee2(e8) && b3) {
    let [h, x, y, w] = C2(e8, t3), I = Math.max(dt(h, y), dt(x, w));
    E.width = I * window.devicePixelRatio * l3 + s3 * l3 * 10, E.height = I * window.devicePixelRatio * l3 + s3 * l3 * 10, g.translate(E.width / 2, E.height / 2), g.rotate(e8.angle), g.drawImage(i3, -i3.width / 2, -i3.height / 2, i3.width, i3.height);
    let [, , , , S, v] = C2(b3, t3);
    g.rotate(-e8.angle);
    let D = (E.width - i3.width) / 2, $3 = (E.height - i3.height) / 2, N = E.width / 2 - (S - h) * window.devicePixelRatio * l3 - D - s3 * l3, B3 = E.height / 2 - (v - x) * window.devicePixelRatio * l3 - $3 - s3 * l3;
    g.translate(-N, -B3), g.clearRect(-(b3.width / 2 + Se) * window.devicePixelRatio * l3, -(b3.height / 2 + Se) * window.devicePixelRatio * l3, (b3.width + Se * 2) * window.devicePixelRatio * l3, (b3.height + Se * 2) * window.devicePixelRatio * l3);
  }
  return { element: e8, canvas: i3, theme: o3.theme, scale: l3, zoomValue: n3.value, canvasOffsetX: U, canvasOffsetY: p, boundTextElementVersion: oe(e8, t3)?.version || null, containingFrameOpacity: We(e8, t3)?.opacity || 100, boundTextCanvas: E, angle: e8.angle, imageCrop: Ye(e8) ? e8.crop : null };
};
var H1 = 14;
var J1 = document.createElement("img");
J1.src = `data:${H.svg},${encodeURIComponent('<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="image" class="svg-inline--fa fa-image fa-w-16" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="#888" d="M464 448H48c-26.51 0-48-21.49-48-48V112c0-26.51 21.49-48 48-48h416c26.51 0 48 21.49 48 48v288c0 26.51-21.49 48-48 48zM112 120c-30.928 0-56 25.072-56 56s25.072 56 56 56 56-25.072 56-56-25.072-56-56-56zM64 384h384V272l-87.515-87.515c-4.686-4.686-12.284-4.686-16.971 0L208 320l-55.515-55.515c-4.686-4.686-12.284-4.686-16.971 0L64 336v48z"></path></svg>')}`;
var Y1 = document.createElement("img");
Y1.src = `data:${H.svg},${encodeURIComponent('<svg viewBox="0 0 668 668" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2"><path d="M464 448H48c-26.51 0-48-21.49-48-48V112c0-26.51 21.49-48 48-48h416c26.51 0 48 21.49 48 48v288c0 26.51-21.49 48-48 48ZM112 120c-30.928 0-56 25.072-56 56s25.072 56 56 56 56-25.072 56-56-25.072-56-56-56ZM64 384h384V272l-87.515-87.515c-4.686-4.686-12.284-4.686-16.971 0L208 320l-55.515-55.515c-4.686-4.686-12.284-4.686-16.971 0L64 336v48Z" style="fill:#888;fill-rule:nonzero" transform="matrix(.81709 0 0 .81709 124.825 145.825)"/><path d="M256 8C119.034 8 8 119.033 8 256c0 136.967 111.034 248 248 248s248-111.034 248-248S392.967 8 256 8Zm130.108 117.892c65.448 65.448 70 165.481 20.677 235.637L150.47 105.216c70.204-49.356 170.226-44.735 235.638 20.676ZM125.892 386.108c-65.448-65.448-70-165.481-20.677-235.637L361.53 406.784c-70.203 49.356-170.226 44.736-235.638-20.676Z" style="fill:#888;fill-rule:nonzero" transform="matrix(.30366 0 0 .30366 506.822 60.065)"/></svg>')}`;
var Fm = (e8, t3) => {
  t3.fillStyle = "#E7E7E7", t3.fillRect(0, 0, e8.width, e8.height);
  let n3 = Math.min(e8.width, e8.height), r = Math.min(n3, Math.min(n3 * 0.4, 100));
  t3.drawImage(e8.status === "error" ? Y1 : J1, e8.width / 2 - r / 2, e8.height / 2 - r / 2, r, r);
};
var ni = (e8, t3, n3, r, o3) => {
  switch (e8.type) {
    case "rectangle":
    case "iframe":
    case "embeddable":
    case "diamond":
    case "ellipse": {
      n3.lineJoin = "round", n3.lineCap = "round", t3.draw(he2.get(e8));
      break;
    }
    case "arrow":
    case "line": {
      n3.lineJoin = "round", n3.lineCap = "round", he2.get(e8).forEach((i3) => {
        t3.draw(i3);
      });
      break;
    }
    case "freedraw": {
      n3.save(), n3.fillStyle = e8.strokeColor;
      let i3 = Bm(e8), a3 = he2.get(e8);
      a3 && t3.draw(a3), n3.fillStyle = e8.strokeColor, n3.fill(i3), n3.restore();
      break;
    }
    case "image": {
      let i3 = At(e8) ? r.imageCache.get(e8.fileId)?.image : void 0;
      if (i3 != null && !(i3 instanceof Promise)) {
        e8.roundness && n3.roundRect && (n3.beginPath(), n3.roundRect(0, 0, e8.width, e8.height, it(Math.min(e8.width, e8.height), e8)), n3.clip());
        let { x: a3, y: s3, width: d, height: c3 } = e8.crop ? e8.crop : { x: 0, y: 0, width: i3.naturalWidth, height: i3.naturalHeight };
        n3.drawImage(i3, a3, s3, d, c3, 0, 0, e8.width, e8.height);
      } else Fm(e8, n3);
      break;
    }
    default:
      if (k(e8)) {
        let i3 = Po(e8.text), a3 = i3 && !n3.canvas.isConnected;
        a3 && document.body.appendChild(n3.canvas), n3.canvas.setAttribute("dir", i3 ? "rtl" : "ltr"), n3.save(), n3.font = Ee(e8), n3.fillStyle = e8.strokeColor, n3.textAlign = e8.textAlign;
        let s3 = e8.text.replace(/\r\n?/g, `
`).split(`
`), d = e8.textAlign === "center" ? e8.width / 2 : e8.textAlign === "right" ? e8.width : 0, c3 = Zn(e8.fontSize, e8.lineHeight), l3 = Go(e8.fontFamily, e8.fontSize, c3);
        for (let U = 0; U < s3.length; U++) n3.fillText(s3[U], d, U * c3 + l3);
        n3.restore(), a3 && n3.canvas.remove();
      } else throw new Error(`Unimplemented type ${e8.type}`);
  }
};
var Jo = /* @__PURE__ */ new WeakMap();
var F1 = (e8, t3, n3, r) => {
  let o3 = n3 ? r.zoom : $m.zoom, i3 = Jo.get(e8), a3 = i3 && i3.zoomValue !== o3.value && !r?.shouldCacheIgnoreZoom, s3 = oe(e8, t3), d = s3?.version || null, c3 = Ye(e8) ? e8.crop : null, l3 = We(e8, t3)?.opacity || 100;
  if (!i3 || a3 || i3.theme !== r.theme || i3.boundTextElementVersion !== d || i3.imageCrop !== c3 || i3.containingFrameOpacity !== l3 || ee2(e8) && s3 && e8.angle !== i3.angle) {
    let U = K1(e8, t3, o3, n3, r);
    return U ? (Jo.set(e8, U), U) : null;
  }
  return i3;
};
var ya = (e8, t3, n3, r, o3) => {
  let i3 = e8.element, a3 = ri(i3), s3 = e8.scale, [d, c3, l3, U] = C2(i3, o3), p = ((d + l3) / 2 + r.scrollX) * window.devicePixelRatio, m = ((c3 + U) / 2 + r.scrollY) * window.devicePixelRatio;
  t3.save(), t3.scale(1 / window.devicePixelRatio, 1 / window.devicePixelRatio);
  let b3 = oe(i3, o3);
  if (ee2(i3) && b3) {
    let E = (e8.boundTextCanvas.width - e8.canvas.width) / 2, g = (e8.boundTextCanvas.height - e8.canvas.height) / 2;
    t3.translate(p, m), t3.drawImage(e8.boundTextCanvas, -(l3 - d) / 2 * window.devicePixelRatio - E / s3 - a3, -(U - c3) / 2 * window.devicePixelRatio - g / s3 - a3, e8.boundTextCanvas.width / s3, e8.boundTextCanvas.height / s3);
  } else if (t3.translate(p, m), t3.rotate(i3.angle), "scale" in e8.element && !O1(i3, n3) && t3.scale(e8.element.scale[0], e8.element.scale[1]), t3.translate(-p, -m), t3.drawImage(e8.canvas, (d + r.scrollX) * window.devicePixelRatio - a3 * e8.scale / e8.scale, (c3 + r.scrollY) * window.devicePixelRatio - a3 * e8.scale / e8.scale, e8.canvas.width / e8.scale, e8.canvas.height / e8.scale), c.VITE_APP_DEBUG_ENABLE_TEXT_CONTAINER_BOUNDING_BOX === "true" && bn(i3)) {
    let E = oe(i3, o3), g = Ra(i3);
    t3.strokeStyle = "#c92a2a", t3.lineWidth = 3, t3.strokeRect((g.x + r.scrollX) * window.devicePixelRatio, (g.y + r.scrollY) * window.devicePixelRatio, Tt(i3, E) * window.devicePixelRatio, Ar(i3, E) * window.devicePixelRatio);
  }
  t3.restore();
};
var vP = (e8, t3, n3, r) => {
  t3.save(), t3.translate(e8.x + n3.scrollX, e8.y + n3.scrollY), t3.fillStyle = "rgba(0, 0, 200, 0.04)";
  let o3 = 0.5 / n3.zoom.value;
  t3.fillRect(o3, o3, e8.width, e8.height), t3.lineWidth = 1 / n3.zoom.value, t3.strokeStyle = r, t3.strokeRect(o3, o3, e8.width, e8.height), t3.restore();
};
var Fn = (e8, t3, n3, r, o3, i3, a3) => {
  let s3 = a3.openDialog?.name === "elementLinkSelector" && !a3.selectedElementIds[e8.id] && !a3.hoveredElementIds[e8.id];
  switch (o3.globalAlpha = Pm(e8, We(e8, t3), i3.elementsPendingErasure, i3.pendingFlowchartNodes, s3 ? zs : 1), e8.type) {
    case "magicframe":
    case "frame": {
      a3.frameRendering.enabled && a3.frameRendering.outline && (o3.save(), o3.translate(e8.x + a3.scrollX, e8.y + a3.scrollY), o3.fillStyle = "rgba(0, 0, 200, 0.04)", o3.lineWidth = Pe.strokeWidth / a3.zoom.value, o3.strokeStyle = Pe.strokeColor, yd(e8) && (o3.strokeStyle = a3.theme === ke.LIGHT ? "#7affd7" : "#1d8264"), Pe.radius && o3.roundRect ? (o3.beginPath(), o3.roundRect(0, 0, e8.width, e8.height, Pe.radius / a3.zoom.value), o3.stroke(), o3.closePath()) : o3.strokeRect(0, 0, e8.width, e8.height), o3.restore());
      break;
    }
    case "freedraw": {
      if (he2.generateElementShape(e8, null), i3.isExporting) {
        let [d, c3, l3, U] = C2(e8, t3), p = (d + l3) / 2 + a3.scrollX, m = (c3 + U) / 2 + a3.scrollY, b3 = (l3 - d) / 2 - (e8.x - d), E = (U - c3) / 2 - (e8.y - c3);
        o3.save(), o3.translate(p, m), o3.rotate(e8.angle), o3.translate(-b3, -E), ni(e8, r, o3, i3, a3), o3.restore();
      } else {
        let d = F1(e8, n3, i3, a3);
        if (!d) return;
        ya(d, o3, i3, a3, n3);
      }
      break;
    }
    case "rectangle":
    case "diamond":
    case "ellipse":
    case "line":
    case "arrow":
    case "image":
    case "text":
    case "iframe":
    case "embeddable": {
      if (he2.generateElementShape(e8, i3), i3.isExporting) {
        let [d, c3, l3, U] = C2(e8, t3), p = (d + l3) / 2 + a3.scrollX, m = (c3 + U) / 2 + a3.scrollY, b3 = (l3 - d) / 2 - (e8.x - d), E = (U - c3) / 2 - (e8.y - c3);
        if (k(e8)) {
          let h = qe(e8, t3);
          if (ee2(h)) {
            let x = z.getBoundTextElementPosition(h, e8, t3);
            b3 = (l3 - d) / 2 - (x.x - d), E = (U - c3) / 2 - (x.y - c3);
          }
        }
        o3.save(), o3.translate(p, m), A1(e8, i3, a3) && (o3.filter = "none");
        let g = oe(e8, t3);
        if (ee2(e8) && g) {
          let h = document.createElement("canvas"), x = h.getContext("2d"), y = Math.max(dt(d, l3), dt(c3, U)), w = ri(e8);
          h.width = y * a3.exportScale + w * 10 * a3.exportScale, h.height = y * a3.exportScale + w * 10 * a3.exportScale, x.translate(h.width / 2, h.height / 2), x.scale(a3.exportScale, a3.exportScale), b3 = e8.width / 2 - (e8.x - d), E = e8.height / 2 - (e8.y - c3), x.rotate(e8.angle);
          let I = rough_default.canvas(h);
          x.translate(-b3, -E), ni(e8, I, x, i3, a3), x.translate(b3, E), x.rotate(-e8.angle);
          let [, , , , S, v] = C2(g, t3), D = (d + l3) / 2 - S, $3 = (c3 + U) / 2 - v;
          x.translate(-D, -$3), x.clearRect(-g.width / 2, -g.height / 2, g.width, g.height), o3.scale(1 / a3.exportScale, 1 / a3.exportScale), o3.drawImage(h, -h.width / 2, -h.height / 2, h.width, h.height);
        } else o3.rotate(e8.angle), e8.type === "image" && o3.scale(e8.scale[0], e8.scale[1]), o3.translate(-b3, -E), ni(e8, r, o3, i3, a3);
        o3.restore();
      } else {
        let d = F1(e8, n3, i3, a3);
        if (!d) return;
        let c3 = o3.imageSmoothingEnabled;
        if (!a3?.shouldCacheIgnoreZoom && (!e8.angle || od(e8.angle)) && (o3.imageSmoothingEnabled = false), e8.id === a3.croppingElementId && Ye(d.element) && d.element.crop !== null) {
          o3.save(), o3.globalAlpha = 0.1;
          let l3 = K1(N1(d.element, t3), n3, a3.zoom, i3, a3);
          l3 && ya(l3, o3, i3, a3, n3), o3.restore();
        }
        ya(d, o3, i3, a3, n3), o3.imageSmoothingEnabled = c3;
      }
      break;
    }
    default:
      throw new Error(`Unimplemented type ${e8.type}`);
  }
  o3.globalAlpha = 1;
};
var C1 = /* @__PURE__ */ new WeakMap([]);
function V1(e8) {
  let t3 = wa(e8), n3 = new Path2D(t3);
  return C1.set(e8, n3), n3;
}
function Bm(e8) {
  return C1.get(e8);
}
function wa(e8) {
  let t3 = e8.simulatePressure ? e8.points : e8.points.length ? e8.points.map(([r, o3], i3) => [r, o3, e8.pressures[i3]]) : [[0, 0, 0.5]], n3 = { simulatePressure: e8.simulatePressure, size: e8.strokeWidth * 4.25, thinning: 0.6, smoothing: 0.5, streamline: 0.5, easing: (r) => Math.sin(r * Math.PI / 2), last: !!e8.lastCommittedPoint };
  return Om(ae(t3, n3));
}
function B1(e8, t3) {
  return [(e8[0] + t3[0]) / 2, (e8[1] + t3[1]) / 2];
}
var _m = /(\s?[A-Z]?,?-?[0-9]*\.[0-9]{0,2})(([0-9]|e|-)*)/g;
function Om(e8) {
  if (!e8.length) return "";
  let t3 = e8.length - 1;
  return e8.reduce((n3, r, o3, i3) => (o3 === t3 ? n3.push(r, B1(r, i3[0]), "L", i3[0], "Z") : n3.push(r, B1(r, i3[o3 + 1])), n3), ["M", e8[0], "Q"]).join(" ").replace(_m, "$1");
}
var Am = (e8) => e8 === "rectangle" || e8 === "iframe" || e8 === "embeddable" || e8 === "ellipse" || e8 === "diamond" || e8 === "line" || e8 === "freedraw";
var NP = (e8) => e8 !== "image" && e8 !== "frame" && e8 !== "magicframe";
var Km = (e8) => e8 === "rectangle" || e8 === "iframe" || e8 === "embeddable" || e8 === "ellipse" || e8 === "diamond" || e8 === "freedraw" || e8 === "arrow" || e8 === "line";
var Hm = (e8) => e8 === "rectangle" || e8 === "iframe" || e8 === "embeddable" || e8 === "ellipse" || e8 === "diamond" || e8 === "arrow" || e8 === "line";
var Ta = (e8) => e8 === "rectangle" || e8 === "iframe" || e8 === "embeddable" || e8 === "line" || e8 === "diamond" || e8 === "image";
var FP = (e8) => e8 === "arrow";
var Jm = (e8) => e8 === "arrow";
var Re = [1, 0];
var Fe = [0, 1];
var nt = [-1, 0];
var ze = [0, -1];
var oi = (e8, t3) => {
  let n3 = rd(Math.atan2(t3[1] - e8[1], t3[0] - e8[0]));
  return n3 >= 315 || n3 < 45 ? ze : n3 >= 45 && n3 < 135 ? Re : n3 >= 135 && n3 < 225 ? Fe : nt;
};
var Ht = (e8) => {
  let [t3, n3] = e8, r = Math.abs(t3), o3 = Math.abs(n3);
  return t3 > o3 ? Re : t3 <= -o3 ? nt : n3 > r ? Fe : ze;
};
var tr = (e8, t3) => Ht(O(e8, t3));
var Mt = (e8, t3) => Lt(tr(e8, t3));
var ve = (e8, t3) => e8[0] === t3[0] && e8[1] === t3[1];
var Lt = (e8) => ve(e8, Re) || ve(e8, nt);
var q1 = (e8, t3, n3) => {
  let o3 = Kr(t3);
  if (e8.type === "diamond") {
    if (n3[0] < e8.x) return nt;
    if (n3[1] < e8.y) return ze;
    if (n3[0] > e8.x + e8.width) return Re;
    if (n3[1] > e8.y + e8.height) return Fe;
    let c3 = T(bt(u(e8.x + e8.width / 2, e8.y), o3, 2), o3, e8.angle), l3 = T(bt(u(e8.x + e8.width, e8.y + e8.height / 2), o3, 2), o3, e8.angle), U = T(bt(u(e8.x + e8.width / 2, e8.y + e8.height), o3, 2), o3, e8.angle), p = T(bt(u(e8.x, e8.y + e8.height / 2), o3, 2), o3, e8.angle);
    return Ln([c3, l3, o3], n3) ? oi(c3, l3) : Ln([l3, U, o3], n3) ? oi(l3, U) : Ln([U, p, o3], n3) ? oi(U, p) : oi(p, c3);
  }
  let i3 = bt(u(t3[0], t3[1]), o3, 2), a3 = bt(u(t3[2], t3[1]), o3, 2), s3 = bt(u(t3[0], t3[3]), o3, 2), d = bt(u(t3[2], t3[3]), o3, 2);
  return Ln([i3, a3, o3], n3) ? ze : Ln([a3, d, o3], n3) ? Re : Ln([d, s3, o3], n3) ? Fe : nt;
};
var Ma = (e8) => [e8[0] === 0 ? 0 : e8[0] > 0 ? -1 : 1, e8[1] === 0 ? 0 : e8[1] > 0 ? -1 : 1];
var Cm = (e8) => [8, 8 + e8];
var k1 = (e8) => [1.5, 6 + e8];
function Vm(e8) {
  let t3 = e8.roughness, n3 = Math.max(e8.width, e8.height), r = Math.min(e8.width, e8.height);
  return r >= 20 && n3 >= 50 || r >= 15 && e8.roundness && Ta(e8.type) || ae2(e8) && n3 >= 50 ? t3 : Math.min(t3 / (n3 < 10 ? 3 : 2), 2.5);
}
var rt = (e8, t3 = false) => {
  let n3 = { seed: e8.seed, strokeLineDash: e8.strokeStyle === "dashed" ? Cm(e8.strokeWidth) : e8.strokeStyle === "dotted" ? k1(e8.strokeWidth) : void 0, disableMultiStroke: e8.strokeStyle !== "solid", strokeWidth: e8.strokeStyle !== "solid" ? e8.strokeWidth + 0.5 : e8.strokeWidth, fillWeight: e8.strokeWidth / 2, hachureGap: e8.strokeWidth * 4, roughness: Vm(e8), stroke: e8.strokeColor, preserveVertices: t3 || e8.roughness < Gi.cartoonist };
  switch (e8.type) {
    case "rectangle":
    case "iframe":
    case "embeddable":
    case "diamond":
    case "ellipse":
      return n3.fillStyle = e8.fillStyle, n3.fill = Wt(e8.backgroundColor) ? void 0 : e8.backgroundColor, e8.type === "ellipse" && (n3.curveFitting = 1), n3;
    case "line":
    case "freedraw":
      return Kt(e8.points) && (n3.fillStyle = e8.fillStyle, n3.fill = e8.backgroundColor === "transparent" ? void 0 : e8.backgroundColor), n3;
    case "arrow":
      return n3;
    default:
      throw new Error(`Unimplemented type ${e8.type}`);
  }
};
var X1 = (e8, t3, n3) => gt(e8) && (t3 || Bo(e8) && n3?.get(e8.id) !== true) && Wt(e8.backgroundColor) && Wt(e8.strokeColor) ? { ...e8, roughness: 0, backgroundColor: "#d3d3d3", fillStyle: "solid" } : _o(e8) ? { ...e8, strokeColor: Wt(e8.strokeColor) ? "#000000" : e8.strokeColor, backgroundColor: Wt(e8.backgroundColor) ? "#f4f4f6" : e8.backgroundColor } : e8;
var G1 = (e8, t3, n3, r, o3, i3, a3) => {
  let s3 = ii(e8, t3, n3, r);
  if (s3 === null) return [];
  let d = (c3, l3) => {
    if (c3 === null) return [];
    let [, , U, p, m, b3] = c3;
    return [o3.line(U, p, m, b3, l3)];
  };
  switch (r) {
    case "dot":
    case "circle":
    case "circle_outline": {
      let [c3, l3, U] = s3;
      return delete i3.strokeLineDash, [o3.circle(c3, l3, U, { ...i3, fill: r === "circle_outline" ? a3 : e8.strokeColor, fillStyle: "solid", stroke: e8.strokeColor, roughness: Math.min(0.5, i3.roughness || 0) })];
    }
    case "triangle":
    case "triangle_outline": {
      let [c3, l3, U, p, m, b3] = s3;
      return delete i3.strokeLineDash, [o3.polygon([[c3, l3], [U, p], [m, b3], [c3, l3]], { ...i3, fill: r === "triangle_outline" ? a3 : e8.strokeColor, fillStyle: "solid", roughness: Math.min(1, i3.roughness || 0) })];
    }
    case "diamond":
    case "diamond_outline": {
      let [c3, l3, U, p, m, b3, E, g] = s3;
      return delete i3.strokeLineDash, [o3.polygon([[c3, l3], [U, p], [m, b3], [E, g], [c3, l3]], { ...i3, fill: r === "diamond_outline" ? a3 : e8.strokeColor, fillStyle: "solid", roughness: Math.min(1, i3.roughness || 0) })];
    }
    case "crowfoot_one":
      return d(s3, i3);
    case "bar":
    case "arrow":
    case "crowfoot_many":
    case "crowfoot_one_or_many":
    default: {
      let [c3, l3, U, p, m, b3] = s3;
      if (e8.strokeStyle === "dotted") {
        let E = k1(e8.strokeWidth - 1);
        i3.strokeLineDash = [E[0], E[1] - 1];
      } else delete i3.strokeLineDash;
      return i3.roughness = Math.min(1, i3.roughness || 0), [o3.line(U, p, c3, l3, i3), o3.line(m, b3, c3, l3, i3), ...r === "crowfoot_one_or_many" ? d(ii(e8, t3, n3, "crowfoot_one"), i3) : []];
    }
  }
};
var vd = (e8, t3, { isExporting: n3, canvasBackgroundColor: r, embedsValidationStatus: o3 }) => {
  switch (e8.type) {
    case "rectangle":
    case "iframe":
    case "embeddable": {
      let i3;
      if (e8.roundness) {
        let a3 = e8.width, s3 = e8.height, d = it(Math.min(a3, s3), e8);
        i3 = t3.path(`M ${d} 0 L ${a3 - d} 0 Q ${a3} 0, ${a3} ${d} L ${a3} ${s3 - d} Q ${a3} ${s3}, ${a3 - d} ${s3} L ${d} ${s3} Q 0 ${s3}, 0 ${s3 - d} L 0 ${d} Q 0 0, ${d} 0`, rt(X1(e8, n3, o3), true));
      } else i3 = t3.rectangle(0, 0, e8.width, e8.height, rt(X1(e8, n3, o3), false));
      return i3;
    }
    case "diamond": {
      let i3, [a3, s3, d, c3, l3, U, p, m] = Or(e8);
      if (e8.roundness) {
        let b3 = it(Math.abs(a3 - p), e8), E = it(Math.abs(c3 - s3), e8);
        i3 = t3.path(`M ${a3 + b3} ${s3 + E} L ${d - b3} ${c3 - E}
            C ${d} ${c3}, ${d} ${c3}, ${d - b3} ${c3 + E}
            L ${l3 + b3} ${U - E}
            C ${l3} ${U}, ${l3} ${U}, ${l3 - b3} ${U - E}
            L ${p + b3} ${m + E}
            C ${p} ${m}, ${p} ${m}, ${p + b3} ${m - E}
            L ${a3 - b3} ${s3 + E}
            C ${a3} ${s3}, ${a3} ${s3}, ${a3 + b3} ${s3 + E}`, rt(e8, true));
      } else i3 = t3.polygon([[a3, s3], [d, c3], [l3, U], [p, m]], rt(e8));
      return i3;
    }
    case "ellipse":
      return t3.ellipse(e8.width / 2, e8.height / 2, e8.width, e8.height, rt(e8));
    case "line":
    case "arrow": {
      let i3, a3 = rt(e8), s3 = e8.points.length ? e8.points : [u(0, 0)];
      if (X(e8) ? s3.every((d) => Math.abs(d[0]) <= 1e6 && Math.abs(d[1]) <= 1e6) ? i3 = [t3.path(qm(s3, 16), rt(e8, true))] : (console.error("Elbow arrow with extreme point positions detected. Arrow not rendered.", e8.id, JSON.stringify(s3)), i3 = []) : e8.roundness ? i3 = [t3.curve(s3, a3)] : a3.fill ? i3 = [t3.polygon(s3, a3)] : i3 = [t3.linearPath(s3, a3)], e8.type === "arrow") {
        let { startArrowhead: d = null, endArrowhead: c3 = "arrow" } = e8;
        if (d !== null) {
          let l3 = G1(e8, i3, "start", d, t3, a3, r);
          i3.push(...l3);
        }
        if (c3 !== null) {
          let l3 = G1(e8, i3, "end", c3, t3, a3, r);
          i3.push(...l3);
        }
      }
      return i3;
    }
    case "freedraw": {
      let i3;
      if (V1(e8), Kt(e8.points)) {
        let a3 = simplify2(e8.points, 0.75);
        i3 = t3.curve(a3, { ...rt(e8), stroke: "none" });
      } else i3 = null;
      return i3;
    }
    case "frame":
    case "magicframe":
    case "text":
    case "image":
      return null;
    default:
      return Sn(e8, `generateElementShape(): Unimplemented type ${e8?.type}`), null;
  }
};
var qm = (e8, t3) => {
  let n3 = [];
  for (let o3 = 1; o3 < e8.length - 1; o3 += 1) {
    let i3 = e8[o3 - 1], a3 = e8[o3 + 1], s3 = e8[o3], d = Mt(s3, i3), c3 = Mt(a3, s3), l3 = Math.min(t3, ie2(e8[o3], a3) / 2, ie2(e8[o3], i3) / 2);
    d ? i3[0] < s3[0] ? n3.push([e8[o3][0] - l3, e8[o3][1]]) : n3.push([e8[o3][0] + l3, e8[o3][1]]) : i3[1] < s3[1] ? n3.push([e8[o3][0], e8[o3][1] - l3]) : n3.push([e8[o3][0], e8[o3][1] + l3]), n3.push(e8[o3]), c3 ? a3[0] < s3[0] ? n3.push([e8[o3][0] - l3, e8[o3][1]]) : n3.push([e8[o3][0] + l3, e8[o3][1]]) : a3[1] < s3[1] ? n3.push([e8[o3][0], e8[o3][1] - l3]) : n3.push([e8[o3][0], e8[o3][1] + l3]);
  }
  let r = [`M ${e8[0][0]} ${e8[0][1]}`];
  for (let o3 = 0; o3 < n3.length; o3 += 3) r.push(`L ${n3[o3][0]} ${n3[o3][1]}`), r.push(`Q ${n3[o3 + 1][0]} ${n3[o3 + 1][1]}, ${n3[o3 + 2][0]} ${n3[o3 + 2][1]}`);
  return r.push(`L ${e8[e8.length - 1][0]} ${e8[e8.length - 1][1]}`), r.join(" ");
};
var xn = (e8) => {
  let t3 = e8.map((r) => r[0]), n3 = e8.map((r) => r[1]);
  return { width: Math.max(...t3) - Math.min(...t3), height: Math.max(...n3) - Math.min(...n3) };
};
var nr = (e8, t3, n3, r) => {
  let o3 = n3.map((m) => m[e8]), i3 = Math.max(...o3), a3 = Math.min(...o3), s3 = i3 - a3, d = s3 === 0 ? 1 : t3 / s3, c3 = 1 / 0, l3 = n3.map((m) => {
    let b3 = m[e8] * d, E = [...m];
    return E[e8] = b3, b3 < c3 && (c3 = b3), E;
  });
  if (!r || l3.length === 2) return l3;
  let U = a3 - c3;
  return l3.map((m) => m.map((b3, E) => E === e8 ? b3 + U : b3));
};
var rr = class rr2 {
  static getBounds(t3, n3) {
    let r = rr2.boundsCache.get(t3);
    if (r?.version && r.version === t3.version && !Ne(t3)) return r.bounds;
    let o3 = rr2.calculateBounds(t3, n3);
    return rr2.boundsCache.set(t3, { version: t3.version, bounds: o3 }), o3;
  }
  static calculateBounds(t3, n3) {
    let r, [o3, i3, a3, s3, d, c3] = C2(t3, n3);
    if (Ce(t3)) {
      let [l3, U, p, m] = va(t3.points.map(([b3, E]) => T(u(b3, E), u(d - t3.x, c3 - t3.y), t3.angle)));
      return [l3 + t3.x, U + t3.y, p + t3.x, m + t3.y];
    } else if (ae2(t3)) r = zm(t3, d, c3, n3);
    else if (t3.type === "diamond") {
      let [l3, U] = T(u(d, i3), u(d, c3), t3.angle), [p, m] = T(u(d, s3), u(d, c3), t3.angle), [b3, E] = T(u(o3, c3), u(d, c3), t3.angle), [g, h] = T(u(a3, c3), u(d, c3), t3.angle), x = Math.min(l3, p, b3, g), y = Math.min(U, m, E, h), w = Math.max(l3, p, b3, g), I = Math.max(U, m, E, h);
      r = [x, y, w, I];
    } else if (t3.type === "ellipse") {
      let l3 = (a3 - o3) / 2, U = (s3 - i3) / 2, p = Math.cos(t3.angle), m = Math.sin(t3.angle), b3 = Math.hypot(l3 * p, U * m), E = Math.hypot(U * p, l3 * m);
      r = [d - b3, c3 - E, d + b3, c3 + E];
    } else {
      let [l3, U] = T(u(o3, i3), u(d, c3), t3.angle), [p, m] = T(u(o3, s3), u(d, c3), t3.angle), [b3, E] = T(u(a3, s3), u(d, c3), t3.angle), [g, h] = T(u(a3, i3), u(d, c3), t3.angle), x = Math.min(l3, p, b3, g), y = Math.min(U, m, E, h), w = Math.max(l3, p, b3, g), I = Math.max(U, m, E, h);
      r = [x, y, w, I];
    }
    return r;
  }
};
i(rr, "boundsCache", /* @__PURE__ */ new WeakMap());
var La = rr;
var C2 = (e8, t3, n3 = false) => {
  if (Ce(e8)) return Gm(e8);
  if (ae2(e8)) return z.getElementAbsoluteCoords(e8, t3, n3);
  if (k(e8)) {
    let r = t3 ? qe(e8, t3) : null;
    if (ee2(r)) {
      let { x: o3, y: i3 } = z.getBoundTextElementPosition(r, e8, t3);
      return [o3, i3, o3 + e8.width, i3 + e8.height, o3 + e8.width / 2, i3 + e8.height / 2];
    }
  }
  return [e8.x, e8.y, e8.x + e8.width, e8.y + e8.height, e8.x + e8.width / 2, e8.y + e8.height / 2];
};
var Sa = (e8, t3) => {
  let [n3, r, o3, i3, a3, s3] = C2(e8, t3), d = u(a3, s3);
  if (ae2(e8) || Ce(e8)) {
    let h = [], x = 0;
    for (; x < e8.points.length - 1; ) h.push(A2(T(u(e8.points[x][0] + e8.x, e8.points[x][1] + e8.y), d, e8.angle), T(u(e8.points[x + 1][0] + e8.x, e8.points[x + 1][1] + e8.y), d, e8.angle))), x++;
    return h;
  }
  let [c3, l3, U, p, m, b3, E, g] = [[n3, r], [o3, r], [n3, i3], [o3, i3], [a3, r], [a3, i3], [n3, s3], [o3, s3]].map((h) => T(h, d, e8.angle));
  return e8.type === "diamond" ? [A2(m, E), A2(m, g), A2(b3, E), A2(b3, g)] : e8.type === "ellipse" ? [A2(m, E), A2(m, g), A2(b3, E), A2(b3, g), A2(m, E), A2(m, g), A2(b3, E), A2(b3, g)] : [A2(c3, l3), A2(U, p), A2(c3, U), A2(l3, p), A2(c3, g), A2(U, g), A2(l3, E), A2(p, E)];
};
var Or = (e8) => {
  let t3 = Math.floor(e8.width / 2) + 1, n3 = 0, r = e8.width, o3 = Math.floor(e8.height / 2) + 1, i3 = t3, a3 = e8.height;
  return [t3, n3, r, o3, i3, a3, 0, o3];
};
var Z1 = (e8, t3, n3, r, o3) => {
  let i3 = 1 - e8;
  return Math.pow(i3, 3) * t3 + 3 * Math.pow(i3, 2) * e8 * n3 + 3 * i3 * Math.pow(e8, 2) * r + Math.pow(e8, 3) * o3;
};
var W1 = (e8, t3, n3, r) => {
  let o3 = t3 - e8, i3 = n3 - t3, a3 = r - n3, s3 = 3 * o3 - 6 * i3 + 3 * a3, d = 6 * i3 - 6 * o3, c3 = 3 * o3, l3 = d * d - 4 * s3 * c3;
  if (!(l3 >= 0)) return false;
  let p = null, m = null, b3 = 1 / 0, E = 1 / 0;
  return s3 === 0 ? b3 = E = -c3 / d : (b3 = (-d + Math.sqrt(l3)) / (2 * s3), E = (-d - Math.sqrt(l3)) / (2 * s3)), b3 >= 0 && b3 <= 1 && (p = Z1(b3, e8, t3, n3, r)), E >= 0 && E <= 1 && (m = Z1(E, e8, t3, n3, r)), [p, m];
};
var Xm = (e8, t3, n3, r) => {
  let o3 = W1(e8[0], t3[0], n3[0], r[0]), i3 = W1(e8[1], t3[1], n3[1], r[1]), a3 = Math.min(e8[0], r[0]), s3 = Math.max(e8[0], r[0]);
  if (o3) {
    let l3 = o3.filter((U) => U !== null);
    a3 = Math.min(a3, ...l3), s3 = Math.max(s3, ...l3);
  }
  let d = Math.min(e8[1], r[1]), c3 = Math.max(e8[1], r[1]);
  if (i3) {
    let l3 = i3.filter((U) => U !== null);
    d = Math.min(d, ...l3), c3 = Math.max(c3, ...l3);
  }
  return [a3, d, s3, c3];
};
var Hr = (e8, t3) => {
  let n3 = u(0, 0), { minX: r, minY: o3, maxX: i3, maxY: a3 } = e8.reduce((s3, { op: d, data: c3 }) => {
    if (d === "move") {
      let l3 = Ir(c3);
      Ae(l3 != null, "Op data is not a point"), n3 = l3;
    } else if (d === "bcurveTo") {
      let l3 = u(c3[0], c3[1]), U = u(c3[2], c3[3]), p = u(c3[4], c3[5]), m = t3 ? t3(l3) : l3, b3 = t3 ? t3(U) : U, E = t3 ? t3(p) : p, g = t3 ? t3(n3) : n3;
      n3 = p;
      let [h, x, y, w] = Xm(g, m, b3, E);
      s3.minX = Math.min(s3.minX, h), s3.minY = Math.min(s3.minY, x), s3.maxX = Math.max(s3.maxX, y), s3.maxY = Math.max(s3.maxY, w);
    }
    return s3;
  }, { minX: 1 / 0, minY: 1 / 0, maxX: -1 / 0, maxY: -1 / 0 });
  return [r, o3, i3, a3];
};
var va = (e8) => {
  let t3 = 1 / 0, n3 = 1 / 0, r = -1 / 0, o3 = -1 / 0;
  for (let [i3, a3] of e8) t3 = Math.min(t3, i3), n3 = Math.min(n3, a3), r = Math.max(r, i3), o3 = Math.max(o3, a3);
  return [t3, n3, r, o3];
};
var Gm = (e8) => {
  let [t3, n3, r, o3] = va(e8.points), i3 = t3 + e8.x, a3 = n3 + e8.y, s3 = r + e8.x, d = o3 + e8.y;
  return [i3, a3, s3, d, (i3 + s3) / 2, (a3 + d) / 2];
};
var km = (e8) => {
  switch (e8) {
    case "arrow":
      return 25;
    case "diamond":
    case "diamond_outline":
      return 12;
    case "crowfoot_many":
    case "crowfoot_one":
    case "crowfoot_one_or_many":
      return 20;
    default:
      return 15;
  }
};
var Zm = (e8) => {
  switch (e8) {
    case "bar":
      return 90;
    case "arrow":
      return 20;
    default:
      return 25;
  }
};
var ii = (e8, t3, n3, r) => {
  if (t3.length < 1) return null;
  let o3 = It(t3[0]);
  if (o3.length < 1) return null;
  let i3 = n3 === "start" ? 1 : o3.length - 1, a3 = o3[i3].data;
  Ae(a3.length === 6, "Op data length is not 6");
  let s3 = u(a3[4], a3[5]), d = u(a3[2], a3[3]), c3 = u(a3[0], a3[1]), l3 = o3[i3 - 1], U = u(0, 0);
  if (l3.op === "move") {
    let V3 = Ir(l3.data);
    Ae(V3 != null, "Op data is not a point"), U = V3;
  } else l3.op === "bcurveTo" && (U = u(l3.data[4], l3.data[5]));
  let p = (V3, ce2) => Math.pow(1 - V3, 3) * s3[ce2] + 3 * V3 * Math.pow(1 - V3, 2) * d[ce2] + 3 * Math.pow(V3, 2) * (1 - V3) * c3[ce2] + U[ce2] * Math.pow(V3, 3), [m, b3] = n3 === "start" ? U : s3, [E, g] = [p(0.3, 0), p(0.3, 1)], h = Math.hypot(m - E, b3 - g), x = (m - E) / h, y = (b3 - g) / h, w = km(r), I = 0;
  {
    let [V3, ce2] = n3 === "end" ? e8.points[e8.points.length - 1] : e8.points[0], [J, j] = e8.points.length > 1 ? n3 === "end" ? e8.points[e8.points.length - 2] : e8.points[1] : [0, 0];
    I = Math.hypot(V3 - J, ce2 - j);
  }
  let v = Math.min(w, I * (r === "diamond" || r === "diamond_outline" ? 0.25 : 0.5)), D = m - x * v, $3 = b3 - y * v;
  if (r === "dot" || r === "circle" || r === "circle_outline") {
    let V3 = Math.hypot($3 - b3, D - m) + e8.strokeWidth - 2;
    return [m, b3, V3];
  }
  let N = Zm(r);
  if (r === "crowfoot_many" || r === "crowfoot_one_or_many") {
    let [V3, ce2] = T(u(m, b3), u(D, $3), yr(-N)), [J, j] = T(u(m, b3), u(D, $3), yr(N));
    return [D, $3, V3, ce2, J, j];
  }
  let [B3, _] = T(u(D, $3), u(m, b3), -N * Math.PI / 180), [W, be] = T(u(D, $3), u(m, b3), yr(N));
  if (r === "diamond" || r === "diamond_outline") {
    let V3, ce2;
    if (n3 === "start") {
      let [J, j] = e8.points.length > 1 ? e8.points[1] : [0, 0];
      [V3, ce2] = T(u(m + v * 2, b3), u(m, b3), Math.atan2(j - b3, J - m));
    } else {
      let [J, j] = e8.points.length > 1 ? e8.points[e8.points.length - 2] : [0, 0];
      [V3, ce2] = T(u(m - v * 2, b3), u(m, b3), Math.atan2(b3 - j, m - J));
    }
    return [m, b3, B3, _, V3, ce2, W, be];
  }
  return [m, b3, B3, _, W, be];
};
var Wm = (e8) => {
  let t3 = rough_default.generator(), n3 = rt(e8), r = e8.roundness ? "curve" : n3.fill ? "polygon" : "linearPath";
  return t3[r](e8.points, n3);
};
var zm = (e8, t3, n3, r) => {
  let o3 = oe(e8, r);
  if (e8.points.length < 2) {
    let [U, p] = e8.points[0], [m, b3] = T(u(e8.x + U, e8.y + p), u(t3, n3), e8.angle), E = [m, b3, m, b3];
    if (o3) {
      let g = z.getMinMaxXYWithBoundText(e8, r, [m, b3, m, b3], o3);
      E = [g[0], g[1], g[2], g[3]];
    }
    return E;
  }
  let a3 = he2.get(e8)?.[0] ?? Wm(e8), s3 = It(a3), c3 = Hr(s3, ([U, p]) => T(u(e8.x + U, e8.y + p), u(t3, n3), e8.angle)), l3 = [c3[0], c3[1], c3[2], c3[3]];
  if (o3) {
    let U = z.getMinMaxXYWithBoundText(e8, r, l3, o3);
    l3 = [U[0], U[1], U[2], U[3]];
  }
  return l3;
};
var Ke = (e8, t3) => La.getBounds(e8, t3);
var $e = (e8, t3) => {
  if (!e8.length) return [0, 0, 0, 0];
  let n3 = 1 / 0, r = -1 / 0, o3 = 1 / 0, i3 = -1 / 0, a3 = t3 || te(e8);
  return e8.forEach((s3) => {
    let [d, c3, l3, U] = Ke(s3, a3);
    n3 = Math.min(n3, d), o3 = Math.min(o3, c3), r = Math.max(r, l3), i3 = Math.max(i3, U);
  }), [n3, o3, r, i3];
};
var ai = (e8, t3) => {
  let [n3, r, o3, i3] = $e(e8);
  return [n3 + t3.x, r + t3.y, o3 + t3.x, i3 + t3.y];
};
var Rt = (e8, t3, n3, r) => {
  if (!(ae2(e8) || Ce(e8))) return [e8.x, e8.y, e8.x + t3, e8.y + n3];
  let o3 = nr(0, t3, nr(1, n3, e8.points, r), r), i3;
  if (Ce(e8)) i3 = va(o3);
  else {
    let l3 = rough_default.generator(), U = e8.roundness ? l3.curve(o3, rt(e8)) : l3.linearPath(o3, rt(e8)), p = It(U);
    i3 = Hr(p);
  }
  let [a3, s3, d, c3] = i3;
  return [a3 + e8.x, s3 + e8.y, d + e8.x, c3 + e8.y];
};
var $a = (e8, t3) => {
  let n3 = rough_default.generator(), r = e8.roundness == null ? n3.linearPath(t3, rt(e8)) : n3.curve(t3, rt(e8)), o3 = It(r), [i3, a3, s3, d] = Hr(o3);
  return [i3 + e8.x, a3 + e8.y, s3 + e8.x, d + e8.y];
};
var Pa = (e8, t3) => {
  if (!e8.length) return [0, 0, 0, 0];
  let n3 = 1 / 0, r = e8[0], o3 = te(e8);
  return e8.forEach((i3) => {
    let [a3, s3, d, c3] = Ke(i3, o3), l3 = ie2(u((a3 + d) / 2, (s3 + c3) / 2), u(t3.x, t3.y));
    l3 < n3 && (n3 = l3, r = i3);
  }), Ke(r, o3);
};
var Na = (e8) => {
  let [t3, n3, r, o3] = $e(e8);
  return { minX: t3, minY: n3, maxX: r, maxY: o3, width: r - t3, height: o3 - n3, midX: (t3 + r) / 2, midY: (n3 + o3) / 2 };
};
var fN = ({ scrollX: e8, scrollY: t3, width: n3, height: r, zoom: o3 }) => [-e8, -t3, -e8 + n3 / o3.value, -t3 + r / o3.value];
var Kr = (e8) => u(e8[0] + (e8[2] - e8[0]) / 2, e8[1] + (e8[3] - e8[1]) / 2);
var z1 = (e8, t3) => {
  if (e8 == null || t3 == null) return false;
  let [n3, r, o3, i3] = e8, [a3, s3, d, c3] = t3;
  return n3 < d && o3 > a3 && r < c3 && i3 > s3;
};
var or = (e8, t3) => {
  switch (e8.type) {
    case "rectangle":
    case "image":
    case "text":
    case "iframe":
    case "embeddable":
    case "frame":
    case "magicframe":
      return Qm(e8, t3);
    case "diamond":
      return jm(e8, t3);
    case "ellipse":
      return eb(e8, t3);
  }
};
var Qm = (e8, t3) => {
  let n3 = u(e8.x + e8.width / 2, e8.y + e8.height / 2), r = T(t3, n3, -e8.angle), [o3, i3] = Qo(e8);
  return Math.min(...o3.map((a3) => vo(r, a3)), ...i3.map((a3) => zi(a3, r)).filter((a3) => a3 !== null));
};
var jm = (e8, t3) => {
  let n3 = u(e8.x + e8.width / 2, e8.y + e8.height / 2), r = T(t3, n3, -e8.angle), [o3, i3] = jo(e8);
  return Math.min(...o3.map((a3) => vo(r, a3)), ...i3.map((a3) => zi(a3, r)).filter((a3) => a3 !== null));
};
var eb = (e8, t3) => {
  let n3 = u(e8.x + e8.width / 2, e8.y + e8.height / 2);
  return T1(T(t3, n3, -e8.angle), zo(n3, e8.width / 2, e8.height / 2));
};
var FN = (e8) => !e8[Q.CTRL_OR_CMD];
var Fa = (e8) => e8.isBindingEnabled;
var me2 = 5;
var t2 = 10;
var n2 = 4;
var tb = (e8, t3) => {
  let n3 = [];
  return t3.forEach((r) => {
    let o3 = e8.getNonDeletedElement(r);
    o3 != null && n3.push(o3);
  }), n3;
};
var Ba = (e8, t3, n3, r, o3) => {
  let i3 = /* @__PURE__ */ new Set(), a3 = /* @__PURE__ */ new Set();
  Q1(e8, t3, n3, "start", i3, a3, r), Q1(e8, n3, t3, "end", i3, a3, r);
  let s3 = Array.from(a3).filter((d) => !i3.has(d));
  tb(o3, s3).forEach((d) => {
    Y(d, { boundElements: d.boundElements?.filter((c3) => c3.type !== "arrow" || c3.id !== e8.id) });
  });
};
var Q1 = (e8, t3, n3, r, o3, i3, a3) => {
  if (t3 !== "keep") {
    if (t3 === null) {
      let s3 = sb(e8, r);
      s3 != null && i3.add(s3);
      return;
    }
    i22(e8) ? (n3 == null || (n3 === "keep" ? !o2(e8, t3, r) : r === "start" || n3.id !== t3.id)) && (di(e8, t3, r, a3), o3.add(t3.id)) : (di(e8, t3, r, a3), o3.add(t3.id));
  }
};
var nb = (e8, t3, n3, r) => {
  let o3 = c2(e8, t3, n3), i3 = t3 === "start" ? e8.startBinding?.elementId : e8.endBinding?.elementId;
  if (i3) {
    let a3 = n3.get(i3);
    if (xt(a3) && si(a3, o3, n3, r)) return a3;
  }
  return null;
};
var r2 = (e8, t3, n3) => ["start", "end"].map((r) => nb(e8, r, t3, n3));
var rb = (e8, t3, n3, r, o3, i3) => {
  let s3 = e8.points.length - 1, d = n3.findIndex((p) => p === 0) > -1, c3 = n3.findIndex((p) => p === s3) > -1, l3 = d ? t3 ? ir(e8, "start", r, o3, i3) : null : X(e8) ? "keep" : ir(e8, "start", r, o3, i3), U = c3 ? t3 ? ir(e8, "end", r, o3, i3) : null : X(e8) ? "keep" : ir(e8, "end", r, o3, i3);
  return [l3, U];
};
var ob = (e8, t3, n3, r, o3) => {
  if (X(e8)) return ["keep", "keep"];
  let [i3, a3] = r2(e8, t3, o3), s3 = i3 && r ? ir(e8, "start", t3, n3, o3) : null, d = a3 && r ? ir(e8, "end", t3, n3, o3) : null;
  return [s3, d];
};
var BN = (e8, t3, n3, r, o3, i3, a3) => {
  e8.forEach((s3) => {
    let [d, c3] = i3?.length ? rb(s3, o3, i3 ?? [], t3, n3, a3) : ob(s3, t3, n3, o3, a3);
    Ba(s3, d, c3, t3, r);
  });
};
var _N = (e8, t3, n3) => e8.length > 50 ? [] : e8.filter(ae2).flatMap((r) => r2(r, t3, n3)).filter((r) => r !== null).filter((r) => e8.filter((o3) => o3.id === r?.id).length === 0);
var ON = (e8, t3, n3, r, o3) => {
  t3.startBoundElement != null && di(e8, t3.startBoundElement, "start", r);
  let i3 = Bn(n3, o3, r, t3.zoom, X(e8), X(e8));
  i3 !== null && (o2(e8, i3, "end") || di(e8, i3, "end", r));
};
var ib = (e8, t3) => {
  let n3 = e8.gap, r = pi(t3, t3.width, t3.height);
  return n3 > r && (n3 = t2 + n2), { ...e8, gap: n3 };
};
var di = (e8, t3, n3, r) => {
  if (!ee2(e8)) return;
  let o3 = { elementId: t3.id, ...X(e8) ? { ...d2(e8, t3, n3, r), focus: 0, gap: 0 } : { ...ib(lb(e8, t3, n3, r), t3) } };
  Y(e8, { [n3 === "start" ? "startBinding" : "endBinding"]: o3 }), te(t3.boundElements || []).has(e8.id) || Y(t3, { boundElements: (t3.boundElements || []).concat({ id: e8.id, type: "arrow" }) });
};
var o2 = (e8, t3, n3) => {
  let r = e8[n3 === "start" ? "endBinding" : "startBinding"];
  return ab(e8, r?.elementId, t3);
};
var ab = (e8, t3, n3) => t3 === n3.id && i22(e8);
var i22 = (e8) => e8.points.length < 3;
var sb = (e8, t3) => {
  let n3 = t3 === "start" ? "startBinding" : "endBinding", r = e8[n3];
  return r == null ? null : (Y(e8, { [n3]: null }), r.elementId);
};
var Bn = (e8, t3, n3, r, o3, i3) => {
  if (i3) {
    let s3 = false, d = cb(t3, (l3) => xt(l3, false) && si(l3, e8, n3, r, (o3 || !No(l3)) && !de2(l3))).filter((l3) => s3 ? false : (No(l3) || (s3 = true), true));
    if (!d || d.length === 0) return null;
    if (d.length === 1) return d[0];
    let c3 = d.filter((l3) => si(l3, e8, n3, r, false));
    return c3.length === 1 ? c3[0] : d.sort((l3, U) => U.width ** 2 + U.height ** 2 - (l3.width ** 2 + l3.height ** 2)).pop();
  }
  return db(t3, (s3) => xt(s3, false) && si(s3, e8, n3, r, (o3 || !No(s3)) && !de2(s3)));
};
var db = (e8, t3) => {
  let n3 = null;
  for (let r = e8.length - 1; r >= 0; --r) {
    let o3 = e8[r];
    if (!o3.isDeleted && t3(o3)) {
      n3 = o3;
      break;
    }
  }
  return n3;
};
var cb = (e8, t3) => {
  let n3 = [];
  for (let r = e8.length - 1; r >= 0; --r) {
    let o3 = e8[r];
    o3.isDeleted || t3(o3) && n3.push(o3);
  }
  return n3;
};
var lb = (e8, t3, n3, r) => {
  let o3 = n3 === "start" ? -1 : 1, i3 = o3 === -1 ? 0 : e8.points.length - 1, a3 = i3 - o3, s3 = z.getPointAtIndexGlobalCoordinates(e8, i3, r), d = z.getPointAtIndexGlobalCoordinates(e8, a3, r);
  return { focus: Eb(t3, d, s3), gap: Math.max(1, or(t3, s3)) };
};
var Jt = (e8, t3, n3) => {
  let { newSize: r, simultaneouslyUpdated: o3 } = n3 ?? {}, i3 = fb(o3);
  xt(e8) && ci(t3, e8, (a3) => {
    if (!ae2(a3) || a3.isDeleted || !Ub(a3, e8)) return;
    let s3 = a3.startBinding ? t3.get(a3.startBinding.elementId) : null, d = a3.endBinding ? t3.get(a3.endBinding.elementId) : null, c3 = null, l3 = null;
    s3 && d && (c3 = Ke(s3, t3), l3 = Ke(d, t3));
    let U = { startBinding: j1(e8, a3.startBinding, r), endBinding: j1(e8, a3.endBinding, r) };
    if (i3.has(a3.id)) {
      Y(a3, U, true);
      return;
    }
    let p = li(t3, a3, (b3, E) => {
      if (b3 && xt(b3) && (E === "startBinding" || E === "endBinding") && (e8.id === a3[E]?.elementId || e8.id === a3[E === "startBinding" ? "endBinding" : "startBinding"]?.elementId && !z1(c3, l3))) {
        let g = bb(a3, E, U[E], b3, t3);
        if (g) return { index: E === "startBinding" ? 0 : a3.points.length - 1, point: g };
      }
      return null;
    }).filter((b3) => b3 !== null);
    z.movePoints(a3, p, { ...e8.id === a3.startBinding?.elementId ? { startBinding: U.startBinding } : {}, ...e8.id === a3.endBinding?.elementId ? { endBinding: U.endBinding } : {} });
    let m = oe(a3, t3);
    m && !m.isDeleted && _n(a3, t3, false);
  });
};
var Ub = (e8, t3) => e8.startBinding?.elementId === t3.id || e8.endBinding?.elementId === t3.id;
var fb = (e8) => new Set((e8 || []).map((t3) => t3.id));
var a2 = (e8, t3, n3, r, o3, i3, a3) => {
  let s3 = Ht(O(t3, e8));
  return !n3 || !r ? s3 : pb(i3, n3, o3, a3) ? q1(n3, r, e8) : Ht(O(e8, u(n3.x + n3.width / 2, n3.y + n3.height / 2)));
};
var pb = (e8, t3, n3, r) => {
  let o3 = or(t3, e8), i3 = pi(t3, t3.width, t3.height, r);
  return o3 > i3 ? null : o3;
};
var fi = (e8, t3, n3) => {
  let r = t3 && wt(t3), o3 = e8.points[n3 === "start" ? 0 : e8.points.length - 1], i3 = u(e8.x + o3[0], e8.y + o3[1]), a3 = Id(t3) ? mb(t3, i3) : i3;
  if (t3 && r) {
    let s3 = Kr(r), d = Ea(t3, A2(s3, q(ue2(Je(O(a3, s3)), Math.max(t3.width, t3.height)), s3)))[0], c3 = ie2(a3, s3), l3 = Math.max(ie2(d ?? a3, s3), 1e-4), U = To(c3 / l3, 6);
    switch (true) {
      case U > 0.9:
        return c3 - l3 > me2 || Xn(a3, d) < 1e-4 ? a3 : q(ue2(Je(O(a3, d ?? s3)), U > 1 ? me2 : -me2), d ?? s3);
      default:
        return ub(a3, t3, r);
    }
  }
  return a3;
};
var ub = (e8, t3, n3) => {
  let r = Kr(n3), o3 = Ht(O(e8, r));
  switch (true) {
    case ve(o3, ze):
      return T(u((n3[0] + n3[2]) / 2 + 0.1, n3[1]), r, t3.angle);
    case ve(o3, Re):
      return T(u(n3[2], (n3[1] + n3[3]) / 2 + 0.1), r, t3.angle);
    case ve(o3, Fe):
      return T(u((n3[0] + n3[2]) / 2 - 0.1, n3[3]), r, t3.angle);
    default:
      return T(u(n3[0], (n3[1] + n3[3]) / 2 - 0.1), r, t3.angle);
  }
};
var mb = (e8, t3) => {
  let n3 = u(e8.x + e8.width / 2, e8.y + e8.height / 2), r = T(t3, n3, -e8.angle);
  return r[0] < e8.x && r[1] < e8.y ? r[1] - e8.y > -me2 ? T(u(e8.x - me2, e8.y), n3, e8.angle) : T(u(e8.x, e8.y - me2), n3, e8.angle) : r[0] < e8.x && r[1] > e8.y + e8.height ? r[0] - e8.x > -me2 ? T(u(e8.x, e8.y + e8.height + me2), n3, e8.angle) : T(u(e8.x - me2, e8.y + e8.height), n3, e8.angle) : r[0] > e8.x + e8.width && r[1] > e8.y + e8.height ? r[0] - e8.x < e8.width + me2 ? T(u(e8.x + e8.width, e8.y + e8.height + me2), n3, e8.angle) : T(u(e8.x + e8.width + me2, e8.y + e8.height), n3, e8.angle) : r[0] > e8.x + e8.width && r[1] < e8.y ? r[0] - e8.x < e8.width + me2 ? T(u(e8.x + e8.width, e8.y - me2), n3, e8.angle) : T(u(e8.x + e8.width + me2, e8.y), n3, e8.angle) : t3;
};
var s2 = (e8, t3, n3 = 0.05) => {
  let { x: r, y: o3, width: i3, height: a3, angle: s3 } = e8, d = u(r + i3 / 2 - 0.1, o3 + a3 / 2 - 0.1), c3 = T(t3, d, -s3), l3 = se2(n3 * a3, 5, 80), U = se2(n3 * i3, 5, 80);
  return c3[0] <= r + i3 / 2 && c3[1] > d[1] - l3 && c3[1] < d[1] + l3 ? T(u(r - me2, d[1]), d, s3) : c3[1] <= o3 + a3 / 2 && c3[0] > d[0] - U && c3[0] < d[0] + U ? T(u(d[0], o3 - me2), d, s3) : c3[0] >= r + i3 / 2 && c3[1] > d[1] - l3 && c3[1] < d[1] + l3 ? T(u(r + i3 + me2, d[1]), d, s3) : c3[1] >= o3 + a3 / 2 && c3[0] > d[0] - U && c3[0] < d[0] + U ? T(u(d[0], o3 + a3 + me2), d, s3) : t3;
};
var bb = (e8, t3, n3, r, o3) => {
  if (n3 == null || n3.elementId !== r.id && e8.points.length > 2) return null;
  let i3 = t3 === "startBinding" ? -1 : 1, a3 = i3 === -1 ? 0 : e8.points.length - 1;
  if (X(e8) && vn(n3)) {
    let U = Yr(n3.fixedPoint) ?? d2(e8, r, t3 === "startBinding" ? "start" : "end", o3).fixedPoint, p = u(r.x + r.width / 2, r.y + r.height / 2), m = u(r.x + U[0] * r.width, r.y + U[1] * r.height), b3 = T(m, p, r.angle);
    return z.pointFromAbsoluteCoords(e8, b3, o3);
  }
  let s3 = a3 - i3, d = z.getPointAtIndexGlobalCoordinates(e8, s3, o3), c3 = gb(r, n3.focus, d), l3;
  if (n3.gap === 0) l3 = c3;
  else {
    let U = z.getPointAtIndexGlobalCoordinates(e8, a3, o3), p = u(r.x + r.width / 2, r.y + r.height / 2), m = ie2(d, U) + ie2(d, p) + Math.max(r.width, r.height) * 2, b3 = Ea(r, A2(d, q(ue2(Je(O(c3, d)), m), d)), n3.gap).sort((E, g) => Xn(E, d) - Xn(g, d));
    b3.length > 1 ? l3 = b3[0] : b3.length === 1 ? l3 = c3 : l3 = U;
  }
  return z.pointFromAbsoluteCoords(e8, l3, o3);
};
var d2 = (e8, t3, n3, r) => {
  let o3 = [t3.x, t3.y, t3.x + t3.width, t3.y + t3.height], i3 = fi(e8, t3, n3), a3 = u(o3[0] + (o3[2] - o3[0]) / 2, o3[1] + (o3[3] - o3[1]) / 2), s3 = T(i3, a3, -t3.angle);
  return { fixedPoint: Yr([(s3[0] - t3.x) / t3.width, (s3[1] - t3.y) / t3.height]) };
};
var j1 = (e8, t3, n3) => {
  if (t3 == null || n3 == null) return t3;
  let { width: r, height: o3 } = n3, { width: i3, height: a3 } = e8, s3 = Math.max(1, Math.min(pi(e8, r, o3), t3.gap * (r < o3 ? r / i3 : o3 / a3)));
  return { ...t3, gap: s3 };
};
var ir = (e8, t3, n3, r, o3) => Bn(c2(e8, t3, n3), r, n3, o3, X(e8), X(e8));
var c2 = (e8, t3, n3) => {
  let r = t3 === "start" ? 0 : -1;
  return un(z.getPointAtIndexGlobalCoordinates(e8, r, n3));
};
var AN = (e8, t3, n3, r) => {
  let o3 = /* @__PURE__ */ new Set(), i3 = /* @__PURE__ */ new Set(), a3 = r === "duplicatesServeAsOld", s3 = new Map([...n3].map(([d, c3]) => [c3, d]));
  t3.forEach((d) => {
    let { boundElements: c3 } = d;
    if (c3 != null && c3.length > 0 && (c3.forEach((l3) => {
      a3 && !n3.has(l3.id) && o3.add(l3.id);
    }), i3.add(n3.get(d.id))), Pr(d)) {
      if (d.startBinding != null) {
        let { elementId: l3 } = d.startBinding;
        a3 && !n3.has(l3) && i3.add(l3);
      }
      if (d.endBinding != null) {
        let { elementId: l3 } = d.endBinding;
        a3 && !n3.has(l3) && i3.add(l3);
      }
      (d.startBinding != null || d.endBinding != null) && o3.add(n3.get(d.id));
    }
  }), e8.filter(({ id: d }) => o3.has(d)).forEach((d) => {
    let { startBinding: c3, endBinding: l3 } = d;
    Y(d, { startBinding: e22(c3, n3), endBinding: e22(l3, n3) });
  }), e8.filter(({ id: d }) => i3.has(d)).forEach((d) => {
    let c3 = s3.get(d.id), l3 = e8.find(({ id: U }) => U === c3)?.boundElements;
    l3 && l3.length > 0 && Y(d, { boundElements: l3.map((U) => n3.has(U.id) ? { id: n3.get(U.id), type: U.type } : U) });
  });
};
var e22 = (e8, t3) => e8 == null ? null : { ...e8, elementId: t3.get(e8.elementId) ?? e8.elementId };
var KN = (e8, t3) => {
  let n3 = te(e8);
  for (let r of t3) rn.unbindAffected(n3, r, Y), on.unbindAffected(n3, r, Y);
};
var Jr = (e8, t3, n3 = []) => {
  if (!e8) return null;
  let r = e8.filter((o3) => !t3.has(o3.id));
  return r.push(...n3.map((o3) => ({ id: o3.id, type: o3.type }))), r;
};
var si = (e8, { x: t3, y: n3 }, r, o3, i3) => {
  let a3 = pi(e8, e8.width, e8.height, o3), s3 = ti(e8, r);
  return _r(u(t3, n3), s3, a3) || i3 === true && gn(u(t3, n3), wt(e8));
};
var pi = (e8, t3, n3, r) => {
  let o3 = r?.value && r.value < 1 ? r.value : 1, a3 = (e8.type === "diamond" ? 1 / Math.sqrt(2) : 1) * Math.min(t3, n3);
  return Math.max(16, Math.min(0.25 * a3, 32), t2 / o3 + n2);
};
var Eb = (e8, t3, n3) => {
  let r = u(e8.x + e8.width / 2, e8.y + e8.height / 2);
  if (_e(t3, n3)) return 0;
  let o3 = T(t3, r, -e8.angle), i3 = T(n3, r, -e8.angle), a3 = Math.sign(Me(O(i3, t3), O(i3, r))) * -1, s3 = A2(i3, q(ue2(Je(O(i3, o3)), Math.max(e8.width * 2, e8.height * 2)), i3)), d = e8.type === "diamond" ? [A2(u(e8.x + e8.width / 2, e8.y), u(e8.x + e8.width / 2, e8.y + e8.height)), A2(u(e8.x, e8.y + e8.height / 2), u(e8.x + e8.width, e8.y + e8.height / 2))] : [A2(u(e8.x, e8.y), u(e8.x + e8.width, e8.y + e8.height)), A2(u(e8.x + e8.width, e8.y), u(e8.x, e8.y + e8.height))], c3 = e8.type === "diamond" ? [A2(u(e8.x + e8.width / 2, e8.y - e8.height), u(e8.x + e8.width / 2, e8.y + e8.height * 2)), A2(u(e8.x - e8.width, e8.y + e8.height / 2), u(e8.x + e8.width * 2, e8.y + e8.height / 2))] : [A2(u(e8.x - e8.width, e8.y - e8.height), u(e8.x + e8.width * 2, e8.y + e8.height * 2)), A2(u(e8.x + e8.width * 2, e8.y - e8.height), u(e8.x - e8.width, e8.y + e8.height * 2))];
  return [pn(s3, c3[0]), pn(s3, c3[1])].filter((p) => p !== null).sort((p, m) => Xn(p, n3) - Xn(m, n3)).map((p, m) => a3 * ie2(r, p) / (e8.type === "diamond" ? ie2(d[m][0], d[m][1]) / 2 : Math.sqrt(e8.width ** 2 + e8.height ** 2) / 2)).sort((p, m) => Math.abs(p) - Math.abs(m))[0] ?? 0;
};
var gb = (e8, t3, n3) => {
  let r = u(e8.x + e8.width / 2, e8.y + e8.height / 2);
  if (t3 === 0) return r;
  let o3 = (e8.type === "diamond" ? [u(e8.x, e8.y + e8.height / 2), u(e8.x + e8.width / 2, e8.y), u(e8.x + e8.width, e8.y + e8.height / 2), u(e8.x + e8.width / 2, e8.y + e8.height)] : [u(e8.x, e8.y), u(e8.x + e8.width, e8.y), u(e8.x + e8.width, e8.y + e8.height), u(e8.x, e8.y + e8.height)]).map((s3) => q(ue2(O(s3, r), Math.abs(t3)), r)).map((s3) => T(s3, r, e8.angle)), i3 = [Me(O(n3, o3[0]), O(o3[1], o3[0])) > 0 && (t3 > 0 ? Me(O(n3, o3[1]), O(o3[2], o3[1])) < 0 : Me(O(n3, o3[3]), O(o3[0], o3[3])) < 0), Me(O(n3, o3[1]), O(o3[2], o3[1])) > 0 && (t3 > 0 ? Me(O(n3, o3[2]), O(o3[3], o3[2])) < 0 : Me(O(n3, o3[0]), O(o3[1], o3[0])) < 0), Me(O(n3, o3[2]), O(o3[3], o3[2])) > 0 && (t3 > 0 ? Me(O(n3, o3[3]), O(o3[0], o3[3])) < 0 : Me(O(n3, o3[1]), O(o3[2], o3[1])) < 0), Me(O(n3, o3[3]), O(o3[0], o3[3])) > 0 && (t3 > 0 ? Me(O(n3, o3[0]), O(o3[1], o3[0])) < 0 : Me(O(n3, o3[2]), O(o3[3], o3[2])) < 0)];
  return i3[0] ? t3 > 0 ? o3[1] : o3[0] : i3[1] ? t3 > 0 ? o3[2] : o3[1] : i3[2] ? t3 > 0 ? o3[3] : o3[2] : t3 > 0 ? o3[0] : o3[3];
};
var l2 = /* @__PURE__ */ new Set(["boundElements", "frameId", "containerId", "startBinding", "endBinding"]);
var ci = (e8, t3, n3) => {
  xt(t3) && (t3.boundElements?.slice() ?? []).forEach(({ id: o3 }) => {
    n3(e8.get(o3), "boundElements", o3);
  });
};
var li = (e8, t3, n3) => {
  let r = [];
  if (t3.frameId) {
    let o3 = t3.frameId;
    r.push(n3(e8.get(o3), "frameId", o3));
  }
  if (Ne(t3)) {
    let o3 = t3.containerId;
    r.push(n3(e8.get(o3), "containerId", o3));
  }
  if (ee2(t3)) {
    if (t3.startBinding) {
      let o3 = t3.startBinding.elementId;
      r.push(n3(e8.get(o3), "startBinding", o3));
    }
    if (t3.endBinding) {
      let o3 = t3.endBinding.elementId;
      r.push(n3(e8.get(o3), "endBinding", o3));
    }
  }
  return r;
};
var rn = class {
  static unbindAffected(t3, n3, r) {
    n3 && li(t3, n3, (o3) => {
      !o3 || o3.isDeleted || ci(t3, o3, (i3, a3, s3) => {
        s3 === n3.id && r(o3, { boundElements: Jr(o3.boundElements, /* @__PURE__ */ new Set([s3])) });
      });
    });
  }
};
i(rn, "rebindAffected", (t3, n3, r) => {
  !n3 || n3.isDeleted || li(t3, n3, (o3, i3) => {
    if (!o3 || o3.isDeleted) {
      r(n3, { [i3]: null });
      return;
    }
    i3 !== "frameId" && (o3.boundElements?.find((a3) => a3.id === n3.id) || (ee2(n3) && r(o3, { boundElements: Jr(o3.boundElements, /* @__PURE__ */ new Set(), new Array(n3)) }), k(n3) && (o3.boundElements?.find((a3) => a3.type === "text") ? r(n3, { [i3]: null }) : r(o3, { boundElements: Jr(o3.boundElements, /* @__PURE__ */ new Set(), new Array(n3)) }))));
  });
});
var on = class {
  static unbindAffected(t3, n3, r) {
    n3 && ci(t3, n3, (o3) => {
      !o3 || o3.isDeleted || li(t3, o3, (i3, a3, s3) => {
        s3 === n3.id && r(o3, { [a3]: null });
      });
    });
  }
};
i(on, "rebindAffected", (t3, n3, r) => {
  !n3 || n3.isDeleted || ci(t3, n3, (o3, i3, a3) => {
    if (!o3 || o3.isDeleted) {
      r(n3, { boundElements: Jr(n3.boundElements, /* @__PURE__ */ new Set([a3])) });
      return;
    }
    k(o3) && ((n3.boundElements?.slice() ?? []).reverse().find((d) => d.type === "text")?.id === o3.id ? o3.containerId !== n3.id && r(o3, { containerId: n3.id }) : (o3.containerId !== null && r(o3, { containerId: null }), r(n3, { boundElements: Jr(n3.boundElements, /* @__PURE__ */ new Set([o3.id])) })));
  });
});
var Ui = (e8, t3) => {
  let [n3, r] = Yr(e8);
  return T(u(t3.x + t3.width * n3, t3.y + t3.height * r), u(t3.x + t3.width / 2, t3.y + t3.height / 2), t3.angle);
};
var xb = (e8, t3) => {
  let n3 = e8.startBinding && t3.get(e8.startBinding.elementId), r = e8.endBinding && t3.get(e8.endBinding.elementId), o3 = n3 && e8.startBinding ? Ui(e8.startBinding.fixedPoint, n3) : u(e8.x + e8.points[0][0], e8.y + e8.points[0][1]), i3 = r && e8.endBinding ? Ui(e8.endBinding.fixedPoint, r) : u(e8.x + e8.points[e8.points.length - 1][0], e8.y + e8.points[e8.points.length - 1][1]);
  return [o3, i3];
};
var U2 = (e8, t3) => {
  let [n3, r] = xb(e8, t3);
  return [z.pointFromAbsoluteCoords(e8, n3, t3), z.pointFromAbsoluteCoords(e8, r, t3)];
};
var Yr = (e8) => e8 && (Math.abs(e8[0] - 0.5) < 1e-4 || Math.abs(e8[1] - 0.5) < 1e-4) ? e8.map((t3) => Math.abs(t3 - 0.5) < 1e-4 ? 0.5001 : t3) : e8;
var hb = (e8, t3) => {
  let [n3, r, o3, i3] = t3, { x: a3, y: s3 } = ta({ sceneX: n3, sceneY: r }, e8), { x: d, y: c3 } = ta({ sceneX: o3, sceneY: i3 }, e8);
  return d - a3 > e8.width || c3 - s3 > e8.height;
};
var yb = ({ scenePoint: e8, viewportDimensions: t3, zoom: n3, offsets: r }) => {
  let o3 = (t3.width - (r?.right ?? 0)) / 2 / n3.value - e8.x;
  o3 += (r?.left ?? 0) / 2 / n3.value;
  let i3 = (t3.height - (r?.bottom ?? 0)) / 2 / n3.value - e8.y;
  return i3 += (r?.top ?? 0) / 2 / n3.value, { scrollX: o3, scrollY: i3 };
};
var _a = (e8, t3) => {
  if (e8 = f2(e8), !e8.length) return { scrollX: 0, scrollY: 0 };
  let [n3, r, o3, i3] = $e(e8);
  hb(t3, [n3, r, o3, i3]) && ([n3, r, o3, i3] = Pa(e8, Dn({ clientX: t3.scrollX, clientY: t3.scrollY }, t3)));
  let a3 = (n3 + o3) / 2, s3 = (r + i3) / 2;
  return yb({ scenePoint: { x: a3, y: s3 }, viewportDimensions: { width: t3.width, height: t3.height }, zoom: t3.zoom });
};
var Oa = (e8) => se2(To(e8, 6), Js, Ys);
var Aa = (e8) => se2(Math.round(e8), 1, 100);
var Ka = (e8) => se2(Math.round(e8), 1, 100);
var Tb = (e8, t3, n3) => {
  let r = n3.reduce((o3, i3) => (i3.groupIds.includes(e8) && (o3[i3.id] = true), o3), {});
  return Object.keys(r).length < 2 ? t3.selectedGroupIds[e8] || t3.editingGroupId === e8 ? { selectedElementIds: t3.selectedElementIds, selectedGroupIds: { ...t3.selectedGroupIds, [e8]: false }, editingGroupId: null } : t3 : { editingGroupId: t3.editingGroupId, selectedGroupIds: { ...t3.selectedGroupIds, [e8]: true }, selectedElementIds: { ...t3.selectedElementIds, ...r } };
};
var aF = function() {
  let e8 = null, t3 = null, n3 = null, r = (i3, a3, s3, d) => {
    if (n3 !== void 0 && a3 === t3 && i3 === e8 && s3.editingGroupId === n3?.editingGroupId) return n3;
    let c3 = {};
    for (let p of i3) {
      let m = p.groupIds;
      if (s3.editingGroupId) {
        let b3 = m.indexOf(s3.editingGroupId);
        b3 > -1 && (m = m.slice(0, b3));
      }
      if (m.length > 0) {
        let b3 = m[m.length - 1];
        c3[b3] = true;
      }
    }
    let l3 = {}, U = a3.reduce((p, m) => {
      if (m.isDeleted) return p;
      let b3 = m.groupIds.find((E) => c3[E]);
      return b3 && (p[m.id] = true, Array.isArray(l3[b3]) ? l3[b3].push(m.id) : l3[b3] = [m.id]), p;
    }, {});
    for (let p of Object.keys(l3)) l3[p].length < 2 && c3[p] && (c3[p] = false);
    return t3 = a3, e8 = i3, n3 = { editingGroupId: s3.editingGroupId, selectedGroupIds: c3, selectedElementIds: Ha({ ...s3.selectedElementIds, ...U }, d) }, n3;
  }, o3 = (i3, a3, s3, d) => {
    let c3 = d ? d.scene.getSelectedElements({ selectedElementIds: i3.selectedElementIds, elements: a3 }) : at(a3, i3);
    return c3.length ? r(c3, a3, i3, s3) : { selectedGroupIds: {}, editingGroupId: null, selectedElementIds: Ha(i3.selectedElementIds, s3) };
  };
  return o3.clearCache = () => {
    t3 = null, e8 = null, n3 = null;
  }, o3;
}();
var sF = (e8, t3) => Mb(e8, t3) != null;
var Mb = (e8, t3) => t3.groupIds.filter((n3) => n3 !== e8.editingGroupId).find((n3) => e8.selectedGroupIds[n3]);
var dF = (e8) => Object.entries(e8.selectedGroupIds).filter(([t3, n3]) => n3).map(([t3, n3]) => t3);
var p2 = (e8, t3) => {
  let n3 = { ...t3, selectedGroupIds: {} };
  for (let r of e8) {
    let o3 = r.groupIds;
    if (t3.editingGroupId) {
      let i3 = o3.indexOf(t3.editingGroupId);
      i3 > -1 && (o3 = o3.slice(0, i3));
    }
    if (o3.length > 0) {
      let i3 = o3[o3.length - 1];
      n3 = { ...n3, ...Tb(i3, n3, e8) };
    }
  }
  return n3.selectedGroupIds;
};
var cF = (e8, t3) => ({ ...e8, editingGroupId: t3.groupIds.length ? t3.groupIds[0] : null, selectedGroupIds: {}, selectedElementIds: { [t3.id]: true } });
var Lb = (e8, t3) => e8.groupIds.includes(t3);
var an = (e8, t3) => {
  let n3 = [];
  for (let r of e8.values()) Lb(r, t3) && n3.push(r);
  return n3;
};
var lF = (e8, t3) => e8.groupIds.find((n3) => t3[n3]);
var u2 = (e8, t3, n3) => {
  let r = [...e8], o3 = t3 ? e8.indexOf(t3) : -1, i3 = o3 > -1 ? o3 : e8.length;
  for (let a3 = 0; a3 < i3; a3++) r[a3] = n3(r[a3]);
  return r;
};
var UF = (e8, t3, n3) => {
  let r = [...e8], o3 = n3 ? r.indexOf(n3) : -1, i3 = o3 > -1 ? o3 : r.length;
  return r.splice(i3, 0, t3), r;
};
var fF = (e8, t3) => e8.filter((n3) => !t3[n3]);
var Ja = (e8, t3) => {
  let n3 = /* @__PURE__ */ new Map();
  return e8.forEach((r) => {
    let o3 = r.groupIds.length === 0 ? r.id : r.groupIds[r.groupIds.length - 1], i3 = n3.get(o3) || [], a3 = oe(r, t3);
    a3 && i3.push(a3), n3.set(o3, [...i3, r]);
  }), Array.from(n3.values());
};
var m2 = (e8) => {
  let t3 = /* @__PURE__ */ new Set();
  for (let [, n3] of e8) if (!n3.isDeleted) for (let r of n3.groupIds ?? []) t3.add(r);
  return t3;
};
var b2 = (e8) => {
  let t3 = e8.flatMap((o3) => o3.groupIds), n3 = /* @__PURE__ */ new Map(), r = 0;
  for (let o3 of t3) n3.set(o3, (n3.get(o3) ?? 0) + 1), n3.get(o3) > r && (r = n3.get(o3));
  return r === e8.length;
};
var E2 = (e8) => e8.groupIds.length > 0;
var Db = 8;
var g2 = 99999;
var bi = (e8) => Db / e8;
var Qe = class Qe2 {
};
i(Qe, "referenceSnapPoints", null), i(Qe, "visibleGaps", null), i(Qe, "setReferenceSnapPoints", (t3) => {
  Qe.referenceSnapPoints = t3;
}), i(Qe, "getReferenceSnapPoints", () => Qe.referenceSnapPoints), i(Qe, "setVisibleGaps", (t3) => {
  Qe.visibleGaps = t3;
}), i(Qe, "getVisibleGaps", () => Qe.visibleGaps), i(Qe, "destroy", () => {
  Qe.referenceSnapPoints = null, Qe.visibleGaps = null;
});
var mi = Qe;
var Sb = (e8) => e8.props.gridModeEnabled ?? e8.state.gridModeEnabled;
var sr = ({ event: e8, app: t3, selectedElements: n3 }) => e8 ? t3.state.objectsSnapModeEnabled && !e8[Q.CTRL_OR_CMD] || !t3.state.objectsSnapModeEnabled && e8[Q.CTRL_OR_CMD] && !Sb(t3) : n3.length === 1 && n3[0].type === "arrow" ? false : t3.state.objectsSnapModeEnabled;
var vb = (e8, t3, n3 = 0.01) => Math.abs(e8 - t3) <= n3;
var Cr = (e8, t3, { omitCenter: n3, boundingBoxCorners: r, dragOffset: o3 } = { omitCenter: false, boundingBoxCorners: false }) => {
  let i3 = [];
  if (e8.length === 1) {
    let a3 = e8[0], [s3, d, c3, l3, U, p] = C2(a3, t3);
    o3 && (s3 += o3.x, c3 += o3.x, U += o3.x, d += o3.y, l3 += o3.y, p += o3.y);
    let m = (c3 - s3) / 2, b3 = (l3 - d) / 2;
    if ((a3.type === "diamond" || a3.type === "ellipse") && !r) {
      let E = T(u(s3, d + b3), u(U, p), a3.angle), g = T(u(s3 + m, d), u(U, p), a3.angle), h = T(u(c3, d + b3), u(U, p), a3.angle), x = T(u(s3 + m, l3), u(U, p), a3.angle), y = u(U, p);
      i3 = n3 ? [E, g, h, x] : [E, g, h, x, y];
    } else {
      let E = T(u(s3, d), u(U, p), a3.angle), g = T(u(c3, d), u(U, p), a3.angle), h = T(u(s3, l3), u(U, p), a3.angle), x = T(u(c3, l3), u(U, p), a3.angle), y = u(U, p);
      i3 = n3 ? [E, g, h, x] : [E, g, h, x, y];
    }
  } else if (e8.length > 1) {
    let [a3, s3, d, c3] = ai(e8, o3 ?? { x: 0, y: 0 }), l3 = d - a3, U = c3 - s3, p = u(a3, s3), m = u(d, s3), b3 = u(a3, c3), E = u(d, c3), g = u(a3 + l3 / 2, s3 + U / 2);
    i3 = n3 ? [p, m, b3, E] : [p, m, b3, E, g];
  }
  return i3.map((a3) => u(Te(a3[0]), Te(a3[1])));
};
var y2 = (e8, t3, n3, r) => {
  let o3 = t3.filter((i3) => de2(i3)).map((i3) => i3.id);
  return Ca(e8, t3, n3, r).filter((i3) => !(i3.frameId && o3.includes(i3.frameId)));
};
var IF = (e8, t3, n3, r) => {
  let o3 = y2(e8, t3, n3, r), i3 = Ja(o3, r).filter((U) => !(U.length === 1 && Ne(U[0]))).map((U) => $e(U).map((p) => Te(p))), a3 = i3.sort((U, p) => U[0] - p[0]), s3 = [], d = 0;
  e: for (let U = 0; U < a3.length; U++) {
    let p = a3[U];
    for (let m = U + 1; m < a3.length; m++) {
      if (++d > g2) break e;
      let b3 = a3[m], [, E, g, h] = p, [x, y, , w] = b3;
      g < x && Lr(Oe(E, h), Oe(y, w)) && s3.push({ startBounds: p, endBounds: b3, startSide: [u(g, E), u(g, h)], endSide: [u(x, y), u(x, w)], length: x - g, overlap: Dr(Oe(E, h), Oe(y, w)) });
    }
  }
  let c3 = i3.sort((U, p) => U[1] - p[1]), l3 = [];
  d = 0;
  e: for (let U = 0; U < c3.length; U++) {
    let p = c3[U];
    for (let m = U + 1; m < c3.length; m++) {
      if (++d > g2) break e;
      let b3 = c3[m], [E, , g, h] = p, [x, y, w] = b3;
      h < y && Lr(Oe(E, g), Oe(x, w)) && l3.push({ startBounds: p, endBounds: b3, startSide: [u(E, h), u(g, h)], endSide: [u(x, y), u(w, y)], length: y - h, overlap: Dr(Oe(E, g), Oe(x, w)) });
    }
  }
  return { horizontalGaps: s3, verticalGaps: l3 };
};
var x2 = (e8, t3, n3, r, o3, i3, a3) => {
  if (!sr({ app: n3, event: r, selectedElements: e8 })) return [];
  if (e8.length === 0) return [];
  let s3 = mi.getVisibleGaps();
  if (s3) {
    let { horizontalGaps: d, verticalGaps: c3 } = s3, [l3, U, p, m] = ai(e8, t3).map((g) => Te(g)), b3 = (l3 + p) / 2, E = (U + m) / 2;
    for (let g of d) {
      if (!Lr(Oe(U, m), g.overlap)) continue;
      let h = g.startSide[0][0] + g.length / 2, x = Te(h - b3);
      if (g.length > p - l3 && Math.abs(x) <= a3.x) {
        Math.abs(x) < a3.x && (o3.length = 0), a3.x = Math.abs(x);
        let N = { type: "gap", direction: "center_horizontal", gap: g, offset: x };
        o3.push(N);
        continue;
      }
      let [, , w] = g.endBounds, I = l3 - w, S = Te(g.length - I);
      if (Math.abs(S) <= a3.x) {
        Math.abs(S) < a3.x && (o3.length = 0), a3.x = Math.abs(S);
        let N = { type: "gap", direction: "side_right", gap: g, offset: S };
        o3.push(N);
        continue;
      }
      let [v, , ,] = g.startBounds, D = v - p, $3 = Te(D - g.length);
      if (Math.abs($3) <= a3.x) {
        Math.abs($3) < a3.x && (o3.length = 0), a3.x = Math.abs($3);
        let N = { type: "gap", direction: "side_left", gap: g, offset: $3 };
        o3.push(N);
        continue;
      }
    }
    for (let g of c3) {
      if (!Lr(Oe(l3, p), g.overlap)) continue;
      let h = g.startSide[0][1] + g.length / 2, x = Te(h - E);
      if (g.length > m - U && Math.abs(x) <= a3.y) {
        Math.abs(x) < a3.y && (i3.length = 0), a3.y = Math.abs(x);
        let N = { type: "gap", direction: "center_vertical", gap: g, offset: x };
        i3.push(N);
        continue;
      }
      let [, w, ,] = g.startBounds, I = w - m, S = Te(I - g.length);
      if (Math.abs(S) <= a3.y) {
        Math.abs(S) < a3.y && (i3.length = 0), a3.y = Math.abs(S);
        let N = { type: "gap", direction: "side_top", gap: g, offset: S };
        i3.push(N);
        continue;
      }
      let [, , , v] = g.endBounds, D = Te(U - v), $3 = g.length - D;
      if (Math.abs($3) <= a3.y) {
        Math.abs($3) < a3.y && (i3.length = 0), a3.y = Math.abs($3);
        let N = { type: "gap", direction: "side_bottom", gap: g, offset: $3 };
        i3.push(N);
        continue;
      }
    }
  }
};
var wF = (e8, t3, n3, r) => {
  let o3 = y2(e8, t3, n3, r);
  return Ja(o3, r).filter((i3) => !(i3.length === 1 && Ne(i3[0]))).flatMap((i3) => Cr(i3, r));
};
var ar = (e8, t3, n3, r, o3, i3, a3) => {
  if (!sr({ app: n3, event: r, selectedElements: e8 }) || e8.length === 0 && t3.length === 0) return [];
  let s3 = mi.getReferenceSnapPoints();
  if (s3) for (let d of t3) for (let c3 of s3) {
    let l3 = c3[0] - d[0], U = c3[1] - d[1];
    Math.abs(l3) <= a3.x && (Math.abs(l3) < a3.x && (o3.length = 0), o3.push({ type: "point", points: [d, c3], offset: l3 }), a3.x = Math.abs(l3)), Math.abs(U) <= a3.y && (Math.abs(U) < a3.y && (i3.length = 0), i3.push({ type: "point", points: [d, c3], offset: U }), a3.y = Math.abs(U));
  }
};
var RF = (e8, t3, n3, r, o3) => {
  let i3 = n3.state, a3 = at(e8, i3);
  if (!sr({ app: n3, event: r, selectedElements: a3 }) || a3.length === 0) return { snapOffset: { x: 0, y: 0 }, snapLines: [] };
  t3.x = Te(t3.x), t3.y = Te(t3.y);
  let s3 = [], d = [], c3 = bi(i3.zoom.value), l3 = { x: c3, y: c3 }, U = Cr(a3, o3, { dragOffset: t3 });
  ar(a3, U, n3, r, s3, d, l3), x2(a3, t3, n3, r, s3, d, l3);
  let p = { x: s3[0]?.offset ?? 0, y: d[0]?.offset ?? 0 };
  l3.x = 0, l3.y = 0, s3.length = 0, d.length = 0;
  let m = { x: Te(t3.x + p.x), y: Te(t3.y + p.y) };
  ar(a3, Cr(a3, o3, { dragOffset: m }), n3, r, s3, d, l3), x2(a3, m, n3, r, s3, d, l3);
  let b3 = Ya(s3, d), E = Pb(a3, m, [...s3, ...d].filter((g) => g.type === "gap"));
  return { snapOffset: p, snapLines: [...b3, ...E] };
};
var Te = (e8) => Math.round(e8 * 10 ** 6) / 10 ** 6;
var h2 = (e8) => {
  let t3 = /* @__PURE__ */ new Map();
  for (let n3 of e8) {
    let r = n3.join(",");
    t3.has(r) || t3.set(r, n3);
  }
  return Array.from(t3.values());
};
var Ya = (e8, t3) => {
  let n3 = {}, r = {};
  if (e8.length > 0) {
    for (let o3 of e8) if (o3.type === "point") {
      let i3 = Te(o3.points[0][0]);
      n3[i3] || (n3[i3] = []), n3[i3].push(...o3.points.map((a3) => u(Te(a3[0]), Te(a3[1]))));
    }
  }
  if (t3.length > 0) {
    for (let o3 of t3) if (o3.type === "point") {
      let i3 = Te(o3.points[0][1]);
      r[i3] || (r[i3] = []), r[i3].push(...o3.points.map((a3) => u(Te(a3[0]), Te(a3[1]))));
    }
  }
  return Object.entries(n3).map(([o3, i3]) => ({ type: "points", points: h2(i3.map((a3) => u(Number(o3), a3[1])).sort((a3, s3) => a3[1] - s3[1])) })).concat(Object.entries(r).map(([o3, i3]) => ({ type: "points", points: h2(i3.map((a3) => u(a3[0], Number(o3))).sort((a3, s3) => a3[0] - s3[0])) })));
};
var $b = (e8) => {
  let t3 = /* @__PURE__ */ new Map();
  for (let n3 of e8) {
    let r = n3.points.flat().map((o3) => [Te(o3)]).join(",");
    t3.has(r) || t3.set(r, n3);
  }
  return Array.from(t3.values());
};
var Pb = (e8, t3, n3) => {
  let [r, o3, i3, a3] = ai(e8, t3), s3 = [];
  for (let d of n3) {
    let [c3, l3, U, p] = d.gap.startBounds, [m, b3, E, g] = d.gap.endBounds, h = Dr(Oe(o3, a3), d.gap.overlap), x = Dr(Oe(r, i3), d.gap.overlap);
    switch (d.direction) {
      case "center_horizontal": {
        if (h) {
          let y = (h[0] + h[1]) / 2;
          s3.push({ type: "gap", direction: "horizontal", points: [u(d.gap.startSide[0][0], y), u(r, y)] }, { type: "gap", direction: "horizontal", points: [u(i3, y), u(d.gap.endSide[0][0], y)] });
        }
        break;
      }
      case "center_vertical": {
        if (x) {
          let y = (x[0] + x[1]) / 2;
          s3.push({ type: "gap", direction: "vertical", points: [u(y, d.gap.startSide[0][1]), u(y, o3)] }, { type: "gap", direction: "vertical", points: [u(y, a3), u(y, d.gap.endSide[0][1])] });
        }
        break;
      }
      case "side_right": {
        if (h) {
          let y = (h[0] + h[1]) / 2;
          s3.push({ type: "gap", direction: "horizontal", points: [u(U, y), u(m, y)] }, { type: "gap", direction: "horizontal", points: [u(E, y), u(r, y)] });
        }
        break;
      }
      case "side_left": {
        if (h) {
          let y = (h[0] + h[1]) / 2;
          s3.push({ type: "gap", direction: "horizontal", points: [u(i3, y), u(c3, y)] }, { type: "gap", direction: "horizontal", points: [u(U, y), u(m, y)] });
        }
        break;
      }
      case "side_top": {
        if (x) {
          let y = (x[0] + x[1]) / 2;
          s3.push({ type: "gap", direction: "vertical", points: [u(y, a3), u(y, l3)] }, { type: "gap", direction: "vertical", points: [u(y, p), u(y, b3)] });
        }
        break;
      }
      case "side_bottom": {
        if (x) {
          let y = (x[0] + x[1]) / 2;
          s3.push({ type: "gap", direction: "vertical", points: [u(y, p), u(y, b3)] }, { type: "gap", direction: "vertical", points: [u(y, g), u(y, o3)] });
        }
        break;
      }
    }
  }
  return $b(s3.map((d) => ({ ...d, points: d.points.map((c3) => u(Te(c3[0]), Te(c3[1]))) })));
};
var TF = (e8, t3, n3, r, o3, i3) => {
  if (!sr({ event: r, selectedElements: e8, app: n3 }) || e8.length === 0 || e8.length === 1 && !vb(e8[0].angle, 0)) return { snapOffset: { x: 0, y: 0 }, snapLines: [] };
  let [a3, s3, d, c3] = $e(t3);
  i3 && (i3.includes("e") ? d += o3.x : i3.includes("w") && (a3 += o3.x), i3.includes("n") ? s3 += o3.y : i3.includes("s") && (c3 += o3.y));
  let l3 = [];
  if (i3) switch (i3) {
    case "e": {
      l3.push(u(d, s3), u(d, c3));
      break;
    }
    case "w": {
      l3.push(u(a3, s3), u(a3, c3));
      break;
    }
    case "n": {
      l3.push(u(a3, s3), u(d, s3));
      break;
    }
    case "s": {
      l3.push(u(a3, c3), u(d, c3));
      break;
    }
    case "ne": {
      l3.push(u(d, s3));
      break;
    }
    case "nw": {
      l3.push(u(a3, s3));
      break;
    }
    case "se": {
      l3.push(u(d, c3));
      break;
    }
    case "sw": {
      l3.push(u(a3, c3));
      break;
    }
  }
  let U = bi(n3.state.zoom.value), p = { x: U, y: U }, m = [], b3 = [];
  ar(t3, l3, n3, r, m, b3, p);
  let E = { x: m[0]?.offset ?? 0, y: b3[0]?.offset ?? 0 };
  p.x = 0, p.y = 0, m.length = 0, b3.length = 0;
  let [g, h, x, y] = $e(e8).map((S) => Te(S)), w = [u(g, h), u(g, y), u(x, h), u(x, y)];
  ar(e8, w, n3, r, m, b3, p);
  let I = Ya(m, b3);
  return { snapOffset: E, snapLines: I };
};
var MF = (e8, t3, n3, r, o3, i3) => {
  if (!sr({ event: n3, selectedElements: [e8], app: t3 })) return { snapOffset: { x: 0, y: 0 }, snapLines: [] };
  let a3 = [u(r.x + o3.x, r.y + o3.y)], s3 = bi(t3.state.zoom.value), d = { x: s3, y: s3 }, c3 = [], l3 = [];
  ar([e8], a3, t3, n3, c3, l3, d);
  let U = { x: c3[0]?.offset ?? 0, y: l3[0]?.offset ?? 0 };
  d.x = 0, d.y = 0, c3.length = 0, l3.length = 0;
  let p = Cr([e8], i3, { boundingBoxCorners: true, omitCenter: true });
  ar([e8], p, t3, n3, c3, l3, d);
  let m = Ya(c3, l3);
  return { snapOffset: U, snapLines: m };
};
var LF = (e8, t3, n3, r, o3) => {
  if (!sr({ event: r, selectedElements: [], app: t3 })) return { originOffset: { x: 0, y: 0 }, snapLines: [] };
  let i3 = Ca(e8, [], t3.state, o3), a3 = bi(t3.state.zoom.value), s3 = { x: a3, y: a3 }, d = [], c3 = [];
  for (let l3 of i3) {
    let U = Cr([l3], o3);
    for (let p of U) {
      let m = p[0] - n3.x;
      Math.abs(m) <= Math.abs(s3.x) && (Math.abs(m) < Math.abs(s3.x) && (c3.length = 0), c3.push({ type: "pointer", points: [p, u(p[0], n3.y)], direction: "vertical" }), s3.x = m);
      let b3 = p[1] - n3.y;
      Math.abs(b3) <= Math.abs(s3.y) && (Math.abs(b3) < Math.abs(s3.y) && (d.length = 0), d.push({ type: "pointer", points: [p, u(n3.x, p[1])], direction: "horizontal" }), s3.y = b3);
    }
  }
  return { originOffset: { x: c3.length > 0 ? c3[0].points[0][0] - n3.x : 0, y: d.length > 0 ? d[0].points[0][1] - n3.y : 0 }, snapLines: [...c3, ...d] };
};
var DF = (e8) => e8 === fn.rectangle || e8 === fn.ellipse || e8 === fn.diamond || e8 === fn.frame || e8 === fn.magicframe || e8 === fn.image || e8 === fn.text;
var Vr = (e8, t3, n3) => n3 ? [Math.round(e8 / n3) * n3, Math.round(t3 / n3) * n3] : [e8, t3];
var sn = { version: null, points: [], zoom: null };
var K2 = class K3 {
  constructor(t3) {
    i(this, "elementId");
    i(this, "selectedPointsIndices");
    i(this, "pointerDownState");
    i(this, "isDragging");
    i(this, "lastUncommittedPoint");
    i(this, "pointerOffset");
    i(this, "startBindingElement");
    i(this, "endBindingElement");
    i(this, "hoverPointIndex");
    i(this, "segmentMidPointHoveredCoords");
    i(this, "elbowed");
    this.elementId = t3.id, _e(t3.points[0], u(0, 0)) || console.error("Linear element is not normalized", Error().stack), this.selectedPointsIndices = null, this.lastUncommittedPoint = null, this.isDragging = false, this.pointerOffset = { x: 0, y: 0 }, this.startBindingElement = "keep", this.endBindingElement = "keep", this.pointerDownState = { prevSelectedPointsIndices: null, lastClickedPoint: -1, lastClickedIsEndPoint: false, origin: null, segmentMidpoint: { value: null, index: null, added: false } }, this.hoverPointIndex = -1, this.segmentMidPointHoveredCoords = null, this.elbowed = X(t3) && t3.elbowed;
  }
  static getElement(t3, n3) {
    let r = n3.get(t3);
    return r || null;
  }
  static handleBoxSelection(t3, n3, r, o3) {
    if (!n3.editingLinearElement || !n3.selectionElement) return false;
    let { editingLinearElement: i3 } = n3, { selectedPointsIndices: a3, elementId: s3 } = i3, d = K3.getElement(s3, o3);
    if (!d) return false;
    let [c3, l3, U, p] = C2(n3.selectionElement, o3), b3 = K3.getPointsGlobalCoordinates(d, o3).reduce((E, g, h) => ((g[0] >= c3 && g[0] <= U && g[1] >= l3 && g[1] <= p || t3.shiftKey && a3?.includes(h)) && E.push(h), E), []).filter((E) => !(X(d) && E !== 0 && E !== d.points.length - 1));
    r({ editingLinearElement: { ...i3, selectedPointsIndices: b3.length ? b3 : null } });
  }
  static handlePointDragging(t3, n3, r, o3, i3, a3, s3) {
    if (!a3) return false;
    let { elementId: d } = a3, c3 = s3.getNonDeletedElementsMap(), l3 = K3.getElement(d, c3);
    if (!l3 || X(l3) && !a3.pointerDownState.lastClickedIsEndPoint && a3.pointerDownState.lastClickedPoint !== 0) return false;
    let U = X(l3) ? a3.selectedPointsIndices?.reduce((b3, E) => E === 0 ? [0, b3[1]] : [b3[0], l3.points.length - 1], [false, false]).filter((b3) => typeof b3 == "number") : a3.selectedPointsIndices, p = X(l3) ? a3.pointerDownState.lastClickedPoint > 0 ? l3.points.length - 1 : 0 : a3.pointerDownState.lastClickedPoint, m = l3.points[p];
    if (U && m) {
      if (ga(t3) && U.length === 1 && l3.points.length > 1) {
        let E = U[0], g = l3.points[E === 0 ? 1 : E - 1], [h, x] = K3._getShiftLockedDelta(l3, c3, g, u(r, o3), t3[Q.CTRL_OR_CMD] ? null : n3.getEffectiveGridSize());
        K3.movePoints(l3, [{ index: E, point: u(h + g[0], x + g[1]), isDragging: E === p }]);
      } else {
        let E = K3.createPointAt(l3, c3, r - a3.pointerOffset.x, o3 - a3.pointerOffset.y, t3[Q.CTRL_OR_CMD] ? null : n3.getEffectiveGridSize()), g = E[0] - m[0], h = E[1] - m[1];
        K3.movePoints(l3, U.map((x) => {
          let y = x === p ? K3.createPointAt(l3, c3, r - a3.pointerOffset.x, o3 - a3.pointerOffset.y, t3[Q.CTRL_OR_CMD] ? null : n3.getEffectiveGridSize()) : u(l3.points[x][0] + g, l3.points[x][1] + h);
          return { index: x, point: y, isDragging: x === p };
        }));
      }
      if (oe(l3, c3) && _n(l3, c3, false), Pr(l3, false)) {
        let E = [];
        U[0] === 0 && E.push(un(K3.getPointGlobalCoordinates(l3, l3.points[0], c3)));
        let h = U[U.length - 1];
        h === l3.points.length - 1 && E.push(un(K3.getPointGlobalCoordinates(l3, l3.points[h], c3))), E.length && i3(l3, E);
      }
      return true;
    }
    return false;
  }
  static handlePointerUp(t3, n3, r, o3) {
    let i3 = o3.getNonDeletedElementsMap(), a3 = o3.getNonDeletedElements(), { elementId: s3, selectedPointsIndices: d, isDragging: c3, pointerDownState: l3 } = n3, U = K3.getElement(s3, i3);
    if (!U) return n3;
    let p = {};
    if (c3 && d) {
      for (let m of d) if (m === 0 || m === U.points.length - 1) {
        Kt(U.points, r.zoom.value) && K3.movePoints(U, [{ index: m, point: m === 0 ? U.points[U.points.length - 1] : U.points[0] }]);
        let b3 = Fa(r) ? Bn(un(K3.getPointAtIndexGlobalCoordinates(U, m, i3)), a3, i3, r.zoom, X(U), X(U)) : null;
        p[m === 0 ? "startBindingElement" : "endBindingElement"] = b3;
      }
    }
    return { ...n3, ...p, selectedPointsIndices: c3 || t3.shiftKey ? !c3 && t3.shiftKey && l3.prevSelectedPointsIndices?.includes(l3.lastClickedPoint) ? d && d.filter((m) => m !== l3.lastClickedPoint) : d : d?.includes(l3.lastClickedPoint) ? [l3.lastClickedPoint] : d, isDragging: false, pointerOffset: { x: 0, y: 0 } };
  }
  static isSegmentTooShort(t3, n3, r, o3, i3) {
    if (X(t3)) return o3 >= 0 && o3 < t3.points.length ? ie2(n3, r) * i3.value < K3.POINT_HANDLE_SIZE / 2 : false;
    let a3 = ie2(n3, r);
    return t3.points.length > 2 && t3.roundness && (a3 = $1(t3, r)), a3 * i3.value < K3.POINT_HANDLE_SIZE * 4;
  }
  static getSegmentMidPoint(t3, n3, r, o3, i3) {
    let a3 = Zt(n3, r);
    if (t3.points.length > 2 && t3.roundness) {
      let s3 = xa(t3, t3.points[o3]);
      if (s3) {
        let d = P1(t3, t3.points[o3], 0.5);
        a3 = K3.getPointGlobalCoordinates(t3, ha(s3[0], s3[1], s3[2], s3[3], d), i3);
      }
    }
    return a3;
  }
  static getSegmentMidPointIndex(t3, n3, r, o3) {
    let i3 = K3.getElement(t3.elementId, o3);
    if (!i3) return -1;
    let a3 = K3.getEditorMidPoints(i3, o3, n3), s3 = 0;
    for (; s3 < a3.length; ) {
      if (K3.arePointsEqual(r, a3[s3])) return s3 + 1;
      s3++;
    }
    return -1;
  }
  static handlePointerDown(t3, n3, r, o3, i3, a3) {
    let s3 = n3.state, d = a3.getNonDeletedElementsMap(), c3 = a3.getNonDeletedElements(), l3 = { didAddPoint: false, hitElement: null, linearElementEditor: null };
    if (!i3) return l3;
    let { elementId: U } = i3, p = K3.getElement(U, d);
    if (!p) return l3;
    let m = K3.getSegmentMidpointHitCoords(i3, o3, s3, d), b3 = null;
    if (m) b3 = K3.getSegmentMidPointIndex(i3, s3, m, d);
    else if (t3.altKey && s3.editingLinearElement) return i3.lastUncommittedPoint == null && (Y(p, { points: [...p.points, K3.createPointAt(p, d, o3.x, o3.y, t3[Q.CTRL_OR_CMD] ? null : n3.getEffectiveGridSize())] }), l3.didAddPoint = true), r.shouldCaptureIncrement(), l3.linearElementEditor = { ...i3, pointerDownState: { prevSelectedPointsIndices: i3.selectedPointsIndices, lastClickedPoint: -1, lastClickedIsEndPoint: false, origin: { x: o3.x, y: o3.y }, segmentMidpoint: { value: m, index: b3, added: false } }, selectedPointsIndices: [p.points.length - 1], lastUncommittedPoint: null, endBindingElement: Bn(o3, c3, d, n3.state.zoom, i3.elbowed) }, l3.didAddPoint = true, l3;
    let E = K3.getPointIndexUnderCursor(p, d, s3.zoom, o3.x, o3.y);
    if (E >= 0 || m) l3.hitElement = p;
    else {
      let { startBindingElement: D, endBindingElement: $3 } = i3;
      Fa(s3) && Pr(p) && Ba(p, D, $3, d, a3);
    }
    let [g, h, x, y] = C2(p, d), w = (g + x) / 2, I = (h + y) / 2, S = E > -1 && T(u(p.x + p.points[E][0], p.y + p.points[E][1]), u(w, I), p.angle), v = E > -1 || t3.shiftKey ? t3.shiftKey || i3.selectedPointsIndices?.includes(E) ? Nb([...i3.selectedPointsIndices || [], E]) : [E] : null;
    return l3.linearElementEditor = { ...i3, pointerDownState: { prevSelectedPointsIndices: i3.selectedPointsIndices, lastClickedPoint: E, lastClickedIsEndPoint: E === p.points.length - 1, origin: { x: o3.x, y: o3.y }, segmentMidpoint: { value: m, index: b3, added: false } }, selectedPointsIndices: v, pointerOffset: S ? { x: o3.x - S[0], y: o3.y - S[1] } : { x: 0, y: 0 } }, l3;
  }
  static arePointsEqual(t3, n3) {
    return !t3 && !n3 ? true : !t3 || !n3 ? false : _e(t3, n3);
  }
  static handlePointerMove(t3, n3, r, o3, i3) {
    let a3 = o3.state;
    if (!a3.editingLinearElement) return null;
    let { elementId: s3, lastUncommittedPoint: d } = a3.editingLinearElement, c3 = K3.getElement(s3, i3);
    if (!c3) return a3.editingLinearElement;
    let { points: l3 } = c3, U = l3[l3.length - 1];
    if (!t3.altKey) return U === d && K3.deletePoints(c3, [l3.length - 1]), { ...a3.editingLinearElement, lastUncommittedPoint: null };
    let p;
    if (ga(t3) && l3.length >= 2) {
      let m = l3[l3.length - 2], [b3, E] = K3._getShiftLockedDelta(c3, i3, m, u(n3, r), t3[Q.CTRL_OR_CMD] ? null : o3.getEffectiveGridSize());
      p = u(b3 + m[0], E + m[1]);
    } else p = K3.createPointAt(c3, i3, n3 - a3.editingLinearElement.pointerOffset.x, r - a3.editingLinearElement.pointerOffset.y, t3[Q.CTRL_OR_CMD] || X(c3) ? null : o3.getEffectiveGridSize());
    return U === d ? K3.movePoints(c3, [{ index: c3.points.length - 1, point: p }]) : K3.addPoints(c3, [{ point: p }]), { ...a3.editingLinearElement, lastUncommittedPoint: c3.points[c3.points.length - 1] };
  }
  static getPointGlobalCoordinates(t3, n3, r) {
    let [o3, i3, a3, s3] = C2(t3, r), d = (o3 + a3) / 2, c3 = (i3 + s3) / 2, { x: l3, y: U } = t3;
    return T(u(l3 + n3[0], U + n3[1]), u(d, c3), t3.angle);
  }
  static getPointsGlobalCoordinates(t3, n3) {
    let [r, o3, i3, a3] = C2(t3, n3), s3 = (r + i3) / 2, d = (o3 + a3) / 2;
    return t3.points.map((c3) => {
      let { x: l3, y: U } = t3;
      return T(u(l3 + c3[0], U + c3[1]), u(s3, d), t3.angle);
    });
  }
  static getPointAtIndexGlobalCoordinates(t3, n3, r) {
    let o3 = n3 < 0 ? t3.points.length + n3 : n3, [i3, a3, s3, d] = C2(t3, r), c3 = (i3 + s3) / 2, l3 = (a3 + d) / 2, U = t3.points[o3], { x: p, y: m } = t3;
    return U ? T(u(p + U[0], m + U[1]), u(c3, l3), t3.angle) : T(u(p, m), u(c3, l3), t3.angle);
  }
  static pointFromAbsoluteCoords(t3, n3, r) {
    if (X(t3)) return u(n3[0] - t3.x, n3[1] - t3.y);
    let [o3, i3, a3, s3] = C2(t3, r), d = (o3 + a3) / 2, c3 = (i3 + s3) / 2, [l3, U] = T(u(n3[0], n3[1]), u(d, c3), -t3.angle);
    return u(l3 - t3.x, U - t3.y);
  }
  static getPointIndexUnderCursor(t3, n3, r, o3, i3) {
    let a3 = K3.getPointsGlobalCoordinates(t3, n3), s3 = a3.length;
    for (; --s3 > -1; ) {
      let d = a3[s3];
      if (ie2(u(o3, i3), u(d[0], d[1])) * r.value < K3.POINT_HANDLE_SIZE + 1) return s3;
    }
    return -1;
  }
  static createPointAt(t3, n3, r, o3, i3) {
    let a3 = Vr(r, o3, i3), [s3, d, c3, l3] = C2(t3, n3), U = (s3 + c3) / 2, p = (d + l3) / 2, [m, b3] = T(u(a3[0], a3[1]), u(U, p), -t3.angle);
    return u(m - t3.x, b3 - t3.y);
  }
  static getNormalizedPoints(t3) {
    let { points: n3 } = t3, r = n3[0][0], o3 = n3[0][1];
    return { points: n3.map((i3) => u(i3[0] - r, i3[1] - o3)), x: t3.x + r, y: t3.y + o3 };
  }
  static normalizePoints(t3) {
    Y(t3, K3.getNormalizedPoints(t3));
  }
  static duplicateSelectedPoints(t3, n3) {
    Ae(t3.editingLinearElement, "Not currently editing a linear element");
    let { selectedPointsIndices: r, elementId: o3 } = t3.editingLinearElement, i3 = K3.getElement(o3, n3);
    Ae(i3, "The linear element does not exist in the provided Scene"), Ae(r != null, "There are no selected points to duplicate");
    let { points: a3 } = i3, s3 = [], d = false, c3 = -1, l3 = a3.reduce((U, p, m) => {
      if (++c3, U.push(p), r.includes(m)) {
        let E = a3[m + 1];
        E || (d = true), U.push(E ? u((p[0] + E[0]) / 2, (p[1] + E[1]) / 2) : u(p[0], p[1])), s3.push(c3 + 1), ++c3;
      }
      return U;
    }, []);
    if (Y(i3, { points: l3 }), d) {
      let U = i3.points[i3.points.length - 1];
      K3.movePoints(i3, [{ index: i3.points.length - 1, point: u(U[0] + 30, U[1] + 30) }]);
    }
    return { ...t3, editingLinearElement: { ...t3.editingLinearElement, selectedPointsIndices: s3 } };
  }
  static deletePoints(t3, n3) {
    let r = 0, o3 = 0;
    if (n3.includes(0)) {
      let s3 = t3.points.find((d, c3) => !n3.includes(c3));
      s3 && (r = s3[0], o3 = s3[1]);
    }
    let a3 = t3.points.reduce((s3, d, c3) => (n3.includes(c3) || s3.push(s3.length ? u(d[0] - r, d[1] - o3) : u(0, 0)), s3), []);
    K3._updatePoints(t3, a3, r, o3);
  }
  static addPoints(t3, n3) {
    let i3 = [...t3.points, ...n3.map((a3) => a3.point)];
    K3._updatePoints(t3, i3, 0, 0);
  }
  static movePoints(t3, n3, r) {
    let { points: o3 } = t3, [i3, a3] = n3.find(({ index: l3 }) => l3 === 0)?.point ?? u(0, 0), [s3, d] = u(i3 - o3[0][0], a3 - o3[0][1]), c3 = X(t3) ? [n3.find((l3) => l3.index === 0)?.point ?? o3[0], n3.find((l3) => l3.index === o3.length - 1)?.point ?? o3[o3.length - 1]] : o3.map((l3, U) => {
      let p = n3.find((m) => m.index === U)?.point ?? l3;
      return u(p[0] - s3, p[1] - d);
    });
    K3._updatePoints(t3, c3, s3, d, r, { isDragging: n3.reduce((l3, U) => l3 || U.isDragging === true, false) });
  }
  static shouldAddMidpoint(t3, n3, r, o3) {
    let i3 = K3.getElement(t3.elementId, o3);
    if (i3 && X(i3) || !i3) return false;
    let { segmentMidpoint: a3 } = t3.pointerDownState;
    if (a3.added || a3.value === null || a3.index === null || t3.pointerDownState.origin === null) return false;
    let s3 = t3.pointerDownState.origin, d = ie2(u(s3.x, s3.y), u(n3.x, n3.y));
    return !(!r.editingLinearElement && d < As / r.zoom.value);
  }
  static addMidpoint(t3, n3, r, o3, i3) {
    let a3 = K3.getElement(t3.elementId, i3);
    if (!a3) return;
    let { segmentMidpoint: s3 } = t3.pointerDownState, d = { pointerDownState: t3.pointerDownState, selectedPointsIndices: t3.selectedPointsIndices }, c3 = K3.createPointAt(a3, i3, n3.x, n3.y, o3 && !X(a3) ? r.getEffectiveGridSize() : null), l3 = [...a3.points.slice(0, s3.index), c3, ...a3.points.slice(s3.index)];
    return Y(a3, { points: l3 }), d.pointerDownState = { ...t3.pointerDownState, segmentMidpoint: { ...t3.pointerDownState.segmentMidpoint, added: true }, lastClickedPoint: s3.index }, d.selectedPointsIndices = [s3.index], d;
  }
  static _updatePoints(t3, n3, r, o3, i3, a3) {
    if (X(t3)) {
      let s3 = {};
      i3?.startBinding !== void 0 && (s3.startBinding = i3.startBinding !== null && vn(i3.startBinding) ? i3.startBinding : null), i3?.endBinding !== void 0 && (s3.endBinding = i3.endBinding !== null && vn(i3.endBinding) ? i3.endBinding : null), s3.points = Array.from(n3), Y(t3, s3, true, { isDragging: a3?.isDragging });
    } else {
      let s3 = $a(t3, n3), d = $a(t3, t3.points), c3 = (s3[0] + s3[2]) / 2, l3 = (s3[1] + s3[3]) / 2, U = (d[0] + d[2]) / 2, p = (d[1] + d[3]) / 2, m = U - c3, b3 = p - l3, E = T(u(r, o3), u(m, b3), t3.angle);
      Y(t3, { ...i3, points: n3, x: t3.x + E[0], y: t3.y + E[1] });
    }
  }
  static _getShiftLockedDelta(t3, n3, r, o3, i3) {
    let a3 = K3.getPointGlobalCoordinates(t3, r, n3);
    if (X(t3)) return [o3[0] - a3[0], o3[1] - a3[1]];
    let [s3, d] = Vr(o3[0], o3[1], i3), { width: c3, height: l3 } = Va(a3[0], a3[1], s3, d);
    return T(u(c3, l3), u(0, 0), -t3.angle);
  }
  static moveFixedSegment(t3, n3, r, o3, i3) {
    let a3 = K3.getElement(t3.elementId, i3);
    if (!a3 || !X(a3)) return t3;
    if (n3 && n3 > 0 && n3 < a3.points.length) {
      let s3 = Lt(Ht(O(a3.points[n3], a3.points[n3 - 1]))), d = (a3.fixedSegments ?? []).reduce((p, m) => (p[m.index] = m, p), {});
      d[n3] = { index: n3, start: u(s3 ? a3.points[n3 - 1][0] : r - a3.x, s3 ? o3 - a3.y : a3.points[n3 - 1][1]), end: u(s3 ? a3.points[n3][0] : r - a3.x, s3 ? o3 - a3.y : a3.points[n3][1]) };
      let c3 = Object.values(d).sort((p, m) => p.index - m.index), l3 = c3.map((p) => p.index).reduce((p, m) => m < n3 ? p + 1 : p, 0);
      Y(a3, { fixedSegments: c3 });
      let U = u(a3.x + (a3.fixedSegments[l3].start[0] + a3.fixedSegments[l3].end[0]) / 2, a3.y + (a3.fixedSegments[l3].start[1] + a3.fixedSegments[l3].end[1]) / 2);
      return { ...t3, segmentMidPointHoveredCoords: U, pointerDownState: { ...t3.pointerDownState, segmentMidpoint: { added: false, index: a3.fixedSegments[l3].index, value: U } } };
    }
    return t3;
  }
  static deleteFixedSegment(t3, n3) {
    Y(t3, { fixedSegments: t3.fixedSegments?.filter((r) => r.index !== n3) }), Y(t3, {}, true);
  }
};
i(K2, "POINT_HANDLE_SIZE", 10), i(K2, "getEditorMidPoints", (t3, n3, r) => {
  let o3 = oe(t3, n3);
  return !X(t3) && !r.editingLinearElement && t3.points.length > 2 && !o3 ? [] : (sn.version === t3.version && sn.zoom === r.zoom.value || K2.updateEditorMidPointsCache(t3, n3, r), sn.points);
}), i(K2, "updateEditorMidPointsCache", (t3, n3, r) => {
  let o3 = K2.getPointsGlobalCoordinates(t3, n3), i3 = 0, a3 = [];
  for (; i3 < o3.length - 1; ) {
    if (K2.isSegmentTooShort(t3, t3.points[i3], t3.points[i3 + 1], i3, r.zoom)) {
      a3.push(null), i3++;
      continue;
    }
    let s3 = K2.getSegmentMidPoint(t3, o3[i3], o3[i3 + 1], i3 + 1, n3);
    a3.push(s3), i3++;
  }
  sn.points = a3, sn.version = t3.version, sn.zoom = r.zoom.value;
}), i(K2, "getSegmentMidpointHitCoords", (t3, n3, r, o3) => {
  let { elementId: i3 } = t3, a3 = K2.getElement(i3, o3);
  if (!a3) return null;
  let s3 = K2.getPointIndexUnderCursor(a3, o3, r.zoom, n3.x, n3.y);
  if (!X(a3) && s3 >= 0 || K2.getPointsGlobalCoordinates(a3, o3).length >= 3 && !r.editingLinearElement && !X(a3)) return null;
  let c3 = (K2.POINT_HANDLE_SIZE + 1) / r.zoom.value, l3 = t3.segmentMidPointHoveredCoords;
  if (l3 && ie2(u(l3[0], l3[1]), u(n3.x, n3.y)) <= c3) return l3;
  let U = 0, p = K2.getEditorMidPoints(a3, o3, r);
  for (; U < p.length; ) {
    if (p[U] !== null && ie2(p[U], u(n3.x, n3.y)) <= c3) return p[U];
    U++;
  }
  return null;
}), i(K2, "getBoundTextElementPosition", (t3, n3, r) => {
  let o3 = K2.getPointsGlobalCoordinates(t3, r);
  o3.length < 2 && Y(n3, { isDeleted: true });
  let i3 = 0, a3 = 0;
  if (t3.points.length % 2 === 1) {
    let s3 = Math.floor(t3.points.length / 2), d = K2.getPointGlobalCoordinates(t3, t3.points[s3], r);
    i3 = d[0] - n3.width / 2, a3 = d[1] - n3.height / 2;
  } else {
    let s3 = t3.points.length / 2 - 1, d = sn.points[s3];
    t3.points.length === 2 && (d = Zt(o3[0], o3[1])), (!d || sn.version !== t3.version) && (d = K2.getSegmentMidPoint(t3, o3[s3], o3[s3 + 1], s3 + 1, r)), i3 = d[0] - n3.width / 2, a3 = d[1] - n3.height / 2;
  }
  return { x: i3, y: a3 };
}), i(K2, "getMinMaxXYWithBoundText", (t3, n3, r, o3) => {
  let [i3, a3, s3, d] = r, c3 = (i3 + s3) / 2, l3 = (a3 + d) / 2, { x: U, y: p } = K2.getBoundTextElementPosition(t3, o3, n3), m = U + o3.width, b3 = p + o3.height, E = u(c3, l3), g = T(u(i3, a3), E, t3.angle), h = T(u(s3, a3), E, t3.angle), x = T(u(U, p), E, -t3.angle), y = T(u(m, p), E, -t3.angle), w = T(u(U, b3), E, -t3.angle), I = T(u(m, b3), E, -t3.angle);
  return g[0] < h[0] && g[1] >= h[1] ? (i3 = Math.min(i3, w[0]), s3 = Math.max(s3, Math.max(y[0], I[0])), a3 = Math.min(a3, x[1]), d = Math.max(d, I[1])) : g[0] >= h[0] && g[1] > h[1] ? (i3 = Math.min(i3, I[0]), s3 = Math.max(s3, Math.max(x[0], y[0])), a3 = Math.min(a3, w[1]), d = Math.max(d, y[1])) : g[0] >= h[0] ? (i3 = Math.min(i3, y[0]), s3 = Math.max(s3, w[0]), a3 = Math.min(a3, I[1]), d = Math.max(d, x[1])) : g[1] <= h[1] && (i3 = Math.min(i3, Math.min(y[0], x[0])), s3 = Math.max(s3, I[0]), a3 = Math.min(a3, y[1]), d = Math.max(d, w[1])), [i3, a3, s3, d, c3, l3];
}), i(K2, "getElementAbsoluteCoords", (t3, n3, r = false) => {
  let o3, i3, a3, s3, d;
  if (t3.points.length < 2 || !he2.get(t3)) {
    let { minX: p, minY: m, maxX: b3, maxY: E } = t3.points.reduce((g, [h, x]) => (g.minY = Math.min(g.minY, x), g.minX = Math.min(g.minX, h), g.maxX = Math.max(g.maxX, h), g.maxY = Math.max(g.maxY, x), g), { minX: 1 / 0, minY: 1 / 0, maxX: -1 / 0, maxY: -1 / 0 });
    i3 = p + t3.x, a3 = m + t3.y, s3 = b3 + t3.x, d = E + t3.y;
  } else {
    let p = he2.generateElementShape(t3, null), m = It(p[0]), [b3, E, g, h] = Hr(m);
    i3 = b3 + t3.x, a3 = E + t3.y, s3 = g + t3.x, d = h + t3.y;
  }
  let c3 = (i3 + s3) / 2, l3 = (a3 + d) / 2;
  if (o3 = [i3, a3, s3, d, c3, l3], !r) return o3;
  let U = oe(t3, n3);
  return U && (o3 = K2.getMinMaxXYWithBoundText(t3, n3, [i3, a3, s3, d], U)), o3;
});
var z = K2;
var Nb = (e8) => {
  let t3 = [...new Set(e8.filter((n3) => n3 !== null && n3 !== -1))];
  return t3 = t3.sort((n3, r) => n3 - r), t3.length ? t3 : null;
};
var qr = {};
var I2 = (e8, t3) => {
  let n3 = qr[e8] || (qr[e8] = { height: t3 });
  return n3.height = t3, n3;
};
var w2 = (e8) => {
  qr[e8] && delete qr[e8];
};
var WF = (e8) => qr[e8]?.height ?? null;
var Xa = (e8, t3, n3, r = true) => {
  let o3, i3 = { x: e8.x, y: e8.y, text: e8.text, width: e8.width, height: e8.height, angle: t3?.angle ?? e8.angle };
  i3.text = e8.text, (t3 || !e8.autoResize) && (o3 = t3 ? Tt(t3, e8) : e8.width, i3.text = en(e8.originalText, Ee(e8), o3));
  let a3 = ht(i3.text, Ee(e8), e8.lineHeight);
  if (e8.autoResize && (i3.width = a3.width), i3.height = a3.height, t3) {
    let s3 = Ar(t3, e8), d = Tt(t3, e8);
    if (!ee2(t3) && a3.height > s3) {
      let p = qa(a3.height, t3.type);
      Y(t3, { height: p }, r), I2(t3.id, p);
    }
    if (a3.width > d) {
      let p = qa(a3.width, t3.type);
      Y(t3, { width: p }, r);
    }
    let c3 = { ...e8, ...i3 }, { x: l3, y: U } = R22(t3, c3, n3);
    i3.x = l3, i3.y = U;
  }
  Y(e8, i3, r);
};
var dB = (e8, t3, n3) => {
  let r = te(e8);
  t3.forEach((o3) => {
    let i3 = n3.get(o3.id), a3 = Yt(o3);
    if (a3) {
      let s3 = n3.get(a3);
      if (s3) {
        let d = r.get(i3);
        d && Y(d, { boundElements: (o3.boundElements || []).filter((l3) => l3.id !== s3 && l3.id !== a3).concat({ type: "text", id: s3 }) });
        let c3 = r.get(s3);
        c3 && k(c3) && Y(c3, { containerId: d ? i3 : null });
      }
    }
  });
};
var _n = (e8, t3, n3, r = false) => {
  if (!Yt(e8)) return;
  w2(e8.id);
  let i3 = oe(e8, t3);
  if (i3 && i3.text) {
    if (!e8) return;
    let a3 = i3.text, s3 = i3.height, d = i3.width, c3 = Tt(e8, i3), l3 = Ar(e8, i3), U = e8.height;
    if (r || n3 !== "n" && n3 !== "s") {
      a3 && (a3 = en(i3.originalText, Ee(i3), c3));
      let p = ht(a3, Ee(i3), i3.lineHeight);
      s3 = p.height, d = p.width;
    }
    if (s3 > l3) {
      U = qa(s3, e8.type);
      let p = U - e8.height, m = !ee2(e8) && (n3 === "ne" || n3 === "nw" || n3 === "n") ? e8.y - p : e8.y;
      Y(e8, { height: U, y: m });
    }
    Y(i3, { text: a3, width: d, height: s3 }), ee2(e8) || Y(i3, R22(e8, i3, t3));
  }
};
var R22 = (e8, t3, n3) => {
  if (ee2(e8)) return z.getBoundTextElementPosition(e8, t3, n3);
  let r = Ra(e8), o3 = Ar(e8, t3), i3 = Tt(e8, t3), a3, s3;
  return t3.verticalAlign === kt.TOP ? s3 = r.y : t3.verticalAlign === kt.BOTTOM ? s3 = r.y + (o3 - t3.height) : s3 = r.y + (o3 / 2 - t3.height / 2), t3.textAlign === Xi.LEFT ? a3 = r.x : t3.textAlign === Xi.RIGHT ? a3 = r.x + (i3 - t3.width) : a3 = r.x + (i3 / 2 - t3.width / 2), { x: a3, y: s3 };
};
var Yt = (e8) => e8?.boundElements?.length && e8?.boundElements?.find((t3) => t3.type === "text")?.id || null;
var oe = (e8, t3) => {
  if (!e8) return null;
  let n3 = Yt(e8);
  return n3 && t3.get(n3) || null;
};
var qe = (e8, t3) => e8 && e8.containerId && t3.get(e8.containerId) || null;
var cB = (e8, t3, n3) => {
  if (!ee2(e8)) return { x: e8.x + e8.width / 2, y: e8.y + e8.height / 2 };
  let r = z.getPointsGlobalCoordinates(e8, n3);
  if (r.length % 2 === 1) {
    let a3 = Math.floor(e8.points.length / 2), s3 = z.getPointGlobalCoordinates(e8, e8.points[a3], n3);
    return { x: s3[0], y: s3[1] };
  }
  let o3 = e8.points.length / 2 - 1, i3 = z.getEditorMidPoints(e8, n3, t3)[o3];
  return i3 || (i3 = z.getSegmentMidPoint(e8, r[o3], r[o3 + 1], o3 + 1, n3)), { x: i3[0], y: i3[1] };
};
var Ra = (e8) => {
  let t3 = Se, n3 = Se;
  return e8.type === "ellipse" && (t3 += e8.width / 2 * (1 - Math.sqrt(2) / 2), n3 += e8.height / 2 * (1 - Math.sqrt(2) / 2)), e8.type === "diamond" && (t3 += e8.width / 4, n3 += e8.height / 4), { x: e8.x + t3, y: e8.y + n3 };
};
var lB = (e8, t3) => !t3 || ee2(t3) ? e8.angle : t3.angle;
var UB = (e8, t3) => e8.some((n3) => {
  if (Ne(n3)) {
    let r = qe(n3, t3);
    return !ee2(r);
  }
  return false;
});
var fB = (e8, t3) => e8.some((n3) => {
  if (Ne(n3)) {
    let r = qe(n3, t3);
    return !ee2(r);
  }
  return k(n3);
});
var Fb = /* @__PURE__ */ new Set(["rectangle", "ellipse", "diamond", "arrow"]);
var pB = (e8) => Fb.has(e8.type);
var qa = (e8, t3) => {
  e8 = Math.ceil(e8);
  let n3 = Se * 2;
  return t3 === "ellipse" ? Math.round((e8 + n3) / Math.sqrt(2) * 2) : t3 === "arrow" ? e8 + n3 * 8 : t3 === "diamond" ? 2 * (e8 + n3) : e8 + n3;
};
var Tt = (e8, t3) => {
  let { width: n3 } = e8;
  if (ee2(e8)) {
    let r = (t3?.fontSize ?? ut) * qs;
    return Math.max(Vs * n3, r);
  }
  return e8.type === "ellipse" ? Math.round(n3 / 2 * Math.sqrt(2)) - Se * 2 : e8.type === "diamond" ? Math.round(n3 / 2) - Se * 2 : n3 - Se * 2;
};
var Ar = (e8, t3) => {
  let { height: n3 } = e8;
  return ee2(e8) ? n3 - Se * 8 * 2 <= 0 ? t3.height : n3 : e8.type === "ellipse" ? Math.round(n3 / 2 * Math.sqrt(2)) - Se * 2 : e8.type === "diamond" ? Math.round(n3 / 2) - Se * 2 : n3 - Se * 2;
};
var Bb = (e8, t3 = `

`) => e8.reduce((r, o3) => (k(o3) && r.push(o3.text), r), []).join(t3);
var dn = (e8) => (e8 = e8.trim(), e8 && (0, import_sanitize_url.sanitizeUrl)(kn(e8)));
var gB = (e8) => !!(e8?.includes(location.origin) || e8?.startsWith("/"));
var T2 = (e8) => {
  if (e8 = dn(e8), e8.startsWith("/")) return `${location.origin}${e8}`;
  try {
    new URL(e8);
  } catch {
    return "about:blank";
  }
  return e8;
};
var M2 = [];
var L2 = (e8) => (M2 = M2.concat(e8), e8);
var S2 = '<svg viewBox="0 0 24 24" stroke-width="1" width="28" height="28" xmlns="http://www.w3.org/2000/svg">';
var Ob = '<path d="M6.164 11.755a5.314 5.314 0 0 1-4.932-5.298 5.314 5.314 0 0 1 5.311-5.311 5.314 5.314 0 0 1 5.307 5.113l8.773 8.773a3.322 3.322 0 0 1 0 4.696l-.895.895a3.322 3.322 0 0 1-4.696 0l-8.868-8.868Z" style="fill:#fff"/>';
var v2 = '<path stroke="#1b1b1f" fill="#fff" d="m7.868 11.113 7.773 7.774a2.359 2.359 0 0 0 1.667.691 2.368 2.368 0 0 0 2.357-2.358c0-.625-.248-1.225-.69-1.667L11.201 7.78 9.558 9.469l-1.69 1.643v.001Zm10.273 3.606-3.333 3.333m-3.25-6.583 2 2m-7-7 3 3M3.664 3.625l1 1M2.529 6.922l1.407-.144m5.735-2.932-1.118.866M4.285 9.823l.758-1.194m1.863-6.207-.13 1.408"/>';
var Ab = `data:${H.svg},${encodeURIComponent(`${S2}${v2}</svg>`)}`;
var Kb = `data:${H.svg},${encodeURIComponent(`${S2}${Ob}${v2}</svg>`)}`;
var Hb = (e8) => {
  e8 && (e8.style.cursor = "");
};
var Jb = (e8, t3) => {
  e8 && (e8.style.cursor = t3);
};
var Ct;
var D2;
var Yb = (e8, t3) => {
  let r = () => {
    let o3 = t3 === ke.DARK;
    Ct = document.createElement("canvas"), Ct.theme = t3, Ct.height = 20, Ct.width = 20;
    let i3 = Ct.getContext("2d");
    i3.lineWidth = 1, i3.beginPath(), i3.arc(Ct.width / 2, Ct.height / 2, 5, 0, 2 * Math.PI), i3.fillStyle = o3 ? open_color_default.black : open_color_default.white, i3.fill(), i3.strokeStyle = o3 ? open_color_default.white : open_color_default.black, i3.stroke(), D2 = Ct.toDataURL(H.svg);
  };
  (!Ct || Ct.theme !== t3) && r(), Jb(e8, `url(${D2}) ${20 / 2} ${20 / 2}, auto`);
};
var $2 = (e8, t3) => {
  if (e8) if (t3.activeTool.type === "selection") Hb(e8);
  else if (nd(t3)) e8.style.cursor = mo.GRAB;
  else if (td(t3)) Yb(e8, t3.theme);
  else if (t3.activeTool.type === "laser") {
    let n3 = t3.theme === ke.LIGHT ? Ab : Kb;
    e8.style.cursor = `url(${n3}), auto`;
  } else ["image", "custom"].includes(t3.activeTool.type) ? t3.activeTool.type !== "image" && (e8.style.cursor = mo.AUTO) : e8.style.cursor = mo.CROSSHAIR;
};
var qb = new Random(Date.now());
var Xb = 0;
var Vt = () => Math.floor(qb.next() * 2 ** 31);
var Dt = () => Ot() ? `id${Xb++}` : nanoid();
var St = (e8, { x: t3, y: n3, strokeColor: r = we.strokeColor, backgroundColor: o3 = we.backgroundColor, fillStyle: i3 = we.fillStyle, strokeWidth: a3 = we.strokeWidth, strokeStyle: s3 = we.strokeStyle, roughness: d = we.roughness, opacity: c3 = we.opacity, width: l3 = 0, height: U = 0, angle: p = 0, groupIds: m = [], frameId: b3 = null, index: E = null, roundness: g = null, boundElements: h = null, link: x = null, locked: y = we.locked, ...w }) => ((t3 < -1e6 || t3 > 1e6 || n3 < -1e6 || n3 > 1e6 || l3 < -1e6 || l3 > 1e6 || U < -1e6 || U > 1e6) && console.error("New element size or position is too large", { x: t3, y: n3, width: l3, height: U, points: w.points }), { id: w.id || Dt(), type: e8, x: t3, y: n3, width: l3, height: U, angle: p, strokeColor: r, backgroundColor: o3, fillStyle: i3, strokeWidth: a3, strokeStyle: s3, roughness: d, opacity: c3, groupIds: m, frameId: b3, index: E, roundness: g, seed: w.seed ?? Vt(), version: w.version || 1, versionNonce: w.versionNonce ?? 0, isDeleted: false, boundElements: h, updated: zt(), link: x, locked: y, customData: w.customData });
var Xr = (e8) => St(e8.type, e8);
var VB = (e8) => St("embeddable", e8);
var qB = (e8) => ({ ...St("iframe", e8) });
var XB = (e8) => vt({ ...St("frame", e8), type: "frame", name: e8?.name || null }, {});
var GB = (e8) => vt({ ...St("magicframe", e8), type: "magicframe", name: e8?.name || null }, {});
var P2 = (e8, t3) => ({ x: e8.textAlign === "center" ? t3.width / 2 : e8.textAlign === "right" ? t3.width : 0, y: e8.verticalAlign === "middle" ? t3.height / 2 : 0 });
var qt = (e8) => {
  let t3 = e8.fontFamily || Ft, n3 = e8.fontSize || ut, r = e8.lineHeight || ko(t3), o3 = ia(e8.text), i3 = ht(o3, Ee({ fontFamily: t3, fontSize: n3 }), r), a3 = e8.textAlign || Vn, s3 = e8.verticalAlign || go, d = P2({ textAlign: a3, verticalAlign: s3 }, i3), c3 = { ...St("text", e8), text: o3, fontSize: n3, fontFamily: t3, textAlign: a3, verticalAlign: s3, x: e8.x - d.x, y: e8.y - d.y, width: i3.width, height: i3.height, containerId: e8.containerId || null, originalText: e8.originalText ?? o3, autoResize: e8.autoResize ?? true, lineHeight: r };
  return vt(c3, {});
};
var Gb = (e8, t3, n3) => {
  let { width: r, height: o3 } = ht(n3, Ee(e8), e8.lineHeight);
  e8.autoResize || (r = e8.width);
  let { textAlign: i3, verticalAlign: a3 } = e8, s3, d;
  if (i3 === "center" && a3 === kt.MIDDLE && !e8.containerId && e8.autoResize) {
    let c3 = ht(e8.text, Ee(e8), e8.lineHeight), l3 = P2(e8, { width: r - c3.width, height: o3 - c3.height });
    s3 = e8.x - l3.x, d = e8.y - l3.y;
  } else {
    let [c3, l3, U, p] = C2(e8, t3), [m, b3, E, g] = Rt(e8, r, o3, false), h = (c3 - m) / 2, x = (l3 - b3) / 2, y = (U - E) / 2, w = (p - g) / 2;
    [s3, d] = kb({ s: true, e: i3 === "center" || i3 === "left", w: i3 === "center" || i3 === "right" }, e8.x, e8.y, e8.angle, h, x, y, w);
  }
  return { width: r, height: o3, x: Number.isFinite(s3) ? s3 : e8.x, y: Number.isFinite(d) ? d : e8.y };
};
var kb = (e8, t3, n3, r, o3, i3, a3, s3) => {
  let d = Math.cos(r), c3 = Math.sin(r);
  return e8.e && e8.w ? t3 += o3 + a3 : e8.e ? (t3 += o3 * (1 + d), n3 += o3 * c3, t3 += a3 * (1 - d), n3 += a3 * -c3) : e8.w && (t3 += o3 * (1 - d), n3 += o3 * -c3, t3 += a3 * (1 + d), n3 += a3 * c3), e8.n && e8.s ? n3 += i3 + s3 : e8.n ? (t3 += i3 * c3, n3 += i3 * (1 - d), t3 += s3 * -c3, n3 += s3 * (1 + d)) : e8.s && (t3 += i3 * -c3, n3 += i3 * (1 + d), t3 += s3 * c3, n3 += s3 * (1 - d)), [t3, n3];
};
var Ga = (e8, t3, n3, r = e8.text) => {
  if (e8.isDeleted) return;
  (t3 || !e8.autoResize) && (r = en(r, Ee(e8), t3 ? Tt(t3, e8) : e8.width));
  let o3 = Gb(e8, n3, r);
  return { text: r, ...o3 };
};
var kB = (e8) => ({ ...St(e8.type, e8), points: e8.points || [], pressures: e8.pressures || [], simulatePressure: e8.simulatePressure, lastCommittedPoint: null });
var On = (e8) => ({ ...St(e8.type, e8), points: e8.points || [], lastCommittedPoint: null, startBinding: null, endBinding: null, startArrowhead: null, endArrowhead: null });
var Zb = (e8) => e8.elbowed ? { ...St(e8.type, e8), points: e8.points || [], lastCommittedPoint: null, startBinding: null, endBinding: null, startArrowhead: e8.startArrowhead || null, endArrowhead: e8.endArrowhead || null, elbowed: true, fixedSegments: e8.fixedSegments || [], startIsSpecial: false, endIsSpecial: false } : { ...St(e8.type, e8), points: e8.points || [], lastCommittedPoint: null, startBinding: null, endBinding: null, startArrowhead: e8.startArrowhead || null, endArrowhead: e8.endArrowhead || null, elbowed: false };
var Wb = (e8) => ({ ...St("image", e8), strokeColor: "transparent", status: e8.status ?? "pending", fileId: e8.fileId ?? null, scale: e8.scale ?? [1, 1], crop: e8.crop ?? null });
var gi = (e8, t3 = 0) => {
  if (e8 == null || typeof e8 != "object") return e8;
  let n3 = Object.prototype.toString.call(e8);
  if (n3 === "[object Object]") {
    let r = typeof e8.constructor == "function" ? Object.create(Object.getPrototypeOf(e8)) : {};
    for (let o3 in e8) if (e8.hasOwnProperty(o3)) {
      if (t3 === 0 && (o3 === "shape" || o3 === "canvas")) continue;
      r[o3] = gi(e8[o3], t3 + 1);
    }
    return r;
  }
  if (Array.isArray(e8)) {
    let r = e8.length, o3 = new Array(r);
    for (; r--; ) o3[r] = gi(e8[r], t3 + 1);
    return o3;
  }
  return c.DEV && n3 !== "[object Object]" && n3 !== "[object Array]" && n3.startsWith("[object ") && console.warn(`_deepCloneElement: unexpected object type ${n3}. This value will not be cloned!`), e8;
};
var Gr = (e8) => gi(e8);
var N2 = (e8, t3) => {
  Object.defineProperty(e8, Qs, { value: t3, writable: false, enumerable: false });
};
var xi = () => Dt();
var zb = (e8, t3, n3, r) => {
  let o3 = Gr(n3);
  return Ot() && N2(o3, n3.id), o3.id = xi(), o3.boundElements = null, o3.updated = zt(), o3.seed = Vt(), o3.groupIds = u2(o3.groupIds, e8, (i3) => (t3.has(i3) || t3.set(i3, xi()), t3.get(i3))), r && (o3 = Object.assign(o3, r)), o3;
};
var ZB = (e8, t3) => {
  let n3 = [], r = te(e8), o3 = /* @__PURE__ */ new Map(), i3 = (s3) => {
    if (o3.has(s3)) return o3.get(s3);
    if (r.has(s3)) {
      let d = xi();
      return o3.set(s3, d), d;
    }
    return null;
  }, a3 = /* @__PURE__ */ new Map();
  for (let s3 of e8) {
    let d = gi(s3);
    if (d.id = i3(s3.id), Ot() && N2(d, s3.id), t3?.randomizeSeed && (d.seed = Vt(), kr(d)), d.groupIds && (d.groupIds = d.groupIds.map((c3) => (a3.has(c3) || a3.set(c3, xi()), a3.get(c3)))), "containerId" in d && d.containerId) {
      let c3 = i3(d.containerId);
      d.containerId = c3;
    }
    if ("boundElements" in d && d.boundElements && (d.boundElements = d.boundElements.reduce((c3, l3) => {
      let U = i3(l3.id);
      return U && c3.push({ ...l3, id: U }), c3;
    }, [])), "endBinding" in d && d.endBinding) {
      let c3 = i3(d.endBinding.elementId);
      d.endBinding = c3 ? { ...d.endBinding, elementId: c3 } : null;
    }
    if ("startBinding" in d && d.startBinding) {
      let c3 = i3(d.startBinding.elementId);
      d.startBinding = c3 ? { ...d.startBinding, elementId: c3 } : null;
    }
    d.frameId && (d.frameId = i3(d.frameId)), n3.push(d);
  }
  return n3;
};
var Za = (e8, { shouldThrow: t3 = false, includeBoundTextValidation: n3 = false, ignoreLogs: r, reconciliationContext: o3 }) => {
  let i3 = [], a3 = (d) => `${d?.index}:${d?.id}:${d?.type}:${d?.isDeleted}:${d?.version}:${d?.versionNonce}`, s3 = e8.map((d) => d.index);
  for (let [d, c3] of s3.entries()) {
    let l3 = s3[d - 1], U = s3[d + 1];
    if (ka(c3, l3, U) || i3.push(`Fractional indices invariant has been compromised: "${a3(e8[d - 1])}", "${a3(e8[d])}", "${a3(e8[d + 1])}"`), n3 && bn(e8[d])) {
      let p = e8[d], m = oe(p, te(e8));
      m && m.index <= p.index && i3.push(`Fractional indices invariant for bound elements has been compromised: "${a3(m)}", "${a3(p)}"`);
    }
  }
  if (i3.length) {
    let d = new Vo(), c3 = [];
    if (o3 && (c3.push("Additional reconciliation context:"), c3.push(o3.localElements.map((l3) => a3(l3))), c3.push(o3.remoteElements.map((l3) => a3(l3)))), r || console.error(i3.join(`

`), d.stack, e8.map((l3) => a3(l3)), ...c3), t3) throw d;
  }
};
var B2 = (e8) => e8.sort((t3, n3) => F2(t3) && F2(n3) ? t3.index < n3.index ? -1 : t3.index > n3.index ? 1 : t3.id < n3.id ? -1 : 1 : 1);
var Zr = (e8, t3) => {
  try {
    let n3 = jb(e8, t3), r = _2(e8, n3), o3 = e8.map((i3) => r.has(i3) ? { ...i3, ...r.get(i3) } : i3);
    Za(o3, { includeBoundTextValidation: false, shouldThrow: true, ignoreLogs: true });
    for (let [i3, a3] of r) Y(i3, a3, false);
  } catch {
    An(e8);
  }
  return e8;
};
var An = (e8) => {
  let t3 = e7(e8), n3 = _2(e8, t3);
  for (let [r, o3] of n3) Y(r, o3, false);
  return e8;
};
var jb = (e8, t3) => {
  let n3 = [], r = 0;
  for (; r < e8.length; ) if (t3.has(e8[r].id)) {
    let o3 = [r - 1, r];
    for (; ++r < e8.length && t3.has(e8[r].id); ) o3.push(r);
    o3.push(r), n3.push(o3);
  } else r++;
  return n3;
};
var e7 = (e8) => {
  let t3 = [], n3, r, o3 = -1, i3 = 0, a3 = (c3) => {
    let l3 = e8[o3] ? e8[o3].index : void 0, U = e8[c3 - 1]?.index;
    return !l3 && U || l3 && U && U > l3 ? [U, c3 - 1] : [l3, o3];
  }, s3 = (c3) => {
    let l3 = e8[i3] ? e8[i3].index : void 0;
    if (l3 && c3 < i3) return [l3, i3];
    let U = i3;
    for (; ++U < e8.length; ) {
      let p = e8[U]?.index;
      if (!l3 && p || l3 && p && p > l3) return [p, U];
    }
    return [void 0, U];
  }, d = 0;
  for (; d < e8.length; ) {
    let c3 = e8[d].index;
    if ([n3, o3] = a3(d), [r, i3] = s3(d), ka(c3, n3, r)) d++;
    else {
      let l3 = [o3, d];
      for (; ++d < e8.length; ) {
        let U = e8[d].index, [p, m] = a3(d), [b3, E] = s3(d);
        if (ka(U, p, b3)) break;
        [n3, o3] = [p, m], [r, i3] = [b3, E], l3.push(d);
      }
      l3.push(i3), t3.push(l3);
    }
  }
  return t3;
};
var ka = (e8, t3, n3) => e8 ? t3 && n3 ? t3 < e8 && e8 < n3 : !t3 && n3 ? e8 < n3 : t3 && !n3 ? t3 < e8 : !!e8 : false;
var _2 = (e8, t3) => {
  let n3 = /* @__PURE__ */ new Map();
  for (let r of t3) {
    let o3 = r.shift(), i3 = r.pop(), a3 = generateNKeysBetween(e8[o3]?.index, e8[i3]?.index, r.length);
    for (let s3 = 0; s3 < r.length; s3++) {
      let d = e8[r[s3]];
      n3.set(d, { index: a3[s3] });
    }
  }
  return n3;
};
var F2 = (e8) => !!e8.index;
var Le = class e3 {
  constructor(t3, n3) {
    this.deleted = t3;
    this.inserted = n3;
  }
  static create(t3, n3, r, o3) {
    let i3 = r && o3 !== "inserted" ? r(t3) : t3, a3 = r && o3 !== "deleted" ? r(n3) : n3;
    return new e3(i3, a3);
  }
  static calculate(t3, n3, r, o3) {
    if (t3 === n3) return e3.empty();
    let i3 = {}, a3 = {};
    for (let c3 of this.distinctKeysIterator("full", t3, n3)) i3[c3] = t3[c3], a3[c3] = n3[c3];
    let [s3, d] = o3 ? o3(i3, a3) : [i3, a3];
    return e3.create(s3, d, r);
  }
  static empty() {
    return new e3({}, {});
  }
  static isEmpty(t3) {
    return !Object.keys(t3.deleted).length && !Object.keys(t3.inserted).length;
  }
  static mergeObjects(t3, n3, r) {
    let o3 = { ...t3 };
    for (let i3 of Object.keys(r)) delete o3[i3];
    return { ...o3, ...n3 };
  }
  static mergeArrays(t3, n3, r, o3) {
    return Object.values(e3.mergeObjects(_t(t3 ?? [], o3), _t(n3 ?? [], o3), _t(r ?? [], o3)));
  }
  static diffObjects(t3, n3, r, o3) {
    if (!(!t3[r] && !n3[r]) && (typeof t3[r] == "object" || typeof n3[r] == "object")) {
      let i3 = t3[r] ?? {}, a3 = n3[r] ?? {}, s3 = e3.getLeftDifferences(i3, a3).reduce((c3, l3) => (c3[l3] = o3(i3[l3]), c3), {}), d = e3.getRightDifferences(i3, a3).reduce((c3, l3) => (c3[l3] = o3(a3[l3]), c3), {});
      Object.keys(s3).length || Object.keys(d).length ? (Reflect.set(t3, r, s3), Reflect.set(n3, r, d)) : (Reflect.deleteProperty(t3, r), Reflect.deleteProperty(n3, r));
    }
  }
  static diffArrays(t3, n3, r, o3) {
    if (!(!t3[r] && !n3[r]) && (Array.isArray(t3[r]) || Array.isArray(n3[r]))) {
      let i3 = Array.isArray(t3[r]) ? t3[r] : [], a3 = Array.isArray(n3[r]) ? n3[r] : [], s3 = _t(e3.getLeftDifferences(_t(i3, o3), _t(a3, o3))), d = _t(e3.getRightDifferences(_t(i3, o3), _t(a3, o3)));
      if (Object.keys(s3).length || Object.keys(d).length) {
        let c3 = i3.filter((U) => s3[o3 ? o3(U) : String(U)]), l3 = a3.filter((U) => d[o3 ? o3(U) : String(U)]);
        Reflect.set(t3, r, c3), Reflect.set(n3, r, l3);
      } else Reflect.deleteProperty(t3, r), Reflect.deleteProperty(n3, r);
    }
  }
  static isLeftDifferent(t3, n3, r = false) {
    return !!this.distinctKeysIterator("left", t3, n3, r).next().value;
  }
  static isRightDifferent(t3, n3, r = false) {
    return !!this.distinctKeysIterator("right", t3, n3, r).next().value;
  }
  static getLeftDifferences(t3, n3, r = false) {
    return Array.from(this.distinctKeysIterator("left", t3, n3, r));
  }
  static getRightDifferences(t3, n3, r = false) {
    return Array.from(this.distinctKeysIterator("right", t3, n3, r));
  }
  static *distinctKeysIterator(t3, n3, r, o3 = false) {
    if (n3 === r) return;
    let i3 = [];
    t3 === "left" ? i3 = Object.keys(n3) : t3 === "right" ? i3 = Object.keys(r) : t3 === "full" ? i3 = Array.from(/* @__PURE__ */ new Set([...Object.keys(n3), ...Object.keys(r)])) : Sn(t3, `Unknown distinctKeysIterator's join param "${t3}"`, true);
    for (let a3 of i3) {
      let s3 = n3[a3], d = r[a3];
      if (s3 !== d) {
        if (!o3 && typeof s3 == "object" && typeof d == "object" && s3 !== null && d !== null && Qt(s3, d)) continue;
        yield a3;
      }
    }
  }
};
var Wr = class e5 {
  constructor(t3) {
    this.delta = t3;
  }
  static calculate(t3, n3) {
    let r = Le.calculate(t3, n3, void 0, e5.postProcess);
    return new e5(r);
  }
  static empty() {
    return new e5(Le.create({}, {}));
  }
  inverse() {
    let t3 = Le.create(this.delta.inserted, this.delta.deleted);
    return new e5(t3);
  }
  applyTo(t3, n3) {
    try {
      let { selectedElementIds: r = {}, selectedGroupIds: o3 = {} } = this.delta.deleted, { selectedElementIds: i3 = {}, selectedGroupIds: a3 = {}, selectedLinearElementId: s3, editingLinearElementId: d, ...c3 } = this.delta.inserted, l3 = Le.mergeObjects(t3.selectedElementIds, i3, r), U = Le.mergeObjects(t3.selectedGroupIds, a3, o3), p = s3 && n3.has(s3) ? new z(n3.get(s3)) : null, m = d && n3.has(d) ? new z(n3.get(d)) : null, b3 = { ...t3, ...c3, selectedElementIds: l3, selectedGroupIds: U, selectedLinearElement: typeof s3 < "u" ? p : t3.selectedLinearElement, editingLinearElement: typeof d < "u" ? m : t3.editingLinearElement }, E = this.filterInvisibleChanges(t3, b3, n3);
      return [b3, E];
    } catch (r) {
      if (console.error("Couldn't apply appstate change", r), c.DEV || c.MODE === je.TEST) throw r;
      return [t3, false];
    }
  }
  isEmpty() {
    return Le.isEmpty(this.delta);
  }
  static postProcess(t3, n3) {
    try {
      Le.diffObjects(t3, n3, "selectedElementIds", (r) => true), Le.diffObjects(t3, n3, "selectedGroupIds", (r) => r ?? false);
    } catch (r) {
      if (console.error("Couldn't postprocess appstate change deltas."), c.DEV || c.MODE === je.TEST) throw r;
    } finally {
      return [t3, n3];
    }
  }
  filterInvisibleChanges(t3, n3, r) {
    let o3 = Qr(t3), i3 = Qr(n3), a3 = Le.isRightDifferent(e5.stripElementsProps(o3), e5.stripElementsProps(i3)), s3 = Le.isRightDifferent(e5.stripStandaloneProps(o3), e5.stripStandaloneProps(i3));
    if (!a3 && !s3) return false;
    let d = { value: a3 };
    if (s3) {
      let c3 = Le.getRightDifferences(e5.stripStandaloneProps(o3), e5.stripStandaloneProps(i3)), l3 = /* @__PURE__ */ new Set();
      (c3.includes("editingGroupId") || c3.includes("selectedGroupIds")) && (l3 = m2(r));
      for (let U of c3) switch (U) {
        case "selectedElementIds":
          n3[U] = e5.filterSelectedElements(n3[U], r, d);
          break;
        case "selectedGroupIds":
          n3[U] = e5.filterSelectedGroups(n3[U], l3, d);
          break;
        case "croppingElementId": {
          let E = n3[U], g = E && r.get(E);
          g && !g.isDeleted ? d.value = true : n3[U] = null;
          break;
        }
        case "editingGroupId":
          let p = n3[U];
          p ? l3.has(p) ? d.value = true : n3[U] = null : d.value = true;
          break;
        case "selectedLinearElementId":
        case "editingLinearElementId":
          let m = e5.convertToAppStateKey(U), b3 = n3[m];
          if (!b3) d.value = true;
          else {
            let E = r.get(b3.elementId);
            E && !E.isDeleted ? d.value = true : n3[m] = null;
          }
          break;
        default:
          Sn(U, `Unknown ObservedElementsAppState's key "${U}"`, true);
      }
    }
    return d.value;
  }
  static convertToAppStateKey(t3) {
    switch (t3) {
      case "selectedLinearElementId":
        return "selectedLinearElement";
      case "editingLinearElementId":
        return "editingLinearElement";
    }
  }
  static filterSelectedElements(t3, n3, r) {
    let o3 = Object.keys(t3);
    if (!o3.length) return r.value = true, t3;
    let i3 = { ...t3 };
    for (let a3 of o3) {
      let s3 = n3.get(a3);
      s3 && !s3.isDeleted ? r.value = true : delete i3[a3];
    }
    return i3;
  }
  static filterSelectedGroups(t3, n3, r) {
    if (!Object.keys(t3).length) return r.value = true, t3;
    let i3 = { ...t3 };
    for (let a3 of Object.keys(i3)) n3.has(a3) ? r.value = true : delete i3[a3];
    return i3;
  }
  static stripElementsProps(t3) {
    let { editingGroupId: n3, selectedGroupIds: r, selectedElementIds: o3, editingLinearElementId: i3, selectedLinearElementId: a3, croppingElementId: s3, ...d } = t3;
    return d;
  }
  static stripStandaloneProps(t3) {
    let { name: n3, viewBackgroundColor: r, ...o3 } = t3;
    return o3;
  }
};
var Ue = class Ue2 {
  constructor(t3, n3, r) {
    this.added = t3;
    this.removed = n3;
    this.updated = r;
  }
  static create(t3, n3, r, o3 = { shouldRedistribute: false }) {
    let i3;
    if (o3.shouldRedistribute) {
      let a3 = /* @__PURE__ */ new Map(), s3 = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map(), c3 = [...t3, ...n3, ...r];
      for (let [l3, U] of c3) this.satisfiesAddition(U) ? a3.set(l3, U) : this.satisfiesRemoval(U) ? s3.set(l3, U) : d.set(l3, U);
      i3 = new Ue2(a3, s3, d);
    } else i3 = new Ue2(t3, n3, r);
    return (c.DEV || c.MODE === je.TEST) && (Ue2.validate(i3, "added", this.satisfiesAddition), Ue2.validate(i3, "removed", this.satisfiesRemoval), Ue2.validate(i3, "updated", this.satisfiesUpdate)), i3;
  }
  static validate(t3, n3, r) {
    for (let [o3, i3] of t3[n3].entries()) if (!r(i3)) throw console.error(`Broken invariant for "${n3}" delta, element "${o3}", delta:`, i3), new Error(`ElementsChange invariant broken for element "${o3}".`);
  }
  static calculate(t3, n3) {
    if (t3 === n3) return Ue2.empty();
    let r = /* @__PURE__ */ new Map(), o3 = /* @__PURE__ */ new Map(), i3 = /* @__PURE__ */ new Map();
    for (let a3 of t3.values()) if (!n3.get(a3.id)) {
      let d = { ...a3, isDeleted: false }, c3 = { isDeleted: true }, l3 = Le.create(d, c3, Ue2.stripIrrelevantProps);
      o3.set(a3.id, l3);
    }
    for (let a3 of n3.values()) {
      let s3 = t3.get(a3.id);
      if (!s3) {
        let d = { isDeleted: true }, c3 = { ...a3, isDeleted: false }, l3 = Le.create(d, c3, Ue2.stripIrrelevantProps);
        r.set(a3.id, l3);
        continue;
      }
      if (s3.versionNonce !== a3.versionNonce) {
        let d = Le.calculate(s3, a3, Ue2.stripIrrelevantProps, Ue2.postProcess);
        if (typeof s3.isDeleted == "boolean" && typeof a3.isDeleted == "boolean" && s3.isDeleted !== a3.isDeleted) {
          s3.isDeleted && !a3.isDeleted ? r.set(a3.id, d) : o3.set(a3.id, d);
          continue;
        }
        Le.isEmpty(d) || i3.set(a3.id, d);
      }
    }
    return Ue2.create(r, o3, i3);
  }
  static empty() {
    return Ue2.create(/* @__PURE__ */ new Map(), /* @__PURE__ */ new Map(), /* @__PURE__ */ new Map());
  }
  inverse() {
    let t3 = (i3) => {
      let a3 = /* @__PURE__ */ new Map();
      for (let [s3, d] of i3.entries()) a3.set(s3, Le.create(d.inserted, d.deleted));
      return a3;
    }, n3 = t3(this.added), r = t3(this.removed), o3 = t3(this.updated);
    return Ue2.create(r, n3, o3);
  }
  isEmpty() {
    return this.added.size === 0 && this.removed.size === 0 && this.updated.size === 0;
  }
  applyLatestChanges(t3) {
    let n3 = (s3) => (d) => {
      let c3 = {};
      for (let l3 of Object.keys(d)) switch (l3) {
        case "boundElements":
          c3[l3] = d[l3];
          break;
        default:
          c3[l3] = s3[l3];
      }
      return c3;
    }, r = (s3) => {
      let d = /* @__PURE__ */ new Map();
      for (let [c3, l3] of s3.entries()) {
        let U = t3.get(c3);
        if (U) {
          let p = Le.create(l3.deleted, l3.inserted, n3(U), "inserted");
          d.set(c3, p);
        } else d.set(c3, l3);
      }
      return d;
    }, o3 = r(this.added), i3 = r(this.removed), a3 = r(this.updated);
    return Ue2.create(o3, i3, a3, { shouldRedistribute: true });
  }
  applyTo(t3, n3) {
    let r = tt(new Map(t3)), o3, i3 = { containsVisibleDifference: false, containsZindexDifference: false };
    try {
      let a3 = Ue2.createApplier(r, n3, i3), s3 = a3(this.added), d = a3(this.removed), c3 = a3(this.updated), l3 = this.resolveConflicts(t3, r);
      o3 = new Map([...s3, ...d, ...c3, ...l3]);
    } catch (a3) {
      if (console.error("Couldn't apply elements change", a3), c.DEV || c.MODE === je.TEST) throw a3;
      return [t3, true];
    }
    try {
      Ue2.redrawTextBoundingBoxes(r, o3), r = Ue2.reorderElements(r, o3, i3), Ue2.redrawBoundArrows(r, o3);
    } catch (a3) {
      if (console.error("Couldn't mutate elements after applying elements change", a3), c.DEV || c.MODE === je.TEST) throw a3;
    } finally {
      return [r, i3.containsVisibleDifference];
    }
  }
  static applyDelta(t3, n3, r = { containsVisibleDifference: true, containsZindexDifference: true }) {
    let { boundElements: o3, ...i3 } = n3.inserted;
    if (n3.deleted.boundElements?.length || n3.inserted.boundElements?.length) {
      let a3 = Le.mergeArrays(t3.boundElements, n3.inserted.boundElements, n3.deleted.boundElements, (s3) => s3.id);
      Object.assign(i3, { boundElements: a3 });
    }
    if (Ye(t3)) {
      let a3 = n3;
      (a3.deleted.crop || a3.inserted.crop) && Object.assign(i3, { crop: a3.inserted.crop ?? null });
    }
    if (!r.containsVisibleDifference) {
      let { index: a3, ...s3 } = i3, d = Ue2.checkForVisibleDifference(t3, s3);
      r.containsVisibleDifference = d;
    }
    return r.containsZindexDifference || (r.containsZindexDifference = n3.deleted.index !== n3.inserted.index), vt(t3, i3);
  }
  static checkForVisibleDifference(t3, n3) {
    return t3.isDeleted && n3.isDeleted !== false ? false : t3.isDeleted && n3.isDeleted === false || t3.isDeleted === false && n3.isDeleted ? true : Le.isRightDifferent(t3, n3);
  }
  resolveConflicts(t3, n3) {
    let r = /* @__PURE__ */ new Map(), o3 = (c3, l3) => {
      let U = n3.get(c3.id);
      if (!U) return;
      let p;
      t3.get(c3.id) === U ? p = vt(U, l3) : p = Y(U, l3), r.set(p.id, p), n3.set(p.id, p);
    };
    for (let [c3] of this.removed) Ue2.unbindAffected(t3, n3, c3, o3);
    for (let [c3] of this.added) Ue2.rebindAffected(t3, n3, c3, o3);
    for (let [c3] of Array.from(this.updated).filter(([l3, U]) => Object.keys({ ...U.deleted, ...U.inserted }).find((p) => l2.has(p)))) {
      let l3 = n3.get(c3);
      !l3 || l3.isDeleted || Ue2.rebindAffected(t3, n3, c3, o3);
    }
    let i3 = new Map(Array.from(t3).filter(([c3]) => r.has(c3))), { added: a3, removed: s3, updated: d } = Ue2.calculate(i3, r);
    for (let [c3, l3] of a3) this.added.set(c3, l3);
    for (let [c3, l3] of s3) this.removed.set(c3, l3);
    for (let [c3, l3] of d) this.updated.set(c3, l3);
    return r;
  }
  static unbindAffected(t3, n3, r, o3) {
    let i3 = () => t3.get(r), a3 = () => n3.get(r);
    rn.unbindAffected(n3, i3(), o3), rn.unbindAffected(n3, a3(), o3), on.unbindAffected(n3, i3(), o3), on.unbindAffected(n3, a3(), o3);
  }
  static rebindAffected(t3, n3, r, o3) {
    let i3 = () => t3.get(r), a3 = () => n3.get(r);
    rn.unbindAffected(n3, i3(), o3), rn.rebindAffected(n3, a3(), o3), on.unbindAffected(n3, i3(), (s3, d) => {
      k(s3) && o3(s3, d);
    }), on.rebindAffected(n3, a3(), o3);
  }
  static redrawTextBoundingBoxes(t3, n3) {
    let r = /* @__PURE__ */ new Map();
    for (let o3 of n3.values()) {
      if (Ne(o3)) {
        let { containerId: i3 } = o3, a3 = i3 ? t3.get(i3) : void 0;
        a3 && r.set(a3.id, { container: a3, boundText: o3 });
      }
      if (bn(o3)) {
        let i3 = Yt(o3), a3 = i3 ? t3.get(i3) : void 0;
        a3 && r.set(o3.id, { container: o3, boundText: a3 });
      }
    }
    for (let { container: o3, boundText: i3 } of r.values()) o3.isDeleted || i3.isDeleted || Xa(i3, o3, t3, false);
  }
  static redrawBoundArrows(t3, n3) {
    for (let r of n3.values()) !r.isDeleted && xt(r) && Jt(r, t3, { changedElements: n3 });
  }
  static reorderElements(t3, n3, r) {
    if (!r.containsZindexDifference) return t3;
    let o3 = Array.from(t3.values()), i3 = B2([...o3]), a3 = Le.getRightDifferences(o3, i3, true).reduce((s3, d) => {
      let c3 = o3[Number(d)];
      return c3 && n3.has(c3.id) && s3.set(c3.id, c3), s3;
    }, /* @__PURE__ */ new Map());
    return !r.containsVisibleDifference && a3.size && (r.containsVisibleDifference = true), te(Zr(i3, a3));
  }
  static postProcess(t3, n3) {
    try {
      Le.diffArrays(t3, n3, "boundElements", (r) => r.id);
    } catch (r) {
      if (console.error("Couldn't postprocess elements change deltas."), c.DEV || c.MODE === je.TEST) throw r;
    } finally {
      return [t3, n3];
    }
  }
  static stripIrrelevantProps(t3) {
    let { id: n3, updated: r, version: o3, versionNonce: i3, seed: a3, ...s3 } = t3;
    return s3;
  }
};
i(Ue, "satisfiesAddition", ({ deleted: t3, inserted: n3 }) => t3.isDeleted === true && !n3.isDeleted), i(Ue, "satisfiesRemoval", ({ deleted: t3, inserted: n3 }) => !t3.isDeleted && n3.isDeleted === true), i(Ue, "satisfiesUpdate", ({ deleted: t3, inserted: n3 }) => !!t3.isDeleted == !!n3.isDeleted), i(Ue, "createApplier", (t3, n3, r) => {
  let o3 = Ue.createGetter(t3, n3, r);
  return (i3) => Array.from(i3.entries()).reduce((a3, [s3, d]) => {
    let c3 = o3(s3, d.inserted);
    if (c3) {
      let l3 = Ue.applyDelta(c3, d, r);
      t3.set(l3.id, l3), a3.set(l3.id, l3);
    }
    return a3;
  }, /* @__PURE__ */ new Map());
}), i(Ue, "createGetter", (t3, n3, r) => (o3, i3) => {
  let a3 = t3.get(o3);
  return a3 || (a3 = n3.get(o3), a3 && (r.containsZindexDifference = true, (i3.isDeleted === false || i3.isDeleted !== true && a3.isDeleted === false) && (r.containsVisibleDifference = true))), a3;
});
var zr = Ue;
var hi = class {
  constructor() {
    i(this, "subscribers", []);
  }
  on(...t3) {
    let n3 = t3.flat().filter((r) => typeof r == "function");
    return this.subscribers.push(...n3), () => this.off(n3);
  }
  once(...t3) {
    let n3 = t3.flat().filter((o3) => typeof o3 == "function");
    n3.push(() => r());
    let r = this.on(...n3);
    return r;
  }
  off(...t3) {
    let n3 = t3.flat();
    this.subscribers = this.subscribers.filter((r) => !n3.includes(r));
  }
  trigger(...t3) {
    for (let n3 of this.subscribers) n3(...t3);
    return this;
  }
  clear() {
    this.subscribers = [];
  }
};
var A22 = "__observedAppState";
var Qr = (e8) => {
  let t3 = { name: e8.name, editingGroupId: e8.editingGroupId, viewBackgroundColor: e8.viewBackgroundColor, selectedElementIds: e8.selectedElementIds, selectedGroupIds: e8.selectedGroupIds, editingLinearElementId: e8.editingLinearElement?.elementId || null, selectedLinearElementId: e8.selectedLinearElement?.elementId || null, croppingElementId: e8.croppingElementId };
  return Reflect.defineProperty(t3, A22, { value: true, enumerable: false }), t3;
};
var t7 = (e8) => !!Reflect.get(e8, A22);
var dr = { IMMEDIATELY: "IMMEDIATELY", NEVER: "NEVER", EVENTUALLY: "EVENTUALLY" };
var Wa = class {
  constructor(t3, n3) {
    this.elementsChange = t3;
    this.appStateChange = n3;
  }
};
var O2 = class {
  constructor() {
    i(this, "onStoreIncrementEmitter", new hi());
    i(this, "scheduledActions", /* @__PURE__ */ new Set());
    i(this, "_snapshot", yi.empty());
    i(this, "shouldCaptureIncrement", () => {
      this.scheduleAction(dr.IMMEDIATELY);
    });
    i(this, "shouldUpdateSnapshot", () => {
      this.scheduleAction(dr.NEVER);
    });
    i(this, "scheduleAction", (t3) => {
      this.scheduledActions.add(t3), this.satisfiesScheduledActionsInvariant();
    });
    i(this, "commit", (t3, n3) => {
      try {
        this.scheduledActions.has(dr.IMMEDIATELY) ? this.captureIncrement(t3, n3) : this.scheduledActions.has(dr.NEVER) && this.updateSnapshot(t3, n3);
      } finally {
        this.satisfiesScheduledActionsInvariant(), this.scheduledActions = /* @__PURE__ */ new Set();
      }
    });
    i(this, "captureIncrement", (t3, n3) => {
      let r = this.snapshot, o3 = this.snapshot.maybeClone(t3, n3);
      if (r !== o3) {
        let i3 = o3.meta.didElementsChange ? zr.calculate(r.elements, o3.elements) : zr.empty(), a3 = o3.meta.didAppStateChange ? Wr.calculate(r.appState, o3.appState) : Wr.empty();
        (!i3.isEmpty() || !a3.isEmpty()) && this.onStoreIncrementEmitter.trigger(new Wa(i3, a3)), this.snapshot = o3;
      }
    });
    i(this, "updateSnapshot", (t3, n3) => {
      let r = this.snapshot.maybeClone(t3, n3);
      this.snapshot !== r && (this.snapshot = r);
    });
    i(this, "filterUncomittedElements", (t3, n3) => {
      for (let [r, o3] of t3.entries()) {
        if (!n3.get(r)) continue;
        let a3 = this.snapshot.elements.get(r);
        a3 ? a3.version < o3.version && n3.set(r, a3) : n3.delete(r);
      }
      return n3;
    });
    i(this, "clear", () => {
      this.snapshot = yi.empty(), this.scheduledActions = /* @__PURE__ */ new Set();
    });
    i(this, "satisfiesScheduledActionsInvariant", () => {
      if (!(this.scheduledActions.size >= 0 && this.scheduledActions.size <= 3)) {
        let t3 = `There can be at most three store actions scheduled at the same time, but there are "${this.scheduledActions.size}".`;
        if (console.error(t3, this.scheduledActions.values()), c.DEV || c.MODE === je.TEST) throw new Error(t3);
      }
    });
  }
  get snapshot() {
    return this._snapshot;
  }
  set snapshot(t3) {
    this._snapshot = t3;
  }
};
var yi = class e6 {
  constructor(t3, n3, r = { didElementsChange: false, didAppStateChange: false, isEmpty: false }) {
    this.elements = t3;
    this.appState = n3;
    this.meta = r;
  }
  static empty() {
    return new e6(/* @__PURE__ */ new Map(), Qr(mt()), { didElementsChange: false, didAppStateChange: false, isEmpty: true });
  }
  isEmpty() {
    return this.meta.isEmpty;
  }
  maybeClone(t3, n3) {
    let r = this.maybeCreateElementsSnapshot(t3), o3 = this.maybeCreateAppStateSnapshot(n3), i3 = false, a3 = false;
    return this.elements !== r && (i3 = true), this.appState !== o3 && (a3 = true), !i3 && !a3 ? this : new e6(r, o3, { didElementsChange: i3, didAppStateChange: a3 });
  }
  maybeCreateAppStateSnapshot(t3) {
    if (!t3) return this.appState;
    let n3 = t7(t3) ? t3 : Qr(t3);
    return this.detectChangedAppState(n3) ? n3 : this.appState;
  }
  detectChangedAppState(t3) {
    return !Qt(this.appState, t3, { selectedElementIds: Qt, selectedGroupIds: Qt });
  }
  maybeCreateElementsSnapshot(t3) {
    return t3 ? this.detectChangedElements(t3) ? this.createElementsSnapshot(t3) : this.elements : this.elements;
  }
  detectChangedElements(t3) {
    if (this.elements === t3) return false;
    if (this.elements.size !== t3.size) return true;
    let n3 = Array.from(t3.keys());
    for (let r = n3.length - 1; r >= 0; r--) {
      let o3 = this.elements.get(n3[r]), i3 = t3.get(n3[r]);
      if (!o3 || !i3 || o3.id !== i3.id || o3.versionNonce !== i3.versionNonce) return true;
    }
    return false;
  }
  createElementsSnapshot(t3) {
    let n3 = /* @__PURE__ */ new Map();
    for (let [r, o3] of this.elements.entries()) t3.get(r) ? n3.set(r, o3) : n3.set(r, vt(o3, { isDeleted: true }));
    for (let [r, o3] of t3.entries()) {
      let i3 = n3.get(r);
      (!i3 || i3 && i3.versionNonce !== o3.versionNonce) && n3.set(r, Gr(o3));
    }
    return n3;
  }
};
var Xt = /* @__PURE__ */ new Map();
var n7 = /^(?:http(?:s)?:\/\/)?(?:www\.)?youtu(?:be\.com|\.be)\/(embed\/|watch\?v=|shorts\/|playlist\?list=|embed\/videoseries\?list=)?([a-zA-Z0-9_-]+)(?:\?t=|&t=|\?start=|&start=)?([a-zA-Z0-9_-]+)?[^\s]*$/;
var r7 = /^(?:http(?:s)?:\/\/)?(?:(?:w){3}\.)?(?:player\.)?vimeo\.com\/(?:video\/)?([^?\s]+)(?:\?.*)?$/;
var o7 = /^https:\/\/(?:www\.)?figma\.com/;
var K22 = /^https:\/\/gist\.github\.com\/([\w_-]+)\/([\w_-]+)/;
var i7 = /^<script[\s\S]*?\ssrc=["'](https:\/\/gist\.github\.com\/.*?)\.js["']/i;
var H2 = /(?:https?:\/\/)?(?:(?:w){3}\.)?(?:twitter|x)\.com\/[^/]+\/status\/(\d+)/;
var a7 = /^<blockquote[\s\S]*?\shref=["'](https?:\/\/(?:twitter|x)\.com\/[^"']*)/i;
var s7 = /^https:\/\/(?:www\.)?val\.town\/(v|embed)\/[a-zA-Z_$][0-9a-zA-Z_$]+\.[a-zA-Z_$][0-9a-zA-Z_$]+/;
var d7 = /^<(?:iframe|blockquote)[\s\S]*?\s(?:src|href)=["']([^"']*)["'][\s\S]*?>$/i;
var J2 = /giphy.com\/(?:clips|embed|gifs)\/[a-zA-Z0-9]*?-?([a-zA-Z0-9]+)(?:[^a-zA-Z0-9]|$)/;
var Y2 = /^(?:http(?:s)?:\/\/)?(?:www\.)?reddit\.com\/r\/([a-zA-Z0-9_]+)\/comments\/([a-zA-Z0-9_]+)\/([a-zA-Z0-9_]+)\/?(?:\?[^#\s]*)?(?:#[^\s]*)?$/;
var c7 = /^<blockquote[\s\S]*?\shref=["'](https?:\/\/(?:www\.)?reddit\.com\/[^"']*)/i;
var Qa = /* @__PURE__ */ new Set(["youtube.com", "youtu.be", "vimeo.com", "player.vimeo.com", "figma.com", "link.excalidraw.com", "gist.github.com", "twitter.com", "x.com", "*.simplepdf.eu", "stackblitz.com", "val.town", "giphy.com", "reddit.com"]);
var C22 = /* @__PURE__ */ new Set(["youtube.com", "youtu.be", "vimeo.com", "player.vimeo.com", "figma.com", "twitter.com", "x.com", "*.simplepdf.eu", "stackblitz.com", "reddit.com"]);
var za = (e8) => `<html><body>${e8}</body></html>`;
var V2 = (e8) => {
  if (!e8) return null;
  if (Xt.has(e8)) return Xt.get(e8);
  let t3 = e8, n3 = C22.has(ja(e8, C22) || ""), r = "generic", o3 = { w: 560, h: 840 }, i3 = e8.match(n7);
  if (i3?.[2]) {
    let c3 = i3[3] ? `&start=${i3[3]}` : "", l3 = e8.includes("shorts");
    switch (r = "video", i3[1]) {
      case "embed/":
      case "watch?v=":
      case "shorts/":
        e8 = `https://www.youtube.com/embed/${i3[2]}?enablejsapi=1${c3}`;
        break;
      case "playlist?list=":
      case "embed/videoseries?list=":
        e8 = `https://www.youtube.com/embed/videoseries?list=${i3[2]}&enablejsapi=1${c3}`;
        break;
      default:
        e8 = `https://www.youtube.com/embed/${i3[2]}?enablejsapi=1${c3}`;
        break;
    }
    return o3 = l3 ? { w: 315, h: 560 } : { w: 560, h: 315 }, Xt.set(t3, { link: e8, intrinsicSize: o3, type: r, sandbox: { allowSameOrigin: n3 } }), { link: e8, intrinsicSize: o3, type: r, sandbox: { allowSameOrigin: n3 } };
  }
  let a3 = e8.match(r7);
  if (a3?.[1]) {
    let c3 = a3?.[1], l3 = /^\d+$/.test(c3) ? void 0 : new URIError("Invalid embed link format");
    return r = "video", e8 = `https://player.vimeo.com/video/${c3}?api=1`, o3 = { w: 560, h: 315 }, Xt.set(t3, { link: e8, intrinsicSize: o3, type: r, sandbox: { allowSameOrigin: n3 } }), { link: e8, intrinsicSize: o3, type: r, error: l3, sandbox: { allowSameOrigin: n3 } };
  }
  if (e8.match(o7)) return r = "generic", e8 = `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(e8)}`, o3 = { w: 550, h: 550 }, Xt.set(t3, { link: e8, intrinsicSize: o3, type: r, sandbox: { allowSameOrigin: n3 } }), { link: e8, intrinsicSize: o3, type: r, sandbox: { allowSameOrigin: n3 } };
  let d = e8.match(s7);
  if (d) return e8 = d[1] === "embed" ? d[0] : d[0].replace("/v", "/embed"), Xt.set(t3, { link: e8, intrinsicSize: o3, type: r, sandbox: { allowSameOrigin: n3 } }), { link: e8, intrinsicSize: o3, type: r, sandbox: { allowSameOrigin: n3 } };
  if (H2.test(e8)) {
    let c3 = e8.match(H2)[1], l3 = kn(`https://twitter.com/x/status/${c3}`), U = { type: "document", srcdoc: (p) => za(`<blockquote class="twitter-tweet" data-dnt="true" data-theme="${p}"><a href="${l3}"></a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"><\/script>`), intrinsicSize: { w: 480, h: 480 }, sandbox: { allowSameOrigin: n3 } };
    return Xt.set(t3, U), U;
  }
  if (Y2.test(e8)) {
    let [, c3, l3, U] = e8.match(Y2), p = kn(`https://reddit.com/r/${c3}/comments/${l3}/${U}`), m = { type: "document", srcdoc: (b3) => za(`<blockquote class="reddit-embed-bq" data-embed-theme="${b3}"><a href="${p}"></a><br></blockquote><script async="" src="https://embed.reddit.com/widgets.js" charset="UTF-8"><\/script>`), intrinsicSize: { w: 480, h: 480 }, sandbox: { allowSameOrigin: n3 } };
    return Xt.set(t3, m), m;
  }
  if (K22.test(e8)) {
    let [, c3, l3] = e8.match(K22), U = kn(`https://gist.github.com/${c3}/${l3}`), p = { type: "document", srcdoc: () => za(`
          <script src="${U}.js"><\/script>
          <style type="text/css">
            * { margin: 0px; }
            table, .gist { height: 100%; }
            .gist .gist-file { height: calc(100vh - 2px); padding: 0px; display: grid; grid-template-rows: 1fr auto; }
          </style>
        `), intrinsicSize: { w: 550, h: 720 }, sandbox: { allowSameOrigin: n3 } };
    return Xt.set(e8, p), p;
  }
  return Xt.set(e8, { link: e8, intrinsicSize: o3, type: r, sandbox: { allowSameOrigin: n3 } }), { link: e8, intrinsicSize: o3, type: r, sandbox: { allowSameOrigin: n3 } };
};
var Ii = (e8) => {
  let t3;
  _o(e8) ? t3 = "IFrame element" : t3 = !e8.link || e8?.link === "" ? "Empty Web-Embed" : e8.link;
  let n3 = Math.max(Math.min(e8.width / 2, e8.width / t3.length), e8.width / 30), r = Ie.Helvetica, o3 = Ee({ fontSize: n3, fontFamily: r });
  return qt({ x: e8.x + e8.width / 2, y: e8.y + e8.height / 2, strokeColor: e8.strokeColor !== "transparent" ? e8.strokeColor : "black", backgroundColor: "transparent", fontFamily: r, fontSize: n3, text: en(t3, o3, e8.width - 20), textAlign: "center", verticalAlign: kt.MIDDLE, angle: e8.angle ?? 0 });
};
var H_ = L2({ name: "setEmbeddableAsActiveTool", trackEvent: { category: "toolbar" }, target: "Tool", label: "toolBar.embeddable", perform: (e8, t3, n3, r) => {
  let o3 = $r(t3, { type: "embeddable" });
  return $2(r.canvas, { ...t3, activeTool: o3 }), { elements: e8, appState: { ...t3, activeTool: $r(t3, { type: "embeddable" }) }, captureUpdate: dr.EVENTUALLY };
} });
var ja = (e8, t3) => {
  try {
    let { hostname: n3 } = new URL(e8), r = n3.replace(/^www\./, "");
    if (t3 instanceof Set) {
      if (Qa.has(r)) return r;
      let i3 = r.replace(/^([^.]+)/, "*");
      return Qa.has(i3) ? i3 : null;
    }
    let o3 = t3.replace(/^www\./, "");
    if (r === o3) return o3;
  } catch {
  }
  return null;
};
var J_ = (e8) => {
  let t3 = e8.match(a7);
  if (t3 && t3.length === 2) return t3[1];
  let n3 = e8.match(c7);
  if (n3 && n3.length === 2) return n3[1];
  let r = e8.match(i7);
  if (r && r.length === 2) return r[1];
  if (J2.test(e8)) return `https://giphy.com/embed/${J2.exec(e8)[1]}`;
  let o3 = e8.match(d7);
  return o3 && o3.length === 2 ? o3[1] : e8;
};
var Y_ = (e8, t3) => {
  if (!e8) return false;
  if (t3 != null) if (typeof t3 == "function") {
    let n3 = t3(e8);
    if (typeof n3 == "boolean") return n3;
  } else {
    if (typeof t3 == "boolean") return t3;
    if (t3 instanceof RegExp) return t3.test(e8);
    if (Array.isArray(t3)) {
      for (let n3 of t3) if (n3 instanceof RegExp) {
        if (e8.match(n3)) return true;
      } else if (ja(e8, n3)) return true;
      return false;
    }
  }
  return !!ja(e8, Qa);
};
var jr = (e8, t3, n3) => {
  if (typeof n3 > "u") return e8.draw(t3);
  let r = { sets: t3.sets, shape: t3.shape, options: { ...t3.options, fixedDecimalPlaceDigits: n3 } };
  return e8.draw(r);
};
var eo = (e8, t3, n3, r, o3) => {
  if (!r.enabled || !r.clip) return null;
  let i3 = We(e8, o3);
  if (i3) {
    let a3 = t3.ownerDocument.createElementNS(re, "g");
    return a3.setAttributeNS(re, "clip-path", `url(#${i3.id})`), n3.forEach((s3) => a3.appendChild(s3)), a3;
  }
  return null;
};
var wi = (e8, t3, n3, r, o3, i3, a3, s3) => {
  let d = { x: i3, y: a3 }, [c3, l3, U, p] = C2(e8, t3), m = (U - c3) / 2 - (e8.x - c3), b3 = (p - l3) / 2 - (e8.y - l3);
  if (k(e8)) {
    let y = qe(e8, t3);
    if (ee2(y)) {
      let [w, I, S, v] = C2(y, t3), D = z.getBoundTextElementPosition(y, e8, t3);
      m = (S - w) / 2 - (D.x - w), b3 = (v - I) / 2 - (D.y - I), i3 = i3 + D.x - e8.x, a3 = a3 + D.y - e8.y;
    }
  }
  let E = 180 * e8.angle / Math.PI, g = r;
  if (e8.link) {
    let y = r.ownerDocument.createElementNS(re, "a");
    y.setAttribute("href", dn(e8.link)), g.appendChild(y), g = y;
  }
  let h = (y, w) => {
    Ot() && y.setAttribute("data-id", w.id), g.appendChild(y);
  }, x = (We(e8, t3)?.opacity ?? 100) * e8.opacity / 1e4;
  switch (e8.type) {
    case "selection":
      throw new Error("Selection rendering is not supported for SVG");
    case "rectangle":
    case "diamond":
    case "ellipse": {
      let y = he2.generateElementShape(e8, null), w = jr(n3, y, qn);
      x !== 1 && (w.setAttribute("stroke-opacity", `${x}`), w.setAttribute("fill-opacity", `${x}`)), w.setAttribute("stroke-linecap", "round"), w.setAttribute("transform", `translate(${i3 || 0} ${a3 || 0}) rotate(${E} ${m} ${b3})`);
      let I = eo(e8, g, [w], s3.frameRendering, t3);
      h(I || w, e8);
      break;
    }
    case "iframe":
    case "embeddable": {
      let y = he2.generateElementShape(e8, s3), w = jr(n3, y, qn), I = e8.opacity / 100;
      I !== 1 && (w.setAttribute("stroke-opacity", `${I}`), w.setAttribute("fill-opacity", `${I}`)), w.setAttribute("stroke-linecap", "round"), w.setAttribute("transform", `translate(${i3 || 0} ${a3 || 0}) rotate(${E} ${m} ${b3})`), h(w, e8);
      let S = Ii(e8);
      wi(S, t3, n3, g, o3, S.x + d.x - e8.x, S.y + d.y - e8.y, s3);
      let v = jr(n3, y, qn);
      for (v.setAttribute("stroke-linecap", "round"), v.setAttribute("transform", `translate(${i3 || 0} ${a3 || 0}) rotate(${E} ${m} ${b3})`); v.firstChild; ) v.removeChild(v.firstChild);
      let D = it(Math.min(e8.width, e8.height), e8), $3 = V2(T2(e8.link || ""));
      if (s3.renderEmbeddables === false || $3?.type === "document") {
        let N = r.ownerDocument.createElementNS(re, "a");
        N.setAttribute("href", dn(e8.link || "")), N.setAttribute("target", "_blank"), N.setAttribute("rel", "noopener noreferrer"), N.style.borderRadius = `${D}px`, v.appendChild(N);
      } else {
        let N = r.ownerDocument.createElementNS(re, "foreignObject");
        N.style.width = `${e8.width}px`, N.style.height = `${e8.height}px`, N.style.border = "none";
        let B3 = N.ownerDocument.createElementNS(re, "div");
        B3.setAttribute("xmlns", "http://www.w3.org/1999/xhtml"), B3.style.width = "100%", B3.style.height = "100%";
        let _ = B3.ownerDocument.createElement("iframe");
        _.src = $3?.link ?? "", _.style.width = "100%", _.style.height = "100%", _.style.border = "none", _.style.borderRadius = `${D}px`, _.style.top = "0", _.style.left = "0", _.allowFullscreen = true, B3.appendChild(_), N.appendChild(B3), v.appendChild(N);
      }
      h(v, e8);
      break;
    }
    case "line":
    case "arrow": {
      let y = oe(e8, t3), w = r.ownerDocument.createElementNS(re, "mask");
      if (y) {
        w.setAttribute("id", `mask-${e8.id}`);
        let D = r.ownerDocument.createElementNS(re, "rect");
        i3 = i3 || 0, a3 = a3 || 0, D.setAttribute("x", "0"), D.setAttribute("y", "0"), D.setAttribute("fill", "#fff"), D.setAttribute("width", `${e8.width + 100 + i3}`), D.setAttribute("height", `${e8.height + 100 + a3}`), w.appendChild(D);
        let $3 = r.ownerDocument.createElementNS(re, "rect"), N = z.getBoundTextElementPosition(e8, y, t3), B3 = i3 + N.x - e8.x, _ = a3 + N.y - e8.y;
        $3.setAttribute("x", B3.toString()), $3.setAttribute("y", _.toString()), $3.setAttribute("fill", "#000"), $3.setAttribute("width", `${y.width}`), $3.setAttribute("height", `${y.height}`), $3.setAttribute("opacity", "1"), w.appendChild($3);
      }
      let I = r.ownerDocument.createElementNS(re, "g");
      y && I.setAttribute("mask", `url(#mask-${e8.id})`), I.setAttribute("stroke-linecap", "round"), he2.generateElementShape(e8, s3).forEach((D) => {
        let $3 = jr(n3, D, qn);
        x !== 1 && ($3.setAttribute("stroke-opacity", `${x}`), $3.setAttribute("fill-opacity", `${x}`)), $3.setAttribute("transform", `translate(${i3 || 0} ${a3 || 0}) rotate(${E} ${m} ${b3})`), e8.type === "line" && Kt(e8.points) && e8.backgroundColor !== "transparent" && $3.setAttribute("fill-rule", "evenodd"), I.appendChild($3);
      });
      let v = eo(e8, g, [I, w], s3.frameRendering, t3);
      v ? (h(v, e8), g.appendChild(v)) : (h(I, e8), g.append(w));
      break;
    }
    case "freedraw": {
      let y = he2.generateElementShape(e8, s3), w = y ? jr(n3, y, qn) : r.ownerDocument.createElementNS(re, "g");
      x !== 1 && (w.setAttribute("stroke-opacity", `${x}`), w.setAttribute("fill-opacity", `${x}`)), w.setAttribute("transform", `translate(${i3 || 0} ${a3 || 0}) rotate(${E} ${m} ${b3})`), w.setAttribute("stroke", "none");
      let I = r.ownerDocument.createElementNS(re, "path");
      I.setAttribute("fill", e8.strokeColor), I.setAttribute("d", wa(e8)), w.appendChild(I);
      let S = eo(e8, g, [w], s3.frameRendering, t3);
      h(S || w, e8);
      break;
    }
    case "image": {
      let y = Math.round(e8.width), w = Math.round(e8.height), I = At(e8) && o3[e8.fileId];
      if (I) {
        let { reuseImages: S = true } = s3, v = `image-${I.id}`, D = e8.width, $3 = e8.height;
        e8.crop && ({ width: D, height: $3 } = er(e8), v = `image-crop-${I.id}-${X2(`${D}x${$3}`)}`), S || (v = `image-${e8.id}`);
        let N = r.querySelector(`#${v}`);
        if (!N) {
          N = r.ownerDocument.createElementNS(re, "symbol"), N.id = v;
          let j = r.ownerDocument.createElementNS(re, "image");
          j.setAttribute("href", I.dataURL), j.setAttribute("preserveAspectRatio", "none"), e8.crop || !S ? (j.setAttribute("width", `${D}`), j.setAttribute("height", `${$3}`)) : (j.setAttribute("width", "100%"), j.setAttribute("height", "100%")), N.appendChild(j), (g.querySelector("defs") || g).prepend(N);
        }
        let B3 = r.ownerDocument.createElementNS(re, "use");
        B3.setAttribute("href", `#${v}`), s3.exportWithDarkMode && I.mimeType !== H.svg && B3.setAttribute("filter", Ia);
        let _ = 0, W = 0;
        if (e8.crop) {
          let { width: j, height: ye } = er(e8);
          _ = e8.crop.x / (e8.crop.naturalWidth / j), W = e8.crop.y / (e8.crop.naturalHeight / ye);
        }
        let be = m + _, V3 = b3 + W;
        B3.setAttribute("width", `${y + _}`), B3.setAttribute("height", `${w + W}`), B3.setAttribute("opacity", `${x}`), (e8.scale[0] !== 1 || e8.scale[1] !== 1) && B3.setAttribute("transform", `translate(${be} ${V3}) scale(${e8.scale[0]} ${e8.scale[1]}) translate(${-be} ${-V3})`);
        let ce2 = r.ownerDocument.createElementNS(re, "g");
        if (e8.crop) {
          let j = r.ownerDocument.createElementNS(re, "mask");
          j.setAttribute("id", `mask-image-crop-${e8.id}`), j.setAttribute("fill", "#fff");
          let ye = r.ownerDocument.createElementNS(re, "rect");
          ye.setAttribute("x", `${_}`), ye.setAttribute("y", `${W}`), ye.setAttribute("width", `${y}`), ye.setAttribute("height", `${w}`), j.appendChild(ye), g.appendChild(j), ce2.setAttribute("mask", `url(#${j.id})`);
        }
        if (ce2.appendChild(B3), ce2.setAttribute("transform", `translate(${i3 - _} ${a3 - W}) rotate(${E} ${be} ${V3})`), e8.roundness) {
          let j = r.ownerDocument.createElementNS(re, "clipPath");
          j.id = `image-clipPath-${e8.id}`;
          let ye = r.ownerDocument.createElementNS(re, "rect"), He = it(Math.min(e8.width, e8.height), e8);
          ye.setAttribute("width", `${e8.width}`), ye.setAttribute("height", `${e8.height}`), ye.setAttribute("rx", `${He}`), ye.setAttribute("ry", `${He}`), j.appendChild(ye), h(j, e8), ce2.setAttributeNS(re, "clip-path", `url(#${j.id})`);
        }
        let J = eo(e8, g, [ce2], s3.frameRendering, t3);
        h(J || ce2, e8);
      }
      break;
    }
    case "frame":
    case "magicframe": {
      if (s3.frameRendering.enabled && s3.frameRendering.outline) {
        let y = document.createElementNS(re, "rect");
        y.setAttribute("transform", `translate(${i3 || 0} ${a3 || 0}) rotate(${E} ${m} ${b3})`), y.setAttribute("width", `${e8.width}px`), y.setAttribute("height", `${e8.height}px`), y.setAttribute("rx", Pe.radius.toString()), y.setAttribute("ry", Pe.radius.toString()), y.setAttribute("fill", "none"), y.setAttribute("stroke", Pe.strokeColor), y.setAttribute("stroke-width", Pe.strokeWidth.toString()), h(y, e8);
      }
      break;
    }
    default:
      if (k(e8)) {
        let y = r.ownerDocument.createElementNS(re, "g");
        x !== 1 && (y.setAttribute("stroke-opacity", `${x}`), y.setAttribute("fill-opacity", `${x}`)), y.setAttribute("transform", `translate(${i3 || 0} ${a3 || 0}) rotate(${E} ${m} ${b3})`);
        let w = e8.text.replace(/\r\n?/g, `
`).split(`
`), I = Zn(e8.fontSize, e8.lineHeight), S = e8.textAlign === "center" ? e8.width / 2 : e8.textAlign === "right" ? e8.width : 0, v = Go(e8.fontFamily, e8.fontSize, I), D = Po(e8.text) ? "rtl" : "ltr", $3 = e8.textAlign === "center" ? "middle" : e8.textAlign === "right" || D === "rtl" ? "end" : "start";
        for (let B3 = 0; B3 < w.length; B3++) {
          let _ = r.ownerDocument.createElementNS(re, "text");
          _.textContent = w[B3], _.setAttribute("x", `${S}`), _.setAttribute("y", `${B3 * I + v}`), _.setAttribute("font-family", ea(e8)), _.setAttribute("font-size", `${e8.fontSize}px`), _.setAttribute("fill", e8.strokeColor), _.setAttribute("text-anchor", $3), _.setAttribute("style", "white-space: pre;"), _.setAttribute("direction", D), _.setAttribute("dominant-baseline", "alphabetic"), y.appendChild(_);
        }
        let N = eo(e8, g, [y], s3.frameRendering, t3);
        h(N || y, e8);
      } else throw new Error(`Unimplemented type ${e8.type}`);
  }
};
var q2 = (e8, t3, n3, r, o3, i3) => {
  r && (e8.filter((a3) => !gt(a3)).forEach((a3) => {
    if (!a3.isDeleted) {
      if (k(a3) && a3.containerId && t3.has(a3.containerId)) return;
      try {
        wi(a3, t3, n3, r, o3, a3.x + i3.offsetX, a3.y + i3.offsetY, i3);
        let s3 = oe(a3, t3);
        s3 && wi(s3, t3, n3, r, o3, s3.x + i3.offsetX, s3.y + i3.offsetY, i3);
      } catch (s3) {
        console.error(s3);
      }
    }
  }), e8.filter((a3) => gt(a3)).forEach((a3) => {
    if (!a3.isDeleted) try {
      wi(a3, t3, n3, r, o3, a3.x + i3.offsetX, a3.y + i3.offsetY, i3);
    } catch (s3) {
      console.error(s3);
    }
  }));
};
var G22 = 500;
var Z2 = (e8) => {
  let t3 = e8.extensions?.reduce((r, o3) => (r.push(H[o3]), r), []), n3 = e8.extensions?.reduce((r, o3) => o3 === "jpg" ? r.concat(".jpg", ".jpeg") : r.concat(`.${o3}`), []);
  return n({ description: e8.description, extensions: n3, mimeTypes: t3, multiple: e8.multiple ?? false, legacySetup: (r, o3, i3) => {
    let a3 = $o(o3, G22), s3 = () => {
      d(), document.addEventListener("keyup", a3), document.addEventListener("pointerup", a3), a3();
    }, d = () => {
      if (i3.files?.length) {
        let l3 = e8.multiple ? [...i3.files] : i3.files[0];
        r(l3);
      }
    };
    requestAnimationFrame(() => {
      window.addEventListener("focus", s3);
    });
    let c3 = window.setInterval(() => {
      d();
    }, G22);
    return (l3) => {
      clearInterval(c3), a3.cancel(), window.removeEventListener("focus", s3), document.removeEventListener("keyup", a3), document.removeEventListener("pointerup", a3), l3 && (console.warn("Opening the file was canceled (legacy-fs)."), l3(new Co()));
    };
  } });
};
var es = (e8, t3) => s(e8, { fileName: `${t3.name}.${t3.extension}`, description: t3.description, extensions: [`.${t3.extension}`], mimeTypes: t3.mimeTypes }, t3.fileHandle);
var f7 = (e8, t3) => {
  let n3 = {};
  for (let r of e8) !r.isDeleted && "fileId" in r && r.fileId && t3[r.fileId] && (n3[r.fileId] = t3[r.fileId]);
  return n3;
};
var to = (e8, t3, n3, r) => {
  let o3 = { type: Ze.excalidraw, version: qi.excalidraw, source: Ci, elements: r === "local" ? Ri(e8) : j2(e8), appState: r === "local" ? Ro(t3) : ed(t3), files: r === "local" ? f7(e8, n3) : void 0 };
  return JSON.stringify(o3, null, 2);
};
var hO = async (e8, t3, n3, r = t3.name || Zs) => {
  let o3 = to(e8, t3, n3, "local"), i3 = new Blob([o3], { type: H.excalidraw });
  return { fileHandle: await es(i3, { name: r, extension: "excalidraw", description: "Excalidraw file", fileHandle: W2(t3.fileHandle) ? null : t3.fileHandle }) };
};
var yO = async (e8, t3) => {
  let n3 = await Z2({ description: "Excalidraw files" });
  return z2(await ts(n3), e8, t3, n3.handle);
};
var Q2 = (e8) => e8?.type === Ze.excalidraw && (!e8.elements || Array.isArray(e8.elements) && (!e8.appState || typeof e8.appState == "object"));
var ns = (e8) => typeof e8 == "object" && e8 && e8.type === Ze.excalidrawLibrary && (e8.version === 1 || e8.version === 2);
var p7 = (e8) => {
  let t3 = { type: Ze.excalidrawLibrary, version: qi.excalidrawLibrary, source: Ci, libraryItems: e8 };
  return JSON.stringify(t3, null, 2);
};
var IO = async (e8) => {
  let t3 = p7(e8);
  await es(new Blob([t3], { type: H.excalidrawlib }), { name: "library", extension: "excalidrawlib", description: "Excalidraw library file" });
};
var u7 = (e8) => new Promise((t3, n3) => {
  let r = new Image();
  r.onload = () => {
    t3(r);
  }, r.onerror = (o3) => {
    n3(o3);
  }, r.src = e8;
});
var ep = async ({ fileIds: e8, files: t3, imageCache: n3 }) => {
  let r = /* @__PURE__ */ new Map(), o3 = /* @__PURE__ */ new Map();
  return await Promise.all(e8.reduce((i3, a3) => {
    let s3 = t3[a3];
    return s3 && !r.has(a3) ? (r.set(a3, true), i3.concat((async () => {
      try {
        if (s3.mimeType === H.binary) throw new Error("Only images can be added to ImageCache");
        let d = u7(s3.dataURL), c3 = { image: d, mimeType: s3.mimeType };
        n3.set(a3, c3);
        let l3 = await d;
        n3.set(a3, { ...c3, image: l3 });
      } catch {
        o3.set(a3, true);
      }
    })())) : i3;
  }, [])), { imageCache: n3, updatedFiles: r, erroredFiles: o3 };
};
var tp = (e8) => e8.filter((t3) => At(t3));
var m7 = (e8) => e8?.nodeName.toLowerCase() === "svg";
var LO = (e8) => {
  let t3 = new DOMParser().parseFromString(e8, H.svg), n3 = t3.querySelector("svg");
  if (t3.querySelector("parsererror") || !m7(n3)) throw new Error("Invalid SVG");
  {
    n3.hasAttribute("xmlns") || n3.setAttribute("xmlns", re);
    let o3 = n3.getAttribute("width"), i3 = n3.getAttribute("height");
    (o3?.includes("%") || o3 === "auto") && (o3 = null), (i3?.includes("%") || i3 === "auto") && (i3 = null);
    let a3 = n3.getAttribute("viewBox");
    if (!o3 || !i3) {
      if (o3 = o3 || "50", i3 = i3 || "50", a3) {
        let s3 = a3.match(/\d+ +\d+ +(\d+(?:\.\d+)?) +(\d+(?:\.\d+)?)/);
        s3 && ([, o3, i3] = s3);
      }
      n3.setAttribute("width", o3), n3.setAttribute("height", i3);
    }
    return a3 || n3.setAttribute("viewBox", `0 0 ${o3} ${i3}`), n3.outerHTML;
  }
};
var rs = document.createElement("img");
rs.src = `data:${H.svg}, ${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1971c2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-external-link"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>')}`;
var os = document.createElement("img");
os.src = `data:${H.svg}, ${encodeURIComponent('<svg  xmlns="http://www.w3.org/2000/svg"  width="16"  height="16"  viewBox="0 0 24 24"  fill="none"  stroke="#1971c2"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-big-right-line"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 9v-3.586a1 1 0 0 1 1.707 -.707l6.586 6.586a1 1 0 0 1 0 1.414l-6.586 6.586a1 1 0 0 1 -1.707 -.707v-3.586h-6v-6h6z" /><path d="M3 9v6" /></svg>')}`;
var is = ([e8, t3, n3, r], o3, i3) => {
  let a3 = H1, s3 = a3 / i3.zoom.value, d = a3 / i3.zoom.value, c3 = a3 / i3.zoom.value, l3 = (e8 + n3) / 2, U = (t3 + r) / 2, p = (a3 - 8) / (2 * i3.zoom.value), m = 4 / i3.zoom.value, b3 = n3 + m - p, E = t3 - m - c3 + p, [g, h] = T(u(b3 + s3 / 2, E + d / 2), u(l3, U), o3);
  return [g - s3 / 2, h - d / 2, s3, d];
};
var b7 = (e8, t3, n3, [r, o3]) => {
  let i3 = 4 / n3.zoom.value, [a3, s3, d, c3] = C2(e8, t3), [l3, U, p, m] = is([a3, s3, d, c3], e8.angle, n3);
  return r > l3 - i3 && r < l3 + i3 + p && o3 > U - i3 && o3 < U + m + i3;
};
var BO = (e8, t3, n3, [r, o3], i3) => !e8.link || n3.selectedElementIds[e8.id] ? false : !i3 && n3.viewModeEnabled && ba(r, o3, e8, t3) ? true : b7(e8, t3, n3, u(r, o3));
var KO = (e8, t3, n3, r, o3 = true) => {
  e8.beginPath(), e8.arc(t3, n3, r, 0, Math.PI * 2), e8.fill(), o3 && e8.stroke();
};
var np = (e8, t3) => [e8.width / t3, e8.height / t3];
var rp = ({ canvas: e8, scale: t3, normalizedWidth: n3, normalizedHeight: r, theme: o3, isExporting: i3, viewBackgroundColor: a3 }) => {
  let s3 = e8.getContext("2d");
  return s3.setTransform(1, 0, 0, 1, 0, 0), s3.scale(t3, t3), i3 && o3 === ke.DARK && (s3.filter = Io), typeof a3 == "string" ? ((a3 === "transparent" || a3.length === 5 || a3.length === 9 || /(hsla|rgba)\(/.test(a3)) && s3.clearRect(0, 0, n3, r), s3.save(), s3.fillStyle = a3, s3.fillRect(0, 0, n3, r), s3.restore()) : s3.clearRect(0, 0, n3, r), s3;
};
var qO = (e8, t3) => {
  let n3 = window.location.href;
  try {
    let r = new URL(n3);
    return r.searchParams.set(gr, e8), dn(r.toString());
  } catch (r) {
    console.error(r);
  }
  return dn(n3);
};
var XO = (e8, t3) => {
  if (e8.length > 0 && E7(e8)) {
    if (e8.length === 1) return { id: e8[0].id, type: "element" };
    if (e8.length > 1) {
      let n3 = Object.keys(t3.selectedGroupIds)[0];
      return n3 ? { id: n3, type: "group" } : { id: e8[0].groupIds[0], type: "group" };
    }
  }
  return null;
};
var E7 = (e8) => !!(e8.length === 1 || e8.length > 1 && b2(e8));
var op = (e8) => {
  try {
    let t3 = new URL(e8);
    return t3.searchParams.has(gr) && t3.host === window.location.host;
  } catch {
    return false;
  }
};
var GO = (e8) => {
  try {
    let { searchParams: t3 } = new URL(e8);
    if (t3.has(gr)) return t3.get(gr);
  } catch {
  }
  return null;
};
var Ti = { Bold: "#dddddd", Regular: "#e5e5e5" };
var g7 = (e8, t3, n3, r, o3, i3, a3, s3) => {
  let d = r % t3 - t3, c3 = o3 % t3 - t3, l3 = t3 * i3.value, U = 1 / i3.value;
  e8.save(), i3.value === 1 && e8.translate(d % 1 ? 0 : 0.5, c3 % 1 ? 0 : 0.5);
  for (let p = d; p < d + a3 + t3 * 2; p += t3) {
    let m = n3 > 1 && Math.round(p - r) % (n3 * t3) === 0;
    if (!m && l3 < 10) continue;
    let b3 = Math.min(1 / i3.value, m ? 4 : 1);
    e8.lineWidth = b3;
    let E = [b3 * 3, U + (b3 + U)];
    e8.beginPath(), e8.setLineDash(m ? [] : E), e8.strokeStyle = m ? Ti.Bold : Ti.Regular, e8.moveTo(p, c3 - t3), e8.lineTo(p, Math.ceil(c3 + s3 + t3 * 2)), e8.stroke();
  }
  for (let p = c3; p < c3 + s3 + t3 * 2; p += t3) {
    let m = n3 > 1 && Math.round(p - o3) % (n3 * t3) === 0;
    if (!m && l3 < 10) continue;
    let b3 = Math.min(1 / i3.value, m ? 4 : 1);
    e8.lineWidth = b3;
    let E = [b3 * 3, U + (b3 + U)];
    e8.beginPath(), e8.setLineDash(m ? [] : E), e8.strokeStyle = m ? Ti.Bold : Ti.Regular, e8.moveTo(d - t3, p), e8.lineTo(Math.ceil(d + a3 + t3 * 2), p), e8.stroke();
  }
  e8.restore();
};
var ip = (e8, t3, n3, r) => {
  t3.translate(e8.x + r.scrollX, e8.y + r.scrollY), t3.beginPath(), t3.roundRect ? t3.roundRect(0, 0, e8.width, e8.height, Pe.radius / r.zoom.value) : t3.rect(0, 0, e8.width, e8.height), t3.clip(), t3.translate(-(e8.x + r.scrollX), -(e8.y + r.scrollY));
};
var ap = { regularLink: null, elementLink: null };
var sp = (e8, t3, n3, r) => {
  if (e8.link && !n3.selectedElementIds[e8.id]) {
    let [o3, i3, a3, s3] = C2(e8, r), [d, c3, l3, U] = is([o3, i3, a3, s3], e8.angle, n3), p = d + l3 / 2, m = c3 + U / 2;
    t3.save(), t3.translate(n3.scrollX + p, n3.scrollY + m), t3.rotate(e8.angle);
    let b3 = op(e8.link) ? "elementLink" : "regularLink", E = ap[b3];
    if (!E || E.zoom !== n3.zoom.value) {
      E = Object.assign(document.createElement("canvas"), { zoom: n3.zoom.value }), E.width = l3 * window.devicePixelRatio * n3.zoom.value, E.height = U * window.devicePixelRatio * n3.zoom.value, ap[b3] = E;
      let g = E.getContext("2d");
      g.scale(window.devicePixelRatio * n3.zoom.value, window.devicePixelRatio * n3.zoom.value), g.fillStyle = "#fff", g.fillRect(0, 0, l3, U), b3 === "elementLink" ? g.drawImage(os, 0, 0, l3, U) : g.drawImage(rs, 0, 0, l3, U), g.restore();
    }
    t3.drawImage(E, d - p, c3 - m, l3, U), t3.restore();
  }
};
var dp = ({ canvas: e8, rc: t3, elementsMap: n3, allElementsMap: r, visibleElements: o3, scale: i3, appState: a3, renderConfig: s3 }) => {
  if (e8 === null) return;
  let { renderGrid: d = true, isExporting: c3 } = s3, [l3, U] = np(e8, i3), p = rp({ canvas: e8, scale: i3, normalizedWidth: l3, normalizedHeight: U, theme: a3.theme, isExporting: c3, viewBackgroundColor: a3.viewBackgroundColor });
  p.scale(a3.zoom.value, a3.zoom.value), d && g7(p, a3.gridSize, a3.gridStep, a3.scrollX, a3.scrollY, a3.zoom, l3 / a3.zoom.value, U / a3.zoom.value);
  let m = /* @__PURE__ */ new Set();
  o3.forEach((E) => {
    E.groupIds.length > 0 && a3.frameToHighlight && a3.selectedElementIds[E.id] && (hn(E, a3.frameToHighlight, n3) || E.groupIds.find((g) => m.has(g))) && E.groupIds.forEach((g) => m.add(g));
  });
  let b3 = /* @__PURE__ */ new Map();
  o3.filter((E) => !gt(E)).forEach((E) => {
    try {
      let g = E.frameId || a3.frameToHighlight?.id;
      if (k(E) && E.containerId && n3.has(E.containerId)) return;
      if (p.save(), g && a3.frameRendering.enabled && a3.frameRendering.clip) {
        let x = Mi(E, n3, a3);
        x && as(E, x, a3, n3, b3) && ip(x, p, s3, a3), Fn(E, n3, r, t3, p, s3, a3);
      } else Fn(E, n3, r, t3, p, s3, a3);
      let h = oe(E, n3);
      h && Fn(h, n3, r, t3, p, s3, a3), p.restore(), c3 || sp(E, p, a3, n3);
    } catch (g) {
      console.error(g, E.id, E.x, E.y, E.width, E.height);
    }
  }), o3.filter((E) => gt(E)).forEach((E) => {
    try {
      let g = () => {
        if (Fn(E, n3, r, t3, p, s3, a3), gt(E) && (c3 || Bo(E) && s3.embedsValidationStatus.get(E.id) !== true) && E.width && E.height) {
          let x = Ii(E);
          Fn(x, n3, r, t3, p, s3, a3);
        }
        c3 || sp(E, p, a3, n3);
      };
      if ((E.frameId || a3.frameToHighlight?.id) && a3.frameRendering.enabled && a3.frameRendering.clip) {
        p.save();
        let x = Mi(E, n3, a3);
        x && as(E, x, a3, n3, b3) && ip(x, p, s3, a3), g(), p.restore();
      } else g();
    } catch (g) {
      console.error(g);
    }
  }), s3.pendingFlowchartNodes?.forEach((E) => {
    try {
      Fn(E, n3, r, t3, p, s3, a3);
    } catch (g) {
      console.error(g);
    }
  });
};
var x7 = pd((e8) => {
  dp(e8);
}, { trailing: true });
var cp = (e8, t3) => {
  if (t3) {
    x7(e8);
    return;
  }
  dp(e8);
};
var h7 = (e8, t3) => {
  if (e8.width <= t3) return e8;
  let r = document.createElement("canvas").getContext("2d");
  r.font = Ee({ fontFamily: e8.fontFamily, fontSize: e8.fontSize });
  let o3 = e8.text;
  if (r.measureText(o3).width > t3) for (let a3 = o3.length; a3 > 0; a3--) {
    let s3 = `${o3.slice(0, a3)}...`;
    if (r.measureText(s3).width <= t3) {
      o3 = s3;
      break;
    }
  }
  return vt(e8, { text: o3, width: t3 });
};
var y7 = (e8, t3) => {
  let n3 = [];
  for (let r of e8) {
    if (de2(r)) {
      let o3 = qt({ x: r.x, y: r.y - Pe.nameOffsetY, fontFamily: Ie.Helvetica, fontSize: Pe.nameFontSize, lineHeight: Pe.nameLineHeight, strokeColor: t3.exportWithDarkMode ? Pe.nameColorDarkTheme : Pe.nameColorLightTheme, text: bp(r) });
      o3.y -= o3.height, o3 = h7(o3, r.width), n3.push(o3);
    }
    n3.push(r);
  }
  return n3;
};
var Up = (e8, t3) => (t3 = t3 || mt().frameRendering, { enabled: e8 ? true : t3.enabled, outline: e8 ? false : t3.outline, name: e8 ? false : t3.name, clip: e8 ? true : t3.clip });
var fp = ({ elements: e8, exportingFrame: t3, frameRendering: n3, exportWithDarkMode: r }) => {
  let o3;
  return t3 ? o3 = Ep(e8, t3) : n3.enabled && n3.name ? o3 = y7(e8, { exportWithDarkMode: r }) : o3 = e8, o3;
};
var pp = async (e8, t3, n3, { exportBackground: r, exportPadding: o3 = Vi, viewBackgroundColor: i3, exportingFrame: a3 }, s3 = (c3, l3) => {
  let U = document.createElement("canvas");
  return U.width = c3 * t3.exportScale, U.height = l3 * t3.exportScale, { canvas: U, scale: t3.exportScale };
}, d = async () => {
  await Nn.loadElementsFonts(e8);
}) => {
  await d();
  let c3 = Up(a3 ?? null, t3.frameRendering ?? null);
  a3 && (c3.clip = false);
  let l3 = fp({ elements: e8, exportingFrame: a3, exportWithDarkMode: t3.exportWithDarkMode, frameRendering: c3 });
  a3 && (o3 = 0);
  let [U, p, m, b3] = ss(a3 ? [a3] : cs(l3), o3), { canvas: E, scale: g = 1 } = s3(m, b3), h = mt(), { imageCache: x } = await ep({ imageCache: /* @__PURE__ */ new Map(), fileIds: tp(l3).map((y) => y.fileId), files: n3 });
  return cp({ canvas: E, rc: rough_default.canvas(E), elementsMap: tt(te(l3)), allElementsMap: tt(te(An(e8))), visibleElements: l3, scale: g, appState: { ...t3, frameRendering: c3, viewBackgroundColor: r ? i3 : null, scrollX: -U + o3, scrollY: -p + o3, zoom: h.zoom, shouldCacheIgnoreZoom: false, theme: t3.exportWithDarkMode ? ke.DARK : ke.LIGHT }, renderConfig: { canvasBackgroundColor: i3, imageCache: x, renderGrid: false, isExporting: true, embedsValidationStatus: /* @__PURE__ */ new Map(), elementsPendingErasure: /* @__PURE__ */ new Set(), pendingFlowchartNodes: null } }), E;
};
var no = (e8) => document.createComment(` ${e8} `);
var up = async (e8, t3, n3, r) => {
  let o3 = Up(r?.exportingFrame ?? null, t3.frameRendering ?? null), { exportPadding: i3 = Vi, exportWithDarkMode: a3 = false, viewBackgroundColor: s3, exportScale: d = 1, exportEmbedScene: c3 } = t3, { exportingFrame: l3 = null } = r || {}, U = fp({ elements: e8, exportingFrame: l3, exportWithDarkMode: a3, frameRendering: o3 });
  l3 && (i3 = 0);
  let [p, m, b3, E] = ss(l3 ? [l3] : cs(U), i3), g = -p + i3, h = -m + i3, x = document.createElementNS(re, "svg");
  x.setAttribute("version", "1.1"), x.setAttribute("xmlns", re), x.setAttribute("viewBox", `0 0 ${b3} ${E}`), x.setAttribute("width", `${b3 * d}`), x.setAttribute("height", `${E * d}`), a3 && x.setAttribute("filter", Io);
  let y = x.ownerDocument.createElementNS(re, "defs"), w = x.ownerDocument.createElementNS(re, "metadata");
  if (x.appendChild(no("svg-source:excalidraw")), x.appendChild(w), x.appendChild(y), c3) try {
    I7({ metadataElement: w, payload: to(e8, t3, n3 || {}, "local") });
  } catch (B3) {
    console.error(B3);
  }
  let I = ds(e8);
  if (I.length) {
    let B3 = te(e8);
    for (let _ of I) {
      let W = x.ownerDocument.createElementNS(re, "clipPath");
      W.setAttribute("id", _.id);
      let [be, V3, ce2, J] = C2(_, B3), j = (ce2 - be) / 2 - (_.x - be), ye = (J - V3) / 2 - (_.y - V3), He = x.ownerDocument.createElementNS(re, "rect");
      He.setAttribute("transform", `translate(${_.x + g} ${_.y + h}) rotate(${_.angle} ${j} ${ye})`), He.setAttribute("width", `${_.width}`), He.setAttribute("height", `${_.height}`), l3 || (He.setAttribute("rx", `${Pe.radius}`), He.setAttribute("ry", `${Pe.radius}`)), W.appendChild(He), y.appendChild(W);
    }
  }
  let S = r?.skipInliningFonts ? [] : await Nn.generateFontFaceDeclarations(e8), v = `
      `, D = x.ownerDocument.createElementNS(re, "style");
  if (D.classList.add("style-fonts"), D.appendChild(document.createTextNode(`${v}${S.join(v)}`)), y.appendChild(D), t3.exportBackground && s3) {
    let B3 = x.ownerDocument.createElementNS(re, "rect");
    B3.setAttribute("x", "0"), B3.setAttribute("y", "0"), B3.setAttribute("width", `${b3}`), B3.setAttribute("height", `${E}`), B3.setAttribute("fill", s3), x.appendChild(B3);
  }
  let $3 = rough_default.svg(x), N = r?.renderEmbeddables ?? false;
  return q2(U, tt(te(U)), $3, x, n3 || {}, { offsetX: g, offsetY: h, isExporting: true, exportWithDarkMode: a3, renderEmbeddables: N, frameRendering: o3, canvasBackgroundColor: s3, embedsValidationStatus: N ? new Map(U.filter((B3) => de2(B3)).map((B3) => [B3.id, true])) : /* @__PURE__ */ new Map(), reuseImages: r?.reuseImages ?? true }), x;
};
var I7 = ({ payload: e8, metadataElement: t3 }) => {
  let n3 = Li(JSON.stringify(Si({ text: e8 })), true);
  t3.appendChild(no(`payload-type:${H.excalidraw}`)), t3.appendChild(no("payload-version:2")), t3.appendChild(no("payload-start")), t3.appendChild(document.createTextNode(n3)), t3.appendChild(no("payload-end"));
};
var mp = ({ svg: e8 }) => {
  if (e8.includes(`payload-type:${H.excalidraw}`)) {
    let t3 = e8.match(/<!-- payload-start -->\s*(.+?)\s*<!-- payload-end -->/);
    if (!t3) throw new Error("INVALID");
    let o3 = (e8.match(/<!-- payload-version:(\d+) -->/)?.[1] || "1") !== "1";
    try {
      let i3 = Di(t3[1], o3), a3 = JSON.parse(i3);
      if (!("encoded" in a3)) {
        if ("type" in a3 && a3.type === Ze.excalidraw) return i3;
        throw new Error("FAILED");
      }
      return vi(a3);
    } catch (i3) {
      throw console.error(i3), new Error("FAILED");
    }
  }
  throw new Error("INVALID");
};
var ss = (e8, t3) => {
  let [n3, r, o3, i3] = $e(e8), a3 = dt(n3, o3) + t3 * 2, s3 = dt(r, i3) + t3 * 2;
  return [n3, r, a3, s3];
};
var TA = (e8, t3, n3) => {
  let [, , r, o3] = ss(e8, t3).map((i3) => Math.trunc(i3 * n3));
  return [r, o3];
};
var ro = class {
  constructor(t3) {
    this.scoreFunction = t3;
    i(this, "content", []);
  }
  sinkDown(t3) {
    let n3 = this.content[t3];
    for (; t3 > 0; ) {
      let r = (t3 + 1 >> 1) - 1, o3 = this.content[r];
      if (this.scoreFunction(n3) < this.scoreFunction(o3)) this.content[r] = n3, this.content[t3] = o3, t3 = r;
      else break;
    }
  }
  bubbleUp(t3) {
    let n3 = this.content.length, r = this.content[t3], o3 = this.scoreFunction(r);
    for (; ; ) {
      let i3 = t3 + 1 << 1, a3 = i3 - 1, s3 = null, d = 0;
      if (a3 < n3) {
        let c3 = this.content[a3];
        d = this.scoreFunction(c3), d < o3 && (s3 = a3);
      }
      if (i3 < n3) {
        let c3 = this.content[i3];
        this.scoreFunction(c3) < (s3 === null ? o3 : d) && (s3 = i3);
      }
      if (s3 !== null) this.content[t3] = this.content[s3], this.content[s3] = r, t3 = s3;
      else break;
    }
  }
  push(t3) {
    this.content.push(t3), this.sinkDown(this.content.length - 1);
  }
  pop() {
    if (this.content.length === 0) return null;
    let t3 = this.content[0], n3 = this.content.pop();
    return this.content.length > 0 && (this.content[0] = n3, this.bubbleUp(0)), t3;
  }
  remove(t3) {
    if (this.content.length === 0) return;
    let n3 = this.content.indexOf(t3), r = this.content.pop();
    n3 < this.content.length && (this.content[n3] = r, this.scoreFunction(r) < this.scoreFunction(t3) ? this.sinkDown(n3) : this.bubbleUp(n3));
  }
  size() {
    return this.content.length;
  }
  rescoreElement(t3) {
    this.sinkDown(this.content.indexOf(t3));
  }
};
var Us = 1;
var pe2 = 40;
var w7 = (e8, t3) => {
  let n3 = e8.fixedSegments ? e8.fixedSegments.slice() : null;
  if (n3) {
    let r = [];
    e8.points.map((a3) => u(e8.x + a3[0], e8.y + a3[1])).forEach((a3, s3, d) => {
      if (s3 < 2) return r.push(a3);
      let c3 = tr(a3, d[s3 - 1]), l3 = tr(d[s3 - 1], d[s3 - 2]);
      if (ve(c3, l3)) {
        let U = n3?.findIndex((m) => m.index === s3 - 1) ?? -1, p = n3?.findIndex((m) => m.index === s3) ?? -1;
        p !== -1 && (n3[p].start = u(d[s3 - 2][0] - e8.x, d[s3 - 2][1] - e8.y)), U !== -1 && n3.splice(U, 1), r.splice(-1, 1), n3.forEach((m) => {
          m.index > s3 - 1 && (m.index -= 1);
        });
      }
      return r.push(a3);
    });
    let o3 = [];
    r.forEach((a3, s3, d) => {
      if (s3 < 3) return o3.push(a3);
      if (ie2(d[s3 - 2], d[s3 - 1]) < Us) {
        let c3 = n3?.findIndex((p) => p.index === s3 - 2) ?? -1, l3 = n3?.findIndex((p) => p.index === s3 - 1) ?? -1;
        l3 !== -1 && n3.splice(l3, 1), c3 !== -1 && n3.splice(c3, 1), o3.splice(-2, 2), n3.forEach((p) => {
          p.index > s3 - 2 && (p.index -= 2);
        });
        let U = Mt(a3, d[s3 - 1]);
        return o3.push(u(U ? a3[0] : d[s3 - 2][0], U ? d[s3 - 2][1] : a3[1]));
      }
      o3.push(a3);
    });
    let i3 = n3.filter((a3) => a3.index !== 1 && a3.index !== o3.length - 1);
    return i3.length === 0 ? In(us(ms(ps(e8, fs(e8, t3, o3.map((a3) => u(a3[0] - e8.x, a3[1] - e8.y)), e8.startBinding && cr(e8.startBinding.elementId, t3), e8.endBinding && cr(e8.endBinding.elementId, t3))) ?? [])), i3, null, null) : (c.DEV && Ae(Ni(o3), "Invalid elbow points with fixed segments"), In(o3, i3, e8.startIsSpecial, e8.endIsSpecial));
  }
  return { x: e8.x, y: e8.y, points: e8.points, fixedSegments: e8.fixedSegments, startIsSpecial: e8.startIsSpecial, endIsSpecial: e8.endIsSpecial };
};
var R7 = (e8, t3, n3) => {
  let r = t3.map(($3) => $3.index), i3 = (e8.fixedSegments?.map(($3) => $3.index) ?? []).findIndex(($3) => !r.includes($3));
  if (i3 === -1 || !e8.fixedSegments?.[i3]) return { points: e8.points };
  let a3 = e8.fixedSegments[i3].index, s3 = e8.fixedSegments[i3 - 1], d = e8.fixedSegments[i3 + 1], c3 = e8.x + (s3 ? s3.end[0] : 0), l3 = e8.y + (s3 ? s3.end[1] : 0), U = s3 ? null : e8.startBinding, p = d ? null : e8.endBinding, { startHeading: m, endHeading: b3, startGlobalPoint: E, endGlobalPoint: g, hoveredStartElement: h, hoveredEndElement: x, ...y } = fs({ x: c3, y: l3, startBinding: U, endBinding: p, startArrowhead: null, endArrowhead: null, points: e8.points }, n3, [u(0, 0), u(e8.x + (d?.start[0] ?? e8.points[e8.points.length - 1][0]) - c3, e8.y + (d?.start[1] ?? e8.points[e8.points.length - 1][1]) - l3)], U && cr(U.elementId, n3), p && cr(p.elementId, n3), { isDragging: false }), { points: w } = In(us(ms(ps(e8, { startHeading: m, endHeading: b3, startGlobalPoint: E, endGlobalPoint: g, hoveredStartElement: h, hoveredEndElement: x, ...y }) ?? [])), t3, null, null), I = [];
  if (s3) for (let $3 = 0; $3 < s3.index; $3++) I.push(u(e8.x + e8.points[$3][0], e8.y + e8.points[$3][1]));
  if (w.forEach(($3) => {
    I.push(u(e8.x + (s3 ? s3.end[0] : 0) + $3[0], e8.y + (s3 ? s3.end[1] : 0) + $3[1]));
  }), d) for (let $3 = d.index; $3 < e8.points.length; $3++) I.push(u(e8.x + e8.points[$3][0], e8.y + e8.points[$3][1]));
  let S = (d?.index ?? e8.points.length) - (s3?.index ?? 0) - 1, v = t3.map(($3) => $3.index > a3 ? { ...$3, index: $3.index - S + (w.length - 1) } : $3), D = I.flatMap(($3, N) => {
    let B3 = I[N - 1], _ = I[N + 1];
    if (B3 && _) {
      let W = tr($3, B3), be = tr(_, $3);
      if (ve(W, be)) return v.forEach((V3) => {
        V3.index > N && (V3.index -= 1);
      }), [];
      if (ve(W, Ma(be))) return v.forEach((V3) => {
        V3.index > N && (V3.index += 1);
      }), [$3, $3];
    }
    return [$3];
  });
  return In(D, v, false, false);
};
var T7 = (e8, t3, n3, r, o3, i3) => {
  let a3 = t3.map((I, S) => e8.fixedSegments == null || e8.fixedSegments[S] === void 0 || e8.fixedSegments[S].index !== I.index || (I.start[0] !== e8.fixedSegments[S].start[0] && I.end[0] !== e8.fixedSegments[S].end[0]) != (I.start[1] !== e8.fixedSegments[S].start[1] && I.end[1] !== e8.fixedSegments[S].end[1]) ? S : null).filter((I) => I !== null).shift();
  if (a3 == null) return { points: e8.points };
  let s3 = e8.fixedSegments?.findIndex((I) => I.index === 1) ?? -1, d = e8.fixedSegments?.findIndex((I) => I.index === e8.points.length - 1) ?? -1, c3 = ie2(t3[a3].start, t3[a3].end), l3 = c3 < pe2 + 5;
  if (s3 === -1 && t3[a3].index === 1 && o3) {
    let I = Lt(n3), v = (I ? ve(n3, Re) : ve(n3, Fe)) ? l3 ? c3 / 2 : pe2 : l3 ? -c3 / 2 : -pe2;
    t3[a3].start = u(t3[a3].start[0] + (I ? v : 0), t3[a3].start[1] + (I ? 0 : v));
  }
  if (d === -1 && t3[a3].index === e8.points.length - 1 && i3) {
    let I = Lt(r), v = (I ? ve(r, Re) : ve(r, Fe)) ? l3 ? c3 / 2 : pe2 : l3 ? -c3 / 2 : -pe2;
    t3[a3].end = u(t3[a3].end[0] + (I ? v : 0), t3[a3].end[1] + (I ? 0 : v));
  }
  let U = t3.map((I) => ({ ...I, start: u(e8.x + I.start[0], e8.y + I.start[1]), end: u(e8.x + I.end[0], e8.y + I.end[1]) })), p = e8.points.map((I, S) => u(e8.x + I[0], e8.y + I[1])), m = U[a3].index - 1, b3 = U[a3].index, E = U[a3].start, g = U[a3].end, h = p[m - 1] && !_e(p[m], p[m - 1]) ? Mt(p[m - 1], p[m]) : void 0, x = p[b3 + 1] && !_e(p[b3], p[b3 + 1]) ? Mt(p[b3 + 1], p[b3]) : void 0;
  if (h !== void 0) {
    let I = h ? 1 : 0;
    p[m - 1][I] = E[I];
  }
  if (p[m] = E, p[b3] = g, x !== void 0) {
    let I = x ? 1 : 0;
    p[b3 + 1][I] = g[I];
  }
  let y = U.findIndex((I) => I.index === m);
  if (y !== -1) {
    let I = Mt(U[y].end, U[y].start) ? 1 : 0;
    U[y].start[I] = E[I], U[y].end = E;
  }
  let w = U.findIndex((I) => I.index === b3 + 1);
  if (w !== -1) {
    let I = Mt(U[w].end, U[w].start) ? 1 : 0;
    U[w].end[I] = g[I], U[w].start = g;
  }
  if (s3 === -1 && m === 0) {
    let I = o3 ? Lt(n3) : Mt(p[1], p[0]);
    p.unshift(u(I ? E[0] : e8.x + e8.points[0][0], I ? e8.y + e8.points[0][1] : E[1])), o3 && p.unshift(u(e8.x + e8.points[0][0], e8.y + e8.points[0][1]));
    for (let S of U) S.index += o3 ? 2 : 1;
  }
  if (d === -1 && b3 === e8.points.length - 1) {
    let I = Lt(r);
    p.push(u(I ? g[0] : e8.x + e8.points[e8.points.length - 1][0], I ? e8.y + e8.points[e8.points.length - 1][1] : g[1])), i3 && p.push(u(e8.x + e8.points[e8.points.length - 1][0], e8.y + e8.points[e8.points.length - 1][1]));
  }
  return In(p, U.map((I) => ({ ...I, start: u(I.start[0] - e8.x, I.start[1] - e8.y), end: u(I.end[0] - e8.x, I.end[1] - e8.y) })), false, false);
};
var M7 = (e8, t3, n3, r, o3, i3, a3, s3, d) => {
  let c3 = e8.startIsSpecial ?? null, l3 = e8.endIsSpecial ?? null, U = t3.map((g, h) => h === 0 ? u(e8.x + g[0], e8.y + g[1]) : h === t3.length - 1 ? u(e8.x + g[0], e8.y + g[1]) : u(e8.x + e8.points[h][0], e8.y + e8.points[h][1])), p = n3.map((g) => ({ ...g, start: u(e8.x + (g.start[0] - t3[0][0]), e8.y + (g.start[1] - t3[0][1])), end: u(e8.x + (g.end[0] - t3[0][0]), e8.y + (g.end[1] - t3[0][1])) })), m = [], b3 = 2 + (c3 ? 1 : 0), E = 2 + (l3 ? 1 : 0);
  for (; m.length + b3 < U.length - E; ) m.push(U[m.length + b3]);
  {
    let g = U[c3 ? 2 : 1], h = U[c3 ? 3 : 2], x = Lt(r), y = Lt(Ht(O(g, h)));
    if (s3 && x === y) {
      let w = x ? ve(r, Re) : ve(r, Fe);
      if (m.unshift(u(y ? i3[0] + (w ? pe2 : -pe2) : h[0], y ? h[1] : i3[1] + (w ? pe2 : -pe2))), m.unshift(u(x ? i3[0] + (w ? pe2 : -pe2) : i3[0], x ? i3[1] : i3[1] + (w ? pe2 : -pe2))), !c3) {
        c3 = true;
        for (let I of p) I.index > 1 && (I.index += 1);
      }
    } else if (m.unshift(u(y ? i3[0] : g[0], y ? g[1] : i3[1])), c3) {
      c3 = false;
      for (let w of p) w.index > 1 && (w.index -= 1);
    }
    m.unshift(i3);
  }
  {
    let g = U[U.length - (l3 ? 3 : 2)], h = U[U.length - (l3 ? 4 : 3)], x = Lt(o3), y = Mt(h, g);
    if (d && x === y) {
      let w = x ? ve(o3, Re) : ve(o3, Fe);
      m.push(u(y ? a3[0] + (w ? pe2 : -pe2) : h[0], y ? h[1] : a3[1] + (w ? pe2 : -pe2))), m.push(u(x ? a3[0] + (w ? pe2 : -pe2) : a3[0], x ? a3[1] : a3[1] + (w ? pe2 : -pe2))), l3 || (l3 = true);
    } else m.push(u(y ? a3[0] : g[0], y ? g[1] : a3[1])), l3 && (l3 = false);
  }
  return m.push(a3), In(m, p.map(({ index: g }) => ({ index: g, start: m[g - 1], end: m[g] })).map((g) => ({ ...g, start: u(g.start[0] - i3[0], g.start[1] - i3[1]), end: u(g.end[0] - i3[0], g.end[1] - i3[1]) })), c3, l3);
};
var ge2 = 1e6;
var Pi = (e8, t3, n3, r) => {
  if (e8.points.length < 2) return { points: n3.points ?? e8.points };
  (e8.x < -ge2 || e8.x > ge2 || e8.y < -ge2 || e8.y > ge2 || e8.x + (n3?.points?.[n3?.points?.length - 1]?.[0] ?? 0) < -ge2 || e8.x + (n3?.points?.[n3?.points?.length - 1]?.[0] ?? 0) > ge2 || e8.y + (n3?.points?.[n3?.points?.length - 1]?.[1] ?? 0) < -ge2 || e8.y + (n3?.points?.[n3?.points?.length - 1]?.[1] ?? 0) > ge2 || e8.x + (e8?.points?.[e8?.points?.length - 1]?.[0] ?? 0) < -ge2 || e8.x + (e8?.points?.[e8?.points?.length - 1]?.[0] ?? 0) > ge2 || e8.y + (e8?.points?.[e8?.points?.length - 1]?.[1] ?? 0) < -ge2 || e8.y + (e8?.points?.[e8?.points?.length - 1]?.[1] ?? 0) > ge2) && console.error("Elbow arrow (or update) is outside reasonable bounds (> 1e6)", { arrow: e8, updates: n3 }), e8.x = se2(e8.x, -ge2, ge2), e8.y = se2(e8.y, -ge2, ge2), n3.points && (n3.points = n3.points.map(([h, x]) => u(se2(h, -ge2, ge2), se2(x, -ge2, ge2)))), c.PROD || (Ae(!n3.points || n3.points.length >= 2, "Updated point array length must match the arrow point length, contain exactly the new start and end points or not be specified at all (i.e. you can't add new points between start and end manually to elbow arrows)"), Ae(!e8.fixedSegments || e8.fixedSegments.map((h) => h.start[0] === h.end[0] || h.start[1] === h.end[1]).every(Boolean), "Fixed segments must be either horizontal or vertical"), Ae(!n3.fixedSegments || n3.fixedSegments.map((h) => h.start[0] === h.end[0] || h.start[1] === h.end[1]).every(Boolean), "Updates to fixed segments must be either horizontal or vertical"), Ae(e8.points.slice(1).map((h, x) => h[0] === e8.points[x][0] || h[1] === e8.points[x][1]), "Elbow arrow segments must be either horizontal or vertical"));
  let o3 = n3.points ? n3.points && n3.points.length === 2 ? e8.points.map((h, x) => x === 0 ? n3.points[0] : x === e8.points.length - 1 ? n3.points[1] : h) : n3.points.slice() : e8.points.slice(), i3 = typeof n3.startBinding < "u" ? n3.startBinding : e8.startBinding, a3 = typeof n3.endBinding < "u" ? n3.endBinding : e8.endBinding, s3 = i3 && cr(i3.elementId, t3), d = a3 && cr(a3.elementId, t3);
  if (t3.size === 0 && Ni(o3) || s3?.id !== i3?.elementId || d?.id !== a3?.elementId) return In(o3.map((h) => u(e8.x + h[0], e8.y + h[1])), e8.fixedSegments, e8.startIsSpecial, e8.endIsSpecial);
  let { startHeading: c3, endHeading: l3, startGlobalPoint: U, endGlobalPoint: p, hoveredStartElement: m, hoveredEndElement: b3, ...E } = fs({ x: e8.x, y: e8.y, startBinding: i3, endBinding: a3, startArrowhead: e8.startArrowhead, endArrowhead: e8.endArrowhead, points: e8.points }, t3, o3, s3, d, r), g = n3.fixedSegments ?? e8.fixedSegments ?? [];
  return !n3.points && !n3.fixedSegments && !n3.startBinding && !n3.endBinding ? w7(e8, t3) : n3.startBinding === e8.startBinding && n3.endBinding === e8.endBinding && (n3.points ?? []).every((h, x) => _e(h, e8.points[x] ?? u(1 / 0, 1 / 0))) ? {} : g.length === 0 ? In(us(ms(ps(e8, { startHeading: c3, endHeading: l3, startGlobalPoint: U, endGlobalPoint: p, hoveredStartElement: m, hoveredEndElement: b3, ...E }) ?? [])), g, null, null) : (e8.fixedSegments?.length ?? 0) > g.length ? R7(e8, g, t3) : n3.points ? n3.points && n3.fixedSegments ? n3 : M7(e8, o3, g, c3, l3, U, p, m, b3) : T7(e8, g, c3, l3, m, b3);
};
var fs = (e8, t3, n3, r, o3, i3) => {
  let a3 = wr(n3[0], Be(e8.x, e8.y)), s3 = wr(n3[n3.length - 1], Be(e8.x, e8.y)), d = r, c3 = o3;
  if (i3?.isDragging) {
    let v = Array.from(t3.values());
    d = yp(a3, t3, v, i3?.zoom) || r, c3 = yp(s3, t3, v, i3?.zoom) || o3;
  }
  let l3 = xp({ ...e8, elbowed: true, points: n3 }, "start", e8.startBinding?.fixedPoint, a3, r, d, i3?.isDragging), U = xp({ ...e8, elbowed: true, points: n3 }, "end", e8.endBinding?.fixedPoint, s3, o3, c3, i3?.isDragging), p = hp(l3, U, t3, d, a3), m = hp(U, l3, t3, c3, s3), b3 = [l3[0] - 2, l3[1] - 2, l3[0] + 2, l3[1] + 2], E = [U[0] - 2, U[1] - 2, U[0] + 2, U[1] + 2], g = d ? wt(d, yn(p, e8.startArrowhead ? me2 * 6 : me2 * 2, 1)) : b3, h = c3 ? wt(c3, yn(m, e8.endArrowhead ? me2 * 6 : me2 * 2, 1)) : E, x = gn(l3, c3 ? wt(c3, yn(m, pe2, pe2)) : E) || gn(U, d ? wt(d, yn(p, pe2, pe2)) : b3), y = wp(x ? [b3, E] : [g, h]), w = S7(x ? b3 : g, x ? E : h, y, x ? yn(p, !d && !c3 ? 0 : pe2, 0) : yn(p, !d && !c3 ? 0 : pe2 - (e8.startArrowhead ? me2 * 6 : me2 * 2), pe2), x ? yn(m, !d && !c3 ? 0 : pe2, 0) : yn(m, !d && !c3 ? 0 : pe2 - (e8.endArrowhead ? me2 * 6 : me2 * 2), pe2), x, d && wt(d), c3 && wt(c3)), I = gp(w[0], p, l3), S = gp(w[1], m, U);
  return { dynamicAABBs: w, startDonglePosition: I, startGlobalPoint: l3, startHeading: p, endDonglePosition: S, endGlobalPoint: U, endHeading: m, commonBounds: y, hoveredStartElement: d, hoveredEndElement: c3, boundsOverlap: x, startElementBounds: g, endElementBounds: h };
};
var ps = (e8, t3) => {
  let { dynamicAABBs: n3, startDonglePosition: r, startGlobalPoint: o3, startHeading: i3, endDonglePosition: a3, endGlobalPoint: s3, endHeading: d, commonBounds: c3, hoveredEndElement: l3 } = t3, U = v7(n3, r || o3, i3, a3 || s3, d, c3), p = r && $i(r, U), m = a3 && $i(a3, U), b3 = $i(s3, U);
  b3 && l3 && (b3.closed = true);
  let E = $i(o3, U);
  E && e8.startBinding && (E.closed = true);
  let g = p && m && (gn(p.pos, n3[1]) || gn(m.pos, n3[0])), h = L7(p || E, m || b3, U, i3 || Re, d || Re, g ? [] : n3);
  if (h) {
    let x = h.map((y) => [y.pos[0], y.pos[1]]);
    return p && x.unshift(o3), m && x.push(s3), x;
  }
  return null;
};
var yn = (e8, t3, n3) => {
  switch (e8) {
    case ze:
      return [t3, n3, n3, n3];
    case Re:
      return [n3, t3, n3, n3];
    case Fe:
      return [n3, n3, t3, n3];
  }
  return [n3, n3, n3, t3];
};
var L7 = (e8, t3, n3, r, o3, i3) => {
  let a3 = ls(e8.pos, t3.pos), s3 = new ro((d) => d.f);
  for (s3.push(e8); s3.size() > 0; ) {
    let d = s3.pop();
    if (!d || d.closed) continue;
    if (d === t3) return D7(e8, d);
    d.closed = true;
    let c3 = P7(d.addr, n3);
    for (let l3 = 0; l3 < 4; l3++) {
      let U = c3[l3];
      if (!U || U.closed) continue;
      let p = bt(U.pos, d.pos, 0.5);
      if (xd(...i3.map((w) => gn(p, w)))) continue;
      let m = N7(l3), b3 = d.parent ? Ht(O(d.pos, d.parent.pos)) : r, E = Ma(b3);
      if (ve(E, m) || Ip(e8.addr, U.addr) && ve(m, r) || Ip(t3.addr, U.addr) && ve(m, o3)) continue;
      let h = b3 !== m, x = d.g + ls(U.pos, d.pos) + (h ? Math.pow(a3, 3) : 0), y = U.visited;
      if (!y || x < U.g) {
        let w = $7(U, t3, m, o3);
        U.visited = true, U.parent = d, U.h = ls(t3.pos, U.pos) + w * Math.pow(a3, 2), U.g = x, U.f = U.g + U.h, y ? s3.rescoreElement(U) : s3.push(U);
      }
    }
  }
  return null;
};
var D7 = (e8, t3) => {
  let n3 = t3, r = [];
  for (; n3.parent; ) r.unshift(n3), n3 = n3.parent;
  return r.unshift(e8), r;
};
var ls = (e8, t3) => Math.abs(e8[0] - t3[0]) + Math.abs(e8[1] - t3[1]);
var S7 = (e8, t3, n3, r, o3, i3, a3, s3) => {
  let d = a3 ?? e8, c3 = s3 ?? t3, [l3, U, p, m] = r ?? [0, 0, 0, 0], [b3, E, g, h] = o3 ?? [0, 0, 0, 0], x = [e8[0] > t3[2] ? e8[1] > t3[3] || e8[3] < t3[1] ? Math.min((d[0] + c3[2]) / 2, e8[0] - m) : (d[0] + c3[2]) / 2 : e8[0] > t3[0] ? e8[0] - m : n3[0] - m, e8[1] > t3[3] ? e8[0] > t3[2] || e8[2] < t3[0] ? Math.min((d[1] + c3[3]) / 2, e8[1] - l3) : (d[1] + c3[3]) / 2 : e8[1] > t3[1] ? e8[1] - l3 : n3[1] - l3, e8[2] < t3[0] ? e8[1] > t3[3] || e8[3] < t3[1] ? Math.max((d[2] + c3[0]) / 2, e8[2] + U) : (d[2] + c3[0]) / 2 : e8[2] < t3[2] ? e8[2] + U : n3[2] + U, e8[3] < t3[1] ? e8[0] > t3[2] || e8[2] < t3[0] ? Math.max((d[3] + c3[1]) / 2, e8[3] + p) : (d[3] + c3[1]) / 2 : e8[3] < t3[3] ? e8[3] + p : n3[3] + p], y = [t3[0] > e8[2] ? t3[1] > e8[3] || t3[3] < e8[1] ? Math.min((c3[0] + d[2]) / 2, t3[0] - h) : (c3[0] + d[2]) / 2 : t3[0] > e8[0] ? t3[0] - h : n3[0] - h, t3[1] > e8[3] ? t3[0] > e8[2] || t3[2] < e8[0] ? Math.min((c3[1] + d[3]) / 2, t3[1] - b3) : (c3[1] + d[3]) / 2 : t3[1] > e8[1] ? t3[1] - b3 : n3[1] - b3, t3[2] < e8[0] ? t3[1] > e8[3] || t3[3] < e8[1] ? Math.max((c3[2] + d[0]) / 2, t3[2] + E) : (c3[2] + d[0]) / 2 : t3[2] < e8[2] ? t3[2] + E : n3[2] + E, t3[3] < e8[1] ? t3[0] > e8[2] || t3[2] < e8[0] ? Math.max((c3[3] + d[1]) / 2, t3[3] + g) : (c3[3] + d[1]) / 2 : t3[3] < e8[3] ? t3[3] + g : n3[3] + g], w = wp([x, y]);
  if (!i3 && x[2] - x[0] + y[2] - y[0] > w[2] - w[0] + 1e-11 && x[3] - x[1] + y[3] - y[1] > w[3] - w[1] + 1e-11) {
    let [I, S] = [(y[0] + y[2]) / 2, (y[1] + y[3]) / 2];
    if (t3[0] > e8[2] && e8[1] > t3[3]) {
      let v = x[2] + (y[0] - x[2]) / 2, D = y[3] + (x[1] - y[3]) / 2;
      return Me(Be(e8[2] - I, e8[1] - S), Be(e8[0] - I, e8[3] - S)) > 0 ? [[x[0], x[1], v, x[3]], [v, y[1], y[2], y[3]]] : [[x[0], D, x[2], x[3]], [y[0], y[1], y[2], D]];
    } else if (e8[2] < t3[0] && e8[3] < t3[1]) {
      let v = x[2] + (y[0] - x[2]) / 2, D = x[3] + (y[1] - x[3]) / 2;
      return Me(Be(e8[0] - I, e8[1] - S), Be(e8[2] - I, e8[3] - S)) > 0 ? [[x[0], x[1], x[2], D], [y[0], D, y[2], y[3]]] : [[x[0], x[1], v, x[3]], [v, y[1], y[2], y[3]]];
    } else if (e8[0] > t3[2] && e8[3] < t3[1]) {
      let v = y[2] + (x[0] - y[2]) / 2, D = x[3] + (y[1] - x[3]) / 2;
      return Me(Be(e8[2] - I, e8[1] - S), Be(e8[0] - I, e8[3] - S)) > 0 ? [[v, x[1], x[2], x[3]], [y[0], y[1], v, y[3]]] : [[x[0], x[1], x[2], D], [y[0], D, y[2], y[3]]];
    } else if (e8[0] > t3[2] && e8[1] > t3[3]) {
      let v = y[2] + (x[0] - y[2]) / 2, D = y[3] + (x[1] - y[3]) / 2;
      return Me(Be(e8[0] - I, e8[1] - S), Be(e8[2] - I, e8[3] - S)) > 0 ? [[v, x[1], x[2], x[3]], [y[0], y[1], v, y[3]]] : [[x[0], D, x[2], x[3]], [y[0], y[1], y[2], D]];
    }
  }
  return [x, y];
};
var v7 = (e8, t3, n3, r, o3, i3) => {
  let a3 = /* @__PURE__ */ new Set(), s3 = /* @__PURE__ */ new Set();
  n3 === nt || n3 === Re ? s3.add(t3[1]) : a3.add(t3[0]), o3 === nt || o3 === Re ? s3.add(r[1]) : a3.add(r[0]), e8.forEach((l3) => {
    a3.add(l3[0]), a3.add(l3[2]), s3.add(l3[1]), s3.add(l3[3]);
  }), a3.add(i3[0]), a3.add(i3[2]), s3.add(i3[1]), s3.add(i3[3]);
  let d = Array.from(s3).sort((l3, U) => l3 - U), c3 = Array.from(a3).sort((l3, U) => l3 - U);
  return { row: d.length, col: c3.length, data: d.flatMap((l3, U) => c3.map((p, m) => ({ f: 0, g: 0, h: 0, closed: false, visited: false, parent: null, addr: [m, U], pos: [p, l3] }))) };
};
var gp = (e8, t3, n3) => {
  switch (t3) {
    case ze:
      return u(n3[0], e8[1]);
    case Re:
      return u(e8[2], n3[1]);
    case Fe:
      return u(n3[0], e8[3]);
  }
  return u(e8[0], n3[1]);
};
var $7 = (e8, t3, n3, r) => {
  if (r === Re) switch (n3) {
    case Re:
      return e8.pos[0] >= t3.pos[0] ? 4 : e8.pos[1] === t3.pos[1] ? 0 : 2;
    case ze:
      return e8.pos[1] > t3.pos[1] && e8.pos[0] < t3.pos[0] ? 1 : 3;
    case Fe:
      return e8.pos[1] < t3.pos[1] && e8.pos[0] < t3.pos[0] ? 1 : 3;
    case nt:
      return e8.pos[1] === t3.pos[1] ? 4 : 2;
  }
  else if (r === nt) switch (n3) {
    case Re:
      return e8.pos[1] === t3.pos[1] ? 4 : 2;
    case ze:
      return e8.pos[1] > t3.pos[1] && e8.pos[0] > t3.pos[0] ? 1 : 3;
    case Fe:
      return e8.pos[1] < t3.pos[1] && e8.pos[0] > t3.pos[0] ? 1 : 3;
    case nt:
      return e8.pos[0] <= t3.pos[0] ? 4 : e8.pos[1] === t3.pos[1] ? 0 : 2;
  }
  else if (r === ze) switch (n3) {
    case Re:
      return e8.pos[1] > t3.pos[1] && e8.pos[0] < t3.pos[0] ? 1 : 3;
    case ze:
      return e8.pos[1] >= t3.pos[1] ? 4 : e8.pos[0] === t3.pos[0] ? 0 : 2;
    case Fe:
      return e8.pos[0] === t3.pos[0] ? 4 : 2;
    case nt:
      return e8.pos[1] > t3.pos[1] && e8.pos[0] > t3.pos[0] ? 1 : 3;
  }
  else if (r === Fe) switch (n3) {
    case Re:
      return e8.pos[1] < t3.pos[1] && e8.pos[0] < t3.pos[0] ? 1 : 3;
    case ze:
      return e8.pos[0] === t3.pos[0] ? 4 : 2;
    case Fe:
      return e8.pos[1] <= t3.pos[1] ? 4 : e8.pos[0] === t3.pos[0] ? 0 : 2;
    case nt:
      return e8.pos[1] < t3.pos[1] && e8.pos[0] > t3.pos[0] ? 1 : 3;
  }
  return 0;
};
var P7 = ([e8, t3], n3) => [oo([e8, t3 - 1], n3), oo([e8 + 1, t3], n3), oo([e8, t3 + 1], n3), oo([e8 - 1, t3], n3)];
var oo = ([e8, t3], n3) => e8 < 0 || e8 >= n3.col || t3 < 0 || t3 >= n3.row ? null : n3.data[t3 * n3.col + e8] ?? null;
var $i = (e8, t3) => {
  for (let n3 = 0; n3 < t3.col; n3++) for (let r = 0; r < t3.row; r++) {
    let o3 = oo([n3, r], t3);
    if (o3 && e8[0] === o3.pos[0] && e8[1] === o3.pos[1]) return o3;
  }
  return null;
};
var wp = (e8) => [Math.min(...e8.map((t3) => t3[0])), Math.min(...e8.map((t3) => t3[1])), Math.max(...e8.map((t3) => t3[2])), Math.max(...e8.map((t3) => t3[3]))];
var cr = (e8, t3) => {
  let n3 = t3.get(e8);
  return n3 && xt(n3) ? n3 : null;
};
var In = (e8, t3, n3, r) => {
  let o3 = e8[0][0], i3 = e8[0][1], a3 = e8.map((s3) => wr(s3, ue2(O(e8[0]), -1)));
  return (o3 < -ge2 || o3 > ge2 || i3 < -ge2 || i3 > ge2 || o3 + a3[a3.length - 1][0] < -ge2 || i3 + a3[a3.length - 1][0] > ge2 || o3 + a3[a3.length - 1][1] < -ge2 || i3 + a3[a3.length - 1][1] > ge2) && console.error("Elbow arrow normalization is outside reasonable bounds (> 1e6)", { x: o3, y: i3, points: a3, ...xn(a3) }), a3 = a3.map(([s3, d]) => u(se2(s3, -1e6, 1e6), se2(d, -1e6, 1e6))), { points: a3, x: se2(o3, -1e6, 1e6), y: se2(i3, -1e6, 1e6), fixedSegments: (t3?.length ?? 0) > 0 ? t3 : null, ...xn(a3), startIsSpecial: n3, endIsSpecial: r };
};
var us = (e8) => {
  if (e8.length > 1) {
    let t3 = Math.abs(e8[0][1] - e8[1][1]) < Math.abs(e8[0][0] - e8[1][0]);
    return e8.filter((n3, r) => {
      if (r === 0 || r === e8.length - 1) return true;
      let o3 = e8[r + 1], i3 = Math.abs(n3[1] - o3[1]) < Math.abs(n3[0] - o3[0]);
      return t3 === i3 ? (t3 = i3, false) : (t3 = i3, true);
    });
  }
  return e8;
};
var ms = (e8) => e8.length >= 4 ? e8.filter((t3, n3) => {
  if (n3 === 0 || n3 === e8.length - 1) return true;
  let r = e8[n3 - 1];
  return ie2(r, t3) > Us;
}) : e8;
var N7 = (e8) => {
  switch (e8) {
    case 0:
      return ze;
    case 1:
      return Re;
    case 2:
      return Fe;
  }
  return nt;
};
var xp = (e8, t3, n3, r, o3, i3, a3) => {
  if (a3) {
    if (i3) {
      let s3 = fi(e8, i3, t3);
      return s2(i3, s3);
    }
    return r;
  }
  if (o3) {
    let s3 = Ui(n3 || [0, 0], o3);
    return Math.abs(or(o3, s3) - me2) > 0.01 ? fi(e8, o3, t3) : s3;
  }
  return r;
};
var hp = (e8, t3, n3, r, o3) => a2(e8, t3, r, r && wt(r, Array(4).fill(or(r, e8))), n3, o3);
var yp = (e8, t3, n3, r) => Bn(un(e8), n3, t3, r, true, true);
var Ip = (e8, t3) => e8[0] === t3[0] && e8[1] === t3[1];
var Ni = (e8, t3 = Us) => e8.slice(1).map((n3, r) => Math.abs(n3[0] - e8[r][0]) < t3 || Math.abs(n3[1] - e8[r][1]) < t3).every(Boolean);
var F7 = { selection: true, text: true, rectangle: true, diamond: true, ellipse: true, line: true, image: true, arrow: true, freedraw: true, eraser: false, custom: true, frame: true, embeddable: true, hand: true, laser: false, magicframe: false };
var B7 = (e8) => Object.keys(Ie).includes(e8) ? Ie[e8] : Ft;
var lr = (e8, t3) => {
  if (!t3) return null;
  let n3 = t3.focus || 0;
  return X(e8) ? vn(t3) ? { ...t3, focus: n3, fixedPoint: Yr(t3.fixedPoint ?? [0, 0]) } : null : { ...t3, focus: n3 };
};
var wn = (e8, t3) => {
  let n3 = { type: t3.type || e8.type, version: e8.version || 1, versionNonce: e8.versionNonce ?? 0, index: e8.index ?? null, isDeleted: e8.isDeleted ?? false, id: e8.id || Dt(), fillStyle: e8.fillStyle || we.fillStyle, strokeWidth: e8.strokeWidth || we.strokeWidth, strokeStyle: e8.strokeStyle ?? we.strokeStyle, roughness: e8.roughness ?? we.roughness, opacity: e8.opacity == null ? we.opacity : e8.opacity, angle: e8.angle || 0, x: t3.x ?? e8.x ?? 0, y: t3.y ?? e8.y ?? 0, strokeColor: e8.strokeColor || we.strokeColor, backgroundColor: e8.backgroundColor || we.backgroundColor, width: e8.width || 0, height: e8.height || 0, seed: e8.seed ?? 1, groupIds: e8.groupIds ?? [], frameId: e8.frameId ?? null, roundness: e8.roundness ? e8.roundness : e8.strokeSharpness === "round" ? { type: Oo(e8.type) ? ot.LEGACY : ot.PROPORTIONAL_RADIUS } : null, boundElements: e8.boundElementIds ? e8.boundElementIds.map((r) => ({ type: "arrow", id: r })) : e8.boundElements ?? [], updated: e8.updated ?? zt(), link: e8.link ? dn(e8.link) : null, locked: e8.locked ?? false };
  return ("customData" in e8 || "customData" in t3) && (n3.customData = "customData" in t3 ? t3.customData : e8.customData), { ...e8, ...n3, ...bs(n3), ...t3 };
};
var _7 = (e8) => {
  switch (e8 = { ...e8 }, e8.type) {
    case "text":
      delete e8.rawText;
      let t3 = e8.fontSize, n3 = e8.fontFamily;
      if ("font" in e8) {
        let [l3, U] = e8.font.split(" ");
        t3 = parseFloat(l3), n3 = B7(U);
      }
      let r = typeof e8.text == "string" && e8.text || "", o3 = e8.lineHeight || (e8.height ? Md(e8) : ko(e8.fontFamily));
      return e8 = wn(e8, { fontSize: t3, fontFamily: n3, text: r, textAlign: e8.textAlign || Vn, verticalAlign: e8.verticalAlign || go, containerId: e8.containerId ?? null, originalText: e8.originalText || r, autoResize: e8.autoResize ?? true, lineHeight: o3 }), !r && !e8.isDeleted && (e8 = { ...e8, originalText: r, isDeleted: true }, e8 = kr(e8)), e8;
    case "freedraw":
      return wn(e8, { points: e8.points, lastCommittedPoint: null, simulatePressure: e8.simulatePressure, pressures: e8.pressures });
    case "image":
      return wn(e8, { status: e8.status || "pending", fileId: e8.fileId, scale: e8.scale || [1, 1], crop: e8.crop ?? null });
    case "line":
    case "draw":
      let { startArrowhead: i3 = null, endArrowhead: a3 = null } = e8, s3 = e8.x, d = e8.y, c3 = !Array.isArray(e8.points) || e8.points.length < 2 ? [u(0, 0), u(e8.width, e8.height)] : e8.points;
      return (c3[0][0] !== 0 || c3[0][1] !== 0) && ({ points: c3, x: s3, y: d } = z.getNormalizedPoints(e8)), wn(e8, { type: e8.type === "draw" ? "line" : e8.type, startBinding: lr(e8, e8.startBinding), endBinding: lr(e8, e8.endBinding), lastCommittedPoint: null, startArrowhead: i3, endArrowhead: a3, points: c3, x: s3, y: d, ...xn(c3) });
    case "arrow": {
      let { startArrowhead: l3 = null, endArrowhead: U = "arrow" } = e8, p = e8.x, m = e8.y, b3 = !Array.isArray(e8.points) || e8.points.length < 2 ? [u(0, 0), u(e8.width, e8.height)] : e8.points;
      (b3[0][0] !== 0 || b3[0][1] !== 0) && ({ points: b3, x: p, y: m } = z.getNormalizedPoints(e8));
      let E = { type: e8.type, startBinding: lr(e8, e8.startBinding), endBinding: lr(e8, e8.endBinding), lastCommittedPoint: null, startArrowhead: l3, endArrowhead: U, points: b3, x: p, y: m, elbowed: e8.elbowed, ...xn(b3) };
      return X(e8) ? wn(e8, { ...E, elbowed: true, startBinding: lr(e8, e8.startBinding), endBinding: lr(e8, e8.endBinding), fixedSegments: e8.fixedSegments, startIsSpecial: e8.startIsSpecial, endIsSpecial: e8.endIsSpecial }) : wn(e8, E);
    }
    case "ellipse":
    case "rectangle":
    case "diamond":
    case "iframe":
    case "embeddable":
      return wn(e8, {});
    case "magicframe":
    case "frame":
      return wn(e8, { name: e8.name ?? null });
  }
  return null;
};
var O7 = (e8, t3) => {
  if (e8.boundElements) {
    let n3 = e8.boundElements.slice(), r = /* @__PURE__ */ new Set();
    e8.boundElements = n3.reduce((o3, i3) => {
      let a3 = t3.get(i3.id);
      if (a3 && !r.has(i3.id)) {
        if (r.add(i3.id), a3.isDeleted) return o3;
        o3.push(i3), k(a3) && !a3.containerId && (a3.containerId = e8.id);
      }
      return o3;
    }, []);
  }
};
var A7 = (e8, t3) => {
  let n3 = e8.containerId ? t3.get(e8.containerId) : null;
  if (!n3) {
    e8.containerId = null;
    return;
  }
  if (!e8.isDeleted && n3.boundElements && !n3.boundElements.find((r) => r.id === e8.id)) {
    let r = (n3.boundElements || (n3.boundElements = [])).slice();
    r.push({ type: "text", id: e8.id }), n3.boundElements = r;
  }
};
var K7 = (e8, t3) => {
  e8.frameId && (t3.get(e8.frameId) || (e8.frameId = null));
};
var Mp = (e8, t3, n3) => {
  let r = /* @__PURE__ */ new Set(), o3 = t3 ? te(t3) : null, i3 = An((e8 || []).reduce((s3, d) => {
    if (d.type !== "selection" && !ao(d)) {
      let c3 = _7(d);
      if (c3) {
        let l3 = o3?.get(d.id);
        l3 && l3.version > c3.version && (c3 = kr(c3, l3.version)), r.has(c3.id) && (c3 = { ...c3, id: Dt() }), r.add(c3.id), s3.push(c3);
      }
    }
    return s3;
  }, []));
  if (!n3?.repairBindings) return i3;
  let a3 = te(i3);
  for (let s3 of i3) s3.frameId && K7(s3, a3), k(s3) && s3.containerId ? A7(s3, a3) : s3.boundElements && O7(s3, a3), n3.refreshDimensions && k(s3) && Object.assign(s3, Ga(s3, qe(s3, a3), a3)), ae2(s3) && (s3.startBinding && (!a3.has(s3.startBinding.elementId) || !ee2(s3)) && (s3.startBinding = null), s3.endBinding && (!a3.has(s3.endBinding.elementId) || !ee2(s3)) && (s3.endBinding = null));
  return i3.map((s3) => {
    if (X(s3) && s3.startBinding == null && s3.endBinding == null && !Ni(s3.points)) return { ...s3, ...Pi(s3, a3, { points: [u(0, 0), s3.points[s3.points.length - 1]] }), index: s3.index };
    if (X(s3) && s3.startBinding && s3.endBinding && s3.startBinding.elementId === s3.endBinding.elementId && s3.points.length > 1 && s3.points.some(([d, c3]) => Math.abs(d) > 1e6 || Math.abs(c3) > 1e6)) {
      console.error("Fixing self-bound elbow arrow", s3.id);
      let d = a3.get(s3.startBinding.elementId);
      return d ? { ...s3, x: d.x + d.width / 2, y: d.y - 5, width: d.width, height: d.height, points: [u(0, 0), u(0, -10), u(d.width / 2 + 5, -10), u(d.width / 2 + 5, d.height / 2 + 5)] } : (console.error("Bound element not found", s3.startBinding.elementId), s3);
    }
    return s3;
  });
};
var H7 = (e8, t3, n3) => {
  let r = t3[e8];
  return r !== void 0 ? r : n3[e8];
};
var Rp = { isSidebarDocked: (e8, t3) => ["defaultSidebarDockedPreference", e8.isSidebarDocked ?? H7("defaultSidebarDockedPreference", e8, t3)] };
var J7 = (e8, t3) => {
  e8 = e8 || {};
  let n3 = mt(), r = {};
  for (let o3 of Object.keys(Rp)) if (o3 in e8) {
    let [i3, a3] = Rp[o3](e8, n3);
    r[i3] = a3;
  }
  for (let [o3, i3] of Object.entries(n3)) {
    let a3 = e8[o3], s3 = t3 ? t3[o3] : void 0;
    r[o3] = a3 !== void 0 ? a3 : s3 !== void 0 ? s3 : i3;
  }
  return { ...r, cursorButton: t3?.cursorButton || "up", penDetected: t3?.penDetected ?? (e8.penMode ? e8.penDetected ?? false : false), activeTool: { ...$r(n3, r.activeTool.type && F7[r.activeTool.type] ? r.activeTool : { type: "selection" }), lastActiveTool: null, locked: r.activeTool.locked ?? false }, zoom: { value: Oa(Mo(e8.zoom) ? e8.zoom : e8.zoom?.value ?? n3.zoom.value) }, openSidebar: typeof e8.openSidebar == "string" ? { name: ks.name } : r.openSidebar, gridSize: Aa(Mo(e8.gridSize) ? e8.gridSize : xo), gridStep: Ka(Mo(e8.gridStep) ? e8.gridStep : ho), editingFrame: null };
};
var io = (e8, t3, n3, r) => ({ elements: Mp(e8?.elements, n3, r), appState: J7(e8?.appState, t3 || null), files: e8?.files || {} });
var Tp = (e8) => {
  let t3 = Mp(Es(e8.elements), null);
  return t3.length ? { ...e8, elements: t3 } : null;
};
var Lp = (e8 = [], t3) => {
  let n3 = [];
  for (let r of e8) if (Array.isArray(r)) {
    let o3 = Tp({ status: t3, elements: r, id: Dt(), created: Date.now() });
    o3 && n3.push(o3);
  } else {
    let o3 = r, i3 = Tp({ ...o3, id: o3.id || Dt(), status: o3.status || t3, created: o3.created || Date.now() });
    i3 && n3.push(i3);
  }
  return n3;
};
var $t = 32;
var xe2 = 12;
var Rn = 256;
var Sp = 50;
var Kn = "NOT_SPREADSHEET";
var Ur = "VALID_SPREADSHEET";
var so = (e8) => {
  let t3 = /^([-+]?)[$€£¥₩]?([-+]?)([\d.,]+)[%]?$/.exec(e8);
  return t3 ? parseFloat(`${(t3[1] || t3[2]) + t3[3]}`.replace(/,/g, "")) : null;
};
var gs = (e8, t3) => e8.slice(1).every((n3) => so(n3[t3]) !== null);
var Dp = (e8) => {
  let t3 = e8[0].length;
  if (t3 > 2) return { type: Kn, reason: "More than 2 columns" };
  if (t3 === 1) {
    if (!gs(e8, 0)) return { type: Kn, reason: "Value is not numeric" };
    let d = so(e8[0][0]) === null, c3 = (d ? e8.slice(1) : e8).map((l3) => so(l3[0]));
    return c3.length < 2 ? { type: Kn, reason: "Less than two rows" } : { type: Ur, spreadsheet: { title: d ? e8[0][0] : null, labels: null, values: c3 } };
  }
  let n3 = gs(e8, 0), r = gs(e8, 1);
  if (!n3 && !r) return { type: Kn, reason: "Value is not numeric" };
  let [o3, i3] = r ? [0, 1] : [1, 0], a3 = so(e8[0][i3]) === null, s3 = a3 ? e8.slice(1) : e8;
  return s3.length < 2 ? { type: Kn, reason: "Less than 2 rows" } : { type: Ur, spreadsheet: { title: a3 ? e8[0][i3] : null, labels: s3.map((d) => d[o3]), values: s3.map((d) => so(d[i3])) } };
};
var Y7 = (e8) => {
  let t3 = [];
  for (let n3 = 0; n3 < e8[0].length; n3++) {
    let r = [];
    for (let o3 = 0; o3 < e8.length; o3++) r.push(e8[o3][n3]);
    t3.push(r);
  }
  return t3;
};
var vp = (e8) => {
  let t3 = e8.trim().split(`
`).map((i3) => i3.trim().split("	"));
  if (t3.length && t3[0].length !== 2 && (t3 = e8.trim().split(`
`).map((i3) => i3.trim().split(","))), t3.length === 0) return { type: Kn, reason: "No values" };
  let n3 = t3[0].length;
  if (!t3.every((i3) => i3.length === n3)) return { type: Kn, reason: "All rows don't have same number of columns" };
  let o3 = Dp(t3);
  if (o3.type !== Ur) {
    let i3 = Dp(Y7(t3));
    if (i3.type === Ur) return i3;
  }
  return o3;
};
var Fi = Fs(Ps);
var lt = { fillStyle: "hachure", fontFamily: Ft, fontSize: ut, opacity: 100, roughness: 1, strokeColor: Z.black, roundness: null, strokeStyle: "solid", strokeWidth: 1, verticalAlign: kt.MIDDLE, locked: false };
var $p = (e8) => {
  let t3 = ($t + xe2) * e8.values.length + xe2, n3 = Rn + xe2 * 2;
  return { chartWidth: t3, chartHeight: n3 };
};
var C7 = (e8, t3, n3, r, o3) => e8.labels?.map((i3, a3) => qt({ groupIds: [r], backgroundColor: o3, ...lt, text: i3.length > 8 ? `${i3.slice(0, 5)}...` : i3, x: t3 + a3 * ($t + xe2) + xe2 * 2, y: n3 + xe2 / 2, width: $t, angle: 5.87, fontSize: 16, textAlign: "center", verticalAlign: "top" })) || [];
var V7 = (e8, t3, n3, r, o3) => {
  let i3 = qt({ groupIds: [r], backgroundColor: o3, ...lt, x: t3 - xe2, y: n3 - xe2, text: "0", textAlign: "right" }), a3 = qt({ groupIds: [r], backgroundColor: o3, ...lt, x: t3 - xe2, y: n3 - Rn - i3.height / 2, text: Math.max(...e8.values).toLocaleString(), textAlign: "right" });
  return [i3, a3];
};
var q7 = (e8, t3, n3, r, o3) => {
  let { chartWidth: i3, chartHeight: a3 } = $p(e8), s3 = On({ backgroundColor: o3, groupIds: [r], ...lt, type: "line", x: t3, y: n3, width: i3, points: [u(0, 0), u(i3, 0)] }), d = On({ backgroundColor: o3, groupIds: [r], ...lt, type: "line", x: t3, y: n3, height: a3, points: [u(0, 0), u(0, -a3)] }), c3 = On({ backgroundColor: o3, groupIds: [r], ...lt, type: "line", x: t3, y: n3 - Rn - xe2, strokeStyle: "dotted", width: i3, opacity: Sp, points: [u(0, 0), u(i3, 0)] });
  return [s3, d, c3];
};
var Pp = (e8, t3, n3, r, o3, i3) => {
  let { chartWidth: a3, chartHeight: s3 } = $p(e8), d = e8.title ? qt({ backgroundColor: o3, groupIds: [r], ...lt, text: e8.title, x: t3 + a3 / 2, y: n3 - Rn - xe2 * 2 - ut, roundness: null, textAlign: "center" }) : null, c3 = i3 ? Xr({ backgroundColor: o3, groupIds: [r], ...lt, type: "rectangle", x: t3, y: n3 - s3, width: a3, height: s3, strokeColor: Z.black, fillStyle: "solid", opacity: 6 }) : null;
  return [...c3 ? [c3] : [], ...d ? [d] : [], ...C7(e8, t3, n3, r, o3), ...V7(e8, t3, n3, r, o3), ...q7(e8, t3, n3, r, o3)];
};
var X7 = (e8, t3, n3) => {
  let r = Math.max(...e8.values), o3 = Dt(), i3 = Fi[Math.floor(Math.random() * Fi.length)];
  return [...e8.values.map((s3, d) => {
    let c3 = s3 / r * Rn;
    return Xr({ backgroundColor: i3, groupIds: [o3], ...lt, type: "rectangle", x: t3 + d * ($t + xe2) + xe2, y: n3 - c3 - xe2, width: $t, height: c3 });
  }), ...Pp(e8, t3, n3, o3, i3, c.DEV)];
};
var G7 = (e8, t3, n3) => {
  let r = Math.max(...e8.values), o3 = Dt(), i3 = Fi[Math.floor(Math.random() * Fi.length)], a3 = 0, s3 = [];
  for (let E of e8.values) {
    let g = a3 * ($t + xe2), h = -(E / r) * Rn;
    s3.push([g, h]), a3++;
  }
  let d = Math.max(...s3.map((E) => E[0])), c3 = Math.max(...s3.map((E) => E[1])), l3 = Math.min(...s3.map((E) => E[0])), U = Math.min(...s3.map((E) => E[1])), p = On({ backgroundColor: i3, groupIds: [o3], ...lt, type: "line", x: t3 + xe2 + $t / 2, y: n3 - xe2, height: c3 - U, width: d - l3, strokeWidth: 2, points: s3 }), m = e8.values.map((E, g) => {
    let h = g * ($t + xe2) + xe2 / 2, x = -(E / r) * Rn + xe2 / 2;
    return Xr({ backgroundColor: i3, groupIds: [o3], ...lt, fillStyle: "solid", strokeWidth: 2, type: "ellipse", x: t3 + h + $t / 2, y: n3 + x - xe2 * 2, width: xe2, height: xe2 });
  }), b3 = e8.values.map((E, g) => {
    let h = g * ($t + xe2) + xe2 / 2, x = E / r * Rn + xe2 / 2 + xe2;
    return On({ backgroundColor: i3, groupIds: [o3], ...lt, type: "line", x: t3 + h + $t / 2 + xe2 / 2, y: n3 - x, height: x, strokeStyle: "dotted", opacity: Sp, points: [u(0, 0), u(0, x)] });
  });
  return [...Pp(e8, t3, n3, o3, i3, c.DEV), p, ...b3, ...m];
};
var uK = (e8, t3, n3, r) => e8 === "line" ? G7(t3, n3, r) : X7(t3, n3, r);
var MK = "clipboard" in navigator && "readText" in navigator.clipboard;
var k7 = "clipboard" in navigator && "writeText" in navigator.clipboard;
var LK = "clipboard" in navigator && "write" in navigator.clipboard && "ClipboardItem" in window && "toBlob" in HTMLCanvasElement.prototype;
var Z7 = (e8) => !!([Ze.excalidraw, Ze.excalidrawClipboard, Ze.excalidrawClipboardWithAPI].includes(e8?.type) && Array.isArray(e8.elements));
var DK = ({ types: e8, files: t3 }) => {
  !e8 && !t3 && console.warn("createPasteEvent: no types or files provided");
  let n3 = new ClipboardEvent("paste", { clipboardData: new DataTransfer() });
  if (e8) for (let [r, o3] of Object.entries(e8)) {
    if (typeof o3 != "string") {
      t3 = t3 || [], t3.push(o3);
      continue;
    }
    try {
      if (n3.clipboardData?.setData(r, o3), n3.clipboardData?.getData(r) !== o3) throw new Error(`Failed to set "${r}" as clipboardData item`);
    } catch (i3) {
      throw new Error(i3.message);
    }
  }
  if (t3) {
    let r = -1;
    for (let o3 of t3) {
      r++;
      try {
        if (n3.clipboardData?.items.add(o3), n3.clipboardData?.files[r] !== o3) throw new Error(`Failed to set file "${o3.name}" as clipboardData item`);
      } catch (i3) {
        throw new Error(i3.message);
      }
    }
  }
  return n3;
};
var W7 = ({ elements: e8, files: t3 }) => {
  let n3 = te(e8), r = new Set(e8.filter((s3) => de2(s3))), o3 = false, i3 = e8.reduce((s3, d) => (At(d) && (o3 = true, t3 && t3[d.fileId] && (s3[d.fileId] = t3[d.fileId])), s3), {});
  o3 && !t3 && console.warn("copyToClipboard: attempting to file element(s) without providing associated `files` object.");
  let a3 = { type: Ze.excalidrawClipboard, elements: e8.map((s3) => {
    if (We(s3, n3) && !r.has(We(s3, n3))) {
      let d = Gr(s3);
      return Y(d, { frameId: null }), d;
    }
    return s3;
  }), files: t3 ? i3 : void 0 };
  return JSON.stringify(a3);
};
var Np = async (e8, t3, n3) => {
  await hs(W7({ elements: e8, files: t3 }), n3);
};
var z7 = (e8) => {
  let t3 = vp(e8);
  return t3.type === Ur ? { spreadsheet: t3.spreadsheet } : null;
};
function Fp(e8) {
  let t3 = [];
  for (let n3 of e8.childNodes) if (n3.nodeType === 3) {
    let r = n3.textContent?.trim();
    r && t3.push({ type: "text", value: r });
  } else if (n3 instanceof HTMLImageElement) {
    let r = n3.getAttribute("src");
    r && r.startsWith("http") && t3.push({ type: "imageUrl", value: r });
  } else t3 = t3.concat(Fp(n3));
  return t3;
}
var Q7 = (e8) => {
  let t3 = e8.clipboardData?.getData(H.html);
  if (!t3) return null;
  try {
    let n3 = new DOMParser().parseFromString(t3, H.html), r = Fp(n3.body);
    if (r.length) return { type: "mixedContent", value: r };
  } catch (n3) {
    console.error(`error in parseHTMLFromPaste: ${n3.message}`);
  }
  return null;
};
var SK = async () => {
  let e8 = {}, t3;
  try {
    t3 = await navigator.clipboard?.read();
  } catch (n3) {
    try {
      if (navigator.clipboard?.readText) {
        console.warn(`navigator.clipboard.readText() failed (${n3.message}). Failling back to navigator.clipboard.read()`);
        let r = await navigator.clipboard?.readText();
        if (r) return { [H.text]: r };
      }
    } catch (r) {
      if (navigator.clipboard?.read) console.warn(`navigator.clipboard.readText() failed (${r.message}). Failling back to navigator.clipboard.read()`);
      else {
        if (r.name === "DataError") return console.warn(`navigator.clipboard.read() error, clipboard is probably empty: ${r.message}`), e8;
        throw r;
      }
    }
    throw n3;
  }
  for (let n3 of t3) for (let r of n3.types) if (Ed(Hs, r)) try {
    if (r === H.text || r === H.html) e8[r] = await (await n3.getType(r)).text();
    else if (xs(r)) {
      let o3 = await n3.getType(r), i3 = fr(o3, r, void 0);
      e8[r] = i3;
    } else throw new Br(`Unsupported clipboard type: ${r}`);
  } catch (o3) {
    console.warn(o3 instanceof Br ? o3.message : `Cannot retrieve ${r} from clipboardItem: ${o3.message}`);
  }
  return Object.keys(e8).length === 0 && console.warn("No clipboard data found from clipboard.read()."), e8;
};
var j7 = async (e8, t3 = false) => {
  try {
    let n3 = !t3 && e8 && Q7(e8);
    return n3 ? n3.value.every((o3) => o3.type === "text") ? { type: "text", value: e8.clipboardData?.getData(H.text) || n3.value.map((o3) => o3.value).join(`
`).trim() } : n3 : { type: "text", value: (e8.clipboardData?.getData(H.text) || "").trim() };
  } catch {
    return { type: "text", value: "" };
  }
};
var vK = async (e8, t3 = false) => {
  let n3 = await j7(e8, t3);
  if (n3.type === "mixedContent") return { mixedContent: n3.value };
  try {
    let r = !t3 && z7(n3.value);
    if (r) return r;
  } catch (r) {
    console.error(r);
  }
  try {
    let r = JSON.parse(n3.value), o3 = r.type === Ze.excalidrawClipboardWithAPI;
    if (Z7(r)) return { elements: r.elements, files: r.files, text: t3 ? JSON.stringify(r.elements, null, 2) : void 0, programmaticAPI: o3 };
  } catch {
  }
  return { text: n3.value };
};
var Bp = async (e8) => {
  try {
    await navigator.clipboard.write([new window.ClipboardItem({ [H.png]: e8 })]);
  } catch (t3) {
    if (Fo(e8)) await navigator.clipboard.write([new window.ClipboardItem({ [H.png]: await e8 })]);
    else throw t3;
  }
};
var hs = async (e8, t3) => {
  if (k7) try {
    await navigator.clipboard.writeText(e8 || "");
    return;
  } catch (n3) {
    console.error(n3);
  }
  try {
    if (t3) {
      if (t3.clipboardData?.setData(H.text, e8 || ""), t3.clipboardData?.getData(H.text) !== e8) throw new Error("Failed to setData on clipboardEvent");
      return;
    }
  } catch (n3) {
    console.error(n3);
  }
  if (!e9(e8)) throw new Error("Error copying to clipboard.");
};
var e9 = (e8) => {
  e8 || (e8 = " ");
  let t3 = document.documentElement.getAttribute("dir") === "rtl", n3 = document.createElement("textarea");
  n3.style.border = "0", n3.style.padding = "0", n3.style.margin = "0", n3.style.position = "absolute", n3.style[t3 ? "right" : "left"] = "-9999px";
  let r = window.pageYOffset || document.documentElement.scrollTop;
  n3.style.top = `${r}px`, n3.style.fontSize = "12pt", n3.setAttribute("readonly", ""), n3.value = e8, document.body.appendChild(n3);
  let o3 = false;
  try {
    n3.select(), n3.setSelectionRange(0, n3.value.length), o3 = document.execCommand("copy");
  } catch (i3) {
    console.error(i3);
  }
  return n3.remove(), o3;
};
var t9 = ({ elements: e8, appState: t3, files: n3, maxWidthOrHeight: r, getDimensions: o3, exportPadding: i3, exportingFrame: a3 }) => {
  let { elements: s3, appState: d } = io({ elements: e8, appState: t3 }, null, null), { exportBackground: c3, viewBackgroundColor: l3 } = d;
  return pp(s3, { ...d, offsetTop: 0, offsetLeft: 0, width: 0, height: 0 }, n3 || {}, { exportBackground: c3, exportPadding: i3, viewBackgroundColor: l3, exportingFrame: a3 }, (U, p) => {
    let m = document.createElement("canvas");
    if (r) {
      typeof o3 == "function" && console.warn("`getDimensions()` is ignored when `maxWidthOrHeight` is supplied.");
      let E = Math.max(U, p), g = r < E ? r / E : t3?.exportScale ?? 1;
      return m.width = U * g, m.height = p * g, { canvas: m, scale: g };
    }
    let b3 = o3?.(U, p) || { width: U, height: p };
    return m.width = b3.width, m.height = b3.height, { canvas: m, scale: b3.scale ?? 1 };
  });
};
var n9 = async (e8) => {
  let { mimeType: t3 = H.png, quality: n3 } = e8;
  t3 === H.png && typeof n3 == "number" && console.warn(`"quality" will be ignored for "${H.png}" mimeType`), t3 === "image/jpg" && (t3 = H.jpg), t3 === H.jpg && !e8.appState?.exportBackground && (console.warn(`Defaulting "exportBackground" to "true" for "${H.jpg}" mimeType`), e8 = { ...e8, appState: { ...e8.appState, exportBackground: true } });
  let r = await t9(e8);
  return n3 = n3 || (/image\/jpe?g/.test(t3) ? 0.92 : 0.8), new Promise((o3, i3) => {
    r.toBlob(async (a3) => {
      if (!a3) return i3(new Error("couldn't export to blob"));
      a3 && t3 === H.png && e8.appState?.exportEmbedScene && (a3 = await _p({ blob: a3, metadata: to(e8.elements, e8.appState, e8.files || {}, "local") })), o3(a3);
    }, t3, n3);
  });
};
var r9 = async ({ elements: e8, appState: t3 = mt(), files: n3 = {}, exportPadding: r, renderEmbeddables: o3, exportingFrame: i3, skipInliningFonts: a3, reuseImages: s3 }) => {
  let { elements: d, appState: c3 } = io({ elements: e8, appState: t3 }, null, null), l3 = { ...c3, exportPadding: r };
  return up(d, l3, n3, { exportingFrame: i3, renderEmbeddables: o3, skipInliningFonts: a3, reuseImages: s3 });
};
var HK = async (e8) => {
  if (e8.type === "svg") {
    let t3 = await r9(e8);
    await hs(t3.outerHTML);
  } else if (e8.type === "png") await Bp(n9(e8));
  else if (e8.type === "json") await Np(e8.elements, e8.files);
  else throw new Error("Invalid export type");
};
var o9 = (e8) => e8.type === "diamond" ? [u(e8.width / 2, 0), u(e8.width, e8.height / 2), u(e8.width / 2, e8.height), u(0, e8.height / 2)] : [u(0, 0), u(0 + e8.width, 0), u(0 + e8.width, e8.height), u(0, e8.height)];
var i9 = (e8) => ae2(e8) || Ce(e8) ? e8.points : o9(e8);
var Op = (e8) => {
  let t3 = e8.reduce((n3, [r, o3]) => (n3.minY = Math.min(n3.minY, o3), n3.minX = Math.min(n3.minX, r), n3.maxX = Math.max(n3.maxX, r), n3.maxY = Math.max(n3.maxY, o3), n3), { minX: 1 / 0, minY: 1 / 0, maxX: -1 / 0, maxY: -1 / 0, cx: 0, cy: 0 });
  return t3.cx = (t3.maxX + t3.minX) / 2, t3.cy = (t3.maxY + t3.minY) / 2, t3;
};
var Kp = (e8) => {
  let t3 = i9(e8), { cx: n3, cy: r } = Op(t3), o3 = u(n3, r), i3 = t3.map((l3) => T(l3, o3, e8.angle)), { minX: a3, minY: s3, maxX: d, maxY: c3 } = Op(i3);
  return [a3 + e8.x, s3 + e8.y, d + e8.x, c3 + e8.y];
};
var Ap = (e8, t3, n3 = false) => {
  let r = Kp(e8), o3 = t3[0] <= r[0] && t3[2] >= r[2] && t3[1] <= r[1] && t3[3] >= r[3];
  return n3 ? o3 ? true : r[0] <= t3[0] && r[2] >= t3[2] && r[1] <= t3[1] && r[3] >= t3[3] : o3;
};
var a9 = (e8, t3) => {
  let n3 = Kp(e8);
  return (Sr(n3[0], Oe(t3[0], t3[2])) || Sr(t3[0], Oe(n3[0], n3[2]))) && (Sr(n3[1], Oe(t3[1], t3[3])) || Sr(t3[1], Oe(n3[1], n3[3])));
};
var Hp = ({ elements: e8, bounds: t3, type: n3, errorMargin: r = 0 }) => {
  ra(t3) && (t3 = Ke(t3, te(e8)));
  let o3 = [t3[0] - r, t3[1] - r, t3[2] + r, t3[3] + r], i3 = /* @__PURE__ */ new Set();
  for (let a3 of e8) {
    if (i3.has(a3.id)) continue;
    if (n3 === "overlap" ? a9(a3, o3) : n3 === "inside" ? Ap(a3, o3) : Ap(a3, o3, true)) {
      if (i3.add(a3.id), a3.boundElements) for (let d of a3.boundElements) i3.add(d.id);
      k(a3) && a3.containerId && i3.add(a3.containerId), ee2(a3) && (a3.startBinding && i3.add(a3.startBinding.elementId), a3.endBinding && i3.add(a3.endBinding?.elementId));
    }
  }
  return e8.filter((a3) => i3.has(a3.id));
};
function Jp(e8) {
  return [Math.min(e8[0][0], e8[1][0]), Math.min(e8[0][1], e8[1][1]), Math.max(e8[0][0], e8[1][0]), Math.max(e8[0][1], e8[1][1])];
}
function s9(e8, t3) {
  return e8[0] <= t3[2] && e8[2] >= t3[0] && e8[1] <= t3[3] && e8[3] >= t3[1];
}
var d9 = 1e-6;
function Yp(e8, t3) {
  let n3 = O(e8[1], e8[0]), r = O(t3, e8[0]), o3 = Me(n3, r);
  return Math.abs(o3) < d9;
}
function ys(e8, t3) {
  let n3 = O(e8[1], e8[0]), r = O(t3, e8[0]);
  return Me(n3, r) < 0;
}
function Cp(e8, t3) {
  return Yp(e8, t3[0]) || Yp(e8, t3[1]) || (ys(e8, t3[0]) ? !ys(e8, t3[1]) : ys(e8, t3[1]));
}
function Vp(e8, t3) {
  return s9(Jp(e8), Jp(t3)) && Cp(e8, t3) && Cp(t3, e8);
}
var uH = (e8, t3, n3) => {
  let r = te(e8);
  for (let o3 of t3) if (o3.frameId) {
    let i3 = n3.get(o3.id), a3 = n3.get(o3.frameId);
    if (i3) {
      let s3 = r.get(i3);
      s3 && Y(s3, { frameId: a3 ?? o3.frameId }, false);
    }
  }
};
function Is(e8, t3, n3) {
  let r = Sa(t3, n3), o3 = Sa(e8, n3);
  return r.some((a3) => o3.some((s3) => Vp(a3, s3)));
}
var qp = (e8, t3, n3) => _i(ui(e8, t3, n3, false)).filter((r) => !de2(r) && !r.frameId || r.frameId === t3.id);
var ws = (e8, t3, n3) => ui([t3], e8, n3).some((r) => r.id === t3.id);
var Bi = (e8, t3, n3) => {
  let [r, o3, i3, a3] = C2(t3, n3), [s3, d, c3, l3] = $e(e8);
  return r <= s3 && o3 <= d && i3 >= c3 && a3 >= l3;
};
var hn = (e8, t3, n3) => Bi([e8], t3, n3) || Is(e8, t3, n3) || ws(e8, t3, n3);
var mH = (e8, t3, n3) => {
  let [r, o3, i3, a3] = C2(t3, n3);
  return So(u(r, o3), u(e8.x, e8.y), u(i3, a3));
};
var bH = (e8) => {
  let t3 = /* @__PURE__ */ new Map();
  for (let n3 of e8) {
    let r = de2(n3) ? n3.id : n3.frameId;
    r && !t3.has(r) && t3.set(r, co(e8, r));
  }
  return t3;
};
var co = (e8, t3) => {
  let n3 = [];
  for (let r of e8.values()) r.frameId === t3 && n3.push(r);
  return n3;
};
var ds = (e8) => e8.filter((t3) => de2(t3));
var cs = (e8) => {
  let t3 = te(ds(e8));
  return e8.filter((n3) => t3.has(n3.id) || !n3.frameId || !t3.has(n3.frameId));
};
var EH = (e8, t3, n3, r) => {
  let o3 = co(e8, t3.id), i3 = new Set(o3), a3 = /* @__PURE__ */ new Set([...qp(e8, t3, r), ...o3.filter((p) => ws(p, t3, r))]), s3 = o3.filter((p) => !a3.has(p)), d = new Set(Array.from(a3).flatMap((p) => p.groupIds));
  for (let p of s3) if (!Is(p, t3, r)) p.groupIds.length === 0 && i3.delete(p);
  else if (p.groupIds.length > 0) for (let m of p.groupIds) d.add(m);
  for (let p of s3) if (p.groupIds.length > 0) {
    let m = true;
    for (let b3 of p.groupIds) d.has(b3) && (m = false);
    m && i3.delete(p);
  }
  let c3 = Array.from(a3).filter((p) => p.groupIds.length === 0);
  for (let p of c3) i3.add(p);
  let l3 = Array.from(a3).filter((p) => p.groupIds.length > 0), U = p2(l3, n3);
  for (let [p, m] of Object.entries(U)) if (m) {
    let b3 = an(e8, p);
    if (Bi(b3, t3, r)) for (let E of b3) i3.add(E);
  }
  return [...i3].filter((p) => !(k(p) && p.containerId));
};
var gH = (e8, t3, n3) => c9(_i(e8, qp(e8, t3, n3)), t3, n3);
var c9 = (e8, t3, n3) => {
  let r = [], o3 = /* @__PURE__ */ new Map();
  for (let i3 of e8) {
    let a3 = false;
    if (i3.groupIds.length > 0) {
      if (i3.groupIds.some((s3) => o3.get(s3))) a3 = true;
      else {
        let s3 = new Set(i3.groupIds.flatMap((d) => an(n3, d)));
        a3 = !Bi(Array.from(s3), t3, n3);
      }
      i3.groupIds.forEach((s3) => {
        o3.set(s3, a3);
      });
    }
    a3 || r.push(i3);
  }
  return r;
};
var We = (e8, t3) => e8.frameId && t3.get(e8.frameId) || null;
var xH = (e8, t3) => {
  let n3 = /* @__PURE__ */ new Set(), r = te(e8);
  e8 = _i(e8);
  for (let a3 of e8) de2(a3) && a3.id !== t3.id && n3.add(a3.id);
  let o3 = /* @__PURE__ */ new Set(), i3 = [];
  for (let a3 of e8) if (!(de2(a3) || a3.frameId && n3.has(a3.frameId))) if (a3.groupIds.length) {
    let s3 = a3.groupIds.at(-1);
    if (!o3.has(s3)) {
      o3.add(s3);
      let d = an(e8, s3);
      if (d.some((c3) => hn(c3, t3, r))) for (let c3 of d) i3.push(c3);
    }
  } else hn(a3, t3, r) && i3.push(a3);
  return i3;
};
var l9 = (e8, t3, n3, r) => {
  let o3 = te(e8), i3 = /* @__PURE__ */ new Map();
  for (let c3 of e8.values()) c3.frameId === n3.id && i3.set(c3.id, true);
  let a3 = new Set(t3.map((c3) => c3.id)), s3 = [], d = /* @__PURE__ */ new Set();
  for (let c3 of t3) de2(c3) && c3.id !== n3.id && d.add(c3.id);
  for (let c3 of _i(e8, t3)) {
    if (de2(c3) || c3.frameId && d.has(c3.frameId) || c3.frameId && r.selectedElementIds[c3.id] && r.selectedElementIds[c3.frameId]) continue;
    i3.has(c3.id) || s3.push(c3);
    let l3 = oe(c3, o3);
    l3 && !a3.has(l3.id) && !i3.has(l3.id) && s3.push(l3);
  }
  for (let c3 of s3) Y(c3, { frameId: n3.id }, false);
  return e8;
};
var Xp = (e8, t3) => {
  let n3 = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Map();
  for (let o3 of e8) if (o3.frameId) {
    n3.set(o3.id, o3);
    let i3 = r.get(o3.frameId) || [];
    i3.push(o3);
    let a3 = oe(o3, t3);
    a3 && (n3.set(a3.id, a3), i3.push(a3)), r.set(o3.frameId, i3);
  }
  for (let [, o3] of n3) Y(o3, { frameId: null }, false);
};
var U9 = (e8, t3) => {
  let n3 = co(e8, t3.id);
  return Xp(n3, te(e8)), e8;
};
var hH = (e8, t3, n3, r) => l9(U9(e8, n3), t3, n3, r.state).slice();
var yH = (e8, t3, n3) => {
  let r = n3.scene.getSelectedElements({ selectedElementIds: t3.selectedElementIds, elements: e8 }), o3 = new Set(r);
  if (t3.editingGroupId) for (let s3 of r) s3.groupIds.length === 0 ? o3.add(s3) : s3.groupIds.flatMap((d) => an(e8, d)).forEach((d) => o3.add(d));
  let i3 = /* @__PURE__ */ new Set(), a3 = te(e8);
  return o3.forEach((s3) => {
    s3.frameId && !de2(s3) && !Gp(s3, a3, t3) && i3.add(s3);
  }), i3.size > 0 && Xp(i3, a3), e8;
};
var _i = (e8, t3) => {
  let n3 = /* @__PURE__ */ new Set(), r = t3 || e8;
  for (let a3 of r.values()) {
    let s3 = a3.groupIds[a3.groupIds.length - 1];
    s3 && n3.add(s3);
  }
  let o3 = /* @__PURE__ */ new Set();
  for (let a3 of n3) an(e8, a3).some((s3) => de2(s3)) && o3.add(a3);
  let i3 = [];
  for (let a3 of r.values()) o3.has(a3.groupIds[a3.groupIds.length - 1]) || i3.push(a3);
  return i3;
};
var Mi = (e8, t3, n3) => {
  let r = k(e8) && qe(e8, t3) || e8;
  return r.frameId && n3.selectedElementIds[r.id] && n3.selectedElementIds[r.frameId] ? We(r, t3) : n3.selectedElementIds[r.id] && n3.selectedElementsAreBeingDragged ? n3.frameToHighlight : We(r, t3);
};
var Gp = (e8, t3, n3, r) => {
  let o3 = r?.targetFrame ?? Mi(e8, t3, n3);
  if (!o3) return false;
  let i3 = k(e8) && qe(e8, t3) || e8, a3 = (d) => {
    r?.checkedGroups && i3.groupIds.forEach((c3) => {
      r.checkedGroups?.set(c3, d);
    });
  };
  if (!n3.selectedElementIds[i3.id] || !n3.selectedElementsAreBeingDragged || n3.selectedElementIds[i3.id] && n3.selectedElementIds[o3.id]) return true;
  if (i3.groupIds.length === 0) return hn(i3, o3, t3);
  for (let d of i3.groupIds) if (r?.checkedGroups?.has(d)) return r.checkedGroups.get(d);
  let s3 = new Set(i3.groupIds.filter((d) => r?.checkedGroups ? !r.checkedGroups.has(d) : true).flatMap((d) => an(t3, d)));
  if (n3.editingGroupId && n3.selectedElementsAreBeingDragged) {
    let d = new Set(at(t3, n3));
    if (n3.frameToHighlight !== null) return true;
    d.forEach((l3) => {
      s3.delete(l3);
    });
  }
  for (let d of s3) if (de2(d)) return a3(false), false;
  for (let d of s3) if (hn(d, o3, t3)) return a3(true), true;
  return false;
};
var as = (e8, t3, n3, r, o3) => {
  if (!n3.frameRendering || !n3.frameRendering.clip) return false;
  let i3 = Is(e8, t3, r) || ws(e8, t3, r);
  if (i3) {
    for (let a3 of e8.groupIds) o3?.set(a3, true);
    return true;
  }
  if (!i3 && e8.groupIds.length > 0 && !Bi([e8], t3, r)) {
    let a3 = false;
    if (n3.selectedElementsAreBeingDragged) a3 = Gp(e8, r, n3, { targetFrame: t3, checkedGroups: o3 });
    else {
      a3 = e8.frameId === t3.id;
      for (let s3 of e8.groupIds) o3?.set(s3, a3);
    }
    for (let s3 of e8.groupIds) o3?.set(s3, a3);
    return a3;
  }
  return false;
};
var bp = (e8) => e8.name === null ? hd(e8) ? "Frame" : "AI Frame" : e8.name;
var Ep = (e8, t3) => Hp({ elements: e8, bounds: t3, type: "overlap" }).filter((n3) => !n3.frameId || n3.frameId === t3.id);
var IH = (e8) => {
  let t3 = te(e8);
  return e8.length > 1 && e8.some((n3) => n3.frameId && t3.has(n3.frameId));
};
var f9 = (e8) => {
  let t3 = /* @__PURE__ */ new Set();
  return e8.forEach((n3) => {
    de2(n3) && t3.add(n3.id);
  }), e8.filter((n3) => !(n3.frameId && t3.has(n3.frameId)));
};
var ui = (e8, t3, n3, r = true) => {
  let [o3, i3, a3, s3] = C2(t3, n3), d = e8.filter((c3) => {
    let [l3, U, p, m] = Ke(c3, n3), b3 = We(c3, n3);
    if (b3) {
      let [E, g, h, x] = Ke(b3, n3);
      l3 = Math.max(E, l3), U = Math.max(g, U), p = Math.min(h, p), m = Math.min(x, m);
    }
    return c3.locked === false && c3.type !== "selection" && !Ne(c3) && o3 <= l3 && i3 <= U && a3 >= p && s3 >= m;
  });
  return d = r ? f9(d) : d, d = d.filter((c3) => {
    let l3 = We(c3, n3);
    return l3 ? hn(c3, l3, n3) : true;
  }), d;
};
var Ca = (e8, t3, n3, r) => {
  let o3 = new Set(t3.map((i3) => i3.id));
  return e8.filter((i3) => {
    let a3 = kp(i3, n3.width, n3.height, n3, r);
    return !o3.has(i3.id) && a3;
  });
};
var Ib = function() {
  let e8 = null, t3 = null, n3 = null, r = (o3, i3) => (n3 != null && o3 === e8 && i3.selectedElementIds === t3 || (n3 = o3.some((a3) => i3.selectedElementIds[a3.id]), e8 = o3, t3 = i3.selectedElementIds), n3);
  return r.clearCache = () => {
    e8 = null, t3 = null, n3 = null;
  }, r;
}();
var wb = (e8, t3, n3) => {
  let r = Array.from(new Set(at(e8, t3).map((o3) => n3(o3))));
  return r.length === 1 ? r[0] : null;
};
var at = (e8, t3, n3) => {
  let r = /* @__PURE__ */ new Set(), o3 = [];
  for (let i3 of e8.values()) {
    if (t3.selectedElementIds[i3.id]) {
      o3.push(i3), r.add(i3.id);
      continue;
    }
    if (n3?.includeBoundTextElement && Ne(i3) && t3.selectedElementIds[i3?.containerId]) {
      o3.push(i3), r.add(i3.id);
      continue;
    }
  }
  if (n3?.includeElementsInFrames) {
    let i3 = [];
    return o3.forEach((a3) => {
      de2(a3) && co(e8, a3.id).forEach((s3) => !r.has(s3.id) && i3.push(s3)), i3.push(a3);
    }), i3;
  }
  return o3;
};
var Rb = (e8, t3) => t3.editingTextElement ? [t3.editingTextElement] : t3.newElement ? [t3.newElement] : at(e8, t3, { includeBoundTextElement: true });
var Ha = (e8, t3) => Qt(t3.selectedElementIds, e8) ? t3.selectedElementIds : e8;
var Zp = (e8) => {
  let t3 = /* @__PURE__ */ new Map(), n3 = [];
  for (let r of e8) r.isDeleted || (n3.push(r), t3.set(r.id, r));
  return { elementsMap: t3, elements: n3 };
};
var u9 = (0, import_lodash.default)((e8) => {
  (c.DEV || c.MODE === je.TEST || window?.DEBUG_FRACTIONAL_INDICES) && Za(e8, { shouldThrow: c.DEV || c.MODE === je.TEST, includeBoundTextValidation: true });
}, 1e3 * 60, { leading: true, trailing: false });
var m9 = (e8) => {
  let t3 = ["includeBoundTextElement", "includeElementsInFrames"], n3 = "";
  for (let r of t3) n3 += `${r}:${e8[r] ? "1" : "0"}`;
  return n3;
};
var Wp = (e8) => typeof e8 == "string";
var Hn = class Hn2 {
  constructor() {
    i(this, "callbacks", /* @__PURE__ */ new Set());
    i(this, "nonDeletedElements", []);
    i(this, "nonDeletedElementsMap", tt(/* @__PURE__ */ new Map()));
    i(this, "elements", []);
    i(this, "nonDeletedFramesLikes", []);
    i(this, "frames", []);
    i(this, "elementsMap", tt(/* @__PURE__ */ new Map()));
    i(this, "selectedElementsCache", { selectedElementIds: null, elements: null, cache: /* @__PURE__ */ new Map() });
    i(this, "sceneNonce");
    i(this, "insertElement", (t3) => {
      let n3 = t3.frameId ? this.getElementIndex(t3.frameId) : this.elements.length;
      this.insertElementAtIndex(t3, n3);
    });
    i(this, "insertElements", (t3) => {
      if (!t3.length) return;
      let n3 = t3[0]?.frameId ? this.getElementIndex(t3[0].frameId) : this.elements.length;
      this.insertElementsAtIndex(t3, n3);
    });
    i(this, "getContainerElement", (t3) => t3 && t3.containerId && this.getElement(t3.containerId) || null);
    i(this, "getElementsFromId", (t3) => {
      let n3 = this.getNonDeletedElementsMap(), r = n3.get(t3);
      return r ? [r] : an(n3, t3);
    });
  }
  static mapElementToScene(t3, n3) {
    Wp(t3) ? this.sceneMapById.set(t3, n3) : (this.sceneMapByElement.set(t3, n3), this.sceneMapById.set(t3.id, n3));
  }
  static getScene(t3) {
    return Wp(t3) ? this.sceneMapById.get(t3) || null : this.sceneMapByElement.get(t3) || null;
  }
  getSceneNonce() {
    return this.sceneNonce;
  }
  getNonDeletedElementsMap() {
    return this.nonDeletedElementsMap;
  }
  getElementsIncludingDeleted() {
    return this.elements;
  }
  getElementsMapIncludingDeleted() {
    return this.elementsMap;
  }
  getNonDeletedElements() {
    return this.nonDeletedElements;
  }
  getFramesIncludingDeleted() {
    return this.frames;
  }
  getSelectedElements(t3) {
    let n3 = m9(t3), r = t3?.elements || this.nonDeletedElements;
    if (this.selectedElementsCache.elements === r && this.selectedElementsCache.selectedElementIds === t3.selectedElementIds) {
      let i3 = this.selectedElementsCache.cache.get(n3);
      if (i3) return i3;
    } else t3?.elements == null && this.selectedElementsCache.cache.clear();
    let o3 = at(r, { selectedElementIds: t3.selectedElementIds }, t3);
    return t3?.elements == null && (this.selectedElementsCache.selectedElementIds = t3.selectedElementIds, this.selectedElementsCache.elements = this.nonDeletedElements, this.selectedElementsCache.cache.set(n3, o3)), o3;
  }
  getNonDeletedFramesLikes() {
    return this.nonDeletedFramesLikes;
  }
  getElement(t3) {
    return this.elementsMap.get(t3) || null;
  }
  getNonDeletedElement(t3) {
    let n3 = this.getElement(t3);
    return n3 && zp(n3) ? n3 : null;
  }
  mapElements(t3) {
    let n3 = false, r = this.elements.map((o3) => {
      let i3 = t3(o3);
      return i3 !== o3 && (n3 = true), i3;
    });
    return n3 && this.replaceAllElements(r), n3;
  }
  replaceAllElements(t3) {
    let n3 = t3 instanceof Array ? t3 : Array.from(t3.values()), r = [];
    u9(n3), this.elements = An(n3), this.elementsMap.clear(), this.elements.forEach((i3) => {
      de2(i3) && r.push(i3), this.elementsMap.set(i3.id, i3), Hn2.mapElementToScene(i3, this);
    });
    let o3 = Zp(this.elements);
    this.nonDeletedElements = o3.elements, this.nonDeletedElementsMap = o3.elementsMap, this.frames = r, this.nonDeletedFramesLikes = Zp(this.frames).elements, this.triggerUpdate();
  }
  triggerUpdate() {
    this.sceneNonce = Vt();
    for (let t3 of Array.from(this.callbacks)) t3();
  }
  onUpdate(t3) {
    if (this.callbacks.has(t3)) throw new Error();
    return this.callbacks.add(t3), () => {
      if (!this.callbacks.has(t3)) throw new Error();
      this.callbacks.delete(t3);
    };
  }
  destroy() {
    this.elements = [], this.nonDeletedElements = [], this.nonDeletedFramesLikes = [], this.frames = [], this.elementsMap.clear(), this.selectedElementsCache.selectedElementIds = null, this.selectedElementsCache.elements = null, this.selectedElementsCache.cache.clear(), Hn2.sceneMapById.forEach((t3, n3) => {
      t3 === this && Hn2.sceneMapById.delete(n3);
    }), this.callbacks.clear();
  }
  insertElementAtIndex(t3, n3) {
    if (!Number.isFinite(n3) || n3 < 0) throw new Error("insertElementAtIndex can only be called with index >= 0");
    let r = [...this.elements.slice(0, n3), t3, ...this.elements.slice(n3)];
    Zr(r, te([t3])), this.replaceAllElements(r);
  }
  insertElementsAtIndex(t3, n3) {
    if (!t3.length) return;
    if (!Number.isFinite(n3) || n3 < 0) throw new Error("insertElementAtIndex can only be called with index >= 0");
    let r = [...this.elements.slice(0, n3), ...t3, ...this.elements.slice(n3)];
    Zr(r, te(t3)), this.replaceAllElements(r);
  }
  getElementIndex(t3) {
    return this.elements.findIndex((n3) => n3.id === t3);
  }
};
i(Hn, "sceneMapByElement", /* @__PURE__ */ new WeakMap()), i(Hn, "sceneMapById", /* @__PURE__ */ new Map());
var Rs = Hn;
var Ts = Rs;
var Y = (e8, t3, n3 = true, r) => {
  let o3 = false, { points: i3, fixedSegments: a3, fileId: s3, startBinding: d, endBinding: c3 } = t3;
  if (X(e8) && (Object.keys(t3).length === 0 || typeof i3 < "u" || typeof a3 < "u" || typeof d < "u" || typeof c3 < "u")) {
    let l3 = tt(Ts.getScene(e8)?.getNonDeletedElementsMap() ?? /* @__PURE__ */ new Map());
    t3 = { ...t3, angle: 0, ...Pi({ ...e8, x: t3.x || e8.x, y: t3.y || e8.y }, l3, { fixedSegments: a3, points: i3, startBinding: d, endBinding: c3 }, { isDragging: r?.isDragging }) };
  } else typeof i3 < "u" && (t3 = { ...xn(i3), ...t3 });
  for (let l3 in t3) {
    let U = t3[l3];
    if (typeof U < "u") {
      if (e8[l3] === U && (typeof U != "object" || U === null || l3 === "groupIds" || l3 === "scale")) continue;
      if (l3 === "scale") {
        let p = e8[l3], m = U;
        if (p[0] === m[0] && p[1] === m[1]) continue;
      } else if (l3 === "points") {
        let p = e8[l3], m = U;
        if (p.length === m.length) {
          let b3 = false, E = p.length;
          for (; --E; ) {
            let g = p[E], h = m[E];
            if (g[0] !== h[0] || g[1] !== h[1]) {
              b3 = true;
              break;
            }
          }
          if (!b3) continue;
        }
      }
      e8[l3] = U, o3 = true;
    }
  }
  return o3 && ((typeof t3.height < "u" || typeof t3.width < "u" || typeof s3 < "u" || typeof i3 < "u") && he2.delete(e8), e8.version++, e8.versionNonce = Vt(), e8.updated = zt(), n3 && Ts.getScene(e8)?.triggerUpdate()), e8;
};
var vt = (e8, t3, n3 = false) => {
  let r = false;
  for (let o3 in t3) {
    let i3 = t3[o3];
    if (typeof i3 < "u") {
      if (e8[o3] === i3 && (typeof i3 != "object" || i3 === null)) continue;
      r = true;
    }
  }
  return !r && !n3 ? e8 : { ...e8, ...t3, updated: zt(), version: e8.version + 1, versionNonce: Vt() };
};
var kr = (e8, t3) => (e8.version = (t3 ?? e8.version) + 1, e8.versionNonce = Vt(), e8.updated = zt(), e8);
var ao = (e8) => ae2(e8) || Ce(e8) ? e8.points.length < 2 : e8.width === 0 && e8.height === 0;
var kp = (e8, t3, n3, r, o3) => {
  let [i3, a3, s3, d] = Ke(e8, o3), c3 = Dn({ clientX: r.offsetLeft, clientY: r.offsetTop }, r), l3 = Dn({ clientX: r.offsetLeft + t3, clientY: r.offsetTop + n3 }, r);
  return c3.x <= s3 && c3.y <= d && l3.x >= i3 && l3.y >= a3;
};
var iJ = (e8, t3, n3, r, o3, i3) => {
  let [a3, s3, d, c3] = $e(e8, o3), l3 = Dn({ clientX: r.offsetLeft + (i3?.left || 0), clientY: r.offsetTop + (i3?.top || 0) }, r), U = Dn({ clientX: r.offsetLeft + t3 - (i3?.right || 0), clientY: r.offsetTop + n3 - (i3?.bottom || 0) }, r);
  return a3 >= l3.x && s3 >= l3.y && d <= U.x && c3 <= U.y;
};
var Oi = (e8, t3, n3) => {
  let r = Math.abs(t3), o3 = Math.abs(n3);
  if (e8 === "line" || e8 === "arrow" || e8 === "freedraw") {
    let i3 = Math.round(Math.atan(o3 / r) / Nt) * Nt;
    i3 === 0 ? n3 = 0 : i3 === Math.PI / 2 ? t3 = 0 : n3 = r * Math.tan(i3) * Math.sign(n3) || n3;
  } else e8 !== "selection" && (n3 = r * Math.sign(n3));
  return { width: t3, height: n3 };
};
var Va = (e8, t3, n3, r) => {
  let o3 = n3 - e8, i3 = r - t3, a3 = Math.round(Math.atan(i3 / o3) / Nt) * Nt;
  if (a3 === 0) i3 = 0;
  else if (a3 === Math.PI / 2) o3 = 0;
  else {
    let s3 = Math.tan(a3), d = -1, c3 = t3 - s3 * e8, l3 = -1 / s3, U = -1, p = r - l3 * n3, m = (d * p - U * c3) / (s3 * U - l3 * d), b3 = (c3 * l3 - p * s3) / (s3 * U - l3 * d);
    o3 = m - e8, i3 = b3 - t3;
  }
  return { width: o3, height: i3 };
};
var bs = (e8) => {
  let t3 = { width: e8.width, height: e8.height, x: e8.x, y: e8.y };
  if (e8.width < 0) {
    let n3 = Math.abs(e8.width);
    t3.width = n3, t3.x = e8.x - n3;
  }
  if (e8.height < 0) {
    let n3 = Math.abs(e8.height);
    t3.height = n3, t3.y = e8.y - n3;
  }
  return t3;
};
var Qp = { mouse: 8, pen: 16, touch: 28 };
var b9 = 16;
var e62 = { e: true, s: true, n: true, w: true };
var jp = { e: true, s: true, n: true, w: true, nw: true, se: true };
var Ms = { e: true, s: true, n: true, w: true };
var cn = (e8, t3, n3, r, o3, i3, a3) => {
  let [s3, d] = T(u(e8 + n3 / 2, t3 + r / 2), u(o3, i3), a3);
  return [s3 - n3 / 2, d - r / 2, n3, r];
};
var Ai = (e8) => !(e8.viewport.isMobile || e8.isTouchScreen && (Bs || _s));
var Ls = (e8) => Ai(e8) ? e62 : {};
var Ki = ([e8, t3, n3, r, o3, i3], a3, s3, d, c3 = {}, l3 = 4, U = br) => {
  let p = Qp[d], m = p / s3.value, b3 = p / s3.value, E = p / s3.value, g = p / s3.value, h = n3 - e8, x = r - t3, y = l3 / s3.value, w = (p - U * 2) / (2 * s3.value), I = { nw: c3.nw ? void 0 : cn(e8 - y - E + w, t3 - y - g + w, m, b3, o3, i3, a3), ne: c3.ne ? void 0 : cn(n3 + y - w, t3 - y - g + w, m, b3, o3, i3, a3), sw: c3.sw ? void 0 : cn(e8 - y - E + w, r + y - w, m, b3, o3, i3, a3), se: c3.se ? void 0 : cn(n3 + y - w, r + y - w, m, b3, o3, i3, a3), rotation: c3.rotation ? void 0 : cn(e8 + h / 2 - m / 2, t3 - y - g + w - b9 / s3.value, m, b3, o3, i3, a3) }, S = 5 * Qp.mouse / s3.value;
  return Math.abs(h) > S && (c3.n || (I.n = cn(e8 + h / 2 - m / 2, t3 - y - g + w, m, b3, o3, i3, a3)), c3.s || (I.s = cn(e8 + h / 2 - m / 2, r + y - w, m, b3, o3, i3, a3))), Math.abs(x) > S && (c3.w || (I.w = cn(e8 - y - E + w, t3 + x / 2 - b3 / 2, m, b3, o3, i3, a3)), c3.e || (I.e = cn(n3 + y - w, t3 + x / 2 - b3 / 2, m, b3, o3, i3, a3))), I;
};
var Ds = (e8, t3, n3, r = "mouse", o3 = e62) => {
  if (e8.locked || X(e8)) return {};
  if (e8.type === "freedraw" || ae2(e8)) {
    if (e8.points.length === 2) {
      let [, a3] = e8.points;
      a3[0] === 0 || a3[1] === 0 ? o3 = Ms : a3[0] > 0 && a3[1] < 0 ? o3 = jp : a3[0] > 0 && a3[1] > 0 ? o3 = Ms : a3[0] < 0 && a3[1] > 0 ? o3 = jp : a3[0] < 0 && a3[1] < 0 && (o3 = Ms);
    }
  } else de2(e8) && (o3 = { ...o3, rotation: true });
  let i3 = ae2(e8) ? br + 8 : Ye(e8) ? 0 : br;
  return Ki(C2(e8, n3, true), e8.angle, t3, r, o3, i3, Ye(e8) ? 0 : void 0);
};
var fJ = (e8, t3) => {
  if (t3.editingLinearElement) return false;
  if (e8.length > 1) return true;
  let n3 = e8[0];
  return X(n3) ? false : ae2(n3) ? n3.points.length > 2 : true;
};
var vs = (e8, t3, n3) => t3 >= e8[0] && t3 <= e8[0] + e8[2] && n3 >= e8[1] && n3 <= e8[1] + e8[3];
var t6 = (e8, t3, n3, r, o3, i3, a3, s3) => {
  if (!n3.selectedElementIds[e8.id]) return false;
  let { rotation: d, ...c3 } = Ds(e8, i3, t3, a3, Ls(s3));
  if (d && vs(d, r, o3)) return "rotation";
  let l3 = Object.keys(c3).filter((U) => {
    let p = c3[U];
    return p ? vs(p, r, o3) : false;
  });
  if (l3.length > 0) return l3[0];
  if (Ai(s3)) {
    let [U, p, m, b3, E, g] = C2(e8, t3);
    if (!(ae2(e8) && e8.points.length <= 2)) {
      let h = Ye(e8) ? 0 : Er / i3.value, x = Er / i3.value, y = n6(u(U - h, p - h), u(m + h, b3 + h), u(E, g), e8.angle);
      for (let [w, I] of Object.entries(y)) if (Bt(u(r, o3), I, x)) return w;
    }
  }
  return false;
};
var E9 = (e8, t3, n3, r, o3, i3, a3, s3) => e8.reduce((d, c3) => {
  if (d) return d;
  let l3 = t6(c3, a3, t3, n3, r, o3, i3, s3);
  return l3 ? { element: c3, transformHandleType: l3 } : null;
}, null);
var g9 = ([e8, t3, n3, r], o3, i3, a3, s3, d) => {
  let c3 = Ki([e8, t3, n3, r, (e8 + n3) / 2, (t3 + r) / 2], 0, a3, s3, Ls(d)), l3 = Object.keys(c3).find((U) => {
    let p = c3[U];
    return p && vs(p, o3, i3);
  });
  if (l3) return l3;
  if (Ai(d)) {
    let U = (e8 + n3) / 2, p = (t3 + r) / 2, m = Er / a3.value, b3 = n6(u(e8 - m, t3 - m), u(n3 + m, r + m), u(U, p), 0);
    for (let [E, g] of Object.entries(b3)) if (Bt(u(o3, i3), g, m)) return E;
  }
  return false;
};
var Ss = ["ns", "nesw", "ew", "nwse"];
var x9 = (e8, t3) => {
  let n3 = Ss.indexOf(e8);
  if (n3 >= 0) {
    let r = Math.round(t3 / (Math.PI / 4));
    e8 = Ss[(n3 + r) % Ss.length];
  }
  return e8;
};
var h9 = (e8) => {
  let { element: t3, transformHandleType: n3 } = e8, r = t3 && Math.sign(t3.height) * Math.sign(t3.width) === -1, o3 = null;
  switch (n3) {
    case "n":
    case "s":
      o3 = "ns";
      break;
    case "w":
    case "e":
      o3 = "ew";
      break;
    case "nw":
    case "se":
      r ? o3 = "nesw" : o3 = "nwse";
      break;
    case "ne":
    case "sw":
      r ? o3 = "nwse" : o3 = "nesw";
      break;
    case "rotation":
      return "grab";
  }
  return o3 && t3 && (o3 = x9(o3, t3.angle)), o3 ? `${o3}-resize` : "";
};
var n6 = ([e8, t3], [n3, r], o3, i3) => {
  let a3 = T(u(e8, t3), o3, i3), s3 = T(u(n3, t3), o3, i3), d = T(u(e8, r), o3, i3), c3 = T(u(n3, r), o3, i3);
  return { n: [a3, s3], e: [s3, c3], s: [c3, d], w: [d, a3] };
};
var y9 = (e8, t3, n3, r, o3, i3, a3, s3, d, c3, l3, U) => {
  if (n3.length === 1) {
    let [p] = n3;
    if (t3 === "rotation") X(p) || (I9(p, r, o3, d, c3, i3), Jt(p, r));
    else {
      if (k(p) && t3) return w9(e8, p, r, t3, a3, d, c3), Jt(p, r), true;
      if (t3) {
        let m = n3[0].id, b3 = r.get(m), E = e8.get(m);
        if (b3 && E) {
          let { nextWidth: g, nextHeight: h } = v9(b3, E, r, e8, t3, d, c3, { shouldMaintainAspectRatio: s3, shouldResizeFromCenter: a3 });
          S9(g, h, b3, E, r, e8, t3, { shouldMaintainAspectRatio: s3, shouldResizeFromCenter: a3 });
        }
      }
    }
    return true;
  } else if (n3.length > 1) {
    if (t3 === "rotation") return R9(e8, n3, r, o3, d, c3, i3, l3, U), true;
    if (t3) {
      let { nextWidth: p, nextHeight: m, flipByX: b3, flipByY: E, originalBoundingBox: g } = $9(n3, e8, r, t3, d, c3, { shouldMaintainAspectRatio: s3, shouldResizeFromCenter: a3 });
      return P9(n3, r, t3, o3, e8, { shouldResizeFromCenter: a3, shouldMaintainAspectRatio: s3, flipByX: b3, flipByY: E, nextWidth: p, nextHeight: m, originalBoundingBox: g }), true;
    }
  }
  return false;
};
var I9 = (e8, t3, n3, r, o3, i3) => {
  let [a3, s3, d, c3] = C2(e8, t3), l3 = (a3 + d) / 2, U = (s3 + c3) / 2, p;
  de2(e8) ? p = 0 : (p = 5 * Math.PI / 2 + Math.atan2(o3 - U, r - l3), i3 && (p = p + Nt / 2, p = p - p % Nt), p = hr(p));
  let m = Yt(e8);
  if (Y(e8, { angle: p }), m) {
    let b3 = n3.getElement(m);
    b3 && !ee2(e8) && Y(b3, { angle: p });
  }
};
var r6 = (e8, t3, n3, r) => ae2(e8) || Ce(e8) ? { points: nr(0, t3, nr(1, n3, e8.points, r), r) } : {};
var $s = (e8, t3, n3) => {
  let r = e8.width;
  if (Ne(e8)) {
    let a3 = qe(e8, t3);
    a3 && (r = Tt(a3, e8));
  }
  let i3 = e8.fontSize * (n3 / r);
  return i3 < Eo ? null : { size: i3 };
};
var w9 = (e8, t3, n3, r, o3, i3, a3) => {
  let [s3, d, c3, l3, U, p] = C2(t3, n3), [m, b3] = T(u(i3, a3), u(U, p), -t3.angle), E = 0, g = 0;
  r !== "e" && r !== "w" && (r.includes("e") && (E = (m - s3) / (c3 - s3)), r.includes("w") && (E = (c3 - m) / (c3 - s3)), r.includes("n") && (g = (l3 - b3) / (l3 - d)), r.includes("s") && (g = (b3 - d) / (l3 - d)));
  let h = Math.max(E, g);
  if (h > 0) {
    let x = t3.width * h, y = t3.height * h, w = $s(t3, n3, x);
    if (w === null) return;
    let I = [s3, d], S = [c3, l3], v = [U, p], D = u(s3, d);
    if (["n", "w", "nw"].includes(r) && (D = u(S[0] - Math.abs(x), S[1] - Math.abs(y))), r === "ne") {
      let V3 = [I[0], S[1]];
      D = u(V3[0], V3[1] - Math.abs(y));
    }
    if (r === "sw") {
      let V3 = [S[0], I[1]];
      D = u(V3[0] - Math.abs(x), V3[1]);
    }
    ["s", "n"].includes(r) && (D[0] = v[0] - x / 2), ["e", "w"].includes(r) && (D[1] = v[1] - y / 2), o3 && (D[0] = v[0] - Math.abs(x) / 2, D[1] = v[1] - Math.abs(y) / 2);
    let $3 = t3.angle, N = T(D, u(U, p), $3), B3 = u(D[0] + Math.abs(x) / 2, D[1] + Math.abs(y) / 2), _ = T(B3, u(U, p), $3);
    D = T(N, _, -$3);
    let [W, be] = D;
    Y(t3, { fontSize: w.size, width: x, height: y, x: W, y: be });
  }
  if (r === "e" || r === "w") {
    let x = e8.get(t3.id), [y, w, I, S] = Rt(x, x.width, x.height, true), v = u(y, w), D = u(I, S), $3 = Zt(v, D), N = T(u(i3, a3), $3, -x.angle), [B3, , _] = Rt(t3, t3.width, t3.height, true), W = _ - B3, be = D[0] - v[0], V3 = Ko(Ee({ fontSize: t3.fontSize, fontFamily: t3.fontFamily }), t3.lineHeight), ce2 = be / W;
    r.includes("e") && (ce2 = (N[0] - v[0]) / W), r.includes("w") && (ce2 = (D[0] - N[0]) / W);
    let J = t3.width * ce2 < V3 ? V3 : t3.width * ce2, j = en(t3.originalText, Ee(t3), Math.abs(J)), ye = ht(j, Ee(t3), t3.lineHeight), He = ye.height, [pr, Jn, Yn, Ji] = Rt(x, J, He, true), Uo = Yn - pr, Yi = Ji - Jn, Gt = [...v];
    ["n", "w", "nw"].includes(r) && (Gt = [D[0] - Math.abs(Uo), v[1]]);
    let ur = x.angle, Cn = T(Gt, $3, ur), Pt = u(Gt[0] + Math.abs(Uo) / 2, Gt[1] + Math.abs(Yi) / 2), mr = T(Pt, $3, ur);
    Gt = T(Cn, mr, -ur);
    let Ut = { width: Math.abs(J), height: Math.abs(ye.height), x: Gt[0], y: Gt[1], text: j, autoResize: false };
    Y(t3, Ut);
  }
};
var R9 = (e8, t3, n3, r, o3, i3, a3, s3, d) => {
  let c3 = 5 * Math.PI / 2 + Math.atan2(i3 - d, o3 - s3);
  a3 && (c3 += Nt / 2, c3 -= c3 % Nt);
  for (let l3 of t3) if (!de2(l3)) {
    let [U, p, m, b3] = C2(l3, n3), E = (U + m) / 2, g = (p + b3) / 2, h = e8.get(l3.id)?.angle ?? l3.angle, [x, y] = T(u(E, g), u(s3, d), c3 + h - l3.angle);
    X(l3) ? Y(l3, { points: U2(l3, n3) }) : Y(l3, { x: l3.x + (x - E), y: l3.y + (y - g), angle: hr(c3 + h) }, false), Jt(l3, n3, { simultaneouslyUpdated: t3 });
    let w = oe(l3, n3);
    w && !ee2(l3) && Y(w, { x: w.x + (x - E), y: w.y + (y - g), angle: hr(c3 + h) }, false);
  }
  r.triggerUpdate();
};
var T9 = (e8, t3, n3, r, o3) => {
  let [i3, a3, s3, d] = t3.length === 1 ? C2(t3[0], n3) : $e(t3), c3 = (i3 + s3) / 2, l3 = (a3 + d) / 2, U = t3.length === 1 ? t3[0].angle : 0;
  switch ([r, o3] = T(u(r, o3), u(c3, l3), -U), e8) {
    case "n":
      return T(u(r - (i3 + s3) / 2, o3 - a3), u(0, 0), U);
    case "s":
      return T(u(r - (i3 + s3) / 2, o3 - d), u(0, 0), U);
    case "w":
      return T(u(r - i3, o3 - (a3 + d) / 2), u(0, 0), U);
    case "e":
      return T(u(r - s3, o3 - (a3 + d) / 2), u(0, 0), U);
    case "nw":
      return T(u(r - i3, o3 - a3), u(0, 0), U);
    case "ne":
      return T(u(r - s3, o3 - a3), u(0, 0), U);
    case "sw":
      return T(u(r - i3, o3 - d), u(0, 0), U);
    case "se":
      return T(u(r - s3, o3 - d), u(0, 0), U);
    default:
      return [0, 0];
  }
};
var M9 = (e8, t3) => {
  let [, [n3, r]] = t3.points;
  return e8 === "nw" && (n3 < 0 || r < 0) || e8 === "ne" && n3 >= 0 || e8 === "sw" && n3 <= 0 || e8 === "se" && (n3 > 0 || r > 0) ? "end" : "origin";
};
var L9 = (e8, t3, n3) => {
  if (n3) return "center";
  if (t3) switch (e8) {
    case "n":
      return "south-side";
    case "e":
      return "west-side";
    case "s":
      return "north-side";
    case "w":
      return "east-side";
    case "ne":
      return "bottom-left";
    case "nw":
      return "bottom-right";
    case "se":
      return "top-left";
    case "sw":
      return "top-right";
  }
  return ["e", "se", "s"].includes(e8) ? "top-left" : ["n", "nw", "w"].includes(e8) ? "bottom-right" : e8 === "ne" ? "bottom-left" : "top-right";
};
var D9 = (e8, t3, n3, r, o3, i3, a3, s3, d) => {
  let c3 = L9(a3, s3, d), [l3, U] = e8;
  switch (c3) {
    case "top-left":
      return { x: l3 + (t3 - r) / 2 + (r - t3) / 2 * Math.cos(i3) + (n3 - o3) / 2 * Math.sin(i3), y: U + (n3 - o3) / 2 + (r - t3) / 2 * Math.sin(i3) + (o3 - n3) / 2 * Math.cos(i3) };
    case "top-right":
      return { x: l3 + (t3 - r) / 2 * (Math.cos(i3) + 1) + (n3 - o3) / 2 * Math.sin(i3), y: U + (n3 - o3) / 2 + (t3 - r) / 2 * Math.sin(i3) + (o3 - n3) / 2 * Math.cos(i3) };
    case "bottom-left":
      return { x: l3 + (t3 - r) / 2 * (1 - Math.cos(i3)) + (o3 - n3) / 2 * Math.sin(i3), y: U + (n3 - o3) / 2 * (Math.cos(i3) + 1) + (r - t3) / 2 * Math.sin(i3) };
    case "bottom-right":
      return { x: l3 + (t3 - r) / 2 * (Math.cos(i3) + 1) + (o3 - n3) / 2 * Math.sin(i3), y: U + (n3 - o3) / 2 * (Math.cos(i3) + 1) + (t3 - r) / 2 * Math.sin(i3) };
    case "center":
      return { x: l3 - (r - t3) / 2, y: U - (o3 - n3) / 2 };
    case "east-side":
      return { x: l3 + (t3 - r) / 2 * (Math.cos(i3) + 1), y: U + (t3 - r) / 2 * Math.sin(i3) + (n3 - o3) / 2 };
    case "west-side":
      return { x: l3 + (t3 - r) / 2 * (1 - Math.cos(i3)), y: U + (r - t3) / 2 * Math.sin(i3) + (n3 - o3) / 2 };
    case "north-side":
      return { x: l3 + (t3 - r) / 2 + (n3 - o3) / 2 * Math.sin(i3), y: U + (o3 - n3) / 2 * (Math.cos(i3) - 1) };
    case "south-side":
      return { x: l3 + (t3 - r) / 2 + (o3 - n3) / 2 * Math.sin(i3), y: U + (n3 - o3) / 2 * (Math.cos(i3) + 1) };
  }
};
var S9 = (e8, t3, n3, r, o3, i3, a3, { shouldInformMutation: s3 = true, shouldMaintainAspectRatio: d = false, shouldResizeFromCenter: c3 = false } = {}) => {
  let l3 = {}, U = oe(n3, o3);
  if (U) {
    let E = i3.get(U.id);
    if (E && (l3 = { fontSize: E.fontSize }), d) {
      let g = { ...n3, width: e8, height: t3 }, h = $s(U, o3, Tt(g, U));
      if (h === null) return;
      l3 = { fontSize: h.size };
    } else {
      let g = Td(Ee(U), U.lineHeight), h = Ld(U.fontSize, U.lineHeight);
      e8 = Math.max(e8, g), t3 = Math.max(t3, h);
    }
  }
  let p = r6(r, e8, t3, true), m = u(r.x, r.y);
  if (ae2(r)) {
    let [E, g] = Ke(r, i3);
    m = u(E, g);
  }
  let b3 = D9(m, r.width, r.height, e8, t3, r.angle, a3, d, c3);
  if (ae2(r) && p.points) {
    let E = r.x - m[0], g = r.y - m[1];
    b3.x += E, b3.y += g;
    let h = p.points[0][0], x = p.points[0][1];
    b3.x += h, b3.y += x, p.points = p.points.map((y) => u(y[0] - h, y[1] - x));
  }
  if (e8 < 0 && (b3.x = b3.x + e8), t3 < 0 && (b3.y = b3.y + t3), "scale" in n3 && "scale" in r && Y(n3, { scale: [(Math.sign(e8) || r.scale[0]) * r.scale[0], (Math.sign(t3) || r.scale[1]) * r.scale[1]] }), ee2(n3) && U && d) {
    let E = e8 / n3.width * U.fontSize;
    if (E < Eo) return;
    l3.fontSize = E;
  }
  if (e8 !== 0 && t3 !== 0 && Number.isFinite(b3.x) && Number.isFinite(b3.y)) {
    let E = { ...b3, width: Math.abs(e8), height: Math.abs(t3), ...p };
    Y(n3, E, s3), Jt(n3, o3, { newSize: { width: e8, height: t3 } }), U && l3 != null && Y(U, { fontSize: l3.fontSize }), _n(n3, o3, a3, d);
  }
};
var v9 = (e8, t3, n3, r, o3, i3, a3, { shouldMaintainAspectRatio: s3 = false, shouldResizeFromCenter: d = false } = {}) => {
  let [c3, l3, U, p] = Rt(t3, t3.width, t3.height, true), m = u(c3, l3), b3 = u(U, p), E = Zt(m, b3), g = T(u(i3, a3), E, -t3.angle), [h, x, y, w] = Rt(e8, e8.width, e8.height, true), I = y - h, S = w - x, v = b3[0] - m[0], D = b3[1] - m[1], $3 = v / I, N = D / S;
  o3.includes("e") && ($3 = (g[0] - m[0]) / I), o3.includes("s") && (N = (g[1] - m[1]) / S), o3.includes("w") && ($3 = (b3[0] - g[0]) / I), o3.includes("n") && (N = (b3[1] - g[1]) / S);
  let B3 = e8.width * $3, _ = e8.height * N;
  if (d && (B3 = 2 * B3 - t3.width, _ = 2 * _ - t3.height), s3) {
    let W = Math.abs(B3) / t3.width, be = Math.abs(_) / t3.height;
    if (o3.length === 1 && (_ *= W, B3 *= be), o3.length === 2) {
      let V3 = Math.max(W, be);
      B3 = t3.width * V3 * Math.sign(B3), _ = t3.height * V3 * Math.sign(_);
    }
  }
  return { nextWidth: B3, nextHeight: _ };
};
var $9 = (e8, t3, n3, r, o3, i3, { shouldMaintainAspectRatio: a3 = false, shouldResizeFromCenter: s3 = false } = {}) => {
  let d = e8.map((W) => t3.get(W.id)), c3 = d.reduce((W, be) => {
    if (!ae2(be)) return W;
    let V3 = Yt(be);
    if (!V3) return W;
    let ce2 = t3.get(V3) ?? null;
    return Ne(ce2) ? [...W, { ...ce2, ...z.getBoundTextElementPosition(be, ce2, n3) }] : W;
  }, []), l3 = Na(d.map((W) => W).concat(c3)), { minX: U, minY: p, maxX: m, maxY: b3, midX: E, midY: g } = l3, h = m - U, x = b3 - p, y = { ne: [U, b3], se: [U, p], sw: [m, p], nw: [m, b3], e: [U, p + x / 2], w: [m, p + x / 2], n: [U + h / 2, b3], s: [U + h / 2, p] }, [w, I] = s3 ? [E, g] : y[r], S = s3 ? 2 : 1, v = Math.max(Math.abs(o3 - w) / h || 0, Math.abs(i3 - I) / x || 0) * S, D = r.includes("e") || r.includes("w") ? Math.abs(o3 - w) * S : h, $3 = r.includes("n") || r.includes("s") ? Math.abs(i3 - I) * S : x;
  a3 && (D = h * v * Math.sign(o3 - w), $3 = x * v * Math.sign(i3 - I));
  let N = { ne: [o3 < w, i3 > I], se: [o3 < w, i3 < I], sw: [o3 > w, i3 < I], nw: [o3 > w, i3 > I], e: [o3 < w, false], w: [o3 > w, false], n: [false, i3 > I], s: [false, i3 < I] }, [B3, _] = N[r].map((W) => W);
  return { originalBoundingBox: l3, nextWidth: D, nextHeight: $3, flipByX: B3, flipByY: _ };
};
var P9 = (e8, t3, n3, r, o3, { shouldMaintainAspectRatio: i3 = false, shouldResizeFromCenter: a3 = false, flipByX: s3 = false, flipByY: d = false, nextHeight: c3, nextWidth: l3, originalBoundingBox: U } = {}) => {
  if (l3 === void 0 && c3 === void 0 && s3 === void 0 && d === void 0 || c3 === 0 || l3 === 0) return;
  o3 || (o3 = t3);
  let p = e8.reduce((S, v) => {
    let D = o3.get(v.id);
    return D && S.push({ orig: D, latest: v }), S;
  }, []), m;
  if (U) m = U;
  else {
    let S = p.reduce((v, { orig: D }) => {
      if (!ae2(D)) return v;
      let $3 = Yt(D);
      if (!$3) return v;
      let N = o3.get($3) ?? null;
      return Ne(N) ? [...v, { ...N, ...z.getBoundTextElementPosition(D, N, t3) }] : v;
    }, []);
    m = Na(p.map(({ orig: v }) => v).concat(S));
  }
  let { minX: b3, minY: E, maxX: g, maxY: h, midX: x, midY: y } = m, w = g - b3, I = h - E;
  if (l3 === void 0 && c3 === void 0 && (l3 = w, c3 = I), i3 && (l3 === void 0 ? l3 = c3 * (w / I) : c3 === void 0 ? c3 = l3 * (I / w) : Math.abs(l3 / c3 - w / I) > 1e-3 && (l3 = c3 * (w / I))), l3 && c3) {
    let S = n3.includes("e") || n3.includes("w") ? Math.abs(l3) / w : 1, v = n3.includes("n") || n3.includes("s") ? Math.abs(c3) / I : 1, D;
    n3.length === 1 ? D = n3.includes("e") || n3.includes("w") ? S : v : D = Math.max(Math.abs(l3) / w || 0, Math.abs(c3) / I || 0);
    let $3 = { ne: [b3, h], se: [b3, E], sw: [g, E], nw: [g, h], e: [b3, E + I / 2], w: [g, E + I / 2], n: [b3 + w / 2, h], s: [b3 + w / 2, E] }, [N, B3] = a3 ? [x, y] : $3[n3], _ = i3 || p.some((J) => J.latest.angle !== 0 || k(J.latest) || E2(J.latest));
    _ && (S = D, v = D);
    let [W, be] = [s3 ? -1 : 1, d ? -1 : 1], V3 = [];
    for (let { orig: J, latest: j } of p) {
      if (k(J) && Ne(J)) continue;
      let ye = J.width * S, He = J.height * v, pr = hr(J.angle * W * be), Jn = ae2(J) || Ce(J), Yn = J.x - N, Ji = J.y - B3, Uo = s3 && !Jn ? ye : 0, Yi = d && !Jn ? He : 0, Gt = N + W * (Yn * S + Uo), ur = B3 + be * (Ji * v + Yi), Cn = r6(J, ye * W, He * be, false), Pt = { x: Gt, y: ur, width: ye, height: He, angle: pr, ...Cn };
      if (X(J) && (J.startBinding && (Pt.startBinding = { ...J.startBinding, fixedPoint: [s3 ? -J.startBinding.fixedPoint[0] + 1 : J.startBinding.fixedPoint[0], d ? -J.startBinding.fixedPoint[1] + 1 : J.startBinding.fixedPoint[1]] }), J.endBinding && (Pt.endBinding = { ...J.endBinding, fixedPoint: [s3 ? -J.endBinding.fixedPoint[0] + 1 : J.endBinding.fixedPoint[0], d ? -J.endBinding.fixedPoint[1] + 1 : J.endBinding.fixedPoint[1]] }), J.fixedSegments && Cn.points && (Pt.fixedSegments = J.fixedSegments.map((Ut) => ({ ...Ut, start: Cn.points[Ut.index - 1], end: Cn.points[Ut.index] })))), Ye(J) && (Pt.scale = [J.scale[0] * W, J.scale[1] * be]), k(J)) {
        let Ut = $s(J, t3, ye);
        if (!Ut) return;
        Pt.fontSize = Ut.size;
      }
      let mr = o3.get(Yt(J) ?? "");
      if (mr) if (_) {
        let Ut = mr.fontSize * D;
        if (Ut < Eo) return;
        Pt.boundTextFontSize = Ut;
      } else Pt.boundTextFontSize = mr.fontSize;
      V3.push({ element: j, update: Pt });
    }
    let ce2 = V3.map(({ element: J }) => J);
    for (let { element: J, update: { boundTextFontSize: j, ...ye } } of V3) {
      let { width: He, height: pr, angle: Jn } = ye;
      Y(J, ye, false, { isDragging: true }), Jt(J, t3, { simultaneouslyUpdated: ce2, newSize: { width: He, height: pr } });
      let Yn = oe(J, t3);
      Yn && j && (Y(Yn, { fontSize: j, angle: ae2(J) ? void 0 : Jn }, false), _n(J, t3, n3, true));
    }
    r.triggerUpdate();
  }
};
var N9 = (e8, t3, n3, r, o3, i3) => {
  if (t3.length === 1 && X(t3[0]) && (t3[0].startBinding || t3[0].endBinding)) return;
  let a3 = t3.filter((U) => {
    if (X(U) && U.startBinding && U.endBinding) {
      let p = t3.find((b3) => b3.id === U.startBinding?.elementId), m = t3.find((b3) => b3.id === U.endBinding?.elementId);
      return p && m;
    }
    return true;
  }), s3 = new Set(a3), d = a3.filter((U) => de2(U)).map((U) => U.id);
  if (d.length > 0) for (let U of r.getNonDeletedElements()) U.frameId !== null && d.includes(U.frameId) && s3.add(U);
  let c3 = $e(Array.from(s3).map((U) => e8.originalElements.get(U.id) ?? U)), l3 = F9(c3, n3, o3, i3);
  s3.forEach((U) => {
    if (o6(e8, U, l3), !ee2(U)) {
      let p = oe(U, r.getNonDeletedElementsMap());
      p && o6(e8, p, l3), Jt(U, r.getElementsMapIncludingDeleted(), { simultaneouslyUpdated: Array.from(s3) });
    }
  });
};
var F9 = (e8, t3, n3, r) => {
  let [o3, i3] = e8, a3 = o3 + t3.x + n3.x, s3 = i3 + t3.y + n3.y;
  if (n3.x === 0 || n3.y === 0) {
    let [d, c3] = Vr(o3 + t3.x, i3 + t3.y, r);
    n3.x === 0 && (a3 = d), n3.y === 0 && (s3 = c3);
  }
  return { x: a3 - o3, y: s3 - i3 };
};
var o6 = (e8, t3, n3) => {
  let r = e8.originalElements.get(t3.id) ?? t3, o3 = r.x + n3.x, i3 = r.y + n3.y;
  Y(t3, { x: o3, y: i3 });
};
var B9 = (e8, t3, n3) => {
  let [r, o3] = $e(e8);
  return [t3 - r, n3 - o3];
};
var _9 = ({ newElement: e8, elementType: t3, originX: n3, originY: r, x: o3, y: i3, width: a3, height: s3, shouldMaintainAspectRatio: d, shouldResizeFromCenter: c3, zoom: l3, widthAspectRatio: U = null, originOffset: p = null, informMutation: m = true }) => {
  d && e8.type !== "selection" && (U ? s3 = a3 / U : (Math.abs(i3 - r) > Math.abs(o3 - n3) ? { width: a3, height: s3 } = Oi(t3, s3, o3 < n3 ? -a3 : a3) : { width: a3, height: s3 } = Oi(t3, a3, i3 < r ? -s3 : s3), s3 < 0 && (s3 = -s3)));
  let b3 = o3 < n3 ? n3 - a3 : n3, E = i3 < r ? r - s3 : r;
  c3 && (a3 += a3, s3 += s3, b3 = n3 - a3 / 2, E = r - s3 / 2);
  let g = null;
  if (k(e8)) {
    s3 = e8.height;
    let h = Ko(Ee({ fontSize: e8.fontSize, fontFamily: e8.fontFamily }), e8.lineHeight);
    a3 = Math.max(a3, h), Math.abs(o3 - n3) > Os / l3 && (g = { autoResize: false }), E = r, c3 && (b3 = n3 - a3 / 2);
  }
  if (a3 !== 0 && s3 !== 0) {
    let h = null;
    Ye(e8) && (h = { initialWidth: a3, initialHeight: s3 }), Y(e8, { x: b3 + (p?.x ?? 0), y: E + (p?.y ?? 0), width: a3, height: s3, ...g, ...h }, m);
  }
};
var O9 = (e8, t3) => !!(!e8.viewModeEnabled && e8.openDialog?.name !== "elementLinkSelector" && (e8.activeTool.type !== "custom" && (e8.editingTextElement || e8.activeTool.type !== "selection" && e8.activeTool.type !== "eraser" && e8.activeTool.type !== "hand" && e8.activeTool.type !== "laser") || at(t3, e8).length));
var nY = (e8) => e8.reduce((t3, n3) => t3 + n3.version, 0);
var rY = (e8) => {
  let t3 = 5381;
  for (let n3 = 0; n3 < e8.length; n3++) t3 = (t3 << 5) + t3 + e8[n3].versionNonce;
  return t3 >>> 0;
};
var X2 = (e8) => {
  let t3 = 5381;
  for (let n3 = 0; n3 < e8.length; n3++) {
    let r = e8.charCodeAt(n3);
    t3 = (t3 << 5) + t3 + r;
  }
  return t3 >>> 0;
};
var f2 = (e8) => e8.filter((t3) => !t3.isDeleted && !ao(t3));
var Es = (e8) => e8.filter((t3) => !t3.isDeleted);
var zp = (e8) => !e8.isDeleted;
var i6 = (e8) => Es(e8).map((t3) => na(t3.type) ? { ...t3, lastCommittedPoint: null } : t3);
var j2 = (e8) => i6(e8);
var Ri = (e8) => i6(e8);
var s6 = async (e8) => {
  let t3;
  if (e8.type === H.png) try {
    return await (await import("./image-GAAHSSAO-5FXDDPZA.js")).decodePngMetadata(e8);
  } catch (n3) {
    throw n3.message === "INVALID" ? new nn("Image doesn't contain scene", "IMAGE_NOT_CONTAINS_SCENE_DATA") : new nn("Error: cannot restore image");
  }
  else if ("text" in Blob ? t3 = await e8.text() : t3 = await new Promise((n3) => {
    let r = new FileReader();
    r.readAsText(e8, "utf8"), r.onloadend = () => {
      r.readyState === FileReader.DONE && n3(r.result);
    };
  }), e8.type === H.svg) try {
    return mp({ svg: t3 });
  } catch (n3) {
    throw n3.message === "INVALID" ? new nn("Image doesn't contain scene", "IMAGE_NOT_CONTAINS_SCENE_DATA") : new nn("Error: cannot restore image");
  }
  return t3;
};
var K9 = (e8) => e8 && e8.name.match(/\.(json|excalidraw|png|svg)$/)?.[1] || null;
var DY = (e8) => e8 === "png" || e8 === "svg";
var W2 = (e8) => {
  let t3 = K9(e8);
  return t3 === "png" || t3 === "svg";
};
var xs = (e8) => !!e8 && Object.values(yo).includes(e8);
var Hi = (e8) => {
  let { type: t3 } = e8 || {};
  return xs(t3);
};
var H9 = async (e8, t3, n3, r) => {
  let o3 = await s6(e8), i3;
  try {
    try {
      i3 = JSON.parse(o3);
    } catch (a3) {
      throw Hi(e8) ? new nn("Image doesn't contain scene", "IMAGE_NOT_CONTAINS_SCENE_DATA") : a3;
    }
    if (Q2(i3)) return { type: H.excalidraw, data: io({ elements: Ri(i3.elements || []), appState: { theme: t3?.theme, fileHandle: r || e8.handle || null, ...Ro(i3.appState || {}), ...t3 ? _a(i3.elements || [], t3) : {} }, files: i3.files }, t3, n3, { repairBindings: true, refreshDimensions: false }) };
    if (ns(i3)) return { type: H.excalidrawlib, data: i3 };
    throw new Error("Error: invalid file");
  } catch (a3) {
    throw a3 instanceof nn ? a3 : new Error("Error: invalid file");
  }
};
var z2 = async (e8, t3, n3, r) => {
  let o3 = await H9(e8, t3, n3, r);
  if (o3.type !== H.excalidraw) throw new Error("Error: invalid file");
  return o3.data;
};
var J9 = (e8, t3 = "unpublished") => {
  let n3 = JSON.parse(e8);
  if (!ns(n3)) throw new Error("Invalid library");
  let r = n3.libraryItems || n3.library;
  return Lp(r, t3);
};
var SY = async (e8, t3 = "unpublished") => J9(await s6(e8), t3);
var vY = async (e8) => new Promise(async (t3, n3) => {
  try {
    Fo(e8) && (e8 = await e8), e8.toBlob((r) => {
      if (!r) return n3(new Yo("Error: Canvas too big", "CANVAS_POSSIBLY_TOO_BIG"));
      t3(r);
    });
  } catch (r) {
    n3(r);
  }
});
var $Y = async (e8) => {
  try {
    let t3 = await window.crypto.subtle.digest("SHA-1", await ln(e8));
    return md(new Uint8Array(t3));
  } catch (t3) {
    return console.error(t3), nanoid(40);
  }
};
var PY = async (e8) => new Promise((t3, n3) => {
  let r = new FileReader();
  r.onload = () => {
    let o3 = r.result;
    t3(o3);
  }, r.onerror = (o3) => n3(o3), r.readAsDataURL(e8);
});
var NY = (e8, t3) => `data:${t3};base64,${Li(lo(e8), true)}`;
var FY = (e8, t3 = "") => {
  let n3 = e8.indexOf(","), r = atob(e8.slice(n3 + 1)), o3 = e8.slice(0, n3).split(":")[1].split(";")[0], i3 = new ArrayBuffer(r.length), a3 = new Uint8Array(i3);
  for (let s3 = 0; s3 < r.length; s3++) a3[s3] = r.charCodeAt(s3);
  return new File([i3], t3, { type: o3 });
};
var BY = (e8) => Di(e8.slice(e8.indexOf(",") + 1));
var _Y = async (e8, t3) => {
  if (e8.type === H.svg) return e8;
  let [n3, r] = await Promise.all([import("./pica-MLY4G4EU.js").then((i3) => i3.default), import("./image-blob-reduce.esm-4YIAT6JZ.js").then((i3) => i3.default)]), o3 = r({ pica: n3({ features: ["js", "wasm"] }) });
  if (t3.outputType) {
    let { outputType: i3 } = t3;
    o3._create_blob = function(a3) {
      return this.pica.toBlob(a3.out_canvas, i3, 0.8).then((s3) => (a3.out_blob = s3, a3));
    };
  }
  if (!Hi(e8)) throw new Error("Error: unsupported file type", { cause: "UNSUPPORTED" });
  return new File([await o3.toBlob(e8, { max: t3.maxWidthOrHeight, alpha: true })], e8.name, { type: t3.outputType || e8.type });
};
var OY = (e8, t3 = "") => new File([new TextEncoder().encode(e8)], t3, { type: H.svg });
var AY = async (e8, t3 = "") => {
  let n3;
  try {
    n3 = await fetch(e8);
  } catch {
    throw new Error("Error: failed to fetch image", { cause: "FETCH_ERROR" });
  }
  if (!n3.ok) throw new Error("Error: failed to fetch image", { cause: "FETCH_ERROR" });
  let r = await n3.blob();
  if (r.type && Hi(r)) {
    let o3 = t3 || r.name || "";
    return new File([r], o3, { type: r.type });
  }
  throw new Error("Error: unsupported file type", { cause: "UNSUPPORTED" });
};
var KY = async (e8) => {
  let t3 = e8.dataTransfer.files.item(0), n3 = await Y9(e8);
  return { file: t3 ? await ts(t3) : null, fileHandle: n3 };
};
var Y9 = async (e8) => {
  if (e) try {
    return await e8.dataTransfer.items[0].getAsFileSystemHandle() || null;
  } catch (t3) {
    return console.warn(t3.name, t3.message), null;
  }
  return null;
};
var a6 = (e8) => {
  let t3 = null, n3 = `${[...new Uint8Array(e8).slice(0, 8)].join(" ")} `, r = { png: "137 80 78 71 13 10 26 10 ", jpg: "255 216 255 ", gif: "71 73 70 56 57 97 " };
  return n3 === r.png ? t3 = H.png : n3.startsWith(r.jpg) ? t3 = H.jpg : n3.startsWith(r.gif) && (t3 = H.gif), t3;
};
var fr = (e8, t3, n3) => new File([e8], n3 || "", { type: t3 });
var ts = async (e8) => {
  if (e8.type) {
    if (Hi(e8)) {
      let t3 = await ln(e8), n3 = a6(t3);
      n3 && n3 !== e8.type && (e8 = fr(t3, n3, e8.name));
    }
  } else if (e8?.name?.endsWith(".excalidrawlib")) e8 = fr(await ln(e8), H.excalidrawlib, e8.name);
  else if (e8?.name?.endsWith(".excalidraw")) e8 = fr(await ln(e8), H.excalidraw, e8.name);
  else {
    let t3 = await ln(e8), n3 = a6(t3);
    n3 && (e8 = fr(t3, n3, e8.name));
  }
  return e8;
};
var ln = (e8) => "arrayBuffer" in e8 ? e8.arrayBuffer() : new Promise((t3, n3) => {
  let r = new FileReader();
  r.onload = (o3) => {
    if (!o3.target?.result) return n3(new Error("Couldn't convert blob to ArrayBuffer"));
    t3(o3.target.result);
  }, r.readAsArrayBuffer(e8);
});
var lo = (e8) => {
  let t3 = typeof e8 == "string" ? new TextEncoder().encode(e8) : e8 instanceof Uint8Array ? e8 : new Uint8Array(e8), n3 = "";
  for (let r of t3) n3 += String.fromCharCode(r);
  return n3;
};
var d6 = (e8) => {
  let t3 = new ArrayBuffer(e8.length), n3 = new Uint8Array(t3);
  for (let r = 0, o3 = e8.length; r < o3; r++) n3[r] = e8.charCodeAt(r);
  return t3;
};
var c6 = (e8) => new TextDecoder("utf-8").decode(d6(e8));
var Li = (e8, t3 = false) => t3 ? window.btoa(e8) : window.btoa(lo(e8));
var Di = (e8, t3 = false) => t3 ? window.atob(e8) : c6(window.atob(e8));
var Si = ({ text: e8, compress: t3 }) => {
  let n3;
  if (t3 !== false) try {
    n3 = lo(deflate_1$2(e8));
  } catch (r) {
    console.error("encode: cannot deflate", r);
  }
  return { version: "1", encoding: "bstring", compressed: !!n3, encoded: n3 || lo(e8) };
};
var vi = (e8) => {
  let t3;
  switch (e8.encoding) {
    case "bstring":
      t3 = e8.compressed ? e8.encoded : c6(e8.encoded);
      break;
    default:
      throw new Error(`decode: unknown encoding "${e8.encoding}"`);
  }
  return e8.compressed ? inflate_1$2(new Uint8Array(d6(t3)), { to: "string" }) : t3;
};
var X9 = async (e8) => {
  let n3 = (0, import_png_chunks_extract.default)(new Uint8Array(await ln(e8))).find((r) => r.name === "tEXt");
  return n3 ? import_png_chunk_text.default.decode(n3.data) : null;
};
var _p = async ({ blob: e8, metadata: t3 }) => {
  let n3 = (0, import_png_chunks_extract.default)(new Uint8Array(await ln(e8))), r = import_png_chunk_text.default.encode(H.excalidraw, JSON.stringify(Si({ text: t3, compress: true })));
  return n3.splice(-1, 0, r), new Blob([(0, import_png_chunks_encode.default)(n3)], { type: H.png });
};
var iC = async (e8) => {
  let t3 = await X9(e8);
  if (t3?.keyword === H.excalidraw) try {
    let n3 = JSON.parse(t3.text);
    if (!("encoded" in n3)) {
      if ("type" in n3 && n3.type === Ze.excalidraw) return t3.text;
      throw new Error("FAILED");
    }
    return vi(n3);
  } catch (n3) {
    throw console.error(n3), new Error("FAILED");
  }
  throw new Error("INVALID");
};

export {
  open_color_default,
  nanoid,
  require_lodash,
  rough_default,
  clsx_m_default,
  e,
  k9,
  Z9,
  fo,
  po,
  Z,
  W9,
  z9,
  Q9,
  j9,
  eE,
  tE,
  uo,
  iE,
  aE,
  sE,
  _s,
  dE,
  cE,
  lE,
  As,
  Ks,
  UE,
  fE,
  pE,
  uE,
  mo,
  mE,
  bE,
  EE,
  je,
  gE,
  Ie,
  ke,
  Pe,
  ut,
  Ft,
  Vn,
  go,
  br,
  xE,
  hE,
  yE,
  IE,
  xo,
  yo,
  H,
  wE,
  Ze,
  Ci,
  RE,
  TE,
  ME,
  LE,
  DE,
  Js,
  Ys,
  SE,
  Io,
  vE,
  $E,
  PE,
  NE,
  FE,
  BE,
  _E,
  Cs,
  Vi,
  OE,
  AE,
  re,
  qi,
  Se,
  kt,
  Xi,
  ot,
  KE,
  b6,
  HE,
  ks,
  JE,
  fn,
  YE,
  Zs,
  ki,
  CE,
  Ws,
  zs,
  E6,
  mt,
  td,
  nd,
  se2 as se,
  To,
  WE,
  Mo,
  yr,
  rd,
  Be,
  O,
  h6,
  Lo,
  ue2 as ue,
  Je,
  u,
  T,
  ie2 as ie,
  ng,
  rg,
  og,
  D6,
  ig,
  ag,
  ea,
  Ee,
  $o,
  pd,
  ud,
  sg,
  dg,
  dt,
  $r,
  cg,
  Dn,
  ta,
  lg,
  un,
  Ug,
  fg,
  pg,
  Wt,
  ug,
  mg,
  bg,
  Eg,
  te,
  gg,
  xg,
  Ot,
  hg,
  yg,
  Ig,
  wg,
  Fo,
  Rg,
  Qt,
  Tg,
  Sn,
  Ae,
  Mg,
  Ed,
  Lg,
  Dg,
  Sg,
  vg,
  gd,
  tt,
  mn,
  $g,
  At,
  Ye,
  Bo,
  _o,
  gt,
  k,
  hd,
  yd,
  de2 as de,
  ae2 as ae,
  ee2 as ee,
  X,
  na,
  Pr,
  N6,
  xt,
  F6,
  ra,
  Og,
  bn,
  Ne,
  Oo,
  Ag,
  Kg,
  ht,
  Td,
  Ko,
  Vg,
  ia,
  Zn,
  Ld,
  qg,
  Dd,
  en,
  he2 as he,
  Ux,
  fx,
  px,
  ux,
  mx,
  bx,
  Ex,
  gx,
  xx,
  yx,
  Nr,
  Ad,
  Ix,
  wx,
  Rx,
  Tx,
  Mx,
  Lx,
  Dx,
  Sx,
  vx,
  $x,
  Px,
  Nx,
  Fx,
  Bx,
  _x,
  Ox,
  Ax,
  Kx,
  Hx,
  Jx,
  Yx,
  Vx,
  qx,
  Xx,
  Gx,
  Wx,
  Qx,
  jx,
  eh,
  th,
  sh,
  dh,
  ch,
  lh,
  Uh,
  fh,
  ph,
  uh,
  mh,
  bh,
  Eh,
  gh,
  xh,
  Ih,
  Mh,
  Lh,
  Dh,
  Sh,
  vh,
  $h,
  Ph,
  Nh,
  Fh,
  _h,
  Oh,
  Ah,
  Kh,
  Hh,
  Jh,
  Yh,
  Ch,
  Vh,
  qh,
  Xh,
  Gh,
  kh,
  Zh,
  Wh,
  zh,
  Qh,
  jh,
  e4,
  t4,
  n4,
  r4,
  o4,
  i4,
  la,
  Ua,
  a4,
  s4,
  d4,
  c4,
  l4,
  U4,
  f4,
  p4,
  m4,
  b4,
  E4,
  g4,
  x4,
  I4,
  w4,
  R4,
  T4,
  M4,
  L4,
  D4,
  S4,
  v4,
  N4,
  F4,
  B4,
  _4,
  O4,
  A4,
  K4,
  H4,
  J4,
  Y4,
  C4,
  V4,
  q4,
  X4,
  G4,
  k4,
  Z4,
  W4,
  z4,
  Q4,
  j4,
  ty,
  ny,
  ry,
  oy,
  iy,
  ay,
  sy,
  dy,
  cy,
  ly,
  Uy,
  Co,
  nn,
  Nn,
  ko,
  f$,
  Wo,
  xm,
  ba,
  A$,
  hm,
  D1,
  Q,
  Y$,
  C$,
  V$,
  q$,
  ga,
  Mm,
  iP,
  ti,
  L1,
  wt,
  it,
  Kt,
  Ge,
  lP,
  er,
  UP,
  Pm,
  vP,
  Fn,
  wa,
  Am,
  NP,
  Km,
  Hm,
  Ta,
  FP,
  Jm,
  Re,
  Fe,
  nt,
  ze,
  ve,
  q1,
  xn,
  C2 as C,
  $e,
  Na,
  fN,
  FN,
  Fa,
  t2,
  n2,
  Ba,
  BN,
  _N,
  ON,
  di,
  ab,
  Bn,
  Jt,
  fi,
  d2,
  AN,
  KN,
  pi,
  yb,
  _a,
  Oa,
  Ka,
  Tb,
  aF,
  sF,
  Mb,
  dF,
  p2,
  cF,
  Lb,
  an,
  lF,
  UF,
  fF,
  Ja,
  b2,
  E2,
  mi,
  Sb,
  sr,
  IF,
  wF,
  RF,
  TF,
  MF,
  LF,
  DF,
  Vr,
  z,
  qr,
  I2,
  w2,
  WF,
  Xa,
  dB,
  _n,
  R22 as R2,
  Yt,
  oe,
  qe,
  cB,
  lB,
  UB,
  fB,
  pB,
  qa,
  Tt,
  Ar,
  Bb,
  dn,
  gB,
  T2,
  M2,
  L2,
  Hb,
  Jb,
  Yb,
  $2,
  Vt,
  Dt,
  Xr,
  VB,
  qB,
  XB,
  GB,
  qt,
  Ga,
  kB,
  On,
  Zb,
  Wb,
  Gr,
  zb,
  ZB,
  Za,
  B2,
  Zr,
  An,
  hi,
  dr,
  O2,
  za,
  V2,
  J_,
  Y_,
  Z2,
  es,
  to,
  hO,
  yO,
  p7,
  IO,
  u7,
  ep,
  tp,
  LO,
  is,
  b7,
  BO,
  KO,
  np,
  rp,
  qO,
  XO,
  E7,
  op,
  GO,
  x7,
  cp,
  pp,
  up,
  TA,
  Pi,
  Mp,
  J7,
  io,
  Lp,
  uK,
  k7,
  LK,
  DK,
  Np,
  SK,
  vK,
  Bp,
  hs,
  t9,
  n9,
  r9,
  HK,
  Ap,
  a9,
  Hp,
  uH,
  Bi,
  hn,
  mH,
  bH,
  co,
  ds,
  cs,
  EH,
  gH,
  We,
  xH,
  l9,
  Xp,
  U9,
  hH,
  yH,
  Gp,
  bp,
  Ep,
  IH,
  f9,
  ui,
  Ib,
  wb,
  at,
  Rb,
  Ha,
  Ts,
  Y,
  vt,
  kr,
  ao,
  kp,
  iJ,
  Va,
  bs,
  Ls,
  Ki,
  Ds,
  fJ,
  E9,
  g9,
  h9,
  y9,
  r6,
  T9,
  M9,
  S9,
  P9,
  N9,
  B9,
  _9,
  O9,
  nY,
  rY,
  X2,
  Es,
  zp,
  K9,
  DY,
  W2,
  Hi,
  H9,
  z2,
  J9,
  SY,
  vY,
  $Y,
  PY,
  NY,
  FY,
  BY,
  _Y,
  OY,
  AY,
  KY,
  ts,
  X9,
  _p,
  iC
};
/*! Bundled license information:

pako/dist/pako.esm.mjs:
  (*! pako 2.0.3 https://github.com/nodeca/pako @license (MIT AND Zlib) *)
*/
