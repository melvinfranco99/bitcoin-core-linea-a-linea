/* Primitivas mínimas para los juegos. Implementadas a mano (sin dependencias)
 * para que puedas leerlas y compararlas con src/crypto/sha256.cpp y
 * src/crypto/ripemd160.cpp. */
(function () {
  "use strict";
  const C = {};

  C.hex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, "0")).join("");
  C.unhex = (h) => {
    h = (h || "").replace(/[^0-9a-fA-F]/g, "");
    if (h.length % 2) throw new Error("Número impar de dígitos hexadecimales");
    const out = new Uint8Array(h.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
    return out;
  };
  C.utf8 = (s) => new TextEncoder().encode(s);
  C.concat = (...arrs) => {
    const n = arrs.reduce((a, b) => a + b.length, 0);
    const out = new Uint8Array(n);
    let o = 0;
    for (const a of arrs) { out.set(a, o); o += a.length; }
    return out;
  };
  C.reverse = (u8) => Uint8Array.from(u8).reverse();
  C.le32 = (n) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n >>> 0, true); return b; };
  C.le64 = (n) => { const b = new Uint8Array(8); let v = BigInt(n); for (let i = 0; i < 8; i++) { b[i] = Number(v & 0xffn); v >>= 8n; } return b; };
  C.compactSize = (n) => {
    if (n < 253) return Uint8Array.of(n);
    if (n <= 0xffff) return Uint8Array.of(253, n & 255, (n >> 8) & 255);
    if (n <= 0xffffffff) return C.concat(Uint8Array.of(254), C.le32(n));
    return C.concat(Uint8Array.of(255), C.le64(n));
  };

  // ---------- SHA-256 (FIPS 180-4), igual que CSHA256 ----------
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  const W = new Uint32Array(64);
  C.sha256 = function (msg) {
    if (typeof msg === "string") msg = C.utf8(msg);
    const l = msg.length;
    const withPad = ((l + 9 + 63) >> 6) << 6;
    const m = new Uint8Array(withPad);
    m.set(msg);
    m[l] = 0x80;
    const bits = l * 8;
    const dv = new DataView(m.buffer);
    dv.setUint32(withPad - 4, bits >>> 0);
    dv.setUint32(withPad - 8, Math.floor(bits / 0x100000000));
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a,
        h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    for (let off = 0; off < withPad; off += 64) {
      for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const w15 = W[i - 15], w2 = W[i - 2];
        const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
        const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
      }
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let i = 0; i < 64; i++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + W[i]) | 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }
    const out = new Uint8Array(32);
    const o = new DataView(out.buffer);
    [h0, h1, h2, h3, h4, h5, h6, h7].forEach((v, i) => o.setUint32(i * 4, v >>> 0));
    return out;
  };
  C.sha256d = (m) => C.sha256(C.sha256(m));

  // ---------- RIPEMD-160 ----------
  const RL = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,7,4,13,1,10,6,15,3,12,0,9,5,2,14,11,8,3,10,14,4,9,15,8,1,2,7,0,6,13,11,5,12,1,9,11,10,0,8,12,4,13,3,7,15,14,5,6,2,4,0,5,9,7,12,2,10,14,1,3,8,11,6,15,13];
  const RR = [5,14,7,0,9,2,11,4,13,6,15,8,1,10,3,12,6,11,3,7,0,13,5,10,14,15,8,12,4,9,1,2,15,5,1,3,7,14,6,9,11,8,12,2,10,0,4,13,8,6,4,1,3,11,15,0,5,12,2,13,9,7,10,14,12,15,10,4,1,5,8,7,6,2,13,14,0,3,9,11];
  const SL = [11,14,15,12,5,8,7,9,11,13,14,15,6,7,9,8,7,6,8,13,11,9,7,15,7,12,15,9,11,7,13,12,11,13,6,7,14,9,13,15,14,8,13,6,5,12,7,5,11,12,14,15,14,15,9,8,9,14,5,6,8,6,5,12,9,15,5,11,6,8,13,12,5,12,13,14,11,8,5,6];
  const SR = [8,9,9,11,13,15,15,5,7,7,8,11,14,14,12,6,9,13,15,7,12,8,9,11,7,7,12,7,6,15,13,11,9,7,15,11,8,6,6,14,12,13,5,14,13,13,7,5,15,5,8,11,14,14,6,14,6,9,12,9,12,5,15,8,8,5,12,9,12,5,14,6,8,13,6,5,15,13,11,11];
  const KL = [0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e];
  const KR = [0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000];
  const rotl = (x, n) => (x << n) | (x >>> (32 - n));
  const f = (j, x, y, z) => j < 16 ? x ^ y ^ z : j < 32 ? (x & y) | (~x & z) : j < 48 ? (x | ~y) ^ z : j < 64 ? (x & z) | (y & ~z) : x ^ (y | ~z);
  C.ripemd160 = function (msg) {
    const l = msg.length;
    const withPad = ((l + 9 + 63) >> 6) << 6;
    const m = new Uint8Array(withPad);
    m.set(msg); m[l] = 0x80;
    const dv = new DataView(m.buffer);
    dv.setUint32(withPad - 8, (l * 8) >>> 0, true);
    dv.setUint32(withPad - 4, Math.floor(l * 8 / 0x100000000), true);
    let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
    const X = new Int32Array(16);
    for (let off = 0; off < withPad; off += 64) {
      for (let i = 0; i < 16; i++) X[i] = dv.getInt32(off + i * 4, true);
      let al = h0, bl = h1, cl = h2, dl = h3, el = h4, ar = h0, br = h1, cr = h2, dr = h3, er = h4;
      for (let j = 0; j < 80; j++) {
        const r = j >> 4;
        let t = (rotl((al + f(j, bl, cl, dl) + X[RL[j]] + KL[r]) | 0, SL[j]) + el) | 0;
        al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
        t = (rotl((ar + f(79 - j, br, cr, dr) + X[RR[j]] + KR[r]) | 0, SR[j]) + er) | 0;
        ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
      }
      const t = (h1 + cl + dr) | 0;
      h1 = (h2 + dl + er) | 0; h2 = (h3 + el + ar) | 0; h3 = (h4 + al + br) | 0; h4 = (h0 + bl + cr) | 0; h0 = t;
    }
    const out = new Uint8Array(20);
    const o = new DataView(out.buffer);
    [h0, h1, h2, h3, h4].forEach((v, i) => o.setUint32(i * 4, v >>> 0, true));
    return out;
  };
  C.hash160 = (m) => C.ripemd160(C.sha256(m));

  // ---------- Formato compacto nBits (arith_uint256::SetCompact/GetCompact) ----------
  C.setCompact = function (nCompact) {
    const nSize = nCompact >>> 24;
    let nWord = BigInt(nCompact & 0x007fffff);
    let v;
    if (nSize <= 3) v = nWord >> BigInt(8 * (3 - nSize));
    else v = nWord << BigInt(8 * (nSize - 3));
    const negative = nWord !== 0n && (nCompact & 0x00800000) !== 0;
    const overflow = nWord !== 0n && ((nSize > 34) || (nWord > 0xffn && nSize > 33) || (nWord > 0xffffn && nSize > 32));
    return { value: v, negative, overflow };
  };
  C.bits = (v) => v === 0n ? 0 : v.toString(2).length;
  C.getCompact = function (v) {
    let nSize = Math.floor((C.bits(v) + 7) / 8);
    let nCompact;
    if (nSize <= 3) nCompact = Number(v << BigInt(8 * (3 - nSize)));
    else nCompact = Number(v >> BigInt(8 * (nSize - 3)));
    if (nCompact & 0x00800000) { nCompact >>>= 8; nSize++; }
    return ((nCompact | (nSize << 24)) >>> 0);
  };
  C.hex256 = (v) => v.toString(16).padStart(64, "0");

  window.BTC = C;
})();
