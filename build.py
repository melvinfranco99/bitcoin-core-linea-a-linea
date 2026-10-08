#!/usr/bin/env python3
"""
Generador del sitio "Bitcoin Core, línea a línea".

Este script NO inventa código: cada fragmento que aparece en la web se extrae
del repositorio oficial de Bitcoin Core en un commit fijo (PIN_COMMIT). Si un
fragmento citado deja de existir, la generación falla. Así cualquiera puede
regenerar la web y comprobar que lo que se explica es exactamente lo que se
compila al crear un nodo.

Uso:
    python3 build.py                 # clona (si hace falta) y genera ./docs
    python3 build.py --src /ruta/a/bitcoin
"""
import argparse
import html
import json
import os
import re
import subprocess
import sys
from pathlib import Path

from descriptions import DIR_DESC, FILE_DESC, CATEGORIES

ROOT = Path(__file__).resolve().parent
CONTENT = ROOT / "content"
ASSETS = ROOT / "assets"
OUT = ROOT / "docs"

PIN_TAG = "v31.1"
PIN_COMMIT = "9be056a8a72b624dae9623b2f7bded92c2a21c91"
REPO_URL = "https://github.com/bitcoin/bitcoin"

# Orden pedagógico de las páginas. (archivo, título corto, título largo)
PAGES = [
    ("index", "Inicio", "Bitcoin Core, línea a línea"),
    ("nivel-0", "0 · No confíes, verifica", "Nivel 0 · No confíes: verifica el código tú mismo"),
    ("nivel-1", "1 · Bytes y hashes", "Nivel 1 · Bytes, hashes y serialización"),
    ("nivel-2", "2 · Claves y firmas", "Nivel 2 · Claves, firmas y direcciones"),
    ("nivel-3", "3 · Transacciones", "Nivel 3 · Transacciones"),
    ("nivel-4", "4 · Script", "Nivel 4 · Script: el lenguaje que bloquea las monedas"),
    ("nivel-5", "5 · Bloques y PoW", "Nivel 5 · Bloques, árbol de Merkle y prueba de trabajo"),
    ("nivel-6", "6 · Validación", "Nivel 6 · Validación: el corazón del consenso"),
    ("nivel-7", "7 · UTXO y disco", "Nivel 7 · Estado: el conjunto UTXO, la base de datos y el disco"),
    ("nivel-8", "8 · Red P2P", "Nivel 8 · La red P2P"),
    ("nivel-9", "9 · Mempool y minería", "Nivel 9 · Mempool, política y minería"),
    ("nivel-10", "10 · Soft forks", "Nivel 10 · Cómo cambian las reglas: soft forks y despliegues"),
    ("nivel-11", "11 · Wallet", "Nivel 11 · La cartera (wallet)"),
    ("nivel-12", "12 · Arranque y RPC", "Nivel 12 · Arranque, RPC, interfaces y utilidades"),
    ("nivel-13", "13 · Auditar", "Nivel 13 · Cómo auditar Bitcoin Core por tu cuenta"),
    ("explorador", "Explorador de código", "Explorador: los archivos del repositorio, uno a uno"),
    ("glosario", "Glosario", "Glosario"),
]

VENDORED = ("src/secp256k1/", "src/leveldb/", "src/crc32c/", "src/minisketch/",
            "src/univalue/", "src/crypto/ctaes/", "src/ipc/libmultiprocess/")


class BuildError(Exception):
    pass


