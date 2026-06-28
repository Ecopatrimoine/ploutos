// ─── Lot 9 — Script local de génération PDF v2 ──────────────────────────
//
// Pipeline : HTML (renderIFI) → Chromium headless (Playwright) → PDF.
//
// Usage :
//   npm run pdf:ifi          → génère out/ifi-encreOr.pdf + out/ifi-cabinet.pdf
//
// Critère d'acceptation = VISUEL : comparer les PDF générés à la maquette
//   revue-preview/pdf/refonte_pdf_page_theme_ifi_A4.html
//
// Données IFI figées dans ce script (correspondent à la maquette : assiette
// 588 400 €, seuil 1 300 000 €, marge 711 600 €, IFI dû 0 €). Plus tard,
// quand la page IFI v2 sera branchée dans l'app, ces données viendront du
// dossier client courant via computeIFI().
//
// ─── FIDÉLITÉ DES MARGES DE PAGE (cf. genererPdf + constantes plus bas) ──────
// En PROD, la marge haut/bas du PDF vient du feeder (@page margin 15mm 0 15mm 0 ;
// cf. src/lib/pdf/v2/engine/feeder.ts → MARGE_HAUT_MM / MARGE_BAS_MM). Ce harnais
// imprimait avec margin:0 → contenu collé au bord = faux négatif visuel. Il applique
// désormais les MÊMES marges de page (15mm haut/bas, 0 latéral ; la couverture reste
// full-bleed comme en prod).
// LIMITE RESTANTE : seules les MARGES (haut/bas/latéral) sont fidèles ici. L'en-tête
// courant, le pied cabinet, le liseré docReg et la numérotation X/N sont injectés par le
// feeder (margin-boxes paged.js) et NE sont PAS reproduits → à valider dans le vrai pack.

import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { renderIFI } from "../src/lib/pdf/v2/renderIFI";
import type { IFIPageData } from "../src/lib/pdf/v2/pages/pageIFI";
import { renderIR } from "../src/lib/pdf/v2/renderIR";
import type { IRPageData } from "../src/lib/pdf/v2/pages/pageIR";
import { renderCouverture } from "../src/lib/pdf/v2/renderCouverture";
import type { CouverturePageData } from "../src/lib/pdf/v2/pages/pageCouverture";
import { renderSuccessionA } from "../src/lib/pdf/v2/renderSuccessionA";
import type { SuccessionAPageData } from "../src/lib/pdf/v2/pages/pageSuccessionA";
import { renderSuccessionB } from "../src/lib/pdf/v2/renderSuccessionB";
import type { SuccessionBPageData } from "../src/lib/pdf/v2/pages/pageSuccessionB";
import { renderProfil } from "../src/lib/pdf/v2/renderProfil";
import type { ProfilPageData } from "../src/lib/pdf/v2/pages/pageProfil";
import { renderPrevoyanceColl } from "../src/lib/pdf/v2/renderPrevoyanceColl";
import type { PrevoyanceCollPageData } from "../src/lib/pdf/v2/pages/pagePrevoyanceColl";
import { renderBilanEndettement } from "../src/lib/pdf/v2/renderBilanEndettement";
import type { BilanEndettementPageData } from "../src/lib/pdf/v2/pages/pageBilanEndettement";
import { renderLettreMission } from "../src/lib/pdf/v2/renderLettreMission";
import type { LettreMissionPageData } from "../src/lib/pdf/v2/pages/pageLettreMission";
import { renderDer } from "../src/lib/pdf/v2/renderDer";
import type { DerPageData } from "../src/lib/pdf/v2/pages/pageDer";
import { renderFicheDDA } from "../src/lib/pdf/v2/renderFicheDDA";
import type { FicheDDAPageData } from "../src/lib/pdf/v2/pages/pageFicheDDA";
import { renderDeclarationAdequation } from "../src/lib/pdf/v2/renderDeclarationAdequation";
import type { DeclarationAdequationPageData } from "../src/lib/pdf/v2/pages/pageDeclarationAdequation";
// Capitaux décès : page + adapter rendus en isolé (hors pack). La cible exerce
// l'adapter sur des fixtures BRUTES (forme computeSuccession) pour couvrir les 2 modes.
import { buildTokens } from "../src/lib/pdf/v2/tokens";
import { coquilleDocument } from "../src/lib/pdf/v2/primitives";
import { pageCapitauxDeces } from "../src/lib/pdf/v2/pages/pageCapitauxDeces";
import { buildCapitauxDecesData } from "../src/lib/pdf/v2/adapters/buildCapitauxDecesData";
// Hypothèses (Lot 5.2) : page + adapter en isolé. La cible exerce le filet de sévérité
// (vert/rouge/neutre piloté par deltaTotal) et la palette de scénarios sur plusieurs cas.
import { pageHypos } from "../src/lib/pdf/v2/pages/pageHypos";
import { buildHyposData } from "../src/lib/pdf/v2/adapters/buildHyposData";
// Barème IFI : fixture dev uniquement → on reproduit le bracketFill RÉEL via le
// helper moteur computeTaxFromBrackets (jamais de nombres écrits à la main). En
// PROD, ces champs viennent de computeIFI(data).
import { computeTaxFromBrackets } from "../src/lib/calculs/utils";
import type { TaxBracket } from "../src/types/patrimoine";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "out");
mkdirSync(outDir, { recursive: true });

// ─── Marges de page du harnais = marges @page de PROD (feeder) ──────────────
// Source de vérité : src/lib/pdf/v2/engine/feeder.ts (MARGE_HAUT_MM / MARGE_BAS_MM).
// Ces constantes y sont module-privées (non exportées) → on les DUPLIQUE à l'identique
// ici (impossible d'importer sans toucher au code app/prod) ; ce pointeur évite la
// divergence. Latéral = 0 : l'inset latéral vient du padding 38px du corps (.pdf-contrat,
// cf. compilerPageContrat), déjà présent dans le HTML rendu.
const MARGE_HAUT_MM = 15; // == feeder.ts MARGE_HAUT_MM (bande haute @page)
const MARGE_BAS_MM = 15;  // == feeder.ts MARGE_BAS_MM  (bande basse @page)

// Barème IFI 2026 (identique à computeIFI) — uniquement pour fabriquer les fixtures
// de preview : bracketFill/grossIfi/décote/IFI net dérivés, jamais saisis en dur.
const IFI_BRACKETS: TaxBracket[] = [
  { from: 0, to: 800_000, rate: 0 },
  { from: 800_000, to: 1_300_000, rate: 0.005 },
  { from: 1_300_000, to: 2_570_000, rate: 0.007 },
  { from: 2_570_000, to: 5_000_000, rate: 0.01 },
  { from: 5_000_000, to: 10_000_000, rate: 0.0125 },
  { from: 10_000_000, to: Number.POSITIVE_INFINITY, rate: 0.015 },
];
function makeIfiCalc(netTaxable: number): { grossIfi: number; decote: number; ifiDu: number; bracketFill: ReturnType<typeof computeTaxFromBrackets>["fill"] } {
  const { tax: grossIfi, fill: bracketFill } = computeTaxFromBrackets(netTaxable, IFI_BRACKETS);
  const decote = netTaxable >= 1_300_000 && netTaxable < 1_400_000 ? Math.max(0, 17_500 - 0.0125 * netTaxable) : 0;
  const ifiDu = netTaxable > 1_300_000 ? Math.max(0, grossIfi - decote) : 0;
  return { grossIfi, decote, ifiDu, bracketFill };
}
const ifiCalcMaquette = makeIfiCalc(588_400);

