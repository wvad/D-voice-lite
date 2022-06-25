"use strict";
/* eslint-disable */
const { randomBytes: c, createHash: d } = require("node:crypto"),
  e = require("node:crypto").randomFillSync,
  EventEmitter = require("node:events"),
  f = require("node:stream").Writable,
  https = require("node:https"),
  g = require("node:url").URL,
  http = require("node:http"),
  zlib = require("node:zlib"),
  net = require("node:net"),
  tls = require("node:tls"),
  BINARY_TYPES = ["nodebuffer", "arraybuffer", "fragments"],
  EMPTY_BUFFER = Buffer.alloc(0),
  kForOnEventAttribute = Symbol("kIsForOnEventAttribute"),
  kListener = Symbol("kListener"),
  kStatusCode = Symbol("status-code"),
  kWebSocket = Symbol("websocket"),
  NOOP = () => void 0,
  PerMessageDeflate = (() => {
    const a = Buffer.from([0, 0, 255, 255]),
      b = Symbol("permessage-deflate"),
      c = Symbol("total-length"),
      d = Symbol("callback"),
      e = Symbol("buffers"),
      f = Symbol("error"),
      g = (() => {
        const a = Symbol("kDone"),
          b = Symbol("kRun");
        return class {
          constructor(c) {
            this[a] = () => {
              this.pending--;
              this[b]();
            };
            this.concurrency = c || 1 / 0;
            this.jobs = [];
            this.pending = 0;
          }
          add(a) {
            this.jobs.push(a);
            this[b]();
          }
          [b]() {
            if (this.pending !== this.concurrency && this.jobs.length) {
              const b = this.jobs.shift();
              this.pending++;
              b(this[a]);
            }
          }
        };
      })();
    let h;
    function i(a) {
      this[e].push(a);
      this[c] += a.length;
    }
    function j(a) {
      if (((this[c] += a.length), this[b]._maxPayload < 1 || this[c] <= this[b]._maxPayload)) {
        this[e].push(a);
        return;
      }
      this[f] = new RangeError("Max payload size exceeded");
      this[f].code = "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH";
      this[f][kStatusCode] = 1009;
      this.removeListener("data", j);
      this.reset();
    }
    function k(a) {
      this[b]._inflate = null;
      a[kStatusCode] = 1007;
      this[d](a);
    }
    return class {
      constructor(a, b, c) {
        this._maxPayload = 0 | c;
        this._options = a || {};
        this._threshold = void 0 !== this._options.threshold ? this._options.threshold : 1024;
        this._isServer = !!b;
        this._deflate = this._inflate = this.params = null;
        if (!h) h = new g(void 0 !== this._options.concurrencyLimit ? this._options.concurrencyLimit : 10);
      }
      offer() {
        const a = {};
        if (this._options.serverNoContextTakeover) a.server_no_context_takeover = !0;
        if (this._options.clientNoContextTakeover) a.client_no_context_takeover = !0;
        if (this._options.serverMaxWindowBits) a.server_max_window_bits = this._options.serverMaxWindowBits;
        const { clientMaxWindowBits: b } = this._options;
        return b ? (a.client_max_window_bits = b) : (null === b || undefined === b) && (a.client_max_window_bits = !0), a;
      }
      accept(a) {
        a = this.normalizeParams(a);
        return (this.params = this._isServer ? this.acceptAsServer(a) : this.acceptAsClient(a));
      }
      cleanup() {
        if (this._inflate) {
          this._inflate.close();
          this._inflate = null;
        }
        if (this._deflate) {
          const a = this._deflate[d];
          this._deflate.close();
          this._deflate = null;
          if (a) a(new Error("The deflate stream was closed while data was being processed"));
        }
      }
      acceptAsServer(c) {
        const b = this._options,
          a = c.find(
            a =>
              (!1 !== b.serverNoContextTakeover || !a.server_no_context_takeover) &&
              (!a.server_max_window_bits || (!1 !== b.serverMaxWindowBits && ("number" != typeof b.serverMaxWindowBits || !(b.serverMaxWindowBits > a.server_max_window_bits)))) &&
              ("number" != typeof b.clientMaxWindowBits || !!a.client_max_window_bits)
          );
        if (!a) throw new Error("None of the extension offers can be accepted");
        return (
          b.serverNoContextTakeover && (a.server_no_context_takeover = !0),
          b.clientNoContextTakeover && (a.client_no_context_takeover = !0),
          "number" == typeof b.serverMaxWindowBits && (a.server_max_window_bits = b.serverMaxWindowBits),
          "number" == typeof b.clientMaxWindowBits
            ? (a.client_max_window_bits = b.clientMaxWindowBits)
            : (!0 === a.client_max_window_bits || !1 === b.clientMaxWindowBits) && delete a.client_max_window_bits,
          a
        );
      }
      acceptAsClient(b) {
        const a = b[0];
        if (!1 === this._options.clientNoContextTakeover && a.client_no_context_takeover) throw new Error('Unexpected parameter "client_no_context_takeover"');
        if (a.client_max_window_bits) {
          if (!1 === this._options.clientMaxWindowBits || ("number" == typeof this._options.clientMaxWindowBits && a.client_max_window_bits > this._options.clientMaxWindowBits))
            throw new Error('Unexpected or invalid parameter "client_max_window_bits"');
        } else if ("number" == typeof this._options.clientMaxWindowBits) a.client_max_window_bits = this._options.clientMaxWindowBits;
        return a;
      }
      normalizeParams(a) {
        a.forEach(a =>
          Object.keys(a).forEach(c => {
            let b = a[c];
            if (b.length > 1) throw new Error(`Parameter "${c}" must have only a single value`);
            if (((b = b[0]), "client_max_window_bits" === c)) {
              if (!0 !== b) {
                const d = +b;
                if (!Number.isInteger(d) || d < 8 || d > 15) throw new TypeError(`Invalid value for parameter "${c}": ${b}`);
                b = d;
              } else if (!this._isServer) throw new TypeError(`Invalid value for parameter "${c}": ${b}`);
            } else if ("server_max_window_bits" === c) {
              const e = +b;
              if (!Number.isInteger(e) || e < 8 || e > 15) throw new TypeError(`Invalid value for parameter "${c}": ${b}`);
              b = e;
            } else if ("client_no_context_takeover" === c || "server_no_context_takeover" === c) {
              if (!0 !== b) throw new TypeError(`Invalid value for parameter "${c}": ${b}`);
            } else throw new Error(`Unknown parameter "${c}"`);
            a[c] = b;
          })
        );
        return a;
      }
      decompress(a, b, c) {
        h.add(d =>
          this._decompress(a, b, (a, b) => {
            d();
            c(a, b);
          })
        );
      }
      compress(a, b, c) {
        h.add(d =>
          this._compress(a, b, (a, b) => {
            d();
            c(a, b);
          })
        );
      }
      _decompress(h, i, l) {
        const m = this._isServer ? "client" : "server";
        if (!this._inflate) {
          const g = `${m}_max_window_bits`,
            n = "number" != typeof this.params[g] ? zlib.Z_DEFAULT_WINDOWBITS : this.params[g];
          this._inflate = zlib.createInflateRaw({ ...this._options.zlibInflateOptions, windowBits: n });
          this._inflate[b] = this;
          this._inflate[c] = 0;
          this._inflate[e] = [];
          this._inflate.on("error", k);
          this._inflate.on("data", j);
        }
        this._inflate[d] = l;
        this._inflate.write(h);
        if (i) this._inflate.write(a);
        this._inflate.flush(() => {
          const a = this._inflate[f];
          if (a) {
            this._inflate.close();
            this._inflate = null;
            l(a);
            return;
          }
          const b = concat(this._inflate[e], this._inflate[c]);
          if (this._inflate._readableState.endEmitted) {
            this._inflate.close();
            this._inflate = null;
          } else {
            this._inflate[c] = 0;
            this._inflate[e] = [];
            if (i && this.params[`${m}_no_context_takeover`]) this._inflate.reset();
          }
          l(null, b);
        });
      }
      _compress(b, j, f) {
        const g = this._isServer ? "server" : "client";
        if (!this._deflate) {
          const a = `${g}_max_window_bits`,
            h = "number" != typeof this.params[a] ? zlib.Z_DEFAULT_WINDOWBITS : this.params[a];
          this._deflate = zlib.createDeflateRaw({ ...this._options.zlibDeflateOptions, windowBits: h });
          this._deflate[c] = 0;
          this._deflate[e] = [];
          this._deflate.on("data", i);
        }
        this._deflate[d] = f;
        this._deflate.write(b);
        this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
          if (!this._deflate) return;
          let a = concat(this._deflate[e], this._deflate[c]);
          if (j) a = a.slice(0, a.length - 4);
          this._deflate[d] = null;
          this._deflate[c] = 0;
          this._deflate[e] = [];
          if (j && this.params[`${g}_no_context_takeover`]) this._deflate.reset();
          f(null, a);
        });
      }
    };
  })(),
  Receiver = (() => {
    function a(a) {
      return a.byteLength === a.buffer.byteLength ? a.buffer : a.buffer.slice(a.byteOffset, a.byteOffset + a.byteLength);
    }
    function b(b) {
      const c = b.length;
      let a = 0;
      for (; a < c; )
        if ((128 & b[a]) == 0) a++;
        else if ((224 & b[a]) == 192) {
          if (a + 1 === c || (192 & b[a + 1]) != 128 || (254 & b[a]) == 192) return !1;
          a += 2;
        } else if ((240 & b[a]) == 224) {
          if (a + 2 >= c || (192 & b[a + 1]) != 128 || (192 & b[a + 2]) != 128 || (224 === b[a] && (224 & b[a + 1]) == 128) || (237 === b[a] && (224 & b[a + 1]) == 160)) return !1;
          a += 3;
        } else {
          if (
            (248 & b[a]) != 240 ||
            a + 3 >= c ||
            (192 & b[a + 1]) != 128 ||
            (192 & b[a + 2]) != 128 ||
            (192 & b[a + 3]) != 128 ||
            (240 === b[a] && (240 & b[a + 1]) == 128) ||
            (244 === b[a] && b[a + 1] > 143) ||
            b[a] > 244
          )
            return !1;
          a += 4;
        }
      return !0;
    }
    function c(d, b, e, f, g) {
      const a = new d(e ? `Invalid WebSocket frame: ${b}` : b);
      Error.captureStackTrace(a, c);
      a.code = g;
      a[kStatusCode] = f;
      return a;
    }
    return class extends f {
      constructor(a = {}) {
        super();
        this._binaryType = a.binaryType || BINARY_TYPES[0];
        this._extensions = a.extensions || {};
        this._isServer = !!a.isServer;
        this._maxPayload = 0 | a.maxPayload;
        this._skipUTF8Validation = !!a.skipUTF8Validation;
        this[kWebSocket] = void 0;
        this._bufferedBytes = 0;
        this._buffers = [];
        this._compressed = !1;
        this._payloadLength = 0;
        this._mask = void 0;
        this._fragmented = 0;
        this._masked = !1;
        this._fin = !1;
        this._opcode = 0;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._fragments = [];
        this._state = 0;
        this._loop = !1;
      }
      _write(a, _, b) {
        if (8 === this._opcode && 0 == this._state) return b();
        this._bufferedBytes += a.length;
        this._buffers.push(a);
        this.startLoop(b);
      }
      consume(a) {
        if (((this._bufferedBytes -= a), a === this._buffers[0].length)) return this._buffers.shift();
        if (a < this._buffers[0].length) {
          const d = this._buffers[0];
          return (this._buffers[0] = d.slice(a)), d.slice(0, a);
        }
        const c = Buffer.allocUnsafe(a);
        do {
          const b = this._buffers[0],
            e = c.length - a;
          if (a >= b.length) c.set(this._buffers.shift(), e);
          else {
            c.set(new Uint8Array(b.buffer, b.byteOffset, a), e);
            this._buffers[0] = b.slice(a);
          }
          a -= b.length;
        } while (a > 0);
        return c;
      }
      startLoop(b) {
        let a;
        this._loop = !0;
        do
          switch (this._state) {
            case 0:
              a = this.getInfo();
              break;
            case 1:
              a = this.getPayloadLength16();
              break;
            case 2:
              a = this.getPayloadLength64();
              break;
            case 3:
              this.getMask();
              break;
            case 4:
              a = this.getData(b);
              break;
            default:
              this._loop = !1;
              return;
          }
        while (this._loop);
        b(a);
      }
      getInfo() {
        if (this._bufferedBytes < 2) {
          this._loop = !1;
          return;
        }
        const a = this.consume(2);
        if ((48 & a[0]) != 0) return (this._loop = !1), c(RangeError, "RSV2 and RSV3 must be clear", !0, 1002, "WS_ERR_UNEXPECTED_RSV_2_3");
        const b = (64 & a[0]) == 64;
        if (b && !this._extensions["permessage-deflate"]) return (this._loop = !1), c(RangeError, "RSV1 must be clear", !0, 1002, "WS_ERR_UNEXPECTED_RSV_1");
        if (((this._fin = (128 & a[0]) == 128), (this._opcode = 15 & a[0]), (this._payloadLength = 127 & a[1]), 0 === this._opcode)) {
          if (b) return (this._loop = !1), c(RangeError, "RSV1 must be clear", !0, 1002, "WS_ERR_UNEXPECTED_RSV_1");
          if (!this._fragmented) return (this._loop = !1), c(RangeError, "invalid opcode 0", !0, 1002, "WS_ERR_INVALID_OPCODE");
          this._opcode = this._fragmented;
        } else if (1 === this._opcode || 2 === this._opcode) {
          if (this._fragmented) return (this._loop = !1), c(RangeError, `invalid opcode ${this._opcode}`, !0, 1002, "WS_ERR_INVALID_OPCODE");
          this._compressed = b;
        } else {
          if (!(this._opcode > 7) || !(this._opcode < 11)) return (this._loop = !1), c(RangeError, `invalid opcode ${this._opcode}`, !0, 1002, "WS_ERR_INVALID_OPCODE");
          if (!this._fin) return (this._loop = !1), c(RangeError, "FIN must be set", !0, 1002, "WS_ERR_EXPECTED_FIN");
          if (b) return (this._loop = !1), c(RangeError, "RSV1 must be clear", !0, 1002, "WS_ERR_UNEXPECTED_RSV_1");
          if (this._payloadLength > 125) return (this._loop = !1), c(RangeError, `invalid payload length ${this._payloadLength}`, !0, 1002, "WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH");
        }
        if ((this._fin || this._fragmented || (this._fragmented = this._opcode), (this._masked = (128 & a[1]) == 128), this._isServer)) {
          if (!this._masked) return (this._loop = !1), c(RangeError, "MASK must be set", !0, 1002, "WS_ERR_EXPECTED_MASK");
        } else if (this._masked) return (this._loop = !1), c(RangeError, "MASK must be clear", !0, 1002, "WS_ERR_UNEXPECTED_MASK");
        if (126 === this._payloadLength) this._state = 1;
        else {
          if (127 !== this._payloadLength) return this.haveLength();
          this._state = 2;
        }
      }
      getPayloadLength16() {
        if (this._bufferedBytes < 2) {
          this._loop = !1;
          return;
        }
        return (this._payloadLength = this.consume(2).readUInt16BE(0)), this.haveLength();
      }
      getPayloadLength64() {
        if (this._bufferedBytes < 8) {
          this._loop = !1;
          return;
        }
        const a = this.consume(8),
          b = a.readUInt32BE(0);
        return b > 2097151
          ? ((this._loop = !1), c(RangeError, "Unsupported WebSocket frame: payload length > 2^53 - 1", !1, 1009, "WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH"))
          : ((this._payloadLength = 4294967296 * b + a.readUInt32BE(4)), this.haveLength());
      }
      haveLength() {
        if (this._payloadLength && this._opcode < 8 && ((this._totalPayloadLength += this._payloadLength), this._totalPayloadLength > this._maxPayload && this._maxPayload > 0))
          return (this._loop = !1), c(RangeError, "Max payload size exceeded", !1, 1009, "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH");
        if (this._masked) this._state = 3;
        else this._state = 4;
      }
      getMask() {
        if (this._bufferedBytes < 4) {
          this._loop = !1;
          return;
        }
        this._mask = this.consume(4);
        this._state = 4;
      }
      getData(c) {
        let a = EMPTY_BUFFER;
        if (this._payloadLength) {
          if (this._bufferedBytes < this._payloadLength) {
            this._loop = !1;
            return;
          }
          if (((a = this.consume(this._payloadLength)), this._masked && (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) != 0))
            for (let b = 0; b < a.length; b++) a[b] ^= this._mask[3 & b];
        }
        if (this._opcode > 7) return this.controlMessage(a);
        if (this._compressed) {
          this._state = 5;
          this.decompress(a, c);
          return;
        }
        return a.length && ((this._messageLength = this._totalPayloadLength), this._fragments.push(a)), this.dataMessage();
      }
      decompress(a, d) {
        const b = this._extensions["permessage-deflate"];
        b.decompress(a, this._fin, (b, a) => {
          if (b) return d(b);
          if (a.length) {
            if (((this._messageLength += a.length), this._messageLength > this._maxPayload && this._maxPayload > 0))
              return d(c(RangeError, "Max payload size exceeded", !1, 1009, "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"));
            this._fragments.push(a);
          }
          const e = this.dataMessage();
          if (e) return d(e);
          this.startLoop(d);
        });
      }
      dataMessage() {
        if (this._fin) {
          const e = this._messageLength,
            d = this._fragments;
          this._totalPayloadLength = this._messageLength = this._fragmented = 0;
          this._fragments = [];
          if (2 === this._opcode) {
            this.emit("message", "nodebuffer" === this._binaryType ? concat(d, e) : "arraybuffer" === this._binaryType ? a(concat(d, e)) : d, !0);
          } else {
            const g = concat(d, e);
            if (!this._skipUTF8Validation && !b(g)) return (this._loop = !1), c(Error, "invalid UTF-8 sequence", !0, 1007, "WS_ERR_INVALID_UTF8");
            this.emit("message", g, !1);
          }
        }
        this._state = 0;
      }
      controlMessage(d) {
        if (8 === this._opcode) {
          if (((this._loop = !1), 0 === d.length)) {
            this.emit("conclude", 1005, EMPTY_BUFFER);
            this.end();
          } else {
            if (1 === d.length) return c(RangeError, "invalid payload length 1", !0, 1002, "WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH");
            const a = d.readUInt16BE(0);
            if (!((a >= 1e3 && a <= 1014 && 1004 !== a && 1005 !== a && 1006 !== a) || (a >= 3e3 && a <= 4999)))
              return c(RangeError, `invalid status code ${a}`, !0, 1002, "WS_ERR_INVALID_CLOSE_CODE");
            const e = d.slice(2);
            if (!this._skipUTF8Validation && !b(e)) return c(Error, "invalid UTF-8 sequence", !0, 1007, "WS_ERR_INVALID_UTF8");
            this.emit("conclude", a, e);
            this.end();
          }
        } else 9 === this._opcode ? this.emit("ping", d) : this.emit("pong", d);
        this._state = 0;
      }
    };
  })(),
  Sender = (() => {
    const a = Symbol("kByteLength"),
      b = Buffer.alloc(4);
    return class c {
      constructor(b, c, a) {
        this._extensions = c || {};
        if (a) {
          this._generateMask = a;
          this._maskBuffer = Buffer.alloc(4);
        }
        this._socket = b;
        this._firstFragment = !0;
        this._compress = !1;
        this._bufferedBytes = 0;
        this._deflating = !1;
        this._queue = [];
      }
      static frame(g, d) {
        let f,
          l = !1,
          h = 2,
          k = !1;
        if (d.mask) {
          f = d.maskBuffer || b;
          if (d.generateMask) d.generateMask(f);
          else {
            e(f, 0, 4);
            k = (f[0] | f[1] | f[2] | f[3]) == 0;
          }
          h = 6;
        }
        let i;
        if ("string" == typeof g) {
          i = (!d.mask || k) && void 0 !== d[a] ? d[a] : (g = Buffer.from(g)).length;
        } else {
          i = g.length;
          l = d.mask && d.readOnly && !k;
        }
        let j = i;
        if (i >= 65536) {
          (h += 8), (j = 127);
        } else if (i > 125) (h += 2), (j = 126);

        const c = Buffer.allocUnsafe(l ? i + h : h);
        c[0] = d.fin ? 128 | d.opcode : d.opcode;
        if (d.rsv1) c[0] |= 64;
        c[1] = j;
        126 === j ? c.writeUInt16BE(i, 2) : 127 === j && ((c[2] = c[3] = 0), c.writeUIntBE(i, 4, 6));
        return d.mask
          ? ((c[1] |= 128), (c[h - 4] = f[0]), (c[h - 3] = f[1]), (c[h - 2] = f[2]), (c[h - 1] = f[3]), k)
            ? [c, g]
            : l
            ? (applyMask(g, f, c, h, i), [c])
            : (applyMask(g, f, g, 0, i), [c, g])
          : [c, g];
      }
      close(b, e, i, f) {
        let d;
        if (void 0 === b) d = EMPTY_BUFFER;
        else if ("number" == typeof b && ((b >= 1e3 && b <= 1014 && 1004 !== b && 1005 !== b && 1006 !== b) || (b >= 3e3 && b <= 4999))) {
          if (void 0 !== e && e.length) {
            const g = Buffer.byteLength(e);
            if (g > 123) throw new RangeError("The message must not be greater than 123 bytes");
            (d = Buffer.allocUnsafe(2 + g)).writeUInt16BE(b, 0);
            if ("string" == typeof e) d.write(e, 2);
            else d.set(e, 2);
          } else (d = Buffer.allocUnsafe(2)).writeUInt16BE(b, 0);
        } else throw new TypeError("First argument must be a valid error code number");
        const h = { [a]: d.length, fin: !0, generateMask: this._generateMask, mask: i, maskBuffer: this._maskBuffer, opcode: 8, readOnly: !1, rsv1: !1 };
        if (this._deflating) this.enqueue([this.dispatch, d, !1, h, f]);
        else this.sendFrame(c.frame(d, h), f);
      }
      ping(b, h, f) {
        let d, e;
        if (("string" == typeof b ? ((d = Buffer.byteLength(b)), (e = !1)) : ((d = (b = toBuffer(b)).length), ({ readOnly: e } = toBuffer)), d > 125))
          throw new RangeError("The data size must not be greater than 125 bytes");
        const g = { [a]: d, fin: !0, generateMask: this._generateMask, mask: h, maskBuffer: this._maskBuffer, opcode: 9, readOnly: e, rsv1: !1 };
        if (this._deflating) this.enqueue([this.dispatch, b, !1, g, f]);
        else this.sendFrame(c.frame(b, g), f);
      }
      pong(b, h, f) {
        let d, e;
        if (("string" == typeof b ? ((d = Buffer.byteLength(b)), (e = !1)) : ((d = (b = toBuffer(b)).length), ({ readOnly: e } = toBuffer)), d > 125))
          throw new RangeError("The data size must not be greater than 125 bytes");
        const g = { [a]: d, fin: !0, generateMask: this._generateMask, mask: h, maskBuffer: this._maskBuffer, opcode: 10, readOnly: e, rsv1: !1 };
        if (this._deflating) this.enqueue([this.dispatch, b, !1, g, f]);
        else this.sendFrame(c.frame(b, g), f);
      }
      send(b, d, i) {
        const e = this._extensions["permessage-deflate"];
        let j = d.binary ? 2 : 1,
          f = d.compress,
          g,
          h;
        if (
          ("string" == typeof b ? ((g = Buffer.byteLength(b)), (h = !1)) : ((g = (b = toBuffer(b)).length), ({ readOnly: h } = toBuffer)),
          this._firstFragment
            ? ((this._firstFragment = !1), f && e && e.params[e._isServer ? "server_no_context_takeover" : "client_no_context_takeover"] && (f = g >= e._threshold), (this._compress = f))
            : ((f = !1), (j = 0)),
          d.fin && (this._firstFragment = !0),
          e)
        ) {
          const k = { [a]: g, fin: d.fin, generateMask: this._generateMask, mask: d.mask, maskBuffer: this._maskBuffer, opcode: j, readOnly: h, rsv1: f };
          if (this._deflating) this.enqueue([this.dispatch, b, this._compress, k, i]);
          else this.dispatch(b, this._compress, k, i);
        } else this.sendFrame(c.frame(b, { [a]: g, fin: d.fin, generateMask: this._generateMask, mask: d.mask, maskBuffer: this._maskBuffer, opcode: j, readOnly: h, rsv1: !1 }), i);
      }
      dispatch(d, e, b, f) {
        if (!e) {
          this.sendFrame(c.frame(d, b), f);
          return;
        }
        const g = this._extensions["permessage-deflate"];
        this._bufferedBytes += b[a];
        this._deflating = !0;
        g.compress(d, b.fin, (_, i) => {
          if (this._socket.destroyed) {
            const e = new Error("The socket was closed while data was being compressed");
            if ("function" == typeof f) f(e);
            for (let d = 0; d < this._queue.length; d++) {
              const g = this._queue[d],
                h = g[g.length - 1];
              if ("function" == typeof h) h(e);
            }
            return;
          }
          this._bufferedBytes -= b[a];
          this._deflating = !1;
          b.readOnly = !1;
          this.sendFrame(c.frame(i, b), f);
          this.dequeue();
        });
      }
      dequeue() {
        for (; !this._deflating && this._queue.length; ) {
          const b = this._queue.shift();
          this._bufferedBytes -= b[3][a];
          Reflect.apply(b[0], this, b.slice(1));
        }
      }
      enqueue(b) {
        this._bufferedBytes += b[3][a];
        this._queue.push(b);
      }
      sendFrame(a, b) {
        if (2 === a.length) {
          this._socket.cork();
          this._socket.write(a[0]);
          this._socket.write(a[1], b);
          this._socket.uncork();
        } else this._socket.write(a[0], b);
      }
    };
  })();