# --------------------------------------------------------------------------
# Repositorio fuente
# --------------------------------------------------------------------------
def ensure_source(src: Path) -> Path:
    if not (src / ".git").exists() and not (src / "src" / "validation.cpp").exists():
        print(f"Clonando {REPO_URL} @ {PIN_TAG} en {src} …")
        subprocess.run(["git", "clone", "--depth", "1", "--branch", PIN_TAG, REPO_URL, str(src)], check=True)
    head = subprocess.run(["git", "-C", str(src), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
    if head and head != PIN_COMMIT:
        raise BuildError(f"El repositorio fuente está en {head}, se esperaba {PIN_COMMIT} ({PIN_TAG}).")
    return src


_file_cache: dict = {}


def read_lines(src: Path, rel: str):
    if rel not in _file_cache:
        p = src / rel
        if not p.exists():
            raise BuildError(f"No existe el archivo citado: {rel}")
        _file_cache[rel] = p.read_text(encoding="utf-8", errors="replace").split("\n")
    return _file_cache[rel]


def strip_literals(line: str) -> str:
    line = re.sub(r'"(?:\\.|[^"\\])*"', '""', line)
    line = re.sub(r"'(?:\\.|[^'\\])*'", "''", line)
    line = line.split("//")[0]
    return line


def brace_end(lines, start_idx):
    """Devuelve el índice de la línea que cierra la primera llave abierta desde start_idx."""
    depth = 0
    opened = False
    in_block_comment = False
    for i in range(start_idx, len(lines)):
        s = lines[i]
        if in_block_comment:
            if "*/" in s:
                s = s.split("*/", 1)[1]
                in_block_comment = False
            else:
                continue
        s = re.sub(r"/\*.*?\*/", "", s)
        if "/*" in s:
            s = s.split("/*", 1)[0]
            in_block_comment = True
        s = strip_literals(s)
        for ch in s:
            if ch == "{":
                depth += 1
                opened = True
            elif ch == "}":
                depth -= 1
                if opened and depth == 0:
                    return i
    raise BuildError("No se encontró la llave de cierre")


def find_line(lines, needle, start=0, rel=""):
    for i in range(start, len(lines)):
        if needle in lines[i]:
            return i
    raise BuildError(f"No se encontró «{needle}» en {rel} a partir de la línea {start + 1}")


def locate(src, attrs):
    rel = attrs["file"]
    lines = read_lines(src, rel)
    after = 0
    if "after" in attrs:
        after = find_line(lines, attrs["after"], 0, rel) + 1
    if "lines" in attrs:
        a, b = attrs["lines"].split("-")
        a, b = int(a) - 1, int(b) - 1
        if b >= len(lines):
            raise BuildError(f"{rel} sólo tiene {len(lines)} líneas")
    elif "fn" in attrs:
        name = attrs["fn"]
        a = None
        for i in range(after, len(lines)):
            if re.search(r"(^|[\s:*&])" + re.escape(name) + r"\s*\(", lines[i]) and not lines[i].lstrip().startswith(("//", "*", "return", "if", "else")):
                # ¿definición (llega a '{' antes que a ';')?
                j, joined = i, ""
                while j < len(lines) and j < i + 12:
                    joined += strip_literals(lines[j])
                    if "{" in joined or ";" in joined:
                        break
                    j += 1
                pos_b, pos_s = joined.find("{"), joined.find(";")
                if pos_b != -1 and (pos_s == -1 or pos_b < pos_s):
                    a = i
                    break
        if a is None:
            raise BuildError(f"No se encontró la definición de {name} en {rel}")
        # incluir líneas de plantilla previas (template<...>)
        if a > 0 and lines[a - 1].lstrip().startswith("template"):
            a -= 1
        b = brace_end(lines, a)
    elif "start" in attrs:
        a = find_line(lines, attrs["start"], after, rel)
        if "end" in attrs:
            b = find_line(lines, attrs["end"], a, rel)
        else:
            b = brace_end(lines, a)
    else:
        raise BuildError(f"code-ref sin fn/lines/start en {rel}")
    return rel, a, b


_A = r"""((?:[^>"']|"[^"]*"|'[^']*')*?)"""
NOTE_RE = re.compile(r"<n\s+" + _A + r">(.*?)</n>", re.S)
CREF_RE = re.compile(r"<code-ref\s+" + _A + r"(?:/>|>(.*?)</code-ref>)", re.S)
SRC_RE = re.compile(r"<src\s+" + _A + r">(.*?)</src>", re.S)
ATTR_RE = re.compile(r'(\w+)=(?:"([^"]*)"|\'([^\']*)\')')


def parse_attrs(s):
    return {m.group(1): html.unescape(m.group(2) if m.group(2) is not None else m.group(3)) for m in ATTR_RE.finditer(s)}


ANNOTATIONS: dict = {}
STATS = {"crefs": 0, "notes": 0, "annotated_lines": set()}


def gh_link(rel, a=None, b=None):
    u = f"{REPO_URL}/blob/{PIN_COMMIT}/{rel}"
    if a is not None:
        u += f"#L{a}" + (f"-L{b}" if b and b != a else "")
    return u


def render_cref(src, attr_str, body, page, counter):
    attrs = parse_attrs(attr_str)
    rel, a, b = locate(src, attrs)
    lines = read_lines(src, rel)
    code = "\n".join(lines[a:b + 1])
    notes = []
    cursor = a
    for m in re.finditer(NOTE_RE, body):
        nattrs = parse_attrs(m.group(1))
        needle = nattrs.get("m")
        if needle is None:
            raise BuildError(f"Nota sin m= en {rel}")
        idx = None
        for i in range(cursor, b + 1):
            if needle in lines[i]:
                idx = i
                break
        if idx is None:
            raise BuildError(f"[{page}] La nota «{needle}» no aparece en {rel}:{a + 1}-{b + 1} (después de la línea {cursor + 1})")
        cursor = idx
        notes.append({"line": idx + 1, "html": m.group(2).strip()})
        STATS["annotated_lines"].add((rel, idx + 1))
    STATS["crefs"] += 1
    STATS["notes"] += len(notes)
    anchor = f"c{counter}"
    title = attrs.get("title", "")
    for n in notes:
        ANNOTATIONS.setdefault(rel, []).append({"line": n["line"], "html": n["html"], "page": page, "anchor": anchor})
    ANNOTATIONS.setdefault("__ranges__", []).append({"file": rel, "a": a + 1, "b": b + 1, "page": page, "anchor": anchor, "title": title})
    lang = "python" if rel.endswith(".py") else ("bash" if rel.endswith(".sh") else ("cmake" if "CMake" in rel or rel.endswith(".cmake") else "cpp"))
    return (
        f'<figure class="cref" id="{anchor}" data-start="{a + 1}" data-file="{html.escape(rel)}">'
        f'<figcaption><span class="cref-file">{html.escape(rel)}</span>'
        f'<span class="cref-lines">líneas {a + 1}–{b + 1}</span>'
        + (f'<span class="cref-title">{html.escape(title)}</span>' if title else "")
        + f'<span class="cref-actions"><a href="{gh_link(rel, a + 1, b + 1)}" target="_blank" rel="noopener" title="Ver en GitHub (commit fijado)">GitHub ↗</a>'
        f'<a href="explorador.html#f={html.escape(rel)}&amp;l={a + 1}" title="Abrir el archivo completo en el explorador">Archivo completo</a>'
        f'<button type="button" class="cref-toggle" title="Mostrar u ocultar explicaciones">Explicaciones: sí</button></span></figcaption>'
        f'<pre class="cref-src"><code class="language-{lang}">{html.escape(code)}</code></pre>'
        f'<script type="application/json" class="cref-notes">{json.dumps(notes, ensure_ascii=False).replace("</", "<\\/")}</script>'
        f"</figure>"
    )


# --------------------------------------------------------------------------
# Tablas generadas automáticamente desde el código
# --------------------------------------------------------------------------
def auto_reject_reasons(src):
    files = ["src/consensus/tx_check.cpp", "src/consensus/tx_verify.cpp", "src/validation.cpp", "src/pow.cpp"]
    rows = []
    seen = set()
    for rel in files:
        lines = read_lines(src, rel)
        for i, l in enumerate(lines):
            for m in re.finditer(r'"((?:bad|high|time|unexpected|non|txn)[a-z0-9\-]*(?:\(0x%08x\))?)"', l):
                reason = m.group(1)
                ctx = " ".join(lines[max(0, i - 2):i + 2])
                if "Invalid(" not in ctx and "state.Invalid" not in ctx and "Error(" not in ctx:
                    continue
                key = (rel, reason)
                if key in seen:
                    continue
                seen.add(key)
                kind = "TX" if "TxValidationResult" in ctx else ("BLOQUE" if "BlockValidationResult" in ctx else "—")
                rows.append((reason, rel, i + 1, kind))
    out = ['<div class="table-wrap"><table class="data"><thead><tr><th>Motivo de rechazo</th><th>Tipo</th><th>Dónde está la regla</th></tr></thead><tbody>']
    for reason, rel, ln, kind in rows:
        out.append(f'<tr><td><code>{html.escape(reason)}</code></td><td>{kind}</td>'
                   f'<td><a href="explorador.html#f={rel}&amp;l={ln}">{rel}:{ln}</a></td></tr>')
    out.append("</tbody></table></div>")
    out.append(f'<p class="muted small">Tabla generada automáticamente: {len(rows)} cadenas encontradas buscando <code>state.Invalid(…)</code> en {", ".join(files)}.</p>')
    return "\n".join(out)


def auto_msgtypes(src):
    rel = "src/protocol.h"
    lines = read_lines(src, rel)
    rows = []
    for i, l in enumerate(lines):
        m = re.search(r'inline constexpr const char\* (\w+)\{"(\w+)"\}', l)
        if not m:
            continue
        # comentario inmediatamente anterior
        j = i - 1
        com = []
        while j >= 0 and (lines[j].strip().startswith(("*", "/**", "//")) and not lines[j].strip().startswith("*/")):
            com.insert(0, lines[j].strip().lstrip("/*! ").strip())
            j -= 1
        if j >= 0 and lines[j].strip() == "*/":
            k = j - 1
            while k >= 0 and not lines[k].strip().startswith("/**"):
                com.insert(0, lines[k].strip().lstrip("* ").strip())
                k -= 1
        rows.append((m.group(2), i + 1, " ".join(c for c in com if c)))
    out = ['<div class="table-wrap"><table class="data"><thead><tr><th>Mensaje</th><th>Línea</th><th>Comentario original del código (inglés)</th></tr></thead><tbody>']
    for name, ln, com in rows:
        out.append(f'<tr><td><code>{name}</code></td><td><a href="explorador.html#f={rel}&amp;l={ln}">{ln}</a></td><td class="small">{html.escape(com)}</td></tr>')
    out.append("</tbody></table></div>")
    return "\n".join(out)


def auto_opcodes(src):
    rel = "src/script/interpreter.cpp"
    lines = read_lines(src, rel)
    ops = {}
    for i, l in enumerate(lines):
        m = re.match(r"\s*case (OP_\w+):", l)
        if m and m.group(1) not in ops:
            ops[m.group(1)] = i + 1
    return ops


def auto_opcode_table(src):
    rel = "src/script/script.h"
    lines = read_lines(src, rel)
    start = find_line(lines, "enum opcodetype", 0, rel)
    end = find_line(lines, "};", start, rel)
    impl = auto_opcodes(src)
    out = ['<div class="table-wrap"><table class="data compact"><thead><tr><th>Opcode</th><th>Valor</th><th>Definido</th><th>Implementado en interpreter.cpp</th></tr></thead><tbody>']
    for i in range(start, end):
        m = re.match(r"\s*(OP_\w+)\s*=\s*([^,]+),?", lines[i])
        if m:
            name, val = m.group(1), m.group(2).strip()
            impl_ln = impl.get(name)
            impl_cell = f'<a href="explorador.html#f={"src/script/interpreter.cpp"}&amp;l={impl_ln}">línea {impl_ln}</a>' if impl_ln else '<span class="muted">sin <code>case</code> propio</span>'
            out.append(f'<tr><td><code>{name}</code></td><td><code>{html.escape(val)}</code></td>'
                       f'<td><a href="explorador.html#f={rel}&amp;l={i + 1}">script.h:{i + 1}</a></td><td>{impl_cell}</td></tr>')
    out.append("</tbody></table></div>")
    return "\n".join(out)


def auto_init_steps(src):
    rel = "src/init.cpp"
    lines = read_lines(src, rel)
    out = ['<ol class="steps">']
    for i, l in enumerate(lines):
        m = re.search(r"\*+ Step (\d+): (.*)$", l)
        if m:
            out.append(f'<li><a href="explorador.html#f={rel}&amp;l={i + 1}">Paso {m.group(1)} (init.cpp:{i + 1})</a> — <code>{html.escape(m.group(2).strip())}</code></li>')
    out.append("</ol>")
    return "\n".join(out)


def auto_policy_constants(src):
    rel = "src/policy/policy.h"
    lines = read_lines(src, rel)
    out = ['<div class="table-wrap"><table class="data compact"><thead><tr><th>Constante</th><th>Valor</th><th>Comentario original</th></tr></thead><tbody>']
    for i, l in enumerate(lines):
        m = re.match(r"static (?:constexpr|const) [\w:<>\s]+? (\w+)\s*(?:\{(.*)\}|=\s*(.*));", l)
        if m:
            name = m.group(1)
            val = (m.group(2) or m.group(3) or "").strip()
            com = lines[i - 1].strip().lstrip("/*!").rstrip("*/").strip() if i > 0 and lines[i - 1].strip().startswith(("/**", "//")) else ""
            out.append(f'<tr><td><a href="explorador.html#f={rel}&amp;l={i + 1}"><code>{name}</code></a></td><td><code>{html.escape(val[:80])}</code></td><td class="small">{html.escape(com)}</td></tr>')
    out.append("</tbody></table></div>")
    return "\n".join(out)


AUTO = {
    "reject-reasons": auto_reject_reasons,
    "msgtypes": auto_msgtypes,
    "opcodes": auto_opcode_table,
    "init-steps": auto_init_steps,
    "policy-constants": auto_policy_constants,
}


# --------------------------------------------------------------------------
# Índice de archivos para el explorador
# --------------------------------------------------------------------------
FUNC_RE = re.compile(r"^(?!\s)(?!(?:if|for|while|switch|return|else|namespace|using|typedef|static_assert|#|//|/\*|\*))"
                     r"[\w:<>,~\*&\s\[\]]*?\b((?:\w+::)*~?\w+)\s*\(")
CLASS_RE = re.compile(r"^(?:class|struct)\s+(?:\w+\s+)?(\w+)(?:\s+final)?\s*(?::[^;{]*)?\s*\{?\s*$")


def header_comment(lines):
    """Comentario de documentación al principio del archivo (tras el copyright,
    includes y guardas). Si antes aparece código, no hay comentario de cabecera."""
    n = len(lines)
    i = 0
    while i < n:
        s = lines[i].strip()
        forward_decl = s.startswith(("class ", "struct ", "enum class ")) and s.endswith(";")
        if not s or forward_decl or s.startswith(("#include", "#ifndef", "#define", "#endif", "#pragma", "#if", "#else", "using ", "namespace ")):
            i += 1
            continue
        if s.startswith("//") and any(w in s for w in ("Copyright", "Distributed under", "file COPYING", "mit-license", "SPDX")):
            i += 1
            continue
        break
    text = []
    if i < n:
        s = lines[i].strip()
        if s.startswith("/*"):
            k = i
            while k < n:
                t = re.sub(r"^/\*\*?!?<?|\*/$|^\*", "", lines[k].strip()).strip()
                if t:
                    text.append(t)
                if "*/" in lines[k]:
                    break
                k += 1
        elif s.startswith("//"):
            k = i
            while k < n and lines[k].strip().startswith("//"):
                text.append(lines[k].strip().lstrip("/!").strip())
                k += 1
    t = " ".join(x for x in text if x)
    return t[:420] + ("…" if len(t) > 420 else "")


def file_category(rel):
    for prefix, cat in CATEGORIES:
        if rel.startswith(prefix) or rel == prefix:
            return cat
    return "otros"


def build_file_index(src):
    files = subprocess.run(["git", "-C", str(src), "ls-files"], capture_output=True, text=True, check=True).stdout.split("\n")
    files = [f for f in files if f]
    index = []
    total_lines = 0
    code_lines = 0
    for rel in files:
        p = src / rel
        try:
            raw = p.read_bytes()
        except (IsADirectoryError, FileNotFoundError):
            continue
        binary = b"\0" in raw[:4000]
        nlines = 0 if binary else raw.count(b"\n")
        total_lines += nlines
        entry = {"p": rel, "n": nlines, "c": file_category(rel)}
        if binary:
            entry["b"] = 1
        desc = FILE_DESC.get(rel)
        if desc:
            entry["d"] = desc
        if not binary and rel.endswith((".h", ".cpp", ".c", ".py")):
            lines = raw.decode("utf-8", "replace").split("\n")
            if rel.startswith("src/") and entry["c"] not in ("tests", "gui", "terceros") and rel.endswith((".h", ".cpp")):
                code_lines += nlines
            hc = header_comment(lines) if rel.endswith((".h", ".cpp", ".c")) else ""
            if hc:
                entry["h"] = hc
            syms = []
            if rel.endswith((".h", ".cpp")) and not rel.startswith(VENDORED):
                for i, l in enumerate(lines):
                    cm = CLASS_RE.match(l)
                    if cm:
                        syms.append([cm.group(1), i + 1, "c"])
                        continue
                    fm = FUNC_RE.match(l)
                    if fm and not l.rstrip().endswith(";") and not l.startswith(("    ", "\t")):
                        name = fm.group(1)
                        if name in ("if", "for", "while", "switch", "return", "sizeof", "defined", "TEST_CASE", "LOCK"):
                            continue
                        syms.append([name, i + 1, "f"])
            elif rel.endswith(".py"):
                for i, l in enumerate(lines):
                    m = re.match(r"\s*(?:def|class)\s+(\w+)", l)
                    if m:
                        syms.append([m.group(1), i + 1, "f"])
            if syms:
                entry["s"] = syms[:400]
        index.append(entry)
    return index, {"files": len(index), "lines": total_lines, "core_lines": code_lines}


# --------------------------------------------------------------------------
# Plantilla de página
# --------------------------------------------------------------------------
def nav_html(current):
    items = []
    for slug, short, _ in PAGES:
        cls = ' class="active"' if slug == current else ""
        items.append(f'<li><a href="{slug}.html"{cls}>{html.escape(short)}</a></li>')
    return "\n".join(items)


def page_html(slug, title, long_title, body, needs):
    idx = [p[0] for p in PAGES].index(slug)
    prev_p = PAGES[idx - 1] if idx > 0 else None
    next_p = PAGES[idx + 1] if idx + 1 < len(PAGES) else None
    pn = '<nav class="prevnext">'
    pn += f'<a class="prev" href="{prev_p[0]}.html"><span>← Anterior</span>{html.escape(prev_p[2])}</a>' if prev_p else "<span></span>"
    pn += f'<a class="next" href="{next_p[0]}.html"><span>Siguiente →</span>{html.escape(next_p[2])}</a>' if next_p else "<span></span>"
    pn += "</nav>"
    mermaid = ""
    if "mermaid" in needs:
        mermaid = '<script type="module" src="assets/diagrams.js"></script>'
    page_title = "Bitcoin Core, línea a línea" if slug == "index" else f"{short_title(slug)} · Bitcoin Core, línea a línea"
    wide = " wide" if slug == "explorador" else ""
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(page_title)}</title>
<meta name="description" content="Explicación sencilla, por niveles y con juegos interactivos de todo el código fuente de Bitcoin Core {PIN_TAG}, para auditarlo uno mismo.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css" id="hljs-light">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css" id="hljs-dark" disabled>
<link rel="stylesheet" href="assets/style.css">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='30' fill='%23f7931a'/%3E%3Ctext x='32' y='44' font-size='36' text-anchor='middle' fill='white' font-family='Arial' font-weight='bold'%3E₿%3C/text%3E%3C/svg%3E">
<script>try{{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t;}}catch(e){{}}</script>
</head>
<body data-page="{slug}">
<header class="topbar">
  <button class="menu-btn" aria-label="Abrir menú" type="button">☰</button>
  <a class="brand" href="index.html"><span class="logo">₿</span> Bitcoin Core, <em>línea a línea</em></a>
  <span class="pin" title="Todo el código citado procede de este commit exacto">{PIN_TAG} · <code>{PIN_COMMIT[:12]}</code></span>
  <button class="theme-btn" type="button" aria-label="Cambiar tema">◐</button>
</header>
<div class="layout{wide}">
  <aside class="sidebar">
    <nav><ol class="levels">{nav_html(slug)}</ol></nav>
    <div class="progress-box"><div class="muted small">Tu progreso</div><div class="progress"><div class="bar"></div></div><div class="small progress-label"></div></div>
  </aside>
  <main class="content" id="main">
    {body}
    {pn if slug not in ("explorador",) else ""}
    <footer class="foot">
      <p>Todo el código mostrado se extrae automáticamente de <a href="{REPO_URL}/tree/{PIN_COMMIT}" target="_blank" rel="noopener">bitcoin/bitcoin @ {PIN_COMMIT[:12]}</a> (etiqueta {PIN_TAG}) con <code>build.py</code>. No te fíes de esta web tampoco: compara cada fragmento con tu propia copia del código.</p>
      <p class="muted small">Proyecto educativo independiente, sin relación oficial con los desarrolladores de Bitcoin Core. Código de Bitcoin Core bajo licencia MIT.</p>
    </footer>
  </main>
  <aside class="toc"><div class="toc-title">En esta página</div><ol></ol></aside>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/cpp.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/python.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/bash.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/cmake.min.js"></script>
<script src="assets/data.js"></script>
<script src="assets/crypto.js"></script>
<script src="assets/app.js"></script>
<script src="assets/games.js"></script>
{'<script src="assets/explorer.js"></script>' if slug == "explorador" else ""}
{mermaid}
</body>
</html>
"""


def short_title(slug):
    for s, short, long_ in PAGES:
        if s == slug:
            return long_
    return slug


def render_page(src, slug, raw, file_stats):
    counter = [0]

    def src_link(m):
        attrs = parse_attrs(m.group(1))
        rel = attrs["file"]
        lines = read_lines(src, rel)
        ln = None
        if "m" in attrs:
            ln = find_line(lines, attrs["m"], 0, rel) + 1
        label = m.group(2) or (rel + (f":{ln}" if ln else ""))
        href = f"explorador.html#f={rel}" + (f"&amp;l={ln}" if ln else "")
        return f'<a class="srclink" href="{href}">{label}</a>'

    raw = re.sub(SRC_RE, src_link, raw)

    def cref_sub(m):
        counter[0] += 1
        return render_cref(src, m.group(1), m.group(2) or "", slug, counter[0])

    body = re.sub(CREF_RE, cref_sub, raw)

    def auto_sub(m):
        kind = parse_attrs(m.group(1)).get("kind")
        if kind not in AUTO:
            raise BuildError(f"auto-table desconocida: {kind}")
        return AUTO[kind](src)

    body = re.sub(r"<auto-table\s+([^>]*?)/>", auto_sub, body)


    repl = {
        "{{TAG}}": PIN_TAG,
        "{{COMMIT}}": PIN_COMMIT,
        "{{COMMIT12}}": PIN_COMMIT[:12],
        "{{REPO}}": REPO_URL,
        "{{FILES}}": f"{file_stats['files']:,}".replace(",", "."),
        "{{LINES}}": f"{file_stats['lines']:,}".replace(",", "."),
        "{{CORE_LINES}}": f"{file_stats['core_lines']:,}".replace(",", "."),
    }
    for k, v in repl.items():
        body = body.replace(k, v)
    needs = set()
    if 'class="mermaid"' in body:
        needs.add("mermaid")
    long_title = short_title(slug)
    return page_html(slug, long_title, long_title, body, needs)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=str(ROOT / "bitcoin-src"))
    args = ap.parse_args()
    src = ensure_source(Path(args.src))

    OUT.mkdir(exist_ok=True)
    (OUT / "assets").mkdir(exist_ok=True)

    index, fstats = build_file_index(src)
    pages_out = {}
    errors = []
    for slug, short, long_ in PAGES:
        f = CONTENT / f"{slug}.html"
        if not f.exists():
            errors.append(f"Falta content/{slug}.html")
            continue
        try:
            pages_out[slug] = render_page(src, slug, f.read_text(encoding="utf-8"), fstats)
        except BuildError as e:
            errors.append(f"{slug}: {e}")
    if errors:
        print("ERRORES:\n  " + "\n  ".join(errors), file=sys.stderr)
        sys.exit(1)

    for slug, text in pages_out.items():
        (OUT / f"{slug}.html").write_text(text, encoding="utf-8")

    # Datos compartidos
    ranges = ANNOTATIONS.pop("__ranges__", [])
    annotated_files = {}
    for r in ranges:
        annotated_files.setdefault(r["file"], []).append(r)
    for e in index:
        if e["p"] in annotated_files:
            e["x"] = [[r["page"], r["anchor"], r["a"], r["b"], r["title"]] for r in annotated_files[e["p"]]]
    meta = {"tag": PIN_TAG, "commit": PIN_COMMIT, "repo": REPO_URL,
            "pages": [[s, sh, lo] for s, sh, lo in PAGES],
            "dirs": DIR_DESC, "stats": fstats,
            "opcodes": auto_opcodes(src)}
    (OUT / "assets" / "data.js").write_text("window.BTC_META=" + json.dumps(meta, ensure_ascii=False) + ";\n", encoding="utf-8")
    (OUT / "assets" / "files.json").write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (OUT / "assets" / "annotations.json").write_text(json.dumps(ANNOTATIONS, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    for f in ASSETS.iterdir():
        if f.is_file():
            (OUT / "assets" / f.name).write_bytes(f.read_bytes())
    (OUT / ".nojekyll").write_text("")

    print(f"OK · {len(pages_out)} páginas · {STATS['crefs']} fragmentos de código · {STATS['notes']} notas línea a línea · "
          f"{fstats['files']} archivos indexados · {fstats['lines']} líneas totales ({fstats['core_lines']} de C++ propio en src/)")


if __name__ == "__main__":
    try:
        main()
    except BuildError as e:
        print("ERROR:", e, file=sys.stderr)
        sys.exit(1)