// Barème IR (identique à computeIR) — fixtures preview uniquement : bracketFill (sur le
// quotient) dérivé du helper moteur, jamais saisi à la main. En PROD : computeIR(data).
const IR_BRACKETS: TaxBracket[] = [
  { from: 0, to: 11_600, rate: 0 },
  { from: 11_600, to: 29_579, rate: 0.11 },
  { from: 29_579, to: 84_577, rate: 0.30 },
  { from: 84_577, to: 181_917, rate: 0.41 },
  { from: 181_917, to: Number.POSITIVE_INFINITY, rate: 0.45 },
];
function makeIrCalc(quotient: number): { bracketFill: ReturnType<typeof computeTaxFromBrackets>["fill"]; taxParPart: number; marginalRate: number } {
  const { tax: taxParPart, fill: bracketFill } = computeTaxFromBrackets(quotient, IR_BRACKETS);
  const marginalRate = quotient <= 11_600 ? 0 : quotient <= 29_579 ? 0.11 : quotient <= 84_577 ? 0.30 : quotient <= 181_917 ? 0.41 : 0.45;
  return { bracketFill, taxParPart, marginalRate };
}
const irCalcMaquette = makeIrCalc(30_000); // quotient ~30 k -> TMI 30 % (cohérent avec le KPI maquette)

// Fabrique une fixture IR cohérente à partir d'un quotient par part (tout dérivé du helper).
function makeIRFixture(o: { clientName: string; parts: number; quotientParPart: number; pagePosition: string }): IRPageData {
  const calc = makeIrCalc(o.quotientParPart);
  const revenuNetImposable = o.quotientParPart * o.parts;
  const impotNetDu = Math.round(calc.taxParPart * o.parts);
  const salaires = revenuNetImposable;
  const revenusBruts = Math.round(salaires / 0.9);
  const tmiPct = Math.round(calc.marginalRate * 100);
  const fr = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
  return {
    clientName: o.clientName,
    dateStr: "25 mai 2026",
    impotNetDu,
    trancheMarginale: `${tmiPct} %`,
    tauxMoyen: `${((impotNetDu / revenuNetImposable) * 100).toFixed(1).replace(".", ",")} %`,
    quotient: `${o.parts} part${o.parts > 1 ? "s" : ""}`,
    salaires, fonciers: 0, mobiliers: 0, pensionsAutres: 0,
    revenusBruts, abattement10pct: revenusBruts - salaires, revenuNetImposable,
    bracketFill: calc.bracketFill,
    quotientParPart: o.quotientParPart,
    parts: o.parts,
    marginalRate: calc.marginalRate,
    notreLecture: `Revenu net imposable ${fr(revenuNetImposable)} € pour ${o.parts} part${o.parts > 1 ? "s" : ""} (quotient ${fr(o.quotientParPart)} € par part) : tranche marginale ${tmiPct} %. La somme des barres par part n'est pas l'impot net (decote et plafonnement du quotient familial ensuite).`,
    pagePosition: o.pagePosition,
    cabinetLibellePied: "EcoPatrimoine Conseil · Fiscalité — confidentiel",
  };
}

// ─── Données figées correspondant à la maquette ────────────────────────
const dataMaquette: IFIPageData = {
  clientName: "Dubreuil",
  dateStr: "25 mai 2026",
  assietteNette: 588_400,
  seuilIFI: 1_300_000,
  margeSousSeuil: 711_600,
  ifiDu: ifiCalcMaquette.ifiDu,
  bracketFill: ifiCalcMaquette.bracketFill,
  grossIfi: ifiCalcMaquette.grossIfi,
  decote: ifiCalcMaquette.decote,
  biens: [
    {
      nom: "Maison · résidence principale",
      valeurBrute: 600_000,
      abattementRP: 180_000,
      dette: 185_000,
      netTaxable: 235_000,
    },
    {
      nom: "Appartement locatif",
      valeurBrute: 353_400,
      abattementRP: 0,
      dette: 0,
      netTaxable: 353_400,
    },
  ],
  notreLecture:
    "Votre patrimoine immobilier net taxable s'établit à 588 400 €, après l'abattement de 30 % sur la résidence principale et la déduction du crédit en cours. Il reste très en deçà du seuil de 1 300 000 € : vous n'êtes pas redevable de l'IFI cette année, avec une marge de 711 600 €.",
  pagePosition: "3 / 8",
  cabinetLibellePied: "EcoPatrimoine Conseil · Fiscalité — confidentiel",
};

// ─── Cas « chargé » : assiette 3 M€ → au-dessus du seuil, remplit les tranches
//     1 à 4 (graphe barème pleinement visible, IFI dû non nul, décote=0). ────
const ifiCalcCharge = makeIfiCalc(3_000_000);
const dataMaquetteIFICharge: IFIPageData = {
  clientName: "Berthier",
  dateStr: "25 mai 2026",
  assietteNette: 3_000_000,
  seuilIFI: 1_300_000,
  margeSousSeuil: 1_300_000 - 3_000_000,
  ifiDu: ifiCalcCharge.ifiDu,
  bracketFill: ifiCalcCharge.bracketFill,
  grossIfi: ifiCalcCharge.grossIfi,
  decote: ifiCalcCharge.decote,
  biens: [
    {
      nom: "Hôtel particulier · résidence principale",
      valeurBrute: 2_200_000,
      abattementRP: 660_000,
      dette: 0,
      netTaxable: 1_540_000,
    },
    {
      nom: "Immeuble de rapport",
      valeurBrute: 1_460_000,
      abattementRP: 0,
      dette: 0,
      netTaxable: 1_460_000,
    },
  ],
  notreLecture:
    "Patrimoine immobilier net taxable de 3 000 000 €, au-dessus du seuil de 1 300 000 € : l'IFI est dû et se décompose par tranche du barème (tranches 1 à 4 ici).",
  pagePosition: "3 / 8",
  cabinetLibellePied: "EcoPatrimoine Conseil · Fiscalité — confidentiel",
};

async function genererPdf(htmlContent: string, outPath: string): Promise<void> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // Neutralise le "@page { size:A4; margin:0 }" porté par cssCommun (primitives) — MÊME
    // technique que le feeder (feeder.ts : .replace(/@page\s*\{[^}]*\}/, "")) — afin qu'il
    // n'entre pas en conflit avec les marges de page Playwright ci-dessous. Sans ça, le @page
    // margin:0 du CSS l'emporte et le contenu reste collé au bord. La taille A4 est rétablie
    // par format:"A4". (Une seule règle @page dans le HTML du harnais → un seul remplacement.)
    const htmlMargesPage = htmlContent.replace(/@page\s*\{[^}]*\}/, "");
    await page.setContent(htmlMargesPage, { waitUntil: "networkidle" });
    // La couverture est full-bleed en prod : le CoverHandler du feeder met ses bandes @page à
    // 0 et cale le crème en absolu inset:0 (cf. pagedHandler COVER_HANDLER_SCRIPT). On reproduit
    // CETTE décision via le même marqueur data-pdf-cover → pas de marge de page sur la couverture,
    // 15mm haut/bas sur les pages de contenu (corps en flux compilerPageContrat). Latéral = 0
    // partout (l'inset latéral vient du padding 38px du corps).
    const estCouverture = htmlContent.includes("data-pdf-cover");
    const margin = estCouverture
      ? { top: "0", right: "0", bottom: "0", left: "0" }
      : { top: `${MARGE_HAUT_MM}mm`, right: "0", bottom: `${MARGE_BAS_MM}mm`, left: "0" };
    await page.pdf({
      path: outPath,
      format: "A4",
      printBackground: true,
      margin,
    });
    console.log(`✓ Généré : ${outPath}`);
  } finally {
    await browser.close();
  }
}

