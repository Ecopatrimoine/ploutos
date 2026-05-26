// ─── Lot 9 (bascule) — Adapter cabinet+mission+reco → FicheDDAData v2 ──
//
// Construit le `FicheDDAPageData` depuis l'état app. Les besoins et le
// conseil sont synthétisés à partir de mission.besoin* (cochés ou non) et
// des recommandations filtrées complètes (Lot 7).

import type {
  FicheDDAPageData,
  BesoinIcone,
  LigneGarantie,
  LigneMiseEnRegard,
  DocumentAnnexe,
} from "../pages/pageFicheDDA";
import type { GroupeRecommandationsParDimension } from "../pages/pageDeclarationAdequation";
import {
  filterComplete,
  groupRecommandationsByDimension,
  DIMENSIONS_LABEL,
  DIMENSIONS_ORDER,
  BESOIN_LIBELLES,
  type Recommandation,
} from "../../../conformite/recommandations";
import { filterByType, type PieceJointe } from "../../../conformite/piecesJointes";

export type BuildFicheDDADataParams = {
  cabinet: Record<string, any>;
  mission: Record<string, any>;
  /** Données dossier client (PatrimonialData) — pour identité client. */
  data?: Record<string, any>;
  recommandations?: ReadonlyArray<Recommandation>;
  /** Pièces jointes IPID/DIC du dossier (Lot 8e). */
  piecesJointes?: ReadonlyArray<PieceJointe>;
  dateLettre?: string;
};