function concat(a, e) {
  if (0 === a.length) return EMPTY_BUFFER;
  if (1 === a.length) return a[0];
  const c = Buffer.allocUnsafe(e);
  let b = 0;
  for (let d = 0; d < a.length; d++) {
    const f = a[d];
    c.set(f, b);
    b += f.length;
  }
  return b < e ? c.slice(0, b) : c;
}
function applyMask(b, c, d, e, f) {
  for (let a = 0; a < f; a++) d[e + a] = b[a] ^ c[3 & a];
}
function toBuffer(a) {
  if (((toBuffer.readOnly = !0), Buffer.isBuffer(a))) return a;
  let b;
  return a instanceof ArrayBuffer ? (b = Buffer.from(a)) : ArrayBuffer.isView(a) ? (b = Buffer.from(a.buffer, a.byteOffset, a.byteLength)) : ((b = Buffer.from(a)), (toBuffer.readOnly = !1)), b;
}
const { addEventListener: a, removeEventListener: b } = (() => {
    const e = Symbol("kCode"),
      f = Symbol("kData"),
      g = Symbol("kError"),
      h = Symbol("kMessage"),
      i = Symbol("kReason"),
      j = Symbol("kTarget"),
      k = Symbol("kType"),
      l = Symbol("kWasClean");
    class a {
      constructor(a) {
        this[j] = null;
        this[k] = a;
      }
      get target() {
        return this[j];
      }
      get type() {
        return this[k];
      }
    }
    Object.defineProperty(a.prototype, "target", { enumerable: !0 });
    Object.defineProperty(a.prototype, "type", { enumerable: !0 });
    class b extends a {
      constructor(b, a = {}) {
        super(b);
        this[e] = void 0 === a.code ? 0 : a.code;
        this[i] = void 0 === a.reason ? "" : a.reason;
        this[l] = void 0 !== a.wasClean && a.wasClean;
      }
      get code() {
        return this[e];
      }
      get reason() {
        return this[i];
      }
      get wasClean() {
        return this[l];
      }
    }
    Object.defineProperty(b.prototype, "code", { enumerable: !0 });
    Object.defineProperty(b.prototype, "reason", { enumerable: !0 });
    Object.defineProperty(b.prototype, "wasClean", { enumerable: !0 });
    class c extends a {
      constructor(b, a = {}) {
        super(b);
        this[g] = void 0 === a.error ? null : a.error;
        this[h] = void 0 === a.message ? "" : a.message;
      }
      get error() {
        return this[g];
      }
      get message() {
        return this[h];
      }
    }
    Object.defineProperty(c.prototype, "error", { enumerable: !0 });
    Object.defineProperty(c.prototype, "message", { enumerable: !0 });
    class d extends a {
      constructor(b, a = {}) {
        super(b);
        this[f] = void 0 === a.data ? null : a.data;
      }
      get data() {
        return this[f];
      }
    }
    return (
      Object.defineProperty(d.prototype, "data", { enumerable: !0 }),
      {
        addEventListener(f, h, g = {}) {
          let e;
          if ("message" === f)
            e = function (a, c) {
              const b = new d("message", { data: c ? a : a.toString() });
              b[j] = this;
              h.call(this, b);
            };
          else if ("close" === f)
            e = function (c, d) {
              const a = new b("close", { code: c, reason: d.toString(), wasClean: this._closeFrameReceived && this._closeFrameSent });
              a[j] = this;
              h.call(this, a);
            };
          else if ("error" === f)
            e = function (a) {
              const b = new c("error", { error: a, message: a.message });
              b[j] = this;
              h.call(this, b);
            };
          else {
            if ("open" !== f) return;
            e = function () {
              const b = new a("open");
              b[j] = this;
              h.call(this, b);
            };
          }
          e[kForOnEventAttribute] = !!g[kForOnEventAttribute];
          e[kListener] = h;
          if (g.once) this.once(f, e);
          else this.on(f, e);
        },
        removeEventListener(b, c) {
          for (const a of this.listeners(b))
            if (a[kListener] === c && !a[kForOnEventAttribute]) {
              this.removeListener(b, a);
              break;
            }
        }
      }
    );
  })(),
  { format: h, parse: i } = (() => {
    const c = [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0,
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0
    ];
    function d(a, b, c) {
      if (void 0 === a[b]) a[b] = [c];
      else a[b].push(c);
    }
    function a(h) {
      const k = { __proto__: null };
      let g = { __proto__: null },
        l = !1,
        o = !1,
        m = !1,
        i,
        j,
        a = -1,
        b = -1,
        e = -1,
        f = 0;
      for (; f < h.length; f++)
        if (((b = h.charCodeAt(f)), void 0 === i)) {
          if (-1 === e && 1 === c[b]) -1 === a && (a = f);
          else if (0 !== f && (32 === b || 9 === b)) -1 === e && -1 !== a && (e = f);
          else if (59 === b || 44 === b) {
            if (-1 === a) throw new SyntaxError(`Unexpected character at index ${f}`);
            if (-1 === e) e = f;
            const q = h.slice(a, e);
            if (44 === b) {
              d(k, q, g);
              g = { __proto__: null };
            } else i = q;
            a = e = -1;
          } else throw new SyntaxError(`Unexpected character at index ${f}`);
        } else if (void 0 === j) {
          if (-1 === e && 1 === c[b]) -1 === a && (a = f);
          else if (32 === b || 9 === b) -1 === e && -1 !== a && (e = f);
          else if (59 === b || 44 === b) {
            if (-1 === a) throw new SyntaxError(`Unexpected character at index ${f}`);
            if (-1 === e) e = f;
            d(g, h.slice(a, e), !0);
            if (44 === b) {
              d(k, i, g);
              g = { __proto__: null };
              i = void 0;
            }
            a = e = -1;
          } else if (61 === b && -1 !== a && -1 === e) (j = h.slice(a, f)), (a = e = -1);
          else throw new SyntaxError(`Unexpected character at index ${f}`);
        } else if (o) {
          if (1 !== c[b]) throw new SyntaxError(`Unexpected character at index ${f}`);
          if (-1 === a) a = f;
          else l || (l = !0);
          o = !1;
        } else if (m) {
          if (1 === c[b]) -1 === a && (a = f);
          else if (34 === b && -1 !== a) {
            m = !1;
            e = f;
          } else if (92 === b) o = !0;
          else throw new SyntaxError(`Unexpected character at index ${f}`);
        } else if (34 === b && 61 === h.charCodeAt(f - 1)) m = !0;
        else if (-1 === e && 1 === c[b]) -1 === a && (a = f);
        else if (-1 !== a && (32 === b || 9 === b)) -1 === e && (e = f);
        else if (59 === b || 44 === b) {
          if (-1 === a) throw new SyntaxError(`Unexpected character at index ${f}`);
          if (-1 === e) e = f;
          let p = h.slice(a, e);
          if (l) {
            p = p.replace(/\\/g, "");
            l = !1;
          }
          d(g, j, p);
          if (44 === b) {
            d(k, i, g);
            g = { __proto__: null };
            i = void 0;
          }
          j = void 0;
          a = e = -1;
        } else throw new SyntaxError(`Unexpected character at index ${f}`);
      if (-1 === a || m || 32 === b || 9 === b) throw new SyntaxError("Unexpected end of input");
      if (-1 === e) e = f;
      const n = h.slice(a, e);
      return void 0 === i ? d(k, n, g) : (void 0 === j ? d(g, n, !0) : l ? d(g, j, n.replace(/\\/g, "")) : d(g, j, n), d(k, i, g)), k;
    }
    function b(a) {
      return Object.keys(a)
        .map(c => {
          let b = a[c];
          return (
            Array.isArray(b) || (b = [b]),
            b
              .map(a =>
                [c]
                  .concat(
                    Object.keys(a).map(c => {
                      let b = a[c];
                      return Array.isArray(b) || (b = [b]), b.map(a => (!0 === a ? c : `${c}=${a}`)).join("; ");
                    })
                  )
                  .join("; ")
              )
              .join(", ")
          );
        })
        .join(", ");
    }
    return { format: b, parse: a };
  })(),
  readyStates = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"],
  subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/,
  protocolVersions = [8, 13];