// ─── Données figées pour la page IR (correspondent à la maquette) ────
const dataMaquetteIR: IRPageData = {
  clientName: "Dubreuil",
  dateStr: "25 mai 2026",
  impotNetDu: 14_320,
  trancheMarginale: "30 %",
  tauxMoyen: "7,8 %",
  quotient: "3 parts",
  salaires:        74_000,
  fonciers:        11_000,
  mobiliers:        4_500,
  pensionsAutres:   2_500,
  revenusBruts:    92_000,
  abattement10pct:  9_200,
  revenuNetImposable: 82_800,
  bracketFill: irCalcMaquette.bracketFill,
  quotientParPart: 30_000,
  parts: 3,
  marginalRate: irCalcMaquette.marginalRate,
  notreLecture:
    "Avec 3 parts de quotient familial, l'impôt du foyer atteint 14 320 €, soit un taux moyen de 7,8 % — bien en deçà de votre tranche marginale à 30 %. Vos revenus d'activité en concentrent 80 % ; à ce niveau de tranche, chaque euro versé en épargne retraite déductible allégerait l'impôt de 30 centimes (piste chiffrée au chapitre Recommandations).",
  pagePosition: "2 / 8",
  cabinetLibellePied: "EcoPatrimoine Conseil · Fiscalité — confidentiel",
};

// Cas dédiés au graphe « barème par tranche » (cohérents, dérivés du helper moteur) :
const dataMaquetteIRtmi30 = makeIRFixture({ clientName: "Lefebvre", parts: 2, quotientParPart: 45_000, pagePosition: "2 / 8" }); // TMI 30 %
const dataMaquetteIRtmi41 = makeIRFixture({ clientName: "Aubert",   parts: 2, quotientParPart: 100_000, pagePosition: "2 / 8" }); // TMI 41 %

// Couleurs cabinet de test — identiques à l'IFI pour la cohérence d'évaluation.
const cabinetColorsTest = {
  navy:  "#1B3550",   // bleu profond
  or:    "#A8763B",   // bronze
  cream: "#F6F1E6",
  sky:   "#5B7089",
};

// ─── Données figées pour la page Couverture (correspondent à la maquette) ─
const dataMaquetteCouverture: CouverturePageData = {
  cabinetNom: "EcoPatrimoine Conseil",
  cabinetSousTitre: "CONSEIL",
  orias: "25006907",
  eyebrowDocument: "Conseil en gestion de patrimoine",
  titreDocument: "Rapport\npatrimonial",
  clientName: "Hélène & Marc Dubreuil",
  dateStr: "25 mai 2026",
};

// ─── Données figées pour la page Succession A (correspondent à la maquette) ─
const dataMaquetteSuccessionA: SuccessionAPageData = {
  clientName: "Dubreuil",
  dateStr: "25 mai 2026",
  masseSuccessoraleNette: 1_060_600,
  droitsSuccession: 90_200,
  netTransmis: 970_400,
  tauxMoyen: "8,5 %",
  noteKpi: "Masse civile, hors assurance-vie et PER (transmis hors succession — voir page suivante).",
  devolutionBadge: "Dévolution légale",
  devolutionDescription: "2 enfants · conjoint — option ¼ en pleine propriété",
  reservePct: 67,
  reserveLabel: "Réserve héréditaire · 2/3",
  reserveMontant: 707_067,
  quotitePct: 33,
  quotiteLabel: "Quotité dispo. · 1/3",
  quotiteMontant: 353_533,
  heritiers: [
    { nom: "Hélène Dubreuil",  lien: "Conjoint", partRecue: 265_150, droits: 0,       droitsExonere: true,  net: 265_150 },
    { nom: "Lucas Dubreuil",   lien: "Enfant",   partRecue: 397_725, abattement: 100_000, droits: 45_100, net: 352_625 },
    { nom: "Camille Dubreuil", lien: "Enfant",   partRecue: 397_725, abattement: 100_000, droits: 45_100, net: 352_625 },
  ],
  notreLecture:
    "Avec deux enfants, la réserve héréditaire couvre les deux tiers de la masse, le tiers restant formant la quotité disponible ; le conjoint est exonéré et chaque enfant profite de l'abattement de 100 000 €, d'où des droits limités à 8,5 %. L'assurance-vie, transmise hors succession, est traitée page suivante.",
  pagePosition: "4 / 8",
  cabinetLibellePied: "EcoPatrimoine Conseil · Transmission — confidentiel",
};

// ─── Données figées pour la page Succession B (correspondent à la maquette) ─
const dataMaquetteSuccessionB: SuccessionBPageData = {
  clientName: "Dubreuil",
  dateStr: "25 mai 2026",
  capitauxTransmis: 188_000,
  fiscaliteTotale: 0,
  netAuxBeneficiaires: 188_000,
  abattementRestant: 117_000,
  noteKpi: "Régime : 990 I pour les versements avant 70 ans (abattement de 152 500 € par bénéficiaire) ; 757 B après 70 ans (abattement global de 30 500 €).",
  beneficiaires: [
    { nom: "Lucas Dubreuil",   lien: "Enfant", capital: 94_000, abattement990I: 152_500, fiscalite: 0, net: 94_000 },
    { nom: "Camille Dubreuil", lien: "Enfant", capital: 94_000, abattement990I: 152_500, fiscalite: 0, net: 94_000 },
  ],
  clauseBeneficiaireHtml: "Clause bénéficiaire retenue : <em>mes enfants vivants ou représentés, par parts égales</em>.",
  totalNetTransmis: 1_158_400,
  totalLabelHaut: "Total transmis net aux proches",
  totalLabelBas: "(succession + assurance-vie)",
  notreLecture:
    "Le capital reçu par chaque enfant reste sous le plafond d'abattement de 152 500 € : la transmission s'opère donc entièrement hors fiscalité, et 117 000 € d'abattement demeurent mobilisables pour de futurs versements. L'assurance-vie reste ainsi votre levier de transmission le plus efficace, en complément de la succession civile.",
  pagePosition: "5 / 8",
  cabinetLibellePied: "EcoPatrimoine Conseil · Transmission — confidentiel",
};

// ─── Données figées pour la page Profil (correspondent à la maquette) ────
// Itération validée par David : tableau MIF II remplacé par synthèse +
// renvoi déclaration d'adéquation, ajout encart signature client+conseiller.
const dataMaquetteProfil: ProfilPageData = {
  clientName: "Dubreuil",
  dateStr: "25 mai 2026",
  profilRisque: "Équilibré",
  scoreMifII: "38 / 66",
  horizonPlacement: "8 ans",
  capacitePerte: "Modérée",
  noteKpi: "Capacité à subir des pertes appréciée d'après la situation financière (patrimoine, revenus, épargne disponible) — distincte de la tolérance au risque.",
  niveauActif: "équilibré",
  questionnaire: [
    { question: "Attitude face au risque",         reponse: "Équilibre rendement / risque" },
    { question: "Réaction à une baisse de 20 %",   reponse: "Maintien des positions" },
    { question: "Connaissances & expérience",      reponse: "Fonds €, actions, OPCVM, SCPI" },
    { question: "Pertes / gains déjà subis",       reponse: "Oui, sans modifier sa stratégie" },
    { question: "Mode de gestion",                 reponse: "Conseillée" },
    { question: "Préférences de durabilité (ESG)", reponse: "Souhaitées — part significative", reponseCouleur: "#1F5A41" },
  ],
  adequationTitre: "Adéquation MIF II",
  adequationTexte: "L'allocation recommandée est cohérente avec un profil équilibré, un horizon de 8 ans, une capacité de perte modérée et une préférence marquée pour les investissements durables. Profil établi le 25 mai 2026 — à actualiser en cas d'évolution de votre situation.",
  nomClientSignature: "Hélène & Marc Dubreuil",
  nomConseiller: "David Perry",
  villeSignature: "Perpignan",
  dateSignature: "25 mai 2026",
  pagePosition: "6 / 8",
  cabinetLibellePied: "EcoPatrimoine Conseil · Profil & conformité — confidentiel",
};