export function buildFicheDDAData(p: BuildFicheDDADataParams): FicheDDAPageData {
  const cabinet = p.cabinet || {};
  const mission = p.mission || {};
  const dateLettre = p.dateLettre || formatDateFr(new Date());

  // Catégorie IAS textuelle (varc).
  const catsIas: string[] = [];
  if (cabinet.statutCoa) catsIas.push("COA");
  if (cabinet.statutMia) catsIas.push("MIA");
  const cabinetCategorieIas = catsIas.join(" + ") || "catégorie IAS";

  // ── Besoins : 3 icônes synthèse adaptées au dossier ──────────────────
  // Si mission.besoinSante_* ou besoinPrev_* coché → décès/maintien revenu.
  // Si mission.besoinRetraite_* ou besoinEpargne_* → épargne moyen-long terme.
  const anyChecked = (prefix: string): boolean => Object.keys(mission)
    .some(k => k.startsWith(prefix) && !!mission[k]);
  const aPrev    = anyChecked("besoinPrev_");
  const aSante   = anyChecked("besoinSante_");
  const aEpargne = anyChecked("besoinEpargne_");
  const aRetraite= anyChecked("besoinRetraite_");

  const besoins: BesoinIcone[] = [];
  if (aPrev || aSante) {
    besoins.push({ iconeKey: "shieldHeart",       texteHtml: "Protéger le foyer en cas de décès ou de coup dur (capital, rente, frais médicaux non couverts)." });
    besoins.push({ iconeKey: "activityHeartbeat", texteHtml: "Maintenir le revenu en cas d'invalidité ou d'arrêt de travail prolongé." });
  }
  if (aEpargne || aRetraite) {
    besoins.push({ iconeKey: "calendarEuro",      texteHtml: "Disposer d'une épargne de moyen-long terme à vocation de valorisation et de transmission." });
  }
  if (besoins.length === 0) {
    // Fallback générique si aucun besoin coché : 3 lignes types
    besoins.push(
      { iconeKey: "shieldHeart",       texteHtml: "Protéger le foyer en cas de décès." },
      { iconeKey: "activityHeartbeat", texteHtml: "Maintenir le revenu en cas d'invalidité ou d'arrêt de travail." },
      { iconeKey: "calendarEuro",      texteHtml: "Disposer d'une épargne de moyen-long terme." },
    );
  }

  // ── Garanties : 3 lignes › synthétisées (raisonnement en garanties,
  //     sans nommer ni produit ni assureur — règle conformité). ────────
  const garanties: LigneGarantie[] = [];
  if (aPrev || aSante) {
    garanties.push({ texteHtml: "Contrat de prévoyance avec <strong>capital décès</strong> couvrant le déficit identifié." });
    garanties.push({ texteHtml: "Garantie <strong>maintien de revenu</strong> (rente d'invalidité et indemnités d'arrêt de travail)." });
  }
  if (aEpargne || aRetraite) {
    garanties.push({ texteHtml: "Contrat d'<strong>assurance-vie</strong> multisupport avec poche d'unités de compte" + (mission.esgPref ? " <strong>durables</strong>" : "") + "." });
  }
  if (garanties.length === 0) {
    garanties.push(
      { texteHtml: "Contrat de prévoyance avec <strong>capital décès</strong>." },
      { texteHtml: "Garantie <strong>maintien de revenu</strong>." },
      { texteHtml: "Contrat d'<strong>assurance-vie</strong> multisupport." },
    );
  }

  // ── Mise en regard besoin → réponse : reflète garanties ci-dessus ──
  const miseEnRegard: LigneMiseEnRegard[] = [];
  if (aPrev || aSante) {
    miseEnRegard.push({ besoin: "Protection en cas de décès", reponse: "Le capital décès couvre le crédit restant et sécurise les besoins du conjoint et des enfants." });
    miseEnRegard.push({ besoin: "Maintien du revenu",          reponse: "La rente d'invalidité et les indemnités compensent la perte de revenu en cas d'incapacité." });
  }
  if (aEpargne || aRetraite) {
    miseEnRegard.push({ besoin: "Épargne & transmission",      reponse: "L'assurance-vie valorise l'épargne à moyen terme et organise la transmission via la clause bénéficiaire." });
  }
  if (miseEnRegard.length === 0) {
    miseEnRegard.push(
      { besoin: "Protection",  reponse: "Capital décès et garantie maintien de revenu adaptés à votre situation." },
      { besoin: "Épargne",     reponse: "Assurance-vie multisupport pour valoriser et transmettre." },
    );
  }

  // ── Volet IBIP : mention ESG conditionnée à mission.esgPref ─────────
  const voletIbipHtml = mission.esgPref
    ? "Pour le contrat d'assurance-vie en unités de compte, une <strong>adéquation renforcée</strong> est réalisée : cohérence avec votre profil, votre horizon, votre capacité à subir des pertes et vos <strong>préférences de durabilité (ESG)</strong>, exprimées au questionnaire."
    : "Pour le contrat d'assurance-vie en unités de compte, une <strong>adéquation renforcée</strong> est réalisée : cohérence avec votre profil, votre horizon, votre capacité à subir des pertes (préférences ESG non exprimées au questionnaire).";

  // ── Identité client compacte (sous header page 1) ─────────────────────
  // Person1 toujours présente (si renseignée), person2 ajoutée seulement
  // pour les couples (married/pacs/cohab) avec nom person2 saisi. Dates de
  // naissance affichées au format jj/mm/aaaa (l'app stocke en ISO).
  const dataDossier = p.data || {};
  const p1Nom = [dataDossier.person1FirstName, dataDossier.person1LastName].filter(Boolean).join(" ");
  const p2Nom = [dataDossier.person2FirstName, dataDossier.person2LastName].filter(Boolean).join(" ");
  const isCouple = dataDossier.coupleStatus === "married" || dataDossier.coupleStatus === "pacs" || dataDossier.coupleStatus === "cohab";
  const adresse = [dataDossier.adresse, dataDossier.codePostal, dataDossier.ville].filter(Boolean).join(", ") || undefined;
  const client = p1Nom
    ? {
        person1: { nom: p1Nom, naissance: isoToFr(dataDossier.person1BirthDate) },
        person2: (isCouple && p2Nom)
          ? { nom: p2Nom, naissance: isoToFr(dataDossier.person2BirthDate) }
          : undefined,
        adresse,
      }
    : undefined;

  // ── Recommandations groupées par dimension (encart page 2) ───────────
  // Pattern identique à l'Adéquation : groupBy + BESOIN_LIBELLES pour le
  // libellé humain du besoin lié. Si pas de recos, encart omis (page rend
  // alors la version 2-pages standard).
  const recosComplete = filterComplete(p.recommandations || []);
  let recommandationsGroupees: GroupeRecommandationsParDimension[] | undefined;
  if (recosComplete.length > 0) {
    const grouped = groupRecommandationsByDimension(recosComplete);
    recommandationsGroupees = DIMENSIONS_ORDER
      .map(dim => ({ dim, recos: grouped[dim] || [] }))
      .filter(g => g.recos.length > 0)
      .map(g => ({
        dimensionLabel: DIMENSIONS_LABEL[g.dim],
        recos: g.recos.map(r => ({
          libelle: r.libelle,
          justification: r.justification,
          besoinLibelle: r.besoinKey ? BESOIN_LIBELLES[r.besoinKey] : undefined,
        })),
      }));
  }

  // ── Documents IPID/DIC réels du dossier (Lot 8e) ─────────────────────
  // Si liste réelle fournie (≥ 1 pièce), la page affiche les noms en
  // pastilles. Sinon, fallback sur le wording générique documentsRemisHtml.
  const piecesIpid = filterByType(p.piecesJointes || [], "ipid");
  const piecesDic  = filterByType(p.piecesJointes || [], "dic");
  const documents: DocumentAnnexe[] = [
    ...piecesIpid.map(piece => ({ type: "ipid" as const, nom: piece.nom })),
    ...piecesDic.map(piece  => ({ type: "dic"  as const, nom: piece.nom })),
  ];

  return {
    cabinetNom:        cabinet.cabinetName || "—",
    cabinetORIAS:      cabinet.orias || "—",
    cabinetConseiller: cabinet.conseiller || cabinet.conseillerNom || "—",
    cabinetCategorieIas,
    cabinetStatut:           cabinet.statutLibelle || "courtier / mandataire",
    cabinetModeRemuneration: cabinet.remunerationType || "commissions / honoraires",
    dateLettre,
    client,
    origineDesBesoins: "issu du dossier",
    besoins,
    garanties,
    miseEnRegard,
    voletIbipHtml,
    recommandationsGroupees,
    documents: documents.length > 0 ? documents : undefined,
    textRemunerationImpartialiteHtml:
      "La nature et, le cas échéant, le montant de la rémunération vous sont communiqués <strong>avant la souscription</strong>. Le cabinet agit sans que sa rémunération n'oriente le choix du contrat.",
    documentsRemisHtml:
      "<strong>Documents remis avec cette fiche</strong> : pour l'assurance non-vie, le document d'information normalisé <strong>(IPID)</strong> ; pour l'assurance-vie, le <strong>document d'informations clés (DIC)</strong>. Ces documents sont établis par l'assureur concepteur du produit.",
    mentionNonContractuelle:
      "Document d'aide à la conformité remis à titre indicatif. Ne constitue ni une attestation de conformité, ni un conseil juridique. À valider au regard des textes en vigueur et du contrôle de l'association agréée." +
      (cabinet.cabinetName ? ` ${cabinet.cabinetName}` : "") +
      (cabinet.orias ? ` — ORIAS n° ${cabinet.orias} (statuts à confirmer sur www.orias.fr).` : "."),
  };
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

/** Convertit une date "YYYY-MM-DD" (format ISO stocké par l'app) en
 *  "DD/MM/YYYY" pour affichage. Tolère un format déjà français.
 *  Retourne undefined si vide / illisible — ce qui supprime la parenthèse
 *  vide dans le bandeau identité (pas de « (…) » orphelines). */
function isoToFr(iso: string | undefined | null): string | undefined {
  if (!iso) return undefined;
  const s = String(iso).trim();
  if (!s) return undefined;
  const mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (mIso) return `${mIso[3]}/${mIso[2]}/${mIso[1]}`;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;  // déjà au bon format
  return undefined;  // format inconnu → on n'affiche pas
}
