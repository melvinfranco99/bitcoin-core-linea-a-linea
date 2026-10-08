/* Explorador: todos los archivos del repositorio en el commit fijado.
 * El código se descarga directamente de raw.githubusercontent.com (no de
 * esta web), y se muestra con las explicaciones de los niveles intercaladas. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = window.esc;
  const META = window.BTC_META;
  const root = $("#explorer");
  if (!root) return;
  const CAT_LABEL = {
    consenso: "Consenso", script: "Script", cripto: "Criptografía", datos: "Datos/serialización", estado: "Estado/UTXO", red: "Red P2P",
    mempool: "Mempool/política", wallet: "Cartera", nodo: "Nodo/RPC", utilidades: "Utilidades", tests: "Pruebas", terceros: "Terceros",
    gui: "Interfaz gráfica", docs: "Documentación", build: "Compilación/verificación", herramientas: "Herramientas", otros: "Otros",
  };
  const CAT_LEVEL = { consenso: "nivel-6", script: "nivel-4", cripto: "nivel-2", datos: "nivel-3", estado: "nivel-7", red: "nivel-8", mempool: "nivel-9", wallet: "nivel-11", nodo: "nivel-12", utilidades: "nivel-12", tests: "nivel-13", build: "nivel-0" };
  const pageTitle = Object.fromEntries(META.pages.map((p) => [p[0], p[2]]));

  root.innerHTML = `
    <div class="ex-side">
      <div class="ex-search"><input type="text" class="q" placeholder="Buscar archivo o función (p. ej. CheckBlock)…">
        <div class="ex-filters"></div></div>
      <div class="ex-tree">Cargando índice…</div>
    </div>
    <div class="ex-main"><div class="ex-head"></div><div class="ex-code"></div></div>`;

  let FILES = [], ANN = {}, byPath = {};
  const activeCats = new Set();

  Promise.all([fetch("assets/files.json").then((r) => r.json()), fetch("assets/annotations.json").then((r) => r.json())]).then(([files, ann]) => {
    FILES = files; ANN = ann;
    FILES.forEach((f) => (byPath[f.p] = f));
    const cats = {};
    FILES.forEach((f) => (cats[f.c] = (cats[f.c] || 0) + 1));
    $(".ex-filters", root).innerHTML = Object.keys(CAT_LABEL).filter((c) => cats[c]).map((c) => `<button type="button" data-c="${c}"><span class="dot cat-${c}" style="display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:4px"></span>${CAT_LABEL[c]} ${cats[c]}</button>`).join("");
    $$(".ex-filters button", root).forEach((b) => (b.onclick = () => { activeCats.has(b.dataset.c) ? activeCats.delete(b.dataset.c) : activeCats.add(b.dataset.c); b.classList.toggle("on"); buildTree(); }));
    buildTree();
    route();
  }).catch((e) => { $(".ex-tree", root).textContent = "No se pudo cargar el índice: " + e.message; });

  $(".q", root).addEventListener("input", () => buildTree());
  window.addEventListener("hashchange", route);

  function buildTree() {
    const q = $(".q", root).value.trim().toLowerCase();
    const list = FILES.filter((f) => (!activeCats.size || activeCats.has(f.c)) && (!q || f.p.toLowerCase().includes(q) || (f.s || []).some((s) => s[0].toLowerCase().includes(q))));
    const tree = {};
    list.forEach((f) => {
      const parts = f.p.split("/");
      let node = tree;
      for (let i = 0; i < parts.length - 1; i++) node = (node[parts[i] + "/"] = node[parts[i] + "/"] || {});
      node[parts[parts.length - 1]] = f;
    });
    const open = q || activeCats.size;
    const render = (node, prefix) => {
      const keys = Object.keys(node).sort((a, b) => (b.endsWith("/") - a.endsWith("/")) || a.localeCompare(b));
      return keys.map((k) => {
        if (k.endsWith("/")) {
          const path = prefix + k.slice(0, -1);
          const isOpen = open || path === "src" || location.hash.includes("f=" + path + "/");
          return `<div class="dir ${isOpen ? "open" : ""}" data-dir="${esc(path)}"><div class="dname">${esc(k)}</div><div class="kids">${render(node[k], prefix + k)}</div></div>`;
        }
        const f = node[k];
        return `<div class="file ${f.x ? "annot" : ""}" data-p="${esc(f.p)}" title="${esc(f.d || f.h || f.p)}"><span class="dot cat-${f.c}"></span><span class="fn">${esc(k)}</span><span class="lc">${f.n}</span></div>`;
      }).join("");
    };
    $(".ex-tree", root).innerHTML = list.length ? `<div class="small muted" style="padding:2px 10px 6px">${list.length} archivos · ★ = explicado en algún nivel</div>` + render(tree, "") : "<p class='muted' style='padding:10px'>Sin resultados</p>";
    $$(".ex-tree .dname", root).forEach((d) => (d.onclick = (e) => {
      const dir = d.parentElement;
      dir.classList.toggle("open");
      showDir(dir.dataset.dir);
      e.stopPropagation();
    }));
    $$(".ex-tree .file", root).forEach((f) => (f.onclick = () => { location.hash = "f=" + f.dataset.p; }));
    markCurrent();
  }

  function markCurrent() {
    const p = parseHash().f;
    $$(".ex-tree .file", root).forEach((f) => f.classList.toggle("cur", f.dataset.p === p));
  }

  function parseHash() {
    const h = new URLSearchParams(location.hash.slice(1));
    return { f: h.get("f"), l: parseInt(h.get("l") || "0", 10), d: h.get("d") };
  }

  function route() {
    const { f, l, d } = parseHash();
    if (f && byPath[f]) showFile(f, l);
    else if (d !== null && d !== undefined) showDir(d);
    else showHome();
    markCurrent();
  }

  function showHome() {
    const st = META.stats;
    const dirs = Object.entries(META.dirs).filter(([k]) => k && k.split("/").length <= 2);
    $(".ex-head", root).innerHTML = `<h2>Todo el repositorio, archivo por archivo</h2>
      <p>${st.files.toLocaleString("es-ES")} archivos y ${st.lines.toLocaleString("es-ES")} líneas en <a href="${META.repo}/tree/${META.commit}" target="_blank" rel="noopener">${META.tag} (${META.commit.slice(0, 12)})</a>. De ellas, ${st.core_lines.toLocaleString("es-ES")} son C++ propio de Bitcoin Core en <code>src/</code> (sin bibliotecas de terceros). Elige un archivo a la izquierda: el código se descarga <b>directamente de GitHub</b> en ese commit exacto, y las líneas explicadas en los niveles aparecen con su nota.</p>
      <p class="small muted">Consejo: busca un nombre de función, como <code>ConnectBlock</code> o <code>EvalScript</code>. Los colores indican la categoría.</p>`;
    $(".ex-code", root).innerHTML = `<div class="table-wrap" style="margin:0;border:0"><table class="data"><thead><tr><th>Carpeta</th><th>Qué contiene</th></tr></thead><tbody>${dirs.map(([k, v]) => `<tr><td><a href="#d=${esc(k)}"><code>${esc(k)}/</code></a></td><td class="small">${esc(v)}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function showDir(dir) {
    if (location.hash !== "#d=" + dir) history.replaceState(null, "", "#d=" + dir);
    const files = FILES.filter((f) => f.p.startsWith(dir + "/") && !f.p.slice(dir.length + 1).includes("/"));
    const subdirs = [...new Set(FILES.filter((f) => f.p.startsWith(dir + "/") && f.p.slice(dir.length + 1).includes("/")).map((f) => dir + "/" + f.p.slice(dir.length + 1).split("/")[0]))];
    const lines = FILES.filter((f) => f.p.startsWith(dir + "/")).reduce((a, f) => a + f.n, 0);
    $(".ex-head", root).innerHTML = `<h2>${esc(dir)}/</h2><p>${esc(META.dirs[dir] || "")}</p><p class="small muted">${files.length} archivos directos · ${subdirs.length} subcarpetas · ${lines.toLocaleString("es-ES")} líneas en total · <a href="${META.repo}/tree/${META.commit}/${dir}" target="_blank" rel="noopener">GitHub ↗</a></p>`;
    $(".ex-code", root).innerHTML = `<div class="table-wrap" style="margin:0;border:0"><table class="data compact"><thead><tr><th>Archivo</th><th>Líneas</th><th>Descripción</th></tr></thead><tbody>
      ${subdirs.map((s) => `<tr><td><a href="#d=${esc(s)}"><code>${esc(s.split("/").pop())}/</code></a></td><td></td><td class="small">${esc(META.dirs[s] || "")}</td></tr>`).join("")}
      ${files.map((f) => `<tr><td><a href="#f=${esc(f.p)}"><code>${esc(f.p.split("/").pop())}</code></a>${f.x ? " ★" : ""}</td><td>${f.n}</td><td class="small">${esc(f.d || f.h || "")}</td></tr>`).join("")}</tbody></table></div>`;
  }

  const cache = {};
  async function showFile(p, line) {
    const f = byPath[p];
    const dir = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
    const raw = `https://raw.githubusercontent.com/bitcoin/bitcoin/${META.commit}/${p}`;
    const lvl = CAT_LEVEL[f.c];
    const expl = (f.x || []).map((x) => `<li><a href="${x[0]}.html#${x[1]}">${esc(pageTitle[x[0]] || x[0])}</a> — líneas ${x[2]}–${x[3]}${x[4] ? " · " + esc(x[4]) : ""}</li>`).join("");
    $(".ex-head", root).innerHTML = `<h2>${esc(p)}</h2>
      <div class="row" style="margin:4px 0 8px"><span class="badge"><span class="dot cat-${f.c}" style="display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:4px"></span>${CAT_LABEL[f.c] || f.c}</span><span class="badge">${f.n.toLocaleString("es-ES")} líneas</span>
        <a href="${META.repo}/blob/${META.commit}/${p}${line ? "#L" + line : ""}" target="_blank" rel="noopener" class="small">Ver en GitHub ↗</a>
        <a href="${raw}" target="_blank" rel="noopener" class="small">Original sin formato ↗</a>
        ${dir ? `<a href="#d=${esc(dir)}" class="small">Carpeta ${esc(dir)}/</a>` : ""}</div>
      ${f.d ? `<p><b>Qué es:</b> ${esc(f.d)}</p>` : ""}
      ${f.h ? `<p class="small"><b>Comentario del propio archivo:</b> <span class="muted">${esc(f.h)}</span></p>` : ""}
      ${!f.d && !f.h && META.dirs[dir] ? `<p class="small"><b>Carpeta:</b> ${esc(META.dirs[dir])}</p>` : ""}
      ${expl ? `<p class="small"><b>Explicado en:</b></p><ul class="small">${expl}</ul>` : lvl ? `<p class="small muted">Este archivo pertenece a la categoría que se explica en <a href="${lvl}.html">${esc(pageTitle[lvl])}</a>.</p>` : ""}
      ${f.s ? `<details><summary class="small">${f.s.length} clases y funciones detectadas automáticamente</summary><div class="ex-syms">${f.s.map((s) => `<a class="${s[2]}" href="#f=${esc(p)}&l=${s[1]}">${esc(s[0])}</a>`).join("")}</div></details>` : ""}`;
    const box = $(".ex-code", root);
    if (f.b) { box.innerHTML = `<p style="padding:14px">Archivo binario (imagen u otro). <a href="${raw}" target="_blank" rel="noopener">Descargar</a></p>`; return; }
    if (!cache[p]) {
      box.innerHTML = `<p style="padding:14px" class="muted">Descargando ${esc(p)} desde GitHub…</p>`;
      try {
        const r = await fetch(raw);
        if (!r.ok) throw new Error("HTTP " + r.status);
        cache[p] = await r.text();
      } catch (e) { box.innerHTML = `<p style="padding:14px" class="bad-t">No se pudo descargar: ${esc(e.message)}. <a href="${raw}" target="_blank" rel="noopener">Abrir directamente</a></p>`; return; }
    }
    if (parseHash().f !== p) return;
    const ext = p.split(".").pop();
    const lang = { cpp: "cpp", h: "cpp", c: "cpp", py: "python", sh: "bash", cmake: "cmake", txt: p.endsWith("CMakeLists.txt") ? "cmake" : "plaintext" }[ext] || "plaintext";
    const notes = (ANN[p] || []).map((n) => ({ line: n.line, html: n.html, from: `Del <a href="${n.page}.html#${n.anchor}">${esc(pageTitle[n.page] || n.page)}</a>` })).sort((a, b) => a.line - b.line);
    let text = cache[p];
    if (text.endsWith("\n")) text = text.slice(0, -1);
    const big = text.length > 400000;
    box.innerHTML = (big ? `<p class="small muted" style="padding:8px 12px">Archivo grande: se muestra sin colores.</p>` : "") + window.renderCodeTable({ code: text, lang: big ? "plaintext" : lang, start: 1, notes, idPrefix: "L", linkLines: "f=" + p + "&l=" });
    // los enlaces de número de línea usan el formato de hash del explorador
    $$("td.ln a", box).forEach((a) => (a.onclick = (e) => { e.preventDefault(); history.replaceState(null, "", "#f=" + p + "&l=" + a.textContent); highlightLine(parseInt(a.textContent, 10)); }));
    if (line) highlightLine(line);
    else window.scrollTo({ top: 0 });
  }

  function highlightLine(line) {
    $$(".ex-code tr.target", root).forEach((r) => r.classList.remove("target"));
    const row = document.getElementById("L" + line);
    if (row) { row.classList.add("target"); row.scrollIntoView({ block: "center" }); }
  }
})();