// ─── Données figées pour la page Prévoyance collective (maquette) ──────
const dataMaquettePrevoyanceColl: PrevoyanceCollPageData = {
  clientName: "Audit entreprise",
  dateStr: "25 mai 2026",
  sousTitre: "SAS Atlas Ingénierie · 12 salariés",
  conformiteResume: "1 écart",
  effectif: "12 sal.",
  effectifCadres: "3",
  statutDirigeant: "Assimilé salarié",
  ccnLabel: "Convention collective applicable",
  ccnValeur: "Syntec — IDCC 1486",
  ccnPillStatut: "success",
  ccnPillLabel: "Résolue via SIRET · fiable",
  matrice: [
    { titre: "Santé collective obligatoire", reference: "ANI 2013 · art. L.911-7 CSS",                statut: "success", pillLabel: "Conforme" },
    { titre: "Prévoyance décès cadres",      reference: "cotisation 1,50 % sur la tranche T1 (≤ PASS)", statut: "warning", pillLabel: "Écart" },
    { titre: "Planchers de branche",          reference: "lecture détaillée de la CCN Syntec requise", statut: "info",    pillLabel: "À confirmer" },
    { titre: "Catégories objectives",         reference: "décret 2021-1002 · applicable depuis 2025",   statut: "success", pillLabel: "Conforme" },
  ],
  conseilDirigeantHtml: "Président de SAS, <strong>assimilé salarié</strong> : il bénéficie du régime collectif santé et prévoyance de l'entreprise. Une retraite supplémentaire reste mobilisable via un PERO.",
  mentionNonContractuelle: "Analyse non contractuelle, à valider au regard de la convention collective applicable et de la situation réelle de l'entreprise. Ne constitue pas un conseil juridique, fiscal ou en investissement. EcoPatrimoine Conseil — ORIAS n° 25006907.",
  pagePosition: "1 / 4",
  cabinetLibellePied: "EcoPatrimoine Conseil · Audit entreprise — confidentiel",
};

// ─── Données figées pour la page Bilan patrimonial / endettement (maquette) ─
const dataMaquetteBilanEndettement: BilanEndettementPageData = {
  clientName: "Dubreuil",
  dateStr: "25 mai 2026",
  patrimoineNet: 1_248_600,
  actifBrut: 1_460_000,
  passifTotal: 211_400,
  tauxEndettement: "25 %",
  noteKpi: "Taux d'endettement (méthode bancaire) : charges de crédit, assurance comprise, ÷ revenus nets retenus — loyers comptés à 70 %. Plafond HCSF de 35 %.",
  // Détail du calcul pour transparence : 19 800 / 79 200 = 25 %
  calculTaux: {
    chargesCreditAnnuelles:   18_600,   // 1 550 €/mois × 12
    assuranceCreditAnnuelle:   1_200,   // 100 €/mois × 12
    salairesNetsAnnuels:      74_000,   // cohérent fixture IR (salaires & traitements)
    loyersBrutsAnnuels:        7_429,   // ≈ pour avoir 5 200 € retenus à 70 %
    quotitLoyers: 0.70,
  },
  immobilier:           953_400,
  placementsFinanciers: 318_600,
  assuranceVieEtPER:    188_000,
  creditImmobilier:     185_000,
  autresCredits:         26_400,
  notreLecture:
    "Votre patrimoine net atteint 1 248 600 €, porté par l'immobilier (953 400 € bruts) et une poche financière de 506 600 €, après 211 400 € de crédits dont 185 000 € affectés à l'immobilier. Calculé à la manière des banques, votre taux d'endettement ressort à 25 %, sous le plafond de 35 % — vous conservez donc une capacité d'emprunt ; l'assurance-vie et le PER (188 000 €) restent par ailleurs un levier clé de transmission, détaillée au chapitre suivant.",
  pagePosition: "1 / 8",
  cabinetLibellePied: "EcoPatrimoine Conseil · Patrimoine — confidentiel",
};

// ─── Données figées pour la Lettre de mission v2 (post-audit conformité) ─
const dataMaquetteLettreMission: LettreMissionPageData = {
  // Cabinet
  cabinetNom: "EcoPatrimoine Conseil",
  cabinetAdresse: "6 rue Victor Mirabeau, 66000 Perpignan",
  cabinetTel: "tel à renseigner",                  // M6
  cabinetEmail: "contact@ecopatrimoine-conseil.com", // M6
  cabinetORIAS: "25006907",
  cabinetStatuts: "Courtier en assurance (COA)",
  cabinetConseiller: "David Perry",
  cabinetBaremeHonoraires: "barème honoraires",
  cabinetPartenaires: "à compléter dans Paramètres",  // M3
  cabinetNiveauConseil: "1",                       // M2 (Niveau 1 par défaut)
  cabinetRcpAssureur: "assureur RCP à confirmer",  // M1
  cabinetRcpContrat: "n° contrat à confirmer",     // M1
  cabinetRcpGarantiesMin: "1 564 610 € par sinistre / 2 315 610 € par année (arrêté du 29 oct. 2024 — à revérifier)", // M1
  cabinetMediateur: "Médiateur de l'Assurance",    // M5
  cabinetMediateurAdresse: "TSA 50110, 75441 Paris Cedex 09",
  cabinetMediateurUrl: "www.mediation-assurance.org",
  cabinetAssociationCif: undefined,                // non applicable (statutCif false)
  // Statuts (B2 : AMF + association CIF désactivés quand statutCif false)
  statutCif: false,                                // David est COA seul aujourd'hui
  // Client (varm)
  clientNom: "nom & prénom",
  clientAdresse: "adresse",
  clientContact: "contact",
  dateLettre: "25 mai 2026",
  // Prestations
  prestations: [
    { label: "Bilan patrimonial global",           cochee: true  },
    { label: "Optimisation fiscale (IR / IFI)",    cochee: true  },
    { label: "Stratégie de transmission",          cochee: true  },
    { label: "Analyse prévoyance & protection",    cochee: true  },
    { label: "Préparation de la retraite",         cochee: false },
    { label: "Allocation d'actifs / placements",   cochee: false },
  ],
  remunerationMode: "mode & montant / assiette",
  natureConseil: "non indépendant",
  dureeMission: "ponctuelle / annuelle / reconductible",
  delaiPreavis: "délai",
  villeSignature: "lieu",
  mentionNonContractuelle: "Document d'aide à la conformité remis à titre indicatif. Ne constitue ni une attestation de conformité, ni un conseil juridique. À valider au regard des textes en vigueur, du contrôle de l'association agréée et, le cas échéant, d'un avocat. EcoPatrimoine Conseil — ORIAS n° 25006907 (statuts à confirmer sur www.orias.fr).",
};

