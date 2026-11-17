import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from2, except, desc) => {
  if (from2 && typeof from2 === "object" || typeof from2 === "function") {
    for (let key of __getOwnPropNames(from2))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from2[key], enumerable: !(desc = __getOwnPropDesc(from2, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/ws/lib/constants.js
var require_constants = __commonJS({
  "node_modules/ws/lib/constants.js"(exports, module) {
    "use strict";
    var BINARY_TYPES = ["nodebuffer", "arraybuffer", "fragments"];
    var hasBlob = typeof Blob !== "undefined";
    if (hasBlob) BINARY_TYPES.push("blob");
    module.exports = {
      BINARY_TYPES,
      CLOSE_TIMEOUT: 3e4,
      EMPTY_BUFFER: Buffer.alloc(0),
      GUID: "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
      hasBlob,
      kForOnEventAttribute: /* @__PURE__ */ Symbol("kIsForOnEventAttribute"),
      kListener: /* @__PURE__ */ Symbol("kListener"),
      kStatusCode: /* @__PURE__ */ Symbol("status-code"),
      kWebSocket: /* @__PURE__ */ Symbol("websocket"),
      NOOP: () => {
      }
    };
  }
});

// node_modules/ws/lib/buffer-util.js
var require_buffer_util = __commonJS({
  "node_modules/ws/lib/buffer-util.js"(exports, module) {
    "use strict";
    var { websocketMask, websocketUnmask } = __require("http");
    var { EMPTY_BUFFER } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    function concat(list, totalLength) {
      if (list.length === 0) return EMPTY_BUFFER;
      if (list.length === 1) return list[0];
      const target = Buffer.allocUnsafe(totalLength);
      let offset = 0;
      for (let i = 0; i < list.length; i++) {
        const buf = list[i];
        target.set(buf, offset);
        offset += buf.length;
      }
      if (offset < totalLength) {
        return new FastBuffer(target.buffer, target.byteOffset, offset);
      }
      return target;
    }
    function _mask(source, mask, output, offset, length) {
      for (let i = 0; i < length; i++) {
        output[offset + i] = source[i] ^ mask[i & 3];
      }
    }
    function _unmask(buffer, mask) {
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] ^= mask[i & 3];
      }
    }
    function toArrayBuffer(buf) {
      if (buf.length === buf.buffer.byteLength) {
        return buf.buffer;
      }
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
    }
    function toBuffer(data) {
      toBuffer.readOnly = true;
      if (Buffer.isBuffer(data)) return data;
      let buf;
      if (data instanceof ArrayBuffer) {
        buf = new FastBuffer(data);
      } else if (ArrayBuffer.isView(data)) {
        buf = new FastBuffer(data.buffer, data.byteOffset, data.byteLength);
      } else {
        buf = Buffer.from(data);
        toBuffer.readOnly = false;
      }
      return buf;
    }
    module.exports = {
      concat,
      mask: _mask,
      toArrayBuffer,
      toBuffer,
      unmask: _unmask
    };
    if (websocketMask) {
      module.exports.mask = function(source, mask, output, offset, length) {
        if (length < 24) _mask(source, mask, output, offset, length);
        else websocketMask(source, mask, output, offset, length);
      };
      module.exports.unmask = function(buffer, mask) {
        if (buffer.length < 24) _unmask(buffer, mask);
        else websocketUnmask(buffer, mask);
      };
    } else if (!process.env.WS_NO_BUFFER_UTIL) {
      try {
        const bufferUtil = __require("bufferutil");
        module.exports.mask = function(source, mask, output, offset, length) {
          if (length < 48) _mask(source, mask, output, offset, length);
          else bufferUtil.mask(source, mask, output, offset, length);
        };
        module.exports.unmask = function(buffer, mask) {
          if (buffer.length < 32) _unmask(buffer, mask);
          else bufferUtil.unmask(buffer, mask);
        };
      } catch (e) {
      }
    }
  }
});

// node_modules/ws/lib/limiter.js
var require_limiter = __commonJS({
  "node_modules/ws/lib/limiter.js"(exports, module) {
    "use strict";
    var kDone = /* @__PURE__ */ Symbol("kDone");
    var kRun = /* @__PURE__ */ Symbol("kRun");
    var Limiter = class {
      /**
       * Creates a new `Limiter`.
       *
       * @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
       *     to run concurrently
       */
      constructor(concurrency) {
        this[kDone] = () => {
          this.pending--;
          this[kRun]();
        };
        this.concurrency = concurrency || Infinity;
        this.jobs = [];
        this.pending = 0;
      }
      /**
       * Adds a job to the queue.
       *
       * @param {Function} job The job to run
       * @public
       */
      add(job) {
        this.jobs.push(job);
        this[kRun]();
      }
      /**
       * Removes a job from the queue and runs it if possible.
       *
       * @private
       */
      [kRun]() {
        if (this.pending === this.concurrency) return;
        if (this.jobs.length) {
          const job = this.jobs.shift();
          this.pending++;
          job(this[kDone]);
        }
      }
    };
    module.exports = Limiter;
  }
});

// node_modules/ws/lib/permessage-deflate.js
var require_permessage_deflate = __commonJS({
  "node_modules/ws/lib/permessage-deflate.js"(exports, module) {
    "use strict";
    var zlib = __require("zlib");
    var bufferUtil = require_buffer_util();
    var Limiter = require_limiter();
    var { kStatusCode } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    var TRAILER = Buffer.from([0, 0, 255, 255]);
    var kPerMessageDeflate = /* @__PURE__ */ Symbol("permessage-deflate");
    var kTotalLength = /* @__PURE__ */ Symbol("total-length");
    var kCallback = /* @__PURE__ */ Symbol("callback");
    var kBuffers = /* @__PURE__ */ Symbol("buffers");
    var kError = /* @__PURE__ */ Symbol("error");
    var zlibLimiter;
    var PerMessageDeflate2 = class {
      /**
       * Creates a PerMessageDeflate instance.
       *
       * @param {Object} [options] Configuration options
       * @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
       *     for, or request, a custom client window size
       * @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
       *     acknowledge disabling of client context takeover
       * @param {Number} [options.concurrencyLimit=10] The number of concurrent
       *     calls to zlib
       * @param {Boolean} [options.isServer=false] Create the instance in either
       *     server or client mode
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
       *     use of a custom server window size
       * @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
       *     disabling of server context takeover
       * @param {Number} [options.threshold=1024] Size (in bytes) below which
       *     messages should not be compressed if context takeover is disabled
       * @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
       *     deflate
       * @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
       *     inflate
       */
      constructor(options) {
        this._options = options || {};
        this._threshold = this._options.threshold !== void 0 ? this._options.threshold : 1024;
        this._maxPayload = this._options.maxPayload | 0;
        this._isServer = !!this._options.isServer;
        this._deflate = null;
        this._inflate = null;
        this.params = null;
        if (!zlibLimiter) {
          const concurrency = this._options.concurrencyLimit !== void 0 ? this._options.concurrencyLimit : 10;
          zlibLimiter = new Limiter(concurrency);
        }
      }
      /**
       * @type {String}
       */
      static get extensionName() {
        return "permessage-deflate";
      }
      /**
       * Create an extension negotiation offer.
       *
       * @return {Object} Extension parameters
       * @public
       */
      offer() {
        const params = {};
        if (this._options.serverNoContextTakeover) {
          params.server_no_context_takeover = true;
        }
        if (this._options.clientNoContextTakeover) {
          params.client_no_context_takeover = true;
        }
        if (this._options.serverMaxWindowBits) {
          params.server_max_window_bits = this._options.serverMaxWindowBits;
        }
        if (this._options.clientMaxWindowBits) {
          params.client_max_window_bits = this._options.clientMaxWindowBits;
        } else if (this._options.clientMaxWindowBits == null) {
          params.client_max_window_bits = true;
        }
        return params;
      }
      /**
       * Accept an extension negotiation offer/response.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Object} Accepted configuration
       * @public
       */
      accept(configurations) {
        configurations = this.normalizeParams(configurations);
        this.params = this._isServer ? this.acceptAsServer(configurations) : this.acceptAsClient(configurations);
        return this.params;
      }
      /**
       * Releases all resources used by the extension.
       *
       * @public
       */
      cleanup() {
        if (this._inflate) {
          this._inflate.close();
          this._inflate = null;
        }
        if (this._deflate) {
          const callback = this._deflate[kCallback];
          this._deflate.close();
          this._deflate = null;
          if (callback) {
            callback(
              new Error(
                "The deflate stream was closed while data was being processed"
              )
            );
          }
        }
      }
      /**
       *  Accept an extension negotiation offer.
       *
       * @param {Array} offers The extension negotiation offers
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsServer(offers) {
        const opts = this._options;
        const accepted = offers.find((params) => {
          if (opts.serverNoContextTakeover === false && params.server_no_context_takeover || params.server_max_window_bits && (opts.serverMaxWindowBits === false || typeof opts.serverMaxWindowBits === "number" && opts.serverMaxWindowBits > params.server_max_window_bits) || typeof opts.clientMaxWindowBits === "number" && (typeof params.client_max_window_bits === "number" ? opts.clientMaxWindowBits > params.client_max_window_bits : !params.client_max_window_bits)) {
            return false;
          }
          return true;
        });
        if (!accepted) {
          throw new Error("None of the extension offers can be accepted");
        }
        if (opts.serverNoContextTakeover) {
          accepted.server_no_context_takeover = true;
        }
        if (opts.clientNoContextTakeover) {
          accepted.client_no_context_takeover = true;
        }
        if (typeof opts.serverMaxWindowBits === "number") {
          accepted.server_max_window_bits = opts.serverMaxWindowBits;
        }
        if (typeof opts.clientMaxWindowBits === "number") {
          accepted.client_max_window_bits = opts.clientMaxWindowBits;
        } else if (accepted.client_max_window_bits === true || opts.clientMaxWindowBits === false) {
          delete accepted.client_max_window_bits;
        }
        return accepted;
      }
      /**
       * Accept the extension negotiation response.
       *
       * @param {Array} response The extension negotiation response
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsClient(response) {
        const params = response[0];
        if (this._options.clientNoContextTakeover === false && params.client_no_context_takeover) {
          throw new Error('Unexpected parameter "client_no_context_takeover"');
        }
        if (!params.client_max_window_bits) {
          if (typeof this._options.clientMaxWindowBits === "number") {
            params.client_max_window_bits = this._options.clientMaxWindowBits;
          }
        } else if (this._options.clientMaxWindowBits === false || typeof this._options.clientMaxWindowBits === "number" && params.client_max_window_bits > this._options.clientMaxWindowBits) {
          throw new Error(
            'Unexpected or invalid parameter "client_max_window_bits"'
          );
        }
        return params;
      }
      /**
       * Normalize parameters.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Array} The offers/response with normalized parameters
       * @private
       */
      normalizeParams(configurations) {
        configurations.forEach((params) => {
          Object.keys(params).forEach((key) => {
            let value = params[key];
            if (value.length > 1) {
              throw new Error(`Parameter "${key}" must have only a single value`);
            }
            value = value[0];
            if (key === "client_max_window_bits") {
              if (value !== true) {
                const num = +value;
                if (!Number.isInteger(num) || num < 8 || num > 15) {
                  throw new TypeError(
                    `Invalid value for parameter "${key}": ${value}`
                  );
                }
                value = num;
              } else if (!this._isServer) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else if (key === "server_max_window_bits") {
              const num = +value;
              if (!Number.isInteger(num) || num < 8 || num > 15) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
              value = num;
            } else if (key === "client_no_context_takeover" || key === "server_no_context_takeover") {
              if (value !== true) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else {
              throw new Error(`Unknown parameter "${key}"`);
            }
            params[key] = value;
          });
        });
        return configurations;
      }
      /**
       * Decompress data. Concurrency limited.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      decompress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._decompress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Compress data. Concurrency limited.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      compress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._compress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Decompress data.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _decompress(data, fin, callback) {
        const endpoint = this._isServer ? "client" : "server";
        if (!this._inflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._inflate = zlib.createInflateRaw({
            ...this._options.zlibInflateOptions,
            windowBits
          });
          this._inflate[kPerMessageDeflate] = this;
          this._inflate[kTotalLength] = 0;
          this._inflate[kBuffers] = [];
          this._inflate.on("error", inflateOnError);
          this._inflate.on("data", inflateOnData);
        }
        this._inflate[kCallback] = callback;
        this._inflate.write(data);
        if (fin) this._inflate.write(TRAILER);
        this._inflate.flush(() => {
          const err = this._inflate[kError];
          if (err) {
            this._inflate.close();
            this._inflate = null;
            callback(err);
            return;
          }
          const data2 = bufferUtil.concat(
            this._inflate[kBuffers],
            this._inflate[kTotalLength]
          );
          if (this._inflate._readableState.endEmitted) {
            this._inflate.close();
            this._inflate = null;
          } else {
            this._inflate[kTotalLength] = 0;
            this._inflate[kBuffers] = [];
            if (fin && this.params[`${endpoint}_no_context_takeover`]) {
              this._inflate.reset();
            }
          }
          callback(null, data2);
        });
      }
      /**
       * Compress data.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _compress(data, fin, callback) {
        const endpoint = this._isServer ? "server" : "client";
        if (!this._deflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._deflate = zlib.createDeflateRaw({
            ...this._options.zlibDeflateOptions,
            windowBits
          });
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          this._deflate.on("data", deflateOnData);
        }
        this._deflate[kCallback] = callback;
        this._deflate.write(data);
        this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
          if (!this._deflate) {
            return;
          }
          let data2 = bufferUtil.concat(
            this._deflate[kBuffers],
            this._deflate[kTotalLength]
          );
          if (fin) {
            data2 = new FastBuffer(data2.buffer, data2.byteOffset, data2.length - 4);
          }
          this._deflate[kCallback] = null;
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          if (fin && this.params[`${endpoint}_no_context_takeover`]) {
            this._deflate.reset();
          }
          callback(null, data2);
        });
      }
    };
    module.exports = PerMessageDeflate2;
    function deflateOnData(chunk) {
      this[kBuffers].push(chunk);
      this[kTotalLength] += chunk.length;
    }
    function inflateOnData(chunk) {
      this[kTotalLength] += chunk.length;
      if (this[kPerMessageDeflate]._maxPayload < 1 || this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload) {
        this[kBuffers].push(chunk);
        return;
      }
      this[kError] = new RangeError("Max payload size exceeded");
      this[kError].code = "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH";
      this[kError][kStatusCode] = 1009;
      this.removeListener("data", inflateOnData);
      this.reset();
    }
    function inflateOnError(err) {
      this[kPerMessageDeflate]._inflate = null;
      if (this[kError]) {
        this[kCallback](this[kError]);
        return;
      }
      err[kStatusCode] = 1007;
      this[kCallback](err);
    }
  }
});

// node_modules/ws/lib/validation.js
var require_validation = __commonJS({
  "node_modules/ws/lib/validation.js"(exports, module) {
    "use strict";
    var { isUtf8 } = __require("buffer");
    var { hasBlob } = require_constants();
    var tokenChars = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 0 - 15
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 16 - 31
      0,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      1,
      1,
      0,
      1,
      1,
      0,
      // 32 - 47
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      // 48 - 63
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 64 - 79
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      1,
      1,
      // 80 - 95
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 96 - 111
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      1,
      0,
      1,
      0
      // 112 - 127
    ];
    function isValidStatusCode(code) {
      return code >= 1e3 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006 || code >= 3e3 && code <= 4999;
    }
    function _isValidUTF8(buf) {
      const len = buf.length;
      let i = 0;
      while (i < len) {
        if ((buf[i] & 128) === 0) {
          i++;
        } else if ((buf[i] & 224) === 192) {
          if (i + 1 === len || (buf[i + 1] & 192) !== 128 || (buf[i] & 254) === 192) {
            return false;
          }
          i += 2;
        } else if ((buf[i] & 240) === 224) {
          if (i + 2 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || buf[i] === 224 && (buf[i + 1] & 224) === 128 || // Overlong
          buf[i] === 237 && (buf[i + 1] & 224) === 160) {
            return false;
          }
          i += 3;
        } else if ((buf[i] & 248) === 240) {
          if (i + 3 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || (buf[i + 3] & 192) !== 128 || buf[i] === 240 && (buf[i + 1] & 240) === 128 || // Overlong
          buf[i] === 244 && buf[i + 1] > 143 || buf[i] > 244) {
            return false;
          }
          i += 4;
        } else {
          return false;
        }
      }
      return true;
    }
    function isBlob(value) {
      return hasBlob && typeof value === "object" && typeof value.arrayBuffer === "function" && typeof value.type === "string" && typeof value.stream === "function" && (value[Symbol.toStringTag] === "Blob" || value[Symbol.toStringTag] === "File");
    }
    module.exports = {
      isBlob,
      isValidStatusCode,
      isValidUTF8: _isValidUTF8,
      tokenChars
    };
    if (isUtf8) {
      module.exports.isValidUTF8 = function(buf) {
        return buf.length < 24 ? _isValidUTF8(buf) : isUtf8(buf);
      };
    } else if (!process.env.WS_NO_UTF_8_VALIDATE) {
      try {
        const isValidUTF8 = __require("utf-8-validate");
        module.exports.isValidUTF8 = function(buf) {
          return buf.length < 32 ? _isValidUTF8(buf) : isValidUTF8(buf);
        };
      } catch (e) {
      }
    }
  }
});

// node_modules/ws/lib/receiver.js
var require_receiver = __commonJS({
  "node_modules/ws/lib/receiver.js"(exports, module) {
    "use strict";
    var { Writable } = __require("stream");
    var PerMessageDeflate2 = require_permessage_deflate();
    var {
      BINARY_TYPES,
      EMPTY_BUFFER,
      kStatusCode,
      kWebSocket
    } = require_constants();
    var { concat, toArrayBuffer, unmask } = require_buffer_util();
    var { isValidStatusCode, isValidUTF8 } = require_validation();
    var FastBuffer = Buffer[Symbol.species];
    var GET_INFO = 0;
    var GET_PAYLOAD_LENGTH_16 = 1;
    var GET_PAYLOAD_LENGTH_64 = 2;
    var GET_MASK = 3;
    var GET_DATA = 4;
    var INFLATING = 5;
    var DEFER_EVENT = 6;
    var Receiver2 = class extends Writable {
      /**
       * Creates a Receiver instance.
       *
       * @param {Object} [options] Options object
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {String} [options.binaryType=nodebuffer] The type for binary data
       * @param {Object} [options.extensions] An object containing the negotiated
       *     extensions
       * @param {Boolean} [options.isServer=false] Specifies whether to operate in
       *     client or server mode
       * @param {Number} [options.maxBufferedChunks=0] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=0] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       */
      constructor(options = {}) {
        super();
        this._allowSynchronousEvents = options.allowSynchronousEvents !== void 0 ? options.allowSynchronousEvents : true;
        this._binaryType = options.binaryType || BINARY_TYPES[0];
        this._extensions = options.extensions || {};
        this._isServer = !!options.isServer;
        this._maxBufferedChunks = options.maxBufferedChunks | 0;
        this._maxFragments = options.maxFragments | 0;
        this._maxPayload = options.maxPayload | 0;
        this._skipUTF8Validation = !!options.skipUTF8Validation;
        this[kWebSocket] = void 0;
        this._bufferedBytes = 0;
        this._buffers = [];
        this._compressed = false;
        this._payloadLength = 0;
        this._mask = void 0;
        this._fragmented = 0;
        this._masked = false;
        this._fin = false;
        this._opcode = 0;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._numFragments = 0;
        this._fragments = [];
        this._errored = false;
        this._loop = false;
        this._state = GET_INFO;
      }
      /**
       * Implements `Writable.prototype._write()`.
       *
       * @param {Buffer} chunk The chunk of data to write
       * @param {String} encoding The character encoding of `chunk`
       * @param {Function} cb Callback
       * @private
       */
      _write(chunk, encoding, cb) {
        if (this._opcode === 8 && this._state == GET_INFO) return cb();
        if (this._maxBufferedChunks > 0 && this._buffers.length >= this._maxBufferedChunks) {
          cb(
            this.createError(
              RangeError,
              "Too many buffered chunks",
              false,
              1008,
              "WS_ERR_TOO_MANY_BUFFERED_PARTS"
            )
          );
          return;
        }
        this._bufferedBytes += chunk.length;
        this._buffers.push(chunk);
        this.startLoop(cb);
      }
      /**
       * Consumes `n` bytes from the buffered data.
       *
       * @param {Number} n The number of bytes to consume
       * @return {Buffer} The consumed bytes
       * @private
       */
      consume(n) {
        this._bufferedBytes -= n;
        if (n === this._buffers[0].length) return this._buffers.shift();
        if (n < this._buffers[0].length) {
          const buf = this._buffers[0];
          this._buffers[0] = new FastBuffer(
            buf.buffer,
            buf.byteOffset + n,
            buf.length - n
          );
          return new FastBuffer(buf.buffer, buf.byteOffset, n);
        }
        const dst = Buffer.allocUnsafe(n);
        do {
          const buf = this._buffers[0];
          const offset = dst.length - n;
          if (n >= buf.length) {
            dst.set(this._buffers.shift(), offset);
          } else {
            dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset);
            this._buffers[0] = new FastBuffer(
              buf.buffer,
              buf.byteOffset + n,
              buf.length - n
            );
          }
          n -= buf.length;
        } while (n > 0);
        return dst;
      }
      /**
       * Starts the parsing loop.
       *
       * @param {Function} cb Callback
       * @private
       */
      startLoop(cb) {
        this._loop = true;
        do {
          switch (this._state) {
            case GET_INFO:
              this.getInfo(cb);
              break;
            case GET_PAYLOAD_LENGTH_16:
              this.getPayloadLength16(cb);
              break;
            case GET_PAYLOAD_LENGTH_64:
              this.getPayloadLength64(cb);
              break;
            case GET_MASK:
              this.getMask();
              break;
            case GET_DATA:
              this.getData(cb);
              break;
            case INFLATING:
            case DEFER_EVENT:
              this._loop = false;
              return;
          }
        } while (this._loop);
        if (!this._errored) cb();
      }
      /**
       * Reads the first two bytes of a frame.
       *
       * @param {Function} cb Callback
       * @private
       */
      getInfo(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        const buf = this.consume(2);
        if ((buf[0] & 48) !== 0) {
          const error = this.createError(
            RangeError,
            "RSV2 and RSV3 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_2_3"
          );
          cb(error);
          return;
        }
        const compressed = (buf[0] & 64) === 64;
        if (compressed && !this._extensions[PerMessageDeflate2.extensionName]) {
          const error = this.createError(
            RangeError,
            "RSV1 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_1"
          );
          cb(error);
          return;
        }
        this._fin = (buf[0] & 128) === 128;
        this._opcode = buf[0] & 15;
        this._payloadLength = buf[1] & 127;
        if (this._opcode === 0) {
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (!this._fragmented) {
            const error = this.createError(
              RangeError,
              "invalid opcode 0",
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._opcode = this._fragmented;
        } else if (this._opcode === 1 || this._opcode === 2) {
          if (this._fragmented) {
            const error = this.createError(
              RangeError,
              `invalid opcode ${this._opcode}`,
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._compressed = compressed;
        } else if (this._opcode > 7 && this._opcode < 11) {
          if (!this._fin) {
            const error = this.createError(
              RangeError,
              "FIN must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_FIN"
            );
            cb(error);
            return;
          }
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (this._payloadLength > 125 || this._opcode === 8 && this._payloadLength === 1) {
            const error = this.createError(
              RangeError,
              `invalid payload length ${this._payloadLength}`,
              true,
              1002,
              "WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH"
            );
            cb(error);
            return;
          }
        } else {
          const error = this.createError(
            RangeError,
            `invalid opcode ${this._opcode}`,
            true,
            1002,
            "WS_ERR_INVALID_OPCODE"
          );
          cb(error);
          return;
        }
        if (!this._fin && !this._fragmented) this._fragmented = this._opcode;
        this._masked = (buf[1] & 128) === 128;
        if (this._isServer) {
          if (!this._masked) {
            const error = this.createError(
              RangeError,
              "MASK must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_MASK"
            );
            cb(error);
            return;
          }
        } else if (this._masked) {
          const error = this.createError(
            RangeError,
            "MASK must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_MASK"
          );
          cb(error);
          return;
        }
        if (this._payloadLength === 126) this._state = GET_PAYLOAD_LENGTH_16;
        else if (this._payloadLength === 127) this._state = GET_PAYLOAD_LENGTH_64;
        else this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+16).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength16(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        this._payloadLength = this.consume(2).readUInt16BE(0);
        this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+64).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength64(cb) {
        if (this._bufferedBytes < 8) {
          this._loop = false;
          return;
        }
        const buf = this.consume(8);
        const num = buf.readUInt32BE(0);
        if (num > Math.pow(2, 53 - 32) - 1) {
          const error = this.createError(
            RangeError,
            "Unsupported WebSocket frame: payload length > 2^53 - 1",
            false,
            1009,
            "WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH"
          );
          cb(error);
          return;
        }
        this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4);
        this.haveLength(cb);
      }
      /**
       * Payload length has been read.
       *
       * @param {Function} cb Callback
       * @private
       */
      haveLength(cb) {
        if (this._payloadLength && this._opcode < 8) {
          this._totalPayloadLength += this._payloadLength;
          if (this._totalPayloadLength > this._maxPayload && this._maxPayload > 0) {
            const error = this.createError(
              RangeError,
              "Max payload size exceeded",
              false,
              1009,
              "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
            );
            cb(error);
            return;
          }
        }
        if (this._masked) this._state = GET_MASK;
        else this._state = GET_DATA;
      }
      /**
       * Reads mask bytes.
       *
       * @private
       */
      getMask() {
        if (this._bufferedBytes < 4) {
          this._loop = false;
          return;
        }
        this._mask = this.consume(4);
        this._state = GET_DATA;
      }
      /**
       * Reads data bytes.
       *
       * @param {Function} cb Callback
       * @private
       */
      getData(cb) {
        let data = EMPTY_BUFFER;
        if (this._payloadLength) {
          if (this._bufferedBytes < this._payloadLength) {
            this._loop = false;
            return;
          }
          data = this.consume(this._payloadLength);
          if (this._masked && (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0) {
            unmask(data, this._mask);
          }
        }
        this._mask = void 0;
        if (this._opcode > 7) {
          this.controlMessage(data, cb);
          return;
        }
        if (this._maxFragments > 0 && ++this._numFragments > this._maxFragments) {
          const error = this.createError(
            RangeError,
            "Too many message fragments",
            false,
            1008,
            "WS_ERR_TOO_MANY_BUFFERED_PARTS"
          );
          cb(error);
          return;
        }
        if (this._compressed) {
          this._state = INFLATING;
          this.decompress(data, cb);
          return;
        }
        if (data.length) {
          this._messageLength = this._totalPayloadLength;
          this._fragments.push(data);
        }
        this.dataMessage(cb);
      }
      /**
       * Decompresses data.
       *
       * @param {Buffer} data Compressed data
       * @param {Function} cb Callback
       * @private
       */
      decompress(data, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        perMessageDeflate.decompress(data, this._fin, (err, buf) => {
          if (err) return cb(err);
          if (buf.length) {
            this._messageLength += buf.length;
            if (this._messageLength > this._maxPayload && this._maxPayload > 0) {
              const error = this.createError(
                RangeError,
                "Max payload size exceeded",
                false,
                1009,
                "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
              );
              cb(error);
              return;
            }
            this._fragments.push(buf);
          }
          this.dataMessage(cb);
          if (this._state === GET_INFO) this.startLoop(cb);
        });
      }
      /**
       * Handles a data message.
       *
       * @param {Function} cb Callback
       * @private
       */
      dataMessage(cb) {
        if (!this._fin) {
          this._state = GET_INFO;
          return;
        }
        const messageLength = this._messageLength;
        const fragments = this._fragments;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._fragmented = 0;
        this._numFragments = 0;
        this._fragments = [];
        if (this._opcode === 2) {
          let data;
          if (this._binaryType === "nodebuffer") {
            data = concat(fragments, messageLength);
          } else if (this._binaryType === "arraybuffer") {
            data = toArrayBuffer(concat(fragments, messageLength));
          } else if (this._binaryType === "blob") {
            data = new Blob(fragments);
          } else {
            data = fragments;
          }
          if (this._allowSynchronousEvents) {
            this.emit("message", data, true);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", data, true);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        } else {
          const buf = concat(fragments, messageLength);
          if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
            const error = this.createError(
              Error,
              "invalid UTF-8 sequence",
              true,
              1007,
              "WS_ERR_INVALID_UTF8"
            );
            cb(error);
            return;
          }
          if (this._state === INFLATING || this._allowSynchronousEvents) {
            this.emit("message", buf, false);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", buf, false);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        }
      }
      /**
       * Handles a control message.
       *
       * @param {Buffer} data Data to handle
       * @return {(Error|RangeError|undefined)} A possible error
       * @private
       */
      controlMessage(data, cb) {
        if (this._opcode === 8) {
          if (data.length === 0) {
            this._loop = false;
            this.emit("conclude", 1005, EMPTY_BUFFER);
            this.end();
          } else {
            const code = data.readUInt16BE(0);
            if (!isValidStatusCode(code)) {
              const error = this.createError(
                RangeError,
                `invalid status code ${code}`,
                true,
                1002,
                "WS_ERR_INVALID_CLOSE_CODE"
              );
              cb(error);
              return;
            }
            const buf = new FastBuffer(
              data.buffer,
              data.byteOffset + 2,
              data.length - 2
            );
            if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
              const error = this.createError(
                Error,
                "invalid UTF-8 sequence",
                true,
                1007,
                "WS_ERR_INVALID_UTF8"
              );
              cb(error);
              return;
            }
            this._loop = false;
            this.emit("conclude", code, buf);
            this.end();
          }
          this._state = GET_INFO;
          return;
        }
        if (this._allowSynchronousEvents) {
          this.emit(this._opcode === 9 ? "ping" : "pong", data);
          this._state = GET_INFO;
        } else {
          this._state = DEFER_EVENT;
          setImmediate(() => {
            this.emit(this._opcode === 9 ? "ping" : "pong", data);
            this._state = GET_INFO;
            this.startLoop(cb);
          });
        }
      }
      /**
       * Builds an error object.
       *
       * @param {function(new:Error|RangeError)} ErrorCtor The error constructor
       * @param {String} message The error message
       * @param {Boolean} prefix Specifies whether or not to add a default prefix to
       *     `message`
       * @param {Number} statusCode The status code
       * @param {String} errorCode The exposed error code
       * @return {(Error|RangeError)} The error
       * @private
       */
      createError(ErrorCtor, message, prefix, statusCode, errorCode) {
        this._loop = false;
        this._errored = true;
        const err = new ErrorCtor(
          prefix ? `Invalid WebSocket frame: ${message}` : message
        );
        Error.captureStackTrace(err, this.createError);
        err.code = errorCode;
        err[kStatusCode] = statusCode;
        return err;
      }
    };
    module.exports = Receiver2;
  }
});

// node_modules/ws/lib/sender.js
var require_sender = __commonJS({
  "node_modules/ws/lib/sender.js"(exports, module) {
    "use strict";
    var { Duplex } = __require("stream");
    var { randomFillSync } = __require("crypto");
    var {
      types: { isUint8Array }
    } = __require("util");
    var PerMessageDeflate2 = require_permessage_deflate();
    var { EMPTY_BUFFER, kWebSocket, NOOP } = require_constants();
    var { isBlob, isValidStatusCode } = require_validation();
    var { mask: applyMask, toBuffer } = require_buffer_util();
    var kByteLength = /* @__PURE__ */ Symbol("kByteLength");
    var maskBuffer = Buffer.alloc(4);
    var RANDOM_POOL_SIZE = 8 * 1024;
    var randomPool;
    var randomPoolPointer = RANDOM_POOL_SIZE;
    var DEFAULT = 0;
    var DEFLATING = 1;
    var GET_BLOB_DATA = 2;
    var Sender2 = class _Sender {
      /**
       * Creates a Sender instance.
       *
       * @param {Duplex} socket The connection socket
       * @param {Object} [extensions] An object containing the negotiated extensions
       * @param {Function} [generateMask] The function used to generate the masking
       *     key
       */
      constructor(socket, extensions, generateMask) {
        this._extensions = extensions || {};
        if (generateMask) {
          this._generateMask = generateMask;
          this._maskBuffer = Buffer.alloc(4);
        }
        this._socket = socket;
        this._firstFragment = true;
        this._compress = false;
        this._bufferedBytes = 0;
        this._queue = [];
        this._state = DEFAULT;
        this.onerror = NOOP;
        this[kWebSocket] = void 0;
      }
      /**
       * Frames a piece of data according to the HyBi WebSocket protocol.
       *
       * @param {(Buffer|String)} data The data to frame
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @return {(Buffer|String)[]} The framed data
       * @public
       */
      static frame(data, options) {
        let mask;
        let merge2 = false;
        let offset = 2;
        let skipMasking = false;
        if (options.mask) {
          mask = options.maskBuffer || maskBuffer;
          if (options.generateMask) {
            options.generateMask(mask);
          } else {
            if (randomPoolPointer === RANDOM_POOL_SIZE) {
              if (randomPool === void 0) {
                randomPool = Buffer.alloc(RANDOM_POOL_SIZE);
              }
              randomFillSync(randomPool, 0, RANDOM_POOL_SIZE);
              randomPoolPointer = 0;
            }
            mask[0] = randomPool[randomPoolPointer++];
            mask[1] = randomPool[randomPoolPointer++];
            mask[2] = randomPool[randomPoolPointer++];
            mask[3] = randomPool[randomPoolPointer++];
          }
          skipMasking = (mask[0] | mask[1] | mask[2] | mask[3]) === 0;
          offset = 6;
        }
        let dataLength;
        if (typeof data === "string") {
          if ((!options.mask || skipMasking) && options[kByteLength] !== void 0) {
            dataLength = options[kByteLength];
          } else {
            data = Buffer.from(data);
            dataLength = data.length;
          }
        } else {
          dataLength = data.length;
          merge2 = options.mask && options.readOnly && !skipMasking;
        }
        let payloadLength = dataLength;
        if (dataLength >= 65536) {
          offset += 8;
          payloadLength = 127;
        } else if (dataLength > 125) {
          offset += 2;
          payloadLength = 126;
        }
        const target = Buffer.allocUnsafe(merge2 ? dataLength + offset : offset);
        target[0] = options.fin ? options.opcode | 128 : options.opcode;
        if (options.rsv1) target[0] |= 64;
        target[1] = payloadLength;
        if (payloadLength === 126) {
          target.writeUInt16BE(dataLength, 2);
        } else if (payloadLength === 127) {
          target[2] = target[3] = 0;
          target.writeUIntBE(dataLength, 4, 6);
        }
        if (!options.mask) {
          return dataLength ? [target, data] : [target];
        }
        target[1] |= 128;
        target[offset - 4] = mask[0];
        target[offset - 3] = mask[1];
        target[offset - 2] = mask[2];
        target[offset - 1] = mask[3];
        if (!dataLength) return [target];
        if (skipMasking) return [target, data];
        if (merge2) {
          applyMask(data, mask, target, offset, dataLength);
          return [target];
        }
        applyMask(data, mask, data, 0, dataLength);
        return [target, data];
      }
      /**
       * Sends a close message to the other peer.
       *
       * @param {Number} [code] The status code component of the body
       * @param {(String|Buffer)} [data] The message component of the body
       * @param {Boolean} [mask=false] Specifies whether or not to mask the message
       * @param {Function} [cb] Callback
       * @public
       */
      close(code, data, mask, cb) {
        let buf;
        if (code === void 0) {
          buf = EMPTY_BUFFER;
        } else if (typeof code !== "number" || !isValidStatusCode(code)) {
          throw new TypeError("First argument must be a valid error code number");
        } else if (data === void 0 || !data.length) {
          buf = Buffer.allocUnsafe(2);
          buf.writeUInt16BE(code, 0);
        } else {
          const length = Buffer.byteLength(data);
          if (length > 123) {
            throw new RangeError("The message must not be greater than 123 bytes");
          }
          buf = Buffer.allocUnsafe(2 + length);
          buf.writeUInt16BE(code, 0);
          if (typeof data === "string") {
            buf.write(data, 2);
          } else if (isUint8Array(data)) {
            buf.set(data, 2);
          } else {
            throw new TypeError("Second argument must be a string or a Uint8Array");
          }
        }
        const options = {
          [kByteLength]: buf.length,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 8,
          readOnly: false,
          rsv1: false
        };
        if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, buf, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(buf, options), cb);
        }
      }
      /**
       * Sends a ping message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      ping(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 9,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a pong message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      pong(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 10,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a data message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Object} options Options object
       * @param {Boolean} [options.binary=false] Specifies whether `data` is binary
       *     or text
       * @param {Boolean} [options.compress=false] Specifies whether or not to
       *     compress `data`
       * @param {Boolean} [options.fin=false] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Function} [cb] Callback
       * @public
       */
      send(data, options, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        let opcode = options.binary ? 2 : 1;
        let rsv1 = options.compress;
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (this._firstFragment) {
          this._firstFragment = false;
          if (rsv1 && perMessageDeflate && perMessageDeflate.params[perMessageDeflate._isServer ? "server_no_context_takeover" : "client_no_context_takeover"]) {
            rsv1 = byteLength >= perMessageDeflate._threshold;
          }
          this._compress = rsv1;
        } else {
          rsv1 = false;
          opcode = 0;
        }
        if (options.fin) this._firstFragment = true;
        const opts = {
          [kByteLength]: byteLength,
          fin: options.fin,
          generateMask: this._generateMask,
          mask: options.mask,
          maskBuffer: this._maskBuffer,
          opcode,
          readOnly,
          rsv1
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, this._compress, opts, cb]);
          } else {
            this.getBlobData(data, this._compress, opts, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, this._compress, opts, cb]);
        } else {
          this.dispatch(data, this._compress, opts, cb);
        }
      }
      /**
       * Gets the contents of a blob as binary data.
       *
       * @param {Blob} blob The blob
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     the data
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      getBlobData(blob, compress, options, cb) {
        this._bufferedBytes += options[kByteLength];
        this._state = GET_BLOB_DATA;
        blob.arrayBuffer().then((arrayBuffer2) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while the blob was being read"
            );
            process.nextTick(callCallbacks, this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          const data = toBuffer(arrayBuffer2);
          if (!compress) {
            this._state = DEFAULT;
            this.sendFrame(_Sender.frame(data, options), cb);
            this.dequeue();
          } else {
            this.dispatch(data, compress, options, cb);
          }
        }).catch((err) => {
          process.nextTick(onError, this, err, cb);
        });
      }
      /**
       * Dispatches a message.
       *
       * @param {(Buffer|String)} data The message to send
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     `data`
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      dispatch(data, compress, options, cb) {
        if (!compress) {
          this.sendFrame(_Sender.frame(data, options), cb);
          return;
        }
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        this._bufferedBytes += options[kByteLength];
        this._state = DEFLATING;
        perMessageDeflate.compress(data, options.fin, (_, buf) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while data was being compressed"
            );
            callCallbacks(this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          this._state = DEFAULT;
          options.readOnly = false;
          this.sendFrame(_Sender.frame(buf, options), cb);
          this.dequeue();
        });
      }
      /**
       * Executes queued send operations.
       *
       * @private
       */
      dequeue() {
        while (this._state === DEFAULT && this._queue.length) {
          const params = this._queue.shift();
          this._bufferedBytes -= params[3][kByteLength];
          Reflect.apply(params[0], this, params.slice(1));
        }
      }
      /**
       * Enqueues a send operation.
       *
       * @param {Array} params Send operation parameters.
       * @private
       */
      enqueue(params) {
        this._bufferedBytes += params[3][kByteLength];
        this._queue.push(params);
      }
      /**
       * Sends a frame.
       *
       * @param {(Buffer | String)[]} list The frame to send
       * @param {Function} [cb] Callback
       * @private
       */
      sendFrame(list, cb) {
        if (list.length === 2) {
          this._socket.cork();
          this._socket.write(list[0]);
          this._socket.write(list[1], cb);
          this._socket.uncork();
        } else {
          this._socket.write(list[0], cb);
        }
      }
    };
    module.exports = Sender2;
    function callCallbacks(sender, err, cb) {
      if (typeof cb === "function") cb(err);
      for (let i = 0; i < sender._queue.length; i++) {
        const params = sender._queue[i];
        const callback = params[params.length - 1];
        if (typeof callback === "function") callback(err);
      }
    }
    function onError(sender, err, cb) {
      callCallbacks(sender, err, cb);
      sender.onerror(err);
    }
  }
});

// node_modules/ws/lib/event-target.js
var require_event_target = __commonJS({
  "node_modules/ws/lib/event-target.js"(exports, module) {
    "use strict";
    var { kForOnEventAttribute, kListener } = require_constants();
    var kCode = /* @__PURE__ */ Symbol("kCode");
    var kData = /* @__PURE__ */ Symbol("kData");
    var kError = /* @__PURE__ */ Symbol("kError");
    var kMessage = /* @__PURE__ */ Symbol("kMessage");
    var kReason = /* @__PURE__ */ Symbol("kReason");
    var kTarget = /* @__PURE__ */ Symbol("kTarget");
    var kType = /* @__PURE__ */ Symbol("kType");
    var kWasClean = /* @__PURE__ */ Symbol("kWasClean");
    var Event = class {
      /**
       * Create a new `Event`.
       *
       * @param {String} type The name of the event
       * @throws {TypeError} If the `type` argument is not specified
       */
      constructor(type) {
        this[kTarget] = null;
        this[kType] = type;
      }
      /**
       * @type {*}
       */
      get target() {
        return this[kTarget];
      }
      /**
       * @type {String}
       */
      get type() {
        return this[kType];
      }
    };
    Object.defineProperty(Event.prototype, "target", { enumerable: true });
    Object.defineProperty(Event.prototype, "type", { enumerable: true });
    var CloseEvent = class extends Event {
      /**
       * Create a new `CloseEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {Number} [options.code=0] The status code explaining why the
       *     connection was closed
       * @param {String} [options.reason=''] A human-readable string explaining why
       *     the connection was closed
       * @param {Boolean} [options.wasClean=false] Indicates whether or not the
       *     connection was cleanly closed
       */
      constructor(type, options = {}) {
        super(type);
        this[kCode] = options.code === void 0 ? 0 : options.code;
        this[kReason] = options.reason === void 0 ? "" : options.reason;
        this[kWasClean] = options.wasClean === void 0 ? false : options.wasClean;
      }
      /**
       * @type {Number}
       */
      get code() {
        return this[kCode];
      }
      /**
       * @type {String}
       */
      get reason() {
        return this[kReason];
      }
      /**
       * @type {Boolean}
       */
      get wasClean() {
        return this[kWasClean];
      }
    };
    Object.defineProperty(CloseEvent.prototype, "code", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "reason", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "wasClean", { enumerable: true });
    var ErrorEvent = class extends Event {
      /**
       * Create a new `ErrorEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.error=null] The error that generated this event
       * @param {String} [options.message=''] The error message
       */
      constructor(type, options = {}) {
        super(type);
        this[kError] = options.error === void 0 ? null : options.error;
        this[kMessage] = options.message === void 0 ? "" : options.message;
      }
      /**
       * @type {*}
       */
      get error() {
        return this[kError];
      }
      /**
       * @type {String}
       */
      get message() {
        return this[kMessage];
      }
    };
    Object.defineProperty(ErrorEvent.prototype, "error", { enumerable: true });
    Object.defineProperty(ErrorEvent.prototype, "message", { enumerable: true });
    var MessageEvent = class extends Event {
      /**
       * Create a new `MessageEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.data=null] The message content
       */
      constructor(type, options = {}) {
        super(type);
        this[kData] = options.data === void 0 ? null : options.data;
      }
      /**
       * @type {*}
       */
      get data() {
        return this[kData];
      }
    };
    Object.defineProperty(MessageEvent.prototype, "data", { enumerable: true });
    var EventTarget = {
      /**
       * Register an event listener.
       *
       * @param {String} type A string representing the event type to listen for
       * @param {(Function|Object)} handler The listener to add
       * @param {Object} [options] An options object specifies characteristics about
       *     the event listener
       * @param {Boolean} [options.once=false] A `Boolean` indicating that the
       *     listener should be invoked at most once after being added. If `true`,
       *     the listener would be automatically removed when invoked.
       * @public
       */
      addEventListener(type, handler, options = {}) {
        for (const listener of this.listeners(type)) {
          if (!options[kForOnEventAttribute] && listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            return;
          }
        }
        let wrapper;
        if (type === "message") {
          wrapper = function onMessage(data, isBinary) {
            const event = new MessageEvent("message", {
              data: isBinary ? data : data.toString()
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "close") {
          wrapper = function onClose(code, message) {
            const event = new CloseEvent("close", {
              code,
              reason: message.toString(),
              wasClean: this._closeFrameReceived && this._closeFrameSent
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "error") {
          wrapper = function onError(error) {
            const event = new ErrorEvent("error", {
              error,
              message: error.message
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "open") {
          wrapper = function onOpen() {
            const event = new Event("open");
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else {
          return;
        }
        wrapper[kForOnEventAttribute] = !!options[kForOnEventAttribute];
        wrapper[kListener] = handler;
        if (options.once) {
          this.once(type, wrapper);
        } else {
          this.on(type, wrapper);
        }
      },
      /**
       * Remove an event listener.
       *
       * @param {String} type A string representing the event type to remove
       * @param {(Function|Object)} handler The listener to remove
       * @public
       */
      removeEventListener(type, handler) {
        for (const listener of this.listeners(type)) {
          if (listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            this.removeListener(type, listener);
            break;
          }
        }
      }
    };
    module.exports = {
      CloseEvent,
      ErrorEvent,
      Event,
      EventTarget,
      MessageEvent
    };
    function callListener(listener, thisArg, event) {
      if (typeof listener === "object" && listener.handleEvent) {
        listener.handleEvent.call(listener, event);
      } else {
        listener.call(thisArg, event);
      }
    }
  }
});

// node_modules/ws/lib/extension.js
var require_extension = __commonJS({
  "node_modules/ws/lib/extension.js"(exports, module) {
    "use strict";
    var { tokenChars } = require_validation();
    function push2(dest, name2, elem) {
      if (dest[name2] === void 0) dest[name2] = [elem];
      else dest[name2].push(elem);
    }
    function parse(header) {
      const offers = /* @__PURE__ */ Object.create(null);
      let params = /* @__PURE__ */ Object.create(null);
      let mustUnescape = false;
      let isEscaping = false;
      let inQuotes = false;
      let extensionName;
      let paramName;
      let start = -1;
      let code = -1;
      let end = -1;
      let i = 0;
      for (; i < header.length; i++) {
        code = header.charCodeAt(i);
        if (extensionName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (i !== 0 && (code === 32 || code === 9)) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            const name2 = header.slice(start, end);
            if (code === 44) {
              push2(offers, name2, params);
              params = /* @__PURE__ */ Object.create(null);
            } else {
              extensionName = name2;
            }
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else if (paramName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (code === 32 || code === 9) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            push2(params, header.slice(start, end), true);
            if (code === 44) {
              push2(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            start = end = -1;
          } else if (code === 61 && start !== -1 && end === -1) {
            paramName = header.slice(start, i);
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else {
          if (isEscaping) {
            if (tokenChars[code] !== 1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (start === -1) start = i;
            else if (!mustUnescape) mustUnescape = true;
            isEscaping = false;
          } else if (inQuotes) {
            if (tokenChars[code] === 1) {
              if (start === -1) start = i;
            } else if (code === 34 && start !== -1) {
              inQuotes = false;
              end = i;
            } else if (code === 92) {
              isEscaping = true;
            } else {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
          } else if (code === 34 && header.charCodeAt(i - 1) === 61) {
            inQuotes = true;
          } else if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (start !== -1 && (code === 32 || code === 9)) {
            if (end === -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            let value = header.slice(start, end);
            if (mustUnescape) {
              value = value.replace(/\\/g, "");
              mustUnescape = false;
            }
            push2(params, paramName, value);
            if (code === 44) {
              push2(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            paramName = void 0;
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        }
      }
      if (start === -1 || inQuotes || code === 32 || code === 9) {
        throw new SyntaxError("Unexpected end of input");
      }
      if (end === -1) end = i;
      const token = header.slice(start, end);
      if (extensionName === void 0) {
        push2(offers, token, params);
      } else {
        if (paramName === void 0) {
          push2(params, token, true);
        } else if (mustUnescape) {
          push2(params, paramName, token.replace(/\\/g, ""));
        } else {
          push2(params, paramName, token);
        }
        push2(offers, extensionName, params);
      }
      return offers;
    }
    function format(extensions) {
      return Object.keys(extensions).map((extension2) => {
        let configurations = extensions[extension2];
        if (!Array.isArray(configurations)) configurations = [configurations];
        return configurations.map((params) => {
          return [extension2].concat(
            Object.keys(params).map((k) => {
              let values = params[k];
              if (!Array.isArray(values)) values = [values];
              return values.map((v) => v === true ? k : `${k}=${v}`).join("; ");
            })
          ).join("; ");
        }).join(", ");
      }).join(", ");
    }
    module.exports = { format, parse };
  }
});

// node_modules/ws/lib/websocket.js
var require_websocket = __commonJS({
  "node_modules/ws/lib/websocket.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("events");
    var https = __require("https");
    var http = __require("http");
    var net = __require("net");
    var querystring = __require("querystring");
    var tls = __require("tls");
    var { randomBytes: randomBytes2, createHash: createHash7 } = __require("crypto");
    var { Duplex, Readable: Readable2 } = __require("stream");
    var { URL: URL2 } = __require("url");
    var PerMessageDeflate2 = require_permessage_deflate();
    var Receiver2 = require_receiver();
    var Sender2 = require_sender();
    var { isBlob } = require_validation();
    var {
      BINARY_TYPES,
      CLOSE_TIMEOUT,
      EMPTY_BUFFER,
      GUID,
      kForOnEventAttribute,
      kListener,
      kStatusCode,
      kWebSocket,
      NOOP
    } = require_constants();
    var {
      EventTarget: { addEventListener, removeEventListener }
    } = require_event_target();
    var { format, parse } = require_extension();
    var { toBuffer } = require_buffer_util();
    var kAborted = /* @__PURE__ */ Symbol("kAborted");
    var protocolVersions = [8, 13];
    var readyStates = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];
    var subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;
    var WebSocket2 = class _WebSocket extends EventEmitter {
      /**
       * Create a new `WebSocket`.
       *
       * @param {(String|URL)} address The URL to which to connect
       * @param {(String|String[])} [protocols] The subprotocols
       * @param {Object} [options] Connection options
       */
      constructor(address, protocols, options) {
        super();
        this._binaryType = BINARY_TYPES[0];
        this._closeCode = 1006;
        this._closeFrameReceived = false;
        this._closeFrameSent = false;
        this._closeMessage = EMPTY_BUFFER;
        this._closeTimer = null;
        this._errorEmitted = false;
        this._extensions = {};
        this._paused = false;
        this._protocol = "";
        this._readyState = _WebSocket.CONNECTING;
        this._receiver = null;
        this._sender = null;
        this._socket = null;
        if (address !== null) {
          this._bufferedAmount = 0;
          this._isServer = false;
          this._redirects = 0;
          if (protocols === void 0) {
            if (!options || options.protocols === void 0) {
              protocols = [];
            } else if (Array.isArray(options.protocols)) {
              protocols = options.protocols;
            } else {
              protocols = [options.protocols];
            }
          } else if (!Array.isArray(protocols)) {
            if (typeof protocols === "object" && protocols !== null) {
              options = protocols;
              if (options.protocols === void 0) {
                protocols = [];
              } else if (Array.isArray(options.protocols)) {
                protocols = options.protocols;
              } else {
                protocols = [options.protocols];
              }
            } else {
              protocols = [protocols];
            }
          }
          options = initAsClient(this, address, protocols, options);
        } else {
          this._isServer = true;
        }
        if (options.autoPong) {
          this._autoPong = true;
          this._autoPongComplete = () => autoPongComplete(this);
          this._pendingAutoPongs = 0;
          this._maxPendingAutoPongs = options.maxPendingAutoPongs | 0;
        }
        this._closeTimeout = options.closeTimeout;
      }
      /**
       * For historical reasons, the custom "nodebuffer" type is used by the default
       * instead of "blob".
       *
       * @type {String}
       */
      get binaryType() {
        return this._binaryType;
      }
      set binaryType(type) {
        if (!BINARY_TYPES.includes(type)) return;
        this._binaryType = type;
        if (this._receiver) this._receiver._binaryType = type;
      }
      /**
       * @type {Number}
       */
      get bufferedAmount() {
        if (!this._socket) return this._bufferedAmount;
        return this._socket._writableState.length + this._sender._bufferedBytes;
      }
      /**
       * @type {String}
       */
      get extensions() {
        return Object.keys(this._extensions).join();
      }
      /**
       * @type {Boolean}
       */
      get isPaused() {
        return this._paused;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onclose() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onerror() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onopen() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onmessage() {
        return null;
      }
      /**
       * @type {String}
       */
      get protocol() {
        return this._protocol;
      }
      /**
       * @type {Number}
       */
      get readyState() {
        return this._readyState;
      }
      /**
       * @type {String}
       */
      get url() {
        return this._url;
      }
      /**
       * Set up the socket and the internal resources.
       *
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Object} options Options object
       * @param {Boolean} [options.allowSynchronousEvents=false] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Number} [options.maxBufferedChunks=0] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=0] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=0] The maximum allowed message size
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @private
       */
      setSocket(socket, head, options) {
        const receiver = new Receiver2({
          allowSynchronousEvents: options.allowSynchronousEvents,
          binaryType: this.binaryType,
          extensions: this._extensions,
          isServer: this._isServer,
          maxBufferedChunks: options.maxBufferedChunks,
          maxFragments: options.maxFragments,
          maxPayload: options.maxPayload,
          skipUTF8Validation: options.skipUTF8Validation
        });
        const sender = new Sender2(socket, this._extensions, options.generateMask);
        this._receiver = receiver;
        this._sender = sender;
        this._socket = socket;
        receiver[kWebSocket] = this;
        sender[kWebSocket] = this;
        socket[kWebSocket] = this;
        receiver.on("conclude", receiverOnConclude);
        receiver.on("drain", receiverOnDrain);
        receiver.on("error", receiverOnError);
        receiver.on("message", receiverOnMessage);
        receiver.on("ping", receiverOnPing);
        receiver.on("pong", receiverOnPong);
        sender.onerror = senderOnError;
        if (socket.setTimeout) socket.setTimeout(0);
        if (socket.setNoDelay) socket.setNoDelay();
        if (head.length > 0) socket.unshift(head);
        socket.on("close", socketOnClose);
        socket.on("data", socketOnData);
        socket.on("end", socketOnEnd);
        socket.on("error", socketOnError);
        this._readyState = _WebSocket.OPEN;
        this.emit("open");
      }
      /**
       * Emit the `'close'` event.
       *
       * @private
       */
      emitClose() {
        if (!this._socket) {
          this._readyState = _WebSocket.CLOSED;
          this.emit("close", this._closeCode, this._closeMessage);
          return;
        }
        if (this._extensions[PerMessageDeflate2.extensionName]) {
          this._extensions[PerMessageDeflate2.extensionName].cleanup();
        }
        this._receiver.removeAllListeners();
        this._readyState = _WebSocket.CLOSED;
        this.emit("close", this._closeCode, this._closeMessage);
      }
      /**
       * Start a closing handshake.
       *
       *          +----------+   +-----------+   +----------+
       *     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
       *    |     +----------+   +-----------+   +----------+     |
       *          +----------+   +-----------+         |
       * CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
       *          +----------+   +-----------+   |
       *    |           |                        |   +---+        |
       *                +------------------------+-->|fin| - - - -
       *    |         +---+                      |   +---+
       *     - - - - -|fin|<---------------------+
       *              +---+
       *
       * @param {Number} [code] Status code explaining why the connection is closing
       * @param {(String|Buffer)} [data] The reason why the connection is
       *     closing
       * @public
       */
      close(code, data) {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this.readyState === _WebSocket.CLOSING) {
          if (this._closeFrameSent && (this._closeFrameReceived || this._receiver._writableState.errorEmitted)) {
            this._socket.end();
          }
          return;
        }
        this._sender.close(code, data, !this._isServer, (err) => {
          if (err) return;
          this._closeFrameSent = true;
          if (this._closeFrameReceived || this._receiver._writableState.errorEmitted) {
            this._socket.end();
          }
        });
        this._readyState = _WebSocket.CLOSING;
        setCloseTimer(this);
      }
      /**
       * Pause the socket.
       *
       * @public
       */
      pause() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = true;
        this._socket.pause();
      }
      /**
       * Send a ping.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the ping is sent
       * @public
       */
      ping(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.ping(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Send a pong.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the pong is sent
       * @public
       */
      pong(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.pong(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Resume the socket.
       *
       * @public
       */
      resume() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = false;
        if (!this._receiver._writableState.needDrain) this._socket.resume();
      }
      /**
       * Send a data message.
       *
       * @param {*} data The message to send
       * @param {Object} [options] Options object
       * @param {Boolean} [options.binary] Specifies whether `data` is binary or
       *     text
       * @param {Boolean} [options.compress] Specifies whether or not to compress
       *     `data`
       * @param {Boolean} [options.fin=true] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when data is written out
       * @public
       */
      send(data, options, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof options === "function") {
          cb = options;
          options = {};
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        const opts = {
          binary: typeof data !== "string",
          mask: !this._isServer,
          compress: true,
          fin: true,
          ...options
        };
        if (!this._extensions[PerMessageDeflate2.extensionName]) {
          opts.compress = false;
        }
        this._sender.send(data || EMPTY_BUFFER, opts, cb);
      }
      /**
       * Forcibly close the connection.
       *
       * @public
       */
      terminate() {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this._socket) {
          this._readyState = _WebSocket.CLOSING;
          this._socket.destroy();
        }
      }
    };
    Object.defineProperty(WebSocket2, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2.prototype, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2.prototype, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    [
      "binaryType",
      "bufferedAmount",
      "extensions",
      "isPaused",
      "protocol",
      "readyState",
      "url"
    ].forEach((property2) => {
      Object.defineProperty(WebSocket2.prototype, property2, { enumerable: true });
    });
    ["open", "error", "close", "message"].forEach((method) => {
      Object.defineProperty(WebSocket2.prototype, `on${method}`, {
        enumerable: true,
        get() {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) return listener[kListener];
          }
          return null;
        },
        set(handler) {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) {
              this.removeListener(method, listener);
              break;
            }
          }
          if (typeof handler !== "function") return;
          this.addEventListener(method, handler, {
            [kForOnEventAttribute]: true
          });
        }
      });
    });
    WebSocket2.prototype.addEventListener = addEventListener;
    WebSocket2.prototype.removeEventListener = removeEventListener;
    module.exports = WebSocket2;
    function initAsClient(websocket, address, protocols, options) {
      const opts = {
        allowSynchronousEvents: true,
        autoPong: true,
        closeTimeout: CLOSE_TIMEOUT,
        protocolVersion: protocolVersions[1],
        maxBufferedChunks: 256 * 1024,
        maxFragments: 16 * 1024,
        maxPayload: 100 * 1024 * 1024,
        maxPendingAutoPongs: 60,
        skipUTF8Validation: false,
        perMessageDeflate: true,
        followRedirects: false,
        maxRedirects: 10,
        ...options,
        socketPath: void 0,
        hostname: void 0,
        protocol: void 0,
        protocols: void 0,
        timeout: void 0,
        method: "GET",
        host: void 0,
        path: void 0,
        port: void 0
      };
      if (!protocolVersions.includes(opts.protocolVersion)) {
        throw new RangeError(
          `Unsupported protocol version: ${opts.protocolVersion} (supported versions: ${protocolVersions.join(", ")})`
        );
      }
      let parsedUrl;
      if (address instanceof URL2) {
        parsedUrl = address;
      } else {
        try {
          parsedUrl = new URL2(address);
        } catch {
          throw new SyntaxError(`Invalid URL: ${address}`);
        }
      }
      if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
        parsedUrl = new URL2(parsedUrl);
        parsedUrl.protocol = parsedUrl.protocol === "http:" ? "ws:" : "wss:";
      }
      websocket._url = parsedUrl.href;
      const isSecure = parsedUrl.protocol === "wss:";
      const isIpcUrl = parsedUrl.protocol === "ws+unix:";
      let invalidUrlMessage;
      if (parsedUrl.protocol !== "ws:" && !isSecure && !isIpcUrl) {
        invalidUrlMessage = `The URL's protocol must be one of "ws:", "wss:", "http:", "https:", or "ws+unix:"`;
      } else if (isIpcUrl && !parsedUrl.pathname) {
        invalidUrlMessage = "The URL's pathname is empty";
      } else if (parsedUrl.hash) {
        invalidUrlMessage = "The URL contains a fragment identifier";
      }
      if (invalidUrlMessage) {
        const err = new SyntaxError(invalidUrlMessage);
        if (websocket._redirects === 0) {
          throw err;
        } else {
          emitErrorAndClose(websocket, err);
          return;
        }
      }
      const defaultPort = isSecure ? 443 : 80;
      const key = randomBytes2(16).toString("base64");
      const request = isSecure ? https.request : http.request;
      const protocolSet = /* @__PURE__ */ new Set();
      let perMessageDeflate;
      opts.createConnection = opts.createConnection || (isSecure ? tlsConnect : netConnect);
      opts.defaultPort = opts.defaultPort || defaultPort;
      opts.port = parsedUrl.port || defaultPort;
      opts.host = parsedUrl.hostname.startsWith("[") ? parsedUrl.hostname.slice(1, -1) : parsedUrl.hostname;
      opts.headers = {
        ...opts.headers,
        "Sec-WebSocket-Version": opts.protocolVersion,
        "Sec-WebSocket-Key": key,
        Connection: "Upgrade",
        Upgrade: "websocket"
      };
      opts.path = parsedUrl.pathname + parsedUrl.search;
      opts.timeout = opts.handshakeTimeout;
      if (opts.perMessageDeflate) {
        perMessageDeflate = new PerMessageDeflate2({
          ...opts.perMessageDeflate,
          isServer: false,
          maxPayload: opts.maxPayload
        });
        opts.headers["Sec-WebSocket-Extensions"] = format({
          [PerMessageDeflate2.extensionName]: perMessageDeflate.offer()
        });
      }
      if (protocols.length) {
        for (const protocol of protocols) {
          if (typeof protocol !== "string" || !subprotocolRegex.test(protocol) || protocolSet.has(protocol)) {
            throw new SyntaxError(
              "An invalid or duplicated subprotocol was specified"
            );
          }
          protocolSet.add(protocol);
        }
        opts.headers["Sec-WebSocket-Protocol"] = protocols.join(",");
      }
      if (opts.origin) {
        if (opts.protocolVersion < 13) {
          opts.headers["Sec-WebSocket-Origin"] = opts.origin;
        } else {
          opts.headers.Origin = opts.origin;
        }
      }
      if (parsedUrl.username || parsedUrl.password) {
        const username = querystring.unescape(parsedUrl.username);
        const password = querystring.unescape(parsedUrl.password);
        opts.auth = `${username}:${password}`;
      }
      if (isIpcUrl) {
        const i = opts.path.indexOf(":");
        if (i === -1) {
          opts.socketPath = opts.path;
          opts.path = "";
        } else {
          opts.socketPath = opts.path.slice(0, i);
          opts.path = opts.path.slice(i + 1);
        }
      }
      let req;
      if (opts.followRedirects) {
        if (websocket._redirects === 0) {
          websocket._originalIpc = isIpcUrl;
          websocket._originalSecure = isSecure;
          websocket._originalHostOrSocketPath = isIpcUrl ? opts.socketPath : parsedUrl.host;
          const headers = options && options.headers;
          options = { ...options, headers: {} };
          if (headers) {
            for (const [key2, value] of Object.entries(headers)) {
              options.headers[key2.toLowerCase()] = value;
            }
          }
        } else if (websocket.listenerCount("redirect") === 0) {
          const isSameHost = isIpcUrl ? websocket._originalIpc ? opts.socketPath === websocket._originalHostOrSocketPath : false : websocket._originalIpc ? false : parsedUrl.host === websocket._originalHostOrSocketPath;
          if (!isSameHost || websocket._originalSecure && !isSecure) {
            delete opts.headers.authorization;
            delete opts.headers.cookie;
            if (!isSameHost) delete opts.headers.host;
            opts.auth = void 0;
          }
        }
        if (opts.auth && !options.headers.authorization) {
          options.headers.authorization = "Basic " + Buffer.from(opts.auth).toString("base64");
        }
        req = websocket._req = request(opts);
        if (websocket._redirects) {
          websocket.emit("redirect", websocket.url, req);
        }
      } else {
        req = websocket._req = request(opts);
      }
      if (opts.timeout) {
        req.on("timeout", () => {
          abortHandshake(websocket, req, "Opening handshake has timed out");
        });
      }
      req.on("error", (err) => {
        if (req === null || req[kAborted]) return;
        req = websocket._req = null;
        emitErrorAndClose(websocket, err);
      });
      req.on("response", (res) => {
        const location = res.headers.location;
        const statusCode = res.statusCode;
        if (location && opts.followRedirects && statusCode >= 300 && statusCode < 400) {
          if (++websocket._redirects > opts.maxRedirects) {
            abortHandshake(websocket, req, "Maximum redirects exceeded");
            return;
          }
          req.abort();
          let addr;
          try {
            addr = new URL2(location, address);
          } catch (e) {
            const err = new SyntaxError(`Invalid URL: ${location}`);
            emitErrorAndClose(websocket, err);
            return;
          }
          initAsClient(websocket, addr, protocols, options);
        } else if (!websocket.emit("unexpected-response", req, res)) {
          abortHandshake(
            websocket,
            req,
            `Unexpected server response: ${res.statusCode}`
          );
        }
      });
      req.on("upgrade", (res, socket, head) => {
        websocket.emit("upgrade", res);
        if (websocket.readyState !== WebSocket2.CONNECTING) return;
        req = websocket._req = null;
        const upgrade = res.headers.upgrade;
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          abortHandshake(websocket, socket, "Invalid Upgrade header");
          return;
        }
        const digest = createHash7("sha1").update(key + GUID).digest("base64");
        if (res.headers["sec-websocket-accept"] !== digest) {
          abortHandshake(websocket, socket, "Invalid Sec-WebSocket-Accept header");
          return;
        }
        const serverProt = res.headers["sec-websocket-protocol"];
        let protError;
        if (serverProt !== void 0) {
          if (!protocolSet.size) {
            protError = "Server sent a subprotocol but none was requested";
          } else if (!protocolSet.has(serverProt)) {
            protError = "Server sent an invalid subprotocol";
          }
        } else if (protocolSet.size) {
          protError = "Server sent no subprotocol";
        }
        if (protError) {
          abortHandshake(websocket, socket, protError);
          return;
        }
        if (serverProt) websocket._protocol = serverProt;
        const secWebSocketExtensions = res.headers["sec-websocket-extensions"];
        if (secWebSocketExtensions !== void 0) {
          if (!perMessageDeflate) {
            const message = "Server sent a Sec-WebSocket-Extensions header but no extension was requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          let extensions;
          try {
            extensions = parse(secWebSocketExtensions);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          const extensionNames = Object.keys(extensions);
          if (extensionNames.length !== 1 || extensionNames[0] !== PerMessageDeflate2.extensionName) {
            const message = "Server indicated an extension that was not requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          try {
            perMessageDeflate.accept(extensions[PerMessageDeflate2.extensionName]);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          websocket._extensions[PerMessageDeflate2.extensionName] = perMessageDeflate;
        }
        websocket.setSocket(socket, head, {
          allowSynchronousEvents: opts.allowSynchronousEvents,
          generateMask: opts.generateMask,
          maxBufferedChunks: opts.maxBufferedChunks,
          maxFragments: opts.maxFragments,
          maxPayload: opts.maxPayload,
          skipUTF8Validation: opts.skipUTF8Validation
        });
      });
      if (opts.finishRequest) {
        opts.finishRequest(req, websocket);
      } else {
        req.end();
      }
      return opts;
    }
    function emitErrorAndClose(websocket, err) {
      websocket._readyState = WebSocket2.CLOSING;
      websocket._errorEmitted = true;
      websocket.emit("error", err);
      websocket.emitClose();
    }
    function netConnect(options) {
      options.path = options.socketPath;
      return net.connect(options);
    }
    function tlsConnect(options) {
      options.path = void 0;
      if (!options.servername && options.servername !== "") {
        options.servername = net.isIP(options.host) ? "" : options.host;
      }
      return tls.connect(options);
    }
    function abortHandshake(websocket, stream, message) {
      websocket._readyState = WebSocket2.CLOSING;
      const err = new Error(message);
      Error.captureStackTrace(err, abortHandshake);
      if (stream.setHeader) {
        stream[kAborted] = true;
        stream.abort();
        if (stream.socket && !stream.socket.destroyed) {
          stream.socket.destroy();
        }
        process.nextTick(emitErrorAndClose, websocket, err);
      } else {
        stream.destroy(err);
        stream.once("error", websocket.emit.bind(websocket, "error"));
        stream.once("close", websocket.emitClose.bind(websocket));
      }
    }
    function sendAfterClose(websocket, data, cb) {
      if (data) {
        const length = isBlob(data) ? data.size : toBuffer(data).length;
        if (websocket._socket) websocket._sender._bufferedBytes += length;
        else websocket._bufferedAmount += length;
      }
      if (cb) {
        const err = new Error(
          `WebSocket is not open: readyState ${websocket.readyState} (${readyStates[websocket.readyState]})`
        );
        process.nextTick(cb, err);
      }
    }
    function receiverOnConclude(code, reason) {
      const websocket = this[kWebSocket];
      websocket._closeFrameReceived = true;
      websocket._closeCode = code;
      if (reason.length === 0) {
        websocket._closeMessage = EMPTY_BUFFER;
      } else {
        websocket._closeMessage = Buffer.allocUnsafeSlow(reason.length);
        websocket._closeMessage.set(reason);
      }
      if (websocket._socket[kWebSocket] === void 0) return;
      websocket._socket.removeListener("data", socketOnData);
      process.nextTick(resume, websocket._socket);
      if (code === 1005) websocket.close();
      else websocket.close(code, reason);
    }
    function receiverOnDrain() {
      const websocket = this[kWebSocket];
      if (!websocket.isPaused) websocket._socket.resume();
    }
    function receiverOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket._socket[kWebSocket] !== void 0) {
        websocket._socket.removeListener("data", socketOnData);
        process.nextTick(resume, websocket._socket);
        websocket.close(err[kStatusCode]);
      }
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function receiverOnFinish() {
      this[kWebSocket].emitClose();
    }
    function receiverOnMessage(data, isBinary) {
      this[kWebSocket].emit("message", data, isBinary);
    }
    function receiverOnPing(data) {
      const websocket = this[kWebSocket];
      if (websocket._autoPong && websocket.readyState === WebSocket2.OPEN) {
        if (websocket._maxPendingAutoPongs > 0 && websocket._pendingAutoPongs >= websocket._maxPendingAutoPongs) {
          websocket.terminate();
        } else {
          websocket._pendingAutoPongs++;
          websocket.pong(data, !this._isServer, websocket._autoPongComplete);
        }
      }
      websocket.emit("ping", data);
    }
    function autoPongComplete(websocket) {
      websocket._pendingAutoPongs--;
    }
    function receiverOnPong(data) {
      this[kWebSocket].emit("pong", data);
    }
    function resume(stream) {
      stream.resume();
    }
    function senderOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket.readyState === WebSocket2.CLOSED) return;
      if (websocket.readyState === WebSocket2.OPEN) {
        websocket._readyState = WebSocket2.CLOSING;
        setCloseTimer(websocket);
      }
      this._socket.end();
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function setCloseTimer(websocket) {
      websocket._closeTimer = setTimeout(
        websocket._socket.destroy.bind(websocket._socket),
        websocket._closeTimeout
      );
    }
    function socketOnClose() {
      const websocket = this[kWebSocket];
      this.removeListener("close", socketOnClose);
      this.removeListener("data", socketOnData);
      this.removeListener("end", socketOnEnd);
      websocket._readyState = WebSocket2.CLOSING;
      if (!this._readableState.endEmitted && !websocket._closeFrameReceived && !websocket._receiver._writableState.errorEmitted && this._readableState.length !== 0) {
        const chunk = this.read(this._readableState.length);
        websocket._receiver.write(chunk);
      }
      websocket._receiver.end();
      this[kWebSocket] = void 0;
      clearTimeout(websocket._closeTimer);
      if (websocket._receiver._writableState.finished || websocket._receiver._writableState.errorEmitted) {
        websocket.emitClose();
      } else {
        websocket._receiver.on("error", receiverOnFinish);
        websocket._receiver.on("finish", receiverOnFinish);
      }
    }
    function socketOnData(chunk) {
      if (!this[kWebSocket]._receiver.write(chunk)) {
        this.pause();
      }
    }
    function socketOnEnd() {
      const websocket = this[kWebSocket];
      websocket._readyState = WebSocket2.CLOSING;
      websocket._receiver.end();
      this.end();
    }
    function socketOnError() {
      const websocket = this[kWebSocket];
      this.removeListener("error", socketOnError);
      this.on("error", NOOP);
      if (websocket) {
        websocket._readyState = WebSocket2.CLOSING;
        this.destroy();
      }
    }
  }
});

// node_modules/ws/lib/stream.js
var require_stream = __commonJS({
  "node_modules/ws/lib/stream.js"(exports, module) {
    "use strict";
    var WebSocket2 = require_websocket();
    var { Duplex } = __require("stream");
    function emitClose(stream) {
      stream.emit("close");
    }
    function duplexOnEnd() {
      if (!this.destroyed && this._writableState.finished) {
        this.destroy();
      }
    }
    function duplexOnError(err) {
      this.removeListener("error", duplexOnError);
      this.destroy();
      if (this.listenerCount("error") === 0) {
        this.emit("error", err);
      }
    }
    function createWebSocketStream2(ws, options) {
      let terminateOnDestroy = true;
      const duplex = new Duplex({
        ...options,
        autoDestroy: false,
        emitClose: false,
        objectMode: false,
        writableObjectMode: false
      });
      ws.on("message", function message(msg, isBinary) {
        const data = !isBinary && duplex._readableState.objectMode ? msg.toString() : msg;
        if (!duplex.push(data)) ws.pause();
      });
      ws.once("error", function error(err) {
        if (duplex.destroyed) return;
        terminateOnDestroy = false;
        duplex.destroy(err);
      });
      ws.once("close", function close() {
        if (duplex.destroyed) return;
        duplex.push(null);
      });
      duplex._destroy = function(err, callback) {
        if (ws.readyState === ws.CLOSED) {
          callback(err);
          process.nextTick(emitClose, duplex);
          return;
        }
        let called = false;
        ws.once("error", function error(err2) {
          called = true;
          callback(err2);
        });
        ws.once("close", function close() {
          if (!called) callback(err);
          process.nextTick(emitClose, duplex);
        });
        if (terminateOnDestroy) ws.terminate();
      };
      duplex._final = function(callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open3() {
            duplex._final(callback);
          });
          return;
        }
        if (ws._socket === null) return;
        if (ws._socket._writableState.finished) {
          callback();
          if (duplex._readableState.endEmitted) duplex.destroy();
        } else {
          ws._socket.once("finish", function finish() {
            callback();
          });
          ws.close();
        }
      };
      duplex._read = function() {
        if (ws.isPaused) ws.resume();
      };
      duplex._write = function(chunk, encoding, callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open3() {
            duplex._write(chunk, encoding, callback);
          });
          return;
        }
        ws.send(chunk, callback);
      };
      duplex.on("end", duplexOnEnd);
      duplex.on("error", duplexOnError);
      return duplex;
    }
    module.exports = createWebSocketStream2;
  }
});

// node_modules/ws/lib/subprotocol.js
var require_subprotocol = __commonJS({
  "node_modules/ws/lib/subprotocol.js"(exports, module) {
    "use strict";
    var { tokenChars } = require_validation();
    function parse(header) {
      const protocols = /* @__PURE__ */ new Set();
      let start = -1;
      let end = -1;
      let i = 0;
      for (i; i < header.length; i++) {
        const code = header.charCodeAt(i);
        if (end === -1 && tokenChars[code] === 1) {
          if (start === -1) start = i;
        } else if (i !== 0 && (code === 32 || code === 9)) {
          if (end === -1 && start !== -1) end = i;
        } else if (code === 44) {
          if (start === -1) {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
          if (end === -1) end = i;
          const protocol2 = header.slice(start, end);
          if (protocols.has(protocol2)) {
            throw new SyntaxError(`The "${protocol2}" subprotocol is duplicated`);
          }
          protocols.add(protocol2);
          start = end = -1;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      }
      if (start === -1 || end !== -1) {
        throw new SyntaxError("Unexpected end of input");
      }
      const protocol = header.slice(start, i);
      if (protocols.has(protocol)) {
        throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
      }
      protocols.add(protocol);
      return protocols;
    }
    module.exports = { parse };
  }
});

// node_modules/ws/lib/websocket-server.js
var require_websocket_server = __commonJS({
  "node_modules/ws/lib/websocket-server.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("events");
    var http = __require("http");
    var { Duplex } = __require("stream");
    var { createHash: createHash7 } = __require("crypto");
    var extension2 = require_extension();
    var PerMessageDeflate2 = require_permessage_deflate();
    var subprotocol2 = require_subprotocol();
    var WebSocket2 = require_websocket();
    var { CLOSE_TIMEOUT, GUID, kWebSocket } = require_constants();
    var keyRegex = /^[+/0-9A-Za-z]{22}==$/;
    var RUNNING = 0;
    var CLOSING = 1;
    var CLOSED = 2;
    var WebSocketServer2 = class extends EventEmitter {
      /**
       * Create a `WebSocketServer` instance.
       *
       * @param {Object} options Configuration options
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Boolean} [options.autoPong=true] Specifies whether or not to
       *     automatically send a pong in response to a ping
       * @param {Number} [options.backlog=511] The maximum length of the queue of
       *     pending connections
       * @param {Boolean} [options.clientTracking=true] Specifies whether or not to
       *     track clients
       * @param {Number} [options.closeTimeout=30000] Duration in milliseconds to
       *     wait for the closing handshake to finish after `websocket.close()` is
       *     called
       * @param {Function} [options.handleProtocols] A hook to handle protocols
       * @param {String} [options.host] The hostname where to bind the server
       * @param {Number} [options.maxBufferedChunks=262144] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=16384] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=104857600] The maximum allowed message
       *     size
       * @param {Number} [options.maxPendingAutoPongs=60] The maximum number of
       *     pending automatic pongs
       * @param {Boolean} [options.noServer=false] Enable no server mode
       * @param {String} [options.path] Accept only connections matching this path
       * @param {(Boolean|Object)} [options.perMessageDeflate=false] Enable/disable
       *     permessage-deflate
       * @param {Number} [options.port] The port where to bind the server
       * @param {(http.Server|https.Server)} [options.server] A pre-created HTTP/S
       *     server to use
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @param {Function} [options.verifyClient] A hook to reject connections
       * @param {Function} [options.WebSocket=WebSocket] Specifies the `WebSocket`
       *     class to use. It must be the `WebSocket` class or class that extends it
       * @param {Function} [callback] A listener for the `listening` event
       */
      constructor(options, callback) {
        super();
        options = {
          allowSynchronousEvents: true,
          autoPong: true,
          maxBufferedChunks: 256 * 1024,
          maxFragments: 16 * 1024,
          maxPayload: 100 * 1024 * 1024,
          maxPendingAutoPongs: 60,
          skipUTF8Validation: false,
          perMessageDeflate: false,
          handleProtocols: null,
          clientTracking: true,
          closeTimeout: CLOSE_TIMEOUT,
          verifyClient: null,
          noServer: false,
          backlog: null,
          // use default (511 as implemented in net.js)
          server: null,
          host: null,
          path: null,
          port: null,
          WebSocket: WebSocket2,
          ...options
        };
        if (options.port == null && !options.server && !options.noServer || options.port != null && (options.server || options.noServer) || options.server && options.noServer) {
          throw new TypeError(
            'One and only one of the "port", "server", or "noServer" options must be specified'
          );
        }
        if (options.port != null) {
          this._server = http.createServer((req, res) => {
            const body2 = http.STATUS_CODES[426];
            res.writeHead(426, {
              "Content-Length": body2.length,
              "Content-Type": "text/plain"
            });
            res.end(body2);
          });
          this._server.listen(
            options.port,
            options.host,
            options.backlog,
            callback
          );
        } else if (options.server) {
          this._server = options.server;
        }
        if (this._server) {
          const emitConnection = this.emit.bind(this, "connection");
          this._removeListeners = addListeners(this._server, {
            listening: this.emit.bind(this, "listening"),
            error: this.emit.bind(this, "error"),
            upgrade: (req, socket, head) => {
              this.handleUpgrade(req, socket, head, emitConnection);
            }
          });
        }
        if (options.perMessageDeflate === true) options.perMessageDeflate = {};
        if (options.clientTracking) {
          this.clients = /* @__PURE__ */ new Set();
          this._shouldEmitClose = false;
        }
        this.options = options;
        this._state = RUNNING;
      }
      /**
       * Returns the bound address, the address family name, and port of the server
       * as reported by the operating system if listening on an IP socket.
       * If the server is listening on a pipe or UNIX domain socket, the name is
       * returned as a string.
       *
       * @return {(Object|String|null)} The address of the server
       * @public
       */
      address() {
        if (this.options.noServer) {
          throw new Error('The server is operating in "noServer" mode');
        }
        if (!this._server) return null;
        return this._server.address();
      }
      /**
       * Stop the server from accepting new connections and emit the `'close'` event
       * when all existing connections are closed.
       *
       * @param {Function} [cb] A one-time listener for the `'close'` event
       * @public
       */
      close(cb) {
        if (this._state === CLOSED) {
          if (cb) {
            this.once("close", () => {
              cb(new Error("The server is not running"));
            });
          }
          process.nextTick(emitClose, this);
          return;
        }
        if (cb) this.once("close", cb);
        if (this._state === CLOSING) return;
        this._state = CLOSING;
        if (this.options.noServer || this.options.server) {
          if (this._server) {
            this._removeListeners();
            this._removeListeners = this._server = null;
          }
          if (this.clients) {
            if (!this.clients.size) {
              process.nextTick(emitClose, this);
            } else {
              this._shouldEmitClose = true;
            }
          } else {
            process.nextTick(emitClose, this);
          }
        } else {
          const server = this._server;
          this._removeListeners();
          this._removeListeners = this._server = null;
          server.close(() => {
            emitClose(this);
          });
        }
      }
      /**
       * See if a given request should be handled by this server instance.
       *
       * @param {http.IncomingMessage} req Request object to inspect
       * @return {Boolean} `true` if the request is valid, else `false`
       * @public
       */
      shouldHandle(req) {
        if (this.options.path) {
          const index = req.url.indexOf("?");
          const pathname = index !== -1 ? req.url.slice(0, index) : req.url;
          if (pathname !== this.options.path) return false;
        }
        return true;
      }
      /**
       * Handle a HTTP Upgrade request.
       *
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @public
       */
      handleUpgrade(req, socket, head, cb) {
        socket.on("error", socketOnError);
        const key = req.headers["sec-websocket-key"];
        const upgrade = req.headers.upgrade;
        const version = +req.headers["sec-websocket-version"];
        if (req.method !== "GET") {
          const message = "Invalid HTTP method";
          abortHandshakeOrEmitwsClientError(this, req, socket, 405, message);
          return;
        }
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          const message = "Invalid Upgrade header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (key === void 0 || !keyRegex.test(key)) {
          const message = "Missing or invalid Sec-WebSocket-Key header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (version !== 13 && version !== 8) {
          const message = "Missing or invalid Sec-WebSocket-Version header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message, {
            "Sec-WebSocket-Version": "13, 8"
          });
          return;
        }
        if (!this.shouldHandle(req)) {
          abortHandshake(socket, 400);
          return;
        }
        const secWebSocketProtocol = req.headers["sec-websocket-protocol"];
        let protocols = /* @__PURE__ */ new Set();
        if (secWebSocketProtocol !== void 0) {
          try {
            protocols = subprotocol2.parse(secWebSocketProtocol);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Protocol header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        const secWebSocketExtensions = req.headers["sec-websocket-extensions"];
        const extensions = {};
        if (this.options.perMessageDeflate && secWebSocketExtensions !== void 0) {
          const perMessageDeflate = new PerMessageDeflate2({
            ...this.options.perMessageDeflate,
            isServer: true,
            maxPayload: this.options.maxPayload
          });
          try {
            const offers = extension2.parse(secWebSocketExtensions);
            if (offers[PerMessageDeflate2.extensionName]) {
              perMessageDeflate.accept(offers[PerMessageDeflate2.extensionName]);
              extensions[PerMessageDeflate2.extensionName] = perMessageDeflate;
            }
          } catch (err) {
            const message = "Invalid or unacceptable Sec-WebSocket-Extensions header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        if (this.options.verifyClient) {
          const info = {
            origin: req.headers[`${version === 8 ? "sec-websocket-origin" : "origin"}`],
            secure: !!(req.socket.authorized || req.socket.encrypted),
            req
          };
          if (this.options.verifyClient.length === 2) {
            this.options.verifyClient(info, (verified, code, message, headers) => {
              if (!verified) {
                return abortHandshake(socket, code || 401, message, headers);
              }
              this.completeUpgrade(
                extensions,
                key,
                protocols,
                req,
                socket,
                head,
                cb
              );
            });
            return;
          }
          if (!this.options.verifyClient(info)) return abortHandshake(socket, 401);
        }
        this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
      }
      /**
       * Upgrade the connection to WebSocket.
       *
       * @param {Object} extensions The accepted extensions
       * @param {String} key The value of the `Sec-WebSocket-Key` header
       * @param {Set} protocols The subprotocols
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @throws {Error} If called more than once with the same socket
       * @private
       */
      completeUpgrade(extensions, key, protocols, req, socket, head, cb) {
        if (!socket.readable || !socket.writable) return socket.destroy();
        if (socket[kWebSocket]) {
          throw new Error(
            "server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration"
          );
        }
        if (this._state > RUNNING) return abortHandshake(socket, 503);
        const digest = createHash7("sha1").update(key + GUID).digest("base64");
        const headers = [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${digest}`
        ];
        const ws = new this.options.WebSocket(null, void 0, this.options);
        if (protocols.size) {
          const protocol = this.options.handleProtocols ? this.options.handleProtocols(protocols, req) : protocols.values().next().value;
          if (protocol) {
            headers.push(`Sec-WebSocket-Protocol: ${protocol}`);
            ws._protocol = protocol;
          }
        }
        if (extensions[PerMessageDeflate2.extensionName]) {
          const params = extensions[PerMessageDeflate2.extensionName].params;
          const value = extension2.format({
            [PerMessageDeflate2.extensionName]: [params]
          });
          headers.push(`Sec-WebSocket-Extensions: ${value}`);
          ws._extensions = extensions;
        }
        this.emit("headers", headers, req);
        socket.write(headers.concat("\r\n").join("\r\n"));
        socket.removeListener("error", socketOnError);
        ws.setSocket(socket, head, {
          allowSynchronousEvents: this.options.allowSynchronousEvents,
          maxBufferedChunks: this.options.maxBufferedChunks,
          maxFragments: this.options.maxFragments,
          maxPayload: this.options.maxPayload,
          skipUTF8Validation: this.options.skipUTF8Validation
        });
        if (this.clients) {
          this.clients.add(ws);
          ws.on("close", () => {
            this.clients.delete(ws);
            if (this._shouldEmitClose && !this.clients.size) {
              process.nextTick(emitClose, this);
            }
          });
        }
        cb(ws, req);
      }
    };
    module.exports = WebSocketServer2;
    function addListeners(server, map) {
      for (const event of Object.keys(map)) server.on(event, map[event]);
      return function removeListeners() {
        for (const event of Object.keys(map)) {
          server.removeListener(event, map[event]);
        }
      };
    }
    function emitClose(server) {
      server._state = CLOSED;
      server.emit("close");
    }
    function socketOnError() {
      this.destroy();
    }
    function abortHandshake(socket, code, message, headers) {
      message = message || http.STATUS_CODES[code];
      headers = {
        Connection: "close",
        "Content-Type": "text/html",
        "Content-Length": Buffer.byteLength(message),
        ...headers
      };
      socket.once("finish", socket.destroy);
      socket.end(
        `HTTP/1.1 ${code} ${http.STATUS_CODES[code]}\r
` + Object.keys(headers).map((h) => `${h}: ${headers[h]}`).join("\r\n") + "\r\n\r\n" + message
      );
    }
    function abortHandshakeOrEmitwsClientError(server, req, socket, code, message, headers) {
      if (server.listenerCount("wsClientError")) {
        const err = new Error(message);
        Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError);
        server.emit("wsClientError", err, socket, req);
      } else {
        abortHandshake(socket, code, message, headers);
      }
    }
  }
});

// index.js
import { join as join12, resolve as resolve6 } from "node:path";

// node_modules/ws/wrapper.mjs
var import_stream = __toESM(require_stream(), 1);
var import_extension = __toESM(require_extension(), 1);
var import_permessage_deflate = __toESM(require_permessage_deflate(), 1);
var import_receiver = __toESM(require_receiver(), 1);
var import_sender = __toESM(require_sender(), 1);
var import_subprotocol = __toESM(require_subprotocol(), 1);
var import_websocket = __toESM(require_websocket(), 1);
var import_websocket_server = __toESM(require_websocket_server(), 1);

// src/config.js
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join as join3 } from "node:path";

// node_modules/@deepseek-ai/cosmokit/lib/index.js
function isNullable(value) {
  return value === null || value === void 0;
}
function isPlainObject(data) {
  return data && typeof data === "object" && !Array.isArray(data);
}
function filterKeys(object, filter) {
  return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
}
function mapValues(object, transform) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
}
function pick(source, keys, forced) {
  if (!keys) return { ...source };
  const result = {};
  for (const key of keys) if (forced || source[key] !== void 0) result[key] = source[key];
  return result;
}
var write = /* @__PURE__ */ Symbol.for("cosmokit.volatile.write");
function snapshot(value, ancestors = /* @__PURE__ */ new Set()) {
  if (typeof value === "function") throw new TypeError("volatile config cannot contain functions");
  if (value === null || typeof value !== "object") return value;
  if (ancestors.has(value)) throw new TypeError("volatile config cannot contain cycles");
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return Object.freeze(value.map((item) => snapshot(item, ancestors)));
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new TypeError("volatile config objects must be plain objects or arrays");
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, snapshot(item, ancestors)])));
  } finally {
    ancestors.delete(value);
  }
}
function createVolatile(value) {
  let current = snapshot(value);
  return Object.freeze({
    get: () => current,
    [write]: (value2) => {
      current = value2;
    }
  });
}
function isVolatile(value) {
  return typeof value === "object" && value !== null && write in value;
}
function is(type, value) {
  if (arguments.length === 1) return (value2) => is(type, value2);
  return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
}
function isArrayBufferLike(value) {
  return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
}
function isArrayBufferSource(value) {
  return isArrayBufferLike(value) || ArrayBuffer.isView(value);
}
var Binary;
(function(Binary2) {
  Binary2.is = isArrayBufferLike;
  Binary2.isSource = isArrayBufferSource;
  function fromSource(source) {
    if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
    else return source;
  }
  Binary2.fromSource = fromSource;
  function toBase64(source) {
    source = fromSource(source);
    if (typeof Buffer !== "undefined") return Buffer.from(source).toString("base64");
    let binary = "";
    const bytes = new Uint8Array(source);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  Binary2.toBase64 = toBase64;
  function fromBase64(source) {
    if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
    return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
  }
  Binary2.fromBase64 = fromBase64;
  function toHex(source) {
    source = fromSource(source);
    if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
    return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  Binary2.toHex = toHex;
  function fromHex(source) {
    if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
    const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
    const buffer = [];
    for (let i = 0; i < hex.length; i += 2) buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
    return Uint8Array.from(buffer).buffer;
  }
  Binary2.fromHex = fromHex;
})(Binary || (Binary = {}));
var base64ToArrayBuffer = Binary.fromBase64;
var arrayBufferToBase64 = Binary.toBase64;
var hexToArrayBuffer = Binary.fromHex;
var arrayBufferToHex = Binary.toHex;
function clone(source, refs = /* @__PURE__ */ new Map()) {
  if (!source || typeof source !== "object") return source;
  if (is("Date", source)) return new Date(source.valueOf());
  if (is("RegExp", source)) return new RegExp(source.source, source.flags);
  if (isArrayBufferLike(source)) return source.slice(0);
  if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
  const cached = refs.get(source);
  if (cached) return cached;
  if (Array.isArray(source)) {
    const result2 = [];
    refs.set(source, result2);
    source.forEach((value, index) => {
      result2[index] = Reflect.apply(clone, null, [value, refs]);
    });
    return result2;
  }
  const result = Object.create(Object.getPrototypeOf(source));
  refs.set(source, result);
  for (const key of Reflect.ownKeys(source)) {
    const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
    if ("value" in descriptor) descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
    Reflect.defineProperty(result, key, descriptor);
  }
  return result;
}
function deepEqual(a, b, strict) {
  const ancestors = /* @__PURE__ */ new Set();
  function compare(a2, b2) {
    if (a2 === b2) return true;
    if (isVolatile(a2) || isVolatile(b2)) return isVolatile(a2) && isVolatile(b2);
    if (!strict && isNullable(a2) && isNullable(b2)) return true;
    if (typeof a2 !== typeof b2 || typeof a2 !== "object" || !a2 || !b2) return false;
    if (ancestors.has(a2)) return false;
    function check(test, then) {
      return test(a2) ? test(b2) ? then(a2, b2) : false : test(b2) ? false : void 0;
    }
    ancestors.add(a2);
    try {
      return check(Array.isArray, (a3, b3) => {
        if (a3.length !== b3.length) return false;
        for (let index = 0; index < a3.length; index++) if (!compare(a3[index], b3[index])) return false;
        return true;
      }) ?? check(is("Date"), (a3, b3) => a3.valueOf() === b3.valueOf()) ?? check(is("URL"), (a3, b3) => a3.href === b3.href) ?? check(is("RegExp"), (a3, b3) => a3.source === b3.source && a3.flags === b3.flags) ?? check(isArrayBufferLike, (a3, b3) => {
        if (a3.byteLength !== b3.byteLength) return false;
        const viewA = new Uint8Array(a3);
        const viewB = new Uint8Array(b3);
        for (let i = 0; i < viewA.length; i++) if (viewA[i] !== viewB[i]) return false;
        return true;
      }) ?? ((!strict || [a2, b2].every((value) => Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) && Object.keys({
        ...a2,
        ...b2
      }).every((key) => compare(a2[key], b2[key])));
    } finally {
      ancestors.delete(a2);
    }
  }
  return compare(a, b);
}
var Time;
(function(Time2) {
  Time2.millisecond = 1;
  Time2.second = 1e3;
  Time2.minute = Time2.second * 60;
  Time2.hour = Time2.minute * 60;
  Time2.day = Time2.hour * 24;
  Time2.week = Time2.day * 7;
  let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
  function setTimezoneOffset(offset) {
    timezoneOffset = offset;
  }
  Time2.setTimezoneOffset = setTimezoneOffset;
  function getTimezoneOffset() {
    return timezoneOffset;
  }
  Time2.getTimezoneOffset = getTimezoneOffset;
  function getDateNumber(date2 = /* @__PURE__ */ new Date(), offset) {
    if (typeof date2 === "number") date2 = new Date(date2);
    if (offset === void 0) offset = timezoneOffset;
    return Math.floor((date2.valueOf() / Time2.minute - offset) / 1440);
  }
  Time2.getDateNumber = getDateNumber;
  function fromDateNumber(value, offset) {
    const date2 = new Date(value * Time2.day);
    if (offset === void 0) offset = timezoneOffset;
    return new Date(+date2 + offset * Time2.minute);
  }
  Time2.fromDateNumber = fromDateNumber;
  const numeric = /\d+(?:\.\d+)?/.source;
  const timeRegExp = new RegExp(`^${[
    "w(?:eek(?:s)?)?",
    "d(?:ay(?:s)?)?",
    "h(?:our(?:s)?)?",
    "m(?:in(?:ute)?(?:s)?)?",
    "s(?:ec(?:ond)?(?:s)?)?"
  ].map((unit) => `(${numeric}${unit})?`).join("")}$`);
  function parseTime(source) {
    const capture = timeRegExp.exec(source);
    if (!capture) return 0;
    return (parseFloat(capture[1]) * Time2.week || 0) + (parseFloat(capture[2]) * Time2.day || 0) + (parseFloat(capture[3]) * Time2.hour || 0) + (parseFloat(capture[4]) * Time2.minute || 0) + (parseFloat(capture[5]) * Time2.second || 0);
  }
  Time2.parseTime = parseTime;
  function parseDate(date2) {
    const parsed = parseTime(date2);
    if (parsed) date2 = Date.now() + parsed;
    else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date2)) date2 = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date2}`;
    else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date2)) date2 = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date2}`;
    return date2 ? new Date(date2) : /* @__PURE__ */ new Date();
  }
  Time2.parseDate = parseDate;
  function format(ms) {
    const abs = Math.abs(ms);
    if (abs >= Time2.day - Time2.hour / 2) return Math.round(ms / Time2.day) + "d";
    else if (abs >= Time2.hour - Time2.minute / 2) return Math.round(ms / Time2.hour) + "h";
    else if (abs >= Time2.minute - Time2.second / 2) return Math.round(ms / Time2.minute) + "m";
    else if (abs >= Time2.second) return Math.round(ms / Time2.second) + "s";
    return ms + "ms";
  }
  Time2.format = format;
  function toDigits(source, length = 2) {
    return source.toString().padStart(length, "0");
  }
  Time2.toDigits = toDigits;
  function template(template2, time = /* @__PURE__ */ new Date()) {
    return template2.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
  }
  Time2.template = template;
})(Time || (Time = {}));

// node_modules/@deepseek-ai/schemastery/lib/index.mjs
var kSchema = /* @__PURE__ */ Symbol.for("schemastery");
var kValidationError = /* @__PURE__ */ Symbol.for("ValidationError");
globalThis.__schemastery_index__ ??= 0;
globalThis.__schemastery_refs__ = void 0;
var ValidationError = class extends TypeError {
  options;
  name = "ValidationError";
  constructor(message, options) {
    let prefix = "$";
    for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
    else if (typeof segment === "number") prefix += "[" + segment + "]";
    else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
    if (prefix.startsWith(".")) prefix = prefix.slice(1);
    super((prefix === "$" ? "" : `${prefix} `) + message);
    this.options = options;
  }
  static is(error) {
    return !!error?.[kValidationError];
  }
};
Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
var Schema = function(options) {
  const schema = function(data, options2 = {}) {
    return Schema.resolve(data, schema, options2)[0];
  };
  if (options.refs) {
    const refs = mapValues(options.refs, (options2) => new Schema(options2));
    const getRef = (uid) => refs[uid];
    for (const key in refs) {
      const options2 = refs[key];
      options2.sKey = getRef(options2.sKey);
      options2.inner = getRef(options2.inner);
      options2.list = options2.list && options2.list.map(getRef);
      options2.dict = options2.dict && mapValues(options2.dict, getRef);
    }
    return refs[options.uid];
  }
  Object.assign(schema, options);
  if (typeof schema.callback === "string") try {
    schema.callback = new Function("return " + schema.callback)();
  } catch {
  }
  Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
  Object.setPrototypeOf(schema, Schema.prototype);
  schema.meta ||= {};
  schema.toString = schema.toString.bind(schema);
  return schema;
};
Schema.prototype = Object.create(Function.prototype);
Schema.prototype[kSchema] = true;
Object.defineProperty(Schema.prototype, "~standard", { get() {
  return {
    version: 1,
    vendor: "schemastery",
    validate: (value) => {
      try {
        return { value: Schema.resolve(value, this, {})[0] };
      } catch (error) {
        if (ValidationError.is(error)) return { issues: [{
          message: error.message,
          path: error.options.path
        }] };
        throw error;
      }
    }
  };
} });
Schema.ValidationError = ValidationError;
Schema.prototype.toJSON = function toJSON() {
  if (globalThis.__schemastery_refs__) {
    globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
    return this.uid;
  }
  globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
  globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
  const result = {
    uid: this.uid,
    refs: globalThis.__schemastery_refs__
  };
  globalThis.__schemastery_refs__ = void 0;
  return result;
};
Schema.prototype.set = function set(key, value) {
  this.dict[key] = value;
  return this;
};
Schema.prototype.push = function push(value) {
  this.list.push(value);
  return this;
};
function mergeDesc(original, messages) {
  const result = typeof original === "string" ? { "": original } : { ...original };
  for (const locale in messages) {
    const value = messages[locale];
    if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
    else if (typeof value === "string") result[locale] = value;
  }
  return result;
}
function getInner(value) {
  return value?.$value ?? value?.$inner;
}
function extractKeys(data) {
  return filterKeys(data ?? {}, (key) => !key.startsWith("$"));
}
Schema.prototype.i18n = function i18n(messages) {
  const schema = Schema(this);
  const desc = mergeDesc(schema.meta.description, messages);
  if (Object.keys(desc).length) schema.meta.description = desc;
  if (schema.dict) schema.dict = mapValues(schema.dict, (inner, key) => {
    return inner.i18n(mapValues(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
  });
  if (schema.list) schema.list = schema.list.map((inner, index) => {
    return inner.i18n(mapValues(messages, (data = {}) => {
      if (Array.isArray(getInner(data))) return getInner(data)[index];
      if (Array.isArray(data)) return data[index];
      return extractKeys(data);
    }));
  });
  if (schema.inner) schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
    if (getInner(data)) return getInner(data);
    return extractKeys(data);
  }));
  if (schema.sKey) schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
  return schema;
};
Schema.prototype.extra = function extra(key, value) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    [key]: value
  };
  return schema;
};
for (const key of [
  "required",
  "disabled",
  "collapse",
  "hidden",
  "loose"
]) Object.assign(Schema.prototype, { [key](value = true) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    [key]: value
  };
  return schema;
} });
Schema.prototype.deprecated = function deprecated() {
  const schema = Schema(this);
  schema.meta.badges ||= [];
  schema.meta.badges.push({
    text: "deprecated",
    type: "danger"
  });
  return schema;
};
Schema.prototype.experimental = function experimental() {
  const schema = Schema(this);
  schema.meta.badges ||= [];
  schema.meta.badges.push({
    text: "experimental",
    type: "warning"
  });
  return schema;
};
Schema.prototype.pattern = function pattern(regexp) {
  const schema = Schema(this);
  const pattern2 = pick(regexp, ["source", "flags"]);
  schema.meta = {
    ...schema.meta,
    pattern: pattern2
  };
  return schema;
};
Schema.prototype.simplify = function simplify(value) {
  if (isVolatile(value)) value = value.get();
  if (deepEqual(value, this.meta.default, this.type === "dict")) return null;
  if (isNullable(value)) return value;
  if (this.type === "object" || this.type === "dict") {
    const result = {};
    for (const key in value) {
      const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
      if (this.type === "dict" || !isNullable(item)) result[key] = item;
    }
    if (deepEqual(result, this.meta.default, this.type === "dict")) return null;
    return result;
  } else if (this.type === "array" || this.type === "tuple") {
    const result = [];
    value.forEach((value2, index) => {
      const schema = this.type === "array" ? this.inner : this.list[index];
      const item = schema ? schema.simplify(value2) : value2;
      result.push(item);
    });
    return result;
  } else if (this.type === "intersect") {
    const result = {};
    for (const item of this.list) Object.assign(result, item.simplify(value));
    return result;
  } else if (this.type === "union") for (const schema of this.list) try {
    Schema.resolve(value, schema, {});
    return schema.simplify(value);
  } catch {
  }
  return value;
};
Schema.prototype.toString = function toString(inline) {
  return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
};
Schema.prototype.role = function role(role, extra2) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    role,
    extra: extra2
  };
  return schema;
};
for (const key of [
  "default",
  "link",
  "comment",
  "description",
  "max",
  "min",
  "step"
]) Object.assign(Schema.prototype, { [key](value) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    [key]: value
  };
  return schema;
} });
Schema.prototype.volatile = function volatile() {
  if (this.meta.volatile) throw new TypeError("volatile schema is already wrapped");
  return this.extra("volatile", true);
};
var resolvers = {};
var checkedVolatile = /* @__PURE__ */ Symbol("checked-volatile-schema");
function validateVolatileSchema(schema, path = [], blocked = false, seen = /* @__PURE__ */ new Map()) {
  const states = seen.get(schema) ?? /* @__PURE__ */ new Set();
  if (states.has(blocked)) return;
  states.add(blocked);
  seen.set(schema, states);
  if (schema.meta?.volatile && blocked) throw new ValidationError("volatile fields require a fixed object path without an enclosing volatile field", { path });
  const nested = blocked || !!schema.meta?.volatile;
  if (schema.dict) for (const [key, child] of Object.entries(schema.dict)) validateVolatileSchema(child, [...path, key], nested, seen);
  if (schema.sKey) validateVolatileSchema(schema.sKey, [...path, "<key>"], true, seen);
  if (schema.inner && (schema.type !== "lazy" || schema.inner[kSchema])) validateVolatileSchema(schema.inner, [...path, "*"], true, seen);
  if (schema.list) for (let index = 0; index < schema.list.length; index++) validateVolatileSchema(schema.list[index], [...path, String(index)], true, seen);
}
Schema.extend = function extend(type, resolve7) {
  resolvers[type] = resolve7;
};
Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
  if (!schema) return [data];
  if (!options[checkedVolatile]) {
    validateVolatileSchema(schema, options.path);
    options = {
      ...options,
      [checkedVolatile]: true
    };
  }
  if (schema.meta?.volatile) {
    const inner = Schema(schema);
    inner.meta = {
      ...schema.meta,
      volatile: false
    };
    const [value, adapted] = Schema.resolve(data, inner, options, strict);
    try {
      return [createVolatile(value), adapted];
    } catch (error) {
      throw new ValidationError(error instanceof Error ? error.message : String(error), options);
    }
  }
  if (options.ignore?.(data, schema)) return [data];
  if (isNullable(data) && schema.type !== "lazy") {
    if (schema.meta.required) throw new ValidationError(`missing required value`, options);
    let current = schema;
    let fallback = schema.meta.default;
    while (current?.type === "intersect" && isNullable(fallback)) {
      current = current.list[0];
      fallback = current?.meta.default;
    }
    if (isNullable(fallback)) return [data];
    data = clone(fallback);
  }
  const callback = resolvers[schema.type];
  if (!callback) throw new ValidationError(`unsupported type "${schema.type}"`, options);
  try {
    return callback(data, schema, options, strict);
  } catch (error) {
    if (!schema.meta.loose) throw error;
    return [schema.meta.default];
  }
};
Schema.from = function from(source) {
  if (isNullable(source)) return Schema.any();
  else if ([
    "string",
    "number",
    "boolean"
  ].includes(typeof source)) return Schema.const(source).required();
  else if (source[kSchema]) return source;
  else if (typeof source === "function") switch (source) {
    case String:
      return Schema.string().required();
    case Number:
      return Schema.number().required();
    case Boolean:
      return Schema.boolean().required();
    case Function:
      return Schema.function().required();
    default:
      return Schema.is(source).required();
  }
  else throw new TypeError(`cannot infer schema from ${source}`);
};
Schema.lazy = function lazy(builder) {
  const toJSON2 = () => {
    if (!schema.inner[kSchema]) {
      schema.inner = schema.builder();
      schema.inner.meta = {
        ...schema.meta,
        ...schema.inner.meta
      };
    }
    return schema.inner.toJSON();
  };
  const schema = new Schema({
    type: "lazy",
    builder,
    inner: { toJSON: toJSON2 }
  });
  return schema;
};
Schema.natural = function natural() {
  return Schema.number().step(1).min(0);
};
Schema.percent = function percent() {
  return Schema.number().step(0.01).min(0).max(1).role("slider");
};
Schema.date = function date() {
  return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
    const date2 = new Date(value);
    if (isNaN(+date2)) throw new ValidationError(`invalid date "${value}"`, options);
    return date2;
  }, true)]);
};
Schema.regExp = function regExp(flag = "") {
  return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
    try {
      return new RegExp(value, flag);
    } catch (e) {
      throw new ValidationError(e.message, options);
    }
  }, true)]);
};
Schema.arrayBuffer = function arrayBuffer(encoding) {
  return Schema.union([
    Schema.is(ArrayBuffer),
    Schema.is(SharedArrayBuffer),
    Schema.transform(Schema.any(), (value, options) => {
      if (Binary.isSource(value)) return Binary.fromSource(value);
      throw new ValidationError(`expected ArrayBufferSource but got ${value}`, options);
    }, true),
    ...encoding ? [Schema.transform(Schema.string(), (value, options) => {
      try {
        return encoding === "base64" ? Binary.fromBase64(value) : Binary.fromHex(value);
      } catch (e) {
        throw new ValidationError(e.message, options);
      }
    }, true)] : []
  ]);
};
Schema.extend("lazy", (data, schema, options, strict) => {
  if (!schema.inner[kSchema]) {
    schema.inner = schema.builder();
    schema.inner.meta = {
      ...schema.meta,
      ...schema.inner.meta
    };
    validateVolatileSchema(schema.inner, options.path, true);
  }
  return Schema.resolve(data, schema.inner, options, strict);
});
Schema.extend("any", (data) => {
  return [data];
});
Schema.extend("never", (data, _, options) => {
  throw new ValidationError(`expected nullable but got ${data}`, options);
});
Schema.extend("const", (data, { value }, options) => {
  if (deepEqual(data, value)) return [value];
  throw new ValidationError(`expected ${value} but got ${data}`, options);
});
function checkWithinRange(data, meta, description, options, skipMin = false) {
  const { max = Infinity, min = -Infinity } = meta;
  if (data > max) throw new ValidationError(`expected ${description} <= ${max} but got ${data}`, options);
  if (data < min && !skipMin) throw new ValidationError(`expected ${description} >= ${min} but got ${data}`, options);
}
Schema.extend("string", (data, { meta }, options) => {
  if (typeof data !== "string") throw new ValidationError(`expected string but got ${data}`, options);
  if (meta.pattern) {
    const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
    if (!regexp.test(data)) throw new ValidationError(`expect string to match regexp ${regexp}`, options);
  }
  checkWithinRange(data.length, meta, "string length", options);
  return [data];
});
function decimalShift(data, digits) {
  const str = data.toString();
  if (str.includes("e")) return data * Math.pow(10, digits);
  const index = str.indexOf(".");
  if (index === -1) return data * Math.pow(10, digits);
  const frac = str.slice(index + 1);
  const integer = str.slice(0, index);
  if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
  return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
}
function isMultipleOf(data, min, step) {
  step = Math.abs(step);
  if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
  const index = step.toString().indexOf(".");
  const digits = step.toString().slice(index + 1).length;
  return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
}
Schema.extend("number", (data, { meta }, options) => {
  if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
  checkWithinRange(data, meta, "number", options);
  const { step } = meta;
  if (step && !isMultipleOf(data, meta.min ?? 0, step)) throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
  return [data];
});
Schema.extend("boolean", (data, _, options) => {
  if (typeof data === "boolean") return [data];
  throw new ValidationError(`expected boolean but got ${data}`, options);
});
Schema.extend("bitset", (data, { bits, meta }, options) => {
  let value = 0, keys = [];
  if (typeof data === "number") {
    value = data;
    for (const key in bits) if (data & bits[key]) keys.push(key);
  } else if (Array.isArray(data)) {
    keys = data;
    for (const key of keys) {
      if (typeof key !== "string") throw new ValidationError(`expected string but got ${key}`, options);
      if (key in bits) value |= bits[key];
    }
  } else throw new ValidationError(`expected number or array but got ${data}`, options);
  if (value === meta.default) return [value];
  return [value, keys];
});
Schema.extend("function", (data, _, options) => {
  if (typeof data === "function") return [data];
  throw new ValidationError(`expected function but got ${data}`, options);
});
Schema.extend("is", (data, { constructor }, options) => {
  if (typeof constructor === "function") {
    if (data instanceof constructor) return [data];
    throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
  } else {
    if (isNullable(data)) throw new ValidationError(`expected ${constructor} but got ${data}`, options);
    let prototype = Object.getPrototypeOf(data);
    while (prototype) {
      if (prototype.constructor?.name === constructor) return [data];
      prototype = Object.getPrototypeOf(prototype);
    }
    throw new ValidationError(`expected ${constructor} but got ${data}`, options);
  }
});
function property(data, key, schema, options) {
  try {
    const [value, adapted] = Schema.resolve(data[key], schema, {
      ...options,
      path: [...options.path || [], key]
    });
    if (adapted !== void 0) data[key] = adapted;
    return value;
  } catch (e) {
    if (!options?.autofix) throw e;
    delete data[key];
    return schema.meta.volatile ? createVolatile(schema.meta.default) : schema.meta.default;
  }
}
Schema.extend("array", (data, { inner, meta }, options) => {
  if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
  checkWithinRange(data.length, meta, "array length", options, !isNullable(inner.meta.default));
  return [data.map((_, index) => property(data, index, inner, options))];
});
Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
  if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
  const result = {};
  for (const key in data) {
    let rKey;
    try {
      rKey = Schema.resolve(key, sKey, options)[0];
    } catch (error) {
      if (strict) continue;
      throw error;
    }
    result[rKey] = property(data, key, inner, options);
    data[rKey] = data[key];
    if (key !== rKey) delete data[key];
  }
  return [result];
});
Schema.extend("tuple", (data, { list }, options, strict) => {
  if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
  const result = list.map((inner, index) => property(data, index, inner, options));
  if (strict) return [result];
  result.push(...data.slice(list.length));
  return [result];
});
function merge(result, data) {
  for (const key in data) {
    if (key in result) continue;
    result[key] = data[key];
  }
}
Schema.extend("object", (data, { dict }, options, strict) => {
  if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
  const result = {};
  for (const key in dict) {
    const value = property(data, key, dict[key], options);
    if (!isNullable(value) || key in data) result[key] = value;
  }
  if (!strict) merge(result, data);
  return [result];
});
Schema.extend("union", (data, { list, toString: toString2 }, options, strict) => {
  const messages = [];
  for (const inner of list) try {
    return Schema.resolve(data, inner, options, strict);
  } catch (error) {
    messages.push(error);
  }
  throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
});
Schema.extend("intersect", (data, { list, toString: toString2 }, options, strict) => {
  if (!list.length) return [data];
  let result;
  for (const inner of list) {
    const value = Schema.resolve(data, inner, options, true)[0];
    if (isNullable(value)) continue;
    if (isNullable(result)) result = value;
    else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
    else if (typeof value === "object") merge(result ??= {}, value);
    else if (result !== value) throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
  }
  if (!strict && isPlainObject(data)) merge(result, data);
  return [result];
});
Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
  const [result, adapted = data] = Schema.resolve(data, inner, options, true);
  if (preserve) return [callback(result)];
  else return [callback(result), callback(adapted)];
});
var formatters = {};
function defineMethod(name2, keys, format) {
  formatters[name2] = format;
  Object.assign(Schema, { [name2](...args) {
    const schema = new Schema({ type: name2 });
    keys.forEach((key, index) => {
      switch (key) {
        case "sKey":
          schema.sKey = args[index] ?? Schema.string();
          break;
        case "inner":
          schema.inner = Schema.from(args[index]);
          break;
        case "list":
          schema.list = args[index].map(Schema.from);
          break;
        case "dict":
          schema.dict = mapValues(args[index], Schema.from);
          break;
        case "bits":
          schema.bits = {};
          for (const key2 in args[index]) {
            if (typeof args[index][key2] !== "number") continue;
            schema.bits[key2] = args[index][key2];
          }
          break;
        case "callback": {
          const callback = schema.callback = args[index];
          callback["toJSON"] ||= () => callback.toString();
          break;
        }
        case "constructor": {
          const constructor = schema.constructor = args[index];
          if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
          break;
        }
        default:
          schema[key] = args[index];
      }
    });
    if (name2 === "object" || name2 === "dict") schema.meta.default = {};
    else if (name2 === "array" || name2 === "tuple") schema.meta.default = [];
    else if (name2 === "bitset") schema.meta.default = 0;
    return schema;
  } });
}
defineMethod("is", ["constructor"], ({ constructor }) => {
  if (typeof constructor === "function") return constructor.name;
  else return constructor;
});
defineMethod("any", [], () => "any");
defineMethod("never", [], () => "never");
defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
defineMethod("string", [], () => "string");
defineMethod("number", [], () => "number");
defineMethod("boolean", [], () => "boolean");
defineMethod("bitset", ["bits"], () => "bitset");
defineMethod("function", [], () => "function");
defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
defineMethod("object", ["dict"], ({ dict }) => {
  if (Object.keys(dict).length === 0) return "{}";
  return `{ ${Object.entries(dict).map(([key, inner]) => {
    return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
  }).join(", ")} }`;
});
defineMethod("union", ["list"], ({ list }, inline) => {
  const result = list.map(({ toString: format }) => format()).join(" | ");
  return inline ? `(${result})` : result;
});
defineMethod("intersect", ["list"], ({ list }) => {
  return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
});
defineMethod("transform", [
  "inner",
  "callback",
  "preserve"
], ({ inner }, isInner) => inner.toString(isInner));

// src/delivery.js
import { basename } from "node:path";
var PREFIX = "media-hub";
var DELIVERY_MODES = Object.freeze(["origin", "r2"]);
function createDelivery({ mode }) {
  if (mode === "origin") {
    return {
      mode,
      available: true,
      mediaUrl: (roomId, index, item) => `${PREFIX}/media/${roomId}/${index}/${encodeURIComponent(basename(item.file))}`,
      subtitleUrl: (roomId, index, n) => `${PREFIX}/subs/${roomId}/${index}/${n}.vtt`
    };
  }
  if (mode === "r2") {
    const reason = 'R2 delivery is not built yet; use delivery mode "origin".';
    const missing = () => {
      throw Object.assign(new Error(reason), { code: "unsupported" });
    };
    return { mode, available: false, reason, mediaUrl: missing, subtitleUrl: missing };
  }
  throw Object.assign(new Error(`unknown delivery mode ${String(mode)}`), { code: "invalid" });
}

// src/sources/command.js
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, constants, mkdir, rm, stat } from "node:fs/promises";
import { basename as basename2, delimiter, isAbsolute, join } from "node:path";
var SEARCH_LIMIT = 12;
var QUERY_TIMEOUT_MS = 6e4;
var COVER_TIMEOUT_MS = 3e4;
var MAX_OUTPUT = 16 * 1024 * 1024;
var ID = /^[^\s\0]{1,200}$/;
var sourceError = (code, message) => Object.assign(new Error(message), { code });
var text = (value) => typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
var numberOrNull = (value) => Number.isFinite(value) ? value : null;
var STATUSES = /* @__PURE__ */ new Set(["finished", "ongoing", "stopped"]);
var COVER_URL = /^https?:\/\/[^\s]{1,2000}$/;
var MAX_TAGS = 12;
var MAX_META = 16;
var MAX_RELATED = 30;
var countOrNull = (value) => Number.isInteger(value) && value >= 0 ? value : null;
var FORMAT = /^[a-z0-9]{1,8}$/;
var MAX_FORMATS = 12;
var YEAR = (value) => Number.isInteger(value) && value > 0 && value < 1e4 ? value : null;
function formatsOf(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const row of raw) {
    const format = text(row?.format).toLowerCase().replace(/^\./, "");
    if (!FORMAT.test(format) || seen.has(format)) continue;
    seen.add(format);
    out.push({ format, bytes: countOrNull(row.bytes) });
    if (out.length === MAX_FORMATS) break;
  }
  return out;
}
function popularityOf(raw) {
  if (raw === null || typeof raw !== "object" || !(raw.count >= 0) || !Number.isFinite(raw.count)) return null;
  const label = text(raw.label);
  return label === "" ? null : { count: Math.round(raw.count), label, text: text(raw.text) };
}
function metaOf(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => row !== null && typeof row === "object" ? { key: text(row.key), label: text(row.label), value: text(row.value) } : null).filter((row) => row !== null && row.label !== "" && row.value !== "").slice(0, MAX_META);
}
function factsOf(raw) {
  return {
    cover: COVER_URL.test(text(raw.cover)) ? text(raw.cover) : null,
    popularity: popularityOf(raw.popularity),
    status: STATUSES.has(text(raw.status)) ? text(raw.status) : "",
    tags: Array.isArray(raw.tags) ? raw.tags.map(text).filter(Boolean).slice(0, MAX_TAGS) : [],
    latest: text(raw.latest),
    meta: metaOf(raw.meta),
    year: YEAR(raw.year),
    language: text(raw.language).slice(0, 35),
    publisher: text(raw.publisher),
    origin: text(raw.origin),
    formats: formatsOf(raw.formats),
    bytes: countOrNull(raw.bytes)
  };
}
function resultOf(raw, kindIds) {
  if (raw === null || typeof raw !== "object") return null;
  const id = text(raw.id);
  const kind = text(raw.kind);
  if (!ID.test(id) || kindIds !== null && !kindIds.has(kind)) return null;
  return { id, title: text(raw.title), kind, author: text(raw.author), score: numberOrNull(raw.score), blurb: text(raw.blurb).replace(/\s+/g, " "), episodes: countOrNull(raw.episode_count), ...factsOf(raw) };
}
function parseSearch(document, kinds) {
  if (!Array.isArray(document?.results)) throw sourceError("source_failed", "the search answer has no results list");
  const kindIds = new Set(kinds.map((kind) => kind.id));
  return document.results.map((raw) => resultOf(raw, kindIds)).filter((result) => result !== null);
}
function nextOffset(document, offset = 0) {
  return Number.isInteger(document?.next) && document.next > offset ? document.next : null;
}
function parseInfo(document) {
  const id = text(document?.id);
  if (!ID.test(id)) throw sourceError("source_failed", "the source returned no work");
  const listed = Array.isArray(document.episodes) ? document.episodes.length : 0;
  const related = (Array.isArray(document.related) ? document.related : []).map((raw) => {
    const work = resultOf(raw, null);
    return work === null ? null : { ...work, relation: text(raw.relation) };
  }).filter((work) => work !== null && work.id !== id).slice(0, MAX_RELATED);
  const episodeTitles = Array.isArray(document.episodes) ? document.episodes.map((episode) => text(episode?.title)) : [];
  return { ...resultOf(document, null), id, episodes: listed > 0 ? listed : null, episodeTitles, related };
}
async function commandExists(command, path = process.env.PATH ?? "") {
  const candidates = isAbsolute(command) ? [command] : path.split(delimiter).filter(Boolean).map((dir) => join(dir, command));
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return true;
    } catch {
    }
  }
  return false;
}
function sha256Of(path) {
  return new Promise((resolve7, reject) => {
    const hash = createHash("sha256");
    createReadStream(path).on("data", (chunk) => hash.update(chunk)).on("error", reject).on("end", () => resolve7(hash.digest("hex")));
  });
}
function run(argv, { signal, timeoutMs, onStdoutLine, cwd, env } = {}) {
  return new Promise((resolve7, reject) => {
    const [command, ...args] = argv;
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], detached: true, cwd, env: { ...process.env, ...env } });
    let stdout = "";
    let stderr = "";
    let pending = "";
    let oversized = false;
    const stop = () => {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
      }
    };
    const timer = timeoutMs ? setTimeout(stop, timeoutMs) : null;
    signal?.addEventListener("abort", stop, { once: true });
    child.stdout.on("data", (chunk) => {
      if (onStdoutLine === void 0) {
        stdout += chunk;
        if (stdout.length > MAX_OUTPUT) {
          oversized = true;
          stop();
        }
        return;
      }
      pending += chunk;
      const lines = pending.split("\n");
      pending = lines.pop();
      for (const line of lines) onStdoutLine(line);
    });
    child.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk).slice(-8e3);
    });
    child.on("error", (error) => {
      if (timer) clearTimeout(timer);
      reject(error.code === "ENOENT" ? sourceError("unavailable", `${command} is not installed`) : error);
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      signal?.removeEventListener("abort", stop);
      if (onStdoutLine !== void 0 && pending.trim() !== "") onStdoutLine(pending);
      resolve7({ code, stdout, stderr, oversized });
    });
  });
}
function parseLine(line) {
  try {
    const event = JSON.parse(line);
    return event !== null && typeof event === "object" ? event : null;
  } catch {
    return null;
  }
}
async function verify(dir, event, label, logger) {
  const name2 = typeof event.name === "string" ? event.name : "";
  if (name2 === "" || basename2(name2) !== name2 || name2.startsWith(".")) return { ok: false, name: name2 };
  const path = join(dir, name2);
  try {
    const intact = (await stat(path)).size === event.bytes && (typeof event.sha256 !== "string" || await sha256Of(path) === event.sha256);
    if (intact) return { ok: true, name: name2 };
    await rm(path, { force: true });
    logger.warn("%s: %s does not match what the command reported; removed", label, name2);
  } catch (error) {
    if (error.code !== "ENOENT") logger.warn("%s: could not check %s: %s", label, name2, error.message);
    else logger.warn("%s: %s was reported done but is not there", label, name2);
  }
  return { ok: false, name: name2 };
}
var lastLine = (text2) => text2.trim().split("\n").filter(Boolean).pop() ?? "";
var FILTERS = Object.freeze(["language", "format", "year"]);
function filterArgs({ language = "", format = "", yearFrom = null, yearTo = null } = {}, understood = []) {
  const args = [];
  if (understood.includes("language") && /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/.test(language)) args.push("--language", language);
  if (understood.includes("format") && FORMAT.test(format)) args.push("--format", format);
  if (understood.includes("year")) {
    if (YEAR(yearFrom) !== null) args.push("--year-from", String(yearFrom));
    if (YEAR(yearTo) !== null) args.push("--year-to", String(yearTo));
  }
  return args;
}
function createCommandSource(definition, { logger, cwd }) {
  const { id: sourceId, label, kinds, command, env = {}, filters: understood = [] } = definition;
  const kindIds = new Set(kinds.map((kind) => kind.id));
  const name2 = () => label || sourceId;
  async function workDir() {
    await mkdir(cwd, { recursive: true });
    return cwd;
  }
  async function query(args) {
    const { code, stdout, stderr, oversized } = await run([...command, ...args], { timeoutMs: QUERY_TIMEOUT_MS, cwd: await workDir(), env });
    if (oversized) throw sourceError("source_failed", `${name2()}: the answer is too large`);
    if (code !== 0) throw sourceError("source_failed", `${name2()}: ${lastLine(stderr) || `exit ${code}`}`);
    try {
      return JSON.parse(stdout);
    } catch {
      throw sourceError("source_failed", `${name2()}: the answer is not JSON`);
    }
  }
  return {
    id: sourceId,
    label: name2(),
    kinds,
    filters: understood,
    available: () => commandExists(command[0]),
    /** @returns {{ results: object[], next: number | null }} `next` is the offset of the following page when the source offers one. */
    async search(textQuery, { kind = kinds[0]?.id, limit = SEARCH_LIMIT, offset = 0, filters = {} } = {}) {
      if (!kindIds.has(kind)) throw sourceError("invalid", `${name2()} has no kind ${kind}`);
      const q = String(textQuery ?? "").trim();
      if (q === "") return { results: [], next: null };
      const paging = offset > 0 ? ["--offset", String(offset)] : [];
      const document = await query(["search", "--kind", kind, "--limit", String(limit), ...paging, ...filterArgs(filters, understood), "--json", "--", q]);
      return { results: parseSearch(document, kinds).filter((result) => result.kind === kind), next: nextOffset(document, offset) };
    },
    async info(id) {
      if (!ID.test(String(id))) throw sourceError("invalid", `not a ${name2()} id`);
      return parseInfo(await query(["info", "--json", "--", String(id)]));
    },
    /** Fetch a cover image into `file` through the command, which keeps its own network policy. Rejects when the command has no `cover` verb or cannot fetch it. */
    async cover(url, file) {
      if (!COVER_URL.test(String(url))) throw sourceError("invalid", "not a cover url");
      const { code, stderr } = await run([...command, "cover", "--output", file, "--", String(url)], { timeoutMs: COVER_TIMEOUT_MS, cwd: await workDir(), env });
      if (code !== 0) throw sourceError("source_failed", `${name2()}: ${lastLine(stderr) || `exit ${code}`}`);
    },
    async download({ id, dir, from: from2 = 1, to = null, signal, onEpisode, onStart }) {
      if (!ID.test(String(id))) throw sourceError("invalid", `not a ${name2()} id`);
      const failed = [];
      let result = null;
      let checking = Promise.resolve();
      const episodes = to === null ? `${from2}-` : from2 === to ? String(from2) : `${from2}-${to}`;
      const onLine = (line) => {
        const event = parseLine(line);
        if (event?.event === "start" && Number.isInteger(event.number)) {
          onStart?.(event.number);
          onEpisode?.();
        } else if (event?.event === "done") {
          checking = checking.then(() => verify(dir, event, name2(), logger)).then((file) => {
            if (file.ok) onEpisode?.();
            else failed.push(file.name);
          });
        } else if (event?.event === "failed" && typeof event.name === "string") failed.push(event.name);
        else if (event?.event === "result") result = event;
      };
      const argv = [...command, "download", `--id=${String(id)}`, "--episodes", episodes, "--output", dir, "--json"];
      const { code, stderr } = await run(argv, { signal, cwd: await workDir(), env, onStdoutLine: onLine });
      await checking;
      onEpisode?.();
      if (signal?.aborted) return { failed };
      if (code !== 0 && failed.length === 0) {
        logger.warn("%s download %s ended with %s: %s", name2(), id, code, lastLine(stderr));
        throw sourceError("source_failed", `${name2()}: ${lastLine(stderr) || `exit ${code}`}`);
      }
      if (code === 0 && result === null) throw sourceError("source_failed", `${name2()}: the download ended without a result`);
      return { failed };
    },
    /**
     * Download one work of a book kind as one file in `format` into `dir`.
     * @returns {Promise<{ name: string, bytes: number, sha256: string }>} the file, checked against what the command reported
     */
    async downloadFile({ id, format, dir, signal }) {
      if (!ID.test(String(id))) throw sourceError("invalid", `not a ${name2()} id`);
      if (!FORMAT.test(String(format))) throw sourceError("invalid", `not a format: ${format}`);
      await mkdir(dir, { recursive: true });
      const reported = [];
      let result = null;
      const onLine = (line) => {
        const event2 = parseLine(line);
        if (event2?.event === "done") reported.push(event2);
        else if (event2?.event === "result") result = event2;
      };
      const argv = [...command, "download", `--id=${String(id)}`, "--format", String(format), "--output", dir, "--json"];
      const { code, stderr } = await run(argv, { signal, cwd: await workDir(), env, onStdoutLine: onLine });
      if (signal?.aborted) throw sourceError("cancelled", `${name2()}: cancelled`);
      if (code !== 0) throw sourceError("source_failed", `${name2()}: ${lastLine(stderr) || `exit ${code}`}`);
      if (result === null || reported.length === 0) throw sourceError("source_failed", `${name2()}: the download ended without a file`);
      const event = reported[reported.length - 1];
      const file = await verify(dir, event, name2(), logger);
      if (!file.ok) throw sourceError("source_failed", `${name2()}: the file did not arrive whole`);
      return { name: file.name, bytes: event.bytes, sha256: typeof event.sha256 === "string" ? event.sha256 : await sha256Of(join(dir, file.name)) };
    }
  };
}

// src/sources/index.js
import { join as join2 } from "node:path";
var EPISODE_BYTES = Object.freeze({ drama: 15e6, audio: 8e6 });
var MEDIA = Object.freeze(["video", "audio", "book"]);
var ALL_SOURCES = "all";
var RESERVED_IDS = Object.freeze(["local", "youtube", ALL_SOURCES]);
function createSources(definitions, { stateDir, logger }) {
  const seen = /* @__PURE__ */ new Set();
  for (const { id, kinds } of definitions) {
    if (kinds.length === 0) throw new Error(`source ${id} lists no kinds`);
    if (RESERVED_IDS.includes(id)) throw new Error(`source id ${id} is reserved`);
    if (seen.has(id)) throw new Error(`source id ${id} is listed twice`);
    seen.add(id);
  }
  return definitions.map((definition) => createCommandSource(definition, { logger, cwd: join2(stateDir, definition.id) }));
}
async function describeSources(sources) {
  const out = [];
  for (const source of sources) {
    if (await source.available()) out.push({ id: source.id, label: source.label, kinds: source.kinds.map((kind) => ({ ...kind, media: kind.media ?? "video" })), filters: source.filters });
  }
  return out;
}

// src/config.js
var DSH_HOME = process.env.DSH_HOME || join3(homedir(), ".dsh");
function defaultStateDir(home = DSH_HOME, exists2 = existsSync) {
  const current = join3(home, "media-hub");
  const earlier = join3(home, "videosync");
  return !exists2(current) && exists2(earlier) ? earlier : current;
}
var DEFAULT_STATE_DIR = defaultStateDir();
var SourceConfig = Schema.object({
  id: Schema.string().pattern(/^[a-z0-9][a-z0-9_-]{0,31}$/).description("Stable id, lowercase letters, digits, - and _. Names the source in URLs and saved downloads, and the folder the command runs in (stateDir/<id>). Not local or youtube."),
  label: Schema.string().default("").description("Name on the source's tab. Empty uses the id."),
  kinds: Schema.array(Schema.object({
    id: Schema.string().pattern(/^[a-z0-9][a-z0-9_-]{0,31}$/).description("What the command's search --kind takes."),
    label: Schema.string().description("Name of the filter chip."),
    media: Schema.union(MEDIA.map((media) => Schema.const(media))).default("video").description("What a work of this kind is: video or audio (episodes, watched or listened to together in a room) or book (one file, downloaded in a format).")
  })).description("What the source can search for; at least one."),
  filters: Schema.array(Schema.union(FILTERS.map((filter) => Schema.const(filter)))).default([]).description("Search filters the command understands (docs/source-protocol.md). The hub filters the answers by language, format, year and size itself as well."),
  command: Schema.array(Schema.string()).min(1).description("The command and its fixed arguments, one entry per word; the plugin adds the protocol verbs after them."),
  env: Schema.dict(Schema.string()).default({}).description("Extra environment variables for the command.")
});
var DEFAULT_SOURCES = Object.freeze([
  {
    id: "fanqie",
    label: "Fanqie",
    kinds: [{ id: "drama", label: "Short dramas", media: "video" }, { id: "audio", label: "Audiobooks", media: "audio" }, { id: "novel", label: "Novels", media: "book" }],
    filters: [],
    command: ["fanqie"],
    env: {}
  },
  {
    id: "bookfetch",
    label: "Books",
    kinds: [{ id: "ebook", label: "Ebooks", media: "book" }, { id: "paper", label: "Papers", media: "book" }],
    filters: ["language", "format", "year"],
    command: ["bookfetch", "source"],
    env: {}
  }
]);
var Config = Schema.object({
  label: Schema.string().default("").description("Name of the sidebar entry. Empty uses the default in the viewer's language (Media)."),
  libraryRoots: Schema.array(Schema.string()).default([]).description('Folders whose videos and episode folders anyone signed in may start a room from in the panel. The "library" folder inside the state folder is always included. The agent tool can open any path.'),
  delivery: Schema.union(DELIVERY_MODES.map((mode) => Schema.const(mode))).default("origin").description("Where viewers load local media from. origin: DSH's own web server (through whatever sits in front of DSH). r2: object storage with signed links (not built yet)."),
  stateDir: Schema.string().default(DEFAULT_STATE_DIR).description("Folder for open rooms (rooms.json), the default library folder (library, where downloads go), prepared media (cache), the watch log (watch-log.jsonl) and library notes (shows.json, downloads.json)."),
  maxHeight: Schema.natural().min(240).default(1080).description("Videos taller than this, or in codecs browsers cannot play, are transcoded to H.264 at this height."),
  threads: Schema.natural().min(1).default(2).description("ffmpeg threads for transcoding. Jobs run one at a time at low priority."),
  emptyMinutes: Schema.natural().min(1).default(30).description("A room closes this many minutes after its last viewer left."),
  unopenedHours: Schema.natural().min(1).default(24).description("A room nobody has opened yet closes this many hours after it was created, so a link sent ahead of time still works."),
  cacheDays: Schema.natural().min(1).default(7).description("Prepared media no open room uses is deleted after this many days."),
  autoDeleteDays: Schema.natural().default(7).description("A library show is deleted this many days after it was watched to the end (its last episode, or every episode), unless someone keeps it. 0 never deletes."),
  cacheAhead: Schema.natural().default(5).description("Rolling cache: how many episodes after the one being watched are kept on disk for a show from a source. The episode being watched is fetched first, then these in order."),
  cacheBehind: Schema.natural().default(1).description("Rolling cache: how many watched episodes before the current one stay on disk. Older watched episodes are deleted (the watch log still marks them watched)."),
  cacheLimitGb: Schema.number().min(0).default(5).description("Rolling cache: the most disk, in GB, that cached episodes of shows from a source may use. Past it the least recently watched go first, never one near where a room is. Shows kept offline do not count. 0 means no limit."),
  sources: Schema.array(SourceConfig).default(DEFAULT_SOURCES.map((source) => ({ ...source, kinds: [...source.kinds], filters: [...source.filters], command: [...source.command] }))).description("Where the search box looks for shows and the library downloads them from. Each source is a command line tool that speaks the JSON protocol in docs/source-protocol.md; every request goes through that command, so a launcher that routes it through a proxy keeps that rule. A source is hidden while its command is not installed. The list replaces the default, so keep the default entry when adding another."),
  coverCacheMb: Schema.number().min(0).default(50).description("The most disk, in MB, that search result covers may use (stateDir/covers). Past it the least recently shown go. 0 means no limit."),
  bookCacheGb: Schema.number().min(0).default(5).description("The most disk, in GB, that downloaded books may use (stateDir/books). Past it the least recently used files go; they stay on their shelves and can be downloaded again. 0 means no limit."),
  converter: Schema.string().default("ebook-convert").description("Calibre's ebook-convert command. When it is installed, books can be downloaded in formats their source does not have (converted from the best one it has). Empty turns conversion off."),
  notifyCommand: Schema.array(Schema.string()).default([]).description("A command (program and fixed arguments) run when a followed work gets a new season or new episodes, with one line of JSON describing it on its standard input. Empty means nothing is run."),
  ffmpeg: Schema.string().default("ffmpeg").description("ffmpeg command."),
  ffprobe: Schema.string().default("ffprobe").description("ffprobe command."),
  ytDlp: Schema.string().default("yt-dlp").description("yt-dlp command, used to list the videos of a YouTube playlist.")
});

// src/http.js
import { createReadStream as createReadStream2, existsSync as existsSync2 } from "node:fs";
import { readFile, stat as stat2 } from "node:fs/promises";
import { dirname, extname, isAbsolute as isAbsolute2, relative, resolve as resolve2, sep } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// src/filters.js
var LANGUAGE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/;
var YEAR2 = (value) => Number.isInteger(value) && value > 0 && value < 1e4 ? value : null;
function parseFilters(param) {
  const whole = (name2) => {
    const value = Number.parseInt(param(name2), 10);
    return Number.isFinite(value) && value > 0 ? value : null;
  };
  const language = param("language").trim();
  const format = param("format").trim().toLowerCase();
  return {
    language: LANGUAGE.test(language) ? language.toLowerCase() : "",
    format: FORMAT.test(format) ? format : "",
    yearFrom: YEAR2(whole("yearFrom")),
    yearTo: YEAR2(whole("yearTo")),
    maxBytes: whole("maxMb") === null ? null : whole("maxMb") * 1e6
  };
}
var primary = (code) => code.toLowerCase().split("-")[0];
function smallestBytes(result) {
  const sizes = [result.bytes, ...(result.formats ?? []).map((entry) => entry.bytes)].filter((size) => Number.isInteger(size) && size > 0);
  return sizes.length === 0 ? null : Math.min(...sizes);
}
function matches(result, { language = "", format = "", yearFrom = null, yearTo = null, maxBytes = null } = {}) {
  if (language && result.language && primary(result.language) !== primary(language)) return false;
  if (format && (result.formats ?? []).length > 0 && !result.formats.some((entry) => entry.format === format)) return false;
  if (yearFrom !== null && result.year !== null && result.year !== void 0 && result.year < yearFrom) return false;
  if (yearTo !== null && result.year !== null && result.year !== void 0 && result.year > yearTo) return false;
  const size = smallestBytes(result);
  if (maxBytes !== null && size !== null && size > maxBytes) return false;
  return true;
}
var applyFilters = (results, filters) => results.filter((result) => matches(result, filters));
function interleave(lists) {
  const out = [];
  const longest = Math.max(0, ...lists.map((list) => list.length));
  for (let index = 0; index < longest; index += 1) {
    for (const list of lists) if (index < list.length) out.push(list[index]);
  }
  return out;
}

// src/http.js
var ROUTE = `/${PREFIX}`;
var WS_PATH = `${ROUTE}/ws`;
var SECURITY_HEADERS = Object.freeze({
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff"
});
var MEDIA_TYPES = Object.freeze({
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
  ".m4s": "video/iso.segment",
  ".aac": "audio/aac",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".vtt": "text/vtt; charset=utf-8",
  ".jpg": "image/jpeg"
});
var WEB_TYPES = Object.freeze({ ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" });
var here = fileURLToPath(new URL(".", import.meta.url));
var WEB_DIR = resolve2(here, "../web");
var MODULES = Object.freeze({
  "sync.js": resolve2(here, "../src/sync.js"),
  "youtube-url.js": resolve2(here, "../src/youtube-url.js"),
  "formats.js": resolve2(here, "../src/formats.js")
});
function hlsFile() {
  const built = resolve2(here, "../dist/hls.mjs");
  return existsSync2(built) ? built : resolve2(dirname(createRequire(import.meta.url).resolve("hls.js/package.json")), "dist/hls.mjs");
}
function webFile(name2) {
  if (name2 === "hls.mjs") return hlsFile();
  if (MODULES[name2] !== void 0) return MODULES[name2];
  return /^[a-z0-9-]+\.(js|css)$/.test(name2) ? resolve2(WEB_DIR, name2) : void 0;
}
function admitOwner(connection, request) {
  const admission = connection.admit(request);
  if ("rejection" in admission) return { ok: false, status: admission.rejection };
  if (admission.peer?.principal?.kind !== "owner") return { ok: false, status: 403 };
  return { ok: true };
}
function resolveRange(header, size) {
  if (typeof header !== "string" || header.trim() === "") return { kind: "absent" };
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (match === null || size <= 0) return { kind: "unsatisfiable" };
  const [, rawStart, rawEnd] = match;
  if (rawStart === "") {
    const suffix = Number(rawEnd);
    if (rawEnd === "" || !(suffix > 0)) return { kind: "unsatisfiable" };
    return { kind: "window", start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(rawStart);
  const end = rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);
  if (start >= size || end < start) return { kind: "unsatisfiable" };
  return { kind: "window", start, end };
}
async function sendFile(req, res, path, type = MEDIA_TYPES[extname(path).toLowerCase()] ?? "application/octet-stream") {
  let info;
  try {
    info = await stat2(path);
  } catch {
    return sendText(res, 404, "Not found.");
  }
  if (!info.isFile()) return sendText(res, 404, "Not found.");
  const size = info.size;
  const range = resolveRange(req.headers.range, size);
  const headers = { ...SECURITY_HEADERS, "cache-control": "private, no-store", "accept-ranges": "bytes", "content-type": type };
  if (range.kind === "unsatisfiable") {
    res.writeHead(416, { ...headers, "content-range": `bytes */${size}` }).end();
    return;
  }
  const start = range.kind === "window" ? range.start : 0;
  const end = range.kind === "window" ? range.end : size - 1;
  const status = range.kind === "window" ? 206 : 200;
  if (range.kind === "window") headers["content-range"] = `bytes ${start}-${end}/${size}`;
  headers["content-length"] = String(size === 0 ? 0 : end - start + 1);
  res.writeHead(status, headers);
  if (req.method === "HEAD" || size === 0) {
    res.end();
    return;
  }
  const stream = createReadStream2(path, { start, end });
  stream.on("error", () => res.destroy());
  res.on("close", () => stream.destroy());
  stream.pipe(res);
}
function sendText(res, status, text2) {
  res.writeHead(status, { ...SECURITY_HEADERS, "content-type": "text/plain; charset=utf-8" }).end(`${text2}
`);
}
function sendJson(res, status, value) {
  const body2 = JSON.stringify(value);
  res.writeHead(status, { ...SECURITY_HEADERS, "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body2) }).end(body2);
}
function within(root, rel) {
  const target = resolve2(root, rel);
  const back = relative(root, target);
  if (back === "" || back === ".." || back.startsWith(`..${sep}`) || isAbsolute2(back)) return null;
  return target;
}
var MAX_BODY = 64 * 1024;
var byOf = (body2) => typeof body2?.by === "string" ? body2.by.slice(0, 40) : null;
var pick2 = (body2, keys) => Object.fromEntries(keys.filter((key) => body2?.[key] !== void 0).map((key) => [key, body2[key]]));
async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error("request body too large"), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw Object.assign(new Error("request body is not JSON"), { status: 400 });
  }
}
var STATUS = Object.freeze({ invalid: 400, empty: 400, not_found: 404, unsupported: 501, outside: 403, in_use: 409, exists: 409, no_space: 507, source_failed: 502, unavailable: 503 });
function createHandler({ connection, service, label = () => "" }) {
  return async (req, res) => {
    const admitted = admitOwner(connection, req);
    if (!admitted.ok) return sendText(res, admitted.status, admitted.status === 401 ? "Sign in to DSH first." : "Forbidden.");
    const url = new URL(req.url ?? "/", "http://media-hub.invalid");
    const parts = url.pathname.slice(ROUTE.length + 1).split("/").map(decodeURIComponent);
    const hub = service();
    if (hub === void 0) return sendText(res, 503, "The media hub is starting.");
    try {
      if (parts[0] === "web" && parts.length === 2 && req.method === "GET") {
        const file = webFile(parts[1]);
        const body2 = file === void 0 ? null : await readFile(file).catch(() => null);
        if (body2 === null) return sendText(res, 404, "Not found.");
        res.writeHead(200, { ...SECURITY_HEADERS, "content-type": WEB_TYPES[extname(file)], "content-length": body2.length }).end(body2);
        return;
      }
      if (parts[0] === "thumbs" && parts.length === 2 && req.method === "GET") {
        const file = hub.thumbFile(parts[1]);
        return file === null ? sendText(res, 404, "Not found.") : sendFile(req, res, file);
      }
      if (parts[0] === "covers" && parts.length === 2 && req.method === "GET") {
        const cover = await hub.coverFile(parts[1]);
        if (cover === null) return sendText(res, 404, "Not found.");
        return sendFile(req, res, cover.file, cover.type);
      }
      if (parts[0] === "media" && parts.length >= 4 && (req.method === "GET" || req.method === "HEAD")) {
        const item = hub.mediaFile(parts[1], Number(parts[2]));
        if (item === void 0) return sendText(res, 404, "Not found.");
        const rest = parts.slice(3).join("/");
        if (item.kind === "hls") {
          const target = within(dirname(item.file), rest);
          return target === null ? sendText(res, 404, "Not found.") : sendFile(req, res, target);
        }
        return sendFile(req, res, item.file);
      }
      if (parts[0] === "subs" && parts.length === 4 && req.method === "GET") {
        const file = hub.subtitleFile(parts[1], Number(parts[2]), Number.parseInt(parts[3], 10));
        return file === void 0 ? sendText(res, 404, "Not found.") : sendFile(req, res, file, MEDIA_TYPES[".vtt"]);
      }
      if (parts[0] === "api") {
        const route = `${req.method} ${parts.slice(1).join("/")}`;
        const query = (name2) => url.searchParams.get(name2) ?? "";
        if (route === "GET rooms") return sendJson(res, 200, { rooms: await hub.listRooms() });
        if (req.method === "GET" && parts[1] === "rooms" && parts.length === 4 && parts[3] === "work") return sendJson(res, 200, hub.roomWork(parts[2]));
        if (route === "POST rooms") return sendJson(res, 200, await hub.createRoom({ ...pick2(await readJson(req), ["source", "path", "urls", "title", "by", "start"]), fromPanel: true }));
        if (req.method === "DELETE" && parts[1] === "rooms" && parts.length === 3) return sendJson(res, 200, hub.closeRoom(parts[2]));
        if (route === "GET library") return sendJson(res, 200, await hub.library());
        if (route === "GET library/episodes") return sendJson(res, 200, { episodes: await hub.episodes(query("path")) });
        if (route === "DELETE library") {
          const by = query("by") || null;
          return sendJson(res, 200, query("episode") ? await hub.removeEpisode(query("path"), query("episode"), by) : await hub.removeShow(query("path"), by));
        }
        if (route === "POST library/rename") {
          const body2 = await readJson(req);
          return sendJson(res, 200, await hub.renameShow(body2.path, body2.name, byOf(body2)));
        }
        if (route === "POST library/keep") {
          const body2 = await readJson(req);
          return sendJson(res, 200, await hub.keepShow(body2.path, byOf(body2)));
        }
        if (route === "POST library/countdown") {
          const body2 = await readJson(req);
          return sendJson(res, 200, await hub.countdownShow(body2.path, byOf(body2)));
        }
        if (route === "POST library/retry") return sendJson(res, 200, await hub.retryDownload((await readJson(req)).path));
        if (route === "POST library/pin") {
          const body2 = await readJson(req);
          return sendJson(res, 200, await hub.pinShow(body2.path, body2.pinned === true, byOf(body2)));
        }
        if (route === "POST follow") return sendJson(res, 200, await hub.followWork(pick2(await readJson(req), ["source", "id", "follow"])));
        if (route === "POST library/seen") return sendJson(res, 200, hub.dismissNews((await readJson(req)).path));
        if (route === "POST library/refresh") return sendJson(res, 200, { work: await hub.refreshWork((await readJson(req)).path) });
        if (route === "POST library/cancel") return sendJson(res, 200, await hub.cancelDownload((await readJson(req)).path));
        if (route === "GET settings") return sendJson(res, 200, { label: label() });
        if (route === "GET sources") return sendJson(res, 200, { sources: await hub.sources() });
        if (route === "GET search") return sendJson(res, 200, await hub.search(query("source"), query("q"), query("kind") || void 0, Math.max(0, Number.parseInt(query("offset"), 10) || 0), parseFilters(query)));
        if (route === "GET info") return sendJson(res, 200, await hub.info(query("source"), query("id")));
        if (route === "POST fetch") return sendJson(res, 200, await hub.fetch(pick2(await readJson(req), ["source", "id", "watch", "all", "by"])));
      }
      return sendText(res, 404, "Not found.");
    } catch (error) {
      const status = error?.status ?? STATUS[error?.code] ?? 500;
      if (!res.headersSent) sendJson(res, status, { error: { code: error?.code ?? "error", message: error?.message ?? String(error) } });
      else res.destroy();
    }
  };
}
function refuseUpgrade(socket, status) {
  const text2 = { 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found" }[status] ?? "Error";
  socket.end(`HTTP/1.1 ${status} ${text2}\r
Connection: close\r
Content-Length: 0\r
\r
`);
}

// src/media.js
import { spawn as spawn4 } from "node:child_process";
import { statfs as statfs2, stat as stat8 } from "node:fs/promises";
import { join as join11, resolve as resolve5 } from "node:path";

// src/window.js
function windowOf(focus, total, { ahead, behind }) {
  return { first: Math.max(1, focus - behind), last: Math.min(total, focus + ahead) };
}
function planCache({ total, focuses, cached, finished, skip = /* @__PURE__ */ new Set(), pinned = false, ahead, behind }) {
  const protect = /* @__PURE__ */ new Set();
  const want = [];
  const add = (n) => {
    if (!cached.has(n) && !want.includes(n) && (!skip.has(n) || focuses.includes(n))) want.push(n);
  };
  for (const focus of focuses) {
    const { first, last } = windowOf(focus, total, { ahead, behind });
    for (let n = first; n <= last; n++) protect.add(n);
    for (let n = focus; n <= last; n++) add(n);
  }
  if (pinned) {
    const start = focuses[0] ?? 1;
    for (let n = start; n <= total; n++) add(n);
    for (let n = 1; n < start; n++) add(n);
  }
  const trim = pinned ? [] : [...cached].filter((n) => finished.has(n) && !protect.has(n)).sort((a, b) => a - b);
  return { want, protect, trim };
}
function pickEvictions(entries, capBytes) {
  if (!(capBytes > 0)) return [];
  let used = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  const out = [];
  for (const entry of entries.filter((e) => !e.protected).sort((a, b) => a.lastAt - b.lastAt)) {
    if (used <= capBytes) break;
    out.push(entry.key);
    used -= entry.bytes;
  }
  return out;
}
function nextRun(want, have) {
  const missing = want.filter((n) => !have.has(n));
  if (missing.length === 0) return null;
  const from2 = missing[0];
  let to = from2;
  while (missing.includes(to + 1)) to += 1;
  return [from2, to];
}

// src/cache.js
function createCache({ library, downloads, rooms, window: size, logger }) {
  let chain = Promise.resolve();
  const serial = (step) => {
    const result = chain.then(step);
    chain = result.catch((error) => logger.warn("rolling cache: %s", error.message));
    return result;
  };
  async function protectedEpisodes() {
    const out = /* @__PURE__ */ new Map();
    for (const path of await library.sourcedShows()) {
      const info = await library.cacheInfo(path);
      const set2 = /* @__PURE__ */ new Set();
      for (const focus of rooms.focusesOf(path)) {
        const { first, last } = windowOf(focus, info.total, size);
        for (let n = first; n <= last; n++) set2.add(n);
      }
      out.set(path, set2);
    }
    return out;
  }
  async function refreshShow(path, { retry = false } = {}) {
    const info = await library.cacheInfo(path);
    if (info === null) return;
    const focuses = rooms.focusesOf(path);
    const hasRoom = focuses.length > 0;
    const places = hasRoom ? focuses : info.focus === null ? [] : [info.focus];
    const skip = new Set([...info.skip].filter((n) => !places.includes(n)));
    if (skip.size !== info.skip.size) await library.unskip(path, places);
    const plan = planCache({ total: info.total, focuses: places, cached: info.cached, finished: info.finished, skip, pinned: info.pinned, ...size });
    if (plan.trim.length > 0) {
      await library.dropEpisodes(path, plan.trim, { reason: "watched" });
      await rooms.syncShow(path);
    }
    await downloads.want({ source: info.source.source, item: { id: info.source.id, title: info.source.title ?? "", kind: info.source.kind, episodes: info.total }, dir: path }, plan.want, { priority: hasRoom, retry });
  }
  async function enforceCap() {
    if (!(size.capBytes > 0)) return;
    const protectedBy = await protectedEpisodes();
    const entries = (await library.cacheEntries()).map((entry) => ({ ...entry, protected: protectedBy.get(entry.show)?.has(entry.n) === true }));
    const doomed = new Set(pickEvictions(entries, size.capBytes));
    if (doomed.size === 0) return;
    const byShow = /* @__PURE__ */ new Map();
    for (const entry of entries) if (doomed.has(entry.key)) byShow.set(entry.show, [...byShow.get(entry.show) ?? [], entry.n]);
    for (const [path, numbers] of byShow) {
      await library.dropEpisodes(path, numbers, { reason: "cache full" });
      await rooms.syncShow(path);
    }
  }
  return {
    /** Plan one show again: after a room moved, a show was saved, something finished. `retry`: someone asked for an episode, so a failed download is tried again. */
    refresh: (path, options) => serial(async () => {
      await refreshShow(path, options);
      await enforceCap();
    }),
    /** Plan every show a room has open or that is kept offline (at start). */
    refreshActive: () => serial(async () => {
      for (const path of await library.sourcedShows()) {
        const info = await library.cacheInfo(path);
        if (info.pinned || rooms.focusesOf(path).length > 0) await refreshShow(path);
      }
      await enforceCap();
    }),
    enforce: () => serial(enforceCap)
  };
}

// src/books.js
import { spawn as spawn2 } from "node:child_process";
import { createHash as createHash2, randomUUID } from "node:crypto";
import { mkdir as mkdir2, readFile as readFile2, readdir, rename, rm as rm2, stat as stat3, writeFile } from "node:fs/promises";
import { extname as extname2, join as join4 } from "node:path";

// src/formats.js
var CONVERT_TARGETS = Object.freeze(["epub", "azw3", "mobi", "pdf", "txt", "docx", "fb2"]);
var CONVERT_INPUTS = Object.freeze(["epub", "azw3", "mobi", "fb2", "docx", "txt", "pdf"]);
function convertBase(formats) {
  const have = new Set((formats ?? []).map((entry) => entry.format));
  return CONVERT_INPUTS.find((format) => have.has(format)) ?? null;
}

// src/books.js
var BOOK_TYPES = Object.freeze({
  epub: "application/epub+zip",
  pdf: "application/pdf",
  txt: "text/plain; charset=utf-8",
  azw3: "application/vnd.amazon.ebook",
  mobi: "application/x-mobipocket-ebook",
  fb2: "application/x-fictionbook+xml",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  cbz: "application/vnd.comicbook+zip",
  djvu: "image/vnd.djvu"
});
var STATE_FILE = "books.json";
var MAX_ENTRIES = 2e3;
var CONVERT_TIMEOUT_MS = 10 * 6e4;
var CONCURRENCY = 2;
var ENTRY = /^[0-9a-f-]{36}$/;
var booksError = (code, message) => Object.assign(new Error(message), { code });
var fileKey = (source, id, format) => createHash2("sha256").update(`${source}
${id}
${format}`).digest("hex").slice(0, 24);
function attachment(name2) {
  const fallback = name2.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "book";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name2)}`;
}
function sha256Of2(path) {
  return readFile2(path).then((body2) => createHash2("sha256").update(body2).digest("hex"));
}
function runConverter(command, input, output) {
  return new Promise((resolve7, reject) => {
    const child = spawn2(command, [input, output], { stdio: ["ignore", "ignore", "pipe"], detached: true });
    let stderr = "";
    const timer = setTimeout(() => {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
      }
    }, CONVERT_TIMEOUT_MS);
    child.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk).slice(-4e3);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve7();
      else reject(booksError("convert_failed", `conversion failed: ${stderr.trim().split("\n").pop() || `exit ${code}`}`));
    });
  });
}
function createBooks({ dir, sources, capBytes = 0, converter, covers, logger, now = Date.now }) {
  let state = { files: {}, shelves: {} };
  let saving = Promise.resolve();
  const running = /* @__PURE__ */ new Map();
  const waiting = [];
  let active = 0;
  let disposed = false;
  const save = () => {
    saving = saving.then(async () => {
      await mkdir2(dir, { recursive: true });
      const temporary = join4(dir, `.${STATE_FILE}.${process.pid}.tmp`);
      await writeFile(temporary, JSON.stringify(state));
      await rename(temporary, join4(dir, STATE_FILE));
    }).catch((error) => logger.warn("books: could not save the shelves: %s", error.message));
    return saving;
  };
  const shelf = (person) => state.shelves[person] ??= [];
  const holders = (key) => Object.values(state.shelves).some((entries) => entries.some((entry) => entry.file === key));
  function describe(entry) {
    const file = state.files[entry.file];
    return {
      entry: entry.entry,
      source: entry.source,
      id: entry.id,
      format: entry.format,
      title: entry.title,
      author: entry.author,
      cover: entry.cover ? covers.register(entry.source, entry.cover) : null,
      addedAt: entry.addedAt,
      state: file?.state ?? "removed",
      error: file?.error ?? null,
      name: file?.name ?? null,
      bytes: file?.bytes ?? null,
      converted: file?.converted ?? false
    };
  }
  async function usedBytes() {
    return Object.values(state.files).filter((file) => file.state === "ready").reduce((sum, file) => sum + (file.bytes ?? 0), 0);
  }
  async function enforceCap() {
    if (!(capBytes > 0)) return;
    let total = await usedBytes();
    const ready = Object.entries(state.files).filter(([key, file]) => file.state === "ready" && !running.has(key)).sort(([, a], [, b]) => a.usedAt - b.usedAt);
    for (const [key, file] of ready) {
      if (total <= capBytes) break;
      await rm2(join4(dir, "files", key), { recursive: true, force: true });
      total -= file.bytes ?? 0;
      state.files[key] = { ...file, state: "removed", name: null };
    }
  }
  async function fetchFile(key, { source: sourceId, id, format }, signal) {
    const source = sources.get(sourceId);
    const work = await source.info(id);
    const native = (work.formats ?? []).some((entry) => entry.format === format) || (work.formats ?? []).length === 0;
    const scratch = join4(dir, "tmp", key);
    await rm2(scratch, { recursive: true, force: true });
    await mkdir2(scratch, { recursive: true });
    try {
      let name2;
      let converted = false;
      if (native) {
        name2 = (await source.downloadFile({ id, format, dir: scratch, signal })).name;
      } else {
        const base = convertBase(work.formats);
        if (base === null || !await converter.available()) throw booksError("unsupported", `${work.title || id} is not offered as ${format}`);
        const downloaded = (await source.downloadFile({ id, format: base, dir: scratch, signal })).name;
        name2 = `${downloaded.slice(0, downloaded.length - extname2(downloaded).length)}.${format}`;
        await runConverter(converter.command, join4(scratch, downloaded), join4(scratch, name2));
        await rm2(join4(scratch, downloaded), { force: true });
        converted = true;
      }
      const target = join4(dir, "files", key);
      await rm2(target, { recursive: true, force: true });
      await mkdir2(join4(dir, "files"), { recursive: true });
      await rename(scratch, target);
      const path = join4(target, name2);
      return { name: name2, bytes: (await stat3(path)).size, sha256: await sha256Of2(path), converted, title: work.title, author: work.author, cover: work.cover };
    } finally {
      await rm2(scratch, { recursive: true, force: true });
    }
  }
  function pump() {
    while (!disposed && active < CONCURRENCY && waiting.length > 0) {
      const { key, request } = waiting.shift();
      active += 1;
      const controller = new AbortController();
      running.set(key, controller);
      fetchFile(key, request, controller.signal).then((got) => {
        state.files[key] = { ...state.files[key], state: "ready", error: null, name: got.name, bytes: got.bytes, sha256: got.sha256, converted: got.converted, usedAt: now() };
        for (const entries of Object.values(state.shelves)) {
          for (const entry of entries) {
            if (entry.file !== key) continue;
            entry.title ||= got.title ?? "";
            entry.author ||= got.author ?? "";
            entry.cover ||= got.cover ?? null;
          }
        }
        return enforceCap();
      }, (error) => {
        if (disposed) return;
        logger.warn("books: %s:%s as %s failed: %s", request.source, request.id, request.format, error.message);
        state.files[key] = { ...state.files[key], state: "failed", error: error.message };
      }).finally(() => {
        active -= 1;
        running.delete(key);
        save();
        pump();
      });
    }
  }
  function start(key, request) {
    if (running.has(key) || waiting.some((job) => job.key === key)) return;
    state.files[key] = { ...state.files[key], source: request.source, id: request.id, format: request.format, state: "fetching", error: null };
    waiting.push({ key, request });
    pump();
  }
  return {
    async load() {
      try {
        const loaded = JSON.parse(await readFile2(join4(dir, STATE_FILE), "utf8"));
        if (loaded && typeof loaded.files === "object" && typeof loaded.shelves === "object") state = loaded;
      } catch (error) {
        if (error.code !== "ENOENT") logger.warn("books: could not read the shelves: %s", error.message);
      }
      for (const [key, file] of Object.entries(state.files)) {
        if (file.state === "fetching") start(key, file);
        else if (file.state === "ready" && !await stat3(join4(dir, "files", key, file.name ?? "")).then((info) => info.isFile(), () => false)) state.files[key] = { ...file, state: "removed", name: null };
      }
      await rm2(join4(dir, "tmp"), { recursive: true, force: true });
      await this.sweep();
    },
    /** Folders under files/ that no record names (a crash between a rename and a save) are deleted. */
    async sweep() {
      for (const name2 of await readdir(join4(dir, "files")).catch(() => [])) {
        if (state.files[name2] === void 0) await rm2(join4(dir, "files", name2), { recursive: true, force: true });
      }
    },
    async list(person) {
      return {
        entries: shelf(person).map(describe).reverse(),
        usedBytes: await usedBytes(),
        capBytes,
        convert: await converter.available()
      };
    },
    /**
     * Put a work on a person's shelf in `format` and fetch it unless the file is already here.
     * @param {string} person
     * @param {{ source: string, id: string, format: string, title?: string, author?: string, by?: string }} input
     */
    async add(person, { source: sourceId, id, format, title = "", author = "", by = "" }) {
      const source = sources.get(sourceId);
      if (source === void 0 || typeof source.downloadFile !== "function") throw booksError("not_found", `no source ${sourceId}`);
      if (typeof id !== "string" || !/^[^\s\0]{1,200}$/.test(id)) throw booksError("invalid", "not a work id");
      if (typeof format !== "string" || !/^[a-z0-9]{1,8}$/.test(format)) throw booksError("invalid", "not a format");
      const key = fileKey(sourceId, id, format);
      const entries = shelf(person);
      let entry = entries.find((one) => one.file === key);
      if (entry === void 0) {
        if (entries.length >= MAX_ENTRIES) throw booksError("invalid", "this shelf is full; delete some books first");
        entry = { entry: randomUUID(), file: key, source: sourceId, id, format, title: String(title).slice(0, 300), author: String(author).slice(0, 200), cover: null, addedAt: new Date(now()).toISOString(), by: String(by).slice(0, 80) };
        entries.push(entry);
      }
      const file = state.files[key];
      if (file?.state === "ready") state.files[key] = { ...file, usedAt: now() };
      else start(key, { source: sourceId, id, format });
      await save();
      return describe(entry);
    },
    /** Fetch an entry's file again (it failed, or was removed to save space). */
    async retry(person, entryId) {
      const entry = shelf(person).find((one) => one.entry === entryId);
      if (entry === void 0) throw booksError("not_found", "not on this shelf");
      if (state.files[entry.file]?.state !== "ready") start(entry.file, entry);
      await save();
      return describe(entry);
    },
    async remove(person, entryId) {
      const entries = shelf(person);
      const index = entries.findIndex((one) => one.entry === entryId);
      if (index === -1) throw booksError("not_found", "not on this shelf");
      const [entry] = entries.splice(index, 1);
      if (!holders(entry.file)) {
        running.get(entry.file)?.abort();
        const queued = waiting.findIndex((job) => job.key === entry.file);
        if (queued !== -1) waiting.splice(queued, 1);
        delete state.files[entry.file];
        await rm2(join4(dir, "files", entry.file), { recursive: true, force: true });
      }
      await save();
      return { removed: entryId };
    },
    /** The file behind a person's entry, when it is ready. */
    async file(person, entryId) {
      if (!ENTRY.test(String(entryId))) return null;
      const entry = shelf(person).find((one) => one.entry === entryId);
      const file = entry === void 0 ? void 0 : state.files[entry.file];
      if (file?.state !== "ready" || !file.name) return null;
      state.files[entry.file] = { ...file, usedAt: now() };
      save();
      return { path: join4(dir, "files", entry.file, file.name), name: file.name, type: BOOK_TYPES[entry.format] ?? "application/octet-stream" };
    },
    async dispose() {
      disposed = true;
      waiting.length = 0;
      for (const controller of running.values()) controller.abort();
      await saving;
    }
  };
}

// src/covers.js
import { createHash as createHash3 } from "node:crypto";
import { mkdir as mkdir3, open, readdir as readdir2, rename as rename2, rm as rm3, stat as stat4, utimes } from "node:fs/promises";
import { join as join5 } from "node:path";
var KEY = /^[0-9a-f]{32}$/;
var FAILED_FOR_MS = 5 * 6e4;
var MAX_REMEMBERED = 5e3;
function imageType(head) {
  if (head.length >= 3 && head[0] === 255 && head[1] === 216 && head[2] === 255) return "image/jpeg";
  if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (head.length >= 4 && head.subarray(0, 4).toString("latin1") === "GIF8") return "image/gif";
  if (head.length >= 12 && head.subarray(0, 4).toString("latin1") === "RIFF" && head.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}
var coverKey = (sourceId, url) => createHash3("sha256").update(`${sourceId}
${url}`).digest("hex").slice(0, 32);
function createCovers({ dir, capBytes = 5e7, maxFileBytes = 2e6, concurrency = 3, logger, now = Date.now }, sourceOf) {
  const known = /* @__PURE__ */ new Map();
  const inFlight = /* @__PURE__ */ new Map();
  const failed = /* @__PURE__ */ new Map();
  const waiting = [];
  let running = 0;
  const remember = (key, entry) => {
    known.delete(key);
    known.set(key, entry);
    if (known.size > MAX_REMEMBERED) known.delete(known.keys().next().value);
  };
  const pump = () => {
    while (running < concurrency && waiting.length > 0) {
      running += 1;
      waiting.shift()().finally(() => {
        running -= 1;
        pump();
      });
    }
  };
  const queued = (job) => new Promise((resolve7, reject) => {
    waiting.push(() => job().then(resolve7, reject));
    pump();
  });
  async function trim() {
    if (!(capBytes > 0)) return;
    const files = [];
    for (const name2 of await readdir2(dir).catch(() => [])) {
      if (!name2.endsWith(".img")) continue;
      const info = await stat4(join5(dir, name2)).catch(() => null);
      if (info !== null) files.push({ name: name2, size: info.size, used: info.mtimeMs });
    }
    let total = files.reduce((sum, file) => sum + file.size, 0);
    for (const file of files.sort((a, b) => a.used - b.used)) {
      if (total <= capBytes) break;
      await rm3(join5(dir, file.name), { force: true });
      total -= file.size;
    }
  }
  async function fetchOne(key, { sourceId, url }) {
    const source = sourceOf(sourceId);
    if (typeof source?.cover !== "function") return false;
    await mkdir3(dir, { recursive: true });
    const partial = join5(dir, `.${key}.part`);
    try {
      await source.cover(url, partial);
      const info = await stat4(partial);
      if (info.size === 0 || info.size > maxFileBytes) throw new Error(`the picture is ${info.size} bytes`);
      const handle = await open(partial, "r");
      const head = Buffer.alloc(12);
      try {
        await handle.read(head, 0, 12, 0);
      } finally {
        await handle.close();
      }
      if (imageType(head) === null) throw new Error("the file is not a picture a browser shows");
      await rename2(partial, join5(dir, `${key}.img`));
      await trim();
      return true;
    } catch (error) {
      logger.warn("cover %s from %s: %s", key, sourceId, error.message);
      return false;
    } finally {
      await rm3(partial, { force: true });
    }
  }
  return {
    /** The route a result's cover is served under; the URL itself stays here. */
    register(sourceId, url) {
      if (typeof url !== "string" || url === "") return null;
      const key = coverKey(sourceId, url);
      remember(key, { sourceId, url });
      return `covers/${key}`;
    },
    /**
     * The cached picture for a key (fetching it first when needed), or null.
     * @returns {Promise<{ file: string, type: string } | null>}
     */
    async file(key) {
      if (!KEY.test(key)) return null;
      const file = join5(dir, `${key}.img`);
      const cached = async () => {
        const handle = await open(file, "r").catch(() => null);
        if (handle === null) return null;
        try {
          const head = Buffer.alloc(12);
          await handle.read(head, 0, 12, 0);
          const type = imageType(head);
          if (type === null) return null;
          const time = new Date(now());
          await utimes(file, time, time).catch(() => {
          });
          return { file, type };
        } finally {
          await handle.close();
        }
      };
      const have = await cached();
      if (have !== null) return have;
      const entry = known.get(key);
      if (entry === void 0 || (failed.get(key) ?? 0) > now()) return null;
      if (!inFlight.has(key)) {
        inFlight.set(key, queued(() => fetchOne(key, entry)).finally(() => inFlight.delete(key)));
      }
      if (!await inFlight.get(key)) {
        failed.set(key, now() + FAILED_FOR_MS);
        return null;
      }
      return cached();
    },
    /** Replace each result's cover URL (and those of its related works) with a route. */
    decorate(sourceId, work) {
      const covered = { ...work, cover: this.register(sourceId, work.cover) };
      if (Array.isArray(work.related)) covered.related = work.related.map((other) => this.decorate(sourceId, other));
      return covered;
    }
  };
}

// src/downloads.js
import { readFile as readFile3, rename as rename3, writeFile as writeFile2 } from "node:fs/promises";
import { join as join6 } from "node:path";
var ACTIVE = /* @__PURE__ */ new Set(["queued", "running"]);
var sourceError2 = (code, message) => Object.assign(new Error(message), { code });
function createDownloads({ stateDir, sources, have, hasSpace = async () => true, onFiles, logger, now = Date.now }) {
  const file = join6(stateDir, "downloads.json");
  const jobs = /* @__PURE__ */ new Map();
  let running = null;
  let disposed = false;
  let saving = Promise.resolve();
  let notifying = Promise.resolve();
  function save() {
    const body2 = JSON.stringify({ jobs: [...jobs.values()].map(({ controller, current, at, ...job }) => job) }, null, 1);
    saving = saving.then(async () => {
      await writeFile2(`${file}.part`, body2);
      await rename3(`${file}.part`, file);
    }).catch((error) => logger.warn("could not save downloads: %s", error.message));
    return saving;
  }
  function notify(job) {
    notifying = notifying.then(() => onFiles(job)).catch((error) => logger.warn("after a download step: %s", error.message));
    return notifying;
  }
  function next() {
    const queued = [...jobs.values()].filter((job) => job.status === "queued");
    queued.sort((a, b) => Number(b.priority) - Number(a.priority) || a.createdAt - b.createdAt);
    return queued[0];
  }
  function pump() {
    if (disposed) return;
    const candidate = next();
    if (candidate === void 0) return;
    if (running !== null) {
      if (candidate.priority && !running.priority) running.controller.abort("yield");
      return;
    }
    run4(candidate);
  }
  async function run4(job) {
    const source = sources.get(job.source);
    running = job;
    job.status = "running";
    job.error = null;
    job.failed = [];
    job.controller = new AbortController();
    const { signal } = job.controller;
    save();
    try {
      if (source === void 0) throw sourceError2("unavailable", `source ${job.source} is not available`);
      for (; ; ) {
        const range = nextRun(job.want, await have(job.dir));
        if (range === null || signal.aborted) break;
        if (!await hasSpace()) throw sourceError2("no_space", "the library disk is almost full; delete something first");
        job.current = range;
        job.at = range[0];
        const result = await source.download({ id: job.id, dir: job.dir, from: range[0], to: range[1], signal, onStart: (n) => {
          job.at = n;
        }, onEpisode: () => notify(job) });
        await notify(job);
        if (signal.aborted) break;
        if (result.failed.length > 0) {
          job.failed = result.failed;
          throw sourceError2("source_failed", `${result.failed.length} episodes could not be downloaded`);
        }
      }
      if (signal.aborted) {
        if (signal.reason === "yield") job.status = "queued";
      } else {
        job.status = "done";
      }
    } catch (error) {
      logger.warn("download of %s failed: %s", job.title, error.message);
      job.status = "failed";
      job.error = error.message;
    } finally {
      delete job.controller;
      delete job.current;
      delete job.at;
      running = null;
      if (job.status === "done") jobs.delete(job.dir);
      save();
      if (job.status === "failed") await notify(job);
      pump();
    }
  }
  return {
    async load() {
      let data = { jobs: [] };
      try {
        data = JSON.parse(await readFile3(file, "utf8"));
      } catch (error) {
        if (error.code !== "ENOENT") logger.warn("could not read %s: %s", file, error.message);
      }
      for (const job of data.jobs ?? []) if (Array.isArray(job.want)) jobs.set(job.dir, { ...job, status: job.status === "running" ? "queued" : job.status });
      pump();
    },
    /**
     * Say which episodes of a show to have on disk, in the order to fetch
     * them (replacing any earlier list). A job that failed stays failed
     * unless `retry` is set: someone asked for an episode again.
     * @param {{ source: string, item: { id: string, title: string, kind: string, episodes: number | null }, dir: string }} show
     * @param {number[]} want
     * @param {{ priority?: boolean, retry?: boolean }} [options] - priority: a room is open on this show
     */
    async want({ source, item, dir }, want, { priority = false, retry = false } = {}) {
      let job = jobs.get(dir);
      if (job === void 0) {
        if (want.length === 0) return null;
        job = { dir, source, id: item.id, title: item.title, kind: item.kind, episodes: item.episodes ?? null, status: "queued", error: null, failed: [], priority, want, createdAt: now() };
        jobs.set(dir, job);
      }
      job.want = want;
      job.priority = priority;
      const onDisk = await have(dir);
      const first = want.find((n) => !onDisk.has(n));
      if (first === void 0) {
        if (running === job) job.controller.abort("yield");
        else if (!ACTIVE.has(job.status) || job.status === "failed") jobs.delete(dir);
        save();
        return null;
      }
      if (job.status === "failed" && retry) {
        job.status = "queued";
        job.error = null;
      }
      if (running === job) {
        const [from2, to] = job.current ?? [0, -1];
        if (!(first >= (job.at ?? from2) && first <= to)) job.controller.abort("yield");
      }
      save();
      pump();
      return job;
    },
    /** What is happening to a show folder, or null when nothing is. */
    state(dir) {
      const job = jobs.get(dir);
      if (job === void 0) return null;
      return { status: job.status, active: ACTIVE.has(job.status), total: job.episodes, error: job.error, failed: job.failed.length, source: job.source, wanted: job.want.length };
    },
    job: (dir) => jobs.get(dir),
    /** Start a failed job again. */
    retry(dir) {
      const job = jobs.get(dir);
      if (job === void 0) return null;
      if (job.status === "failed") {
        job.status = "queued";
        job.error = null;
      }
      save();
      pump();
      return job;
    },
    /** Stop and forget a show's download. */
    async cancel(dir) {
      const job = jobs.get(dir);
      if (job === void 0) return;
      jobs.delete(dir);
      job.controller?.abort("cancel");
      save();
      while (running === job) await new Promise((done) => setTimeout(done, 50));
    },
    async dispose() {
      disposed = true;
      running?.controller?.abort("stop");
      while (running !== null) await new Promise((done) => setTimeout(done, 50));
      await saving;
    }
  };
}

// src/hub.js
import { randomBytes } from "node:crypto";
import { mkdir as mkdir5, readFile as readFile5, rename as rename5, writeFile as writeFile4 } from "node:fs/promises";
import { isAbsolute as isAbsolute3, join as join9, resolve as resolve3 } from "node:path";

// src/sync.js
var DRIFT = Object.freeze({
  /** Below this the players count as together. */
  ignore: 0.3,
  /** Above this a player jumps instead of catching up by rate. */
  seek: 2,
  /** A player already catching up by rate keeps at it until this close. */
  settle: 0.1,
  /** Rate change while catching up, as a fraction of the room's rate. */
  nudge: 0.05,
  /** For players without fine rate control: seek once drift passes this. */
  coarseSeek: 1
});
function expectedPosition(state, serverNow) {
  let position = state.position;
  if (state.playing) position += Math.max(0, serverNow - state.updatedAt) / 1e3 * state.rate;
  if (typeof state.duration === "number" && state.duration > 0) position = Math.min(position, state.duration);
  return Math.max(0, position);
}

// src/room.js
var SKIP_AFTER_MS = 1e4;
var STALL_COOLDOWN_MS = 3e4;
var STALL_REARM_MS = 3e3;
var STALL_BACK_S = 10;
var START_LEAD = Object.freeze({ extra: 250, min: 300, max: 2e3 });
var RATE_LIMITS = Object.freeze({ min: 0.25, max: 2 });
var OPS = Object.freeze(["play", "pause", "seek", "rate", "select", "ended", "stall", "ready", "skip", "duration", "nextready"]);
function createRoom({ id, title, source, items, createdBy, now }) {
  const room = {
    id,
    title,
    source,
    items,
    index: 0,
    playing: false,
    position: 0,
    rate: 1,
    updatedAt: now,
    createdAt: now,
    createdBy,
    seq: 0,
    last: null,
    gate: null,
    gates: 0,
    startedAt: null,
    cooldown: {},
    nextReady: null
  };
  return openGate(room, "load", now);
}
function clockOf(room) {
  return {
    playing: room.playing && room.gate === null,
    position: room.position,
    rate: room.rate,
    updatedAt: room.updatedAt,
    duration: room.items[room.index]?.duration ?? null
  };
}
function advanceOf(room, present) {
  const ids = [...present];
  const duration = room.items[room.index]?.duration;
  if (!room.playing || room.gate !== null || room.nextReady?.from !== room.index || ids.length === 0) return null;
  if (!(duration > 0) || room.index + 1 >= room.items.length || room.items[room.index + 1].status !== "ready") return null;
  if (!ids.every((id) => room.nextReady.ready.includes(id))) return null;
  const left = Math.max(0, duration - room.position);
  return { at: Math.round(room.updatedAt + left * 1e3 / room.rate), to: room.index + 1 };
}
function advance(room, to, at) {
  const seq = room.seq + 1;
  return { ...room, index: to, position: 0, updatedAt: at, startedAt: at, gate: null, nextReady: null, seq, last: { seq, by: "", clientId: null, op: "advance", index: to, position: 0, rate: room.rate, at } };
}
function positionAt(room, now) {
  return expectedPosition(clockOf(room), now);
}
function rebase(room, now) {
  return { ...room, position: positionAt(room, now), updatedAt: Math.max(now, room.updatedAt) };
}
function openGate(room, reason, now, ready = [], by = null) {
  const atNow = rebase(room, now);
  const id = (room.gates ?? 0) + 1;
  return { ...atNow, gates: id, gate: { id, reason, since: now, ready, skipped: [], by, rtt: 0 } };
}
function waitingFor(room, present) {
  const gate = room.gate;
  if (gate === null) return [];
  return [...present.keys()].filter((clientId) => !gate.ready.includes(clientId) && !gate.skipped.includes(clientId));
}
function settleGate(room, present, now) {
  if (room.gate === null || present.size === 0 || room.items[room.index]?.status !== "ready") return room;
  if (waitingFor(room, present).length > 0) return room;
  const lead = Math.min(START_LEAD.max, Math.max(START_LEAD.min, room.gate.rtt + START_LEAD.extra));
  if (!room.playing) return { ...room, gate: null };
  const startsAt = now + lead;
  return { ...room, gate: null, updatedAt: startsAt, startedAt: startsAt };
}
function settle(room, present, now) {
  const next = settleGate(room, present, now);
  if (next === room) return { room, changed: false };
  return { room: { ...next, seq: room.seq + 1 }, changed: true };
}
function hold(room, now) {
  if (room.gate !== null) return room;
  return { ...openGate(room, "load", now), seq: room.seq + 1 };
}
var finite = (value) => typeof value === "number" && Number.isFinite(value);
function applyOp(room, op, { by, clientId, now, present }) {
  const unchanged = (error) => ({ room, changed: false, announce: false, ...error ? { error } : {} });
  const done = (changed, announce = true, extra2 = {}) => {
    const next = settleGate(changed, present, now);
    const seq = room.seq + 1;
    const last = announce ? { seq, by, clientId, op: op.op, index: next.index, position: next.position, rate: next.rate, at: now, ...extra2 } : room.last;
    return { room: { ...next, seq, last }, changed: true, announce };
  };
  const atNow = rebase(room, now);
  const duration = room.items[room.index]?.duration ?? null;
  const clamp = (position) => Math.max(0, duration ? Math.min(position, duration) : position);
  const gate = room.gate;
  switch (op.op) {
    case "play":
      if (room.playing) return unchanged();
      return done({ ...atNow, playing: true, position: finite(op.position) && gate === null ? clamp(op.position) : atNow.position, gate: gate && { ...gate, since: now } });
    case "pause":
      if (!room.playing) return unchanged();
      return done({ ...atNow, playing: false, position: finite(op.position) && gate === null ? clamp(op.position) : atNow.position });
    case "seek":
      if (!finite(op.position)) return unchanged("seek needs a position");
      return done(openGate({ ...atNow, position: clamp(op.position) }, gate?.reason === "load" ? "load" : "seek", now));
    case "rate": {
      if (!finite(op.rate)) return unchanged("rate needs a rate");
      const rate = Math.min(RATE_LIMITS.max, Math.max(RATE_LIMITS.min, op.rate));
      if (rate === room.rate) return unchanged();
      return done({ ...atNow, rate });
    }
    case "select": {
      if (!Number.isInteger(op.index) || op.index < 0 || op.index >= room.items.length) return unchanged("no such item");
      if (Number.isInteger(op.from) && op.from !== room.index) return unchanged();
      return done(openGate({ ...atNow, index: op.index, position: 0, nextReady: null }, "load", now));
    }
    case "ended": {
      if (!Number.isInteger(op.from) || op.from !== room.index) return unchanged();
      if (advanceOf(room, present.keys()) !== null) return unchanged();
      if (room.index + 1 < room.items.length) return done(openGate({ ...atNow, index: room.index + 1, position: 0, nextReady: null }, "load", now));
      if (!room.playing) return unchanged();
      return done({ ...atNow, playing: false }, false);
    }
    case "stall": {
      if (!room.playing || gate !== null || (room.cooldown[clientId] ?? 0) > now) return unchanged();
      if (room.startedAt !== null && now < room.startedAt + STALL_REARM_MS) return unchanged();
      const at = finite(op.position) ? Math.min(atNow.position, Math.max(atNow.position - STALL_BACK_S, clamp(op.position))) : atNow.position;
      const others = [...present.keys()].filter((id) => id !== clientId);
      return done(openGate({ ...atNow, position: at }, "stall", now, others, clientId), false);
    }
    case "ready": {
      if (gate === null || op.gate !== gate.id || gate.ready.includes(clientId)) return unchanged();
      if (room.items[room.index]?.status !== "ready") return unchanged();
      const rtt = finite(op.rtt) ? Math.min(START_LEAD.max, Math.max(0, op.rtt)) : 0;
      return done({ ...room, gate: { ...gate, ready: [...gate.ready, clientId], rtt: Math.max(gate.rtt, rtt) } }, false);
    }
    case "skip": {
      if (gate === null || op.gate !== gate.id) return unchanged();
      if (now - gate.since < SKIP_AFTER_MS) return unchanged("too early to start without them");
      const left = waitingFor(room, present).filter((id) => id !== clientId);
      if (left.length === 0) return unchanged();
      const cooldown = Object.fromEntries(Object.entries(room.cooldown).filter(([, until]) => until > now));
      for (const id of left) cooldown[id] = now + STALL_COOLDOWN_MS;
      const next = { ...room, cooldown, gate: { ...gate, skipped: [...gate.skipped, ...left] } };
      return done(next, true, { skipped: left.map((id) => present.get(id)) });
    }
    case "nextready": {
      if (op.from !== room.index || room.index + 1 >= room.items.length) return unchanged();
      const ready = room.nextReady?.from === room.index ? room.nextReady.ready : [];
      if (ready.includes(clientId)) return unchanged();
      return done({ ...room, nextReady: { from: room.index, ready: [...ready, clientId] } }, false);
    }
    case "duration": {
      if (!finite(op.duration) || op.duration <= 0 || op.index !== room.index) return unchanged();
      if (room.items[room.index].duration === op.duration) return unchanged();
      const items = room.items.map((item, i) => i === room.index ? { ...item, duration: op.duration } : item);
      return done({ ...room, items }, false);
    }
    default:
      return unchanged(`unknown op ${String(op.op)}`);
  }
}
function updateItems(room, items) {
  return { ...room, items, seq: room.seq + 1 };
}

// src/library.js
import { open as open2, readdir as readdir3, stat as stat5 } from "node:fs/promises";
import { basename as basename3, dirname as dirname2, extname as extname3, join as join7 } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
var run2 = promisify(execFile);
var VIDEO_EXTENSIONS = Object.freeze([".mp4", ".m4v", ".mov", ".webm", ".mkv", ".ts", ".avi", ".flv", ".m3u8"]);
var AUDIO_EXTENSIONS = Object.freeze([".m4a", ".mp3", ".aac"]);
var SUBTITLE_EXTENSIONS = Object.freeze([".vtt", ".srt", ".ass", ".ssa"]);
var BROWSER_VIDEO = /* @__PURE__ */ new Set(["h264", "vp8", "vp9", "av1"]);
var BROWSER_AUDIO = /* @__PURE__ */ new Set(["aac", "mp3", "opus", "vorbis"]);
var DIRECT_CONTAINERS = /* @__PURE__ */ new Set([".mp4", ".m4v", ".mov", ".webm"]);
var collator = new Intl.Collator(void 0, { numeric: true, sensitivity: "base" });
var extOf = (name2) => extname3(name2).toLowerCase();
var isVideo = (name2) => VIDEO_EXTENSIONS.includes(extOf(name2));
var isAudio = (name2) => AUDIO_EXTENSIONS.includes(extOf(name2));
var isMedia = (name2) => !name2.startsWith(".") && (isVideo(name2) || isAudio(name2));
var isSubtitle = (name2) => SUBTITLE_EXTENSIONS.includes(extOf(name2));
function naturalSort(names) {
  return [...names].sort(collator.compare);
}
function matchSubtitles(video, names) {
  const stem = basename3(video, extname3(video));
  const found = [];
  for (const name2 of naturalSort(names)) {
    if (!isSubtitle(name2)) continue;
    const subStem = basename3(name2, extname3(name2));
    if (subStem === stem) found.push({ name: name2, label: "" });
    else if (subStem.startsWith(`${stem}.`)) found.push({ name: name2, label: subStem.slice(stem.length + 1) });
  }
  return found;
}
var titleOf = (file) => basename3(file, extname3(file));
async function scanSource(path) {
  const info = await stat5(path);
  const folder = info.isDirectory() ? path : dirname2(path);
  const names = await readdir3(folder);
  const videos = info.isDirectory() ? naturalSort(names.filter(isMedia)) : [basename3(path)];
  if (videos.length === 0) throw Object.assign(new Error(`no video or audio files in ${path}`), { code: "empty" });
  return videos.map((name2) => ({
    title: titleOf(name2),
    path: join7(folder, name2),
    subtitles: matchSubtitles(name2, names).map((sub) => ({ path: join7(folder, sub.name), label: sub.label }))
  }));
}
async function probe(path, { ffprobe = "ffprobe" } = {}) {
  const { stdout } = await run2(ffprobe, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", path], { maxBuffer: 8 * 1024 * 1024 });
  const data = JSON.parse(stdout);
  const streams = data.streams ?? [];
  const video = streams.find((s) => s.codec_type === "video" && s.disposition?.attached_pic !== 1);
  const audio = streams.find((s) => s.codec_type === "audio");
  const duration = Number.parseFloat(data.format?.duration);
  return {
    duration: Number.isFinite(duration) ? duration : null,
    video: video?.codec_name ?? null,
    audio: audio?.codec_name ?? null,
    height: video?.height ?? null,
    subtitles: streams.filter((s) => s.codec_type === "subtitle").map((s, n) => ({ index: n, codec: s.codec_name, language: s.tags?.language ?? "", title: s.tags?.title ?? "" }))
  };
}
var TEXT_SUBTITLES = /* @__PURE__ */ new Set(["subrip", "ass", "ssa", "webvtt", "mov_text", "text"]);
var isTextSubtitle = (codec) => TEXT_SUBTITLES.has(codec);
async function isFastStart(path) {
  const handle = await open2(path, "r");
  try {
    const header = Buffer.alloc(16);
    let offset = 0;
    const { size } = await handle.stat();
    while (offset + 8 <= size) {
      const { bytesRead } = await handle.read(header, 0, 16, offset);
      if (bytesRead < 8) return false;
      let length = header.readUInt32BE(0);
      const type = header.toString("latin1", 4, 8);
      if (type === "moov") return true;
      if (type === "mdat") return false;
      if (length === 1) length = Number(header.readBigUInt64BE(8));
      else if (length === 0) return false;
      if (length < 8) return false;
      offset += length;
    }
    return false;
  } finally {
    await handle.close();
  }
}
function planVideo(path, info, { fastStart, maxHeight }) {
  const ext = extOf(path);
  if (ext === ".m3u8") return "direct";
  if (info.video === null && info.audio !== null) {
    if (!BROWSER_AUDIO.has(info.audio)) return "transcode";
    if (ext === ".mp3" || ext === ".aac") return "direct";
    return fastStart ? "direct" : "remux";
  }
  const videoOk = info.video !== null && BROWSER_VIDEO.has(info.video);
  const audioOk = info.audio === null || BROWSER_AUDIO.has(info.audio);
  if (!videoOk || !audioOk || (info.height ?? 0) > maxHeight) return "transcode";
  if (ext === ".webm") return "direct";
  if (!DIRECT_CONTAINERS.has(ext)) return info.video === "h264" ? "remux" : "transcode";
  if (info.video !== "h264" && info.video !== "av1" && info.video !== "vp9") return "transcode";
  return fastStart ? "direct" : "remux";
}

// src/prepare.js
import { spawn as spawn3 } from "node:child_process";
import { createHash as createHash4 } from "node:crypto";
import { mkdir as mkdir4, readFile as readFile4, readdir as readdir4, rename as rename4, rm as rm4, stat as stat6, writeFile as writeFile3 } from "node:fs/promises";
import { extname as extname4, join as join8 } from "node:path";

// src/subtitles.js
var LEGACY_ENCODINGS = Object.freeze(["gb18030", "big5", "shift_jis", "euc-kr"]);
function decodeText(bytes) {
  if (bytes[0] === 255 && bytes[1] === 254) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes[0] === 254 && bytes[1] === 255) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  for (const encoding of ["utf-8", ...LEGACY_ENCODINGS]) {
    try {
      return new TextDecoder(encoding, { fatal: true, ignoreBOM: false }).decode(bytes);
    } catch {
    }
  }
  return new TextDecoder("utf-8").decode(bytes);
}
var SRT_TIME = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/g;
function srtToVtt(srt) {
  const body2 = srt.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split(/\n{2,}/).map((block) => block.trim()).filter(Boolean).map((block) => {
    const lines = block.split("\n");
    const timing = lines.findIndex((line) => line.includes("-->"));
    if (timing < 0) return null;
    const time = lines[timing].replace(SRT_TIME, (_, h, m, s, ms) => `${h.padStart(2, "0")}:${m}:${s}.${ms.padEnd(3, "0")}`);
    return [time, ...lines.slice(timing + 1)].join("\n");
  }).filter(Boolean).join("\n\n");
  return `WEBVTT

${body2}
`;
}
var isVtt = (text2) => /^\uFEFF?WEBVTT/.test(text2);

// src/prepare.js
async function cacheKey(path) {
  const info = await stat6(path);
  return createHash4("sha256").update(`${path}\0${info.size}\0${info.mtimeMs}`).digest("hex").slice(0, 20);
}
async function preparedBytes(cacheDir, path) {
  const key = await cacheKey(path).catch(() => null);
  if (key === null) return 0;
  let total = 0;
  for (const name2 of await readdir4(join8(cacheDir, key)).catch(() => [])) total += (await stat6(join8(cacheDir, key, name2)).catch(() => null))?.size ?? 0;
  return total;
}
async function dropPrepared(cacheDir, path) {
  const key = await cacheKey(path).catch(() => null);
  if (key !== null) await rm4(join8(cacheDir, key), { recursive: true, force: true });
}
function createQueue() {
  let tail = Promise.resolve();
  return (job) => {
    const result = tail.then(job, job);
    tail = result.catch(() => {
    });
    return result;
  };
}
function runFfmpeg(args, { ffmpeg, duration, onProgress, signal }) {
  return new Promise((resolve7, reject) => {
    const child = spawn3("nice", ["-n", "10", ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-progress", "pipe:1", ...args], { stdio: ["ignore", "pipe", "pipe"], signal });
    let errors = "";
    child.stderr.on("data", (chunk) => {
      errors = (errors + chunk).slice(-4e3);
    });
    child.stdout.on("data", (chunk) => {
      const match = /out_time_us=(\d+)/.exec(String(chunk));
      if (match && duration && onProgress) onProgress(Math.min(1, Number(match[1]) / 1e6 / duration));
    });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve7() : reject(new Error(`ffmpeg exited with ${code}: ${errors.trim().split("\n").pop() ?? ""}`)));
  });
}
function videoArgs(plan, input, output, { maxHeight = 1080, threads = 2 } = {}) {
  const common = ["-y", "-i", input, "-map", "0:V:0?", "-map", "0:a:0?", "-sn", "-dn"];
  const tail = ["-movflags", "+faststart", "-f", "mp4", output];
  if (plan === "remux") return [...common, "-c", "copy", ...tail];
  return [
    ...common,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "22",
    "-pix_fmt",
    "yuv420p",
    "-vf",
    `scale=-2:'min(ih,${maxHeight})'`,
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-ac",
    "2",
    "-threads",
    String(threads),
    ...tail
  ];
}
async function writeAtomic(path, data) {
  await writeFile3(`${path}.part`, data);
  await rename4(`${path}.part`, path);
}
var exists = (path) => stat6(path).then(() => true, () => false);
async function convertSubtitle(source, dir, name2, { ffmpeg = "ffmpeg" } = {}) {
  const out = join8(dir, `${name2}.vtt`);
  if (await exists(out)) return out;
  const text2 = decodeText(await readFile4(source));
  const ext = extname4(source).toLowerCase();
  if (ext === ".srt") await writeAtomic(out, srtToVtt(text2));
  else if (ext === ".vtt" || isVtt(text2)) await writeAtomic(out, text2);
  else {
    const utf8 = join8(dir, `${name2}.utf8${ext}`);
    await writeFile3(utf8, text2);
    try {
      await runFfmpeg(["-y", "-i", utf8, "-f", "webvtt", `${out}.part`], { ffmpeg, duration: null });
      await rename4(`${out}.part`, out);
    } finally {
      await rm4(utf8, { force: true });
    }
  }
  return out;
}
async function prepareEpisode(episode, options) {
  const { cacheDir, ffmpeg = "ffmpeg", ffprobe = "ffprobe", maxHeight = 1080, threads = 2, onProgress } = options;
  if (extname4(episode.path).toLowerCase() === ".m3u8") {
    return { file: episode.path, kind: "hls", duration: null, plan: "direct", subtitles: await externalSubtitles(episode, null, ffmpeg, cacheDir) };
  }
  const dir = join8(cacheDir, await cacheKey(episode.path));
  await mkdir4(dir, { recursive: true });
  const info = await probe(episode.path, { ffprobe });
  const mp4Family = [".mp4", ".m4v", ".mov", ".m4a"].includes(extname4(episode.path).toLowerCase());
  const plan = planVideo(episode.path, info, { fastStart: mp4Family ? await isFastStart(episode.path) : null, maxHeight });
  let file = episode.path;
  if (plan !== "direct") {
    file = join8(dir, "video.mp4");
    if (!await exists(file)) {
      await runFfmpeg(videoArgs(plan, episode.path, `${file}.part`, { maxHeight, threads }), { ffmpeg, duration: info.duration, onProgress });
      await rename4(`${file}.part`, file);
    }
  }
  const subtitles = await externalSubtitles(episode, dir, ffmpeg, cacheDir);
  for (const stream of info.subtitles.filter((s) => isTextSubtitle(s.codec))) {
    const out = join8(dir, `embedded-${stream.index}.vtt`);
    if (!await exists(out)) {
      try {
        await runFfmpeg(["-y", "-i", episode.path, "-map", `0:s:${stream.index}`, "-f", "webvtt", `${out}.part`], { ffmpeg, duration: null });
        await rename4(`${out}.part`, out);
      } catch {
        continue;
      }
    }
    subtitles.push({ file: out, label: stream.title || stream.language || `Track ${stream.index + 1}` });
  }
  return { file, kind: "file", duration: info.duration, plan, subtitles };
}
async function externalSubtitles(episode, dir, ffmpeg, cacheDir) {
  if (episode.subtitles.length === 0) return [];
  const target = dir ?? join8(cacheDir, await cacheKey(episode.path));
  await mkdir4(target, { recursive: true });
  const out = [];
  for (const [n, sub] of episode.subtitles.entries()) {
    try {
      out.push({ file: await convertSubtitle(sub.path, target, `external-${n}`, { ffmpeg }), label: sub.label || "Subtitles" });
    } catch {
    }
  }
  return out;
}
async function pruneCache(cacheDir, used, days, now = Date.now()) {
  const keep = new Set(used.filter((file) => typeof file === "string" && file.startsWith(`${cacheDir}/`)).map((file) => file.slice(cacheDir.length + 1).split("/")[0]));
  for (const name2 of await readdir4(cacheDir).catch(() => [])) {
    if (keep.has(name2)) continue;
    const info = await stat6(join8(cacheDir, name2)).catch(() => null);
    if (info !== null && now - info.mtimeMs > days * 864e5) await rm4(join8(cacheDir, name2), { recursive: true, force: true });
  }
}

// src/youtube-items.js
import { execFile as execFile2 } from "node:child_process";
import { promisify as promisify2 } from "node:util";

// src/youtube-url.js
var VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
var LIST_ID = /^[A-Za-z0-9_-]{10,64}$/;
var HOSTS = /* @__PURE__ */ new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtube-nocookie.com", "youtube-nocookie.com"]);
function parseYouTube(text2) {
  const value = String(text2 ?? "").trim();
  if (VIDEO_ID.test(value)) return { videoId: value, listId: null };
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (!HOSTS.has(url.hostname)) return null;
  const listParam = url.searchParams.get("list");
  const listId = listParam !== null && LIST_ID.test(listParam) ? listParam : null;
  let videoId = null;
  if (url.hostname === "youtu.be") videoId = url.pathname.slice(1).split("/")[0];
  else if (url.pathname === "/watch") videoId = url.searchParams.get("v");
  else {
    const match = /^\/(?:embed|shorts|live|v)\/([^/?#]+)/.exec(url.pathname);
    if (match) videoId = match[1];
  }
  if (videoId !== null && !VIDEO_ID.test(videoId)) videoId = null;
  if (videoId === null && listId === null) return null;
  return { videoId, listId: videoId === null ? listId : null };
}

// src/youtube-items.js
var run3 = promisify2(execFile2);
var serviceError = (code, message) => Object.assign(new Error(message), { code });
async function youtubeItems(urls, { ytDlp, fetchTitle = youtubeTitle }) {
  const list = (Array.isArray(urls) ? urls : [urls]).filter((url) => typeof url === "string" && url.trim() !== "");
  if (list.length === 0) throw serviceError("invalid", "give at least one YouTube URL");
  const items = [];
  for (const url of list) {
    const parsed = parseYouTube(url);
    if (parsed === null) throw serviceError("invalid", `not a YouTube video or playlist URL: ${url}`);
    if (parsed.videoId === null) {
      for (const entry of await playlistEntries(parsed.listId, ytDlp)) items.push({ title: entry.title, kind: "youtube", status: "ready", videoId: entry.id });
    } else {
      items.push({ title: await fetchTitle(parsed.videoId) ?? `YouTube ${parsed.videoId}`, kind: "youtube", status: "ready", videoId: parsed.videoId });
    }
  }
  return items;
}
async function playlistEntries(listId, ytDlp) {
  let stdout;
  try {
    ({ stdout } = await run3(ytDlp, ["--flat-playlist", "-J", "--no-warnings", `https://www.youtube.com/playlist?list=${listId}`], { maxBuffer: 32 * 1024 * 1024, timeout: 6e4 }));
  } catch (error) {
    throw serviceError("invalid", `could not read the playlist (${error.code === "ENOENT" ? "yt-dlp is not installed" : error.message.split("\n")[0]})`);
  }
  const entries = (JSON.parse(stdout).entries ?? []).filter((entry) => typeof entry.id === "string");
  if (entries.length === 0) throw serviceError("empty", "the playlist has no videos");
  return entries.map((entry) => ({ id: entry.id, title: entry.title ?? `YouTube ${entry.id}` }));
}
async function youtubeTitle(videoId) {
  try {
    const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5e3), headers: { "user-agent": "dsh-media-hub" } });
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data.title === "string" ? data.title : null;
  } catch {
    return null;
  }
}

// src/hub.js
var PING_MS = 2e4;
var SAVE_DELAY_MS = 1e3;
var SWEEP_MS = 6e4;
var PROGRESS_MS = 12e4;
var MAX_NAME = 40;
var localItem = (episode) => ({ title: episode.title, kind: "file", status: "preparing", sourcePath: episode.path, sourceSubtitles: episode.subtitles });
var slotItem = (entry, status) => ({ title: entry.title, kind: "file", slot: entry.n, status: entry.path === null ? status : "preparing", sourcePath: entry.path, sourceSubtitles: [] });
var itemKey = (item) => item.slot ?? item.sourcePath;
var serviceError2 = (code, message) => Object.assign(new Error(message), { code });
var cleanText = (value, max) => typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max) : "";
function createRoomService(options) {
  const { stateDir, libraryRoots, delivery, tools, lifetime, logger, now = Date.now } = options;
  const observe = (type, detail) => {
    try {
      options.observe?.(type, detail);
    } catch (error) {
      logger.warn("watch log: %s", error.message);
    }
  };
  const fetchTitle = options.fetchTitle ?? youtubeTitle;
  const cacheDir = join9(stateDir, "cache");
  const file = join9(stateDir, "rooms.json");
  const rooms = /* @__PURE__ */ new Map();
  const peers = /* @__PURE__ */ new Map();
  const waiters = /* @__PURE__ */ new Map();
  const queue = createQueue();
  let saveTimer = null;
  let disposed = false;
  const sweepTimer = setInterval(() => sweep(), SWEEP_MS);
  const progressTimer = setInterval(() => progress(), PROGRESS_MS);
  async function load() {
    await mkdir5(stateDir, { recursive: true });
    for (const root of libraryRoots) await mkdir5(root, { recursive: true }).catch(() => {
    });
    let data = { rooms: [] };
    try {
      data = JSON.parse(await readFile5(file, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") logger.warn("could not read %s: %s", file, error.message);
    }
    for (const { holds, ...room } of data.rooms ?? []) rooms.set(room.id, { ...hold({ gate: null, gates: 0, startedAt: null, ...room }, now()), cooldown: {}, nextReady: null, emptySince: room.emptySince ?? (room.opened ? now() : null) });
    sweep();
    for (const room of rooms.values()) {
      room.items.forEach((item, index) => {
        if (item.status === "preparing") schedulePrepare(room.id, index);
      });
    }
    for (const path of new Set([...rooms.values()].map((room) => room.showPath).filter(Boolean))) await syncShow(path);
  }
  function save() {
    if (saveTimer !== null || disposed) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      flush().catch((error) => logger.warn("could not save rooms: %s", error.message));
    }, SAVE_DELAY_MS);
  }
  async function flush() {
    const body2 = JSON.stringify({ rooms: [...rooms.values()] }, null, 1);
    await writeFile4(`${file}.part`, body2);
    await rename5(`${file}.part`, file);
  }
  function commit(room) {
    rooms.set(room.id, { ...room, touchedAt: now() });
    broadcast(room.id);
    save();
  }
  function publicItem(room, item, index) {
    const roomId = room.id;
    const ready = item.status === "ready";
    return {
      title: item.title ?? null,
      kind: item.kind,
      status: item.status,
      cached: item.slot === void 0 || typeof item.sourcePath === "string",
      progress: item.progress ?? null,
      error: item.error ?? null,
      duration: item.duration ?? null,
      videoId: item.videoId ?? null,
      watch: options.watchOf?.(item, room.showPath) ?? null,
      src: ready && item.kind !== "youtube" ? delivery.mediaUrl(roomId, index, item) : null,
      subtitles: ready ? (item.subtitles ?? []).map((sub, n) => ({ label: sub.label, src: delivery.subtitleUrl(roomId, index, n) })) : []
    };
  }
  function publicRoom(room) {
    return {
      id: room.id,
      title: room.title,
      source: room.source,
      index: room.index,
      seq: room.seq,
      last: room.last,
      playing: room.playing,
      gate: room.gate === null ? null : { id: room.gate.id, reason: room.gate.reason, since: room.gate.since, skipAt: room.gate.since + SKIP_AFTER_MS, by: room.gate.by },
      items: room.items.map((item, index) => publicItem(room, item, index))
    };
  }
  function members(roomId) {
    const gate = rooms.get(roomId)?.gate ?? null;
    const wait = (clientId) => gate === null ? null : gate.ready.includes(clientId) ? "ready" : gate.skipped.includes(clientId) ? "skipped" : "loading";
    return [...present(roomId)].map(([clientId, name2]) => ({ clientId, name: name2, wait: wait(clientId) }));
  }
  const viewers = (roomId) => [...new Set(members(roomId).map((member) => member.name))];
  function summary(room) {
    return {
      opened: room.opened === true,
      emptySince: room.emptySince ?? null,
      id: room.id,
      title: room.title,
      source: room.source,
      show: room.showPath ?? null,
      episodes: room.items.length,
      index: room.index,
      current: room.items[room.index]?.title ?? "",
      file: room.items[room.index]?.sourcePath ?? null,
      position: positionAt(room, now()),
      duration: room.items[room.index]?.duration ?? null,
      preparing: room.items.filter((item) => item.status === "preparing").length,
      members: viewers(room.id),
      createdBy: room.createdBy,
      createdAt: room.createdAt,
      link: linkFor(room.id)
    };
  }
  function linkFor(id) {
    const root = options.webUrl?.();
    const query = `?media-room=${id}`;
    return root ? new URL(query, root).href : query;
  }
  function send(peer, message) {
    if (peer.ws.readyState === 1) peer.ws.send(JSON.stringify(message));
  }
  function stateMessage(roomId) {
    const room = rooms.get(roomId);
    return { t: "state", room: publicRoom(room), clock: { ...clockOf(room), advance: advanceOf(room, present(roomId).keys()) }, members: members(roomId), serverTime: now() };
  }
  const advanceTimers = /* @__PURE__ */ new Map();
  function scheduleAdvance(roomId) {
    const room = rooms.get(roomId);
    const due = room === void 0 ? null : advanceOf(room, present(roomId).keys());
    const timer = advanceTimers.get(roomId);
    if (due === null || timer !== void 0 && timer.at === due.at && timer.to === due.to) {
      if (due === null && timer !== void 0) {
        clearTimeout(timer.id);
        advanceTimers.delete(roomId);
      }
      return;
    }
    if (timer !== void 0) clearTimeout(timer.id);
    const id = setTimeout(() => {
      advanceTimers.delete(roomId);
      const current = rooms.get(roomId);
      const again = current === void 0 ? null : advanceOf(current, present(roomId).keys());
      if (again === null || again.to !== due.to) return;
      const after = advance(current, again.to, again.at);
      commit(after);
      observe("op", { before: current, after, op: "ended", viewers: viewers(roomId), now: now() });
    }, Math.max(0, due.at - now()));
    id.unref?.();
    advanceTimers.set(roomId, { id, at: due.at, to: due.to });
  }
  function broadcast(roomId) {
    if (!rooms.has(roomId)) return;
    scheduleAdvance(roomId);
    const message = stateMessage(roomId);
    for (const peer of peers.get(roomId) ?? []) if (peer.clientId !== null) send(peer, message);
  }
  function present(roomId) {
    const map = /* @__PURE__ */ new Map();
    for (const peer of peers.get(roomId) ?? []) if (peer.clientId !== null) map.set(peer.clientId, peer.name);
    return map;
  }
  function attach(ws, roomId) {
    if (!rooms.has(roomId)) {
      ws.close(4404, "no such room");
      return;
    }
    const peer = { ws, clientId: null, name: "Guest" };
    if (!peers.has(roomId)) peers.set(roomId, /* @__PURE__ */ new Set());
    peers.get(roomId).add(peer);
    let alive = true;
    const ping = setInterval(() => {
      if (!alive) return ws.terminate();
      alive = false;
      ws.ping();
    }, PING_MS);
    ws.on("pong", () => {
      alive = true;
    });
    ws.on("message", (data) => {
      alive = true;
      let message;
      try {
        message = JSON.parse(String(data));
      } catch {
        return send(peer, { t: "error", message: "not JSON" });
      }
      handle(peer, roomId, message);
    });
    ws.on("close", () => {
      clearInterval(ping);
      peers.get(roomId)?.delete(peer);
      let room = rooms.get(roomId);
      if (room === void 0) return;
      if (peer.clientId !== null && !viewers(roomId).includes(peer.name)) observe("left", { room, viewer: peer.name, position: positionAt(room, now()) });
      if (present(roomId).size === 0) {
        if (room.opened) commit({ ...hold(room, now()), emptySince: now() });
        return;
      }
      const result = settle(room, present(roomId), now());
      if (result.changed) commit(result.room);
      else broadcast(roomId);
    });
  }
  function handle(peer, roomId, message) {
    const room = rooms.get(roomId);
    if (room === void 0) return peer.ws.close(4404, "room closed");
    if (message.t === "ping") return send(peer, { t: "pong", id: message.id, client: message.client, server: now() });
    if (message.t === "hello") {
      const known = viewers(roomId);
      peer.clientId = cleanText(message.clientId, 64) || randomBytes(8).toString("base64url");
      peer.name = cleanText(message.name, MAX_NAME) || "Guest";
      if (!known.includes(peer.name)) observe("joined", { room, viewer: peer.name });
      rooms.set(roomId, { ...room, opened: true, emptySince: null, touchedAt: now() });
      broadcast(roomId);
      save();
      return void 0;
    }
    if (message.t !== "op" || peer.clientId === null) return send(peer, { t: "error", message: "say hello first" });
    const result = applyOp(room, message, { by: peer.name, clientId: peer.clientId, now: now(), present: present(roomId) });
    if (result.error) return send(peer, { t: "error", message: result.error });
    if (!result.changed) return void 0;
    const moved = result.room.index !== room.index && result.room.showPath !== void 0;
    const after = moved ? wanting(result.room) : result.room;
    commit(after);
    observe("op", { before: room, after, op: message.op, viewers: viewers(roomId), now: now() });
    if (moved) options.focus?.(after.showPath, { retry: after !== result.room || result.room.items[result.room.index]?.status === "failed" });
    return void 0;
  }
  function sweep() {
    for (const room of [...rooms.values()]) {
      if (present(room.id).size > 0) continue;
      const age = room.opened ? now() - (room.emptySince ?? now()) : now() - room.createdAt;
      const limit = room.opened ? lifetime.emptyMinutes * 6e4 : lifetime.unopenedHours * 36e5;
      if (age >= limit) close(room.id);
    }
  }
  function progress() {
    for (const room of rooms.values()) {
      if (room.playing && present(room.id).size > 0) observe("progress", { room, position: positionAt(room, now()), viewers: viewers(room.id) });
    }
  }
  function close(id) {
    const room = rooms.get(id);
    if (room === void 0) return false;
    observe("closed", { room, position: positionAt(room, now()), viewers: viewers(id) });
    rooms.delete(id);
    clearTimeout(advanceTimers.get(id)?.id);
    advanceTimers.delete(id);
    for (const peer of peers.get(id) ?? []) peer.ws.close(4410, "room closed");
    peers.delete(id);
    save();
    return true;
  }
  function setItem(roomId, key, patch) {
    const room = rooms.get(roomId);
    if (room === void 0) return;
    const items = room.items.map((item) => itemKey(item) === key ? { ...item, ...patch } : item);
    commit(updateItems(room, items));
    if (patch.status !== void 0 && patch.status !== "preparing") {
      for (const resolveWaiter of waiters.get(`${roomId}/${key}`) ?? []) resolveWaiter();
      waiters.delete(`${roomId}/${key}`);
    }
  }
  function wanting(room) {
    const item = room.items[room.index];
    if (item === void 0 || item.slot === void 0 || typeof item.sourcePath === "string" || item.status === "preparing") return room;
    return { ...room, items: room.items.map((entry, n) => n === room.index ? { ...entry, status: "preparing", error: null } : entry) };
  }
  function schedulePrepare(roomId, index) {
    const key = itemKey(rooms.get(roomId)?.items[index] ?? {});
    if (typeof rooms.get(roomId)?.items[index]?.sourcePath !== "string") return;
    queue(async () => {
      const item = rooms.get(roomId)?.items.find((entry) => itemKey(entry) === key);
      if (item === void 0 || disposed || typeof item.sourcePath !== "string") return;
      let last = 0;
      try {
        const prepared = await prepareEpisode({ title: item.title, path: item.sourcePath, subtitles: item.sourceSubtitles ?? [] }, {
          cacheDir,
          ffmpeg: tools.ffmpeg,
          ffprobe: tools.ffprobe,
          maxHeight: tools.maxHeight,
          threads: tools.threads,
          onProgress: (fraction) => {
            if (fraction - last < 0.05) return;
            last = fraction;
            setItem(roomId, key, { progress: Math.round(fraction * 100) / 100 });
          }
        });
        setItem(roomId, key, { status: "ready", progress: null, ...prepared });
      } catch (error) {
        logger.warn("could not prepare %s: %s", item.sourcePath, error.message);
        setItem(roomId, key, { status: "failed", progress: null, error: error.message });
      }
    });
  }
  async function localItems(path, fromPanel) {
    if (typeof path !== "string" || !isAbsolute3(path)) throw serviceError2("invalid", "path must be an absolute path");
    const target = resolve3(path);
    if (fromPanel && !libraryRoots.some((root) => target === root || target.startsWith(`${root}/`))) {
      throw serviceError2("outside", "the panel can only open files from the library folders");
    }
    const entries = await options.directory?.(target);
    if (entries) return entries.map((entry) => slotItem(entry, "remote"));
    let episodes;
    try {
      episodes = await scanSource(target);
    } catch (error) {
      if (error.code === "ENOENT") throw serviceError2("not_found", `${path} does not exist`);
      throw error;
    }
    return episodes.map(localItem);
  }
  async function syncShow(path) {
    const target = resolve3(path);
    const entries = await options.directory?.(target);
    if (!entries) return;
    for (const room of [...rooms.values()]) {
      if (room.showPath !== target) continue;
      const current = rooms.get(room.id);
      if (current === void 0) continue;
      const legacy = current.items.some((item) => item.slot === void 0);
      const before = new Map(current.items.map((item) => [legacy ? item.sourcePath : item.slot, item]));
      const fresh = [];
      const items = entries.map((entry) => {
        const prev = before.get(legacy ? entry.path : entry.n);
        if (entry.path === null) {
          const waiting = prev !== void 0 && prev.sourcePath === null && (prev.status === "preparing" || prev.status === "failed");
          return waiting ? { ...prev, title: entry.title } : slotItem(entry, "remote");
        }
        if (prev !== void 0 && prev.sourcePath === entry.path) return { ...prev, title: entry.title, slot: entry.n };
        fresh.push(entry.n);
        return slotItem(entry, "remote");
      });
      const playing = current.items[current.index];
      const index = legacy ? Math.max(0, entries.findIndex((entry) => entry.path !== null && entry.path === playing?.sourcePath)) : Math.min(current.index, items.length - 1);
      commit(wanting({ ...updateItems(current, items), index }));
      items.forEach((item, at) => {
        if (fresh.includes(item.slot)) schedulePrepare(room.id, at);
      });
    }
  }
  return {
    load,
    /**
     * Create a room.
     * @param {{ source: 'local' | 'youtube', path?: string, urls?: string[] | string, title?: string, by?: string, fromPanel?: boolean, start?: { index: number, position: number } | null }} input
     */
    async createRoom(input) {
      const source = input.source;
      if (source !== "local" && source !== "youtube") throw serviceError2("invalid", 'source must be "local" or "youtube"');
      if (source === "local" && !delivery.available) throw serviceError2("unsupported", delivery.reason);
      const items = source === "local" ? await localItems(input.path, input.fromPanel === true) : await youtubeItems(input.urls, { ytDlp: tools.ytDlp, fetchTitle });
      const id = randomBytes(9).toString("base64url");
      const title = cleanText(input.title, 120) || (items.length === 1 ? items[0].title : source === "local" ? input.path.split("/").filter(Boolean).pop() : items[0].title);
      const created = createRoom({ id, title, source, items, createdBy: cleanText(input.by, MAX_NAME), now: now() });
      const start = input.start;
      const room = {
        ...created,
        ...source === "local" ? { showPath: resolve3(input.path) } : {},
        ...Number.isInteger(start?.index) && start.index >= 0 && start.index < items.length ? { index: start.index, position: Math.max(0, Number(start.position) || 0) } : {}
      };
      commit(wanting(room));
      observe("opened", { room });
      const order = room.items.map((_, n) => (n + room.index) % room.items.length);
      for (const index of order) if (room.items[index].status === "preparing") schedulePrepare(id, index);
      if (room.showPath !== void 0) options.focus?.(room.showPath, { retry: true });
      return { room: summary(rooms.get(id)) };
    },
    /** Resolves once an item is no longer preparing, or after `timeoutMs`. */
    waitReady(roomId, index, timeoutMs) {
      const item = rooms.get(roomId)?.items[index];
      if (item === void 0 || item.status !== "preparing") return Promise.resolve();
      return new Promise((resolveWait) => {
        const key = `${roomId}/${itemKey(item)}`;
        const timer = setTimeout(resolveWait, timeoutMs);
        if (!waiters.has(key)) waiters.set(key, []);
        waiters.get(key).push(() => {
          clearTimeout(timer);
          resolveWait();
        });
      });
    },
    room(id) {
      const room = rooms.get(id);
      return room === void 0 ? void 0 : { ...summary(room), items: room.items.map((item) => ({ title: item.title, status: item.status, error: item.error ?? null })) };
    },
    listRooms() {
      const occupied = (room) => present(room.id).size > 0;
      return [...rooms.values()].sort((a, b) => Number(occupied(b)) - Number(occupied(a)) || (b.touchedAt ?? b.createdAt) - (a.touchedAt ?? a.createdAt)).map(summary);
    },
    closeRoom(id) {
      if (!close(id)) throw serviceError2("not_found", "no such room");
      return { closed: id };
    },
    sweep,
    /** Tell the viewers of rooms on a show its new watch progress. */
    refreshShow(path) {
      for (const room of rooms.values()) if (room.showPath === path) broadcast(room.id);
    },
    /** Whether an open room plays anything from `path` (a show folder or file). */
    usesPath(path) {
      const target = resolve3(path);
      return [...rooms.values()].some((room) => room.showPath === target || room.items.some((item) => typeof item.sourcePath === "string" && (item.sourcePath === target || item.sourcePath.startsWith(`${target}/`))));
    },
    /** The episode numbers rooms on a show are on, one per room; empty when no room has it open. */
    focusesOf(path) {
      const target = resolve3(path);
      return [...rooms.values()].filter((room) => room.showPath === target).map((room) => room.items[room.index]?.slot).filter((n) => n !== void 0);
    },
    syncShow,
    /** Episodes someone waits on that could not be fetched: show them as failed, so a click on one tries again. */
    failWaiting(path, message) {
      const target = resolve3(path);
      for (const room of [...rooms.values()]) {
        if (room.showPath !== target) continue;
        const items = room.items.map((item) => item.slot !== void 0 && item.sourcePath === null && item.status === "preparing" ? { ...item, status: "failed", error: message } : item);
        if (items.some((item, n) => item !== room.items[n])) commit(updateItems(rooms.get(room.id), items));
      }
    },
    /** The prepared file of a ready local item. */
    mediaFile(roomId, index) {
      const item = rooms.get(roomId)?.items[index];
      return item?.status === "ready" && item.kind !== "youtube" ? { file: item.file, kind: item.kind } : void 0;
    },
    subtitleFile(roomId, index, n) {
      const item = rooms.get(roomId)?.items[index];
      return item?.status === "ready" ? item.subtitles?.[n]?.file : void 0;
    },
    attach,
    linkFor,
    /** Remove prepared media no open room uses, older than `days`. */
    pruneCache: (days) => pruneCache(cacheDir, [...rooms.values()].flatMap((room) => room.items.map((item) => item.file)), days, now()),
    async dispose() {
      disposed = true;
      for (const timer of advanceTimers.values()) clearTimeout(timer.id);
      clearInterval(sweepTimer);
      clearInterval(progressTimer);
      for (const set2 of peers.values()) for (const peer of set2) peer.ws.close(1001, "stopping");
      peers.clear();
      if (saveTimer !== null) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      await flush().catch((error) => logger.warn("could not save rooms: %s", error.message));
    }
  };
}

// src/watchlog.js
import { appendFile, readFile as readFile6 } from "node:fs/promises";
var LOG_NAME = "watch-log.jsonl";
function isNearEnd(position, duration) {
  if (!(duration > 0) || !(position >= 0)) return false;
  return duration - position <= Math.min(300, Math.max(3, duration * 0.1));
}
function createWatchLog({ file, now = Date.now, logger }) {
  let tail = Promise.resolve();
  function append(type, fields) {
    const line = `${JSON.stringify({ at: new Date(now()).toISOString(), type, ...fields })}
`;
    tail = tail.then(() => appendFile(file, line)).catch((error) => logger.warn("could not write the watch log: %s", error.message));
    return tail;
  }
  async function read() {
    await tail;
    let text2 = "";
    try {
      text2 = await readFile6(file, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const events = [];
    for (const line of text2.split("\n")) {
      if (line.trim() === "") continue;
      try {
        events.push(JSON.parse(line));
      } catch {
      }
    }
    return events;
  }
  async function history({ days = 30, limit = 20 } = {}) {
    const since = now() - days * 864e5;
    const shows = /* @__PURE__ */ new Map();
    for (const event of await read()) {
      const at = Date.parse(event.at);
      if (!(at >= since) || event.title === void 0 || event.type.startsWith("library.")) continue;
      const key = event.show ?? `title:${event.title}`;
      if (!shows.has(key)) shows.set(key, { title: event.title, show: event.show ?? null, firstAt: at, lastAt: at, viewers: /* @__PURE__ */ new Set(), finished: /* @__PURE__ */ new Map(), stopped: /* @__PURE__ */ new Map() });
      const entry = shows.get(key);
      entry.lastAt = at;
      entry.title = event.title;
      for (const viewer of event.viewers ?? (event.viewer ? [event.viewer] : [])) entry.viewers.add(viewer);
      if (event.type === "episode.finished") entry.finished.set(event.episode.index, event.episode.title);
      if (event.type === "position" || event.type === "episode.started" || event.type === "episode.finished") {
        const position = event.type === "position" ? event.position : event.type === "episode.finished" ? event.duration ?? null : 0;
        for (const viewer of event.viewers ?? []) {
          entry.stopped.set(viewer, { episode: event.episode.index + 1, episodeTitle: event.episode.title, position, finished: event.type === "episode.finished", at: event.at });
        }
      }
    }
    return [...shows.values()].sort((a, b) => b.lastAt - a.lastAt).slice(0, limit).map((entry) => ({
      title: entry.title,
      show: entry.show,
      with: [...entry.viewers],
      from: new Date(entry.firstAt).toISOString(),
      to: new Date(entry.lastAt).toISOString(),
      episodesFinished: [...entry.finished.keys()].sort((a, b) => a - b).map((index) => index + 1),
      stoppedAt: Object.fromEntries([...entry.stopped].map(([viewer, where]) => [viewer, { ...where, position: where.position === null ? null : Math.round(where.position) }]))
    }));
  }
  return { file, append, read, history, flush: () => tail };
}

// src/journal.js
function createJournal({ log, library, now = Date.now }) {
  const started = /* @__PURE__ */ new Map();
  const base = (room) => ({ room: room.id, title: room.title, show: room.showPath ?? null });
  const episodeOf = (room, index) => ({ index, title: room.items[index]?.title ?? "" });
  const durationOf = (room, index) => room.items[index]?.duration ?? null;
  const fileOf = (room, index) => room.items[index]?.sourcePath ?? null;
  function position(room, index, at, viewers) {
    if (viewers.length === 0) return;
    const duration = durationOf(room, index);
    log.append("position", { ...base(room), episode: episodeOf(room, index), position: Math.round(at * 10) / 10, duration, viewers });
    const file = fileOf(room, index);
    if (file !== null) library.noteProgress(file, at, duration, viewers).catch(() => {
    });
    if (isNearEnd(at, duration)) finished(room, index, viewers);
  }
  function finished(room, index, viewers) {
    const key = `${room.id}/${index}`;
    if (started.get(`${key}/done`)) return;
    started.set(`${key}/done`, true);
    log.append("episode.finished", { ...base(room), episode: episodeOf(room, index), duration: durationOf(room, index), viewers });
    const file = fileOf(room, index);
    if (file !== null) library.noteFinished(file).catch(() => {
    });
  }
  return (type, detail) => {
    const { room } = detail;
    if (type === "opened") {
      log.append("room.opened", { ...base(room), source: room.source, by: room.createdBy || null });
    } else if (type === "closed") {
      position(room, room.index, detail.position, detail.viewers);
      log.append("room.closed", base(room));
      for (const key of [...started.keys()]) if (key.startsWith(`${room.id}/`)) started.delete(key);
    } else if (type === "joined") {
      log.append("viewer.joined", { ...base(room), viewer: detail.viewer });
    } else if (type === "left") {
      position(room, room.index, detail.position, [detail.viewer]);
      log.append("viewer.left", { ...base(room), viewer: detail.viewer });
    } else if (type === "progress") {
      position(room, room.index, detail.position, detail.viewers);
    } else if (type === "op") {
      const { before, after, op, viewers } = detail;
      if (after.index !== before.index) {
        const at = positionAt(before, detail.now ?? now());
        position(before, before.index, op === "ended" ? Math.max(at, durationOf(before, before.index) ?? at) : at, viewers);
        if (op === "ended") finished(before, before.index, viewers);
        started.delete(`${after.id}/${after.index}`);
        started.delete(`${after.id}/${after.index}/done`);
      } else if (op === "ended") {
        finished(after, after.index, viewers);
      }
      const key = `${after.id}/${after.index}`;
      if (after.playing && !started.get(key)) {
        started.set(key, true);
        log.append("episode.started", { ...base(after), episode: episodeOf(after, after.index), viewers });
      }
    }
  };
}

// src/shows.js
import { createHash as createHash5 } from "node:crypto";
import { mkdir as mkdir6, readFile as readFile7, readdir as readdir5, rename as rename6, rm as rm5, stat as stat7, statfs, writeFile as writeFile5 } from "node:fs/promises";
import { basename as basename5, dirname as dirname3, extname as extname6, join as join10, resolve as resolve4 } from "node:path";

// src/episodes.js
import { basename as basename4, extname as extname5 } from "node:path";

// src/work.js
var RELATED_FIELDS = ["id", "title", "kind", "relation", "author", "score", "cover", "popularity", "episodes", "status", "tags"];
function snapshotOf(info, at) {
  const related = (info.related ?? []).map((work) => Object.fromEntries(RELATED_FIELDS.map((field) => [field, work[field] ?? null])));
  return {
    title: info.title,
    kind: info.kind,
    author: info.author,
    score: info.score ?? null,
    blurb: info.blurb ?? "",
    cover: info.cover ?? null,
    popularity: info.popularity ?? null,
    episodes: info.episodes ?? null,
    status: info.status ?? "",
    tags: info.tags ?? [],
    latest: info.latest ?? "",
    meta: info.meta ?? [],
    related: related.map((work) => ({ ...work, tags: work.tags ?? [] })),
    episodeTitles: info.episodeTitles ?? [],
    at
  };
}
var episodeTitle = (work, n) => work?.episodeTitles?.[n - 1] || null;

// src/episodes.js
var titleOf2 = (name2) => basename4(name2, extname5(name2));
function episodeNumber(name2) {
  const match = /^\s*0*(\d+)(?!\d)/.exec(basename4(name2));
  return match === null ? null : Number(match[1]);
}
var isSourced = (entry) => entry?.source?.episodes > 0;
var numbersOf = (names) => new Set(names.map(episodeNumber).filter((n) => n !== null));
function slotsOf(entry, files) {
  if (!isSourced(entry)) return files.map((file, index) => ({ key: file.name, n: index + 1, title: titleOf2(file.name), file }));
  const byNumber = /* @__PURE__ */ new Map();
  for (const file of files) {
    const n = episodeNumber(file.name);
    if (n !== null && !byNumber.has(n)) byNumber.set(n, file);
  }
  const numbers = new Set(byNumber.keys());
  for (let n = 1; n <= entry.source.episodes; n++) numbers.add(n);
  return [...numbers].sort((a, b) => a - b).map((n) => ({ key: n, n, title: episodeTitle(entry.work, n) ?? (byNumber.has(n) ? titleOf2(byNumber.get(n).name) : null), file: byNumber.get(n) ?? null }));
}
var keyOf = (entry, name2) => isSourced(entry) ? episodeNumber(name2) : name2;
function noteFor(entry, notes, name2) {
  if (notes === void 0) return void 0;
  if (!isSourced(entry)) return notes[name2];
  const n = episodeNumber(name2);
  const found = Object.entries(notes).find(([saved]) => episodeNumber(saved) === n);
  return found?.[1];
}

// src/shows.js
var DAY_MS = 864e5;
var STOP_DIFF_S = 30;
var REFINISH_MS = 36e5;
var MAX_NAME2 = 120;
var SUMS = "SHA256SUMS.txt";
var libraryError = (code, message) => Object.assign(new Error(message), { code });
function cleanName(value) {
  const name2 = String(value ?? "").replace(/[\u0000-\u001f\u007f/\\]/g, "").trim().slice(0, MAX_NAME2);
  if (name2 === "" || name2.startsWith(".")) throw libraryError("invalid", "give a name");
  return name2;
}
function groupSeasons(shows) {
  const members = /* @__PURE__ */ new Map();
  for (const show of shows) if (show.group) members.set(show.group, [...members.get(show.group) ?? [], show]);
  const placed = /* @__PURE__ */ new Set();
  const ordered = [];
  for (const show of shows) {
    if (!show.group) {
      ordered.push(show);
      continue;
    }
    if (placed.has(show.group)) continue;
    placed.add(show.group);
    const season = members.get(show.group).sort((a, b) => a.addedAt - b.addedAt);
    season.forEach((member, n) => {
      member.season = n + 1;
      member.seasons = season.length;
    });
    ordered.push(...season);
  }
  shows.splice(0, shows.length, ...ordered);
}
function createLibrary(options) {
  const { roots, stateDir, tools, inUse, download, forget, logger, now = Date.now } = options;
  const metaFile = join10(stateDir, "shows.json");
  const thumbDir = join10(stateDir, "thumbs");
  const cacheDir = join10(stateDir, "cache");
  let meta = {};
  let saving = Promise.resolve();
  const thumbJobs = /* @__PURE__ */ new Map();
  const listeners = /* @__PURE__ */ new Set();
  const changed = (show) => {
    for (const listener of listeners) listener(show);
  };
  async function load() {
    try {
      meta = JSON.parse(await readFile7(metaFile, "utf8")).shows ?? {};
    } catch (error) {
      if (error.code !== "ENOENT") logger.warn("could not read %s: %s", metaFile, error.message);
    }
  }
  function save() {
    const body2 = JSON.stringify({ shows: meta }, null, 1);
    saving = saving.then(async () => {
      await writeFile5(`${metaFile}.part`, body2);
      await rename6(`${metaFile}.part`, metaFile);
    }).catch((error) => logger.warn("could not save %s: %s", metaFile, error.message));
    return saving;
  }
  const record = (path) => meta[path] ?? {};
  function update(path, patch) {
    meta[path] = { ...record(path), ...patch };
    save();
  }
  function showPath(path) {
    if (typeof path !== "string") return null;
    const target = resolve4(path);
    return roots.includes(dirname3(target)) && !basename5(target).startsWith(".") ? target : null;
  }
  function requireShow(path) {
    const target = showPath(path);
    if (target === null) throw libraryError("not_found", "not a show in the library");
    return target;
  }
  function showOf(episodePath) {
    if (typeof episodePath !== "string") return null;
    return showPath(episodePath) ?? showPath(dirname3(episodePath));
  }
  async function episodeFiles(path) {
    const info = await stat7(path).catch(() => null);
    if (info === null) return null;
    if (info.isFile()) return isMedia(basename5(path)) ? [{ name: basename5(path), size: info.size, mtimeMs: info.mtimeMs }] : null;
    const files = [];
    for (const name2 of naturalSort(await readdir5(path).catch(() => []))) {
      if (!isMedia(name2)) continue;
      const file = await stat7(join10(path, name2)).catch(() => null);
      if (file?.isFile()) files.push({ name: name2, size: file.size, mtimeMs: file.mtimeMs });
    }
    return files;
  }
  async function folderBytes(path) {
    const info = await stat7(path).catch(() => null);
    if (info === null) return 0;
    if (info.isFile()) return info.size;
    let total = 0;
    for (const name2 of await readdir5(path).catch(() => [])) total += (await stat7(join10(path, name2)).catch(() => null))?.size ?? 0;
    return total;
  }
  async function forgetSum(show, file) {
    const sums = join10(show, SUMS);
    const text2 = await readFile7(sums, "utf8").catch(() => null);
    if (text2 !== null) await writeFile5(sums, text2.split("\n").filter((line) => !line.endsWith(`  ${file}`) && !line.endsWith(` *${file}`)).join("\n"));
  }
  const note = (type, path, fields = {}) => options.record?.(type, { show: path, title: basename5(path), ...fields });
  function deletesAt(path) {
    const { countdownFrom, keep } = record(path);
    if (!countdownFrom || keep || !(options.autoDeleteDays > 0)) return null;
    return countdownFrom + options.autoDeleteDays * DAY_MS;
  }
  function watchOf(episodePath) {
    const show = showOf(episodePath);
    if (show === null) return null;
    const entry = record(show);
    const file = basename5(episodePath);
    const key = keyOf(entry, file);
    const finished = (entry.finished ?? []).some((name2) => keyOf(entry, name2) === key);
    const at = noteFor(entry, entry.progress, file);
    if (!finished && !(at?.position > 0)) return null;
    return { finished, position: at?.position ?? null, duration: at?.duration ?? null };
  }
  function watchOfItem(show, { slot, sourcePath }) {
    if (slot === void 0) return typeof sourcePath === "string" ? watchOf(sourcePath) : null;
    const entry = record(show);
    const finished = (entry.finished ?? []).some((name2) => episodeNumber(name2) === slot);
    const at = Object.entries(entry.progress ?? {}).find(([name2]) => episodeNumber(name2) === slot)?.[1];
    if (!finished && !(at?.position > 0)) return null;
    return { finished, position: at?.position ?? null, duration: at?.duration ?? null };
  }
  function otherStops(path, slots) {
    const entry = record(path);
    const shared = entry.resume;
    const indexOf = (file) => slots.findIndex((slot) => slot.key === keyOf(entry, file));
    return Object.entries(entry.stops ?? {}).filter(([, stop]) => indexOf(stop.file) >= 0 && (shared === void 0 || stop.file !== shared.file || Math.abs(stop.position - shared.position) > STOP_DIFF_S)).map(([viewer, stop]) => ({ viewer, index: indexOf(stop.file), title: titleOf2(stop.file), position: stop.position }));
  }
  function resumeFrom(path, slots) {
    const entry = record(path);
    const resume = entry.resume;
    if (!resume) return null;
    const index = slots.findIndex((slot) => slot.key === keyOf(entry, resume.file));
    if (index < 0) return null;
    if (isNearEnd(resume.position, resume.duration)) {
      return index + 1 < slots.length ? { index: index + 1, position: 0, title: slots[index + 1].title ?? "" } : null;
    }
    return resume.position > 5 || index > 0 ? { index, position: resume.position, title: slots[index].title ?? titleOf2(resume.file) } : null;
  }
  function focusOf(path, slots) {
    const entry = record(path);
    const resume = entry.resume;
    if (!resume) return 1;
    const index = slots.findIndex((slot) => slot.key === keyOf(entry, resume.file));
    if (index < 0) return 1;
    if (isNearEnd(resume.position, resume.duration)) return index + 1 < slots.length ? slots[index + 1].n : null;
    return slots[index].n;
  }
  function thumbKey(path, first) {
    return createHash5("sha256").update(`${join10(path, first.name)}\0${first.size}\0${first.mtimeMs}`).digest("hex").slice(0, 20);
  }
  async function thumbnail(path, files, isFile) {
    const first = files[0];
    if (first === void 0) return null;
    const source = isFile ? path : join10(path, first.name);
    const key = thumbKey(isFile ? dirname3(path) : path, first);
    const out = join10(thumbDir, `${key}.jpg`);
    if (await stat7(out).then(() => true, () => false)) return `${key}.jpg`;
    if (thumbJobs.has(key) || await stat7(`${out}.none`).then(() => true, () => false)) return null;
    thumbJobs.set(key, makeThumb(source, out).finally(() => thumbJobs.delete(key)));
    return null;
  }
  async function makeThumb(source, out, seek = 3) {
    await mkdir6(thumbDir, { recursive: true });
    const frame = ["-map", "0:V:0", "-frames:v", "1", "-vf", "scale=-2:180", "-q:v", "5", "-f", "image2", `${out}.part`];
    const attempts = isAudio(source) ? [["-y", "-i", source, ...frame]] : [["-y", "-ss", String(seek), "-i", source, ...frame], ["-y", "-i", source, ...frame]];
    for (const args of attempts) {
      try {
        await runFfmpeg(args, { ffmpeg: tools.ffmpeg, duration: null });
        await rename6(`${out}.part`, out);
        return;
      } catch {
        await rm5(`${out}.part`, { force: true });
      }
    }
    await writeFile5(`${out}.none`, "").catch(() => {
    });
  }
  async function describe(path) {
    const info = await stat7(path).catch(() => null);
    if (info === null) return null;
    const files = await episodeFiles(path);
    const state = download(path);
    if ((files === null || files.length === 0) && state === null && !isSourced(record(path))) return null;
    const names = (files ?? []).map((file) => file.name);
    const entry = record(path);
    const slots = slotsOf(entry, files ?? []);
    if (names.length === 0 && state === null && !isSourced(entry)) return null;
    return {
      path,
      name: basename5(path),
      kind: info.isDirectory() ? "folder" : "file",
      media: names.length > 0 && names.every(isAudio) ? "audio" : entry.source?.kind === "audio" ? "audio" : "video",
      episodes: names.length,
      sourced: isSourced(entry),
      pinned: entry.pinned === true,
      total: entry.source?.episodes ?? null,
      size: await folderBytes(path),
      thumb: files === null ? null : await thumbnail(path, files, info.isFile()),
      source: entry.source ?? null,
      keep: entry.keep === true,
      watchedAt: entry.watchedAt ?? null,
      lastWatchedAt: entry.resume?.at ?? null,
      work: entry.work ?? null,
      follow: entry.follow ?? null,
      newSeason: entry.newSeason ?? null,
      newEpisodes: entry.newEpisodes ?? null,
      group: entry.group ?? null,
      deletesAt: deletesAt(path),
      resume: resumeFrom(path, slots),
      finished: slots.filter((slot) => (entry.finished ?? []).some((name2) => keyOf(entry, name2) === slot.key)).length,
      stops: otherStops(path, slots),
      inUse: inUse(path),
      download: state,
      addedAt: entry.addedAt ?? (info.birthtimeMs || info.mtimeMs)
    };
  }
  return {
    load,
    /** Resolves once the notes written so far are on disk. */
    flush: () => saving,
    showPath,
    showOf,
    resumeFrom: async (path) => resumeFrom(path, slotsOf(record(path), await episodeFiles(path) ?? [])),
    watchOf,
    watchOfItem,
    /** Called with a show's path whenever its watch progress changes. */
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Every show, newest first, with totals and the free space of the download folder's disk. */
    async list() {
      const shows = [];
      for (const root of roots) {
        for (const name2 of await readdir5(root).catch(() => [])) {
          if (name2.startsWith(".")) continue;
          const show = await describe(join10(root, name2));
          if (show !== null) shows.push(show);
        }
      }
      shows.sort((a, b) => b.addedAt - a.addedAt);
      groupSeasons(shows);
      const disk = await statfs(roots[0]).catch(() => null);
      return {
        shows,
        total: shows.reduce((sum, show) => sum + show.size, 0),
        free: disk === null ? null : disk.bavail * disk.bsize,
        autoDeleteDays: options.autoDeleteDays
      };
    },
    async episodes(path) {
      const target = requireShow(path);
      const slots = slotsOf(record(target), await episodeFiles(target) ?? []);
      return slots.map((slot) => ({
        n: slot.n,
        name: slot.file?.name ?? null,
        title: slot.title,
        size: slot.file?.size ?? 0,
        cached: slot.file !== null,
        watch: watchOfItem(target, { slot: isSourced(record(target)) ? slot.n : void 0, sourcePath: slot.file ? join10(target, slot.file.name) : null })
      }));
    },
    /**
     * The episodes of a sourced show for a room: one per number, with the file when it is on disk. Null for a show without a source.
     * @returns {Promise<{ n: number, title: string | null, path: string | null }[] | null>}
     */
    async directory(path) {
      const target = showPath(path);
      if (target === null || !isSourced(record(target))) return null;
      return slotsOf(record(target), await episodeFiles(target) ?? []).map((slot) => ({ n: slot.n, title: slot.title, path: slot.file ? join10(target, slot.file.name) : null }));
    },
    /** Paths of the shows that came from a source. */
    async sourcedShows() {
      return Object.keys(meta).filter((path) => isSourced(meta[path]));
    },
    /** Forget that these episodes were deleted by hand. */
    async unskip(path, numbers) {
      update(path, { skip: (record(path).skip ?? []).filter((n) => !numbers.includes(n)) });
    },
    /** The episode numbers on disk in a show folder. */
    async cachedNumbers(path) {
      return numbersOf((await episodeFiles(path) ?? []).map((file) => file.name));
    },
    /** What the rolling cache needs to know about a show, or null for a show without a source. */
    async cacheInfo(path) {
      const target = showPath(path);
      if (target === null || !isSourced(record(target))) return null;
      const entry = record(target);
      const files = await episodeFiles(target) ?? [];
      const slots = slotsOf(entry, files);
      return {
        source: entry.source,
        total: entry.source.episodes,
        cached: numbersOf(files.map((file) => file.name)),
        finished: numbersOf(entry.finished ?? []),
        skip: new Set(entry.skip ?? []),
        pinned: entry.pinned === true,
        focus: focusOf(target, slots)
      };
    },
    /** Every cached episode of the shows the cap counts (sourced, not pinned), with its bytes (the prepared copy included) and when it was last watched or fetched. */
    async cacheEntries() {
      const out = [];
      for (const path of Object.keys(meta)) {
        const entry = meta[path];
        if (!isSourced(entry) || entry.pinned === true) continue;
        for (const file of await episodeFiles(path) ?? []) {
          const n = episodeNumber(file.name);
          if (n === null) continue;
          const watchedAt = noteFor(entry, entry.progress, file.name)?.at ?? 0;
          out.push({ key: `${path}\0${n}`, show: path, n, bytes: file.size + await preparedBytes(cacheDir, join10(path, file.name)), lastAt: Math.max(watchedAt, file.mtimeMs) });
        }
      }
      return out;
    },
    /** Delete cached episodes of a sourced show (watched, or pushed out by the cap); the show and what the viewers did stay. */
    async dropEpisodes(path, numbers, { reason }) {
      const target = requireShow(path);
      const gone = [];
      for (const file of await episodeFiles(target) ?? []) {
        const n = episodeNumber(file.name);
        if (n === null || !numbers.includes(n)) continue;
        const full = join10(target, file.name);
        await dropPrepared(cacheDir, full);
        await rm5(full, { force: true });
        await forgetSum(target, file.name);
        gone.push(n);
      }
      if (gone.length > 0) note("library.cacheDropped", target, { episodes: gone, reason });
      return gone;
    },
    /** Keep a show's every episode on disk (or go back to the rolling cache). */
    async pin(path, pinned, { by = null } = {}) {
      const target = requireShow(path);
      if (!isSourced(record(target))) throw libraryError("invalid", "only a show from a source can be kept offline");
      update(target, { pinned });
      note(pinned ? "library.pinned" : "library.unpinned", target, { by });
      return { path: target, pinned };
    },
    /**
     * A frame of one episode, about a tenth of the way in (3 s when its length is not known), made once in the background;
     * its file name under /thumbs once it exists, else null.
     */
    async frame(path, file, duration = null) {
      const target = showPath(path) ?? showPath(dirname3(path));
      if (target === null || typeof file !== "string" || dirname3(file) !== target && file !== target) return null;
      const info = await stat7(file).catch(() => null);
      if (info === null || !info.isFile()) return null;
      const key = createHash5("sha256").update(`frame\0${file}\0${info.size}\0${info.mtimeMs}`).digest("hex").slice(0, 20);
      const out = join10(thumbDir, `${key}.jpg`);
      if (await stat7(out).then(() => true, () => false)) return `${key}.jpg`;
      if (thumbJobs.has(key) || await stat7(`${out}.none`).then(() => true, () => false)) return null;
      thumbJobs.set(key, makeThumb(file, out, duration > 30 ? Math.round(duration / 10) : 3).finally(() => thumbJobs.delete(key)));
      return null;
    },
    /** Wait for the poster frames being made, so nothing writes into the state folder after shutdown. */
    settleThumbs: () => Promise.allSettled([...thumbJobs.values()]),
    thumbFile: (name2) => /^[0-9a-f]{20}\.jpg$/.test(name2) ? join10(thumbDir, name2) : null,
    /** Followed shows with when they were last checked and are next due. */
    follows: () => Object.entries(meta).filter(([, entry]) => entry.follow && isSourced(entry)).map(([path, entry]) => ({ path, follow: entry.follow, source: entry.source, group: entry.group ?? null })),
    /** Follow a show, or stop (null). `follow` is `{ since, seen, checkedAt, nextAt }`. */
    setFollow(path, follow) {
      update(path, { follow });
      changed(path);
    },
    /** What a check found: a new season (on the new show) or more episodes (on this one); cleared when someone looks. */
    mark: (path, patch) => update(path, patch),
    dismiss: (path) => update(requireShow(path), { newSeason: null, newEpisodes: null }),
    /** More episodes in a show's work than it had: its total grows, the rolling cache takes it from there. */
    setEpisodes(path, episodes) {
      const entry = record(path);
      update(path, { source: { ...entry.source, episodes } });
      changed(path);
    },
    /** The snapshot of a show's work saved with it (or null), and the sourced shows without one, for backfilling. */
    workOf: (path) => record(path).work ?? null,
    /** Which source and work id a show came from (`{ source, id, ... }`), or null. */
    workSource: (path) => path === null || path === void 0 ? null : record(path).source ?? null,
    withoutWork: () => Object.keys(meta).filter((path) => isSourced(meta[path]) && !meta[path].work && !meta[path].workTriedAt),
    setWork(path, work) {
      update(path, { work, workTriedAt: null });
    },
    /** Note that fetching a show's work failed, so it is not asked for again unless someone refreshes it. */
    noteWorkFailed: (path) => update(path, { workTriedAt: now() }),
    /** Note a show coming from a source, before its files arrive. */
    async adopt(path, source, { pinned = false } = {}) {
      await mkdir6(path, { recursive: true });
      update(path, { source, addedAt: record(path).addedAt ?? now(), ...pinned ? { pinned: true } : {} });
    },
    async remove(path, { by = null, reason = "by hand" } = {}) {
      const target = requireShow(path);
      if (inUse(target)) throw libraryError("in_use", "a room is playing this show; close the room first");
      await forget(target);
      await rm5(target, { recursive: true, force: true });
      delete meta[target];
      await save();
      note("library.deleted", target, { by, reason });
      return { removed: target };
    },
    async removeEpisode(path, name2, { by = null } = {}) {
      const target = requireShow(path);
      if ((await stat7(target)).isFile()) return this.remove(target, { by });
      if (inUse(target)) throw libraryError("in_use", "a room is playing this show; close the room first");
      const file = cleanName(name2);
      if (!isMedia(file)) throw libraryError("invalid", "not an episode");
      await dropPrepared(cacheDir, join10(target, file));
      await rm5(join10(target, file), { force: true });
      await forgetSum(target, file);
      note("library.episodeDeleted", target, { episode: titleOf2(file), by });
      const entry = record(target);
      if (isSourced(entry) && episodeNumber(file) !== null) update(target, { skip: [.../* @__PURE__ */ new Set([...entry.skip ?? [], episodeNumber(file)])] });
      const left = await episodeFiles(target);
      if (!isSourced(entry) && left !== null && left.length === 0 && download(target) === null) return this.remove(target, { by });
      return { removed: join10(target, file) };
    },
    async rename(path, name2, { by = null } = {}) {
      const target = requireShow(path);
      if (inUse(target)) throw libraryError("in_use", "a room is playing this show; close the room first");
      if (download(target)?.active) throw libraryError("in_use", "this show is still downloading");
      const isFile = (await stat7(target)).isFile();
      const clean = cleanName(name2);
      const next = join10(dirname3(target), isFile && extname6(clean) === "" ? `${clean}${extname6(target)}` : clean);
      if (next === target) return { path: target };
      if (await stat7(next).then(() => true, () => false)) throw libraryError("exists", "a show with that name is already in the library");
      await rename6(target, next);
      if (meta[target] !== void 0) {
        meta[next] = meta[target];
        delete meta[target];
        await save();
      }
      note("library.renamed", next, { from: basename5(target), by });
      return { path: next };
    },
    /** Keep a show: no countdown; it stays until someone deletes it. */
    async keep(path, { by = null } = {}) {
      const target = requireShow(path);
      update(target, { keep: true });
      note("library.kept", target, { by });
      return { path: target, keep: true, deletesAt: null };
    },
    /** Start the countdown now (or restart it): deleted `autoDeleteDays` from now unless kept. */
    async countdown(path, { by = null } = {}) {
      const target = requireShow(path);
      if (!(options.autoDeleteDays > 0)) throw libraryError("invalid", "automatic deleting is off");
      const restart = deletesAt(target) !== null;
      update(target, { keep: false, countdownFrom: now() });
      note(restart ? "library.countdownRestarted" : "library.countdownStarted", target, { by, deletesAt: new Date(deletesAt(target)).toISOString() });
      return { path: target, keep: false, deletesAt: deletesAt(target) };
    },
    /** Where the viewers are in an episode; called as they watch. */
    async noteProgress(episodePath, position, duration, viewers = []) {
      const show = showOf(episodePath);
      if (show === null || !(position >= 0)) return;
      const file = basename5(episodePath);
      const entry = record(show);
      const stops = { ...entry.stops };
      for (const viewer of viewers) stops[viewer] = { file, position, at: now() };
      update(show, {
        resume: { file, position, duration: duration ?? null, at: now() },
        progress: { ...entry.progress, [file]: { position, duration: duration ?? entry.progress?.[file]?.duration ?? null, at: now() } },
        stops
      });
      if (isNearEnd(position, duration)) await this.noteFinished(episodePath);
      else changed(show);
    },
    /** An episode was watched to its end; the show may now count as watched. */
    async noteFinished(episodePath) {
      const show = showOf(episodePath);
      if (show === null) return;
      const entry = record(show);
      const finished = new Set(entry.finished ?? []);
      finished.add(basename5(episodePath));
      const names = (await episodeFiles(show) ?? []).map((file) => file.name);
      const keys = slotsOf(entry, await episodeFiles(show) ?? []).map((slot) => slot.key);
      const done = new Set([...finished].map((name2) => keyOf(entry, name2)));
      const complete = isSourced(entry) || names.length >= (entry.source?.episodes ?? names.length);
      const lastDone = complete && keys.length > 0 && done.has(keys[keys.length - 1]);
      const allDone = complete && keys.every((key) => done.has(key));
      const newFinish = (lastDone || allDone) && (!entry.watchedAt || now() - entry.watchedAt > REFINISH_MS);
      update(show, { finished: [...finished], ...newFinish ? { watchedAt: now(), countdownFrom: now() } : {} });
      if (newFinish && !entry.keep && options.autoDeleteDays > 0) note("library.countdownStarted", show, { by: null, reason: "watched to the end", deletesAt: new Date(deletesAt(show)).toISOString() });
      changed(show);
    },
    /** Delete watched shows whose time has come, unless kept, open in a room or downloading. */
    async sweep() {
      for (const path of Object.keys(meta)) {
        const due = deletesAt(path);
        if (due === null || due > now() || inUse(path) || download(path)?.active) continue;
        if (!await stat7(path).then(() => true, () => false)) {
          delete meta[path];
          save();
          continue;
        }
        logger.info("deleting %s: its %d-day countdown ended", path, options.autoDeleteDays);
        await this.remove(path, { reason: "countdown ended" }).catch((error) => logger.warn("could not delete %s: %s", path, error.message));
      }
    }
  };
}

// src/follow.js
var DAY_MS2 = 864e5;
var OPEN_RECHECK_MS = 36e5;
var JITTER = 0.1;
var nextCheckAt = (checkedAt, random) => checkedAt + Math.round(DAY_MS2 * (1 - JITTER + 2 * JITTER * random));
function dueFollows(follows, now) {
  return follows.filter(({ follow }) => (follow.nextAt ?? 0) <= now).sort((a, b) => (a.follow.nextAt ?? 0) - (b.follow.nextAt ?? 0));
}
var seenAtStart = (id, work) => [.../* @__PURE__ */ new Set([id, ...(work?.related ?? []).map((other) => other.id)])];
var newSeasons = (info, seen) => (info.related ?? []).filter((other) => other.relation === "season" && other.id !== info.id && !seen.includes(other.id));
function createFollows({ library, source, refreshed, addSeason, record, notify, logger, now = Date.now, random = Math.random, pauseMs = 3e4, tickMs = 6e5 }) {
  let timer = null;
  let busy = false;
  const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
  async function check(path) {
    const entry = library.follows().find((item) => item.path === path);
    const found = entry && source(entry.source.source);
    if (!found) return;
    const checkedAt = now();
    try {
      const info = await found.info(entry.source.id);
      refreshed({ path, sourceId: entry.source.source, info });
      const seen = [...entry.follow.seen];
      const added = [];
      for (const season of newSeasons(info, entry.follow.seen)) {
        seen.push(season.id);
        const seasonPath = await addSeason(entry.source.source, season, { path, group: entry.group ?? `${entry.source.source}:${entry.source.id}` });
        added.push([season, seasonPath]);
        record("library.newSeason", { show: seasonPath, title: season.title, from: entry.source.title ?? "" });
        notify({ type: "season", title: season.title, from: entry.source.title ?? "", show: seasonPath });
      }
      if (info.episodes > entry.source.episodes) {
        const more = info.episodes - entry.source.episodes;
        library.setEpisodes(path, info.episodes);
        library.mark(path, { newEpisodes: { n: more, at: checkedAt } });
        record("library.newEpisodes", { show: path, title: entry.source.title ?? "", episodes: more });
        notify({ type: "episodes", title: entry.source.title ?? "", episodes: more, show: path });
      }
      library.setFollow(path, { ...entry.follow, seen, checkedAt, nextAt: nextCheckAt(checkedAt, random()) });
      return added;
    } catch (error) {
      logger.warn("could not check %s: %s", path, error.message);
      library.setFollow(path, { ...entry.follow, checkedAt, nextAt: nextCheckAt(checkedAt, random()) });
    }
  }
  async function sweep() {
    if (busy) return;
    busy = true;
    try {
      for (const { path } of dueFollows(library.follows(), now())) {
        await check(path);
        await sleep(pauseMs);
      }
    } finally {
      busy = false;
    }
  }
  return {
    check,
    sweep,
    /** Someone opened a followed show: look once more unless it was looked at lately. */
    opened(path) {
      const entry = library.follows().find((item) => item.path === path);
      if (entry && now() - (entry.follow.checkedAt ?? 0) > OPEN_RECHECK_MS) check(path).catch(() => {
      });
    },
    start() {
      timer = setInterval(() => {
        sweep().catch(() => {
        });
      }, tickMs);
      timer.unref?.();
    },
    stop() {
      clearInterval(timer);
    }
  };
}

// src/media.js
var HOUR_MS = 36e5;
var BACKFILL_PAUSE_MS = 3e4;
var MIN_FREE_BYTES = 1e9;
var NO_CONVERTER = Object.freeze({ command: "", available: async () => false });
var hubError = (code, message) => Object.assign(new Error(message), { code });
function createMediaHub(options) {
  const { stateDir, libraryRoots, logger, now = Date.now } = options;
  const backfillPause = options.backfillPauseMs ?? BACKFILL_PAUSE_MS;
  const sources = new Map(options.sources.map((source2) => [source2.id, source2]));
  const covers = createCovers({ dir: join11(stateDir, "covers"), capBytes: options.coverCacheBytes, logger }, (id) => sources.get(id));
  const log = createWatchLog({ file: join11(stateDir, LOG_NAME), now, logger });
  const books = createBooks({ dir: join11(stateDir, "books"), sources, capBytes: options.books?.capBytes ?? 0, converter: options.books?.converter ?? NO_CONVERTER, covers, logger, now });
  let rooms;
  let cache;
  const downloads = createDownloads({
    stateDir,
    sources,
    have: (dir) => library.cachedNumbers(dir),
    hasSpace: async () => {
      const disk = await statfs2(libraryRoots[0]).catch(() => null);
      return disk === null || disk.bavail * disk.bsize >= MIN_FREE_BYTES;
    },
    onFiles,
    logger,
    now
  });
  const library = createLibrary({
    roots: libraryRoots,
    stateDir,
    autoDeleteDays: options.autoDeleteDays,
    tools: options.tools,
    inUse: (path) => rooms.usesPath(path),
    download: (path) => downloads.state(path),
    forget: (path) => downloads.cancel(path),
    record: (type, fields) => log.append(type, fields),
    logger,
    now
  });
  rooms = createRoomService({
    ...options,
    watchOf: (item, show) => library.watchOfItem(show, item),
    directory: (path) => library.directory(path),
    focus: (show, change) => {
      cache.refresh(show, change).catch(() => {
      });
    },
    observe: createJournal({ log, library, now })
  });
  cache = createCache({ library, downloads, rooms, window: options.cache, logger });
  library.onChange((show) => {
    rooms.refreshShow(show);
    cache.refresh(show).catch(() => {
    });
  });
  const sweepTimer = setInterval(() => {
    library.sweep().catch(() => {
    });
    cache.enforce().catch(() => {
    });
  }, HOUR_MS);
  async function onFiles(job) {
    await rooms.syncShow(job.dir);
    if (job.status === "failed") rooms.failWaiting(job.dir, job.error ?? "the download failed");
    await cache.enforce();
  }
  let backfilling = false;
  async function backfill() {
    if (backfilling) return;
    backfilling = true;
    try {
      for (const path of library.withoutWork()) {
        const entry = library.workSource(path);
        if (!sources.has(entry?.source)) continue;
        try {
          library.setWork(path, snapshotOf(await source(entry.source).info(entry.id), now()));
        } catch (error) {
          library.noteWorkFailed(path);
          logger.warn("no details for %s from %s: %s", path, entry.source, error.message);
        }
        await new Promise((done) => backfillTimer = setTimeout(done, backfillPause));
      }
    } finally {
      backfilling = false;
    }
  }
  let backfillTimer;
  function notify(event) {
    const [command, ...args] = options.notifyCommand ?? [];
    if (command === void 0) return;
    try {
      const child = spawn4(command, args, { stdio: ["pipe", "ignore", "ignore"] });
      child.on("error", (error) => logger.warn("notify command failed: %s", error.message));
      child.stdin.on("error", () => {
      });
      child.stdin.end(`${JSON.stringify({ ...event, at: now() })}
`);
    } catch (error) {
      logger.warn("notify command failed: %s", error.message);
    }
  }
  const followStart = (info, at = now()) => ({ since: at, seen: seenAtStart(info.id, info), checkedAt: at, nextAt: nextCheckAt(at, (options.follow?.random ?? Math.random)()) });
  async function adoptEmpty(sourceId, item) {
    if (!(item.episodes > 0)) throw hubError("empty", `${item.title || item.id} has no episodes yet`);
    const dir = await folderFor(sourceId, item);
    await library.adopt(dir, { source: sourceId, id: item.id, kind: item.kind, episodes: item.episodes, title: item.title });
    library.setWork(dir, snapshotOf(item, now()));
    return dir;
  }
  const follows = createFollows({
    library,
    source: (id) => sources.get(id),
    refreshed: ({ path, info }) => library.setWork(path, snapshotOf(info, now())),
    async addSeason(sourceId, season, { path, group }) {
      const info = await source(sourceId).info(season.id);
      const dir = await adoptEmpty(sourceId, info);
      library.mark(path, { group });
      library.mark(dir, { group, newSeason: { at: now(), from: library.workSource(path)?.title ?? "" } });
      library.setFollow(dir, followStart(info));
      return dir;
    },
    record: (type, fields) => log.append(type, fields),
    notify,
    logger,
    now,
    ...options.follow
  });
  const withCovers = (show) => show.work && show.source?.source ? { ...show, work: covers.decorate(show.source.source, show.work) } : show;
  function source(id) {
    const found = sources.get(id);
    if (found === void 0) throw hubError("not_found", `no source ${String(id)}`);
    return found;
  }
  async function folderFor(sourceId, item) {
    const name2 = cleanName(item.title);
    for (const candidate of [name2, `${name2} (${item.id})`]) {
      const path = join11(libraryRoots[0], candidate);
      const exists2 = await stat8(path).then(() => true, () => false);
      const shows = (await library.list()).shows;
      const owner = shows.find((show) => show.path === path);
      if (!exists2 || owner?.source?.source === sourceId && owner.source.id === item.id) return path;
    }
    throw hubError("exists", `${name2} is already in the library`);
  }
  return {
    async load() {
      await library.load();
      await books.load();
      await rooms.load();
      await downloads.load();
      await library.sweep();
      await cache.refreshActive();
      backfillTimer = setTimeout(() => backfill().catch(() => {
      }), backfillPause);
      follows.start();
    },
    // ---------------------------------------------------------- rooms
    /**
     * Open a room. A library show continues where its viewers stopped unless
     * `start` says otherwise.
     */
    async createRoom(input) {
      let start = input.start ?? null;
      if (input.source === "local" && start === null && typeof input.path === "string") {
        const show = library.showPath(input.path);
        if (show !== null) start = await library.resumeFrom(show);
      }
      if (input.source === "local" && typeof input.path === "string") follows.opened(library.showPath(input.path));
      return rooms.createRoom({ ...input, start });
    },
    waitReady: (...args) => rooms.waitReady(...args),
    room: (id) => rooms.room(id),
    /** Open rooms with a preview of what plays: the show's cover and a frame of the episode now on. */
    async listRooms() {
      return Promise.all(rooms.listRooms().map(async ({ file, ...room }) => {
        const show = room.show === null ? null : withCovers({ source: library.workSource(room.show), work: library.workOf(room.show) });
        return { ...room, cover: show?.work?.cover ?? null, frame: file === null ? null : await library.frame(room.show ?? file, file, room.duration) };
      }));
    },
    closeRoom: (id) => rooms.closeRoom(id),
    attach: (ws, id) => rooms.attach(ws, id),
    mediaFile: (...args) => rooms.mediaFile(...args),
    subtitleFile: (...args) => rooms.subtitleFile(...args),
    linkFor: (id) => rooms.linkFor(id),
    sweep: () => rooms.sweep(),
    pruneCache: (days) => rooms.pruneCache(days),
    // ---------------------------------------------------------- library
    async library() {
      const list = await library.list();
      return { ...list, shows: list.shows.map(withCovers) };
    },
    /** The details of the work a room's show came from, or null. */
    roomWork(id) {
      const room = rooms.listRooms().find((entry) => entry.id === id);
      if (room === void 0) throw hubError("not_found", "no such room");
      return { work: room.show === null ? null : withCovers({ source: library.workSource(room.show), work: library.workOf(room.show) }).work ?? null, source: library.workSource(room.show)?.source ?? null, id: library.workSource(room.show)?.id ?? null };
    },
    /** Ask the show's source for its work's details again (by hand: the library never repeats it by itself). */
    async refreshWork(path) {
      const show = library.showPath(path);
      const entry = show === null ? null : library.workSource(show);
      if (entry === null || !sources.has(entry.source)) throw hubError("not_found", "this show did not come from a source");
      library.setWork(show, snapshotOf(await source(entry.source).info(entry.id), now()));
      return withCovers({ source: entry, work: library.workOf(show) }).work;
    },
    episodes: (path) => library.episodes(path),
    removeShow: (path, by) => library.remove(path, { by }),
    removeEpisode: (path, name2, by) => library.removeEpisode(path, name2, { by }),
    renameShow: (path, name2, by) => library.rename(path, name2, { by }),
    keepShow: (path, by) => library.keep(path, { by }),
    countdownShow: (path, by) => library.countdown(path, { by }),
    thumbFile: (name2) => library.thumbFile(name2),
    sweepLibrary: () => library.sweep(),
    // ---------------------------------------------------------- shelves
    /** Each person's books (src/books.js); the shelf routes key them by person. */
    books,
    // ---------------------------------------------------------- sources
    sources: () => describeSources([...sources.values()]),
    /**
     * Search one source, or with `ALL_SOURCES` every available source that has `kind`, at once. Each result
     * carries the source it came from; under all sources a failing source is reported in `failed` and the others still answer.
     */
    async search(sourceId, query, kind, offset = 0, filters = {}) {
      const ask = async (one) => {
        const { results, next } = await one.search(query, { kind, offset, filters });
        return { results: applyFilters(results, filters).map((work) => ({ ...covers.decorate(one.id, work), source: one.id })), next };
      };
      if (sourceId !== ALL_SOURCES) return ask(source(sourceId));
      const candidates = [];
      for (const one of sources.values()) {
        if (one.kinds.some((entry) => entry.id === kind) && await one.available()) candidates.push(one);
      }
      const answers = await Promise.allSettled(candidates.map((one) => ask(one)));
      const failed = answers.flatMap((answer, index) => answer.status === "rejected" ? [{ source: candidates[index].id, message: answer.reason?.message ?? String(answer.reason) }] : []);
      if (candidates.length > 0 && failed.length === candidates.length) throw hubError("source_failed", failed.map((entry) => entry.message).join("; "));
      return { results: interleave(answers.map((answer) => answer.status === "fulfilled" ? answer.value.results : [])), next: null, failed };
    },
    info: async (sourceId, id) => ({ ...covers.decorate(sourceId, await source(sourceId).info(id)), source: sourceId }),
    coverFile: (key) => covers.file(key),
    /**
     * Put a work from a source into the library. `watch` opens a room on it
     * at once (its episode shows as preparing until it is fetched); either
     * way only the rolling cache's window is downloaded, unless `all` keeps
     * the whole show offline.
     * @param {{ source: string, id: string, watch?: boolean, all?: boolean, by?: string }} input
     */
    async fetch({ source: sourceId, id, watch = false, all = false, by = "" }) {
      const item = await source(sourceId).info(id);
      if (!(item.episodes > 0)) throw hubError("empty", `${item.title || id} has no episodes`);
      const disk = await statfs2(libraryRoots[0]).catch(() => null);
      if (disk !== null && disk.bavail * disk.bsize < MIN_FREE_BYTES) throw hubError("no_space", "the library disk is almost full; delete something first");
      const dir = await folderFor(sourceId, item);
      await library.adopt(dir, { source: sourceId, id: item.id, kind: item.kind, episodes: item.episodes, title: item.title }, { pinned: all });
      library.setWork(dir, snapshotOf(item, now()));
      let room = null;
      if (watch) room = (await rooms.createRoom({ source: "local", path: dir, title: item.title, by, start: await library.resumeFrom(dir) })).room;
      else await cache.refresh(dir, { retry: true });
      const count = all ? item.episodes : Math.min(item.episodes, options.cache.ahead + 1);
      return { path: dir, title: item.title, episodes: item.episodes, estimate: count * (EPISODE_BYTES[item.kind] ?? EPISODE_BYTES.drama), room, download: downloads.state(dir) };
    },
    /**
     * Follow a work, or stop following it. A work not in the library is added as an empty show; the host then looks for its
     * next season (and more episodes) now and then, and adds a new season by itself.
     */
    async followWork({ source: sourceId, id, follow = true }) {
      const found = (await library.list()).shows.find((show) => show.source?.source === sourceId && show.source.id === id);
      if (!follow) {
        if (found) library.setFollow(found.path, null);
        return { path: found?.path ?? null, follow: false };
      }
      if (found) {
        if (!found.follow) library.setFollow(found.path, followStart({ ...found.work ?? {}, id }, now()));
        return { path: found.path, follow: true };
      }
      const info = await source(sourceId).info(id);
      const dir = await adoptEmpty(sourceId, info);
      library.setFollow(dir, followStart(info));
      return { path: dir, follow: true };
    },
    /** The checks of followed works, for tests and for the agent: one show now, or whatever is due. */
    checkFollow: (path) => follows.check(path),
    sweepFollows: () => follows.sweep(),
    followsDue: (at) => dueFollows(library.follows(), at),
    /** Someone has seen what a check found for a show: its new season or new episodes. */
    dismissNews: (path) => library.dismiss(path),
    /** Keep a show's every episode on disk, or go back to the rolling cache. */
    async pinShow(path, pinned, by) {
      const answer = await library.pin(path, pinned, { by });
      await cache.refresh(answer.path, { retry: true });
      return answer;
    },
    /** Start a show's download again after it failed. */
    async retryDownload(path) {
      const show = library.showPath(path);
      if (show === null || downloads.job(show) === void 0) throw hubError("not_found", "no download for this show");
      downloads.retry(show);
      await cache.refresh(show, { retry: true });
      return { download: downloads.state(show) };
    },
    async cancelDownload(path) {
      const show = library.showPath(path);
      if (show !== null) await downloads.cancel(show);
      return { cancelled: resolve5(path) };
    },
    /** A download someone waits on to watch: its state and, once open, its room. */
    download: (path) => {
      const show = library.showPath(path);
      return show === null ? null : downloads.state(show);
    },
    // ---------------------------------------------------------- watch log
    history: (opts) => log.history(opts),
    logFile: log.file,
    async dispose() {
      clearInterval(sweepTimer);
      clearTimeout(backfillTimer);
      follows.stop();
      await books.dispose();
      await downloads.dispose();
      await rooms.dispose();
      await library.settleThumbs();
      await library.flush();
      await log.flush();
    }
  };
}

// src/shelf-routes.js
import { createReadStream as createReadStream3 } from "node:fs";
import { stat as stat9 } from "node:fs/promises";
import { Readable } from "node:stream";

// src/people.js
import { createHash as createHash6 } from "node:crypto";
var OWNER = "owner";
function personOf(identityService) {
  const identity = typeof identityService?.current === "function" ? identityService.current() : null;
  if (identity === null || typeof identity?.id !== "string" || identity.id === "") return { key: OWNER, name: "", verified: false };
  const key = createHash6("sha256").update(`${identity.issuer ?? ""}
${identity.id}`).digest("hex").slice(0, 20);
  return { key, name: typeof identity.name === "string" ? identity.name.slice(0, 80) : "", verified: true };
}

// src/shelf-routes.js
var SHELF_PATH = "/api/media-hub/shelf";
var HEADERS = { "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" };
var STATUS2 = Object.freeze({ invalid: 400, not_found: 404, unsupported: 422, source_failed: 502, unavailable: 503 });
var json = (status, body2) => new Response(JSON.stringify(body2), { status, headers: { ...HEADERS, "content-type": "application/json; charset=utf-8" } });
var failure = (error) => json(error?.status ?? STATUS2[error?.code] ?? 500, { error: { code: error?.code ?? "error", message: error?.message ?? String(error) } });
async function body(request) {
  try {
    const value = await request.json();
    return value !== null && typeof value === "object" ? value : {};
  } catch {
    throw Object.assign(new Error("request body is not JSON"), { status: 400 });
  }
}
async function fileResponse(request, { path, name: name2, type }) {
  const info = await stat9(path).catch(() => null);
  if (info === null || !info.isFile()) return json(404, { error: { code: "not_found", message: "the file is gone" } });
  const range = resolveRange(request.headers.get("range"), info.size);
  const headers = { ...HEADERS, "content-type": type, "content-disposition": attachment(name2), "accept-ranges": "bytes" };
  if (range.kind === "unsatisfiable") return new Response(null, { status: 416, headers: { ...headers, "content-range": `bytes */${info.size}` } });
  const start = range.kind === "window" ? range.start : 0;
  const end = range.kind === "window" ? range.end : info.size - 1;
  headers["content-length"] = String(info.size === 0 ? 0 : end - start + 1);
  if (range.kind === "window") headers["content-range"] = `bytes ${start}-${end}/${info.size}`;
  const stream = request.method === "HEAD" || info.size === 0 ? null : Readable.toWeb(createReadStream3(path, { start, end }));
  return new Response(stream, { status: range.kind === "window" ? 206 : 200, headers });
}
function createShelfRoutes({ books, identity }) {
  const handle = (fn) => async (request) => {
    const shelves = books();
    if (shelves === void 0) return json(503, { error: { code: "unavailable", message: "The shelf is starting." } });
    try {
      return await fn(request, shelves, personOf(identity()));
    } catch (error) {
      return failure(error);
    }
  };
  const param = (request, name2) => new URL(request.url).searchParams.get(name2) ?? "";
  return [
    { path: SHELF_PATH, methods: ["GET"], requestBody: "buffered", fetch: handle(async (request, shelves, person) => json(200, { ...await shelves.list(person.key), person: { name: person.name, verified: person.verified } })) },
    {
      path: `${SHELF_PATH}/add`,
      methods: ["POST"],
      requestBody: "buffered",
      fetch: handle(async (request, shelves, person) => {
        const input = await body(request);
        return json(200, { entry: await shelves.add(person.key, { source: input.source, id: input.id, format: input.format, title: input.title, author: input.author, by: person.name }) });
      })
    },
    { path: `${SHELF_PATH}/retry`, methods: ["POST"], requestBody: "buffered", fetch: handle(async (request, shelves, person) => json(200, { entry: await shelves.retry(person.key, (await body(request)).entry) })) },
    { path: `${SHELF_PATH}/remove`, methods: ["POST"], requestBody: "buffered", fetch: handle(async (request, shelves, person) => json(200, await shelves.remove(person.key, (await body(request)).entry))) },
    {
      path: `${SHELF_PATH}/file`,
      methods: ["GET", "HEAD"],
      requestBody: "buffered",
      fetch: handle(async (request, shelves, person) => {
        const file = await shelves.file(person.key, param(request, "entry"));
        return file === null ? json(404, { error: { code: "not_found", message: "not on your shelf, or not downloaded yet" } }) : fileResponse(request, file);
      })
    }
  ];
}

// index.js
var name = "dsh-media-hub";
var inject = ["webServer", "connection"];
var ROOM_ID = /^[A-Za-z0-9_-]{6,32}$/;
var DAY_MS3 = 864e5;
function apply(ctx, config) {
  const logger = ctx.logger("media-hub");
  let current;
  ctx.provide?.("mediaHub", Object.freeze({ service: () => current }));
  ctx.effect(() => {
    const stateDir = resolve6(config.stateDir);
    const service = createMediaHub({
      stateDir,
      libraryRoots: [join12(stateDir, "library"), ...config.libraryRoots.map((root) => resolve6(root))],
      delivery: createDelivery({ mode: config.delivery }),
      tools: { ffmpeg: config.ffmpeg, ffprobe: config.ffprobe, ytDlp: config.ytDlp, maxHeight: config.maxHeight, threads: config.threads },
      webUrl: () => ctx.get("webApp")?.getAdvertisedUrl(),
      lifetime: { emptyMinutes: config.emptyMinutes, unopenedHours: config.unopenedHours },
      autoDeleteDays: config.autoDeleteDays,
      sources: createSources(config.sources, { stateDir, logger }),
      coverCacheBytes: config.coverCacheMb * 1e6,
      books: {
        capBytes: config.bookCacheGb * 1e9,
        converter: { command: config.converter, available: () => config.converter === "" ? Promise.resolve(false) : commandExists(config.converter) }
      },
      notifyCommand: config.notifyCommand,
      cache: { ahead: config.cacheAhead, behind: config.cacheBehind, capBytes: config.cacheLimitGb * 1e9 },
      logger
    });
    let stopped = false;
    const loading = service.load().then(() => {
      if (stopped) return;
      current = service;
      return service.pruneCache(config.cacheDays);
    }).catch((error) => logger.warn("could not start rooms: %s", error.message));
    const prune = setInterval(() => {
      service.pruneCache(config.cacheDays).catch(() => {
      });
    }, DAY_MS3);
    const shelfRoutes = createShelfRoutes({
      books: () => current?.books,
      identity: () => ctx.get("requestIdentity")
    }).map((route) => ctx.connection.fetch.register(route));
    const sockets = new import_websocket_server.default({ noServer: true, maxPayload: 16 * 1024, perMessageDeflate: false });
    const disposeHttp = ctx.webServer.register({
      kind: "prefix",
      path: ROUTE,
      handler: createHandler({ connection: ctx.connection, service: () => current, label: () => config.label })
    });
    const disposeUpgrade = ctx.webServer.registerUpgrade({
      path: WS_PATH,
      handler(req, socket, head) {
        const admitted = admitOwner(ctx.connection, req);
        if (!admitted.ok) return refuseUpgrade(socket, admitted.status);
        const room = new URL(req.url ?? "/", "http://media-hub.invalid").searchParams.get("room");
        if (current === void 0 || room === null || !ROOM_ID.test(room)) return refuseUpgrade(socket, room === null ? 400 : 404);
        sockets.handleUpgrade(req, socket, head, (ws) => {
          if (current === void 0) ws.close(1013, "stopping");
          else current.attach(ws, room);
        });
      }
    });
    return async () => {
      stopped = true;
      current = void 0;
      clearInterval(prune);
      disposeUpgrade();
      disposeHttp();
      await Promise.all(shelfRoutes.map((dispose) => dispose()));
      await loading;
      await service.dispose();
      sockets.close();
    };
  }, "media-hub.rooms()");
}
export {
  Config,
  apply,
  inject,
  name
};