class WebSocket extends EventEmitter {
  constructor(b, a, c) {
    super();
    this._binaryType = BINARY_TYPES[0];
    this._closeCode = 1006;
    this._closeFrameReceived = !1;
    this._closeFrameSent = !1;
    this._closeMessage = EMPTY_BUFFER;
    this._closeTimer = null;
    this._extensions = {};
    this._paused = !1;
    this._protocol = "";
    this._readyState = WebSocket.CONNECTING;
    this._receiver = null;
    this._sender = null;
    this._socket = null;
    if (null !== b) {
      this._bufferedAmount = 0;
      this._isServer = !1;
      this._redirects = 0;
      void 0 === a ? (a = []) : Array.isArray(a) || ("object" == typeof a && null !== a ? ((c = a), (a = [])) : (a = [a]));
      initAsClient(this, b, a, c);
    } else this._isServer = !0;
  }
  get binaryType() {
    return this._binaryType;
  }
  set binaryType(a) {
    if (BINARY_TYPES.includes(a)) {
      this._binaryType = a;
      if (this._receiver) this._receiver._binaryType = a;
    }
  }
  get bufferedAmount() {
    return this._socket ? this._socket._writableState.length + this._sender._bufferedBytes : this._bufferedAmount;
  }
  get extensions() {
    return Object.keys(this._extensions).join();
  }
  get isPaused() {
    return this._paused;
  }
  get onclose() {
    return null;
  }
  get onerror() {
    return null;
  }
  get onopen() {
    return null;
  }
  get onmessage() {
    return null;
  }
  get protocol() {
    return this._protocol;
  }
  get readyState() {
    return this._readyState;
  }
  get url() {
    return this._url;
  }
  setSocket(a, d, c) {
    const b = new Receiver({ binaryType: this.binaryType, extensions: this._extensions, isServer: this._isServer, maxPayload: c.maxPayload, skipUTF8Validation: c.skipUTF8Validation });
    this._sender = new Sender(a, this._extensions, c.generateMask);
    this._receiver = b;
    this._socket = a;
    b[kWebSocket] = this;
    a[kWebSocket] = this;
    b.on("conclude", receiverOnConclude);
    b.on("drain", receiverOnDrain);
    b.on("error", receiverOnError);
    b.on("message", receiverOnMessage);
    b.on("ping", receiverOnPing);
    b.on("pong", receiverOnPong);
    a.setTimeout(0);
    a.setNoDelay();
    if (d.length > 0) a.unshift(d);
    a.on("close", socketOnClose);
    a.on("data", socketOnData);
    a.on("end", socketOnEnd);
    a.on("error", socketOnError);
    this._readyState = WebSocket.OPEN;
    this.emit("open");
  }
  emitClose() {
    if (!this._socket) {
      this._readyState = WebSocket.CLOSED;
      this.emit("close", this._closeCode, this._closeMessage);
      return;
    }
    if (this._extensions["permessage-deflate"]) this._extensions["permessage-deflate"].cleanup();
    this._receiver.removeAllListeners();
    this._readyState = WebSocket.CLOSED;
    this.emit("close", this._closeCode, this._closeMessage);
  }
  close(a, b) {
    if (this.readyState !== WebSocket.CLOSED) {
      if (this.readyState === WebSocket.CONNECTING) {
        const c = "WebSocket was closed before the connection was established";
        return abortHandshake(this, this._req, c);
      }
      if (this.readyState === WebSocket.CLOSING) {
        if (this._closeFrameSent && (this._closeFrameReceived || this._receiver._writableState.errorEmitted)) this._socket.end();
        return;
      }
      this._readyState = WebSocket.CLOSING;
      this._sender.close(a, b, !this._isServer, a => {
        if (!a) return;
        this._closeFrameSent = !0;
        if (this._closeFrameReceived || this._receiver._writableState.errorEmitted) this._socket.end();
      });
      this._closeTimer = setTimeout(this._socket.destroy.bind(this._socket), 3e4);
    }
  }
  pause() {
    if (this.readyState !== WebSocket.CONNECTING && this.readyState !== WebSocket.CLOSED) {
      this._paused = !0;
      this._socket.pause();
    }
  }
  ping(a, b, c) {
    if (this.readyState === WebSocket.CONNECTING) throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
    if (("function" == typeof a ? ((c = a), (a = b = void 0)) : "function" == typeof b && ((c = b), (b = void 0)), "number" == typeof a && (a = a.toString()), this.readyState !== WebSocket.OPEN)) {
      sendAfterClose(this, a, c);
      return;
    }
    if (void 0 === b) b = !this._isServer;
    this._sender.ping(a || EMPTY_BUFFER, b, c);
  }
  pong(a, b, c) {
    if (this.readyState === WebSocket.CONNECTING) throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
    if (("function" == typeof a ? ((c = a), (a = b = void 0)) : "function" == typeof b && ((c = b), (b = void 0)), "number" == typeof a && (a = a.toString()), this.readyState !== WebSocket.OPEN)) {
      sendAfterClose(this, a, c);
      return;
    }
    if (void 0 === b) b = !this._isServer;
    this._sender.pong(a || EMPTY_BUFFER, b, c);
  }
  resume() {
    if (this.readyState !== WebSocket.CONNECTING && this.readyState !== WebSocket.CLOSED) {
      this._paused = !1;
      this._receiver._writableState.needDrain || this._socket.resume();
    }
  }
  send(a, b, c) {
    if (this.readyState === WebSocket.CONNECTING) throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
    if (("function" == typeof b && ((c = b), (b = {})), "number" == typeof a && (a = a.toString()), this.readyState !== WebSocket.OPEN)) {
      sendAfterClose(this, a, c);
      return;
    }
    const d = { binary: "string" != typeof a, mask: !this._isServer, compress: !0, fin: !0, ...b };
    this._extensions["permessage-deflate"] || (d.compress = !1);
    this._sender.send(a || EMPTY_BUFFER, d, c);
  }
  terminate() {
    if (this.readyState !== WebSocket.CLOSED) {
      if (this.readyState === WebSocket.CONNECTING) {
        const a = "WebSocket was closed before the connection was established";
        return abortHandshake(this, this._req, a);
      }
      if (this._socket) {
        this._readyState = WebSocket.CLOSING;
        this._socket.destroy();
      }
    }
  }
}
function initAsClient(e, j, o, f) {
  const a = {
    protocolVersion: protocolVersions[1],
    maxPayload: 104857600,
    skipUTF8Validation: !1,
    perMessageDeflate: !0,
    followRedirects: !1,
    maxRedirects: 10,
    ...f,
    createConnection: void 0,
    socketPath: void 0,
    hostname: void 0,
    protocol: void 0,
    timeout: void 0,
    method: void 0,
    host: void 0,
    path: void 0,
    port: void 0
  };
  if (!protocolVersions.includes(a.protocolVersion)) throw new RangeError(`Unsupported protocol version: ${a.protocolVersion} (supported versions: ${protocolVersions.join(", ")})`);
  let b;
  if (j instanceof g) {
    b = j;
    e._url = j.href;
  } else {
    try {
      b = new g(j);
    } catch (A) {
      throw new SyntaxError(`Invalid URL: ${j}`);
    }
    e._url = j;
  }
  const l = "wss:" === b.protocol,
    p = "ws+unix:" === b.protocol;
  let k;
  if (
    ("ws:" === b.protocol || l || p
      ? p && !b.pathname
        ? (k = "The URL's pathname is empty")
        : b.hash && (k = "The URL contains a fragment identifier")
      : (k = 'The URL\'s protocol must be one of "ws:", "wss:", or "ws+unix:"'),
    k)
  ) {
    const q = new SyntaxError(k);
    if (0 === e._redirects) throw q;
    emitErrorAndClose(e, q);
    return;
  }
  const r = l ? 443 : 80,
    w = c(16).toString("base64"),
    x = l ? https.get : http.get,
    s = new Set();
  let t;
  if (
    ((a.createConnection = l ? tlsConnect : netConnect),
    (a.defaultPort = a.defaultPort || r),
    (a.port = b.port || r),
    (a.host = b.hostname.startsWith("[") ? b.hostname.slice(1, -1) : b.hostname),
    (a.headers = { "Sec-WebSocket-Version": a.protocolVersion, "Sec-WebSocket-Key": w, Connection: "Upgrade", Upgrade: "websocket", ...a.headers }),
    (a.path = b.pathname + b.search),
    (a.timeout = a.handshakeTimeout),
    a.perMessageDeflate &&
      ((t = new PerMessageDeflate(!0 !== a.perMessageDeflate ? a.perMessageDeflate : {}, !1, a.maxPayload)), (a.headers["Sec-WebSocket-Extensions"] = h({ "permessage-deflate": t.offer() }))),
    o.length)
  ) {
    for (const m of o) {
      if ("string" != typeof m || !subprotocolRegex.test(m) || s.has(m)) throw new SyntaxError("An invalid or duplicated subprotocol was specified");
      s.add(m);
    }
    a.headers["Sec-WebSocket-Protocol"] = o.join(",");
  }
  if (
    (a.origin && (a.protocolVersion < 13 ? (a.headers["Sec-WebSocket-Origin"] = a.origin) : (a.headers.Origin = a.origin)), (b.username || b.password) && (a.auth = `${b.username}:${b.password}`), p)
  ) {
    const u = a.path.split(":");
    a.socketPath = u[0];
    a.path = u[1];
  }
  if (a.followRedirects) {
    if (0 === e._redirects) {
      e._originalHost = b.host;
      const v = f && f.headers;
      if (((f = { ...f, headers: {} }), v)) for (const [y, z] of Object.entries(v)) f.headers[y.toLowerCase()] = z;
    } else if (b.host !== e._originalHost) {
      delete a.headers.authorization;
      delete a.headers.cookie;
      delete a.headers.host;
      a.auth = void 0;
    }

    if (a.auth && !f.headers.authorization) f.headers.authorization = "Basic " + Buffer.from(a.auth).toString("base64");
  }
  let n = (e._req = x(a));
  if (a.timeout)
    n.on("timeout", () => {
      abortHandshake(e, n, "Opening handshake has timed out");
    });
  n.on("error", a => {
    null === n || n.aborted || ((n = e._req = null), emitErrorAndClose(e, a));
  });
  n.on("response", b => {
    const { location: c } = b.headers,
      { statusCode: d } = b;
    if (c && a.followRedirects && d >= 300 && d < 400) {
      if (++e._redirects > a.maxRedirects) {
        abortHandshake(e, n, "Maximum redirects exceeded");
        return;
      }
      n.abort();
      let h;
      try {
        h = new g(c, j);
      } catch (k) {
        const i = new SyntaxError(`Invalid URL: ${c}`);
        emitErrorAndClose(e, i);
        return;
      }
      initAsClient(e, h, o, f);
    } else e.emit("unexpected-response", n, b) || abortHandshake(e, n, `Unexpected server response: ${b.statusCode}`);
  });
  n.on("upgrade", (f, b, l) => {
    if ((e.emit("upgrade", f), e.readyState !== WebSocket.CONNECTING)) return;
    n = e._req = null;
    const m = d("sha1")
      .update(w + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
      .digest("base64");
    if (f.headers["sec-websocket-accept"] !== m) {
      abortHandshake(e, b, "Invalid Sec-WebSocket-Accept header");
      return;
    }
    const g = f.headers["sec-websocket-protocol"];
    let c;
    if (
      (void 0 !== g ? (s.size ? s.has(g) || (c = "Server sent an invalid subprotocol") : (c = "Server sent a subprotocol but none was requested")) : s.size && (c = "Server sent no subprotocol"), c)
    ) {
      abortHandshake(e, b, c);
      return;
    }
    if (g) e._protocol = g;
    const j = f.headers["sec-websocket-extensions"];
    if (void 0 !== j) {
      if (!t) {
        const o = "Server sent a Sec-WebSocket-Extensions header but no extension was requested";
        abortHandshake(e, b, o);
        return;
      }
      let h;
      try {
        h = i(j);
      } catch (u) {
        const p = "Invalid Sec-WebSocket-Extensions header";
        abortHandshake(e, b, p);
        return;
      }
      const k = Object.keys(h);
      if (1 !== k.length || "permessage-deflate" !== k[0]) {
        const q = "Server indicated an extension that was not requested";
        abortHandshake(e, b, q);
        return;
      }
      try {
        t.accept(h["permessage-deflate"]);
      } catch (v) {
        const r = "Invalid Sec-WebSocket-Extensions header";
        abortHandshake(e, b, r);
        return;
      }
      e._extensions["permessage-deflate"] = t;
    }
    e.setSocket(b, l, { generateMask: a.generateMask, maxPayload: a.maxPayload, skipUTF8Validation: a.skipUTF8Validation });
  });
}
function emitErrorAndClose(a, b) {
  a._readyState = WebSocket.CLOSING;
  a.emit("error", b);
  a.emitClose();
}
function netConnect(a) {
  return (a.path = a.socketPath), net.connect(a);
}
function tlsConnect(a) {
  a.path = void 0;
  a.servername || "" === a.servername || (a.servername = net.isIP(a.host) ? "" : a.host);
  return tls.connect(a);
}
function abortHandshake(b, a, d) {
  b._readyState = WebSocket.CLOSING;
  const c = new Error(d);
  Error.captureStackTrace(c, abortHandshake);
  if (a.setHeader) {
    a.abort();
    if (a.socket && !a.socket.destroyed) a.socket.destroy();
    a.once("abort", b.emitClose.bind(b));
    b.emit("error", c);
  } else {
    a.destroy(c);
    a.once("error", b.emit.bind(b, "error"));
    a.once("close", b.emitClose.bind(b));
  }
}
function sendAfterClose(a, b, c) {
  if (b) {
    const { length: d } = toBuffer(b);
    if (a._socket) a._sender._bufferedBytes += d;
    else a._bufferedAmount += d;
  }
  if (c) {
    const e = new Error(`WebSocket is not open: readyState ${a.readyState} (${readyStates[a.readyState]})`);
    c(e);
  }
}
function receiverOnConclude(b, c) {
  const a = this[kWebSocket];
  a._closeFrameReceived = !0;
  a._closeMessage = c;
  a._closeCode = b;
  if (void 0 !== a._socket[kWebSocket]) {
    a._socket.removeListener("data", socketOnData);
    process.nextTick(resume, a._socket);
    if (1005 === b) a.close();
    else a.close(b, c);
  }
}
function receiverOnDrain() {
  const a = this[kWebSocket];
  a.isPaused || a._socket.resume();
}
function receiverOnError(b) {
  const a = this[kWebSocket];
  if (void 0 !== a._socket[kWebSocket]) {
    a._socket.removeListener("data", socketOnData);
    process.nextTick(resume, a._socket);
    a.close(b[kStatusCode]);
  }
  a.emit("error", b);
}
function receiverOnFinish() {
  this[kWebSocket].emitClose();
}
function receiverOnMessage(a, b) {
  this[kWebSocket].emit("message", a, b);
}
function receiverOnPing(b) {
  const a = this[kWebSocket];
  a.pong(b, !a._isServer, NOOP);
  a.emit("ping", b);
}
function receiverOnPong(a) {
  this[kWebSocket].emit("pong", a);
}
function resume(a) {
  a.resume();
}
function socketOnClose() {
  const a = this[kWebSocket];
  this.removeListener("close", socketOnClose);
  this.removeListener("data", socketOnData);
  this.removeListener("end", socketOnEnd);
  a._readyState = WebSocket.CLOSING;
  let b;
  this._readableState.endEmitted || a._closeFrameReceived || a._receiver._writableState.errorEmitted || null === (b = a._socket.read()) || a._receiver.write(b);
  a._receiver.end();
  this[kWebSocket] = void 0;
  clearTimeout(a._closeTimer);
  a._receiver._writableState.finished || a._receiver._writableState.errorEmitted ? a.emitClose() : (a._receiver.on("error", receiverOnFinish), a._receiver.on("finish", receiverOnFinish));
}
function socketOnData(a) {
  this[kWebSocket]._receiver.write(a) || this.pause();
}
function socketOnEnd() {
  const a = this[kWebSocket];
  a._readyState = WebSocket.CLOSING;
  a._receiver.end();
  this.end();
}
function socketOnError() {
  const a = this[kWebSocket];
  this.removeListener("error", socketOnError);
  this.on("error", NOOP);
  if (a) {
    a._readyState = WebSocket.CLOSING;
    this.destroy();
  }
}
Object.defineProperty(WebSocket, "CONNECTING", { enumerable: !0, value: readyStates.indexOf("CONNECTING") });
Object.defineProperty(WebSocket.prototype, "CONNECTING", { enumerable: !0, value: readyStates.indexOf("CONNECTING") });
Object.defineProperty(WebSocket, "OPEN", { enumerable: !0, value: readyStates.indexOf("OPEN") });
Object.defineProperty(WebSocket.prototype, "OPEN", { enumerable: !0, value: readyStates.indexOf("OPEN") });
Object.defineProperty(WebSocket, "CLOSING", { enumerable: !0, value: readyStates.indexOf("CLOSING") });
Object.defineProperty(WebSocket.prototype, "CLOSING", { enumerable: !0, value: readyStates.indexOf("CLOSING") });
Object.defineProperty(WebSocket, "CLOSED", { enumerable: !0, value: readyStates.indexOf("CLOSED") });
Object.defineProperty(WebSocket.prototype, "CLOSED", { enumerable: !0, value: readyStates.indexOf("CLOSED") });
["binaryType", "bufferedAmount", "extensions", "isPaused", "protocol", "readyState", "url"].forEach(a => {
  Object.defineProperty(WebSocket.prototype, a, { enumerable: !0 });
});
["open", "error", "close", "message"].forEach(a => {
  Object.defineProperty(WebSocket.prototype, `on${a}`, {
    enumerable: !0,
    get() {
      for (const b of this.listeners(a)) if (b[kForOnEventAttribute]) return b[kListener];
      return null;
    },
    set(b) {
      for (const c of this.listeners(a))
        if (c[kForOnEventAttribute]) {
          this.removeListener(a, c);
          break;
        }
      if ("function" == typeof b) this.addEventListener(a, b, { [kForOnEventAttribute]: !0 });
    }
  });
});
WebSocket.prototype.addEventListener = a;
WebSocket.prototype.removeEventListener = b;
module.exports = WebSocket;
