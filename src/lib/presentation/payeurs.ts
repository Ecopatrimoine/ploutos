// LOT 10c — SOURCE UNIQUE des libellés & couleurs des PAYEURS de prévoyance (écran).
// Avant ce module, les libellés étaient re-tapés inline dans ProjectionChart,
// BlocPedagogie et TableauJalons (3 wordings divergents pour « collective » /
// « individuelle »). Ici : une définition par ÉTAGE (= une série empilée), qui porte
// ses 3 variantes de libellé existantes (graphe / légende / composition) + sa famille
// payeur + sa couleur. Aucun libellé métier inventé ; les chaînes du graphe restent
// STRICTEMENT identiques (test ProjectionChart.tooltip). Le PDF migrera au lot 11.
import type { SerieEmpilee } from "../prevoyance/types";

export type SerieKey = keyof SerieEmpilee;
export type PayeurFamille = "salaire" | "maintien" | "obligatoire" | "collective" | "individuelle";

// Palette charte (SPEC_PREVOYANCE_UI_GRAPHIQUE §5) — était dupliquée dans
// ProjectionChart.COL et BlocPedagogie.COL. Navy/gold surchargeables par le thème.
export const PAYEUR_COLORS: Record<PayeurFamille | "reference", string> = {
  salaire: "var(--cab-gold, #E3AF64)",
  maintien: "#5B7FB0",
  obligatoire: "var(--cab-navy, #101B3B)",
  collective: "#A9B8D4",
  individuelle: "#B5806B", // Madelin : terracotta sourd, color-blind safe
  reference: "#888780",
};

export type EtageDef = {
  serieKey: SerieKey;   // clé dans ProjectionResult.series
  dataKey: string;      // alias court du graphe (Recharts)
  famille: PayeurFamille;
  nom: string;          // libellé long (aires + tooltip graphe) — identique à l'existant
  legende: string;      // libellé de la légende pédagogique
  court: string;        // libellé court (composition, tableau €)
  opacity: number;      // opacité de l'aire / de la pastille
};

// Ordre = ordre d'empilement du graphe (bas → haut).
export const ETAGES: EtageDef[] = [
  { serieKey: "salaire",                     dataKey: "salaire",           famille: "salaire",      nom: "Salaire (activité)",                          legende: "Salaire / mi-temps thérapeutique", court: "salaire (activité)",  opacity: 0.9 },
  { serieKey: "maintienEmployeur",           dataKey: "maintien",          famille: "maintien",     nom: "Maintien employeur",                          legende: "Maintien employeur",               court: "maintien employeur",  opacity: 0.9 },
  { serieKey: "ijObligatoire",               dataKey: "ijObl",             famille: "obligatoire",  nom: "Régime obligatoire (IJ)",                     legende: "IJ régime obligatoire",            court: "IJ régime obl.",      opacity: 0.9 },
  { serieKey: "ijComplementaireCollective",  dataKey: "ijColl",            famille: "collective",   nom: "Prévoyance collective (employeur)",           legende: "Complémentaire collective (IJ)",   court: "IJ coll.",            opacity: 0.95 },
  { serieKey: "ijComplementaireIndividuelle",dataKey: "ijInd",             famille: "individuelle", nom: "Prévoyance individuelle (Madelin)",           legende: "Complémentaire individuelle (IJ)", court: "IJ ind.",             opacity: 0.65 },
  { serieKey: "pensionInvalObligatoire",     dataKey: "pensionInvalObl",   famille: "obligatoire",  nom: "Régime obligatoire (pension invalidité)",     legende: "Pension d'invalidité",             court: "pension inval. obl.", opacity: 0.7 },
  { serieKey: "renteInvalCollective",        dataKey: "renteInvalColl",    famille: "collective",   nom: "Prévoyance collective (rente invalidité)",    legende: "Rente invalidité collective",      court: "rente inval. coll.",  opacity: 0.95 },
  { serieKey: "renteInvalIndividuelle",      dataKey: "renteInvalInd",     famille: "individuelle", nom: "Prévoyance individuelle (Madelin, rente)",    legende: "Rente invalidité individuelle",    court: "rente inval. ind.",   opacity: 0.65 },
  { serieKey: "renteInvalEnfants",           dataKey: "renteInvalEnfants", famille: "obligatoire",  nom: "Régime obligatoire (rente enfants)",          legende: "Rente enfants (invalidité)",       court: "rente enfants",       opacity: 0.45 },
];

export const couleurEtage = (e: EtageDef): string => PAYEUR_COLORS[e.famille];

// Familles payeur pour le Tableau € (lignes = payeurs). Chaque famille agrège ses
// étages ; l'ordre suit l'empilement du graphe (haut de tableau = premières couches).
export type PayeurDef = { famille: PayeurFamille; label: string; court: string; color: string; etages: SerieKey[] };

export const PAYEURS: PayeurDef[] = [
  { famille: "salaire",      label: "Salaire (activité)",              court: "Salaire",           color: PAYEUR_COLORS.salaire,      etages: ["salaire"] },
  { famille: "maintien",     label: "Maintien employeur",              court: "Maintien",          color: PAYEUR_COLORS.maintien,     etages: ["maintienEmployeur"] },
  { famille: "obligatoire",  label: "Régime obligatoire",              court: "Régime obligatoire", color: PAYEUR_COLORS.obligatoire, etages: ["ijObligatoire", "pensionInvalObligatoire", "renteInvalEnfants"] },
  { famille: "collective",   label: "Prévoyance collective",           court: "Collective",        color: PAYEUR_COLORS.collective,   etages: ["ijComplementaireCollective", "renteInvalCollective"] },
  { famille: "individuelle", label: "Prévoyance individuelle (Madelin)", court: "Individuelle",     color: PAYEUR_COLORS.individuelle, etages: ["ijComplementaireIndividuelle", "renteInvalIndividuelle"] },
];