// ─── Données figées pour le DER v2 (cabinet David COA seul) ────────────
const dataMaquetteDer: DerPageData = {
  cabinetNom: "EcoPatrimoine Conseil",
  cabinetAdresse: "6 rue Victor Mirabeau, 66000 Perpignan",
  cabinetEmail: "contact@ecopatrimoine-conseil.com",
  cabinetTel: undefined,
  cabinetORIAS: "25006907",
  cabinetForme: "forme",       // affiché annoté champCabinet
  cabinetCapital: "capital",
  cabinetSiren: "SIREN",
  cabinetRcsVille: "Perpignan",
  cabinetRcs: "123 456 789",
  cabinetConseiller: "David Perry",
  // Statuts ORIAS (David COA seul aujourd'hui)
  statutCif: false,
  statutIas: true,
  statutCoa: true,
  statutMia: false,
  cabinetCategorieIas: "Courtier en assurance (COA)",
  statutIobsp: false,
  cabinetAssociationCif: undefined,
  cabinetCategorieIobsp: undefined,
  statutCarteT: false,
  // RCP
  cabinetRcpAssureur: "assureur RCP",
  cabinetRcpContrat: "n° police",
  cabinetRcpMontants: "1 564 610 € / sinistre — 2 315 610 € / an (arrêté 29/10/2024)",
  cabinetGarantieFinanciere: "garantie financière / « ne reçoit aucun fonds »",
  // Rémunération
  remunerationCifMode: undefined,  // statutCif false → ne sera pas affiché
  remunerationIasMode: "courtier / mandataire · commissions / honoraires",
  natureConseil: "indépendant / non indépendant",
  partenaires: "liste des partenaires / promoteurs",
  // Médiateurs
  mediateurAmf: undefined,         // statutCif false → ne sera pas affiché
  mediateurAssurance: "médiateur de l'assurance",
  dateLettre: "25 mai 2026",
  villeSignature: "lieu",
  mentionNonContractuelle: "Document d'aide à la conformité remis à titre indicatif. Ne constitue ni une attestation de conformité, ni un conseil juridique. À valider au regard des textes en vigueur, du contrôle de l'association agréée et, le cas échéant, d'un avocat. EcoPatrimoine Conseil — ORIAS n° 25006907 (statuts à confirmer sur www.orias.fr).",
};

// ─── Données figées pour la Fiche conseil DDA v2 (cabinet David COA seul) ─
const dataMaquetteFicheDDA: FicheDDAPageData = {
  cabinetNom: "EcoPatrimoine Conseil",
  cabinetORIAS: "25006907",
  cabinetConseiller: "David Perry",
  cabinetCategorieIas: "catégorie IAS",
  cabinetStatut: "courtier / mandataire",
  cabinetModeRemuneration: "commissions / honoraires",
  dateLettre: "25 mai 2026",
  client: {
    person1: { nom: "Hélène Dubreuil", naissance: "15/03/1975" },
    person2: { nom: "Marc Dubreuil",   naissance: "22/08/1972" },
    adresse: "12 rue des Lilas, 66000 Perpignan",
  },
  origineDesBesoins: "issu du dossier",
  besoins: [
    { iconeKey: "shieldHeart",        texteHtml: "Protéger le foyer (conjoint + 2 enfants) en cas de décès, à hauteur du capital restant dû et des besoins futurs." },
    { iconeKey: "activityHeartbeat",  texteHtml: "Maintenir le revenu en cas d'invalidité ou d'arrêt de travail prolongé." },
    { iconeKey: "calendarEuro",       texteHtml: "Disposer d'une épargne de moyen-long terme à vocation de valorisation et de transmission." },
  ],
  garanties: [
    { texteHtml: "Contrat de prévoyance avec <strong>capital décès</strong> couvrant le déficit identifié." },
    { texteHtml: "Garantie <strong>maintien de revenu</strong> (rente d'invalidité et indemnités d'arrêt de travail)." },
    { texteHtml: "Contrat d'<strong>assurance-vie</strong> multisupport avec poche d'unités de compte durables." },
  ],
  miseEnRegard: [
    { besoin: "Protection en cas de décès", reponse: "Le capital décès couvre le crédit restant et sécurise les besoins du conjoint et des enfants." },
    { besoin: "Maintien du revenu",         reponse: "La rente d'invalidité et les indemnités compensent la perte de revenu en cas d'incapacité." },
    { besoin: "Épargne & transmission",     reponse: "L'assurance-vie valorise l'épargne à moyen terme et organise la transmission via la clause bénéficiaire." },
  ],
  voletIbipHtml:
    "Pour le contrat d'assurance-vie en unités de compte, une <strong>adéquation renforcée</strong> est réalisée : cohérence avec votre profil, votre horizon, votre capacité à subir des pertes et vos <strong>préférences de durabilité (ESG)</strong>, exprimées au questionnaire.",
  textRemunerationImpartialiteHtml:
    "La nature et, le cas échéant, le montant de la rémunération vous sont communiqués <strong>avant la souscription</strong>. Le cabinet agit sans que sa rémunération n'oriente le choix du contrat.",
  documentsRemisHtml:
    "<strong>Documents remis avec cette fiche</strong> : pour l'assurance non-vie, le document d'information normalisé <strong>(IPID)</strong> ; pour l'assurance-vie, le <strong>document d'informations clés (DIC)</strong>. Ces documents sont établis par l'assureur concepteur du produit.",
  documents: [
    { type: "ipid", nom: "IPID_Prévoyance_2026.pdf" },
    { type: "dic",  nom: "DIC_AssuranceVie_multisupport.pdf" },
  ],
  recommandationsGroupees: [
    {
      dimensionLabel: "Besoin exprimé",
      recos: [
        {
          libelle: "Mettre en place une garantie capital décès à hauteur du capital restant dû",
          justification: "Le foyer dépend des revenus du conjoint actif ; le capital décès couvre le crédit restant et sécurise les enfants jusqu'à leur autonomie.",
          besoinLibelle: "Prévoyance — Décès",
        },
        {
          libelle: "Souscrire une rente d'invalidité couvrant 60 % du revenu d'activité",
          justification: "Un arrêt prolongé ferait chuter le revenu de 35 % du foyer ; la rente comble cet écart sans toucher à l'épargne de précaution.",
          besoinLibelle: "Prévoyance — Arrêt de travail / invalidité",
        },
      ],
    },
    {
      dimensionLabel: "Préférences en matière de durabilité (ESG)",
      recos: [
        {
          libelle: "Privilégier des UC labellisées ISR / Greenfin / Finansol",
          justification: "Préférence ESG significative exprimée au questionnaire ; les labels publics garantissent la cohérence des supports avec les attentes.",
        },
      ],
    },
  ],
  mentionNonContractuelle:
    "Document d'aide à la conformité remis à titre indicatif. Ne constitue ni une attestation de conformité, ni un conseil juridique. À valider au regard des textes en vigueur et du contrôle de l'association agréée. EcoPatrimoine Conseil — ORIAS n° 25006907 (statuts à confirmer sur www.orias.fr).",
};

