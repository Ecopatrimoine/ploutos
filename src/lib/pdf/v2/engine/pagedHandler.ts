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

      // ── GARDE anti-regression (full-bleed cover) — NE PAS RETIRER L'ABSOLU ──────
      // Full-bleed cover : grid tracks header/footer mis a 0 (cellule [page] = plein
      // pagebox) ET cover en absolu inset:0. L'absolu est REQUIS : le pont feeder
      // #pack-flow div[style*="height:297mm"]{height:auto !important} effondre le creme en
      // flux ; l'absolu (cale sur le pagebox) le neutralise sur la seule feuille cover.
      // Retirer l'absolu en croyant la grille suffisante = ~462px de blanc en bas (prouve
      // headless : COVER 0->661 sans absolu, 0->1123 avec).
      //
      // ── Plein-cadre (full-bleed) sur la SEULE feuille couverture ────────────────
      // Le residuel 15mm haut/bas n'est ni padding ni marge : .pagedjs_pagebox est une
      // GRILLE dont les pistes [header]/[footer] valent 15mm (56.69px), et l'aire est posee
      // dans la cellule [page]. On zerote ici header/footer EN CONSERVANT les noms de lignes
      // (lus par sonde headless : "[header] ... [page] ... [footer]") -> la cellule [page]
      // = 1fr prend tout le pagebox, l'aire + le creme remplissent. Lateral deja a 0
      // ([left]/[right]) -> on ne touche pas gridTemplateColumns. CETTE feuille uniquement
      // (pageEl filtre par la garde) ; les autres feuilles intactes.
      var pagebox = pageEl.querySelector(".pagedjs_pagebox");
      if (pagebox) {
        pagebox.style.gridTemplateRows = "[header] 0px [page] 1fr [footer] 0px";
      }
      // Le pont Phase 1 force height:auto !important sur la div cover -> en flux elle reste
      // a la hauteur du contenu (~661px, ~462px de blanc en bas). On la repose en absolu
      // inset:0 : top/bottom:0 etire la boite (ignore height:auto), son bloc conteneur =
      // .pagedjs_pagebox (relative, l'aire etant redevenue statique) -> elle remplit la
      // feuille entiere. Creme + barre navy + arcs atteignent alors les 4 bords.
      var cover = pageEl.querySelector("[data-pdf-cover]");
      if (cover) {
        cover.style.position = "absolute";
        cover.style.top = "0";
        cover.style.left = "0";
        cover.style.right = "0";
        cover.style.bottom = "0";
        cover.style.overflow = "hidden";
      }
    }
  }
  window.Paged.registerHandlers(CoverHandler);
})();
`;

// ─── LOT distribution du blanc — DistributeHandler (regle 1/3 haut - 2/3 bas) ───
//
// Les pages COURTES laissent un gros blanc EN BAS (flux haut simple). Regle validee
// (22/06) : ancrer le contenu HAUT en repartissant le blanc residuel 1/3 haut - 2/3 bas
// (PAS de centrage). En flux contrat la voie CSS est bloquee (.pdf-contrat pas pleine
// hauteur ; le feeder neutralise flex:1/flex:2). On le fait donc en POST-LAYOUT, comme
// DocNumHandler : la pagination est FIGEE en afterRendered -> injecter un spacer NE PEUT
// PAS creer de feuille fantome (anti-boucle structurel).
//
// OPT-IN STRICT : ne traite QUE les feuilles dont la <section> porte data-distribute
// (hisse par le feeder depuis data-pdf-distribute ; cf. feeder.ts). Une feuille sans ce
// marqueur n'est JAMAIS touchee (couverture, docReg, pages non marquees).
//
// DERNIERE FEUILLE UNIQUEMENT : on groupe les feuilles physiques par data-distribute
// (meme mecanique que DocNum byDoc) et on ne distribue que sur la DERNIERE du groupe ;
// les feuilles pleines precedentes ne bougent pas.
//
// MESURE : hauteur de la zone de contenu paged.js REELLE (.pagedjs_page_content), PAS
// les constantes coquillePage obsoletes (1122/32/30). residuel = zone - utilise.
//
// SPACER : si residuel > SEUIL_MIN, injecter en tete du contenu un spacer de hauteur
// round(residuel/3) (le 2/3 restant tombe naturellement en bas). CLAMP STRICT (jamais
// > residuel) + re-mesure post-injection : si ca deborderait, on annule (anti-boucle).
export const DISTRIBUTE_HANDLER_SCRIPT = `
(function () {
  if (!window.Paged || !window.Paged.registerHandlers || !window.Paged.Handler) return;
  var SEUIL_MIN = 48; // px : en dessous on s'abstient (pas de micro-decalage)
  class DistributeHandler extends window.Paged.Handler {
    constructor(chunker, polisher, caller) {
      super(chunker, polisher, caller);
      this.byKey = {};   // data-distribute -> [feuilles physiques, dans l'ordre]
      this.order = [];
    }
    // Rattache chaque feuille MARQUEE a sa page (ignore les non opt-in).
    afterPageLayout(pageEl) {
      var holder = pageEl.querySelector("[data-distribute]");
      if (!holder) return;                       // feuille non marquee -> jamais touchee
      var key = holder.getAttribute("data-distribute");
      if (!this.byKey[key]) { this.byKey[key] = []; this.order.push(key); }
      this.byKey[key].push(pageEl);
    }
    // Pagination FIGEE -> aucune nouvelle feuille possible. Sur la SEULE derniere feuille
    // de chaque page marquee : repartir le blanc 1/3 haut - 2/3 bas.
    afterRendered() {
      var self = this;
      this.order.forEach(function (key) {
        var sheets = self.byKey[key];
        var last = sheets[sheets.length - 1];    // DERNIERE feuille uniquement
        var content = last.querySelector(".pagedjs_page_content");
        // --- LOG DIAGNOSTIC TEMPORAIRE (Temps 1 - retire au Temps 2) ---
        // Mesure hissee au-dessus des gardes pour capturer les vraies valeurs meme
        // sur les sorties anticipees (content null / residuel<=seuil).
        var box = content ? content.getBoundingClientRect() : null;
        var avail = content ? content.clientHeight : 0;
        var parent = content ? content.parentElement : null;
        if (parent && parent.clientHeight > avail) avail = parent.clientHeight;
        // hauteur UTILISEE = bas du dernier enfant reel (hors spacer) / haut de la zone.
        var kids = content ? content.children : [], used = 0, i;
        for (i = 0; i < kids.length; i++) {
          if (kids[i].getAttribute && kids[i].getAttribute("data-pdf-distribute-spacer")) continue;
          var bottom = kids[i].getBoundingClientRect().bottom - box.top;
          if (bottom > used) used = bottom;
        }
        console.log("[distribute]", key, {
          sheets: sheets.length,
          hasContent: !!content,
          avail: avail,
          used: used,
          residuel: content ? (avail - used) : null,
          kids: content ? content.children.length : null,
          firstKidTag: content && content.firstElementChild ? content.firstElementChild.tagName : null
        });
        // --- FIN LOG DIAGNOSTIC TEMPORAIRE ---
        if (!content) return;
        if (!avail) return;
        if (used <= 0) return;
        var residuel = avail - used;
        if (residuel <= SEUIL_MIN) return;        // feuille pleine ou quasi -> on ne touche pas
        var spacer = Math.round(residuel / 3);    // 1/3 en haut ; 2/3 tombe en bas
        if (spacer > residuel) spacer = residuel; // CLAMP STRICT (jamais > residuel)
        if (spacer <= 0) return;
        var sp = content.ownerDocument.createElement("div");
        sp.setAttribute("data-pdf-distribute-spacer", "1");
        sp.setAttribute("style", "height:" + spacer + "px;flex:none");
        content.insertBefore(sp, content.firstChild);
        // ANTI-BOUCLE : re-mesure ; si l'ajout ferait deborder la zone, on annule.
        var check = 0;
        for (i = 0; i < content.children.length; i++) {
          var b2 = content.children[i].getBoundingClientRect().bottom - box.top;
          if (b2 > check) check = b2;
        }
        if (check > avail) content.removeChild(sp);
      });
    }
  }
  window.Paged.registerHandlers(DistributeHandler);
})();
`;
