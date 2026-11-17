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
    var http2 = __require("http");
    var net4 = __require("net");
    var querystring = __require("querystring");
    var tls3 = __require("tls");
    var { randomBytes: randomBytes3, createHash: createHash8 } = __require("crypto");
    var { Duplex, Readable: Readable3 } = __require("stream");
    var { URL: URL4 } = __require("url");
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
      if (address instanceof URL4) {
        parsedUrl = address;
      } else {
        try {
          parsedUrl = new URL4(address);
        } catch {
          throw new SyntaxError(`Invalid URL: ${address}`);
        }
      }
      if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
        parsedUrl = new URL4(parsedUrl);
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
      const key = randomBytes3(16).toString("base64");
      const request = isSecure ? https.request : http2.request;
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
            addr = new URL4(location, address);
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
        const digest = createHash8("sha1").update(key + GUID).digest("base64");
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
      return net4.connect(options);
    }
    function tlsConnect(options) {
      options.path = void 0;
      if (!options.servername && options.servername !== "") {
        options.servername = net4.isIP(options.host) ? "" : options.host;
      }
      return tls3.connect(options);
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
      process.nextTick(resume2, websocket._socket);
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
        process.nextTick(resume2, websocket._socket);
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
    function resume2(stream) {
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
          ws.once("open", function open4() {
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
          ws.once("open", function open4() {
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
    var http2 = __require("http");
    var { Duplex } = __require("stream");
    var { createHash: createHash8 } = __require("crypto");
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
          this._server = http2.createServer((req, res) => {
            const body2 = http2.STATUS_CODES[426];
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
        const digest = createHash8("sha1").update(key + GUID).digest("base64");
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
      message = message || http2.STATUS_CODES[code];
      headers = {
        Connection: "close",
        "Content-Type": "text/html",
        "Content-Length": Buffer.byteLength(message),
        ...headers
      };
      socket.once("finish", socket.destroy);
      socket.end(
        `HTTP/1.1 ${code} ${http2.STATUS_CODES[code]}\r
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

// node_modules/ms/index.js
var require_ms = __commonJS({
  "node_modules/ms/index.js"(exports, module) {
    var s = 1e3;
    var m = s * 60;
    var h = m * 60;
    var d = h * 24;
    var w = d * 7;
    var y = d * 365.25;
    module.exports = function(val, options) {
      options = options || {};
      var type = typeof val;
      if (type === "string" && val.length > 0) {
        return parse(val);
      } else if (type === "number" && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
      }
      throw new Error(
        "val is not a non-empty string or a valid number. val=" + JSON.stringify(val)
      );
    };
    function parse(str) {
      str = String(str);
      if (str.length > 100) {
        return;
      }
      var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
        str
      );
      if (!match) {
        return;
      }
      var n = parseFloat(match[1]);
      var type = (match[2] || "ms").toLowerCase();
      switch (type) {
        case "years":
        case "year":
        case "yrs":
        case "yr":
        case "y":
          return n * y;
        case "weeks":
        case "week":
        case "w":
          return n * w;
        case "days":
        case "day":
        case "d":
          return n * d;
        case "hours":
        case "hour":
        case "hrs":
        case "hr":
        case "h":
          return n * h;
        case "minutes":
        case "minute":
        case "mins":
        case "min":
        case "m":
          return n * m;
        case "seconds":
        case "second":
        case "secs":
        case "sec":
        case "s":
          return n * s;
        case "milliseconds":
        case "millisecond":
        case "msecs":
        case "msec":
        case "ms":
          return n;
        default:
          return void 0;
      }
    }
    function fmtShort(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return Math.round(ms / d) + "d";
      }
      if (msAbs >= h) {
        return Math.round(ms / h) + "h";
      }
      if (msAbs >= m) {
        return Math.round(ms / m) + "m";
      }
      if (msAbs >= s) {
        return Math.round(ms / s) + "s";
      }
      return ms + "ms";
    }
    function fmtLong(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return plural(ms, msAbs, d, "day");
      }
      if (msAbs >= h) {
        return plural(ms, msAbs, h, "hour");
      }
      if (msAbs >= m) {
        return plural(ms, msAbs, m, "minute");
      }
      if (msAbs >= s) {
        return plural(ms, msAbs, s, "second");
      }
      return ms + " ms";
    }
    function plural(ms, msAbs, n, name2) {
      var isPlural = msAbs >= n * 1.5;
      return Math.round(ms / n) + " " + name2 + (isPlural ? "s" : "");
    }
  }
});

// node_modules/debug/src/common.js
var require_common = __commonJS({
  "node_modules/debug/src/common.js"(exports, module) {
    function setup(env) {
      createDebug4.debug = createDebug4;
      createDebug4.default = createDebug4;
      createDebug4.coerce = coerce;
      createDebug4.disable = disable;
      createDebug4.enable = enable;
      createDebug4.enabled = enabled;
      createDebug4.humanize = require_ms();
      createDebug4.destroy = destroy;
      Object.keys(env).forEach((key) => {
        createDebug4[key] = env[key];
      });
      createDebug4.names = [];
      createDebug4.skips = [];
      createDebug4.formatters = {};
      function selectColor(namespace) {
        let hash = 0;
        for (let i = 0; i < namespace.length; i++) {
          hash = (hash << 5) - hash + namespace.charCodeAt(i);
          hash |= 0;
        }
        return createDebug4.colors[Math.abs(hash) % createDebug4.colors.length];
      }
      createDebug4.selectColor = selectColor;
      function createDebug4(namespace) {
        let prevTime;
        let enableOverride = null;
        let namespacesCache;
        let enabledCache;
        function debug4(...args) {
          if (!debug4.enabled) {
            return;
          }
          const self = debug4;
          const curr = Number(/* @__PURE__ */ new Date());
          const ms = curr - (prevTime || curr);
          self.diff = ms;
          self.prev = prevTime;
          self.curr = curr;
          prevTime = curr;
          args[0] = createDebug4.coerce(args[0]);
          if (typeof args[0] !== "string") {
            args.unshift("%O");
          }
          let index = 0;
          args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
            if (match === "%%") {
              return "%";
            }
            index++;
            const formatter = createDebug4.formatters[format];
            if (typeof formatter === "function") {
              const val = args[index];
              match = formatter.call(self, val);
              args.splice(index, 1);
              index--;
            }
            return match;
          });
          createDebug4.formatArgs.call(self, args);
          const logFn = self.log || createDebug4.log;
          logFn.apply(self, args);
        }
        debug4.namespace = namespace;
        debug4.useColors = createDebug4.useColors();
        debug4.color = createDebug4.selectColor(namespace);
        debug4.extend = extend2;
        debug4.destroy = createDebug4.destroy;
        Object.defineProperty(debug4, "enabled", {
          enumerable: true,
          configurable: false,
          get: () => {
            if (enableOverride !== null) {
              return enableOverride;
            }
            if (namespacesCache !== createDebug4.namespaces) {
              namespacesCache = createDebug4.namespaces;
              enabledCache = createDebug4.enabled(namespace);
            }
            return enabledCache;
          },
          set: (v) => {
            enableOverride = v;
          }
        });
        if (typeof createDebug4.init === "function") {
          createDebug4.init(debug4);
        }
        return debug4;
      }
      function extend2(namespace, delimiter2) {
        const newDebug = createDebug4(this.namespace + (typeof delimiter2 === "undefined" ? ":" : delimiter2) + namespace);
        newDebug.log = this.log;
        return newDebug;
      }
      function enable(namespaces) {
        createDebug4.save(namespaces);
        createDebug4.namespaces = namespaces;
        createDebug4.names = [];
        createDebug4.skips = [];
        const split = (typeof namespaces === "string" ? namespaces : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
        for (const ns of split) {
          if (ns[0] === "-") {
            createDebug4.skips.push(ns.slice(1));
          } else {
            createDebug4.names.push(ns);
          }
        }
      }
      function matchesTemplate(search, template) {
        let searchIndex = 0;
        let templateIndex = 0;
        let starIndex = -1;
        let matchIndex = 0;
        while (searchIndex < search.length) {
          if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === "*")) {
            if (template[templateIndex] === "*") {
              starIndex = templateIndex;
              matchIndex = searchIndex;
              templateIndex++;
            } else {
              searchIndex++;
              templateIndex++;
            }
          } else if (starIndex !== -1) {
            templateIndex = starIndex + 1;
            matchIndex++;
            searchIndex = matchIndex;
          } else {
            return false;
          }
        }
        while (templateIndex < template.length && template[templateIndex] === "*") {
          templateIndex++;
        }
        return templateIndex === template.length;
      }
      function disable() {
        const namespaces = [
          ...createDebug4.names,
          ...createDebug4.skips.map((namespace) => "-" + namespace)
        ].join(",");
        createDebug4.enable("");
        return namespaces;
      }
      function enabled(name2) {
        for (const skip of createDebug4.skips) {
          if (matchesTemplate(name2, skip)) {
            return false;
          }
        }
        for (const ns of createDebug4.names) {
          if (matchesTemplate(name2, ns)) {
            return true;
          }
        }
        return false;
      }
      function coerce(val) {
        if (val instanceof Error) {
          return val.stack || val.message;
        }
        return val;
      }
      function destroy() {
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
      }
      createDebug4.enable(createDebug4.load());
      return createDebug4;
    }
    module.exports = setup;
  }
});

// node_modules/debug/src/browser.js
var require_browser = __commonJS({
  "node_modules/debug/src/browser.js"(exports, module) {
    exports.formatArgs = formatArgs2;
    exports.save = save;
    exports.load = load;
    exports.useColors = useColors;
    exports.storage = localstorage();
    exports.destroy = /* @__PURE__ */ (() => {
      let warned = false;
      return () => {
        if (!warned) {
          warned = true;
          console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
        }
      };
    })();
    exports.colors = [
      "#0000CC",
      "#0000FF",
      "#0033CC",
      "#0033FF",
      "#0066CC",
      "#0066FF",
      "#0099CC",
      "#0099FF",
      "#00CC00",
      "#00CC33",
      "#00CC66",
      "#00CC99",
      "#00CCCC",
      "#00CCFF",
      "#3300CC",
      "#3300FF",
      "#3333CC",
      "#3333FF",
      "#3366CC",
      "#3366FF",
      "#3399CC",
      "#3399FF",
      "#33CC00",
      "#33CC33",
      "#33CC66",
      "#33CC99",
      "#33CCCC",
      "#33CCFF",
      "#6600CC",
      "#6600FF",
      "#6633CC",
      "#6633FF",
      "#66CC00",
      "#66CC33",
      "#9900CC",
      "#9900FF",
      "#9933CC",
      "#9933FF",
      "#99CC00",
      "#99CC33",
      "#CC0000",
      "#CC0033",
      "#CC0066",
      "#CC0099",
      "#CC00CC",
      "#CC00FF",
      "#CC3300",
      "#CC3333",
      "#CC3366",
      "#CC3399",
      "#CC33CC",
      "#CC33FF",
      "#CC6600",
      "#CC6633",
      "#CC9900",
      "#CC9933",
      "#CCCC00",
      "#CCCC33",
      "#FF0000",
      "#FF0033",
      "#FF0066",
      "#FF0099",
      "#FF00CC",
      "#FF00FF",
      "#FF3300",
      "#FF3333",
      "#FF3366",
      "#FF3399",
      "#FF33CC",
      "#FF33FF",
      "#FF6600",
      "#FF6633",
      "#FF9900",
      "#FF9933",
      "#FFCC00",
      "#FFCC33"
    ];
    function useColors() {
      if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
        return true;
      }
      if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
        return false;
      }
      let m;
      return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // Is firebug? http://stackoverflow.com/a/398120/376773
      typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // Is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || // Double check webkit in userAgent just in case we are in a worker
      typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
    }
    function formatArgs2(args) {
      args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module.exports.humanize(this.diff);
      if (!this.useColors) {
        return;
      }
      const c = "color: " + this.color;
      args.splice(1, 0, c, "color: inherit");
      let index = 0;
      let lastC = 0;
      args[0].replace(/%[a-zA-Z%]/g, (match) => {
        if (match === "%%") {
          return;
        }
        index++;
        if (match === "%c") {
          lastC = index;
        }
      });
      args.splice(lastC, 0, c);
    }
    exports.log = console.debug || console.log || (() => {
    });
    function save(namespaces) {
      try {
        if (namespaces) {
          exports.storage.setItem("debug", namespaces);
        } else {
          exports.storage.removeItem("debug");
        }
      } catch (error) {
      }
    }
    function load() {
      let r;
      try {
        r = exports.storage.getItem("debug") || exports.storage.getItem("DEBUG");
      } catch (error) {
      }
      if (!r && typeof process !== "undefined" && "env" in process) {
        r = process.env.DEBUG;
      }
      return r;
    }
    function localstorage() {
      try {
        return localStorage;
      } catch (error) {
      }
    }
    module.exports = require_common()(exports);
    var { formatters: formatters2 } = module.exports;
    formatters2.j = function(v) {
      try {
        return JSON.stringify(v);
      } catch (error) {
        return "[UnexpectedJSONParseError]: " + error.message;
      }
    };
  }
});

// node_modules/debug/src/node.js
var require_node = __commonJS({
  "node_modules/debug/src/node.js"(exports, module) {
    var tty = __require("tty");
    var util = __require("util");
    exports.init = init;
    exports.log = log;
    exports.formatArgs = formatArgs2;
    exports.save = save;
    exports.load = load;
    exports.useColors = useColors;
    exports.destroy = util.deprecate(
      () => {
      },
      "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."
    );
    exports.colors = [6, 2, 3, 4, 5, 1];
    try {
      const supportsColor = __require("supports-color");
      if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
        exports.colors = [
          20,
          21,
          26,
          27,
          32,
          33,
          38,
          39,
          40,
          41,
          42,
          43,
          44,
          45,
          56,
          57,
          62,
          63,
          68,
          69,
          74,
          75,
          76,
          77,
          78,
          79,
          80,
          81,
          92,
          93,
          98,
          99,
          112,
          113,
          128,
          129,
          134,
          135,
          148,
          149,
          160,
          161,
          162,
          163,
          164,
          165,
          166,
          167,
          168,
          169,
          170,
          171,
          172,
          173,
          178,
          179,
          184,
          185,
          196,
          197,
          198,
          199,
          200,
          201,
          202,
          203,
          204,
          205,
          206,
          207,
          208,
          209,
          214,
          215,
          220,
          221
        ];
      }
    } catch (error) {
    }
    exports.inspectOpts = Object.keys(process.env).filter((key) => {
      return /^debug_/i.test(key);
    }).reduce((obj, key) => {
      const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k) => {
        return k.toUpperCase();
      });
      let val = process.env[key];
      if (/^(yes|on|true|enabled)$/i.test(val)) {
        val = true;
      } else if (/^(no|off|false|disabled)$/i.test(val)) {
        val = false;
      } else if (val === "null") {
        val = null;
      } else {
        val = Number(val);
      }
      obj[prop] = val;
      return obj;
    }, {});
    function useColors() {
      return "colors" in exports.inspectOpts ? Boolean(exports.inspectOpts.colors) : tty.isatty(process.stderr.fd);
    }
    function formatArgs2(args) {
      const { namespace: name2, useColors: useColors2 } = this;
      if (useColors2) {
        const c = this.color;
        const colorCode = "\x1B[3" + (c < 8 ? c : "8;5;" + c);
        const prefix = `  ${colorCode};1m${name2} \x1B[0m`;
        args[0] = prefix + args[0].split("\n").join("\n" + prefix);
        args.push(colorCode + "m+" + module.exports.humanize(this.diff) + "\x1B[0m");
      } else {
        args[0] = getDate() + name2 + " " + args[0];
      }
    }
    function getDate() {
      if (exports.inspectOpts.hideDate) {
        return "";
      }
      return (/* @__PURE__ */ new Date()).toISOString() + " ";
    }
    function log(...args) {
      return process.stderr.write(util.formatWithOptions(exports.inspectOpts, ...args) + "\n");
    }
    function save(namespaces) {
      if (namespaces) {
        process.env.DEBUG = namespaces;
      } else {
        delete process.env.DEBUG;
      }
    }
    function load() {
      return process.env.DEBUG;
    }
    function init(debug4) {
      debug4.inspectOpts = {};
      const keys = Object.keys(exports.inspectOpts);
      for (let i = 0; i < keys.length; i++) {
        debug4.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
      }
    }
    module.exports = require_common()(exports);
    var { formatters: formatters2 } = module.exports;
    formatters2.o = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts).split("\n").map((str) => str.trim()).join(" ");
    };
    formatters2.O = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts);
    };
  }
});

// node_modules/debug/src/index.js
var require_src = __commonJS({
  "node_modules/debug/src/index.js"(exports, module) {
    if (typeof process === "undefined" || process.type === "renderer" || process.browser === true || process.__nwjs) {
      module.exports = require_browser();
    } else {
      module.exports = require_node();
    }
  }
});

// node_modules/smart-buffer/build/utils.js
var require_utils = __commonJS({
  "node_modules/smart-buffer/build/utils.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var buffer_1 = __require("buffer");
    var ERRORS = {
      INVALID_ENCODING: "Invalid encoding provided. Please specify a valid encoding the internal Node.js Buffer supports.",
      INVALID_SMARTBUFFER_SIZE: "Invalid size provided. Size must be a valid integer greater than zero.",
      INVALID_SMARTBUFFER_BUFFER: "Invalid Buffer provided in SmartBufferOptions.",
      INVALID_SMARTBUFFER_OBJECT: "Invalid SmartBufferOptions object supplied to SmartBuffer constructor or factory methods.",
      INVALID_OFFSET: "An invalid offset value was provided.",
      INVALID_OFFSET_NON_NUMBER: "An invalid offset value was provided. A numeric value is required.",
      INVALID_LENGTH: "An invalid length value was provided.",
      INVALID_LENGTH_NON_NUMBER: "An invalid length value was provived. A numeric value is required.",
      INVALID_TARGET_OFFSET: "Target offset is beyond the bounds of the internal SmartBuffer data.",
      INVALID_TARGET_LENGTH: "Specified length value moves cursor beyong the bounds of the internal SmartBuffer data.",
      INVALID_READ_BEYOND_BOUNDS: "Attempted to read beyond the bounds of the managed data.",
      INVALID_WRITE_BEYOND_BOUNDS: "Attempted to write beyond the bounds of the managed data."
    };
    exports.ERRORS = ERRORS;
    function checkEncoding(encoding) {
      if (!buffer_1.Buffer.isEncoding(encoding)) {
        throw new Error(ERRORS.INVALID_ENCODING);
      }
    }
    exports.checkEncoding = checkEncoding;
    function isFiniteInteger(value) {
      return typeof value === "number" && isFinite(value) && isInteger(value);
    }
    exports.isFiniteInteger = isFiniteInteger;
    function checkOffsetOrLengthValue(value, offset) {
      if (typeof value === "number") {
        if (!isFiniteInteger(value) || value < 0) {
          throw new Error(offset ? ERRORS.INVALID_OFFSET : ERRORS.INVALID_LENGTH);
        }
      } else {
        throw new Error(offset ? ERRORS.INVALID_OFFSET_NON_NUMBER : ERRORS.INVALID_LENGTH_NON_NUMBER);
      }
    }
    function checkLengthValue(length) {
      checkOffsetOrLengthValue(length, false);
    }
    exports.checkLengthValue = checkLengthValue;
    function checkOffsetValue(offset) {
      checkOffsetOrLengthValue(offset, true);
    }
    exports.checkOffsetValue = checkOffsetValue;
    function checkTargetOffset(offset, buff) {
      if (offset < 0 || offset > buff.length) {
        throw new Error(ERRORS.INVALID_TARGET_OFFSET);
      }
    }
    exports.checkTargetOffset = checkTargetOffset;
    function isInteger(value) {
      return typeof value === "number" && isFinite(value) && Math.floor(value) === value;
    }
    function bigIntAndBufferInt64Check(bufferMethod) {
      if (typeof BigInt === "undefined") {
        throw new Error("Platform does not support JS BigInt type.");
      }
      if (typeof buffer_1.Buffer.prototype[bufferMethod] === "undefined") {
        throw new Error(`Platform does not support Buffer.prototype.${bufferMethod}.`);
      }
    }
    exports.bigIntAndBufferInt64Check = bigIntAndBufferInt64Check;
  }
});

// node_modules/smart-buffer/build/smartbuffer.js
var require_smartbuffer = __commonJS({
  "node_modules/smart-buffer/build/smartbuffer.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var utils_1 = require_utils();
    var DEFAULT_SMARTBUFFER_SIZE = 4096;
    var DEFAULT_SMARTBUFFER_ENCODING = "utf8";
    var SmartBuffer = class _SmartBuffer {
      /**
       * Creates a new SmartBuffer instance.
       *
       * @param options { SmartBufferOptions } The SmartBufferOptions to apply to this instance.
       */
      constructor(options) {
        this.length = 0;
        this._encoding = DEFAULT_SMARTBUFFER_ENCODING;
        this._writeOffset = 0;
        this._readOffset = 0;
        if (_SmartBuffer.isSmartBufferOptions(options)) {
          if (options.encoding) {
            utils_1.checkEncoding(options.encoding);
            this._encoding = options.encoding;
          }
          if (options.size) {
            if (utils_1.isFiniteInteger(options.size) && options.size > 0) {
              this._buff = Buffer.allocUnsafe(options.size);
            } else {
              throw new Error(utils_1.ERRORS.INVALID_SMARTBUFFER_SIZE);
            }
          } else if (options.buff) {
            if (Buffer.isBuffer(options.buff)) {
              this._buff = options.buff;
              this.length = options.buff.length;
            } else {
              throw new Error(utils_1.ERRORS.INVALID_SMARTBUFFER_BUFFER);
            }
          } else {
            this._buff = Buffer.allocUnsafe(DEFAULT_SMARTBUFFER_SIZE);
          }
        } else {
          if (typeof options !== "undefined") {
            throw new Error(utils_1.ERRORS.INVALID_SMARTBUFFER_OBJECT);
          }
          this._buff = Buffer.allocUnsafe(DEFAULT_SMARTBUFFER_SIZE);
        }
      }
      /**
       * Creates a new SmartBuffer instance with the provided internal Buffer size and optional encoding.
       *
       * @param size { Number } The size of the internal Buffer.
       * @param encoding { String } The BufferEncoding to use for strings.
       *
       * @return { SmartBuffer }
       */
      static fromSize(size, encoding) {
        return new this({
          size,
          encoding
        });
      }
      /**
       * Creates a new SmartBuffer instance with the provided Buffer and optional encoding.
       *
       * @param buffer { Buffer } The Buffer to use as the internal Buffer value.
       * @param encoding { String } The BufferEncoding to use for strings.
       *
       * @return { SmartBuffer }
       */
      static fromBuffer(buff, encoding) {
        return new this({
          buff,
          encoding
        });
      }
      /**
       * Creates a new SmartBuffer instance with the provided SmartBufferOptions options.
       *
       * @param options { SmartBufferOptions } The options to use when creating the SmartBuffer instance.
       */
      static fromOptions(options) {
        return new this(options);
      }
      /**
       * Type checking function that determines if an object is a SmartBufferOptions object.
       */
      static isSmartBufferOptions(options) {
        const castOptions = options;
        return castOptions && (castOptions.encoding !== void 0 || castOptions.size !== void 0 || castOptions.buff !== void 0);
      }
      // Signed integers
      /**
       * Reads an Int8 value from the current read position or an optionally provided offset.
       *
       * @param offset { Number } The offset to read data from (optional)
       * @return { Number }
       */
      readInt8(offset) {
        return this._readNumberValue(Buffer.prototype.readInt8, 1, offset);
      }
      /**
       * Reads an Int16BE value from the current read position or an optionally provided offset.
       *
       * @param offset { Number } The offset to read data from (optional)
       * @return { Number }
       */
      readInt16BE(offset) {
        return this._readNumberValue(Buffer.prototype.readInt16BE, 2, offset);
      }
      /**
       * Reads an Int16LE value from the current read position or an optionally provided offset.
       *
       * @param offset { Number } The offset to read data from (optional)
       * @return { Number }
       */
      readInt16LE(offset) {
        return this._readNumberValue(Buffer.prototype.readInt16LE, 2, offset);
      }
      /**
       * Reads an Int32BE value from the current read position or an optionally provided offset.
       *
       * @param offset { Number } The offset to read data from (optional)
       * @return { Number }
       */
      readInt32BE(offset) {
        return this._readNumberValue(Buffer.prototype.readInt32BE, 4, offset);
      }
      /**
       * Reads an Int32LE value from the current read position or an optionally provided offset.
       *
       * @param offset { Number } The offset to read data from (optional)
       * @return { Number }
       */
      readInt32LE(offset) {
        return this._readNumberValue(Buffer.prototype.readInt32LE, 4, offset);
      }
      /**
       * Reads a BigInt64BE value from the current read position or an optionally provided offset.
       *
       * @param offset { Number } The offset to read data from (optional)
       * @return { BigInt }
       */
      readBigInt64BE(offset) {
        utils_1.bigIntAndBufferInt64Check("readBigInt64BE");
        return this._readNumberValue(Buffer.prototype.readBigInt64BE, 8, offset);
      }
      /**
       * Reads a BigInt64LE value from the current read position or an optionally provided offset.
       *
       * @param offset { Number } The offset to read data from (optional)
       * @return { BigInt }
       */
      readBigInt64LE(offset) {
        utils_1.bigIntAndBufferInt64Check("readBigInt64LE");
        return this._readNumberValue(Buffer.prototype.readBigInt64LE, 8, offset);
      }
      /**
       * Writes an Int8 value to the current write position (or at optional offset).
       *
       * @param value { Number } The value to write.
       * @param offset { Number } The offset to write the value at.
       *
       * @return this
       */
      writeInt8(value, offset) {
        this._writeNumberValue(Buffer.prototype.writeInt8, 1, value, offset);
        return this;
      }
      /**
       * Inserts an Int8 value at the given offset value.
       *
       * @param value { Number } The value to insert.
       * @param offset { Number } The offset to insert the value at.
       *
       * @return this
       */
      insertInt8(value, offset) {
        return this._insertNumberValue(Buffer.prototype.writeInt8, 1, value, offset);
      }
      /**
       * Writes an Int16BE value to the current write position (or at optional offset).
       *
       * @param value { Number } The value to write.
       * @param offset { Number } The offset to write the value at.
       *
       * @return this
       */
      writeInt16BE(value, offset) {
        return this._writeNumberValue(Buffer.prototype.writeInt16BE, 2, value, offset);
      }
      /**
       * Inserts an Int16BE value at the given offset value.
       *
       * @param value { Number } The value to insert.
       * @param offset { Number } The offset to insert the value at.
       *
       * @return this
       */
      insertInt16BE(value, offset) {
        return this._insertNumberValue(Buffer.prototype.writeInt16BE, 2, value, offset);
      }
      /**
       * Writes an Int16LE value to the current write position (or at optional offset).
       *
       * @param value { Number } The value to write.
       * @param offset { Number } The offset to write the value at.
       *
       * @return this
       */
      writeInt16LE(value, offset) {
        return this._writeNumberValue(Buffer.prototype.writeInt16LE, 2, value, offset);
      }
      /**
       * Inserts an Int16LE value at the given offset value.
       *
       * @param value { Number } The value to insert.
       * @param offset { Number } The offset to insert the value at.
       *
       * @return this
       */
      insertInt16LE(value, offset) {
        return this._insertNumberValue(Buffer.prototype.writeInt16LE, 2, value, offset);
      }
      /**
       * Writes an Int32BE value to the current write position (or at optional offset).
       *
       * @param value { Number } The value to write.
       * @param offset { Number } The offset to write the value at.
       *
       * @return this
       */
      writeInt32BE(value, offset) {
        return this._writeNumberValue(Buffer.prototype.writeInt32BE, 4, value, offset);
      }
      /**
       * Inserts an Int32BE value at the given offset value.
       *
       * @param value { Number } The value to insert.
       * @param offset { Number } The offset to insert the value at.
       *
       * @return this
       */
      insertInt32BE(value, offset) {
        return this._insertNumberValue(Buffer.prototype.writeInt32BE, 4, value, offset);
      }
      /**
       * Writes an Int32LE value to the current write position (or at optional offset).
       *
       * @param value { Number } The value to write.
       * @param offset { Number } The offset to write the value at.
       *
       * @return this
       */
      writeInt32LE(value, offset) {
        return this._writeNumberValue(Buffer.prototype.writeInt32LE, 4, value, offset);
      }
      /**
       * Inserts an Int32LE value at the given offset value.
       *
       * @param value { Number } The value to insert.
       * @param offset { Number } The offset to insert the value at.
       *
       * @return this
       */
      insertInt32LE(value, offset) {
        return this._insertNumberValue(Buffer.prototype.writeInt32LE, 4, value, offset);
      }
      /**
       * Writes a BigInt64BE value to the current write position (or at optional offset).
       *
       * @param value { BigInt } The value to write.
       * @param offset { Number } The offset to write the value at.
       *
       * @return this
       */
      writeBigInt64BE(value, offset) {
        utils_1.bigIntAndBufferInt64Check("writeBigInt64BE");
        return this._writeNumberValue(Buffer.prototype.writeBigInt64BE, 8, value, offset);
      }
      /**
       * Inserts a BigInt64BE value at the given offset value.
       *
       * @param value { BigInt } The value to insert.
       * @param offset { Number } The offset to insert the value at.
       *
       * @return this
       */
      insertBigInt64BE(value, offset) {
        utils_1.bigIntAndBufferInt64Check("writeBigInt64BE");
        return this._insertNumberValue(Buffer.prototype.writeBigInt64BE, 8, value, offset);
      }
      /**
       * Writes a BigInt64LE value to the current write position (or at optional offset).
       *
       * @param value { BigInt } The value to write.
       * @param offset { Number } The offset to write the value at.
       *
       * @return this
       */
      writeBigInt64LE(value, offset) {
        utils_1.bigIntAndBufferInt64Check("writeBigInt64LE");
        return this._writeNumberValue(Buffer.prototype.writeBigInt64LE, 8, value, offset);
      }
      /**
       * Inserts a Int64LE value at the given offset value.
       *
       * @param value { BigInt } The value to insert.
       * @param offset { Number } The offset to insert the value at.
       *
       * @return this
       */
      insertBigInt64LE(value, offset) {
        utils_1.bigIntAndBufferInt64Check("writeBigInt64LE");
        return this._insertNumberValue(Buffer.prototype.writeBigInt64LE, 8, value, offset);
      }
      // Unsigned Integers
      /**
       * Reads an UInt8 value from the current read position or an optionally provided offset.
       *
       * @param offset { Number } The offset to read data from (optional)
       * @return { Number }
       */
      readUInt8(offset) {
        return this._readNumberValue(Buffer.prototype.readUInt8, 1, offset);
      }
      /**
       * Reads an UInt16BE value from the current read position or an optionally provided offset.
       *
       * @param offset { Number } The offset to read data from (optional)
       * @return { Number }
       */
      readUInt16BE(offset) {
        return this._readNumberValue(Buffer.prototype.readUInt16BE, 2, offset);
      }
      /**
       * Reads an UInt16LE value from the current read position or an optionally provided offset.
       *
       * @param offset { Number } The offset to read data from (optional)
       * @return { Number }
       */
      readUInt16LE(offset) {
        return this._readNumberValue(Buffer.prototype.readUInt16LE, 2, offset);
      }
      /**
       * Reads an UInt32BE value from the current read position or an optionally provided offset.
       *
       * @param offset { Number } The offset to read data from (optional)
       * @return { Number }
       */
      readUInt32BE(offset) {
        return this._readNumberValue(Buffer.prototype.readUInt32BE, 4, offset);
      }
      /**
       * Reads an UInt32LE value from the current read position or an optionally provided offset.
       *
       * @param offset { Number } The offset to read data from (optional)
       * @return { Number }
       */
      readUInt32LE(offset) {
        return this._readNumberValue(Buffer.prototype.readUInt32LE, 4, offset);
      }
      /**
       * Reads a BigUInt64BE value from the current read position or an optionally provided offset.
       *
       * @param offset { Number } The offset to read data from (optional)
       * @return { BigInt }
       */
      readBigUInt64BE(offset) {
        utils_1.bigIntAndBufferInt64Check("readBigUInt64BE");
        return this._readNumberValue(Buffer.prototype.readBigUInt64BE, 8, offset);
      }
      /**
       * Reads a BigUInt64LE value from the current read position or an optionally provided offset.
       *
       * @param offset { Number } The offset to read data from (optional)
       * @return { BigInt }
       */
      readBigUInt64LE(offset) {
        utils_1.bigIntAndBufferInt64Check("readBigUInt64LE");
        return this._readNumberValue(Buffer.prototype.readBigUInt64LE, 8, offset);
      }
      /**
       * Writes an UInt8 value to the current write position (or at optional offset).
       *
       * @param value { Number } The value to write.
       * @param offset { Number } The offset to write the value at.
       *
       * @return this
       */
      writeUInt8(value, offset) {
        return this._writeNumberValue(Buffer.prototype.writeUInt8, 1, value, offset);
      }
      /**
       * Inserts an UInt8 value at the given offset value.
       *
       * @param value { Number } The value to insert.
       * @param offset { Number } The offset to insert the value at.
       *
       * @return this
       */
      insertUInt8(value, offset) {
        return this._insertNumberValue(Buffer.prototype.writeUInt8, 1, value, offset);
      }
      /**
       * Writes an UInt16BE value to the current write position (or at optional offset).
       *
       * @param value { Number } The value to write.
       * @param offset { Number } The offset to write the value at.
       *
       * @return this
       */
      writeUInt16BE(value, offset) {
        return this._writeNumberValue(Buffer.prototype.writeUInt16BE, 2, value, offset);
      }
      /**
       * Inserts an UInt16BE value at the given offset value.
       *
       * @param value { Number } The value to insert.
       * @param offset { Number } The offset to insert the value at.
       *
       * @return this
       */
      insertUInt16BE(value, offset) {
        return this._insertNumberValue(Buffer.prototype.writeUInt16BE, 2, value, offset);
      }
      /**
       * Writes an UInt16LE value to the current write position (or at optional offset).
       *
       * @param value { Number } The value to write.
       * @param offset { Number } The offset to write the value at.
       *
       * @return this
       */
      writeUInt16LE(value, offset) {
        return this._writeNumberValue(Buffer.prototype.writeUInt16LE, 2, value, offset);
      }
      /**
       * Inserts an UInt16LE value at the given offset value.
       *
       * @param value { Number } The value to insert.
       * @param offset { Number } The offset to insert the value at.
       *
       * @return this
       */
      insertUInt16LE(value, offset) {
        return this._insertNumberValue(Buffer.prototype.writeUInt16LE, 2, value, offset);
      }
      /**
       * Writes an UInt32BE value to the current write position (or at optional offset).
       *
       * @param value { Number } The value to write.
       * @param offset { Number } The offset to write the value at.
       *
       * @return this
       */
      writeUInt32BE(value, offset) {
        return this._writeNumberValue(Buffer.prototype.writeUInt32BE, 4, value, offset);
      }
      /**
       * Inserts an UInt32BE value at the given offset value.
       *
       * @param value { Number } The value to insert.
       * @param offset { Number } The offset to insert the value at.
       *
       * @return this
       */
      insertUInt32BE(value, offset) {
        return this._insertNumberValue(Buffer.prototype.writeUInt32BE, 4, value, offset);
      }
      /**
       * Writes an UInt32LE value to the current write position (or at optional offset).
       *
       * @param value { Number } The value to write.
       * @param offset { Number } The offset to write the value at.
       *
       * @return this
       */
      writeUInt32LE(value, offset) {
        return this._writeNumberValue(Buffer.prototype.writeUInt32LE, 4, value, offset);
      }
      /**
       * Inserts an UInt32LE value at the given offset value.
       *
       * @param value { Number } The value to insert.
       * @param offset { Number } The offset to insert the value at.
       *
       * @return this
       */
      insertUInt32LE(value, offset) {
        return this._insertNumberValue(Buffer.prototype.writeUInt32LE, 4, value, offset);
      }
      /**
       * Writes a BigUInt64BE value to the current write position (or at optional offset).
       *
       * @param value { Number } The value to write.
       * @param offset { Number } The offset to write the value at.
       *
       * @return this
       */
      writeBigUInt64BE(value, offset) {
        utils_1.bigIntAndBufferInt64Check("writeBigUInt64BE");
        return this._writeNumberValue(Buffer.prototype.writeBigUInt64BE, 8, value, offset);
      }
      /**
       * Inserts a BigUInt64BE value at the given offset value.
       *
       * @param value { Number } The value to insert.
       * @param offset { Number } The offset to insert the value at.
       *
       * @return this
       */
      insertBigUInt64BE(value, offset) {
        utils_1.bigIntAndBufferInt64Check("writeBigUInt64BE");
        return this._insertNumberValue(Buffer.prototype.writeBigUInt64BE, 8, value, offset);
      }
      /**
       * Writes a BigUInt64LE value to the current write position (or at optional offset).
       *
       * @param value { Number } The value to write.
       * @param offset { Number } The offset to write the value at.
       *
       * @return this
       */
      writeBigUInt64LE(value, offset) {
        utils_1.bigIntAndBufferInt64Check("writeBigUInt64LE");
        return this._writeNumberValue(Buffer.prototype.writeBigUInt64LE, 8, value, offset);
      }
      /**
       * Inserts a BigUInt64LE value at the given offset value.
       *
       * @param value { Number } The value to insert.
       * @param offset { Number } The offset to insert the value at.
       *
       * @return this
       */
      insertBigUInt64LE(value, offset) {
        utils_1.bigIntAndBufferInt64Check("writeBigUInt64LE");
        return this._insertNumberValue(Buffer.prototype.writeBigUInt64LE, 8, value, offset);
      }
      // Floating Point
      /**
       * Reads an FloatBE value from the current read position or an optionally provided offset.
       *
       * @param offset { Number } The offset to read data from (optional)
       * @return { Number }
       */
      readFloatBE(offset) {
        return this._readNumberValue(Buffer.prototype.readFloatBE, 4, offset);
      }
      /**
       * Reads an FloatLE value from the current read position or an optionally provided offset.
       *
       * @param offset { Number } The offset to read data from (optional)
       * @return { Number }
       */
      readFloatLE(offset) {
        return this._readNumberValue(Buffer.prototype.readFloatLE, 4, offset);
      }
      /**
       * Writes a FloatBE value to the current write position (or at optional offset).
       *
       * @param value { Number } The value to write.
       * @param offset { Number } The offset to write the value at.
       *
       * @return this
       */
      writeFloatBE(value, offset) {
        return this._writeNumberValue(Buffer.prototype.writeFloatBE, 4, value, offset);
      }
      /**
       * Inserts a FloatBE value at the given offset value.
       *
       * @param value { Number } The value to insert.
       * @param offset { Number } The offset to insert the value at.
       *
       * @return this
       */
      insertFloatBE(value, offset) {
        return this._insertNumberValue(Buffer.prototype.writeFloatBE, 4, value, offset);
      }
      /**
       * Writes a FloatLE value to the current write position (or at optional offset).
       *
       * @param value { Number } The value to write.
       * @param offset { Number } The offset to write the value at.
       *
       * @return this
       */
      writeFloatLE(value, offset) {
        return this._writeNumberValue(Buffer.prototype.writeFloatLE, 4, value, offset);
      }
      /**
       * Inserts a FloatLE value at the given offset value.
       *
       * @param value { Number } The value to insert.
       * @param offset { Number } The offset to insert the value at.
       *
       * @return this
       */
      insertFloatLE(value, offset) {
        return this._insertNumberValue(Buffer.prototype.writeFloatLE, 4, value, offset);
      }
      // Double Floating Point
      /**
       * Reads an DoublEBE value from the current read position or an optionally provided offset.
       *
       * @param offset { Number } The offset to read data from (optional)
       * @return { Number }
       */
      readDoubleBE(offset) {
        return this._readNumberValue(Buffer.prototype.readDoubleBE, 8, offset);
      }
      /**
       * Reads an DoubleLE value from the current read position or an optionally provided offset.
       *
       * @param offset { Number } The offset to read data from (optional)
       * @return { Number }
       */
      readDoubleLE(offset) {
        return this._readNumberValue(Buffer.prototype.readDoubleLE, 8, offset);
      }
      /**
       * Writes a DoubleBE value to the current write position (or at optional offset).
       *
       * @param value { Number } The value to write.
       * @param offset { Number } The offset to write the value at.
       *
       * @return this
       */
      writeDoubleBE(value, offset) {
        return this._writeNumberValue(Buffer.prototype.writeDoubleBE, 8, value, offset);
      }
      /**
       * Inserts a DoubleBE value at the given offset value.
       *
       * @param value { Number } The value to insert.
       * @param offset { Number } The offset to insert the value at.
       *
       * @return this
       */
      insertDoubleBE(value, offset) {
        return this._insertNumberValue(Buffer.prototype.writeDoubleBE, 8, value, offset);
      }
      /**
       * Writes a DoubleLE value to the current write position (or at optional offset).
       *
       * @param value { Number } The value to write.
       * @param offset { Number } The offset to write the value at.
       *
       * @return this
       */
      writeDoubleLE(value, offset) {
        return this._writeNumberValue(Buffer.prototype.writeDoubleLE, 8, value, offset);
      }
      /**
       * Inserts a DoubleLE value at the given offset value.
       *
       * @param value { Number } The value to insert.
       * @param offset { Number } The offset to insert the value at.
       *
       * @return this
       */
      insertDoubleLE(value, offset) {
        return this._insertNumberValue(Buffer.prototype.writeDoubleLE, 8, value, offset);
      }
      // Strings
      /**
       * Reads a String from the current read position.
       *
       * @param arg1 { Number | String } The number of bytes to read as a String, or the BufferEncoding to use for
       *             the string (Defaults to instance level encoding).
       * @param encoding { String } The BufferEncoding to use for the string (Defaults to instance level encoding).
       *
       * @return { String }
       */
      readString(arg1, encoding) {
        let lengthVal;
        if (typeof arg1 === "number") {
          utils_1.checkLengthValue(arg1);
          lengthVal = Math.min(arg1, this.length - this._readOffset);
        } else {
          encoding = arg1;
          lengthVal = this.length - this._readOffset;
        }
        if (typeof encoding !== "undefined") {
          utils_1.checkEncoding(encoding);
        }
        const value = this._buff.slice(this._readOffset, this._readOffset + lengthVal).toString(encoding || this._encoding);
        this._readOffset += lengthVal;
        return value;
      }
      /**
       * Inserts a String
       *
       * @param value { String } The String value to insert.
       * @param offset { Number } The offset to insert the string at.
       * @param encoding { String } The BufferEncoding to use for writing strings (defaults to instance encoding).
       *
       * @return this
       */
      insertString(value, offset, encoding) {
        utils_1.checkOffsetValue(offset);
        return this._handleString(value, true, offset, encoding);
      }
      /**
       * Writes a String
       *
       * @param value { String } The String value to write.
       * @param arg2 { Number | String } The offset to write the string at, or the BufferEncoding to use.
       * @param encoding { String } The BufferEncoding to use for writing strings (defaults to instance encoding).
       *
       * @return this
       */
      writeString(value, arg2, encoding) {
        return this._handleString(value, false, arg2, encoding);
      }
      /**
       * Reads a null-terminated String from the current read position.
       *
       * @param encoding { String } The BufferEncoding to use for the string (Defaults to instance level encoding).
       *
       * @return { String }
       */
      readStringNT(encoding) {
        if (typeof encoding !== "undefined") {
          utils_1.checkEncoding(encoding);
        }
        let nullPos = this.length;
        for (let i = this._readOffset; i < this.length; i++) {
          if (this._buff[i] === 0) {
            nullPos = i;
            break;
          }
        }
        const value = this._buff.slice(this._readOffset, nullPos);
        this._readOffset = nullPos + 1;
        return value.toString(encoding || this._encoding);
      }
      /**
       * Inserts a null-terminated String.
       *
       * @param value { String } The String value to write.
       * @param arg2 { Number | String } The offset to write the string to, or the BufferEncoding to use.
       * @param encoding { String } The BufferEncoding to use for writing strings (defaults to instance encoding).
       *
       * @return this
       */
      insertStringNT(value, offset, encoding) {
        utils_1.checkOffsetValue(offset);
        this.insertString(value, offset, encoding);
        this.insertUInt8(0, offset + value.length);
        return this;
      }
      /**
       * Writes a null-terminated String.
       *
       * @param value { String } The String value to write.
       * @param arg2 { Number | String } The offset to write the string to, or the BufferEncoding to use.
       * @param encoding { String } The BufferEncoding to use for writing strings (defaults to instance encoding).
       *
       * @return this
       */
      writeStringNT(value, arg2, encoding) {
        this.writeString(value, arg2, encoding);
        this.writeUInt8(0, typeof arg2 === "number" ? arg2 + value.length : this.writeOffset);
        return this;
      }
      // Buffers
      /**
       * Reads a Buffer from the internal read position.
       *
       * @param length { Number } The length of data to read as a Buffer.
       *
       * @return { Buffer }
       */
      readBuffer(length) {
        if (typeof length !== "undefined") {
          utils_1.checkLengthValue(length);
        }
        const lengthVal = typeof length === "number" ? length : this.length;
        const endPoint = Math.min(this.length, this._readOffset + lengthVal);
        const value = this._buff.slice(this._readOffset, endPoint);
        this._readOffset = endPoint;
        return value;
      }
      /**
       * Writes a Buffer to the current write position.
       *
       * @param value { Buffer } The Buffer to write.
       * @param offset { Number } The offset to write the Buffer to.
       *
       * @return this
       */
      insertBuffer(value, offset) {
        utils_1.checkOffsetValue(offset);
        return this._handleBuffer(value, true, offset);
      }
      /**
       * Writes a Buffer to the current write position.
       *
       * @param value { Buffer } The Buffer to write.
       * @param offset { Number } The offset to write the Buffer to.
       *
       * @return this
       */
      writeBuffer(value, offset) {
        return this._handleBuffer(value, false, offset);
      }
      /**
       * Reads a null-terminated Buffer from the current read poisiton.
       *
       * @return { Buffer }
       */
      readBufferNT() {
        let nullPos = this.length;
        for (let i = this._readOffset; i < this.length; i++) {
          if (this._buff[i] === 0) {
            nullPos = i;
            break;
          }
        }
        const value = this._buff.slice(this._readOffset, nullPos);
        this._readOffset = nullPos + 1;
        return value;
      }
      /**
       * Inserts a null-terminated Buffer.
       *
       * @param value { Buffer } The Buffer to write.
       * @param offset { Number } The offset to write the Buffer to.
       *
       * @return this
       */
      insertBufferNT(value, offset) {
        utils_1.checkOffsetValue(offset);
        this.insertBuffer(value, offset);
        this.insertUInt8(0, offset + value.length);
        return this;
      }
      /**
       * Writes a null-terminated Buffer.
       *
       * @param value { Buffer } The Buffer to write.
       * @param offset { Number } The offset to write the Buffer to.
       *
       * @return this
       */
      writeBufferNT(value, offset) {
        if (typeof offset !== "undefined") {
          utils_1.checkOffsetValue(offset);
        }
        this.writeBuffer(value, offset);
        this.writeUInt8(0, typeof offset === "number" ? offset + value.length : this._writeOffset);
        return this;
      }
      /**
       * Clears the SmartBuffer instance to its original empty state.
       */
      clear() {
        this._writeOffset = 0;
        this._readOffset = 0;
        this.length = 0;
        return this;
      }
      /**
       * Gets the remaining data left to be read from the SmartBuffer instance.
       *
       * @return { Number }
       */
      remaining() {
        return this.length - this._readOffset;
      }
      /**
       * Gets the current read offset value of the SmartBuffer instance.
       *
       * @return { Number }
       */
      get readOffset() {
        return this._readOffset;
      }
      /**
       * Sets the read offset value of the SmartBuffer instance.
       *
       * @param offset { Number } - The offset value to set.
       */
      set readOffset(offset) {
        utils_1.checkOffsetValue(offset);
        utils_1.checkTargetOffset(offset, this);
        this._readOffset = offset;
      }
      /**
       * Gets the current write offset value of the SmartBuffer instance.
       *
       * @return { Number }
       */
      get writeOffset() {
        return this._writeOffset;
      }
      /**
       * Sets the write offset value of the SmartBuffer instance.
       *
       * @param offset { Number } - The offset value to set.
       */
      set writeOffset(offset) {
        utils_1.checkOffsetValue(offset);
        utils_1.checkTargetOffset(offset, this);
        this._writeOffset = offset;
      }
      /**
       * Gets the currently set string encoding of the SmartBuffer instance.
       *
       * @return { BufferEncoding } The string Buffer encoding currently set.
       */
      get encoding() {
        return this._encoding;
      }
      /**
       * Sets the string encoding of the SmartBuffer instance.
       *
       * @param encoding { BufferEncoding } The string Buffer encoding to set.
       */
      set encoding(encoding) {
        utils_1.checkEncoding(encoding);
        this._encoding = encoding;
      }
      /**
       * Gets the underlying internal Buffer. (This includes unmanaged data in the Buffer)
       *
       * @return { Buffer } The Buffer value.
       */
      get internalBuffer() {
        return this._buff;
      }
      /**
       * Gets the value of the internal managed Buffer (Includes managed data only)
       *
       * @param { Buffer }
       */
      toBuffer() {
        return this._buff.slice(0, this.length);
      }
      /**
       * Gets the String value of the internal managed Buffer
       *
       * @param encoding { String } The BufferEncoding to display the Buffer as (defaults to instance level encoding).
       */
      toString(encoding) {
        const encodingVal = typeof encoding === "string" ? encoding : this._encoding;
        utils_1.checkEncoding(encodingVal);
        return this._buff.toString(encodingVal, 0, this.length);
      }
      /**
       * Destroys the SmartBuffer instance.
       */
      destroy() {
        this.clear();
        return this;
      }
      /**
       * Handles inserting and writing strings.
       *
       * @param value { String } The String value to insert.
       * @param isInsert { Boolean } True if inserting a string, false if writing.
       * @param arg2 { Number | String } The offset to insert the string at, or the BufferEncoding to use.
       * @param encoding { String } The BufferEncoding to use for writing strings (defaults to instance encoding).
       */
      _handleString(value, isInsert, arg3, encoding) {
        let offsetVal = this._writeOffset;
        let encodingVal = this._encoding;
        if (typeof arg3 === "number") {
          offsetVal = arg3;
        } else if (typeof arg3 === "string") {
          utils_1.checkEncoding(arg3);
          encodingVal = arg3;
        }
        if (typeof encoding === "string") {
          utils_1.checkEncoding(encoding);
          encodingVal = encoding;
        }
        const byteLength = Buffer.byteLength(value, encodingVal);
        if (isInsert) {
          this.ensureInsertable(byteLength, offsetVal);
        } else {
          this._ensureWriteable(byteLength, offsetVal);
        }
        this._buff.write(value, offsetVal, byteLength, encodingVal);
        if (isInsert) {
          this._writeOffset += byteLength;
        } else {
          if (typeof arg3 === "number") {
            this._writeOffset = Math.max(this._writeOffset, offsetVal + byteLength);
          } else {
            this._writeOffset += byteLength;
          }
        }
        return this;
      }
      /**
       * Handles writing or insert of a Buffer.
       *
       * @param value { Buffer } The Buffer to write.
       * @param offset { Number } The offset to write the Buffer to.
       */
      _handleBuffer(value, isInsert, offset) {
        const offsetVal = typeof offset === "number" ? offset : this._writeOffset;
        if (isInsert) {
          this.ensureInsertable(value.length, offsetVal);
        } else {
          this._ensureWriteable(value.length, offsetVal);
        }
        value.copy(this._buff, offsetVal);
        if (isInsert) {
          this._writeOffset += value.length;
        } else {
          if (typeof offset === "number") {
            this._writeOffset = Math.max(this._writeOffset, offsetVal + value.length);
          } else {
            this._writeOffset += value.length;
          }
        }
        return this;
      }
      /**
       * Ensures that the internal Buffer is large enough to read data.
       *
       * @param length { Number } The length of the data that needs to be read.
       * @param offset { Number } The offset of the data that needs to be read.
       */
      ensureReadable(length, offset) {
        let offsetVal = this._readOffset;
        if (typeof offset !== "undefined") {
          utils_1.checkOffsetValue(offset);
          offsetVal = offset;
        }
        if (offsetVal < 0 || offsetVal + length > this.length) {
          throw new Error(utils_1.ERRORS.INVALID_READ_BEYOND_BOUNDS);
        }
      }
      /**
       * Ensures that the internal Buffer is large enough to insert data.
       *
       * @param dataLength { Number } The length of the data that needs to be written.
       * @param offset { Number } The offset of the data to be written.
       */
      ensureInsertable(dataLength, offset) {
        utils_1.checkOffsetValue(offset);
        this._ensureCapacity(this.length + dataLength);
        if (offset < this.length) {
          this._buff.copy(this._buff, offset + dataLength, offset, this._buff.length);
        }
        if (offset + dataLength > this.length) {
          this.length = offset + dataLength;
        } else {
          this.length += dataLength;
        }
      }
      /**
       * Ensures that the internal Buffer is large enough to write data.
       *
       * @param dataLength { Number } The length of the data that needs to be written.
       * @param offset { Number } The offset of the data to be written (defaults to writeOffset).
       */
      _ensureWriteable(dataLength, offset) {
        const offsetVal = typeof offset === "number" ? offset : this._writeOffset;
        this._ensureCapacity(offsetVal + dataLength);
        if (offsetVal + dataLength > this.length) {
          this.length = offsetVal + dataLength;
        }
      }
      /**
       * Ensures that the internal Buffer is large enough to write at least the given amount of data.
       *
       * @param minLength { Number } The minimum length of the data needs to be written.
       */
      _ensureCapacity(minLength) {
        const oldLength = this._buff.length;
        if (minLength > oldLength) {
          let data = this._buff;
          let newLength = oldLength * 3 / 2 + 1;
          if (newLength < minLength) {
            newLength = minLength;
          }
          this._buff = Buffer.allocUnsafe(newLength);
          data.copy(this._buff, 0, 0, oldLength);
        }
      }
      /**
       * Reads a numeric number value using the provided function.
       *
       * @typeparam T { number | bigint } The type of the value to be read
       *
       * @param func { Function(offset: number) => number } The function to read data on the internal Buffer with.
       * @param byteSize { Number } The number of bytes read.
       * @param offset { Number } The offset to read from (optional). When this is not provided, the managed readOffset is used instead.
       *
       * @returns { T } the number value
       */
      _readNumberValue(func, byteSize, offset) {
        this.ensureReadable(byteSize, offset);
        const value = func.call(this._buff, typeof offset === "number" ? offset : this._readOffset);
        if (typeof offset === "undefined") {
          this._readOffset += byteSize;
        }
        return value;
      }
      /**
       * Inserts a numeric number value based on the given offset and value.
       *
       * @typeparam T { number | bigint } The type of the value to be written
       *
       * @param func { Function(offset: T, offset?) => number} The function to write data on the internal Buffer with.
       * @param byteSize { Number } The number of bytes written.
       * @param value { T } The number value to write.
       * @param offset { Number } the offset to write the number at (REQUIRED).
       *
       * @returns SmartBuffer this buffer
       */
      _insertNumberValue(func, byteSize, value, offset) {
        utils_1.checkOffsetValue(offset);
        this.ensureInsertable(byteSize, offset);
        func.call(this._buff, value, offset);
        this._writeOffset += byteSize;
        return this;
      }
      /**
       * Writes a numeric number value based on the given offset and value.
       *
       * @typeparam T { number | bigint } The type of the value to be written
       *
       * @param func { Function(offset: T, offset?) => number} The function to write data on the internal Buffer with.
       * @param byteSize { Number } The number of bytes written.
       * @param value { T } The number value to write.
       * @param offset { Number } the offset to write the number at (REQUIRED).
       *
       * @returns SmartBuffer this buffer
       */
      _writeNumberValue(func, byteSize, value, offset) {
        if (typeof offset === "number") {
          if (offset < 0) {
            throw new Error(utils_1.ERRORS.INVALID_WRITE_BEYOND_BOUNDS);
          }
          utils_1.checkOffsetValue(offset);
        }
        const offsetVal = typeof offset === "number" ? offset : this._writeOffset;
        this._ensureWriteable(byteSize, offsetVal);
        func.call(this._buff, value, offsetVal);
        if (typeof offset === "number") {
          this._writeOffset = Math.max(this._writeOffset, offsetVal + byteSize);
        } else {
          this._writeOffset += byteSize;
        }
        return this;
      }
    };
    exports.SmartBuffer = SmartBuffer;
  }
});

// node_modules/socks/build/common/constants.js
var require_constants2 = __commonJS({
  "node_modules/socks/build/common/constants.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SOCKS5_NO_ACCEPTABLE_AUTH = exports.SOCKS5_CUSTOM_AUTH_END = exports.SOCKS5_CUSTOM_AUTH_START = exports.SOCKS_INCOMING_PACKET_SIZES = exports.SocksClientState = exports.Socks5Response = exports.Socks5HostType = exports.Socks5Auth = exports.Socks4Response = exports.SocksCommand = exports.ERRORS = exports.DEFAULT_TIMEOUT = void 0;
    var DEFAULT_TIMEOUT = 3e4;
    exports.DEFAULT_TIMEOUT = DEFAULT_TIMEOUT;
    var ERRORS = {
      InvalidSocksCommand: "An invalid SOCKS command was provided. Valid options are connect, bind, and associate.",
      InvalidSocksCommandForOperation: "An invalid SOCKS command was provided. Only a subset of commands are supported for this operation.",
      InvalidSocksCommandChain: "An invalid SOCKS command was provided. Chaining currently only supports the connect command.",
      InvalidSocksClientOptionsDestination: "An invalid destination host was provided.",
      InvalidSocksClientOptionsExistingSocket: "An invalid existing socket was provided. This should be an instance of stream.Duplex.",
      InvalidSocksClientOptionsProxy: "Invalid SOCKS proxy details were provided.",
      InvalidSocksClientOptionsTimeout: "An invalid timeout value was provided. Please enter a value above 0 (in ms).",
      InvalidSocksClientOptionsProxiesLength: "At least two socks proxies must be provided for chaining.",
      InvalidSocksClientOptionsCustomAuthRange: "Custom auth must be a value between 0x80 and 0xFE.",
      InvalidSocksClientOptionsCustomAuthOptions: "When a custom_auth_method is provided, custom_auth_request_handler, custom_auth_response_size, and custom_auth_response_handler must also be provided and valid.",
      NegotiationError: "Negotiation error",
      SocketClosed: "Socket closed",
      ProxyConnectionTimedOut: "Proxy connection timed out",
      InternalError: "SocksClient internal error (this should not happen)",
      InvalidSocks4HandshakeResponse: "Received invalid Socks4 handshake response",
      Socks4ProxyRejectedConnection: "Socks4 Proxy rejected connection",
      InvalidSocks4IncomingConnectionResponse: "Socks4 invalid incoming connection response",
      Socks4ProxyRejectedIncomingBoundConnection: "Socks4 Proxy rejected incoming bound connection",
      InvalidSocks5InitialHandshakeResponse: "Received invalid Socks5 initial handshake response",
      InvalidSocks5IntiailHandshakeSocksVersion: "Received invalid Socks5 initial handshake (invalid socks version)",
      InvalidSocks5InitialHandshakeNoAcceptedAuthType: "Received invalid Socks5 initial handshake (no accepted authentication type)",
      InvalidSocks5InitialHandshakeUnknownAuthType: "Received invalid Socks5 initial handshake (unknown authentication type)",
      Socks5AuthenticationFailed: "Socks5 Authentication failed",
      InvalidSocks5FinalHandshake: "Received invalid Socks5 final handshake response",
      InvalidSocks5FinalHandshakeRejected: "Socks5 proxy rejected connection",
      InvalidSocks5IncomingConnectionResponse: "Received invalid Socks5 incoming connection response",
      Socks5ProxyRejectedIncomingBoundConnection: "Socks5 Proxy rejected incoming bound connection"
    };
    exports.ERRORS = ERRORS;
    var SOCKS_INCOMING_PACKET_SIZES = {
      Socks5InitialHandshakeResponse: 2,
      Socks5UserPassAuthenticationResponse: 2,
      // Command response + incoming connection (bind)
      Socks5ResponseHeader: 5,
      // We need at least 5 to read the hostname length, then we wait for the address+port information.
      Socks5ResponseIPv4: 10,
      // 4 header + 4 ip + 2 port
      Socks5ResponseIPv6: 22,
      // 4 header + 16 ip + 2 port
      Socks5ResponseHostname: (hostNameLength) => hostNameLength + 7,
      // 4 header + 1 host length + host + 2 port
      // Command response + incoming connection (bind)
      Socks4Response: 8
      // 2 header + 2 port + 4 ip
    };
    exports.SOCKS_INCOMING_PACKET_SIZES = SOCKS_INCOMING_PACKET_SIZES;
    var SocksCommand;
    (function(SocksCommand2) {
      SocksCommand2[SocksCommand2["connect"] = 1] = "connect";
      SocksCommand2[SocksCommand2["bind"] = 2] = "bind";
      SocksCommand2[SocksCommand2["associate"] = 3] = "associate";
    })(SocksCommand || (exports.SocksCommand = SocksCommand = {}));
    var Socks4Response;
    (function(Socks4Response2) {
      Socks4Response2[Socks4Response2["Granted"] = 90] = "Granted";
      Socks4Response2[Socks4Response2["Failed"] = 91] = "Failed";
      Socks4Response2[Socks4Response2["Rejected"] = 92] = "Rejected";
      Socks4Response2[Socks4Response2["RejectedIdent"] = 93] = "RejectedIdent";
    })(Socks4Response || (exports.Socks4Response = Socks4Response = {}));
    var Socks5Auth;
    (function(Socks5Auth2) {
      Socks5Auth2[Socks5Auth2["NoAuth"] = 0] = "NoAuth";
      Socks5Auth2[Socks5Auth2["GSSApi"] = 1] = "GSSApi";
      Socks5Auth2[Socks5Auth2["UserPass"] = 2] = "UserPass";
    })(Socks5Auth || (exports.Socks5Auth = Socks5Auth = {}));
    var SOCKS5_CUSTOM_AUTH_START = 128;
    exports.SOCKS5_CUSTOM_AUTH_START = SOCKS5_CUSTOM_AUTH_START;
    var SOCKS5_CUSTOM_AUTH_END = 254;
    exports.SOCKS5_CUSTOM_AUTH_END = SOCKS5_CUSTOM_AUTH_END;
    var SOCKS5_NO_ACCEPTABLE_AUTH = 255;
    exports.SOCKS5_NO_ACCEPTABLE_AUTH = SOCKS5_NO_ACCEPTABLE_AUTH;
    var Socks5Response;
    (function(Socks5Response2) {
      Socks5Response2[Socks5Response2["Granted"] = 0] = "Granted";
      Socks5Response2[Socks5Response2["Failure"] = 1] = "Failure";
      Socks5Response2[Socks5Response2["NotAllowed"] = 2] = "NotAllowed";
      Socks5Response2[Socks5Response2["NetworkUnreachable"] = 3] = "NetworkUnreachable";
      Socks5Response2[Socks5Response2["HostUnreachable"] = 4] = "HostUnreachable";
      Socks5Response2[Socks5Response2["ConnectionRefused"] = 5] = "ConnectionRefused";
      Socks5Response2[Socks5Response2["TTLExpired"] = 6] = "TTLExpired";
      Socks5Response2[Socks5Response2["CommandNotSupported"] = 7] = "CommandNotSupported";
      Socks5Response2[Socks5Response2["AddressNotSupported"] = 8] = "AddressNotSupported";
    })(Socks5Response || (exports.Socks5Response = Socks5Response = {}));
    var Socks5HostType;
    (function(Socks5HostType2) {
      Socks5HostType2[Socks5HostType2["IPv4"] = 1] = "IPv4";
      Socks5HostType2[Socks5HostType2["Hostname"] = 3] = "Hostname";
      Socks5HostType2[Socks5HostType2["IPv6"] = 4] = "IPv6";
    })(Socks5HostType || (exports.Socks5HostType = Socks5HostType = {}));
    var SocksClientState;
    (function(SocksClientState2) {
      SocksClientState2[SocksClientState2["Created"] = 0] = "Created";
      SocksClientState2[SocksClientState2["Connecting"] = 1] = "Connecting";
      SocksClientState2[SocksClientState2["Connected"] = 2] = "Connected";
      SocksClientState2[SocksClientState2["SentInitialHandshake"] = 3] = "SentInitialHandshake";
      SocksClientState2[SocksClientState2["ReceivedInitialHandshakeResponse"] = 4] = "ReceivedInitialHandshakeResponse";
      SocksClientState2[SocksClientState2["SentAuthentication"] = 5] = "SentAuthentication";
      SocksClientState2[SocksClientState2["ReceivedAuthenticationResponse"] = 6] = "ReceivedAuthenticationResponse";
      SocksClientState2[SocksClientState2["SentFinalHandshake"] = 7] = "SentFinalHandshake";
      SocksClientState2[SocksClientState2["ReceivedFinalResponse"] = 8] = "ReceivedFinalResponse";
      SocksClientState2[SocksClientState2["BoundWaitingForConnection"] = 9] = "BoundWaitingForConnection";
      SocksClientState2[SocksClientState2["Established"] = 10] = "Established";
      SocksClientState2[SocksClientState2["Disconnected"] = 11] = "Disconnected";
      SocksClientState2[SocksClientState2["Error"] = 99] = "Error";
    })(SocksClientState || (exports.SocksClientState = SocksClientState = {}));
  }
});

// node_modules/socks/build/common/util.js
var require_util = __commonJS({
  "node_modules/socks/build/common/util.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SocksClientError = void 0;
    exports.shuffleArray = shuffleArray;
    var SocksClientError = class extends Error {
      constructor(message, options) {
        super(message);
        this.options = options;
      }
    };
    exports.SocksClientError = SocksClientError;
    function shuffleArray(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
    }
  }
});

// node_modules/ip-address/dist/address-error.js
var require_address_error = __commonJS({
  "node_modules/ip-address/dist/address-error.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AddressError = void 0;
    var AddressError = class extends Error {
      constructor(message, parseMessage) {
        super(message);
        this.name = "AddressError";
        this.parseMessage = parseMessage;
      }
    };
    exports.AddressError = AddressError;
  }
});

// node_modules/ip-address/dist/common.js
var require_common2 = __commonJS({
  "node_modules/ip-address/dist/common.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isInSubnet = isInSubnet;
    exports.isHostInSubnet = isHostInSubnet;
    exports.isGloballyReachable = isGloballyReachable;
    exports.offsetBigInt = offsetBigInt;
    exports.isCorrect = isCorrect;
    exports.prefixLengthFromMask = prefixLengthFromMask;
    exports.assertByteArray = assertByteArray;
    exports.numberToPaddedHex = numberToPaddedHex;
    exports.stringToPaddedHex = stringToPaddedHex;
    exports.testBit = testBit;
    var address_error_1 = require_address_error();
    function isInSubnet(address) {
      if (this.subnetMask < address.subnetMask) {
        return false;
      }
      return isHostInSubnet.call(this, address);
    }
    function isHostInSubnet(address) {
      if (this.binaryZeroPad().length !== address.binaryZeroPad().length) {
        return false;
      }
      return this.mask(address.subnetMask) === address.mask();
    }
    function isGloballyReachable(entries) {
      let best = null;
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (entry.reachable !== null && isHostInSubnet.call(this, entry.subnet) && (best === null || entry.subnet.subnetMask > best.subnet.subnetMask)) {
          best = entry;
        }
      }
      return best === null ? true : best.reachable;
    }
    function offsetBigInt(value, n, bits, family) {
      if (typeof n === "number" && !Number.isSafeInteger(n)) {
        throw new address_error_1.AddressError(`${family} offset must be an integer`);
      }
      if (typeof n !== "number" && typeof n !== "bigint") {
        throw new address_error_1.AddressError(`${family} offset must be an integer`);
      }
      const result = value + BigInt(n);
      if (result < BigInt(0) || result > (BigInt(1) << BigInt(bits)) - BigInt(1)) {
        throw new address_error_1.AddressError(`${family} offset leaves the address space`);
      }
      return result;
    }
    function isCorrect(defaultBits) {
      return function isCorrectForm() {
        if (this.addressMinusSuffix !== this.correctForm()) {
          return false;
        }
        if (this.subnetMask === defaultBits && !this.parsedSubnet) {
          return true;
        }
        return this.parsedSubnet === String(this.subnetMask);
      };
    }
    function prefixLengthFromMask(value, totalBits) {
      const binary = value.toString(2).padStart(totalBits, "0");
      if (binary.length > totalBits) {
        throw new address_error_1.AddressError("Invalid subnet mask.");
      }
      const firstZero = binary.indexOf("0");
      if (firstZero === -1) {
        return totalBits;
      }
      if (binary.slice(firstZero).includes("1")) {
        throw new address_error_1.AddressError("Invalid subnet mask.");
      }
      return firstZero;
    }
    function assertByteArray(bytes, byteCount, family, minimum) {
      if (bytes.length !== byteCount) {
        throw new address_error_1.AddressError(`${family} addresses require exactly ${byteCount} bytes`);
      }
      for (let i = 0; i < bytes.length; i++) {
        if (!Number.isInteger(bytes[i]) || bytes[i] < minimum || bytes[i] > 255) {
          throw new address_error_1.AddressError(`All bytes must be integers between ${minimum} and 255`);
        }
      }
    }
    function numberToPaddedHex(number) {
      return number.toString(16).padStart(2, "0");
    }
    function stringToPaddedHex(numberString) {
      return numberToPaddedHex(parseInt(numberString, 10));
    }
    function testBit(binaryValue, position) {
      const { length } = binaryValue;
      if (position >= length) {
        return false;
      }
      const positionInString = length - position - 1;
      return binaryValue.substring(positionInString, positionInString + 1) === "1";
    }
  }
});

// node_modules/ip-address/dist/v4/constants.js
var require_constants3 = __commonJS({
  "node_modules/ip-address/dist/v4/constants.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SPECIAL_PURPOSE = exports.RE_SUBNET_STRING = exports.RE_ADDRESS = exports.GROUPS = exports.BITS = void 0;
    exports.BITS = 32;
    exports.GROUPS = 4;
    exports.RE_ADDRESS = /^(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])$/g;
    exports.RE_SUBNET_STRING = /\/\d{1,2}$/;
    exports.SPECIAL_PURPOSE = [
      ["0.0.0.0/8", "This network", false],
      ["0.0.0.0/32", "This host on this network", false],
      ["10.0.0.0/8", "Private-Use", false],
      ["100.64.0.0/10", "Shared Address Space", false],
      ["127.0.0.0/8", "Loopback", false],
      ["169.254.0.0/16", "Link Local", false],
      ["172.16.0.0/12", "Private-Use", false],
      ["192.0.0.0/24", "IETF Protocol Assignments", false],
      ["192.0.0.0/29", "IPv4 Service Continuity Prefix", false],
      ["192.0.0.8/32", "IPv4 dummy address", false],
      ["192.0.0.9/32", "Port Control Protocol Anycast", true],
      ["192.0.0.10/32", "Traversal Using Relays around NAT Anycast", true],
      ["192.0.0.170/32", "NAT64/DNS64 Discovery", false],
      ["192.0.0.171/32", "NAT64/DNS64 Discovery", false],
      ["192.0.2.0/24", "Documentation (TEST-NET-1)", false],
      ["192.31.196.0/24", "AS112-v4", true],
      ["192.52.193.0/24", "AMT", true],
      ["192.88.99.0/24", "Deprecated (6to4 Relay Anycast)", null],
      ["192.88.99.2/32", "6a44-relay anycast address", false],
      ["192.168.0.0/16", "Private-Use", false],
      ["192.175.48.0/24", "Direct Delegation AS112 Service", true],
      ["198.18.0.0/15", "Benchmarking", false],
      ["198.51.100.0/24", "Documentation (TEST-NET-2)", false],
      ["203.0.113.0/24", "Documentation (TEST-NET-3)", false],
      ["240.0.0.0/4", "Reserved", false],
      ["255.255.255.255/32", "Limited Broadcast", false]
    ];
  }
});

// node_modules/ip-address/dist/ipv4.js
var require_ipv4 = __commonJS({
  "node_modules/ip-address/dist/ipv4.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports && exports.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Address4 = void 0;
    var common = __importStar(require_common2());
    var constants2 = __importStar(require_constants3());
    var address_error_1 = require_address_error();
    var isCorrect4 = common.isCorrect(constants2.BITS);
    var Address4 = class _Address4 {
      constructor(address) {
        this.addressMinusSuffix = "";
        this.groups = constants2.GROUPS;
        this.parsedAddress = [];
        this.parsedSubnet = "";
        this.subnet = "/32";
        this.subnetMask = 32;
        this.v4 = true;
        this.isCorrect = isCorrect4;
        this.isInSubnet = common.isInSubnet;
        this.isHostInSubnet = common.isHostInSubnet;
        this.address = address;
        const subnet = constants2.RE_SUBNET_STRING.exec(address);
        if (subnet) {
          this.parsedSubnet = subnet[0].replace("/", "");
          this.subnetMask = parseInt(this.parsedSubnet, 10);
          this.subnet = `/${this.subnetMask}`;
          if (this.subnetMask < 0 || this.subnetMask > constants2.BITS) {
            throw new address_error_1.AddressError("Invalid subnet mask.");
          }
          address = address.replace(constants2.RE_SUBNET_STRING, "");
        }
        const longest = constants2.GROUPS * 4 - 1;
        if (address.length > longest) {
          throw new address_error_1.AddressError(`IPv4 addresses are at most ${longest} characters.`);
        }
        this.addressMinusSuffix = address;
        this.parsedAddress = this.parse(address);
      }
      /**
       * Returns true if the given string is a valid IPv4 address (with optional
       * CIDR subnet), false otherwise. Host bits in the subnet portion are
       * allowed (e.g. `192.168.1.5/24` is valid); for strict network-address
       * validation compare `correctForm()` to `startAddress().correctForm()`,
       * or use `networkForm()`.
       */
      static isValid(address) {
        try {
          new _Address4(address);
          return true;
        } catch {
          return false;
        }
      }
      /**
       * Parses an IPv4 address string into its four octet groups and stores the
       * result on `this.parsedAddress`. Called automatically by the constructor;
       * you typically don't need to call it directly. Throws `AddressError` if
       * the input is not a valid IPv4 address.
       */
      parse(address) {
        const groups = address.split(".");
        if (groups.some((group) => /^0\d/.test(group))) {
          throw new address_error_1.AddressError("IPv4 addresses can't have leading zeroes.");
        }
        if (!address.match(constants2.RE_ADDRESS)) {
          throw new address_error_1.AddressError("Invalid IPv4 address.");
        }
        return groups;
      }
      /**
       * Returns the address in correct form: octets joined with `.` and any
       * leading zeros stripped (e.g. `192.168.1.1`). For IPv4 this matches the
       * canonical dotted-decimal representation.
       */
      correctForm() {
        return this.parsedAddress.map((part) => parseInt(part, 10)).join(".");
      }
      /**
       * Construct an `Address4` from an address and a dotted-decimal subnet
       * mask given as separate strings (e.g. as returned by Node's
       * `os.networkInterfaces()`). Throws `AddressError` if the mask is
       * non-contiguous (e.g. `255.0.255.0`).
       * @example
       * var address = Address4.fromAddressAndMask('192.168.1.1', '255.255.255.0');
       * address.subnetMask; // 24
       */
      static fromAddressAndMask(address, mask) {
        const bits = common.prefixLengthFromMask(new _Address4(mask).bigInt(), constants2.BITS);
        return new _Address4(`${address}/${bits}`);
      }
      /**
       * Construct an `Address4` from an address and a Cisco-style wildcard mask
       * given as separate strings (e.g. `0.0.0.255` for a `/24`). The wildcard
       * mask is the bitwise inverse of the subnet mask. Throws `AddressError`
       * if the mask is non-contiguous (e.g. `0.255.0.255`).
       * @example
       * var address = Address4.fromAddressAndWildcardMask('10.0.0.1', '0.0.0.255');
       * address.subnetMask; // 24
       */
      static fromAddressAndWildcardMask(address, wildcardMask) {
        const wildcard = new _Address4(wildcardMask).bigInt();
        const allOnes = (BigInt(1) << BigInt(constants2.BITS)) - BigInt(1);
        const mask = wildcard ^ allOnes;
        const bits = common.prefixLengthFromMask(mask, constants2.BITS);
        return new _Address4(`${address}/${bits}`);
      }
      /**
       * Construct an `Address4` from a wildcard pattern with trailing `*`
       * octets. The number of trailing wildcards determines the prefix
       * length: each `*` represents 8 bits.
       *
       * Only trailing whole-octet wildcards are supported. Partial-octet
       * wildcards (e.g. `192.168.0.1*`) and interior wildcards (e.g.
       * `192.*.0.1`) throw `AddressError`.
       * @example
       * Address4.fromWildcard('192.168.0.*').subnet;   // '/24'
       * Address4.fromWildcard('192.168.*.*').subnet;   // '/16'
       * Address4.fromWildcard('*.*.*.*').subnet;       // '/0'
       */
      static fromWildcard(input) {
        const groups = input.split(".");
        if (groups.length !== constants2.GROUPS) {
          throw new address_error_1.AddressError("Wildcard pattern must have 4 octets");
        }
        let firstWildcard = -1;
        for (let i = 0; i < groups.length; i++) {
          if (groups[i] === "*") {
            if (firstWildcard === -1) {
              firstWildcard = i;
            }
          } else if (firstWildcard !== -1) {
            throw new address_error_1.AddressError("Wildcard `*` must only appear in trailing octets (e.g. `192.168.0.*`)");
          }
        }
        const trailing = firstWildcard === -1 ? 0 : groups.length - firstWildcard;
        const replaced = groups.map((g) => g === "*" ? "0" : g);
        const subnetBits = constants2.BITS - trailing * 8;
        return new _Address4(`${replaced.join(".")}/${subnetBits}`);
      }
      /**
       * Converts a hex string to an IPv4 address object. Accepts 8 hex digits
       * with optional `:` separators (e.g. `'7f000001'` or `'7f:00:00:01'`).
       * Throws `AddressError` for any other length or for non-hex characters.
       * @param {string} hex - a hex string to convert
       * @returns {Address4}
       */
      static fromHex(hex) {
        const stripped = hex.replace(/:/g, "");
        if (!/^[0-9a-fA-F]{8}$/.test(stripped)) {
          throw new address_error_1.AddressError("IPv4 hex must be exactly 8 hex digits");
        }
        const groups = [];
        for (let i = 0; i < 8; i += 2) {
          groups.push(parseInt(stripped.slice(i, i + 2), 16));
        }
        return new _Address4(groups.join("."));
      }
      /**
       * Converts an integer into a IPv4 address object. The integer must be a
       * non-negative safe integer in the range `[0, 2**32 - 1]`; otherwise
       * `AddressError` is thrown.
       * @param {integer} integer - a number to convert
       * @returns {Address4}
       */
      static fromInteger(integer) {
        if (!Number.isInteger(integer) || integer < 0 || integer > 4294967295) {
          throw new address_error_1.AddressError("IPv4 integer must be in the range 0 to 2**32 - 1");
        }
        return _Address4.fromHex(integer.toString(16).padStart(8, "0"));
      }
      /**
       * Return an address from in-addr.arpa form: the four octets reversed, with
       * or without the `.in-addr.arpa` suffix and root dot, in any case. Throws
       * `AddressError` unless the reversed labels form a valid IPv4 address, so
       * `fromArpa(x.reverseForm())` round-trips {@link reverseForm}.
       * @param {string} arpaFormAddress - an 'in-addr.arpa' form ipv4 address
       * @returns {Adress4}
       * @example
       * var address = Address4.fromArpa('42.2.0.192.in-addr.arpa.')
       * address.correctForm(); // '192.0.2.42'
       */
      static fromArpa(arpaFormAddress) {
        const longest = constants2.GROUPS * 4 - 1 + "/32".length + ".in-addr.arpa.".length;
        if (arpaFormAddress.length > longest) {
          throw new address_error_1.AddressError(`in-addr.arpa names are at most ${longest} characters.`);
        }
        const leader = arpaFormAddress.replace(/(\.in-addr\.arpa)?\.?$/i, "");
        const address = leader.split(".").reverse().join(".");
        return new _Address4(address);
      }
      /**
       * Converts an IPv4 address object to a hex string
       * @returns {String}
       */
      toHex() {
        return this.parsedAddress.map((part) => common.stringToPaddedHex(part)).join(":");
      }
      /**
       * Converts an IPv4 address object to an array of bytes.
       *
       * To get a Node.js `Buffer`, wrap the result: `Buffer.from(address.toArray())`.
       * @returns {Array}
       */
      toArray() {
        return this.parsedAddress.map((part) => parseInt(part, 10));
      }
      /**
       * Converts an IPv4 address object to an IPv6 address group
       * @returns {String}
       */
      toGroup6() {
        const output = [];
        let i;
        for (i = 0; i < constants2.GROUPS; i += 2) {
          output.push(`${common.stringToPaddedHex(this.parsedAddress[i])}${common.stringToPaddedHex(this.parsedAddress[i + 1])}`);
        }
        return output.join(":");
      }
      /**
       * Returns the address as a `bigint`
       * @returns {bigint}
       */
      bigInt() {
        return BigInt(`0x${this.parsedAddress.map((n) => common.stringToPaddedHex(n)).join("")}`);
      }
      /**
       * Helper function getting start address.
       * @returns {bigint}
       */
      _startAddress() {
        return BigInt(`0b${this.mask() + "0".repeat(constants2.BITS - this.subnetMask)}`);
      }
      /**
       * The first address in the range given by this address' subnet.
       * Often referred to as the Network Address.
       * @returns {Address4}
       */
      startAddress() {
        return _Address4.fromBigInt(this._startAddress());
      }
      /**
       * The first host address in the range given by this address's subnet ie
       * the first address after the Network Address
       * @returns {Address4}
       */
      startAddressExclusive() {
        const adjust = BigInt("1");
        return _Address4.fromBigInt(this._startAddress() + adjust);
      }
      /**
       * Returns the address `n` addresses after this one (or before, when `n` is
       * negative), keeping this address's subnet mask. Throws `AddressError` when
       * the result would fall outside the IPv4 address space or `n` is not an
       * integer.
       * @param {number | bigint} n
       * @returns {Address4}
       * @example
       * new Address4('10.0.0.0/24').offset(1).correctForm(); // '10.0.0.1'
       */
      offset(n) {
        return _Address4.fromBigInt(common.offsetBigInt(this.bigInt(), n, constants2.BITS, "IPv4")).withSubnetMask(this.subnetMask);
      }
      /**
       * Returns the network that follows this address's network: the address after
       * {@link endAddress}, with the same subnet mask. Throws `AddressError` when
       * this network is the last one in the address space.
       * @returns {Address4}
       * @example
       * new Address4('10.0.0.0/24').nextNetwork().networkForm(); // '10.0.1.0/24'
       */
      nextNetwork() {
        return _Address4.fromBigInt(common.offsetBigInt(this._endAddress(), 1, constants2.BITS, "IPv4")).withSubnetMask(this.subnetMask);
      }
      withSubnetMask(subnetMask) {
        return new _Address4(`${this.correctForm()}/${subnetMask}`);
      }
      /**
       * Helper function getting end address.
       * @returns {bigint}
       */
      _endAddress() {
        return BigInt(`0b${this.mask() + "1".repeat(constants2.BITS - this.subnetMask)}`);
      }
      /**
       * The last address in the range given by this address' subnet
       * Often referred to as the Broadcast
       * @returns {Address4}
       */
      endAddress() {
        return _Address4.fromBigInt(this._endAddress());
      }
      /**
       * The last host address in the range given by this address's subnet ie
       * the last address prior to the Broadcast Address
       * @returns {Address4}
       */
      endAddressExclusive() {
        const adjust = BigInt("1");
        return _Address4.fromBigInt(this._endAddress() - adjust);
      }
      /**
       * The dotted-decimal form of the subnet mask, e.g. `255.255.240.0` for
       * a `/20`. Returns an `Address4`; call `.correctForm()` for the string.
       * @returns {Address4}
       */
      subnetMaskAddress() {
        return _Address4.fromBigInt(BigInt(`0b${"1".repeat(this.subnetMask)}${"0".repeat(constants2.BITS - this.subnetMask)}`));
      }
      /**
       * The Cisco-style wildcard mask, e.g. `0.0.0.255` for a `/24`. This is
       * the bitwise inverse of `subnetMaskAddress()`. Returns an `Address4`;
       * call `.correctForm()` for the string.
       * @returns {Address4}
       */
      wildcardMask() {
        return _Address4.fromBigInt(BigInt(`0b${"0".repeat(this.subnetMask)}${"1".repeat(constants2.BITS - this.subnetMask)}`));
      }
      /**
       * The network address in CIDR string form, e.g. `192.168.1.0/24` for
       * `192.168.1.5/24`. For an address with no explicit subnet the prefix is
       * `/32`, e.g. `networkForm()` on `192.168.1.5` returns `192.168.1.5/32`.
       * @returns {string}
       */
      networkForm() {
        return `${this.startAddress().correctForm()}/${this.subnetMask}`;
      }
      /**
       * Converts a BigInt to a v4 address object. The value must be in the
       * range `[0, 2**32 - 1]`; otherwise `AddressError` is thrown.
       * @param {bigint} bigInt - a BigInt to convert
       * @returns {Address4}
       */
      static fromBigInt(bigInt) {
        if (bigInt < BigInt(0) || bigInt > BigInt(4294967295)) {
          throw new address_error_1.AddressError("IPv4 BigInt must be in the range 0 to 2**32 - 1");
        }
        return _Address4.fromHex(bigInt.toString(16).padStart(8, "0"));
      }
      /**
       * Convert a byte array to an Address4 object. Throws `AddressError` unless
       * given exactly 4 integers from 0 to 255. Signed bytes are rejected, so
       * this differs from `Address6.fromByteArray`, which folds them; the two
       * contracts converge on this stricter form in the next major version.
       *
       * To convert from a Node.js `Buffer`, spread it: `Address4.fromByteArray([...buf])`.
       * @param {Array<number>} bytes - an array of 4 bytes (0-255)
       * @returns {Address4}
       */
      static fromByteArray(bytes) {
        common.assertByteArray(bytes, 4, "IPv4", 0);
        return this.fromUnsignedByteArray(bytes);
      }
      /**
       * Convert an unsigned byte array to an Address4 object. Throws
       * `AddressError` unless given exactly 4 bytes, and rejects values outside
       * 0 to 255 when parsing the resulting address.
       *
       * To convert from a Node.js `Buffer`, spread it:
       * `Address4.fromUnsignedByteArray([...buf])`.
       * @param {Array<number>} bytes - an array of 4 unsigned bytes (0-255)
       * @returns {Address4}
       */
      static fromUnsignedByteArray(bytes) {
        if (bytes.length !== 4) {
          throw new address_error_1.AddressError("IPv4 addresses require exactly 4 bytes");
        }
        const address = bytes.join(".");
        return new _Address4(address);
      }
      /**
       * Returns the first n bits of the address, defaulting to the
       * subnet mask
       * @returns {String}
       */
      mask(mask) {
        if (mask === void 0) {
          mask = this.subnetMask;
        }
        return this.getBitsBase2(0, mask);
      }
      /**
       * Returns the bits in the given range as a base-2 string
       * @returns {string}
       */
      getBitsBase2(start, end) {
        return this.binaryZeroPad().slice(start, end);
      }
      /**
       * Return the reversed in-addr.arpa form of the address, e.g.
       * `42.2.0.192.in-addr.arpa.` for `192.0.2.42`.
       * @param {Object} options
       * @param {boolean} options.omitSuffix - omit the "in-addr.arpa" suffix
       * @returns {String}
       */
      reverseForm(options) {
        if (!options) {
          options = {};
        }
        const reversed = this.correctForm().split(".").reverse().join(".");
        if (options.omitSuffix) {
          return reversed;
        }
        return `${reversed}.in-addr.arpa.`;
      }
      /**
       * Returns true if the given address is a multicast address
       * @returns {boolean}
       */
      isMulticast() {
        return this.isHostInSubnet(MULTICAST_V4);
      }
      /**
       * Returns true if the address is in one of the [RFC 1918](https://datatracker.ietf.org/doc/html/rfc1918) private address ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
       * @returns {boolean}
       */
      isPrivate() {
        return PRIVATE_V4.some((subnet) => this.isHostInSubnet(subnet));
      }
      /**
       * Returns true if the address is in the loopback range `127.0.0.0/8` ([RFC 1122](https://datatracker.ietf.org/doc/html/rfc1122)).
       * @returns {boolean}
       */
      isLoopback() {
        return this.isHostInSubnet(LOOPBACK_V4);
      }
      /**
       * Returns true if the address is in the link-local range `169.254.0.0/16` ([RFC 3927](https://datatracker.ietf.org/doc/html/rfc3927)).
       * @returns {boolean}
       */
      isLinkLocal() {
        return this.isHostInSubnet(LINK_LOCAL_V4);
      }
      /**
       * Returns true if the address is the unspecified address `0.0.0.0`.
       * @returns {boolean}
       */
      isUnspecified() {
        return this.isHostInSubnet(UNSPECIFIED_V4);
      }
      /**
       * Returns true if the address is the limited broadcast address `255.255.255.255` ([RFC 919](https://datatracker.ietf.org/doc/html/rfc919)).
       * @returns {boolean}
       */
      isBroadcast() {
        return this.isHostInSubnet(BROADCAST_V4);
      }
      /**
       * Returns true if the address is in the carrier-grade NAT range `100.64.0.0/10` ([RFC 6598](https://datatracker.ietf.org/doc/html/rfc6598)).
       * @returns {boolean}
       */
      isCGNAT() {
        return this.isHostInSubnet(CGNAT_V4);
      }
      /**
       * Returns true if the address is in one of the documentation ranges
       * `192.0.2.0/24`, `198.51.100.0/24`, or `203.0.113.0/24` ([RFC 5737](https://datatracker.ietf.org/doc/html/rfc5737)).
       * @returns {boolean}
       */
      isDocumentation() {
        return DOCUMENTATION_V4.some((subnet) => this.isHostInSubnet(subnet));
      }
      /**
       * Returns true if the address is in the benchmarking range `198.18.0.0/15` ([RFC 2544](https://datatracker.ietf.org/doc/html/rfc2544)).
       * @returns {boolean}
       */
      isBenchmarking() {
        return this.isHostInSubnet(BENCHMARKING_V4);
      }
      /**
       * Returns true if the address is in the reserved range `240.0.0.0/4` ([RFC 1112](https://datatracker.ietf.org/doc/html/rfc1112)),
       * which includes the limited broadcast address.
       * @returns {boolean}
       */
      isReserved() {
        return this.isHostInSubnet(RESERVED_V4);
      }
      /**
       * Returns true if the address is globally reachable: not multicast, and not
       * in any block the [IANA IPv4 Special-Purpose Address Registry](https://www.iana.org/assignments/iana-ipv4-special-registry/)
       * marks as not globally reachable. That covers everything the individual
       * classifiers name (private, loopback, link-local, CGNAT, unspecified,
       * broadcast, documentation, benchmarking, reserved) and the blocks they do
       * not, such as `0.0.0.0/8` and the IETF protocol assignments in
       * `192.0.0.0/24`. This is the single predicate to use where a request must
       * not reach an internal or special-purpose destination; see SECURITY.md.
       * @returns {boolean}
       */
      isGlobal() {
        return !this.isMulticast() && common.isGloballyReachable.call(this, SPECIAL_PURPOSE_V4);
      }
      /**
       * Returns a zero-padded base-2 string representation of the address
       * @returns {string}
       */
      binaryZeroPad() {
        if (this._binaryZeroPad === void 0) {
          this._binaryZeroPad = this.bigInt().toString(2).padStart(constants2.BITS, "0");
        }
        return this._binaryZeroPad;
      }
      /**
       * Groups an IPv4 address for inclusion at the end of an IPv6 address.
       *
       * Returns an HTML fragment: each half of the address is wrapped in a
       * `<span>` carrying the group classes an address-inspector UI hovers on.
       * The address content is HTML-escaped; anything you concatenate around it
       * is your responsibility.
       * @returns {String}
       */
      groupForV6() {
        const segments = this.parsedAddress;
        return this.correctForm().replace(constants2.RE_ADDRESS, `<span class="hover-group group-v4 group-6">${segments.slice(0, 2).join(".")}</span>.<span class="hover-group group-v4 group-7">${segments.slice(2, 4).join(".")}</span>`);
      }
    };
    exports.Address4 = Address4;
    var MULTICAST_V4 = new Address4("224.0.0.0/4");
    var PRIVATE_V4 = [
      new Address4("10.0.0.0/8"),
      new Address4("172.16.0.0/12"),
      new Address4("192.168.0.0/16")
    ];
    var LOOPBACK_V4 = new Address4("127.0.0.0/8");
    var LINK_LOCAL_V4 = new Address4("169.254.0.0/16");
    var UNSPECIFIED_V4 = new Address4("0.0.0.0/32");
    var BROADCAST_V4 = new Address4("255.255.255.255/32");
    var CGNAT_V4 = new Address4("100.64.0.0/10");
    var DOCUMENTATION_V4 = [
      new Address4("192.0.2.0/24"),
      new Address4("198.51.100.0/24"),
      new Address4("203.0.113.0/24")
    ];
    var BENCHMARKING_V4 = new Address4("198.18.0.0/15");
    var RESERVED_V4 = new Address4("240.0.0.0/4");
    var SPECIAL_PURPOSE_V4 = constants2.SPECIAL_PURPOSE.map(([cidr, , reachable]) => ({
      subnet: new Address4(cidr),
      reachable
    }));
  }
});

// node_modules/ip-address/dist/v6/constants.js
var require_constants4 = __commonJS({
  "node_modules/ip-address/dist/v6/constants.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SPECIAL_PURPOSE = exports.RE_URL_WITH_PORT = exports.RE_URL = exports.RE_ZONE_STRING = exports.RE_SUBNET_STRING = exports.RE_BAD_ADDRESS = exports.RE_BAD_CHARACTERS = exports.TYPES = exports.SCOPES = exports.GROUPS = exports.BITS = void 0;
    exports.BITS = 128;
    exports.GROUPS = 8;
    exports.SCOPES = {
      0: "Reserved",
      1: "Interface local",
      2: "Link local",
      4: "Admin local",
      5: "Site local",
      8: "Organization local",
      14: "Global",
      15: "Reserved"
    };
    exports.TYPES = {
      "ff01::1/128": "Multicast (All nodes on this interface)",
      "ff01::2/128": "Multicast (All routers on this interface)",
      "ff02::1/128": "Multicast (All nodes on this link)",
      "ff02::2/128": "Multicast (All routers on this link)",
      "ff05::2/128": "Multicast (All routers in this site)",
      "ff02::5/128": "Multicast (OSPFv3 AllSPF routers)",
      "ff02::6/128": "Multicast (OSPFv3 AllDR routers)",
      "ff02::9/128": "Multicast (RIP routers)",
      "ff02::a/128": "Multicast (EIGRP routers)",
      "ff02::d/128": "Multicast (PIM routers)",
      "ff02::16/128": "Multicast (MLDv2 reports)",
      "ff01::fb/128": "Multicast (mDNSv6)",
      "ff02::fb/128": "Multicast (mDNSv6)",
      "ff05::fb/128": "Multicast (mDNSv6)",
      "ff02::1:2/128": "Multicast (All DHCP servers and relay agents on this link)",
      "ff05::1:2/128": "Multicast (All DHCP servers and relay agents in this site)",
      "ff02::1:3/128": "Multicast (All DHCP servers on this link)",
      "ff05::1:3/128": "Multicast (All DHCP servers in this site)",
      "::/128": "Unspecified",
      "::1/128": "Loopback",
      "::ffff:0:0/96": "IPv4-mapped",
      "ff00::/8": "Multicast",
      "fe80::/10": "Link-local unicast",
      "fc00::/7": "Unique local",
      "2001::/32": "Teredo",
      "2001:2::/48": "Benchmarking",
      "2002::/16": "6to4",
      "2001:db8::/32": "Documentation",
      "3fff::/20": "Documentation",
      "100::/64": "Discard-only",
      "fec0::/10": "Site-local unicast (deprecated)",
      "::/96": "IPv4-compatible (deprecated)",
      "64:ff9b::/96": "NAT64 (well-known)",
      "64:ff9b:1::/48": "NAT64 (local-use)"
    };
    exports.RE_BAD_CHARACTERS = /([^0-9a-f:/%])/gi;
    exports.RE_BAD_ADDRESS = /([0-9a-f]{5,}|:{3,}|[^:]:$|^:[^:]|\/$)/gi;
    exports.RE_SUBNET_STRING = /\/\d{1,3}(?=%|$)/;
    exports.RE_ZONE_STRING = /%.*$/;
    exports.RE_URL = /^(?:\[([0-9a-f:.]+)\]|([0-9a-f:.]+))(?:[/?#].*)?$/i;
    exports.RE_URL_WITH_PORT = /^\[([0-9a-f:.]+)\]:([0-9]{1,5})(?:[/?#].*)?$/i;
    exports.SPECIAL_PURPOSE = [
      ["::1/128", "Loopback Address", false],
      ["::/128", "Unspecified Address", false],
      ["::ffff:0:0/96", "IPv4-mapped Address", false],
      ["64:ff9b::/96", "IPv4-IPv6 Translat.", true],
      ["64:ff9b:1::/48", "IPv4-IPv6 Translat.", false],
      ["100::/64", "Discard-Only Address Block", false],
      ["100:0:0:1::/64", "Dummy IPv6 Prefix", false],
      ["2001::/23", "IETF Protocol Assignments", false],
      ["2001::/32", "TEREDO", false],
      ["2001:1::1/128", "Port Control Protocol Anycast", true],
      ["2001:1::2/128", "Traversal Using Relays around NAT Anycast", true],
      ["2001:1::3/128", "DNS-SD Service Registration Protocol Anycast", true],
      ["2001:2::/48", "Benchmarking", false],
      ["2001:3::/32", "AMT", true],
      ["2001:4:112::/48", "AS112-v6", true],
      ["2001:10::/28", "Deprecated (previously ORCHID)", null],
      ["2001:20::/28", "ORCHIDv2", true],
      ["2001:30::/28", "Drone Remote ID Protocol Entity Tags (DETs) Prefix", true],
      ["2001:db8::/32", "Documentation", false],
      ["2002::/16", "6to4", false],
      ["2620:4f:8000::/48", "Direct Delegation AS112 Service", true],
      ["3fff::/20", "Documentation", false],
      ["5f00::/16", "Segment Routing (SRv6) SIDs", false],
      ["fc00::/7", "Unique-Local", false],
      ["fe80::/10", "Link-Local Unicast", false]
    ];
  }
});

// node_modules/ip-address/dist/v6/helpers.js
var require_helpers = __commonJS({
  "node_modules/ip-address/dist/v6/helpers.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.escapeHtml = escapeHtml;
    exports.spanAllZeroes = spanAllZeroes;
    exports.spanAll = spanAll;
    exports.spanLeadingZeroes = spanLeadingZeroes;
    exports.simpleGroup = simpleGroup;
    function escapeHtml(s) {
      return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
    function spanAllZeroes(s) {
      return escapeHtml(s).replace(/(0+)/g, '<span class="zero">$1</span>');
    }
    function spanAll(s, offset = 0) {
      const letters = s.split("");
      return letters.map((n, i) => `<span class="digit value-${escapeHtml(n)} position-${i + offset}">${spanAllZeroes(n)}</span>`).join("");
    }
    function spanLeadingZeroesSimple(group) {
      return escapeHtml(group).replace(/^(0+)/, '<span class="zero">$1</span>');
    }
    function spanLeadingZeroes(address) {
      const groups = address.split(":");
      return groups.map((g) => spanLeadingZeroesSimple(g)).join(":");
    }
    function simpleGroup(addressString, offset = 0) {
      const groups = addressString.split(":");
      return groups.map((g, i) => {
        if (/group-v4/.test(g)) {
          return g;
        }
        return `<span class="hover-group group-${i + offset}">${spanLeadingZeroesSimple(g)}</span>`;
      });
    }
  }
});

// node_modules/ip-address/dist/v6/regular-expressions.js
var require_regular_expressions = __commonJS({
  "node_modules/ip-address/dist/v6/regular-expressions.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports && exports.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ADDRESS_BOUNDARY = void 0;
    exports.groupPossibilities = groupPossibilities;
    exports.padGroup = padGroup;
    exports.simpleRegularExpression = simpleRegularExpression;
    exports.possibleElisions = possibleElisions;
    var v6 = __importStar(require_constants4());
    function groupPossibilities(possibilities) {
      return `(${possibilities.join("|")})`;
    }
    function padGroup(group) {
      if (group.length < 4) {
        return `0{0,${4 - group.length}}${group}`;
      }
      return group;
    }
    exports.ADDRESS_BOUNDARY = "[^A-Fa-f0-9:]";
    function simpleRegularExpression(groups) {
      const zeroIndexes = [];
      groups.forEach((group, i) => {
        const groupInteger = parseInt(group, 16);
        if (groupInteger === 0) {
          zeroIndexes.push(i);
        }
      });
      const possibilities = zeroIndexes.map((zeroIndex) => groups.map((group, i) => {
        if (i === zeroIndex) {
          const elision = i === 0 || i === v6.GROUPS - 1 ? ":" : "";
          return groupPossibilities([padGroup(group), elision]);
        }
        return padGroup(group);
      }).join(":"));
      possibilities.push(groups.map(padGroup).join(":"));
      return groupPossibilities(possibilities);
    }
    function possibleElisions(elidedGroups, moreLeft, moreRight) {
      const left = moreLeft ? "" : ":";
      const right = moreRight ? "" : ":";
      const possibilities = [];
      if (!moreLeft && !moreRight) {
        possibilities.push("::");
      }
      if (moreLeft && moreRight) {
        possibilities.push("");
      }
      if (moreRight && !moreLeft || !moreRight && moreLeft) {
        possibilities.push(":");
      }
      possibilities.push(`${left}(:0{1,4}){1,${elidedGroups - 1}}`);
      possibilities.push(`(0{1,4}:){1,${elidedGroups - 1}}${right}`);
      possibilities.push(`(0{1,4}:){${elidedGroups - 1}}0{1,4}`);
      for (let groups = 1; groups < elidedGroups - 1; groups++) {
        for (let position = 1; position < elidedGroups - groups; position++) {
          possibilities.push(`(0{1,4}:){${position}}:(0{1,4}:){${elidedGroups - position - groups - 1}}0{1,4}`);
        }
      }
      return groupPossibilities(possibilities);
    }
  }
});

// node_modules/ip-address/dist/ipv6.js
var require_ipv6 = __commonJS({
  "node_modules/ip-address/dist/ipv6.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports && exports.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Address6 = void 0;
    var common = __importStar(require_common2());
    var constants4 = __importStar(require_constants3());
    var constants6 = __importStar(require_constants4());
    var helpers = __importStar(require_helpers());
    var ipv4_1 = require_ipv4();
    var regular_expressions_1 = require_regular_expressions();
    var address_error_1 = require_address_error();
    var common_1 = require_common2();
    var isCorrect6 = common.isCorrect(constants6.BITS);
    function assert2(condition) {
      if (!condition) {
        throw new Error("Assertion failed.");
      }
    }
    function addCommas(number) {
      const r = /(\d+)(\d{3})/;
      while (r.test(number)) {
        number = number.replace(r, "$1,$2");
      }
      return number;
    }
    function spanLeadingZeroes4(n) {
      n = n.replace(/^(0{1,})([1-9]+)$/, '<span class="parse-error">$1</span>$2');
      n = n.replace(/^(0{1,})(0)$/, '<span class="parse-error">$1</span>$2');
      return n;
    }
    function compact(address, slice) {
      const s1 = [];
      const s2 = [];
      let i;
      for (i = 0; i < address.length; i++) {
        if (i < slice[0]) {
          s1.push(address[i]);
        } else if (i > slice[1]) {
          s2.push(address[i]);
        }
      }
      return s1.concat(["compact"]).concat(s2);
    }
    function paddedHex(octet) {
      return parseInt(octet, 16).toString(16).padStart(4, "0");
    }
    function unsignByte(b) {
      return b & 255;
    }
    var Address6 = class _Address6 {
      constructor(address, optionalGroups) {
        this.addressMinusSuffix = "";
        this.parsedSubnet = "";
        this.subnet = "/128";
        this.subnetMask = 128;
        this.v4 = false;
        this.zone = "";
        this.isInSubnet = common.isInSubnet;
        this.isHostInSubnet = common.isHostInSubnet;
        this.isCorrect = isCorrect6;
        if (optionalGroups === void 0) {
          this.groups = constants6.GROUPS;
        } else {
          this.groups = optionalGroups;
        }
        this.address = address;
        const subnet = constants6.RE_SUBNET_STRING.exec(address);
        if (subnet) {
          this.parsedSubnet = subnet[0].replace("/", "");
          this.subnetMask = parseInt(this.parsedSubnet, 10);
          this.subnet = `/${this.subnetMask}`;
          if (Number.isNaN(this.subnetMask) || this.subnetMask < 0 || this.subnetMask > constants6.BITS) {
            throw new address_error_1.AddressError("Invalid subnet mask.");
          }
          address = address.replace(constants6.RE_SUBNET_STRING, "");
        }
        if (/\//.test(address)) {
          throw new address_error_1.AddressError("Invalid subnet mask.");
        }
        const zoneStart = address.indexOf("%");
        if (zoneStart !== -1 && /^.*$/.test(address.slice(zoneStart))) {
          this.zone = address.slice(zoneStart);
          address = address.slice(0, zoneStart);
        }
        const longest = this.groups * 5 + 5;
        if (address.length > longest) {
          throw new address_error_1.AddressError(`IPv6 addresses are at most ${longest} characters.`);
        }
        this.addressMinusSuffix = address;
        this.parsedAddress = this.parse(this.addressMinusSuffix);
      }
      /**
       * Returns true if the given string is a valid IPv6 address (with optional
       * CIDR subnet and zone identifier), false otherwise. Host bits in the
       * subnet portion are allowed (e.g. `2001:db8::1/32` is valid); for strict
       * network-address validation compare `correctForm()` to
       * `startAddress().correctForm()`, or use `networkForm()`.
       */
      static isValid(address) {
        try {
          new _Address6(address);
          return true;
        } catch {
          return false;
        }
      }
      /**
       * Convert a BigInt to a v6 address object. The value must be in the
       * range `[0, 2**128 - 1]`; otherwise `AddressError` is thrown.
       * @param {bigint} bigInt - a BigInt to convert
       * @returns {Address6}
       * @example
       * var bigInt = BigInt('1000000000000');
       * var address = Address6.fromBigInt(bigInt);
       * address.correctForm(); // '::e8:d4a5:1000'
       */
      static fromBigInt(bigInt) {
        if (bigInt < BigInt(0) || bigInt > (BigInt(1) << BigInt(constants6.BITS)) - BigInt(1)) {
          throw new address_error_1.AddressError("IPv6 BigInt must be in the range 0 to 2**128 - 1");
        }
        const hex = bigInt.toString(16).padStart(32, "0");
        const groups = [];
        for (let i = 0; i < constants6.GROUPS; i++) {
          groups.push(hex.slice(i * 4, (i + 1) * 4));
        }
        return new _Address6(groups.join(":"));
      }
      /**
       * Parse a URL (with optional bracketed host and port) into an address and
       * port. Returns either `{ address, port }` on success or
       * `{ error, address: null, port: null }` if the URL could not be parsed.
       * Ports are returned as numbers (or `null` if absent or out of range).
       * @example
       * var addressAndPort = Address6.fromURL('http://[ffff::]:8080/foo/');
       * addressAndPort.address.correctForm(); // 'ffff::'
       * addressAndPort.port; // 8080
       */
      static fromURL(url) {
        var _a;
        let host;
        let port = null;
        let result;
        let error;
        const stripped = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
        if (stripped.indexOf("[") !== -1 && stripped.indexOf("]:") !== -1) {
          error = "failed to parse address with port";
          result = constants6.RE_URL_WITH_PORT.exec(stripped);
          if (result === null) {
            return { error, address: null, port: null };
          }
          host = result[1];
          port = result[2];
        } else {
          error = "failed to parse address from URL";
          result = constants6.RE_URL.exec(stripped);
          if (result === null) {
            return { error, address: null, port: null };
          }
          host = (_a = result[1]) !== null && _a !== void 0 ? _a : result[2];
        }
        if (port) {
          port = parseInt(port, 10);
          if (port < 0 || port > 65535) {
            port = null;
          }
        } else {
          port = null;
        }
        let address;
        try {
          address = new _Address6(host);
        } catch {
          return { error, address: null, port: null };
        }
        return { address, port };
      }
      /**
       * Construct an `Address6` from an address and a hex subnet mask given as
       * separate strings (e.g. as returned by Node's `os.networkInterfaces()`).
       * Throws `AddressError` if the mask is non-contiguous (e.g.
       * `ffff::ffff`).
       * @example
       * var address = Address6.fromAddressAndMask('fe80::1', 'ffff:ffff:ffff:ffff::');
       * address.subnetMask; // 64
       */
      static fromAddressAndMask(address, mask) {
        const bits = common.prefixLengthFromMask(new _Address6(mask).bigInt(), constants6.BITS);
        return new _Address6(`${address}/${bits}`);
      }
      /**
       * Construct an `Address6` from an address and a Cisco-style wildcard mask
       * given as separate strings (e.g. `::ffff:ffff:ffff:ffff` for a `/64`).
       * The wildcard mask is the bitwise inverse of the subnet mask. Throws
       * `AddressError` if the mask is non-contiguous.
       * @example
       * var address = Address6.fromAddressAndWildcardMask('fe80::1', '::ffff:ffff:ffff:ffff');
       * address.subnetMask; // 64
       */
      static fromAddressAndWildcardMask(address, wildcardMask) {
        const wildcard = new _Address6(wildcardMask).bigInt();
        const allOnes = (BigInt(1) << BigInt(constants6.BITS)) - BigInt(1);
        const mask = wildcard ^ allOnes;
        const bits = common.prefixLengthFromMask(mask, constants6.BITS);
        return new _Address6(`${address}/${bits}`);
      }
      /**
       * Construct an `Address6` from a wildcard pattern with trailing `*`
       * groups. The number of trailing wildcards determines the prefix
       * length: each `*` represents 16 bits. `::` is expanded to zero groups
       * (not wildcards) before evaluating trailing wildcards.
       *
       * Only trailing whole-group wildcards are supported. Partial-group
       * wildcards (e.g. `2001:db8::0*`) and interior wildcards (e.g.
       * `*::1`) throw `AddressError`.
       * @example
       * Address6.fromWildcard('2001:db8:*:*:*:*:*:*').subnet;  // '/32'
       * Address6.fromWildcard('2001:db8::*').subnet;           // '/112'
       * Address6.fromWildcard('*:*:*:*:*:*:*:*').subnet;       // '/0'
       */
      static fromWildcard(input) {
        if (input.includes("%") || input.includes("/")) {
          throw new address_error_1.AddressError("Wildcard pattern must not include a zone or CIDR suffix");
        }
        const halves = input.split("::");
        if (halves.length > 2) {
          throw new address_error_1.AddressError("Wildcard pattern cannot contain more than one '::'");
        }
        let groups;
        if (halves.length === 2) {
          const left = halves[0] === "" ? [] : halves[0].split(":");
          const right = halves[1] === "" ? [] : halves[1].split(":");
          const remaining = constants6.GROUPS - left.length - right.length;
          if (remaining < 1) {
            throw new address_error_1.AddressError("Wildcard pattern with '::' has too many groups");
          }
          groups = [...left, ...new Array(remaining).fill("0"), ...right];
        } else {
          groups = input.split(":");
        }
        if (groups.length !== constants6.GROUPS) {
          throw new address_error_1.AddressError("Wildcard pattern must have 8 groups");
        }
        let firstWildcard = -1;
        for (let i = 0; i < groups.length; i++) {
          if (groups[i] === "*") {
            if (firstWildcard === -1) {
              firstWildcard = i;
            }
          } else if (firstWildcard !== -1) {
            throw new address_error_1.AddressError("Wildcard `*` must only appear in trailing groups (e.g. `2001:db8:*:*:*:*:*:*`)");
          }
        }
        const trailing = firstWildcard === -1 ? 0 : groups.length - firstWildcard;
        const replaced = groups.map((g) => g === "*" ? "0" : g);
        const subnetBits = constants6.BITS - trailing * 16;
        return new _Address6(`${replaced.join(":")}/${subnetBits}`);
      }
      /**
       * Create an IPv6-mapped address given an IPv4 address
       * @param {string} address - An IPv4 address string
       * @returns {Address6}
       * @example
       * var address = Address6.fromAddress4('192.168.0.1');
       * address.correctForm(); // '::ffff:c0a8:1'
       * address.to4in6(); // '::ffff:192.168.0.1'
       */
      static fromAddress4(address) {
        const address4 = new ipv4_1.Address4(address);
        const mask6 = constants6.BITS - (constants4.BITS - address4.subnetMask);
        return new _Address6(`::ffff:${address4.correctForm()}/${mask6}`);
      }
      /**
       * Return an address from ip6.arpa form. A full 32-nibble name gives a /128
       * address; a shorter name, as used for a delegated reverse zone, gives the
       * network it covers, with a subnet mask of four bits per nibble, so
       * `fromArpa(x.reverseForm())` round-trips {@link reverseForm} for any prefix.
       * @param {string} arpaFormAddress - an 'ip6.arpa' form address
       * @returns {Adress6}
       * @example
       * var address = Address6.fromArpa(e.f.f.f.3.c.2.6.f.f.f.e.6.6.8.e.1.0.6.7.9.4.e.c.0.0.0.0.1.0.0.2.ip6.arpa.)
       * address.correctForm(); // '2001:0:ce49:7601:e866:efff:62c3:fffe'
       * Address6.fromArpa('8.b.d.0.1.0.0.2.ip6.arpa.').networkForm(); // '2001:db8::/32'
       */
      static fromArpa(arpaFormAddress) {
        const nibbles = arpaFormAddress.replace(/(\.ip6\.arpa)?\.?$/i, "");
        if (!/^[0-9a-f](\.[0-9a-f]){0,31}$/i.test(nibbles)) {
          throw new address_error_1.AddressError("Invalid 'ip6.arpa' form.");
        }
        const reversed = nibbles.split(".").reverse();
        const subnetMask = reversed.length * 4;
        const hex = reversed.join("").padEnd(32, "0");
        const groups = [];
        for (let i = 0; i < constants6.GROUPS; i++) {
          groups.push(hex.slice(i * 4, (i + 1) * 4));
        }
        return new _Address6(`${groups.join(":")}/${subnetMask}`);
      }
      /**
       * Return the Microsoft UNC transcription of the address
       * @returns {String} the Microsoft UNC transcription of the address
       */
      microsoftTranscription() {
        return `${this.correctForm().replace(/:/g, "-")}.ipv6-literal.net`;
      }
      /**
       * Return the first n bits of the address, defaulting to the subnet mask
       * @param {number} [mask=subnet] - the number of bits to mask
       * @returns {String} the first n bits of the address as a string
       */
      mask(mask = this.subnetMask) {
        return this.getBitsBase2(0, mask);
      }
      /**
       * Return the number of possible subnets of a given size in the address
       * @param {number} [subnetSize=128] - the subnet size
       * @returns {String}
       */
      // TODO: probably useful to have a numeric version of this too
      possibleSubnets(subnetSize = 128) {
        const availableBits = constants6.BITS - this.subnetMask;
        const subnetBits = Math.abs(subnetSize - constants6.BITS);
        const subnetPowers = availableBits - subnetBits;
        if (subnetPowers < 0) {
          return "0";
        }
        return addCommas((BigInt("2") ** BigInt(subnetPowers)).toString(10));
      }
      /**
       * Helper function getting start address.
       * @returns {bigint}
       */
      _startAddress() {
        return BigInt(`0b${this.mask() + "0".repeat(constants6.BITS - this.subnetMask)}`);
      }
      /**
       * The first address in the range given by this address' subnet
       * Often referred to as the Network Address.
       * @returns {Address6}
       */
      startAddress() {
        return _Address6.fromBigInt(this._startAddress());
      }
      /**
       * The first host address in the range given by this address's subnet ie
       * the first address after the Network Address
       * @returns {Address6}
       */
      startAddressExclusive() {
        const adjust = BigInt("1");
        return _Address6.fromBigInt(this._startAddress() + adjust);
      }
      /**
       * Helper function getting end address.
       * @returns {bigint}
       */
      _endAddress() {
        return BigInt(`0b${this.mask() + "1".repeat(constants6.BITS - this.subnetMask)}`);
      }
      /**
       * The last address in the range given by this address's subnet. IPv6 has
       * no broadcast address, so this is an ordinary assignable address (in a
       * 64-bit-interface-identifier subnet it falls inside the reserved
       * subnet-anycast block of [RFC 2526](https://datatracker.ietf.org/doc/html/rfc2526)).
       * @returns {Address6}
       */
      endAddress() {
        return _Address6.fromBigInt(this._endAddress());
      }
      /**
       * The address one before {@link endAddress}. This is the IPv6 counterpart
       * of the IPv4 method that skips the broadcast address; IPv6 has no broadcast,
       * so it drops exactly one address and does not model the 128 reserved
       * subnet-anycast identifiers of [RFC 2526](https://datatracker.ietf.org/doc/html/rfc2526).
       * @returns {Address6}
       */
      endAddressExclusive() {
        const adjust = BigInt("1");
        return _Address6.fromBigInt(this._endAddress() - adjust);
      }
      /**
       * Returns the address `n` addresses after this one (or before, when `n` is
       * negative), keeping this address's subnet mask. Throws `AddressError` when
       * the result would fall outside the IPv6 address space or `n` is not an
       * integer.
       * @param {number | bigint} n
       * @returns {Address6}
       * @example
       * new Address6('2001:db8::/64').offset(1).correctForm(); // '2001:db8::1'
       */
      offset(n) {
        return _Address6.fromBigInt(common.offsetBigInt(this.bigInt(), n, constants6.BITS, "IPv6")).withSubnetMask(this.subnetMask);
      }
      /**
       * Returns the network that follows this address's network: the address after
       * {@link endAddress}, with the same subnet mask. Throws `AddressError` when
       * this network is the last one in the address space.
       * @returns {Address6}
       * @example
       * new Address6('2001:db8::/64').nextNetwork().networkForm(); // '2001:db8:0:1::/64'
       */
      nextNetwork() {
        return _Address6.fromBigInt(common.offsetBigInt(this._endAddress(), 1, constants6.BITS, "IPv6")).withSubnetMask(this.subnetMask);
      }
      withSubnetMask(subnetMask) {
        return new _Address6(`${this.correctForm()}/${subnetMask}`);
      }
      /**
       * The hex form of the subnet mask, e.g. `ffff:ffff:ffff:ffff::` for a
       * `/64`. Returns an `Address6`; call `.correctForm()` for the string.
       * @returns {Address6}
       */
      subnetMaskAddress() {
        return _Address6.fromBigInt(BigInt(`0b${"1".repeat(this.subnetMask)}${"0".repeat(constants6.BITS - this.subnetMask)}`));
      }
      /**
       * The Cisco-style wildcard mask, e.g. `::ffff:ffff:ffff:ffff` for a
       * `/64`. This is the bitwise inverse of `subnetMaskAddress()`. Returns
       * an `Address6`; call `.correctForm()` for the string.
       * @returns {Address6}
       */
      wildcardMask() {
        return _Address6.fromBigInt(BigInt(`0b${"0".repeat(this.subnetMask)}${"1".repeat(constants6.BITS - this.subnetMask)}`));
      }
      /**
       * The network address in CIDR string form, e.g. `2001:db8::/32` for
       * `2001:db8::1/32`. For an address with no explicit subnet the prefix
       * is `/128`, e.g. `networkForm()` on `2001:db8::1` returns
       * `2001:db8::1/128`.
       * @returns {string}
       */
      networkForm() {
        return `${this.startAddress().correctForm()}/${this.subnetMask}`;
      }
      /**
       * Return the scope of the address. The 4-bit scope field
       * ([RFC 4291 §2.7](https://datatracker.ietf.org/doc/html/rfc4291#section-2.7))
       * is only defined for multicast addresses; for unicast addresses the scope
       * is derived from the address type per
       * [RFC 4007 §6](https://datatracker.ietf.org/doc/html/rfc4007#section-6).
       * @returns {String}
       */
      getScope() {
        const type = this.getType();
        if (type === "Multicast" || type.startsWith("Multicast ")) {
          const scope = constants6.SCOPES[parseInt(this.getBits(12, 16).toString(10), 10)];
          return scope || "Unknown";
        }
        if (type === "Link-local unicast" || type === "Loopback") {
          return "Link local";
        }
        if (type === "Unspecified") {
          return "Unknown";
        }
        return "Global";
      }
      /**
       * Return the type of the address
       * @returns {String}
       */
      getType() {
        for (let i = 0; i < TYPE_SUBNETS.length; i++) {
          const entry = TYPE_SUBNETS[i];
          if (this.isHostInSubnet(entry[0])) {
            return entry[1];
          }
        }
        return "Global unicast";
      }
      /**
       * Return the bits in the given range as a BigInt
       * @returns {bigint}
       */
      getBits(start, end) {
        return BigInt(`0b${this.getBitsBase2(start, end)}`);
      }
      /**
       * Return the bits in the given range as a base-2 string
       * @returns {String}
       */
      getBitsBase2(start, end) {
        return this.binaryZeroPad().slice(start, end);
      }
      /**
       * Return the bits in the given range as a base-16 string
       * @returns {String}
       */
      getBitsBase16(start, end) {
        const length = end - start;
        if (length % 4 !== 0) {
          throw new Error("Length of bits to retrieve must be divisible by four");
        }
        return this.getBits(start, end).toString(16).padStart(length / 4, "0");
      }
      /**
       * Return the bits that are set past the subnet mask length
       * @returns {String}
       */
      getBitsPastSubnet() {
        return this.getBitsBase2(this.subnetMask, constants6.BITS);
      }
      /**
       * Return the reversed ip6.arpa form of the address
       * @param {Object} options
       * @param {boolean} options.omitSuffix - omit the "ip6.arpa" suffix
       * @returns {String}
       */
      reverseForm(options) {
        if (!options) {
          options = {};
        }
        const characters = Math.floor(this.subnetMask / 4);
        const reversed = this.canonicalForm().replace(/:/g, "").split("").slice(0, characters).reverse().join(".");
        if (characters > 0) {
          if (options.omitSuffix) {
            return reversed;
          }
          return `${reversed}.ip6.arpa.`;
        }
        if (options.omitSuffix) {
          return "";
        }
        return "ip6.arpa.";
      }
      /**
       * Returns the address in correct form, per
       * [RFC 5952](https://datatracker.ietf.org/doc/html/rfc5952): leading zeros
       * stripped, the longest run of zero groups collapsed to `::`, and hex digits
       * lowercased (e.g. `2001:db8::1`). This is the recommended form for display.
       */
      correctForm() {
        let i;
        let groups = [];
        let zeroCounter = 0;
        const zeroes = [];
        for (i = 0; i < this.parsedAddress.length; i++) {
          const value = parseInt(this.parsedAddress[i], 16);
          if (value === 0) {
            zeroCounter++;
          }
          if (value !== 0 && zeroCounter > 0) {
            if (zeroCounter > 1) {
              zeroes.push([i - zeroCounter, i - 1]);
            }
            zeroCounter = 0;
          }
        }
        if (zeroCounter > 1) {
          zeroes.push([this.parsedAddress.length - zeroCounter, this.parsedAddress.length - 1]);
        }
        const zeroLengths = zeroes.map((n) => n[1] - n[0] + 1);
        if (zeroes.length > 0) {
          const index = zeroLengths.indexOf(Math.max(...zeroLengths));
          groups = compact(this.parsedAddress, zeroes[index]);
        } else {
          groups = this.parsedAddress;
        }
        for (i = 0; i < groups.length; i++) {
          if (groups[i] !== "compact") {
            groups[i] = parseInt(groups[i], 16).toString(16);
          }
        }
        let correct = groups.join(":");
        correct = correct.replace(/^compact$/, "::");
        correct = correct.replace(/(^compact)|(compact$)/, ":");
        correct = correct.replace(/compact/, "");
        return correct;
      }
      /**
       * Return a zero-padded base-2 string representation of the address
       * @returns {String}
       * @example
       * var address = new Address6('2001:4860:4001:803::1011');
       * address.binaryZeroPad();
       * // '0010000000000001010010000110000001000000000000010000100000000011
       * //  0000000000000000000000000000000000000000000000000001000000010001'
       */
      binaryZeroPad() {
        if (this._binaryZeroPad === void 0) {
          this._binaryZeroPad = this.bigInt().toString(2).padStart(constants6.BITS, "0");
        }
        return this._binaryZeroPad;
      }
      /**
       * Parses a v4-in-v6 string (e.g. `::ffff:192.168.0.1`) by extracting the
       * trailing IPv4 address into `this.address4` / `this.parsedAddress4` and
       * returning the address with the v4 portion converted to two v6 groups.
       * Used internally by `parse()`.
       */
      // TODO: Improve the semantics of this helper function
      parse4in6(address) {
        if (address.indexOf(".") === -1) {
          return address;
        }
        const groups = address.split(":");
        const lastGroup = groups.slice(-1)[0];
        const v4Octets = lastGroup.split(".");
        if (v4Octets.length === constants4.GROUPS && v4Octets.every((octet) => /^\d{1,3}$/.test(octet))) {
          if (v4Octets.some((octet) => /^0\d/.test(octet))) {
            const highlighted = v4Octets.map(spanLeadingZeroes4).join(".");
            const prefix = groups.slice(0, -1).map(helpers.escapeHtml).join(":");
            const separator = groups.length > 1 ? ":" : "";
            throw new address_error_1.AddressError("IPv4 addresses can't have leading zeroes.", `${prefix}${separator}${highlighted}`);
          }
        }
        const address4 = lastGroup.match(constants4.RE_ADDRESS);
        if (address4) {
          this.parsedAddress4 = address4[0];
          const v4Suffix = this.subnetMask >= 96 ? `/${this.subnetMask - 96}` : "";
          this.address4 = new ipv4_1.Address4(`${this.parsedAddress4}${v4Suffix}`);
          this.v4 = true;
          groups[groups.length - 1] = this.address4.toGroup6();
          address = groups.join(":");
        }
        return address;
      }
      /**
       * Parses an IPv6 address string into its 8 hexadecimal groups (expanding
       * any `::` elision and any trailing v4-in-v6 portion) and stores the result
       * on `this.parsedAddress`. Called automatically by the constructor; you
       * typically don't need to call it directly. Throws `AddressError` if the
       * input is malformed.
       */
      // TODO: Make private?
      parse(address) {
        address = this.parse4in6(address);
        const badCharacters = address.match(constants6.RE_BAD_CHARACTERS);
        if (badCharacters) {
          throw new address_error_1.AddressError(`Bad character${badCharacters.length > 1 ? "s" : ""} detected in address: ${badCharacters.join("")}`, address.replace(constants6.RE_BAD_CHARACTERS, (character) => `<span class="parse-error">${helpers.escapeHtml(character)}</span>`));
        }
        const badAddress = address.match(constants6.RE_BAD_ADDRESS);
        if (badAddress) {
          throw new address_error_1.AddressError(`Address failed regex: ${badAddress.join("")}`, address.replace(constants6.RE_BAD_ADDRESS, '<span class="parse-error">$1</span>'));
        }
        let groups = [];
        const halves = address.split("::");
        if (halves.length === 2) {
          let first = halves[0].split(":");
          let last = halves[1].split(":");
          if (first.length === 1 && first[0] === "") {
            first = [];
          }
          if (last.length === 1 && last[0] === "") {
            last = [];
          }
          const remaining = this.groups - (first.length + last.length);
          if (!remaining) {
            throw new address_error_1.AddressError("Error parsing groups");
          }
          this.elidedGroups = remaining;
          this.elisionBegin = first.length;
          this.elisionEnd = first.length + this.elidedGroups;
          groups = groups.concat(first);
          for (let i = 0; i < remaining; i++) {
            groups.push("0");
          }
          groups = groups.concat(last);
        } else if (halves.length === 1) {
          groups = address.split(":");
          this.elidedGroups = 0;
        } else {
          throw new address_error_1.AddressError("Too many :: groups found");
        }
        groups = groups.map((group) => parseInt(group, 16).toString(16));
        if (groups.length !== this.groups) {
          throw new address_error_1.AddressError("Incorrect number of groups found");
        }
        return groups;
      }
      /**
       * Returns the canonical (fully expanded) form of the address: all 8 groups,
       * each padded to 4 hex digits, with no `::` collapsing
       * (e.g. `2001:0db8:0000:0000:0000:0000:0000:0001`). Useful for sorting and
       * byte-exact comparison.
       */
      canonicalForm() {
        return this.parsedAddress.map(paddedHex).join(":");
      }
      /**
       * Return the decimal form of the address
       * @returns {String}
       */
      decimal() {
        return this.parsedAddress.map((n) => parseInt(n, 16).toString(10).padStart(5, "0")).join(":");
      }
      /**
       * Return the address as a BigInt
       * @returns {bigint}
       */
      bigInt() {
        return BigInt(`0x${this.parsedAddress.map(paddedHex).join("")}`);
      }
      /**
       * Return the last two groups of this address as an IPv4 address string.
       * If this address carries a CIDR prefix that covers the trailing 32 bits
       * (i.e. `subnetMask >= 96`), the resulting `Address4` inherits the
       * corresponding v4 prefix (`subnetMask - 96`); otherwise it defaults to
       * `/32`.
       * @returns {Address4}
       * @example
       * var address = new Address6('2001:4860:4001::1825:bf11');
       * address.to4().correctForm(); // '24.37.191.17'
       */
      to4() {
        const binary = this.binaryZeroPad().split("");
        const hex = BigInt(`0b${binary.slice(96, 128).join("")}`).toString(16).padStart(8, "0");
        if (this.subnetMask >= 96) {
          const v4Mask = this.subnetMask - 96;
          const groups = [];
          for (let i = 0; i < 8; i += 2) {
            groups.push(parseInt(hex.slice(i, i + 2), 16));
          }
          return new ipv4_1.Address4(`${groups.join(".")}/${v4Mask}`);
        }
        return ipv4_1.Address4.fromHex(hex);
      }
      /**
       * Return the v4-in-v6 form of the address
       * @returns {String}
       */
      to4in6() {
        const address4 = this.to4();
        const address6 = new _Address6(this.parsedAddress.slice(0, 6).join(":"), 6);
        const correct = address6.correctForm();
        let infix = "";
        if (!/:$/.test(correct)) {
          infix = ":";
        }
        return correct + infix + address4.correctForm();
      }
      /**
       * Decodes the Teredo tunneling fields embedded in this address. Returns the
       * Teredo prefix, server IPv4, client IPv4, raw flag bits, cone-NAT flag,
       * UDP port, and Microsoft-format flag breakdown (reserved, universal/local,
       * group/individual, nonce). Only meaningful for addresses in `2001::/32`.
       */
      inspectTeredo() {
        const prefix = this.getBitsBase16(0, 32);
        const bitsForUdpPort = this.getBits(80, 96);
        const udpPort = (bitsForUdpPort ^ BigInt("0xffff")).toString();
        const server4 = ipv4_1.Address4.fromHex(this.getBitsBase16(32, 64));
        const bitsForClient4 = this.getBits(96, 128);
        const client4 = ipv4_1.Address4.fromHex((bitsForClient4 ^ BigInt("0xffffffff")).toString(16).padStart(8, "0"));
        const flagsBase2 = this.getBitsBase2(64, 80);
        const coneNat = (0, common_1.testBit)(flagsBase2, 15);
        const reserved = (0, common_1.testBit)(flagsBase2, 14);
        const groupIndividual = (0, common_1.testBit)(flagsBase2, 8);
        const universalLocal = (0, common_1.testBit)(flagsBase2, 9);
        const nonce = BigInt(`0b${flagsBase2.slice(2, 6) + flagsBase2.slice(8, 16)}`).toString(10);
        return {
          prefix: `${prefix.slice(0, 4)}:${prefix.slice(4, 8)}`,
          server4: server4.address,
          client4: client4.address,
          flags: flagsBase2,
          coneNat,
          microsoft: {
            reserved,
            universalLocal,
            groupIndividual,
            nonce
          },
          udpPort
        };
      }
      /**
       * Decodes the 6to4 tunneling fields embedded in this address. Returns the
       * 6to4 prefix and the embedded IPv4 gateway address. Only meaningful for
       * addresses in `2002::/16`.
       */
      inspect6to4() {
        const prefix = this.getBitsBase16(0, 16);
        const gateway = ipv4_1.Address4.fromHex(this.getBitsBase16(16, 48));
        return {
          prefix: prefix.slice(0, 4),
          gateway: gateway.address
        };
      }
      /**
       * Return a v6 6to4 address from a v6 v4inv6 address
       * @returns {Address6}
       */
      to6to4() {
        if (!this.is4()) {
          return null;
        }
        const addr6to4 = [
          "2002",
          this.getBitsBase16(96, 112),
          this.getBitsBase16(112, 128),
          "",
          "/16"
        ].join(":");
        return new _Address6(addr6to4);
      }
      /**
       * Embed an IPv4 address into a NAT64 IPv6 address using the encoding
       * defined by [RFC 6052](https://datatracker.ietf.org/doc/html/rfc6052).
       * The default prefix is the well-known prefix `64:ff9b::/96`. The prefix
       * length must be one of 32, 40, 48, 56, 64, or 96; for prefixes shorter
       * than /64 the IPv4 octets are split around the reserved bits 64–71.
       * @example
       * Address6.fromAddress4Nat64('192.0.2.33').correctForm(); // '64:ff9b::c000:221'
       * Address6.fromAddress4Nat64('192.0.2.33', '2001:db8::/32').correctForm(); // '2001:db8:c000:221::'
       */
      static fromAddress4Nat64(address, prefix = "64:ff9b::/96") {
        const v4 = new ipv4_1.Address4(address);
        const prefix6 = new _Address6(prefix);
        const pl = prefix6.subnetMask;
        if (pl !== 32 && pl !== 40 && pl !== 48 && pl !== 56 && pl !== 64 && pl !== 96) {
          throw new address_error_1.AddressError("NAT64 prefix length must be 32, 40, 48, 56, 64, or 96");
        }
        const prefixBits = prefix6.binaryZeroPad();
        const v4Bits = v4.binaryZeroPad();
        let bits;
        if (pl === 96) {
          bits = prefixBits.slice(0, 96) + v4Bits;
        } else {
          const beforeU = 64 - pl;
          bits = [
            prefixBits.slice(0, pl),
            v4Bits.slice(0, beforeU),
            // Bits 64 to 71 are the reserved u octet and are always zero.
            "00000000",
            v4Bits.slice(beforeU),
            "0".repeat(128 - 72 - (32 - beforeU))
          ].join("");
        }
        const hex = BigInt(`0b${bits}`).toString(16).padStart(32, "0");
        const groups = [];
        for (let i = 0; i < 8; i++) {
          groups.push(hex.slice(i * 4, (i + 1) * 4));
        }
        return new _Address6(groups.join(":"));
      }
      /**
       * Extract the embedded IPv4 address from a NAT64 IPv6 address using the
       * encoding defined by [RFC 6052](https://datatracker.ietf.org/doc/html/rfc6052).
       * The default prefix is the well-known prefix `64:ff9b::/96`. Returns
       * `null` if this address is not contained within the given prefix.
       * @example
       * new Address6('64:ff9b::c000:221').toAddress4Nat64()!.correctForm(); // '192.0.2.33'
       */
      toAddress4Nat64(prefix = "64:ff9b::/96") {
        const prefix6 = new _Address6(prefix);
        const pl = prefix6.subnetMask;
        if (pl !== 32 && pl !== 40 && pl !== 48 && pl !== 56 && pl !== 64 && pl !== 96) {
          throw new address_error_1.AddressError("NAT64 prefix length must be 32, 40, 48, 56, 64, or 96");
        }
        if (!this.isHostInSubnet(prefix6)) {
          return null;
        }
        const bits = this.binaryZeroPad();
        let v4Bits;
        if (pl === 96) {
          v4Bits = bits.slice(96, 128);
        } else {
          const beforeU = 64 - pl;
          v4Bits = bits.slice(pl, pl + beforeU) + bits.slice(72, 72 + (32 - beforeU));
        }
        const octets = [];
        for (let i = 0; i < 4; i++) {
          octets.push(parseInt(v4Bits.slice(i * 8, (i + 1) * 8), 2).toString());
        }
        return new ipv4_1.Address4(octets.join("."));
      }
      /**
       * Return a byte array.
       *
       * To get a Node.js `Buffer`, wrap the result: `Buffer.from(address.toByteArray())`.
       * @returns {Array}
       */
      toByteArray() {
        const value = this.bigInt().toString(16).padStart(constants6.BITS / 4, "0");
        const bytes = [];
        for (let i = 0, length = value.length; i < length; i += 2) {
          bytes.push(parseInt(value.substring(i, i + 2), 16));
        }
        return bytes;
      }
      /**
       * Return an unsigned byte array.
       *
       * To get a Node.js `Buffer`, wrap the result: `Buffer.from(address.toUnsignedByteArray())`.
       * @returns {Array}
       */
      toUnsignedByteArray() {
        return this.toByteArray().map(unsignByte);
      }
      /**
       * Convert a byte array to an Address6 object.
       *
       * Accepts unsigned bytes (0 to 255) or signed bytes (-128 to 127, as an
       * `Int8Array` or a Java `byte[]` holds them), folding signed values to their
       * unsigned equivalent. Throws `AddressError` unless given exactly 16
       * integers from -128 to 255.
       *
       * To convert from a Node.js `Buffer`, spread it: `Address6.fromByteArray([...buf])`.
       * @returns {Address6}
       */
      static fromByteArray(bytes) {
        common.assertByteArray(bytes, 16, "IPv6", -128);
        return this.fromUnsignedByteArray(bytes.map(unsignByte));
      }
      /**
       * Convert an unsigned byte array to an Address6 object.
       *
       * Throws `AddressError` unless given exactly 16 integers from 0 to 255.
       *
       * To convert from a Node.js `Buffer`, spread it: `Address6.fromUnsignedByteArray([...buf])`.
       * @returns {Address6}
       */
      static fromUnsignedByteArray(bytes) {
        common.assertByteArray(bytes, 16, "IPv6", 0);
        const BYTE_MAX = BigInt("256");
        let result = BigInt("0");
        let multiplier = BigInt("1");
        for (let i = bytes.length - 1; i >= 0; i--) {
          result += multiplier * BigInt(bytes[i].toString(10));
          multiplier *= BYTE_MAX;
        }
        return _Address6.fromBigInt(result);
      }
      /**
       * Returns true if the address is in the canonical form, false otherwise
       * @returns {boolean}
       */
      isCanonical() {
        return this.addressMinusSuffix === this.canonicalForm();
      }
      /**
       * Returns true if the address is a link-local unicast address in `fe80::/10`
       * ([RFC 4291 §2.4](https://datatracker.ietf.org/doc/html/rfc4291#section-2.4))
       * or an IPv4-mapped / NAT64 address whose embedded IPv4 address is link-local
       * (`169.254.0.0/16`, e.g. `::ffff:169.254.169.254`), false otherwise.
       * @returns {boolean}
       */
      isLinkLocal() {
        const embedded = this.embeddedIPv4();
        if (embedded) {
          return embedded.isLinkLocal();
        }
        return this.isHostInSubnet(LINK_LOCAL_SUBNET);
      }
      /**
       * Returns true if the address is a multicast address, false otherwise
       * @returns {boolean}
       */
      isMulticast() {
        const embedded = this.embeddedIPv4();
        if (embedded) {
          return embedded.isMulticast();
        }
        const type = this.getType();
        return type === "Multicast" || type.startsWith("Multicast ");
      }
      /**
       * Returns true if the address was written in v4-in-v6 dotted-quad notation
       * (e.g. `::ffff:127.0.0.1`), false otherwise. This is a notation-level flag
       * and does not reflect whether the address bits lie in the IPv4-mapped
       * (`::ffff:0:0/96`) subnet — for that, see {@link isMapped4}.
       * @returns {boolean}
       */
      is4() {
        return this.v4;
      }
      /**
       * Returns true if the address is an IPv4-mapped IPv6 address in
       * `::ffff:0:0/96` ([RFC 4291 §2.5.5.2](https://datatracker.ietf.org/doc/html/rfc4291#section-2.5.5.2)),
       * false otherwise. Unlike {@link is4}, this checks the underlying address
       * bits rather than the textual notation, so `::ffff:127.0.0.1` and
       * `::ffff:7f00:1` both return true.
       * @returns {boolean}
       */
      isMapped4() {
        return this.isHostInSubnet(IPV4_MAPPED_SUBNET);
      }
      /**
       * If this address embeds a routable IPv4 address — i.e. it is IPv4-mapped
       * (`::ffff:0:0/96`) or sits in the NAT64 well-known prefix (`64:ff9b::/96`,
       * [RFC 6052](https://datatracker.ietf.org/doc/html/rfc6052)) — return that
       * embedded address as an {@link Address4}; otherwise return null.
       *
       * The special-property checks (`isLoopback`, `isLinkLocal`, `isMulticast`,
       * `isUnspecified`, `isPrivate`, `isCGNAT`, `isBroadcast`) call this first and
       * delegate to the embedded {@link Address4} when present, so a literal such as
       * `::ffff:127.0.0.1` is classified by what it actually reaches (loopback)
       * rather than by its IPv6 wrapper (which `getType()` reports as IPv4-mapped).
       * This matters wherever the checks back a trust-boundary decision (e.g. an
       * SSRF allow/deny filter): without normalization, `::ffff:10.0.0.1`,
       * `::ffff:169.254.169.254`, `64:ff9b::7f00:1`, etc. would all read as
       * non-internal.
       * @returns {Address4 | null}
       */
      embeddedIPv4() {
        if (this.isMapped4() || this.isHostInSubnet(NAT64_WELL_KNOWN_SUBNET)) {
          return this.to4();
        }
        return null;
      }
      /**
       * Returns true if the address is a Teredo address, false otherwise
       * @returns {boolean}
       */
      isTeredo() {
        return this.isHostInSubnet(TEREDO_SUBNET);
      }
      /**
       * Returns true if the address is a 6to4 address, false otherwise
       * @returns {boolean}
       */
      is6to4() {
        return this.isHostInSubnet(SIX_TO_FOUR_SUBNET);
      }
      /**
       * Returns true if the address is a loopback address, false otherwise
       * @returns {boolean}
       */
      isLoopback() {
        const embedded = this.embeddedIPv4();
        if (embedded) {
          return embedded.isLoopback();
        }
        return this.getType() === "Loopback";
      }
      /**
       * Returns true if the address is a Unique Local Address in `fc00::/7` ([RFC 4193](https://datatracker.ietf.org/doc/html/rfc4193)). ULAs are the IPv6 equivalent of IPv4 [RFC 1918](https://datatracker.ietf.org/doc/html/rfc1918) private addresses.
       * @returns {boolean}
       */
      isULA() {
        return this.isHostInSubnet(ULA_SUBNET);
      }
      /**
       * Returns true if the address is private, i.e. a Unique Local Address in
       * `fc00::/7` ([RFC 4193](https://datatracker.ietf.org/doc/html/rfc4193)), an
       * address in the NAT64 local-use range `64:ff9b:1::/48`
       * ([RFC 8215](https://datatracker.ietf.org/doc/html/rfc8215)), or an
       * IPv4-mapped / NAT64 well-known address whose embedded IPv4 address is in
       * one of the [RFC 1918](https://datatracker.ietf.org/doc/html/rfc1918)
       * private ranges (e.g. `::ffff:10.0.0.1`). This is the IPv6 counterpart to
       * {@link Address4.isPrivate}; use it instead of {@link isULA} when you need to
       * catch mapped RFC 1918 addresses as well as native ULAs.
       *
       * The local-use NAT64 range is reported private as a whole rather than by
       * its embedded IPv4 address: an operator may carve a prefix of any RFC 6052
       * length out of `64:ff9b:1::/48`, so the same bits decode to different IPv4
       * addresses under different deployments and no single decoding is correct.
       * Use {@link toAddress4Nat64} with the deployment's prefix to decode one.
       * @returns {boolean}
       */
      isPrivate() {
        const embedded = this.embeddedIPv4();
        if (embedded) {
          return embedded.isPrivate();
        }
        return this.isULA() || this.isHostInSubnet(NAT64_LOCAL_USE_SUBNET);
      }
      /**
       * Returns true if the address is an IPv4-mapped / NAT64 address whose embedded
       * IPv4 address is in the carrier-grade NAT range `100.64.0.0/10`
       * ([RFC 6598](https://datatracker.ietf.org/doc/html/rfc6598)), false
       * otherwise. There is no native IPv6 CGNAT range, so this only ever returns
       * true for an embedded IPv4 address (e.g. `::ffff:100.64.0.1`).
       * @returns {boolean}
       */
      isCGNAT() {
        const embedded = this.embeddedIPv4();
        if (embedded) {
          return embedded.isCGNAT();
        }
        return false;
      }
      /**
       * Returns true if the address is an IPv4-mapped / NAT64 address whose embedded
       * IPv4 address is the limited broadcast address `255.255.255.255`
       * ([RFC 919](https://datatracker.ietf.org/doc/html/rfc919)), false otherwise.
       * There is no IPv6 broadcast, so this only ever returns true for an embedded
       * IPv4 address (e.g. `::ffff:255.255.255.255`).
       * @returns {boolean}
       */
      isBroadcast() {
        const embedded = this.embeddedIPv4();
        if (embedded) {
          return embedded.isBroadcast();
        }
        return false;
      }
      /**
       * Returns true if the address is the unspecified address `::`.
       * @returns {boolean}
       */
      isUnspecified() {
        const embedded = this.embeddedIPv4();
        if (embedded) {
          return embedded.isUnspecified();
        }
        return this.getType() === "Unspecified";
      }
      /**
       * Returns true if the address is in the documentation prefix `2001:db8::/32` ([RFC 3849](https://datatracker.ietf.org/doc/html/rfc3849)).
       * @returns {boolean}
       */
      isDocumentation() {
        return DOCUMENTATION_SUBNETS.some((subnet) => this.isHostInSubnet(subnet));
      }
      /**
       * Returns true if the address is in the benchmarking range `2001:2::/48`
       * ([RFC 5180](https://datatracker.ietf.org/doc/html/rfc5180)) or is an
       * IPv4-mapped / NAT64 address whose embedded IPv4 address is in
       * `198.18.0.0/15`, false otherwise.
       * @returns {boolean}
       */
      isBenchmarking() {
        const embedded = this.embeddedIPv4();
        if (embedded) {
          return embedded.isBenchmarking();
        }
        return this.isHostInSubnet(BENCHMARKING_SUBNET);
      }
      /**
       * Returns true if the address is globally reachable: inside the global
       * unicast allocation `2000::/3` (the only range the [IANA IPv6 Address Space
       * Registry](https://www.iana.org/assignments/ipv6-address-space/) assigns
       * for global unicast; everything else is reserved, ULA, link-local, or
       * multicast) and not in any block the [IANA IPv6 Special-Purpose Address Registry](https://www.iana.org/assignments/iana-ipv6-special-registry/)
       * marks as not globally reachable. An IPv4-mapped or NAT64 well-known
       * address answers for its embedded IPv4 address, so `::ffff:10.0.0.1` and
       * `64:ff9b::7f00:1` are not global. Teredo (`2001::/32`) and 6to4
       * (`2002::/16`) are not global either: the registry lists them as N/A and a
       * packet to one needs a relay.
       *
       * This covers everything the individual classifiers name and the blocks they
       * do not: the discard-only prefix `100::/64`, the IETF protocol assignments
       * in `2001::/23`, the deprecated site-local `fec0::/10` and IPv4-compatible
       * `::/96` ranges, and unallocated space such as `4000::/3`. It is the single
       * predicate to use where a request must not reach an internal or
       * special-purpose destination; see SECURITY.md.
       * @returns {boolean}
       */
      isGlobal() {
        const embedded = this.embeddedIPv4();
        if (embedded) {
          return embedded.isGlobal();
        }
        return this.isHostInSubnet(GLOBAL_UNICAST_SUBNET) && common.isGloballyReachable.call(this, SPECIAL_PURPOSE_V6);
      }
      // #endregion
      // #region HTML
      /**
       * Returns the address as an HTTP URL with the host bracketed, e.g.
       * `http://[2001:db8::1]/`. If `optionalPort` is provided it is appended,
       * e.g. `http://[2001:db8::1]:8080/`.
       */
      href(optionalPort) {
        if (optionalPort === void 0) {
          optionalPort = "";
        } else {
          optionalPort = `:${optionalPort}`;
        }
        return `http://[${this.correctForm()}]${optionalPort}/`;
      }
      /**
       * Returns an HTML `<a>` element whose `href` encodes the address in a URL
       * hash fragment (default prefix `/#address=`). Useful for linking between
       * pages of an address-inspector UI.
       * @param options.className - CSS class for the rendered `<a>` element
       * @param options.prefix - hash prefix prepended to the address (default `/#address=`)
       * @param options.v4 - when true, render the address in v4-in-v6 form
       */
      link(options) {
        if (!options) {
          options = {};
        }
        if (options.className === void 0) {
          options.className = "";
        }
        if (options.prefix === void 0) {
          options.prefix = "/#address=";
        }
        if (options.v4 === void 0) {
          options.v4 = false;
        }
        let formFunction = this.correctForm;
        if (options.v4) {
          formFunction = this.to4in6;
        }
        const form = formFunction.call(this);
        const safeHref = helpers.escapeHtml(`${options.prefix}${form}`);
        const safeForm = helpers.escapeHtml(form);
        if (options.className) {
          const safeClass = helpers.escapeHtml(options.className);
          return `<a href="${safeHref}" class="${safeClass}">${safeForm}</a>`;
        }
        return `<a href="${safeHref}">${safeForm}</a>`;
      }
      /**
       * Groups an address.
       *
       * Returns an HTML fragment: each group is wrapped in a `<span>` carrying
       * the group classes an address-inspector UI hovers on. The address content
       * is HTML-escaped; anything you concatenate around it is your
       * responsibility.
       * @returns {String}
       */
      group() {
        if (this.elidedGroups === 0) {
          return helpers.simpleGroup(this.addressMinusSuffix).join(":");
        }
        assert2(typeof this.elidedGroups === "number");
        assert2(typeof this.elisionBegin === "number");
        const output = [];
        const [left, right] = this.addressMinusSuffix.split("::");
        if (left.length) {
          output.push(...helpers.simpleGroup(left));
        } else {
          output.push("");
        }
        const classes = ["hover-group"];
        for (let i = this.elisionBegin; i < this.elisionBegin + this.elidedGroups; i++) {
          classes.push(`group-${i}`);
        }
        output.push(`<span class="${classes.join(" ")}"></span>`);
        if (right.length) {
          output.push(...helpers.simpleGroup(right, this.elisionEnd));
        } else {
          output.push("");
        }
        if (this.is4()) {
          assert2(this.address4 instanceof ipv4_1.Address4);
          output.pop();
          output.push(this.address4.groupForV6());
        }
        return output.join(":");
      }
      // #endregion
      // #region Regular expressions
      /**
       * Generate a regular expression string that can be used to find or validate
       * all variations of this address
       * @param {boolean} substringSearch
       * @returns {string}
       */
      regularExpressionString(substringSearch = false) {
        let output = [];
        const address6 = new _Address6(this.correctForm());
        if (address6.elidedGroups === 0) {
          output.push((0, regular_expressions_1.simpleRegularExpression)(address6.parsedAddress));
        } else if (address6.elidedGroups === constants6.GROUPS) {
          output.push((0, regular_expressions_1.possibleElisions)(constants6.GROUPS));
        } else {
          const halves = address6.address.split("::");
          if (halves[0].length) {
            output.push((0, regular_expressions_1.simpleRegularExpression)(halves[0].split(":")));
          }
          assert2(typeof address6.elidedGroups === "number");
          output.push((0, regular_expressions_1.possibleElisions)(address6.elidedGroups, halves[0].length !== 0, halves[1].length !== 0));
          if (halves[1].length) {
            output.push((0, regular_expressions_1.simpleRegularExpression)(halves[1].split(":")));
          }
          output = [output.join(":")];
        }
        if (!substringSearch) {
          output = [
            "(?=^|",
            regular_expressions_1.ADDRESS_BOUNDARY,
            "|[^\\w\\:])(",
            ...output,
            ")(?=[^\\w\\:]|",
            regular_expressions_1.ADDRESS_BOUNDARY,
            "|$)"
          ];
        }
        return output.join("");
      }
      /**
       * Generate a regular expression that can be used to find or validate all
       * variations of this address.
       * @param {boolean} substringSearch
       * @returns {RegExp}
       */
      regularExpression(substringSearch = false) {
        return new RegExp(this.regularExpressionString(substringSearch), "i");
      }
    };
    exports.Address6 = Address6;
    var TYPE_SUBNETS = Object.keys(constants6.TYPES).map((subnet) => [
      new Address6(subnet),
      constants6.TYPES[subnet]
    ]);
    var TEREDO_SUBNET = new Address6("2001::/32");
    var SIX_TO_FOUR_SUBNET = new Address6("2002::/16");
    var ULA_SUBNET = new Address6("fc00::/7");
    var LINK_LOCAL_SUBNET = new Address6("fe80::/10");
    var DOCUMENTATION_SUBNETS = [new Address6("2001:db8::/32"), new Address6("3fff::/20")];
    var BENCHMARKING_SUBNET = new Address6("2001:2::/48");
    var GLOBAL_UNICAST_SUBNET = new Address6("2000::/3");
    var SPECIAL_PURPOSE_V6 = constants6.SPECIAL_PURPOSE.map(([cidr, , reachable]) => ({
      subnet: new Address6(cidr),
      reachable
    }));
    var IPV4_MAPPED_SUBNET = new Address6("::ffff:0:0/96");
    var NAT64_WELL_KNOWN_SUBNET = new Address6("64:ff9b::/96");
    var NAT64_LOCAL_USE_SUBNET = new Address6("64:ff9b:1::/48");
  }
});

// node_modules/ip-address/dist/ip-address.js
var require_ip_address = __commonJS({
  "node_modules/ip-address/dist/ip-address.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports && exports.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.v6 = exports.AddressError = exports.Address6 = exports.Address4 = void 0;
    var ipv4_1 = require_ipv4();
    Object.defineProperty(exports, "Address4", { enumerable: true, get: function() {
      return ipv4_1.Address4;
    } });
    var ipv6_1 = require_ipv6();
    Object.defineProperty(exports, "Address6", { enumerable: true, get: function() {
      return ipv6_1.Address6;
    } });
    var address_error_1 = require_address_error();
    Object.defineProperty(exports, "AddressError", { enumerable: true, get: function() {
      return address_error_1.AddressError;
    } });
    var helpers = __importStar(require_helpers());
    exports.v6 = { helpers };
  }
});

// node_modules/socks/build/common/helpers.js
var require_helpers2 = __commonJS({
  "node_modules/socks/build/common/helpers.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateSocksClientOptions = validateSocksClientOptions;
    exports.validateSocksClientChainOptions = validateSocksClientChainOptions;
    exports.ipv4ToInt32 = ipv4ToInt32;
    exports.int32ToIpv4 = int32ToIpv4;
    exports.ipToBuffer = ipToBuffer;
    var util_1 = require_util();
    var constants_1 = require_constants2();
    var stream = __require("stream");
    var ip_address_1 = require_ip_address();
    var net4 = __require("net");
    function validateSocksClientOptions(options, acceptedCommands = ["connect", "bind", "associate"]) {
      if (!constants_1.SocksCommand[options.command]) {
        throw new util_1.SocksClientError(constants_1.ERRORS.InvalidSocksCommand, options);
      }
      if (acceptedCommands.indexOf(options.command) === -1) {
        throw new util_1.SocksClientError(constants_1.ERRORS.InvalidSocksCommandForOperation, options);
      }
      if (!isValidSocksRemoteHost(options.destination)) {
        throw new util_1.SocksClientError(constants_1.ERRORS.InvalidSocksClientOptionsDestination, options);
      }
      if (!isValidSocksProxy(options.proxy)) {
        throw new util_1.SocksClientError(constants_1.ERRORS.InvalidSocksClientOptionsProxy, options);
      }
      validateCustomProxyAuth(options.proxy, options);
      if (options.timeout && !isValidTimeoutValue(options.timeout)) {
        throw new util_1.SocksClientError(constants_1.ERRORS.InvalidSocksClientOptionsTimeout, options);
      }
      if (options.existing_socket && !(options.existing_socket instanceof stream.Duplex)) {
        throw new util_1.SocksClientError(constants_1.ERRORS.InvalidSocksClientOptionsExistingSocket, options);
      }
    }
    function validateSocksClientChainOptions(options) {
      if (options.command !== "connect") {
        throw new util_1.SocksClientError(constants_1.ERRORS.InvalidSocksCommandChain, options);
      }
      if (!isValidSocksRemoteHost(options.destination)) {
        throw new util_1.SocksClientError(constants_1.ERRORS.InvalidSocksClientOptionsDestination, options);
      }
      if (!(options.proxies && Array.isArray(options.proxies) && options.proxies.length >= 2)) {
        throw new util_1.SocksClientError(constants_1.ERRORS.InvalidSocksClientOptionsProxiesLength, options);
      }
      options.proxies.forEach((proxy) => {
        if (!isValidSocksProxy(proxy)) {
          throw new util_1.SocksClientError(constants_1.ERRORS.InvalidSocksClientOptionsProxy, options);
        }
        validateCustomProxyAuth(proxy, options);
      });
      if (options.timeout && !isValidTimeoutValue(options.timeout)) {
        throw new util_1.SocksClientError(constants_1.ERRORS.InvalidSocksClientOptionsTimeout, options);
      }
    }
    function validateCustomProxyAuth(proxy, options) {
      if (proxy.custom_auth_method !== void 0) {
        if (proxy.custom_auth_method < constants_1.SOCKS5_CUSTOM_AUTH_START || proxy.custom_auth_method > constants_1.SOCKS5_CUSTOM_AUTH_END) {
          throw new util_1.SocksClientError(constants_1.ERRORS.InvalidSocksClientOptionsCustomAuthRange, options);
        }
        if (proxy.custom_auth_request_handler === void 0 || typeof proxy.custom_auth_request_handler !== "function") {
          throw new util_1.SocksClientError(constants_1.ERRORS.InvalidSocksClientOptionsCustomAuthOptions, options);
        }
        if (proxy.custom_auth_response_size === void 0) {
          throw new util_1.SocksClientError(constants_1.ERRORS.InvalidSocksClientOptionsCustomAuthOptions, options);
        }
        if (proxy.custom_auth_response_handler === void 0 || typeof proxy.custom_auth_response_handler !== "function") {
          throw new util_1.SocksClientError(constants_1.ERRORS.InvalidSocksClientOptionsCustomAuthOptions, options);
        }
      }
    }
    function isValidSocksRemoteHost(remoteHost) {
      return remoteHost && typeof remoteHost.host === "string" && Buffer.byteLength(remoteHost.host) < 256 && typeof remoteHost.port === "number" && remoteHost.port >= 0 && remoteHost.port <= 65535;
    }
    function isValidSocksProxy(proxy) {
      return proxy && (typeof proxy.host === "string" || typeof proxy.ipaddress === "string") && typeof proxy.port === "number" && proxy.port >= 0 && proxy.port <= 65535 && (proxy.type === 4 || proxy.type === 5);
    }
    function isValidTimeoutValue(value) {
      return typeof value === "number" && value > 0;
    }
    function ipv4ToInt32(ip) {
      const address = new ip_address_1.Address4(ip);
      return address.toArray().reduce((acc, part) => (acc << 8) + part, 0) >>> 0;
    }
    function int32ToIpv4(int32) {
      const octet1 = int32 >>> 24 & 255;
      const octet2 = int32 >>> 16 & 255;
      const octet3 = int32 >>> 8 & 255;
      const octet4 = int32 & 255;
      return [octet1, octet2, octet3, octet4].join(".");
    }
    function ipToBuffer(ip) {
      if (net4.isIPv4(ip)) {
        const address = new ip_address_1.Address4(ip);
        return Buffer.from(address.toArray());
      } else if (net4.isIPv6(ip)) {
        const address = new ip_address_1.Address6(ip);
        return Buffer.from(address.canonicalForm().split(":").map((segment) => segment.padStart(4, "0")).join(""), "hex");
      } else {
        throw new Error("Invalid IP address format");
      }
    }
  }
});

// node_modules/socks/build/common/receivebuffer.js
var require_receivebuffer = __commonJS({
  "node_modules/socks/build/common/receivebuffer.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ReceiveBuffer = void 0;
    var ReceiveBuffer = class {
      constructor(size = 4096) {
        this.buffer = Buffer.allocUnsafe(size);
        this.offset = 0;
        this.originalSize = size;
      }
      get length() {
        return this.offset;
      }
      append(data) {
        if (!Buffer.isBuffer(data)) {
          throw new Error("Attempted to append a non-buffer instance to ReceiveBuffer.");
        }
        if (this.offset + data.length >= this.buffer.length) {
          const tmp = this.buffer;
          this.buffer = Buffer.allocUnsafe(Math.max(this.buffer.length + this.originalSize, this.buffer.length + data.length));
          tmp.copy(this.buffer);
        }
        data.copy(this.buffer, this.offset);
        return this.offset += data.length;
      }
      peek(length) {
        if (length > this.offset) {
          throw new Error("Attempted to read beyond the bounds of the managed internal data.");
        }
        return this.buffer.slice(0, length);
      }
      get(length) {
        if (length > this.offset) {
          throw new Error("Attempted to read beyond the bounds of the managed internal data.");
        }
        const value = Buffer.allocUnsafe(length);
        this.buffer.slice(0, length).copy(value);
        this.buffer.copyWithin(0, length, length + this.offset - length);
        this.offset -= length;
        return value;
      }
    };
    exports.ReceiveBuffer = ReceiveBuffer;
  }
});

// node_modules/socks/build/client/socksclient.js
var require_socksclient = __commonJS({
  "node_modules/socks/build/client/socksclient.js"(exports) {
    "use strict";
    var __awaiter = exports && exports.__awaiter || function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve7) {
          resolve7(value);
        });
      }
      return new (P || (P = Promise))(function(resolve7, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve7(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SocksClientError = exports.SocksClient = void 0;
    var events_1 = __require("events");
    var net4 = __require("net");
    var smart_buffer_1 = require_smartbuffer();
    var constants_1 = require_constants2();
    var helpers_1 = require_helpers2();
    var receivebuffer_1 = require_receivebuffer();
    var util_1 = require_util();
    Object.defineProperty(exports, "SocksClientError", { enumerable: true, get: function() {
      return util_1.SocksClientError;
    } });
    var ip_address_1 = require_ip_address();
    var SocksClient2 = class _SocksClient extends events_1.EventEmitter {
      constructor(options) {
        super();
        this.options = Object.assign({}, options);
        (0, helpers_1.validateSocksClientOptions)(options);
        this.setState(constants_1.SocksClientState.Created);
      }
      /**
       * Creates a new SOCKS connection.
       *
       * Note: Supports callbacks and promises. Only supports the connect command.
       * @param options { SocksClientOptions } Options.
       * @param callback { Function } An optional callback function.
       * @returns { Promise }
       */
      static createConnection(options, callback) {
        return new Promise((resolve7, reject) => {
          try {
            (0, helpers_1.validateSocksClientOptions)(options, ["connect"]);
          } catch (err) {
            if (typeof callback === "function") {
              callback(err);
              return resolve7(err);
            } else {
              return reject(err);
            }
          }
          const client = new _SocksClient(options);
          client.connect(options.existing_socket);
          client.once("established", (info) => {
            client.removeAllListeners();
            if (typeof callback === "function") {
              callback(null, info);
              resolve7(info);
            } else {
              resolve7(info);
            }
          });
          client.once("error", (err) => {
            client.removeAllListeners();
            if (typeof callback === "function") {
              callback(err);
              resolve7(err);
            } else {
              reject(err);
            }
          });
        });
      }
      /**
       * Creates a new SOCKS connection chain to a destination host through 2 or more SOCKS proxies.
       *
       * Note: Supports callbacks and promises. Only supports the connect method.
       * Note: Implemented via createConnection() factory function.
       * @param options { SocksClientChainOptions } Options
       * @param callback { Function } An optional callback function.
       * @returns { Promise }
       */
      static createConnectionChain(options, callback) {
        return new Promise((resolve7, reject) => __awaiter(this, void 0, void 0, function* () {
          try {
            (0, helpers_1.validateSocksClientChainOptions)(options);
          } catch (err) {
            if (typeof callback === "function") {
              callback(err);
              return resolve7(err);
            } else {
              return reject(err);
            }
          }
          if (options.randomizeChain) {
            (0, util_1.shuffleArray)(options.proxies);
          }
          try {
            let sock;
            for (let i = 0; i < options.proxies.length; i++) {
              const nextProxy = options.proxies[i];
              const nextDestination = i === options.proxies.length - 1 ? options.destination : {
                host: options.proxies[i + 1].host || options.proxies[i + 1].ipaddress,
                port: options.proxies[i + 1].port
              };
              const result = yield _SocksClient.createConnection({
                command: "connect",
                proxy: nextProxy,
                destination: nextDestination,
                existing_socket: sock
              });
              sock = sock || result.socket;
            }
            if (typeof callback === "function") {
              callback(null, { socket: sock });
              resolve7({ socket: sock });
            } else {
              resolve7({ socket: sock });
            }
          } catch (err) {
            if (typeof callback === "function") {
              callback(err);
              resolve7(err);
            } else {
              reject(err);
            }
          }
        }));
      }
      /**
       * Creates a SOCKS UDP Frame.
       * @param options
       */
      static createUDPFrame(options) {
        const buff = new smart_buffer_1.SmartBuffer();
        buff.writeUInt16BE(0);
        buff.writeUInt8(options.frameNumber || 0);
        if (net4.isIPv4(options.remoteHost.host)) {
          buff.writeUInt8(constants_1.Socks5HostType.IPv4);
          buff.writeUInt32BE((0, helpers_1.ipv4ToInt32)(options.remoteHost.host));
        } else if (net4.isIPv6(options.remoteHost.host)) {
          buff.writeUInt8(constants_1.Socks5HostType.IPv6);
          buff.writeBuffer((0, helpers_1.ipToBuffer)(options.remoteHost.host));
        } else {
          buff.writeUInt8(constants_1.Socks5HostType.Hostname);
          buff.writeUInt8(Buffer.byteLength(options.remoteHost.host));
          buff.writeString(options.remoteHost.host);
        }
        buff.writeUInt16BE(options.remoteHost.port);
        buff.writeBuffer(options.data);
        return buff.toBuffer();
      }
      /**
       * Parses a SOCKS UDP frame.
       * @param data
       */
      static parseUDPFrame(data) {
        const buff = smart_buffer_1.SmartBuffer.fromBuffer(data);
        buff.readOffset = 2;
        const frameNumber = buff.readUInt8();
        const hostType = buff.readUInt8();
        let remoteHost;
        if (hostType === constants_1.Socks5HostType.IPv4) {
          remoteHost = (0, helpers_1.int32ToIpv4)(buff.readUInt32BE());
        } else if (hostType === constants_1.Socks5HostType.IPv6) {
          remoteHost = ip_address_1.Address6.fromByteArray(Array.from(buff.readBuffer(16))).canonicalForm();
        } else {
          remoteHost = buff.readString(buff.readUInt8());
        }
        const remotePort = buff.readUInt16BE();
        return {
          frameNumber,
          remoteHost: {
            host: remoteHost,
            port: remotePort
          },
          data: buff.readBuffer()
        };
      }
      /**
       * Internal state setter. If the SocksClient is in an error state, it cannot be changed to a non error state.
       */
      setState(newState) {
        if (this.state !== constants_1.SocksClientState.Error) {
          this.state = newState;
        }
      }
      /**
       * Starts the connection establishment to the proxy and destination.
       * @param existingSocket Connected socket to use instead of creating a new one (internal use).
       */
      connect(existingSocket) {
        this.onDataReceived = (data) => this.onDataReceivedHandler(data);
        this.onClose = () => this.onCloseHandler();
        this.onError = (err) => this.onErrorHandler(err);
        this.onConnect = () => this.onConnectHandler();
        const timer = setTimeout(() => this.onEstablishedTimeout(), this.options.timeout || constants_1.DEFAULT_TIMEOUT);
        if (timer.unref && typeof timer.unref === "function") {
          timer.unref();
        }
        if (existingSocket) {
          this.socket = existingSocket;
        } else {
          this.socket = new net4.Socket();
        }
        this.socket.once("close", this.onClose);
        this.socket.once("error", this.onError);
        this.socket.once("connect", this.onConnect);
        this.socket.on("data", this.onDataReceived);
        this.setState(constants_1.SocksClientState.Connecting);
        this.receiveBuffer = new receivebuffer_1.ReceiveBuffer();
        if (existingSocket) {
          this.socket.emit("connect");
        } else {
          this.socket.connect(this.getSocketOptions());
          if (this.options.set_tcp_nodelay !== void 0 && this.options.set_tcp_nodelay !== null) {
            this.socket.setNoDelay(!!this.options.set_tcp_nodelay);
          }
        }
        this.prependOnceListener("established", (info) => {
          setImmediate(() => {
            if (this.receiveBuffer.length > 0) {
              const excessData = this.receiveBuffer.get(this.receiveBuffer.length);
              info.socket.emit("data", excessData);
            }
            info.socket.resume();
          });
        });
      }
      // Socket options (defaults host/port to options.proxy.host/options.proxy.port)
      getSocketOptions() {
        return Object.assign(Object.assign({}, this.options.socket_options), { host: this.options.proxy.host || this.options.proxy.ipaddress, port: this.options.proxy.port });
      }
      /**
       * Handles internal Socks timeout callback.
       * Note: If the Socks client is not BoundWaitingForConnection or Established, the connection will be closed.
       */
      onEstablishedTimeout() {
        if (this.state !== constants_1.SocksClientState.Established && this.state !== constants_1.SocksClientState.BoundWaitingForConnection) {
          this.closeSocket(constants_1.ERRORS.ProxyConnectionTimedOut);
        }
      }
      /**
       * Handles Socket connect event.
       */
      onConnectHandler() {
        this.setState(constants_1.SocksClientState.Connected);
        if (this.options.proxy.type === 4) {
          this.sendSocks4InitialHandshake();
        } else {
          this.sendSocks5InitialHandshake();
        }
        this.setState(constants_1.SocksClientState.SentInitialHandshake);
      }
      /**
       * Handles Socket data event.
       * @param data
       */
      onDataReceivedHandler(data) {
        this.receiveBuffer.append(data);
        this.processData();
      }
      /**
       * Handles processing of the data we have received.
       */
      processData() {
        while (this.state !== constants_1.SocksClientState.Established && this.state !== constants_1.SocksClientState.Error && this.receiveBuffer.length >= this.nextRequiredPacketBufferSize) {
          if (this.state === constants_1.SocksClientState.SentInitialHandshake) {
            if (this.options.proxy.type === 4) {
              this.handleSocks4FinalHandshakeResponse();
            } else {
              this.handleInitialSocks5HandshakeResponse();
            }
          } else if (this.state === constants_1.SocksClientState.SentAuthentication) {
            this.handleInitialSocks5AuthenticationHandshakeResponse();
          } else if (this.state === constants_1.SocksClientState.SentFinalHandshake) {
            this.handleSocks5FinalHandshakeResponse();
          } else if (this.state === constants_1.SocksClientState.BoundWaitingForConnection) {
            if (this.options.proxy.type === 4) {
              this.handleSocks4IncomingConnectionResponse();
            } else {
              this.handleSocks5IncomingConnectionResponse();
            }
          } else {
            this.closeSocket(constants_1.ERRORS.InternalError);
            break;
          }
        }
      }
      /**
       * Handles Socket close event.
       * @param had_error
       */
      onCloseHandler() {
        this.closeSocket(constants_1.ERRORS.SocketClosed);
      }
      /**
       * Handles Socket error event.
       * @param err
       */
      onErrorHandler(err) {
        this.closeSocket(err.message);
      }
      /**
       * Removes internal event listeners on the underlying Socket.
       */
      removeInternalSocketHandlers() {
        this.socket.pause();
        this.socket.removeListener("data", this.onDataReceived);
        this.socket.removeListener("close", this.onClose);
        this.socket.removeListener("error", this.onError);
        this.socket.removeListener("connect", this.onConnect);
      }
      /**
       * Closes and destroys the underlying Socket. Emits an error event.
       * @param err { String } An error string to include in error event.
       */
      closeSocket(err) {
        if (this.state !== constants_1.SocksClientState.Error) {
          this.setState(constants_1.SocksClientState.Error);
          this.socket.destroy();
          this.removeInternalSocketHandlers();
          this.emit("error", new util_1.SocksClientError(err, this.options));
        }
      }
      /**
       * Sends initial Socks v4 handshake request.
       */
      sendSocks4InitialHandshake() {
        const userId = this.options.proxy.userId || "";
        const buff = new smart_buffer_1.SmartBuffer();
        buff.writeUInt8(4);
        buff.writeUInt8(constants_1.SocksCommand[this.options.command]);
        buff.writeUInt16BE(this.options.destination.port);
        if (net4.isIPv4(this.options.destination.host)) {
          buff.writeBuffer((0, helpers_1.ipToBuffer)(this.options.destination.host));
          buff.writeStringNT(userId);
        } else {
          buff.writeUInt8(0);
          buff.writeUInt8(0);
          buff.writeUInt8(0);
          buff.writeUInt8(1);
          buff.writeStringNT(userId);
          buff.writeStringNT(this.options.destination.host);
        }
        this.nextRequiredPacketBufferSize = constants_1.SOCKS_INCOMING_PACKET_SIZES.Socks4Response;
        this.socket.write(buff.toBuffer());
      }
      /**
       * Handles Socks v4 handshake response.
       * @param data
       */
      handleSocks4FinalHandshakeResponse() {
        const data = this.receiveBuffer.get(8);
        if (data[1] !== constants_1.Socks4Response.Granted) {
          this.closeSocket(`${constants_1.ERRORS.Socks4ProxyRejectedConnection} - (${constants_1.Socks4Response[data[1]]})`);
        } else {
          if (constants_1.SocksCommand[this.options.command] === constants_1.SocksCommand.bind) {
            const buff = smart_buffer_1.SmartBuffer.fromBuffer(data);
            buff.readOffset = 2;
            const remoteHost = {
              port: buff.readUInt16BE(),
              host: (0, helpers_1.int32ToIpv4)(buff.readUInt32BE())
            };
            if (remoteHost.host === "0.0.0.0") {
              remoteHost.host = this.options.proxy.ipaddress;
            }
            this.setState(constants_1.SocksClientState.BoundWaitingForConnection);
            this.emit("bound", { remoteHost, socket: this.socket });
          } else {
            this.setState(constants_1.SocksClientState.Established);
            this.removeInternalSocketHandlers();
            this.emit("established", { socket: this.socket });
          }
        }
      }
      /**
       * Handles Socks v4 incoming connection request (BIND)
       * @param data
       */
      handleSocks4IncomingConnectionResponse() {
        const data = this.receiveBuffer.get(8);
        if (data[1] !== constants_1.Socks4Response.Granted) {
          this.closeSocket(`${constants_1.ERRORS.Socks4ProxyRejectedIncomingBoundConnection} - (${constants_1.Socks4Response[data[1]]})`);
        } else {
          const buff = smart_buffer_1.SmartBuffer.fromBuffer(data);
          buff.readOffset = 2;
          const remoteHost = {
            port: buff.readUInt16BE(),
            host: (0, helpers_1.int32ToIpv4)(buff.readUInt32BE())
          };
          this.setState(constants_1.SocksClientState.Established);
          this.removeInternalSocketHandlers();
          this.emit("established", { remoteHost, socket: this.socket });
        }
      }
      /**
       * Sends initial Socks v5 handshake request.
       */
      sendSocks5InitialHandshake() {
        const buff = new smart_buffer_1.SmartBuffer();
        const supportedAuthMethods = [constants_1.Socks5Auth.NoAuth];
        if (this.options.proxy.userId || this.options.proxy.password) {
          supportedAuthMethods.push(constants_1.Socks5Auth.UserPass);
        }
        if (this.options.proxy.custom_auth_method !== void 0) {
          supportedAuthMethods.push(this.options.proxy.custom_auth_method);
        }
        buff.writeUInt8(5);
        buff.writeUInt8(supportedAuthMethods.length);
        for (const authMethod of supportedAuthMethods) {
          buff.writeUInt8(authMethod);
        }
        this.nextRequiredPacketBufferSize = constants_1.SOCKS_INCOMING_PACKET_SIZES.Socks5InitialHandshakeResponse;
        this.socket.write(buff.toBuffer());
        this.setState(constants_1.SocksClientState.SentInitialHandshake);
      }
      /**
       * Handles initial Socks v5 handshake response.
       * @param data
       */
      handleInitialSocks5HandshakeResponse() {
        const data = this.receiveBuffer.get(2);
        if (data[0] !== 5) {
          this.closeSocket(constants_1.ERRORS.InvalidSocks5IntiailHandshakeSocksVersion);
        } else if (data[1] === constants_1.SOCKS5_NO_ACCEPTABLE_AUTH) {
          this.closeSocket(constants_1.ERRORS.InvalidSocks5InitialHandshakeNoAcceptedAuthType);
        } else {
          if (data[1] === constants_1.Socks5Auth.NoAuth) {
            this.socks5ChosenAuthType = constants_1.Socks5Auth.NoAuth;
            this.sendSocks5CommandRequest();
          } else if (data[1] === constants_1.Socks5Auth.UserPass) {
            this.socks5ChosenAuthType = constants_1.Socks5Auth.UserPass;
            this.sendSocks5UserPassAuthentication();
          } else if (data[1] === this.options.proxy.custom_auth_method) {
            this.socks5ChosenAuthType = this.options.proxy.custom_auth_method;
            this.sendSocks5CustomAuthentication();
          } else {
            this.closeSocket(constants_1.ERRORS.InvalidSocks5InitialHandshakeUnknownAuthType);
          }
        }
      }
      /**
       * Sends Socks v5 user & password auth handshake.
       *
       * Note: No auth and user/pass are currently supported.
       */
      sendSocks5UserPassAuthentication() {
        const userId = this.options.proxy.userId || "";
        const password = this.options.proxy.password || "";
        const buff = new smart_buffer_1.SmartBuffer();
        buff.writeUInt8(1);
        buff.writeUInt8(Buffer.byteLength(userId));
        buff.writeString(userId);
        buff.writeUInt8(Buffer.byteLength(password));
        buff.writeString(password);
        this.nextRequiredPacketBufferSize = constants_1.SOCKS_INCOMING_PACKET_SIZES.Socks5UserPassAuthenticationResponse;
        this.socket.write(buff.toBuffer());
        this.setState(constants_1.SocksClientState.SentAuthentication);
      }
      sendSocks5CustomAuthentication() {
        return __awaiter(this, void 0, void 0, function* () {
          this.nextRequiredPacketBufferSize = this.options.proxy.custom_auth_response_size;
          this.socket.write(yield this.options.proxy.custom_auth_request_handler());
          this.setState(constants_1.SocksClientState.SentAuthentication);
        });
      }
      handleSocks5CustomAuthHandshakeResponse(data) {
        return __awaiter(this, void 0, void 0, function* () {
          return yield this.options.proxy.custom_auth_response_handler(data);
        });
      }
      handleSocks5AuthenticationNoAuthHandshakeResponse(data) {
        return __awaiter(this, void 0, void 0, function* () {
          return data[1] === 0;
        });
      }
      handleSocks5AuthenticationUserPassHandshakeResponse(data) {
        return __awaiter(this, void 0, void 0, function* () {
          return data[1] === 0;
        });
      }
      /**
       * Handles Socks v5 auth handshake response.
       * @param data
       */
      handleInitialSocks5AuthenticationHandshakeResponse() {
        return __awaiter(this, void 0, void 0, function* () {
          this.setState(constants_1.SocksClientState.ReceivedAuthenticationResponse);
          let authResult = false;
          if (this.socks5ChosenAuthType === constants_1.Socks5Auth.NoAuth) {
            authResult = yield this.handleSocks5AuthenticationNoAuthHandshakeResponse(this.receiveBuffer.get(2));
          } else if (this.socks5ChosenAuthType === constants_1.Socks5Auth.UserPass) {
            authResult = yield this.handleSocks5AuthenticationUserPassHandshakeResponse(this.receiveBuffer.get(2));
          } else if (this.socks5ChosenAuthType === this.options.proxy.custom_auth_method) {
            authResult = yield this.handleSocks5CustomAuthHandshakeResponse(this.receiveBuffer.get(this.options.proxy.custom_auth_response_size));
          }
          if (!authResult) {
            this.closeSocket(constants_1.ERRORS.Socks5AuthenticationFailed);
          } else {
            this.sendSocks5CommandRequest();
          }
        });
      }
      /**
       * Sends Socks v5 final handshake request.
       */
      sendSocks5CommandRequest() {
        const buff = new smart_buffer_1.SmartBuffer();
        buff.writeUInt8(5);
        buff.writeUInt8(constants_1.SocksCommand[this.options.command]);
        buff.writeUInt8(0);
        if (net4.isIPv4(this.options.destination.host)) {
          buff.writeUInt8(constants_1.Socks5HostType.IPv4);
          buff.writeBuffer((0, helpers_1.ipToBuffer)(this.options.destination.host));
        } else if (net4.isIPv6(this.options.destination.host)) {
          buff.writeUInt8(constants_1.Socks5HostType.IPv6);
          buff.writeBuffer((0, helpers_1.ipToBuffer)(this.options.destination.host));
        } else {
          buff.writeUInt8(constants_1.Socks5HostType.Hostname);
          buff.writeUInt8(this.options.destination.host.length);
          buff.writeString(this.options.destination.host);
        }
        buff.writeUInt16BE(this.options.destination.port);
        this.nextRequiredPacketBufferSize = constants_1.SOCKS_INCOMING_PACKET_SIZES.Socks5ResponseHeader;
        this.socket.write(buff.toBuffer());
        this.setState(constants_1.SocksClientState.SentFinalHandshake);
      }
      /**
       * Handles Socks v5 final handshake response.
       * @param data
       */
      handleSocks5FinalHandshakeResponse() {
        const header = this.receiveBuffer.peek(5);
        if (header[0] !== 5 || header[1] !== constants_1.Socks5Response.Granted) {
          this.closeSocket(`${constants_1.ERRORS.InvalidSocks5FinalHandshakeRejected} - ${constants_1.Socks5Response[header[1]]}`);
        } else {
          const addressType = header[3];
          let remoteHost;
          let buff;
          if (addressType === constants_1.Socks5HostType.IPv4) {
            const dataNeeded = constants_1.SOCKS_INCOMING_PACKET_SIZES.Socks5ResponseIPv4;
            if (this.receiveBuffer.length < dataNeeded) {
              this.nextRequiredPacketBufferSize = dataNeeded;
              return;
            }
            buff = smart_buffer_1.SmartBuffer.fromBuffer(this.receiveBuffer.get(dataNeeded).slice(4));
            remoteHost = {
              host: (0, helpers_1.int32ToIpv4)(buff.readUInt32BE()),
              port: buff.readUInt16BE()
            };
            if (remoteHost.host === "0.0.0.0") {
              remoteHost.host = this.options.proxy.ipaddress;
            }
          } else if (addressType === constants_1.Socks5HostType.Hostname) {
            const hostLength = header[4];
            const dataNeeded = constants_1.SOCKS_INCOMING_PACKET_SIZES.Socks5ResponseHostname(hostLength);
            if (this.receiveBuffer.length < dataNeeded) {
              this.nextRequiredPacketBufferSize = dataNeeded;
              return;
            }
            buff = smart_buffer_1.SmartBuffer.fromBuffer(this.receiveBuffer.get(dataNeeded).slice(5));
            remoteHost = {
              host: buff.readString(hostLength),
              port: buff.readUInt16BE()
            };
          } else if (addressType === constants_1.Socks5HostType.IPv6) {
            const dataNeeded = constants_1.SOCKS_INCOMING_PACKET_SIZES.Socks5ResponseIPv6;
            if (this.receiveBuffer.length < dataNeeded) {
              this.nextRequiredPacketBufferSize = dataNeeded;
              return;
            }
            buff = smart_buffer_1.SmartBuffer.fromBuffer(this.receiveBuffer.get(dataNeeded).slice(4));
            remoteHost = {
              host: ip_address_1.Address6.fromByteArray(Array.from(buff.readBuffer(16))).canonicalForm(),
              port: buff.readUInt16BE()
            };
          }
          this.setState(constants_1.SocksClientState.ReceivedFinalResponse);
          if (constants_1.SocksCommand[this.options.command] === constants_1.SocksCommand.connect) {
            this.setState(constants_1.SocksClientState.Established);
            this.removeInternalSocketHandlers();
            this.emit("established", { remoteHost, socket: this.socket });
          } else if (constants_1.SocksCommand[this.options.command] === constants_1.SocksCommand.bind) {
            this.setState(constants_1.SocksClientState.BoundWaitingForConnection);
            this.nextRequiredPacketBufferSize = constants_1.SOCKS_INCOMING_PACKET_SIZES.Socks5ResponseHeader;
            this.emit("bound", { remoteHost, socket: this.socket });
          } else if (constants_1.SocksCommand[this.options.command] === constants_1.SocksCommand.associate) {
            this.setState(constants_1.SocksClientState.Established);
            this.removeInternalSocketHandlers();
            this.emit("established", {
              remoteHost,
              socket: this.socket
            });
          }
        }
      }
      /**
       * Handles Socks v5 incoming connection request (BIND).
       */
      handleSocks5IncomingConnectionResponse() {
        const header = this.receiveBuffer.peek(5);
        if (header[0] !== 5 || header[1] !== constants_1.Socks5Response.Granted) {
          this.closeSocket(`${constants_1.ERRORS.Socks5ProxyRejectedIncomingBoundConnection} - ${constants_1.Socks5Response[header[1]]}`);
        } else {
          const addressType = header[3];
          let remoteHost;
          let buff;
          if (addressType === constants_1.Socks5HostType.IPv4) {
            const dataNeeded = constants_1.SOCKS_INCOMING_PACKET_SIZES.Socks5ResponseIPv4;
            if (this.receiveBuffer.length < dataNeeded) {
              this.nextRequiredPacketBufferSize = dataNeeded;
              return;
            }
            buff = smart_buffer_1.SmartBuffer.fromBuffer(this.receiveBuffer.get(dataNeeded).slice(4));
            remoteHost = {
              host: (0, helpers_1.int32ToIpv4)(buff.readUInt32BE()),
              port: buff.readUInt16BE()
            };
            if (remoteHost.host === "0.0.0.0") {
              remoteHost.host = this.options.proxy.ipaddress;
            }
          } else if (addressType === constants_1.Socks5HostType.Hostname) {
            const hostLength = header[4];
            const dataNeeded = constants_1.SOCKS_INCOMING_PACKET_SIZES.Socks5ResponseHostname(hostLength);
            if (this.receiveBuffer.length < dataNeeded) {
              this.nextRequiredPacketBufferSize = dataNeeded;
              return;
            }
            buff = smart_buffer_1.SmartBuffer.fromBuffer(this.receiveBuffer.get(dataNeeded).slice(5));
            remoteHost = {
              host: buff.readString(hostLength),
              port: buff.readUInt16BE()
            };
          } else if (addressType === constants_1.Socks5HostType.IPv6) {
            const dataNeeded = constants_1.SOCKS_INCOMING_PACKET_SIZES.Socks5ResponseIPv6;
            if (this.receiveBuffer.length < dataNeeded) {
              this.nextRequiredPacketBufferSize = dataNeeded;
              return;
            }
            buff = smart_buffer_1.SmartBuffer.fromBuffer(this.receiveBuffer.get(dataNeeded).slice(4));
            remoteHost = {
              host: ip_address_1.Address6.fromByteArray(Array.from(buff.readBuffer(16))).canonicalForm(),
              port: buff.readUInt16BE()
            };
          }
          this.setState(constants_1.SocksClientState.Established);
          this.removeInternalSocketHandlers();
          this.emit("established", { remoteHost, socket: this.socket });
        }
      }
      get socksClientOptions() {
        return Object.assign({}, this.options);
      }
    };
    exports.SocksClient = SocksClient2;
  }
});

// node_modules/socks/build/index.js
var require_build = __commonJS({
  "node_modules/socks/build/index.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_socksclient(), exports);
  }
});

// index.js
import { join as join17, resolve as resolve6 } from "node:path";

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
import { join as join9 } from "node:path";

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

// src/proxy.js
import { createWriteStream } from "node:fs";
import { connect as connect4 } from "node:net";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { pipeline } from "node:stream/promises";

// node_modules/https-proxy-agent/dist/index.js
var import_debug2 = __toESM(require_src(), 1);
import * as net2 from "net";
import * as tls from "tls";
import assert from "assert";

// node_modules/agent-base/dist/index.js
import * as net from "net";
import * as http from "http";
import { Agent as HttpsAgent } from "https";
var INTERNAL = /* @__PURE__ */ Symbol("AgentBaseInternalState");
var Agent2 = class extends http.Agent {
  constructor(opts) {
    super(opts);
    this[INTERNAL] = {};
  }
  /**
   * Determine whether this is an `http` or `https` request.
   */
  isSecureEndpoint(options) {
    if (options) {
      if (typeof options.secureEndpoint === "boolean") {
        return options.secureEndpoint;
      }
      if (typeof options.protocol === "string") {
        return options.protocol === "https:";
      }
    }
    const { stack } = new Error();
    if (typeof stack !== "string")
      return false;
    return stack.split("\n").some((l) => l.indexOf("(https.js:") !== -1 || l.indexOf("node:https:") !== -1);
  }
  // In order to support async signatures in `connect()` and Node's native
  // connection pooling in `http.Agent`, the array of sockets for each origin
  // has to be updated synchronously. This is so the length of the array is
  // accurate when `addRequest()` is next called. We achieve this by creating a
  // fake socket and adding it to `sockets[origin]` and incrementing
  // `totalSocketCount`.
  incrementSockets(name2) {
    if (this.maxSockets === Infinity && this.maxTotalSockets === Infinity) {
      return null;
    }
    if (!this.sockets[name2]) {
      this.sockets[name2] = [];
    }
    const fakeSocket = new net.Socket({ writable: false });
    this.sockets[name2].push(fakeSocket);
    this.totalSocketCount++;
    return fakeSocket;
  }
  decrementSockets(name2, socket) {
    if (!this.sockets[name2] || socket === null) {
      return;
    }
    const sockets = this.sockets[name2];
    const index = sockets.indexOf(socket);
    if (index !== -1) {
      sockets.splice(index, 1);
      this.totalSocketCount--;
      if (sockets.length === 0) {
        delete this.sockets[name2];
      }
    }
  }
  // In order to properly update the socket pool, we need to call `getName()` on
  // the core `https.Agent` if it is a secureEndpoint.
  getName(options) {
    const secureEndpoint = this.isSecureEndpoint(options);
    if (secureEndpoint) {
      return HttpsAgent.prototype.getName.call(this, options);
    }
    return super.getName(options);
  }
  createSocket(req, options, cb) {
    const connectOpts = {
      ...options,
      secureEndpoint: this.isSecureEndpoint(options)
    };
    const name2 = this.getName(connectOpts);
    const fakeSocket = this.incrementSockets(name2);
    Promise.resolve().then(() => this.connect(req, connectOpts)).then((socket) => {
      this.decrementSockets(name2, fakeSocket);
      if (typeof socket.addRequest === "function") {
        try {
          return socket.addRequest(req, connectOpts);
        } catch (err) {
          return cb(err);
        }
      }
      this[INTERNAL].currentSocket = socket;
      super.createSocket(req, options, cb);
    }, (err) => {
      this.decrementSockets(name2, fakeSocket);
      cb(err);
    });
  }
  createConnection() {
    const socket = this[INTERNAL].currentSocket;
    this[INTERNAL].currentSocket = void 0;
    if (!socket) {
      throw new Error("No socket was returned in the `connect()` function");
    }
    return socket;
  }
  get defaultPort() {
    return this[INTERNAL].defaultPort ?? (this.protocol === "https:" ? 443 : 80);
  }
  set defaultPort(v) {
    if (this[INTERNAL]) {
      this[INTERNAL].defaultPort = v;
    }
  }
  get protocol() {
    return this[INTERNAL].protocol ?? (this.isSecureEndpoint() ? "https:" : "http:");
  }
  set protocol(v) {
    if (this[INTERNAL]) {
      this[INTERNAL].protocol = v;
    }
  }
};

// node_modules/https-proxy-agent/dist/index.js
import { URL as URL2 } from "url";

// node_modules/https-proxy-agent/dist/parse-proxy-response.js
var import_debug = __toESM(require_src(), 1);
var debug = (0, import_debug.default)("https-proxy-agent:parse-proxy-response");
function parseProxyResponse(socket) {
  return new Promise((resolve7, reject) => {
    let buffersLength = 0;
    const buffers = [];
    function read() {
      const b = socket.read();
      if (b)
        ondata(b);
      else
        socket.once("readable", read);
    }
    function cleanup() {
      socket.removeListener("end", onend);
      socket.removeListener("error", onerror);
      socket.removeListener("readable", read);
    }
    function onend() {
      cleanup();
      debug("onend");
      reject(new Error("Proxy connection ended before receiving CONNECT response"));
    }
    function onerror(err) {
      cleanup();
      debug("onerror %o", err);
      reject(err);
    }
    function ondata(b) {
      buffers.push(b);
      buffersLength += b.length;
      const buffered = Buffer.concat(buffers, buffersLength);
      const endOfHeaders = buffered.indexOf("\r\n\r\n");
      if (endOfHeaders === -1) {
        debug("have not received end of HTTP headers yet...");
        read();
        return;
      }
      const headerParts = buffered.slice(0, endOfHeaders).toString("ascii").split("\r\n");
      const firstLine = headerParts.shift();
      if (!firstLine) {
        socket.destroy();
        return reject(new Error("No header received from proxy CONNECT response"));
      }
      const firstLineParts = firstLine.split(" ");
      const statusCode = +firstLineParts[1];
      const statusText = firstLineParts.slice(2).join(" ");
      const headers = {};
      for (const header of headerParts) {
        if (!header)
          continue;
        const firstColon = header.indexOf(":");
        if (firstColon === -1) {
          socket.destroy();
          return reject(new Error(`Invalid header from proxy CONNECT response: "${header}"`));
        }
        const key = header.slice(0, firstColon).toLowerCase();
        const value = header.slice(firstColon + 1).trimStart();
        const current = headers[key];
        if (typeof current === "string") {
          headers[key] = [current, value];
        } else if (Array.isArray(current)) {
          current.push(value);
        } else {
          headers[key] = value;
        }
      }
      debug("got proxy server response: %o %o", firstLine, headers);
      cleanup();
      resolve7({
        connect: {
          statusCode,
          statusText,
          headers
        },
        buffered
      });
    }
    socket.on("error", onerror);
    socket.on("end", onend);
    read();
  });
}

// node_modules/proxy-agent-negotiate/dist/index.js
function createNegotiateAuth() {
  return async ({ response, scheme }) => {
    if (scheme.toLowerCase() !== "negotiate") {
      throw new Error(`Expected Negotiate scheme but got "${scheme}"`);
    }
    let kerberos;
    try {
      kerberos = await import("kerberos");
    } catch {
      throw new Error('The "kerberos" package is required for Negotiate proxy authentication. Install it with: npm install kerberos');
    }
    const proxyAuthenticate = response.headers["proxy-authenticate"] || "";
    const challengeHeader = Array.isArray(proxyAuthenticate) ? proxyAuthenticate[0] : proxyAuthenticate;
    const serverToken = typeof challengeHeader === "string" && challengeHeader.includes(" ") ? challengeHeader.split(" ").slice(1).join(" ") : void 0;
    const client = await kerberos.initializeClient("HTTP@proxy", {
      mechOID: kerberos.GSS_MECH_OID_SPNEGO
    });
    const token = await client.step(serverToken || "");
    if (!token) {
      throw new Error("Kerberos client.step() returned no token");
    }
    return {
      headers: {
        "Proxy-Authorization": `Negotiate ${token}`
      }
    };
  };
}

// node_modules/https-proxy-agent/dist/index.js
var debug2 = (0, import_debug2.default)("https-proxy-agent");
var setServernameFromNonIpHost = (options) => {
  if (options.servername === void 0 && options.host && !net2.isIP(options.host)) {
    return {
      ...options,
      servername: options.host
    };
  }
  return options;
};
var HttpsProxyAgent = class extends Agent2 {
  constructor(proxy, opts) {
    super(opts);
    this.options = { path: void 0 };
    this.proxy = typeof proxy === "string" ? new URL2(proxy) : proxy;
    this.proxyHeaders = opts?.headers ?? {};
    debug2("Creating new HttpsProxyAgent instance: %o", this.proxy.href);
    if (opts?.negotiate) {
      this.onProxyAuth = createNegotiateAuth();
    } else if (opts?.onProxyAuth) {
      this.onProxyAuth = opts.onProxyAuth;
    }
    const host = (this.proxy.hostname || this.proxy.host).replace(/^\[|\]$/g, "");
    const port = this.proxy.port ? parseInt(this.proxy.port, 10) : this.proxy.protocol === "https:" ? 443 : 80;
    this.connectOpts = {
      // Attempt to negotiate http/1.1 for proxy servers that support http/2
      ALPNProtocols: ["http/1.1"],
      ...opts ? omit(opts, "headers", "onProxyAuth", "negotiate") : null,
      host,
      port
    };
  }
  /**
   * Called when the node-core HTTP client library is creating a
   * new HTTP request.
   */
  async connect(req, opts) {
    const { proxy } = this;
    if (!opts.host) {
      throw new TypeError('No "host" provided');
    }
    let socket;
    if (proxy.protocol === "https:") {
      debug2("Creating `tls.Socket`: %o", this.connectOpts);
      socket = tls.connect(setServernameFromNonIpHost(this.connectOpts));
    } else {
      debug2("Creating `net.Socket`: %o", this.connectOpts);
      socket = net2.connect(this.connectOpts);
    }
    const headers = typeof this.proxyHeaders === "function" ? this.proxyHeaders() : { ...this.proxyHeaders };
    const host = net2.isIPv6(opts.host) ? `[${opts.host}]` : opts.host;
    let payload = `CONNECT ${host}:${opts.port} HTTP/1.1\r
`;
    if (proxy.username || proxy.password) {
      const auth = `${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`;
      headers["Proxy-Authorization"] = `Basic ${Buffer.from(auth).toString("base64")}`;
    }
    headers.Host = `${host}:${opts.port}`;
    if (!headers["Proxy-Connection"]) {
      headers["Proxy-Connection"] = this.keepAlive ? "Keep-Alive" : "close";
    }
    for (const name2 of Object.keys(headers)) {
      payload += `${name2}: ${headers[name2]}\r
`;
    }
    const proxyResponsePromise = parseProxyResponse(socket);
    socket.write(`${payload}\r
`);
    const { connect: connect5, buffered } = await proxyResponsePromise;
    req.emit("proxyConnect", connect5);
    this.emit("proxyConnect", connect5, req);
    req.emit("proxy", { proxy: this.proxy.href, socket });
    if (connect5.statusCode === 200) {
      req.once("socket", resume);
      if (opts.secureEndpoint) {
        debug2("Upgrading socket connection to TLS");
        return tls.connect({
          ...omit(setServernameFromNonIpHost(opts), "host", "path", "port"),
          socket
        });
      }
      return socket;
    }
    if (connect5.statusCode === 407 && this.onProxyAuth) {
      debug2("Got 407 response, invoking onProxyAuth callback");
      socket.destroy();
      const proxyAuthenticate = connect5.headers["proxy-authenticate"] || "";
      const scheme = Array.isArray(proxyAuthenticate) ? proxyAuthenticate[0].split(/\s/)[0] : proxyAuthenticate.split(/\s/)[0];
      const authResponse = await this.onProxyAuth({
        response: connect5,
        scheme
      });
      return this._connectWithAuth(req, opts, authResponse.headers);
    }
    socket.destroy();
    const fakeSocket = new net2.Socket({ writable: false });
    fakeSocket.readable = true;
    req.once("socket", (s) => {
      debug2("Replaying proxy buffer for failed request");
      assert(s.listenerCount("data") > 0);
      s.push(buffered);
      s.push(null);
    });
    return fakeSocket;
  }
  /**
   * Retry a CONNECT request with additional auth headers.
   */
  async _connectWithAuth(req, opts, authHeaders) {
    const { proxy } = this;
    let socket;
    if (proxy.protocol === "https:") {
      socket = tls.connect(setServernameFromNonIpHost(this.connectOpts));
    } else {
      socket = net2.connect(this.connectOpts);
    }
    const headers = typeof this.proxyHeaders === "function" ? this.proxyHeaders() : { ...this.proxyHeaders };
    const host = net2.isIPv6(opts.host) ? `[${opts.host}]` : opts.host;
    let payload = `CONNECT ${host}:${opts.port} HTTP/1.1\r
`;
    if (proxy.username || proxy.password) {
      const auth = `${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`;
      headers["Proxy-Authorization"] = `Basic ${Buffer.from(auth).toString("base64")}`;
    }
    Object.assign(headers, authHeaders);
    headers.Host = `${host}:${opts.port}`;
    if (!headers["Proxy-Connection"]) {
      headers["Proxy-Connection"] = this.keepAlive ? "Keep-Alive" : "close";
    }
    for (const name2 of Object.keys(headers)) {
      payload += `${name2}: ${headers[name2]}\r
`;
    }
    const proxyResponsePromise = parseProxyResponse(socket);
    socket.write(`${payload}\r
`);
    const { connect: connect5 } = await proxyResponsePromise;
    req.emit("proxyConnect", connect5);
    this.emit("proxyConnect", connect5, req);
    if (connect5.statusCode === 200) {
      req.once("socket", resume);
      if (opts.secureEndpoint) {
        debug2("Upgrading socket connection to TLS");
        return tls.connect({
          ...omit(setServernameFromNonIpHost(opts), "host", "path", "port"),
          socket
        });
      }
      return socket;
    }
    socket.destroy();
    throw new Error(`Proxy authentication failed with status ${connect5.statusCode} after retry`);
  }
};
HttpsProxyAgent.protocols = ["http", "https"];
function resume(socket) {
  setImmediate(() => {
    socket.resume();
  });
}
function omit(obj, ...keys) {
  const ret = {};
  let key;
  for (key in obj) {
    if (!keys.includes(key)) {
      ret[key] = obj[key];
    }
  }
  return ret;
}

// node_modules/socks-proxy-agent/dist/index.js
var import_socks = __toESM(require_build(), 1);
var import_debug3 = __toESM(require_src(), 1);
import * as dns from "dns";
import * as net3 from "net";
import * as tls2 from "tls";
import { URL as URL3 } from "url";
var debug3 = (0, import_debug3.default)("socks-proxy-agent");
var setServernameFromNonIpHost2 = (options) => {
  if (options.servername === void 0 && options.host && !net3.isIP(options.host)) {
    return {
      ...options,
      servername: options.host
    };
  }
  return options;
};
function parseSocksURL(url) {
  let lookup2 = false;
  let type = 5;
  const host = url.hostname;
  const port = parseInt(url.port, 10) || 1080;
  switch (url.protocol.replace(":", "")) {
    case "socks4":
      lookup2 = true;
      type = 4;
      break;
    // pass through
    case "socks4a":
      type = 4;
      break;
    case "socks5":
      lookup2 = true;
      type = 5;
      break;
    // pass through
    case "socks":
      type = 5;
      break;
    case "socks5h":
      type = 5;
      break;
    default:
      throw new TypeError(`A "socks" protocol must be specified! Got: ${String(url.protocol)}`);
  }
  const proxy = {
    host,
    port,
    type
  };
  if (url.username) {
    Object.defineProperty(proxy, "userId", {
      value: decodeURIComponent(url.username),
      enumerable: false
    });
  }
  if (url.password != null) {
    Object.defineProperty(proxy, "password", {
      value: decodeURIComponent(url.password),
      enumerable: false
    });
  }
  return { lookup: lookup2, proxy };
}
var SocksProxyAgent = class extends Agent2 {
  constructor(uri, opts) {
    super(opts);
    const url = typeof uri === "string" ? new URL3(uri) : uri;
    const { proxy, lookup: lookup2 } = parseSocksURL(url);
    this.shouldLookup = lookup2;
    this.proxy = proxy;
    this.proxyUrl = url.href;
    this.timeout = opts?.timeout ?? null;
    this.socketOptions = opts?.socketOptions ?? null;
  }
  /**
   * Initiates a SOCKS connection to the specified SOCKS proxy server,
   * which in turn connects to the specified remote host and port.
   */
  async connect(req, opts) {
    const { shouldLookup, proxy, timeout } = this;
    if (!opts.host) {
      throw new Error("No `host` defined!");
    }
    let { host } = opts;
    const { port, lookup: lookupFn = dns.lookup } = opts;
    if (shouldLookup) {
      host = await new Promise((resolve7, reject) => {
        lookupFn(host, {}, (err, address) => {
          if (err) {
            reject(err);
          } else {
            resolve7(typeof address === "string" ? address : address[0].address);
          }
        });
      });
    }
    const socksOpts = {
      proxy,
      destination: {
        host,
        port: typeof port === "number" ? port : parseInt(port, 10)
      },
      command: "connect",
      timeout: timeout ?? void 0,
      // @ts-expect-error the type supplied by socks for socket_options is wider
      // than necessary since socks will always override the host and port
      socket_options: this.socketOptions ?? void 0
    };
    const cleanup = (tlsSocket) => {
      req.destroy();
      socket.destroy();
      if (tlsSocket)
        tlsSocket.destroy();
    };
    debug3("Creating socks proxy connection: %o", socksOpts);
    const { socket } = await import_socks.SocksClient.createConnection(socksOpts);
    debug3("Successfully created socks proxy connection");
    req.emit("proxy", { proxy: this.proxyUrl, socket });
    if (timeout !== null) {
      socket.setTimeout(timeout);
      socket.on("timeout", () => cleanup());
    }
    if (opts.secureEndpoint) {
      debug3("Upgrading socket connection to TLS");
      const tlsSocket = tls2.connect({
        ...omit2(setServernameFromNonIpHost2(opts), "host", "path", "port"),
        socket
      });
      tlsSocket.once("error", (error) => {
        debug3("Socket TLS error", error.message);
        cleanup(tlsSocket);
      });
      return tlsSocket;
    }
    return socket;
  }
};
SocksProxyAgent.protocols = [
  "socks",
  "socks4",
  "socks4a",
  "socks5",
  "socks5h"
];
function omit2(obj, ...keys) {
  const ret = {};
  let key;
  for (key in obj) {
    if (!keys.includes(key)) {
      ret[key] = obj[key];
    }
  }
  return ret;
}

// src/hosts.js
import { readFile, stat } from "node:fs/promises";
var hostsError = (code, message) => Object.assign(new Error(message), { code });
function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return "";
  }
}
var parseHosts = (text3) => text3.split("\n").map((line) => line.split("#")[0].trim().toLowerCase()).filter(Boolean);
function hostMatches(host, pattern2) {
  if (host === "") return false;
  if (pattern2 === "*") return true;
  if (pattern2.startsWith(".")) return host.endsWith(pattern2);
  return host === pattern2 || host.endsWith(`.${pattern2}`);
}
function createHostRules(rules = [], io = {}) {
  const read = io.read ?? ((path) => readFile(path, "utf8"));
  const version = io.version ?? (async (path) => (await stat(path)).mtimeMs);
  const files = /* @__PURE__ */ new Map();
  async function patternsOf(rule) {
    const listed2 = (rule.hosts ?? []).map((pattern2) => pattern2.trim().toLowerCase()).filter(Boolean);
    if (!rule.hostsFile) return listed2;
    try {
      const current = await version(rule.hostsFile);
      if (files.get(rule.hostsFile)?.version !== current) files.set(rule.hostsFile, { version: current, patterns: parseHosts(await read(rule.hostsFile)) });
    } catch (error) {
      files.delete(rule.hostsFile);
      throw hostsError("hosts_unreadable", `cannot read the hosts file ${rule.hostsFile}: ${error.message}`);
    }
    return [...listed2, ...files.get(rule.hostsFile).patterns];
  }
  return {
    /**
     * The first rule naming the host of any of `urls`, or null.
     * @param {...string} urls
     * @returns {Promise<Rule | null>}
     */
    async match(...urls) {
      const hosts = urls.map(hostOf).filter(Boolean);
      for (const rule of rules) {
        const patterns = await patternsOf(rule);
        if (hosts.some((host) => patterns.some((pattern2) => hostMatches(host, pattern2)))) return rule;
      }
      return null;
    }
  };
}

// src/proxy.js
var PROXY_URL = /^(socks4a?|socks5h?|https?):\/\/[^\s/]+\/?$/;
var MAX_REDIRECTS = 5;
var USER_AGENT = "dsh-media-hub";
var PROBE_TIMEOUT_MS = 3e3;
var proxyError = (code, message) => Object.assign(new Error(message), { code });
function proxyAnswers(proxy, timeoutMs = PROBE_TIMEOUT_MS) {
  const { hostname, port, protocol } = new URL(proxy);
  const defaultPort = protocol.startsWith("socks") ? 1080 : protocol === "https:" ? 443 : 80;
  return new Promise((resolve7) => {
    const socket = connect4({ host: hostname.replace(/^\[|\]$/g, ""), port: Number(port) || defaultPort });
    const done = (up) => {
      socket.destroy();
      resolve7(up);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}
function createProxies(rules = [], io = {}) {
  const hostRules = createHostRules(rules, io);
  const agents = /* @__PURE__ */ new Map();
  async function route(url, page = "") {
    try {
      return (await hostRules.match(url, page))?.url ?? "";
    } catch (error) {
      throw proxyError("proxy_unavailable", error.message);
    }
  }
  function agentFor(proxy) {
    if (proxy === "") return void 0;
    if (!agents.has(proxy)) agents.set(proxy, proxy.startsWith("socks") ? new SocksProxyAgent(proxy) : new HttpsProxyAgent(proxy));
    return agents.get(proxy);
  }
  async function get(url, page, timeoutMs) {
    const protocol = new URL(url).protocol;
    if (protocol !== "https:" && protocol !== "http:") throw proxyError("invalid", `not a web address: ${url}`);
    const agent = agentFor(await route(url, page));
    return new Promise((resolve7, reject) => {
      const send = protocol === "https:" ? httpsRequest : httpRequest;
      const req = send(url, { agent, headers: { "user-agent": USER_AGENT, accept: "image/*,*/*;q=0.5" }, timeout: timeoutMs }, resolve7);
      req.on("timeout", () => req.destroy(proxyError("timeout", `no answer from ${hostOf(url)} in ${timeoutMs / 1e3} s`)));
      req.on("error", reject);
      req.end();
    });
  }
  return {
    route,
    /**
     * Fetch `url` into `file` through its route, following redirects (each hop routed again).
     * @param {{ page?: string, maxBytes: number, timeoutMs: number }} options
     */
    async download(url, file, { page = "", maxBytes, timeoutMs }) {
      let target = url;
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const response = await get(target, page, timeoutMs);
        const { statusCode = 0, headers } = response;
        if (statusCode >= 300 && statusCode < 400 && headers.location) {
          response.resume();
          target = new URL(headers.location, target).href;
          continue;
        }
        if (statusCode !== 200) {
          response.resume();
          throw proxyError("fetch_failed", `${hostOf(target)} answered ${statusCode}`);
        }
        if (Number(headers["content-length"]) > maxBytes) {
          response.destroy();
          throw proxyError("too_large", `the file is over ${maxBytes} bytes`);
        }
        let received = 0;
        response.on("data", (chunk) => {
          received += chunk.length;
          if (received > maxBytes) response.destroy(proxyError("too_large", `the file is over ${maxBytes} bytes`));
        });
        await pipeline(response, createWriteStream(file));
        return;
      }
      throw proxyError("fetch_failed", `more than ${MAX_REDIRECTS} redirects from ${hostOf(url)}`);
    }
  };
}

// src/sources/command.js
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat as stat2 } from "node:fs/promises";
import { basename as basename2, join as join2 } from "node:path";

// src/i18n.js
var BASE = "en";
var TAG = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i;
function chain(tag) {
  const parts = String(tag ?? "").toLowerCase().split("-").filter(Boolean);
  const tags = parts.map((_, i) => parts.slice(0, parts.length - i).join("-"));
  return tags.includes(BASE) ? tags : [...tags, BASE];
}
function pick2(value, tag) {
  if (typeof value === "string") return value;
  if (value === null || typeof value !== "object") return "";
  const byTag = new Map(Object.entries(value).map(([key, text3]) => [key.toLowerCase(), text3]));
  for (const candidate of chain(tag)) {
    const text3 = byTag.get(candidate);
    if (typeof text3 === "string" && text3 !== "") return text3;
  }
  return Object.values(value).find((text3) => typeof text3 === "string" && text3 !== "") ?? "";
}
function localeOf(tag) {
  try {
    return new Intl.Locale(tag).maximize();
  } catch {
    return null;
  }
}
function bestTag(tags, wanted) {
  if (!wanted) return null;
  const target = localeOf(wanted);
  let best = null;
  let score = 0;
  for (const tag of tags) {
    const locale = localeOf(tag);
    const value = tag.toLowerCase() === wanted.toLowerCase() ? 3 : locale && target && locale.language === target.language && locale.script === target.script ? 2 : locale && target && locale.language === target.language ? 1 : 0;
    if (value > score) [best, score] = [tag, value];
  }
  return best;
}

// src/sources/process.js
import { spawn } from "node:child_process";
import { access, constants } from "node:fs/promises";
import { delimiter, isAbsolute, join } from "node:path";
var MAX_OUTPUT = 16 * 1024 * 1024;
var sourceError = (code, message) => Object.assign(new Error(message), { code });
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
var lastLine = (text3) => text3.trim().split("\n").filter(Boolean).pop() ?? "";

// src/sources/command.js
var SEARCH_LIMIT = 12;
var QUERY_TIMEOUT_MS = 6e4;
var COVER_TIMEOUT_MS = 3e4;
var ID = /^[^\s\0]{1,200}$/;
var sourceError2 = (code, message) => Object.assign(new Error(message), { code });
var text = (value) => typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
var numberOrNull = (value) => Number.isFinite(value) ? value : null;
var STATUSES = /* @__PURE__ */ new Set(["finished", "ongoing", "stopped"]);
var WEB_URL = /^https?:\/\/[^\s]{1,2000}$/;
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
    cover: WEB_URL.test(text(raw.cover)) ? text(raw.cover) : null,
    url: WEB_URL.test(text(raw.url)) ? text(raw.url) : null,
    duration: Number.isFinite(raw.duration) && raw.duration > 0 ? Math.round(raw.duration) : null,
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
function parseSearch(document2, kinds) {
  if (!Array.isArray(document2?.results)) throw sourceError2("source_failed", "the search answer has no results list");
  const kindIds = new Set(kinds.map((kind) => kind.id));
  return document2.results.map((raw) => resultOf(raw, kindIds)).filter((result) => result !== null);
}
function nextOffset(document2, offset = 0) {
  return Number.isInteger(document2?.next) && document2.next > offset ? document2.next : null;
}
function parseInfo(document2) {
  const id = text(document2?.id);
  if (!ID.test(id)) throw sourceError2("source_failed", "the source returned no work");
  const listed2 = Array.isArray(document2.episodes) ? document2.episodes.length : 0;
  const related = (Array.isArray(document2.related) ? document2.related : []).map((raw) => {
    const work = resultOf(raw, null);
    return work === null ? null : { ...work, relation: text(raw.relation) };
  }).filter((work) => work !== null && work.id !== id).slice(0, MAX_RELATED);
  const episodeTitles = Array.isArray(document2.episodes) ? document2.episodes.map((episode) => text(episode?.title)) : [];
  return { ...resultOf(document2, null), id, episodes: listed2 > 0 ? listed2 : null, episodeTitles, related };
}
function sha256Of(path) {
  return new Promise((resolve7, reject) => {
    const hash = createHash("sha256");
    createReadStream(path).on("data", (chunk) => hash.update(chunk)).on("error", reject).on("end", () => resolve7(hash.digest("hex")));
  });
}
async function verify(dir, event, label, logger) {
  const name2 = typeof event.name === "string" ? event.name : "";
  if (name2 === "" || basename2(name2) !== name2 || name2.startsWith(".")) return { ok: false, name: name2 };
  const path = join2(dir, name2);
  try {
    const intact = (await stat2(path)).size === event.bytes && (typeof event.sha256 !== "string" || await sha256Of(path) === event.sha256);
    if (intact) return { ok: true, name: name2 };
    await rm(path, { force: true });
    logger.warn("%s: %s does not match what the command reported; removed", label, name2);
  } catch (error) {
    if (error.code !== "ENOENT") logger.warn("%s: could not check %s: %s", label, name2, error.message);
    else logger.warn("%s: %s was reported done but is not there", label, name2);
  }
  return { ok: false, name: name2 };
}
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
  const name2 = () => pick2(label, BASE) || sourceId;
  async function workDir() {
    await mkdir(cwd, { recursive: true });
    return cwd;
  }
  async function query(args) {
    const { code, stdout, stderr, oversized } = await run([...command, ...args], { timeoutMs: QUERY_TIMEOUT_MS, cwd: await workDir(), env });
    if (oversized) throw sourceError2("source_failed", `${name2()}: the answer is too large`);
    if (code !== 0) throw sourceError2("source_failed", `${name2()}: ${lastLine(stderr) || `exit ${code}`}`);
    try {
      return JSON.parse(stdout);
    } catch {
      throw sourceError2("source_failed", `${name2()}: the answer is not JSON`);
    }
  }
  return {
    id: sourceId,
    label: label ?? "",
    kinds,
    filters: understood,
    available: () => commandExists(command[0]),
    /** @returns {{ results: object[], next: number | null }} `next` is the offset of the following page when the source offers one. */
    async search(textQuery, { kind = kinds[0]?.id, limit = SEARCH_LIMIT, offset = 0, filters = {} } = {}) {
      if (!kindIds.has(kind)) throw sourceError2("invalid", `${name2()} has no kind ${kind}`);
      const q = String(textQuery ?? "").trim();
      if (q === "") return { results: [], next: null };
      const paging = offset > 0 ? ["--offset", String(offset)] : [];
      const document2 = await query(["search", "--kind", kind, "--limit", String(limit), ...paging, ...filterArgs(filters, understood), "--json", "--", q]);
      return { results: parseSearch(document2, kinds).filter((result) => result.kind === kind), next: nextOffset(document2, offset) };
    },
    async info(id) {
      if (!ID.test(String(id))) throw sourceError2("invalid", `not a ${name2()} id`);
      return parseInfo(await query(["info", "--json", "--", String(id)]));
    },
    /** Fetch a cover image into `file` through the command, which keeps its own network policy. Rejects when the command has no `cover` verb or cannot fetch it. */
    async cover(url, file) {
      if (!WEB_URL.test(String(url))) throw sourceError2("invalid", "not a cover url");
      const { code, stderr } = await run([...command, "cover", "--output", file, "--", String(url)], { timeoutMs: COVER_TIMEOUT_MS, cwd: await workDir(), env });
      if (code !== 0) throw sourceError2("source_failed", `${name2()}: ${lastLine(stderr) || `exit ${code}`}`);
    },
    async download({ id, dir, from: from2 = 1, to = null, signal, onEpisode, onStart, onPartial }) {
      if (!ID.test(String(id))) throw sourceError2("invalid", `not a ${name2()} id`);
      const failed = [];
      let result = null;
      let checking = Promise.resolve();
      const growing = /* @__PURE__ */ new Map();
      const settle2 = (number) => {
        growing.get(number)?.();
        growing.delete(number);
      };
      const episodes = to === null ? `${from2}-` : from2 === to ? String(from2) : `${from2}-${to}`;
      const onLine = (line) => {
        const event = parseLine(line);
        if (event?.event === "start" && Number.isInteger(event.number)) {
          onStart?.(event.number);
          onEpisode?.();
        } else if (event?.event === "partial" && Number.isInteger(event.number) && !growing.has(event.number)) {
          const names = Array.isArray(event.files) ? event.files.filter((file) => typeof file === "string" && file !== "" && basename2(file) === file) : [];
          if (names.length === 0) return;
          const until = new Promise((done) => growing.set(event.number, done));
          onPartial?.(event.number, { files: names.map((file) => join2(dir, file)), subtitles: [], growing: until });
        } else if (event?.event === "done") {
          if (Number.isInteger(event.number)) settle2(event.number);
          checking = checking.then(() => verify(dir, event, name2(), logger)).then((file) => {
            if (file.ok) onEpisode?.();
            else failed.push(file.name);
          });
        } else if (event?.event === "failed" && typeof event.name === "string") {
          if (Number.isInteger(event.number)) settle2(event.number);
          failed.push(event.name);
        } else if (event?.event === "result") result = event;
      };
      const argv = [...command, "download", `--id=${String(id)}`, "--episodes", episodes, "--output", dir, "--json"];
      const { code, stderr } = await run(argv, { signal, cwd: await workDir(), env, onStdoutLine: onLine });
      for (const number of [...growing.keys()]) settle2(number);
      await checking;
      onEpisode?.();
      if (signal?.aborted) return { failed };
      if (code !== 0 && failed.length === 0) {
        logger.warn("%s download %s ended with %s: %s", name2(), id, code, lastLine(stderr));
        throw sourceError2("source_failed", `${name2()}: ${lastLine(stderr) || `exit ${code}`}`);
      }
      if (code === 0 && result === null) throw sourceError2("source_failed", `${name2()}: the download ended without a result`);
      return { failed };
    },
    /**
     * Download one work of a book kind as one file in `format` into `dir`.
     * @returns {Promise<{ name: string, bytes: number, sha256: string }>} the file, checked against what the command reported
     */
    async downloadFile({ id, format, dir, signal }) {
      if (!ID.test(String(id))) throw sourceError2("invalid", `not a ${name2()} id`);
      if (!FORMAT.test(String(format))) throw sourceError2("invalid", `not a format: ${format}`);
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
      if (signal?.aborted) throw sourceError2("cancelled", `${name2()}: cancelled`);
      if (code !== 0) throw sourceError2("source_failed", `${name2()}: ${lastLine(stderr) || `exit ${code}`}`);
      if (result === null || reported.length === 0) throw sourceError2("source_failed", `${name2()}: the download ended without a file`);
      const event = reported[reported.length - 1];
      const file = await verify(dir, event, name2(), logger);
      if (!file.ok) throw sourceError2("source_failed", `${name2()}: the file did not arrive whole`);
      return { name: file.name, bytes: event.bytes, sha256: typeof event.sha256 === "string" ? event.sha256 : await sha256Of(join2(dir, file.name)) };
    }
  };
}

// src/sources/index.js
import { join as join8 } from "node:path";

// src/sources/link.js
import { mkdir as mkdir5, readdir as readdir3, rename as rename2, rm as rm5, writeFile as writeFile2 } from "node:fs/promises";
import { dirname as dirname2, extname as extname4, join as join7 } from "node:path";

// src/captions.js
var MARKS = Object.freeze(["auto", "original"]);
var known = new Intl.DisplayNames([BASE], { type: "language", fallback: "none" });
function captionLanguage(tag) {
  try {
    const { language } = new Intl.Locale(tag);
    return language === "und" || known.of(language) === void 0 ? null : language;
  } catch {
    return null;
  }
}
var captionLabel = ({ tag, auto = false, original = false }) => [tag, ...auto ? ["auto"] : [], ...original ? ["original"] : []].join(".");

// src/episodes.js
import { basename as basename3, extname } from "node:path";

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
var titleOf = (name2) => basename3(name2, extname(name2));
function episodeNumber(name2) {
  const match = /^\s*0*(\d+)(?!\d)/.exec(basename3(name2));
  return match === null ? null : Number(match[1]);
}
var isSourced = (entry) => entry?.source?.episodes > 0;
var numbersOf = (names) => new Set(names.map(episodeNumber).filter((n) => n !== null));
function slotsOf(entry, files) {
  if (!isSourced(entry)) return files.map((file, index) => ({ key: file.name, n: index + 1, title: titleOf(file.name), file }));
  const byNumber = /* @__PURE__ */ new Map();
  for (const file of files) {
    const n = episodeNumber(file.name);
    if (n !== null && !byNumber.has(n)) byNumber.set(n, file);
  }
  const numbers = new Set(byNumber.keys());
  for (let n = 1; n <= entry.source.episodes; n++) numbers.add(n);
  return [...numbers].sort((a, b) => a - b).map((n) => ({ key: n, n, title: episodeTitle(entry.work, n) ?? (byNumber.has(n) ? titleOf(byNumber.get(n).name) : null), file: byNumber.get(n) ?? null }));
}
var keyOf = (entry, name2) => isSourced(entry) ? episodeNumber(name2) : name2;
function noteFor(entry, notes, name2) {
  if (notes === void 0) return void 0;
  if (!isSourced(entry)) return notes[name2];
  const n = episodeNumber(name2);
  const found = Object.entries(notes).find(([saved]) => episodeNumber(saved) === n);
  return found?.[1];
}

// src/library.js
import { open, readdir, stat as stat3 } from "node:fs/promises";
import { basename as basename4, dirname, extname as extname2, join as join3 } from "node:path";
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
var extOf = (name2) => extname2(name2).toLowerCase();
var isVideo = (name2) => VIDEO_EXTENSIONS.includes(extOf(name2));
var isAudio = (name2) => AUDIO_EXTENSIONS.includes(extOf(name2));
var isMedia = (name2) => !name2.startsWith(".") && (isVideo(name2) || isAudio(name2));
var isSubtitle = (name2) => SUBTITLE_EXTENSIONS.includes(extOf(name2));
function naturalSort(names) {
  return [...names].sort(collator.compare);
}
function matchSubtitles(video, names) {
  const stem = basename4(video, extname2(video));
  const found = [];
  for (const name2 of naturalSort(names)) {
    if (!isSubtitle(name2)) continue;
    const subStem = basename4(name2, extname2(name2));
    if (subStem === stem) found.push({ name: name2, label: "" });
    else if (subStem.startsWith(`${stem}.`)) found.push({ name: name2, label: subStem.slice(stem.length + 1) });
  }
  return found;
}
var titleOf2 = (file) => basename4(file, extname2(file));
async function scanSource(path) {
  const info = await stat3(path);
  const folder = info.isDirectory() ? path : dirname(path);
  const names = await readdir(folder);
  const videos = info.isDirectory() ? naturalSort(names.filter(isMedia)) : [basename4(path)];
  if (videos.length === 0) throw Object.assign(new Error(`no video or audio files in ${path}`), { code: "empty" });
  return videos.map((name2) => ({
    title: titleOf2(name2),
    path: join3(folder, name2),
    subtitles: matchSubtitles(name2, names).map((sub) => ({ path: join3(folder, sub.name), label: sub.label }))
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
  const handle = await open(path, "r");
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

// src/cookies.js
import { randomBytes } from "node:crypto";
import { copyFile, chmod, mkdir as mkdir2, rm as rm2 } from "node:fs/promises";
import { join as join4 } from "node:path";
var cookiesError = (code, message) => Object.assign(new Error(message), { code });
var accountView = (account) => account === null ? null : { name: account.name || account.person || "" };
function createCookies(rules = [], io = {}) {
  const hostRules = createHostRules(rules, io);
  return {
    /**
     * The account for reading `url` on behalf of `person` (a sign-in id, '' for nobody known), or null.
     * @returns {Promise<{ person: string, name: string, file: string, userAgent: string, share: boolean } | null>}
     */
    async account(url, person = "") {
      const rule = await hostRules.match(url);
      const accounts = (rule?.accounts ?? []).map((entry) => ({ person: "", name: "", userAgent: "", share: false, ...entry }));
      return (person !== "" ? accounts.find((entry) => entry.person === person) : void 0) ?? accounts.find((entry) => entry.person === "") ?? accounts.find((entry) => entry.share) ?? null;
    },
    /**
     * yt-dlp's arguments for an account, with a private copy of its cookies in `dir`; `done` deletes the copy.
     * @returns {Promise<{ args: string[], done: () => Promise<void> }>}
     */
    async use(account, dir) {
      if (account === null) return { args: [], done: async () => {
      } };
      await mkdir2(dir, { recursive: true });
      const copy = join4(dir, `.cookies-${randomBytes(6).toString("hex")}.txt`);
      try {
        await copyFile(account.file, copy);
        await chmod(copy, 384);
      } catch (error) {
        await rm2(copy, { force: true });
        throw cookiesError("cookies_unavailable", `cannot read the cookies of the account ${accountView(account).name}: ${error.code ?? error.message}`);
      }
      const args = ["--cookies", copy, ...account.userAgent ? ["--user-agent", account.userAgent] : []];
      return { args, done: () => rm2(copy, { force: true }) };
    }
  };
}

// src/prepare.js
import { spawn as spawn3 } from "node:child_process";
import { createHash as createHash3 } from "node:crypto";
import { mkdir as mkdir4, readFile as readFile3, readdir as readdir2, rename, rm as rm4, stat as stat5, writeFile } from "node:fs/promises";
import { extname as extname3, join as join6 } from "node:path";

// src/stream.js
import { spawn as spawn2 } from "node:child_process";
import { createHash as createHash2 } from "node:crypto";
import { mkdir as mkdir3, open as open2, readFile as readFile2, rm as rm3, stat as stat4 } from "node:fs/promises";
import { join as join5 } from "node:path";
import { Readable } from "node:stream";
var PLAYLIST = "index.m3u8";
var READY_SEGMENTS = 3;
var SEGMENT_SECONDS = 4;
var POLL_MS = 300;
var PROBE_STEP = 64 << 10;
var CHUNK = 1 << 20;
var sleep = (ms) => new Promise((done) => setTimeout(done, ms));
var sizeOf = (path) => stat4(path).then((info) => info.size, () => null);
function settledFlag(promise) {
  const flag = { done: false };
  Promise.resolve(promise).then(() => {
    flag.done = true;
  }, () => {
    flag.done = true;
  });
  return flag;
}
async function* follow(path, ended, { pollMs = POLL_MS, signal } = {}) {
  while (await sizeOf(path) === null) {
    if (ended.done || signal?.aborted) return;
    await sleep(pollMs);
  }
  const handle = await open2(path, "r");
  try {
    let position = 0;
    const buffer = Buffer.alloc(CHUNK);
    for (; ; ) {
      if (signal?.aborted) return;
      const finished = ended.done;
      const { bytesRead } = await handle.read(buffer, 0, CHUNK, position);
      if (bytesRead > 0) {
        position += bytesRead;
        yield Buffer.from(buffer.subarray(0, bytesRead));
      } else if (finished) {
        return;
      } else {
        await sleep(pollMs);
      }
    }
  } finally {
    await handle.close();
  }
}
function streamPlan(infos, maxHeight) {
  const videoAt = infos.findIndex((info) => info.video !== null);
  const audioAt = infos.findIndex((info) => info.audio !== null);
  if (videoAt < 0 && audioAt < 0) return null;
  const video = videoAt < 0 ? null : infos[videoAt];
  return {
    video: videoAt < 0 ? null : { input: videoAt, copy: video.video === "h264" && (video.height ?? 0) <= maxHeight },
    audio: audioAt < 0 ? null : { input: audioAt, copy: ["aac", "mp3"].includes(infos[audioAt].audio) }
  };
}
function hlsArgs(plan, inputs, dir, { maxHeight = 1080, threads = 2 } = {}) {
  const video = plan.video === null ? [] : plan.video.copy ? ["-map", `${plan.video.input}:v:0`, "-c:v", "copy"] : [
    "-map",
    `${plan.video.input}:v:0`,
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
    "-force_key_frames",
    `expr:gte(t,n_forced*${SEGMENT_SECONDS})`
  ];
  const audio = plan.audio === null ? [] : plan.audio.copy ? ["-map", `${plan.audio.input}:a:0`, "-c:a", "copy"] : ["-map", `${plan.audio.input}:a:0`, "-c:a", "aac", "-b:a", "160k", "-ac", "2"];
  return [
    "-y",
    ...inputs.flatMap((input) => ["-i", input]),
    ...video,
    ...audio,
    "-sn",
    "-dn",
    "-threads",
    String(threads),
    "-f",
    "hls",
    "-hls_time",
    String(SEGMENT_SECONDS),
    "-hls_list_size",
    "0",
    "-hls_playlist_type",
    "event",
    "-hls_segment_type",
    "fmp4",
    "-hls_flags",
    "independent_segments+temp_file",
    "-hls_segment_filename",
    join5(dir, "%05d.m4s"),
    join5(dir, PLAYLIST)
  ];
}
async function probeGrowing(file, ended, { ffprobe, signal }) {
  let tried = -1;
  for (; ; ) {
    if (signal?.aborted) throw new Error("stopped");
    const finished = ended.done;
    const size = await sizeOf(file) ?? 0;
    if (finished || size >= tried + PROBE_STEP) {
      tried = size;
      const info = await probe(file, { ffprobe }).catch(() => null);
      if (info !== null && (info.video !== null || info.audio !== null)) return info;
      if (finished) throw new Error(`cannot read ${file}`);
    }
    await sleep(POLL_MS);
  }
}
function playable(text3) {
  return text3.includes("#EXT-X-ENDLIST") || (text3.match(/#EXTINF:/g) ?? []).length >= READY_SEGMENTS;
}
async function finishedPlaylist(dir) {
  const file = join5(dir, PLAYLIST);
  const text3 = await readFile2(file, "utf8").catch(() => "");
  return text3.includes("#EXT-X-ENDLIST") ? file : null;
}
async function streamEpisode({ files, growing, dir, ffmpeg = "ffmpeg", ffprobe = "ffprobe", maxHeight = 1080, threads = 2, onReady, signal }) {
  const ended = settledFlag(growing ?? null);
  await rm3(dir, { recursive: true, force: true });
  await mkdir3(dir, { recursive: true });
  const infos = [];
  for (const file of files) infos.push(await probeGrowing(file, ended, { ffprobe, signal }));
  const plan = streamPlan(infos, maxHeight);
  if (plan === null) throw new Error("nothing to play in the inputs");
  const duration = Math.max(0, ...infos.map((info) => info.duration ?? 0)) || null;
  const inputs = growing === void 0 ? files : files.map((_, n) => `pipe:${n + 3}`);
  const args = hlsArgs(plan, inputs, dir, { maxHeight, threads });
  const playlist = join5(dir, PLAYLIST);
  const child = spawn2("nice", ["-n", "10", ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", ...args], {
    stdio: ["ignore", "ignore", "pipe", ...growing === void 0 ? [] : files.map(() => "pipe")],
    signal
  });
  if (growing !== void 0) {
    files.forEach((file, n) => {
      const pipe = child.stdio[n + 3];
      pipe.on("error", () => {
      });
      const feed = Readable.from(follow(file, ended, { signal }));
      feed.on("error", () => pipe.destroy());
      feed.pipe(pipe);
    });
  }
  let errors = "";
  child.stderr.on("data", (chunk) => {
    errors = (errors + chunk).slice(-4e3);
  });
  const exited = new Promise((resolve7, reject) => {
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve7() : reject(new Error(`ffmpeg exited with ${code}: ${errors.trim().split("\n").pop() ?? ""}`)));
  });
  const running = settledFlag(exited);
  let told = false;
  while (!running.done && !told) {
    if (playable(await readFile2(playlist, "utf8").catch(() => ""))) {
      told = true;
      onReady?.({ playlist, duration });
    } else {
      await sleep(POLL_MS);
    }
  }
  await exited;
  if (!told) onReady?.({ playlist, duration });
  return { playlist, duration };
}
function createStreams({ cacheDir, tools, need, ready, lost, logger, convert }) {
  const episodes = /* @__PURE__ */ new Map();
  const forget = (key, entry) => {
    if (episodes.get(key) === entry) episodes.delete(key);
  };
  function start(key, entry) {
    const { show, number, partial: { files, subtitles = [], growing } } = entry;
    const controller = new AbortController();
    const dir = join5(cacheDir, `stream-${createHash2("sha256").update(`${key}\0${Date.now()}`).digest("hex").slice(0, 20)}`);
    entry.controller = controller;
    entry.prepared = null;
    streamEpisode({
      files,
      growing,
      dir,
      ...tools,
      signal: controller.signal,
      onReady: async ({ playlist, duration }) => {
        const converted = [];
        for (const [n, sub] of subtitles.entries()) {
          try {
            converted.push({ file: await convert(sub.path, dir, `external-${n}`), label: sub.label });
          } catch {
          }
        }
        if (controller.signal.aborted) return;
        entry.prepared = { file: playlist, kind: "hls", duration, subtitles: converted };
        ready(show, number, entry.prepared);
      }
    }).then(() => {
      forget(key, entry);
    }, (error) => {
      if (!controller.signal.aborted) {
        logger.warn("could not play %s episode %d while it downloads: %s", show, number, error.message);
        entry.failed = true;
      }
      entry.controller = null;
      entry.prepared = null;
      if (entry.ended || entry.failed) forget(key, entry);
      lost(show, number);
    });
  }
  function update() {
    const wanted = need();
    for (const [key, entry] of episodes) {
      const rank = wanted.get(key);
      if (rank === void 0) entry.controller?.abort("left");
      else if (rank === 0 && entry.controller === null && !entry.ended) start(key, entry);
      else if (rank === 0 && entry.prepared !== null) ready(entry.show, entry.number, entry.prepared);
    }
  }
  return {
    /**
     * An episode's files while its download goes on (a source's `onPartial`).
     * @param {{ files: string[], subtitles: { path: string, label: string }[], growing: Promise<unknown> }} partial
     */
    offer(show, number, partial) {
      const key = streamKey(show, number);
      episodes.get(key)?.controller?.abort("replaced");
      const entry = { show, number, partial, controller: null, prepared: null, ended: false, failed: false };
      episodes.set(key, entry);
      Promise.resolve(partial.growing).catch(() => {
      }).finally(() => {
        entry.ended = true;
        if (entry.controller === null) forget(key, entry);
      });
      update();
    },
    update,
    stop() {
      for (const entry of episodes.values()) entry.controller?.abort("stop");
    }
  };
}
var streamKey = (show, number) => `${show}\0${number}`;

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
var isVtt = (text3) => /^\uFEFF?WEBVTT/.test(text3);

// src/prepare.js
async function cacheKey(path) {
  const info = await stat5(path);
  return createHash3("sha256").update(`${path}\0${info.size}\0${info.mtimeMs}`).digest("hex").slice(0, 20);
}
async function preparedBytes(cacheDir, path) {
  const key = await cacheKey(path).catch(() => null);
  if (key === null) return 0;
  let total = 0;
  for (const name2 of await readdir2(join6(cacheDir, key)).catch(() => [])) total += (await stat5(join6(cacheDir, key, name2)).catch(() => null))?.size ?? 0;
  return total;
}
async function dropPrepared(cacheDir, path) {
  const key = await cacheKey(path).catch(() => null);
  if (key !== null) await rm4(join6(cacheDir, key), { recursive: true, force: true });
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
var remuxArgs = (input, output) => ["-y", "-i", input, "-map", "0:V:0?", "-map", "0:a:0?", "-sn", "-dn", "-c", "copy", "-movflags", "+faststart", "-f", "mp4", output];
async function writeAtomic(path, data) {
  await writeFile(`${path}.part`, data);
  await rename(`${path}.part`, path);
}
var exists = (path) => stat5(path).then(() => true, () => false);
async function convertSubtitle(source, dir, name2, { ffmpeg = "ffmpeg" } = {}) {
  const out = join6(dir, `${name2}.vtt`);
  if (await exists(out)) return out;
  const text3 = decodeText(await readFile3(source));
  const ext = extname3(source).toLowerCase();
  if (ext === ".srt") await writeAtomic(out, srtToVtt(text3));
  else if (ext === ".vtt" || isVtt(text3)) await writeAtomic(out, text3);
  else {
    const utf8 = join6(dir, `${name2}.utf8${ext}`);
    await writeFile(utf8, text3);
    try {
      await runFfmpeg(["-y", "-i", utf8, "-f", "webvtt", `${out}.part`], { ffmpeg, duration: null });
      await rename(`${out}.part`, out);
    } finally {
      await rm4(utf8, { force: true });
    }
  }
  return out;
}
async function prepareEpisode(episode, options) {
  const { cacheDir, ffmpeg = "ffmpeg", ffprobe = "ffprobe", maxHeight = 1080, threads = 2, onProgress, onReady, signal } = options;
  if (extname3(episode.path).toLowerCase() === ".m3u8") {
    return { file: episode.path, kind: "hls", duration: null, plan: "direct", subtitles: await externalSubtitles(episode, null, ffmpeg, cacheDir) };
  }
  const dir = join6(cacheDir, await cacheKey(episode.path));
  await mkdir4(dir, { recursive: true });
  const info = await probe(episode.path, { ffprobe });
  const mp4Family = [".mp4", ".m4v", ".mov", ".m4a"].includes(extname3(episode.path).toLowerCase());
  const plan = planVideo(episode.path, info, { fastStart: mp4Family ? await isFastStart(episode.path) : null, maxHeight });
  const subtitles = await externalSubtitles(episode, dir, ffmpeg, cacheDir);
  await embeddedSubtitles(episode.path, info, dir, ffmpeg, subtitles);
  if (plan === "transcode") {
    const hls = join6(dir, "hls");
    const prepared = (file2) => ({ file: file2, kind: "hls", duration: info.duration, plan, subtitles });
    const done = await finishedPlaylist(hls);
    if (done !== null) return prepared(done);
    const { playlist } = await streamEpisode({ files: [episode.path], dir: hls, ffmpeg, ffprobe, maxHeight, threads, signal, onReady: (ready) => onReady?.(prepared(ready.playlist)) });
    return prepared(playlist);
  }
  let file = episode.path;
  if (plan === "remux") {
    file = join6(dir, "video.mp4");
    if (!await exists(file)) {
      await runFfmpeg(remuxArgs(episode.path, `${file}.part`), { ffmpeg, duration: info.duration, onProgress, signal });
      await rename(`${file}.part`, file);
    }
  }
  return { file, kind: "file", duration: info.duration, plan, subtitles };
}
async function embeddedSubtitles(path, info, dir, ffmpeg, subtitles) {
  for (const stream of info.subtitles.filter((s) => isTextSubtitle(s.codec))) {
    const out = join6(dir, `embedded-${stream.index}.vtt`);
    if (!await exists(out)) {
      try {
        await runFfmpeg(["-y", "-i", path, "-map", `0:s:${stream.index}`, "-f", "webvtt", `${out}.part`], { ffmpeg, duration: null });
        await rename(`${out}.part`, out);
      } catch {
        continue;
      }
    }
    subtitles.push({ file: out, label: captionLanguage(stream.language) !== null ? stream.language : stream.title || `Track ${stream.index + 1}` });
  }
}
async function externalSubtitles(episode, dir, ffmpeg, cacheDir) {
  if (episode.subtitles.length === 0) return [];
  const target = dir ?? join6(cacheDir, await cacheKey(episode.path));
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
  for (const name2 of await readdir2(cacheDir).catch(() => [])) {
    if (keep.has(name2)) continue;
    const info = await stat5(join6(cacheDir, name2)).catch(() => null);
    if (info !== null && now - info.mtimeMs > days * 864e5) await rm4(join6(cacheDir, name2), { recursive: true, force: true });
  }
}

// src/sources/ytdlp.js
var PROGRESS_ARGS = Object.freeze([
  "--progress",
  "--newline",
  "--progress-delta",
  "1",
  "--progress-template",
  'download:{"event":"progress","format":"%(info.format_id|)s","downloaded":%(progress.downloaded_bytes|null)s,"total":%(progress.total_bytes,progress.total_bytes_estimate|null)s,"speed":%(progress.speed|null)s,"eta":%(progress.eta|null)s}'
]);
var positive = (value) => Number.isFinite(value) && value > 0 ? value : null;
function sizeEstimate(format, duration) {
  const announced = positive(format?.filesize) ?? positive(format?.filesize_approx);
  if (announced !== null) return Math.round(announced);
  const rate = positive(format?.tbr) ?? (positive(format?.vbr) ?? 0) + (positive(format?.abr) ?? 0);
  return rate > 0 && positive(duration) !== null ? Math.round(rate * 125 * duration) : null;
}
function createProgress(parts, report) {
  const state = new Map(parts.map((part) => [String(part.format), { done: 0, total: part.estimate, speed: 0, finished: false }]));
  const emit = () => {
    const all = [...state.values()];
    const done = all.reduce((sum, part) => sum + part.done, 0);
    const total = all.every((part) => part.total !== null) ? all.reduce((sum, part) => sum + Math.max(part.total, part.done), 0) : null;
    const speed = all.reduce((sum, part) => sum + (part.finished ? 0 : part.speed), 0);
    report({
      fraction: total ? Math.min(1, done / total) : null,
      done,
      total,
      speed: speed > 0 ? speed : null,
      eta: speed > 0 && total ? Math.round(Math.max(0, total - done) / speed) : null
    });
  };
  emit();
  return {
    /** Feed every progress line of every part's run. */
    event(event) {
      const part = event?.event === "progress" ? state.get(String(event.format)) : void 0;
      if (part === void 0) return;
      part.done = positive(event.downloaded) ?? part.done;
      part.total = positive(event.total) ?? part.total;
      part.speed = positive(event.speed) ?? 0;
      emit();
    },
    /** A part's file is complete: its size is what it fetched. */
    finished(format) {
      const part = state.get(String(format));
      if (part === void 0) return;
      part.finished = true;
      if (part.done > 0) part.total = part.done;
      emit();
    }
  };
}
var REASONS = Object.freeze(["blocked", "sign_in", "not_found", "proxy_down", "failed"]);
var REFUSED = /* @__PURE__ */ new Set([403, 412, 429, 451]);
var MISSING = /* @__PURE__ */ new Set([404, 410]);
function failureReason(stderr) {
  const status = Number(/HTTP Error (\d{3})/.exec(stderr)?.[1]);
  if (status === 401 || /--cookies\b/.test(stderr)) return "sign_in";
  if (REFUSED.has(status)) return "blocked";
  if (MISSING.has(status) || /\bUnsupported URL\b/.test(stderr)) return "not_found";
  return "failed";
}
var TEXT_FORMATS = /* @__PURE__ */ new Set(["vtt", "srt", "ass", "ssa"]);
var hasText = (formats) => (Array.isArray(formats) ? formats : []).some((format) => TEXT_FORMATS.has(String(format?.ext)));
var listed = (list) => Object.entries(list ?? {}).filter(([tag, formats]) => hasText(formats) && captionLanguage(tag) !== null).map(([tag]) => tag);
function chooseCaptions(data, viewer) {
  const own = captionLanguage(data?.language);
  const made = listed(data?.subtitles);
  const machine = listed(data?.automatic_captions);
  const chosen = made.map((tag) => ({ tag, auto: false }));
  for (const language of [captionLanguage(viewer), own]) {
    if (language === null || chosen.some((track) => captionLanguage(track.tag) === language)) continue;
    const tag = bestTag(machine.filter((candidate) => captionLanguage(candidate) === language), language === own ? data.language : viewer);
    if (tag !== null) chosen.push({ tag, auto: true });
  }
  return chosen.map((track) => ({ ...track, original: own !== null && captionLanguage(track.tag) === own }));
}
function captionArgs(chosen) {
  if (chosen.length === 0) return [];
  return ["--write-subs", "--write-auto-subs", "--sub-langs", chosen.map((track) => escapeTag(track.tag)).join(","), "--sub-format", "vtt/srt/ass/best", "--convert-subs", "vtt"];
}
var escapeTag = (tag) => `^${tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`;

// src/sources/link.js
var LINK_SOURCE = "link";
var AUTO = "auto";
var AUDIO = "audio";
var HEIGHTS = Object.freeze([2160, 1440, 1080, 720, 480, 360]);
var isQuality = (value) => value === AUTO || value === AUDIO || /^\d{3,4}$/.test(String(value)) && Number(value) >= 144;
var INFO_TIMEOUT_MS = 12e4;
var COVER_TIMEOUT_MS2 = 3e4;
var MAX_BLURB = 1e3;
var MAX_URL = 200;
var REASON_TEXT = Object.freeze({
  blocked: "the site refused the request",
  sign_in: "the site wants a signed-in account",
  not_found: "there is nothing to play at this address",
  proxy_down: "the proxy for this site is not answering",
  failed: "the site did not give the video"
});
var linkError = (code, message, reason) => Object.assign(new Error(message), { code, ...reason ? { reason } : {} });
var failure = (reason) => linkError("source_failed", REASON_TEXT[reason], reason);
var isWebAddress = (value) => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};
function thumbnailOf(data) {
  if (typeof data.thumbnail === "string") return data.thumbnail;
  const listed2 = (Array.isArray(data.thumbnails) ? data.thumbnails : []).filter((entry) => typeof entry?.url === "string");
  return listed2.sort((a, b) => (a.width ?? 0) - (b.width ?? 0)).pop()?.url ?? null;
}
var seconds = (value) => Number.isFinite(value) && value > 0 ? Math.round(value) : null;
function qualityChoices(formats, maxHeight) {
  const known2 = Array.isArray(formats) ? formats.map((format) => format?.height).filter((height) => Number.isInteger(height) && height > 0) : [];
  const heights = (known2.length > 0 ? [...new Set(known2)] : HEIGHTS).filter((height) => height <= maxHeight && height >= 144).sort((a, b) => b - a);
  return [AUTO, ...heights.map(String), AUDIO];
}
function infoDocument(data, url, maxHeight) {
  const page = typeof data.webpage_url === "string" && isWebAddress(data.webpage_url) ? data.webpage_url : url;
  const entries = data._type === "playlist" ? (data.entries ?? []).filter((entry) => entry !== null && typeof entry === "object") : [data];
  const durations = entries.map((entry) => seconds(entry.duration));
  const site = data.webpage_url_domain ?? new URL(page).hostname;
  return {
    id: page,
    url: page,
    kind: "video",
    title: data.title ?? data.id ?? page,
    author: data.uploader ?? data.channel ?? data.playlist_uploader ?? "",
    blurb: typeof data.description === "string" ? data.description.slice(0, MAX_BLURB) : "",
    cover: thumbnailOf(data) ?? thumbnailOf(entries[0] ?? {}),
    duration: durations.every(Boolean) ? durations.reduce((sum, value) => sum + value, 0) : null,
    popularity: Number.isFinite(data.view_count) ? { count: data.view_count, label: "plays" } : null,
    tags: Array.isArray(data.tags) ? data.tags : [],
    meta: [{ key: "site", label: "Site", value: site }],
    episodes: entries.map((entry, index) => ({ number: index + 1, title: entry.title ?? "" })),
    qualities: qualityChoices(data._type === "playlist" ? null : data.formats, maxHeight)
  };
}
function formatArgs(quality, maxHeight) {
  if (quality === AUDIO) return ["-f", "ba/b", "-S", "acodec:aac"];
  const height = quality === AUTO || !isQuality(quality) ? maxHeight : Math.min(Number(quality), maxHeight);
  return ["-f", "bv*+ba/b", "-S", `res:${height},vcodec:h264,acodec:aac`];
}
var AUDIO_FILE = Object.freeze(["-x", "--audio-format", "m4a"]);
var MAX_STEM_BYTES = 100;
var MERGED = Object.freeze(["mp4", "mkv"]);
var INCOMING = ".incoming";
function episodeStem(number, title) {
  const clean = String(title ?? "").replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  let cut = "";
  for (const char of clean) {
    if (Buffer.byteLength(cut + char) > MAX_STEM_BYTES) break;
    cut += char;
  }
  const number3 = String(number).padStart(3, "0");
  return cut === "" ? number3 : `${number3} ${cut}`;
}
function createLinkSource({ ytDlp, ffmpeg = "ffmpeg", proxies, cookies, maxHeight, cwd, logger }) {
  async function workDir() {
    await mkdir5(cwd, { recursive: true });
    return cwd;
  }
  async function access2(url, person) {
    if (!isWebAddress(url)) throw linkError("invalid", "not a web address");
    let proxy;
    try {
      proxy = await proxies.route(url);
    } catch (error) {
      logger.warn("link %s: %s", url, error.message);
      throw failure("proxy_down");
    }
    let account;
    try {
      account = await cookies.account(url, person);
    } catch (error) {
      logger.warn("link %s: %s", url, error.message);
      throw failure("failed");
    }
    return { proxy, account };
  }
  async function ytdlp(url, args, { person = "", load = null, ...options } = {}) {
    const { proxy, account } = await access2(url, person);
    const dir = await workDir();
    let session;
    try {
      session = await cookies.use(account, dir);
    } catch (error) {
      logger.warn("link %s: %s", url, error.message);
      throw failure("sign_in");
    }
    try {
      const target = load === null ? ["--", url] : ["--load-info-json", load];
      const result = await run([ytDlp, "--no-warnings", "--no-playlist", "--proxy", proxy, ...session.args, ...args, ...target], { cwd: dir, ...options });
      return { ...result, proxy, account };
    } finally {
      await session.done();
    }
  }
  async function reasonOf(url, { code, stderr, proxy }) {
    const reason = proxy !== "" && !await proxyAnswers(proxy) ? "proxy_down" : failureReason(stderr);
    logger.warn("link %s failed (%s): %s", url, reason, lastLine(stderr) || `exit ${code}`);
    return failure(reason);
  }
  async function lookUp(url, args, options) {
    const result = await ytdlp(url, ["-J", ...args], options);
    if (result.oversized) throw linkError("source_failed", "the page lists too much to read", "failed");
    if (result.code !== 0) throw await reasonOf(url, result);
    try {
      return { data: JSON.parse(result.stdout), account: result.account };
    } catch {
      throw linkError("source_failed", "yt-dlp answered something that is not JSON", "failed");
    }
  }
  async function fetchCaptions(url, { entry, load, work, dir, stem, language, person, signal }) {
    const chosen = chooseCaptions(entry, language);
    if (chosen.length === 0) return [];
    const result = await ytdlp(url, ["--skip-download", ...captionArgs(chosen), "-o", join7(work, "captions")], { person, load, signal });
    if (result.code !== 0) logger.warn("link %s: captions: %s", url, lastLine(result.stderr));
    const placed = [];
    for (const track of chosen) {
      const label = captionLabel(track);
      const target = join7(dir, `${stem}.${label}.vtt`);
      if (await rename2(join7(work, `captions.${track.tag}.vtt`), target).then(() => true, () => false)) placed.push({ path: target, label });
    }
    return placed;
  }
  async function assemble(files, dir, stem) {
    if (files.length === 1) {
      const target = join7(dir, `${stem}${extname4(files[0])}`);
      await rename2(files[0], target);
      return target;
    }
    let last = null;
    for (const ext of MERGED) {
      const target = join7(dir, `${stem}.${ext}`);
      const part = join7(dirname2(files[0]), `merged.${ext}`);
      try {
        await runFfmpeg(["-y", ...files.flatMap((file) => ["-i", file]), ...files.flatMap((_, n) => ["-map", String(n)]), "-c", "copy", ...ext === "mp4" ? ["-movflags", "+faststart"] : [], part], { ffmpeg, duration: null });
        await rename2(part, target);
        return target;
      } catch (error) {
        last = error;
      }
    }
    throw last;
  }
  return {
    id: LINK_SOURCE,
    label: "",
    input: "url",
    kinds: [{ id: "video", label: "", media: "video" }],
    filters: [],
    available: () => commandExists(ytDlp),
    /** The work at an address, read with the account `person` would use (so its qualities are what that account gets). */
    async info(url, { person = "" } = {}) {
      const { data, account } = await lookUp(String(url), ["--flat-playlist"], { person, timeoutMs: INFO_TIMEOUT_MS });
      const document2 = infoDocument(data, String(url), maxHeight);
      if (document2.id.length > MAX_URL) throw linkError("invalid", "the address is too long");
      if (document2.episodes.length === 0) throw linkError("empty", "there is no video at this address", "not_found");
      return { ...parseInfo(document2), qualities: document2.qualities, account: accountView(account) };
    },
    /** The thumbnail, through the route of its own host or its page's. */
    async cover(url, file, { page = "" } = {}) {
      await proxies.download(url, file, { page, maxBytes: 2e6, timeoutMs: COVER_TIMEOUT_MS2 });
    },
    /**
     * Episodes `from`..`to` into `dir`, one file each, named by number, with the captions chosen for the viewer's
     * `language` beside them; episodes already there are skipped. Each episode is looked up once, then its formats
     * (a video and an audio file) are fetched side by side, so `onPartial` can hand over files that play while they
     * grow, and `onProgress` tells the episode's progress as a whole.
     */
    async download({ id, dir, from: from2 = 1, to = from2, quality = AUTO, person = "", language = "", signal, onEpisode, onStart, onProgress, onPartial }) {
      await mkdir5(dir, { recursive: true });
      const url = String(id);
      const failed = [];
      let first = null;
      for (let number = from2; number <= to && !signal?.aborted; number++) {
        if ((await readdir3(dir)).some((name2) => isMedia(name2) && episodeNumber(name2) === number)) continue;
        onStart?.(number);
        const work = join7(dir, INCOMING, String(number));
        try {
          await fetchEpisode(number, work);
        } catch (error) {
          if (signal?.aborted) break;
          failed.push(String(number));
          first ??= error;
          logger.warn("link download %s, episode %d: %s", url, number, error.message);
        } finally {
          await rm5(work, { recursive: true, force: true });
        }
        onEpisode?.();
      }
      if (first !== null && failed.length === to - from2 + 1) throw first;
      return { failed };
      async function fetchEpisode(number, work) {
        await rm5(work, { recursive: true, force: true });
        await mkdir5(work, { recursive: true });
        const { data } = await lookUp(url, [...formatArgs(quality, maxHeight), "--write-subs", "--playlist-items", String(number)], { person, signal, timeoutMs: INFO_TIMEOUT_MS });
        const entry = data._type === "playlist" ? (data.entries ?? []).find((item) => item !== null && typeof item === "object") : data;
        if (entry === void 0) throw failure("not_found");
        const load = join7(work, "info.json");
        await writeFile2(load, JSON.stringify(entry));
        const stem = episodeStem(number, entry.title);
        const captions = await fetchCaptions(url, { entry, load, work, dir, stem, language, person, signal });
        try {
          const parts = Array.isArray(entry.requested_formats) && entry.requested_formats.length > 0 ? entry.requested_formats : [entry];
          const progress = createProgress(parts.map((part) => ({ format: String(part.format_id), estimate: sizeEstimate(part, entry.duration) })), (value) => onProgress?.(number, value));
          const runs = parts.map((part, n) => ytdlp(url, [
            "-f",
            String(part.format_id),
            "--no-part",
            ...quality === AUDIO ? AUDIO_FILE : [],
            ...PROGRESS_ARGS,
            "-o",
            join7(work, `part${n}.%(ext)s`)
          ], { person, load, signal, onStdoutLine: (line) => {
            const event = parseLine(line);
            if (event !== null) progress.event(event);
          } }).then((result) => {
            if (result.code === 0) progress.finished(part.format_id);
            return result;
          }));
          if (quality !== AUDIO) onPartial?.(number, { files: parts.map((part, n) => join7(work, `part${n}.${part.ext}`)), subtitles: captions, growing: Promise.allSettled(runs) });
          const results = await Promise.all(runs);
          const broken = results.find((result) => result.code !== 0);
          if (broken !== void 0) throw await reasonOf(url, broken);
          const names = (await readdir3(work)).filter((name2) => /^part\d+\./.test(name2)).sort();
          await assemble(names.map((name2) => join7(work, name2)), dir, stem);
        } catch (error) {
          for (const caption of captions) await rm5(caption.path, { force: true });
          throw error;
        }
      }
    }
  };
}

// src/sources/index.js
var EPISODE_BYTES = Object.freeze({ drama: 15e6, audio: 8e6 });
var MEDIA = Object.freeze(["video", "audio", "book"]);
var ALL_SOURCES = "all";
var RESERVED_IDS = Object.freeze(["local", LINK_SOURCE, ALL_SOURCES]);
function createSources(definitions, { stateDir, logger, link }) {
  const seen = /* @__PURE__ */ new Set();
  for (const { id, kinds } of definitions) {
    if (kinds.length === 0) throw new Error(`source ${id} lists no kinds`);
    if (RESERVED_IDS.includes(id)) throw new Error(`source id ${id} is reserved`);
    if (seen.has(id)) throw new Error(`source id ${id} is listed twice`);
    seen.add(id);
  }
  return [
    ...definitions.map((definition) => createCommandSource(definition, { logger, cwd: join8(stateDir, definition.id) })),
    createLinkSource({ ...link, logger, cwd: join8(stateDir, LINK_SOURCE) })
  ];
}
async function describeSources(sources) {
  const out = [];
  for (const source of sources) {
    if (await source.available()) out.push({ id: source.id, label: source.label, input: source.input ?? "search", kinds: source.kinds.map((kind) => ({ ...kind, media: kind.media ?? "video" })), filters: source.filters });
  }
  return out;
}

// src/config.js
var DSH_HOME = process.env.DSH_HOME || join9(homedir(), ".dsh");
function defaultStateDir(home = DSH_HOME, exists2 = existsSync) {
  const current = join9(home, "media-hub");
  const earlier = join9(home, "videosync");
  return !exists2(current) && exists2(earlier) ? earlier : current;
}
var DEFAULT_STATE_DIR = defaultStateDir();
var Label = Schema.union([Schema.string(), Schema.dict(Schema.string())]);
var SourceConfig = Schema.object({
  id: Schema.string().pattern(/^[a-z0-9][a-z0-9_-]{0,31}$/).description("Stable id, lowercase letters, digits, - and _. Names the source in URLs and saved downloads, and the folder the command runs in (stateDir/<id>). Not local, link or all."),
  label: Label.default("").description("Name on the source's tab: a string, or { <tag>: text } per language. Empty uses the page's own words for this source id (source.name.<id> in locale/), else the id."),
  kinds: Schema.array(Schema.object({
    id: Schema.string().pattern(/^[a-z0-9][a-z0-9_-]{0,31}$/).description("What the command's search --kind takes."),
    label: Label.default("").description("Name of the category chip: a string, or { <tag>: text } per language. Empty uses the page's own words for this kind id (kind.<id> in locale/), else the id."),
    media: Schema.union(MEDIA.map((media) => Schema.const(media))).default("video").description("What a work of this kind is: video or audio (episodes, watched or listened to together in a room) or book (one file, downloaded in a format).")
  })).description("What the source can search for; at least one."),
  filters: Schema.array(Schema.union(FILTERS.map((filter) => Schema.const(filter)))).default([]).description("Search filters the command understands (docs/source-protocol.md). The hub filters the answers by language, format, year and size itself as well."),
  command: Schema.array(Schema.string()).min(1).description("The command and its fixed arguments, one entry per word; the plugin adds the protocol verbs after them."),
  env: Schema.dict(Schema.string()).default({}).description("Extra environment variables for the command.")
});
var hostFields = () => ({
  hosts: Schema.array(Schema.string()).default([]).description("Hosts it applies to: example.com (that host and every host under it), .example (every host ending so), * (every host)."),
  hostsFile: Schema.string().default("").description("A file with more such patterns, one per line, # starting a comment; read again when it changes. While it cannot be read, requests to any host fail instead of going without the rule.")
});
var ProxyRule = Schema.object({
  url: Schema.string().pattern(PROXY_URL).description("The proxy: socks5h://host:port (names resolved by the proxy), socks5://, socks4://, http:// or https://."),
  ...hostFields()
});
var CookieAccount = Schema.object({
  person: Schema.string().default("").description("Whose account this is: their sign-in id (the id the sign-in plugin gives, such as an OpenID subject). Empty makes it the default account, used by anyone without one of their own."),
  name: Schema.string().default("").description("The name shown for this account when someone looks up a link (never the cookies)."),
  file: Schema.string().description("A Netscape cookies file of a signed-in session, kept fresh by whatever holds that session. The hub only reads it: yt-dlp gets a private copy for each run, so nothing is written back."),
  userAgent: Schema.string().default("").description("The User-Agent of the session the cookies belong to, sent with them, so the site sees the same device. Empty keeps yt-dlp's own."),
  share: Schema.boolean().default(false).description("Whether other people's requests may use this account when they have none of their own (a room started by its owner always does).")
});
var CookieRule = Schema.object({
  accounts: Schema.array(CookieAccount).default([]).description("The signed-in accounts for these hosts. A request uses its person's own account, else the default one, else a shared one, in this order."),
  ...hostFields()
});
var DEFAULT_SOURCES = Object.freeze([
  {
    id: "fanqie",
    kinds: [{ id: "drama", media: "video" }, { id: "audio", media: "audio" }, { id: "novel", media: "book" }],
    filters: [],
    command: ["fanqie"],
    env: {}
  },
  {
    id: "bookfetch",
    kinds: [{ id: "ebook", media: "book" }, { id: "paper", media: "book" }],
    filters: ["language", "format", "year"],
    command: ["bookfetch", "source"],
    env: {}
  }
]);
var Presence = Schema.object({
  continue: Schema.boolean().default(true).description("The Continue card at the top of Watching: the show someone is in or last watched, its episodes and joining it."),
  recap: Schema.boolean().default(false).description('"So far" on the Continue card: a summary without spoilers kept with the show, written from outside through the tool (annotate). Shown only to viewers past the episodes it covers.'),
  ratings: Schema.boolean().default(false).description('"How was it?": asks once about a show watched to the end or removed in the last two weeks; one tap writes a rating line to the watch log.'),
  picks: Schema.boolean().default(false).description("Picks: works the recommender command suggests, each with its reason, to watch together or follow. Needs `recommender`.")
});
var Recommender = Schema.object({
  command: Schema.array(Schema.string()).default([]).description("A command speaking docs/recommender-protocol.md (program and fixed arguments, the plugin adds the verbs). Empty means no picks."),
  env: Schema.dict(Schema.string()).default({}).description("Extra environment variables for the command.")
});
var Config = Schema.object({
  label: Label.default("").description("Name of the sidebar entry: a string, or { <tag>: text } per language (the viewer's tag, then its primary subtag, then en). Empty uses the page's own name in the viewer's language."),
  libraryRoots: Schema.array(Schema.string()).default([]).description(`Folders whose videos and episode folders anyone signed in may start a room from in the panel. The "library" folder inside the state folder is always included. The assistant's tool can open any path.`),
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
  presence: Presence.default({ continue: true, recap: false, ratings: false, picks: false }).description("What the Watching tab shows besides the open rooms and the library. Each part can be switched on or off."),
  recommender: Recommender.default({ command: [], env: {} }).description("Where picks come from: a recommender extension. The hub has no taste of its own."),
  ffmpeg: Schema.string().default("ffmpeg").description("ffmpeg command."),
  ffprobe: Schema.string().default("ffprobe").description("ffprobe command."),
  ytDlp: Schema.string().default("yt-dlp").description("yt-dlp command. Link reads and downloads web videos and playlists with it; without it Link is hidden. Its own config file applies."),
  proxies: Schema.array(ProxyRule).default([]).description("Which proxy each outbound request takes, by host: the first rule naming the host wins, any other host goes direct. Applies to every yt-dlp call (by the page's host) and every picture the hub fetches itself. Sources' commands keep their own network setup."),
  cookies: Schema.array(CookieRule).default([]).description("Signed-in accounts for sites, by host: the first rule naming a page's host gives its accounts, and yt-dlp reads that page with the chosen account's cookies and User-Agent. A show keeps the account of whoever fetched it, or started the room on it.")
});

// src/http.js
import { createReadStream as createReadStream2, existsSync as existsSync2 } from "node:fs";
import { readFile as readFile5, stat as stat6 } from "node:fs/promises";
import { dirname as dirname3, extname as extname5, isAbsolute as isAbsolute2, relative, resolve as resolve2, sep } from "node:path";
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

// src/locales.js
import { readdir as readdir4, readFile as readFile4 } from "node:fs/promises";
import { join as join10 } from "node:path";
async function readLocales(dir, logger) {
  const names = (await readdir4(dir).catch(() => [])).filter((name2) => name2.endsWith(".json")).sort();
  const locales = {};
  for (const name2 of names) {
    const tag = name2.slice(0, -".json".length);
    if (!TAG.test(tag)) {
      logger?.warn("locale/%s: the name is not a language tag; skipped", name2);
      continue;
    }
    try {
      const { ui } = JSON.parse(await readFile4(join10(dir, name2), "utf8"));
      if (ui === null || typeof ui !== "object" || Array.isArray(ui)) throw new Error('no "ui" table');
      locales[tag] = Object.fromEntries(Object.entries(ui).filter(([, text3]) => typeof text3 === "string"));
    } catch (error) {
      logger?.warn("locale/%s: %s; skipped", name2, error.message);
    }
  }
  if (locales[BASE] === void 0) logger?.warn("locale/%s.json is missing; every other language falls back to it", BASE);
  return locales;
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
var LOCALE_DIR = resolve2(here, "../locale");
var MODULES = Object.freeze({
  "sync.js": resolve2(here, "../src/sync.js"),
  "formats.js": resolve2(here, "../src/formats.js"),
  "i18n.js": resolve2(here, "../src/i18n.js"),
  "captions.js": resolve2(here, "../src/captions.js")
});
function hlsFile() {
  const built = resolve2(here, "../dist/hls.mjs");
  return existsSync2(built) ? built : resolve2(dirname3(createRequire(import.meta.url).resolve("hls.js/package.json")), "dist/hls.mjs");
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
async function sendFile(req, res, path, type = MEDIA_TYPES[extname5(path).toLowerCase()] ?? "application/octet-stream") {
  let info;
  try {
    info = await stat6(path);
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
function sendText(res, status, text3) {
  res.writeHead(status, { ...SECURITY_HEADERS, "content-type": "text/plain; charset=utf-8" }).end(`${text3}
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
var pick3 = (body2, keys) => Object.fromEntries(keys.filter((key) => body2?.[key] !== void 0).map((key) => [key, body2[key]]));
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
var STATUS = Object.freeze({ invalid: 400, empty: 400, not_found: 404, unsupported: 501, outside: 403, in_use: 409, exists: 409, no_space: 507, source_failed: 424, unavailable: 503 });
var errorBody = (error) => ({ error: { code: error?.code ?? "error", ...error?.reason ? { reason: error.reason } : {}, message: error?.message ?? String(error) } });
function createHandler({ connection, service, settings = () => ({ label: "", presence: {} }), localeDir = LOCALE_DIR, logger }) {
  let locales;
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
        const body2 = file === void 0 ? null : await readFile5(file).catch(() => null);
        if (body2 === null) return sendText(res, 404, "Not found.");
        res.writeHead(200, { ...SECURITY_HEADERS, "content-type": WEB_TYPES[extname5(file)], "content-length": body2.length }).end(body2);
        return;
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
          const target = within(dirname3(item.file), rest);
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
        if (req.method === "GET" && parts[1] === "rooms" && parts.length === 4 && parts[3] === "work") return sendJson(res, 200, await hub.roomWork(parts[2]));
        if (req.method === "DELETE" && parts[1] === "rooms" && parts.length === 3) return sendJson(res, 200, hub.closeRoom(parts[2]));
        if (req.method === "POST" && parts[1] === "rooms" && parts.length === 4 && parts[3] === "together") return sendJson(res, 200, hub.watchTogether(parts[2]));
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
        if (route === "POST follow") return sendJson(res, 200, await hub.followWork(pick3(await readJson(req), ["source", "id", "follow"])));
        if (route === "POST library/seen") return sendJson(res, 200, hub.dismissNews((await readJson(req)).path));
        if (route === "POST library/cancel") return sendJson(res, 200, await hub.cancelDownload((await readJson(req)).path));
        if (route === "GET settings") return sendJson(res, 200, settings());
        if (route === "GET locales") return sendJson(res, 200, await (locales ??= readLocales(localeDir, logger)));
        if (route === "GET sources") return sendJson(res, 200, { sources: await hub.sources() });
        if (route === "GET search") return sendJson(res, 200, await hub.search(query("source"), query("q"), query("kind") || void 0, Math.max(0, Number.parseInt(query("offset"), 10) || 0), parseFilters(query)));
      }
      return sendText(res, 404, "Not found.");
    } catch (error) {
      const status = error?.status ?? STATUS[error?.code] ?? 500;
      if (!res.headersSent) sendJson(res, status, errorBody(error));
      else res.destroy();
    }
  };
}
function refuseUpgrade(socket, status) {
  const text3 = { 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found" }[status] ?? "Error";
  socket.end(`HTTP/1.1 ${status} ${text3}\r
Connection: close\r
Content-Length: 0\r
\r
`);
}

// src/media.js
import { spawn as spawn5 } from "node:child_process";
import { createHash as createHash6 } from "node:crypto";
import { statfs as statfs2, stat as stat10 } from "node:fs/promises";
import { join as join16, resolve as resolve5 } from "node:path";

// src/downloads.js
import { readFile as readFile6, rename as rename3, writeFile as writeFile3 } from "node:fs/promises";
import { join as join11 } from "node:path";

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

// src/downloads.js
var ACTIVE = /* @__PURE__ */ new Set(["queued", "running"]);
var howOf = (source = {}) => ({ quality: source.quality ?? "", person: source.person ?? "", language: source.language ?? "" });
function nextOfRun(job, onDisk) {
  const [from2, to] = job.current ?? [0, -1];
  for (let n = job.at ?? from2; n <= to; n++) if (!onDisk.has(n)) return n;
  return null;
}
var sourceError3 = (code, message) => Object.assign(new Error(message), { code });
function createDownloads({ stateDir, sources, have, hasSpace = async () => true, onFiles, onProgress = () => {
}, onPartial = () => {
}, logger, now = Date.now }) {
  const file = join11(stateDir, "downloads.json");
  const jobs = /* @__PURE__ */ new Map();
  let running = null;
  let disposed = false;
  let saving = Promise.resolve();
  let notifying = Promise.resolve();
  function save() {
    const body2 = JSON.stringify({ jobs: [...jobs.values()].map(({ controller, current, at, ...job }) => job) }, null, 1);
    saving = saving.then(async () => {
      await writeFile3(`${file}.part`, body2);
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
    run3(candidate);
  }
  async function run3(job) {
    const source = sources.get(job.source);
    running = job;
    job.status = "running";
    job.error = null;
    job.reason = null;
    job.failed = [];
    job.controller = new AbortController();
    const { signal } = job.controller;
    save();
    try {
      if (source === void 0) throw sourceError3("unavailable", `source ${job.source} is not available`);
      for (; ; ) {
        const range = nextRun(job.want, await have(job.dir));
        if (range === null || signal.aborted) break;
        if (!await hasSpace()) throw sourceError3("no_space", "the library disk is almost full; delete something first");
        job.current = range;
        job.at = range[0];
        const result = await source.download({ ...howOf(job.how), id: job.id, dir: job.dir, from: range[0], to: range[1], signal, onStart: (n) => {
          job.at = n;
        }, onEpisode: () => notify(job), onProgress: (n, progress) => onProgress(job, n, progress), onPartial: (n, partial) => onPartial(job, n, partial) });
        await notify(job);
        if (signal.aborted) break;
        if (result.failed.length > 0) {
          job.failed = result.failed;
          throw sourceError3("source_failed", `${result.failed.length} episodes could not be downloaded`);
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
      job.reason = error.reason ?? null;
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
        data = JSON.parse(await readFile6(file, "utf8"));
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
     * @param {{ source: string, item: { id: string, title: string, kind: string, episodes: number | null, how?: object }, dir: string }} show - `how` as `howOf` gives it
     * @param {number[]} want
     * @param {{ priority?: boolean, retry?: boolean }} [options] - priority: a room is open on this show
     */
    async want({ source, item, dir }, want, { priority = false, retry = false } = {}) {
      let job = jobs.get(dir);
      if (job === void 0) {
        if (want.length === 0) return null;
        job = { dir, source, id: item.id, title: item.title, kind: item.kind, episodes: item.episodes ?? null, status: "queued", error: null, reason: null, failed: [], priority, want, createdAt: now() };
        jobs.set(dir, job);
      }
      job.how = howOf(item.how);
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
        job.reason = null;
      }
      if (running === job && nextOfRun(job, onDisk) !== first) job.controller.abort("yield");
      save();
      pump();
      return job;
    },
    /** What is happening to a show folder, or null when nothing is. */
    state(dir) {
      const job = jobs.get(dir);
      if (job === void 0) return null;
      return { status: job.status, active: ACTIVE.has(job.status), total: job.episodes, error: job.error, reason: job.reason ?? null, failed: job.failed.length, source: job.source, wanted: job.want.length };
    },
    job: (dir) => jobs.get(dir),
    /** Start a failed job again. */
    retry(dir) {
      const job = jobs.get(dir);
      if (job === void 0) return null;
      if (job.status === "failed") {
        job.status = "queued";
        job.error = null;
        job.reason = null;
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

// src/cache.js
function createCache({ library, downloads, rooms, window: size, logger }) {
  let chain2 = Promise.resolve();
  const serial = (step) => {
    const result = chain2.then(step);
    chain2 = result.catch((error) => logger.warn("rolling cache: %s", error.message));
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
    await downloads.want({ source: info.source.source, item: { id: info.source.id, title: info.source.title ?? "", kind: info.source.kind, episodes: info.total, how: howOf(info.source) }, dir: path }, plan.want, { priority: hasRoom, retry });
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
import { spawn as spawn4 } from "node:child_process";
import { createHash as createHash4, randomUUID } from "node:crypto";
import { mkdir as mkdir6, readFile as readFile7, readdir as readdir5, rename as rename4, rm as rm6, stat as stat7, writeFile as writeFile4 } from "node:fs/promises";
import { extname as extname6, join as join12 } from "node:path";

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
var fileKey = (source, id, format) => createHash4("sha256").update(`${source}
${id}
${format}`).digest("hex").slice(0, 24);
function attachment(name2) {
  const fallback = name2.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "book";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name2)}`;
}
function sha256Of2(path) {
  return readFile7(path).then((body2) => createHash4("sha256").update(body2).digest("hex"));
}
function runConverter(command, input, output) {
  return new Promise((resolve7, reject) => {
    const child = spawn4(command, [input, output], { stdio: ["ignore", "ignore", "pipe"], detached: true });
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
      await mkdir6(dir, { recursive: true });
      const temporary = join12(dir, `.${STATE_FILE}.${process.pid}.tmp`);
      await writeFile4(temporary, JSON.stringify(state));
      await rename4(temporary, join12(dir, STATE_FILE));
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
      cover: entry.cover ? covers.ofSource(entry.source, entry.cover) : null,
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
      await rm6(join12(dir, "files", key), { recursive: true, force: true });
      total -= file.bytes ?? 0;
      state.files[key] = { ...file, state: "removed", name: null };
    }
  }
  async function fetchFile(key, { source: sourceId, id, format }, signal) {
    const source = sources.get(sourceId);
    const work = await source.info(id);
    const native = (work.formats ?? []).some((entry) => entry.format === format) || (work.formats ?? []).length === 0;
    const scratch = join12(dir, "tmp", key);
    await rm6(scratch, { recursive: true, force: true });
    await mkdir6(scratch, { recursive: true });
    try {
      let name2;
      let converted = false;
      if (native) {
        name2 = (await source.downloadFile({ id, format, dir: scratch, signal })).name;
      } else {
        const base = convertBase(work.formats);
        if (base === null || !await converter.available()) throw booksError("unsupported", `${work.title || id} is not offered as ${format}`);
        const downloaded = (await source.downloadFile({ id, format: base, dir: scratch, signal })).name;
        name2 = `${downloaded.slice(0, downloaded.length - extname6(downloaded).length)}.${format}`;
        await runConverter(converter.command, join12(scratch, downloaded), join12(scratch, name2));
        await rm6(join12(scratch, downloaded), { force: true });
        converted = true;
      }
      const target = join12(dir, "files", key);
      await rm6(target, { recursive: true, force: true });
      await mkdir6(join12(dir, "files"), { recursive: true });
      await rename4(scratch, target);
      const path = join12(target, name2);
      return { name: name2, bytes: (await stat7(path)).size, sha256: await sha256Of2(path), converted, title: work.title, author: work.author, cover: work.cover };
    } finally {
      await rm6(scratch, { recursive: true, force: true });
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
        const loaded = JSON.parse(await readFile7(join12(dir, STATE_FILE), "utf8"));
        if (loaded && typeof loaded.files === "object" && typeof loaded.shelves === "object") state = loaded;
      } catch (error) {
        if (error.code !== "ENOENT") logger.warn("books: could not read the shelves: %s", error.message);
      }
      for (const [key, file] of Object.entries(state.files)) {
        if (file.state === "fetching") start(key, file);
        else if (file.state === "ready" && !await stat7(join12(dir, "files", key, file.name ?? "")).then((info) => info.isFile(), () => false)) state.files[key] = { ...file, state: "removed", name: null };
      }
      await rm6(join12(dir, "tmp"), { recursive: true, force: true });
      await this.sweep();
    },
    /** Folders under files/ that no record names (a crash between a rename and a save) are deleted. */
    async sweep() {
      for (const name2 of await readdir5(join12(dir, "files")).catch(() => [])) {
        if (state.files[name2] === void 0) await rm6(join12(dir, "files", name2), { recursive: true, force: true });
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
        await rm6(join12(dir, "files", entry.file), { recursive: true, force: true });
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
      return { path: join12(dir, "files", entry.file, file.name), name: file.name, type: BOOK_TYPES[entry.format] ?? "application/octet-stream" };
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
import { createHash as createHash5 } from "node:crypto";
import { mkdir as mkdir7, open as open3, readdir as readdir6, rename as rename5, rm as rm7, stat as stat8, utimes } from "node:fs/promises";
import { join as join13 } from "node:path";
var KEY = /^[0-9a-f]{32}$/;
var FAILED_FOR_MS = 5 * 6e4;
var MAX_REMEMBERED = 5e3;
var FRAME_HEIGHT = 180;
function imageType(head) {
  if (head.length >= 3 && head[0] === 255 && head[1] === 216 && head[2] === 255) return "image/jpeg";
  if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (head.length >= 4 && head.subarray(0, 4).toString("latin1") === "GIF8") return "image/gif";
  if (head.length >= 12 && head.subarray(0, 4).toString("latin1") === "RIFF" && head.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}
var keyOf2 = (...parts) => createHash5("sha256").update(parts.join("\n")).digest("hex").slice(0, 32);
var coverKey = (sourceId, url) => keyOf2(sourceId, url);
async function grabFrame(input, output, at, { ffmpeg }) {
  const frame = ["-map", "0:V:0", "-frames:v", "1", "-vf", `scale=-2:${FRAME_HEIGHT}`, "-q:v", "5", "-f", "image2", "-c:v", "mjpeg", output];
  const attempts = isAudio(input) ? [["-y", "-i", input, ...frame]] : [["-y", "-ss", String(at), "-i", input, ...frame], ["-y", "-i", input, ...frame]];
  let failure3;
  for (const args of attempts) {
    try {
      await runFfmpeg(args, { ffmpeg, duration: null });
      return;
    } catch (error) {
      failure3 = error;
    }
  }
  throw failure3;
}
function createCovers({ dir, capBytes = 5e7, maxFileBytes = 2e6, concurrency = 3, ffmpeg = "ffmpeg", logger, now = Date.now }, sourceOf) {
  const known2 = /* @__PURE__ */ new Map();
  const inFlight = /* @__PURE__ */ new Map();
  const failed = /* @__PURE__ */ new Map();
  const waiting = [];
  let running = 0;
  const makers = {
    async source({ sourceId, url, page }, file) {
      const source = sourceOf(sourceId);
      if (typeof source?.cover !== "function") throw new Error(`${sourceId} has no pictures`);
      await source.cover(url, file, { page });
    },
    frame: ({ file: input, at }, file) => grabFrame(input, file, at, { ffmpeg })
  };
  const remember = (key, entry) => {
    known2.delete(key);
    known2.set(key, entry);
    if (known2.size > MAX_REMEMBERED) known2.delete(known2.keys().next().value);
    return `covers/${key}`;
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
    for (const name2 of await readdir6(dir).catch(() => [])) {
      if (!name2.endsWith(".img")) continue;
      const info = await stat8(join13(dir, name2)).catch(() => null);
      if (info !== null) files.push({ name: name2, size: info.size, used: info.mtimeMs });
    }
    let total = files.reduce((sum, file) => sum + file.size, 0);
    for (const file of files.sort((a, b) => a.used - b.used)) {
      if (total <= capBytes) break;
      await rm7(join13(dir, file.name), { force: true });
      total -= file.size;
    }
  }
  async function make(key, entry) {
    await mkdir7(dir, { recursive: true });
    const partial = join13(dir, `.${key}.part`);
    try {
      await makers[entry.by](entry, partial);
      const info = await stat8(partial);
      if (info.size === 0 || info.size > maxFileBytes) throw new Error(`the picture is ${info.size} bytes`);
      const handle = await open3(partial, "r");
      const head = Buffer.alloc(12);
      try {
        await handle.read(head, 0, 12, 0);
      } finally {
        await handle.close();
      }
      if (imageType(head) === null) throw new Error("the file is not a picture a browser shows");
      await rename5(partial, join13(dir, `${key}.img`));
      await trim();
      return true;
    } catch (error) {
      logger.warn("picture %s (%s): %s", key, entry.by === "source" ? entry.sourceId : entry.file, error.message);
      return false;
    } finally {
      await rm7(partial, { force: true });
    }
  }
  return {
    /** The route of a picture a source names by `url` (`page`: the work's own address, for the route a fetch takes); the URL itself stays here. */
    ofSource(sourceId, url, page = null) {
      if (typeof url !== "string" || url === "") return null;
      return remember(coverKey(sourceId, url), { by: "source", sourceId, url, page: page ?? "" });
    },
    /** The route of a still of the media file `file`, `at` seconds in; a changed file gets a new one. */
    async ofFrame(file, at = 3) {
      const info = await stat8(file).catch(() => null);
      if (info === null || !info.isFile()) return null;
      return remember(keyOf2("frame", file, info.size, info.mtimeMs, at), { by: "frame", file, at });
    },
    /**
     * The cached picture for a key (making it first when needed), or null.
     * @returns {Promise<{ file: string, type: string } | null>}
     */
    async file(key) {
      if (!KEY.test(key)) return null;
      const file = join13(dir, `${key}.img`);
      const cached = async () => {
        const handle = await open3(file, "r").catch(() => null);
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
      const entry = known2.get(key);
      if (entry === void 0 || (failed.get(key) ?? 0) > now()) return null;
      if (!inFlight.has(key)) {
        inFlight.set(key, queued(() => make(key, entry)).finally(() => inFlight.delete(key)));
      }
      if (!await inFlight.get(key)) {
        failed.set(key, now() + FAILED_FOR_MS);
        return null;
      }
      return cached();
    },
    /** Replace a work's cover URL (and those of its related works) with a route. */
    decorate(sourceId, work) {
      const covered = { ...work, cover: this.ofSource(sourceId, work.cover, work.url) };
      if (Array.isArray(work.related)) covered.related = work.related.map((other) => this.decorate(sourceId, other));
      return covered;
    },
    /** Wait for the pictures being made, so nothing writes into the state folder after shutdown. */
    settle: () => Promise.allSettled([...inFlight.values()])
  };
}

// src/hub.js
import { randomBytes as randomBytes2 } from "node:crypto";
import { mkdir as mkdir8, readFile as readFile8, rename as rename6, writeFile as writeFile5 } from "node:fs/promises";
import { dirname as dirname4, isAbsolute as isAbsolute3, join as join14, resolve as resolve3 } from "node:path";

// src/sync.js
var DRIFT = Object.freeze({
  /** Below this the players count as together. */
  ignore: 0.3,
  /** Above this a player jumps instead of catching up by rate. */
  seek: 2,
  /** A player already catching up by rate keeps at it until this close. */
  settle: 0.1,
  /** Rate change while catching up, as a fraction of the room's rate. */
  nudge: 0.05
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
function createRoom({ id, title, items, createdBy, now }) {
  const room = {
    id,
    title,
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

// src/preparing.js
function needs(rooms, ahead, keyOf3) {
  const out = /* @__PURE__ */ new Map();
  for (const room of rooms) {
    for (let distance = 0; distance <= ahead; distance++) {
      const item = room.items[room.index + distance];
      if (item === void 0) break;
      const key = keyOf3(room, item);
      if (key !== null && !(out.get(key) <= distance)) out.set(key, distance);
    }
  }
  return out;
}
function planPreparing(need, waiting, running) {
  const busy = new Set(running);
  const idle = [...waiting].filter((key) => !busy.has(key) && need.has(key));
  const stop = [...busy].filter((key) => !need.has(key));
  const start = idle.filter((key) => need.get(key) === 0);
  if (![...busy].some((key) => need.get(key) > 0)) {
    const next = idle.filter((key) => need.get(key) > 0).sort((a, b) => need.get(a) - need.get(b))[0];
    if (next !== void 0) start.push(next);
  }
  return { start, stop };
}

// src/hub.js
var PING_MS = 2e4;
var SAVE_DELAY_MS = 1e3;
var SWEEP_MS = 6e4;
var PROGRESS_MS = 12e4;
var MAX_NAME = 40;
var localItem = (episode) => ({ title: episode.title, kind: "file", status: "preparing", sourcePath: episode.path, sourceSubtitles: episode.subtitles });
var slotItem = (entry, status) => ({ title: entry.title, kind: "file", slot: entry.n, status: entry.path === null ? status : "preparing", sourcePath: entry.path, sourceSubtitles: entry.subtitles ?? [] });
var itemKey = (item) => item.slot ?? item.sourcePath;
var serviceError = (code, message) => Object.assign(new Error(message), { code });
var isTogether = (room) => room.together !== false;
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
  const cacheDir = join14(stateDir, "cache");
  const file = join14(stateDir, "rooms.json");
  const rooms = /* @__PURE__ */ new Map();
  const peers = /* @__PURE__ */ new Map();
  const waiters = /* @__PURE__ */ new Map();
  const ahead = options.cache?.ahead ?? 5;
  const preparing = /* @__PURE__ */ new Map();
  let replanning = false;
  let saveTimer = null;
  let disposed = false;
  const waitingOn = (show, number) => [...rooms.values()].filter((room) => room.showPath === show && room.items.some((item) => item.slot === number && item.sourcePath === null && item.status === "preparing"));
  const streams = createStreams({
    cacheDir,
    tools,
    logger,
    convert: (source, dir, name2) => convertSubtitle(source, dir, name2, { ffmpeg: tools.ffmpeg }),
    need: () => needs([...rooms.values()], ahead, (room, item) => room.showPath !== void 0 && item.slot !== void 0 ? streamKey(room.showPath, item.slot) : null),
    ready: (show, number, prepared) => {
      for (const room of waitingOn(show, number)) setItem(room.id, number, { status: "ready", progress: null, error: null, streamed: true, ...prepared });
    },
    // The copy stopped before it was complete: the episode waits for its file (and is prepared from it), or for a room to want it again.
    lost: (show, number) => {
      for (const room of [...rooms.values()]) {
        const item = room.showPath === show ? room.items.find((entry) => entry.slot === number && entry.streamed) : void 0;
        if (item === void 0) continue;
        const waited = typeof item.sourcePath === "string" || room.items[room.index] === item;
        setItem(room.id, number, { status: waited ? "preparing" : "remote", streamed: false, progress: null });
      }
    }
  });
  const sweepTimer = setInterval(() => sweep(), SWEEP_MS);
  const progressTimer = setInterval(() => progress(), PROGRESS_MS);
  async function load() {
    await mkdir8(stateDir, { recursive: true });
    for (const root of libraryRoots) await mkdir8(root, { recursive: true }).catch(() => {
    });
    let data = { rooms: [] };
    try {
      data = JSON.parse(await readFile8(file, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") logger.warn("could not read %s: %s", file, error.message);
    }
    for (const { holds, ...room } of data.rooms ?? []) rooms.set(room.id, { ...hold({ gate: null, gates: 0, startedAt: null, ...room }, now()), cooldown: {}, nextReady: null, emptySince: room.emptySince ?? (room.opened ? now() : null) });
    sweep();
    for (const room of [...rooms.values()]) await reopen(room);
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
    await writeFile5(`${file}.part`, body2);
    await rename6(`${file}.part`, file);
  }
  function commit(room) {
    rooms.set(room.id, { ...room, touchedAt: now() });
    broadcast(room.id);
    save();
    replan();
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
      reason: item.reason ?? null,
      duration: item.duration ?? null,
      watch: options.watchOf?.(item, room.showPath) ?? null,
      src: ready ? delivery.mediaUrl(roomId, index, item) : null,
      subtitles: ready ? (item.subtitles ?? []).map((sub, n) => ({ label: sub.label, src: delivery.subtitleUrl(roomId, index, n) })) : []
    };
  }
  function publicRoom(room) {
    return {
      id: room.id,
      title: room.title,
      index: room.index,
      seq: room.seq,
      last: room.last,
      playing: room.playing,
      together: isTogether(room),
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
      together: isTogether(room),
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
      const known2 = viewers(roomId);
      peer.clientId = cleanText(message.clientId, 64) || randomBytes2(8).toString("base64url");
      peer.name = cleanText(message.name, MAX_NAME) || "Guest";
      if (!known2.includes(peer.name)) observe("joined", { room, viewer: peer.name });
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
    replan();
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
  async function reopen(room) {
    const unfinished = async (item) => item.status === "ready" && item.kind === "hls" && typeof item.file === "string" && item.file.startsWith(`${cacheDir}/`) && await finishedPlaylist(dirname4(item.file)) === null;
    const items = [];
    for (const item of room.items) {
      if (!await unfinished(item)) items.push(item);
      else items.push({ ...item, status: typeof item.sourcePath === "string" ? "preparing" : "remote", streamed: false, progress: null });
    }
    if (items.some((item, n) => item !== room.items[n])) commit(wanting(updateItems(room, items)));
  }
  function replan() {
    if (replanning || disposed) return;
    replanning = true;
    queueMicrotask(() => {
      replanning = false;
      if (disposed) return;
      const all = [...rooms.values()];
      const need = needs(all, ahead, (_, item) => typeof item.sourcePath === "string" && !item.streamed ? item.sourcePath : null);
      const waiting = new Set(all.flatMap((room) => room.items.filter((item) => item.status === "preparing" && typeof item.sourcePath === "string" && !item.streamed).map((item) => item.sourcePath)));
      const { start, stop } = planPreparing(need, waiting, preparing.keys());
      for (const path of stop) preparing.get(path).abort("left");
      for (const path of start) prepare(path);
      streams.update();
    });
  }
  function setPath(path, patch) {
    for (const room of [...rooms.values()]) {
      for (const item of room.items) if (item.sourcePath === path && !item.streamed) setItem(room.id, itemKey(item), patch);
    }
  }
  function prepare(path) {
    const item = [...rooms.values()].flatMap((room) => room.items).find((entry) => entry.sourcePath === path);
    const controller = new AbortController();
    preparing.set(path, controller);
    let last = 0;
    prepareEpisode({ title: item.title, path, subtitles: item.sourceSubtitles ?? [] }, {
      cacheDir,
      ffmpeg: tools.ffmpeg,
      ffprobe: tools.ffprobe,
      maxHeight: tools.maxHeight,
      threads: tools.threads,
      signal: controller.signal,
      onReady: (prepared) => setPath(path, { status: "ready", progress: null, ...prepared }),
      onProgress: (fraction) => {
        if (fraction - last < 0.02) return;
        last = fraction;
        setPath(path, { progress: { step: "prepare", fraction: Math.round(fraction * 100) / 100 } });
      }
    }).then((prepared) => {
      setPath(path, { status: "ready", progress: null, ...prepared });
    }, (error) => {
      if (controller.signal.aborted) return setPath(path, { status: "preparing", progress: null });
      logger.warn("could not prepare %s: %s", path, error.message);
      return setPath(path, { status: "failed", progress: null, error: error.message, reason: null });
    }).finally(() => {
      preparing.delete(path);
      replan();
    });
  }
  async function localItems(path, fromPanel) {
    if (typeof path !== "string" || !isAbsolute3(path)) throw serviceError("invalid", "path must be an absolute path");
    const target = resolve3(path);
    if (fromPanel && !libraryRoots.some((root) => target === root || target.startsWith(`${root}/`))) {
      throw serviceError("outside", "the panel can only open files from the library folders");
    }
    const entries = await options.directory?.(target);
    if (entries) return entries.map((entry) => slotItem(entry, "remote"));
    let episodes;
    try {
      episodes = await scanSource(target);
    } catch (error) {
      if (error.code === "ENOENT") throw serviceError("not_found", `${path} does not exist`);
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
      const items = entries.map((entry) => {
        const prev = before.get(legacy ? entry.path : entry.n);
        if (prev?.streamed) return { ...prev, title: entry.title, sourcePath: entry.path, sourceSubtitles: entry.subtitles ?? [] };
        if (entry.path === null) {
          const waiting = prev !== void 0 && prev.sourcePath === null && (prev.status === "preparing" || prev.status === "failed");
          return waiting ? { ...prev, title: entry.title } : slotItem(entry, "remote");
        }
        if (prev !== void 0 && prev.sourcePath === entry.path) return { ...prev, title: entry.title, slot: entry.n };
        return slotItem(entry, "remote");
      });
      const playing = current.items[current.index];
      const index = legacy ? Math.max(0, entries.findIndex((entry) => entry.path !== null && entry.path === playing?.sourcePath)) : Math.min(current.index, items.length - 1);
      commit(wanting({ ...updateItems(current, items), index }));
    }
  }
  return {
    load,
    /**
     * Create a room on a local file or folder of episodes.
     * @param {{ path: string, title?: string, by?: string, fromPanel?: boolean, together?: boolean, start?: { index: number, position: number } | null }} input - `together`: open to others from the start; else one person watches until they share it
     */
    async createRoom(input) {
      if (!delivery.available) throw serviceError("unsupported", delivery.reason);
      const items = await localItems(input.path, input.fromPanel === true);
      const id = randomBytes2(9).toString("base64url");
      const title = cleanText(input.title, 120) || (items.length === 1 ? items[0].title : input.path.split("/").filter(Boolean).pop());
      const created = createRoom({ id, title, items, createdBy: cleanText(input.by, MAX_NAME), now: now() });
      const start = input.start;
      const room = {
        ...created,
        showPath: resolve3(input.path),
        together: input.together === true,
        ...Number.isInteger(start?.index) && start.index >= 0 && start.index < items.length ? { index: start.index, position: Math.max(0, Number(start.position) || 0) } : {}
      };
      commit(wanting(room));
      observe("opened", { room });
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
      return room === void 0 ? void 0 : { ...summary(room), items: room.items.map((item) => ({ title: item.title, status: item.status, progress: item.progress ?? null, error: item.error ?? null, reason: item.reason ?? null, subtitles: (item.subtitles ?? []).map((sub) => sub.label) })) };
    },
    listRooms() {
      const occupied = (room) => present(room.id).size > 0;
      return [...rooms.values()].sort((a, b) => Number(occupied(b)) - Number(occupied(a)) || (b.touchedAt ?? b.createdAt) - (a.touchedAt ?? a.createdAt)).map(summary);
    },
    /** Open a room someone watches alone to others, as it is: same episode, same position. */
    watchTogether(id) {
      const room = rooms.get(id);
      if (room === void 0) throw serviceError("not_found", "no such room");
      if (!isTogether(room)) commit({ ...room, together: true });
      return { room: summary(rooms.get(id)) };
    },
    closeRoom(id) {
      if (!close(id)) throw serviceError("not_found", "no such room");
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
    /** Episodes someone waits on that could not be fetched: show them as failed (with the reason, when known), so a click on one tries again. */
    failWaiting(path, message, reason = null) {
      const target = resolve3(path);
      for (const room of [...rooms.values()]) {
        if (room.showPath !== target) continue;
        const items = room.items.map((item) => item.slot !== void 0 && item.sourcePath === null && item.status === "preparing" ? { ...item, status: "failed", progress: null, error: message, reason } : item);
        if (items.some((item, n) => item !== room.items[n])) commit(updateItems(rooms.get(room.id), items));
      }
    },
    /**
     * How far the download of episode `number` of a show is, told to the viewers of the rooms waiting on it
     * (a source reports it about once a second).
     * @param {{ fraction: number | null, done: number, total: number | null, speed: number | null, eta: number | null }} progress
     */
    downloadProgress(path, number, progress2) {
      const target = resolve3(path);
      for (const room of [...rooms.values()]) {
        if (room.showPath !== target) continue;
        const item = room.items.find((entry) => entry.slot === number && entry.sourcePath === null && entry.status === "preparing");
        if (item === void 0) continue;
        setItem(room.id, number, { progress: { step: "download", ...progress2 } });
      }
    },
    /**
     * Episode `number` of a show while a source still fetches it, as files that play while they grow
     * (`growing` settles when they are complete): rooms waiting on it play it once enough is there.
     */
    streamEpisode: (path, number, partial) => streams.offer(resolve3(path), number, partial),
    /** The prepared file of a ready local item. */
    mediaFile(roomId, index) {
      const item = rooms.get(roomId)?.items[index];
      return item?.status === "ready" ? { file: item.file, kind: item.kind } : void 0;
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
      for (const controller of preparing.values()) controller.abort("stop");
      streams.stop();
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
import { appendFile, readFile as readFile9 } from "node:fs/promises";
var LOG_NAME = "watch-log.jsonl";
var isWatching = (type) => /^(?:room|viewer|episode)\./.test(type) || type === "position";
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
    let text3 = "";
    try {
      text3 = await readFile9(file, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const events = [];
    for (const line of text3.split("\n")) {
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
      if (!(at >= since) || event.title === void 0 || !isWatching(event.type)) continue;
      const key = event.show ?? `title:${event.title}`;
      if (!shows.has(key)) shows.set(key, { title: event.title, show: event.show ?? null, firstAt: at, lastAt: at, viewers: /* @__PURE__ */ new Set(), finished: /* @__PURE__ */ new Map(), stopped: /* @__PURE__ */ new Map(), episodes: 0 });
      const entry = shows.get(key);
      entry.lastAt = at;
      entry.title = event.title;
      for (const viewer of event.viewers ?? (event.viewer ? [event.viewer] : [])) entry.viewers.add(viewer);
      if (Number.isInteger(event.episode?.of)) entry.episodes = Math.max(entry.episodes, event.episode.of);
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
      episodes: entry.episodes || null,
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
  const episodeOf = (room, index) => ({ index, title: room.items[index]?.title ?? "", of: room.items.length });
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
      log.append("room.opened", { ...base(room), by: room.createdBy || null });
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
import { mkdir as mkdir9, readFile as readFile10, readdir as readdir7, rename as rename7, rm as rm8, stat as stat9, statfs, writeFile as writeFile6 } from "node:fs/promises";
import { basename as basename5, dirname as dirname5, extname as extname7, join as join15, resolve as resolve4 } from "node:path";

// src/presence.js
var RATINGS = Object.freeze(["loved", "fine", "not-for-me", "unfinished"]);
var RATE_WITHIN_DAYS = 14;
var MAX_PENDING = 3;
var MAX_RECAP_CHARS = 1200;
var MAX_STEPS = 3;
var STEP_ID = /^[a-z0-9][a-z0-9_-]{0,31}$/;
var MAX_LABEL_CHARS = 120;
var MAX_PROMPT_CHARS = 2e3;
var PICKS_LIMIT = 6;
var PICKS_TIMEOUT_MS = 6e4;
var MAX_WHY_CHARS = 280;
var badInput = (message) => Object.assign(new Error(message), { code: "invalid_arguments" });
function pendingRatings({ shows, events, person, now, days = RATE_WITHIN_DAYS, limit = MAX_PENDING }) {
  const since = now - days * 864e5;
  const rated = new Set(events.filter((event) => event.type === "rating" && event.person === person).map((event) => event.show));
  const asks = /* @__PURE__ */ new Map();
  const offer = (show, title, why, at) => {
    if (typeof show !== "string" || rated.has(show) || !(at >= since) || !(at <= now)) return;
    const known2 = asks.get(show);
    if (known2 === void 0 || known2.at < at) asks.set(show, { show, title, why, at });
  };
  for (const show of shows) if (show.watchedAt) offer(show.path, show.work?.title ?? show.name, "finished", show.watchedAt);
  for (const event of events) if (event.type === "library.deleted") offer(event.show, event.title, "removed", Date.parse(event.at));
  const present = new Set(shows.map((show) => show.path));
  return [...asks.values()].filter((ask) => ask.why === "finished" || !present.has(ask.show)).sort((a, b) => b.at - a.at).slice(0, limit);
}
function ratingLine({ show, title, rating }, person) {
  if (!RATINGS.includes(rating)) throw badInput(`rating must be one of ${RATINGS.join(", ")}`);
  if (typeof show !== "string" || show === "") throw badInput("rating needs the show");
  return { show, title: typeof title === "string" ? title.slice(0, 200) : "", rating, person: person.key, by: person.name };
}
var textOrPerLanguage = (value, max) => {
  if (typeof value === "string" && value.trim() !== "") return value.trim().slice(0, max);
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value).filter(([tag, text3]) => /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(tag) && typeof text3 === "string" && text3.trim() !== "");
    if (entries.length > 0) return Object.fromEntries(entries.map(([tag, text3]) => [tag, text3.trim().slice(0, max)]));
  }
  return null;
};
function parseAnnotation({ recap, steps } = {}) {
  const out = {};
  if (recap === null) out.recap = null;
  else if (recap !== void 0) {
    if (typeof recap?.text !== "string" || recap.text.trim() === "") throw badInput("recap needs text");
    if (!Number.isInteger(recap.upTo) || recap.upTo < 1) throw badInput("recap needs upTo, the last episode it covers (1 or more)");
    out.recap = { text: recap.text.trim().slice(0, MAX_RECAP_CHARS), upTo: recap.upTo };
  }
  if (steps === null) out.steps = null;
  else if (steps !== void 0) {
    if (!Array.isArray(steps) || steps.length > MAX_STEPS) throw badInput(`steps is a list of at most ${MAX_STEPS}`);
    out.steps = steps.map((step, n) => {
      const id = step?.id ?? `step-${n + 1}`;
      if (typeof id !== "string" || !STEP_ID.test(id)) throw badInput("a step id is lowercase letters, digits, - and _");
      const label = textOrPerLanguage(step?.label, MAX_LABEL_CHARS);
      if (label === null) throw badInput("a step needs a label that says the step");
      const prompt = textOrPerLanguage(step?.prompt, MAX_PROMPT_CHARS);
      return { kind: "step", id, label, ...prompt === null ? {} : { payload: { prompt } } };
    });
    if (new Set(out.steps.map((step) => step.id)).size !== out.steps.length) throw badInput("step ids repeat");
    if (out.steps.length === 0) out.steps = null;
  }
  return out;
}
var safeRecap = (recap, through) => recap && recap.upTo <= through ? recap : null;
function parsePicks(document2, hasSource, limit = PICKS_LIMIT) {
  if (!Array.isArray(document2?.picks)) throw new Error("the recommender answered without a picks list");
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const pick5 of document2.picks) {
    const work = pick5?.work;
    const why = typeof pick5?.why === "string" ? pick5.why.trim().slice(0, MAX_WHY_CHARS) : "";
    if (typeof work?.source !== "string" || !hasSource(work.source) || typeof work.id !== "string" || work.id === "" || typeof work.title !== "string" || why === "") continue;
    const key = `${work.source}\0${work.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      work: {
        source: work.source,
        id: work.id,
        title: work.title.slice(0, 200),
        kind: typeof work.kind === "string" ? work.kind : null,
        year: Number.isInteger(work.year) ? work.year : null,
        score: Number.isFinite(work.score) ? work.score : null,
        scoreLabel: typeof work.scoreLabel === "string" ? work.scoreLabel.slice(0, 40) : "",
        cover: typeof work.cover === "string" ? work.cover : null,
        url: typeof work.url === "string" ? work.url : null
      },
      why
    });
    if (out.length >= limit) break;
  }
  return out;
}
function createPicks({ command, env = {}, cwd, hasSource, decorate, logger, now = Date.now, refreshMs = 6 * 36e5 }) {
  const cached = /* @__PURE__ */ new Map();
  async function ask(person) {
    const argv = [...command, "recommend", "--json", "--limit", String(PICKS_LIMIT), ...person.id ? ["--person", person.id] : []];
    const result = await run(argv, { timeoutMs: PICKS_TIMEOUT_MS, cwd, env });
    if (result.code !== 0) throw new Error(`exit ${result.code}: ${result.stderr.trim().split("\n").pop() ?? ""}`);
    return parsePicks(JSON.parse(result.stdout), hasSource).map(decorate);
  }
  return {
    enabled: command.length > 0,
    /** @param {{ key: string, id: string }} person */
    async list(person) {
      if (command.length === 0) return [];
      const entry = cached.get(person.key);
      if (entry && now() - entry.at < refreshMs) return entry.picks;
      const picks = await ask(person).catch((error) => {
        logger.warn("the recommender gave no picks: %s", error.message);
        return [];
      });
      cached.set(person.key, { at: now(), picks });
      return picks;
    }
  };
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
  const { roots, stateDir, covers, inUse, download, forget, logger, now = Date.now } = options;
  const metaFile = join15(stateDir, "shows.json");
  const cacheDir = join15(stateDir, "cache");
  let meta = {};
  let saving = Promise.resolve();
  const listeners = /* @__PURE__ */ new Set();
  const changed = (show) => {
    for (const listener of listeners) listener(show);
  };
  async function load() {
    try {
      meta = JSON.parse(await readFile10(metaFile, "utf8")).shows ?? {};
    } catch (error) {
      if (error.code !== "ENOENT") logger.warn("could not read %s: %s", metaFile, error.message);
    }
  }
  function save() {
    const body2 = JSON.stringify({ shows: meta }, null, 1);
    saving = saving.then(async () => {
      await writeFile6(`${metaFile}.part`, body2);
      await rename7(`${metaFile}.part`, metaFile);
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
    return roots.includes(dirname5(target)) && !basename5(target).startsWith(".") ? target : null;
  }
  function requireShow(path) {
    const target = showPath(path);
    if (target === null) throw libraryError("not_found", "not a show in the library");
    return target;
  }
  function showOf(episodePath) {
    if (typeof episodePath !== "string") return null;
    return showPath(episodePath) ?? showPath(dirname5(episodePath));
  }
  async function episodeFiles(path) {
    const info = await stat9(path).catch(() => null);
    if (info === null) return null;
    if (info.isFile()) return isMedia(basename5(path)) ? [{ name: basename5(path), size: info.size, mtimeMs: info.mtimeMs }] : null;
    const files = [];
    for (const name2 of naturalSort(await readdir7(path).catch(() => []))) {
      if (!isMedia(name2)) continue;
      const file = await stat9(join15(path, name2)).catch(() => null);
      if (file?.isFile()) files.push({ name: name2, size: file.size, mtimeMs: file.mtimeMs });
    }
    return files;
  }
  async function deleteEpisode(target, name2) {
    await dropPrepared(cacheDir, join15(target, name2));
    await rm8(join15(target, name2), { force: true });
    for (const sub of matchSubtitles(name2, await readdir7(target).catch(() => []))) await rm8(join15(target, sub.name), { force: true });
    await forgetSum(target, name2);
  }
  async function folderBytes(path) {
    const info = await stat9(path).catch(() => null);
    if (info === null) return 0;
    if (info.isFile()) return info.size;
    let total = 0;
    for (const name2 of await readdir7(path).catch(() => [])) total += (await stat9(join15(path, name2)).catch(() => null))?.size ?? 0;
    return total;
  }
  async function forgetSum(show, file) {
    const sums = join15(show, SUMS);
    const text3 = await readFile10(sums, "utf8").catch(() => null);
    if (text3 !== null) await writeFile6(sums, text3.split("\n").filter((line) => !line.endsWith(`  ${file}`) && !line.endsWith(` *${file}`)).join("\n"));
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
    return Object.entries(entry.stops ?? {}).filter(([, stop]) => indexOf(stop.file) >= 0 && (shared === void 0 || stop.file !== shared.file || Math.abs(stop.position - shared.position) > STOP_DIFF_S)).map(([viewer, stop]) => ({ viewer, index: indexOf(stop.file), title: titleOf(stop.file), position: stop.position }));
  }
  function resumeFrom(path, slots) {
    const entry = record(path);
    const resume2 = entry.resume;
    if (!resume2) return null;
    const index = slots.findIndex((slot) => slot.key === keyOf(entry, resume2.file));
    if (index < 0) return null;
    if (isNearEnd(resume2.position, resume2.duration)) {
      return index + 1 < slots.length ? { index: index + 1, position: 0, title: slots[index + 1].title ?? "" } : null;
    }
    return resume2.position > 5 || index > 0 ? { index, position: resume2.position, title: slots[index].title ?? titleOf(resume2.file) } : null;
  }
  function focusOf(path, slots) {
    const entry = record(path);
    const resume2 = entry.resume;
    if (!resume2) return 1;
    const index = slots.findIndex((slot) => slot.key === keyOf(entry, resume2.file));
    if (index < 0) return 1;
    if (isNearEnd(resume2.position, resume2.duration)) return index + 1 < slots.length ? slots[index + 1].n : null;
    return slots[index].n;
  }
  const liveOr = (live, path, entry) => live && options.liveWork ? options.liveWork(path, entry) : Promise.resolve(entry.work ?? null);
  async function describe(path, live = false) {
    const info = await stat9(path).catch(() => null);
    if (info === null) return null;
    const files = await episodeFiles(path);
    const state = download(path);
    if ((files === null || files.length === 0) && state === null && !isSourced(record(path))) return null;
    const names = (files ?? []).map((file) => file.name);
    const entry = { ...record(path), work: await liveOr(live, path, record(path)) };
    const slots = slotsOf(entry, files ?? []);
    if (names.length === 0 && state === null && !isSourced(entry)) return null;
    const resume2 = resumeFrom(path, slots);
    const finished = slots.filter((slot) => (entry.finished ?? []).some((name2) => keyOf(entry, name2) === slot.key)).length;
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
      frame: files === null || files.length === 0 ? null : await covers.ofFrame(info.isFile() ? path : join15(path, files[0].name)),
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
      resume: resume2,
      finished,
      // Written from outside (src/presence.js); the recap only once the viewers are past what it covers.
      recap: safeRecap(entry.recap ?? null, resume2 ? resume2.index : finished),
      steps: entry.steps ?? null,
      stepsStarted: entry.stepsStarted ?? {},
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
    /** Every show, newest first, with totals and the free space of the download folder's disk. `live` has each sourced show's work asked of its source (see `options.liveWork`). */
    async list({ live = false } = {}) {
      const paths = [];
      for (const root of roots) {
        for (const name2 of await readdir7(root).catch(() => [])) if (!name2.startsWith(".")) paths.push(join15(root, name2));
      }
      const shows = (await Promise.all(paths.map((path) => describe(path, live)))).filter((show) => show !== null);
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
      const entry = { ...record(target), work: await liveOr(true, target, record(target)) };
      const slots = slotsOf(entry, await episodeFiles(target) ?? []);
      return slots.map((slot) => ({
        n: slot.n,
        name: slot.file?.name ?? null,
        title: slot.title,
        size: slot.file?.size ?? 0,
        cached: slot.file !== null,
        watch: watchOfItem(target, { slot: isSourced(record(target)) ? slot.n : void 0, sourcePath: slot.file ? join15(target, slot.file.name) : null })
      }));
    },
    /**
     * The episodes of a sourced show for a room: one per number, with the file and the subtitles beside it when it is on disk. Null for a show without a source.
     * @returns {Promise<{ n: number, title: string | null, path: string | null, subtitles: { path: string, label: string }[] }[] | null>}
     */
    async directory(path) {
      const target = showPath(path);
      if (target === null || !isSourced(record(target))) return null;
      const names = await readdir7(target).catch(() => []);
      return slotsOf(record(target), await episodeFiles(target) ?? []).map((slot) => ({
        n: slot.n,
        title: slot.title,
        path: slot.file ? join15(target, slot.file.name) : null,
        subtitles: slot.file ? matchSubtitles(slot.file.name, names).map((sub) => ({ path: join15(target, sub.name), label: sub.label })) : []
      }));
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
          out.push({ key: `${path}\0${n}`, show: path, n, bytes: file.size + await preparedBytes(cacheDir, join15(path, file.name)), lastAt: Math.max(watchedAt, file.mtimeMs) });
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
        await deleteEpisode(target, file.name);
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
    /** Followed shows with when they were last checked and are next due. */
    follows: () => Object.entries(meta).filter(([, entry]) => entry.follow && isSourced(entry)).map(([path, entry]) => ({ path, follow: entry.follow, source: entry.source, group: entry.group ?? null })),
    /** Follow a show, or stop (null). `follow` is `{ since, seen, checkedAt, nextAt }`. */
    setFollow(path, follow2) {
      update(path, { follow: follow2 });
      changed(path);
    },
    /** What a check found: a new season (on the new show) or more episodes (on this one); cleared when someone looks. */
    mark: (path, patch) => update(path, patch),
    /** Keep what the outside writes about a show (src/presence.js parseAnnotation); new steps start unpressed. */
    annotate(path, annotation) {
      const target = requireShow(path);
      update(target, { ...annotation, ...annotation.steps !== void 0 ? { stepsStarted: {} } : {} });
      return target;
    },
    /** A suggested step was started; returns false for a step the show doesn't have. */
    stepStarted(path, id) {
      const target = requireShow(path);
      const entry = record(target);
      if (!(entry.steps ?? []).some((step) => step.id === id)) return false;
      update(target, { stepsStarted: { ...entry.stepsStarted, [id]: now() } });
      return true;
    },
    dismiss: (path) => update(requireShow(path), { newSeason: null, newEpisodes: null }),
    /** More episodes in a show's work than it had: its total grows, the rolling cache takes it from there. */
    setEpisodes(path, episodes) {
      const entry = record(path);
      update(path, { source: { ...entry.source, episodes } });
      changed(path);
    },
    /** The saved (offline fallback) copy of a show's work, or null. */
    workOf: (path) => record(path).work ?? null,
    /** Which source and work id a show came from (`{ source, id, ... }`), or null. */
    workSource: (path) => path === null || path === void 0 ? null : record(path).source ?? null,
    /** The saved copy of a work, refreshed from its source: an offline fallback only, and no change of the show. */
    keepWork(path, work) {
      if (meta[path]) update(path, { work });
    },
    setWork(path, work) {
      update(path, { work });
    },
    /** Note a show coming from a source, before its files arrive. */
    async adopt(path, source, { pinned = false } = {}) {
      await mkdir9(path, { recursive: true });
      update(path, { source, addedAt: record(path).addedAt ?? now(), ...pinned ? { pinned: true } : {} });
    },
    async remove(path, { by = null, reason = "by hand" } = {}) {
      const target = requireShow(path);
      if (inUse(target)) throw libraryError("in_use", "a room is playing this show; close the room first");
      await forget(target);
      await rm8(target, { recursive: true, force: true });
      delete meta[target];
      await save();
      note("library.deleted", target, { by, reason });
      return { removed: target };
    },
    async removeEpisode(path, name2, { by = null } = {}) {
      const target = requireShow(path);
      if ((await stat9(target)).isFile()) return this.remove(target, { by });
      if (inUse(target)) throw libraryError("in_use", "a room is playing this show; close the room first");
      const file = cleanName(name2);
      if (!isMedia(file)) throw libraryError("invalid", "not an episode");
      await deleteEpisode(target, file);
      note("library.episodeDeleted", target, { episode: titleOf(file), by });
      const entry = record(target);
      if (isSourced(entry) && episodeNumber(file) !== null) update(target, { skip: [.../* @__PURE__ */ new Set([...entry.skip ?? [], episodeNumber(file)])] });
      const left = await episodeFiles(target);
      if (!isSourced(entry) && left !== null && left.length === 0 && download(target) === null) return this.remove(target, { by });
      return { removed: join15(target, file) };
    },
    async rename(path, name2, { by = null } = {}) {
      const target = requireShow(path);
      if (inUse(target)) throw libraryError("in_use", "a room is playing this show; close the room first");
      if (download(target)?.active) throw libraryError("in_use", "this show is still downloading");
      const isFile = (await stat9(target)).isFile();
      const clean = cleanName(name2);
      const next = join15(dirname5(target), isFile && extname7(clean) === "" ? `${clean}${extname7(target)}` : clean);
      if (next === target) return { path: target };
      if (await stat9(next).then(() => true, () => false)) throw libraryError("exists", "a show with that name is already in the library");
      await rename7(target, next);
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
        if (!await stat9(path).then(() => true, () => false)) {
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
  return follows.filter(({ follow: follow2 }) => (follow2.nextAt ?? 0) <= now).sort((a, b) => (a.follow.nextAt ?? 0) - (b.follow.nextAt ?? 0));
}
var seenAtStart = (id, work) => [.../* @__PURE__ */ new Set([id, ...(work?.related ?? []).map((other) => other.id)])];
var newSeasons = (info, seen) => (info.related ?? []).filter((other) => other.relation === "season" && other.id !== info.id && !seen.includes(other.id));
function createFollows({ library, source, refreshed, addSeason, record, notify, logger, now = Date.now, random = Math.random, pauseMs = 3e4, tickMs = 6e5 }) {
  let timer = null;
  let busy = false;
  const sleep2 = (ms) => new Promise((done) => setTimeout(done, ms));
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
        await sleep2(pauseMs);
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

// src/live-work.js
var DAY_MS3 = 864e5;
var sameAs = (saved, work, at) => saved != null && at - saved.at < DAY_MS3 && JSON.stringify({ ...saved, at: 0 }) === JSON.stringify({ ...work, at: 0 });
function createLiveWork({ source, keep, waitMs = 8e3, parallel = 4, now = Date.now, logger }) {
  const flying = /* @__PURE__ */ new Map();
  const queue = [];
  let running = 0;
  function turn() {
    while (running < parallel && queue.length > 0) {
      running += 1;
      queue.shift()();
    }
  }
  const limited = (task) => new Promise((resolve7, reject) => {
    queue.push(() => task().then(resolve7, reject).finally(() => {
      running -= 1;
      turn();
    }));
    turn();
  });
  function ask(path, entry) {
    const { source: sourceId, id } = entry.source;
    const key = `${sourceId}
${id}`;
    if (!flying.has(key)) {
      const request = limited(() => source(sourceId).info(id, { person: entry.source.person })).then((info) => {
        const work = snapshotOf(info, now());
        if (!sameAs(entry.work, work, now())) keep(path, work);
        return work;
      }).finally(() => flying.delete(key));
      request.catch(() => {
      });
      flying.set(key, request);
    }
    return flying.get(key);
  }
  const offline = (entry) => entry.work ? { ...entry.work, offline: true } : null;
  return async function read(path, entry) {
    const found = entry.source?.source ? source(entry.source.source) : void 0;
    if (found === void 0) return entry.work ?? null;
    let timer;
    const late = new Promise((resolve7) => {
      timer = setTimeout(() => resolve7(null), waitMs);
    });
    try {
      return await Promise.race([ask(path, entry), late]) ?? offline(entry);
    } catch (error) {
      logger.warn("no live details for %s from %s: %s", path, entry.source.source, error.message);
      return offline(entry);
    } finally {
      clearTimeout(timer);
    }
  };
}

// src/media.js
var HOUR_MS = 36e5;
var MIN_FREE_BYTES = 1e9;
var NO_CONVERTER = Object.freeze({ command: "", available: async () => false });
var hubError = (code, message) => Object.assign(new Error(message), { code });
function createMediaHub(options) {
  const { stateDir, libraryRoots, logger, now = Date.now } = options;
  const sources = new Map(options.sources.map((source2) => [source2.id, source2]));
  const covers = createCovers({ dir: join16(stateDir, "covers"), capBytes: options.coverCacheBytes, ffmpeg: options.tools.ffmpeg, logger }, (id) => sources.get(id));
  const log = createWatchLog({ file: join16(stateDir, LOG_NAME), now, logger });
  const books = createBooks({ dir: join16(stateDir, "books"), sources, capBytes: options.books?.capBytes ?? 0, converter: options.books?.converter ?? NO_CONVERTER, covers, logger, now });
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
    onProgress: (job, number, progress) => rooms.downloadProgress(job.dir, number, progress),
    onPartial: (job, number, partial) => rooms.streamEpisode(job.dir, number, partial),
    logger,
    now
  });
  const liveWork = createLiveWork({ source: (id) => sources.get(id), keep: (path, work) => library.keepWork(path, work), waitMs: options.liveWorkWaitMs, logger, now });
  const library = createLibrary({
    liveWork,
    roots: libraryRoots,
    stateDir,
    autoDeleteDays: options.autoDeleteDays,
    covers,
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
  const picks = createPicks({
    command: options.recommender?.command ?? [],
    env: options.recommender?.env ?? {},
    cwd: stateDir,
    hasSource: (id) => sources.has(id),
    decorate: (pick5) => ({ ...pick5, work: covers.decorate(pick5.work.source, pick5.work) }),
    logger,
    now
  });
  const sweepTimer = setInterval(() => {
    library.sweep().catch(() => {
    });
    cache.enforce().catch(() => {
    });
  }, HOUR_MS);
  async function onFiles(job) {
    await rooms.syncShow(job.dir);
    if (job.status === "failed") rooms.failWaiting(job.dir, job.error ?? "the download failed", job.reason ?? null);
    await cache.enforce();
  }
  function notify(event) {
    const [command, ...args] = options.notifyCommand ?? [];
    if (command === void 0) return;
    try {
      const child = spawn5(command, args, { stdio: ["pipe", "ignore", "ignore"] });
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
  const liveEntry = async (show) => {
    const entry = { source: library.workSource(show), work: library.workOf(show) };
    return { ...entry, work: await liveWork(show, entry) };
  };
  const withCovers = (show) => show.work && show.source?.source ? { ...show, work: covers.decorate(show.source.source, show.work) } : show;
  function source(id) {
    const found = sources.get(id);
    if (found === void 0) throw hubError("not_found", `no source ${String(id)}`);
    return found;
  }
  async function folderFor(sourceId, item) {
    const name2 = cleanName(item.title);
    const mark = createHash6("sha256").update(`${sourceId}
${item.id}`).digest("hex").slice(0, 8);
    for (const candidate of [name2, `${name2} (${mark})`]) {
      const path = join16(libraryRoots[0], candidate);
      const exists2 = await stat10(path).then(() => true, () => false);
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
      follows.start();
    },
    // ---------------------------------------------------------- rooms
    /**
     * Open a room. A library show continues where its viewers stopped unless
     * `start` says otherwise.
     */
    async createRoom(input) {
      let start = input.start ?? null;
      if (start === null && typeof input.path === "string") {
        const show2 = library.showPath(input.path);
        if (show2 !== null) start = await library.resumeFrom(show2);
      }
      if (typeof input.path === "string") follows.opened(library.showPath(input.path));
      const show = typeof input.path === "string" ? library.showPath(input.path) : null;
      const from2 = show === null ? null : library.workSource(show);
      if (from2 && typeof input.person === "string" && from2.person !== input.person) library.mark(show, { source: { ...from2, person: input.person } });
      return rooms.createRoom({ ...input, start });
    },
    watchTogether: (id) => rooms.watchTogether(id),
    waitReady: (...args) => rooms.waitReady(...args),
    room: (id) => rooms.room(id),
    /** Open rooms with a preview of what plays: the show's cover and a frame of the episode now on. */
    async listRooms() {
      return Promise.all(rooms.listRooms().map(async ({ file, ...room }) => {
        const show = room.show === null ? null : withCovers(await liveEntry(room.show));
        return { ...room, cover: show?.work?.cover ?? null, frame: file === null ? null : await covers.ofFrame(file, room.duration > 30 ? Math.round(room.duration / 10) : 3) };
      }));
    },
    closeRoom: (id) => rooms.closeRoom(id),
    attach: (ws, id) => rooms.attach(ws, id),
    mediaFile: (...args) => rooms.mediaFile(...args),
    subtitleFile: (...args) => rooms.subtitleFile(...args),
    linkFor: (id) => rooms.linkFor(id),
    sweep: () => rooms.sweep(),
    pruneCache: (days) => rooms.pruneCache(days),
    // ---------------------------------------------------------- presence (src/presence.js)
    /** Finished or removed shows this person hasn't said how they found. */
    async pendingRatings(person) {
      const [list, events] = await Promise.all([library.list(), log.read()]);
      return pendingRatings({ shows: list.shows, events, person: person.key, now: now() });
    },
    async rate(input, person) {
      await log.append("rating", ratingLine(input, person));
      return { ok: true };
    },
    picks: (person) => picks.list(person),
    /** Keep a recap or suggested steps with a show (the tool's annotate). */
    annotate(path, input) {
      const show = library.annotate(path, parseAnnotation(input));
      return { ok: true, show };
    },
    async startStep(path, id, person) {
      const show = library.showPath(path);
      if (show === null || !library.stepStarted(show, id)) throw hubError("not_found", "no such step");
      await log.append("step.started", { show, title: library.workOf(show)?.title ?? "", step: id, person: person.key, by: person.name });
      return { ok: true };
    },
    // ---------------------------------------------------------- library
    async library() {
      const list = await library.list({ live: true });
      return { ...list, shows: list.shows.map(withCovers) };
    },
    /** The details of the work a room's show came from, or null. */
    async roomWork(id) {
      const room = rooms.listRooms().find((entry) => entry.id === id);
      if (room === void 0) throw hubError("not_found", "no such room");
      return { work: room.show === null ? null : withCovers(await liveEntry(room.show)).work ?? null, source: library.workSource(room.show)?.source ?? null, id: library.workSource(room.show)?.id ?? null };
    },
    episodes: (path) => library.episodes(path),
    removeShow: (path, by) => library.remove(path, { by }),
    removeEpisode: (path, name2, by) => library.removeEpisode(path, name2, { by }),
    renameShow: (path, name2, by) => library.rename(path, name2, { by }),
    keepShow: (path, by) => library.keep(path, { by }),
    countdownShow: (path, by) => library.countdown(path, { by }),
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
        if (typeof one.search === "function" && one.kinds.some((entry) => entry.id === kind) && await one.available()) candidates.push(one);
      }
      const answers = await Promise.allSettled(candidates.map((one) => ask(one)));
      const failed = answers.flatMap((answer, index) => answer.status === "rejected" ? [{ source: candidates[index].id, message: answer.reason?.message ?? String(answer.reason) }] : []);
      if (candidates.length > 0 && failed.length === candidates.length) throw hubError("source_failed", failed.map((entry) => entry.message).join("; "));
      return { results: interleave(answers.map((answer) => answer.status === "fulfilled" ? answer.value.results : [])), next: null, failed };
    },
    /** A work's details; `person` and `language` say who asks (their account for its site) and in which language (subtitles). */
    info: async (sourceId, id, asking = {}) => ({ ...covers.decorate(sourceId, await source(sourceId).info(id, asking)), source: sourceId }),
    coverFile: (key) => covers.file(key),
    /**
     * Put a work from a source into the library. `watch` opens a room on it
     * at once, for the asker alone unless `together` (its episode shows as preparing until it is fetched); either
     * way only the rolling cache's window is downloaded, unless `all` keeps
     * the whole show offline. The show keeps how its episodes are fetched: the `quality` a source offers a choice of (Link),
     * whose account (`person`, the one asking) and the viewer's `language`, for the captions chosen with each episode.
     * @param {{ source: string, id: string, watch?: boolean, all?: boolean, quality?: string, by?: string, person?: string, language?: string }} input
     */
    async fetch({ source: sourceId, id, watch = false, together = false, all = false, quality = "", by = "", person = "", language = "" }) {
      const item = await source(sourceId).info(id, { person, language });
      if (!(item.episodes > 0)) throw hubError("empty", `${item.title || id} has no episodes`);
      const disk = await statfs2(libraryRoots[0]).catch(() => null);
      if (disk !== null && disk.bavail * disk.bsize < MIN_FREE_BYTES) throw hubError("no_space", "the library disk is almost full; delete something first");
      const dir = await folderFor(sourceId, item);
      const how = { ...isQuality(quality) ? { quality } : {}, person, language };
      await library.adopt(dir, { source: sourceId, id: item.id, kind: item.kind, episodes: item.episodes, title: item.title, ...how }, { pinned: all });
      library.setWork(dir, snapshotOf(item, now()));
      let room = null;
      if (watch) room = (await rooms.createRoom({ source: "local", path: dir, title: item.title, by, person, together, start: await library.resumeFrom(dir) })).room;
      else await cache.refresh(dir, { retry: true });
      const count = all ? item.episodes : Math.min(item.episodes, options.cache.ahead + 1);
      return { path: dir, title: item.title, episodes: item.episodes, estimate: count * (EPISODE_BYTES[item.kind] ?? EPISODE_BYTES.drama), room, download: downloads.state(dir) };
    },
    /**
     * Follow a work, or stop following it. A work not in the library is added as an empty show; the host then looks for its
     * next season (and more episodes) now and then, and adds a new season by itself.
     */
    async followWork({ source: sourceId, id, follow: follow2 = true }) {
      const found = (await library.list()).shows.find((show) => show.source?.source === sourceId && show.source.id === id);
      if (!follow2) {
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
    /** The checks of followed works, for tests and for the assistant: one show now, or whatever is due. */
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
      follows.stop();
      await books.dispose();
      await downloads.dispose();
      await rooms.dispose();
      await covers.settle();
      await library.flush();
      await log.flush();
    }
  };
}

// src/people.js
import { createHash as createHash7 } from "node:crypto";
var OWNER = "owner";
function personOf(identityService) {
  const identity = typeof identityService?.current === "function" ? identityService.current() : null;
  if (identity === null || typeof identity?.id !== "string" || identity.id === "") return { key: OWNER, id: "", name: "", verified: false };
  const key = createHash7("sha256").update(`${identity.issuer ?? ""}
${identity.id}`).digest("hex").slice(0, 20);
  return { key, id: identity.id, name: typeof identity.name === "string" ? identity.name.slice(0, 80) : "", verified: true };
}

// src/person-routes.js
var PERSON_PATH = "/api/media-hub";
var HEADERS = Object.freeze({ "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" });
var json = (status, body2) => new Response(JSON.stringify(body2), { status, headers: { ...HEADERS, "content-type": "application/json; charset=utf-8" } });
var failure2 = (error) => json(error?.status ?? STATUS[error?.code] ?? 500, errorBody(error));
async function body(request) {
  try {
    const value = await request.json();
    return value !== null && typeof value === "object" ? value : {};
  } catch {
    throw Object.assign(new Error("request body is not JSON"), { status: 400 });
  }
}
var pick4 = (value, keys) => Object.fromEntries(keys.filter((key) => value?.[key] !== void 0).map((key) => [key, value[key]]));
var text2 = (value) => typeof value === "string" ? value : "";
function createPersonRoutes({ hub, identity }) {
  const handle = (fn) => async (request) => {
    const current = hub();
    if (current === void 0) return json(503, { error: { code: "unavailable", message: "The media hub is starting." } });
    try {
      return json(200, await fn(request, current, personOf(identity())));
    } catch (error) {
      return failure2(error);
    }
  };
  const param = (request, name2) => new URL(request.url).searchParams.get(name2) ?? "";
  return [
    {
      path: `${PERSON_PATH}/info`,
      methods: ["GET"],
      requestBody: "buffered",
      fetch: handle((request, current, person) => current.info(param(request, "source"), param(request, "id"), { person: person.id, language: param(request, "language") }))
    },
    {
      path: `${PERSON_PATH}/fetch`,
      methods: ["POST"],
      requestBody: "buffered",
      fetch: handle(async (request, current, person) => {
        const input = await body(request);
        return current.fetch({ ...pick4(input, ["source", "id", "watch", "together", "all", "quality", "by"]), language: text2(input.language), person: person.id });
      })
    },
    {
      path: `${PERSON_PATH}/rooms`,
      methods: ["POST"],
      requestBody: "buffered",
      fetch: handle(async (request, current, person) => current.createRoom({ ...pick4(await body(request), ["path", "title", "by", "start"]), fromPanel: true, person: person.id }))
    },
    {
      path: `${PERSON_PATH}/ratings`,
      methods: ["GET", "POST"],
      requestBody: "buffered",
      fetch: handle(async (request, current, person) => request.method === "GET" ? { pending: await current.pendingRatings(person) } : current.rate(await body(request), person))
    },
    {
      path: `${PERSON_PATH}/picks`,
      methods: ["GET"],
      requestBody: "buffered",
      fetch: handle(async (request, current, person) => ({ picks: await current.picks(person) }))
    },
    {
      path: `${PERSON_PATH}/steps`,
      methods: ["POST"],
      requestBody: "buffered",
      fetch: handle(async (request, current, person) => {
        const input = await body(request);
        return current.startStep(text2(input.path), text2(input.id), person);
      })
    }
  ];
}

// src/shelf-routes.js
import { createReadStream as createReadStream3 } from "node:fs";
import { stat as stat11 } from "node:fs/promises";
import { Readable as Readable2 } from "node:stream";
var SHELF_PATH = "/api/media-hub/shelf";
async function fileResponse(request, { path, name: name2, type }) {
  const info = await stat11(path).catch(() => null);
  if (info === null || !info.isFile()) return json(404, { error: { code: "not_found", message: "the file is gone" } });
  const range = resolveRange(request.headers.get("range"), info.size);
  const headers = { ...HEADERS, "content-type": type, "content-disposition": attachment(name2), "accept-ranges": "bytes" };
  if (range.kind === "unsatisfiable") return new Response(null, { status: 416, headers: { ...headers, "content-range": `bytes */${info.size}` } });
  const start = range.kind === "window" ? range.start : 0;
  const end = range.kind === "window" ? range.end : info.size - 1;
  headers["content-length"] = String(info.size === 0 ? 0 : end - start + 1);
  if (range.kind === "window") headers["content-range"] = `bytes ${start}-${end}/${info.size}`;
  const stream = request.method === "HEAD" || info.size === 0 ? null : Readable2.toWeb(createReadStream3(path, { start, end }));
  return new Response(stream, { status: range.kind === "window" ? 206 : 200, headers });
}
function createShelfRoutes({ books, identity }) {
  const handle = (fn) => async (request) => {
    const shelves = books();
    if (shelves === void 0) return json(503, { error: { code: "unavailable", message: "The shelf is starting." } });
    try {
      return await fn(request, shelves, personOf(identity()));
    } catch (error) {
      return failure2(error);
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
var DAY_MS4 = 864e5;
function apply(ctx, config) {
  const logger = ctx.logger("media-hub");
  let current;
  ctx.provide?.("mediaHub", Object.freeze({ service: () => current }));
  ctx.effect(() => {
    const stateDir = resolve6(config.stateDir);
    const service = createMediaHub({
      stateDir,
      libraryRoots: [join17(stateDir, "library"), ...config.libraryRoots.map((root) => resolve6(root))],
      delivery: createDelivery({ mode: config.delivery }),
      tools: { ffmpeg: config.ffmpeg, ffprobe: config.ffprobe, maxHeight: config.maxHeight, threads: config.threads },
      webUrl: () => ctx.get("webApp")?.getAdvertisedUrl(),
      lifetime: { emptyMinutes: config.emptyMinutes, unopenedHours: config.unopenedHours },
      autoDeleteDays: config.autoDeleteDays,
      sources: createSources(config.sources, { stateDir, logger, link: { ytDlp: config.ytDlp, ffmpeg: config.ffmpeg, proxies: createProxies(config.proxies), cookies: createCookies(config.cookies), maxHeight: config.maxHeight } }),
      coverCacheBytes: config.coverCacheMb * 1e6,
      books: {
        capBytes: config.bookCacheGb * 1e9,
        converter: { command: config.converter, available: () => config.converter === "" ? Promise.resolve(false) : commandExists(config.converter) }
      },
      notifyCommand: config.notifyCommand,
      recommender: config.recommender,
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
    }, DAY_MS4);
    const identity = () => ctx.get("requestIdentity");
    const fetchRoutes = [
      ...createShelfRoutes({ books: () => current?.books, identity }),
      ...createPersonRoutes({ hub: () => current, identity })
    ].map((route) => ctx.connection.fetch.register(route));
    const sockets = new import_websocket_server.default({ noServer: true, maxPayload: 16 * 1024, perMessageDeflate: false });
    const disposeHttp = ctx.webServer.register({
      kind: "prefix",
      path: ROUTE,
      handler: createHandler({ connection: ctx.connection, service: () => current, settings: () => ({ label: config.label, presence: config.presence }), logger })
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
      await Promise.all(fetchRoutes.map((dispose) => dispose()));
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