// ─── Données figées pour la Déclaration d'adéquation v2 (cabinet David) ─
const dataMaquetteDeclarationAdequation: DeclarationAdequationPageData = {
  cabinetNom: "EcoPatrimoine Conseil",
  cabinetConseiller: "David Perry",
  dateConseil: "25 mai 2026",
  heureConseil: "14h30",
  dateQuestionnaire: "10 mai 2026",
  origineRecommandations: "contenu dossier",
  profil: [
    { label: "Objectif principal",            valeurHtml: "Valoriser son patrimoine &amp; préparer la transmission" },
    { label: "Horizon",                       valeurHtml: "8 ans" },
    { label: "Profil de risque",              valeurHtml: `Équilibré <span style="color:#8C8472">(échelle 4 niveaux)</span>` },
    {
      label: "Capacité à subir des pertes",
      valeurHtml: "Modérée",
      puces: [
        "Coussin liquide de 8 mois de revenu — au-dessus du seuil de 6 mois (capacité faible).",
        "Endettement raisonnable (25 %), sous le plafond HCSF de 35 %.",
        "Revenus de couple stables (2 actifs), pas de pénalité revenu unique.",
      ],
    },
    { label: "Préférences de durabilité (ESG)", valeurHtml: "Souhaitées — part significative d'investissements durables", pleineLargeur: true },
  ],
  recommandations: [
    { texteHtml: "Allocation cible 60 % supports sécurisés / 40 % unités de compte, dont une poche d'investissements durables." },
    { texteHtml: "Versement sur un <strong>PER</strong> pour préparer la retraite et optimiser l'impôt sur le revenu." },
    { texteHtml: "Renforcement de la clause bénéficiaire de l'assurance-vie au profit des enfants." },
  ],
  miseEnRegard: [
    { besoin: "Objectif : valoriser & transmettre", reponse: "L'allocation et le PER visent la valorisation long terme ; la clause bénéficiaire sert la transmission." },
    { besoin: "Horizon de 8 ans",                    reponse: "La part d'unités de compte est cohérente avec un placement à moyen-long terme." },
    { besoin: "Profil équilibré",                    reponse: "Le couple 60 / 40 correspond à une prise de risque mesurée, sans recherche de performance maximale." },
    { besoin: "Capacité de perte modérée",           reponse: "La poche sécurisée majoritaire limite l'amplitude des pertes possibles au regard de votre situation." },
    { besoin: "Préférence de durabilité",            reponse: "Une poche d'investissements durables répond à votre souhait exprimé en matière d'ESG." },
  ],
  coutConseilHtml: "honoraires du dossier",
  fraisSupportsHtml: "frais courants / entrée",
  natureConseilHtml: "indépendant / non",
  suiviActiveHtml: "est / n'est pas",
  periodiciteSuiviHtml: "périodicité",
  recommandationsGroupees: [
    {
      dimensionLabel: "Besoin exprimé",
      recos: [
        {
          libelle: "Mettre en place une garantie capital décès à hauteur du capital restant dû",
          justification: "Le foyer dépend des revenus du conjoint actif ; le capital décès couvre le crédit restant et sécurise les enfants jusqu'à leur autonomie.",
          besoinLibelle: "Prévoyance — Décès",
        },
        {
          libelle: "Souscrire une rente d'invalidité couvrant 60 % du revenu d'activité",
          justification: "Un arrêt prolongé ferait chuter le revenu de 35 % du foyer ; la rente comble cet écart sans toucher à l'épargne de précaution.",
          besoinLibelle: "Prévoyance — Arrêt de travail / invalidité",
        },
      ],
    },
    {
      dimensionLabel: "Tolérance au risque",
      recos: [
        {
          libelle: "Allocation 60 % supports sécurisés / 40 % unités de compte",
          justification: "Profil équilibré : prise de risque mesurée, sans recherche de performance maximale. La poche UC permet de capter la croissance long terme.",
        },
      ],
    },
    {
      dimensionLabel: "Préférences en matière de durabilité (ESG)",
      recos: [
        {
          libelle: "Privilégier des UC labellisées ISR / Greenfin / Finansol",
          justification: "Préférence ESG significative exprimée au questionnaire ; les labels publics garantissent la cohérence des supports avec les attentes.",
        },
      ],
    },
    {
      dimensionLabel: "Capacité à subir des pertes",
      recos: [
        {
          libelle: "Limiter à 40 % la part d'UC pour préserver le coussin liquide",
          justification: "Capacité modérée : un coussin liquide de 8 mois existe mais ne doit pas être consommé par des pertes UC sur un horizon court.",
        },
      ],
    },
  ],
  mentionNonContractuelle: "Document d'aide à la conformité remis à titre indicatif. Ne constitue ni une attestation de conformité, ni un conseil juridique. À valider au regard des textes en vigueur, du contrôle de l'association agréée et, le cas échéant, d'un avocat. EcoPatrimoine Conseil — ORIAS n° 25006907 (statuts à confirmer sur www.orias.fr).",
};

// ─── Fixtures Capitaux décès (forme BRUTE computeSuccession) — 2 modes ──────
// Client/cabinet communs (le clientName est passé explicitement à l'adapter).
const dataClientCapitaux = { person1FirstName: "Hélène", person1LastName: "Dubreuil", person2FirstName: "Marc", person2LastName: "Dubreuil", coupleStatus: "married" };
const cabinetCapitaux = { cabinetName: "EcoPatrimoine Conseil" };

// MODE SIMPLE — toutes les lignes privées en natureAssiette=primes_avant70.
const successionCapitauxSimple = {
  capitalDecesLines: {
    caisses: [
      { source: "CARMF", capital: 79152, nbEnfants: 2, donneeIndisponible: false, exonere: true,
        repartition: [{ beneficiaire: "Hélène Dubreuil", relation: "conjoint", montant: 79152, origine: "capital_principal", source: "auto" }] },
      { source: "CIPAV", capital: null, nbEnfants: 2, donneeIndisponible: true, exonere: true, repartition: [] },
    ],
    prives: [
      { contrat: "Prévoyance Madelin", beneficiary: "Hélène Dubreuil", relation: "conjoint", sharePct: 100, montant: 200000, natureAssiette: "primes_avant70", assiette990I: 8000, before70Taxable: 0, duties: 0 },
      { contrat: "Temporaire décès groupe", beneficiary: "Lucas Dubreuil", relation: "enfant", sharePct: 50, montant: 50000, natureAssiette: "primes_avant70", assiette990I: 2000, before70Taxable: 0, duties: 0 },
    ],
    branche: [
      { source: "Syntec — IDCC 1486", capital: 120000, categorie: "cadres", exonere: true, donneeIndisponible: false, beneficiairesAuContrat: true, repartition: [] },
    ],
    renteEducationBranche: [
      { enfantPrenom: "Lucas", ageActuel: 12, montantAnnuelCourant: 4800, phases: [], donneeIndisponible: false, exonere: true, source: "Syntec" },
    ],
    renteConjointBranche: [],
  },
  capitalDecesCaisseExonere: 79152,
  capitalDecesBrancheExonere: 120000,
  capitalDecesPriveCapital: 250000,
  capitalDecesPriveDuties: 0,
  rentesSurvieAnnuelles: [
    { source: "CARMF", type: "conjoint", montantAnnuel: 12000 },
    { source: "Contrat individuel", type: "education", montantAnnuel: 6000 },
  ],
};

// MODE RACHETABLE — >=1 ligne natureAssiette=capital + bénéficiaire sur 2 natures.
const successionCapitauxRachetable = {
  capitalDecesLines: {
    caisses: [
      { source: "CARMF", capital: 79152, nbEnfants: 2, donneeIndisponible: false, exonere: true,
        repartition: [{ beneficiaire: "Hélène Dubreuil", relation: "conjoint", montant: 79152, origine: "capital_principal", source: "auto" }] },
    ],
    prives: [
      { contrat: "Vie entière patrimoniale", beneficiary: "Marie Martin", relation: "enfant", sharePct: 50, montant: 180000, natureAssiette: "capital", assiette990I: 180000, before70Taxable: 27500, duties: 5500 },
      { contrat: "Vie entière patrimoniale", beneficiary: "Paul Martin", relation: "enfant", sharePct: 50, montant: 180000, natureAssiette: "capital", assiette990I: 180000, before70Taxable: 27500, duties: 5500 },
      { contrat: "Vie entière patrimoniale", beneficiary: "Marie Martin", relation: "enfant", sharePct: 100, montant: 20000, natureAssiette: "primes_avant70", assiette990I: 3000, before70Taxable: 0, duties: 0 },
    ],
    branche: [
      { source: "Syntec — IDCC 1486", capital: null, categorie: "nonCadres", exonere: true, donneeIndisponible: true, beneficiairesAuContrat: true, repartition: [] },
    ],
    renteEducationBranche: [],
    renteConjointBranche: [
      { montantAnnuel: 9000, dureeMaxAnnees: 10, beneficiaireNom: "Hélène Dubreuil", source: "Syntec", exonere: true, donneeIndisponible: false, mode: "substitutive", finAgeDefunt: 67 },
    ],
  },
  capitalDecesCaisseExonere: 79152,
  capitalDecesBrancheExonere: 0,
  capitalDecesPriveCapital: 380000,
  capitalDecesPriveDuties: 11000,
  rentesSurvieAnnuelles: [
    { source: "CARMF", type: "conjoint", montantAnnuel: 12000 },
  ],
};

