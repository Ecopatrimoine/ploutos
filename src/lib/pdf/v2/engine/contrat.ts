// ─── Phase 2 — Contrat de page (déclaratif) + couche de traduction paged.js ─────
//
// Une page DÉCLARE une séquence de blocs typés (l'INTENTION de mise en page) ;
// la couche de traduction (compilerPageContrat) transforme cette déclaration en
// markup/CSS paged.js (break-inside / break-after / orphans-widows / table brute).
// Le jour où l'on change de moteur de rendu, on ne réécrit QUE cette couche — les
// pages ne connaissent que le contrat, jamais paged.js.
//
// PUR : aucun import, aucun DOM, aucun Tokens. Les `html` des blocs sont déjà
// rendus par la page (avec ses tokens) ; le contrat ne fait qu'ASSEMBLER + poser
// les règles de coupe.

// Canvas de page : inset latéral/haut identique à coquillePage (padding:32px 38px 0)
// pour que les pages "fluides" (migrées au contrat) s'alignent au pixel sur les
// modules encore en boîte A4 + sur l'en-tête/pied @page du feeder (inset 38px).
const PAGE_PAD_TOP_PX = 32;
const PAGE_PAD_LAT_PX = 38;

// ─── Les 3 types de blocs ──────────────────────────────────────────────────────

/** Unité JAMAIS coupée en travers d'un saut de feuille (header de section, bande
 *  KPI, un SVG, un encart, un bandeau, UNE carte, un sous-titre de section). */
export type BlocInsecable = {
  kind: "insecable";
  /** HTML déjà rendu par la page. */
  html: string;
  /** Règle de cohésion « titre solidaire de son contenu » : break-after:avoid →
   *  le bloc reste sur la même feuille que le bloc SUIVANT (jamais d'orphelin de titre). */
  solidaireAvecSuivant?: boolean;
  /** Miroir de `solidaireAvecSuivant` (côté opposé) : break-before:avoid → le bloc
   *  reste sur la même feuille que le bloc PRÉCÉDENT (jamais de bloc « veuf » seul en
   *  haut d'une feuille de continuation, ex. signature). */
  solidaireAvecPrecedent?: boolean;
  /** GARDE-FOU : si ce bloc peut dépasser la hauteur d'une feuille, l'autoriser à
   *  couler (break-inside:auto) plutôt que de risquer une boucle / feuille blanche. */
  secableEnDernierRecours?: boolean;
};

/** Liste HOMOGÈNE coupable ENTRE éléments seulement, rendue table brute
 *  (thead + tbody). En-tête répété + label « (suite) » assurés par le handler
 *  paged.js (Phase 1, via l'attribut data-pdf-tbl + thead). Réservée aux pages
 *  tabulaires (héritiers/bénéficiaires/biens — Phase 3) ; non utilisée par
 *  Recommandations, qui est une suite de BlocInsecable (cartes). */
export type ListeEcoulable = {
  kind: "liste";
  /** `<thead>...</thead>` complet. */
  enteteHtml: string;
  /** Une entrée = une `<tr>...</tr>`. */
  lignesHtml: string[];
  /** Surcharge éventuelle du style de la `<table>`. */
  styleTable?: string;
};

/** Blocs de fin (encart « Notre lecture », bandeau consolidé) qui restent avec /
 *  après la liste, sur la dernière feuille. Insécables par défaut. */
export type QueueEpinglee = {
  kind: "queue";
  html: string;
  secableEnDernierRecours?: boolean;
};

export type Bloc = BlocInsecable | ListeEcoulable | QueueEpinglee;
export type PageContrat = Bloc[];

// ─── Couche de traduction (paged.js) ────────────────────────────────────────────

const STYLE_TABLE_DEFAUT = "width:100%;border-collapse:collapse;table-layout:fixed";

function reglesCoupe(b: { solidaireAvecSuivant?: boolean; solidaireAvecPrecedent?: boolean; secableEnDernierRecours?: boolean }): string {
  // GARDE-FOU : un insécable plus haut qu'une feuille bouclerait sous paged.js
  // (il le repousse de feuille en feuille). Repli explicite : on le laisse COULER.
  const inside = b.secableEnDernierRecours ? "break-inside:auto" : "break-inside:avoid";
  // Cohésion (miroir) : ne pas casser AVANT ce bloc → il reste avec le bloc précédent.
  const before = b.solidaireAvecPrecedent ? ";break-before:avoid" : "";
  // Cohésion titre : ne pas casser APRÈS ce bloc → il reste avec le bloc suivant.
  const after = b.solidaireAvecSuivant ? ";break-after:avoid" : "";
  return `${inside}${before}${after}`;
}

/** Traduit UN bloc déclaré en markup paged.js. PUR. */
export function compilerBloc(b: Bloc): string {
  switch (b.kind) {
    case "insecable":
      return `<div style="${reglesCoupe(b)}">${b.html}</div>`;
    case "queue":
      return `<div class="pdf-queue" style="${b.secableEnDernierRecours ? "break-inside:auto" : "break-inside:avoid"}">${b.html}</div>`;
    case "liste": {
      // data-pdf-tbl : repère pour le handler Phase 1 (thead répété + « (suite) »).
      const style = b.styleTable || STYLE_TABLE_DEFAUT;
      return `<table data-pdf-tbl style="${style}">${b.enteteHtml}<tbody>${b.lignesHtml.join("")}</tbody></table>`;
    }
  }
}

/** Traduit une page déclarée en HTML en flux, prêt pour le feeder paged.js.
 *  Pose le canvas (inset 32/38 aligné sur les modules en boîte) + orphans/widows
 *  (pas de ligne isolée en haut/bas de feuille). PUR. */
export function compilerPageContrat(blocs: PageContrat): string {
  const corps = blocs.map(compilerBloc).join("\n");
  return (
    `<div class="pdf-contrat" style="padding:${PAGE_PAD_TOP_PX}px ${PAGE_PAD_LAT_PX}px 0;orphans:2;widows:2">\n` +
    `${corps}\n` +
    `</div>`
  );
}
