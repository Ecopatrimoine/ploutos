// ─── Phase 1 — Handler paged.js : en-tête de table répété + label « (suite) » ──
//
// Le spike (0.4.3) a montré que paged.js coupe proprement un <tbody> long MAIS ne
// répète PAS le <thead> sur les feuilles de continuation. Ce handler comble ce
// manque : il mémorise le <thead> de chaque table à l'analyse, puis, sur chaque
// feuille, ré-injecte l'entête + un label « (suite) » sur les fragments de table
// qui continuent d'une feuille précédente.
//
// Le handler s'exécute DANS le document paginé (iframe d'aperçu), pas dans l'app :
// on l'exporte comme CHAÎNE JS inline, enregistrée sur window.Paged après le
// chargement du polyfill et avant la pagination (cf. feeder.ts).
//
// NB : idempotent — si une continuation porte déjà un thead non vide, on ne
// double pas. Détection par data-pdf-tbl posé à l'analyse (cloné par paged.js).

export const HANDLER_SCRIPT = `
(function () {
  if (!window.Paged || !window.Paged.registerHandlers || !window.Paged.Handler) return;
  class EngineTableHandler extends window.Paged.Handler {
    constructor(chunker, polisher, caller) {
      super(chunker, polisher, caller);
      this.theads = {};
    }
    // 1) Mémorise le thead de chaque table source + tague la table.
    afterParsed(parsed) {
      var tables = parsed.querySelectorAll("table");
      for (var i = 0; i < tables.length; i++) {
        var id = "t" + i;
        tables[i].setAttribute("data-pdf-tbl", id);
        var th = tables[i].querySelector("thead");
        if (th) this.theads[id] = th.innerHTML;
      }
    }
    // 2) Sur chaque feuille rendue : ré-injecte l'entête manquante + label (suite).
    afterPageLayout(pageEl) {
      var tables = pageEl.querySelectorAll("table[data-pdf-tbl]");
      for (var i = 0; i < tables.length; i++) {
        var tbl = tables[i];
        var headHtml = this.theads[tbl.getAttribute("data-pdf-tbl")];
        if (!headHtml) continue;
        var thead = tbl.querySelector("thead");
        var continuation = !thead || !thead.innerHTML.trim();
        if (!continuation) continue;
        if (!thead) {
          thead = tbl.ownerDocument.createElement("thead");
          tbl.insertBefore(thead, tbl.firstChild);
        }
        thead.innerHTML = headHtml;
        var prev = tbl.previousElementSibling;
        var dejaSuite = prev && prev.classList && prev.classList.contains("pdf-suite");
        if (!dejaSuite) {
          var s = tbl.ownerDocument.createElement("div");
          s.className = "pdf-suite";
          s.setAttribute("style", "font-family:'Lato',sans-serif;font-size:9px;font-style:italic;color:#8C8472;margin:0 0 3px");
          s.textContent = "(suite)";
          tbl.parentNode.insertBefore(s, tbl);
        }
      }
    }
  }
  window.Paged.registerHandlers(EngineTableHandler);
})();
`;
