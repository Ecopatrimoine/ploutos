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

// ─── LOT numerotation X/N par document — DocNumHandler ─────────────────────────
//
// Les documents reglementaires detachables (DER/DDA/DA/Lettre) doivent etre numerotes
// PAR DOCUMENT (« Declaration d'adequation · 1 / 2 »), pas au compteur GLOBAL du pack
// (« Page 7 / 14 ») qui n'a aucun sens sur un document signe seul. Le CSS pur ne le
// permet pas en paged.js 0.4.3 : le TOTAL d'un document n'est connu qu'APRES le layout
// (c'est paged.js qui decide du nombre de feuilles). On le fait donc dans un Handler,
// hook afterRendered (prouve par spike).
//
// Mecanique :
//  - chaque <section> docReg porte data-doc="<libelle>" (hisse par le feeder depuis
//    data-pdf-doc, PARTAGE entre les sections d'un meme document — ex. DER principal +
//    annexe auront le meme data-doc et donc un compteur commun) ;
//  - afterPageLayout : on rattache chaque feuille a son document via le [data-doc] present
//    dans son contenu (clone par paged.js sur chaque fragment de section). L'ordre des
//    appels = ordre des feuilles. Une feuille SANS [data-doc] (bilan...) est ignoree ->
//    elle garde le @bottom-right global, intact ;
//  - afterRendered : N par document connu -> on pose, sur la margin-box bas-droite de
//    chaque feuille du document, la classe docnum-fixed + data-docnum="<libelle> · X / N".
//    La regle CSS du feeder rend alors attr(data-docnum) via ::after, en SURCHARGE du
//    compteur global (paged.js ecrit son compteur dans ::after ; ::before reste libre,
//    donc pas de doublon — verifie au spike).
export const DOCNUM_HANDLER_SCRIPT = `
(function () {
  if (!window.Paged || !window.Paged.registerHandlers || !window.Paged.Handler) return;
  class DocNumHandler extends window.Paged.Handler {
    constructor(chunker, polisher, caller) {
      super(chunker, polisher, caller);
      this.order = [];   // ids de document dans l'ordre d'apparition
      this.byDoc = {};   // id -> [feuilles physiques]
    }
    // Rattache chaque feuille a son document (ou l'ignore si non-docReg).
    afterPageLayout(pageEl) {
      var holder = pageEl.querySelector("[data-doc]");
      if (!holder) return;                       // feuille non-docReg -> compteur global intact
      var doc = holder.getAttribute("data-doc");
      if (!this.byDoc[doc]) { this.byDoc[doc] = []; this.order.push(doc); }
      this.byDoc[doc].push(pageEl);
    }
    // Post-layout : total par document connu -> ecrit "<libelle> · X / N".
    afterRendered() {
      var self = this;
      this.order.forEach(function (doc) {
        var list = self.byDoc[doc];
        var total = list.length;
        list.forEach(function (pageEl, idx) {
          var mc = pageEl.querySelector(".pagedjs_margin-bottom-right .pagedjs_margin-content");
          if (!mc) return;
          mc.classList.add("docnum-fixed");
          mc.setAttribute("data-docnum", doc + " · " + (idx + 1) + " / " + total);
        });
      });
    }
  }
  window.Paged.registerHandlers(DocNumHandler);
})();
`;

