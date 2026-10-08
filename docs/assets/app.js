/* Comportamiento común: tema, menú, índice, bloques de código anotados,
 * cuestionarios, lista de comprobación y progreso. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
  };
  window.BTCStore = store;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  window.esc = esc;

  // ---------- Tema ----------
  function effectiveDark() {
    const t = document.documentElement.dataset.theme;
    if (t) return t === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function syncHljs() {
    const dark = effectiveDark();
    const l = $("#hljs-light"), d = $("#hljs-dark");
    if (l && d) { l.disabled = dark; d.disabled = !dark; }
    document.dispatchEvent(new CustomEvent("themechange", { detail: { dark } }));
  }
  window.isDark = effectiveDark;
  $(".theme-btn")?.addEventListener("click", () => {
    const next = effectiveDark() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    store.set("theme", next);
    try { localStorage.setItem("theme", next); } catch (e) { /* */ }
    syncHljs();
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncHljs);
  syncHljs();

  // ---------- Menú móvil ----------
  $(".menu-btn")?.addEventListener("click", () => document.body.classList.toggle("menu-open"));
  $(".content")?.addEventListener("click", () => document.body.classList.remove("menu-open"));

  // ---------- Índice de la página ----------
  const tocList = $(".toc ol");
  const heads = $$(".content h2, .content h3").filter((h) => !h.closest(".game, .quiz, .ex-head, figure"));
  heads.forEach((h, i) => {
    if (!h.id) h.id = "s-" + (h.textContent || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "s" + i;
    if (tocList) {
      const li = document.createElement("li");
      li.innerHTML = `<a href="#${h.id}" class="${h.tagName === "H3" ? "lvl3" : ""}">${esc(h.textContent)}</a>`;
      tocList.appendChild(li);
    }
  });
  if (tocList && heads.length) {
    const links = $$(".toc a");
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id));
        }
      });
    }, { rootMargin: "-60px 0px -75% 0px" });
    heads.forEach((h) => obs.observe(h));
  }

  // ---------- Código resaltado y dividido en líneas ----------
  // highlight.js produce HTML con <span> que pueden cruzar saltos de línea
  // (comentarios multilínea). Cerramos y reabrimos las etiquetas en cada línea.
  function splitHighlighted(htmlStr) {
    const lines = [];
    let cur = "";
    const stack = [];
    const re = /(<span[^>]*>)|(<\/span>)|(\n)|([^<\n]+)|(<)/g;
    let m;
    while ((m = re.exec(htmlStr))) {
      if (m[1]) { stack.push(m[1]); cur += m[1]; }
      else if (m[2]) { stack.pop(); cur += m[2]; }
      else if (m[3]) { cur += "</span>".repeat(stack.length); lines.push(cur); cur = stack.join(""); }
      else cur += m[4] || m[5];
    }
    lines.push(cur);
    return lines;
  }
  function highlight(code, lang) {
    if (window.hljs && code.length < 400000) {
      try { return window.hljs.highlight(code, { language: lang || "cpp", ignoreIllegals: true }).value; } catch (e) { /* */ }
    }
    return esc(code);
  }
  /**
   * Crea una tabla de código con números de línea reales y notas intercaladas.
   * opts: { code, lang, start, notes:[{line, html, from}], file, linkLines }
   */
  function renderCodeTable(opts) {
    const lines = splitHighlighted(highlight(opts.code, opts.lang));
    const byLine = {};
    (opts.notes || []).forEach((n, i) => { (byLine[n.line] = byLine[n.line] || []).push({ ...n, idx: i + 1 }); });
    const rows = [];
    for (let i = 0; i < lines.length; i++) {
      const ln = opts.start + i;
      const notes = byLine[ln];
      rows.push(`<tr id="${opts.idPrefix || "L"}${ln}" class="${notes ? "has-note" : ""}"><td class="ln">${opts.linkLines ? `<a href="#${opts.linkLines}${ln}">${ln}</a>` : ln}</td><td class="src">${lines[i] || " "}</td></tr>`);
      if (notes) {
        notes.forEach((n) => {
          rows.push(`<tr class="noterow"><td colspan="2"><div class="note"><span class="num">${n.idx}</span>${n.html}${n.from ? `<span class="from">${n.from}</span>` : ""}</div></td></tr>`);
        });
      }
    }
    return `<div class="codeview"><table>${rows.join("")}</table></div>`;
  }
  window.renderCodeTable = renderCodeTable;

  $$("figure.cref").forEach((fig) => {
    const codeEl = $("pre.cref-src code", fig);
    const code = codeEl.textContent;
    const lang = (codeEl.className.match(/language-(\w+)/) || [])[1] || "cpp";
    let notes = [];
    try { notes = JSON.parse($("script.cref-notes", fig).textContent); } catch (e) { /* */ }
    const start = parseInt(fig.dataset.start, 10);
    const wrap = document.createElement("div");
    wrap.innerHTML = renderCodeTable({ code, lang, start, notes, idPrefix: fig.id + "-L" });
    fig.appendChild(wrap.firstChild);
    const btn = $(".cref-toggle", fig);
    if (!notes.length) btn.remove();
    btn?.addEventListener("click", () => {
      fig.classList.toggle("notes-off");
      btn.textContent = fig.classList.contains("notes-off") ? "Explicaciones: no" : "Explicaciones: sí";
    });
  });

  // ---------- Cuestionarios ----------
  // <div class="quiz" data-title="..."><script type="application/json">[{q, o:[...], a: idx, why}]</script></div>
  const page = document.body.dataset.page;
  $$(".quiz").forEach((qz, qi) => {
    let data = [];
    try { data = JSON.parse($("script", qz).textContent); } catch (e) { return; }
    const title = qz.dataset.title || "Comprueba lo que has aprendido";
    let html = `<h3>🧠 ${esc(title)}</h3>`;
    data.forEach((item, i) => {
      html += `<div class="q" data-a="${item.a}"><p>${i + 1}. ${item.q}</p>`;
      item.o.forEach((opt, j) => { html += `<label><input type="radio" name="q${qi}-${i}" value="${j}">${opt}</label>`; });
      html += `<div class="why">${item.why || ""}</div></div>`;
    });
    html += `<p class="score"></p>`;
    qz.innerHTML = html;
    const update = () => {
      const qs = $$(".q", qz);
      const answered = qs.filter((q) => q.classList.contains("answered"));
      const right = qs.filter((q) => q.classList.contains("is-right"));
      $(".score", qz).textContent = answered.length ? `Aciertos: ${right.length} de ${qs.length}` + (right.length === qs.length ? " · ¡Nivel superado! 🎉" : "") : "";
      if (right.length === qs.length) markDone(page);
    };
    $$(".q", qz).forEach((q) => {
      q.addEventListener("change", (e) => {
        const a = parseInt(q.dataset.a, 10);
        const v = parseInt(e.target.value, 10);
        q.classList.add("answered");
        q.classList.toggle("is-right", a === v);
        $$("label", q).forEach((l, j) => {
          l.classList.remove("right", "wrong");
          if (j === a) l.classList.add("right");
          else if (j === v) l.classList.add("wrong");
        });
        update();
      });
    });
  });

  // ---------- Lista de comprobación (auditoría) ----------
  $$("ul.checklist").forEach((ul) => {
    const key = "check-" + (ul.dataset.key || page);
    const state = store.get(key, {});
    $$("li", ul).forEach((li, i) => {
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!state[i];
      li.classList.toggle("done", cb.checked);
      li.prepend(cb);
      cb.addEventListener("change", () => {
        state[i] = cb.checked;
        li.classList.toggle("done", cb.checked);
        store.set(key, state);
      });
    });
  });

  // ---------- Progreso ----------
  function markDone(slug) {
    const done = store.get("done", {});
    if (!done[slug]) { done[slug] = true; store.set("done", done); renderProgress(); }
  }
  window.markDone = markDone;
  function renderProgress() {
    const done = store.get("done", {});
    const levels = (window.BTC_META?.pages || []).filter((p) => p[0].startsWith("nivel-"));
    let n = 0;
    $$(".levels a").forEach((a) => {
      const slug = a.getAttribute("href").replace(".html", "");
      a.classList.toggle("done", !!done[slug]);
    });
    levels.forEach((p) => { if (done[p[0]]) n++; });
    const pct = levels.length ? Math.round((n / levels.length) * 100) : 0;
    const bar = $(".progress .bar");
    if (bar) bar.style.width = pct + "%";
    const lab = $(".progress-label");
    if (lab) lab.textContent = `${n} de ${levels.length} niveles completados`;
  }
  renderProgress();
  if (page && page.startsWith("nivel-")) {
    const pn = $(".prevnext");
    if (pn) {
      const b = document.createElement("div");
      b.className = "mark-done";
      const done = store.get("done", {})[page];
      b.innerHTML = `<button class="btn ${done ? "sec" : ""}" type="button">${done ? "✓ Nivel completado" : "Marcar este nivel como completado"}</button>`;
      pn.before(b);
      $("button", b).addEventListener("click", (e) => { markDone(page); e.target.textContent = "✓ Nivel completado"; e.target.classList.add("sec"); });
    }
  }

  // Si llegamos con #c3 resaltamos ese fragmento
  if (location.hash && /^#c\d+$/.test(location.hash)) {
    const f = $(location.hash);
    if (f) setTimeout(() => f.scrollIntoView({ block: "start" }), 50);
  }
})();
