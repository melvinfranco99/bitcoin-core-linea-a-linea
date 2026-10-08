// Diagramas con Mermaid. Se re-dibujan al cambiar de tema.
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.esm.min.mjs";

const sources = new Map();
document.querySelectorAll(".mermaid").forEach((el, i) => sources.set(el, el.textContent));

async function draw() {
  const dark = window.isDark ? window.isDark() : false;
  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    securityLevel: "strict",
    fontFamily: "Inter, system-ui, sans-serif",
    themeVariables: dark ? {
      primaryColor: "#2a2116", primaryBorderColor: "#f7931a", primaryTextColor: "#e9e9ec",
      lineColor: "#9a9aa5", secondaryColor: "#182637", tertiaryColor: "#1b1c20",
      noteBkgColor: "#231f17", noteTextColor: "#e9e9ec", actorBkg: "#2a2116", actorTextColor: "#e9e9ec",
      signalColor: "#e9e9ec", signalTextColor: "#e9e9ec", labelBoxBkgColor: "#2a2116", textColor: "#e9e9ec",
      edgeLabelBackground: "#1b1c20", clusterBkg: "#17181b", clusterBorder: "#2c2d33",
    } : {
      primaryColor: "#fff1de", primaryBorderColor: "#e8850c", primaryTextColor: "#1d1d1f",
      lineColor: "#6b6b73", secondaryColor: "#e8f1fc", tertiaryColor: "#ffffff",
      noteBkgColor: "#fff8ec", noteTextColor: "#1d1d1f", actorBkg: "#fff1de", textColor: "#1d1d1f",
      edgeLabelBackground: "#ffffff", clusterBkg: "#fbfaf7", clusterBorder: "#e4e1da",
    },
    flowchart: { htmlLabels: true, curve: "basis" },
  });
  for (const [el, src] of sources) {
    el.removeAttribute("data-processed");
    el.innerHTML = "";
    el.textContent = src;
  }
  try { await mermaid.run({ nodes: [...sources.keys()] }); } catch (e) { console.error(e); }
}
draw();
document.addEventListener("themechange", draw);