// ─── MINI-LOT couverture — CoverHandler : comptee mais NON NUMEROTEE ───────────
//
// La couverture (pageCouverture) doit COMPTER dans le total (counter(pages) inchange,
// l'IR reste « Page 2 / N ») mais n'afficher NI en-tete courant, NI pied cabinet, NI
// numero. On NE la met PAS en page nommee (cela isolerait le .doctitle sur une feuille
// fantome en tete -> total +1, decalage du numero) : elle reste une <section> NUE.
// A la place, elle porte un marqueur NON-page data-pdf-cover (inerte aux hoists
// data-pdf-page / data-pdf-doc du feeder), et ce handler masque EN POST-LAYOUT ses 3
// margin-boxes ET le titre courant .doctitle (redondant) sur la SEULE feuille qui
// contient ce marqueur.
//
// Robuste : cible le CONTENU (le marqueur), pas la position (pas de .pagedjs_first_page
// qui blanchirait a tort la 1re feuille d'un pack sans couverture). Masquer les boites
// (display:none) ne retire pas la feuille du comptage -> couverture comptee. Aucune autre
// feuille touchee ; le DocNumHandler et le compteur global restent intacts (la couverture
// n'a pas de data-doc -> deja dans le fallback global, juste rendu invisible ici).
export const COVER_HANDLER_SCRIPT = `
(function () {
  if (!window.Paged || !window.Paged.registerHandlers || !window.Paged.Handler) return;
  class CoverHandler extends window.Paged.Handler {
    constructor(chunker, polisher, caller) { super(chunker, polisher, caller); }
    afterPageLayout(pageEl) {
      if (!pageEl.querySelector("[data-pdf-cover]")) return;   // seule la feuille couverture
      var sides = ["top-left", "bottom-left", "bottom-right"];
      for (var i = 0; i < sides.length; i++) {
        var box = pageEl.querySelector(".pagedjs_margin-" + sides[i]);
        if (box) box.style.display = "none";
      }
      // Titre courant en flux (.doctitle) : redondant en haut de la couverture (qui a
      // deja son grand titre). Il reste la SOURCE de string-set: doctitle, mais celui-ci
      // est CAPTURE au LAYOUT -> ce masquage POST-layout ne touche PAS l'en-tete courant
      // @top-left des autres feuilles (en-tete preserve sur bilan/docReg).
      var dt = pageEl.querySelector(".doctitle");
      if (dt) dt.style.display = "none";

      // ── Plein-cadre (full-bleed) sur la SEULE feuille couverture ────────────────
      // Deux "cadres" verticaux a neutraliser EN POST-LAYOUT, sur ce pageEl UNIQUEMENT
      // (jamais une regle globale) :
      //   (a) margin @page haut/bas = 15mm -> 2 bandes blanches ;
      //   (b) pont Phase 1 du feeder (#pack-flow div[style*="height:297mm"]{height:auto})
      //       -> le conteneur cover s'effondre a la hauteur du contenu (grand vide en bas,
      //          arcs qui flottent).
      // On ne touche NI le @page NI le pont (globaux) : on etire ici l'aire de contenu puis
      // le conteneur cover jusqu'aux 4 bords physiques de CETTE feuille.
      // .pagedjs_pagebox = feuille physique (position:relative, base paged.js). On sort
      // .pagedjs_area du gabarit de marges (absolute, inset 0) -> elle remplit le pagebox.
      var area = pageEl.querySelector(".pagedjs_area");
      if (area) {
        area.style.position = "absolute";
        area.style.top = "0";
        area.style.left = "0";
        area.style.right = "0";
        area.style.bottom = "0";
        area.style.width = "100%";
        area.style.height = "100%";
        area.style.margin = "0";
        area.style.padding = "0";
      }
      // Conteneur cover : son height:297mm a ete force a auto par le pont -> on le repose en
      // absolu inset 0 (resout sur l'aire etiree = feuille physique). Le creme (background),
      // la barre navy (top:0;bottom:0) et les arcs (right:0;bottom:0, ancres a CE conteneur)
      // atteignent alors les 4 bords. overflow:hidden reclippe a la feuille.
      var cover = pageEl.querySelector("[data-pdf-cover]");
      if (cover) {
        cover.style.position = "absolute";
        cover.style.top = "0";
        cover.style.left = "0";
        cover.style.right = "0";
        cover.style.bottom = "0";
        cover.style.width = "100%";
        cover.style.height = "100%";
        cover.style.margin = "0";
        cover.style.overflow = "hidden";
      }
    }
  }
  window.Paged.registerHandlers(CoverHandler);
})();
`;
