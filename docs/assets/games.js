/* Juegos y simuladores interactivos. Cada <div class="game" data-game="X">
 * se convierte en un juego. Todos los cálculos son reales salvo que se diga
 * lo contrario (p. ej. las firmas del simulador de Script). */
(function () {
  "use strict";
  const B = window.BTC;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = window.esc;
  const META = window.BTC_META || {};
  const srcLink = (file, line, label) => `<a href="explorador.html#f=${file}&l=${line}">${label || file + ":" + line}</a>`;
  const fmtBTC = (sats) => (Number(sats) / 1e8).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 8 });

  function shell(el, icon, title, tag) {
    el.innerHTML = `<div class="game-head"><span class="icon">${icon}</span><h4>${esc(title)}</h4><span class="tag">${esc(tag || "Interactivo")}</span></div><div class="game-body"></div>`;
    return $(".game-body", el);
  }

  const GAMES = {};

  // =====================================================================
  // Nivel 0 · Verificar un archivo descargado
  // =====================================================================
  GAMES.fileverify = (el) => {
    const b = shell(el, "🔍", "Verifica tu descarga sin salir del navegador", "Herramienta real");
    b.innerHTML = `
      <p>Elige el archivo que has descargado (p. ej. <code>bitcoin-{{v}}-x86_64-linux-gnu.tar.gz</code> o el <code>.tar.gz</code> del código fuente) y pega el contenido de <code>SHA256SUMS</code>. El cálculo se hace <b>en tu ordenador</b>: el archivo no se sube a ningún sitio.</p>
      <div class="row"><input type="file" class="f"></div>
      <textarea class="sums" placeholder="Pega aquí SHA256SUMS (líneas «hash  nombre-de-archivo»)"></textarea>
      <div class="row"><button class="btn go" type="button">Calcular SHA-256 y comparar</button></div>
      <div class="out res">Esperando archivo…</div>`.replace("{{v}}", (META.tag || "").replace(/^v/, ""));
    $(".go", b).onclick = async () => {
      const f = $(".f", b).files[0];
      const out = $(".res", b);
      if (!f) { out.textContent = "Primero elige un archivo."; return; }
      out.textContent = `Leyendo ${f.name} (${(f.size / 1e6).toFixed(1)} MB)…`;
      const buf = await f.arrayBuffer();
      const h = B.hex(new Uint8Array(await crypto.subtle.digest("SHA-256", buf)));
      const sums = $(".sums", b).value;
      const line = sums.split("\n").find((l) => l.toLowerCase().includes(h));
      out.innerHTML = `SHA-256 de ${esc(f.name)}:\n${h}\n\n` + (sums.trim()
        ? (line ? `<span class="ok-t">✔ Coincide con la línea: ${esc(line.trim())}</span>` : `<span class="bad-t">✘ Este hash NO aparece en el SHA256SUMS pegado. No uses el archivo.</span>`)
        : "Pega SHA256SUMS para comparar.");
    };
  };

  // =====================================================================
  // Nivel 1 · SHA-256 y efecto avalancha
  // =====================================================================
  GAMES.hasher = (el) => {
    const b = shell(el, "#️⃣", "Laboratorio de hashes: cambia una letra y mira qué pasa", "Cálculo real");
    b.innerHTML = `
      <div class="row"><label>Texto A</label><input type="text" class="a" value="Bitcoin" style="flex:1"></div>
      <div class="row"><label>Texto B</label><input type="text" class="b2" value="bitcoin" style="flex:1"></div>
      <div class="out res"></div>
      <p class="small muted">Rojo = bits que cambian entre SHA-256(A) y SHA-256(B). Con una sola letra distinta cambia ~la mitad (≈128 de 256): es el <b>efecto avalancha</b>. Por eso nadie puede «apuntar» a un hash concreto: sólo queda probar (minar).</p>
      <div class="hashbits bits"></div>`;
    const run = () => {
      const a = $(".a", b).value, c = $(".b2", b).value;
      const ha = B.sha256(a), hb = B.sha256(c);
      const hda = B.sha256d(B.utf8(a));
      let diff = 0, bitsHtml = "";
      for (let i = 0; i < 32; i++) {
        for (let k = 7; k >= 0; k--) {
          const x = (ha[i] >> k) & 1, y = (hb[i] >> k) & 1;
          if (x !== y) diff++;
          bitsHtml += x !== y ? `<span class="d">${y}</span>` : y;
        }
        bitsHtml += i % 8 === 7 ? "<br>" : " ";
      }
      $(".res", b).innerHTML = `SHA256(A)        = ${B.hex(ha)}\nSHA256(B)        = ${B.hex(hb)}\nSHA256(SHA256(A)) = ${B.hex(hda)}   ← así hashea Bitcoin (CHash256)\nHASH160(A)       = ${B.hex(B.hash160(B.utf8(a)))}   ← RIPEMD160(SHA256(A))\n\nBits distintos: <b>${diff} de 256</b> (${(diff / 2.56).toFixed(1)} %)`;
      $(".bits", b).innerHTML = bitsHtml;
    };
    $(".a", b).oninput = run; $(".b2", b).oninput = run; run();
  };

  // =====================================================================
  // Nivel 1 · CompactSize y little-endian
  // =====================================================================
  GAMES.compactsize = (el) => {
    const b = shell(el, "🔢", "Codificador CompactSize y little-endian", "Cálculo real");
    b.innerHTML = `
      <div class="row"><label>Número</label><input type="number" class="n" value="300" min="0" style="width:200px">
      <button class="btn sec" data-v="100" type="button">100</button><button class="btn sec" data-v="252" type="button">252</button><button class="btn sec" data-v="253" type="button">253</button><button class="btn sec" data-v="70000" type="button">70 000</button><button class="btn sec" data-v="5000000000" type="button">5 000 000 000</button></div>
      <div class="out res"></div>`;
    const run = () => {
      let n = Number($(".n", b).value || 0);
      if (n < 0) n = 0;
      const cs = B.compactSize(n);
      const be = BigInt(n).toString(16).padStart(n > 0xffffffff ? 16 : 8, "0");
      let rule = n < 253 ? "n < 253 → 1 byte con el propio valor (ser_writedata8)" : n <= 0xffff ? "n ≤ 0xFFFF → byte 253 (0xfd) + 2 bytes little-endian" : n <= 0xffffffff ? "n ≤ 0xFFFFFFFF → byte 254 (0xfe) + 4 bytes little-endian" : "resto → byte 255 (0xff) + 8 bytes little-endian";
      $(".res", b).innerHTML = `Valor en hexadecimal «humano» (big-endian): 0x${be}\nComo uint32/uint64 en Bitcoin (little-endian): ${B.hex(n > 0xffffffff ? B.le64(n) : B.le32(n))}\n\nCompactSize: <b>${B.hex(cs)}</b>  (${cs.length} byte${cs.length > 1 ? "s" : ""})\nRegla aplicada: ${rule}` + (n > 0x02000000 ? `\n\n⚠ Al LEER un tamaño de vector, ReadCompactSize rechaza valores > MAX_SIZE (0x02000000 = 33 554 432).` : "");
    };
    $(".n", b).oninput = run;
    $$("button[data-v]", b).forEach((x) => (x.onclick = () => { $(".n", b).value = x.dataset.v; run(); }));
    run();
  };

  // =====================================================================
  // Nivel 2 · Curva elíptica de juguete (misma ecuación que secp256k1)
  // =====================================================================
  GAMES.ec = (el) => {
    const b = shell(el, "➰", "Curva elíptica de juguete: y² = x³ + 7 (la misma forma que secp256k1)", "Matemática real, números pequeños");
    // buscar un primo p con número de puntos primo
    const isPrime = (n) => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
    const mod = (a, m) => ((a % m) + m) % m;
    const inv = (a, m) => { a = mod(a, m); let [t, nt, r, nr] = [0, 1, m, a]; while (nr) { const q = Math.floor(r / nr); [t, nt] = [nt, t - q * nt]; [r, nr] = [nr, r - q * nr]; } return mod(t, m); };
    let p = 0, pts = [];
    for (const cand of [79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223]) {
      const list = [];
      for (let x = 0; x < cand; x++) for (let y = 0; y < cand; y++) if (mod(y * y - (x * x * x + 7), cand) === 0) list.push([x, y]);
      if (isPrime(list.length + 1)) { p = cand; pts = list; break; }
    }
    const n = pts.length + 1; // + punto en el infinito
    const add = (P, Q) => {
      if (!P) return Q; if (!Q) return P;
      if (P[0] === Q[0] && mod(P[1] + Q[1], p) === 0) return null;
      let l;
      if (P[0] === Q[0] && P[1] === Q[1]) l = mod(3 * P[0] * P[0] * inv(2 * P[1], p), p);
      else l = mod((Q[1] - P[1]) * inv(Q[0] - P[0], p), p);
      const x = mod(l * l - P[0] - Q[0], p);
      return [x, mod(l * (P[0] - x) - P[1], p)];
    };
    const mul = (k, P) => { let R = null, A = P; const steps = []; k = mod(k, n); let bit = 0; while (k > 0) { if (k & 1) { R = add(R, A); steps.push(`bit ${bit}=1 → R = R + ${2 ** bit}·G = ${fmt(R)}`); } A = add(A, A); k >>= 1; bit++; } return { R, steps }; };
    const fmt = (P) => P ? `(${P[0]}, ${P[1]})` : "∞";
    const G = pts.find((q) => q[1] !== 0);
    b.innerHTML = `
      <p>Sobre el cuerpo finito de <b>p = ${p}</b> la curva tiene <b>${n}</b> puntos (contando el «infinito»), un número primo, igual que en secp256k1 (allí p ≈ 2²⁵⁶). Generador elegido: <b>G = ${fmt(G)}</b>.</p>
      <div class="row"><label>Clave privada k (1…${n - 1})</label><input type="range" class="k" min="1" max="${n - 1}" value="7" style="flex:1"><b class="kv mono"></b></div>
      <div class="svgbox"><svg class="plot" viewBox="0 0 ${p + 10} ${p + 10}" style="max-height:420px;width:100%"></svg></div>
      <div class="out res"></div>
      <h4>Firma Schnorr de juguete (BIP340 simplificado)</h4>
      <div class="row"><label>Mensaje</label><input type="text" class="msg" value="págame 1 BTC" style="flex:1"><label>nonce r</label><input type="number" class="r" value="5" min="1" max="${n - 1}" style="width:80px"></div>
      <div class="out sig"></div>`;
    const svg = $(".plot", b);
    const H = (s) => { const h = B.sha256(s); return ((h[0] << 8) | h[1]) % n; };
    const draw = () => {
      const k = Number($(".k", b).value);
      $(".kv", b).textContent = k;
      const { R: P, steps } = mul(k, G);
      let s = `<rect x="0" y="0" width="${p + 10}" height="${p + 10}" fill="none"/>`;
      for (const q of pts) {
        const isG = q[0] === G[0] && q[1] === G[1];
        const isP = P && q[0] === P[0] && q[1] === P[1];
        s += `<circle cx="${q[0] + 5}" cy="${p + 5 - q[1]}" r="${isG || isP ? 2.4 : 1.1}" fill="${isP ? "#e5484d" : isG ? "#0090ff" : "currentColor"}" opacity="${isG || isP ? 1 : .55}"/>`;
      }
      if (P) s += `<text x="${P[0] + 8}" y="${p + 5 - P[1]}" font-size="5" fill="#e5484d">P = k·G</text>`;
      s += `<text x="${G[0] + 8}" y="${p + 5 - G[1]}" font-size="5" fill="#0090ff">G</text>`;
      svg.innerHTML = s;
      svg.style.color = "var(--muted)";
      $(".res", b).innerHTML = `Clave pública P = ${k}·G = <b>${fmt(P)}</b>\n\nCálculo por «doblar y sumar» (lo que hace secp256k1 con 256 bits):\n${steps.join("\n")}\n\nIr de P a k exige probar los ${n - 1} valores. Con ${n - 1} es trivial; con ~2²⁵⁶ es imposible: esa es toda la seguridad.`;
      // Schnorr
      const r = Number($(".r", b).value) || 1;
      const Rp = mul(r, G).R;
      const m = $(".msg", b).value;
      const e = H(`${fmt(Rp)}|${fmt(P)}|${m}`);
      const sg = mod(r + e * k, n);
      const left = mul(sg, G).R;
      const right = add(Rp, mul(e, P).R);
      const ok = fmt(left) === fmt(right);
      $(".sig", b).innerHTML = `Firmante (conoce k=${k}):  R = r·G = ${fmt(Rp)}\n  e = H(R ‖ P ‖ mensaje) mod ${n} = ${e}\n  s = r + e·k mod ${n} = ${sg}\n  Firma = (R, s)\n\nVerificador (sólo conoce P, mensaje y la firma):\n  s·G     = ${fmt(left)}\n  R + e·P = ${fmt(right)}\n  ${ok ? '<span class="ok-t">✔ Iguales: firma válida</span>' : '<span class="bad-t">✘ Distintos</span>'}\n\nCambia el mensaje: e cambia y la misma s ya no serviría. Reutilizar r con dos mensajes revela k (por eso secp256k1 genera r de forma determinista, RFC6979 / BIP340).`;
    };
    $(".k", b).oninput = draw; $(".msg", b).oninput = draw; $(".r", b).oninput = draw;
    draw();
  };

  // =====================================================================
  // Nivel 2 · Base58Check
  // =====================================================================
  const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  function b58decode(s) {
    let n = 0n;
    for (const c of s) { const i = B58.indexOf(c); if (i < 0) throw new Error(`Carácter no válido en Base58: «${c}»`); n = n * 58n + BigInt(i); }
    let hex = n.toString(16); if (hex.length % 2) hex = "0" + hex;
    let lead = 0; for (const c of s) { if (c === "1") lead++; else break; }
    return B.concat(new Uint8Array(lead), n === 0n ? new Uint8Array(0) : B.unhex(hex));
  }
  function b58encode(u8) {
    let n = BigInt("0x" + (B.hex(u8) || "0")); let s = "";
    while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
    for (const x of u8) { if (x === 0) s = "1" + s; else break; }
    return s;
  }
  GAMES.base58 = (el) => {
    const b = shell(el, "🏷️", "De clave pública a dirección (y vuelta): Base58Check", "Cálculo real");
    const GEN_PUB = "04678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5f";
    b.innerHTML = `
      <p>Por defecto: la clave pública del bloque génesis, copiada de <code>src/kernel/chainparams.cpp</code>. Calculamos su dirección paso a paso.</p>
      <div class="row"><label>Clave pública (hex)</label><input type="text" class="pk mono" value="${GEN_PUB}" style="flex:1"></div>
      <div class="out res"></div>
      <div class="row"><label>…o decodifica una dirección</label><input type="text" class="ad mono" value="1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa" style="flex:1"></div>
      <div class="out res2"></div>`;
    const run = () => {
      try {
        const pk = B.unhex($(".pk", b).value);
        const h160 = B.hash160(pk);
        const payload = B.concat(Uint8Array.of(0), h160);
        const chk = B.sha256d(payload).slice(0, 4);
        const addr = b58encode(B.concat(payload, chk));
        $(".res", b).innerHTML = `1. SHA-256(pubkey)            = ${B.hex(B.sha256(pk))}\n2. RIPEMD-160(paso 1) = HASH160 = <b>${B.hex(h160)}</b>\n3. Prefijo de versión (base58Prefixes[PUBKEY_ADDRESS] = 0) + HASH160 = ${B.hex(payload)}\n4. Checksum = primeros 4 bytes de SHA256d(paso 3) = ${B.hex(chk)}\n5. Base58(paso 3 + checksum) = <b>${addr}</b>`;
      } catch (e) { $(".res", b).textContent = "Error: " + e.message; }
      try {
        const raw = b58decode($(".ad", b).value.trim());
        if (raw.length < 5) throw new Error("demasiado corta");
        const payload = raw.slice(0, -4), chk = raw.slice(-4);
        const good = B.hex(B.sha256d(payload).slice(0, 4)) === B.hex(chk);
        const ver = payload[0];
        const kind = ver === 0 ? "P2PKH (mainnet, empieza por 1)" : ver === 5 ? "P2SH (mainnet, empieza por 3)" : ver === 111 ? "P2PKH testnet" : ver === 196 ? "P2SH testnet" : ver === 128 ? "clave privada WIF" : "desconocido";
        $(".res2", b).innerHTML = `Bytes: ${B.hex(raw)}\nVersión: ${ver} → ${kind}\nCarga (hash): ${B.hex(payload.slice(1))}\nChecksum: ${B.hex(chk)} → ${good ? '<span class="ok-t">✔ correcto</span>' : '<span class="bad-t">✘ incorrecto (dirección mal escrita)</span>'}`;
      } catch (e) { $(".res2", b).textContent = "Error: " + e.message; }
    };
    $(".pk", b).oninput = run; $(".ad", b).oninput = run; run();
  };

  // =====================================================================
  // Transacciones: decodificador
  // =====================================================================
  function genesisTx() {
    const ts = B.utf8("The Times 03/Jan/2009 Chancellor on brink of second bailout for banks");
    const scriptSig = B.concat(Uint8Array.of(4), B.unhex("ffff001d"), Uint8Array.of(1, 4), Uint8Array.of(ts.length), ts);
    const pub = B.unhex("04678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5f");
    const spk = B.concat(Uint8Array.of(0x41), pub, Uint8Array.of(0xac));
    return B.concat(B.le32(1), B.compactSize(1), new Uint8Array(32), B.le32(0xffffffff), B.compactSize(scriptSig.length), scriptSig, B.le32(0xffffffff),
      B.compactSize(1), B.le64(5000000000), B.compactSize(spk.length), spk, B.le32(0));
  }
  window.genesisTx = genesisTx;

  function parseTx(u8) {
    let o = 0;
    const segs = [];
    const need = (n) => { if (o + n > u8.length) throw new Error(`Fin inesperado de datos en el byte ${o} (se necesitaban ${n} más)`); };
    const take = (n, label, cls, info) => { need(n); const s = u8.slice(o, o + n); segs.push({ label, cls, hex: B.hex(s), info, start: o }); o += n; return s; };
    const u32 = (s) => new DataView(s.buffer, s.byteOffset, 4).getUint32(0, true);
    const readCS = (label) => {
      need(1);
      const first = u8[o];
      let len = 1, v = first;
      if (first === 253) len = 3; else if (first === 254) len = 5; else if (first === 255) len = 9;
      need(len);
      if (len > 1) { v = 0; for (let i = len - 1; i >= 1; i--) v = v * 256 + u8[o + i]; }
      take(len, label, "c6", `CompactSize = ${v}`);
      return v;
    };
    const tx = { vin: [], vout: [] };
    tx.version = u32(take(4, "versión", "c1", ""));
    segs[segs.length - 1].info = `uint32 LE = ${tx.version}`;
    let flags = 0;
    if (u8[o] === 0 && u8[o + 1] !== 0) {
      take(1, "marcador", "c5", "0x00: «vin vacío» falso → indica formato extendido (SegWit)");
      flags = take(1, "flags", "c5", "")[0];
      segs[segs.length - 1].info = `flags = ${flags} (bit 1 = hay testigos)`;
      if (flags & ~1) throw new Error("Unknown transaction optional data (flags desconocidos)");
    }
    const nin = readCS("nº entradas");
    for (let i = 0; i < nin; i++) {
      const h = take(32, `entrada ${i}: txid previo`, "c2", "");
      segs[segs.length - 1].info = "mostrado al revés: " + B.hex(B.reverse(h));
      const n = u32(take(4, `entrada ${i}: índice`, "c2", ""));
      segs[segs.length - 1].info = n === 0xffffffff ? "0xffffffff (coinbase: no gasta nada)" : `vout = ${n}`;
      const sl = readCS(`entrada ${i}: long. scriptSig`);
      const ss = take(sl, `entrada ${i}: scriptSig`, "c3", "");
      const seq = u32(take(4, `entrada ${i}: nSequence`, "c2", ""));
      segs[segs.length - 1].info = `0x${seq.toString(16)}` + (seq === 0xffffffff ? " (SEQUENCE_FINAL)" : "");
      tx.vin.push({ txid: B.hex(B.reverse(h)), n, scriptSig: B.hex(ss), seq, witness: [] });
    }
    const nout = readCS("nº salidas");
    for (let i = 0; i < nout; i++) {
      const v = take(8, `salida ${i}: valor`, "c4", "");
      let val = 0n; for (let k = 7; k >= 0; k--) val = val * 256n + BigInt(v[k]);
      segs[segs.length - 1].info = `${val} sats = ${fmtBTC(val)} BTC`;
      const sl = readCS(`salida ${i}: long. scriptPubKey`);
      const spk = take(sl, `salida ${i}: scriptPubKey`, "c3", "");
      segs[segs.length - 1].info = classify(spk);
      tx.vout.push({ value: val, spk: B.hex(spk) });
    }
    if (flags & 1) {
      for (let i = 0; i < nin; i++) {
        const items = readCS(`testigo ${i}: nº elementos`);
        for (let j = 0; j < items; j++) {
          const l = readCS(`testigo ${i}.${j}: longitud`);
          tx.vin[i].witness.push(B.hex(take(l, `testigo ${i}.${j}`, "c5", "")));
        }
      }
    }
    if ((flags & 1) && tx.vin.every((v) => !v.witness.length)) throw new Error("Superfluous witness record (todos los testigos vacíos)");
    tx.locktime = u32(take(4, "nLockTime", "c1", ""));
    segs[segs.length - 1].info = tx.locktime === 0 ? "0 (sin bloqueo)" : tx.locktime < 500000000 ? `altura de bloque ${tx.locktime}` : `tiempo UNIX ${tx.locktime}`;
    if (o !== u8.length) throw new Error(`Sobran ${u8.length - o} bytes al final`);
    // txid = hash sin testigos
    const noWit = flags ? B.concat(u8.slice(0, 4), u8.slice(6, segs.find((s) => s.label.startsWith("testigo"))?.start ?? (u8.length - 4)), u8.slice(u8.length - 4)) : u8;
    tx.txid = B.hex(B.reverse(B.sha256d(noWit)));
    tx.wtxid = B.hex(B.reverse(B.sha256d(u8)));
    tx.size = u8.length;
    tx.base = noWit.length;
    tx.weight = noWit.length * 3 + u8.length;
    return { tx, segs };
  }
  function classify(spk) {
    const h = B.hex(spk);
    if (spk.length === 25 && h.startsWith("76a914") && h.endsWith("88ac")) return "P2PKH: OP_DUP OP_HASH160 <20 bytes> OP_EQUALVERIFY OP_CHECKSIG";
    if (spk.length === 23 && h.startsWith("a914") && h.endsWith("87")) return "P2SH: OP_HASH160 <20 bytes> OP_EQUAL";
    if (spk.length === 22 && h.startsWith("0014")) return "P2WPKH: OP_0 <20 bytes> (SegWit v0)";
    if (spk.length === 34 && h.startsWith("0020")) return "P2WSH: OP_0 <32 bytes> (SegWit v0)";
    if (spk.length === 34 && h.startsWith("5120")) return "P2TR: OP_1 <32 bytes> (Taproot, SegWit v1)";
    if ((spk.length === 67 || spk.length === 35) && h.endsWith("ac")) return "P2PK: <clave pública> OP_CHECKSIG (estilo antiguo, como el génesis)";
    if (spk[0] === 0x6a) return "OP_RETURN: salida no gastable para datos";
    return "script no estándar";
  }
  window.parseTx = parseTx;

  GAMES.txdecoder = (el) => {
    const b = shell(el, "🧾", "Decodificador de transacciones (UnserializeTransaction a mano)", "Cálculo real");
    const presets = {
      "Coinbase del bloque génesis": B.hex(genesisTx()),
      "SegWit P2WPKH (de src/test/data/tx_valid.json)": "0100000000010100010000000000000000000000000000000000000000000000000000000000000000000000ffffffff01e8030000000000001976a9144c9c3dfac4207d5d8cb89df5722cb3d712385e3f88ac02483045022100cfb07164b36ba64c1b1e8c7720a56ad64d96f6ef332d3d37f9cb3c96477dc44502200a464cd7a9cf94cd70f66ce4f4f0625ef650052c7afcfe29d7d7e01830ff91ed012103596d3451025c19dbbdeb932d6bf8bfb4ad499b95b6f88db8899efac102e5fc7100000000",
      "Multifirma 2009 (de src/test/data/tx_valid.json)": "0100000001b14bdcbc3e01bdaad36cc08e81e69c82e1060bc14e518db2b49aa43ad90ba26000000000490047304402203f16c6f40162ab686621ef3000b04e75418a0c0cb2d8aebeac894ae360ac1e780220ddc15ecdfc3507ac48e1681a33eb60996631bf6bf5bc0a0682c4db743ce7ca2b01ffffffff0140420f00000000001976a914660d4ef3a743e3e696ad990364e555c271ad504b88ac00000000",
    };
    b.innerHTML = `
      <div class="row">${Object.keys(presets).map((k, i) => `<button class="btn sec" data-i="${i}" type="button">${esc(k)}</button>`).join("")}</div>
      <textarea class="hex" spellcheck="false"></textarea>
      <p class="small muted">Puedes pegar cualquier transacción en hexadecimal (p. ej. la salida de <code>bitcoin-cli getrawtransaction &lt;txid&gt;</code> en tu propio nodo).</p>
      <div class="bytes segs"></div><div class="out res"></div>`;
    const run = () => {
      try {
        const u8 = B.unhex($(".hex", b).value);
        const { tx, segs } = parseTx(u8);
        $(".segs", b).innerHTML = segs.map((s) => `<div class="seg ${s.cls}" title="${esc(s.info || "")}"><b>${esc(s.label)}</b>${s.hex.length > 72 ? s.hex.slice(0, 64) + "…(" + s.hex.length / 2 + " B)" : s.hex || "∅"}${s.info ? `<br><span class="small">${esc(s.info)}</span>` : ""}</div>`).join("");
        $(".res", b).innerHTML = `txid  = <b>${tx.txid}</b>   (SHA256d sin testigos, mostrado al revés)\nwtxid = ${tx.wtxid}\nTamaño: ${tx.size} bytes · sin testigos: ${tx.base} bytes · peso = 3·${tx.base} + ${tx.size} = <b>${tx.weight} WU</b> · vsize = ${Math.ceil(tx.weight / 4)} vB\nEntradas: ${tx.vin.length} · Salidas: ${tx.vout.length} · Suma salidas: ${fmtBTC(tx.vout.reduce((a, v) => a + v.value, 0n))} BTC`;
      } catch (e) { $(".segs", b).innerHTML = ""; $(".res", b).innerHTML = `<span class="bad-t">Error de deserialización: ${esc(e.message)}</span>\n(El nodo real lanzaría std::ios_base::failure y descartaría el mensaje.)`; }
    };
    $$("button[data-i]", b).forEach((x) => (x.onclick = () => { $(".hex", b).value = Object.values(presets)[x.dataset.i]; run(); }));
    $(".hex", b).oninput = run;
    $(".hex", b).value = Object.values(presets)[1];
    run();
  };

  // =====================================================================
  // UTXO: crea transacciones, valídalas, mina y deshaz bloques
  // =====================================================================
  GAMES.utxo = (el) => {
    const b = shell(el, "🪙", "El juego del UTXO: gasta, valida, mina y deshaz", "Reglas reales, datos simulados");
    let height = 120, seq = 0;
    const mk = (v, who, h, cb) => ({ id: `${(++seq).toString(16).padStart(4, "0")}…:0`, v, who, h, cb });
    let utxo = [mk(5000000000, "Ana", 5, true), mk(250000000, "Ana", 100, false), mk(120000000, "Beto", 110, false), mk(312500000, "Minera", 60, true), mk(312500000, "Minera", 119, true)];
    let blocks = []; // {undo:[coins], created:[ids]}
    let sel = new Set();
    const ref = (name) => ({
      "bad-txns-vin-empty": ["src/consensus/tx_check.cpp", 15], "bad-txns-vout-empty": ["src/consensus/tx_check.cpp", 17],
      "bad-txns-vout-negative": ["src/consensus/tx_check.cpp", 28], "bad-txns-vout-toolarge": ["src/consensus/tx_check.cpp", 30],
      "bad-txns-txouttotal-toolarge": ["src/consensus/tx_check.cpp", 33], "bad-txns-inputs-duplicate": ["src/consensus/tx_check.cpp", 44],
      "bad-txns-inputs-missingorspent": ["src/consensus/tx_verify.cpp", 168], "bad-txns-premature-spend-of-coinbase": ["src/consensus/tx_verify.cpp", 180],
      "bad-txns-in-belowout": ["src/consensus/tx_verify.cpp", 197],
    }[name]);
    b.innerHTML = `
      <p>Cada ficha es un <b>Coin</b> del conjunto UTXO (salida no gastada) con su valor, dueño y altura. Selecciona entradas, escribe salidas y valida. Las comprobaciones siguen el mismo orden y devuelven los mismos códigos de error que <code>CheckTransaction</code> y <code>Consensus::CheckTxInputs</code>.</p>
      <div class="row"><b>Altura actual: <span class="h"></span></b></div>
      <div class="coins cs"></div>
      <div class="row"><label>Salidas (BTC, separadas por comas)</label><input type="text" class="outs mono" value="1.5, 0.99" style="flex:1"></div>
      <div class="row"><label><input type="checkbox" class="dup"> Trampa: repetir la primera entrada</label><label><input type="checkbox" class="ghost"> Trampa: gastar una moneda que no existe</label></div>
      <div class="row"><button class="btn val" type="button">Validar transacción</button><button class="btn sec mine" type="button">Minar bloque con ella</button><button class="btn sec empty" type="button">Minar bloque vacío (+1 altura)</button><button class="btn sec undo" type="button">↶ Desconectar último bloque</button></div>
      <div class="out res">Selecciona monedas…</div>
      <div class="log lg"></div>`;
    const log = (s) => { const d = document.createElement("div"); d.innerHTML = s; $(".lg", b).prepend(d); };
    const render = () => {
      $(".h", b).textContent = height;
      $(".cs", b).innerHTML = utxo.map((c, i) => `<div class="coin ${sel.has(c.id) ? "sel" : ""}" data-id="${c.id}"><b>${fmtBTC(c.v)} BTC</b> · ${esc(c.who)}${c.cb ? " · coinbase" : ""}<small>${c.id} · altura ${c.h}</small></div>`).join("") || "<i>UTXO vacío</i>";
      $$(".coin", b).forEach((x) => (x.onclick = () => { sel.has(x.dataset.id) ? sel.delete(x.dataset.id) : sel.add(x.dataset.id); render(); }));
    };
    const buildTx = () => {
      const vin = [...sel];
      if ($(".dup", b).checked && vin.length) vin.push(vin[0]);
      if ($(".ghost", b).checked) vin.push("dead…:7");
      const vout = $(".outs", b).value.split(",").map((s) => s.trim()).filter(Boolean).map((s) => Math.round(parseFloat(s) * 1e8));
      return { vin, vout };
    };
    const validate = (tx) => {
      const MAX = 21000000 * 1e8;
      const fail = (r) => ({ ok: false, r });
      if (!tx.vin.length) return fail("bad-txns-vin-empty");
      if (!tx.vout.length) return fail("bad-txns-vout-empty");
      let out = 0;
      for (const v of tx.vout) {
        if (isNaN(v) || v < 0) return fail("bad-txns-vout-negative");
        if (v > MAX) return fail("bad-txns-vout-toolarge");
        out += v; if (out > MAX) return fail("bad-txns-txouttotal-toolarge");
      }
      if (new Set(tx.vin).size !== tx.vin.length) return fail("bad-txns-inputs-duplicate");
      const coins = tx.vin.map((id) => utxo.find((c) => c.id === id));
      if (coins.some((c) => !c)) return fail("bad-txns-inputs-missingorspent");
      for (const c of coins) if (c.cb && (height + 1) - c.h < 100) return { ok: false, r: "bad-txns-premature-spend-of-coinbase", extra: `profundidad ${(height + 1) - c.h} < COINBASE_MATURITY (100)` };
      const inn = coins.reduce((a, c) => a + c.v, 0);
      if (inn < out) return { ok: false, r: "bad-txns-in-belowout", extra: `entradas ${fmtBTC(inn)} < salidas ${fmtBTC(out)}` };
      return { ok: true, fee: inn - out, coins };
    };
    const show = (res) => {
      if (res.ok) $(".res", b).innerHTML = `<span class="ok-t">✔ Válida.</span> Comisión implícita = entradas − salidas = <b>${fmtBTC(res.fee)} BTC</b> (se la queda el minero).`;
      else { const [f, l] = ref(res.r); $(".res", b).innerHTML = `<span class="bad-t">✘ Rechazada: ${res.r}</span>${res.extra ? " — " + res.extra : ""}\nRegla en ${srcLink(f, l)}`; }
    };
    $(".val", b).onclick = () => show(validate(buildTx()));
    $(".mine", b).onclick = () => {
      const tx = buildTx(); const res = validate(tx); show(res);
      if (!res.ok) return;
      height++;
      const undo = res.coins.slice();
      utxo = utxo.filter((c) => !tx.vin.includes(c.id));
      const created = [];
      const txid = (++seq).toString(16).padStart(4, "0");
      tx.vout.forEach((v, i) => { const c = { id: `${txid}…:${i}`, v, who: "Destino", h: height, cb: false }; utxo.push(c); created.push(c.id); });
      const cbc = { id: `${(++seq).toString(16).padStart(4, "0")}…:0`, v: 312500000 + res.fee, who: "Minera", h: height, cb: true };
      utxo.push(cbc); created.push(cbc.id);
      blocks.push({ undo, created, height });
      sel.clear();
      log(`⛏ Bloque ${height}: UpdateCoins → gastadas ${undo.length} monedas (guardadas en rev*.dat como undo), creadas ${created.length}. Coinbase = subsidio 3,125 + comisión ${fmtBTC(res.fee)}.`);
      render();
    };
    $(".empty", b).onclick = () => {
      height++;
      const cbc = { id: `${(++seq).toString(16).padStart(4, "0")}…:0`, v: 312500000, who: "Minera", h: height, cb: true };
      utxo.push(cbc); blocks.push({ undo: [], created: [cbc.id], height });
      log(`⛏ Bloque ${height} vacío: sólo la coinbase.`); render();
    };
    $(".undo", b).onclick = () => {
      const blk = blocks.pop();
      if (!blk) { log("No hay bloques que desconectar."); return; }
      utxo = utxo.filter((c) => !blk.created.includes(c.id));
      utxo.push(...blk.undo);
      height--;
      log(`↶ DisconnectBlock ${blk.height}: borradas ${blk.created.length} salidas creadas y restauradas ${blk.undo.length} monedas desde los datos de deshacer.`);
      render();
    };
    render();
  };

  // =====================================================================
  // Nivel 4 · Máquina de Script paso a paso
  // =====================================================================
  GAMES.script = (el) => {
    const b = shell(el, "⚙️", "Máquina de Script paso a paso", "Lógica real · firmas simuladas");
    const pubkey = "02a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc";
    const pkh = B.hex(B.hash160(B.unhex(pubkey)));
    const fakeSig = (pk) => "30" + B.hex(B.sha256(B.concat(B.utf8("firma"), B.unhex(pk)))).slice(0, 14) + "01";
    const presets = {
      "P2PKH (pago a una dirección clásica)": [`<${fakeSig(pubkey)}> <${pubkey}>`, `OP_DUP OP_HASH160 <${pkh}> OP_EQUALVERIFY OP_CHECKSIG`],
      "P2PKH con clave equivocada": [`<${fakeSig(pubkey)}> <03${"11".repeat(32)}>`, `OP_DUP OP_HASH160 <${pkh}> OP_EQUALVERIFY OP_CHECKSIG`],
      "Acertijo: 2 + 3 = 5": ["2 3", "OP_ADD 5 OP_EQUAL"],
      "Candado de hash (como en Lightning)": [`"secreto"`, `OP_SHA256 <${B.hex(B.sha256("secreto"))}> OP_EQUAL`],
      "IF / ELSE": ["1", "OP_IF 10 OP_ELSE 20 OP_ENDIF 10 OP_EQUAL"],
      "OP_RETURN (no gastable)": ["1", `OP_RETURN <${B.hex(B.utf8("hola"))}>`],
      "Opcode desactivado (OP_MUL)": ["3 4", "OP_MUL 12 OP_EQUAL"],
    };
    b.innerHTML = `
      <div class="row">${Object.keys(presets).map((k, i) => `<button class="btn sec" data-i="${i}" type="button">${esc(k)}</button>`).join("")}</div>
      <div class="row"><label style="width:150px">scriptSig (desbloqueo)</label><input type="text" class="ss mono" style="flex:1"></div>
      <div class="row"><label style="width:150px">scriptPubKey (candado)</label><input type="text" class="sp mono" style="flex:1"></div>
      <p class="small muted">Formato: opcodes (<code>OP_DUP</code>), números (<code>5</code>), datos hex entre <code>&lt;…&gt;</code> o texto entre comillas. En este simulador una firma es «válida» si es <code>30 ‖ SHA256("firma" ‖ pubkey)[0..7] ‖ 01</code>; en el nodo real se verifica ECDSA/Schnorr con libsecp256k1.</p>
      <div class="row"><button class="btn sec reset" type="button">⟲ Reiniciar</button><button class="btn step" type="button">Paso ▶</button><button class="btn sec run" type="button">Ejecutar todo ⏩</button></div>
      <div class="ops opsv"></div>
      <div class="stack-wrap">
        <div><div class="stackbox-title">Pila principal (stack)</div><div class="stackbox st"></div></div>
        <div><div class="stackbox-title">Pila alternativa (altstack)</div><div class="stackbox alt"></div></div>
        <div><div class="stackbox-title">Condiciones (vfExec)</div><div class="stackbox cond"></div></div>
      </div>
      <div class="out res"></div>`;
    // --- CScriptNum ---
    const numEnc = (n) => {
      if (n === 0) return new Uint8Array(0);
      const neg = n < 0; let a = Math.abs(n); const out = [];
      while (a) { out.push(a & 0xff); a = Math.floor(a / 256); }
      if (out[out.length - 1] & 0x80) out.push(neg ? 0x80 : 0); else if (neg) out[out.length - 1] |= 0x80;
      return Uint8Array.from(out);
    };
    const numDec = (u8) => {
      if (u8.length > 4) throw "SCRIPT_ERR_UNKNOWN_ERROR (número de más de 4 bytes: scriptnum_error)";
      if (!u8.length) return 0;
      let r = 0; for (let i = 0; i < u8.length; i++) r += u8[i] * 2 ** (8 * i);
      if (u8[u8.length - 1] & 0x80) return -(r - 0x80 * 2 ** (8 * (u8.length - 1)));
      return r;
    };
    const castBool = (u8) => { for (let i = 0; i < u8.length; i++) if (u8[i]) return !(i === u8.length - 1 && u8[i] === 0x80); return false; };
    const DISABLED = ["OP_CAT", "OP_SUBSTR", "OP_LEFT", "OP_RIGHT", "OP_INVERT", "OP_AND", "OP_OR", "OP_XOR", "OP_2MUL", "OP_2DIV", "OP_MUL", "OP_DIV", "OP_MOD", "OP_LSHIFT", "OP_RSHIFT"];
    const parse = (s, part) => {
      const toks = s.match(/"[^"]*"|<[^>]*>|\S+/g) || [];
      return toks.map((t) => {
        if (t.startsWith('"')) return { t, push: B.utf8(t.slice(1, -1)), part };
        if (t.startsWith("<")) return { t: t.length > 22 ? t.slice(0, 10) + "…" + t.slice(-8) : t, push: B.unhex(t.slice(1, -1)), part };
        if (/^-?\d+$/.test(t)) return { t, push: numEnc(parseInt(t, 10)), part };
        let op = t.toUpperCase(); if (!op.startsWith("OP_")) op = "OP_" + op;
        if (op === "OP_TRUE") op = "OP_1"; if (op === "OP_FALSE") op = "OP_0";
        return { t: op, op, part };
      });
    };
    let st;
    const reset = () => {
      const a = parse($(".ss", b).value, "sig"), c = parse($(".sp", b).value, "pub");
      st = { prog: [...a, { sep: true }, ...c], pc: 0, stack: [], alt: [], vf: [], done: false, err: null, msg: "Listo. Pulsa «Paso». Primero se ejecuta el scriptSig y, sobre la MISMA pila, el scriptPubKey (VerifyScript)." };
      draw();
    };
    const show = (u8) => { const h = B.hex(u8); let n = ""; if (u8.length <= 4) { try { n = ` (${numDec(u8)})`; } catch (e) { /* */ } } return (h || "∅ vacío") + n; };
    const draw = () => {
      $(".opsv", b).innerHTML = st.prog.map((o, i) => o.sep ? `<span class="sep">┃ luego ┃</span>` : `<span class="${i === st.pc && !st.done ? "cur" : i < st.pc ? "done" : ""}">${esc(o.t)}</span>`).join("");
      $(".st", b).innerHTML = st.stack.map((x) => `<div class="item">${esc(show(x))}</div>`).join("");
      $(".alt", b).innerHTML = st.alt.map((x) => `<div class="item">${esc(show(x))}</div>`).join("");
      $(".cond", b).innerHTML = st.vf.map((x) => `<div class="item">${x ? "ejecutar" : "saltar"}</div>`).join("");
      $(".res", b).innerHTML = st.msg;
    };
    const step = () => {
      if (st.done) return;
      while (st.prog[st.pc] && st.prog[st.pc].sep) {
        st.pc++;
        if (st.vf.length) { st.err = "SCRIPT_ERR_UNBALANCED_CONDITIONAL"; }
      }
      if (st.err) return finish();
      const o = st.prog[st.pc];
      if (!o) return finish();
      const S = st.stack;
      const fExec = st.vf.every(Boolean);
      const need = (n) => { if (S.length < n) throw "SCRIPT_ERR_INVALID_STACK_OPERATION"; };
      const line = o.op && META.opcodes ? META.opcodes[o.op] : null;
      let what = "";
      try {
        if (o.push) {
          if (o.push.length > 520) throw "SCRIPT_ERR_PUSH_SIZE";
          if (fExec) { S.push(o.push); what = `Empuja ${o.push.length} bytes a la pila.`; } else what = "Saltado (rama no ejecutada).";
        } else {
          const op = o.op;
          if (DISABLED.includes(op)) throw "SCRIPT_ERR_DISABLED_OPCODE";
          const flow = ["OP_IF", "OP_NOTIF", "OP_ELSE", "OP_ENDIF"].includes(op);
          if (!fExec && !flow) what = "Saltado (rama no ejecutada).";
          else if (/^OP_(\d+)$/.test(op)) { const n = Number(op.slice(3)); S.push(numEnc(n)); what = `Empuja el número ${n}.`; }
          else if (op === "OP_1NEGATE") { S.push(numEnc(-1)); what = "Empuja -1."; }
          else switch (op) {
            case "OP_NOP": what = "No hace nada."; break;
            case "OP_IF": case "OP_NOTIF": {
              let v = false;
              if (fExec) { need(1); v = castBool(S.pop()); if (op === "OP_NOTIF") v = !v; }
              st.vf.push(v); what = `${op}: la condición es ${v ? "verdadera → se ejecuta la rama" : "falsa → se salta la rama"}.`; break; }
            case "OP_ELSE": if (!st.vf.length) throw "SCRIPT_ERR_UNBALANCED_CONDITIONAL"; st.vf[st.vf.length - 1] = !st.vf[st.vf.length - 1]; what = "Invierte la rama activa."; break;
            case "OP_ENDIF": if (!st.vf.length) throw "SCRIPT_ERR_UNBALANCED_CONDITIONAL"; st.vf.pop(); what = "Cierra el IF."; break;
            case "OP_VERIFY": need(1); if (!castBool(S[S.length - 1])) throw "SCRIPT_ERR_VERIFY"; S.pop(); what = "La cima es verdadera: se retira y seguimos."; break;
            case "OP_RETURN": throw "SCRIPT_ERR_OP_RETURN";
            case "OP_TOALTSTACK": need(1); st.alt.push(S.pop()); what = "Pasa la cima a la pila alternativa."; break;
            case "OP_FROMALTSTACK": if (!st.alt.length) throw "SCRIPT_ERR_INVALID_ALTSTACK_OPERATION"; S.push(st.alt.pop()); what = "Recupera de la pila alternativa."; break;
            case "OP_DROP": need(1); S.pop(); what = "Descarta la cima."; break;
            case "OP_2DROP": need(2); S.pop(); S.pop(); what = "Descarta dos."; break;
            case "OP_DUP": need(1); S.push(S[S.length - 1]); what = "Duplica la cima."; break;
            case "OP_2DUP": need(2); S.push(S[S.length - 2], S[S.length - 1]); what = "Duplica los dos de arriba."; break;
            case "OP_NIP": need(2); S.splice(S.length - 2, 1); what = "Quita el segundo."; break;
            case "OP_OVER": need(2); S.push(S[S.length - 2]); what = "Copia el segundo arriba."; break;
            case "OP_ROT": need(3); S.push(S.splice(S.length - 3, 1)[0]); what = "Rota los tres de arriba."; break;
            case "OP_SWAP": need(2); { const x = S.pop(), y = S.pop(); S.push(x, y); } what = "Intercambia los dos de arriba."; break;
            case "OP_TUCK": need(2); S.splice(S.length - 2, 0, S[S.length - 1]); what = "Copia la cima debajo del segundo."; break;
            case "OP_SIZE": need(1); S.push(numEnc(S[S.length - 1].length)); what = "Empuja el tamaño de la cima."; break;
            case "OP_DEPTH": S.push(numEnc(S.length)); what = "Empuja la profundidad de la pila."; break;
            case "OP_EQUAL": case "OP_EQUALVERIFY": {
              need(2); const x = S.pop(), y = S.pop(); const eq = B.hex(x) === B.hex(y);
              S.push(eq ? Uint8Array.of(1) : new Uint8Array(0));
              what = `Compara byte a byte: ${eq ? "iguales" : "DISTINTOS"}.`;
              if (op === "OP_EQUALVERIFY") { if (!eq) throw "SCRIPT_ERR_EQUALVERIFY"; S.pop(); what += " VERIFY: retirado."; }
              break; }
            case "OP_1ADD": case "OP_1SUB": case "OP_NEGATE": case "OP_ABS": case "OP_NOT": case "OP_0NOTEQUAL": {
              need(1); let n = numDec(S.pop());
              n = { OP_1ADD: n + 1, OP_1SUB: n - 1, OP_NEGATE: -n, OP_ABS: Math.abs(n), OP_NOT: n === 0 ? 1 : 0, OP_0NOTEQUAL: n !== 0 ? 1 : 0 }[op];
              S.push(numEnc(n)); what = `Resultado: ${n}.`; break; }
            case "OP_ADD": case "OP_SUB": case "OP_BOOLAND": case "OP_BOOLOR": case "OP_NUMEQUAL": case "OP_NUMEQUALVERIFY": case "OP_NUMNOTEQUAL":
            case "OP_LESSTHAN": case "OP_GREATERTHAN": case "OP_LESSTHANOREQUAL": case "OP_GREATERTHANOREQUAL": case "OP_MIN": case "OP_MAX": {
              need(2); const y = numDec(S.pop()), x = numDec(S.pop());
              const r = { OP_ADD: x + y, OP_SUB: x - y, OP_BOOLAND: +(x !== 0 && y !== 0), OP_BOOLOR: +(x !== 0 || y !== 0), OP_NUMEQUAL: +(x === y), OP_NUMEQUALVERIFY: +(x === y), OP_NUMNOTEQUAL: +(x !== y),
                OP_LESSTHAN: +(x < y), OP_GREATERTHAN: +(x > y), OP_LESSTHANOREQUAL: +(x <= y), OP_GREATERTHANOREQUAL: +(x >= y), OP_MIN: Math.min(x, y), OP_MAX: Math.max(x, y) }[op];
              S.push(numEnc(r)); what = `${x} ${op.slice(3)} ${y} → ${r}.`;
              if (op === "OP_NUMEQUALVERIFY") { if (!r) throw "SCRIPT_ERR_NUMEQUALVERIFY"; S.pop(); }
              break; }
            case "OP_WITHIN": { need(3); const mx = numDec(S.pop()), mn = numDec(S.pop()), x = numDec(S.pop()); S.push(numEnc(+(mn <= x && x < mx))); what = `¿${mn} ≤ ${x} < ${mx}?`; break; }
            case "OP_RIPEMD160": need(1); S.push(B.ripemd160(S.pop())); what = "RIPEMD-160 de la cima."; break;
            case "OP_SHA256": need(1); S.push(B.sha256(S.pop())); what = "SHA-256 de la cima."; break;
            case "OP_HASH160": need(1); S.push(B.hash160(S.pop())); what = "HASH160 = RIPEMD160(SHA256(cima)). Así se obtiene el «hash de la clave» de una dirección."; break;
            case "OP_HASH256": need(1); S.push(B.sha256d(S.pop())); what = "Doble SHA-256 de la cima."; break;
            case "OP_CHECKSIG": case "OP_CHECKSIGVERIFY": {
              need(2); const pk = S.pop(), sig = S.pop();
              const ok = B.hex(sig) === fakeSig(B.hex(pk));
              S.push(ok ? Uint8Array.of(1) : new Uint8Array(0));
              what = `Comprueba la firma con la clave pública (simulado): ${ok ? "válida" : "NO válida"}. En el nodo real: EvalChecksig → CheckECDSASignature/CheckSchnorrSignature.`;
              if (op === "OP_CHECKSIGVERIFY") { if (!ok) throw "SCRIPT_ERR_CHECKSIGVERIFY"; S.pop(); }
              break; }
            default: throw "SCRIPT_ERR_BAD_OPCODE (no soportado por este simulador: " + op + ")";
          }
        }
        if (S.length + st.alt.length > 1000) throw "SCRIPT_ERR_STACK_SIZE";
      } catch (e) { st.err = String(e); }
      st.msg = `<b>${esc(o.t)}</b> — ${what}` + (line ? ` · implementado en ${srcLink("src/script/interpreter.cpp", line, "interpreter.cpp:" + line)}` : "") + (st.err ? `\n<span class="bad-t">✘ Error: ${esc(st.err)}</span>` : "");
      st.pc++;
      if (st.err) return finish();
      if (st.pc >= st.prog.length) return finish();
      draw();
    };
    const finish = () => {
      st.done = true;
      if (!st.err && st.vf.length) st.err = "SCRIPT_ERR_UNBALANCED_CONDITIONAL";
      let verdict;
      if (st.err) verdict = `<span class="pill bad">SCRIPT FALLA</span> ${esc(st.err)} → la transacción es inválida.`;
      else if (!st.stack.length || !castBool(st.stack[st.stack.length - 1])) verdict = `<span class="pill bad">SCRIPT FALLA</span> SCRIPT_ERR_EVAL_FALSE: al terminar, la cima no es «verdadera» (VerifyScript).`;
      else verdict = `<span class="pill ok">SCRIPT VÁLIDO</span> Al terminar la cima es verdadera: la moneda puede gastarse.`;
      st.msg = (st.msg ? st.msg + "\n\n" : "") + verdict;
      draw();
    };
    $(".reset", b).onclick = reset;
    $(".step", b).onclick = step;
    $(".run", b).onclick = () => { let g = 0; while (!st.done && g++ < 500) step(); };
    $(".ss", b).oninput = reset; $(".sp", b).oninput = reset;
    $$("button[data-i]", b).forEach((x) => (x.onclick = () => { const p = Object.values(presets)[x.dataset.i]; $(".ss", b).value = p[0]; $(".sp", b).value = p[1]; reset(); }));
    const p0 = Object.values(presets)[0]; $(".ss", b).value = p0[0]; $(".sp", b).value = p0[1];
    reset();
  };

  // =====================================================================
  // Nivel 5 · Verifica el bloque génesis
  // =====================================================================
  GAMES.genesis = (el) => {
    const b = shell(el, "🧱", "Reconstruye y verifica el bloque génesis en tu navegador", "Cálculo real");
    b.innerHTML = `<p>Usamos exactamente los datos de <code>CreateGenesisBlock(1231006505, 2083236893, 0x1d00ffff, 1, 50 * COIN)</code>. Si el código de tu nodo dice lo mismo, deberías obtener los mismos dos hashes que exigen los <code>assert</code> de <code>chainparams.cpp</code>.</p>
      <div class="row"><button class="btn go" type="button">Calcular</button></div><div class="out res"></div><div class="bytes segs"></div>`;
    $(".go", b).onclick = () => {
      const tx = genesisTx();
      const txid = B.sha256d(tx);
      const merkle = txid; // un único tx: la raíz es su txid
      const header = B.concat(B.le32(1), new Uint8Array(32), merkle, B.le32(1231006505), B.le32(0x1d00ffff), B.le32(2083236893));
      const hash = B.reverse(B.sha256d(header));
      const target = B.setCompact(0x1d00ffff).value;
      const hv = BigInt("0x" + B.hex(hash));
      const okH = B.hex(hash) === "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f";
      const okM = B.hex(B.reverse(merkle)) === "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b";
      $(".res", b).innerHTML = `Transacción coinbase serializada: ${tx.length} bytes\ntxid = raíz de Merkle = ${B.hex(B.reverse(merkle))} ${okM ? '<span class="ok-t">✔ = assert(genesis.hashMerkleRoot == …4a5e1e…)</span>' : '<span class="bad-t">✘</span>'}\n\nCabecera (80 bytes): ${B.hex(header)}\nHash del bloque = ${B.hex(hash)} ${okH ? '<span class="ok-t">✔ = assert(consensus.hashGenesisBlock == …19d6…)</span>' : '<span class="bad-t">✘</span>'}\n\nObjetivo (nBits 0x1d00ffff) = ${B.hex256(target)}\n¿hash ≤ objetivo? ${hv <= target ? '<span class="ok-t">sí: la prueba de trabajo es válida</span>' : "no"}`;
      const seg = (l, c, u8, info) => `<div class="seg ${c}"><b>${l}</b>${B.hex(u8)}${info ? `<br><span class="small">${info}</span>` : ""}</div>`;
      $(".segs", b).innerHTML = seg("nVersion", "c1", B.le32(1), "1") + seg("hashPrevBlock", "c2", new Uint8Array(32), "no hay bloque anterior") + seg("hashMerkleRoot", "c3", merkle, "orden interno (al revés de como se muestra)") + seg("nTime", "c4", B.le32(1231006505), "2009-01-03 18:15:05 UTC") + seg("nBits", "c5", B.le32(0x1d00ffff), "dificultad 1") + seg("nNonce", "c6", B.le32(2083236893), "2083236893");
    };
  };

  // =====================================================================
  // Nivel 5 · Minería de juguete
  // =====================================================================
  GAMES.miner = (el) => {
    const b = shell(el, "⛏️", "Mina tu propio bloque", "SHA256d real, dificultad de juguete");
    b.innerHTML = `
      <div class="row"><label>Transacciones del bloque</label><input type="text" class="txs" value="Ana paga 1 BTC a Beto; Beto paga 0.5 a Carla" style="flex:1"></div>
      <div class="row"><label>Dificultad: ceros hexadecimales iniciales</label><input type="range" class="z" min="1" max="6" value="4"><b class="zv"></b><span class="small muted">(cada cero = 16 veces más trabajo)</span></div>
      <div class="row"><label>Nonce</label><input type="number" class="nonce mono" value="0" style="width:160px"><button class="btn go" type="button">Minar ⛏</button><button class="btn sec stop" type="button">Parar</button></div>
      <div class="out res"></div>`;
    let running = false;
    const prev = B.unhex("6fe28c0ab6f1b372c1a6a246ae63f74f931e8365e15a089c68d6190000000000");
    const header = (nonce) => {
      const merkle = B.sha256d(B.utf8($(".txs", b).value));
      return B.concat(B.le32(0x20000000), prev, merkle, B.le32(Math.floor(Date.now() / 1000 / 600) * 600), B.le32(0x1d00ffff), B.le32(nonce));
    };
    const show = (nonce, tries, ms) => {
      const z = Number($(".z", b).value);
      const h = B.hex(B.reverse(B.sha256d(header(nonce))));
      const ok = h.startsWith("0".repeat(z));
      $(".res", b).innerHTML = `nonce = ${nonce}\nhash  = ${ok ? `<span class="ok-t">${h}</span>` : h}\n${ok ? `<span class="ok-t">✔ ¡Bloque encontrado!</span> ` : "Aún no: el hash debe empezar por " + "0".repeat(z) + ". "}${tries ? `Intentos: ${tries.toLocaleString("es-ES")} · ${(tries / Math.max(ms, 1) * 1000).toFixed(0)} hashes/s` : ""}\nEsperados de media: 16^${z} = ${(16 ** z).toLocaleString("es-ES")} intentos. La red real hace ~10²¹ hashes por segundo.`;
      return ok;
    };
    $(".z", b).oninput = () => { $(".zv", b).textContent = $(".z", b).value; show(Number($(".nonce", b).value), 0, 1); };
    $(".nonce", b).oninput = () => show(Number($(".nonce", b).value), 0, 1);
    $(".txs", b).oninput = () => show(Number($(".nonce", b).value), 0, 1);
    $(".go", b).onclick = () => {
      if (running) return; running = true;
      let nonce = Number($(".nonce", b).value) || 0, tries = 0;
      const t0 = performance.now();
      const z = Number($(".z", b).value), pre = "0".repeat(z);
      const loop = () => {
        if (!running) return;
        for (let i = 0; i < 3000; i++) {
          const h = B.hex(B.reverse(B.sha256d(header(nonce))));
          tries++;
          if (h.startsWith(pre)) { running = false; $(".nonce", b).value = nonce; show(nonce, tries, performance.now() - t0); return; }
          nonce = (nonce + 1) >>> 0;
        }
        $(".nonce", b).value = nonce;
        show(nonce, tries, performance.now() - t0);
        requestAnimationFrame(loop);
      };
      loop();
    };
    $(".stop", b).onclick = () => { running = false; };
    $(".zv", b).textContent = $(".z", b).value;
    show(0, 0, 1);
  };

  // =====================================================================
  // Nivel 5 · Árbol de Merkle y CVE-2012-2459
  // =====================================================================
  GAMES.merkle = (el) => {
    const b = shell(el, "🌳", "Constructor de árboles de Merkle (y el fallo CVE-2012-2459)", "Cálculo real");
    b.innerHTML = `
      <div class="row"><label>Transacciones (una por línea o separadas por comas)</label></div>
      <input type="text" class="txs mono" value="tx1, tx2, tx3, tx4, tx5, tx6" style="width:100%">
      <div class="row"><button class="btn sec atk" type="button">Ataque: duplicar las 2 últimas</button><button class="btn sec rst" type="button">Restaurar</button></div>
      <div class="svgbox"><svg class="tree" style="width:100%"></svg></div>
      <div class="out res"></div>`;
    const short = (u8) => B.hex(B.reverse(u8)).slice(0, 8);
    const run = () => {
      const names = $(".txs", b).value.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
      let level = names.map((n) => ({ h: B.sha256d(B.utf8(n)), label: n }));
      const levels = [level.map((x) => ({ ...x }))];
      let mutated = false;
      while (level.length > 1) {
        for (let i = 0; i + 1 < level.length; i += 2) if (B.hex(level[i].h) === B.hex(level[i + 1].h)) mutated = true;
        if (level.length & 1) { level.push({ h: level[level.length - 1].h, dup: true }); levels[levels.length - 1].push({ h: level[level.length - 1].h, dup: true }); }
        const next = [];
        for (let i = 0; i < level.length; i += 2) next.push({ h: B.sha256d(B.concat(level[i].h, level[i + 1].h)) });
        level = next; levels.push(next.map((x) => ({ ...x })));
      }
      // dibujar
      const W = 86, Hh = 62, rows = levels.length, maxw = Math.max(...levels.map((l) => l.length));
      const width = Math.max(maxw * (W + 8) + 20, 300), height = rows * Hh + 20;
      let s = "";
      const pos = levels.map((l, r) => l.map((_, i) => ({ x: 10 + (i + 0.5) * (width - 20) / l.length, y: height - 30 - r * Hh })));
      levels.forEach((l, r) => l.forEach((n, i) => {
        if (r + 1 < levels.length) { const p = pos[r + 1][Math.floor(i / 2)]; s += `<line x1="${pos[r][i].x}" y1="${pos[r][i].y - 12}" x2="${p.x}" y2="${p.y + 12}" stroke="var(--muted)" stroke-width="1"/>`; }
      }));
      levels.forEach((l, r) => l.forEach((n, i) => {
        const { x, y } = pos[r][i];
        const root = r === levels.length - 1;
        s += `<rect x="${x - W / 2}" y="${y - 12}" width="${W}" height="24" rx="6" fill="${root ? "var(--accent)" : "var(--panel)"}" stroke="${n.dup ? "var(--bad)" : "var(--border)"}" ${n.dup ? 'stroke-dasharray="4 3"' : ""}/>`;
        s += `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="11" font-family="JetBrains Mono, monospace" fill="${root ? "#fff" : "var(--text)"}">${short(n.h)}</text>`;
        if (r === 0 && n.label) s += `<text x="${x}" y="${y + 26}" text-anchor="middle" font-size="10" fill="var(--muted)">${esc(n.label)}</text>`;
        if (n.dup) s += `<text x="${x}" y="${y + 26}" text-anchor="middle" font-size="9" fill="var(--bad)">copia</text>`;
      }));
      const svg = $(".tree", b);
      svg.setAttribute("viewBox", `0 0 ${width} ${height + 10}`);
      svg.style.minWidth = Math.min(width, 900) + "px";
      svg.innerHTML = s;
      const root = level[0] ? B.hex(B.reverse(level[0].h)) : "(vacío)";
      $(".res", b).innerHTML = `Raíz de Merkle = <b>${root}</b>\nmutated = ${mutated ? '<span class="bad-t">true → CheckMerkleRoot rechaza el bloque con "bad-txns-duplicate" (BLOCK_MUTATED)</span>' : "false"}\n\nLas cajas rojas discontinuas son copias: cuando un nivel tiene un número impar de hashes, ComputeMerkleRoot duplica el último (merkle.cpp:55).`;
    };
    $(".txs", b).oninput = run;
    $(".atk", b).onclick = () => { const v = $(".txs", b).value.split(",").map((s) => s.trim()).filter(Boolean); if (v.length >= 2) { $(".txs", b).value = [...v, v[v.length - 2], v[v.length - 1]].join(", "); run(); } };
    $(".rst", b).onclick = () => { $(".txs", b).value = "tx1, tx2, tx3, tx4, tx5, tx6"; run(); };
    run();
  };

  // =====================================================================
  // Nivel 5 · Ajuste de dificultad
  // =====================================================================
  GAMES.difficulty = (el) => {
    const b = shell(el, "🎚️", "Calculadora de ajuste de dificultad (CalculateNextWorkRequired)", "Mismo algoritmo, BigInt");
    b.innerHTML = `
      <div class="row"><label>nBits del período anterior</label><input type="text" class="nb mono" value="1d00ffff" style="width:120px">
      <label>Los 2016 bloques tardaron</label><input type="range" class="d" min="1" max="70" step="0.5" value="10" style="flex:1"><b class="dv"></b></div>
      <div class="out res"></div>`;
    const powLimit = BigInt("0x00000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    const TT = 14 * 24 * 3600;
    const run = () => {
      const days = Number($(".d", b).value);
      $(".dv", b).textContent = days + " días";
      let nb; try { nb = parseInt($(".nb", b).value, 16) >>> 0; } catch (e) { return; }
      const old = B.setCompact(nb).value;
      let actual = Math.round(days * 86400);
      const raw = actual;
      let note = "";
      if (actual < TT / 4) { actual = TT / 4; note = `→ recortado a nPowTargetTimespan/4 = 3,5 días (pow.cpp:58): la dificultad no puede subir más de ×4 de golpe`; }
      if (actual > TT * 4) { actual = TT * 4; note = `→ recortado a nPowTargetTimespan·4 = 56 días (pow.cpp:60): no puede bajar más de ÷4`; }
      let nw = old * BigInt(actual) / BigInt(TT);
      let capped = false;
      if (nw > powLimit) { nw = powLimit; capped = true; }
      const nc = B.getCompact(nw);
      const ratio = Number(old * 1000000n / (B.setCompact(nc).value || 1n)) / 1e6;
      $(".res", b).innerHTML = `nActualTimespan = ${raw} s ${note}\nObjetivo anterior = ${B.hex256(old)}\nNuevo = anterior × ${actual} / ${TT}\n      = ${B.hex256(nw)}${capped ? "\n  → mayor que powLimit: se limita (pow.cpp:81)" : ""}\nNuevo nBits (GetCompact) = <b>0x${nc.toString(16).padStart(8, "0")}</b>\n\nLa dificultad se multiplica por <b>${ratio.toFixed(4)}</b> ${ratio > 1 ? "(más difícil: los bloques iban rápido)" : ratio < 1 ? "(más fácil: los bloques iban lentos)" : ""}`;
    };
    $(".d", b).oninput = run; $(".nb", b).oninput = run; run();
  };

  // =====================================================================
  // Nivel 5 · Emisión total (GetBlockSubsidy)
  // =====================================================================
  GAMES.supply = (el) => {
    const b = shell(el, "📉", "¿De dónde salen los 21 millones? GetBlockSubsidy en acción", "Cálculo exacto");
    b.innerHTML = `<div class="svgbox"><svg class="ch" viewBox="0 0 700 260" style="width:100%"></svg></div><div class="table-wrap tall"><table class="data compact"><thead><tr><th>Halving</th><th>Bloques</th><th>Recompensa (sats)</th><th>Año aprox.</th><th>Total acumulado (BTC)</th></tr></thead><tbody class="tb"></tbody></table></div><div class="out res"></div>`;
    let total = 0n; const rows = []; const pts = [];
    for (let h = 0; h < 64; h++) {
      const sub = (50n * 100000000n) >> BigInt(h);
      total += sub * 210000n;
      rows.push([h, `${(h * 210000).toLocaleString("es-ES")}–${((h + 1) * 210000 - 1).toLocaleString("es-ES")}`, sub, 2009 + h * 4, total]);
      pts.push([h, Number(total) / 1e8, Number(sub) / 1e8]);
      if (sub === 0n && h > 33) break;
    }
    $(".tb", b).innerHTML = rows.filter((r) => r[2] > 0n || r[0] === 33).map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td><code>${r[2].toLocaleString("es-ES")}</code></td><td>${r[3]}</td><td>${fmtBTC(r[4])}</td></tr>`).join("");
    const X = (h) => 50 + h * 18, Y = (v) => 230 - v / 21e6 * 200;
    let s = `<line x1="50" y1="230" x2="680" y2="230" stroke="var(--border)"/><line x1="50" y1="30" x2="680" y2="30" stroke="var(--border)" stroke-dasharray="4 4"/><text x="55" y="25" font-size="11" fill="var(--muted)">21 000 000 BTC</text>`;
    s += `<polyline fill="none" stroke="var(--accent)" stroke-width="2.5" points="${pts.filter((p) => p[0] <= 34).map((p) => `${X(p[0] + 1)},${Y(p[1])}`).join(" ")}"/>`;
    pts.filter((p) => p[0] <= 34 && p[0] % 4 === 0).forEach((p) => { s += `<text x="${X(p[0] + 1)}" y="248" font-size="10" text-anchor="middle" fill="var(--muted)">${2009 + p[0] * 4}</text>`; });
    $(".ch", b).innerHTML = s + `<text x="380" y="140" font-size="12" fill="var(--text)">Oferta acumulada por halving</text>`;
    $(".res", b).innerHTML = `Suma exacta de todas las recompensas: <b>${total.toLocaleString("es-ES")} satoshis = ${fmtBTC(total)} BTC</b>\nNunca llega a 21 000 000 porque el desplazamiento «nSubsidy >>= halvings» redondea hacia abajo, y desde el halving 33 el subsidio es 0. (A esto se le resta además lo que se perdió por bugs/coinbases no reclamadas.)`;
  };

  // =====================================================================
  // Nivel 6 · Selección de cadena y reorganizaciones
  // =====================================================================
  GAMES.chainsel = (el) => {
    const b = shell(el, "🔀", "Simulador de selección de cadena y reorganizaciones", "Modelo de FindMostWorkChain");
    b.innerHTML = `
      <p>Haz clic en un bloque para elegirlo como padre y mina encima. El nodo siempre se queda con la punta de <b>más trabajo acumulado</b> (<code>nChainWork</code>), no con la más larga. Si empatan, gana la que llegó antes (<code>nSequenceId</code>).</p>
      <div class="row"><button class="btn m1" type="button">Minar bloque (trabajo 1)</button><button class="btn sec m3" type="button">Minar bloque difícil (trabajo 3)</button><button class="btn sec inv" type="button">invalidateblock (marcar inválido)</button><button class="btn sec rst" type="button">Reiniciar</button></div>
      <div class="svgbox"><svg class="cs" style="width:100%"></svg></div>
      <div class="log lg"></div>`;
    let blocks, sel, tip, seq;
    const init = () => {
      blocks = [{ id: 0, parent: null, work: 1, h: 0, seq: 0, lane: 0, bad: false }];
      seq = 0; sel = 0; tip = 0;
      [1, 2, 3].forEach(() => { addBlock(blocks[blocks.length - 1].id, 1, true); });
      tip = 3; sel = 3;
      $(".lg", b).innerHTML = "";
      draw();
    };
    const chainWork = (id) => { let w = 0, c = blocks[id]; while (c) { w += c.work; c = c.parent === null ? null : blocks[c.parent]; } return w; };
    const ancestors = (id) => { const a = []; let c = blocks[id]; while (c) { a.unshift(c.id); c = c.parent === null ? null : blocks[c.parent]; } return a; };
    const invalidChain = (id) => ancestors(id).some((x) => blocks[x].bad);
    function addBlock(parent, work, silent) {
      const p = blocks[parent];
      const siblings = blocks.filter((x) => x.parent === parent);
      let lane = p.lane;
      if (siblings.length) { lane = Math.max(...blocks.map((x) => x.lane)) + 1; }
      const blk = { id: blocks.length, parent, work, h: p.h + 1, seq: ++seq, lane, bad: false };
      blocks.push(blk);
      if (!silent) choose();
      return blk;
    }
    const choose = () => {
      // Como setBlockIndexCandidates: más trabajo primero; si empatan, el que llegó antes (nSequenceId menor).
      let best = blocks[0];
      for (const t of blocks) {
        if (invalidChain(t.id)) continue;
        const w = chainWork(t.id), bw = chainWork(best.id);
        if (w > bw || (w === bw && t.seq < best.seq)) best = t;
      }
      if (best.id !== tip) {
        const oldA = ancestors(tip), newA = ancestors(best.id);
        let fork = 0; while (fork < oldA.length && oldA[fork] === newA[fork]) fork++;
        const dis = oldA.slice(fork).reverse(), con = newA.slice(fork);
        const msg = dis.length ? `🔀 <b>REORG</b>: DisconnectTip ${dis.map((x) => "#" + x).join(", ")}` + (con.length ? ` → ConnectTip ${con.map((x) => "#" + x).join(", ")}` : "") + `. Las transacciones de los bloques desconectados vuelven a la mempool.` : `✅ ConnectTip #${con.join(", #")} (nueva punta, altura ${best.h}, trabajo ${chainWork(best.id)})`;
        log(msg);
        tip = best.id;
      } else log(`El bloque nuevo no supera el trabajo de la cadena activa (${chainWork(tip)}): se guarda pero NO se conecta.`);
      draw();
    };
    const log = (s) => { const d = document.createElement("div"); d.innerHTML = s; $(".lg", b).prepend(d); };
    const draw = () => {
      const active = new Set(ancestors(tip));
      const lanes = Math.max(...blocks.map((x) => x.lane)) + 1;
      const maxh = Math.max(...blocks.map((x) => x.h));
      const W = Math.max(600, (maxh + 1) * 92 + 40), H = lanes * 70 + 30;
      const P = (x) => ({ x: 30 + x.h * 92, y: 20 + x.lane * 70 });
      let s = "";
      blocks.forEach((x) => { if (x.parent !== null) { const a = P(blocks[x.parent]), c = P(x); s += `<path d="M${a.x + 70} ${a.y + 22} C ${a.x + 82} ${a.y + 22}, ${c.x - 12} ${c.y + 22}, ${c.x} ${c.y + 22}" fill="none" stroke="var(--muted)"/>`; } });
      blocks.forEach((x) => {
        const p = P(x); const act = active.has(x.id); const bad = invalidChain(x.id);
        s += `<g data-id="${x.id}" style="cursor:pointer"><rect x="${p.x}" y="${p.y}" width="70" height="44" rx="8" fill="${act ? "var(--accent-soft)" : "var(--panel)"}" stroke="${x.id === sel ? "var(--link)" : bad ? "var(--bad)" : act ? "var(--accent)" : "var(--border)"}" stroke-width="${x.id === sel ? 3 : 1.5}" ${bad ? 'stroke-dasharray="5 3"' : ""}/>`;
        s += `<text x="${p.x + 35}" y="${p.y + 18}" text-anchor="middle" font-size="12" font-weight="700" fill="var(--text)">#${x.id}${x.id === tip ? " ★" : ""}</text><text x="${p.x + 35}" y="${p.y + 34}" text-anchor="middle" font-size="10" fill="var(--muted)">w=${x.work} Σ=${chainWork(x.id)}</text></g>`;
      });
      const svg = $(".cs", b);
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.style.minWidth = Math.min(W, 1000) + "px";
      svg.innerHTML = s;
      $$("g[data-id]", svg).forEach((g) => (g.onclick = () => { sel = Number(g.dataset.id); draw(); }));
    };
    $(".m1", b).onclick = () => { if (invalidChain(sel)) return log("No se mina sobre un bloque inválido."); const n = addBlock(sel, 1); sel = n.id; draw(); };
    $(".m3", b).onclick = () => { if (invalidChain(sel)) return log("No se mina sobre un bloque inválido."); const n = addBlock(sel, 3); sel = n.id; draw(); };
    $(".inv", b).onclick = () => { if (sel === 0) return log("No se puede invalidar el génesis."); blocks[sel].bad = true; log(`⛔ InvalidateBlock #${sel}: él y sus descendientes quedan BLOCK_FAILED.`); choose(); };
    $(".rst", b).onclick = init;
    init();
  };

  // =====================================================================
  // Nivel 8 · Cabecera de mensaje P2P
  // =====================================================================
  GAMES.p2pmsg = (el) => {
    const b = shell(el, "📨", "Construye y desmonta la cabecera de un mensaje P2P", "Cálculo real");
    b.innerHTML = `
      <div class="row"><label>Red</label><select class="net"><option value="f9beb4d9">mainnet (f9 be b4 d9)</option><option value="0b110907">testnet3</option><option value="1c163f28">testnet4</option><option value="fabfb5da">regtest</option></select>
      <label>Comando</label><select class="cmd">${["verack", "ping", "pong", "sendheaders", "getaddr", "feefilter", "version", "inv", "tx", "block", "headers", "wtxidrelay"].map((c) => `<option>${c}</option>`).join("")}</select></div>
      <div class="row"><label>Payload (hex)</label><input type="text" class="pl mono" value="" placeholder="vacío" style="flex:1"></div>
      <div class="bytes segs"></div><div class="out res"></div>`;
    const run = () => {
      let pl; try { pl = B.unhex($(".pl", b).value); } catch (e) { $(".res", b).textContent = e.message; return; }
      const magic = B.unhex($(".net", b).value);
      const cmd = new Uint8Array(12); cmd.set(B.utf8($(".cmd", b).value));
      const len = B.le32(pl.length);
      const chk = B.sha256d(pl).slice(0, 4);
      const seg = (l, c, u8, i) => `<div class="seg ${c}"><b>${l}</b>${B.hex(u8) || "∅"}<br><span class="small">${i}</span></div>`;
      $(".segs", b).innerHTML = seg("magic (pchMessageStart)", "c1", magic, "identifica la red") + seg("comando (12 bytes)", "c2", cmd, `"${$(".cmd", b).value}" + ceros`) + seg("longitud", "c3", len, `${pl.length} bytes, LE`) + seg("checksum", "c4", chk, "4 primeros bytes de SHA256d(payload)") + (pl.length ? seg("payload", "c6", pl.slice(0, 40), pl.length > 40 ? "…" : "") : "");
      $(".res", b).innerHTML = `Mensaje completo (transporte v1, sin cifrar):\n${B.hex(B.concat(magic, cmd, len, chk, pl))}\n\nCon el transporte v2 (BIP324, activado por defecto) todo esto viaja cifrado con ChaCha20-Poly1305 y el comando se abrevia a 1 byte.`;
    };
    $$("select, input", b).forEach((x) => (x.oninput = run)); run();
  };

  // =====================================================================
  // Nivel 9 · Construir una plantilla de bloque
  // =====================================================================
  GAMES.blocktemplate = (el) => {
    const b = shell(el, "📦", "Llena el bloque: ¿qué transacciones elegirías?", "Modelo simplificado de BlockAssembler");
    const pool = [
      { id: "A", vsize: 250, fee: 2500 }, { id: "B", vsize: 400, fee: 2400 }, { id: "C", vsize: 1200, fee: 30000 },
      { id: "D", vsize: 300, fee: 600 }, { id: "E (hija de D)", vsize: 200, fee: 12000, parent: "D" }, { id: "F", vsize: 800, fee: 9600 },
      { id: "G", vsize: 150, fee: 4500 }, { id: "H", vsize: 900, fee: 4500 }, { id: "I", vsize: 500, fee: 15000 }, { id: "J", vsize: 600, fee: 3000 },
    ];
    b.innerHTML = `
      <p>Capacidad del bloque: <b class="capv"></b> vB. Cada transacción tiene tamaño y comisión. <b>E</b> depende de <b>D</b> (gasta una salida suya): no puede entrar sin su padre. Compara estrategias:</p>
      <div class="row"><input type="range" class="cap" min="1000" max="5000" step="100" value="2500" style="flex:1"></div>
      <div class="row"><button class="btn sec" data-s="fifo" type="button">Por orden de llegada</button><button class="btn sec" data-s="fee" type="button">Por tasa individual</button><button class="btn" data-s="anc" type="button">Por tasa de paquete (CPFP)</button></div>
      <div class="table-wrap"><table class="data compact"><thead><tr><th>Tx</th><th>vB</th><th>Comisión (sats)</th><th>sat/vB</th><th>¿Entra?</th></tr></thead><tbody class="tb"></tbody></table></div>
      <div class="out res"></div>`;
    const rate = (t) => t.fee / t.vsize;
    const run = (strategy) => {
      const cap = Number($(".cap", b).value);
      $(".capv", b).textContent = cap;
      const inBlock = new Set(); let used = 0, fees = 0; const order = [];
      const fits = (vs) => used + vs <= cap;
      const add = (t) => { inBlock.add(t.id); used += t.vsize; fees += t.fee; order.push(t.id); };
      if (strategy === "fifo" || strategy === "fee") {
        const list = strategy === "fifo" ? pool.slice() : pool.slice().sort((a, c) => rate(c) - rate(a));
        for (const t of list) { if (t.parent && !inBlock.has(t.parent)) continue; if (fits(t.vsize)) add(t); }
      } else {
        let remaining = pool.slice();
        while (remaining.length) {
          const pk = remaining.map((t) => { const set = [t]; if (t.parent && !inBlock.has(t.parent)) set.unshift(pool.find((x) => x.id === t.parent)); const vs = set.reduce((a, x) => a + x.vsize, 0), fe = set.reduce((a, x) => a + x.fee, 0); return { t, set, vs, fe, r: fe / vs }; }).sort((a, c) => c.r - a.r);
          const best = pk.find((p) => fits(p.vs));
          if (!best) break;
          best.set.forEach((x) => { if (!inBlock.has(x.id)) add(x); });
          remaining = remaining.filter((x) => !inBlock.has(x.id));
        }
      }
      $(".tb", b).innerHTML = pool.map((t) => `<tr><td>${t.id}</td><td>${t.vsize}</td><td>${t.fee.toLocaleString("es-ES")}</td><td>${rate(t).toFixed(1)}</td><td>${inBlock.has(t.id) ? '<span class="ok-t">✔ #' + (order.indexOf(t.id) + 1) + "</span>" : "—"}</td></tr>`).join("");
      $(".res", b).innerHTML = `Estrategia: <b>${{ fifo: "orden de llegada", fee: "tasa individual (ignora que E arrastra a D)", anc: "tasa del paquete de ancestros (D+E juntos = " + ((600 + 12000) / 500).toFixed(1) + " sat/vB)" }[strategy]}</b>\nEspacio usado: ${used}/${cap} vB · Comisiones cobradas: <b>${fees.toLocaleString("es-ES")} sats</b>\n\nEl minero real (src/node/miner.cpp) usa la mempool por clústeres de v31: ordena trozos («chunks») de cada clúster por tasa de comisión, que generaliza esta idea de paquetes.`;
      $$("button[data-s]", b).forEach((x) => x.classList.toggle("sec", x.dataset.s !== strategy));
    };
    let cur = "anc";
    $$("button[data-s]", b).forEach((x) => (x.onclick = () => { cur = x.dataset.s; run(cur); }));
    $(".cap", b).oninput = () => run(cur);
    run(cur);
  };

  // =====================================================================
  // Nivel 10 · Máquina de estados BIP9
  // =====================================================================
  GAMES.bip9 = (el) => {
    const b = shell(el, "🗳️", "Simulador de activación BIP9 (versionbits)", "Mismas transiciones que versionbits.cpp");
    b.innerHTML = `
      <p>Cada período son 2016 bloques. Umbral: <b>1815</b> bloques señalizando (90 %). Mueve el deslizador para decidir cuántos mineros señalizan en el próximo período y avanza.</p>
      <div class="row"><label>Inicio (período)</label><input type="number" class="st" value="1" min="0" max="20" style="width:70px"><label>Fin/timeout (período)</label><input type="number" class="to" value="6" min="1" max="30" style="width:70px"><label>min_activation_height (período)</label><input type="number" class="mh" value="0" min="0" max="30" style="width:70px"></div>
      <div class="row"><label>% de bloques que señalizan</label><input type="range" class="pct" min="0" max="100" value="60" style="flex:1"><b class="pv"></b></div>
      <div class="row"><button class="btn nx" type="button">Siguiente período ▶</button><button class="btn sec rs" type="button">Reiniciar</button></div>
      <div class="mermaid-like out st8"></div><div class="log lg"></div>`;
    let period, state;
    const reset = () => { period = 0; state = "DEFINED"; $(".lg", b).innerHTML = ""; draw(); };
    const draw = () => {
      $(".pv", b).textContent = $(".pct", b).value + " %";
      const states = ["DEFINED", "STARTED", "LOCKED_IN", "ACTIVE", "FAILED"];
      $(".st8", b).innerHTML = `Período ${period} (bloques ${period * 2016}–${period * 2016 + 2015})\n` + states.map((s) => s === state ? `[<b>${s}</b>]` : ` ${s} `).join(" → ").replace("→  FAILED", "  ·  FAILED");
    };
    const log = (s) => { const d = document.createElement("div"); d.innerHTML = s; $(".lg", b).prepend(d); };
    $(".nx", b).onclick = () => {
      const start = Number($(".st", b).value), timeout = Number($(".to", b).value), mh = Number($(".mh", b).value);
      const pct = Number($(".pct", b).value);
      const count = Math.round(2016 * pct / 100);
      const prev = state;
      // Transición al FINAL del período actual (GetStateFor evalúa por períodos)
      period++;
      switch (state) {
        case "DEFINED": if (period >= start) state = "STARTED"; break;
        case "STARTED": if (count >= 1815) state = "LOCKED_IN"; else if (period >= timeout) state = "FAILED"; break;
        case "LOCKED_IN": if (period >= mh) state = "ACTIVE"; break;
      }
      log(`Período ${period - 1}: ${prev === "STARTED" ? `${count}/2016 señalizan · ` : ""}${prev} → <b>${state}</b>`);
      draw();
    };
    $(".pct", b).oninput = draw;
    $(".rs", b).onclick = reset;
    reset();
  };

  // =====================================================================
  // Nivel 11 · Selección de monedas
  // =====================================================================
  GAMES.coinselect = (el) => {
    const b = shell(el, "🧮", "Selección de monedas: ¿qué billetes saco de la cartera?", "Versión simplificada de coinselection.cpp");
    b.innerHTML = `
      <div class="row"><label>Monedas disponibles (sats)</label><input type="text" class="u mono" value="50000, 120000, 33000, 7000, 260000, 91000, 18000" style="flex:1"></div>
      <div class="row"><label>Quiero pagar</label><input type="number" class="t" value="125000" style="width:130px"><label>Tasa (sat/vB)</label><input type="number" class="fr" value="10" style="width:80px"><label>Tasa a largo plazo</label><input type="number" class="lt" value="5" style="width:80px"></div>
      <div class="row"><button class="btn" type="button" data-a="bnb">Branch and Bound</button><button class="btn sec" type="button" data-a="lf">Mayor primero</button><button class="btn sec" type="button" data-a="srd">Aleatorio (SRD)</button><button class="btn sec" type="button" data-a="kn">Knapsack</button></div>
      <div class="out res"></div>`;
    const IN_VB = 68, OUT_VB = 31, BASE_VB = 11 + OUT_VB;
    const run = (algo) => {
      $$("button[data-a]", b).forEach((x) => x.classList.toggle("sec", x.dataset.a !== algo));
      const coins = $(".u", b).value.split(",").map((s) => parseInt(s.trim(), 10)).filter((x) => x > 0);
      const target = Number($(".t", b).value), fr = Number($(".fr", b).value), lt = Number($(".lt", b).value);
      const eff = coins.map((v) => ({ v, e: v - IN_VB * fr })).filter((c) => c.e > 0);
      const need = target + BASE_VB * fr;
      const costOfChange = OUT_VB * fr + IN_VB * lt;
      let sel = null, note = "";
      if (algo === "bnb") {
        const s = eff.slice().sort((a, c) => c.e - a.e);
        let best = null, bestWaste = Infinity, tries = 0;
        const rec = (i, cur, sum) => {
          if (++tries > 100000) return;
          if (sum > need + costOfChange) return;
          if (sum >= need) { const waste = cur.reduce((a, c) => a + IN_VB * (fr - lt), 0) + (sum - need); if (waste < bestWaste) { bestWaste = waste; best = cur.slice(); } return; }
          if (i >= s.length) return;
          cur.push(s[i]); rec(i + 1, cur, sum + s[i].e); cur.pop(); rec(i + 1, cur, sum);
        };
        rec(0, [], 0);
        sel = best; note = best ? "Encontró una combinación SIN cambio (la sobra cabe en la ventana cost_of_change y se regala al minero)." : "No hay combinación sin cambio dentro de la ventana: el monedero real probaría otros algoritmos.";
      } else if (algo === "lf") {
        sel = []; let sum = 0; for (const c of eff.slice().sort((a, c2) => c2.e - a.e)) { if (sum >= need) break; sel.push(c); sum += c.e; } if (sum < need) sel = null; note = "Coge las más grandes: pocas entradas, pero deja cambio grande y revela tus mayores monedas.";
      } else if (algo === "srd") {
        const s = eff.slice().sort(() => Math.random() - 0.5); sel = []; let sum = 0; for (const c of s) { if (sum >= need + costOfChange) break; sel.push(c); sum += c.e; } if (sum < need) sel = null; note = "Single Random Draw: monedas al azar hasta cubrir objetivo + cambio. Pulsa varias veces: cambia el resultado.";
      } else {
        let best = null, bestSum = Infinity;
        for (let it = 0; it < 1000; it++) { const pick = eff.filter(() => Math.random() < 0.5); const sum = pick.reduce((a, c) => a + c.e, 0); if (sum >= need && sum < bestSum) { bestSum = sum; best = pick; } }
        sel = best; note = "Knapsack: muchas pruebas aleatorias buscando el subconjunto que más se acerca por encima (algoritmo heredado de Satoshi).";
      }
      if (!sel) { $(".res", b).innerHTML = `<span class="bad-t">Sin solución.</span> ${note}`; return; }
      const sumV = sel.reduce((a, c) => a + c.v, 0), sumE = sel.reduce((a, c) => a + c.e, 0);
      const excess = sumE - need;
      const change = excess > costOfChange ? excess - OUT_VB * fr : 0;
      const waste = sel.length * IN_VB * (fr - lt) + (change ? costOfChange : excess);
      $(".res", b).innerHTML = `Elegidas: ${sel.map((c) => c.v.toLocaleString("es-ES")).join(" + ")} = ${sumV.toLocaleString("es-ES")} sats\nComisión: ${((sel.length * IN_VB + BASE_VB + (change ? OUT_VB : 0)) * fr).toLocaleString("es-ES")} sats · Cambio: ${change ? change.toLocaleString("es-ES") + " sats" : "ninguno"}\nDesperdicio («waste», GetSelectionWaste): <b>${Math.round(waste).toLocaleString("es-ES")}</b>  ← la cartera real ejecuta varios algoritmos y se queda con el de menor desperdicio\n\n${note}`;
    };
    $$("button[data-a]", b).forEach((x) => (x.onclick = () => run(x.dataset.a)));
    run("bnb");
  };

  // ---------------------------------------------------------------------
  $$(".game[data-game]").forEach((el) => {
    const g = GAMES[el.dataset.game];
    if (g) { try { g(el); } catch (e) { el.innerHTML = `<div class="game-body bad-t">Error cargando el juego: ${esc(e.message)}</div>`; console.error(e); } }
  });
})();