// ─── Fixtures pageHypos (Lot 5.2) — base + scénarios (filet vert/rouge/neutre + palette) ──
// Forme BRUTE attendue par buildHyposData : hypothesisResults[] (déjà calculés côté App via
// computeIR/IFI/Succession). L'adapter dérive deltaTotal (somme signée) → pilote le filet.
const hyposBase = { ir: { finalIR: 14_320 }, ifi: { ifi: 8_000 }, succession: { totalRights: 90_200 } };
const hyposClient = { person1FirstName: "Hélène", person1LastName: "Dubreuil", person2FirstName: "Marc", person2LastName: "Dubreuil", coupleStatus: "married" };
const hyposCabinet = { cabinetName: "EcoPatrimoine Conseil" };
const hyposResultats = {
  perPER:       { hypothesis: { name: "PER 10 k€/an",        objective: "Réduire l'IR",                notes: "Versement déductible, plafond épargne retraite." }, ir: { finalIR: 11_000 }, ifi: { ifi: 8_000 },  succession: { totalRights: 90_200 } }, // gain (vert)
  donation:     { hypothesis: { name: "Donation 100 k€",     objective: "Anticiper la transmission" },                                                                ir: { finalIR: 14_320 }, ifi: { ifi: 6_500 },  succession: { totalRights: 78_000 } }, // gain (vert)
  demembrement: { hypothesis: { name: "Démembrement RP",     objective: "Réorganiser l'actif immobilier" },                                                          ir: { finalIR: 15_000 }, ifi: { ifi: 9_000 },  succession: { totalRights: 95_000 } }, // surcoût (rouge)
  assuranceVie: { hypothesis: { name: "Assurance-vie 152 k€", objective: "Transmettre hors succession" },                                                             ir: { finalIR: 14_320 }, ifi: { ifi: 8_000 },  succession: { totalRights: 70_000 } }, // gain net (vert)
  arbitrage:    { hypothesis: { name: "Arbitrage locatif",   objective: "Recomposer le patrimoine" },                                                                 ir: { finalIR: 18_000 }, ifi: { ifi: 12_000 }, succession: { totalRights: 92_000 } }, // surcoût net (rouge)
};
function hyposData(results: any[]) {
  return buildHyposData({
    data: hyposClient, cabinet: hyposCabinet,
    ir: hyposBase.ir, ifi: hyposBase.ifi, succession: hyposBase.succession,
    hypothesisResults: results, clientName: "Hélène & Marc Dubreuil", dateLettre: "25 mai 2026", pagePosition: "8 / 8",
  });
}

