// ─── Pagination par COMPTAGE d'une liste de rows homogènes sur N feuilles A4 ───
//
// Fonction PURE (aucun DOM, aucune mesure Playwright, aucun import) : généralise
// la recette CONSERVATRICE de tientSurUneFeuille (primitives.ts) au cas « la liste
// déborde la feuille ». Une feuille mono-A4 a hauteur fixe (overflow:hidden) ne se
// découpe pas seule ; on décide donc PAR COMPTAGE combien de rows tiennent par
// feuille, puis le builder concatène autant de coquillePage (comme la bascule
// 2-feuilles de pagePrevoyanceColl).
//
// Remplissage GLOUTON : on accumule poids[i] * hauteurLignePx ; dès que l'ajout
// dépasse le budget net de la feuille courante (region − margeSecurite), on ouvre
// une nouvelle feuille. La feuille 1 a son propre budget (regionFeuille1Px, sous le
// header + KPI + note + …) ; les feuilles de continuation un budget plus large
// (regionContinuationPx, header + thead répété seulement).
//
// Le bloc de QUEUE (encart « Notre lecture » + foot-note / bandeau consolidé) est
// épinglé sur la DERNIÈRE feuille : si les rows de cette feuille + la queue ne
// tiennent pas ensemble, la queue part sur une feuille finale supplémentaire
// (blanc bénin accepté, JAMAIS de troncature).
//
// BIAIS CONSERVATEUR ABSOLU : tout doute (NaN, region ≤ 0, poids non sain) ⇒ une
// feuille de plus, jamais de clip. Retourne toujours au moins [[]] (liste vide ⇒
// une feuille qui portera la queue). Le résultat est un tableau de feuilles, chaque
// feuille étant la liste des INDICES de poids[] qui lui reviennent.

export type RepartitionListeOpts = {
  /** Hauteur (px) d'une unité-ligne. poids[i] vaut 1 (row normale) ou 2 (composition US/NP). */
  hauteurLignePx: number;
  /** Budget vertical (px) pour les ROWS sur la feuille 1 (thead déjà soustrait par l'appelant). */
  regionFeuille1Px: number;
  /** Budget vertical (px) pour les ROWS sur les feuilles de continuation. */
  regionContinuationPx: number;
  /** Hauteur (px) du bloc de queue, épinglé sur la dernière feuille. */
  hauteurBlocQueuePx: number;
  /** Molette du doute (px) — cf. MARGE_SECURITE_PX de primitives.ts. */
  margeSecuritePx: number;
};

function estSain(n: number): boolean {
  return typeof n === "number" && Number.isFinite(n);
}
function estSainPositif(n: number): boolean {
  return estSain(n) && n > 0;
}
/** poids d'une row : entier ≥ 1 sain, sinon 2 (doute ⇒ conservateur : la row la plus haute). */
function poidsSain(p: number): number {
  return estSainPositif(p) ? p : 2;
}

export function repartirLignesEnFeuilles(poids: number[], opts: RepartitionListeOpts): number[][] {
  const n = Array.isArray(poids) ? poids.length : 0;

  const hLigne = opts ? opts.hauteurLignePx : NaN;
  const marge = opts && estSain(opts.margeSecuritePx) && opts.margeSecuritePx >= 0 ? opts.margeSecuritePx : 0;
  const queue = opts && estSain(opts.hauteurBlocQueuePx) && opts.hauteurBlocQueuePx >= 0 ? opts.hauteurBlocQueuePx : 0;

  // Budgets NETS de rows = région − marge de sécurité. Région non saine ⇒ 0 (= doute).
  const budget1 = (opts && estSainPositif(opts.regionFeuille1Px) ? opts.regionFeuille1Px : 0) - marge;
  const budgetCont = (opts && estSainPositif(opts.regionContinuationPx) ? opts.regionContinuationPx : 0) - marge;

  // Liste vide : une feuille (vide) qui portera la queue.
  if (n === 0) return [[]];

  // Doute MAJEUR (hauteur de ligne non saine, ou un budget ≤ 0) : ultra-conservateur
  // ⇒ une row par feuille, queue isolée sur une feuille finale dédiée (jamais collée).
  if (!estSainPositif(hLigne) || budget1 <= 0 || budgetCont <= 0) {
    const feuilles: number[][] = [];
    for (let i = 0; i < n; i++) feuilles.push([i]);
    if (queue > 0) feuilles.push([]);
    return feuilles;
  }

  // Remplissage glouton.
  const feuilles: number[][] = [];
  let courante: number[] = [];
  let hCourante = 0;
  let budgetCourant = budget1;
  for (let i = 0; i < n; i++) {
    const h = poidsSain(poids[i]) * hLigne;
    if (courante.length > 0 && hCourante + h > budgetCourant) {
      feuilles.push(courante);
      courante = [];
      hCourante = 0;
      budgetCourant = budgetCont; // les feuilles suivantes utilisent le budget de continuation
    }
    courante.push(i);
    hCourante += h;
  }
  feuilles.push(courante);

  // Queue épinglée sur la dernière feuille : si rows + queue dépassent la région de
  // cette feuille, pousser la queue sur une feuille finale supplémentaire.
  if (queue > 0) {
    const derniere = feuilles[feuilles.length - 1];
    const regionDerniere = feuilles.length === 1 ? budget1 : budgetCont;
    let hDerniere = 0;
    for (const i of derniere) hDerniere += poidsSain(poids[i]) * hLigne;
    if (hDerniere + queue > regionDerniere) feuilles.push([]);
  }

  return feuilles;
}
