// ─── Adapter — Capitaux décès & rentes de survie (SOURCE UNIQUE) ───────────
//
// Mappe le résultat de computeSuccession() vers CapitauxDecesPageData.
// RÈGLE SOURCE UNIQUE : lit les valeurs DÉJÀ dérivées par le moteur
// (capitalDecesLines, les 4 totaux exonérés, rentesSurvieAnnuelles) — AUCUN
// recalcul fiscal. donneeIndisponible / capital:null sont propagés tels quels
// (« Donnée non disponible » côté page), JAMAIS remplacés par une valeur inventée.

import type {
  CapitauxDecesPageData,
  CapitauxDecesCaisse,
  CapitauxDecesRente,
  CapitauxDecesPrive,
  CapitauxDecesBranche,
  CapitauxDecesRenteEducationBranche,
  CapitauxDecesRenteConjointBranche,
} from "../pages/pageCapitauxDeces";

export type BuildCapitauxDecesDataParams = {
  succession: any;
  data: Record<string, any>;
  cabinet: Record<string, any>;
  clientName?: string;
  dateLettre?: string;
  pagePosition?: string;
  notreLecture?: string;
};

export function buildCapitauxDecesData(p: BuildCapitauxDecesDataParams): CapitauxDecesPageData {
  const s = p.succession || {};
  const cabinet = p.cabinet || {};
  const data = p.data || {};
  const dateStr = p.dateLettre || formatDateFr(new Date());

  const p1 = [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ");
  const p2 = [data.person2FirstName, data.person2LastName].filter(Boolean).join(" ");
  const isCouple = data.coupleStatus === "married" || data.coupleStatus === "pacs";
  const clientName = p.clientName || (isCouple && p2 ? `${p1} & ${p2}` : (data.person1LastName || p1)) || "Client";

  const lines = s.capitalDecesLines || {};
  const caissesRaw: any[] = Array.isArray(lines.caisses) ? lines.caisses : [];
  const privesRaw: any[] = Array.isArray(lines.prives) ? lines.prives : [];
  const brancheRaw: any[] = Array.isArray(lines.branche) ? lines.branche : [];
  const educRaw: any[] = Array.isArray(lines.renteEducationBranche) ? lines.renteEducationBranche : [];
  const conjRaw: any[] = Array.isArray(lines.renteConjointBranche) ? lines.renteConjointBranche : [];
  const rentesRaw: any[] = Array.isArray(s.rentesSurvieAnnuelles) ? s.rentesSurvieAnnuelles : [];

  // ─── Section 1 — caisses (capital exonéré + dévolution) ──
  // capital:null préservé (TO_VERIFY) — jamais remplacé par 0.
  const caisses: CapitauxDecesCaisse[] = caissesRaw.map(c => ({
    source: c.source || "Régime obligatoire",
    capital: c.capital ?? null,
    donneeIndisponible: !!c.donneeIndisponible,
    capitalOrphelinTotal: c.capitalOrphelinTotal,
    devolution: (Array.isArray(c.repartition) ? c.repartition : []).map((r: any) => ({
      beneficiaire: r.beneficiaire || "Bénéficiaire",
      relation: r.relation || "autre",
      montant: num(r.montant),
      origine: r.origine === "capital_orphelin" ? "capital_orphelin" : "capital_principal",
    })),
  }));

  // ─── Box rentes : rentesSurvieAnnuelles UNIQUEMENT (caisses + contrats
  //     individuels). Les rentes de BRANCHE vont en Section 3 — zéro double affichage. ──
  const rentes: CapitauxDecesRente[] = rentesRaw.map(r => ({
    source: r.source || "Régime",
    type: r.type,
    montantAnnuel: num(r.montantAnnuel),
  }));

  // ─── Section 2 — privés (990 I). detailMode dès qu'un contrat est rachetable. ──
  const prives: CapitauxDecesPrive[] = privesRaw.map(l => ({
    contrat: l.contrat || "Contrat de prévoyance",
    beneficiary: l.beneficiary || "",
    relation: l.relation || "autre",
    sharePct: num(l.sharePct),
    montant: num(l.montant),
    natureAssiette: l.natureAssiette === "capital" ? "capital" : "primes_avant70",
    assiette990I: num(l.assiette990I),
    before70Taxable: num(l.before70Taxable),
    duties: num(l.duties),
    beneficiairesARenseigner: l.beneficiairesARenseigner || undefined,
  }));
  const detailMode = prives.some(l => l.natureAssiette === "capital");

  // ─── Section 3 — branche ──
  const branche: CapitauxDecesBranche[] = brancheRaw.map(b => ({
    source: b.source || "CCN",
    capital: b.capital ?? null,
    categorie: b.categorie === "cadres" ? "cadres" : "nonCadres",
    donneeIndisponible: !!b.donneeIndisponible,
  }));
  const renteEducationBranche: CapitauxDecesRenteEducationBranche[] = educRaw.map(r => ({
    enfantPrenom: r.enfantPrenom || "Enfant",
    ageActuel: r.ageActuel ?? null,
    montantAnnuelCourant: r.montantAnnuelCourant ?? null,
    donneeIndisponible: !!r.donneeIndisponible,
    source: r.source || "CCN",
  }));
  const renteConjointBranche: CapitauxDecesRenteConjointBranche[] = conjRaw.map(r => ({
    montantAnnuel: num(r.montantAnnuel),
    dureeMaxAnnees: num(r.dureeMaxAnnees),
    beneficiaireNom: r.beneficiaireNom || "",
    source: r.source || "CCN",
    donneeIndisponible: !!r.donneeIndisponible,
  }));

  // ─── KPI : 4 totaux exonérés lus DIRECTEMENT du moteur (aucun recalcul) ──
  const exonereCaisses = num(s.capitalDecesCaisseExonere);
  const exonereBranche = num(s.capitalDecesBrancheExonere);
  const capitalAssurance = num(s.capitalDecesPriveCapital);
  const priveDuties = num(s.capitalDecesPriveDuties);

  // Règle « absence != zéro » : un total exonéré est INDISPONIBLE (→ « n.d. ») quand
  // la source a des lignes mais AUCUNE ne porte un capital connu (toutes
  // donneeIndisponible / capital:null). Source vide = 0 réel ; au moins une ligne
  // connue = total (partiel) réel — JAMAIS « n.d. ».
  const exonereCaissesIndisponible = totalIndisponible(caisses);
  const exonereBrancheIndisponible = totalIndisponible(branche);

  // Total annuel des rentes (agrégation de flux DÉJÀ dérivés : box + branche).
  const totalRentesAnnuelles =
    rentes.reduce((a, r) => a + r.montantAnnuel, 0) +
    renteEducationBranche.reduce((a, r) => a + (r.montantAnnuelCourant ?? 0), 0) +
    renteConjointBranche.reduce((a, r) => a + r.montantAnnuel, 0);

  return {
    clientName,
    dateStr,
    exonereCaisses,
    exonereBranche,
    capitalAssurance,
    exonereCaissesIndisponible,
    exonereBrancheIndisponible,
    caisses,
    rentes,
    detailMode,
    prives,
    branche,
    renteEducationBranche,
    renteConjointBranche,
    notreLecture: p.notreLecture || construireNotreLecture({
      exonereCaisses, exonereBranche, caissesIndisponible: exonereCaissesIndisponible,
      brancheIndisponible: exonereBrancheIndisponible, capitalAssurance, priveDuties, totalRentesAnnuelles,
    }),
    pagePosition: p.pagePosition || "— / —",
    cabinetLibellePied: `${cabinet.cabinetName || cabinet.nom || "Cabinet"} · Transmission — confidentiel`,
  };
}

// ─── Notre lecture par défaut (composée des valeurs dérivées, aucun recalcul) ─
// Règle « absence != zéro » : l'exonéré affiché ne somme QUE les sources connues ;
// une source indisponible n'est PAS comptée comme un 0 connu, mais signalée « à compléter ».
function construireNotreLecture(v: {
  exonereCaisses: number;
  exonereBranche: number;
  caissesIndisponible: boolean;
  brancheIndisponible: boolean;
  capitalAssurance: number;
  priveDuties: number;
  totalRentesAnnuelles: number;
}): string {
  const sourcesConnues: string[] = [];
  let exonereConnu = 0;
  if (!v.caissesIndisponible) { exonereConnu += v.exonereCaisses; sourcesConnues.push("les régimes obligatoires"); }
  if (!v.brancheIndisponible) { exonereConnu += v.exonereBranche; sourcesConnues.push("la prévoyance de branche"); }

  const indispo: string[] = [];
  if (v.caissesIndisponible) indispo.push("des régimes obligatoires");
  if (v.brancheIndisponible) indispo.push("de branche (CCN)");
  const indispoPhrase = indispo.length
    ? ` Le capital décès ${joinFr(indispo)} n'est pas disponible et reste à compléter.`
    : "";

  const capitauxBullet = sourcesConnues.length
    ? `<li><strong>Capitaux exonérés</strong> — ${formatEuro(exonereConnu)} via ${joinFr(sourcesConnues)}, transmis aux bénéficiaires désignés hors fiscalité.${indispoPhrase}</li>`
    : `<li><strong>Capitaux exonérés</strong> — montants à compléter : le capital décès ${joinFr(indispo)} n'est pas disponible.</li>`;

  return `
    <p style="margin:0 0 10px 0">Ces capitaux et rentes sont versés <strong>hors actif successoral</strong> : ils n'entrent dans aucune masse civile ni dans aucun droit de succession. Les rentes sont des flux <strong>annuels</strong> (€/an), <strong>jamais additionnés</strong> aux capitaux.</p>
    <ul style="margin:0 0 10px 0;padding-left:18px;line-height:1.7">
      ${capitauxBullet}
      <li><strong>Prévoyance décès assurance</strong> — ${formatEuro(v.capitalAssurance)} transmis. ${v.priveDuties > 0
        ? `Fiscalité 990 I estimée : ${formatEuro(v.priveDuties)} (après abattement de 152 500 € par bénéficiaire).`
        : `Aucune fiscalité 990 I (les abattements de 152 500 € par bénéficiaire absorbent les capitaux).`}</li>
      ${v.totalRentesAnnuelles > 0
        ? `<li><strong>Rentes de survie</strong> — ${formatEuro(v.totalRentesAnnuelles)} / an au total (conjoint, éducation), versées en complément et jamais sommées aux capitaux.</li>`
        : ""}
    </ul>
    <p style="margin:0;font-style:italic;color:#6B6353">Vérifiez les montants « Donnée non disponible » auprès des caisses et de la convention collective : ils complètent le besoin de prévoyance sans modifier la succession.</p>
  `.trim();
}

// Total exonéré « indisponible » : la source a des lignes mais AUCUNE ne porte un
// capital connu (toutes donneeIndisponible / capital:null). Source vide → false
// (0 réel) ; au moins une ligne connue → false (total réel, même partiel).
function totalIndisponible(lignes: { capital: number | null; donneeIndisponible: boolean }[]): boolean {
  return lignes.length > 0 && lignes.every(l => l.donneeIndisponible || l.capital == null);
}

// Jointure FR : « a », « a et b », « a, b et c ».
function joinFr(arr: string[]): string {
  if (arr.length <= 1) return arr[0] || "";
  return arr.slice(0, -1).join(", ") + " et " + arr[arr.length - 1];
}

function num(v: any): number {
  const n = typeof v === "string" ? parseFloat(v.replace(/\s/g, "").replace(",", ".")) : (v || 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function formatEuro(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n)) + " €";
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