async function main(): Promise<void> {
  const cible = process.argv[2] || "ifi";
  const ciblesValides = ["ifi", "ir", "couverture", "successionA", "successionB", "profil", "prevoyanceColl", "bilanEndettement", "lettreMission", "der", "ficheDDA", "declarationAdequation", "capitauxDeces", "hypos"];
  if (!ciblesValides.includes(cible)) {
    console.error(`Cible inconnue : "${cible}". Cibles disponibles : ${ciblesValides.join(", ")}`);
    process.exit(1);
  }

  if (cible === "ifi") {
    // Thème 1 : Encre & Or (valeurs maquette exactes)
    const htmlEncreOr = renderIFI({ theme: "encreOr", data: dataMaquette });
    await genererPdf(htmlEncreOr, join(outDir, "ifi-encreOr.pdf"));
    // Thème 2 : Cabinet (couleurs de test)
    const htmlCabinet = renderIFI({ theme: "cabinet", cabinetColors: cabinetColorsTest, data: dataMaquette });
    await genererPdf(htmlCabinet, join(outDir, "ifi-cabinet.pdf"));
    // Cas chargé : assiette 3 M€ au-dessus du seuil → graphe barème par tranche visible.
    const htmlCharge = renderIFI({ theme: "encreOr", data: dataMaquetteIFICharge });
    await genererPdf(htmlCharge, join(outDir, "ifi-charge-encreOr.pdf"));
    console.log("\n→ Compare les PDFs générés (dossier out/) à la maquette :");
    console.log("  revue-preview/pdf/refonte_pdf_page_theme_ifi_A4.html");
    console.log("  + ifi-charge-encreOr.pdf : cas au-dessus du seuil (graphe barème par tranche)");
  }

  if (cible === "ir") {
    const htmlEncreOr = renderIR({ theme: "encreOr", data: dataMaquetteIR });
    await genererPdf(htmlEncreOr, join(outDir, "ir-encreOr.pdf"));
    const htmlCabinet = renderIR({ theme: "cabinet", cabinetColors: cabinetColorsTest, data: dataMaquetteIR });
    await genererPdf(htmlCabinet, join(outDir, "ir-cabinet.pdf"));
    // Cas dédiés au graphe barème par tranche (par part), badge TMI sur la tranche du quotient.
    await genererPdf(renderIR({ theme: "encreOr", data: dataMaquetteIRtmi30 }), join(outDir, "ir-tmi30-encreOr.pdf"));
    await genererPdf(renderIR({ theme: "encreOr", data: dataMaquetteIRtmi41 }), join(outDir, "ir-tmi41-encreOr.pdf"));
    console.log("\n→ Compare les PDFs générés (dossier out/) à la maquette :");
    console.log("  revue-preview/pdf/refonte_pdf_page_fiscalite_A4_graphique_corrige.html");
    console.log("  + ir-tmi30-encreOr.pdf / ir-tmi41-encreOr.pdf : graphe barème par tranche (badge TMI)");
  }

  if (cible === "couverture") {
    const htmlEncreOr = renderCouverture({ theme: "encreOr", data: dataMaquetteCouverture });
    await genererPdf(htmlEncreOr, join(outDir, "couverture-encreOr.pdf"));
    const htmlCabinet = renderCouverture({ theme: "cabinet", cabinetColors: cabinetColorsTest, data: dataMaquetteCouverture });
    await genererPdf(htmlCabinet, join(outDir, "couverture-cabinet.pdf"));
    console.log("\n→ Compare les PDFs générés (dossier out/) à la maquette :");
    console.log("  revue-preview/pdf/refonte_pdf_couverture_C_retouchee.html");
  }

  if (cible === "successionA") {
    const htmlEncreOr = renderSuccessionA({ theme: "encreOr", data: dataMaquetteSuccessionA });
    await genererPdf(htmlEncreOr, join(outDir, "successionA-encreOr.pdf"));
    const htmlCabinet = renderSuccessionA({ theme: "cabinet", cabinetColors: cabinetColorsTest, data: dataMaquetteSuccessionA });
    await genererPdf(htmlCabinet, join(outDir, "successionA-cabinet.pdf"));
    console.log("\n→ Compare les PDFs générés (dossier out/) à la maquette :");
    console.log("  revue-preview/pdf/refonte_pdf_succession_pageA_corrige_hauteur.html");
  }

  if (cible === "successionB") {
    const htmlEncreOr = renderSuccessionB({ theme: "encreOr", data: dataMaquetteSuccessionB });
    await genererPdf(htmlEncreOr, join(outDir, "successionB-encreOr.pdf"));
    const htmlCabinet = renderSuccessionB({ theme: "cabinet", cabinetColors: cabinetColorsTest, data: dataMaquetteSuccessionB });
    await genererPdf(htmlCabinet, join(outDir, "successionB-cabinet.pdf"));
    console.log("\n→ Compare les PDFs générés (dossier out/) à la maquette :");
    console.log("  revue-preview/pdf/refonte_pdf_succession_pageB_consolide_deux_lignes.html");
  }

  if (cible === "profil") {
    const htmlEncreOr = renderProfil({ theme: "encreOr", data: dataMaquetteProfil });
    await genererPdf(htmlEncreOr, join(outDir, "profil-encreOr.pdf"));
    const htmlCabinet = renderProfil({ theme: "cabinet", cabinetColors: cabinetColorsTest, data: dataMaquetteProfil });
    await genererPdf(htmlCabinet, join(outDir, "profil-cabinet.pdf"));
    console.log("\n→ Compare les PDFs générés (dossier out/) à la maquette :");
    console.log("  revue-preview/pdf/refonte_pdf_profil_conformite_4niveaux_esg.html");
  }

  if (cible === "prevoyanceColl") {
    const htmlEncreOr = renderPrevoyanceColl({ theme: "encreOr", data: dataMaquettePrevoyanceColl });
    await genererPdf(htmlEncreOr, join(outDir, "prevoyanceColl-encreOr.pdf"));
    const htmlCabinet = renderPrevoyanceColl({ theme: "cabinet", cabinetColors: cabinetColorsTest, data: dataMaquettePrevoyanceColl });
    await genererPdf(htmlCabinet, join(outDir, "prevoyanceColl-cabinet.pdf"));
    console.log("\n→ Compare les PDFs générés (dossier out/) à la maquette :");
    console.log("  revue-preview/pdf/refonte_pdf_page_theme_prevoyance_collective_premier_jet.html");
  }

  if (cible === "bilanEndettement") {
    const htmlEncreOr = renderBilanEndettement({ theme: "encreOr", data: dataMaquetteBilanEndettement });
    await genererPdf(htmlEncreOr, join(outDir, "bilanEndettement-encreOr.pdf"));
    const htmlCabinet = renderBilanEndettement({ theme: "cabinet", cabinetColors: cabinetColorsTest, data: dataMaquetteBilanEndettement });
    await genererPdf(htmlCabinet, join(outDir, "bilanEndettement-cabinet.pdf"));
    console.log("\n→ Compare les PDFs générés (dossier out/) à la maquette :");
    console.log("  revue-preview/pdf/refonte_pdf_bilan_taux_endettement_methode_bancaire.html");
  }

  if (cible === "lettreMission") {
    const htmlEncreOr = renderLettreMission({ theme: "encreOr", data: dataMaquetteLettreMission });
    await genererPdf(htmlEncreOr, join(outDir, "lettreMission-encreOr.pdf"));
    const htmlCabinet = renderLettreMission({ theme: "cabinet", cabinetColors: cabinetColorsTest, data: dataMaquetteLettreMission });
    await genererPdf(htmlCabinet, join(outDir, "lettreMission-cabinet.pdf"));
    console.log("\n→ Compare les PDFs générés (dossier out/) à la maquette :");
    console.log("  revue-preview/pdf/refonte_pdf_lettre_de_mission_2pages.html");
  }

  if (cible === "der") {
    const htmlEncreOr = renderDer({ theme: "encreOr", data: dataMaquetteDer });
    await genererPdf(htmlEncreOr, join(outDir, "der-encreOr.pdf"));
    const htmlCabinet = renderDer({ theme: "cabinet", cabinetColors: cabinetColorsTest, data: dataMaquetteDer });
    await genererPdf(htmlCabinet, join(outDir, "der-cabinet.pdf"));
    console.log("\n→ Compare les PDFs générés (dossier out/) à la maquette :");
    console.log("  revue-preview/pdf/refonte_pdf_der_document_entree_en_relation_2pages.html");
  }

  if (cible === "ficheDDA") {
    const htmlEncreOr = renderFicheDDA({ theme: "encreOr", data: dataMaquetteFicheDDA });
    await genererPdf(htmlEncreOr, join(outDir, "ficheDDA-encreOr.pdf"));
    const htmlCabinet = renderFicheDDA({ theme: "cabinet", cabinetColors: cabinetColorsTest, data: dataMaquetteFicheDDA });
    await genererPdf(htmlCabinet, join(outDir, "ficheDDA-cabinet.pdf"));
    console.log("\n→ Compare les PDFs générés (dossier out/) à la maquette :");
    console.log("  revue-preview/pdf/refonte_pdf_fiche_conseil_dda_2pages.html");
  }

  if (cible === "declarationAdequation") {
    const htmlEncreOr = renderDeclarationAdequation({ theme: "encreOr", data: dataMaquetteDeclarationAdequation });
    await genererPdf(htmlEncreOr, join(outDir, "declarationAdequation-encreOr.pdf"));
    const htmlCabinet = renderDeclarationAdequation({ theme: "cabinet", cabinetColors: cabinetColorsTest, data: dataMaquetteDeclarationAdequation });
    await genererPdf(htmlCabinet, join(outDir, "declarationAdequation-cabinet.pdf"));
    console.log("\n→ Compare les PDFs générés (dossier out/) à la maquette :");
    console.log("  revue-preview/pdf/refonte_pdf_declaration_adequation_2pages.html");
  }

  if (cible === "capitauxDeces") {
    // Les 2 PDF couvrent les 2 MODES (et non 2 thèmes) : la bascule detailMode
    // est calculée par l'adapter à partir des natures de contrat de la fixture.
    const tCap = buildTokens("encreOr");
    const dataSimple = buildCapitauxDecesData({ succession: successionCapitauxSimple, data: dataClientCapitaux, cabinet: cabinetCapitaux, clientName: "Hélène & Marc Dubreuil", dateLettre: "25 mai 2026", pagePosition: "7 / 8" });
    const htmlSimple = coquilleDocument(tCap, { titre: "Capitaux décès — mode simple", body: pageCapitauxDeces(tCap, dataSimple) });
    await genererPdf(htmlSimple, join(outDir, "capitauxDeces-simple.pdf"));
    const dataRachetable = buildCapitauxDecesData({ succession: successionCapitauxRachetable, data: dataClientCapitaux, cabinet: cabinetCapitaux, clientName: "Hélène & Marc Dubreuil", dateLettre: "25 mai 2026", pagePosition: "7 / 8" });
    const htmlRachetable = coquilleDocument(tCap, { titre: "Capitaux décès — mode rachetable", body: pageCapitauxDeces(tCap, dataRachetable) });
    await genererPdf(htmlRachetable, join(outDir, "capitauxDeces-rachetable.pdf"));
    console.log("\n→ 2 PDF générés (dossier out/) couvrant les 2 modes :");
    console.log("  out/capitauxDeces-simple.pdf      (toutes lignes primes_avant70)");
    console.log("  out/capitauxDeces-rachetable.pdf  (contrat rachetable + bénéficiaire double)");
  }

  if (cible === "hypos") {
    // 4 cas pour valider visuellement Lot 5.2 : filet de sévérité (vert/rouge/neutre piloté
    // par deltaTotal), bordure renforcée, palette de scénarios (sans cap, sans répétition).
    const tH = buildTokens("encreOr");
    const R = hyposResultats;
    const cas: { nom: string; libelle: string; results: any[] }[] = [
      { nom: "2scenarios", libelle: "2 scénarios (1 gain + 1 surcoût)",          results: [R.perPER, R.demembrement] },
      { nom: "5scenarios", libelle: "5 scénarios (palette + filets mélangés)",   results: [R.perPER, R.donation, R.demembrement, R.assuranceVie, R.arbitrage] },
      { nom: "surcout",    libelle: "1 surcoût net (filet rouge)",               results: [R.arbitrage] },
      { nom: "gagnant",    libelle: "1 gagnant (filet vert)",                    results: [R.assuranceVie] },
    ];
    for (const c of cas) {
      const html = coquilleDocument(tH, { titre: `Scénarios d'optimisation — ${c.libelle}`, body: pageHypos(tH, hyposData(c.results)) });
      await genererPdf(html, join(outDir, `hypos-${c.nom}.pdf`));
    }
    console.log("\n→ 4 PDF générés (dossier out/) couvrant filet (vert/rouge/neutre) + palette :");
    console.log("  out/hypos-2scenarios.pdf  out/hypos-5scenarios.pdf  out/hypos-surcout.pdf  out/hypos-gagnant.pdf");
  }
}

main().catch(err => {
  console.error("Erreur :", err);
  process.exit(1);
});
